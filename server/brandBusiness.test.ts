import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BRAND_BD_STAGE_LABELS,
  BRAND_BD_STAGE_VALUES,
  BRAND_DEAL_MODEL_VALUES,
  businessMonthUtcRange,
  canTransitionBrandBdStage,
  progressPercent,
} from "../shared/brandBusiness";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("brand business command center", () => {
  it("keeps the required negotiation order from slot fee to ROI 1:2 and pure commission", () => {
    expect(BRAND_DEAL_MODEL_VALUES).toEqual(["slot_fee", "guaranteed_roi", "pure_commission"]);
    expect(BRAND_BD_STAGE_VALUES.slice(0, 4)).toEqual([
      "new_lead",
      "slot_fee",
      "guaranteed_roi",
      "pure_commission",
    ]);
    expect(BRAND_BD_STAGE_LABELS.guaranteed_roi).toContain("1:2");
    expect(canTransitionBrandBdStage("new_lead", "slot_fee")).toBe(true);
    expect(canTransitionBrandBdStage("new_lead", "pure_commission")).toBe(false);
    expect(canTransitionBrandBdStage("slot_fee", "guaranteed_roi")).toBe(true);
    expect(canTransitionBrandBdStage("guaranteed_roi", "pure_commission")).toBe(true);
    expect(canTransitionBrandBdStage("contracted", "lost")).toBe(false);
  });

  it("builds the selected business month in JST and reports uncapped progress", () => {
    const range = businessMonthUtcRange(2026, 9);
    expect(range.start.toISOString()).toBe("2026-08-31T15:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(progressPercent(8, 10)).toBe(80);
    expect(progressPercent(12, 10)).toBe(120);
    expect(progressPercent(3, 0)).toBeNull();
  });

  it("creates backup-protected deal, monthly target and immutable audit tables", () => {
    const upgrade = read("server/brandBusinessUpgrade.ts");
    const schema = read("drizzle/schema.ts");
    expect(upgrade).toContain('runDatabaseBackup(PRE_BACKUP_REASON, { force: true, waitForActive: true })');
    expect(upgrade).toContain("SELECT GET_LOCK(?,600)");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS brand_business_deals");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS brand_business_monthly_targets");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS brand_business_events");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS brand_business_audit_logs");
    expect(upgrade).toContain("brand count changed during upgrade");
    expect(schema).toContain('mysqlTable("brand_business_deals"');
    expect(schema).toContain('mysqlTable("brand_business_monthly_targets"');
    expect(schema).toContain('mysqlTable("brand_business_events"');
    expect(schema).toContain('mysqlTable("brand_business_audit_logs"');
  });

  it("saves brand deals and monthly goals transactionally with before/after audit", () => {
    const service = read("server/brandBusinessService.ts");
    const router = read("server/brandBusinessRouter.ts");
    expect(service).toContain("await connection.beginTransaction()");
    expect(service).toContain('action: "deal_saved"');
    expect(service).toContain('action: "monthly_target_saved"');
    expect(service).toContain('eventType: "contract_signed"');
    expect(service).toContain("canTransitionBrandBdStage(fromStage, input.stage)");
    expect(service).toContain("contract model must match the completed negotiation stage");
    expect(service).not.toContain('UPDATE brands SET status=?');
    expect(service).toContain("beforeJson");
    expect(service).toContain("afterJson");
    expect(service).toContain("await connection.commit()");
    expect(service).toContain("await connection.rollback()");
    expect(router).toContain("requireBrandBusinessAccess");
    expect(router).toContain("isBusinessDepartment");
    expect(router).toContain("upgradeHealth: protectedProcedure");
    expect(router).not.toContain("publicProcedure");
    expect(router).toContain("overview: protectedProcedure");
    expect(router).toContain("saveDeal: protectedProcedure");
    expect(router).toContain("saveMonthlyTarget: protectedProcedure");
  });

  it("calculates monthly actuals from evidence dates rather than overwriting targets", () => {
    const service = read("server/brandBusinessService.ts");
    expect(service).toContain("brands WHERE deletedAt IS NULL AND createdAt>=? AND createdAt<?");
    expect(service).toContain("brand_business_events");
    expect(service).toContain("e.eventType='contacted'");
    expect(service).toContain("e.eventType='entered_negotiation'");
    expect(service).toContain("e.eventType='contract_signed'");
    expect(service).toContain("JOIN brands b ON b.id=e.brandId AND b.deletedAt IS NULL");
    expect(service).toContain("slotFeeRevenueTarget");
  });

  it("shows page-level monthly targets and editable per-brand BD records", () => {
    const page = read("client/src/pages/BrandList.tsx");
    expect(page).toContain("ブランド商務・{businessMonth.year}年{businessMonth.month}月目標");
    expect(page).toContain("これはブランド商務チーム全体の1か月目標です");
    expect(page).toContain("新規ブランドは、坑位費 → ROI保証 1:2 → 完全成果報酬の順で提案します");
    expect(page).toContain("今月のBDパイプライン");
    expect(page).toContain("次の具体的アクション");
    expect(page).toContain("変更は履歴として保存されます");
    expect(page).toContain("trpc.brandBusiness.saveMonthlyTarget.useMutation");
    expect(page).toContain("trpc.brandBusiness.saveDeal.useMutation");
  });
});
