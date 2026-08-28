export const MAX_SELECTION_PRODUCT_TAGS = 30;
export const MAX_SELECTION_PRODUCT_SKUS = 100;

export type SelectionProductSkuVariant = {
  variantId?: string;
  name: string;
  skuCode?: string;
  price?: string;
  lowestPrice?: string;
  discountRate?: string;
  promotionType?: string;
  stock?: number;
  status?: "draft" | "online" | "offline";
};

export class SelectionProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelectionProductValidationError";
  }
}

export function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return [...value];
  if (value === null || value === undefined || value === "") return [];
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeSelectionProductTags(value: unknown): string[] {
  let source: unknown[];
  if (Array.isArray(value)) {
    source = value;
  } else if (value === null || value === undefined || value === "") {
    source = [];
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      source = Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      source = [trimmed];
    }
  } else {
    throw new SelectionProductValidationError("标签格式无效 / タグ形式が正しくありません");
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    if (typeof item !== "string") {
      throw new SelectionProductValidationError("标签必须是文字 / タグは文字列で入力してください");
    }
    const tag = item.trim();
    if (!tag) continue;
    if (tag.length > 100) {
      throw new SelectionProductValidationError("单个标签不能超过100字 / タグは100文字以内で入力してください");
    }
    if (!seen.has(tag)) {
      seen.add(tag);
      normalized.push(tag);
    }
  }

  if (normalized.length > MAX_SELECTION_PRODUCT_TAGS) {
    throw new SelectionProductValidationError(`标签最多${MAX_SELECTION_PRODUCT_TAGS}个 / タグは最大${MAX_SELECTION_PRODUCT_TAGS}件です`);
  }
  return normalized;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function normalizeOptionalNumber(
  value: unknown,
  rowNumber: number,
  label: string,
  minimum: number,
  maximum?: number,
): string | undefined {
  if (isBlank(value)) return undefined;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new SelectionProductValidationError(`SKU ${rowNumber}：${label}格式无效 / ${label}の形式が正しくありません`);
  }

  const raw = String(value).trim();
  const decimalPattern = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
  const parsed = Number(raw);
  if (!decimalPattern.test(raw) || !Number.isFinite(parsed) || parsed < minimum || (maximum !== undefined && parsed > maximum)) {
    const range = maximum === undefined ? `${minimum}以上` : `${minimum}〜${maximum}`;
    throw new SelectionProductValidationError(`SKU ${rowNumber}：${label}必须为${range}的数字 / ${label}は${range}の数値で入力してください`);
  }
  return raw;
}

export function selectionProductSkuIdentity(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ja-JP");
}

function normalizeOptionalText(value: unknown, rowNumber: number, label: string, maximum: number): string | undefined {
  if (isBlank(value)) return undefined;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new SelectionProductValidationError(`SKU ${rowNumber}：${label}格式无效 / ${label}の形式が正しくありません`);
  }
  const normalized = String(value).trim().replace(/\s+/g, " ");
  if (normalized.length > maximum) {
    throw new SelectionProductValidationError(`SKU ${rowNumber}：${label}不能超过${maximum}字 / ${label}は${maximum}文字以内で入力してください`);
  }
  return normalized || undefined;
}

function normalizeOptionalStock(value: unknown, rowNumber: number): number | undefined {
  if (isBlank(value)) return undefined;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw new SelectionProductValidationError(`SKU ${rowNumber}：库存必须为0以上整数 / 在庫は0以上の整数で入力してください`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new SelectionProductValidationError(`SKU ${rowNumber}：库存必须为0以上整数 / 在庫は0以上の整数で入力してください`);
  }
  return parsed;
}

function normalizeOptionalSkuStatus(value: unknown, rowNumber: number): SelectionProductSkuVariant["status"] {
  if (isBlank(value)) return undefined;
  const status = String(value).trim();
  if (status !== "draft" && status !== "online" && status !== "offline") {
    throw new SelectionProductValidationError(`SKU ${rowNumber}：状态无效 / ステータスが正しくありません`);
  }
  return status;
}

export function normalizeSelectionProductSkuVariants(value: unknown): SelectionProductSkuVariant[] {
  let source: unknown[];
  if (Array.isArray(value)) {
    source = value;
  } else if (value === null || value === undefined || value === "") {
    source = [];
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        throw new SelectionProductValidationError("SKU格式无效 / SKU形式が正しくありません");
      }
      source = parsed;
    } catch (error) {
      if (error instanceof SelectionProductValidationError) throw error;
      throw new SelectionProductValidationError("SKU数据无法解析 / SKUデータを読み取れません");
    }
  } else {
    throw new SelectionProductValidationError("SKU格式无效 / SKU形式が正しくありません");
  }

  if (source.length > MAX_SELECTION_PRODUCT_SKUS) {
    throw new SelectionProductValidationError(`SKU最多${MAX_SELECTION_PRODUCT_SKUS}个 / SKUは最大${MAX_SELECTION_PRODUCT_SKUS}件です`);
  }

  const normalized: SelectionProductSkuVariant[] = [];
  const seen = new Map<string, number>();

  source.forEach((item, index) => {
    const rowNumber = index + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new SelectionProductValidationError(`SKU ${rowNumber}：格式无效 / 形式が正しくありません`);
    }

    const row = item as Record<string, unknown>;
    const completelyBlank = [row.name, row.skuCode, row.price, row.lowestPrice, row.discountRate, row.promotionType, row.stock, row.status].every(isBlank);
    if (completelyBlank) return;

    const name = typeof row.name === "string" ? row.name.trim().replace(/\s+/g, " ") : "";
    if (!name) {
      throw new SelectionProductValidationError(`SKU ${rowNumber}：请输入名称 / 名称を入力してください`);
    }
    if (name.length > 200) {
      throw new SelectionProductValidationError(`SKU ${rowNumber}：名称不能超过200字 / 名称は200文字以内で入力してください`);
    }

    const identity = selectionProductSkuIdentity(name);
    const duplicateOf = seen.get(identity);
    if (duplicateOf !== undefined) {
      throw new SelectionProductValidationError(`SKU ${rowNumber}与SKU ${duplicateOf}名称重复 / SKU ${duplicateOf}と名称が重複しています`);
    }
    seen.set(identity, rowNumber);

    const variantId = normalizeOptionalText(row.variantId, rowNumber, "SKU内部ID", 100);
    if (variantId && !/^[A-Za-z0-9_-]{8,100}$/.test(variantId)) {
      throw new SelectionProductValidationError(`SKU ${rowNumber}：SKU内部ID格式无效 / SKU内部IDの形式が正しくありません`);
    }
    const skuCode = normalizeOptionalText(row.skuCode, rowNumber, "SKU编号 / SKU番号", 100);
    if (skuCode) {
      const codeIdentity = `code:${selectionProductSkuIdentity(skuCode)}`;
      const duplicateCodeOf = seen.get(codeIdentity);
      if (duplicateCodeOf !== undefined) {
        throw new SelectionProductValidationError(`SKU ${rowNumber}与SKU ${duplicateCodeOf}编号重复 / SKU ${duplicateCodeOf}と番号が重複しています`);
      }
      seen.set(codeIdentity, rowNumber);
    }
    const promotionType = isBlank(row.promotionType) ? undefined : String(row.promotionType).trim();
    if (promotionType && promotionType.length > 50) {
      throw new SelectionProductValidationError(`SKU ${rowNumber}：促销名称不能超过50字 / 販促名は50文字以内で入力してください`);
    }

    const variant: SelectionProductSkuVariant = { name };
    if (variantId) variant.variantId = variantId;
    if (skuCode) variant.skuCode = skuCode;
    const price = normalizeOptionalNumber(row.price, rowNumber, "定价 / 定価", 0);
    const lowestPrice = normalizeOptionalNumber(row.lowestPrice, rowNumber, "最低价 / 最低価", 0);
    const discountRate = normalizeOptionalNumber(row.discountRate, rowNumber, "折扣率 / 割引率", 0, 100);
    const stock = normalizeOptionalStock(row.stock, rowNumber);
    const status = normalizeOptionalSkuStatus(row.status, rowNumber);
    if (price !== undefined) variant.price = price;
    if (lowestPrice !== undefined) variant.lowestPrice = lowestPrice;
    if (discountRate !== undefined) variant.discountRate = discountRate;
    if (promotionType) variant.promotionType = promotionType;
    if (stock !== undefined) variant.stock = stock;
    if (status !== undefined) variant.status = status;
    normalized.push(variant);
  });

  return normalized;
}

export function legacySelectionProductSkuVariant(product: Record<string, unknown>): SelectionProductSkuVariant[] {
  if (isBlank(product.skuName)) return [];
  return normalizeSelectionProductSkuVariants([{
    name: product.skuName,
    price: product.skuPrice,
    lowestPrice: product.skuLowestPrice,
    discountRate: product.skuDiscountRate,
    promotionType: product.promotionType,
  }]);
}
