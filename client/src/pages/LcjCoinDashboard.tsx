/**
 * LCJ Coin Dashboard - ファントムストック報酬システム
 * 
 * 脳汁バグバグなゲーミング要素満載のダッシュボード
 * - リアルタイム時価総額メーター
 * - 資産グラフ（株チャート風）
 * - レベル・バッジ・ランキング
 * - コイン付与・設定管理
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Coins, TrendingUp, Users, Trophy, Star, Zap, Gift, Award,
  ArrowUpRight, ArrowDownRight, Crown, Flame, Target, Sparkles,
  Settings, Plus, BarChart3, Medal, Shield, Gem, ChevronRight,
  Clock, Calendar, Rocket, Heart
} from "lucide-react";

// ============================================================
// Animated Counter Component
// ============================================================
function AnimatedCounter({ value, prefix = "", suffix = "", decimals = 0, duration = 1500 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number; duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span className="tabular-nums">
      {prefix}{displayValue.toLocaleString("ja-JP", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

// ============================================================
// Sparkline Mini Chart
// ============================================================
function Sparkline({ data, color = "#10b981", height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
      <polygon
        fill={`url(#sparkGrad-${color.replace("#", "")})`}
        points={`0,${height} ${points} ${width},${height}`}
      />
    </svg>
  );
}

// ============================================================
// XP Progress Bar
// ============================================================
function XpBar({ xp, xpToNext, level, progress }: { xp: number; xpToNext: number; level: number; progress: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-amber-500/30">
              {level}
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 animate-pulse" />
          </div>
          <div>
            <span className="font-semibold text-foreground">Level {level}</span>
            <p className="text-xs text-muted-foreground">{xp.toLocaleString()} XP</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Next: {xpToNext.toLocaleString()} XP</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 transition-all duration-1000 ease-out relative"
          style={{ width: `${Math.min(progress, 100)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Rarity Badge Colors
// ============================================================
const rarityConfig: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  common: { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-600 dark:text-zinc-300", border: "border-zinc-300 dark:border-zinc-600", glow: "" },
  rare: { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-600 dark:text-blue-300", border: "border-blue-300 dark:border-blue-600", glow: "shadow-blue-500/20" },
  epic: { bg: "bg-purple-50 dark:bg-purple-950", text: "text-purple-600 dark:text-purple-300", border: "border-purple-400 dark:border-purple-600", glow: "shadow-purple-500/30" },
  legendary: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-600 dark:text-amber-300", border: "border-amber-400 dark:border-amber-500", glow: "shadow-amber-500/40" },
};

// ============================================================
// Badge Card Component
// ============================================================
function BadgeCard({ badge, earned = false }: { badge: any; earned?: boolean }) {
  const config = rarityConfig[badge.rarity] || rarityConfig.common;
  return (
    <div className={`relative p-4 rounded-xl border-2 ${config.border} ${config.bg} ${earned ? `shadow-lg ${config.glow}` : "opacity-40 grayscale"} transition-all hover:scale-105 cursor-default`}>
      {badge.rarity === "legendary" && earned && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400/10 via-yellow-300/10 to-amber-400/10 animate-pulse" />
      )}
      <div className="text-center space-y-2 relative">
        <div className="text-3xl">{badge.iconEmoji || "🏅"}</div>
        <div className={`font-bold text-sm ${config.text}`}>{badge.name}</div>
        <Badge variant="outline" className={`text-[10px] ${config.text} ${config.border}`}>
          {badge.rarity?.toUpperCase()}
        </Badge>
        {badge.description && (
          <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
        )}
        {earned && badge.awardedAt && (
          <p className="text-[10px] text-muted-foreground">
            {new Date(badge.awardedAt).toLocaleDateString("ja-JP")} 獲得
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Leaderboard Row
// ============================================================
function LeaderboardRow({ entry, index }: { entry: any; index: number }) {
  const rankIcons: Record<number, JSX.Element> = {
    1: <Crown className="w-5 h-5 text-yellow-500" />,
    2: <Medal className="w-5 h-5 text-gray-400" />,
    3: <Medal className="w-5 h-5 text-amber-700" />,
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-accent/50 ${index < 3 ? "bg-accent/20" : ""}`}>
      <div className="w-8 h-8 flex items-center justify-center font-bold text-sm">
        {rankIcons[entry.rank] || <span className="text-muted-foreground">#{entry.rank}</span>}
      </div>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold border">
        {entry.name?.charAt(0) || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{entry.name}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Lv.{entry.level}</span>
          <span className="text-primary">{entry.holderType === "liver" ? "ライバー" : "スタッフ"}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-sm">¥{Number(entry.totalValue || 0).toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{Number(entry.totalCoins || 0).toLocaleString()} coins</div>
      </div>
    </div>
  );
}

// ============================================================
// Transaction Type Config
// ============================================================
const txTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  grant: { label: "付与", icon: Gift, color: "text-green-500" },
  refresh_grant: { label: "リフレッシュ", icon: Rocket, color: "text-blue-500" },
  vest: { label: "ベスティング", icon: Shield, color: "text-purple-500" },
  exercise: { label: "行使", icon: ArrowUpRight, color: "text-orange-500" },
  bonus: { label: "ボーナス", icon: Star, color: "text-yellow-500" },
  season_reward: { label: "シーズン報酬", icon: Trophy, color: "text-amber-500" },
  achievement: { label: "実績", icon: Award, color: "text-pink-500" },
  penalty: { label: "ペナルティ", icon: ArrowDownRight, color: "text-red-500" },
  adjustment: { label: "調整", icon: Settings, color: "text-gray-500" },
};

// ============================================================
// Main Dashboard Component
// ============================================================
export default function LcjCoinDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [grantDialog, setGrantDialog] = useState(false);
  const [grantForm, setGrantForm] = useState({
    holderType: "staff" as "staff" | "liver",
    holderId: 0,
    coinAmount: 10000,
    reason: "",
    vestingType: "backloaded" as "backloaded" | "frontloaded" | "flat" | "custom",
  });
  const [valuationDialog, setValuationDialog] = useState(false);
  const [valuationForm, setValuationForm] = useState({
    yearMonth: new Date().toISOString().slice(0, 7),
    monthlyRevenue: 0,
    notes: "",
  });

  // Queries
  const dashboardQuery = trpc.lcjCoin.getDashboard.useQuery();
  const leaderboardQuery = trpc.lcjCoin.getLeaderboard.useQuery({ sortBy: "totalValue", limit: 20 });
  const badgesQuery = trpc.lcjCoin.getAllBadges.useQuery();
  const seasonsQuery = trpc.lcjCoin.getSeasons.useQuery();
  const settingsQuery = trpc.lcjCoin.getSettings.useQuery();
  const holdersQuery = trpc.lcjCoin.getAllHolders.useQuery({ page: 1, limit: 50 });
  const targetsQuery = trpc.lcjCoin.getGrantTargets.useQuery();

  // Mutations
  const grantMutation = trpc.lcjCoin.grantCoins.useMutation({
    onSuccess: () => {
      toast.success("コインを付与しました！");
      setGrantDialog(false);
      dashboardQuery.refetch();
      holdersQuery.refetch();
      leaderboardQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const recordValuationMutation = trpc.lcjCoin.recordValuation.useMutation({
    onSuccess: (data) => {
      toast.success(`時価総額を記録しました！ ¥${Number(data.valuation).toLocaleString()}`);
      setValuationDialog(false);
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const updateSettingMutation = trpc.lcjCoin.updateSetting.useMutation({
    onSuccess: () => {
      toast.success("設定を更新しました");
      settingsQuery.refetch();
      dashboardQuery.refetch();
    },
  });

  const dashboard = dashboardQuery.data;
  const leaderboard = leaderboardQuery.data;

  // Sparkline data from valuation history
  const sparklineData = useMemo(() => {
    if (!dashboard?.valuationHistory?.length) return [0, 0, 0];
    return [...dashboard.valuationHistory].reverse().map(v => Number(v.valuationAmount));
  }, [dashboard?.valuationHistory]);

  const coinPriceHistory = useMemo(() => {
    if (!dashboard?.valuationHistory?.length) return [0, 0, 0];
    return [...dashboard.valuationHistory].reverse().map(v => Number(v.coinPrice));
  }, [dashboard?.valuationHistory]);

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative">
            <Coins className="w-16 h-16 text-primary mx-auto animate-bounce" />
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-ping" />
          </div>
          <p className="text-muted-foreground animate-pulse">LCJコインシステムを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
              <Coins className="w-6 h-6 text-white" />
            </div>
            LCJコイン
          </h1>
          <p className="text-sm text-muted-foreground">ファントムストック報酬システム</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={valuationDialog} onOpenChange={setValuationDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-1" />
                時価総額記録
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>月次時価総額を記録</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>年月</Label>
                  <Input
                    type="month"
                    value={valuationForm.yearMonth}
                    onChange={(e) => setValuationForm(f => ({ ...f, yearMonth: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>月間売上（円）</Label>
                  <Input
                    type="number"
                    value={valuationForm.monthlyRevenue}
                    onChange={(e) => setValuationForm(f => ({ ...f, monthlyRevenue: Number(e.target.value) }))}
                    placeholder="例: 10000000"
                  />
                </div>
                <div>
                  <Label>メモ</Label>
                  <Input
                    value={valuationForm.notes}
                    onChange={(e) => setValuationForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="任意のメモ"
                  />
                </div>
                {valuationForm.monthlyRevenue > 0 && (
                  <div className="p-3 rounded-lg bg-accent/50 text-sm space-y-1">
                    <div>年間売上: ¥{(valuationForm.monthlyRevenue * 12).toLocaleString()}</div>
                    <div>擬似時価総額: <span className="font-bold text-primary">¥{(valuationForm.monthlyRevenue * 12 * (dashboard?.valuation?.psrMultiplier || 5)).toLocaleString()}</span></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">キャンセル</Button></DialogClose>
                <Button onClick={() => recordValuationMutation.mutate(valuationForm)} disabled={recordValuationMutation.isPending}>
                  記録する
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={grantDialog} onOpenChange={setGrantDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30">
                <Plus className="w-4 h-4 mr-1" />
                コイン付与
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>コインを付与する</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>対象タイプ</Label>
                  <Select value={grantForm.holderType} onValueChange={(v: "staff" | "liver") => setGrantForm(f => ({ ...f, holderType: v, holderId: 0 }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">スタッフ</SelectItem>
                      <SelectItem value="liver">ライバー</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>対象者</Label>
                  <Select value={String(grantForm.holderId)} onValueChange={(v) => setGrantForm(f => ({ ...f, holderId: Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                    <SelectContent>
                      {(grantForm.holderType === "staff" ? targetsQuery.data?.staff : targetsQuery.data?.livers)?.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.department ? ` (${t.department})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>コイン数</Label>
                  <Input
                    type="number"
                    value={grantForm.coinAmount}
                    onChange={(e) => setGrantForm(f => ({ ...f, coinAmount: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>ベスティングタイプ</Label>
                  <Select value={grantForm.vestingType} onValueChange={(v: any) => setGrantForm(f => ({ ...f, vestingType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backloaded">バックローデッド型（Amazon式: 5/15/40/40）</SelectItem>
                      <SelectItem value="frontloaded">フロントローデッド型（Google式: 33/33/22/12）</SelectItem>
                      <SelectItem value="flat">フラット型（均等: 25/25/25/25）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>付与理由</Label>
                  <Input
                    value={grantForm.reason}
                    onChange={(e) => setGrantForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="例: 入社時初回付与"
                  />
                </div>
                {grantForm.coinAmount > 0 && dashboard?.valuation && (
                  <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-sm space-y-1">
                    <div className="font-semibold text-amber-600">付与プレビュー</div>
                    <div>コイン数: {grantForm.coinAmount.toLocaleString()} coins</div>
                    <div>現在価値: <span className="font-bold">¥{(grantForm.coinAmount * dashboard.valuation.coinPrice).toLocaleString()}</span></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">キャンセル</Button></DialogClose>
                <Button
                  onClick={() => grantMutation.mutate(grantForm)}
                  disabled={grantMutation.isPending || !grantForm.holderId}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                >
                  付与する
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-1"><BarChart3 className="w-4 h-4" />概要</TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-1"><Trophy className="w-4 h-4" />ランキング</TabsTrigger>
          <TabsTrigger value="badges" className="gap-1"><Award className="w-4 h-4" />バッジ</TabsTrigger>
          <TabsTrigger value="holders" className="gap-1"><Users className="w-4 h-4" />保有者</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1"><Settings className="w-4 h-4" />設定</TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* OVERVIEW TAB */}
        {/* ============================================================ */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Hero Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Valuation Card */}
            <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">擬似時価総額</span>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary">
                  <AnimatedCounter value={dashboard?.valuation?.valuationAmount || 0} prefix="¥" />
                </div>
                <div className="mt-2">
                  <Sparkline data={sparklineData} color="hsl(var(--primary))" />
                </div>
              </CardContent>
            </Card>

            {/* Coin Price Card */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-y-6 translate-x-6" />
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">1コイン価格</span>
                  <Coins className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold">
                  <AnimatedCounter value={dashboard?.valuation?.coinPrice || 0} prefix="¥" decimals={2} />
                </div>
                <div className="mt-2">
                  <Sparkline data={coinPriceHistory} color="#f59e0b" />
                </div>
              </CardContent>
            </Card>

            {/* Issued Coins */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -translate-y-6 translate-x-6" />
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">発行済みコイン</span>
                  <Target className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold">
                  <AnimatedCounter value={dashboard?.valuation?.totalIssuedCoins || 0} />
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <span>残り: {(dashboard?.valuation?.remainingCoins || 0).toLocaleString()}</span>
                  <span>/</span>
                  <span>{(dashboard?.valuation?.totalCoinsPool || 0).toLocaleString()}</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-1000"
                    style={{ width: `${((dashboard?.valuation?.totalIssuedCoins || 0) / (dashboard?.valuation?.totalCoinsPool || 1)) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Holders */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -translate-y-6 translate-x-6" />
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">コイン保有者</span>
                  <Users className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl font-bold">
                  <AnimatedCounter value={dashboard?.stats?.totalHolders || 0} suffix="人" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">スタッフ + ライバー</p>
              </CardContent>
            </Card>
          </div>

          {/* Valuation Details + Active Season */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  評価算出ロジック
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-xl bg-accent/50">
                    <div className="text-xs text-muted-foreground mb-1">月間売上</div>
                    <div className="text-lg font-bold">¥{(dashboard?.valuation?.monthlyRevenue || 0).toLocaleString()}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-accent/50 relative">
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">×</div>
                    <div className="text-xs text-muted-foreground mb-1">12ヶ月 × PSR倍率</div>
                    <div className="text-lg font-bold">12 × {dashboard?.valuation?.psrMultiplier || 5}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 relative">
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">=</div>
                    <div className="text-xs text-muted-foreground mb-1">擬似時価総額</div>
                    <div className="text-lg font-bold text-primary">¥{(dashboard?.valuation?.valuationAmount || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <strong>計算式:</strong> 擬似時価総額 = 月間売上 × 12 × PSR倍率({dashboard?.valuation?.psrMultiplier || 5}倍)
                  <br />
                  <strong>1コイン価格:</strong> 擬似時価総額 ÷ 総発行コイン数 = ¥{(dashboard?.valuation?.coinPrice || 0).toFixed(4)}
                </div>
              </CardContent>
            </Card>

            {/* Active Season */}
            <Card className={dashboard?.activeSeason ? "border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5" : ""}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  アクティブシーズン
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard?.activeSeason ? (
                  <div className="space-y-3">
                    <div className="text-lg font-bold">{dashboard.activeSeason.name}</div>
                    <p className="text-sm text-muted-foreground">{dashboard.activeSeason.description}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(dashboard.activeSeason.startDate).toLocaleDateString("ja-JP")} 〜 {new Date(dashboard.activeSeason.endDate).toLocaleDateString("ja-JP")}</span>
                    </div>
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                      ボーナス倍率: ×{dashboard.activeSeason.bonusMultiplier}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">現在アクティブなシーズンはありません</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Valuation History */}
          {dashboard?.valuationHistory && dashboard.valuationHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  時価総額推移
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3">年月</th>
                        <th className="text-right py-2 px-3">月間売上</th>
                        <th className="text-right py-2 px-3">PSR倍率</th>
                        <th className="text-right py-2 px-3">擬似時価総額</th>
                        <th className="text-right py-2 px-3">コイン価格</th>
                        <th className="text-left py-2 px-3">メモ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.valuationHistory.map((v: any) => (
                        <tr key={v.id} className="border-b border-border/50 hover:bg-accent/30">
                          <td className="py-2 px-3 font-medium">{v.yearMonth}</td>
                          <td className="py-2 px-3 text-right">¥{Number(v.monthlyRevenue).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">×{v.psrMultiplier}</td>
                          <td className="py-2 px-3 text-right font-bold text-primary">¥{Number(v.valuationAmount).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">¥{Number(v.coinPrice).toFixed(4)}</td>
                          <td className="py-2 px-3 text-muted-foreground">{v.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* LEADERBOARD TAB */}
        {/* ============================================================ */}
        <TabsContent value="leaderboard" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                LCJコイン ランキング
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard?.leaderboard?.length ? (
                <div className="space-y-1">
                  {leaderboard.leaderboard.map((entry: any, idx: number) => (
                    <LeaderboardRow key={`${entry.holderType}-${entry.holderId}`} entry={entry} index={idx} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>まだランキングデータがありません</p>
                  <p className="text-xs mt-1">コインを付与するとランキングが表示されます</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* BADGES TAB */}
        {/* ============================================================ */}
        <TabsContent value="badges" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                バッジコレクション
              </CardTitle>
            </CardHeader>
            <CardContent>
              {badgesQuery.data?.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {badgesQuery.data.map((badge: any) => (
                    <BadgeCard key={badge.id} badge={badge} earned={false} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>バッジがまだ定義されていません</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* HOLDERS TAB */}
        {/* ============================================================ */}
        <TabsContent value="holders" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                コイン保有者一覧
              </CardTitle>
            </CardHeader>
            <CardContent>
              {holdersQuery.data?.holders?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3">名前</th>
                        <th className="text-left py-2 px-3">タイプ</th>
                        <th className="text-left py-2 px-3">部署</th>
                        <th className="text-right py-2 px-3">総コイン</th>
                        <th className="text-right py-2 px-3">確定済み</th>
                        <th className="text-right py-2 px-3">総資産価値</th>
                        <th className="text-center py-2 px-3">レベル</th>
                        <th className="text-right py-2 px-3">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdersQuery.data.holders.map((h: any) => (
                        <tr key={h.id} className="border-b border-border/50 hover:bg-accent/30">
                          <td className="py-2 px-3 font-medium">{h.name}</td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className="text-xs">
                              {h.holderType === "liver" ? "ライバー" : "スタッフ"}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{h.department || "-"}</td>
                          <td className="py-2 px-3 text-right font-medium">{Number(h.totalCoins).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">{Number(h.vestedCoins).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-bold text-primary">¥{Number(h.totalValue).toLocaleString()}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white text-xs font-bold">
                              {h.level}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">{Number(h.xp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>まだコイン保有者がいません</p>
                  <p className="text-xs mt-1">「コイン付与」ボタンからコインを付与してください</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* SETTINGS TAB */}
        {/* ============================================================ */}
        <TabsContent value="settings" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" />
                システム設定
              </CardTitle>
            </CardHeader>
            <CardContent>
              {settingsQuery.data?.length ? (
                <div className="space-y-4">
                  {["valuation", "vesting", "gamification", "general"].map(category => {
                    const items = settingsQuery.data!.filter((s: any) => s.category === category);
                    if (!items.length) return null;
                    const categoryLabels: Record<string, string> = {
                      valuation: "評価・時価総額",
                      vesting: "ベスティング",
                      gamification: "ゲーミフィケーション",
                      general: "一般",
                    };
                    return (
                      <div key={category}>
                        <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wider">{categoryLabels[category] || category}</h3>
                        <div className="space-y-2">
                          {items.map((setting: any) => (
                            <div key={setting.id} className="flex items-center gap-4 p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{setting.settingKey}</div>
                                <div className="text-xs text-muted-foreground">{setting.description}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  className="w-48 h-8 text-sm"
                                  defaultValue={setting.settingValue}
                                  onBlur={(e) => {
                                    if (e.target.value !== setting.settingValue) {
                                      updateSettingMutation.mutate({
                                        settingKey: setting.settingKey,
                                        settingValue: e.target.value,
                                      });
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>設定データを読み込み中...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seasons Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                シーズン管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              {seasonsQuery.data?.length ? (
                <div className="space-y-3">
                  {seasonsQuery.data.map((season: any) => (
                    <div key={season.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/30 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium">{season.name}</div>
                        <div className="text-sm text-muted-foreground">{season.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(season.startDate).toLocaleDateString("ja-JP")} 〜 {new Date(season.endDate).toLocaleDateString("ja-JP")}
                        </div>
                      </div>
                      <Badge variant={season.status === "active" ? "default" : "outline"}>
                        {season.status === "active" ? "アクティブ" : season.status === "upcoming" ? "予定" : "終了"}
                      </Badge>
                      <div className="text-sm font-medium">×{season.bonusMultiplier}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Flame className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">シーズンがまだ作成されていません</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
