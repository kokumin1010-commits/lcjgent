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
import { createHash } from "node:crypto";
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

interface BwUnifiedBalanceRawResponse {
  success: boolean;
  customer_id: number;
  tokens: number;
  balance: number;
  total: number;
  has_wallet: boolean;
  unified: boolean;
  breakdown?: Array<{
    store: string;
    balance: number;
    bonusPoints: number;
    subtotal: number;
    customerId: number;
    registeredAt: string | null;
  }>;
}

interface BwHistoryRawResponse {
  success: boolean;
  customer_id: number;
  balance: number;
  unified_total?: number;
  total_records: number;
  transactions: Array<{
    id: number;
    type: string;
    amount: number;
    balance_after: number;
    description: string | null;
    brand: string | null;
    created_at: string;
  }>;
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

export interface BwCentralLedgerAuditResponse {
  success: boolean;
  emailHash: string;
  lookupFound: boolean;
  walletFound: boolean;
  centralLedgerAvailable: boolean;
  unifiedTotal: number | null;
  storeCount: number;
  stores: string[];
  historyComplete: boolean;
  historyRowsFetched: number;
  uniqueTransactionCount: number;
  duplicateRowsRemoved: number;
  failureCode?: string;
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

async function getHeaders(): Promise<Record<string, string>> {
  const secret = await getStoredBwApiSecret();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
}

async function getReadOnlyHeaders(): Promise<Record<string, string>> {
  let secret = "";
  try {
    const db = await getDb();
    if (db) {
      const [rows] = await db.execute(sql`
        SELECT secret_value FROM lcj_integration_secrets
        WHERE secret_key = ${BW_SECRET_KEY}
        LIMIT 1
      `);
      const row = (rows as unknown as Array<{ secret_value?: string }>)[0];
      secret = row?.secret_value || "";
    }
  } catch {
    console.error("[BW API] Read-only integration secret lookup failed");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret || ENV.bwApiSecret || ""}`,
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
export async function bwLookupCustomer(
  email: string
): Promise<BwCustomerLookupResponse> {
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
      return {
        success: false,
        found: false,
        error: `BW API error: ${res.status}`,
      };
    }

    const raw: BwLookupRawResponse = await res.json();

    if (
      raw.success &&
      raw.found &&
      Number.isInteger(raw.customer_id) &&
      (raw.customer_id as number) > 0
    ) {
      return {
        success: true,
        found: true,
        customer: {
          id: raw.customer_id as number,
          name: raw.name || "",
          hasWallet: raw.has_wallet,
        },
      };
    }

    return { success: true, found: false };
  } catch (err) {
    console.error("[BW API] lookup error:", err);
    return {
      success: false,
      found: false,
      error: `Connection error: ${(err as Error).message}`,
    };
  }
}

async function bwLookupCustomerReadOnly(
  email: string,
  headers: Record<string, string>
): Promise<BwCustomerLookupResponse> {
  try {
    const url = new URL(`${getBaseUrl()}/api/lcj/customer/lookup`);
    url.searchParams.set("email", email);
    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return {
        success: false,
        found: false,
        error: `BW API error: ${response.status}`,
      };
    }
    const raw = (await response.json()) as BwLookupRawResponse;
    if (
      raw.success &&
      raw.found &&
      Number.isInteger(raw.customer_id) &&
      (raw.customer_id as number) > 0
    ) {
      return {
        success: true,
        found: true,
        customer: {
          id: raw.customer_id as number,
          name: raw.name || "",
          hasWallet: raw.has_wallet === true,
        },
      };
    }
    return { success: true, found: false };
  } catch {
    return {
      success: false,
      found: false,
      error: "BW API read-only lookup unavailable",
    };
  }
}

/**
 * Resolve a Beauty Wallet customer only after the caller has independently
 * verified control of the email address. This is GET-only and never creates a
 * wallet, synchronizes identity fields, or changes a balance.
 */
export async function bwResolveCustomerForVerifiedLink(email: string): Promise<{
  found: boolean;
  customer: { id: number; name: string; hasWallet: boolean } | null;
  failureCode?: string;
}> {
  const normalizedEmail = email.trim().toLowerCase();
  const headers = await getReadOnlyHeaders();
  const lookup = await bwLookupCustomerReadOnly(normalizedEmail, headers);
  if (!lookup.success) {
    return { found: false, customer: null, failureCode: "LOOKUP_UNAVAILABLE" };
  }
  if (!lookup.found || !lookup.customer) {
    return { found: false, customer: null, failureCode: "CUSTOMER_NOT_FOUND" };
  }
  return {
    found: true,
    customer: {
      id: lookup.customer.id,
      name: lookup.customer.name,
      hasWallet: lookup.customer.hasWallet,
    },
  };
}

const BW_AUDIT_HISTORY_PAGE_SIZE = 200;
const BW_AUDIT_HISTORY_MAX_PAGES = 25;

function emptyCentralLedgerAudit(
  emailHash: string,
  overrides: Partial<BwCentralLedgerAuditResponse> = {}
): BwCentralLedgerAuditResponse {
  return {
    success: false,
    emailHash,
    lookupFound: false,
    walletFound: false,
    centralLedgerAvailable: false,
    unifiedTotal: null,
    storeCount: 0,
    stores: [],
    historyComplete: false,
    historyRowsFetched: 0,
    uniqueTransactionCount: 0,
    duplicateRowsRemoved: 0,
    ...overrides,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Beauty Walletのメール統合台帳を、既存のサーバー間資格情報で読み取る。
 *
 * この監査はwallet作成、メール同期、残高同期、ポイント付与・減算を一切行わない。
 * `/api/tokens/balance` にsync_name/sync_emailを渡さず、履歴はtransaction idで
 * 重複除外した匿名集計だけを返す。
 */
export async function bwAuditCentralLedgerByEmail(
  email: string
): Promise<BwCentralLedgerAuditResponse> {
  const normalizedEmail = email.trim().toLowerCase();
  const emailHash = createHash("sha256").update(normalizedEmail).digest("hex");
  const readOnlyHeaders = await getReadOnlyHeaders();
  const lookup = await bwLookupCustomerReadOnly(
    normalizedEmail,
    readOnlyHeaders
  );

  if (!lookup.success) {
    return emptyCentralLedgerAudit(emailHash, {
      failureCode: "LOOKUP_UNAVAILABLE",
    });
  }
  if (!lookup.found || !lookup.customer) {
    return emptyCentralLedgerAudit(emailHash, {
      success: true,
      failureCode: "CUSTOMER_NOT_FOUND",
    });
  }

  if (!lookup.customer.hasWallet) {
    return emptyCentralLedgerAudit(emailHash, {
      success: true,
      lookupFound: true,
      failureCode: "PRIMARY_WALLET_NOT_FOUND",
    });
  }

  const recoverUnifiedTotalFromHistory = async (
    failureCode: string
  ): Promise<BwCentralLedgerAuditResponse> => {
    const historyUrl = new URL(`${getBaseUrl()}/api/bp/history`);
    historyUrl.searchParams.set("customer_id", String(lookup.customer!.id));
    historyUrl.searchParams.set("store", "beautypass");
    historyUrl.searchParams.set("unified", "true");
    historyUrl.searchParams.set("limit", "1");
    historyUrl.searchParams.set("offset", "0");
    try {
      const response = await fetch(historyUrl.toString(), {
        method: "GET",
        headers: readOnlyHeaders,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("history_unavailable");
      const history = (await response.json()) as BwHistoryRawResponse;
      if (
        history.success !== true ||
        history.customer_id !== lookup.customer!.id ||
        !isNonNegativeInteger(history.unified_total)
      ) {
        throw new Error("history_invalid");
      }
      return {
        success: true,
        emailHash,
        lookupFound: true,
        walletFound: true,
        centralLedgerAvailable: true,
        unifiedTotal: history.unified_total,
        storeCount: 0,
        stores: [],
        historyComplete: false,
        historyRowsFetched: 0,
        uniqueTransactionCount: 0,
        duplicateRowsRemoved: 0,
        failureCode: "CENTRAL_BALANCE_RECOVERED_FROM_HISTORY",
      };
    } catch {
      return emptyCentralLedgerAudit(emailHash, {
        lookupFound: true,
        walletFound: true,
        failureCode,
      });
    }
  };

  const balanceUrl = new URL(`${getBaseUrl()}/api/tokens/balance`);
  balanceUrl.searchParams.set("customer_id", String(lookup.customer.id));
  balanceUrl.searchParams.set("store", "beautypass");
  balanceUrl.searchParams.set("unified", "true");

  let balanceResponse: Response;
  try {
    balanceResponse = await fetch(balanceUrl.toString(), {
      method: "GET",
      headers: readOnlyHeaders,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return recoverUnifiedTotalFromHistory("CENTRAL_BALANCE_CONNECTION_ERROR");
  }

  if (!balanceResponse.ok) {
    return recoverUnifiedTotalFromHistory(
      balanceResponse.status === 401 || balanceResponse.status === 403
        ? "CENTRAL_BALANCE_AUTH_UNAVAILABLE"
        : `CENTRAL_BALANCE_HTTP_${balanceResponse.status}`
    );
  }

  let balance: BwUnifiedBalanceRawResponse;
  try {
    balance = (await balanceResponse.json()) as BwUnifiedBalanceRawResponse;
  } catch {
    return recoverUnifiedTotalFromHistory("CENTRAL_BALANCE_INVALID_JSON");
  }
  const breakdown = Array.isArray(balance.breakdown) ? balance.breakdown : [];
  const totalBalance = balance.balance;
  const totalBonusPoints = balance.tokens;
  const unifiedTotal = balance.total;
  const validBreakdown =
    breakdown.length > 0 &&
    breakdown.every(
      item =>
        typeof item.store === "string" &&
        item.store.length > 0 &&
        Number.isInteger(item.customerId) &&
        item.customerId > 0 &&
        isNonNegativeInteger(item.balance) &&
        isNonNegativeInteger(item.bonusPoints) &&
        isNonNegativeInteger(item.subtotal) &&
        item.subtotal === item.balance + item.bonusPoints
    );
  const validBalance =
    balance.success === true &&
    balance.has_wallet === true &&
    balance.unified === true &&
    Number.isInteger(balance.customer_id) &&
    balance.customer_id > 0 &&
    balance.customer_id === lookup.customer.id &&
    isNonNegativeInteger(unifiedTotal) &&
    isNonNegativeInteger(totalBalance) &&
    isNonNegativeInteger(totalBonusPoints) &&
    unifiedTotal === totalBalance + totalBonusPoints &&
    validBreakdown &&
    breakdown.reduce((sum, item) => sum + item.balance, 0) === totalBalance &&
    breakdown.reduce((sum, item) => sum + item.bonusPoints, 0) ===
      totalBonusPoints &&
    breakdown.reduce((sum, item) => sum + item.subtotal, 0) === unifiedTotal;

  if (!validBalance) {
    return recoverUnifiedTotalFromHistory("CENTRAL_LEDGER_VALIDATION_FAILED");
  }

  const stores = Array.from(new Set(breakdown.map(item => item.store))).sort();
  const transactionMap = new Map<
    number,
    BwHistoryRawResponse["transactions"][number]
  >();
  let historyRowsFetched = 0;
  let duplicateRowsRemoved = 0;
  let historyComplete = true;

  for (const wallet of breakdown) {
    let offset = 0;
    let storeComplete = false;
    const pageSignatures = new Set<string>();
    for (let page = 0; page < BW_AUDIT_HISTORY_MAX_PAGES; page += 1) {
      const historyUrl = new URL(`${getBaseUrl()}/api/bp/history`);
      historyUrl.searchParams.set("customer_id", String(wallet.customerId));
      historyUrl.searchParams.set("store", wallet.store);
      historyUrl.searchParams.set("limit", String(BW_AUDIT_HISTORY_PAGE_SIZE));
      historyUrl.searchParams.set("offset", String(offset));

      let historyResponse: Response;
      try {
        historyResponse = await fetch(historyUrl.toString(), {
          method: "GET",
          headers: readOnlyHeaders,
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        historyComplete = false;
        break;
      }
      if (!historyResponse.ok) {
        historyComplete = false;
        break;
      }

      let history: BwHistoryRawResponse;
      try {
        history = (await historyResponse.json()) as BwHistoryRawResponse;
      } catch {
        historyComplete = false;
        break;
      }
      const totalRecords = history.total_records;
      const validHistoryEnvelope =
        history.success === true &&
        Number.isInteger(history.customer_id) &&
        history.customer_id > 0 &&
        history.customer_id === wallet.customerId &&
        isNonNegativeInteger(totalRecords) &&
        isNonNegativeInteger(history.unified_total) &&
        history.unified_total === unifiedTotal &&
        Array.isArray(history.transactions) &&
        history.transactions.length <= BW_AUDIT_HISTORY_PAGE_SIZE;
      if (!validHistoryEnvelope) {
        historyComplete = false;
        break;
      }

      const pageSignature = history.transactions
        .map(transaction => String(transaction.id))
        .join(",");
      if (pageSignature && pageSignatures.has(pageSignature)) {
        historyComplete = false;
        break;
      }
      if (pageSignature) pageSignatures.add(pageSignature);

      historyRowsFetched += history.transactions.length;
      for (const transaction of history.transactions) {
        const transactionId = transaction.id;
        const amount = transaction.amount;
        const balanceAfter = transaction.balance_after;
        const validTransaction =
          Number.isInteger(transactionId) &&
          transactionId > 0 &&
          isNonNegativeInteger(amount) &&
          isNonNegativeInteger(balanceAfter) &&
          typeof transaction.type === "string" &&
          transaction.type.trim().length > 0 &&
          (transaction.description === null ||
            typeof transaction.description === "string") &&
          (transaction.brand === null ||
            typeof transaction.brand === "string") &&
          typeof transaction.created_at === "string" &&
          transaction.created_at.length > 0 &&
          Number.isFinite(Date.parse(transaction.created_at));
        if (!validTransaction) {
          historyComplete = false;
          break;
        }
        if (transactionMap.has(transactionId)) {
          duplicateRowsRemoved += 1;
          continue;
        }
        transactionMap.set(transactionId, {
          ...transaction,
          amount,
        });
      }
      if (!historyComplete) break;

      offset += history.transactions.length;
      if (offset >= totalRecords) {
        storeComplete = true;
        break;
      }
      if (history.transactions.length === 0) break;
    }
    if (!storeComplete) historyComplete = false;
    if (!historyComplete) break;
  }

  if (!historyComplete) {
    return emptyCentralLedgerAudit(emailHash, {
      lookupFound: true,
      walletFound: true,
      centralLedgerAvailable: true,
      unifiedTotal,
      storeCount: stores.length,
      stores,
      failureCode: "CENTRAL_HISTORY_INCOMPLETE",
    });
  }

  return {
    success: true,
    emailHash,
    lookupFound: true,
    walletFound: true,
    centralLedgerAvailable: true,
    unifiedTotal,
    storeCount: stores.length,
    stores,
    historyComplete: true,
    historyRowsFetched,
    uniqueTransactionCount: transactionMap.size,
    duplicateRowsRemoved,
  };
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
    return {
      success: false,
      error: `Connection error: ${(err as Error).message}`,
    };
  }
}

/**
 * BW側で交換トランザクションの状態を確認
 */
export async function bwConfirmExchange(
  lcjExchangeId: number
): Promise<BwConfirmResponse> {
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
    return {
      success: false,
      error: `Connection error: ${(err as Error).message}`,
    };
  }
}
