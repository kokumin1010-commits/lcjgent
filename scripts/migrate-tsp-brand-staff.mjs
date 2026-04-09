import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function migrate() {
  // Parse DATABASE_URL - handle TiDB Cloud format
  const raw = DATABASE_URL.split('?')[0];
  const url = new URL(raw);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });

  console.log('Connected to database');

  // Add brandId column
  try {
    await connection.execute(`ALTER TABLE tsp_contracts ADD COLUMN brandId INT NULL AFTER id`);
    console.log('Added brandId column');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('brandId column already exists, skipping');
    } else {
      throw e;
    }
  }

  // Add lcjStaffId column
  try {
    await connection.execute(`ALTER TABLE tsp_contracts ADD COLUMN lcjStaffId INT NULL AFTER brandId`);
    console.log('Added lcjStaffId column');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('lcjStaffId column already exists, skipping');
    } else {
      throw e;
    }
  }

  console.log('Migration completed successfully');
  await connection.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
