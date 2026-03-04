/**
 * AI Pass 2 PRODUCTION RUN
 * 
 * Runs the AI Pass 2 re-review on ALL on_hold receipts.
 * This WILL change statuses and award points.
 * 
 * Safety: confidence >= 95% for auto-approve, user approval rate >= 80%
 */

import { register } from "tsx/esm/api";
const unregister = register();

// Load env
import dotenv from "dotenv";
dotenv.config();

const { runAiPass2ManualQueueReview } = await import("../server/services/aiPass2ManualQueueReview.ts");

console.log("=== AI Pass 2 PRODUCTION RUN ===");
console.log(`Started at: ${new Date().toISOString()}\n`);

const startTime = Date.now();

const result = await runAiPass2ManualQueueReview({
  limit: 0, // Process ALL on_hold receipts
  approveThreshold: 95,
  minUserApprovalRate: 80,
  adminUserId: 1,
  dryRun: false,
  sendNotifications: true,
  onProgress: (p) => {
    if (p.processed % 10 === 0 || p.isComplete) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`[${elapsed}s] Progress: ${p.processed}/${p.total} | ✅${p.autoApproved} ❌${p.autoRejected} ⏸️${p.keptManual} ⏭️${p.skipped}`);
    }
  },
});

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log("\n========================================");
console.log("=== AI Pass 2 PRODUCTION RESULTS ===");
console.log("========================================");
console.log(`Batch ID: ${result.batchId}`);
console.log(`Duration: ${elapsed}s`);
console.log(`Total Processed: ${result.summary.total}`);
console.log(`✅ Auto Approved: ${result.summary.autoApproved}`);
console.log(`❌ Auto Rejected: ${result.summary.autoRejected}`);
console.log(`⏸️ Keep Manual: ${result.summary.keptManual}`);
console.log(`⏭️ Skipped: ${result.summary.skipped}`);

// Breakdown by reason code
const reasonBreakdown = {};
for (const r of result.results) {
  const key = `${r.action}:${r.reasonCode}`;
  reasonBreakdown[key] = (reasonBreakdown[key] || 0) + 1;
}
console.log("\n=== BREAKDOWN BY REASON ===");
for (const [key, count] of Object.entries(reasonBreakdown).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key}: ${count}`);
}

// Total points awarded
const totalPointsApproved = result.results
  .filter(r => r.action === "auto_approved")
  .reduce((sum, r) => sum + (r.totalAmount ? Math.floor(r.totalAmount * 0.02) : 0), 0);
console.log(`\n💰 Estimated points awarded: ~${totalPointsApproved}`);

console.log("\n=== PRODUCTION RUN COMPLETE ===");
process.exit(0);
