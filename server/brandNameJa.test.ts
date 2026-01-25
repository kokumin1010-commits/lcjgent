import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  createBrand: vi.fn(),
  getBrandById: vi.fn(),
  updateBrand: vi.fn(),
  getAllBrands: vi.fn(),
  createActivityLog: vi.fn(),
}));

import {
  createBrand,
  getBrandById,
  updateBrand,
  getAllBrands,
  createActivityLog,
} from "./db";

describe("Brand nameJa (Japanese Pronunciation) Field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBrand with nameJa", () => {
    it("should create a brand with nameJa field", async () => {
      const mockBrand = {
        id: 1,
        name: "小红书",
        nameJa: "シャオホンシュー",
        companyName: "Test Company",
        status: "進行中" as const,
        createdBy: 1,
      };

      (createBrand as any).mockResolvedValue(mockBrand);

      const result = await createBrand({
        name: "小红书",
        nameJa: "シャオホンシュー",
        companyName: "Test Company",
        status: "進行中",
        createdBy: 1,
      });

      expect(result).toEqual(mockBrand);
      expect(result.nameJa).toBe("シャオホンシュー");
      expect(createBrand).toHaveBeenCalledTimes(1);
    });

    it("should create a brand with Chinese brand name and Japanese pronunciation", async () => {
      const mockBrand = {
        id: 2,
        name: "参半",
        nameJa: "サンバン",
        status: "契約済み" as const,
        createdBy: 1,
      };

      (createBrand as any).mockResolvedValue(mockBrand);

      const result = await createBrand({
        name: "参半",
        nameJa: "サンバン",
        status: "契約済み",
        createdBy: 1,
      });

      expect(result.name).toBe("参半");
      expect(result.nameJa).toBe("サンバン");
    });

    it("should create a brand with English brand name and Japanese pronunciation", async () => {
      const mockBrand = {
        id: 3,
        name: "KYOGOKU",
        nameJa: "キョウゴク",
        status: "進行中" as const,
        createdBy: 1,
      };

      (createBrand as any).mockResolvedValue(mockBrand);

      const result = await createBrand({
        name: "KYOGOKU",
        nameJa: "キョウゴク",
        status: "進行中",
        createdBy: 1,
      });

      expect(result.name).toBe("KYOGOKU");
      expect(result.nameJa).toBe("キョウゴク");
    });
  });

  describe("getBrandById with nameJa", () => {
    it("should return brand with nameJa field", async () => {
      const mockBrand = {
        id: 1,
        name: "Mistine",
        nameJa: "ミスティーン",
        companyName: "杭州栢特薇",
        status: "契約済み",
      };

      (getBrandById as any).mockResolvedValue(mockBrand);

      const result = await getBrandById(1);

      expect(result).toEqual(mockBrand);
      expect(result.nameJa).toBe("ミスティーン");
    });

    it("should handle brand without nameJa (legacy data)", async () => {
      const mockBrand = {
        id: 2,
        name: "Legacy Brand",
        nameJa: null,
        status: "進行中",
      };

      (getBrandById as any).mockResolvedValue(mockBrand);

      const result = await getBrandById(2);

      expect(result.nameJa).toBeNull();
    });
  });

  describe("updateBrand nameJa", () => {
    it("should update nameJa field", async () => {
      (updateBrand as any).mockResolvedValue(undefined);

      await updateBrand(1, { nameJa: "ニューヨミ" });

      expect(updateBrand).toHaveBeenCalledWith(1, { nameJa: "ニューヨミ" });
    });

    it("should update both name and nameJa", async () => {
      (updateBrand as any).mockResolvedValue(undefined);

      await updateBrand(1, {
        name: "New Brand Name",
        nameJa: "ニューブランドネーム",
      });

      expect(updateBrand).toHaveBeenCalledWith(1, {
        name: "New Brand Name",
        nameJa: "ニューブランドネーム",
      });
    });
  });

  describe("getAllBrands with nameJa", () => {
    it("should return all brands with nameJa field", async () => {
      const mockBrands = [
        { id: 1, name: "小红书", nameJa: "シャオホンシュー", status: "進行中" },
        { id: 2, name: "参半", nameJa: "サンバン", status: "契約済み" },
        { id: 3, name: "KYOGOKU", nameJa: "キョウゴク", status: "進行中" },
      ];

      (getAllBrands as any).mockResolvedValue(mockBrands);

      const result = await getAllBrands();

      expect(result).toHaveLength(3);
      expect(result[0].nameJa).toBe("シャオホンシュー");
      expect(result[1].nameJa).toBe("サンバン");
      expect(result[2].nameJa).toBe("キョウゴク");
    });
  });

  describe("nameJa for live streaming use cases", () => {
    it("should support hiragana pronunciation", async () => {
      const mockBrand = {
        id: 1,
        name: "方里",
        nameJa: "ほうり",
        status: "契約済み" as const,
        createdBy: 1,
      };

      (createBrand as any).mockResolvedValue(mockBrand);

      const result = await createBrand({
        name: "方里",
        nameJa: "ほうり",
        status: "契約済み",
        createdBy: 1,
      });

      expect(result.nameJa).toBe("ほうり");
    });

    it("should support katakana pronunciation", async () => {
      const mockBrand = {
        id: 2,
        name: "RENOVATIO",
        nameJa: "レノバティオ",
        status: "契約済み" as const,
        createdBy: 1,
      };

      (createBrand as any).mockResolvedValue(mockBrand);

      const result = await createBrand({
        name: "RENOVATIO",
        nameJa: "レノバティオ",
        status: "契約済み",
        createdBy: 1,
      });

      expect(result.nameJa).toBe("レノバティオ");
    });

    it("should support mixed pronunciation with spaces", async () => {
      const mockBrand = {
        id: 3,
        name: "I'm La Floria",
        nameJa: "アイム ラ フローリア",
        status: "契約済み" as const,
        createdBy: 1,
      };

      (createBrand as any).mockResolvedValue(mockBrand);

      const result = await createBrand({
        name: "I'm La Floria",
        nameJa: "アイム ラ フローリア",
        status: "契約済み",
        createdBy: 1,
      });

      expect(result.nameJa).toBe("アイム ラ フローリア");
    });
  });
});
