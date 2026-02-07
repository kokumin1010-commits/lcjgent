import "dotenv/config";
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
import { startLineReminderScheduler } from "../lineReminderScheduler";
import { trackingRouter } from "../tracking";

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
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth removed - using custom email/password auth
  
  // Email tracking endpoint
  app.use("/api/track", trackingRouter);
  
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
    if (event.source.type === "user" && event.message?.type === "text") {
      const text = event.message.text?.trim() || "";
      
      // Check if it's a 6-digit link code (Liver)
      if (/^\d{6}$/.test(text)) {
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
        
        // Try to find liver by link code
        const liverData = await findLiverByLinkCode(text);
        
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
            text: `🎉 ${liverData.name}さん、LINE連携が完了しました！\n\nこれから配信後にAIコーチングがLINEに届きます。\n\n頑張ってください！💪`,
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
  const upload = multer.default({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
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

  // CSV Upload REST API endpoint (avoids tRPC Base64 size issues)
  app.post("/api/csv-upload", upload.single("file"), async (req: any, res) => {
    try {
      // Authenticate user
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

        // 4. Parse all rows
        const orders: any[] = [];
        const subOrderIds: string[] = [];
        let errorCount = 0;
        for (let i = 1; i < lines.length; i++) {
          try {
            const values = csvParseCSVLine(lines[i]);
            if (values.length < 10) continue;
            const row = csvMapHeadersToValues(headers, values);
            subOrderIds.push(String(row["サブ注文ID"] || ""));
            orders.push(row);
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
            orderId: String(row["注文ID"] || ""),
            subOrderId: String(row["サブ注文ID"] || ""),
            orderStatus: row["注文状況"] || null,
            creatorUsername: row["クリエイターのユーザー名"] || "",
            productName: row["商品名"] || "",
            sku: row["SKU"] || null,
            productId: String(row["商品ID"] || ""),
            price: csvParseIntSafe(row["価格"]),
            quantity: csvParseIntSafe(row["数量"]) || 1,
            shopName: row["ショップ名"] || null,
            shopCode: row["ショップコード"] || null,
            contentType: row["コンテンツタイプ"] || null,
            contentId: String(row["コンテンツID"] || ""),
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
            paymentId: String(row["支払いID"] || ""),
            paymentMethod: row["支払い方法"] || null,
            paymentAccount: row["支払い口座"] || null,
            iva: csvParseIntSafe(row["IVA"]) || 0,
            isr: csvParseIntSafe(row["ISR"]) || 0,
            platform: row["プラットフォーム"] || null,
            factorType: row["要因のタイプ"] || null,
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
        await updateTiktokCsvImportHistory(importId, {
          status: "failed",
          errorMessage: error.message || "Unknown error",
        });
        res.status(500).json({ error: `CSVインポートに失敗しました: ${error.message}` });
      }
    } catch (error: any) {
      console.error("[CSV Upload REST] Error:", error);
      res.status(500).json({ error: error.message || "CSVアップロードに失敗しました" });
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
