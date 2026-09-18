export const DRKOZU_BRAND_DAY_SLUG = "kozuday";

export const DRKOZU_BRAND_DAY_PROFILE = {
  slug: DRKOZU_BRAND_DAY_SLUG,
  title: "Dr.Kozu BRAND DAY",
  shortName: "Dr.Kozu BRAND DAY",
  subtitle: "プロのサロンケアを、ライブで毎日のホームケアへ。",
  challenge: "THE QUINTESSENCE OF BEAUTY — LIVE CHALLENGE",
  discountLabel: "50% OFF",
  prizes: [100_000, 50_000, 30_000] as const,
  brandKeywords: [
    "Dr.Kozu",
    "Dr.kozu",
    "Dr Kozu",
    "Kozu",
    "コズ",
    "ヴァンパイアマスク",
    "セルピール",
    "ビューティソイプロテイン",
    "リペアクレンジング",
    "リペアクリアウォッシュ",
    "リペアセラム",
    "バランスジェル",
  ] as const,
} as const;

export function getBrandDayCampaignProfile(slug: string) {
  return slug === DRKOZU_BRAND_DAY_SLUG ? DRKOZU_BRAND_DAY_PROFILE : null;
}

export function brandDayPrizeForRank(slug: string, rankIndex: number) {
  const profile = getBrandDayCampaignProfile(slug);
  return profile?.prizes[rankIndex] ?? null;
}

export function resolveBrandDayKeywords(input: {
  slug: string;
  title: string;
  shortName: string;
  configuredKeywords?: unknown;
}) {
  const configured = Array.isArray(input.configuredKeywords)
    ? input.configuredKeywords.map(String)
    : [];
  const campaign = getBrandDayCampaignProfile(input.slug);
  return [...new Set([
    ...configured,
    input.title,
    input.shortName,
    ...(campaign?.brandKeywords ?? []),
  ].map(value => value.trim()).filter(Boolean))];
}
