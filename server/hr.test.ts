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

describe("HR staff management - extended fields", () => {
  it("should create a staff member with HR fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.staff.create({
      name: "テスト太郎",
      nameEn: "Taro Test",
      email: `hr-test-${Date.now()}@example.com`,
      phone: "090-1234-5678",
      department: "営業部",
      position: "マネージャー",
      country: "日本",
      joinDate: "2024-04-01",
      skills: ["営業", "マーケティング", "中国語"],
      lineId: "test_line_id",
      emergencyContact: "090-9999-8888",
      notes: "テスト用スタッフ",
      employmentType: "fulltime",
    });

    expect(result.success).toBe(true);
  });

  it("should create a staff member with minimal fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.staff.create({
      name: "最小テスト",
      email: `hr-min-${Date.now()}@example.com`,
    });

    expect(result.success).toBe(true);
  });

  it("should list all staff and include HR fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.staff.list();

    expect(Array.isArray(result)).toBe(true);
    // Verify the schema includes new HR fields
    if (result.length > 0) {
      const staffMember = result[0];
      expect(staffMember).toHaveProperty("name");
      expect(staffMember).toHaveProperty("email");
      expect(staffMember).toHaveProperty("isActive");
      expect(staffMember).toHaveProperty("createdAt");
      // New HR fields should exist (may be null)
      expect("nameEn" in staffMember).toBe(true);
      expect("phone" in staffMember).toBe(true);
      expect("position" in staffMember).toBe(true);
      expect("avatarUrl" in staffMember).toBe(true);
      expect("joinDate" in staffMember).toBe(true);
      expect("skills" in staffMember).toBe(true);
      expect("employmentType" in staffMember).toBe(true);
    }
  });

  it("should update a staff member with HR fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create a staff member
    const email = `hr-update-${Date.now()}@example.com`;
    await caller.staff.create({
      name: "更新テスト",
      email,
      department: "技術部",
    });

    // Find the created staff
    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();

    if (created) {
      // Update with HR fields
      const updateResult = await caller.staff.update({
        id: created.id,
        nameEn: "Update Test",
        phone: "080-1111-2222",
        position: "シニアエンジニア",
        skills: ["TypeScript", "React", "Node.js"],
        employmentType: "contract",
        joinDate: "2025-01-15",
        lineId: "updated_line",
        emergencyContact: "080-3333-4444",
        notes: "更新済みメモ",
      });

      expect(updateResult.success).toBe(true);

      // Verify update
      const updated = await caller.staff.getById({ id: created.id });
      expect(updated).toBeDefined();
      if (updated) {
        expect(updated.nameEn).toBe("Update Test");
        expect(updated.phone).toBe("080-1111-2222");
        expect(updated.position).toBe("シニアエンジニア");
        expect(updated.employmentType).toBe("contract");
        expect(updated.lineId).toBe("updated_line");
        expect(updated.emergencyContact).toBe("080-3333-4444");
        expect(updated.notes).toBe("更新済みメモ");
      }

      // Cleanup
      await caller.staff.delete({ id: created.id });
    }
  });

  it("should get staff statistics", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.staff.statistics();

    expect(stats).toHaveProperty("totalStaff");
    expect(stats).toHaveProperty("activeStaff");
    expect(stats).toHaveProperty("inactiveStaff");
    expect(stats).toHaveProperty("departmentBreakdown");
    expect(stats).toHaveProperty("countryBreakdown");
    expect(stats).toHaveProperty("employmentTypeBreakdown");
    expect(typeof stats.totalStaff).toBe("number");
    expect(typeof stats.activeStaff).toBe("number");
    expect(stats.totalStaff).toBeGreaterThanOrEqual(0);
    expect(stats.activeStaff).toBeLessThanOrEqual(stats.totalStaff);
  });

  it("should handle employment type enum values correctly", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const employmentTypes = ["fulltime", "parttime", "contract", "intern"] as const;

    for (const empType of employmentTypes) {
      const email = `hr-emp-${empType}-${Date.now()}@example.com`;
      const result = await caller.staff.create({
        name: `${empType}テスト`,
        email,
        employmentType: empType,
      });
      expect(result.success).toBe(true);

      // Find and verify
      const allStaff = await caller.staff.list();
      const created = allStaff.find(s => s.email === email);
      expect(created).toBeDefined();
      if (created) {
        expect(created.employmentType).toBe(empType);
        // Cleanup
        await caller.staff.delete({ id: created.id });
      }
    }
  });

  it("should update staff status (active/inactive)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const email = `hr-status-${Date.now()}@example.com`;
    await caller.staff.create({
      name: "ステータステスト",
      email,
    });

    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();

    if (created) {
      // Set to inactive
      await caller.staff.update({ id: created.id, isActive: "inactive" });
      const inactive = await caller.staff.getById({ id: created.id });
      expect(inactive?.isActive).toBe("inactive");

      // Set back to active
      await caller.staff.update({ id: created.id, isActive: "active" });
      const active = await caller.staff.getById({ id: created.id });
      expect(active?.isActive).toBe("active");

      // Cleanup
      await caller.staff.delete({ id: created.id });
    }
  });

  it("should get task history for a staff member", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a staff member
    const email = `hr-task-hist-${Date.now()}@example.com`;
    await caller.staff.create({ name: "タスク履歴テスト", email });

    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();

    if (created) {
      // Get task history (should return array, possibly empty)
      const taskHistory = await caller.staff.getTaskHistory({ staffId: created.id });
      expect(Array.isArray(taskHistory)).toBe(true);

      // Each task should have expected fields
      if (taskHistory.length > 0) {
        const task = taskHistory[0];
        expect(task).toHaveProperty("id");
        expect(task).toHaveProperty("taskId");
        expect(task).toHaveProperty("status");
        expect(task).toHaveProperty("taskDetail");
        expect(task).toHaveProperty("startDate");
        expect(task).toHaveProperty("createdAt");
      }

      // Cleanup
      await caller.staff.delete({ id: created.id });
    }
  });

  it("should get task counts for a staff member", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const email = `hr-task-counts-${Date.now()}@example.com`;
    await caller.staff.create({ name: "タスクカウントテスト", email });

    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();

    if (created) {
      const counts = await caller.staff.getTaskCounts({ staffId: created.id });
      expect(counts).toHaveProperty("totalCount");
      expect(counts).toHaveProperty("inProgressCount");
      expect(counts).toHaveProperty("completedCount");
      expect(counts).toHaveProperty("overdueCount");
      expect(typeof counts.totalCount).toBe("number");
      expect(counts.totalCount).toBeGreaterThanOrEqual(0);

      // Cleanup
      await caller.staff.delete({ id: created.id });
    }
  });

  it("should get report history for a staff member", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const email = `hr-report-hist-${Date.now()}@example.com`;
    await caller.staff.create({ name: "日報履歴テスト", email });

    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();

    if (created) {
      // Get report history (may be empty if no linked reportStaff)
      const reportHistory = await caller.staff.getReportHistory({ staffId: created.id });
      expect(Array.isArray(reportHistory)).toBe(true);

      // Each report should have expected fields if present
      if (reportHistory.length > 0) {
        const report = reportHistory[0];
        expect(report).toHaveProperty("id");
        expect(report).toHaveProperty("reportDate");
        expect(report).toHaveProperty("workContent");
        expect(report).toHaveProperty("createdAt");
      }

      // Cleanup
      await caller.staff.delete({ id: created.id });
    }
  });

  it("should get linked report staff for a staff member", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const email = `hr-linked-${Date.now()}@example.com`;
    await caller.staff.create({ name: "連携テスト", email });

    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();

    if (created) {
      const linkedStaff = await caller.staff.getLinkedReportStaff({ staffId: created.id });
      expect(Array.isArray(linkedStaff)).toBe(true);

      // Cleanup
      await caller.staff.delete({ id: created.id });
    }
  });

  it("should handle null date fields correctly", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const email = `hr-dates-${Date.now()}@example.com`;
    await caller.staff.create({
      name: "日付テスト",
      email,
      joinDate: "2024-06-01",
      birthDate: "1990-01-15",
    });

    const allStaff = await caller.staff.list();
    const created = allStaff.find(s => s.email === email);
    expect(created).toBeDefined();

    if (created) {
      // Clear dates by setting to null
      await caller.staff.update({
        id: created.id,
        joinDate: null,
        birthDate: null,
      });

      const updated = await caller.staff.getById({ id: created.id });
      expect(updated?.joinDate).toBeNull();
      expect(updated?.birthDate).toBeNull();

      // Cleanup
      await caller.staff.delete({ id: created.id });
    }
  });
});
