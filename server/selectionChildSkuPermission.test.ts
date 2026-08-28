import { describe, expect, it } from "vitest";
import { selectionCenterRouter } from "./selectionCenterRouter";

function context(user: null | { id: number; role: "user" | "admin" }) {
  return {
    user: user ? {
      id: user.id,
      openId: `child-sku-user-${user.id}`,
      email: `child-sku-${user.id}@example.invalid`,
      name: "Child SKU User",
      loginMethod: "test",
      role: user.role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { headers: {} },
    res: {},
  } as any;
}

const data = {
  name: "SKU",
  skuCode: "SKU-1",
  price: "1000",
  lowestPrice: "800",
  discountRate: "20",
  promotionType: "1+1",
  stock: 10,
  status: "online" as const,
};

describe("selection child SKU procedure permissions", () => {
  it("rejects unauthenticated entity child edits before database work", async () => {
    const caller = selectionCenterRouter.createCaller(context(null));
    await expect(caller.updateEntityChildSku({ childId: 2, expectedParentId: 1, data })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated embedded child edits and deletes before database work", async () => {
    const caller = selectionCenterRouter.createCaller(context(null));
    await expect(caller.updateEmbeddedChildSku({ parentId: 1, variantId: "variant-1", data })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.deleteEmbeddedChildSku({ parentId: 1, variantId: "variant-1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated parent unlink before database work", async () => {
    const caller = selectionCenterRouter.createCaller(context(null));
    await expect(caller.removeParentProduct({ childId: 2, expectedParentId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
