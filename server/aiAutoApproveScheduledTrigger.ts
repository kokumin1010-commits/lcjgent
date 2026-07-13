/**
 * AI Auto-Approve Scheduled Trigger
 * 
 * 毎日 JST 9:00, 12:00, 18:00 に自動的にAI自動承認を開始する。
 * 既存の aiAutoApproveScheduler.ts のバッチ処理ロジックをそのまま活用し、
 * 指定時刻に isRunning=true をセットしてトリガーする。
 * 
 * DB永続化による重複防止:
 * - ai_auto_approve_scheduled_log テーブルで実行済みスロットを記録
 * - Railway再起動時に同じスロットで二重実行しない
 * 
 * 設計:
 * - 5分ごとにJST時刻をチェック
 * - 対象時刻（9, 12, 18時台）に入ったら、その日のそのスロットが未実行なら実行
 * - 実行 = isRunning=true にセット + triggerAiAutoApprove() 呼び出し
 * - 処理自体は既存の aiAutoApproveScheduler が担当
 */

import { sql } from "drizzle-orm";

const LOG_PREFIX = "[AI AutoApprove Scheduled]";
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5分ごとにチェック
const TARGET_HOURS = [9, 12, 18]; // JST 9:00, 12:00, 18:00

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;

// ========== JST Helper ==========
function getJSTNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function getJSTDateStr(jstDate: Date): string {
  return `${jstDate.getUTCFullYear()}-${String(jstDate.getUTCMonth() + 1).padStart(2, '0')}-${String(jstDate.getUTCDate()).padStart(2, '0')}`;
}

// ========== DB Log Table ==========
async function ensureScheduledLogTable(): Promise<void> {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_auto_approve_scheduled_log (
        id int AUTO_INCREMENT PRIMARY KEY,
        run_date varchar(10) NOT NULL,
        run_hour int NOT NULL,
        triggered_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        candidates_found int DEFAULT 0,
        status varchar(20) DEFAULT 'triggered',
        UNIQUE KEY uk_date_hour (run_date, run_hour)
      )
    `);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} ensureScheduledLogTable error:`, err.message);
  }
}

async function hasAlreadyRunSlot(dateStr: string, hour: number): Promise<boolean> {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return false;
    const result = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM ai_auto_approve_scheduled_log 
      WHERE run_date = ${dateStr} AND run_hour = ${hour}
    `);
    const rows = (result as any)[0] as any[];
    return rows && rows[0] && Number(rows[0].cnt) > 0;
  } catch (err: any) {
    if (err.message?.includes("doesn't exist")) return false;
    console.error(`${LOG_PREFIX} hasAlreadyRunSlot error:`, err.message);
    return false;
  }
}

async function markSlotRun(dateStr: string, hour: number, candidatesFound: number = 0): Promise<void> {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      INSERT IGNORE INTO ai_auto_approve_scheduled_log (run_date, run_hour, candidates_found, status) 
      VALUES (${dateStr}, ${hour}, ${candidatesFound}, 'triggered')
    `);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} markSlotRun error:`, err.message);
  }
}

// ========== Main Logic ==========
async function checkAndTrigger(): Promise<void> {
  try {
    const jstNow = getJSTNow();
    const currentHour = jstNow.getUTCHours();
    const dateStr = getJSTDateStr(jstNow);

    // 現在の時刻がターゲット時刻のいずれかに該当するかチェック
    if (!TARGET_HOURS.includes(currentHour)) return;

    // 既にこのスロットで実行済みかチェック（DB永続化）
    const alreadyRun = await hasAlreadyRunSlot(dateStr, currentHour);
    if (alreadyRun) return;

    console.log(`${LOG_PREFIX} ⏰ JST ${currentHour}:00 - AI自動承認をトリガーします (${dateStr})`);

    // 未処理レシートがあるか確認
    const { getAutoApprovalCandidates, updateAiAutoApproveSetting } = await import("./db");
    const candidates = await getAutoApprovalCandidates(1);
    
    if (candidates.length === 0) {
      console.log(`${LOG_PREFIX} 未処理レシートなし - スキップ`);
      await markSlotRun(dateStr, currentHour, 0);
      return;
    }

    // isRunning=true にセットしてバッチ処理を開始
    await updateAiAutoApproveSetting({
      isRunning: true,
      startedAt: new Date(),
      updatedBy: 1, // System user
    });

    // 既存のトリガー関数を呼び出し
    const { triggerAiAutoApprove } = await import("./aiAutoApproveScheduler");
    await triggerAiAutoApprove();

    // 実行ログを記録
    await markSlotRun(dateStr, currentHour, candidates.length);

    console.log(`${LOG_PREFIX} ✅ AI自動承認をトリガーしました (JST ${currentHour}:00, 候補: ${candidates.length}件以上)`);
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error:`, error.message);
  }
}

// ========== Public API ==========

/**
 * 定期トリガースケジューラーを開始
 * 毎日 JST 9:00, 12:00, 18:00 にAI自動承認を自動実行
 */
export function startAiAutoApproveScheduledTrigger(): void {
  if (schedulerIntervalId) {
    console.log(`${LOG_PREFIX} Already running`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting scheduled trigger (JST 9:00, 12:00, 18:00)`);

  // テーブル作成
  ensureScheduledLogTable().catch(err => {
    console.error(`${LOG_PREFIX} Failed to ensure log table:`, err);
  });

  // 起動時に1回チェック（起動がちょうどターゲット時刻だった場合に対応）
  setTimeout(() => {
    checkAndTrigger().catch(err => {
      console.error(`${LOG_PREFIX} Initial check error:`, err);
    });
  }, 10000); // 10秒後に初回チェック（他のスケジューラーの起動完了を待つ）

  // 5分ごとにチェック
  schedulerIntervalId = setInterval(() => {
    checkAndTrigger().catch(err => {
      console.error(`${LOG_PREFIX} Scheduled check error:`, err);
    });
  }, CHECK_INTERVAL_MS);
}

/**
 * スケジューラーを停止
 */
export function stopAiAutoApproveScheduledTrigger(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log(`${LOG_PREFIX} Stopped`);
  }
}
