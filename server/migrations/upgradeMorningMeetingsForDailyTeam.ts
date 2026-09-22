import { sql } from "drizzle-orm";

export function isConcurrentMorningMeetingSchemaDuplicate(error: unknown): boolean {
  const candidate = error as { code?: string; errno?: number; message?: string; cause?: unknown } | null;
  if (!candidate) return false;
  if (candidate.code === "ER_DUP_FIELDNAME" || candidate.code === "ER_DUP_KEYNAME") return true;
  if (candidate.errno === 1060 || candidate.errno === 1061) return true;
  if (/Duplicate column name|Duplicate key name/i.test(String(candidate.message || ""))) return true;
  return candidate.cause ? isConcurrentMorningMeetingSchemaDuplicate(candidate.cause) : false;
}

/**
 * 旧morning_meetings行を変更せず、1日1件の新チーム朝会を共存させる。
 * dailyKeyは旧行でNULL、新daily_team行だけJST日付を持ち、UNIQUEで1日1件を保証する。
 */
export async function upgradeMorningMeetingsForDailyTeam(db: any) {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS morning_meeting_audio_uploads (
      uploadId VARCHAR(64) NOT NULL PRIMARY KEY,
      userId INT NOT NULL,
      storageKey TEXT NOT NULL,
      storageUrl TEXT NOT NULL,
      mimeType VARCHAR(100) NOT NULL,
      size INT NOT NULL,
      mediaDurationSeconds DECIMAL(10,3) NOT NULL,
      mediaSha256 VARCHAR(64) NOT NULL,
      mediaValidatedAt TIMESTAMP NOT NULL,
      audioStreamCount INT NOT NULL,
      expiresAt TIMESTAMP NOT NULL,
      consumedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_morning_audio_uploads_user_expiry (userId, expiresAt)
    )
  `));
  const columns = [
    { name: "dailyKey", ddl: "ADD COLUMN `dailyKey` VARCHAR(10) NULL AFTER `date`" },
    { name: "recordingKind", ddl: "ADD COLUMN `recordingKind` VARCHAR(32) NOT NULL DEFAULT 'legacy' AFTER `dailyKey`" },
    { name: "participantCount", ddl: "ADD COLUMN `participantCount` INT NOT NULL DEFAULT 0 AFTER `recordingKind`" },
    { name: "participantSnapshot", ddl: "ADD COLUMN `participantSnapshot` JSON NULL AFTER `participantCount`" },
    { name: "teamCode", ddl: "ADD COLUMN `teamCode` VARCHAR(16) NOT NULL DEFAULT 'legacy' AFTER `recordingKind`" },
    { name: "startedAt", ddl: "ADD COLUMN `startedAt` TIMESTAMP NULL AFTER `teamCode`" },
    { name: "audioUploadId", ddl: "ADD COLUMN `audioUploadId` VARCHAR(36) NULL AFTER `audioKey`" },
    { name: "mediaValidatedAt", ddl: "ADD COLUMN `mediaValidatedAt` TIMESTAMP NULL AFTER `audioKey`" },
    { name: "mediaDurationSeconds", ddl: "ADD COLUMN `mediaDurationSeconds` DECIMAL(10,3) NULL AFTER `mediaValidatedAt`" },
    { name: "mediaSha256", ddl: "ADD COLUMN `mediaSha256` VARCHAR(64) NULL AFTER `mediaDurationSeconds`" },
    { name: "mediaAudioStreamCount", ddl: "ADD COLUMN `mediaAudioStreamCount` INT NULL AFTER `mediaSha256`" },
    { name: "mediaValidationAttemptedAt", ddl: "ADD COLUMN `mediaValidationAttemptedAt` TIMESTAMP NULL AFTER `mediaAudioStreamCount`" },
    { name: "mediaValidationFailureCode", ddl: "ADD COLUMN `mediaValidationFailureCode` VARCHAR(64) NULL AFTER `mediaValidationAttemptedAt`" },
    { name: "speechValidatedAt", ddl: "ADD COLUMN `speechValidatedAt` TIMESTAMP NULL AFTER `mediaValidationFailureCode`" },
    { name: "speechValidationProvider", ddl: "ADD COLUMN `speechValidationProvider` VARCHAR(64) NULL AFTER `speechValidatedAt`" },
    { name: "speechValidationAttemptedAt", ddl: "ADD COLUMN `speechValidationAttemptedAt` TIMESTAMP NULL AFTER `speechValidationProvider`" },
    { name: "speechValidationFailureCode", ddl: "ADD COLUMN `speechValidationFailureCode` VARCHAR(64) NULL AFTER `speechValidationAttemptedAt`" },
    { name: "supersededById", ddl: "ADD COLUMN `supersededById` INT NULL AFTER `speechValidationFailureCode`" },
    { name: "supersededAt", ddl: "ADD COLUMN `supersededAt` TIMESTAMP NULL AFTER `supersededById`" },
    { name: "deletedAt", ddl: "ADD COLUMN `deletedAt` TIMESTAMP NULL AFTER `supersededAt`" },
    { name: "deletedBy", ddl: "ADD COLUMN `deletedBy` INT NULL AFTER `deletedAt`" },
    { name: "deleteReason", ddl: "ADD COLUMN `deleteReason` VARCHAR(500) NULL AFTER `deletedBy`" },
  ];

  for (const column of columns) {
    const [rows] = await db.execute(sql.raw(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'morning_meetings' AND COLUMN_NAME = '${column.name}'`,
    ));
    if (Array.isArray(rows) && rows.length === 0) {
      try {
        await db.execute(sql.raw(`ALTER TABLE morning_meetings ${column.ddl}`));
      } catch (error) {
        if (!isConcurrentMorningMeetingSchemaDuplicate(error)) throw error;
      }
      console.log(`[Migration] Added morning_meetings.${column.name}`);
    }
  }

  const [dailyKeyColumns] = await db.execute(sql.raw(
    "SELECT CHARACTER_MAXIMUM_LENGTH AS maxLength FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'morning_meetings' AND COLUMN_NAME = 'dailyKey'",
  ));
  if (Array.isArray(dailyKeyColumns) && Number((dailyKeyColumns[0] as any)?.maxLength || 0) < 32) {
    await db.execute(sql.raw("ALTER TABLE morning_meetings MODIFY COLUMN `dailyKey` VARCHAR(32) NULL"));
  }
  await db.execute(sql.raw(`
    UPDATE morning_meetings
       SET teamCode='legacy',
           dailyKey=NULL,
           startedAt=COALESCE(startedAt, createdAt)
     WHERE recordingKind='daily_team'
       AND (teamCode IS NULL OR teamCode='' OR teamCode='legacy')
       AND (dailyKey IS NULL OR dailyKey NOT LIKE '%:%')
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS morning_meeting_settings (
      id INT NOT NULL PRIMARY KEY,
      minimumTeamDurationSeconds INT NOT NULL DEFAULT 60,
      updatedBy INT NULL,
      updatedByName VARCHAR(100) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `));
  await db.execute(sql.raw(`
    INSERT IGNORE INTO morning_meeting_settings (id, minimumTeamDurationSeconds)
    VALUES (1, 60)
  `));

  const indexes = [
    {
      name: "unique_morning_meetings_daily_key",
      ddl: "ADD UNIQUE INDEX unique_morning_meetings_daily_key (`dailyKey`)",
    },
    {
      name: "idx_morning_meetings_kind_date",
      ddl: "ADD INDEX idx_morning_meetings_kind_date (`recordingKind`, `date`)",
    },
    {
      name: "idx_morning_meetings_team_date",
      ddl: "ADD INDEX idx_morning_meetings_team_date (`teamCode`, `date`, `status`)",
    },
    {
      name: "idx_morning_meetings_media_validation",
      ddl: "ADD INDEX idx_morning_meetings_media_validation (`recordingKind`, `mediaValidatedAt`, `supersededAt`, `deletedAt`)",
    },
    {
      name: "idx_morning_meetings_speech_validation",
      ddl: "ADD INDEX idx_morning_meetings_speech_validation (`recordingKind`, `speechValidatedAt`, `supersededAt`, `deletedAt`)",
    },
    {
      name: "uq_morning_meetings_audio_upload_id",
      ddl: "ADD UNIQUE INDEX uq_morning_meetings_audio_upload_id (`audioUploadId`)",
    },
  ];

  for (const index of indexes) {
    const [rows] = await db.execute(sql.raw(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'morning_meetings' AND INDEX_NAME = '${index.name}'`,
    ));
    if (Array.isArray(rows) && rows.length === 0) {
      try {
        await db.execute(sql.raw(`ALTER TABLE morning_meetings ${index.ddl}`));
      } catch (error) {
        if (!isConcurrentMorningMeetingSchemaDuplicate(error)) throw error;
      }
      console.log(`[Migration] Added ${index.name}`);
    }
  }

  console.log("[Migration] morning_meetings daily-team columns/indexes verified");
}
