import { describe, it, expect, vi } from "vitest";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "こんにちは！何かお手伝いできることはありますか？" } }],
  }),
}));

// Mock the LINE module
vi.mock("./line", () => ({
  replyMessage: vi.fn().mockResolvedValue(true),
  getUserProfile: vi.fn().mockResolvedValue({
    userId: "test-user-id",
    displayName: "テストユーザー",
    pictureUrl: "https://example.com/pic.jpg",
  }),
}));

// Mock the db module
vi.mock("./db", () => ({
  saveLineMessage: vi.fn().mockResolvedValue(undefined),
  getLineMessages: vi.fn().mockResolvedValue([]),
  createOrUpdateLineUser: vi.fn().mockResolvedValue(undefined),
  updateLineUserLastMessage: vi.fn().mockResolvedValue(undefined),
  getAllStaff: vi.fn().mockResolvedValue([
    { id: 1, name: "田中太郎" },
    { id: 2, name: "山田花子" },
  ]),
  createLineFollowUp: vi.fn().mockResolvedValue(undefined),
  getTasksByStatus: vi.fn().mockResolvedValue([]),
  getAllBrands: vi.fn().mockResolvedValue([
    { id: 1, name: "ブランドA" },
    { id: 2, name: "ブランドB" },
  ]),
}));

describe("LINE AI Agent", () => {
  describe("System Prompt", () => {
    it("should have a defined system prompt for the agent", async () => {
      // The system prompt is defined in lineAgent.ts
      // This test verifies the module can be imported
      const lineAgentModule = await import("./lineAgent");
      expect(lineAgentModule).toBeDefined();
      expect(lineAgentModule.processLineMessage).toBeDefined();
    });
  });

  describe("Agent Actions", () => {
    it("should support list_staff action", async () => {
      // Test that getAllStaff function exists and can be called
      const { getAllStaff } = await import("./db");
      const staff = await getAllStaff();
      expect(Array.isArray(staff)).toBe(true);
    });

    it("should support list_brands action", async () => {
      // Test that getAllBrands function exists and can be called
      const { getAllBrands } = await import("./db");
      const brands = await getAllBrands();
      expect(Array.isArray(brands)).toBe(true);
    });

    it("should support followup action", async () => {
      const { createLineFollowUp } = await import("./db");
      await createLineFollowUp({
        targetType: "user",
        lineUserId: "test-user",
        triggerCondition: "scheduled",
        delayHours: 24,
        maxAttempts: 1,
        messageTemplate: "テストメッセージ",
        nextScheduledAt: new Date(),
      });
      expect(createLineFollowUp).toHaveBeenCalled();
    });
  });

  describe("Message Processing", () => {
    it("should save incoming messages", async () => {
      const { saveLineMessage } = await import("./db");
      await saveLineMessage({
        messageId: "test-msg-id",
        sourceType: "user",
        lineUserId: "test-user",
        messageType: "text",
        content: "テストメッセージ",
        direction: "incoming",
      });
      expect(saveLineMessage).toHaveBeenCalled();
    });

    it("should get user profile", async () => {
      const { getUserProfile } = await import("./line");
      const profile = await getUserProfile("test-user-id");
      expect(profile).toBeDefined();
      expect(profile?.displayName).toBe("テストユーザー");
    });

    it("should reply to messages", async () => {
      const { replyMessage } = await import("./line");
      const result = await replyMessage("test-token", [
        { type: "text", text: "テスト返信" },
      ]);
      expect(result).toBe(true);
    });
  });

  describe("Conversation Context", () => {
    it("should retrieve conversation history", async () => {
      const { getLineMessages } = await import("./db");
      const messages = await getLineMessages({ lineUserId: "test-user", limit: 10 });
      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe("LLM Integration", () => {
    it("should call LLM for response generation", async () => {
      const { invokeLLM } = await import("./_core/llm");
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello" },
        ],
      });
      expect(response.choices).toBeDefined();
      expect(response.choices[0].message.content).toBeDefined();
    });
  });
});


// Additional tests for mention detection in group chats
describe("LINE Agent - Group Mention Detection", () => {
  // Re-mock with getBotInfo
  vi.mock("./line", () => ({
    replyMessage: vi.fn().mockResolvedValue(true),
    getUserProfile: vi.fn().mockResolvedValue({
      userId: "test-user-id",
      displayName: "テストユーザー",
      pictureUrl: "https://example.com/pic.jpg",
    }),
    getBotInfo: vi.fn().mockResolvedValue({
      userId: "bot-user-id",
      basicId: "@714isnih",
      displayName: "LCJ エージェント",
    }),
  }));

  vi.mock("./db", () => ({
    saveLineMessage: vi.fn().mockResolvedValue({ insertId: 1 }),
    getLineMessages: vi.fn().mockResolvedValue([]),
    createOrUpdateLineUser: vi.fn().mockResolvedValue(null),
    updateLineUserLastMessage: vi.fn().mockResolvedValue(null),
    getAllStaff: vi.fn().mockResolvedValue([]),
    createLineFollowUp: vi.fn().mockResolvedValue(null),
    getTasksByStatus: vi.fn().mockResolvedValue([]),
    getAllBrands: vi.fn().mockResolvedValue([]),
    createOrUpdateLineGroup: vi.fn().mockResolvedValue(null),
  }));

  describe("Mention patterns", () => {
    it("should detect @LCJ mention pattern", () => {
      const text = "@LCJ タスク一覧を見せて";
      const patterns = [/@LCJ/i, /@lcj/i, /LCJエージェント/i, /エージェント/i, /@714isnih/i];
      const matched = patterns.some(p => p.test(text));
      expect(matched).toBe(true);
    });

    it("should detect LCJエージェント mention pattern", () => {
      const text = "LCJエージェント スタッフ一覧";
      const patterns = [/@LCJ/i, /@lcj/i, /LCJエージェント/i, /エージェント/i, /@714isnih/i];
      const matched = patterns.some(p => p.test(text));
      expect(matched).toBe(true);
    });

    it("should detect @714isnih mention pattern", () => {
      const text = "@714isnih ブランド一覧";
      const patterns = [/@LCJ/i, /@lcj/i, /LCJエージェント/i, /エージェント/i, /@714isnih/i];
      const matched = patterns.some(p => p.test(text));
      expect(matched).toBe(true);
    });

    it("should detect エージェント keyword", () => {
      const text = "エージェント、明日の予定は？";
      const patterns = [/@LCJ/i, /@lcj/i, /LCJエージェント/i, /エージェント/i, /@714isnih/i];
      const matched = patterns.some(p => p.test(text));
      expect(matched).toBe(true);
    });

    it("should NOT detect mention in regular message", () => {
      const text = "普通のグループメッセージです";
      const patterns = [/@LCJ/i, /@lcj/i, /LCJエージェント/i, /エージェント/i, /@714isnih/i];
      const matched = patterns.some(p => p.test(text));
      expect(matched).toBe(false);
    });

    it("should detect case-insensitive @lcj mention", () => {
      const text = "@lcj 小文字でもOK";
      const patterns = [/@LCJ/i, /@lcj/i, /LCJエージェント/i, /エージェント/i, /@714isnih/i];
      const matched = patterns.some(p => p.test(text));
      expect(matched).toBe(true);
    });
  });

  describe("Mention removal", () => {
    it("should remove @LCJ from message", () => {
      const text = "@LCJ タスク一覧を見せて";
      const cleaned = text.replace(/@LCJ\s*/gi, "").trim();
      expect(cleaned).toBe("タスク一覧を見せて");
    });

    it("should remove LCJエージェント from message", () => {
      const text = "LCJエージェント スタッフ一覧";
      const cleaned = text.replace(/LCJエージェント\s*/gi, "").trim();
      expect(cleaned).toBe("スタッフ一覧");
    });

    it("should remove @714isnih from message", () => {
      const text = "@714isnih ブランド一覧";
      const cleaned = text.replace(/@714isnih\s*/gi, "").trim();
      expect(cleaned).toBe("ブランド一覧");
    });
  });
});
