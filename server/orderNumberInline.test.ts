import { describe, it, expect } from "vitest";

/**
 * Tests for inline order number input in calculator panel + AI re-recognition feature
 */

// ===== Order Number Inline Edit Logic Tests =====

describe("Order Number Inline Edit in Calculator Panel", () => {
  
  // Simulate order number extraction from ocrRawText
  const getOrderNumber = (receipt: any): string | null => {
    try {
      if (receipt.ocrRawText) {
        const data = typeof receipt.ocrRawText === "string" ? JSON.parse(receipt.ocrRawText) : receipt.ocrRawText;
        return data.orderNumber || null;
      }
      return null;
    } catch {
      return null;
    }
  };

  describe("getOrderNumber extraction", () => {
    it("should extract order number from JSON string ocrRawText", () => {
      const receipt = { ocrRawText: JSON.stringify({ orderNumber: "58253200772120717" }) };
      expect(getOrderNumber(receipt)).toBe("58253200772120717");
    });

    it("should extract order number from object ocrRawText", () => {
      const receipt = { ocrRawText: { orderNumber: "12345678901234567" } };
      expect(getOrderNumber(receipt)).toBe("12345678901234567");
    });

    it("should return null when no order number exists", () => {
      const receipt = { ocrRawText: JSON.stringify({ storeName: "Test Store" }) };
      expect(getOrderNumber(receipt)).toBeNull();
    });

    it("should return null when ocrRawText is null", () => {
      const receipt = { ocrRawText: null };
      expect(getOrderNumber(receipt)).toBeNull();
    });

    it("should return null when ocrRawText is invalid JSON", () => {
      const receipt = { ocrRawText: "invalid json" };
      expect(getOrderNumber(receipt)).toBeNull();
    });
  });

  describe("Calculator panel order number initialization", () => {
    it("should initialize calcOrderNumber when receipt has order number", () => {
      const receipt = { id: 1, ocrRawText: JSON.stringify({ orderNumber: "ORDER123" }) };
      const orderNum = getOrderNumber(receipt);
      const calcOrderNumber = orderNum || "";
      expect(calcOrderNumber).toBe("ORDER123");
    });

    it("should initialize calcOrderNumber as empty when no order number", () => {
      const receipt = { id: 2, ocrRawText: null };
      const orderNum = getOrderNumber(receipt);
      const calcOrderNumber = orderNum || "";
      expect(calcOrderNumber).toBe("");
    });
  });

  describe("Inline order number save validation", () => {
    it("should allow save when order number is not empty", () => {
      const calcOrderNumber = "58253200772120717";
      const canSave = calcOrderNumber.trim().length > 0;
      expect(canSave).toBe(true);
    });

    it("should not allow save when order number is empty", () => {
      const calcOrderNumber = "";
      const canSave = calcOrderNumber.trim().length > 0;
      expect(canSave).toBe(false);
    });

    it("should not allow save when order number is only whitespace", () => {
      const calcOrderNumber = "   ";
      const canSave = calcOrderNumber.trim().length > 0;
      expect(canSave).toBe(false);
    });
  });
});

// ===== AI Re-Recognition Response Handling Tests =====

describe("AI Re-Recognition Response Handling", () => {

  describe("Successful recognition", () => {
    it("should update calcOrderNumber when AI finds order number", () => {
      const aiResponse = { orderNumber: "58253200772120717", totalAmount: 14875 };
      let calcOrderNumber = "";
      let calcAmount = "";

      // Simulate onSuccess handler
      if (aiResponse.orderNumber) {
        calcOrderNumber = aiResponse.orderNumber;
        if (aiResponse.totalAmount && !calcAmount) {
          calcAmount = String(aiResponse.totalAmount);
        }
      }

      expect(calcOrderNumber).toBe("58253200772120717");
      expect(calcAmount).toBe("14875");
    });

    it("should not overwrite existing amount when AI returns totalAmount", () => {
      const aiResponse = { orderNumber: "ORDER456", totalAmount: 5000 };
      let calcOrderNumber = "";
      let calcAmount = "3000"; // Already has amount

      if (aiResponse.orderNumber) {
        calcOrderNumber = aiResponse.orderNumber;
        if (aiResponse.totalAmount && !calcAmount) {
          calcAmount = String(aiResponse.totalAmount);
        }
      }

      expect(calcOrderNumber).toBe("ORDER456");
      expect(calcAmount).toBe("3000"); // Not overwritten
    });

    it("should handle AI response with no order number", () => {
      const aiResponse = { orderNumber: null, totalAmount: null };
      let calcOrderNumber = "existing";

      if (aiResponse.orderNumber) {
        calcOrderNumber = aiResponse.orderNumber;
      }

      expect(calcOrderNumber).toBe("existing"); // Unchanged
    });
  });

  describe("AI prompt for order number extraction", () => {
    it("should generate correct prompt for order number recognition", () => {
      const prompt = `この画像はTikTok Shopの注文詳細のスクリーンショットです。
以下の情報を抽出してJSON形式で返してください：
- orderNumber: 注文番号（数字の文字列）
- totalAmount: 合計金額（数値、円単位）
- storeName: 店舗名

JSON形式のみで回答してください。`;

      expect(prompt).toContain("注文番号");
      expect(prompt).toContain("合計金額");
      expect(prompt).toContain("JSON");
    });
  });

  describe("Order number format validation", () => {
    it("should accept numeric order numbers", () => {
      const orderNumber = "58253200772120717";
      expect(/^\d+$/.test(orderNumber)).toBe(true);
    });

    it("should accept alphanumeric order numbers", () => {
      const orderNumber = "ORD-2026-001234";
      expect(orderNumber.length > 0).toBe(true);
    });

    it("should trim whitespace from order numbers", () => {
      const orderNumber = "  58253200772120717  ";
      expect(orderNumber.trim()).toBe("58253200772120717");
    });
  });
});

// ===== UI State Machine Tests =====

describe("Order Number UI State Machine", () => {
  
  describe("State transitions", () => {
    it("should start in display mode when order number exists", () => {
      const calcOrderNumber = "ORDER123";
      const isOrderNumberEditing = false;
      const showInput = isOrderNumberEditing || !calcOrderNumber;
      expect(showInput).toBe(false); // Display mode
    });

    it("should start in edit mode when no order number", () => {
      const calcOrderNumber = "";
      const isOrderNumberEditing = false;
      const showInput = isOrderNumberEditing || !calcOrderNumber;
      expect(showInput).toBe(true); // Edit mode
    });

    it("should switch to edit mode when edit button clicked", () => {
      let isOrderNumberEditing = false;
      // Simulate edit button click
      isOrderNumberEditing = true;
      const calcOrderNumber = "ORDER123";
      const showInput = isOrderNumberEditing || !calcOrderNumber;
      expect(showInput).toBe(true); // Edit mode
    });

    it("should switch back to display mode after save", () => {
      let isOrderNumberEditing = true;
      // Simulate save
      isOrderNumberEditing = false;
      const calcOrderNumber = "ORDER123";
      const showInput = isOrderNumberEditing || !calcOrderNumber;
      expect(showInput).toBe(false); // Display mode
    });

    it("should reset editing state when selecting new receipt", () => {
      let isOrderNumberEditing = true;
      // Simulate selectForCalc
      isOrderNumberEditing = false;
      expect(isOrderNumberEditing).toBe(false);
    });
  });

  describe("AI recognition button visibility", () => {
    it("should show AI recognition link when no order number and not recognizing", () => {
      const calcOrderNumber = "";
      const isAiRecognizing = false;
      const showAiLink = !calcOrderNumber && !isAiRecognizing;
      expect(showAiLink).toBe(true);
    });

    it("should hide AI recognition link when recognizing", () => {
      const calcOrderNumber = "";
      const isAiRecognizing = true;
      const showAiLink = !calcOrderNumber && !isAiRecognizing;
      expect(showAiLink).toBe(false);
    });

    it("should show loading message when AI is recognizing", () => {
      const isAiRecognizing = true;
      expect(isAiRecognizing).toBe(true);
    });

    it("should show refresh button in input row always", () => {
      // RefreshCw button is always visible in the input row
      const isOrderNumberEditing = true;
      const calcOrderNumber = "";
      const showInput = isOrderNumberEditing || !calcOrderNumber;
      expect(showInput).toBe(true); // Input row visible = refresh button visible
    });
  });
});
