import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Package,
  Clock,
  Users,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Gift,
  Tag,
  Percent,
  ShoppingBag,
} from "lucide-react";

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  if (isNaN(num)) return "¥0";
  return `¥${Math.round(num).toLocaleString("ja-JP")}`;
}

function calcDiscountRate(original: number, selling: number): string {
  if (!original || original <= 0) return "—";
  const rate = Math.round(((original - selling) / original) * 100);
  return `${rate}%`;
}

export default function ProposalPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = trpc.simulation.getByToken.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto px-4 space-y-6">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">提案が見つかりません</h2>
            <p className="text-slate-500">このURLは無効か、期限切れの可能性があります。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sim = data;
  const estimatedNetProfit = Number(sim.estimatedNetProfit) || 0;
  const estimatedRoi = Number(sim.estimatedRoi) || 0;
  const estimatedGmv = Number(sim.estimatedGmv) || 0;
  const estimatedGrossProfit = Number(sim.estimatedGrossProfit) || 0;
  const estimatedLiverCost = Number(sim.estimatedLiverCost) || 0;
  const estimatedSalesCount = Number(sim.estimatedSalesCount) || 0;
  const fixedFee = Number(sim.fixedFee) || 0;
  const aiPrediction = sim.aiPrediction as { confidence?: number; gmvRange?: { min: number; max: number }; similarCases?: { avgGmv: number; avgRoi: number; count: number }; reasoning?: string } | null;
  const aiConfidence = aiPrediction?.confidence || 0;
  const aiReasoning = aiPrediction?.reasoning || null;

  // Bundle/set info
  const hasSet = sim.hasSet ?? false;
  const bundleName = sim.bundleName || "";
  const bundlePrice = Number(sim.bundlePrice) || 0;
  const bundleItems = (sim.bundleItems as Array<{ name: string; price: number }>) || [];
  const listPrice = Number(sim.listPrice) || 0;
  const sellingPrice = Number(sim.sellingPrice) || 0;

  // Calculate totals for bundle
  const bundleTotalListPrice = bundleItems.reduce((sum, item) => sum + (item.price || 0), 0);
  const bundleDiscountRate = bundleTotalListPrice > 0
    ? Math.round(((bundleTotalListPrice - bundlePrice) / bundleTotalListPrice) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">配信シミュレーション結果</h1>
              <p className="text-sm text-slate-500">LCJ MALL ライブコマース</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Product / Bundle Info Section */}
        {hasSet && bundleItems.length > 0 ? (
          /* ===== セット商品セクション ===== */
          <Card className="shadow-sm border-t-4 border-t-indigo-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-indigo-500" />
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">セット商品構成</h2>
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                  セット販売
                </Badge>
              </div>

              {/* Bundle name & price overview */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-4 mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">セット名</div>
                    <div className="text-lg font-bold text-slate-800">{bundleName || "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 mb-1">セット販売価格</div>
                    <div className="text-2xl font-bold text-indigo-600">{formatCurrency(bundlePrice)}</div>
                  </div>
                </div>
              </div>

              {/* Bundle items list */}
              <div className="mb-4">
                <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  セット内容（{bundleItems.length}点）
                </div>
                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {bundleItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-medium">
                          {idx + 1}
                        </span>
                        <span className="text-sm text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-600">{formatCurrency(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & discount */}
              <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-xs text-slate-400 mb-1">元値合計（定価）</div>
                  <div className="text-lg font-bold text-slate-600 line-through decoration-red-400">
                    {formatCurrency(bundleTotalListPrice)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-400 mb-1">セット販売価格</div>
                  <div className="text-lg font-bold text-indigo-600">
                    {formatCurrency(bundlePrice)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-400 mb-1">割引率</div>
                  <div className="flex items-center justify-center gap-1">
                    <Percent className="w-4 h-4 text-red-500" />
                    <span className="text-lg font-bold text-red-500">
                      {bundleDiscountRate > 0 ? `${bundleDiscountRate}%OFF` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* ===== 単品商品セクション ===== */
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-5 h-5 text-blue-500" />
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">商品情報</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sim.productName && (
                  <div className="col-span-2 md:col-span-4">
                    <div className="text-xs text-slate-400">商品名</div>
                    <div className="text-sm font-medium text-slate-700">{sim.productName}</div>
                  </div>
                )}
                {listPrice > 0 && (
                  <div>
                    <div className="text-xs text-slate-400">定価</div>
                    <div className="text-sm font-medium text-slate-500 line-through">{formatCurrency(listPrice)}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-slate-400">販売価格</div>
                  <div className="text-sm font-bold text-slate-700">
                    {formatCurrency(sellingPrice > 0 ? sellingPrice : sim.unitPrice)}
                  </div>
                </div>
                {listPrice > 0 && sellingPrice > 0 && listPrice > sellingPrice && (
                  <div>
                    <div className="text-xs text-slate-400">割引率</div>
                    <div className="text-sm font-bold text-red-500">
                      {calcDiscountRate(listPrice, sellingPrice)}OFF
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conditions Summary */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">実施条件</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-slate-400">配信時間</div>
                <div className="text-sm font-medium text-slate-700">{sim.streamDuration}分</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">成果報酬率</div>
                <div className="text-sm font-medium text-slate-700">{sim.commissionRate}%</div>
              </div>
              {fixedFee > 0 && (
                <div>
                  <div className="text-xs text-slate-400">固定報酬</div>
                  <div className="text-sm font-medium text-slate-700">{formatCurrency(fixedFee)}</div>
                </div>
              )}
              {sim.liverName && (
                <div>
                  <div className="text-xs text-slate-400">ライバー</div>
                  <div className="text-sm font-medium text-slate-700">{sim.liverName}</div>
                </div>
              )}
              {sim.timeSlot && (
                <div>
                  <div className="text-xs text-slate-400">時間帯</div>
                  <div className="text-sm font-medium text-slate-700">{sim.timeSlot}</div>
                </div>
              )}
              {sim.dayOfWeek && (
                <div>
                  <div className="text-xs text-slate-400">曜日</div>
                  <div className="text-sm font-medium text-slate-700">{sim.dayOfWeek}</div>
                </div>
              )}
              {sim.hasAd && (
                <div>
                  <div className="text-xs text-slate-400">広告予算</div>
                  <div className="text-sm font-medium text-slate-700">{formatCurrency(sim.adBudget)}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Key Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-slate-500">想定売上（GMV）</span>
              </div>
              <div className="text-3xl font-bold text-slate-800">
                {formatCurrency(estimatedGmv)}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-slate-500">想定利益</span>
              </div>
              <div className={`text-3xl font-bold ${estimatedNetProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(estimatedNetProfit)}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-amber-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-medium text-slate-500">ROI</span>
              </div>
              <div className={`text-3xl font-bold ${estimatedRoi >= 0 ? "text-amber-600" : "text-red-600"}`}>
                {estimatedRoi}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">詳細指標</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <Package className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-800">{estimatedSalesCount.toLocaleString()}</div>
                <div className="text-xs text-slate-400">想定販売数</div>
              </div>
              <div className="text-center">
                <DollarSign className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-800">{formatCurrency(estimatedGrossProfit)}</div>
                <div className="text-xs text-slate-400">粗利</div>
              </div>
              <div className="text-center">
                <Users className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-800">{formatCurrency(estimatedLiverCost)}</div>
                <div className="text-xs text-slate-400">ライバー報酬合計</div>
              </div>
              <div className="text-center">
                <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-800">{sim.streamDuration}分</div>
                <div className="text-xs text-slate-400">配信時間</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Reasoning */}
        {aiReasoning && (
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h2 className="text-sm font-semibold text-slate-500">AI分析コメント</h2>
                {aiConfidence > 0 && (
                  <Badge variant="outline" className="text-xs">
                    信頼度 {aiConfidence}%
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{aiReasoning}</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 py-4">
          <p>このシミュレーション結果は過去の配信実績データとAI予測に基づいています。</p>
          <p>実際の結果は市場環境や配信内容により変動する可能性があります。</p>
        </div>
      </div>
    </div>
  );
}
