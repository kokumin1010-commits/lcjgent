import { describe, it, expect } from "vitest";
import { generateLiverLinkCode, generateMallLinkCode } from "./lineWebhook";

describe("LINE Link Code varchar(10) fix verification", () => {
  it("liver link code (L-XXXXXX) should be 8 characters, fitting in varchar(10)", () => {
    const code = generateLiverLinkCode();
    expect(code.length).toBe(8);
    expect(code.length).toBeLessThanOrEqual(10);
    expect(code).toMatch(/^L-\d{6}$/);
  });

  it("mall link code (M-XXXXXX) should be 8 characters, fitting in varchar(10)", () => {
    const code = generateMallLinkCode();
    expect(code.length).toBe(8);
    expect(code.length).toBeLessThanOrEqual(10);
    expect(code).toMatch(/^M-\d{6}$/);
  });

  it("generated codes should never exceed varchar(10) limit", () => {
    for (let i = 0; i < 1000; i++) {
      const liverCode = generateLiverLinkCode();
      const mallCode = generateMallLinkCode();
      expect(liverCode.length).toBeLessThanOrEqual(10);
      expect(mallCode.length).toBeLessThanOrEqual(10);
    }
  });

  it("previous varchar(6) was too small for L-XXXXXX format", () => {
    const code = generateLiverLinkCode();
    // L-XXXXXX = 8 chars, which exceeds varchar(6)
    expect(code.length).toBeGreaterThan(6);
    // But fits in varchar(10)
    expect(code.length).toBeLessThanOrEqual(10);
  });
});
