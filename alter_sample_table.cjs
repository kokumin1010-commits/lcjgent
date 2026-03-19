const mysql = require("mysql2/promise");

async function main() {
  const rawUrl = process.env.DATABASE_URL.replace(/\?ssl=.*$/, "");
  const conn = await mysql.createConnection({ uri: rawUrl, ssl: { rejectUnauthorized: true } });

  const alterQueries = [
    // 不足カラムを追加
    "ALTER TABLE sample_requests ADD COLUMN `month` VARCHAR(7) DEFAULT NULL AFTER liver_name",
    "ALTER TABLE sample_requests ADD COLUMN out_of_pocket_amount DECIMAL(10,2) DEFAULT 0 AFTER credit_used",
    "ALTER TABLE sample_requests ADD COLUMN shipped_at DATETIME DEFAULT NULL AFTER reviewed_at",
    "ALTER TABLE sample_requests ADD COLUMN postal_code VARCHAR(10) DEFAULT NULL AFTER shipped_at",
    "ALTER TABLE sample_requests ADD COLUMN address TEXT DEFAULT NULL AFTER postal_code",
    "ALTER TABLE sample_requests ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER address",
    // cash_amountがあるがout_of_pocket_amountが正しい名前 - cash_amountは残しておく
  ];

  for (const q of alterQueries) {
    try {
      await conn.execute(q);
      console.log("OK:", q.slice(0, 80));
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("SKIP (already exists):", q.slice(0, 80));
      } else {
        console.error("ERROR:", e.message, "Query:", q.slice(0, 80));
      }
    }
  }

  await conn.end();
  console.log("Done!");
}

main().catch(e => { console.error(e); process.exit(1); });
