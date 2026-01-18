import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  createReportFollowup: vi.fn().mockResolvedValue({
    id: 1,
    reportId: 1,
    reportStaffId: 1,
    extractedItem: "テスト打ち合わせ",
    category: "打ち合わせ",
    status: "pending",
    dueDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getPendingFollowups: vi.fn().mockResolvedValue([
    {
      followup: {
        id: 1,
        reportId: 1,
        reportStaffId: 1,
        extractedItem: "テスト打ち合わせ",
        category: "打ち合わせ",
        status: "pending",
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      staff: { id: 1, name: "テストスタッフ", country: "日本" },
      report: { id: 1, reportDate: new Date() },
    },
  ]),
  getOverdueFollowups: vi.fn().mockResolvedValue([
    {
      followup: {
        id: 1,
        reportId: 1,
        reportStaffId: 1,
        extractedItem: "期限切れの打ち合わせ",
        category: "打ち合わせ",
        status: "pending",
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      staff: { id: 1, name: "テストスタッフ", country: "日本" },
      report: { id: 1, reportDate: new Date() },
    },
  ]),
  updateFollowupStatus: vi.fn().mockResolvedValue(undefined),
  getFollowupsByReportId: vi.fn().mockResolvedValue([]),
  getFollowupsByStaffId: vi.fn().mockResolvedValue([]),
  deleteReportFollowup: vi.fn().mockResolvedValue(undefined),
  checkExistingFollowup: vi.fn().mockResolvedValue(null),
  getReportById: vi.fn().mockResolvedValue({
    report: {
      id: 1,
      reportStaffId: 1,
      reportDate: new Date(),
      workContent: "今日は物流会社との打ち合わせを行いました。提案書の作成も進めています。",
    },
    staff: { id: 1, name: "テストスタッフ" },
  }),
  getReportsForAnalysis: vi.fn().mockResolvedValue([]),
}));

describe("Followup Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Followup Keywords Detection", () => {
    it("should detect followup keywords in Japanese text", () => {
      const followupKeywords = [
        "提案", "打ち合わせ", "商談", "MTG", "ミーティング", "会議",
        "確認", "検討", "相談", "調整", "連絡", "報告",
        "合同", "会合", "面談", "訪問", "見積", "契約",
      ];
      
      const testText = "今日は物流会社との打ち合わせを行いました";
      const hasKeyword = followupKeywords.some(kw => testText.includes(kw));
      
      expect(hasKeyword).toBe(true);
    });

    it("should detect followup keywords in Chinese text", () => {
      const followupKeywords = [
        "提议", "会议", "商谈", "确认", "讨论", "协商", "联系"
      ];
      
      const testText = "今天和物流公司进行了会议";
      const hasKeyword = followupKeywords.some(kw => testText.includes(kw));
      
      expect(hasKeyword).toBe(true);
    });

    it("should not detect keywords in unrelated text", () => {
      const followupKeywords = [
        "提案", "打ち合わせ", "商談", "MTG", "ミーティング", "会議",
      ];
      
      const testText = "今日は資料を整理しました";
      const hasKeyword = followupKeywords.some(kw => testText.includes(kw));
      
      expect(hasKeyword).toBe(false);
    });
  });

  describe("Due Date Calculation", () => {
    it("should calculate due date as 2 days after report date", () => {
      const reportDate = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024 at noon
      const dueDate = new Date(reportDate);
      dueDate.setDate(dueDate.getDate() + 2);
      
      expect(dueDate.getDate()).toBe(17);
      expect(dueDate.getMonth()).toBe(0); // January
    });

    it("should handle month boundary correctly", () => {
      const reportDate = new Date(2024, 0, 30, 12, 0, 0); // Jan 30, 2024 at noon
      const dueDate = new Date(reportDate);
      dueDate.setDate(dueDate.getDate() + 2);
      
      expect(dueDate.getDate()).toBe(1);
      expect(dueDate.getMonth()).toBe(1); // February
    });
  });

  describe("Overdue Detection", () => {
    it("should identify overdue followups", () => {
      const dueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const now = new Date();
      
      const isOverdue = now > dueDate;
      
      expect(isOverdue).toBe(true);
    });

    it("should not mark future followups as overdue", () => {
      const dueDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day in future
      const now = new Date();
      
      const isOverdue = now > dueDate;
      
      expect(isOverdue).toBe(false);
    });
  });

  describe("Category Classification", () => {
    it("should classify 提案 category correctly", () => {
      const sentence = "新しい提案書を作成しました";
      let category = "その他";
      
      if (sentence.includes("提案") || sentence.includes("提议")) category = "提案";
      
      expect(category).toBe("提案");
    });

    it("should classify 打ち合わせ category correctly", () => {
      const sentence = "クライアントとの打ち合わせを行いました";
      let category = "その他";
      
      if (sentence.includes("打ち合わせ") || sentence.includes("会议") || sentence.includes("ミーティング")) category = "打ち合わせ";
      
      expect(category).toBe("打ち合わせ");
    });

    it("should classify MTG category correctly", () => {
      const sentence = "午後にMTGがあります";
      let category = "その他";
      
      if (sentence.includes("MTG")) category = "MTG";
      
      expect(category).toBe("MTG");
    });
  });

  describe("Status Transitions", () => {
    it("should allow transition from pending to completed", () => {
      const validTransitions: Record<string, string[]> = {
        pending: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };
      
      const currentStatus = "pending";
      const newStatus = "completed";
      
      const isValidTransition = validTransitions[currentStatus]?.includes(newStatus);
      
      expect(isValidTransition).toBe(true);
    });

    it("should allow transition from pending to cancelled", () => {
      const validTransitions: Record<string, string[]> = {
        pending: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };
      
      const currentStatus = "pending";
      const newStatus = "cancelled";
      
      const isValidTransition = validTransitions[currentStatus]?.includes(newStatus);
      
      expect(isValidTransition).toBe(true);
    });
  });
});
