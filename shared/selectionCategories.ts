export type SelectionCategoryCatalogEntry = {
  catalogKey: string;
  name: string;
  nameCn: string;
  sortOrder: number;
};

export type ExistingSelectionCategory = {
  id: number;
  name: string;
  nameCn?: string | null;
  parentId?: number | null;
  sortOrder?: number | null;
  catalogKey?: string | null;
};

export const DEFAULT_SELECTION_CATEGORIES: readonly SelectionCategoryCatalogEntry[] = [
  { catalogKey: "system-skincare", name: "スキンケア", nameCn: "护肤", sortOrder: 10 },
  { catalogKey: "system-haircare", name: "ヘアケア", nameCn: "洗护/护发", sortOrder: 20 },
  { catalogKey: "system-beauty-devices", name: "美容家電・ガジェット", nameCn: "美容仪器/小型电子产品", sortOrder: 30 },
  { catalogKey: "system-inner-care", name: "インナーケア・健康食品", nameCn: "内服美容/保健食品", sortOrder: 40 },
  { catalogKey: "system-body-care", name: "ボディケア", nameCn: "身体护理", sortOrder: 50 },
  { catalogKey: "system-makeup", name: "メイク・コスメ", nameCn: "彩妆/化妆品", sortOrder: 60 },
  { catalogKey: "system-beauty-accessories", name: "美容雑貨・ケア用品", nameCn: "美容周边/护理用品", sortOrder: 70 },
  { catalogKey: "system-fashion-innerwear", name: "ファッション・インナー", nameCn: "服饰/内衣", sortOrder: 80 },
  { catalogKey: "system-kitchen-household", name: "キッチン・生活雑貨", nameCn: "厨房/生活用品", sortOrder: 90 },
  { catalogKey: "system-health-wellness", name: "健康・ウェルネス", nameCn: "健康/养生", sortOrder: 100 },
  { catalogKey: "system-food-beverage", name: "食品・飲料", nameCn: "食品/饮料", sortOrder: 110 },
  { catalogKey: "system-daily-necessities", name: "日用品", nameCn: "日常用品", sortOrder: 120 },
  { catalogKey: "system-baby-kids", name: "ベビー・キッズ", nameCn: "母婴/儿童", sortOrder: 130 },
  { catalogKey: "system-pet-supplies", name: "ペット用品", nameCn: "宠物用品", sortOrder: 140 },
  { catalogKey: "system-other", name: "その他", nameCn: "其他", sortOrder: 150 },
] as const;

function normalizedCategoryName(value: string) {
  return value.normalize("NFKC").trim();
}

const LEGACY_SYSTEM_CATEGORY_IDS = new Map<string, number>([
  ["system-skincare", 1],
  ["system-haircare", 2],
  ["system-beauty-devices", 3],
]);

export function planDefaultSelectionCategories(existing: ExistingSelectionCategory[]) {
  const byCatalogKey = new Map(
    existing
      .filter(category => category.catalogKey)
      .map(category => [category.catalogKey, category]),
  );
  const inserts: SelectionCategoryCatalogEntry[] = [];
  const updates: Array<SelectionCategoryCatalogEntry & { id: number }> = [];

  for (const category of DEFAULT_SELECTION_CATEGORIES) {
    const legacyId = LEGACY_SYSTEM_CATEGORY_IDS.get(category.catalogKey);
    const legacyCategory = legacyId === undefined
      ? undefined
      : existing.find(current => (
          current.id === legacyId
          && !current.catalogKey
          && (current.parentId === null || current.parentId === undefined)
          && normalizedCategoryName(current.name) === normalizedCategoryName(category.name)
        ));
    const current = byCatalogKey.get(category.catalogKey)
      ?? legacyCategory;
    if (!current) {
      inserts.push(category);
      continue;
    }
    if (
      current.catalogKey !== category.catalogKey
      || normalizedCategoryName(current.name) !== normalizedCategoryName(category.name)
      || current.nameCn?.trim() !== category.nameCn
      || current.parentId !== null
      || current.sortOrder !== category.sortOrder
    ) {
      updates.push({ id: current.id, ...category });
    }
  }

  return { inserts, updates };
}

export function formatSelectionCategoryLabel(
  category: Pick<ExistingSelectionCategory, "name" | "nameCn">,
  parent?: Pick<ExistingSelectionCategory, "name" | "nameCn"> | null,
) {
  const formatOne = (item: Pick<ExistingSelectionCategory, "name" | "nameCn">) => (
    item.nameCn?.trim() ? `${item.name} — ${item.nameCn.trim()}` : item.name
  );
  return parent ? `${formatOne(parent)} / ${formatOne(category)}` : formatOne(category);
}
