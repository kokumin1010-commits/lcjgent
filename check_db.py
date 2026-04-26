import mysql.connector, os, re

# Read DATABASE_URL from .env
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL') and not line.startswith('#'):
            # Extract URL value
            if '"' in line:
                url = line.split('"')[1]
            else:
                url = line.split('=', 1)[1].strip()
            break

m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', url)
u, p, h, port, db = m.groups()
conn = mysql.connector.connect(host=h, port=int(port), user=u, password=p, database=db, ssl_disabled=False, ssl_verify_cert=False)
cur = conn.cursor(dictionary=True)

# Check brand_livestreams streamerName for Dr.Kozu, SHIHO, 三宅あゆみ
for name in ['Dr.Kozu', 'SHIHO', '三宅あゆみ']:
    cur.execute(f"SELECT COUNT(*) as cnt FROM brand_livestreams WHERE streamerName = %s AND deletedAt IS NULL", (name,))
    row = cur.fetchone()
    print(f"brand_livestreams for '{name}': {row['cnt']} records")

print("\n--- Distinct streamerNames (top 30) ---")
cur.execute("SELECT DISTINCT streamerName, COUNT(*) as cnt FROM brand_livestreams WHERE deletedAt IS NULL GROUP BY streamerName ORDER BY cnt DESC LIMIT 30")
for row in cur.fetchall():
    print(f"  {row['streamerName']}: {row['cnt']} records")

# Check livers table for these names
print("\n--- Livers table ---")
for name in ['Dr.Kozu', 'SHIHO', '三宅あゆみ', 'ryu', 'Ryu kyogoku']:
    cur.execute("SELECT id, name FROM livers WHERE name = %s", (name,))
    rows = cur.fetchall()
    print(f"  '{name}': {rows}")

# Check Ryu kyogoku's data specifically
print("\n--- Ryu kyogoku brand_livestreams ---")
cur.execute("SELECT COUNT(*) as cnt, SUM(salesAmount) as totalSales FROM brand_livestreams WHERE streamerName LIKE '%Ryu%' AND deletedAt IS NULL")
row = cur.fetchone()
print(f"  Records: {row['cnt']}, Total Sales: {row['totalSales']}")

cur.execute("SELECT DISTINCT streamerName FROM brand_livestreams WHERE streamerName LIKE '%Ryu%' AND deletedAt IS NULL")
for row in cur.fetchall():
    print(f"  streamerName: '{row['streamerName']}'")

cur.close()
conn.close()
