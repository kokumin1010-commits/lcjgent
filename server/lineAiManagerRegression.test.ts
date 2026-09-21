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

  it("batches group insight analysis and keeps default-on proactive sending guarded", () => {
    expect(manager).toContain("LINE_GROUP_INSIGHT_SWEEP_MS = 5 * 60 * 1000");
    expect(manager).toContain("LINE_GROUP_INSIGHT_COOLDOWN_MS = 15 * 60 * 1000");
    expect(manager).toContain("refreshOneLineGroupInsight");
    expect(manager).toContain("analyzeLineGroupConversation");
    expect(manager).toContain("hasLinkedActiveLiverInGroup");
    expect(manager).toContain("連携済みの有効なライブコマーサーが発言したグループだけ分析できます");
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
    expect(groupAutomationMigration).toContain("ADD COLUMN `autoFollowUpEnabledAt`");
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
    expect(groupFollowUp).toContain('expectedMode = requiresAiSuggestion ? "ai" as const : "fixed" as const');
    expect(groupFollowUp).toContain('"LCJ公式・専属AIマネージャー"');
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
    expect(schema).toContain('autoFollowUpEnabledAt: timestamp("autoFollowUpEnabledAt")');
    expect(db).toContain("autoFollowUpEnabled: true");
    expect(db).toContain("getLineGroupFollowUpActivityAt(group)");
    expect(db).toContain("followUpActivityAt: eligibility.lastActivityAt");
    expect(groupFollowUp).toContain("expectedLastActivityAt: group.followUpActivityAt");
    expect(manager).toContain('LINE_GROUP_AUTOMATION_DEFAULTS_ROLLOUT = "all_active_groups_auto_on_v1"');
    expect(manager).toContain("INSERT IGNORE INTO line_group_automation_rollouts");
    expect(manager).toContain("if (!firstExecuteRow(rolloutResult)) return false");
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
    expect(manager).toContain("if (isLineGroupInsightCurrent(settings.insight, groupContext)) return settings.insight!");
    expect(manager).toContain("conversationRevision: groupContext.conversationRevision");
    expect(manager).toContain("Number(currentGroup.conversationRevision || 0) !== groupContext.conversationRevision");
    expect(manager).toContain("LINE_GROUP_DRAFT_COOLDOWN_MS = 30 * 1000");
  });

  it("enforces AI disclosure and prohibits deceptive or dependent relationship language", () => {
    expect(manager).toContain("人間、恋人、担当者を装わず");
    expect(manager).toContain("恋愛関係や依存を誘う表現");
    expect(manager).toContain("LCJ公式AIマネージャー");
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
    expect(ui).toContain("LCJ公式・専属AIマネージャー");
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
    expect(ui).toContain("保存済みグループ会話だけを使用");
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
    expect(router).toContain('senderName: "LCJ運営（手動）"');
    expect(db).toContain("COALESCE(${lineMessages.lineTimestamp}, UNIX_TIMESTAMP(${lineMessages.createdAt}) * 1000)");
  });
});
