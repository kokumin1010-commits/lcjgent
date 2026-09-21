import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const router = readFileSync(resolve("server/routers.ts"), "utf8");

describe("referral code policy", () => {
  it("keeps code validation as a read-only preview", () => {
    expect(router).toContain("validateReferralCode: publicProcedure");
    expect(router).toContain("verifyReferralCode: publicProcedure");
  });

  it("requires a signed member session and then fails closed before applying a reward", () => {
    const start = router.indexOf("applyReferralCode: publicProcedure");
    const end = router.indexOf("// ポイント履歴取得", start);
    const source = router.slice(start, end);
    const auth = source.indexOf("getLineUserFromSession(ctx)");
    const guard = source.indexOf("LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE");
    const apply = source.indexOf("const result = await applyReferralCode(");
    expect(auth).toBeGreaterThanOrEqual(0);
    expect(guard).toBeGreaterThan(auth);
    expect(apply).toBeGreaterThan(guard);
  });

  it("does not expose an active referral reward promise on the login page", () => {
    const login = readFileSync(resolve("client/src/pages/LineLogin.tsx"), "utf8");
    expect(login).not.toContain("登録で50pt付与");
    expect(login).not.toContain("登録で500pt付与");
  });
});
