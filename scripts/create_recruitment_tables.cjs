/**
 * 招商管理テーブル作成スクリプト
 * recruitment_brands: 招商ブランド情報
 * recruitment_status_history: ステータス変更履歴
 */
const mysql = require('mysql2/promise');

async function main() {
  const url = process.env.DATABASE_URL;
  const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error('Invalid DATABASE_URL');
  const [, user, password, host, port, database] = m;

  const conn = await mysql.createConnection({
    host, port: parseInt(port), user, password, database,
    ssl: { rejectUnauthorized: false }
  });

  // recruitment_brands テーブル
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS recruitment_brands (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brand_name VARCHAR(255) NOT NULL COMMENT '品牌名称',
      brand_type VARCHAR(100) NOT NULL DEFAULT '' COMMENT '品牌类型（餐饮/零售/服务/娱乐等）',
      person_in_charge INT NULL COMMENT '招商负责人（staff.id）',
      contact_info TEXT NULL COMMENT '联系方式（联系人+电话/邮箱）',
      memo TEXT NULL COMMENT '备注',
      status ENUM('registered','email_sent','replied','agreed','cooperating','rejected') NOT NULL DEFAULT 'registered' COMMENT '品牌状态',
      reject_reason TEXT NULL COMMENT '拒绝原因',
      last_followed_at TIMESTAMP NULL COMMENT '最后跟进时间',
      created_by INT NULL COMMENT '登记人（staff.id）',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL COMMENT 'ソフトデリート'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
  `);
  console.log('✅ recruitment_brands table created');

  // recruitment_status_history テーブル
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS recruitment_status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recruitment_brand_id INT NOT NULL COMMENT 'recruitment_brands.id',
      old_status VARCHAR(50) NULL COMMENT '変更前ステータス',
      new_status VARCHAR(50) NOT NULL COMMENT '変更後ステータス',
      changed_by INT NULL COMMENT '操作者（staff.id）',
      note TEXT NULL COMMENT '変更メモ',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_brand_id (recruitment_brand_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
  `);
  console.log('✅ recruitment_status_history table created');

  // インデックス追加
  try {
    await conn.execute('CREATE INDEX idx_rb_status ON recruitment_brands(status)');
    console.log('✅ idx_rb_status index created');
  } catch (e) { console.log('⚠️ idx_rb_status already exists'); }

  try {
    await conn.execute('CREATE INDEX idx_rb_person ON recruitment_brands(person_in_charge)');
    console.log('✅ idx_rb_person index created');
  } catch (e) { console.log('⚠️ idx_rb_person already exists'); }

  try {
    await conn.execute('CREATE INDEX idx_rb_brand_type ON recruitment_brands(brand_type)');
    console.log('✅ idx_rb_brand_type index created');
  } catch (e) { console.log('⚠️ idx_rb_brand_type already exists'); }

  try {
    await conn.execute('CREATE INDEX idx_rb_deleted ON recruitment_brands(deleted_at)');
    console.log('✅ idx_rb_deleted index created');
  } catch (e) { console.log('⚠️ idx_rb_deleted already exists'); }

  await conn.end();
  console.log('Done!');
}

main().catch(console.error);
