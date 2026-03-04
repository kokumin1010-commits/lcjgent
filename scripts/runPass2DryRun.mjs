/**
 * AI Pass 2 DRY RUN Test
 * 
 * Runs the AI Pass 2 re-review on 5 on_hold receipts in dry-run mode.
 * No status changes, no point awards - just logs the decisions.
 */

import { register } from "tsx/esm/api";
const unregister = register();

// Load env
import dotenv from "dotenv";
dotenv.config();

const { runAiPass2ManualQueueReview } = await import("../server/services/aiPass2ManualQueueReview.ts");

console.log("=== AI Pass 2 DRY RUN (5 receipts) ===\n");

const result = await runAiPass2ManualQueueReview({
  limit: 5,
  approveThreshold: 95,
  minUserApprovalRate: 80,
  adminUserId: 1,
  dryRun: true,
  sendNotifications: false,
  onProgress: (p) => {
    if (p.processed % 1 === 0 || p.isComplete) {
      console.log(`Progress: ${p.processed}/${p.total} | Approved: ${p.autoApproved} | Rejected: ${p.autoRejected} | Manual: ${p.keptManual} | Skipped: ${p.skipped}`);
    }
  },
});

console.log("\n=== DRY RUN RESULTS ===");
console.log(`Batch ID: ${result.batchId}`);
console.log(`Total: ${result.summary.total}`);
console.log(`Auto Approved: ${result.summary.autoApproved}`);
console.log(`Auto Rejected: ${result.summary.autoRejected}`);
console.log(`Keep Manual: ${result.summary.keptManual}`);
console.log(`Skipped: ${result.summary.skipped}`);

console.log("\n=== INDIVIDUAL RESULTS ===");
for (const r of result.results) {
  console.log(`\n#${r.receiptId} [${r.action}]`);
  console.log(`  Reason: ${r.reasonCode}`);
  console.log(`  Detail: ${r.reason}`);
  if (r.confidence !== undefined) console.log(`  Confidence: ${r.confidence}%`);
  if (r.orderNumber) console.log(`  Order: ${r.orderNumber}`);
  if (r.totalAmount) console.log(`  Amount: ¥${r.totalAmount}`);
  if (r.winnerReceiptId) console.log(`  Winner: #${r.winnerReceiptId} (${r.winnerLineUserId})`);
}

console.log("\n=== DRY RUN COMPLETE ===");
process.exit(0);
