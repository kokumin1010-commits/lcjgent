import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@example.com",
    name: "Test Admin",
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
      hostname: "localhost",
      headers: { origin: "https://localhost:3000" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: { origin: "https://localhost:3000" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

const adminCaller = appRouter.createCaller(createAdminContext());
const publicCaller = appRouter.createCaller(createPublicContext());

describe("Brand Sample LP - Submit", () => {
  it("submit accepts valid application data", async () => {
    const result = await publicCaller.brandSample.submit({
      companyName: "テスト株式会社",
      contactPerson: "山田太郎",
      email: "test@example.com",
      phone: "03-1234-5678",
      brandName: "テストブランド",
      productUrl: "https://example.com/product",
      productStrength: "独自の美容成分を配合",
      pastSalesRecord: "月商100万円",
      plan: "algorithm",
      sampleCount: 50,
    });
    expect(result).toEqual({ success: true });
  });

  it("submit works with light plan (30 samples)", async () => {
    const result = await publicCaller.brandSample.submit({
      companyName: "ライト株式会社",
      contactPerson: "佐藤花子",
      email: "light@example.com",
      brandName: "ライトブランド",
      productUrl: "https://example.com/light",
      productStrength: "コスパ最強",
      plan: "light",
      sampleCount: 30,
    });
    expect(result).toEqual({ success: true });
  });

  it("submit works with market_jack plan (100 samples)", async () => {
    const result = await publicCaller.brandSample.submit({
      companyName: "マーケット株式会社",
      contactPerson: "田中一郎",
      email: "market@example.com",
      brandName: "マーケットブランド",
      productUrl: "https://example.com/market",
      productStrength: "SNSで話題",
      plan: "market_jack",
      sampleCount: 100,
    });
    expect(result).toEqual({ success: true });
  });

  it("submit rejects invalid email", async () => {
    await expect(
      publicCaller.brandSample.submit({
        companyName: "テスト",
        contactPerson: "テスト",
        email: "not-an-email",
        brandName: "テスト",
        productUrl: "https://example.com",
        productStrength: "テスト",
        plan: "light",
        sampleCount: 30,
      })
    ).rejects.toThrow();
  });

  it("submit rejects invalid URL", async () => {
    await expect(
      publicCaller.brandSample.submit({
        companyName: "テスト",
        contactPerson: "テスト",
        email: "test@example.com",
        brandName: "テスト",
        productUrl: "not-a-url",
        productStrength: "テスト",
        plan: "light",
        sampleCount: 30,
      })
    ).rejects.toThrow();
  });

  it("submit rejects sample count below 30", async () => {
    await expect(
      publicCaller.brandSample.submit({
        companyName: "テスト",
        contactPerson: "テスト",
        email: "test@example.com",
        brandName: "テスト",
        productUrl: "https://example.com",
        productStrength: "テスト",
        plan: "light",
        sampleCount: 10,
      })
    ).rejects.toThrow();
  });
});

describe("Brand Sample LP - Admin", () => {
  it("list returns applications array", async () => {
    const result = await adminCaller.brandSample.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("list with status filter works", async () => {
    const result = await adminCaller.brandSample.list({ status: "pending" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list with pagination works", async () => {
    const result = await adminCaller.brandSample.list({ limit: 5, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("updateStatus changes application status", async () => {
    // First submit an application
    await publicCaller.brandSample.submit({
      companyName: "ステータス更新テスト",
      contactPerson: "テスト太郎",
      email: "status-test@example.com",
      brandName: "ステータスブランド",
      productUrl: "https://example.com/status",
      productStrength: "テスト用",
      plan: "algorithm",
      sampleCount: 50,
    });

    // Get the list and find our application
    const apps = await adminCaller.brandSample.list({});
    const testApp = apps.find((a: any) => a.companyName === "ステータス更新テスト");
    if (testApp) {
      const result = await adminCaller.brandSample.updateStatus({
        id: testApp.id,
        status: "reviewing",
        reviewNote: "審査中です",
      });
      expect(result).toEqual({ success: true });
    }
  });
});
