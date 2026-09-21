import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getInProgressTasks: vi.fn(),
  getPendingStaffContactsByTaskId: vi.fn(),
  createReminder: vi.fn(),
  createEmailTracking: vi.fn(),
  updateTask: vi.fn(),
  sendReminderEmail: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getInProgressTasks: mocks.getInProgressTasks,
  getPendingStaffContactsByTaskId: mocks.getPendingStaffContactsByTaskId,
  createReminder: mocks.createReminder,
  createEmailTracking: mocks.createEmailTracking,
  updateTask: mocks.updateTask,
}));
vi.mock("./emailService", () => ({
  sendReminderEmail: mocks.sendReminderEmail,
  sendEmail: mocks.sendEmail,
}));

import { processTaskNotificationOutbox } from "./taskNotificationService";

const outboxRow = {
  id: 1,
  notificationKey: "reminder:8:2:100",
  eventType: "reminder",
  taskId: 8,
  staffId: 2,
  recipientUserId: null,
  feedbackId: null,
  feedbackStatus: null,
  status: "processing",
  attempts: 1,
  nextAttemptAt: null,
  leaseUntil: new Date(),
  leaseToken: "lease-token",
  deliveryStartedAt: null,
  reminderId: null,
  provider: null,
  providerMessageId: null,
  lastError: null,
  sentAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createDb({ claim = true, deliveryClaim = true, terminalAffected = true } = {}) {
  const updates: any[] = [];
  let executeCall = 0;
  const db = {
    execute: vi.fn(async () => {
      executeCall += 1;
      if (executeCall === 1) return [[]];
      if (executeCall === 2) return [[{ id: 1 }]];
      if (executeCall === 3) return [{ affectedRows: claim ? 1 : 0 }];
      if (executeCall === 4) return [[{
          id: 8, taskId: "TASK-8", taskDetail: "<b>unsafe</b>", notes: null,
          startDate: Date.now() - 1000, deadline: null, screenshotUrl: null, screenshotUrls: [],
          staffId: 2, name: "<img onerror=1>", email: "a@example.test",
        }]];
      return [{ affectedRows: deliveryClaim ? 1 : 0 }];
    }),
    select: vi.fn(() => ({
      from: () => ({ where: () => ({ limit: async () => [outboxRow] }) }),
    })),
    update: vi.fn(() => ({
      set: (change: any) => ({ where: async () => { updates.push(change); return [{ affectedRows: terminalAffected ? 1 : 0 }]; } }),
    })),
  };
  return { db, updates };
}

describe("task notification outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createReminder.mockResolvedValue({ id: 77 });
    mocks.createEmailTracking.mockResolvedValue({});
    mocks.updateTask.mockResolvedValue({});
  });

  it("sends only after winning the atomic lease and records the real reminder id", async () => {
    const state = createDb();
    mocks.getDb.mockResolvedValue(state.db);
    mocks.sendReminderEmail.mockResolvedValue({ success: true, provider: "gmail", messageId: "m-1" });
    const result = await processTaskNotificationOutbox();
    expect(result).toMatchObject({ sent: 1, failed: 0 });
    expect(mocks.sendReminderEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendReminderEmail.mock.calls[0].at(-1)).toBe(outboxRow.notificationKey);
    expect(mocks.createEmailTracking).toHaveBeenCalledWith(expect.objectContaining({ reminderId: 77 }));
    expect(state.updates).toContainEqual(expect.objectContaining({ status: "sent", reminderId: 77 }));
  });

  it("does not send when another worker already claimed the row", async () => {
    const state = createDb({ claim: false });
    mocks.getDb.mockResolvedValue(state.db);
    const result = await processTaskNotificationOutbox();
    expect(result.processed).toBe(0);
    expect(mocks.sendReminderEmail).not.toHaveBeenCalled();
  });

  it("does not send after losing the lease before the external call", async () => {
    const state = createDb({ deliveryClaim: false });
    mocks.getDb.mockResolvedValue(state.db);
    const result = await processTaskNotificationOutbox();
    expect(result).toMatchObject({ sent: 0, failed: 0 });
    expect(mocks.sendReminderEmail).not.toHaveBeenCalled();
  });

  it("persists provider failure with retry eligibility", async () => {
    const state = createDb();
    mocks.getDb.mockResolvedValue(state.db);
    mocks.sendReminderEmail.mockResolvedValue({ success: false, errorCode: "SMTP_DOWN" });
    const result = await processTaskNotificationOutbox();
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(state.updates).toContainEqual(expect.objectContaining({
      status: "failed",
      lastError: "SMTP_DOWN",
      nextAttemptAt: expect.any(Date),
    }));
  });

  it("does not report sent when a competing terminal CAS wins", async () => {
    const state = createDb({ terminalAffected: false });
    mocks.getDb.mockResolvedValue(state.db);
    mocks.sendReminderEmail.mockResolvedValue({ success: true, provider: "gmail", messageId: "m-race" });
    const result = await processTaskNotificationOutbox();
    expect(mocks.sendReminderEmail).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(0);
  });

  it("quarantines expired delivery attempts one row at a time with lease-token CAS", () => {
    const source = readFileSync("server/taskNotificationService.ts", "utf8");
    expect(source).toContain("SELECT id, leaseToken FROM task_notification_outbox");
    expect(source).toContain("AND leaseToken = ${stale.leaseToken}");
    expect(source).toContain("AND deliveryStartedAt IS NOT NULL");
  });
});
