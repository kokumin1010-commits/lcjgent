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
  TrendingUp, TrendingDown, FileText, Trash2, Search,
  ChevronLeft, ChevronRight, BarChart3, Calendar, Download,
  Loader2, Eye, RefreshCw, Store, Video, ShoppingBag,
  AlertTriangle, CheckCircle, Clock, Wallet, Building2,
  ArrowUpRight, ArrowDownRight, Crown, Medal, Award
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
function getChangePercent(current: number, previous: number): { value: number; isUp: boolean } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, isUp: current > 0 };
  const change = ((current - previous) / previous) * 100;
  return { value: Math.abs(change), isUp: change >= 0 };
}
function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ value, label });
  }
  return options;
}
function getPrevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type TabType = 'dashboard' | 'creators' | 'shops' | 'products' | 'daily' | 'orders' | 'imports';

export default function FinanceManagement() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [csvUploading, setCsvUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteImportId, setDeleteImportId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orderPage, setOrderPage] = useState(0);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderCreator, setOrderCreator] = useState("");
  const [orderShop, setOrderShop] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderContentType, setOrderContentType] = useState("");
  const pageSize = 50;

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const prevMonth = selectedMonth ? getPrevMonth(selectedMonth) : undefined;

  // Queries - all cross-brand (brandId=0)
  const summaryQuery = trpc.tiktokFinance.getSummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: true }
  );
  const prevSummaryQuery = trpc.tiktokFinance.getSummary.useQuery(
    { brandId: 0, month: prevMonth },
    { enabled: !!prevMonth }
  );
  const monthlyQuery = trpc.tiktokFinance.getMonthlySummary.useQuery(
    { brandId: 0 },
    { enabled: activeTab === 'dashboard' }
  );
  const creatorsQuery = trpc.tiktokFinance.getCreatorSummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: activeTab === 'dashboard' || activeTab === 'creators' }
  );
  const shopsQuery = trpc.tiktokFinance.getShopSummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: activeTab === 'dashboard' || activeTab === 'shops' }
  );
  const productsQuery = trpc.tiktokFinance.getProductSummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: activeTab === 'products' }
  );
  const dailyQuery = trpc.tiktokFinance.getDailySummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: activeTab === 'daily' }
  );
  const ordersQuery = trpc.tiktokFinance.getOrders.useQuery(
    {
      brandId: 0,
      limit: pageSize,
      offset: orderPage * pageSize,
      search: orderSearch || undefined,
      creatorUsername: orderCreator || undefined,
      shopName: orderShop || undefined,
      orderStatus: orderStatus || undefined,
      contentType: orderContentType || undefined,
    },
    { enabled: activeTab === 'orders' }
  );
  const importsQuery = trpc.tiktokFinance.getImportHistory.useQuery(
    { brandId: 0 },
    { enabled: activeTab === 'imports' }
  );

  const deleteMutation = trpc.tiktokFinance.deleteImport.useMutation({
    onSuccess: () => {
      toast.success("インポートデータを削除しました");
      setDeleteDialogOpen(false);
      setDeleteImportId(null);
      summaryQuery.refetch();
      importsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`削除に失敗: ${error.message}`);
    },
  });

  const summary = summaryQuery.data;
  const prevSummary = prevSummaryQuery.data;
  const creators = creatorsQuery.data || [];
  const shops = shopsQuery.data || [];
  const monthly = monthlyQuery.data || [];

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("brandId", "0");
      const res = await fetch("/api/tiktok-csv-upload", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Upload failed");
      toast.success(`${result.importedRows}件インポート（${result.skippedRows}件スキップ）`);
      summaryQuery.refetch();
      importsQuery.refetch();
      setUploadDialogOpen(false);
    } catch (err: any) {
      toast.error(`アップロード失敗: ${err.message}`);
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Change indicators
  const salesChange = summary && prevSummary
    ? getChangePercent(Number(summary.totalSales), Number(prevSummary.totalSales))
    : null;
  const commissionChange = summary && prevSummary
    ? getChangePercent(
        Number(summary.totalActPartnerCommission) + Number(summary.totalActCreatorCommission),
        Number(prevSummary.totalActPartnerCommission) + Number(prevSummary.totalActCreatorCommission)
      )
    : null;
  const ordersChange = summary && prevSummary
    ? getChangePercent(Number(summary.totalOrders), Number(prevSummary.totalOrders))
    : null;

  const rankIcons = [
    <Crown className="h-4 w-4 text-yellow-500" />,
    <Medal className="h-4 w-4 text-gray-400" />,
    <Award className="h-4 w-4 text-amber-600" />,
  ];

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'ダッシュボード', icon: BarChart3 },
    { key: 'creators', label: 'クリエイター', icon: Users },
    { key: 'shops', label: 'ショップ', icon: Store },
    { key: 'products', label: '商品', icon: ShoppingBag },
    { key: 'daily', label: '日別推移', icon: Calendar },
    { key: 'orders', label: '注文明細', icon: ShoppingCart },
    { key: 'imports', label: 'インポート', icon: FileText },
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
          <p className="text-muted-foreground text-sm mt-1">全ブランド横断 TikTok成果報酬ダッシュボード</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month selector */}
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v === 'all' ? '' : v); setOrderPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="全期間" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全期間</SelectItem>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setUploadDialogOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            CSVアップロード
          </Button>
        </div>
      </div>

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

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {summaryQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : summary ? (
            <>
              {/* Main KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          総売上（営業額）
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</p>
                      </div>
                      {salesChange && selectedMonth && (
                        <div className={`flex items-center gap-1 text-sm ${salesChange.isUp ? 'text-green-600' : 'text-red-500'}`}>
                          {salesChange.isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          {salesChange.value.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    {selectedMonth && prevSummary && (
                      <p className="text-xs text-muted-foreground mt-1">前月: {formatCurrency(prevSummary.totalSales)}</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          総コミッション（佣金）
                        </div>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(Number(summary.totalActPartnerCommission) + Number(summary.totalActCreatorCommission))}
                        </p>
                      </div>
                      {commissionChange && selectedMonth && (
                        <div className={`flex items-center gap-1 text-sm ${commissionChange.isUp ? 'text-green-600' : 'text-red-500'}`}>
                          {commissionChange.isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          {commissionChange.value.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>パートナー: {formatCurrency(summary.totalActPartnerCommission)}</span>
                      <span>クリエイター: {formatCurrency(summary.totalActCreatorCommission)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <ShoppingCart className="h-3.5 w-3.5" />
                          注文数
                        </div>
                        <p className="text-2xl font-bold">{formatNumber(summary.totalOrders)}</p>
                      </div>
                      {ordersChange && selectedMonth && (
                        <div className={`flex items-center gap-1 text-sm ${ordersChange.isUp ? 'text-green-600' : 'text-red-500'}`}>
                          {ordersChange.isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          {ordersChange.value.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>数量: {formatNumber(summary.totalQuantity)}</span>
                      <span>平均単価: {formatCurrency(summary.avgPrice)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Users className="h-3.5 w-3.5" />
                      アクティブ
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold">{formatNumber(summary.uniqueCreators)}</p>
                        <p className="text-xs text-muted-foreground">クリエイター</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div>
                        <p className="text-2xl font-bold">{formatNumber(summary.uniqueShops)}</p>
                        <p className="text-xs text-muted-foreground">ショップ</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Trend */}
              {monthly.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      月別推移
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 px-3">月</th>
                            <th className="text-right py-2 px-3">売上</th>
                            <th className="text-right py-2 px-3">コミッション</th>
                            <th className="text-right py-2 px-3">注文数</th>
                            <th className="text-right py-2 px-3">クリエイター</th>
                            <th className="text-right py-2 px-3">前月比</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthly.map((m: any, i: number) => {
                            const prev = i > 0 ? monthly[i - 1] : null;
                            const change = prev ? getChangePercent(Number(m.totalSales), Number(prev.totalSales)) : null;
                            return (
                              <tr key={m.month} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedMonth(m.month); }}>
                                <td className="py-2 px-3 font-medium">{m.month}</td>
                                <td className="py-2 px-3 text-right">{formatCurrency(m.totalSales)}</td>
                                <td className="py-2 px-3 text-right text-green-600">
                                  {formatCurrency(Number(m.totalActPartnerCommission) + Number(m.totalActCreatorCommission))}
                                </td>
                                <td className="py-2 px-3 text-right">{formatNumber(m.orderCount)}</td>
                                <td className="py-2 px-3 text-right">{formatNumber(m.uniqueCreators)}</td>
                                <td className="py-2 px-3 text-right">
                                  {change ? (
                                    <span className={`flex items-center justify-end gap-1 ${change.isUp ? 'text-green-600' : 'text-red-500'}`}>
                                      {change.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                      {change.value.toFixed(1)}%
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rankings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Creator Ranking */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        クリエイター売上ランキング
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab('creators')}>
                        全て見る <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {creators.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">データなし</p>
                    ) : (
                      <div className="space-y-2">
                        {creators.slice(0, 10).map((c: any, i: number) => (
                          <div key={c.creatorUsername} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/50">
                            <div className="w-6 text-center">
                              {i < 3 ? rankIcons[i] : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{c.creatorUsername || '(不明)'}</p>
                              <p className="text-xs text-muted-foreground">{formatNumber(c.orderCount)}件</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">{formatCurrency(c.totalSales)}</p>
                              <p className="text-xs text-green-600">{formatCurrency(Number(c.totalActPartnerCommission) + Number(c.totalActCreatorCommission))}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Shop Ranking */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        ショップ売上ランキング
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab('shops')}>
                        全て見る <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {shops.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">データなし</p>
                    ) : (
                      <div className="space-y-2">
                        {shops.slice(0, 10).map((s: any, i: number) => (
                          <div key={s.shopName} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/50">
                            <div className="w-6 text-center">
                              {i < 3 ? rankIcons[i] : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{s.shopName || '(不明)'}</p>
                              <p className="text-xs text-muted-foreground">{formatNumber(s.orderCount)}件</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">{formatCurrency(s.totalSales)}</p>
                              <p className="text-xs text-green-600">{formatCurrency(Number(s.totalActPartnerCommission) + Number(s.totalActCreatorCommission))}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Additional Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="text-muted-foreground text-xs mb-1">完了注文</div>
                    <p className="text-lg font-semibold text-green-600">{formatNumber(summary.completedOrders)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="text-muted-foreground text-xs mb-1">処理中</div>
                    <p className="text-lg font-semibold text-blue-600">{formatNumber(summary.processingOrders)}</p>
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
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-30" />
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
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              クリエイター別売上・コミッション
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creatorsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : creators.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">クリエイター</th>
                      <th className="text-right py-2 px-3">売上</th>
                      <th className="text-right py-2 px-3">パートナー手数料</th>
                      <th className="text-right py-2 px-3">クリエイター手数料</th>
                      <th className="text-right py-2 px-3">注文数</th>
                      <th className="text-right py-2 px-3">数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creators.map((c: any, i: number) => (
                      <tr key={c.creatorUsername} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 w-8">
                          {i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2 px-3 font-medium">{c.creatorUsername || '(不明)'}</td>
                        <td className="py-2 px-3 text-right font-semibold">{formatCurrency(c.totalSales)}</td>
                        <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(c.totalActPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(c.totalActCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.orderCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.totalQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-2 px-3" colSpan={2}>合計</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(creators.reduce((s: number, c: any) => s + Number(c.totalSales), 0))}</td>
                      <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(creators.reduce((s: number, c: any) => s + Number(c.totalActPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency(creators.reduce((s: number, c: any) => s + Number(c.totalActCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(creators.reduce((s: number, c: any) => s + Number(c.orderCount), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(creators.reduce((s: number, c: any) => s + Number(c.totalQuantity), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shops Tab */}
      {activeTab === 'shops' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" />
              ショップ別売上・コミッション
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shopsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : shops.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">ショップ</th>
                      <th className="text-right py-2 px-3">売上</th>
                      <th className="text-right py-2 px-3">パートナー手数料</th>
                      <th className="text-right py-2 px-3">クリエイター手数料</th>
                      <th className="text-right py-2 px-3">注文数</th>
                      <th className="text-right py-2 px-3">数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shops.map((s: any, i: number) => (
                      <tr key={s.shopName} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 w-8">
                          {i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2 px-3 font-medium">{s.shopName || '(不明)'}</td>
                        <td className="py-2 px-3 text-right font-semibold">{formatCurrency(s.totalSales)}</td>
                        <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(s.totalActPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(s.totalActCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(s.orderCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(s.totalQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-2 px-3" colSpan={2}>合計</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(shops.reduce((s: number, c: any) => s + Number(c.totalSales), 0))}</td>
                      <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(shops.reduce((s: number, c: any) => s + Number(c.totalActPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency(shops.reduce((s: number, c: any) => s + Number(c.totalActCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(shops.reduce((s: number, c: any) => s + Number(c.orderCount), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(shops.reduce((s: number, c: any) => s + Number(c.totalQuantity), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              商品別売上
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (productsQuery.data || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">商品名</th>
                      <th className="text-right py-2 px-3">売上</th>
                      <th className="text-right py-2 px-3">コミッション</th>
                      <th className="text-right py-2 px-3">注文数</th>
                      <th className="text-right py-2 px-3">数量</th>
                      <th className="text-right py-2 px-3">平均単価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(productsQuery.data || []).map((p: any, i: number) => (
                      <tr key={p.productId || i} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 w-8">
                          {i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2 px-3 font-medium max-w-[300px] truncate">{p.productName || '(不明)'}</td>
                        <td className="py-2 px-3 text-right font-semibold">{formatCurrency(p.totalSales)}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(Number(p.totalActPartnerCommission) + Number(p.totalActCreatorCommission))}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(p.orderCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(p.totalQuantity)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(p.avgPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Tab */}
      {activeTab === 'daily' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              日別推移
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (dailyQuery.data || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">日付</th>
                      <th className="text-right py-2 px-3">売上</th>
                      <th className="text-right py-2 px-3">パートナー手数料</th>
                      <th className="text-right py-2 px-3">クリエイター手数料</th>
                      <th className="text-right py-2 px-3">注文数</th>
                      <th className="text-right py-2 px-3">数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dailyQuery.data || []).map((d: any) => (
                      <tr key={d.date} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium">{d.date}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(d.totalSales)}</td>
                        <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(d.totalActPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(d.totalActCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(d.orderCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(d.totalQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              注文明細
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              <Input
                placeholder="検索（注文ID・商品名）"
                value={orderSearch}
                onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(0); }}
                className="w-[200px]"
              />
              <Input
                placeholder="クリエイター"
                value={orderCreator}
                onChange={(e) => { setOrderCreator(e.target.value); setOrderPage(0); }}
                className="w-[150px]"
              />
              <Input
                placeholder="ショップ"
                value={orderShop}
                onChange={(e) => { setOrderShop(e.target.value); setOrderPage(0); }}
                className="w-[150px]"
              />
            </div>
            {ordersQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-2">注文日</th>
                        <th className="text-left py-2 px-2">商品名</th>
                        <th className="text-left py-2 px-2">クリエイター</th>
                        <th className="text-left py-2 px-2">ショップ</th>
                        <th className="text-right py-2 px-2">金額</th>
                        <th className="text-right py-2 px-2">数量</th>
                        <th className="text-right py-2 px-2">P手数料</th>
                        <th className="text-right py-2 px-2">C手数料</th>
                        <th className="text-center py-2 px-2">ステータス</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ordersQuery.data?.rows || []).map((o: any) => (
                        <tr key={o.id} className="border-b hover:bg-muted/50">
                          <td className="py-1.5 px-2">{o.orderCreatedAt ? new Date(o.orderCreatedAt).toLocaleDateString('ja-JP') : '-'}</td>
                          <td className="py-1.5 px-2 max-w-[200px] truncate">{o.productName || '-'}</td>
                          <td className="py-1.5 px-2">{o.creatorUsername || '-'}</td>
                          <td className="py-1.5 px-2">{o.shopName || '-'}</td>
                          <td className="py-1.5 px-2 text-right">{formatCurrency(o.price)}</td>
                          <td className="py-1.5 px-2 text-right">{o.quantity}</td>
                          <td className="py-1.5 px-2 text-right text-blue-600">{formatCurrency(o.actualPartnerCommission)}</td>
                          <td className="py-1.5 px-2 text-right text-green-600">{formatCurrency(o.actualCreatorCommission)}</td>
                          <td className="py-1.5 px-2 text-center">
                            <Badge variant={o.orderStatus === '完了' ? 'default' : 'secondary'} className="text-xs">
                              {o.orderStatus || '-'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {ordersQuery.data && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      全{formatNumber(ordersQuery.data.total)}件中 {orderPage * pageSize + 1}-{Math.min((orderPage + 1) * pageSize, ordersQuery.data.total)}件
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={orderPage === 0} onClick={() => setOrderPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={(orderPage + 1) * pageSize >= ordersQuery.data.total} onClick={() => setOrderPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Imports Tab */}
      {activeTab === 'imports' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                インポート履歴
              </CardTitle>
              <Button onClick={() => setUploadDialogOpen(true)} size="sm">
                <Upload className="h-4 w-4 mr-2" />
                CSVアップロード
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {importsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (importsQuery.data || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">インポート履歴なし</p>
            ) : (
              <div className="space-y-3">
                {(importsQuery.data || []).map((imp: any) => (
                  <div key={imp.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{imp.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {imp.importedRows}件インポート / {imp.skippedRows}件スキップ
                        {imp.dateRangeStart && ` | ${new Date(imp.dateRangeStart).toLocaleDateString('ja-JP')} ~ ${new Date(imp.dateRangeEnd).toLocaleDateString('ja-JP')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={imp.status === 'completed' ? 'default' : 'destructive'}>
                        {imp.status === 'completed' ? '完了' : imp.status}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => { setDeleteImportId(imp.id); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSVアップロード</DialogTitle>
            <DialogDescription>TikTokコミッションCSVファイルをアップロードします</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={csvUploading}
              className="w-full"
            />
            {csvUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                アップロード中...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>インポートデータの削除</DialogTitle>
            <DialogDescription>このインポートに関連する全ての注文データが削除されます。この操作は元に戻せません。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => deleteImportId && deleteMutation.mutate({ importId: deleteImportId })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
