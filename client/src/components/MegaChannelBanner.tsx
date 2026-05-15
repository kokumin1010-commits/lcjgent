import { trpc } from "@/lib/trpc";
import { Crown, TrendingUp, Zap, Star, Lock, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function MegaChannelBanner() {
  const { data, isLoading } = trpc.liver.getMegaChannelStatus.useQuery();

  if (isLoading) return null;
  if (!data?.settings?.isActive) return null;

  const settings = data.settings;
  const rateData = data.rateData;
  const qualification = data.qualification;

  const avgHourlyRate = rateData?.avgHourlyRate || 0;
  const threshold = settings.hourlyRateThreshold || 100000;
  const progress = Math.min((avgHourlyRate / threshold) * 100, 100);
  const isQualified = avgHourlyRate >= threshold;
  const status = qualification?.status || "not_qualified";

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(num);

  // Approved - メガチャンネル配信可能
  if (status === "approved") {
    return (
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-yellow-600/30 via-amber-500/20 to-yellow-600/30 border border-yellow-500/40 p-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
            <Crown className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-yellow-400 font-bold text-sm">
                {settings.tierName || "Gold"} ティア
              </span>
              <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">配信可能</Badge>
            </div>
            <p className="text-xs text-gray-300">
              <span className="text-yellow-300 font-bold">{settings.channelName || "メガチャンネル"}</span>
              での配信権利を獲得しています
              {settings.channelFollowerCount > 0 && (
                <span className="text-gray-400 ml-1">
                  （フォロワー {(settings.channelFollowerCount / 10000).toFixed(1)}万人）
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-gray-400">現在の時間単価:</span>
              <span className="text-sm font-bold text-yellow-400">{formatCurrency(avgHourlyRate)}/h</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Qualified - 承認待ち
  if (status === "qualified") {
    return (
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-600/20 via-amber-500/10 to-orange-600/20 border border-orange-500/30 p-4">
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 animate-pulse">
            <Star className="w-6 h-6 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-orange-400 font-bold text-sm">メガチャンネル資格達成!</span>
              <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">承認待ち</Badge>
            </div>
            <p className="text-xs text-gray-300">
              条件を達成しました。管理者の承認をお待ちください。
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-gray-400">平均時間単価:</span>
              <span className="text-sm font-bold text-orange-400">{formatCurrency(avgHourlyRate)}/h</span>
              <span className="text-[10px] text-gray-500">（閾値: {formatCurrency(threshold)}/h）</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not qualified - 未達成（プログレス表示）
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-gray-800/80 via-gray-800/60 to-gray-800/80 border border-gray-700 p-4">
      <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">メガチャンネル配信制度</span>
              {status === "rejected" && (
                <Badge className="bg-red-600/80 text-white text-[10px] px-1.5 py-0">再チャレンジ可</Badge>
              )}
            </div>
            <p className="text-[11px] text-gray-400">
              時間単価 {formatCurrency(threshold)}/h 達成で{settings.channelName || "メガチャンネル"}配信権利を獲得
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              直近{rateData?.recentLivestreamCount || 0}回の平均時間単価
            </span>
            <span className={`font-bold ${isQualified ? "text-yellow-400" : "text-white"}`}>
              {formatCurrency(avgHourlyRate)}/h
            </span>
          </div>
          <div className="relative">
            <Progress value={progress} className="h-2.5 bg-gray-700" />
            {progress < 100 && (
              <div
                className="absolute top-0 right-0 h-full flex items-center"
                style={{ right: `${100 - progress}%` }}
              >
                <div className="w-0.5 h-4 bg-yellow-400/50 -translate-y-0.5" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-500">¥0</span>
            <span className="text-yellow-400/70 flex items-center gap-0.5">
              <Crown className="w-3 h-3" />
              {formatCurrency(threshold)}/h
            </span>
          </div>
        </div>

        {/* Remaining amount */}
        {!isQualified && avgHourlyRate > 0 && (
          <div className="mt-2 text-center">
            <span className="text-[11px] text-gray-400">
              あと <span className="text-yellow-400 font-bold">{formatCurrency(threshold - avgHourlyRate)}/h</span> で達成
            </span>
          </div>
        )}

        {/* No livestream data */}
        {(!rateData || rateData.recentLivestreamCount === 0) && (
          <div className="mt-2 text-center text-[11px] text-gray-500">
            配信実績がまだありません。配信を始めましょう!
          </div>
        )}

        {/* Recent livestream details */}
        {rateData && rateData.livestreams && rateData.livestreams.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-[10px] text-gray-500 mb-1">直近の配信実績:</div>
            {rateData.livestreams.map((ls: any, idx: number) => (
              <div key={ls.id || idx} className="flex items-center justify-between text-[10px] bg-gray-900/50 rounded px-2 py-1">
                <span className="text-gray-400">
                  {ls.livestreamDate ? new Date(ls.livestreamDate).toLocaleDateString("ja-JP") : "-"}
                </span>
                <span className="text-gray-300">
                  GMV {formatCurrency(ls.salesAmount)} / {ls.durationHours}h
                </span>
                <span className={`font-medium ${ls.hourlyRate >= threshold ? "text-yellow-400" : "text-gray-300"}`}>
                  {formatCurrency(ls.hourlyRate)}/h
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
