/**
 * Live Commerce Festival 申込管理ルーター
 * - 公開: 企業/ライバー/一般の申込受付 + 自動アカウント作成
 * - 管理: 申込一覧・ステータス管理・CSVエクスポート
 */
import { router, publicProcedure, protectedProcedure, t } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  festivalCompanyApplications,
  festivalLiverApplications,
  festivalGeneralApplications,
  festivalEventSettings,
  festivalSponsors,
  festivalLineRegistrations,
  festivalAccounts,
  festivalActivityLogs,
} from "../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { createFestivalAccount, verifyFestivalToken } from "./festivalAuthRouter";
import QRCode from "qrcode";
import nodemailer from "nodemailer";
import { nanoid } from "nanoid";


// Helper: log activity
async function logActivity(opts: {
  accountId: number;
  accountEmail: string;
  accountType: "company" | "liver" | "general" | "admin";
  action: string;
  details?: string;
  req?: any;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    const ipAddress = opts.req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || opts.req?.socket?.remoteAddress || null;
    const userAgent = opts.req?.headers?.['user-agent']?.substring(0, 500) || null;
    await db.insert(festivalActivityLogs).values({
      accountId: opts.accountId,
      accountEmail: opts.accountEmail,
      accountType: opts.accountType,
      action: opts.action,
      details: opts.details || null,
      ipAddress,
      userAgent,
    });
  } catch (e) {
    console.error('[LCF ActivityLog] Failed to log:', e);
  }
}

// Helper: parse cookie from request header (no cookie-parser middleware)
function getCookieFromReq(req: any, name: string): string | undefined {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c: string) => c.trim().startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split('=').slice(1).join('=').trim();
}

// Festival admin procedure: allows both lcjmall staff AND LCF admin (lcf_token with role=admin)
const festivalAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Check 1: lcjmall staff auth
  if ((ctx as any).user) {
    return next({ ctx });
  }
  // Check 2: LCF admin token (manual cookie parse - no cookie-parser middleware)
  const lcfToken = getCookieFromReq(ctx.req, 'lcf_token');
  if (lcfToken) {
    const payload = await verifyFestivalToken(lcfToken);
    if (payload && payload.role === "admin") {
      return next({ ctx: { ...ctx, lcfAdmin: payload } as any });
    }
  }
  throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者権限が必要です" });
});


// ===== Ticket System Helpers =====
async function generateTicketId(): Promise<string> {
  return `LCF-${nanoid(8).toUpperCase()}`;
}

async function createTicket(pool: any, data: { applicationId: number; applicantName: string; applicantEmail: string; applicantType: string }) {
  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcf_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticketId VARCHAR(20) NOT NULL UNIQUE,
      applicationId INT NOT NULL,
      applicantName VARCHAR(255) NOT NULL,
      applicantEmail VARCHAR(255) NOT NULL,
      applicantType ENUM('liver', 'company', 'general') NOT NULL,
      checkedIn TINYINT(1) DEFAULT 0,
      checkedInAt TIMESTAMP NULL,
      checkedInBy VARCHAR(255) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
  
  const ticketId = await generateTicketId();
  await pool.query(
    `INSERT INTO lcf_tickets (ticketId, applicationId, applicantName, applicantEmail, applicantType) VALUES (?, ?, ?, ?, ?)`,
    [ticketId, data.applicationId, data.applicantName, data.applicantEmail, data.applicantType]
  );
  return ticketId;
}

async function sendTicketEmail(email: string, name: string, ticketId: string, applicantType: string) {
  try {
    const qrDataUrl = await QRCode.toDataURL(ticketId, { width: 300, margin: 2 });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST || "smtp.qiye.aliyun.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const typeLabel = applicantType === 'liver' ? 'ライバー' : applicantType === 'company' ? '企業様' : '一般参加';
    
    await transporter.sendMail({
      from: `"Live Commerce Festival 2026" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "【LCF 2026】入場チケット（QRコード）のご案内",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #e53e3e;">Live Commerce Festival 2026</h2>
          <p>${name} 様</p>
          <p>この度はLive Commerce Festival 2026へのお申し込みありがとうございます。</p>
          <p>以下のQRコードが入場チケットとなります。当日会場にてご提示ください。</p>
          
          <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f7f7f7; border-radius: 8px;">
            <p style="font-size: 12px; color: #666;">チケットID: <strong>${ticketId}</strong></p>
            <img src="cid:qrcode" alt="入場QRコード" style="width: 250px; height: 250px;" />
            <p style="font-size: 14px; color: #333; margin-top: 10px;">参加区分: <strong>${typeLabel}</strong></p>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px;"><strong>⚠️ ご注意</strong></p>
            <p style="margin: 5px 0 0; font-size: 13px;">・このQRコードは1回のみ有効です</p>
            <p style="margin: 5px 0 0; font-size: 13px;">・2026年9月8日〜9日の両日ご入場いただけます</p>
            <p style="margin: 5px 0 0; font-size: 13px;">・スクリーンショットを保存してください</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">
            開催日: 2026年9月8日（火）〜9日（水）<br/>
            会場: 八芳園（東京都港区白金台1-1-1）<br/>
            主催: LCF実行委員会
          </p>
        </div>
      `,
      attachments: [{
        filename: 'qrcode.png',
        content: Buffer.from(qrBase64, 'base64'),
        cid: 'qrcode',
      }],
    });
    console.log(`[LCF Ticket] Email sent to ${email} with ticket ${ticketId}`);
    return true;
  } catch (err: any) {
    console.error(`[LCF Ticket] Email send error: ${err.message}`);
    return false;
  }
}

export const festivalRouter = router({
  // ===== 公開API: 申込受付 =====

  // 企業申込み
  submitCompany: publicProcedure
    .input(z.object({
      companyName: z.string().min(1, "貴社名は必須です"),
      contactName: z.string().min(1, "ご担当者様名は必須です"),
      contactDepartment: z.string().min(1, "担当者部署は必須です"),
      contactNameKana: z.string().min(1, "フリガナは必須です"),
      postalCode: z.string().min(1, "郵便番号は必須です"),
      address: z.string().min(1, "所在地は必須です"),
      phone: z.string().min(1, "電話番号は必須です"),
      email: z.string().email("有効なメールアドレスを入力してください"),
      websiteUrl: z.string().min(1, "ホームページURLは必須です"),
      lineOrLark: z.string().optional(),
      tiktokShopSellerName: z.string().min(1, "TikTok Shopセラーアカウント名は必須です"),
      brandIntro: z.string().min(1, "ブランド紹介文は必須です"),
      tiktokShopUrl: z.string().optional(),
      matchingProducts: z.string().optional(),
      targetAudience: z.string().min(1, "商品対象ターゲットは必須です"),
      salesLicense: z.string().min(1, "販売資格は必須です"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      // 重複チェック: 同じメールで既に申込みがある場合はスキップ
      const existingCompany = await db.select({ id: festivalCompanyApplications.id })
        .from(festivalCompanyApplications)
        .where(and(
          eq(festivalCompanyApplications.email, input.email),
          eq(festivalCompanyApplications.eventYear, "2026")
        ))
        .limit(1);
      if (existingCompany.length > 0) {
        return { success: true, id: existingCompany[0].id, message: "既に申込み済みです" };
      }
      // 重複チェック一時無効化（申込み受付を優先）

      let insertId = 0;
      try {
        const result = await db.insert(festivalCompanyApplications).values({
          companyName: input.companyName,
          contactName: input.contactName,
          contactDepartment: input.contactDepartment,
          contactNameKana: input.contactNameKana,
          postalCode: input.postalCode,
          address: input.address,
          phone: input.phone,
          email: input.email,
          websiteUrl: input.websiteUrl,
          lineOrLark: input.lineOrLark || null,
          tiktokShopSellerName: input.tiktokShopSellerName,
          brandIntro: input.brandIntro,
          tiktokShopUrl: input.tiktokShopUrl || null,
          matchingProducts: input.matchingProducts || null,
          targetAudience: input.targetAudience,
          salesLicense: input.salesLicense,
          status: "confirmed",
          eventYear: "2026",
        });
        insertId = (result as any)[0]?.insertId || 0;
      } catch (err: any) {
        const sqlMsg = err.sqlMessage || err.cause?.message || err.cause?.sqlMessage || '';
        const errCode = err.code || err.cause?.code || err.errno || 'UNKNOWN';
        console.error("[Festival] submitCompany DB error:", JSON.stringify({msg: err.message, code: errCode, sqlMsg, sqlState: err.sqlState, errno: err.errno}));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DBエラー[${errCode}]: ${sqlMsg || err.message?.substring(0, 200) || 'Unknown'}` });
      }

      // 自動アカウント作成
      let accountInfo: { password: string } | null = null;
      try {
        const result = await createFestivalAccount({
          email: input.email,
          accountType: "company",
          applicationId: insertId,
          displayName: input.companyName,
        });
        if (result) accountInfo = { password: result.password };
      } catch (err: any) {
        console.error("[Festival] Account creation error:", err.message);
        // アカウント作成に失敗しても申込みは成功とする
      }

            // Log activity
      if (accountInfo) {
        logActivity({ accountId: insertId, accountEmail: input.email, accountType: 'company', action: 'submit_application', details: JSON.stringify({ companyName: input.companyName }), req: ctx.req });
      }
      return {
        success: true,
        message: "企業申込みを受け付けました",
        account: accountInfo ? {
          email: input.email,
          password: accountInfo.password,
          message: "アカウントが自動作成されました。このパスワードでログインできます。",
        } : null,
      };
    }),
  // ライバー＆インフルエンサー申込み
  submitLiver: publicProcedure
    .input(z.object({
      name: z.string().min(1, "お名前は必須です"),
      nameKana: z.string().optional(),
      liverName: z.string().min(1, "ライバー名は必須です"),
      agency: z.string().optional(),
      accountInfo: z.string().optional(),
      genre: z.string().optional(),
      email: z.string().email("有効なメールアドレスを入力してください"),
      phone: z.string().min(1, "電話番号は必須です"),
      lineOrLark: z.string().optional(),
      attendanceSchedule: z.enum(["day1_only", "day2_only", "both_days"]),
      matchingPreference: z.enum(["yes", "no"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      // 重複チェック: 同じメールで既に申込みがある場合はスキップ
      const existingLiver = await db.select({ id: festivalLiverApplications.id })
        .from(festivalLiverApplications)
        .where(and(
          eq(festivalLiverApplications.email, input.email),
          eq(festivalLiverApplications.eventYear, "2026")
        ))
        .limit(1);
      if (existingLiver.length > 0) {
        let existingTicketId: string | null = null;
        try {
          const pool2 = (await import('./selectionCenterRouter.js')).getPool();
          const [tickets2] = await pool2.execute(
            'SELECT ticketId FROM lcf_tickets WHERE applicationId = ? AND applicantType = ?',
            [existingLiver[0].id, 'liver']
          );
          if ((tickets2 as any[]).length > 0) {
            existingTicketId = (tickets2 as any[])[0].ticketId;
          } else {
            existingTicketId = await createTicket(pool2, {
              applicationId: existingLiver[0].id,
              applicantName: input.name || input.liverName,
              applicantEmail: input.email,
              applicantType: 'liver',
            });
            sendTicketEmail(input.email, input.liverName, existingTicketId, 'liver');
          }
        } catch(e) { console.error("[LCF] Existing liver ticket lookup error:", e); }
        return { success: true, id: existingLiver[0].id, message: "既に申込み済みです", ticketId: existingTicketId };
      }

      let insertId = 0;
      try {
        const result = await db.insert(festivalLiverApplications).values({
          name: input.name,
          nameKana: input.nameKana || "",
          liverName: input.liverName,
          agency: input.agency || null,
          accountInfo: input.accountInfo || null,
          genre: input.genre || null,
          email: input.email,
          phone: input.phone,
          lineOrLark: input.lineOrLark || null,
          attendanceSchedule: input.attendanceSchedule,
          matchingPreference: input.matchingPreference,
          portraitRightsConsent: "agreed",
          complianceConsent: "agreed",
          status: "confirmed",
          eventYear: "2026",
        });
        insertId = (result as any)[0]?.insertId || 0;
      } catch (err: any) {
        console.error("[Festival] submitLiver DB error:", err.message, err.code, err.sqlState);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DB書き込みエラー: ${err.code || 'UNKNOWN'} - ${err.message?.substring(0, 100) || 'Unknown error'}` });
      }

      // 自動アカウント作成
      let accountInfo: { password: string } | null = null;
      try {
        const result = await createFestivalAccount({
          email: input.email,
          accountType: "liver",
          applicationId: insertId,
          displayName: input.liverName,
        });
        if (result) accountInfo = { password: result.password };
      } catch (err: any) {
        console.error("[Festival] Account creation error:", err.message);
      }

            // Log activity
      if (accountInfo) {
        logActivity({ accountId: insertId, accountEmail: input.email, accountType: 'liver', action: 'submit_application', details: JSON.stringify({ liverName: input.liverName }), req: ctx.req });
      }
      // Generate ticket and send email
      let ticketId: string | null = null;
      try {
        const pool = (await import('./selectionCenterRouter.js')).getPool();
        ticketId = await createTicket(pool, {
          applicationId: insertId,
          applicantName: input.liverName,
          applicantEmail: input.email,
          applicantType: 'liver',
        });
        // Send email with QR code (async, don't block)
        sendTicketEmail(input.email, input.liverName, ticketId, 'liver');
      } catch (err: any) {
        console.error("[LCF Ticket] Ticket creation error:", err.message);
      }

      return {
        success: true,
        message: "ライバー申込みを受け付けました",
        ticketId,
        account: accountInfo ? {
          email: input.email,
          password: accountInfo.password,
          message: "アカウントが自動作成されました。このパスワードでログインできます。",
        } : null,
      };
    }),
  // 一般来場申込み
  submitGeneral: publicProcedure
    .input(z.object({
      participationType: z.enum(["corporate", "individual"]),
      companyName: z.string().min(1, "貴社名は必須です"),
      department: z.string().optional(),
      name: z.string().min(1, "お名前は必須です"),
      nameKana: z.string().optional(),
      email: z.string().email("有効なメールアドレスを入力してください"),
      phone: z.string().min(1, "電話番号は必須です"),
      attendanceSchedule: z.enum(["day1_only", "day2_only", "both_days"]),
      visitPurposes: z.array(z.string()).min(1, "来場目的を1つ以上選択してください"),
      lineOrLark: z.string().optional(),
      brandName: z.string().optional(),
      industryTypes: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      // 重複チェック: 同じメールで既に申込みがある場合はスキップ
      const existingGeneral = await db.select({ id: festivalGeneralApplications.id })
        .from(festivalGeneralApplications)
        .where(and(
          eq(festivalGeneralApplications.email, input.email),
          eq(festivalGeneralApplications.eventYear, "2026")
        ))
        .limit(1);
      if (existingGeneral.length > 0) {
        // Look up existing ticket for this application
        let existingTicketId: string | null = null;
        try {
          const pool = (await import('./selectionCenterRouter.js')).getPool();
          const [tickets] = await pool.execute(
            'SELECT ticketId FROM lcf_tickets WHERE applicationId = ? AND applicantType = ?',
            [existingGeneral[0].id, 'general']
          );
          if ((tickets as any[]).length > 0) {
            existingTicketId = (tickets as any[])[0].ticketId;
          } else {
            // No ticket exists yet - create one
            existingTicketId = await createTicket(pool, {
              applicationId: existingGeneral[0].id,
              applicantName: input.name,
              applicantEmail: input.email,
              applicantType: 'general',
            });
            sendTicketEmail(input.email, input.name, existingTicketId, 'general');
          }
        } catch(e) { console.error("[LCF] Existing ticket lookup error:", e); }
        return { success: true, id: existingGeneral[0].id, message: "既に申込み済みです", ticketId: existingTicketId, account: null };
      }


      let insertId = 0;
      try {
        // Lazy migration: add new columns if not exist
        const pool = (await import("./selectionCenterRouter.js")).getPool();
        await pool.execute("ALTER TABLE festival_general_applications ADD COLUMN line_or_lark VARCHAR(255) DEFAULT NULL").catch(() => {});
        await pool.execute("ALTER TABLE festival_general_applications ADD COLUMN brand_name VARCHAR(255) DEFAULT NULL").catch(() => {});
        await pool.execute("ALTER TABLE festival_general_applications ADD COLUMN industry_types JSON DEFAULT NULL").catch(() => {});

        const result = await db.insert(festivalGeneralApplications).values({
          participationType: input.participationType,
          companyName: input.companyName,
          department: input.department || null,
          name: input.name,
          nameKana: input.nameKana || "",
          email: input.email,
          phone: input.phone,
          attendanceSchedule: input.attendanceSchedule,
          visitPurposes: input.visitPurposes,
          portraitRightsConsent: "agreed",
          complianceConsent: "agreed",
          status: "confirmed",
          eventYear: "2026",
        });
        insertId = (result as any)[0]?.insertId || 0;
        // Save new fields via raw SQL (columns not in Drizzle schema)
        if (insertId) {
          await pool.execute(
            "UPDATE festival_general_applications SET line_or_lark = ?, brand_name = ?, industry_types = ? WHERE id = ?",
            [input.lineOrLark || null, input.brandName || null, input.industryTypes ? JSON.stringify(input.industryTypes) : null, insertId]
          ).catch(() => {});
        }
      } catch (err: any) {
        console.error("[Festival] submitGeneral DB error:", err.message, err.code, err.sqlState);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DB書き込みエラー: ${err.code || 'UNKNOWN'} - ${err.message?.substring(0, 100) || 'Unknown error'}` });
      }

      // 自動アカウント作成
      let accountInfo: { password: string } | null = null;
      try {
        const result = await createFestivalAccount({
          email: input.email,
          accountType: "general",
          applicationId: insertId,
          displayName: input.name,
        });
        if (result) accountInfo = { password: result.password };
      } catch (err: any) {
        console.error("[Festival] Account creation error:", err.message);
      }

            // Log activity
      if (accountInfo) {
        logActivity({ accountId: insertId, accountEmail: input.email, accountType: 'general', action: 'submit_application', details: JSON.stringify({ name: input.name }), req: ctx.req });
      }
      // Generate ticket and send email
      let ticketId: string | null = null;
      try {
        const pool = (await import('./selectionCenterRouter.js')).getPool();
        ticketId = await createTicket(pool, {
          applicationId: insertId,
          applicantName: input.name,
          applicantEmail: input.email,
          applicantType: 'general',
        });
        sendTicketEmail(input.email, input.name, ticketId, 'general');
      } catch (err: any) {
        console.error("[LCF Ticket] Ticket creation error:", err.message);
      }

      return {
        success: true,
        message: "一般来場申込みを受け付けました",
        ticketId,
        account: accountInfo ? {
          email: input.email,
          password: accountInfo.password,
          message: "アカウントが自動作成されました。このパスワードでログインできます。",
        } : null,
      };
    }),
  // ===== 管理API: 一覧・ステータス管理 =====

  // 企業申込み一覧
  listCompany: festivalAdminProcedure
    .input(z.object({
      status: z.string().optional(),
      eventYear: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.status) conditions.push(eq(festivalCompanyApplications.status, input.status as any));
      if (input?.eventYear) conditions.push(eq(festivalCompanyApplications.eventYear, input.eventYear));
      
      const result = await db.select().from(festivalCompanyApplications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(festivalCompanyApplications.createdAt));
      // Join with lcf_tickets for check-in status
      const poolC = (await import("./selectionCenterRouter.js")).getPool();
      const [ticketsC] = await poolC.query("SELECT applicationId, ticketId, checkedIn, checkedInAt FROM lcf_tickets WHERE applicantType = ?", ["company"]);
      const ticketMapC = new Map((ticketsC as any[]).map(t => [t.applicationId, { ticketId: t.ticketId, checkedIn: !!t.checkedIn, checkedInAt: t.checkedInAt }]));
      return result.map(r => ({ ...r, ticket: ticketMapC.get(r.id) || null }));
    }),

  // ライバー申込み一覧
  listLiver: festivalAdminProcedure
    .input(z.object({
      status: z.string().optional(),
      eventYear: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.status) conditions.push(eq(festivalLiverApplications.status, input.status as any));
      if (input?.eventYear) conditions.push(eq(festivalLiverApplications.eventYear, input.eventYear));
      
      const result = await db.select().from(festivalLiverApplications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(festivalLiverApplications.createdAt));
      const poolL = (await import("./selectionCenterRouter.js")).getPool();
      const [ticketsL] = await poolL.query("SELECT applicationId, ticketId, checkedIn, checkedInAt FROM lcf_tickets WHERE applicantType = ?", ["liver"]);
      const ticketMapL = new Map((ticketsL as any[]).map(t => [t.applicationId, { ticketId: t.ticketId, checkedIn: !!t.checkedIn, checkedInAt: t.checkedInAt }]));
      return result.map(r => ({ ...r, ticket: ticketMapL.get(r.id) || null }));
    }),

  // 一般来場申込み一覧
  listGeneral: festivalAdminProcedure
    .input(z.object({
      status: z.string().optional(),
      eventYear: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.status) conditions.push(eq(festivalGeneralApplications.status, input.status as any));
      if (input?.eventYear) conditions.push(eq(festivalGeneralApplications.eventYear, input.eventYear));
      
      const result = await db.select().from(festivalGeneralApplications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(festivalGeneralApplications.createdAt));
      // Join with lcf_tickets for check-in status
      const pool2 = (await import('./selectionCenterRouter.js')).getPool();
      const [tickets2] = await pool2.query('SELECT applicationId, ticketId, checkedIn, checkedInAt FROM lcf_tickets WHERE applicantType = ?', ['general']);
      const ticketMap2 = new Map((tickets2 as any[]).map(t => [t.applicationId, { ticketId: t.ticketId, checkedIn: !!t.checkedIn, checkedInAt: t.checkedInAt }]));
      return result.map(r => ({ ...r, ticket: ticketMap2.get(r.id) || null }));
    }),

  // ステータス更新（全タイプ共通）
  updateStatus: festivalAdminProcedure
    .input(z.object({
      type: z.enum(["company", "liver", "general"]),
      id: z.number(),
      status: z.enum(["new", "confirmed", "rejected", "cancelled"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const table = input.type === "company" ? festivalCompanyApplications
        : input.type === "liver" ? festivalLiverApplications
        : festivalGeneralApplications;

      const updateData: any = { status: input.status };
      if (input.notes !== undefined) updateData.notes = input.notes;

      await db.update(table).set(updateData).where(eq(table.id, input.id));
      return { success: true };
    }),

  // ===== イベント設定管理 =====

  // イベント設定取得
  getEventSettings: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const year = input?.eventYear || "2026";
      const [settings] = await db.select().from(festivalEventSettings)
        .where(eq(festivalEventSettings.eventYear, year));
      return settings || null;
    }),

  // イベント設定更新
  updateEventSettings: festivalAdminProcedure
    .input(z.object({
      eventYear: z.string().optional(),
      eventName: z.string().optional(),
      venue: z.string().optional(),
      venueAddress: z.string().optional(),
      day1Date: z.string().optional(),
      day2Date: z.string().optional(),
      day1StartTime: z.string().optional(),
      day1EndTime: z.string().optional(),
      day2StartTime: z.string().optional(),
      day2EndTime: z.string().optional(),
      maxCapacity: z.number().optional(),
      description: z.string().optional(),
      programs: z.array(z.object({
        time: z.string(),
        title: z.string(),
        speaker: z.string().optional(),
        description: z.string().optional(),
      })).optional(),
      isPublished: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const year = input.eventYear || "2026";
      const [existing] = await db.select().from(festivalEventSettings)
        .where(eq(festivalEventSettings.eventYear, year));

      const data: any = { ...input };
      delete data.eventYear;
      // Remove undefined values
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

      if (existing) {
        await db.update(festivalEventSettings).set(data).where(eq(festivalEventSettings.id, existing.id));
      } else {
        await db.insert(festivalEventSettings).values({ eventYear: year, ...data });
      }
      return { success: true };
    }),

  // ===== スポンサー管理 =====

  // スポンサー一覧
  listSponsors: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const year = input?.eventYear || "2026";
      return await db.select().from(festivalSponsors)
        .where(eq(festivalSponsors.eventYear, year))
        .orderBy(desc(festivalSponsors.createdAt));
    }),

  // スポンサー追加
  addSponsor: festivalAdminProcedure
    .input(z.object({
      companyName: z.string().min(1),
      tier: z.enum(["platinum", "gold", "silver", "bronze", "partner"]),
      logoUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      sponsorshipAmount: z.number().optional(),
      boothSize: z.string().optional(),
      notes: z.string().optional(),
      eventYear: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      await db.insert(festivalSponsors).values({
        ...input,
        eventYear: input.eventYear || "2026",
      });
      return { success: true };
    }),

  // スポンサー更新
  updateSponsor: festivalAdminProcedure
    .input(z.object({
      id: z.number(),
      companyName: z.string().optional(),
      tier: z.enum(["platinum", "gold", "silver", "bronze", "partner"]).optional(),
      logoUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      sponsorshipAmount: z.number().optional(),
      boothSize: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      const { id, ...data } = input;
      Object.keys(data).forEach(k => (data as any)[k] === undefined && delete (data as any)[k]);
      await db.update(festivalSponsors).set(data).where(eq(festivalSponsors.id, id));
      return { success: true };
    }),

  // スポンサー削除
  deleteSponsor: festivalAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      await db.delete(festivalSponsors).where(eq(festivalSponsors.id, input.id));
      return { success: true };
    }),

  // ===== LINE登録者管理 =====

  // LINE登録者一覧
  listLineRegistrations: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const year = input?.eventYear || "2026";
      return await db.select().from(festivalLineRegistrations)
        .where(eq(festivalLineRegistrations.eventYear, year))
        .orderBy(desc(festivalLineRegistrations.createdAt));
    }),

  // LINE登録者追加（Webhook等から呼ばれる）
  addLineRegistration: publicProcedure
    .input(z.object({
      lineUserId: z.string().optional(),
      displayName: z.string().optional(),
      registeredFrom: z.string().optional(),
      eventYear: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      await db.insert(festivalLineRegistrations).values({
        ...input,
        eventYear: input.eventYear || "2026",
      });
      return { success: true };
    }),

  // LINE登録者数
  lineRegistrationCount: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const year = input?.eventYear || "2026";
      const [result] = await db.select({ count: count() }).from(festivalLineRegistrations)
        .where(eq(festivalLineRegistrations.eventYear, year));
      return { count: result?.count || 0 };
    }),

  // 統計情報
  stats: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { company: 0, liver: 0, general: 0, total: 0 };

      const year = input?.eventYear || "2026";

      const [companyCount] = await db.select({ count: count() }).from(festivalCompanyApplications)
        .where(eq(festivalCompanyApplications.eventYear, year));
      const [liverCount] = await db.select({ count: count() }).from(festivalLiverApplications)
        .where(eq(festivalLiverApplications.eventYear, year));
      const [generalCount] = await db.select({ count: count() }).from(festivalGeneralApplications)
        .where(eq(festivalGeneralApplications.eventYear, year));

      return {
        company: companyCount?.count || 0,
        liver: liverCount?.count || 0,
        general: generalCount?.count || 0,
        total: (companyCount?.count || 0) + (liverCount?.count || 0) + (generalCount?.count || 0),
      };
    }),

  // ===== 申し込み者向けAPI =====
  // 自分の申し込み情報を取得
  getMyApplication: publicProcedure
    .query(async ({ ctx }) => {
      const token = getCookieFromReq(ctx.req, 'lcf_token');
      if (!token) return null;
      const payload = await verifyFestivalToken(token);
      if (!payload) return null;
      const db = await getDb();
      if (!db) return null;
      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.id, payload.accountId))
        .limit(1);
      if (!account) return null;
      // アカウントタイプに応じて申し込み情報を取得
      if (account.accountType === 'company') {
        const [app] = await db.select().from(festivalCompanyApplications)
          .where(eq(festivalCompanyApplications.id, account.applicationId))
          .limit(1);
        return { accountType: 'company', application: app || null, account: { id: account.id, email: account.email, displayName: account.displayName } };
      } else if (account.accountType === 'liver') {
        const [app] = await db.select().from(festivalLiverApplications)
          .where(eq(festivalLiverApplications.id, account.applicationId))
          .limit(1);
        return { accountType: 'liver', application: app || null, account: { id: account.id, email: account.email, displayName: account.displayName } };
      } else {
        const [app] = await db.select().from(festivalGeneralApplications)
          .where(eq(festivalGeneralApplications.id, account.applicationId))
          .limit(1);
        return { accountType: 'general', application: app || null, account: { id: account.id, email: account.email, displayName: account.displayName } };
      }
    }),

  // ===== アクティビティログAPI =====
  // アクティビティログ一覧取得（管理者専用）
  listActivityLogs: festivalAdminProcedure
    .input(z.object({
      accountId: z.number().optional(),
      action: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0 };
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;
      const conditions: any[] = [];
      if (input?.accountId) {
        conditions.push(eq(festivalActivityLogs.accountId, input.accountId));
      }
      if (input?.action) {
        conditions.push(eq(festivalActivityLogs.action, input.action));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [totalResult] = await db.select({ count: count() }).from(festivalActivityLogs)
        .where(whereClause);
      const logs = await db.select().from(festivalActivityLogs)
        .where(whereClause)
        .orderBy(desc(festivalActivityLogs.createdAt))
        .limit(limit)
        .offset(offset);
      return { logs, total: totalResult?.count || 0 };
    }),

  // 重複データ削除（同一email+eventYearの古い方を削除）
  deduplicateApplications: festivalAdminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      let removedCompany = 0, removedLiver = 0, removedGeneral = 0;
      let debugInfo: any = {};

      // 企業の重複削除
      const companies = await db.select().from(festivalCompanyApplications);
      const companyByEmail = new Map<string, typeof companies>();
      debugInfo.companyTotal = companies.length;
      debugInfo.companyEmails = companies.map(c => c.email).slice(0, 5);
      for (const c of companies) {
        const key = c.email;
        if (!companyByEmail.has(key)) companyByEmail.set(key, []);
        companyByEmail.get(key)!.push(c);
      }
      for (const [, group] of companyByEmail) {
        if (group.length > 1) {
          group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          for (let i = 1; i < group.length; i++) {
            await db.delete(festivalCompanyApplications).where(eq(festivalCompanyApplications.id, group[i].id));
            removedCompany++;
          }
        }
      }

      // ライバーの重複削除
      const livers = await db.select().from(festivalLiverApplications);
      debugInfo.liverTotal = livers.length;
      debugInfo.liverEmails = livers.map(l => l.email).slice(0, 5);
      const liverByEmail = new Map<string, typeof livers>();
      for (const l of livers) {
        const key = l.email;
        if (!liverByEmail.has(key)) liverByEmail.set(key, []);
        liverByEmail.get(key)!.push(l);
      }
      for (const [, group] of liverByEmail) {
        if (group.length > 1) {
          group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          for (let i = 1; i < group.length; i++) {
            await db.delete(festivalLiverApplications).where(eq(festivalLiverApplications.id, group[i].id));
            removedLiver++;
          }
        }
      }

      // 一般の重複削除
      const generals = await db.select().from(festivalGeneralApplications);
      const generalByEmail = new Map<string, typeof generals>();
      for (const g of generals) {
        const key = g.email;
        if (!generalByEmail.has(key)) generalByEmail.set(key, []);
        generalByEmail.get(key)!.push(g);
      }
      for (const [, group] of generalByEmail) {
        if (group.length > 1) {
          group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          for (let i = 1; i < group.length; i++) {
            await db.delete(festivalGeneralApplications).where(eq(festivalGeneralApplications.id, group[i].id));
            removedGeneral++;
          }
        }
      }

      return { success: true, removed: { company: removedCompany, liver: removedLiver, general: removedGeneral }, debug: debugInfo };
    }),

  // チェックインQRコード用トークン生成
  generateCheckinToken: festivalAdminProcedure
    .input(z.object({
      type: z.enum(["company", "liver", "general"]),
      applicationId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { nanoid } = await import("nanoid");
      const token = nanoid(16);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      await ensureCheckinColumns();
      // チェックイントークンをメタデータとして保存（既存テーブルのnotesフィールドを活用）
      const table = input.type === "company" ? festivalCompanyApplications
        : input.type === "liver" ? festivalLiverApplications
        : festivalGeneralApplications;
      
      await db.update(table)
        .set({ checkinToken: token } as any)
        .where(eq(table.id, input.applicationId));
      
      return { token, qrData: `LCF2026:${input.type}:${input.applicationId}:${token}` };
    }),

  // チェックイン実行（QRスキャン時）
  performCheckin: publicProcedure
    .input(z.object({
      qrData: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureCheckinColumns();
      
      // QRデータ解析: "LCF2026:type:id:token"
      const parts = input.qrData.split(":");
      if (parts.length !== 4 || parts[0] !== "LCF2026") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "無効なQRコードです" });
      }
      const [, type, idStr, token] = parts;
      const id = parseInt(idStr);
      if (!["company", "liver", "general"].includes(type) || isNaN(id)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "無効なQRコードです" });
      }

      const table = type === "company" ? festivalCompanyApplications
        : type === "liver" ? festivalLiverApplications
        : festivalGeneralApplications;
      
      const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "申込みが見つかりません" });
      }
      if ((record as any).checkinToken !== token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "トークンが一致しません" });
      }
      if ((record as any).checkedInAt) {
        return { success: true, alreadyCheckedIn: true, name: (record as any).companyName || (record as any).name || (record as any).liverName, checkedInAt: (record as any).checkedInAt };
      }

      // チェックイン実行
      await db.update(table)
        .set({ checkedInAt: new Date() } as any)
        .where(eq(table.id, id));

      return { success: true, alreadyCheckedIn: false, name: (record as any).companyName || (record as any).name || (record as any).liverName, type };
    }),

  // チェックイン状況一覧
  getCheckinStatus: festivalAdminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { companies: [], livers: [], generals: [] };
      
      const companies = await db.select().from(festivalCompanyApplications).where(eq(festivalCompanyApplications.eventYear, "2026"));
      const livers = await db.select().from(festivalLiverApplications).where(eq(festivalLiverApplications.eventYear, "2026"));
      debugInfo.liverTotal = livers.length;
      debugInfo.liverEmails = livers.map(l => l.email).slice(0, 5);
      const generals = await db.select().from(festivalGeneralApplications).where(eq(festivalGeneralApplications.eventYear, "2026"));
      
      return {
        companies: companies.map(c => ({ id: c.id, name: c.companyName, email: c.email, checkedIn: !!(c as any).checkedInAt, checkedInAt: (c as any).checkedInAt })),
        livers: livers.map(l => ({ id: l.id, name: (l as any).liverName || l.name, email: l.email, checkedIn: !!(l as any).checkedInAt, checkedInAt: (l as any).checkedInAt })),
        generals: generals.map(g => ({ id: g.id, name: g.name, email: g.email, checkedIn: !!(g as any).checkedInAt, checkedInAt: (g as any).checkedInAt })),
      };
    }),
  // ===== Ticket Check-in System =====
  checkIn: festivalAdminProcedure
    .input(z.object({ ticketId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const pool = (await import('./selectionCenterRouter.js')).getPool();
      const [rows] = await pool.query(
        'SELECT * FROM lcf_tickets WHERE ticketId = ?',
        [input.ticketId]
      ) as any;
      if (!rows || rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "チケットが見つかりません" });
      }
      const ticket = rows[0];
      if (ticket.checkedIn === 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `既に签到済みです（${new Date(ticket.checkedInAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}）` });
      }
      await pool.query(
        'UPDATE lcf_tickets SET checkedIn = 1, checkedInAt = NOW(), checkedInBy = ? WHERE ticketId = ?',
        [ctx.user?.name || ctx.user?.email || 'admin', input.ticketId]
      );
      return { success: true, ticket: { ...ticket, checkedIn: 1 } };
    }),

  listTickets: festivalAdminProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const pool = (await import('./selectionCenterRouter.js')).getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lcf_tickets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ticketId VARCHAR(20) NOT NULL UNIQUE,
          applicationId INT NOT NULL,
          applicantName VARCHAR(255) NOT NULL,
          applicantEmail VARCHAR(255) NOT NULL,
          applicantType ENUM('liver', 'company', 'general') NOT NULL,
          checkedIn TINYINT(1) DEFAULT 0,
          checkedInAt TIMESTAMP NULL,
          checkedInBy VARCHAR(255) NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(() => {});
      
      let query = 'SELECT * FROM lcf_tickets ORDER BY createdAt DESC';
      let params: any[] = [];
      if (input?.search) {
        query = 'SELECT * FROM lcf_tickets WHERE applicantName LIKE ? OR applicantEmail LIKE ? OR ticketId LIKE ? ORDER BY createdAt DESC';
        const s = `%${input.search}%`;
        params = [s, s, s];
      }
      const [rows] = await pool.query(query, params) as any;
      return rows || [];
    }),

  getTicketByCode: publicProcedure
    .input(z.object({ ticketId: z.string() }))
    .query(async ({ input }) => {
      const pool = (await import('./selectionCenterRouter.js')).getPool();
      const [rows] = await pool.query(
        'SELECT ticketId, applicantName, applicantType, checkedIn, createdAt FROM lcf_tickets WHERE ticketId = ?',
        [input.ticketId]
      ) as any;
      if (!rows || rows.length === 0) return null;
      return rows[0];
    }),

  // Batch generate tickets for all existing applicants who don't have tickets yet
  batchGenerateTickets: festivalAdminProcedure
    .mutation(async () => {
      const pool = (await import('./selectionCenterRouter.js')).getPool();
      // Ensure table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lcf_tickets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ticketId VARCHAR(20) NOT NULL UNIQUE,
          applicationId INT NOT NULL,
          applicantName VARCHAR(255) NOT NULL,
          applicantEmail VARCHAR(255) NOT NULL,
          applicantType ENUM('liver', 'company', 'general') NOT NULL,
          checkedIn TINYINT(1) DEFAULT 0,
          checkedInAt TIMESTAMP NULL,
          checkedInBy VARCHAR(255) NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(() => {});

      let generated = 0;
      
      // Get all liver applications without tickets
      const [livers] = await pool.query(
        `SELECT l.id, l.liver_name as name, l.email FROM festival_liver_applications l 
         LEFT JOIN lcf_tickets t ON t.applicationId = l.id AND t.applicantType = 'liver'
         WHERE t.id IS NULL`
      ) as any;
      for (const app of (livers || [])) {
        try {
          const ticketId = await createTicket(pool, { applicationId: app.id, applicantName: app.name, applicantEmail: app.email, applicantType: 'liver' });
          generated++;
          // Send email with QR code (non-blocking)
          sendTicketEmail(app.email, app.name, ticketId, 'liver').catch(() => {});
        } catch (e) {}
      }

      // Get all company applications without tickets
      const [companies] = await pool.query(
        `SELECT c.id, c.company_name as name, c.email FROM festival_company_applications c
         LEFT JOIN lcf_tickets t ON t.applicationId = c.id AND t.applicantType = 'company'
         WHERE t.id IS NULL`
      ) as any;
      for (const app of (companies || [])) {
        try {
          const ticketId = await createTicket(pool, { applicationId: app.id, applicantName: app.name, applicantEmail: app.email, applicantType: 'company' });
          generated++;
          sendTicketEmail(app.email, app.name, ticketId, 'company').catch(() => {});
        } catch (e) {}
      }

      // Get all general applications without tickets
      const [generals] = await pool.query(
        `SELECT g.id, g.name, g.email FROM festival_general_applications g
         LEFT JOIN lcf_tickets t ON t.applicationId = g.id AND t.applicantType = 'general'
         WHERE t.id IS NULL`
      ) as any;
      for (const app of (generals || [])) {
        try {
          const ticketId = await createTicket(pool, { applicationId: app.id, applicantName: app.name, applicantEmail: app.email, applicantType: 'general' });
          generated++;
          sendTicketEmail(app.email, app.name, ticketId, 'general').catch(() => {});
        } catch (e) {}
      }

      return { success: true, generated };
    }),

  // Get ticket for a specific user by email (for マイページ)

  // 参加日程変更（マイページから）
  updateAttendanceSchedule: publicProcedure
    .input(z.object({
      attendanceSchedule: z.enum(["day1_only", "day2_only", "both_days"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = getCookieFromReq(ctx.req, 'lcf_token');
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      const payload = await verifyFestivalToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "セッション無効" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.id, payload.accountId))
        .limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "アカウントが見つかりません" });
      // アカウントタイプに応じて更新
      const pool = (await import('./selectionCenterRouter.js')).getPool();
      if (account.accountType === 'liver') {
        await pool.execute(
          'UPDATE festival_liver_applications SET attendanceSchedule = ? WHERE id = ?',
          [input.attendanceSchedule, account.applicationId]
        );
      } else if (account.accountType === 'company') {
        await pool.execute(
          'UPDATE festival_company_applications SET attendanceSchedule = ? WHERE id = ?',
          [input.attendanceSchedule, account.applicationId]
        );
      } else {
        await pool.execute(
          'UPDATE festival_general_applications SET attendanceSchedule = ? WHERE id = ?',
          [input.attendanceSchedule, account.applicationId]
        );
      }
      return { success: true };
    }),


  // 管理者による参加日程変更
  adminUpdateAttendanceSchedule: festivalAdminProcedure
    .input(z.object({
      applicationId: z.number(),
      applicantType: z.enum(["liver", "company", "general"]),
      attendanceSchedule: z.enum(["day1_only", "day2_only", "both_days"]),
    }))
    .mutation(async ({ input }) => {
      const pool = (await import('./selectionCenterRouter.js')).getPool();
      const table = input.applicantType === 'liver' ? 'festival_liver_applications'
        : input.applicantType === 'company' ? 'festival_company_applications'
        : 'festival_general_applications';
      await pool.execute(
        `UPDATE ${table} SET attendanceSchedule = ? WHERE id = ?`,
        [input.attendanceSchedule, input.applicationId]
      );
      return { success: true };
    }),

  getMyTicket: publicProcedure
    .input(z.object({ email: z.string() }))
    .query(async ({ input }) => {
      const pool = (await import('./selectionCenterRouter.js')).getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lcf_tickets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ticketId VARCHAR(20) NOT NULL UNIQUE,
          applicationId INT NOT NULL,
          applicantName VARCHAR(255) NOT NULL,
          applicantEmail VARCHAR(255) NOT NULL,
          applicantType ENUM('liver', 'company', 'general') NOT NULL,
          checkedIn TINYINT(1) DEFAULT 0,
          checkedInAt TIMESTAMP NULL,
          checkedInBy VARCHAR(255) NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(() => {});
      const [rows] = await pool.query(
        'SELECT ticketId, applicantName, applicantType, checkedIn, createdAt FROM lcf_tickets WHERE applicantEmail = ? LIMIT 1',
        [input.email]
      ) as any;
      if (!rows || rows.length === 0) return null;
      return rows[0];
    }),



});
import mysql from "mysql2/promise";

// チェックイン用カラムのマイグレーション（1回だけ実行）
let _migrationDone = false;
export async function ensureCheckinColumns() {
  if (_migrationDone) return;
  try {
    const pool = mysql.createPool(process.env.DATABASE_URL!);
    await pool.query("ALTER TABLE festival_company_applications ADD COLUMN IF NOT EXISTS checkin_token VARCHAR(32), ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP NULL").catch(() => {});
    await pool.query("ALTER TABLE festival_liver_applications ADD COLUMN IF NOT EXISTS checkin_token VARCHAR(32), ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP NULL").catch(() => {});
    await pool.query("ALTER TABLE festival_general_applications ADD COLUMN IF NOT EXISTS checkin_token VARCHAR(32), ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP NULL").catch(() => {
});
    await pool.end();
    _migrationDone = true;
  } catch (e) { _migrationDone = true; }
}

// サーバー起動時に即実行
ensureCheckinColumns();
