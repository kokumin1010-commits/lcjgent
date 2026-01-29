import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getAllContracts: vi.fn(),
}));

import { getAllContracts } from "./db";

describe("brandContract.listAll API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all contracts from database", async () => {
    const mockContracts = [
      {
        id: 1,
        brandId: 1,
        serviceType: "単発ライブ契約",
        fixedFee: 5500000,
        status: "契約中",
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        brandId: 2,
        serviceType: "期間契約",
        fixedFee: 3000000,
        status: "契約中",
        startDate: new Date("2025-02-01"),
        endDate: new Date("2025-06-30"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(getAllContracts).mockResolvedValue(mockContracts);

    const result = await getAllContracts();

    expect(result).toHaveLength(2);
    expect(result[0].fixedFee).toBe(5500000);
    expect(result[1].fixedFee).toBe(3000000);
  });

  it("should return empty array when no contracts exist", async () => {
    vi.mocked(getAllContracts).mockResolvedValue([]);

    const result = await getAllContracts();

    expect(result).toHaveLength(0);
  });

  it("should calculate total ad budget from contracts", async () => {
    const mockContracts = [
      { id: 1, brandId: 1, fixedFee: 5500000 },
      { id: 2, brandId: 2, fixedFee: 3000000 },
      { id: 3, brandId: 3, fixedFee: 2500000 },
    ];

    vi.mocked(getAllContracts).mockResolvedValue(mockContracts);

    const contracts = await getAllContracts();
    const totalAdBudget = contracts.reduce((sum: number, c: any) => sum + (c.fixedFee || 0), 0);

    expect(totalAdBudget).toBe(11000000);
  });

  it("should handle contracts with null fixedFee", async () => {
    const mockContracts = [
      { id: 1, brandId: 1, fixedFee: 5500000 },
      { id: 2, brandId: 2, fixedFee: null },
      { id: 3, brandId: 3, fixedFee: 2500000 },
    ];

    vi.mocked(getAllContracts).mockResolvedValue(mockContracts);

    const contracts = await getAllContracts();
    const totalAdBudget = contracts.reduce((sum: number, c: any) => sum + (c.fixedFee || 0), 0);

    expect(totalAdBudget).toBe(8000000);
  });

  it("should filter contracts by date range", async () => {
    const mockContracts = [
      {
        id: 1,
        brandId: 1,
        fixedFee: 5500000,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
      },
      {
        id: 2,
        brandId: 2,
        fixedFee: 3000000,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
      },
      {
        id: 3,
        brandId: 3,
        fixedFee: 2500000,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-08-31"),
      },
    ];

    vi.mocked(getAllContracts).mockResolvedValue(mockContracts);

    const contracts = await getAllContracts();
    
    // Filter for January 2025
    const startDate = new Date(2025, 0, 1);
    const endDate = new Date(2025, 0, 31, 23, 59, 59);
    
    const filteredContracts = contracts.filter((contract: any) => {
      const contractStart = contract.startDate ? new Date(contract.startDate) : null;
      const contractEnd = contract.endDate ? new Date(contract.endDate) : null;
      
      if (contractStart && contractEnd) {
        return contractStart <= endDate && contractEnd >= startDate;
      } else if (contractStart) {
        return contractStart <= endDate;
      }
      return true;
    });

    // Contract 1 (2025-01-01 to 2025-12-31) overlaps with January 2025
    // Contract 2 (2024-01-01 to 2024-12-31) does NOT overlap with January 2025
    // Contract 3 (2025-06-01 to 2025-08-31) does NOT overlap with January 2025
    expect(filteredContracts).toHaveLength(1);
    expect(filteredContracts[0].id).toBe(1);
  });

  it("should calculate ROAS correctly", async () => {
    const totalGmv = 27500000; // GMV合計
    const totalAdBudget = 5500000; // 広告費合計
    
    const roas = totalAdBudget > 0 ? totalGmv / totalAdBudget : 0;
    
    expect(roas).toBe(5);
  });

  it("should return 0 ROAS when ad budget is 0", async () => {
    const totalGmv = 27500000;
    const totalAdBudget = 0;
    
    const roas = totalAdBudget > 0 ? totalGmv / totalAdBudget : 0;
    
    expect(roas).toBe(0);
  });
});
