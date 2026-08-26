import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Archive,
  BadgePercent,
  Barcode,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Edit3,
  History,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

type WorkspaceTab = "products" | "promotions";
type ProductStatus = "draft" | "online" | "offline";
type PromotionFilter = "all" | "active" | "none";
type DiscountType = "percentage" | "fixed_amount";

type ProductForm = {
  selectionProductId: number | null;
  productName: string;
  brandName: string;
  platformProductId: string;
  spuCode: string;
  category: string;
  productUrl: string;
  basePrice: string;
  stock: string;
  status: ProductStatus;
  notes: string;
};

type SkuForm = {
  id?: number;
  platformSkuId: string;
  skuCode: string;
  barcode: string;
  variantName: string;
  salePrice: string;
  stock: string;
  status: "active" | "inactive";
  imageUrl: string;
  imageKey: string;
};

type PromotionForm = {
  id?: number;
  enabled: boolean;
  discountType: DiscountType;
  discountValue: string;
  startsAt: string;
  endsAt: string;
  channel: string;
  notes: string;
};

type PendingImage = { file: File; preview: string };

const EMPTY_PRODUCT: ProductForm = {
  selectionProductId: null,
  productName: "",
  brandName: "",
  platformProductId: "",
  spuCode: "",
  category: "",
  productUrl: "",
  basePrice: "",
  stock: "0",
  status: "draft",
  notes: "",
};

const EMPTY_SKU: SkuForm = {
  platformSkuId: "",
  skuCode: "",
  barcode: "",
  variantName: "",
  salePrice: "",
  stock: "0",
  status: "active",
  imageUrl: "",
  imageKey: "",
};

const EMPTY_PROMOTION: PromotionForm = {
  enabled: false,
  discountType: "percentage",
  discountValue: "",
  startsAt: "",
  endsAt: "",
  channel: "TikTok Shop",
  notes: "",
};

const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function asNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: unknown): string {
  const number = Number(value || 0);
  return `¥${Math.round(number).toLocaleString("ja-JP")}`;
}

function toDateTimeLocal(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function uploadStoreProductImage(file: File, storeId: number, productId: number): Promise<{ url: string; key: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; fileSize: number }> {
  if (!PRODUCT_IMAGE_TYPES.includes(file.type)) throw new Error("JPEG、PNG、WebPのみアップロードできます");
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) throw new Error("画像は8MB以下にしてください");
  const form = new FormData();
  form.append("file", file);
  form.append("storeId", String(storeId));
  form.append("productId", String(productId));
  const response = await fetch("/api/store-product-image-upload", { method: "POST", body: form, credentials: "include" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `商品图片上传失败（HTTP ${response.status}）`);
  return {
    url: String(result.url),
    key: String(result.key),
    mimeType: result.mimeType as "image/jpeg" | "image/png" | "image/webp",
    fileSize: Number(result.fileSize),
  };
}

function statusLabel(status: ProductStatus): string {
  return status === "online" ? "上架" : status === "offline" ? "下架" : "草稿";
}

function promotionStatusLabel(status: string): string {
  if (status === "active") return "推广中";
  if (status === "scheduled") return "计划中";
  if (status === "ended") return "已结束";
  if (status === "paused") return "已暂停";
  return "草稿";
}

export function StoreProductManagement({ store, initialTab = "products" }: { store: { id: number; name: string }; initialTab?: WorkspaceTab }) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProductStatus>("all");
  const [promotionFilter, setPromotionFilter] = useState<PromotionFilter>("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editorProductId, setEditorProductId] = useState<number | null | "new">(null);
  const [expandedAudit, setExpandedAudit] = useState(false);

  const healthQuery = trpc.storeManagement.productManagementHealth.useQuery();
  const summaryQuery = trpc.storeProducts.summary.useQuery({ storeId: store.id });
  const listQuery = trpc.storeProducts.list.useQuery({
    storeId: store.id,
    search: search || undefined,
    brandName: brandFilter || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    promotion: promotionFilter,
    includeArchived,
    limit: 200,
    offset: 0,
  });
  const promotionsQuery = trpc.storeProducts.listPromotions.useQuery({ storeId: store.id, includeEnded: true });

  useEffect(() => setTab(initialTab), [initialTab]);

  const brandOptions = useMemo(() => {
    const brands = new Set<string>();
    listQuery.data?.items.forEach((item: any) => { if (item.brandName) brands.add(String(item.brandName)); });
    return [...brands].sort((a, b) => a.localeCompare(b, "ja"));
  }, [listQuery.data]);

  const archiveMutation = trpc.storeProducts.archive.useMutation({
    onSuccess: async () => {
      toast.success("商品已移入归档，不会删除SKU、图片和推广历史");
      await Promise.all([utils.storeProducts.list.invalidate(), utils.storeProducts.summary.invalidate(), utils.storeProducts.listPromotions.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const pausePromotionMutation = trpc.storeProducts.pausePromotion.useMutation({
    onSuccess: async () => {
      toast.success("推广已暂停，正常售价保持不变");
      await Promise.all([utils.storeProducts.list.invalidate(), utils.storeProducts.summary.invalidate(), utils.storeProducts.listPromotions.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const restoreMutation = trpc.storeProducts.restore.useMutation({
    onSuccess: async () => {
      toast.success("商品已恢复");
      await Promise.all([utils.storeProducts.list.invalidate(), utils.storeProducts.summary.invalidate(), utils.storeProducts.listPromotions.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });

  if (healthQuery.isLoading) {
    return <div className="rounded-xl border border-orange-100 bg-white p-12 text-center text-gray-500"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />商品结构确认中...</div>;
  }
  if (!healthQuery.data?.healthy) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        <div className="flex items-center gap-2 font-bold"><X className="h-5 w-5" />商品管理结构尚未就绪</div>
        <p className="mt-2 text-sm">为保护店铺数据，商品写入暂时停止。请等待加密备份和结构迁移完成。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />商品、SKU、图片、推广与审计已连接Railway MySQL</div>
        <p className="mt-1 text-xs">店铺商品独立于选品中心；关联只用于复制基础资料，不会覆盖全局商品。</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white p-3">
        <div className="flex gap-2">
          <Button variant={tab === "products" ? "default" : "outline"} onClick={() => setTab("products")} className={tab === "products" ? "bg-orange-500 hover:bg-orange-600" : ""}>
            <Package className="mr-1 h-4 w-4" />商品管理
          </Button>
          <Button variant={tab === "promotions" ? "default" : "outline"} onClick={() => setTab("promotions")} className={tab === "promotions" ? "bg-pink-500 hover:bg-pink-600" : ""}>
            <BadgePercent className="mr-1 h-4 w-4" />推广活动
          </Button>
        </div>
        <Button onClick={() => { setExpandedAudit(false); setEditorProductId("new"); }} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="mr-1 h-4 w-4" />登记商品
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["商品总数", summaryQuery.data?.total || 0, Package, "text-orange-600"],
          ["已上架", summaryQuery.data?.onlineCount || 0, CheckCircle2, "text-emerald-600"],
          ["推广中/计划", summaryQuery.data?.promotedCount || 0, BadgePercent, "text-pink-600"],
          ["草稿", summaryQuery.data?.draftCount || 0, Edit3, "text-blue-600"],
          ["总库存", summaryQuery.data?.totalStock || 0, Boxes, "text-purple-600"],
        ].map(([label, value, Icon, color]) => (
          <div key={String(label)} className="rounded-xl border border-orange-100 bg-white p-4">
            <div className={`flex items-center gap-2 text-xs font-medium ${color}`}><Icon className="h-4 w-4" />{String(label)}</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{Number(value).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {tab === "products" ? (
        <>
          <div className="grid gap-2 rounded-xl border border-orange-100 bg-white p-3 md:grid-cols-[minmax(240px,1fr)_180px_140px_160px_auto]">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="商品名、商品ID、SPU、SKU、条码..." className="pl-9" /></div>
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="rounded-md border border-gray-200 bg-white px-3 text-sm"><option value="">全部品牌</option>{brandOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-md border border-gray-200 bg-white px-3 text-sm"><option value="all">全部状态</option><option value="online">上架</option><option value="offline">下架</option><option value="draft">草稿</option></select>
            <select value={promotionFilter} onChange={(e) => setPromotionFilter(e.target.value as PromotionFilter)} className="rounded-md border border-gray-200 bg-white px-3 text-sm"><option value="all">全部推广状态</option><option value="active">推广中/计划</option><option value="none">未推广</option></select>
            <label className="flex items-center justify-end gap-2 whitespace-nowrap text-sm text-gray-600"><input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />显示归档</label>
          </div>

          <div className="overflow-hidden rounded-xl border border-orange-100 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-orange-50 text-left text-xs text-gray-600"><tr><th className="px-4 py-3">商品</th><th className="px-3 py-3">ID / SPU</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">正常售价</th><th className="px-3 py-3">推广</th><th className="px-3 py-3">库存</th><th className="px-3 py-3">状态</th><th className="px-3 py-3 text-right">操作</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {listQuery.data?.items.map((product: any) => (
                    <tr key={product.id} className={product.deletedAt ? "bg-gray-50 opacity-70" : "hover:bg-orange-50/40"}>
                      <td className="px-4 py-3"><div className="flex min-w-[250px] items-center gap-3">{product.mainImageUrl ? <img src={product.mainImageUrl} alt="" className="h-12 w-12 rounded-lg border object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-400"><ImageIcon className="h-5 w-5" /></div>}<div><div className="font-semibold text-gray-900">{product.productName}</div><div className="text-xs text-gray-500">{product.brandName || "未设置品牌"} · {product.category || "未分类"}</div></div></div></td>
                      <td className="px-3 py-3 text-xs text-gray-600"><div>{product.platformProductId || "—"}</div><div className="text-gray-400">SPU: {product.spuCode || "—"}</div></td>
                      <td className="px-3 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{product.skuCount}件</span></td>
                      <td className="px-3 py-3 font-semibold">{product.basePrice === null ? "未设置" : formatMoney(product.basePrice)}</td>
                      <td className="px-3 py-3">{product.promotionId && product.promotionEnabled ? <div><div className="font-semibold text-pink-600">{formatMoney(product.promotionPrice)}</div><div className="text-[11px] text-pink-500">{product.discountType === "percentage" ? `${product.discountValue}% OFF` : `${formatMoney(product.discountValue)}优惠`}</div></div> : <span className="text-gray-400">未推广</span>}</td>
                      <td className="px-3 py-3">{Number(product.stock).toLocaleString()}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${product.status === "online" ? "bg-emerald-50 text-emerald-700" : product.status === "offline" ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-700"}`}>{statusLabel(product.status)}</span></td>
                      <td className="px-3 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => { setExpandedAudit(false); setEditorProductId(product.id); }}><Edit3 className="h-4 w-4" /></Button>{product.deletedAt ? <Button variant="ghost" size="sm" onClick={() => restoreMutation.mutate({ productId: product.id })}><RotateCcw className="h-4 w-4 text-emerald-600" /></Button> : <Button variant="ghost" size="sm" onClick={() => { if (window.confirm("移入归档？SKU、图片、推广和历史都会保留。")) archiveMutation.mutate({ productId: product.id }); }}><Archive className="h-4 w-4 text-gray-500" /></Button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {listQuery.isLoading && <div className="p-12 text-center text-gray-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />读取商品...</div>}
            {!listQuery.isLoading && (listQuery.data?.items.length || 0) === 0 && <div className="p-16 text-center text-gray-500"><Package className="mx-auto mb-3 h-10 w-10 text-orange-200" /><p className="font-medium">该店铺还没有登记商品</p><p className="mt-1 text-xs">点击“登记商品”录入ID、SKU、图片和推广折扣。</p></div>}
          </div>
        </>
      ) : (
        <PromotionList
          rows={promotionsQuery.data || []}
          onEditProduct={(id) => { setExpandedAudit(false); setEditorProductId(id); }}
          onPause={(productId, promotionId) => pausePromotionMutation.mutate({ productId, promotionId })}
        />
      )}

      {editorProductId !== null && (
        <ProductEditor
          store={store}
          productId={editorProductId === "new" ? null : editorProductId}
          openAudit={expandedAudit}
          onOpenAuditChange={setExpandedAudit}
          onClose={() => setEditorProductId(null)}
          onSaved={async () => {
            await Promise.all([
              utils.storeProducts.list.invalidate(),
              utils.storeProducts.summary.invalidate(),
              utils.storeProducts.listPromotions.invalidate(),
              utils.storeProducts.detail.invalidate(),
            ]);
          }}
        />
      )}
    </div>
  );
}

function PromotionList({ rows, onEditProduct, onPause }: { rows: any[]; onEditProduct: (id: number) => void; onPause: (productId: number, promotionId: number) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-pink-100 bg-white">
      <div className="border-b border-pink-100 bg-pink-50 px-4 py-3"><h3 className="flex items-center gap-2 font-bold text-pink-700"><BadgePercent className="h-4 w-4" />推广活动记录</h3><p className="mt-1 text-xs text-pink-600">结束或暂停的推广仍保留，正常售价不会被覆盖。</p></div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs text-gray-600"><tr><th className="px-4 py-3">商品</th><th className="px-3 py-3">正常售价</th><th className="px-3 py-3">优惠</th><th className="px-3 py-3">推广价</th><th className="px-3 py-3">期间</th><th className="px-3 py-3">渠道</th><th className="px-3 py-3">状态</th><th className="px-3 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-gray-100">{rows.map((row) => <tr key={row.id}><td className="px-4 py-3"><div className="flex items-center gap-2">{row.mainImageUrl ? <img src={row.mainImageUrl} className="h-9 w-9 rounded object-cover" alt="" /> : <div className="h-9 w-9 rounded bg-gray-100" />}<div><div className="font-medium">{row.productName}</div><div className="text-[11px] text-gray-400">{row.platformProductId || row.spuCode || `#${row.productId}`}</div></div></div></td><td className="px-3 py-3">{formatMoney(row.basePriceSnapshot)}</td><td className="px-3 py-3 font-medium text-pink-600">{row.discountType === "percentage" ? `${row.discountValue}% OFF` : `${formatMoney(row.discountValue)}优惠`}</td><td className="px-3 py-3 font-bold text-pink-600">{formatMoney(row.promotionPrice)}</td><td className="px-3 py-3 text-xs text-gray-600">{row.startsAt ? new Date(row.startsAt).toLocaleString("ja-JP") : "立即"}<br />～ {row.endsAt ? new Date(row.endsAt).toLocaleString("ja-JP") : "无期限"}</td><td className="px-3 py-3">{row.channel || "—"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${row.status === "active" ? "bg-pink-50 text-pink-700" : row.status === "scheduled" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{promotionStatusLabel(row.status)}</span></td><td className="px-3 py-3 text-right"><div className="flex justify-end gap-1">{row.isEnabled && <Button variant="outline" size="sm" onClick={() => onPause(Number(row.productId), Number(row.id))}><Clock3 className="mr-1 h-3 w-3" />暂停</Button>}<Button variant="outline" size="sm" onClick={() => onEditProduct(row.productId)}><Edit3 className="mr-1 h-3 w-3" />编辑商品</Button></div></td></tr>)}</tbody></table></div>
      {rows.length === 0 && <div className="p-16 text-center text-gray-500"><BadgePercent className="mx-auto mb-3 h-10 w-10 text-pink-200" />尚无推广活动</div>}
    </div>
  );
}

function ProductEditor({ store, productId, onClose, onSaved, openAudit, onOpenAuditChange }: { store: { id: number; name: string }; productId: number | null; onClose: () => void; onSaved: () => Promise<void>; openAudit: boolean; onOpenAuditChange: (value: boolean) => void }) {
  const isNew = productId === null;
  const detailQuery = trpc.storeProducts.detail.useQuery({ productId: productId || 0 }, { enabled: productId !== null });
  const selectionQuery = trpc.storeProducts.selectionCandidates.useQuery({ limit: 100 });
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ProductForm>(EMPTY_PRODUCT);
  const [skus, setSkus] = useState<SkuForm[]>([]);
  const [promotion, setPromotion] = useState<PromotionForm>(EMPTY_PROMOTION);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectionSearch, setSelectionSearch] = useState("");

  useEffect(() => {
    if (isNew) {
      setForm(EMPTY_PRODUCT);
      setSkus([]);
      setPromotion(EMPTY_PROMOTION);
      setPendingImages([]);
      return;
    }
    const data = detailQuery.data;
    if (!data) return;
    const p: any = data.product;
    setForm({
      selectionProductId: p.selectionProductId ? Number(p.selectionProductId) : null,
      productName: p.productName || "",
      brandName: p.brandName || "",
      platformProductId: p.platformProductId || "",
      spuCode: p.spuCode || "",
      category: p.category || "",
      productUrl: p.productUrl || "",
      basePrice: p.basePrice === null ? "" : String(p.basePrice),
      stock: String(p.stock || 0),
      status: p.status,
      notes: p.notes || "",
    });
    setSkus(data.skus.map((sku: any) => ({ id: Number(sku.id), platformSkuId: sku.platformSkuId || "", skuCode: sku.skuCode || "", barcode: sku.barcode || "", variantName: sku.variantName || "", salePrice: sku.salePrice === null ? "" : String(sku.salePrice), stock: String(sku.stock || 0), status: sku.status, imageUrl: sku.imageUrl || "", imageKey: sku.imageKey || "" })));
    const active = data.promotions[0] as any;
    setPromotion(active ? { id: Number(active.id), enabled: Boolean(active.isEnabled), discountType: active.discountType, discountValue: String(active.discountValue), startsAt: toDateTimeLocal(active.startsAt), endsAt: toDateTimeLocal(active.endsAt), channel: active.channel || "", notes: active.notes || "" } : EMPTY_PROMOTION);
  }, [detailQuery.data, isNew]);

  useEffect(() => () => pendingImages.forEach((item) => URL.revokeObjectURL(item.preview)), [pendingImages]);

  const createMutation = trpc.storeProducts.create.useMutation();
  const updateMutation = trpc.storeProducts.update.useMutation();
  const saveSkuMutation = trpc.storeProducts.saveSku.useMutation();
  const archiveSkuMutation = trpc.storeProducts.archiveSku.useMutation();
  const addImageMutation = trpc.storeProducts.addImage.useMutation();
  const removeImageMutation = trpc.storeProducts.removeImage.useMutation();
  const primaryMutation = trpc.storeProducts.setPrimaryImage.useMutation();
  const promotionMutation = trpc.storeProducts.savePromotion.useMutation();

  const previewPrice = useMemo(() => {
    const base = Number(form.basePrice);
    const discount = Number(promotion.discountValue);
    if (!promotion.enabled || !Number.isFinite(base) || base <= 0 || !Number.isFinite(discount) || discount <= 0) return null;
    return Math.max(0, Math.round(promotion.discountType === "percentage" ? base * (1 - discount / 100) : base - discount));
  }, [form.basePrice, promotion]);

  const filteredSelections = useMemo(() => {
    const needle = selectionSearch.trim().toLowerCase();
    if (!needle) return selectionQuery.data || [];
    return (selectionQuery.data || []).filter((item: any) => `${item.productName} ${item.brandName || ""} ${item.productId || ""} ${item.barcode || ""}`.toLowerCase().includes(needle));
  }, [selectionQuery.data, selectionSearch]);

  const chooseSelectionProduct = (item: any) => {
    setForm((current) => ({ ...current, selectionProductId: Number(item.id), productName: item.productName || current.productName, brandName: item.brandName || current.brandName, basePrice: item.price === null ? current.basePrice : String(item.price), stock: String(item.stock || 0) }));
    toast.success("已关联选品中心商品，店铺字段仍可独立编辑");
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (!PRODUCT_IMAGE_TYPES.includes(file.type)) { toast.error(`${file.name}: 仅支持JPEG、PNG、WebP`); continue; }
      if (file.size > PRODUCT_IMAGE_MAX_BYTES) { toast.error(`${file.name}: 超过8MB`); continue; }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    const existingCount = detailQuery.data?.images.length || 0;
    if (existingCount + pendingImages.length + next.length > 8) { next.forEach((item) => URL.revokeObjectURL(item.preview)); toast.error("每个商品最多8张图片"); return; }
    setPendingImages((current) => [...current, ...next]);
  };

  const save = async () => {
    if (!form.productName.trim()) { toast.error("请输入商品名"); return; }
    const basePrice = asNumberOrNull(form.basePrice);
    if (basePrice !== null && basePrice < 0) { toast.error("售价不能为负数"); return; }
    const stock = Number(form.stock || 0);
    if (!Number.isInteger(stock) || stock < 0) { toast.error("库存必须为0以上整数"); return; }
    if (promotion.enabled && previewPrice === null) { toast.error("启用推广前，请填写正常售价和有效折扣"); return; }
    setSaving(true);
    try {
      const payload = {
        selectionProductId: form.selectionProductId,
        platformProductId: asNullable(form.platformProductId),
        spuCode: asNullable(form.spuCode),
        productName: form.productName.trim(),
        brandName: asNullable(form.brandName),
        category: asNullable(form.category),
        productUrl: asNullable(form.productUrl) || "",
        basePrice,
        currency: "JPY",
        stock,
        status: form.status,
        notes: asNullable(form.notes),
      };
      const savedId = isNew ? (await createMutation.mutateAsync({ storeId: store.id, data: payload })).id : productId!;
      if (!isNew) await updateMutation.mutateAsync({ productId: savedId, data: payload });
      for (const sku of skus) {
        if (!sku.variantName.trim()) continue;
        await saveSkuMutation.mutateAsync({ productId: savedId, skuId: sku.id, platformSkuId: asNullable(sku.platformSkuId), skuCode: asNullable(sku.skuCode), barcode: asNullable(sku.barcode), variantName: sku.variantName.trim(), salePrice: asNumberOrNull(sku.salePrice), stock: Math.max(0, Number(sku.stock || 0)), status: sku.status, imageUrl: asNullable(sku.imageUrl), imageKey: asNullable(sku.imageKey) });
      }
      for (const [index, pending] of pendingImages.entries()) {
        const uploaded = await uploadStoreProductImage(pending.file, store.id, savedId);
        await addImageMutation.mutateAsync({ productId: savedId, imageUrl: uploaded.url, imageKey: uploaded.key, mimeType: uploaded.mimeType, fileSize: uploaded.fileSize, isPrimary: index === 0 && (detailQuery.data?.images.length || 0) === 0 });
      }
      if (promotion.enabled || promotion.id) {
        await promotionMutation.mutateAsync({ productId: savedId, promotionId: promotion.id, isEnabled: promotion.enabled, discountType: promotion.discountType, discountValue: Number(promotion.discountValue || 0), startsAt: toIso(promotion.startsAt), endsAt: toIso(promotion.endsAt), channel: asNullable(promotion.channel), notes: asNullable(promotion.notes) });
      }
      pendingImages.forEach((item) => URL.revokeObjectURL(item.preview));
      setPendingImages([]);
      await onSaved();
      toast.success(isNew ? "商品登记完成" : "商品信息已更新");
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const removeExistingImage = async (imageId: number) => {
    if (!productId || !window.confirm("移除此图片引用？S3原文件和审计记录会保留。")) return;
    try { await removeImageMutation.mutateAsync({ productId, imageId }); await utils.storeProducts.detail.invalidate({ productId }); toast.success("图片已移除"); } catch (error: any) { toast.error(error.message); }
  };

  const removeSku = async (index: number) => {
    const sku = skus[index];
    if (sku.id && productId) {
      if (!window.confirm("移除此SKU？历史记录会保留。")) return;
      try { await archiveSkuMutation.mutateAsync({ productId, skuId: sku.id }); toast.success("SKU已归档"); } catch (error: any) { toast.error(error.message); return; }
    }
    setSkus((current) => current.filter((_, i) => i !== index));
  };

  if (!isNew && detailQuery.isLoading) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="rounded-xl bg-white p-8"><Loader2 className="h-6 w-6 animate-spin" /></div></div>;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="h-full w-full max-w-4xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4"><div><h2 className="text-xl font-bold text-gray-900">{isNew ? "登记店铺商品" : "编辑店铺商品"}</h2><p className="text-xs text-gray-500">{store.name} · 商品、SKU、图片和推广记录分别保存</p></div><Button variant="ghost" size="sm" onClick={onClose}><X className="h-5 w-5" /></Button></div>
        <div className="space-y-6 p-6">
          <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 font-bold"><Package className="h-4 w-4 text-orange-500" />商品主档</h3><div className="mb-4 rounded-lg bg-blue-50 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-700">可选：关联选品中心商品</div><Input value={selectionSearch} onChange={(e) => setSelectionSearch(e.target.value)} placeholder="搜索选品商品名、品牌、ID或条码" /><div className="mt-2 max-h-36 overflow-y-auto rounded border bg-white">{filteredSelections.slice(0, 30).map((item: any) => <button type="button" key={item.id} onClick={() => chooseSelectionProduct(item)} className={`flex w-full items-center justify-between border-b px-3 py-2 text-left text-xs hover:bg-blue-50 ${form.selectionProductId === Number(item.id) ? "bg-blue-50 text-blue-700" : ""}`}><span><strong>{item.productName}</strong><br /><span className="text-gray-400">{item.brandName || "未设置品牌"} · #{item.id}</span></span><span>{item.price === null ? "" : formatMoney(item.price)}</span></button>)}</div>{form.selectionProductId && <button type="button" onClick={() => setForm((current) => ({ ...current, selectionProductId: null }))} className="mt-2 text-xs text-red-500">解除选品关联</button>}</div><div className="grid gap-3 md:grid-cols-2"><Field label="商品名 *"><Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></Field><Field label="品牌"><Input value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} /></Field><Field label="平台商品ID"><Input value={form.platformProductId} onChange={(e) => setForm({ ...form, platformProductId: e.target.value })} /></Field><Field label="内部SPU"><Input value={form.spuCode} onChange={(e) => setForm({ ...form, spuCode: e.target.value })} /></Field><Field label="分类"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field><Field label="商品链接"><Input value={form.productUrl} onChange={(e) => setForm({ ...form, productUrl: e.target.value })} placeholder="https://..." /></Field><Field label="正常售价（JPY）"><Input type="number" min="0" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} /></Field><Field label="商品总库存"><Input type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field><Field label="状态"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })} className="h-10 w-full rounded-md border px-3"><option value="draft">草稿</option><option value="online">上架</option><option value="offline">下架</option></select></Field></div><Field label="备注"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" /></Field></section>

          <section className="rounded-xl border p-4"><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><Barcode className="h-4 w-4 text-blue-500" />SKU / 变体</h3><Button type="button" variant="outline" size="sm" onClick={() => setSkus((current) => [...current, { ...EMPTY_SKU }])}><Plus className="mr-1 h-3 w-3" />添加SKU</Button></div>{skus.length === 0 ? <div className="rounded-lg bg-gray-50 p-5 text-center text-xs text-gray-500">无变体商品可不登记SKU</div> : <div className="space-y-3">{skus.map((sku, index) => <div key={sku.id || `new-${index}`} className="rounded-lg border bg-gray-50 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-gray-600">SKU {index + 1}{sku.id ? ` · #${sku.id}` : " · 新增"}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeSku(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div><div className="grid gap-2 md:grid-cols-3"><Input placeholder="规格名 *" value={sku.variantName} onChange={(e) => setSkus((rows) => rows.map((row, i) => i === index ? { ...row, variantName: e.target.value } : row))} /><Input placeholder="SKU编码" value={sku.skuCode} onChange={(e) => setSkus((rows) => rows.map((row, i) => i === index ? { ...row, skuCode: e.target.value } : row))} /><Input placeholder="平台SKU ID" value={sku.platformSkuId} onChange={(e) => setSkus((rows) => rows.map((row, i) => i === index ? { ...row, platformSkuId: e.target.value } : row))} /><Input placeholder="条码" value={sku.barcode} onChange={(e) => setSkus((rows) => rows.map((row, i) => i === index ? { ...row, barcode: e.target.value } : row))} /><Input type="number" min="0" placeholder="SKU售价（空=继承商品）" value={sku.salePrice} onChange={(e) => setSkus((rows) => rows.map((row, i) => i === index ? { ...row, salePrice: e.target.value } : row))} /><Input type="number" min="0" step="1" placeholder="库存" value={sku.stock} onChange={(e) => setSkus((rows) => rows.map((row, i) => i === index ? { ...row, stock: e.target.value } : row))} /></div></div>)}</div>}</section>

          <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 font-bold"><ImageIcon className="h-4 w-4 text-purple-500" />商品图片（最多8张）</h3><div className="flex flex-wrap gap-3">{detailQuery.data?.images.map((image: any) => <div key={image.id} className="group relative"><img src={image.imageUrl} alt="" className={`h-24 w-24 rounded-lg border-2 object-cover ${image.isPrimary ? "border-orange-500" : "border-gray-200"}`} />{image.isPrimary && <span className="absolute left-1 top-1 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] text-white">主图</span>}<div className="absolute inset-x-1 bottom-1 hidden gap-1 group-hover:flex"><button type="button" title="设为主图" onClick={async () => { if (!productId) return; await primaryMutation.mutateAsync({ productId, imageId: image.id }); await utils.storeProducts.detail.invalidate({ productId }); }} className="rounded bg-white/90 p-1"><CheckCircle2 className="h-3 w-3 text-orange-500" /></button><button type="button" title="移除" onClick={() => removeExistingImage(image.id)} className="rounded bg-white/90 p-1"><Trash2 className="h-3 w-3 text-red-500" /></button></div></div>)}{pendingImages.map((item, index) => <div key={item.preview} className="relative"><img src={item.preview} alt="" className="h-24 w-24 rounded-lg border-2 border-dashed border-blue-300 object-cover" /><button type="button" onClick={() => { URL.revokeObjectURL(item.preview); setPendingImages((rows) => rows.filter((_, i) => i !== index)); }} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white"><X className="h-3 w-3" /></button></div>)}<label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-orange-400 hover:text-orange-500"><Upload className="mb-1 h-5 w-5" />上传图片<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} /></label></div><p className="mt-2 text-xs text-gray-400">JPEG/PNG/WebP，单图8MB以下。图片保存到S3/R2，数据库只保存引用。</p></section>

          <section className="rounded-xl border border-pink-200 bg-pink-50/30 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-pink-700"><BadgePercent className="h-4 w-4" />推广与折扣</h3><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={promotion.enabled} onChange={(e) => setPromotion({ ...promotion, enabled: e.target.checked })} />是否推广</label></div><div className="grid gap-3 md:grid-cols-2"><Field label="优惠类型"><select value={promotion.discountType} onChange={(e) => setPromotion({ ...promotion, discountType: e.target.value as DiscountType })} className="h-10 w-full rounded-md border px-3"><option value="percentage">百分比折扣</option><option value="fixed_amount">固定金额优惠</option></select></Field><Field label={promotion.discountType === "percentage" ? "折扣率（%）" : "优惠金额（JPY）"}><Input type="number" min="0" value={promotion.discountValue} onChange={(e) => setPromotion({ ...promotion, discountValue: e.target.value })} /></Field><Field label="开始时间"><Input type="datetime-local" value={promotion.startsAt} onChange={(e) => setPromotion({ ...promotion, startsAt: e.target.value })} /></Field><Field label="结束时间"><Input type="datetime-local" value={promotion.endsAt} onChange={(e) => setPromotion({ ...promotion, endsAt: e.target.value })} /></Field><Field label="推广渠道"><Input value={promotion.channel} onChange={(e) => setPromotion({ ...promotion, channel: e.target.value })} /></Field></div>{promotion.enabled && <div className="mt-3 flex items-center justify-between rounded-lg bg-white p-4"><div><div className="text-xs text-gray-500">正常售价</div><div className="text-lg font-bold">{form.basePrice ? formatMoney(form.basePrice) : "未设置"}</div></div><div className="text-2xl text-pink-400">→</div><div className="text-right"><div className="text-xs text-pink-500">推广价预览</div><div className="text-2xl font-bold text-pink-600">{previewPrice === null ? "—" : formatMoney(previewPrice)}</div></div></div>}<Field label="推广备注"><textarea value={promotion.notes} onChange={(e) => setPromotion({ ...promotion, notes: e.target.value })} rows={2} className="w-full rounded-md border px-3 py-2 text-sm" /></Field></section>

          {!isNew && detailQuery.data && <section className="rounded-xl border p-4"><button type="button" onClick={() => onOpenAuditChange(!openAudit)} className="flex w-full items-center justify-between"><span className="flex items-center gap-2 font-bold"><History className="h-4 w-4 text-gray-500" />变更历史（{detailQuery.data.audit.length}）</span>{openAudit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{openAudit && <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{detailQuery.data.audit.map((log: any) => <div key={log.id} className="rounded-lg bg-gray-50 px-3 py-2 text-xs"><div className="flex justify-between"><span className="font-semibold text-gray-700">{log.action}</span><span className="text-gray-400">{new Date(log.createdAt).toLocaleString("ja-JP")}</span></div><div className="mt-1 text-gray-500">操作人：{log.actorName || "Unknown"}</div></div>)}</div>}</section>}
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-white px-6 py-4"><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600">{saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />保存中...</> : "保存商品"}</Button></div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>{children}</label>;
}
