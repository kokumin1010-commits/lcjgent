import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  ShoppingBag,
  Users,
  TrendingUp,
  MapPin,
  Clock,
  Repeat,
  Brain,
  Store,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";

function formatYen(amount: number): string {
  if (amount >= 100000000) return `¥${(amount / 100000000).toFixed(1)}億`;
  if (amount >= 10000) return `¥${(amount / 10000).toFixed(0)}万`;
  return `¥${amount.toLocaleString()}`;
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

// Simple bar chart component
function SimpleBarChart({ data, labelKey, valueKey, maxBars = 10, color = "bg-purple-500" }: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  maxBars?: number;
  color?: string;
}) {
  const sliced = data.slice(0, maxBars);
  const maxVal = Math.max(...sliced.map(d => Number(d[valueKey]) || 0), 1);
  
  return (
    <div className="space-y-2">
      {sliced.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-6 text-xs text-muted-foreground text-right">{i + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate mb-1">{item[labelKey]}</div>
            <div className="h-5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all duration-500`}
                style={{ width: `${(Number(item[valueKey]) / maxVal) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-sm font-medium w-24 text-right">
            {typeof item[valueKey] === "number" && item[valueKey] > 1000
              ? formatYen(item[valueKey])
              : item[valueKey]?.toLocaleString?.() ?? item[valueKey]}
          </div>
        </div>
      ))}
    </div>
  );
}

// Horizontal distribution chart
function DistributionChart({ data, labelKey, valueKey, colors }: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  colors: string[];
}) {
  const total = data.reduce((sum, d) => sum + Number(d[valueKey] || 0), 0);
  if (total === 0) return <div className="text-muted-foreground text-sm">データなし</div>;
  
  return (
    <div>
      <div className="flex h-8 rounded-lg overflow-hidden mb-3">
        {data.map((item, i) => {
          const pct = (Number(item[valueKey]) / total) * 100;
          if (pct < 1) return null;
          return (
            <div
              key={i}
              className={`${colors[i % colors.length]} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${item[labelKey]}: ${item[valueKey]}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className={`w-3 h-3 rounded-sm ${colors[i % colors.length]}`} />
            <span>{item[labelKey]}: {Number(item[valueKey]).toLocaleString()} ({((Number(item[valueKey]) / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Time heatmap for hour analysis
function HourHeatmap({ data }: { data: { hour: number; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div className="grid grid-cols-12 gap-1">
      {Array.from({ length: 24 }, (_, h) => {
        const item = data.find(d => d.hour === h);
        const count = item?.count || 0;
        const intensity = count / maxCount;
        return (
          <div
            key={h}
            className="aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium transition-colors"
            style={{
              backgroundColor: intensity > 0
                ? `oklch(0.65 0.2 285 / ${0.15 + intensity * 0.85})`
                : "var(--muted)",
              color: intensity > 0.5 ? "white" : "var(--muted-foreground)",
            }}
            title={`${h}時: ${count}件`}
          >
            {h}
          </div>
        );
      })}
    </div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function ReceiptAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");
  
  const { data: overview, isLoading: loadingOverview } = trpc.receiptAnalytics.overview.useQuery();
  const { data: shops, isLoading: loadingShops } = trpc.receiptAnalytics.shopRanking.useQuery();
  const { data: products, isLoading: loadingProducts } = trpc.receiptAnalytics.productRanking.useQuery();
  const { data: monthly, isLoading: loadingMonthly } = trpc.receiptAnalytics.monthlyTrend.useQuery();
  const { data: repeater, isLoading: loadingRepeater } = trpc.receiptAnalytics.repeaterAnalysis.useQuery();
  const { data: regions, isLoading: loadingRegions } = trpc.receiptAnalytics.regionAnalysis.useQuery();
  const { data: aiConf, isLoading: loadingAi } = trpc.receiptAnalytics.aiConfidence.useQuery();
  const { data: timeData, isLoading: loadingTime } = trpc.receiptAnalytics.timeAnalysis.useQuery();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <BarChart3 className="h-6 w-6 text-purple-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">レシート分析</h1>
          <p className="text-sm text-muted-foreground">
            LINE レシート・TikTok注文データの統合分析
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="shops">Shop別</TabsTrigger>
          <TabsTrigger value="products">商品別</TabsTrigger>
          <TabsTrigger value="trend">トレンド</TabsTrigger>
          <TabsTrigger value="repeater">リピーター</TabsTrigger>
          <TabsTrigger value="region">地域別</TabsTrigger>
          <TabsTrigger value="time">時間帯</TabsTrigger>
          <TabsTrigger value="ai">AI精度</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-4">
          {loadingOverview ? <LoadingCard /> : overview && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      TikTok注文数
                    </div>
                    <div className="text-2xl font-bold">{formatNumber(overview.tiktokOrders.totalCount)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      売上: {formatYen(overview.tiktokOrders.totalAmount)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Store className="h-3.5 w-3.5" />
                      ショップ数
                    </div>
                    <div className="text-2xl font-bold">{overview.tiktokOrders.uniqueShops}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      商品数: {formatNumber(overview.tiktokOrders.uniqueProducts)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Users className="h-3.5 w-3.5" />
                      LINEレシート
                    </div>
                    <div className="text-2xl font-bold">{formatNumber(overview.lineReceipts.totalCount)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      承認済: {overview.lineReceipts.approvedCount} / ユーザー: {overview.lineReceipts.uniqueUsers}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      LINE承認額
                    </div>
                    <div className="text-2xl font-bold">{formatYen(overview.lineReceipts.totalApprovedAmount)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      審査待ち: {overview.lineReceipts.pendingCount}件
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* LINE Receipt Status Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">LINEレシート ステータス分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <DistributionChart
                    data={[
                      { label: "承認済み", value: overview.lineReceipts.approvedCount },
                      { label: "審査待ち", value: overview.lineReceipts.pendingCount },
                      { label: "却下", value: overview.lineReceipts.rejectedCount },
                      { label: "その他", value: overview.lineReceipts.totalCount - overview.lineReceipts.approvedCount - overview.lineReceipts.pendingCount - overview.lineReceipts.rejectedCount },
                    ].filter(d => d.value > 0)}
                    labelKey="label"
                    valueKey="value"
                    colors={["bg-green-500", "bg-yellow-500", "bg-red-500", "bg-gray-400"]}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* === SHOPS TAB === */}
        <TabsContent value="shops" className="space-y-4">
          {loadingShops ? <LoadingCard /> : shops && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Shop別 売上ランキング
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SimpleBarChart
                      data={shops}
                      labelKey="shopName"
                      valueKey="totalAmount"
                      maxBars={15}
                      color="bg-purple-500"
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4" />
                      Shop別 注文数ランキング
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SimpleBarChart
                      data={shops}
                      labelKey="shopName"
                      valueKey="orderCount"
                      maxBars={15}
                      color="bg-blue-500"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Shop detail table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Shop詳細一覧</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">#</th>
                          <th className="text-left py-2 px-2">Shop名</th>
                          <th className="text-right py-2 px-2">注文数</th>
                          <th className="text-right py-2 px-2">売上合計</th>
                          <th className="text-right py-2 px-2">LINE</th>
                          <th className="text-right py-2 px-2">TikTok</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shops.map((shop, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 px-2 font-medium">{shop.shopName}</td>
                            <td className="py-2 px-2 text-right">{shop.orderCount.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right font-medium">{formatYen(shop.totalAmount)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{shop.lineCount}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{shop.tiktokCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* === PRODUCTS TAB === */}
        <TabsContent value="products" className="space-y-4">
          {loadingProducts ? <LoadingCard /> : products && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    商品別 売上ランキング（TikTok）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SimpleBarChart
                    data={products}
                    labelKey="productName"
                    valueKey="totalAmount"
                    maxBars={20}
                    color="bg-orange-500"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">商品詳細一覧</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">#</th>
                          <th className="text-left py-2 px-2">商品名</th>
                          <th className="text-left py-2 px-2">Shop</th>
                          <th className="text-right py-2 px-2">注文数</th>
                          <th className="text-right py-2 px-2">数量</th>
                          <th className="text-right py-2 px-2">平均単価</th>
                          <th className="text-right py-2 px-2">売上合計</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 px-2 font-medium max-w-[200px] truncate">{p.productName}</td>
                            <td className="py-2 px-2 text-muted-foreground max-w-[120px] truncate">{p.shopName}</td>
                            <td className="py-2 px-2 text-right">{p.orderCount.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right">{p.totalQuantity.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right">{formatYen(p.avgPrice)}</td>
                            <td className="py-2 px-2 text-right font-medium">{formatYen(p.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* === TREND TAB === */}
        <TabsContent value="trend" className="space-y-4">
          {loadingMonthly ? <LoadingCard /> : monthly && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    月別推移
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {monthly.length === 0 ? (
                    <div className="text-muted-foreground text-sm py-8 text-center">データなし</div>
                  ) : (
                    <div className="space-y-3">
                      {/* Visual bar chart */}
                      <div className="space-y-2">
                        {monthly.map((m, i) => {
                          const totalAmount = m.lineAmount + m.tiktokAmount;
                          const maxAmount = Math.max(...monthly.map(x => x.lineAmount + x.tiktokAmount), 1);
                          const prevTotal = i > 0 ? monthly[i - 1].lineAmount + monthly[i - 1].tiktokAmount : 0;
                          const change = prevTotal > 0 ? ((totalAmount - prevTotal) / prevTotal) * 100 : 0;
                          
                          return (
                            <div key={m.month} className="flex items-center gap-3">
                              <div className="w-16 text-sm font-medium">{m.month}</div>
                              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden flex">
                                {m.tiktokAmount > 0 && (
                                  <div
                                    className="h-full bg-purple-500 transition-all duration-500"
                                    style={{ width: `${(m.tiktokAmount / maxAmount) * 100}%` }}
                                    title={`TikTok: ${formatYen(m.tiktokAmount)}`}
                                  />
                                )}
                                {m.lineAmount > 0 && (
                                  <div
                                    className="h-full bg-green-500 transition-all duration-500"
                                    style={{ width: `${(m.lineAmount / maxAmount) * 100}%` }}
                                    title={`LINE: ${formatYen(m.lineAmount)}`}
                                  />
                                )}
                              </div>
                              <div className="w-20 text-sm font-medium text-right">{formatYen(totalAmount)}</div>
                              {i > 0 && prevTotal > 0 && (
                                <div className={`w-16 text-xs text-right flex items-center justify-end gap-0.5 ${change >= 0 ? "text-green-500" : "text-red-500"}`}>
                                  {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                  {Math.abs(change).toFixed(0)}%
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-purple-500" />
                          TikTok注文
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-green-500" />
                          LINEレシート（承認済）
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly detail table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">月別詳細</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">月</th>
                          <th className="text-right py-2 px-2">TikTok件数</th>
                          <th className="text-right py-2 px-2">TikTok売上</th>
                          <th className="text-right py-2 px-2">LINE件数</th>
                          <th className="text-right py-2 px-2">LINE承認</th>
                          <th className="text-right py-2 px-2">LINE売上</th>
                          <th className="text-right py-2 px-2 font-medium">合計売上</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthly.map((m) => (
                          <tr key={m.month} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-2 px-2 font-medium">{m.month}</td>
                            <td className="py-2 px-2 text-right">{m.tiktokCount.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right">{formatYen(m.tiktokAmount)}</td>
                            <td className="py-2 px-2 text-right">{m.lineCount.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right">{m.lineApproved}</td>
                            <td className="py-2 px-2 text-right">{formatYen(m.lineAmount)}</td>
                            <td className="py-2 px-2 text-right font-medium">{formatYen(m.lineAmount + m.tiktokAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* === REPEATER TAB === */}
        <TabsContent value="repeater" className="space-y-4">
          {loadingRepeater ? <LoadingCard /> : repeater && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Users className="h-3.5 w-3.5" />
                      ユニークユーザー
                    </div>
                    <div className="text-2xl font-bold">{repeater.totalUsers}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Repeat className="h-3.5 w-3.5" />
                      リピート率
                    </div>
                    <div className="text-2xl font-bold">{repeater.repeatRate}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      平均購入回数
                    </div>
                    <div className="text-2xl font-bold">{repeater.avgPurchaseCount}回</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      2回以上購入
                    </div>
                    <div className="text-2xl font-bold">
                      {repeater.distribution.reduce((sum, d, i) => i > 0 ? sum + d.count : sum, 0)}人
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    購入回数分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DistributionChart
                    data={repeater.distribution}
                    labelKey="label"
                    valueKey="count"
                    colors={["bg-blue-400", "bg-blue-500", "bg-purple-500", "bg-purple-600", "bg-pink-500"]}
                  />
                </CardContent>
              </Card>

              {/* Top repeaters */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">リピーターランキング（TOP 20）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">#</th>
                          <th className="text-left py-2 px-2">ユーザーID</th>
                          <th className="text-right py-2 px-2">購入回数</th>
                          <th className="text-right py-2 px-2">承認数</th>
                          <th className="text-right py-2 px-2">合計金額</th>
                          <th className="text-right py-2 px-2">平均間隔</th>
                          <th className="text-right py-2 px-2">初回</th>
                          <th className="text-right py-2 px-2">最新</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repeater.topRepeaters.map((user, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 px-2 font-mono text-xs max-w-[120px] truncate">{user.lineUserId}</td>
                            <td className="py-2 px-2 text-right font-medium">{user.receiptCount}</td>
                            <td className="py-2 px-2 text-right">{user.approvedCount}</td>
                            <td className="py-2 px-2 text-right">{formatYen(user.totalAmount)}</td>
                            <td className="py-2 px-2 text-right">
                              {user.avgInterval !== null ? `${user.avgInterval}日` : "-"}
                            </td>
                            <td className="py-2 px-2 text-right text-xs text-muted-foreground">
                              {user.firstSubmission ? new Date(user.firstSubmission).toLocaleDateString("ja-JP") : "-"}
                            </td>
                            <td className="py-2 px-2 text-right text-xs text-muted-foreground">
                              {user.lastSubmission ? new Date(user.lastSubmission).toLocaleDateString("ja-JP") : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* === REGION TAB === */}
        <TabsContent value="region" className="space-y-4">
          {loadingRegions ? <LoadingCard /> : regions && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    都道府県別 購入分布（LINEレシート）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {regions.length === 0 ? (
                    <div className="text-muted-foreground text-sm py-8 text-center">
                      配送先住所データが不足しています。OCR解析済みのレシートが増えると表示されます。
                    </div>
                  ) : (
                    <SimpleBarChart
                      data={regions}
                      labelKey="prefecture"
                      valueKey="count"
                      maxBars={20}
                      color="bg-emerald-500"
                    />
                  )}
                </CardContent>
              </Card>

              {regions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">地域別詳細</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 px-2">#</th>
                            <th className="text-left py-2 px-2">都道府県</th>
                            <th className="text-right py-2 px-2">件数</th>
                            <th className="text-right py-2 px-2">売上合計</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regions.map((r, i) => (
                            <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                              <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                              <td className="py-2 px-2 font-medium">{r.prefecture}</td>
                              <td className="py-2 px-2 text-right">{r.count}</td>
                              <td className="py-2 px-2 text-right">{formatYen(r.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* === TIME TAB === */}
        <TabsContent value="time" className="space-y-4">
          {loadingTime ? <LoadingCard /> : timeData && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      曜日別（LINEレシート）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SimpleBarChart
                      data={timeData.byDayOfWeek}
                      labelKey="day"
                      valueKey="count"
                      maxBars={7}
                      color="bg-cyan-500"
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      時間帯別ヒートマップ（JST）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HourHeatmap data={timeData.byHour} />
                    <p className="text-xs text-muted-foreground mt-3">
                      色が濃いほどレシート提出が多い時間帯です
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Time detail table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">曜日別・時間帯別 詳細</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium mb-2">曜日別</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-1.5 px-2">曜日</th>
                            <th className="text-right py-1.5 px-2">件数</th>
                            <th className="text-right py-1.5 px-2">売上</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeData.byDayOfWeek.map((d, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-1.5 px-2">{d.day}曜日</td>
                              <td className="py-1.5 px-2 text-right">{d.count}</td>
                              <td className="py-1.5 px-2 text-right">{formatYen(d.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">時間帯別（上位）</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-1.5 px-2">時間</th>
                            <th className="text-right py-1.5 px-2">件数</th>
                            <th className="text-right py-1.5 px-2">売上</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...timeData.byHour].sort((a, b) => b.count - a.count).slice(0, 10).map((h, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-1.5 px-2">{h.hour}:00</td>
                              <td className="py-1.5 px-2 text-right">{h.count}</td>
                              <td className="py-1.5 px-2 text-right">{formatYen(h.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* === AI CONFIDENCE TAB === */}
        <TabsContent value="ai" className="space-y-4">
          {loadingAi ? <LoadingCard /> : aiConf && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    AI信頼度別 承認率
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {aiConf.totalReviewed === 0 ? (
                    <div className="text-muted-foreground text-sm py-8 text-center">
                      レビューログデータが不足しています（現在{aiConf.totalReviewed}件）
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground mb-2">
                        合計レビュー数: {aiConf.totalReviewed}件
                      </div>
                      {aiConf.byConfidenceBand.map((band, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{band.label}</span>
                            <span>
                              承認率: <span className={band.approvalRate >= 80 ? "text-green-500" : band.approvalRate >= 50 ? "text-yellow-500" : "text-red-500"}>
                                {band.approvalRate}%
                              </span>
                              （{band.approved}/{band.total}件）
                            </span>
                          </div>
                          <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                            {band.total > 0 && (
                              <>
                                <div
                                  className="h-full bg-green-500 transition-all"
                                  style={{ width: `${(band.approved / band.total) * 100}%` }}
                                />
                                <div
                                  className="h-full bg-red-400 transition-all"
                                  style={{ width: `${(band.rejected / band.total) * 100}%` }}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-green-500" />
                          承認
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-red-400" />
                          却下
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-muted" />
                          その他
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
