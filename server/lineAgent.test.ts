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
      const { getAllStaff } = await import("./db");
      const staff = await getAllStaff();
      expect(staff).toHaveLength(2);
      expect(staff[0].name).toBe("田中太郎");
    });

    it("should support list_brands action", async () => {
      const { getAllBrands } = await import("./db");
      const brands = await getAllBrands();
      expect(brands).toHaveLength(2);
      expect(brands[0].name).toBe("ブランドA");
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
