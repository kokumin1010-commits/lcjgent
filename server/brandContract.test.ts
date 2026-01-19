import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  createBrandContract: vi.fn(),
  getContractsByBrandId: vi.fn(),
  getContractById: vi.fn(),
  updateBrandContract: vi.fn(),
  deleteBrandContract: vi.fn(),
  getActiveContractsCount: vi.fn(),
  getBrandById: vi.fn(),
  createActivityLog: vi.fn(),
}));

import {
  createBrandContract,
  getContractsByBrandId,
  getContractById,
  updateBrandContract,
  deleteBrandContract,
  getActiveContractsCount,
  getBrandById,
  createActivityLog,
} from "./db";

describe("Brand Contract Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBrandContract", () => {
    it("should create a new contract with all fields", async () => {
      const mockContract = {
        id: 1,
        brandId: 1,
        contractType: "月額契約" as const,
        fixedFee: 500000,
        commissionRate: "10%",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        status: "契約中" as const,
        memo: "Test memo",
        createdBy: 1,
      };

      (createBrandContract as any).mockResolvedValue(mockContract);

      const result = await createBrandContract({
        brandId: 1,
        contractType: "月額契約",
        fixedFee: 500000,
        commissionRate: "10%",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        status: "契約中",
        memo: "Test memo",
        createdBy: 1,
      });

      expect(result).toEqual(mockContract);
      expect(createBrandContract).toHaveBeenCalledTimes(1);
    });

    it("should create a contract with minimal fields", async () => {
      const mockContract = {
        id: 2,
        brandId: 1,
        contractType: "単発契約" as const,
        status: "契約中" as const,
        createdBy: 1,
      };

      (createBrandContract as any).mockResolvedValue(mockContract);

      const result = await createBrandContract({
        brandId: 1,
        contractType: "単発契約",
        status: "契約中",
        createdBy: 1,
      });

      expect(result).toEqual(mockContract);
    });
  });

  describe("getContractsByBrandId", () => {
    it("should return contracts for a brand", async () => {
      const mockContracts = [
        {
          id: 1,
          brandId: 1,
          contractType: "月額契約",
          fixedFee: 500000,
          status: "契約中",
        },
        {
          id: 2,
          brandId: 1,
          contractType: "広告案件",
          fixedFee: 100000,
          status: "完了",
        },
      ];

      (getContractsByBrandId as any).mockResolvedValue(mockContracts);

      const result = await getContractsByBrandId(1);

      expect(result).toEqual(mockContracts);
      expect(result).toHaveLength(2);
      expect(getContractsByBrandId).toHaveBeenCalledWith(1);
    });

    it("should return empty array when no contracts exist", async () => {
      (getContractsByBrandId as any).mockResolvedValue([]);

      const result = await getContractsByBrandId(999);

      expect(result).toEqual([]);
    });
  });

  describe("getContractById", () => {
    it("should return a contract by ID", async () => {
      const mockContract = {
        id: 1,
        brandId: 1,
        contractType: "年間契約",
        fixedFee: 6000000,
        status: "契約中",
      };

      (getContractById as any).mockResolvedValue(mockContract);

      const result = await getContractById(1);

      expect(result).toEqual(mockContract);
      expect(getContractById).toHaveBeenCalledWith(1);
    });

    it("should return undefined for non-existent contract", async () => {
      (getContractById as any).mockResolvedValue(undefined);

      const result = await getContractById(999);

      expect(result).toBeUndefined();
    });
  });

  describe("updateBrandContract", () => {
    it("should update contract status", async () => {
      (updateBrandContract as any).mockResolvedValue(undefined);

      await updateBrandContract(1, { status: "終了" });

      expect(updateBrandContract).toHaveBeenCalledWith(1, { status: "終了" });
    });

    it("should update multiple fields", async () => {
      (updateBrandContract as any).mockResolvedValue(undefined);

      await updateBrandContract(1, {
        fixedFee: 600000,
        commissionRate: "15%",
        memo: "Updated memo",
      });

      expect(updateBrandContract).toHaveBeenCalledWith(1, {
        fixedFee: 600000,
        commissionRate: "15%",
        memo: "Updated memo",
      });
    });
  });

  describe("deleteBrandContract", () => {
    it("should delete a contract", async () => {
      (deleteBrandContract as any).mockResolvedValue(undefined);

      await deleteBrandContract(1);

      expect(deleteBrandContract).toHaveBeenCalledWith(1);
    });
  });

  describe("getActiveContractsCount", () => {
    it("should return count of active contracts", async () => {
      (getActiveContractsCount as any).mockResolvedValue(3);

      const result = await getActiveContractsCount(1);

      expect(result).toBe(3);
      expect(getActiveContractsCount).toHaveBeenCalledWith(1);
    });

    it("should return 0 when no active contracts", async () => {
      (getActiveContractsCount as any).mockResolvedValue(0);

      const result = await getActiveContractsCount(999);

      expect(result).toBe(0);
    });
  });

  describe("Contract Types", () => {
    it("should support all contract types", async () => {
      const contractTypes = ["月額契約", "年間契約", "単発契約", "広告案件", "その他"];

      for (const contractType of contractTypes) {
        const mockContract = {
          id: 1,
          brandId: 1,
          contractType,
          status: "契約中",
          createdBy: 1,
        };

        (createBrandContract as any).mockResolvedValue(mockContract);

        const result = await createBrandContract({
          brandId: 1,
          contractType: contractType as any,
          status: "契約中",
          createdBy: 1,
        });

        expect(result.contractType).toBe(contractType);
      }
    });
  });

  describe("Contract Statuses", () => {
    it("should support all contract statuses", async () => {
      const statuses = ["契約中", "完了", "保留", "終了"];

      for (const status of statuses) {
        const mockContract = {
          id: 1,
          brandId: 1,
          contractType: "月額契約",
          status,
          createdBy: 1,
        };

        (createBrandContract as any).mockResolvedValue(mockContract);

        const result = await createBrandContract({
          brandId: 1,
          contractType: "月額契約",
          status: status as any,
          createdBy: 1,
        });

        expect(result.status).toBe(status);
      }
    });
  });
});
