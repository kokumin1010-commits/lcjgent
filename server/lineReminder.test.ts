import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules before importing the module under test
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./_core/lineMessaging", () => ({
  sendLinePushMessage: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Import after mocking
import { containsReminderKeyword, parseReminderRequest } from "./lineReminder";
import { invokeLLM } from "./_core/llm";

describe("LINE Reminder Module", () => {
  describe("containsReminderKeyword", () => {
    it("should detect Japanese reminder keywords", () => {
      expect(containsReminderKeyword("リマインドして")).toBe(true);
      expect(containsReminderKeyword("リマインダー設定")).toBe(true);
      expect(containsReminderKeyword("通知して")).toBe(true);
      expect(containsReminderKeyword("教えて")).toBe(true);
      expect(containsReminderKeyword("知らせて")).toBe(true);
      expect(containsReminderKeyword("アラーム")).toBe(true);
      expect(containsReminderKeyword("起こして")).toBe(true);
    });

    it("should detect English reminder keywords", () => {
      expect(containsReminderKeyword("remind me")).toBe(true);
      expect(containsReminderKeyword("set a reminder")).toBe(true);
    });

    it("should not detect non-reminder messages", () => {
      expect(containsReminderKeyword("こんにちは")).toBe(false);
      expect(containsReminderKeyword("ポイント確認")).toBe(false);
      expect(containsReminderKeyword("ありがとう")).toBe(false);
    });

    it("should be case-insensitive for English keywords", () => {
      expect(containsReminderKeyword("REMIND me")).toBe(true);
      expect(containsReminderKeyword("Reminder")).toBe(true);
    });
  });

  describe("parseReminderRequest", () => {
    const mockInvokeLLM = vi.mocked(invokeLLM);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should parse a valid reminder request", async () => {
      // Mock LLM response for a valid reminder
      const mockDate = new Date("2026-02-04T10:00:00+09:00"); // 10:00 JST
      
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              isValid: true,
              year: 2026,
              month: 2,
              day: 4,
              hour: 15,
              minute: 0,
              message: "会議",
              errorMessage: "",
            }),
          },
        }],
      } as any);

      const result = await parseReminderRequest("今日の15時に会議をリマインドして", mockDate);

      expect(result).not.toBeNull();
      expect(result?.isValid).toBe(true);
      expect(result?.message).toBe("会議");
      // The scheduled time should be in the future
      expect(result?.scheduledAt).toBeGreaterThan(mockDate.getTime());
    });

    it("should return error for past dates", async () => {
      const mockDate = new Date("2026-02-04T10:00:00+09:00"); // 10:00 JST
      
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              isValid: true,
              year: 2026,
              month: 2,
              day: 4,
              hour: 8, // 8:00 JST (past)
              minute: 0,
              message: "リマインダー",
              errorMessage: "",
            }),
          },
        }],
      } as any);

      const result = await parseReminderRequest("今日の8時にリマインドして", mockDate);

      expect(result).not.toBeNull();
      expect(result?.isValid).toBe(false);
      expect(result?.errorMessage).toContain("過ぎています");
    });

    it("should handle LLM returning invalid response", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              isValid: false,
              year: 0,
              month: 0,
              day: 0,
              hour: 0,
              minute: 0,
              message: "",
              errorMessage: "日時を解析できませんでした",
            }),
          },
        }],
      } as any);

      const result = await parseReminderRequest("あいうえお");

      expect(result).not.toBeNull();
      expect(result?.isValid).toBe(false);
      expect(result?.errorMessage).toContain("解析できません");
    });

    it("should return null on LLM error", async () => {
      mockInvokeLLM.mockRejectedValueOnce(new Error("LLM error"));

      const result = await parseReminderRequest("リマインドして");

      expect(result).toBeNull();
    });
  });
});
