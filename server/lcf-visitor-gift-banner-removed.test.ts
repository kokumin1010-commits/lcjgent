import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const homePath = resolve(root, "client/src/pages/LiveCommerceFestival.tsx");
const giftAssetPath = resolve(root, "client/public/lcf-2026-attendee-gift.png");
const home = readFileSync(homePath, "utf8");

describe("LCF visitor gift banner removal", () => {
  it("does not render or retain the removed yellow gift banner", () => {
    expect(home).not.toContain("<CampaignBanner />");
    expect(home).not.toContain("function CampaignBanner");
    expect(home).not.toContain("/lcf-2026-attendee-gift.png");
    expect(home).not.toContain("事前申込者限定 来場者限定プレゼント 10万円相当");
    expect(existsSync(giftAssetPath)).toBe(false);
  });

  it("keeps the adjacent festival sections connected", () => {
    expect(home).toContain("<SpecialLiversSection />");
    expect(home).toContain("<StatsSection />");
    expect(home.indexOf("<SpecialLiversSection />")).toBeLessThan(home.indexOf("<StatsSection />"));
  });
});
