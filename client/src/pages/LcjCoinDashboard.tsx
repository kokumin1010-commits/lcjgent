/**
 * LCJ Coin Dashboard - ファントムストック報酬システム
 * 
 * ダークテーマ＋ネオングロー＋IRデータ連携
 * ブランド詳細ページ風の脳汁バグバグなUI
 * フルスクリーン表示（サイドバーなし）
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Coins, TrendingUp, Users, Trophy, Star, Zap, Gift, Award,
  ArrowUpRight, ArrowDownRight, Crown, Flame, Target, Sparkles,
  Settings, Plus, BarChart3, Medal, Shield, Gem, ChevronRight,
  Clock, Calendar, Rocket, Heart, ArrowLeft, ChevronDown,
  Building2, Percent, DollarSign, Landmark
} from "lucide-react";
import { Link } from "wouter";

// ============================================================
// Animated Counter Component (Neon style)
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
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span className="tabular-nums font-mono">
      {prefix}{displayValue.toLocaleString("ja-JP", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

// ============================================================
// Neon Glow Card
// ============================================================
function NeonCard({ children, color = "red", className = "" }: { children: React.ReactNode; color?: string; className?: string }) {
  const glowColors: Record<string, string> = {
    red: "shadow-[0_0_30px_rgba(255,50,50,0.3),inset_0_1px_0_rgba(255,50,50,0.1)] border-red-500/30",
    purple: "shadow-[0_0_30px_rgba(168,85,247,0.3),inset_0_1px_0_rgba(168,85,247,0.1)] border-purple-500/30",
    yellow: "shadow-[0_0_30px_rgba(234,179,8,0.3),inset_0_1px_0_rgba(234,179,8,0.1)] border-yellow-500/30",
    green: "shadow-[0_0_30px_rgba(34,197,94,0.3),inset_0_1px_0_rgba(34,197,94,0.1)] border-green-500/30",
    orange: "shadow-[0_0_30px_rgba(249,115,22,0.3),inset_0_1px_0_rgba(249,115,22,0.1)] border-orange-500/30",
    blue: "shadow-[0_0_30px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(59,130,246,0.1)] border-blue-500/30",
    cyan: "shadow-[0_0_30px_rgba(6,182,212,0.3),inset_0_1px_0_rgba(6,182,212,0.1)] border-cyan-500/30",
  };
  return (
    <div className={`relative rounded-2xl border bg-[#0a0a0f]/80 backdrop-blur-sm p-6 ${glowColors[color] || glowColors.red} ${className}`}>
      {children}
    </div>
  );
}

// ============================================================
// IR Data (from livecommercejapan.jp/ir)
// ============================================================
const IR_DATA = {
  valuation: "5億円",
  valuationNum: 500000000,
  revenue: "3,777万円",
  revenueNum: 37766472,
  gmvTarget: "10億円+",
  grossMargin: "100%",
  equityRatio: "99.3%",
  netAssets: 76475999,
  currentCash: 75980479,
  operatingProfit: 949050,
  ordinaryProfit: 1786799,
  teamSize: 20,
  liverCount: "294+",
  ipoTarget: "2029年",
  ipoValuation: "1,000億円",
};

// ============================================================
// Sparkline Mini Chart (Neon)
// ============================================================
function NeonSparkline({ data, color = "#ef4444", height = 60, width = 200 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`neonGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`glow-${color.replace("#", "")}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon
        fill={`url(#neonGrad-${color.replace("#", "")})`}
        points={`0,${height} ${points} ${width},${height}`}
      />
      <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} filter={`url(#glow-${color.replace("#", "")})`} />
    </svg>
  );
}

// ============================================================
// Leaderboard Row (Dark Theme)
// ============================================================
function LeaderboardRow({ entry, index, coinPrice }: { entry: any; index: number; coinPrice: number }) {
  const rankIcons: Record<number, JSX.Element> = {
    1: <Crown className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />,
    2: <Medal className="w-5 h-5 text-gray-300 drop-shadow-[0_0_6px_rgba(209,213,219,0.4)]" />,
    3: <Medal className="w-5 h-5 text-amber-600 drop-shadow-[0_0_6px_rgba(217,119,6,0.4)]" />,
  };
  const totalValue = Number(entry.totalCoins || 0) * coinPrice;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl transition-all hover:bg-white/5 ${index < 3 ? "bg-white/[0.03]" : ""}`}>
      <div className="w-10 h-10 flex items-center justify-center font-bold text-lg">
        {rankIcons[entry.rank] || <span className="text-white/40 font-mono">#{entry.rank}</span>}
      </div>
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500/30 to-red-500/20 flex items-center justify-center text-base font-bold text-white border border-white/10">
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          entry.name?.charAt(0) || "?"
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white truncate">{entry.name}</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-orange-400">Lv.{entry.level}</span>
          <span className="text-white/40">{entry.holderType === "liver" ? "ライバー" : entry.department || "スタッフ"}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-white font-mono">¥{totalValue.toLocaleString()}</div>
        <div className="text-xs text-white/40 font-mono">{Number(entry.totalCoins || 0).toLocaleString()} coins</div>
      </div>
    </div>
  );
}

// ============================================================
// Badge Card (Dark Neon)
// ============================================================
const rarityNeonConfig: Record<string, { glow: string; text: string; border: string; bg: string }> = {
  common: { glow: "", text: "text-zinc-400", border: "border-zinc-700", bg: "bg-zinc-900/50" },
  rare: { glow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]", text: "text-blue-400", border: "border-blue-500/40", bg: "bg-blue-950/30" },
  epic: { glow: "shadow-[0_0_15px_rgba(168,85,247,0.3)]", text: "text-purple-400", border: "border-purple-500/40", bg: "bg-purple-950/30" },
  legendary: { glow: "shadow-[0_0_20px_rgba(250,204,21,0.4)]", text: "text-yellow-400", border: "border-yellow-500/40", bg: "bg-yellow-950/20" },
};

function BadgeCard({ badge, earned = false }: { badge: any; earned?: boolean }) {
  const config = rarityNeonConfig[badge.rarity] || rarityNeonConfig.common;
  return (
    <div className={`relative p-4 rounded-xl border ${config.border} ${config.bg} ${earned ? config.glow : "opacity-30 grayscale"} transition-all hover:scale-105 cursor-default`}>
      {badge.rarity === "legendary" && earned && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-yellow-400/5 via-amber-300/10 to-yellow-400/5 animate-pulse" />
      )}
      <div className="text-center space-y-2 relative">
        <div className="text-3xl">{badge.iconEmoji || "🏅"}</div>
        <div className={`font-bold text-sm ${config.text}`}>{badge.name}</div>
        <Badge variant="outline" className={`text-[10px] ${config.text} ${config.border} bg-transparent`}>
          {badge.rarity?.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}

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
  const [syncAllDialog, setSyncAllDialog] = useState(false);
  const [syncCoinAmount, setSyncCoinAmount] = useState(1000);

  // Data queries
  const dashboardQuery = trpc.lcjCoin.getDashboard.useQuery();
  const leaderboardQuery = trpc.lcjCoin.getLeaderboard.useQuery({ limit: 50 });
  const badgesQuery = trpc.lcjCoin.getAllBadges.useQuery();
  const holdersQuery = trpc.lcjCoin.getAllHolders.useQuery();
  const settingsQuery = trpc.lcjCoin.getSettings.useQuery();
  const seasonsQuery = trpc.lcjCoin.getSeasons.useQuery();
  const targetsQuery = trpc.lcjCoin.getGrantTargets.useQuery();

  const dashboard = dashboardQuery.data;
  const leaderboard = leaderboardQuery.data;

  // Mutations
  const grantMutation = trpc.lcjCoin.grantCoins.useMutation({
    onSuccess: () => {
      toast.success("コインを付与しました！", { description: "ランキングが更新されます" });
      setGrantDialog(false);
      dashboardQuery.refetch();
      leaderboardQuery.refetch();
      holdersQuery.refetch();
    },
    onError: (err) => toast.error("エラー", { description: err.message }),
  });

  const recordValuationMutation = trpc.lcjCoin.recordValuation.useMutation({
    onSuccess: () => {
      toast.success("時価総額を記録しました！");
      setValuationDialog(false);
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error("エラー", { description: err.message }),
  });

  const updateSettingMutation = trpc.lcjCoin.updateSetting.useMutation({
    onSuccess: () => {
      toast.success("設定を更新しました");
      settingsQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error("エラー", { description: err.message }),
  });

  // Sparkline data from valuation history
  const sparklineData = useMemo(() => {
    if (!dashboard?.valuationHistory?.length) return [0, 0, 0, 0, 0];
    return [...dashboard.valuationHistory].reverse().map((v: any) => Number(v.valuationAmount));
  }, [dashboard?.valuationHistory]);

  const coinPrice = dashboard?.valuation?.coinPrice || 0;

  // Sync all staff handler
  const handleSyncAllStaff = useCallback(async () => {
    if (!targetsQuery.data) return;
    const allTargets = [
      ...targetsQuery.data.staff.map(s => ({ holderType: "staff" as const, holderId: s.id, name: s.name })),
      ...targetsQuery.data.livers.map(l => ({ holderType: "liver" as const, holderId: l.id, name: l.name })),
    ];
    
    let success = 0;
    let failed = 0;
    for (const target of allTargets) {
      try {
        await grantMutation.mutateAsync({
          holderType: target.holderType,
          holderId: target.holderId,
          coinAmount: syncCoinAmount,
          reason: "全員一括付与",
          vestingType: "backloaded",
        });
        success++;
      } catch {
        failed++;
      }
    }
    toast.success(`${success}名にコインを付与しました${failed > 0 ? `（${failed}名失敗）` : ""}`);
    setSyncAllDialog(false);
    dashboardQuery.refetch();
    leaderboardQuery.refetch();
    holdersQuery.refetch();
  }, [targetsQuery.data, syncCoinAmount]);

  const tabs = [
    { id: "overview", label: "概要", icon: BarChart3 },
    { id: "leaderboard", label: "ランキング", icon: Trophy },
    { id: "badges", label: "バッジ", icon: Award },
    { id: "holders", label: "保有者", icon: Users },
    { id: "settings", label: "設定", icon: Settings },
  ];

  const totalStaffAndLivers = (targetsQuery.data?.staff?.length || 0) + (targetsQuery.data?.livers?.length || 0);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Animated background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-orange-500/3 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#050508]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/master">
              <button className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
            </Link>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">LCJコイン</h1>
                <p className="text-xs text-white/40">ファントムストック報酬システム</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setSyncAllDialog(true)}
            >
              <Users className="w-4 h-4 mr-2" />
              全員にコイン付与
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setValuationDialog(true)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              時価総額記録
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/20"
              onClick={() => setGrantDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              コイン付与
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1600px] mx-auto px-6 py-8 space-y-8">
        {/* ============================================================ */}
        {/* HERO: LCJ時価総額 (IR連携) */}
        {/* ============================================================ */}
        <NeonCard color="red" className="text-center py-12">
          <div className="text-sm text-white/50 mb-2 flex items-center justify-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            LCJ 擬似時価総額
          </div>
          <div className="text-6xl md:text-8xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-red-500 drop-shadow-[0_0_40px_rgba(255,50,50,0.4)]">
            <AnimatedCounter value={dashboard?.valuation?.valuationAmount || 0} prefix="¥" />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            <span className="text-white/40">1コイン =</span>
            <span className="text-orange-400 font-bold font-mono text-lg">
              ¥{(dashboard?.valuation?.coinPrice || 0).toFixed(2)}
            </span>
          </div>
          <div className="mt-6 flex justify-center">
            <NeonSparkline data={sparklineData} color="#ef4444" height={60} width={300} />
          </div>
          <div className="mt-4 text-xs text-white/30">
            計算式: 月間売上 ¥{(dashboard?.valuation?.monthlyRevenue || 0).toLocaleString()} × 12ヶ月 × PSR {dashboard?.valuation?.psrMultiplier || 5}倍
          </div>
        </NeonCard>

        {/* ============================================================ */}
        {/* IR KPIs from livecommercejapan.jp/ir */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Target, label: "バリュエーション", value: IR_DATA.valuation, color: "text-orange-400" },
            { icon: BarChart3, label: "売上高（累計）", value: IR_DATA.revenue, color: "text-green-400" },
            { icon: DollarSign, label: "流通GMV目標", value: IR_DATA.gmvTarget, color: "text-cyan-400" },
            { icon: Percent, label: "粗利率", value: IR_DATA.grossMargin, color: "text-yellow-400" },
            { icon: Shield, label: "自己資本比率", value: IR_DATA.equityRatio, color: "text-purple-400" },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-xs text-white/40">{kpi.label}</span>
              </div>
              <div className={`text-xl font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* Stats Row */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NeonCard color="green" className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/50">発行済みコイン</span>
              <Coins className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-green-400">
              <AnimatedCounter value={dashboard?.valuation?.totalIssuedCoins || 0} />
            </div>
            <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-1000"
                style={{ width: `${((dashboard?.valuation?.totalIssuedCoins || 0) / (dashboard?.valuation?.totalCoinsPool || 1)) * 100}%` }}
              />
            </div>
            <div className="text-xs text-white/30 mt-1 font-mono">
              / {(dashboard?.valuation?.totalCoinsPool || 10000000).toLocaleString()}
            </div>
          </NeonCard>

          <NeonCard color="purple" className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/50">コイン保有者</span>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-purple-400">
              <AnimatedCounter value={dashboard?.stats?.totalHolders || 0} suffix="人" />
            </div>
            <div className="text-xs text-white/30 mt-2">
              対象: {totalStaffAndLivers}名（スタッフ {targetsQuery.data?.staff?.length || 0} + ライバー {targetsQuery.data?.livers?.length || 0}）
            </div>
          </NeonCard>

          <NeonCard color="orange" className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/50">組織体制</span>
              <Building2 className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-orange-400">{IR_DATA.teamSize}名</div>
            <div className="text-xs text-white/30 mt-2">日本8名 + 中国12名</div>
          </NeonCard>

          <NeonCard color="cyan" className="!p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/50">ライバーネットワーク</span>
              <Star className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-400">{IR_DATA.liverCount}</div>
            <div className="text-xs text-white/30 mt-2">目標: 1,000名規模</div>
          </NeonCard>
        </div>

        {/* ============================================================ */}
        {/* IPO Roadmap Banner */}
        {/* ============================================================ */}
        <NeonCard color="yellow" className="!py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/50 mb-1">上場目標</div>
              <div className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300">
                {IR_DATA.ipoTarget} — 時価総額{IR_DATA.ipoValuation}
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              {["2025 ✓", "2026 ✓", "2027", "2028", "2029 🎯"].map((year, i) => (
                <div key={i} className={`text-center ${i < 2 ? "text-green-400" : i === 4 ? "text-yellow-400" : "text-white/30"}`}>
                  <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${i < 2 ? "bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : i === 4 ? "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]" : "bg-white/10"}`} />
                  <div className="text-xs font-mono">{year}</div>
                </div>
              ))}
            </div>
          </div>
        </NeonCard>

        {/* ============================================================ */}
        {/* Tabs */}
        {/* ============================================================ */}
        <div className="flex gap-1 border-b border-white/5 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? "border-orange-500 text-orange-400"
                  : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* TAB: Overview */}
        {/* ============================================================ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Valuation Logic */}
            <NeonCard color="blue">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                評価算出ロジック
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="text-xs text-white/40 mb-2">月間売上</div>
                  <div className="text-2xl font-bold font-mono text-blue-400">
                    ¥{(dashboard?.valuation?.monthlyRevenue || 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5 relative">
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-xl">×</div>
                  <div className="text-xs text-white/40 mb-2">12ヶ月 × PSR倍率</div>
                  <div className="text-2xl font-bold font-mono text-blue-400">
                    12 × {dashboard?.valuation?.psrMultiplier || 5}
                  </div>
                </div>
                <div className="p-5 rounded-xl bg-orange-500/5 border border-orange-500/20 relative">
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-xl">=</div>
                  <div className="text-xs text-orange-400/60 mb-2">擬似時価総額</div>
                  <div className="text-2xl font-bold font-mono text-orange-400">
                    ¥{(dashboard?.valuation?.valuationAmount || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </NeonCard>

            {/* Active Season + Valuation History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NeonCard color="orange">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-400" />
                  アクティブシーズン
                </h3>
                {dashboard?.activeSeason ? (
                  <div className="space-y-3">
                    <div className="text-xl font-bold text-orange-400">{dashboard.activeSeason.name}</div>
                    <p className="text-sm text-white/50">{dashboard.activeSeason.description}</p>
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
                      ボーナス倍率: ×{dashboard.activeSeason.bonusMultiplier}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/30">
                    <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>現在アクティブなシーズンはありません</p>
                  </div>
                )}
              </NeonCard>

              {/* Valuation History */}
              <NeonCard color="blue">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  時価総額推移
                </h3>
                {dashboard?.valuationHistory?.length ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                    {dashboard.valuationHistory.map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <span className="text-sm font-mono text-white/60">{v.yearMonth}</span>
                        <span className="font-bold font-mono text-blue-400">¥{Number(v.valuationAmount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/30">
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>まだ記録がありません</p>
                  </div>
                )}
              </NeonCard>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: Leaderboard */}
        {/* ============================================================ */}
        {activeTab === "leaderboard" && (
          <NeonCard color="yellow">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              LCJコイン ランキング
            </h3>
            {leaderboard?.leaderboard?.length ? (
              <div className="space-y-1">
                {leaderboard.leaderboard.map((entry: any, idx: number) => (
                  <LeaderboardRow key={`${entry.holderType}-${entry.holderId}`} entry={entry} index={idx} coinPrice={coinPrice} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-white/30">
                <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">まだランキングデータがありません</p>
                <p className="text-sm mt-2">「全員にコイン付与」ボタンからスタッフ全員にコインを付与しましょう</p>
              </div>
            )}
          </NeonCard>
        )}

        {/* ============================================================ */}
        {/* TAB: Badges */}
        {/* ============================================================ */}
        {activeTab === "badges" && (
          <NeonCard color="purple">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-400" />
              バッジコレクション
            </h3>
            {badgesQuery.data?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {badgesQuery.data.map((badge: any) => (
                  <BadgeCard key={badge.id} badge={badge} earned={false} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-white/30">
                <Award className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">バッジがまだ定義されていません</p>
                <p className="text-sm mt-2">設定タブからバッジを作成できます</p>
              </div>
            )}
          </NeonCard>
        )}

        {/* ============================================================ */}
        {/* TAB: Holders */}
        {/* ============================================================ */}
        {activeTab === "holders" && (
          <NeonCard color="blue">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              コイン保有者一覧
            </h3>
            {holdersQuery.data?.holders?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40">
                      <th className="text-left py-3 px-4">名前</th>
                      <th className="text-left py-3 px-4">タイプ</th>
                      <th className="text-left py-3 px-4">部署</th>
                      <th className="text-right py-3 px-4">総コイン</th>
                      <th className="text-right py-3 px-4">確定済み</th>
                      <th className="text-right py-3 px-4">資産価値</th>
                      <th className="text-center py-3 px-4">Lv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdersQuery.data.holders.map((h: any) => (
                      <tr key={h.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4 font-medium text-white">{h.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={`text-xs border-white/10 ${h.holderType === "liver" ? "text-pink-400" : "text-blue-400"}`}>
                            {h.holderType === "liver" ? "ライバー" : "スタッフ"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-white/40">{h.department || "-"}</td>
                        <td className="py-3 px-4 text-right font-mono text-white">{Number(h.totalCoins).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono text-white/60">{Number(h.vestedCoins).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-orange-400">
                          ¥{(Number(h.totalCoins) * coinPrice).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white text-xs font-bold shadow-lg shadow-orange-500/20">
                            {h.level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-white/30">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">まだコイン保有者がいません</p>
                <p className="text-sm mt-2">「全員にコイン付与」ボタンからスタッフ全員にコインを付与しましょう</p>
              </div>
            )}
          </NeonCard>
        )}

        {/* ============================================================ */}
        {/* TAB: Settings */}
        {/* ============================================================ */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <NeonCard color="blue">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-white/60" />
                システム設定
              </h3>
              {settingsQuery.data?.length ? (
                <div className="space-y-6">
                  {["valuation", "vesting", "gamification", "general"].map(category => {
                    const items = settingsQuery.data!.filter((s: any) => s.category === category);
                    if (!items.length) return null;
                    const categoryLabels: Record<string, string> = {
                      valuation: "💰 評価・時価総額",
                      vesting: "🔒 ベスティング",
                      gamification: "🎮 ゲーミフィケーション",
                      general: "⚙️ 一般",
                    };
                    return (
                      <div key={category}>
                        <h4 className="font-semibold text-sm mb-3 text-white/50 uppercase tracking-wider">{categoryLabels[category] || category}</h4>
                        <div className="space-y-2">
                          {items.map((setting: any) => (
                            <div key={setting.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-white">{setting.settingKey}</div>
                                <div className="text-xs text-white/30">{setting.description}</div>
                              </div>
                              <Input
                                className="w-48 h-8 text-sm bg-white/5 border-white/10 text-white"
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
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-white/30">
                  <Settings className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>設定データを読み込み中...</p>
                </div>
              )}
            </NeonCard>

            {/* Seasons */}
            <NeonCard color="orange">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                シーズン管理
              </h3>
              {seasonsQuery.data?.length ? (
                <div className="space-y-3">
                  {seasonsQuery.data.map((season: any) => (
                    <div key={season.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                      <div className="flex-1">
                        <div className="font-medium text-white">{season.name}</div>
                        <div className="text-sm text-white/40">{season.description}</div>
                        <div className="text-xs text-white/30 mt-1 font-mono">
                          {new Date(season.startDate).toLocaleDateString("ja-JP")} 〜 {new Date(season.endDate).toLocaleDateString("ja-JP")}
                        </div>
                      </div>
                      <Badge className={`${season.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>
                        {season.status === "active" ? "アクティブ" : season.status === "upcoming" ? "予定" : "終了"}
                      </Badge>
                      <div className="text-sm font-bold text-orange-400 font-mono">×{season.bonusMultiplier}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/30">
                  <Flame className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>シーズンがまだ作成されていません</p>
                </div>
              )}
            </NeonCard>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* DIALOGS */}
      {/* ============================================================ */}
      
      {/* Grant Coins Dialog */}
      <Dialog open={grantDialog} onOpenChange={setGrantDialog}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-orange-400" />
              コイン付与
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60">対象タイプ</Label>
              <Select value={grantForm.holderType} onValueChange={(v: any) => setGrantForm(f => ({ ...f, holderType: v, holderId: 0 }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0f] border-white/10">
                  <SelectItem value="staff">スタッフ</SelectItem>
                  <SelectItem value="liver">ライバー</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/60">対象者</Label>
              <Select value={String(grantForm.holderId)} onValueChange={(v) => setGrantForm(f => ({ ...f, holderId: Number(v) }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0f] border-white/10">
                  {(grantForm.holderType === "staff" ? targetsQuery.data?.staff : targetsQuery.data?.livers)?.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.department ? ` (${t.department})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/60">コイン数</Label>
              <Input
                type="number"
                className="bg-white/5 border-white/10 text-white"
                value={grantForm.coinAmount}
                onChange={(e) => setGrantForm(f => ({ ...f, coinAmount: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="text-white/60">ベスティングタイプ</Label>
              <Select value={grantForm.vestingType} onValueChange={(v: any) => setGrantForm(f => ({ ...f, vestingType: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0f] border-white/10">
                  <SelectItem value="backloaded">バックローデッド（Amazon型: 3-4年目80%）</SelectItem>
                  <SelectItem value="frontloaded">フロントローデッド（Google型: 1-2年目66%）</SelectItem>
                  <SelectItem value="flat">フラット（均等配分）</SelectItem>
                  <SelectItem value="custom">カスタム</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/60">理由（任意）</Label>
              <Textarea
                className="bg-white/5 border-white/10 text-white"
                value={grantForm.reason}
                onChange={(e) => setGrantForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="入社時付与、業績ボーナスなど"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5">キャンセル</Button>
            </DialogClose>
            <Button
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white"
              onClick={() => grantMutation.mutate(grantForm)}
              disabled={!grantForm.holderId || grantMutation.isPending}
            >
              {grantMutation.isPending ? "処理中..." : "付与する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Valuation Record Dialog */}
      <Dialog open={valuationDialog} onOpenChange={setValuationDialog}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              時価総額記録
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60">年月</Label>
              <Input
                type="month"
                className="bg-white/5 border-white/10 text-white"
                value={valuationForm.yearMonth}
                onChange={(e) => setValuationForm(f => ({ ...f, yearMonth: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-white/60">月間売上（円）</Label>
              <Input
                type="number"
                className="bg-white/5 border-white/10 text-white"
                value={valuationForm.monthlyRevenue}
                onChange={(e) => setValuationForm(f => ({ ...f, monthlyRevenue: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="text-white/60">メモ（任意）</Label>
              <Textarea
                className="bg-white/5 border-white/10 text-white"
                value={valuationForm.notes}
                onChange={(e) => setValuationForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5">キャンセル</Button>
            </DialogClose>
            <Button
              className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
              onClick={() => recordValuationMutation.mutate(valuationForm)}
              disabled={recordValuationMutation.isPending}
            >
              {recordValuationMutation.isPending ? "処理中..." : "記録する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync All Staff Dialog */}
      <Dialog open={syncAllDialog} onOpenChange={setSyncAllDialog}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-400" />
              全員にコイン付与
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-sm text-white/50 mb-1">対象人数</div>
              <div className="text-2xl font-bold text-green-400 font-mono">{totalStaffAndLivers}名</div>
              <div className="text-xs text-white/30 mt-1">
                スタッフ {targetsQuery.data?.staff?.length || 0}名 + ライバー {targetsQuery.data?.livers?.length || 0}名
              </div>
            </div>
            <div>
              <Label className="text-white/60">1人あたりのコイン数</Label>
              <Input
                type="number"
                className="bg-white/5 border-white/10 text-white"
                value={syncCoinAmount}
                onChange={(e) => setSyncCoinAmount(Number(e.target.value))}
              />
            </div>
            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
              <div className="text-sm text-orange-400 font-medium">合計発行コイン</div>
              <div className="text-xl font-bold text-orange-400 font-mono">
                {(syncCoinAmount * totalStaffAndLivers).toLocaleString()} coins
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5">キャンセル</Button>
            </DialogClose>
            <Button
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
              onClick={handleSyncAllStaff}
              disabled={grantMutation.isPending}
            >
              {grantMutation.isPending ? "処理中..." : `${totalStaffAndLivers}名に付与する`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-16 py-6 text-center text-xs text-white/20">
        <p>LCJ Coin — Phantom Stock Reward System — Live Commerce Japan Inc.</p>
        <p className="mt-1">IR情報: <a href="https://livecommercejapan.jp/ir" target="_blank" rel="noopener" className="text-orange-400/50 hover:text-orange-400 transition-colors">livecommercejapan.jp/ir</a></p>
      </footer>
    </div>
  );
}
