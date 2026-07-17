import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

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
