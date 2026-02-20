import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Store,
  Tag,
  UserCheck,
  Receipt,
  LayoutDashboard,
  CreditCard,
  Coins,
  Banknote,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import ProductManagement from "./ProductManagement";
import MallBrandCategoryManagement from "./MallBrandCategoryManagement";
import OrderManagement from "./OrderManagement";
import MallMembers from "./MallMembers";
import LineReceiptManagement from "./LineReceiptManagement";

const TABS = [
  { id: "dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { id: "products", label: "商品管理", icon: Package },
  { id: "brands-categories", label: "ブランド・カテゴリ", icon: Tag },
  { id: "orders", label: "注文管理", icon: ShoppingCart },
  { id: "members", label: "会員様", icon: UserCheck },
  { id: "receipts", label: "レシート管理", icon: Receipt },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

function GrowthBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) {
    return (
      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs gap-1">
        <TrendingUp className="h-3 w-3" />+{pct}%
      </Badge>
    );
  }
  if (pct < 0) {
    return (
      <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 text-xs gap-1">
        <TrendingDown className="h-3 w-3" />{pct}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-xs">±0%</Badge>
  );
}

function DashboardContent() {
  const { data: stats, isLoading: statsLoading } = trpc.mall.getDashboardStats.useQuery();
  const [chartPeriod, setChartPeriod] = useState<"daily" | "monthly">("daily");
  const { data: salesChart, isLoading: chartLoading } = trpc.mall.getSalesChart.useQuery({ period: chartPeriod, months: 6 });
  const { data: memberGrowth, isLoading: memberChartLoading } = trpc.mall.getMemberGrowthChart.useQuery({ months: 6 });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardContent className="p-6"><Skeleton className="h-64" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-64" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (!stats) return <div className="text-center text-muted-foreground py-12">データの取得に失敗しました</div>;

  const pendingOrders = stats.orderStatus.find(s => s.status === "pending")?.count || 0;
  const paidOrders = stats.orderStatus.find(s => s.status === "paid")?.count || 0;
  const shippedOrders = stats.orderStatus.find(s => s.status === "shipped")?.count || 0;
  const deliveredOrders = stats.orderStatus.find(s => s.status === "delivered")?.count || 0;

  const paymentMethodLabels: Record<string, { label: string; icon: typeof CreditCard }> = {
    stripe: { label: "Stripe決済", icon: CreditCard },
    points: { label: "ポイント決済", icon: Coins },
    cod: { label: "代引き", icon: Banknote },
  };

  // Simple bar chart rendering
  const maxSalesValue = salesChart ? Math.max(...salesChart.map(d => d.total), 1) : 1;
  const maxMemberValue = memberGrowth ? Math.max(...memberGrowth.map(d => d.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">今月の売上</span>
              <BarChart3 className="h-4 w-4 text-pink-500" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(stats.sales.thisMonth)}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{stats.sales.thisMonthOrders}件</span>
              <GrowthBadge current={stats.sales.thisMonth} previous={stats.sales.lastMonth} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">今日の売上</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(stats.sales.today)}</div>
            <span className="text-xs text-muted-foreground">{stats.sales.todayOrders}件</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">総会員数</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">{stats.members.total.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">今月 +{stats.members.thisMonth}</span>
              <GrowthBadge current={stats.members.thisMonth} previous={stats.members.lastMonth} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">商品数</span>
              <Package className="h-4 w-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold">{stats.products.active}</div>
            <span className="text-xs text-muted-foreground">販売中 / 全{stats.products.total}件</span>
          </CardContent>
        </Card>
      </div>

      {/* Order Status & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">注文ステータス</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                <span className="text-sm text-yellow-700">決済待ち</span>
                <span className="text-lg font-bold text-yellow-700">{pendingOrders}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
                <span className="text-sm text-green-700">決済完了</span>
                <span className="text-lg font-bold text-green-700">{paidOrders}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100">
                <span className="text-sm text-blue-700">発送済み</span>
                <span className="text-lg font-bold text-blue-700">{shippedOrders}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-sm text-gray-700">配達完了</span>
                <span className="text-lg font-bold text-gray-700">{deliveredOrders}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">決済方法別売上</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.paymentMethods.length === 0 ? (
                <div className="text-center text-muted-foreground py-4 text-sm">データなし</div>
              ) : (
                stats.paymentMethods.map((pm) => {
                  const info = paymentMethodLabels[pm.method] || { label: pm.method, icon: CreditCard };
                  const Icon = info.icon;
                  const pct = stats.sales.total > 0 ? Math.round((pm.total / stats.sales.total) * 100) : 0;
                  return (
                    <div key={pm.method} className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{info.label}</span>
                          <span className="text-sm font-medium">{formatCurrency(pm.total)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-pink-500 h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{pm.count}件 ({pct}%)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">売上推移</CardTitle>
              <div className="flex gap-1">
                <button
                  onClick={() => setChartPeriod("daily")}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${chartPeriod === "daily" ? "bg-pink-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  日別
                </button>
                <button
                  onClick={() => setChartPeriod("monthly")}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${chartPeriod === "monthly" ? "bg-pink-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  月別
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-48" />
            ) : !salesChart || salesChart.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 text-sm">売上データなし</div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-end gap-1 h-48">
                  {salesChart.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {formatCurrency(d.total)}
                      </span>
                      <div
                        className="w-full bg-gradient-to-t from-pink-500 to-pink-400 rounded-t-sm min-h-[2px] transition-all"
                        style={{ height: `${Math.max((d.total / maxSalesValue) * 100, 2)}%` }}
                      />
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                        {chartPeriod === "daily" ? d.date.slice(5) : d.date.slice(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Member Growth Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">会員増加推移（月別）</CardTitle>
          </CardHeader>
          <CardContent>
            {memberChartLoading ? (
              <Skeleton className="h-48" />
            ) : !memberGrowth || memberGrowth.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 text-sm">会員データなし</div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-end gap-1 h-48">
                  {memberGrowth.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {d.count}
                      </span>
                      <div
                        className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm min-h-[2px] transition-all"
                        style={{ height: `${Math.max((d.count / maxMemberValue) * 100, 2)}%` }}
                      />
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                        {d.date.slice(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">累計サマリー</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{formatCurrency(stats.sales.total)}</div>
              <div className="text-xs text-muted-foreground mt-1">累計売上</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{stats.sales.totalOrders.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">累計注文数</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{stats.members.total.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">総会員数</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {stats.sales.totalOrders > 0 ? formatCurrency(Math.round(stats.sales.total / stats.sales.totalOrders)) : "¥0"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">平均注文単価</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MallDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const { loading, user } = useAuth();

  // お客様名タップ時: 会員タブに切り替え＋該当会員を選択
  const handleNavigateToMember = (memberId: number) => {
    setSelectedMemberId(memberId);
    setActiveTab("members");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login?redirect=/master/mall";
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => setLocation("/master")}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Store className="h-5 w-5 text-pink-500" />
          <h1 className="font-semibold text-lg">LCJ MALL</h1>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b bg-background">
        <div className="px-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max py-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-pink-500 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "dashboard" && <DashboardContent />}
        {activeTab === "products" && <ProductManagement />}
        {activeTab === "brands-categories" && <MallBrandCategoryManagement />}
        {activeTab === "orders" && <OrderManagement onMemberClick={handleNavigateToMember} />}
        {activeTab === "members" && <MallMembers initialMemberId={selectedMemberId} onMemberViewed={() => setSelectedMemberId(null)} />}
        {activeTab === "receipts" && <LineReceiptManagement />}
      </div>
    </div>
  );
}
