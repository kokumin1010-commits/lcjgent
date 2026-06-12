/**
 * Lead Collector - lcjgent独立リード収集パイプライン
 * Google Maps Places API + Google Custom Search APIを使用
 * Sales Dashへの依存を完全に排除
 */

import { getDb } from "./db";
import { leads, leadCollectionHistory } from "../drizzle/schema";
import { eq, and, sql, desc, like, or } from "drizzle-orm";
import { nanoid } from "nanoid";

// ============================================================
// 型定義
// ============================================================
interface CollectResult {
  leadsFound: number;
  newLeads: number;
  duplicates: number;
  batchId: string;
  background?: boolean;
  message?: string;
}

interface GoogleMapsPlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  geometry?: { location: { lat: number; lng: number } };
}

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet?: string;
  pagemap?: {
    metatags?: Array<Record<string, string>>;
    organization?: Array<Record<string, string>>;
  };
}

// ============================================================
// 環境変数
// ============================================================
function getGoogleMapsApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_SEARCH_API_KEY || "AIzaSyCzjWxmpox7rRnsDBpkNduMf0E-u_C31B0";
}

function getGoogleSearchApiKey(): string {
  return process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "AIzaSyCzjWxmpox7rRnsDBpkNduMf0E-u_C31B0";
}

function getGoogleSearchEngineId(): string {
  return process.env.GOOGLE_SEARCH_ENGINE_ID || "c6ecd054bf2344a76";
}

// ============================================================
// Google Maps Places API
// ============================================================

/**
 * Google Maps Text Search APIでビジネスを検索
 */
async function searchGoogleMapsPlaces(keyword: string, prefecture?: string): Promise<GoogleMapsPlace[]> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

  const query = prefecture ? `${keyword} ${prefecture}` : keyword;
  const places: GoogleMapsPlace[] = [];
  let nextPageToken: string | undefined;

  // 最大3ページ（60件）まで取得
  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({
      query,
      key: apiKey,
      language: "ja",
      region: "jp",
    });
    if (nextPageToken) {
      params.set("pagetoken", nextPageToken);
    }

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
    console.log(`[LeadCollector] Google Maps search page ${page + 1}: ${query}`);

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(`[LeadCollector] Google Maps API error: ${data.status} - ${data.error_message || ""}`);
      if (page === 0) throw new Error(`Google Maps API error: ${data.status}`);
      break;
    }

    if (data.results) {
      places.push(...data.results);
    }

    nextPageToken = data.next_page_token;
    if (!nextPageToken) break;

    // next_page_tokenが有効になるまで少し待つ
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return places;
}

/**
 * Google Maps Place Details APIで詳細情報を取得
 */
async function getPlaceDetails(placeId: string): Promise<GoogleMapsPlace | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return null;

  const fields = "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=ja`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.result) {
      return { ...data.result, place_id: placeId };
    }
  } catch (e) {
    console.error(`[LeadCollector] Place details error for ${placeId}:`, e);
  }
  return null;
}

/**
 * メールアドレスをウェブサイトから抽出（簡易スクレイピング）
 */
async function extractEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LCJBot/1.0)",
        "Accept": "text/html",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();
    // メールアドレスパターンを検索
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex);

    if (!emails || emails.length === 0) return null;

    // 画像ファイル拡張子やnoindex系を除外
    const validEmails = emails.filter(e => {
      const lower = e.toLowerCase();
      return !lower.endsWith(".png") &&
             !lower.endsWith(".jpg") &&
             !lower.endsWith(".jpeg") &&
             !lower.endsWith(".gif") &&
             !lower.endsWith(".svg") &&
             !lower.endsWith(".webp") &&
             !lower.endsWith(".avif") &&
             !lower.includes("example.com") &&
             !lower.includes("sentry.io") &&
             !lower.includes("wixpress") &&
             e.length < 100;
    });

    // info@, contact@, support@ を優先
    const priorityEmails = validEmails.filter(e => {
      const prefix = e.split("@")[0].toLowerCase();
      return ["info", "contact", "support", "mail", "office", "admin"].includes(prefix);
    });

    return priorityEmails[0] || validEmails[0] || null;
  } catch {
    return null;
  }
}

/**
 * Google Mapsからリードを収集してDBに保存
 */
export async function collectFromGoogleMaps(
  keyword: string,
  prefecture?: string,
  executedBy?: string
): Promise<CollectResult> {
  const batchId = nanoid(16);
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log(`[LeadCollector] Starting Google Maps collection: keyword="${keyword}", prefecture="${prefecture}", batchId=${batchId}`);

  // Places Text Searchで検索
  const places = await searchGoogleMapsPlaces(keyword, prefecture);
  console.log(`[LeadCollector] Found ${places.length} places from Google Maps`);

  let newLeads = 0;
  let duplicates = 0;

  for (const place of places) {
    // 重複チェック（googlePlaceId）
    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.googlePlaceId, place.place_id))
      .limit(1);

    if (existing.length > 0) {
      duplicates++;
      continue;
    }

    // Place Detailsで電話番号・ウェブサイトを取得
    let details: GoogleMapsPlace | null = null;
    if (!place.formatted_phone_number && !place.website) {
      details = await getPlaceDetails(place.place_id);
      // API制限を考慮して少し待つ
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const finalPlace = details || place;
    const phone = finalPlace.formatted_phone_number || finalPlace.international_phone_number || null;
    const website = finalPlace.website || null;

    // ウェブサイトからメールアドレスを抽出
    let email: string | null = null;
    if (website) {
      email = await extractEmailFromWebsite(website);
    }

    // カテゴリ推定
    const category = inferCategory(finalPlace.types || [], keyword);

    // DBに保存
    try {
      await db.insert(leads).values({
        companyName: place.name,
        email,
        phone,
        website,
        address: place.formatted_address || null,
        category,
        source: "google_maps",
        status: "new",
        prefecture: prefecture || null,
        keyword,
        googlePlaceId: place.place_id,
        rating: finalPlace.rating?.toString() || null,
        reviewCount: finalPlace.user_ratings_total || null,
        batchId,
      } as any);
      newLeads++;
    } catch (e: any) {
      // 重複エラーは無視
      if (!e.message?.includes("Duplicate")) {
        console.error(`[LeadCollector] Insert error for ${place.name}:`, e.message);
      } else {
        duplicates++;
      }
    }
  }

  // 収集履歴を記録
  await db.insert(leadCollectionHistory).values({
    keyword,
    prefecture: prefecture || null,
    pipeline: "google_maps",
    leadsFound: newLeads,
    executedBy: executedBy || "system",
    batchId,
    status: "completed",
  });

  console.log(`[LeadCollector] Google Maps collection complete: ${newLeads} new, ${duplicates} duplicates`);

  return {
    leadsFound: places.length,
    newLeads,
    duplicates,
    batchId,
  };
}

// ============================================================
// Google Custom Search API
// ============================================================

/**
 * Google Custom Search APIでビジネスを検索
 */
async function searchGoogleCustomSearch(keyword: string, prefecture?: string, start = 1): Promise<GoogleSearchResult[]> {
  const apiKey = getGoogleSearchApiKey();
  const engineId = getGoogleSearchEngineId();
  if (!apiKey || !engineId) throw new Error("Google Search API credentials not configured");

  const query = prefecture
    ? `${keyword} ${prefecture} 会社 連絡先`
    : `${keyword} 会社 連絡先 メール`;

  const params = new URLSearchParams({
    key: apiKey,
    cx: engineId,
    q: query,
    num: "10",
    start: start.toString(),
    gl: "jp",
    lr: "lang_ja",
  });

  const url = `https://www.googleapis.com/customsearch/v1?${params}`;
  console.log(`[LeadCollector] Google Search: "${query}" (start=${start})`);

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error(`[LeadCollector] Google Search API error:`, data.error.message);
    throw new Error(`Google Search API error: ${data.error.message}`);
  }

  return data.items || [];
}

/**
 * Google Custom Searchからリードを収集
 */
export async function collectFromGoogleSearch(
  keyword: string,
  prefecture?: string,
  executedBy?: string
): Promise<CollectResult> {
  const batchId = nanoid(16);
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log(`[LeadCollector] Starting Google Search collection: keyword="${keyword}", prefecture="${prefecture}", batchId=${batchId}`);

  let allResults: GoogleSearchResult[] = [];

  // 最大3ページ（30件）まで取得
  for (let page = 0; page < 3; page++) {
    try {
      const results = await searchGoogleCustomSearch(keyword, prefecture, page * 10 + 1);
      allResults.push(...results);
      if (results.length < 10) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error(`[LeadCollector] Search page ${page + 1} error:`, e);
      if (page === 0) throw e;
      break;
    }
  }

  console.log(`[LeadCollector] Found ${allResults.length} search results`);

  let newLeads = 0;
  let duplicates = 0;

  for (const result of allResults) {
    // URLベースで重複チェック
    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.website, result.link))
      .limit(1);

    if (existing.length > 0) {
      duplicates++;
      continue;
    }

    // 会社名を抽出（タイトルから）
    const companyName = extractCompanyName(result.title);
    if (!companyName) continue;

    // ウェブサイトからメールアドレスと電話番号を抽出
    let email: string | null = null;
    let phone: string | null = null;

    try {
      email = await extractEmailFromWebsite(result.link);
      // snippetから電話番号を抽出
      phone = extractPhoneFromText(result.snippet || "");
    } catch {
      // スクレイピング失敗は無視
    }

    // カテゴリ推定
    const category = inferCategoryFromText(result.title + " " + (result.snippet || ""), keyword);

    try {
      await db.insert(leads).values({
        companyName,
        email,
        phone,
        website: result.link,
        address: null,
        category,
        source: "google_search",
        status: "new",
        prefecture: prefecture || null,
        keyword,
        googlePlaceId: null,
        batchId,
      } as any);
      newLeads++;
    } catch (e: any) {
      if (!e.message?.includes("Duplicate")) {
        console.error(`[LeadCollector] Insert error for ${companyName}:`, e.message);
      } else {
        duplicates++;
      }
    }

    // レート制限
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // 収集履歴を記録
  await db.insert(leadCollectionHistory).values({
    keyword,
    prefecture: prefecture || null,
    pipeline: "google_search",
    leadsFound: newLeads,
    executedBy: executedBy || "system",
    batchId,
    status: "completed",
  });

  console.log(`[LeadCollector] Google Search collection complete: ${newLeads} new, ${duplicates} duplicates`);

  return {
    leadsFound: allResults.length,
    newLeads,
    duplicates,
    batchId,
  };
}

// ============================================================
// フルパイプライン
// ============================================================

/**
 * Google Maps + Google Search の両方を実行
 */
export async function runFullPipeline(
  keyword: string,
  prefecture?: string,
  executedBy?: string
): Promise<CollectResult> {
  const batchId = nanoid(16);
  let totalNewLeads = 0;
  let totalDuplicates = 0;
  let totalFound = 0;

  console.log(`[LeadCollector] Starting full pipeline: keyword="${keyword}", prefecture="${prefecture}"`);

  // Google Maps
  try {
    const mapsResult = await collectFromGoogleMaps(keyword, prefecture, executedBy);
    totalNewLeads += mapsResult.newLeads;
    totalDuplicates += mapsResult.duplicates;
    totalFound += mapsResult.leadsFound;
  } catch (e: any) {
    console.error(`[LeadCollector] Google Maps pipeline error:`, e.message);
  }

  // Google Search
  try {
    const searchResult = await collectFromGoogleSearch(keyword, prefecture, executedBy);
    totalNewLeads += searchResult.newLeads;
    totalDuplicates += searchResult.duplicates;
    totalFound += searchResult.leadsFound;
  } catch (e: any) {
    console.error(`[LeadCollector] Google Search pipeline error:`, e.message);
  }

  // フルパイプライン履歴
  const db = await getDb();
  if (db) {
    await db.insert(leadCollectionHistory).values({
      keyword,
      prefecture: prefecture || null,
      pipeline: "full_pipeline",
      leadsFound: totalNewLeads,
      executedBy: executedBy || "system",
      batchId,
      status: "completed",
    });
  }

  console.log(`[LeadCollector] Full pipeline complete: ${totalNewLeads} new leads, ${totalDuplicates} duplicates`);

  return {
    leadsFound: totalFound,
    newLeads: totalNewLeads,
    duplicates: totalDuplicates,
    batchId,
  };
}

// ============================================================
// リード取得・更新
// ============================================================

/**
 * リード一覧取得（フィルター付き）
 */
export async function getLeads(options: {
  status?: string;
  source?: string;
  search?: string;
  hasEmail?: boolean;
  notSent?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ rows: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };

  const conditions: any[] = [];

  if (options.status) {
    conditions.push(eq(leads.status, options.status));
  }
  if (options.source) {
    conditions.push(eq(leads.source, options.source));
  }
  if (options.hasEmail) {
    conditions.push(sql`${leads.email} IS NOT NULL AND ${leads.email} != ''`);
  }
  if (options.notSent) {
    conditions.push(eq(leads.emailSentCount, 0));
  }
  if (options.search) {
    conditions.push(
      or(
        like(leads.companyName, `%${options.search}%`),
        like(leads.email, `%${options.search}%`),
        like(leads.category, `%${options.search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(desc(leads.createdAt))
      .limit(options.limit || 200)
      .offset(options.offset || 0),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(whereClause),
  ]);

  return {
    rows,
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * リードステータス更新
 */
export async function updateLeadStatus(id: number, status: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db.update(leads).set({ status } as any).where(eq(leads.id, id));
  return true;
}

/**
 * リード情報更新
 */
export async function updateLead(id: number, data: Partial<{
  companyName: string;
  email: string;
  phone: string;
  website: string;
  category: string;
  status: string;
  contactPerson: string;
  notes: string;
  emailSentCount: number;
}>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db.update(leads).set(data as any).where(eq(leads.id, id));
  return true;
}

/**
 * リード統計取得
 */
export async function getLeadStats(): Promise<{
  total: number;
  withEmail: number;
  withPhone: number;
  new: number;
  contacted: number;
  responded: number;
  converted: number;
  rejected: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, withEmail: 0, withPhone: 0, new: 0, contacted: 0, responded: 0, converted: 0, rejected: 0 };

  const [totalResult, emailResult, phoneResult, newResult, contactedResult, respondedResult, convertedResult, rejectedResult] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(leads),
    db.select({ count: sql<number>`COUNT(*)` }).from(leads).where(sql`${leads.email} IS NOT NULL AND ${leads.email} != ''`),
    db.select({ count: sql<number>`COUNT(*)` }).from(leads).where(sql`${leads.phone} IS NOT NULL AND ${leads.phone} != ''`),
    db.select({ count: sql<number>`COUNT(*)` }).from(leads).where(eq(leads.status, "new")),
    db.select({ count: sql<number>`COUNT(*)` }).from(leads).where(eq(leads.status, "contacted")),
    db.select({ count: sql<number>`COUNT(*)` }).from(leads).where(eq(leads.status, "responded")),
    db.select({ count: sql<number>`COUNT(*)` }).from(leads).where(eq(leads.status, "converted")),
    db.select({ count: sql<number>`COUNT(*)` }).from(leads).where(eq(leads.status, "rejected")),
  ]);

  return {
    total: Number(totalResult[0]?.count || 0),
    withEmail: Number(emailResult[0]?.count || 0),
    withPhone: Number(phoneResult[0]?.count || 0),
    new: Number(newResult[0]?.count || 0),
    contacted: Number(contactedResult[0]?.count || 0),
    responded: Number(respondedResult[0]?.count || 0),
    converted: Number(convertedResult[0]?.count || 0),
    rejected: Number(rejectedResult[0]?.count || 0),
  };
}

/**
 * IDでリード取得
 */
export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0] || null;
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * Google Mapsのtypesからカテゴリを推定
 */
function inferCategory(types: string[], keyword: string): string {
  const typeMap: Record<string, string> = {
    beauty_salon: "美容・サロン",
    hair_care: "美容・サロン",
    spa: "美容・サロン",
    restaurant: "飲食",
    cafe: "飲食",
    bar: "飲食",
    store: "小売",
    shopping_mall: "小売",
    clothing_store: "ファッション",
    jewelry_store: "ジュエリー",
    health: "健康・医療",
    hospital: "健康・医療",
    dentist: "健康・医療",
    gym: "フィットネス",
    real_estate_agency: "不動産",
    lodging: "宿泊",
    car_dealer: "自動車",
    electronics_store: "家電",
    pet_store: "ペット",
    school: "教育",
    finance: "金融",
  };

  for (const type of types) {
    if (typeMap[type]) return typeMap[type];
  }

  // キーワードからカテゴリを推定
  if (keyword.includes("美容") || keyword.includes("サロン") || keyword.includes("エステ")) return "美容・サロン";
  if (keyword.includes("飲食") || keyword.includes("レストラン") || keyword.includes("カフェ")) return "飲食";
  if (keyword.includes("クリニック") || keyword.includes("医療") || keyword.includes("病院")) return "健康・医療";
  if (keyword.includes("不動産")) return "不動産";
  if (keyword.includes("ジム") || keyword.includes("フィットネス")) return "フィットネス";

  return keyword || "その他";
}

/**
 * テキストからカテゴリを推定
 */
function inferCategoryFromText(text: string, keyword: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("美容") || lower.includes("サロン") || lower.includes("エステ")) return "美容・サロン";
  if (lower.includes("飲食") || lower.includes("レストラン")) return "飲食";
  if (lower.includes("クリニック") || lower.includes("医療")) return "健康・医療";
  if (lower.includes("不動産")) return "不動産";
  if (lower.includes("ec") || lower.includes("通販") || lower.includes("ショップ")) return "EC・通販";
  if (lower.includes("it") || lower.includes("テクノロジー") || lower.includes("システム")) return "IT・テクノロジー";
  return keyword || "その他";
}

/**
 * タイトルから会社名を抽出
 */
function extractCompanyName(title: string): string | null {
  // 「株式会社XX」「XX株式会社」「合同会社XX」パターン
  const companyMatch = title.match(/(株式会社[^\s|｜\-\—]+|[^\s|｜\-\—]+株式会社|合同会社[^\s|｜\-\—]+|有限会社[^\s|｜\-\—]+)/);
  if (companyMatch) return companyMatch[1];

  // 「|」や「-」で区切られたタイトルの最初の部分
  const parts = title.split(/[|｜\-\—–]/);
  const firstPart = parts[0]?.trim();
  if (firstPart && firstPart.length > 2 && firstPart.length < 50) {
    return firstPart;
  }

  return null;
}

/**
 * テキストから電話番号を抽出
 */
function extractPhoneFromText(text: string): string | null {
  // 日本の電話番号パターン
  const phoneRegex = /(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}|0\d{9,10})/;
  const match = text.match(phoneRegex);
  return match ? match[0].replace(/[\s]/g, "") : null;
}

/**
 * バルクインポート - 外部ソースからリードを一括インポート
 */
export async function bulkImportLeads(leadsData: Array<{
  companyName: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  category?: string | null;
  source?: string;
  status?: string;
  contactPerson?: string | null;
  notes?: string | null;
  prefecture?: string | null;
  keyword?: string | null;
  googlePlaceId?: string | null;
  rating?: string | null;
  reviewCount?: number | null;
  batchId?: string | null;
  emailSentCount?: number;
}>): Promise<{ imported: number; duplicates: number; errors: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  // バッチ処理（50件ずつ）
  const batchSize = 50;
  for (let i = 0; i < leadsData.length; i += batchSize) {
    const batch = leadsData.slice(i, i + batchSize);
    for (const lead of batch) {
      try {
        // 重複チェック（companyName + source の組み合わせ）
        const existing = await db
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              eq(leads.companyName, lead.companyName),
              eq(leads.source, lead.source || "kalodata_tiktok")
            )
          )
          .limit(1);

        if (existing.length > 0) {
          duplicates++;
          continue;
        }

        await db.insert(leads).values({
          companyName: lead.companyName,
          email: lead.email || null,
          phone: lead.phone || null,
          website: lead.website || null,
          address: lead.address || null,
          category: lead.category || null,
          source: lead.source || "kalodata_tiktok",
          status: lead.status || "new",
          contactPerson: lead.contactPerson || null,
          notes: lead.notes || null,
          prefecture: lead.prefecture || null,
          keyword: lead.keyword || null,
          googlePlaceId: lead.googlePlaceId || null,
          rating: lead.rating || null,
          reviewCount: lead.reviewCount || null,
          batchId: lead.batchId || null,
          emailSentCount: lead.emailSentCount || 0,
        } as any);
        imported++;
      } catch (e: any) {
        errors++;
        if (errors <= 5) {
          console.error(`[BulkImport] Error importing ${lead.companyName}:`, e.message);
        }
      }
    }
  }

  console.log(`[BulkImport] Complete: imported=${imported}, duplicates=${duplicates}, errors=${errors}`);
  return { imported, duplicates, errors };
}
