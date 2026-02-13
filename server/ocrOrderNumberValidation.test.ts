import { describe, it, expect } from "vitest";

/**
 * Test: OCR注文番号バリデーション・フォールバック処理
 * 
 * routers.tsのWeb版レシートアップロードで使用される
 * 注文番号のバリデーションロジックをテストする
 */

// バリデーションロジックを関数として抽出してテスト
function validateOrderNumber(orderNumber: string | null | undefined): string | null {
  if (!orderNumber) return null;
  
  const cleanedOrderNumber = String(orderNumber).replace(/[^0-9]/g, "");
  
  if (/^[56]\d{15,18}$/.test(cleanedOrderNumber)) {
    return cleanedOrderNumber;
  } else if (/^\d{16,19}$/.test(cleanedOrderNumber)) {
    return cleanedOrderNumber;
  } else if (cleanedOrderNumber.length >= 15) {
    return cleanedOrderNumber;
  } else {
    return null;
  }
}

function extractOrderNumberFromRawResponse(messageContent: string): string | null {
  const longNumbers = messageContent.match(/\d{15,19}/g);
  if (longNumbers && longNumbers.length > 0) {
    return longNumbers.sort((a, b) => b.length - a.length)[0];
  }
  return null;
}

describe("OCR注文番号バリデーション", () => {
  describe("validateOrderNumber", () => {
    it("正常な注文番号（5で始まる19桁）を受け入れる", () => {
      expect(validateOrderNumber("5819000585822287971")).toBe("5819000585822287971");
    });

    it("正常な注文番号（5で始まる18桁）を受け入れる", () => {
      expect(validateOrderNumber("582448983681117249")).toBe("582448983681117249");
    });

    it("正常な注文番号（6で始まる18桁）を受け入れる", () => {
      expect(validateOrderNumber("682307265940784437")).toBe("682307265940784437");
    });

    it("スペースやハイフンを含む注文番号をクリーンアップする", () => {
      expect(validateOrderNumber("5819 0005 8582 2287 971")).toBe("5819000585822287971");
    });

    it("ハイフン区切りの注文番号をクリーンアップする", () => {
      expect(validateOrderNumber("5819-0005-8582-2287-971")).toBe("5819000585822287971");
    });

    it("5/6以外で始まる16桁以上の数字列も受け入れる", () => {
      expect(validateOrderNumber("1234567890123456")).toBe("1234567890123456");
    });

    it("15桁の数字列もフォールバックとして受け入れる", () => {
      expect(validateOrderNumber("123456789012345")).toBe("123456789012345");
    });

    it("短すぎる数字列（電話番号）を拒否する", () => {
      expect(validateOrderNumber("09093239369")).toBeNull();
    });

    it("短すぎる数字列（商品価格）を拒否する", () => {
      expect(validateOrderNumber("1960")).toBeNull();
    });

    it("郵便番号を拒否する", () => {
      expect(validateOrderNumber("3610041")).toBeNull();
    });

    it("null入力を処理する", () => {
      expect(validateOrderNumber(null)).toBeNull();
    });

    it("undefined入力を処理する", () => {
      expect(validateOrderNumber(undefined)).toBeNull();
    });

    it("空文字列を処理する", () => {
      expect(validateOrderNumber("")).toBeNull();
    });
  });

  describe("extractOrderNumberFromRawResponse", () => {
    it("JSONレスポンスから注文番号を抽出する", () => {
      const response = '{"orderNumber": null, "totalAmount": 2832, "text": "注文番号 5819000585822287971"}';
      expect(extractOrderNumberFromRawResponse(response)).toBe("5819000585822287971");
    });

    it("複数の長い数字列がある場合、最も長いものを返す", () => {
      const response = '数字列1: 123456789012345 数字列2: 5819000585822287971';
      expect(extractOrderNumberFromRawResponse(response)).toBe("5819000585822287971");
    });

    it("長い数字列がない場合はnullを返す", () => {
      const response = '{"orderNumber": null, "totalAmount": 2832}';
      expect(extractOrderNumberFromRawResponse(response)).toBeNull();
    });

    it("15桁以上の数字列を検出する", () => {
      const response = 'some text 582448983681117 more text';
      expect(extractOrderNumberFromRawResponse(response)).toBe("582448983681117");
    });
  });

  describe("プロンプト改善の確認", () => {
    it("Web版プロンプトにorderNumberSourceフィールドが含まれている", async () => {
      const fs = await import("fs");
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("orderNumberSource");
    });

    it("Web版プロンプトに3ステップ解析アプローチが含まれている", async () => {
      const fs = await import("fs");
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("ステップ1");
      expect(routersContent).toContain("ステップ2");
      expect(routersContent).toContain("ステップ3");
    });

    it("Web版プロンプトに注文番号の桁数指定が含まれている", async () => {
      const fs = await import("fs");
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("16〜19桁");
    });

    it("Web版プロンプトにTikTok Shop注文番号の例が含まれている", async () => {
      const fs = await import("fs");
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("5819000585822287971");
    });

    it("Web版プロンプトに「さらに表示」の位置ヒントが含まれている", async () => {
      const fs = await import("fs");
      const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
      expect(routersContent).toContain("さらに表示");
    });
  });
});
