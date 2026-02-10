import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock storagePut
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockImplementation(async (key: string) => ({
    url: `https://cdn.example.com/${key}`,
    key,
  })),
}));

// Mock getMallProductById for the upload flow
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getMallProductById: vi.fn().mockResolvedValue({
      id: 1,
      name: "Test Product",
      imageUrl: null,
      imageKey: null,
      imageUrls: [],
      imageKeys: [],
    }),
    updateMallProduct: vi.fn().mockResolvedValue(undefined),
  };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "normal-user",
    email: "user@example.com",
    name: "Normal User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("mall.uploadProductImage", () => {
  it("uploads an image and returns url and key", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Small 1x1 transparent PNG as base64
    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

    const result = await caller.mall.uploadProductImage({
      base64,
      filename: "test.png",
    });

    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("key");
    expect(result.url).toContain("mall/products/");
    expect(result.key).toContain("mall/products/");
    expect(result.key).toMatch(/\.png$/);
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

    await expect(
      caller.mall.uploadProductImage({
        base64,
        filename: "test.png",
      })
    ).rejects.toThrow();
  });

  it("uploads image with productId and updates product imageUrls", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

    const result = await caller.mall.uploadProductImage({
      base64,
      filename: "product-image.jpg",
      productId: 1,
    });

    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("key");
    expect(result.key).toMatch(/\.jpg$/);
  });
});

describe("mall.updateProductImages", () => {
  it("updates product image order", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mall.updateProductImages({
      productId: 1,
      imageUrls: [
        "https://cdn.example.com/img2.png",
        "https://cdn.example.com/img1.png",
      ],
      imageKeys: [
        "mall/products/img2.png",
        "mall/products/img1.png",
      ],
    });

    expect(result).toEqual({ success: true });
  });

  it("clears all images when empty arrays are passed", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mall.updateProductImages({
      productId: 1,
      imageUrls: [],
      imageKeys: [],
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.mall.updateProductImages({
        productId: 1,
        imageUrls: ["https://cdn.example.com/img1.png"],
        imageKeys: ["mall/products/img1.png"],
      })
    ).rejects.toThrow();
  });
});
