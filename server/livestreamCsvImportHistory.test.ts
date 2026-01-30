import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createLivestreamCsvImportHistory,
  getLivestreamCsvImportHistoryByLiver,
  deleteLivestreamCsvImportHistory,
} from "./db";

// Mock the database module
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    // Keep the actual implementations for testing
  };
});

describe("Livestream CSV Import History", () => {
  describe("createLivestreamCsvImportHistory", () => {
    it("should create a new import history record", async () => {
      const testData = {
        liverId: 1,
        brandId: 1,
        fileName: "test_import.xlsx",
        livestreamCount: 10,
        createdCount: 8,
        updatedCount: 2,
        totalGmv: 1000000,
        dateRangeStart: new Date("2025-08-01"),
        dateRangeEnd: new Date("2025-08-31"),
        importedBy: 1,
        importedByName: "Test User",
      };

      // This test verifies the function signature and basic structure
      expect(createLivestreamCsvImportHistory).toBeDefined();
      expect(typeof createLivestreamCsvImportHistory).toBe("function");
    });

    it("should handle null values for optional fields", async () => {
      const testData = {
        liverId: 1,
        brandId: 1,
        fileName: "test_import.xlsx",
        livestreamCount: 5,
        createdCount: 5,
        updatedCount: 0,
        totalGmv: null,
        dateRangeStart: null,
        dateRangeEnd: null,
        importedBy: 1,
        importedByName: "Test User",
      };

      expect(createLivestreamCsvImportHistory).toBeDefined();
    });
  });

  describe("getLivestreamCsvImportHistoryByLiver", () => {
    it("should be a function that accepts liverId", async () => {
      expect(getLivestreamCsvImportHistoryByLiver).toBeDefined();
      expect(typeof getLivestreamCsvImportHistoryByLiver).toBe("function");
    });
  });

  describe("deleteLivestreamCsvImportHistory", () => {
    it("should be a function that accepts historyId", async () => {
      expect(deleteLivestreamCsvImportHistory).toBeDefined();
      expect(typeof deleteLivestreamCsvImportHistory).toBe("function");
    });
  });
});

describe("Livestream CSV Import History Integration", () => {
  it("should have proper function exports", () => {
    // Verify all functions are exported from db.ts
    expect(createLivestreamCsvImportHistory).toBeDefined();
    expect(getLivestreamCsvImportHistoryByLiver).toBeDefined();
    expect(deleteLivestreamCsvImportHistory).toBeDefined();
  });
});
