import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

const [rows] = await connection.execute('SELECT id, name, email FROM livers ORDER BY id DESC');
console.log('Total livers:', rows.length);
console.log('Livers:');
rows.forEach(row => {
  console.log(`  ID: ${row.id}, Name: ${row.name}, Email: ${row.email}`);
});

// Check for duplicates
const nameCount = {};
rows.forEach(row => {
  nameCount[row.name] = (nameCount[row.name] || 0) + 1;
});

console.log('\nDuplicate names:');
Object.entries(nameCount).forEach(([name, count]) => {
  if (count > 1) {
    console.log(`  ${name}: ${count} times`);
  }
});

await connection.end();
