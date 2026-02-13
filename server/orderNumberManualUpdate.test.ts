import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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
      headers: { origin: "https://test.example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
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
      headers: { origin: "https://test.example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("adminUpdateLineReceiptOrderNumber", () => {
  it("should reject non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.point.adminUpdateLineReceiptOrderNumber({
        id: 1,
        orderNumber: "12345",
      })
    ).rejects.toThrow("管理者権限が必要です");
  });

  it("should reject empty order number", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.point.adminUpdateLineReceiptOrderNumber({
        id: 1,
        orderNumber: "",
      })
    ).rejects.toThrow();
  });

  it("should have the procedure defined in the router", () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.point.adminUpdateLineReceiptOrderNumber).toBeDefined();
  });
});

describe("Order number display logic", () => {
  it("should extract order number from ocrRawText JSON", () => {
    const getOrderNumber = (receipt: { ocrRawText?: string | null }): string | null => {
      try {
        if (receipt.ocrRawText) {
          const data = typeof receipt.ocrRawText === "string" ? JSON.parse(receipt.ocrRawText) : receipt.ocrRawText;
          return data.orderNumber || null;
        }
      } catch {
        return null;
      }
      return null;
    };

    expect(getOrderNumber({ ocrRawText: JSON.stringify({ orderNumber: "581900058582287971" }) }))
      .toBe("581900058582287971");
    expect(getOrderNumber({ ocrRawText: JSON.stringify({ shopName: "Test Shop" }) }))
      .toBeNull();
    expect(getOrderNumber({ ocrRawText: null }))
      .toBeNull();
    expect(getOrderNumber({ ocrRawText: "not-json" }))
      .toBeNull();
    expect(getOrderNumber({ ocrRawText: "" }))
      .toBeNull();
  });

  it("should update order number in existing ocrRawText JSON", () => {
    const updateOrderNumber = (existingOcrRawText: string | null, newOrderNumber: string): string => {
      let ocrData: any = {};
      if (existingOcrRawText) {
        try {
          ocrData = JSON.parse(existingOcrRawText);
        } catch {
          ocrData = {};
        }
      }
      ocrData.orderNumber = newOrderNumber;
      return JSON.stringify(ocrData);
    };

    const existing = JSON.stringify({ shopName: "Test Shop", totalAmount: 2832 });
    const updated = updateOrderNumber(existing, "581900058582287971");
    const parsed = JSON.parse(updated);
    expect(parsed.orderNumber).toBe("581900058582287971");
    expect(parsed.shopName).toBe("Test Shop");
    expect(parsed.totalAmount).toBe(2832);

    const fromNull = updateOrderNumber(null, "12345");
    expect(JSON.parse(fromNull).orderNumber).toBe("12345");

    const fromInvalid = updateOrderNumber("not-json", "67890");
    expect(JSON.parse(fromInvalid).orderNumber).toBe("67890");
  });
});
