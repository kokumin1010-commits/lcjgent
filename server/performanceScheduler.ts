import { getDb } from "./db";
import { runPerformanceReconciliation } from "./performanceReconciliationService";

const LOG_PREFIX = "[Performance Shadow]";
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_DELAY_MS = 90 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

export async function runPerformanceShadowReconciliation(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const db = await getDb();
    if (!db) {
      console.warn(`${LOG_PREFIX} database unavailable; skipped`);
      return;
    }
    const result = await runPerformanceReconciliation(db);
    console.log(`${LOG_PREFIX} reconciliation ${result.skipped ? "skipped" : "completed"}`, {
      runKey: result.runKey,
      counters: result.counters,
      mode: result.settings.mode,
      impactsBonus: result.settings.impactsBonus,
      impactsLcjCoin: result.settings.impactsLcjCoin,
      externalNotificationsEnabled: result.settings.externalNotificationsEnabled,
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
    void runPerformanceShadowReconciliation();
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
