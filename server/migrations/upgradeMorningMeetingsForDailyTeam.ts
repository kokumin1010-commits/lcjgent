import { sql } from "drizzle-orm";

/**
 * 旧morning_meetings行を変更せず、1日1件の新チーム朝会を共存させる。
 * dailyKeyは旧行でNULL、新daily_team行だけJST日付を持ち、UNIQUEで1日1件を保証する。
 */
export async function upgradeMorningMeetingsForDailyTeam(db: any) {
  const columns = [
    { name: "dailyKey", ddl: "ADD COLUMN `dailyKey` VARCHAR(10) NULL AFTER `date`" },
    { name: "recordingKind", ddl: "ADD COLUMN `recordingKind` VARCHAR(32) NOT NULL DEFAULT 'legacy' AFTER `dailyKey`" },
    { name: "participantCount", ddl: "ADD COLUMN `participantCount` INT NOT NULL DEFAULT 0 AFTER `recordingKind`" },
    { name: "participantSnapshot", ddl: "ADD COLUMN `participantSnapshot` JSON NULL AFTER `participantCount`" },
  ];

  for (const column of columns) {
    const [rows] = await db.execute(sql.raw(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'morning_meetings' AND COLUMN_NAME = '${column.name}'`,
    ));
    if (Array.isArray(rows) && rows.length === 0) {
      await db.execute(sql.raw(`ALTER TABLE morning_meetings ${column.ddl}`));
      console.log(`[Migration] Added morning_meetings.${column.name}`);
    }
  }

  const indexes = [
    {
      name: "unique_morning_meetings_daily_key",
      ddl: "ADD UNIQUE INDEX unique_morning_meetings_daily_key (`dailyKey`)",
    },
    {
      name: "idx_morning_meetings_kind_date",
      ddl: "ADD INDEX idx_morning_meetings_kind_date (`recordingKind`, `date`)",
    },
  ];

  for (const index of indexes) {
    const [rows] = await db.execute(sql.raw(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'morning_meetings' AND INDEX_NAME = '${index.name}'`,
    ));
    if (Array.isArray(rows) && rows.length === 0) {
      await db.execute(sql.raw(`ALTER TABLE morning_meetings ${index.ddl}`));
      console.log(`[Migration] Added ${index.name}`);
    }
  }

  console.log("[Migration] morning_meetings daily-team columns/indexes verified");
}
