import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routerSource = readFileSync(new URL('./tiktokCompetitorDailyRouter.ts', import.meta.url), 'utf8');
const upgradeSource = readFileSync(new URL('./tiktokCompetitorDailyUpgrade.ts', import.meta.url), 'utf8');
const historySource = readFileSync(new URL('./tiktokCompetitorUploadHistory.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../client/src/pages/TiktokCompetitorDaily.tsx', import.meta.url), 'utf8');

describe('TikTok competitor uploader history UI and contract', () => {
  it('creates a dedicated indexed per-attempt history table without storing file bytes', () => {
    expect(upgradeSource).toContain('CREATE TABLE IF NOT EXISTS tiktok_competitor_upload_events');
    expect(upgradeSource).toContain('UNIQUE KEY uq_tiktok_competitor_upload_attempt');
    expect(upgradeSource).toContain('INDEX idx_tiktok_competitor_upload_actor');
    expect(upgradeSource).toContain('INDEX idx_tiktok_competitor_upload_snapshot');
    expect(upgradeSource).not.toMatch(/tiktok_competitor_upload_events[\s\S]{0,1800}\b(BLOB|LONGBLOB|MEDIUMBLOB)\b/i);
  });

  it('records an authenticated server-side upload attempt before file parsing or duplicate return', () => {
    const uploadFlow = routerSource.slice(
      routerSource.indexOf('uploadRankingFile: protectedProcedure'),
      routerSource.indexOf('listImportDrafts: protectedProcedure'),
    );
    expect(uploadFlow).toContain('createCompetitorUploadEvent');
    expect(uploadFlow.indexOf('createCompetitorUploadEvent')).toBeLessThan(uploadFlow.indexOf("const extension = input.fileName"));
    expect(uploadFlow.indexOf('createCompetitorUploadEvent')).toBeLessThan(uploadFlow.indexOf('findDuplicateCompetitorBatch'));
    expect(uploadFlow).toContain("status:'duplicate'");
    expect(uploadFlow).toContain("status:'draft_recovered'");
    expect(uploadFlow).toContain("status:'draft_saved'");
    expect(uploadFlow).toContain("status,errorCode,errorMessage,completed:true");
  });

  it('updates upload attempts when a draft is committed, discarded or fails', () => {
    expect(routerSource).toContain("status:'discarded',completed:true");
    expect(routerSource).toContain("status:result.duplicate?'duplicate':'committed'");
    expect(routerSource).toContain("status:'failed',errorCode:'COMMIT_FAILED'");
  });

  it('offers protected cross-date history and restricts non-admin users to their own actor ID', () => {
    expect(routerSource).toContain('listUploadHistory: protectedProcedure');
    expect(routerSource).toContain('actorId:current.isAdmin?null:current.id');
    expect(routerSource).toContain('开始日期不能晚于结束日期');
    expect(historySource).toContain('LOWER(actorName) LIKE ?');
    expect(historySource).toContain('LOWER(COALESCE(fileName');
    expect(historySource).not.toMatch(/SELECT[\s\S]{0,300}actorEmail/i);
  });

  it('shows each file, actual uploader, time, result, counts and batch link separately from report history', () => {
    expect(pageSource).toContain('listUploadHistory.useQuery');
    expect(pageSource).toContain('data-testid="upload-history-section"');
    expect(pageSource).toContain('上传人不等于日报汇报人');
    expect(pageSource).toContain('文件 / 上传时间');
    expect(pageSource).toContain('识别内容');
    expect(pageSource).toContain('批次 #{record.snapshotId}');
    expect(pageSource).toContain('识别拒绝');
    expect(pageSource).toContain('保存失败');
    expect(pageSource).toContain('日报历史与追溯');
  });

  it('sends supported files to the server for authoritative parsing instead of losing client parse failures', () => {
    const uploadFlow = pageSource.slice(pageSource.indexOf('const handleFiles='), pageSource.indexOf('const confirmImport='));
    expect(uploadFlow).toContain('uploadRanking.mutateAsync');
    expect(uploadFlow).not.toContain('parseWorkbook');
    expect(uploadFlow).not.toContain('previewMutation');
  });

  it('stores only safe user-facing failure messages in upload history', () => {
    expect(routerSource).toContain("'上传或识别失败，请稍后重试'");
    expect(routerSource).toContain("'正式批次保存失败，草稿已保留，可稍后重试'");
    expect(historySource).toContain("'旧同步记录保存失败'");
    expect(historySource).not.toContain('l.errorMessage,');
  });

  it('backfills only evidence-backed uploader identities and labels missing old data explicitly', () => {
    expect(historySource).toContain('d.createdByName');
    expect(historySource).toContain('s.importedByName');
    expect(historySource).toContain('l.actorName');
    expect(historySource).toContain('旧记录未保存');
    expect(historySource).not.toContain('assignedStaffName');
    expect(pageSource).toContain('系统不会根据日报负责人猜测上传人');
  });
});
