/**
 * SEO Monitor
 * Search Console APIと連携してブログ記事のSEO指標を記録・監視する
 * 
 * Phase 1: SEO監視
 * - indexed / not indexed 状態の取得
 * - impressions / clicks / CTR / avgPosition の記録
 * - 弱い記事（公開後30日でimpressions低・CTR低・未indexed）の抽出
 */

import { google } from "googleapis";
import { getDb } from "./db";
import {
  blogArticles,
  blogArticleSeoMetrics,
  blogArticleStats,
} from "../drizzle/schema";
import { eq, and, lte, gte, isNull, or } from "drizzle-orm";

// =============================================
// 定数
// =============================================

/** Search Console APIのスコープ */
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

/** 弱い記事の判定基準（公開後30日） */
const WEAK_ARTICLE_DAYS = 30;
const WEAK_IMPRESSION_THRESHOLD = 10;  // 30日でimpressions < 10
const WEAK_CTR_THRESHOLD = 0.01;       // CTR < 1%
const WEAK_POSITION_THRESHOLD = 50;    // 平均順位 > 50位

/** SEOチェック間隔（毎日1回） */
export const SEO_CHECK_INTERVAL_HOURS = 24;

// =============================================
// Search Console API クライアント
// =============================================

/**
 * Search Console APIクライアントを初期化する
 * 環境変数 GOOGLE_SERVICE_ACCOUNT_JSON または GOOGLE_SEARCH_CONSOLE_CREDENTIALS が必要
 */
function getSearchConsoleClient() {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS;
  if (!credentialsJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set");
  }

  let credentials: any;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch (e) {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON: not valid JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [SEARCH_CONSOLE_SCOPE],
  });

  return google.searchconsole({ version: "v1", auth });
}

/**
 * サイトURLを取得する
 */
function getSiteUrl(): string {
  return process.env.SEARCH_CONSOLE_SITE_URL || process.env.APP_URL || "https://lcjmall.com";
}

// =============================================
// SEO指標の取得・保存
// =============================================

/**
 * 指定記事のSearch Console指標を取得する
 */
async function fetchArticleSearchMetrics(slug: string, startDate: string, endDate: string) {
  try {
    const client = getSearchConsoleClient();
    const siteUrl = getSiteUrl();
    const pageUrl = `${siteUrl}/blog/${slug}`;

    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["page"],
        dimensionFilterGroups: [{
          filters: [{
            dimension: "page",
            operator: "equals",
            expression: pageUrl,
          }],
        }],
        rowLimit: 1,
      },
    });

    const rows = response.data.rows || [];
    if (rows.length === 0) {
      return { impressions: 0, clicks: 0, ctr: 0, avgPosition: 0 };
    }

    const row = rows[0];
    return {
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: row.ctr || 0,
      avgPosition: row.position || 0,
    };
  } catch (error: any) {
    console.warn(`[SEO Monitor] Failed to fetch metrics for ${slug}:`, error.message);
    return null;
  }
}

/**
 * URL Inspection APIでインデックス状態を確認する
 */
async function checkIndexStatus(slug: string): Promise<boolean> {
  try {
    const client = getSearchConsoleClient();
    const siteUrl = getSiteUrl();
    const pageUrl = `${siteUrl}/blog/${slug}`;

    const response = await client.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: pageUrl,
        siteUrl,
      },
    });

    const result = response.data.inspectionResult;
    const indexStatus = result?.indexStatusResult?.coverageState;
    return indexStatus === "Submitted and indexed" || indexStatus === "Indexed, not submitted in sitemap";
  } catch (error: any) {
    console.warn(`[SEO Monitor] Failed to check index status for ${slug}:`, error.message);
    return false;
  }
}

/**
 * 記事のSEO指標をDBに保存・更新する
 */
async function upsertSeoMetrics(
  articleId: number,
  slug: string,
  metrics: { impressions: number; clicks: number; ctr: number; avgPosition: number },
  isIndexed: boolean,
  periodStart: Date,
  periodEnd: Date,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();

  // 既存レコードを確認
  const existing = await db.select()
    .from(blogArticleSeoMetrics)
    .where(eq(blogArticleSeoMetrics.articleId, articleId))
    .limit(1);

  if (existing.length > 0) {
    await db.update(blogArticleSeoMetrics)
      .set({
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        ctr: String(metrics.ctr.toFixed(4)),
        avgPosition: String(metrics.avgPosition.toFixed(2)),
        isIndexed,
        indexedAt: isIndexed ? (existing[0].indexedAt || now) : null,
        lastCheckedAt: now,
        periodStart,
        periodEnd,
        updatedAt: now,
      })
      .where(eq(blogArticleSeoMetrics.articleId, articleId));
  } else {
    await db.insert(blogArticleSeoMetrics).values({
      articleId,
      slug,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      ctr: String(metrics.ctr.toFixed(4)),
      avgPosition: String(metrics.avgPosition.toFixed(2)),
      isIndexed,
      indexedAt: isIndexed ? now : null,
      lastCheckedAt: now,
      periodStart,
      periodEnd,
    });
  }
}

// =============================================
// メインSEO監視ループ
// =============================================

/**
 * 全公開記事のSEO指標を一括更新する
 * 毎日1回実行（深夜バッチと同時）
 */
export async function runSeoMonitorBatch() {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS;
  if (!credentialsJson) {
    console.log("[SEO Monitor] Skipping: GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    return;
  }

  console.log("[SEO Monitor] Starting SEO metrics batch...");

  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 公開済み記事を全取得
    const articles = await db.select({
      id: blogArticles.id,
      slug: blogArticles.slug,
      publishedAt: blogArticles.publishedAt,
    })
      .from(blogArticles)
      .where(eq(blogArticles.status, "published"))
      .limit(100); // 1回のバッチで最大100記事

    if (articles.length === 0) {
      console.log("[SEO Monitor] No published articles to check");
      return;
    }

    // 計測期間: 直近28日
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 28 * 24 * 60 * 60 * 1000);
    const startDate = periodStart.toISOString().split("T")[0];
    const endDate = periodEnd.toISOString().split("T")[0];

    let processed = 0;
    let indexed = 0;
    let totalImpressions = 0;

    for (const article of articles) {
      try {
        // Search Console指標を取得
        const metrics = await fetchArticleSearchMetrics(article.slug, startDate, endDate);
        if (!metrics) continue;

        // インデックス状態を確認（API制限のため一部のみ）
        // 未indexedの記事と公開後7日以内の記事のみチェック
        let isIndexed = false;
        const daysSincePublish = article.publishedAt
          ? Math.floor((Date.now() - new Date(article.publishedAt).getTime()) / (24 * 60 * 60 * 1000))
          : 999;

        if (daysSincePublish <= 7 || metrics.impressions === 0) {
          isIndexed = await checkIndexStatus(article.slug);
        } else {
          // impressionsがあればindexed済みとみなす
          isIndexed = metrics.impressions > 0;
        }

        await upsertSeoMetrics(article.id, article.slug, metrics, isIndexed, periodStart, periodEnd);

        processed++;
        if (isIndexed) indexed++;
        totalImpressions += metrics.impressions;

        // API制限対策: 100ms待機
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (articleError: any) {
        console.warn(`[SEO Monitor] Error processing article ${article.id}:`, articleError.message);
      }
    }

    console.log(`[SEO Monitor] Batch complete: ${processed} articles processed, ${indexed} indexed, ${totalImpressions} total impressions`);
  } catch (error: any) {
    console.error("[SEO Monitor] Batch error:", error.message);
  }
}

// =============================================
// 弱い記事の抽出
// =============================================

/**
 * 弱い記事を抽出する（リライト対象）
 * 公開後30日で以下の条件を満たす記事:
 * - impressions < 10 OR
 * - CTR < 1% OR
 * - 未indexed
 */
export async function extractWeakArticles(): Promise<Array<{
  id: number;
  title: string;
  slug: string;
  categoryId: number | null;
  publishedAt: Date | null;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  isIndexed: boolean;
  weakReason: string[];
}>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoffDate = new Date(Date.now() - WEAK_ARTICLE_DAYS * 24 * 60 * 60 * 1000);

  // 公開後30日以上経過した記事を取得
  const articles = await db.select({
    id: blogArticles.id,
    title: blogArticles.title,
    slug: blogArticles.slug,
    categoryId: blogArticles.categoryId,
    publishedAt: blogArticles.publishedAt,
  })
    .from(blogArticles)
    .where(and(
      eq(blogArticles.status, "published"),
      lte(blogArticles.publishedAt, cutoffDate),
    ))
    .limit(50);

  const weakArticles = [];

  for (const article of articles) {
    // SEO指標を取得
    const metrics = await db.select()
      .from(blogArticleSeoMetrics)
      .where(eq(blogArticleSeoMetrics.articleId, article.id))
      .limit(1);

    if (metrics.length === 0) continue;

    const m = metrics[0];
    const impressions = m.impressions || 0;
    const clicks = m.clicks || 0;
    const ctr = parseFloat(String(m.ctr || "0"));
    const avgPosition = parseFloat(String(m.avgPosition || "0"));
    const isIndexed = m.isIndexed || false;

    const weakReason: string[] = [];
    if (!isIndexed) weakReason.push("未indexed");
    if (impressions < WEAK_IMPRESSION_THRESHOLD) weakReason.push(`impressions低（${impressions}）`);
    if (ctr < WEAK_CTR_THRESHOLD && impressions > 0) weakReason.push(`CTR低（${(ctr * 100).toFixed(2)}%）`);
    if (avgPosition > WEAK_POSITION_THRESHOLD && avgPosition > 0) weakReason.push(`順位低（${avgPosition.toFixed(1)}位）`);

    if (weakReason.length > 0) {
      weakArticles.push({
        id: article.id,
        title: article.title,
        slug: article.slug,
        categoryId: article.categoryId,
        publishedAt: article.publishedAt,
        impressions,
        clicks,
        ctr,
        avgPosition,
        isIndexed,
        weakReason,
      });
    }
  }

  console.log(`[SEO Monitor] Found ${weakArticles.length} weak articles out of ${articles.length} checked`);
  return weakArticles;
}

// =============================================
// CV計測ヘルパー
// =============================================

/**
 * 記事のCV計測データを初期化・更新する
 */
export async function upsertArticleStats(
  articleId: number,
  data: {
    titlePattern?: string;
    articleType?: string;
    categorySlug?: string;
    internalLinkCount?: number;
    qualityScore?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select()
    .from(blogArticleStats)
    .where(eq(blogArticleStats.articleId, articleId))
    .limit(1);

  if (existing.length > 0) {
    await db.update(blogArticleStats)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(blogArticleStats.articleId, articleId));
  } else {
    await db.insert(blogArticleStats).values({
      articleId,
      ...data,
    });
  }
}

/**
 * 記事のクリックイベントを記録する（フロントエンドから呼び出し）
 */
export async function trackArticleClick(
  articleId: number,
  clickType: "mall" | "product" | "banner",
) {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select()
    .from(blogArticleStats)
    .where(eq(blogArticleStats.articleId, articleId))
    .limit(1);

  if (existing.length === 0) {
    // 初回: レコード作成
    const insertData: any = { articleId };
    if (clickType === "mall") insertData.mallClicks = 1;
    if (clickType === "product") insertData.productClicks = 1;
    if (clickType === "banner") insertData.bannerClicks = 1;
    await db.insert(blogArticleStats).values(insertData);
  } else {
    // 更新
    const updateData: any = { updatedAt: new Date() };
    if (clickType === "mall") updateData.mallClicks = (existing[0].mallClicks || 0) + 1;
    if (clickType === "product") updateData.productClicks = (existing[0].productClicks || 0) + 1;
    if (clickType === "banner") updateData.bannerClicks = (existing[0].bannerClicks || 0) + 1;
    await db.update(blogArticleStats)
      .set(updateData)
      .where(eq(blogArticleStats.articleId, articleId));
  }
}

// =============================================
// テーマ重複チェック（slug重複・近似テーマ防止）
// =============================================

/**
 * 直近30日間で同じカテゴリ×悩み×タイプの組み合わせが存在するかチェック
 */
export async function checkThemeDuplicate(
  categorySlug: string,
  problemType: string | null,
  articleType: string,
  days: number = 30,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { blogArticleThemeLog } = await import("../drizzle/schema");

  const existing = await db.select()
    .from(blogArticleThemeLog)
    .where(and(
      eq(blogArticleThemeLog.categorySlug, categorySlug),
      eq(blogArticleThemeLog.articleType, articleType),
      problemType ? eq(blogArticleThemeLog.problemType, problemType) : isNull(blogArticleThemeLog.problemType),
      gte(blogArticleThemeLog.createdAt, since),
    ))
    .limit(1);

  return existing.length > 0;
}

/**
 * テーマログに記録する
 */
export async function recordThemeLog(
  articleId: number,
  categorySlug: string,
  problemType: string | null,
  articleType: string,
  keyword: string,
  titlePattern: string,
) {
  const db = await getDb();
  if (!db) return;

  const { blogArticleThemeLog } = await import("../drizzle/schema");

  await db.insert(blogArticleThemeLog).values({
    articleId,
    categorySlug,
    problemType: problemType || undefined,
    articleType,
    keyword,
    titlePattern,
  });
}

// =============================================
// タイトルAB最適化
// =============================================

/**
 * タイトルパターンを判定する
 * pattern_a: 「2026年最新版 TikTokで人気の〜」
 * pattern_b: 「TikTokライブで売れている〜」
 * pattern_c: 「〜におすすめの〜」
 */
export function detectTitlePattern(title: string): string {
  if (/\d{4}年.*最新|最新.*\d{4}年|TikTok.*人気|人気.*TikTok/.test(title)) {
    return "pattern_a";
  }
  if (/TikTok.*ライブ|ライブ.*売れ|ライブ配信.*おすすめ/.test(title)) {
    return "pattern_b";
  }
  if (/におすすめ|おすすめ.*\d+選|ランキング.*\d+選|\d+選.*おすすめ/.test(title)) {
    return "pattern_c";
  }
  return "pattern_other";
}

/**
 * タイトルパターン別のCTR統計を取得する
 */
export async function getTitlePatternStats(): Promise<Array<{
  pattern: string;
  articleCount: number;
  avgCtr: number;
  avgImpressions: number;
  avgClicks: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  const stats = await db.select({
    titlePattern: blogArticleStats.titlePattern,
    articleId: blogArticleStats.articleId,
  })
    .from(blogArticleStats)
    .where(eq(blogArticleStats.titlePattern, blogArticleStats.titlePattern));

  // パターン別に集計
  const patternMap: Record<string, { count: number; totalCtr: number; totalImpressions: number; totalClicks: number }> = {};

  for (const stat of stats) {
    if (!stat.titlePattern) continue;
    const pattern = stat.titlePattern;
    if (!patternMap[pattern]) {
      patternMap[pattern] = { count: 0, totalCtr: 0, totalImpressions: 0, totalClicks: 0 };
    }

    // SEO指標を取得
    const seoMetrics = await db.select()
      .from(blogArticleSeoMetrics)
      .where(eq(blogArticleSeoMetrics.articleId, stat.articleId))
      .limit(1);

    if (seoMetrics.length > 0) {
      patternMap[pattern].count++;
      patternMap[pattern].totalCtr += parseFloat(String(seoMetrics[0].ctr || "0"));
      patternMap[pattern].totalImpressions += seoMetrics[0].impressions || 0;
      patternMap[pattern].totalClicks += seoMetrics[0].clicks || 0;
    }
  }

  return Object.entries(patternMap).map(([pattern, data]) => ({
    pattern,
    articleCount: data.count,
    avgCtr: data.count > 0 ? data.totalCtr / data.count : 0,
    avgImpressions: data.count > 0 ? data.totalImpressions / data.count : 0,
    avgClicks: data.count > 0 ? data.totalClicks / data.count : 0,
  }));
}

// =============================================
// スケジューラー起動
// =============================================

let seoMonitorIntervalId: ReturnType<typeof setInterval> | null = null;

export function startSeoMonitor() {
  if (seoMonitorIntervalId) {
    console.log("[SEO Monitor] Already running");
    return;
  }

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS;
  if (!credentialsJson) {
    console.log("[SEO Monitor] Skipping startup: GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    return;
  }

  console.log("[SEO Monitor] Starting SEO monitor (checks every 24 hours)");

  // 毎日1回チェック（24時間ごと）
  seoMonitorIntervalId = setInterval(() => {
    runSeoMonitorBatch().catch((error) => {
      console.error("[SEO Monitor] Error during scheduled run:", error);
    });
  }, SEO_CHECK_INTERVAL_HOURS * 60 * 60 * 1000);
}

export function stopSeoMonitor() {
  if (seoMonitorIntervalId) {
    clearInterval(seoMonitorIntervalId);
    seoMonitorIntervalId = null;
    console.log("[SEO Monitor] Stopped");
  }
}
