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
const personHistorySource = readFileSync(
  resolve(root, "server/linePersonTalkHistory.ts"),
  "utf8"
);
const personHistoryMigrationSource = readFileSync(
  resolve(root, "drizzle/0159_line_person_talk_history.sql"),
  "utf8"
);
const groupReplyReviewSource = readFileSync(
  resolve(root, "server/lineGroupReplyReview.ts"),
  "utf8"
);
const groupReplyReviewUiSource = readFileSync(
  resolve(root, "client/src/pages/LineGroupReplyReviewQueue.tsx"),
  "utf8"
);
const groupReplyReviewMigrationSource = readFileSync(
  resolve(root, "drizzle/0160_line_group_reply_review.sql"),
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
    expect(dbSource).toContain(
      "export async function ensureLineGroupLifecycleStorage"
    );
    expect(webhookSource).toContain("await ensureLineGroupLifecycleStorage()");
    expect(webhookSource).toContain("Lifecycle storage setup failed");
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

  it("returns and displays current LINE group member counts without treating failures as zero", () => {
    expect(routerSource).toContain("getActiveLineGroupMemberCounts(activeGroups)");
    expect(routerSource).toContain("memberCounts,");
    expect(uiSource).toContain("setGroupMemberCounts(result.memberCounts)");
    expect(uiSource).toContain("getGroupMemberCountLabel(group.lineGroupId)");
    expect(uiSource).toContain("getGroupMemberCountLabel(selectedGroup?.lineGroupId)");
    expect(uiSource).toContain("参加人数を取得できません");
  });

  it("keeps the group hidden when LINE leave succeeded but local sync is pending", () => {
    expect(uiSource).toContain("result.localSyncPending");
    expect(uiSource).toContain("LINE退会は完了しました。管理画面の同期を再試行します");
  });

  it("shows every stored conversation for linked and unlinked participants across DM and groups", () => {
    expect(routerSource).toContain("getPersonTalkHistory: protectedProcedure");
    expect(routerSource).toContain("assertLineManagementAdmin(ctx.user)");
    expect(personHistorySource).toContain("WHERE lineUserId = ${lineUserId}");
    expect(personHistorySource).toContain("ORDER BY id DESC");
    expect(personHistorySource).toContain("nextCursor:");
    expect(personHistorySource).toContain("COUNT(DISTINCT CASE WHEN lineGroupId IS NOT NULL");
    expect(personHistorySource).toContain("direction = 'outgoing' AND responseStatus = 'cancelled'");
    expect(uiSource).toContain("人物別・全トーク履歴");
    expect(uiSource).toContain("さらに古い100件を読み込む");
    expect(uiSource).toContain("この人の全トーク履歴を表示");
    expect(uiSource).toContain("未連携参加者");
    expect(personHistoryMigrationSource).toContain("idx_line_messages_user_history");
    expect(schemaSource).toContain('index("idx_line_messages_user_history").on(table.lineUserId, table.id)');
    expect(migrationRunnerSource).toContain("0159_line_person_talk_history.sql");
    expect(migrationRunnerSource).toContain("isDuplicateMysqlIndex(error, 'idx_line_messages_user_history')");
  });

  it("separates invited-group AI reply review from direct LINE history and pending items", () => {
    expect(routerSource).toContain("getGroupReplyReviewQueue: protectedProcedure.query");
    expect(routerSource).toContain("dismissGroupReplyReviewItem: protectedProcedure");
    expect(routerSource).toContain("LINE_GROUP_REPLY_REVIEW_READ_FAILED");
    expect(routerSource).toContain("LINE_GROUP_REPLY_REVIEW_DISMISS_FAILED");
    expect(groupReplyReviewSource).toContain("candidate.sourceType = 'group'");
    expect(groupReplyReviewSource).toContain("lifecycle.isActive = TRUE");
    expect(groupReplyReviewSource).toContain("outgoing.direction = 'outgoing'");
    expect(groupReplyReviewSource).toContain("incoming.responseStatus NOT IN ('responded', 'cancelled')");
    expect(groupReplyReviewSource).toContain("candidate.responseStatus NOT IN ('responded', 'cancelled')");
    expect(groupReplyReviewSource).toContain("candidateSender.userType");
    expect(groupReplyReviewSource).toContain("pendingOutgoing.responseStatus = 'pending'");
    expect(dbSource).toContain("isNull(lineMessages.lineGroupId)");
    expect(uiSource).toContain('sourceType: "user"');
    expect(uiSource).toContain("グループAI返信確認");
    expect(uiSource).toContain("ここは公式LINEとの1対1トーク履歴です");
    expect(uiSource).toContain('language === "ja" ? "個別LINE" : "个人LINE"');
    expect(uiSource).toContain('language === "ja" ? "未応答" : "待回复"');
    expect(uiSource).toContain('tabFromUrl || "group-reply-review"');
    expect(uiSource).toContain("グループ対応");
    expect(uiSource).toContain("個別LINE");
    expect(uiSource).toContain("管理・連携");
    expect(uiSource).toContain("2xl:grid-cols-[1.05fr_1.35fr_1.35fr]");
    expect(uiSource).toContain("grid grid-cols-1 gap-1 sm:grid-cols-2");
    expect(uiSource).not.toContain('TabsList className="h-auto flex-wrap justify-start"');
  });

  it("prioritizes AI-recommended group replies but always requires human review before send", () => {
    expect(groupReplyReviewUiSource).toContain("AI返信推奨");
    expect(groupReplyReviewUiSource).toContain("返信不要候補");
    expect(groupReplyReviewUiSource).toContain("AIおすすめ返信（未送信）");
    expect(groupReplyReviewUiSource).toContain("文案を確認して返信");
    expect(groupReplyReviewUiSource).toContain("個別LINEの履歴・未応答はここには入りません");
    expect(uiSource).toContain("setGroupAiDraftPendingReview(Boolean(prefill))");
    expect(uiSource).toContain("groupAiDraftPendingReview && !groupAiDraftReviewed");
    const sendHandler = uiSource.slice(
      uiSource.indexOf("const handleSendGroupMessage"),
      uiSource.indexOf("const applyGroupManualMessageTemplate"),
    );
    expect(sendHandler).toContain("groupAiDraftPendingReview && !groupAiDraftReviewed");
    expect(sendHandler.indexOf("groupAiDraftPendingReview && !groupAiDraftReviewed"))
      .toBeLessThan(sendHandler.indexOf("sendMessageMutation.mutate"));
    expect(uiSource).toContain("内容を確認しました");
    expect(uiSource).toContain("expectedGroupConversationRevision: groupReplyExpectedRevision ?? undefined");
    expect(routerSource).toContain("LINE_GROUP_CONVERSATION_CHANGED");
    expect(dbSource).toContain("expectedGroupConversationRevision");
    expect(groupReplyReviewUiSource).toContain("送信処理中");
    expect(groupReplyReviewUiSource).toContain("判断に使うグループ会話");
    expect(groupReplyReviewUiSource).toContain("LCJスタッフ");
    expect(groupReplyReviewUiSource).toContain("LCJ公式送信");
    expect(groupReplyReviewUiSource).toContain("ユーザータイプ＝スタッフ");
    expect(groupReplyReviewUiSource).toContain("participantTypeLabel");
    expect(groupReplyReviewUiSource).toContain("contextMessages.map");
    expect(groupReplyReviewSource).toContain("ROW_NUMBER() OVER");
    expect(groupReplyReviewSource).toContain("contextSender.userType");
    expect(groupReplyReviewSource).toContain("previousOutgoingSender.userType = 'staff'");
    expect(groupReplyReviewSource).toContain("outgoingSender.userType = 'staff'");
    expect(groupReplyReviewSource).toContain("isConversationResponseContextMessage");
    expect(groupReplyReviewSource).toContain("responseAt === receivedAt.getTime() && message.id > incomingMessageDbId");
    expect(groupReplyReviewUiSource).not.toContain("sendMessage.mutate");
  });

  it("adds a non-destructive group history index and Railway fallback", () => {
    expect(groupReplyReviewMigrationSource).toContain("CREATE INDEX `idx_line_messages_group_direction_history`");
    expect(groupReplyReviewMigrationSource).toContain("`lineGroupId`, `sourceType`, `direction`, `lineTimestamp`, `id`");
    expect(groupReplyReviewMigrationSource).not.toContain("DROP");
    expect(schemaSource).toContain('index("idx_line_messages_group_direction_history")');
    expect(migrationRunnerSource).toContain("0160_line_group_reply_review.sql");
    expect(migrationRunnerSource).toContain("isDuplicateMysqlIndex(error, 'idx_line_messages_group_direction_history')");
  });
});
