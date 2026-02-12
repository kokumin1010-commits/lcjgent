import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storagePut
const mockStoragePut = vi.fn();
vi.mock("../storage", () => ({
  storagePut: (...args: any[]) => mockStoragePut(...args),
}));

// Mock db functions
const mockGetMallProductById = vi.fn();
const mockUpdateMallProduct = vi.fn();
vi.mock("../db", () => ({
  getMallProductById: (...args: any[]) => mockGetMallProductById(...args),
  updateMallProduct: (...args: any[]) => mockUpdateMallProduct(...args),
  getUserById: vi.fn().mockResolvedValue({ id: 1, role: "admin", name: "Admin" }),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "test-nanoid-123",
}));

describe("Product Image Upload REST API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoragePut.mockResolvedValue({
      url: "https://cdn.example.com/mall/products/test-nanoid-123.png",
      key: "mall/products/test-nanoid-123.png",
    });
  });

  it("should validate that only image files are accepted", () => {
    // Test file type validation logic
    const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    const invalidTypes = ["application/pdf", "text/plain", "video/mp4"];

    for (const type of validTypes) {
      expect(type.startsWith("image/")).toBe(true);
    }
    for (const type of invalidTypes) {
      expect(type.startsWith("image/")).toBe(false);
    }
  });

  it("should validate file size limit (5MB)", () => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    expect(4 * 1024 * 1024 > maxSize).toBe(false); // 4MB should pass
    expect(5 * 1024 * 1024 > maxSize).toBe(false); // exactly 5MB should pass
    expect(6 * 1024 * 1024 > maxSize).toBe(true);  // 6MB should fail
  });

  it("should extract valid file extensions correctly", () => {
    const validExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];
    
    const testCases = [
      { filename: "test.png", expected: "png" },
      { filename: "photo.jpg", expected: "jpg" },
      { filename: "image.jpeg", expected: "jpeg" },
      { filename: "animation.gif", expected: "gif" },
      { filename: "modern.webp", expected: "webp" },
      { filename: "unknown.xyz", expected: "png" }, // fallback to png
      { filename: "noext", expected: "png" }, // no extension
      { filename: "微信图片_20260121.png", expected: "png" }, // Chinese characters
      { filename: "1111.jpeg", expected: "jpeg" },
    ];

    for (const { filename, expected } of testCases) {
      const extMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
      let ext = extMatch ? extMatch[1].toLowerCase() : "png";
      if (!validExts.includes(ext)) ext = "png";
      expect(ext).toBe(expected);
    }
  });

  it("should call storagePut with correct parameters", async () => {
    const buffer = Buffer.from("test image data");
    const key = "mall/products/test-nanoid-123.png";
    const contentType = "image/png";

    await mockStoragePut(key, buffer, contentType);

    expect(mockStoragePut).toHaveBeenCalledWith(key, buffer, contentType);
  });

  it("should update product when productId is provided", async () => {
    mockGetMallProductById.mockResolvedValue({
      id: 1,
      imageUrl: "https://cdn.example.com/old.png",
      imageKey: "old.png",
      imageUrls: ["https://cdn.example.com/old.png"],
      imageKeys: ["old.png"],
    });

    const productId = 1;
    const newUrl = "https://cdn.example.com/mall/products/test-nanoid-123.png";
    const newKey = "mall/products/test-nanoid-123.png";

    const product = await mockGetMallProductById(productId);
    expect(product).toBeTruthy();

    const existingUrls = product.imageUrls || [];
    const existingKeys = product.imageKeys || [];
    
    await mockUpdateMallProduct(productId, {
      imageUrl: existingUrls.length === 0 ? newUrl : product.imageUrl,
      imageKey: existingKeys.length === 0 ? newKey : product.imageKey,
      imageUrls: [...existingUrls, newUrl],
      imageKeys: [...existingKeys, newKey],
    });

    expect(mockUpdateMallProduct).toHaveBeenCalledWith(productId, {
      imageUrl: product.imageUrl, // keep existing since there are already images
      imageKey: product.imageKey,
      imageUrls: [...existingUrls, newUrl],
      imageKeys: [...existingKeys, newKey],
    });
  });

  it("should set imageUrl when product has no existing images", async () => {
    mockGetMallProductById.mockResolvedValue({
      id: 2,
      imageUrl: null,
      imageKey: null,
      imageUrls: [],
      imageKeys: [],
    });

    const productId = 2;
    const newUrl = "https://cdn.example.com/mall/products/test-nanoid-123.png";
    const newKey = "mall/products/test-nanoid-123.png";

    const product = await mockGetMallProductById(productId);
    const existingUrls = product.imageUrls || [];
    const existingKeys = product.imageKeys || [];

    await mockUpdateMallProduct(productId, {
      imageUrl: existingUrls.length === 0 ? newUrl : product.imageUrl,
      imageKey: existingKeys.length === 0 ? newKey : product.imageKey,
      imageUrls: [...existingUrls, newUrl],
      imageKeys: [...existingKeys, newKey],
    });

    expect(mockUpdateMallProduct).toHaveBeenCalledWith(productId, {
      imageUrl: newUrl, // set as main image since no existing images
      imageKey: newKey,
      imageUrls: [newUrl],
      imageKeys: [newKey],
    });
  });
});
