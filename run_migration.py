import mysql.connector
import re

conn = mysql.connector.connect(
    host='gateway03.us-east-1.prod.aws.tidbcloud.com',
    port=4000,
    user='ViCMbGRGvoSuVwV.root',
    password='yee376welv03EMyc1Vku',
    database='GgA9WvTBCZMf6mjyMMwACw',
    ssl_disabled=False,
    ssl_verify_cert=False,
    use_pure=True
)

cur = conn.cursor()

with open('drizzle/migrations/featured_products.sql', 'r') as f:
    sql = f.read()

# Split by semicolons, filter out comments and empty
statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]

for stmt in statements:
    try:
        cur.execute(stmt)
        conn.commit()
        print(f'OK: {stmt[:80].replace(chr(10), " ")}')
    except Exception as e:
        print(f'ERR: {str(e)[:100]}')

cur.close()
conn.close()
print('Migration done')
