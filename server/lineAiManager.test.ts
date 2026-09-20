import { describe, expect, it } from "vitest";
import {
  __lineAiManagerTestUtils,
  LINE_AI_MANAGER_MODEL,
  tryHandleLineAiManagerMessage,
} from "./lineAiManager";

const {
  normalizeTikTokUsername,
  sanitizeForAi,
  sanitizeGroupMessageForAi,
  buildGroupReplyIdentityPayload,
  parseAiManagerReply,
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

  it("always identifies the sender as the LCJ official AI manager", () => {
    const parsed = parseAiManagerReply(JSON.stringify({
      reply: "今日も配信準備を進められていて素敵です。次は配信予定日を教えてください。",
      intent: "配信予定確認",
      nextAction: "配信予定日を確認する",
    }));
    expect(parsed.reply).toContain("LCJ公式AIマネージャー");
    expect(parsed.intent).toBe("配信予定確認");
  });

  it("does not duplicate an existing AI disclosure", () => {
    const parsed = parseAiManagerReply(JSON.stringify({
      reply: "ありがとうございます。\n— LCJ公式AIマネージャー",
      intent: "感謝",
      nextAction: "会話を継続する",
    }));
    expect(parsed.reply.match(/LCJ公式AIマネージャー/g)).toHaveLength(1);
  });

  it("limits proactive delivery to weekday daytime in Japan", () => {
    expect(isWithinAiManagerHours(new Date("2026-09-21T02:00:00Z"))).toBe(true);
    expect(isWithinAiManagerHours(new Date("2026-09-20T02:00:00Z"))).toBe(false);
    expect(isWithinAiManagerHours(new Date("2026-09-21T10:00:00Z"))).toBe(false);
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
      "山田花子さんの注文ID: AB12CD34、@hanako_liveへ連絡してください",
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
