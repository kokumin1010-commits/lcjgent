import { describe, it, expect } from "vitest";

/**
 * BW API 結合テスト
 * 
 * 実際のBW本番API (https://beautypass.ai) に対してリクエストを送信し、
 * LCJ MALL側のbw-api.tsが正しくレスポンスをパースできることを確認する。
 * 
 * 前提条件:
 *   - BW_API_URL=https://beautypass.ai
 *   - BW_API_SECRET=6dafbd56dfc193cde3b7399265c3abdfa8321bdaa1c4a2300e8d12a87e31c222
 */

const BW_API_URL = "https://beautypass.ai";
const BW_API_SECRET = "6dafbd56dfc193cde3b7399265c3abdfa8321bdaa1c4a2300e8d12a87e31c222";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${BW_API_SECRET}`,
  };
}

describe("BW API Integration Tests (Live)", () => {
  describe("Customer Lookup", () => {
    it("should return found=false for non-existent email", async () => {
      const url = `${BW_API_URL}/api/lcj/customer/lookup?email=nonexistent_test_12345@example.com`;
      const res = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.found).toBe(false);
    });

    it("should return 401 without valid Bearer token", async () => {
      const url = `${BW_API_URL}/api/lcj/customer/lookup?email=test@example.com`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer invalid_token",
        },
      });

      expect(res.status).toBe(401);
    });

    it("should use correct API path /api/lcj/customer/lookup", async () => {
      const url = `${BW_API_URL}/api/lcj/customer/lookup?email=test@example.com`;
      const res = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });

      // パスが正しければ200が返る（404ではない）
      expect(res.ok).toBe(true);
    });

    it("response should have correct field names (snake_case)", async () => {
      const url = `${BW_API_URL}/api/lcj/customer/lookup?email=test@example.com`;
      const res = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });

      const data = await res.json();
      // BW側のレスポンスフィールド名を確認
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("found");
      // found=falseの場合、customer_id等はnullまたは未定義
    });
  });

  describe("Exchange Verify", () => {
    it("should accept POST with exchange_id and return result", async () => {
      const res = await fetch(`${BW_API_URL}/api/lcj/exchange/verify`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ exchange_id: "lcj_integration_test_999999" }),
      });

      // 存在しないexchange_idでもAPIは正常にレスポンスを返す
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty("success");
    });

    it("should use correct API path /api/lcj/exchange/verify", async () => {
      // 正しいパスが機能することを確認
      const correctRes = await fetch(`${BW_API_URL}/api/lcj/exchange/verify`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ exchange_id: "lcj_test" }),
      });
      expect(correctRes.ok).toBe(true);
      const data = await correctRes.json();
      expect(data).toHaveProperty("success");
    });
  });

  describe("Exchange Endpoint", () => {
    it("should use correct API path /api/lcj/exchange", async () => {
      // 不正なcustomer_idでもパスは正しく受け付けられる
      const res = await fetch(`${BW_API_URL}/api/lcj/exchange`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          customer_id: -1, // 存在しないID
          beauty_tokens: 40,
          exchange_id: "lcj_integration_test_path_check",
          lcj_points_used: 100,
        }),
      });

      // パスが正しければ200系またはビジネスエラー（404ではない）
      // customer_idが不正なので400系エラーの可能性もあるが、404ではないはず
      expect(res.status).not.toBe(404);
    });
  });

  describe("bw-api.ts module integration", () => {
    it("bwLookupCustomer should correctly parse BW API response", async () => {
      // bw-api.tsモジュールを直接テスト
      const { bwLookupCustomer } = await import("./bw-api");
      const result = await bwLookupCustomer("nonexistent_integration_test@example.com");

      expect(result.success).toBe(true);
      expect(result.found).toBe(false);
      // customer未定義（見つからない場合）
      expect(result.customer).toBeUndefined();
    });

    it("bwConfirmExchange should correctly parse BW API response", async () => {
      const { bwConfirmExchange } = await import("./bw-api");
      // 存在しないIDで確認
      const result = await bwConfirmExchange(999999);

      expect(result.success).toBe(true);
      // found=false（存在しない交換ID）
      // BW側の実装次第でfound=falseまたはエラーが返る
    });
  });
});
