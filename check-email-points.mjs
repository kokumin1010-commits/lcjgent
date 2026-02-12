import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [rows] = await conn.execute(`
    SELECT lpb.lineUserId as emailPointId, lpb.balance, lpb.totalEarned, lpb.totalUsed,
           lu.id as userId, lu.lineUserId as actualLineUserId, lu.email
    FROM line_point_balances lpb
    LEFT JOIN line_users lu ON lpb.lineUserId = CONCAT('email_', lu.id)
    WHERE lpb.lineUserId LIKE 'email_%' AND lpb.balance > 0
    ORDER BY lpb.balance DESC
  `);
  
  console.log('=== email_ balances with balance > 0 ===');
  console.log('Count:', rows.length);
  
  let needsMigration = 0;
  for (const r of rows) {
    const hasLineId = r.actualLineUserId !== null && r.actualLineUserId !== undefined;
    const isEmailPrefix = hasLineId && r.actualLineUserId.startsWith('email_');
    const linked = hasLineId && !isEmailPrefix ? 'LINE連携済み' : '未連携';
    console.log(`  ${r.emailPointId} | balance: ${r.balance} | ${linked} | lineUserId: ${r.actualLineUserId} | email: ${r.email}`);
    if (hasLineId && !isEmailPrefix) needsMigration++;
  }
  
  console.log(`\nLINE連携済みでマージが必要: ${needsMigration}件`);
  
  await conn.end();
}
main().catch(console.error);
