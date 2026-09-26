import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  filterLiverApplicationSteps,
  SECOND_EDITION_OMITTED_LIVER_QUESTION_IDS,
} from "../client/src/lib/festivalLiverApplicationFlow";
import { festivalLiverApplicationInputSchema } from "./festivalRouter";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");
const liverPage = read("client/src/pages/FestivalApplyLiver.tsx");

const detailSteps = [
  "name",
  "nameKana",
  "liverName",
  "agency",
  "accountInfo",
  "genre",
  "phone",
  "lineOrLark",
  "attendanceSchedule",
  "matchingPreference",
  "beginnerSupport",
  "agree",
].map((id) => ({ id }));

const minimumApplication = {
  name: "山田 花子",
  nameKana: "ヤマダ ハナコ",
  liverName: "hanako_live",
  genre: "美容",
  email: "hanako@example.com",
  portraitRightsConsent: true as const,
  complianceConsent: true as const,
};

describe("LCF second-edition streamlined live-commercer application", () => {
  it("omits only the seven questions requested for edition two", () => {
    expect(SECOND_EDITION_OMITTED_LIVER_QUESTION_IDS).toEqual([
      "agency",
      "accountInfo",
      "phone",
      "lineOrLark",
      "attendanceSchedule",
      "matchingPreference",
      "beginnerSupport",
    ]);
    expect(filterLiverApplicationSteps(2, detailSteps).map((step) => step.id)).toEqual([
      "name",
      "nameKana",
      "liverName",
      "genre",
      "agree",
    ]);
  });

  it("keeps the complete first-edition question sequence", () => {
    expect(filterLiverApplicationSteps(1, detailSteps).map((step) => step.id)).toEqual(
      detailSteps.map((step) => step.id),
    );
    expect(liverPage).toContain("return [...detailSteps.slice(0, 6), emailStep, ...detailSteps.slice(6)]");
  });

  it("keeps email and password verification for returning members but asks no removed follow-up question", () => {
    expect(liverPage).toContain("...secondEditionDetailSteps.filter(step => step.id === 'agree')");
    expect(liverPage).toContain("[emailStep, LIVER_PASSWORD_STEP");
    expect(liverPage).toContain("_password_reuse_v4");
  });

  it("accepts the shortened edition-two payload with neutral defaults", () => {
    const parsed = festivalLiverApplicationInputSchema.parse({
      edition: 2 as const,
      ...minimumApplication,
    });
    expect(parsed.phone).toBe("");
    expect(parsed.attendanceSchedule).toBe("both_days");
    expect(parsed.matchingPreference).toBe("no");
    expect(parsed.beginnerSupport).toBe("no");
    expect(liverPage).toContain("matchingPreference: (answers.matchingPreference as 'yes' | 'no') || 'no'");
  });

  it("continues to require a valid phone for edition one and validates any supplied edition-two phone", () => {
    const firstEdition = festivalLiverApplicationInputSchema.safeParse({
      edition: 1 as const,
      ...minimumApplication,
      attendanceSchedule: "both_days" as const,
      matchingPreference: "yes" as const,
    });
    expect(firstEdition.success).toBe(false);
    if (!firstEdition.success) expect(firstEdition.error.issues[0]?.path).toEqual(["phone"]);

    expect(festivalLiverApplicationInputSchema.safeParse({
      edition: 2 as const,
      ...minimumApplication,
      phone: "not-a-phone",
    }).success).toBe(false);

    const missingFirstEditionSelections = festivalLiverApplicationInputSchema.safeParse({
      edition: 1 as const,
      ...minimumApplication,
      phone: "090-1234-5678",
    });
    expect(missingFirstEditionSelections.success).toBe(false);
    if (!missingFirstEditionSelections.success) {
      expect(missingFirstEditionSelections.error.issues.map(issue => issue.path[0])).toEqual([
        "attendanceSchedule",
        "matchingPreference",
      ]);
    }

    expect(festivalLiverApplicationInputSchema.safeParse({
      edition: 1 as const,
      ...minimumApplication,
      phone: "090-1234-5678",
      attendanceSchedule: "both_days" as const,
      matchingPreference: "yes" as const,
    }).success).toBe(true);
  });
});
