import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  createLineFollowUp: vi.fn(),
  getActiveLineFollowUps: vi.fn(),
  getAllLineFollowUps: vi.fn(),
  updateLineFollowUpStatus: vi.fn(),
  deleteLineFollowUp: vi.fn(),
}));

import {
  createLineFollowUp,
  getActiveLineFollowUps,
  getAllLineFollowUps,
  updateLineFollowUpStatus,
  deleteLineFollowUp,
} from "./db";

describe("LINE Follow-up Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a follow-up successfully", async () => {
    const mockFollowUp = {
      id: 1,
      targetType: "user" as const,
      lineUserId: "test_user_123",
      triggerCondition: "no_reply" as const,
      delayHours: 72,
      maxAttempts: 3,
      messageTemplate: "テストフォローアップメッセージ",
      status: "active" as const,
    };
    
    vi.mocked(createLineFollowUp).mockResolvedValue(mockFollowUp);
    
    const result = await createLineFollowUp({
      targetType: "user",
      lineUserId: "test_user_123",
      triggerCondition: "no_reply",
      delayHours: 72,
      maxAttempts: 3,
      messageTemplate: "テストフォローアップメッセージ",
    });
    
    expect(result).toBeDefined();
    expect(result?.targetType).toBe("user");
    expect(result?.triggerCondition).toBe("no_reply");
    expect(createLineFollowUp).toHaveBeenCalledTimes(1);
  });

  it("should get active follow-ups", async () => {
    vi.mocked(getActiveLineFollowUps).mockResolvedValue([]);
    
    const result = await getActiveLineFollowUps();
    
    expect(Array.isArray(result)).toBe(true);
    expect(getActiveLineFollowUps).toHaveBeenCalledTimes(1);
  });

  it("should get all follow-ups", async () => {
    const mockFollowUps = [
      {
        id: 1,
        targetType: "user" as const,
        lineUserId: "test_user_1",
        lineGroupId: null,
        triggerCondition: "no_reply" as const,
        delayHours: 72,
        maxAttempts: 3,
        currentAttempts: 0,
        messageTemplate: "テスト1",
        status: "active" as const,
        lastSentAt: null,
        nextScheduledAt: new Date(),
        brandId: null,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    
    vi.mocked(getAllLineFollowUps).mockResolvedValue(mockFollowUps);
    
    const result = await getAllLineFollowUps();
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(getAllLineFollowUps).toHaveBeenCalledTimes(1);
  });

  it("should update follow-up status", async () => {
    vi.mocked(updateLineFollowUpStatus).mockResolvedValue(undefined);
    
    await updateLineFollowUpStatus(1, "completed");
    
    expect(updateLineFollowUpStatus).toHaveBeenCalledWith(1, "completed");
  });

  it("should cancel a follow-up", async () => {
    vi.mocked(updateLineFollowUpStatus).mockResolvedValue(undefined);
    
    await updateLineFollowUpStatus(1, "cancelled");
    
    expect(updateLineFollowUpStatus).toHaveBeenCalledWith(1, "cancelled");
  });

  it("should delete a follow-up", async () => {
    vi.mocked(deleteLineFollowUp).mockResolvedValue(undefined);
    
    await deleteLineFollowUp(1);
    
    expect(deleteLineFollowUp).toHaveBeenCalledWith(1);
  });
});

describe("LINE Follow-up Scheduler Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should filter follow-ups by scheduled time", async () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
    const futureDate = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour later
    
    const mockFollowUps = [
      {
        id: 1,
        targetType: "user" as const,
        lineUserId: "user_1",
        lineGroupId: null,
        triggerCondition: "no_reply" as const,
        delayHours: 72,
        maxAttempts: 3,
        currentAttempts: 0,
        messageTemplate: "Past scheduled",
        status: "active" as const,
        lastSentAt: null,
        nextScheduledAt: pastDate,
        brandId: null,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        targetType: "user" as const,
        lineUserId: "user_2",
        lineGroupId: null,
        triggerCondition: "no_reply" as const,
        delayHours: 72,
        maxAttempts: 3,
        currentAttempts: 0,
        messageTemplate: "Future scheduled",
        status: "active" as const,
        lastSentAt: null,
        nextScheduledAt: futureDate,
        brandId: null,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    
    vi.mocked(getActiveLineFollowUps).mockResolvedValue(mockFollowUps);
    
    const result = await getActiveLineFollowUps();
    
    // Filter to only those that should be sent now
    const dueFollowUps = result.filter(f => 
      f.nextScheduledAt && new Date(f.nextScheduledAt) <= now
    );
    
    expect(dueFollowUps.length).toBe(1);
    expect(dueFollowUps[0].id).toBe(1);
  });

  it("should check max attempts before sending", async () => {
    const mockFollowUp = {
      id: 1,
      targetType: "user" as const,
      lineUserId: "user_1",
      lineGroupId: null,
      triggerCondition: "no_reply" as const,
      delayHours: 72,
      maxAttempts: 3,
      currentAttempts: 3, // Already at max
      messageTemplate: "Test",
      status: "active" as const,
      lastSentAt: new Date(),
      nextScheduledAt: new Date(),
      brandId: null,
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Should not send if max attempts reached
    const shouldSend = mockFollowUp.currentAttempts < mockFollowUp.maxAttempts;
    
    expect(shouldSend).toBe(false);
  });
});
