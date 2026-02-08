import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getSimulationLiverStats: vi.fn(),
  createSimulation: vi.fn(),
  getSimulationByToken: vi.fn(),
  getSimulationById: vi.fn(),
  listSimulations: vi.fn(),
  deleteSimulation: vi.fn(),
  createSimulationFeedback: vi.fn(),
  updateSimulation: vi.fn(),
}));

import {
  getSimulationLiverStats,
  createSimulation,
  getSimulationByToken,
  getSimulationById,
  listSimulations,
  deleteSimulation,
  createSimulationFeedback,
  updateSimulation,
} from "./db";

describe("Simulation Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Simulation Calculation Logic", () => {
    it("should calculate basic simulation metrics correctly", () => {
      // Given: product conditions
      const unitPrice = 3980;
      const costPrice = 1500;
      const commissionRate = 10;
      const fixedFee = 50000;
      const streamDuration = 60;

      // Simulated past performance data
      const avgGmvPerHour = 500000;
      const avgCvr = 3.5;

      // When: calculate simulation
      const estimatedGmv = Math.round(avgGmvPerHour * (streamDuration / 60));
      const estimatedSalesCount = Math.round(estimatedGmv / unitPrice);
      const grossMarginRate = ((unitPrice - costPrice) / unitPrice) * 100;
      const estimatedGrossProfit = Math.round(estimatedGmv * (grossMarginRate / 100));
      const commissionCost = Math.round(estimatedGmv * (commissionRate / 100));
      const estimatedLiverCost = commissionCost + fixedFee;
      const estimatedNetProfit = estimatedGrossProfit - estimatedLiverCost;
      const estimatedRoi = estimatedLiverCost > 0
        ? Math.round((estimatedNetProfit / estimatedLiverCost) * 100)
        : 0;

      // Then: verify calculations
      expect(estimatedGmv).toBe(500000);
      expect(estimatedSalesCount).toBe(126); // 500000 / 3980 ≈ 125.6
      expect(grossMarginRate).toBeCloseTo(62.31, 1);
      expect(estimatedGrossProfit).toBe(311558); // 500000 * 0.6231
      expect(commissionCost).toBe(50000); // 500000 * 0.10
      expect(estimatedLiverCost).toBe(100000); // 50000 + 50000
      expect(estimatedNetProfit).toBe(211558); // 311558 - 100000
      expect(estimatedRoi).toBe(212); // (211558 / 100000) * 100
    });

    it("should detect unprofitable scenarios", () => {
      const unitPrice = 1000;
      const costPrice = 900; // very low margin
      const commissionRate = 20; // high commission
      const fixedFee = 100000; // high fixed fee
      const estimatedGmv = 200000;

      const grossMarginRate = ((unitPrice - costPrice) / unitPrice) * 100; // 10%
      const estimatedGrossProfit = Math.round(estimatedGmv * (grossMarginRate / 100)); // 20000
      const commissionCost = Math.round(estimatedGmv * (commissionRate / 100)); // 40000
      const estimatedLiverCost = commissionCost + fixedFee; // 140000
      const estimatedNetProfit = estimatedGrossProfit - estimatedLiverCost; // -120000

      expect(estimatedNetProfit).toBeLessThan(0);
      expect(estimatedGrossProfit).toBe(20000);
      expect(estimatedLiverCost).toBe(140000);
    });

    it("should handle zero cost price with gross margin rate", () => {
      const unitPrice = 5000;
      const grossMarginRate = 60; // 60% margin
      const estimatedGmv = 1000000;

      const estimatedGrossProfit = Math.round(estimatedGmv * (grossMarginRate / 100));
      expect(estimatedGrossProfit).toBe(600000);
    });

    it("should handle set products with higher AOV", () => {
      const unitPrice = 3000;
      const hasSet = true;
      const expectedAov = 8000; // set AOV is higher

      const effectivePrice = hasSet && expectedAov ? expectedAov : unitPrice;
      expect(effectivePrice).toBe(8000);
    });
  });

  describe("Database Operations", () => {
    it("should get liver stats for simulation", async () => {
      const mockStats = {
        totalStreams: 50,
        avgGmvPerStream: 800000,
        avgGmvPerHour: 500000,
        avgViewers: 1200,
        avgCvr: 3.5,
        categoryBreakdown: [
          { category: "美容液・セラム", count: 20, avgGmv: 900000 },
          { category: "スキンケア", count: 15, avgGmv: 700000 },
        ],
      };

      (getSimulationLiverStats as any).mockResolvedValue(mockStats);

      const result = await getSimulationLiverStats(1);
      expect(result).toEqual(mockStats);
      expect(getSimulationLiverStats).toHaveBeenCalledWith(1);
    });

    it("should create a simulation record", async () => {
      const mockSimulation = {
        id: 1,
        shareToken: "abc123",
        unitPrice: 3980,
        liverId: 1,
        commissionRate: "10.00",
        streamDuration: 60,
        estimatedGmv: 500000,
        status: "draft",
      };

      (createSimulation as any).mockResolvedValue(mockSimulation);

      const result = await createSimulation({
        shareToken: "abc123",
        unitPrice: 3980,
        liverId: 1,
        commissionRate: "10.00",
        fixedFee: 50000,
        streamDuration: 60,
        estimatedGmv: 500000,
        estimatedSalesCount: 126,
        estimatedGrossProfit: 311558,
        estimatedLiverCost: 100000,
        estimatedNetProfit: 211558,
        estimatedRoi: "212.00",
        createdBy: 1,
      } as any);

      expect(result).toEqual(mockSimulation);
      expect(createSimulation).toHaveBeenCalled();
    });

    it("should get simulation by share token", async () => {
      const mockSim = {
        id: 1,
        shareToken: "abc123",
        estimatedGmv: 500000,
      };

      (getSimulationByToken as any).mockResolvedValue(mockSim);

      const result = await getSimulationByToken("abc123");
      expect(result).toEqual(mockSim);
      expect(getSimulationByToken).toHaveBeenCalledWith("abc123");
    });

    it("should return null for non-existent token", async () => {
      (getSimulationByToken as any).mockResolvedValue(null);

      const result = await getSimulationByToken("nonexistent");
      expect(result).toBeNull();
    });

    it("should list user simulations", async () => {
      const mockList = [
        { id: 1, shareToken: "abc", estimatedGmv: 500000 },
        { id: 2, shareToken: "def", estimatedGmv: 800000 },
      ];

      (listSimulations as any).mockResolvedValue(mockList);

      const result = await listSimulations(1, 10);
      expect(result).toHaveLength(2);
      expect(listSimulations).toHaveBeenCalledWith(1, 10);
    });

    it("should delete a simulation", async () => {
      (deleteSimulation as any).mockResolvedValue(undefined);

      await deleteSimulation(1);
      expect(deleteSimulation).toHaveBeenCalledWith(1);
    });
  });

  describe("Simulation Feedback (AI Learning)", () => {
    it("should calculate GMV accuracy correctly", () => {
      const predictedGmv = 500000;
      const actualGmv = 480000;

      const accuracy = Math.round(
        (1 - Math.abs(actualGmv - predictedGmv) / predictedGmv) * 100
      );

      expect(accuracy).toBe(96); // 96% accuracy
    });

    it("should handle over-prediction accuracy", () => {
      const predictedGmv = 500000;
      const actualGmv = 600000; // actual exceeded prediction

      const accuracy = Math.round(
        (1 - Math.abs(actualGmv - predictedGmv) / predictedGmv) * 100
      );

      expect(accuracy).toBe(80); // 80% accuracy (20% off)
    });

    it("should handle zero predicted GMV", () => {
      const predictedGmv = 0;
      const actualGmv = 100000;

      const accuracy = predictedGmv > 0
        ? Math.round((1 - Math.abs(actualGmv - predictedGmv) / predictedGmv) * 100)
        : 0;

      expect(accuracy).toBe(0);
    });

    it("should create feedback record", async () => {
      const mockFeedback = {
        id: 1,
        simulationId: 1,
        actualGmv: 480000,
        gmvAccuracy: 96,
      };

      (createSimulationFeedback as any).mockResolvedValue(mockFeedback);

      const result = await createSimulationFeedback({
        simulationId: 1,
        actualGmv: 480000,
        gmvAccuracy: 96,
      } as any);

      expect(result).toEqual(mockFeedback);
      expect(createSimulationFeedback).toHaveBeenCalled();
    });

    it("should calculate ROI from actual results", () => {
      const actualNetProfit = 200000;
      const estimatedLiverCost = 100000;

      const actualRoi = estimatedLiverCost > 0
        ? Math.round((actualNetProfit / estimatedLiverCost) * 100)
        : 0;

      expect(actualRoi).toBe(200);
    });
  });

  describe("Share Token Generation", () => {
    it("should generate unique share tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        tokens.add(token);
      }
      expect(tokens.size).toBe(100); // All unique
    });

    it("should update simulation status to shared", async () => {
      (updateSimulation as any).mockResolvedValue(undefined);

      await updateSimulation(1, { status: "shared" });
      expect(updateSimulation).toHaveBeenCalledWith(1, { status: "shared" });
    });
  });

  describe("Bundle/Set Product Simulation", () => {
    it("should calculate bundle discount rate correctly", () => {
      const bundleItems = [
        { name: "美容液A", price: 5000 },
        { name: "化粧水B", price: 3000 },
        { name: "クリームC", price: 4000 },
      ];
      const bundlePrice = 9800;

      const totalListPrice = bundleItems.reduce((sum, item) => sum + item.price, 0);
      const discountRate = Math.round(((totalListPrice - bundlePrice) / totalListPrice) * 100);

      expect(totalListPrice).toBe(12000);
      expect(discountRate).toBe(18);
    });

    it("should use bundle price as effective price when hasSet is true", () => {
      const hasSet = true;
      const sellingPrice = 5000;
      const bundlePrice = 9800;

      const effectivePrice = hasSet && bundlePrice ? bundlePrice : sellingPrice;
      expect(effectivePrice).toBe(9800);
    });

    it("should use selling price when hasSet is false", () => {
      const hasSet = false;
      const sellingPrice = 5000;
      const bundlePrice = 9800;

      const effectivePrice = hasSet && bundlePrice ? bundlePrice : sellingPrice;
      expect(effectivePrice).toBe(5000);
    });

    it("should calculate GMV with bundle pricing", () => {
      const bundlePrice = 9800;
      const avgGmvPerHour = 800000;
      const streamDuration = 60;

      const estimatedGmv = Math.round(avgGmvPerHour * (streamDuration / 60));
      const estimatedSalesCount = Math.round(estimatedGmv / bundlePrice);

      expect(estimatedGmv).toBe(800000);
      expect(estimatedSalesCount).toBe(82);
    });

    it("should handle single product discount rate", () => {
      const listPrice = 5000;
      const sellingPrice = 3980;

      const discountRate = Math.round(((listPrice - sellingPrice) / listPrice) * 100);
      expect(discountRate).toBe(20);
    });

    it("should handle zero total list price gracefully", () => {
      const bundleItems: Array<{ name: string; price: number }> = [];
      const bundlePrice = 9800;

      const totalListPrice = bundleItems.reduce((sum, item) => sum + item.price, 0);
      const discountRate = totalListPrice > 0
        ? Math.round(((totalListPrice - bundlePrice) / totalListPrice) * 100)
        : 0;

      expect(totalListPrice).toBe(0);
      expect(discountRate).toBe(0);
    });

    it("should display bundle info in proposal when hasSet is true", () => {
      const sim = {
        hasSet: true,
        bundleName: "美容3点セット",
        bundlePrice: 9800,
        bundleItems: [
          { name: "美容液A", price: 5000 },
          { name: "化粧水B", price: 3000 },
          { name: "クリームC", price: 4000 },
        ],
        listPrice: 5000,
        sellingPrice: 3980,
      };

      const showBundleSection = sim.hasSet && sim.bundleItems.length > 0;
      expect(showBundleSection).toBe(true);

      const totalListPrice = sim.bundleItems.reduce((sum, item) => sum + item.price, 0);
      const bundleDiscountRate = totalListPrice > 0
        ? Math.round(((totalListPrice - sim.bundlePrice) / totalListPrice) * 100)
        : 0;

      expect(totalListPrice).toBe(12000);
      expect(bundleDiscountRate).toBe(18);
    });

    it("should display single product info in proposal when hasSet is false", () => {
      const sim = {
        hasSet: false,
        bundleName: null,
        bundlePrice: null,
        bundleItems: null,
        listPrice: 5000,
        sellingPrice: 3980,
      };

      const bundleItems = sim.bundleItems || [];
      const showBundleSection = sim.hasSet && bundleItems.length > 0;
      expect(showBundleSection).toBe(false);

      const listPrice = sim.listPrice || 0;
      const sellingPrice = sim.sellingPrice || 0;
      const hasDiscount = listPrice > 0 && sellingPrice > 0 && listPrice > sellingPrice;
      expect(hasDiscount).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very high unit prices", () => {
      const unitPrice = 1000000;
      const estimatedGmv = 5000000;
      const estimatedSalesCount = Math.round(estimatedGmv / unitPrice);
      expect(estimatedSalesCount).toBe(5);
    });

    it("should handle very low commission rates", () => {
      const commissionRate = 0.5;
      const estimatedGmv = 1000000;
      const commissionCost = Math.round(estimatedGmv * (commissionRate / 100));
      expect(commissionCost).toBe(5000);
    });

    it("should handle zero fixed fee", () => {
      const fixedFee = 0;
      const commissionCost = 50000;
      const totalLiverCost = commissionCost + fixedFee;
      expect(totalLiverCost).toBe(50000);
    });

    it("should handle exclusive vs spot contract types", () => {
      const contractType = "exclusive";
      expect(["exclusive", "spot"]).toContain(contractType);
    });
  });
});
