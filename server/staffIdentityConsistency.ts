import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

export const STAFF_IDENTITY_MERGE_CONFIRMATION = "MERGE_CONFIRMED_STAFF_IDENTITY";
export const CURRENT_STAFF_SQL = "isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL";

export type IdentityActor = { id: number; name: string };

type ReferenceDefinition = {
  key: string;
  table: string;
  column: string;
  extraWhere?: string;
};

const STAFF_REFERENCE_DEFINITIONS: ReferenceDefinition[] = [
  { key: "tasks", table: "tasks", column: "staffId" },
  { key: "taskStaff", table: "task_staff", column: "staffId" },
  { key: "users", table: "users", column: "staffId" },
  { key: "brandBusinessManager", table: "brands", column: "businessManagerId" },
  { key: "brandOperationsManager", table: "brands", column: "operationsManagerId" },
  { key: "brandLivestreamVerifier", table: "brand_livestreams", column: "verifiedByStaffId" },
  { key: "lineUsers", table: "line_users", column: "staffId" },
  { key: "recruitmentBrands", table: "recruitment_brands", column: "person_in_charge" },
  { key: "recruitmentFollowRecords", table: "recruitment_follow_records", column: "staff_id" },
  { key: "tspContracts", table: "tsp_contracts", column: "lcjStaffId" },
  { key: "managedStoreOperator", table: "managed_stores", column: "operatorId" },
  { key: "managedStoreOperator2", table: "managed_stores", column: "operator2Id" },
  { key: "issuesAssignee", table: "issues", column: "assigneeId" },
  { key: "issuesHelper", table: "issues", column: "helperId" },
  { key: "chatRoomMembers", table: "chat_room_members", column: "userId", extraWhere: "userType = 'staff'" },
  { key: "chatMessages", table: "chat_messages", column: "senderId", extraWhere: "senderType = 'staff'" },
  { key: "tiktokCompetitorReports", table: "tiktok_competitor_reports", column: "assignedStaffId" },
  { key: "staffSchedules", table: "staff_schedules", column: "staffId" },
  { key: "morningRecitations", table: "morning_principle_recitations", column: "staffId" },
  { key: "storeGoalCycles", table: "store_manager_goal_cycles", column: "managerStaffId" },
  { key: "storeWorkItems", table: "store_manager_work_items", column: "ownerStaffId" },
  { key: "influencerCreators", table: "influencer_bd_creators", column: "ownerStaffId" },
  { key: "influencerOutreach", table: "influencer_bd_outreach_logs", column: "staffId" },
  { key: "influencerAnalyses", table: "influencer_bd_ai_analyses", column: "scopeStaffId" },
];

const HOLDER_REFERENCE_DEFINITIONS: ReferenceDefinition[] = [
  { key: "coinHoldings", table: "lcj_coin_holdings", column: "holderId", extraWhere: "holderType = 'staff'" },
  { key: "coinTransactions", table: "lcj_coin_transactions", column: "holderId", extraWhere: "holderType = 'staff'" },
  { key: "coinVestingSchedules", table: "lcj_coin_vesting_schedules", column: "holderId", extraWhere: "holderType = 'staff'" },
  { key: "coinBadgeAwards", table: "lcj_coin_badge_awards", column: "holderId", extraWhere: "holderType = 'staff'" },
  { key: "coinRankingHistory", table: "lcj_coin_ranking_history", column: "holderId", extraWhere: "holderType = 'staff'" },
  { key: "coinBuybackRequests", table: "lcj_coin_buyback_requests", column: "holderId", extraWhere: "holderType = 'staff'" },
  { key: "coinPeerBonusSender", table: "lcj_coin_peer_bonuses", column: "senderHolderId", extraWhere: "senderHolderType = 'staff'" },
  { key: "coinPeerBonusReceiver", table: "lcj_coin_peer_bonuses", column: "receiverHolderId", extraWhere: "receiverHolderType = 'staff'" },
];

const ALL_REFERENCE_DEFINITIONS = [...STAFF_REFERENCE_DEFINITIONS, ...HOLDER_REFERENCE_DEFINITIONS];

function qid(value: string): string {
  return `\`${value.replace(/`/g, "``")}\``;
}

export function normalizeStaffEmail(email: string): string {
  return email.normalize("NFKC").trim().toLowerCase();
}

export function buildStaffIdentityKey(email: string | null | undefined, emailEvidenceStatus?: string | null): string | null {
  const normalized = normalizeStaffEmail(String(email || ""));
  if (!normalized || !normalized.includes("@")) return null;
  if (normalized.endsWith("@lcj.placeholder")) return null;
  if (emailEvidenceStatus && emailEvidenceStatus !== "verified") return null;
  return `email:${normalized}`;
}

function normalizeName(name: unknown): string {
  return String(name || "").normalize("NFKC").trim().toLowerCase().replace(/[\s\-_.・·]+/g, "");
}

async function tableColumnExists(connection: PoolConnection | Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function countReference(
  connection: PoolConnection | Pool,
  definition: ReferenceDefinition,
  staffId: number,
): Promise<number> {
  if (!(await tableColumnExists(connection, definition.table, definition.column))) return 0;
  const where = `${qid(definition.column)} = ?${definition.extraWhere ? ` AND ${definition.extraWhere}` : ""}`;
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM ${qid(definition.table)} WHERE ${where}`,
    [staffId],
  );
  return Number(rows[0]?.count || 0);
}

async function getReferenceCounts(connection: PoolConnection | Pool, staffId: number): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const definition of ALL_REFERENCE_DEFINITIONS) {
    counts[definition.key] = await countReference(connection, definition, staffId);
  }
  counts.reportStaffLinks = await countReference(connection, { key: "reportStaffLinks", table: "report_staff", column: "linkedStaffId" }, staffId);
  return counts;
}

async function selectStaffForUpdate(connection: PoolConnection, staffId: number): Promise<RowDataPacket> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,name,email,emailEvidenceStatus,isActive,resignDate,resignReason,archivedAt,archivedBy,
            archiveReason,identityKey,mergedIntoStaffId,manualRevisionAt,manualRevisionBy,createdAt,updatedAt
       FROM staff WHERE id = ? LIMIT 1 FOR UPDATE`,
    [staffId],
  );
  if (!rows[0]) throw new Error(`staff not found: ${staffId}`);
  return rows[0];
}

function compactStaff(row: RowDataPacket): Record<string, unknown> {
  return {
    id: Number(row.id),
    name: String(row.name || ""),
    email: String(row.email || ""),
    emailEvidenceStatus: row.emailEvidenceStatus ? String(row.emailEvidenceStatus) : null,
    isActive: row.isActive ? String(row.isActive) : null,
    resignDate: row.resignDate ? new Date(row.resignDate).toISOString() : null,
    resignReason: row.resignReason ? String(row.resignReason) : null,
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    archivedBy: row.archivedBy === null || row.archivedBy === undefined ? null : Number(row.archivedBy),
    archiveReason: row.archiveReason ? String(row.archiveReason) : null,
    identityKey: row.identityKey ? String(row.identityKey) : null,
    mergedIntoStaffId: row.mergedIntoStaffId === null || row.mergedIntoStaffId === undefined ? null : Number(row.mergedIntoStaffId),
    manualRevisionAt: row.manualRevisionAt ? new Date(row.manualRevisionAt).toISOString() : null,
    manualRevisionBy: row.manualRevisionBy === null || row.manualRevisionBy === undefined ? null : Number(row.manualRevisionBy),
  };
}

async function writeManualMergeAudit(
  connection: PoolConnection,
  input: { entityId: number; before: RowDataPacket; after: RowDataPacket; actor: IdentityActor },
): Promise<void> {
  const before = compactStaff(input.before);
  const after = compactStaff(input.after);
  const changedFields = Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  await connection.execute(
    `INSERT INTO manual_data_change_events
      (entityType,entityId,action,changedFields,beforeJson,afterJson,actorId,actorName,source)
     VALUES ('staff',?,'merge',?,?,?,?,?,'identity-consistency')`,
    [
      input.entityId,
      JSON.stringify(changedFields),
      JSON.stringify(before),
      JSON.stringify(after),
      input.actor.id,
      input.actor.name.slice(0, 255),
    ],
  );
}

async function detectConflicts(
  connection: PoolConnection | Pool,
  canonicalStaffId: number,
  duplicateStaffId: number,
): Promise<string[]> {
  const conflicts: string[] = [];

  if (await tableColumnExists(connection, "staff_schedules", "staffId")) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT DATE(source.date) AS dateKey
         FROM staff_schedules source
         JOIN staff_schedules target ON target.staffId = ? AND DATE(target.date) = DATE(source.date)
        WHERE source.staffId = ? LIMIT 1`,
      [canonicalStaffId, duplicateStaffId],
    );
    if (rows[0]) conflicts.push(`staff_schedules:${String(rows[0].dateKey)}`);
  }

  if (await tableColumnExists(connection, "morning_principle_recitations", "staffId")) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT source.date AS dateKey
         FROM morning_principle_recitations source
         JOIN morning_principle_recitations target
           ON target.staffId = ? AND target.date = source.date AND target.recordingType = source.recordingType
        WHERE source.staffId = ? LIMIT 1`,
      [canonicalStaffId, duplicateStaffId],
    );
    if (rows[0]) conflicts.push(`morning_principle_recitations:${String(rows[0].dateKey)}`);
  }

  if (await tableColumnExists(connection, "users", "staffId")) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT staffId,COUNT(*) AS count FROM users WHERE staffId IN (?,?) GROUP BY staffId",
      [canonicalStaffId, duplicateStaffId],
    );
    const ids = new Set(rows.map((row) => Number(row.staffId)));
    if (ids.has(canonicalStaffId) && ids.has(duplicateStaffId)) conflicts.push("users:both-identities-have-accounts");
  }

  if (await tableColumnExists(connection, "lcj_coin_holdings", "holderId")) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT holderId,COUNT(*) AS count FROM lcj_coin_holdings WHERE holderType='staff' AND holderId IN (?,?) GROUP BY holderId",
      [canonicalStaffId, duplicateStaffId],
    );
    const ids = new Set(rows.map((row) => Number(row.holderId)));
    if (ids.has(canonicalStaffId) && ids.has(duplicateStaffId)) conflicts.push("lcj_coin_holdings:both-identities-have-holdings");
  }

  return conflicts;
}

export type StaffIdentityMergePreview = {
  canonical: Record<string, unknown>;
  duplicate: Record<string, unknown>;
  identityKey: string;
  referenceCounts: { canonical: Record<string, number>; duplicate: Record<string, number> };
  conflicts: string[];
  eligible: boolean;
};

export async function previewStaffIdentityMergeWithPool(
  pool: Pool,
  canonicalStaffId: number,
  duplicateStaffId: number,
): Promise<StaffIdentityMergePreview> {
  if (canonicalStaffId === duplicateStaffId) throw new Error("canonical and duplicate staff IDs must differ");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const canonical = await selectStaffForUpdate(connection, canonicalStaffId);
    const duplicate = await selectStaffForUpdate(connection, duplicateStaffId);
    const canonicalKey = buildStaffIdentityKey(canonical.email, canonical.emailEvidenceStatus);
    const duplicateKey = buildStaffIdentityKey(duplicate.email, duplicate.emailEvidenceStatus);
    if (!canonicalKey || canonicalKey !== duplicateKey) throw new Error("verified email identity does not match");
    if (normalizeName(canonical.name) !== normalizeName(duplicate.name)) throw new Error("normalized staff name does not match");
    if (canonical.mergedIntoStaffId) throw new Error("canonical staff is already merged");
    const alreadyMergedIntoCanonical = Number(duplicate.mergedIntoStaffId || 0) === canonicalStaffId;
    if (duplicate.mergedIntoStaffId && !alreadyMergedIntoCanonical) {
      throw new Error("duplicate staff is merged into a different canonical staff");
    }
    const [groupRows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM staff
        WHERE LOWER(TRIM(email)) = ? AND mergedIntoStaffId IS NULL AND archivedAt IS NULL`,
      [normalizeStaffEmail(String(canonical.email))],
    );
    const groupIds = groupRows.map((row) => Number(row.id)).sort((a, b) => a - b);
    const expectedIds = (alreadyMergedIntoCanonical ? [canonicalStaffId] : [canonicalStaffId, duplicateStaffId]).sort((a, b) => a - b);
    if (JSON.stringify(groupIds) !== JSON.stringify(expectedIds)) {
      throw new Error(`identity group is not exactly the requested pair: ${groupIds.join(",")}`);
    }
    const [canonicalReportRows] = await connection.query<RowDataPacket[]>("SELECT id FROM report_staff WHERE linkedStaffId=?", [canonicalStaffId]);
    const [duplicateReportRows] = await connection.query<RowDataPacket[]>("SELECT id FROM report_staff WHERE linkedStaffId=?", [duplicateStaffId]);
    if (canonicalReportRows.length !== 1) throw new Error("canonical staff must have exactly one report_staff link");
    if (duplicateReportRows.length !== 0) throw new Error("duplicate staff unexpectedly has a report_staff link");
    const referenceCounts = {
      canonical: await getReferenceCounts(connection, canonicalStaffId),
      duplicate: await getReferenceCounts(connection, duplicateStaffId),
    };
    const conflicts = await detectConflicts(connection, canonicalStaffId, duplicateStaffId);
    await connection.rollback();
    return {
      canonical: compactStaff(canonical),
      duplicate: compactStaff(duplicate),
      identityKey: canonicalKey,
      referenceCounts,
      conflicts,
      eligible: conflicts.length === 0,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateReference(
  connection: PoolConnection,
  definition: ReferenceDefinition,
  canonicalStaffId: number,
  duplicateStaffId: number,
): Promise<number> {
  if (!(await tableColumnExists(connection, definition.table, definition.column))) return 0;
  const where = `${qid(definition.column)} = ?${definition.extraWhere ? ` AND ${definition.extraWhere}` : ""}`;
  const [result] = await connection.execute<ResultSetHeader>(
    `UPDATE ${qid(definition.table)} SET ${qid(definition.column)} = ? WHERE ${where}`,
    [canonicalStaffId, duplicateStaffId],
  );
  return Number(result.affectedRows || 0);
}

async function mergeTaskStaffAssignments(
  connection: PoolConnection,
  canonicalStaffId: number,
  duplicateStaffId: number,
): Promise<{ moved: number; deduplicated: number }> {
  if (!(await tableColumnExists(connection, "task_staff", "staffId"))) return { moved: 0, deduplicated: 0 };
  const [deleteResult] = await connection.execute<ResultSetHeader>(
    `DELETE source FROM task_staff source
      JOIN task_staff target ON target.taskId=source.taskId AND target.staffId=?
     WHERE source.staffId=?`,
    [canonicalStaffId, duplicateStaffId],
  );
  const [updateResult] = await connection.execute<ResultSetHeader>(
    "UPDATE task_staff SET staffId=? WHERE staffId=?",
    [canonicalStaffId, duplicateStaffId],
  );
  return { moved: Number(updateResult.affectedRows || 0), deduplicated: Number(deleteResult.affectedRows || 0) };
}

async function mergeChatRoomMembers(
  connection: PoolConnection,
  canonicalStaffId: number,
  duplicateStaffId: number,
): Promise<{ moved: number; deduplicated: number }> {
  if (!(await tableColumnExists(connection, "chat_room_members", "userId"))) return { moved: 0, deduplicated: 0 };
  const [deleteResult] = await connection.execute<ResultSetHeader>(
    `DELETE source FROM chat_room_members source
      JOIN chat_room_members target
        ON target.roomId=source.roomId AND target.userId=? AND target.userType='staff'
     WHERE source.userId=? AND source.userType='staff'`,
    [canonicalStaffId, duplicateStaffId],
  );
  const [updateResult] = await connection.execute<ResultSetHeader>(
    "UPDATE chat_room_members SET userId=? WHERE userId=? AND userType='staff'",
    [canonicalStaffId, duplicateStaffId],
  );
  return { moved: Number(updateResult.affectedRows || 0), deduplicated: Number(deleteResult.affectedRows || 0) };
}

async function updateMorningTargets(connection: PoolConnection, canonicalStaffId: number, duplicateStaffId: number): Promise<number> {
  if (!(await tableColumnExists(connection, "morning_principle_recitations", "staffId"))) return 0;
  const [result] = await connection.execute<ResultSetHeader>(
    `UPDATE morning_principle_recitations
        SET staffId=?, targetKey=CASE WHEN targetKey=? THEN ? ELSE targetKey END
      WHERE staffId=?`,
    [canonicalStaffId, `staff:${duplicateStaffId}`, `staff:${canonicalStaffId}`, duplicateStaffId],
  );
  return Number(result.affectedRows || 0);
}

export async function mergeStaffIdentityWithPool(
  pool: Pool,
  input: {
    canonicalStaffId: number;
    duplicateStaffId: number;
    expectedIdentityKey: string;
    backupId: number;
    actor: IdentityActor;
  },
): Promise<{ merged: boolean; preview: StaffIdentityMergePreview; movedCounts: Record<string, number> }> {
  const preview = await previewStaffIdentityMergeWithPool(pool, input.canonicalStaffId, input.duplicateStaffId);
  if (preview.identityKey !== input.expectedIdentityKey) throw new Error("identity key changed since preview");
  if (!preview.eligible) throw new Error(`identity merge conflicts: ${preview.conflicts.join(",")}`);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const canonicalBefore = await selectStaffForUpdate(connection, input.canonicalStaffId);
    const duplicateBefore = await selectStaffForUpdate(connection, input.duplicateStaffId);
    if (Number(duplicateBefore.mergedIntoStaffId || 0) === input.canonicalStaffId) {
      await connection.commit();
      return { merged: false, preview, movedCounts: {} };
    }
    const key = buildStaffIdentityKey(canonicalBefore.email, canonicalBefore.emailEvidenceStatus);
    if (!key || key !== input.expectedIdentityKey || key !== buildStaffIdentityKey(duplicateBefore.email, duplicateBefore.emailEvidenceStatus)) {
      throw new Error("staff identity changed after preview");
    }
    if (normalizeName(canonicalBefore.name) !== normalizeName(duplicateBefore.name)) throw new Error("staff name changed after preview");
    const [backupRows] = await connection.query<RowDataPacket[]>(
      "SELECT id,status,reason,completedAt FROM db_backup_runs WHERE id=? LIMIT 1 FOR UPDATE",
      [input.backupId],
    );
    const backup = backupRows[0];
    const backupAgeMs = backup?.completedAt ? Date.now() - new Date(backup.completedAt).getTime() : Number.POSITIVE_INFINITY;
    if (
      !backup
      || String(backup.status) !== "success"
      || String(backup.reason) !== "pre-staff-identity-merge"
      || backupAgeMs < 0
      || backupAgeMs > 2 * 60 * 60 * 1000
    ) {
      throw new Error("a successful pre-staff-identity-merge backup from the last 2 hours is required");
    }
    const conflicts = await detectConflicts(connection, input.canonicalStaffId, input.duplicateStaffId);
    if (conflicts.length) throw new Error(`identity merge conflicts: ${conflicts.join(",")}`);

    const [eventResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO staff_identity_merge_events
        (canonicalStaffId,duplicateStaffId,identityKey,backupId,actorId,actorName,status,referenceCountsBefore)
       VALUES (?,?,?,?,?,?,'running',?)`,
      [
        input.canonicalStaffId,
        input.duplicateStaffId,
        key,
        input.backupId,
        input.actor.id,
        input.actor.name.slice(0, 255),
        JSON.stringify(preview.referenceCounts),
      ],
    );
    const eventId = Number(eventResult.insertId);
    const movedCounts: Record<string, number> = {};

    const taskStaffResult = await mergeTaskStaffAssignments(connection, input.canonicalStaffId, input.duplicateStaffId);
    movedCounts.taskStaff = taskStaffResult.moved;
    movedCounts.taskStaffDeduplicated = taskStaffResult.deduplicated;
    const chatMemberResult = await mergeChatRoomMembers(connection, input.canonicalStaffId, input.duplicateStaffId);
    movedCounts.chatRoomMembers = chatMemberResult.moved;
    movedCounts.chatRoomMembersDeduplicated = chatMemberResult.deduplicated;
    for (const definition of STAFF_REFERENCE_DEFINITIONS.filter((item) =>
      item.key !== "taskStaff" && item.key !== "morningRecitations" && item.key !== "chatRoomMembers"
    )) {
      movedCounts[definition.key] = await updateReference(connection, definition, input.canonicalStaffId, input.duplicateStaffId);
    }
    movedCounts.morningRecitations = await updateMorningTargets(connection, input.canonicalStaffId, input.duplicateStaffId);
    for (const definition of HOLDER_REFERENCE_DEFINITIONS) {
      movedCounts[definition.key] = await updateReference(connection, definition, input.canonicalStaffId, input.duplicateStaffId);
    }

    await connection.execute(
      `UPDATE staff SET identityKey=?, manualRevisionAt=CURRENT_TIMESTAMP, manualRevisionBy=? WHERE id=?`,
      [key, input.actor.id, input.canonicalStaffId],
    );
    await connection.execute(
      `UPDATE staff SET identityKey=NULL,mergedIntoStaffId=?,isActive='inactive',
         archivedAt=CURRENT_TIMESTAMP,archivedBy=?,archiveReason='重複HR主档を正規staffへ統合',
         manualRevisionAt=CURRENT_TIMESTAMP,manualRevisionBy=? WHERE id=?`,
      [input.canonicalStaffId, input.actor.id, input.actor.id, input.duplicateStaffId],
    );

    const canonicalAfter = await selectStaffForUpdate(connection, input.canonicalStaffId);
    const duplicateAfter = await selectStaffForUpdate(connection, input.duplicateStaffId);
    const duplicateReferencesAfter = await getReferenceCounts(connection, input.duplicateStaffId);
    const remainingReferences = Object.entries(duplicateReferencesAfter).filter(([keyName, count]) => keyName !== "reportStaffLinks" && count !== 0);
    if (remainingReferences.length) {
      throw new Error(`duplicate staff still has references: ${JSON.stringify(remainingReferences)}`);
    }
    await writeManualMergeAudit(connection, { entityId: input.canonicalStaffId, before: canonicalBefore, after: canonicalAfter, actor: input.actor });
    await writeManualMergeAudit(connection, { entityId: input.duplicateStaffId, before: duplicateBefore, after: duplicateAfter, actor: input.actor });
    await connection.execute(
      `UPDATE staff_identity_merge_events
          SET status='success',movedCounts=?,details=?,completedAt=CURRENT_TIMESTAMP,errorMessage=NULL
        WHERE id=?`,
      [
        JSON.stringify(movedCounts),
        JSON.stringify({ canonical: compactStaff(canonicalAfter), duplicate: compactStaff(duplicateAfter) }),
        eventId,
      ],
    );
    await connection.commit();
    return { merged: true, preview, movedCounts };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function ensureReportProfileForStaffWithPool(
  pool: Pool,
  input: { staffId: number; actor: IdentityActor },
): Promise<{ created: boolean; reportStaffId: number }> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const staffRow = await selectStaffForUpdate(connection, input.staffId);
    if (staffRow.mergedIntoStaffId) throw new Error(`staff is merged into:${staffRow.mergedIntoStaffId}`);
    if (staffRow.archivedAt || String(staffRow.isActive) !== "active") throw new Error("only current HR staff can receive a report profile");
    const [existingRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM report_staff WHERE linkedStaffId=? LIMIT 1 FOR UPDATE",
      [input.staffId],
    );
    if (existingRows[0]) {
      await connection.commit();
      return { created: false, reportStaffId: Number(existingRows[0].id) };
    }
    const [insertResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO report_staff
        (name,country,linkedStaffId,isActive,manualRevisionAt,manualRevisionBy)
       VALUES (?,?,?,'active',CURRENT_TIMESTAMP,?)`,
      [String(staffRow.name), String(staffRow.country || "未確認"), input.staffId, input.actor.id],
    );
    const reportStaffId = Number(insertResult.insertId);
    const [reportRows] = await connection.query<RowDataPacket[]>(
      `SELECT id,name,country,linkedStaffId,isActive,archivedAt,archivedBy,archiveReason,
              manualRevisionAt,manualRevisionBy,createdAt,updatedAt
         FROM report_staff WHERE id=? LIMIT 1`,
      [reportStaffId],
    );
    await connection.execute(
      `INSERT INTO manual_data_change_events
        (entityType,entityId,action,changedFields,beforeJson,afterJson,actorId,actorName,source)
       VALUES ('report_staff',?,'create',?,NULL,?,?,?,'identity-consistency')`,
      [
        reportStaffId,
        JSON.stringify(Object.keys(reportRows[0] || {})),
        JSON.stringify(reportRows[0] || {}),
        input.actor.id,
        input.actor.name.slice(0, 255),
      ],
    );
    await connection.commit();
    return { created: true, reportStaffId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function ensureReportProfileForStaff(input: { staffId: number; actor: IdentityActor }): Promise<{ created: boolean; reportStaffId: number }> {
  const pool = createPool();
  try {
    return await ensureReportProfileForStaffWithPool(pool, input);
  } finally {
    await pool.end();
  }
}

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  return mysql.createPool({ uri: databaseUrl, connectionLimit: 3, waitForConnections: true });
}

export async function previewStaffIdentityMerge(canonicalStaffId: number, duplicateStaffId: number): Promise<StaffIdentityMergePreview> {
  const pool = createPool();
  try {
    return await previewStaffIdentityMergeWithPool(pool, canonicalStaffId, duplicateStaffId);
  } finally {
    await pool.end();
  }
}

export async function mergeStaffIdentity(input: {
  canonicalStaffId: number;
  duplicateStaffId: number;
  expectedIdentityKey: string;
  backupId: number;
  actor: IdentityActor;
}): Promise<{ merged: boolean; preview: StaffIdentityMergePreview; movedCounts: Record<string, number> }> {
  const pool = createPool();
  try {
    return await mergeStaffIdentityWithPool(pool, input);
  } finally {
    await pool.end();
  }
}
