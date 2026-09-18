export type LcfApplicationFormError = {
  fieldId: string | null;
  message: string;
  code: string;
};

const FIELD_ALIASES: Record<string, string[]> = {
  companyName: ["貴社名", "会社名"],
  contactName: ["ご担当者様名", "担当者名"],
  contactDepartment: ["担当者部署", "部署"],
  contactNameKana: ["フリガナ"],
  postalCode: ["郵便番号"],
  address: ["所在地", "住所"],
  phone: ["電話番号"],
  email: ["メールアドレス"],
  websiteUrl: ["ホームページURL", "ウェブサイトURL"],
  lineOrLark: ["LINE ID", "Lark"],
  tiktokShopSellerName: ["TikTok Shopセラーアカウント名"],
  brandIntro: ["ブランド紹介文"],
  tiktokShopUrl: ["TikTok Shop URL"],
  matchingProducts: ["マッチング用商材"],
  targetAudience: ["商品対象ターゲット", "対象ターゲット"],
  salesLicense: ["販売資格"],
  name: ["お名前"],
  nameKana: ["フリガナ"],
  liverName: ["ライバー名", "活動名"],
  agency: ["所属事務所"],
  accountInfo: ["SNSアカウント情報"],
  genre: ["活動ジャンル"],
  attendanceSchedule: ["来場希望日"],
  matchingPreference: ["事前マッチング"],
  beginnerSupport: ["初心者サポート"],
};

function toErrorCode(value: unknown, fieldId: string | null): string {
  const raw = String(value || "").trim();
  if (raw) return `LCF-${raw.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase()}`;
  if (fieldId) return `LCF-FORM-${fieldId.replace(/([a-z])([A-Z])/g, "$1-$2").toUpperCase()}`;
  return "LCF-FORM-VALIDATION";
}

function findIssue(payload: unknown): { fieldId: string | null; message: string | null; code: unknown } {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const issue = findIssue(item);
      if (issue.fieldId || issue.message) return issue;
    }
    return { fieldId: null, message: null, code: null };
  }
  if (!payload || typeof payload !== "object") return { fieldId: null, message: null, code: null };

  const record = payload as Record<string, unknown>;
  const rawPath = Array.isArray(record.path) ? record.path : [];
  const pathField = [...rawPath].reverse().find((value): value is string => typeof value === "string") || null;
  const directField = typeof record.field === "string" ? record.field : null;
  const fieldId = directField || pathField;
  const message = typeof record.message === "string" ? record.message : null;
  if (fieldId || message) return { fieldId, message, code: record.code };

  for (const value of Object.values(record)) {
    const issue = findIssue(value);
    if (issue.fieldId || issue.message) return issue;
  }
  return { fieldId: null, message: null, code: null };
}

export function parseLcfApplicationFormError(error: unknown): LcfApplicationFormError {
  const errorRecord = error && typeof error === "object" ? error as Record<string, any> : {};
  const rawMessage = typeof errorRecord.message === "string" ? errorRecord.message.trim() : String(error || "").trim();
  let payload: unknown = null;
  if (rawMessage.startsWith("[") || rawMessage.startsWith("{")) {
    try {
      payload = JSON.parse(rawMessage);
    } catch {
      payload = null;
    }
  }

  const issue = findIssue(payload) || { fieldId: null, message: null, code: null };
  const structuredIssue = issue.fieldId || issue.message
    ? issue
    : findIssue(errorRecord?.data?.zodError || errorRecord?.shape?.data?.zodError || errorRecord?.data || errorRecord?.shape);
  let fieldId = structuredIssue.fieldId;
  const message = structuredIssue.message || rawMessage || "入力内容を確認してください。";
  if (!fieldId) {
    fieldId = Object.entries(FIELD_ALIASES).find(([, aliases]) => aliases.some((label) => message.includes(label)))?.[0] || null;
  }

  const trpcCode = errorRecord?.data?.code || errorRecord?.shape?.data?.code || structuredIssue.code;
  return {
    fieldId,
    message,
    code: toErrorCode(trpcCode, fieldId),
  };
}
