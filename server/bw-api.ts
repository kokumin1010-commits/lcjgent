/**
 * Beauty Wallet API クライアント
 * 
 * BW側の /api/lcj-exchange/* エンドポイントを呼び出す
 * 認証: Bearer token (BW_API_SECRET = BW側のLCJ_API_SECRET)
 */
import { ENV } from "./_core/env";

interface BwCustomerLookupResponse {
  success: boolean;
  customer?: {
    id: number;
    email: string;
    displayName: string;
    walletBalance: number;
  };
  error?: string;
}

interface BwExchangeResponse {
  success: boolean;
  transactionId?: string;
  tokensAdded?: number;
  newBalance?: number;
  error?: string;
}

interface BwConfirmResponse {
  success: boolean;
  status?: string;
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
  // 末尾のスラッシュを除去
  return url.replace(/\/+$/, "");
}

/**
 * BW側でメールアドレスから顧客を検索
 */
export async function bwLookupCustomer(email: string): Promise<BwCustomerLookupResponse> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/lcj-exchange/lookup`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[BW API] lookup failed: ${res.status} ${text}`);
      return { success: false, error: `BW API error: ${res.status}` };
    }

    return await res.json();
  } catch (err) {
    console.error("[BW API] lookup error:", err);
    return { success: false, error: `Connection error: ${(err as Error).message}` };
  }
}

/**
 * BW側にトークンを付与（LCJポイント交換）
 */
export async function bwExchangeTokens(params: {
  bwCustomerId: number;
  tokens: number;
  lcjExchangeId: number;
  lcjPointsUsed: number;
  lineUserName?: string;
}): Promise<BwExchangeResponse> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/lcj-exchange/exchange`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        customerId: params.bwCustomerId,
        tokens: params.tokens,
        lcjExchangeId: params.lcjExchangeId,
        lcjPointsUsed: params.lcjPointsUsed,
        lineUserName: params.lineUserName,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[BW API] exchange failed: ${res.status} ${text}`);
      return { success: false, error: `BW API error: ${res.status}` };
    }

    return await res.json();
  } catch (err) {
    console.error("[BW API] exchange error:", err);
    return { success: false, error: `Connection error: ${(err as Error).message}` };
  }
}

/**
 * BW側で交換トランザクションの状態を確認
 */
export async function bwConfirmExchange(transactionId: string): Promise<BwConfirmResponse> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/lcj-exchange/confirm`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ transactionId }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[BW API] confirm failed: ${res.status} ${text}`);
      return { success: false, error: `BW API error: ${res.status}` };
    }

    return await res.json();
  } catch (err) {
    console.error("[BW API] confirm error:", err);
    return { success: false, error: `Connection error: ${(err as Error).message}` };
  }
}
