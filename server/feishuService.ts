import crypto from "node:crypto";

/**
 * 飞书(Lark) API Service
 * LCJ経営管理表の客户管理データをlcjmallのブランド管理に同期する。
 * Source records carry stable hashes and presence metadata so an absent/blank
 * source field cannot silently erase an existing LCJ value.
 */
const FEISHU_BASE_URL = "https://open.feishu.cn/open-apis";

interface FeishuTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

export interface FeishuBitableRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

interface FeishuBitableResponse {
  code: number;
  msg: string;
  data?: {
    has_more: boolean;
    page_token?: string;
    total: number;
    items: FeishuBitableRecord[];
  };
}

export type LarkFieldValue<T> = {
  present: boolean;
  sourceField: string | null;
  value: T | null;
  conflict?: boolean;
};

export type LarkNumericFact = {
  sourceField: string;
  value: number;
};

export interface LarkBrandData {
  recordId: string;
  brandName: string;
  intro: string | null;
  stage: string | null;
  tier: string | null;
  category: string | null;
  contactPlatform: string | null;
  brandManager: string | null;
  businessContact: string | null;
  businessLead: string | null;
  operationsContact: string | null;
  shopId: string | null;
  reportedGmv: number | null;
  reportedSalesAmount: number | null;
  numericFacts: LarkNumericFact[];
  sourceHash: string;
  evidenceFields: Record<string, unknown>;
  fields: {
    brandName: LarkFieldValue<string>;
    intro: LarkFieldValue<string>;
    stage: LarkFieldValue<string>;
    tier: LarkFieldValue<string>;
    category: LarkFieldValue<string>;
    contactPlatform: LarkFieldValue<string>;
    brandManager: LarkFieldValue<string>;
    businessContact: LarkFieldValue<string>;
    businessLead: LarkFieldValue<string>;
    operationsContact: LarkFieldValue<string>;
    shopId: LarkFieldValue<string>;
    reportedGmv: LarkFieldValue<number>;
    reportedSalesAmount: LarkFieldValue<number>;
  };
}

const FIELD_ALIASES = {
  brandName: ["品牌(ブランド)", "品牌（ブランド）", "品牌", "ブランド", "Brand", "Brand Name"],
  intro: ["品牌介绍", "品牌介紹", "ブランド紹介", "品牌简介", "品牌簡介", "介绍", "紹介"],
  stage: ["当前阶段", "當前階段", "現在の段階", "合作阶段", "合作階段", "阶段", "階段", "Stage"],
  tier: ["Tier", "tier", "品牌等级", "品牌等級", "ブランドTier"],
  category: ["类目", "類目", "カテゴリー", "品类", "品類", "Category"],
  contactPlatform: ["联系平台", "聯繫平台", "連絡プラットフォーム", "联系渠道", "聯繫渠道"],
  brandManager: ["品牌担当", "品牌负责人", "品牌負責人", "ブランド担当"],
  businessContact: ["商务对接", "商務對接", "商务担当", "商務担当", "営業窓口"],
  businessLead: ["商务负责", "商務負責", "商务负责人", "商務負責人", "営業責任者"],
  operationsContact: ["运营对接", "運營對接", "运营担当", "運營担当", "運営担当"],
  shopId: ["店铺ID", "店鋪ID", "ショップID", "Shop ID", "TikTok Shop ID"],
  reportedGmv: ["GMV", "累计GMV", "累計GMV", "历史GMV", "歷史GMV", "总GMV", "總GMV", "GMV実績", "达播总带货gmv", "播总带货gmv"],
  reportedSalesAmount: ["营业额", "營業額", "销售额", "銷售額", "累计营业额", "累計營業額", "历史营业额", "歷史營業額", "売上", "売上実績"],
} as const;
const ALLOWED_EVIDENCE_FIELD_NAMES = new Set<string>(Object.values(FIELD_ALIASES).flat());

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getFeishuToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) throw new Error("FEISHU_APP_ID and FEISHU_APP_SECRET environment variables are required");
  const response = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data: FeishuTokenResponse = await response.json();
  if (data.code !== 0 || !data.tenant_access_token) throw new Error(`Failed to get Feishu token: ${data.msg}`);
  cachedToken = data.tenant_access_token;
  tokenExpiry = now + (data.expire || 7200) * 1000 - 60000;
  return cachedToken;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function hashLarkSourceFields(fields: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(fields))).digest("hex");
}

function resolveField<T>(fields: Record<string, unknown>, aliases: readonly string[], extractor: (field: unknown) => T | null): LarkFieldValue<T> {
  const presentValues: Array<{ sourceField: string; value: T | null }> = [];
  for (const alias of aliases) {
    if (!Object.prototype.hasOwnProperty.call(fields, alias)) continue;
    presentValues.push({ sourceField: alias, value: extractor(fields[alias]) });
  }
  const populated = presentValues.filter(item => item.value !== null && (!(typeof item.value === "string") || item.value.trim().length > 0));
  if (populated.length > 0) {
    const distinctValues = new Set(populated.map(item => JSON.stringify(item.value)));
    return { present: true, sourceField: populated[0].sourceField, value: populated[0].value, conflict: distinctValues.size > 1 };
  }
  if (presentValues.length > 0) return { present: true, sourceField: presentValues[0].sourceField, value: null, conflict: false };
  return { present: false, sourceField: null, value: null };
}

export function extractTextValue(field: unknown): string | null {
  if (field === null || field === undefined) return null;
  if (typeof field === "string") return field.trim() || null;
  if (typeof field === "number") return String(field);
  if (Array.isArray(field)) {
    const value = field.map((item: any) => item?.text ?? item?.value ?? item?.name ?? "").join("").trim();
    return value || null;
  }
  if (typeof field === "object") {
    const value = (field as any).text ?? (field as any).value ?? (field as any).name;
    return value === null || value === undefined ? null : String(value).trim() || null;
  }
  return null;
}

export function extractOptionValue(field: unknown): string | null {
  if (field === null || field === undefined) return null;
  if (typeof field === "string") return field.trim() || null;
  if (Array.isArray(field) && field.length > 0) {
    const value = (field[0] as any)?.text ?? (field[0] as any)?.value ?? field[0];
    return value === null || value === undefined ? null : String(value).trim() || null;
  }
  if (typeof field === "object" && (field as any).value !== undefined) return String((field as any).value).trim() || null;
  return null;
}

export function extractPersonValue(field: unknown): string | null {
  if (field === null || field === undefined) return null;
  if (typeof field === "string") return field.trim() || null;
  if (Array.isArray(field)) {
    const value = field.map((person: any) => person?.name ?? person?.text ?? "").filter(Boolean).join(", ").trim();
    return value || null;
  }
  if (typeof field === "object" && (field as any).name) return String((field as any).name).trim() || null;
  return null;
}

export function extractCategoryValue(field: unknown): string | null {
  if (field === null || field === undefined) return null;
  if (typeof field === "string") return field.trim() || null;
  if (Array.isArray(field)) {
    const value = field.map((item: any) => typeof item === "string" ? item : item?.text ?? item?.value ?? "").filter(Boolean).join(", ").trim();
    return value || null;
  }
  if (typeof field === "object" && (field as any).text) return String((field as any).text).trim() || null;
  return null;
}

export function extractNumericValue(field: unknown): number | null {
  if (field === null || field === undefined || field === "") return null;
  if (typeof field === "number") return Number.isFinite(field) && field >= 0 ? field : null;
  if (Array.isArray(field)) {
    for (const item of field) {
      const parsed = extractNumericValue((item as any)?.value ?? (item as any)?.text ?? item);
      if (parsed !== null) return parsed;
    }
    return null;
  }
  if (typeof field === "object") return extractNumericValue((field as any).value ?? (field as any).text ?? null);
  const normalized = String(field).trim().replace(/[¥￥$€,%\s,]/g, "");
  if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function collectNumericFacts(fields: Record<string, unknown>): LarkNumericFact[] {
  const relevant = /(gmv|売上|销售|銷售|营业|營業|成交|金额|金額|业绩|業績|登录|登錄|login|账号数|帳號數|店舗数|店铺数)/i;
  const sensitiveIdentifier = /(^|[^a-z])(id|phone|mobile|tel)([^a-z]|$)|電話|手机|手機|郵便|邮编|郵編|口座|银行卡|銀行卡|账号id|帳號id/i;
  return Object.entries(fields)
    .filter(([name]) => relevant.test(name) && !sensitiveIdentifier.test(name) && !ALLOWED_EVIDENCE_FIELD_NAMES.has(name))
    .map(([sourceField, value]) => ({ sourceField, value: extractNumericValue(value) }))
    .filter((fact): fact is LarkNumericFact => fact.value !== null);
}

export function mapFeishuRecord(record: FeishuBitableRecord): LarkBrandData {
  const rawFields = record.fields || {};
  const brandName = resolveField(rawFields, FIELD_ALIASES.brandName, extractTextValue);
  const intro = resolveField(rawFields, FIELD_ALIASES.intro, extractTextValue);
  const stage = resolveField(rawFields, FIELD_ALIASES.stage, extractOptionValue);
  const explicitTier = resolveField(rawFields, FIELD_ALIASES.tier, extractOptionValue);
  const tierFromStage = !stage.conflict && (stage.value === "Tier1" || stage.value === "Tier2") ? stage.value : null;
  const tier = explicitTier.value ? explicitTier : tierFromStage
    ? { present: stage.present, sourceField: stage.sourceField, value: tierFromStage }
    : explicitTier;
  const category = resolveField(rawFields, FIELD_ALIASES.category, extractCategoryValue);
  const contactPlatform = resolveField(rawFields, FIELD_ALIASES.contactPlatform, extractTextValue);
  const brandManager = resolveField(rawFields, FIELD_ALIASES.brandManager, extractPersonValue);
  const businessContact = resolveField(rawFields, FIELD_ALIASES.businessContact, extractPersonValue);
  const businessLead = resolveField(rawFields, FIELD_ALIASES.businessLead, extractPersonValue);
  const operationsContact = resolveField(rawFields, FIELD_ALIASES.operationsContact, extractPersonValue);
  const shopId = resolveField(rawFields, FIELD_ALIASES.shopId, extractTextValue);
  const reportedGmv = resolveField(rawFields, FIELD_ALIASES.reportedGmv, extractNumericValue);
  const reportedSalesAmount = resolveField(rawFields, FIELD_ALIASES.reportedSalesAmount, extractNumericValue);
  const resolvedFields = { brandName, intro, stage, tier, category, contactPlatform, brandManager, businessContact, businessLead, operationsContact, shopId, reportedGmv, reportedSalesAmount };
  const numericFacts = collectNumericFacts(rawFields);
  const evidenceFieldNames = new Set([
    ...Object.keys(rawFields).filter(name => ALLOWED_EVIDENCE_FIELD_NAMES.has(name)),
    ...numericFacts.map(fact => fact.sourceField),
  ]);
  const evidenceFields = Object.fromEntries([...evidenceFieldNames].map(name => [name, rawFields[name]]));
  return {
    recordId: record.record_id,
    brandName: brandName.value || "Unknown",
    intro: intro.value,
    stage: stage.value,
    tier: tier.value,
    category: category.value,
    contactPlatform: contactPlatform.value,
    brandManager: brandManager.value,
    businessContact: businessContact.value,
    businessLead: businessLead.value,
    operationsContact: operationsContact.value,
    shopId: shopId.value,
    reportedGmv: reportedGmv.value,
    reportedSalesAmount: reportedSalesAmount.value,
    numericFacts,
    sourceHash: hashLarkSourceFields(rawFields),
    evidenceFields,
    fields: resolvedFields,
  };
}

export async function fetchFeishuBrands(): Promise<LarkBrandData[]> {
  const token = await getFeishuToken();
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID;
  if (!appToken || !tableId) throw new Error("FEISHU_BITABLE_APP_TOKEN and FEISHU_BITABLE_TABLE_ID environment variables are required");
  const allRecords: FeishuBitableRecord[] = [];
  let pageToken: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const url = new URL(`${FEISHU_BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
    url.searchParams.set("page_size", "100");
    if (pageToken) url.searchParams.set("page_token", pageToken);
    const response = await fetch(url.toString(), { method: "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const data: FeishuBitableResponse = await response.json();
    if (data.code !== 0 || !data.data) throw new Error(`Failed to fetch Feishu records: ${data.msg} (code: ${data.code})`);
    allRecords.push(...data.data.items);
    hasMore = data.data.has_more;
    pageToken = data.data.page_token;
  }
  return allRecords.map(mapFeishuRecord);
}

export function mapLarkStageToStatus(larkStage: string | null): "進行中" | "打ち合わせ中" | "契約済み" | "保留" | "終了" {
  if (!larkStage) return "進行中";
  const stageMap: Record<string, "進行中" | "打ち合わせ中" | "契約済み" | "保留" | "終了"> = {
    "跟进中": "進行中", "成约客户": "契約済み", "TSP": "契約済み", "半年框": "契約済み",
    "自营": "契約済み", "纯佣": "進行中", "达人配信者": "進行中", "未成约客户": "打ち合わせ中",
    "暂不合作": "終了", "合作中": "契約済み", "线索阶段": "打ち合わせ中", "Tier1": "契約済み", "Tier2": "契約済み",
  };
  return stageMap[larkStage] || "進行中";
}

export function isFeishuConfigured(): boolean {
  return Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET && process.env.FEISHU_BITABLE_APP_TOKEN && process.env.FEISHU_BITABLE_TABLE_ID);
}
