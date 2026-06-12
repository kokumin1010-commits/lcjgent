/**
 * Lead Auto-Collect Scheduler v2.0
 * 
 * 每2時間ごとにsalesdash.buzzdrop.co.jpの全パイプラインAPIを自動呼び出し、
 * 全日本・全カテゴリのリードを自動収集する。
 * 
 * 収集完了後、結果をログに記録し、notifyOwnerで通知する。
 * 
 * 戦略：
 * - 毎回 runFullPipeline を呼び出し、全47都道府県×全キーワードを収集
 * - Google Maps + Google検索 + ポータルサイトの3方式を同時実行
 * - salesdash側でバックグラウンドジョブとして処理される
 */
import { notifyOwner } from "./_core/notification";

const SALESDASH_BASE = "https://salesdash.buzzdrop.co.jp/api/trpc";

// 全47都道府県
const ALL_PREFECTURES = [
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

// 全カテゴリキーワード（美容関連 + 卸売 + 小売 + EC + サービス）
const ALL_KEYWORDS = [
  // 美容ディーラー・卸
  "美容 ディーラー",
  "美容商材 卸",
  "美容材料 卸売",
  "ヘアケア商品 卸",
  "美容室 材料 販売",
  "美容用品 代理店",
  "サロン専売品 卸",
  "美容機器 販売",
  "美容 問屋",
  "業務用 シャンプー 卸",
  "美容室 開業 材料",
  // 小売・バラエティ
  "バラエティショップ コスメ",
  "ドラッグストア 美容 卸",
  "コスメ セレクトショップ",
  "オーガニック コスメ 店舗",
  // ホテル・旅館
  "ホテル アメニティ 卸",
  "ホテル 美容商材 卸",
  "旅館 アメニティ 仕入",
  // エステ・ネイル・まつげ
  "エステサロン 商材 卸",
  "ネイルサロン 材料 卸",
  "まつげエクステ 商材",
  "脱毛サロン 機器",
  // スパ・リラクゼーション
  "スパ 業務用 化粧品",
  "リラクゼーション サロン 商材",
  // フィットネス・ウェルネス
  "フィットネス ジム 美容",
  "ウェルネス サプリ 卸",
  // 理容
  "理容 材料 卸",
  "バーバー 商材",
  // 百貨店・免税
  "百貨店 コスメ バイヤー",
  "免税店 化粧品 仕入",
];

// 2時間 = 7,200,000ms
const COLLECT_INTERVAL_MS = 2 * 60 * 60 * 1000;

// 1回の実行で使う都道府県数（API負荷分散のため10県ずつローテーション）
const PREFECTURES_PER_RUN = 10;

// ローテーションインデックス
let prefectureRotationIndex = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let totalCollectedToday = 0;
let runsToday = 0;
let lastRunResult = {
  prefectures: [] as string[],
  keywords: [] as string[],
  pipelines: ["google_maps", "google_search", "portals"],
  background: true,
  lastRunAt: "",
  error: "",
  statsBefore: { total: 0, withEmail: 0, withPhone: 0 },
  statsAfter: { total: 0, withEmail: 0, withPhone: 0 },
  newLeads: 0,
};

/**
 * salesdash の runFullPipeline を呼び出す（全パイプライン実行）
 */
async function callSalesdashFullPipeline(prefectures: string[], keywords: string[]): Promise<{
  background: boolean;
  message: string;
}> {
  const params = {
    prefectures,
    keywords,
    skipGoogleMaps: false,
    skipGoogleSearch: false,
    skipPortals: false,
  };
  const res = await fetch(`${SALESDASH_BASE}/btobLeadProspector.runFullPipeline`, {
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
    background: result.background || true,
    message: result.message || "",
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
    const { createLeadCollectionHistory } = await import("./db");
    await createLeadCollectionHistory({
      keyword,
      prefecture,
      pipeline: "full_pipeline_auto",
      leadsFound,
      executedBy: "auto_scheduler_v2",
      status,
    });
  } catch (err: any) {
    console.error("[LeadAutoCollect] Failed to record history:", err.message);
  }
}

/**
 * メイン収集処理 - 全日本・全カテゴリ
 */
async function runAutoCollect(): Promise<void> {
  if (isRunning) {
    console.log("[LeadAutoCollect] Previous run still in progress, skipping...");
    return;
  }

  isRunning = true;

  // ローテーション: 10県ずつ回す（全47県を5回で一周）
  const startIdx = prefectureRotationIndex * PREFECTURES_PER_RUN;
  const selectedPrefectures = ALL_PREFECTURES.slice(startIdx, startIdx + PREFECTURES_PER_RUN);
  // 最後のバッチが足りない場合は先頭から補完
  if (selectedPrefectures.length < PREFECTURES_PER_RUN) {
    const remaining = PREFECTURES_PER_RUN - selectedPrefectures.length;
    selectedPrefectures.push(...ALL_PREFECTURES.slice(0, remaining));
  }

  console.log(`[LeadAutoCollect] Starting full pipeline: ${selectedPrefectures.length} prefectures × ${ALL_KEYWORDS.length} keywords`);
  console.log(`[LeadAutoCollect] Prefectures: ${selectedPrefectures.join(", ")}`);

  try {
    // 収集前の統計を取得
    const statsBefore = await getSalesdashStats();

    // salesdash の全パイプラインを実行
    const result = await callSalesdashFullPipeline(selectedPrefectures, ALL_KEYWORDS);

    // バックグラウンドジョブなので、90秒後に統計を確認
    console.log("[LeadAutoCollect] Pipeline started in background, waiting 90s for initial results...");
    await new Promise(resolve => setTimeout(resolve, 90000));

    const statsAfter = await getSalesdashStats();
    const newLeads = statsAfter.total - statsBefore.total;

    // 結果を記録
    lastRunResult = {
      prefectures: selectedPrefectures,
      keywords: ALL_KEYWORDS,
      pipelines: ["google_maps", "google_search", "portals"],
      background: true,
      lastRunAt: new Date().toISOString(),
      error: "",
      statsBefore,
      statsAfter,
      newLeads,
    };

    totalCollectedToday += newLeads;
    runsToday++;

    // 履歴に記録
    await recordHistory(
      `全${ALL_KEYWORDS.length}キーワード`,
      selectedPrefectures.join(","),
      newLeads,
      "completed"
    );

    // 通知を送信
    const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    const notifyContent = [
      `⏰ 実行時刻: ${now}`,
      `📍 対象地域: ${selectedPrefectures.join("、")}`,
      `🔍 キーワード数: ${ALL_KEYWORDS.length}種類`,
      `🔄 パイプライン: Google Maps + Google検索 + ポータル`,
      ``,
      `📊 【収集結果】`,
      `  新規リード: +${newLeads}件`,
      `  本日累計: +${totalCollectedToday}件（${runsToday}回実行）`,
      ``,
      `📈 【現在の総数】`,
      `  総リード数: ${statsAfter.total.toLocaleString()}件`,
      `  メールあり: ${statsAfter.withEmail.toLocaleString()}件`,
      `  電話あり: ${statsAfter.withPhone.toLocaleString()}件`,
      ``,
      `⏭️ 次回対象: ${ALL_PREFECTURES.slice(((prefectureRotationIndex + 1) % Math.ceil(ALL_PREFECTURES.length / PREFECTURES_PER_RUN)) * PREFECTURES_PER_RUN, ((prefectureRotationIndex + 1) % Math.ceil(ALL_PREFECTURES.length / PREFECTURES_PER_RUN)) * PREFECTURES_PER_RUN + PREFECTURES_PER_RUN).join("、") || "東京都〜"}`,
    ].join("\n");

    await notifyOwner({
      title: `🚀 リード全自動収集完了 [+${newLeads}件] (${selectedPrefectures[0]}〜${selectedPrefectures[selectedPrefectures.length - 1]})`,
      content: notifyContent,
    }).catch(err => {
      console.error("[LeadAutoCollect] Failed to notify owner:", err.message);
    });

    console.log(`[LeadAutoCollect] Completed: +${newLeads} new leads (${selectedPrefectures.length} prefectures)`);

  } catch (err: any) {
    console.error(`[LeadAutoCollect] Error: ${err.message}`);
    lastRunResult = {
      prefectures: selectedPrefectures,
      keywords: ALL_KEYWORDS,
      pipelines: ["google_maps", "google_search", "portals"],
      background: false,
      lastRunAt: new Date().toISOString(),
      error: err.message,
      statsBefore: { total: 0, withEmail: 0, withPhone: 0 },
      statsAfter: { total: 0, withEmail: 0, withPhone: 0 },
      newLeads: 0,
    };

    // エラーも履歴に記録
    await recordHistory(`全${ALL_KEYWORDS.length}キーワード`, selectedPrefectures.join(","), 0, "failed");

    // エラー通知
    await notifyOwner({
      title: "❌ リード自動収集エラー",
      content: `対象地域: ${selectedPrefectures.join("、")}\nエラー: ${err.message}`,
    }).catch(() => {});
  } finally {
    isRunning = false;
    // ローテーション: 次の10県に進む
    prefectureRotationIndex = (prefectureRotationIndex + 1) % Math.ceil(ALL_PREFECTURES.length / PREFECTURES_PER_RUN);
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

  console.log("[LeadAutoCollect] Starting scheduler v2 (every 2h, full Japan × all categories)");
  console.log(`[LeadAutoCollect] ${ALL_PREFECTURES.length} prefectures × ${ALL_KEYWORDS.length} keywords = ${ALL_PREFECTURES.length * ALL_KEYWORDS.length} combinations`);
  console.log(`[LeadAutoCollect] ${PREFECTURES_PER_RUN} prefectures per run, full cycle in ${Math.ceil(ALL_PREFECTURES.length / PREFECTURES_PER_RUN)} runs`);

  // 初回は起動3分後に実行
  setTimeout(() => {
    runAutoCollect();
  }, 3 * 60 * 1000);

  // 以降2時間ごとに実行
  intervalId = setInterval(runAutoCollect, COLLECT_INTERVAL_MS);

  // 日次リセット（毎日0時にカウンターリセット）
  const resetDaily = () => {
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;
    if (jstHour === 0) {
      totalCollectedToday = 0;
      runsToday = 0;
    }
  };
  setInterval(resetDaily, 60 * 60 * 1000); // 1時間ごとにチェック
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
  nextPrefectures: string[];
  totalKeywords: number;
  totalPrefectures: number;
  prefecturesPerRun: number;
  intervalMs: number;
  totalCollectedToday: number;
  runsToday: number;
} {
  const nextStartIdx = (prefectureRotationIndex * PREFECTURES_PER_RUN) % ALL_PREFECTURES.length;
  const nextPrefectures = ALL_PREFECTURES.slice(nextStartIdx, nextStartIdx + PREFECTURES_PER_RUN);

  return {
    isRunning,
    lastRun: lastRunResult,
    nextPrefectures,
    totalKeywords: ALL_KEYWORDS.length,
    totalPrefectures: ALL_PREFECTURES.length,
    prefecturesPerRun: PREFECTURES_PER_RUN,
    intervalMs: COLLECT_INTERVAL_MS,
    totalCollectedToday,
    runsToday,
  };
}
