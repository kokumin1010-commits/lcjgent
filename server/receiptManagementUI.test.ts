import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * レシート管理画面の改良テスト
 * 1. 付与ポイント表示
 * 2. 注文番号表示
 * 3. AI認識プロンプト改善
 */

describe("LineReceiptManagement UI Improvements", () => {
  const filePath = path.join(__dirname, "../client/src/pages/LineReceiptManagement.tsx");
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(filePath, "utf-8");
  });

  describe("付与ポイント表示", () => {
    it("should display awarded points for approved receipts in card list", () => {
      // Card should show pointsAwarded for approved receipts
      expect(content).toContain('receipt.status === "approved" && receipt.pointsAwarded != null');
      expect(content).toContain("付与済:");
      expect(content).toContain("receipt.pointsAwarded");
    });

    it("should display calculated points for non-approved receipts", () => {
      expect(content).toContain("計算ポイント:");
      expect(content).toContain("receipt.pointsCalculated || 0");
    });

    it("should use green color for awarded points", () => {
      expect(content).toContain("text-green-600");
      expect(content).toContain("Gift");
    });

    it("should use blue color for calculated points", () => {
      expect(content).toContain("text-blue-600");
    });
  });

  describe("注文番号表示", () => {
    it("should have getOrderNumber helper function", () => {
      expect(content).toContain("const getOrderNumber = (receipt: any): string | null =>");
    });

    it("should parse orderNumber from ocrRawText JSON", () => {
      expect(content).toContain("JSON.parse(receipt.ocrRawText)");
      expect(content).toContain("data.orderNumber || null");
    });

    it("should display order number in card list", () => {
      expect(content).toContain("注文番号:");
      expect(content).toContain("getOrderNumber(receipt)");
    });

    it("should display order number in detail dialog", () => {
      expect(content).toContain("getOrderNumber(receiptDetails.receipt)");
    });

    it("should use Hash icon for order number", () => {
      expect(content).toContain("Hash");
    });

    it("should use monospace font for order number display", () => {
      expect(content).toContain("font-mono");
    });
  });
});

describe("AI OCR Prompt Improvements", () => {
  describe("Web Receipt Upload Prompt", () => {
    const filePath = path.join(__dirname, "routers.ts");
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(filePath, "utf-8");
    });

    it("should include order number extraction rules", () => {
      expect(content).toContain("注文番号の抽出ルール（最重要）");
    });

    it("should specify TikTok Shop order number format (17 digits)", () => {
      expect(content).toContain("17桁前後の数字");
    });

    it("should mention common order number locations", () => {
      expect(content).toContain("注文番号");
      expect(content).toContain("注文ID");
      expect(content).toContain("Order ID");
      expect(content).toContain("订单编号");
    });

    it("should include fallback for long digit strings", () => {
      expect(content).toContain("15〜20桁");
    });

    it("should prioritize order number extraction", () => {
      expect(content).toContain("注文番号の抽出を最優先");
    });

    it("should include amount extraction rules", () => {
      expect(content).toContain("金額の抽出ルール");
      expect(content).toContain("カンマ区切りも除去");
    });
  });

  describe("LINE Agent OCR Prompt", () => {
    const filePath = path.join(__dirname, "lineAgent.ts");
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(filePath, "utf-8");
    });

    it("should include order number extraction rules in LINE agent", () => {
      expect(content).toContain("注文番号の抽出ルール（最重要）");
    });

    it("should specify TikTok Shop order number format in LINE agent", () => {
      expect(content).toContain("17桁前後の数字");
    });

    it("should include amount extraction rules in LINE agent", () => {
      expect(content).toContain("金額の抽出ルール");
    });

    it("should prioritize order number extraction in LINE agent", () => {
      expect(content).toContain("注文番号の抽出を最優先");
    });
  });
});

describe("Duplicate Order Number Check", () => {
  it("should have checkDuplicateOrderNumberGlobal function in db.ts", async () => {
    const dbPath = path.join(__dirname, "db.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain("export async function checkDuplicateOrderNumberGlobal");
  });

  it("should check for duplicate order numbers in web receipt submission", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("checkDuplicateOrderNumberGlobal(ocrData.orderNumber");
  });

  it("should check for duplicate order numbers in LINE agent", () => {
    const agentPath = path.join(__dirname, "lineAgent.ts");
    const content = fs.readFileSync(agentPath, "utf-8");
    expect(content).toContain("checkDuplicateOrderNumberGlobal");
  });

  it("should reject duplicate orders with appropriate message", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("この注文は既にポイント申請済みです");
    expect(content).toContain("この注文番号は既に他の方が申請済みです");
  });
});
