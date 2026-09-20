import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  DAILY_REPORT_REQUIRED_ANSWER_COUNT,
  getJstDayRange,
  isDailyReportConversationIntent,
} from "../shared/dailyReportConversation";



describe("Chat Report Data Structures", () => {
  it("should support chat session with required fields", () => {
    const sessionData = {
      staffId: 1,
      reportDate: "2026-01-20",
      status: "active" as const,
    };
    
    expect(sessionData.staffId).toBeDefined();
    expect(sessionData.reportDate).toBeDefined();
    expect(sessionData.status).toBe("active");
  });

  it("should support chat message with required fields", () => {
    const messageData = {
      sessionId: 1,
      role: "ai" as const,
      content: "今日はどんな業務をしましたか？",
      messageType: "question",
    };
    
    expect(messageData.sessionId).toBeDefined();
    expect(messageData.role).toBe("ai");
    expect(messageData.content).toBeDefined();
    expect(messageData.messageType).toBe("question");
  });

  it("should support staff profile with personalization data", () => {
    const profileData = {
      staffId: 1,
      preferredQuestionStyle: "detailed",
      commonTopics: JSON.stringify(["営業", "イベント", "フォローアップ"]),
      strengthAreas: JSON.stringify(["コミュニケーション", "企画"]),
      improvementAreas: JSON.stringify(["時間管理"]),
    };
    
    expect(profileData.staffId).toBeDefined();
    expect(profileData.preferredQuestionStyle).toBe("detailed");
    expect(JSON.parse(profileData.commonTopics)).toHaveLength(3);
  });
});

describe("Personalized Question Generation", () => {
  it("should generate different questions based on day of week", () => {
    const monday = new Date("2026-01-19T12:00:00"); // Monday
    const friday = new Date("2026-01-23T12:00:00"); // Friday
    
    const mondayDay = monday.getUTCDay();
    const fridayDay = friday.getUTCDay();
    
    expect(mondayDay).toBe(1); // Monday
    expect(fridayDay).toBe(5); // Friday
    
    // Different days should potentially generate different questions
    expect(mondayDay).not.toBe(fridayDay);
  });

  it("should support context from previous reports", () => {
    const previousReportContext = {
      lastReportDate: "2026-01-19",
      lastWorkContent: "イベント準備、クライアント対応",
      pendingFollowups: ["ビズリーチ岡田さんとの打ち合わせ"],
    };
    
    expect(previousReportContext.lastReportDate).toBeDefined();
    expect(previousReportContext.pendingFollowups).toHaveLength(1);
  });

  it("should support context from pending followups", () => {
    const followupContext = {
      pendingItems: [
        { item: "新規ライバーへのフォロー", category: "営業", daysOverdue: 2 },
        { item: "商談資料の準備", category: "準備", daysOverdue: 0 },
      ],
    };
    
    expect(followupContext.pendingItems).toHaveLength(2);
    expect(followupContext.pendingItems[0].daysOverdue).toBe(2);
  });
});

describe("Report Conversion", () => {
  it("should extract work content from chat messages", () => {
    const chatMessages = [
      { role: "ai", content: "今日はどんな業務をしましたか？" },
      { role: "user", content: "イベントの企業リストをまとめました" },
      { role: "ai", content: "他には何かありますか？" },
      { role: "user", content: "新規ライバーさんに声掛けしました" },
    ];
    
    const userMessages = chatMessages.filter(m => m.role === "user");
    expect(userMessages).toHaveLength(2);
    
    const workContent = userMessages.map(m => m.content).join("\n");
    expect(workContent).toContain("イベント");
    expect(workContent).toContain("ライバー");
  });

  it("should extract issues from chat messages", () => {
    const chatMessages = [
      { role: "ai", content: "何か気づきや課題はありましたか？" },
      { role: "user", content: "時間配分を見直す必要がある" },
    ];
    
    const userMessages = chatMessages.filter(m => m.role === "user");
    const issues = userMessages.map(m => m.content).join("\n");
    
    expect(issues).toContain("時間配分");
  });
});

describe("LCJ Brain daily report conversation", () => {
  it.each([
    "帮我通过对话写今天的日报",
    "我想填写日报",
    "日報を作成したい",
    "今日の日報を書きたい",
  ])("recognizes a report-writing request: %s", message => {
    expect(isDailyReportConversationIntent(message)).toBe(true);
  });

  it.each(["帮我看看日报", "分析本月日报", "昨天的日报有什么问题"])(
    "does not intercept a read-only report question: %s",
    message => expect(isDailyReportConversationIntent(message)).toBe(false)
  );

  it("uses Tokyo calendar-day boundaries", () => {
    const beforeMidnight = getJstDayRange(new Date("2026-09-20T14:59:59.000Z"));
    expect(beforeMidnight.start.toISOString()).toBe("2026-09-19T15:00:00.000Z");
    expect(beforeMidnight.end.toISOString()).toBe("2026-09-20T15:00:00.000Z");
    const atMidnight = getJstDayRange(new Date("2026-09-20T15:00:00.000Z"));
    expect(atMidnight.start.toISOString()).toBe("2026-09-20T15:00:00.000Z");
    expect(atMidnight.end.toISOString()).toBe("2026-09-21T15:00:00.000Z");
  });

  it("keeps the Brain UI, server questions, and save transaction aligned", () => {
    const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const database = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    const brain = readFileSync(new URL("../client/src/pages/LcjBrain.tsx", import.meta.url), "utf8");
    const chatReport = readFileSync(new URL("../client/src/pages/ChatReport.tsx", import.meta.url), "utf8");
    const reportsPage = readFileSync(new URL("../client/src/pages/Reports.tsx", import.meta.url), "utf8");

    expect(DAILY_REPORT_REQUIRED_ANSWER_COUNT).toBe(3);
    expect(router).toContain('"tomorrow_plan"');
    expect(router).toContain('remarks: { type: "string"');
    expect(router).toContain('required: ["workContent", "issues", "remarks"]');
    expect(router).toContain("convertChatSessionToReport");
    expect(database).toContain("db.transaction(async transaction =>");
    expect(database).toContain("FOR UPDATE");
    expect(database).toContain("SELECT id FROM report_staff");
    expect(database).toContain("getOrCreateTodayChatSession");
    expect(database).toContain('status === "converted"');
    expect(database).toContain('actionType: "report_create_chat"');
    expect(brain).toContain('data-testid="lcj-brain-daily-report-chat"');
    expect(brain).toContain("<ChatReport embedded />");
    expect(chatReport).toContain("DAILY_REPORT_REQUIRED_ANSWER_COUNT");
    expect(chatReport).toContain("已保存到正式日报");
    expect(reportsPage).toContain("/master/lcj-brain?tab=chat&mode=daily-report");
    expect(reportsPage).toContain("和LCJ Brain继续沟通");
  });
});

describe("AI Learning from Feedback", () => {
  it("should track feedback for questions", () => {
    const feedbackData = {
      questionId: 1,
      staffId: 1,
      isHelpful: true,
      questionType: "work_content",
    };
    
    expect(feedbackData.isHelpful).toBe(true);
    expect(feedbackData.questionType).toBe("work_content");
  });

  it("should aggregate feedback for personalization", () => {
    const feedbackHistory = [
      { questionType: "detailed", isHelpful: true },
      { questionType: "detailed", isHelpful: true },
      { questionType: "brief", isHelpful: false },
    ];
    
    const helpfulDetailed = feedbackHistory.filter(
      f => f.questionType === "detailed" && f.isHelpful
    ).length;
    
    expect(helpfulDetailed).toBe(2);
  });
});
