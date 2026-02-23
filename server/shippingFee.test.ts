import { describe, it, expect, vi, beforeEach } from "vitest";

// 送料定数
const SHIPPING_FEE = 880;
const FREE_SHIPPING_THRESHOLD = 5000;

// 送料計算ロジック（バックエンドと同じロジック）
function calculateShippingFee(subtotal: number): number {
  return subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
}

describe("送料計算ロジック", () => {
  describe("基本的な送料計算", () => {
    it("5,000pt未満の注文には880ptの送料がかかる", () => {
      expect(calculateShippingFee(1000)).toBe(880);
      expect(calculateShippingFee(2200)).toBe(880);
      expect(calculateShippingFee(4999)).toBe(880);
    });

    it("5,000pt以上の注文は送料無料", () => {
      expect(calculateShippingFee(5000)).toBe(0);
      expect(calculateShippingFee(5001)).toBe(0);
      expect(calculateShippingFee(10000)).toBe(0);
    });

    it("ちょうど5,000ptの注文は送料無料", () => {
      expect(calculateShippingFee(5000)).toBe(0);
    });

    it("0ptの注文には送料がかかる", () => {
      expect(calculateShippingFee(0)).toBe(880);
    });
  });

  describe("ポイント購入時の合計計算", () => {
    it("商品小計が5,000pt未満の場合、合計に送料880ptが加算される", () => {
      const itemsTotal = 2200; // 商品小計
      const shipping = calculateShippingFee(itemsTotal);
      const total = itemsTotal + shipping;
      expect(total).toBe(3080); // 2200 + 880
    });

    it("商品小計が5,000pt以上の場合、合計は商品小計と同じ", () => {
      const itemsTotal = 6000;
      const shipping = calculateShippingFee(itemsTotal);
      const total = itemsTotal + shipping;
      expect(total).toBe(6000); // 送料無料
    });

    it("複数商品の合計が5,000pt以上なら送料無料", () => {
      const items = [
        { pointPrice: 560, quantity: 4 }, // 2240pt
        { pointPrice: 1000, quantity: 3 }, // 3000pt
      ];
      const itemsTotal = items.reduce((sum, item) => sum + item.pointPrice * item.quantity, 0);
      expect(itemsTotal).toBe(5240);
      expect(calculateShippingFee(itemsTotal)).toBe(0);
    });

    it("複数商品の合計が5,000pt未満なら送料880pt", () => {
      const items = [
        { pointPrice: 560, quantity: 2 }, // 1120pt
        { pointPrice: 800, quantity: 1 }, // 800pt
      ];
      const itemsTotal = items.reduce((sum, item) => sum + item.pointPrice * item.quantity, 0);
      expect(itemsTotal).toBe(1920);
      expect(calculateShippingFee(itemsTotal)).toBe(880);
      expect(itemsTotal + 880).toBe(2800);
    });
  });

  describe("Stripe決済時の送料計算", () => {
    it("5,000円未満の注文には880円の送料がかかる", () => {
      const subtotal = 3000;
      const shipping = calculateShippingFee(subtotal);
      expect(shipping).toBe(880);
      expect(subtotal + shipping).toBe(3880);
    });

    it("5,000円以上の注文は送料無料", () => {
      const subtotal = 7500;
      const shipping = calculateShippingFee(subtotal);
      expect(shipping).toBe(0);
      expect(subtotal + shipping).toBe(7500);
    });
  });

  describe("注文詳細の送料逆算", () => {
    it("ポイント注文の送料を逆算できる（送料あり）", () => {
      const pointsUsed = 3080; // 合計
      const itemsPointTotal = 2200; // 商品小計
      const shippingAmount = pointsUsed - itemsPointTotal;
      expect(shippingAmount).toBe(880);
    });

    it("ポイント注文の送料を逆算できる（送料なし）", () => {
      const pointsUsed = 6000;
      const itemsPointTotal = 6000;
      const shippingAmount = pointsUsed - itemsPointTotal;
      expect(shippingAmount).toBe(0);
    });

    it("Stripe注文の送料を逆算できる（送料あり）", () => {
      const totalAmount = 3880;
      const itemsCashTotal = 3000;
      const shippingAmount = totalAmount - itemsCashTotal;
      expect(shippingAmount).toBe(880);
    });
  });
});
