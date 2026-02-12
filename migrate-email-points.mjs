import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // LINE連携済みでemail_残高が残っているユーザーを取得
  const [rows] = await conn.execute(`
    SELECT lpb.lineUserId as emailPointId, lpb.balance, lpb.totalEarned, lpb.totalUsed,
           lu.id as userId, lu.lineUserId as actualLineUserId
    FROM line_point_balances lpb
    JOIN line_users lu ON lpb.lineUserId = CONCAT('email_', lu.id)
    WHERE lpb.lineUserId LIKE 'email_%' 
      AND lpb.balance > 0 
      AND lu.lineUserId IS NOT NULL 
      AND lu.lineUserId NOT LIKE 'email_%'
  `);
  
  console.log(`マージが必要なユーザー: ${rows.length}件`);
  
  for (const r of rows) {
    const lineUserId = r.actualLineUserId;
    const emailPointId = r.emailPointId;
    
    console.log(`\nProcessing: ${emailPointId} -> ${lineUserId} (balance: ${r.balance})`);
    
    // Check if LINE userId balance exists
    const [lineBalances] = await conn.execute(
      'SELECT * FROM line_point_balances WHERE lineUserId = ?', [lineUserId]
    );
    
    if (lineBalances.length === 0) {
      // Create new balance record
      await conn.execute(
        'INSERT INTO line_point_balances (lineUserId, balance, totalEarned, totalUsed) VALUES (?, ?, ?, ?)',
        [lineUserId, 0, 0, 0]
      );
    }
    
    // Add email_ balance to LINE userId balance
    await conn.execute(
      'UPDATE line_point_balances SET balance = balance + ?, totalEarned = totalEarned + ?, totalUsed = totalUsed + ? WHERE lineUserId = ?',
      [r.balance, r.totalEarned, r.totalUsed, lineUserId]
    );
    
    // Zero out email_ balance
    await conn.execute(
      'UPDATE line_point_balances SET balance = 0, totalEarned = 0, totalUsed = 0 WHERE lineUserId = ?',
      [emailPointId]
    );
    
    // Migrate transactions
    await conn.execute(
      'UPDATE line_point_transactions SET lineUserId = ? WHERE lineUserId = ?',
      [lineUserId, emailPointId]
    );
    
    console.log(`  Merged: ${r.balance} pt from ${emailPointId} to ${lineUserId}`);
  }
  
  console.log('\nDone!');
  await conn.end();
}
main().catch(console.error);
