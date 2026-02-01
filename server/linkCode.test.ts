import { describe, it, expect } from "vitest";
import { generateLinkCode, generateLiverLinkCode, generateMallLinkCode } from "./lineWebhook";

describe("Link Code Generation", () => {
  describe("generateLinkCode", () => {
    it("should generate liver code with L- prefix by default", () => {
      const code = generateLinkCode();
      expect(code).toMatch(/^L-\d{6}$/);
    });

    it("should generate liver code with L- prefix when type is liver", () => {
      const code = generateLinkCode("liver");
      expect(code).toMatch(/^L-\d{6}$/);
    });

    it("should generate mall code with M- prefix when type is mall", () => {
      const code = generateLinkCode("mall");
      expect(code).toMatch(/^M-\d{6}$/);
    });
  });

  describe("generateLiverLinkCode", () => {
    it("should generate code with L- prefix", () => {
      const code = generateLiverLinkCode();
      expect(code).toMatch(/^L-\d{6}$/);
    });

    it("should generate unique codes", () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateLiverLinkCode());
      }
      // With 6 digits, 100 codes should be unique
      expect(codes.size).toBe(100);
    });
  });

  describe("generateMallLinkCode", () => {
    it("should generate code with M- prefix", () => {
      const code = generateMallLinkCode();
      expect(code).toMatch(/^M-\d{6}$/);
    });

    it("should generate unique codes", () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateMallLinkCode());
      }
      // With 6 digits, 100 codes should be unique
      expect(codes.size).toBe(100);
    });
  });

  describe("Code format validation", () => {
    it("liver code should have exactly 8 characters (L-XXXXXX)", () => {
      const code = generateLiverLinkCode();
      expect(code.length).toBe(8);
    });

    it("mall code should have exactly 8 characters (M-XXXXXX)", () => {
      const code = generateMallLinkCode();
      expect(code.length).toBe(8);
    });

    it("numeric part should be 6 digits", () => {
      const liverCode = generateLiverLinkCode();
      const mallCode = generateMallLinkCode();
      
      const liverNumeric = liverCode.split("-")[1];
      const mallNumeric = mallCode.split("-")[1];
      
      expect(liverNumeric.length).toBe(6);
      expect(mallNumeric.length).toBe(6);
      expect(parseInt(liverNumeric)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(liverNumeric)).toBeLessThan(1000000);
      expect(parseInt(mallNumeric)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(mallNumeric)).toBeLessThan(1000000);
    });
  });
});
