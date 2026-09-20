import crypto from "node:crypto";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { readDatabaseBackupTables, runDatabaseBackup } from "./databaseBackupScheduler";
import { ensureBrandDataIntegrityReady } from "./brandDataIntegrityUpgrade";

const LOCK_KEY = "brand-history-recovery-v1";
const PRE_BACKUP_REASON = "pre-brand-history-v1";
const POST_BACKUP_REASON = "post-brand-history-v1";

const RESTORABLE_LIVESTREAM_FIELDS = [
  "manualSalesAmount",
  "salesAmount",
  "gmv",
  "duration",
  "viewerCount",
  "orderCount",
  "productClicks",
  "impressions",
  "salesCount",
  "cartAddCount",
  "peakViewers",
  "newFollowers",
  "avgViewDuration",
  "likes",
  "comments",
  "shares",
  "avgPrice",
  "customerCount",
  "itemsSold",
  "adCost",
] as const;

const MERGEABLE_BRAND_FIELDS = [
  "companyName",
  "category",
  "phoneNumber",
  "materialCategory",
  "email",
  "contactPerson",
  "adBudget",
  "salesTarget",
  "commissionRate",
  "businessCardUrls",
  "businessCardKeys",
  "logoUrl",
  "logoKey",
  "shopId",
  "shopCode",
  "memo",
  "businessManagerId",
  "operationsManagerId",
  "larkRecordId",
  "larkStage",
  "larkTier",
  "larkCategory",
  "larkContactPlatform",
  "larkBrandManager",
  "larkBusinessContact",
  "larkBusinessLead",
  "larkOperationsContact",
  "larkShopId",
  "larkIntro",
  "larkReportedGmv",
  "larkReportedSalesAmount",
  "larkNumericFacts",
  "larkSourceHash",
  "larkSyncedAt",
] as const;

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && (!(typeof value === "string") || value.trim().length > 0);
}

function jsonValue(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

async function tableExists(connection: Connection, tableName: string): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [tableName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function latestBackupId(connection: Connection, before?: Date): Promise<number | null> {
  const conditions = before ? "AND completedAt < ?" : "";
  const params = before ? [before] : [];
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM db_backup_runs WHERE status='success' ${conditions} ORDER BY completedAt DESC,id DESC LIMIT 1`,
    params,
  );
  return rows[0]?.id ? Number(rows[0].id) : null;
}

async function verifiedBackup(connection: Connection, reason: string): Promise<number> {
  const beforeId = (await latestBackupId(connection)) || 0;
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT id,status,errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1",
    [beforeId, reason],
  );
  if (String(rows[0]?.status || "") !== "success") throw new Error(`verified backup failed: ${String(rows[0]?.errorMessage || "missing run")}`);
  return Number(rows[0].id);
}

type BrandMergeCandidate = {
  sourceBrandId: number;
  targetBrandId: number;
  evidence: string;
};

type RestoreCandidate = {
  livestreamId: number;
  brandId: number;
  fieldName: typeof RESTORABLE_LIVESTREAM_FIELDS[number];
  value: number;
  sourceBackupId: number;
};

async function findHistoricalMergeCandidates(connection: Connection): Promise<{ candidates: BrandMergeCandidate[]; conflicts: any[] }> {
  const [rows] = await connection.query<RowDataPacket[]>(`
    SELECT source.id AS sourceBrandId, source.name AS sourceName, source.larkRecordId,
           target.id AS targetBrandId, target.name AS targetName,
           COUNT(*) OVER (PARTITION BY source.id) AS targetCount
      FROM brands source
      JOIN brands target ON target.larkRecordId=source.larkRecordId
       AND target.deletedAt IS NULL AND target.id<>source.id
     WHERE source.deletedAt IS NOT NULL
       AND source.larkRecordId IS NOT NULL
       AND source.larkRecordId<>''
       AND NOT EXISTS (
         SELECT 1 FROM brand_data_recovery_items completed
          WHERE completed.sourceBrandId=source.id
            AND completed.targetBrandId=target.id
            AND completed.action IN ('merge_completed','merge_review_required')
       )
     ORDER BY source.id,target.id
  `);
  const candidates = rows
    .filter(row => Number(row.targetCount) === 1)
    .map(row => ({
      sourceBrandId: Number(row.sourceBrandId),
      targetBrandId: Number(row.targetBrandId),
      evidence: `same_lark_record_id:${String(row.larkRecordId)}`,
    }));
  const conflicts = rows
    .filter(row => Number(row.targetCount) !== 1)
    .map(row => ({ sourceBrandId: Number(row.sourceBrandId), reason: "multiple_active_targets_for_lark_record", targetCount: Number(row.targetCount) }));
  return { candidates, conflicts };
}

async function findBackupRestoreCandidates(connection: Connection): Promise<{ backupId: number | null; candidates: RestoreCandidate[]; error: string | null }> {
  if (!await tableExists(connection, "db_backup_runs")) return { backupId: null, candidates: [], error: "backup_run_table_missing" };
  const [syncRows] = await connection.query<RowDataPacket[]>("SELECT MIN(syncedAt) AS firstSync FROM feishu_sync_history WHERE syncedAt>=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 7 DAY)");
  const before = syncRows[0]?.firstSync ? new Date(syncRows[0].firstSync) : undefined;
  const [backupRows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM db_backup_runs WHERE status='success' ${before ? "AND completedAt < ?" : ""} ORDER BY completedAt DESC,id DESC LIMIT 14`,
    before ? [before] : [],
  );
  if (backupRows.length === 0) {
    const [fallbackRows] = await connection.query<RowDataPacket[]>("SELECT id FROM db_backup_runs WHERE status='success' ORDER BY completedAt DESC,id DESC LIMIT 14");
    backupRows.push(...fallbackRows);
  }
  if (backupRows.length === 0) return { backupId: null, candidates: [], error: "successful_backup_missing" };
  const [currentRows] = await connection.query<RowDataPacket[]>("SELECT * FROM brand_livestreams WHERE deletedAt IS NULL");
  const currentById = new Map(currentRows.map(row => [Number(row.id), row]));
  const candidatesByField = new Map<string, RestoreCandidate>();
  const readErrors: string[] = [];
  for (const backupRow of backupRows) {
    const backupId = Number(backupRow.id);
    try {
      const backup = await readDatabaseBackupTables(backupId, ["brand_livestreams"]);
    for (const sourceRow of backup.tables.brand_livestreams || []) {
      const livestreamId = Number(sourceRow.id || 0);
      const current = currentById.get(livestreamId);
      if (!current || sourceRow.deletedAt) continue;
      for (const fieldName of RESTORABLE_LIVESTREAM_FIELDS) {
        const key = `${livestreamId}:${fieldName}`;
        if (candidatesByField.has(key)) continue;
        const sourceValue = sourceRow[fieldName];
        if (hasValue(current[fieldName]) || !hasValue(sourceValue)) continue;
        const numeric = Number(sourceValue);
        if (!Number.isFinite(numeric) || numeric < 0) continue;
        candidatesByField.set(key, { livestreamId, brandId: Number(current.brandId), fieldName, value: numeric, sourceBackupId: backupId });
      }
    }
    } catch (error) {
      readErrors.push(`${backupId}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    backupId: Number(backupRows[0].id),
    candidates: [...candidatesByField.values()],
    error: candidatesByField.size === 0 && readErrors.length === backupRows.length ? readErrors.join("; ").slice(0, 2000) : null,
  };
}

async function listBrandReferenceTables(connection: Connection): Promise<Array<{ tableName: string; hasBrandName: boolean; hasId: boolean }>> {
  const immutableAuditTables = new Set([
    "brand_addition_logs",
    "brand_business_audit_logs",
    "brand_edit_logs",
    "brand_lark_field_changes",
    "brand_lark_source_snapshots",
  ]);
  const [rows] = await connection.query<RowDataPacket[]>(`
    SELECT TABLE_NAME AS tableName,
           MAX(CASE WHEN COLUMN_NAME='brandName' THEN 1 ELSE 0 END) AS hasBrandName,
           MAX(CASE WHEN COLUMN_NAME='id' THEN 1 ELSE 0 END) AS hasId
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE()
       AND TABLE_NAME<>'brands'
       AND COLUMN_NAME IN ('id','brandId','brandName')
     GROUP BY TABLE_NAME
    HAVING SUM(CASE WHEN COLUMN_NAME='brandId' THEN 1 ELSE 0 END)>0
     ORDER BY TABLE_NAME
  `);
  return rows.map(row => ({ tableName: String(row.tableName), hasBrandName: Number(row.hasBrandName) === 1, hasId: Number(row.hasId) === 1 }))
    .filter(row => {
      const immutableByName = /(?:^|_)(?:audit|history|logs?)(?:_|$)|sync/i.test(row.tableName);
      return /^[A-Za-z0-9_]+$/.test(row.tableName)
        && !immutableAuditTables.has(row.tableName)
        && !immutableByName;
    });
}

async function moveBrandReferences(connection: Connection, sourceBrandId: number, targetBrandId: number, targetName: string) {
  const tables = await listBrandReferenceTables(connection);
  const changes: Array<{ tableName: string; before: number; moved: number; remaining: number; recordIds: string[] }> = [];
  for (const table of tables) {
    const [beforeRows] = await connection.query<RowDataPacket[]>(table.hasId
      ? `SELECT id FROM \`${table.tableName}\` WHERE brandId=? FOR UPDATE`
      : `SELECT COUNT(*) AS count FROM \`${table.tableName}\` WHERE brandId=? FOR UPDATE`, [sourceBrandId]);
    const before = table.hasId ? beforeRows.length : Number(beforeRows[0]?.count || 0);
    if (before === 0) continue;
    const recordIds = table.hasId ? beforeRows.map(row => String(row.id)) : [];
    const set = table.hasBrandName ? "brandId=?, brandName=?" : "brandId=?";
    const params = table.hasBrandName ? [targetBrandId, targetName, sourceBrandId] : [targetBrandId, sourceBrandId];
    const [result] = await connection.execute<mysql.ResultSetHeader>(`UPDATE \`${table.tableName}\` SET ${set} WHERE brandId=?`, params);
    const [afterRows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table.tableName}\` WHERE brandId=?`, [sourceBrandId]);
    changes.push({ tableName: table.tableName, before, moved: Number(result.affectedRows || 0), remaining: Number(afterRows[0]?.count || 0), recordIds });
  }
  return changes;
}

async function mergeMissingBrandFields(connection: Connection, sourceBrandId: number, targetBrandId: number) {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM brands WHERE id IN (?,?)", [sourceBrandId, targetBrandId]);
  const source = rows.find(row => Number(row.id) === sourceBrandId);
  const target = rows.find(row => Number(row.id) === targetBrandId);
  if (!source || !target) throw new Error("brand merge source or target missing");
  const assignments: string[] = [];
  const values: unknown[] = [];
  const restoredFields: Array<{ fieldName: string; beforeValue: unknown; afterValue: unknown }> = [];
  for (const field of MERGEABLE_BRAND_FIELDS) {
    if (hasValue(target[field]) || !hasValue(source[field])) continue;
    assignments.push(`\`${field}\`=?`);
    values.push(source[field]);
    restoredFields.push({ fieldName: field, beforeValue: target[field] ?? null, afterValue: source[field] });
  }
  if (assignments.length > 0) {
    await connection.execute(`UPDATE brands SET ${assignments.join(",")}, updatedAt=CURRENT_TIMESTAMP WHERE id=?`, [...values, targetBrandId]);
  }
  return restoredFields;
}

async function insertRecoveryItem(connection: Connection, runId: number, item: Record<string, unknown>) {
  await connection.execute(`INSERT INTO brand_data_recovery_items
    (recoveryRunId,sourceKind,sourceReference,sourceBrandId,targetBrandId,tableName,recordId,fieldName,action,status,evidence,beforeValue,afterValue)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    runId,
    item.sourceKind,
    item.sourceReference ?? null,
    item.sourceBrandId ?? null,
    item.targetBrandId ?? null,
    item.tableName ?? null,
    item.recordId ?? null,
    item.fieldName ?? null,
    item.action,
    item.status,
    jsonValue(item.evidence),
    jsonValue(item.beforeValue),
    jsonValue(item.afterValue),
  ]);
}

function manualMergePlanHash(input: {
  sourceBrandId: number;
  targetBrandId: number;
  reason: string;
  expectedSourceUpdatedAt: string;
  expectedTargetUpdatedAt: string;
}) {
  return crypto.createHash("sha256").update(JSON.stringify({
    sourceBrandId: input.sourceBrandId,
    targetBrandId: input.targetBrandId,
    reason: input.reason.trim(),
    expectedSourceUpdatedAt: input.expectedSourceUpdatedAt,
    expectedTargetUpdatedAt: input.expectedTargetUpdatedAt,
  })).digest("hex");
}

export async function previewBrandMergeWithEvidence(input: { sourceBrandId: number; targetBrandId: number; reason: string }) {
  if (input.sourceBrandId === input.targetBrandId) throw new Error("same brand cannot be merged");
  if (input.reason.trim().length < 8) throw new Error("brand merge reason is required");
  await ensureBrandDataIntegrityReady();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for brand merge preview");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [brandRows] = await connection.query<RowDataPacket[]>("SELECT * FROM brands WHERE id IN (?,?) AND deletedAt IS NULL", [input.sourceBrandId, input.targetBrandId]);
    const source = brandRows.find(row => Number(row.id) === input.sourceBrandId);
    const target = brandRows.find(row => Number(row.id) === input.targetBrandId);
    if (!source || !target) throw new Error("source or target brand was not found");
    const referenceTables = await listBrandReferenceTables(connection);
    const references: Array<{ tableName: string; rowCount: number }> = [];
    for (const table of referenceTables) {
      const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table.tableName}\` WHERE brandId=?`, [input.sourceBrandId]);
      const rowCount = Number(rows[0]?.count || 0);
      if (rowCount > 0) references.push({ tableName: table.tableName, rowCount });
    }
    const fieldsToRestore = MERGEABLE_BRAND_FIELDS.filter(field => !hasValue(target[field]) && hasValue(source[field]));
    const expectedSourceUpdatedAt = new Date(source.updatedAt).toISOString();
    const expectedTargetUpdatedAt = new Date(target.updatedAt).toISOString();
    return {
      sourceBrandId: input.sourceBrandId,
      sourceName: String(source.name),
      targetBrandId: input.targetBrandId,
      targetName: String(target.name),
      reason: input.reason.trim(),
      expectedSourceUpdatedAt,
      expectedTargetUpdatedAt,
      references,
      fieldsToRestore,
      planHash: manualMergePlanHash({ ...input, expectedSourceUpdatedAt, expectedTargetUpdatedAt }),
    };
  } finally {
    await connection.end();
  }
}

export async function runBrandHistoricalRecovery(mode: "startup" | "manual" = "startup") {
  await ensureBrandDataIntegrityReady();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for brand historical recovery preview");
  const connection = await mysql.createConnection(databaseUrl);
  let locked = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?,600) AS acquired", [LOCK_KEY]);
    locked = Number(lockRows[0]?.acquired || 0) === 1;
    if (!locked) throw new Error("brand historical recovery preview lock timeout");
    const mergePlan = await findHistoricalMergeCandidates(connection);
    const backupPlan = mode === "manual"
      ? await findBackupRestoreCandidates(connection)
      : { backupId: null, candidates: [], error: null };
    const planPayload = {
      mode,
      automaticWrites: false,
      mergeCandidates: mergePlan.candidates,
      mergeConflicts: mergePlan.conflicts,
      backupReviewCandidates: backupPlan.candidates,
      sourceBackupId: backupPlan.backupId,
      backupReadError: backupPlan.error,
    };
    return {
      runId: 0,
      appliedItems: 0,
      conflicts: mergePlan.conflicts.length + backupPlan.candidates.length + (backupPlan.error ? 1 : 0),
      previewOnly: true,
      planHash: crypto.createHash("sha256").update(JSON.stringify(planPayload)).digest("hex"),
      ...planPayload,
    };
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_KEY]).catch(() => undefined);
    await connection.end();
  }
}

export async function mergeBrandsWithEvidence(input: {
  sourceBrandId: number;
  targetBrandId: number;
  actorId: number;
  actorName: string | null;
  reason: string;
  confirmation: "CONFIRM_BRAND_MERGE";
  planHash: string;
  expectedSourceUpdatedAt: string;
  expectedTargetUpdatedAt: string;
}) {
  if (input.sourceBrandId === input.targetBrandId) throw new Error("same brand cannot be merged");
  if (input.confirmation !== "CONFIRM_BRAND_MERGE") throw new Error("brand merge confirmation is required");
  if (input.reason.trim().length < 8) throw new Error("brand merge reason is required");
  await ensureBrandDataIntegrityReady();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for brand merge");
  const connection = await mysql.createConnection(databaseUrl);
  let locked = false;
  const planHash = manualMergePlanHash({
    sourceBrandId: input.sourceBrandId,
    targetBrandId: input.targetBrandId,
    reason: input.reason.trim(),
    expectedSourceUpdatedAt: input.expectedSourceUpdatedAt,
    expectedTargetUpdatedAt: input.expectedTargetUpdatedAt,
  });
  if (input.planHash !== planHash) throw new Error("brand merge plan changed; preview again");
  const runKey = `brand-manual-merge-v1-${planHash.slice(0, 48)}`;
  let runId = 0;
  let committed = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?,600) AS acquired", [LOCK_KEY]);
    locked = Number(lockRows[0]?.acquired || 0) === 1;
    if (!locked) throw new Error("brand merge lock timeout");
    const [existingRunRows] = await connection.query<RowDataPacket[]>("SELECT id,status FROM brand_data_recovery_runs WHERE runKey=? LIMIT 1", [runKey]);
    if (existingRunRows[0]) throw new Error(`brand merge plan already exists with status ${String(existingRunRows[0].status)}`);
    const preBackupId = await verifiedBackup(connection, PRE_BACKUP_REASON);
    const [runResult] = await connection.execute<mysql.ResultSetHeader>(`INSERT INTO brand_data_recovery_runs
      (runKey,mode,status,preBackupId,proposedItems,details) VALUES (?,'manual_merge','running',?,1,?)`,
    [runKey, preBackupId, JSON.stringify({ sourceBrandId: input.sourceBrandId, targetBrandId: input.targetBrandId, actorId: input.actorId, actorName: input.actorName, reason: input.reason })]);
    runId = Number(runResult.insertId);
    await connection.beginTransaction();
    let changes: Array<{ tableName: string; before: number; moved: number; remaining: number; recordIds: string[] }> = [];
    let restoredFields: Array<{ fieldName: string; beforeValue: unknown; afterValue: unknown }> = [];
    let source: RowDataPacket | undefined;
    let target: RowDataPacket | undefined;
    try {
      const [brandRows] = await connection.query<RowDataPacket[]>("SELECT * FROM brands WHERE id IN (?,?) AND deletedAt IS NULL FOR UPDATE", [input.sourceBrandId, input.targetBrandId]);
      source = brandRows.find(row => Number(row.id) === input.sourceBrandId);
      target = brandRows.find(row => Number(row.id) === input.targetBrandId);
      if (!source || !target) throw new Error("source or target brand was not found");
      if (new Date(source.updatedAt).toISOString() !== new Date(input.expectedSourceUpdatedAt).toISOString()) throw new Error("source brand changed after merge dialog opened");
      if (new Date(target.updatedAt).toISOString() !== new Date(input.expectedTargetUpdatedAt).toISOString()) throw new Error("target brand changed after merge dialog opened");
      restoredFields = await mergeMissingBrandFields(connection, input.sourceBrandId, input.targetBrandId);
      changes = await moveBrandReferences(connection, input.sourceBrandId, input.targetBrandId, String(target.name));
      const unresolved = changes.filter(change => change.remaining > 0);
      if (unresolved.length > 0) {
        throw new Error(`brand merge stopped because ${unresolved.length} tables contain unique-key conflicts`);
      }
      await connection.execute("UPDATE brands SET deletedAt=CURRENT_TIMESTAMP WHERE id=? AND deletedAt IS NULL", [input.sourceBrandId]);
      for (const change of changes) {
        const recordIds = change.recordIds.length > 0 ? change.recordIds : [null];
        for (const recordId of recordIds) {
          await insertRecoveryItem(connection, runId, { sourceKind: "manual_selection", sourceBrandId: input.sourceBrandId, targetBrandId: input.targetBrandId, tableName: change.tableName, recordId, action: "merge_references", status: "applied", evidence: { actorId: input.actorId, reason: input.reason }, beforeValue: { brandId: input.sourceBrandId }, afterValue: { brandId: input.targetBrandId } });
        }
      }
      for (const field of restoredFields) {
        await insertRecoveryItem(connection, runId, { sourceKind: "manual_selection", sourceBrandId: input.sourceBrandId, targetBrandId: input.targetBrandId, tableName: "brands", recordId: String(input.targetBrandId), fieldName: field.fieldName, action: "restore_missing_field", status: "applied", evidence: { actorId: input.actorId, reason: input.reason, rule: "target_empty_source_nonempty" }, beforeValue: field.beforeValue, afterValue: field.afterValue });
      }
      await insertRecoveryItem(connection, runId, { sourceKind: "manual_selection", sourceBrandId: input.sourceBrandId, targetBrandId: input.targetBrandId, tableName: "brands", recordId: String(input.sourceBrandId), fieldName: "deletedAt", action: "soft_delete_source", status: "applied", evidence: { actorId: input.actorId, reason: input.reason }, beforeValue: null, afterValue: "CURRENT_TIMESTAMP" });
      await insertRecoveryItem(connection, runId, { sourceKind: "manual_selection", sourceBrandId: input.sourceBrandId, targetBrandId: input.targetBrandId, action: "merge_completed", status: "applied", evidence: { actorId: input.actorId, reason: input.reason, planHash } });
      await connection.execute("UPDATE brand_data_recovery_runs SET status='committed_pending_post_backup',appliedItems=?,conflictItems=0 WHERE id=?", [changes.reduce((sum, change) => sum + Math.max(change.recordIds.length, 1), 0) + restoredFields.length + 1, runId]);
      await connection.commit();
      committed = true;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    const postBackupId = await verifiedBackup(connection, POST_BACKUP_REASON);
    const conflictItems = changes.filter(change => change.remaining > 0).length;
    const appliedItems = changes.reduce((sum, change) => sum + Math.max(change.recordIds.length, 1), 0) + restoredFields.length + 1;
    await connection.execute("UPDATE brand_data_recovery_runs SET status='success',preBackupId=?,postBackupId=?,appliedItems=?,conflictItems=?,completedAt=CURRENT_TIMESTAMP WHERE id=?",
      [preBackupId, postBackupId, appliedItems, conflictItems, runId]);
    return { success: true, runId, appliedItems, conflictItems, movedTables: changes, restoredFields: restoredFields.map(field => field.fieldName), sourceName: String(source!.name), targetName: String(target!.name) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) await connection.execute(
      `UPDATE brand_data_recovery_runs SET status=?,errorMessage=?,completedAt=${committed ? "NULL" : "CURRENT_TIMESTAMP"} WHERE id=?`,
      [committed ? "committed_pending_post_backup" : "failed", message.slice(0, 4000), runId],
    ).catch(() => undefined);
    throw error;
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_KEY]).catch(() => undefined);
    await connection.end();
  }
}

export async function getBrandDataIntegrityHealth() {
  await ensureBrandDataIntegrityReady();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for brand data health");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [counts] = await connection.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM brands WHERE deletedAt IS NULL) AS activeBrands,
        (SELECT COUNT(*) FROM brands WHERE deletedAt IS NULL AND larkRecordId IS NOT NULL) AS larkLinkedBrands,
        (SELECT COUNT(*) FROM brand_livestreams WHERE deletedAt IS NULL) AS activeLivestreams,
        (SELECT COUNT(*) FROM brand_livestreams WHERE deletedAt IS NULL AND salesAmount IS NOT NULL AND (gmv IS NULL OR gmv=0)) AS salesOnlyLivestreams,
        (SELECT COUNT(*) FROM brand_livestreams WHERE deletedAt IS NULL AND gmv IS NOT NULL AND (salesAmount IS NULL OR salesAmount=0)) AS gmvOnlyLivestreams,
        (SELECT COUNT(*) FROM brand_livestreams WHERE deletedAt IS NULL AND salesAmount>0 AND gmv>0 AND salesAmount<>gmv) AS conflictingLivestreams,
        (SELECT COALESCE(SUM(CASE WHEN manualSalesAmount>0 THEN manualSalesAmount WHEN salesAmount>0 THEN salesAmount WHEN gmv>0 THEN gmv ELSE 0 END),0) FROM brand_livestreams WHERE deletedAt IS NULL) AS legacyFactTotal,
        (SELECT COUNT(*) FROM brands source JOIN brands target ON target.larkRecordId=source.larkRecordId AND target.deletedAt IS NULL AND target.id<>source.id WHERE source.deletedAt IS NOT NULL AND source.larkRecordId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM brand_data_recovery_items completed WHERE completed.sourceBrandId=source.id AND completed.targetBrandId=target.id AND completed.action='merge_completed')) AS deletedLarkMergeCandidates,
        (SELECT COUNT(*) FROM brand_lark_source_snapshots) AS larkSnapshots,
        (SELECT COUNT(*) FROM brand_lark_field_changes WHERE action LIKE 'preserved_%') AS protectedFields,
        (SELECT COUNT(*) FROM brand_historical_gmv_records WHERE status='active' AND deletedAt IS NULL) AS historicalGmvRecords,
        (SELECT COUNT(*) FROM brand_historical_gmv_records WHERE sourceType='lark_reported_gmv' AND status='active' AND deletedAt IS NULL) AS larkHistoricalGmvRecords,
        (SELECT COUNT(*) FROM brand_historical_gmv_records WHERE sourceType='manual' AND status='active' AND deletedAt IS NULL) AS manualHistoricalGmvRecords,
        (SELECT COALESCE(SUM(CASE WHEN ledger.larkAmount IS NOT NULL THEN ledger.larkAmount ELSE ledger.manualAmount END),0)
           FROM (
             SELECT brandId,
               MAX(CASE WHEN sourceType='lark_reported_gmv' THEN amount ELSE NULL END) AS larkAmount,
               SUM(CASE WHEN sourceType='manual' THEN amount ELSE 0 END) AS manualAmount
             FROM brand_historical_gmv_records
             WHERE status='active' AND deletedAt IS NULL
             GROUP BY brandId
           ) ledger) AS historicalGmvTotal
    `);
    const [latestSyncRows] = await connection.query<RowDataPacket[]>("SELECT * FROM brand_lark_sync_runs ORDER BY id DESC LIMIT 1");
    const [latestRecoveryRows] = await connection.query<RowDataPacket[]>("SELECT id,mode,status,sourceBackupId,preBackupId,postBackupId,proposedItems,appliedItems,conflictItems,startedAt,completedAt,errorMessage FROM brand_data_recovery_runs ORDER BY id DESC LIMIT 1");
    const row = counts[0] || {};
    return {
      counts: {
        activeBrands: Number(row.activeBrands || 0),
        larkLinkedBrands: Number(row.larkLinkedBrands || 0),
        activeLivestreams: Number(row.activeLivestreams || 0),
        salesOnlyLivestreams: Number(row.salesOnlyLivestreams || 0),
        gmvOnlyLivestreams: Number(row.gmvOnlyLivestreams || 0),
        conflictingLivestreams: Number(row.conflictingLivestreams || 0),
        legacyFactTotal: Number(row.legacyFactTotal || 0),
        deletedLarkMergeCandidates: Number(row.deletedLarkMergeCandidates || 0),
        larkSnapshots: Number(row.larkSnapshots || 0),
        protectedFields: Number(row.protectedFields || 0),
        historicalGmvRecords: Number(row.historicalGmvRecords || 0),
        larkHistoricalGmvRecords: Number(row.larkHistoricalGmvRecords || 0),
        manualHistoricalGmvRecords: Number(row.manualHistoricalGmvRecords || 0),
        historicalGmvTotal: Number(row.historicalGmvTotal || 0),
      },
      latestSync: latestSyncRows[0] || null,
      latestRecovery: latestRecoveryRows[0] || null,
    };
  } finally {
    await connection.end();
  }
}
