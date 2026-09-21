import { describe, expect, it, vi } from "vitest";
import { requireSelectionCenterAccess, resolveSelectionCenterAccess } from "./selectionCenterAccess";

function pool(row: Record<string, unknown>) {
  return { query: vi.fn(async () => [[row], []]) } as any;
}

describe("selection center access", () => {
  it("grants technical admins without a permission lookup", async () => {
    const connection = pool({});
    await expect(resolveSelectionCenterAccess({ id: 1, role: "admin" }, connection))
      .resolves.toEqual({ canView: true, canEdit: true, isAdmin: true });
    expect(connection.query).not.toHaveBeenCalled();
  });

  it("grants a system role full access", async () => {
    await expect(resolveSelectionCenterAccess({ id: 2, role: "user" }, pool({ isSystemAdmin: 1, canView: 0, canEdit: 0 })))
      .resolves.toEqual({ canView: true, canEdit: true, isAdmin: true });
  });

  it("distinguishes editable, read-only, and denied custom roles", async () => {
    await expect(resolveSelectionCenterAccess({ id: 3, role: "user" }, pool({ isSystemAdmin: 0, canView: 1, canEdit: 1 })))
      .resolves.toEqual({ canView: true, canEdit: true, isAdmin: false });
    await expect(resolveSelectionCenterAccess({ id: 4, role: "user" }, pool({ isSystemAdmin: 0, canView: 1, canEdit: 0 })))
      .resolves.toEqual({ canView: true, canEdit: false, isAdmin: false });
    await expect(resolveSelectionCenterAccess({ id: 5, role: "user" }, pool({ isSystemAdmin: 0, canView: 0, canEdit: 0 })))
      .resolves.toEqual({ canView: false, canEdit: false, isAdmin: false });
  });

  it("rejects view and edit operations when the matching permission is absent", async () => {
    await expect(requireSelectionCenterAccess({ id: 6, role: "user" }, "view", pool({ canView: 0, canEdit: 0 })))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireSelectionCenterAccess({ id: 7, role: "user" }, "edit", pool({ canView: 1, canEdit: 0 })))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
