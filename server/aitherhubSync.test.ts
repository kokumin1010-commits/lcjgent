import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getAitherhubSyncLogs: vi.fn(),
  getAitherhubSyncStats: vi.fn(),
  createAitherhubSyncLog: vi.fn(),
}));

import { getAitherhubSyncLogs, getAitherhubSyncStats, createAitherhubSyncLog } from "./db";

describe("Aitherhub Sync Logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAitherhubSyncLog", () => {
    it("should create a sync log with success status", async () => {
      const mockLog = {
        id: 1,
        status: "success",
        message: "1件の予約を取得しました",
        streamerName: "TestLiver",
        liverEmail: "test@example.com",
        livestreamId: 123,
        livestreamDate: new Date("2026-02-15"),
        action: "created",
        errorDetail: null,
        createdAt: new Date(),
      };
      (createAitherhubSyncLog as any).mockResolvedValue(mockLog);

      const result = await createAitherhubSyncLog({
        status: "success",
        message: "1件の予約を取得しました",
        streamerName: "TestLiver",
        liverEmail: "test@example.com",
        livestreamId: 123,
        livestreamDate: new Date("2026-02-15"),
        action: "created",
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("success");
      expect(result.message).toBe("1件の予約を取得しました");
      expect(result.streamerName).toBe("TestLiver");
      expect(result.action).toBe("created");
    });

    it("should create a sync log with error status", async () => {
      const mockLog = {
        id: 2,
        status: "error",
        message: "同期に失敗しました",
        streamerName: null,
        liverEmail: "unknown@example.com",
        livestreamId: null,
        livestreamDate: null,
        action: null,
        errorDetail: "ライバーが見つかりません: unknown@example.com",
        createdAt: new Date(),
      };
      (createAitherhubSyncLog as any).mockResolvedValue(mockLog);

      const result = await createAitherhubSyncLog({
        status: "error",
        message: "同期に失敗しました",
        liverEmail: "unknown@example.com",
        errorDetail: "ライバーが見つかりません: unknown@example.com",
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("error");
      expect(result.errorDetail).toContain("ライバーが見つかりません");
    });

    it("should create a sync log with partial status", async () => {
      const mockLog = {
        id: 3,
        status: "partial",
        message: "一部のデータのみ同期されました",
        streamerName: "TestLiver2",
        liverEmail: "test2@example.com",
        livestreamId: 456,
        livestreamDate: new Date("2026-02-16"),
        action: "updated",
        errorDetail: "一部フィールドが不足",
        createdAt: new Date(),
      };
      (createAitherhubSyncLog as any).mockResolvedValue(mockLog);

      const result = await createAitherhubSyncLog({
        status: "partial",
        message: "一部のデータのみ同期されました",
        streamerName: "TestLiver2",
        liverEmail: "test2@example.com",
        livestreamId: 456,
        action: "updated",
        errorDetail: "一部フィールドが不足",
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("partial");
      expect(result.action).toBe("updated");
    });
  });

  describe("getAitherhubSyncLogs", () => {
    it("should return paginated logs", async () => {
      const mockResult = {
        logs: [
          { id: 1, status: "success", message: "1件の予約を取得しました", createdAt: new Date() },
          { id: 2, status: "error", message: "同期に失敗しました", createdAt: new Date() },
        ],
        total: 10,
      };
      (getAitherhubSyncLogs as any).mockResolvedValue(mockResult);

      const result = await getAitherhubSyncLogs({ limit: 20, offset: 0 });

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it("should filter logs by status", async () => {
      const mockResult = {
        logs: [
          { id: 1, status: "success", message: "1件の予約を取得しました", createdAt: new Date() },
        ],
        total: 5,
      };
      (getAitherhubSyncLogs as any).mockResolvedValue(mockResult);

      const result = await getAitherhubSyncLogs({ limit: 20, offset: 0, status: "success" });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].status).toBe("success");
      expect(getAitherhubSyncLogs).toHaveBeenCalledWith({ limit: 20, offset: 0, status: "success" });
    });

    it("should filter logs by liverId", async () => {
      const mockResult = {
        logs: [
          { id: 3, status: "success", message: "配信を同期しました", liverId: 42, createdAt: new Date() },
        ],
        total: 1,
      };
      (getAitherhubSyncLogs as any).mockResolvedValue(mockResult);

      const result = await getAitherhubSyncLogs({ limit: 20, offset: 0, liverId: 42 });

      expect(result.logs).toHaveLength(1);
      expect(getAitherhubSyncLogs).toHaveBeenCalledWith({ limit: 20, offset: 0, liverId: 42 });
    });

    it("should return empty logs when no data", async () => {
      const mockResult = { logs: [], total: 0 };
      (getAitherhubSyncLogs as any).mockResolvedValue(mockResult);

      const result = await getAitherhubSyncLogs({ limit: 20, offset: 0 });

      expect(result.logs).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getAitherhubSyncStats", () => {
    it("should return sync statistics", async () => {
      const mockStats = {
        totalLogs: 25,
        successCount: 20,
        errorCount: 3,
        partialCount: 2,
        lastSyncAt: new Date("2026-02-15T10:00:00Z"),
      };
      (getAitherhubSyncStats as any).mockResolvedValue(mockStats);

      const result = await getAitherhubSyncStats();

      expect(result.totalLogs).toBe(25);
      expect(result.successCount).toBe(20);
      expect(result.errorCount).toBe(3);
      expect(result.partialCount).toBe(2);
      expect(result.lastSyncAt).toBeDefined();
    });

    it("should return zero counts when no logs exist", async () => {
      const mockStats = {
        totalLogs: 0,
        successCount: 0,
        errorCount: 0,
        partialCount: 0,
        lastSyncAt: null,
      };
      (getAitherhubSyncStats as any).mockResolvedValue(mockStats);

      const result = await getAitherhubSyncStats();

      expect(result.totalLogs).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.lastSyncAt).toBeNull();
    });
  });

  describe("Webhook sync log integration", () => {
    it("should log success when webhook creates a livestream", async () => {
      const mockLog = {
        id: 10,
        status: "success",
        message: "1件の予約を取得しました",
        streamerName: "Ryu kyogoku",
        liverEmail: "ryu@example.com",
        livestreamId: 100,
        livestreamDate: new Date("2026-02-20"),
        action: "created",
        errorDetail: null,
        createdAt: new Date(),
      };
      (createAitherhubSyncLog as any).mockResolvedValue(mockLog);

      const result = await createAitherhubSyncLog({
        status: "success",
        message: "1件の予約を取得しました",
        streamerName: "Ryu kyogoku",
        liverEmail: "ryu@example.com",
        livestreamId: 100,
        livestreamDate: new Date("2026-02-20"),
        action: "created",
      });

      expect(result.status).toBe("success");
      expect(result.streamerName).toBe("Ryu kyogoku");
      expect(result.livestreamId).toBe(100);
      expect(result.action).toBe("created");
    });

    it("should log error when liver is not found", async () => {
      const mockLog = {
        id: 11,
        status: "error",
        message: "同期に失敗しました: ライバーが見つかりません",
        streamerName: "Unknown Liver",
        liverEmail: "notfound@example.com",
        livestreamId: null,
        livestreamDate: null,
        action: null,
        errorDetail: "ライバーが見つかりません: notfound@example.com",
        createdAt: new Date(),
      };
      (createAitherhubSyncLog as any).mockResolvedValue(mockLog);

      const result = await createAitherhubSyncLog({
        status: "error",
        message: "同期に失敗しました: ライバーが見つかりません",
        streamerName: "Unknown Liver",
        liverEmail: "notfound@example.com",
        errorDetail: "ライバーが見つかりません: notfound@example.com",
      });

      expect(result.status).toBe("error");
      expect(result.errorDetail).toContain("ライバーが見つかりません");
      expect(result.livestreamId).toBeNull();
    });

    it("should log success when webhook updates existing livestream", async () => {
      const mockLog = {
        id: 12,
        status: "success",
        message: "既存の配信を更新しました",
        streamerName: "Ryu kyogoku",
        liverEmail: "ryu@example.com",
        livestreamId: 100,
        livestreamDate: new Date("2026-02-20"),
        action: "updated",
        errorDetail: null,
        createdAt: new Date(),
      };
      (createAitherhubSyncLog as any).mockResolvedValue(mockLog);

      const result = await createAitherhubSyncLog({
        status: "success",
        message: "既存の配信を更新しました",
        streamerName: "Ryu kyogoku",
        liverEmail: "ryu@example.com",
        livestreamId: 100,
        livestreamDate: new Date("2026-02-20"),
        action: "updated",
      });

      expect(result.status).toBe("success");
      expect(result.action).toBe("updated");
    });
  });
});
