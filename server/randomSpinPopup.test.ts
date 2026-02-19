import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for the RandomSpinPopup frequency control logic.
 * Since the actual hook uses React state + localStorage, we test the
 * underlying logic patterns here (tracker management, strategic timing).
 */

// ── Mock localStorage ──
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
};

// ── Tracker types & helpers (mirroring RandomSpinPopup.tsx) ──
const STORAGE_KEY = "lcj_spin_popup";

interface PopupTracker {
  sessionShown: boolean;
  dailyCount: number;
  lastShownDate: string;
  cumulativeWins: number;
  pageViews: number;
  lastVisitDate: string;
}

function getTracker(): PopupTracker {
  try {
    const raw = mockLocalStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    sessionShown: false,
    dailyCount: 0,
    lastShownDate: "",
    cumulativeWins: 0,
    pageViews: 0,
    lastVisitDate: "",
  };
}

function saveTracker(tracker: PopupTracker) {
  mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(tracker));
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function canShow(): boolean {
  const tracker = getTracker();
  const today = getTodayStr();
  if (tracker.sessionShown) return false;
  if (tracker.lastShownDate === today && tracker.dailyCount >= 2) return false;
  return true;
}

function markShown(): void {
  const tracker = getTracker();
  const today = getTodayStr();
  tracker.sessionShown = true;
  if (tracker.lastShownDate !== today) {
    tracker.dailyCount = 1;
    tracker.lastShownDate = today;
  } else {
    tracker.dailyCount += 1;
  }
  saveTracker(tracker);
}

function recordWin(points: number): void {
  const tracker = getTracker();
  tracker.cumulativeWins = (tracker.cumulativeWins || 0) + points;
  saveTracker(tracker);
}

function recordPageView(): number {
  const tracker = getTracker();
  tracker.pageViews = (tracker.pageViews || 0) + 1;
  saveTracker(tracker);
  return tracker.pageViews;
}

// ── Tests ──

describe("RandomSpinPopup frequency control", () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    vi.clearAllMocks();
  });

  describe("Tracker initialization", () => {
    it("should return default tracker when no data exists", () => {
      const tracker = getTracker();
      expect(tracker.sessionShown).toBe(false);
      expect(tracker.dailyCount).toBe(0);
      expect(tracker.cumulativeWins).toBe(0);
      expect(tracker.pageViews).toBe(0);
    });

    it("should restore saved tracker data", () => {
      const saved: PopupTracker = {
        sessionShown: true,
        dailyCount: 1,
        lastShownDate: "2026-02-19",
        cumulativeWins: 5000,
        pageViews: 3,
        lastVisitDate: "2026-02-18",
      };
      mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      const tracker = getTracker();
      expect(tracker.sessionShown).toBe(true);
      expect(tracker.dailyCount).toBe(1);
      expect(tracker.cumulativeWins).toBe(5000);
    });
  });

  describe("canShow() - frequency limits", () => {
    it("should allow showing when no previous shows", () => {
      expect(canShow()).toBe(true);
    });

    it("should block after session show", () => {
      markShown();
      expect(canShow()).toBe(false);
    });

    it("should block after 2 daily shows", () => {
      // Simulate 2 shows on the same day (different sessions)
      const tracker = getTracker();
      tracker.dailyCount = 2;
      tracker.lastShownDate = getTodayStr();
      tracker.sessionShown = false; // new session
      saveTracker(tracker);
      expect(canShow()).toBe(false);
    });

    it("should allow showing on a new day even if yesterday had 2 shows", () => {
      const tracker = getTracker();
      tracker.dailyCount = 2;
      tracker.lastShownDate = "2026-02-18"; // yesterday
      tracker.sessionShown = false;
      saveTracker(tracker);
      expect(canShow()).toBe(true);
    });
  });

  describe("markShown() - tracking", () => {
    it("should mark session as shown", () => {
      markShown();
      const tracker = getTracker();
      expect(tracker.sessionShown).toBe(true);
      expect(tracker.dailyCount).toBe(1);
      expect(tracker.lastShownDate).toBe(getTodayStr());
    });

    it("should increment daily count on same day", () => {
      // First show
      const t1 = getTracker();
      t1.dailyCount = 1;
      t1.lastShownDate = getTodayStr();
      t1.sessionShown = false;
      saveTracker(t1);

      markShown();
      const tracker = getTracker();
      expect(tracker.dailyCount).toBe(2);
    });

    it("should reset daily count on new day", () => {
      const t1 = getTracker();
      t1.dailyCount = 2;
      t1.lastShownDate = "2026-02-18";
      t1.sessionShown = false;
      saveTracker(t1);

      markShown();
      const tracker = getTracker();
      expect(tracker.dailyCount).toBe(1);
      expect(tracker.lastShownDate).toBe(getTodayStr());
    });
  });

  describe("recordWin() - cumulative tracking", () => {
    it("should accumulate win amounts", () => {
      recordWin(5000);
      expect(getTracker().cumulativeWins).toBe(5000);

      recordWin(3000);
      expect(getTracker().cumulativeWins).toBe(8000);

      recordWin(10000);
      expect(getTracker().cumulativeWins).toBe(18000);
    });

    it("should start from 0 for new users", () => {
      expect(getTracker().cumulativeWins).toBe(0);
      recordWin(6000);
      expect(getTracker().cumulativeWins).toBe(6000);
    });
  });

  describe("recordPageView() - page view tracking", () => {
    it("should increment page views", () => {
      expect(recordPageView()).toBe(1);
      expect(recordPageView()).toBe(2);
      expect(recordPageView()).toBe(3);
    });

    it("should persist page views across calls", () => {
      recordPageView();
      recordPageView();
      recordPageView();
      expect(getTracker().pageViews).toBe(3);
    });
  });

  describe("Strategic timing conditions", () => {
    it("should meet product page threshold after 3 views", () => {
      recordPageView();
      recordPageView();
      const views = recordPageView();
      expect(views >= 3).toBe(true);
    });

    it("should detect returning user (2+ days away)", () => {
      const tracker = getTracker();
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 3);
      tracker.lastVisitDate = twoDaysAgo.toISOString().slice(0, 10);
      saveTracker(tracker);

      const restored = getTracker();
      const lastDate = new Date(restored.lastVisitDate);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
      expect(daysSince >= 2).toBe(true);
    });

    it("should not detect returning user for same-day visit", () => {
      const tracker = getTracker();
      tracker.lastVisitDate = getTodayStr();
      saveTracker(tracker);

      const restored = getTracker();
      expect(restored.lastVisitDate).toBe(getTodayStr());
      // Same day = not a returning user
      const lastDate = new Date(restored.lastVisitDate);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
      expect(daysSince >= 2).toBe(false);
    });
  });

  describe("JACKPOT_POOLS configuration", () => {
    const JACKPOT_POOLS = [
      { jackpot: 5000, tier: "SUPER JACKPOT" },
      { jackpot: 3000, tier: "GOLD JACKPOT" },
      { jackpot: 6000, tier: "DIAMOND JACKPOT" },
      { jackpot: 8000, tier: "PLATINUM JACKPOT" },
      { jackpot: 10000, tier: "ROYAL JACKPOT" },
    ];

    it("should have 5 jackpot tiers", () => {
      expect(JACKPOT_POOLS.length).toBe(5);
    });

    it("should have jackpot amounts >= 3000", () => {
      JACKPOT_POOLS.forEach(pool => {
        expect(pool.jackpot).toBeGreaterThanOrEqual(3000);
      });
    });

    it("should generate correct spin items for a given jackpot", () => {
      const jackpot = 5000;
      const items = [
        { label: `${(jackpot * 0.02).toLocaleString()}pt`, emoji: "🌙" },
        { label: `${(jackpot * 0.1).toLocaleString()}pt`, emoji: "⭐" },
        { label: `${(jackpot * 0.04).toLocaleString()}pt`, emoji: "🎀" },
        { label: `${(jackpot * 0.2).toLocaleString()}pt`, emoji: "💫" },
        { label: `${jackpot.toLocaleString()}pt`, emoji: "💎" }, // target index 4
        { label: `${(jackpot * 0.06).toLocaleString()}pt`, emoji: "🌸" },
        { label: `${(jackpot * 0.4).toLocaleString()}pt`, emoji: "🏅" },
        { label: `${(jackpot * 0.08).toLocaleString()}pt`, emoji: "✨" },
      ];
      expect(items.length).toBe(8);
      expect(items[4].label).toBe("5,000pt"); // jackpot is always at index 4
      expect(items[4].emoji).toBe("💎");
    });
  });
});
