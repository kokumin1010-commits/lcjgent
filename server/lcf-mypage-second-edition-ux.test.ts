import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LCF_EVENT_DEFINITIONS } from "../shared/lcfEventDefinitions";

const read = (path: string) => readFileSync(path, "utf8");
const mypage = read("client/src/pages/LcfMypage.tsx");
const editionCenter = read("client/src/components/lcf/LcfEditionApplicationCenter.tsx");
const guide = read("client/src/components/lcf/LcfSecondEditionGuide.tsx");
const nav = read("client/src/components/lcf/FestivalWorkspaceNav.tsx");
const router = read("server/festivalRouter.ts");
const mypageService = read("server/festivalMypageService.ts");
const admissionService = read("server/festivalAdmissionService.ts");
const auth = read("server/festivalAuthRouter.ts");

describe("LCF second-edition mypage and companion admission", () => {
  it("uses the canonical second-edition date and venue instead of first-edition constants", () => {
    expect(LCF_EVENT_DEFINITIONS[2].eventYear).toBe("2026-02");
    expect(LCF_EVENT_DEFINITIONS[2].dateText).toBe("2026年12月8日（火）・9日（水）");
    expect(LCF_EVENT_DEFINITIONS[2].venueName).toContain("浜松町館");
    expect(mypage).not.toContain("Day 1: 2026年9月8日");
    expect(mypage).not.toContain("東京都港区白金台1-1-1");
    expect(editionCenter).toContain("LCF_EVENT_DEFINITIONS[2]");
    expect(guide).toContain("LCF_EVENT_DEFINITIONS[2]");
  });

  it("returns every owned application with its event key and exposes only second-edition mutations", () => {
    expect(router).toContain("getMyApplications: festivalUserProcedure");
    expect(router).toContain("festival_company_applications");
    expect(router).toContain("festival_liver_applications");
    expect(router).toContain("festival_general_applications");
    expect(router).toContain('eventYear: z.literal("2026-02")');
    expect(router).toContain("updateMyEditionAttendance: festivalUserProcedure");
    expect(router).toContain("cancelMyEditionApplication: festivalUserProcedure");
    expect(router).toContain('confirmation: z.literal("第2回申込みをキャンセルする")');
    expect(router).toContain("tickets.applicationId");
    expect(editionCenter).toContain("Number(ticket.applicationId) === Number(application.applicationId)");
  });

  it("requires ownership, preserves cancelled applications and invalidates their QR", () => {
    expect(mypageService).toContain("LOWER(TRIM(email)) = ?");
    expect(mypageService).toContain("event_year = ?");
    expect(mypageService).toContain("status = 'cancelled'");
    expect(mypageService).toContain("本人申込取消");
    expect(mypageService).toContain("SET isActive = 0");
    expect(mypageService).not.toMatch(/DELETE FROM festival_(?:company|liver|general)_applications/);
    expect(admissionService).toContain("このチケットは無効です");
  });

  it("gives every companion a separate ticket and keeps cancellation history", () => {
    expect(mypageService).toContain("CREATE TABLE IF NOT EXISTS festival_application_companions");
    expect(mypageService).toContain("同行者は1申込みにつき10名まで");
    expect(mypageService).toContain("holderType, companionId, isActive");
    expect(mypageService).toContain("同じメールアドレスの同行者が既に登録されています");
    expect(mypageService).toContain("status = 'cancelled'");
    expect(editionCenter).toContain("同行者ごとに専用QRを発行します");
    expect(editionCenter).toContain("本人用QRを共用する必要はありません");
    expect(router).toContain("await ensureFestivalMypageSchema(pool)");
    expect(router).toContain("companion.account_id = ?");
    expect(router).toContain("tickets.isActive = 1");
  });

  it("replaces ambiguous menus and removes the fake preparation checklist", () => {
    expect(nav).toContain("LCF参加・QR");
    expect(nav).toContain("LCMブランド・商品");
    expect(nav).toContain("LCM配信者プロフィール");
    expect(nav).toContain("LCF</strong>は開催イベント");
    expect(mypage).not.toContain("参加準備チェックリスト");
    expect(mypage).not.toContain("出展準備チェックリスト");
    expect(guide).toContain("事前マッチング・当日配信・GMV報告");
  });

  it("keeps first-edition booth reservations read-only until second-edition rules are set", () => {
    expect(mypage).toContain("第2回の予約ルールは準備中です");
    expect(mypage).toContain("第1回のブース予約履歴を見る");
    expect(mypage).toContain("<BoothReservationSection historyOnly />");
    expect(router).toContain("SELECT '2026' AS eventYear");
  });

  it("uses the common mypage and common-account language for authentication", () => {
    expect(auth).toContain('return "/lcf/mypage"');
    expect(auth).toContain("【LCF / LCM 共通アカウント】パスワード再設定のご案内");
    expect(auth).toContain("【LCF / LCM 共通アカウント】パスワード変更のお知らせ");
    expect(auth).toContain("LCF / LCM COMMON ACCOUNT");
    expect(auth).not.toContain("【LCF 2026】パスワード変更のお知らせ");
  });
});
