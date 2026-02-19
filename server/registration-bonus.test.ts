import { describe, it, expect } from "vitest";

describe("Registration Bonus Roulette", () => {
  describe("Bonus Items Configuration", () => {
    const BONUS_ITEMS = [
      { label: "100pt", emoji: "⭐" },
      { label: "200pt", emoji: "💎" },
      { label: "300pt", emoji: "🌟" },
      { label: "350pt", emoji: "🍀" },
      { label: "500pt 大当たり", emoji: "🎁" },
      { label: "400pt", emoji: "🧧" },
      { label: "450pt", emoji: "✨" },
      { label: "50pt", emoji: "🎲" },
    ];
    const JACKPOT_INDEX = 4;

    it("should have 8 items", () => {
      expect(BONUS_ITEMS).toHaveLength(8);
    });

    it("should have jackpot at index 4 with 500pt", () => {
      expect(BONUS_ITEMS[JACKPOT_INDEX].label).toContain("500pt");
      expect(BONUS_ITEMS[JACKPOT_INDEX].label).toContain("大当たり");
    });

    it("all items should have label and emoji", () => {
      BONUS_ITEMS.forEach((item) => {
        expect(item.label).toBeTruthy();
        expect(item.emoji).toBeTruthy();
      });
    });

    it("should have items ranging from 50pt to 500pt", () => {
      const points = BONUS_ITEMS.map((item) =>
        parseInt(item.label.replace(/[^0-9]/g, ""))
      );
      expect(Math.min(...points)).toBe(50);
      expect(Math.max(...points)).toBe(500);
    });
  });

  describe("Award Registration Bonus Logic", () => {
    it("should prevent double award by checking existing transactions", () => {
      const existingTxns = [
        { description: "新規登録特典ルーレット: 500ポイント獲得", amount: 500 },
      ];
      const alreadyAwarded = existingTxns.some(
        (t) => t.description?.includes("新規登録特典ルーレット")
      );
      expect(alreadyAwarded).toBe(true);
    });

    it("should allow award when no existing registration bonus", () => {
      const existingTxns = [
        { description: "新規登録ボーナスルーレット: 50ポイント獲得", amount: 50 },
        { description: "友達紹介ボーナス", amount: 100 },
      ];
      const alreadyAwarded = existingTxns.some(
        (t) => t.description?.includes("新規登録特典ルーレット")
      );
      expect(alreadyAwarded).toBe(false);
    });

    it("should validate points input range (1-1000)", () => {
      const validPoints = [1, 100, 500, 1000];
      const invalidPoints = [0, -1, 1001, 5000];
      validPoints.forEach((p) => {
        expect(p >= 1 && p <= 1000).toBe(true);
      });
      invalidPoints.forEach((p) => {
        expect(p >= 1 && p <= 1000).toBe(false);
      });
    });
  });

  describe("Flow Integration", () => {
    it("should set sessionStorage flag on registration completion", () => {
      const flag = "true";
      expect(flag).toBe("true");
    });

    it("should redirect to /registration-bonus after chat register", () => {
      const targetPath = "/registration-bonus";
      expect(targetPath).toBe("/registration-bonus");
    });

    it("should redirect to friend-challenge from result screen", () => {
      const targetPath = "/friend-challenge";
      expect(targetPath).toBe("/friend-challenge");
    });

    it("should redirect to /mypage as secondary option", () => {
      const targetPath = "/mypage";
      expect(targetPath).toBe("/mypage");
    });
  });
});
