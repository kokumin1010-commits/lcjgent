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
  detailImages?: unknown;
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
  imageUrl: string;
  imageKey: string;
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
  const imageUrls = [...new Set([
    ...parseSelectionProductImages(source.images),
    ...parseSelectionProductImages(source.detailImages),
  ])].slice(0, 8);
  const childByCode = new Map<string, StoreSelectionSourceRecord>();
  const childByName = new Map<string, StoreSelectionSourceRecord>();
  for (const child of entityChildren) {
    for (const code of [child.productId, child.barcode]) {
      const identity = normalizeStoreSelectionIdentity(code);
      if (identity && !childByCode.has(identity)) childByCode.set(identity, child);
    }
    const name = normalizeStoreSelectionIdentity(child.skuName || child.productName);
    if (name && !childByName.has(name)) childByName.set(name, child);
  }
  return {
    selectionProductId: Number(source.id),
    externalProductId: fallbackExternalId,
    productName: String(source.productName || source.productNameCn || "").trim(),
    brandName: String(source.brandName || "").trim(),
    category: String(source.categoryName || "").trim(),
    productUrl: String(source.productLink || "").trim(),
    basePrice: selectionMoneyToMallYen(source.price) || null,
    stock: selectionStockToMallStock(source.stock),
    notes: [...new Set([source.description, source.sellingPoints]
      .map((value) => String(value || "").trim())
      .filter(Boolean))].join("\n\n"),
    sourceStatus: String(source.status || "draft"),
    imageUrls,
    skus: variants.map((variant) => {
      const code = normalizeStoreSelectionIdentity(variant.sku);
      const name = normalizeStoreSelectionIdentity(variant.name);
      const child = (code ? childByCode.get(code) : undefined) || childByName.get(name);
      const childImage = child
        ? [...parseSelectionProductImages(child.images), ...parseSelectionProductImages(child.detailImages)][0] || ""
        : "";
      return {
        platformSkuId: String(variant.sku || "").trim(),
        skuCode: String(variant.sku || "").trim(),
        barcode: String(child?.barcode || "").trim(),
        variantName: variant.name.trim(),
        salePrice: variant.price,
        stock: selectionStockToMallStock(variant.stock),
        status: variant.isActive === "yes" ? "active" : "inactive",
        imageUrl: childImage,
        imageKey: "",
      };
    }),
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
