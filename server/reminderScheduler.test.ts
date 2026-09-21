import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueueDueTaskReminderNotifications, processTaskNotificationOutbox } = vi.hoisted(() => ({
  enqueueDueTaskReminderNotifications: vi.fn(),
  processTaskNotificationOutbox: vi.fn(),
}));

vi.mock("./taskNotificationService", () => ({
  enqueueDueTaskReminderNotifications,
  processTaskNotificationOutbox,
}));

import { checkAndSendReminders } from "./reminderScheduler";

describe("reminder outbox scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enqueueDueTaskReminderNotifications.mockResolvedValue({ queued: 1 });
  });

  it("reports failed delivery while keeping the durable outbox retry eligible", async () => {
    processTaskNotificationOutbox.mockResolvedValue({ sent: 0, failed: 1, cancelled: 0 });
    const result = await checkAndSendReminders();
    expect(result).toMatchObject({ success: false, queuedCount: 1, successCount: 0, failureCount: 1 });
  });

  it("reports successful outbox delivery", async () => {
    processTaskNotificationOutbox.mockResolvedValue({ sent: 1, failed: 0, cancelled: 0 });
    const result = await checkAndSendReminders();
    expect(result).toMatchObject({ success: true, queuedCount: 1, successCount: 1, failureCount: 0 });
  });
});
