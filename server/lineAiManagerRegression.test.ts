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
    expect(agent).toContain("ONLY respond when explicitly mentioned @LCJ");
    expect(agent).toContain("containsExplicitLcjMention");
    expect(agent).not.toContain("/エージェントさん/i");
    expect(agent).not.toContain("/LCJエージェント/i");
    expect(agent).toContain("if (isGroupChat && !isExplicitGroupMention)");
    expect(agent).toContain("getGroupMemberProfile(groupId, userId)");
    expect(agent).toContain("if (isExplicitGroupMention)");
    expect(manager).toContain('lineGroupId: isGroupMention ? event.source.groupId : undefined');
    expect(manager).toContain("ingress.isExplicitBotMention === true");
    expect(agent).toContain("グループ内では照会・登録を行いません");
    expect(manager).toContain('channel: sourceLineGroupId ? "group" : "direct"');
    expect(manager).toContain("本人の過去DM、売上、内部メモ、次アクション、個人情報を絶対に開示しない");
    expect(manager).toContain("sourceLineGroupId || latestTarget.lineUserId");
    expect(manager).toContain('sourceType: lineGroupId ? "group" : "user"');
    expect(lineTransport).toContain("LINE_PROFILE_LOOKUP_TIMEOUT_MS");
    expect(agent).toContain("captureGroupTextMessage(");
    expect(agent).toContain("isExplicitGroupMention,");
    expect(agent).toContain("Stored group message without replying");
    expect(agent).toContain('needsResponse: false');
    expect(manager).toContain("getGroupConversationContext(lineGroupId)");
    expect(manager).toContain('getLineMessages({ lineGroupId, limit })');
    expect(manager).toContain('tiktokInsight: channel === "group" ? null : safeTikTokInsight');
    expect(manager).toContain('bio: channel === "direct" ? sanitizeForAi(params.target.liverBio, 500) : null');
    expect(manager).toContain('tiktokAccount: channel === "direct" ? params.target.tiktokAccount : null');
    expect(manager).toContain("isLineGroupAiReplyEnabled");
  });

  it("batches group insight analysis and keeps proactive AI sending opt-in", () => {
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
    expect(manager).toContain("分析中に新しいグループメッセージを受信したため再分析します");
    expect(groupInsightMigration).toContain("`groupInsightLeaseToken` varchar(64) NULL");
    expect(groupInsightMigration).toContain("`groupInsightLeaseExpiresAt` timestamp NULL");
    expect(groupInsightMigration).not.toContain("ADD COLUMN IF NOT EXISTS");
    expect(manager).toContain("センシティブ属性・性格・親密度を推測しない");
    expect(groupInsightMigration).toContain("`analysisEnabled` boolean NOT NULL DEFAULT false");
    expect(groupInsightMigration).toContain("`proactiveAiEnabled` boolean NOT NULL DEFAULT false");
    expect(migrationRunner).toContain("0147_line_group_ai_insights.sql");
    expect(migrationRunner).toContain("ALTER TABLE \\`${tableName}\\` ADD COLUMN");
    expect(migrationRunner).toContain("isDuplicateMysqlColumn");
    expect(manager).not.toContain("ADD COLUMN IF NOT EXISTS `groupInsightJson`");
    expect(groupFollowUp).toContain("getLineGroupProactiveSuggestion");
    expect(groupFollowUp).toContain("createLineRetryKey");
    expect(manager).toContain("!settings.analysisEnabled || !settings.proactiveAiEnabled");
    expect(schema).toContain('autoFollowUpEnabled: boolean("autoFollowUpEnabled").default(false)');
    expect(db).toContain("autoFollowUpEnabled: false");
    expect(db).not.toContain("autoFollowUpEnabled: true, // Enable auto follow-up by default");
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
    expect(db).toContain("Failed to invalidate group insight after unsend");
    expect(db).toContain("groupInsightJson = NULL");
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
  });
});
