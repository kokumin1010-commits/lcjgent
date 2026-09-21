import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { maskEmail } from "./beautyWalletMemberLinkService";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Beauty Wallet member self-link", () => {
  it("masks linked email addresses before returning them to the UI", () => {
    expect(maskEmail("ExampleUser@Example.com")).toBe(
      "ex*********@example.com"
    );
  });

  it("stores short-lived hashed challenges and immutable audit evidence", () => {
    const migration = read("drizzle/0156_bw_member_self_link.sql");
    expect(migration).toContain("bw_member_link_challenges");
    expect(migration).toContain("tokenHash");
    expect(migration).toContain("codeHash");
    expect(migration).toContain("attemptCount");
    expect(migration).toContain("bw_member_link_audit_logs");
    expect(migration).toContain("bw_wallet_active_owners");
    expect(migration).toContain(
      "UNIQUE KEY `uq_bw_wallet_active_owner_member`"
    );
    expect(migration).not.toContain("verificationCode");
  });

  it("derives the member id from the signed session and never accepts it as input", () => {
    const router = read("server/beautyWalletMemberRouter.ts");
    const requestBlock = router.slice(
      router.indexOf("requestLinkCode:"),
      router.indexOf("confirmLink:")
    );
    const confirmBlock = router.slice(router.indexOf("confirmLink:"));
    expect(router).toContain("cookieOnly: true");
    expect(router).toContain("maxSessionAgeMs: LINE_MEMBER_SESSION_TTL_MS");
    expect(router).toContain("lineUserId: ctx.member.id");
    expect(requestBlock).not.toContain("lineUserId: z.");
    expect(confirmBlock).not.toContain("lineUserId: z.");
  });

  it("requires email OTP, prevents duplicate wallet ownership and never adds points", () => {
    const service = read("server/beautyWalletMemberLinkService.ts");
    expect(service).toContain("randomInt(0, 1_000_000)");
    expect(service).toContain("createHmac");
    expect(service).toContain("timingSafeEqual");
    expect(service).toContain("GET_LOCK");
    expect(service).toContain("bw_wallet_active_owners");
    expect(service).toContain("INNER JOIN bw_wallet_active_owners");
    expect(service).toContain(
      "WHERE bwCustomerId=? AND status='active' AND lineUserId<>?"
    );
    expect(service).toContain('event: "wallet_linked"');
    expect(service).not.toMatch(/UPDATE\s+line_point_balances/i);
    expect(service).not.toMatch(/INSERT\s+INTO\s+line_point_transactions/i);
    expect(service).not.toContain("bwExchangeTokens");
  });

  it("uses Beauty Wallet as the sole live balance while preserving LCJ as an audit reference", () => {
    const walletPage = read("client/src/pages/BeautyWallet.tsx");
    const mypage = read("client/src/pages/LineMypage.tsx");
    expect(walletPage).toContain("すべてのポイントの唯一のリアルタイム主台帳");
    expect(walletPage).toContain("Beauty Wallet 統合残高");
    expect(walletPage).toContain("LCJ側参考残高");
    expect(walletPage).toContain("自動加算しません");
    expect(walletPage).not.toContain("beautyWallet.exchange.useMutation");
    expect(walletPage).not.toContain("Beauty Walletに交換");
    expect(mypage).toContain("Beauty Wallet 統合残高");
    expect(mypage).toContain("LCJ参考残高");
    expect(mypage).toContain("過去データの照合用");
    expect(mypage).toContain("LCJ旧ポイント記録");
    expect(mypage).not.toContain("Beauty Walletに交換");
    expect(mypage).not.toContain("ポイントで商品を購入");
    expect(mypage).not.toContain("が7日以内に失効");
  });

  it("closes legacy unauthenticated linking and conversion routes", () => {
    const source = read("server/routers.ts");
    const legacy = source.slice(
      source.indexOf("beautyWallet: router({"),
      source.indexOf("lessons: lessonsRouter")
    );
    expect(legacy).toContain("本人確認のないメール自動連携は停止済み");
    expect(legacy).toContain(
      "旧公開コールバック：外部IDを自己申告できるため停止済み"
    );
    expect(legacy).toContain("旧ポイント交換は停止中です");
    expect(legacy).toContain("旧交換の再送信は停止中です");
    expect(legacy).toContain("主台帳連携は監査付きサポート手続き");
    expect(
      source.match(/Beauty Wallet主台帳での安全なポイント決済準備中/g)
    ).toHaveLength(2);
    expect(legacy).toContain("enabled: false");
    expect(legacy).not.toContain("autoLinked: true");
  });

  it("does not start the LCJ-local point expiry scheduler", () => {
    const server = read("server/_core/index.ts");
    expect(server).not.toContain("initPointExpiryScheduler();");
    expect(server).toContain("LCJ point expiry remains disabled");
  });
});
