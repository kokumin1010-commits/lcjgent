/**
 * BrandPortalAdmin - 管理者側ブランドポータル管理ページ
 * /master/brand-portal でアクセス（DashboardLayout内）
 *
 * 機能:
 * - ブランド一覧 + ポータルリンク生成
 * - 商品チューニング（価格・割引率・贈品の調整）
 * - シミュレーション作成・共有
 * - 配信実績の手動登録
 * - ステータス管理・承認フロー
 */
import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Link2, Package, Settings, BarChart3, Plus, Copy, ExternalLink,
  Search, ChevronRight, CheckCircle2, XCircle, Clock, Loader2,
  ArrowLeft, Send, Trash2, Eye, EyeOff, TrendingUp, DollarSign,
  Zap, Users, Award, AlertCircle, RefreshCw, Pencil, Save, X,
  CreditCard, Download, Globe
} from "lucide-react";
import ProductCard, { ProductCardMini } from "@/components/ProductCard";

// ============================================================
// Status config
// ============================================================
const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  draft: { color: "text-gray-600", bg: "bg-gray-100" },
  submitted: { color: "text-blue-600", bg: "bg-blue-100" },
  reviewing: { color: "text-yellow-600", bg: "bg-yellow-100" },
  tuning: { color: "text-orange-600", bg: "bg-orange-100" },
  simulating: { color: "text-purple-600", bg: "bg-purple-100" },
  proposed: { color: "text-indigo-600", bg: "bg-indigo-100" },
  approved: { color: "text-green-600", bg: "bg-green-100" },
  live_ready: { color: "text-teal-600", bg: "bg-teal-100" },
  live_done: { color: "text-emerald-700", bg: "bg-emerald-100" },
  rejected: { color: "text-red-600", bg: "bg-red-100" },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const c = STATUS_COLORS[status] || { color: "text-gray-600", bg: "bg-gray-100" };
  const label = t(`bp.status.${status}`) !== `bp.status.${status}` ? t(`bp.status.${status}`) : status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.color} ${c.bg}`}>
      {label}
    </span>
  );
}

// ============================================================
// Portal List View (default view)
// ============================================================
function PortalListView({
  onSelectPortal,
  onSelectBrand,
}: {
  onSelectPortal: (portalId: number) => void;
  onSelectBrand: (brandId: number) => void;
}) {
  const { t, language, setLanguage } = useLanguage();
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [portalName, setPortalName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  const { data: brandsData, isLoading: brandsLoading } = trpc.brandPortal.getBrandsForPortal.useQuery();
  const { data: portals, isLoading: portalsLoading, refetch: refetchPortals } = trpc.brandPortal.listPortals.useQuery();
  const createPortalMutation = trpc.brandPortal.createPortal.useMutation();

  const filteredBrands = useMemo(() => {
    if (!brandsData) return [];
    if (!search) return brandsData;
    const s = search.toLowerCase();
    return brandsData.filter((b: any) =>
      (b.name || "").toLowerCase().includes(s) ||
      (b.nameJa || "").toLowerCase().includes(s)
    );
  }, [brandsData, search]);

  const handleCreatePortal = async () => {
    if (!selectedBrandId) return;
    try {
      const result = await createPortalMutation.mutateAsync({
        brandId: selectedBrandId,
        portalName: portalName || undefined,
        welcomeMessage: welcomeMessage || undefined,
      });
      toast.success(t("bp.portalCreated"));
      navigator.clipboard.writeText(result.url);
      toast.info(t("bp.urlClipboard"));
      setShowCreateModal(false);
      setSelectedBrandId(null);
      setPortalName("");
      setWelcomeMessage("");
      refetchPortals();
    } catch (err: any) {
      toast.error(err?.message || t("bp.sim.createFailed"));
    }
  };

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/brand/${token}`;
    navigator.clipboard.writeText(url);
    toast.success(t("bp.urlCopied"));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("bp.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("bp.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(language === 'ja' ? 'zh' : 'ja')}
          className="flex items-center gap-2"
        >
          <Globe className="h-4 w-4" />
          {language === 'ja' ? '中文' : '日本語'}
        </Button>
      </div>

      {/* Existing portals */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          {t("bp.existingPortals")}
        </h2>
        {portalsLoading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        ) : portals && portals.length > 0 ? (
          <div className="space-y-3">
            {portals.map((portal: any) => (
              <div
                key={portal.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onSelectPortal(portal.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {portal.brandNameJa || portal.brandName || portal.portalName || `${t("bp.portal")} #${portal.id}`}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>{t("bp.access")}: {portal.accessCount}{t("bp.times")}</span>
                        {portal.lastAccessedAt && (
                          <span>{t("bp.last")}: {new Date(portal.lastAccessedAt).toLocaleDateString("ja-JP")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={portal.status} />
                    <button
                      onClick={(e) => { e.stopPropagation(); copyUrl(portal.accessToken); }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t("bp.copyUrl")}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
            <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t("bp.noPortals")}</p>
          </div>
        )}
      </div>

      {/* Brand list for portal creation */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          {t("bp.brandList")}
        </h2>
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("bp.searchBrand")}
            className="pl-10"
          />
        </div>
        {brandsLoading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredBrands.map((brand: any) => (
              <div
                key={brand.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md ${
                  brand.hasPortal ? "border-green-200 bg-green-50/30 hover:border-green-400" : "border-gray-200 hover:border-blue-400"
                }`}
                onClick={() => onSelectBrand(brand.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{brand.nameJa || brand.name}</p>
                      {brand.category && <p className="text-xs text-gray-500">{brand.category}</p>}
                    </div>
                    {brand.productCount > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                        {brand.productCount}
                      </span>
                    )}
                  </div>
                  {brand.hasPortal ? (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <button
                        onClick={(e) => { e.stopPropagation(); brand.portal && onSelectPortal(brand.portal.portalId); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {t("bp.detail")}
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBrandId(brand.id);
                        setPortalName(brand.nameJa || brand.name || "");
                        setShowCreateModal(true);
                      }}
                      className="text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {t("bp.create")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create portal modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t("bp.createPortalLink")}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.portalName")}</label>
                <Input value={portalName} onChange={e => setPortalName(e.target.value)} placeholder={t("bp.portalNamePlaceholder")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.welcomeMessage")}</label>
                <Textarea
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                  placeholder={t("bp.welcomeMessagePlaceholder")}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleCreatePortal} disabled={createPortalMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
                {createPortalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
                {t("bp.createAndCopy")}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t("bp.cancel")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Portal Detail View (tuning, simulation, performance)
// ============================================================
function PortalDetailView({
  portalId,
  onBack,
}: {
  portalId: number;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"products" | "simulations" | "performance" | "cards">("products");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.brandPortal.getPortalDetail.useQuery({ portalId });
  const tuneMutation = trpc.brandPortal.tuneProduct.useMutation();
  const statusMutation = trpc.brandPortal.updateProductStatus.useMutation();

  if (isLoading) {
    return (
      <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">{t("bp.portalDetail")}</div>;
  }

  const { portal, brand, products, brandProducts: existingProducts } = data;
  // Merge: existing brand_products (手卡) + portal-specific products
  const allProducts = [
    ...(existingProducts || []),
    ...products,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {brand?.nameJa || brand?.name || portal.portalName || t("bp.portalDetail")}
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span>{t("bp.access")}: {portal.accessCount}{t("bp.times")}</span>
            <StatusBadge status={portal.status} />
          </div>
        </div>
        <button
          onClick={() => {
            const url = `${window.location.origin}/brand/${portal.accessToken}`;
            navigator.clipboard.writeText(url);
            toast.success(t("bp.urlCopied"));
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Copy className="w-4 h-4" />
          {t("bp.copyUrl")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: "products", label: t("bp.tab.products"), icon: Package },
          { key: "simulations", label: t("bp.tab.simulations"), icon: BarChart3 },
          { key: "performance", label: t("bp.tab.performance"), icon: TrendingUp },
          { key: "cards", label: t("bp.tab.cards"), icon: CreditCard },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === tab.key
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Products tab - shows both existing brand_products and portal products */}
      {activeTab === "products" && (
        <ProductsTab
          products={allProducts}
          portalId={portalId}
          brandId={portal.brandId}
          onRefresh={refetch}
          selectedProductId={selectedProductId}
          onSelectProduct={setSelectedProductId}
        />
      )}

      {/* Simulations tab */}
      {activeTab === "simulations" && (
        <SimulationsTab
          products={allProducts}
          portalId={portalId}
        />
      )}

      {/* Performance tab */}
      {activeTab === "performance" && (
        <PerformanceTab
          products={allProducts}
          portalId={portalId}
          brandId={portal.brandId}
        />
      )}

      {/* Product Cards (手卡) tab - ライブ特別セット（直播手卡） */}
      {activeTab === "cards" && (
        <ProductCardsTab
          products={allProducts}
          brand={brand}
        />
      )}
    </div>
  );
}

// ============================================================
// Products Tab (Tuning)
// ============================================================
function ProductsTab({
  products,
  portalId,
  brandId,
  onRefresh,
  selectedProductId,
  onSelectProduct,
}: {
  products: any[];
  portalId: number;
  brandId: number | null;
  onRefresh: () => void;
  selectedProductId: number | null;
  onSelectProduct: (id: number | null) => void;
}) {
  const { t } = useLanguage();
  const tuneMutation = trpc.brandPortal.tuneProduct.useMutation();
  const statusMutation = trpc.brandPortal.updateProductStatus.useMutation();
  const addProductMutation = trpc.brandPortal.adminAddProduct.useMutation();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    productName: "",
    productCode: "",
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
    usageMethod: "",
    shippingInfo: "",
    salesMechanism: "",
    giftItems: "",
  });

  const handleAddProduct = async () => {
    if (!newProduct.productName.trim()) {
      toast.error(t("bp.prod.nameRequired"));
      return;
    }
    try {
      await addProductMutation.mutateAsync({
        portalId,
        brandId,
        productName: newProduct.productName,
        productCode: newProduct.productCode || undefined,
        listPrice: newProduct.listPrice ? Number(newProduct.listPrice) : undefined,
        livePrice: newProduct.livePrice ? Number(newProduct.livePrice) : undefined,
        costPrice: newProduct.costPrice ? Number(newProduct.costPrice) : undefined,
        commissionRate: newProduct.commissionRate || undefined,
        productDescription: newProduct.productDescription || undefined,
        specifications: newProduct.specifications || undefined,
        targetAudience: newProduct.targetAudience || undefined,
        sellingPoint1: newProduct.sellingPoint1 || undefined,
        sellingPoint2: newProduct.sellingPoint2 || undefined,
        sellingPoint3: newProduct.sellingPoint3 || undefined,
        usageMethod: newProduct.usageMethod || undefined,
        shippingInfo: newProduct.shippingInfo || undefined,
        salesMechanism: newProduct.salesMechanism || undefined,
        giftItems: newProduct.giftItems || undefined,
      });
      toast.success(t("bp.productAdded"));
      setShowAddForm(false);
      setNewProduct({ productName: "", productCode: "", listPrice: "", livePrice: "", costPrice: "", commissionRate: "", productDescription: "", specifications: "", targetAudience: "", sellingPoint1: "", sellingPoint2: "", sellingPoint3: "", usageMethod: "", shippingInfo: "", salesMechanism: "", giftItems: "" });
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || t("bp.addFailed"));
    }
  };

  const [tuneForm, setTuneForm] = useState<{
    adjustedLivePrice: string;
    adjustedDiscountRate: string;
    adjustedGiftItems: string;
    tuningNotes: string;
  }>({
    adjustedLivePrice: "",
    adjustedDiscountRate: "",
    adjustedGiftItems: "",
    tuningNotes: "",
  });

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleTune = async () => {
    if (!selectedProductId) return;
    try {
      await tuneMutation.mutateAsync({
        productId: selectedProductId,
        adjustedLivePrice: tuneForm.adjustedLivePrice ? Number(tuneForm.adjustedLivePrice) : undefined,
        adjustedDiscountRate: tuneForm.adjustedDiscountRate || undefined,
        adjustedGiftItems: tuneForm.adjustedGiftItems || undefined,
        tuningNotes: tuneForm.tuningNotes || undefined,
        status: "tuning",
      });
      toast.success(t("bp.tuningSaved"));
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || t("bp.saveFailed"));
    }
  };

  const handleStatusChange = async (productId: number, status: string, rejectionReason?: string) => {
    try {
      await statusMutation.mutateAsync({
        productId,
        status: status as any,
        rejectionReason,
      });
      toast.success(t("bp.statusUpdated"));
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || t("bp.updateFailed"));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Product list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{t("bp.registeredProducts")} ({products.length})</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)} className="text-blue-600 border-blue-300 hover:bg-blue-50">
            <Plus className="w-4 h-4 mr-1" /> {t("bp.addNew")}
          </Button>
        </div>
        {showAddForm && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
            <h4 className="font-bold text-blue-800 text-sm">{t("bp.addProduct")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.productName")} <span className="text-red-500">*</span></label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.productName} onChange={e => setNewProduct(p => ({...p, productName: e.target.value}))} placeholder={t("bp.productName")} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.productCode")}</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.productCode} onChange={e => setNewProduct(p => ({...p, productCode: e.target.value}))} placeholder="SKU" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.normalPrice")}</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.listPrice} onChange={e => setNewProduct(p => ({...p, listPrice: e.target.value}))} placeholder="¥0" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.livePrice")}</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.livePrice} onChange={e => setNewProduct(p => ({...p, livePrice: e.target.value}))} placeholder="¥0" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.costPrice")}</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.costPrice} onChange={e => setNewProduct(p => ({...p, costPrice: e.target.value}))} placeholder="¥0" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.commissionRate")}</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.commissionRate} onChange={e => setNewProduct(p => ({...p, commissionRate: e.target.value}))} placeholder="15%" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">{t("bp.targetAudience")}</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.targetAudience} onChange={e => setNewProduct(p => ({...p, targetAudience: e.target.value}))} placeholder={t("bp.targetAudiencePlaceholder")} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.sellingPoint")} 1</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.sellingPoint1} onChange={e => setNewProduct(p => ({...p, sellingPoint1: e.target.value}))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.sellingPoint")} 2</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.sellingPoint2} onChange={e => setNewProduct(p => ({...p, sellingPoint2: e.target.value}))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.sellingPoint")} 3</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.sellingPoint3} onChange={e => setNewProduct(p => ({...p, sellingPoint3: e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.salesMechanism")}</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.salesMechanism} onChange={e => setNewProduct(p => ({...p, salesMechanism: e.target.value}))} placeholder={t("bp.salesMechanismPlaceholder")} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t("bp.giftItems")}</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={newProduct.giftItems} onChange={e => setNewProduct(p => ({...p, giftItems: e.target.value}))} placeholder={t("bp.giftItemsPlaceholder")} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleAddProduct} disabled={addProductMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {addProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {t("bp.add")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>{t("bp.cancel")}</Button>
            </div>
          </div>
        )}
        {products.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t("bp.noProducts")}</p>
          </div>
        ) : (
          products.map((product: any) => (
            <div
              key={product.id}
              onClick={() => {
                onSelectProduct(product.id);
                setTuneForm({
                  adjustedLivePrice: product.adjustedLivePrice?.toString() || "",
                  adjustedDiscountRate: product.adjustedDiscountRate || "",
                  adjustedGiftItems: product.adjustedGiftItems || "",
                  tuningNotes: product.tuningNotes || "",
                });
              }}
              className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                selectedProductId === product.id
                  ? "border-blue-500 ring-2 ring-blue-200 shadow-md"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {product.imageUrls && (
                    <img src={typeof product.imageUrls === 'string' ? (product.imageUrls.startsWith('[') ? JSON.parse(product.imageUrls)[0] : product.imageUrls.split(',')[0]) : Array.isArray(product.imageUrls) ? product.imageUrls[0] : ''} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-900">{product.productName}</h4>
                    <div className="flex items-center gap-2">
                      {product.productCode && <span className="text-xs text-gray-500">SKU: {product.productCode}</span>}
                      {product.source === 'brand_products' && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">{t("bp.existingCard")}</span>}
                    </div>
                  </div>
                </div>
                <StatusBadge status={product.status} />
              </div>
              <div className="flex gap-4 mt-2 text-sm">
                {product.listPrice && <span className="text-gray-500">{t("bp.normal")}: ¥{Number(product.listPrice).toLocaleString()}</span>}
                {product.livePrice && <span className="text-blue-600">{t("bp.special")}: ¥{Number(product.livePrice).toLocaleString()}</span>}
                {product.adjustedLivePrice && <span className="text-green-600 font-medium">{t("bp.adjusted")}: ¥{Number(product.adjustedLivePrice).toLocaleString()}</span>}
                {product.gmv && Number(product.gmv) > 0 && <span className="text-orange-600 font-medium">GMV: ¥{Number(product.gmv).toLocaleString()}</span>}
                {product.commissionRate && <span className="text-gray-500">{t("bp.reward")}: {product.commissionRate}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tuning panel */}
      <div>
        {selectedProduct ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-4">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {t("bp.tuning")}: {selectedProduct.productName}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Original info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="font-medium text-gray-600">{t("bp.originalPrice")}:</span> ¥{Number(selectedProduct.listPrice || 0).toLocaleString()}</p>
                <p><span className="font-medium text-gray-600">{t("bp.brandDesiredPrice")}:</span> ¥{Number(selectedProduct.livePrice || 0).toLocaleString()}</p>
                <p><span className="font-medium text-gray-600">{t("bp.costPrice")}:</span> ¥{Number(selectedProduct.costPrice || 0).toLocaleString()}</p>
                <p><span className="font-medium text-gray-600">{t("bp.licenseRate")}:</span> {selectedProduct.commissionRate || t("bp.notSet")}</p>
                {selectedProduct.giftItems && <p><span className="font-medium text-gray-600">{t("bp.gifts")}:</span> {selectedProduct.giftItems}</p>}
              </div>

              {/* Selling points - from sellingPoint1-6 or features */}
              {([1, 2, 3, 4, 5, 6].some(i => selectedProduct[`sellingPoint${i}`]) || selectedProduct.features) && (
                <div className="bg-yellow-50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-yellow-700 mb-1">{t("bp.sellingPoints")}:</p>
                  {[1, 2, 3, 4, 5, 6].map(i => {
                    const sp = selectedProduct[`sellingPoint${i}`];
                    return sp ? <p key={i} className="text-yellow-800">• {sp}</p> : null;
                  })}
                  {selectedProduct.features && !selectedProduct.sellingPoint1 && (
                    selectedProduct.features.split(/[\n\r]+/).filter(Boolean).map((f: string, i: number) => (
                      <p key={`f${i}`} className="text-yellow-800">• {f}</p>
                    ))
                  )}
                </div>
              )}

              {/* AI Analysis (from brand_products) */}
              {selectedProduct.source === 'brand_products' && selectedProduct.aiCatchCopy && (
                <div className="bg-purple-50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-purple-700 mb-1">{t("bp.aiCatchCopy")}:</p>
                  <p className="text-purple-800">{selectedProduct.aiCatchCopy}</p>
                </div>
              )}

              {/* Tuning fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.adjustedLivePrice")}</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={tuneForm.adjustedLivePrice}
                    onChange={e => setTuneForm(f => ({ ...f, adjustedLivePrice: e.target.value.replace(/[^0-9]/g, "") }))}
                    placeholder="¥"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.adjustedDiscountRate")}</label>
                  <Input
                    value={tuneForm.adjustedDiscountRate}
                    onChange={e => setTuneForm(f => ({ ...f, adjustedDiscountRate: e.target.value }))}
                    placeholder={t("bp.adjustedDiscountRatePlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.adjustedGiftItems")}</label>
                  <Input
                    value={tuneForm.adjustedGiftItems}
                    onChange={e => setTuneForm(f => ({ ...f, adjustedGiftItems: e.target.value }))}
                    placeholder={t("bp.adjustedGiftItemsPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.tuningNotes")}</label>
                  <Textarea
                    value={tuneForm.tuningNotes}
                    onChange={e => setTuneForm(f => ({ ...f, tuningNotes: e.target.value }))}
                    placeholder={t("bp.tuningNotesPlaceholder")}
                    rows={2}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t">
                <Button onClick={handleTune} disabled={tuneMutation.isPending} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  {tuneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {t("bp.saveTuning")}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange(selectedProduct.id, "approved")}
                    className="text-green-600 border-green-300 hover:bg-green-50"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {t("bp.approve")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const reason = prompt(t("bp.rejectReason"));
                      if (reason) handleStatusChange(selectedProduct.id, "rejected", reason);
                    }}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    {t("bp.reject")}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["reviewing", "simulating", "live_ready"].map(s => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(selectedProduct.id, s)}
                      className="text-xs"
                    >
                      {STATUS_CONFIG[s]?.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
            <Settings className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>{t("bp.selectProductToTune")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Simulations Tab
// ============================================================
function SimulationsTab({
  products,
  portalId,
}: {
  products: any[];
  portalId: number;
}) {
  const { t } = useLanguage();
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [simName, setSimName] = useState("");
  const [scenarios, setScenarios] = useState<any[]>([
    { label: t("bp.sim.scenarioA"), livePrice: 0, discountRate: 10, commissionRate: 15, giftItems: "", estimatedSalesCount: 0, estimatedGmv: 0, estimatedProfit: 0, commissionAmount: 0 },
    { label: t("bp.sim.scenarioB"), livePrice: 0, discountRate: 20, commissionRate: 15, giftItems: "", estimatedSalesCount: 0, estimatedGmv: 0, estimatedProfit: 0, commissionAmount: 0 },
    { label: t("bp.sim.scenarioC"), livePrice: 0, discountRate: 30, commissionRate: 20, giftItems: "", estimatedSalesCount: 0, estimatedGmv: 0, estimatedProfit: 0, commissionAmount: 0 },
  ]);
  const [recommendedIdx, setRecommendedIdx] = useState(1);
  const [recommendReason, setRecommendReason] = useState("");

  const createSimMutation = trpc.brandPortal.createSimulation.useMutation();
  const shareSimMutation = trpc.brandPortal.shareSimulation.useMutation();

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Auto-calculate when product is selected
  const initScenariosFromProduct = (product: any) => {
    const listPrice = Number(product.listPrice) || 0;
    const costPrice = Number(product.costPrice) || 0;

    setScenarios([
      {
        label: t("bp.sim.scenarioA"),
        livePrice: Math.round(listPrice * 0.9),
        discountRate: 10,
        commissionRate: 15,
        giftItems: "",
        estimatedSalesCount: 50,
        estimatedGmv: Math.round(listPrice * 0.9 * 50),
        estimatedProfit: Math.round((listPrice * 0.9 - costPrice) * 50),
        commissionAmount: Math.round(listPrice * 0.9 * 50 * 0.15),
      },
      {
        label: t("bp.sim.scenarioB"),
        livePrice: Math.round(listPrice * 0.8),
        discountRate: 20,
        commissionRate: 15,
        giftItems: t("bp.sim.sampleSet"),
        estimatedSalesCount: 100,
        estimatedGmv: Math.round(listPrice * 0.8 * 100),
        estimatedProfit: Math.round((listPrice * 0.8 - costPrice) * 100),
        commissionAmount: Math.round(listPrice * 0.8 * 100 * 0.15),
      },
      {
        label: t("bp.sim.scenarioC"),
        livePrice: Math.round(listPrice * 0.7),
        discountRate: 30,
        commissionRate: 20,
        giftItems: t("bp.sim.sampleSetMini"),
        estimatedSalesCount: 200,
        estimatedGmv: Math.round(listPrice * 0.7 * 200),
        estimatedProfit: Math.round((listPrice * 0.7 - costPrice) * 200),
        commissionAmount: Math.round(listPrice * 0.7 * 200 * 0.20),
      },
    ]);
  };

  const updateScenario = (idx: number, field: string, value: any) => {
    setScenarios(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Auto-recalculate GMV, profit, and commission
      if (["livePrice", "estimatedSalesCount", "commissionRate"].includes(field)) {
        const lp = Number(updated[idx].livePrice) || 0;
        const sc = Number(updated[idx].estimatedSalesCount) || 0;
        const cp = Number(selectedProduct?.costPrice) || 0;
        const cr = Number(updated[idx].commissionRate) || 15;
        updated[idx].estimatedGmv = lp * sc;
        updated[idx].estimatedProfit = (lp - cp) * sc;
        updated[idx].commissionAmount = Math.round(lp * sc * (cr / 100));
      }
      return updated;
    });
  };

  const handleCreate = async () => {
    if (!selectedProductId) return;
    try {
      const result = await createSimMutation.mutateAsync({
        portalProductId: selectedProductId,
        simulationName: simName || undefined,
        priceScenarios: scenarios,
        recommendedScenarioIndex: recommendedIdx,
        recommendationReason: recommendReason || undefined,
      });
      toast.success(t("bp.sim.created"));

      // Auto-share
      if (result.shareToken) {
        const shareUrl = `${window.location.origin}/brand/simulation/${result.shareToken}`;
        navigator.clipboard.writeText(shareUrl);
        toast.info(t("bp.sim.urlCopied"));
      }

      setShowCreate(false);
    } catch (err: any) {
      toast.error(err?.message || t("bp.sim.createFailed"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Product selector */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3">{t("bp.sim.selectProduct")}</h3>
        <div className="flex flex-wrap gap-2">
          {products.map((p: any) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProductId(p.id);
                initScenariosFromProduct(p);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedProductId === p.id
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300"
              }`}
            >
              {p.productName}
            </button>
          ))}
        </div>
      </div>

      {selectedProductId && (
        <>
          {/* Existing simulations */}
          <SimulationList portalProductId={selectedProductId} />

          {/* Create new simulation */}
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
            >
              <Plus className="w-8 h-8 mx-auto mb-2 text-gray-400 group-hover:text-blue-500" />
              <p className="font-medium text-gray-600 group-hover:text-blue-600">{t("bp.sim.createNew")}</p>
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  {t("bp.sim.createSimulation")}
                </h3>
                <button onClick={() => setShowCreate(false)} className="text-white/80 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.sim.simName")}</label>
                  <Input value={simName} onChange={e => setSimName(e.target.value)} placeholder={t("bp.sim.simNamePlaceholder")} />
                </div>

                {/* Scenario editor */}
                <div className="space-y-4">
                  {scenarios.map((scenario, idx) => (
                    <div key={idx} className={`border rounded-xl p-4 ${idx === recommendedIdx ? "border-blue-400 bg-blue-50/30" : "border-gray-200"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <Input
                          value={scenario.label}
                          onChange={e => updateScenario(idx, "label", e.target.value)}
                          className="font-medium text-sm max-w-xs"
                        />
                        <div className="flex items-center gap-2">
                          {idx === recommendedIdx && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Award className="w-3 h-3" /> {t("bp.sim.recommended")}
                            </span>
                          )}
                          <button
                            onClick={() => setRecommendedIdx(idx)}
                            className={`text-xs px-2 py-1 rounded ${idx === recommendedIdx ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            {t("bp.sim.setRecommended")}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">{t("bp.livePrice")}</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={scenario.livePrice}
                            onChange={e => updateScenario(idx, "livePrice", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">{t("bp.sim.discountRate")}</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={scenario.discountRate}
                            onChange={e => updateScenario(idx, "discountRate", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">{t("bp.sim.estimatedSales")}</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={scenario.estimatedSalesCount}
                            onChange={e => updateScenario(idx, "estimatedSalesCount", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">{t("bp.sim.commissionRatePct")}</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={scenario.commissionRate}
                            onChange={e => updateScenario(idx, "commissionRate", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">{t("bp.gifts")}</label>
                          <Input
                            value={scenario.giftItems}
                            onChange={e => updateScenario(idx, "giftItems", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Calculated values */}
                      <div className="flex gap-4 mt-3 text-sm">
                        <span className="text-blue-600">GMV: ¥{Number(scenario.estimatedGmv).toLocaleString()}</span>
                        <span className="text-green-600">{t("bp.sim.profit")}: ¥{Number(scenario.estimatedProfit).toLocaleString()}</span>
                        <span className="text-orange-600">{t("bp.sim.commission")}: ¥{Number(scenario.commissionAmount).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => setScenarios(prev => [...prev, {
                      label: `${t("bp.sim.scenario")}${String.fromCharCode(65 + prev.length)}`,
                      livePrice: 0, discountRate: 0, commissionRate: 15, giftItems: "",
                      estimatedSalesCount: 0, estimatedGmv: 0, estimatedProfit: 0, commissionAmount: 0,
                    }])}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> {t("bp.sim.addScenario")}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.sim.recommendReason")}</label>
                  <Textarea
                    value={recommendReason}
                    onChange={e => setRecommendReason(e.target.value)}
                    placeholder={t("bp.sim.recommendReasonPlaceholder")}
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleCreate} disabled={createSimMutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white px-8">
                    {createSimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    {t("bp.sim.createAndCopy")}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>{t("bp.cancel")}</Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Simulation List (for a product)
// ============================================================
function SimulationList({ portalProductId }: { portalProductId: number }) {
  const { t } = useLanguage();
  const { data: sims, isLoading } = trpc.brandPortal.getSimulations.useQuery({ portalProductId });
  const shareMutation = trpc.brandPortal.shareSimulation.useMutation();

  if (isLoading) return <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>;
  if (!sims || sims.length === 0) return null;

  const handleShare = async (simId: number) => {
    try {
      const result = await shareMutation.mutateAsync({ simulationId: simId });
      navigator.clipboard.writeText(result.shareUrl);
      toast.success(t("bp.sim.urlCopied"));
    } catch (err: any) {
      toast.error(err?.message || t("bp.sim.shareFailed"));
    }
  };

  return (
    <div>
      <h3 className="font-bold text-gray-800 mb-3">{t("bp.sim.existingSims")}</h3>
      <div className="space-y-3">
        {sims.map((sim: any) => (
          <div key={sim.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{sim.simulationName || `${t("bp.sim.simulation")} #${sim.id}`}</h4>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>{new Date(sim.createdAt).toLocaleDateString("ja-JP")}</span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    sim.status === "responded" ? "bg-green-100 text-green-700" :
                    sim.status === "shared" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {sim.status === "responded" ? t("bp.sim.statusResponded") :
                     sim.status === "shared" ? t("bp.sim.statusShared") :
                     sim.status === "finalized" ? t("bp.sim.statusFinalized") : t("bp.sim.statusDraft")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sim.status === "responded" && sim.selectedScenarioIndex != null && (
                  <span className="text-sm text-green-600 font-medium">
                    {t("bp.sim.scenario")} {sim.selectedScenarioIndex + 1} {t("bp.sim.selected")}
                  </span>
                )}
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/brand/simulation/${sim.shareToken}`;
                    navigator.clipboard.writeText(url);
                    toast.success(t("bp.urlCopied"));
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Copy className="w-4 h-4" />
                </button>
                {sim.status === "draft" && (
                  <Button size="sm" variant="outline" onClick={() => handleShare(sim.id)}>
                    <Send className="w-3 h-3 mr-1" />
                    {t("bp.sim.share")}
                  </Button>
                )}
              </div>
            </div>
            {sim.brandFeedback && (
              <div className="mt-3 bg-green-50 p-3 rounded-lg text-sm">
                <span className="font-medium text-green-700">{t("bp.sim.brandFeedback")}:</span>
                <p className="text-green-800 mt-1">{sim.brandFeedback}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Performance Tab
// ============================================================
function PerformanceTab({
  products,
  portalId,
  brandId,
}: {
  products: any[];
  portalId: number;
  brandId: number;
}) {
  const { t } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const [perfForm, setPerfForm] = useState({
    portalProductId: "",
    livestreamDate: "",
    streamerName: "",
    platform: "",
    duration: "",
    salesAmount: "",
    gmv: "",
    salesCount: "",
    orderCount: "",
    viewerCount: "",
    peakViewers: "",
    notes: "",
  });

  const { data: perfs, isLoading, refetch } = trpc.brandPortal.getPerformances.useQuery({ brandId });
  const addPerfMutation = trpc.brandPortal.addPerformance.useMutation();

  const handleAdd = async () => {
    if (!perfForm.portalProductId || !perfForm.livestreamDate) {
      toast.error(t("bp.perf.required"));
      return;
    }
    try {
      await addPerfMutation.mutateAsync({
        portalProductId: Number(perfForm.portalProductId),
        livestreamDate: perfForm.livestreamDate,
        streamerName: perfForm.streamerName || undefined,
        platform: perfForm.platform || undefined,
        duration: perfForm.duration ? Number(perfForm.duration) : undefined,
        salesAmount: perfForm.salesAmount ? Number(perfForm.salesAmount) : undefined,
        gmv: perfForm.gmv ? Number(perfForm.gmv) : undefined,
        salesCount: perfForm.salesCount ? Number(perfForm.salesCount) : undefined,
        orderCount: perfForm.orderCount ? Number(perfForm.orderCount) : undefined,
        viewerCount: perfForm.viewerCount ? Number(perfForm.viewerCount) : undefined,
        peakViewers: perfForm.peakViewers ? Number(perfForm.peakViewers) : undefined,
        notes: perfForm.notes || undefined,
      });
      toast.success(t("bp.perf.registered"));
      setShowAdd(false);
      setPerfForm({
        portalProductId: "", livestreamDate: "", streamerName: "", platform: "",
        duration: "", salesAmount: "", gmv: "", salesCount: "", orderCount: "",
        viewerCount: "", peakViewers: "", notes: "",
      });
      refetch();
    } catch (err: any) {
      toast.error(err?.message || t("bp.perf.registerFailed"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Add button */}
      {!showAdd ? (
        <Button onClick={() => setShowAdd(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          {t("bp.perf.manualRegister")}
        </Button>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t("bp.perf.registerTitle")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.productName")} <span className="text-red-500">*</span></label>
              <select
                value={perfForm.portalProductId}
                onChange={e => setPerfForm(f => ({ ...f, portalProductId: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">{t("bp.perf.selectProduct")}</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.productName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.perf.streamDate")} <span className="text-red-500">*</span></label>
              <Input type="date" value={perfForm.livestreamDate} onChange={e => setPerfForm(f => ({ ...f, livestreamDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.perf.streamerName")}</label>
              <Input value={perfForm.streamerName} onChange={e => setPerfForm(f => ({ ...f, streamerName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.perf.platform")}</label>
              <Input value={perfForm.platform} onChange={e => setPerfForm(f => ({ ...f, platform: e.target.value }))} placeholder="TikTok, Instagram等" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.perf.duration")}</label>
              <Input type="text" inputMode="numeric" value={perfForm.duration} onChange={e => setPerfForm(f => ({ ...f, duration: e.target.value.replace(/[^0-9]/g, "") }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.perf.salesAmount")}</label>
              <Input type="text" inputMode="numeric" value={perfForm.salesAmount} onChange={e => setPerfForm(f => ({ ...f, salesAmount: e.target.value.replace(/[^0-9]/g, "") }))} placeholder="¥" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">GMV</label>
              <Input type="text" inputMode="numeric" value={perfForm.gmv} onChange={e => setPerfForm(f => ({ ...f, gmv: e.target.value.replace(/[^0-9]/g, "") }))} placeholder="¥" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.perf.salesCount")}</label>
              <Input type="text" inputMode="numeric" value={perfForm.salesCount} onChange={e => setPerfForm(f => ({ ...f, salesCount: e.target.value.replace(/[^0-9]/g, "") }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.perf.viewerCount")}</label>
              <Input type="text" inputMode="numeric" value={perfForm.viewerCount} onChange={e => setPerfForm(f => ({ ...f, viewerCount: e.target.value.replace(/[^0-9]/g, "") }))} />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">{t("bp.perf.notes")}</label>
            <Textarea value={perfForm.notes} onChange={e => setPerfForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleAdd} disabled={addPerfMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
              {addPerfMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {t("bp.perf.register")}
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t("bp.cancel")}</Button>
          </div>
        </div>
      )}

      {/* Performance list */}
      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
      ) : perfs && perfs.length > 0 ? (
        <div className="space-y-3">
          {perfs.map((perf: any) => {
            const product = products.find(p => p.id === perf.portalProductId);
            return (
              <div key={perf.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{product?.productName || t("bp.perf.unknown")}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(perf.livestreamDate).toLocaleDateString("ja-JP")}
                      {perf.streamerName && ` | ${perf.streamerName}`}
                      {perf.platform && ` | ${perf.platform}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {perf.isVisible ? (
                      <Eye className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {perf.salesAmount != null && (
                    <div className="bg-blue-50 rounded p-2 text-center">
                      <p className="text-xs text-blue-600">{t("bp.perf.sales")}</p>
                      <p className="font-bold text-blue-700">¥{Number(perf.salesAmount).toLocaleString()}</p>
                    </div>
                  )}
                  {perf.gmv != null && (
                    <div className="bg-green-50 rounded p-2 text-center">
                      <p className="text-xs text-green-600">GMV</p>
                      <p className="font-bold text-green-700">¥{Number(perf.gmv).toLocaleString()}</p>
                    </div>
                  )}
                  {perf.salesCount != null && (
                    <div className="bg-purple-50 rounded p-2 text-center">
                      <p className="text-xs text-purple-600">{t("bp.perf.salesCount")}</p>
                      <p className="font-bold text-purple-700">{perf.salesCount}</p>
                    </div>
                  )}
                  {perf.viewerCount != null && (
                    <div className="bg-orange-50 rounded p-2 text-center">
                      <p className="text-xs text-orange-600">{t("bp.perf.viewers")}</p>
                      <p className="font-bold text-orange-700">{Number(perf.viewerCount).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{t("bp.perf.noPerformance")}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Product Cards (手卡) Tab
// ============================================================
function ProductCardsTab({
  products,
  brand,
}: {
  products: any[];
  brand: any;
}) {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Filter products that have enough data for a card
  const cardReadyProducts = products.filter(
    (p: any) => p.productName && (p.status === "approved" || p.status === "live_ready" || p.status === "live_done" || p.status === "tuning" || p.status === "simulating" || p.status === "proposed" || p.status === "submitted")
  );

  if (selectedProduct) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedProduct(null)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h3 className="text-lg font-bold text-gray-900">
            {selectedProduct.productName} - {t("bp.cards.preview")}
          </h3>
        </div>
        <div className="overflow-x-auto bg-gray-50 rounded-xl p-6">
          <ProductCard product={selectedProduct} brand={brand} showDownload={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">
          {t("bp.cards.list")} ({cardReadyProducts.length})
        </h3>
        <p className="text-sm text-gray-500">
          {t("bp.cards.clickToPreview")}
        </p>
      </div>

      {cardReadyProducts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{t("bp.cards.noCards")}</p>
          <p className="text-xs mt-1">{t("bp.cards.noCardsHint")}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {cardReadyProducts.map((product: any) => (
            <ProductCardMini
              key={product.id}
              product={product}
              onClick={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Brand Products View (ブランドの商品パフォーマンス = 手卡一覧)
// ポータル作成不要でブランドをタップするだけで商品一覧が見える
// ============================================================
function BrandProductsView({
  brandId,
  onBack,
  onCreatePortal,
}: {
  brandId: number;
  onBack: () => void;
  onCreatePortal: (brandId: number) => void;
}) {
  const { t } = useLanguage();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data, isLoading } = trpc.brandPortal.getProductCardsByBrand.useQuery({ brandId });

  if (isLoading) {
    return (
      <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
    );
  }

  const brand = data?.brand;
  const portalProducts = data?.products || [];
  const brandProds = data?.brandProducts || [];
  const allProducts = [...brandProds, ...portalProducts];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {brand?.nameJa || brand?.name || t("bp.brand.detail")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("bp.brand.productPerformance")} {allProducts.length}
          </p>
        </div>
        <a
          href={`/master/brands/${brandId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {t("bp.brand.detail")}
        </a>
      </div>

      {allProducts.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">{t("bp.brand.noProducts")}</p>
          <p className="text-xs text-gray-400">{t("bp.brand.addProductHint")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allProducts.map((product: any) => {
              const imageUrl = product.imageUrls
                ? (typeof product.imageUrls === "string" ? product.imageUrls.split(",")[0] : product.imageUrls[0])
                : null;
              const price = product.livePrice || product.listPrice;
              const listPrice = product.listPrice;
              const discount = listPrice && price && listPrice > price
                ? Math.round((1 - price / listPrice) * 100)
                : (product.discountRate ? Number(product.discountRate) : null);

              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
                >
                  {/* Image */}
                  <div className="aspect-[16/9] bg-gray-100 overflow-hidden relative">
                    {imageUrl ? (
                      <img src={imageUrl.trim()} alt={product.productName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    {product.source === "brand_products" && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium bg-purple-600 text-white rounded-full">{t("bp.brand.existingCard")}</span>
                    )}
                    {discount && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">{discount}% OFF</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm truncate">{product.productName}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {listPrice && (
                        <span className="text-xs text-gray-400 line-through">¥{Number(listPrice).toLocaleString()}</span>
                      )}
                      {price && (
                        <span className="text-sm font-bold text-red-500">¥{Number(price).toLocaleString()}</span>
                      )}
                      {product.commissionRate && (
                        <span className="text-xs text-cyan-600 font-medium ml-auto">{t("bp.brand.commission")} {product.commissionRate}</span>
                      )}
                    </div>
                    {product.gmv && Number(product.gmv) > 0 && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-green-600 font-medium">GMV ¥{Number(product.gmv).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Product Detail Dialog */}
          {selectedProduct && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{selectedProduct.productName}</h3>
                  <button onClick={() => setSelectedProduct(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Images */}
                {selectedProduct.imageUrls && (
                  <div className="mb-4">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {(typeof selectedProduct.imageUrls === "string" ? selectedProduct.imageUrls.split(",") : selectedProduct.imageUrls)
                        .filter(Boolean)
                        .map((url: string, i: number) => (
                          <img key={i} src={url.trim()} alt="" className="h-32 rounded-lg object-cover flex-shrink-0 border cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-blue-400 transition-all" onClick={(e) => { e.stopPropagation(); setPreviewImage(url.trim()); }} />
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{t("bp.brand.clickToEnlarge")}</p>
                  </div>
                )}

                {/* Price Info */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">{t("bp.brand.listPrice")}</p>
                    <p className="text-lg font-bold text-gray-900">¥{selectedProduct.listPrice ? Number(selectedProduct.listPrice).toLocaleString() : "-"}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-500">{t("bp.brand.specialPrice")}</p>
                    <p className="text-lg font-bold text-red-600">¥{selectedProduct.livePrice ? Number(selectedProduct.livePrice).toLocaleString() : "-"}</p>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-cyan-500">{t("bp.brand.commissionReward")}</p>
                    <p className="text-lg font-bold text-cyan-600">{selectedProduct.commissionRate || "-"}</p>
                  </div>
                </div>

                {/* Proposal Image Preview (既存手卡の提案書) */}
                {selectedProduct.proposalImageUrl && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">{t("bp.brand.proposalPreview")}</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all" onClick={(e) => { e.stopPropagation(); setPreviewImage(selectedProduct.proposalImageUrl); }}>
                      <img src={selectedProduct.proposalImageUrl} alt={t("bp.brand.proposal")} className="w-full max-h-[400px] object-contain bg-gray-50" />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 text-center">{t("bp.brand.clickToEnlarge")}</p>
                  </div>
                )}

                {/* Details */}
                <div className="space-y-3">
                  {selectedProduct.productDescription && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">{t("bp.brand.catchcopy")}</p>
                      <p className="text-sm text-gray-700">{selectedProduct.productDescription}</p>
                    </div>
                  )}
                  {selectedProduct.features && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">{t("bp.brand.sellingPoints")}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedProduct.features}</p>
                    </div>
                  )}
                  {selectedProduct.specifications && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">{t("bp.brand.productDetail")}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedProduct.specifications}</p>
                    </div>
                  )}
                  {selectedProduct.targetAudience && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">{t("bp.brand.targetAudience")}</p>
                      <p className="text-sm text-gray-700">{selectedProduct.targetAudience}</p>
                    </div>
                  )}
                  {selectedProduct.usageMethod && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">{t("bp.brand.howToUse")}</p>
                      <p className="text-sm text-gray-700">{selectedProduct.usageMethod}</p>
                    </div>
                  )}
                  {selectedProduct.shippingInfo && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">{t("bp.brand.shippingInfo")}</p>
                      <p className="text-sm text-gray-700">{selectedProduct.shippingInfo}</p>
                    </div>
                  )}
                  {selectedProduct.aiCatchCopy && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-600 mb-1">{t("bp.brand.aiCatchcopy")}</p>
                      <p className="text-sm text-amber-800">{selectedProduct.aiCatchCopy}</p>
                    </div>
                  )}
                  {selectedProduct.aiFeatures && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-600 mb-1">{t("bp.brand.aiSellingPoints")}</p>
                      <p className="text-sm text-amber-800 whitespace-pre-wrap">{selectedProduct.aiFeatures}</p>
                    </div>
                  )}
                  {selectedProduct.gmv && Number(selectedProduct.gmv) > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-green-600 mb-1">{t("bp.brand.performance")}</p>
                      <p className="text-sm text-green-800">GMV: ¥{Number(selectedProduct.gmv).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Image Lightbox Preview */}
          {previewImage && (
            <div
              className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setPreviewImage(null)}
            >
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              <img
                src={previewImage}
                alt={t("bp.cards.preview")}
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================
export default function BrandPortalAdmin() {
  const [selectedPortalId, setSelectedPortalId] = useState<number | null>(null);
  const [selectedBrandId, setSelectedBrandIdMain] = useState<number | null>(null);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {selectedPortalId ? (
        <PortalDetailView
          portalId={selectedPortalId}
          onBack={() => setSelectedPortalId(null)}
        />
      ) : selectedBrandId ? (
        <BrandProductsView
          brandId={selectedBrandId}
          onBack={() => setSelectedBrandIdMain(null)}
          onCreatePortal={(brandId) => {
            setSelectedBrandIdMain(null);
            // Will be handled by PortalListView
          }}
        />
      ) : (
        <PortalListView
          onSelectPortal={setSelectedPortalId}
          onSelectBrand={setSelectedBrandIdMain}
        />
      )}
    </div>
  );
}
