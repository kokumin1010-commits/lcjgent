import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [indexes] = await conn.query('SHOW INDEX FROM festival_company_applications');
console.log('Indexes:', JSON.stringify(indexes.map(i => ({name: i.Key_name, col: i.Column_name, unique: i.Non_unique === 0})), null, 2));

// Also check auto_increment value
const [status] = await conn.query("SHOW TABLE STATUS LIKE 'festival_company_applications'");
console.log('Auto_increment:', status[0].Auto_increment);

await conn.end();
process.exit(0);
