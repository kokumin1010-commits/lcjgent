import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GMV_EVIDENCE_MAX_BYTES, inspectFestivalGmvEvidence } from "./festivalEngagementService";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("第2回LCFの事前マッチングと証憑付き自己申告GMV", () => {
  it("新規テーブルだけを冪等作成し、第1回の既存表を変更しない", () => {
    const service = read("server/festivalEngagementService.ts");
    const schema = read("drizzle/festivalSchema.ts");

    expect(service).toContain('SECOND_EDITION_EVENT_YEAR = "2026-02"');
    expect(service).toContain('SECOND_EDITION_EVENT_DATES = ["2026-12-08", "2026-12-09"]');
    expect(service).toContain("CREATE TABLE IF NOT EXISTS festival_match_requests");
    expect(service).toContain("CREATE TABLE IF NOT EXISTS festival_gmv_reports");
    expect(service).toContain("CREATE TABLE IF NOT EXISTS festival_gmv_adjustments");
    expect(service).toContain("CREATE TABLE IF NOT EXISTS festival_engagement_audit_logs");
    expect(service).toContain("UNIQUE KEY uq_festival_match_active_key (activeKey)");
    expect(service).toContain("UNIQUE KEY uq_festival_gmv_active_evidence (activeEvidenceSha256)");
    expect(service).toContain("UNIQUE KEY uq_festival_gmv_active_live_url (activeLiveUrlHash)");
    expect(service).not.toMatch(/ALTER TABLE/i);
    expect(schema).toContain('mysqlTable("festival_gmv_reports"');
    expect(schema).toContain('supersedesReportId: bigint("supersedesReportId"');
  });

  it("第2回confirmed申込・activeブランド・正式公開商品だけを対象にする", () => {
    const router = read("server/festivalEngagementRouter.ts");

    expect(router).toContain('eq(festivalCompanyApplications.eventYear, SECOND_EDITION_EVENT_YEAR)');
    expect(router).toContain('eq(festivalCompanyApplications.status, "confirmed")');
    expect(router).toContain('eq(festivalLiverApplications.eventYear, SECOND_EDITION_EVENT_YEAR)');
    expect(router).toContain('eq(festivalLiverApplications.status, "confirmed")');
    expect(router).toContain('eq(lcmBrandMembers.status, "active")');
    expect(router).toContain('eq(lcmProducts.status, "published")');
    expect(router).toContain('eq(lcmBrandProfiles.status, "published")');
    expect(router).toContain("const byProduct = new Map<number");
  });

  it("承認前の連絡先を返さず、ブランド権限と本人権限をサーバーで検証する", () => {
    const router = read("server/festivalEngagementRouter.ts");

    expect(router).toContain('row.match.status === "approved" && row.match.contactShareConsent');
    expect(router).toContain("return rows.map(({ creatorEmail, ...row }) => ({");
    expect(router).toContain("creatorContactSnapshot: null, brandContactSnapshot: null");
    expect(router).toContain("hasActiveBrandAccess(db, ctx.festivalAccount.accountId, before.brandProfileId)");
    expect(router).toContain("eq(festivalMatchRequests.creatorAccountId, ctx.festivalAccount.accountId)");
    expect(router).toContain("if (!isCreator && !isBrand && !isAdmin)");
  });

  it("進行中マッチング・配信URL・証憑ハッシュの重複を拒否する", () => {
    const router = read("server/festivalEngagementRouter.ts");

    expect(router).toContain('inArray(festivalMatchRequests.status, ["requested", "needs_info", "approved"])');
    expect(router).toContain('message: "この商品には進行中のマッチング依頼があります"');
    expect(router).toContain('message: "同じ日・配信URLのGMV報告がすでにあります"');
    expect(router).toContain('eq(festivalGmvReports.evidenceSha256, evidence.sha256)');
    expect(router).toContain('message: "同じ証拠画像がすでに提出されています"');
    expect(router).toContain("activeKey: `${SECOND_EDITION_EVENT_YEAR}:${ctx.festivalAccount.accountId}:${product.productId}`");
    expect(router).toContain("activeEvidenceSha256: dedupeHash(`${SECOND_EDITION_EVENT_YEAR}:${evidence.sha256}`)");
    expect(router).toContain("activeKey: null");
  });

  it("JPEG・PNG・WebPのマジックバイト、8MB上限、SHA-256を検証する", () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2mX8AAAAASUVORK5CYII=", "base64");
    const inspected = inspectFestivalGmvEvidence(png.toString("base64"), "image/png");

    expect(inspected.mimeType).toBe("image/png");
    expect(inspected.byteSize).toBe(png.length);
    expect(inspected.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(() => inspectFestivalGmvEvidence(png.toString("base64"), "image/jpeg")).toThrow("JPEG・PNG・WebP");

    const oversized = Buffer.alloc(GMV_EVIDENCE_MAX_BYTES + 1);
    expect(() => inspectFestivalGmvEvidence(oversized.toString("base64"), "image/png")).toThrow("8MB以下");
  });

  it("証憑をprivate keyで保存し、通常一覧へprivate keyやハッシュを返さない", () => {
    const service = read("server/festivalEngagementService.ts");
    const router = read("server/festivalEngagementRouter.ts");
    const adminUi = read("client/src/components/lcf/LcfGmvAdminPanel.tsx");
    const serverEntry = read("server/_core/index.ts");

    expect(service).toContain('`private/lcf/gmv/${input.eventYear}/${input.accountId}/');
    expect(service).toContain('if (!key.startsWith("private/lcf/gmv/"))');
    expect(router).toContain("evidenceStorageKey: undefined");
    expect(router).toContain("evidenceSha256: undefined");
    expect(adminUi).toContain("getEvidenceUrl.fetch({ reportId: row.report.id })");
    expect(adminUi).not.toMatch(/src=\{row\.report\.evidence/);
    expect(adminUi).toContain('referrerPolicy="no-referrer"');
    expect(serverEntry).toContain("req.path.startsWith('/api/trpc/festivalEngagement')");
    expect(serverEntry).toContain("'Cache-Control', 'no-store, private, max-age=0'");
  });

  it("自己申告額と確認額を分離し、確認済みだけを調整後金額で集計する", () => {
    const router = read("server/festivalEngagementRouter.ts");
    const schema = read("drizzle/festivalSchema.ts");

    expect(schema).toContain('submittedAmount: decimal("submittedAmount"');
    expect(schema).toContain('verifiedAmount: decimal("verifiedAmount"');
    expect(router).toContain('const verified = normalizedReports.filter((row) => row.report.status === "verified")');
    expect(router).toContain("verifiedAmount + adjustmentTotal");
    expect(router).toContain("brandTotals: Array.from(brandTotals.values())");
    expect(router).toContain("productTotals: Array.from(productTotals.values())");
    expect(router).toContain('message: "調整後GMVを0円未満にはできません"');
    expect(router).toContain('message: "既存調整を含む最終GMVを0円未満にはできません"');
    expect(router).toContain('message: "自己申告額を修正して承認する場合は理由を入力してください"');
    expect(router).toContain('input.action !== "verify" && !clean(input.reason)');
  });

  it("差戻し再提出は旧報告・旧証憑を削除せず置換履歴を残す", () => {
    const router = read("server/festivalEngagementRouter.ts");

    expect(router).toContain("resubmitGmvReport:");
    expect(router).toContain('if (before.status !== "needs_revision")');
    expect(router).toContain('status: "voided"');
    expect(router).toContain('reviewNote: "差戻し後の再提出により置換"');
    expect(router).toContain("supersedesReportId: before.id");
    expect(router).toContain('action: "resubmitted"');
  });

  it("管理URL、非公開の配信者別集計、マイページ自己申告表現を固定する", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");
    const adminPanel = read("client/src/components/lcf/LcfGmvAdminPanel.tsx");
    const mypage = read("client/src/pages/LcfMypage.tsx");
    const engagement = read("client/src/components/lcf/LcfEngagementCenter.tsx");

    expect(admin).toContain('"gmv"');
    expect(admin).toContain('label: "マッチング・GMV"');
    expect(admin).toContain('mainTab === "gmv" && <LcfGmvAdminPanel />');
    expect(adminPanel).toContain("配信者別累計（運営内）");
    expect(adminPanel).toContain("公開ランキングではありません");
    expect(adminPanel).toContain("確認済みの自己申告GMVだけを集計");
    expect(adminPanel).toContain("事前マッチング監査一覧");
    expect(adminPanel).toContain("ブランド別確認済みGMV");
    expect(adminPanel).toContain("商品別確認済みGMV");
    expect(mypage).toContain("<LcfEngagementCenter />");
    expect(engagement).toContain("この数字は「自己申告GMV」として送信され");
  });

  it("第1回のQR・受付・VIP・アフターパーティー・ブース予約を保持する", () => {
    const mypage = read("client/src/pages/LcfMypage.tsx");
    const editionCenter = read("client/src/components/lcf/LcfEditionApplicationCenter.tsx");
    const admin = read("client/src/pages/LcfAdmin.tsx");

    expect(editionCenter).toContain("QRCodeSVG");
    expect(mypage).toContain("<BoothReservationSection historyOnly />");
    expect(admin).toContain("<CheckInTab />");
    expect(admin).toContain("アフターパーティー参加資格");
    expect(admin).toContain("VIP重点対応");
    expect(admin).toContain("<BoothPanel />");
  });
});
