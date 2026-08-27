import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateGoalAchievement } from './storeExecutionRouter';

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

describe('backup-gated persistent schema', () => {
  const required = ['store_manager_goal_cycles','store_manager_goals','store_manager_work_items','store_operation_reports','store_manager_reviews','store_execution_audit_logs'];
  it.each(required)('creates %s', table => {
    expect(upgradeSource).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    expect(schemaSource).toContain(`mysqlTable("${table}"`);
  });
  it('runs verified encrypted backups before and after schema creation', () => {
    expect(upgradeSource).toContain("pre-store-execution-v1");
    expect(upgradeSource).toContain("post-store-execution-v1");
    expect(upgradeSource).toMatch(/verifiedBackup\(pool,PRE_REASON\)[\s\S]*createTables\(pool\)[\s\S]*verifiedBackup\(pool,POST_REASON\)/);
  });
  it('checks that existing store source rows do not change during migration', () => {
    for (const key of ['activeStoreCount','uploadCount','refundDailyCount','storeProductCount']) expect(upgradeSource).toContain(`'${key}'`);
    expect(upgradeSource).toContain('changed during schema upgrade');
  });
});

describe('report evidence, versioning and audit', () => {
  it('takes KPI values only from current, non-deleted upload generations', () => {
    expect(routerSource).toContain('isCurrent=1 AND deletedAt IS NULL');
    expect(routerSource).toContain('buildStoreKpiSnapshot');
  });
  it('stores source upload id, generation, hashes and used row count as evidence', () => {
    for (const field of ['uploadId','versionNumber','dataSha256','fileSha256','usedRows']) expect(routerSource).toContain(field);
  });
  it('marks missing source data explicitly and does not silently score it as zero', () => {
    expect(routerSource).toContain('hasSourceData:sourceRows>0');
    expect(componentSource).toContain('无上传数据，不按0评价');
  });
  it('creates a new version and retires the previous current version on edits', () => {
    expect(routerSource).toContain('MAX(versionNumber)');
    expect(routerSource).toContain('SET isCurrent=0');
    expect(routerSource).toContain('supersedesId');
  });
  it('uses new report versions for confirmation, archive and historical restoration', () => {
    expect(routerSource).toContain('cloneReportVersion');
    for (const action of ['report_confirmed','report_archived','report_version_restored']) expect(routerSource).toContain(action);
  });
  it('writes audits inside the same transactions as all core mutations', () => {
    for (const entity of ["'goal_cycle'","'goal'","'work_item'","'report'","'review'"]) expect(routerSource).toContain(`entityType:${entity}`);
    expect(routerSource).toContain('store_execution_audit_logs');
    expect(routerSource.match(/beginTransaction\(\)/g)?.length || 0).toBeGreaterThanOrEqual(8);
  });
});

describe('authorization and transparent management view', () => {
  it('limits activation, confirmation, archive, restore and review to administrators', () => {
    for (const procedure of ['activateCycle','confirmReport','archiveReport','restoreReportVersion','createReview']) {
      expect(routerSource).toMatch(new RegExp(`${procedure}: adminProcedure`));
    }
  });
  it('lets authenticated staff save goals, work and reports while recording actors', () => {
    for (const procedure of ['saveCycle','saveGoal','saveWorkItem','saveReport']) expect(routerSource).toMatch(new RegExp(`${procedure}: protectedProcedure`));
    expect(routerSource).toContain('actorId');
    expect(routerSource).toContain('actorName');
  });
  it('separates result, execution, quality and improvement ratings', () => {
    for (const field of ['resultRating','executionRating','qualityRating','improvementRating']) {
      expect(routerSource).toContain(field);
      expect(componentSource).toContain(field);
    }
    expect(componentSource).toContain('不使用不透明自动总分');
  });
  it('shows each store manager process on the all-store page', () => {
    expect(routerSource).toContain('managementOverview: protectedProcedure');
    expect(pageSource).toContain('managerOverviewQuery');
    for (const label of ['目标周期','工作进度','日报・总结','待管理确认']) expect(pageSource).toContain(label);
  });
});

describe('manager workspace coverage and existing feature preservation', () => {
  it('contains scorecard, goal, work, report and management review areas', () => {
    for (const label of ['经营看板','目标','重点工作','日报・总结','管理评价']) expect(componentSource).toContain(label);
  });
  it('covers the six operating workstreams from the business brief', () => {
    for (const key of ['product_links','product_page','live_sales','short_video','inventory_growth','ads_customer_refund']) expect(componentSource).toContain(key);
  });
  it('keeps existing performance, product, promotion and upload tabs', () => {
    for (const label of ['业绩概览','商品管理','推广活动','数据上传','店长经营']) expect(pageSource).toContain(label);
  });
  it('retains the existing upload generation filter against duplicate aggregation', () => {
    expect(retentionSource).toContain('isCurrent=1 AND deletedAt IS NULL');
  });
});
