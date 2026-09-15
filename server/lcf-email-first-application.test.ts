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
    expect(company).toContain("if (isSecondEdition) return [emailStep, ...COMPANY_DETAIL_STEPS]");
    expect(liver).toContain("if (event.edition === 2) return [emailStep, ...detailSteps]");
    expect(company).toContain("最初に、ご登録のメールアドレスを教えてください");
    expect(liver).toContain("最初に、ご登録のメールアドレスを教えてください");
  });

  it("keeps the first-edition question order and storage key compatible", () => {
    expect(company).toContain("...COMPANY_DETAIL_STEPS.slice(0, 7)");
    expect(company).toContain("question: 'メールアドレスを教えてください 📧'");
    expect(liver).toContain("...detailSteps.slice(0, 6), emailStep, ...detailSteps.slice(6)");
    expect(liver).toContain(": 'メールアドレスを教えてください 📧'");
    expect(liver).toContain('`lcf_liver_form_${event.eventYear}`');
    expect(liver).toContain('`lcf_liver_form_${event.eventYear}_email_first_v2`');
  });

  it("thanks recognized members and continues without creating another login", () => {
    const message = "会員様、ありがとうございます。第1回と同じアカウントで、第2回のお申し込みを続けられます。";
    expect(company).toContain(message);
    expect(liver).toContain(message);
    expect(company).toContain("memberCheck.mutateAsync({ edition: event.edition, email: normalizedValue })");
    expect(liver).toContain("memberCheck.mutateAsync({ edition: event.edition, email: normalizedValue })");
  });

  it("continues safely when the address is new or the lookup is unavailable", () => {
    const genericMessage = "メールアドレスありがとうございます。第2回のお申し込みを続けます。";
    expect(company.match(new RegExp(genericMessage, "g"))?.length).toBeGreaterThanOrEqual(2);
    expect(liver.match(new RegExp(genericMessage, "g"))?.length).toBeGreaterThanOrEqual(2);
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
});
