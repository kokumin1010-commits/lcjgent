import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Scissors,
  Sparkles,
  Loader2,
  Play,
  Pause,
  Download,
  RefreshCw,
  Search,
  Film,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Send,
  History,
  ChevronDown,
  ChevronUp,
  Wand2,
  Video,
  FileText,
  Layers,
  Upload,
  Image,
  Music,
  Package,
  Trash2,
  Eye,
  HelpCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const ADMIN_KEY = "aither:hub";

/**
 * MagicCutPage - AI提示词剪辑ツール (Magic Cut)
 * Enhanced with:
 * - ライバー素材プレビュー再生
 * - 商品マスター検索・選択
 * - ユーザー素材アップロード
 */
export default function MagicCutPage() {
  const navigate = useNavigate();
  const pollRef = useRef(null);

  // ── State ──
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  // Materials - Tabs
  const [materialTab, setMaterialTab] = useState("liver"); // liver / product / upload
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);

  // Liver Materials (ライバー素材)
  const [materials, setMaterials] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialType, setMaterialType] = useState("all");
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [previewingMaterial, setPreviewingMaterial] = useState(null);

  // Products (商品マスター)
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // User Materials (ユーザーアップロード素材)
  const [userMaterials, setUserMaterials] = useState([]);
  const [loadingUserMaterials, setLoadingUserMaterials] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedUserMaterials, setSelectedUserMaterials] = useState([]);
  const fileInputRef = useRef(null);

  // Config
  const [outputCount, setOutputCount] = useState(1);
  const [maxDuration, setMaxDuration] = useState(60);
  const [orientation, setOrientation] = useState("vertical");
  const [enableSubtitles, setEnableSubtitles] = useState(true);
  const [enableEffects, setEnableEffects] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Help
  const [showHelp, setShowHelp] = useState(false);

  // History
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── Fetch Liver Materials ──
  const fetchMaterials = useCallback(async () => {
    setLoadingMaterials(true);
    try {
      const params = new URLSearchParams({
        material_type: materialType,
        limit: "30",
      });
      if (materialSearch) params.append("search", materialSearch);
      const res = await fetch(`${API_BASE}/api/v1/magic-cut/materials?${params}`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMaterials(data.materials || []);
    } catch (e) {
      console.error("[MagicCut] Failed to fetch materials:", e);
    } finally {
      setLoadingMaterials(false);
    }
  }, [materialSearch, materialType]);

  // ── Fetch Products ──
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (productSearch) params.append("q", productSearch);
      const res = await fetch(`${API_BASE}/api/v1/magic-cut/products?${params}`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e) {
      console.error("[MagicCut] Failed to fetch products:", e);
    } finally {
      setLoadingProducts(false);
    }
  }, [productSearch]);

  // ── Fetch User Materials ──
  const fetchUserMaterials = useCallback(async () => {
    setLoadingUserMaterials(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/magic-cut/user-materials?limit=30`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUserMaterials(data.materials || []);
    } catch (e) {
      console.error("[MagicCut] Failed to fetch user materials:", e);
    } finally {
      setLoadingUserMaterials(false);
    }
  }, []);

  useEffect(() => {
    if (showMaterialPicker) {
      if (materialTab === "liver") fetchMaterials();
      else if (materialTab === "product") fetchProducts();
      else if (materialTab === "upload") fetchUserMaterials();
    }
  }, [showMaterialPicker, materialTab, fetchMaterials, fetchProducts, fetchUserMaterials]);

  // ── Fetch History ──
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/magic-cut/history?limit=10`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.history || []);
    } catch (e) {
      console.error("[MagicCut] Failed to fetch history:", e);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Upload User Material ──
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const category = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("audio/")
        ? "audio"
        : "video";

      const formData = new FormData();
      formData.append("file", file);
      formData.append("material_name", file.name);
      formData.append("material_category", category);

      try {
        const res = await fetch(`${API_BASE}/api/v1/magic-cut/upload-material`, {
          method: "POST",
          headers: { "X-Admin-Key": ADMIN_KEY },
          body: formData,
        });
        if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (err) {
        console.error("[MagicCut] Upload error:", err);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    fetchUserMaterials();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Delete User Material ──
  const handleDeleteUserMaterial = async (id) => {
    try {
      await fetch(`${API_BASE}/api/v1/magic-cut/user-materials/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      setUserMaterials((prev) => prev.filter((m) => m.id !== id));
      setSelectedUserMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error("[MagicCut] Delete error:", e);
    }
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResults([]);
    setCurrentJob(null);

    try {
      const allMaterialIds = [
        ...selectedMaterials.map((m) => m.id),
        ...selectedUserMaterials.map((m) => m.id),
      ];

      const body = {
        prompt: prompt.trim(),
        material_ids: allMaterialIds,
        material_type: materialType === "all" ? "auto" : materialType,
        brand_id: selectedProduct?.id || null,
        output_count: outputCount,
        max_duration: maxDuration,
        orientation,
        enable_subtitles: enableSubtitles,
        enable_effects: enableEffects,
      };

      const res = await fetch(`${API_BASE}/api/v1/magic-cut/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": ADMIN_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setCurrentJob({ job_id: data.job_id, status: "queued", progress_pct: 0 });
      startPolling(data.job_id);
    } catch (e) {
      setError(e.message);
      setIsGenerating(false);
    }
  };

  // ── Polling ──
  const startPolling = (jobId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/magic-cut/jobs/${jobId}`, {
          headers: { "X-Admin-Key": ADMIN_KEY },
        });
        if (!res.ok) return;
        const data = await res.json();
        setCurrentJob(data);

        if (data.status === "done" || data.status === "failed") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setIsGenerating(false);
          if (data.status === "done") {
            setResults(data.results || []);
            fetchHistory();
          } else {
            setError(data.error || "生成に失敗しました");
          }
        }
      } catch (e) {
        console.error("[MagicCut] Poll error:", e);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Material Selection ──
  const toggleMaterial = (material) => {
    setSelectedMaterials((prev) => {
      const exists = prev.find((m) => m.id === material.id);
      if (exists) return prev.filter((m) => m.id !== material.id);
      return [...prev, material];
    });
  };

  const toggleUserMaterial = (material) => {
    setSelectedUserMaterials((prev) => {
      const exists = prev.find((m) => m.id === material.id);
      if (exists) return prev.filter((m) => m.id !== material.id);
      return [...prev, material];
    });
  };

  const formatDuration = (sec) => {
    if (!sec) return "--";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "--";
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    return `${(bytes / 1024).toFixed(0)}KB`;
  };

  // ── Prompt Examples ──
  const promptExamples = [
    "この商品の3つの卖点を30秒にまとめて",
    "一番盛り上がっている場面を15秒で切り出して",
    "商品紹介の部分だけ抽出して字幕付きで",
    "CTAスコアが高い場面を3本に分けて",
    "最初のインパクトが強い場面を縦動画で",
  ];

  // Total selected count
  const totalSelected = selectedMaterials.length + selectedUserMaterials.length + (selectedProduct ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Magic Cut</h1>
              <p className="text-xs text-gray-500">AI動画量産ツール</p>
            </div>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="ml-1 p-1 rounded-full hover:bg-purple-100 text-purple-400 hover:text-purple-600 transition-colors"
              title="Magic Cutとは？"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
              showHistory ? "bg-pink-100 text-pink-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <History className="w-3 h-3" />
            <span>履歴</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Help / Concept Panel ── */}
        {showHelp && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-5 relative">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-purple-100 text-purple-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-purple-800 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Magic Cut とは？
            </h3>
            <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
              <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
                <p className="font-semibold text-purple-700 mb-1">🎬 コンセプト</p>
                <p>既存のライバー動画素材を使って、<span className="font-bold text-purple-700">まるでそのライバーがあなたの商品をおすすめしているかのような動画</span>をAIが自動生成します。</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
                <p className="font-semibold text-purple-700 mb-1">✨ できること</p>
                <ul className="space-y-1 ml-1">
                  <li>• 1本の素材から複数バリエーションを量産</li>
                  <li>• 字幕・エフェクト・フック・ CTAをAIが自動生成</li>
                  <li>• 同じ動画でも「別動画」に見えるように加工（TikTok BAN回避）</li>
                  <li>• 商品情報を指定するだけで、その商品の訴求動画に変換</li>
                </ul>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
                <p className="font-semibold text-purple-700 mb-1">🚀 使い方</p>
                <ol className="space-y-1 ml-1 list-decimal list-inside">
                  <li>ライバー素材を選択（見た目・雰囲気で選ぶ）</li>
                  <li>商品を選択（何をプロモーションしたいか）</li>
                  <li>プロンプトで指示（例：「この商品の売点を30秒で」）</li>
                  <li>AIが自動で動画を生成！</li>
                </ol>
              </div>
              <p className="text-[10px] text-gray-500 italic">※ 将来的にFace Swap機能で、ライバーの顔を変更して無限にバリエーションを作る機能も追加予定です</p>
            </div>
          </div>
        )}

        {/* ── History Panel ── */}
        {showHistory && history.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <History className="w-4 h-4" /> 生成履歴
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((h) => (
                <div
                  key={h.job_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setPrompt(h.prompt);
                    setResults(h.results || []);
                    setShowHistory(false);
                  }}
                >
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{h.prompt}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(h.created_at).toLocaleDateString("ja-JP")} · {(h.results || []).length}本生成
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main Input Area ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Prompt Input */}
          <div className="p-5">
            <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-pink-500" />
              プロンプト（剪辑指示）
            </label>
            <div className="relative mt-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例: 洗面奶の卖点を30秒にまとめて、字幕付きで3本作って"
                className="w-full h-28 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300 text-sm"
                disabled={isGenerating}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="absolute bottom-3 right-3 p-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            {/* Prompt Examples */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {promptExamples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(ex)}
                  className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-pink-50 hover:text-pink-600 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* ── Material Selection Section ── */}
          <div className="border-t border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-semibold text-gray-700">素材選択</span>
                <span className="text-xs text-gray-400">（省略時はAIが自動選定）</span>
              </div>
              <div className="flex items-center gap-2">
                {totalSelected > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    {totalSelected}件選択中
                  </span>
                )}
                <button
                  onClick={() => setShowMaterialPicker(!showMaterialPicker)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors flex items-center gap-1"
                >
                  <Search className="w-3 h-3" />
                  素材を選ぶ
                </button>
              </div>
            </div>

            {/* Selected Materials Summary */}
            {totalSelected > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedMaterials.map((m) => (
                  <div
                    key={`liver-${m.id}`}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs"
                  >
                    <Film className="w-3 h-3" />
                    <span className="max-w-[120px] truncate">{m.name}</span>
                    <button onClick={() => toggleMaterial(m)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {selectedProduct && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs">
                    <Package className="w-3 h-3" />
                    <span className="max-w-[120px] truncate">{selectedProduct.product_name}</span>
                    <button onClick={() => setSelectedProduct(null)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {selectedUserMaterials.map((m) => (
                  <div
                    key={`user-${m.id}`}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs"
                  >
                    <Upload className="w-3 h-3" />
                    <span className="max-w-[120px] truncate">{m.name}</span>
                    <button onClick={() => toggleUserMaterial(m)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Material Picker with Tabs */}
            {showMaterialPicker && (
              <div className="border border-gray-200 rounded-lg overflow-hidden mt-2 bg-gray-50">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-white">
                  <button
                    onClick={() => setMaterialTab("liver")}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      materialTab === "liver"
                        ? "text-blue-600 border-b-2 border-blue-500 bg-blue-50/50"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    🎬 ライバー素材
                  </button>
                  <button
                    onClick={() => setMaterialTab("product")}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      materialTab === "product"
                        ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/50"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    🛍️ 商品選択
                  </button>
                  <button
                    onClick={() => setMaterialTab("upload")}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      materialTab === "upload"
                        ? "text-green-600 border-b-2 border-green-500 bg-green-50/50"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    📤 素材アップロード
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-3">
                  {/* ── Liver Materials Tab ── */}
                  {materialTab === "liver" && (
                    <>
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={materialSearch}
                            onChange={(e) => setMaterialSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchMaterials()}
                            placeholder="商品名・キーワードで検索..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        </div>
                        <select
                          value={materialType}
                          onChange={(e) => setMaterialType(e.target.value)}
                          className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        >
                          <option value="all">全て</option>
                          <option value="video">直播回放</option>
                          <option value="clip">クリップ</option>
                        </select>
                        <button
                          onClick={fetchMaterials}
                          className="p-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-100"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loadingMaterials ? "animate-spin" : ""}`} />
                        </button>
                      </div>

                      {/* Preview Modal */}
                      {previewingMaterial && (
                        <div className="mb-3 bg-black rounded-lg overflow-hidden relative">
                          <button
                            onClick={() => setPreviewingMaterial(null)}
                            className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <video
                            src={previewingMaterial.preview_url || previewingMaterial.clip_url}
                            controls
                            autoPlay
                            className="w-full max-h-48 object-contain"
                          />
                          <div className="p-2 bg-gray-900 text-white text-xs">
                            <p className="font-medium truncate">{previewingMaterial.name}</p>
                            {previewingMaterial.transcript && (
                              <p className="text-gray-400 mt-0.5 truncate">{previewingMaterial.transcript}</p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="max-h-64 overflow-y-auto space-y-1.5">
                        {loadingMaterials ? (
                          <div className="text-center py-4 text-xs text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                            読み込み中...
                          </div>
                        ) : materials.length === 0 ? (
                          <div className="text-center py-4 text-xs text-gray-400">素材が見つかりません</div>
                        ) : (
                          materials.map((m) => {
                            const isSelected = selectedMaterials.some((s) => s.id === m.id);
                            return (
                              <div
                                key={m.id}
                                className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-blue-100 border border-blue-300"
                                    : "bg-white border border-gray-100 hover:border-blue-200"
                                }`}
                              >
                                <div
                                  onClick={() => toggleMaterial(m)}
                                  className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                                    isSelected ? "bg-blue-500" : "bg-gray-200"
                                  }`}
                                >
                                  {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                                <div
                                  onClick={() => toggleMaterial(m)}
                                  className="w-14 h-10 rounded overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center"
                                >
                                  {m.thumbnail_url ? (
                                    <img
                                      src={m.thumbnail_url}
                                      className="w-full h-full object-cover"
                                      alt=""
                                    />
                                  ) : (
                                    <Film className="w-4 h-4 text-gray-300" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0" onClick={() => toggleMaterial(m)}>
                                  <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                    <span
                                      className={`px-1.5 py-0.5 rounded ${
                                        m.type === "video"
                                          ? "bg-blue-50 text-blue-600"
                                          : "bg-green-50 text-green-600"
                                      }`}
                                    >
                                      {m.type === "video" ? "回放" : "クリップ"}
                                    </span>
                                    {m.duration_sec && (
                                      <span className="flex items-center gap-0.5">
                                        <Clock className="w-2.5 h-2.5" />
                                        {formatDuration(m.duration_sec)}
                                      </span>
                                    )}
                                    {m.product_name && (
                                      <span className="truncate max-w-[80px]">{m.product_name}</span>
                                    )}
                                    {m.liver_name && (
                                      <span className="text-purple-500">{m.liver_name}</span>
                                    )}
                                  </div>
                                </div>
                                {/* Preview Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewingMaterial(
                                      previewingMaterial?.id === m.id ? null : m
                                    );
                                  }}
                                  className="p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                                  title="プレビュー"
                                >
                                  {previewingMaterial?.id === m.id ? (
                                    <Pause className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}

                  {/* ── Product Tab ── */}
                  {materialTab === "product" && (
                    <>
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchProducts()}
                            placeholder="商品名・ブランド名で検索..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-300"
                          />
                        </div>
                        <button
                          onClick={fetchProducts}
                          className="p-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-100"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loadingProducts ? "animate-spin" : ""}`} />
                        </button>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-1.5">
                        {loadingProducts ? (
                          <div className="text-center py-4 text-xs text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                            読み込み中...
                          </div>
                        ) : products.length === 0 ? (
                          <div className="text-center py-4 text-xs text-gray-400">
                            商品が見つかりません
                          </div>
                        ) : (
                          products.map((p) => {
                            const isSelected = selectedProduct?.id === p.id;
                            const firstImage = (p.image_urls || [])[0];
                            return (
                              <div
                                key={p.id}
                                onClick={() => setSelectedProduct(isSelected ? null : p)}
                                className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-orange-100 border border-orange-300"
                                    : "bg-white border border-gray-100 hover:border-orange-200"
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                                    isSelected ? "bg-orange-500" : "bg-gray-200"
                                  }`}
                                >
                                  {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                                {firstImage && (
                                  <img
                                    src={firstImage}
                                    className="w-10 h-10 rounded object-cover shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-800 truncate">
                                    {p.product_name}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                    {p.brand_name && (
                                      <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">
                                        {p.brand_name}
                                      </span>
                                    )}
                                    {p.image_urls && p.image_urls.length > 0 && (
                                      <span>{p.image_urls.length}枚画像</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}

                  {/* ── Upload Tab ── */}
                  {materialTab === "upload" && (
                    <>
                      {/* Upload Area */}
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-green-400 hover:bg-green-50/50 transition-colors cursor-pointer mb-3"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="video/*,image/*,audio/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        {uploading ? (
                          <div>
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-green-500 mb-2" />
                            <p className="text-xs text-green-600">アップロード中... {uploadProgress}%</p>
                            <div className="w-32 mx-auto bg-gray-200 rounded-full h-1.5 mt-2">
                              <div
                                className="bg-green-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                            <p className="text-xs text-gray-600 font-medium">
                              クリックまたはドラッグ&ドロップ
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              動画・画像・音声ファイル対応（最大500MB）
                            </p>
                          </div>
                        )}
                      </div>

                      {/* User Materials List */}
                      <div className="max-h-48 overflow-y-auto space-y-1.5">
                        {loadingUserMaterials ? (
                          <div className="text-center py-4 text-xs text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                            読み込み中...
                          </div>
                        ) : userMaterials.length === 0 ? (
                          <div className="text-center py-3 text-xs text-gray-400">
                            アップロード済み素材なし
                          </div>
                        ) : (
                          userMaterials.map((m) => {
                            const isSelected = selectedUserMaterials.some((s) => s.id === m.id);
                            const icon =
                              m.category === "video" ? (
                                <Video className="w-3.5 h-3.5 text-blue-500" />
                              ) : m.category === "image" ? (
                                <Image className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Music className="w-3.5 h-3.5 text-purple-500" />
                              );
                            return (
                              <div
                                key={m.id}
                                className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-green-100 border border-green-300"
                                    : "bg-white border border-gray-100 hover:border-green-200"
                                }`}
                              >
                                <div
                                  onClick={() => toggleUserMaterial(m)}
                                  className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                                    isSelected ? "bg-green-500" : "bg-gray-200"
                                  }`}
                                >
                                  {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                                <div className="shrink-0">{icon}</div>
                                {m.category === "image" && m.preview_url && (
                                  <img
                                    src={m.preview_url}
                                    className="w-8 h-8 rounded object-cover shrink-0"
                                    onClick={() => toggleUserMaterial(m)}
                                  />
                                )}
                                <div
                                  className="flex-1 min-w-0"
                                  onClick={() => toggleUserMaterial(m)}
                                >
                                  <p className="text-xs font-medium text-gray-800 truncate">
                                    {m.name}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                    <span className="px-1.5 py-0.5 rounded bg-gray-100">
                                      {m.category}
                                    </span>
                                    {m.duration_sec && (
                                      <span>{formatDuration(m.duration_sec)}</span>
                                    )}
                                    {m.file_size && <span>{formatFileSize(m.file_size)}</span>}
                                  </div>
                                </div>
                                {/* Preview for video/audio */}
                                {m.category === "video" && m.preview_url && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewingMaterial(
                                        previewingMaterial?.id === m.id ? null : { ...m, type: "user" }
                                      );
                                    }}
                                    className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600"
                                    title="プレビュー"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUserMaterial(m.id);
                                  }}
                                  className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                                  title="削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-5 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gray-400" />
                詳細設定
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAdvanced && (
              <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">出力本数</label>
                  <select
                    value={outputCount}
                    onChange={(e) => setOutputCount(Number(e.target.value))}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5"
                  >
                    {[1, 2, 3, 5, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}本
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">最大尺</label>
                  <select
                    value={maxDuration}
                    onChange={(e) => setMaxDuration(Number(e.target.value))}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5"
                  >
                    {[15, 30, 60, 90, 120, 180].map((n) => (
                      <option key={n} value={n}>
                        {n}秒
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">向き</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5"
                  >
                    <option value="vertical">縦 (9:16)</option>
                    <option value="horizontal">横 (16:9)</option>
                    <option value="auto">自動</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSubtitles}
                      onChange={(e) => setEnableSubtitles(e.target.checked)}
                      className="rounded border-gray-300 text-pink-500 focus:ring-pink-300"
                    />
                    字幕
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableEffects}
                      onChange={(e) => setEnableEffects(e.target.checked)}
                      className="rounded border-gray-300 text-pink-500 focus:ring-pink-300"
                    />
                    エフェクト
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Progress ── */}
        {isGenerating && currentJob && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {currentJob.current_step || "処理中..."}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">ステータス: {currentJob.status}</p>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-pink-400 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${currentJob.progress_pct || 0}%` }}
              />
            </div>
            <p className="text-right text-xs text-gray-400 mt-1">{currentJob.progress_pct || 0}%</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && !isGenerating && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">生成エラー</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-400 hover:text-red-600" />
            </button>
          </div>
        )}

        {/* ── Results ── */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              生成結果: {results.filter((r) => r.status === "done").length}本完成
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`bg-white rounded-xl border overflow-hidden ${
                    r.status === "done" ? "border-green-200" : "border-red-200"
                  }`}
                >
                  {r.status === "done" ? (
                    <>
                      <div className="bg-black aspect-video relative">
                        {r.blob_url || r.download_url ? (
                          <video
                            src={r.blob_url || r.download_url}
                            controls
                            className="w-full h-full object-contain"
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-8 h-8 text-gray-500" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">動画 #{i + 1}</span>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400">
                            {r.duration_sec && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {formatDuration(r.duration_sec)}
                              </span>
                            )}
                            {r.file_size && <span>{formatFileSize(r.file_size)}</span>}
                            {r.clips_used && <span>{r.clips_used}素材使用</span>}
                          </div>
                        </div>
                        {r.prompt_summary && (
                          <p className="text-[10px] text-gray-400 mb-2 truncate">{r.prompt_summary}</p>
                        )}
                        <a
                          href={r.download_url || r.blob_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                        >
                          <Download className="w-3.5 h-3.5" />
                          ダウンロード
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">動画 #{i + 1} - エラー</span>
                      </div>
                      <p className="text-[10px] text-red-500 mt-1">{r.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {!isGenerating && results.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
              <Scissors className="w-8 h-8 text-pink-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Magic Cut</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              プロンプトを入力して、AIに動画を自動剪辑させましょう。
              ライバー素材・商品・自分の素材を組み合わせて、最適な動画を生成します。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
