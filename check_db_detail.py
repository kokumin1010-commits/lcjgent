import os
import mysql.connector

# Connect to database
conn = mysql.connector.connect(
    host=os.environ.get('DATABASE_HOST', 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com'),
    port=int(os.environ.get('DATABASE_PORT', 4000)),
    user=os.environ.get('DATABASE_USER', ''),
    password=os.environ.get('DATABASE_PASSWORD', ''),
    database=os.environ.get('DATABASE_NAME', ''),
    ssl_ca='/etc/ssl/certs/ca-certificates.crt'
)

cursor = conn.cursor(dictionary=True)

# Query 8/30 and 8/31 data
query = """
SELECT id, livestreamDate, livestreamEndTime, streamerName, salesAmount, duration, viewerCount, likes, csvImported 
FROM brand_livestreams 
WHERE livestreamDate >= '2025-08-30' AND livestreamDate < '2025-09-01' 
ORDER BY livestreamDate
"""

cursor.execute(query)
rows = cursor.fetchall()

print(f"=== Found {len(rows)} records for 8/30-8/31 ===")
for row in rows:
    print(f"\nID: {row['id']}")
    print(f"  livestreamDate: {row['livestreamDate']}")
    print(f"  livestreamEndTime: {row['livestreamEndTime']}")
    print(f"  streamerName: {row['streamerName']}")
    print(f"  salesAmount: {row['salesAmount']}")
    print(f"  duration: {row['duration']} minutes")
    print(f"  viewerCount: {row['viewerCount']}")
    print(f"  likes: {row['likes']}")
    print(f"  csvImported: {row['csvImported']}")

cursor.close()
conn.close()
