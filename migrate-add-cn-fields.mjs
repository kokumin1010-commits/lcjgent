import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  
  // Add productNameCn to selection_products
  try {
    await pool.query(`ALTER TABLE selection_products ADD COLUMN productNameCn VARCHAR(500) DEFAULT NULL AFTER productName`);
    console.log('✅ Added productNameCn to selection_products');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️ productNameCn already exists in selection_products');
    } else {
      throw e;
    }
  }
  
  // Add nameCn to selection_categories
  try {
    await pool.query(`ALTER TABLE selection_categories ADD COLUMN nameCn VARCHAR(100) DEFAULT NULL AFTER name`);
    console.log('✅ Added nameCn to selection_categories');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️ nameCn already exists in selection_categories');
    } else {
      throw e;
    }
  }
  
  await pool.end();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
