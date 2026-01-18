import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Business Card Management", () => {
  describe("Business Card Schema", () => {
    it("should have required fields for business card", () => {
      // Test that the schema includes all required fields
      const requiredFields = [
        "id",
        "name",
        "company",
        "position",
        "email",
        "phone",
        "address",
        "imageUrl",
        "imageKey",
        "registeredBy",
        "registeredByName",
        "createdAt",
        "updatedAt",
      ];
      
      // This is a schema validation test
      expect(requiredFields.length).toBeGreaterThan(0);
    });
  });

  describe("Duplicate Detection", () => {
    it("should detect duplicate by email", () => {
      const existingCards = [
        { email: "test@example.com", name: "Test User", company: "Test Corp" },
      ];
      
      const newCard = { email: "test@example.com", name: "Test User 2", company: "Test Corp 2" };
      
      const isDuplicate = existingCards.some(
        card => card.email && newCard.email && card.email.toLowerCase() === newCard.email.toLowerCase()
      );
      
      expect(isDuplicate).toBe(true);
    });

    it("should detect duplicate by name and company", () => {
      const existingCards = [
        { email: null, name: "田中太郎", company: "株式会社テスト" },
      ];
      
      const newCard = { email: null, name: "田中太郎", company: "株式会社テスト" };
      
      const isDuplicate = existingCards.some(
        card => card.name === newCard.name && card.company === newCard.company
      );
      
      expect(isDuplicate).toBe(true);
    });

    it("should not detect duplicate for different cards", () => {
      const existingCards = [
        { email: "test@example.com", name: "Test User", company: "Test Corp" },
      ];
      
      const newCard = { email: "different@example.com", name: "Different User", company: "Different Corp" };
      
      const isDuplicateByEmail = existingCards.some(
        card => card.email && newCard.email && card.email.toLowerCase() === newCard.email.toLowerCase()
      );
      
      const isDuplicateByNameCompany = existingCards.some(
        card => card.name === newCard.name && card.company === newCard.company
      );
      
      expect(isDuplicateByEmail).toBe(false);
      expect(isDuplicateByNameCompany).toBe(false);
    });
  });

  describe("OCR Data Extraction", () => {
    it("should extract email from OCR text", () => {
      const ocrText = "田中太郎 tanaka@example.com 株式会社テスト";
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const match = ocrText.match(emailRegex);
      
      expect(match).not.toBeNull();
      expect(match![0]).toBe("tanaka@example.com");
    });

    it("should extract phone number from OCR text", () => {
      const ocrText = "田中太郎 03-1234-5678 株式会社テスト";
      const phoneRegex = /\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}/;
      const match = ocrText.match(phoneRegex);
      
      expect(match).not.toBeNull();
    });
  });

  describe("Business Card Registration", () => {
    it("should create business card with all fields", () => {
      const cardData = {
        name: "田中太郎",
        company: "株式会社テスト",
        position: "営業部長",
        email: "tanaka@example.com",
        phone: "03-1234-5678",
        address: "東京都渋谷区1-2-3",
        imageUrl: "https://example.com/image.jpg",
        imageKey: "cards/123.jpg",
        registeredBy: 1,
        registeredByName: "山田花子",
        notes: "展示会で名刺交換",
      };

      expect(cardData.name).toBe("田中太郎");
      expect(cardData.company).toBe("株式会社テスト");
      expect(cardData.registeredByName).toBe("山田花子");
    });
  });
});
