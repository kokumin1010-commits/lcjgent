import mysql from "mysql2/promise";
import { ensureLcjBrainProjectUpgrade } from "./lcjBrainProjectUpgrade";
import { runProjectDailyCollection } from "./lcjBrainProjectRouter";

const INTERVAL_MS = 15 * 60 * 1000;
let started = false;

async function runOnce() {
  if (!process.env.DATABASE_URL) return;
  await ensureLcjBrainProjectUpgrade();
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    const [rows] = await pool.query<any[]>(
      "SELECT id FROM lcj_brain_projects WHERE status='active' AND autoCollectEnabled=1 ORDER BY id"
    );
    for (const row of rows) {
      try {
        await runProjectDailyCollection(Number(row.id));
      } catch (error) {
        console.error(
          `[LcjBrainProjectScheduler] project ${row.id} failed`,
          error
        );
      }
    }
  } finally {
    await pool.end();
  }
}

export function startLcjBrainProjectScheduler() {
  if (started) return;
  started = true;
  const tick = () =>
    runOnce().catch(error =>
      console.error("[LcjBrainProjectScheduler] tick failed", error)
    );
  const first = setTimeout(tick, 20_000);
  first.unref();
  const timer = setInterval(tick, INTERVAL_MS);
  timer.unref();
}
