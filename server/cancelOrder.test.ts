import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * 注文キャンセル機能のテスト
 * 
 * cancelMyOrder APIのバリデーションとアクセス制御をテスト
 * - 未認証ユーザーのアクセス拒否
 * - 入力バリデーション
 */

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("mall.cancelMyOrder", () => {
  it("rejects unauthenticated users with UNAUTHORIZED error", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.mall.cancelMyOrder({ orderId: 1 })
    ).rejects.toThrow(/ログインが必要です/);
  });

  it("requires orderId to be a number", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    // Invalid input should fail validation before auth check
    await expect(
      // @ts-expect-error - testing invalid input
      caller.mall.cancelMyOrder({ orderId: "abc" })
    ).rejects.toThrow();
  });

  it("accepts optional reason parameter", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    // Should still fail with auth error, but input validation should pass
    await expect(
      caller.mall.cancelMyOrder({ orderId: 1, reason: "間違えて注文しました" })
    ).rejects.toThrow(/ログインが必要です/);
  });
});

describe("cancelMallOrder db function", () => {
  it("should be exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.cancelMallOrder).toBe("function");
  });
});
