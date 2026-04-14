/**
 * BrandSimulationView - ブランド方がシミュレーション結果を閲覧・回答するページ
 * /brand/simulation/:shareToken でアクセス
 */
import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BarChart3, CheckCircle2, AlertCircle, Loader2, Star,
  TrendingUp, DollarSign, Package, ThumbsUp, Send,
  ArrowRight, Award
} from "lucide-react";

const LCJ_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663045992616/GgA9WvTBCZMf6mjyMMwACw/lcj_logo_e21ead0b.jpg";

export default function BrandSimulationView() {
  const params = useParams<{ shareToken: string }>();
  const shareToken = params.shareToken || "";

  const { data, isLoading, error, refetch } = trpc.brandPortal.getSimulationByToken.useQuery(
    { shareToken },
    { enabled: !!shareToken, retry: false }
  );

  const respondMutation = trpc.brandPortal.respondToSimulation.useMutation();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRespond = async () => {
    if (selectedIndex === null) {
      toast.error("シナリオを選択してください");
      return;
    }
    setSubmitting(true);
    try {
      await respondMutation.mutateAsync({
        shareToken,
        selectedScenarioIndex: selectedIndex,
        brandFeedback: feedback || undefined,
      });
      toast.success("回答を送信しました。ありがとうございます！");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">アクセスできません</h1>
          <p className="text-gray-600">{(error as any)?.message || "このリンクは無効です。"}</p>
        </div>
      </div>
    );
  }

  const { simulation, product } = data;
  const scenarios = (simulation.priceScenarios || []) as any[];
  const isResponded = simulation.status === "responded" || simulation.status === "finalized";
  const recommendedIdx = simulation.recommendedScenarioIndex;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={LCJ_LOGO_URL} alt="LCJ" className="h-8 w-8 rounded-lg object-cover" />
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">価格シミュレーション</h1>
            <p className="text-xs text-gray-500">Live Commerce Japan</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Product info */}
        {product && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{product.productName}</h2>
                {product.productCode && <p className="text-sm text-gray-500 mt-1">SKU: {product.productCode}</p>}
                <div className="flex gap-4 mt-3">
                  {product.listPrice && (
                    <div>
                      <span className="text-xs text-gray-500">通常価格</span>
                      <p className="font-semibold text-gray-700">¥{Number(product.listPrice).toLocaleString()}</p>
                    </div>
                  )}
                  {product.livePrice && (
                    <div>
                      <span className="text-xs text-gray-500">ご希望価格</span>
                      <p className="font-semibold text-blue-600">¥{Number(product.livePrice).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simulation title */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            {simulation.simulationName || "価格シナリオ比較"}
          </h3>
          {simulation.recommendationReason && (
            <p className="text-sm text-gray-600 mt-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
              <strong className="text-blue-700">LCJからのコメント:</strong> {simulation.recommendationReason}
            </p>
          )}
        </div>

        {/* Already responded */}
        {isResponded && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-green-800">回答済みです</h3>
            <p className="text-sm text-green-600 mt-1">
              シナリオ {(simulation.selectedScenarioIndex ?? 0) + 1} を選択されました。
            </p>
            {simulation.brandFeedback && (
              <p className="text-sm text-green-700 mt-2 bg-green-100 p-3 rounded-lg">
                フィードバック: {simulation.brandFeedback}
              </p>
            )}
          </div>
        )}

        {/* Scenario cards */}
        <div className="space-y-4">
          {scenarios.map((scenario: any, idx: number) => {
            const isRecommended = idx === recommendedIdx;
            const isSelected = selectedIndex === idx;
            const wasChosen = isResponded && simulation.selectedScenarioIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => !isResponded && setSelectedIndex(idx)}
                className={`relative bg-white rounded-xl border-2 p-6 transition-all ${
                  wasChosen
                    ? "border-green-400 bg-green-50/30 shadow-md"
                    : isSelected
                    ? "border-blue-500 shadow-lg ring-2 ring-blue-200"
                    : isRecommended
                    ? "border-blue-300 shadow-md"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                } ${!isResponded ? "cursor-pointer" : ""}`}
              >
                {/* Badges */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-bold text-gray-700">
                    シナリオ {idx + 1}: {scenario.label}
                  </span>
                  {isRecommended && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      <Award className="w-3 h-3" />
                      おすすめ
                    </span>
                  )}
                  {wasChosen && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      選択済み
                    </span>
                  )}
                  {isSelected && !isResponded && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded-full">
                      <ThumbsUp className="w-3 h-3" />
                      選択中
                    </span>
                  )}
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <DollarSign className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">ライブ価格</p>
                    <p className="text-lg font-bold text-gray-900">¥{Number(scenario.livePrice).toLocaleString()}</p>
                    <p className="text-xs text-red-500">-{scenario.discountRate}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <Package className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">予想販売数</p>
                    <p className="text-lg font-bold text-gray-900">{scenario.estimatedSalesCount}個</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <TrendingUp className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-xs text-blue-600">予想GMV</p>
                    <p className="text-lg font-bold text-blue-700">¥{Number(scenario.estimatedGmv).toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
                    <p className="text-xs text-green-600">予想利益</p>
                    <p className="text-lg font-bold text-green-700">¥{Number(scenario.estimatedProfit).toLocaleString()}</p>
                  </div>
                </div>

                {scenario.giftItems && (
                  <p className="text-sm text-gray-600 mt-3">
                    <span className="font-medium">贈品:</span> {scenario.giftItems}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Response form */}
        {!isResponded && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h4 className="font-bold text-gray-800 mb-3">ご回答</h4>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                フィードバック（任意）
              </label>
              <Textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="ご要望やご意見がありましたらお書きください..."
                rows={3}
              />
            </div>
            <Button
              onClick={handleRespond}
              disabled={selectedIndex === null || submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {submitting ? "送信中..." : `シナリオ ${(selectedIndex ?? 0) + 1} で回答する`}
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Powered by <strong>Live Commerce Japan</strong></p>
        </div>
      </footer>
    </div>
  );
}
