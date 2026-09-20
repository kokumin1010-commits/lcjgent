import {
  getGroupSummary,
  getLineGroupMemberCount,
  getLineGroupMembershipState,
  leaveGroup,
  type LineGroupMemberCountResult,
  type LineGroupMembershipState,
} from "./line";
import { createOrUpdateLineGroup, updateLineGroupActive } from "./db";

export type LineGroupRecord = {
  lineGroupId: string;
};

export type LeaveLineGroupResult = {
  success: boolean;
  alreadyLeft: boolean;
  localSyncPending?: boolean;
  status: number | null;
  error?: string;
};

type LeaveLineGroupDependencies = {
  leaveGroup: typeof leaveGroup;
  updateLineGroupActive: typeof updateLineGroupActive;
};

type ReconcileLineGroupDependencies = {
  getMembershipState: (lineGroupId: string) => Promise<LineGroupMembershipState>;
  updateLineGroupActive: typeof updateLineGroupActive;
  getGroupSummary?: typeof getGroupSummary;
  createOrUpdateLineGroup?: typeof createOrUpdateLineGroup;
};

type SyncLineGroupMetadataDependencies = {
  getGroupSummary: typeof getGroupSummary;
  createOrUpdateLineGroup: typeof createOrUpdateLineGroup;
};

type LineGroupMemberCountDependencies = {
  getMemberCount: (lineGroupId: string) => Promise<LineGroupMemberCountResult>;
};

const defaultLeaveDependencies: LeaveLineGroupDependencies = {
  leaveGroup,
  updateLineGroupActive,
};

const defaultReconcileDependencies: ReconcileLineGroupDependencies = {
  getMembershipState: getLineGroupMembershipState,
  updateLineGroupActive,
  getGroupSummary,
  createOrUpdateLineGroup,
};

const defaultSyncMetadataDependencies: SyncLineGroupMetadataDependencies = {
  getGroupSummary,
  createOrUpdateLineGroup,
};

const defaultMemberCountDependencies: LineGroupMemberCountDependencies = {
  getMemberCount: getLineGroupMemberCount,
};

export type LineGroupMemberCounts = Record<string, number | null>;

/**
 * Refresh a group's current LINE title and avatar without overwriting stored
 * metadata when the summary endpoint is unavailable or times out.
 */
export async function syncLineGroupMetadata(
  lineGroupId: string,
  dependencies: SyncLineGroupMetadataDependencies = defaultSyncMetadataDependencies,
): Promise<{ updated: boolean; groupName?: string; pictureUrl?: string | null }> {
  const summary = await dependencies.getGroupSummary(lineGroupId);
  if (!summary?.groupName) {
    return { updated: false };
  }

  await dependencies.createOrUpdateLineGroup({
    lineGroupId,
    groupName: summary.groupName,
    pictureUrl: summary.pictureUrl ?? null,
  });

  return {
    updated: true,
    groupName: summary.groupName,
    pictureUrl: summary.pictureUrl ?? null,
  };
}

/**
 * Fetch current LINE group member counts with bounded concurrency. Failed
 * lookups remain null so the UI can show "取得できません" instead of a false 0.
 */
export async function getActiveLineGroupMemberCounts<T extends LineGroupRecord>(
  groups: T[],
  dependencies: LineGroupMemberCountDependencies = defaultMemberCountDependencies,
  concurrency = 5
): Promise<LineGroupMemberCounts> {
  const memberCounts: LineGroupMemberCounts = {};
  if (groups.length === 0) return memberCounts;

  const workerCount = Math.max(1, Math.min(concurrency, groups.length));
  let nextIndex = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= groups.length) return;

      const lineGroupId = groups[index].lineGroupId;
      try {
        const result = await dependencies.getMemberCount(lineGroupId);
        memberCounts[lineGroupId] = result.count;
      } catch (error) {
        console.error(
          `[LINE Group] Failed to get member count for ${lineGroupId}:`,
          error
        );
        memberCounts[lineGroupId] = null;
      }
    }
  });

  await Promise.all(workers);
  return memberCounts;
}

/**
 * LINE側の退会が成功した場合、または既に退会済みと確認できた場合だけ
 * DBを非アクティブ化する。認証障害や一時障害では表示を消さない。
 */
export async function leaveLineGroupAndDeactivate(
  lineGroupId: string,
  dependencies: LeaveLineGroupDependencies = defaultLeaveDependencies
): Promise<LeaveLineGroupResult> {
  const leaveRequestedAt = Date.now();
  const result = await dependencies.leaveGroup(lineGroupId);

  if (!result.success && !result.alreadyLeft) {
    return result;
  }

  try {
    const applied = await dependencies.updateLineGroupActive(
      lineGroupId,
      false,
      {
        eventTimestamp: leaveRequestedAt,
        eventId: `local:leave:${leaveRequestedAt}:${lineGroupId}`,
      }
    );
    if (!applied) {
      return {
        ...result,
        success: true,
        localSyncPending: true,
        error: "LOCAL_GROUP_STATE_SYNC_CONFLICT",
      };
    }
  } catch (error) {
    console.error(
      `[LINE Group] LINE leave succeeded but local state sync is pending for ${lineGroupId}:`,
      error
    );
    return {
      ...result,
      success: true,
      localSyncPending: true,
      error: "LOCAL_GROUP_STATE_SYNC_PENDING",
    };
  }

  return {
    ...result,
    success: true,
    localSyncPending: false,
  };
}

/**
 * 管理画面に保存されているアクティブグループをLINE側と照合する。
 * 退会済みを意味する400/404だけを非アクティブ化し、401/403/429/5xxや
 * 通信障害ではグループを残すことで誤消去を防ぐ。
 */
export async function reconcileActiveLineGroups<T extends LineGroupRecord>(
  groups: T[],
  dependencies: ReconcileLineGroupDependencies = defaultReconcileDependencies,
  concurrency = 5
): Promise<T[]> {
  if (groups.length === 0) return [];

  const activeGroups: T[] = [];
  const workerCount = Math.max(1, Math.min(concurrency, groups.length));
  let nextIndex = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= groups.length) return;

      const group = groups[index];
      let membership: LineGroupMembershipState;
      const membershipObservedAt = Date.now();

      try {
        membership = await dependencies.getMembershipState(group.lineGroupId);
      } catch (error) {
        console.error(
          `[LINE Group] Failed to reconcile ${group.lineGroupId}:`,
          error
        );
        activeGroups[index] = group;
        continue;
      }

      if (membership.state === "not_member") {
        try {
          const applied = await dependencies.updateLineGroupActive(
            group.lineGroupId,
            false,
            {
              eventTimestamp: membershipObservedAt,
              eventId: `sync:${membershipObservedAt}:${group.lineGroupId}`,
            }
          );
          if (!applied) {
            activeGroups[index] = group;
            continue;
          }
          console.log(
            `[LINE Group] Marked stale group inactive after LINE membership check: ${group.lineGroupId}`
          );
        } catch (error) {
          console.error(
            `[LINE Group] Failed to persist inactive state for ${group.lineGroupId}:`,
            error
          );
          activeGroups[index] = group;
        }
        continue;
      }

      if (
        membership.state === "member" &&
        dependencies.getGroupSummary &&
        dependencies.createOrUpdateLineGroup
      ) {
        try {
          await syncLineGroupMetadata(group.lineGroupId, {
            getGroupSummary: dependencies.getGroupSummary,
            createOrUpdateLineGroup: dependencies.createOrUpdateLineGroup,
          });
        } catch (error) {
          console.error(
            `[LINE Group] Failed to refresh metadata for ${group.lineGroupId}:`,
            error
          );
        }
      }

      // Keep confirmed members and unknown states. Unknown includes credential,
      // rate-limit, network and LINE server failures, none of which prove departure.
      activeGroups[index] = group;
    }
  });

  await Promise.all(workers);
  return activeGroups.filter((group): group is T => Boolean(group));
}
