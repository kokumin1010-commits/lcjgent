import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { runDatabaseBackup } from './databaseBackupScheduler';

const RECOVERY_KEY='point-balance-linked-account-recovery-v1';
const PRE_BACKUP_REASON='pre-point-link-recovery-v1';
const POST_BACKUP_REASON='post-point-product-recovery-v1';

type Totals={rows:number;balance:number;earned:number;used:number;negative:number;orphan:number};
type Candidate=RowDataPacket&{
  memberId:number;
  lineUserId:string;
  lineBalance:number;
  lineEarned:number;
  lineUsed:number;
  emailBalance:number;
  emailEarned:number;
  emailUsed:number;
  emailTransactions:number;
  lineEvidence:number;
  emailEvidence:number;
};

function createPool():Pool{
  const uri=process.env.DATABASE_URL;
  if(!uri) throw new Error('DATABASE_URL is required for point balance link recovery');
  return mysql.createPool({uri,connectionLimit:4,waitForConnections:true,queueLimit:20});
}
function jsonText(value:unknown){return JSON.stringify(value);}
export function mergePointComponents(line:{balance:number;earned:number;used:number},email:{balance:number;earned:number;used:number}){
  return {balance:line.balance+email.balance,earned:line.earned+email.earned,used:line.used+email.used};
}
async function ensureTables(pool:Pool){
  await pool.execute(`CREATE TABLE IF NOT EXISTS point_balance_link_recovery_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recoveryKey VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    candidateCount INT NOT NULL DEFAULT 0,
    transferredMemberCount INT NOT NULL DEFAULT 0,
    transferredBalance BIGINT NOT NULL DEFAULT 0,
    details JSON NULL,
    errorMessage TEXT NULL,
    UNIQUE KEY uq_point_balance_link_recovery_key (recoveryKey),
    KEY idx_point_balance_link_recovery_status (status,completedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS point_balance_link_recovery_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recoveryRunId BIGINT NOT NULL,
    memberId INT NOT NULL,
    action VARCHAR(40) NOT NULL,
    evidencePolicy VARCHAR(255) NOT NULL,
    beforeJson JSON NOT NULL,
    afterJson JSON NOT NULL,
    transferredBalance BIGINT NOT NULL DEFAULT 0,
    transferredEarned BIGINT NOT NULL DEFAULT 0,
    transferredUsed BIGINT NOT NULL DEFAULT 0,
    migratedTransactions INT NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_point_balance_link_member (memberId),
    KEY idx_point_balance_link_run (recoveryRunId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
async function latestBackupId(pool:Pool){const [rows]=await pool.query<RowDataPacket[]>('SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs');return Number(rows[0]?.id||0);}
async function runVerifiedBackup(pool:Pool,reason:string){
  const before=await latestBackupId(pool);
  await runDatabaseBackup(reason,{force:true,waitForActive:true});
  const [rows]=await pool.query<RowDataPacket[]>('SELECT id,status,errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1',[before,reason]);
  const row=rows[0];
  if(!row||row.status!=='success') throw new Error(`required database backup failed reason=${reason}: ${String(row?.errorMessage||'missing success row')}`);
  return Number(row.id);
}
async function totals(db:Pool|PoolConnection):Promise<Totals>{
  const [rows]=await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS balanceRows,COALESCE(SUM(pb.balance),0) AS balance,COALESCE(SUM(pb.totalEarned),0) AS earned,COALESCE(SUM(pb.totalUsed),0) AS used,SUM(pb.balance<0) AS negative,SUM(lu.id IS NULL) AS orphan FROM line_point_balances pb LEFT JOIN line_users lu ON pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id)`);
  const row=rows[0]||{};
  return {rows:Number(row.balanceRows||0),balance:Number(row.balance||0),earned:Number(row.earned||0),used:Number(row.used||0),negative:Number(row.negative||0),orphan:Number(row.orphan||0)};
}
async function candidates(db:Pool|PoolConnection):Promise<Candidate[]>{
  const sql=`SELECT lu.id AS memberId,lu.lineUserId,lpb.balance AS lineBalance,lpb.totalEarned AS lineEarned,lpb.totalUsed AS lineUsed,epb.balance AS emailBalance,epb.totalEarned AS emailEarned,epb.totalUsed AS emailUsed,(SELECT COUNT(*) FROM line_point_transactions tx WHERE tx.lineUserId=CONCAT('email_',lu.id)) AS emailTransactions,(SELECT COUNT(*) FROM mall_point_member_recovery_audit a WHERE a.evidenceKey=lu.lineUserId) AS lineEvidence,(SELECT COUNT(*) FROM mall_point_member_recovery_audit a WHERE a.evidenceKey=CONCAT('email_',lu.id)) AS emailEvidence FROM line_users lu JOIN line_point_balances lpb ON lpb.lineUserId=lu.lineUserId JOIN line_point_balances epb ON epb.lineUserId=CONCAT('email_',lu.id) WHERE lu.lineUserId LIKE 'U%' AND (epb.balance<>0 OR epb.totalEarned<>0 OR epb.totalUsed<>0 OR EXISTS(SELECT 1 FROM line_point_transactions tx WHERE tx.lineUserId=CONCAT('email_',lu.id))) ORDER BY lu.id`;
  const [rows]=await db.query<Candidate[]>(sql);
  return rows;
}
async function getRun(pool:Pool){const [rows]=await pool.query<RowDataPacket[]>('SELECT * FROM point_balance_link_recovery_runs WHERE recoveryKey=? LIMIT 1',[RECOVERY_KEY]);return rows[0]||null;}
export async function getPointBalanceLinkRecoveryHealth(){
  const pool=createPool();
  try{
    await ensureTables(pool);
    const [currentCandidates,currentTotals,run,auditRows]=await Promise.all([candidates(pool),totals(pool),getRun(pool),pool.query<RowDataPacket[]>('SELECT COUNT(*) AS count,COALESCE(SUM(transferredBalance),0) AS transferredBalance FROM point_balance_link_recovery_audit')]);
    const audit=(auditRows[0] as RowDataPacket[])[0]||{};
    return {healthy:currentCandidates.length===0&&currentTotals.negative===0&&currentTotals.orphan===0,recoveryKey:RECOVERY_KEY,pendingLinkedKeys:currentCandidates.length,totals:currentTotals,auditRows:Number(audit.count||0),auditedTransferredBalance:Number(audit.transferredBalance||0),latestRun:run};
  }finally{await pool.end();}
}
export async function runPointBalanceLinkRecovery(){
  const pool=createPool();
  let runId=0;
  try{
    await ensureTables(pool);
    const beforeCandidates=await candidates(pool);
    if(beforeCandidates.length===0){return {skipped:true,healthy:true,details:await getPointBalanceLinkRecoveryHealth()};}
    const preBackupId=await runVerifiedBackup(pool,PRE_BACKUP_REASON);
    const beforeTotals=await totals(pool);
    const [runResult]=await pool.execute<any>(`INSERT INTO point_balance_link_recovery_runs (recoveryKey,status,candidateCount,details) VALUES (?,'running',?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,candidateCount=VALUES(candidateCount),errorMessage=NULL,details=VALUES(details)`,[RECOVERY_KEY,beforeCandidates.length,jsonText({preBackupId,beforeTotals})]);
    runId=Number(runResult.insertId||0);
    const connection=await pool.getConnection();
    let transferredMemberCount=0;
    let transferredBalance=0;
    try{
      await connection.beginTransaction();
      const pending=await candidates(connection);
      for(const row of pending){
        const emailKey=`email_${Number(row.memberId)}`;
        const [lockedRows]=await connection.query<RowDataPacket[]>(`SELECT lineUserId,balance,totalEarned,totalUsed FROM line_point_balances WHERE lineUserId IN (?,?) FOR UPDATE`,[String(row.lineUserId),emailKey]);
        const lineLocked=lockedRows.find(item=>String(item.lineUserId)===String(row.lineUserId));
        const emailLocked=lockedRows.find(item=>String(item.lineUserId)===emailKey);
        if(!lineLocked||!emailLocked) throw new Error(`point balance changed while locking member=${Number(row.memberId)}`);
        const before={line:{balance:Number(lineLocked.balance),earned:Number(lineLocked.totalEarned),used:Number(lineLocked.totalUsed)},email:{balance:Number(emailLocked.balance),earned:Number(emailLocked.totalEarned),used:Number(emailLocked.totalUsed)},lineEvidence:Number(row.lineEvidence),emailEvidence:Number(row.emailEvidence)};
        await connection.execute(`UPDATE line_point_balances SET balance=balance+?,totalEarned=totalEarned+?,totalUsed=totalUsed+? WHERE lineUserId=?`,[before.email.balance,before.email.earned,before.email.used,String(row.lineUserId)]);
        await connection.execute(`UPDATE line_point_balances SET balance=0,totalEarned=0,totalUsed=0 WHERE lineUserId=?`,[emailKey]);
        const [txResult]=await connection.execute<any>('UPDATE line_point_transactions SET lineUserId=? WHERE lineUserId=?',[String(row.lineUserId),emailKey]);
        const merged=mergePointComponents(before.line,before.email);
        const after={line:merged,email:{balance:0,earned:0,used:0}};
        await connection.execute(`INSERT INTO point_balance_link_recovery_audit (recoveryRunId,memberId,action,evidencePolicy,beforeJson,afterJson,transferredBalance,transferredEarned,transferredUsed,migratedTransactions) VALUES (?,?,'merged_email_key_into_verified_line','Both keys preserved from 2026-03-13 snapshot; move, never duplicate',?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE recoveryRunId=VALUES(recoveryRunId),action=VALUES(action),beforeJson=VALUES(beforeJson),afterJson=VALUES(afterJson),transferredBalance=VALUES(transferredBalance),transferredEarned=VALUES(transferredEarned),transferredUsed=VALUES(transferredUsed),migratedTransactions=VALUES(migratedTransactions)`,[runId,Number(row.memberId),jsonText(before),jsonText(after),before.email.balance,before.email.earned,before.email.used,Number(txResult.affectedRows||0)]);
        transferredMemberCount+=1;
        transferredBalance+=before.email.balance;
      }
      await connection.commit();
    }catch(error){await connection.rollback();throw error;}finally{connection.release();}
    const afterTotals=await totals(pool);
    const afterCandidates=await candidates(pool);
    if(afterCandidates.length!==0) throw new Error(`linked point key recovery incomplete pending=${afterCandidates.length}`);
    if(beforeTotals.balance!==afterTotals.balance||beforeTotals.earned!==afterTotals.earned||beforeTotals.used!==afterTotals.used) throw new Error(`global point totals changed before=${jsonText(beforeTotals)} after=${jsonText(afterTotals)}`);
    if(afterTotals.negative!==0||afterTotals.orphan!==0) throw new Error(`invalid post recovery totals ${jsonText(afterTotals)}`);
    const postBackupId=await runVerifiedBackup(pool,POST_BACKUP_REASON);
    const details={preBackupId,postBackupId,beforeTotals,afterTotals,transferredMemberCount,transferredBalance,policy:'move existing evidence-backed components into verified LINE key; never mint points'};
    await pool.execute(`UPDATE point_balance_link_recovery_runs SET status='success',completedAt=CURRENT_TIMESTAMP,transferredMemberCount=?,transferredBalance=?,details=?,errorMessage=NULL WHERE id=?`,[transferredMemberCount,transferredBalance,jsonText(details),runId]);
    return {skipped:false,healthy:true,details};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    if(runId) await pool.execute(`UPDATE point_balance_link_recovery_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE id=?`,[message.slice(0,4000),runId]).catch(()=>undefined);
    throw error;
  }finally{await pool.end();}
}
