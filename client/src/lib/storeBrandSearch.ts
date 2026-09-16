export type StoreServiceBrandSearchRecord = {
  id: number | string;
  name?: string | null;
  nameJa?: string | null;
  companyName?: string | null;
  materialCategory?: string | null;
};

export function normalizeStoreBrandSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function getStoreServiceBrandLabel(brand: StoreServiceBrandSearchRecord): string {
  return String(brand.nameJa || brand.name || `Brand #${brand.id}`);
}

export function buildStoreBrandSearchValue(brand: StoreServiceBrandSearchRecord): string {
  return normalizeStoreBrandSearch([
    brand.nameJa,
    brand.name,
    brand.companyName,
    brand.materialCategory,
    brand.id,
  ].filter(Boolean).join(" "));
}

export function matchesStoreBrandSearch(value: string, query: string): boolean {
  const normalizedQuery = normalizeStoreBrandSearch(query);
  if (!normalizedQuery) return true;
  return normalizeStoreBrandSearch(value).includes(normalizedQuery);
}
