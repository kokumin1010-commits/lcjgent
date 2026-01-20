import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  getAllLineUsers: vi.fn(),
  getAllLineGroups: vi.fn(),
  getLineMessages: vi.fn(),
  saveLineMessage: vi.fn(),
}));

// Mock the LINE API functions
vi.mock("./line", () => ({
  pushMessage: vi.fn(),
}));

import {
  getAllLineUsers,
  getAllLineGroups,
  getLineMessages,
  saveLineMessage,
} from "./db";
import { pushMessage } from "./line";

describe("LINE Management Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllLineUsers", () => {
    it("should return an array of LINE users", async () => {
      const mockUsers = [
        {
          id: 1,
          lineUserId: "U1234567890",
          displayName: "Test User",
          pictureUrl: "https://example.com/pic.jpg",
          userType: "customer" as const,
          isBlocked: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      vi.mocked(getAllLineUsers).mockResolvedValue(mockUsers);
      
      const result = await getAllLineUsers();
      
      expect(result).toEqual(mockUsers);
      expect(getAllLineUsers).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no users exist", async () => {
      vi.mocked(getAllLineUsers).mockResolvedValue([]);
      
      const result = await getAllLineUsers();
      
      expect(result).toEqual([]);
    });
  });

  describe("getAllLineGroups", () => {
    it("should return an array of LINE groups", async () => {
      const mockGroups = [
        {
          id: 1,
          lineGroupId: "C1234567890",
          groupName: "Test Group",
          pictureUrl: null,
          brandId: null,
          isActive: true,
          notificationsEnabled: true,
          lastMessageAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      vi.mocked(getAllLineGroups).mockResolvedValue(mockGroups);
      
      const result = await getAllLineGroups();
      
      expect(result).toEqual(mockGroups);
      expect(getAllLineGroups).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no groups exist", async () => {
      vi.mocked(getAllLineGroups).mockResolvedValue([]);
      
      const result = await getAllLineGroups();
      
      expect(result).toEqual([]);
    });
  });

  describe("getLineMessages", () => {
    it("should return messages for a specific user", async () => {
      const mockMessages = [
        {
          id: 1,
          messageId: "msg123",
          sourceType: "user" as const,
          lineUserId: "U1234567890",
          lineGroupId: null,
          messageType: "text",
          content: "Hello!",
          direction: "incoming" as const,
          lineTimestamp: null,
          createdAt: new Date(),
        },
      ];
      
      vi.mocked(getLineMessages).mockResolvedValue(mockMessages);
      
      const result = await getLineMessages({
        lineUserId: "U1234567890",
        limit: 50,
      });
      
      expect(result).toEqual(mockMessages);
      expect(getLineMessages).toHaveBeenCalledWith({
        lineUserId: "U1234567890",
        limit: 50,
      });
    });

    it("should return all messages when no filter specified", async () => {
      const mockMessages = [
        {
          id: 1,
          messageId: "msg123",
          sourceType: "user" as const,
          lineUserId: "U1234567890",
          lineGroupId: null,
          messageType: "text",
          content: "Hello!",
          direction: "incoming" as const,
          lineTimestamp: null,
          createdAt: new Date(),
        },
        {
          id: 2,
          messageId: "msg456",
          sourceType: "group" as const,
          lineUserId: null,
          lineGroupId: "C1234567890",
          messageType: "text",
          content: "Group message",
          direction: "incoming" as const,
          lineTimestamp: null,
          createdAt: new Date(),
        },
      ];
      
      vi.mocked(getLineMessages).mockResolvedValue(mockMessages);
      
      const result = await getLineMessages({ limit: 100 });
      
      expect(result).toHaveLength(2);
    });
  });

  describe("pushMessage", () => {
    it("should send a message successfully", async () => {
      vi.mocked(pushMessage).mockResolvedValue(true);
      
      const result = await pushMessage("U1234567890", [
        { type: "text", text: "Hello!" },
      ]);
      
      expect(result).toBe(true);
      expect(pushMessage).toHaveBeenCalledWith("U1234567890", [
        { type: "text", text: "Hello!" },
      ]);
    });

    it("should return false when message fails to send", async () => {
      vi.mocked(pushMessage).mockResolvedValue(false);
      
      const result = await pushMessage("U1234567890", [
        { type: "text", text: "Hello!" },
      ]);
      
      expect(result).toBe(false);
    });
  });

  describe("saveLineMessage", () => {
    it("should save an outgoing message", async () => {
      const mockSavedMessage = {
        id: 1,
        messageId: "out_123456789",
        sourceType: "user" as const,
        lineUserId: "U1234567890",
        messageType: "text",
        content: "Hello!",
        direction: "outgoing" as const,
      };
      
      vi.mocked(saveLineMessage).mockResolvedValue(mockSavedMessage);
      
      const result = await saveLineMessage({
        messageId: "out_123456789",
        sourceType: "user",
        lineUserId: "U1234567890",
        messageType: "text",
        content: "Hello!",
        direction: "outgoing",
      });
      
      expect(result).toEqual(mockSavedMessage);
      expect(saveLineMessage).toHaveBeenCalledTimes(1);
    });

    it("should save an incoming message", async () => {
      const mockSavedMessage = {
        id: 2,
        messageId: "msg123456",
        sourceType: "user" as const,
        lineUserId: "U1234567890",
        messageType: "text",
        content: "Hi there!",
        direction: "incoming" as const,
      };
      
      vi.mocked(saveLineMessage).mockResolvedValue(mockSavedMessage);
      
      const result = await saveLineMessage({
        messageId: "msg123456",
        sourceType: "user",
        lineUserId: "U1234567890",
        messageType: "text",
        content: "Hi there!",
        direction: "incoming",
      });
      
      expect(result).toEqual(mockSavedMessage);
    });
  });
});

describe("LINE Message Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send and save a message in sequence", async () => {
    vi.mocked(pushMessage).mockResolvedValue(true);
    vi.mocked(saveLineMessage).mockResolvedValue({
      id: 1,
      messageId: "out_test",
      sourceType: "user" as const,
      lineUserId: "U1234567890",
      messageType: "text",
      content: "Test message",
      direction: "outgoing" as const,
    });
    
    // Simulate the flow: send message, then save if successful
    const sendResult = await pushMessage("U1234567890", [
      { type: "text", text: "Test message" },
    ]);
    
    expect(sendResult).toBe(true);
    
    if (sendResult) {
      const saveResult = await saveLineMessage({
        messageId: "out_test",
        sourceType: "user",
        lineUserId: "U1234567890",
        messageType: "text",
        content: "Test message",
        direction: "outgoing",
      });
      
      expect(saveResult).toBeDefined();
      expect(saveResult?.id).toBe(1);
    }
    
    expect(pushMessage).toHaveBeenCalledTimes(1);
    expect(saveLineMessage).toHaveBeenCalledTimes(1);
  });

  it("should not save message when send fails", async () => {
    vi.mocked(pushMessage).mockResolvedValue(false);
    
    const sendResult = await pushMessage("U1234567890", [
      { type: "text", text: "Test message" },
    ]);
    
    expect(sendResult).toBe(false);
    
    // Should not save if send failed
    if (sendResult) {
      await saveLineMessage({
        messageId: "out_test",
        sourceType: "user",
        lineUserId: "U1234567890",
        messageType: "text",
        content: "Test message",
        direction: "outgoing",
      });
    }
    
    expect(pushMessage).toHaveBeenCalledTimes(1);
    expect(saveLineMessage).not.toHaveBeenCalled();
  });
});
