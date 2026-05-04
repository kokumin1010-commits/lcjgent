/**
 * AI配信提案 自動送信スケジューラー v2
 * 
 * 毎朝7:00 JST に今日の配信予定ライバー全員のAI提案を生成し、
 * LINEグループ「LCJ所属ライバー連絡網」に一人ずつメンション付きで送信。
 * さらに個人にもDMで同じ提案を送信する。
 * 
 * v2改善点:
 * - DB関数を個別try-catchで呼び出し（Promise.allの全滅を防止）
 * - liverId + streamerName の両方でデータ検索（V2関数使用）
 * - 直近7日間の売れ筋商品を追加
 * - 全体の売れ筋ランキングも参考情報として追加
 * - LLMプロンプトを大幅改善（具体的な数値ベースの戦略提案）
 * - lineUserIdをliverNameから直接解決（schedules.liverIdがNULLでも対応）
 */
import { getDb } from "./db";
import {
  getTodaySchedulesForSuggestion,
  getRecentLivestreamDataForSuggestion,
  getTopProductsForSuggestion,
  getRecentSetsForSuggestion,
  getLiverMonthlySummaryForSuggestion,
  getQuotaBrandsForLiver,
  getProductsByBrandIdsForSuggestion,
  saveLiveSuggestion,
  ensureLiveSuggestionsTable,
  // V2 functions
  getRecentTopProductsForLiver,
  getGlobalRecentTopProducts,
  getLiverMonthlySummaryV2,
  getRecentLivestreamDataV2,
  resolveLineUserIdByName,
  getLiverMonthlyGoalByName,
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
 * Find the target LINE group for sending suggestions
 */
async function findTargetLineGroup(): Promise<{ lineGroupId: string; groupName: string } | null> {
  const db = await getDb();
  if (!db) return null;
  
  for (const keyword of TARGET_GROUP_KEYWORDS) {
    const groups = await db
      .select({
        lineGroupId: lineGroups.lineGroupId,
        groupName: lineGroups.groupName,
      })
      .from(lineGroups)
      .where(like(lineGroups.groupName, `%${keyword}%`))
      .limit(1);
    
    if (groups.length > 0) {
      return groups[0];
    }
  }
  return null;
}

/**
 * Build a LINE text message with @mention for the group
 */
function buildMentionTextMessage(
  liverName: string,
  lineUserId: string | null,
  suggestionText: string,
  startTimeStr: string,
  endTimeStr: string,
): { type: "text"; text: string; mention?: { mentionees: Array<{ index: number; length: number; userId: string }> } } {
  const mentionTag = lineUserId ? `@${liverName}` : `👤 ${liverName}`;
  const timeInfo = `（${startTimeStr}${endTimeStr ? `〜${endTimeStr}` : '〜'}）`;
  const header = `━━━━━━━━━━━━━━━\n${mentionTag}${timeInfo}\n━━━━━━━━━━━━━━━`;
  const today = new Date().toISOString().split('T')[0];
  const coachFooter = `\n\n━━━━━━━━━━━━━━━\n💬 神コーチに相談する\nhttps://lcjmall.com/liver/coach?context=suggestion&date=${today}`;
  const fullText = `${header}\n${suggestionText}${coachFooter}`;

  if (lineUserId) {
    const mentionIndex = fullText.indexOf(mentionTag);
    return {
      type: "text",
      text: fullText,
      mention: {
        mentionees: [{
          index: mentionIndex,
          length: mentionTag.length,
          userId: lineUserId,
        }],
      },
    };
  }
  return { type: "text", text: fullText };
}

/**
 * Helper: safely call a DB function with individual error handling
 */
async function safeDbCall<T>(fn: () => Promise<T>, fallback: T, label: string, liverName: string): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    console.error(`${LOG_PREFIX} [${label}] DB error for ${liverName}: ${err.message}`);
    return fallback;
  }
}

/**
 * Main function: Generate AI suggestions for all today's livers and send individually to LINE group + DM
 */
export async function runDailyLiveSuggestion(): Promise<void> {
  console.log(`${LOG_PREFIX} Starting daily live suggestion generation (v2)...`);
  
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
    
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayStr = jstNow.toISOString().split('T')[0];
    
    // Pre-fetch global top products (shared across all livers)
    const globalTopProducts = await safeDbCall(
      () => getGlobalRecentTopProducts(7, 10),
      [],
      'globalTopProducts',
      'ALL'
    );
    console.log(`${LOG_PREFIX} Global top products: ${globalTopProducts.length} items`);
    
    // Send header message to group first
    const headerMsg = `📢 【${todayStr} 今日の配信提案】\n\n今日は${liverScheduleMap.size}名が配信予定！\nみんなで最高の配信にしましょう🔥`;
    await pushMessage(targetGroup.lineGroupId, [{ type: "text", text: headerMsg }]);
    console.log(`${LOG_PREFIX} Sent header message to group`);
    
    // Small delay between messages to avoid rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Generate and send suggestion for each liver individually
    let successCount = 0;
    const totalLivers = liverScheduleMap.size;
    let currentIndex = 0;
    
    for (const [liverName, liverSchedules] of liverScheduleMap) {
      currentIndex++;
      try {
        console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] Generating suggestion for ${liverName}...`);
        
        // ===== DB queries with INDIVIDUAL error handling (v2: no more Promise.all) =====
        
        // 1. Monthly summary (V2: uses both liverId and streamerName)
        const monthlySummary = await safeDbCall(
          () => getLiverMonthlySummaryV2(liverName),
          null,
          'monthlySummary',
          liverName
        );
        console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] monthlySummary: ${monthlySummary ? `prev=${monthlySummary.prev.hourlyRate}/h, cur=${monthlySummary.current.hourlyRate}/h` : 'null'}`);
        
        // 2. Recent top products for this liver (V2: last 7 days)
        const liverTopProducts = await safeDbCall(
          () => getRecentTopProductsForLiver(liverName, 7, 5),
          [],
          'liverTopProducts',
          liverName
        );
        console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] liverTopProducts: ${liverTopProducts.length} items`);
        
        // 3. Recent livestream data (V2: uses both liverId and streamerName)
        const recentStreams = await safeDbCall(
          () => getRecentLivestreamDataV2(liverName, 10),
          [],
          'recentStreams',
          liverName
        );
        
        // 4. Legacy top products (fallback)
        const topProducts = await safeDbCall(
          () => getTopProductsForSuggestion(liverName),
          [],
          'topProducts',
          liverName
        );
        
        // 5. Recent sets
        const recentSets = await safeDbCall(
          () => getRecentSetsForSuggestion(liverName),
          [],
          'recentSets',
          liverName
        );
        
        // 6. Quota brands
        const quotaBrands = await safeDbCall(
          () => getQuotaBrandsForLiver(liverName),
          [],
          'quotaBrands',
          liverName
        );
        
        // 7. Resolve lineUserId directly from livers table (since schedules.liverId is NULL)
        const resolvedLineUserId = await safeDbCall(
          () => resolveLineUserIdByName(liverName),
          null,
          'resolveLineUserId',
          liverName
        );
        
        // 8. Monthly goal (salesGoal, achievement rate)
        const monthlyGoal = await safeDbCall(
          () => getLiverMonthlyGoalByName(liverName),
          null,
          'monthlyGoal',
          liverName
        );
        console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] monthlyGoal: ${monthlyGoal ? `¥${monthlyGoal.salesGoal.toLocaleString()} (${monthlyGoal.achievementRate}%)` : 'null'}`);
        // Use resolved lineUserId or fall back to schedule's liverLineUserId
        const firstSchedule = liverSchedules[0];
        const lineUserId = resolvedLineUserId || firstSchedule.liverLineUserId || null;
        
        // ===== Build context info for LLM =====
        let contextInfo = `## ${liverName}さんの配信データ\n\n`;
        
        // Today's schedule
        contextInfo += `### 今日の予定\n`;
        let totalScheduledMinutes = 0;
        for (const s of liverSchedules) {
          const startTime = s.startTime ? new Date(s.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '不明';
          const endTime = s.endTime ? new Date(s.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '';
          contextInfo += `- ${startTime}${endTime ? `〜${endTime}` : ''} ${s.title}\n`;
          if (s.startTime && s.endTime) {
            let diffMs = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
            // Handle overnight streams (e.g., 22:00 -> 02:00)
            if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
            if (diffMs > 0) totalScheduledMinutes += diffMs / 60000;
          }
        }
        const scheduledHours = Math.round(totalScheduledMinutes / 60 * 10) / 10;
        if (scheduledHours > 0) {
          contextInfo += `→ 合計配信予定: ${scheduledHours}時間\n`;
        }
        
        // Monthly goal (from liver_goals table)
        if (monthlyGoal && monthlyGoal.salesGoal > 0) {
          contextInfo += `\n### 🎯 月間目標\n`;
          contextInfo += `月間売上目標: ¥${monthlyGoal.salesGoal.toLocaleString()}\n`;
          contextInfo += `今月の売上実績: ¥${monthlyGoal.currentSales.toLocaleString()}\n`;
          contextInfo += `達成率: ${monthlyGoal.achievementRate}%\n`;
          const remaining = monthlyGoal.salesGoal - monthlyGoal.currentSales;
          if (remaining > 0) {
            contextInfo += `残り: ¥${remaining.toLocaleString()}\n`;
            if (monthlyGoal.streamCountGoal > 0) {
              const remainingStreams = Math.max(0, monthlyGoal.streamCountGoal - monthlyGoal.currentStreamCount);
              if (remainingStreams > 0) {
                const perStream = Math.round(remaining / remainingStreams);
                contextInfo += `残り配信回数: ${remainingStreams}回（1配信あたり¥${perStream.toLocaleString()}必要）\n`;
              }
            }
          }
        }
        
        // Monthly performance (MOST IMPORTANT)
        if (monthlySummary) {
          const cur = monthlySummary.current;
          const prev = monthlySummary.prev;
          const effectiveHourlyRate = cur.hourlyRate > 0 ? cur.hourlyRate : prev.hourlyRate;
          const rateSource = cur.hourlyRate > 0 ? '今月実績' : '先月実績';
          
          contextInfo += `\n### ★月間実績\n`;
          if (effectiveHourlyRate > 0) {
            contextInfo += `★あなたの平均時間単価: ¥${effectiveHourlyRate.toLocaleString()}（${rateSource}）\n`;
            if (scheduledHours > 0) {
              const targetSales = Math.round(effectiveHourlyRate * scheduledHours);
              contextInfo += `★今日の売上目標（自動計算）: ¥${targetSales.toLocaleString()}（= 時間単価¥${effectiveHourlyRate.toLocaleString()} × ${scheduledHours}h）\n`;
            }
          } else {
            contextInfo += `★時間単価: データ不足\n`;
          }
          contextInfo += `今月: ${cur.livestreamCount}配信 / 売上¥${cur.sales.toLocaleString()} / ${cur.durationHours}h / 時間単価¥${cur.hourlyRate.toLocaleString()}\n`;
          contextInfo += `先月: ${prev.livestreamCount}配信 / 売上¥${prev.sales.toLocaleString()} / ${prev.durationHours}h / 時間単価¥${prev.hourlyRate.toLocaleString()}\n`;
          
          // Trend analysis
          if (prev.hourlyRate > 0 && cur.hourlyRate > 0) {
            const trend = Math.round((cur.hourlyRate - prev.hourlyRate) / prev.hourlyRate * 100);
            contextInfo += `時間単価トレンド: ${trend >= 0 ? `+${trend}%（上昇中）` : `${trend}%（下降中）`}\n`;
          }
        }
        
        // Recent livestream details
        if (recentStreams.length > 0) {
          contextInfo += `\n### 直近の配信実績（最新5件）\n`;
          for (const s of recentStreams.slice(0, 5)) {
            const date = s.livestreamDate ? new Date(s.livestreamDate).toLocaleDateString('ja-JP') : '不明';
            const sales = s.salesAmount ? `¥${Number(s.salesAmount).toLocaleString()}` : '¥0';
            const dur = s.duration ? `${Math.round(Number(s.duration) / 60 * 10) / 10}h` : '';
            const hourly = s.salesAmount && s.duration && Number(s.duration) > 0 
              ? `(時間単価¥${Math.round(Number(s.salesAmount) / (Number(s.duration) / 60)).toLocaleString()})` 
              : '';
            contextInfo += `- ${date}: ${s.brandName || ''} / 売上${sales} ${dur} ${hourly}\n`;
          }
        }
        
        // Products section: prioritize liver's recent top products
        const allProducts = liverTopProducts.length > 0 ? liverTopProducts : topProducts;
        if (allProducts.length > 0) {
          contextInfo += `\n### ★あなたの直近売れ筋商品（この商品名をそのまま使え）\n`;
          for (const p of allProducts.slice(0, 5)) {
            const gmv = Number(p.totalGmv || 0);
            const sold = Number(p.totalItemsSold || 0);
            contextInfo += `- 「${p.productName}」: 売上¥${gmv.toLocaleString()}${sold > 0 ? `（${sold}個）` : ''}\n`;
          }
        } else {
          // Fallback: try brand products from schedule
          const brandIds = liverSchedules
            .map(s => s.brandId)
            .filter((id): id is number => id != null && id > 0);
          
          if (brandIds.length > 0) {
            try {
              const masterProducts = await getProductsByBrandIdsForSuggestion(Array.from(new Set(brandIds)), 10);
              if (masterProducts.length > 0) {
                contextInfo += `\n### ★取扱商品一覧（この商品名をそのまま使え）\n`;
                for (const p of masterProducts) {
                  const price = p.regularPrice ? `¥${Number(p.regularPrice).toLocaleString()}` : '';
                  contextInfo += `- 「${p.productName}」${p.brandName ? `(${p.brandName})` : ''} ${price}\n`;
                }
              }
            } catch (fallbackErr: any) {
              console.error(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] Product master fallback error: ${fallbackErr.message}`);
            }
          }
        }
        
        // Global trending products (reference)
        if (globalTopProducts.length > 0) {
          contextInfo += `\n### 📈 全体の直近7日間売れ筋TOP5（参考）\n`;
          for (const p of globalTopProducts.slice(0, 5)) {
            contextInfo += `- 「${p.productName}」: ¥${Number(p.totalGmv || 0).toLocaleString()}\n`;
          }
        }
        
        // Sets
        if (recentSets.length > 0) {
          contextInfo += `\n### よく使うセット\n`;
          for (const s of recentSets.slice(0, 3)) {
            contextInfo += `- ${s.name}\n`;
          }
        }
        
        // Quota brands
        if (quotaBrands.length > 0) {
          contextInfo += `\n### ⚠️ ノルマあり契約ブランド（優先的に配信に組み込むこと）\n`;
          for (const qb of quotaBrands) {
            const liverH = qb.liverQuotaMinutes > 0 ? `达人ノルマ: ${Math.round(qb.liverQuotaMinutes / 60 * 10) / 10}h/月` : '';
            const kgH = qb.kgQuotaMinutes > 0 ? `KGノルマ: ${Math.round(qb.kgQuotaMinutes / 60 * 10) / 10}h/月` : '';
            contextInfo += `- **${qb.brandName}**: ${[liverH, kgH].filter(Boolean).join(' / ')}\n`;
          }
        }
        
        // ===== LLM Prompt (v2: much more specific) =====
        const systemPrompt = `あなたはTikTokライブコマースの配信コーチです。
ライバーの実際の売上データを分析し、今日の配信に直接役立つ具体的な提案を作成してください。

【出力フォーマット（厳守）】
🎯 目標:
• 今日の配信: [配信時間]時間
• 時間単価: ¥[XX,XXX]（[今月/先月]実績）
• 今日の売上目安: ¥[XX,XXX]（時間単価×配信時間）
• 月間目標: ¥[X,XXX,XXX] / 達成率[XX]% / 残り¥[X,XXX,XXX]

📦 推奨商品（売れ筋順）:
1. [データの売れ筋リストから商品名をそのままコピー] - [なぜこの商品を推すか1行]
2. [同上]
3. [同上]

⏰ 配信タイムライン:
- [開始]〜[+30分]: オープニング・軽い商品紹介（視聴者を温める）
- [+30分]〜[中盤]: メイン商品のデモ・比較（購買意欲を高める）
- [中盤]〜[終盤-30分]: セット販売・限定オファー（単価アップ）
- [終盤-30分]〜[終了]: ラストチャンス告知・まとめ

💡 今日の戦略:
[月間目標の達成状況と時間単価のトレンドに基づく具体的アドバイス。例：「月間目標まであと¥XX万、今日は高単価商品Xを前半に持ってきて早めに売上を作りましょう」]

【絶対厳守ルール】
- 目標セクションの数値はデータの数値をそのまま使え。自分で計算するな
- 「今日の売上目標（自動計算）」がデータにあればその数値をそのまま使う
- 月間目標データがあれば必ず目標セクションに含めること
- 商品名はデータの「売れ筋商品」「取扱商品一覧」「全体の売れ筋」からそのまま引用。架空の商品名は絶対禁止
- 商品データがない場合、商品セクションは省略
- ノルマありブランドの商品を最優先で推奨
- 配信タイムラインは実際のスケジュール時間に合わせる
- 500文字以内。前向きで具体的なトーンで`;

        const userPrompt = `${liverName}さんの今日の配信提案:\n\n${contextInfo}`;
        
        // LLM call
        let suggestionText = '';
        try {
          console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] Calling LLM for ${liverName}...`);
          const result = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            maxTokens: 1000,
          });
          suggestionText = (typeof result.choices?.[0]?.message?.content === 'string' ? result.choices[0].message.content : '') || '';
          console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] LLM response received for ${liverName} (${suggestionText.length} chars)`);
        } catch (llmErr: any) {
          console.error(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] LLM error for ${liverName}: ${llmErr.message}`);
          suggestionText = '';
        }
        
        // Fallback message
        if (!suggestionText.trim()) {
          const effectiveRate = monthlySummary 
            ? (monthlySummary.current.hourlyRate > 0 ? monthlySummary.current.hourlyRate : monthlySummary.prev.hourlyRate)
            : 0;
          let fallbackGoal = '';
          if (effectiveRate > 0 && scheduledHours > 0) {
            fallbackGoal += `🎯 目標:\n• 今日の配信: ${scheduledHours}時間\n• 時間単価: ¥${effectiveRate.toLocaleString()}\n• 今日の売上目安: ¥${Math.round(effectiveRate * scheduledHours).toLocaleString()}`;
          }
          if (monthlyGoal && monthlyGoal.salesGoal > 0) {
            const remaining = monthlyGoal.salesGoal - monthlyGoal.currentSales;
            fallbackGoal += `${fallbackGoal ? '\n' : '🎯 目標:\n'}• 月間目標: ¥${monthlyGoal.salesGoal.toLocaleString()} / 達成率${monthlyGoal.achievementRate}% / 残り¥${remaining.toLocaleString()}`;
          }
          if (fallbackGoal) {
            suggestionText = `${fallbackGoal}\n\n${liverName}さん、今日も配信頑張りましょう！🔥\n視聴者とのコミュニケーションを大切に、楽しい配信を目指しましょう！`;
          } else {
            suggestionText = `${liverName}さん、今日も配信頑張りましょう！🔥\n視聴者とのコミュニケーションを大切に、楽しい配信を目指しましょう！`;
          }
          console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] Using fallback message for ${liverName}`);
        }
        
        // Build time strings for message
        const startTimeStr = firstSchedule.startTime
          ? new Date(firstSchedule.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
          : '';
        const endTimeStr = firstSchedule.endTime
          ? new Date(firstSchedule.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
          : '';
        
        // 1. Send to GROUP with mention
        const groupMessage = buildMentionTextMessage(liverName, lineUserId, suggestionText, startTimeStr, endTimeStr);
        console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] Sending group message for ${liverName}...`);
        const groupSuccess = await pushMessage(targetGroup.lineGroupId, [groupMessage]);
        
        if (groupSuccess) {
          console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] ✅ Sent to group for ${liverName}${lineUserId ? ' (with mention)' : ' (no mention - no lineUserId)'}`);
        } else {
          console.error(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] ❌ Failed to send to group for ${liverName}`);
        }
        
        // Wait between group message and DM to avoid rate limiting
        await delay(1000);
        
        // 2. Send DM to individual liver (if lineUserId exists)
        let dmSuccess = false;
        if (lineUserId) {
          const coachLink = `https://lcjmall.com/liver/coach?context=suggestion&date=${todayStr}`;
          const dmText = `📢 【${todayStr} あなたへの配信提案】\n\n${liverName}さん、今日の配信頑張りましょう！\n\n${suggestionText}\n\n━━━━━━━━━━━━━━━\n💬 もっと詳しく相談したい？\n👇 神コーチに聞いてみよう\n${coachLink}`;
          dmSuccess = await pushMessage(lineUserId, [{ type: "text", text: dmText }]);
          if (dmSuccess) {
            console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] ✅ Sent DM to ${liverName}`);
          } else {
            console.error(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] ❌ Failed to send DM to ${liverName}`);
          }
        } else {
          console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] ⚠️ No lineUserId for ${liverName}, skipping DM`);
        }
        
        // Save to DB
        try {
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
            lineSendSuccess: groupSuccess,
            lineSendError: groupSuccess ? (dmSuccess || !lineUserId ? null : 'DM failed') : 'Group send failed',
            generatedBy: 'auto-scheduler',
          });
        } catch (saveErr: any) {
          console.error(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] DB save error for ${liverName}: ${saveErr.message}`);
        }
        
        successCount++;
        console.log(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] ✓ Completed for ${liverName}`);
        
        // Delay between livers to avoid LINE API rate limiting
        await delay(2000);
        
      } catch (error: any) {
        console.error(`${LOG_PREFIX} [${currentIndex}/${totalLivers}] ❌ Unexpected error for ${liverName}: ${error.message}`, error.stack || '');
        await delay(1000);
      }
    }
    
    console.log(`${LOG_PREFIX} ✅ Completed: ${successCount}/${totalLivers} suggestions sent individually to group${successCount > 0 ? ' + DMs' : ''}`);
    
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

/**
 * Run suggestion for a SINGLE liver (for testing)
 * Same logic as runDailyLiveSuggestion but for one person only
 */
export async function runSingleLiverSuggestion(targetLiverName: string): Promise<{
  success: boolean;
  message: string;
  suggestionText?: string;
  promptUsed?: string;
  dataStats?: Record<string, number | boolean>;
}> {
  console.log(`${LOG_PREFIX} [SingleLiver] Starting for ${targetLiverName}...`);
  
  try {
    await ensureLiveSuggestionsTable();
    
    const targetGroup = await findTargetLineGroup();
    if (!targetGroup) {
      return { success: false, message: "No target LINE group found" };
    }
    
    // Get today's schedules
    const todaySchedules = await getTodaySchedulesForSuggestion();
    
    // Find schedules for this liver
    const liverSchedules = todaySchedules.filter(s => {
      const name = s.liverName || s.title;
      return name === targetLiverName;
    });
    
    if (liverSchedules.length === 0) {
      return { success: false, message: `${targetLiverName}の今日のスケジュールが見つかりません` };
    }
    
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayStr = jstNow.toISOString().split('T')[0];
    
    // Pre-fetch global top products
    const globalTopProducts = await safeDbCall(
      () => getGlobalRecentTopProducts(7, 10),
      [],
      'globalTopProducts',
      targetLiverName
    );
    
    // ===== DB queries with INDIVIDUAL error handling =====
    const monthlySummary = await safeDbCall(
      () => getLiverMonthlySummaryV2(targetLiverName),
      null,
      'monthlySummary',
      targetLiverName
    );
    console.log(`${LOG_PREFIX} [SingleLiver] monthlySummary: ${monthlySummary ? `prev=${monthlySummary.prev.hourlyRate}/h, cur=${monthlySummary.current.hourlyRate}/h` : 'null'}`);
    
    const liverTopProducts = await safeDbCall(
      () => getRecentTopProductsForLiver(targetLiverName, 7, 5),
      [],
      'liverTopProducts',
      targetLiverName
    );
    console.log(`${LOG_PREFIX} [SingleLiver] liverTopProducts: ${liverTopProducts.length} items`);
    
    const recentStreams = await safeDbCall(
      () => getRecentLivestreamDataV2(targetLiverName, 10),
      [],
      'recentStreams',
      targetLiverName
    );
    
    const topProducts = await safeDbCall(
      () => getTopProductsForSuggestion(targetLiverName),
      [],
      'topProducts',
      targetLiverName
    );
    
    const recentSets = await safeDbCall(
      () => getRecentSetsForSuggestion(targetLiverName),
      [],
      'recentSets',
      targetLiverName
    );
    
    const quotaBrands = await safeDbCall(
      () => getQuotaBrandsForLiver(targetLiverName),
      [],
      'quotaBrands',
      targetLiverName
    );
    
    const resolvedLineUserId = await safeDbCall(
      () => resolveLineUserIdByName(targetLiverName),
      null,
      'resolveLineUserId',
      targetLiverName
    );
    
    // 8. Monthly goal
    const monthlyGoal = await safeDbCall(
      () => getLiverMonthlyGoalByName(targetLiverName),
      null,
      'monthlyGoal',
      targetLiverName
    );
    console.log(`${LOG_PREFIX} [SingleLiver] monthlyGoal: ${monthlyGoal ? `\u00a5${monthlyGoal.salesGoal.toLocaleString()} (${monthlyGoal.achievementRate}%)` : 'null'}`);
    
    const firstSchedule = liverSchedules[0];
    const lineUserId = resolvedLineUserId || firstSchedule.liverLineUserId || null;
    
    // ===== Build context info for LLM =====
    let contextInfo = `## ${targetLiverName}さんの配信データ\n\n`;
    
    contextInfo += `### 今日の予定\n`;
    let totalScheduledMinutes = 0;
    for (const s of liverSchedules) {
      const startTime = s.startTime ? new Date(s.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '不明';
      const endTime = s.endTime ? new Date(s.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '';
      contextInfo += `- ${startTime}${endTime ? `〜${endTime}` : ''} ${s.title}\n`;
      if (s.startTime && s.endTime) {
        let diffMs = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
        // Handle overnight streams (e.g., 22:00 -> 02:00)
        if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
        if (diffMs > 0) totalScheduledMinutes += diffMs / 60000;
      }
    }
    const scheduledHours = Math.round(totalScheduledMinutes / 60 * 10) / 10;
    if (scheduledHours > 0) {
      contextInfo += `→ 合計配信予定: ${scheduledHours}時間\n`;
    }
    
    // Monthly goal (from liver_goals table)
    if (monthlyGoal && monthlyGoal.salesGoal > 0) {
      contextInfo += `\n### 🎯 月間目標\n`;
      contextInfo += `月間売上目標: ¥${monthlyGoal.salesGoal.toLocaleString()}\n`;
      contextInfo += `今月の売上実績: ¥${monthlyGoal.currentSales.toLocaleString()}\n`;
      contextInfo += `達成率: ${monthlyGoal.achievementRate}%\n`;
      const remaining = monthlyGoal.salesGoal - monthlyGoal.currentSales;
      if (remaining > 0) {
        contextInfo += `残り: ¥${remaining.toLocaleString()}\n`;
        if (monthlyGoal.streamCountGoal > 0) {
          const remainingStreams = Math.max(0, monthlyGoal.streamCountGoal - monthlyGoal.currentStreamCount);
          if (remainingStreams > 0) {
            const perStream = Math.round(remaining / remainingStreams);
            contextInfo += `残り配信回数: ${remainingStreams}回（1配信あたり¥${perStream.toLocaleString()}必要）\n`;
          }
        }
      }
    }
    
    if (monthlySummary) {
      const cur = monthlySummary.current;
      const prev = monthlySummary.prev;
      const effectiveHourlyRate = cur.hourlyRate > 0 ? cur.hourlyRate : prev.hourlyRate;
      const rateSource = cur.hourlyRate > 0 ? '今月実績' : '先月実績';
      
      contextInfo += `\n### ★月間実績\n`;
      if (effectiveHourlyRate > 0) {
        contextInfo += `★あなたの平均時間単価: ¥${effectiveHourlyRate.toLocaleString()}（${rateSource}）\n`;
        if (scheduledHours > 0) {
          const targetSales = Math.round(effectiveHourlyRate * scheduledHours);
          contextInfo += `★今日の売上目標（自動計算）: ¥${targetSales.toLocaleString()}（= 時間単価¥${effectiveHourlyRate.toLocaleString()} × ${scheduledHours}h）\n`;
        }
      } else {
        contextInfo += `★時間単価: データ不足\n`;
      }
      contextInfo += `今月: ${cur.livestreamCount}配信 / 売上¥${cur.sales.toLocaleString()} / ${cur.durationHours}h / 時間単価¥${cur.hourlyRate.toLocaleString()}\n`;
      contextInfo += `先月: ${prev.livestreamCount}配信 / 売上¥${prev.sales.toLocaleString()} / ${prev.durationHours}h / 時間単価¥${prev.hourlyRate.toLocaleString()}\n`;
      
      if (prev.hourlyRate > 0 && cur.hourlyRate > 0) {
        const trend = Math.round((cur.hourlyRate - prev.hourlyRate) / prev.hourlyRate * 100);
        contextInfo += `時間単価トレンド: ${trend >= 0 ? `+${trend}%（上昇中）` : `${trend}%（下降中）`}\n`;
      }
    }
    
    if (recentStreams.length > 0) {
      contextInfo += `\n### 直近の配信実績（最新5件）\n`;
      for (const s of recentStreams.slice(0, 5)) {
        const date = s.livestreamDate ? new Date(s.livestreamDate).toLocaleDateString('ja-JP') : '不明';
        const sales = s.salesAmount ? `¥${Number(s.salesAmount).toLocaleString()}` : '¥0';
        const dur = s.duration ? `${Math.round(Number(s.duration) / 60 * 10) / 10}h` : '';
        const hourly = s.salesAmount && s.duration && Number(s.duration) > 0 
          ? `(時間単価¥${Math.round(Number(s.salesAmount) / (Number(s.duration) / 60)).toLocaleString()})` 
          : '';
        contextInfo += `- ${date}: ${s.brandName || ''} / 売上${sales} ${dur} ${hourly}\n`;
      }
    }
    
    const allProducts = liverTopProducts.length > 0 ? liverTopProducts : topProducts;
    if (allProducts.length > 0) {
      contextInfo += `\n### ★あなたの直近売れ筋商品（この商品名をそのまま使え）\n`;
      for (const p of allProducts.slice(0, 5)) {
        const gmv = Number(p.totalGmv || 0);
        const sold = Number(p.totalItemsSold || 0);
        contextInfo += `- 「${p.productName}」: 売上¥${gmv.toLocaleString()}${sold > 0 ? `（${sold}個）` : ''}\n`;
      }
    } else {
      const brandIds = liverSchedules
        .map(s => s.brandId)
        .filter((id): id is number => id != null && id > 0);
      if (brandIds.length > 0) {
        try {
          const masterProducts = await getProductsByBrandIdsForSuggestion(Array.from(new Set(brandIds)), 10);
          if (masterProducts.length > 0) {
            contextInfo += `\n### ★取扱商品一覧（この商品名をそのまま使え）\n`;
            for (const p of masterProducts) {
              const price = p.regularPrice ? `¥${Number(p.regularPrice).toLocaleString()}` : '';
              contextInfo += `- 「${p.productName}」${p.brandName ? `(${p.brandName})` : ''} ${price}\n`;
            }
          }
        } catch (fallbackErr: any) {
          console.error(`${LOG_PREFIX} [SingleLiver] Product master fallback error: ${fallbackErr.message}`);
        }
      }
    }
    
    if (globalTopProducts.length > 0) {
      contextInfo += `\n### 📈 全体の直近7日間売れ筋TOP5（参考）\n`;
      for (const p of globalTopProducts.slice(0, 5)) {
        contextInfo += `- 「${p.productName}」: ¥${Number(p.totalGmv || 0).toLocaleString()}\n`;
      }
    }
    
    if (recentSets.length > 0) {
      contextInfo += `\n### よく使うセット\n`;
      for (const s of recentSets.slice(0, 3)) {
        contextInfo += `- ${s.name}\n`;
      }
    }
    
    if (quotaBrands.length > 0) {
      contextInfo += `\n### ⚠️ ノルマあり契約ブランド（優先的に配信に組み込むこと）\n`;
      for (const qb of quotaBrands) {
        const liverH = qb.liverQuotaMinutes > 0 ? `达人ノルマ: ${Math.round(qb.liverQuotaMinutes / 60 * 10) / 10}h/月` : '';
        const kgH = qb.kgQuotaMinutes > 0 ? `KGノルマ: ${Math.round(qb.kgQuotaMinutes / 60 * 10) / 10}h/月` : '';
        contextInfo += `- **${qb.brandName}**: ${[liverH, kgH].filter(Boolean).join(' / ')}\n`;
      }
    }
    
    // ===== LLM Prompt =====
    const systemPrompt = `あなたはTikTokライブコマースの配信コーチです。
ライバーの実際の売上データを分析し、今日の配信に直接役立つ具体的な提案を作成してください。

【出力フォーマット（厳守）】
🎯 目標:
• 今日の配信: [配信時間]時間
• 時間単価: ¥[XX,XXX]（[今月/先月]実績）
• 今日の売上目安: ¥[XX,XXX]（時間単価×配信時間）
• 月間目標: ¥[X,XXX,XXX] / 達成率[XX]% / 残り¥[X,XXX,XXX]

📦 推奨商品（売れ筋順）:
1. [データの売れ筋リストから商品名をそのままコピー] - [なぜこの商品を推すか1行]
2. [同上]
3. [同上]

⏰ 配信タイムライン:
- [開始]〜[+30分]: オープニング・軽い商品紹介（視聴者を温める）
- [+30分]〜[中盤]: メイン商品のデモ・比較（購買意欲を高める）
- [中盤]〜[終盤-30分]: セット販売・限定オファー（単価アップ）
- [終盤-30分]〜[終了]: ラストチャンス告知・まとめ

💡 今日の戦略:
[月間目標の達成状況と時間単価のトレンドに基づく具体的アドバイス。例：「月間目標まであと¥XX万、今日は高単価商品Xを前半に持ってきて早めに売上を作りましょう」]

【絶対厳守ルール】
- 目標セクションの数値はデータの数値をそのまま使え。自分で計算するな
- 「今日の売上目標（自動計算）」がデータにあればその数値をそのまま使う
- 月間目標データがあれば必ず目標セクションに含めること
- 商品名はデータの「売れ筋商品」「取扱商品一覧」「全体の売れ筋」からそのまま引用。架空の商品名は絶対禁止
- 商品データがない場合、商品セクションは省略
- ノルマありブランドの商品を最優先で推奨
- 配信タイムラインは実際のスケジュール時間に合わせる
- 500文字以内。前向きで具体的なトーンで`;

    const userPrompt = `${targetLiverName}さんの今日の配信提案:\n\n${contextInfo}`;
    
    let suggestionText = '';
    try {
      console.log(`${LOG_PREFIX} [SingleLiver] Calling LLM for ${targetLiverName}...`);
      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1000,
      });
      suggestionText = (typeof result.choices?.[0]?.message?.content === 'string' ? result.choices[0].message.content : '') || '';
      console.log(`${LOG_PREFIX} [SingleLiver] LLM response: ${suggestionText.length} chars`);
    } catch (llmErr: any) {
      console.error(`${LOG_PREFIX} [SingleLiver] LLM error: ${llmErr.message}`);
    }
    
    if (!suggestionText.trim()) {
      const effectiveRate = monthlySummary 
        ? (monthlySummary.current.hourlyRate > 0 ? monthlySummary.current.hourlyRate : monthlySummary.prev.hourlyRate)
        : 0;
      if (effectiveRate > 0 && scheduledHours > 0) {
        suggestionText = `🎯 目標: ¥${Math.round(effectiveRate * scheduledHours).toLocaleString()}（時間単価¥${effectiveRate.toLocaleString()} × ${scheduledHours}h）\n\n${targetLiverName}さん、今日も配信頑張りましょう！🔥`;
      } else {
        suggestionText = `${targetLiverName}さん、今日も配信頑張りましょう！🔥`;
      }
    }
    
    // Build time strings
    const startTimeStr = firstSchedule.startTime
      ? new Date(firstSchedule.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
      : '';
    const endTimeStr = firstSchedule.endTime
      ? new Date(firstSchedule.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
      : '';
    
    // Send to GROUP with mention
    const groupMessage = buildMentionTextMessage(targetLiverName, lineUserId, suggestionText, startTimeStr, endTimeStr);
    const groupSuccess = await pushMessage(targetGroup.lineGroupId, [groupMessage]);
    console.log(`${LOG_PREFIX} [SingleLiver] Group send: ${groupSuccess ? '✅' : '❌'}`);
    
    // Send DM
    let dmSuccess = false;
    if (lineUserId) {
      const coachLink = `https://lcjmall.com/liver/coach?context=suggestion&date=${todayStr}`;
      const dmText = `📢 【${todayStr} あなたへの配信提案】\n\n${targetLiverName}さん、今日の配信頑張りましょう！\n\n${suggestionText}\n\n━━━━━━━━━━━━━━━\n💬 もっと詳しく相談したい？\n👇 神コーチに聞いてみよう\n${coachLink}`;
      dmSuccess = await pushMessage(lineUserId, [{ type: "text", text: dmText }]);
      console.log(`${LOG_PREFIX} [SingleLiver] DM send: ${dmSuccess ? '✅' : '❌'}`);
    }
    
    // Save to DB
    try {
      await saveLiveSuggestion({
        targetDate: new Date(),
        liverName: targetLiverName,
        liverId: firstSchedule.liverId ?? undefined,
        scheduleId: firstSchedule.id,
        scheduledStartTime: firstSchedule.startTime ?? undefined,
        scheduledEndTime: firstSchedule.endTime ?? undefined,
        suggestionText,
        promptUsed: userPrompt,
        sentToLineGroupId: targetGroup.lineGroupId,
        sentToLineGroupName: targetGroup.groupName,
        lineSendSuccess: groupSuccess,
        lineSendError: groupSuccess ? null : 'Group send failed',
        generatedBy: 'manual-single-test',
      });
    } catch (saveErr: any) {
      console.error(`${LOG_PREFIX} [SingleLiver] DB save error: ${saveErr.message}`);
    }
    
    return {
      success: groupSuccess,
      message: `${targetLiverName}: グループ送信${groupSuccess ? '成功' : '失敗'}, DM${dmSuccess ? '成功' : lineUserId ? '失敗' : 'スキップ(lineUserId無し)'}`,
      suggestionText,
      promptUsed: userPrompt,
      dataStats: {
        monthlySummary: !!monthlySummary,
        liverTopProducts: liverTopProducts.length,
        recentStreams: recentStreams.length,
        topProducts: topProducts.length,
        recentSets: recentSets.length,
        quotaBrands: quotaBrands.length,
        globalTopProducts: globalTopProducts.length,
        hasLineUserId: !!lineUserId,
      },
    };
    
  } catch (error: any) {
    console.error(`${LOG_PREFIX} [SingleLiver] Fatal error:`, error);
    return { success: false, message: `Error: ${error.message}` };
  }
}
