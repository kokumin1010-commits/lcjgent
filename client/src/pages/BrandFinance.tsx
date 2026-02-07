import { useState, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, DollarSign, Package, Users, ShoppingCart,
  TrendingUp, FileText, Trash2, Search, ChevronLeft, ChevronRight,
  BarChart3, PieChart, Calendar, Download, Loader2, Eye, RefreshCw,
  Store, Video, ShoppingBag, AlertTriangle, CheckCircle, Clock
} from "lucide-react";

function formatCurrency(val: number | string | null | undefined): string {
  const num = typeof val === 'string' ? parseFloat(val) : (val || 0);
  return `¥${Math.round(num).toLocaleString()}`;
}

function formatNumber(val: number | string | null | undefined): string {
  const num = typeof val === 'string' ? parseFloat(val) : (val || 0);
  return Math.round(num).toLocaleString();
}

function formatPercent(val: number | string | null | undefined): string {
  const num = typeof val === 'string' ? parseFloat(val) : (val || 0);
  return `${num.toFixed(1)}%`;
}

type TabType = 'summary' | 'creators' | 'shops' | 'products' | 'daily' | 'orders' | 'imports';

export default function BrandFinance() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const brandId = parseInt(id || "0");
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [csvUploading, setCsvUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteImportId, setDeleteImportId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Order list state
  const [orderPage, setOrderPage] = useState(0);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderCreator, setOrderCreator] = useState("");
  const [orderShop, setOrderShop] = useState("");
  const [orderContentType, setOrderContentType] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Data queries
  const { data: brand } = trpc.brand.getById.useQuery({ id: brandId }, { enabled: brandId > 0 });
  const { data: summary, refetch: refetchSummary } = trpc.tiktokFinance.getSummary.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: creatorSummary = [], refetch: refetchCreators } = trpc.tiktokFinance.getCreatorSummary.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: shopSummary = [], refetch: refetchShops } = trpc.tiktokFinance.getShopSummary.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: productSummary = [], refetch: refetchProducts } = trpc.tiktokFinance.getProductSummary.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: dailySummary = [], refetch: refetchDaily } = trpc.tiktokFinance.getDailySummary.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: contentTypeSummary = [], refetch: refetchContentType } = trpc.tiktokFinance.getContentTypeSummary.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: importHistory = [], refetch: refetchImports } = trpc.tiktokFinance.getImportHistory.useQuery({ brandId }, { enabled: brandId > 0 });

  const { data: ordersData, refetch: refetchOrders } = trpc.tiktokFinance.getOrders.useQuery({
    brandId,
    limit: 50,
    offset: orderPage * 50,
    search: orderSearch || undefined,
    creatorUsername: orderCreator || undefined,
    shopName: orderShop || undefined,
    contentType: orderContentType || undefined,
    orderStatus: orderStatus || undefined,
  }, { enabled: brandId > 0 && activeTab === 'orders' });



  const deleteMutation = trpc.tiktokFinance.deleteImport.useMutation({
    onSuccess: () => {
      toast.success("インポートデータを削除しました");
      setDeleteDialogOpen(false);
      setDeleteImportId(null);
      refetchAll();
    },
    onError: (error) => {
      toast.error(`削除エラー: ${error.message}`);
    },
  });

  function refetchAll() {
    refetchSummary();
    refetchCreators();
    refetchShops();
    refetchProducts();
    refetchDaily();
    refetchContentType();
    refetchImports();
    refetchOrders();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error("CSVファイルを選択してください");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("ファイルサイズが16MBを超えています");
      return;
    }

    setCsvUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("brandId", String(brandId));

      const response = await fetch("/api/csv-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      // Check Content-Type to avoid parsing non-JSON responses
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("サーバーから不正なレスポンスが返されました");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "CSVインポートに失敗しました");
      }

      toast.success(`CSVインポート完了: ${result.importedRows}件追加, ${result.skippedRows}件スキップ`);
      setUploadDialogOpen(false);
      refetchAll();
    } catch (error: any) {
      console.error("CSV upload error:", error);
      toast.error(error?.message || "ファイル読み込みエラー");
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Calculate max values for bar charts
  const maxDailySales = useMemo(() => Math.max(...dailySummary.map(d => Number(d.totalSales) || 0), 1), [dailySummary]);
  const maxShopSales = useMemo(() => Math.max(...shopSummary.map(s => Number(s.totalSales) || 0), 1), [shopSummary]);
  const maxProductSales = useMemo(() => Math.max(...productSummary.map(p => Number(p.totalSales) || 0), 1), [productSummary]);

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'summary', label: 'サマリー', icon: BarChart3 },
    { key: 'creators', label: 'クリエイター別', icon: Users },
    { key: 'shops', label: 'ショップ別', icon: Store },
    { key: 'products', label: '商品別', icon: Package },
    { key: 'daily', label: '日別推移', icon: Calendar },
    { key: 'orders', label: '注文明細', icon: ShoppingCart },
    { key: 'imports', label: 'インポート履歴', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950/30 to-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/master/brands/${brandId}`)}
              className="text-gray-300 hover:text-white hover:bg-blue-900/30"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
            <div className="h-6 w-px bg-blue-500/30" />
            <DollarSign className="h-5 w-5 text-purple-400" />
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              ファイナンス管理
            </h1>
            {brand && (
              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {brand.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => refetchAll()}
              variant="outline"
              size="sm"
              className="border-blue-500/50 bg-blue-950/50 text-gray-200 hover:bg-blue-900/40"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              更新
            </Button>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
            >
              <Upload className="h-4 w-4 mr-1" />
              CSVアップロード
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-lg shadow-purple-500/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Summary Tab */}
        {activeTab === 'summary' && summary && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-blue-950/80 to-blue-900/40 border-blue-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-blue-400" />
                    <span className="text-xs text-gray-400">総注文数</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{formatNumber(summary.totalOrders)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    完了: {formatNumber(summary.completedOrders)} / 処理中: {formatNumber(summary.processingOrders)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-950/80 to-green-900/40 border-green-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    <span className="text-xs text-gray-400">総売上</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(summary.totalSales)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    数量: {formatNumber(summary.totalQuantity)}個 / 平均: {formatCurrency(summary.avgPrice)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-950/80 to-purple-900/40 border-purple-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                    <span className="text-xs text-gray-400">パートナー手数料(実際)</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(summary.totalActPartnerCommission)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    推定: {formatCurrency(summary.totalEstPartnerCommission)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-pink-950/80 to-pink-900/40 border-pink-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-pink-400" />
                    <span className="text-xs text-gray-400">クリエイター手数料(実際)</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(summary.totalActCreatorCommission)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    推定: {formatCurrency(summary.totalEstCreatorCommission)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-gray-900/60 border-gray-700/50">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-400 mb-1">パートナーリワード(実際)</div>
                  <div className="text-lg font-bold text-amber-300">{formatCurrency(summary.totalActPartnerReward)}</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/60 border-gray-700/50">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-400 mb-1">クリエイターリワード(実際)</div>
                  <div className="text-lg font-bold text-cyan-300">{formatCurrency(summary.totalActCreatorReward)}</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/60 border-gray-700/50">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-400 mb-1">ショップ広告報酬(パートナー)</div>
                  <div className="text-lg font-bold text-orange-300">{formatCurrency(summary.totalActPartnerShopAd)}</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/60 border-gray-700/50">
                <CardContent className="p-4">
                  <div className="text-xs text-gray-400 mb-1">ショップ広告報酬(クリエイター)</div>
                  <div className="text-lg font-bold text-lime-300">{formatCurrency(summary.totalActCreatorShopAd)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Return/Refund + Period + Content Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="bg-gray-900/60 border-gray-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    返品・返金
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">返品数量</span>
                    <span className="text-red-300 font-medium">{formatNumber(summary.totalReturnQty)}個</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">返金数量</span>
                    <span className="text-red-300 font-medium">{formatNumber(summary.totalRefundQty)}個</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/60 border-gray-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    データ期間
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">開始</span>
                    <span className="text-blue-300 font-medium text-sm">
                      {summary.minDate ? new Date(summary.minDate).toLocaleDateString('ja-JP') : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">終了</span>
                    <span className="text-blue-300 font-medium text-sm">
                      {summary.maxDate ? new Date(summary.maxDate).toLocaleDateString('ja-JP') : '-'}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/60 border-gray-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                    <Video className="h-4 w-4 text-purple-400" />
                    コンテンツタイプ別
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {contentTypeSummary.map((ct, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">{ct.contentType || '不明'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-purple-300 font-medium text-sm">{formatNumber(ct.orderCount)}件</span>
                        <span className="text-gray-500 text-xs">{formatCurrency(ct.totalSales)}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Creators Tab */}
        {activeTab === 'creators' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-purple-300 flex items-center gap-2">
              <Users className="h-5 w-5" />
              クリエイター別成果報酬
            </h2>
            {creatorSummary.map((creator, i) => (
              <Card key={i} className="bg-gray-900/60 border-gray-700/50 hover:border-purple-500/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center">
                        <Users className="h-4 w-4 text-purple-300" />
                      </div>
                      <span className="font-bold text-white">{creator.creatorUsername}</span>
                    </div>
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30">
                      {formatNumber(creator.orderCount)}件
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-xs text-gray-400">売上</div>
                      <div className="text-lg font-bold text-green-300">{formatCurrency(creator.totalSales)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">数量</div>
                      <div className="text-lg font-bold text-white">{formatNumber(creator.totalQuantity)}個</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">パートナー手数料(実際)</div>
                      <div className="text-lg font-bold text-purple-300">{formatCurrency(creator.totalActPartnerCommission)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">クリエイター手数料(実際)</div>
                      <div className="text-lg font-bold text-pink-300">{formatCurrency(creator.totalActCreatorCommission)}</div>
                    </div>
                  </div>
                  {/* Proportional bar */}
                  <div className="mt-3">
                    <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-800">
                      <div
                        className="bg-green-500 rounded-full"
                        style={{ width: `${(Number(creator.totalSales) / (Number(summary?.totalSales) || 1)) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      売上シェア: {((Number(creator.totalSales) / (Number(summary?.totalSales) || 1)) * 100).toFixed(1)}%
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Shops Tab */}
        {activeTab === 'shops' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-blue-300 flex items-center gap-2">
              <Store className="h-5 w-5" />
              ショップ別売上 ({shopSummary.length}店舗)
            </h2>
            <div className="space-y-2">
              {shopSummary.map((shop, i) => (
                <Card key={i} className="bg-gray-900/60 border-gray-700/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                        <span className="font-medium text-white truncate">{shop.shopName || '不明'}</span>
                        <span className="text-xs text-gray-500">{shop.shopCode}</span>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-xs ml-2">
                        {formatNumber(shop.orderCount)}件
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">売上</div>
                        <div className="font-medium text-green-300">{formatCurrency(shop.totalSales)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">数量</div>
                        <div className="font-medium text-white">{formatNumber(shop.totalQuantity)}個</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">パートナー手数料</div>
                        <div className="font-medium text-purple-300">{formatCurrency(shop.totalActPartnerCommission)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">クリエイター手数料</div>
                        <div className="font-medium text-pink-300">{formatCurrency(shop.totalActCreatorCommission)}</div>
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                        style={{ width: `${(Number(shop.totalSales) / maxShopSales) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-green-300 flex items-center gap-2">
              <Package className="h-5 w-5" />
              商品別売上 ({productSummary.length}商品)
            </h2>
            <div className="space-y-2">
              {productSummary.map((product, i) => (
                <Card key={i} className="bg-gray-900/60 border-gray-700/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                          <span className="font-medium text-white text-sm line-clamp-2">{product.productName}</span>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-300 border-green-400/30 text-xs ml-2 shrink-0">
                        {formatNumber(product.orderCount)}件
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">売上</div>
                        <div className="font-medium text-green-300">{formatCurrency(product.totalSales)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">数量</div>
                        <div className="font-medium text-white">{formatNumber(product.totalQuantity)}個</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">平均単価</div>
                        <div className="font-medium text-amber-300">{formatCurrency(product.avgPrice)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">パートナー手数料</div>
                        <div className="font-medium text-purple-300">{formatCurrency(product.totalActPartnerCommission)}</div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                        style={{ width: `${(Number(product.totalSales) / maxProductSales) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Daily Tab */}
        {activeTab === 'daily' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-cyan-300 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              日別推移 ({dailySummary.length}日間)
            </h2>
            {/* Simple bar chart */}
            <Card className="bg-gray-900/60 border-gray-700/50">
              <CardContent className="p-4">
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {dailySummary.map((day, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span className="text-xs text-gray-400 w-20 shrink-0">
                        {day.date ? new Date(day.date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '-'}
                      </span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-5 rounded bg-gray-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-600 to-blue-600 rounded"
                            style={{ width: `${(Number(day.totalSales) / maxDailySales) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-green-300 w-24 text-right">{formatCurrency(day.totalSales)}</span>
                        <span className="text-xs text-gray-400 w-12 text-right">{day.orderCount}件</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Daily detail table */}
            <Card className="bg-gray-900/60 border-gray-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-300">日別詳細データ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/50">
                        <th className="text-left py-2 px-2 text-gray-400">日付</th>
                        <th className="text-right py-2 px-2 text-gray-400">注文数</th>
                        <th className="text-right py-2 px-2 text-gray-400">売上</th>
                        <th className="text-right py-2 px-2 text-gray-400">数量</th>
                        <th className="text-right py-2 px-2 text-gray-400">パートナー手数料</th>
                        <th className="text-right py-2 px-2 text-gray-400">クリエイター手数料</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummary.map((day, i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 px-2 text-white">
                            {day.date ? new Date(day.date + 'T00:00:00').toLocaleDateString('ja-JP') : '-'}
                          </td>
                          <td className="py-2 px-2 text-right text-blue-300">{formatNumber(day.orderCount)}</td>
                          <td className="py-2 px-2 text-right text-green-300">{formatCurrency(day.totalSales)}</td>
                          <td className="py-2 px-2 text-right text-white">{formatNumber(day.totalQuantity)}</td>
                          <td className="py-2 px-2 text-right text-purple-300">{formatCurrency(day.totalActPartnerCommission)}</td>
                          <td className="py-2 px-2 text-right text-pink-300">{formatCurrency(day.totalActCreatorCommission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              注文明細 {ordersData && `(${formatNumber(ordersData.total)}件)`}
            </h2>
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="商品名・ショップ名・注文IDで検索..."
                  value={orderSearch}
                  onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(0); }}
                  className="pl-10 bg-gray-900/60 border-gray-700/50 text-white placeholder:text-gray-500"
                />
              </div>
              <Select value={orderCreator} onValueChange={(v) => { setOrderCreator(v === 'all' ? '' : v); setOrderPage(0); }}>
                <SelectTrigger className="w-[180px] bg-gray-900/60 border-gray-700/50 text-white">
                  <SelectValue placeholder="クリエイター" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全クリエイター</SelectItem>
                  {creatorSummary.map(c => (
                    <SelectItem key={c.creatorUsername} value={c.creatorUsername}>{c.creatorUsername}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={orderContentType} onValueChange={(v) => { setOrderContentType(v === 'all' ? '' : v); setOrderPage(0); }}>
                <SelectTrigger className="w-[140px] bg-gray-900/60 border-gray-700/50 text-white">
                  <SelectValue placeholder="タイプ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全タイプ</SelectItem>
                  <SelectItem value="LIVE">LIVE</SelectItem>
                  <SelectItem value="ショーケース">ショーケース</SelectItem>
                  <SelectItem value="動画">動画</SelectItem>
                </SelectContent>
              </Select>
              <Select value={orderStatus} onValueChange={(v) => { setOrderStatus(v === 'all' ? '' : v); setOrderPage(0); }}>
                <SelectTrigger className="w-[120px] bg-gray-900/60 border-gray-700/50 text-white">
                  <SelectValue placeholder="状況" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全状況</SelectItem>
                  <SelectItem value="完了">完了</SelectItem>
                  <SelectItem value="処理中">処理中</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Orders Table */}
            <Card className="bg-gray-900/60 border-gray-700/50">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/50 bg-gray-800/30">
                        <th className="text-left py-2 px-3 text-gray-400">注文ID</th>
                        <th className="text-left py-2 px-3 text-gray-400">商品名</th>
                        <th className="text-left py-2 px-3 text-gray-400">クリエイター</th>
                        <th className="text-left py-2 px-3 text-gray-400">ショップ</th>
                        <th className="text-right py-2 px-3 text-gray-400">価格</th>
                        <th className="text-right py-2 px-3 text-gray-400">数量</th>
                        <th className="text-left py-2 px-3 text-gray-400">タイプ</th>
                        <th className="text-left py-2 px-3 text-gray-400">状況</th>
                        <th className="text-right py-2 px-3 text-gray-400">パートナー手数料</th>
                        <th className="text-right py-2 px-3 text-gray-400">クリエイター手数料</th>
                        <th className="text-center py-2 px-3 text-gray-400">詳細</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersData?.rows.map((order: any, i: number) => (
                        <tr key={order.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 px-3 text-blue-300 text-xs font-mono">{String(order.orderId).slice(-8)}</td>
                          <td className="py-2 px-3 text-white max-w-[200px] truncate">{order.productName}</td>
                          <td className="py-2 px-3 text-purple-300 text-xs">{order.creatorUsername}</td>
                          <td className="py-2 px-3 text-gray-300 text-xs max-w-[120px] truncate">{order.shopName}</td>
                          <td className="py-2 px-3 text-right text-green-300">{formatCurrency(order.price)}</td>
                          <td className="py-2 px-3 text-right text-white">{order.quantity}</td>
                          <td className="py-2 px-3">
                            <Badge className={`text-xs ${
                              order.contentType === 'LIVE' ? 'bg-red-500/20 text-red-300 border-red-400/30' :
                              order.contentType === 'ショーケース' ? 'bg-blue-500/20 text-blue-300 border-blue-400/30' :
                              'bg-green-500/20 text-green-300 border-green-400/30'
                            }`}>
                              {order.contentType}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <Badge className={`text-xs ${
                              order.orderStatus === '完了' ? 'bg-green-500/20 text-green-300 border-green-400/30' :
                              'bg-amber-500/20 text-amber-300 border-amber-400/30'
                            }`}>
                              {order.orderStatus === '完了' ? <CheckCircle className="h-3 w-3 mr-1 inline" /> : <Clock className="h-3 w-3 mr-1 inline" />}
                              {order.orderStatus}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right text-purple-300">{formatCurrency(order.actualPartnerCommission)}</td>
                          <td className="py-2 px-3 text-right text-pink-300">{formatCurrency(order.actualCreatorCommission)}</td>
                          <td className="py-2 px-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedOrder(order); setOrderDetailOpen(true); }}
                              className="text-gray-400 hover:text-white h-7 w-7 p-0"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {ordersData && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
                    <span className="text-sm text-gray-400">
                      {orderPage * 50 + 1} - {Math.min((orderPage + 1) * 50, ordersData.total)} / {formatNumber(ordersData.total)}件
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrderPage(p => Math.max(0, p - 1))}
                        disabled={orderPage === 0}
                        className="border-gray-700 text-gray-300"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrderPage(p => p + 1)}
                        disabled={(orderPage + 1) * 50 >= ordersData.total}
                        className="border-gray-700 text-gray-300"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Imports Tab */}
        {activeTab === 'imports' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-300 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                インポート履歴
              </h2>
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
              >
                <Upload className="h-4 w-4 mr-1" />
                新規アップロード
              </Button>
            </div>
            {importHistory.length === 0 ? (
              <Card className="bg-gray-900/60 border-gray-700/50">
                <CardContent className="p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">まだCSVファイルがアップロードされていません</p>
                  <p className="text-gray-500 text-sm mt-1">TikTok成果報酬CSVをアップロードしてデータを分析しましょう</p>
                </CardContent>
              </Card>
            ) : (
              importHistory.map((imp: any) => (
                <Card key={imp.id} className="bg-gray-900/60 border-gray-700/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-400" />
                        <span className="font-medium text-white">{imp.fileName}</span>
                        <Badge className={`text-xs ${
                          imp.status === 'completed' ? 'bg-green-500/20 text-green-300 border-green-400/30' :
                          imp.status === 'failed' ? 'bg-red-500/20 text-red-300 border-red-400/30' :
                          'bg-amber-500/20 text-amber-300 border-amber-400/30'
                        }`}>
                          {imp.status === 'completed' ? '完了' : imp.status === 'failed' ? '失敗' : '処理中'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDeleteImportId(imp.id); setDeleteDialogOpen(true); }}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">総行数</div>
                        <div className="text-white">{formatNumber(imp.totalRows)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">インポート成功</div>
                        <div className="text-green-300">{formatNumber(imp.importedRows)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">スキップ(重複)</div>
                        <div className="text-amber-300">{formatNumber(imp.skippedRows)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">売上合計</div>
                        <div className="text-green-300">{formatCurrency(imp.totalSales)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">アップロード日時</div>
                        <div className="text-gray-300">{new Date(imp.createdAt).toLocaleString('ja-JP')}</div>
                      </div>
                    </div>
                    {imp.errorMessage && (
                      <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-xs">
                        {imp.errorMessage}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* No data state */}
        {activeTab === 'summary' && !summary && (
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardContent className="p-8 text-center">
              <BarChart3 className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">データがありません</p>
              <p className="text-gray-500 text-sm mt-1">CSVファイルをアップロードしてください</p>
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white"
              >
                <Upload className="h-4 w-4 mr-1" />
                CSVアップロード
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-purple-400" />
              TikTok成果報酬CSVアップロード
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              TikTokアフィリエイトの成果報酬CSVファイルを選択してください。重複データは自動的にスキップされます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-purple-500/30 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-900/10 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              {csvUploading ? (
                <>
                  <Loader2 className="h-10 w-10 text-purple-400 mx-auto mb-3 animate-spin" />
                  <p className="text-purple-300">アップロード中...</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-300">クリックしてCSVファイルを選択</p>
                  <p className="text-gray-500 text-xs mt-1">UTF-8エンコードのCSVファイル</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={csvUploading}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
              disabled={csvUploading}
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              インポートデータの削除
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              このインポートに関連する全ての注文データも削除されます。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              キャンセル
            </Button>
            <Button
              onClick={() => deleteImportId && deleteMutation.mutate({ importId: deleteImportId })}
              className="bg-red-600 hover:bg-red-500 text-white"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Dialog */}
      <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-400" />
              注文詳細
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-gray-500">注文ID</div>
                    <div className="text-white font-mono text-sm">{selectedOrder.orderId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">サブ注文ID</div>
                    <div className="text-white font-mono text-sm">{selectedOrder.subOrderId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">注文状況</div>
                    <Badge className={selectedOrder.orderStatus === '完了' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}>
                      {selectedOrder.orderStatus}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-gray-500">クリエイター</div>
                    <div className="text-purple-300">{selectedOrder.creatorUsername}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">コンテンツタイプ</div>
                    <div className="text-white">{selectedOrder.contentType}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">プラットフォーム</div>
                    <div className="text-white">{selectedOrder.platform || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">商品名</div>
                <div className="text-white text-sm">{selectedOrder.productName}</div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <div className="text-xs text-gray-500">SKU</div>
                    <div className="text-gray-300 text-sm">{selectedOrder.sku || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">価格</div>
                    <div className="text-green-300 font-medium">{formatCurrency(selectedOrder.price)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">数量</div>
                    <div className="text-white font-medium">{selectedOrder.quantity}</div>
                  </div>
                </div>
              </div>

              {/* Shop Info */}
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-500">ショップ名</div>
                    <div className="text-white text-sm">{selectedOrder.shopName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ショップコード</div>
                    <div className="text-gray-300 text-sm">{selectedOrder.shopCode}</div>
                  </div>
                </div>
              </div>

              {/* Commission Rates */}
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="text-xs text-gray-400 mb-2 font-medium">成果報酬率</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-gray-500">パートナー報酬率</div>
                    <div className="text-purple-300">{selectedOrder.partnerCommissionRate ? `${selectedOrder.partnerCommissionRate}%` : '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">クリエイター報酬率</div>
                    <div className="text-pink-300">{selectedOrder.creatorCommissionRate ? `${selectedOrder.creatorCommissionRate}%` : '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">推定報酬ベース</div>
                    <div className="text-white">{formatCurrency(selectedOrder.estimatedCommissionBase)}</div>
                  </div>
                </div>
              </div>

              {/* Actual Commissions */}
              <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                <div className="text-xs text-purple-300 mb-2 font-medium">実際の手数料</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">パートナー手数料</div>
                    <div className="text-purple-300 font-bold">{formatCurrency(selectedOrder.actualPartnerCommission)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">推定: {formatCurrency(selectedOrder.estimatedPartnerCommission)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">クリエイター手数料</div>
                    <div className="text-pink-300 font-bold">{formatCurrency(selectedOrder.actualCreatorCommission)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">推定: {formatCurrency(selectedOrder.estimatedCreatorCommission)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">パートナーリワード</div>
                    <div className="text-amber-300">{formatCurrency(selectedOrder.actualPartnerReward)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">クリエイターリワード</div>
                    <div className="text-cyan-300">{formatCurrency(selectedOrder.actualCreatorReward)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ショップ広告報酬(パートナー)</div>
                    <div className="text-orange-300">{formatCurrency(selectedOrder.actualPartnerShopAdPay)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ショップ広告報酬(クリエイター)</div>
                    <div className="text-lime-300">{formatCurrency(selectedOrder.actualCreatorShopAdPay)}</div>
                  </div>
                </div>
              </div>

              {/* Return/Refund */}
              {(selectedOrder.returnQuantity > 0 || selectedOrder.refundQuantity > 0) && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <div className="text-xs text-red-300 mb-2 font-medium">返品・返金</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-gray-500">返品数量</div>
                      <div className="text-red-300">{selectedOrder.returnQuantity}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">返金数量</div>
                      <div className="text-red-300">{selectedOrder.refundQuantity}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="text-xs text-gray-400 mb-2 font-medium">日時情報</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-gray-500">注文作成</div>
                    <div className="text-white text-sm">{selectedOrder.orderCreatedAt ? new Date(selectedOrder.orderCreatedAt).toLocaleString('ja-JP') : '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">配達日時</div>
                    <div className="text-white text-sm">{selectedOrder.orderDeliveredAt ? new Date(selectedOrder.orderDeliveredAt).toLocaleString('ja-JP') : '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">決済日時</div>
                    <div className="text-white text-sm">{selectedOrder.commissionSettledAt ? new Date(selectedOrder.commissionSettledAt).toLocaleString('ja-JP') : '-'}</div>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="text-xs text-gray-400 mb-2 font-medium">支払い情報</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-gray-500">支払いID</div>
                    <div className="text-white text-sm font-mono">{selectedOrder.paymentId || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">支払い方法</div>
                    <div className="text-white text-sm">{selectedOrder.paymentMethod || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">支払い口座</div>
                    <div className="text-white text-sm">{selectedOrder.paymentAccount || '-'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOrderDetailOpen(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
