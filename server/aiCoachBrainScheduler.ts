/**
 * AI Coach Brain Scheduler
 * 
 * 週1回（日曜 JST 03:00）にマスターブレインを自動再生成する。
 * 深夜に実行することで、通常のAPI利用に影響を与えない。
 */

import { generateMasterKnowledge } from "./aiCoachBrain";

const LOG_PREFIX = "[AI Brain Scheduler]";
let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
let lastRunWeek = "";

/**
 * JST時間で指定した曜日・時間かどうかをチェック
 * @param targetHour JST時間（0-23）
 * @param targetDay 曜日（0=日, 1=月, ..., 6=土）
 */
function isTargetTime(targetHour: number, targetDay: number): boolean {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = jstNow.getUTCDay();
  const hour = jstNow.getUTCHours();
  return day === targetDay && hour === targetHour;
}

/**
 * マスターブレイン自動再生成スケジューラーを開始
 * 毎週日曜 JST 03:00 に実行
 */
export function startAiCoachBrainScheduler(): void {
  if (schedulerIntervalId) {
    console.log(`${LOG_PREFIX} Already running`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting scheduler (weekly Sunday at JST 03:00)`);

  // Check every 30 minutes
  const CHECK_INTERVAL = 30 * 60 * 1000;

  schedulerIntervalId = setInterval(async () => {
    try {
      const now = new Date();
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const weekKey = `${jstNow.getFullYear()}-${jstNow.getMonth()}-W${Math.ceil(jstNow.getDate() / 7)}`;

      // Run on Sunday at JST 03:00, only once per week
      if (isTargetTime(3, 0) && lastRunWeek !== weekKey) {
        lastRunWeek = weekKey;
        console.log(`${LOG_PREFIX} Triggering weekly master knowledge regeneration...`);
        await generateMasterKnowledge();
        console.log(`${LOG_PREFIX} Master knowledge regeneration completed`);
      }
    } catch (error: any) {
      console.error(`${LOG_PREFIX} Error:`, error.message);
    }
  }, CHECK_INTERVAL);
}

/**
 * スケジューラーを停止
 */
export function stopAiCoachBrainScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log(`${LOG_PREFIX} Stopped`);
  }
}
