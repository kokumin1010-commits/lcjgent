import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { validateStoredMorningMeetingAudio } from "./morningMeetingMediaValidation";
import { validateStoredMorningMeetingSpeech } from "./morningMeetingSpeechValidation";

const MAX_ROWS_PER_RUN = 12;
const CONCURRENCY = 2;

export function morningMeetingMediaBackfillFromDate(value = new Date()): string {
  const now = new Date(value.getTime() + 9 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() - 14);
  return now.toISOString().slice(0, 10);
}

function safeFailureCode(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : fallback;
  return /^MORNING_AUDIO_[A-Z0-9_]+$/.test(raw) ? raw.slice(0, 64) : fallback;
}

export type MorningMeetingMediaBackfillResult = {
  inspected: number;
  validated: number;
  failed: number;
};

type BackfillRow = {
  id: number;
  audioKey: string;
  language: string | null;
  mediaValidatedAt: Date | string | null;
  mediaDurationSeconds: string | number | null;
  mediaSha256: string | null;
  mediaAudioStreamCount: number | null;
};

export async function backfillMorningMeetingMediaValidation(): Promise<MorningMeetingMediaBackfillResult> {
  const db = await getDb();
  if (!db) return { inspected: 0, validated: 0, failed: 0 };
  const fromDate = morningMeetingMediaBackfillFromDate();
  const result = await db.execute(sql`
    SELECT id, audioKey, language, mediaValidatedAt, mediaDurationSeconds, mediaSha256, mediaAudioStreamCount
    FROM morning_meetings
    WHERE recordingKind = 'daily_team'
      AND date >= ${fromDate}
      AND audioKey IS NOT NULL
      AND speechValidatedAt IS NULL
      AND supersededAt IS NULL
      AND deletedAt IS NULL
      AND status IN ('transcribing', 'summarizing', 'completed', 'failed')
      AND (speechValidationAttemptedAt IS NULL OR speechValidationAttemptedAt < DATE_SUB(NOW(), INTERVAL 6 HOUR))
    ORDER BY date DESC, createdAt DESC
    LIMIT ${MAX_ROWS_PER_RUN}
  `);
  const rows = Array.isArray((result as any)?.[0]) ? (result as any)[0] as BackfillRow[] : [];
  let cursor = 0;
  let inspected = 0;
  let validated = 0;
  let failed = 0;

  const workers = Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      const attemptedAt = new Date();
      const claim = await db.execute(sql`
        UPDATE morning_meetings
        SET speechValidationAttemptedAt = ${attemptedAt},
            mediaValidationAttemptedAt = IF(mediaValidatedAt IS NULL, ${attemptedAt}, mediaValidationAttemptedAt)
        WHERE id = ${row.id}
          AND speechValidatedAt IS NULL
          AND supersededAt IS NULL
          AND deletedAt IS NULL
          AND (speechValidationAttemptedAt IS NULL OR speechValidationAttemptedAt < DATE_SUB(NOW(), INTERVAL 6 HOUR))
      `);
      if (Number((claim as any)?.[0]?.affectedRows || 0) !== 1) continue;
      inspected += 1;

      let media: {
        mediaValidatedAt: Date;
        mediaDurationSeconds: number;
        mediaSha256: string;
        audioStreamCount: number;
      };
      const existingDuration = Number(row.mediaDurationSeconds || 0);
      if (row.mediaValidatedAt && existingDuration >= 1 && /^[a-f0-9]{64}$/.test(String(row.mediaSha256 || ""))
        && Number(row.mediaAudioStreamCount || 0) >= 1) {
        media = {
          mediaValidatedAt: new Date(row.mediaValidatedAt),
          mediaDurationSeconds: existingDuration,
          mediaSha256: String(row.mediaSha256),
          audioStreamCount: Number(row.mediaAudioStreamCount),
        };
      } else {
        try {
          media = await validateStoredMorningMeetingAudio(row.audioKey);
        } catch (error) {
          const code = safeFailureCode(error, "MORNING_AUDIO_VALIDATION_FAILED");
          const finalized = await db.execute(sql`
            UPDATE morning_meetings
            SET mediaValidationFailureCode = ${code},
                speechValidationFailureCode = 'MORNING_AUDIO_MEDIA_NOT_VALIDATED'
            WHERE id = ${row.id}
              AND speechValidatedAt IS NULL
              AND supersededAt IS NULL
              AND deletedAt IS NULL
          `);
          if (Number((finalized as any)?.[0]?.affectedRows || 0) === 1) failed += 1;
          continue;
        }
      }

      try {
        const speech = await validateStoredMorningMeetingSpeech({
          audioKey: row.audioKey,
          language: row.language === "ja" ? "ja" : "zh",
          expectedDurationSeconds: media.mediaDurationSeconds,
        });
        const finalized = await db.execute(sql`
          UPDATE morning_meetings
          SET mediaValidatedAt = ${media.mediaValidatedAt},
              mediaDurationSeconds = ${media.mediaDurationSeconds.toFixed(3)},
              mediaSha256 = ${media.mediaSha256},
              mediaAudioStreamCount = ${media.audioStreamCount},
              mediaValidationFailureCode = NULL,
              durationSeconds = ROUND(${media.mediaDurationSeconds}),
              speechValidatedAt = ${speech.speechValidatedAt},
              speechValidationProvider = ${speech.speechValidationProvider},
              speechValidationFailureCode = NULL
          WHERE id = ${row.id}
            AND speechValidatedAt IS NULL
            AND supersededAt IS NULL
            AND deletedAt IS NULL
        `);
        if (Number((finalized as any)?.[0]?.affectedRows || 0) === 1) validated += 1;
      } catch (error) {
        const code = safeFailureCode(error, "MORNING_AUDIO_SPEECH_VALIDATION_FAILED");
        const finalized = await db.execute(sql`
          UPDATE morning_meetings
          SET mediaValidatedAt = ${media.mediaValidatedAt},
              mediaDurationSeconds = ${media.mediaDurationSeconds.toFixed(3)},
              mediaSha256 = ${media.mediaSha256},
              mediaAudioStreamCount = ${media.audioStreamCount},
              mediaValidationFailureCode = NULL,
              durationSeconds = ROUND(${media.mediaDurationSeconds}),
              speechValidationFailureCode = ${code}
          WHERE id = ${row.id}
            AND speechValidatedAt IS NULL
            AND supersededAt IS NULL
            AND deletedAt IS NULL
        `);
        if (Number((finalized as any)?.[0]?.affectedRows || 0) === 1) failed += 1;
      }
    }
  });
  await Promise.all(workers);
  return { inspected, validated, failed };
}
