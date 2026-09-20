import { describe, expect, it } from "vitest";
import {
  brandContractUpdateInputSchema,
  normalizeBrandContractUpdate,
  sanitizeBrandContractAuditValue,
} from "./brandContractUpdate";

describe("brandContract.update input validation", () => {
  it("accepts Date objects, date strings, and all supported service types", () => {
    const serviceTypes = [
      "TSP",
      "ライブコマース",
      "広告運用代行",
      "SNS運用代行",
      "その他",
      "単発ライブ契約",
      "期間契約",
      "運用代行型（TSP）",
      "パッケージ／複合契約",
    ] as const;

    for (const serviceType of serviceTypes) {
      expect(brandContractUpdateInputSchema.safeParse({
        id: 1,
        serviceType,
        startDate: "2025-11-25",
        endDate: new Date("2026-05-24"),
      }).success).toBe(true);
    }
  });

  it("accepts all contract statuses and commission strings", () => {
    for (const status of ["契約中", "完了", "保留", "終了"] as const) {
      expect(brandContractUpdateInputSchema.safeParse({ id: 1, status, commissionRate: "20%" }).success).toBe(true);
    }
  });

  it("accepts explicit nulls when clearing writable contract fields", () => {
    const parsed = brandContractUpdateInputSchema.parse({
      id: 1,
      fixedFee: null,
      commissionRate: null,
      startDate: null,
      endDate: null,
      memo: null,
      kgLiveCondition: null,
      liverLiveCondition: null,
      shortVideoCondition: null,
      contractPeriodLabel: null,
    });
    const normalized = normalizeBrandContractUpdate(parsed);

    expect(normalized.startDateProvided).toBe(true);
    expect(normalized.endDateProvided).toBe(true);
    expect(normalized.data).toMatchObject({
      fixedFee: null,
      commissionRate: null,
      startDate: null,
      endDate: null,
      memo: null,
      kgLiveCondition: null,
      liverLiveCondition: null,
      shortVideoCondition: null,
      contractPeriodLabel: null,
    });
  });

  it("does not manufacture updates for omitted fields", () => {
    const normalized = normalizeBrandContractUpdate(brandContractUpdateInputSchema.parse({ id: 7, status: "契約中" }));
    expect(normalized).toMatchObject({ id: 7, startDateProvided: false, endDateProvided: false, data: { status: "契約中" } });
    expect(normalized.data).not.toHaveProperty("startDate");
    expect(normalized.data).not.toHaveProperty("endDate");
  });

  it("converts valid date strings and rejects invalid ones before database writes", () => {
    const normalized = normalizeBrandContractUpdate(brandContractUpdateInputSchema.parse({
      id: 1,
      startDate: "2025-11-25",
      endDate: "2026-05-24T00:00:00.000Z",
    }));
    expect(normalized.data.startDate).toBeInstanceOf(Date);
    expect(normalized.data.startDate.toISOString()).toContain("2025-11-25");
    expect(normalized.data.endDate.toISOString()).toBe("2026-05-24T00:00:00.000Z");

    expect(() => normalizeBrandContractUpdate(brandContractUpdateInputSchema.parse({ id: 1, startDate: "not-a-date" }))).toThrow("startDate is not a valid date");
  });

  it("redacts contract prose from audit snapshots while retaining field state", () => {
    const snapshot = sanitizeBrandContractAuditValue({
      id: 1,
      brandId: 10,
      fixedFee: 500000,
      memo: "Confidential payment and termination terms",
      kgLiveCondition: "Monthly live terms",
      liverLiveCondition: null,
      shortVideoCondition: "30 videos",
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot).toMatchObject({
      id: 1,
      brandId: 10,
      fixedFee: 500000,
      memo: { present: true, length: 42 },
      kgLiveCondition: { present: true, length: 18 },
      liverLiveCondition: { present: false, length: 0 },
      shortVideoCondition: { present: true, length: 9 },
    });
    expect(serialized).not.toContain("Confidential payment");
    expect(serialized).not.toContain("Monthly live terms");
    expect(serialized).not.toContain("30 videos");
  });

  it("rejects invalid service types and non-number ids", () => {
    expect(brandContractUpdateInputSchema.safeParse({ id: 1, serviceType: "無効なタイプ" }).success).toBe(false);
    expect(brandContractUpdateInputSchema.safeParse({ id: "1", serviceType: "TSP" }).success).toBe(false);
  });
});
