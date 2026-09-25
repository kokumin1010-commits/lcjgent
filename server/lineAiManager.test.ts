import { describe, expect, it, vi } from "vitest";
import {
  __lineAiManagerTestUtils,
  getLineGroupAutomationDefaultsRuntimeStatus,
  LINE_AI_MANAGER_MODEL,
  scheduleLineGroupInsightRefresh,
  tryHandleLineAiManagerMessage,
} from "./lineAiManager";

const {
  normalizeTikTokUsername,
  sanitizeForAi,
  sanitizeGroupMessageForAi,
  buildGroupReplyIdentityPayload,
  generateLineGroupMessageDraftFromContext,
  composeLineGroupMessageDraft,
  getLineGroupDraftProductRevision,
  getLineGroupDraftSettingsRevision,
  assertLineGroupDraftConversationSnapshotCurrent,
  applyLineGroupAutomationDefaultsRolloutUsingDb,
  isLineGroupInsightCurrent,
  reserveLineGroupDraftAuditWithDb,
  parseAiManagerReply,
  normalizeLinePublicContactReply,
  parseAiManagerPreferenceCommand,
  getAiManagerPreferenceResponse,
  isWithinAiManagerHours,
} = __lineAiManagerTestUtils;

describe("LCJ LINE AI manager", () => {
  it("uses the approved lightweight conversation model", () => {
    expect(LINE_AI_MANAGER_MODEL).toBe("gpt-5-mini");
  });

  it("normalizes TikTok handles and profile URLs", () => {
    expect(normalizeTikTokUsername("@lcj_live")).toBe("lcj_live");
    expect(normalizeTikTokUsername("https://www.tiktok.com/@lcj_live?lang=ja")).toBe("lcj_live");
    expect(normalizeTikTokUsername("tiktok.com/@lcj_live/video/123")).toBe("lcj_live");
    expect(normalizeTikTokUsername(null)).toBeNull();
  });

  it("keeps the public reply unsigned because LINE already displays the account name", () => {
    const parsed = parseAiManagerReply(JSON.stringify({
      reply: "今日も配信準備を進められていて素敵です。次は配信予定日を教えてください。",
      intent: "配信予定確認",
      nextAction: "配信予定日を確認する",
    }));
    expect(parsed.reply).not.toContain("高橋 悠真");
    expect(parsed.reply).not.toContain("LCJ公式AIマネージャー");
    expect(parsed.intent).toBe("配信予定確認");
  });

  it("removes a queued legacy AI signature", () => {
    const parsed = parseAiManagerReply(JSON.stringify({
      reply: "ありがとうございます。\n— LCJ公式AIマネージャー",
      intent: "感謝",
      nextAction: "会話を継続する",
    }));
    expect(parsed.reply).toBe("ありがとうございます。");
    expect(parsed.reply).not.toContain("LCJ公式AIマネージャー");
  });

  it("removes the public signature and supports natural auto-reply controls", () => {
    expect(normalizeLinePublicContactReply("ありがとうございます。\n\n— 高橋 悠真"))
      .toBe("ありがとうございます。");
    expect(parseAiManagerPreferenceCommand("自動返信停止")).toBe("ai停止");
    expect(parseAiManagerPreferenceCommand("自動返信再開")).toBe("ai再開");
    expect(getAiManagerPreferenceResponse("ai停止")).toContain("自動返信再開");
    expect(getAiManagerPreferenceResponse("ai停止")).not.toContain("高橋 悠真");
  });

  it("limits proactive delivery to weekday daytime in Japan", () => {
    expect(isWithinAiManagerHours(new Date("2026-09-21T02:00:00Z"))).toBe(true);
    expect(isWithinAiManagerHours(new Date("2026-09-20T02:00:00Z"))).toBe(false);
    expect(isWithinAiManagerHours(new Date("2026-09-21T10:00:00Z"))).toBe(false);
  });

  it("reruns group insight when a new message arrives during analysis", async () => {
    vi.useFakeTimers();
    try {
      let finishFirst: ((value: "completed") => void) | undefined;
      const firstRun = new Promise<"completed">(resolve => {
        finishFirst = resolve;
      });
      const refresh = vi.fn()
        .mockReturnValueOnce(firstRun)
        .mockResolvedValue("completed");

      scheduleLineGroupInsightRefresh("C-insight-dirty", refresh);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(refresh).toHaveBeenCalledTimes(1);

      scheduleLineGroupInsightRefresh("C-insight-dirty", refresh);
      finishFirst?.("completed");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries group insight after a lease or revision race", async () => {
    vi.useFakeTimers();
    try {
      const refresh = vi.fn()
        .mockResolvedValueOnce("retry")
        .mockResolvedValue("completed");

      scheduleLineGroupInsightRefresh("C-insight-retry", refresh);
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("redacts common sensitive identifiers before LLM context", () => {
    const sanitized = sanitizeForAi("mail me@example.com phone 090-1234-5678 card 1234567890123456");
    expect(sanitized).not.toContain("me@example.com");
    expect(sanitized).not.toContain("090-1234-5678");
    expect(sanitized).not.toContain("1234567890123456");
  });

  it("anonymizes names, handles and high-risk personal disclosures in group analysis", () => {
    const names = ["山田花子", "Alice Smith"];
    const normal = sanitizeGroupMessageForAi(
      "山田花子の注文ID: AB12CD34、@hanako_liveへ連絡してください",
      names,
    );
    expect(normal).not.toContain("山田花子");
    expect(normal).not.toContain("AB12CD34");
    expect(normal).not.toContain("@hanako_live");
    expect(normal).toContain("[参加者名]");
    expect(normal).toContain("[識別番号省略]");
    expect(normal).toContain("[ハンドル省略]");

    const highRisk = sanitizeGroupMessageForAi(
      "住所は東京都港区、電話番号は090-1234-5678です",
      names,
    );
    expect(highRisk).toBe("[個人情報を含む発言は分析対象から省略]");
    expect(highRisk).not.toContain("東京都港区");
  });

  it("keeps the live @LCJ group-reply identity payload group-only", () => {
    const payload = buildGroupReplyIdentityPayload(
      "植田泰介さん、住所は東京都港区です。注文ID: ZXCV1234",
      "植田泰介",
    );
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("植田泰介");
    expect(serialized).not.toContain("東京都港区");
    expect(serialized).not.toContain("ZXCV1234");
    expect(payload.incomingText).toBe("[個人情報を含む発言は分析対象から省略]");
    expect(payload.liver).toEqual({
      name: "グループ参加者",
      bio: null,
      tiktokAccount: null,
      language: null,
      previousIntent: null,
      previousNextAction: null,
    });
  });

  it("creates a review-only group draft from anonymized context and current published candidates", async () => {
    const invoke = vi.fn(async request => ({
      model: "gpt-5-mini",
      choices: [{ message: { content: JSON.stringify({
        empathyStyle: "warm",
        nextAction: "ask_challenge",
        recommendedProductId: 1,
      }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    }));

    const result = await generateLineGroupMessageDraftFromContext({
      groupContext: {
        groupName: "実在グループ名",
        transcript: "参加者1: 次の配信商品を相談したいです",
        participantNames: ["山田花子"],
        messageCount: 4,
        latestMessageAt: "2026-09-21T00:00:00.000Z",
        conversationRevision: 4,
        groupUpdatedAt: "2026-09-21T00:01:00.000Z",
        isActive: true,
      },
      insight: {
        groupName: "実在グループ名",
        summary: "配信商品を相談中",
        topics: ["商品選定"],
        explicitNeeds: ["紹介しやすい商品"],
        relationshipOpportunity: "準備状況を確認する",
        productOpportunities: [
          { productName: "公開商品A", fitReason: "実演しやすい", timing: "次回配信" },
          { productName: "非公開商品B", fitReason: "非公開", timing: "今すぐ" },
        ],
        risks: [],
        suggestedNextAction: "困りごとを1つ確認する",
        suggestedMessage: "旧文案",
        confidence: "medium",
        messageCount: 4,
        latestMessageAt: "2026-09-21T00:00:00.000Z",
        analyzedAt: "2026-09-21T00:01:00.000Z",
      },
      publishedProducts: [{
        id: 1,
        name: "公開商品A",
        brandName: "公開ブランド",
        category: "美容",
        summary: "公開済み説明",
        description: "公開済み詳細",
        thirtySecondPitch: "30秒説明",
        demoInstructions: "実演方法",
        targetAudience: "想定視聴者",
        prohibitedClaims: "断定表現禁止",
        sampleAvailable: true,
        listPrice: 3000,
      }] as any,
      currentDraft: "山田花子様、もう絶対に売れます。",
      invoke: invoke as any,
    });

    const serializedRequest = JSON.stringify(invoke.mock.calls[0]?.[0]);
    expect(serializedRequest).not.toContain("実在グループ名");
    expect(serializedRequest).not.toContain("山田花子");
    expect(serializedRequest).not.toContain("非公開商品B");
    expect(serializedRequest).not.toContain("公開商品A");
    expect(serializedRequest).not.toContain("次の配信商品を相談したいです");
    expect(serializedRequest).not.toContain("配信商品を相談中");
    expect(serializedRequest).not.toContain("準備状況を確認する");
    expect(serializedRequest).not.toContain("公開済み説明");
    expect(serializedRequest).toContain("suggestedActionHint");
    expect(serializedRequest).toContain("最終文章はサーバーの固定文面から組み立て");
    expect(result.empathyStyle).toBe("warm");
    expect(result.nextAction).toBe("ask_challenge");
    expect(result.recommendedProductId).toBe(1);
    expect(result.promptTokens).toBe(100);
  });

  it("rejects product ids outside the published candidate allow-list", async () => {
    const baseParams = {
      groupContext: {
        groupName: "対象グループ",
        transcript: "参加者1: 配信準備を相談したいです",
        participantNames: ["対象グループ", "山田花子"],
        messageCount: 3,
        latestMessageAt: "2026-09-21T00:00:00.000Z",
        conversationRevision: 3,
        groupUpdatedAt: "2026-09-21T00:01:00.000Z",
        isActive: true,
      },
      insight: {
        groupName: "対象グループ",
        summary: "配信準備を相談中",
        topics: ["配信準備"],
        explicitNeeds: ["紹介しやすい商品"],
        relationshipOpportunity: "困りごとを確認する",
        productOpportunities: [{ productName: "公開商品A", fitReason: "実演向き", timing: "次回" }],
        risks: [],
        suggestedNextAction: "準備状況を確認する",
        suggestedMessage: "旧文案",
        confidence: "medium" as const,
        messageCount: 3,
        latestMessageAt: "2026-09-21T00:00:00.000Z",
        analyzedAt: "2026-09-21T00:01:00.000Z",
      },
      publishedProducts: [{ id: 1, name: "公開商品A", brandName: "公開ブランド" }] as any,
    };
    const invalidIdInvoke = vi.fn(async () => ({
      model: "gpt-5-mini",
      choices: [{ message: { content: JSON.stringify({
        empathyStyle: "warm",
        nextAction: "offer_product_candidate",
        recommendedProductId: 999,
      }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    }));
    await expect(generateLineGroupMessageDraftFromContext({
      ...baseParams,
      invoke: invalidIdInvoke as any,
    })).rejects.toThrow("LINE_GROUP_AI_DRAFT_PRODUCT_NOT_ALLOWED");
  });

  it("builds the final message only from approved server phrases and the revalidated product name", () => {
    const message = composeLineGroupMessageDraft({
      generated: {
        empathyStyle: "warm",
        nextAction: "offer_product_candidate",
        recommendedProductId: 1,
        model: "gpt-5-mini",
        promptTokens: 10,
        completionTokens: 5,
      },
      currentDraft: "非公開商品Bがおすすめです。",
      validatedProductName: "公開商品A",
    });
    expect(message).not.toContain("非公開商品B");
    expect(message).toContain("公開商品A");
    expect(message).not.toContain("高橋 悠真");
  });

  it("changes immutable draft revisions when settings, insights, or published products change", () => {
    const settings = {
      analysisEnabled: true,
      proactiveAiEnabled: false,
      relationshipObjective: "関係づくり",
      insight: { summary: "準備相談" },
      lastAnalyzedMessageAt: "2026-09-21T00:00:00.000Z",
      settingsUpdatedAt: "2026-09-21T00:01:00.000Z",
      insightUpdatedAt: "2026-09-21T00:01:00.000Z",
    } as any;
    expect(getLineGroupDraftSettingsRevision(settings)).not.toBe(
      getLineGroupDraftSettingsRevision({ ...settings, analysisEnabled: false }),
    );
    expect(getLineGroupDraftSettingsRevision(settings)).not.toBe(
      getLineGroupDraftSettingsRevision({ ...settings, insightUpdatedAt: "2026-09-21T00:02:00.000Z" }),
    );

    const product = {
      id: 1,
      name: "公開商品A",
      brandName: "公開ブランド",
      category: "美容",
      summary: "説明",
      description: "詳細",
      thirtySecondPitch: "30秒説明",
      demoInstructions: "実演",
      targetAudience: "対象",
      prohibitedClaims: "禁止",
      sampleAvailable: true,
      listPrice: 3000,
      productUpdatedAt: new Date("2026-09-21T00:01:00.000Z"),
      brandUpdatedAt: new Date("2026-09-21T00:01:00.000Z"),
    } as any;
    expect(getLineGroupDraftProductRevision(product)).not.toBe(
      getLineGroupDraftProductRevision({ ...product, summary: "変更後" }),
    );
  });

  it("rejects a draft when any group conversation mutation advances the revision", () => {
    expect(() => assertLineGroupDraftConversationSnapshotCurrent({
      isActive: true,
      conversationRevision: 12,
      updatedAt: new Date("2026-09-21T00:01:00.000Z"),
    }, 11, "2026-09-21T00:01:00.000Z")).toThrow("LINE_GROUP_AI_DRAFT_STALE");
  });

  it("invalidates cached insight when an out-of-order message or unsend changes only the revision", () => {
    const insight = {
      latestMessageAt: "2026-09-21T00:00:00.000Z",
      conversationRevision: 5,
      followUpStage: "planning",
    } as any;
    expect(isLineGroupInsightCurrent(insight, {
      latestMessageAt: "2026-09-21T00:00:00.000Z",
      conversationRevision: 5,
    })).toBe(true);
    expect(isLineGroupInsightCurrent(insight, {
      latestMessageAt: "2026-09-21T00:00:00.000Z",
      conversationRevision: 6,
    })).toBe(false);
    expect(isLineGroupInsightCurrent({ ...insight, followUpStage: undefined }, {
      latestMessageAt: "2026-09-21T00:00:00.000Z",
      conversationRevision: 5,
    })).toBe(false);
  });

  it("uses the shared database uniqueness guard for cross-replica draft rate limiting", async () => {
    const params = {
      lineGroupId: "C1234567890",
      actorKey: "42",
      latestMessageAt: "2026-09-21T00:00:00.000Z",
      currentDraft: "下書き",
    };
    await expect(reserveLineGroupDraftAuditWithDb({
      execute: vi.fn(async () => [{ insertId: 77 }, []]),
    }, params, 1_789_960_000_000)).resolves.toBe(77);

    await expect(reserveLineGroupDraftAuditWithDb({
      execute: vi.fn(async () => {
        throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY", errno: 1062 });
      }),
    }, params, 1_789_960_000_000)).rejects.toThrow("LINE_GROUP_AI_DRAFT_RATE_LIMITED");
  });

  it("applies automatic group defaults once and records the rollout counts", async () => {
    let executeCall = 0;
    const execute = vi.fn(async () => {
      executeCall += 1;
      if (executeCall === 1) return [{ affectedRows: 1 }, []];
      if (executeCall === 2) return [{ affectedRows: 4 }, []];
      if (executeCall === 3) {
        return [[
            { lineGroupId: "C1" },
            { lineGroupId: "C2" },
            { lineGroupId: "C3" },
            { lineGroupId: "C4" },
          ],
          [],
        ];
      }
      if (executeCall >= 16 && executeCall <= 18) return [[{ rowCount: 4 }], []];
      return [{ affectedRows: 1 }, []];
    });
    const db = {
      transaction: vi.fn(async (callback: (tx: { execute: typeof execute }) => Promise<unknown>) => callback({ execute })),
    };

    await expect(applyLineGroupAutomationDefaultsRolloutUsingDb(db as any)).resolves.toEqual({
      applied: true,
      activeGroupCount: 4,
      settingsRowCount: 4,
    });
    expect(execute).toHaveBeenCalledTimes(19);

    const alreadyClaimedExecute = vi.fn().mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    const alreadyClaimedDb = {
      transaction: vi.fn(async (callback: (tx: { execute: typeof alreadyClaimedExecute }) => Promise<unknown>) => callback({ execute: alreadyClaimedExecute })),
    };
    await expect(applyLineGroupAutomationDefaultsRolloutUsingDb(alreadyClaimedDb as any)).resolves.toEqual({
      applied: false,
      activeGroupCount: 0,
      settingsRowCount: 0,
    });
    expect(alreadyClaimedExecute).toHaveBeenCalledTimes(1);
  });

  it("rolls back without finalizing when active automation rows are incomplete", async () => {
    let executeCall = 0;
    const execute = vi.fn(async () => {
      executeCall += 1;
      if (executeCall === 1) return [{ affectedRows: 1 }, []];
      if (executeCall === 2) return [{ affectedRows: 1 }, []];
      if (executeCall === 3) return [[{ lineGroupId: "C1" }], []];
      if (executeCall === 7) return [[{ rowCount: 1 }], []];
      if (executeCall === 8) return [[{ rowCount: 0 }], []];
      if (executeCall === 9) return [[{ rowCount: 1 }], []];
      return [{ affectedRows: 1 }, []];
    });
    const db = {
      transaction: vi.fn(async (callback: (tx: { execute: typeof execute }) => Promise<unknown>) => callback({ execute })),
    };

    await expect(applyLineGroupAutomationDefaultsRolloutUsingDb(db as any))
      .rejects.toThrow("LINE group automation rollout invariant failed");
    expect(execute).toHaveBeenCalledTimes(9);
    expect(getLineGroupAutomationDefaultsRuntimeStatus()).toMatchObject({
      state: "failed",
      step: "count",
      failureCode: "LINE_GROUP_AUTOMATION_COUNT_MISMATCH",
    });
  });

  it("omits Japanese addresses, labeled identities and third-party names from group AI input", () => {
    expect(sanitizeGroupMessageForAi("東京都港区海岸1丁目7番1号です", [], 420))
      .toBe("[個人情報を含む発言は分析対象から省略]");
    expect(sanitizeGroupMessageForAi("担当者名：山田花子", [], 420))
      .toBe("[個人情報を含む発言は分析対象から省略]");
    expect(sanitizeGroupMessageForAi("佐藤社長に連絡します", [], 420))
      .toBe("[個人情報を含む発言は分析対象から省略]");
  });

  it("rejects a group event unless ingress proves an explicit bot mention", async () => {
    const event = {
      type: "message",
      timestamp: 1_789_000_000_000,
      source: { type: "group" as const, groupId: "C-group-1", userId: "U-group-liver" },
      message: { id: "group-unverified", type: "text", text: "@LCJ 相談したい" },
    };
    await expect(tryHandleLineAiManagerMessage(event)).resolves.toBe(false);
  });
});
