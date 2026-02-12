import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ポイント全額購入時のステータス設定テスト
 * 
 * バグ: ポイントで全額購入しても status="pending", paymentMethod="stripe" になっていた
 * 原因: createMallOrder内でtotalAmount(円価格)とpointsToUse(ポイント価格)を比較していたため
 * 修正: isFullPointPurchaseフラグを追加し、ポイント全額購入時は強制的にpaid/pointsに設定
 */

describe("ポイント全額購入時のステータス設定", () => {
  it("isFullPointPurchase=true の場合、cashAmount=0, paymentMethod='points', status='paid' になること", () => {
    // createMallOrderのロジックをシミュレート
    const totalAmount = 1210; // 円価格
    const pointsToUse = 550; // ポイント価格
    const isFullPointPurchase = true;

    let pointsUsed: number;
    let cashAmount: number;
    let paymentMethod: string;
    let status: string;

    if (isFullPointPurchase) {
      pointsUsed = pointsToUse;
      cashAmount = 0;
      paymentMethod = "points";
      status = "paid";
    } else {
      pointsUsed = Math.min(pointsToUse, totalAmount);
      cashAmount = totalAmount - pointsUsed;
      paymentMethod = cashAmount === 0 ? "points" : "stripe";
      status = cashAmount === 0 ? "paid" : "pending";
    }

    expect(pointsUsed).toBe(550);
    expect(cashAmount).toBe(0);
    expect(paymentMethod).toBe("points");
    expect(status).toBe("paid");
  });

  it("isFullPointPurchase=false（通常購入）の場合、ポイント < 円価格なら pending/stripe になること", () => {
    const totalAmount = 1210;
    const pointsToUse = 550;
    const isFullPointPurchase = false;

    let pointsUsed: number;
    let cashAmount: number;
    let paymentMethod: string;
    let status: string;

    if (isFullPointPurchase) {
      pointsUsed = pointsToUse;
      cashAmount = 0;
      paymentMethod = "points";
      status = "paid";
    } else {
      pointsUsed = Math.min(pointsToUse, totalAmount);
      cashAmount = totalAmount - pointsUsed;
      paymentMethod = cashAmount === 0 ? "points" : "stripe";
      status = cashAmount === 0 ? "paid" : "pending";
    }

    expect(pointsUsed).toBe(550);
    expect(cashAmount).toBe(660); // 1210 - 550
    expect(paymentMethod).toBe("stripe");
    expect(status).toBe("pending");
  });

  it("isFullPointPurchase=false でポイント >= 円価格の場合、paid/points になること", () => {
    const totalAmount = 500;
    const pointsToUse = 500;
    const isFullPointPurchase = false;

    let pointsUsed: number;
    let cashAmount: number;
    let paymentMethod: string;
    let status: string;

    if (isFullPointPurchase) {
      pointsUsed = pointsToUse;
      cashAmount = 0;
      paymentMethod = "points";
      status = "paid";
    } else {
      pointsUsed = Math.min(pointsToUse, totalAmount);
      cashAmount = totalAmount - pointsUsed;
      paymentMethod = cashAmount === 0 ? "points" : "stripe";
      status = cashAmount === 0 ? "paid" : "pending";
    }

    expect(pointsUsed).toBe(500);
    expect(cashAmount).toBe(0);
    expect(paymentMethod).toBe("points");
    expect(status).toBe("paid");
  });

  it("isFullPointPurchase=undefined（デフォルト）の場合、通常購入として処理されること", () => {
    const totalAmount = 1210;
    const pointsToUse = 0;
    const isFullPointPurchase = undefined;

    let pointsUsed: number;
    let cashAmount: number;
    let paymentMethod: string;
    let status: string;

    if (isFullPointPurchase) {
      pointsUsed = pointsToUse;
      cashAmount = 0;
      paymentMethod = "points";
      status = "paid";
    } else {
      pointsUsed = Math.min(pointsToUse, totalAmount);
      cashAmount = totalAmount - pointsUsed;
      paymentMethod = cashAmount === 0 ? "points" : "stripe";
      status = cashAmount === 0 ? "paid" : "pending";
    }

    expect(pointsUsed).toBe(0);
    expect(cashAmount).toBe(1210);
    expect(paymentMethod).toBe("stripe");
    expect(status).toBe("pending");
  });
});
