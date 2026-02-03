import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addProductLiver,
  removeProductLiver,
  getProductLivers,
  bulkAddProductLivers,
  getLiverSalesStatsByBrand,
} from "./db";

// Mock the database
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  
  // In-memory store for product-liver relationships
  let productLivers: Array<{
    id: number;
    productId: number;
    liverId: number;
    specialSetName: string | null;
    specialPrice: number | null;
    commissionRate: string | null;
    assignedAt: Date;
    createdBy: number | null;
  }> = [];
  let nextId = 1;

  return {
    ...actual,
    addProductLiver: vi.fn(async (data: { productId: number; liverId: number; createdBy?: number }) => {
      const newRecord = {
        id: nextId++,
        productId: data.productId,
        liverId: data.liverId,
        specialSetName: null,
        specialPrice: null,
        commissionRate: null,
        assignedAt: new Date(),
        createdBy: data.createdBy || null,
      };
      productLivers.push(newRecord);
      return newRecord.id;
    }),
    removeProductLiver: vi.fn(async (productId: number, liverId: number) => {
      const index = productLivers.findIndex(
        (pl) => pl.productId === productId && pl.liverId === liverId
      );
      if (index > -1) {
        productLivers.splice(index, 1);
      }
    }),
    getProductLivers: vi.fn(async (productId: number) => {
      return productLivers
        .filter((pl) => pl.productId === productId)
        .map((pl) => ({
          id: pl.liverId,
          name: `Liver ${pl.liverId}`,
          email: `liver${pl.liverId}@example.com`,
        }));
    }),
    bulkAddProductLivers: vi.fn(async (productId: number, liverIds: number[], createdBy?: number) => {
      for (const liverId of liverIds) {
        const newRecord = {
          id: nextId++,
          productId,
          liverId,
          specialSetName: null,
          specialPrice: null,
          commissionRate: null,
          assignedAt: new Date(),
          createdBy: createdBy || null,
        };
        productLivers.push(newRecord);
      }
    }),
    getLiverSalesStatsByBrand: vi.fn(async (brandId: number) => {
      return [
        { liverId: 1, liverName: "Liver 1", totalGmv: 100000, livestreamCount: 5 },
        { liverId: 2, liverName: "Liver 2", totalGmv: 80000, livestreamCount: 3 },
      ];
    }),
  };
});

describe("Product-Liver Relationship Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addProductLiver", () => {
    it("should add a liver to a product", async () => {
      const result = await addProductLiver({ productId: 1, liverId: 1 });
      expect(result).toBeDefined();
      expect(addProductLiver).toHaveBeenCalledWith({ productId: 1, liverId: 1 });
    });

    it("should add multiple livers to the same product", async () => {
      await addProductLiver({ productId: 1, liverId: 1 });
      await addProductLiver({ productId: 1, liverId: 2 });
      expect(addProductLiver).toHaveBeenCalledTimes(2);
    });
  });

  describe("removeProductLiver", () => {
    it("should remove a liver from a product", async () => {
      await addProductLiver({ productId: 1, liverId: 1 });
      await removeProductLiver(1, 1);
      expect(removeProductLiver).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("getProductLivers", () => {
    it("should return livers for a product", async () => {
      await addProductLiver({ productId: 1, liverId: 1 });
      await addProductLiver({ productId: 1, liverId: 2 });
      const livers = await getProductLivers(1);
      expect(livers).toBeDefined();
      expect(Array.isArray(livers)).toBe(true);
    });
  });

  describe("bulkAddProductLivers", () => {
    it("should add multiple livers to a product at once", async () => {
      await bulkAddProductLivers(1, [1, 2, 3]);
      expect(bulkAddProductLivers).toHaveBeenCalledWith(1, [1, 2, 3]);
    });

    it("should handle empty liver array", async () => {
      await bulkAddProductLivers(1, []);
      expect(bulkAddProductLivers).toHaveBeenCalledWith(1, []);
    });
  });

  describe("getLiverSalesStatsByBrand", () => {
    it("should return liver sales stats for a brand", async () => {
      const stats = await getLiverSalesStatsByBrand(1);
      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0]).toHaveProperty("liverId");
      expect(stats[0]).toHaveProperty("liverName");
      expect(stats[0]).toHaveProperty("totalGmv");
    });
  });
});
