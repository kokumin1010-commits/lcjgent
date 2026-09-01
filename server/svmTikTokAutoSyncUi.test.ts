import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const matrix = fs.readFileSync(
  path.join(root, "client/src/pages/ShortVideoMatrix.tsx"),
  "utf8"
);
const monitor = fs.readFileSync(
  path.join(root, "client/src/components/TikTokPublicMonitor.tsx"),
  "utf8"
);
const router = fs.readFileSync(path.join(root, "server/svmRouter.ts"), "utf8");
const service = fs.readFileSync(
  path.join(root, "server/tiktokPublicMonitorService.ts"),
  "utf8"
);

describe("short-video matrix automatic TikTok UI contract", () => {
  it("uses the matrix account dialog as the single registration path", () => {
    expect(matrix).toContain(
      '<TikTokPublicMonitor month={currentMonth} showRegisterButton={false} />'
    );
    expect(matrix).toContain("プロフィールURLから自動入力");
    expect(matrix).toContain("保存後に初回取得を実行");
    expect(matrix).toContain("normalizeTikTokUsername(form.profileUrl)");
    expect(matrix).toContain("overflow-x-auto");
    expect(matrix).toContain("shrink-0 gap-1");
  });

  it("shows account status, manual refresh, pause/resume and run history", () => {
    expect(matrix).toContain("自動取得中");
    expect(matrix).toContain("今すぐ取得");
    expect(matrix).toContain("自動取得を停止");
    expect(monitor).toContain("日別投稿数（直近14日）");
    expect(monitor).toContain("最近の自動取得履歴");
    expect(monitor).toContain("accountFilter");
  });

  it("enforces server-authoritative identity and external-call permissions", () => {
    expect(router).toContain("resolveMatrixAccountIdentity(input)");
    expect(router).toContain("assertUniqueTikTokAccount");
    expect(router).toContain("resolveShortVideoDailyAccess(ctx)");
    expect(router).toContain('syncTikTokPublicAccount(accountId, "register")');
    expect(router).toContain("safeMatrixMonitorWarning(error)");
  });

  it("keeps public video metrics separate from orders, GMV and product clicks", () => {
    const automaticSection = monitor.slice(
      monitor.indexOf("公開TikTokアカウント自動監視"),
      monitor.indexOf("取得頻度")
    );
    expect(automaticSection).toContain("注文・GMV・商品クリックとは完全に分離");
    expect(service).toContain("tiktok_public_videos");
    expect(service).toContain("tiktok_public_video_snapshots");
    expect(service).not.toContain("orderCount");
    expect(service).not.toContain("productClicks");
  });

  it("does not use paid AI or fabricate missing engagement fields", () => {
    expect(router).not.toContain("invokeLLM");
    expect(service).not.toContain("invokeLLM");
    expect(monitor).not.toContain("AI推定");
  });
});
