import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGroupsNeedingFollowUp: vi.fn(),
  withLineGroupFollowUpClaim: vi.fn(),
  claimCommitted: vi.fn(),
  reserveLineOutgoingAudit: vi.fn(),
  finalizeLineOutgoingAudit: vi.fn(),
  pushMessage: vi.fn(),
  getLineGroupAiInsight: vi.fn(),
  getLineGroupProactiveSuggestion: vi.fn(),
  createLineRetryKey: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
}));

vi.mock("./db", () => ({
  getGroupsNeedingFollowUp: mocks.getGroupsNeedingFollowUp,
  withLineGroupFollowUpClaim: mocks.withLineGroupFollowUpClaim,
  reserveLineOutgoingAudit: mocks.reserveLineOutgoingAudit,
  finalizeLineOutgoingAudit: mocks.finalizeLineOutgoingAudit,
}));

vi.mock("./line", () => ({ pushMessage: mocks.pushMessage }));
vi.mock("./lineAiManager", () => ({
  getLineGroupAiInsight: mocks.getLineGroupAiInsight,
  getLineGroupProactiveSuggestion: mocks.getLineGroupProactiveSuggestion,
}));
vi.mock("./lineRetryKey", () => ({ createLineRetryKey: mocks.createLineRetryKey }));

import { checkAndSendGroupFollowUps } from "./groupFollowUpScheduler";

const dueGroup = {
  id: 1,
  lineGroupId: "C00000000000000000000000000000001",
  groupName: "AIフォローテスト",
  autoFollowUpEnabled: true,
  autoFollowUpDays: 2,
  autoFollowUpMessage: "固定文面",
  lastMessageAt: new Date("2026-09-18T00:00:00.000Z"),
  autoFollowUpEnabledAt: new Date("2026-09-18T12:00:00.000Z"),
  followUpActivityAt: new Date("2026-09-18T12:00:00.000Z"),
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  daysSinceLastMessage: 2,
};

const claimContext = {
  lineGroupId: dueGroup.lineGroupId,
  groupName: dueGroup.groupName,
  autoFollowUpMessage: dueGroup.autoFollowUpMessage,
  lastActivityAt: dueGroup.followUpActivityAt,
  daysSinceLastMessage: 2,
  mode: "fixed" as const,
};

function installSuccessfulClaim() {
  mocks.withLineGroupFollowUpClaim.mockImplementation(async (_params, deliver) => {
    const result = await deliver(claimContext);
    mocks.claimCommitted();
    return { claimed: true, result };
  });
}

describe("group follow-up scheduler AI safety", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T01:00:00.000Z")); // Monday 10:00 JST
    vi.clearAllMocks();
    mocks.getGroupsNeedingFollowUp.mockResolvedValue([dueGroup]);
    mocks.reserveLineOutgoingAudit.mockResolvedValue({ created: true, status: "pending" });
    mocks.finalizeLineOutgoingAudit.mockResolvedValue(undefined);
    mocks.pushMessage.mockResolvedValue(true);
    installSuccessfulClaim();
  });

  afterEach(() => vi.useRealTimers());

  it("does not fall back to a fixed message when AI follow-up is enabled but no current suggestion exists", async () => {
    mocks.getLineGroupAiInsight.mockResolvedValue({ analysisEnabled: true, proactiveAiEnabled: true, insight: null });
    mocks.getLineGroupProactiveSuggestion.mockResolvedValue(null);

    const result = await checkAndSendGroupFollowUps();

    expect(result).toMatchObject({ checked: 1, sent: 0, errors: 0, skippedAwaitingAi: 1 });
    expect(mocks.withLineGroupFollowUpClaim).not.toHaveBeenCalled();
    expect(mocks.reserveLineOutgoingAudit).not.toHaveBeenCalled();
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("claims, reserves, sends and finalizes a current AI suggestion before committing suppression", async () => {
    const suggestedMessage = "配信準備で困っている点はありますか？\n\n— LCJ公式AIマネージャー";
    mocks.getLineGroupAiInsight.mockResolvedValue({ analysisEnabled: true, proactiveAiEnabled: true, insight: {} });
    mocks.getLineGroupProactiveSuggestion.mockResolvedValue(suggestedMessage);
    mocks.withLineGroupFollowUpClaim.mockImplementation(async (params, deliver) => {
      expect(params).toEqual({
        lineGroupId: dueGroup.lineGroupId,
        expectedLastActivityAt: dueGroup.followUpActivityAt,
        expectedMode: "ai",
      });
      const result = await deliver({ ...claimContext, mode: "ai" });
      mocks.claimCommitted();
      return { claimed: true, result };
    });

    const result = await checkAndSendGroupFollowUps();

    expect(result).toMatchObject({ checked: 1, sent: 1, errors: 0 });
    expect(mocks.reserveLineOutgoingAudit).toHaveBeenCalledWith(expect.objectContaining({
      lineGroupId: dueGroup.lineGroupId,
      senderName: "LCJ公式・専属AIマネージャー",
      content: suggestedMessage,
    }));
    expect(mocks.pushMessage).toHaveBeenCalledWith(
      dueGroup.lineGroupId,
      [{ type: "text", text: suggestedMessage }],
      "00000000-0000-4000-8000-000000000001",
    );
    expect(mocks.finalizeLineOutgoingAudit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.claimCommitted.mock.invocationCallOrder[0],
    );
  });

  it("fails closed when initial AI settings cannot be read", async () => {
    mocks.getLineGroupAiInsight.mockRejectedValue(new Error("LINE_GROUP_AI_SETTINGS_UNAVAILABLE"));

    const result = await checkAndSendGroupFollowUps();

    expect(result).toMatchObject({ checked: 1, sent: 0, errors: 1 });
    expect(mocks.withLineGroupFollowUpClaim).not.toHaveBeenCalled();
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it.each([
    "group_inactive_or_opted_out",
    "group_activity_changed",
    "inactivity_threshold_not_met",
    "active_reminder_exists",
    "follow_up_mode_changed",
  ])("does not send when the pre-delivery claim rejects a stale candidate: %s", async reason => {
    mocks.getLineGroupAiInsight.mockResolvedValue({ analysisEnabled: false, proactiveAiEnabled: false, insight: null });
    mocks.withLineGroupFollowUpClaim.mockResolvedValue({ claimed: false, reason });

    const result = await checkAndSendGroupFollowUps();

    expect(result).toMatchObject({ sent: 0, errors: 0, skippedEligibilityChanged: 1 });
    expect(mocks.reserveLineOutgoingAudit).not.toHaveBeenCalled();
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("fails closed when the locked settings recheck fails", async () => {
    mocks.getLineGroupAiInsight.mockResolvedValue({ analysisEnabled: false, proactiveAiEnabled: false, insight: null });
    mocks.withLineGroupFollowUpClaim.mockRejectedValue(new Error("settings recheck failed"));

    const result = await checkAndSendGroupFollowUps();

    expect(result).toMatchObject({ sent: 0, errors: 1 });
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("recovers with the same retry key when delivery succeeds but audit finalization first fails", async () => {
    mocks.getLineGroupAiInsight.mockResolvedValue({ analysisEnabled: false, proactiveAiEnabled: false, insight: null });
    mocks.finalizeLineOutgoingAudit.mockRejectedValueOnce(new Error("audit unavailable"));

    const firstResult = await checkAndSendGroupFollowUps();
    expect(firstResult).toMatchObject({ sent: 0, errors: 1 });
    expect(mocks.pushMessage).toHaveBeenCalledTimes(1);
    expect(mocks.claimCommitted).not.toHaveBeenCalled();

    mocks.reserveLineOutgoingAudit.mockResolvedValue({ created: false, status: "pending" });
    const secondResult = await checkAndSendGroupFollowUps();

    expect(secondResult).toMatchObject({ sent: 1, errors: 0 });
    expect(mocks.pushMessage).toHaveBeenCalledTimes(2);
    expect(mocks.pushMessage.mock.calls[0][2]).toBe(mocks.pushMessage.mock.calls[1][2]);
    expect(mocks.claimCommitted).toHaveBeenCalledTimes(1);
  });

  it("reconciles an already finalized audit without calling LINE again", async () => {
    mocks.getLineGroupAiInsight.mockResolvedValue({ analysisEnabled: false, proactiveAiEnabled: false, insight: null });
    mocks.reserveLineOutgoingAudit.mockResolvedValue({ created: false, status: "responded" });

    const result = await checkAndSendGroupFollowUps();

    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(mocks.pushMessage).not.toHaveBeenCalled();
    expect(mocks.finalizeLineOutgoingAudit).not.toHaveBeenCalled();
    expect(mocks.claimCommitted).toHaveBeenCalledTimes(1);
  });

  it.each(["cancelled", "none"])("never replays a terminal %s audit", async status => {
    mocks.getLineGroupAiInsight.mockResolvedValue({ analysisEnabled: false, proactiveAiEnabled: false, insight: null });
    mocks.reserveLineOutgoingAudit.mockResolvedValue({ created: false, status });

    const result = await checkAndSendGroupFollowUps();

    expect(result).toMatchObject({ sent: 0, errors: 1 });
    expect(mocks.pushMessage).not.toHaveBeenCalled();
    expect(mocks.finalizeLineOutgoingAudit).not.toHaveBeenCalled();
    expect(mocks.claimCommitted).not.toHaveBeenCalled();
  });

  it("preserves the fixed-message path only when the locked mode remains fixed", async () => {
    mocks.getLineGroupAiInsight.mockResolvedValue({ analysisEnabled: false, proactiveAiEnabled: false, insight: null });

    const result = await checkAndSendGroupFollowUps();

    expect(result).toMatchObject({ sent: 1, errors: 0 });
    expect(mocks.getLineGroupProactiveSuggestion).not.toHaveBeenCalled();
    expect(mocks.pushMessage).toHaveBeenCalledWith(
      dueGroup.lineGroupId,
      [{ type: "text", text: "固定文面" }],
      expect.any(String),
    );
  });
});
