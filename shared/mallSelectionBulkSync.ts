import {
  collectSelectionProductImportVariants,
  parseSelectionProductImages,
  selectionMoneyToMallYen,
  selectionStockToMallStock,
  type SelectionProductImportSource,
} from "./mallSelectionProductImport";

export type MallBulkSyncSource = SelectionProductImportSource & {
  id: number;
  parentProductId?: number | string | null;
  deletedAt?: unknown;
};

export type MallBulkSyncExisting = {
  id: number;
  name: string;
  selectionProductId?: number | string | null;
};

export type MallBulkSyncSkipReason =
  | "already_mapped"
  | "mall_name_conflict"
  | "source_name_conflict"
  | "invalid_name";

export type MallBulkSyncPlan = {
  sourceParentCount: number;
  mallProductCount: number;
  readySourceIds: number[];
  counts: {
    ready: number;
    alreadyMapped: number;
    mallNameConflict: number;
    sourceNameConflict: number;
    invalidName: number;
    missingPositivePrice: number;
    missingImage: number;
    missingBrand: number;
    missingCategory: number;
    missingDescription: number;
    zeroStock: number;
    withSku: number;
  };
  reasonBySourceId: Map<number, MallBulkSyncSkipReason>;
};

export function normalizeMallBulkSyncName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\-_/・･,，.。()（）[\]【】「」『』]+/g, "")
    .trim();
}

export function mallBulkSyncSourceName(source: SelectionProductImportSource): string {
  return String(source.productName || source.productNameCn || "").trim();
}

export function mallBulkSyncSourceKeys(source: SelectionProductImportSource): string[] {
  return [...new Set([
    normalizeMallBulkSyncName(source.productName),
    normalizeMallBulkSyncName(source.productNameCn),
  ].filter(Boolean))];
}

function hasText(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

export function planMallSelectionBulkSync(
  sources: MallBulkSyncSource[],
  mallProducts: MallBulkSyncExisting[],
): MallBulkSyncPlan {
  const parents = sources
    .filter((source) => source.parentProductId === null || source.parentProductId === undefined || source.parentProductId === 0 || source.parentProductId === "0" || source.parentProductId === "")
    .sort((left, right) => Number(left.id) - Number(right.id));

  const mappedSourceIds = new Set(
    mallProducts
      .map((product) => Number(product.selectionProductId))
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  );
  const mallNames = new Set(
    mallProducts.map((product) => normalizeMallBulkSyncName(product.name)).filter(Boolean),
  );
  const keysBySourceId = new Map<number, string[]>();
  const sourceKeyCounts = new Map<string, number>();
  for (const source of parents) {
    const sourceId = Number(source.id);
    const keys = mallBulkSyncSourceKeys(source);
    keysBySourceId.set(sourceId, keys);
    for (const key of keys) sourceKeyCounts.set(key, (sourceKeyCounts.get(key) || 0) + 1);
  }

  const readySources: MallBulkSyncSource[] = [];
  const reasonBySourceId = new Map<number, MallBulkSyncSkipReason>();
  for (const source of parents) {
    const sourceId = Number(source.id);
    const keys = keysBySourceId.get(sourceId) || [];
    let reason: MallBulkSyncSkipReason | null = null;
    if (mappedSourceIds.has(sourceId)) reason = "already_mapped";
    else if (keys.length === 0) reason = "invalid_name";
    else if (keys.some((key) => mallNames.has(key))) reason = "mall_name_conflict";
    else if (keys.some((key) => (sourceKeyCounts.get(key) || 0) > 1)) reason = "source_name_conflict";

    if (reason) reasonBySourceId.set(sourceId, reason);
    else readySources.push(source);
  }

  const reasonCount = (reason: MallBulkSyncSkipReason) =>
    [...reasonBySourceId.values()].filter((value) => value === reason).length;

  return {
    sourceParentCount: parents.length,
    mallProductCount: mallProducts.length,
    readySourceIds: readySources.map((source) => Number(source.id)),
    counts: {
      ready: readySources.length,
      alreadyMapped: reasonCount("already_mapped"),
      mallNameConflict: reasonCount("mall_name_conflict"),
      sourceNameConflict: reasonCount("source_name_conflict"),
      invalidName: reasonCount("invalid_name"),
      missingPositivePrice: readySources.filter((source) => selectionMoneyToMallYen(source.price) === 0).length,
      missingImage: readySources.filter((source) => parseSelectionProductImages(source.images).length === 0).length,
      missingBrand: readySources.filter((source) => !Number.isSafeInteger(Number(source.brandId)) || Number(source.brandId) <= 0).length,
      missingCategory: readySources.filter((source) => !hasText(source.categoryName)).length,
      missingDescription: readySources.filter((source) => !hasText(source.description) && !hasText(source.sellingPoints)).length,
      zeroStock: readySources.filter((source) => selectionStockToMallStock(source.stock) === 0).length,
      withSku: readySources.filter((source) => collectSelectionProductImportVariants(source).length > 0).length,
    },
    reasonBySourceId,
  };
}
