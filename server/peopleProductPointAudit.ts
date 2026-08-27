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
      ]),
    ]);
    return {capturedAt:new Date().toISOString(),people:{...people,identity:memberIdentity,links:staffLinks,memberLinks,hrLinkGaps},points:{line:linePoints,users:userPoints,evidenceGaps:pointEvidenceGaps},products:{...products,links:productLinks},business:{...ordersReceipts},inventory,columns,recoveryHealth};
  }),
});
