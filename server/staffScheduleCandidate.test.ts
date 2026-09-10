import { describe, expect, it } from "vitest";
import {
  filterStaffScheduleCandidates,
  isReportStaffPlaceholderCandidate,
  normalizeStaffScheduleCandidateIdentity,
} from "../shared/staffScheduleCandidate";

const verified = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: "同名员工",
  country: "中国",
  department: "运营部",
  email: `staff${id}@example.com`,
  emailEvidenceStatus: "verified",
  isActive: "active",
  archivedAt: null,
  mergedIntoStaffId: null,
  ...overrides,
});

const placeholder = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: "同名员工",
  country: "中国",
  department: null,
  email: `placeholder${id}@lcj.placeholder`,
  emailEvidenceStatus: "unverified",
  isActive: "active",
  archivedAt: null,
  mergedIntoStaffId: null,
  ...overrides,
});

describe("staff schedule candidate filtering", () => {
  it("hides a report placeholder when a verified same-name employee exists", () => {
    const result = filterStaffScheduleCandidates([placeholder(1), verified(2)]);
    expect(result.map((row) => row.id)).toEqual([2]);
  });

  it("keeps a placeholder when it is the only active identity", () => {
    expect(filterStaffScheduleCandidates([placeholder(1)]).map((row) => row.id)).toEqual([1]);
  });

  it("keeps multiple verified same-name employees because they may be different people", () => {
    expect(filterStaffScheduleCandidates([verified(1), verified(2)]).map((row) => row.id)).toEqual([1, 2]);
  });

  it("does not hide a same-name placeholder from a different country", () => {
    const rows = [placeholder(1, { country: "日本" }), verified(2, { country: "中国" })];
    expect(filterStaffScheduleCandidates(rows).map((row) => row.id)).toEqual([1, 2]);
  });

  it("normalizes full-width characters and spaces before comparing identities", () => {
    const rows = [
      placeholder(1, { name: "Ａ Ｂ", country: "中国" }),
      verified(2, { name: "ab", country: "中国" }),
    ];
    expect(normalizeStaffScheduleCandidateIdentity(" Ａ Ｂ ")).toBe("ab");
    expect(filterStaffScheduleCandidates(rows).map((row) => row.id)).toEqual([2]);
  });

  it("requires all placeholder signals before hiding a row", () => {
    expect(isReportStaffPlaceholderCandidate(placeholder(1))).toBe(true);
    expect(isReportStaffPlaceholderCandidate(placeholder(1, { department: "运营部" }))).toBe(false);
    expect(isReportStaffPlaceholderCandidate(placeholder(1, { emailEvidenceStatus: "verified" }))).toBe(false);
  });
});
