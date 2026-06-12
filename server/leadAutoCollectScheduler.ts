/**
 * Lead Auto-Collect Scheduler
 * 
 * 每2時間ごとにsalesdash.buzzdrop.co.jpのGoogle Maps APIを自動呼び出し、
 * 美容関連リードを自動収集する。
 * 
 * 収集完了後、結果をログに記録し、notifyOwnerで通知する。
 * 
 * 収集キーワードはローテーションで回す（毎回異なるキーワード＋都道府県の組み合わせ）。
 */
import { notifyOwner } from "./_core/notification";

const SALESDASH_BASE = "https://salesdash.buzzdrop.co.jp/api/trpc";

// 収集キーワード（美容関連）
const SEARCH_KEYWORDS = [
  "美容 ディーラー",
  "美容商材 卸",
  "美容材料 卸売",
  "ヘアケア商品 卸",
  "美容室 材料 販売",
  "美容用品 代理店",
  "サロン専売品 卸",
  "美容機器 販売",
  "美容 問屋",
  "バラエティショップ コスメ",
  "ホテル アメニティ 卸",
  "ホテル 美容商材 卸",
  "業務用 シャンプー 卸",
  "ドラッグストア 美容 卸",
  "美容室 開業 材料",
];

// 主要都道府県（人口順でローテーション）
const PREFECTURES = [
  "東京都", "大阪府", "神奈川県", "愛知県", "埼玉県",
  "千葉県", "兵庫県", "北海道", "福岡県", "静岡県",
  "茨城県", "広島県", "京都府", "宮城県", "新潟県",
  "長野県", "岐阜県", "群馬県", "栃木県", "岡山県",
  "三重県", "熊本県", "鹿児島県", "山口県", "愛媛県",
  "奈良県", "滋賀県", "沖縄県", "石川県", "富山県",
  "和歌山県", "香川県", "大分県", "宮崎県", "長崎県",
  "佐賀県", "山形県", "岩手県", "青森県", "秋田県",
  "福島県", "山梨県", "福井県", "徳島県", "高知県",
  "島根県", "鳥取県",
];

// 2時間 = 7,200,000ms
const COLLECT_INTERVAL_MS = 2 * 60 * 60 * 1000;

// ローテーションインデックス
let keywordIndex = 0;
let prefectureIndex = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastRunResult = {
  keyword: "",
  prefecture: "",
  leadsFound: 0,
  background: false,
  lastRunAt: "",
  error: "",
};

/**
 * salesdash の collectGoogleMaps を呼び出す
 */
async function callSalesdashCollect(keyword: string, prefecture: string): Promise<{
  leadsFound: number;
  background: boolean;
  message: string;
  jobId?: number;
}> {
  const params = { keyword, prefecture };
  const res = await fetch(`${SALESDASH_BASE}/btobLeadProspector.collectGoogleMaps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: params }),
  });

  if (!res.ok) {
    throw new Error(`salesdash API returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const result = data?.result?.data?.json;
  if (!result) {
    throw new Error("Invalid response from salesdash API");
  }

  return {
    leadsFound: result.leadsFound || result.newLeads || result.collected || 0,
    background: result.background || false,
    message: result.message || "",
    jobId: result.jobId,
  };
}

/**
 * salesdash の getLeadStats を呼び出して現在の統計を取得
 */
async function getSalesdashStats(): Promise<{ total: number; withEmail: number; withPhone: number }> {
  try {
    const res = await fetch(`${SALESDASH_BASE}/btobLeadProspector.getLeadStats`);
    const data = await res.json();
    const stats = data?.result?.data?.json;
    return {
      total: stats?.total || 0,
      withEmail: stats?.withEmail || 0,
      withPhone: stats?.withPhone || 0,
    };
  } catch {
    return { total: 0, withEmail: 0, withPhone: 0 };
  }
}

/**
 * lcjgent の leadHistory に記録する
 */
async function recordHistory(keyword: string, prefecture: string, leadsFound: number, status: string): Promise<void> {
  try {
    // Import db functions dynamically to avoid circular deps
    const { createLeadCollectionHistory } = await import("./db");
    await createLeadCollectionHistory({
      keyword,
      prefecture,
      pipeline: "google_maps_auto",
      leadsFound,
      executedBy: "auto_scheduler",
      status,
    });
  } catch (err: any) {
    console.error("[LeadAutoCollect] Failed to record history:", err.message);
  }
}

/**
 * メイン収集処理
 */
async function runAutoCollect(): Promise<void> {
  if (isRunning) {
    console.log("[LeadAutoCollect] Previous run still in progress, skipping...");
    return;
  }

  isRunning = true;
  const keyword = SEARCH_KEYWORDS[keywordIndex % SEARCH_KEYWORDS.length];
  const prefecture = PREFECTURES[prefectureIndex % PREFECTURES.length];

  console.log(`[LeadAutoCollect] Starting auto-collect: keyword="${keyword}", prefecture="${prefecture}"`);

  try {
    // 収集前の統計を取得
    const statsBefore = await getSalesdashStats();

    // salesdash の Google Maps 収集を実行
    const result = await callSalesdashCollect(keyword, prefecture);

    // 収集後の統計を取得（バックグラウンドの場合は少し待つ）
    if (result.background) {
      // バックグラウンドジョブの場合、60秒後に統計を確認
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    const statsAfter = await getSalesdashStats();
    const actualNewLeads = statsAfter.total - statsBefore.total;

    // 結果を記録
    lastRunResult = {
      keyword,
      prefecture,
      leadsFound: result.background ? actualNewLeads : result.leadsFound,
      background: result.background,
      lastRunAt: new Date().toISOString(),
      error: "",
    };

    // 履歴に記録
    await recordHistory(keyword, prefecture, lastRunResult.leadsFound, "completed");

    // 通知を送信
    const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    const notifyContent = [
      `⏰ 実行時刻: ${now}`,
      `🔍 キーワード: ${keyword}`,
      `📍 都道府県: ${prefecture}`,
      `📊 収集結果: ${lastRunResult.leadsFound}件の新規リード`,
      result.background ? `⚙️ バックグラウンドジョブ実行中（JobID: ${result.jobId}）` : "",
      ``,
      `📈 現在の総リード数: ${statsAfter.total.toLocaleString()}件`,
      `📧 メールあり: ${statsAfter.withEmail.toLocaleString()}件`,
      `📞 電話あり: ${statsAfter.withPhone.toLocaleString()}件`,
    ].filter(Boolean).join("\n");

    await notifyOwner({
      title: `🚀 リード自動収集完了 [${lastRunResult.leadsFound}件]`,
      content: notifyContent,
    }).catch(err => {
      console.error("[LeadAutoCollect] Failed to notify owner:", err.message);
    });

    console.log(`[LeadAutoCollect] Completed: ${lastRunResult.leadsFound} leads found (keyword=${keyword}, prefecture=${prefecture})`);

  } catch (err: any) {
    console.error(`[LeadAutoCollect] Error: ${err.message}`);
    lastRunResult = {
      keyword,
      prefecture,
      leadsFound: 0,
      background: false,
      lastRunAt: new Date().toISOString(),
      error: err.message,
    };

    // エラーも履歴に記録
    await recordHistory(keyword, prefecture, 0, "failed");

    // エラー通知
    await notifyOwner({
      title: "❌ リード自動収集エラー",
      content: `キーワード: ${keyword}\n都道府県: ${prefecture}\nエラー: ${err.message}`,
    }).catch(() => {});
  } finally {
    isRunning = false;
    // ローテーション: 都道府県を1つ進める。全都道府県を回ったらキーワードも進める
    prefectureIndex++;
    if (prefectureIndex % PREFECTURES.length === 0) {
      keywordIndex++;
    }
  }
}

/**
 * スケジューラー開始
 */
export function startLeadAutoCollectScheduler(): void {
  if (intervalId) {
    console.log("[LeadAutoCollect] Scheduler already running");
    return;
  }

  console.log("[LeadAutoCollect] Starting scheduler (every 2 hours, rotating keywords × prefectures)");

  // 初回は起動5分後に実行（サーバーウォームアップ待ち）
  setTimeout(() => {
    runAutoCollect();
  }, 5 * 60 * 1000);

  // 以降2時間ごとに実行
  intervalId = setInterval(runAutoCollect, COLLECT_INTERVAL_MS);
}

/**
 * スケジューラー停止
 */
export function stopLeadAutoCollectScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[LeadAutoCollect] Scheduler stopped");
  }
}

/**
 * 手動トリガー（テスト用）
 */
export async function triggerLeadAutoCollect(): Promise<typeof lastRunResult> {
  await runAutoCollect();
  return lastRunResult;
}

/**
 * 現在のステータスを取得
 */
export function getLeadAutoCollectStatus(): {
  isRunning: boolean;
  lastRun: typeof lastRunResult;
  nextKeyword: string;
  nextPrefecture: string;
  intervalMs: number;
} {
  return {
    isRunning,
    lastRun: lastRunResult,
    nextKeyword: SEARCH_KEYWORDS[keywordIndex % SEARCH_KEYWORDS.length],
    nextPrefecture: PREFECTURES[prefectureIndex % PREFECTURES.length],
    intervalMs: COLLECT_INTERVAL_MS,
  };
}
