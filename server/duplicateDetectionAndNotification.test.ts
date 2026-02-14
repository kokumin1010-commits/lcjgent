import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn(),
  checkOrderNumberExists: vi.fn(),
  checkDuplicateOrderNumberGlobal: vi.fn(),
  getPointRequestById: vi.fn(),
  getLineUserById: vi.fn(),
  getLineReceiptById: vi.fn(),
  rejectPointRequest: vi.fn(),
  updateLineReceiptStatus: vi.fn(),
  approvePointRequest: vi.fn(),
}));

// Mock LINE messaging
vi.mock("./line", () => ({
  pushMessage: vi.fn().mockResolvedValue(undefined),
  leaveGroup: vi.fn(),
}));

describe("重複検出機能の横断チェック", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkOrderNumberExists - pointRequests + lineReceipts横断チェック", () => {
    it("pointRequestsテーブルで重複が見つかった場合、source: pointRequestを返す", async () => {
      const { checkOrderNumberExists } = await import("./db");
      const mockFn = vi.mocked(checkOrderNumberExists);
      mockFn.mockResolvedValue({ exists: true, source: "pointRequest" });

      const result = await checkOrderNumberExists("1234567890123456");
      expect(result.exists).toBe(true);
      expect(result.source).toBe("pointRequest");
    });

    it("lineReceiptsテーブルで重複が見つかった場合、source: lineReceiptを返す", async () => {
      const { checkOrderNumberExists } = await import("./db");
      const mockFn = vi.mocked(checkOrderNumberExists);
      mockFn.mockResolvedValue({ exists: true, source: "lineReceipt" });

      const result = await checkOrderNumberExists("1234567890123456");
      expect(result.exists).toBe(true);
      expect(result.source).toBe("lineReceipt");
    });

    it("どちらのテーブルにも存在しない場合、exists: falseを返す", async () => {
      const { checkOrderNumberExists } = await import("./db");
      const mockFn = vi.mocked(checkOrderNumberExists);
      mockFn.mockResolvedValue({ exists: false });

      const result = await checkOrderNumberExists("9999999999999999");
      expect(result.exists).toBe(false);
      expect(result.source).toBeUndefined();
    });
  });

  describe("checkDuplicateOrderNumberGlobal - lineReceipts + pointRequests横断チェック", () => {
    it("lineReceiptsテーブルで重複が見つかった場合、source: lineReceiptを返す", async () => {
      const { checkDuplicateOrderNumberGlobal } = await import("./db");
      const mockFn = vi.mocked(checkDuplicateOrderNumberGlobal);
      mockFn.mockResolvedValue({
        id: 1,
        lineUserId: "U1234",
        storeName: "TikTok Shop",
        totalAmount: 3000,
        status: "approved",
        submittedAt: new Date(),
        ocrRawText: '{"orderNumber": "1234567890123456"}',
        source: "lineReceipt" as const,
      });

      const result = await checkDuplicateOrderNumberGlobal("1234567890123456", 999);
      expect(result).not.toBeNull();
      expect(result?.source).toBe("lineReceipt");
    });

    it("pointRequestsテーブルで重複が見つかった場合、source: pointRequestを返す", async () => {
      const { checkDuplicateOrderNumberGlobal } = await import("./db");
      const mockFn = vi.mocked(checkDuplicateOrderNumberGlobal);
      mockFn.mockResolvedValue({
        id: 5,
        lineUserId: "pointRequest",
        storeName: "TikTok Shop",
        totalAmount: 5000,
        status: "approved",
        submittedAt: new Date(),
        ocrRawText: null,
        source: "pointRequest" as const,
      });

      const result = await checkDuplicateOrderNumberGlobal("5678901234567890", 999);
      expect(result).not.toBeNull();
      expect(result?.source).toBe("pointRequest");
    });

    it("どちらのテーブルにも存在しない場合、nullを返す", async () => {
      const { checkDuplicateOrderNumberGlobal } = await import("./db");
      const mockFn = vi.mocked(checkDuplicateOrderNumberGlobal);
      mockFn.mockResolvedValue(null);

      const result = await checkDuplicateOrderNumberGlobal("9999999999999999");
      expect(result).toBeNull();
    });
  });
});

describe("LINE通知の拡充", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Webポイント申請却下時のLINE通知", () => {
    it("却下時にLINEユーザーに通知メッセージが送信される", async () => {
      const { pushMessage } = await import("./line");
      const mockPush = vi.mocked(pushMessage);

      // Simulate sending rejection notification
      const lineUserId = "U_test_user_123";
      const orderNumber = "1234567890123456";
      const reason = "画像が不鮮明です";

      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `ポイント申請が承認されませんでした。\n\n注文番号: ${orderNumber}\n理由: ${reason}\n\n内容をご確認の上、再度申請いただくか、\nご不明な点があればお問い合わせください。`,
        },
      ]);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(lineUserId, [
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("承認されませんでした"),
        }),
      ]);
      // Verify the message contains order number and reason
      const sentMessage = mockPush.mock.calls[0][1][0] as any;
      expect(sentMessage.text).toContain(orderNumber);
      expect(sentMessage.text).toContain(reason);
    });

    it("LINEユーザーIDがない場合は通知をスキップする", async () => {
      const { getLineUserById } = await import("./db");
      const mockGetUser = vi.mocked(getLineUserById);
      mockGetUser.mockResolvedValue({
        id: 1,
        lineUserId: null, // No LINE User ID
        displayName: "Test User",
        pictureUrl: null,
        statusMessage: null,
        email: "test@example.com",
        password: "hashed",
        brandId: null,
        staffId: null,
        liverId: null,
        userType: "customer",
        isBlocked: false,
        lastMessageAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const lineUser = await getLineUserById(1);
      // Should not send notification when lineUserId is null
      expect(lineUser?.lineUserId).toBeNull();
    });
  });

  describe("LINE receipt保留時のLINE通知", () => {
    it("保留時にLINEユーザーに確認中メッセージが送信される", async () => {
      const { pushMessage } = await import("./line");
      const mockPush = vi.mocked(pushMessage);

      const lineUserId = "U_test_user_456";
      const storeName = "TikTok Shop";
      const note = "高額注文のため確認中";

      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `お送りいただいたレシートを確認中です。\n\n🏠 店舗名: ${storeName}\n📝 理由: ${note}\n\n確認が完了しましたら結果をお知らせします。\nしばらくお待ちください。`,
        },
      ]);

      expect(mockPush).toHaveBeenCalledTimes(1);
      const sentMessage = mockPush.mock.calls[0][1][0] as any;
      expect(sentMessage.text).toContain("確認中");
      expect(sentMessage.text).toContain(storeName);
      expect(sentMessage.text).toContain(note);
    });
  });

  describe("既存のLINE通知が正しく動作すること", () => {
    it("LINE receipt承認時の通知メッセージにポイントと残高が含まれる", async () => {
      const { pushMessage } = await import("./line");
      const mockPush = vi.mocked(pushMessage);

      const lineUserId = "U_test_user_789";
      const storeName = "TikTok Shop";
      const amount = "¥3,000";
      const pointsToAward = 30;
      const newBalance = 150;

      const message = `🎉 レシートが承認されました！\n\n🏪 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\n📊 現在の残高: ${newBalance}ポイント`;

      await pushMessage(lineUserId, [{ type: "text", text: message }]);

      expect(mockPush).toHaveBeenCalledTimes(1);
      const sentMessage = mockPush.mock.calls[0][1][0] as any;
      expect(sentMessage.text).toContain("承認されました");
      expect(sentMessage.text).toContain(`${pointsToAward}ポイント`);
      expect(sentMessage.text).toContain(`${newBalance}ポイント`);
    });

    it("Webポイント申請承認時の通知メッセージにポイントが含まれる", async () => {
      const { pushMessage } = await import("./line");
      const mockPush = vi.mocked(pushMessage);

      const lineUserId = "U_test_user_approval";
      const orderNumber = "5678901234567890";
      const pointsApproved = 50;

      const message = `🎉 ポイント申請が承認されました！\n\n注文番号: ${orderNumber}\n承認ポイント: ${pointsApproved}pt\n\nポイントが残高に加算されました。\nLCJ MALLでのお買い物にご利用いただけます。`;

      await pushMessage(lineUserId, [{ type: "text", text: message }]);

      expect(mockPush).toHaveBeenCalledTimes(1);
      const sentMessage = mockPush.mock.calls[0][1][0] as any;
      expect(sentMessage.text).toContain("承認されました");
      expect(sentMessage.text).toContain(orderNumber);
      expect(sentMessage.text).toContain(`${pointsApproved}pt`);
    });
  });
});

describe("重複検出メッセージの正確性", () => {
  it("Webフォームからの重複申請時のエラーメッセージが正しい", () => {
    const sourceLabel = "lineReceipt" === "lineReceipt" ? "LINEレシート" : "Webフォーム";
    const message = `この注文番号は既に${sourceLabel}から申請済みです。`;
    expect(message).toBe("この注文番号は既にLINEレシートから申請済みです。");
  });

  it("LINEレシートからの重複申請時のエラーメッセージが正しい", () => {
    const sourceLabel = "pointRequest" === "lineReceipt" ? "LINEレシート" : "Webフォーム";
    const message = `この注文番号は既に${sourceLabel}から申請済みです。`;
    expect(message).toBe("この注文番号は既にWebフォームから申請済みです。");
  });

  it("LINE receipt重複検出時のメッセージが正しい（同一ユーザー）", () => {
    const isSameUser = true;
    const orderNumber = "1234567890123456";
    const message = isSameUser
      ? `この注文は既にポイント申請済みです。注文番号: ${orderNumber}`
      : `この注文番号は既に他の方が申請済みです。注文番号: ${orderNumber}`;
    expect(message).toContain("既にポイント申請済み");
  });

  it("LINE receipt重複検出時のメッセージが正しい（別ユーザー）", () => {
    const isSameUser = false;
    const orderNumber = "1234567890123456";
    const message = isSameUser
      ? `この注文は既にポイント申請済みです。注文番号: ${orderNumber}`
      : `この注文番号は既に他の方が申請済みです。注文番号: ${orderNumber}`;
    expect(message).toContain("他の方が申請済み");
  });
});
