/**
 * BrandPortal - ブランド方向けポータルページ（完全リニューアル版）
 * 
 * トークン付きリンク（/brand/:token）でアクセス
 * ログイン不要で商品情報入力・ステータス確認・配信実績閲覧が可能
 * 
 * 主要機能:
 * - 5ステップウィザード形式の商品登録フォーム
 * - 日本語/中国語の多言語対応
 * - リアルタイム手卡プレビュー（Step 5）
 * - カテゴリ別テンプレート
 * - localStorage下書き自動保存
 * - 陈锦文フィードバック9項目反映済み
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Package, TrendingUp, BarChart3, Clock, CheckCircle2,
  AlertCircle, Send, Plus, ChevronDown, ChevronUp,
  Eye, Zap, FileText, ArrowLeft,
  Loader2, X, Image as ImageIcon, CreditCard,
  ChevronRight, Save, Trash2, Link as LinkIcon
} from "lucide-react";
import ProductCardTemplate, { ProductCardMini } from "@/components/ProductCard";
import {
  type Lang,
  t,
  productTemplates,
  type ProductTemplate,
} from "@/lib/brandPortalI18n";

const LCJ_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663045992616/GgA9WvTBCZMf6mjyMMwACw/lcj_logo_e21ead0b.jpg";

// ============================================================
// Types
// ============================================================
// 套餐（セット商品）対応: 複数商品のセールスポイントを管理
interface ProductItemData {
  productItemName: string;
  sellingPoints: string;
  usageMethod: string;
  ingredients: string;
}

interface ProductFormData {
  productName: string;
  category: string;
  targetAudience: string;
  brandOverview: string;
  specifications: string;
  costPrice: string;
  listPrice: string;
  livePrice: string;
  shippingInfo: string;
  commissionRate: string;
  giftItems: string;
  salesMechanism: string;
  stockQuantity: string;
  // 後方互換: 単一商品用（1商品の場合はこちらを使用）
  sellingPoints: string;
  usageMethod: string;
  ingredients: string;
  // 套餐（セット商品）用: 複数商品のセールスポイント
  productItems: ProductItemData[];
}

interface ProductLinkItem {
  title: string;
  url: string;
}

interface UploadedImage {
  url: string;
  key: string;
  name: string;
}

const emptyProductItem: ProductItemData = {
  productItemName: "",
  sellingPoints: "",
  usageMethod: "",
  ingredients: "",
};

const emptyForm: ProductFormData = {
  productName: "",
  category: "",
  targetAudience: "",
  brandOverview: "",
  specifications: "",
  costPrice: "",
  listPrice: "",
  livePrice: "",
  shippingInfo: "",
  commissionRate: "",
  giftItems: "",
  salesMechanism: "",
  stockQuantity: "",
  sellingPoints: "",
  usageMethod: "",
  ingredients: "",
  productItems: [],
};

// ============================================================
// Language Switcher
// ============================================================
function LanguageSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      <button
        onClick={() => setLang("ja")}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          lang === "ja" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        JP
      </button>
      <button
        onClick={() => setLang("zh")}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          lang === "zh" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        CN
      </button>
    </div>
  );
}

// ============================================================
// Status badge component
// ============================================================
function StatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const config: Record<string, { labelKey: string; color: string; bg: string }> = {
    draft: { labelKey: "draft", color: "text-gray-600", bg: "bg-gray-100" },
    submitted: { labelKey: "submitted", color: "text-blue-600", bg: "bg-blue-100" },
    reviewing: { labelKey: "reviewing", color: "text-yellow-600", bg: "bg-yellow-100" },
    tuning: { labelKey: "tuning", color: "text-orange-600", bg: "bg-orange-100" },
    simulating: { labelKey: "simulating", color: "text-purple-600", bg: "bg-purple-100" },
    proposed: { labelKey: "proposed", color: "text-indigo-600", bg: "bg-indigo-100" },
    approved: { labelKey: "approved", color: "text-green-600", bg: "bg-green-100" },
    live_ready: { labelKey: "liveReady", color: "text-teal-600", bg: "bg-teal-100" },
    live_done: { labelKey: "liveDone", color: "text-emerald-700", bg: "bg-emerald-100" },
    rejected: { labelKey: "rejected", color: "text-red-600", bg: "bg-red-100" },
  };
  const c = config[status] || { labelKey: status, color: "text-gray-600", bg: "bg-gray-100" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.color} ${c.bg}`}>
      {t("common", c.labelKey, lang)}
    </span>
  );
}

// ============================================================
// Progress Bar (5 steps)
// ============================================================
function StepProgressBar({ currentStep, lang }: { currentStep: number; lang: Lang }) {
  const stepKeys = ["step1", "step2", "step3", "step4", "step5"] as const;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {stepKeys.map((key, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          return (
            <div key={key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isActive
                      ? "bg-blue-600 text-white ring-4 ring-blue-100"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                </div>
                <span
                  className={`text-xs mt-1 whitespace-nowrap hidden sm:block ${
                    isActive ? "text-blue-600 font-medium" : isCompleted ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {t("steps", key, lang)}
                </span>
              </div>
              {idx < stepKeys.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    stepNum < currentStep ? "bg-green-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Template Selector
// ============================================================
function TemplateSelector({ lang, onSelect }: { lang: Lang; onSelect: (t: ProductTemplate | null) => void }) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t("templates", "selectTemplate", lang)}
      </label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          onClick={() => onSelect(null)}
          className="p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-all"
        >
          {t("templates", "noTemplate", lang)}
        </button>
        {productTemplates.map((tmpl) => (
          <button
            key={tmpl.id}
            onClick={() => onSelect(tmpl)}
            className="p-3 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
          >
            <span className="font-medium">{tmpl.name[lang]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Image Uploader Component
// ============================================================
function ImageUploader({
  images, setImages, maxImages, token, label, guide, uploading, setUploading,
}: {
  images: UploadedImage[];
  setImages: (imgs: UploadedImage[]) => void;
  maxImages: number;
  token: string;
  label: string;
  guide: string;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const uploadMutation = trpc.brandPortal.uploadProductImage.useMutation();
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = maxImages - images.length;
    const toUpload = files.slice(0, remaining);
    setUploading(true);
    try {
      const results: UploadedImage[] = [];
      for (const file of toUpload) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await uploadMutation.mutateAsync({
          token, fileName: file.name, contentType: file.type, base64Data: base64,
        });
        results.push({ url: result.url, key: result.key, name: file.name });
      }
      setImages([...images, ...results]);
      toast.success(`${results.length}枚の画像をアップロードしました`);
    } catch (err: any) {
      toast.error(err?.message || "画像のアップロードに失敗しました");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };
  return (
    <div>
      <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
        <ImageIcon className="w-4 h-4" />{label}
      </h4>
      <div className="flex flex-wrap gap-3">
        {images.map((img, idx) => (
          <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 group">
            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
            <button type="button" onClick={() => setImages(images.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {images.length < maxImages && (
          <label className={`w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            {uploading ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : (
              <><Plus className="w-6 h-6 text-gray-400" /><span className="text-xs text-gray-400 mt-1">+</span></>
            )}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2">{guide}</p>
    </div>
  );
}

// ============================================================
// Step 1: 基本情報
// ============================================================
function Step1BasicInfo({ form, updateField, lang }: { form: ProductFormData; updateField: (f: keyof ProductFormData, v: string) => void; lang: Lang }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          {t("step1", "productName", lang)} <span className="text-red-500">*</span>
        </label>
        <Input value={form.productName} onChange={e => updateField("productName", e.target.value)} placeholder={t("step1", "productNamePlaceholder", lang)} className="text-base" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("step1", "category", lang)}</label>
          <Input value={form.category} onChange={e => updateField("category", e.target.value)} placeholder={t("step1", "categoryPlaceholder", lang)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("step1", "targetAudience", lang)}</label>
          <Input value={form.targetAudience} onChange={e => updateField("targetAudience", e.target.value)} placeholder={t("step1", "targetAudiencePlaceholder", lang)} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">{t("step1", "brandOverview", lang)}</label>
        <Textarea value={form.brandOverview} onChange={e => updateField("brandOverview", e.target.value)} placeholder={t("step1", "brandOverviewPlaceholder", lang)} rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">{t("step1", "specifications", lang)}</label>
        <Textarea value={form.specifications} onChange={e => updateField("specifications", e.target.value)} placeholder={t("step1", "specificationsPlaceholder", lang)} rows={2} />
      </div>
    </div>
  );
}

// ============================================================
// Step 2: 価格・条件（原価→通常価格→ライブ価格→配送→ライセンス料→贈品 の順序）
// ============================================================
function Step2Pricing({ form, updateField, lang }: { form: ProductFormData; updateField: (f: keyof ProductFormData, v: string) => void; lang: Lang }) {
  const nc = (field: keyof ProductFormData) => (e: React.ChangeEvent<HTMLInputElement>) => updateField(field, e.target.value.replace(/[^0-9]/g, ""));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("step2", "costPrice", lang)}</label>
          <Input type="text" inputMode="numeric" value={form.costPrice} onChange={nc("costPrice")} placeholder="¥" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("step2", "listPrice", lang)}</label>
          <Input type="text" inputMode="numeric" value={form.listPrice} onChange={nc("listPrice")} placeholder="¥" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("step2", "livePrice", lang)}</label>
          <Input type="text" inputMode="numeric" value={form.livePrice} onChange={nc("livePrice")} placeholder="¥" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">{t("step2", "shippingInfo", lang)}</label>
        <p className="text-xs text-gray-400 mb-2 whitespace-pre-line">{t("step2", "shippingInfoGuide", lang)}</p>
        <Textarea value={form.shippingInfo} onChange={e => updateField("shippingInfo", e.target.value)} placeholder={t("step2", "shippingInfoPlaceholder", lang)} rows={3} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("step2", "commissionRate", lang)}</label>
          <Input value={form.commissionRate} onChange={e => updateField("commissionRate", e.target.value)} placeholder={t("step2", "commissionRatePlaceholder", lang)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("step2", "giftItems", lang)}</label>
          <Input value={form.giftItems} onChange={e => updateField("giftItems", e.target.value)} placeholder={t("step2", "giftItemsPlaceholder", lang)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("step2", "salesMechanism", lang)}</label>
          <Textarea value={form.salesMechanism} onChange={e => updateField("salesMechanism", e.target.value)} placeholder={t("step2", "salesMechanismPlaceholder", lang)} rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{t("step2", "stockQuantity", lang)}</label>
          <Input type="text" inputMode="numeric" value={form.stockQuantity} onChange={nc("stockQuantity")} placeholder={t("step2", "stockQuantityPlaceholder", lang)} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step 3: セールスポイント（套餐＝セット商品対応 — 複数商品入力可能）
// ============================================================
function Step3SellingPoints({ form, updateField, lang, productItems, setProductItems }: {
  form: ProductFormData;
  updateField: (f: keyof ProductFormData, v: string) => void;
  lang: Lang;
  productItems: ProductItemData[];
  setProductItems: (items: ProductItemData[]) => void;
}) {
  const updateItem = (index: number, field: keyof ProductItemData, value: string) => {
    const updated = [...productItems];
    updated[index] = { ...updated[index], [field]: value };
    setProductItems(updated);
  };
  const addItem = () => {
    setProductItems([...productItems, { ...emptyProductItem }]);
  };
  const removeItem = (index: number) => {
    setProductItems(productItems.filter((_, i) => i !== index));
  };

  // 套餐モード（複数商品がある場合）
  const isSetMode = productItems.length > 0;

  return (
    <div className="space-y-5">
      {/* 単一商品モード（デフォルト） */}
      {!isSetMode && (
        <>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4" />{t("step3", "sellingPoints", lang)}
            </label>
            <Textarea value={form.sellingPoints} onChange={e => updateField("sellingPoints", e.target.value)} placeholder={t("step3", "sellingPointsPlaceholder", lang)} rows={8} className="text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("step3", "usageMethod", lang)}</label>
              <Textarea value={form.usageMethod} onChange={e => updateField("usageMethod", e.target.value)} placeholder={t("step3", "usageMethodPlaceholder", lang)} rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("step3", "ingredients", lang)}</label>
              <Textarea value={form.ingredients} onChange={e => updateField("ingredients", e.target.value)} placeholder={t("step3", "ingredientsPlaceholder", lang)} rows={3} />
            </div>
          </div>
        </>
      )}

      {/* 套餐モード（複数商品） */}
      {isSetMode && (
        <div className="space-y-4">
          {productItems.map((item, idx) => (
            <div key={idx} className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-blue-700 text-sm flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t("step3", "productNumber", lang)} {idx + 1}
                </h4>
                <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" />{t("step3", "removeProduct", lang)}
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {lang === "ja" ? "商品名" : "商品名称"} <span className="text-red-500">*</span>
                </label>
                <Input value={item.productItemName} onChange={e => updateItem(idx, "productItemName", e.target.value)}
                  placeholder={lang === "ja" ? "例: シャンプー 300ml" : "例: 洗发水 300ml"} className="text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3" />{t("step3", "sellingPoints", lang)}
                </label>
                <Textarea value={item.sellingPoints} onChange={e => updateItem(idx, "sellingPoints", e.target.value)}
                  placeholder={t("step3", "sellingPointsPlaceholder", lang)} rows={5} className="text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("step3", "usageMethod", lang)}</label>
                  <Textarea value={item.usageMethod} onChange={e => updateItem(idx, "usageMethod", e.target.value)}
                    placeholder={t("step3", "usageMethodPlaceholder", lang)} rows={2} className="text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("step3", "ingredients", lang)}</label>
                  <Textarea value={item.ingredients} onChange={e => updateItem(idx, "ingredients", e.target.value)}
                    placeholder={t("step3", "ingredientsPlaceholder", lang)} rows={2} className="text-sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 商品追加ボタン */}
      <button type="button" onClick={() => {
        if (!isSetMode) {
          // 単一→套餐モードに切り替え: 既存入力を最初の商品に移行
          const firstItem: ProductItemData = {
            productItemName: form.productName || "",
            sellingPoints: form.sellingPoints,
            usageMethod: form.usageMethod,
            ingredients: form.ingredients,
          };
          setProductItems([firstItem, { ...emptyProductItem }]);
          // 単一商品フィールドをクリア
          updateField("sellingPoints", "");
          updateField("usageMethod", "");
          updateField("ingredients", "");
        } else {
          addItem();
        }
      }}
        className="w-full border-2 border-dashed border-blue-300 rounded-xl p-3 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all group">
        <Plus className="w-5 h-5 mx-auto mb-1 text-blue-400 group-hover:text-blue-600 transition-colors" />
        <p className="text-sm font-medium text-blue-500 group-hover:text-blue-700">{t("step3", "addProduct", lang)}</p>
        <p className="text-xs text-gray-400 mt-0.5">{lang === "ja" ? "套餐（セット商品）の場合はこちらから追加" : "套餐（套装商品）请从这里添加"}</p>
      </button>
    </div>
  );
}

// ============================================================
// Step 4: 画像・資料
// ============================================================
function Step4Images({
  productImages, setProductImages, backupImages, setBackupImages,
  productLinks, setProductLinks, token, lang,
}: {
  productImages: UploadedImage[]; setProductImages: (i: UploadedImage[]) => void;
  backupImages: UploadedImage[]; setBackupImages: (i: UploadedImage[]) => void;
  productLinks: ProductLinkItem[]; setProductLinks: (l: ProductLinkItem[]) => void;
  token: string; lang: Lang;
}) {
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setProductLinks([...productLinks, { title: newLinkTitle.trim() || "Link", url: newLinkUrl.trim() }]);
    setNewLinkTitle(""); setNewLinkUrl("");
  };
  return (
    <div className="space-y-6">
      <ImageUploader images={productImages} setImages={setProductImages} maxImages={5} token={token}
        label={t("step4", "productImages", lang)} guide={t("step4", "productImagesGuide", lang)}
        uploading={uploadingProduct} setUploading={setUploadingProduct} />
      <ImageUploader images={backupImages} setImages={setBackupImages} maxImages={10} token={token}
        label={t("step4", "brandBackupImages", lang)} guide={t("step4", "brandBackupImagesGuide", lang)}
        uploading={uploadingBackup} setUploading={setUploadingBackup} />
      <div>
        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <LinkIcon className="w-4 h-4" />{t("step4", "productLinks", lang)}
        </h4>
        <p className="text-xs text-gray-400 mb-3">{t("step4", "productLinksGuide", lang)}</p>
        {productLinks.length > 0 && (
          <div className="space-y-2 mb-3">
            {productLinks.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <LinkIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{link.title}</p>
                  <p className="text-xs text-blue-500 truncate">{link.url}</p>
                </div>
                <button type="button" onClick={() => setProductLinks(productLinks.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} placeholder={t("step4", "linkTitlePlaceholder", lang)} className="w-32" />
          <Input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder={t("step4", "linkUrlPlaceholder", lang)} className="flex-1"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} />
          <Button type="button" variant="outline" size="sm" onClick={addLink}>
            <Plus className="w-4 h-4 mr-1" />{t("step4", "add", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step 5: 確認・プレビュー
// ============================================================
function Step5Confirm({
  form, productImages, backupImages, productLinks, brand, lang, goToStep, productItems,
}: {
  form: ProductFormData; productImages: UploadedImage[]; backupImages: UploadedImage[];
  productLinks: ProductLinkItem[]; brand: any; lang: Lang; goToStep: (s: number) => void;
  productItems: ProductItemData[];
}) {
  // 套餐モードの場合、統合セールスポイントを生成
  const mergedSellingPoints = useMemo(() => {
    if (productItems.length > 0) {
      return productItems.map((item, idx) => {
        const header = `【${item.productItemName || `商品${idx + 1}`}】`;
        return `${header}\n${item.sellingPoints}`;
      }).join("\n\n");
    }
    return form.sellingPoints;
  }, [form.sellingPoints, productItems]);

  const mergedUsageMethod = useMemo(() => {
    if (productItems.length > 0) {
      return productItems.map((item, idx) => {
        if (!item.usageMethod) return "";
        return `【${item.productItemName || `商品${idx + 1}`}】\n${item.usageMethod}`;
      }).filter(Boolean).join("\n\n");
    }
    return form.usageMethod;
  }, [form.usageMethod, productItems]);

  const mergedIngredients = useMemo(() => {
    if (productItems.length > 0) {
      return productItems.map((item, idx) => {
        if (!item.ingredients) return "";
        return `【${item.productItemName || `商品${idx + 1}`}】\n${item.ingredients}`;
      }).filter(Boolean).join("\n\n");
    }
    return form.ingredients;
  }, [form.ingredients, productItems]);

  const previewProduct = useMemo(() => {
    const points = mergedSellingPoints.split("\n").map(s => s.replace(/^[・\-\*\d.]+\s*/, "").trim()).filter(Boolean);
    return {
      productName: form.productName || (lang === "ja" ? "（未入力）" : "（未输入）"),
      category: form.category || undefined,
      listPrice: form.listPrice ? Number(form.listPrice) : undefined,
      livePrice: form.livePrice ? Number(form.livePrice) : undefined,
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      commissionRate: form.commissionRate || undefined,
      productDescription: form.brandOverview || undefined,
      specifications: form.specifications || undefined,
      targetAudience: form.targetAudience || undefined,
      sellingPoint1: points[0] || undefined, sellingPoint2: points[1] || undefined,
      sellingPoint3: points[2] || undefined, sellingPoint4: points[3] || undefined,
      sellingPoint5: points[4] || undefined, sellingPoint6: points[5] || undefined,
      usageMethod: mergedUsageMethod || undefined,
      ingredients: mergedIngredients || undefined,
      shippingInfo: form.shippingInfo || undefined,
      salesMechanism: form.salesMechanism || undefined,
      giftItems: form.giftItems || undefined,
      imageUrls: productImages.map(img => img.url),
    };
  }, [form, productImages, lang, mergedSellingPoints, mergedUsageMethod, mergedIngredients]);

  // Step3のセクション表示を套餐モード対応
  const step3Items = useMemo(() => {
    if (productItems.length > 0) {
      // 套餐モード: 各商品を個別表示
      const items: { label: string; value: string }[] = [];
      productItems.forEach((item, idx) => {
        const name = item.productItemName || `${t("step3", "productNumber", lang)} ${idx + 1}`;
        if (item.sellingPoints) items.push({ label: `${name} - ${t("step3", "sellingPoints", lang)}`, value: item.sellingPoints });
        if (item.usageMethod) items.push({ label: `${name} - ${t("step3", "usageMethod", lang)}`, value: item.usageMethod });
        if (item.ingredients) items.push({ label: `${name} - ${t("step3", "ingredients", lang)}`, value: item.ingredients });
      });
      return items;
    }
    return [
      { label: t("step3", "sellingPoints", lang), value: form.sellingPoints },
      { label: t("step3", "usageMethod", lang), value: form.usageMethod },
      { label: t("step3", "ingredients", lang), value: form.ingredients },
    ];
  }, [form, productItems, lang]);

  const sections = [
    { step: 1, title: t("steps", "step1", lang), items: [
      { label: t("step1", "productName", lang), value: form.productName },
      { label: t("step1", "category", lang), value: form.category },
      { label: t("step1", "targetAudience", lang), value: form.targetAudience },
      { label: t("step1", "brandOverview", lang), value: form.brandOverview },
      { label: t("step1", "specifications", lang), value: form.specifications },
    ]},
    { step: 2, title: t("steps", "step2", lang), items: [
      { label: t("step2", "costPrice", lang), value: form.costPrice ? `¥${Number(form.costPrice).toLocaleString()}` : "" },
      { label: t("step2", "listPrice", lang), value: form.listPrice ? `¥${Number(form.listPrice).toLocaleString()}` : "" },
      { label: t("step2", "livePrice", lang), value: form.livePrice ? `¥${Number(form.livePrice).toLocaleString()}` : "" },
      { label: t("step2", "shippingInfo", lang), value: form.shippingInfo },
      { label: t("step2", "commissionRate", lang), value: form.commissionRate },
      { label: t("step2", "giftItems", lang), value: form.giftItems },
    ]},
    { step: 3, title: t("steps", "step3", lang) + (productItems.length > 0 ? ` (${productItems.length}${lang === "ja" ? "商品" : "商品"})` : ""), items: step3Items },
  ];

  return (
    <div className="space-y-6">
      {sections.map(section => (
        <div key={section.step} className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-gray-700 text-sm">{section.title}</h4>
            <button type="button" onClick={() => goToStep(section.step)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
              {t("step5", "editStep", lang)}<ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {section.items.map((item, idx) => item.value ? (
              <div key={idx} className="flex gap-2 text-sm">
                <span className="text-gray-500 min-w-[100px] flex-shrink-0">{item.label}:</span>
                <span className="text-gray-800 whitespace-pre-line">{item.value}</span>
              </div>
            ) : null)}
          </div>
        </div>
      ))}

      {/* Images summary */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-gray-700 text-sm">{t("steps", "step4", lang)}</h4>
          <button type="button" onClick={() => goToStep(4)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            {t("step5", "editStep", lang)}<ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {productImages.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">{t("step4", "productImages", lang)}</p>
            <div className="flex flex-wrap gap-2">
              {productImages.map((img, idx) => <img key={idx} src={img.url} alt={img.name} className="w-16 h-16 rounded-lg object-cover border" />)}
            </div>
          </div>
        )}
        {backupImages.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">{t("step4", "brandBackupImages", lang)}</p>
            <div className="flex flex-wrap gap-2">
              {backupImages.map((img, idx) => <img key={idx} src={img.url} alt={img.name} className="w-16 h-16 rounded-lg object-cover border" />)}
            </div>
          </div>
        )}
        {productLinks.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">{t("step4", "productLinks", lang)}</p>
            {productLinks.map((link, idx) => <p key={idx} className="text-sm text-blue-600">{link.title}: {link.url}</p>)}
          </div>
        )}
      </div>

      {/* 手卡プレビュー */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4" />{t("step5", "preview", lang)}
        </h4>
        <p className="text-xs text-gray-400 mb-4">{t("step5", "previewGuide", lang)}</p>
        <div className="overflow-x-auto">
          <ProductCardTemplate product={previewProduct} brand={brand} showDownload={false} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Existing Product Card Component
// ============================================================
function ExistingProductCard({ product, lang }: { product: any; lang: Lang }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{product.productName}</h3>
            {product.productCode && <p className="text-sm text-gray-500 mt-0.5">SKU: {product.productCode}</p>}
          </div>
          <StatusBadge status={product.status} lang={lang} />
        </div>
        <div className="flex flex-wrap gap-4 mb-3">
          {product.listPrice && (
            <div><span className="text-xs text-gray-500">{t("step2", "listPrice", lang)}</span>
              <p className="font-semibold text-gray-700">¥{Number(product.listPrice).toLocaleString()}</p></div>
          )}
          {product.livePrice && (
            <div><span className="text-xs text-gray-500">{t("step2", "livePrice", lang)}</span>
              <p className="font-semibold text-blue-600">¥{Number(product.livePrice).toLocaleString()}</p></div>
          )}
          {product.adjustedLivePrice && (
            <div><span className="text-xs text-gray-500">調整後価格</span>
              <p className="font-semibold text-green-600">¥{Number(product.adjustedLivePrice).toLocaleString()}</p></div>
          )}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? t("productList", "collapse", lang) : t("productList", "details", lang)}
        </button>
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3 text-sm">
            {product.productDescription && (
              <div><span className="font-medium text-gray-600">{t("step1", "brandOverview", lang)}:</span>
                <p className="text-gray-700 mt-1">{product.productDescription}</p></div>
            )}
            {product.targetAudience && (
              <div><span className="font-medium text-gray-600">{t("step1", "targetAudience", lang)}:</span>
                <p className="text-gray-700 mt-1">{product.targetAudience}</p></div>
            )}
            {[1,2,3,4,5,6].map(i => {
              const sp = (product as any)[`sellingPoint${i}`];
              return sp ? <div key={i}><span className="font-medium text-gray-600">{t("step3", "sellingPoints", lang)} {i}:</span><p className="text-gray-700 mt-1">{sp}</p></div> : null;
            })}
            {product.tuningNotes && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <span className="font-medium text-yellow-700">{t("productList", "lcjNote", lang)}:</span>
                <p className="text-yellow-800 mt-1">{product.tuningNotes}</p>
              </div>
            )}
            {product.rejectionReason && (
              <div className="bg-red-50 p-3 rounded-lg">
                <span className="font-medium text-red-700">{t("productList", "rejectionReason", lang)}:</span>
                <p className="text-red-800 mt-1">{product.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="bg-gray-50 px-5 py-2 flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        {product.submittedAt ? `${t("productList", "submittedAt", lang)}: ${new Date(product.submittedAt).toLocaleDateString("ja-JP")}` : ""}
        {product.approvedAt && ` → ${t("productList", "approvedAt", lang)}: ${new Date(product.approvedAt).toLocaleDateString("ja-JP")}`}
      </div>
    </div>
  );
}

// ============================================================
// Performance Card Component
// ============================================================
function PerformanceCard({ perf, lang }: { perf: any; lang: Lang }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-gray-500">{new Date(perf.livestreamDate).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</p>
          {perf.streamerName && <p className="font-medium text-gray-800">{perf.streamerName}</p>}
        </div>
        {perf.platform && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{perf.platform}</span>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {perf.salesAmount != null && (
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600 mb-1">{t("performance", "sales", lang)}</p>
            <p className="text-lg font-bold text-blue-700">¥{Number(perf.salesAmount).toLocaleString()}</p>
          </div>
        )}
        {perf.gmv != null && (
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-600 mb-1">{t("performance", "gmv", lang)}</p>
            <p className="text-lg font-bold text-green-700">¥{Number(perf.gmv).toLocaleString()}</p>
          </div>
        )}
        {perf.salesCount != null && (
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-purple-600 mb-1">{t("performance", "salesCount", lang)}</p>
            <p className="text-lg font-bold text-purple-700">{perf.salesCount}{lang === "ja" ? "件" : "件"}</p>
          </div>
        )}
        {perf.viewerCount != null && (
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-xs text-orange-600 mb-1">{t("performance", "viewerCount", lang)}</p>
            <p className="text-lg font-bold text-orange-700">{Number(perf.viewerCount).toLocaleString()}</p>
          </div>
        )}
      </div>
      {perf.duration && <p className="text-xs text-gray-500 mt-3">{t("performance", "duration", lang)}: {perf.duration}{lang === "ja" ? "分" : "分钟"}</p>}
      {perf.notes && <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">{perf.notes}</p>}
    </div>
  );
}

// ============================================================
// Wizard Form Component (5-step)
// ============================================================
function WizardProductForm({ token, brand, lang, onSuccess }: { token: string; brand: any; lang: Lang; onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ProductFormData>({ ...emptyForm });
  const [productImages, setProductImages] = useState<UploadedImage[]>([]);
  const [backupImages, setBackupImages] = useState<UploadedImage[]>([]);
  const [productLinks, setProductLinks] = useState<ProductLinkItem[]>([]);
  const [productItems, setProductItems] = useState<ProductItemData[]>([]);
  const [templateSelected, setTemplateSelected] = useState(false);
  const submitProduct = trpc.brandPortal.submitProduct.useMutation();
  const draftKey = `brand_portal_draft_${token}`;

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) setForm(parsed.form);
        if (parsed.productImages) setProductImages(parsed.productImages);
        if (parsed.backupImages) setBackupImages(parsed.backupImages);
        if (parsed.productLinks) setProductLinks(parsed.productLinks);
        if (parsed.productItems) setProductItems(parsed.productItems);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        setTemplateSelected(true);
        setIsOpen(true);
      }
    } catch {}
  }, [draftKey]);

  // Auto-save draft to localStorage (debounced)
  useEffect(() => {
    if (!isOpen || !templateSelected) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ form, productImages, backupImages, productLinks, productItems, currentStep }));
      } catch {}
    }, 1500);
    return () => clearTimeout(timer);
  }, [form, productImages, backupImages, productLinks, productItems, currentStep, isOpen, templateSelected, draftKey]);

  const updateField = useCallback((field: keyof ProductFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleTemplateSelect = (template: ProductTemplate | null) => {
    if (template) {
      setForm(prev => ({
        ...prev,
        category: template.defaults.category || prev.category,
        targetAudience: template.defaults.targetAudience || prev.targetAudience,
        sellingPoints: template.defaults.sellingPoints || prev.sellingPoints,
        shippingInfo: template.defaults.shippingInfo || prev.shippingInfo,
      }));
    }
    setTemplateSelected(true);
  };

  const goToStep = (step: number) => setCurrentStep(step);
  const nextStep = () => {
    if (currentStep === 1 && !form.productName.trim()) {
      toast.error(t("step5", "productNameRequired", lang));
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 5));
  };
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!form.productName.trim()) { toast.error(t("step5", "productNameRequired", lang)); return; }
    setSubmitting(true);
    try {
      // 套餐モード: 複数商品のセールスポイントを統合
      let finalSellingPoints: string;
      let finalUsageMethod: string;
      let finalIngredients: string;
      if (productItems.length > 0) {
        // 套餐モード: 各商品のセールスポイントを「商品名: ポイント」形式で統合
        finalSellingPoints = productItems.map((item, idx) => {
          const header = `【${item.productItemName || `商品${idx + 1}`}】`;
          return `${header}\n${item.sellingPoints}`;
        }).join("\n\n");
        finalUsageMethod = productItems.map((item, idx) => {
          if (!item.usageMethod) return "";
          return `【${item.productItemName || `商品${idx + 1}`}】\n${item.usageMethod}`;
        }).filter(Boolean).join("\n\n");
        finalIngredients = productItems.map((item, idx) => {
          if (!item.ingredients) return "";
          return `【${item.productItemName || `商品${idx + 1}`}】\n${item.ingredients}`;
        }).filter(Boolean).join("\n\n");
      } else {
        finalSellingPoints = form.sellingPoints;
        finalUsageMethod = form.usageMethod;
        finalIngredients = form.ingredients;
      }
      const points = finalSellingPoints.split("\n").map(s => s.replace(/^[・\-\*\d.]+\s*/, "").trim()).filter(Boolean);
      await submitProduct.mutateAsync({
        token,
        productName: form.productName,
        productCode: undefined,
        category: form.category || undefined,
        listPrice: form.listPrice ? Number(form.listPrice) : undefined,
        livePrice: form.livePrice ? Number(form.livePrice) : undefined,
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        commissionRate: form.commissionRate || undefined,
        productDescription: form.brandOverview || undefined,
        specifications: form.specifications || undefined,
        targetAudience: form.targetAudience || undefined,
        sellingPoint1: points[0] || undefined, sellingPoint2: points[1] || undefined,
        sellingPoint3: points[2] || undefined, sellingPoint4: points[3] || undefined,
        sellingPoint5: points[4] || undefined, sellingPoint6: points[5] || undefined,
        usageMethod: finalUsageMethod || undefined,
        ingredients: finalIngredients || undefined,
        shippingInfo: form.shippingInfo || undefined,
        stockQuantity: form.stockQuantity ? Number(form.stockQuantity) : undefined,
        imageUrls: productImages.length > 0 ? productImages.map(img => img.url) : undefined,
        imageKeys: productImages.length > 0 ? productImages.map(img => img.key) : undefined,
        salesMechanism: form.salesMechanism || undefined,
        giftItems: form.giftItems || undefined,
      });
      toast.success(t("step5", "submitSuccess", lang));
      localStorage.removeItem(draftKey);
      setForm({ ...emptyForm }); setProductImages([]); setBackupImages([]); setProductLinks([]); setProductItems([]);
      setCurrentStep(1); setTemplateSelected(false); setIsOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || t("step5", "submitError", lang));
    } finally {
      setSubmitting(false);
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(draftKey);
    setForm({ ...emptyForm }); setProductImages([]); setBackupImages([]); setProductLinks([]); setProductItems([]);
    setCurrentStep(1); setTemplateSelected(false);
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
        <Plus className="w-10 h-10 mx-auto mb-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
        <p className="text-lg font-medium text-gray-600 group-hover:text-blue-600">{t("form", "newProduct", lang)}</p>
        <p className="text-sm text-gray-400 mt-1">{t("form", "newProductDesc", lang)}</p>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />{t("form", "formTitle", lang)}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={clearDraft} className="text-white/60 hover:text-white text-xs flex items-center gap-1" title="Clear draft">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-6">
        {!templateSelected ? (
          <TemplateSelector lang={lang} onSelect={handleTemplateSelect} />
        ) : (
          <>
            <div className="mb-6"><StepProgressBar currentStep={currentStep} lang={lang} /></div>
            <div className="min-h-[300px]">
              {currentStep === 1 && <Step1BasicInfo form={form} updateField={updateField} lang={lang} />}
              {currentStep === 2 && <Step2Pricing form={form} updateField={updateField} lang={lang} />}
              {currentStep === 3 && <Step3SellingPoints form={form} updateField={updateField} lang={lang} productItems={productItems} setProductItems={setProductItems} />}
              {currentStep === 4 && <Step4Images productImages={productImages} setProductImages={setProductImages}
                backupImages={backupImages} setBackupImages={setBackupImages}
                productLinks={productLinks} setProductLinks={setProductLinks} token={token} lang={lang} />}
              {currentStep === 5 && <Step5Confirm form={form} productImages={productImages} backupImages={backupImages}
                productLinks={productLinks} brand={brand} lang={lang} goToStep={goToStep} productItems={productItems} />}
            </div>
            <div className="flex items-center justify-between pt-6 border-t mt-6">
              <div>
                {currentStep > 1 && (
                  <Button type="button" variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />{t("common", "prev", lang)}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1 hidden sm:flex">
                  <Save className="w-3 h-3" />{t("common", "draftAutoSaved", lang)}
                </span>
                {currentStep < 5 ? (
                  <Button onClick={nextStep} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {t("common", "next", lang)}<ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white px-8">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    {submitting ? t("common", "submitting", lang) : t("step5", "confirmAndSubmit", lang)}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Brand Portal Page
// ============================================================
export default function BrandPortal() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("brand_portal_lang") as Lang) || "ja"; } catch { return "ja"; }
  });
  useEffect(() => { try { localStorage.setItem("brand_portal_lang", lang); } catch {} }, [lang]);

  const { data, isLoading, error, refetch } = trpc.brandPortal.getByToken.useQuery(
    { token }, { enabled: !!token, retry: false }
  );
  const [activeTab, setActiveTab] = useState<"products" | "performance" | "cards">("products");
  const [selectedCardProduct, setSelectedCardProduct] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t("common", "loading", lang)}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t("common", "accessDenied", lang)}</h1>
          <p className="text-gray-600">{(error as any)?.message || t("common", "invalidLink", lang)}</p>
          <p className="text-sm text-gray-400 mt-4">{t("common", "contact", lang)}</p>
        </div>
      </div>
    );
  }

  const { portal, brand, products: portalProducts, brandProducts: existingProducts, performances } = data;
  const products = [...(existingProducts || []), ...portalProducts];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LCJ_LOGO_URL} alt="LCJ" className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">
                {portal.portalName || brand?.name || t("common", "brandPortal", lang)}
              </h1>
              <p className="text-xs text-gray-500">{t("common", "partnerPortal", lang)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher lang={lang} setLang={setLang} />
            {brand?.logoUrl && <img src={brand.logoUrl} alt={brand.name} className="h-10 w-10 rounded-lg object-contain" />}
          </div>
        </div>
      </header>

      {/* Welcome message */}
      {portal.welcomeMessage && (
        <div className="max-w-5xl mx-auto px-4 mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm">{portal.welcomeMessage}</div>
        </div>
      )}

      {/* Stats summary */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center">
            <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            <p className="text-xs text-gray-500">{t("stats", "registeredProducts", lang)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center">
            <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {products.filter((p: any) => ["approved", "live_ready", "live_done"].includes(p.status)).length}
            </p>
            <p className="text-xs text-gray-500">{t("stats", "approvedProducts", lang)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center">
            <BarChart3 className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{performances.length}</p>
            <p className="text-xs text-gray-500">{t("stats", "liveResults", lang)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 text-center">
            <TrendingUp className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              ¥{performances.reduce((sum: number, p: any) => sum + (Number(p.salesAmount) || 0), 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{t("stats", "totalSales", lang)}</p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setActiveTab("products")}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${activeTab === "products" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
            <Package className="w-4 h-4 inline mr-1.5" />{t("tabs", "products", lang)}
          </button>
          <button onClick={() => setActiveTab("performance")}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${activeTab === "performance" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
            <BarChart3 className="w-4 h-4 inline mr-1.5" />{t("tabs", "performance", lang)}
          </button>
          <button onClick={() => { setActiveTab("cards"); setSelectedCardProduct(null); }}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${activeTab === "cards" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
            <CreditCard className="w-4 h-4 inline mr-1.5" />{t("tabs", "cards", lang)}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 mt-6 pb-12">
        {activeTab === "products" && (
          <div className="space-y-6">
            <WizardProductForm token={token} brand={brand} lang={lang} onSuccess={() => refetch()} />
            {products.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-800">{t("productList", "registeredProducts", lang)}</h2>
                {products.map((product: any) => <ExistingProductCard key={product.id} product={product} lang={lang} />)}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t("productList", "noProducts", lang)}</p>
                <p className="text-sm mt-1">{t("productList", "noProductsGuide", lang)}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "performance" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">{t("performance", "title", lang)}</h2>
            {performances.length > 0 ? (
              performances.map((perf: any) => <PerformanceCard key={perf.id} perf={perf} lang={lang} />)
            ) : (
              <div className="text-center py-12 text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t("performance", "noPerformance", lang)}</p>
                <p className="text-sm mt-1">{t("performance", "noPerformanceGuide", lang)}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "cards" && (
          <div className="space-y-4">
            {selectedCardProduct ? (
              <div>
                <button onClick={() => setSelectedCardProduct(null)} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 text-sm">
                  <ArrowLeft className="w-4 h-4" />{t("cards", "backToList", lang)}
                </button>
                <div className="overflow-x-auto bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <ProductCardTemplate product={selectedCardProduct} brand={brand} showDownload={true} />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-800">{t("cards", "title", lang)}</h2>
                <p className="text-sm text-gray-500 -mt-2">{t("cards", "guide", lang)}</p>
                {products.length > 0 ? (
                  <div className="grid gap-3">
                    {products.map((product: any) => (
                      <ProductCardMini key={product.id} product={product} onClick={() => setSelectedCardProduct(product)} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t("cards", "noCards", lang)}</p>
                    <p className="text-sm mt-1">{t("cards", "noCardsGuide", lang)}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>{t("common", "poweredBy", lang)}</p>
          <p className="mt-1">{t("common", "contact", lang)}</p>
        </div>
      </footer>
    </div>
  );
}
