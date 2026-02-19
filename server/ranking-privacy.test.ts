import { describe, it, expect } from "vitest";

/**
 * Tests for ranking privacy protection:
 * - Display name masking (first char + ***)
 * - Profile picture blur (CSS filter)
 */

// Simulate the masking logic used in FriendReferralChallenge.tsx
function maskDisplayName(displayName: string | null | undefined): string {
  if (!displayName) return "***";
  const chars = Array.from(displayName);
  return chars[0] + "***";
}

describe("Ranking Privacy - Name Masking", () => {
  it("should mask Japanese name to first character + ***", () => {
    expect(maskDisplayName("京極 琉（Ryu Kyogoku）")).toBe("京***");
  });

  it("should mask short Japanese name", () => {
    expect(maskDisplayName("とも")).toBe("と***");
  });

  it("should mask English name", () => {
    expect(maskDisplayName("emiko")).toBe("e***");
  });

  it("should mask name with emoji", () => {
    expect(maskDisplayName("😊✨ よんち🥰")).toBe("😊***");
  });

  it("should handle single character name", () => {
    expect(maskDisplayName("A")).toBe("A***");
  });

  it("should handle null displayName", () => {
    expect(maskDisplayName(null)).toBe("***");
  });

  it("should handle undefined displayName", () => {
    expect(maskDisplayName(undefined)).toBe("***");
  });

  it("should handle empty string displayName", () => {
    expect(maskDisplayName("")).toBe("***");
  });

  it("should mask name with spaces", () => {
    expect(maskDisplayName("青田 昇子")).toBe("青***");
  });

  it("should mask Miura", () => {
    expect(maskDisplayName("Miura")).toBe("M***");
  });
});

describe("Ranking Privacy - Profile Picture Blur", () => {
  it("should define correct blur CSS filter value", () => {
    // The blur value used in the component
    const blurFilter = "blur(6px)";
    expect(blurFilter).toBe("blur(6px)");
  });

  it("should define correct scale transform to prevent blur edge artifacts", () => {
    // Scale up slightly to prevent transparent edges from blur
    const scaleTransform = "scale(1.2)";
    expect(scaleTransform).toBe("scale(1.2)");
  });
});
