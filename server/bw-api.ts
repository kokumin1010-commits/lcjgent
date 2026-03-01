/**
 * Beauty Wallet API クライアント
 * 
 * BW側の /api/lcj/* エンドポイントを呼び出す
 * 認証: Bearer token (BW_API_SECRET = BW側のLCJ_API_SECRET)
 * 
 * BW側エンドポイント:
 *   GET  /api/lcj/customer/lookup?email=xxx  → { success, found, customer_id, name, has_wallet }
 *   POST /api/lcj/exchange                   → { success, exchange_id, tokens_added, tokens_total }
 *   POST /api/lcj/exchange/verify            → { success, found, exchange_id, tokens_added, processed_at }
 */
import { ENV } from "./_core/env";

// --- BW側の実際のレスポンス型 ---

interface BwLookupRawResponse {
  success: boolean;
  found: boolean;
  customer_id: number | null;
  name: string | null;
  has_wallet: boolean;
}

interface BwExchangeRawResponse {
  success: boolean;
  exchange_id: string;
  tokens_added: number;
  tokens_total: number;
  error?: string;
}

interface BwVerifyRawResponse {
  success: boolean;
  found: boolean;
  exchange_id: string;
  tokens_added: number;
  processed_at: string;
  error?: string;
}

// --- LCJ MALL側で使う正規化されたレスポンス型 ---

export interface BwCustomerLookupResponse {
  success: boolean;
  found: boolean;
  customer?: {
    id: number;
    name: string;
    hasWallet: boolean;
  };
  error?: string;
}

export interface BwExchangeResponse {
  success: boolean;
  exchangeId?: string;
  tokensAdded?: number;
  tokensTotal?: number;
  error?: string;
}

export interface BwConfirmResponse {
  success: boolean;
  found?: boolean;
  exchangeId?: string;
  tokensAdded?: number;
  processedAt?: string;
  error?: string;
}

function getHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${ENV.bwApiSecret}`,
  };
}

function getBaseUrl(): string {
  const url = ENV.bwApiUrl;
  if (!url) throw new Error("BW_API_URL is not configured");
  return url.replace(/\/+$/, "");
}

/**
 * BW側でメールアドレスから顧客を検索
 */
export async function bwLookupCustomer(email: string): Promise<BwCustomerLookupResponse> {
  try {
    const url = new URL(`${getBaseUrl()}/api/lcj/customer/lookup`);
    url.searchParams.set("email", email);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[BW API] lookup failed: ${res.status} ${text}`);
      return { success: false, found: false, error: `BW API error: ${res.status}` };
    }

    const raw: BwLookupRawResponse = await res.json();
    
    if (raw.success && raw.found && raw.customer_id !== null) {
      return {
        success: true,
        found: true,
        customer: {
          id: raw.customer_id,
          name: raw.name || "",
          hasWallet: raw.has_wallet,
        },
      };
    }

    return { success: true, found: false };
  } catch (err) {
    console.error("[BW API] lookup error:", err);
    return { success: false, found: false, error: `Connection error: ${(err as Error).message}` };
  }
}

/**
 * BW側にトークンを付与（LCJポイント交換）
 * 
 * BW側パラメータ:
 *   customer_id: BW側の顧客ID
 *   beauty_tokens: 付与するトークン数
 *   exchange_id: LCJ側の交換ID（冪等性チェック用）
 *   lcj_points_used: 使用したLCJポイント数
 */
export async function bwExchangeTokens(params: {
  bwCustomerId: number;
  tokens: number;
  lcjExchangeId: number;
  lcjPointsUsed: number;
  lineUserName?: string;
}): Promise<BwExchangeResponse> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/lcj/exchange`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        customer_id: params.bwCustomerId,
        beauty_tokens: params.tokens,
        exchange_id: `lcj_${params.lcjExchangeId}`,
        lcj_points_used: params.lcjPointsUsed,
        line_user_name: params.lineUserName,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[BW API] exchange failed: ${res.status} ${text}`);
      return { success: false, error: `BW API error: ${res.status}` };
    }

    const raw: BwExchangeRawResponse = await res.json();
    return {
      success: raw.success,
      exchangeId: raw.exchange_id,
      tokensAdded: raw.tokens_added,
      tokensTotal: raw.tokens_total,
      error: raw.error,
    };
  } catch (err) {
    console.error("[BW API] exchange error:", err);
    return { success: false, error: `Connection error: ${(err as Error).message}` };
  }
}

/**
 * BW側で交換トランザクションの状態を確認
 */
export async function bwConfirmExchange(lcjExchangeId: number): Promise<BwConfirmResponse> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/lcj/exchange/verify`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ exchange_id: `lcj_${lcjExchangeId}` }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[BW API] verify failed: ${res.status} ${text}`);
      return { success: false, error: `BW API error: ${res.status}` };
    }

    const raw: BwVerifyRawResponse = await res.json();
    return {
      success: raw.success,
      found: raw.found,
      exchangeId: raw.exchange_id,
      tokensAdded: raw.tokens_added,
      processedAt: raw.processed_at,
      error: raw.error,
    };
  } catch (err) {
    console.error("[BW API] verify error:", err);
    return { success: false, error: `Connection error: ${(err as Error).message}` };
  }
}
