import { describe, it, expect } from "vitest";

/**
 * LivestreamDetail canEdit logic test
 * 
 * The canEdit flag determines whether a user can edit a livestream detail.
 * canEdit = isAdmin || isOwnerLiver
 * 
 * - isAdmin: user?.role === "admin" (Manus OAuth user)
 * - isOwnerLiver: liverInfo.id === livestream.liverId (Liver auth user)
 */

describe("LivestreamDetail canEdit logic", () => {
  // Simulate the canEdit logic from LivestreamDetail.tsx
  function computeCanEdit(params: {
    user: { role: string } | null;
    liverInfo: { id: number } | null;
    livestream: { liverId: number | null } | null;
  }): { isAdmin: boolean; isOwnerLiver: boolean; canEdit: boolean } {
    const { user, liverInfo, livestream } = params;
    const isAdmin = user?.role === "admin";
    const isOwnerLiver = !!(liverInfo && livestream && livestream.liverId === liverInfo.id);
    const canEdit = isAdmin || isOwnerLiver;
    return { isAdmin: !!isAdmin, isOwnerLiver, canEdit };
  }

  it("admin user can always edit", () => {
    const result = computeCanEdit({
      user: { role: "admin" },
      liverInfo: null,
      livestream: { liverId: 5 },
    });
    expect(result.isAdmin).toBe(true);
    expect(result.canEdit).toBe(true);
  });

  it("liver who owns the livestream can edit", () => {
    const result = computeCanEdit({
      user: null, // ライバーはManus OAuthを使わない
      liverInfo: { id: 5 },
      livestream: { liverId: 5 },
    });
    expect(result.isAdmin).toBe(false);
    expect(result.isOwnerLiver).toBe(true);
    expect(result.canEdit).toBe(true);
  });

  it("liver who does NOT own the livestream cannot edit", () => {
    const result = computeCanEdit({
      user: null,
      liverInfo: { id: 3 },
      livestream: { liverId: 5 },
    });
    expect(result.isAdmin).toBe(false);
    expect(result.isOwnerLiver).toBe(false);
    expect(result.canEdit).toBe(false);
  });

  it("unauthenticated user cannot edit", () => {
    const result = computeCanEdit({
      user: null,
      liverInfo: null,
      livestream: { liverId: 5 },
    });
    expect(result.isAdmin).toBe(false);
    expect(result.isOwnerLiver).toBe(false);
    expect(result.canEdit).toBe(false);
  });

  it("regular (non-admin) Manus user cannot edit", () => {
    const result = computeCanEdit({
      user: { role: "user" },
      liverInfo: null,
      livestream: { liverId: 5 },
    });
    expect(result.isAdmin).toBe(false);
    expect(result.isOwnerLiver).toBe(false);
    expect(result.canEdit).toBe(false);
  });

  it("livestream with null liverId: liver cannot be owner", () => {
    const result = computeCanEdit({
      user: null,
      liverInfo: { id: 5 },
      livestream: { liverId: null },
    });
    expect(result.isOwnerLiver).toBe(false);
    expect(result.canEdit).toBe(false);
  });

  it("admin + owner liver: canEdit is true", () => {
    const result = computeCanEdit({
      user: { role: "admin" },
      liverInfo: { id: 5 },
      livestream: { liverId: 5 },
    });
    expect(result.isAdmin).toBe(true);
    expect(result.isOwnerLiver).toBe(true);
    expect(result.canEdit).toBe(true);
  });

  it("livestream is null: canEdit is false for liver", () => {
    const result = computeCanEdit({
      user: null,
      liverInfo: { id: 5 },
      livestream: null,
    });
    expect(result.isOwnerLiver).toBe(false);
    expect(result.canEdit).toBe(false);
  });
});
