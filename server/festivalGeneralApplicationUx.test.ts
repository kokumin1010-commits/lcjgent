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
      industryTypes: expect.any(String),
      visitPurposes: expect.any(String),
      attendanceSchedule: expect.any(String),
    });
    expect(validateGeneralApplicationStep(DEFAULT_GENERAL_APPLICATION_FORM, 3)).toMatchObject({
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
      industryTypes: ["ブランド"],
      visitPurposes: ["セミナー・講演の聴講"],
      attendanceSchedule: "both_days",
      portraitConsent: true,
      complianceConsent: true,
    };
    expect(validateGeneralApplicationStep(complete, 1)).toEqual({});
    expect(validateGeneralApplicationStep(complete, 2)).toEqual({});
    expect(validateGeneralApplicationStep(complete, 3)).toEqual({});
    expect(countGeneralApplicationRequired(complete)).toEqual({ completed: 11, total: 11 });

    const corporateWithoutBrand = { ...complete, brandName: "" };
    expect(validateGeneralApplicationStep(corporateWithoutBrand, 1)).toHaveProperty("brandName");
    const individualWithoutBrand = { ...corporateWithoutBrand, participationType: "individual" as const };
    expect(validateGeneralApplicationStep(individualWithoutBrand, 1)).toEqual({});
  });

  it("shows an HTML boot shell before the React bundle is available", () => {
    const html = read("client/index.html");
    expect(html).toContain('id="app-boot-shell"');
    expect(html).toContain("Live Commerce Festival 2026");
    expect(html).toContain("一般参加お申し込みフォームを読み込んでいます");
    expect(html).toContain("window.setTimeout");
    expect(html).toContain("12000");
    expect(html).toContain("ページを再読み込みする");
  });

  it("uses a three-step, mobile-friendly flow with tab-scoped draft recovery", () => {
    const page = read("client/src/pages/FestivalApplyGeneral.tsx");
    expect(page).toContain('"基本情報", "来場計画", "確認・送信"');
    expect(page).toContain("ステップ {step} / 3");
    expect(page).toContain("SESSION_DRAFT_KEY");
    expect(page).toContain("window.sessionStorage.setItem");
    expect(page).toContain("window.sessionStorage.removeItem");
    expect(page).not.toContain("window.localStorage");
    expect(page).toContain("fixed inset-x-0 bottom-0");
    expect(page).toContain("focusFirstError");
    expect(page).toContain("この内容で申し込む");
    expect(page).toContain("同じメールアドレスで既にお申し込み済みの場合");
  });

  it("writes all general application fields in one typed insert without request-time DDL", () => {
    const router = read("server/festivalRouter.ts");
    const start = router.indexOf("submitGeneral: publicProcedure");
    const end = router.indexOf("// ===== 管理API", start);
    const submitGeneral = router.slice(start, end);
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
