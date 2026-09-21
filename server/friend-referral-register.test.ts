import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const router = readFileSync(resolve("server/routers.ts"), "utf8");
const loginPage = readFileSync(resolve("client/src/pages/LineLogin.tsx"), "utf8");

describe("registration referral under Beauty Wallet migration", () => {
  it("does not credit or report a local registration reward", () => {
    expect(router).toContain("roulettePointsAwarded: 0");
    expect(router).toContain("let referralPoints = 0");
    expect(router).toContain("referralApplied,");
    expect(router).toContain("新しいLCJポイント特典の付与は停止しています");
    expect(router).not.toContain("500pt awarded to LINE user");
    expect(router).not.toContain("500pt awarded to user");
  });

  it("shows referral attribution without promising points", () => {
    expect(loginPage).toContain("友達招待コードを登録情報に反映します");
    expect(loginPage).toContain("さんからの紹介として登録します");
    expect(loginPage).not.toContain("登録で50pt付与");
    expect(loginPage).not.toContain("登録で500pt付与");
  });
});
