/**
 * LCJ Brain - AI BD引擎
 * LCJの全データ（主播・品牌・直播・合同・短視頻等）を接続した
 * AI対話型BD支援システム。宝典の知識を内蔵し、実データに基づいて回答する。
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import {
  brands,
  brandContracts,
  brandLivestreams,
  brandShortVideos,
  livers,
  staff,
  schedules,
  brandProducts,
  lcjBrainChatLogs,
  lcjBrainConversations,
  lcjBrainKnowledge,
} from "../drizzle/schema";
import { eq, desc, and, gte, lte, isNull, sql, like, or, count, sum } from "drizzle-orm";

// Auto-migration for conversations table + knowledge base table
let _migrated = false;
async function ensureConversationsTable() {
  if (_migrated) return;
  _migrated = true;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS lcj_brain_conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      userName VARCHAR(100),
      title VARCHAR(255) NOT NULL,
      context VARCHAR(50) DEFAULT 'chat',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_userId (userId),
      INDEX idx_updatedAt (updatedAt)
    )`);
    await db.execute(sql`ALTER TABLE lcj_brain_chat_logs ADD COLUMN IF NOT EXISTS conversationId INT DEFAULT NULL`);
  } catch (e) { /* table exists */ }
  // Knowledge base table
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS lcj_brain_knowledge (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'meeting',
      content LONGTEXT NOT NULL,
      summary TEXT,
      participants JSON,
      tags JSON,
      meetingDate TIMESTAMP NULL,
      sourceFileName VARCHAR(500),
      uploadedBy INT,
      uploadedByName VARCHAR(100),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      FULLTEXT INDEX idx_content (title, content),
      INDEX idx_category (category),
      INDEX idx_meetingDate (meetingDate)
    )`);
  } catch (e) { /* table exists */ }
  // Ensure content is LONGTEXT (upgrade from TEXT if needed)
  try {
    await db.execute(sql`ALTER TABLE lcj_brain_knowledge MODIFY COLUMN content LONGTEXT NOT NULL`);
  } catch (e) { /* ignore */ }
}


// ============================================================
// 宝典知識ベース（システムプロンプトに組み込む）
// ============================================================
const BD_KNOWLEDGE_BASE = `
# LCJ品牌招商成交宝典 - 核心知識

## 核心理念
BD不是销售，是给品牌看病（医生式BD）。先问诊再开方。

## 品牌问诊10问（必须问）
1. 你们现在有没有TikTok日区店铺？
2. 是日本主体还是中国主体？
3. 有没有日本库存？
4. 产品目前在哪些市场销售？
5. 中国市场销量怎么样？
6. 毛利空间有多少？
7. 能不能支持达人佣金？
8. 是否接受先测试再放大？
9. 目前最想解决的是曝光、销售，还是渠道进入？
10. 是否有直播/达人合作经验？

## 客户心理学
- 客户不是怕花钱，是怕花冤枉钱
- 客户问ROI不能随便承诺，要拆解环节
- 客户喜欢纯佣因为看起来没风险，但纯佣没有优先级和推进责任
- 客户压价是在测试你的底气
- 客户怼你是在测试你的专业度

## 谈判原则
- 谈判是拉扯，气场比话术重要
- 不能太好说话（客户会觉得你缺客户、价格虚）
- 拉扯不是强硬，是掌控节奏
- 客户说贵时，不要马上解释价格，要把注意力拉回项目本身

## 产品判断6维度
1. 停留率 - 3秒决定是否继续看，需要视觉刺激
2. 表达力 - 达人容易表达的产品才适合TikTok
3. 客单价 - 太便宜cover不了成本，太贵用户不冲动下单
4. 毛利 - 要帮客户算账（佣金+平台抽佣+广告费+运费+退货率）
5. 物流 - 跨境POP物流是利润黑洞，日本对包装时效要求高
6. 复购 - 有复购的产品适合长期运营（美妆>3C）

## 话术原则
- 错误话术："我们是日本头部MCN" "我们有KG老师" "我们做过多少GMV"
- 正确话术："我先了解一下你们目前日本市场的情况"
- 客户说"别人都纯佣" → "可以理解。纯佣和项目运营型合作本质上不是同一种服务"
- 客户说"你们太贵" → 不要马上降价，要让客户理解价值
- 安心感和稳定的气场是成交的关键

## BD跟进SOP
1. 第1次接触：问诊（不介绍公司）
2. 第2次接触：发送诊断报告 + 方案
3. 第3次接触：商务谈判
4. 第4次接触：签约
`;

// ============================================================
// データ取得ヘルパー関数
// ============================================================

/** 全ブランド概要を取得 */
async function getAllBrandsSummary() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: brands.id,
      name: brands.name,
      nameJa: brands.nameJa,
      companyName: brands.companyName,
      category: brands.category,
      status: brands.status,
      materialCategory: brands.materialCategory,
      contactPerson: brands.contactPerson,
      salesTarget: brands.salesTarget,
      commissionRate: brands.commissionRate,
      memo: brands.memo,
    })
    .from(brands)
    .where(isNull(brands.deletedAt))
    .orderBy(desc(brands.updatedAt))
    .limit(100);
  return result;
}

/** 特定ブランドの詳細情報を取得 */
async function getBrandDetail(brandId: number) {
  const db = await getDb();
  if (!db) return null;
  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.deletedAt)));
  if (!brand) return null;

  // 合同情報
  const contracts = await db
    .select()
    .from(brandContracts)
    .where(and(eq(brandContracts.brandId, brandId), isNull(brandContracts.deletedAt)))
    .orderBy(desc(brandContracts.createdAt));

  // 直近の直播実績
  const recentLivestreams = await db
    .select({
      id: brandLivestreams.id,
      livestreamDate: brandLivestreams.livestreamDate,
      streamerName: brandLivestreams.streamerName,
      salesAmount: brandLivestreams.salesAmount,
      duration: brandLivestreams.duration,
      viewerCount: brandLivestreams.viewerCount,
      orderCount: brandLivestreams.orderCount,
      gmv: brandLivestreams.gmv,
      platform: brandLivestreams.platform,
    })
    .from(brandLivestreams)
    .where(and(eq(brandLivestreams.brandId, brandId), isNull(brandLivestreams.deletedAt)))
    .orderBy(desc(brandLivestreams.livestreamDate))
    .limit(20);

  // 短視頻実績
  const recentVideos = await db
    .select()
    .from(brandShortVideos)
    .where(and(eq(brandShortVideos.brandId, brandId), isNull(brandShortVideos.deletedAt)))
    .orderBy(desc(brandShortVideos.postDate))
    .limit(20);

  // 商品情報
  const products = await db
    .select()
    .from(brandProducts)
    .where(eq(brandProducts.brandId, brandId))
    .limit(50);

  return { brand, contracts, recentLivestreams, recentVideos, products };
}

/** 全ライバー概要を取得 */
async function getAllLiversSummary() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: livers.id,
      name: livers.name,
      tiktokAccount: livers.tiktokAccount,
      instagramAccount: livers.instagramAccount,
      youtubeAccount: livers.youtubeAccount,
      isActive: livers.isActive,
      color: livers.color,
    })
    .from(livers)
    .where(eq(livers.isActive, true))
    .orderBy(livers.name);
  return result;
}

/** 今月の直播実績サマリー */
async function getMonthlyLivestreamSummary(yearMonth?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  const year = yearMonth ? parseInt(yearMonth.split("-")[0]) : now.getFullYear();
  const month = yearMonth ? parseInt(yearMonth.split("-")[1]) : now.getMonth() + 1;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const result = await db
    .select({
      totalCount: count(),
      totalGmv: sum(brandLivestreams.gmv),
      totalSales: sum(brandLivestreams.salesAmount),
      totalDuration: sum(brandLivestreams.duration),
      totalViewers: sum(brandLivestreams.viewerCount),
      totalOrders: sum(brandLivestreams.orderCount),
    })
    .from(brandLivestreams)
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        gte(brandLivestreams.livestreamDate, startDate),
        lte(brandLivestreams.livestreamDate, endDate)
      )
    );

  return { year, month, ...result[0] };
}

/** スケジュール（今後の予定）を取得 */
async function getUpcomingSchedules(days: number = 14) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  const result = await db
    .select({
      id: schedules.id,
      title: schedules.title,
      startTime: schedules.startTime,
      endTime: schedules.endTime,
      type: schedules.type,
      brandId: schedules.brandId,
      liverId: schedules.liverId,
    })
    .from(schedules)
    .where(
      and(
        gte(schedules.startTime, now),
        lte(schedules.startTime, futureDate)
      )
    )
    .orderBy(schedules.startTime)
    .limit(50);
  return result;
}

/** ライバー別の直播実績を取得 */
async function getLiverPerformance(liverId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  
  let query = db
    .select({
      streamerName: brandLivestreams.streamerName,
      totalGmv: sum(brandLivestreams.gmv),
      totalSales: sum(brandLivestreams.salesAmount),
      totalDuration: sum(brandLivestreams.duration),
      liveCount: count(),
      avgViewers: sql<number>`AVG(${brandLivestreams.viewerCount})`,
    })
    .from(brandLivestreams)
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        gte(brandLivestreams.livestreamDate, threeMonthsAgo)
      )
    )
    .groupBy(brandLivestreams.streamerName)
    .orderBy(desc(sum(brandLivestreams.gmv)))
    .limit(30);

  return await query;
}

/** ユーザーメッセージから月を検出 (e.g., "4月" -> "2026-04", "去年12月" -> "2025-12") */
function detectMonth(message: string): string | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // パターン: "2026年4月", "2026-04", "2026/04"
  const fullMatch = message.match(/(20\d{2})[年\-\/](\d{1,2})[月份]?/);
  if (fullMatch) {
    return `${fullMatch[1]}-${String(parseInt(fullMatch[2])).padStart(2, '0')}`;
  }
  
  // パターン: "去年X月"
  const lastYearMatch = message.match(/去年(\d{1,2})[月份]/);
  if (lastYearMatch) {
    return `${currentYear - 1}-${String(parseInt(lastYearMatch[1])).padStart(2, '0')}`;
  }
  
  // パターン: "上个月" / "先月"
  if (/上个月|上月|先月/.test(message)) {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }
  
  // パターン: "X月份" / "X月"
  const monthMatch = message.match(/(\d{1,2})[月份]/);
  if (monthMatch) {
    const m = parseInt(monthMatch[1]);
    if (m >= 1 && m <= 12) {
      // 未来の月なら去年と判断
      const year = m > currentMonth ? currentYear - 1 : currentYear;
      return `${year}-${String(m).padStart(2, '0')}`;
    }
  }
  
  // パターン: "今月" / "本月" / "这个月"
  if (/今月|本月|这个月|当月/.test(message)) {
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  }
  
  return null;
}

/** ユーザーメッセージからライバー名を検出 */
async function detectLiverName(message: string): Promise<{ id: number; name: string } | null> {
  const db = await getDb();
  if (!db) return null;
  
  const allLivers = await db
    .select({ id: livers.id, name: livers.name })
    .from(livers)
    .where(eq(livers.isActive, true));
  
  const lowerMsg = message.toLowerCase();
  for (const liver of allLivers) {
    if (lowerMsg.includes(liver.name.toLowerCase())) {
      return liver;
    }
  }
  return null;
}

/** 特定ライバーの特定月の実績を取得（liverIdベースで正確にクエリ） */
async function getLiverMonthlyPerformance(liverId: number, liverName: string, yearMonth: string) {
  const db = await getDb();
  if (!db) return null;
  
  // JST基準の月範囲を計算（db.tsのgetJSTMonthRangeと同じロジック）
  const [year, monthNum] = yearMonth.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = new Date(Date.UTC(year, monthNum - 1, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);
  
  // liverId で検索（ライバーページと同じ方法）
  const streams = await db
    .select({
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
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        eq(brandLivestreams.liverId, liverId),
        gte(brandLivestreams.livestreamDate, startDate),
        lte(brandLivestreams.livestreamDate, endDate)
      )
    )
    .orderBy(desc(brandLivestreams.livestreamDate));
  
  if (streams.length === 0) return null;
  
  const totalSales = streams.reduce((sum, s) => sum + (s.salesAmount || 0), 0);
  const totalGmv = streams.reduce((sum, s) => sum + (s.gmv || 0), 0);
  const totalDuration = streams.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalViewers = streams.reduce((sum, s) => sum + (s.viewerCount || 0), 0);
  const totalOrders = streams.reduce((sum, s) => sum + (s.orderCount || 0), 0);
  
  return {
    liverName,
    yearMonth,
    totalStreams: streams.length,
    totalSales,
    totalGmv,
    totalDuration,
    totalViewers,
    totalOrders,
    streams: streams.slice(0, 10),
  };
}

/** 全合同の進捗サマリー */
async function getContractsSummary() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
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
    .where(and(eq(brandContracts.status, "契約中"), isNull(brandContracts.deletedAt)))
    .orderBy(desc(brandContracts.updatedAt))
    .limit(50);
  return result;
}

// ============================================================
// コンテキスト構築（質問に応じて必要なデータを取得）
// ============================================================

async function buildContext(userMessage: string): Promise<string> {
  const contextParts: string[] = [];
  const lowerMsg = userMessage.toLowerCase();
  
  // 月とライバー名を検出
  const detectedMonth = detectMonth(userMessage);
  const detectedLiver = await detectLiverName(userMessage);
  
  // キーワードに基づいてデータを取得
  const needsBrands = /品牌|ブランド|brand|客户|顾客|合作|签约|mytrex|合同|契約/.test(lowerMsg);
  const needsLivers = /主播|ライバー|liver|达人|KOL|配信者|直播员/.test(lowerMsg) || !!detectedLiver;
  const needsLivestreams = /直播|ライブ|配信|GMV|売上|销售额|时长|実績|营业额|业绩|收入/.test(lowerMsg) || !!detectedLiver;
  const needsSchedule = /排期|スケジュール|schedule|空档|予定|今後|来週|下周/.test(lowerMsg);
  const needsVideos = /短视频|短動画|ショート|video|投稿|发布/.test(lowerMsg);
  const needsContracts = /合同|契約|contract|ノルマ|配额|进度|quota/.test(lowerMsg);
  const needsBD = /BD|招商|话术|谈判|成交|客户|怎么谈|怎么聊|怎么回|怎么说|如何/.test(lowerMsg);
  
  // 全般的な質問の場合はすべて取得
  const isGeneral = !needsBrands && !needsLivers && !needsLivestreams && !needsSchedule && !needsVideos && !needsContracts && !needsBD;
  
  // ★ 特定ライバー + 特定月のデータを優先的に取得
  if (detectedLiver) {
    const targetMonth = detectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const liverMonthly = await getLiverMonthlyPerformance(detectedLiver.id, detectedLiver.name, targetMonth);
    if (liverMonthly) {
      contextParts.push(`## 主播「${detectedLiver.name}」${targetMonth}月实绩数据\n- 总场次: ${liverMonthly.totalStreams}\n- 总销售额: ${liverMonthly.totalSales.toLocaleString()}円\n- 总GMV: ${liverMonthly.totalGmv.toLocaleString()}円\n- 总时长: ${liverMonthly.totalDuration}分钟\n- 总观看: ${liverMonthly.totalViewers}\n- 总订单: ${liverMonthly.totalOrders}\n\n近期配信详细:\n${JSON.stringify(liverMonthly.streams, null, 0)}`);
    } else {
      contextParts.push(`## 主播「${detectedLiver.name}」${targetMonth}月\n该月无配信记录。`);
    }
    
    // 指定月がない場合、近〶3ヶ月のデータも追加
    if (!detectedMonth) {
      const liverPerf = await getLiverPerformance();
      const thisLiverPerf = liverPerf.find((p: any) => 
        p.streamerName && p.streamerName.toLowerCase() === detectedLiver.name.toLowerCase()
      );
      if (thisLiverPerf) {
        contextParts.push(`## 主播「${detectedLiver.name}」近3个月累计\n${JSON.stringify(thisLiverPerf, null, 0)}`);
      }
    }
  }
  
  // 特定月が指定されている場合、その月の全体データも取得
  if (detectedMonth && !detectedLiver) {
    const monthlySummary = await getMonthlyLivestreamSummary(detectedMonth);
    if (monthlySummary) {
      contextParts.push(`## ${detectedMonth}月直播实绩汇总\n- 总场次: ${monthlySummary.totalCount}\n- 总GMV: ${monthlySummary.totalGmv || 0}円\n- 总销售额: ${monthlySummary.totalSales || 0}円\n- 总时长: ${monthlySummary.totalDuration || 0}分钟\n- 总观看: ${monthlySummary.totalViewers || 0}\n- 总订单: ${monthlySummary.totalOrders || 0}`);
    }
  }
  
  if (needsBrands || isGeneral) {
    const brandsSummary = await getAllBrandsSummary();
    if (brandsSummary.length > 0) {
      contextParts.push(`## 当前品牌一览（共${brandsSummary.length}个）\n${JSON.stringify(brandsSummary.map(b => ({
        id: b.id, name: b.name, nameJa: b.nameJa, company: b.companyName, 
        category: b.category || b.materialCategory, status: b.status,
        contact: b.contactPerson
      })), null, 0)}`);
    }
  }

  if ((needsLivers || isGeneral) && !detectedLiver) {
    const liversSummary = await getAllLiversSummary();
    if (liversSummary.length > 0) {
      contextParts.push(`## 当前活跃主播一览（共${liversSummary.length}人）\n${JSON.stringify(liversSummary.map(l => ({
        id: l.id, name: l.name, tiktok: l.tiktokAccount, ig: l.instagramAccount
      })), null, 0)}`);
    }
  }

  if ((needsLivestreams || isGeneral) && !detectedLiver && !detectedMonth) {
    const monthlySummary = await getMonthlyLivestreamSummary();
    if (monthlySummary) {
      contextParts.push(`## 本月直播实绩汇总\n- 总场次: ${monthlySummary.totalCount}\n- 总GMV: ${monthlySummary.totalGmv || 0}円\n- 总销售额: ${monthlySummary.totalSales || 0}円\n- 总时长: ${monthlySummary.totalDuration || 0}分钟\n- 总观看: ${monthlySummary.totalViewers || 0}\n- 总订单: ${monthlySummary.totalOrders || 0}`);
    }
    
    const liverPerf = await getLiverPerformance();
    if (liverPerf.length > 0) {
      contextParts.push(`## 近3个月主播业绩排名\n${JSON.stringify(liverPerf, null, 0)}`);
    }
  }

  if (needsSchedule) {
    const upcoming = await getUpcomingSchedules();
    if (upcoming.length > 0) {
      contextParts.push(`## 今後2週間のスケジュール\n${JSON.stringify(upcoming, null, 0)}`);
    }
  }

  if (needsContracts || needsBrands) {
    const contracts = await getContractsSummary();
    if (contracts.length > 0) {
      contextParts.push(`## 当前有效合同一览\n${JSON.stringify(contracts, null, 0)}`);
    }
  }

  // 特定ブランド名が言及されている場合、詳細を取得
  const brandsSummary = await getAllBrandsSummary();
  for (const b of brandsSummary) {
    if (lowerMsg.includes(b.name.toLowerCase()) || (b.nameJa && lowerMsg.includes(b.nameJa.toLowerCase()))) {
      const detail = await getBrandDetail(b.id);
      if (detail) {
        contextParts.push(`## 品牌「${b.name}」详细数据\n${JSON.stringify({
          brand: { id: detail.brand.id, name: detail.brand.name, status: detail.brand.status, category: detail.brand.category },
          contracts: detail.contracts.map(c => ({ type: c.serviceType, status: c.status, start: c.startDate, end: c.endDate, kgQuota: c.kgLiveHoursQuota, liverQuota: c.liverLiveHoursQuota, videoQuota: c.shortVideoCountQuota })),
          recentLivestreams: detail.recentLivestreams.slice(0, 10),
          recentVideos: detail.recentVideos.slice(0, 10),
          products: detail.products.slice(0, 10).map(p => ({ id: p.id, name: p.name })),
        }, null, 0)}`);
      }
      break; // 1ブランドのみ詳細取得
    }
  }

  // ★ 知識庫RAG検索：ユーザーの質問に関連する纪要を検索して追加
  try {
    const db = await getDb();
    if (db) {
      // キーワード検索（LIKE）で関連纪要を取得
      const searchTerms = userMessage
        .replace(/[?？。，！\s]+/g, " ")
        .split(" ")
        .filter(t => t.length >= 2)
        .slice(0, 5);
      
      let knowledgeResults: any[] = [];
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map(term => 
          or(
            like(lcjBrainKnowledge.title, `%${term}%`),
            like(lcjBrainKnowledge.content, `%${term}%`)
          )
        );
        knowledgeResults = await db.select({
          id: lcjBrainKnowledge.id,
          title: lcjBrainKnowledge.title,
          category: lcjBrainKnowledge.category,
          summary: lcjBrainKnowledge.summary,
          content: lcjBrainKnowledge.content,
          meetingDate: lcjBrainKnowledge.meetingDate,
          participants: lcjBrainKnowledge.participants,
        })
          .from(lcjBrainKnowledge)
          .where(or(...searchConditions))
          .orderBy(desc(lcjBrainKnowledge.meetingDate))
          .limit(5);
      }

      // 検索結果がない場合、最新5件を取得（一般的な質問対応）
      if (knowledgeResults.length === 0 && isGeneral) {
        knowledgeResults = await db.select({
          id: lcjBrainKnowledge.id,
          title: lcjBrainKnowledge.title,
          category: lcjBrainKnowledge.category,
          summary: lcjBrainKnowledge.summary,
          content: lcjBrainKnowledge.content,
          meetingDate: lcjBrainKnowledge.meetingDate,
          participants: lcjBrainKnowledge.participants,
        })
          .from(lcjBrainKnowledge)
          .orderBy(desc(lcjBrainKnowledge.meetingDate))
          .limit(3);
      }

      if (knowledgeResults.length > 0) {
        const knowledgeContext = knowledgeResults.map(k => {
          const dateStr = k.meetingDate ? new Date(k.meetingDate).toISOString().split('T')[0] : '未知';
          const contentPreview = k.content.length > 2000 ? k.content.substring(0, 2000) + "..." : k.content;
          return `### ${k.title} (${dateStr})\n参会人: ${k.participants ? (k.participants as string[]).join(', ') : '未记录'}\n摘要: ${k.summary || '无'}\n内容: ${contentPreview}`;
        }).join("\n\n");
        contextParts.push(`## 知识库相关纪要（共${knowledgeResults.length}条）\n${knowledgeContext}`);
      }
    }
  } catch (e) {
    console.error("[LCJ Brain] Knowledge RAG search error:", e);
  }

  return contextParts.join("\n\n");
}

// ============================================================
// LCJ Brain ルーター
// ============================================================

export const lcjBrainRouter = router({
  /** AI対話（メイン機能） */
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1),
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional().default([]),
      context: z.enum(["general", "bd", "brand_analysis", "liver_match", "talk_script"]).optional().default("general"),
      conversationId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureConversationsTable();
      const { message, history, context } = input;
      const userName = ctx.user?.name || ctx.user?.email || "unknown";
      const userId = ctx.user?.id || null;

      // 実データコンテキストを構築
      const dataContext = await buildContext(message);

      // システムプロンプト構築
      const systemPrompt = `你是LCJ Brain，Live Commerce Japan（LCJ）的AI大脑。你连接着LCJ的所有数据（品牌、主播、直播实绩、合同、短视频等），能够基于实际数据给出精准的分析和建议。

## 你的角色
- LCJ的BD智能助手，帮助BD团队做出更好的决策
- 基于《LCJ品牌招商成交宝典》的知识体系，提供专业的BD指导
- 你还连接着公司的「知识库」，包含历史会议纪要、日报、SOP等。当用户问到相关内容时，优先引用知识库中的信息。
- 所有回答必须基于实际数据，不能编造数据
- 如果数据不足，要明确说明“当前数据中没有相关信息”
- 当引用知识库内容时，请标注来源（例如：“根据5月21日运营&商务内部会议纪要...”）

## 回答原则
1. 基于实际数据回答，引用具体数字
2. 结合宝典知识给出BD建议
3. 语言简洁有力，像一个资深BD顾问
4. 如果涉及话术建议，要给出具体的话术示例
5. 回答用中文（除非用户用日语提问则用日语回答）

${BD_KNOWLEDGE_BASE}

## 当前实际数据
${dataContext || "（暂无相关数据）"}

## 重要提醒
- 所有数字和数据必须来自上面的"当前实际数据"部分
- 如果用户问的数据不在上面，要说明"系统中暂无此数据"
- 不要编造任何数据或信息`;

      // メッセージ履歴を構築
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      // 過去の会話履歴を追加（最新10件まで）
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }

      // ユーザーの新しいメッセージ
      messages.push({ role: "user", content: message });

      try {
        const result = await invokeLLM({
          model: "gpt-4.1-mini",
          messages,
        });

        const aiContent = result.choices?.[0]?.message?.content;
        const responseText = typeof aiContent === "string" 
          ? aiContent 
          : Array.isArray(aiContent) 
            ? aiContent.map(p => (p as any).text || "").join("") 
            : "申し訳ありません。回答を生成できませんでした。";

        // 後続質問を生成
        let suggestedQuestions: string[] = [];
        try {
          const suggestResult = await invokeLLM({
            model: "gpt-4.1-nano",
            messages: [
              { role: "system", content: "基于用户的问题和AI的回答，生成3个相关的后续问题建议。这些问题应该帮助用户深入了解话题。只输出JSON数组格式，如[\"问题1\", \"问题2\", \"问题3\"]，不要其他文字。" },
              { role: "user", content: `用户问：${message}\n\nAI回答：${responseText.substring(0, 500)}` },
            ],
          });
          const suggestContent = typeof suggestResult.choices?.[0]?.message?.content === "string"
            ? suggestResult.choices[0].message.content : "";
          const jsonMatch = suggestContent.match(/\[.*\]/s);
          if (jsonMatch) {
            suggestedQuestions = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          // 後続質問生成失敗は無視
        }

        // チャットログをDBに保存（会話管理付き）
        const db = await getDb();
        let activeConversationId = input.conversationId || null;
        if (db) {
          try {
            // 会話IDが指定されている場合、所有権を確認
            if (activeConversationId && userId) {
              const [ownedConv] = await db.select({ id: lcjBrainConversations.id })
                .from(lcjBrainConversations)
                .where(and(
                  eq(lcjBrainConversations.id, activeConversationId),
                  eq(lcjBrainConversations.userId, userId)
                ))
                .limit(1);
              if (!ownedConv) {
                // 他人の会話には書き込ませない、新規会話を作成
                activeConversationId = null;
              }
            }
            // 会話IDがない場合、新しい会話を作成
            if (!activeConversationId && userId) {
              const title = message.length > 50 ? message.substring(0, 50) + "..." : message;
              const [newConv] = await db.insert(lcjBrainConversations).values({
                userId,
                userName,
                title,
                context: context || "chat",
              }).$returningId();
              activeConversationId = newConv.id;
            }
            const sessionId = `conv_${activeConversationId || Date.now()}`;
            await db.insert(lcjBrainChatLogs).values([
              { role: "user", content: message, context: context || "chat", sessionId, userId, userName, conversationId: activeConversationId },
              { role: "assistant", content: responseText, context: context || "chat", sessionId, userId, userName: "AI", suggestedQuestions: JSON.stringify(suggestedQuestions), conversationId: activeConversationId },
            ]);
            // 会話のupdatedAtを更新
            if (activeConversationId) {
              await db.update(lcjBrainConversations)
                .set({ updatedAt: new Date() })
                .where(eq(lcjBrainConversations.id, activeConversationId));
            }
          } catch (e) {
            console.error("[LCJ Brain] Failed to save chat log:", e);
          }
        }

        return {
          response: responseText,
          dataSourcesUsed: dataContext ? dataContext.split("##").length - 1 : 0,
          suggestedQuestions,
          conversationId: activeConversationId,
        };
      } catch (error: any) {
        console.error("[LCJ Brain] AI error:", error.message);
        return {
          response: `エラーが発生しました: ${error.message}`,
          dataSourcesUsed: 0,
          suggestedQuestions: [],
        };
      }
    }),

  /** ダッシュボードデータ取得 */
  getDashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const [brandsSummary, liversSummary, monthlySummary, contracts] = await Promise.all([
      getAllBrandsSummary(),
      getAllLiversSummary(),
      getMonthlyLivestreamSummary(),
      getContractsSummary(),
    ]);

    // ステータス別ブランド数
    const brandsByStatus: Record<string, number> = {};
    for (const b of brandsSummary) {
      brandsByStatus[b.status] = (brandsByStatus[b.status] || 0) + 1;
    }

    return {
      totalBrands: brandsSummary.length,
      totalLivers: liversSummary.length,
      activeContracts: contracts.length,
      brandsByStatus,
      monthlyLivestreams: monthlySummary,
      topLivers: (await getLiverPerformance()).slice(0, 5),
    };
  }),

  /** 品牌問診AI（自動診断） */
  diagnose: protectedProcedure
    .input(z.object({
      brandName: z.string(),
      answers: z.object({
        hasTikTokShop: z.string().optional(),
        entityType: z.string().optional(),
        hasJapanStock: z.string().optional(),
        currentMarkets: z.string().optional(),
        chinaSales: z.string().optional(),
        marginSpace: z.string().optional(),
        canSupportCommission: z.string().optional(),
        acceptTest: z.string().optional(),
        mainGoal: z.string().optional(),
        hasLiveExperience: z.string().optional(),
        productCategory: z.string().optional(),
        priceRange: z.string().optional(),
        additionalInfo: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const { brandName, answers } = input;

      const diagnosisPrompt = `你是LCJ的品牌诊断专家。基于以下品牌问诊结果，生成一份专业的品牌诊断报告。

## 品牌名称：${brandName}

## 问诊结果：
1. TikTok日区店铺：${answers.hasTikTokShop || "未回答"}
2. 主体类型：${answers.entityType || "未回答"}
3. 日本库存：${answers.hasJapanStock || "未回答"}
4. 当前销售市场：${answers.currentMarkets || "未回答"}
5. 中国市场销量：${answers.chinaSales || "未回答"}
6. 毛利空间：${answers.marginSpace || "未回答"}
7. 能否支持达人佣金：${answers.canSupportCommission || "未回答"}
8. 是否接受先测试：${answers.acceptTest || "未回答"}
9. 主要目标：${answers.mainGoal || "未回答"}
10. 直播/达人经验：${answers.hasLiveExperience || "未回答"}
11. 产品类别：${answers.productCategory || "未回答"}
12. 价格区间：${answers.priceRange || "未回答"}
13. 补充信息：${answers.additionalInfo || "无"}

## 请输出以下格式的JSON诊断报告：
{
  "stage": "测试期/增长期/成熟期",
  "riskLevel": "低/中/高",
  "recommendedModel": "推荐的合作模式",
  "strengths": ["优势1", "优势2"],
  "risks": ["风险1", "风险2"],
  "recommendations": ["建议1", "建议2", "建议3"],
  "nextSteps": ["第一步做什么", "第二步做什么", "第三步做什么"],
  "estimatedTimeline": "预估合作周期",
  "summary": "一段话总结"
}`;

      try {
        const result = await invokeLLM({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: diagnosisPrompt }],
        });

        const content = typeof result.choices?.[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
        
        // JSON部分を抽出
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return { diagnosis: JSON.parse(jsonMatch[0]), raw: content };
        }
        return { diagnosis: null, raw: content };
      } catch (error: any) {
        console.error("[LCJ Brain] Diagnosis error:", error.message);
        return { diagnosis: null, raw: `エラー: ${error.message}` };
      }
    }),

  /** 話術生成 */
  generateScript: protectedProcedure
    .input(z.object({
      scenario: z.string(), // 場面描述
      clientObjection: z.string().optional(), // 客户的反对意见
      brandInfo: z.string().optional(), // 品牌背景
    }))
    .mutation(async ({ input }) => {
      const { scenario, clientObjection, brandInfo } = input;

      const scriptPrompt = `你是LCJ的BD话术专家。基于《LCJ品牌招商成交宝典》的原则，为以下场景生成专业话术。

## 场景：${scenario}
${clientObjection ? `## 客户的反对意见：${clientObjection}` : ""}
${brandInfo ? `## 品牌背景：${brandInfo}` : ""}

## 核心原则（必须遵守）：
- 医生式BD：先问诊再开方
- 不能一上来介绍公司
- 气场比话术重要
- 不能太好说话
- 拉扯不是强硬，是掌控节奏

## 请输出：
1. 推荐话术（3种不同风格）
2. 绝对不能说的话
3. 关键心理分析
4. 后续跟进建议`;

      try {
        const result = await invokeLLM({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: scriptPrompt }],
        });

        const content = typeof result.choices?.[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "话术生成失败";

        return { script: content };
      } catch (error: any) {
        return { script: `エラー: ${error.message}` };
      }
    }),

  /** 产品适配度评分 */
  scoreProduct: protectedProcedure
    .input(z.object({
      productName: z.string(),
      category: z.string().optional(),
      price: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const scorePrompt = `你是LCJ的产品评估专家。基于TikTok直播的6个维度，为以下产品打分（1-10分）。

## 产品信息
- 名称：${input.productName}
- 类别：${input.category || "未知"}
- 价格：${input.price || "未知"}
- 描述：${input.description || "无"}

## 评分维度（每项1-10分）：
1. 停留率（视觉吸引力、能否3秒抓住观众）
2. 表达力（达人是否容易讲解、演示）
3. 客单价适配度（是否在TikTok冲动消费区间）
4. 毛利空间（能否cover佣金+广告+物流）
5. 物流友好度（重量、易碎、时效）
6. 复购潜力（用户是否会重复购买）

## 请输出JSON格式：
{
  "scores": {
    "retention": { "score": 8, "reason": "..." },
    "expression": { "score": 7, "reason": "..." },
    "pricefit": { "score": 6, "reason": "..." },
    "margin": { "score": 7, "reason": "..." },
    "logistics": { "score": 5, "reason": "..." },
    "repurchase": { "score": 8, "reason": "..." }
  },
  "totalScore": 41,
  "verdict": "非常适合/适合/一般/不太适合/不适合",
  "recommendation": "一段话建议"
}`;

      try {
        const result = await invokeLLM({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: scorePrompt }],
        });

        const content = typeof result.choices?.[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
        
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return { result: JSON.parse(jsonMatch[0]), raw: content };
        }
        return { result: null, raw: content };
      } catch (error: any) {
        return { result: null, raw: `エラー: ${error.message}` };
      }
    }),

  /** BD训练模式（AI模拟客户） */
  training: protectedProcedure
    .input(z.object({
      mode: z.enum(["start", "reply"]),
      scenario: z.string().optional(), // start時のシナリオ選択
      userReply: z.string().optional(), // reply時のユーザー回答
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional().default([]),
    }))
    .mutation(async ({ input }) => {
      const { mode, scenario, userReply, conversationHistory } = input;

      let systemPrompt: string;
      let userMessage: string;

      if (mode === "start") {
        systemPrompt = `你现在要扮演一个中国品牌方的负责人，模拟BD谈判场景。你要表现得像真实的品牌客户一样，会提出各种问题和反对意见。

场景：${scenario || "一个中国美妆品牌想进入日本TikTok市场，但对价格比较敏感"}

## 你的角色设定：
- 你是品牌方的市场负责人
- 你对TikTok直播有兴趣但有顾虑
- 你会测试BD的专业度
- 你会提出价格、效果、纯佣等常见问题

请用1-2句话开始对话（作为品牌方先说话）。`;
        userMessage = "开始模拟对话";
      } else {
        systemPrompt = `你正在扮演一个品牌方负责人，与LCJ的BD进行模拟谈判。继续扮演品牌方，根据BD的回答做出真实的反应。

## 评分标准（内心评估，不要直接告诉BD）：
- BD是否在"医生式"问诊？还是在推销？
- BD是否有气场？还是太急着成交？
- BD是否跟着客户跑？还是在掌控节奏？
- BD的回答是否专业？是否懂行业？

## 你的反应原则：
- 如果BD表现好（专业、有气场），你可以逐渐放下防备
- 如果BD表现差（急着推销、没有底气），你要加大压力
- 偶尔抛出难题测试BD

请继续扮演品牌方回复。在回复末尾用【评分】标注你对BD这轮回答的评价（1-10分）和简短理由。`;
        userMessage = userReply || "";
      }

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      for (const msg of conversationHistory) {
        messages.push({ role: msg.role === "user" ? "assistant" : "user", content: msg.content });
        // 注意：训练模式中user是BD，assistant是品牌方，但在LLM视角中反转
      }

      if (mode === "reply" && userReply) {
        messages.push({ role: "user", content: userReply });
      }

      try {
        const result = await invokeLLM({
          model: "gpt-4.1-mini",
          messages,
        });

        const content = typeof result.choices?.[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "...";

        // 评分を抽出
        const scoreMatch = content.match(/【评分】(.+)/);
        const score = scoreMatch ? scoreMatch[1] : null;
        const responseWithoutScore = content.replace(/【评分】.+/, "").trim();

        return {
          clientResponse: responseWithoutScore,
          score,
          isComplete: content.includes("签约") || content.includes("合作") || conversationHistory.length > 16,
        };
      } catch (error: any) {
        return {
          clientResponse: `エラー: ${error.message}`,
          score: null,
          isComplete: false,
        };
      }
    }),

  /** 管理者用：チャットログ一覧取得（パスワード保護 + ユーザーフィルタ） */
  getChatLogs: protectedProcedure
    .input(z.object({
      page: z.number().optional().default(1),
      limit: z.number().optional().default(50),
      search: z.string().optional(),
      password: z.string().optional(),
      filterUser: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0, users: [], authenticated: false };

      // パスワード認証（管理者パスワード: lcj）
      if (input.password !== "lcj") {
        return { logs: [], total: 0, users: [], authenticated: false };
      }

      const offset = (input.page - 1) * input.limit;

      try {
        let conditions: any[] = [];
        if (input.search) {
          conditions.push(like(lcjBrainChatLogs.content, `%${input.search}%`));
        }
        if (input.filterUser) {
          conditions.push(eq(lcjBrainChatLogs.userName, input.filterUser));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [logs, totalResult] = await Promise.all([
          db.select()
            .from(lcjBrainChatLogs)
            .where(whereClause)
            .orderBy(desc(lcjBrainChatLogs.createdAt))
            .limit(input.limit)
            .offset(offset),
          db.select({ count: count() })
            .from(lcjBrainChatLogs)
            .where(whereClause),
        ]);

        // ユニークユーザー一覧を取得
        const allUsers = await db
          .select({ userName: lcjBrainChatLogs.userName })
          .from(lcjBrainChatLogs)
          .groupBy(lcjBrainChatLogs.userName)
          .orderBy(lcjBrainChatLogs.userName);
        const uniqueUsers = allUsers
          .map(u => u.userName)
          .filter((name): name is string => !!name && name !== "AI");

        return {
          logs,
          total: totalResult[0]?.count || 0,
          users: uniqueUsers,
          authenticated: true,
        };
      } catch (error: any) {
        console.error("[LCJ Brain] getChatLogs error:", error.message);
        return { logs: [], total: 0, users: [], authenticated: false };
      }
    }),

  /** 管理者用：セッション別チャット履歴取得 */
  getChatSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const logs = await db.select()
          .from(lcjBrainChatLogs)
          .where(eq(lcjBrainChatLogs.sessionId, input.sessionId))
          .orderBy(lcjBrainChatLogs.createdAt);
        return logs;
      } catch (error: any) {
        console.error("[LCJ Brain] getChatSession error:", error.message);
        return [];
      }
    }),

  // ============================================================
  // 会話管理API（GPTライクなサイドバー用）
  // ============================================================

  // ユーザーの会話一覧を取得
  getMyConversations: protectedProcedure
    .query(async ({ ctx }) => {
      await ensureConversationsTable();
      const db = await getDb();
      if (!db || !ctx.user?.id) return [];
      try {
        const conversations = await db.select()
          .from(lcjBrainConversations)
          .where(eq(lcjBrainConversations.userId, ctx.user.id))
          .orderBy(desc(lcjBrainConversations.updatedAt))
          .limit(50);
        return conversations;
      } catch (error: any) {
        console.error("[LCJ Brain] getMyConversations error:", error.message);
        return [];
      }
    }),

  // 特定の会話のメッセージを取得
  getConversationMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user?.id) return [];
      try {
        // まず会話が自分のものか確認
        const [conv] = await db.select()
          .from(lcjBrainConversations)
          .where(and(
            eq(lcjBrainConversations.id, input.conversationId),
            eq(lcjBrainConversations.userId, ctx.user.id)
          ))
          .limit(1);
        if (!conv) return []; // 他人の会話にはアクセスさせない
        
        const messages = await db.select()
          .from(lcjBrainChatLogs)
          .where(eq(lcjBrainChatLogs.conversationId, input.conversationId))
          .orderBy(lcjBrainChatLogs.createdAt);
        return messages;
      } catch (error: any) {
        console.error("[LCJ Brain] getConversationMessages error:", error.message);
        return [];
      }
    }),

  // 会話を削除
  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user?.id) return { success: false };
      try {
        await db.delete(lcjBrainChatLogs)
          .where(eq(lcjBrainChatLogs.conversationId, input.conversationId));
        await db.delete(lcjBrainConversations)
          .where(and(
            eq(lcjBrainConversations.id, input.conversationId),
            eq(lcjBrainConversations.userId, ctx.user.id)
          ));
        return { success: true };
      } catch (error: any) {
        console.error("[LCJ Brain] deleteConversation error:", error.message);
        return { success: false };
      }
    }),

  // 全ユーザーの会話一覧（管理者用）
  getAllConversations: protectedProcedure
    .input(z.object({ password: z.string() }))
    .query(async ({ input }) => {
      if (input.password !== "lcj") return [];
      const db = await getDb();
      if (!db) return [];
      try {
        const conversations = await db.select()
          .from(lcjBrainConversations)
          .orderBy(desc(lcjBrainConversations.updatedAt))
          .limit(200);
        return conversations;
      } catch (error: any) {
        console.error("[LCJ Brain] getAllConversations error:", error.message);
        return [];
      }
    }),

  // ============================================================
  // 知識庫 API
  // ============================================================

  // 知識庫に纪要を追加
  addKnowledge: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      category: z.enum(["meeting", "daily_report", "sop", "brand", "other"]).default("meeting"),
      content: z.string().min(1),
      participants: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      meetingDate: z.string().optional(), // ISO date string
      sourceFileName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureConversationsTable();
      const db = await getDb();
      if (!db) return { success: false, error: "DB接続エラー" };
      const userName = ctx.user?.name || ctx.user?.email || "unknown";
      const userId = ctx.user?.id || null;

      try {
        // AI要約を生成
        let summary = "";
        try {
          const summaryResult = await invokeLLM({
            model: "gpt-4.1-mini",
            messages: [
              { role: "system", content: "你是一个会议纪要摘要助手。请用中文将以下内容总结为3-5个要点（每个要点一行，用•开头）。重点提取：关键决策、待办事项、重要数据。" },
              { role: "user", content: input.content.substring(0, 8000) },
            ],
          });
          summary = typeof summaryResult.choices?.[0]?.message?.content === "string"
            ? summaryResult.choices[0].message.content : "";
        } catch (e) {
          console.error("[Knowledge] Summary generation failed:", e);
        }

        // AI自动提取标签
        let autoTags: string[] = input.tags || [];
        try {
          const tagResult = await invokeLLM({
            model: "gpt-4.1-nano",
            messages: [
              { role: "system", content: "从以下会议纪要中提取关键标签（品牌名、人名、项目名、主题词）。输出JSON数组格式如[\"标签1\", \"标签2\"]，最多10个标签，不要其他文字。" },
              { role: "user", content: input.content.substring(0, 4000) },
            ],
          });
          const tagContent = typeof tagResult.choices?.[0]?.message?.content === "string"
            ? tagResult.choices[0].message.content : "";
          const tagMatch = tagContent.match(/\[.*\]/s);
          if (tagMatch) {
            const parsed = JSON.parse(tagMatch[0]);
            autoTags = [...new Set([...autoTags, ...parsed])];
          }
        } catch (e) { /* ignore */ }

        // AI自动提取参会人
        let autoParticipants: string[] = input.participants || [];
        if (autoParticipants.length === 0) {
          try {
            const partResult = await invokeLLM({
              model: "gpt-4.1-nano",
              messages: [
                { role: "system", content: "从以下会议纪要中提取所有参会人姓名。输出JSON数组格式如[\"张三\", \"李四\"]，不要其他文字。如果找不到参会人，输出[]。" },
                { role: "user", content: input.content.substring(0, 4000) },
              ],
            });
            const partContent = typeof partResult.choices?.[0]?.message?.content === "string"
              ? partResult.choices[0].message.content : "";
            const partMatch = partContent.match(/\[.*\]/s);
            if (partMatch) {
              autoParticipants = JSON.parse(partMatch[0]);
            }
          } catch (e) { /* ignore */ }
        }

        // Use raw SQL insert to avoid drizzle $returningId compatibility issues
        const meetingDateValue = input.meetingDate ? new Date(input.meetingDate) : null;
        const participantsJson = autoParticipants.length > 0 ? JSON.stringify(autoParticipants) : null;
        const tagsJson = autoTags.length > 0 ? JSON.stringify(autoTags) : null;
        
        const insertResult = await db.execute(sql`
          INSERT INTO lcj_brain_knowledge (title, category, content, summary, participants, tags, meetingDate, sourceFileName, uploadedBy, uploadedByName)
          VALUES (${input.title}, ${input.category}, ${input.content}, ${summary || null}, ${participantsJson}, ${tagsJson}, ${meetingDateValue}, ${input.sourceFileName || null}, ${userId}, ${userName})
        `);
        
        const insertedId = (insertResult as any)[0]?.insertId || (insertResult as any).insertId || 0;

        return { success: true, id: insertedId, summary, tags: autoTags, participants: autoParticipants };
      } catch (error: any) {
        console.error("[LCJ Brain] addKnowledge error:", error.message);
        return { success: false, error: error.message };
      }
    }),

  // 知識庫一覧取得
  getKnowledgeList: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().optional().default(50),
    }))
    .query(async ({ input }) => {
      await ensureConversationsTable();
      const db = await getDb();
      if (!db) return [];
      try {
        const conditions: any[] = [];
        if (input.category) {
          conditions.push(eq(lcjBrainKnowledge.category, input.category));
        }
        if (input.search) {
          conditions.push(
            or(
              like(lcjBrainKnowledge.title, `%${input.search}%`),
              like(lcjBrainKnowledge.content, `%${input.search}%`)
            )
          );
        }
        const result = await db.select({
          id: lcjBrainKnowledge.id,
          title: lcjBrainKnowledge.title,
          category: lcjBrainKnowledge.category,
          summary: lcjBrainKnowledge.summary,
          participants: lcjBrainKnowledge.participants,
          tags: lcjBrainKnowledge.tags,
          meetingDate: lcjBrainKnowledge.meetingDate,
          sourceFileName: lcjBrainKnowledge.sourceFileName,
          uploadedByName: lcjBrainKnowledge.uploadedByName,
          createdAt: lcjBrainKnowledge.createdAt,
        })
          .from(lcjBrainKnowledge)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(lcjBrainKnowledge.createdAt))
          .limit(input.limit);
        return result;
      } catch (error: any) {
        console.error("[LCJ Brain] getKnowledgeList error:", error.message);
        return [];
      }
    }),

  // 知識庫の詳細取得
  getKnowledgeDetail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      await ensureConversationsTable();
      const db = await getDb();
      if (!db) return null;
      try {
        const [result] = await db.select()
          .from(lcjBrainKnowledge)
          .where(eq(lcjBrainKnowledge.id, input.id))
          .limit(1);
        return result || null;
      } catch (error: any) {
        console.error("[LCJ Brain] getKnowledgeDetail error:", error.message);
        return null;
      }
    }),

  // 知識庫の削除
  deleteKnowledge: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      try {
        await db.delete(lcjBrainKnowledge)
          .where(eq(lcjBrainKnowledge.id, input.id));
        return { success: true };
      } catch (error: any) {
        console.error("[LCJ Brain] deleteKnowledge error:", error.message);
        return { success: false };
      }
    }),

});
