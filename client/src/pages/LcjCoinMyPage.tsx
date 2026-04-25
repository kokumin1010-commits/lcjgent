import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLiverToken, clearLiverToken } from "@/lib/liverAuth";
import {
  Coins, TrendingUp, Lock, Unlock, Award, Clock, LogOut, ChevronDown, ChevronUp,
  Rocket, Target, ShieldCheck, Gift, ArrowUpRight, BarChart3, History, Trophy,
  Star, Zap, Calendar, User, Crown, Sparkles, Flame, Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function formatYen(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億円`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString()}万円`;
  return `${Math.round(value).toLocaleString()}円`;
}

function formatCoins(value: number): string {
  return value.toLocaleString();
}

function formatTenure(months: number): string {
  const years = Math.floor(months / 12);
  const remainMonths = months % 12;
  if (years > 0 && remainMonths > 0) return `${years}年${remainMonths}ヶ月`;
  if (years > 0) return `${years}年`;
  return `${remainMonths}ヶ月`;
}

export default function LcjCoinMyPage() {
  const [, navigate] = useLocation();
  const [authType, setAuthType] = useState<"staff" | "liver" | null>(null);
  const [showVestingDetail, setShowVestingDetail] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  // Determine auth type on mount
  useEffect(() => {
    const liverToken = getLiverToken();
    if (liverToken) {
      setAuthType("liver");
    } else {
      // Assume staff (cookie-based auth)
      setAuthType("staff");
    }
  }, []);

  const myPageQuery = trpc.lcjCoin.getMyPage.useQuery(
    { authType: authType! },
    {
      enabled: !!authType,
      retry: false,
    }
  );

  // Handle auth errors
  useEffect(() => {
    if (myPageQuery.error) {
      const msg = myPageQuery.error.message || "";
      if (msg.includes("認証") || msg.includes("ログイン")) {
        toast.error("セッションが切れました。再度ログインしてください。");
        navigate("/my/lcj-coin/login");
      }
    }
  }, [myPageQuery.error]);

  const handleLogout = () => {
    if (authType === "liver") {
      clearLiverToken();
      localStorage.removeItem("liver_info");
    }
    // For staff, cookie will be cleared by navigating away
    window.location.href = "/my/lcj-coin/login";
  };

  if (!authType || myPageQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Coins className="w-10 h-10 text-amber-400" />
          <p className="text-slate-400 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (myPageQuery.isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-800/50 border-slate-700/50 max-w-md w-full">
          <CardContent className="p-6 text-center">
            <p className="text-red-400 mb-4">{myPageQuery.error?.message || "データの取得に失敗しました"}</p>
            <Button onClick={() => navigate("/my/lcj-coin/login")} variant="outline" className="border-slate-600 text-slate-300">
              ログイン画面に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = myPageQuery.data!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">LCJ Coin</h1>
              <p className="text-slate-500 text-xs">マイページ</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors p-2">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* VIP Ranking Banner (Screenshot-worthy) */}
        {(data as any).rank > 0 && (() => {
          const rank = (data as any).rank;
          const percentile = (data as any).percentile;
          const totalSameType = (data as any).totalSameType;
          const tierInfo = (data as any).tierInfo;
          const isTopTier = percentile >= 90;
          const isCreator = data.holderType === "liver";
          const tierBadgeColor = tierInfo?.tierCode === "L-S" || tierInfo?.tierCode === "S"
            ? "from-violet-500 to-purple-600"
            : tierInfo?.tierCode === "L-A" || tierInfo?.tierCode === "A"
              ? "from-pink-500 to-rose-600"
              : tierInfo?.tierCode === "B"
                ? "from-amber-500 to-orange-600"
                : "from-slate-500 to-slate-600";
          return (
            <div className={`relative overflow-hidden rounded-2xl p-[1px] ${
              isTopTier
                ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 animate-pulse'
                : 'bg-gradient-to-r from-slate-600 to-slate-700'
            }`}>
              <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-5 overflow-hidden">
                {/* Background glow */}
                {isTopTier && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />
                )}
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Rank circle */}
                    <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center ${
                      rank === 1 ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30'
                        : rank <= 3 ? 'bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg shadow-slate-400/20'
                          : 'bg-gradient-to-br from-slate-700 to-slate-800'
                    }`}>
                      {rank <= 3 && <Crown className={`w-4 h-4 ${rank === 1 ? 'text-white' : 'text-slate-700'} -mb-0.5`} />}
                      <span className={`text-2xl font-black ${rank <= 3 ? (rank === 1 ? 'text-white' : 'text-slate-700') : 'text-white'}`}>
                        {rank}
                      </span>
                    </div>
                    <div>
                      <div className="text-white font-bold text-lg">
                        {isCreator ? 'ライバー' : 'スタッフ'}ランキング
                      </div>
                      <div className="text-slate-400 text-sm">
                        全{totalSameType}名中 <span className="text-white font-bold">{rank}位</span>
                        {percentile >= 90 && <span className="text-amber-400 ml-2 font-bold">トップ{100 - percentile > 0 ? (100 - percentile) : 1}%</span>}
                      </div>
                    </div>
                  </div>
                  {/* Tier Badge */}
                  {tierInfo && (
                    <div className="text-right">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r ${tierBadgeColor} shadow-lg`}>
                        {isCreator ? <Sparkles className="w-4 h-4 text-white" /> : <Shield className="w-4 h-4 text-white" />}
                        <span className="text-white font-bold text-sm">Tier {tierInfo.tierCode}</span>
                      </div>
                      <div className="text-slate-400 text-xs mt-1">{tierInfo.tierName}</div>
                    </div>
                  )}
                </div>
                {/* Percentile bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500 text-xs">パーセンタイル</span>
                    <span className={`text-xs font-bold ${percentile >= 90 ? 'text-amber-400' : percentile >= 70 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      上位 {Math.max(1, 100 - percentile)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        percentile >= 90 ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                          : percentile >= 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : 'bg-gradient-to-r from-blue-400 to-blue-500'
                      }`}
                      style={{ width: `${percentile}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Profile Card */}
        <Card className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 border-slate-700/50 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              {data.holderAvatar ? (
                <img src={data.holderAvatar} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-amber-500/30" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/20 flex items-center justify-center border-2 border-amber-500/30">
                  <User className="w-7 h-7 text-amber-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-lg truncate">{data.holderName}</h2>
                <div className="flex items-center gap-2">
                  <p className="text-slate-400 text-sm">{data.holderPosition || (data.holderType === "staff" ? "スタッフ" : "ライバー")}</p>
                  {(data as any).tierInfo && (
                    <Badge className={`text-[10px] px-1.5 py-0 ${
                      (data as any).tierInfo.tierCode?.startsWith('L-') 
                        ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}>
                      {(data as any).tierInfo.tierCode}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-slate-500 text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    在籍 {formatTenure(data.tenureMonths)}
                  </span>
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 px-2 py-0">
                    Lv.{data.level}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Asset Value - Hero Display (Screenshot-worthy) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 border border-slate-700/50 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="relative text-center">
            <p className="text-slate-400 text-xs font-medium mb-2 tracking-wider uppercase">保有資産総額</p>
            <p className="text-white font-black text-4xl tracking-tight">
              {formatYen(data.totalValue)}
            </p>
            <p className="text-slate-500 text-sm mt-1 font-mono">{formatCoins(data.totalCoins)} LCJ Coins</p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="text-center">
                <p className="text-emerald-400 font-bold text-lg">{formatYen(data.vestedValue)}</p>
                <p className="text-slate-500 text-[10px]">確定済み</p>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-orange-400 font-bold text-lg">{formatYen(data.unvestedValue)}</p>
                <p className="text-slate-500 text-[10px]">未確定</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coin Price & Key Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardContent className="p-3 text-center">
              <TrendingUp className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{data.coinPrice.toFixed(2)}円</p>
              <p className="text-slate-500 text-[10px]">コイン単価</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardContent className="p-3 text-center">
              <Lock className="w-4 h-4 text-orange-400 mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{formatCoins(data.unvestedCoins)}</p>
              <p className="text-slate-500 text-[10px]">未確定コイン</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardContent className="p-3 text-center">
              <Coins className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{formatYen(data.valuation)}</p>
              <p className="text-slate-500 text-[10px]">時価総額</p>
            </CardContent>
          </Card>
        </div>

        {/* XP Progress */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-white font-semibold text-sm">レベル {data.level}</span>
              </div>
              <span className="text-slate-400 text-xs">{data.xp.toLocaleString()} XP</span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-amber-400 to-amber-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(data.xpProgress, 100)}%` }}
              />
            </div>
            <p className="text-slate-500 text-xs mt-1.5">次のレベルまで {data.xpToNextLevel.toLocaleString()} XP</p>
          </CardContent>
        </Card>

        {/* IPO Projections */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Rocket className="w-4 h-4 text-purple-400" />
              IPO時の予想価値
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {[
                { label: "時価総額 1,000億円", value: data.ipoProjection1000, color: "text-purple-400" },
                { label: "時価総額 300億円", value: data.ipoProjection300, color: "text-blue-400" },
                { label: "時価総額 100億円", value: data.ipoProjection100, color: "text-emerald-400" },
              ].map((proj) => (
                <div key={proj.label} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
                  <span className="text-slate-400 text-sm">{proj.label}</span>
                  <span className={`font-bold text-sm ${proj.color}`}>{formatYen(proj.value)}</span>
                </div>
              ))}
            </div>
            {data.loseByQuitting > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-xs font-medium">退職時に失う未確定コイン</p>
                <p className="text-red-300 font-bold text-lg mt-0.5">{formatYen(data.loseByQuitting)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Valuation History Chart */}
        {data.valuationHistory.length > 0 && (
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                時価総額の推移
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="h-40 flex items-end gap-1">
                {data.valuationHistory.map((v: any, i: number) => {
                  const maxVal = Math.max(...data.valuationHistory.map((h: any) => Number(h.valuationAmount)));
                  const height = maxVal > 0 ? (Number(v.valuationAmount) / maxVal) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm min-h-[2px] transition-all duration-300"
                        style={{ height: `${height}%` }}
                        title={`${v.yearMonth}: ${formatYen(Number(v.valuationAmount))}`}
                      />
                      {i % Math.max(1, Math.floor(data.valuationHistory.length / 6)) === 0 && (
                        <span className="text-slate-500 text-[9px] -rotate-45 origin-left whitespace-nowrap">
                          {v.yearMonth.slice(2)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vesting Schedules */}
        {data.vestingSchedules.length > 0 && (
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="px-4 pt-4 pb-2">
              <button
                onClick={() => setShowVestingDetail(!showVestingDetail)}
                className="flex items-center justify-between w-full"
              >
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ベスティングスケジュール ({data.vestingSchedules.length}件)
                </CardTitle>
                {showVestingDetail ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </CardHeader>
            {showVestingDetail && (
              <CardContent className="px-4 pb-4 space-y-3">
                {data.vestingSchedules.map((vs: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300 text-sm font-medium">
                        {new Date(vs.grantDate).toLocaleDateString("ja-JP")} 付与
                      </span>
                      <Badge variant="outline" className={`text-xs ${vs.cliffPassed ? "border-emerald-500/30 text-emerald-400" : "border-orange-500/30 text-orange-400"}`}>
                        {vs.cliffPassed ? "クリフ通過" : "クリフ期間中"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-slate-400">{formatCoins(vs.totalGrantCoins)} コイン</span>
                      <span className="text-white font-semibold">{vs.vestedPercent.toFixed(1)}% 確定</span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(vs.vestedPercent, 100)}%` }}
                      />
                    </div>
                    <p className="text-slate-500 text-xs mt-1.5">
                      {vs.vestingPeriodMonths}ヶ月ベスティング / クリフ {vs.cliffMonths}ヶ月 / 経過 {vs.monthsElapsed}ヶ月
                    </p>
                    {vs.reason && <p className="text-slate-400 text-xs mt-1">理由: {vs.reason}</p>}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )}

        {/* Transaction History */}
        {data.recentTransactions.length > 0 && (
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="px-4 pt-4 pb-2">
              <button
                onClick={() => setShowTransactions(!showTransactions)}
                className="flex items-center justify-between w-full"
              >
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  コイン付与履歴 ({data.recentTransactions.length}件)
                </CardTitle>
                {showTransactions ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </CardHeader>
            {showTransactions && (
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {data.recentTransactions.map((tx: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300 text-sm truncate">{tx.reason || tx.transactionType}</p>
                        <p className="text-slate-500 text-xs">{new Date(tx.createdAt).toLocaleDateString("ja-JP")}</p>
                      </div>
                      <div className="text-right ml-3">
                        <p className={`font-semibold text-sm ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {tx.amount > 0 ? "+" : ""}{formatCoins(tx.amount)}
                        </p>
                        {tx.xpEarned > 0 && (
                          <p className="text-amber-400 text-xs">+{tx.xpEarned} XP</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Badges */}
        {data.badges.length > 0 && (
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                獲得バッジ ({data.badges.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-2">
                {data.badges.map((badge: any, i: number) => (
                  <div key={i} className="flex flex-col items-center p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                    <span className="text-2xl mb-1">{badge.icon || "🏅"}</span>
                    <p className="text-white text-xs font-medium text-center truncate w-full">{badge.name}</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">
                      {new Date(badge.awardedAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Peer Bonuses */}
        {data.peerBonusesReceived.length > 0 && (
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Gift className="w-4 h-4 text-pink-400" />
                ピアボーナス受信 ({data.peerBonusesReceived.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {data.peerBonusesReceived.map((pb: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
                  <div>
                    <p className="text-slate-300 text-sm">{pb.message || "称賛"}</p>
                    <p className="text-slate-500 text-xs">{new Date(pb.createdAt).toLocaleDateString("ja-JP")}</p>
                  </div>
                  <span className="text-emerald-400 font-semibold text-sm">+{pb.amount}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {data.totalCoins === 0 && data.badges.length === 0 && (
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardContent className="p-8 text-center">
              <Coins className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">まだコインが付与されていません</p>
              <p className="text-slate-500 text-xs mt-1">管理者からコインが付与されると、ここに表示されます</p>
            </CardContent>
          </Card>
        )}

        {/* Footer spacing */}
        <div className="h-8" />
      </main>
    </div>
  );
}
