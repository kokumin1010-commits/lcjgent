import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(resolve(relativePath), "utf8");

describe("Legacy roulette shutdown", () => {
  it("does not award a roulette bonus during email registration", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("roulettePointsAwarded: 0");
    expect(router).not.toContain("Award roulette welcome bonus points");
    expect(router).not.toContain("roulettePointsAwarded = input.wonPoints");
  });

  it("does not persist roulette winnings in the member registration client", () => {
    const chatRegister = read("client/src/pages/ChatRegister.tsx");
    expect(chatRegister).not.toContain('localStorage.setItem("lcj_spin_won_points"');
    expect(chatRegister).not.toContain('localStorage.setItem("lcj_spin_won_label"');
    expect(chatRegister).toContain('localStorage.removeItem("lcj_spin_won_points")');
    expect(chatRegister).toContain('localStorage.removeItem("lcj_spin_won_label")');
    expect(chatRegister).not.toContain("roulettePointsAwarded");
  });

  it("does not mount or expose the roulette experience", () => {
    const app = read("client/src/App.tsx");
    const mallHome = read("client/src/pages/MallHome.tsx");
    expect(app).not.toContain("RandomSpinProvider");
    expect(app).toContain('<Route path="/spin-demo"><Redirect to="/beauty-wallet" /></Route>');
    expect(app).toContain('<Route path="/kakuhen-test"><Redirect to="/beauty-wallet" /></Route>');
    expect(mallHome).not.toContain("lcj_spin_won_points");
    expect(mallHome).not.toContain("setShowRoulette");
  });
});
