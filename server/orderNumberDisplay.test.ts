import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Order Number Display in Receipt Management", () => {
  const lineReceiptMgmt = readFileSync(
    join(__dirname, "../client/src/pages/LineReceiptManagement.tsx"),
    "utf-8"
  );
  const receiptMgmt = readFileSync(
    join(__dirname, "../client/src/pages/ReceiptManagement.tsx"),
    "utf-8"
  );

  describe("LineReceiptManagement - Order Number", () => {
    it("should have getOrderNumber helper function", () => {
      expect(lineReceiptMgmt).toContain("getOrderNumber");
    });

    it("should extract orderNumber from ocrRawText JSON", () => {
      expect(lineReceiptMgmt).toContain("data.orderNumber");
    });

    it("should display order number with prominent blue styling when available", () => {
      expect(lineReceiptMgmt).toContain("bg-blue-50");
      expect(lineReceiptMgmt).toContain("border-blue-200");
      expect(lineReceiptMgmt).toContain("注文番号:");
      expect(lineReceiptMgmt).toContain("font-bold text-blue-800");
    });

    it("should show input field when order number is missing", () => {
      // When no order number, an input field is shown for entry
      expect(lineReceiptMgmt).toContain("注文番号を入力");
      expect(lineReceiptMgmt).toContain("calcOrderNumber");
    });

    it("should use Hash icon for order number display", () => {
      expect(lineReceiptMgmt).toContain("Hash");
    });

    it("should use AlertTriangle icon for missing order number warning", () => {
      expect(lineReceiptMgmt).toContain("AlertTriangle");
    });

    it("should use monospace font for order number value", () => {
      expect(lineReceiptMgmt).toContain("font-mono");
    });
  });

  describe("ReceiptManagement - Order Number", () => {
    it("should have extractOrderNumber helper function", () => {
      expect(receiptMgmt).toContain("extractOrderNumber");
    });

    it("should display order number with prominent blue styling when available", () => {
      expect(receiptMgmt).toContain("bg-blue-50");
      expect(receiptMgmt).toContain("border-blue-200");
      expect(receiptMgmt).toContain("注文番号:");
      expect(receiptMgmt).toContain("font-bold text-blue-800");
    });

    it("should show red warning when order number is missing", () => {
      expect(receiptMgmt).toContain("注文番号なし");
      expect(receiptMgmt).toContain("bg-red-50");
      expect(receiptMgmt).toContain("text-red-600");
    });

    it("should use monospace font for order number value", () => {
      expect(receiptMgmt).toContain("font-mono");
    });

    it("should display order number in detail dialog", () => {
      expect(receiptMgmt).toContain("extractOrderNumber(selectedReceipt.receipt.ocrRawText)");
    });
  });
});

describe("LINE Login Removal", () => {
  const loginPage = readFileSync(
    join(__dirname, "../client/src/pages/LineLogin.tsx"),
    "utf-8"
  );
  const mallHome = readFileSync(
    join(__dirname, "../client/src/pages/MallHome.tsx"),
    "utf-8"
  );

  describe("Login Page", () => {
    it("should not import LIFF SDK", () => {
      expect(loginPage).not.toContain("from \"@line/liff\"");
    });

    it("should not have LIFF_ID constant", () => {
      expect(loginPage).not.toContain("LIFF_ID");
    });

    it("should not have Tabs component for LINE/Email switching", () => {
      expect(loginPage).not.toContain("TabsList");
      expect(loginPage).not.toContain("TabsTrigger");
    });

    it("should have email login form", () => {
      expect(loginPage).toContain("email");
      expect(loginPage).toContain("password");
      expect(loginPage).toContain("handleEmailSubmit");
    });

    it("should have registration mode toggle", () => {
      expect(loginPage).toContain("isRegistering");
      expect(loginPage).toContain("新規登録");
    });

    it("should mention LINE linking on mypage", () => {
      expect(loginPage).toContain("マイページからLINE連携");
    });

    it("should have referral code support", () => {
      expect(loginPage).toContain("referralCode");
      expect(loginPage).toContain("紹介コード");
    });

    it("should have forgot password link", () => {
      expect(loginPage).toContain("forgot-password");
      expect(loginPage).toContain("パスワードを忘れた");
    });
  });

  describe("Mall Home Page", () => {
    it("should not have LINE green color for CTA buttons", () => {
      expect(mallHome).not.toContain("#06C755");
      expect(mallHome).not.toContain("#05b04c");
    });

    it("should not have LINE SVG icon in CTA buttons", () => {
      expect(mallHome).not.toContain("LINEで無料ではじめる");
    });

    it("should use rose-500 color for CTA buttons", () => {
      expect(mallHome).toContain("bg-rose-500");
    });

    it("should use UserPlus icon instead of LINE icon", () => {
      expect(mallHome).toContain("UserPlus");
    });

    it("should display generic CTA text", () => {
      expect(mallHome).toContain("無料ではじめる");
    });
  });
});
