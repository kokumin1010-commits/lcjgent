import { sql } from "drizzle-orm";
import { getDb } from "./db";

export const MORNING_MEETING_STALE_PROCESSING_MINUTES = 10;

export async function finalizeStaleMorningMeetingProcessing(): Promise<{ finalized: number }> {
  const db = await getDb();
  if (!db) return { finalized: 0 };
  const result = await db.execute(sql`
    UPDATE morning_meetings
    SET status = 'failed',
        errorMessage = 'MORNING_TRANSCRIPTION_PROCESS_INTERRUPTED'
    WHERE recordingKind = 'daily_team'
      AND status IN ('transcribing', 'summarizing')
      AND updatedAt < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      AND supersededAt IS NULL
      AND deletedAt IS NULL
  `);
  return { finalized: Number((result as any)?.[0]?.affectedRows || 0) };
}
