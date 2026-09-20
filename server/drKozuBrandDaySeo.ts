import type { Express, NextFunction, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { injectPageMeta, resolveRequestBaseUrl } from "./_core/vite";

export const DRKOZU_BRAND_DAY_PATH_PREFIX = "/brand-day/kozuday";
export const DRKOZU_BRAND_DAY_TITLE = "Dr.Kozu BRAND DAY 2026 | 50% OFF";
export const DRKOZU_BRAND_DAY_DESCRIPTION = "Dr.Kozu BRAND DAY 2026。対象商品をTikTok LIVEで紹介し、確認済みの有効GMVでランキングに挑戦するクリエイター向け公式イベントページです。";
const DRKOZU_BRAND_DAY_SITE_NAME = "Dr.Kozu BRAND DAY";
const DRKOZU_BRAND_DAY_IMAGE_PATH = "/brand-day/drkozu/drkozu-hero.webp";
const DRKOZU_BRAND_DAY_ICON_PATH = "/brand-day/drkozu/drkozu-logo.webp";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isDrKozuBrandDayPath(pathname: string): boolean {
  return pathname === DRKOZU_BRAND_DAY_PATH_PREFIX
    || pathname === `${DRKOZU_BRAND_DAY_PATH_PREFIX}/`
    || pathname.startsWith(`${DRKOZU_BRAND_DAY_PATH_PREFIX}/`);
}

export function brandDrKozuSpaHtml(html: string, origin: string, pathname: string): string {
  const pageUrl = `${origin}${pathname}`;
  const imageUrl = `${origin}${DRKOZU_BRAND_DAY_IMAGE_PATH}`;
  const title = escapeHtml(DRKOZU_BRAND_DAY_TITLE);
  const description = escapeHtml(DRKOZU_BRAND_DAY_DESCRIPTION);

  let result = injectPageMeta(html, pathname, origin)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"[^>]*\/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`)
    .replace(/<meta property="og:site_name"[^>]*\/>/, `<meta property="og:site_name" content="${DRKOZU_BRAND_DAY_SITE_NAME}" />`)
    .replace(/<meta name="twitter:title"[^>]*\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description"[^>]*\/>/, `<meta name="twitter:description" content="${description}" />`)
    .replace(/<meta name="keywords"[^>]*\/>/, '<meta name="keywords" content="Dr.Kozu, BRAND DAY, TikTok LIVE, ライブコマース, GMVランキング, 美容, スキンケア" />')
    .replace(/<meta name="theme-color"[^>]*\/>/, '<meta name="theme-color" content="#a20d21" />')
    .replace(/<meta name="msapplication-TileColor"[^>]*\/>/, '<meta name="msapplication-TileColor" content="#a20d21" />')
    .replace(/<link rel="canonical"[^>]*\/>/, `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`)
    .replace(/(<link rel="icon"[^>]*href=")[^"]*("[^>]*\/>)/g, `$1${DRKOZU_BRAND_DAY_ICON_PATH}$2`)
    .replace(/(<link rel="apple-touch-icon"[^>]*href=")[^"]*("[^>]*\/>)/, `$1${DRKOZU_BRAND_DAY_ICON_PATH}$2`)
    .replace('id="app-boot-mark"', 'id="app-boot-mark" aria-label="Dr.Kozu"')
    .replace(/(<div id="app-boot-mark"[^>]*>)[^<]*(<\/div>)/, "$1DR$2")
    .replace(/(<div id="app-boot-title"[^>]*>)[^<]*(<\/div>)/, "$1Dr.Kozu BRAND DAYを読み込んでいます$2");

  result = result.replace(
    /<meta name="twitter:card"[^>]*\/>/,
    `<meta name="twitter:card" content="summary_large_image" />\n    <meta property="og:image" content="${escapeHtml(imageUrl)}" data-drkozu-brand-day="true" />\n    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" data-drkozu-brand-day="true" />`,
  );
  return result;
}

export function registerDrKozuBrandDaySeoRoutes(app: Express): void {
  app.get(/^\/brand-day\/kozuday(?:\/.*)?$/, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const distPath = process.env.NODE_ENV === "development"
        ? path.resolve(import.meta.dirname, "../..", "client", "index.html")
        : path.resolve(import.meta.dirname, "public", "index.html");
      const html = fs.readFileSync(distPath, "utf-8");
      const origin = resolveRequestBaseUrl(req).replace(/\/$/, "");
      const pathname = req.path || DRKOZU_BRAND_DAY_PATH_PREFIX;
      const branded = brandDrKozuSpaHtml(html, origin, pathname);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      return res.send(branded);
    } catch (error) {
      console.error("[DrKozuBrandDaySeo] failed to serve dedicated page metadata", error);
      return next();
    }
  });
}
