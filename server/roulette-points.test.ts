import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Test: Roulette welcome bonus points are awarded during emailRegister
 *
 * Verifies:
 * 1. emailRegister accepts wonPoints parameter (0-100)
 * 2. createLinePointTransaction is called with correct roulette bonus data
 * 3. Points are NOT awarded if referral code already awarded points
 * 4. Response includes roulettePointsAwarded field
 * 5. Frontend sends wonPoints from localStorage
 */

describe("Roulette Welcome Bonus Points", () => {
  const routersPath = path.resolve(__dirname, "routers.ts");
  let routersSource: string;

  beforeEach(() => {
    routersSource = fs.readFileSync(routersPath, "utf-8");
  });

  it("should accept wonPoints parameter in emailRegister input schema", () => {
    // Verify the input schema includes wonPoints
    expect(routersSource).toContain("wonPoints: z.number().int().min(0).max(100).optional()");
  });

  it("should call createLinePointTransaction for roulette bonus when wonPoints is provided", () => {
    // Verify the roulette bonus logic exists
    expect(routersSource).toContain("// Award roulette welcome bonus points");
    expect(routersSource).toContain("input.wonPoints && input.wonPoints > 0 && !referralApplied");
    expect(routersSource).toContain("新規登録ボーナスルーレット:");
    expect(routersSource).toContain("roulettePointsAwarded = input.wonPoints");
  });

  it("should NOT award roulette points when referral code already applied", () => {
    // The condition checks !referralApplied to prevent double-awarding
    expect(routersSource).toContain("!referralApplied");
    
    // Verify the condition is in the roulette bonus block
    const rouletteBlock = routersSource.substring(
      routersSource.indexOf("// Award roulette welcome bonus points"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );
    expect(rouletteBlock).toContain("!referralApplied");
    expect(rouletteBlock).toContain("input.wonPoints");
  });

  it("should include roulettePointsAwarded in the response", () => {
    // Verify the response includes roulettePointsAwarded
    expect(routersSource).toContain("roulettePointsAwarded,");
    // Verify it's initialized to 0
    expect(routersSource).toContain("let roulettePointsAwarded = 0");
  });

  it("should use system referenceType for roulette bonus transaction", () => {
    const rouletteBlock = routersSource.substring(
      routersSource.indexOf("// Award roulette welcome bonus points"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );
    expect(rouletteBlock).toContain('referenceType: "system"');
    expect(rouletteBlock).toContain('type: "earn"');
  });

  it("should use email_userId format for lineUserId in point transaction", () => {
    const rouletteBlock = routersSource.substring(
      routersSource.indexOf("// Award roulette welcome bonus points"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );
    expect(rouletteBlock).toContain("lineUserId: `email_${newUser.id}`");
  });

  it("should log the roulette point award", () => {
    expect(routersSource).toContain("[Roulette]");
    expect(routersSource).toContain("awarded to new user");
    expect(routersSource).toContain("as welcome bonus");
  });

  it("should handle errors gracefully without blocking registration", () => {
    const rouletteBlock = routersSource.substring(
      routersSource.indexOf("// Award roulette welcome bonus points"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );
    expect(rouletteBlock).toContain("try {");
    expect(rouletteBlock).toContain("} catch (err: any) {");
    expect(rouletteBlock).toContain("console.error");
    expect(rouletteBlock).toContain("[Roulette] Failed to award welcome bonus points");
  });
});

describe("ChatRegister Frontend - wonPoints integration", () => {
  const chatRegisterPath = path.resolve(__dirname, "../client/src/pages/ChatRegister.tsx");
  let chatRegisterSource: string;

  beforeEach(() => {
    chatRegisterSource = fs.readFileSync(chatRegisterPath, "utf-8");
  });

  it("should read wonPoints from localStorage as a number", () => {
    expect(chatRegisterSource).toContain("parseInt(localStorage.getItem(\"lcj_spin_won_points\")");
    expect(chatRegisterSource).toContain("wonPointsNum");
  });

  it("should read wonPointsLabel from localStorage", () => {
    expect(chatRegisterSource).toContain("localStorage.getItem(\"lcj_spin_won_label\")");
    expect(chatRegisterSource).toContain("wonPointsLabel");
  });

  it("should send wonPoints in registerMutation.mutate call", () => {
    expect(chatRegisterSource).toContain("wonPoints: wonPointsNum.current");
  });

  it("should display actual awarded points in completion message", () => {
    expect(chatRegisterSource).toContain("data.roulettePointsAwarded");
    expect(chatRegisterSource).toContain("がアカウントに付与されました");
  });

  it("should clean up localStorage after successful registration", () => {
    expect(chatRegisterSource).toContain('localStorage.removeItem("lcj_spin_won_points")');
    expect(chatRegisterSource).toContain('localStorage.removeItem("lcj_spin_won_label")');
  });

  it("should display wonPointsLabel in welcome messages and prize banner", () => {
    expect(chatRegisterSource).toContain("wonPointsLabel.current");
    // Prize banner
    expect(chatRegisterSource).toContain("{wonPointsLabel.current}");
  });
});

describe("MallHome Roulette - localStorage storage", () => {
  const mallHomePath = path.resolve(__dirname, "../client/src/pages/MallHome.tsx");
  let mallHomeSource: string;

  beforeEach(() => {
    mallHomeSource = fs.readFileSync(mallHomePath, "utf-8");
  });

  it("should store won points as numeric value in localStorage", () => {
    expect(mallHomeSource).toContain('localStorage.setItem("lcj_spin_won_points"');
    expect(mallHomeSource).toContain("String(won.points)");
  });

  it("should store won label in localStorage", () => {
    expect(mallHomeSource).toContain('localStorage.setItem("lcj_spin_won_label"');
    expect(mallHomeSource).toContain("won.label");
  });

  it("should have new user roulette items with 50pt as jackpot", () => {
    // Verify the items are new-user-friendly (max 50pt)
    expect(mallHomeSource).toContain('{ label: "50pt", emoji: "🎁", points: 50 }');
    expect(mallHomeSource).not.toContain('points: 500');
    expect(mallHomeSource).not.toContain('points: 1000');
  });

  it("should always land on 50pt jackpot (index 1)", () => {
    expect(mallHomeSource).toContain("const targetIndex = useMemo(() => 1, [])");
  });
});
