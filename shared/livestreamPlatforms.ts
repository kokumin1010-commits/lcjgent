export const LIVESTREAM_PLATFORM_VALUES = [
  "TikTok",
  "Shopee",
  "Instagram",
  "YouTube",
  "Amazon Live",
  "淘宝直播",
  "京东直播",
  "快手直播",
  "楽天ライブ",
  "Other",
] as const;

export type LivestreamPlatform = (typeof LIVESTREAM_PLATFORM_VALUES)[number];

export const DEFAULT_LIVESTREAM_PLATFORM: LivestreamPlatform = "TikTok";

export const LIVESTREAM_PLATFORM_LABELS: Record<
  LivestreamPlatform,
  { ja: string; "zh-TW": string; en: string; zh: string }
> = {
  TikTok: {
    ja: "TikTok Shop",
    "zh-TW": "TikTok Shop",
    en: "TikTok Shop",
    zh: "TikTok Shop",
  },
  Shopee: {
    ja: "Shopee Live",
    "zh-TW": "蝦皮直播（Shopee Live）",
    en: "Shopee Live",
    zh: "虾皮直播（Shopee Live）",
  },
  Instagram: {
    ja: "Instagram Live",
    "zh-TW": "Instagram Live",
    en: "Instagram Live",
    zh: "Instagram Live",
  },
  YouTube: {
    ja: "YouTube Live",
    "zh-TW": "YouTube Live",
    en: "YouTube Live",
    zh: "YouTube Live",
  },
  "Amazon Live": {
    ja: "Amazon Live",
    "zh-TW": "Amazon Live",
    en: "Amazon Live",
    zh: "Amazon Live",
  },
  淘宝直播: {
    ja: "淘宝ライブ",
    "zh-TW": "淘寶直播",
    en: "Taobao Live",
    zh: "淘宝直播",
  },
  京东直播: {
    ja: "京東ライブ",
    "zh-TW": "京東直播",
    en: "JD Live",
    zh: "京东直播",
  },
  快手直播: {
    ja: "快手ライブ",
    "zh-TW": "快手直播",
    en: "Kuaishou Live",
    zh: "快手直播",
  },
  楽天ライブ: {
    ja: "楽天ライブ",
    "zh-TW": "樂天直播",
    en: "Rakuten Live",
    zh: "乐天直播",
  },
  Other: {
    ja: "その他",
    "zh-TW": "其他平台",
    en: "Other platform",
    zh: "其他平台",
  },
};

export function isLivestreamPlatform(
  value: unknown
): value is LivestreamPlatform {
  return (
    typeof value === "string" &&
    (LIVESTREAM_PLATFORM_VALUES as readonly string[]).includes(value)
  );
}

export function normalizeLivestreamPlatform(
  value: unknown
): LivestreamPlatform {
  if (!value || value === "TikTok Shop") return DEFAULT_LIVESTREAM_PLATFORM;
  if (value === "Shopee Live" || value === "虾皮直播" || value === "蝦皮直播")
    return "Shopee";
  return isLivestreamPlatform(value) ? value : DEFAULT_LIVESTREAM_PLATFORM;
}

export function getLivestreamPlatformLabel(
  platform: LivestreamPlatform,
  language: "ja" | "zh-TW" | "en" | "zh"
): string {
  return LIVESTREAM_PLATFORM_LABELS[platform][language];
}
