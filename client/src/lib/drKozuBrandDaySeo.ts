import { useLayoutEffect } from "react";

export const DRKOZU_BRAND_DAY_TITLE = "Dr.Kozu BRAND DAY 2026 | 50% OFF";
export const DRKOZU_BRAND_DAY_DESCRIPTION = "Dr.Kozu BRAND DAY 2026。対象商品をTikTok LIVEで紹介し、確認済みの有効GMVでランキングに挑戦するクリエイター向け公式イベントページです。";
export const DRKOZU_BRAND_DAY_ICON_PATH = "/brand-day/drkozu/drkozu-logo.webp";
export const DRKOZU_BRAND_DAY_IMAGE_PATH = "/brand-day/drkozu/drkozu-hero.webp";

const DEFAULT_TITLE = "LCJ MALL - TikTok Shopで買う。そのすべてが、価値になる。";
const DEFAULT_META_VALUES = [
  ['meta[name="description"]', "LCJ Mallは、TikTok Shopで購入したすべての商品を対象に、ポイントが貯まり、LCJモールで使えるLCJ公式ショッピングサービスです。購入金額の1%還元。"],
  ['meta[property="og:title"]', DEFAULT_TITLE],
  ['meta[property="og:description"]', "TikTok Shopで購入したすべての商品がポイント対象。購入金額の1%還元でお得にショッピング。"],
  ['meta[property="og:site_name"]', "LCJ MALL"],
  ['meta[name="twitter:title"]', DEFAULT_TITLE],
  ['meta[name="twitter:description"]', "TikTok Shopで購入したすべての商品がポイント対象。購入金額の1%還元。"],
  ['meta[name="keywords"]', "LCJ MALL, lcjモール, ポイ活, レシート副業, TikTok Shop, ライブコマース, ポイント還元, 美容, シャンプー, KYOGOKU"],
  ['meta[name="theme-color"]', "#f43f5e"],
] as const;

const DRKOZU_META_VALUES = [
  ['meta[name="description"]', DRKOZU_BRAND_DAY_DESCRIPTION],
  ['meta[property="og:title"]', DRKOZU_BRAND_DAY_TITLE],
  ['meta[property="og:description"]', DRKOZU_BRAND_DAY_DESCRIPTION],
  ['meta[property="og:site_name"]', "Dr.Kozu BRAND DAY"],
  ['meta[name="twitter:title"]', DRKOZU_BRAND_DAY_TITLE],
  ['meta[name="twitter:description"]', DRKOZU_BRAND_DAY_DESCRIPTION],
  ['meta[name="keywords"]', "Dr.Kozu, BRAND DAY, TikTok LIVE, ライブコマース, GMVランキング, 美容, スキンケア"],
  ['meta[name="theme-color"]', "#a20d21"],
] as const;

function defaultIconHref(element: HTMLLinkElement): string {
  if (element.rel === "apple-touch-icon") return "/apple-touch-icon.png";
  if (element.sizes.value === "32x32") return "/favicon-32x32.png";
  if (element.sizes.value === "16x16") return "/favicon-16x16.png";
  if (element.type === "image/x-icon") return "/favicon.ico";
  return "/favicon.svg";
}

function ensureOwnedImageMeta(property: "og:image" | "twitter:image", content: string) {
  const attribute = property.startsWith("og:") ? "property" : "name";
  let element = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${property}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, property);
    document.head.appendChild(element);
  }
  element.dataset.drkozuBrandDay = "true";
  element.content = content;
}

function applyDrKozuBranding(enabled: boolean) {
  const values = enabled ? DRKOZU_META_VALUES : DEFAULT_META_VALUES;
  document.title = enabled ? DRKOZU_BRAND_DAY_TITLE : DEFAULT_TITLE;
  values.forEach(([selector, value]) => {
    const element = document.querySelector<HTMLMetaElement>(selector);
    if (element) element.content = value;
  });

  const currentUrl = `${window.location.origin}${window.location.pathname}`;
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = currentUrl;
  const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = currentUrl;

  const iconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]'));
  iconLinks.forEach(element => element.setAttribute("href", enabled ? DRKOZU_BRAND_DAY_ICON_PATH : defaultIconHref(element)));

  if (enabled) {
    const imageUrl = `${window.location.origin}${DRKOZU_BRAND_DAY_IMAGE_PATH}`;
    ensureOwnedImageMeta("og:image", imageUrl);
    ensureOwnedImageMeta("twitter:image", imageUrl);
  } else {
    document.querySelectorAll('meta[data-drkozu-brand-day="true"]').forEach(element => element.remove());
  }
}

/**
 * Keeps the Dr.Kozu participant flow independent from the host application's
 * browser metadata and always resets to the host defaults on navigation away.
 * The server applies the same Dr.Kozu values to the first HTML response.
 */
export function useDrKozuBrandDaySeo(enabled: boolean) {
  useLayoutEffect(() => {
    applyDrKozuBranding(enabled);
    return () => applyDrKozuBranding(false);
  }, [enabled]);
}
