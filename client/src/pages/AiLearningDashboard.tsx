import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Brain,
  Target,
  FileCheck,
  FileX,
  Clock,
  Percent,
} from "lucide-react";

const REJECTION_CATEGORY_LABELS: Record<string, string> = {
  blurry_image: "画像不鮮明",
  no_order_number: "注文番号なし",
  duplicate: "重複",
  amount_mismatch: "金額不一致",
  invalid_store: "対象外の店舗",
  expired: "期限切れ",
  tampered: "改ざんの疑い",
  other: "その他",
};

function StatCard({ title, value, icon: Icon, description, trend }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className={`text-xs mt-1 ${
            trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"
          }`}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({ data, labelKey, valueKey, colorFn }: {
  data: Array<Record<string, any>>;
  labelKey: string;
  valueKey: string;
  colorFn?: (item: Record<string, any>, index: number) => string;
}) {
  const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = (val / maxVal) * 100;
        const color = colorFn ? colorFn(item, i) : "bg-primary";
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 text-xs text-muted-foreground truncate text-right">
              {item[labelKey]}
            </div>
            <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${color}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <div className="w-12 text-xs font-medium text-right">{val}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AiLearningDashboard() {
  const [trendDays, setTrendDays] = useState<number>(30);

  const { data: summary, isLoading: summaryLoading } = trpc.aiLearning.summary.useQuery();
  const { data: dailyTrend, isLoading: trendLoading } = trpc.aiLearning.dailyTrend.useQuery({ days: trendDays });
  const { data: rejectionDist, isLoading: rejectionLoading } = trpc.aiLearning.rejectionDistribution.useQuery();
  const { data: ocrCorrelation, isLoading: ocrLoading } = trpc.aiLearning.ocrCorrelation.useQuery();
  const { data: simulation, isLoading: simLoading } = trpc.aiLearning.autoApprovalSimulation.useQuery();

  const totalReviewed = summary?.total ?? 0;
  const approvalRate = summary?.approvalRate ?? 0;
  const avgOcrConfidence = summary?.avgOcrConfidence ?? 0;

  // Calculate recent trend (last 7 days vs previous 7 days)
  const recentTrend = useMemo(() => {
    if (!dailyTrend || dailyTrend.length < 2) return null;
    const recent7 = dailyTrend.slice(-7);
    const prev7 = dailyTrend.slice(-14, -7);
    if (prev7.length === 0) return null;
    const recentAvg = recent7.reduce((s, d) => s + d.approvalRate, 0) / recent7.length;
    const prevAvg = prev7.reduce((s, d) => s + d.approvalRate, 0) / prev7.length;
    return { recentAvg: Math.round(recentAvg), prevAvg: Math.round(prevAvg), diff: Math.round(recentAvg - prevAvg) };
  }, [dailyTrend]);

  if (summaryLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6" />
          AI学習ダッシュボード
        </h1>
        <p className="text-muted-foreground mt-1">
          レシート承認・却下の判断データを蓄積し、自動承認への移行準備状況を可視化します
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="総レビュー数"
          value={totalReviewed}
          icon={BarChart3}
          description={`LINE: ${summary?.byType?.lineReceipt ?? 0} / Web: ${summary?.byType?.webReceipt ?? 0} / 申請: ${summary?.byType?.pointRequest ?? 0}`}
        />
        <StatCard
          title="承認率"
          value={`${approvalRate}%`}
          icon={approvalRate >= 70 ? TrendingUp : TrendingDown}
          description={recentTrend ? `直近7日: ${recentTrend.recentAvg}%（前週比 ${recentTrend.diff >= 0 ? '+' : ''}${recentTrend.diff}%）` : "データ蓄積中..."}
          trend={recentTrend ? (recentTrend.diff >= 0 ? "up" : "down") : "neutral"}
        />
        <StatCard
          title="平均OCR信頼度"
          value={`${avgOcrConfidence}%`}
          icon={Target}
          description={avgOcrConfidence >= 80 ? "高精度" : avgOcrConfidence >= 60 ? "中程度" : "改善が必要"}
          trend={avgOcrConfidence >= 80 ? "up" : avgOcrConfidence >= 60 ? "neutral" : "down"}
        />
        <StatCard
          title="平均不正スコア"
          value={summary?.avgFraudScore ?? 0}
          icon={ShieldCheck}
          description={`平均金額: ¥${(summary?.avgAmount ?? 0).toLocaleString()}`}
        />
      </div>

      {/* Daily Trend */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                承認率・却下率の推移
              </CardTitle>
              <CardDescription>日別の承認・却下・保留件数と承認率</CardDescription>
            </div>
            <Select value={String(trendDays)} onValueChange={(v) => setTrendDays(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7日間</SelectItem>
                <SelectItem value="14">14日間</SelectItem>
                <SelectItem value="30">30日間</SelectItem>
                <SelectItem value="60">60日間</SelectItem>
                <SelectItem value="90">90日間</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-64" />
          ) : !dailyTrend || dailyTrend.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>データが蓄積されるまでお待ちください</p>
                <p className="text-xs mt-1">レシートの承認・却下を行うとデータが記録されます</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Legend */}
              <div className="flex gap-4 mb-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> 承認</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400" /> 却下</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400" /> 保留</span>
              </div>
              {/* Stacked bar chart */}
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 min-w-fit" style={{ height: 200 }}>
                  {dailyTrend.map((day, i) => {
                    const maxTotal = Math.max(...dailyTrend.map(d => d.total), 1);
                    const height = (day.total / maxTotal) * 180;
                    const approvedH = day.total > 0 ? (day.approved / day.total) * height : 0;
                    const rejectedH = day.total > 0 ? (day.rejected / day.total) * height : 0;
                    const onHoldH = height - approvedH - rejectedH;
                    return (
                      <div key={i} className="flex flex-col items-center gap-0.5" style={{ minWidth: 28 }}>
                        <span className="text-[10px] text-muted-foreground">{day.approvalRate}%</span>
                        <div className="flex flex-col-reverse" style={{ height }}>
                          <div className="bg-green-500 rounded-b-sm w-5" style={{ height: approvedH }} title={`承認: ${day.approved}`} />
                          <div className="bg-red-400 w-5" style={{ height: rejectedH }} title={`却下: ${day.rejected}`} />
                          <div className="bg-yellow-400 rounded-t-sm w-5" style={{ height: onHoldH }} title={`保留: ${day.onHold}`} />
                        </div>
                        <span className="text-[9px] text-muted-foreground rotate-[-45deg] origin-top-left mt-1 whitespace-nowrap">
                          {day.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Summary row */}
              <div className="flex gap-4 pt-3 text-sm border-t">
                <span>合計: <strong>{dailyTrend.reduce((s, d) => s + d.total, 0)}</strong>件</span>
                <span className="text-green-600">承認: <strong>{dailyTrend.reduce((s, d) => s + d.approved, 0)}</strong></span>
                <span className="text-red-500">却下: <strong>{dailyTrend.reduce((s, d) => s + d.rejected, 0)}</strong></span>
                <span className="text-yellow-600">保留: <strong>{dailyTrend.reduce((s, d) => s + d.onHold, 0)}</strong></span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rejection Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileX className="h-5 w-5" />
              却下理由の分布
            </CardTitle>
            <CardDescription>却下されたレシートの理由カテゴリ別件数</CardDescription>
          </CardHeader>
          <CardContent>
            {rejectionLoading ? (
              <Skeleton className="h-48" />
            ) : !rejectionDist || rejectionDist.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">却下データがまだありません</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pie chart simulation with colored bars */}
                {(() => {
                  const total = rejectionDist.reduce((s, d) => s + d.count, 0);
                  const colors = [
                    "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500",
                    "bg-purple-500", "bg-pink-500", "bg-teal-500", "bg-gray-500",
                  ];
                  return (
                    <>
                      {/* Proportional bar */}
                      <div className="flex h-8 rounded-full overflow-hidden">
                        {rejectionDist.map((item, i) => (
                          <div
                            key={i}
                            className={`${colors[i % colors.length]} transition-all`}
                            style={{ width: `${(item.count / total) * 100}%` }}
                            title={`${REJECTION_CATEGORY_LABELS[item.category] || item.category}: ${item.count}件`}
                          />
                        ))}
                      </div>
                      {/* Legend */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {rejectionDist.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`} />
                            <span className="truncate">{REJECTION_CATEGORY_LABELS[item.category] || item.category}</span>
                            <span className="text-muted-foreground ml-auto">{item.count}件 ({Math.round((item.count / total) * 100)}%)</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* OCR Confidence vs Approval Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              OCR信頼度と承認率の相関
            </CardTitle>
            <CardDescription>OCR信頼度の範囲別に見た承認率</CardDescription>
          </CardHeader>
          <CardContent>
            {ocrLoading ? (
              <Skeleton className="h-48" />
            ) : !ocrCorrelation || ocrCorrelation.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Target className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">データがまだありません</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {ocrCorrelation.map((item, i) => {
                  const approvalPct = item.approvalRate;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">信頼度 {item.confidenceRange}%</span>
                        <span className="text-muted-foreground">{item.total}件</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden flex">
                          <div
                            className="bg-green-500 h-full transition-all"
                            style={{ width: `${approvalPct}%` }}
                          />
                          <div
                            className="bg-red-400 h-full transition-all"
                            style={{ width: `${100 - approvalPct}%` }}
                          />
                        </div>
                        <span className={`text-sm font-medium w-12 text-right ${
                          approvalPct >= 80 ? "text-green-600" : approvalPct >= 60 ? "text-yellow-600" : "text-red-500"
                        }`}>
                          {approvalPct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> 承認</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> 却下</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auto-Approval Simulation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            自動承認シミュレーション
          </CardTitle>
          <CardDescription>
            「OCR信頼度が閾値以上 + 不正フラグなし + 注文番号あり」の条件で自動承認した場合の試算
          </CardDescription>
        </CardHeader>
        <CardContent>
          {simLoading ? (
            <Skeleton className="h-48" />
          ) : !simulation || simulation.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">データが蓄積されるまでお待ちください</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">信頼度閾値</th>
                    <th className="text-right py-2 px-3 font-medium">対象件数</th>
                    <th className="text-right py-2 px-3 font-medium">カバー率</th>
                    <th className="text-right py-2 px-3 font-medium">正解数</th>
                    <th className="text-right py-2 px-3 font-medium">誤判定数</th>
                    <th className="text-right py-2 px-3 font-medium">精度</th>
                    <th className="text-left py-2 px-3 font-medium">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.map((row, i) => {
                    const isRecommended = row.accuracy >= 95 && row.coverageRate >= 20;
                    const isSafe = row.accuracy >= 90;
                    return (
                      <tr key={i} className={`border-b ${isRecommended ? "bg-green-50 dark:bg-green-950/20" : ""}`}>
                        <td className="py-2 px-3 font-medium">≥ {row.confidenceThreshold}%</td>
                        <td className="py-2 px-3 text-right">{row.eligibleCount}件</td>
                        <td className="py-2 px-3 text-right">
                          <span className={row.coverageRate >= 30 ? "text-green-600 font-medium" : ""}>
                            {row.coverageRate}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-green-600">{row.correctCount}</td>
                        <td className="py-2 px-3 text-right text-red-500">{row.wrongCount}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-medium ${
                            row.accuracy >= 95 ? "text-green-600" : row.accuracy >= 90 ? "text-yellow-600" : "text-red-500"
                          }`}>
                            {row.accuracy}%
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {isRecommended ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              推奨
                            </Badge>
                          ) : isSafe ? (
                            <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                              条件付き可
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              リスクあり
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <p className="font-medium mb-1">シミュレーション条件:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>OCR信頼度が閾値以上</li>
                  <li>不正フラグが0件</li>
                  <li>注文番号が正常に検出されている</li>
                </ul>
                <p className="mt-2 text-xs">
                  <strong>精度95%以上 + カバー率20%以上</strong>の閾値が「推奨」として表示されます。
                  十分なデータが蓄積されてから自動承認の有効化を検討してください。
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Collection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            データ蓄積状況
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{totalReviewed}</div>
              <div className="text-sm text-muted-foreground mt-1">蓄積済みレビュー</div>
              <div className="mt-2">
                {totalReviewed >= 100 ? (
                  <Badge className="bg-green-100 text-green-800">十分なデータ量</Badge>
                ) : totalReviewed >= 50 ? (
                  <Badge variant="outline" className="text-yellow-700 border-yellow-300">もう少し必要</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">蓄積中</Badge>
                )}
              </div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">{summary?.rejected ?? 0}</div>
              <div className="text-sm text-muted-foreground mt-1">却下データ</div>
              <div className="text-xs text-muted-foreground mt-1">
                不正パターン学習に使用
              </div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">
                {totalReviewed >= 100 ? "準備完了" : totalReviewed >= 50 ? "あと少し" : "蓄積中"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">自動承認への移行</div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${Math.min((totalReviewed / 100) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {totalReviewed}/100件（推奨最低データ量）
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
