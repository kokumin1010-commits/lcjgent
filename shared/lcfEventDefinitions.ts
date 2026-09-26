/**
 * LCF trusted event definitions.
 * Design rule: legacy edition data is immutable; public input may select only a listed edition.
 */

export const LCF_EVENT_DEFINITIONS = {
  1: {
    edition: 1,
    eventYear: "2026",
    label: "第1回",
    name: "第1回 LIVE COMMERCE FESTIVAL 2026",
    emailName: "Live Commerce Festival 2026",
    dateText: "2026年9月8日（火）・9日（水）",
    dateRangeText: "2026年9月8日（火）〜9日（水）",
    shortDateText: "2026.09.08 — 09.09",
    day1ShortText: "9/8",
    day2ShortText: "9/9",
    venueName: "八芳園",
    venueDetail: "八芳園（東京都港区白金台1-1-1）",
    venueShortText: "八芳園｜東京・白金台",
    pagePath: "/2026",
    applicationCompanyPath: "/lcf/apply/company",
    applicationLiverPath: "/lcf/apply/liver",
    applicationGeneralPath: "/lcf/apply/general",
  },
  2: {
    edition: 2,
    eventYear: "2026-02",
    label: "第2回",
    name: "第2回 LIVE COMMERCE FESTIVAL",
    emailName: "第2回 Live Commerce Festival",
    dateText: "2026年12月8日（火）・9日（水）",
    dateRangeText: "2026年12月8日（火）〜9日（水）",
    shortDateText: "2026.12.08 — 12.09",
    day1ShortText: "12/8",
    day2ShortText: "12/9",
    venueName: "東京都立産業貿易センター浜松町館 2階展示室",
    venueDetail: "東京都立産業貿易センター浜松町館 2階展示室（東京都港区海岸1-7-1）",
    venueShortText: "東京都立産業貿易センター浜松町館｜2階展示室",
    pagePath: "/2nd",
    applicationCompanyPath: "/lcf/apply/company?edition=2",
    applicationLiverPath: "/lcf/apply/liver?edition=2",
    applicationGeneralPath: "/lcf/apply/general?edition=2",
  },
} as const;

export type LcfEditionNumber = keyof typeof LCF_EVENT_DEFINITIONS;
export type LcfEventYear = (typeof LCF_EVENT_DEFINITIONS)[LcfEditionNumber]["eventYear"];
export type LcfEventDefinition = (typeof LCF_EVENT_DEFINITIONS)[LcfEditionNumber];

export function resolveLcfEdition(value: unknown): LcfEditionNumber {
  return String(value || "") === "2" ? 2 : 1;
}

export function getLcfEventByEdition(value: unknown): LcfEventDefinition {
  return LCF_EVENT_DEFINITIONS[resolveLcfEdition(value)];
}

export function getLcfEventByYear(value: unknown): LcfEventDefinition {
  return value === LCF_EVENT_DEFINITIONS[2].eventYear
    ? LCF_EVENT_DEFINITIONS[2]
    : LCF_EVENT_DEFINITIONS[1];
}

export function isLcfEventYear(value: unknown): value is LcfEventYear {
  return value === LCF_EVENT_DEFINITIONS[1].eventYear || value === LCF_EVENT_DEFINITIONS[2].eventYear;
}
