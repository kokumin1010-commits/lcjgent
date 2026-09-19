import mysql.connector
import os
import re
from urllib.parse import urlparse

database_url = os.environ.get('DATABASE_URL')
if not database_url:
    raise RuntimeError('DATABASE_URL is required')
parsed = urlparse(database_url)

conn = mysql.connector.connect(
    host=parsed.hostname,
    port=parsed.port or 3306,
    user=parsed.username,
    password=parsed.password,
    database=parsed.path.lstrip('/'),
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
