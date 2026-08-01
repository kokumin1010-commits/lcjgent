/**
 * BuybackPage - ユーザー向け中古ブランド買取ページ
 * モバイルファースト設計、LINE認証ユーザー向け
 * 
 * 改善点:
 * - 画像アップロード前にクライアントサイド圧縮
 * - キャンセル機能追加
 * - 査定拒否機能追加
 * - チャット自動スクロール
 * - スケルトンローディング
 * - AI査定結果に真贋チェック・市場トレンド表示
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Camera, ArrowLeft, Check, Package, Truck, 
  Clock, Send, ChevronRight, X, Image as ImageIcon,
  Sparkles, Shield, Coins, AlertTriangle, Ban, TrendingUp
} from "lucide-react";

const CATEGORIES = [
  { value: "bag", label: "バッグ", emoji: "👜" },
  { value: "watch", label: "時計", emoji: "⌚" },
  { value: "jewelry", label: "ジュエリー", emoji: "💎" },
  { value: "apparel", label: "アパレル", emoji: "👔" },
  { value: "shoes", label: "靴", emoji: "👟" },
  { value: "accessory", label: "アクセサリー", emoji: "📿" },
  { value: "other", label: "その他", emoji: "🎁" },
] as const;

const CONDITION_OPTIONS = [
  { value: "new", label: "新品・未使用", color: "text-green-600" },
  { value: "like_new", label: "ほぼ新品", color: "text-emerald-600" },
  { value: "good", label: "良好", color: "text-blue-600" },
  { value: "fair", label: "やや使用感あり", color: "text-yellow-600" },
  { value: "poor", label: "使用感あり", color: "text-red-600" },
] as const;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "査定待ち", color: "bg-yellow-100 text-yellow-800" },
  ai_assessed: { label: "AI査定完了", color: "bg-blue-100 text-blue-800" },
  partner_assessed: { label: "パートナー査定済", color: "bg-purple-100 text-purple-800" },
  accepted: { label: "承認済み", color: "bg-green-100 text-green-800" },
  shipped: { label: "発送済み", color: "bg-indigo-100 text-indigo-800" },
  received: { label: "受取確認", color: "bg-teal-100 text-teal-800" },
  completed: { label: "完了", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "キャンセル", color: "bg-gray-100 text-gray-800" },
  rejected: { label: "拒否", color: "bg-red-100 text-red-800" },
};

// Image compression utility
async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas context failed")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BuybackPage() {
  const [, params] = useRoute("/buyback/:id");
  const requestId = params?.id ? Number(params.id) : null;

  const lineUserQuery = trpc.lineLogin.me.useQuery();
  const lineUser = lineUserQuery.data;

  if (!lineUser) {
    return <LoginPrompt />;
  }

  if (requestId) {
    return <RequestDetail requestId={requestId} lineUserId={lineUser.lineUserId} />;
  }

  return <BuybackHome lineUserId={lineUser.lineUserId} displayName={lineUser.displayName || ""} />;
}

function LoginPrompt() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">ログインが必要です</h2>
        <p className="text-gray-600 mb-6">買取サービスを利用するにはLINEログインが必要です。</p>
        <a href="/line-login?redirect=/buyback" className="inline-block bg-[#06C755] text-white px-8 py-3 rounded-full font-bold">
          LINEでログイン
        </a>
      </div>
    </div>
  );
}

// Skeleton for request list
function RequestListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="w-14 h-14 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BuybackHome({ lineUserId, displayName }: { lineUserId: string; displayName: string }) {
  const [view, setView] = useState<"home" | "new">("home");
  const myRequests = trpc.buyback.getMyRequests.useQuery({ lineUserId });

  if (view === "new") {
    return <NewRequest lineUserId={lineUserId} displayName={displayName} onBack={() => setView("home")} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white p-6 pb-12">
        <h1 className="text-2xl font-bold">ブランド買取</h1>
        <p className="text-amber-100 text-sm mt-1">不要なブランド品を高価買取</p>
      </div>

      {/* Features */}
      <div className="px-4 -mt-8">
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-xs text-gray-600">AI即時査定</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Shield className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-xs text-gray-600">複数社競合</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Coins className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-xs text-gray-600">ポイント還元</p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => setView("new")}
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
        >
          <Camera className="inline w-5 h-5 mr-2 -mt-0.5" />
          写真を撮って査定する
        </button>

        {/* My Requests */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">買取履歴</h2>
          {myRequests.isLoading ? (
            <RequestListSkeleton />
          ) : myRequests.data?.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>まだ買取依頼はありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.data?.map((req: any) => (
                <a
                  key={req.id}
                  href={`/buyback/${req.id}`}
                  className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    {req.imageUrls?.[0] ? (
                      <img src={req.imageUrls[0]} alt="" className="w-14 h-14 rounded-lg object-cover" />
                    ) : (
                      <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {req.aiBrand || req.brandName || "ブランド不明"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_LABELS[req.status]?.color || "bg-gray-100"}`}>
                          {STATUS_LABELS[req.status]?.label || req.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{req.aiModel || req.productName || req.category}</p>
                      {req.aiEstimatedMin && (
                        <p className="text-sm font-medium text-amber-600">
                          ¥{Number(req.aiEstimatedMin).toLocaleString()}〜¥{Number(req.aiEstimatedMax).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewRequest({ lineUserId, displayName, onBack }: { lineUserId: string; displayName: string; onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [category, setCategory] = useState("");
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.buyback.uploadImage.useMutation();
  const createMutation = trpc.buyback.createRequest.useMutation();

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    setUploadProgress(0);

    const fileArray = Array.from(files);
    let completed = 0;

    for (const file of fileArray) {
      if (images.length + completed >= 10) break;
      try {
        // Compress image before upload
        const base64 = await compressImage(file, 1200, 0.8);
        const { url } = await uploadMutation.mutateAsync({
          base64,
          filename: file.name.replace(/\.[^.]+$/, ".jpg"),
          contentType: "image/jpeg",
        });
        setImages(prev => [...prev, url]);
        completed++;
        setUploadProgress(Math.round((completed / fileArray.length) * 100));
      } catch (err) {
        console.error("Upload error:", err);
      }
    }
    setUploading(false);
    setUploadProgress(0);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [images, uploadMutation]);

  const handleSubmit = async () => {
    if (images.length === 0 || !category) return;
    setSubmitting(true);
    try {
      const res = await createMutation.mutateAsync({
        lineUserId,
        displayName,
        category: category as any,
        brandName: brandName || undefined,
        productName: productName || undefined,
        description: description || undefined,
        condition: condition as any || undefined,
        imageUrls: images,
      });
      setResult(res);
      setStep(4);
    } catch (err: any) {
      alert("エラーが発生しました: " + (err.message || "不明なエラー"));
    }
    setSubmitting(false);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">買取査定依頼</h1>
        <div className="ml-auto text-sm text-gray-400">ステップ {step}/3</div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      {/* Step 1: Photos */}
      {step === 1 && (
        <div className="p-4">
          <h2 className="text-lg font-bold mb-2">商品の写真を撮影</h2>
          <p className="text-sm text-gray-500 mb-4">
            正面・背面・ロゴ・傷がある箇所など、複数枚アップロードしてください（最大10枚）
          </p>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {images.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 10 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-amber-400 transition-colors"
                disabled={uploading}
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
                    {uploadProgress > 0 && (
                      <span className="text-xs text-amber-600 mt-1">{uploadProgress}%</span>
                    )}
                  </div>
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-400">追加</span>
                  </>
                )}
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-3">
            画像は自動的に圧縮されます。高画質な写真を撮影してください。
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />

          <button
            onClick={() => setStep(2)}
            disabled={images.length === 0}
            className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            次へ（商品情報入力）
          </button>
        </div>
      )}

      {/* Step 2: Product Info */}
      {step === 2 && (
        <div className="p-4">
          <h2 className="text-lg font-bold mb-4">商品情報</h2>

          <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ *</label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`p-2 rounded-lg border text-center text-xs transition-all ${
                  category === cat.value
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-lg mb-0.5">{cat.emoji}</div>
                {cat.label}
              </button>
            ))}
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-1">ブランド名</label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="例: Louis Vuitton, CHANEL"
            className="w-full px-3 py-2 border rounded-lg mb-3 text-sm"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">商品名・型番</label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="例: ネヴァーフル MM"
            className="w-full px-3 py-2 border rounded-lg mb-3 text-sm"
          />

          <label className="block text-sm font-medium text-gray-700 mb-2">状態</label>
          <div className="space-y-2 mb-4">
            {CONDITION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setCondition(opt.value)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                  condition === opt.value
                    ? "border-amber-500 bg-amber-50"
                    : "border-gray-200"
                }`}
              >
                <span className={opt.color}>{opt.label}</span>
              </button>
            ))}
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-1">補足説明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="傷や汚れの状態、付属品の有無など"
            className="w-full px-3 py-2 border rounded-lg mb-4 text-sm h-20 resize-none"
          />

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-6 py-3 border rounded-xl font-medium">
              戻る
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!category}
              className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold disabled:opacity-50"
            >
              確認画面へ
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="p-4">
          <h2 className="text-lg font-bold mb-4">内容確認</h2>

          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex gap-2 overflow-x-auto mb-3 pb-2">
              {images.map((url, i) => (
                <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ))}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">カテゴリ</span>
                <span className="font-medium">{CATEGORIES.find(c => c.value === category)?.label}</span>
              </div>
              {brandName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">ブランド</span>
                  <span className="font-medium">{brandName}</span>
                </div>
              )}
              {productName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">商品名</span>
                  <span className="font-medium">{productName}</span>
                </div>
              )}
              {condition && (
                <div className="flex justify-between">
                  <span className="text-gray-500">状態</span>
                  <span className="font-medium">{CONDITION_OPTIONS.find(c => c.value === condition)?.label}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-sm text-blue-700">
            <Sparkles className="inline w-4 h-4 mr-1" />
            送信後、AIが即時に概算査定を行い、その後パートナーから正式な査定額が届きます。
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-6 py-3 border rounded-xl font-medium">
              戻る
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  AI査定中...
                </span>
              ) : (
                "査定依頼を送信"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 4 && result && (
        <div className="p-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 mt-8">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">査定依頼完了！</h2>

          {result.aiAssessment && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 mt-6 text-left">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> AI概算査定
              </h3>
              <div className="text-3xl font-bold text-blue-700 mb-2">
                ¥{result.aiAssessment.estimatedMin?.toLocaleString()} 〜 ¥{result.aiAssessment.estimatedMax?.toLocaleString()}
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>ブランド: {result.aiAssessment.brand}</p>
                <p>モデル: {result.aiAssessment.model}</p>
                <p>コンディション: {CONDITION_OPTIONS.find(c => c.value === result.aiAssessment.condition)?.label || result.aiAssessment.condition}</p>
                <p className="text-xs text-gray-400 mt-2">信頼度: {Math.round((result.aiAssessment.confidence || 0) * 100)}%</p>
              </div>
              {/* Authenticity & Market Trend */}
              {result.aiAssessment.authenticityNotes && (
                <div className="mt-3 pt-3 border-t border-blue-100">
                  <p className="text-xs text-gray-600 flex items-start gap-1">
                    <Shield className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                    <span>{result.aiAssessment.authenticityNotes}</span>
                  </p>
                </div>
              )}
              {result.aiAssessment.marketTrend && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600 flex items-start gap-1">
                    <TrendingUp className="w-3 h-3 mt-0.5 text-amber-500 flex-shrink-0" />
                    <span>{result.aiAssessment.marketTrend}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-amber-50 rounded-xl p-4 mt-4 text-sm text-amber-700 text-left">
            <Clock className="inline w-4 h-4 mr-1" />
            パートナーからの正式査定は通常24〜72時間以内にLINEで通知されます。
          </div>

          <button
            onClick={onBack}
            className="w-full mt-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
          >
            トップに戻る
          </button>
        </div>
      )}
    </div>
  );
}

// Skeleton for request detail
function RequestDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <Skeleton className="w-5 h-5" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="ml-auto h-5 w-16 rounded-full" />
      </div>
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="w-20 h-20 rounded-lg" />)}
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

function RequestDetail({ requestId, lineUserId }: { requestId: number; lineUserId: string }) {
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const detail = trpc.buyback.getRequestDetail.useQuery({ requestId, lineUserId });
  const acceptMutation = trpc.buyback.acceptAssessment.useMutation();
  const rejectMutation = trpc.buyback.rejectAssessment.useMutation();
  const cancelMutation = trpc.buyback.cancelRequest.useMutation();
  const shippingMutation = trpc.buyback.registerShipping.useMutation();
  const sendMessageMutation = trpc.buyback.sendMessage.useMutation();

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showChat, detail.data?.messages?.length]);

  if (detail.isLoading) {
    return <RequestDetailSkeleton />;
  }

  if (!detail.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">依頼が見つかりません</p>
      </div>
    );
  }

  const req = detail.data;

  const handleAccept = async (assessmentId: number) => {
    if (!confirm("この査定額を承認しますか？承認後は発送手続きに進みます。")) return;
    await acceptMutation.mutateAsync({ requestId, assessmentId, lineUserId });
    detail.refetch();
  };

  const handleReject = async (assessmentId: number) => {
    await rejectMutation.mutateAsync({ 
      requestId, 
      assessmentId, 
      lineUserId, 
      reason: rejectReason || undefined 
    });
    setRejectingId(null);
    setRejectReason("");
    detail.refetch();
  };

  const handleCancel = async () => {
    await cancelMutation.mutateAsync({ 
      requestId, 
      lineUserId, 
      reason: cancelReason || undefined 
    });
    setShowCancelDialog(false);
    setCancelReason("");
    detail.refetch();
  };

  const handleShipping = async () => {
    if (!trackingNumber || !carrier) return;
    await shippingMutation.mutateAsync({ requestId, lineUserId, trackingNumber, carrier });
    detail.refetch();
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    await sendMessageMutation.mutateAsync({ requestId, lineUserId, message: message.trim() });
    setMessage("");
    detail.refetch();
  };

  const canCancel = ['pending', 'ai_assessed', 'partner_assessed'].includes(req.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <a href="/buyback" className="p-1">
          <ArrowLeft className="w-5 h-5" />
        </a>
        <h1 className="font-bold">依頼 #{requestId}</h1>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full ${STATUS_LABELS[req.status]?.color || ""}`}>
          {STATUS_LABELS[req.status]?.label}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Images */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {req.imageUrls?.map((url: string, i: number) => (
            <img key={i} src={url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
          ))}
        </div>

        {/* AI Assessment */}
        {req.aiEstimatedMin && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-blue-500" /> AI概算査定
            </h3>
            <p className="text-xl font-bold text-blue-700">
              ¥{Number(req.aiEstimatedMin).toLocaleString()} 〜 ¥{Number(req.aiEstimatedMax).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">{req.aiBrand} / {req.aiModel}</p>
            {/* Show AI raw response details if available */}
            {req.aiRawResponse && (
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                {req.aiRawResponse.authenticityNotes && (
                  <p className="text-xs text-gray-600 flex items-start gap-1">
                    <Shield className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                    <span>{req.aiRawResponse.authenticityNotes}</span>
                  </p>
                )}
                {req.aiRawResponse.marketTrend && (
                  <p className="text-xs text-gray-600 flex items-start gap-1">
                    <TrendingUp className="w-3 h-3 mt-0.5 text-amber-500 flex-shrink-0" />
                    <span>{req.aiRawResponse.marketTrend}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Partner Assessments */}
        {req.assessments && req.assessments.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-sm text-gray-700 mb-3">パートナー査定</h3>
            <div className="space-y-3">
              {req.assessments.map((a: any) => (
                <div key={a.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{a.companyName}</p>
                      <p className="text-lg font-bold text-green-700">¥{Number(a.amount).toLocaleString()}</p>
                      {a.note && <p className="text-xs text-gray-500">{a.note}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      {a.status === "pending" && req.status === "partner_assessed" && (
                        <>
                          <button
                            onClick={() => handleAccept(a.id)}
                            className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg font-medium"
                          >
                            承認
                          </button>
                          <button
                            onClick={() => setRejectingId(a.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg font-medium border border-red-200"
                          >
                            拒否
                          </button>
                        </>
                      )}
                      {a.status === "accepted" && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">承認済み</span>
                      )}
                      {a.status === "rejected" && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">拒否済み</span>
                      )}
                    </div>
                  </div>
                  {/* Reject reason input */}
                  {rejectingId === a.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="拒否理由（任意）"
                        className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setRejectingId(null); setRejectReason(""); }}
                          className="flex-1 py-2 border rounded-lg text-sm"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={() => handleReject(a.id)}
                          className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium"
                        >
                          拒否する
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shipping Form */}
        {req.status === "accepted" && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-1">
              <Truck className="w-4 h-4" /> 発送情報を入力
            </h3>
            <input
              type="text"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="配送業者（例: ヤマト運輸）"
              className="w-full px-3 py-2 border rounded-lg mb-2 text-sm"
            />
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="追跡番号"
              className="w-full px-3 py-2 border rounded-lg mb-3 text-sm"
            />
            <button
              onClick={handleShipping}
              disabled={!trackingNumber || !carrier}
              className="w-full py-2 bg-indigo-500 text-white rounded-lg font-medium text-sm disabled:opacity-50"
            >
              発送完了を報告
            </button>
          </div>
        )}

        {/* Completion */}
        {req.status === "completed" && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4">
            <h3 className="font-bold text-green-800 mb-2 flex items-center gap-1">
              <Check className="w-4 h-4" /> 取引完了
            </h3>
            <p className="text-2xl font-bold text-green-700">¥{Number(req.finalAmount).toLocaleString()}</p>
            {req.pointsAwarded && (
              <p className="text-sm text-green-600 mt-1">
                <Coins className="inline w-3 h-3" /> ボーナスポイント: +{req.pointsAwarded}pt
              </p>
            )}
          </div>
        )}

        {/* Cancelled */}
        {req.status === "cancelled" && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Ban className="w-4 h-4" /> キャンセル済み
            </h3>
            {req.cancelReason && (
              <p className="text-sm text-gray-500">理由: {req.cancelReason}</p>
            )}
          </div>
        )}

        {/* Chat */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <button
            onClick={() => setShowChat(!showChat)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-bold text-sm text-gray-700">メッセージ ({req.messages?.length || 0})</h3>
            <ChevronRight className={`w-4 h-4 transition-transform ${showChat ? "rotate-90" : ""}`} />
          </button>

          {showChat && (
            <div className="mt-3">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {req.messages?.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">メッセージはまだありません</p>
                )}
                {req.messages?.map((msg: any) => (
                  <div key={msg.id} className={`text-sm p-2 rounded-lg ${
                    msg.senderType === "user" ? "bg-blue-50 ml-8" : "bg-gray-50 mr-8"
                  }`}>
                    <p className="text-xs text-gray-500 mb-0.5">{msg.senderName}</p>
                    <p>{msg.message}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="メッセージを入力"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <button 
                  onClick={handleSendMessage} 
                  disabled={!message.trim()}
                  className="p-2 bg-amber-500 text-white rounded-lg disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cancel Button */}
        {canCancel && (
          <div className="pt-2">
            <button
              onClick={() => setShowCancelDialog(true)}
              className="w-full py-3 border border-red-200 text-red-600 rounded-xl font-medium text-sm hover:bg-red-50 transition-colors"
            >
              <AlertTriangle className="inline w-4 h-4 mr-1 -mt-0.5" />
              この依頼をキャンセル
            </button>
          </div>
        )}

        {/* Cancel Dialog */}
        {showCancelDialog && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="font-bold text-lg mb-2">依頼をキャンセル</h3>
              <p className="text-sm text-gray-600 mb-4">
                この操作は取り消せません。本当にキャンセルしますか？
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="キャンセル理由（任意）"
                className="w-full px-3 py-2 border rounded-lg text-sm h-20 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCancelDialog(false); setCancelReason(""); }}
                  className="flex-1 py-2 border rounded-lg font-medium text-sm"
                >
                  戻る
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                  className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                >
                  {cancelMutation.isPending ? "処理中..." : "キャンセルする"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
