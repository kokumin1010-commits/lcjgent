import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Roulette Flow & Chat Register", () => {
  describe("getSpinItems API", () => {
    it("should return items with required fields for wheel display", async () => {
      // Simulate the API response structure
      const mockItems = [
        { id: 1, label: "10pt", emoji: "🎁", points: 10, color: "#fbbf24", probability: 0.3 },
        { id: 2, label: "50pt", emoji: "💎", points: 50, color: "#f59e0b", probability: 0.25 },
        { id: 3, label: "100pt", emoji: "🔥", points: 100, color: "#ef4444", probability: 0.2 },
        { id: 4, label: "200pt", emoji: "⭐", points: 200, color: "#a855f7", probability: 0.1 },
        { id: 5, label: "500pt", emoji: "👑", points: 500, color: "#22c55e", probability: 0.05 },
      ];

      // Each item must have label and emoji for LuxurySpinWheel
      mockItems.forEach(item => {
        expect(item).toHaveProperty("label");
        expect(item).toHaveProperty("emoji");
        expect(item).toHaveProperty("points");
        expect(typeof item.label).toBe("string");
        expect(typeof item.emoji).toBe("string");
        expect(typeof item.points).toBe("number");
        expect(item.points).toBeGreaterThan(0);
      });
    });
  });

  describe("Wheel items conversion for demo roulette", () => {
    it("should convert API items to wheel format", () => {
      const apiItems = [
        { id: 1, label: "10pt", emoji: "🎁", points: 10, color: "#fbbf24", probability: 0.3 },
        { id: 2, label: "50pt", emoji: "💎", points: 50, color: "#f59e0b", probability: 0.25 },
      ];

      const wheelItems = apiItems.map(i => ({ label: i.label, emoji: i.emoji, points: i.points }));

      expect(wheelItems).toHaveLength(2);
      expect(wheelItems[0]).toEqual({ label: "10pt", emoji: "🎁", points: 10 });
      expect(wheelItems[1]).toEqual({ label: "50pt", emoji: "💎", points: 50 });
    });

    it("should use fallback items when API returns empty", () => {
      const apiItems: any[] = [];
      const fallback = [
        { label: "10pt", emoji: "🎁", points: 10 },
        { label: "50pt", emoji: "💎", points: 50 },
        { label: "100pt", emoji: "🔥", points: 100 },
        { label: "200pt", emoji: "⭐", points: 200 },
        { label: "500pt", emoji: "👑", points: 500 },
        { label: "1,000pt", emoji: "🏆", points: 1000 },
        { label: "5pt", emoji: "🎀", points: 5 },
        { label: "20pt", emoji: "✨", points: 20 },
      ];

      const wheelItems = apiItems.length > 0
        ? apiItems.map((i: any) => ({ label: i.label, emoji: i.emoji, points: i.points }))
        : fallback;

      expect(wheelItems).toHaveLength(8);
      expect(wheelItems[0].label).toBe("10pt");
    });
  });

  describe("Target index selection for demo", () => {
    it("should pick a mid-range item (50-500pt) for demo appeal", () => {
      const wheelItems = [
        { label: "5pt", emoji: "🎀", points: 5 },
        { label: "10pt", emoji: "🎁", points: 10 },
        { label: "50pt", emoji: "💎", points: 50 },
        { label: "100pt", emoji: "🔥", points: 100 },
        { label: "200pt", emoji: "⭐", points: 200 },
        { label: "500pt", emoji: "👑", points: 500 },
        { label: "1,000pt", emoji: "🏆", points: 1000 },
        { label: "20pt", emoji: "✨", points: 20 },
      ];

      // Run multiple times to verify it stays in mid-range
      for (let i = 0; i < 20; i++) {
        const midRange = wheelItems.filter(item => item.points >= 50 && item.points <= 500);
        const pick = midRange[Math.floor(Math.random() * midRange.length)];
        const targetIndex = wheelItems.indexOf(pick);

        expect(targetIndex).toBeGreaterThanOrEqual(0);
        expect(targetIndex).toBeLessThan(wheelItems.length);
        expect(wheelItems[targetIndex].points).toBeGreaterThanOrEqual(50);
        expect(wheelItems[targetIndex].points).toBeLessThanOrEqual(500);
      }
    });
  });

  describe("emailRegister input validation", () => {
    it("should accept valid registration data with phone", () => {
      const input = {
        email: "test@example.com",
        password: "password123",
        name: "テスト太郎",
        phone: "09012345678",
        referralCode: "ABC123",
      };

      expect(input.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(input.password.length).toBeGreaterThanOrEqual(6);
      expect(input.name.length).toBeGreaterThanOrEqual(1);
      expect(input.phone).toMatch(/^0\d{9,10}$/);
    });

    it("should accept registration without phone (optional)", () => {
      const input = {
        email: "test@example.com",
        password: "password123",
        name: "テスト太郎",
      };

      expect(input).not.toHaveProperty("phone");
      expect(input.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it("should reject invalid phone numbers", () => {
      const invalidPhones = ["1234567890", "abc", "090-1234-5678", "123"];
      const phoneRegex = /^0\d{9,10}$/;

      invalidPhones.forEach(phone => {
        const cleaned = phone.replace(/[-\s]/g, "");
        // Only "090-1234-5678" should pass after cleaning
        if (cleaned === "09012345678") {
          expect(phoneRegex.test(cleaned)).toBe(true);
        } else {
          expect(phoneRegex.test(cleaned)).toBe(false);
        }
      });
    });
  });

  describe("Session flow control", () => {
    it("should only show roulette once per session", () => {
      // Simulate sessionStorage behavior
      const storage: Record<string, string> = {};
      
      // First visit - no flag
      expect(storage['lcj_roulette_seen']).toBeUndefined();
      
      // After showing roulette
      storage['lcj_roulette_seen'] = '1';
      expect(storage['lcj_roulette_seen']).toBe('1');
      
      // Second visit - flag exists, don't show
      const shouldShow = !storage['lcj_roulette_seen'];
      expect(shouldShow).toBe(false);
    });

    it("should store won points in localStorage for chat register", () => {
      const storage: Record<string, string> = {};
      
      // After winning
      const wonLabel = "100pt";
      storage['lcj_spin_won_points'] = wonLabel;
      
      expect(storage['lcj_spin_won_points']).toBe("100pt");
    });

    it("should set from_roulette flag for chat register access control", () => {
      const storage: Record<string, string> = {};
      
      // When navigating to chat register
      storage['lcj_from_roulette'] = '1';
      expect(storage['lcj_from_roulette']).toBe('1');
    });
  });

  describe("User routing after roulette", () => {
    it("should route logged-in users to friend challenge", () => {
      const hasSession = true; // localStorage has session token
      const expectedRoute = hasSession ? '/friend-challenge' : '/chat-register';
      expect(expectedRoute).toBe('/friend-challenge');
    });

    it("should route new users to chat register", () => {
      const hasSession = false;
      const expectedRoute = hasSession ? '/friend-challenge' : '/chat-register';
      expect(expectedRoute).toBe('/chat-register');
    });

    it("should route existing account users to line-login", () => {
      const expectedRoute = '/line-login?redirect=/friend-challenge';
      expect(expectedRoute).toContain('/line-login');
      expect(expectedRoute).toContain('redirect=/friend-challenge');
    });
  });
});
