import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectStoreAdReportPdf } from "./storeAdReportPdf";

const read = (path: string) => readFileSync(path, "utf8");

describe("store ad report PDF safety", () => {
  it("validates PDF bytes and returns immutable evidence metadata", async () => {
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<</Type /Page>>\nendobj\nstartxref\n0\n%%EOF"
    );
    const result = await inspectStoreAdReportPdf({
      buffer: pdf,
      fileName: "synthetic-ad-report.pdf",
      declaredMimeType: "application/pdf",
    });
    expect(result.fileName).toBe("synthetic-ad-report.pdf");
    expect(result.pageCount).toBe(1);
    expect(result.fileSize).toBe(pdf.length);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects files that only claim to be PDF", async () => {
    await expect(inspectStoreAdReportPdf({
      buffer: Buffer.from("not a pdf"),
      fileName: "fake.pdf",
      declaredMimeType: "application/pdf",
    })).rejects.toThrow("不是有效PDF");
  });
});

describe("store ad detail and report source contract", () => {
  const schema = read("drizzle/schema.ts");
  const upgrade = read("server/storeBusinessUpgrade.ts");
  const router = read("server/storeManagementRouter.ts");
  const panel = read("client/src/components/StoreDailyShopPanel.tsx");

  it("creates a backup-gated ad report table without touching uploaded performance rows", () => {
    expect(schema).toContain('storeAdReports = mysqlTable("store_ad_reports"');
    expect(schema).toContain('uniqueIndex("uq_store_ad_report_file")');
    expect(schema).toContain('index("idx_store_ad_report_period")');
    expect(upgrade).toContain('store-business-command-center-v3');
    expect(upgrade).toContain('pre-store-business-v3');
    expect(upgrade).toContain('"store_ad_reports"');
    expect(upgrade).toContain("existingBusinessRowsModified: 0");
  });

  it("keeps report files private, deduplicated and accessible only through authenticated procedures", () => {
    expect(router).toMatch(/listAdReports:\s*protectedProcedure/);
    expect(router).toMatch(/uploadAdReport:\s*protectedProcedure/);
    expect(router).toMatch(/getAdReportFile:\s*protectedProcedure/);
    expect(router).toContain("inspectStoreAdReportPdf");
    expect(router).toContain("private/store-ad-reports/");
    expect(router).toContain("WHERE storeId=? AND fileSha256=? AND deletedAt IS NULL");
    expect(router).toContain("storageGet(String(row.storageKey))");
    expect(router).not.toContain("storageKey: row.storageKey");
  });

  it("opens ad details from ad cards and shows daily rows plus PDF reports", () => {
    for (const label of [
      "点击查看广告明细与报告",
      "查看广告明细",
      "广告明细与报告",
      "逐日广告明细",
      "广告报告PDF",
      "添加广告报告",
      "查看PDF",
    ]) expect(panel).toContain(label);
    expect(panel).toContain('data-testid="store-ad-detail-dialog"');
    expect(panel).toContain('row.sourceTypes?.includes("ads")');
    expect(panel).toContain('accept="application/pdf,.pdf"');
    expect(panel).toContain("listAdReports.useQuery");
    expect(panel).toContain("uploadAdReport.useMutation");
    expect(panel).toContain("getAdReportFile.useMutation");
    expect(panel).toContain("不会重复计入趋势或GMV");
  });
});
