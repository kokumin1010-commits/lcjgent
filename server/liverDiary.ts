/**
 * ライバー日報（振り返り）機能
 * 
 * - 配信後に「今日の一言」を入力（30秒で完了）
 * - 月末に「今月の振り返りまとめ」が自動生成される
 * - 成長の記録がLCJにしかない → 離脱コスト
 */

import { getDb } from "./db";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { pushMessage } from "./line";
import { livers } from "../drizzle/schema";

const LOG_PREFIX = "[Liver Diary]";

/**
 * Ensure liver_diaries table exists
 */
export async function ensureLiverDiariesTable(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS liver_diaries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        liver_id INT NOT NULL,
        liver_name VARCHAR(255) NOT NULL,
        livestream_id INT NULL,
        diary_date DATE NOT NULL,
        note TEXT NOT NULL,
        mood ENUM('great', 'good', 'normal', 'bad', 'terrible') DEFAULT 'normal',
        sales_amount DECIMAL(12,2) DEFAULT 0,
        duration_minutes INT DEFAULT 0,
        hourly_rate DECIMAL(10,2) DEFAULT 0,
        ai_feedback TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_liver_date (liver_id, diary_date),
        INDEX idx_liver_name_date (liver_name, diary_date)
      )
    `);
    console.log(`${LOG_PREFIX} liver_diaries table ensured`);
  } catch (err: any) {
    if (!err.message?.includes("already exists")) {
      console.error(`${LOG_PREFIX} Error ensuring table:`, err);
    }
  }
}

/**
 * Save a diary entry
 */
export async function saveDiaryEntry(params: {
  liverId: number;
  liverName: string;
  livestreamId?: number;
  diaryDate: string; // YYYY-MM-DD
  note: string;
  mood?: "great" | "good" | "normal" | "bad" | "terrible";
  salesAmount?: number;
  durationMinutes?: number;
  hourlyRate?: number;
}): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await ensureLiverDiariesTable();

    const result = await db.execute(sql`
      INSERT INTO liver_diaries (liver_id, liver_name, livestream_id, diary_date, note, mood, sales_amount, duration_minutes, hourly_rate)
      VALUES (${params.liverId}, ${params.liverName}, ${params.livestreamId || null}, ${params.diaryDate}, ${params.note}, ${params.mood || 'normal'}, ${params.salesAmount || 0}, ${params.durationMinutes || 0}, ${params.hourlyRate || 0})
      ON DUPLICATE KEY UPDATE note = VALUES(note), mood = VALUES(mood), updated_at = NOW()
    `);

    return { id: (result as any).insertId || 0 };
  } catch (err) {
    console.error(`${LOG_PREFIX} saveDiaryEntry error:`, err);
    return null;
  }
}

/**
 * Get diary entries for a liver in a month
 */
export async function getDiaryEntries(liverName: string, month: string): Promise<Array<{
  id: number;
  diaryDate: string;
  note: string;
  mood: string;
  salesAmount: number;
  durationMinutes: number;
  hourlyRate: number;
  aiFeedback: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];

  try {
    await ensureLiverDiariesTable();

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-31`;

    const result = await db.execute(sql`
      SELECT id, diary_date as diaryDate, note, mood, sales_amount as salesAmount, 
             duration_minutes as durationMinutes, hourly_rate as hourlyRate, ai_feedback as aiFeedback
      FROM liver_diaries 
      WHERE liver_name = ${liverName} AND diary_date >= ${startDate} AND diary_date <= ${endDate}
      ORDER BY diary_date DESC
    `);

    const rows = (result as any).rows || result;
    return Array.isArray(rows) ? rows.map((r: any) => ({
      id: r.id,
      diaryDate: r.diaryDate ? String(r.diaryDate).split('T')[0] : '',
      note: r.note || '',
      mood: r.mood || 'normal',
      salesAmount: Number(r.salesAmount || 0),
      durationMinutes: Number(r.durationMinutes || 0),
      hourlyRate: Number(r.hourlyRate || 0),
      aiFeedback: r.aiFeedback || null,
    })) : [];
  } catch (err) {
    console.error(`${LOG_PREFIX} getDiaryEntries error:`, err);
    return [];
  }
}

/**
 * Generate monthly summary using AI
 */
export async function generateMonthlySummary(liverName: string, month: string): Promise<string | null> {
  try {
    const entries = await getDiaryEntries(liverName, month);
    if (entries.length === 0) return null;

    const totalSales = entries.reduce((sum, e) => sum + e.salesAmount, 0);
    const totalDuration = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
    const avgHourlyRate = totalDuration > 0 ? Math.round(totalSales / (totalDuration / 60)) : 0;
    const moodCounts = entries.reduce((acc, e) => {
      acc[e.mood] = (acc[e.mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const diaryTexts = entries.map(e => `${e.diaryDate}: [${e.mood}] ${e.note}`).join('\n');

    const prompt = `以下は${liverName}さんの${month}月の配信日報です。
配信回数: ${entries.length}回
合計売上: ¥${totalSales.toLocaleString()}
合計配信時間: ${Math.round(totalDuration / 60 * 10) / 10}時間
平均時間単価: ¥${avgHourlyRate.toLocaleString()}/h
気分: ${Object.entries(moodCounts).map(([k, v]) => `${k}:${v}回`).join(', ')}

日報内容:
${diaryTexts}

上記を踏まえて、200文字以内で今月の振り返りまとめを作成してください。
- 良かった点
- 改善できる点
- 来月に向けたアドバイス
前向きで具体的なトーンで。`;

    const result = await invokeLLM({
      messages: [
        { role: "system", content: "あなたはTikTokライブコマースのコーチです。ライバーの月間振り返りを作成してください。" },
        { role: "user", content: prompt },
      ],
      maxTokens: 500,
    });

    return result.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error(`${LOG_PREFIX} generateMonthlySummary error:`, err);
    return null;
  }
}

/**
 * Get streak (consecutive days with diary entries)
 */
export async function getDiaryStreak(liverName: string): Promise<{ currentStreak: number; longestStreak: number; totalEntries: number }> {
  const db = await getDb();
  if (!db) return { currentStreak: 0, longestStreak: 0, totalEntries: 0 };

  try {
    await ensureLiverDiariesTable();

    const result = await db.execute(sql`
      SELECT diary_date FROM liver_diaries 
      WHERE liver_name = ${liverName}
      ORDER BY diary_date DESC
    `);

    const rows = (result as any).rows || result;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { currentStreak: 0, longestStreak: 0, totalEntries: 0 };
    }

    const dates = rows.map((r: any) => {
      const d = new Date(r.diary_date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    let checkDate = new Date(today);
    for (let i = 0; i < dates.length; i++) {
      const checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (dates.includes(checkStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0 && checkStr === todayStr) {
        // Today not yet recorded, check yesterday
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000);
      if (Math.abs(diffDays - 1) < 0.1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
      currentStreak,
      longestStreak,
      totalEntries: dates.length,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} getDiaryStreak error:`, err);
    return { currentStreak: 0, longestStreak: 0, totalEntries: 0 };
  }
}
