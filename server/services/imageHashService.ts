/**
 * Image Perceptual Hash Service
 * 
 * Computes perceptual hashes (phash) for receipt images using sharp-phash.
 * Used for Level3 duplicate detection (same image → auto reject).
 * 
 * phash is robust against:
 * - Image resizing
 * - JPEG compression
 * - Minor cropping
 * - Color adjustments
 * 
 * Hamming distance thresholds:
 * - 0-3: Nearly identical images (same photo, different compression)
 * - 4-5: Very similar (minor edits, slight crop)
 * - 6-10: Somewhat similar (could be different receipts with similar layout)
 * - 11+: Different images
 * 
 * IMPORTANT: For receipt images (white bg + black text), phash values tend to be
 * very similar even for completely different receipts. Threshold must be strict (<=5)
 * to avoid false positives.
 */

import sharp from "sharp";
import phash from "sharp-phash";
import { getDb } from "../db";
import { imagePerceptualHashes, lineReceipts } from "../../drizzle/schema";
import { eq, and, ne, sql, inArray } from "drizzle-orm";

// Inline hamming distance (replaces sharp-phash/distance to avoid ESM import issues)
function dist(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) count++;
  }
  return count;
}

// Threshold: images with hamming distance <= this are considered "same"
// Changed from 8 to 5 to reduce false positives on receipt images
// Receipt images (white bg + black text) produce very similar phashes,
// so a stricter threshold is needed to only catch truly identical images.
export const PHASH_SIMILARITY_THRESHOLD = 5;

/**
 * Compute perceptual hash for an image from URL
 */
export async function computePhash(imageUrl: string): Promise<{
  phash: string;
  width: number;
  height: number;
  size: number;
} | null> {
  try {
    // Fetch image from URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[ImageHash] Failed to fetch image: ${response.status} ${imageUrl}`);
      return null;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const size = buffer.length;
    
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    // Compute perceptual hash
    const hash = await phash(buffer);
    
    return { phash: hash, width, height, size };
  } catch (error) {
    console.error(`[ImageHash] Error computing phash for ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Compute hamming distance between two phash strings
 */
export function hammingDistance(hash1: string, hash2: string): number {
  return dist(hash1, hash2);
}

/**
 * Store a computed phash in the database
 */
export async function storePhash(params: {
  receiptId: number;
  lineUserId: string;
  imageUrl: string;
  imageIndex: number;
  phash: string;
  imageWidth?: number;
  imageHeight?: number;
  fileSize?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(imagePerceptualHashes).values({
    receiptId: params.receiptId,
    lineUserId: params.lineUserId,
    imageUrl: params.imageUrl,
    imageIndex: params.imageIndex,
    phash: params.phash,
    imageWidth: params.imageWidth || null,
    imageHeight: params.imageHeight || null,
    fileSize: params.fileSize || null,
  });
}

/**
 * Find similar images by phash (Level3 check)
 * Returns receipts with images that have hamming distance <= threshold
 * 
 * IMPORTANT FIX: Now excludes rejected receipts from comparison to prevent
 * the "reject loop" where a user's resubmitted receipt matches their own
 * previously rejected receipt and gets rejected again forever.
 * 
 * Also supports excluding specific receipt IDs (e.g., same user's rejected receipts).
 */
export async function findSimilarImages(
  targetPhash: string,
  excludeReceiptId: number,
  threshold: number = PHASH_SIMILARITY_THRESHOLD,
  options: {
    excludeRejectedReceipts?: boolean;  // Default: true - exclude rejected receipts from comparison
    excludeReceiptIds?: number[];       // Additional receipt IDs to exclude
  } = {}
): Promise<Array<{
  receiptId: number;
  lineUserId: string;
  imageUrl: string;
  phash: string;
  distance: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const { excludeRejectedReceipts = true, excludeReceiptIds = [] } = options;
  
  // Fetch all hashes excluding the current receipt
  const allHashes = await db
    .select({
      receiptId: imagePerceptualHashes.receiptId,
      lineUserId: imagePerceptualHashes.lineUserId,
      imageUrl: imagePerceptualHashes.imageUrl,
      phash: imagePerceptualHashes.phash,
    })
    .from(imagePerceptualHashes)
    .where(ne(imagePerceptualHashes.receiptId, excludeReceiptId));
  
  // If we need to exclude rejected receipts, fetch their IDs
  let rejectedReceiptIds = new Set<number>();
  if (excludeRejectedReceipts && allHashes.length > 0) {
    const receiptIds = [...new Set(allHashes.map(h => h.receiptId))];
    
    // Batch query to get status of all matched receipts
    // Process in chunks to avoid query size limits
    const chunkSize = 500;
    for (let i = 0; i < receiptIds.length; i += chunkSize) {
      const chunk = receiptIds.slice(i, i + chunkSize);
      const receiptsWithStatus = await db
        .select({ id: lineReceipts.id, status: lineReceipts.status })
        .from(lineReceipts)
        .where(inArray(lineReceipts.id, chunk));
      
      for (const r of receiptsWithStatus) {
        if (r.status === "rejected") {
          rejectedReceiptIds.add(r.id);
        }
      }
    }
    
    console.log(`[ImageHash] findSimilarImages: excluding ${rejectedReceiptIds.size} rejected receipts from ${receiptIds.length} total`);
  }
  
  // Also exclude additional specified receipt IDs
  const additionalExcludeSet = new Set(excludeReceiptIds);
  
  // Compare with target hash, filtering out rejected receipts
  const similar: Array<{
    receiptId: number;
    lineUserId: string;
    imageUrl: string;
    phash: string;
    distance: number;
  }> = [];
  
  for (const row of allHashes) {
    // Skip rejected receipts
    if (rejectedReceiptIds.has(row.receiptId)) continue;
    // Skip additional excluded receipts
    if (additionalExcludeSet.has(row.receiptId)) continue;
    
    const d = hammingDistance(targetPhash, row.phash);
    if (d <= threshold) {
      similar.push({
        receiptId: row.receiptId,
        lineUserId: row.lineUserId,
        imageUrl: row.imageUrl,
        phash: row.phash,
        distance: d,
      });
    }
  }
  
  // Sort by distance (most similar first)
  similar.sort((a, b) => a.distance - b.distance);
  
  return similar;
}

/**
 * Check if a receipt's image already exists (Level3 duplicate check)
 * Returns the matching receipt if found, null otherwise
 */
export async function checkLevel3Duplicate(
  receiptId: number,
  imageUrl: string,
  lineUserId: string
): Promise<{
  isDuplicate: boolean;
  matchedReceiptId?: number;
  matchedLineUserId?: string;
  matchedImageUrl?: string;
  distance?: number;
  isCrossUser?: boolean;
} | null> {
  try {
    // Compute phash for the target image
    const hashResult = await computePhash(imageUrl);
    if (!hashResult) return null;
    
    // Store the hash
    await storePhash({
      receiptId,
      lineUserId,
      imageUrl,
      imageIndex: 0,
      phash: hashResult.phash,
      imageWidth: hashResult.width,
      imageHeight: hashResult.height,
      fileSize: hashResult.size,
    });
    
    // Find similar images (now automatically excludes rejected receipts)
    const similar = await findSimilarImages(hashResult.phash, receiptId);
    
    if (similar.length === 0) {
      return { isDuplicate: false };
    }
    
    const bestMatch = similar[0];
    return {
      isDuplicate: true,
      matchedReceiptId: bestMatch.receiptId,
      matchedLineUserId: bestMatch.lineUserId,
      matchedImageUrl: bestMatch.imageUrl,
      distance: bestMatch.distance,
      isCrossUser: bestMatch.lineUserId !== lineUserId,
    };
  } catch (error) {
    console.error(`[ImageHash] Level3 check failed for receipt ${receiptId}:`, error);
    return null;
  }
}

/**
 * Get phash for a receipt (if already computed)
 */
export async function getPhashForReceipt(receiptId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select({ phash: imagePerceptualHashes.phash })
    .from(imagePerceptualHashes)
    .where(eq(imagePerceptualHashes.receiptId, receiptId))
    .limit(1);
  
  return result[0]?.phash || null;
}

/**
 * Batch compute and store phashes for multiple receipts
 * Used for backfilling existing receipts
 */
export async function batchComputePhashes(
  receipts: Array<{ id: number; lineUserId: string; imageUrl: string; imageUrls?: string[] | null }>,
  options: { concurrency?: number; onProgress?: (processed: number, total: number) => void } = {}
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ receiptId: number; error: string }>;
}> {
  const { concurrency = 5, onProgress } = options;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ receiptId: number; error: string }> = [];
  
  // Process in batches
  for (let i = 0; i < receipts.length; i += concurrency) {
    const batch = receipts.slice(i, i + concurrency);
    
    await Promise.all(batch.map(async (receipt) => {
      try {
        // Process primary image
        const hashResult = await computePhash(receipt.imageUrl);
        if (hashResult) {
          await storePhash({
            receiptId: receipt.id,
            lineUserId: receipt.lineUserId,
            imageUrl: receipt.imageUrl,
            imageIndex: 0,
            phash: hashResult.phash,
            imageWidth: hashResult.width,
            imageHeight: hashResult.height,
            fileSize: hashResult.size,
          });
          succeeded++;
        } else {
          failed++;
          errors.push({ receiptId: receipt.id, error: "Failed to compute phash" });
        }
        
        // Process additional images if any
        if (receipt.imageUrls && receipt.imageUrls.length > 1) {
          for (let idx = 1; idx < receipt.imageUrls.length; idx++) {
            try {
              const additionalHash = await computePhash(receipt.imageUrls[idx]);
              if (additionalHash) {
                await storePhash({
                  receiptId: receipt.id,
                  lineUserId: receipt.lineUserId,
                  imageUrl: receipt.imageUrls[idx],
                  imageIndex: idx,
                  phash: additionalHash.phash,
                  imageWidth: additionalHash.width,
                  imageHeight: additionalHash.height,
                  fileSize: additionalHash.size,
                });
              }
            } catch (err) {
              // Don't fail the whole receipt for additional images
              console.error(`[ImageHash] Failed additional image ${idx} for receipt ${receipt.id}:`, err);
            }
          }
        }
      } catch (err: any) {
        failed++;
        errors.push({ receiptId: receipt.id, error: err.message || String(err) });
      }
      
      processed++;
      if (onProgress) onProgress(processed, receipts.length);
    }));
  }
  
  return { processed, succeeded, failed, errors };
}

/**
 * Build fraud ring connections from image hash similarities
 * Scans all hashes and finds clusters of similar images across different users
 */
export async function findImageHashClusters(
  threshold: number = PHASH_SIMILARITY_THRESHOLD
): Promise<Array<{
  hash1ReceiptId: number;
  hash1LineUserId: string;
  hash1ImageUrl: string;
  hash2ReceiptId: number;
  hash2LineUserId: string;
  hash2ImageUrl: string;
  distance: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const allHashes = await db
    .select({
      receiptId: imagePerceptualHashes.receiptId,
      lineUserId: imagePerceptualHashes.lineUserId,
      imageUrl: imagePerceptualHashes.imageUrl,
      phash: imagePerceptualHashes.phash,
    })
    .from(imagePerceptualHashes);
  
  const connections: Array<{
    hash1ReceiptId: number;
    hash1LineUserId: string;
    hash1ImageUrl: string;
    hash2ReceiptId: number;
    hash2LineUserId: string;
    hash2ImageUrl: string;
    distance: number;
  }> = [];
  
  // O(n^2) comparison - optimize later with BK-tree if needed
  for (let i = 0; i < allHashes.length; i++) {
    for (let j = i + 1; j < allHashes.length; j++) {
      // Skip same receipt
      if (allHashes[i].receiptId === allHashes[j].receiptId) continue;
      
      const d = hammingDistance(allHashes[i].phash, allHashes[j].phash);
      if (d <= threshold) {
        connections.push({
          hash1ReceiptId: allHashes[i].receiptId,
          hash1LineUserId: allHashes[i].lineUserId,
          hash1ImageUrl: allHashes[i].imageUrl,
          hash2ReceiptId: allHashes[j].receiptId,
          hash2LineUserId: allHashes[j].lineUserId,
          hash2ImageUrl: allHashes[j].imageUrl,
          distance: d,
        });
      }
    }
  }
  
  return connections;
}
