import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { hasPayrollAccess } from "../payrollAccess";
import { hasFinanceAccess } from "../financeAccess";

export const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// ============================================
// Rate-limited public procedure for LLM endpoints
// Prevents abuse of unauthenticated AI endpoints
// ============================================
const llmRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const LLM_RATE_LIMIT = { maxRequests: 10, windowMs: 60 * 1000 }; // 10 requests per minute per IP

const rateLimitLLM = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const req = (ctx as any).req;
  const ip = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || req?.ip || req?.socket?.remoteAddress || 'unknown';
  const clientIp = typeof ip === 'string' ? ip.split(',')[0].trim() : 'unknown';
  const now = Date.now();
  
  // Cleanup old entries every 100 checks
  if (llmRateLimitMap.size > 1000) {
    for (const [key, val] of llmRateLimitMap) {
      if (val.resetAt < now) llmRateLimitMap.delete(key);
    }
  }
  
  const entry = llmRateLimitMap.get(clientIp);
  if (entry && entry.resetAt > now) {
    if (entry.count >= LLM_RATE_LIMIT.maxRequests) {
      console.warn(`[RateLimit] LLM endpoint blocked for IP: ${clientIp} (${entry.count} requests in window)`);
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "リクエストが多すぎます。しばらく待ってからお試しください。" });
    }
    entry.count++;
  } else {
    llmRateLimitMap.set(clientIp, { count: 1, resetAt: now + LLM_RATE_LIMIT.windowMs });
  }
  
  return next();
});

export const rateLimitedPublicProcedure = t.procedure.use(rateLimitLLM);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

const requirePayrollUnlock = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (!(await hasPayrollAccess(ctx))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "給与明細密码验证后才能访问" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireFinanceUnlock = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (!(await hasFinanceAccess(ctx))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "财务管理密码验证后才能访问" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const financeProcedure = protectedProcedure.use(requireFinanceUnlock);
export const financeAdminProcedure = adminProcedure.use(requireFinanceUnlock);

const requireMasterFinanceForBrandScope = t.middleware(async ({ ctx, next, getRawInput }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  const rawInput = await getRawInput();
  const brandId = rawInput && typeof rawInput === "object" && "brandId" in rawInput
    ? Number((rawInput as { brandId?: unknown }).brandId || 0)
    : 0;
  if (brandId <= 0 && !(await hasFinanceAccess(ctx))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "财务管理密码验证后才能访问" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const brandScopedFinanceProcedure = protectedProcedure.use(requireMasterFinanceForBrandScope);
export const payrollProcedure = protectedProcedure.use(requirePayrollUnlock);
export const payrollAdminProcedure = adminProcedure.use(requirePayrollUnlock);
export const financePayrollProcedure = financeProcedure.use(requirePayrollUnlock);
export const financePayrollAdminProcedure = financeAdminProcedure.use(requirePayrollUnlock);
