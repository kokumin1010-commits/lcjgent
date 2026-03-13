#!/usr/bin/env python3
"""
Analyze point balance discrepancies between line_point_balances and line_point_transactions.
Identifies users whose current balance doesn't match the sum of their transactions.
"""
import mysql.connector
import os
import re
from decimal import Decimal

url = os.environ['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', url)
u, p, h, port, db = m.groups()
conn = mysql.connector.connect(host=h, port=int(port), user=u, password=p, database=db, ssl_disabled=False, ssl_verify_cert=False)
cur = conn.cursor(dictionary=True)

# Calculate correct balance from transaction history and compare with current balance
cur.execute('''
SELECT 
  b.lineUserId,
  b.balance AS currentBalance,
  b.totalEarned AS currentTotalEarned,
  b.totalUsed AS currentTotalUsed,
  COALESCE(SUM(CASE WHEN t.type = 'earn' THEN t.amount ELSE 0 END), 0) AS calcTotalEarned,
  COALESCE(SUM(CASE WHEN t.type = 'use' THEN ABS(t.amount) ELSE 0 END), 0) AS calcTotalUsed,
  COALESCE(SUM(CASE WHEN t.type = 'expire' THEN t.amount ELSE 0 END), 0) AS calcTotalExpired,
  COALESCE(SUM(CASE WHEN t.type = 'refund' THEN t.amount ELSE 0 END), 0) AS calcTotalRefund,
  COALESCE(SUM(CASE WHEN t.type = 'adjustment' THEN t.amount ELSE 0 END), 0) AS calcTotalAdjustment,
  COALESCE(SUM(t.amount), 0) AS calcBalance
FROM line_point_balances b
LEFT JOIN line_point_transactions t ON b.lineUserId = t.lineUserId
GROUP BY b.lineUserId, b.balance, b.totalEarned, b.totalUsed
HAVING b.balance != COALESCE(SUM(t.amount), 0)
ORDER BY ABS(b.balance - COALESCE(SUM(t.amount), 0)) DESC
''')
rows = cur.fetchall()
print("=== 不整合ユーザー数: {} ===".format(len(rows)))

total_disc = 0
over_count = 0
under_count = 0
for i, r in enumerate(rows):
    cb = int(r['currentBalance'])
    cc = int(r['calcBalance'])
    diff = cb - cc
    total_disc += abs(diff)
    if diff > 0:
        over_count += 1
    else:
        under_count += 1
    if i < 30:
        uid = str(r['lineUserId'])[:25]
        print("  {:3d}. {:25s} current={:8d} correct={:8d} diff={:+8d}".format(i+1, uid, cb, cc, diff))

print("\n合計差異: {:,}pt ({}ユーザー)".format(total_disc, len(rows)))
print("  残高過多(current > correct): {}ユーザー".format(over_count))
print("  残高不足(current < correct): {}ユーザー".format(under_count))

# Total users
cur.execute('SELECT COUNT(*) as cnt FROM line_point_balances')
total = cur.fetchone()['cnt']
print("全ユーザー数: {}".format(total))
print("不整合率: {:.1f}%".format(len(rows)/total*100))

# Also check totalEarned and totalUsed discrepancies
cur.execute('''
SELECT 
  b.lineUserId,
  b.totalEarned AS currentTotalEarned,
  b.totalUsed AS currentTotalUsed,
  COALESCE(SUM(CASE WHEN t.type = 'earn' THEN t.amount ELSE 0 END), 0) AS calcTotalEarned,
  COALESCE(SUM(CASE WHEN t.type = 'use' THEN ABS(t.amount) ELSE 0 END), 0) AS calcTotalUsed
FROM line_point_balances b
LEFT JOIN line_point_transactions t ON b.lineUserId = t.lineUserId
GROUP BY b.lineUserId, b.totalEarned, b.totalUsed
HAVING b.totalEarned != COALESCE(SUM(CASE WHEN t.type = 'earn' THEN t.amount ELSE 0 END), 0)
   OR b.totalUsed != COALESCE(SUM(CASE WHEN t.type = 'use' THEN ABS(t.amount) ELSE 0 END), 0)
''')
te_rows = cur.fetchall()
print("\ntotalEarned/totalUsed不整合: {}ユーザー".format(len(te_rows)))

# Summary of discrepancy directions
print("\n=== 方向分析 ===")
print("  残高が多すぎる(ポイントが余分に付与): {}ユーザー".format(over_count))
print("  残高が少なすぎる(ポイントが消失): {}ユーザー".format(under_count))

cur.close()
conn.close()
