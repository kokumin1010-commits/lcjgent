export function buildActiveStoreIdsByBrand(
  stores: Array<Record<string, any>>,
): Map<number, Set<number>> {
  const result = new Map<number, Set<number>>();
  for (const store of stores) {
    const storeId = Number(store.id);
    if (!Number.isSafeInteger(storeId) || storeId <= 0) continue;
    const brandIds = Array.isArray(store.brandIds)
      ? [...new Set(store.brandIds.map(Number))].filter(
          value => Number.isSafeInteger(value) && value > 0
        )
      : [];
    for (const brandId of brandIds) {
      const storeIds = result.get(brandId) || new Set<number>();
      storeIds.add(storeId);
      result.set(brandId, storeIds);
    }
  }
  return result;
}

export function canUseUnallocatedBrandMetrics(
  storeBrandIds: number[],
  activeStoreIdsByBrand: Map<number, Set<number>>
): boolean {
  if (storeBrandIds.length !== 1) return false;
  return activeStoreIdsByBrand.get(Number(storeBrandIds[0]))?.size === 1;
}
