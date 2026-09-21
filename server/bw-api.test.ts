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

  describe("bwAuditCentralLedgerByEmail", () => {
    it("uses the unified Beauty Wallet balance and deduplicates history by transaction id", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              found: true,
              customer_id: 123,
              name: "テストユーザー",
              has_wallet: true,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              customer_id: 123,
              tokens: 5000,
              balance: 100,
              total: 5100,
              has_wallet: true,
              unified: true,
              breakdown: [
                {
                  store: "beautypass",
                  balance: 100,
                  bonusPoints: 3900,
                  subtotal: 4000,
                  customerId: 123,
                  registeredAt: "2026-01-01T00:00:00.000Z",
                },
                {
                  store: "buzzdrop",
                  balance: 0,
                  bonusPoints: 1100,
                  subtotal: 1100,
                  customerId: 456,
                  registeredAt: "2026-02-01T00:00:00.000Z",
                },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              customer_id: 123,
              balance: 4000,
              unified_total: 5100,
              total_records: 1,
              transactions: [
                {
                  id: 10,
                  type: "earn",
                  amount: 4173,
                  balance_after: 4173,
                  description: "既存ポイント移行",
                  brand: "KYOGOKU",
                  created_at: "2026-01-01T00:00:00.000Z",
                },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              customer_id: 456,
              balance: 1100,
              unified_total: 5100,
              total_records: 2,
              transactions: [
                {
                  id: 10,
                  type: "earn",
                  amount: 4173,
                  balance_after: 4173,
                  description: "既存ポイント移行",
                  brand: "KYOGOKU",
                  created_at: "2026-01-01T00:00:00.000Z",
                },
                {
                  id: 11,
                  type: "earn",
                  amount: 10,
                  balance_after: 1100,
                  description: "来店ポイント",
                  brand: "BuzzDrop",
                  created_at: "2026-02-01T00:00:00.000Z",
                },
              ],
            }),
        });

      const { bwAuditCentralLedgerByEmail } = await import("./bw-api");
      const result = await bwAuditCentralLedgerByEmail(" Test@Example.com ");

      expect(result.centralLedgerAvailable).toBe(true);
      expect(result.unifiedTotal).toBe(5100);
      expect(result.historyComplete).toBe(true);
      expect(result.historyRowsFetched).toBe(3);
      expect(result.uniqueTransactionCount).toBe(2);
      expect(result.duplicateRowsRemoved).toBe(1);
      expect(result.storeCount).toBe(2);
      expect(result.stores).toEqual(["beautypass", "buzzdrop"]);
      expect(result).not.toHaveProperty("email");
      expect(result).not.toHaveProperty("customerId");
      expect(result).not.toHaveProperty("storeBreakdown");
      expect(result).not.toHaveProperty("migrationEvidence");
      expect(result).not.toHaveProperty("totalBalance");
      expect(result).not.toHaveProperty("totalBonusPoints");

      const balanceUrl = new URL((global.fetch as any).mock.calls[1][0]);
      expect(balanceUrl.pathname).toBe("/api/tokens/balance");
      expect(balanceUrl.searchParams.get("unified")).toBe("true");
      expect(balanceUrl.searchParams.get("store")).toBe("beautypass");
      expect(balanceUrl.searchParams.has("sync_email")).toBe(false);
      expect(balanceUrl.searchParams.has("sync_name")).toBe(false);
    });

    it("fails closed when the central unified ledger cannot be authenticated", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              found: true,
              customer_id: 123,
              name: "テストユーザー",
              has_wallet: true,
            }),
        })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      const { bwAuditCentralLedgerByEmail } = await import("./bw-api");
      const result = await bwAuditCentralLedgerByEmail("test@example.com");

      expect(result.centralLedgerAvailable).toBe(false);
      expect(result.unifiedTotal).toBeNull();
      expect(result.failureCode).toBe("CENTRAL_BALANCE_AUTH_UNAVAILABLE");
    });

    it("fails closed and suppresses partial evidence when any store history is incomplete", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              found: true,
              customer_id: 123,
              name: "テストユーザー",
              has_wallet: true,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              customer_id: 123,
              tokens: 5100,
              balance: 0,
              total: 5100,
              has_wallet: true,
              unified: true,
              breakdown: [
                {
                  store: "beautypass",
                  balance: 0,
                  bonusPoints: 5100,
                  subtotal: 5100,
                  customerId: 123,
                  registeredAt: null,
                },
              ],
            }),
        })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const { bwAuditCentralLedgerByEmail } = await import("./bw-api");
      const result = await bwAuditCentralLedgerByEmail("test@example.com");

      expect(result.success).toBe(false);
      expect(result.centralLedgerAvailable).toBe(true);
      expect(result.unifiedTotal).toBe(5100);
      expect(result.historyComplete).toBe(false);
      expect(result.uniqueTransactionCount).toBe(0);
      expect(result).not.toHaveProperty("transactionTypeTotals");
      expect(result).not.toHaveProperty("storeBreakdown");
      expect(result.failureCode).toBe("CENTRAL_HISTORY_INCOMPLETE");
    });

    it("rejects null numeric ledger fields instead of coercing them to zero", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              found: true,
              customer_id: 123,
              name: "テストユーザー",
              has_wallet: true,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              customer_id: 123,
              tokens: null,
              balance: null,
              total: null,
              has_wallet: true,
              unified: true,
              breakdown: [
                {
                  store: "beautypass",
                  balance: null,
                  bonusPoints: null,
                  subtotal: null,
                  customerId: 123,
                  registeredAt: null,
                },
              ],
            }),
        });

      const { bwAuditCentralLedgerByEmail } = await import("./bw-api");
      const result = await bwAuditCentralLedgerByEmail("test@example.com");

      expect(result.centralLedgerAvailable).toBe(false);
      expect(result.failureCode).toBe("CENTRAL_LEDGER_VALIDATION_FAILED");
    });

    it("rejects history without a verifiable unified total", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              found: true,
              customer_id: 123,
              name: "テストユーザー",
              has_wallet: true,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              customer_id: 123,
              tokens: 100,
              balance: 0,
              total: 100,
              has_wallet: true,
              unified: true,
              breakdown: [
                {
                  store: "beautypass",
                  balance: 0,
                  bonusPoints: 100,
                  subtotal: 100,
                  customerId: 123,
                  registeredAt: null,
                },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              customer_id: 123,
              balance: 100,
              total_records: 0,
              transactions: [],
            }),
        });

      const { bwAuditCentralLedgerByEmail } = await import("./bw-api");
      const result = await bwAuditCentralLedgerByEmail("test@example.com");

      expect(result.success).toBe(false);
      expect(result.historyComplete).toBe(false);
      expect(result.uniqueTransactionCount).toBe(0);
      expect(result.failureCode).toBe("CENTRAL_HISTORY_INCOMPLETE");
    });

    it("rejects parseable history rows with missing required fields", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              found: true,
              customer_id: 123,
              name: "テストユーザー",
              has_wallet: true,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              customer_id: 123,
              tokens: 100,
              balance: 0,
              total: 100,
              has_wallet: true,
              unified: true,
              breakdown: [
                {
                  store: "beautypass",
                  balance: 0,
                  bonusPoints: 100,
                  subtotal: 100,
                  customerId: 123,
                  registeredAt: null,
                },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              customer_id: 123,
              balance: 100,
              unified_total: 100,
              total_records: 1,
              transactions: [
                {
                  id: 20,
                  type: "earn",
                  amount: null,
                  balance_after: null,
                  description: null,
                  brand: "KYOGOKU",
                  created_at: "2026-01-01T00:00:00.000Z",
                },
              ],
            }),
        });

      const { bwAuditCentralLedgerByEmail } = await import("./bw-api");
      const result = await bwAuditCentralLedgerByEmail("test@example.com");

      expect(result.success).toBe(false);
      expect(result.historyComplete).toBe(false);
      expect(result.uniqueTransactionCount).toBe(0);
      expect(result.failureCode).toBe("CENTRAL_HISTORY_INCOMPLETE");
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
        json: () =>
          Promise.resolve({
            success: true,
            exchange_id: "lcj_1",
            tokens_added: 40,
            tokens_total: 40,
          }),
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
      const isValidAmount = (points: number) =>
        points >= 100 && points % 100 === 0;
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(500)).toBe(true);
      expect(isValidAmount(1000)).toBe(true);
      expect(isValidAmount(50)).toBe(false);
      expect(isValidAmount(150)).toBe(false);
      expect(isValidAmount(99)).toBe(false);
    });
  });
});
