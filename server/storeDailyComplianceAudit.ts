import { createHash, timingSafeEqual } from 'node:crypto';
import mysql from 'mysql2/promise';
import { z } from 'zod';
import { publicProcedure, router } from './_core/trpc';
import { STORE_DAILY_REPORT_REQUIRED_FROM, calculateConsecutiveMissingDays, calculateDailyCompliance, currentJapanDate } from './storeExecutionRouter';

const EXPECTED_KEY_HASH='9049d4b9431837fe6af7639b3e99e1a3e9f3021dfe9e9ca7a2b82a007130525e';
let auditPool:mysql.Pool|undefined;

function pool(){
  if(!auditPool){
    const uri=process.env.DATABASE_URL;
    if(!uri) throw new Error('DATABASE_URL is not configured');
    auditPool=mysql.createPool({uri,connectionLimit:2,waitForConnections:true,queueLimit:20});
  }
  return auditPool;
}

function verifyKey(value:string){
  const actual=createHash('sha256').update(value).digest();
  const expected=Buffer.from(EXPECTED_KEY_HASH,'hex');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

export const storeDailyComplianceAuditRouter=router({
  snapshot:publicProcedure.input(z.object({key:z.string().min(1)})).query(async({input})=>{
    if(!verifyKey(input.key)) throw new Error('not found');
    const p=pool();
    const today=currentJapanDate();
    const [year,month]=today.split('-').map(Number);
    const [stores]=await p.query('SELECT id FROM managed_stores WHERE isActive=1 ORDER BY id');
    const rows=[] as any[];
    for(const store of stores as any[]){
      const [monthReports]=await p.query(`SELECT id,seriesKey,periodStart,status,versionNumber FROM store_operation_reports WHERE storeId=? AND reportType='daily' AND isCurrent=1 AND deletedAt IS NULL AND YEAR(periodStart)=? AND MONTH(periodStart)=? ORDER BY periodStart`,[store.id,year,month]);
      const [allReports]=await p.query(`SELECT periodStart,status FROM store_operation_reports WHERE storeId=? AND reportType='daily' AND isCurrent=1 AND deletedAt IS NULL AND periodStart>=? AND periodStart<? ORDER BY periodStart DESC`,[store.id,STORE_DAILY_REPORT_REQUIRED_FROM,today]);
      const compliance=calculateDailyCompliance({year,month,today,reports:monthReports as any[]});
      rows.push({storeId:Number(store.id),todayStatus:compliance.todayStatus,expectedDays:compliance.expectedDays,submittedDays:compliance.submittedDays,draftDays:compliance.draftDays,missingDays:compliance.missingDays,submissionRate:compliance.submissionRate,consecutiveMissingDays:calculateConsecutiveMissingDays({today,reports:allReports as any[]}),currentDailyReports:(monthReports as any[]).length});
    }
    const [counts]=await p.query(`SELECT
      (SELECT COUNT(*) FROM store_operation_reports WHERE reportType='daily') AS allDailyVersions,
      (SELECT COUNT(*) FROM store_operation_reports WHERE reportType='daily' AND isCurrent=1 AND deletedAt IS NULL) AS currentDailyReports,
      (SELECT COUNT(DISTINCT CONCAT(storeId,':',periodStart)) FROM store_operation_reports WHERE reportType='daily' AND isCurrent=1 AND deletedAt IS NULL) AS uniqueCurrentStoreDates,
      (SELECT COUNT(*) FROM store_execution_audit_logs WHERE action IN ('daily_check_in_submitted','daily_check_in_updated','daily_check_in_work_updated')) AS dailyAuditEvents,
      (SELECT COUNT(*) FROM store_data_uploads) AS uploadRows,
      (SELECT COUNT(*) FROM store_data_refund_daily) AS refundDailyRows`);
    return {capturedAt:new Date().toISOString(),today,requiredFrom:STORE_DAILY_REPORT_REQUIRED_FROM,stores:rows,counts:(counts as any[])[0]};
  }),
});
