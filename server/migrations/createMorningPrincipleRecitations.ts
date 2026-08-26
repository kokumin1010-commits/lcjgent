import { sql } from "drizzle-orm";

/**
 * 本人別の朝会必須2録音テーブルを冪等に作成・upgradeする。
 * 既存行は recordingType='principles' として保持し、共有朝会テーブルには触れない。
 */
export async function createMorningPrincipleRecitations(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS morning_principle_recitations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date VARCHAR(10) NOT NULL,
      recordingType VARCHAR(32) NOT NULL DEFAULT 'principles',
      targetKey VARCHAR(64) NOT NULL,
      userId INT NOT NULL,
      userName VARCHAR(255) NOT NULL,
      userEmail VARCHAR(320) NOT NULL,
      staffId INT NULL,
      staffName VARCHAR(255) NULL,
      staffPosition VARCHAR(255) NULL,
      operatorUserId INT NULL,
      operatorUserName VARCHAR(255) NULL,
      operatorUserEmail VARCHAR(320) NULL,
      language VARCHAR(10) NOT NULL,
      audioUrl TEXT NOT NULL,
      audioKey VARCHAR(500) NOT NULL,
      mimeType VARCHAR(100) NOT NULL,
      durationSeconds INT NOT NULL,
      transcript TEXT NULL,
      summary JSON NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'completed',
      errorMessage TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_morning_daily_recording_date_target_type (date, targetKey, recordingType),
      INDEX idx_morning_principle_date (date),
      INDEX idx_morning_principle_staff (staffId)
    )
  `);

  const columns = [
    { name: "recordingType", ddl: "ADD COLUMN `recordingType` VARCHAR(32) NOT NULL DEFAULT 'principles' AFTER `date`" },
    { name: "targetKey", ddl: "ADD COLUMN `targetKey` VARCHAR(64) NULL AFTER `recordingType`" },
    { name: "operatorUserId", ddl: "ADD COLUMN `operatorUserId` INT NULL AFTER `staffPosition`" },
    { name: "operatorUserName", ddl: "ADD COLUMN `operatorUserName` VARCHAR(255) NULL AFTER `operatorUserId`" },
    { name: "operatorUserEmail", ddl: "ADD COLUMN `operatorUserEmail` VARCHAR(320) NULL AFTER `operatorUserName`" },
    { name: "transcript", ddl: "ADD COLUMN `transcript` TEXT NULL AFTER `durationSeconds`" },
    { name: "summary", ddl: "ADD COLUMN `summary` JSON NULL AFTER `transcript`" },
    { name: "errorMessage", ddl: "ADD COLUMN `errorMessage` TEXT NULL AFTER `status`" },
  ];

  for (const column of columns) {
    const [rows] = await db.execute(sql.raw(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'morning_principle_recitations' AND COLUMN_NAME = '${column.name}'`,
    ));
    if (Array.isArray(rows) && rows.length === 0) {
      await db.execute(sql.raw(`ALTER TABLE morning_principle_recitations ${column.ddl}`));
      console.log(`[Migration] Added morning_principle_recitations.${column.name}`);
    }
  }

  await db.execute(sql.raw(
    "UPDATE morning_principle_recitations SET targetKey = CASE WHEN staffId IS NOT NULL THEN CONCAT('staff:', staffId) ELSE CONCAT('user:', userId) END WHERE targetKey IS NULL OR targetKey = ''",
  ));
  const [targetKeyRows] = await db.execute(sql.raw(
    "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'morning_principle_recitations' AND COLUMN_NAME = 'targetKey'",
  ));
  const targetKeyColumn = Array.isArray(targetKeyRows) ? targetKeyRows[0] as any : null;
  if (targetKeyColumn?.IS_NULLABLE === "YES") {
    await db.execute(sql.raw(
      "ALTER TABLE morning_principle_recitations MODIFY COLUMN targetKey VARCHAR(64) NOT NULL",
    ));
    console.log("[Migration] Enforced NOT NULL on morning_principle_recitations.targetKey");
  }

  for (const indexName of ["unique_morning_principle_date_user", "unique_morning_daily_recording_date_user_type"]) {
    const [oldIndexRows] = await db.execute(sql.raw(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'morning_principle_recitations' AND INDEX_NAME = '${indexName}'`,
    ));
    if (Array.isArray(oldIndexRows) && oldIndexRows.length > 0) {
      await db.execute(sql.raw(`ALTER TABLE morning_principle_recitations DROP INDEX ${indexName}`));
      console.log(`[Migration] Removed legacy index ${indexName}`);
    }
  }

  const [newIndexRows] = await db.execute(sql.raw(
    "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'morning_principle_recitations' AND INDEX_NAME = 'unique_morning_daily_recording_date_target_type'",
  ));
  if (Array.isArray(newIndexRows) && newIndexRows.length === 0) {
    await db.execute(sql.raw(
      "ALTER TABLE morning_principle_recitations ADD UNIQUE INDEX unique_morning_daily_recording_date_target_type (`date`, `targetKey`, `recordingType`)",
    ));
    console.log("[Migration] Added daily target recording type unique index");
  }

  console.log("[Migration] morning_principle_recitations table created/upgraded/verified");
}
