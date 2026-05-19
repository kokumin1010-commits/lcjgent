#!/usr/bin/env python3
"""Check point history for user maki.o-_-o.619m.m@docomo.ne.jp"""
import mysql.connector
import os
import re
import json

# Read DATABASE_URL from .env file
with open('/tmp/lcjgent/.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL'):
            url = line.split('"')[1] if '"' in line else line.split('=', 1)[1].strip()
            break

m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', url)
u, p, h, port, db_name = m.groups()
conn = mysql.connector.connect(host=h, port=int(port), user=u, password=p, database=db_name, ssl_disabled=False, ssl_verify_cert=False)
cur = conn.cursor(dictionary=True)

# Find the user by email
email = "maki.o-_-o.619m.m@docomo.ne.jp"

# Check in line_users table (since this is likely a LINE user)
cur.execute("SELECT * FROM line_users WHERE email = %s", (email,))
line_user = cur.fetchone()
print(f"=== LINE User ===")
if line_user:
    print(json.dumps({k: str(v) for k, v in line_user.items()}, indent=2, ensure_ascii=False))
    line_user_id = line_user.get('lineUserId') or line_user.get('line_user_id')
else:
    print("Not found in line_users")
    # Try users table
    cur.execute("SELECT id, email, name, role FROM users WHERE email = %s", (email,))
    web_user = cur.fetchone()
    print(f"\n=== Web User ===")
    if web_user:
        print(json.dumps({k: str(v) for k, v in web_user.items()}, indent=2, ensure_ascii=False))
    else:
        print("Not found in users either")
        # Search with LIKE
        cur.execute("SELECT id, email, name FROM users WHERE email LIKE %s", (f"%maki%docomo%",))
        results = cur.fetchall()
        print(f"\n=== Fuzzy search results ===")
        for r in results:
            print(r)
        
        cur.execute("SELECT lineUserId, displayName, email FROM line_users WHERE email LIKE %s OR displayName LIKE %s", (f"%maki%", f"%maki%"))
        results = cur.fetchall()
        print(f"\n=== LINE fuzzy search results ===")
        for r in results:
            print(r)
    line_user_id = None

# If we found a LINE user, check their point transactions
if line_user:
    line_user_id = line_user.get('lineUserId')
    print(f"\n=== LINE Point Transactions for {line_user_id} ===")
    cur.execute("""
        SELECT id, type, amount, balanceAfter, referenceType, description, 
               expiresAt, expired, remainingAmount, createdAt
        FROM line_point_transactions 
        WHERE lineUserId = %s 
        ORDER BY createdAt DESC
        LIMIT 50
    """, (line_user_id,))
    txns = cur.fetchall()
    print(f"Total transactions: {len(txns)}")
    for t in txns:
        exp = t.get('expiresAt')
        created = t.get('createdAt')
        print(f"  [{t['createdAt']}] type={t['type']} amount={t['amount']} balance={t['balanceAfter']} "
              f"remaining={t['remainingAmount']} expired={t['expired']} expiresAt={exp} "
              f"desc={t.get('description', '')[:50]}")
    
    # Check point balance
    cur.execute("SELECT * FROM line_point_balances WHERE lineUserId = %s", (line_user_id,))
    balance = cur.fetchone()
    print(f"\n=== Current Balance ===")
    print(balance)

# Also check web user point transactions
cur.execute("SELECT id, email, name FROM users WHERE email = %s", (email,))
web_user = cur.fetchone()
if web_user:
    user_id = web_user['id']
    print(f"\n=== Web Point Transactions for user_id={user_id} ===")
    cur.execute("""
        SELECT id, type, amount, balanceAfter, referenceType, description, 
               expiresAt, expired, remainingAmount, createdAt
        FROM point_transactions 
        WHERE userId = %s 
        ORDER BY createdAt DESC
        LIMIT 50
    """, (user_id,))
    txns = cur.fetchall()
    print(f"Total transactions: {len(txns)}")
    for t in txns:
        print(f"  [{t['createdAt']}] type={t['type']} amount={t['amount']} balance={t['balanceAfter']} "
              f"remaining={t['remainingAmount']} expired={t['expired']} expiresAt={t.get('expiresAt')} "
              f"desc={t.get('description', '')[:50]}")
    
    cur.execute("SELECT * FROM point_balances WHERE userId = %s", (user_id,))
    balance = cur.fetchone()
    print(f"\n=== Current Web Balance ===")
    print(balance)

cur.close()
conn.close()
