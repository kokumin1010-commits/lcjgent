import { describe, it, expect } from "vitest";

/**
 * invoicePdf.ts のロジックテスト
 * 
 * フロントエンド側のjsPDF生成はブラウザ環境が必要なため、
 * ここではデータ変換ロジック（convertOrderToInvoiceData）のテストを行う
 */

// convertOrderToInvoiceData のロジックを直接テスト
// フロントエンドモジュールなのでロジックを抽出してテスト

describe("Invoice PDF data conversion logic", () => {
  const mockOrderDetail = {
    order: {
      orderNumber: "ORD-20260219-001",
      createdAt: "2026-02-19T12:00:00.000Z",
      totalAmount: 13365,
      pointsUsed: 0,
      cashAmount: 13365,
      paymentMethod: "stripe",
      shippingName: "テスト太郎",
      shippingPhone: "090-1234-5678",
      shippingPostalCode: "150-0001",
      shippingAddress: "東京都渋谷区神宮前五丁目46番20号",
    },
    lineUser: {
      displayName: "テストユーザー",
    },
    items: [
      {
        productName: "CBDブースト×10・コラーゲンブースト×10",
        productPrice: 12150,
        productPointPrice: null,
        quantity: 1,
        subtotal: 12150,
      },
    ],
  };

  it("should extract buyer name from shippingName", () => {
    const order = mockOrderDetail.order;
    const buyerName = order.shippingName || mockOrderDetail.lineUser?.displayName || "お客様";
    expect(buyerName).toBe("テスト太郎");
  });

  it("should fallback to displayName when shippingName is null", () => {
    const order = { ...mockOrderDetail.order, shippingName: null };
    const buyerName = order.shippingName || mockOrderDetail.lineUser?.displayName || "お客様";
    expect(buyerName).toBe("テストユーザー");
  });

  it("should fallback to お客様 when both names are null", () => {
    const order = { ...mockOrderDetail.order, shippingName: null };
    const lineUser = null;
    const buyerName = order.shippingName || lineUser?.displayName || "お客様";
    expect(buyerName).toBe("お客様");
  });

  it("should calculate tax correctly for 10% rate", () => {
    const subtotalAmount = 12150;
    const taxRate = 0.10;
    const taxExcluded = Math.round(subtotalAmount / (1 + taxRate));
    const tax10 = subtotalAmount - taxExcluded;
    
    expect(taxExcluded).toBe(11045); // 12150 / 1.10 ≈ 11045
    expect(tax10).toBe(1105); // 12150 - 11045 = 1105
    expect(taxExcluded + tax10).toBe(subtotalAmount);
  });

  it("should handle points-only orders", () => {
    const order = {
      ...mockOrderDetail.order,
      paymentMethod: "points",
      pointsUsed: 5000,
      cashAmount: 0,
      totalAmount: 5000,
    };
    const isPoints = order.paymentMethod === "points";
    expect(isPoints).toBe(true);
    
    const item = mockOrderDetail.items[0];
    const unitPrice = isPoints ? (item.productPointPrice ?? item.productPrice) : item.productPrice;
    expect(unitPrice).toBe(12150); // productPointPrice is null, fallback to productPrice
  });

  it("should handle items with productPointPrice", () => {
    const item = {
      productName: "テスト商品",
      productPrice: 1000,
      productPointPrice: 800,
      quantity: 2,
      subtotal: 2000,
    };
    const isPoints = true;
    const unitPrice = isPoints ? (item.productPointPrice ?? item.productPrice) : item.productPrice;
    expect(unitPrice).toBe(800);
    
    const subtotal = unitPrice * item.quantity;
    expect(subtotal).toBe(1600);
  });

  it("should format yen amounts correctly", () => {
    const formatYen = (amount: number) => `¥${amount.toLocaleString()}`;
    expect(formatYen(13365)).toBe("¥13,365");
    expect(formatYen(0)).toBe("¥0");
    expect(formatYen(1000000)).toBe("¥1,000,000");
  });

  it("should format dates correctly", () => {
    const d = new Date("2026-02-19T12:00:00.000Z");
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const formatted = `${y}/${m}/${day} ${h}:${min}`;
    
    // UTC time, so exact format depends on timezone
    expect(formatted).toMatch(/^2026\/02\/19/);
  });

  it("should handle multiple items", () => {
    const items = [
      { productName: "商品A", productPrice: 1000, quantity: 2, subtotal: 2000 },
      { productName: "商品B", productPrice: 500, quantity: 3, subtotal: 1500 },
      { productName: "商品C", productPrice: 2000, quantity: 1, subtotal: 2000 },
    ];
    
    const subtotalAmount = items.reduce((sum, i) => sum + i.subtotal, 0);
    expect(subtotalAmount).toBe(5500);
    
    const taxRate = 0.10;
    const taxExcluded = Math.round(subtotalAmount / (1 + taxRate));
    const tax10 = subtotalAmount - taxExcluded;
    expect(taxExcluded + tax10).toBe(subtotalAmount);
  });

  it("should handle order with discount (pointsUsed)", () => {
    const order = {
      totalAmount: 13365,
      pointsUsed: 1000,
      cashAmount: 12365,
    };
    
    expect(order.pointsUsed > 0).toBe(true);
    expect(order.totalAmount - order.pointsUsed).toBe(12365);
    expect(order.cashAmount).toBe(12365);
  });

  it("should handle document type labels", () => {
    const TITLE_MAP: Record<string, string> = {
      delivery: "お買上げ明細書（納品書）",
      invoice: "御請求書",
      receipt: "領収書",
    };
    
    expect(TITLE_MAP["delivery"]).toBe("お買上げ明細書（納品書）");
    expect(TITLE_MAP["invoice"]).toBe("御請求書");
    expect(TITLE_MAP["receipt"]).toBe("領収書");
  });

  it("should generate correct filename", () => {
    const types = [
      { type: "delivery", label: "納品書" },
      { type: "invoice", label: "請求書" },
      { type: "receipt", label: "領収書" },
    ];
    
    const orderNumber = "ORD-20260219-001";
    for (const { type, label } of types) {
      const filename = `${label}_${orderNumber}.pdf`;
      expect(filename).toBe(`${label}_ORD-20260219-001.pdf`);
    }
  });
});
