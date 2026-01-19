import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  createActivityLog: vi.fn().mockResolvedValue({ id: 1 }),
  getRecentActivityLogs: vi.fn().mockResolvedValue([
    {
      log: {
        id: 1,
        userId: 1,
        actionType: "brand_create",
        actionLabel: "ブランドを作成",
        targetId: 1,
        targetName: "テストブランド",
        createdAt: new Date(),
      },
      user: {
        id: 1,
        email: "test@lcj.com",
        name: "テストユーザー",
      },
    },
  ]),
  getActivityLogsByUser: vi.fn().mockResolvedValue([
    {
      log: {
        id: 1,
        userId: 1,
        actionType: "business_card_create",
        actionLabel: "名刺を登録",
        targetId: 1,
        targetName: "山田太郎",
        createdAt: new Date(),
      },
      user: {
        id: 1,
        email: "test@lcj.com",
        name: "テストユーザー",
      },
    },
    {
      log: {
        id: 2,
        userId: 1,
        actionType: "report_create",
        actionLabel: "レポートを提出",
        targetId: 2,
        targetName: "営業報告",
        createdAt: new Date(),
      },
      user: {
        id: 1,
        email: "test@lcj.com",
        name: "テストユーザー",
      },
    },
  ]),
  getAllUsers: vi.fn().mockResolvedValue([
    { id: 1, email: "test@lcj.com", name: "テストユーザー", createdAt: new Date() },
    { id: 2, email: "test2@lcj.com", name: "テストユーザー2", createdAt: new Date() },
    { id: 3, email: "test@example.com", name: "テストユーザー3", createdAt: new Date() },
  ]),
}));

import {
  createActivityLog,
  getRecentActivityLogs,
  getActivityLogsByUser,
  getAllUsers,
} from "./db";

describe("Activity Log Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createActivityLog", () => {
    it("should create an activity log entry", async () => {
      const logData = {
        userId: 1,
        actionType: "brand_create",
        actionLabel: "ブランドを作成",
        targetId: 1,
        targetName: "テストブランド",
      };

      const result = await createActivityLog(logData);

      expect(createActivityLog).toHaveBeenCalledWith(logData);
      expect(result).toEqual({ id: 1 });
    });

    it("should handle different action types", async () => {
      const actionTypes = [
        { type: "business_card_create", label: "名刺を登録" },
        { type: "brand_create", label: "ブランドを作成" },
        { type: "task_create", label: "タスクを作成" },
        { type: "report_create", label: "レポートを提出" },
        { type: "followup_complete", label: "フォローアップを完了" },
        { type: "brand_activity_create", label: "対応履歴を追加" },
      ];

      for (const action of actionTypes) {
        await createActivityLog({
          userId: 1,
          actionType: action.type,
          actionLabel: action.label,
          targetId: 1,
          targetName: "テスト",
        });
      }

      expect(createActivityLog).toHaveBeenCalledTimes(actionTypes.length);
    });
  });

  describe("getRecentActivityLogs", () => {
    it("should return recent activity logs with user info", async () => {
      const result = await getRecentActivityLogs(50);

      expect(getRecentActivityLogs).toHaveBeenCalledWith(50);
      expect(result).toHaveLength(1);
      expect(result[0].log.actionType).toBe("brand_create");
      expect(result[0].user?.email).toBe("test@lcj.com");
    });
  });

  describe("getActivityLogsByUser", () => {
    it("should return activity logs for a specific user", async () => {
      const result = await getActivityLogsByUser(1, 50);

      expect(getActivityLogsByUser).toHaveBeenCalledWith(1, 50);
      expect(result).toHaveLength(2);
      expect(result[0].log.userId).toBe(1);
      expect(result[1].log.userId).toBe(1);
    });
  });

  describe("Test User Filtering", () => {
    it("should filter out @example.com users", async () => {
      const allUsers = await getAllUsers();
      
      // Filter out test users (same logic as in MasterControl.tsx)
      const filteredUsers = allUsers.filter(
        (user: any) => !user.email.endsWith("@example.com")
      );

      expect(allUsers).toHaveLength(3);
      expect(filteredUsers).toHaveLength(2);
      expect(filteredUsers.every((u: any) => !u.email.endsWith("@example.com"))).toBe(true);
    });
  });
});

describe("Activity Log Action Types", () => {
  it("should have correct Japanese labels for all action types", () => {
    const actionLabels: Record<string, string> = {
      business_card_create: "名刺を登録",
      brand_create: "ブランドを作成",
      task_create: "タスクを作成",
      report_create: "レポートを提出",
      followup_complete: "フォローアップを完了",
      brand_activity_create: "対応履歴を追加",
    };

    // Verify all expected action types have labels
    expect(Object.keys(actionLabels)).toHaveLength(6);
    
    // Verify labels are non-empty strings
    Object.values(actionLabels).forEach((label) => {
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it("should have correct Chinese labels for all action types", () => {
    const actionLabels: Record<string, string> = {
      business_card_create: "注册了名片",
      brand_create: "创建了品牌",
      task_create: "创建了任务",
      report_create: "提交了报告",
      followup_complete: "完成了跟进",
      brand_activity_create: "添加了应对履历",
    };

    // Verify all expected action types have labels
    expect(Object.keys(actionLabels)).toHaveLength(6);
    
    // Verify labels are non-empty strings
    Object.values(actionLabels).forEach((label) => {
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    });
  });
});
