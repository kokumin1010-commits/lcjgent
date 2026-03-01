import { describe, it, expect } from "vitest";

describe("BW API Secret Configuration", () => {
  it("should have BW_API_SECRET environment variable set", () => {
    const secret = process.env.BW_API_SECRET;
    expect(secret).toBeDefined();
    expect(secret).not.toBe("");
    expect(typeof secret).toBe("string");
    expect(secret!.length).toBeGreaterThanOrEqual(16);
  });

  it("should have BW_API_URL environment variable set", () => {
    const url = process.env.BW_API_URL;
    expect(url).toBeDefined();
    expect(url).not.toBe("");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("BW_API_URL should be a valid URL pointing to beautypass.ai", () => {
    const url = process.env.BW_API_URL;
    expect(url).toContain("beautypass");
  });
});
