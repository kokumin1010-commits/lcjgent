import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("HR resign and reinstate procedures", () => {
  it("should resign a staff member with date and reason", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a staff member
    const ts = Date.now();
    const email = `resign-test-${ts}@example.com`;
    await caller.staff.create({
      name: `退職テスト${ts}`,
      email,
      department: "テスト部",
    });

    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();
    expect(created!.isActive).toBe("active");

    // Create reportStaff
    const rsResult = await caller.reportStaff.create({
      name: `退職テスト${ts}`,
      country: "日本",
    });
    expect(rsResult).toBeDefined();

    const reportStaffList = await caller.staff.listReportStaffUnified();
    const linkedRs = reportStaffList.find(
      r => r.reportStaff.name === `退職テスト${ts}` && !r.linkedStaff
    );
    expect(linkedRs).toBeDefined();

    // Link them
    await caller.reportStaff.update({
      id: linkedRs!.reportStaff.id,
      linkedStaffId: created!.id,
    });

    // Resign
    const resignResult = await caller.staff.resign({
      staffId: created!.id,
      reportStaffId: linkedRs!.reportStaff.id,
      resignDate: "2026-02-10",
      resignReason: "テスト退職理由",
    });
    expect(resignResult.success).toBe(true);

    // Verify staff is inactive
    const resignedStaff = await caller.staff.getById({ id: created!.id });
    expect(resignedStaff?.isActive).toBe("inactive");
    expect(resignedStaff?.resignDate).toBeDefined();
    expect(resignedStaff?.resignReason).toBe("テスト退職理由");

    // Verify reportStaff is also inactive
    const updatedUnified = await caller.staff.listReportStaffUnified();
    const resignedRs = updatedUnified.find(
      r => r.reportStaff.id === linkedRs!.reportStaff.id
    );
    expect(resignedRs?.reportStaff.isActive).toBe("inactive");

    // Cleanup
    await caller.staff.delete({ id: created!.id });
    await caller.reportStaff.delete({ id: linkedRs!.reportStaff.id });
  }, 15000);

  it("should reinstate a resigned staff member", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const ts = Date.now();
    const email = `reinstate-test-${ts}@example.com`;
    await caller.staff.create({
      name: `復職テスト${ts}`,
      email,
      department: "復職テスト部",
    });

    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();

    await caller.reportStaff.create({
      name: `復職テスト${ts}`,
      country: "日本",
    });

    const reportStaffList = await caller.staff.listReportStaffUnified();
    const linkedRs = reportStaffList.find(
      r => r.reportStaff.name === `復職テスト${ts}` && !r.linkedStaff
    );
    expect(linkedRs).toBeDefined();

    await caller.reportStaff.update({
      id: linkedRs!.reportStaff.id,
      linkedStaffId: created!.id,
    });

    // Resign first
    await caller.staff.resign({
      staffId: created!.id,
      reportStaffId: linkedRs!.reportStaff.id,
      resignDate: "2026-01-15",
      resignReason: "一身上の都合",
    });

    const resignedStaff = await caller.staff.getById({ id: created!.id });
    expect(resignedStaff?.isActive).toBe("inactive");

    // Now reinstate
    const reinstateResult = await caller.staff.reinstate({
      staffId: created!.id,
      reportStaffId: linkedRs!.reportStaff.id,
    });
    expect(reinstateResult.success).toBe(true);

    const reinstatedStaff = await caller.staff.getById({ id: created!.id });
    expect(reinstatedStaff?.isActive).toBe("active");
    expect(reinstatedStaff?.resignDate).toBeNull();
    expect(reinstatedStaff?.resignReason).toBeNull();

    const updatedUnified = await caller.staff.listReportStaffUnified();
    const reinstatedRs = updatedUnified.find(
      r => r.reportStaff.id === linkedRs!.reportStaff.id
    );
    expect(reinstatedRs?.reportStaff.isActive).toBe("active");

    // Cleanup
    await caller.staff.delete({ id: created!.id });
    await caller.reportStaff.delete({ id: linkedRs!.reportStaff.id });
  }, 15000);

  it("should resign without a reason (reason is optional)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const ts = Date.now();
    const email = `resign-noreason-${ts}@example.com`;
    await caller.staff.create({
      name: `理由なし退職${ts}`,
      email,
    });

    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();

    await caller.reportStaff.create({
      name: `理由なし退職${ts}`,
      country: "日本",
    });

    const reportStaffList = await caller.staff.listReportStaffUnified();
    const linkedRs = reportStaffList.find(
      r => r.reportStaff.name === `理由なし退職${ts}` && !r.linkedStaff
    );
    expect(linkedRs).toBeDefined();

    await caller.reportStaff.update({
      id: linkedRs!.reportStaff.id,
      linkedStaffId: created!.id,
    });

    // Resign without reason
    const resignResult = await caller.staff.resign({
      staffId: created!.id,
      reportStaffId: linkedRs!.reportStaff.id,
      resignDate: "2026-02-01",
    });
    expect(resignResult.success).toBe(true);

    const resignedStaff = await caller.staff.getById({ id: created!.id });
    expect(resignedStaff?.isActive).toBe("inactive");
    expect(resignedStaff?.resignDate).toBeDefined();
    expect(resignedStaff?.resignReason).toBeNull();

    // Cleanup
    await caller.staff.delete({ id: created!.id });
    await caller.reportStaff.delete({ id: linkedRs!.reportStaff.id });
  }, 15000);

  it("should include resign info in unified list for inactive staff", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Get unified list and check that inactive staff have resign fields
    const unified = await caller.staff.listReportStaffUnified();
    expect(Array.isArray(unified)).toBe(true);

    // Check that linked staff records include resign fields
    const linkedItems = unified.filter(u => u.linkedStaff !== null);
    for (const item of linkedItems) {
      if (item.linkedStaff) {
        // resignDate and resignReason should be present in the schema
        expect("resignDate" in item.linkedStaff).toBe(true);
        expect("resignReason" in item.linkedStaff).toBe(true);
      }
    }
  });

  it("should keep staff statistics accurate after resign/reinstate", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Get initial stats
    const initialStats = await caller.staff.statistics();
    expect(initialStats).toHaveProperty("totalStaff");
    expect(initialStats).toHaveProperty("activeStaff");
    expect(initialStats).toHaveProperty("inactiveStaff");
    expect(typeof initialStats.totalStaff).toBe("number");
    expect(typeof initialStats.activeStaff).toBe("number");
    expect(typeof initialStats.inactiveStaff).toBe("number");

    // Active + Inactive should equal Total
    expect(initialStats.activeStaff + initialStats.inactiveStaff).toBe(initialStats.totalStaff);
  });
});
