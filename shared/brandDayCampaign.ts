export const DRKOZU_BRAND_DAY_SLUG = "kozuday";

export const DRKOZU_BRAND_DAY_PROFILE = {
  slug: DRKOZU_BRAND_DAY_SLUG,
  title: "Dr.Kozu BRAND DAY",
  shortName: "Dr.Kozu BRAND DAY",
  subtitle: "プロのサロンケアを、ライブで毎日のホームケアへ。",
  challenge: "THE QUINTESSENCE OF BEAUTY — LIVE CHALLENGE",
  discountLabel: "50% OFF",
  prizes: [100_000, 50_000, 30_000] as const,
  prizeTiers: [
    { minimumGmv: 1_000_000, prize: 100_000 },
    { minimumGmv: 500_000, prize: 50_000 },
    { minimumGmv: 300_000, prize: 30_000 },
  ] as const,
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

export function resolveBrandDayPrizeAwards(slug: string, rankedRows: Array<{ brandGmv: number }>) {
  const profile = getBrandDayCampaignProfile(slug);
  if (!profile) return rankedRows.map(() => null);

  const availableTiers = [...profile.prizeTiers];
  return rankedRows.map(row => {
    const tierIndex = availableTiers.findIndex(tier => row.brandGmv >= tier.minimumGmv);
    if (tierIndex < 0) return null;
    const [tier] = availableTiers.splice(tierIndex, 1);
    return tier.prize;
  });
}

function reachedAtValue(value: unknown) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = new Date(value as Date | string | number).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

export function sortBrandDaySalesRanking<T extends {
  brandGmv: number;
  streamMinutes: number;
  tiktokId: string;
  reachedAt?: unknown;
}>(rows: T[]) {
  return [...rows].sort((a, b) => (
    b.brandGmv - a.brandGmv
    || b.streamMinutes - a.streamMinutes
    || reachedAtValue(a.reachedAt) - reachedAtValue(b.reachedAt)
    || a.tiktokId.localeCompare(b.tiktokId)
  ));
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
