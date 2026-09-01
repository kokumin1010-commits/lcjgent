import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

export const COMPETITOR_UPLOAD_STATUSES = [
  'processing',
  'draft_saved',
  'draft_recovered',
  'committed',
  'duplicate',
  'discarded',
  'rejected',
  'failed',
] as const;

export type CompetitorUploadStatus = (typeof COMPETITOR_UPLOAD_STATUSES)[number];

type Queryable = Pick<Pool, 'query'> | Pick<PoolConnection, 'query'>;

export type CompetitorUploadActor = {
  id: number;
  name: string;
  email?: string | null;
};

export type CompetitorUploadEventPatch = {
  status: CompetitorUploadStatus;
  fileSize?: number | null;
  fileSha256?: string | null;
  draftId?: number | null;
  snapshotId?: number | null;
  recognizedRows?: number | null;
  excludedRows?: number | null;
  shopCount?: number | null;
  productCount?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  completed?: boolean;
};

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}

function trimmedOrNull(value: unknown, max: number) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

export async function createCompetitorUploadEvent(queryable: Queryable, input: {
  date: string;
  fileName: string;
  mimeType?: string | null;
  actor: CompetitorUploadActor;
}) {
  const attemptKey = `upload:${randomUUID()}`;
  const [result] = await queryable.query(
    `INSERT INTO tiktok_competitor_upload_events
      (attemptKey,reportDate,market,fileName,mimeType,actorId,actorName,actorEmail,status,sourceKind)
     VALUES (?,?,'JP',?,?,?,?,?,'processing','live_attempt')`,
    [
      attemptKey,
      input.date,
      input.fileName.slice(0, 255),
      trimmedOrNull(input.mimeType, 150),
      input.actor.id,
      input.actor.name.slice(0, 255),
      trimmedOrNull(input.actor.email, 320),
    ],
  );
  const id = Number((result as { insertId?: number | bigint }).insertId || 0);
  if (!id) throw new Error('上传审计记录创建失败');
  return { id, attemptKey };
}

export async function updateCompetitorUploadEvent(
  queryable: Queryable,
  eventId: number,
  patch: CompetitorUploadEventPatch,
) {
  const [result] = await queryable.query(
    `UPDATE tiktok_competitor_upload_events
        SET status=?,
            fileSize=COALESCE(?,fileSize),
            fileSha256=COALESCE(?,fileSha256),
            draftId=COALESCE(?,draftId),
            snapshotId=COALESCE(?,snapshotId),
            recognizedRows=COALESCE(?,recognizedRows),
            excludedRows=COALESCE(?,excludedRows),
            shopCount=COALESCE(?,shopCount),
            productCount=COALESCE(?,productCount),
            errorCode=?,errorMessage=?,
            completedAt=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE completedAt END
      WHERE id=?`,
    [
      patch.status,
      patch.fileSize ?? null,
      patch.fileSha256 ?? null,
      patch.draftId ?? null,
      patch.snapshotId ?? null,
      patch.recognizedRows ?? null,
      patch.excludedRows ?? null,
      patch.shopCount ?? null,
      patch.productCount ?? null,
      trimmedOrNull(patch.errorCode, 100),
      trimmedOrNull(patch.errorMessage, 4000),
      patch.completed ? 1 : 0,
      eventId,
    ],
  );
  if (Number((result as { affectedRows?: number }).affectedRows || 0) !== 1) {
    throw new Error('上传审计记录更新失败');
  }
}

export async function updateCompetitorUploadEventsForDraft(
  queryable: Queryable,
  draftId: number,
  patch: CompetitorUploadEventPatch,
) {
  await queryable.query(
    `UPDATE tiktok_competitor_upload_events
        SET status=?,snapshotId=COALESCE(?,snapshotId),errorCode=?,errorMessage=?,
            completedAt=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE completedAt END
      WHERE draftId=?`,
    [
      patch.status,
      patch.snapshotId ?? null,
      trimmedOrNull(patch.errorCode, 100),
      trimmedOrNull(patch.errorMessage, 4000),
      patch.completed ? 1 : 0,
      draftId,
    ],
  );
}

export async function updateLatestCompetitorUploadEventByFile(queryable: Queryable, input: {
  date: string;
  actorId: number;
  fileSha256: string;
  patch: CompetitorUploadEventPatch;
}) {
  const [rows] = await queryable.query<RowDataPacket[]>(
    `SELECT id FROM tiktok_competitor_upload_events
      WHERE reportDate=? AND market='JP' AND actorId=? AND fileSha256=? AND sourceKind='live_attempt'
      ORDER BY id DESC LIMIT 1`,
    [input.date, input.actorId, input.fileSha256],
  );
  if (!rows[0]) return;
  await updateCompetitorUploadEvent(queryable, Number(rows[0].id), input.patch);
}

export async function backfillCompetitorUploadHistory(queryable: Queryable) {
  await queryable.query(
    `INSERT IGNORE INTO tiktok_competitor_upload_events
      (attemptKey,reportDate,market,fileName,fileSize,fileSha256,actorId,actorName,status,draftId,snapshotId,
       recognizedRows,excludedRows,shopCount,productCount,sourceKind,createdAt,completedAt,updatedAt)
     SELECT CONCAT('draft:',d.id),d.reportDate,d.market,d.fileName,d.fileSize,d.fileSha256,d.createdById,
            COALESCE(NULLIF(TRIM(d.createdByName),''),'旧记录未保存'),
            CASE d.status WHEN 'pending' THEN 'draft_saved' WHEN 'committing' THEN 'draft_saved'
              WHEN 'committed' THEN 'committed' WHEN 'discarded' THEN 'discarded' ELSE 'failed' END,
            d.id,d.committedSnapshotId,d.recognizedRows,d.excludedRows,d.shopCount,NULL,'draft_backfill',
            d.createdAt,CASE WHEN d.status IN ('committed','discarded','failed') THEN d.updatedAt ELSE NULL END,d.updatedAt
       FROM tiktok_competitor_import_drafts d
     ON DUPLICATE KEY UPDATE status=VALUES(status),snapshotId=VALUES(snapshotId),recognizedRows=VALUES(recognizedRows),
       excludedRows=VALUES(excludedRows),shopCount=VALUES(shopCount),errorMessage=VALUES(errorMessage),
       completedAt=VALUES(completedAt),updatedAt=VALUES(updatedAt)`,
  );
  await queryable.query(
    `INSERT IGNORE INTO tiktok_competitor_upload_events
      (attemptKey,reportDate,market,fileName,fileSize,fileSha256,actorId,actorName,status,snapshotId,
       recognizedRows,shopCount,productCount,sourceKind,createdAt,completedAt,updatedAt)
     SELECT CONCAT('snapshot:',s.id),s.snapshotDate,s.market,s.sourceFileName,s.sourceFileSize,s.sourceFileSha256,
            s.importedById,COALESCE(NULLIF(TRIM(s.importedByName),''),'旧记录未保存'),'committed',s.id,
            s.rowCount,s.shopCount,s.productCount,'snapshot_backfill',s.importedAt,s.importedAt,s.importedAt
       FROM tiktok_competitor_ranking_snapshots s
      WHERE s.status='success'
        AND NOT EXISTS (SELECT 1 FROM tiktok_competitor_import_drafts d WHERE d.committedSnapshotId=s.id)`,
  );
  await queryable.query(
    `INSERT IGNORE INTO tiktok_competitor_upload_events
      (attemptKey,reportDate,market,fileName,fileSize,fileSha256,actorId,actorName,status,snapshotId,
       recognizedRows,shopCount,productCount,errorCode,errorMessage,sourceKind,createdAt,completedAt,updatedAt)
     SELECT CONCAT('sync:',l.id),l.snapshotDate,l.market,l.sourceFileName,l.sourceFileSize,l.sourceFileSha256,
            l.actorId,COALESCE(NULLIF(TRIM(l.actorName),''),'旧记录未保存'),
            CASE l.status WHEN 'skipped' THEN 'duplicate' WHEN 'failed' THEN 'failed' ELSE 'failed' END,
            l.snapshotId,l.rowCount,l.shopCount,l.productCount,
            COALESCE(l.errorCode,CASE WHEN l.status='running' THEN 'LEGACY_INTERRUPTED' ELSE 'LEGACY_SYNC_FAILED' END),
            CASE WHEN l.status='running' THEN '旧同步记录未完成' ELSE '旧同步记录保存失败' END,
            'sync_backfill',l.startedAt,l.completedAt,COALESCE(l.completedAt,l.startedAt)
       FROM tiktok_competitor_sync_logs l
      WHERE l.status IN ('skipped','failed','running')
     ON DUPLICATE KEY UPDATE status=VALUES(status),snapshotId=VALUES(snapshotId),recognizedRows=VALUES(recognizedRows),
       shopCount=VALUES(shopCount),productCount=VALUES(productCount),errorCode=VALUES(errorCode),
       errorMessage=VALUES(errorMessage),completedAt=VALUES(completedAt),updatedAt=VALUES(updatedAt)`,
  );
}

export async function listCompetitorUploadHistory(queryable: Queryable, input: {
  startDate: string;
  endDate: string;
  actorId?: number | null;
  uploader?: string | null;
  fileName?: string | null;
  status?: CompetitorUploadStatus | null;
  limit: number;
}) {
  await backfillCompetitorUploadHistory(queryable);
  const where = ["reportDate BETWEEN ? AND ?", "market='JP'"];
  const params: unknown[] = [input.startDate, input.endDate];
  if (input.actorId) {
    where.push('actorId=?');
    params.push(input.actorId);
  }
  const uploader = String(input.uploader || '').trim();
  if (uploader) {
    where.push('LOWER(actorName) LIKE ?');
    params.push(`%${uploader.toLowerCase()}%`);
  }
  const fileName = String(input.fileName || '').trim();
  if (fileName) {
    where.push('LOWER(COALESCE(fileName,\'\')) LIKE ?');
    params.push(`%${fileName.toLowerCase()}%`);
  }
  if (input.status) {
    where.push('status=?');
    params.push(input.status);
  }
  params.push(input.limit);
  const [rows] = await queryable.query<RowDataPacket[]>(
    `SELECT id,reportDate,fileName,mimeType,fileSize,actorId,actorName,status,draftId,snapshotId,
            recognizedRows,excludedRows,shopCount,productCount,errorCode,errorMessage,sourceKind,
            createdAt,completedAt,updatedAt
       FROM tiktok_competitor_upload_events
      WHERE ${where.join(' AND ')}
      ORDER BY createdAt DESC,id DESC LIMIT ?`,
    params,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    reportDate: dateOnly(row.reportDate),
    fileName: row.fileName ? String(row.fileName) : null,
    mimeType: row.mimeType ? String(row.mimeType) : null,
    fileSize: nullableNumber(row.fileSize),
    actorId: nullableNumber(row.actorId),
    actorName: String(row.actorName || '旧记录未保存'),
    status: String(row.status) as CompetitorUploadStatus,
    draftId: nullableNumber(row.draftId),
    snapshotId: nullableNumber(row.snapshotId),
    recognizedRows: nullableNumber(row.recognizedRows),
    excludedRows: nullableNumber(row.excludedRows),
    shopCount: nullableNumber(row.shopCount),
    productCount: nullableNumber(row.productCount),
    errorCode: row.errorCode ? String(row.errorCode) : null,
    errorMessage: row.errorMessage ? String(row.errorMessage) : null,
    isRecoveredEvidence: String(row.sourceKind || '') !== 'live_attempt',
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt,
  }));
}
