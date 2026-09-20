import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("brand detail operations and historical GMV ledger", () => {
  it("creates backup-protected historical GMV and immutable audit tables", () => {
    const schema = read("drizzle/schema.ts");
    const upgrade = read("server/brandDataIntegrityUpgrade.ts");
    expect(schema).toContain('mysqlTable("brand_historical_gmv_records"');
    expect(schema).toContain('mysqlTable("brand_historical_gmv_audit_logs"');
    expect(upgrade).toContain('"brand_historical_gmv_records"');
    expect(upgrade).toContain('"brand_historical_gmv_audit_logs"');
    expect(upgrade).toContain("runDatabaseBackup");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS brand_historical_gmv_records");
  });

  it("keeps Lark evidence locked and manual records editable with audit", () => {
    const service = read("server/brandHistoricalGmvService.ts");
    const router = read("server/brandHistoricalGmvRouter.ts");
    const scheduler = read("server/feishuSyncScheduler.ts");
    expect(service).toContain('sourceType: "lark_reported_gmv"');
    expect(service).toContain('const sourceReference = "reported_gmv"');
    expect(service).toContain("return input.db.transaction(async (tx: any)");
    expect(service).toContain("isLocked: true");
    expect(service).toContain('beforeRow.sourceType !== "manual"');
    expect(service).toContain('action: "manual_updated"');
    expect(service).toContain('action: "manual_deleted"');
    expect(service).toContain("onDuplicateKeyUpdate");
    expect(service).toContain("total: larkRecords.length > 0 ? larkTotal : manualTotal");
    expect(service).toContain("historical GMV periods cannot overlap");
    expect(service).toContain("FOR UPDATE");
    expect(scheduler).toContain("upsertLarkHistoricalGmv");
    expect(scheduler).toContain("!larkBrand.fields.reportedGmv.conflict");
    expect(router.match(/requireBrandDataMutation\(ctx\)/g)?.length).toBe(3);
    expect(router).toContain("requireBrandDataView(ctx)");
  });

  it("adds the historical ledger to all-time GMV and exposes writable contract operations", () => {
    const detail = read("client/src/pages/BrandDetail.tsx");
    const routers = read("server/routers.ts");
    const contractUpdate = read("server/brandContractUpdate.ts");
    expect(detail).toContain("combineBrandTotalGmv");
    expect(detail).toContain("计入全期间GMV一次（不写入直播明细）");
    expect(detail).not.toContain("不计入直播GMV（防止重复）");
    expect(detail).toContain("historicalGmvData?.larkTotal");
    expect(detail).toContain("historicalGmvData?.manualTotal");
    expect(detail).toContain("openHistoricalGmvEditor");
    expect(detail).toContain("setAddContractDialogOpen(true)");
    expect(detail).toContain("handleEditContract(contract)");
    expect(detail).toContain("合同内容・条款（自由填写）");
    expect(detail).toContain("保存合同");
    expect(detail).toContain('memo: String(editingContract.memo || "").trim() || null');
    expect(routers).toContain('.input(brandContractUpdateInputSchema)');
    expect(contractUpdate).toContain('memo: z.string().nullable().optional()');
    expect(contractUpdate).toContain('if (value === null || value === "") return null');
    expect(routers).toContain('sanitizeBrandContractAuditValue(existingContract as any)');
    expect(routers).toContain('rest.memo ? `契約内容・条項を更新` : `契約内容・条項をクリア`');
    expect(detail).toContain('id="brand-products-section"');
    expect(detail).toContain('id="brand-livestream-section"');
  });

  it("uses dynamic deal fields, automatic contact time and follow-up reminders", () => {
    const list = read("client/src/pages/BrandList.tsx");
    const service = read("server/brandBusinessService.ts");
    expect(list).toContain('effectiveDealModel === "slot_fee"');
    expect(list).toContain("坑位费为固定费用，不保证 ROI");
    expect(list).toContain("defaultBrandFollowUpAt");
    expect(list).toContain("followUpStatus === \"overdue\"");
    expect(service).toContain("const savedAt = new Date()");
    expect(service).toContain("defaultBrandFollowUpAt(savedAt)");
    expect(service).toContain("normalizeBrandDealTerms");
    expect(service).toContain('fromStage === "contracted" && before?.dealModel');
    expect(list).toContain('editingFromStage === "contracted" ? editingExistingDeal?.dealModel');
  });
});
