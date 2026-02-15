/**
 * Aitherhub Webhook Handler
 * 
 * Aitherhubの動画解析完了時に呼ばれるWebhookエンドポイント。
 * 解析結果をbrand_livestreamsテーブルに書き込み、
 * ライバーのマイページに自動反映させる。
 * 同期ログをaitherhub_sync_logsテーブルに記録する。
 */
import { Request, Response } from "express";
import {
  getLiverByEmail,
  createBrandLivestream,
  updateBrandLivestream,
  getLivestreamsByLiverId,
  createAitherhubSyncLog,
} from "./db";

// Webhook認証用のシークレットキー
const AITHERHUB_WEBHOOK_SECRET = process.env.AITHERHUB_WEBHOOK_SECRET || "";

/**
 * Aitherhub解析結果のペイロード型定義
 */
interface AitherhubAnalysisPayload {
  // 認証
  secret: string;
  
  // ライバー識別（emailまたはliverId）
  liverEmail?: string;
  liverId?: number;
  
  // 配信基本情報
  brandId: number;
  livestreamDate: string; // ISO 8601 format
  livestreamEndTime?: string; // ISO 8601 format
  streamerName: string;
  platform?: string; // "TikTok", "抖音" etc.
  
  // パフォーマンスメトリクス
  salesAmount?: number;
  duration?: number; // 分
  viewerCount?: number;
  orderCount?: number;
  gmv?: number;
  productClicks?: number;
  impressions?: number;
  salesCount?: number;
  cartAddCount?: number;
  
  // 詳細メトリクス
  peakViewers?: number;
  newFollowers?: number;
  avgViewDuration?: number; // 秒
  likes?: number;
  comments?: number;
  shares?: number;
  avgPrice?: number;
  
  // 効率指標
  ctr?: string;
  cvr?: string;
  ctor?: string;
  cpc?: number;
  acos?: string;
  roas?: string;
  
  // AI解析結果
  aiAdvice?: string;
  aiStructuredAdvice?: {
    summary: string;
    goodPoints: string[];
    improvements: string[];
    actionPlans: { action: string; reason: string; timing: string }[];
    nextGoal: string;
    calculatedMetrics: Record<string, string | number>;
  };
  
  // スクリーンショット
  screenshotUrl?: string;
  screenshotKey?: string;
  
  // 既存レコードの更新（指定された場合はUPDATE、なければINSERT）
  livestreamId?: number;
}

/**
 * Webhookリクエストの認証
 */
function authenticateWebhook(payload: AitherhubAnalysisPayload): boolean {
  if (!AITHERHUB_WEBHOOK_SECRET) {
    console.warn("[Aitherhub Webhook] AITHERHUB_WEBHOOK_SECRET is not set. Rejecting all requests.");
    return false;
  }
  return payload.secret === AITHERHUB_WEBHOOK_SECRET;
}

/**
 * ライバーIDの解決
 * emailまたはliverIdからライバーを特定する
 */
async function resolveLiverId(payload: AitherhubAnalysisPayload): Promise<number | null> {
  // liverIdが直接指定されている場合
  if (payload.liverId) {
    return payload.liverId;
  }
  
  // emailからライバーを検索
  if (payload.liverEmail) {
    const liver = await getLiverByEmail(payload.liverEmail);
    if (liver) {
      return liver.id;
    }
    console.warn(`[Aitherhub Webhook] Liver not found for email: ${payload.liverEmail}`);
  }
  
  return null;
}

/**
 * ペイロードの要約を作成（ログ記録用、機密情報を除外）
 */
function createPayloadSummary(payload: AitherhubAnalysisPayload) {
  return {
    liverEmail: payload.liverEmail,
    liverId: payload.liverId,
    brandId: payload.brandId,
    livestreamDate: payload.livestreamDate,
    streamerName: payload.streamerName,
    platform: payload.platform,
    hasAiAdvice: !!payload.aiAdvice,
    hasStructuredAdvice: !!payload.aiStructuredAdvice,
    hasScreenshot: !!payload.screenshotUrl,
    livestreamId: payload.livestreamId,
    metricsProvided: {
      salesAmount: payload.salesAmount !== undefined,
      gmv: payload.gmv !== undefined,
      duration: payload.duration !== undefined,
      viewerCount: payload.viewerCount !== undefined,
      orderCount: payload.orderCount !== undefined,
    },
  };
}

/**
 * Aitherhub Webhookハンドラー
 * 
 * POST /api/aitherhub/webhook
 * 
 * 解析結果を受け取り、brand_livestreamsテーブルに書き込む。
 * - livestreamIdが指定されている場合: 既存レコードを更新
 * - livestreamIdがない場合: 新規レコードを作成
 * 
 * すべての処理結果をaitherhub_sync_logsテーブルに記録する。
 */
export async function handleAitherhubWebhook(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    const payload: AitherhubAnalysisPayload = req.body;
    
    console.log("[Aitherhub Webhook] Received:", {
      liverEmail: payload.liverEmail,
      liverId: payload.liverId,
      brandId: payload.brandId,
      livestreamDate: payload.livestreamDate,
      streamerName: payload.streamerName,
      hasAiAdvice: !!payload.aiAdvice,
      hasStructuredAdvice: !!payload.aiStructuredAdvice,
      livestreamId: payload.livestreamId,
    });
    
    // 1. 認証チェック
    if (!authenticateWebhook(payload)) {
      console.error("[Aitherhub Webhook] Authentication failed");
      // 認証失敗もログに記録
      try {
        await createAitherhubSyncLog({
          eventType: "webhook_received",
          status: "error",
          liverEmail: payload.liverEmail,
          streamerName: payload.streamerName,
          message: "認証に失敗しました",
          errorDetail: "AITHERHUB_WEBHOOK_SECRET mismatch or not set",
          requestSummary: { liverEmail: payload.liverEmail, streamerName: payload.streamerName },
        });
      } catch (logErr) {
        console.error("[Aitherhub Webhook] Failed to write sync log:", logErr);
      }
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // 2. 必須フィールドのバリデーション
    if (!payload.brandId || !payload.livestreamDate || !payload.streamerName) {
      try {
        await createAitherhubSyncLog({
          eventType: "webhook_received",
          status: "error",
          liverEmail: payload.liverEmail,
          streamerName: payload.streamerName,
          brandId: payload.brandId,
          message: "必須フィールドが不足しています: brandId, livestreamDate, streamerName",
          errorDetail: `Missing: ${!payload.brandId ? 'brandId ' : ''}${!payload.livestreamDate ? 'livestreamDate ' : ''}${!payload.streamerName ? 'streamerName' : ''}`,
          requestSummary: createPayloadSummary(payload),
        });
      } catch (logErr) {
        console.error("[Aitherhub Webhook] Failed to write sync log:", logErr);
      }
      return res.status(400).json({ 
        error: "Missing required fields: brandId, livestreamDate, streamerName" 
      });
    }
    
    // 3. ライバーIDの解決
    const resolvedLiverId = await resolveLiverId(payload);
    if (!resolvedLiverId) {
      console.warn("[Aitherhub Webhook] Could not resolve liverId, proceeding without it");
    }
    
    // 4. レコードデータの構築
    const livestreamData: any = {
      brandId: payload.brandId,
      liverId: resolvedLiverId,
      livestreamDate: new Date(payload.livestreamDate),
      streamerName: payload.streamerName,
      platform: payload.platform || "TikTok",
      createdBy: 0, // System/Aitherhub
    };
    
    // オプションフィールドの設定
    if (payload.livestreamEndTime) livestreamData.livestreamEndTime = new Date(payload.livestreamEndTime);
    if (payload.salesAmount !== undefined) livestreamData.salesAmount = payload.salesAmount;
    if (payload.duration !== undefined) livestreamData.duration = payload.duration;
    if (payload.viewerCount !== undefined) livestreamData.viewerCount = payload.viewerCount;
    if (payload.orderCount !== undefined) livestreamData.orderCount = payload.orderCount;
    if (payload.gmv !== undefined) livestreamData.gmv = payload.gmv;
    if (payload.productClicks !== undefined) livestreamData.productClicks = payload.productClicks;
    if (payload.impressions !== undefined) livestreamData.impressions = payload.impressions;
    if (payload.salesCount !== undefined) livestreamData.salesCount = payload.salesCount;
    if (payload.cartAddCount !== undefined) livestreamData.cartAddCount = payload.cartAddCount;
    if (payload.peakViewers !== undefined) livestreamData.peakViewers = payload.peakViewers;
    if (payload.newFollowers !== undefined) livestreamData.newFollowers = payload.newFollowers;
    if (payload.avgViewDuration !== undefined) livestreamData.avgViewDuration = payload.avgViewDuration;
    if (payload.likes !== undefined) livestreamData.likes = payload.likes;
    if (payload.comments !== undefined) livestreamData.comments = payload.comments;
    if (payload.shares !== undefined) livestreamData.shares = payload.shares;
    if (payload.avgPrice !== undefined) livestreamData.avgPrice = payload.avgPrice;
    if (payload.ctr) livestreamData.ctr = payload.ctr;
    if (payload.cvr) livestreamData.cvr = payload.cvr;
    if (payload.ctor) livestreamData.ctor = payload.ctor;
    if (payload.cpc !== undefined) livestreamData.cpc = payload.cpc;
    if (payload.acos) livestreamData.acos = payload.acos;
    if (payload.roas) livestreamData.roas = payload.roas;
    if (payload.aiAdvice) livestreamData.aiAdvice = payload.aiAdvice;
    if (payload.aiStructuredAdvice) livestreamData.aiStructuredAdvice = payload.aiStructuredAdvice;
    if (payload.screenshotUrl) livestreamData.screenshotUrl = payload.screenshotUrl;
    if (payload.screenshotKey) livestreamData.screenshotKey = payload.screenshotKey;
    
    // 5. INSERT or UPDATE
    let result: { id: number; action: string };
    
    if (payload.livestreamId) {
      // 既存レコードの更新
      await updateBrandLivestream(payload.livestreamId, livestreamData);
      result = { id: payload.livestreamId, action: "updated" };
      console.log(`[Aitherhub Webhook] Updated livestream #${payload.livestreamId}`);
    } else {
      // 新規レコードの作成
      const created = await createBrandLivestream(livestreamData);
      result = { id: created.id, action: "created" };
      console.log(`[Aitherhub Webhook] Created livestream #${created.id}`);
    }
    
    // 6. 同期ログを記録（成功）
    try {
      await createAitherhubSyncLog({
        eventType: "webhook_received",
        status: "success",
        liverId: resolvedLiverId ?? undefined,
        liverEmail: payload.liverEmail,
        streamerName: payload.streamerName,
        brandId: payload.brandId,
        livestreamId: result.id,
        livestreamDate: new Date(payload.livestreamDate),
        action: result.action as "created" | "updated",
        recordsProcessed: 1,
        message: `配信データを${result.action === "created" ? "新規作成" : "更新"}しました（ID: ${result.id}）`,
        requestSummary: createPayloadSummary(payload),
      });
    } catch (logErr) {
      console.error("[Aitherhub Webhook] Failed to write sync log:", logErr);
    }
    
    return res.status(200).json({
      success: true,
      ...result,
      liverId: resolvedLiverId,
      message: `Livestream ${result.action} successfully`,
    });
    
  } catch (error: any) {
    console.error("[Aitherhub Webhook] Error:", error);
    
    // エラーログを記録
    try {
      const payload = req.body || {};
      await createAitherhubSyncLog({
        eventType: "webhook_received",
        status: "error",
        liverEmail: payload.liverEmail,
        streamerName: payload.streamerName,
        brandId: payload.brandId,
        message: `同期エラー: ${error.message || "Unknown error"}`,
        errorDetail: error.stack || error.message,
        requestSummary: payload.streamerName ? createPayloadSummary(payload) : { error: "Invalid payload" },
      });
    } catch (logErr) {
      console.error("[Aitherhub Webhook] Failed to write error sync log:", logErr);
    }
    
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Unknown error",
    });
  }
}

/**
 * ライバー検証エンドポイント
 * POST /api/aitherhub/verify-liver
 * 
 * Aitherhub側からメールアドレスでライバーを検索し、
 * 存在する場合はライバー名を返す。
 * LCJ連携機能のプレビュー用。
 */
export async function handleVerifyLiver(req: Request, res: Response) {
  try {
    const { secret, email } = req.body;

    // 認証チェック
    if (!AITHERHUB_WEBHOOK_SECRET) {
      console.warn("[Aitherhub Verify] AITHERHUB_WEBHOOK_SECRET is not set.");
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (secret !== AITHERHUB_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const liver = await getLiverByEmail(email);
    if (!liver) {
      return res.status(200).json({ found: false });
    }

    return res.status(200).json({
      found: true,
      name: liver.name || liver.displayName || "",
      id: liver.id,
    });
  } catch (error: any) {
    console.error("[Aitherhub Verify] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Aitherhub ヘルスチェック
 * GET /api/aitherhub/health
 */
export async function handleAitherhubHealth(_req: Request, res: Response) {
  return res.status(200).json({
    status: "ok",
    service: "lcj-aitherhub-integration",
    timestamp: new Date().toISOString(),
  });
}
