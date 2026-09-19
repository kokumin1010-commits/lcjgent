import crypto from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  brandLarkFieldChanges,
  brandLarkSourceSnapshots,
  brandLarkSyncRuns,
  brands,
  feishuSyncHistory,
} from "../drizzle/schema";
import { decideNonDestructiveLarkField } from "../shared/larkSyncMerge";
import { syncBrandContactProjectionsFromCurrentSources, type ProjectionResult } from "./accountBrandDataRecovery";
import { ensureBrandDataIntegrityReady } from "./brandDataIntegrityUpgrade";
import { getDb } from "./db";
import type { LarkBrandData, LarkFieldValue } from "./feishuService";

const SIX_HOURS = 6 * 60 * 60 * 1000;
const FEISHU_SYNC_LOCK = "lcj:brand-feishu-sync:v1";

type SyncActor = { userId: number; name: string | null } | null;
type FeishuSyncResult = {
  total: number;
  synced: number;
  created: number;
  updated: number;
  updatedFields: number;
  preservedFields: number;
  conflicts: number;
  errors: string[];
  projection: ProjectionResult | null;
  reconciliation: { expected: number; created: number; renamed: number } | null;
};

export function startFeishuSyncScheduler() {
  console.log("[Feishu Sync] Starting auto-sync scheduler (runs every 6 hours)...");
  setTimeout(() => {
    runFeishuSync("auto").catch(error => console.error("[Feishu Sync] Initial sync failed:", error?.message));
  }, 5 * 60 * 1000);
  setInterval(() => {
    runFeishuSync("auto").catch(error => console.error("[Feishu Sync] Scheduled sync failed:", error?.message));
  }, SIX_HOURS);
}

export function normalizeBrandName(name: string): string {
  return name.trim()
    .replace(/[\(（].*?[\)）]/g, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, value => String.fromCharCode(value.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/[\s\u3000.\-_・]+/g, "");
}

function isSameBrand(name1: string, name2: string): boolean {
  const first = normalizeBrandName(name1);
  const second = normalizeBrandName(name2);
  if (!first || !second) return false;
  if (first === second) return true;
  const shorter = first.length <= second.length ? first : second;
  const longer = first.length <= second.length ? second : first;
  if (shorter.length < 3) return false;
  if (longer.startsWith(shorter) && shorter.length >= 4) return true;
  return shorter.length >= 4 && longer.includes(shorter);
}

function normalizedSnapshot(row: LarkBrandData) {
  return {
    brandName: row.brandName,
    intro: row.intro,
    stage: row.stage,
    tier: row.tier,
    category: row.category,
    contactPlatform: row.contactPlatform,
    brandManager: row.brandManager,
    businessContact: row.businessContact,
    businessLead: row.businessLead,
    operationsContact: row.operationsContact,
    shopId: row.shopId,
    reportedGmv: row.reportedGmv,
    reportedSalesAmount: row.reportedSalesAmount,
    numericFacts: row.numericFacts,
  };
}

function syncDigest(rows: LarkBrandData[]): string {
  return crypto.createHash("sha256")
    .update(rows.map(row => `${row.recordId}:${row.sourceHash}`).sort().join("\n"))
    .digest("hex");
}

type FieldPlan = {
  targetField: string;
  source: LarkFieldValue<any>;
  incoming: unknown;
};

async function auditField(db: any, values: {
  syncRunId: number;
  brandId: number | null;
  recordId: string;
  targetField: string;
  sourceField: string | null;
  action: string;
  beforeValue: unknown;
  incomingValue: unknown;
  afterValue: unknown;
}) {
  await db.insert(brandLarkFieldChanges).values(values);
}

export async function runFeishuSync(triggeredBy: "auto" | "manual" = "auto", actor: SyncActor = null): Promise<FeishuSyncResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Feishu sync locking");
  const lockConnection = await mysql.createConnection(databaseUrl);
  let locked = false;
  try {
    const [rows] = await lockConnection.query<RowDataPacket[]>("SELECT GET_LOCK(?,5) AS acquired", [FEISHU_SYNC_LOCK]);
    locked = Number(rows[0]?.acquired || 0) === 1;
    if (!locked) throw new Error("another Feishu brand sync is already running");
    return await runFeishuSyncUnlocked(triggeredBy, actor);
  } finally {
    if (locked) await lockConnection.query("SELECT RELEASE_LOCK(?)", [FEISHU_SYNC_LOCK]).catch(() => undefined);
    await lockConnection.end();
  }
}

async function runFeishuSyncUnlocked(triggeredBy: "auto" | "manual", actor: SyncActor): Promise<FeishuSyncResult> {
  const startTime = Date.now();
  await ensureBrandDataIntegrityReady();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [{ id: syncRunId }] = await db.insert(brandLarkSyncRuns).values({
    status: "running",
    triggeredBy,
    actorUserId: actor?.userId || null,
    actorName: actor?.name || (triggeredBy === "auto" ? "system" : null),
  }).$returningId();

  try {
    const { fetchFeishuBrands, mapLarkStageToStatus, isFeishuConfigured } = await import("./feishuService");
    if (!isFeishuConfigured()) {
      await db.update(brandLarkSyncRuns).set({ status: "skipped", completedAt: new Date(), details: { reason: "not_configured" } })
        .where(eq(brandLarkSyncRuns.id, syncRunId));
      return { total: 0, synced: 0, created: 0, updated: 0, updatedFields: 0, preservedFields: 0, conflicts: 0, errors: ["飛書APIが設定されていません"], projection: null, reconciliation: null };
    }

    const larkBrands = await fetchFeishuBrands();
    const allExistingBrands = await db.select().from(brands).where(isNull(brands.deletedAt));
    const recordIdCandidates = new Map<string, typeof allExistingBrands>();
    for (const brand of allExistingBrands) {
      if (!brand.larkRecordId) continue;
      const recordId = String(brand.larkRecordId);
      const current = recordIdCandidates.get(recordId) || [];
      current.push(brand);
      recordIdCandidates.set(recordId, current);
    }
    const byRecordId = new Map([...recordIdCandidates.entries()].filter(([, candidates]) => candidates.length === 1).map(([recordId, candidates]) => [recordId, candidates[0]]));
    const conflictedRecordIds = new Set([...recordIdCandidates.entries()].filter(([, candidates]) => candidates.length > 1).map(([recordId]) => recordId));
    const byNormalizedName = new Map<string, typeof allExistingBrands[number][]>();
    const claimedRecordByName = new Map<string, string>();
    for (const brand of allExistingBrands) {
      const key = normalizeBrandName(brand.name);
      const current = byNormalizedName.get(key) || [];
      current.push(brand);
      byNormalizedName.set(key, current);
      if (brand.larkRecordId) claimedRecordByName.set(key, String(brand.larkRecordId));
    }

    let synced = 0;
    let created = 0;
    let updated = 0;
    let updatedFields = 0;
    let preservedFields = 0;
    let conflicts = 0;
    let matchedRecords = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const larkBrand of larkBrands) {
      let matchedBrand: typeof allExistingBrands[number] | undefined;
      try {
        const hasBrandNameConflict = Boolean(larkBrand.fields.brandName.conflict);
        const hasRecordIdentityConflict = conflictedRecordIds.has(larkBrand.recordId);
        const isTaskRecord = larkBrand.brandName.includes("<") || larkBrand.brandName.includes("＜");
        if (!hasBrandNameConflict && !hasRecordIdentityConflict && !isTaskRecord && larkBrand.brandName && larkBrand.brandName !== "Unknown" && larkBrand.brandName.length <= 80) {
          matchedBrand = byRecordId.get(larkBrand.recordId);
          if (!matchedBrand) {
            const candidates = byNormalizedName.get(normalizeBrandName(larkBrand.brandName)) || [];
            if (candidates.length === 1 && (!candidates[0].larkRecordId || candidates[0].larkRecordId === larkBrand.recordId)) {
              matchedBrand = candidates[0];
            } else if (candidates.length > 0) {
              conflicts++;
              errors.push(`${larkBrand.brandName}: exact-name identity conflict`);
            }
          }
        }

        await db.insert(brandLarkSourceSnapshots).values({
          syncRunId,
          recordId: larkBrand.recordId,
          brandId: matchedBrand?.id || null,
          sourceHash: larkBrand.sourceHash,
          rawFields: larkBrand.evidenceFields,
          normalizedFields: normalizedSnapshot(larkBrand),
          fieldNames: Object.keys(larkBrand.evidenceFields).sort(),
        });

        if (hasBrandNameConflict) {
          conflicts++;
          skipped++;
          errors.push(`${larkBrand.recordId}: conflicting brand-name aliases`);
          continue;
        }
        if (hasRecordIdentityConflict) {
          conflicts++;
          skipped++;
          errors.push(`${larkBrand.recordId}: multiple active brands already share this Lark record ID`);
          continue;
        }

        if (isTaskRecord) {
          const separator = larkBrand.brandName.includes("<") ? "<" : "＜";
          const [taskInfo, rawBrandName] = larkBrand.brandName.split(separator);
          const candidate = allExistingBrands.find(brand => isSameBrand(brand.name, (rawBrandName || "").trim()));
          if (candidate && taskInfo.trim()) {
            const currentIntro = candidate.larkIntro || "";
            const nextIntro = currentIntro.includes(taskInfo.trim()) ? currentIntro : `${currentIntro ? `${currentIntro}\n` : ""}[タスク] ${taskInfo.trim()}`;
            if (nextIntro !== currentIntro) {
              await db.update(brands).set({ larkIntro: nextIntro, larkSyncedAt: new Date() }).where(eq(brands.id, candidate.id));
              await auditField(db, { syncRunId, brandId: candidate.id, recordId: larkBrand.recordId, targetField: "larkIntro", sourceField: larkBrand.fields.brandName.sourceField, action: "task_appended", beforeValue: currentIntro, incomingValue: taskInfo.trim(), afterValue: nextIntro });
              updatedFields++;
            }
          }
          skipped++;
          continue;
        }
        if (!larkBrand.brandName || larkBrand.brandName === "Unknown" || larkBrand.brandName.length > 80) {
          skipped++;
          continue;
        }
        if (!matchedBrand && (byNormalizedName.get(normalizeBrandName(larkBrand.brandName)) || []).length > 0) {
          skipped++;
          continue;
        }

        const normalizedName = normalizeBrandName(larkBrand.brandName);
        const claimedRecord = claimedRecordByName.get(normalizedName);
        if (!matchedBrand && claimedRecord && claimedRecord !== larkBrand.recordId) {
          conflicts++;
          skipped++;
          errors.push(`${larkBrand.brandName}: duplicate Lark source records share one normalized name`);
          continue;
        }

        if (!matchedBrand) {
          const sourceConflictFields = Object.entries(larkBrand.fields)
            .filter(([fieldName, field]) => fieldName !== "brandName" && field.conflict)
            .map(([fieldName]) => fieldName);
          conflicts += sourceConflictFields.length;
          if (sourceConflictFields.length > 0) errors.push(`${larkBrand.brandName}: conflicting aliases for ${sourceConflictFields.join(",")}`);
          const [{ id: newId }] = await db.insert(brands).values({
            name: larkBrand.brandName,
            nameJa: larkBrand.brandName,
            status: mapLarkStageToStatus(larkBrand.fields.stage.conflict ? null : larkBrand.stage),
            materialCategory: larkBrand.fields.category.conflict ? undefined : larkBrand.category || undefined,
            larkRecordId: larkBrand.recordId,
            larkStage: larkBrand.fields.stage.conflict ? null : larkBrand.stage,
            larkTier: larkBrand.fields.tier.conflict ? null : larkBrand.tier,
            larkCategory: larkBrand.fields.category.conflict ? null : larkBrand.category,
            larkContactPlatform: larkBrand.fields.contactPlatform.conflict ? null : larkBrand.contactPlatform,
            larkBrandManager: larkBrand.fields.brandManager.conflict ? null : larkBrand.brandManager,
            larkBusinessContact: larkBrand.fields.businessContact.conflict ? null : larkBrand.businessContact,
            larkBusinessLead: larkBrand.fields.businessLead.conflict ? null : larkBrand.businessLead,
            larkOperationsContact: larkBrand.fields.operationsContact.conflict ? null : larkBrand.operationsContact,
            larkShopId: larkBrand.fields.shopId.conflict ? null : larkBrand.shopId,
            larkIntro: larkBrand.fields.intro.conflict ? null : larkBrand.intro,
            larkReportedGmv: larkBrand.fields.reportedGmv.conflict || larkBrand.reportedGmv === null ? null : String(larkBrand.reportedGmv),
            larkReportedSalesAmount: larkBrand.fields.reportedSalesAmount.conflict || larkBrand.reportedSalesAmount === null ? null : String(larkBrand.reportedSalesAmount),
            larkNumericFacts: larkBrand.numericFacts,
            larkSourceHash: larkBrand.sourceHash,
            larkSyncedAt: new Date(),
            createdBy: actor?.userId || 1,
          }).$returningId();
          claimedRecordByName.set(normalizedName, larkBrand.recordId);
          created++;
          synced++;
          if (newId) {
            await db.update(brandLarkSourceSnapshots).set({ brandId: newId })
              .where(and(eq(brandLarkSourceSnapshots.syncRunId, syncRunId), eq(brandLarkSourceSnapshots.recordId, larkBrand.recordId)));
            for (const [targetField, source] of Object.entries(larkBrand.fields)) {
              if (!source.conflict) continue;
              await auditField(db, { syncRunId, brandId: newId, recordId: larkBrand.recordId, targetField, sourceField: source.sourceField, action: "source_alias_conflict", beforeValue: null, incomingValue: source.value, afterValue: null });
            }
          }
          continue;
        }

        matchedRecords++;
        const plans: FieldPlan[] = [
          { targetField: "larkStage", source: larkBrand.fields.stage, incoming: larkBrand.stage },
          { targetField: "larkTier", source: larkBrand.fields.tier, incoming: larkBrand.tier },
          { targetField: "larkCategory", source: larkBrand.fields.category, incoming: larkBrand.category },
          { targetField: "larkContactPlatform", source: larkBrand.fields.contactPlatform, incoming: larkBrand.contactPlatform },
          { targetField: "larkBrandManager", source: larkBrand.fields.brandManager, incoming: larkBrand.brandManager },
          { targetField: "larkBusinessContact", source: larkBrand.fields.businessContact, incoming: larkBrand.businessContact },
          { targetField: "larkBusinessLead", source: larkBrand.fields.businessLead, incoming: larkBrand.businessLead },
          { targetField: "larkOperationsContact", source: larkBrand.fields.operationsContact, incoming: larkBrand.operationsContact },
          { targetField: "larkShopId", source: larkBrand.fields.shopId, incoming: larkBrand.shopId },
          { targetField: "larkIntro", source: larkBrand.fields.intro, incoming: larkBrand.intro },
          { targetField: "larkReportedGmv", source: larkBrand.fields.reportedGmv, incoming: larkBrand.reportedGmv },
          { targetField: "larkReportedSalesAmount", source: larkBrand.fields.reportedSalesAmount, incoming: larkBrand.reportedSalesAmount },
        ];
        const updateValues: Record<string, unknown> = {
          larkRecordId: larkBrand.recordId,
          larkSourceHash: larkBrand.sourceHash,
          larkSyncedAt: new Date(),
        };
        let changedThisBrand = false;
        for (const plan of plans) {
          const beforeValue = (matchedBrand as any)[plan.targetField];
          if (plan.source.conflict) {
            conflicts++;
            errors.push(`${larkBrand.brandName}: conflicting aliases for ${plan.targetField}`);
            await auditField(db, { syncRunId, brandId: matchedBrand.id, recordId: larkBrand.recordId, targetField: plan.targetField, sourceField: plan.source.sourceField, action: "source_alias_conflict", beforeValue, incomingValue: plan.incoming, afterValue: beforeValue });
            continue;
          }
          const decision = decideNonDestructiveLarkField(beforeValue, plan.source);
          if (decision.shouldUpdate) {
            updateValues[plan.targetField] = decision.value;
            changedThisBrand = true;
            updatedFields++;
            await auditField(db, { syncRunId, brandId: matchedBrand.id, recordId: larkBrand.recordId, targetField: plan.targetField, sourceField: plan.source.sourceField, action: decision.action, beforeValue, incomingValue: plan.incoming, afterValue: decision.value });
          } else if (decision.action === "preserved_blank" || decision.action === "preserved_absent") {
            preservedFields++;
            await auditField(db, { syncRunId, brandId: matchedBrand.id, recordId: larkBrand.recordId, targetField: plan.targetField, sourceField: plan.source.sourceField, action: decision.action, beforeValue, incomingValue: plan.incoming, afterValue: beforeValue });
          }
        }
        if (larkBrand.numericFacts.length > 0 && JSON.stringify(matchedBrand.larkNumericFacts || []) !== JSON.stringify(larkBrand.numericFacts)) {
          updateValues.larkNumericFacts = larkBrand.numericFacts;
          changedThisBrand = true;
          updatedFields++;
          await auditField(db, { syncRunId, brandId: matchedBrand.id, recordId: larkBrand.recordId, targetField: "larkNumericFacts", sourceField: null, action: "updated", beforeValue: matchedBrand.larkNumericFacts || [], incomingValue: larkBrand.numericFacts, afterValue: larkBrand.numericFacts });
        }
        await db.update(brands).set(updateValues as any).where(eq(brands.id, matchedBrand.id));
        if (changedThisBrand) updated++;
        synced++;
      } catch (error: any) {
        errors.push(`${larkBrand.brandName}: ${error?.message || String(error)}`);
      }
    }

    let projection: ProjectionResult | null = null;
    try {
      projection = await syncBrandContactProjectionsFromCurrentSources();
    } catch (error: any) {
      errors.push(`brand/contact projection: ${error?.message || String(error)}`);
    }
    const durationMs = Date.now() - startTime;
    const finalStatus = errors.length > 0 || conflicts > 0 ? "partial" : "success";
    await db.update(brandLarkSyncRuns).set({
      status: finalStatus,
      totalRecords: larkBrands.length,
      matchedRecords,
      createdRecords: created,
      updatedFields,
      preservedFields,
      conflictFields: conflicts,
      errorCount: errors.length,
      sourceDigest: syncDigest(larkBrands),
      details: { synced, updated, skipped, errors: errors.slice(0, 10) },
      completedAt: new Date(),
    }).where(eq(brandLarkSyncRuns.id, syncRunId));
    await saveSyncHistory(db, {
      syncType: "brands",
      status: finalStatus,
      totalRecords: larkBrands.length,
      newRecords: created,
      updatedRecords: updated,
      triggeredBy,
      durationMs,
      errorMessage: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
    });
    return { total: larkBrands.length, synced, created, updated, updatedFields, preservedFields, conflicts, errors: errors.slice(0, 10), projection, reconciliation: null };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await db.update(brandLarkSyncRuns).set({ status: "error", errorCount: 1, details: { error: error?.message || "Unknown error" }, completedAt: new Date() })
      .where(eq(brandLarkSyncRuns.id, syncRunId)).catch(() => undefined);
    await saveSyncHistory(db, { syncType: "brands", status: "error", totalRecords: 0, newRecords: 0, updatedRecords: 0, triggeredBy, durationMs, errorMessage: error?.message || "Unknown error" });
    throw error;
  }
}

async function saveSyncHistory(db: any, data: {
  syncType: string;
  status: string;
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  triggeredBy: string;
  durationMs: number;
  errorMessage: string | null;
}) {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS feishu_sync_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      syncType VARCHAR(50) NOT NULL DEFAULT 'brands',
      status VARCHAR(20) NOT NULL DEFAULT 'success',
      totalRecords INT NOT NULL DEFAULT 0,
      newRecords INT NOT NULL DEFAULT 0,
      updatedRecords INT NOT NULL DEFAULT 0,
      errorMessage TEXT,
      triggeredBy VARCHAR(50) NOT NULL DEFAULT 'auto',
      durationMs INT DEFAULT 0,
      syncedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.insert(feishuSyncHistory).values(data);
  } catch (error: any) {
    console.error("[Feishu Sync] Failed to save sync history:", error?.message);
  }
}
