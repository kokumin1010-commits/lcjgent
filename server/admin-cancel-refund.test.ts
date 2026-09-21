import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function exportedFunction(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`export async function ${name}`);
  const end = source.indexOf(`export async function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("order cancellation under the Beauty Wallet primary-ledger policy", () => {
  const db = read("server/db.ts");
  const memberCancellation = exportedFunction(db, "cancelMallOrder", "getMallOrders");
  const adminCancellation = exportedFunction(db, "updateMallOrderStatus", "updateMallOrderStripeInfo");
  const adminUi = read("client/src/pages/OrderManagement.tsx");
  const memberUi = read("client/src/pages/LineMypage.tsx");

  it("keeps the compatibility response at zero without changing LCJ point tables", () => {
    for (const source of [memberCancellation, adminCancellation]) {
      expect(source).toContain("const pointsRefunded = 0");
      expect(source).toContain("pointsRefunded");
      expect(source).not.toContain("update(linePointBalances)");
      expect(source).not.toContain("insert(linePointTransactions)");
      expect(source).toContain("Legacy point refund skipped");
    }
  });

  it("continues stock restoration and Stripe refund handling independently", () => {
    for (const source of [memberCancellation, adminCancellation]) {
      expect(source).toContain("sql`${mallProducts.stock} + ${item.quantity}`");
      expect(source).toContain("stripeClient.refunds.create");
    }
  });

  it("does not expose order numbers or payment intent identifiers in refund logs", () => {
    expect(memberCancellation).not.toContain("order.orderNumber");
    expect(memberCancellation).not.toContain("PaymentIntent:");
    expect(adminCancellation).not.toContain("order.orderNumber");
    expect(adminCancellation).not.toContain("PaymentIntent:");
  });

  it("does not tell administrators or members that local points were automatically returned", () => {
    expect(adminUi).not.toContain("data?.pointsRefunded");
    expect(adminUi).not.toContain("ポイントを返還しました");
    expect(memberUi).toContain("旧LCJポイント利用分は自動返還されません");
  });
});
