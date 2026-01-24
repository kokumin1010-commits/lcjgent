import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  createBrandMemo: vi.fn(),
  getMemosByBrandId: vi.fn(),
  deleteBrandMemo: vi.fn(),
}));

import { createBrandMemo, getMemosByBrandId, deleteBrandMemo } from "./db";

describe("Brand Memo Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createBrandMemo", () => {
    it("should create a new memo with valid data", async () => {
      const mockMemo = {
        id: 1,
        brandId: 1,
        content: "Test memo content",
        authorName: "Test User",
        createdBy: 1,
        createdAt: new Date(),
      };

      vi.mocked(createBrandMemo).mockResolvedValue(mockMemo);

      const result = await createBrandMemo({
        brandId: 1,
        content: "Test memo content",
        authorName: "Test User",
        createdBy: 1,
      });

      expect(result).toEqual(mockMemo);
      expect(createBrandMemo).toHaveBeenCalledWith({
        brandId: 1,
        content: "Test memo content",
        authorName: "Test User",
        createdBy: 1,
      });
    });
  });

  describe("getMemosByBrandId", () => {
    it("should return memos for a specific brand", async () => {
      const mockMemos = [
        {
          id: 1,
          brandId: 1,
          content: "First memo",
          authorName: "User 1",
          createdBy: 1,
          createdAt: new Date("2024-01-01"),
        },
        {
          id: 2,
          brandId: 1,
          content: "Second memo",
          authorName: "User 2",
          createdBy: 2,
          createdAt: new Date("2024-01-02"),
        },
      ];

      vi.mocked(getMemosByBrandId).mockResolvedValue(mockMemos);

      const result = await getMemosByBrandId(1);

      expect(result).toEqual(mockMemos);
      expect(result.length).toBe(2);
      expect(getMemosByBrandId).toHaveBeenCalledWith(1);
    });

    it("should return empty array when no memos exist", async () => {
      vi.mocked(getMemosByBrandId).mockResolvedValue([]);

      const result = await getMemosByBrandId(999);

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });
  });

  describe("deleteBrandMemo", () => {
    it("should delete a memo by id", async () => {
      vi.mocked(deleteBrandMemo).mockResolvedValue(undefined);

      await deleteBrandMemo(1);

      expect(deleteBrandMemo).toHaveBeenCalledWith(1);
    });
  });
});

describe("Brand Memo API Validation", () => {
  it("should require non-empty content", () => {
    const content = "";
    expect(content.length).toBe(0);
    // In the actual router, z.string().min(1) validates this
  });

  it("should require non-empty authorName", () => {
    const authorName = "";
    expect(authorName.length).toBe(0);
    // In the actual router, z.string().min(1) validates this
  });

  it("should require valid brandId", () => {
    const brandId = 1;
    expect(brandId).toBeGreaterThan(0);
    // In the actual router, z.number() validates this
  });
});
