import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: false }
});

const [rows] = await connection.execute(
  'SELECT id, productName, imageUrls, proposalImageUrl FROM brand_products WHERE brandId = 120001 LIMIT 5'
);

console.log('Products with images:');
rows.forEach(row => {
  console.log('---');
  console.log('ID:', row.id);
  console.log('Name:', row.productName);
  console.log('imageUrls:', row.imageUrls);
  console.log('proposalImageUrl:', row.proposalImageUrl);
});

await connection.end();
