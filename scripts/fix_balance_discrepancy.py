#!/usr/bin/env python3
"""
Fix point balance discrepancies in line_point_balances.
This script:
1. Migrates orphaned email_ transactions to their corresponding LINE user IDs
2. Recalculates all balances from transaction history
3. Updates line_point_balances with correct values

SAFETY: Creates a backup before making changes.
"""
import mysql.connector
import os
import re
import sys
import json
from datetime import datetime

DRY_RUN = "--dry-run" in sys.argv
if DRY_RUN:
    print("=== DRY RUN MODE (no changes will be made) ===\n")
else:
    print("=== LIVE MODE (changes WILL be applied) ===\n")

url = os.environ['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', url)
u, p, h, port, db = m.groups()
conn = mysql.connector.connect(host=h, port=int(port), user=u, password=p, database=db, ssl_disabled=False, ssl_verify_cert=False)
cur = conn.cursor(dictionary=True)

# ============================================================
# STEP 0: Backup current balances
# ============================================================
print("STEP 0: Backing up current balances...")
cur.execute('SELECT lineUserId, balance, totalEarned, totalUsed FROM line_point_balances')
backup = cur.fetchall()
backup_file = '/home/ubuntu/lcjgent/scripts/balance_backup_{}.json'.format(
    datetime.now().strftime('%Y%m%d_%H%M%S')
)
with open(backup_file, 'w') as f:
    json.dump([{k: int(v) if isinstance(v, int) else str(v) for k, v in row.items()} for row in backup], f, indent=2)
print("  Backed up {} records to {}".format(len(backup), backup_file))

# ============================================================
# STEP 1: Migrate orphaned email_ transactions to LINE user IDs
# ============================================================
print("\nSTEP 1: Migrating orphaned email_ transactions...")

# Find email_ users with balance=0 but remaining transactions
cur.execute('''
SELECT 
  b.lineUserId as emailId,
  COALESCE(SUM(t.amount), 0) as txSum,
  COUNT(t.id) as txCount
FROM line_point_balances b
JOIN line_point_transactions t ON b.lineUserId = t.lineUserId
WHERE b.lineUserId LIKE 'email_%' AND b.balance = 0
GROUP BY b.lineUserId
HAVING COALESCE(SUM(t.amount), 0) > 0
''')
orphaned = cur.fetchall()
print("  Found {} email_ users with orphaned transactions".format(len(orphaned)))

migrated_count = 0
migration_errors = []
for r in orphaned:
    email_id = r['emailId']
    num = email_id.replace('email_', '')
    
    # Find corresponding LINE user ID
    cur.execute('SELECT lineUserId FROM line_users WHERE id = %s', (num,))
    lu = cur.fetchone()
    if not lu or not lu['lineUserId'] or not lu['lineUserId'].startswith('U'):
        migration_errors.append("  SKIP: {} -> no LINE user found (id={})".format(email_id, num))
        continue
    
    line_id = lu['lineUserId']
    
    if not DRY_RUN:
        # Migrate transactions from email_ to LINE userId
        cur.execute(
            'UPDATE line_point_transactions SET lineUserId = %s WHERE lineUserId = %s',
            (line_id, email_id)
        )
        migrated_count += cur.rowcount
    else:
        cur.execute(
            'SELECT COUNT(*) as cnt FROM line_point_transactions WHERE lineUserId = %s',
            (email_id,)
        )
        cnt = cur.fetchone()['cnt']
        migrated_count += cnt
    
    print("  {} -> {} ({} transactions, {} pt)".format(
        email_id, line_id[:25], int(r['txCount']), int(r['txSum'])))

if migration_errors:
    print("\n  Migration errors:")
    for e in migration_errors:
        print(e)

if not DRY_RUN:
    conn.commit()
print("  Migrated {} transactions total".format(migrated_count))

# ============================================================
# STEP 2: Recalculate all balances from transaction history
# ============================================================
print("\nSTEP 2: Recalculating all balances from transaction history...")

# Get correct balances from transactions
cur.execute('''
SELECT 
  b.lineUserId,
  b.balance AS currentBalance,
  b.totalEarned AS currentTotalEarned,
  b.totalUsed AS currentTotalUsed,
  COALESCE(SUM(t.amount), 0) AS calcBalance,
  COALESCE(SUM(CASE WHEN t.type = 'earn' THEN t.amount ELSE 0 END), 0) AS calcTotalEarned,
  COALESCE(SUM(CASE WHEN t.type = 'use' THEN ABS(t.amount) ELSE 0 END), 0) AS calcTotalUsed
FROM line_point_balances b
LEFT JOIN line_point_transactions t ON b.lineUserId = t.lineUserId
GROUP BY b.lineUserId, b.balance, b.totalEarned, b.totalUsed
HAVING b.balance != COALESCE(SUM(t.amount), 0)
   OR b.totalEarned != COALESCE(SUM(CASE WHEN t.type = 'earn' THEN t.amount ELSE 0 END), 0)
   OR b.totalUsed != COALESCE(SUM(CASE WHEN t.type = 'use' THEN ABS(t.amount) ELSE 0 END), 0)
ORDER BY ABS(b.balance - COALESCE(SUM(t.amount), 0)) DESC
''')
mismatched = cur.fetchall()
print("  Found {} users with balance/totalEarned/totalUsed mismatch".format(len(mismatched)))

updated_count = 0
total_balance_diff = 0
for r in mismatched:
    cb = int(r['currentBalance'])
    cc = int(r['calcBalance'])
    ce = int(r['calcTotalEarned'])
    cu = int(r['calcTotalUsed'])
    diff = cb - cc
    total_balance_diff += abs(diff)
    
    if not DRY_RUN:
        cur.execute(
            'UPDATE line_point_balances SET balance = %s, totalEarned = %s, totalUsed = %s WHERE lineUserId = %s',
            (cc, ce, cu, r['lineUserId'])
        )
    updated_count += 1
    
    if updated_count <= 30:
        uid = str(r['lineUserId'])[:25]
        print("  {:3d}. {:25s} {:8d} -> {:8d} (diff={:+d})".format(
            updated_count, uid, cb, cc, diff))

if updated_count > 30:
    print("  ... and {} more users".format(updated_count - 30))

if not DRY_RUN:
    conn.commit()

print("\n  Updated {} users, total balance diff resolved: {:,}pt".format(updated_count, total_balance_diff))

# ============================================================
# STEP 3: Verify - check for remaining discrepancies
# ============================================================
print("\nSTEP 3: Verification...")
cur.execute('''
SELECT COUNT(*) as cnt
FROM line_point_balances b
LEFT JOIN (
  SELECT lineUserId, SUM(amount) as calcBalance
  FROM line_point_transactions
  GROUP BY lineUserId
) tx ON b.lineUserId = tx.lineUserId
WHERE b.balance != COALESCE(tx.calcBalance, 0)
''')
remaining = cur.fetchone()['cnt']
if DRY_RUN:
    print("  (Dry run - verification skipped)")
else:
    print("  Remaining discrepancies: {}".format(remaining))
    if remaining == 0:
        print("  ALL BALANCES ARE NOW CORRECT!")
    else:
        print("  WARNING: {} users still have discrepancies".format(remaining))

cur.close()
conn.close()

print("\nDone! Backup saved to: {}".format(backup_file))
