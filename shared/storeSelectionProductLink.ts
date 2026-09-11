import {
  collectSelectionProductImportVariants,
  parseSelectionProductImages,
  selectionMoneyToMallYen,
  selectionStockToMallStock,
  type SelectionProductImportSource,
} from "./mallSelectionProductImport";

export type StoreSelectionSourceRecord = SelectionProductImportSource & {
  categoryName?: string | null;
  productLink?: string | null;
  updatedAt?: Date | string | null;
};

export type StoreSelectionSkuPrefill = {
  platformSkuId: string;
  skuCode: string;
  barcode: string;
  variantName: string;
  salePrice: number | null;
  stock: number;
  status: "active" | "inactive";
};

export type StoreSelectionProductPrefill = {
  selectionProductId: number;
  externalProductId: string;
  productName: string;
  brandName: string;
  category: string;
  productUrl: string;
  basePrice: number | null;
  stock: number;
  notes: string;
  sourceStatus: string;
  imageUrls: string[];
  skus: StoreSelectionSkuPrefill[];
};

export function normalizeStoreSelectionIdentity(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ja-JP");
}

export function selectionProductToStorePrefill(
  source: StoreSelectionSourceRecord,
  entityChildren: StoreSelectionSourceRecord[] = [],
): StoreSelectionProductPrefill {
  const variants = collectSelectionProductImportVariants(source, entityChildren);
  const fallbackExternalId = String(source.productId || source.barcode || "").trim();
  return {
    selectionProductId: Number(source.id),
    externalProductId: fallbackExternalId,
    productName: String(source.productName || source.productNameCn || "").trim(),
    brandName: String(source.brandName || "").trim(),
    category: String(source.categoryName || "").trim(),
    productUrl: String(source.productLink || "").trim(),
    basePrice: selectionMoneyToMallYen(source.price) || null,
    stock: selectionStockToMallStock(source.stock),
    notes: String(source.description || source.sellingPoints || "").trim(),
    sourceStatus: String(source.status || "draft"),
    imageUrls: parseSelectionProductImages(source.images).slice(0, 8),
    skus: variants.map((variant) => ({
      platformSkuId: String(variant.sku || "").trim(),
      skuCode: String(variant.sku || "").trim(),
      barcode: "",
      variantName: variant.name.trim(),
      salePrice: variant.price,
      stock: selectionStockToMallStock(variant.stock),
      status: variant.isActive === "yes" ? "active" : "inactive",
    })),
  };
}

export function mergeStoreSelectionSkuPrefills<T extends {
  platformSkuId?: string | null;
  skuCode?: string | null;
  barcode?: string | null;
  variantName?: string | null;
}>(
  current: T[],
  incoming: StoreSelectionSkuPrefill[],
  toTarget: (sku: StoreSelectionSkuPrefill) => T,
): T[] {
  const identities = new Set<string>();
  const remember = (row: T) => {
    const code = normalizeStoreSelectionIdentity(row.skuCode || row.platformSkuId || row.barcode);
    const name = normalizeStoreSelectionIdentity(row.variantName);
    if (code) identities.add(`code:${code}`);
    if (name) identities.add(`name:${name}`);
  };
  current.forEach(remember);
  const result = [...current];
  for (const sku of incoming) {
    const code = normalizeStoreSelectionIdentity(sku.skuCode || sku.platformSkuId || sku.barcode);
    const name = normalizeStoreSelectionIdentity(sku.variantName);
    if ((code && identities.has(`code:${code}`)) || (name && identities.has(`name:${name}`))) continue;
    const target = toTarget(sku);
    result.push(target);
    remember(target);
  }
  return result;
}
