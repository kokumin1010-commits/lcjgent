import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// ── Styles ──
const SUBTITLE_STYLES = [
  { id: "auto", name: "自動（シーン別）", desc: "シーンに応じてスタイルを自動切替" },
  { id: "simple", name: "シンプル", desc: "白文字＋影" },
  { id: "box", name: "ボックス", desc: "白文字＋黒背景" },
  { id: "outline", name: "アウトライン", desc: "白文字＋太い縁取り" },
  { id: "pop", name: "ポップ", desc: "黄色文字＋オレンジ縁取り" },
  { id: "gradient", name: "グラデーション", desc: "白文字＋紫グラデ背景" },
  { id: "karaoke", name: "カラオケ", desc: "ハイライト付き" },
];

const TRANSITIONS = [
  { id: "fade", name: "フェード" },
  { id: "fadeblack", name: "フェード（黒）" },
  { id: "fadewhite", name: "フェード（白）" },
  { id: "slideleft", name: "スライド左" },
  { id: "slideright", name: "スライド右" },
  { id: "wipeleft", name: "ワイプ左" },
  { id: "wiperight", name: "ワイプ右" },
  { id: "smoothleft", name: "スムーズ左" },
  { id: "smoothright", name: "スムーズ右" },
];

export default function AutoAIClipPanel({ adminKey }) {
  // ── State ──
  const [brands, setBrands] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("generate"); // generate, jobs, candidates

  // ── Config ──
  const [config, setConfig] = useState({
    brand_id: "",
    max_clips: 5,
    subtitle_style: "auto",
    enable_sfx: true,
    enable_transitions: true,
    transition_type: "fade",
    transition_duration: 0.5,
    enable_hook: true,
    hook_text: "",
    enable_thumbnail: true,
    min_duration: 10,
    max_duration: 60,
    min_cta_score: 0,
    min_importance: 0,
    target_language: "auto",
    position_y: 75,
  });

  // ── Polling for active job ──
  const [activeJobId, setActiveJobId] = useState(null);
  const [activeJob, setActiveJob] = useState(null);

  const headers = { "X-Admin-Key": adminKey };

  // ── Fetch initial data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [brandsRes, jobsRes, templatesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/ai-clip/brands`, { headers }).catch(() => ({ data: { brands: [] } })),
        axios.get(`${API_BASE}/api/v1/ai-clip/jobs?limit=20`, { headers }).catch(() => ({ data: { jobs: [] } })),
        axios.get(`${API_BASE}/api/v1/ai-clip/templates`, { headers }).catch(() => ({ data: { templates: [] } })),
      ]);
      setBrands(brandsRes.data.brands || []);
      setJobs(jobsRes.data.jobs || []);
      setTemplates(templatesRes.data.templates || []);
    } catch (e) {
      console.error("AI Clip data fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fetch candidates ──
  const fetchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (config.brand_id) params.append("brand_id", config.brand_id);
      params.append("min_cta_score", config.min_cta_score);
      params.append("min_importance", config.min_importance);
      params.append("min_duration", config.min_duration);
      params.append("max_duration", config.max_duration);
      params.append("limit", "30");
      const res = await axios.get(`${API_BASE}/api/v1/ai-clip/candidates?${params}`, { headers });
      setCandidates(res.data.candidates || []);
    } catch (e) {
      console.error("Candidates fetch error:", e);
      setCandidates([]);
    }
  }, [config.brand_id, config.min_cta_score, config.min_importance, config.min_duration, config.max_duration, adminKey]);

  useEffect(() => {
    if (activeTab === "candidates") {
      fetchCandidates();
    }
  }, [activeTab, fetchCandidates]);

  // ── Poll active job ──
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/v1/ai-clip/jobs/${activeJobId}`, { headers });
        setActiveJob(res.data);
        if (res.data.status === "done" || res.data.status === "failed") {
          clearInterval(interval);
          fetchData(); // Refresh jobs list
        }
      } catch (e) {
        console.error("Job poll error:", e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobId]);

  // ── Generate ──
  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const payload = { ...config };
      if (!payload.brand_id) delete payload.brand_id;
      if (!payload.hook_text) delete payload.hook_text;
      const res = await axios.post(`${API_BASE}/api/v1/ai-clip/generate`, payload, { headers });
      setActiveJobId(res.data.job_id);
      setActiveJob({ job_id: res.data.job_id, status: "queued", progress_pct: 0 });
      setActiveTab("jobs");
    } catch (e) {
      alert("生成開始に失敗しました: " + (e.response?.data?.detail || e.message));
    } finally {
      setGenerating(false);
    }
  };

  // ── Apply template ──
  const applyTemplate = (template) => {
    setConfig(prev => ({
      ...prev,
      subtitle_style: template.subtitle_style || "auto",
      enable_sfx: template.enable_sfx ?? true,
      enable_transitions: template.enable_transitions ?? true,
      transition_type: template.transition_type || "fade",
      enable_hook: template.enable_hook ?? true,
      min_cta_score: template.min_cta_score || 0,
    }));
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-gray-500">AI クリップ生成データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🤖 全自動AIクリップ生成
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            ClipDBからNG除外・ブランド選択済みクリップを自動選定し、字幕・フック・サムネイルを全自動生成
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          🔄 更新
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: "generate", label: "⚡ 生成設定" },
          { id: "jobs", label: `📋 ジョブ一覧 (${jobs.length})` },
          { id: "candidates", label: "🎬 候補プレビュー" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-t-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-purple-50 text-purple-700 border-b-2 border-purple-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Generate Tab */}
      {activeTab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Config */}
          <div className="lg:col-span-2 space-y-6">
            {/* Templates */}
            <section className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-700 mb-3">📋 テンプレート</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="p-3 border rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all text-left"
                  >
                    <div className="font-medium text-sm text-gray-800">{t.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{t.description}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Brand & Clip Selection */}
            <section className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-700 mb-3">🏷️ クリップ選定条件</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">ブランド</label>
                  <select
                    value={config.brand_id}
                    onChange={e => setConfig(prev => ({ ...prev, brand_id: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">全ブランド（割り当て済みのみ）</option>
                    {brands.map(b => (
                      <option key={b.client_id} value={b.client_id}>
                        {b.name} ({b.clip_count}件)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">最大生成数</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={config.max_clips}
                    onChange={e => setConfig(prev => ({ ...prev, max_clips: parseInt(e.target.value) || 5 }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">最小クリップ長（秒）</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={config.min_duration}
                    onChange={e => setConfig(prev => ({ ...prev, min_duration: parseFloat(e.target.value) || 10 }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">最大クリップ長（秒）</label>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={config.max_duration}
                    onChange={e => setConfig(prev => ({ ...prev, max_duration: parseFloat(e.target.value) || 60 }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">最小CTAスコア</label>
                  <select
                    value={config.min_cta_score}
                    onChange={e => setConfig(prev => ({ ...prev, min_cta_score: parseInt(e.target.value) }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {[0,1,2,3,4,5].map(v => <option key={v} value={v}>{v === 0 ? "指定なし" : `${v}以上`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">最小重要度</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={config.min_importance}
                    onChange={e => setConfig(prev => ({ ...prev, min_importance: parseFloat(e.target.value) || 0 }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            {/* Subtitle & Style */}
            <section className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-700 mb-3">🎨 字幕スタイル</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">スタイル</label>
                  <select
                    value={config.subtitle_style}
                    onChange={e => setConfig(prev => ({ ...prev, subtitle_style: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {SUBTITLE_STYLES.map(s => (
                      <option key={s.id} value={s.id}>{s.name} - {s.desc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">字幕言語</label>
                  <select
                    value={config.target_language}
                    onChange={e => setConfig(prev => ({ ...prev, target_language: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="auto">自動検出</option>
                    <option value="ja">日本語</option>
                    <option value="zh">中国語（簡体）</option>
                    <option value="zh-tw">中国語（繁体）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">字幕位置 Y（%）</label>
                  <input
                    type="range"
                    min={10}
                    max={95}
                    value={config.position_y}
                    onChange={e => setConfig(prev => ({ ...prev, position_y: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-400 text-center">{config.position_y}%</div>
                </div>
              </div>
            </section>

            {/* Effects */}
            <section className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-700 mb-3">✨ エフェクト設定</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Hook */}
                <div className="col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.enable_hook}
                      onChange={e => setConfig(prev => ({ ...prev, enable_hook: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">🎯 最初3秒フック（大きな文字でインパクト）</span>
                  </label>
                  {config.enable_hook && (
                    <input
                      type="text"
                      placeholder="カスタムフックテキスト（空欄=AI自動生成）"
                      value={config.hook_text}
                      onChange={e => setConfig(prev => ({ ...prev, hook_text: e.target.value }))}
                      className="mt-2 w-full border rounded-md px-3 py-2 text-sm"
                      maxLength={30}
                    />
                  )}
                </div>

                {/* SFX */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.enable_sfx}
                    onChange={e => setConfig(prev => ({ ...prev, enable_sfx: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">🔊 効果音自動挿入</span>
                </label>

                {/* Thumbnail */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.enable_thumbnail}
                    onChange={e => setConfig(prev => ({ ...prev, enable_thumbnail: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">🖼️ サムネイル自動生成</span>
                </label>

                {/* Transitions */}
                <div className="col-span-2">
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={config.enable_transitions}
                      onChange={e => setConfig(prev => ({ ...prev, enable_transitions: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">🎬 トランジション</span>
                  </label>
                  {config.enable_transitions && (
                    <div className="flex gap-4 ml-6">
                      <select
                        value={config.transition_type}
                        onChange={e => setConfig(prev => ({ ...prev, transition_type: e.target.value }))}
                        className="border rounded-md px-3 py-1.5 text-sm"
                      >
                        {TRANSITIONS.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">時間:</span>
                        <input
                          type="number"
                          min={0.1}
                          max={2}
                          step={0.1}
                          value={config.transition_duration}
                          onChange={e => setConfig(prev => ({ ...prev, transition_duration: parseFloat(e.target.value) || 0.5 }))}
                          className="w-16 border rounded-md px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-gray-500">秒</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right: Summary & Generate Button */}
          <div className="space-y-4">
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4 sticky top-4">
              <h3 className="font-semibold text-purple-800 mb-3">📊 生成サマリー</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">ブランド:</span>
                  <span className="font-medium">{config.brand_id ? brands.find(b => b.client_id === config.brand_id)?.name || config.brand_id : "全ブランド"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">最大生成数:</span>
                  <span className="font-medium">{config.max_clips}件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">字幕スタイル:</span>
                  <span className="font-medium">{SUBTITLE_STYLES.find(s => s.id === config.subtitle_style)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">フック:</span>
                  <span className="font-medium">{config.enable_hook ? "ON" : "OFF"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">効果音:</span>
                  <span className="font-medium">{config.enable_sfx ? "ON" : "OFF"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">トランジション:</span>
                  <span className="font-medium">{config.enable_transitions ? config.transition_type : "OFF"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">サムネイル:</span>
                  <span className="font-medium">{config.enable_thumbnail ? "ON" : "OFF"}</span>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className={`w-full mt-4 py-3 rounded-lg font-bold text-white transition-all ${
                  generating
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 shadow-lg hover:shadow-xl"
                }`}
              >
                {generating ? "⏳ 生成中..." : "🚀 全自動生成を開始"}
              </button>

              {activeJob && activeJob.status !== "done" && activeJob.status !== "failed" && (
                <div className="mt-4 p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-purple-600">進捗</span>
                    <span className="text-xs text-gray-500">{activeJob.progress_pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${activeJob.progress_pct}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{activeJob.current_step}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Jobs Tab */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          {/* Active Job Detail */}
          {activeJob && (
            <div className={`p-4 rounded-lg border-2 ${
              activeJob.status === "done" ? "border-green-300 bg-green-50" :
              activeJob.status === "failed" ? "border-red-300 bg-red-50" :
              "border-purple-300 bg-purple-50"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">
                  {activeJob.status === "done" ? "✅" : activeJob.status === "failed" ? "❌" : "⏳"}
                  {" "}アクティブジョブ
                </h3>
                <span className="text-xs text-gray-500">{activeJob.job_id?.slice(0, 8)}</span>
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>{activeJob.current_step || activeJob.status}</span>
                  <span>{activeJob.clips_completed || 0}/{activeJob.clips_total || 0}件</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      activeJob.status === "done" ? "bg-green-500" :
                      activeJob.status === "failed" ? "bg-red-500" :
                      "bg-purple-500"
                    }`}
                    style={{ width: `${activeJob.progress_pct || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Error */}
              {activeJob.error && (
                <div className="text-sm text-red-600 bg-red-100 p-2 rounded">{activeJob.error}</div>
              )}

              {/* Results */}
              {activeJob.results && activeJob.results.length > 0 && (
                <div className="mt-3 space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">生成結果:</h4>
                  {activeJob.results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                      <span className="text-gray-600">
                        {r.status === "done" ? "✅" : "❌"} クリップ {r.clip_id?.slice(0, 8)}
                      </span>
                      {r.download_url && (
                        <a
                          href={r.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-800 font-medium"
                        >
                          ⬇️ ダウンロード
                        </a>
                      )}
                      {r.error && <span className="text-red-500 text-xs">{r.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Jobs List */}
          <div className="bg-white rounded-lg border">
            <div className="p-3 border-b">
              <h3 className="font-semibold text-gray-700">ジョブ履歴</h3>
            </div>
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">まだジョブがありません</div>
            ) : (
              <div className="divide-y">
                {jobs.map(job => (
                  <div
                    key={job.job_id}
                    className="p-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => { setActiveJobId(job.job_id); setActiveJob(job); }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          job.status === "done" ? "bg-green-500" :
                          job.status === "failed" ? "bg-red-500" :
                          job.status === "queued" ? "bg-yellow-500" :
                          "bg-purple-500 animate-pulse"
                        }`}></span>
                        <span className="text-sm font-medium text-gray-700">
                          {job.job_id?.slice(0, 8)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {job.clips_completed || 0}/{job.clips_total || 0}件
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          job.status === "done" ? "bg-green-100 text-green-700" :
                          job.status === "failed" ? "bg-red-100 text-red-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>
                          {job.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {job.created_at ? new Date(job.created_at).toLocaleString("ja-JP") : "—"}
                        </span>
                      </div>
                    </div>
                    {job.current_step && (
                      <p className="text-xs text-gray-500 mt-1 ml-4">{job.current_step}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Candidates Tab */}
      {activeTab === "candidates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              条件に合致する候補クリップ: <strong>{candidates.length}件</strong>
            </p>
            <button
              onClick={fetchCandidates}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              🔄 再取得
            </button>
          </div>

          {candidates.length === 0 ? (
            <div className="p-8 text-center text-gray-400 bg-white rounded-lg border">
              条件に合うクリップが見つかりません。フィルタ条件を緩めてください。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {candidates.map(c => (
                <div key={c.clip_id} className="bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow">
                  {/* Thumbnail */}
                  <div className="h-32 bg-gray-100 flex items-center justify-center">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">🎬</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-gray-400">{c.clip_id?.slice(0, 8)}</span>
                      <span className="text-xs text-gray-500">{c.duration_sec?.toFixed(0)}秒</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                      {c.transcript_text || "(字幕なし)"}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      {c.cta_score > 0 && (
                        <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                          CTA:{c.cta_score}
                        </span>
                      )}
                      {c.importance_score > 0 && (
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          重要度:{c.importance_score?.toFixed(1)}
                        </span>
                      )}
                      {c.has_captions && (
                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">字幕有</span>
                      )}
                      {c.has_export && (
                        <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Export済</span>
                      )}
                    </div>
                    {c.product_name && (
                      <p className="text-xs text-gray-500 mt-1 truncate">🏷️ {c.product_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
