import { getDb } from "./db";
import { runPerformanceReconciliation } from "./performanceReconciliationService";
import {
  backfillMorningMeetingMediaValidation,
  morningMeetingMediaBackfillFromDate,
} from "./morningMeetingMediaBackfill";
import { finalizeStaleMorningMeetingProcessing } from "./morningMeetingProcessingRecovery";

const LOG_PREFIX = "[Performance Shadow]";
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_DELAY_MS = 90 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

export async function runPerformanceShadowReconciliation(runRevision?: string): Promise<void> {
  if (running) return;
  running = true;
  try {
    const db = await getDb();
    if (!db) {
      console.warn(`${LOG_PREFIX} database unavailable; skipped`);
      return;
    }
    let staleMorningMeetingProcessing = { finalized: 0 };
    try {
      staleMorningMeetingProcessing = await finalizeStaleMorningMeetingProcessing();
    } catch (error) {
      console.error(`${LOG_PREFIX} stale morning meeting recovery failed; reconciliation continues`, error);
    }
    let mediaBackfill = { inspected: 0, validated: 0, failed: 0 };
    try {
      mediaBackfill = await backfillMorningMeetingMediaValidation();
    } catch (error) {
      console.error(`${LOG_PREFIX} morning meeting media backfill failed; reconciliation continues`, error);
    }
    const result = await runPerformanceReconciliation(db, {
      runRevision,
      morningMeetingFromDate: morningMeetingMediaBackfillFromDate(),
    });
    console.log(`${LOG_PREFIX} reconciliation ${result.skipped ? "skipped" : "completed"}`, {
      runKey: result.runKey,
      counters: result.counters,
      mode: result.settings.mode,
      impactsBonus: result.settings.impactsBonus,
      impactsLcjCoin: result.settings.impactsLcjCoin,
      externalNotificationsEnabled: result.settings.externalNotificationsEnabled,
      staleMorningMeetingProcessing,
      morningMeetingMediaBackfill: mediaBackfill,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} reconciliation failed`, error);
  } finally {
    running = false;
  }
}

export function startPerformanceScheduler(): void {
  if (intervalId || initialTimer) return;
  console.log(`${LOG_PREFIX} scheduler enabled (15-minute interval, shadow mode)`);
  initialTimer = setTimeout(() => {
    initialTimer = null;
    // A stable revision suffix lets only one replica claim the deployment
    // catch-up in the current slot while still bypassing the previous adapter run.
    void runPerformanceShadowReconciliation("morning-media-v2");
  }, INITIAL_DELAY_MS);
  intervalId = setInterval(() => {
    void runPerformanceShadowReconciliation();
  }, CHECK_INTERVAL_MS);
}

export function stopPerformanceScheduler(): void {
  if (initialTimer) clearTimeout(initialTimer);
  if (intervalId) clearInterval(intervalId);
  initialTimer = null;
  intervalId = null;
}
