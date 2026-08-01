/**
 * 中古ブランド買取・オークション連携システム Router
 * 
 * フェーズ1 MVP:
 * - ユーザー: 写真アップロード → AI即時概算査定 → パートナー競合査定
 * - パートナー: 査定金額入力 → ユーザー承認 → 配送 → 受取確認 → 完了
 * - 管理者: パートナー管理、全体統計
 */
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import {
  buybackPartners,
  buybackRequests,
  buybackAssessments,
  buybackMessages,
  buybackTransactionLogs,
} from "../drizzle/schema";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { pushMessage } from "./line";
import { createLinePointTransaction } from "./db";

// Ensure tables exist on first use
let tablesInitialized = false;
async function ensureBuybackTables() {
  if (tablesInitialized) return;
  try {
    const db = await getDb();
    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`buyback_partners\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`company_name\` varchar(255) NOT NULL,
      \`contact_name\` varchar(255) NOT NULL,
      \`email\` varchar(255) NOT NULL,
      \`phone\` varchar(50) DEFAULT NULL,
      \`license_number\` varchar(100) NOT NULL,
      \`line_user_id\` varchar(100) DEFAULT NULL,
      \`status\` enum('active','inactive','suspended') NOT NULL DEFAULT 'active',
      \`commission_rate\` decimal(5,2) DEFAULT '10.00',
      \`total_assessments\` int DEFAULT '0',
      \`accept_rate\` decimal(5,4) DEFAULT NULL,
      \`avg_response_time\` decimal(10,2) DEFAULT NULL,
      \`specialties\` json DEFAULT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    
    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`buyback_requests\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`line_user_id\` varchar(100) NOT NULL,
      \`display_name\` varchar(255) DEFAULT NULL,
      \`category\` enum('bag','watch','jewelry','apparel','shoes','accessory','other') NOT NULL,
      \`brand_name\` varchar(255) DEFAULT NULL,
      \`product_name\` varchar(500) DEFAULT NULL,
      \`description\` text DEFAULT NULL,
      \`condition\` enum('new','like_new','good','fair','poor') DEFAULT NULL,
      \`image_urls\` json DEFAULT NULL,
      \`status\` enum('pending','ai_assessed','partner_assessed','accepted','shipped','received','completed','cancelled','rejected') NOT NULL DEFAULT 'pending',
      \`ai_estimated_min\` int DEFAULT NULL,
      \`ai_estimated_max\` int DEFAULT NULL,
      \`ai_brand\` varchar(255) DEFAULT NULL,
      \`ai_model\` varchar(500) DEFAULT NULL,
      \`ai_condition\` varchar(100) DEFAULT NULL,
      \`ai_confidence\` decimal(3,2) DEFAULT NULL,
      \`ai_raw_response\` json DEFAULT NULL,
      \`selected_partner_id\` int DEFAULT NULL,
      \`assessment_amount\` int DEFAULT NULL,
      \`final_amount\` int DEFAULT NULL,
      \`commission_amount\` int DEFAULT NULL,
      \`points_awarded\` int DEFAULT NULL,
      \`shipping_tracking_number\` varchar(100) DEFAULT NULL,
      \`shipping_carrier\` varchar(100) DEFAULT NULL,
      \`shipped_at\` timestamp NULL DEFAULT NULL,
      \`received_at\` timestamp NULL DEFAULT NULL,
      \`completed_at\` timestamp NULL DEFAULT NULL,
      \`cancelled_at\` timestamp NULL DEFAULT NULL,
      \`cancel_reason\` text DEFAULT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_buyback_requests_line_user\` (\`line_user_id\`),
      KEY \`idx_buyback_requests_status\` (\`status\`),
      KEY \`idx_buyback_requests_partner\` (\`selected_partner_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    
    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`buyback_assessments\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`request_id\` int NOT NULL,
      \`partner_id\` int NOT NULL,
      \`amount\` int NOT NULL,
      \`note\` text DEFAULT NULL,
      \`status\` enum('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
      \`expires_at\` timestamp NULL DEFAULT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_buyback_assessments_request\` (\`request_id\`),
      KEY \`idx_buyback_assessments_partner\` (\`partner_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    
    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`buyback_messages\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`request_id\` int NOT NULL,
      \`sender_type\` enum('user','partner','system') NOT NULL,
      \`sender_id\` varchar(100) NOT NULL,
      \`sender_name\` varchar(255) DEFAULT NULL,
      \`message\` text NOT NULL,
      \`image_url\` varchar(1000) DEFAULT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_buyback_messages_request\` (\`request_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    
    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`buyback_transaction_logs\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`request_id\` int NOT NULL,
      \`action\` varchar(100) NOT NULL,
      \`actor_type\` enum('user','partner','admin','system') NOT NULL,
      \`actor_id\` varchar(100) NOT NULL,
      \`details\` json DEFAULT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_buyback_logs_request\` (\`request_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    
    tablesInitialized = true;
    console.log('[BuybackRouter] Tables ensured.');
  } catch (err: any) {
    console.error('[BuybackRouter] Table init error:', err.message);
    tablesInitialized = true;
  }
}

// AI Brand Assessment using LLM Vision
async function performAIAssessment(imageUrls: string[], category: string, description?: string) {
  try {
    const imageContent = imageUrls.slice(0, 4).map(url => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const }
    }));

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたは中古ブランド品の査定エキスパートです。10年以上の鑑定経験を持つプロフェッショナルとして、画像から以下を正確に判断してください。

【査定基準】
1. ブランド名（正式名称）- ロゴ、刻印、タグ、金具の特徴から特定
2. 商品モデル名/型番 - シリアルナンバー、型番プレート、デザイン特徴から特定
3. コンディション判定:
   - new: 未使用品、タグ付き、保護シール残存
   - like_new: 1-2回使用程度、目立つ傷なし
   - good: 通常使用の軽微な使用感、角スレ軽度
   - fair: 明確な使用感あり、色褪せ・スレ・小傷あり
   - poor: 大きなダメージ、破損、著しい劣化
4. 推定買取価格（日本の中古市場相場に基づく）:
   - 参考: 大手買取店（コメ兵、ブランディア等）の買取相場
   - 季節性考慮（バッグは春夏に需要増、時計は年末需要増）
   - 人気モデル・限定品はプレミアム加算
5. 信頼度（0.0〜1.0）:
   - 0.9以上: ブランド・モデル明確、状態判定容易
   - 0.7-0.89: 概ね特定可能だが一部不確実
   - 0.5-0.69: 画像不鮮明または判定困難な要素あり
   - 0.5未満: 特定困難、追加画像推奨
6. 真贋チェック指標:
   - ステッチの均一性、金具の品質、素材の質感
   - ロゴの配置・フォント、シリアルナンバーの形式
   - 疑わしい点があれば必ず言及

必ず以下のJSON形式で回答してください：
{
  "brand": "ブランド名",
  "model": "モデル名/型番",
  "condition": "good",
  "estimatedMin": 50000,
  "estimatedMax": 80000,
  "confidence": 0.85,
  "reasoning": "判断根拠の説明（真贋チェック結果含む）",
  "authenticityNotes": "真贋に関する所見",
  "marketTrend": "現在の市場トレンド（需要の高低）"
}`
        },
        {
          role: "user",
          content: [
            { type: "text" as const, text: `カテゴリ: ${category}\n${description ? `説明: ${description}` : ''}` },
            ...imageContent
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "brand_assessment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              brand: { type: "string" },
              model: { type: "string" },
              condition: { type: "string", enum: ["new", "like_new", "good", "fair", "poor"] },
              estimatedMin: { type: "integer" },
              estimatedMax: { type: "integer" },
              confidence: { type: "number" },
              reasoning: { type: "string" },
              authenticityNotes: { type: "string" },
              marketTrend: { type: "string" }
            },
            required: ["brand", "model", "condition", "estimatedMin", "estimatedMax", "confidence", "reasoning", "authenticityNotes", "marketTrend"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (err: any) {
    console.error('[BuybackRouter] AI assessment error:', err.message);
    return null;
  }
}

// Log transaction
async function logTransaction(requestId: number, action: string, actorType: string, actorId: string, details?: any) {
  try {
    const db = await getDb();
    await db.insert(buybackTransactionLogs).values({
      requestId,
      action,
      actorType: actorType as any,
      actorId,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (err: any) {
    console.error('[BuybackRouter] Log error:', err.message);
  }
}

// Notify user via LINE
async function notifyUser(lineUserId: string, message: string) {
  try {
    await pushMessage(lineUserId, [{ type: "text", text: message }]);
  } catch (err: any) {
    console.error('[BuybackRouter] LINE notify error:', err.message);
  }
}

// Notify all active partners about new request (with specialty matching)
async function notifyPartnersNewRequest(requestId: number, brandName: string, category: string) {
  try {
    const db = await getDb();
    const partners = await db.select().from(buybackPartners).where(eq(buybackPartners.status, "active"));
    
    for (const partner of partners) {
      if (!partner.lineUserId) continue;
      
      // Check specialty matching - prioritize partners with matching specialties
      let isSpecialtyMatch = false;
      if (partner.specialties) {
        const specialties: string[] = typeof partner.specialties === 'string' 
          ? JSON.parse(partner.specialties) 
          : partner.specialties as string[];
        isSpecialtyMatch = specialties.some(s => 
          s.toLowerCase() === category.toLowerCase() ||
          (brandName && s.toLowerCase().includes(brandName.toLowerCase()))
        );
      }
      
      const priorityTag = isSpecialtyMatch ? '【専門分野】' : '';
      await pushMessage(partner.lineUserId, [{
        type: "text",
        text: `【新規買取依頼】${priorityTag}\n${brandName || '不明ブランド'} (${category})\n依頼ID: #${requestId}\n\n管理画面から査定額を入力してください。`
      }]);
    }
  } catch (err: any) {
    console.error('[BuybackRouter] Partner notify error:', err.message);
  }
}

export const buybackRouter = router({
  // ===== User-facing procedures =====

  // Upload image for buyback request
  uploadImage: publicProcedure
    .input(z.object({
      base64: z.string(),
      filename: z.string(),
      contentType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const buffer = Buffer.from(input.base64, "base64");
      const key = `buyback/${Date.now()}_${input.filename}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      return { url };
    }),

  // Create buyback request with AI assessment
  createRequest: publicProcedure
    .input(z.object({
      lineUserId: z.string(),
      displayName: z.string().optional(),
      category: z.enum(["bag", "watch", "jewelry", "apparel", "shoes", "accessory", "other"]),
      brandName: z.string().optional(),
      productName: z.string().optional(),
      description: z.string().optional(),
      condition: z.enum(["new", "like_new", "good", "fair", "poor"]).optional(),
      imageUrls: z.array(z.string()).min(1).max(10),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();

      // Insert request
      const [result] = await db.insert(buybackRequests).values({
        lineUserId: input.lineUserId,
        displayName: input.displayName || null,
        category: input.category,
        brandName: input.brandName || null,
        productName: input.productName || null,
        description: input.description || null,
        condition: input.condition || null,
        imageUrls: JSON.stringify(input.imageUrls),
        status: "pending",
      });
      const requestId = (result as any).insertId;

      // Perform AI assessment
      const aiResult = await performAIAssessment(input.imageUrls, input.category, input.description);
      if (aiResult) {
        await db.update(buybackRequests)
          .set({
            status: "ai_assessed",
            aiEstimatedMin: aiResult.estimatedMin,
            aiEstimatedMax: aiResult.estimatedMax,
            aiBrand: aiResult.brand,
            aiModel: aiResult.model,
            aiCondition: aiResult.condition,
            aiConfidence: String(aiResult.confidence),
            aiRawResponse: JSON.stringify(aiResult),
          })
          .where(eq(buybackRequests.id, requestId));
      }

      // Log transaction
      await logTransaction(requestId, "request_created", "user", input.lineUserId, {
        category: input.category,
        imageCount: input.imageUrls.length,
      });

      // Notify partners
      await notifyPartnersNewRequest(requestId, aiResult?.brand || input.brandName || "", input.category);

      // Notify user
      await notifyUser(input.lineUserId, 
        aiResult 
          ? `【買取査定完了】\nAI概算: ¥${aiResult.estimatedMin.toLocaleString()}〜¥${aiResult.estimatedMax.toLocaleString()}\nブランド: ${aiResult.brand}\n\nパートナーからの正式査定をお待ちください。`
          : `【買取依頼受付】\n依頼を受け付けました。パートナーからの査定をお待ちください。`
      );

      return {
        requestId,
        aiAssessment: aiResult,
      };
    }),

  // Get user's buyback requests
  getMyRequests: publicProcedure
    .input(z.object({
      lineUserId: z.string(),
    }))
    .query(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();
      const requests = await db.select().from(buybackRequests)
        .where(eq(buybackRequests.lineUserId, input.lineUserId))
        .orderBy(desc(buybackRequests.createdAt));
      return requests.map(r => ({
        ...r,
        imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls) : r.imageUrls,
        aiRawResponse: typeof r.aiRawResponse === 'string' ? JSON.parse(r.aiRawResponse) : r.aiRawResponse,
      }));
    }),

  // Get request detail with assessments and messages
  getRequestDetail: publicProcedure
    .input(z.object({
      requestId: z.number(),
      lineUserId: z.string(),
    }))
    .query(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();
      
      const [request] = await db.select().from(buybackRequests)
        .where(and(
          eq(buybackRequests.id, input.requestId),
          eq(buybackRequests.lineUserId, input.lineUserId)
        ));
      if (!request) throw new Error("Request not found");

      const assessments = await db.select({
        id: buybackAssessments.id,
        amount: buybackAssessments.amount,
        note: buybackAssessments.note,
        status: buybackAssessments.status,
        partnerId: buybackAssessments.partnerId,
        companyName: buybackPartners.companyName,
        createdAt: buybackAssessments.createdAt,
      })
        .from(buybackAssessments)
        .leftJoin(buybackPartners, eq(buybackAssessments.partnerId, buybackPartners.id))
        .where(eq(buybackAssessments.requestId, input.requestId))
        .orderBy(desc(buybackAssessments.amount));

      const messages = await db.select().from(buybackMessages)
        .where(eq(buybackMessages.requestId, input.requestId))
        .orderBy(buybackMessages.createdAt);

      return {
        ...request,
        imageUrls: typeof request.imageUrls === 'string' ? JSON.parse(request.imageUrls) : request.imageUrls,
        aiRawResponse: typeof request.aiRawResponse === 'string' ? JSON.parse(request.aiRawResponse) : request.aiRawResponse,
        assessments,
        messages,
      };
    }),

  // Accept a partner's assessment
  acceptAssessment: publicProcedure
    .input(z.object({
      requestId: z.number(),
      assessmentId: z.number(),
      lineUserId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();

      // Verify ownership
      const [request] = await db.select().from(buybackRequests)
        .where(and(
          eq(buybackRequests.id, input.requestId),
          eq(buybackRequests.lineUserId, input.lineUserId)
        ));
      if (!request) throw new Error("Request not found");

      // Get assessment
      const [assessment] = await db.select().from(buybackAssessments)
        .where(eq(buybackAssessments.id, input.assessmentId));
      if (!assessment) throw new Error("Assessment not found");

      // Update request
      await db.update(buybackRequests).set({
        status: "accepted",
        selectedPartnerId: assessment.partnerId,
        assessmentAmount: assessment.amount,
      }).where(eq(buybackRequests.id, input.requestId));

      // Update assessment status
      await db.update(buybackAssessments).set({ status: "accepted" })
        .where(eq(buybackAssessments.id, input.assessmentId));

      // Reject other assessments
      await db.update(buybackAssessments).set({ status: "rejected" })
        .where(and(
          eq(buybackAssessments.requestId, input.requestId),
          sql`${buybackAssessments.id} != ${input.assessmentId}`
        ));

      // Log
      await logTransaction(input.requestId, "assessment_accepted", "user", input.lineUserId, {
        assessmentId: input.assessmentId,
        amount: assessment.amount,
        partnerId: assessment.partnerId,
      });

      // Notify partner
      const [partner] = await db.select().from(buybackPartners)
        .where(eq(buybackPartners.id, assessment.partnerId));
      if (partner?.lineUserId) {
        await notifyUser(partner.lineUserId, 
          `【査定承認】\n依頼 #${input.requestId} の査定が承認されました。\n金額: ¥${assessment.amount.toLocaleString()}\n\nユーザーからの発送をお待ちください。`
        );
      }

      return { success: true };
    }),

  // Register shipping info
  registerShipping: publicProcedure
    .input(z.object({
      requestId: z.number(),
      lineUserId: z.string(),
      trackingNumber: z.string(),
      carrier: z.string(),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();

      const [request] = await db.select().from(buybackRequests)
        .where(and(
          eq(buybackRequests.id, input.requestId),
          eq(buybackRequests.lineUserId, input.lineUserId)
        ));
      if (!request) throw new Error("Request not found");
      if (request.status !== "accepted") throw new Error("Invalid status");

      await db.update(buybackRequests).set({
        status: "shipped",
        shippingTrackingNumber: input.trackingNumber,
        shippingCarrier: input.carrier,
        shippedAt: new Date(),
      }).where(eq(buybackRequests.id, input.requestId));

      await logTransaction(input.requestId, "shipped", "user", input.lineUserId, {
        trackingNumber: input.trackingNumber,
        carrier: input.carrier,
      });

      // Notify partner
      if (request.selectedPartnerId) {
        const [partner] = await db.select().from(buybackPartners)
          .where(eq(buybackPartners.id, request.selectedPartnerId));
        if (partner?.lineUserId) {
          await notifyUser(partner.lineUserId,
            `【発送通知】\n依頼 #${input.requestId}\n配送業者: ${input.carrier}\n追跡番号: ${input.trackingNumber}`
          );
        }
      }

      return { success: true };
    }),

  // Send chat message (user)
  sendMessage: publicProcedure
    .input(z.object({
      requestId: z.number(),
      lineUserId: z.string(),
      message: z.string(),
      imageUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();

      const [request] = await db.select().from(buybackRequests)
        .where(and(
          eq(buybackRequests.id, input.requestId),
          eq(buybackRequests.lineUserId, input.lineUserId)
        ));
      if (!request) throw new Error("Request not found");

      await db.insert(buybackMessages).values({
        requestId: input.requestId,
        senderType: "user",
        senderId: input.lineUserId,
        senderName: request.displayName || "ユーザー",
        message: input.message,
        imageUrl: input.imageUrl || null,
      });

      return { success: true };
    }),

  // ===== Partner/Admin procedures =====

  // Get pending requests for partner assessment
  getPartnerPendingAssessments: protectedProcedure
    .input(z.object({
      partnerId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();
      
      const requests = await db.select().from(buybackRequests)
        .where(
          sql`${buybackRequests.status} IN ('pending', 'ai_assessed')`
        )
        .orderBy(desc(buybackRequests.createdAt));

      return requests.map(r => ({
        ...r,
        imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls) : r.imageUrls,
        aiRawResponse: typeof r.aiRawResponse === 'string' ? JSON.parse(r.aiRawResponse) : r.aiRawResponse,
      }));
    }),

  // Submit assessment (partner)
  submitAssessment: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      partnerId: z.number().optional(),
      amount: z.number().min(1),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();

      // Resolve partnerId: use provided value or default to first active partner
      let partnerId = input.partnerId;
      if (!partnerId) {
        const [firstPartner] = await db.select().from(buybackPartners)
          .where(eq(buybackPartners.status, "active"))
          .limit(1);
        partnerId = firstPartner?.id || 1;
      }

      // Check if partner already assessed this request
      const existing = await db.select().from(buybackAssessments)
        .where(and(
          eq(buybackAssessments.requestId, input.requestId),
          eq(buybackAssessments.partnerId, partnerId)
        ));
      if (existing.length > 0) throw new Error("Already assessed");

      // Insert assessment (72h expiry)
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      await db.insert(buybackAssessments).values({
        requestId: input.requestId,
        partnerId,
        amount: input.amount,
        note: input.note || null,
        status: "pending",
        expiresAt,
      });

      // Update request status
      await db.update(buybackRequests).set({
        status: "partner_assessed",
      }).where(eq(buybackRequests.id, input.requestId));

      // Update partner stats
      await db.update(buybackPartners).set({
        totalAssessments: sql`${buybackPartners.totalAssessments} + 1`,
      }).where(eq(buybackPartners.id, partnerId));

      // Log
      await logTransaction(input.requestId, "assessment_submitted", "partner", String(partnerId), {
        amount: input.amount,
      });

      // Notify user
      const [request] = await db.select().from(buybackRequests)
        .where(eq(buybackRequests.id, input.requestId));
      if (request?.lineUserId) {
        const [partner] = await db.select().from(buybackPartners)
          .where(eq(buybackPartners.id, partnerId));
        await notifyUser(request.lineUserId,
          `【査定結果】\n${partner?.companyName || 'パートナー'}から査定が届きました！\n金額: ¥${input.amount.toLocaleString()}\n\nアプリで確認して承認/拒否してください。`
        );
      }

      return { success: true };
    }),

  // Confirm item received by partner
  confirmReceived: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      partnerId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();

      const [request] = await db.select().from(buybackRequests)
        .where(eq(buybackRequests.id, input.requestId));
      if (!request) throw new Error("Request not found");
      if (request.status !== "shipped") throw new Error("Invalid status");

      await db.update(buybackRequests).set({
        status: "received",
        receivedAt: new Date(),
      }).where(eq(buybackRequests.id, input.requestId));

      await logTransaction(input.requestId, "item_received", "partner", String(input.partnerId));

      // Notify user
      if (request.lineUserId) {
        await notifyUser(request.lineUserId,
          `【受取確認】\n依頼 #${input.requestId} の商品が到着しました。\n最終確認後、お支払いが完了します。`
        );
      }

      return { success: true };
    }),

  // Complete transaction and pay out
  completeTransaction: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      partnerId: z.number(),
      finalAmount: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();

      const [request] = await db.select().from(buybackRequests)
        .where(eq(buybackRequests.id, input.requestId));
      if (!request) throw new Error("Request not found");
      if (request.status !== "received") throw new Error("Invalid status");

      const finalAmount = input.finalAmount || request.assessmentAmount || 0;
      
      // Get partner commission rate
      const [partner] = await db.select().from(buybackPartners)
        .where(eq(buybackPartners.id, input.partnerId));
      const commissionRate = partner?.commissionRate ? Number(partner.commissionRate) : 10;
      const commissionAmount = Math.round(finalAmount * commissionRate / 100);
      const userPayout = finalAmount - commissionAmount;

      // Award points to user (10% bonus as LCJ points)
      const pointsAwarded = Math.round(userPayout * 0.1);

      await db.update(buybackRequests).set({
        status: "completed",
        finalAmount,
        commissionAmount,
        pointsAwarded,
        completedAt: new Date(),
      }).where(eq(buybackRequests.id, input.requestId));

      // Award LCJ points
      if (request.lineUserId && pointsAwarded > 0) {
        try {
          await createLinePointTransaction({
            lineUserId: request.lineUserId,
            type: "earn",
            amount: pointsAwarded,
            referenceType: "system",
            referenceId: input.requestId,
            description: `買取完了ボーナス (依頼#${input.requestId})`,
          });
        } catch (err: any) {
          console.error('[BuybackRouter] Point award error:', err.message);
        }
      }

      await logTransaction(input.requestId, "completed", "partner", String(input.partnerId), {
        finalAmount,
        commissionAmount,
        pointsAwarded,
      });

      // Notify user
      if (request.lineUserId) {
        await notifyUser(request.lineUserId,
          `【取引完了】\n依頼 #${input.requestId} が完了しました！\n\n買取金額: ¥${userPayout.toLocaleString()}\nボーナスポイント: ${pointsAwarded}pt\n\nご利用ありがとうございました！`
        );
      }

      return { success: true, finalAmount, commissionAmount, pointsAwarded };
    }),

  // Get partner's transaction history
  getPartnerTransactions: protectedProcedure
    .input(z.object({
      partnerId: z.number(),
    }))
    .query(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();
      const requests = await db.select().from(buybackRequests)
        .where(eq(buybackRequests.selectedPartnerId, input.partnerId))
        .orderBy(desc(buybackRequests.createdAt));
      return requests.map(r => ({
        ...r,
        imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls) : r.imageUrls,
      }));
    }),

  // ===== Admin procedures =====

  // Get all requests (admin)
  getAllRequests: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();
      
      const conditions: any[] = [];
      if (input?.status) {
        conditions.push(eq(buybackRequests.status, input.status as any));
      }

      const requests = await db.select().from(buybackRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(buybackRequests.createdAt))
        .limit(input?.limit || 50)
        .offset(input?.offset || 0);

      const [totalResult] = await db.select({ count: count() }).from(buybackRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        requests: requests.map(r => ({
          ...r,
          imageUrls: typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls) : r.imageUrls,
        })),
        total: totalResult?.count || 0,
      };
    }),

  // Get request detail (admin - no ownership check)
  getRequestDetailAdmin: protectedProcedure
    .input(z.object({
      requestId: z.number(),
    }))
    .query(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();
      
      const [request] = await db.select().from(buybackRequests)
        .where(eq(buybackRequests.id, input.requestId));
      if (!request) throw new Error("Request not found");

      const assessments = await db.select({
        id: buybackAssessments.id,
        amount: buybackAssessments.amount,
        note: buybackAssessments.note,
        status: buybackAssessments.status,
        partnerId: buybackAssessments.partnerId,
        companyName: buybackPartners.companyName,
        createdAt: buybackAssessments.createdAt,
      })
        .from(buybackAssessments)
        .leftJoin(buybackPartners, eq(buybackAssessments.partnerId, buybackPartners.id))
        .where(eq(buybackAssessments.requestId, input.requestId))
        .orderBy(desc(buybackAssessments.amount));

      const messages = await db.select().from(buybackMessages)
        .where(eq(buybackMessages.requestId, input.requestId))
        .orderBy(buybackMessages.createdAt);

      const logs = await db.select().from(buybackTransactionLogs)
        .where(eq(buybackTransactionLogs.requestId, input.requestId))
        .orderBy(desc(buybackTransactionLogs.createdAt));

      return {
        ...request,
        imageUrls: typeof request.imageUrls === 'string' ? JSON.parse(request.imageUrls) : request.imageUrls,
        aiRawResponse: typeof request.aiRawResponse === 'string' ? JSON.parse(request.aiRawResponse) : request.aiRawResponse,
        assessments,
        messages,
        logs,
      };
    }),

  // List partners
  getPartners: protectedProcedure.query(async () => {
    await ensureBuybackTables();
    const db = await getDb();
    return db.select().from(buybackPartners).orderBy(desc(buybackPartners.createdAt));
  }),

  // Create partner
  createPartner: protectedProcedure
    .input(z.object({
      companyName: z.string(),
      contactName: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      licenseNumber: z.string(),
      lineUserId: z.string().optional(),
      commissionRate: z.number().min(0).max(100).default(10),
      specialties: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();
      const [result] = await db.insert(buybackPartners).values({
        companyName: input.companyName,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone || null,
        licenseNumber: input.licenseNumber,
        lineUserId: input.lineUserId || null,
        commissionRate: String(input.commissionRate),
        specialties: input.specialties ? JSON.stringify(input.specialties) : null,
      });
      return { id: (result as any).insertId };
    }),

  // Update partner status
  updatePartnerStatus: protectedProcedure
    .input(z.object({
      partnerId: z.number(),
      status: z.enum(["active", "inactive", "suspended"]),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();
      await db.update(buybackPartners).set({ status: input.status })
        .where(eq(buybackPartners.id, input.partnerId));
      return { success: true };
    }),

  // Dashboard statistics
  getDashboardStats: protectedProcedure.query(async () => {
    await ensureBuybackTables();
    const db = await getDb();

    const [totalRequests] = await db.select({ count: count() }).from(buybackRequests);
    const [pendingRequests] = await db.select({ count: count() }).from(buybackRequests)
      .where(sql`${buybackRequests.status} IN ('pending', 'ai_assessed', 'partner_assessed')`);
    const [completedRequests] = await db.select({ count: count() }).from(buybackRequests)
      .where(eq(buybackRequests.status, "completed"));
    const [activePartners] = await db.select({ count: count() }).from(buybackPartners)
      .where(eq(buybackPartners.status, "active"));

    const [revenue] = await db.select({
      total: sql<number>`COALESCE(SUM(${buybackRequests.commissionAmount}), 0)`,
    }).from(buybackRequests).where(eq(buybackRequests.status, "completed"));

    const [avgAmount] = await db.select({
      avg: sql<number>`COALESCE(AVG(${buybackRequests.finalAmount}), 0)`,
    }).from(buybackRequests).where(eq(buybackRequests.status, "completed"));

    return {
      totalRequests: totalRequests?.count || 0,
      pendingRequests: pendingRequests?.count || 0,
      completedRequests: completedRequests?.count || 0,
      activePartners: activePartners?.count || 0,
      totalRevenue: revenue?.total || 0,
      avgTransactionAmount: Math.round(avgAmount?.avg || 0),
    };
  }),

  // Cancel a buyback request (user)
  cancelRequest: publicProcedure
    .input(z.object({
      requestId: z.number(),
      lineUserId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();

      const [request] = await db.select().from(buybackRequests)
        .where(and(
          eq(buybackRequests.id, input.requestId),
          eq(buybackRequests.lineUserId, input.lineUserId)
        ));
      if (!request) throw new Error("Request not found");
      if (!['pending', 'ai_assessed', 'partner_assessed'].includes(request.status)) {
        throw new Error("このステータスではキャンセルできません");
      }

      await db.update(buybackRequests).set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: input.reason || null,
      }).where(eq(buybackRequests.id, input.requestId));

      // Reject any pending assessments
      await db.update(buybackAssessments).set({ status: "rejected" })
        .where(and(
          eq(buybackAssessments.requestId, input.requestId),
          eq(buybackAssessments.status, "pending")
        ));

      await logTransaction(input.requestId, "cancelled", "user", input.lineUserId, {
        reason: input.reason,
      });

      return { success: true };
    }),

  // Reject a partner's assessment (user)
  rejectAssessment: publicProcedure
    .input(z.object({
      requestId: z.number(),
      assessmentId: z.number(),
      lineUserId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await ensureBuybackTables();
      const db = await getDb();

      // Verify ownership
      const [request] = await db.select().from(buybackRequests)
        .where(and(
          eq(buybackRequests.id, input.requestId),
          eq(buybackRequests.lineUserId, input.lineUserId)
        ));
      if (!request) throw new Error("Request not found");

      // Get assessment
      const [assessment] = await db.select().from(buybackAssessments)
        .where(eq(buybackAssessments.id, input.assessmentId));
      if (!assessment) throw new Error("Assessment not found");
      if (assessment.status !== "pending") throw new Error("この査定は既に処理済みです");

      // Reject the assessment
      await db.update(buybackAssessments).set({ status: "rejected" })
        .where(eq(buybackAssessments.id, input.assessmentId));

      // Check if there are other pending assessments
      const remainingPending = await db.select().from(buybackAssessments)
        .where(and(
          eq(buybackAssessments.requestId, input.requestId),
          eq(buybackAssessments.status, "pending")
        ));

      // If no more pending assessments, revert request status to ai_assessed
      if (remainingPending.length === 0) {
        await db.update(buybackRequests).set({
          status: "ai_assessed",
        }).where(eq(buybackRequests.id, input.requestId));
      }

      await logTransaction(input.requestId, "assessment_rejected", "user", input.lineUserId, {
        assessmentId: input.assessmentId,
        reason: input.reason,
      });

      // Notify partner
      const [partner] = await db.select().from(buybackPartners)
        .where(eq(buybackPartners.id, assessment.partnerId));
      if (partner?.lineUserId) {
        await notifyUser(partner.lineUserId,
          `【査定拒否】\n依頼 #${input.requestId} の査定が拒否されました。${input.reason ? `\n理由: ${input.reason}` : ''}`
        );
      }

      return { success: true };
    }),

  // Send message as partner/admin
  sendAdminMessage: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      message: z.string(),
      senderType: z.enum(["partner", "system"]).default("partner"),
      senderName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureBuybackTables();
      const db = await getDb();

      await db.insert(buybackMessages).values({
        requestId: input.requestId,
        senderType: input.senderType,
        senderId: String((ctx as any).user?.id || "admin"),
        senderName: input.senderName || (ctx as any).user?.name || "管理者",
        message: input.message,
      });

      // Notify user via LINE
      const [request] = await db.select().from(buybackRequests)
        .where(eq(buybackRequests.id, input.requestId));
      if (request?.lineUserId) {
        await notifyUser(request.lineUserId,
          `【メッセージ】\n${input.senderName || '管理者'}からメッセージが届きました:\n${input.message}`
        );
      }

      return { success: true };
    }),
});
