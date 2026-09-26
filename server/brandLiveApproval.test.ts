import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BRAND_LIVE_APPROVAL_STATUS_LABELS,
  normalizeApprovalTimestamp,
  validateBrandLiveApprovalDocument,
  validateBrandLiveApprovalSubmission,
  type BrandLiveApprovalDocument,
} from "../shared/brandLiveApproval";
import { scheduleBrandIds } from "./brandLiveScheduleGate";
import { isBrandLiveApprovalUpgradeAuthorized, resolveCanonicalTargetLiverId } from "./brandLiveApprovalUpgrade";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const originalEnvironment = process.env.RAILWAY_ENVIRONMENT_NAME;
afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
  else process.env.RAILWAY_ENVIRONMENT_NAME = originalEnvironment;
});

function validDocument(): BrandLiveApprovalDocument {
  return {
    brandId: 10,
    targetLiverId: 8,
    targetLiverName: "KG",
    liveAccount: "KG LIVE",
    assistantOnsite: "yes",
    assistantDetails: "中控1名到场",
    mechanismSummary: "直播限定六袋套装，赠品明确",
    commissionRate: 20,
    slotFeeAmount: 100000,
    guaranteeType: "roi",
    guaranteeValue: 2,
    guaranteeTerms: "广告费口径，未达时品牌补投",
    scheduledStart: "2026-10-01T10:00:00.000Z",
    scheduledEnd: "2026-10-01T13:00:00.000Z",
    businessNotes: "商务确认完成",
    products: [{
      productId: 12,
      productName: "DONCOQ 6袋セット",
      specification: "1袋56粒・6袋",
      originalPrice: 1290,
      discountedPrice: 1076,
      offerMechanism: "直播限定6袋组合",
      commissionRate: 20,
      inventory: 1000,
      notes: null,
    }],
  };
}

describe("brand live approval policy", () => {
  it("accepts complete five-condition, product-price and ROI terms", () => {
    expect(validateBrandLiveApprovalDocument(validDocument())).toEqual([]);
    expect(BRAND_LIVE_APPROVAL_STATUS_LABELS.pending_approval.zh).toContain("KG");
    expect(BRAND_LIVE_APPROVAL_STATUS_LABELS.approved.zh).toContain("确认");
  });

  it("rejects missing product mechanism, invalid prices, missing assistant and guarantee details", () => {
    const input = validDocument();
    input.assistantDetails = "";
    input.guaranteeTerms = "";
    input.products[0].discountedPrice = 2000;
    input.products[0].offerMechanism = "";
    const errors = validateBrandLiveApprovalDocument(input);
    expect(errors.join("|")).toContain("助播");
    expect(errors.join("|")).toContain("保証");
    expect(errors.join("|")).toContain("通常価格");
    expect(errors.join("|")).toContain("販売メカニズム");
  });

  it("allows incomplete drafts but blocks submission until every negotiated value is explicit", () => {
    const input = validDocument();
    input.assistantOnsite = "tbd";
    input.commissionRate = null;
    input.slotFeeAmount = null;
    input.products[0].specification = "";
    input.products[0].inventory = null;
    input.products[0].originalPrice = null;
    input.products[0].discountedPrice = null;
    expect(validateBrandLiveApprovalDocument(input)).toEqual([]);
    expect(validateBrandLiveApprovalSubmission(input).length).toBeGreaterThanOrEqual(7);
    expect(normalizeApprovalTimestamp("2026-10-01T10:00:00.987Z")).toBe("2026-10-01T10:00:00.000Z");
  });

  it("deduplicates and sorts schedule brand ids", () => {
    expect(scheduleBrandIds({ brandId: 10, brandIds: [12, 10, 11, -1] })).toEqual([10, 11, 12]);
    expect(scheduleBrandIds({ brandId: null, brandIds: [] })).toEqual([]);
  });

  it("authorizes schema DDL only in Railway production", () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = "staging";
    expect(isBrandLiveApprovalUpgradeAuthorized()).toBe(false);
    process.env.RAILWAY_ENVIRONMENT_NAME = "production";
    expect(isBrandLiveApprovalUpgradeAuthorized()).toBe(true);
  });

  it("backfills a nullable legacy target only from one exact canonical liver", () => {
    const livers = [
      { id: 8, name: "ＫＧ", tiktokAccount: "@KG_LIVE" },
      { id: 9, name: "Other", tiktokAccount: "other_live" },
    ];
    expect(resolveCanonicalTargetLiverId("KG", "kg_live", livers)).toBe(8);
    expect(() => resolveCanonicalTargetLiverId("Missing", "kg_live", livers)).toThrow(/uniquely/);
    expect(() => resolveCanonicalTargetLiverId("KG", "kg_live", [...livers, { id: 10, name: "KG", tiktokAccount: "kg_live" }])).toThrow(/uniquely/);
  });
});

describe("brand live approval release contracts", () => {
  const router = read("server/brandLiveApprovalRouter.ts");
  const gate = read("server/brandLiveScheduleGate.ts");
  const db = read("server/db.ts");
  const schema = read("drizzle/schema.ts");
  const upgrade = read("server/brandLiveApprovalUpgrade.ts");
  const page = read("client/src/components/BrandLiveApprovalPanel.tsx");
  const detail = read("client/src/pages/BrandDetail.tsx");
  const publicSchedule = read("client/src/pages/PublicSchedule.tsx");
  const index = read("server/_core/index.ts");
  const mainRouter = read("server/routers.ts");

  it("stores approval setting, condition snapshots, products, immutable events and schedule links", () => {
    for (const table of [
      "brand_live_approval_settings",
      "brand_live_approvals",
      "brand_live_approval_products",
      "brand_live_approval_events",
      "brand_live_approval_schedule_links",
      "brand_live_approval_setting_events",
    ]) expect(schema).toContain(table);
    expect(schema).toContain('uniqueIndex("uq_brand_live_approval_schedule_approval")');
    expect(schema).toContain('index("idx_brand_live_approval_schedule_active")');
    expect(schema).toContain('timestamp("scheduledStart").notNull()');
  });

  it("restricts contribution to business/super-admin and approval to configured KG account", () => {
    expect(router).toContain("requireBusinessContributor(ctx)");
    expect(router).toContain('normalized.includes("商务")');
    expect(router).toContain("setting.approverUserId !== user.id");
    expect(router).toContain("KG承認者本人のみ確認できます");
    expect(router).toContain("requireSystemSuperAdmin");
    expect(router).toContain("readSetting(connection, true)");
    expect(upgrade).toContain("brand_live_approval_setting_events");
    expect(upgrade).toContain("targetLiverId INT NOT NULL");
    expect(schema).toContain('targetLiverId: int("targetLiverId").notNull()');
    expect(router).toContain("assertProductsBelongToBrand");
    expect(router).toContain("assertCanonicalLiver");
    expect(router).toContain("所选主播尚未登记TikTok账号");
  });

  it("uses revision checks, row locks and transactions for status changes", () => {
    expect(router).toContain("FOR UPDATE");
    expect(router).toContain("expectedRevision");
    expect(router).toContain("revision=revision+1");
    expect(router).toContain("beginTransaction()");
    expect(router).toContain("rollback()");
    expect(router).toContain("brand_live_approval_events");
  });

  it("enforces approved brand terms centrally before every schedule insert and sensitive update", () => {
    expect(db).toContain("tryCreateApprovedBrandSchedule(data)");
    expect(db).toContain("tryUpdateApprovedBrandSchedule(id, data, actorUserId)");
    expect(db).toContain("tryCancelApprovedBrandSchedule(id, actorUserId)");
    expect(db).toContain("assertRecurringBrandUpdateSafe(parentScheduleId, data, actorUserId)");
    expect(gate).toContain("approval.status='approved'");
    expect(gate).toContain("approval.scheduledStart=?");
    expect(gate).toContain("approval.scheduledEnd=?");
    expect(gate).toContain("nameMatches");
    expect(gate).toContain("liveAccount === normalizeLiverIdentity(row.liveAccount)");
    expect(gate).toContain("PRECONDITION_FAILED");
    expect(gate).toContain("assertBusinessScheduleActor");
    expect(gate).toContain('data.status === "cancelled"');
    expect(gate).toContain('preflight.status === "cancelled" && data.status === "scheduled"');
    expect(gate).toContain("品牌排班仅限商务部门或管理员操作");
    expect(gate).toContain("品牌直播不能使用重复排班");
    expect(gate).toContain("status='cancelled'");
    expect(gate).toContain("isActive=0");
    expect(gate).not.toContain("DELETE FROM brand_live_approval_schedule_links");
    expect(gate).toContain("assertPersistedScheduleMatches");
    expect(gate).toContain("品牌直播必须选择已登记主播账号");
    expect(gate).toContain("排班主播尚未登记TikTok账号");
    expect(gate).toContain("ORDER BY link.scheduleId,link.id FOR UPDATE");
    expect(db).toContain("if (await cancelRecurringBrandSchedules(parentScheduleId, actorUserId)) return");
    expect(gate).not.toContain("!approvalSensitiveChanged(preflight, preflightNext) && !restoringCancelled) return false");
    expect(gate).toContain("品牌直播不能批量修改重复排班");
    expect(db).toContain("assertRecurringBrandUpdateSafe(parentScheduleId, data, actorUserId)");
    expect(mainRouter).toContain("createdBy: ctx.user?.id");
    expect(mainRouter).toContain("liverId: input.liverId");
    expect(mainRouter).toContain("updateRecurringSchedules(schedule.parentScheduleId, recurringUpdateData, ctx.user?.id)");
    expect(mainRouter).toContain("updateSchedule(id, updateData, ctx.user?.id)");
    expect(mainRouter).toContain("deleteSchedule(input.id, ctx.user?.id)");
    expect(publicSchedule).toContain("liverId: newSchedule.liverId");
    expect(publicSchedule).toContain("ブランド配信は登録済みライバーを選択してください");
  });

  it("shows the exact five conditions, products, pricing, guarantee and recorder/reviewer in the brand page", () => {
    expect(detail).toContain("BrandLiveApprovalPanel");
    for (const copy of ["是否有助播到场", "整体机制", "佣金率", "坑位费", "直播开始", "原价 (JPY)", "折扣后 (JPY)", "怎么保、计算口径、未达成处理", "录入", "确认"]) {
      expect(page).toContain(copy);
    }
    expect(page).toContain("context?.isApprover");
    expect(page).toContain("context?.canContribute");
  });

  it("performs a verified backup before business DDL and exposes a no-store health route", () => {
    expect(upgrade.indexOf("await verifiedBackup(pool)")).toBeLessThan(upgrade.indexOf("await createTables(pool)"));
    expect(upgrade.indexOf("await verifiedBackup(pool)")).toBeLessThan(upgrade.indexOf("await repairNullableTargetLiverIds(pool, beforeSchema)"));
    expect(upgrade).toContain("WHERE targetLiverId IS NULL FOR UPDATE");
    expect(upgrade).toContain("ALTER TABLE brand_live_approvals MODIFY COLUMN targetLiverId INT NOT NULL");
    expect(upgrade).toContain("cannot uniquely backfill targetLiverId");
    expect(upgrade).toContain("RAILWAY_ENVIRONMENT_NAME");
    expect(upgrade).toContain("protected source counts changed during upgrade");
    expect(upgrade).toContain("rebuildEmptyPartialSchema");
    expect(index).toContain('/api/health/brand-live-approval');
    expect(index).toContain('res.setHeader("Cache-Control", "no-store, max-age=0")');
  });
});
