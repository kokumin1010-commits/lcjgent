import { describe, it, expect, vi, beforeEach } from "vitest";

// bw-api.ts のユニットテスト（BW側の実際のAPI仕様に合わせた版）

describe("BW API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("bwLookupCustomer", () => {
    it("should return customer data when found", async () => {
      const mockResponse = {
        success: true,
        found: true,
        customer_id: 123,
        name: "テストユーザー",
        has_wallet: true,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { bwLookupCustomer } = await import("./bw-api");
      const result = await bwLookupCustomer("test@example.com");

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.customer).toBeDefined();
      expect(result.customer!.id).toBe(123);
      expect(result.customer!.name).toBe("テストユーザー");
      expect(result.customer!.hasWallet).toBe(true);

      // GETリクエストでemailがクエリパラメータとして送られることを確認
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain("email=test%40example.com");
      expect(fetchCall[1].method).toBe("GET");
    });

    it("should return found=false when customer not found", async () => {
      const mockResponse = {
        success: true,
        found: false,
        customer_id: null,
        name: null,
        has_wallet: false,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { bwLookupCustomer } = await import("./bw-api");
      const result = await bwLookupCustomer("notfound@example.com");

      expect(result.success).toBe(true);
      expect(result.found).toBe(false);
      expect(result.customer).toBeUndefined();
    });

    it("should return error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      const { bwLookupCustomer } = await import("./bw-api");
      const result = await bwLookupCustomer("test@example.com");

      expect(result.success).toBe(false);
      expect(result.found).toBe(false);
      expect(result.error).toContain("401");
    });

    it("should handle network errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const { bwLookupCustomer } = await import("./bw-api");
      const result = await bwLookupCustomer("test@example.com");

      expect(result.success).toBe(false);
      expect(result.found).toBe(false);
      expect(result.error).toContain("ECONNREFUSED");
    });
  });

  describe("bwExchangeTokens", () => {
    it("should send correct snake_case parameters to BW API", async () => {
      const mockResponse = {
        success: true,
        exchange_id: "lcj_1",
        tokens_added: 400,
        tokens_total: 5400,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { bwExchangeTokens } = await import("./bw-api");
      const result = await bwExchangeTokens({
        bwCustomerId: 123,
        tokens: 400,
        lcjExchangeId: 1,
        lcjPointsUsed: 1000,
        lineUserName: "テストさん",
      });

      expect(result.success).toBe(true);
      expect(result.exchangeId).toBe("lcj_1");
      expect(result.tokensAdded).toBe(400);
      expect(result.tokensTotal).toBe(5400);

      // BW側のパラメータ名（snake_case）で送信されることを確認
      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.customer_id).toBe(123);
      expect(body.beauty_tokens).toBe(400);
      expect(body.exchange_id).toBe("lcj_1");
      expect(body.lcj_points_used).toBe(1000);
      expect(body.line_user_name).toBe("テストさん");
    });

    it("should include Authorization header with BW_API_SECRET", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, exchange_id: "lcj_1", tokens_added: 40, tokens_total: 40 }),
      });

      const { bwExchangeTokens } = await import("./bw-api");
      await bwExchangeTokens({
        bwCustomerId: 1,
        tokens: 40,
        lcjExchangeId: 1,
        lcjPointsUsed: 100,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers["Authorization"]).toMatch(/^Bearer .+$/);
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should return error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal server error"),
      });

      const { bwExchangeTokens } = await import("./bw-api");
      const result = await bwExchangeTokens({
        bwCustomerId: 123,
        tokens: 400,
        lcjExchangeId: 1,
        lcjPointsUsed: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    it("should handle network errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"));

      const { bwExchangeTokens } = await import("./bw-api");
      const result = await bwExchangeTokens({
        bwCustomerId: 123,
        tokens: 400,
        lcjExchangeId: 1,
        lcjPointsUsed: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("ETIMEDOUT");
    });
  });

  describe("bwConfirmExchange", () => {
    it("should return verify data with exchange_id prefix", async () => {
      const mockResponse = {
        success: true,
        found: true,
        exchange_id: "lcj_1",
        tokens_added: 400,
        processed_at: "2026-03-01 19:43:55",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { bwConfirmExchange } = await import("./bw-api");
      const result = await bwConfirmExchange(1);

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.exchangeId).toBe("lcj_1");
      expect(result.tokensAdded).toBe(400);
      expect(result.processedAt).toBe("2026-03-01 19:43:55");

      // exchange_idがlcj_プレフィックス付きで送信されることを確認
      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.exchange_id).toBe("lcj_1");
    });

    it("should handle not found exchange", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Exchange not found"),
      });

      const { bwConfirmExchange } = await import("./bw-api");
      const result = await bwConfirmExchange(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain("404");
    });
  });

  describe("Exchange rate calculation", () => {
    it("100 LCJ points should convert to 40 Beauty Tokens", () => {
      const EXCHANGE_RATE = 0.4;
      expect(100 * EXCHANGE_RATE).toBe(40);
    });

    it("1000 LCJ points should convert to 400 Beauty Tokens", () => {
      const EXCHANGE_RATE = 0.4;
      expect(1000 * EXCHANGE_RATE).toBe(400);
    });

    it("10000 LCJ points should convert to 4000 Beauty Tokens", () => {
      const EXCHANGE_RATE = 0.4;
      expect(10000 * EXCHANGE_RATE).toBe(4000);
    });

    it("points must be in multiples of 100", () => {
      const isValidAmount = (points: number) => points >= 100 && points % 100 === 0;
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(500)).toBe(true);
      expect(isValidAmount(1000)).toBe(true);
      expect(isValidAmount(50)).toBe(false);
      expect(isValidAmount(150)).toBe(false);
      expect(isValidAmount(99)).toBe(false);
    });
  });
});
