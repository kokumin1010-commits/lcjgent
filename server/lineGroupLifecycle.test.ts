import { afterEach, describe, expect, it, vi } from "vitest";
import { getGroupSummary, getLineGroupMemberCount, leaveGroup } from "./line";
import {
  getActiveLineGroupMemberCounts,
  leaveLineGroupAndDeactivate,
  reconcileActiveLineGroups,
  syncLineGroupMetadata,
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

  it("refreshes the stored title and avatar from the LINE group summary", async () => {
    const createOrUpdateLineGroup = vi.fn().mockResolvedValue({ id: 1 });

    const result = await syncLineGroupMetadata("C-renamed", {
      getGroupSummary: vi.fn().mockResolvedValue({
        groupId: "C-renamed",
        groupName: "新しい配信チーム名",
        pictureUrl: "https://example.com/new-group.jpg",
      }),
      createOrUpdateLineGroup,
    });

    expect(result).toEqual({
      updated: true,
      groupName: "新しい配信チーム名",
      pictureUrl: "https://example.com/new-group.jpg",
    });
    expect(createOrUpdateLineGroup).toHaveBeenCalledWith({
      lineGroupId: "C-renamed",
      groupName: "新しい配信チーム名",
      pictureUrl: "https://example.com/new-group.jpg",
      initialIsActive: false,
    });
  });

  it("does not overwrite stored metadata when the LINE summary lookup fails", async () => {
    const createOrUpdateLineGroup = vi.fn();

    const result = await syncLineGroupMetadata("C-temporary-error", {
      getGroupSummary: vi.fn().mockResolvedValue(null),
      createOrUpdateLineGroup,
    });

    expect(result).toEqual({ updated: false });
    expect(createOrUpdateLineGroup).not.toHaveBeenCalled();
  });

  it("clears a stale stored avatar when the LINE summary has no picture", async () => {
    const createOrUpdateLineGroup = vi.fn().mockResolvedValue({ id: 1 });

    const result = await syncLineGroupMetadata("C-avatar-removed", {
      getGroupSummary: vi.fn().mockResolvedValue({
        groupId: "C-avatar-removed",
        groupName: "画像なしグループ",
      }),
      createOrUpdateLineGroup,
    });

    expect(result).toEqual({
      updated: true,
      groupName: "画像なしグループ",
      pictureUrl: null,
    });
    expect(createOrUpdateLineGroup).toHaveBeenCalledWith({
      lineGroupId: "C-avatar-removed",
      groupName: "画像なしグループ",
      pictureUrl: null,
      initialIsActive: false,
    });
  });

  it("applies an abort timeout signal to group summary refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      groupId: "C-summary-timeout",
      groupName: "更新後グループ名",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getGroupSummary("C-summary-timeout")).resolves.toMatchObject({
      groupName: "更新後グループ名",
    });
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it("returns the LINE-provided group member count", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"count":42}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getLineGroupMemberCount("C-member-count");

    expect(result).toEqual({ count: 42, status: 200 });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/group/C-member-count/members/count"
    );
  });

  it("never represents a failed member count lookup as zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"message":"rate limited"}', { status: 429 }))
    );

    const result = await getLineGroupMemberCount("C-rate-limited");

    expect(result).toMatchObject({ count: null, status: 429 });
  });

  it("maps current counts and preserves individual lookup failures as null", async () => {
    const groups = [
      { lineGroupId: "C-one", groupName: "one" },
      { lineGroupId: "C-two", groupName: "two" },
    ];

    const result = await getActiveLineGroupMemberCounts(groups, {
      getMemberCount: vi.fn(async (lineGroupId: string) => (
        lineGroupId === "C-one"
          ? { count: 12, status: 200 }
          : { count: null, status: 503, error: "temporary" }
      )),
    });

    expect(result).toEqual({ "C-one": 12, "C-two": null });
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
