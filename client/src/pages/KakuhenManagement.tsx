import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  Trophy,
  TrendingUp,
  BarChart3,
  Users,
  Gift,
  Percent,
  Target,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Sparkles,
} from "lucide-react";

function formatDate(dateStr: string | number | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function KakuhenManagement() {
  // Fetch stats
  const { data: stats, isLoading: statsLoading } = trpc.kakuhen.stats.useQuery();
  // Fetch jackpot winners
  const { data: winners, isLoading: winnersLoading } = trpc.kakuhen.jackpotWinners.useQuery({ limit: 20 });

  const totalPlays = stats?.totalPlays || 0;
  const jackpotCount = stats?.jackpotCount || 0;
  const kakuhenCount = stats?.kakuhenCount || 0;
  const totalBonusPoints = stats?.totalBonusPoints || 0;
  const kakuhenRate = totalPlays > 0 ? ((Number(kakuhenCount) / Number(totalPlays)) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">総プレイ回数</span>
              <Zap className="h-4 w-4 text-orange-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{totalPlays.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">全額還元当選</span>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{jackpotCount}</span>
                <span className="text-xs text-muted-foreground">回</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">確変発動率</span>
              <Percent className="h-4 w-4 text-emerald-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{kakuhenRate}%</span>
                <span className="text-xs text-muted-foreground">({Number(kakuhenCount)}回)</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">ブースト付与pt</span>
              <Sparkles className="h-4 w-4 text-pink-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{Number(totalBonusPoints).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kakuhen Mechanism Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            確変チャンスの仕組み
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">還元率UP</span>
              </div>
              <p className="text-xs text-muted-foreground">
                TikTok URL入力で基本還元率1%が最大1.5%にUP。メーターアニメーションで演出。
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-yellow-500" />
                <span className="font-medium text-sm">全額還元抽選</span>
              </div>
              <p className="text-xs text-muted-foreground">
                スロット演出で全額ポイントバックのチャンス。当選番号がランダム生成される。
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-pink-500" />
                <span className="font-medium text-sm">レビュー必須</span>
              </div>
              <p className="text-xs text-muted-foreground">
                確変チャンス参加にはレシート認証済みレビュー（星評価＋一言）が必須。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jackpot Winners */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            全額還元 当選者一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          {winnersLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : winners && winners.length > 0 ? (
            <div className="space-y-3">
              {winners.map((winner: any) => (
                <div key={winner.id} className="flex items-center gap-4 p-4 rounded-lg border bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-950/10 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{winner.userName || "ユーザー"}</span>
                      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
                        全額還元
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {Number(winner.orderAmount || 0).toLocaleString()}円 → {Number(winner.actualPoints || 0).toLocaleString()}pt
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(winner.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-yellow-600">100%</div>
                    <div className="text-xs text-muted-foreground">還元</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">まだ全額還元の当選者はいません</p>
              <p className="text-xs text-muted-foreground mt-1">
                確変チャンスで全額還元に当選すると、ここに表示されます
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
