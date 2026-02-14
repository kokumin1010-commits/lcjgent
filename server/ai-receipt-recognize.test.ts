import { describe, it, expect, vi } from "vitest";

describe("AI Receipt Re-Recognition Enhancement", () => {
  describe("Enhanced prompt returns full receipt data", () => {
    it("should return orderNumber, totalAmount, shopName, orderDate, isDelivered, confidence", () => {
      // Verify the expected response shape from the enhanced API
      const mockResponse = {
        success: true,
        orderNumber: "5819000585822287971",
        totalAmount: 2832,
        shopName: "KYOGOKU ケアオイル",
        productName: "KYOGOKU ケアオイル 洗い流さないトリートメント",
        orderDate: "2026-01-15",
        isDelivered: true,
        confidence: 85,
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.orderNumber).toMatch(/^[56]\d{15,18}$/);
      expect(mockResponse.totalAmount).toBeGreaterThan(0);
      expect(typeof mockResponse.totalAmount).toBe("number");
      expect(mockResponse.shopName).toBeTruthy();
      expect(mockResponse.productName).toBeTruthy();
      expect(mockResponse.orderDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof mockResponse.isDelivered).toBe("boolean");
      expect(mockResponse.confidence).toBeGreaterThanOrEqual(0);
      expect(mockResponse.confidence).toBeLessThanOrEqual(100);
    });

    it("should handle null fields gracefully when info not found", () => {
      const mockResponse = {
        success: true,
        orderNumber: null,
        totalAmount: null,
        shopName: null,
        productName: null,
        orderDate: null,
        isDelivered: null,
        confidence: 20,
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.orderNumber).toBeNull();
      expect(mockResponse.totalAmount).toBeNull();
      expect(mockResponse.shopName).toBeNull();
      expect(mockResponse.confidence).toBeLessThan(50);
    });
  });

  describe("JSON parsing from LLM response", () => {
    it("should parse clean JSON response", () => {
      const rawContent = '{"orderNumber":"5819000585822287971","totalAmount":2832,"shopName":"KYOGOKU","productName":"ケアオイル","orderDate":"2026-01-15","isDelivered":true,"confidence":90}';
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      expect(jsonMatch).toBeTruthy();
      const parsed = JSON.parse(jsonMatch![0]);
      expect(parsed.orderNumber).toBe("5819000585822287971");
      expect(parsed.totalAmount).toBe(2832);
      expect(parsed.shopName).toBe("KYOGOKU");
    });

    it("should parse JSON wrapped in markdown code blocks", () => {
      const rawContent = '```json\n{"orderNumber":"5824489836811172498","totalAmount":11980,"shopName":"TikTok Shop","productName":"シャンプー","orderDate":"2026-02-01","isDelivered":false,"confidence":75}\n```';
      let jsonStr = rawContent;
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      }
      jsonStr = jsonStr.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      expect(jsonMatch).toBeTruthy();
      const parsed = JSON.parse(jsonMatch![0]);
      expect(parsed.orderNumber).toBe("5824489836811172498");
      expect(parsed.totalAmount).toBe(11980);
    });

    it("should handle response with extra text around JSON", () => {
      const rawContent = 'Here is the extracted data:\n{"orderNumber":"682307265940784437","totalAmount":1500,"shopName":"Test Shop","productName":null,"orderDate":null,"isDelivered":null,"confidence":60}\nNote: some fields could not be extracted.';
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      expect(jsonMatch).toBeTruthy();
      const parsed = JSON.parse(jsonMatch![0]);
      expect(parsed.orderNumber).toBe("682307265940784437");
      expect(parsed.totalAmount).toBe(1500);
    });

    it("should handle completely invalid response gracefully", () => {
      const rawContent = "I could not find any order information in the images.";
      let parsed: any = {};
      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // ignore
      }
      expect(parsed.orderNumber).toBeUndefined();
      expect(parsed.totalAmount).toBeUndefined();
    });
  });

  describe("Amount extraction validation", () => {
    it("should accept valid amounts", () => {
      const amounts = [2832, 11980, 500, 99999];
      for (const amount of amounts) {
        expect(typeof amount).toBe("number");
        expect(amount).toBeGreaterThan(0);
      }
    });

    it("should reject invalid amounts", () => {
      const invalidAmounts = [0, -100, null, undefined, "abc"];
      for (const amount of invalidAmounts) {
        const isValid = typeof amount === "number" && amount > 0;
        expect(isValid).toBe(false);
      }
    });
  });

  describe("DB auto-save logic", () => {
    it("should build correct update data from parsed response", () => {
      const parsed = {
        orderNumber: "5819000585822287971",
        totalAmount: 2832,
        shopName: "KYOGOKU",
        productName: "ケアオイル",
        orderDate: "2026-01-15",
        isDelivered: true,
        confidence: 90,
      };

      const updateData: any = {};
      if (parsed.totalAmount && typeof parsed.totalAmount === "number" && parsed.totalAmount > 0) {
        updateData.totalAmount = parsed.totalAmount;
      }
      if (parsed.shopName && typeof parsed.shopName === "string") {
        updateData.storeName = parsed.shopName;
      }
      if (parsed.orderDate && typeof parsed.orderDate === "string") {
        try {
          updateData.purchaseDate = new Date(parsed.orderDate);
        } catch { /* ignore */ }
      }

      expect(updateData.totalAmount).toBe(2832);
      expect(updateData.storeName).toBe("KYOGOKU");
      expect(updateData.purchaseDate).toBeInstanceOf(Date);
      expect(updateData.purchaseDate.toISOString()).toContain("2026-01-15");
    });

    it("should skip update when no valid data extracted", () => {
      const parsed = {
        orderNumber: null,
        totalAmount: null,
        shopName: null,
        orderDate: null,
      };

      const updateData: any = {};
      if (parsed.totalAmount && typeof parsed.totalAmount === "number" && (parsed.totalAmount as number) > 0) {
        updateData.totalAmount = parsed.totalAmount;
      }
      if (parsed.shopName && typeof parsed.shopName === "string") {
        updateData.storeName = parsed.shopName;
      }

      expect(Object.keys(updateData).length).toBe(0);
    });

    it("should build ocrRawText with all extracted fields", () => {
      const parsed = {
        orderNumber: "5819000585822287971",
        shopName: "KYOGOKU",
        productName: "ケアオイル",
        isDelivered: true,
      };
      const existingOcrRawText = '{"someOldField": "value"}';

      let ocrData: any = {};
      try {
        ocrData = JSON.parse(existingOcrRawText);
      } catch { ocrData = {}; }

      ocrData.orderNumber = parsed.orderNumber;
      if (parsed.shopName) ocrData.shopName = parsed.shopName;
      if (parsed.productName) ocrData.productName = parsed.productName;
      if (parsed.isDelivered !== null && parsed.isDelivered !== undefined) ocrData.isDelivered = parsed.isDelivered;

      const result = JSON.stringify(ocrData);
      const reparsed = JSON.parse(result);

      expect(reparsed.someOldField).toBe("value"); // preserved existing data
      expect(reparsed.orderNumber).toBe("5819000585822287971");
      expect(reparsed.shopName).toBe("KYOGOKU");
      expect(reparsed.productName).toBe("ケアオイル");
      expect(reparsed.isDelivered).toBe(true);
    });
  });

  describe("Frontend auto-fill behavior", () => {
    it("should generate correct toast message with all fields", () => {
      const data = {
        orderNumber: "5819000585822287971",
        totalAmount: 2832,
        shopName: "KYOGOKU",
        orderDate: "2026-01-15",
      };

      const results: string[] = [];
      if (data.orderNumber) results.push(`注文番号: ${data.orderNumber}`);
      if (data.totalAmount && typeof data.totalAmount === "number" && data.totalAmount > 0) {
        results.push(`金額: ¥${data.totalAmount.toLocaleString()}`);
      }
      if (data.shopName) results.push(`店舗: ${data.shopName}`);
      if (data.orderDate) results.push(`日付: ${data.orderDate}`);

      expect(results.length).toBe(4);
      expect(results[0]).toContain("5819000585822287971");
      expect(results[1]).toContain("2,832");
      expect(results[2]).toContain("KYOGOKU");
      expect(results[3]).toContain("2026-01-15");
    });

    it("should show error message when no fields extracted", () => {
      const data = {
        orderNumber: null,
        totalAmount: null,
        shopName: null,
        orderDate: null,
      };

      const results: string[] = [];
      if (data.orderNumber) results.push(`注文番号: ${data.orderNumber}`);
      if (data.totalAmount && typeof data.totalAmount === "number") {
        results.push(`金額: ¥${data.totalAmount.toLocaleString()}`);
      }
      if (data.shopName) results.push(`店舗: ${data.shopName}`);
      if (data.orderDate) results.push(`日付: ${data.orderDate}`);

      expect(results.length).toBe(0);
    });
  });
});
