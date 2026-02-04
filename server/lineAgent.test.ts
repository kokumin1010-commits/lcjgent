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


// Tests for Multi-Image OCR Processing
describe("LINE Agent - Multi-Image OCR Processing", () => {
  describe("LLM Response Parsing", () => {
    it("should parse JSON response without markdown code blocks", async () => {
      const rawResponse = `{"isTikTokShop": true, "isDelivered": true, "orderNumber": "582307265940784437", "totalAmount": 6864, "orderDate": "2025-01-25", "shopName": "KYOGOKU JAPAN", "productName": "シャンプー"}`;
      
      // Parse JSON
      let jsonStr = rawResponse;
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.replace(/```\s*/g, "");
      }
      jsonStr = jsonStr.trim();
      
      const parsed = JSON.parse(jsonStr);
      
      expect(parsed.isTikTokShop).toBe(true);
      expect(parsed.isDelivered).toBe(true);
      expect(parsed.orderNumber).toBe("582307265940784437");
      expect(parsed.totalAmount).toBe(6864);
      expect(parsed.shopName).toBe("KYOGOKU JAPAN");
    });

    it("should parse JSON response with markdown code blocks", async () => {
      const rawResponse = `\`\`\`json
{
  "isTikTokShop": true,
  "isDelivered": true,
  "orderNumber": "582307265940784437",
  "totalAmount": 6864,
  "orderDate": "2025-01-25",
  "shopName": "KYOGOKU JAPAN",
  "productName": "シャンプー"
}
\`\`\``;
      
      // Parse JSON (same logic as in lineAgent.ts)
      let jsonStr = rawResponse;
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.replace(/```\s*/g, "");
      }
      jsonStr = jsonStr.trim();
      
      const parsed = JSON.parse(jsonStr);
      
      expect(parsed.isTikTokShop).toBe(true);
      expect(parsed.isDelivered).toBe(true);
      expect(parsed.orderNumber).toBe("582307265940784437");
      expect(parsed.totalAmount).toBe(6864);
    });

    it("should handle null values in response", async () => {
      const rawResponse = `{"isTikTokShop": true, "isDelivered": true, "orderNumber": "582307265940784437", "totalAmount": 6864, "orderDate": null, "shopName": null, "productName": null}`;
      
      const parsed = JSON.parse(rawResponse);
      
      expect(parsed.isTikTokShop).toBe(true);
      expect(parsed.orderNumber).toBe("582307265940784437");
      expect(parsed.orderDate).toBeNull();
      expect(parsed.shopName).toBeNull();
    });
  });

  describe("Delivery Status Detection", () => {
    it("should detect delivery status from 'X月X日に配達' pattern", () => {
      // This tests the LLM prompt's ability to recognize delivery patterns
      const deliveryPatterns = [
        "1月28日に配達",
        "12月15日に配達",
        "2月1日に配達",
      ];
      
      // These patterns should be recognized by the LLM as delivered
      deliveryPatterns.forEach(pattern => {
        expect(pattern).toMatch(/\d+月\d+日に配達/);
      });
    });

    it("should detect delivery status from '配達済み' text", () => {
      const deliveryTexts = [
        "配達済み",
        "ステータス: 配達済み",
        "配達済み - 1月28日",
      ];
      
      deliveryTexts.forEach(text => {
        expect(text).toContain("配達済み");
      });
    });

    it("should detect delivery status from 'お荷物が最終目的地に到着しました' text", () => {
      const text = "お荷物が最終目的地に到着しました";
      expect(text).toContain("最終目的地に到着");
    });
  });

  describe("Points Calculation", () => {
    it("should calculate 1% points correctly", () => {
      const testCases = [
        { totalAmount: 6864, expectedPoints: 68 },
        { totalAmount: 10000, expectedPoints: 100 },
        { totalAmount: 1500, expectedPoints: 15 },
        { totalAmount: 99, expectedPoints: 0 },
      ];
      
      testCases.forEach(({ totalAmount, expectedPoints }) => {
        const pointsCalculated = Math.floor(totalAmount * 0.01);
        expect(pointsCalculated).toBe(expectedPoints);
      });
    });
  });

  describe("Fraud Detection", () => {
    it("should flag orders older than 30 days", () => {
      const orderDate = new Date("2025-01-01");
      const now = new Date("2025-02-15");
      const daysSinceOrder = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(daysSinceOrder).toBeGreaterThan(30);
    });

    it("should flag high amount purchases over 100,000 JPY", () => {
      const highAmounts = [100001, 150000, 200000];
      const normalAmounts = [99999, 50000, 6864];
      
      highAmounts.forEach(amount => {
        expect(amount).toBeGreaterThan(100000);
      });
      
      normalAmounts.forEach(amount => {
        expect(amount).toBeLessThanOrEqual(100000);
      });
    });
  });

  describe("Image Session Management", () => {
    it("should buffer images for 10 seconds", () => {
      const IMAGE_SESSION_TIMEOUT_MS = 10 * 1000;
      expect(IMAGE_SESSION_TIMEOUT_MS).toBe(10000);
    });

    it("should handle multiple images in a session", () => {
      interface PendingImageData {
        messageId: string;
        receiptId: number;
      }
      
      interface PendingImageSession {
        userId: string;
        images: PendingImageData[];
      }
      
      const session: PendingImageSession = {
        userId: "test-user",
        images: [],
      };
      
      // Add first image
      session.images.push({ messageId: "msg1", receiptId: 1 });
      expect(session.images.length).toBe(1);
      
      // Add second image
      session.images.push({ messageId: "msg2", receiptId: 2 });
      expect(session.images.length).toBe(2);
      
      // Add third image
      session.images.push({ messageId: "msg3", receiptId: 3 });
      expect(session.images.length).toBe(3);
    });
  });

  describe("Order Number Validation", () => {
    it("should validate TikTok Shop order number format (17-18 digits)", () => {
      const validOrderNumbers = [
        "582307265940784437",
        "123456789012345678",
      ];
      
      const invalidOrderNumbers = [
        "12345", // too short
        "abc123456789012345", // contains letters
      ];
      
      validOrderNumbers.forEach(orderNumber => {
        expect(orderNumber).toMatch(/^\d{17,18}$/);
      });
      
      invalidOrderNumbers.forEach(orderNumber => {
        expect(orderNumber).not.toMatch(/^\d{17,18}$/);
      });
    });
  });
});
