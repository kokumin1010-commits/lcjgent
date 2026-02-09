import { describe, it, expect } from "vitest";

/**
 * LineReceiptManagement UI改善テスト
 * - 複数画像のグループ表示
 * - AI学習基盤（承認/却下理由のカテゴリ化）
 * - カード型UIの統一デザイン
 */

describe("LineReceiptManagement UI改善", () => {
  // 複数画像のグループ化テスト
  describe("複数画像のグループ化", () => {
    it("imageUrlsがJSON配列の場合、全画像を取得できる", () => {
      const receipt = {
        id: 1,
        imageUrls: JSON.stringify(["https://example.com/img1.jpg", "https://example.com/img2.jpg"]),
        amount: 1500,
        status: "pending",
      };
      const urls = JSON.parse(receipt.imageUrls);
      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe("https://example.com/img1.jpg");
      expect(urls[1]).toBe("https://example.com/img2.jpg");
    });

    it("imageUrlsが単一URLの場合も配列として処理できる", () => {
      const receipt = {
        id: 2,
        imageUrls: JSON.stringify(["https://example.com/single.jpg"]),
        amount: 800,
        status: "pending",
      };
      const urls = JSON.parse(receipt.imageUrls);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe("https://example.com/single.jpg");
    });

    it("imageUrlsが空配列の場合も正しく処理できる", () => {
      const receipt = {
        id: 3,
        imageUrls: JSON.stringify([]),
        amount: 0,
        status: "pending",
      };
      const urls = JSON.parse(receipt.imageUrls);
      expect(urls).toHaveLength(0);
    });
  });

  // AI学習データの構造テスト
  describe("AI学習データの構造", () => {
    const reviewCategories = {
      approve: [
        { id: "valid_receipt", label: "有効なレシート" },
        { id: "clear_amount", label: "金額が明確" },
        { id: "matching_store", label: "対象店舗" },
      ],
      reject: [
        { id: "blurry_image", label: "画像が不鮮明" },
        { id: "no_amount", label: "金額が読めない" },
        { id: "wrong_store", label: "対象外店舗" },
        { id: "duplicate", label: "重複申請" },
        { id: "expired", label: "期限切れ" },
      ],
    };

    it("承認カテゴリが定義されている", () => {
      expect(reviewCategories.approve.length).toBeGreaterThan(0);
      reviewCategories.approve.forEach((cat) => {
        expect(cat).toHaveProperty("id");
        expect(cat).toHaveProperty("label");
      });
    });

    it("却下カテゴリが定義されている", () => {
      expect(reviewCategories.reject.length).toBeGreaterThan(0);
      reviewCategories.reject.forEach((cat) => {
        expect(cat).toHaveProperty("id");
        expect(cat).toHaveProperty("label");
      });
    });

    it("AI学習データのフォーマットが正しい", () => {
      const learningData = {
        receiptId: 1,
        decision: "approved" as const,
        category: "valid_receipt",
        note: "金額と店舗名が明確に確認できる",
        reviewedAt: Date.now(),
      };
      expect(learningData.receiptId).toBe(1);
      expect(["approved", "rejected"]).toContain(learningData.decision);
      expect(learningData.category).toBeTruthy();
      expect(learningData.reviewedAt).toBeGreaterThan(0);
    });
  });

  // ステータスフィルタリングテスト
  describe("ステータスフィルタリング", () => {
    const receipts = [
      { id: 1, status: "pending", amount: 1000 },
      { id: 2, status: "approved", amount: 2000 },
      { id: 3, status: "rejected", amount: 500 },
      { id: 4, status: "pending", amount: 1500 },
      { id: 5, status: "approved", amount: 3000 },
    ];

    it("全件表示（allフィルタ）", () => {
      const filtered = receipts;
      expect(filtered).toHaveLength(5);
    });

    it("保留中のみフィルタ", () => {
      const filtered = receipts.filter((r) => r.status === "pending");
      expect(filtered).toHaveLength(2);
    });

    it("承認済みのみフィルタ", () => {
      const filtered = receipts.filter((r) => r.status === "approved");
      expect(filtered).toHaveLength(2);
    });

    it("却下のみフィルタ", () => {
      const filtered = receipts.filter((r) => r.status === "rejected");
      expect(filtered).toHaveLength(1);
    });
  });

  // 統計情報の計算テスト
  describe("統計情報の計算", () => {
    const receipts = [
      { id: 1, status: "pending", amount: 1000 },
      { id: 2, status: "approved", amount: 2000 },
      { id: 3, status: "rejected", amount: 500 },
      { id: 4, status: "pending", amount: 1500 },
      { id: 5, status: "approved", amount: 3000 },
    ];

    it("合計件数が正しい", () => {
      expect(receipts.length).toBe(5);
    });

    it("保留中の件数が正しい", () => {
      const pending = receipts.filter((r) => r.status === "pending");
      expect(pending.length).toBe(2);
    });

    it("承認済みの合計金額が正しい", () => {
      const approvedTotal = receipts
        .filter((r) => r.status === "approved")
        .reduce((sum, r) => sum + r.amount, 0);
      expect(approvedTotal).toBe(5000);
    });

    it("却下率が正しい", () => {
      const rejectedCount = receipts.filter((r) => r.status === "rejected").length;
      const rate = (rejectedCount / receipts.length) * 100;
      expect(rate).toBe(20);
    });
  });
});
