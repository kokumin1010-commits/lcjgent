/**
 * AI配信提案 自動送信スケジューラー
 * 
 * 毎朝7:00 JST に今日の配信予定ライバー全員のAI提案を生成し、
 * LINEグループ「LCJ所属ライバー連絡網」に自動送信する。
 * 
 * みんなで数字を共有して高め合うスタイル。
 */

import { getDb } from "./db";
import {
  getTodaySchedulesForSuggestion,
  getRecentLivestreamDataForSuggestion,
  getTopProductsForSuggestion,
  getRecentSetsForSuggestion,
  saveLiveSuggestion,
  ensureLiveSuggestionsTable,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { pushMessage } from "./line";
import { lineGroups } from "../drizzle/schema";
import { eq, and, like } from "drizzle-orm";

const LOG_PREFIX = "[LiveSuggestion Scheduler]";

// Target LINE group name keywords (will search for group containing these)
const TARGET_GROUP_KEYWORDS = ["ライバー連絡網", "LCJ所属"];

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Find the target LINE group ID by searching for group name containing keywords
 */
async function findTargetLineGroup(): Promise<{ lineGroupId: string; groupName: string } | null> {
  const db = await getDb();
  if (!db) return null;

  for (const keyword of TARGET_GROUP_KEYWORDS) {
    const results = await db
      .select({ lineGroupId: lineGroups.lineGroupId, groupName: lineGroups.groupName })
      .from(lineGroups)
      .where(
        and(
          like(lineGroups.groupName, `%${keyword}%`),
          eq(lineGroups.isActive, true)
        )
      )
      .limit(1);

    if (results.length > 0 && results[0].lineGroupId) {
      return {
        lineGroupId: results[0].lineGroupId,
        groupName: results[0].groupName || keyword,
      };
    }
  }

  return null;
}

/**
 * Main function: Generate AI suggestions for all today's livers and send to LINE group
 */
export async function runDailyLiveSuggestion(): Promise<void> {
  console.log(`${LOG_PREFIX} Starting daily live suggestion generation...`);

  try {
    // Ensure table exists
    await ensureLiveSuggestionsTable();

    // Find target LINE group
    const targetGroup = await findTargetLineGroup();
    if (!targetGroup) {
      console.log(`${LOG_PREFIX} No target LINE group found. Skipping.`);
      return;
    }
    console.log(`${LOG_PREFIX} Target group: ${targetGroup.groupName} (${targetGroup.lineGroupId})`);

    // Get today's schedules
    const todaySchedules = await getTodaySchedulesForSuggestion();
    if (todaySchedules.length === 0) {
      console.log(`${LOG_PREFIX} No schedules for today. Skipping.`);
      return;
    }

    console.log(`${LOG_PREFIX} Found ${todaySchedules.length} schedules for today`);

    // Group schedules by liverName
    const liverScheduleMap = new Map<string, typeof todaySchedules>();
    for (const s of todaySchedules) {
      const name = s.liverName || s.title;
      if (!liverScheduleMap.has(name)) liverScheduleMap.set(name, []);
      liverScheduleMap.get(name)!.push(s);
    }

    const allSuggestionTexts: string[] = [];
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayStr = jstNow.toISOString().split('T')[0];

    // Generate suggestion for each liver
    for (const [liverName, liverSchedules] of liverScheduleMap) {
      try {
        console.log(`${LOG_PREFIX} Generating suggestion for ${liverName}...`);

        const [recentStreams, topProducts, recentSets] = await Promise.all([
          getRecentLivestreamDataForSuggestion(liverName),
          getTopProductsForSuggestion(liverName),
          getRecentSetsForSuggestion(liverName),
        ]);

        let contextInfo = `## ${liverName}さんの配信データ\n\n`;
        contextInfo += `### 今日の予定\n`;
        for (const s of liverSchedules) {
          const startTime = s.startTime ? new Date(s.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '不明';
          const endTime = s.endTime ? new Date(s.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '';
          contextInfo += `- ${startTime}${endTime ? `〜${endTime}` : ''} ${s.title}\n`;
        }

        if (recentStreams.length > 0) {
          contextInfo += `\n### 直近の配信実績\n`;
          for (const s of recentStreams.slice(0, 5)) {
            const date = s.livestreamDate ? new Date(s.livestreamDate).toLocaleDateString('ja-JP') : '不明';
            const sales = s.salesAmount ? `¥${Number(s.salesAmount).toLocaleString()}` : '¥0';
            contextInfo += `- ${date}: ${s.brandName || '不明'} / 売上${sales}\n`;
          }
        }

        if (topProducts.length > 0) {
          contextInfo += `\n### 売れ筋商品TOP5\n`;
          for (const p of topProducts.slice(0, 5)) {
            contextInfo += `- ${p.productName}: ¥${Number(p.totalGmv).toLocaleString()}\n`;
          }
        }

        if (recentSets.length > 0) {
          contextInfo += `\n### よく使うセット\n`;
          for (const s of recentSets.slice(0, 3)) {
            contextInfo += `- ${s.name}\n`;
          }
        }

        const systemPrompt = `あなたはTikTokライブコマースの配信コーチです。
ライバーの過去データを分析し、今日の配信の進め方を提案してください。
みんなで数字を共有して高め合うチームです。具体的な売上目標と過去実績の数字を必ず入れてください。

提案形式:
🎯 目標（具体的な売上目標と根拠）
📦 おすすめ商品（過去の売上データ付き）
⏰ 配信の流れ（時間配分）
💡 アドバイス（前回の実績を踏まえて）

注意: 簡潔に250文字以内。具体的な数字を使う。チームで高め合う前向きなトーンで。`;

        const userPrompt = `${liverName}さんの今日の配信提案:\n\n${contextInfo}`;

        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          maxTokens: 800,
        });

        const suggestionText = result.content || `${liverName}さん、今日も配信頑張りましょう！`;

        // Build schedule time info
        const firstSchedule = liverSchedules[0];
        const startTimeStr = firstSchedule.startTime ? new Date(firstSchedule.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '';
        const endTimeStr = firstSchedule.endTime ? new Date(firstSchedule.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '';

        allSuggestionTexts.push(`━━━━━━━━━━━━━━━\n👤 ${liverName}（${startTimeStr}${endTimeStr ? `〜${endTimeStr}` : '〜'}）\n━━━━━━━━━━━━━━━\n${suggestionText}`);

        // Save to DB (履歴として記録)
        await saveLiveSuggestion({
          targetDate: new Date(),
          liverName,
          liverId: firstSchedule.liverId ?? undefined,
          scheduleId: firstSchedule.id,
          scheduledStartTime: firstSchedule.startTime ?? undefined,
          scheduledEndTime: firstSchedule.endTime ?? undefined,
          suggestionText,
          promptUsed: userPrompt,
          sentToLineGroupId: targetGroup.lineGroupId,
          sentToLineGroupName: targetGroup.groupName,
          lineSendSuccess: false, // Will update after LINE send
          generatedBy: 'auto-scheduler',
        });

        console.log(`${LOG_PREFIX} Generated suggestion for ${liverName} ✓`);
      } catch (error) {
        console.error(`${LOG_PREFIX} Error generating suggestion for ${liverName}:`, error);
      }
    }

    // Send combined message to LINE group
    if (allSuggestionTexts.length > 0) {
      const header = `📢 【${todayStr} 今日の配信提案】\n\n今日は${allSuggestionTexts.length}名が配信予定！\nみんなで最高の配信にしましょう🔥\n`;
      const fullMessage = header + "\n" + allSuggestionTexts.join("\n\n");

      // LINE message limit is 5000 chars, split if needed
      const messages: Array<{ type: "text"; text: string }> = [];
      if (fullMessage.length <= 4900) {
        messages.push({ type: "text", text: fullMessage });
      } else {
        // Split into header + individual messages
        messages.push({ type: "text", text: header });
        let currentBatch = "";
        for (const suggestion of allSuggestionTexts) {
          if ((currentBatch + "\n\n" + suggestion).length > 4800) {
            if (currentBatch) messages.push({ type: "text", text: currentBatch });
            currentBatch = suggestion;
          } else {
            currentBatch = currentBatch ? currentBatch + "\n\n" + suggestion : suggestion;
          }
        }
        if (currentBatch) messages.push({ type: "text", text: currentBatch });
      }

      // Send to LINE group (max 5 messages per push)
      const lineSuccess = await pushMessage(targetGroup.lineGroupId, messages.slice(0, 5));

      // Update DB records with LINE send status
      const db = await getDb();
      if (db) {
        const { liveSuggestions } = await import("../drizzle/schema");
        const { gte } = await import("drizzle-orm");
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        await db.update(liveSuggestions)
          .set({
            lineSendSuccess: lineSuccess,
            lineSendError: lineSuccess ? null : 'LINE push failed',
          })
          .where(
            and(
              eq(liveSuggestions.sentToLineGroupId, targetGroup.lineGroupId),
              gte(liveSuggestions.createdAt, todayStart)
            )
          );
      }

      if (lineSuccess) {
        console.log(`${LOG_PREFIX} ✅ Successfully sent ${allSuggestionTexts.length} suggestions to ${targetGroup.groupName}`);
      } else {
        console.error(`${LOG_PREFIX} ❌ Failed to send to LINE group`);
      }
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Fatal error:`, error);
  }
}

/**
 * Check if current time is the target JST hour
 */
function isTargetJSTHour(targetHour: number): boolean {
  const now = new Date();
  const jstHour = (now.getUTCHours() + 9) % 24;
  return jstHour === targetHour;
}

/**
 * Start the daily live suggestion scheduler
 * Checks every 30 minutes, runs at JST 7:00
 */
export function startLiveSuggestionScheduler(): void {
  if (schedulerIntervalId) {
    console.log(`${LOG_PREFIX} Already running`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting scheduler (daily at JST 07:00)`);

  let lastRunDate = "";

  // Check every 30 minutes
  const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

  schedulerIntervalId = setInterval(async () => {
    try {
      const now = new Date();
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = jstNow.toISOString().split('T')[0];
      const jstHour = jstNow.getUTCHours(); // Already in JST

      // Run at JST 7:00 (UTC 22:00), only once per day
      if (isTargetJSTHour(7) && lastRunDate !== todayStr) {
        console.log(`${LOG_PREFIX} It's JST 07:00 - running daily suggestion...`);
        lastRunDate = todayStr;
        await runDailyLiveSuggestion();
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Scheduler check error:`, error);
    }
  }, CHECK_INTERVAL);
}

/**
 * Stop the scheduler
 */
export function stopLiveSuggestionScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log(`${LOG_PREFIX} Stopped`);
  }
}
