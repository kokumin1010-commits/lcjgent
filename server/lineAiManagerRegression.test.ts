import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const agent = read("server/lineAgent.ts");
const manager = read("server/lineAiManager.ts");
const llm = read("server/_core/llm.ts");
const webhook = read("server/lineWebhook.ts");
const db = read("server/db.ts");
const router = read("server/routers.ts");
const server = read("server/_core/index.ts");
const schema = read("drizzle/schema.ts");
const migration = read("drizzle/0145_line_ai_manager.sql");
const groupInsightMigration = read("drizzle/0147_line_group_ai_insights.sql");
const groupDraftAuditMigration = read("drizzle/0151_line_group_ai_draft_audit.sql");
const groupAutomationMigration = read("drizzle/0154_line_group_automation_defaults.sql");
const migrationRunner = read("run-migrations.mjs");
const ui = read("client/src/pages/LineManagement.tsx");
const messaging = read("server/_core/lineMessaging.ts");
const lineTransport = read("server/line.ts");
const groupFollowUp = read("server/groupFollowUpScheduler.ts");
const groupOnboarding = read("server/lineGroupOnboarding.ts");
const groupPublicQuestion = read("server/lineGroupPublicQuestion.ts");
const groupOnboardingMigration = read("drizzle/0157_line_group_onboarding.sql");
const groupLifecycle = read("server/lineGroupLifecycle.ts");
const groupDeliveryGuard = read("server/lineGroupDeliveryGuard.ts");
const liveSuggestionScheduler = read("server/liveSuggestionScheduler.ts");
const dailyRankingScheduler = read("server/dailyRankingScheduler.ts");
const weeklyReportScheduler = read("server/weeklyReportScheduler.ts");
const monthlyReportScheduler = read("server/monthlyReportScheduler.ts");
const scheduleReminderScheduler = read("server/scheduleReminderScheduler.ts");
const linePublicIdentity = read("shared/linePublicIdentity.ts");

describe("LCJ official LINE AI manager regression contracts", () => {
  it("keeps general customer AI disabled and delegates only the dedicated liver path", () => {
    expect(agent).toContain("LINE_GENERAL_AI_AUTO_REPLY_ENABLED = false");
    expect(agent).toContain('if (isGroupChat && !isExplicitGroupMention)');
    expect(agent).toContain('await import("./lineAiManager")');
    expect(agent).toContain("if (handledByAiManager) return");
    expect(manager).toContain('const isDirectMessage = event.source.type === "user"');
    expect(manager).toContain('const isGroupMention = event.source.type === "group"');
    expect(manager).toContain("eq(lineUsers.liverId, livers.id)");
    expect(manager).toContain("eq(lineUsers.lineUserId, livers.lineUserId)");
    expect(manager).toContain("eq(livers.isActive, true)");
    expect(webhook).toContain('.set({ liverId, userType: "liver" })');
    expect(db).toContain("and(isNull(lineUsers.liverId), eq(lineUsers.lineUserId, livers.lineUserId))");
  });

  it("preserves group safety and enables AI only for a linked person's explicit @LCJ mention", () => {
    expect(agent).toContain("containsExplicitLcjMention");
    expect(agent).not.toContain("/エージェントさん/i");
    expect(agent).not.toContain("/LCJエージェント/i");
    expect(agent).toContain("if (isGroupChat && !isExplicitGroupMention)");
    expect(agent).toContain("getGroupMemberProfile(groupId, userId)");
    expect(agent).toContain("if (isExplicitGroupMention)");
    expect(agent).toContain("canLineAiManagerReplyInGroup(groupId!, userId)");
    expect(agent).toContain("Group messages are exclusively owned by the dedicated AI-manager path");
    expect(agent).toContain("if (isGroupChat) return;");
    expect(manager).toContain("export async function canLineAiManagerReplyInGroup");
    expect(manager).toContain('lineGroupId: isGroupMention ? event.source.groupId : undefined');
    expect(manager).toContain("ingress.isExplicitBotMention === true");
    expect(agent).toContain("グループ内では照会・登録を行いません");
    expect(manager).toContain('channel: sourceLineGroupId ? "group" : "direct"');
    expect(manager).toContain("本人の過去DM、売上、内部メモ、次アクション、個人情報を絶対に開示しない");
    expect(manager).toContain("sourceLineGroupId || latestTarget.lineUserId");
    expect(manager).toContain('sourceType: lineGroupId ? "group" : "user"');
    expect(lineTransport).toContain("LINE_PROFILE_LOOKUP_TIMEOUT_MS");
    expect(agent).toContain("captureGroupTextMessage(");
    expect(agent).toContain("saveLineGroupInboundMessageAndActivity({");
    expect(agent).toContain("isExplicitGroupMention,");
    expect(agent).toContain("Stored group message without replying");
    expect(agent).toContain('needsResponse: false');
    expect(manager).toContain("getGroupConversationContext(lineGroupId)");
    expect(manager).toContain("const messages = await tx.select().from(lineMessages)");
    expect(manager).toContain('tiktokInsight: channel === "group" ? null : safeTikTokInsight');
    expect(manager).toContain('bio: channel === "direct" ? sanitizeForAi(params.target.liverBio, 500) : null');
    expect(manager).toContain('tiktokAccount: channel === "direct" ? params.target.tiktokAccount : null');
    expect(manager).toContain("isLineGroupAiReplyEnabled");
    expect(manager).toContain("LINE_GROUP_AI_REPLY_SETTINGS_UNAVAILABLE");
    expect(manager).toContain("canDeliverLineAiManagerGroupReply");
    expect(manager).toContain("group_disabled_before_send");
    const deliveryBlock = manager.slice(
      manager.indexOf("async function processAiManagerEvent"),
      manager.indexOf("export async function tryHandleLineAiManagerMessage"),
    );
    expect(deliveryBlock.indexOf("groupDeliveryEnabled = await canDeliverLineAiManagerGroupReply")).toBeGreaterThan(-1);
    expect(deliveryBlock.indexOf("groupDeliveryEnabled = await canDeliverLineAiManagerGroupReply")).toBeLessThan(
      deliveryBlock.lastIndexOf("await pushMessage("),
    );
  });

  it("allows only a durable and tightly bounded non-mention onboarding exception", () => {
    expect(groupOnboarding).toContain('const ONBOARDING_VERSION = "group_onboarding_v1"');
    expect(groupOnboarding).toContain("const ONBOARDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000");
    expect(groupOnboarding).toContain("const MAX_AUTOMATIC_REPLIES = 2");
    expect(groupOnboarding).toContain('"awaiting_profile"');
    expect(groupOnboarding).toContain('"awaiting_preferences"');
    expect(groupOnboarding).toContain('row.userType === "staff" || Boolean(row.isBlocked)');
    expect(groupOnboarding).toContain("Number(row.autoReplyCount || 0) >= MAX_AUTOMATIC_REPLIES");
    expect(groupOnboarding).toContain("const expiredByWallClock = Date.now() > expiresAtMs");
    expect(groupOnboarding).toContain("params.eventTimestamp < startedAtMs");
    expect(groupOnboarding).toContain("normalizeLineGroupBrandName");
    expect(groupOnboarding).toContain("LINE_PUBLIC_CONTACT_NAME");
    expect(groupOnboarding).toContain("LINE_INITIAL_AUTOMATION_NOTICE");
    expect(groupOnboarding).not.toContain("stripLinePublicSignature(delivery.replyText)");
    expect(linePublicIdentity).toContain('LINE_PUBLIC_CONTACT_NAME = "高橋 悠真"');
    expect(linePublicIdentity).toContain("初回のご案内と確認には自動サポートを利用しています");
    expect(groupOnboarding).not.toContain("invokeLLM");

    const delivery = groupOnboarding.slice(
      groupOnboarding.indexOf("async function deliverPendingOnboarding"),
      groupOnboarding.indexOf("export async function beginLineGroupOnboarding"),
    );
    expect(delivery.indexOf("reserveLineOutgoingAudit")).toBeGreaterThan(-1);
    expect(delivery.indexOf("reserveLineOutgoingAudit")).toBeLessThan(delivery.indexOf("await pushMessage("));
    expect(delivery).toContain("onboardingDeliveryRetryKey");
    expect(delivery).toContain("content: delivery.replyText");
    expect(delivery).toContain('text: delivery.replyText');
    expect(groupOnboarding).toContain("createLineRetryKey(`line-group-onboarding:${auditMessageId}`)");
    expect(delivery).toContain('reservation.status === "responded"');
    expect(delivery).toContain('reservation.status === "cancelled" || reservation.status === "none"');

    expect(server).toContain("const lifecycleApplied = await db.updateLineGroupActive");
    expect(server).toContain("db.getLineGroupLifecycleState");
    expect(server).toContain("compareLineGroupLifecycleOrder");
    expect(server).toContain("beginLineGroupOnboarding");
    const joinWebhookBlock = server.slice(
      server.indexOf('case "join":'),
      server.indexOf('case "leave":'),
    );
    expect(joinWebhookBlock.indexOf("db.getLineGroupLifecycleState")).toBeLessThan(
      joinWebhookBlock.indexOf("line.getGroupSummary"),
    );
    expect(joinWebhookBlock.indexOf("if (lifecycleOrder < 0)")).toBeLessThan(
      joinWebhookBlock.indexOf("line.getGroupSummary"),
    );
    expect(joinWebhookBlock).toContain("groupName: onboardingGroupName");
    expect(joinWebhookBlock).toContain("pictureUrl: groupSummary?.pictureUrl");
    expect(joinWebhookBlock).toContain("initialIsActive: false");
    expect(db).toContain("isActive: data.initialIsActive ?? false");
    expect(joinWebhookBlock.indexOf("initialIsActive: false")).toBeLessThan(
      joinWebhookBlock.indexOf("db.updateLineGroupActive"),
    );
    expect(manager).toContain("l.isActive AS lifecycleIsActive");
    expect(manager).toContain("row.lifecycleIsActive");
    expect(db).toContain("lifecycle.isActive IS NULL OR lifecycle.isActive = TRUE");
    expect(groupLifecycle).toContain("initialIsActive: false");
    expect(router).toContain("lifecycleIsActive: lineGroupLifecycleStates.isActive");
    expect(router).toContain("deliveryState[0]?.isActive");
    expect(router).toContain("deliveryState[0].lifecycleIsActive == null");
    expect(db).toContain("const activeGroupUpdate = {");
    expect(db).toContain('...(lifecycle?.groupName ? { groupName: lifecycle.groupName } : {})');
    expect(groupOnboarding).toContain("l.lastEventAt");
    expect(groupOnboarding).toContain("l.lastEventId");
    expect(groupOnboarding).toContain("LINE_GROUP_ONBOARDING_LIFECYCLE_TRANSITION_PENDING");
    expect(groupOnboarding).toContain("recoverPendingLineGroupOnboardingDeliveries");
    expect(manager).toContain('await import("./lineGroupOnboarding")');
    expect(manager).toContain("await recoverPendingLineGroupOnboardingDeliveries()");
    expect(db).toContain("if (!groups[0]) {");
    expect(db).toContain("await tx.insert(lineGroupLifecycleStates).values({");
    expect(db).toContain("if (isActive) return false");
    const lifecycleUpdate = db.slice(
      db.indexOf("export async function updateLineGroupActive"),
      db.indexOf("// Get LINE group by LINE group ID"),
    );
    const settingsUpsert = lifecycleUpdate.slice(lifecycleUpdate.indexOf("INSERT INTO line_group_settings"));
    expect(settingsUpsert).not.toContain("autoReplyEnabled = true");
    expect(settingsUpsert).not.toContain("analysisEnabled = true");
    expect(settingsUpsert).not.toContain("proactiveAiEnabled = true");
    expect(agent).toContain("continueLineGroupOnboarding");
    expect(agent).toContain("if (!waitForEnrichment)");
    expect(agent).toContain("if (isGroupChat && !isExplicitGroupMention)");
    expect(groupOnboardingMigration).toContain("CREATE TABLE IF NOT EXISTS `line_group_onboarding_states`");
    expect(groupOnboardingMigration).not.toContain("ALTER TABLE");
    expect(manager).toContain("FROM line_group_onboarding_states");
    expect(migrationRunner).toContain("0157_line_group_onboarding.sql");
    expect(ui).toContain("@LCJなしの応答は最初の確認2回までです");
    expect(ui).toContain("入力欄へ反映するだけで、自動送信されません");
  });

  it("answers only bounded explicit public questions for unlinked group participants", () => {
    expect(agent).toContain('await import("./lineGroupPublicQuestion")');
    expect(agent).toContain("tryHandleLineGroupPublicQuestion");
    expect(groupPublicQuestion).toContain('type PublicGroupQuestionIntent = "sample_request" | "commercial_terms" | "automation_identity"');
    expect(groupPublicQuestion).toContain("isLineAiManagerRuntimeEnabled()");
    expect(groupPublicQuestion).toContain('participant?.userType === "staff"');
    expect(groupPublicQuestion).toContain("participant?.isBlocked");
    expect(groupPublicQuestion).toContain("participant?.liverId");
    expect(groupPublicQuestion).toContain("canDeliverLineAiManagerGroupReply(params.lineGroupId)");
    expect(groupPublicQuestion).toContain("reserveLineOutgoingAudit");
    expect(groupPublicQuestion).toContain("createLineRetryKey");
    expect(groupPublicQuestion).toContain("PUBLIC_QUESTION_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000");
    expect(groupPublicQuestion).toContain("PUBLIC_QUESTION_RATE_LIMIT_MAX = 3");
    expect(groupPublicQuestion).toContain("LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED");
    expect(db).toContain("reservation.rateLimit.messageIdPrefix");
    expect(db).toContain("reservation.rateLimit.maxCount");
    expect(groupPublicQuestion).toContain('reservation.status === "responded"');
    expect(groupPublicQuestion).toContain('reservation.status !== "pending"');
    expect(groupPublicQuestion.indexOf("reserveLineOutgoingAudit")).toBeLessThan(
      groupPublicQuestion.indexOf("await pushMessage("),
    );
    expect(groupPublicQuestion).toContain("個人情報は、このグループには送らないでください");
    expect(groupPublicQuestion).toContain("自動サポートを利用しています");
    expect(groupPublicQuestion).not.toContain("invokeLLM");
    expect(groupPublicQuestion).not.toContain("— 高橋 悠真");
  });

  it("continuously analyzes every eligible group while keeping actual sending guarded", () => {
    expect(manager).toContain("LINE_GROUP_INSIGHT_SWEEP_MS = 5 * 60 * 1000");
    expect(manager).toContain("LINE_GROUP_INSIGHT_COOLDOWN_MS = 15 * 60 * 1000");
    expect(manager).toContain("LINE_GROUP_INSIGHT_MIN_MESSAGES = 3");
    expect(manager).toContain("LINE_GROUP_INSIGHT_EVENT_DEBOUNCE_MS = 1_000");
    expect(manager).toContain("refreshOneLineGroupInsight");
    expect(manager).toContain("analyzeLineGroupConversation");
    expect(manager).toContain("export function scheduleLineGroupInsightRefresh");
    expect(manager).toContain("export async function refreshLineGroupInsightAfterInbound");
    expect(manager).toContain("lineGroupInsightRefreshRunning");
    expect(manager).toContain("lineGroupInsightRefreshDirty");
    expect(manager).toContain('if (outcome === "retry") lineGroupInsightRefreshDirty.add(lineGroupId)');
    expect(manager).not.toContain("hasLinkedActiveLiverInGroup");
    expect(manager).not.toContain("連携済みの有効なライブコマーサーが発言したグループだけ分析できます");
    expect(manager).toContain("COALESCE(s.analysisEnabled, TRUE) = TRUE");
    expect(agent).toContain("if (stored) {");
    expect(agent).toContain("scheduleLineGroupInsightRefresh(lineGroupId)");
    expect(manager).toContain("readLineGroupAiInsightUsingExecutor(tx, lineGroupId, true)");
    expect(manager).toContain("AND analysisEnabled = TRUE");
    expect(manager).toContain("sanitizeGroupMessageForAi");
    expect(manager).toContain("participantAliases");
    expect(manager).toContain('groupName: "対象LINEグループ"');
    expect(manager).toContain("buildGroupReplyIdentityPayload(params.incomingText, params.target.liverName)");
    expect(manager).toContain('name: "グループ参加者"');
    expect(manager).toContain("acquireLineGroupInsightLease");
    expect(manager).toContain("groupInsightLeaseToken");
    expect(manager).toContain("分析中にグループ会話が変更されたため再分析します");
    expect(manager).toContain("insight.conversationRevision !== currentConversation.conversationRevision");
    expect(groupInsightMigration).toContain("`groupInsightLeaseToken` varchar(64) NULL");
    expect(groupInsightMigration).toContain("`groupInsightLeaseExpiresAt` timestamp NULL");
    expect(groupInsightMigration).not.toContain("ADD COLUMN IF NOT EXISTS");
    expect(manager).toContain("センシティブ属性・性格・親密度を推測しない");
    expect(groupAutomationMigration).not.toContain("MODIFY COLUMN");
    expect(groupAutomationMigration).not.toContain("ALTER TABLE");
    expect(groupAutomationMigration).toContain("CREATE TABLE IF NOT EXISTS `line_group_automation_states`");
    expect(manager).toContain("INSERT IGNORE INTO line_group_automation_states");
    expect(manager).toContain("SET autoFollowUpEnabled = true");
    expect(manager).toContain("autoReplyEnabled = true");
    expect(manager).toContain("analysisEnabled = true");
    expect(manager).toContain("proactiveAiEnabled = true");
    const groupAnalysis = manager.slice(
      manager.indexOf("export async function analyzeLineGroupConversation"),
      manager.indexOf("async function buildAiManagerContext"),
    );
    expect(groupAnalysis).not.toContain("invokeLLM({");
    expect(groupAnalysis).not.toContain("transcript: groupContext.transcript");
    expect(groupAnalysis).not.toContain("publishedProducts: safeProducts");
    expect(groupAnalysis).toContain("const signalDefinitions = [");
    expect(groupAnalysis).toContain("categorySignals.some");
    expect(migrationRunner).toContain("0147_line_group_ai_insights.sql");
    expect(migrationRunner).toContain("ALTER TABLE \\`${tableName}\\` ADD COLUMN");
    expect(migrationRunner).toContain("isDuplicateMysqlColumn");
    expect(manager).not.toContain("ADD COLUMN IF NOT EXISTS `groupInsightJson`");
    expect(groupFollowUp).toContain("getLineGroupProactiveSuggestion");
    expect(groupFollowUp).toContain("createLineRetryKey");
    expect(groupFollowUp).toContain("requiresAiSuggestion && !aiSuggestion");
    expect(groupFollowUp).toContain("skippedAwaitingAi");
    expect(groupFollowUp).toContain("withLineGroupFollowUpClaim");
    expect(groupFollowUp).toContain("const message = normalizeGroupFollowUpMessage(rawMessage)");
    expect(groupFollowUp).not.toContain("LCJの${LINE_PUBLIC_CONTACT_NAME}です");
    expect(groupFollowUp).toContain('expectedMode = requiresAiSuggestion ? "ai" as const : "fixed" as const');
    expect(groupFollowUp).toContain("const senderName = LINE_PUBLIC_CONTACT_NAME");
    expect(manager).toContain("insight.latestMessageAt !== currentConversation.latestMessageAt");
    expect(manager).toContain("!settings.analysisEnabled || !settings.proactiveAiEnabled");
    expect(manager).toContain("LINE_GROUP_AI_SETTINGS_UNAVAILABLE");
    expect(manager).not.toContain("`).catch(() => null);\n  const row = result ? firstExecuteRow(result) : null;");
    expect(groupFollowUp).toContain("reserveLineOutgoingAudit");
    expect(groupFollowUp).toContain("finalizeLineOutgoingAudit");
    expect(groupFollowUp).toContain('reservation.status !== "pending"');
    expect(groupFollowUp).toContain("LINE_OUTBOUND_AUDIT_TERMINAL_");
    expect(db).toContain("withLineGroupFollowUpClaimUsingDb");
    expect(db).toContain("saveLineGroupInboundMessageAndActivityWithDb");
    expect(db).toContain("createLineFollowUpWithDb");
    expect(db).toContain("LINE_GROUP_FOLLOW_UP_TARGET_REQUIRED");
    expect(db).toContain("LINE_GROUP_FOLLOW_UP_TARGET_UNAVAILABLE");
    expect(db).toContain("FOR UPDATE");
    expect(db).toContain('reason: "group_activity_changed"');
    expect(db).toContain('reason: "follow_up_mode_changed"');
    expect(schema).toContain('autoFollowUpEnabled: boolean("autoFollowUpEnabled").default(true)');
    expect(schema).toContain('lineGroupAutomationStates = mysqlTable("line_group_automation_states"');
    expect(schema).toContain('autoFollowUpEnabledAt: timestamp("autoFollowUpEnabledAt").notNull()');
    expect(db).toContain("autoFollowUpEnabled: true");
    expect(db).toContain("getLineGroupFollowUpActivityAt(group)");
    expect(db).toContain("followUpActivityAt: eligibility.lastActivityAt");
    expect(groupFollowUp).toContain("expectedLastActivityAt: group.followUpActivityAt");
    expect(manager).toContain('LINE_GROUP_AUTOMATION_DEFAULTS_ROLLOUT = "all_active_groups_auto_on_v1"');
    expect(manager).toContain("INSERT IGNORE INTO line_group_automation_rollouts");
    expect(manager).toContain("for (const lineGroupId of activeGroupIds)");
    expect(manager).toContain("const activeGroupRows = executeRows(activeGroupResult)");
    expect(manager).toContain("INSERT IGNORE INTO line_group_automation_states");
    expect(manager).not.toContain("SELECT lineGroupId, CURRENT_TIMESTAMP\n      FROM line_groups");
    expect(manager).toContain("LINE_GROUP_AUTOMATION_COUNT_MISMATCH");
    expect(manager).toContain("stateRowCount !== activeGroupIds.length");
    expect(manager).toContain('getLineGroupAutomationDefaultsHealth(): Promise<"ready" | "pending">');
    expect(manager).toContain("getLineGroupAutomationDefaultsRuntimeStatus");
    expect(server).toContain("groupAutomationDefaults");
    expect(server).toContain("groupAutomationRuntime");
    const rolloutReadyIndex = server.indexOf("ensureLineGroupAutomationDefaults().then");
    const groupSchedulerStartIndex = server.indexOf("startGroupFollowUpScheduler()", rolloutReadyIndex);
    const rolloutFailureIndex = server.indexOf("}).catch(error =>", rolloutReadyIndex);
    expect(rolloutReadyIndex).toBeGreaterThanOrEqual(0);
    expect(groupSchedulerStartIndex).toBeGreaterThan(rolloutReadyIndex);
    expect(groupSchedulerStartIndex).toBeLessThan(rolloutFailureIndex);
    expect(server.match(/startGroupFollowUpScheduler\(\)/g)).toHaveLength(1);
    for (const schedulerStart of [
      "startLiveSuggestionScheduler()",
      "startDailyRankingScheduler()",
      "startWeeklyReportScheduler()",
      "startScheduleReminderScheduler()",
      "startMonthlyReportScheduler()",
    ]) {
      const schedulerStartIndex = server.indexOf(schedulerStart, rolloutReadyIndex);
      expect(schedulerStartIndex).toBeGreaterThan(rolloutReadyIndex);
      expect(schedulerStartIndex).toBeLessThan(rolloutFailureIndex);
      expect(server.match(new RegExp(schedulerStart.replace(/[()]/g, "\\$&"), "g"))).toHaveLength(1);
    }
    expect(groupDeliveryGuard).toContain("lineGroupLifecycleStates.isActive");
    expect(groupDeliveryGuard).toContain("state?.isActive");
    for (const scheduler of [
      liveSuggestionScheduler,
      dailyRankingScheduler,
      weeklyReportScheduler,
      monthlyReportScheduler,
      scheduleReminderScheduler,
    ]) {
      expect(scheduler).toContain('from "./lineGroupDeliveryGuard"');
      expect(scheduler).toContain("canDeliverLineGroupPush(");
    }
    expect(manager).toContain("autoReplyEnabled = true");
    expect(manager).toContain("analysisEnabled = true");
    expect(manager).toContain("proactiveAiEnabled = true");
    expect(migrationRunner).toContain("0154_line_group_automation_defaults.sql");
    expect(ui).toContain("履歴保存・@LCJ返信・会話分析・AI自動追いは既定でONです");
    expect(ui).toContain("LINE APIの仕様上、招待前の過去メッセージは取得できません");
  });

  it("persists unique processing events before an AI reply is generated", () => {
    expect(schema).toContain('uniqueIndex("uq_line_ai_manager_event").on(table.eventKey)');
    const enqueueIndex = manager.indexOf("const handoff = await persistInboundAndMaybeEnqueue");
    const workerStartIndex = manager.indexOf("void processAiManagerEvent(handoff.eventId)", enqueueIndex);
    expect(enqueueIndex).toBeGreaterThan(0);
    expect(workerStartIndex).toBeGreaterThan(enqueueIndex);
    expect(manager).toContain('eventKey: `reply:${params.sourceMessageId}`');
    expect(manager).toContain('eventKey: `preference:${params.sourceMessageId}`');
    expect(manager).toContain("if (preferenceCommand)");
    expect(manager).toContain("return db.transaction(async tx =>");
    expect(manager).toContain("void processAiManagerEvent(handoff.eventId)");
    expect(agent).toContain("recordLineAiManagerInboundActivity");
    expect(server).toContain("touchLineAiManagerInboundActivity");
  });

  it("uses verified conversation, livestream and published LCM product context", () => {
    expect(manager).toContain("getLiverInteractionSummary(target.liverId)");
    expect(manager).toContain("getLineMessages({ lineUserId: target.lineUserId, limit: 12 })");
    expect(manager).toContain('eq(lcmProducts.status, "published")');
    expect(manager).toContain('eq(lcmBrandProfiles.status, "published")');
    expect(manager).toContain("prohibitedClaims: lcmProducts.prohibitedClaims");
    expect(manager).toContain("sanitizeForAi(message.content, 500)");
    expect(manager).toContain("safeTikTokInsight");
    expect(manager).toContain("export async function generateLineGroupMessageDraft");
    expect(manager).toContain("最終文章はサーバーの固定文面から組み立て");
    expect(manager).toContain("LINE_GROUP_AI_ANALYSIS_DISABLED");
    expect(manager).toContain("publishedProductCandidates: safeProducts");
    const draftGenerator = manager.slice(
      manager.indexOf("async function generateLineGroupMessageDraftFromContext"),
      manager.indexOf("function composeLineGroupMessageDraft"),
    );
    expect(draftGenerator).toContain('empathyStyle: { type: "string", enum:');
    expect(draftGenerator).toContain('nextAction: { type: "string", enum:');
    expect(draftGenerator).not.toContain("params.groupContext.transcript");
    expect(draftGenerator).not.toContain("currentDraft,");
    expect(manager).toContain("getCurrentlyPublishedProductContextUsingExecutor(");
    expect(manager).toContain('query.for("update")');
    expect(manager).toContain("readLineGroupAiInsightUsingExecutor(tx, lineGroupId, true)");
    expect(manager).toContain("composeLineGroupMessageDraft");
    expect(manager).toContain("LINE_GROUP_AI_DRAFT_STALE");
    expect(manager).toContain("LINE_GROUP_AI_DRAFT_GROUP_INACTIVE");
    expect(manager).toContain("LINE_GROUP_AI_DRAFT_SETTINGS_CHANGED");
    expect(manager).toContain("LINE_GROUP_AI_DRAFT_GROUP_CHANGED");
    expect(manager).toContain("LINE_GROUP_AI_DRAFT_PRODUCT_CHANGED");
    expect(manager).toContain("const initialConversationRevision = groupContext.conversationRevision");
    expect(manager).toContain("Number(currentGroup.conversationRevision) !== initialConversationRevision");
    expect(manager).toContain("SELECT groupName, conversationRevision, updatedAt, isActive");
    expect(manager).toContain("FOR UPDATE");
    expect(db).toContain("lockLineGroupConversationUsingExecutor(executor, data.lineGroupId)");
    expect(db).toContain("lockLineGroupConversationUsingExecutor(tx, reservation.lineGroupId)");
    expect(manager).toContain("lockLineGroupConversationUsingExecutor(tx, params.lineGroupId)");
    expect(manager).toContain("getLineGroupDraftSettingsRevision(latestSettings) !== initialSettingsRevision");
    expect(manager).toContain("getLineGroupDraftProductRevision(validatedProduct) !== initialProductRevisions.get");
    expect(manager).toContain("if (!latestSettings.analysisEnabled)");
    expect(manager).toContain("isLineGroupInsightCurrent(settings.insight, groupContext)");
    expect(manager).toContain('throw new Error("LINE_GROUP_AI_DRAFT_INSIGHT_STALE")');
    expect(manager).toContain("if (isLineGroupInsightCurrent(latestSettings.insight, groupContext)) return latestSettings.insight!");
    expect(manager).toContain("conversationRevision: groupContext.conversationRevision");
    expect(manager).toContain("Number(currentGroup.conversationRevision || 0) !== groupContext.conversationRevision");
    expect(manager).toContain("LINE_GROUP_DRAFT_COOLDOWN_MS = 30 * 1000");
  });

  it("uses the LINE display name without repeating a body signature while preserving honest automation", () => {
    expect(manager).toContain("人間としての経験・感情・行動を捏造しない");
    expect(manager).toContain("AIまたは自動応答か尋ねられた場合");
    expect(manager).toContain("恋愛関係や依存を誘う表現");
    expect(manager).toContain("返信本文には氏名・肩書・署名を付けない");
    expect(manager).not.toContain("— LCJ公式AIマネージャー");
    expect(linePublicIdentity).toContain("stripLinePublicSignature");
    expect(linePublicIdentity).not.toContain("LINE_PUBLIC_CONTACT_SIGNATURE");
    const manualTemplates = ui.slice(
      ui.indexOf("const GROUP_MANUAL_MESSAGE_TEMPLATES"),
      ui.indexOf("type GroupManualMessageTemplateKey"),
    );
    expect(manualTemplates).not.toContain("LINE_PUBLIC_CONTACT_SIGNATURE");
    expect(manualTemplates).not.toContain("— 高橋 悠真");
    expect(manualTemplates).not.toContain("LCJ公式AIマネージャー");
    expect(manager).toContain("根拠のない称賛");
    expect(manager).toContain("maxTokens: 1_200");
    expect(llm).toContain("maxTokens ?? max_tokens ?? 16384");
    expect(llm).toContain("AbortSignal.timeout(45_000)");
    expect(manager).toContain("AI_MANAGER_LEASE_MS = 5 * 60 * 1000");
  });

  it("runs proactive care with bounded attempts and business-hour controls", () => {
    expect(manager).toContain('process.env.LINE_AI_MANAGER_ENABLED !== "false"');
    expect(manager).toContain('process.env.LINE_AI_MANAGER_PROACTIVE_ENABLED !== "false"');
    expect(manager).toContain("isWithinAiManagerHours(now)");
    expect(manager).toContain("target.consecutiveProactiveCount >= target.maxProactivePerCycle");
    expect(manager).toContain('triggerType: "inactivity_follow_up"');
    expect(manager).toContain("AI_MANAGER_WORKER_INTERVAL_MS");
    expect(manager).toContain("recoverAndProcessAiManagerQueue");
    expect(manager).toContain('status: "unknown"');
    expect(manager).toContain("AI_MANAGER_MAX_ATTEMPTS");
    expect(manager).toContain("leaseToken = crypto.randomUUID()");
    expect(manager).toContain("eq(lineAiManagerEvents.leaseToken, leaseToken)");
    expect(manager).toContain('guard: { status: "processing" | "sending"; leaseToken: string }');
    expect(manager).not.toContain('guard?: { status: "processing" | "sending"; leaseToken: string }');
    expect(schema).toContain('leaseToken: varchar("leaseToken", { length: 64 })');
    expect(schema).toContain('["queued", "processing", "ready", "sending", "sent", "failed", "skipped", "unknown"]');
    expect(migration).toContain("`proactiveEnabled` boolean NOT NULL DEFAULT false");
    expect(server).toContain("initializeLineGroupAutomation");
    expect(server).toContain("ensureLineGroupAutomationDefaults().then");
    expect(server).toContain("scheduler remains stopped");
    expect(server).toContain("startLineAiManagerScheduler()");
    expect(manager).toContain('errorCode: "outbound_audit_intent_pending"');
    expect(manager).toContain('errorCode: "delivery_pending"');
    expect(manager).toContain('errorCode: "outbound_audit_pending"');
    expect(manager).toContain("persistOutboundAuditIntent");
    expect(manager).toContain("reconcilePendingOutboundAudits");
    expect(manager).toContain("persistOutboundAuditAndFinalize");
  });

  it("honors LINE unsend and liver stop/restart commands", () => {
    expect(server).toContain('case "unsend"');
    expect(server).toContain("redactLineMessageByMessageId");
    expect(manager).toContain("cancelLineAiManagerMessage");
    expect(manager).toContain('normalized === "ai停止"');
    expect(manager).toContain('normalized === "フォロー停止"');
    expect(server).toContain("Promise.all(body.events.map");
    expect(server).toContain("retryKeyForLineEvent(event");
    expect(server.match(/retryKeyForLineEvent\(event, "follow-response"\)/g)?.length).toBe(4);
    expect(server.match(/retryKeyForLineEvent\(event, "link-command-response"\)/g)?.length).toBe(7);
    expect(messaging).toContain('"X-Line-Retry-Key"');
    expect(lineTransport).toContain('"X-Line-Retry-Key"');
    expect(agent).toContain("LINE_PROFILE_TIMEOUT_MS = 2_000");
    expect(agent).toContain("signal: AbortSignal.timeout(LINE_PROFILE_TIMEOUT_MS)");
    expect(db).toContain("conversationRevision = conversationRevision + 1");
    expect(db).toContain('storedMessage.content === "[送信取消済み]"');
    expect(db).toContain("SELECT lineGroupId, content, responseStatus");
    expect(db).toContain("lockLineGroupConversationUsingExecutor(tx, String(target.lineGroupId), false)");
  });

  it("uses discovered TikTok APIs with cached public insight", () => {
    expect(manager).toContain('callDataApi("Tiktok/get_user_info"');
    expect(manager).toContain('callDataApi("Tiktok/get_user_popular_posts"');
    expect(manager).toContain("AI_MANAGER_TIKTOK_CACHE_MS");
    expect(manager).toContain("tiktokInsightUpdatedAt");
  });

  it("requires an administrator for manager controls", () => {
    expect(router).toContain("function assertLineManagementAdmin");
    expect(router).toContain("listUsers: protectedProcedure.query(async ({ ctx })");
    expect(router).toContain("listMessages: protectedProcedure");
    expect(router).toContain("listAiManagers: protectedProcedure");
    expect(router).toContain("getAiManagerHistory: protectedProcedure");
    expect(router).toContain("updateAiManagerSettings: protectedProcedure");
    expect(router).toContain("refreshAiManagerTikTok: protectedProcedure");
    expect(router).toContain("analyzeGroupConversation: protectedProcedure");
    expect(router).toContain("getGroupAiInsight: protectedProcedure");
    expect(router).toContain("generateGroupMessageDraft: protectedProcedure");
    expect(router.match(/assertLineManagementAdmin\(ctx\.user\)/g)?.length || 0).toBeGreaterThanOrEqual(20);
  });

  it("installs and health-checks the additive manager storage", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `line_ai_manager_settings`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `line_ai_manager_events`");
    expect(migrationRunner).toContain("0145_line_ai_manager.sql");
    expect(server).toContain("ensureLineAiManagerStorage");
    expect(server).toContain('/api/health/line-ai-manager');
    expect(manager).toContain("INFORMATION_SCHEMA.STATISTICS");
    expect(manager).toContain("idx_line_ai_manager_proactive");
    expect(manager).toContain("idx_line_ai_manager_event_status");
    expect(groupDraftAuditMigration).toContain("CREATE TABLE IF NOT EXISTS `line_group_ai_draft_audit`");
    expect(groupDraftAuditMigration).toContain("uq_line_group_ai_draft_group_bucket");
    expect(groupDraftAuditMigration).toContain("uq_line_group_ai_draft_actor_bucket");
    expect(groupDraftAuditMigration).toContain("ADD COLUMN `conversationRevision` bigint unsigned NOT NULL DEFAULT 0");
    expect(schema).toContain('conversationRevision: bigint("conversationRevision", { mode: "number", unsigned: true }).default(0).notNull()');
    expect(migrationRunner).toContain("0151_line_group_ai_draft_audit.sql");
    expect(manager).toContain("LINE group AI draft unique index is missing");
    expect(server).toContain('if (!ready) throw new Error("LINE AI manager storage is unavailable")');
  });

  it("shows controls, state, next action and TikTok analysis on the same LINE page", () => {
    expect(ui).toContain('value="ai-managers"');
    expect(ui).toContain("LINE_PUBLIC_CONTACT_NAME");
    expect(ui).toContain("本人DM・グループ@LCJへ返信");
    expect(ui).toContain("継続フォロー");
    expect(ui).toContain("次アクション");
    expect(ui).toContain("TikTok公開情報分析");
    expect(ui).toContain("連絡・AI実行履歴");
    expect(ui).toContain('value="communications"');
    expect(ui).toContain('value="ai-executions"');
    expect(ui).toContain("AIが作成した送信内容");
    expect(ui).toContain("送信処理中");
    expect(ui).toContain("送信確認不能");
    expect(manager).toContain("export async function getLineAiManagerHistory");
    expect(manager).toContain("groupNames: Object.fromEntries");
    expect(ui).toContain("グループAIインサイト");
    expect(ui).toContain("グループ会話を分析");
    expect(ui).toContain("分析したAI提案を自動追いに使用");
    expect(ui).toContain("連携状態に関係なく保存済みグループ会話を分析");
    expect(ui).toContain("会話が3件に達すると、連携状況に関係なく自動分析を開始");
    expect(ui).toContain("会話履歴は保存されていますが、自動分析は停止中です");
    expect(ui).toContain('className="max-w-4xl max-h-[90vh] overflow-y-auto"');
    expect(ui).not.toContain('max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col');
    expect(ui).toContain("グループ会話履歴");
    expect(ui).toContain("会話・送信");
    expect(ui).toContain("LCJ公式AIフォロー設定");
    expect(ui).toContain("AI提案を生成できない場合は送信せず");
    expect(ui).toContain("requestId: groupMessageRequestIdRef.current");
    expect(ui).not.toContain("if (!open) directMessageRequestIdRef.current = null");
    expect(ui).not.toContain("if (!open) {\n          setGroupMessageText");
    expect(ui).toContain("directMessageRequestIdRef.current = null");
    expect(ui).toContain("groupMessageRequestIdRef.current = null");
    expect(ui).toContain("sortLineMessagesChronologically(groupMessages)");
    expect(ui).toContain("送信未確認");
    expect(ui).toContain("trpc.line.generateGroupMessageDraft.useMutation");
    expect(ui).toContain("AI文案を作る");
    expect(ui).toContain("安全なAI文案にする");
    expect(ui).toContain("自動送信されません");
    expect(ui).toContain("送信前に必ず内容を確認し、必要に応じて修正してから送信してください");
    expect(ui.match(/groupAiDraftPendingReview && !groupAiDraftReviewed/g)?.length || 0).toBeGreaterThanOrEqual(2);
    expect(ui).toContain("内容を確認しました");
    expect(ui).toContain("AI文案はまだ送信できません");
    expect(ui).toContain("setGroupAiDraftPendingReview(true)");
    expect(ui).toContain("setGroupAiDraftReviewed(false)");
    expect(ui).toContain("if (groupAiDraftPendingReview) setGroupAiDraftReviewed(false)");
    expect(router).toContain("requestId: z.string().uuid()");
    expect(router).toContain("reserveLineOutgoingAudit");
    expect(db).toContain("LINE_OUTBOUND_IDEMPOTENCY_CONFLICT");
    expect(db).toContain('eq(lineMessages.responseStatus, "pending")');
    expect(db).toContain("LINE_OUTBOUND_AUDIT_FINALIZE_CONFLICT");
    expect(router).toContain("LINE_OUTBOUND_AUDIT_TERMINAL_");
    expect(router).toContain("LINE_GROUP_SETTINGS_DB_UNAVAILABLE");
    expect(router).toContain("await sdb.transaction(async tx =>");
    expect(router).toContain('["line-management-manual", input.to, requestId]');
    expect(router).toContain("senderName: LINE_PUBLIC_CONTACT_NAME");
    expect(router).toContain("const message = stripLinePublicSignature(input.message)");
    expect(router).toContain("LINE_MESSAGE_EMPTY_AFTER_SIGNATURE_REMOVAL");
    expect(agent).toContain("senderName: LINE_PUBLIC_CONTACT_NAME");
    expect(agent).toContain("normalizeLineCommandReply(await getPointsHistoryMessage(userId))");
    expect(agent).toContain("normalizeLineCommandReply(await getReminderListMessage(userId))");
    expect(agent).toContain("const reminderMessage = normalizeLineCommandReply(result.message)");
    expect(groupFollowUp).toContain("const senderName = LINE_PUBLIC_CONTACT_NAME");
    expect(db).toContain("COALESCE(${lineMessages.lineTimestamp}, UNIX_TIMESTAMP(${lineMessages.createdAt}) * 1000)");
  });
});
