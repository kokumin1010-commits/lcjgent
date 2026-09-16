import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");
const company = read("client/src/pages/FestivalApplyCompany.tsx");
const liver = read("client/src/pages/FestivalApplyLiver.tsx");
const router = read("server/festivalRouter.ts");
const auth = read("server/festivalAuthRouter.ts");

describe("LCF second-edition email-first application flow", () => {
  it("starts both second-edition forms with the shared account email", () => {
    expect(company).toContain("if (isSecondEdition) {");
    expect(company).toContain("return [emailStep, ...COMPANY_DETAIL_STEPS]");
    expect(liver).toContain("if (event.edition === 2) {");
    expect(liver).toContain("return [emailStep, ...detailSteps]");
    expect(company).toContain("最初に、ご登録のメールアドレスを教えてください");
    expect(liver).toContain("最初に、ご登録のメールアドレスを教えてください");
  });

  it("keeps the first-edition question order and storage key compatible", () => {
    expect(company).toContain("...COMPANY_DETAIL_STEPS.slice(0, 7)");
    expect(company).toContain("question: 'メールアドレスを教えてください 📧'");
    expect(liver).toContain("...detailSteps.slice(0, 6), emailStep, ...detailSteps.slice(6)");
    expect(liver).toContain(": 'メールアドレスを教えてください 📧'");
    expect(liver).toContain('`lcf_liver_form_${event.eventYear}`');
    expect(liver).toContain('`lcf_liver_form_${event.eventYear}_password_reuse_v3`');
  });

  it("asks recognized members for the existing password before reusing profile data", () => {
    expect(company).toContain("第1回と同じパスワードを入力してください");
    expect(liver).toContain("第1回と同じパスワードを入力してください");
    expect(company).toContain("memberCheck.mutateAsync({ edition: event.edition, email: normalizedValue })");
    expect(liver).toContain("memberCheck.mutateAsync({ edition: event.edition, email: normalizedValue })");
    expect(company).toContain("applicationType: 'company'");
    expect(liver).toContain("applicationType: 'liver'");
    expect(company).toContain("reusableApplication");
    expect(liver).toContain("reusableApplication");
    expect(company).toContain("同じ情報の再入力は不要です");
    expect(liver).toContain("同じ情報の再入力は不要です");
  });

  it("keeps the complete form for new addresses and blocks ambiguous lookup failures", () => {
    const genericMessage = "メールアドレスありがとうございます。第2回のお申し込みを続けます。";
    expect(company).toContain(genericMessage);
    expect(liver).toContain(genericMessage);
    expect(company).toContain("会員情報を確認できませんでした。もう一度お試しください");
    expect(liver).toContain("会員情報を確認できませんでした。もう一度お試しください");
  });

  it("limits the public lookup to one boolean and rate-limits enumeration", () => {
    const start = router.indexOf("checkMemberEmail: publicProcedure");
    const end = router.indexOf("// 企業申込み", start);
    const endpoint = router.slice(start, end);

    expect(endpoint).toContain("edition: z.union([z.literal(1), z.literal(2)]).default(1)");
    expect(endpoint).toContain("email: z.string().trim().toLowerCase().email");
    expect(endpoint).toContain("enforceMemberLookupRateLimit(ctx.req, input.email, event.eventYear)");
    expect(endpoint).toContain("return { recognizedMember: Boolean(account) }");
    expect(endpoint).not.toMatch(/displayName|accountType|applicationId|lastLoginAt|passwordHash/);
    expect(router).toContain("member-lookup-ip:");
    expect(router).toContain("member-lookup-email:");
  });

  it("never rewrites an existing account while adding a second-edition application", () => {
    const start = auth.indexOf("export async function createFestivalAccount");
    const end = auth.indexOf("export const festivalAuthRouter", start);
    const helper = auth.slice(start, end);
    const existingStart = helper.indexOf("if (existing.length > 0)");
    const existingEnd = helper.indexOf("const password = generatePassword()", existingStart);
    const existingBranch = helper.slice(existingStart, existingEnd);

    expect(existingBranch).toContain("return null");
    expect(existingBranch).not.toMatch(/\.update\(|applicationId:|displayName:|passwordHash:/);
  });

  it("returns reusable first-edition fields only after successful password verification", () => {
    const loginStart = auth.indexOf("login: publicProcedure");
    const loginEnd = auth.indexOf("// 自分の情報取得", loginStart);
    const login = auth.slice(loginStart, loginEnd);
    expect(login).toContain('applicationType: z.enum(["company", "liver"]).optional()');
    expect(login).toContain('eq(festivalCompanyApplications.eventYear, "2026")');
    expect(login).toContain('eq(festivalLiverApplications.eventYear, "2026")');
    expect(login.indexOf("verifyPassword(input.password, account.passwordHash)")).toBeLessThan(login.indexOf("const reusable = application"));
    expect(login).toContain("isValidHttpUrl(application.websiteUrl)");
    expect(login).not.toContain("passwordHash,");
  });

  it("requires the authenticated matching account before accepting an existing email for edition two", () => {
    expect(router).toContain("requireAuthenticatedExistingMemberForSecondEdition");
    expect(router).toContain("verifyFestivalUserRequest(params.req)");
    expect(router).toContain("登録済みパスワードで本人確認してからお申し込みください");
    expect(router.match(/await requireAuthenticatedExistingMemberForSecondEdition/g)?.length).toBe(2);
  });

  it("never stores or renders the entered password as a chat answer", () => {
    expect(company).toContain("パスワードを確認しました ✓");
    expect(liver).toContain("パスワードを確認しました ✓");
    expect(company).not.toContain("[step.id]: normalizedValue }));\n    }\n\n    setInputValue('');\n\n    if (step.id === 'password'");
    expect(liver).not.toContain("[step.id]: normalizedValue }));\n    }\n\n    setInputValue('');\n\n    if (step.id === 'password'");
  });
});
