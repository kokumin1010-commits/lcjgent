import { afterEach, describe, expect, it, vi } from "vitest";
import { leaveGroup } from "./line";
import {
  leaveLineGroupAndDeactivate,
  reconcileActiveLineGroups,
} from "./lineGroupLifecycle";
import { shouldApplyLineGroupLifecycleEvent } from "./lineGroupLifecycleOrder";

describe("LINE group lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("deactivates the local group after LINE confirms leave", async () => {
    const updateLineGroupActive = vi.fn().mockResolvedValue(true);

    const result = await leaveLineGroupAndDeactivate("C-active", {
      leaveGroup: vi.fn().mockResolvedValue({
        success: true,
        alreadyLeft: false,
        status: 200,
      }),
      updateLineGroupActive,
    });

    expect(result).toMatchObject({
      success: true,
      alreadyLeft: false,
      localSyncPending: false,
    });
    expect(updateLineGroupActive).toHaveBeenCalledOnce();
    expect(updateLineGroupActive).toHaveBeenCalledWith(
      "C-active",
      false,
      expect.objectContaining({
        eventTimestamp: expect.any(Number),
        eventId: expect.stringMatching(/^local:leave:/),
      })
    );
  });

  it("deactivates a stale local row when LINE confirms it was already left", async () => {
    const updateLineGroupActive = vi.fn().mockResolvedValue(true);

    const result = await leaveLineGroupAndDeactivate("C-stale", {
      leaveGroup: vi.fn().mockResolvedValue({
        success: true,
        alreadyLeft: true,
        status: 400,
      }),
      updateLineGroupActive,
    });

    expect(result).toMatchObject({ success: true, alreadyLeft: true });
    expect(updateLineGroupActive).toHaveBeenCalledWith(
      "C-stale",
      false,
      expect.objectContaining({
        eventTimestamp: expect.any(Number),
        eventId: expect.stringMatching(/^local:leave:/),
      })
    );
  });

  it("does not hide a group when LINE has an authentication or temporary failure", async () => {
    const updateLineGroupActive = vi.fn().mockResolvedValue(true);

    const result = await leaveLineGroupAndDeactivate("C-unknown", {
      leaveGroup: vi.fn().mockResolvedValue({
        success: false,
        alreadyLeft: false,
        status: 503,
        error: "temporary",
      }),
      updateLineGroupActive,
    });

    expect(result.success).toBe(false);
    expect(updateLineGroupActive).not.toHaveBeenCalled();
  });

  it("reports local sync pending instead of telling the client that LINE leave failed", async () => {
    const result = await leaveLineGroupAndDeactivate("C-local-sync", {
      leaveGroup: vi.fn().mockResolvedValue({
        success: true,
        alreadyLeft: false,
        status: 200,
      }),
      updateLineGroupActive: vi.fn().mockRejectedValue(new Error("db unavailable")),
    });

    expect(result).toMatchObject({
      success: true,
      alreadyLeft: false,
      localSyncPending: true,
      error: "LOCAL_GROUP_STATE_SYNC_PENDING",
    });
  });

  it("reports local sync pending when a newer lifecycle state rejects the update", async () => {
    const result = await leaveLineGroupAndDeactivate("C-conflict", {
      leaveGroup: vi.fn().mockResolvedValue({
        success: true,
        alreadyLeft: false,
        status: 200,
      }),
      updateLineGroupActive: vi.fn().mockResolvedValue(false),
    });

    expect(result).toMatchObject({
      success: true,
      localSyncPending: true,
      error: "LOCAL_GROUP_STATE_SYNC_CONFLICT",
    });
  });

  it("cannot overwrite a join that happens after the leave request starts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const joinedState = { eventTimestamp: 1_500, eventId: "webhook-join" };

    const result = await leaveLineGroupAndDeactivate("C-leave-race", {
      leaveGroup: vi.fn(async () => {
        vi.setSystemTime(2_000);
        return {
          success: true,
          alreadyLeft: false,
          status: 200,
        };
      }),
      updateLineGroupActive: vi.fn(async (
        _lineGroupId: string,
        _isActive: boolean,
        lifecycle?: { eventTimestamp?: number; eventId?: string }
      ) => shouldApplyLineGroupLifecycleEvent(
        {
          eventTimestamp: lifecycle?.eventTimestamp ?? 0,
          eventId: lifecycle?.eventId ?? "",
        },
        joinedState
      )),
    });

    expect(result).toMatchObject({
      success: true,
      localSyncPending: true,
      error: "LOCAL_GROUP_STATE_SYNC_CONFLICT",
    });
  });

  it("removes only confirmed stale groups whose DB update was applied", async () => {
    const groups = [
      { lineGroupId: "C-member", groupName: "member" },
      { lineGroupId: "C-stale", groupName: "stale" },
      { lineGroupId: "C-unknown", groupName: "unknown" },
    ];
    const updateLineGroupActive = vi.fn().mockResolvedValue(true);
    const getMembershipState = vi.fn(async (lineGroupId: string) => {
      if (lineGroupId === "C-member") {
        return { state: "member" as const, status: 200 };
      }
      if (lineGroupId === "C-stale") {
        return { state: "not_member" as const, status: 404 };
      }
      return { state: "unknown" as const, status: 429 };
    });

    const result = await reconcileActiveLineGroups(groups, {
      getMembershipState,
      updateLineGroupActive,
    });

    expect(result.map((group) => group.lineGroupId)).toEqual([
      "C-member",
      "C-unknown",
    ]);
    expect(updateLineGroupActive).toHaveBeenCalledOnce();
    expect(updateLineGroupActive).toHaveBeenCalledWith(
      "C-stale",
      false,
      expect.objectContaining({
        eventTimestamp: expect.any(Number),
        eventId: expect.stringMatching(/^sync:/),
      })
    );
  });

  it("cannot overwrite a join that happens after the membership request starts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const groups = [{ lineGroupId: "C-race", groupName: "race" }];
    const getMembershipState = vi.fn(async () => {
      vi.setSystemTime(2_000);
      return { state: "not_member" as const, status: 404 };
    });
    const updateLineGroupActive = vi.fn(async (
      _lineGroupId: string,
      _isActive: boolean,
      lifecycle?: { eventTimestamp?: number }
    ) => lifecycle?.eventTimestamp !== 1_000);

    const result = await reconcileActiveLineGroups(groups, {
      getMembershipState,
      updateLineGroupActive,
    });

    expect(updateLineGroupActive).toHaveBeenCalledWith(
      "C-race",
      false,
      expect.objectContaining({ eventTimestamp: 1_000 })
    );
    expect(result).toEqual(groups);
    vi.useRealTimers();
  });

  it("keeps a group visible if reconciliation itself fails", async () => {
    const updateLineGroupActive = vi.fn().mockResolvedValue(true);
    const groups = [{ lineGroupId: "C-network", groupName: "network" }];

    const result = await reconcileActiveLineGroups(groups, {
      getMembershipState: vi.fn().mockRejectedValue(new Error("network")),
      updateLineGroupActive,
    });

    expect(result).toEqual(groups);
    expect(updateLineGroupActive).not.toHaveBeenCalled();
  });

  it("keeps a confirmed stale group visible if the DB update fails", async () => {
    const groups = [{ lineGroupId: "C-db-failure", groupName: "db failure" }];

    const result = await reconcileActiveLineGroups(groups, {
      getMembershipState: vi.fn().mockResolvedValue({
        state: "not_member",
        status: 404,
      }),
      updateLineGroupActive: vi.fn().mockRejectedValue(new Error("db unavailable")),
    });

    expect(result).toEqual(groups);
  });

  it("keeps a confirmed stale group visible when its state update loses ordering", async () => {
    const groups = [{ lineGroupId: "C-order-conflict", groupName: "conflict" }];

    const result = await reconcileActiveLineGroups(groups, {
      getMembershipState: vi.fn().mockResolvedValue({
        state: "not_member",
        status: 404,
      }),
      updateLineGroupActive: vi.fn().mockResolvedValue(false),
    });

    expect(result).toEqual(groups);
  });

  it("treats LINE 400 plus unavailable summary as already left", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"Bad Request"}', { status: 400 }))
      .mockResolvedValueOnce(new Response('{"message":"Not Found"}', { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await leaveGroup("C-already-left");

    expect(result).toMatchObject({
      success: true,
      alreadyLeft: true,
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/leave");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/summary");
  });

  it("does not treat an expired token as a successful leave", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"Bad Request"}', { status: 400 }))
      .mockResolvedValueOnce(new Response('{"message":"Unauthorized"}', { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await leaveGroup("C-auth-failure");

    expect(result).toMatchObject({
      success: false,
      alreadyLeft: false,
      status: 400,
    });
  });
});
