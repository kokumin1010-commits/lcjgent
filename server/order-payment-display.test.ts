import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Test: Order payment display correctly differentiates between
 * points-only purchases and Stripe/mixed payments
 */

describe("OrderManagement - Payment Display Fix", () => {
  const filePath = path.resolve(__dirname, "../client/src/pages/OrderManagement.tsx");
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(filePath, "utf-8");
  });

  it("should display payment method label (ポイント全額/クレジットカード/代引き)", () => {
    expect(source).toContain("ポイント全額");
    expect(source).toContain("クレジットカード");
    expect(source).toContain("代引き");
  });

  it("should show points total for points-only orders in detail view", () => {
    // In the payment info section, points orders should show pt not yen
    expect(source).toContain("orderDetail.order.paymentMethod === 'points'");
    expect(source).toContain("orderDetail.order.pointsUsed.toLocaleString()} pt");
  });

  it("should show yen total for Stripe orders in detail view", () => {
    expect(source).toContain("orderDetail.order.totalAmount.toLocaleString()}`");
  });

  it("should only show ポイント利用 deduction for non-points orders", () => {
    // Points deduction should only show for mixed payments (Stripe + points)
    expect(source).toContain("orderDetail.order.paymentMethod !== 'points' && orderDetail.order.pointsUsed > 0");
  });

  it("should only show 現金支払い for non-points orders", () => {
    expect(source).toContain("orderDetail.order.paymentMethod !== 'points' && orderDetail.order.cashAmount > 0");
  });

  it("should display payment method icon in order list cards", () => {
    // Points orders should show Coins icon, Stripe should show CreditCard
    expect(source).toContain("item.order.paymentMethod === 'points'");
  });

  it("should show point prices for items in points-only orders", () => {
    // Item prices should show pointPrice when order is points-only
    expect(source).toContain("item.productPointPrice ?? item.productPrice");
  });

  it("should show payment method label in order list cards", () => {
    expect(source).toContain("item.order.paymentMethod === 'points' ? 'ポイント'");
    expect(source).toContain("item.order.paymentMethod === 'stripe' ? 'カード'");
  });
});

describe("LineMypage - Payment Display (already correct)", () => {
  const filePath = path.resolve(__dirname, "../client/src/pages/LineMypage.tsx");
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(filePath, "utf-8");
  });

  it("should differentiate points vs yen display in order list", () => {
    expect(source).toContain("order.paymentMethod === 'points'");
    expect(source).toContain("order.pointsUsed?.toLocaleString()} pt");
    expect(source).toContain("order.totalAmount?.toLocaleString()");
  });

  it("should show correct payment method labels", () => {
    expect(source).toContain("order.paymentMethod === 'points' ? 'ポイント'");
    expect(source).toContain("order.paymentMethod === 'stripe' ? 'クレジットカード'");
  });
});

describe("createMallOrder - Points calculation logic", () => {
  const filePath = path.resolve(__dirname, "db.ts");
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(filePath, "utf-8");
  });

  it("should set cashAmount to 0 for full point purchases", () => {
    const orderBlock = source.substring(
      source.indexOf("if (data.isFullPointPurchase)"),
      source.indexOf("// 注文を作成")
    );
    expect(orderBlock).toContain("cashAmount = 0");
    expect(orderBlock).toContain('paymentMethod = "points"');
    expect(orderBlock).toContain('status = "paid"');
  });

  it("should calculate cashAmount for mixed purchases", () => {
    const orderBlock = source.substring(
      source.indexOf("// 通常購入（Stripe等）"),
      source.indexOf("// 注文を作成")
    );
    expect(orderBlock).toContain("cashAmount = totalAmount - pointsUsed");
  });

  it("should set paymentMethod to points when cashAmount is 0 in mixed mode", () => {
    const orderBlock = source.substring(
      source.indexOf("// 通常購入（Stripe等）"),
      source.indexOf("// 注文を作成")
    );
    expect(orderBlock).toContain('cashAmount === 0 ? "points" : "stripe"');
  });
});
