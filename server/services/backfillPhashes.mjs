/**
 * Backfill perceptual hashes for all existing line_receipts
 * 
 * Usage: node server/services/backfillPhashes.mjs [--limit N] [--offset N] [--concurrency N]
 * 
 * This script:
 * 1. Fetches all line_receipts that don't have a phash yet
 * 2. Downloads each image and computes phash using sharp-phash
 * 3. Stores the result in image_perceptual_hashes table
 */

import mysql from "mysql2/promise";
import sharp from "sharp";
import phashFn from "sharp-phash";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1]) : null;
};

const LIMIT = getArg("limit") || 999999;
const OFFSET = getArg("offset") || 0;
const CONCURRENCY = getArg("concurrency") || 5;

async function computePhash(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  const hash = await phashFn(buffer);
  return {
    phash: hash,
    width: metadata.width || 0,
    height: metadata.height || 0,
    size: buffer.length,
  };
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Get receipts that don't have phash yet
  const [receipts] = await conn.execute(`
    SELECT lr.id, lr.lineUserId, lr.imageUrl, lr.imageUrls
    FROM line_receipts lr
    LEFT JOIN image_perceptual_hashes iph ON lr.id = iph.receiptId
    WHERE iph.id IS NULL
    ORDER BY lr.id ASC
    LIMIT ${LIMIT} OFFSET ${OFFSET}
  `);
  
  console.log(`[Backfill] Found ${receipts.length} receipts without phash (limit=${LIMIT}, offset=${OFFSET})`);
  
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const startTime = Date.now();
  
  // Process in batches of CONCURRENCY
  for (let i = 0; i < receipts.length; i += CONCURRENCY) {
    const batch = receipts.slice(i, i + CONCURRENCY);
    
    await Promise.all(batch.map(async (receipt) => {
      try {
        const result = await computePhash(receipt.imageUrl);
        
        await conn.execute(`
          INSERT INTO image_perceptual_hashes 
          (receiptId, lineUserId, imageUrl, imageIndex, phash, imageWidth, imageHeight, fileSize)
          VALUES (?, ?, ?, 0, ?, ?, ?, ?)
        `, [receipt.id, receipt.lineUserId, receipt.imageUrl, result.phash, result.width, result.height, result.size]);
        
        succeeded++;
        
        // Process additional images
        if (receipt.imageUrls) {
          const urls = typeof receipt.imageUrls === "string" ? JSON.parse(receipt.imageUrls) : receipt.imageUrls;
          if (Array.isArray(urls) && urls.length > 1) {
            for (let idx = 1; idx < urls.length; idx++) {
              try {
                const addResult = await computePhash(urls[idx]);
                await conn.execute(`
                  INSERT INTO image_perceptual_hashes 
                  (receiptId, lineUserId, imageUrl, imageIndex, phash, imageWidth, imageHeight, fileSize)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [receipt.id, receipt.lineUserId, urls[idx], idx, addResult.phash, addResult.width, addResult.height, addResult.size]);
              } catch (err) {
                // Don't fail for additional images
              }
            }
          }
        }
      } catch (err) {
        failed++;
        if (failed <= 10) {
          console.error(`[Backfill] Failed receipt #${receipt.id}: ${err.message}`);
        }
      }
      
      processed++;
    }));
    
    // Progress report every 100 items
    if (processed % 100 === 0 || processed === receipts.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (processed / (elapsed || 1)).toFixed(1);
      const eta = ((receipts.length - processed) / (rate || 1)).toFixed(0);
      console.log(`[Backfill] ${processed}/${receipts.length} (${succeeded} ok, ${failed} fail) | ${elapsed}s elapsed | ${rate}/s | ETA ${eta}s`);
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[Backfill] COMPLETE`);
  console.log(`  Total: ${processed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Time: ${totalTime}s`);
  
  // Show duplicate detection preview
  console.log(`\n[Backfill] Checking for similar images...`);
  const [allHashes] = await conn.execute(`
    SELECT receiptId, lineUserId, phash FROM image_perceptual_hashes ORDER BY receiptId
  `);
  
  let duplicatePairs = 0;
  let crossUserPairs = 0;
  const sameUserPairs = [];
  const crossUserExamples = [];
  
  // Sample check (first 5000 to avoid O(n^2) explosion)
  const sample = allHashes.slice(0, 5000);
  for (let a = 0; a < sample.length; a++) {
    for (let b = a + 1; b < sample.length; b++) {
      if (sample[a].receiptId === sample[b].receiptId) continue;
      
      // Compute hamming distance manually
      let distance = 0;
      const h1 = sample[a].phash;
      const h2 = sample[b].phash;
      for (let c = 0; c < h1.length; c++) {
        if (h1[c] !== h2[c]) distance++;
      }
      
      if (distance <= 8) {
        duplicatePairs++;
        if (sample[a].lineUserId !== sample[b].lineUserId) {
          crossUserPairs++;
          if (crossUserExamples.length < 5) {
            crossUserExamples.push({
              receipt1: sample[a].receiptId,
              user1: sample[a].lineUserId,
              receipt2: sample[b].receiptId,
              user2: sample[b].lineUserId,
              distance,
            });
          }
        } else {
          if (sameUserPairs.length < 5) {
            sameUserPairs.push({
              receipt1: sample[a].receiptId,
              user: sample[a].lineUserId,
              receipt2: sample[b].receiptId,
              distance,
            });
          }
        }
      }
    }
  }
  
  console.log(`  Similar image pairs (distance <= 8): ${duplicatePairs}`);
  console.log(`  Cross-user pairs: ${crossUserPairs}`);
  if (crossUserExamples.length > 0) {
    console.log(`  Cross-user examples:`, JSON.stringify(crossUserExamples, null, 2));
  }
  if (sameUserPairs.length > 0) {
    console.log(`  Same-user examples:`, JSON.stringify(sameUserPairs, null, 2));
  }
  
  await conn.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
