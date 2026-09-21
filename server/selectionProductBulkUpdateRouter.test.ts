import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bulkUpdate: vi.fn(async () => ({ success: true, affectedCount: 2, idempotent: false })),
  listIds: vi.fn(async () => [10, 11]),
  ensureSchema: vi.fn(async () => undefined),
  requireAccess: vi.fn(async (_user: unknown, _mode: "view" | "edit") => ({ canView: true, canEdit: true, isAdmin: false })),
}));

vi.mock("./selectionProductBulkUpdate", () => ({
  bulkUpdateSelectionProducts: mocks.bulkUpdate,
  hasAtMostTwoDecimalPlaces: (value: number) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
  listSelectionProductIds: mocks.listIds,
  MAX_SELECTION_PRODUCT_BULK_UPDATE: 2000,
}));
vi.mock("./selectionCenterAccess", () => ({ requireSelectionCenterAccess: mocks.requireAccess }));
vi.mock("./selectionProductPersistence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./selectionProductPersistence")>()),
  ensureSelectionProductPersistenceSchema: mocks.ensureSchema,
}));

import { selectionCenterRouter } from "./selectionCenterRouter";

function context(user: null | { id: number; role: "user" | "admin" }) {
  return {
    user: user ? {
      id: user.id,
      openId: `selection-user-${user.id}`,
      email: `selection-${user.id}@example.invalid`,
      name: "Selection User",
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

const bulkInput = {
  requestId: "00000000-0000-4000-8000-000000000011",
  productIds: [10, 11],
  patch: {
    price: 800,
    historicalLowestPrice: 700,
    stock: 20,
    commission: { type: "percentage" as const, value: 15 },
    status: "online" as const,
  },
};

describe("selection product bulk update router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAccess.mockResolvedValue({ canView: true, canEdit: true, isAdmin: false });
  });

  it("rejects unauthenticated bulk selection and updates before authorization or DB work", async () => {
    const caller = selectionCenterRouter.createCaller(context(null));
    await expect(caller.getProductIdsForBulkSelection({ search: "miavie" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.bulkUpdateProducts({ ...bulkInput, requestId: "00000000-0000-4000-8000-000000000010" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.requireAccess).not.toHaveBeenCalled();
    expect(mocks.listIds).not.toHaveBeenCalled();
    expect(mocks.bulkUpdate).not.toHaveBeenCalled();
  });

  it("allows a view-only role to select matching IDs but rejects batch updates", async () => {
    mocks.requireAccess.mockImplementation(async (_user, mode) => {
      if (mode === "edit") throw new TRPCError({ code: "FORBIDDEN", message: "edit denied" });
      return { canView: true, canEdit: false, isAdmin: false };
    });
    const caller = selectionCenterRouter.createCaller(context({ id: 42, role: "user" }));
    await expect(caller.getProductIdsForBulkSelection({ search: "miavie", status: "online", brandName: "MIAVIE" }))
      .resolves.toEqual({ ids: [10, 11], total: 2, max: 2000 });
    await expect(caller.bulkUpdateProducts(bulkInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.updateProduct({ id: 10, price: "1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.bulkUpdateBrandStatus({ brandName: "MIAVIE", status: "offline" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listIds).toHaveBeenCalledTimes(1);
    expect(mocks.bulkUpdate).not.toHaveBeenCalled();
  });

  it("rejects a role without view permission before listing IDs", async () => {
    mocks.requireAccess.mockRejectedValue(new TRPCError({ code: "FORBIDDEN", message: "view denied" }));
    const caller = selectionCenterRouter.createCaller(context({ id: 43, role: "user" }));
    await expect(caller.getProductIdsForBulkSelection({ search: "miavie" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.getProducts({ page: 1, pageSize: 20 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listIds).not.toHaveBeenCalled();
  });

  it("allows an editable custom role and forwards validated patch plus actor ID", async () => {
    const caller = selectionCenterRouter.createCaller(context({ id: 42, role: "user" }));
    await expect(caller.bulkUpdateProducts(bulkInput)).resolves.toMatchObject({ affectedCount: 2 });
    expect(mocks.requireAccess).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }), "edit", null);
    expect(mocks.bulkUpdate).toHaveBeenCalledWith(null, bulkInput, 42);
    expect(mocks.ensureSchema).toHaveBeenCalledWith(null);
  });

  it("allows a technical admin through the same server authorization boundary", async () => {
    mocks.requireAccess.mockResolvedValue({ canView: true, canEdit: true, isAdmin: true });
    const caller = selectionCenterRouter.createCaller(context({ id: 1, role: "admin" }));
    await expect(caller.bulkUpdateProducts({ ...bulkInput, requestId: "00000000-0000-4000-8000-000000000014" }))
      .resolves.toMatchObject({ affectedCount: 2 });
    expect(mocks.requireAccess).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }), "edit", null);
  });

  it("rejects empty, excessive percentage, and sub-cent patches before authorization or service calls", async () => {
    const caller = selectionCenterRouter.createCaller(context({ id: 42, role: "admin" }));
    await expect(caller.bulkUpdateProducts({ ...bulkInput, requestId: "00000000-0000-4000-8000-000000000012", patch: {} }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.bulkUpdateProducts({ ...bulkInput, requestId: "00000000-0000-4000-8000-000000000013", patch: { commission: { type: "percentage", value: 101 } } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.bulkUpdateProducts({ ...bulkInput, requestId: "00000000-0000-4000-8000-000000000015", patch: { price: 1.999 } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.requireAccess).toHaveBeenCalledTimes(3);
    expect(mocks.bulkUpdate).not.toHaveBeenCalled();
  });
});
