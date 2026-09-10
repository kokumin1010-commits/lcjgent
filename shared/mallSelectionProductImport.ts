import {
  legacySelectionProductSkuVariant,
  normalizeSelectionProductSkuVariants,
  selectionProductSkuIdentity,
  type SelectionProductSkuVariant,
} from "./selectionProductPersistence";

export type MallImportCategory = {
  id: number;
  name: string;
  isActive?: "yes" | "no" | string | null;
};

export type MallImportBrand = {
  id: number;
};

export type SelectionProductImportSource = Record<string, unknown> & {
  id: number;
  productName: string;
  productNameCn?: string | null;
  productId?: string | null;
  barcode?: string | null;
  brandId?: number | string | null;
  brandName?: string | null;
  categoryId?: number | string | null;
  categoryName?: string | null;
  price?: number | string | null;
  stock?: number | string | null;
  images?: unknown;
  description?: string | null;
  sellingPoints?: string | null;
  commissionType?: "percentage" | "fixed" | string | null;
  commissionValue?: number | string | null;
  skuVariants?: unknown;
  skuName?: string | null;
  skuPrice?: number | string | null;
  skuLowestPrice?: number | string | null;
  skuDiscountRate?: number | string | null;
  promotionType?: string | null;
  status?: "draft" | "online" | "offline" | string | null;
};

export type MallProductImportVariant = {
  name: string;
  sku: string | null;
  price: number | null;
  stock: number;
  isActive: "yes" | "no";
};

export type MallProductImportPrefill = {
  selectionProductId: number;
  name: string;
  description: string;
  brandId: number | null;
  categoryId: number | null;
  price: number;
  stock: number;
  images: Array<{ url: string; key: string }>;
  commissionRate: string;
};

export function normalizeMallImportIdentity(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ja-JP");
}

export function parseSelectionProductImages(value: unknown): string[] {
  let source: unknown[] = [];
  if (Array.isArray(value)) {
    source = value;
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      source = Array.isArray(parsed) ? parsed : [];
    } catch {
      source = [];
    }
  }

  const seen = new Set<string>();
  const images: string[] = [];
  for (const item of source) {
    const url = typeof item === "string"
      ? item.trim()
      : item && typeof item === "object" && typeof (item as Record<string, unknown>).url === "string"
        ? String((item as Record<string, unknown>).url).trim()
        : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push(url);
    if (images.length >= 10) break;
  }
  return images;
}

export function selectionMoneyToMallYen(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}

export function selectionStockToMallStock(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

export function resolveMallCategoryId(
  categoryName: unknown,
  categories: MallImportCategory[],
): number | null {
  const key = normalizeMallImportIdentity(categoryName);
  if (!key) return null;
  const matches = categories.filter((category) =>
    category.isActive !== "no" && normalizeMallImportIdentity(category.name) === key,
  );
  return matches.length === 1 ? Number(matches[0].id) : null;
}

export function resolveMallBrandId(
  brandId: unknown,
  brands: MallImportBrand[],
): number | null {
  const parsed = Number(brandId);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return brands.some((brand) => Number(brand.id) === parsed) ? parsed : null;
}

export function selectionProductToMallPrefill(
  source: SelectionProductImportSource,
  categories: MallImportCategory[],
  brands: MallImportBrand[],
): MallProductImportPrefill {
  const images = parseSelectionProductImages(source.images);
  const percentage = source.commissionType === "percentage" ? Number(source.commissionValue) : NaN;
  return {
    selectionProductId: Number(source.id),
    name: String(source.productName || source.productNameCn || "").trim(),
    description: String(source.description || source.sellingPoints || "").trim(),
    brandId: resolveMallBrandId(source.brandId, brands),
    categoryId: resolveMallCategoryId(source.categoryName, categories),
    price: selectionMoneyToMallYen(source.price),
    stock: selectionStockToMallStock(source.stock),
    images: images.map((url) => ({ url, key: "" })),
    commissionRate: Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
      ? String(percentage)
      : "",
  };
}

function normalizedVariant(
  variant: SelectionProductSkuVariant,
  fallbackStatus?: unknown,
): MallProductImportVariant {
  return {
    name: variant.name.trim(),
    sku: variant.skuCode?.trim() || null,
    price: selectionMoneyToMallYen(variant.price) || null,
    stock: selectionStockToMallStock(variant.stock),
    isActive: (variant.status || fallbackStatus) === "online" ? "yes" : "no",
  };
}

export function collectSelectionProductImportVariants(
  parent: SelectionProductImportSource,
  entityChildren: SelectionProductImportSource[] = [],
): MallProductImportVariant[] {
  const embedded = normalizeSelectionProductSkuVariants(parent.skuVariants);
  const sourceVariants = embedded.length > 0 ? embedded : legacySelectionProductSkuVariant(parent);
  const candidates: MallProductImportVariant[] = sourceVariants.map((variant) => normalizedVariant(variant, parent.status));

  for (const child of entityChildren) {
    const name = String(child.skuName || child.productName || "").trim();
    if (!name) continue;
    candidates.push({
      name,
      sku: String(child.productId || child.barcode || "").trim() || null,
      price: selectionMoneyToMallYen(child.skuPrice ?? child.price) || null,
      stock: selectionStockToMallStock(child.stock),
      isActive: child.status === "online" ? "yes" : "no",
    });
  }

  const variants: MallProductImportVariant[] = [];
  const seen = new Set<string>();
  for (const variant of candidates) {
    const identity = variant.sku
      ? `sku:${selectionProductSkuIdentity(variant.sku)}`
      : `name:${selectionProductSkuIdentity(variant.name)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    variants.push(variant);
  }
  return variants;
}
