import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2/promise";
import { router } from "./_core/trpc";
import { escapeHtml, sendEmail } from "./emailService";
import {
  createExhibitionSessionToken,
  exhibitionCookieOptions,
  exhibitionPublicProcedure,
  EXHIBITION_SESSION_COOKIE,
  generateExhibitionResetToken,
  getExhibitionPool,
  hashExhibitionPassword,
  hashExhibitionResetToken,
  normalizeExhibitionEmail,
  verifyExhibitionPassword,
  verifyExhibitionPortalRequest,
  writeExhibitionAuthLog,
} from "./exhibitionBoothService";

const PASSWORD_MIN_LENGTH = 12;
const RESET_TTL_MS = 60 * 60 * 1000;
const SET_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;
const GENERIC_RESET_MESSAGE =
  "登録されているメールアドレスの場合、パスワード設定用のメールを送信しました。";
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (rateLimits.size > 5_000) {
    for (const [entryKey, entry] of rateLimits)
      if (entry.resetAt <= now) rateLimits.delete(entryKey);
  }
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "操作回数が多すぎます。しばらく待ってからお試しください。",
    });
  }
  current.count += 1;
}

function clientIp(ctx: any) {
  return String(
    ctx.req?.headers?.["x-forwarded-for"] ||
      ctx.req?.ip ||
      ctx.req?.socket?.remoteAddress ||
      "unknown"
  )
    .split(",")[0]
    .trim()
    .slice(0, 120);
}

function passwordSchema() {
  return z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`
    )
    .max(128)
    .regex(/[A-Za-z]/, "パスワードには英字を含めてください")
    .regex(/[0-9]/, "パスワードには数字を含めてください");
}

function publicBaseUrl() {
  return (
    process.env.PUBLIC_URL ||
    process.env.APP_URL ||
    "https://lcjmall.com"
  ).replace(/\/$/, "");
}

export async function issueExhibitionPasswordToken(params: {
  accountId: number;
  email: string;
  displayName: string;
  purpose: "set_password" | "reset_password";
  createdByUserId?: number | null;
  req?: any;
}) {
  const pool = getExhibitionPool();
  const token = generateExhibitionResetToken();
  const tokenHash = hashExhibitionResetToken(token);
  const expiresAt = new Date(
    Date.now() +
      (params.purpose === "set_password" ? SET_PASSWORD_TTL_MS : RESET_TTL_MS)
  );
  await pool.query(
    `UPDATE exhibition_password_reset_tokens SET usedAt=CURRENT_TIMESTAMP
      WHERE accountId=? AND purpose=? AND usedAt IS NULL`,
    [params.accountId, params.purpose]
  );
  await pool.query(
    `INSERT INTO exhibition_password_reset_tokens
      (accountId,tokenHash,purpose,expiresAt,createdByUserId) VALUES (?,?,?,?,?)`,
    [
      params.accountId,
      tokenHash,
      params.purpose,
      expiresAt,
      params.createdByUserId || null,
    ]
  );

  const actionLabel =
    params.purpose === "set_password"
      ? "初回パスワード設定"
      : "パスワード再設定";
  const resetUrl = `${publicBaseUrl()}/booth-portal/reset-password/${encodeURIComponent(token)}`;
  const content = `${params.displayName} 様\n\nブランド展位ポータルの${actionLabel}を行ってください。\n${resetUrl}\n\n有効期限：${params.purpose === "set_password" ? "72時間" : "1時間"}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.8;color:#222"><p>${escapeHtml(params.displayName)} 様</p><p>ブランド展位ポータルの${escapeHtml(actionLabel)}を行ってください。</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#d6b15e;color:#111;padding:12px 24px;text-decoration:none;font-weight:bold">${escapeHtml(actionLabel)}</a></p><p style="color:#666;font-size:13px">有効期限：${params.purpose === "set_password" ? "72時間" : "1時間"}</p></div>`;
  const delivery = await sendEmail({
    to: [params.email],
    subject: `【LCJ】ブランド展位ポータル ${actionLabel}`,
    content,
    html,
    idempotencyKey: `exhibition:${params.purpose}:${params.accountId}:${tokenHash}`,
  });
  await writeExhibitionAuthLog({
    accountId: params.accountId,
    email: params.email,
    action: `${params.purpose}_issued`,
    success: delivery.success,
    req: params.req,
    details: {
      provider: delivery.provider || null,
      errorCode: delivery.errorCode || null,
      expiresAt: expiresAt.toISOString(),
    },
  }).catch(() => undefined);
  return { delivery, expiresAt };
}

export const exhibitionAuthRouter = router({
  me: exhibitionPublicProcedure.query(async ({ ctx }) => {
    const account = await verifyExhibitionPortalRequest(ctx.req);
    if (!account) return null;
    const pool = getExhibitionPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id AS profileId,p.reviewStatus,p.brandName,p.companyName AS profileCompanyName,
              a.boothCode,assignment.status AS assignmentStatus
         FROM exhibition_brand_profiles p
         LEFT JOIN exhibition_booth_assignments assignment ON assignment.profileId=p.id AND assignment.eventId=p.eventId
         LEFT JOIN exhibition_booths a ON a.id=assignment.boothId
        WHERE p.accountId=? ORDER BY p.id DESC LIMIT 1`,
      [account.id]
    );
    return { ...account, profile: rows[0] || null };
  }),

  login: exhibitionPublicProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email().max(320),
        password: z.string().min(1).max(128),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const email = normalizeExhibitionEmail(input.email);
      const ip = clientIp(ctx);
      enforceRateLimit(`exhibition-login:${ip}`, 30, 15 * 60 * 1000);
      enforceRateLimit(`exhibition-login:${ip}:${email}`, 10, 15 * 60 * 1000);
      const pool = getExhibitionPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id,email,passwordHash,displayName,companyName,phone,status,authVersion,failedLoginCount,lockedUntil
           FROM exhibition_accounts WHERE email=? LIMIT 1`,
        [email]
      );
      const account = rows[0];
      const locked =
        account?.lockedUntil &&
        new Date(account.lockedUntil).getTime() > Date.now();
      const valid =
        account &&
        !locked &&
        account.status === "active" &&
        verifyExhibitionPassword(input.password, account.passwordHash);
      if (!valid) {
        if (account && !locked) {
          const failures = Number(account.failedLoginCount || 0) + 1;
          const lock =
            failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
          await pool.query(
            `UPDATE exhibition_accounts SET failedLoginCount=?,lockedUntil=? WHERE id=?`,
            [failures >= 5 ? 0 : failures, lock, account.id]
          );
        }
        await writeExhibitionAuthLog({
          accountId: account ? Number(account.id) : null,
          email,
          action: "login",
          success: false,
          req: ctx.req,
          details: { locked: Boolean(locked) },
        }).catch(() => undefined);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "メールアドレスまたはパスワードが正しくありません",
        });
      }

      await pool.query(
        `UPDATE exhibition_accounts SET failedLoginCount=0,lockedUntil=NULL,lastLoginAt=CURRENT_TIMESTAMP WHERE id=?`,
        [account.id]
      );
      const sessionAccount = {
        id: Number(account.id),
        email: String(account.email),
        displayName: String(account.displayName),
        companyName: String(account.companyName),
        phone: account.phone ? String(account.phone) : null,
        status: "active" as const,
        authVersion: Number(account.authVersion),
      };
      const token = await createExhibitionSessionToken(sessionAccount);
      ctx.res.cookie(
        EXHIBITION_SESSION_COOKIE,
        token,
        exhibitionCookieOptions(ctx.req)
      );
      await writeExhibitionAuthLog({
        accountId: sessionAccount.id,
        email,
        action: "login",
        success: true,
        req: ctx.req,
      }).catch(() => undefined);
      return {
        success: true,
        account: sessionAccount,
        redirectPath: "/booth-portal",
      };
    }),

  logout: exhibitionPublicProcedure.mutation(async ({ ctx }) => {
    const account = await verifyExhibitionPortalRequest(ctx.req);
    ctx.res.clearCookie(EXHIBITION_SESSION_COOKIE, {
      ...exhibitionCookieOptions(ctx.req),
      maxAge: -1,
    });
    if (account)
      await writeExhibitionAuthLog({
        accountId: account.id,
        email: account.email,
        action: "logout",
        success: true,
        req: ctx.req,
      }).catch(() => undefined);
    return { success: true };
  }),

  requestPasswordReset: exhibitionPublicProcedure
    .input(
      z.object({ email: z.string().trim().toLowerCase().email().max(320) })
    )
    .mutation(async ({ input, ctx }) => {
      const email = normalizeExhibitionEmail(input.email);
      const ip = clientIp(ctx);
      enforceRateLimit(`exhibition-reset-ip:${ip}`, 10, 60 * 60 * 1000);
      enforceRateLimit(`exhibition-reset-email:${email}`, 3, 60 * 60 * 1000);
      const pool = getExhibitionPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id,email,displayName,status FROM exhibition_accounts WHERE email=? LIMIT 1`,
        [email]
      );
      const account = rows[0];
      if (account && account.status !== "suspended") {
        await issueExhibitionPasswordToken({
          accountId: Number(account.id),
          email: String(account.email),
          displayName: String(account.displayName),
          purpose:
            account.status === "invited" ? "set_password" : "reset_password",
          req: ctx.req,
        });
      } else {
        await writeExhibitionAuthLog({
          accountId: account ? Number(account.id) : null,
          email,
          action: "reset_requested",
          success: true,
          req: ctx.req,
          details: { matched: false },
        }).catch(() => undefined);
      }
      return { success: true, message: GENERIC_RESET_MESSAGE };
    }),

  validateResetToken: exhibitionPublicProcedure
    .input(z.object({ token: z.string().min(20).max(200) }))
    .query(async ({ input }) => {
      const pool = getExhibitionPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT token.id,token.purpose,token.expiresAt,account.displayName,account.companyName
           FROM exhibition_password_reset_tokens token
           JOIN exhibition_accounts account ON account.id=token.accountId
          WHERE token.tokenHash=? AND token.usedAt IS NULL AND token.expiresAt>CURRENT_TIMESTAMP
            AND account.status<>'suspended' LIMIT 1`,
        [hashExhibitionResetToken(input.token)]
      );
      if (!rows[0])
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "このリンクは無効または期限切れです",
        });
      return {
        valid: true,
        purpose: rows[0].purpose,
        displayName: rows[0].displayName,
        companyName: rows[0].companyName,
      };
    }),

  resetPassword: exhibitionPublicProcedure
    .input(
      z.object({
        token: z.string().min(20).max(200),
        password: passwordSchema(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT token.id AS tokenId,token.accountId,token.purpose,account.email,account.status
             FROM exhibition_password_reset_tokens token
             JOIN exhibition_accounts account ON account.id=token.accountId
            WHERE token.tokenHash=? AND token.usedAt IS NULL AND token.expiresAt>CURRENT_TIMESTAMP
            LIMIT 1 FOR UPDATE`,
          [hashExhibitionResetToken(input.token)]
        );
        const row = rows[0];
        if (!row || row.status === "suspended") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "このリンクは無効または期限切れです",
          });
        }
        await connection.query(
          `UPDATE exhibition_accounts
              SET passwordHash=?,passwordSetAt=CURRENT_TIMESTAMP,status='active',authVersion=authVersion+1,
                  failedLoginCount=0,lockedUntil=NULL
            WHERE id=?`,
          [hashExhibitionPassword(input.password), row.accountId]
        );
        await connection.query(
          `UPDATE exhibition_password_reset_tokens SET usedAt=CURRENT_TIMESTAMP WHERE accountId=? AND usedAt IS NULL`,
          [row.accountId]
        );
        await connection.commit();
        await writeExhibitionAuthLog({
          accountId: Number(row.accountId),
          email: String(row.email),
          action: String(row.purpose),
          success: true,
          req: ctx.req,
        }).catch(() => undefined);
        ctx.res.clearCookie(EXHIBITION_SESSION_COOKIE, {
          ...exhibitionCookieOptions(ctx.req),
          maxAge: -1,
        });
        return {
          success: true,
          message: "パスワードを設定しました。ログインしてください。",
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),
});
