/**
 * BrandPortal - ブランド方向けポータルページ
 * トークン付きリンク（/brand/:token）でアクセス
 * ログイン不要で商品情報入力・ステータス確認・配信実績閲覧が可能
 */
import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Package, TrendingUp, BarChart3, Clock, CheckCircle2,
  AlertCircle, Send, Plus, ChevronDown, ChevronUp,
  Eye, ShoppingCart, Users, Zap, FileText, ArrowLeft,
  Loader2, X, Image as ImageIcon
} from "lucide-react";

const LCJ_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663045992616/GgA9WvTBCZMf6mjyMMwACw/lcj_logo_e21ead0b.jpg";

// ============================================================
// Status badge component
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: "下書き", color: "text-gray-600", bg: "bg-gray-100" },
    submitted: { label: "提出済み", color: "text-blue-600", bg: "bg-blue-100" },
    reviewing: { label: "審査中", color: "text-yellow-600", bg: "bg-yellow-100" },
    tuning: { label: "調整中", color: "text-orange-600", bg: "bg-orange-100" },
    simulating: { label: "シミュレーション中", color: "text-purple-600", bg: "bg-purple-100" },
    proposed: { label: "提案済み", color: "text-indigo-600", bg: "bg-indigo-100" },
    approved: { label: "承認済み", color: "text-green-600", bg: "bg-green-100" },
    live_ready: { label: "配信準備完了", color: "text-teal-600", bg: "bg-teal-100" },
    live_done: { label: "配信完了", color: "text-emerald-700", bg: "bg-emerald-100" },
    rejected: { label: "却下", color: "text-red-600", bg: "bg-red-100" },
  };
  const c = config[status] || { label: status, color: "text-gray-600", bg: "bg-gray-100" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.color} ${c.bg}`}>
      {c.label}
    </span>
  );
}

// ============================================================
// Product Form Component
// ============================================================
function ProductForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    productName: "",
    productCode: "",
    category: "",
    listPrice: "",
    livePrice: "",
    costPrice: "",
    commissionRate: "",
    productDescription: "",
    specifications: "",
    targetAudience: "",
    sellingPoint1: "",
    sellingPoint2: "",
    sellingPoint3: "",
    sellingPoint4: "",
    sellingPoint5: "",
    sellingPoint6: "",
    usageMethod: "",
    ingredients: "",
    shippingInfo: "",
    stockQuantity: "",
    salesMechanism: "",
    giftItems: "",
  });

  const submitProduct = trpc.brandPortal.submitProduct.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productName.trim()) {
      toast.error("製品名は必須です");
      return;
    }
    setSubmitting(true);
    try {
      await submitProduct.mutateAsync({
        token,
        productName: form.productName,
        productCode: form.productCode || undefined,
        category: form.category || undefined,
        listPrice: form.listPrice ? Number(form.listPrice) : undefined,
        livePrice: form.livePrice ? Number(form.livePrice) : undefined,
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        commissionRate: form.commissionRate || undefined,
        productDescription: form.productDescription || undefined,
        specifications: form.specifications || undefined,
        targetAudience: form.targetAudience || undefined,
        sellingPoint1: form.sellingPoint1 || undefined,
        sellingPoint2: form.sellingPoint2 || undefined,
        sellingPoint3: form.sellingPoint3 || undefined,
        sellingPoint4: form.sellingPoint4 || undefined,
        sellingPoint5: form.sellingPoint5 || undefined,
        sellingPoint6: form.sellingPoint6 || undefined,
        usageMethod: form.usageMethod || undefined,
        ingredients: form.ingredients || undefined,
        shippingInfo: form.shippingInfo || undefined,
        stockQuantity: form.stockQuantity ? Number(form.stockQuantity) : undefined,
        salesMechanism: form.salesMechanism || undefined,
        giftItems: form.giftItems || undefined,
      });
      toast.success("商品情報を送信しました");
      setForm({
        productName: "", productCode: "", category: "", listPrice: "", livePrice: "",
        costPrice: "", commissionRate: "", productDescription: "", specifications: "",
        targetAudience: "", sellingPoint1: "", sellingPoint2: "", sellingPoint3: "",
        sellingPoint4: "", sellingPoint5: "", sellingPoint6: "", usageMethod: "",
        ingredients: "", shippingInfo: "", stockQuantity: "", salesMechanism: "", giftItems: "",
      });
      setIsOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
      >
        <Plus className="w-10 h-10 mx-auto mb-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
        <p className="text-lg font-medium text-gray-600 group-hover:text-blue-600">新しい商品を登録する</p>
        <p className="text-sm text-gray-400 mt-1">商品情報を入力してLCJに送信します</p>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          商品情報入力フォーム（手卡）
        </h3>
        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* 基本情報 */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            基本情報
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">製品名 <span className="text-red-500">*</span></label>
              <Input value={form.productName} onChange={e => updateField("productName", e.target.value)} placeholder="例: KYOGOKU シグネチャーシャンプー" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">品番・SKU</label>
              <Input value={form.productCode} onChange={e => updateField("productCode", e.target.value)} placeholder="例: KYG-SH-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">カテゴリ</label>
              <Input value={form.category} onChange={e => updateField("category", e.target.value)} placeholder="例: ヘアケア" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ターゲット層</label>
              <Input value={form.targetAudience} onChange={e => updateField("targetAudience", e.target.value)} placeholder="例: 20〜40代女性" />
            </div>
          </div>
        </div>

        {/* 価格情報 */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            価格情報
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">通常価格（税込）</label>
              <Input type="text" inputMode="numeric" value={form.listPrice} onChange={e => updateField("listPrice", e.target.value.replace(/[^0-9]/g, ""))} placeholder="¥" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ライブ配信希望価格</label>
              <Input type="text" inputMode="numeric" value={form.livePrice} onChange={e => updateField("livePrice", e.target.value.replace(/[^0-9]/g, ""))} placeholder="¥" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">原価（仕入れ値）</label>
              <Input type="text" inputMode="numeric" value={form.costPrice} onChange={e => updateField("costPrice", e.target.value.replace(/[^0-9]/g, ""))} placeholder="¥" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ライセンス料配分率</label>
              <Input value={form.commissionRate} onChange={e => updateField("commissionRate", e.target.value)} placeholder="例: 15%" />
            </div>
          </div>
        </div>

        {/* 商品説明 */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-3">商品説明</h4>
          <Textarea value={form.productDescription} onChange={e => updateField("productDescription", e.target.value)} placeholder="商品の概要を記入してください" rows={3} />
        </div>

        {/* コアセールスポイント */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            コアセールスポイント（最大6項目）
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i}>
                <label className="block text-xs font-medium text-gray-500 mb-1">ポイント {i}</label>
                <Input
                  value={(form as any)[`sellingPoint${i}`]}
                  onChange={e => updateField(`sellingPoint${i}`, e.target.value)}
                  placeholder={`セールスポイント ${i}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 仕様・使用方法 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">仕様・スペック</label>
            <Textarea value={form.specifications} onChange={e => updateField("specifications", e.target.value)} placeholder="内容量、サイズ等" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">使用方法</label>
            <Textarea value={form.usageMethod} onChange={e => updateField("usageMethod", e.target.value)} placeholder="使い方の説明" rows={3} />
          </div>
        </div>

        {/* 成分・配送 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">成分・原材料</label>
            <Textarea value={form.ingredients} onChange={e => updateField("ingredients", e.target.value)} placeholder="主要成分等" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">発送情報</label>
            <Textarea value={form.shippingInfo} onChange={e => updateField("shippingInfo", e.target.value)} placeholder="発送方法、リードタイム等" rows={2} />
          </div>
        </div>

        {/* 販売メカニズム */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">販売メカニズム</label>
            <Textarea value={form.salesMechanism} onChange={e => updateField("salesMechanism", e.target.value)} placeholder="セット販売、限定数量等" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">贈品・おまけ</label>
            <Textarea value={form.giftItems} onChange={e => updateField("giftItems", e.target.value)} placeholder="おまけ・ノベルティ等" rows={2} />
          </div>
        </div>

        {/* 在庫 */}
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-600 mb-1">在庫数</label>
          <Input type="text" inputMode="numeric" value={form.stockQuantity} onChange={e => updateField("stockQuantity", e.target.value.replace(/[^0-9]/g, ""))} placeholder="在庫数" />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4 border-t">
          <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            {submitting ? "送信中..." : "商品情報を送信"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            キャンセル
          </Button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Product Card Component
// ============================================================
function ProductCard({ product }: { product: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{product.productName}</h3>
            {product.productCode && (
              <p className="text-sm text-gray-500 mt-0.5">SKU: {product.productCode}</p>
            )}
          </div>
          <StatusBadge status={product.status} />
        </div>

        {/* Price info */}
        <div className="flex flex-wrap gap-4 mb-3">
          {product.listPrice && (
            <div>
              <span className="text-xs text-gray-500">通常価格</span>
              <p className="font-semibold text-gray-700">¥{Number(product.listPrice).toLocaleString()}</p>
            </div>
          )}
          {product.livePrice && (
            <div>
              <span className="text-xs text-gray-500">ライブ希望価格</span>
              <p className="font-semibold text-blue-600">¥{Number(product.livePrice).toLocaleString()}</p>
            </div>
          )}
          {product.adjustedLivePrice && (
            <div>
              <span className="text-xs text-gray-500">調整後価格</span>
              <p className="font-semibold text-green-600">¥{Number(product.adjustedLivePrice).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? "閉じる" : "詳細を見る"}
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3 text-sm">
            {product.productDescription && (
              <div>
                <span className="font-medium text-gray-600">商品説明:</span>
                <p className="text-gray-700 mt-1">{product.productDescription}</p>
              </div>
            )}
            {product.targetAudience && (
              <div>
                <span className="font-medium text-gray-600">ターゲット層:</span>
                <p className="text-gray-700 mt-1">{product.targetAudience}</p>
              </div>
            )}
            {/* Selling points */}
            {[1, 2, 3, 4, 5, 6].map(i => {
              const sp = (product as any)[`sellingPoint${i}`];
              return sp ? (
                <div key={i}>
                  <span className="font-medium text-gray-600">セールスポイント {i}:</span>
                  <p className="text-gray-700 mt-1">{sp}</p>
                </div>
              ) : null;
            })}
            {product.tuningNotes && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <span className="font-medium text-yellow-700">LCJからのメモ:</span>
                <p className="text-yellow-800 mt-1">{product.tuningNotes}</p>
              </div>
            )}
            {product.rejectionReason && (
              <div className="bg-red-50 p-3 rounded-lg">
                <span className="font-medium text-red-700">却下理由:</span>
                <p className="text-red-800 mt-1">{product.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline bar */}
      <div className="bg-gray-50 px-5 py-2 flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        {product.submittedAt ? `提出: ${new Date(product.submittedAt).toLocaleDateString("ja-JP")}` : "未提出"}
        {product.approvedAt && ` → 承認: ${new Date(product.approvedAt).toLocaleDateString("ja-JP")}`}
      </div>
    </div>
  );
}

// ============================================================
// Performance Card Component
// ============================================================
function PerformanceCard({ perf }: { perf: any }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-gray-500">
            {new Date(perf.livestreamDate).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
          </p>
          {perf.streamerName && <p className="font-medium text-gray-800">{perf.streamerName}</p>}
        </div>
        {perf.platform && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{perf.platform}</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {perf.salesAmount != null && (
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600 mb-1">売上</p>
            <p className="text-lg font-bold text-blue-700">¥{Number(perf.salesAmount).toLocaleString()}</p>
          </div>
        )}
        {perf.gmv != null && (
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-600 mb-1">GMV</p>
            <p className="text-lg font-bold text-green-700">¥{Number(perf.gmv).toLocaleString()}</p>
          </div>
        )}
        {perf.salesCount != null && (
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-purple-600 mb-1">販売数</p>
            <p className="text-lg font-bold text-purple-700">{perf.salesCount}件</p>
          </div>
        )}
        {perf.viewerCount != null && (
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-xs text-orange-600 mb-1">視聴者数</p>
            <p className="text-lg font-bold text-orange-700">{Number(perf.viewerCount).toLocaleString()}</p>
          </div>
        )}
      </div>

      {perf.duration && (
        <p className="text-xs text-gray-500 mt-3">配信時間: {perf.duration}分</p>
      )}
      {perf.notes && (
        <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">{perf.notes}</p>
      )}
    </div>
  );
}

// ============================================================
// Main Brand Portal Page
// ============================================================
export default function BrandPortal() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";

  const { data, isLoading, error, refetch } = trpc.brandPortal.getByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const [activeTab, setActiveTab] = useState<"products" | "performance">("products");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">アクセスできません</h1>
          <p className="text-gray-600">
            {(error as any)?.message || "このリンクは無効か、有効期限が切れています。"}
          </p>
          <p className="text-sm text-gray-400 mt-4">
            お問い合わせ: info@livecommercejapan.com
          </p>
        </div>
      </div>
    );
  }

  const { portal, brand, products, performances } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LCJ_LOGO_URL} alt="LCJ" className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">
                {portal.portalName || brand?.name || "ブランドポータル"}
              </h1>
              <p className="text-xs text-gray-500">Live Commerce Japan パートナーポータル</p>
            </div>
          </div>
          {brand?.logoUrl && (
            <img src={brand.logoUrl} alt={brand.name} className="h-10 w-10 rounded-lg object-contain" />
          )}
        </div>
      </header>

      {/* Welcome message */}
      {portal.welcomeMessage && (
        <div className="max-w-5xl mx-auto px-4 mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm">
            {portal.welcomeMessage}
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center">
            <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            <p className="text-xs text-gray-500">登録商品</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center">
            <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {products.filter((p: any) => ["approved", "live_ready", "live_done"].includes(p.status)).length}
            </p>
            <p className="text-xs text-gray-500">承認済み</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center">
            <BarChart3 className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{performances.length}</p>
            <p className="text-xs text-gray-500">配信実績</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center">
            <TrendingUp className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              ¥{performances.reduce((sum: number, p: any) => sum + (Number(p.salesAmount) || 0), 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">累計売上</p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("products")}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === "products"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Package className="w-4 h-4 inline mr-1.5" />
            商品管理
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === "performance"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1.5" />
            配信実績
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 mt-6 pb-12">
        {activeTab === "products" && (
          <div className="space-y-6">
            {/* Product form */}
            <ProductForm token={token} onSuccess={() => refetch()} />

            {/* Product list */}
            {products.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-800">登録済み商品</h2>
                {products.map((product: any) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>まだ商品が登録されていません</p>
                <p className="text-sm mt-1">上のボタンから商品情報を入力してください</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "performance" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">配信実績</h2>
            {performances.length > 0 ? (
              performances.map((perf: any) => (
                <PerformanceCard key={perf.id} perf={perf} />
              ))
            ) : (
              <div className="text-center py-12 text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>まだ配信実績がありません</p>
                <p className="text-sm mt-1">配信完了後に自動的に表示されます</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Powered by <strong>Live Commerce Japan</strong></p>
          <p className="mt-1">お問い合わせ: info@livecommercejapan.com</p>
        </div>
      </footer>
    </div>
  );
}
