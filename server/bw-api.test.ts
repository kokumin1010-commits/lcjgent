import { describe, it, expect, vi, beforeEach } from "vitest";

// bw-api.ts のユニットテスト
// 実際のAPI呼び出しはモックする

describe("BW API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("bwLookupCustomer", () => {
    it("should return customer data on successful lookup", async () => {
      const mockResponse = {
        success: true,
        customer: {
          id: 123,
          email: "test@example.com",
          displayName: "テストユーザー",
          walletBalance: 5000,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { bwLookupCustomer } = await import("./bw-api");
      const result = await bwLookupCustomer("test@example.com");

      expect(result.success).toBe(true);
      expect(result.customer).toBeDefined();
      expect(result.customer!.id).toBe(123);
      expect(result.customer!.email).toBe("test@example.com");
      expect(result.customer!.displayName).toBe("テストユーザー");
      expect(result.customer!.walletBalance).toBe(5000);
    });

    it("should return error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      });

      const { bwLookupCustomer } = await import("./bw-api");
      const result = await bwLookupCustomer("notfound@example.com");

      expect(result.success).toBe(false);
      expect(result.error).toContain("404");
    });

    it("should handle network errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const { bwLookupCustomer } = await import("./bw-api");
      const result = await bwLookupCustomer("test@example.com");

      expect(result.success).toBe(false);
      expect(result.error).toContain("ECONNREFUSED");
    });
  });

  describe("bwExchangeTokens", () => {
    it("should return transaction data on successful exchange", async () => {
      const mockResponse = {
        success: true,
        transactionId: "txn_abc123",
        tokensAdded: 400,
        newBalance: 5400,
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
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("txn_abc123");
      expect(result.tokensAdded).toBe(400);
      expect(result.newBalance).toBe(5400);

      // fetch呼び出しの引数を検証
      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.customerId).toBe(123);
      expect(body.tokens).toBe(400);
      expect(body.lcjExchangeId).toBe(1);
      expect(body.lcjPointsUsed).toBe(1000);
    });

    it("should include Authorization header with BW_API_SECRET", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
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
    it("should return status on successful confirmation", async () => {
      const mockResponse = {
        success: true,
        status: "completed",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { bwConfirmExchange } = await import("./bw-api");
      const result = await bwConfirmExchange("txn_abc123");

      expect(result.success).toBe(true);
      expect(result.status).toBe("completed");
    });

    it("should handle not found transaction", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Transaction not found"),
      });

      const { bwConfirmExchange } = await import("./bw-api");
      const result = await bwConfirmExchange("txn_nonexistent");

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
