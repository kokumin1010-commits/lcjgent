import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload, DollarSign, Package, Users, ShoppingCart,
  TrendingUp, FileText, Trash2, Search, ChevronLeft, ChevronRight,
  BarChart3, Calendar, Download, Loader2, Eye, RefreshCw,
  Store, Video, ShoppingBag, AlertTriangle, CheckCircle, Clock,
  Wallet, Building2, ArrowUpRight
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

export default function FinanceManagement() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [csvUploading, setCsvUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteImportId, setDeleteImportId] = useState<number | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Order list state
  const [orderPage, setOrderPage] = useState(0);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderCreator, setOrderCreator] = useState("");
  const [orderShop, setOrderShop] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderContentType, setOrderContentType] = useState("");
  const pageSize = 50;

  // Get brands list
  const brandsQuery = trpc.brand.list.useQuery();
  const brands = brandsQuery.data || [];

  // Use first brand as default if not selected
  const activeBrandId = selectedBrandId || (brands.length > 0 ? brands[0].id : 0);

  // Queries - all depend on activeBrandId
  const summaryQuery = trpc.tiktokFinance.getSummary.useQuery(
    { brandId: activeBrandId },
    { enabled: activeBrandId > 0 }
  );
  const creatorsQuery = trpc.tiktokFinance.getCreatorSummary.useQuery(
    { brandId: activeBrandId },
    { enabled: activeBrandId > 0 && activeTab === 'creators' }
  );
  const shopsQuery = trpc.tiktokFinance.getShopSummary.useQuery(
    { brandId: activeBrandId },
    { enabled: activeBrandId > 0 && activeTab === 'shops' }
  );
  const productsQuery = trpc.tiktokFinance.getProductSummary.useQuery(
    { brandId: activeBrandId },
    { enabled: activeBrandId > 0 && activeTab === 'products' }
  );
  const dailyQuery = trpc.tiktokFinance.getDailySummary.useQuery(
    { brandId: activeBrandId },
    { enabled: activeBrandId > 0 && activeTab === 'daily' }
  );
  const ordersQuery = trpc.tiktokFinance.getOrders.useQuery(
    {
      brandId: activeBrandId,
      limit: pageSize,
      offset: orderPage * pageSize,
      search: orderSearch || undefined,
      creatorUsername: orderCreator || undefined,
      shopName: orderShop || undefined,
      orderStatus: orderStatus || undefined,
      contentType: orderContentType || undefined,
    },
    { enabled: activeBrandId > 0 && activeTab === 'orders' }
  );
  const importsQuery = trpc.tiktokFinance.getImportHistory.useQuery(
    { brandId: activeBrandId },
    { enabled: activeBrandId > 0 && activeTab === 'imports' }
  );

  const uploadMutation = trpc.tiktokFinance.uploadCsv.useMutation({
    onSuccess: (data) => {
      toast.success(`CSVインポート完了: ${data.importedRows}件追加、${data.skippedRows}件スキップ`);
      setUploadDialogOpen(false);
      summaryQuery.refetch();
      importsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.tiktokFinance.deleteImport.useMutation({
    onSuccess: () => {
      toast.success("インポートデータを削除しました");
      setDeleteDialogOpen(false);
      setDeleteImportId(null);
      summaryQuery.refetch();
      importsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const utils = trpc.useUtils();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeBrandId <= 0) return;

    setCsvUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const result = event.target?.result as string;
            const b64 = result.split(",")[1];
            if (!b64) reject(new Error("ファイルの読み込みに失敗しました"));
            else resolve(b64);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
        reader.readAsDataURL(file);
      });

      await uploadMutation.mutateAsync({
        brandId: activeBrandId,
        fileName: file.name,
        csvContent: base64,
      });
    } catch (err: any) {
      console.error("CSV upload error:", err);
      toast.error(err?.message || "CSVアップロードに失敗しました");
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const summary = summaryQuery.data;
  const creators = creatorsQuery.data || [];
  const shops = shopsQuery.data || [];
  const products = productsQuery.data || [];
  const daily = dailyQuery.data || [];
  const orders = ordersQuery.data;
  const imports = importsQuery.data || [];

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            ファイナンス管理
          </h1>
          <p className="text-muted-foreground text-sm mt-1">TikTok成果報酬の分析・管理</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Brand selector */}
          <Select
            value={activeBrandId > 0 ? String(activeBrandId) : ""}
            onValueChange={(v) => {
              setSelectedBrandId(parseInt(v));
              setOrderPage(0);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="ブランドを選択" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b: any) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    {b.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setUploadDialogOpen(true)} disabled={activeBrandId <= 0}>
            <Upload className="h-4 w-4 mr-2" />
            CSVアップロード
          </Button>
        </div>
      </div>

      {activeBrandId <= 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>ブランドを選択してください</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 border-b">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setOrderPage(0); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {summaryQuery.isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : summary ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          総売上
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(summary.totalSales)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <Users className="h-3.5 w-3.5" />
                          パートナー手数料
                        </div>
                        <p className="text-xl font-bold text-blue-600">{formatCurrency(summary.totalActPartnerCommission)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <Video className="h-3.5 w-3.5" />
                          クリエイター手数料
                        </div>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(summary.totalActCreatorCommission)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <ShoppingCart className="h-3.5 w-3.5" />
                          注文数
                        </div>
                        <p className="text-xl font-bold">{formatNumber(summary.totalOrders)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <Package className="h-3.5 w-3.5" />
                          総数量
                        </div>
                        <p className="text-xl font-bold">{formatNumber(summary.totalQuantity)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Additional stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="text-muted-foreground text-xs mb-1">平均単価</div>
                        <p className="text-lg font-semibold">{formatCurrency(summary.avgPrice)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="text-muted-foreground text-xs mb-1">完了注文</div>
                        <p className="text-lg font-semibold text-green-600">{formatNumber(summary.completedOrders)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="text-muted-foreground text-xs mb-1">返品数量</div>
                        <p className="text-lg font-semibold text-orange-600">{formatNumber(summary.totalReturnQty)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="text-muted-foreground text-xs mb-1">返金数量</div>
                        <p className="text-lg font-semibold text-red-600">{formatNumber(summary.totalRefundQty)}</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Upload className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>データがありません。CSVをアップロードしてください。</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Creators Tab */}
          {activeTab === 'creators' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  クリエイター別成果報酬
                </CardTitle>
              </CardHeader>
              <CardContent>
                {creatorsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : creators.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">クリエイター</th>
                          <th className="pb-2 font-medium text-right">注文数</th>
                          <th className="pb-2 font-medium text-right">売上</th>
                          <th className="pb-2 font-medium text-right">パートナー手数料</th>
                          <th className="pb-2 font-medium text-right">クリエイター手数料</th>
                          <th className="pb-2 font-medium text-right">数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creators.map((c: any, i: number) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2 font-medium">{c.creatorUsername}</td>
                            <td className="py-2 text-right">{formatNumber(c.orderCount)}</td>
                            <td className="py-2 text-right">{formatCurrency(c.totalSales)}</td>
                            <td className="py-2 text-right text-blue-600">{formatCurrency(c.totalPartnerCommission)}</td>
                            <td className="py-2 text-right text-green-600">{formatCurrency(c.totalCreatorCommission)}</td>
                            <td className="py-2 text-right">{formatNumber(c.totalQuantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Shops Tab */}
          {activeTab === 'shops' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  ショップ別売上
                </CardTitle>
              </CardHeader>
              <CardContent>
                {shopsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : shops.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">ショップ名</th>
                          <th className="pb-2 font-medium text-right">注文数</th>
                          <th className="pb-2 font-medium text-right">売上</th>
                          <th className="pb-2 font-medium text-right">パートナー手数料</th>
                          <th className="pb-2 font-medium text-right">クリエイター手数料</th>
                          <th className="pb-2 font-medium text-right">数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shops.map((s: any, i: number) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2 font-medium">{s.shopName || "不明"}</td>
                            <td className="py-2 text-right">{formatNumber(s.orderCount)}</td>
                            <td className="py-2 text-right">{formatCurrency(s.totalSales)}</td>
                            <td className="py-2 text-right text-blue-600">{formatCurrency(s.totalPartnerCommission)}</td>
                            <td className="py-2 text-right text-green-600">{formatCurrency(s.totalCreatorCommission)}</td>
                            <td className="py-2 text-right">{formatNumber(s.totalQuantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  商品別売上
                </CardTitle>
              </CardHeader>
              <CardContent>
                {productsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">商品名</th>
                          <th className="pb-2 font-medium text-right">注文数</th>
                          <th className="pb-2 font-medium text-right">売上</th>
                          <th className="pb-2 font-medium text-right">パートナー手数料</th>
                          <th className="pb-2 font-medium text-right">クリエイター手数料</th>
                          <th className="pb-2 font-medium text-right">数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p: any, i: number) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2 font-medium max-w-[300px] truncate" title={p.productName}>{p.productName}</td>
                            <td className="py-2 text-right">{formatNumber(p.orderCount)}</td>
                            <td className="py-2 text-right">{formatCurrency(p.totalSales)}</td>
                            <td className="py-2 text-right text-blue-600">{formatCurrency(p.totalPartnerCommission)}</td>
                            <td className="py-2 text-right text-green-600">{formatCurrency(p.totalCreatorCommission)}</td>
                            <td className="py-2 text-right">{formatNumber(p.totalQuantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Daily Tab */}
          {activeTab === 'daily' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  日別推移
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : daily.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">日付</th>
                          <th className="pb-2 font-medium text-right">注文数</th>
                          <th className="pb-2 font-medium text-right">売上</th>
                          <th className="pb-2 font-medium text-right">パートナー手数料</th>
                          <th className="pb-2 font-medium text-right">クリエイター手数料</th>
                          <th className="pb-2 font-medium text-right">数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {daily.map((d: any, i: number) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2 font-medium">{d.date}</td>
                            <td className="py-2 text-right">{formatNumber(d.orderCount)}</td>
                            <td className="py-2 text-right">{formatCurrency(d.totalSales)}</td>
                            <td className="py-2 text-right text-blue-600">{formatCurrency(d.totalPartnerCommission)}</td>
                            <td className="py-2 text-right text-green-600">{formatCurrency(d.totalCreatorCommission)}</td>
                            <td className="py-2 text-right">{formatNumber(d.totalQuantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  注文明細
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="注文ID・商品名で検索..."
                      value={orderSearch}
                      onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(0); }}
                      className="pl-9"
                    />
                  </div>
                  <Select value={orderCreator} onValueChange={(v) => { setOrderCreator(v === "all" ? "" : v); setOrderPage(0); }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="クリエイター" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全クリエイター</SelectItem>
                      {creators.map((c: any) => (
                        <SelectItem key={c.creatorUsername} value={c.creatorUsername}>{c.creatorUsername}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={orderStatus} onValueChange={(v) => { setOrderStatus(v === "all" ? "" : v); setOrderPage(0); }}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="注文状況" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全状況</SelectItem>
                      <SelectItem value="完了">完了</SelectItem>
                      <SelectItem value="処理中">処理中</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Orders table */}
                {ordersQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : orders && orders.rows.length > 0 ? (
                  <>
                    <div className="text-sm text-muted-foreground">
                      全{formatNumber(orders.total)}件中 {orderPage * pageSize + 1}-{Math.min((orderPage + 1) * pageSize, orders.total)}件表示
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2 font-medium">注文ID</th>
                            <th className="pb-2 font-medium">クリエイター</th>
                            <th className="pb-2 font-medium">商品名</th>
                            <th className="pb-2 font-medium text-right">価格</th>
                            <th className="pb-2 font-medium text-right">数量</th>
                            <th className="pb-2 font-medium">ショップ</th>
                            <th className="pb-2 font-medium">状況</th>
                            <th className="pb-2 font-medium text-right">パートナー手数料</th>
                            <th className="pb-2 font-medium text-right">クリエイター手数料</th>
                            <th className="pb-2 font-medium">作成日</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.rows.map((o: any) => (
                            <tr key={o.id} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-1.5 font-mono text-[10px]">{o.subOrderId?.slice(-8)}</td>
                              <td className="py-1.5">{o.creatorUsername}</td>
                              <td className="py-1.5 max-w-[200px] truncate" title={o.productName}>{o.productName}</td>
                              <td className="py-1.5 text-right">{formatCurrency(o.price)}</td>
                              <td className="py-1.5 text-right">{o.quantity}</td>
                              <td className="py-1.5 max-w-[120px] truncate">{o.shopName}</td>
                              <td className="py-1.5">
                                <Badge variant={o.orderStatus === '完了' ? 'default' : 'secondary'} className="text-[10px]">
                                  {o.orderStatus}
                                </Badge>
                              </td>
                              <td className="py-1.5 text-right text-blue-600">{formatCurrency(o.actualPartnerCommission)}</td>
                              <td className="py-1.5 text-right text-green-600">{formatCurrency(o.actualCreatorCommission)}</td>
                              <td className="py-1.5 text-[10px]">
                                {o.orderCreatedAt ? new Date(o.orderCreatedAt).toLocaleDateString('ja-JP') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={orderPage === 0}
                        onClick={() => setOrderPage(p => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        前へ
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        ページ {orderPage + 1} / {Math.ceil(orders.total / pageSize)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(orderPage + 1) * pageSize >= orders.total}
                        onClick={() => setOrderPage(p => p + 1)}
                      >
                        次へ
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">注文データがありません</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Imports Tab */}
          {activeTab === 'imports' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  インポート履歴
                </CardTitle>
              </CardHeader>
              <CardContent>
                {importsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : imports.length > 0 ? (
                  <div className="space-y-3">
                    {imports.map((imp: any) => (
                      <div key={imp.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{imp.fileName}</span>
                            <Badge variant={imp.status === 'completed' ? 'default' : imp.status === 'failed' ? 'destructive' : 'secondary'}>
                              {imp.status === 'completed' ? '完了' : imp.status === 'failed' ? '失敗' : '処理中'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                            <span>インポート: {imp.importedRows || 0}件</span>
                            {imp.skippedRows > 0 && <span>スキップ: {imp.skippedRows}件</span>}
                            <span>売上: {formatCurrency(imp.totalSales)}</span>
                            <span>{new Date(imp.createdAt).toLocaleString('ja-JP')}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setDeleteImportId(imp.id); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">インポート履歴がありません</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSVファイルをアップロード</DialogTitle>
            <DialogDescription>TikTok成果報酬のCSVファイルを選択してください。重複データは自動的にスキップされます。</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              disabled={csvUploading}
            />
          </div>
          {csvUploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              インポート中...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>インポートデータの削除</DialogTitle>
            <DialogDescription>このインポートのデータを全て削除しますか？この操作は取り消せません。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
            <Button
              variant="destructive"
              onClick={() => deleteImportId && deleteMutation.mutate({ importId: deleteImportId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
