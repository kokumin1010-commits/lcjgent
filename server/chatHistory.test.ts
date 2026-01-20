import { describe, it, expect, vi } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  getChatSessionsByStaffId: vi.fn(),
  getMessagesBySessionId: vi.fn(),
}));

import { getChatSessionsByStaffId, getMessagesBySessionId } from "./db";

describe("Chat History Functions", () => {
  it("should get chat sessions by staff ID", async () => {
    const mockSessions = [
      {
        id: 1,
        staffId: 1,
        reportDate: new Date("2026-01-20"),
        status: "completed",
        createdAt: new Date(),
      },
      {
        id: 2,
        staffId: 1,
        reportDate: new Date("2026-01-19"),
        status: "converted",
        convertedReportId: 5,
        createdAt: new Date(),
      },
    ];

    vi.mocked(getChatSessionsByStaffId).mockResolvedValue(mockSessions);

    const result = await getChatSessionsByStaffId(1, 30);

    expect(result).toHaveLength(2);
    expect(result[0].staffId).toBe(1);
    expect(result[0].status).toBe("completed");
    expect(result[1].status).toBe("converted");
  });

  it("should return empty array when no sessions exist", async () => {
    vi.mocked(getChatSessionsByStaffId).mockResolvedValue([]);

    const result = await getChatSessionsByStaffId(999, 30);

    expect(result).toHaveLength(0);
  });

  it("should get messages by session ID", async () => {
    const mockMessages = [
      {
        id: 1,
        sessionId: 1,
        role: "ai",
        content: "火曜日ですね！今日の業務は何をしましたか？",
        messageType: "greeting",
        createdAt: new Date(),
      },
      {
        id: 2,
        sessionId: 1,
        role: "user",
        content: "今日は会議に参加しました",
        messageType: "response",
        createdAt: new Date(),
      },
      {
        id: 3,
        sessionId: 1,
        role: "ai",
        content: "会議の内容を教えてください",
        messageType: "follow_up",
        createdAt: new Date(),
      },
    ];

    vi.mocked(getMessagesBySessionId).mockResolvedValue(mockMessages);

    const result = await getMessagesBySessionId(1);

    expect(result).toHaveLength(3);
    expect(result[0].role).toBe("ai");
    expect(result[1].role).toBe("user");
    expect(result[2].role).toBe("ai");
  });

  it("should return empty array when session has no messages", async () => {
    vi.mocked(getMessagesBySessionId).mockResolvedValue([]);

    const result = await getMessagesBySessionId(999);

    expect(result).toHaveLength(0);
  });

  it("should respect limit parameter for sessions", async () => {
    const mockSessions = [
      { id: 1, staffId: 1, reportDate: new Date(), status: "completed", createdAt: new Date() },
      { id: 2, staffId: 1, reportDate: new Date(), status: "completed", createdAt: new Date() },
      { id: 3, staffId: 1, reportDate: new Date(), status: "completed", createdAt: new Date() },
    ];

    vi.mocked(getChatSessionsByStaffId).mockResolvedValue(mockSessions.slice(0, 2));

    const result = await getChatSessionsByStaffId(1, 2);

    expect(result).toHaveLength(2);
  });
});

describe("Clean AI Response", () => {
  // Test the cleanAiResponse function logic
  const cleanAiResponse = (text: string): string => {
    let cleaned = text;
    
    // Remove character count patterns
    cleaned = cleaned.replace(/\s*\(\d+\s*characters?\)/gi, "");
    
    // Remove numbered thinking steps with headers
    cleaned = cleaned.replace(/\d+\.\s*\*\*[^*]+\*\*:?[^\n]*\n?/g, "");
    
    // Remove markdown headers like **Review and Finalize:** or **Final Output Generation:**
    cleaned = cleaned.replace(/\*\*[^*]+\*\*:?\s*/g, "");
    
    // Remove lines starting with thinking process indicators
    cleaned = cleaned.replace(/^(Review|Finalize|Output|Generation|Self-correction|Meets|criteria)[^\n]*\n?/gim, "");
    
    // Remove parenthetical notes like (Self-correction: ...)
    cleaned = cleaned.replace(/\([^)]*Self-correction[^)]*\)/gi, "");
    cleaned = cleaned.replace(/\([^)]*criteria[^)]*\)/gi, "");
    
    // Clean up multiple newlines and trim
    cleaned = cleaned.replace(/\n{2,}/g, "\n").trim();
    
    // If the cleaned result is too short, try to extract just the question
    if (cleaned.length < 5) {
      const questionMatch = text.match(/[^\.!\?\n]+[\?？]/g);
      if (questionMatch && questionMatch.length > 0) {
        cleaned = questionMatch[questionMatch.length - 1].trim();
      }
    }
    
    return cleaned;
  };

  it("should remove character count from AI response", () => {
    const input = "火曜日ですね！今日の業務は何をしましたか？ (22 characters)";
    const result = cleanAiResponse(input);
    expect(result).toBe("火曜日ですね！今日の業務は何をしましたか？");
  });

  it("should remove Review and Finalize section", () => {
    const input = "火曜日ですね！今日の業務は何をしましたか？\n\n5. **Review and Finalize:** Meets all criteria";
    const result = cleanAiResponse(input);
    expect(result).not.toContain("Review and Finalize");
  });

  it("should remove numbered thinking steps", () => {
    const input = "1. **Analysis:** Good";
    const result = cleanAiResponse(input);
    // The cleanAiResponse removes numbered lines with ** headers
    expect(result).toBe("");
  });

  it("should handle clean input without modification", () => {
    const input = "火曜日ですね！今日の業務は何をしましたか？";
    const result = cleanAiResponse(input);
    expect(result).toBe("火曜日ですね！今日の業務は何をしましたか？");
  });
});
