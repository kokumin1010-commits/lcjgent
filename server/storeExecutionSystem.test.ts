import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  STORE_DAILY_REPORT_REQUIRED_FROM,
  calculateConsecutiveMissingDays,
  calculateDailyCompliance,
  calculateGoalAchievement,
  currentJapanDate,
} from './storeExecutionRouter';

const routerSource = readFileSync(new URL('./storeExecutionRouter.ts', import.meta.url), 'utf8');
const upgradeSource = readFileSync(new URL('./storeExecutionUpgrade.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../client/src/pages/StoreManagement.tsx', import.meta.url), 'utf8');
const componentSource = readFileSync(new URL('../client/src/components/StoreManagerExecution.tsx', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../drizzle/schema.ts', import.meta.url), 'utf8');
const retentionSource = readFileSync(new URL('./storeManagementRouter.ts', import.meta.url), 'utf8');

describe('store manager goal achievement', () => {
  it('calculates increase goals without hiding over-achievement', () => {
    expect(calculateGoalAchievement('increase', 100, 50)).toBe(50);
    expect(calculateGoalAchievement('increase', 100, 120)).toBe(120);
  });
  it('treats decrease goals at or below target as achieved', () => {
    expect(calculateGoalAchievement('decrease', 5, 4)).toBe(100);
    expect(calculateGoalAchievement('decrease', 5, 10)).toBe(50);
  });
  it('calculates maintain goals by distance and never returns a negative rate', () => {
    expect(calculateGoalAchievement('maintain', 100, 90)).toBe(90);
    expect(calculateGoalAchievement('maintain', 10, 100)).toBe(0);
  });
  it('keeps unavailable actual values unavailable instead of treating them as zero', () => {
    expect(calculateGoalAchievement('increase', 100, null)).toBeNull();
  });
});

describe('daily report compliance', () => {
  it('uses Japan time for the reporting date', () => {
    expect(currentJapanDate(new Date('2026-08-27T14:59:59Z'))).toBe('2026-08-27');
    expect(currentJapanDate(new Date('2026-08-27T15:00:00Z'))).toBe('2026-08-28');
  });

  it('starts obligations only from the permanent launch date', () => {
    expect(STORE_DAILY_REPORT_REQUIRED_FROM).toBe('2026-08-27');
    const result = calculateDailyCompliance({year:2026,month:7,today:'2026-08-30',reports:[]});
    expect(result.expectedDays).toBe(0);
    expect(result.missingDays).toBe(0);
    expect(result.submissionRate).toBe(100);
    expect(result.todayStatus).toBe('not_required');
  });

  it('distinguishes submitted, confirmed, draft, missing and today pending', () => {
    const result = calculateDailyCompliance({
      year:2026,month:8,today:'2026-08-30',
      reports:[
        {periodStart:'2026-08-27',status:'submitted'},
        {periodStart:'2026-08-28',status:'draft'},
        {periodStart:'2026-08-29',status:'confirmed'},
      ],
    });
    expect(result.expectedDays).toBe(4);
    expect(result.submittedDays).toBe(2);
    expect(result.draftDays).toBe(1);
    expect(result.missingDays).toBe(1);
    expect(result.missingDates).toEqual(['2026-08-28']);
    expect(result.todayStatus).toBe('pending');
    expect(result.submissionRate).toBe(50);
    expect(result.calendar.map(day=>day.status)).toEqual(['submitted','draft','submitted','pending']);
  });

  it('does not count today as a past missing day before the deadline', () => {
    const result = calculateDailyCompliance({year:2026,month:8,today:'2026-08-27',reports:[]});
    expect(result.expectedDays).toBe(1);
    expect(result.missingDays).toBe(0);
    expect(result.todayStatus).toBe('pending');
    expect(result.nextDateToFill).toBe('2026-08-27');
  });

  it('calculates consecutive missing days across month boundaries', () => {
    expect(calculateConsecutiveMissingDays({today:'2026-09-02',reports:[{periodStart:'2026-08-30',status:'submitted'}]})).toBe(2);
    expect(calculateConsecutiveMissingDays({today:'2026-09-02',reports:[{periodStart:'2026-09-01',status:'confirmed'}]})).toBe(0);
  });

  it('prefers a formal submitted version over a draft for the same date', () => {
    const result = calculateDailyCompliance({year:2026,month:8,today:'2026-08-28',reports:[
      {periodStart:'2026-08-27',status:'draft'},
      {periodStart:'2026-08-27',status:'submitted'},
    ]});
    expect(result.missingDays).toBe(0);
    expect(result.submittedDays).toBe(1);
  });
});

describe('backup-gated persistent schema', () => {
  const required = ['store_manager_goal_cycles','store_manager_goals','store_manager_work_items','store_operation_reports','store_manager_reviews','store_execution_audit_logs'];
  it.each(required)('creates %s', table => {
    expect(upgradeSource).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    expect(schemaSource).toContain(`mysqlTable("${table}"`);
  });
  it('runs verified encrypted backups before and after schema creation', () => {
    expect(upgradeSource).toContain('pre-store-execution-v1');
    expect(upgradeSource).toContain('post-store-execution-v1');
    expect(upgradeSource).toMatch(/verifiedBackup\(pool,PRE_REASON\)[\s\S]*createTables\(pool\)[\s\S]*verifiedBackup\(pool,POST_REASON\)/);
  });
  it('checks that existing store source rows do not change during migration', () => {
    for (const key of ['activeStoreCount','uploadCount','refundDailyCount','storeProductCount']) expect(upgradeSource).toContain(`'${key}'`);
    expect(upgradeSource).toContain('changed during schema upgrade');
  });
});

describe('one-action daily check-in and audit', () => {
  it('exposes authenticated compliance and daily check-in procedures', () => {
    expect(routerSource).toMatch(/dailyCompliance: protectedProcedure/);
    expect(routerSource).toMatch(/dailyCheckIn: protectedProcedure/);
  });
  it('requires work, result and next plan in the one check-in request', () => {
    expect(routerSource).toContain("min(1,'请填写今天完成的工作')");
    expect(routerSource).toContain("min(1,'请填写今天的结果或成绩')");
    expect(routerSource).toContain("min(1,'请填写明天的计划')");
  });
  it('rejects future reports and dates before the launch boundary', () => {
    expect(routerSource).toContain("if(input.reportDate<STORE_DAILY_REPORT_REQUIRED_FROM)");
    expect(routerSource).toContain("if(input.reportDate>today)");
  });
  it('locks the existing current daily report for the same store and date', () => {
    expect(routerSource).toContain("storeId=? AND reportType='daily' AND periodStart=? AND isCurrent=1");
    expect(routerSource).toContain('FOR UPDATE');
    expect(routerSource).toContain('deterministicDailySeriesKey');
  });
  it('creates a new version instead of overwriting an existing daily report', () => {
    expect(routerSource).toContain('MAX(versionNumber)');
    expect(routerSource).toContain('UPDATE store_operation_reports SET isCurrent=0');
    expect(routerSource).toContain('supersedesId');
  });
  it('submits the report and task progress in one transaction', () => {
    expect(routerSource).toMatch(/dailyCheckIn:[\s\S]*beginTransaction\(\)[\s\S]*daily_check_in_work_updated[\s\S]*commit\(\)/);
    expect(routerSource).toContain("'daily',?,?,?,'submitted'");
  });
  it('stores source upload evidence and does not score missing data as zero', () => {
    for (const field of ['uploadId','versionNumber','dataSha256','fileSha256','usedRows']) expect(routerSource).toContain(field);
    expect(routerSource).toContain('hasSourceData:sourceRows>0');
    expect(componentSource).toContain('当天无日别数据，不按0评价');
  });
  it('writes report and task before/after audit events', () => {
    expect(routerSource).toContain("action:before?'daily_check_in_updated':'daily_check_in_submitted'");
    expect(routerSource).toContain("action:'daily_check_in_work_updated'");
    expect(routerSource).toContain('store_execution_audit_logs');
  });
});

describe('simplified manager experience', () => {
  it('shows one primary daily action and no old multi-tab operating navigation', () => {
    expect(componentSource).toContain('填写今天的店长日报');
    expect(componentSource).toContain('一次填写，下面全部一起提交');
    expect(componentSource).not.toContain('经营看板');
    expect(componentSource).not.toContain('保存草稿');
    expect(componentSource).not.toContain('写日报／总结');
  });
  it('shows today, submission rate, missing days and consecutive missing days', () => {
    for (const label of ['今天','本月填写率','本月未填写','连续未填写']) expect(componentSource).toContain(label);
  });
  it('renders a clickable monthly calendar and a report history list', () => {
    for (const label of ['每日填写记录','填写记录','旧版本永久保留','修改履历']) expect(componentSource).toContain(label);
  });
  it('keeps complete performance data in the performance overview instead of duplicating it', () => {
    expect(componentSource).toContain('完整数据请看上方「业绩概览」');
    expect(componentSource).not.toContain('STORE MANAGER OPERATING SYSTEM');
  });
  it('moves goals, work and reviews into secondary management settings', () => {
    expect(componentSource).toContain('<details');
    expect(componentSource).toContain('日常填写不需要操作这里');
    for (const label of ['目标周期','重点工作','管理评价']) expect(componentSource).toContain(label);
  });
  it('shows daily compliance on every store card', () => {
    expect(routerSource).toContain('managementOverview: protectedProcedure');
    expect(pageSource).toContain('managerOverviewQuery');
    for (const label of ['今天日报','本月填写率','连续']) expect(pageSource).toContain(label);
  });
});

describe('authorization and existing feature preservation', () => {
  it('limits activation, confirmation, archive, restore and review to administrators', () => {
    for (const procedure of ['activateCycle','confirmReport','archiveReport','restoreReportVersion','createReview']) expect(routerSource).toMatch(new RegExp(`${procedure}: adminProcedure`));
  });
  it('keeps goal and work administration available while daily check-in is the primary path', () => {
    for (const procedure of ['saveCycle','saveGoal','saveWorkItem','dailyCheckIn']) expect(routerSource).toMatch(new RegExp(`${procedure}: protectedProcedure`));
    for (const field of ['resultRating','executionRating','qualityRating','improvementRating']) expect(componentSource).toContain(field);
  });
  it('keeps all existing store management tabs', () => {
    for (const label of ['业绩概览','商品管理','推广活动','数据上传','店长经营']) expect(pageSource).toContain(label);
  });
  it('retains six business workstreams', () => {
    for (const key of ['product_links','product_page','live_sales','short_video','inventory_growth','ads_customer_refund']) expect(componentSource).toContain(key);
  });
  it('retains the current, non-deleted upload generation filter', () => {
    expect(retentionSource).toContain('isCurrent=1 AND deletedAt IS NULL');
  });
});
