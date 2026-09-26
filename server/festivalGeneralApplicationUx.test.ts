import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENERAL_APPLICATION_FORM,
  countGeneralApplicationRequired,
  validateGeneralApplicationStep,
  type GeneralApplicationFormState,
} from "../client/src/lib/festivalGeneralApplicationForm";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Live Commerce Festival general application experience", () => {
  it("validates each step without submitting any application", () => {
    expect(Object.keys(validateGeneralApplicationStep(DEFAULT_GENERAL_APPLICATION_FORM, 1))).toEqual([
      "participationType",
      "name",
      "nameKana",
      "email",
      "phone",
    ]);
    expect(validateGeneralApplicationStep(DEFAULT_GENERAL_APPLICATION_FORM, 2)).toMatchObject({
      portraitConsent: expect.any(String),
      complianceConsent: expect.any(String),
    });

    const complete: GeneralApplicationFormState = {
      ...DEFAULT_GENERAL_APPLICATION_FORM,
      participationType: "corporate",
      name: "テスト 太郎",
      nameKana: "テスト タロウ",
      brandName: "テスト株式会社",
      email: "test@example.com",
      phone: "090-1234-5678",
      portraitConsent: true,
      complianceConsent: true,
    };
    expect(validateGeneralApplicationStep(complete, 1)).toEqual({});
    expect(validateGeneralApplicationStep(complete, 2)).toEqual({});
    expect(countGeneralApplicationRequired(complete)).toEqual({ completed: 8, total: 8 });

    const corporateWithoutBrand = { ...complete, brandName: "" };
    expect(validateGeneralApplicationStep(corporateWithoutBrand, 1)).toHaveProperty("brandName");
    const individualWithoutBrand = { ...corporateWithoutBrand, participationType: "individual" as const };
    expect(validateGeneralApplicationStep(individualWithoutBrand, 1)).toEqual({});
  });

  it("shows an HTML boot shell before the React bundle is available", () => {
    const html = read("client/index.html");
    expect(html).toContain('id="app-boot-shell"');
    expect(html).toContain("path === '/lcf/apply/general' || path === '/livecommercefestival/2026/apply/general'");
    expect(html).toContain("new URLSearchParams(location.search).get('edition') === '2'");
    expect(html).toContain("第2回 Live Commerce Festival");
    expect(html).toContain("一般参加お申し込みフォームを読み込んでいます");
    expect(html).toContain("window.setTimeout");
    expect(html).toContain("12000");
    expect(html).toContain("ページを再読み込みする");
  });

  it("uses a two-step, edition-aware mobile flow without visit-plan questions", () => {
    const page = read("client/src/pages/FestivalApplyGeneral.tsx");
    const formModel = read("client/src/lib/festivalGeneralApplicationForm.ts");
    expect(page).toContain('["基本情報", "確認・送信"]');
    expect(page).toContain("ステップ {step} / 2");
    expect(page).toContain("来場計画の入力は不要です。");
    expect(page).not.toContain("INDUSTRY_OPTIONS");
    expect(page).not.toContain("VISIT_PURPOSES");
    expect(page).not.toContain("ATTENDANCE_OPTIONS");
    for (const removedField of ["industryTypes", "visitPurposes", "attendanceSchedule"]) {
      expect(formModel).not.toContain(removedField);
      expect(page).not.toContain(`form.${removedField}`);
    }
    expect(formModel).toContain('lcf-general-application-draft-v2');
    expect(page).toContain("SESSION_DRAFT_KEY");
    expect(page).toContain('getLcfEventByEdition(new URLSearchParams(window.location.search).get("edition"))');
    expect(page).toContain('`${SESSION_DRAFT_KEY}-${event.eventYear}`');
    expect(page).toContain("edition: event.edition");
    expect(page).toContain("event.dateText");
    expect(page).toContain("event.venueName");
    expect(page).toContain("すでにLCF・LCM会員の方");
    expect(page).toContain("ログインしてから申し込む");
    expect(page).toContain('`/lcf/login?return=${encodeURIComponent(window.location.pathname + window.location.search)}`');
    expect(page).toContain("window.sessionStorage.setItem");
    expect(page).toContain("window.sessionStorage.removeItem");
    expect(page).not.toContain("window.localStorage");
    expect(page).toContain("fixed inset-x-0 bottom-0");
    expect(page).toContain("focusFirstError");
    expect(page).toContain("この内容で申し込む");
    expect(page).toContain("同じメールアドレスで既にお申し込み済みの場合");
  });

  it("uses the trusted edition and neutral DB defaults when visit-plan data is omitted", () => {
    const router = read("server/festivalRouter.ts");
    const start = router.indexOf("submitGeneral: publicProcedure");
    const end = router.indexOf("// ===== 管理API", start);
    const submitGeneral = router.slice(start, end);
    expect(submitGeneral).toContain('edition: z.union([z.literal(1), z.literal(2)]).default(1)');
    expect(submitGeneral).toContain('attendanceSchedule: z.enum(["day1_only", "day2_only", "both_days"]).default("both_days")');
    expect(submitGeneral).toContain('visitPurposes: z.array(z.string().trim().min(1).max(255)).max(20).default([])');
    expect(submitGeneral).toContain('industryTypes: z.array(z.string().trim().min(1).max(255)).max(20).default([])');
    expect(submitGeneral).toContain("const event = getLcfEventByEdition(input.edition)");
    expect(submitGeneral).toContain("await requireAuthenticatedExistingMemberForSecondEdition");
    expect(submitGeneral.indexOf("await requireAuthenticatedExistingMemberForSecondEdition")).toBeLessThan(submitGeneral.indexOf("const existingGeneral"));
    expect(submitGeneral).toContain("eq(festivalGeneralApplications.eventYear, event.eventYear)");
    expect(submitGeneral).toContain("eventYear: event.eventYear");
    expect(submitGeneral).toContain("sendTicketEmail(input.email, input.name, ticketId, 'general', event.eventYear)");
    expect(submitGeneral).toContain("lineOrLark: input.lineOrLark || null");
    expect(submitGeneral).toContain("brandName: input.brandName || null");
    expect(submitGeneral).toContain("industryTypes: input.industryTypes");
    expect(submitGeneral).not.toContain("ALTER TABLE");
    expect(submitGeneral).not.toContain("UPDATE festival_general_applications SET line_or_lark");
  });

  it("keeps the startup table shape and Drizzle schema aligned", () => {
    const ensure = read("server/ensureFestivalTables.ts");
    const schema = read("drizzle/festivalSchema.ts");
    for (const column of ["line_or_lark", "brand_name", "industry_types"]) {
      expect(ensure).toContain(column);
      expect(schema).toContain(column);
    }
    expect(ensure).toContain("uk_festival_general_email_year");
    expect(schema).toContain('uniqueIndex("uk_festival_general_email_year")');
  });
});
