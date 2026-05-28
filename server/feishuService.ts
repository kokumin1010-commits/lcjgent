/**
 * 飞书(Lark) API Service
 * LCJ経営管理表の客户管理データをlcjmallのブランド管理に同期する
 * 
 * 環境変数:
 * - FEISHU_APP_ID: 飞书アプリID
 * - FEISHU_APP_SECRET: 飞书アプリSecret
 * - FEISHU_BITABLE_APP_TOKEN: 多维表格のApp Token
 * - FEISHU_BITABLE_TABLE_ID: 客户管理テーブルのTable ID
 */

const FEISHU_BASE_URL = "https://open.feishu.cn/open-apis";

interface FeishuTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

interface FeishuBitableRecord {
  record_id: string;
  fields: {
    [key: string]: any;
  };
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

export interface LarkBrandData {
  recordId: string;
  brandName: string;
  intro: string | null;
  stage: string | null; // 当前阶段: 跟进中/成约客户/TSP/半年框/自营/暂不合作/纯佣/达人配信者
  tier: string | null; // Tier1/Tier2
  category: string | null; // 类目
  contactPlatform: string | null; // 联系平台
  brandManager: string | null; // 品牌担当
  businessContact: string | null; // 商务对接
  businessLead: string | null; // 商务负责
  operationsContact: string | null; // 运营对接
  shopId: string | null; // 店铺ID
}

// Token cache
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * 获取飞书 tenant_access_token
 */
export async function getFeishuToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("FEISHU_APP_ID and FEISHU_APP_SECRET environment variables are required");
  }

  const response = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  const data: FeishuTokenResponse = await response.json();
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Failed to get Feishu token: ${data.msg}`);
  }

  cachedToken = data.tenant_access_token;
  tokenExpiry = now + (data.expire || 7200) * 1000 - 60000; // Expire 1 min early
  return cachedToken;
}

/**
 * 从飞书多维表格获取客户管理数据
 */
export async function fetchFeishuBrands(): Promise<LarkBrandData[]> {
  const token = await getFeishuToken();
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID;

  if (!appToken || !tableId) {
    throw new Error("FEISHU_BITABLE_APP_TOKEN and FEISHU_BITABLE_TABLE_ID environment variables are required");
  }

  const allRecords: FeishuBitableRecord[] = [];
  let pageToken: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${FEISHU_BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
    url.searchParams.set("page_size", "100");
    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data: FeishuBitableResponse = await response.json();
    if (data.code !== 0 || !data.data) {
      throw new Error(`Failed to fetch Feishu records: ${data.msg} (code: ${data.code})`);
    }

    allRecords.push(...data.data.items);
    hasMore = data.data.has_more;
    pageToken = data.data.page_token;
  }

  // Map records to LarkBrandData
  return allRecords.map((record) => {
    const fields = record.fields;
    return {
      recordId: record.record_id,
      brandName: extractTextValue(fields["品牌(ブランド)"] || fields["品牌"] || fields["ブランド"]) || "Unknown",
      intro: extractTextValue(fields["品牌介绍"]),
      stage: extractOptionValue(fields["当前阶段"]),
      tier: extractOptionValue(fields["当前阶段"]) === "Tier1" || extractOptionValue(fields["当前阶段"]) === "Tier2" 
        ? extractOptionValue(fields["当前阶段"]) 
        : extractOptionValue(fields["Tier"]) || extractTierFromStage(fields),
      category: extractCategoryValue(fields["类目"]),
      contactPlatform: extractTextValue(fields["联系平台"]),
      brandManager: extractPersonValue(fields["品牌担当"]),
      businessContact: extractPersonValue(fields["商务对接"]),
      businessLead: extractPersonValue(fields["商务负责"]),
      operationsContact: extractPersonValue(fields["运营对接"]),
      shopId: extractTextValue(fields["店铺ID"]),
    };
  });
}

/**
 * Extract text value from Feishu field (could be string, array of text objects, etc.)
 */
function extractTextValue(field: any): string | null {
  if (!field) return null;
  if (typeof field === "string") return field;
  if (typeof field === "number") return String(field);
  if (Array.isArray(field)) {
    // Text field format: [{type: "text", text: "..."}]
    return field.map((item: any) => item.text || item.value || String(item)).join("");
  }
  if (field.text) return field.text;
  if (field.value) return String(field.value);
  return null;
}

/**
 * Extract option/enum value from Feishu field
 */
function extractOptionValue(field: any): string | null {
  if (!field) return null;
  if (typeof field === "string") return field;
  if (field.value) return String(field.value);
  if (Array.isArray(field) && field.length > 0) {
    return field[0].text || field[0].value || String(field[0]);
  }
  return null;
}

/**
 * Extract person name from Feishu person field
 */
function extractPersonValue(field: any): string | null {
  if (!field) return null;
  if (typeof field === "string") return field;
  if (Array.isArray(field)) {
    return field.map((person: any) => person.name || person.text || "").filter(Boolean).join(", ");
  }
  if (field.name) return field.name;
  return null;
}

/**
 * Extract Tier from stage field or other fields
 */
function extractTierFromStage(fields: any): string | null {
  // Check if there's a separate Tier field
  const tierField = fields["Tier"] || fields["tier"];
  if (tierField) return extractOptionValue(tierField);
  return null;
}

/**
 * Map Feishu stage to lcjmall status
 */
export function mapLarkStageToStatus(larkStage: string | null): "進行中" | "打ち合わせ中" | "契約済み" | "保留" | "終了" {
  if (!larkStage) return "進行中";
  
  const stageMap: Record<string, "進行中" | "打ち合わせ中" | "契約済み" | "保留" | "終了"> = {
    "跟进中": "進行中",
    "成约客户": "契約済み",
    "TSP": "契約済み",
    "半年框": "契約済み",
    "自营": "契約済み",
    "纯佣": "進行中",
    "达人配信者": "進行中",
    "未成约客户": "打ち合わせ中",
    "暂不合作": "終了",
    "合作中": "契約済み",
    "线索阶段": "打ち合わせ中",
    "Tier1": "契約済み",
    "Tier2": "契約済み",
  };

  return stageMap[larkStage] || "進行中";
}

/**
 * Extract category value from Feishu field (array of strings)
 */
function extractCategoryValue(field: any): string | null {
  if (!field) return null;
  if (typeof field === "string") return field;
  if (Array.isArray(field)) {
    // Category field is array of strings like ["美妆个护"]
    return field.filter((item: any) => typeof item === "string").join(", ") || 
           field.map((item: any) => item.text || item.value || String(item)).join(", ");
  }
  if (field.text) return field.text;
  return null;
}

/**
 * Check if Feishu credentials are configured
 */
export function isFeishuConfigured(): boolean {
  return !!(
    process.env.FEISHU_APP_ID &&
    process.env.FEISHU_APP_SECRET &&
    process.env.FEISHU_BITABLE_APP_TOKEN &&
    process.env.FEISHU_BITABLE_TABLE_ID
  );
}
