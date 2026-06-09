import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/**
 * V3.0: 按产品自动分段模式
 * 从完整直播视频中按产品自动分段、提炼卖点字幕、气口剪切后硬切拼接，输出多个独立clip
 */
export default function ProductSegmentationTab({ adminKey, brands, headers }) {
  // ── State ──
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [v3Jobs, setV3Jobs] = useState([]);

  // ── V3 Config ──
  const [v3Config, setV3Config] = useState({
    brand_id: "",
    subtitle_style: "auto",
    enable_silence_cut: true,
    silence_threshold_db: -22,
    speed_factor: 1.05,
    position_y: 75,
    target_language: "auto",
    highlight_position_y: 12,
    min_silence_duration: 1.0,
    highlight_display_duration: 4.0,
  });

  // ── Fetch videos list ──
  const fetchVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/admin/videos?limit=50`, { headers });
      setVideos(res.data.videos || []);
    } catch (e) {
      console.error("Videos fetch error:", e);
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  }, [adminKey]);

  // ── Fetch V3 jobs ──
  const fetchV3Jobs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/ai-clip/jobs?limit=20`, { headers });
      // Filter V3 jobs by config.mode
      const allJobs = res.data.jobs || [];
      const filtered = allJobs.filter(j => j.config?.mode === "by_product_v3");
      setV3Jobs(filtered);
    } catch (e) {
      console.error("V3 jobs fetch error:", e);
    }
  }, [adminKey]);

  useEffect(() => {
    fetchVideos();
    fetchV3Jobs();
  }, [fetchVideos, fetchV3Jobs]);

  // ── Poll active job ──
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/v1/ai-clip/jobs/${activeJobId}`, { headers });
        setActiveJob(res.data);
        if (res.data.status === "done" || res.data.status === "failed") {
          clearInterval(interval);
          fetchV3Jobs();
        }
      } catch (e) {
        console.error("V3 job poll error:", e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobId]);

  // ── Generate by product ──
  const handleGenerateByProduct = async () => {
    if (!selectedVideoId) {
      alert("動画を選択してください");
      return;
    }
    if (generating) return;
    setGenerating(true);
    try {
      const payload = {
        video_id: selectedVideoId,
        ...v3Config,
      };
      if (!payload.brand_id) delete payload.brand_id;
      const res = await axios.post(
        `${API_BASE}/api/v1/ai-clip/generate-by-product`,
        payload,
        { headers }
      );
      setActiveJobId(res.data.job_id);
      setActiveJob({ job_id: res.data.job_id, status: "queued", progress_pct: 0 });
    } catch (e) {
      alert("V3.0 生成開始に失敗しました: " + (e.response?.data?.detail || e.message));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
        <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
          🎁 V3.0 按产品自動分段モード
        </h3>
        <p className="text-sm text-emerald-600 mt-1">
          完整直播視頻 → 产品検出 → 卖点提炼 → 気口カット → 各产品独立clip出力
        </p>
        <div className="flex gap-4 mt-2 text-xs text-emerald-700">
          <span>✅ 产品DB優先</span>
          <span>✅ AI語音識別フォールバック</span>
          <span>✅ 卖点逐条表示</span>
          <span>✅ 1つの動画 → 複数clip</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Selection */}
          <section className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              📹 ソース動画選択
              <button onClick={fetchVideos} className="text-xs text-gray-400 hover:text-gray-600">🔄</button>
            </h4>
            {videosLoading ? (
              <div className="text-sm text-gray-400 py-4 text-center">読み込み中...</div>
            ) : (
              <select
                value={selectedVideoId}
                onChange={e => setSelectedVideoId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">-- 動画を選択 --</option>
                {videos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.original_filename || v.id} ({v.status || "unknown"})
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* Brand Filter */}
          <section className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-700 mb-3">🏷️ ブランドフィルタ（任意）</h4>
            <select
              value={v3Config.brand_id}
              onChange={e => setV3Config(prev => ({ ...prev, brand_id: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">全ブランド（自動検出）</option>
              {brands.map(b => (
                <option key={b.client_id} value={b.client_id}>
                  {b.client_name || b.brand_name}
                </option>
              ))}
            </select>
          </section>

          {/* V3 Settings */}
          <section className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-700 mb-3">⚙️ V3.0 設定</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">気口カット閾値 (dB)</label>
                <input
                  type="number"
                  value={v3Config.silence_threshold_db}
                  onChange={e => setV3Config(prev => ({ ...prev, silence_threshold_db: Number(e.target.value) }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  min={-60} max={-10} step={1}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">最小気口長 (秒)</label>
                <input
                  type="number"
                  value={v3Config.min_silence_duration}
                  onChange={e => setV3Config(prev => ({ ...prev, min_silence_duration: Number(e.target.value) }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  min={0.5} max={3.0} step={0.1}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">再生速度</label>
                <input
                  type="number"
                  value={v3Config.speed_factor}
                  onChange={e => setV3Config(prev => ({ ...prev, speed_factor: Number(e.target.value) }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  min={1.0} max={1.3} step={0.01}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">卖点表示時間 (秒)</label>
                <input
                  type="number"
                  value={v3Config.highlight_display_duration}
                  onChange={e => setV3Config(prev => ({ ...prev, highlight_display_duration: Number(e.target.value) }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  min={2.0} max={8.0} step={0.5}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">字幕Y位置 (%)</label>
                <input
                  type="number"
                  value={v3Config.position_y}
                  onChange={e => setV3Config(prev => ({ ...prev, position_y: Number(e.target.value) }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  min={0} max={100} step={1}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">卖点Y位置 (%)</label>
                <input
                  type="number"
                  value={v3Config.highlight_position_y}
                  onChange={e => setV3Config(prev => ({ ...prev, highlight_position_y: Number(e.target.value) }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  min={0} max={50} step={1}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">字幕言語</label>
                <select
                  value={v3Config.target_language}
                  onChange={e => setV3Config(prev => ({ ...prev, target_language: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="auto">自動検出</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中国語(簡体)</option>
                  <option value="zh-tw">中国語(繁体)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={v3Config.enable_silence_cut}
                  onChange={e => setV3Config(prev => ({ ...prev, enable_silence_cut: e.target.checked }))}
                  className="rounded"
                />
                <label className="text-xs text-gray-600">気口カット有効</label>
              </div>
            </div>
          </section>

          {/* Generate Button */}
          <button
            onClick={handleGenerateByProduct}
            disabled={generating || !selectedVideoId}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {generating ? "⏳ 処理開始中..." : "🚀 V3.0 按产品分段を開始"}
          </button>
        </div>

        {/* Right: Active Job + History */}
        <div className="space-y-4">
          {/* Active Job Progress */}
          {activeJob && (
            <div className="bg-white rounded-lg border p-4">
              <h4 className="font-semibold text-gray-700 mb-2">📊 処理状況</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{activeJob.current_step || "準備中..."}</span>
                  <span>{activeJob.progress_pct || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      activeJob.status === "failed" ? "bg-red-500" :
                      activeJob.status === "done" ? "bg-emerald-500" : "bg-emerald-400"
                    }`}
                    style={{ width: `${activeJob.progress_pct || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className={`font-medium ${
                    activeJob.status === "failed" ? "text-red-600" :
                    activeJob.status === "done" ? "text-emerald-600" : "text-gray-600"
                  }`}>
                    {activeJob.status === "done" ? "✅ 完了" :
                     activeJob.status === "failed" ? "❌ 失敗" :
                     "⏳ 処理中"}
                  </span>
                  {activeJob.clips_total > 0 && (
                    <span className="text-gray-500">
                      {activeJob.clips_completed}/{activeJob.clips_total} clips
                    </span>
                  )}
                </div>
                {activeJob.error && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                    {activeJob.error}
                  </div>
                )}
              </div>

              {/* Results */}
              {activeJob.status === "done" && activeJob.results?.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h5 className="text-xs font-semibold text-gray-600">生成結果:</h5>
                  {activeJob.results.map((r, i) => (
                    <div key={i} className={`p-2 rounded text-xs ${
                      r.status === "done" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{r.product_name}</span>
                        <span className={r.status === "done" ? "text-emerald-600" : "text-red-600"}>
                          {r.status === "done" ? "✅" : "❌"}
                        </span>
                      </div>
                      {r.status === "done" && (
                        <div className="mt-1 space-y-1">
                          <div className="text-gray-500">
                            {r.time_range} → {r.duration_sec}s (カット: {r.silence_cuts}箇所)
                          </div>
                          {r.highlights?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.highlights.map((h, hi) => (
                                <span key={hi} className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-[10px]">
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                          {r.download_url && (
                            <a
                              href={r.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-1 text-emerald-600 hover:text-emerald-800 underline"
                            >
                              ⬇️ ダウンロード
                            </a>
                          )}
                        </div>
                      )}
                      {r.error && <div className="text-red-500 mt-1">{r.error}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* V3 Job History */}
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              📜 V3ジョブ履歴
              <button onClick={fetchV3Jobs} className="text-xs text-gray-400 hover:text-gray-600">🔄</button>
            </h4>
            {v3Jobs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">まだV3ジョブがありません</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {v3Jobs.map(job => (
                  <div
                    key={job.job_id}
                    className={`p-2 rounded border text-xs cursor-pointer hover:bg-gray-50 ${
                      job.status === "done" ? "border-emerald-200" :
                      job.status === "failed" ? "border-red-200" : "border-gray-200"
                    }`}
                    onClick={() => { setActiveJobId(job.job_id); setActiveJob(job); }}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700 truncate">
                        {job.config?.video_id?.slice(0, 8) || "..."} 
                      </span>
                      <span className={`font-medium ${
                        job.status === "done" ? "text-emerald-600" :
                        job.status === "failed" ? "text-red-600" : "text-yellow-600"
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="text-gray-400 mt-0.5">
                      {job.clips_completed}/{job.clips_total} clips • {job.progress_pct}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
