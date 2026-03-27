import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Eye, MousePointerClick, Clock, Users, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const VARIANT_LABELS: Record<string, { name: string; headline: string; color: string }> = {
  A: {
    name: "バリアントA",
    headline: "サンプル30個送るだけで TikTokが勝手に売ってくれる",
    color: "from-purple-500 to-pink-500",
  },
  B: {
    name: "バリアントB",
    headline: "あなたの商品が TikTokでバズる仕組み、できてます。",
    color: "from-blue-500 to-cyan-500",
  },
  C: {
    name: "バリアントC",
    headline: "広告費¥0で TikTok Shop売上1億円の実績あり",
    color: "from-amber-500 to-orange-500",
  },
};

export default function AbTestDashboard() {
  const { data: stats, isLoading, refetch } = trpc.abTest.stats.useQuery();
  const { data: recentEvents } = trpc.abTest.recentEvents.useQuery({ limit: 30 });

  const bestVariant = stats?.reduce((best, curr) =>
    curr.ctaRate > (best?.ctaRate ?? 0) ? curr : best, stats[0]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-purple-600" />
            ABテスト ダッシュボード
          </h1>
          <p className="text-gray-500 text-sm mt-1">ファーストビュー キャッチコピーのABテスト結果</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          更新
        </Button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-6 bg-gray-200 rounded w-1/2" /></CardHeader>
              <CardContent><div className="h-20 bg-gray-100 rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : !stats || stats.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">まだデータがありません</p>
            <p className="text-gray-400 text-sm mt-2">/brand-sample ページにアクセスがあるとデータが記録されます</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.reduce((s, v) => s + v.uniqueSessions, 0)}</p>
                    <p className="text-xs text-gray-500">総セッション数</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Eye className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.reduce((s, v) => s + v.views, 0)}</p>
                    <p className="text-xs text-gray-500">総ページビュー</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MousePointerClick className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.reduce((s, v) => s + v.ctaClicks, 0)}</p>
                    <p className="text-xs text-gray-500">総CTAクリック</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {bestVariant ? `${bestVariant.ctaRate}%` : "-"}
                    </p>
                    <p className="text-xs text-gray-500">最高CTR ({bestVariant?.variantId || "-"})</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Variant Comparison */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {stats.map((variant) => {
              const info = VARIANT_LABELS[variant.variantId] || { name: variant.variantId, headline: "不明", color: "from-gray-400 to-gray-500" };
              const isBest = bestVariant?.variantId === variant.variantId && stats.length > 1;
              return (
                <Card key={variant.variantId} className={`relative overflow-hidden ${isBest ? "ring-2 ring-green-500 shadow-lg" : ""}`}>
                  {isBest && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      WINNER
                    </div>
                  )}
                  <CardHeader>
                    <div className={`h-2 w-full bg-gradient-to-r ${info.color} rounded-full mb-3`} />
                    <CardTitle className="text-lg">{info.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">「{info.headline}」</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> PV</span>
                        <span className="font-bold text-lg">{variant.views}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 flex items-center gap-1"><MousePointerClick className="h-3.5 w-3.5" /> CTAクリック</span>
                        <span className="font-bold text-lg">{variant.ctaClicks}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> CTR</span>
                        <span className={`font-black text-2xl ${isBest ? "text-green-600" : "text-gray-900"}`}>{variant.ctaRate}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> 平均滞在</span>
                        <span className="font-bold">{variant.avgDwellTimeSec}秒</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> セッション</span>
                        <span className="font-bold">{variant.uniqueSessions}</span>
                      </div>

                      {/* Visual CTR bar */}
                      <div className="mt-2">
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${info.color} rounded-full transition-all duration-500`}
                            style={{ width: `${Math.min(variant.ctaRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Recent Events */}
          {recentEvents && recentEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">直近のイベント</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">時刻</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">バリアント</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">イベント</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">滞在時間</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium">セッション</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEvents.map((event, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-600">
                            {new Date(event.createdAt).toLocaleString("ja-JP")}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              event.variantId === "A" ? "bg-purple-100 text-purple-700" :
                              event.variantId === "B" ? "bg-blue-100 text-blue-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              {event.variantId}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                              event.eventType === "cta_click" ? "text-green-600" :
                              event.eventType === "view" ? "text-blue-600" :
                              "text-gray-500"
                            }`}>
                              {event.eventType === "view" && <><Eye className="h-3 w-3" /> 閲覧</>}
                              {event.eventType === "cta_click" && <><MousePointerClick className="h-3 w-3" /> CTAクリック</>}
                              {event.eventType === "scroll_past_hero" && <><Clock className="h-3 w-3" /> 離脱</>}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {event.dwellTimeMs ? `${(Number(event.dwellTimeMs) / 1000).toFixed(1)}秒` : "-"}
                          </td>
                          <td className="py-2 px-3 text-gray-400 text-xs font-mono">
                            {event.sessionId.slice(0, 8)}...
                          </td>
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
    </div>
  );
}
