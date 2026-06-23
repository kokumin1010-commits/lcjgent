/**
 * LCJ Brain Tool Calling - AI自律データ取得システム
 * 
 * キーワードベースの buildContext を廃止し、
 * AIが自分で必要なデータを Tool Calling で取得するアーキテクチャ。
 * 全15ツールで LCJ の全データソースにアクセス可能。
 */
import { getDb } from "./db";
import {
  brands,
  brandContracts,
  brandLivestreams,
  brandShortVideos,
  livers,
  staff,
  schedules,
  brandProducts,
  lcjBrainKnowledge,
  tasks,
  reports,
  reportStaff,
  mallOrders,
  mallProducts,
  pointBalances,
  pointTransactions,
  receipts,
  adInvestmentRecords,
  lineUsers,
  lineMessages,
  lineGroups,
  salesActivities,
  callLogs,
  leads,
  businessCards,
  tspContracts,
  tspInvoices,
  featuredProducts,
  lcjCoinHoldings,
  lcjCoinTransactions,
  brandAdPerformanceStats,
  brandActivities,
  brandMemos,
  livestreamPromotions,
  megaChannelSettings,
  megaChannelQualifications,
  selectionProducts,
  tiktokTapReports,
  tiktokCapCreatorReports,
  tiktokCapProductReports,
  brandMonthlyGmvTargets,
  salesEmailLogs,
  leadCollectionHistory,
  liveSuggestions,
  productPipeline,
  productLabSalesData,
} from "../drizzle/schema";
import { eq, desc, and, gte, lte, isNull, sql, like, or, count, sum, asc } from "drizzle-orm";
import type { Tool, ToolCall, InvokeResult } from "./_core/llm";
import { ENV } from "./_core/env";

// ============================================================
// Tool Definitions (JSON Schema format for OpenAI API)
// ============================================================

export const LCJ_BRAIN_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_brands_list",
      description: "全ブランド一覧を取得。ステータス・カテゴリ・担当者・コミッション率等の基本情報を含む。ブランド名で絞り込み可能。",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "ブランド名で絞り込み（部分一致）" },
          status: { type: "string", description: "ステータスで絞り込み（例: 契約中, 商談中, テスト中）" },
          limit: { type: "number", description: "取得件数上限（デフォルト50）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_brand_detail",
      description: "特定ブランドの詳細情報を取得。契約情報・直近の配信実績・短動画・商品リスト・活動履歴を含む。",
      parameters: {
        type: "object",
        properties: {
          brandId: { type: "number", description: "ブランドID" },
          brandName: { type: "string", description: "ブランド名（IDが不明な場合に使用）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contracts",
      description: "ブランド契約一覧を取得。サービスタイプ・ステータス・固定費・配信ノルマ等を含む。",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "契約ステータスで絞り込み（例: 契約中, 終了）" },
          brandId: { type: "number", description: "特定ブランドの契約のみ取得" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_livers",
      description: "ライバー（配信者）一覧を取得。名前・SNSアカウント・アクティブ状態を含む。",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "ライバー名で絞り込み" },
          activeOnly: { type: "boolean", description: "アクティブなライバーのみ（デフォルトtrue）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_livestream_stats",
      description: "配信実績データを取得。GMV・売上・時間・視聴者数・注文数を集計。月別・ライバー別に絞り込み可能。",
      parameters: {
        type: "object",
        properties: {
          yearMonth: { type: "string", description: "対象月（YYYY-MM形式、例: 2026-06）" },
          liverName: { type: "string", description: "ライバー名で絞り込み" },
          liverId: { type: "number", description: "ライバーIDで絞り込み" },
          brandId: { type: "number", description: "ブランドIDで絞り込み" },
          limit: { type: "number", description: "個別配信レコード取得数（デフォルト30）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_liver_ranking",
      description: "ライバー業績ランキングを取得。近3ヶ月のGMV・売上・配信回数・平均視聴者数で比較。",
      parameters: {
        type: "object",
        properties: {
          months: { type: "number", description: "集計期間（月数、デフォルト3）" },
          limit: { type: "number", description: "上位何名まで（デフォルト20）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_schedules",
      description: "配信スケジュールを取得。今後の予定・過去の予定を含む。",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "今後何日分（デフォルト14）" },
          liverId: { type: "number", description: "特定ライバーのスケジュールのみ" },
          brandId: { type: "number", description: "特定ブランドのスケジュールのみ" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "知識庫（会議纪要・SOP・日報等）をキーワード検索。RAG検索で関連ドキュメントを取得。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "検索キーワード" },
          category: { type: "string", description: "カテゴリで絞り込み（例: 会議纪要, SOP, 日報）" },
          limit: { type: "number", description: "取得件数（デフォルト5）" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tasks_and_reports",
      description: "タスク管理・日報データを取得。スタッフのタスク進捗・日報内容を含む。",
      parameters: {
        type: "object",
        properties: {
          staffId: { type: "number", description: "スタッフIDで絞り込み" },
          status: { type: "string", description: "タスクステータス（pending, in_progress, completed）" },
          days: { type: "number", description: "直近何日分の日報（デフォルト7）" },
          type: { type: "string", description: "'tasks'=タスクのみ, 'reports'=日報のみ, 'both'=両方（デフォルト）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_mall_data",
      description: "EC MALL（ショッピング）データを取得。注文・商品・ポイント残高・レシート審査状況を含む。",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "'orders'=注文, 'products'=商品, 'points'=ポイント, 'receipts'=レシート, 'overview'=概要（デフォルト）" },
          days: { type: "number", description: "直近何日分（デフォルト30）" },
          limit: { type: "number", description: "取得件数（デフォルト30）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ad_performance",
      description: "広告パフォーマンスデータを取得。広告投資額・ROAS・インプレッション・クリック・コンバージョンを含む。",
      parameters: {
        type: "object",
        properties: {
          brandId: { type: "number", description: "ブランドIDで絞り込み" },
          yearMonth: { type: "string", description: "対象月（YYYY-MM形式）" },
          limit: { type: "number", description: "取得件数（デフォルト30）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_line_data",
      description: "LINE連携データを取得。LINEユーザー・グループ・メッセージ履歴を含む。",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "'users'=ユーザー一覧, 'groups'=グループ一覧, 'messages'=最新メッセージ（デフォルト: 'overview'）" },
          groupId: { type: "string", description: "特定グループのメッセージを取得" },
          limit: { type: "number", description: "取得件数（デフォルト20）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sales_bd_data",
      description: "BD営業データを取得。名刺管理・リード・営業活動・通話ログ・メール送信履歴を含む。",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "'cards'=名刺, 'leads'=リード, 'activities'=営業活動, 'calls'=通話, 'emails'=メール, 'overview'=概要（デフォルト）" },
          status: { type: "string", description: "ステータスで絞り込み" },
          days: { type: "number", description: "直近何日分（デフォルト30）" },
          limit: { type: "number", description: "取得件数（デフォルト30）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lcj_coin_data",
      description: "LCJコイン（社内トークン）データを取得。保有状況・取引履歴・ランキングを含む。",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "'holdings'=保有一覧, 'transactions'=取引履歴, 'ranking'=ランキング（デフォルト: 'overview'）" },
          holderId: { type: "number", description: "特定保有者のデータ" },
          limit: { type: "number", description: "取得件数（デフォルト20）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tiktok_reports",
      description: "TikTok TAP/CAPレポートデータを取得。クリエイター別・商品別のGMV・売上・コミッションを含む。",
      parameters: {
        type: "object",
        properties: {
          brandId: { type: "number", description: "ブランドIDで絞り込み" },
          reportMonth: { type: "string", description: "対象月（YYYY-MM形式）" },
          type: { type: "string", description: "'tap'=TAPレポート, 'cap_creator'=CAPクリエイター別, 'cap_product'=CAP商品別（デフォルト: 'cap_creator'）" },
          limit: { type: "number", description: "取得件数（デフォルト30）" },
        },
        required: [],
      },
    },
  },
];

// ============================================================
// Tool Execution Handler
// ============================================================

export async function executeToolCall(toolCall: ToolCall): Promise<string> {
  const { name, arguments: argsStr } = toolCall.function;
  let args: any = {};
  try {
    args = JSON.parse(argsStr);
  } catch (e) {
    return JSON.stringify({ error: "Invalid JSON arguments" });
  }

  try {
    switch (name) {
      case "get_brands_list":
        return JSON.stringify(await toolGetBrandsList(args));
      case "get_brand_detail":
        return JSON.stringify(await toolGetBrandDetail(args));
      case "get_contracts":
        return JSON.stringify(await toolGetContracts(args));
      case "get_livers":
        return JSON.stringify(await toolGetLivers(args));
      case "get_livestream_stats":
        return JSON.stringify(await toolGetLivestreamStats(args));
      case "get_liver_ranking":
        return JSON.stringify(await toolGetLiverRanking(args));
      case "get_schedules":
        return JSON.stringify(await toolGetSchedules(args));
      case "search_knowledge_base":
        return JSON.stringify(await toolSearchKnowledgeBase(args as { query: string; category?: string; limit?: number }));
      case "get_tasks_and_reports":
        return JSON.stringify(await toolGetTasksAndReports(args));
      case "get_mall_data":
        return JSON.stringify(await toolGetMallData(args));
      case "get_ad_performance":
        return JSON.stringify(await toolGetAdPerformance(args));
      case "get_line_data":
        return JSON.stringify(await toolGetLineData(args));
      case "get_sales_bd_data":
        return JSON.stringify(await toolGetSalesBdData(args));
      case "get_lcj_coin_data":
        return JSON.stringify(await toolGetLcjCoinData(args));
      case "get_tiktok_reports":
        return JSON.stringify(await toolGetTiktokReports(args));
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error: any) {
    console.error(`[LCJ Brain Tool] ${name} error:`, error.message);
    return JSON.stringify({ error: error.message });
  }
}

// ============================================================
// Tool Implementation Functions
// ============================================================

async function toolGetBrandsList(args: { search?: string; status?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const conditions: any[] = [isNull(brands.deletedAt)];
  if (args.search) {
    conditions.push(or(
      like(brands.name, `%${args.search}%`),
      like(brands.nameJa, `%${args.search}%`),
      like(brands.companyName, `%${args.search}%`)
    ));
  }
  if (args.status) {
    conditions.push(eq(brands.status, args.status as any));
  }
  const result = await db.select({
    id: brands.id,
    name: brands.name,
    nameJa: brands.nameJa,
    companyName: brands.companyName,
    category: brands.category,
    materialCategory: brands.materialCategory,
    status: brands.status,
    contactPerson: brands.contactPerson,
    salesTarget: brands.salesTarget,
    commissionRate: brands.commissionRate,
    memo: brands.memo,
  })
    .from(brands)
    .where(and(...conditions))
    .orderBy(desc(brands.updatedAt))
    .limit(args.limit || 50);
  return { total: result.length, brands: result };
}

async function toolGetBrandDetail(args: { brandId?: number; brandName?: string }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  let brandId = args.brandId;
  if (!brandId && args.brandName) {
    const [found] = await db.select({ id: brands.id })
      .from(brands)
      .where(and(
        isNull(brands.deletedAt),
        or(
          like(brands.name, `%${args.brandName}%`),
          like(brands.nameJa, `%${args.brandName}%`)
        )
      ))
      .limit(1);
    if (found) brandId = found.id;
  }
  if (!brandId) return { error: "Brand not found" };
  const [brand] = await db.select().from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.deletedAt)));
  if (!brand) return { error: "Brand not found" };
  const contractsList = await db.select()
    .from(brandContracts)
    .where(and(eq(brandContracts.brandId, brandId), isNull(brandContracts.deletedAt)))
    .orderBy(desc(brandContracts.createdAt));
  const recentLivestreams = await db.select({
    id: brandLivestreams.id,
    livestreamDate: brandLivestreams.livestreamDate,
    streamerName: brandLivestreams.streamerName,
    salesAmount: brandLivestreams.salesAmount,
    gmv: brandLivestreams.gmv,
    duration: brandLivestreams.duration,
    viewerCount: brandLivestreams.viewerCount,
    orderCount: brandLivestreams.orderCount,
    platform: brandLivestreams.platform,
  })
    .from(brandLivestreams)
    .where(and(eq(brandLivestreams.brandId, brandId), isNull(brandLivestreams.deletedAt)))
    .orderBy(desc(brandLivestreams.livestreamDate))
    .limit(15);
  const recentVideos = await db.select({
    id: brandShortVideos.id,
    title: brandShortVideos.title,
    platform: brandShortVideos.platform,
    postDate: brandShortVideos.postDate,
    views: brandShortVideos.views,
    likes: brandShortVideos.likes,
  })
    .from(brandShortVideos)
    .where(and(eq(brandShortVideos.brandId, brandId), isNull(brandShortVideos.deletedAt)))
    .orderBy(desc(brandShortVideos.postDate))
    .limit(10);
  const products = await db.select({
    id: brandProducts.id,
    productName: brandProducts.productName,
    listPrice: brandProducts.listPrice,
  })
    .from(brandProducts)
    .where(eq(brandProducts.brandId, brandId))
    .limit(20);
  const activities = await db.select()
    .from(brandActivities)
    .where(eq(brandActivities.brandId, brandId))
    .orderBy(desc(brandActivities.activityDate))
    .limit(10);
  return {
    brand: { id: brand.id, name: brand.name, nameJa: brand.nameJa, companyName: brand.companyName, category: brand.category, status: brand.status, contactPerson: brand.contactPerson, commissionRate: brand.commissionRate, salesTarget: brand.salesTarget, memo: brand.memo },
    contracts: contractsList.map(c => ({ id: c.id, serviceType: c.serviceType, status: c.status, startDate: c.startDate, endDate: c.endDate, fixedFee: c.fixedFee, kgLiveHoursQuota: c.kgLiveHoursQuota, liverLiveHoursQuota: c.liverLiveHoursQuota, shortVideoCountQuota: c.shortVideoCountQuota })),
    recentLivestreams,
    recentVideos,
    products,
    recentActivities: activities.slice(0, 5),
  };
}

async function toolGetContracts(args: { status?: string; brandId?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const conditions: any[] = [isNull(brandContracts.deletedAt)];
  if (args.status) conditions.push(eq(brandContracts.status, args.status as any));
  if (args.brandId) conditions.push(eq(brandContracts.brandId, args.brandId));
  const result = await db.select({
    id: brandContracts.id,
    brandId: brandContracts.brandId,
    serviceType: brandContracts.serviceType,
    status: brandContracts.status,
    startDate: brandContracts.startDate,
    endDate: brandContracts.endDate,
    fixedFee: brandContracts.fixedFee,
    kgLiveHoursQuota: brandContracts.kgLiveHoursQuota,
    liverLiveHoursQuota: brandContracts.liverLiveHoursQuota,
    shortVideoCountQuota: brandContracts.shortVideoCountQuota,
  })
    .from(brandContracts)
    .where(and(...conditions))
    .orderBy(desc(brandContracts.updatedAt))
    .limit(50);
  return { total: result.length, contracts: result };
}

async function toolGetLivers(args: { search?: string; activeOnly?: boolean }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const conditions: any[] = [];
  if (args.activeOnly !== false) conditions.push(eq(livers.isActive, true));
  if (args.search) conditions.push(like(livers.name, `%${args.search}%`));
  const result = await db.select({
    id: livers.id,
    name: livers.name,
    tiktokAccount: livers.tiktokAccount,
    instagramAccount: livers.instagramAccount,
    youtubeAccount: livers.youtubeAccount,
    isActive: livers.isActive,
    color: livers.color,
  })
    .from(livers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(livers.name);
  return { total: result.length, livers: result };
}

async function toolGetLivestreamStats(args: { yearMonth?: string; liverName?: string; liverId?: number; brandId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const now = new Date();
  const year = args.yearMonth ? parseInt(args.yearMonth.split("-")[0]) : now.getFullYear();
  const month = args.yearMonth ? parseInt(args.yearMonth.split("-")[1]) : now.getMonth() + 1;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const conditions: any[] = [
    isNull(brandLivestreams.deletedAt),
    gte(brandLivestreams.livestreamDate, startDate),
    lte(brandLivestreams.livestreamDate, endDate),
  ];
  if (args.liverId) conditions.push(eq(brandLivestreams.liverId, args.liverId));
  if (args.liverName) conditions.push(like(brandLivestreams.streamerName, `%${args.liverName}%`));
  if (args.brandId) conditions.push(eq(brandLivestreams.brandId, args.brandId));
  // Summary
  const [summary] = await db.select({
    totalCount: count(),
    totalGmv: sum(brandLivestreams.gmv),
    totalSales: sum(brandLivestreams.salesAmount),
    totalDuration: sum(brandLivestreams.duration),
    totalViewers: sum(brandLivestreams.viewerCount),
    totalOrders: sum(brandLivestreams.orderCount),
  })
    .from(brandLivestreams)
    .where(and(...conditions));
  // Individual records
  const records = await db.select({
    id: brandLivestreams.id,
    livestreamDate: brandLivestreams.livestreamDate,
    streamerName: brandLivestreams.streamerName,
    salesAmount: brandLivestreams.salesAmount,
    gmv: brandLivestreams.gmv,
    duration: brandLivestreams.duration,
    viewerCount: brandLivestreams.viewerCount,
    orderCount: brandLivestreams.orderCount,
    platform: brandLivestreams.platform,
    brandId: brandLivestreams.brandId,
  })
    .from(brandLivestreams)
    .where(and(...conditions))
    .orderBy(desc(brandLivestreams.livestreamDate))
    .limit(args.limit || 30);
  return { period: `${year}-${String(month).padStart(2, '0')}`, summary, records };
}

async function toolGetLiverRanking(args: { months?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const monthsBack = args.months || 3;
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const result = await db.select({
    streamerName: brandLivestreams.streamerName,
    totalGmv: sum(brandLivestreams.gmv),
    totalSales: sum(brandLivestreams.salesAmount),
    totalDuration: sum(brandLivestreams.duration),
    liveCount: count(),
    avgViewers: sql<number>`AVG(${brandLivestreams.viewerCount})`,
  })
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),
      gte(brandLivestreams.livestreamDate, startDate)
    ))
    .groupBy(brandLivestreams.streamerName)
    .orderBy(desc(sum(brandLivestreams.gmv)))
    .limit(args.limit || 20);
  return { period: `近${monthsBack}ヶ月`, ranking: result };
}

async function toolGetSchedules(args: { days?: number; liverId?: number; brandId?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const days = args.days || 14;
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const conditions: any[] = [
    gte(schedules.startTime, now),
    lte(schedules.startTime, futureDate),
  ];
  if (args.liverId) conditions.push(eq(schedules.liverId, args.liverId));
  if (args.brandId) conditions.push(eq(schedules.brandId, args.brandId));
  const result = await db.select({
    id: schedules.id,
    title: schedules.title,
    startTime: schedules.startTime,
    endTime: schedules.endTime,
    category: schedules.category,
    brandId: schedules.brandId,
    liverId: schedules.liverId,
  })
    .from(schedules)
    .where(and(...conditions))
    .orderBy(schedules.startTime)
    .limit(50);
  return { period: `今後${days}日間`, total: result.length, schedules: result };
}

async function toolSearchKnowledgeBase(args: { query: string; category?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const searchTerms = args.query
    .replace(/[?？。，！\s]+/g, " ")
    .split(" ")
    .filter(t => t.length >= 2)
    .slice(0, 5);
  if (searchTerms.length === 0) return { results: [] };
  const conditions: any[] = [];
  const searchConditions = searchTerms.map(term =>
    or(
      like(lcjBrainKnowledge.title, `%${term}%`),
      like(lcjBrainKnowledge.content, `%${term}%`)
    )
  );
  conditions.push(or(...searchConditions));
  if (args.category) {
    conditions.push(eq(lcjBrainKnowledge.category, args.category));
  }
  const results = await db.select({
    id: lcjBrainKnowledge.id,
    title: lcjBrainKnowledge.title,
    category: lcjBrainKnowledge.category,
    summary: lcjBrainKnowledge.summary,
    content: lcjBrainKnowledge.content,
    meetingDate: lcjBrainKnowledge.meetingDate,
    participants: lcjBrainKnowledge.participants,
  })
    .from(lcjBrainKnowledge)
    .where(and(...conditions))
    .orderBy(desc(lcjBrainKnowledge.meetingDate))
    .limit(args.limit || 5);
  return {
    total: results.length,
    results: results.map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      summary: r.summary,
      meetingDate: r.meetingDate ? new Date(r.meetingDate).toISOString().split('T')[0] : null,
      participants: r.participants,
      content: r.content.length > 3000 ? r.content.substring(0, 3000) + "..." : r.content,
    })),
  };
}

async function toolGetTasksAndReports(args: { staffId?: number; status?: string; days?: number; type?: string }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const result: any = {};
  const days = args.days || 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  if (args.type !== "reports") {
    // Tasks
    const taskConditions: any[] = [];
    if (args.staffId) taskConditions.push(eq(tasks.staffId, args.staffId));
    if (args.status) taskConditions.push(eq(tasks.status, args.status as any));
    const taskList = await db.select({
      id: tasks.id,
      taskId: tasks.taskId,
      status: tasks.status,
      staffId: tasks.staffId,
      taskDetail: tasks.taskDetail,
      deadline: tasks.deadline,
      startDate: tasks.startDate,
    })
      .from(tasks)
      .where(taskConditions.length > 0 ? and(...taskConditions) : undefined)
      .orderBy(desc(tasks.startDate))
      .limit(30);
    result.tasks = { total: taskList.length, items: taskList };
  }
  if (args.type !== "tasks") {
    // Reports
    const reportConditions: any[] = [gte(reports.reportDate, since)];
    if (args.staffId) {
      // Find reportStaffId for this staffId
      const [rs] = await db.select({ id: reportStaff.id })
        .from(reportStaff)
        .where(eq(reportStaff.linkedStaffId, args.staffId))
        .limit(1);
      if (rs) reportConditions.push(eq(reports.reportStaffId, rs.id));
    }
    const reportList = await db.select({
      id: reports.id,
      reportStaffId: reports.reportStaffId,
      reportDate: reports.reportDate,
      workContent: reports.workContent,
      issues: reports.issues,
      remarks: reports.remarks,
    })
      .from(reports)
      .where(and(...reportConditions))
      .orderBy(desc(reports.reportDate))
      .limit(20);
    result.reports = { total: reportList.length, items: reportList };
  }
  return result;
}

async function toolGetMallData(args: { type?: string; days?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const dataType = args.type || "overview";
  const lim = args.limit || 30;
  const days = args.days || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  if (dataType === "orders" || dataType === "overview") {
    const orderList = await db.select({
      id: mallOrders.id,
      orderNumber: mallOrders.orderNumber,
      status: mallOrders.status,
      totalAmount: mallOrders.totalAmount,
      pointsUsed: mallOrders.pointsUsed,
      paymentMethod: mallOrders.paymentMethod,
      createdAt: mallOrders.createdAt,
    })
      .from(mallOrders)
      .where(gte(mallOrders.createdAt, since))
      .orderBy(desc(mallOrders.createdAt))
      .limit(lim);
    if (dataType === "orders") return { orders: orderList };
    // Overview: also get summary
    const [orderSummary] = await db.select({
      totalOrders: count(),
      totalRevenue: sum(mallOrders.totalAmount),
    })
      .from(mallOrders)
      .where(gte(mallOrders.createdAt, since));
    const [productCount] = await db.select({ total: count() }).from(mallProducts);
    return { summary: { ...orderSummary, totalProducts: productCount?.total || 0, period: `直近${days}日` }, recentOrders: orderList.slice(0, 10) };
  }
  if (dataType === "products") {
    const productList = await db.select({
      id: mallProducts.id,
      name: mallProducts.name,
      category: mallProducts.category,
    })
      .from(mallProducts)
      .orderBy(desc(mallProducts.updatedAt))
      .limit(lim);
    return { products: productList };
  }
  if (dataType === "points") {
    const balances = await db.select({
      id: pointBalances.id,
      userId: pointBalances.userId,
      balance: pointBalances.balance,
      totalEarned: pointBalances.totalEarned,
      totalUsed: pointBalances.totalUsed,
    })
      .from(pointBalances)
      .orderBy(desc(pointBalances.balance))
      .limit(lim);
    return { pointBalances: balances };
  }
  if (dataType === "receipts") {
    const receiptList = await db.select({
      id: receipts.id,
      userId: receipts.userId,
      storeName: receipts.storeName,
      totalAmount: receipts.totalAmount,
      pointsCalculated: receipts.pointsCalculated,
      status: receipts.status,
      createdAt: receipts.createdAt,
    })
      .from(receipts)
      .where(gte(receipts.createdAt, since))
      .orderBy(desc(receipts.createdAt))
      .limit(lim);
    return { receipts: receiptList };
  }
  return { error: "Invalid type" };
}

async function toolGetAdPerformance(args: { brandId?: number; yearMonth?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const conditions: any[] = [];
  if (args.brandId) conditions.push(eq(adInvestmentRecords.brandId, args.brandId));
  if (args.yearMonth) {
    const [year, month] = args.yearMonth.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    conditions.push(gte(adInvestmentRecords.investmentDate, startDate));
    conditions.push(lte(adInvestmentRecords.investmentDate, endDate));
  }
  const records = await db.select({
    id: adInvestmentRecords.id,
    brandId: adInvestmentRecords.brandId,
    investmentDate: adInvestmentRecords.investmentDate,
    adType: adInvestmentRecords.adType,
    totalBudget: adInvestmentRecords.totalBudget,
    actualGmv: adInvestmentRecords.actualGmv,
    actualImpressions: adInvestmentRecords.actualImpressions,
    actualClicks: adInvestmentRecords.actualClicks,
    actualConversions: adInvestmentRecords.actualConversions,
    actualRoas: adInvestmentRecords.actualRoas,
  })
    .from(adInvestmentRecords)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(adInvestmentRecords.investmentDate))
    .limit(args.limit || 30);
  // Also get brand-level stats if brandId specified
  let brandStats = null;
  if (args.brandId) {
    const [stats] = await db.select()
      .from(brandAdPerformanceStats)
      .where(eq(brandAdPerformanceStats.brandId, args.brandId))
      .limit(1);
    brandStats = stats || null;
  }
  return { total: records.length, records, brandStats };
}

async function toolGetLineData(args: { type?: string; groupId?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const dataType = args.type || "overview";
  const lim = args.limit || 20;
  if (dataType === "users" || dataType === "overview") {
    const users = await db.select({
      id: lineUsers.id,
      lineUserId: lineUsers.lineUserId,
      displayName: lineUsers.displayName,
      userType: lineUsers.userType,
      brandId: lineUsers.brandId,
      lastMessageAt: lineUsers.lastMessageAt,
    })
      .from(lineUsers)
      .where(eq(lineUsers.isBlocked, false))
      .orderBy(desc(lineUsers.lastMessageAt))
      .limit(lim);
    if (dataType === "users") return { users };
    // Overview
    const groups = await db.select({
      id: lineGroups.id,
      lineGroupId: lineGroups.lineGroupId,
      groupName: lineGroups.groupName,
      brandId: lineGroups.brandId,
      isActive: lineGroups.isActive,
    })
      .from(lineGroups)
      .where(eq(lineGroups.isActive, true))
      .limit(20);
    return { totalUsers: users.length, recentUsers: users.slice(0, 10), groups };
  }
  if (dataType === "groups") {
    const groups = await db.select({
      id: lineGroups.id,
      lineGroupId: lineGroups.lineGroupId,
      groupName: lineGroups.groupName,
      brandId: lineGroups.brandId,
      isActive: lineGroups.isActive,
      lastMessageAt: lineGroups.lastMessageAt,
    })
      .from(lineGroups)
      .orderBy(desc(lineGroups.lastMessageAt))
      .limit(lim);
    return { groups };
  }
  if (dataType === "messages") {
    const conditions: any[] = [];
    if (args.groupId) conditions.push(eq(lineMessages.lineGroupId, args.groupId));
    const messages = await db.select({
      id: lineMessages.id,
      sourceType: lineMessages.sourceType,
      senderName: lineMessages.senderName,
      messageType: lineMessages.messageType,
      content: lineMessages.content,
      direction: lineMessages.direction,
      createdAt: lineMessages.createdAt,
    })
      .from(lineMessages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(lineMessages.createdAt))
      .limit(lim);
    return { messages };
  }
  return { error: "Invalid type" };
}

async function toolGetSalesBdData(args: { type?: string; status?: string; days?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const dataType = args.type || "overview";
  const lim = args.limit || 30;
  const days = args.days || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  if (dataType === "cards" || dataType === "overview") {
    const conditions: any[] = [];
    if (args.status) conditions.push(eq(businessCards.salesStatus, args.status as any));
    const cards = await db.select({
      id: businessCards.id,
      company: businessCards.company,
      name: businessCards.name,
      position: businessCards.position,
      email: businessCards.email,
      phone: businessCards.phone,
      salesStatus: businessCards.salesStatus,
      createdAt: businessCards.createdAt,
    })
      .from(businessCards)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(businessCards.createdAt))
      .limit(lim);
    if (dataType === "cards") return { cards };
    // Overview
    const [leadCount] = await db.select({ total: count() }).from(leads);
    const recentCalls = await db.select({
      id: callLogs.id,
      result: callLogs.result,
      calledAt: callLogs.calledAt,
      contactCompany: callLogs.contactCompany,
    })
      .from(callLogs)
      .where(gte(callLogs.calledAt, since))
      .orderBy(desc(callLogs.calledAt))
      .limit(10);
    return { totalCards: cards.length, totalLeads: leadCount?.total || 0, recentCards: cards.slice(0, 10), recentCalls };
  }
  if (dataType === "leads") {
    const conditions: any[] = [];
    if (args.status) conditions.push(eq(leads.status, args.status));
    const leadList = await db.select({
      id: leads.id,
      companyName: leads.companyName,
      email: leads.email,
      category: leads.category,
      source: leads.source,
      status: leads.status,
      contactPerson: leads.contactPerson,
      createdAt: leads.createdAt,
    })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leads.createdAt))
      .limit(lim);
    return { leads: leadList };
  }
  if (dataType === "calls") {
    const callList = await db.select({
      id: callLogs.id,
      contactName: callLogs.contactName,
      contactCompany: callLogs.contactCompany,
      result: callLogs.result,
      memo: callLogs.memo,
      calledAt: callLogs.calledAt,
      duration: callLogs.duration,
    })
      .from(callLogs)
      .where(gte(callLogs.calledAt, since))
      .orderBy(desc(callLogs.calledAt))
      .limit(lim);
    return { calls: callList };
  }
  if (dataType === "emails") {
    const emailList = await db.select({
      id: salesEmailLogs.id,
      toEmail: salesEmailLogs.toEmail,
      toCompany: salesEmailLogs.toCompany,
      subject: salesEmailLogs.subject,
      sendType: salesEmailLogs.sendType,
      status: salesEmailLogs.status,
      sentAt: salesEmailLogs.sentAt,
    })
      .from(salesEmailLogs)
      .where(gte(salesEmailLogs.sentAt, since))
      .orderBy(desc(salesEmailLogs.sentAt))
      .limit(lim);
    return { emails: emailList };
  }
  if (dataType === "activities") {
    const actList = await db.select({
      id: salesActivities.id,
      businessCardId: salesActivities.businessCardId,
      activityType: salesActivities.activityType,
      description: salesActivities.description,
      createdAt: salesActivities.createdAt,
    })
      .from(salesActivities)
      .where(gte(salesActivities.createdAt, since))
      .orderBy(desc(salesActivities.createdAt))
      .limit(lim);
    return { activities: actList };
  }
  return { error: "Invalid type" };
}

async function toolGetLcjCoinData(args: { type?: string; holderId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const dataType = args.type || "overview";
  const lim = args.limit || 20;
  if (dataType === "holdings" || dataType === "overview" || dataType === "ranking") {
    const conditions: any[] = [];
    if (args.holderId) conditions.push(eq(lcjCoinHoldings.holderId, args.holderId));
    const holdings = await db.select({
      id: lcjCoinHoldings.id,
      holderType: lcjCoinHoldings.holderType,
      holderId: lcjCoinHoldings.holderId,
      totalCoins: lcjCoinHoldings.totalCoins,
      vestedCoins: lcjCoinHoldings.vestedCoins,
      exercisedCoins: lcjCoinHoldings.exercisedCoins,
      level: lcjCoinHoldings.level,
      xp: lcjCoinHoldings.xp,
      tierCode: lcjCoinHoldings.tierCode,
    })
      .from(lcjCoinHoldings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(lcjCoinHoldings.totalCoins))
      .limit(lim);
    if (dataType === "holdings" || dataType === "ranking") return { holdings };
    // Overview
    const [totals] = await db.select({
      totalHolders: count(),
      totalCoinsIssued: sum(lcjCoinHoldings.totalCoins),
      totalVested: sum(lcjCoinHoldings.vestedCoins),
    }).from(lcjCoinHoldings);
    return { summary: totals, topHolders: holdings.slice(0, 10) };
  }
  if (dataType === "transactions") {
    const conditions: any[] = [];
    if (args.holderId) conditions.push(eq(lcjCoinTransactions.holderId, args.holderId));
    const txns = await db.select({
      id: lcjCoinTransactions.id,
      holderType: lcjCoinTransactions.holderType,
      holderId: lcjCoinTransactions.holderId,
      transactionType: lcjCoinTransactions.transactionType,
      coinAmount: lcjCoinTransactions.coinAmount,
      createdAt: lcjCoinTransactions.createdAt,
    })
      .from(lcjCoinTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(lcjCoinTransactions.createdAt))
      .limit(lim);
    return { transactions: txns };
  }
  return { error: "Invalid type" };
}

async function toolGetTiktokReports(args: { brandId?: number; reportMonth?: string; type?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return { error: "DB unavailable" };
  const dataType = args.type || "cap_creator";
  const lim = args.limit || 30;
  if (dataType === "tap") {
    const conditions: any[] = [];
    if (args.brandId) conditions.push(eq(tiktokTapReports.brandId, args.brandId));
    if (args.reportMonth) conditions.push(eq(tiktokTapReports.reportMonth, args.reportMonth));
    const records = await db.select({
      id: tiktokTapReports.id,
      brandId: tiktokTapReports.brandId,
      reportMonth: tiktokTapReports.reportMonth,
      creatorUsername: tiktokTapReports.creatorUsername,
      productName: tiktokTapReports.productName,
    })
      .from(tiktokTapReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tiktokTapReports.reportMonth))
      .limit(lim);
    return { type: "tap", records };
  }
  if (dataType === "cap_creator") {
    const conditions: any[] = [];
    if (args.brandId) conditions.push(eq(tiktokCapCreatorReports.brandId, args.brandId));
    if (args.reportMonth) conditions.push(eq(tiktokCapCreatorReports.reportMonth, args.reportMonth));
    const records = await db.select({
      id: tiktokCapCreatorReports.id,
      brandId: tiktokCapCreatorReports.brandId,
      reportMonth: tiktokCapCreatorReports.reportMonth,
      creatorUsername: tiktokCapCreatorReports.creatorUsername,
      affiliateGmv: tiktokCapCreatorReports.affiliateGmv,
      affiliateLiveGmv: tiktokCapCreatorReports.affiliateLiveGmv,
      affiliateVideoGmv: tiktokCapCreatorReports.affiliateVideoGmv,
    })
      .from(tiktokCapCreatorReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tiktokCapCreatorReports.reportMonth))
      .limit(lim);
    return { type: "cap_creator", records };
  }
  if (dataType === "cap_product") {
    const conditions: any[] = [];
    if (args.brandId) conditions.push(eq(tiktokCapProductReports.brandId, args.brandId));
    if (args.reportMonth) conditions.push(eq(tiktokCapProductReports.reportMonth, args.reportMonth));
    const records = await db.select({
      id: tiktokCapProductReports.id,
      brandId: tiktokCapProductReports.brandId,
      reportMonth: tiktokCapProductReports.reportMonth,
      creatorUsername: tiktokCapProductReports.creatorUsername,
      productName: tiktokCapProductReports.productName,
    })
      .from(tiktokCapProductReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tiktokCapProductReports.reportMonth))
      .limit(lim);
    return { type: "cap_product", records };
  }
  return { error: "Invalid type" };
}

// ============================================================
// Raw LLM Call (preserves tool_calls in assistant messages)
// ============================================================

type RawMessage = {
  role: string;
  content?: string | any[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export async function invokeLLMWithTools(params: {
  model?: string;
  messages: RawMessage[];
  tools?: Tool[];
  tool_choice?: string;
}): Promise<InvokeResult> {
  const apiUrl = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://api.openai.com/v1/chat/completions";
  if (!ENV.forgeApiKey) throw new Error("API key not configured");

  const payload: Record<string, unknown> = {
    model: params.model || "gpt-4.1-mini",
    messages: params.messages,
    max_tokens: 16384,
  };
  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
  }
  if (params.tool_choice) {
    payload.tool_choice = params.tool_choice;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} – ${errorText.substring(0, 200)}`);
  }
  return (await response.json()) as InvokeResult;
}
