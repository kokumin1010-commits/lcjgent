import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { requireLineMember } from "./lineMemberAuth";
import { LINE_MEMBER_SESSION_TTL_MS } from "./lineMemberSession";
import {
  confirmMemberWalletLink,
  getMemberCentralLedger,
  getMemberWalletLinkStatus,
  requestMemberWalletLinkChallenge,
} from "./beautyWalletMemberLinkService";

const memberProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const member = await requireLineMember(ctx, {
    cookieOnly: true,
    maxSessionAgeMs: LINE_MEMBER_SESSION_TTL_MS,
  });
  return next({
    ctx: {
      ...ctx,
      member: {
        id: Number(member.lineUser!.id),
      },
    },
  });
});

export const beautyWalletMemberRouter = router({
  status: memberProcedure.query(({ ctx }) =>
    getMemberWalletLinkStatus(ctx.member.id)
  ),

  centralLedger: memberProcedure.query(({ ctx }) =>
    getMemberCentralLedger(ctx.member.id)
  ),

  requestLinkCode: memberProcedure
    .input(
      z.object({
        email: z.string().trim().email().max(320),
      })
    )
    .mutation(({ ctx, input }) =>
      requestMemberWalletLinkChallenge({
        lineUserId: ctx.member.id,
        email: input.email,
        req: { ip: ctx.req.ip },
      })
    ),

  confirmLink: memberProcedure
    .input(
      z.object({
        challengeToken: z.string().min(32).max(128),
        code: z.string().regex(/^\d{6}$/),
      })
    )
    .mutation(({ ctx, input }) =>
      confirmMemberWalletLink({
        lineUserId: ctx.member.id,
        challengeToken: input.challengeToken,
        code: input.code,
      })
    ),
});
