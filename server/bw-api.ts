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
import { getDb } from "./db";
import { sql } from "drizzle-orm";

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

const BW_SECRET_KEY = "bw_api_secret";
let integrationSecretTableEnsured = false;

async function ensureIntegrationSecretTable(): Promise<void> {
  if (integrationSecretTableEnsured) return;
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lcj_integration_secrets (
      secret_key VARCHAR(64) PRIMARY KEY,
      secret_value TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  integrationSecretTableEnsured = true;
}

export async function getStoredBwApiSecret(): Promise<string> {
  try {
    await ensureIntegrationSecretTable();
    const db = await getDb();
    if (db) {
      const [rows] = await db.execute(sql`
        SELECT secret_value FROM lcj_integration_secrets
        WHERE secret_key = ${BW_SECRET_KEY}
        LIMIT 1
      `);
      const row = (rows as unknown as Array<{ secret_value?: string }>)[0];
      if (row?.secret_value) return row.secret_value;
    }
  } catch (error) {
    console.error("[BW API] Failed to read stored integration secret:", error);
  }
  return ENV.bwApiSecret || "";
}

export async function setStoredBwApiSecret(secret: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error("BW API secret must be a 64-character hexadecimal value");
  }
  await ensureIntegrationSecretTable();
  const db = await getDb();
  if (!db) throw new Error("LCJ database is not available");
  await db.execute(sql`
    INSERT INTO lcj_integration_secrets (secret_key, secret_value)
    VALUES (${BW_SECRET_KEY}, ${secret})
    ON DUPLICATE KEY UPDATE secret_value = VALUES(secret_value), updated_at = CURRENT_TIMESTAMP
  `);
}

async function getHeaders(): Promise<Record<string, string>> {
  const secret = await getStoredBwApiSecret();
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${secret}`,
  };
}

function getBaseUrl(): string {
  const url = ENV.bwApiUrl;
  if (!url) throw new Error("BW_API_URL is not configured");
  const parsed = new URL(url);
  // beautypass.ai は www へ301転送される。別ホストへの転送時に
  // Authorizationが削除されるため、正規ホストへ直接接続する。
  if (parsed.hostname === "beautypass.ai") {
    parsed.hostname = "www.beautypass.ai";
  }
  return parsed.toString().replace(/\/+$/, "");
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
      headers: await getHeaders(),
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
      headers: await getHeaders(),
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
      headers: await getHeaders(),
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
