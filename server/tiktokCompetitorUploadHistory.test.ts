import { describe, expect, it, vi } from 'vitest';
import {
  backfillCompetitorUploadHistory,
  createCompetitorUploadEvent,
  listCompetitorUploadHistory,
  updateCompetitorUploadEvent,
  updateCompetitorUploadEventsForDraft,
} from './tiktokCompetitorUploadHistory';

type Call = { sql: string; params: unknown[] };

function fakePool(selectRows: Record<string, unknown>[] = []) {
  const calls: Call[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (/^\s*INSERT INTO tiktok_competitor_upload_events/i.test(sql)) return [{ insertId: 42 }, []];
    if (/^\s*UPDATE tiktok_competitor_upload_events/i.test(sql)) return [{ affectedRows: 1 }, []];
    if (/^\s*INSERT IGNORE INTO tiktok_competitor_upload_events/i.test(sql)) return [{ affectedRows: 0 }, []];
    if (/^\s*SELECT id,reportDate,fileName/i.test(sql)) return [selectRows, []];
    return [[], []];
  });
  return { pool: { query } as any, calls, query };
}

describe('TikTok competitor per-file upload history', () => {
  it('creates one live event with the authenticated uploader before processing the file', async () => {
    const { pool, calls } = fakePool();
    const event = await createCompetitorUploadEvent(pool, {
      date: '2026-08-31',
      fileName: 'ranking.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      actor: { id: 17, name: 'Uploader A', email: 'uploader@example.invalid' },
    });

    expect(event.id).toBe(42);
    expect(event.attemptKey).toMatch(/^upload:/);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("'processing','live_attempt'");
    expect(calls[0].params).toEqual([
      event.attemptKey,
      '2026-08-31',
      'ranking.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      17,
      'Uploader A',
      'uploader@example.invalid',
    ]);
  });

  it('updates the same event with evidence counts and a terminal result', async () => {
    const { pool, calls } = fakePool();
    await updateCompetitorUploadEvent(pool, 42, {
      status: 'duplicate',
      fileSize: 1234,
      fileSha256: 'a'.repeat(64),
      snapshotId: 91,
      recognizedRows: 15,
      excludedRows: 2,
      shopCount: 5,
      productCount: 15,
      completed: true,
    });

    expect(calls[0].sql).toContain('completedAt=CASE WHEN ?=1');
    expect(calls[0].params).toContain('duplicate');
    expect(calls[0].params).toContain(91);
    expect(calls[0].params.at(-1)).toBe(42);
  });

  it('updates every event linked to a draft, including evidence backfills', async () => {
    const { pool, calls } = fakePool();
    await updateCompetitorUploadEventsForDraft(pool, 8, {
      status: 'committed',
      snapshotId: 33,
      completed: true,
    });
    expect(calls[0].sql).toContain('WHERE draftId=?');
    expect(calls[0].sql).not.toContain("sourceKind='live_attempt'");
    expect(calls[0].params).toEqual(['committed', 33, null, null, 1, 8]);
  });

  it('limits normal users to their own records and returns safe display fields only', async () => {
    const createdAt = new Date('2026-08-31T03:00:00.000Z');
    const { pool, calls } = fakePool([{
      id: 5,
      reportDate: '2026-08-31',
      fileName: 'shop-a.xlsx',
      mimeType: 'application/xlsx',
      fileSize: 2048,
      actorId: 17,
      actorName: 'Uploader A',
      status: 'committed',
      draftId: 8,
      snapshotId: 33,
      recognizedRows: 15,
      excludedRows: 0,
      shopCount: 5,
      productCount: 15,
      errorCode: null,
      errorMessage: null,
      sourceKind: 'live_attempt',
      createdAt,
      completedAt: createdAt,
      updatedAt: createdAt,
    }]);

    const rows = await listCompetitorUploadHistory(pool, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      actorId: 17,
      uploader: null,
      fileName: 'shop-a',
      status: 'committed',
      limit: 100,
    });

    const selectCall = calls.at(-1)!;
    expect(selectCall.sql).toContain('actorId=?');
    expect(selectCall.sql).not.toContain('actorEmail');
    expect(selectCall.params).toEqual(['2026-08-01', '2026-08-31', 17, '%shop-a%', 'committed', 100]);
    expect(rows).toEqual([expect.objectContaining({
      id: 5,
      reportDate: '2026-08-31',
      actorName: 'Uploader A',
      status: 'committed',
      snapshotId: 33,
      isRecoveredEvidence: false,
    })]);
  });

  it('backfills only uploader identities already stored in drafts, snapshots or sync logs', async () => {
    const { pool, calls } = fakePool();
    await backfillCompetitorUploadHistory(pool);
    const sql = calls.map(call => call.sql).join('\n');

    expect(calls).toHaveLength(3);
    expect(sql).toContain('d.createdById');
    expect(sql).toContain('d.createdByName');
    expect(sql).toContain('s.importedById');
    expect(sql).toContain('s.importedByName');
    expect(sql).toContain('l.actorId');
    expect(sql).toContain('l.actorName');
    expect(sql).toContain('旧记录未保存');
    expect(sql).not.toContain('assignedStaffName');
    expect(sql).not.toContain('staff_schedules');
  });
});
