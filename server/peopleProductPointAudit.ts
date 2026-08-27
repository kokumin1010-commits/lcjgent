import { createHash, timingSafeEqual } from 'node:crypto';
import mysql from 'mysql2/promise';
import { z } from 'zod';
import { publicProcedure, router } from './_core/trpc';
import { getHr36DirectoryRecoveryHealth } from './hr36DirectoryRecovery';
import { getHrStaffArchiveHealth } from './hrStaffArchive';
import { getAccountBrandDataRecoveryHealth } from './accountBrandDataRecovery';
import { getReportsAccountsProductsRecoveryHealth } from './reportsAccountsProductsRecovery';
import { getSelectionProductDeepRecoveryHealth } from './selectionProductDeepRecovery';
import { getKgProductRecoveryHealth } from './kgProductRecovery';
import { getMallPointMemberRecoveryHealth } from './mallPointMemberRecovery';
import { getMallBusinessReferenceRecoveryHealth } from './mallBusinessReferenceRecovery';
import { getMemberIdentityStatistics } from './memberIdentityService';
import { readDatabaseBackupTables, runDatabaseBackup } from './databaseBackupScheduler';
import { getPointBalanceLinkRecoveryHealth, runPointBalanceLinkRecovery } from './pointBalanceLinkRecovery';

const EXPECTED_KEY_HASH='ce6638a374e22aeae0ae6af8e288d6a735f0cf6df1d8f171ab70ff38c5071aa3';
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
async function first(sql:string,params:any[]=[]){try{const [rows]=await pool().query(sql,params);return (rows as any[])[0]||{};}catch(error){return {queryError:error instanceof Error?error.message:String(error)};}}
async function safeHealth(name:string,fn:()=>Promise<any>){try{return {name,ok:true,data:await fn()};}catch(error){return {name,ok:false,error:error instanceof Error?error.message:String(error)};}}
const AUDIT_TABLES=['users','staff','report_staff','livers','line_users','line_receipts','mall_orders','mall_order_items','line_point_balances','line_point_transactions','point_balances','point_transactions','point_requests','mall_products','mall_product_variants','mall_brands','mall_categories','brand_products','product_master','receipt_products','selection_products'];
async function tableInventory(){
  const [rows]=await pool().query(`SELECT table_name AS tableName,table_rows AS approximateRows FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN (${AUDIT_TABLES.map(()=>'?').join(',')}) ORDER BY table_name`,AUDIT_TABLES);
  return rows as any[];
}
async function schemaColumns(){
  const [rows]=await pool().query(`SELECT table_name AS tableName,column_name AS columnName FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name IN (${AUDIT_TABLES.map(()=>'?').join(',')}) ORDER BY table_name,ordinal_position`,AUDIT_TABLES);
  return rows as any[];
}

export const peopleProductPointAuditRouter=router({
  executePointLinkRecovery:publicProcedure.input(z.object({key:z.string().min(1)})).mutation(async({input})=>{
    if(!verifyKey(input.key)) throw new Error('not found');
    await pool().execute(`UPDATE db_backup_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage='interrupted during superseded point recovery deployment' WHERE status='running' AND reason='pre-point-link-recovery-v1' AND startedAt<DATE_SUB(NOW(),INTERVAL 2 MINUTE)`);
    return runPointBalanceLinkRecovery();
  }),
  pointLinkStatus:publicProcedure.input(z.object({key:z.string().min(1)})).query(async({input})=>{
    if(!verifyKey(input.key)) throw new Error('not found');
    const [health,runs,audit,backups,core,orphanReceiptEvidence]=await Promise.all([
      safeHealth('pointBalanceLink',getPointBalanceLinkRecoveryHealth),
      pool().query(`SELECT id,recoveryKey,status,startedAt,completedAt,candidateCount,transferredMemberCount,transferredBalance,details,errorMessage FROM point_balance_link_recovery_runs ORDER BY id DESC LIMIT 5`).then(([rows])=>rows),
      pool().query(`SELECT COUNT(*) AS auditRows,COALESCE(SUM(transferredBalance),0) AS balance,COALESCE(SUM(transferredEarned),0) AS earned,COALESCE(SUM(transferredUsed),0) AS used,COALESCE(SUM(migratedTransactions),0) AS transactions FROM point_balance_link_recovery_audit`).then(([rows]:any)=>rows[0]),
      pool().query(`SELECT id,reason,status,startedAt,completedAt,tableCount,rowCount,errorMessage FROM db_backup_runs ORDER BY id DESC LIMIT 15`).then(([rows])=>rows),
      first(`SELECT
        (SELECT COUNT(*) FROM line_users) AS memberRows,
        (SELECT COUNT(*) FROM line_point_balances) AS pointBalanceRows,
        (SELECT COALESCE(SUM(balance),0) FROM line_point_balances) AS pointBalanceTotal,
        (SELECT COUNT(*) FROM line_point_balances WHERE balance<0) AS negativePointBalances,
        (SELECT COUNT(*) FROM line_point_balances pb LEFT JOIN line_users lu ON pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id) WHERE lu.id IS NULL) AS orphanPointBalances,
        (SELECT COUNT(*) FROM mall_products) AS mallProductRows,
        (SELECT COUNT(*) FROM mall_products WHERE status='active') AS activeProducts,
        (SELECT COUNT(*) FROM mall_products WHERE status='archived') AS archivedProducts,
        (SELECT COUNT(*) FROM mall_products WHERE status='active' AND stock>0) AS activeInStockProducts,
        (SELECT COUNT(*) FROM mall_products WHERE status='active' AND price>0) AS activePricedProducts,
        (SELECT COUNT(*) FROM mall_products WHERE status='active' AND ((imageUrl IS NOT NULL AND imageUrl<>'') OR JSON_LENGTH(COALESCE(imageUrls,JSON_ARRAY()))>0)) AS activeImagedProducts,
        (SELECT COUNT(*) FROM mall_orders mo LEFT JOIN line_users lu ON lu.id=mo.lineUserId WHERE lu.id IS NULL) AS orphanOrders,
        (SELECT COUNT(*) FROM line_receipts lr LEFT JOIN line_users lu ON lu.lineUserId=lr.lineUserId OR CONCAT('email_',lu.id)=lr.lineUserId WHERE lu.id IS NULL) AS orphanReceipts,
        (SELECT COUNT(*) FROM mall_order_items oi LEFT JOIN mall_products mp ON mp.id=oi.productId WHERE mp.id IS NULL) AS orphanOrderProducts`),
      pool().query(`SELECT lr.id,CASE WHEN lr.lineUserId LIKE 'U%' THEN 'line' WHEN lr.lineUserId LIKE 'email\\_%' THEN 'email' ELSE 'other' END AS identityType,SHA2(lr.lineUserId,256) AS identityHash,lr.status,lr.pointsAwarded,lr.createdAt FROM line_receipts lr LEFT JOIN line_users lu ON lu.lineUserId=lr.lineUserId OR CONCAT('email_',lu.id)=lr.lineUserId WHERE lu.id IS NULL ORDER BY lr.id`).then(([rows])=>rows),
    ]);
    return {health,runs,audit,backups,core,orphanReceiptEvidence};
  }),
  preRecoveryBackup:publicProcedure.input(z.object({key:z.string().min(1)})).mutation(async({input})=>{
    if(!verifyKey(input.key)) throw new Error('not found');
    const before=await first(`SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs`);
    await runDatabaseBackup('pre-point-product-recovery-v1',{force:true,waitForActive:true});
    const row=await first(`SELECT id,reason,status,tableCount,rowCount,encryptedBytes,checksum,completedAt,errorMessage FROM db_backup_runs WHERE id>? AND reason='pre-point-product-recovery-v1' ORDER BY id DESC LIMIT 1`,[Number(before.id||0)]);
    if(row.status!=='success') throw new Error(`verified backup failed: ${String(row.errorMessage||'missing success row')}`);
    return row;
  }),
  backupEvidence:publicProcedure.input(z.object({key:z.string().min(1)})).query(async({input})=>{
    if(!verifyKey(input.key)) throw new Error('not found');
    const runIds=[1,29,35,36,73,74,127];
    const summaries=[] as any[];
    for(const runId of runIds){
      const summary:any={runId};
      for(const tableName of ['line_users','line_point_balances','mall_products']){
        try{
          const backup=await readDatabaseBackupTables(runId,[tableName]);
          const rows=backup.tables[tableName]||[];
          summary.reason=backup.reason;
          summary.completedAt=backup.completedAt;
          if(tableName==='line_users') summary.members={rows:rows.length,lineIdentities:rows.filter(row=>String(row.lineUserId||'').startsWith('U')).length,emailIdentities:rows.filter(row=>Boolean(row.email)).length};
          if(tableName==='line_point_balances') summary.points={rows:rows.length,balance:rows.reduce((sum,row)=>sum+Number(row.balance||0),0),earned:rows.reduce((sum,row)=>sum+Number(row.totalEarned||0),0),used:rows.reduce((sum,row)=>sum+Number(row.totalUsed||0),0),negative:rows.filter(row=>Number(row.balance||0)<0).length};
          if(tableName==='mall_products') summary.products={rows:rows.length,active:rows.filter(row=>row.status==='active').length,archived:rows.filter(row=>row.status==='archived').length,positiveStock:rows.filter(row=>Number(row.stock||0)>0).length,activePositiveStock:rows.filter(row=>row.status==='active'&&Number(row.stock||0)>0).length,positivePrice:rows.filter(row=>Number(row.price||0)>0).length,withImage:rows.filter(row=>Boolean(row.imageUrl)||Array.isArray(row.imageUrls)&&row.imageUrls.length>0).length};
        }catch(error){summary[`${tableName}Error`]=error instanceof Error?error.message:String(error);}
      }
      summaries.push(summary);
    }
    const [duplicateRows]=await pool().query(`SELECT lu.id AS memberId,lpb.balance AS lineBalance,lpb.totalEarned AS lineEarned,lpb.totalUsed AS lineUsed,epb.balance AS emailBalance,epb.totalEarned AS emailEarned,epb.totalUsed AS emailUsed,(SELECT COUNT(*) FROM line_point_transactions tx WHERE tx.lineUserId=lu.lineUserId) AS lineTransactions,(SELECT COUNT(*) FROM line_point_transactions tx WHERE tx.lineUserId=CONCAT('email_',lu.id)) AS emailTransactions,(SELECT COUNT(*) FROM mall_point_member_recovery_audit a WHERE a.evidenceKey=lu.lineUserId) AS lineSnapshotEvidence,(SELECT COUNT(*) FROM mall_point_member_recovery_audit a WHERE a.evidenceKey=CONCAT('email_',lu.id)) AS emailSnapshotEvidence FROM line_users lu JOIN line_point_balances lpb ON lpb.lineUserId=lu.lineUserId JOIN line_point_balances epb ON epb.lineUserId=CONCAT('email_',lu.id) ORDER BY lu.id`);
    return {summaries,duplicateRows};
  }),
  candidates:publicProcedure.input(z.object({key:z.string().min(1)})).query(async({input})=>{
    if(!verifyKey(input.key)) throw new Error('not found');
    const [duplicateBalanceRows]=await pool().query(`SELECT COUNT(*) AS membersWithMultipleBalanceKeys,COALESCE(SUM(balanceCount-1),0) AS extraBalanceKeys,COALESCE(SUM(balanceTotal),0) AS affectedBalanceTotal,COALESCE(SUM(realLineBalance),0) AS realLineBalanceTotal,COALESCE(SUM(emailBalance),0) AS emailBalanceTotal,SUM(realLineBalance>0 AND emailBalance>0) AS bothPositive,SUM(realLineBalance=0 OR emailBalance=0) AS oneSideZero,SUM(realLineBalance=emailBalance AND realLineEarned=emailEarned AND realLineUsed=emailUsed) AS exactComponentDuplicates FROM (SELECT lu.id,COUNT(pb.id) AS balanceCount,SUM(pb.balance) AS balanceTotal,SUM(CASE WHEN pb.lineUserId=lu.lineUserId THEN pb.balance ELSE 0 END) AS realLineBalance,SUM(CASE WHEN pb.lineUserId=CONCAT('email_',lu.id) THEN pb.balance ELSE 0 END) AS emailBalance,SUM(CASE WHEN pb.lineUserId=lu.lineUserId THEN pb.totalEarned ELSE 0 END) AS realLineEarned,SUM(CASE WHEN pb.lineUserId=CONCAT('email_',lu.id) THEN pb.totalEarned ELSE 0 END) AS emailEarned,SUM(CASE WHEN pb.lineUserId=lu.lineUserId THEN pb.totalUsed ELSE 0 END) AS realLineUsed,SUM(CASE WHEN pb.lineUserId=CONCAT('email_',lu.id) THEN pb.totalUsed ELSE 0 END) AS emailUsed FROM line_users lu JOIN line_point_balances pb ON pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id) GROUP BY lu.id HAVING COUNT(pb.id)>1) duplicates`);
    const [productRows]=await pool().query(`SELECT mp.id AS mallProductId,mp.name,mp.status,mp.price AS mallPrice,mp.stock AS mallStock,CASE WHEN (mp.imageUrl IS NOT NULL AND mp.imageUrl<>'') OR JSON_LENGTH(COALESCE(mp.imageUrls,JSON_ARRAY()))>0 THEN 1 ELSE 0 END AS mallHasImage,
      sp.id AS selectionProductId,sp.status AS selectionStatus,sp.price AS selectionPrice,sp.stock AS selectionStock,CASE WHEN JSON_LENGTH(COALESCE(sp.images,JSON_ARRAY()))>0 THEN 1 ELSE 0 END AS selectionHasImage,
      bp.id AS brandProductId,COALESCE(bp.specialPrice,bp.listPrice) AS brandPrice,CASE WHEN JSON_LENGTH(COALESCE(bp.imageUrls,JSON_ARRAY()))>0 OR (bp.proposalImageUrl IS NOT NULL AND bp.proposalImageUrl<>'') THEN 1 ELSE 0 END AS brandHasImage,
      (SELECT COUNT(*) FROM mall_order_items oi WHERE oi.productId=mp.id) AS orderItemCount
      FROM mall_products mp
      LEFT JOIN selection_products sp ON sp.deletedAt IS NULL AND LOWER(TRIM(sp.productName))=LOWER(TRIM(mp.name))
      LEFT JOIN brand_products bp ON bp.deletedAt IS NULL AND LOWER(TRIM(bp.productName))=LOWER(TRIM(mp.name))
      WHERE mp.status='archived'
      ORDER BY (sp.price>0 AND sp.stock>0 AND JSON_LENGTH(COALESCE(sp.images,JSON_ARRAY()))>0) DESC,(COALESCE(bp.specialPrice,bp.listPrice)>0 AND (JSON_LENGTH(COALESCE(bp.imageUrls,JSON_ARRAY()))>0 OR bp.proposalImageUrl IS NOT NULL)) DESC,orderItemCount DESC,mp.id
      LIMIT 300`);
    const [backupRows]=await pool().query(`SELECT id,reason,status,startedAt,completedAt,tableCount,rowCount FROM db_backup_runs WHERE status='success' ORDER BY id`);
    const [selectionRows]=await pool().query(`SELECT id,productName,productNameCn,price,stock,status,images,description,brandId,categoryId,productLink FROM selection_products WHERE deletedAt IS NULL AND COALESCE(price,0)>0 AND COALESCE(stock,0)>0 AND JSON_LENGTH(COALESCE(images,JSON_ARRAY()))>0 ORDER BY id`);
    const [brandRows]=await pool().query(`SELECT id,productName,COALESCE(specialPrice,listPrice) AS price,imageUrls,proposalImageUrl,brandId,catchCopy,productDetails FROM brand_products WHERE deletedAt IS NULL AND COALESCE(specialPrice,listPrice,0)>0 AND (JSON_LENGTH(COALESCE(imageUrls,JSON_ARRAY()))>0 OR (proposalImageUrl IS NOT NULL AND proposalImageUrl<>'')) ORDER BY id`);
    const mapped=(productRows as any[]).map(row=>({...row,safeSelectionCandidate:Boolean(Number(row.selectionProductId)&&Number(row.selectionPrice)>0&&Number(row.selectionStock)>0&&Number(row.selectionHasImage)===1&&String(row.selectionStatus)!=='archived'),safeBrandCandidate:Boolean(Number(row.brandProductId)&&Number(row.brandPrice)>0&&Number(row.brandHasImage)===1)}));
    return {duplicatePointIdentities:(duplicateBalanceRows as any[])[0]||{},backupRuns:backupRows,products:{archivedRows:mapped.length,safeSelectionCandidates:mapped.filter(row=>row.safeSelectionCandidate).length,safeBrandCandidates:mapped.filter(row=>row.safeBrandCandidate).length,candidates:mapped.filter(row=>row.safeSelectionCandidate||row.safeBrandCandidate||Number(row.orderItemCount)>0),selectionSources:selectionRows,brandSources:brandRows}};
  }),
  snapshot:publicProcedure.input(z.object({key:z.string().min(1)})).query(async({input})=>{
    if(!verifyKey(input.key)) throw new Error('not found');
    const [memberIdentity,people,staffLinks,memberLinks,linePoints,userPoints,pointEvidenceGaps,hrLinkGaps,products,productLinks,ordersReceipts,inventory,columns,recoveryHealth]=await Promise.all([
      getMemberIdentityStatistics(),
      first(`SELECT
        (SELECT COUNT(*) FROM users) AS loginUsers,
        (SELECT COUNT(*) FROM users WHERE role='admin') AS adminUsers,
        (SELECT COUNT(*) FROM staff) AS staffRows,
        (SELECT COUNT(*) FROM staff WHERE isActive='active' AND archivedAt IS NULL) AS activeVisibleStaff,
        (SELECT COUNT(*) FROM staff WHERE archivedAt IS NOT NULL) AS archivedStaff,
        (SELECT COUNT(*) FROM report_staff) AS reportStaffRows,
        (SELECT COUNT(*) FROM livers) AS liverRows,
        (SELECT COUNT(*) FROM livers WHERE isActive=1) AS activeLivers,
        (SELECT COUNT(*) FROM line_users) AS memberRows,
        (SELECT COUNT(*) FROM line_users WHERE lineUserId IS NOT NULL AND lineUserId<>'' AND lineUserId NOT LIKE 'email\\_%') AS lineIdentityRows,
        (SELECT COUNT(*) FROM line_users WHERE email IS NOT NULL AND email<>'') AS emailIdentityRows,
        (SELECT COUNT(*) FROM line_users WHERE password IS NOT NULL AND password<>'') AS passwordReadyRows`),
      first(`SELECT
        SUM(CASE WHEN lu.staffId IS NOT NULL AND s.id IS NULL THEN 1 ELSE 0 END) AS orphanStaffLinks,
        SUM(CASE WHEN lu.liverId IS NOT NULL AND l.id IS NULL THEN 1 ELSE 0 END) AS orphanLiverLinks,
        SUM(CASE WHEN lu.brandId IS NOT NULL AND b.id IS NULL THEN 1 ELSE 0 END) AS orphanBrandLinks
        FROM line_users lu
        LEFT JOIN staff s ON s.id=lu.staffId
        LEFT JOIN livers l ON l.id=lu.liverId
        LEFT JOIN brands b ON b.id=lu.brandId`),
      first(`SELECT
        (SELECT COUNT(*) FROM mall_orders mo LEFT JOIN line_users lu ON lu.id=mo.lineUserId WHERE lu.id IS NULL) AS orphanOrders,
        (SELECT COUNT(*) FROM line_receipts lr LEFT JOIN line_users lu ON lu.lineUserId=lr.lineUserId OR CONCAT('email_',lu.id)=lr.lineUserId WHERE lu.id IS NULL) AS orphanReceipts,
        (SELECT COUNT(*) FROM point_exchanges pe LEFT JOIN line_users lu ON lu.id=pe.lineUserId WHERE lu.id IS NULL) AS orphanPointExchanges,
        (SELECT COUNT(*) FROM member_risk_restrictions mr LEFT JOIN line_users lu ON lu.id=mr.memberId WHERE lu.id IS NULL) AS orphanRiskRestrictions`),
      first(`SELECT
        COUNT(*) AS balanceRows,
        COALESCE(SUM(balance),0) AS balanceTotal,
        COALESCE(SUM(totalEarned),0) AS earnedTotal,
        COALESCE(SUM(totalUsed),0) AS usedTotal,
        SUM(balance<0) AS negativeBalances,
        SUM(totalEarned<0 OR totalUsed<0) AS negativeLifetimeComponents,
        SUM(balance>totalEarned) AS balanceAboveEarned,
        SUM(lu.id IS NULL) AS orphanBalanceKeys,
        SUM(lu.id IS NOT NULL) AS linkedBalanceKeys,
        SUM(tx.transactionCount IS NULL OR tx.transactionCount=0) AS balancesWithoutTransactions
        FROM line_point_balances pb
        LEFT JOIN line_users lu ON pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id)
        LEFT JOIN (SELECT lineUserId,COUNT(*) AS transactionCount FROM line_point_transactions GROUP BY lineUserId) tx ON tx.lineUserId=pb.lineUserId`),
      first(`SELECT
        (SELECT COUNT(*) FROM line_users lu LEFT JOIN line_point_balances pb ON pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id) WHERE pb.id IS NULL) AS membersWithoutBalance,
        (SELECT COUNT(*) FROM line_users lu LEFT JOIN line_point_balances pb ON pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id) WHERE pb.id IS NULL AND (EXISTS(SELECT 1 FROM mall_orders mo WHERE mo.lineUserId=lu.id) OR EXISTS(SELECT 1 FROM line_receipts lr WHERE lr.lineUserId=lu.lineUserId OR lr.lineUserId=CONCAT('email_',lu.id)))) AS activeHistoryMembersWithoutBalance,
        (SELECT COUNT(*) FROM line_point_transactions tx LEFT JOIN line_point_balances pb ON pb.lineUserId=tx.lineUserId WHERE pb.id IS NULL) AS transactionsWithoutBalance,
        (SELECT COUNT(*) FROM point_balances) AS balanceRows,
        (SELECT COALESCE(SUM(balance),0) FROM point_balances) AS balanceTotal,
        (SELECT COUNT(*) FROM point_balances pb LEFT JOIN users u ON u.id=pb.userId WHERE u.id IS NULL) AS orphanBalances,
        (SELECT COUNT(*) FROM point_transactions pt LEFT JOIN users u ON u.id=pt.userId WHERE u.id IS NULL) AS orphanTransactions,
        (SELECT COUNT(*) FROM point_balances WHERE balance<0) AS negativeBalances`),
      first(`SELECT
        COUNT(*) AS membersWithoutBalance,
        SUM(hasPositiveAward=1) AS membersWithPositiveReceiptAwards,
        SUM(hasPointOrder=1) AS membersWithPointOrders,
        SUM(hasPositiveAward=1 AND hasPointOrder=1) AS membersWithBothEvidence,
        COALESCE(SUM(receiptPointsAwarded),0) AS receiptPointsAwardedTotal,
        COALESCE(SUM(orderPointsUsed),0) AS orderPointsUsedTotal,
        COALESCE(SUM(GREATEST(receiptPointsAwarded-orderPointsUsed,0)),0) AS simpleUnexpiredUnknownUpperBound
        FROM (
          SELECT lu.id,
            COALESCE(receipts.receiptPointsAwarded,0) AS receiptPointsAwarded,
            COALESCE(orders.orderPointsUsed,0) AS orderPointsUsed,
            CASE WHEN COALESCE(receipts.receiptPointsAwarded,0)>0 THEN 1 ELSE 0 END AS hasPositiveAward,
            CASE WHEN COALESCE(orders.orderPointsUsed,0)>0 THEN 1 ELSE 0 END AS hasPointOrder
          FROM line_users lu
          LEFT JOIN line_point_balances pb ON pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id)
          LEFT JOIN (
            SELECT lineUserId,SUM(pointsAwarded) AS receiptPointsAwarded
            FROM line_receipts WHERE status='approved' AND COALESCE(pointsAwarded,0)>0 GROUP BY lineUserId
          ) receipts ON receipts.lineUserId=lu.lineUserId OR receipts.lineUserId=CONCAT('email_',lu.id)
          LEFT JOIN (
            SELECT lineUserId,SUM(pointsUsed) AS orderPointsUsed
            FROM mall_orders WHERE status NOT IN ('cancelled','refunded') AND COALESCE(pointsUsed,0)>0 GROUP BY lineUserId
          ) orders ON orders.lineUserId=lu.id
          WHERE pb.id IS NULL
        ) gaps`),
      first(`SELECT
        SUM(rs.id IS NULL) AS evidenceStaffWithoutReportLink,
        SUM(s.evidenceStatus='current_active' AND rs.id IS NULL) AS currentEvidenceWithoutReportLink,
        SUM(s.evidenceStatus<>'current_active' AND rs.id IS NULL) AS historicalEvidenceWithoutReportLink
        FROM staff s LEFT JOIN report_staff rs ON rs.linkedStaffId=s.id
        WHERE s.evidenceSource='hr-directory-v1-2026-08-25'`),
      first(`SELECT
        COUNT(*) AS mallProductRows,
        SUM(mp.status='active') AS activeProducts,
        SUM(mp.status='draft') AS draftProducts,
        SUM(mp.status='sold_out') AS soldOutProducts,
        SUM(mp.status='archived') AS archivedProducts,
        SUM(mp.price<=0) AS invalidPriceProducts,
        SUM(mp.stock<0) AS negativeStockProducts,
        SUM(mp.status='active' AND (mp.imageUrl IS NULL OR mp.imageUrl='') AND JSON_LENGTH(COALESCE(mp.imageUrls,JSON_ARRAY()))=0) AS activeMissingImages,
        SUM(mp.status='active' AND mp.stock<=0) AS activeZeroStock,
        (SELECT COUNT(*) FROM mall_product_variants v) AS variantRows,
        (SELECT COUNT(*) FROM mall_product_variants v WHERE v.isActive='yes') AS activeVariants,
        (SELECT COUNT(*) FROM brand_products bp) AS brandProductRows,
        (SELECT COUNT(*) FROM product_master pm) AS productMasterRows,
        (SELECT COUNT(*) FROM receipt_products rp) AS receiptProductRows
        FROM mall_products mp`),
      first(`SELECT
        (SELECT COUNT(*) FROM mall_product_variants v LEFT JOIN mall_products p ON p.id=v.productId WHERE p.id IS NULL) AS orphanVariants,
        (SELECT COUNT(*) FROM mall_products p LEFT JOIN mall_brands b ON b.id=p.brandId WHERE p.brandId IS NOT NULL AND b.id IS NULL) AS orphanMallBrands,
        (SELECT COUNT(*) FROM mall_products p LEFT JOIN mall_categories c ON c.id=p.categoryId WHERE p.categoryId IS NOT NULL AND c.id IS NULL) AS orphanMallCategories,
        (SELECT COUNT(*) FROM mall_order_items oi LEFT JOIN mall_products p ON p.id=oi.productId WHERE p.id IS NULL) AS orphanOrderProductRefs,
        (SELECT COUNT(*) FROM brand_product_images i LEFT JOIN brand_products p ON p.id=i.productId WHERE p.id IS NULL) AS orphanBrandProductImages,
        (SELECT COUNT(*) FROM product_links l LEFT JOIN brand_products p ON p.id=l.productId WHERE p.id IS NULL) AS orphanBrandProductLinks`),
      first(`SELECT
        (SELECT COUNT(*) FROM mall_orders) AS orderRows,
        (SELECT COUNT(*) FROM mall_order_items) AS orderItemRows,
        (SELECT COUNT(*) FROM line_receipts) AS receiptRows,
        (SELECT COUNT(*) FROM line_point_transactions) AS linePointTransactionRows,
        (SELECT COUNT(*) FROM point_requests) AS pointRequestRows,
        (SELECT COUNT(*) FROM mall_orders mo LEFT JOIN mall_order_items oi ON oi.orderId=mo.id WHERE oi.id IS NULL) AS ordersWithoutItems`),
      tableInventory(),
      schemaColumns(),
      Promise.all([
        safeHealth('hr36Directory',getHr36DirectoryRecoveryHealth),
        safeHealth('hrStaffArchive',getHrStaffArchiveHealth),
        safeHealth('accountBrand',getAccountBrandDataRecoveryHealth),
        safeHealth('reportsAccountsProducts',getReportsAccountsProductsRecoveryHealth),
        safeHealth('selectionProductDeep',getSelectionProductDeepRecoveryHealth),
        safeHealth('kgProduct',getKgProductRecoveryHealth),
        safeHealth('mallPointMember',getMallPointMemberRecoveryHealth),
        safeHealth('mallBusinessReference',getMallBusinessReferenceRecoveryHealth),
        safeHealth('pointBalanceLink',getPointBalanceLinkRecoveryHealth),
      ]),
    ]);
    return {capturedAt:new Date().toISOString(),people:{...people,identity:memberIdentity,links:staffLinks,memberLinks,hrLinkGaps},points:{line:linePoints,users:userPoints,evidenceGaps:pointEvidenceGaps},products:{...products,links:productLinks},business:{...ordersReceipts},inventory,columns,recoveryHealth};
  }),
});
