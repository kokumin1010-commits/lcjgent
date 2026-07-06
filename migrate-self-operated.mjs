import 'dotenv/config';
import mysql from 'mysql2/promise';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const sql = `
    ALTER TABLE selection_products
    ADD COLUMN selfOperated TINYINT DEFAULT 0 COMMENT '自营标记 0=非自营 1=自营',
    ADD COLUMN purchasePrice VARCHAR(50) DEFAULT NULL COMMENT '进货价',
    ADD COLUMN shippingFee VARCHAR(50) DEFAULT NULL COMMENT '运费',
    ADD COLUMN platformFee VARCHAR(50) DEFAULT NULL COMMENT '平台手续费',
    ADD COLUMN totalCost VARCHAR(50) DEFAULT NULL COMMENT '成本价(进货价+运费+手续费)',
    ADD COLUMN deliveryTime VARCHAR(100) DEFAULT NULL COMMENT '发货时效'
  `;
  try {
    await connection.execute(sql);
    console.log('✅ Added self-operated columns to selection_products');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️ Columns already exist, skipping');
    } else {
      throw err;
    }
  }
  await connection.end();
}
main().catch(e => { console.error(e); process.exit(1); });
