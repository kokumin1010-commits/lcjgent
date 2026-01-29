import { describe, it, expect, vi } from "vitest";
import { createCoachingMessage } from "./_core/lineMessaging";

describe("LINE Messaging - Coaching Message", () => {
  it("should create basic coaching message with sales amount", () => {
    const messages = createCoachingMessage(
      "テストライバー",
      1000000,
      null,
      null,
      undefined
    );
    
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].type).toBe("text");
    expect((messages[0] as { type: "text"; text: string }).text).toContain("テストライバー");
    expect((messages[0] as { type: "text"; text: string }).text).toContain("1,000,000");
  });

  it("should include metrics in the message", () => {
    const metrics = {
      "コンバージョン率": "5.2%",
      "客単価": "¥15,000",
      "時間効率": "¥50,000/時",
    };
    
    const messages = createCoachingMessage(
      "テストライバー",
      500000,
      null,
      metrics,
      undefined
    );
    
    const mainMessage = (messages[0] as { type: "text"; text: string }).text;
    expect(mainMessage).toContain("CVR: 5.2%");
    expect(mainMessage).toContain("客単価: ¥15,000");
    expect(mainMessage).toContain("時間効率: ¥50,000/時");
  });

  it("should include structured advice in the message", () => {
    const structuredAdvice = {
      summary: "今日の配信は素晴らしい結果でした",
      goodPoints: ["視聴者数が多かった", "商品紹介が上手だった"],
      improvements: ["配信時間を延ばすと良い"],
      nextActions: [
        { action: "商品紹介を増やす", reason: "売上向上のため", timing: "次回配信" },
      ],
      targetForNextTime: "売上100万円を目指す",
    };
    
    const messages = createCoachingMessage(
      "テストライバー",
      800000,
      structuredAdvice,
      null,
      undefined
    );
    
    expect(messages.length).toBeGreaterThan(1);
    
    // Check that structured content is included
    const allText = messages
      .filter((m): m is { type: "text"; text: string } => m.type === "text")
      .map(m => m.text)
      .join("\n");
    
    expect(allText).toContain("今日の配信は素晴らしい結果でした");
    expect(allText).toContain("視聴者数が多かった");
    expect(allText).toContain("商品紹介を増やす");
    expect(allText).toContain("売上100万円を目指す");
  });

  it("should fall back to plain advice when structured advice is not available", () => {
    const plainAdvice = "次回は商品紹介のタイミングを早めましょう";
    
    const messages = createCoachingMessage(
      "テストライバー",
      300000,
      null,
      null,
      plainAdvice
    );
    
    const allText = messages
      .filter((m): m is { type: "text"; text: string } => m.type === "text")
      .map(m => m.text)
      .join("\n");
    
    expect(allText).toContain(plainAdvice);
  });

  it("should limit messages to 5 or fewer", () => {
    const structuredAdvice = {
      summary: "総評テスト",
      goodPoints: ["良い点1", "良い点2", "良い点3"],
      improvements: ["改善点1", "改善点2", "改善点3"],
      nextActions: [
        { action: "アクション1", reason: "理由1", timing: "タイミング1" },
        { action: "アクション2", reason: "理由2", timing: "タイミング2" },
        { action: "アクション3", reason: "理由3", timing: "タイミング3" },
      ],
      targetForNextTime: "次回目標",
    };
    
    const messages = createCoachingMessage(
      "テストライバー",
      1000000,
      structuredAdvice,
      { "CVR": "5%" },
      undefined
    );
    
    // LINE API allows max 5 messages per request
    expect(messages.length).toBeLessThanOrEqual(5);
  });
});
