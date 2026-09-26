import {
  createHash,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { t } from "./_core/trpc";
import { isExhibitionBoothUpgradeReady } from "./exhibitionBoothUpgrade";

export const EXHIBITION_ADMIN_PAGE_KEY = "/master/exhibition-booths";
export const EXHIBITION_SESSION_COOKIE = "exhibition_session";
export const EXHIBITION_SESSION_TTL_SECONDS = 12 * 60 * 60;

let poolInstance: Pool | null = null;

function assertExhibitionBoothReady() {
  if (!isExhibitionBoothUpgradeReady()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "ブランド展位ポータルは準備中です。しばらくしてから再度お試しください。",
    });
  }
}

export const exhibitionPublicProcedure = t.procedure.use(
  async ({ next }) => {
    assertExhibitionBoothReady();
    return next();
  }
);

export function getExhibitionPool(): Pool {
  if (!poolInstance) {
    if (!process.env.DATABASE_URL)
      throw new Error(
        "DATABASE_URL is required for exhibition booth management"
      );
    poolInstance = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 6,
    });
  }
  return poolInstance;
}

export type ExhibitionAccountSession = {
  id: number;
  email: string;
  displayName: string;
  companyName: string;
  phone: string | null;
  status: "invited" | "active" | "suspended";
  authVersion: number;
};

function authSecret() {
  const source = process.env.EXHIBITION_AUTH_SECRET || process.env.JWT_SECRET;
  if (!source) {
    if (process.env.NODE_ENV === "production")
      throw new Error("Exhibition auth secret is not configured");
    return createHash("sha256")
      .update("local-exhibition-auth-secret-v1")
      .digest();
  }
  return createHash("sha256").update(`exhibition-portal-v1:${source}`).digest();
}

export function normalizeExhibitionEmail(value: string) {
  return value.trim().toLowerCase();
}

export function hashExhibitionEmail(value: string) {
  return createHash("sha256")
    .update(normalizeExhibitionEmail(value), "utf8")
    .digest("hex");
}

export function hashExhibitionPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 210_000, 64, "sha512").toString(
    "hex"
  );
  return `v1:${salt}:${hash}`;
}

export function verifyExhibitionPassword(
  password: string,
  stored: string | null | undefined
) {
  if (!stored) return false;
  const [version, salt, expectedHex] = stored.split(":");
  if (
    version !== "v1" ||
    !salt ||
    !expectedHex ||
    !/^[a-f0-9]+$/i.test(expectedHex)
  )
    return false;
  const actualHex = pbkdf2Sync(password, salt, 210_000, 64, "sha512").toString(
    "hex"
  );
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashExhibitionResetToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateExhibitionResetToken() {
  return randomBytes(32).toString("base64url");
}

export async function createExhibitionSessionToken(
  account: ExhibitionAccountSession
) {
  return new SignJWT({
    email: account.email,
    authVersion: account.authVersion,
    scope: "exhibition-brand",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(account.id))
    .setAudience("lcj-exhibition-portal")
    .setIssuer("lcjmall.com")
    .setIssuedAt()
    .setExpirationTime(`${EXHIBITION_SESSION_TTL_SECONDS}s`)
    .sign(authSecret());
}

export function getRequestCookie(req: any, name: string) {
  const cookieHeader = String(req?.headers?.cookie || "");
  const entry = cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  return entry
    ? decodeURIComponent(entry.split("=").slice(1).join("="))
    : undefined;
}

export function exhibitionCookieOptions(req?: any) {
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const secure =
    process.env.NODE_ENV === "production" ||
    forwardedProto === "https" ||
    Boolean(req?.secure);
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: EXHIBITION_SESSION_TTL_SECONDS * 1000,
    path: "/",
  };
}

export async function verifyExhibitionPortalRequest(
  req: any
): Promise<ExhibitionAccountSession | null> {
  const token = getRequestCookie(req, EXHIBITION_SESSION_COOKIE);
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, authSecret(), {
      issuer: "lcjmall.com",
      audience: "lcj-exhibition-portal",
    });
    if (verified.payload.scope !== "exhibition-brand") return null;
    const accountId = Number(verified.payload.sub || 0);
    const authVersion = Number(verified.payload.authVersion || 0);
    if (!accountId || !authVersion) return null;
    const pool = getExhibitionPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id,email,displayName,companyName,phone,status,authVersion
         FROM exhibition_accounts WHERE id=? LIMIT 1`,
      [accountId]
    );
    const row = rows[0];
    if (
      !row ||
      row.status !== "active" ||
      Number(row.authVersion) !== authVersion
    )
      return null;
    return {
      id: Number(row.id),
      email: String(row.email),
      displayName: String(row.displayName),
      companyName: String(row.companyName),
      phone: row.phone ? String(row.phone) : null,
      status: row.status,
      authVersion: Number(row.authVersion),
    };
  } catch {
    return null;
  }
}

export const exhibitionPortalProcedure = t.procedure.use(
  async ({ ctx, next }) => {
    assertExhibitionBoothReady();
    const account = await verifyExhibitionPortalRequest(ctx.req);
    if (!account)
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "ログインしてください",
      });
    return next({ ctx: { ...ctx, exhibitionAccount: account } as any });
  }
);

function enabled(value: unknown) {
  return value === true || value === 1 || value === "1";
}

export async function requireExhibitionAdminAccess(
  ctx: any,
  mode: "view" | "edit" = "view"
) {
  assertExhibitionBoothReady();
  const user = ctx?.user;
  if (!user?.id)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "LCJ管理者としてログインしてください",
    });
  if (user.role === "admin") return { userId: Number(user.id), canEdit: true };

  const pool = getExhibitionPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT role.isSystem,permission.canView,permission.canEdit
       FROM user_role_assignments assignment
       JOIN system_roles role ON role.id=assignment.roleId
       LEFT JOIN role_permissions permission
         ON permission.roleId=role.id AND permission.pageKey=?
      WHERE assignment.userId=?`,
    [EXHIBITION_ADMIN_PAGE_KEY, Number(user.id)]
  );
  const canView = rows.some(
    row => enabled(row.isSystem) || enabled(row.canView)
  );
  const canEdit = rows.some(
    row => enabled(row.isSystem) || enabled(row.canEdit)
  );
  if (!canView || (mode === "edit" && !canEdit)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        mode === "edit" ? "展位管理的编辑权限不足" : "没有展位管理的查看权限",
    });
  }
  return { userId: Number(user.id), canEdit };
}

export const exhibitionAdminViewProcedure = t.procedure.use(
  async ({ ctx, next }) => {
    const access = await requireExhibitionAdminAccess(ctx, "view");
    return next({ ctx: { ...ctx, exhibitionAdminAccess: access } as any });
  }
);

export const exhibitionAdminEditProcedure = t.procedure.use(
  async ({ ctx, next }) => {
    const access = await requireExhibitionAdminAccess(ctx, "edit");
    return next({ ctx: { ...ctx, exhibitionAdminAccess: access } as any });
  }
);

export function requestMetadata(req: any) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return {
    ipAddress:
      (forwarded || req?.ip || req?.socket?.remoteAddress || null)
        ?.toString()
        .slice(0, 120) || null,
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 500) || null,
  };
}

export async function writeExhibitionAuthLog(params: {
  connection?: PoolConnection;
  accountId?: number | null;
  email: string;
  action: string;
  success: boolean;
  req?: any;
  details?: Record<string, unknown> | null;
}) {
  const executor = params.connection || getExhibitionPool();
  const metadata = requestMetadata(params.req);
  await executor.query(
    `INSERT INTO exhibition_auth_logs
      (accountId,emailHash,action,success,ipAddress,userAgent,details)
     VALUES (?,?,?,?,?,?,?)`,
    [
      params.accountId || null,
      hashExhibitionEmail(params.email),
      params.action.slice(0, 80),
      params.success ? 1 : 0,
      metadata.ipAddress,
      metadata.userAgent,
      params.details ? JSON.stringify(params.details) : null,
    ]
  );
}

export async function writeExhibitionAudit(params: {
  connection?: PoolConnection;
  eventId?: number | null;
  accountId?: number | null;
  profileId?: number | null;
  boothId?: number | null;
  assetId?: number | null;
  actorType: "brand" | "admin" | "system";
  actorId?: number | null;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}) {
  const executor = params.connection || getExhibitionPool();
  await executor.query(
    `INSERT INTO exhibition_audit_logs
      (eventId,accountId,profileId,boothId,assetId,actorType,actorId,action,beforeJson,afterJson,reason)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      params.eventId || null,
      params.accountId || null,
      params.profileId || null,
      params.boothId || null,
      params.assetId || null,
      params.actorType,
      params.actorId || null,
      params.action.slice(0, 100),
      params.before === undefined ? null : JSON.stringify(params.before),
      params.after === undefined ? null : JSON.stringify(params.after),
      params.reason?.slice(0, 1000) || null,
    ]
  );
}

export async function findActiveExhibitionEvent(
  connection: Pool | PoolConnection = getExhibitionPool()
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,slug,name,venue,startDate,endDate,floorMapUrl,floorMapWidth,floorMapHeight,status
       FROM exhibition_events WHERE status='active' ORDER BY id DESC LIMIT 1`
  );
  const event = rows[0];
  if (!event)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "現在受付中の展位イベントがありません",
    });
  return event;
}

export async function findProfileForAccount(
  accountId: number,
  connection: Pool | PoolConnection = getExhibitionPool()
) {
  const event = await findActiveExhibitionEvent(connection);
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT * FROM exhibition_brand_profiles WHERE eventId=? AND accountId=? LIMIT 1`,
    [Number(event.id), accountId]
  );
  const profile = rows[0];
  if (!profile)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "ブランドプロフィールが見つかりません",
    });
  return { event, profile };
}

export function sanitizeDownloadFileName(value: string) {
  return (
    value
      .replace(/[\r\n\0]/g, "")
      .replace(/[\\/]/g, "_")
      .trim()
      .slice(0, 200) || "download"
  );
}
