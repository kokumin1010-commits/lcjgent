import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");
const webhookSource = readFileSync(resolve(root, "server/_core/index.ts"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migrationSource = readFileSync(
  resolve(root, "drizzle/0143_line_group_lifecycle_order.sql"),
  "utf8"
);
const migrationRunnerSource = readFileSync(
  resolve(root, "run-migrations.mjs"),
  "utf8"
);
const uiSource = readFileSync(
  resolve(root, "client/src/pages/LineManagement.tsx"),
  "utf8"
);

describe("LINE group management regression contracts", () => {
  it("keeps normal list reads local and exposes explicit admin reconciliation", () => {
    const listStart = routerSource.indexOf("listGroups: protectedProcedure.query");
    const listEnd = routerSource.indexOf("syncGroups: protectedProcedure.mutation");
    const listBlock = routerSource.slice(listStart, listEnd);

    expect(listBlock).toContain("getAllLineGroups()");
    expect(listBlock).not.toContain("reconcileActiveLineGroups");
    expect(routerSource).toContain("syncGroups: protectedProcedure.mutation");
    expect(routerSource).toContain("reconcileActiveLineGroups(groups)");
  });

  it("protects manual leave and routes it through the durable lifecycle service", () => {
    expect(routerSource).toContain(
      "leaveLineGroupAndDeactivate(input.lineGroupId)"
    );
    expect(routerSource).toContain('ctx.user.role !== "admin"');
    expect(routerSource).toContain("getLineGroupByLineId(input.lineGroupId)");
    expect(routerSource).toContain("!group || !group.isActive");
    expect(routerSource).toContain('code: "BAD_GATEWAY"');
  });

  it("reactivates a previously left row only through a timestamped join event", () => {
    const createOrUpdateBlock = dbSource.slice(
      dbSource.indexOf("export async function createOrUpdateLineGroup"),
      dbSource.indexOf("// Update LINE group active status")
    );
    expect(createOrUpdateBlock).not.toContain("isActive: true");
    expect(webhookSource).toContain(
      "await db.updateLineGroupActive(event.source.groupId, true"
    );
    expect(webhookSource).toContain(
      "await db.updateLineGroupActive(event.source.groupId, false"
    );
    expect(webhookSource).toContain("eventTimestamp: event.timestamp");
    expect(webhookSource).toContain("getLineWebhookLifecycleEventId({");
    expect(webhookSource).toContain("webhookEventId: event.webhookEventId");
  });

  it("persists lifecycle order and rejects older webhook state", () => {
    expect(schemaSource).toContain(
      'lineGroupLifecycleStates = mysqlTable("line_group_lifecycle_states"'
    );
    expect(dbSource).toContain("shouldApplyLineGroupLifecycleEvent");
    expect(dbSource).toContain('.for("update")');
    expect(dbSource).toContain("return false");
    expect(migrationSource).toContain(
      "CREATE TABLE IF NOT EXISTS `line_group_lifecycle_states`"
    );
    expect(migrationSource).not.toContain("ALTER TABLE `line_groups`");
    expect(migrationRunnerSource).toContain("0143_line_group_lifecycle_order.sql");
  });

  it("exposes a read-only deployment gate for the lifecycle table and all required columns", () => {
    expect(webhookSource).toContain(
      'app.get("/api/health/line-group-lifecycle"'
    );
    expect(webhookSource).toContain("getLineGroupLifecycleStorageHealth");
    expect(dbSource).toContain(
      "export async function getLineGroupLifecycleStorageHealth"
    );
    expect(dbSource).toContain("lastEventAt: lineGroupLifecycleStates.lastEventAt");
    expect(dbSource).toContain("lastEventId: lineGroupLifecycleStates.lastEventId");
    expect(dbSource).toContain("updatedAt: lineGroupLifecycleStates.updatedAt");
  });

  it("optimistically removes the card and restores it when the mutation fails", () => {
    expect(uiSource).toContain("utils.line.listGroups.cancel()");
    expect(uiSource).toContain(
      "previousGroups?.filter((group) => group.lineGroupId !== lineGroupId)"
    );
    expect(uiSource).toContain(
      "restoredGroups.splice(Math.max(0, context?.previousIndex ?? 0), 0, failedGroup)"
    );
    expect(uiSource).toContain("utils.line.listGroups.invalidate()");
  });

  it("runs remote reconciliation only when the group tab is opened or refreshed", () => {
    expect(uiSource).toContain("groupSyncRequestedRef.current");
    expect(uiSource).toContain("syncGroupsMutation.mutate()");
    expect(uiSource).toContain('activeTab !== "groups"');
  });

  it("keeps the group hidden when LINE leave succeeded but local sync is pending", () => {
    expect(uiSource).toContain("result.localSyncPending");
    expect(uiSource).toContain("LINE退会は完了しました。管理画面の同期を再試行します");
  });
});
