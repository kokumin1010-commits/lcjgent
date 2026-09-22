import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isConcurrentMorningMeetingSchemaDuplicate } from "./migrations/upgradeMorningMeetingsForDailyTeam";

const migrationSource = readFileSync(
  new URL("./migrations/upgradeMorningMeetingsForDailyTeam.ts", import.meta.url),
  "utf8",
);
const serverSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");

describe("morning meeting incremental migration", () => {
  it("treats only concurrent duplicate-column and duplicate-index errors as already applied", () => {
    expect(isConcurrentMorningMeetingSchemaDuplicate({ code: "ER_DUP_FIELDNAME" })).toBe(true);
    expect(isConcurrentMorningMeetingSchemaDuplicate({ errno: 1061 })).toBe(true);
    expect(isConcurrentMorningMeetingSchemaDuplicate({ cause: { message: "Duplicate key name 'test'" } })).toBe(true);
    expect(isConcurrentMorningMeetingSchemaDuplicate({ code: "ER_ACCESS_DENIED_ERROR" })).toBe(false);
  });

  it("adds all media validation, supersession, and one-time upload columns and indexes idempotently", () => {
    for (const column of [
      "audioUploadId",
      "mediaValidatedAt",
      "mediaDurationSeconds",
      "mediaSha256",
      "mediaAudioStreamCount",
      "mediaValidationAttemptedAt",
      "mediaValidationFailureCode",
      "speechValidatedAt",
      "speechValidationProvider",
      "speechValidationAttemptedAt",
      "speechValidationFailureCode",
      "supersededById",
      "supersededAt",
      "deletedAt",
      "deletedBy",
      "deleteReason",
    ]) {
      expect(migrationSource).toContain(`name: "${column}"`);
    }
    expect(migrationSource).toContain("uq_morning_meetings_audio_upload_id");
    expect(migrationSource).toContain("idx_morning_meetings_media_validation");
    expect(migrationSource).toContain("idx_morning_meetings_speech_validation");
    expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS morning_meeting_audio_uploads");
    expect(migrationSource).toContain("INFORMATION_SCHEMA.COLUMNS");
    expect(migrationSource).toContain("INFORMATION_SCHEMA.STATISTICS");
  });

  it("awaits schema readiness before starting performance scheduling or listening", () => {
    const readiness = serverSource.indexOf("await upgradeMorningMeetingsForDailyTeam(morningMeetingMigrationDb)");
    const schedulerStart = serverSource.indexOf("startPerformanceScheduler()", readiness);
    const listenerStart = serverSource.indexOf("server.listen(port", readiness);
    expect(readiness).toBeGreaterThan(0);
    expect(readiness).toBeLessThan(schedulerStart);
    expect(readiness).toBeLessThan(listenerStart);
  });
});
