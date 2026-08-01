/**
 * Product Image Cache
 * 
 * メモリキャッシュで商品画像URLを保持し、DBへの重複クエリを防ぐ。
 * - TTL: 5分（300秒）
 * - 最大エントリ数: 2000
 * - product_master → receipt_reviews の優先順位で画像を取得
 * - 部分一致フォールバック付き
 */

import { eq, and, sql, inArray, isNotNull, like, desc } from "drizzle-orm";
import { productMaster, productNameAliases, receiptReviews } from "../drizzle/schema";

// getDb is imported from db.ts but we need to avoid circular dependency
// So we'll accept db instance as parameter

interface CacheEntry {
  url: string | null;
  timestamp: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 2000;

// In-memory cache: productName → imageUrl
const cache = new Map<string, CacheEntry>();

// Cleanup old entries periodically
function cleanup() {
  const now = Date.now();
  if (cache.size <= MAX_ENTRIES) return;
  
  // Remove expired entries first
  const keysToDelete: string[] = [];
  cache.forEach((entry, key) => {
    if (now - entry.timestamp > TTL_MS) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
  
  // If still over limit, remove oldest entries
  if (cache.size > MAX_ENTRIES) {
    const entries: Array<[string, CacheEntry]> = [];
    cache.forEach((entry, key) => entries.push([key, entry]));
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
    toRemove.forEach(([key]) => cache.delete(key));
  }
}

/**
 * Get cached image URL for a product name
 */
function getCached(productName: string): string | null | undefined {
  const entry = cache.get(productName);
  if (!entry) return undefined; // not in cache
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(productName);
    return undefined; // expired
  }
  return entry.url; // could be null (means "no image found")
}

/**
 * Set cache entry
 */
function setCache(productName: string, url: string | null) {
  cache.set(productName, { url, timestamp: Date.now() });
  if (cache.size > MAX_ENTRIES * 1.2) cleanup();
}

/**
 * Batch resolve product images for multiple product names.
 * Returns a Map<productName, imageUrl | null>
 * 
 * Strategy:
 * 1. Check memory cache first
 * 2. For cache misses, query product_master (exact match on canonicalName)
 * 3. For still-missing, query receipt_reviews (exact match on productName)
 * 4. For still-missing, try partial match on product_master (LIKE with first significant word)
 * 5. Cache all results (including null = "no image")
 */
export async function batchResolveProductImages(
  db: any,
  productNames: string[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const uncached: string[] = [];

  // Step 1: Check cache
  for (const name of productNames) {
    const cached = getCached(name);
    if (cached !== undefined) {
      result.set(name, cached);
    } else {
      uncached.push(name);
    }
  }

  if (uncached.length === 0) return result;

  try {
    // Step 2: Query product_master (exact match)
    const masterResults = await db.select({
      canonicalName: productMaster.canonicalName,
      imageUrl: productMaster.imageUrl,
    }).from(productMaster)
      .where(and(
        inArray(productMaster.canonicalName, uncached),
        isNotNull(productMaster.imageUrl),
        sql`${productMaster.imageUrl} != ''`
      ));

    for (const row of masterResults) {
      if (row.imageUrl) {
        result.set(row.canonicalName, row.imageUrl);
        setCache(row.canonicalName, row.imageUrl);
      }
    }

    // Step 3: For remaining, query receipt_reviews
    const stillMissing = uncached.filter(n => !result.has(n));
    if (stillMissing.length > 0) {
      const reviewResults = await db.select({
        productName: receiptReviews.productName,
        productImageUrl: receiptReviews.productImageUrl,
      }).from(receiptReviews)
        .where(and(
          inArray(receiptReviews.productName, stillMissing),
          isNotNull(receiptReviews.productImageUrl),
          sql`${receiptReviews.productImageUrl} != ''`
        ))
        .groupBy(receiptReviews.productName, receiptReviews.productImageUrl)
        .limit(stillMissing.length);

      for (const row of reviewResults) {
        if (row.productImageUrl && !result.has(row.productName)) {
          result.set(row.productName, row.productImageUrl);
          setCache(row.productName, row.productImageUrl);
        }
      }
    }

    // Step 4: Use product_name_aliases to find matches via alias table
    const afterReviewMissing = uncached.filter(n => !result.has(n));
    if (afterReviewMissing.length > 0) {
      try {
        const aliasResults = await db.select({
          aliasName: productNameAliases.aliasName,
          canonicalName: productMaster.canonicalName,
          imageUrl: productMaster.imageUrl,
        }).from(productNameAliases)
          .innerJoin(productMaster, eq(productNameAliases.productMasterId, productMaster.id))
          .where(and(
            inArray(productNameAliases.aliasName, afterReviewMissing),
            isNotNull(productMaster.imageUrl),
            sql`${productMaster.imageUrl} != ''`
          ));
        for (const row of aliasResults) {
          if (row.imageUrl && !result.has(row.aliasName)) {
            result.set(row.aliasName, row.imageUrl);
            setCache(row.aliasName, row.imageUrl);
          }
        }
      } catch (e) {
        // productNameAliases table might not exist yet, ignore
      }
    }

    // Step 5: Partial match fallback for remaining products
    const finalMissing = uncached.filter(n => !result.has(n));
    if (finalMissing.length > 0 && finalMissing.length <= 30) {
      // Only do partial match for small batches to avoid performance issues
      for (const name of finalMissing) {
        // Extract first meaningful word (at least 3 chars, skip common prefixes)
        const words = name.split(/[\s\u3000]+/).filter(w => w.length >= 3);
        if (words.length === 0) {
          setCache(name, null);
          result.set(name, null);
          continue;
        }
        
        // Try LIKE match with the product name (use first 2 words for better precision)
        const searchTerm = words.slice(0, 2).join('%');
        const partialResults = await db.select({
          canonicalName: productMaster.canonicalName,
          imageUrl: productMaster.imageUrl,
        }).from(productMaster)
          .where(and(
            like(productMaster.canonicalName, `%${searchTerm}%`),
            isNotNull(productMaster.imageUrl),
            sql`${productMaster.imageUrl} != ''`
          ))
          .limit(1);

        if (partialResults.length > 0 && partialResults[0].imageUrl) {
          result.set(name, partialResults[0].imageUrl);
          setCache(name, partialResults[0].imageUrl);
        } else {
          // Also try receipt_reviews with partial match
          const partialReview = await db.select({
            productImageUrl: receiptReviews.productImageUrl,
          }).from(receiptReviews)
            .where(and(
              like(receiptReviews.productName, `%${searchTerm}%`),
              isNotNull(receiptReviews.productImageUrl),
              sql`${receiptReviews.productImageUrl} != ''`
            ))
            .orderBy(desc(receiptReviews.createdAt))
            .limit(1);

          if (partialReview.length > 0 && partialReview[0].productImageUrl) {
            result.set(name, partialReview[0].productImageUrl);
            setCache(name, partialReview[0].productImageUrl);
          } else {
            result.set(name, null);
            setCache(name, null);
          }
        }
      }
    } else {
      // For large batches, just mark remaining as null
      for (const name of finalMissing) {
        result.set(name, null);
        setCache(name, null);
      }
    }
  } catch (error) {
    console.warn('[productImageCache] Error resolving images:', error);
    // Set null for all uncached to avoid repeated failures
    for (const name of uncached) {
      if (!result.has(name)) {
        result.set(name, null);
        setCache(name, null);
      }
    }
  }

  return result;
}

/**
 * Invalidate cache for specific product names (e.g., when image is updated)
 */
export function invalidateProductImageCache(productNames?: string[]) {
  if (!productNames) {
    cache.clear();
  } else {
    productNames.forEach(name => cache.delete(name));
  }
}

/**
 * Get cache stats for debugging
 */
export function getProductImageCacheStats() {
  return {
    size: cache.size,
    maxEntries: MAX_ENTRIES,
    ttlMs: TTL_MS,
  };
}
