/**
 * LCM catalogue linkage contract: immutable archive page identities grouped by company and brand.
 * Unknown legal entities deliberately use the published name instead of an inferred company name.
 */
export type LcmCatalogIdentity = {
  page: number;
  companyName: string;
  brandName: string;
  primaryBrandPage: number;
};

export const lcmCatalogIdentities: readonly LcmCatalogIdentity[] = [
  { page: 4, companyName: "株式会社シンビシン", brandName: "シンビシン", primaryBrandPage: 4 },
  { page: 5, companyName: "株式会社Pixie", brandName: "CARiNOショップ", primaryBrandPage: 5 },
  { page: 6, companyName: "アジア国際貿易株式会社", brandName: "CHEYENNE", primaryBrandPage: 6 },
  { page: 7, companyName: "アジア国際貿易株式会社", brandName: "FenaturuKP", primaryBrandPage: 7 },
  { page: 8, companyName: "株式会社アメニティコーポレーション", brandName: "SCボーテ", primaryBrandPage: 8 },
  { page: 9, companyName: "Naturecan", brandName: "Naturecan", primaryBrandPage: 9 },
  { page: 10, companyName: "ハンブラザーズ株式会社", brandName: "Plamine", primaryBrandPage: 10 },
  { page: 11, companyName: "SH-RD Beauty株式会社", brandName: "SH-RD", primaryBrandPage: 11 },
  { page: 12, companyName: "Sakura forest Co., Ltd.", brandName: "My+Cee", primaryBrandPage: 12 },
  { page: 13, companyName: "Sakura forest Co., Ltd.", brandName: "INSITU", primaryBrandPage: 13 },
  { page: 14, companyName: "NEXTEP Co., Ltd.", brandName: "FONEWLEV JAPAN", primaryBrandPage: 14 },
  { page: 15, companyName: "株式会社イロンジャパン", brandName: "TANGI", primaryBrandPage: 15 },
  { page: 16, companyName: "韓美グループ株式会社", brandName: "HUTEM CELL", primaryBrandPage: 16 },
  { page: 17, companyName: "株式会社逸心", brandName: "逸心", primaryBrandPage: 17 },
  { page: 18, companyName: "Naturecan", brandName: "Naturecan", primaryBrandPage: 9 },
  { page: 19, companyName: "株式会社Tabasquihy", brandName: "猫肉球シリーズ", primaryBrandPage: 19 },
  { page: 20, companyName: "K BEAUTY SHOP", brandName: "K BEAUTY SHOP", primaryBrandPage: 20 },
  { page: 21, companyName: "株式会社LADDER", brandName: "P3", primaryBrandPage: 21 },
  { page: 22, companyName: "Mellia株式会社", brandName: "I'm La Floria", primaryBrandPage: 22 },
  { page: 23, companyName: "Mellia株式会社", brandName: "I'm La Floria", primaryBrandPage: 22 },
  { page: 24, companyName: "株式会社オールペア", brandName: "CLINIC LE GINZA", primaryBrandPage: 24 },
  { page: 25, companyName: "株式会社オールペア", brandName: "LIORA BELLE", primaryBrandPage: 25 },
  { page: 26, companyName: "株式会社北の達人コーポレーション", brandName: "北の快適工房", primaryBrandPage: 26 },
  { page: 27, companyName: "La Bella株式会社", brandName: "CICIBELLA", primaryBrandPage: 27 },
  { page: 28, companyName: "LABO CELLÉ", brandName: "LABO CELLÉ", primaryBrandPage: 28 },
  { page: 29, companyName: "KYOGOKU JAPAN", brandName: "KYOGOKU", primaryBrandPage: 29 },
  { page: 30, companyName: "Dr.Tetsu", brandName: "Dr.Tetsu", primaryBrandPage: 30 },
  { page: 31, companyName: "Dr.Kozu", brandName: "Dr.Kozu", primaryBrandPage: 31 },
  { page: 32, companyName: "株式会社チュチュル", brandName: "女王様のすごいシリーズ", primaryBrandPage: 32 },
] as const;

export function normalizeLcmCatalogName(value: string): string {
  return value.normalize("NFKC").replace(/[\s・･／/()（）._-]+/g, "").toLowerCase();
}

export function getLcmCatalogIdentity(page: number): LcmCatalogIdentity | undefined {
  return lcmCatalogIdentities.find((item) => item.page === page);
}

export function getLcmCatalogBrandPages(primaryBrandPage: number): number[] {
  return lcmCatalogIdentities
    .filter((item) => item.primaryBrandPage === primaryBrandPage)
    .map((item) => item.page);
}

export function getLcmCatalogCompanyBrands(companyName: string): LcmCatalogIdentity[] {
  const normalized = normalizeLcmCatalogName(companyName);
  const primaryPages = new Set<number>();
  return lcmCatalogIdentities.filter((item) => {
    if (normalizeLcmCatalogName(item.companyName) !== normalized) return false;
    if (primaryPages.has(item.primaryBrandPage)) return false;
    primaryPages.add(item.primaryBrandPage);
    return item.page === item.primaryBrandPage;
  });
}
