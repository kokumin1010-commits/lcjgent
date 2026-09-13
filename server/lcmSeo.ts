import type { Express, Request, Response, NextFunction } from "express";
import { and, desc, eq } from "drizzle-orm";
import { lcmBrandProfiles, lcmProducts } from "../drizzle/lcmSchema";
import { lcf2026ExhibitorCatalogPages } from "../client/src/data/lcf2026ExhibitorCatalog";
import { getDb } from "./db";

const ORIGIN = "https://www.livecommercefestival.com";
const FALLBACK_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/BLOPdduPHOZbYSVM.jpg";
const BOT_PATTERN = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|chatgpt|gptbot|claudebot|perplexity|anthropic|linebot|linespider|slackbot|discordbot|redditbot|embedly|pinterest/i;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

async function serveSpaWithMeta(res: Response, next: NextFunction, meta: { title: string; description: string; pageUrl: string; image: string; jsonLd: unknown }) {
  const fs = await import("fs");
  const path = await import("path");
  const distPath = process.env.NODE_ENV === "development"
    ? path.default.resolve(import.meta.dirname, "..", "client", "index.html")
    : path.default.resolve(import.meta.dirname, "public", "index.html");
  let html = "";
  try { html = fs.default.readFileSync(distPath, "utf-8"); } catch { return next(); }
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
  html = html.replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${escapeHtml(meta.description)}" />`);
  html = html.replace(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
  html = html.replace(/<meta property="og:description"[^>]*\/>/, `<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
  html = html.replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${meta.pageUrl}" />`);
  html = html.replace(/<meta property="og:site_name"[^>]*\/>/, `<meta property="og:site_name" content="LCM｜ライブコマースマーケット" />`);
  html = html.replace(/<meta name="twitter:title"[^>]*\/>/, `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`);
  html = html.replace(/<meta name="twitter:description"[^>]*\/>/, `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`);
  html = html.replace(/<meta name="twitter:card"[^>]*\/>/, `<meta name="twitter:card" content="summary_large_image" />\n    <meta property="og:image" content="${meta.image}" />\n    <meta name="twitter:image" content="${meta.image}" />`);
  html = html.replace(/<link rel="canonical"[^>]*\/>/, `<link rel="canonical" href="${meta.pageUrl}" />`);
  html = html.replace(/<\/head>/, `    <script type="application/ld+json">${safeJson(meta.jsonLd)}</script>\n  </head>`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  return res.send(html);
}

export function registerLcmSeoRoutes(app: Express) {
  app.get(["/lcm", "/lcm/brands/:slug", "/lcm/products/:slug"], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = await getDb();
      const brandSlug = req.path.startsWith("/lcm/brands/") ? req.params.slug : null;
      const productSlug = req.path.startsWith("/lcm/products/") ? req.params.slug : null;
      let title = "LCM｜ライブコマースマーケット｜ブランド・商品・サンプル・卸商談";
      let description = "ライブコマース向けの商品とブランドを探せるB2Bマーケット。出展企業の商品、サンプル受付、会員限定卸条件、商談窓口を一つの場所で確認できます。";
      let image = FALLBACK_IMAGE;
      let pageUrl = `${ORIGIN}/lcm`;
      let heading = "ライブコマースの商品とブランドが集まるB2Bマーケット";
      let body = "ブランドと商品を探し、サンプルや卸商談へ進めます。卸条件は承認済み会員だけに表示されます。";
      let jsonLd: unknown = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "LCM｜ライブコマースマーケット", description, url: pageUrl, inLanguage: "ja" }, { "@context": "https://schema.org", "@type": "Organization", name: "LIVE COMMERCE FESTIVAL", url: `${ORIGIN}/` }];

      if (brandSlug) {
        const [brand] = db ? await db.select().from(lcmBrandProfiles).where(and(eq(lcmBrandProfiles.slug, brandSlug), eq(lcmBrandProfiles.status, "published"))).limit(1) : [];
        if (brand) {
          title = `${brand.displayName}｜LCM ブランドページ`;
          description = (brand.description || brand.tagline || `${brand.displayName}の商品・ライブコマース情報、サンプル・卸商談窓口を掲載しています。`).slice(0, 160);
          image = brand.coverUrl || brand.logoUrl || FALLBACK_IMAGE;
          pageUrl = `${ORIGIN}/lcm/brands/${brand.slug}`;
          heading = brand.displayName;
          body = [brand.tagline, brand.description, brand.category].filter(Boolean).join("。 ");
          jsonLd = [{ "@context": "https://schema.org", "@type": "Brand", name: brand.displayName, description, url: pageUrl, logo: brand.logoUrl || undefined, image }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "LCM", item: `${ORIGIN}/lcm` }, { "@type": "ListItem", position: 2, name: brand.displayName, item: pageUrl }] }];
        } else {
          const pageNumber = Number(/^catalog-(\d+)$/.exec(brandSlug)?.[1] || 0);
          const page = lcf2026ExhibitorCatalogPages.find((entry) => entry.page === pageNumber && entry.pageType === "出展企業紹介");
          if (!page) return next();
          title = `${page.name}｜LCM ライブコマースマーケット`;
          description = `${page.name}のLCF 2026出展アーカイブ。${page.productTitle || page.pickupProduct || "掲載商品"}の紙面情報を確認できます。`.slice(0, 160);
          image = page.imageUrl || FALLBACK_IMAGE;
          pageUrl = `${ORIGIN}/lcm/brands/catalog-${page.page}`;
          heading = page.name;
          body = [page.category, page.productTitle, page.highlights, page.message].filter(Boolean).join("。 ");
          jsonLd = [{ "@context": "https://schema.org", "@type": "Organization", name: page.name, description, url: pageUrl, image }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "LCM", item: `${ORIGIN}/lcm` }, { "@type": "ListItem", position: 2, name: page.name, item: pageUrl }] }];
        }
      } else if (productSlug) {
        if (!db) return next();
        const [row] = await db.select({ product: lcmProducts, brandName: lcmBrandProfiles.displayName, brandSlug: lcmBrandProfiles.slug }).from(lcmProducts).innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id)).where(and(eq(lcmProducts.slug, productSlug), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published"))).limit(1);
        if (!row) return next();
        const product = row.product;
        title = `${product.name}｜${row.brandName}｜LCM`;
        description = (product.summary || product.description || `${row.brandName}の${product.name}。ライブコマース向けの商品情報、サンプル・卸商談条件を確認できます。`).slice(0, 160);
        image = product.primaryImageUrl || FALLBACK_IMAGE;
        pageUrl = `${ORIGIN}/lcm/products/${product.slug}`;
        heading = product.name;
        body = [row.brandName, product.category, product.summary, product.description].filter(Boolean).join("。 ");
        jsonLd = [{ "@context": "https://schema.org", "@type": "Product", name: product.name, description, image: [image], brand: { "@type": "Brand", name: row.brandName }, url: pageUrl }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "LCM", item: `${ORIGIN}/lcm` }, { "@type": "ListItem", position: 2, name: row.brandName, item: `${ORIGIN}/lcm/brands/${row.brandSlug}` }, { "@type": "ListItem", position: 3, name: product.name, item: pageUrl }] }];
      }

      if (!BOT_PATTERN.test(String(req.headers["user-agent"] || "").toLowerCase())) return serveSpaWithMeta(res, next, { title, description, pageUrl, image, jsonLd });
      const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"><link rel="canonical" href="${pageUrl}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${pageUrl}"><meta property="og:image" content="${image}"><meta property="og:site_name" content="LCM｜ライブコマースマーケット"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${safeJson(jsonLd)}</script></head><body><header><a href="${ORIGIN}/lcm">LCM｜ライブコマースマーケット</a></header><main><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(body)}</p><nav><a href="${ORIGIN}/lcm">商品を探す</a><a href="${ORIGIN}/livecommercefestival/2026/exhibitors">第1回出展企業を見る</a></nav></main></body></html>`;
      return res.status(200).set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" }).send(html);
    } catch (error) {
      console.error("[LCM SEO] route error", error);
      return next();
    }
  });
}

export async function getLcmSitemapEntries(baseUrl: string, lastmod: string): Promise<string[]> {
  const entries = [
    `  <url>\n    <loc>${baseUrl}/lcm</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n    <image:image><image:loc>${FALLBACK_IMAGE}</image:loc><image:title>LCM ライブコマースマーケット</image:title></image:image>\n  </url>`,
    ...lcf2026ExhibitorCatalogPages.filter((page) => page.pageType === "出展企業紹介").map((page) => `  <url>\n    <loc>${baseUrl}/lcm/brands/catalog-${page.page}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n    <image:image><image:loc>${escapeHtml(page.imageUrl)}</image:loc><image:title>${escapeHtml(page.name)}</image:title></image:image>\n  </url>`),
  ];
  try {
    const db = await getDb();
    if (!db) return entries;
    const brands = await db.select({ slug: lcmBrandProfiles.slug, name: lcmBrandProfiles.displayName, image: lcmBrandProfiles.coverUrl, updatedAt: lcmBrandProfiles.updatedAt }).from(lcmBrandProfiles).where(eq(lcmBrandProfiles.status, "published")).orderBy(desc(lcmBrandProfiles.updatedAt)).limit(500);
    const products = await db.select({ slug: lcmProducts.slug, name: lcmProducts.name, image: lcmProducts.primaryImageUrl, updatedAt: lcmProducts.updatedAt }).from(lcmProducts).where(eq(lcmProducts.status, "published")).orderBy(desc(lcmProducts.updatedAt)).limit(1000);
    for (const brand of brands) entries.push(`  <url>\n    <loc>${baseUrl}/lcm/brands/${encodeURIComponent(brand.slug)}</loc>\n    <lastmod>${new Date(brand.updatedAt || lastmod).toISOString().split("T")[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>${brand.image ? `\n    <image:image><image:loc>${escapeHtml(brand.image)}</image:loc><image:title>${escapeHtml(brand.name)}</image:title></image:image>` : ""}\n  </url>`);
    for (const product of products) entries.push(`  <url>\n    <loc>${baseUrl}/lcm/products/${encodeURIComponent(product.slug)}</loc>\n    <lastmod>${new Date(product.updatedAt || lastmod).toISOString().split("T")[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>${product.image ? `\n    <image:image><image:loc>${escapeHtml(product.image)}</image:loc><image:title>${escapeHtml(product.name)}</image:title></image:image>` : ""}\n  </url>`);
  } catch (error) {
    console.warn("[LCM Sitemap] dynamic entries unavailable", error);
  }
  return entries;
}
