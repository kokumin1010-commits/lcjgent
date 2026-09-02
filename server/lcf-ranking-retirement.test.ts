import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF ranking permanent retirement", () => {
  it("removes the standalone ranking page and route", () => {
    expect(fs.existsSync(path.join(root, "client/src/pages/LcfRanking.tsx"))).toBe(false);
    const app = read("client/src/App.tsx");
    expect(app).not.toContain("LcfRanking");
    expect(app).not.toContain('/lcf/ranking');
  });

  it("removes ranking entry points from the festival home page", () => {
    const home = read("client/src/pages/LiveCommerceFestival.tsx");
    expect(home).not.toContain('/lcf/ranking');
    expect(home).not.toContain("🏆 RANKING");
  });

  it("removes GMV AWARD upload and queries from MyPage", () => {
    const mypage = read("client/src/pages/LcfMypage.tsx");
    expect(mypage).not.toContain("GmvAwardSection");
    expect(mypage).not.toContain("GMV AWARD");
    expect(mypage).not.toContain("trpc.ranking");
  });

  it("removes the ranking tab and panel from the admin UI", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");
    expect(admin).not.toContain("RankingPanel");
    expect(admin).not.toContain("GMV RANKING");
    expect(admin).not.toContain('mainTab === "ranking"');
    expect(admin).not.toContain("trpc.ranking");
  });

  it("removes the public/user ranking router namespace", () => {
    expect(fs.existsSync(path.join(root, "server/rankingRouter.ts"))).toBe(false);
    const routers = read("server/routers.ts");
    expect(routers).not.toContain('from "./rankingRouter"');
    expect(routers).not.toContain("ranking: rankingRouter");
    expect(routers).toContain("rankingRetirement: rankingRetirementRouter");
  });

  it("keeps only an authenticated, confirmation-gated transient retirement router", () => {
    const maintenance = read("server/rankingRetirementRouter.ts");
    expect(maintenance).toContain("verifyFestivalAdminRequest");
    expect(maintenance).toContain('z.literal(CONFIRM_PHRASE)');
    expect(maintenance).toContain('createCipheriv("aes-256-gcm"');
    expect(maintenance).toContain('storageListKeys("ranking-screenshots/")');
    expect(maintenance).toContain("DROP TABLE lcf_ranking_submissions");
    expect(maintenance).toContain('storageListKeys(`${BACKUP_PREFIX}/`)');
    expect(maintenance).not.toContain("publicProcedure");
  });
});
