import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  RefreshCw,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  Zap,
  Play,
  Copy,
  ExternalLink,
  Link,
  Camera,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const ADMIN_KEY = "aither:hub";

export default function AiVideoGeneratorPage() {
  const navigate = useNavigate();

  // ── Input Mode ──
  const [inputMode, setInputMode] = useState("upload"); // "upload" | "image_url" | "page_url"

  // ── Product Input State ──
  const [imageFile, setImageFile] = useState(null); // { file, preview }
  const [imageUrl, setImageUrl] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedProduct, setAnalyzedProduct] = useState(null); // { name, description, price, brand, notes }

  // ── Manual Override (editable after analysis) ──
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productPrice, setProductPrice] = useState("");

  // ── Avatar/Liver State ──
  const [avatars, setAvatars] = useState([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [loadingAvatars, setLoadingAvatars] = useState(true);

  // ── Generation Options (collapsed by default) ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tone, setTone] = useState("energetic");
  const [language, setLanguage] = useState("ja");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [customScript, setCustomScript] = useState("");
  const [useCustomScript, setUseCustomScript] = useState(false);
  const [benefits, setBenefits] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  // ── Job State ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [error, setError] = useState(null);

  // ── Job History ──
  const [jobHistory, setJobHistory] = useState([]);

  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Load Avatars & History ──
  useEffect(() => {
    loadAvatars();
    loadJobHistory();
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const loadAvatars = async (retryCount = 0) => {
    try {
      setLoadingAvatars(true);
      const res = await axios.get(`${API_BASE}/api/v1/ai-video-generator/avatars`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
        timeout: 60000, // 60s - SAS token generation can be slow on first call
      });
      setAvatars(res.data.avatars || []);
      if (res.data.avatars?.length > 0) {
        setSelectedAvatarId(res.data.avatars[0].avatar_id);
      }
    } catch (err) {
      console.error("Failed to load avatars:", err);
      // Retry once on timeout/network error
      if (retryCount < 1 && (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || !err.response)) {
        console.log("Retrying avatar load...");
        return loadAvatars(retryCount + 1);
      }
    } finally {
      setLoadingAvatars(false);
    }
  };

  const loadJobHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/ai-video-generator/jobs?limit=10`, {
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      setJobHistory(res.data.jobs || []);
    } catch (err) {
      console.error("Failed to load job history:", err);
    }
  };

  // ── Image Upload Handler ──
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("画像サイズは20MB以下にしてください");
      return;
    }
    setImageFile({ file, preview: URL.createObjectURL(file) });
    setError(null);
    e.target.value = "";
  };

  // ── Analyze Product ──
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalyzedProduct(null);

    try {
      let res;

      if (inputMode === "upload" && imageFile) {
        // Upload image directly as multipart
        const formData = new FormData();
        formData.append("image", imageFile.file);
        res = await axios.post(
          `${API_BASE}/api/v1/ai-video-generator/analyze-product`,
          formData,
          {
            headers: {
              "X-Admin-Key": ADMIN_KEY,
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } else if (inputMode === "image_url" && imageUrl.trim()) {
        res = await axios.post(
          `${API_BASE}/api/v1/ai-video-generator/analyze-product?image_url=${encodeURIComponent(imageUrl.trim())}`,
          null,
          { headers: { "X-Admin-Key": ADMIN_KEY } }
        );
      } else if (inputMode === "page_url" && pageUrl.trim()) {
        res = await axios.post(
          `${API_BASE}/api/v1/ai-video-generator/analyze-product?page_url=${encodeURIComponent(pageUrl.trim())}`,
          null,
          { headers: { "X-Admin-Key": ADMIN_KEY } }
        );
      } else {
        setError("商品写真、画像URL、または商品ページURLを入力してください");
        setIsAnalyzing(false);
        return;
      }

      if (res.data.success && res.data.product) {
        const p = res.data.product;
        setAnalyzedProduct(p);
        setProductName(p.name || "");
        setProductDescription(p.description || "");
        setProductPrice(p.price || "");
        if (res.data.image_url && !res.data.image_url.startsWith("data:")) {
          setProductImageUrl(res.data.image_url);
        }
      } else {
        setError("商品情報を解析できませんでした。別の画像をお試しください。");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "商品解析に失敗しました");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Generate Video ──
  const handleGenerate = async () => {
    if (!productName.trim() && !analyzedProduct) {
      setError("まず商品を解析するか、商品名を入力してください");
      return;
    }
    if (!selectedAvatarId) {
      setError("ライバーを選択してください");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setJobStatus(null);

    try {
      const payload = {
        product_name: productName.trim() || analyzedProduct?.name || "商品",
        product_description: productDescription.trim() || analyzedProduct?.description || undefined,
        product_image_url: productImageUrl.trim() || undefined,
        product_price: productPrice.trim() || analyzedProduct?.price || undefined,
        benefits: benefits.trim() || analyzedProduct?.notes || undefined,
        target_audience: targetAudience.trim() || undefined,
        avatar_id: selectedAvatarId,
        voice_id: selectedVoiceId || undefined,
        tone,
        language,
        duration_seconds: durationSeconds,
        custom_script: useCustomScript ? customScript.trim() : undefined,
      };

      const res = await axios.post(
        `${API_BASE}/api/v1/ai-video-generator/generate`,
        payload,
        { headers: { "X-Admin-Key": ADMIN_KEY } }
      );

      if (res.data.success) {
        setCurrentJobId(res.data.job_id);
        setJobStatus({ status: "queued", progress: 0 });
        startPolling(res.data.job_id);
      } else {
        setError(res.data.error || "生成に失敗しました");
        setIsGenerating(false);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "生成に失敗しました");
      setIsGenerating(false);
    }
  };

  // ── Poll for Status ──
  const startPolling = (jobId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/v1/ai-video-generator/status/${jobId}`,
          { headers: { "X-Admin-Key": ADMIN_KEY } }
        );
        setJobStatus(res.data);
        if (res.data.status === "completed" || res.data.status === "failed") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setIsGenerating(false);
          loadJobHistory();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);
  };

  const getStatusLabel = (status) => {
    const labels = {
      queued: "キューに追加中...",
      generating_script: "🧠 AI台本を生成中...",
      generating_audio: "🎙️ 音声を生成中...",
      generating_video: "🎬 動画を生成中...",
      completed: "✅ 完成！",
      failed: "❌ エラー",
    };
    return labels[status] || status;
  };

  const getProgressColor = (status) => {
    if (status === "completed") return "bg-green-500";
    if (status === "failed") return "bg-red-500";
    return "bg-emerald-500";
  };

  const hasInput = () => {
    if (inputMode === "upload") return !!imageFile;
    if (inputMode === "image_url") return !!imageUrl.trim();
    if (inputMode === "page_url") return !!pageUrl.trim();
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/ai-live-creator")}
              className="p-2 hover:bg-gray-800 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                AI Video Generator
              </h1>
              <p className="text-sm text-gray-400">
                商品写真を入れるだけ → ライバーが紹介する動画を自動生成
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-medium">
            Beta
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ═══ Left Column: Simplified Input ═══ */}
          <div className="lg:col-span-2 space-y-6">

            {/* STEP 1: Product Input (Simplified) */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                商品を入力
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                写真・画像URL・商品ページURLのいずれかを入力 → AIが自動解析します
              </p>

              {/* Input Mode Tabs */}
              <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setInputMode("upload")}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                    inputMode === "upload"
                      ? "bg-emerald-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  写真アップ
                </button>
                <button
                  onClick={() => setInputMode("image_url")}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                    inputMode === "image_url"
                      ? "bg-emerald-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  画像URL
                </button>
                <button
                  onClick={() => setInputMode("page_url")}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                    inputMode === "page_url"
                      ? "bg-emerald-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Link className="w-3.5 h-3.5" />
                  商品ページURL
                </button>
              </div>

              {/* Input Area */}
              {inputMode === "upload" && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  {imageFile ? (
                    <div className="relative">
                      <img
                        src={imageFile.preview}
                        alt="Product"
                        className="w-full max-h-64 object-contain rounded-lg border border-gray-700 bg-gray-800"
                      />
                      <button
                        onClick={() => { setImageFile(null); setAnalyzedProduct(null); }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-12 border-2 border-dashed border-gray-700 hover:border-emerald-500/50 rounded-xl flex flex-col items-center gap-3 transition group"
                    >
                      <div className="w-14 h-14 rounded-full bg-gray-800 group-hover:bg-emerald-500/10 flex items-center justify-center transition">
                        <Camera className="w-7 h-7 text-gray-500 group-hover:text-emerald-400 transition" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-300">クリックして商品写真を選択</p>
                        <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP（20MBまで）</p>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {inputMode === "image_url" && (
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/product-image.jpg"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              )}

              {inputMode === "page_url" && (
                <div>
                  <input
                    type="text"
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    placeholder="https://www.rakuten.co.jp/... or https://www.amazon.co.jp/..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    楽天・Amazon・Yahoo!ショッピング・自社ECサイトなどの商品ページURL
                  </p>
                </div>
              )}

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !hasInput()}
                className={`mt-4 w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition ${
                  isAnalyzing || !hasInput()
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AIが商品を解析中...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    AIで商品情報を解析
                  </>
                )}
              </button>

              {/* Analysis Result */}
              {analyzedProduct && (
                <div className="mt-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-300">商品情報を検出しました</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">商品名</label>
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="w-full mt-0.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">説明・特徴</label>
                      <textarea
                        value={productDescription}
                        onChange={(e) => setProductDescription(e.target.value)}
                        rows={2}
                        className="w-full mt-0.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white focus:border-emerald-500 outline-none resize-none"
                      />
                    </div>
                    {productPrice && (
                      <div>
                        <label className="text-xs text-gray-500">価格</label>
                        <input
                          type="text"
                          value={productPrice}
                          onChange={(e) => setProductPrice(e.target.value)}
                          className="w-full mt-0.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white focus:border-emerald-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">※ 解析結果は編集できます</p>
                </div>
              )}
            </div>

            {/* Advanced Options (Collapsed) */}
            <div className="bg-gray-900 rounded-xl border border-gray-800">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  詳細オプション
                </span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {showAdvanced && (
                <div className="px-6 pb-6 space-y-4 border-t border-gray-800 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">トーン</label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                      >
                        <option value="energetic">🔥 元気・テンション高め</option>
                        <option value="professional_friendly">💼 プロフェッショナル</option>
                        <option value="calm">🌿 落ち着き・高級感</option>
                        <option value="sexy">✨ 魅力的・自信</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">言語</label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                      >
                        <option value="ja">🇯🇵 日本語</option>
                        <option value="en">🇺🇸 English</option>
                        <option value="zh">🇨🇳 中文</option>
                        <option value="ko">🇰🇷 한국어</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">動画の長さ</label>
                      <select
                        value={durationSeconds}
                        onChange={(e) => setDurationSeconds(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                      >
                        <option value={30}>30秒（ショート）</option>
                        <option value={60}>60秒（スタンダード）</option>
                        <option value={90}>90秒（ロング）</option>
                        <option value={120}>120秒（フル）</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">特典・限定オファー</label>
                    <input
                      type="text"
                      value={benefits}
                      onChange={(e) => setBenefits(e.target.value)}
                      placeholder="例: 今だけ送料無料、2本セットで20%OFF"
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">ターゲット層</label>
                    <input
                      type="text"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="例: 30代女性、カラーリングの色落ちに悩む方"
                      className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  {/* Custom Script */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomScript}
                        onChange={(e) => setUseCustomScript(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-300">自分で台本を書く（AI生成をスキップ）</span>
                    </label>
                    {useCustomScript && (
                      <textarea
                        value={customScript}
                        onChange={(e) => setCustomScript(e.target.value)}
                        placeholder="ライバーに話してほしい台本を入力..."
                        rows={4}
                        className="mt-2 w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-emerald-500 outline-none resize-none"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!productName.trim() && !analyzedProduct) || !selectedAvatarId}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                isGenerating || (!productName.trim() && !analyzedProduct) || !selectedAvatarId
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  動画を生成する
                </>
              )}
            </button>

            {/* Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Job Status */}
            {jobStatus && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Video className="w-5 h-5 text-blue-400" />
                  生成ステータス
                </h3>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{getStatusLabel(jobStatus.status)}</span>
                    <span className="text-gray-400">{jobStatus.progress}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(jobStatus.status)}`}
                      style={{ width: `${jobStatus.progress}%` }}
                    />
                  </div>
                </div>

                {jobStatus.script && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">生成された台本:</h4>
                    <div className="bg-gray-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{jobStatus.script}</p>
                    </div>
                  </div>
                )}

                {jobStatus.status === "completed" && jobStatus.video_url && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      動画が完成しました！
                    </h4>
                    <div className="relative rounded-lg overflow-hidden bg-black max-w-sm mx-auto">
                      <video
                        src={jobStatus.video_url}
                        controls
                        className="w-full aspect-[9/16]"
                        poster=""
                      />
                    </div>
                    <div className="flex gap-3 mt-3 justify-center">
                      <a
                        href={jobStatus.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                      >
                        <Download className="w-4 h-4" />
                        ダウンロード
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(jobStatus.video_url)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                      >
                        <Copy className="w-4 h-4" />
                        URLコピー
                      </button>
                    </div>
                  </div>
                )}

                {jobStatus.status === "failed" && (
                  <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-red-300 text-sm">エラー: {jobStatus.error || "不明なエラー"}</p>
                    <p className="text-red-400/60 text-xs mt-1">ステップ: {jobStatus.error_step}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ Right Column: Avatar Selection & History ═══ */}
          <div className="space-y-6">

            {/* Avatar Selection */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mic className="w-5 h-5 text-emerald-400" />
                ライバー選択
              </h2>

              {loadingAvatars ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span className="text-gray-400 text-sm">ライバーを読み込み中...</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="rounded-lg overflow-hidden border-2 border-gray-700">
                        <div className="w-full aspect-[9/16] bg-gray-800 animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : avatars.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  利用可能なライバーがありません
                </p>
              ) : (
                <>
                  {/* AitherHub Livers */}
                  {avatars.filter(a => a.source === 'aitherhub').length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-emerald-400 font-medium mb-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                        AitherHub ライバー
                      </p>
                      <div className="grid grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                        {avatars.filter(a => a.source === 'aitherhub').map((avatar) => (
                          <button
                            key={avatar.avatar_id}
                            onClick={() => setSelectedAvatarId(avatar.avatar_id)}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                              selectedAvatarId === avatar.avatar_id
                                ? "border-emerald-500 ring-2 ring-emerald-500/30 scale-[1.02]"
                                : "border-gray-700 hover:border-gray-600 hover:scale-[1.01]"
                            }`}
                          >
                            {avatar.preview_image_url ? (
                              avatar.preview_image_url.includes('.mp4') || avatar.preview_image_url.includes('/clips/') ? (
                                <video
                                  src={avatar.preview_image_url}
                                  className="w-full aspect-[9/16] object-cover"
                                  preload="metadata"
                                  muted
                                  onMouseEnter={(e) => { try { e.target.play(); } catch {} }}
                                  onMouseLeave={(e) => { try { e.target.pause(); e.target.currentTime = 0; } catch {} }}
                                />
                              ) : (
                                <img src={avatar.preview_image_url} alt={avatar.name} className="w-full aspect-[9/16] object-cover" />
                              )
                            ) : (
                              <div className="w-full aspect-[9/16] bg-gray-800 flex items-center justify-center">
                                <Mic className="w-6 h-6 text-gray-600" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                              <p className="text-[10px] font-medium truncate">{avatar.name}</p>
                            </div>
                            {selectedAvatarId === avatar.avatar_id && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Digital Twins */}
                  {avatars.filter(a => a.source !== 'aitherhub').length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-500 inline-block"></span>
                        Digital Twin
                      </p>
                      <div className="grid grid-cols-3 gap-2.5 max-h-40 overflow-y-auto pr-1">
                        {avatars.filter(a => a.source !== 'aitherhub').map((avatar) => (
                          <button
                            key={avatar.avatar_id}
                            onClick={() => setSelectedAvatarId(avatar.avatar_id)}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                              selectedAvatarId === avatar.avatar_id
                                ? "border-emerald-500 ring-2 ring-emerald-500/30 scale-[1.02]"
                                : "border-gray-700 hover:border-gray-600 hover:scale-[1.01]"
                            }`}
                          >
                            {avatar.preview_image_url ? (
                              <img src={avatar.preview_image_url} alt={avatar.name} className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square bg-gray-800 flex items-center justify-center">
                                <Mic className="w-6 h-6 text-gray-600" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                              <p className="text-[10px] font-medium truncate">{avatar.name}</p>
                            </div>
                            {selectedAvatarId === avatar.avatar_id && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Job History */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                生成履歴
              </h2>
              {jobHistory.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">まだ生成履歴がありません</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {jobHistory.map((job) => (
                    <div key={job.job_id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate flex-1">{job.product_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          job.status === "completed" ? "bg-green-500/20 text-green-300" :
                          job.status === "failed" ? "bg-red-500/20 text-red-300" :
                          "bg-yellow-500/20 text-yellow-300"
                        }`}>
                          {job.status === "completed" ? "完成" : job.status === "failed" ? "失敗" : "処理中"}
                        </span>
                      </div>
                      {job.video_url && (
                        <a href={job.video_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          動画を見る
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="bg-gradient-to-br from-emerald-900/20 to-cyan-900/20 rounded-xl border border-emerald-500/20 p-6">
              <h3 className="text-sm font-semibold text-emerald-300 mb-3">使い方（3ステップ）</h3>
              <div className="space-y-2.5 text-xs text-gray-400">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span>
                  <span>商品写真をアップ or URLを貼る → AIが自動解析</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</span>
                  <span>ライバーを選択</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span>
                  <span>「動画を生成する」をクリック → 完成動画をダウンロード</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
