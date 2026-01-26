import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// Test the contract update input schema
describe("brandContract.update input validation", () => {
  // Define the schema that matches the router
  const updateContractSchema = z.object({
    id: z.number(),
    serviceType: z.enum(["TSP", "ライブコマース", "広告運用代行", "SNS運用代行", "その他", "単発ライブ契約", "期間契約", "運用代行型（TSP）", "パッケージ／複合契約"]).optional(),
    contractType: z.enum(["月額契約", "年間契約", "単発契約", "広告案件", "その他"]).optional(),
    fixedFee: z.number().optional(),
    commissionRate: z.string().optional(),
    startDate: z.union([z.date(), z.string()]).optional(),
    endDate: z.union([z.date(), z.string()]).optional(),
    status: z.enum(["契約中", "完了", "保留", "終了"]).optional(),
    memo: z.string().optional(),
  });

  it("should accept Date objects for startDate and endDate", () => {
    const input = {
      id: 1,
      serviceType: "パッケージ／複合契約" as const,
      status: "契約中" as const,
      fixedFee: 4500000,
      startDate: new Date("2025-11-25"),
      endDate: new Date("2026-05-24"),
    };

    const result = updateContractSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept string dates for startDate and endDate", () => {
    const input = {
      id: 1,
      serviceType: "パッケージ／複合契約" as const,
      status: "契約中" as const,
      fixedFee: 4500000,
      startDate: "2025-11-25",
      endDate: "2026-05-24",
    };

    const result = updateContractSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept ISO date strings", () => {
    const input = {
      id: 1,
      startDate: "2025-11-25T00:00:00.000Z",
      endDate: "2026-05-24T00:00:00.000Z",
    };

    const result = updateContractSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept commissionRate as string", () => {
    const input = {
      id: 1,
      commissionRate: "20%",
    };

    const result = updateContractSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept all service types", () => {
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
      const input = {
        id: 1,
        serviceType,
      };
      const result = updateContractSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it("should accept all status types", () => {
    const statuses = ["契約中", "完了", "保留", "終了"] as const;

    for (const status of statuses) {
      const input = {
        id: 1,
        status,
      };
      const result = updateContractSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid service type", () => {
    const input = {
      id: 1,
      serviceType: "無効なタイプ",
    };

    const result = updateContractSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject non-number id", () => {
    const input = {
      id: "1",
      serviceType: "TSP",
    };

    const result = updateContractSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// Test date conversion logic
describe("date conversion logic", () => {
  it("should convert string date to Date object", () => {
    const startDate = "2025-11-25";
    const result = startDate instanceof Date ? startDate : new Date(startDate);
    
    expect(result instanceof Date).toBe(true);
    // Date object is created, regardless of timezone
    expect(result.toISOString()).toContain("2025-11-25");
  });

  it("should keep Date object as is", () => {
    const startDate = new Date("2025-11-25");
    const result = startDate instanceof Date ? startDate : new Date(startDate);
    
    expect(result instanceof Date).toBe(true);
    expect(result.getTime()).toBe(startDate.getTime());
  });

  it("should handle ISO date strings correctly", () => {
    const startDate = "2025-11-25T00:00:00.000Z";
    const result = new Date(startDate);
    
    expect(result instanceof Date).toBe(true);
    expect(result.toISOString()).toBe("2025-11-25T00:00:00.000Z");
  });
});
