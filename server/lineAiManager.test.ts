import { describe, expect, it } from "vitest";
import {
  __lineAiManagerTestUtils,
  LINE_AI_MANAGER_MODEL,
  tryHandleLineAiManagerMessage,
} from "./lineAiManager";

const {
  normalizeTikTokUsername,
  sanitizeForAi,
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
