import { describe, it, expect } from "vitest";

// Helper function to clean AI response from thinking process
// This is a copy of the function from routers.ts for testing purposes
const cleanAiResponse = (text: string): string => {
  // Remove patterns like "(22 characters)", "**Review and Finalize:**", "**Final Output Generation:**"
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
    // Try to find a question mark and extract the sentence
    const questionMatch = text.match(/[^\.!\?\n]+[\?？]/g);
    if (questionMatch && questionMatch.length > 0) {
      cleaned = questionMatch[questionMatch.length - 1].trim();
    }
  }
  
  return cleaned;
};

describe("cleanAiResponse", () => {
  it("should remove character count patterns", () => {
    const input = "火曜日ですね！今日の業務は何をしましたか？ (22 characters)";
    const expected = "火曜日ですね！今日の業務は何をしましたか？";
    expect(cleanAiResponse(input)).toBe(expected);
  });

  it("should remove numbered thinking steps with headers", () => {
    const input = `火曜日ですね！今日の業務は何をしましたか？ (22 characters)

5. **Review and Finalize:** Meets all criteria (Tuesday reference, friendly, asks about today's work, well under 50 characters). (Self-correction: Keep it simple and direct.)

6. **Final Output Generation:**火曜日お疲れ様です！今日の業務は何をしましたか？`;
    const result = cleanAiResponse(input);
    expect(result).not.toContain("Review and Finalize");
    expect(result).not.toContain("Final Output Generation");
    expect(result).not.toContain("characters");
    expect(result).not.toContain("Meets all criteria");
  });

  it("should handle clean input without modification", () => {
    const input = "今日はどんな業務をしましたか？";
    expect(cleanAiResponse(input)).toBe(input);
  });

  it("should remove markdown headers", () => {
    const input = "**Review and Finalize:** 火曜日お疲れ様です！";
    const result = cleanAiResponse(input);
    expect(result).not.toContain("**Review and Finalize:**");
    expect(result).toContain("火曜日お疲れ様です！");
  });

  it("should remove Self-correction notes", () => {
    const input = "火曜日お疲れ様です！(Self-correction: Keep it simple.)";
    const result = cleanAiResponse(input);
    expect(result).not.toContain("Self-correction");
    expect(result).toBe("火曜日お疲れ様です！");
  });

  it("should handle Chinese text", () => {
    const input = "周二辛苦了！今天做了什么工作？ (18 characters)";
    const expected = "周二辛苦了！今天做了什么工作？";
    expect(cleanAiResponse(input)).toBe(expected);
  });

  it("should extract question from complex response", () => {
    const input = `5. **Review and Finalize:** Meets all criteria.

6. **Final Output Generation:**今日の業務は何をしましたか？`;
    const result = cleanAiResponse(input);
    expect(result).toContain("今日の業務は何をしましたか？");
  });

  it("should handle multiple character count patterns", () => {
    const input = "質問文 (10 characters) 追加テキスト (15 characters)";
    const result = cleanAiResponse(input);
    expect(result).not.toContain("characters");
    // After removing character counts, spaces are normalized
    expect(result).toBe("質問文 追加テキスト");
  });

  it("should handle criteria mentions in parentheses", () => {
    // This test checks that criteria in parentheses are removed when they contain specific keywords
    const input = "火曜日お疲れ様です！(criteria: Tuesday reference, friendly)";
    const result = cleanAiResponse(input);
    expect(result).not.toContain("criteria");
    expect(result).toBe("火曜日お疲れ様です！");
  });

  it("should handle the exact bug case from screenshot", () => {
    const input = `火曜日ですね！今日の業務は何をしましたか？ (22 characters)

5. **Review and Finalize:** Meets all criteria (Tuesday reference, friendly, asks about today's work, well under 50 characters). (Self-correction: Keep it simple and direct.)

6. **Final Output Generation:**火曜日お疲れ様です！今日の業務は何をしましたか？`;
    const result = cleanAiResponse(input);
    
    // Should not contain any thinking process
    expect(result).not.toContain("characters");
    expect(result).not.toContain("Review and Finalize");
    expect(result).not.toContain("Final Output Generation");
    expect(result).not.toContain("Meets all criteria");
    expect(result).not.toContain("Self-correction");
    
    // Should contain the actual question
    expect(result.length).toBeGreaterThan(5);
  });
});
