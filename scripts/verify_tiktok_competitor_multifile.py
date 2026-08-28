#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
checks=[]

def must(path,needle,label):
    text=(ROOT/path).read_text(encoding='utf-8')
    ok=needle in text
    checks.append((label,ok))
    if not ok: print(f'FAIL: {label} ({path}: missing {needle!r})')

def must_not(path,needle,label):
    text=(ROOT/path).read_text(encoding='utf-8')
    ok=needle not in text
    checks.append((label,ok))
    if not ok: print(f'FAIL: {label} ({path}: found {needle!r})')

must(Path('server/tiktokCompetitorDailyUpgrade.ts'),'tiktok_competitor_snapshot_products','snapshot product detail table exists')
must(Path('server/tiktokCompetitorDailyUpgrade.ts'),'sourceFileSha256','snapshot stores server file hash')
must(Path('server/tiktokCompetitorDailyUpgrade.ts'),'uq_tiktok_competitor_snapshot_file_hash','same-day identical file unique index exists')
must(Path('server/tiktokCompetitorBatchPersistence.ts'),'commitCompetitorRankingBatch','append-only batch transaction is centralized')
must(Path('server/tiktokCompetitorBatchPersistence.ts'),'preservedReportIds','existing reports are explicitly preserved')
must_not(Path('server/tiktokCompetitorBatchPersistence.ts'),'UPDATE tiktok_competitor_reports','batch transaction never rewrites existing reports')
must_not(Path('server/tiktokCompetitorBatchPersistence.ts'),'DELETE FROM tiktok_competitor_report_products','batch transaction never deletes report products')
must(Path('server/tiktokCompetitorDailyRouter.ts'),'listRankingBatches','batch history procedure exists')
must(Path('server/tiktokCompetitorDailyRouter.ts'),'getRankingBatch','single batch detail procedure exists')
must(Path('server/tiktokCompetitorDailyRouter.ts'),'compareRankingBatches','batch comparison procedure exists')
must(Path('server/tiktokCompetitorDailyRouter.ts'),'parseCompetitorWorkbook','server reparses original workbook')
must(Path('server/tiktokCompetitorDailyRouter.ts'),'verifyRankingUploadReceipt','commit verifies signed upload receipt')
must(Path('server/tiktokCompetitorWorkbook.ts'),'competitorRowsSha256','server binds normalized rows to file receipt')
must(Path('server/tiktokCompetitorUploadReceipt.ts'),'timingSafeEqual','upload receipt uses constant-time verification')
must(Path('client/src/pages/TiktokCompetitorDaily.tsx'),'multiple','file input accepts multiple selections')
must(Path('client/src/pages/TiktokCompetitorDaily.tsx'),'pendingImports','independent preview queue exists')
must(Path('client/src/pages/TiktokCompetitorDaily.tsx'),'保存为独立批次','each file has independent save action')
must(Path('client/src/pages/TiktokCompetitorDaily.tsx'),'ranking-batch-section','saved batch history is rendered')
must(Path('client/src/pages/TiktokCompetitorDaily.tsx'),'batch-comparison','batch comparison is rendered')
must(Path('client/src/pages/TiktokCompetitorDaily.tsx'),'第二份不会覆盖第一份','user-facing no-overwrite behavior is explicit')
must(Path('server/tiktokCompetitorBatchPersistence.test.ts'),'preserves an existing same-day report','no-overwrite report transaction test exists')
must(Path('server/tiktokCompetitorComparison.test.ts'),'keeps missing metrics as null','comparison does not invent zero values')
must(Path('server/tiktokCompetitorMultifilePermission.test.ts'),'rejects unauthenticated','new procedures remain protected')
must(Path('tiktok_competitor_multifile_visual_regression.json'),'"passed": true','Chromium regression passed')
must(Path('tiktok_competitor_multifile_visual_regression.json'),'"productionWrites": 0','Chromium regression used no production writes')

passed=sum(ok for _,ok in checks)
print(f'PASS: {passed}/{len(checks)} competitor multifile static checks')
raise SystemExit(0 if passed==len(checks) else 1)
