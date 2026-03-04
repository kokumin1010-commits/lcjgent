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
 * - 0-5: Nearly identical images (same photo, different compression)
 * - 6-10: Very similar (minor edits, slight crop)
 * - 11+: Different images
 */

import sharp from "sharp";
import phash from "sharp-phash";
import dist from "sharp-phash/distance";
import { getDb } from "../db";
import { imagePerceptualHashes } from "../../drizzle/schema";
import { eq, and, ne, sql } from "drizzle-orm";

// Threshold: images with hamming distance <= this are considered "same"
export const PHASH_SIMILARITY_THRESHOLD = 8;

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
 * Note: For large datasets, this does a full scan. Consider adding
 * a BK-tree or VP-tree index for production optimization.
 */
export async function findSimilarImages(
  targetPhash: string,
  excludeReceiptId: number,
  threshold: number = PHASH_SIMILARITY_THRESHOLD
): Promise<Array<{
  receiptId: number;
  lineUserId: string;
  imageUrl: string;
  phash: string;
  distance: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  // Fetch all hashes (for now - optimize with BK-tree later if needed)
  const allHashes = await db
    .select({
      receiptId: imagePerceptualHashes.receiptId,
      lineUserId: imagePerceptualHashes.lineUserId,
      imageUrl: imagePerceptualHashes.imageUrl,
      phash: imagePerceptualHashes.phash,
    })
    .from(imagePerceptualHashes)
    .where(ne(imagePerceptualHashes.receiptId, excludeReceiptId));
  
  // Compare with target hash
  const similar: Array<{
    receiptId: number;
    lineUserId: string;
    imageUrl: string;
    phash: string;
    distance: number;
  }> = [];
  
  for (const row of allHashes) {
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
    
    // Find similar images
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
