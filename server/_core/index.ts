import "dotenv/config";
import compression from "compression";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
// OAuth removed - using custom email/password auth
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { getTaskByCompletionToken, updateTask } from "../db";
import { notifyOwner } from "./notification";
import { checkAndSendReminders } from "../reminderScheduler";
import { startGroupFollowUpScheduler } from "../groupFollowUpScheduler";
import { startResponseReminderScheduler } from "../responseReminderScheduler";
import { startScheduleReminderScheduler } from "../scheduleReminderScheduler";
import { startAiAutoApproveScheduler } from "../aiAutoApproveScheduler";
import { startLineReminderScheduler } from "../lineReminderScheduler";
import { startAutoPostScheduler } from "../autoPostScheduler";
import { startSeoMonitor } from "../seoMonitor";
import { startArticleRewriter } from "../articleRewriter";
import { initPointExpiryScheduler } from "../pointExpiryScheduler";
import { startStepEmailScheduler } from "../stepEmailScheduler";
import { startLiveSuggestionScheduler } from "../liveSuggestionScheduler";
import { startWeeklyReportScheduler } from "../weeklyReportScheduler";
import { startMonthlyReportScheduler } from "../monthlyReportScheduler";
import { startPeerBonusResetScheduler } from "../peerBonusResetScheduler";
import { startDailyRankingScheduler } from "../dailyRankingScheduler";
import { startPreBriefingScheduler } from "../preBriefingScheduler";
import { startFeishuSyncScheduler } from "../feishuSyncScheduler";
import { startContactSearchScheduler } from "../contactSearchScheduler";
import { trackingRouter } from "../tracking";
import { devSafetyRouter } from "../devSafety";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  // Trust Railway's reverse proxy for correct req.protocol, req.secure, req.ip
  app.set('trust proxy', 1);
  const server = createServer(app);

  // Stripe Webhook endpoint - MUST be registered BEFORE express.json()
  // because Stripe needs the raw body for signature verification
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const { handleStripeWebhook } = await import("../stripeWebhook");
      await handleStripeWebhook(req, res);
    } catch (error) {
      console.error("[Stripe Webhook] Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Enable gzip/brotli compression for all responses
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  }));

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS for external LP forms (livecommercejapan.jp)
  app.use((req, res, next) => {
    const allowedOrigins = ["https://livecommercejapan.jp", "https://www.livecommercejapan.jp", "http://localhost:3000", "http://localhost:5173"];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // OAuth removed - using custom email/password auth

  // Aitherhub Webhook endpoint - receives video analysis results
  app.post("/api/aitherhub/webhook", async (req, res) => {
    try {
      const { handleAitherhubWebhook } = await import("../aitherhubWebhook");
      await handleAitherhubWebhook(req, res);
    } catch (error) {
      console.error("[Aitherhub Webhook] Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });
  app.post("/api/aitherhub/verify-liver", async (req, res) => {
    try {
      const { handleVerifyLiver } = await import("../aitherhubWebhook");
      await handleVerifyLiver(req, res);
    } catch (error) {
      console.error("[Aitherhub Verify] Error:", error);
      res.status(500).json({ error: "Verify liver failed" });
    }
  });
  app.get("/api/aitherhub/health", async (req, res) => {
    try {
      const { handleAitherhubHealth } = await import("../aitherhubWebhook");
      await handleAitherhubHealth(req, res);
    } catch (error) {
      res.status(500).json({ error: "Health check failed" });
    }
  });

  // Email tracking endpoint
  app.use("/api/track", trackingRouter);

  // Dev Safety - File Lock API (Layer 2 of 4-Layer Defense)
  app.use("/api/v1/dev-safety", devSafetyRouter);
  
  // Task completion endpoint
  app.get("/complete/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const task = await getTaskByCompletionToken(token);
      
      if (!task) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>タスクが見つかりません / Task Not Found</title>
            <style>
              body { font-family: sans-serif; padding: 40px; text-align: center; }
              .container { max-width: 600px; margin: 0 auto; }
              h1 { color: #e74c3c; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ タスクが見つかりません / Task Not Found</h1>
              <p>このリンクは無効です。 / This link is invalid.</p>
            </div>
          </body>
          </html>
        `);
      }
      
      // Update task status to completed
      await updateTask(task.id, {
        status: "completed",
        completedAt: Date.now(),
      });
      
      // Notify owner
      await notifyOwner({
        title: "タスクが完了しました / Task Completed",
        content: `タスクID: ${task.taskId}\n内容: ${task.taskDetail}`,
      });
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>タスク完了 / Task Completed</title>
          <style>
            body { font-family: sans-serif; padding: 40px; text-align: center; }
            .container { max-width: 600px; margin: 0 auto; }
            h1 { color: #27ae60; }
            .message { margin: 20px 0; line-height: 1.8; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ タスクが完了しました！ / Task Completed!</h1>
            <div class="message">
              <p><strong>日本語：</strong><br>タスクを完了として記録しました。お疲れ様でした！</p>
              <p><strong>中文：</strong><br>任务已标记为完成。辛苦了！</p>
            </div>
            <p style="margin-top: 40px; color: #7f8c8d;">このウィンドウを閉じてください / You can close this window</p>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("[Complete Task] Error:", error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>エラー / Error</title>
          <style>
            body { font-family: sans-serif; padding: 40px; text-align: center; }
            .container { max-width: 600px; margin: 0 auto; }
            h1 { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ エラーが発生しました / Error Occurred</h1>
            <p>タスクの完了処理中にエラーが発生しました。 / An error occurred while completing the task.</p>
          </div>
        </body>
        </html>
      `);
    }
  });
  
  // LINE Webhook endpoint
  const lineModule = await import("../line");
  const lineDb = await import("../db");
  
  // Process LINE event
  async function processLineEvent(
    event: any,
    line: typeof lineModule,
    db: typeof lineDb
  ) {
    console.log(`[LINE] Event type: ${event.type}, source: ${event.source.type}`);
    
    // Handle different event types
    switch (event.type) {
      case "message":
        await handleLineMessage(event, line, db);
        break;
      case "join":
        // Bot joined a group
        if (event.source.groupId) {
          const groupSummary = await line.getGroupSummary(event.source.groupId);
          console.log(`[LINE] Joined group: ${groupSummary?.groupName}`);
          // Save group to database
          await db.createOrUpdateLineGroup({
            lineGroupId: event.source.groupId,
            groupName: groupSummary?.groupName || "Unknown",
            pictureUrl: groupSummary?.pictureUrl,
          });
        }
        break;
      case "follow":
        // User added bot as friend
        if (event.source.userId) {
          const profile = await line.getUserProfile(event.source.userId);
          console.log(`[LINE] New follower: ${profile?.displayName}`);
          // Save user to database
          await db.createOrUpdateLineUser({
            lineUserId: event.source.userId,
            displayName: profile?.displayName,
            pictureUrl: profile?.pictureUrl,
            statusMessage: profile?.statusMessage,
          });
          
          // Check if this LINE user is already linked to a liver account or mall account
          const { findLiverByLineUserId } = await import("../lineWebhook");
          const { getLineUserByLineId } = await import("../db");
          const { sendLinePushMessage } = await import("./../_core/lineMessaging");
          
          const existingLiver = await findLiverByLineUserId(event.source.userId);
          const existingMallUser = await getLineUserByLineId(event.source.userId);
          
          if (existingLiver && existingMallUser) {
            // Both linked - welcome back
            await sendLinePushMessage(event.source.userId, [
              {
                type: "text",
                text: `${existingLiver.name}さん、おかえりなさい！🎉\n\nライバーアカウントとモール会員アカウントの両方が連携済みです。\n\n・配信後にAIコーチングが届きます\n・TikTok Shopのレシートを送信してポイント獲得できます`,
              },
            ]);
          } else if (existingLiver) {
            // Liver linked but not mall - offer mall linking
            await sendLinePushMessage(event.source.userId, [
              {
                type: "text",
                text: `${existingLiver.name}さん、おかえりなさい！🎉\n\nライバーアカウントは連携済みです。配信後にAIコーチングが届きます。\n\n💰 LCJ MALLもお使いですか？\nTikTok Shopのレシートを送信してポイントを獲得できます。\n\n【モール連携方法】\n1. lcjmall.com にログイン\n2. マイページ → LINE連携\n3. 表示されるコード（M-XXXXXX）をこちらに送信`,
              },
            ]);
          } else if (existingMallUser) {
            // Mall linked but not liver - offer liver linking
            await sendLinePushMessage(event.source.userId, [
              {
                type: "text",
                text: `おかえりなさい！🎉\n\nLCJ MALLアカウントは連携済みです。TikTok Shopのレシートを送信してポイントを獲得できます。\n\n🎙️ LCJライバーですか？\n配信後にAIコーチングを受け取れます。\n\n【ライバー連携方法】\n1. LCJライバーアプリにログイン\n2. プロフィール編集 → LINE連携\n3. 表示される6桁のコードをこちらに送信`,
              },
            ]);
          } else {
            // Not linked to anything - send both options
            await sendLinePushMessage(event.source.userId, [
              {
                type: "text",
                text: `LCJへようこそ！🎊\n\n【LCJライバーの方】\n配信後にAIコーチングを受け取れます。\n1. LCJライバーアプリにログイン\n2. プロフィール編集 → LINE連携\n3. 6桁のコードを送信\n\n【LCJ MALL会員の方】\nTikTok Shopのレシートを送信してポイント獲得！\n1. lcjmall.com にログイン\n2. マイページ → LINE連携\n3. コード（M-XXXXXX）を送信\n\n連携コードを入力してください👇`,
              },
            ]);
          }
        }
        break;
      case "unfollow":
        // User blocked bot
        if (event.source.userId) {
          console.log(`[LINE] User unfollowed: ${event.source.userId}`);
          await db.updateLineUserBlocked(event.source.userId, true);
        }
        break;
      case "leave":
        // Bot left/removed from group
        if (event.source.groupId) {
          console.log(`[LINE] Left group: ${event.source.groupId}`);
          await db.updateLineGroupActive(event.source.groupId, false);
        }
        break;
    }
  }
  
  // Handle LINE message with AI Agent
  async function handleLineMessage(
    event: any,
    line: typeof lineModule,
    db: typeof lineDb
  ) {
    // Check for liver link code (6-digit number from individual user)
    console.log(`[LINE handleLineMessage] source.type=${event.source.type}, message.type=${event.message?.type}, text="${event.message?.text?.trim()}"`);  
    if (event.source.type === "user" && event.message?.type === "text") {
      const text = event.message.text?.trim() || "";
      
      // Check if it's a liver link code: either 6-digit number or L-XXXXXX format
      const liverCodeMatch = text.match(/^(?:L-?)?(\d{6})$/i);
      console.log(`[LINE LinkCode] text="${text}", match=${JSON.stringify(liverCodeMatch)}`);
      if (liverCodeMatch) {
        const codeDigits = liverCodeMatch[1];
        const fullCode = `L-${codeDigits}`;
        const { findLiverByLineUserId, findLiverByLinkCode, linkLineUserToLiver } = await import("../lineWebhook");
        const { sendLinePushMessage } = await import("./../_core/lineMessaging");
        const lineUserId = event.source.userId;
        
        if (!lineUserId) return;
        
        // Check if already linked
        const existingLiver = await findLiverByLineUserId(lineUserId);
        if (existingLiver) {
          await sendLinePushMessage(lineUserId, [
            {
              type: "text",
              text: `${existingLiver.name}さん、既にLINE連携済みです！✅\n\n配信後にAIコーチングが届きます。`,
            },
          ]);
          return;
        }
        
        // Try to find liver by link code (try both formats)
        let liverData = await findLiverByLinkCode(fullCode);
        if (!liverData) {
          // Also try with just digits in case DB stores without prefix
          liverData = await findLiverByLinkCode(codeDigits);
        }
        
        if (!liverData) {
          await sendLinePushMessage(lineUserId, [
            {
              type: "text",
              text: `連携コードが見つからないか、有効期限が切れています。\n\nLCJライバーアプリで新しいコードを発行してください。`,
            },
          ]);
          return;
        }
        
        // Link the accounts
        await linkLineUserToLiver(liverData.id, lineUserId);
        
        await sendLinePushMessage(lineUserId, [
          {
            type: "text",
            text: `🎉 ${liverData.name}さん、LINE連携が完了しました！\n\nこれから配信後にAIコーチングがLINEに届きます。\n毎朝、あなた宛の配信提案もお届けします。\n\n頑張ってください！💪`,
          },
        ]);
        return;
      }
      
      // Check if it's a Mall link code (M-XXXXXX format)
      if (/^M-\d{6}$/i.test(text)) {
        const { verifyAndUseLinkCode, linkLineAccountToEmailUser, getLineUserById } = await import("../db");
        const { sendLinePushMessage } = await import("./../_core/lineMessaging");
        const lineUserId = event.source.userId;
        
        if (!lineUserId) return;
        
        // Verify the code and get the email user ID
        const emailUserId = await verifyAndUseLinkCode(text.toUpperCase(), lineUserId);
        
        if (!emailUserId) {
          await sendLinePushMessage(lineUserId, [
            {
              type: "text",
              text: `連携コードが見つからないか、有効期限が切れています。\n\nLCJ MALLマイページで新しいコードを発行してください。`,
            },
          ]);
          return;
        }
        
        // Get LINE profile
        const profile = await line.getUserProfile(lineUserId);
        
        // Link the LINE account to the email user
        try {
          await linkLineAccountToEmailUser(
            emailUserId,
            lineUserId,
            profile?.displayName,
            profile?.pictureUrl
          );
          
          // Get user info for personalized message
          const emailUser = await getLineUserById(emailUserId);
          const userName = emailUser?.displayName || profile?.displayName || "お客様";
          
          await sendLinePushMessage(lineUserId, [
            {
              type: "text",
              text: `🎉 ${userName}さん、LINE連携が完了しました！\n\nこれからレシートをLINEで送信できます。\n\nTikTok Shopで購入したら、レシート画像をこのトークに送信してポイントを獲得しましょう！💰`,
            },
          ]);
        } catch (error: any) {
          if (error.message === "LINE_ALREADY_LINKED_TO_MALL") {
            await sendLinePushMessage(lineUserId, [
              {
                type: "text",
                text: `このLINEアカウントは既に別のモール会員アカウントに連携されています。\n\n別のアカウントでログインしてお試しください。`,
              },
            ]);
          } else {
            await sendLinePushMessage(lineUserId, [
              {
                type: "text",
                text: `連携処理中にエラーが発生しました。\n\nしばらくしてから再度お試しください。`,
              },
            ]);
          }
        }
        return;
      }
    }
    
    // Use combined message processor that handles text, video, and other message types
    const { processLineMessageAll } = await import("../lineAgent");
    await processLineMessageAll(event);
  }
  
  // Use raw body for LINE signature verification
  app.post("/api/line/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const signature = req.headers["x-line-signature"] as string;
      
      // Handle both Buffer and string body
      let bodyString: string;
      if (Buffer.isBuffer(req.body)) {
        bodyString = req.body.toString("utf8");
      } else if (typeof req.body === "string") {
        bodyString = req.body;
      } else if (typeof req.body === "object") {
        bodyString = JSON.stringify(req.body);
      } else {
        bodyString = String(req.body);
      }
      
      // Handle empty body
      if (!bodyString || bodyString === "undefined") {
        console.log("[LINE Webhook] Empty body received");
        return res.status(200).json({ success: true });
      }
      
      let body: { destination?: string; events: any[] };
      try {
        body = JSON.parse(bodyString);
      } catch (parseError) {
        console.error("[LINE Webhook] JSON parse error:", parseError, "Body:", bodyString.substring(0, 100));
        return res.status(200).json({ success: true }); // Return 200 for malformed requests
      }
      
      // For LINE Verify requests (empty events array), skip signature verification
      // This allows the Verify button in LINE Developers Console to work
      if (!body.events || body.events.length === 0) {
        console.log("[LINE Webhook] Verify request received (empty events)");
        return res.status(200).json({ success: true });
      }
      
      // Verify signature for actual webhook events
      if (!lineModule.verifyLineSignature(bodyString, signature)) {
        console.error("[LINE Webhook] Invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
      
      console.log("[LINE Webhook] Received events:", body.events.length);
      
      // プロラインフリーへ非同期で転送（LCJの処理をブロックしない）
      lineModule.forwardToProline(bodyString, signature).catch((err: Error) => {
        console.error("[Proline Forward] Async forward error:", err);
      });
      
      // Process each event
      for (const event of body.events) {
        await processLineEvent(event, lineModule, lineDb);
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("[LINE Webhook] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Voice upload endpoint
  const multer = await import("multer");
  const upload = multer.default({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
  const { storagePut } = await import("../storage");
  const { nanoid } = await import("nanoid");
  
  app.post("/api/upload-voice", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const file = req.file as Express.Multer.File;
      const fileExtension = file.mimetype.includes("webm") ? "webm" : "mp4";
      const fileName = `voice/${nanoid()}.${fileExtension}`;
      
      const result = await storagePut(fileName, file.buffer, file.mimetype);
      
      res.json({ url: result.url });
    } catch (error) {
      console.error("[Voice Upload] Error:", error);
      res.status(500).json({ error: "Failed to upload voice file" });
    }
  });

  // Liver avatar upload endpoint
  app.post("/api/liver-avatar-upload", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const file = req.file as Express.Multer.File;
      const liverId = req.body.liverId;
      
      if (!liverId) {
        return res.status(400).json({ error: "Liver ID is required" });
      }
      
      // Validate file type (images only)
      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "File size must be less than 5MB" });
      }
      
      // Generate unique file key
      const fileExtension = file.originalname.split(".").pop() || "jpg";
      const fileKey = `liver-avatars/${liverId}/${nanoid()}.${fileExtension}`;
      
      const result = await storagePut(fileKey, file.buffer, file.mimetype);
      
      // Update liver record with new avatar URL
      const { updateLiver } = await import("../db");
      await updateLiver(parseInt(liverId, 10), {
        avatarUrl: result.url,
        avatarKey: fileKey,
      });
      
      res.json({
        url: result.url,
        key: fileKey,
      });
    } catch (error) {
      console.error("[Liver Avatar Upload] Error:", error);
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });

  // Brand file upload endpoint
  app.post("/api/brand-file-upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const file = req.file as Express.Multer.File;
      const brandId = req.body.brandId;
      
      if (!brandId) {
        return res.status(400).json({ error: "Brand ID is required" });
      }
      
      // Generate unique file key
      const fileExtension = file.originalname.split(".").pop() || "bin";
      const fileKey = `brand-files/${brandId}/${nanoid()}.${fileExtension}`;
      
      const result = await storagePut(fileKey, file.buffer, file.mimetype);
      
      // Decode filename from latin1 to UTF-8 (multer encodes as latin1)
      const decodedFileName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
      
      res.json({
        url: result.url,
        key: fileKey,
        fileName: decodedFileName,
        fileSize: file.size,
        mimeType: file.mimetype,
      });
    } catch (error) {
      console.error("[Brand File Upload] Error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Recruitment image upload endpoint (for AI OCR recognition)
  app.post("/api/recruitment-image-upload", upload.array("files", 20), async (req: any, res) => {
    try {
      // 認証は任意 - HRメンバー全員がアップロード可能
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch (e) {
        console.log('[Recruitment Image Upload] Auth skipped, proceeding as anonymous');
      }
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      const results: { url: string; fileName: string }[] = [];
      for (const file of files) {
        if (!file.mimetype.startsWith("image/")) {
          continue; // skip non-image files
        }
        const ext = file.originalname.split(".").pop() || "jpg";
        const fileKey = `recruitment-images/${nanoid()}.${ext}`;
        const result = await storagePut(fileKey, file.buffer, file.mimetype);
        const decodedFileName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
        results.push({ url: result.url, fileName: decodedFileName });
      }
      res.json({ success: true, files: results });
    } catch (error) {
      console.error("[Recruitment Image Upload] Error:", error);
      res.status(500).json({ error: "Failed to upload images" });
    }
  });

  // CSV Upload REST API endpoint (avoids tRPC Base64 size issues)
  // Wrap multer in error handler to prevent raw error responses
  app.post("/api/csv-upload", (req: any, res: any, next: any) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        console.error("[CSV Upload REST] Multer error:", err.message);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: "ファイルサイズが大きすぎます（16MB以下にしてください）" });
        }
        return res.status(400).json({ error: `ファイルアップロードエラー: ${err.message?.substring(0, 100) || '不明なエラー'}` });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      // 認証は任意 - HRメンバー全員がアップロード可能
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch (e) {
        // 認証失敗でもアップロードは許可
        console.log('[CSV Upload] Auth skipped, proceeding as anonymous');
      }
      if (!req.file) {
        return res.status(400).json({ error: "ファイルがアップロードされていません" });
      }
      const file = req.file as Express.Multer.File;
      const brandId = parseInt(req.body.brandId, 10);
      if (!brandId || isNaN(brandId)) {
        return res.status(400).json({ error: "ブランドIDが必要です" });
      }

      // Decode filename from latin1 to UTF-8
      const decodedFileName = Buffer.from(file.originalname, 'latin1').toString('utf-8');

      // Import required modules
      const iconv = await import("iconv-lite");
      const chardet = await import("chardet");
      const {
        createTiktokCsvImportHistory,
        updateTiktokCsvImportHistory,
        bulkInsertTiktokOrders,
        getExistingSubOrderIds,
      } = await import("../db");

      // 1. Create import history record
      const importId = await createTiktokCsvImportHistory({
        brandId,
        fileName: decodedFileName,
        uploadedBy: user.id,
        uploadedByName: user.name || user.email,
        status: "processing",
      });

      try {
        // 2. Decode CSV content with auto encoding detection
        const csvBuffer = file.buffer;
        let csvText: string;

        const detected = chardet.detect(csvBuffer);
        const encoding = detected || "utf-8";
        console.log(`[CSV Upload REST] Detected encoding: ${encoding}, file size: ${file.size}`);

        if (encoding.toLowerCase().includes("shift") || encoding.toLowerCase().includes("sjis") || encoding.toLowerCase() === "iso-2022-jp" || encoding.toLowerCase().includes("euc")) {
          csvText = iconv.decode(csvBuffer, "Shift_JIS");
        } else if (encoding.toLowerCase().includes("utf-16")) {
          csvText = iconv.decode(csvBuffer, encoding);
        } else {
          csvText = csvBuffer.toString("utf-8");
          if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.slice(1);
          }
        }

        // Normalize line endings
        csvText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const lines = csvText.split("\n").filter((l: string) => l.trim());

        if (lines.length < 2) {
          throw new Error("CSVファイルにデータがありません");
        }

        // 3. Parse header
        const headers = csvParseCSVLine(lines[0]).map((h: string) => h.replace(/^\uFEFF/, '').trim());
        console.log(`[CSV Upload REST] Parsed ${headers.length} headers. First 5: ${headers.slice(0, 5).join(', ')}`);

        // 4. Parse all rows — handle multi-subOrderId rows by splitting
        const orders: any[] = [];
        const subOrderIds: string[] = [];
        let errorCount = 0;
        for (let i = 1; i < lines.length; i++) {
          try {
            const values = csvParseCSVLine(lines[i]);
            if (values.length < 10) continue;
            const row = csvMapHeadersToValues(headers, values);
            const rawSubOrderId = String(row["サブ注文ID"] || "");
            // Handle multi-subOrderId (comma-separated within quotes, e.g. "id1,id2,id3")
            if (rawSubOrderId.includes(",")) {
              const subIds = rawSubOrderId.split(",").map((s: string) => s.trim()).filter((s: string) => s);
              for (const subId of subIds) {
                const clonedRow = { ...row, "サブ注文ID": subId };
                subOrderIds.push(subId);
                orders.push(clonedRow);
              }
            } else {
              subOrderIds.push(rawSubOrderId);
              orders.push(row);
            }
          } catch (e) {
            errorCount++;
          }
        }

        // 5. Check for duplicates
        const existingIds = await getExistingSubOrderIds(brandId, subOrderIds);
        const existingSet = new Set(existingIds);

        // 6. Filter out duplicates and prepare insert data
        const newOrders: any[] = [];
        let skippedCount = 0;
        for (let i = 0; i < orders.length; i++) {
          const subOrderId = subOrderIds[i];
          if (existingSet.has(subOrderId)) {
            skippedCount++;
            continue;
          }
          const row = orders[i];
          newOrders.push({
            brandId,
            importHistoryId: importId,
            orderId: csvTruncate(String(row["注文ID"] || ""), 64),
            subOrderId: csvTruncate(String(row["サブ注文ID"] || ""), 64),
            orderStatus: csvTruncate(row["注文状況"] || null, 50),
            creatorUsername: csvTruncate(row["クリエイターのユーザー名"] || "", 255),
            productName: row["商品名"] || "",
            sku: row["SKU"] || null,
            productId: csvTruncate(String(row["商品ID"] || ""), 64),
            price: csvParseIntSafe(row["価格"]),
            quantity: csvParseIntSafe(row["数量"]) || 1,
            shopName: csvTruncate(row["ショップ名"] || null, 255),
            shopCode: csvTruncate(row["ショップコード"] || null, 64),
            contentType: csvTruncate(row["コンテンツタイプ"] || null, 50),
            contentId: csvTruncate(String(row["コンテンツID"] || ""), 64),
            partnerCommissionRate: csvParseFloatSafe(row["アフィリエイトパートナー成果報酬率"]) !== null ? String(csvParseFloatSafe(row["アフィリエイトパートナー成果報酬率"])) : null,
            creatorCommissionRate: csvParseFloatSafe(row["クリエイター成果報酬率"]) !== null ? String(csvParseFloatSafe(row["クリエイター成果報酬率"])) : null,
            partnerRewardRate: csvParseIntSafe(row["パートナー成果報酬リワード率"]),
            creatorRewardRate: csvParseIntSafe(row["クリエイターの手数料リワード率"]),
            partnerShopAdRate: csvParseIntSafe(row["アフィリエイトパートナーのショップ広告成果報酬率"]),
            creatorShopAdRate: csvParseIntSafe(row["クリエイターのショップ広告成果報酬率"]),
            estimatedCommissionBase: csvParseIntSafe(row["推定成果報酬ベース"]),
            estimatedPartnerCommission: csvParseFloatSafe(row["推定アフィリエイトパートナー手数料額"]) !== null ? String(csvParseFloatSafe(row["推定アフィリエイトパートナー手数料額"])) : null,
            estimatedCreatorCommission: csvParseFloatSafe(row["推定クリエイター手数料額"]) !== null ? String(csvParseFloatSafe(row["推定クリエイター手数料額"])) : null,
            estimatedPartnerReward: csvParseIntSafe(row["パートナーの推定成果報酬リワード料"]),
            estimatedCreatorReward: csvParseIntSafe(row["クリエイターの推定成果報酬リワード料"]),
            estimatedCreatorShopAdPay: csvParseIntSafe(row["クリエイターのショップ広告成果報酬支払額（推定）"]),
            estimatedPartnerShopAdPay: csvParseIntSafe(row["アフィリエイトパートナーのショップ広告成果報酬支払額（推定）"]),
            actualCommissionBase: csvParseFloatSafe(row["実際の手数料ベース"]) !== null ? String(csvParseFloatSafe(row["実際の手数料ベース"])) : null,
            actualPartnerCommission: csvParseFloatSafe(row["実際のアフィリエイトパートナー手数料額"]) !== null ? String(csvParseFloatSafe(row["実際のアフィリエイトパートナー手数料額"])) : null,
            actualCreatorCommission: csvParseFloatSafe(row["クリエイターの実際の手数料額"]) !== null ? String(csvParseFloatSafe(row["クリエイターの実際の手数料額"])) : null,
            actualPartnerReward: csvParseFloatSafe(row["パートナーの実際の手数料リワード料"]) !== null ? String(csvParseFloatSafe(row["パートナーの実際の手数料リワード料"])) : null,
            actualCreatorReward: csvParseFloatSafe(row["クリエイターの実際の手数料リワード料"]) !== null ? String(csvParseFloatSafe(row["クリエイターの実際の手数料リワード料"])) : null,
            actualPartnerShopAdPay: csvParseFloatSafe(row["アフィリエイトパートナーのショップ広告成果報酬支払額（実際）"]) !== null ? String(csvParseFloatSafe(row["アフィリエイトパートナーのショップ広告成果報酬支払額（実際）"])) : null,
            actualCreatorShopAdPay: csvParseFloatSafe(row["クリエイターのショップ広告成果報酬支払額（実際）"]) !== null ? String(csvParseFloatSafe(row["クリエイターのショップ広告成果報酬支払額（実際）"])) : null,
            returnQuantity: csvParseIntSafe(row["返品される商品の数量"]) || 0,
            refundQuantity: csvParseIntSafe(row["返金される商品の数量"]) || 0,
            orderCreatedAt: csvParseDateDDMMYYYY(row["作成日時"]),
            orderDeliveredAt: csvParseDateDDMMYYYY(row["注文配達日時"]),
            commissionSettledAt: csvParseDateDDMMYYYY(row["手数料決済日時"]),
            paymentId: csvTruncate(String(row["支払いID"] || ""), 64),
            paymentMethod: csvTruncate(row["支払い方法"] || null, 50),
            paymentAccount: csvTruncate(row["支払い口座"] || null, 50),
            iva: csvParseIntSafe(row["IVA"]) || 0,
            isr: csvParseIntSafe(row["ISR"]) || 0,
            platform: csvTruncate(row["プラットフォーム"] || null, 20),
            factorType: csvTruncate(row["要因のタイプ"] || null, 20),
          });
        }

        // 7. Bulk insert
        let insertedCount = 0;
        if (newOrders.length > 0) {
          insertedCount = await bulkInsertTiktokOrders(newOrders);
        }

        // 8. Calculate summary
        let totalSales = 0;
        let totalPartnerComm = 0;
        let totalCreatorComm = 0;
        let minDate: Date | null = null;
        let maxDate: Date | null = null;
        for (const o of newOrders) {
          totalSales += o.price || 0;
          totalPartnerComm += parseFloat(o.actualPartnerCommission || "0");
          totalCreatorComm += parseFloat(o.actualCreatorCommission || "0");
          if (o.orderCreatedAt) {
            if (!minDate || o.orderCreatedAt < minDate) minDate = o.orderCreatedAt;
            if (!maxDate || o.orderCreatedAt > maxDate) maxDate = o.orderCreatedAt;
          }
        }

        // 9. Update import history
        await updateTiktokCsvImportHistory(importId, {
          totalRows: orders.length,
          importedRows: insertedCount,
          skippedRows: skippedCount,
          errorRows: errorCount,
          totalSales: Math.round(totalSales),
          totalPartnerCommission: Math.round(totalPartnerComm),
          totalCreatorCommission: Math.round(totalCreatorComm),
          dateRangeStart: minDate,
          dateRangeEnd: maxDate,
          status: "completed",
        });

        res.json({
          importId,
          totalRows: orders.length,
          importedRows: insertedCount,
          skippedRows: skippedCount,
          errorRows: errorCount,
        });
      } catch (error: any) {
        const safeMsg = csvSanitizeErrorMessage(error.message || "Unknown error");
        console.error("[CSV Upload REST] Import error:", safeMsg);
        // Try to update import history, but don't let this fail the response
        try {
          await updateTiktokCsvImportHistory(importId, {
            status: "failed",
            errorMessage: safeMsg.substring(0, 500),
          });
        } catch (updateErr) {
          console.error("[CSV Upload REST] Failed to update import history:", updateErr);
        }
        if (!res.headersSent) {
          res.status(500).json({ error: `CSVインポートに失敗しました: ${safeMsg}` });
        }
      }
    } catch (error: any) {
      const safeMsg = csvSanitizeErrorMessage(error.message || "CSVアップロードに失敗しました");
      console.error("[CSV Upload REST] Error:", safeMsg);
      if (!res.headersSent) {
        res.status(500).json({ error: safeMsg });
      }
    }
  });


  // Global Express error handler to prevent raw error text responses
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("[Express Error Handler]", err.message?.substring(0, 200));
    if (!res.headersSent) {
      res.status(500).json({ error: "サーバーエラーが発生しました。再度お試しください。" });
    }
  });

  // --- Top page prerender for SEO (Organization + WebSite JSON-LD) ---
  app.get("/", async (req, res, next) => {
    try {
      const ua = (req.headers["user-agent"] || "").toLowerCase();
      const isBot = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|chatgpt|gptbot|claudebot|perplexity|anthropic/i.test(ua);
      if (!isBot) return next();

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const title = "LCJ MALL - TikTok Shop連携ECモール | ポイ活・レシート副業・ライブコマース";
      const description = "LCJ MALL（エルシージェイモール）は、TikTok Shop連携の日本初のECモールです。ポイ活・レシート副業・ライブコマース情報も発信。お得にショッピングしながらポイントも貯まる、新しいお買い物体験を提供します。";
      const keywords = "LCJ MALL,lcjモール,ポイ活,レシート副業,ライブコマース,TikTok Shop,ECモール,お得,ショッピング,ポイント";

      const orgJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "LCJ MALL",
        alternateName: ["lcjモール", "Live Commerce Japan", "エルシージェイモール"],
        url: baseUrl,
        logo: `${baseUrl}/favicon.svg`,
        description,
        foundingDate: "2025",
        sameAs: [],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          availableLanguage: ["Japanese", "English"],
        },
      });

      const websiteJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "LCJ MALL",
        alternateName: "lcjモール",
        url: baseUrl,
        description,
        inLanguage: "ja",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${baseUrl}/blog?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      });

      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${baseUrl}/">
  <link rel="alternate" hreflang="ja" href="${baseUrl}/">
  <link rel="alternate" hreflang="x-default" href="${baseUrl}/">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/">
  <meta property="og:site_name" content="LCJ MALL">
  <meta property="og:locale" content="ja_JP">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="geo.region" content="JP">
  <meta name="geo.placename" content="Japan">
  <script type="application/ld+json">${orgJsonLd}</script>
  <script type="application/ld+json">${websiteJsonLd}</script>
</head>
<body>
  <header>
    <h1>LCJ MALL - TikTok Shop連携ECモール</h1>
    <p>ポイ活・レシート副業・ライブコマース情報を発信</p>
  </header>
  <main>
    <section>
      <h2>LCJ MALLとは</h2>
      <p>LCJ MALL（エルシージェイモール）は、TikTok Shopと連携した日本初のECモールです。お得にショッピングしながらポイントも貯まる、新しいお買い物体験を提供します。</p>
    </section>
    <section>
      <h2>主な機能</h2>
      <ul>
        <li><strong>ポイ活</strong> - レシートスキャンやお買い物でポイントが貯まる</li>
        <li><strong>レシート副業</strong> - レシートをスキャンして副収入を得る</li>
        <li><strong>ライブコマース</strong> - ライブ配信で商品を購入・販売</li>
        <li><strong>TikTok Shop連携</strong> - TikTok Shopの商品をお得に購入</li>
        <li><strong>口コミDB</strong> - 購入証明済みの信頼できるレビュー</li>
      </ul>
    </section>
    <nav>
      <a href="${baseUrl}/blog">ブログ記事</a>
      <a href="${baseUrl}/mall">商品一覧</a>
      <a href="${baseUrl}/brands">ブランド</a>
      <a href="${baseUrl}/reviews">口コミDB</a>
    </nav>
  </main>
</body>
</html>`;

      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
    } catch (error) {
      console.error("[Top Prerender] Error:", error);
      next();
    }
  });

  // --- Blog listing page prerender for SEO (CollectionPage + BreadcrumbList JSON-LD) ---
  app.get("/blog", async (req, res, next) => {
    try {
      const ua = (req.headers["user-agent"] || "").toLowerCase();
      const isBot = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|chatgpt|gptbot|claudebot|perplexity|anthropic/i.test(ua);
      if (!isBot) return next();

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const { getAllBlogCategories, getBlogCategoryArticleCounts } = await import("../db");

      // カテゴリ一覧取得
      const categories = await getAllBlogCategories() || [];
      let categoryCounts: Record<number, number> = {};
      try { categoryCounts = await getBlogCategoryArticleCounts(); } catch (e) {}

      // 最新記事20件取得（簡易SQL）
      const { getDb } = await import("../db");
      const db = await getDb();
      let recentArticles: any[] = [];
      if (db) {
        const { blogArticles } = await import("../../drizzle/schema");
        const { eq, desc } = await import("drizzle-orm");
        recentArticles = await db.select({
          id: blogArticles.id,
          title: blogArticles.title,
          slug: blogArticles.slug,
          excerpt: blogArticles.excerpt,
          publishedAt: blogArticles.publishedAt,
          coverImageUrl: blogArticles.coverImageUrl,
        }).from(blogArticles)
          .where(eq(blogArticles.status, "published"))
          .orderBy(desc(blogArticles.publishedAt))
          .limit(20);
      }

      const title = "LCJ MALL ブログ | ポイ活・レシート副業・ライブコマース・美容情報";
      const description = "LCJ MALL公式ブログ。ポイ活、レシート副業、TikTok Shopライブコマース、シャンプー・ヘアケアなど美容情報を毎日更新。お得な情報をお届けします。";
      const keywords = "LCJ MALL,ブログ,ポイ活,レシート副業,ライブコマース,TikTok Shop,シャンプー,ヘアケア,KYOGOKU,美容";

      const collectionJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description,
        url: `${baseUrl}/blog`,
        isPartOf: { "@type": "WebSite", name: "LCJ MALL", url: baseUrl },
        inLanguage: "ja",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: recentArticles.length,
          itemListElement: recentArticles.slice(0, 10).map((a: any, i: number) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${baseUrl}/blog/${a.slug}`,
            name: a.title,
          })),
        },
      });

      const breadcrumbJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "LCJ MALL", item: baseUrl },
          { "@type": "ListItem", position: 2, name: "ブログ", item: `${baseUrl}/blog` },
        ],
      });

      const categoryHtml = categories.map((c: any) => {
        const count = categoryCounts[c.id] || 0;
        return `<li><a href="${baseUrl}/blog?category=${c.slug}">${escapeHtml(c.name)}（${count}件）</a></li>`;
      }).join("\n        ");

      const articleHtml = recentArticles.map((a: any) => {
        const date = a.publishedAt ? new Date(a.publishedAt).toISOString().split("T")[0] : "";
        return `<article>
          <h3><a href="${baseUrl}/blog/${a.slug}">${escapeHtml(a.title)}</a></h3>
          ${a.excerpt ? `<p>${escapeHtml(a.excerpt.substring(0, 200))}</p>` : ""}
          <time datetime="${date}">${date}</time>
        </article>`;
      }).join("\n      ");

      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${baseUrl}/blog">
  <link rel="alternate" hreflang="ja" href="${baseUrl}/blog">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/blog">
  <meta property="og:site_name" content="LCJ MALL">
  <meta property="og:locale" content="ja_JP">
  ${recentArticles[0]?.coverImageUrl ? `<meta property="og:image" content="${escapeHtml(recentArticles[0].coverImageUrl)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${recentArticles[0]?.coverImageUrl ? `<meta name="twitter:image" content="${escapeHtml(recentArticles[0].coverImageUrl)}">` : ''}
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <script type="application/ld+json">${collectionJsonLd}</script>
  <script type="application/ld+json">${breadcrumbJsonLd}</script>
</head>
<body>
  <header>
    <h1>LCJ MALL ブログ</h1>
    <p>ポイ活・レシート副業・ライブコマース・美容情報を毎日更新</p>
  </header>
  <nav>
    <h2>カテゴリ</h2>
    <ul>
      ${categoryHtml}
    </ul>
  </nav>
  <main>
    <h2>最新記事</h2>
    ${articleHtml}
  </main>
  <footer>
    <a href="${baseUrl}">LCJ MALL トップ</a>
    <a href="${baseUrl}/reviews">口コミDB</a>
    <a href="${baseUrl}/brands">ブランド一覧</a>
  </footer>
</body>
</html>`;

      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
    } catch (error) {
      console.error("[Blog List Prerender] Error:", error);
      next();
    }
  });

  // --- Product Review page prerender for SEO (Schema.org Product + Review + dynamic OGP) ---
  app.get("/reviews/product/:name", async (req, res, next) => {
    try {
      const ua = (req.headers["user-agent"] || "").toLowerCase();
      const isBot = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|chatgpt|gptbot|claudebot|perplexity|anthropic/i.test(ua);
      if (!isBot) return next();

      const { searchReceiptReviewsByProduct } = await import("../db");
      const productName = decodeURIComponent(req.params.name);
      const reviews = await searchReceiptReviewsByProduct(productName, 50);
      if (!reviews || reviews.length === 0) return next();

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const pageUrl = `${baseUrl}/reviews/product/${encodeURIComponent(productName)}`;
      const brandName = reviews[0].brandName || "";
      const avgRating = (reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1);
      const reviewCount = reviews.length;
      const description = `${productName}のリアルな口コミ${reviewCount}件。平均評価${avgRating}/5.0。TikTok Shopで実際に購入したユーザーの購入証明済みレビュー。`;
      const title = `${productName} 口コミ・評判 (${reviewCount}件) | LCJ MALL`;

      // Find product image from product_master or reviews
      let productImageUrl = "";
      try {
        const mysql = await import("mysql2/promise");
        const conn = await (mysql as any).createConnection(process.env.DATABASE_URL);
        const [pmRows]: any = await conn.execute(
          `SELECT imageUrl FROM product_master WHERE canonicalName = ? AND imageUrl IS NOT NULL LIMIT 1`,
          [productName]
        );
        if (pmRows.length > 0 && pmRows[0].imageUrl) {
          productImageUrl = pmRows[0].imageUrl;
        } else {
          // Fallback to latest review product image
          const reviewWithImage = reviews.find((r: any) => r.productImageUrl);
          if (reviewWithImage) productImageUrl = (reviewWithImage as any).productImageUrl;
        }
        await conn.end();
      } catch (e) {
        console.warn("[Review Prerender] Failed to fetch product image:", e);
      }

      // Schema.org Product + AggregateRating + individual Reviews
      const reviewJsonLd = reviews.slice(0, 10).map((r: any) => ({
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 5,
        },
        reviewBody: r.reviewText || "",
        datePublished: r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : undefined,
        author: { "@type": "Person", name: "購入確認済みユーザー" },
      }));

      const productJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: productName,
        brand: brandName ? { "@type": "Brand", name: brandName } : undefined,
        image: productImageUrl || undefined,
        description: `${productName}${brandName ? ` by ${brandName}` : ""}。TikTok Shopで購入可能。`,
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: avgRating,
          bestRating: 5,
          reviewCount: reviewCount,
        },
        review: reviewJsonLd,
      });

      // BreadcrumbList
      const breadcrumbJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "LCJ MALL", item: baseUrl },
          { "@type": "ListItem", position: 2, name: "口コミDB", item: `${baseUrl}/reviews` },
          { "@type": "ListItem", position: 3, name: productName, item: pageUrl },
        ],
      });

      // Generate review HTML for bots
      const reviewsHtml = reviews.slice(0, 20).map((r: any) => {
        const stars = "★".repeat(r.rating || 0) + "☆".repeat(5 - (r.rating || 0));
        const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString("ja-JP") : "";
        return `<div class="review"><p>${stars} ${date}</p><p>${escapeHtml(r.reviewText || "")}</p></div>`;
      }).join("\n");

      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="product">
  <meta property="og:url" content="${pageUrl}">
  ${productImageUrl ? `<meta property="og:image" content="${escapeHtml(productImageUrl)}">` : ""}
  <meta property="og:site_name" content="LCJ MALL">
  <meta property="og:locale" content="ja_JP">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${productImageUrl ? `<meta name="twitter:image" content="${escapeHtml(productImageUrl)}">` : ""}
  <script type="application/ld+json">${productJsonLd}</script>
  <script type="application/ld+json">${breadcrumbJsonLd}</script>
</head>
<body>
  <nav><a href="${baseUrl}">LCJ MALL</a> &gt; <a href="${baseUrl}/reviews">口コミDB</a> &gt; ${escapeHtml(productName)}</nav>
  <h1>${escapeHtml(productName)} 口コミ・評判</h1>
  ${brandName ? `<p>ブランド: ${escapeHtml(brandName)}</p>` : ""}
  ${productImageUrl ? `<img src="${escapeHtml(productImageUrl)}" alt="${escapeHtml(productName)}">` : ""}
  <section>
    <h2>評価サマリー</h2>
    <p>平均評価: ${avgRating}/5.0 (${reviewCount}件のレビュー)</p>
    <p>全レビューは購入証明済み（レシート確認済み）です。</p>
  </section>
  <section>
    <h2>口コミ一覧</h2>
    ${reviewsHtml}
  </section>
  <p><a href="${baseUrl}/reviews">他の商品の口コミを見る</a></p>
</body>
</html>`;

      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
    } catch (error) {
      console.error("[Review Prerender] Error:", error);
      next();
    }
  });

  // --- Reviews listing page prerender for SEO ---
  app.get("/reviews", async (req, res, next) => {
    try {
      const ua = (req.headers["user-agent"] || "").toLowerCase();
      const isBot = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|chatgpt|gptbot|claudebot|perplexity|anthropic/i.test(ua);
      if (!isBot) return next();

      const { getProductReviewRankingEnhanced } = await import("../db");
      const rankings = await getProductReviewRankingEnhanced(50);
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const pageUrl = `${baseUrl}/reviews`;
      const title = "口コミDB - TikTok Shop購入証明済みレビュー | LCJ MALL";
      const description = "TikTok Shopで実際に購入したユーザーによる購入証明済みの口コミデータベース。商品ランキング、評価、リアルなレビューを掲載。";

      const rankingHtml = (rankings || []).map((r: any, i: number) => {
        const stars = "★".repeat(Math.round(r.avgRating || 0)) + "☆".repeat(5 - Math.round(r.avgRating || 0));
        return `<li><a href="${baseUrl}/reviews/product/${encodeURIComponent(r.productName)}">${i + 1}. ${escapeHtml(r.productName)} ${stars} (${r.reviewCount}件)</a></li>`;
      }).join("\n");

      // ItemList structured data
      const itemListJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "TikTok Shop 口コミランキング",
        description: description,
        numberOfItems: (rankings || []).length,
        itemListElement: (rankings || []).slice(0, 20).map((r: any, i: number) => ({
          "@type": "ListItem",
          position: i + 1,
          name: r.productName,
          url: `${baseUrl}/reviews/product/${encodeURIComponent(r.productName)}`,
        })),
      });

      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="LCJ MALL">
  <meta property="og:locale" content="ja_JP">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <script type="application/ld+json">${itemListJsonLd}</script>
</head>
<body>
  <nav><a href="${baseUrl}">LCJ MALL</a> &gt; 口コミDB</nav>
  <h1>口コミDB - TikTok Shop購入証明済みレビュー</h1>
  <p>${escapeHtml(description)}</p>
  <h2>商品ランキング</h2>
  <ol>${rankingHtml}</ol>
  <p><a href="${baseUrl}">LCJ MALLトップへ</a></p>
</body>
</html>`;

      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
    } catch (error) {
      console.error("[Reviews Prerender] Error:", error);
      next();
    }
  });

  // --- Blog article prerender for SEO (Googlebot gets full HTML with meta tags) ---
  app.get("/blog/:slug", async (req, res, next) => {
    try {
      const ua = (req.headers["user-agent"] || "").toLowerCase();
      const isBot = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|chatgpt|gptbot|claudebot|perplexity|anthropic/i.test(ua);
      if (!isBot) return next();

      const { getBlogArticleBySlug, getAllBlogCategories } = await import("../db");
      const { blogArticleThemeLog } = await import("../../drizzle/schema");
      const article = await getBlogArticleBySlug(req.params.slug);
      if (!article || article.status !== "published") return next();

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const articleUrl = `${baseUrl}/blog/${article.slug}`;
      const title = article.seoTitle || article.title || "";
      const description = article.seoDescription || article.excerpt || "";
      const coverImage = article.coverImageUrl || "";
      const publishedAt = article.publishedAt ? new Date(article.publishedAt).toISOString() : "";
      const updatedAt = article.updatedAt ? new Date(article.updatedAt).toISOString() : publishedAt;

      // Strip HTML tags for plain text content
      const plainContent = (article.contentHtml || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 5000);

      // SEOキーワード取得: テーマログからキーワードを取得
      let seoKeywords: string[] = [];
      try {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          const { eq } = await import("drizzle-orm");
          const themeRows = await db.select().from(blogArticleThemeLog).where(eq(blogArticleThemeLog.articleId, article.id)).limit(1);
          if (themeRows.length > 0 && themeRows[0].keyword) {
            // キーワードをスペースで分割して個別のキーワードに
            seoKeywords = themeRows[0].keyword.split(/\s+/).filter((k: string) => k.length > 0);
          }
        }
      } catch (kwErr) {
        // キーワード取得失敗は無視
      }
      // タイトルからもキーワードを抽出（年号、ブランド名など）
      const titleKeywords = (title.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+|[A-Za-z]+/g) || []).filter((k: string) => k.length >= 2);
      const allKeywords = [...new Set([...seoKeywords, ...titleKeywords.slice(0, 5)])].slice(0, 10);
      const keywordsStr = allKeywords.join(", ");

      // カテゴリ名取得
      let categoryName = "";
      try {
        if (article.categoryId) {
          const categories = await getAllBlogCategories();
          const cat = categories.find((c: any) => c.id === article.categoryId);
          if (cat) categoryName = cat.name;
        }
      } catch (_) {}

      // 文字数カウント
      const wordCount = plainContent.length;

      // JSON-LD structured data (SEO強化: keywords, articleSection, wordCount追加)
      const jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description: description,
        image: coverImage || undefined,
        datePublished: publishedAt || undefined,
        dateModified: updatedAt || undefined,
        author: { "@type": "Organization", name: "LCJ MALL" },
        publisher: {
          "@type": "Organization",
          name: "LCJ MALL",
          url: baseUrl,
          logo: { "@type": "ImageObject", url: `${baseUrl}/favicon.ico` },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
        ...(allKeywords.length > 0 ? { keywords: allKeywords.join(", ") } : {}),
        ...(categoryName ? { articleSection: categoryName } : {}),
        ...(wordCount > 0 ? { wordCount } : {}),
        inLanguage: "ja",
      });

      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | LCJ MALL</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${keywordsStr ? `<meta name="keywords" content="${escapeHtml(keywordsStr)}">` : ""}
  <link rel="canonical" href="${articleUrl}">
  <link rel="alternate" hreflang="ja" href="${articleUrl}">
  <link rel="alternate" hreflang="x-default" href="${articleUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${articleUrl}">
  ${coverImage ? `<meta property="og:image" content="${escapeHtml(coverImage)}">` : ""}
  <meta property="og:site_name" content="LCJ MALL">
  <meta property="og:locale" content="ja_JP">
  <meta name="geo.region" content="JP">
  <meta name="geo.placename" content="Japan">
  <meta name="ICBM" content="35.6762, 139.6503">
  ${publishedAt ? `<meta property="article:published_time" content="${publishedAt}">` : ""}
  ${updatedAt ? `<meta property="article:modified_time" content="${updatedAt}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${coverImage ? `<meta name="twitter:image" content="${escapeHtml(coverImage)}">` : ""}
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <article>
    <h1>${escapeHtml(title)}</h1>
    ${coverImage ? `<img src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)}">` : ""}
    <div>${article.contentHtml || ""}</div>
  </article>
  <p>${escapeHtml(plainContent.substring(0, 300))}</p>
  <a href="${baseUrl}">LCJ MALL</a>
</body>
</html>`;

      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
    } catch (error) {
      console.error("[Prerender] Error:", error);
      next();
    }
  });

  // --- Mall Product page prerender for SEO (Product JSON-LD + BreadcrumbList) ---
  app.get("/mall/products/:id", async (req, res, next) => {
    try {
      const ua = (req.headers["user-agent"] || "").toLowerCase();
      const isBot = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot|chatgpt|gptbot|claudebot|perplexity|anthropic/i.test(ua);
      if (!isBot) return next();

      const productId = parseInt(req.params.id, 10);
      if (isNaN(productId)) return next();

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const { getMallProductById, getMallCategories } = await import("../db");

      const product = await getMallProductById(productId);
      if (!product || product.status !== "active") return next();

      // カテゴリ名取得
      let categoryName = "";
      if (product.categoryId) {
        try {
          const categories = await getMallCategories();
          const cat = categories.find((c: any) => c.id === product.categoryId);
          if (cat) categoryName = cat.name;
        } catch (e) {}
      }

      // 画像配列
      let images: string[] = [];
      if (product.imageUrls && Array.isArray(product.imageUrls)) {
        images = product.imageUrls;
      } else if (product.imageUrl) {
        images = [product.imageUrl];
      }

      const productName = product.name || "商品";
      const title = `${productName} | LCJ MALL - ライブコマースECモール`;
      const desc = product.description
        ? product.description.replace(/<[^>]+>/g, "").substring(0, 160)
        : `${productName}をLCJ MALLでお得に購入。ポイントでも購入可能。`;

      // Product JSON-LD
      const productJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: productName,
        description: desc,
        url: `${baseUrl}/mall/products/${product.id}`,
        image: images.length > 0 ? images : undefined,
        brand: { "@type": "Brand", name: "LCJ MALL" },
        category: categoryName || undefined,
        offers: {
          "@type": "Offer",
          price: product.price,
          priceCurrency: "JPY",
          availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          seller: { "@type": "Organization", name: "LCJ MALL" },
          url: `${baseUrl}/mall/products/${product.id}`,
        },
        sku: `LCJ-${product.id}`,
      });

      const breadcrumbJsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "LCJ MALL", item: baseUrl },
          { "@type": "ListItem", position: 2, name: "商品一覧", item: `${baseUrl}/mall` },
          ...(categoryName ? [{ "@type": "ListItem", position: 3, name: categoryName, item: `${baseUrl}/mall?category=${product.categoryId}` }] : []),
          { "@type": "ListItem", position: categoryName ? 4 : 3, name: productName, item: `${baseUrl}/mall/products/${product.id}` },
        ],
      });

      const ogImage = images.length > 0 ? images[0] : "";
      const plainDesc = desc.substring(0, 200);

      const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(plainDesc)}">
  <meta name="keywords" content="${escapeHtml(productName)},LCJ MALL,${escapeHtml(categoryName)},ライブコマース,ポイ活,ECモール">
  <link rel="canonical" href="${baseUrl}/mall/products/${product.id}">
  <link rel="alternate" hreflang="ja" href="${baseUrl}/mall/products/${product.id}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(plainDesc)}">
  <meta property="og:type" content="product">
  <meta property="og:url" content="${baseUrl}/mall/products/${product.id}">
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ""}
  <meta property="og:site_name" content="LCJ MALL">
  <meta property="og:locale" content="ja_JP">
  <meta property="product:price:amount" content="${product.price}">
  <meta property="product:price:currency" content="JPY">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(plainDesc)}">
  ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ""}
  <script type="application/ld+json">${productJsonLd}</script>
  <script type="application/ld+json">${breadcrumbJsonLd}</script>
</head>
<body>
  <header>
    <a href="${baseUrl}">LCJ MALL</a>
    <nav>
      <a href="${baseUrl}/mall">商品一覧</a>
      <a href="${baseUrl}/blog">ブログ</a>
      <a href="${baseUrl}/reviews">口コミ</a>
    </nav>
  </header>
  <main>
    <article>
      <h1>${escapeHtml(productName)}</h1>
      ${categoryName ? `<p>カテゴリ: ${escapeHtml(categoryName)}</p>` : ""}
      ${images.map(img => `<img src="${escapeHtml(img)}" alt="${escapeHtml(productName)}" loading="lazy">`).join("\n      ")}
      <p>価格: \u00a5${product.price.toLocaleString()}</p>
      ${product.pointPrice ? `<p>ポイント価格: ${product.pointPrice.toLocaleString()}pt</p>` : ""}
      <p>在庫: ${product.stock > 0 ? `${product.stock}個` : "売り切れ"}</p>
      ${product.description ? `<div>${product.description}</div>` : ""}
    </article>
  </main>
  <footer>
    <a href="${baseUrl}">LCJ MALL トップ</a>
    <a href="${baseUrl}/mall">商品一覧</a>
    <a href="${baseUrl}/blog">ブログ</a>
  </footer>
</body>
</html>`;

      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
    } catch (error) {
      console.error("[Product Prerender] Error:", error);
      next();
    }
  });

  // --- Blog Sitemap & robots.txt & Search Console ---
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const { listBlogArticles, getAllBlogCategories, getAllBlogTags, getMallProducts, getActiveMallBrandsWithStats } = await import("../db");
      const { articles } = await listBlogArticles({ status: "published", limit: 1000 });
      const categories = await getAllBlogCategories();
      const tags = await getAllBlogTags();
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const today = new Date().toISOString().split("T")[0];

      // Static pages
      const staticUrls = [
        `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
        `  <url>\n    <loc>${baseUrl}/blog</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>`,
        `  <url>\n    <loc>${baseUrl}/mall</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>`,
        `  <url>\n    <loc>${baseUrl}/mall/products</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`,
        `  <url>\n    <loc>${baseUrl}/reviews</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`,
      ];

      // Category pages
      const categoryUrls = categories.map((c: any) =>
        `  <url>\n    <loc>${baseUrl}/blog?category=${c.id}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
      );

      // Tag pages
      const tagUrls = tags.map((t: any) =>
        `  <url>\n    <loc>${baseUrl}/blog/tag/${t.id}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`
      );

      // Article pages with image sitemap
      const articleUrls = articles.map((a: any) => {
        const lastmod = a.updatedAt ? new Date(a.updatedAt).toISOString().split("T")[0] : today;
        const imageTag = a.coverImageUrl
          ? `\n    <image:image>\n      <image:loc>${a.coverImageUrl}</image:loc>\n      <image:title>${(a.seoTitle || a.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</image:title>\n    </image:image>`
          : "";
        return `  <url>\n    <loc>${baseUrl}/blog/${a.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>${imageTag}\n  </url>`;
      });

      // Brand pages
      let brandUrls: string[] = [];
      try {
        const brands = await getActiveMallBrandsWithStats();
        brandUrls = [
          `  <url>\n    <loc>${baseUrl}/brands</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
          ...brands.map((b: any) =>
            `  <url>\n    <loc>${baseUrl}/brands/${b.id}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>${b.logoUrl ? `\n    <image:image>\n      <image:loc>${b.logoUrl}</image:loc>\n      <image:title>${(b.name || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</image:title>\n    </image:image>` : ""}\n  </url>`
          ),
        ];
      } catch (e) {
        console.warn("[Sitemap] Failed to fetch brands:", e);
      }

      // Mall product pages
      let productUrls: string[] = [];
      try {
        const products = await getMallProducts({ limit: 500 }) || [];
        productUrls = (Array.isArray(products) ? products : []).map((p: any) =>
          `  <url>\n    <loc>${baseUrl}/mall/products/${p.id}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>${p.imageUrl ? `\n    <image:image>\n      <image:loc>${p.imageUrl}</image:loc>\n      <image:title>${(p.name || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</image:title>\n    </image:image>` : ""}\n  </url>`
        );
      } catch (e) {
        console.warn("[Sitemap] Failed to fetch products:", e);
      }

      // Review pages (product review pages with SEO structured data)
      let reviewUrls: string[] = [];
      try {
        const { getProductReviewRankingEnhanced: getRankings } = await import("../db");
        const rankings = await getRankings(100);
        reviewUrls = [
          `  <url>\n    <loc>${baseUrl}/reviews</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>`,
          ...(rankings || []).map((r: any) =>
            `  <url>\n    <loc>${baseUrl}/reviews/product/${encodeURIComponent(r.productName)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
          ),
        ];
      } catch (e) {
        console.warn("[Sitemap] Failed to fetch review rankings:", e);
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${staticUrls.join("\n")}\n${categoryUrls.join("\n")}\n${tagUrls.join("\n")}\n${brandUrls.join("\n")}\n${articleUrls.join("\n")}\n${productUrls.join("\n")}\n${reviewUrls.join("\n")}\n</urlset>`;
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (error) {
      console.error("[Sitemap] Error:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    res.setHeader("Content-Type", "text/plain");
    res.send(`User-agent: *\nAllow: /\nAllow: /blog/\nAllow: /mall/\nAllow: /brands/\nAllow: /reviews/\nDisallow: /master/\nDisallow: /api/\nDisallow: /settings/\n\nSitemap: ${baseUrl}/sitemap.xml`);
  });

  // Google Search Console verification file
  app.get("/google:verificationCode.html", (req, res) => {
    const code = (req.params as any).verificationCode;
    res.setHeader("Content-Type", "text/html");
    res.send(`google-site-verification: google${code}.html`);
  });

  // IndexNow API endpoint for notifying search engines of new/updated content
  app.post("/api/indexnow/submit", async (req, res) => {
    try {
      const { urls, trigger: triggerType } = req.body;
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "urls array is required" });
      }
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const host = new URL(baseUrl).host;
      const indexNowKey = process.env.INDEXNOW_API_KEY || "69483c16f52c9802f4ffd3e2a64cf60d";
      const resolvedUrls = urls.map((u: string) => u.startsWith("http") ? u : `${baseUrl}${u}`);

      // Submit to IndexNow (Bing, Yandex, etc.)
      const indexNowPayload = {
        host,
        key: indexNowKey,
        keyLocation: `${baseUrl}/${indexNowKey}.txt`,
        urlList: resolvedUrls,
      };

      const indexNowResp = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(indexNowPayload),
      });

      // Also submit to Bing directly
      let bingStatus = 0;
      try {
        const bingResp = await fetch("https://www.bing.com/indexnow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(indexNowPayload),
        });
        bingStatus = bingResp.status;
      } catch (e) {
        console.warn("[IndexNow] Bing direct submit failed:", e);
      }

      // Submit to Yandex directly
      let yandexStatus = 0;
      try {
        const yandexResp = await fetch("https://yandex.com/indexnow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(indexNowPayload),
        });
        yandexStatus = yandexResp.status;
      } catch (e) {
        console.warn("[IndexNow] Yandex direct submit failed:", e);
      }

      const isSuccess = indexNowResp.status >= 200 && indexNowResp.status < 300;

      // Log to DB
      try {
        const { indexNowLogs } = await import("../../drizzle/schema");
        const { getDb } = await import("../db");
        const logDb = await getDb();
        await logDb.insert(indexNowLogs).values({
          urls: JSON.stringify(resolvedUrls),
          urlCount: resolvedUrls.length,
          trigger: triggerType || "manual",
          indexNowStatus: indexNowResp.status,
          bingStatus,
          yandexStatus,
          success: isSuccess,
        });
      } catch (logErr) {
        console.warn("[IndexNow] Failed to log submission:", logErr);
      }

      console.log(`[IndexNow] Submitted ${urls.length} URLs (trigger: ${triggerType || "manual"}). IndexNow: ${indexNowResp.status}, Bing: ${bingStatus}, Yandex: ${yandexStatus}`);
      res.json({
        success: true,
        indexNowStatus: indexNowResp.status,
        bingStatus,
        yandexStatus,
        submittedUrls: urls.length,
      });
    } catch (error) {
      console.error("[IndexNow] Error:", error);
      // Log error to DB
      try {
        const { indexNowLogs } = await import("../../drizzle/schema");
        const { getDb } = await import("../db");
        const logDb = await getDb();
        await logDb.insert(indexNowLogs).values({
          urls: JSON.stringify(req.body?.urls || []),
          urlCount: req.body?.urls?.length || 0,
          trigger: req.body?.trigger || "manual",
          success: false,
          errorMessage: String(error),
        });
      } catch (logErr) {
        console.warn("[IndexNow] Failed to log error:", logErr);
      }
      res.status(500).json({ error: "Failed to submit URLs" });
    }
  });

  // IndexNow key file verification
  app.get("/:key.txt", (req, res, next) => {
    const key = req.params.key;
    const indexNowKey = process.env.INDEXNOW_API_KEY || "69483c16f52c9802f4ffd3e2a64cf60d";
    if (key === indexNowKey) {
      res.setHeader("Content-Type", "text/plain");
      res.send(indexNowKey);
    } else {
      next();
    }
  });

  // Image proxy endpoint for PDF generation (to avoid CORS issues)
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).json({ error: "URL parameter is required" });
      }
      
      // Fetch the image from the original URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch image" });
      }
      
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = await response.arrayBuffer();
      
      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("[Image Proxy] Error:", error);
      res.status(500).json({ error: "Failed to proxy image" });
    }
  });

  // Product image upload REST API (avoids tRPC base64 size issues)
  app.post("/api/upload-product-image", upload.single("file"), async (req: any, res) => {
    try {
      // 認証は任意 - HRメンバー全員がアップロード可能
      let uploaderName = 'anonymous';
      try {
        const user = await sdk.authenticateRequest(req);
        if (user) uploaderName = user.name || user.email || 'authenticated';
      } catch (e) {
        // 認証失敗でもアップロードは許可
        console.log('[Product Image Upload] Auth skipped, proceeding as anonymous');
      }

      if (!req.file) {
        return res.status(400).json({ error: "ファイルが選択されていません" });
      }

      const file = req.file as Express.Multer.File;

      // Validate file type (image or video)
      const isImage = file.mimetype.startsWith("image/");
      const isVideo = file.mimetype.startsWith("video/");
      if (!isImage && !isVideo) {
        return res.status(400).json({ error: "画像または動画ファイルのみアップロード可能です" });
      }

      // Validate file size (images: 5MB, videos: 50MB)
      const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        return res.status(400).json({ error: isVideo ? "動画ファイルは50MB以下にしてください" : "画像ファイルは5MB以下にしてください" });
      }

      // Get file extension
      const validImageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];
      const validVideoExts = ["mp4", "webm", "mov", "avi", "m4v"];
      const validExts = [...validImageExts, ...validVideoExts];
      const extMatch = file.originalname.match(/\.([a-zA-Z0-9]+)$/);
      let ext = extMatch ? extMatch[1].toLowerCase() : (isVideo ? "mp4" : "png");
      if (!validExts.includes(ext)) ext = isVideo ? "mp4" : "png";

      const { nanoid: genId } = await import("nanoid");
      const key = `mall/products/${genId()}.${ext}`;
      const contentTypeMap: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
        bmp: "image/bmp", ico: "image/x-icon",
        mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
        avi: "video/x-msvideo", m4v: "video/x-m4v",
      };
      const contentType = contentTypeMap[ext] || file.mimetype;

      console.log(`[Product Image Upload] Uploading: key=${key}, size=${file.size}, type=${contentType}`);
      const result = await storagePut(key, file.buffer, contentType);
      console.log(`[Product Image Upload] Success: ${result.url}`);

      // If productId is provided, update the product
      const productId = req.body.productId ? parseInt(req.body.productId, 10) : null;
      if (productId) {
        const { getMallProductById, updateMallProduct } = await import("../db");
        const product = await getMallProductById(productId);
        if (product) {
          const existingUrls = product.imageUrls || [];
          const existingKeys = product.imageKeys || [];
          await updateMallProduct(productId, {
            imageUrl: existingUrls.length === 0 ? result.url : product.imageUrl,
            imageKey: existingKeys.length === 0 ? key : product.imageKey,
            imageUrls: [...existingUrls, result.url],
            imageKeys: [...existingKeys, key],
          });
        }
      }

      res.json({ url: result.url, key });
    } catch (error) {
      console.error("[Product Image Upload] Error:", error);
      res.status(500).json({ error: `画像アップロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` });
    }
  });

  // Knowledge Base PDF upload endpoint
  app.post("/api/knowledge-upload", upload.single("file"), async (req: any, res) => {
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch (e) {
        return res.status(401).json({ error: "認証が必要です" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "ファイルがアップロードされていません" });
      }
      const file = req.file as Express.Multer.File;
      const decodedFileName = Buffer.from(file.originalname, 'latin1').toString('utf-8');

      let textContent = "";
      if (file.mimetype === "application/pdf") {
        try {
          const pdfParseModule = await import("pdf-parse");
          const pdfParse = pdfParseModule.default || pdfParseModule;
          const pdfData = await pdfParse(file.buffer);
          textContent = pdfData.text;
        } catch (e: any) {
          console.error("[Knowledge Upload] PDF parse error:", e.message);
          return res.status(400).json({ error: "PDF解析に失敗しました: " + e.message });
        }
      } else {
        // Plain text / markdown
        textContent = file.buffer.toString("utf-8");
      }

      res.json({
        success: true,
        fileName: decodedFileName,
        textContent,
        uploadedBy: user.name || user.email,
        uploadedById: user.id,
      });
    } catch (error: any) {
      console.error("[Knowledge Upload] Error:", error.message);
      res.status(500).json({ error: "ファイルアップロードに失敗しました" });
    }
  });

  // Chat file upload endpoint (for LCJ Brain AI analysis)
  app.post("/api/chat-file-upload", upload.single("file"), async (req: any, res) => {
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch (e) {
        return res.status(401).json({ error: "認証が必要です" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const file = req.file as Express.Multer.File;
      const decodedFileName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
      
      // For images, upload to storage and return URL for vision API
      if (file.mimetype.startsWith("image/")) {
        const fileExtension = file.originalname.split(".").pop() || "jpg";
        const fileKey = `chat-uploads/${nanoid()}.${fileExtension}`;
        const result = await storagePut(fileKey, file.buffer, file.mimetype);
        return res.json({
          type: "image",
          url: result.url,
          fileName: decodedFileName,
          mimeType: file.mimetype,
        });
      }
      
      // For PDFs, extract text
      if (file.mimetype === "application/pdf") {
        const pdfFileKey = `chat-uploads/${nanoid()}.pdf`;
        const pdfUploadResult = await storagePut(pdfFileKey, file.buffer, file.mimetype);
        let pdfText = "";
        try {
          const pdfParseModule = await import("pdf-parse");
          const pdfParse = pdfParseModule.default || pdfParseModule;
          const pdfData = await pdfParse(file.buffer);
          pdfText = pdfData.text?.slice(0, 50000) || "";
        } catch (e: any) {
          // PDF text extraction failed, but file is still uploaded
        }
        return res.json({
          type: "file",
          url: pdfUploadResult.url,
          textContent: pdfText,
          fileName: decodedFileName,
          mimeType: file.mimetype,
        });
      }
      
      // For CSV files - upload to storage for download + extract text for AI
      const csvMimeTypes = ["text/csv", "application/csv", "application/vnd.ms-excel"];
      const fileExt = (file.originalname.split(".").pop() || "").toLowerCase();
      if (csvMimeTypes.includes(file.mimetype) || fileExt === "csv") {
        const fileKey = `chat-uploads/${nanoid()}.csv`;
        const result = await storagePut(fileKey, file.buffer, "text/csv");
        return res.json({
          type: "file",
          url: result.url,
          fileName: decodedFileName,
          mimeType: "text/csv",
          textContent: file.buffer.toString("utf-8").slice(0, 50000),
        });
      }
      
      // For text files
      if (file.mimetype.startsWith("text/") || file.mimetype === "application/json") {
        const fileKey = `chat-uploads/${nanoid()}.${fileExt || "txt"}`;
        const result = await storagePut(fileKey, file.buffer, file.mimetype);
        return res.json({
          type: "file",
          url: result.url,
          fileName: decodedFileName,
          mimeType: file.mimetype,
          textContent: file.buffer.toString("utf-8").slice(0, 50000),
        });
      }
      
      // For Excel, Word, PowerPoint, ZIP, PDF and other binary files - upload to storage
      const binaryFileTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/msword",
        "application/vnd.ms-powerpoint",
        "application/zip",
        "application/x-zip-compressed",
      ];
      const binaryExtensions = ["xlsx", "xls", "doc", "docx", "ppt", "pptx", "zip"];
      if (binaryFileTypes.includes(file.mimetype) || binaryExtensions.includes(fileExt)) {
        const fileKey = `chat-uploads/${nanoid()}.${fileExt || "bin"}`;
        const result = await storagePut(fileKey, file.buffer, file.mimetype);
        return res.json({
          type: "file",
          url: result.url,
          fileName: decodedFileName,
          mimeType: file.mimetype,
        });
      }
      
      // Unsupported file type - still try to upload to storage
      const fallbackKey = `chat-uploads/${nanoid()}.${fileExt || "bin"}`;
      const fallbackResult = await storagePut(fallbackKey, file.buffer, file.mimetype || "application/octet-stream");
      res.json({
        type: "file",
        url: fallbackResult.url,
        fileName: decodedFileName,
        mimeType: file.mimetype || "application/octet-stream",
      });
    } catch (error: any) {
      console.error("[Chat File Upload] Error:", error.message);
      res.status(500).json({ error: "ファイルアップロードに失敗しました" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Start reminder scheduler (runs every 12 hours)
    const TWELVE_HOURS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
    console.log("[Reminder Scheduler] Starting scheduler (runs every 12 hours)...");
    
    // Run every 12 hours (no immediate execution on startup)
    setInterval(() => {
      checkAndSendReminders().catch(error => {
        console.error("[Reminder Scheduler] Error during scheduled run:", error);
      });
    }, TWELVE_HOURS);
    
    // Start group follow-up scheduler (checks for inactive groups every 6 hours)
    startGroupFollowUpScheduler();
    
    // Note: startResponseReminderScheduler is disabled because groupFollowUpScheduler already handles inactive group follow-ups
    // This was causing duplicate messages to be sent
    // startResponseReminderScheduler();
    
    // Start schedule reminder scheduler (sends reminders for upcoming schedules every 5 minutes)
    startScheduleReminderScheduler();
    
    // Start LINE reminder scheduler (sends LINE reminders every 1 minute)
    startLineReminderScheduler();
    
    // Start auto post scheduler (generates SEO articles based on configured schedules)
    startAutoPostScheduler();
    
    // Start SEO monitor (checks Search Console metrics daily at JST 06:00)
    startSeoMonitor();
    
    // Start article rewriter (rewrites weak articles weekly on Monday JST 03:00)
    startArticleRewriter();
    
    // Start point expiry scheduler (processes expired points daily, sends LINE notifications)
    initPointExpiryScheduler();
    
    // Start AI auto-approve scheduler (server-side autonomous batch processing)
    startAiAutoApproveScheduler();
    
    // Start step email scheduler (sends step emails every 1 hour)
    startStepEmailScheduler();
    
    // Start AI live suggestion scheduler (sends daily suggestions at JST 07:00)
    startLiveSuggestionScheduler();
    
    // Start peer bonus monthly reset scheduler (resets pool on 1st of each month JST)
    startPeerBonusResetScheduler();

    // Start daily ranking scheduler (sends daily ranking to LINE at JST 00:00)
    startDailyRankingScheduler();
    
    // Start weekly report scheduler (sends weekly report every Monday at JST 09:00)
    startWeeklyReportScheduler();
    
    // Start monthly report scheduler (sends monthly report on 1st of each month)
    startMonthlyReportScheduler();
    
    // Start pre-briefing scheduler (sends briefing 1h before and 5min before stream)
        startPreBriefingScheduler();
    // Start Feishu auto-sync scheduler (syncs brands from Lark every 6 hours)
    startFeishuSyncScheduler();
    // Start contact search scheduler (searches contact info for Kalodata leads every 30 minutes)
    startContactSearchScheduler();
    // Ensure schedules.brandIds column exists (multi-brand support)
    import("../db").then(({ ensureSchedulesBrandIdsColumn }) => {
      ensureSchedulesBrandIdsColumn().catch((err: unknown) => {
        console.error("[Migration] Failed to ensure schedules.brandIds column:", err);
      });
    });

    // Ensure brands.shopId and brands.shopCode columns exist
    import("../db").then(({ ensureBrandsShopColumns }) => {
      ensureBrandsShopColumns().catch((err: unknown) => {
        console.error("[Migration] Failed to ensure brands shop columns:", err);
      });
    });

    // Ensure brands.businessManagerId and brands.operationsManagerId columns exist
    import("../db").then(({ ensureBrandsManagerColumns }) => {
      ensureBrandsManagerColumns().catch((err: unknown) => {
        console.error("[Migration] Failed to ensure brands manager columns:", err);
      });
    });

    // Ensure brands Lark/Feishu columns exist
    import("../db").then(({ ensureBrandsLarkColumns }) => {
      ensureBrandsLarkColumns().catch((err: unknown) => {
        console.error("[Migration] Failed to ensure brands Lark columns:", err);
      });
    });

    // Ensure livers.uid column exists
    import("../db").then(({ ensureLiversUidColumn }) => {
      ensureLiversUidColumn().catch((err: unknown) => {
        console.error("[Migration] Failed to ensure livers.uid column:", err);
      });
    });

    // Ensure lineReceipts.orderNumber column exists and backfill from ocrRawText
    import("../db").then(({ ensureLineReceiptsOrderNumberColumn, backfillOrderNumbers }) => {
      ensureLineReceiptsOrderNumberColumn().then(() => {
        backfillOrderNumbers().catch((err: unknown) => {
          console.error("[Migration] Failed to backfill orderNumbers:", err);
        });
      }).catch((err: unknown) => {
        console.error("[Migration] Failed to ensure orderNumber column:", err);
      });
    });

    // Sync admin roles for ALL active staff members on startup
    import("../db").then(({ syncStaffAdminRoles }) => {
      syncStaffAdminRoles().catch((err: unknown) => {
        console.error("[Admin Sync] Failed to sync staff admin roles:", err);
      });
    });

    // Migration: Add missing brand_contracts columns (currency, kgLiveCondition, etc.)
    import("../db").then(({ getDb }) => {
      getDb().then((db: any) => {
        if (db) {
          import("../migrations/addBrandContractColumns").then(({ addBrandContractColumns }) => {
            addBrandContractColumns(db).catch((err: unknown) => {
              console.error("[Migration] brand_contracts columns error:", err);
            });
          });
          import("../migrations/addLivestreamBrandDuration").then(({ addLivestreamBrandDuration }) => {
            addLivestreamBrandDuration(db).catch((err: unknown) => {
              console.error("[Migration] livestream_brands durationMinutes error:", err);
            });
          });
          // LCJ Coin (Phantom Stock) system tables
          import("../migrations/createLcjCoinTables").then(({ createLcjCoinTables }) => {
            createLcjCoinTables(db).catch((err: unknown) => {
              console.error("[Migration] LCJ Coin tables error:", err);
            });
          });
          // LCJ Coin V3: Tier Templates, Peer Bonus, Buyback
          import("../migrations/lcjCoinV3Tables").then(({ createLcjCoinV3Tables }) => {
            createLcjCoinV3Tables(db).catch((err: unknown) => {
              console.error("[Migration] LCJ Coin V3 tables error:", err);
            });
          });
          // LCJ Coin: Add tierCode to holdings
          import("../migrations/addTierCodeToHoldings").then(({ addTierCodeToHoldings }) => {
            addTierCodeToHoldings(db).catch((err: unknown) => {
              console.error("[Migration] tierCode column error:", err);
            });
          });
          // Creator Pool + Liver Tiers
          import("../migrations/addCreatorPoolAndLiverTiers").then(({ addCreatorPoolAndLiverTiers }) => {
            addCreatorPoolAndLiverTiers(db).catch((err: unknown) => {
              console.error("[Migration] Creator Pool & Liver Tiers error:", err);
            });
          });
          import("../migrations/addAiCoachMessages").then(({ addAiCoachMessagesTable }) => {
            addAiCoachMessagesTable(db).catch((err: unknown) => {
              console.error("[Migration] AI Coach Messages table error:", err);
            });
          });
          import("../migrations/addAiCoachRooms").then(({ addAiCoachRoomsTable }) => {
            addAiCoachRoomsTable(db).catch((err: unknown) => {
              console.error("[Migration] AI Coach Rooms table error:", err);
            });
          });
          import("../migrations/addLiverTierBronzeSilver").then(({ addLiverTierBronzeSilver }) => {
            addLiverTierBronzeSilver(db).catch((err: unknown) => {
              console.error("[Migration] Liver Tier 4-level error:", err);
            });
          });
          import("../migrations/addContractQuotaFields").then(({ addContractQuotaFields }) => {
            addContractQuotaFields(db).catch((err: unknown) => {
              console.error("[Migration] Contract quota fields error:", err);
            });
          });
          import("../migrations/createMegaChannelTables").then(({ createMegaChannelTables }) => {
            createMegaChannelTables(db).catch((err: unknown) => {
              console.error("[Migration] Mega channel tables error:", err);
            });
          });
          import("../migrations/createBrandShortVideosTable").then(({ createBrandShortVideosTable }) => {
            createBrandShortVideosTable(db).catch((err: unknown) => {
              console.error("[Migration] Brand short videos table error:", err);
            });
          });
          import("../migrations/createLcjBrainChatLogsTable").then(({ createLcjBrainChatLogsTable }) => {
            createLcjBrainChatLogsTable(db).catch((err: unknown) => {
              console.error("[Migration] LCJ Brain chat logs table error:", err);
            });
          });
          import("../migrations/addShortVideoViolationDeadline").then(({ addShortVideoViolationDeadline }) => {
            addShortVideoViolationDeadline(db).catch((err: unknown) => {
              console.error("[Migration] Short video violation/deadline error:", err);
            });
          });
          import("../migrations/createChatTables").then(({ createChatTables }) => {
            createChatTables(db).catch((err: unknown) => {
              console.error("[Migration] Chat tables error:", err);
            });
          });
          import("../migrations/createBrandMonthlyGmvTargets").then(({ createBrandMonthlyGmvTargets }) => {
            createBrandMonthlyGmvTargets(db).catch((err: unknown) => {
              console.error("[Migration] Brand monthly GMV targets table error:", err);
            });
          });
          // Fix chat_room_members userId (users.id → staff.id migration)
          import("../migrations/migrateChatMemberIds").then(({ migrateChatMemberIds }) => {
            migrateChatMemberIds(db).catch((err: unknown) => {
              console.error("[Migration] Chat member IDs migration error:", err);
            });
          });
        }
      });
    });

    // Backfill empty streamerName in brand_livestreams using livers table
    import("../db").then(({ getDb: getDbForBackfill }) => {
      getDbForBackfill().then((dbForBackfill: any) => {
        if (dbForBackfill) {
          import("../migrations/backfillStreamerNames").then(({ backfillStreamerNames }) => {
            backfillStreamerNames(dbForBackfill).catch((err: unknown) => {
              console.error("[Migration] Failed to backfill streamer names:", err);
            });
          });
        }
      });
    });

    // One-time fix: Correct remainingAmount for past purchases where FIFO was not applied
    import("../db").then(({ fixRemainingAmountForPastPurchases }) => {
      fixRemainingAmountForPastPurchases().catch((err: unknown) => {
        console.error("[Migration] Failed to fix remainingAmount for past purchases:", err);
      });
    });

    // CRM tables migration (call_logs, sales_activities, business_cards CRM columns)
    import("../db").then(({ migrateCallLogsTable, migrateSalesActivitiesTable, migrateBusinessCardsCrmColumns }) => {
      migrateCallLogsTable().catch((err: unknown) => {
        console.error("[Migration] call_logs table error:", err);
      });
      migrateSalesActivitiesTable().catch((err: unknown) => {
        console.error("[Migration] sales_activities table error:", err);
      });
      migrateBusinessCardsCrmColumns().catch((err: unknown) => {
        console.error("[Migration] business_cards CRM columns error:", err);
      });
    });

    // Seed popup variants on startup (idempotent - only inserts if table is empty)
    import("../db").then(({ seedPopupVariants }) => {
      seedPopupVariants().then((result: { seeded: boolean; count: number }) => {
        if (result.seeded) {
          console.log(`[Popup] Seeded ${result.count} popup variants`);
        } else {
          console.log(`[Popup] Popup variants already exist (${result.count} variants)`);
        }
      }).catch((err: unknown) => {
        console.error("[Popup] Failed to seed popup variants:", err);
      });
    });
  });
}

startServer().catch(console.error);

// CSV Helper functions for REST API endpoint
function csvParseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function csvMapHeadersToValues(headers: string[], values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < headers.length && i < values.length; i++) {
    result[headers[i]] = values[i];
  }
  return result;
}

function csvParseIntSafe(val: string | undefined | null): number | null {
  if (!val || val === "" || val === "-") return null;
  const cleaned = val.replace(/,/g, "").replace(/\s/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function csvParseFloatSafe(val: string | undefined | null): number | null {
  if (!val || val === "" || val === "-") return null;
  const cleaned = val.replace(/,/g, "").replace(/\s/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function csvParseDateDDMMYYYY(val: string | undefined | null): Date | null {
  if (!val || val === "" || val === "-") return null;
  // Format 1: DD/MM/YYYY HH:mm:ss
  let match = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  // Format 2: YYYY-MM-DD HH:mm:ss
  match = val.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  // Format 3: YYYY/MM/DD HH:mm:ss
  match = val.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  // Format 4: YYYY-MM-DDTHH:mm:ss
  match = val.match(/(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  // Fallback
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function csvTruncate(val: string | null, maxLen: number): string | null {
  if (val === null || val === undefined) return null;
  if (val.length <= maxLen) return val;
  return val.substring(0, maxLen);
}

function csvSanitizeErrorMessage(msg: string): string {
  // Remove SQL parameter dumps from error messages (they can be huge)
  // Truncate to max 200 chars to prevent leaking sensitive data
  if (!msg) return "不明なエラーが発生しました";
  let cleaned = msg;
  // Remove everything after "params:" or "values (" or SQL query dumps
  // Use [\s\S] instead of . to match across newlines
  const cutPoints = ['params:', 'values (', 'values(', 'Failed query:', 'insert into', 'update `'];
  for (const cutPoint of cutPoints) {
    const idx = cleaned.toLowerCase().indexOf(cutPoint.toLowerCase());
    if (idx >= 0 && idx < 150) {
      cleaned = cleaned.substring(0, idx).trim();
    }
  }
  // Remove any remaining SQL-like content
  cleaned = cleaned.replace(/`[^`]*`/g, '[table]');
  // Hard truncate to 200 chars
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 200) + "...";
  }
  return cleaned || "CSVインポート中にエラーが発生しました";
}
