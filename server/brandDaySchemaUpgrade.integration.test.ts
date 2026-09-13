import { beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

const enabled = process.env.LCJ_BRAND_DAY_SCHEMA_E2E === "1";
const describeSchema = enabled ? describe : describe.skip;
const databaseUrl = process.env.LCJ_BRAND_DAY_SCHEMA_DATABASE_URL || "mysql://brandday_test:brandday_test@127.0.0.1:3306/lcj_brandday_schema_test";

describeSchema("Brand Day startup schema upgrade", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
  });

  it("creates all native tables on an empty database and is idempotent", async () => {
    const { ensureBrandDayNativeTables, REQUIRED_TABLES } = await import("./brandDaySchemaUpgrade");
    await ensureBrandDayNativeTables();
    await ensureBrandDayNativeTables();
    const pool = mysql.createPool(databaseUrl);
    try {
      const [rows] = await pool.query(
        `SELECT table_name AS tableName
           FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
        [...REQUIRED_TABLES],
      );
      expect(new Set((rows as any[]).map(row => String(row.tableName)))).toEqual(new Set(REQUIRED_TABLES));
    } finally {
      await pool.end();
    }
  });
});
