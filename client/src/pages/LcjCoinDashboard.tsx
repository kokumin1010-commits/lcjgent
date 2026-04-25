/**
 * LCJ Coin Dashboard - ファントムストック報酬システム
 * 
 * ダークテーマ＋ネオングロー＋IRデータ連携
 * ブランド詳細ページ風の脳汁バグバグなUI
 * フルスクリーン表示（サイドバーなし）
 * 
 * v2: リアルGMVデータ連携、財務資料アップロード、株主名簿管理
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Building2, Percent, DollarSign, Landmark, Upload, FileText,
  PieChart, Eye, Trash2, Download, ExternalLink, Activity,
  Lock, RefreshCw, HelpCircle
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import LcjCoinHelpDialog from "@/components/LcjCoinHelpDialog";
import LcjCoinVestingTab from "@/components/LcjCoinVestingTab";
import LcjCoinPeerBonusTab from "@/components/LcjCoinPeerBonusTab";
import LcjCoinBuybackTab from "@/components/LcjCoinBuybackTab";
import LcjCoinTierTab from "@/components/LcjCoinTierTab";

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
    pink: "shadow-[0_0_30px_rgba(236,72,153,0.3),inset_0_1px_0_rgba(236,72,153,0.1)] border-pink-500/30",
  };
  return (
    <div className={`relative rounded-2xl border bg-[#0a0a0f]/80 backdrop-blur-sm p-6 ${glowColors[color] || glowColors.red} ${className}`}>
      {children}
    </div>
  );
}

// ============================================================
// Neon Sparkline Mini Chart
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
// Format helpers
// ============================================================
function formatYen(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(2)}億円`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}万円`;
  return `¥${n.toLocaleString()}`;
}

function formatYenFull(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

function formatTenure(months: number): string {
  if (months <= 0) return "-";
  const years = Math.floor(months / 12);
  const remainMonths = months % 12;
  if (years > 0 && remainMonths > 0) return `${years}年${remainMonths}ヶ月`;
  if (years > 0) return `${years}年`;
  return `${remainMonths}ヶ月`;
}

const TIER_COLORS: Record<string, string> = {
  S: "bg-red-500/20 text-red-400 border-red-500/30",
  A: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  B: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  C: "bg-green-500/20 text-green-400 border-green-500/30",
  D: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "L-S": "bg-gray-800/40 text-gray-100 border-gray-500/40",
  "L-A": "bg-yellow-600/20 text-yellow-300 border-yellow-500/30",
  "L-B": "bg-slate-400/20 text-slate-300 border-slate-400/30",
  "L-C": "bg-amber-700/20 text-amber-500 border-amber-600/30",
};

const TIER_DISPLAY_NAMES: Record<string, string> = {
  "L-S": "BLACK",
  "L-A": "GOLD",
  "L-B": "SILVER",
  "L-C": "BRONZE",
};

const STAFF_TIER_OPTIONS = ["S", "A", "B", "C", "D"];
const LIVER_TIER_OPTIONS = ["L-S", "L-A", "L-B", "L-C"];

// ============================================================
// Leaderboard Row
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
        {rankIcons[entry.rank] || <span className="text-white/80 font-mono">#{entry.rank}</span>}
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
          <span className="text-white/80">{entry.holderType === "liver" ? "ライバー" : entry.department || "スタッフ"}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-white font-mono">{formatYenFull(totalValue)}</div>
        <div className="text-xs text-white/80 font-mono">{Number(entry.totalCoins || 0).toLocaleString()} coins</div>
      </div>
    </div>
  );
}

// ============================================================
// Badge Card
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
// Shareholder Pie Chart (SVG)
// ============================================================
function ShareholderPieChart({ shareholders, totalShares }: { shareholders: any[]; totalShares: number }) {
  if (!shareholders?.length || !totalShares) return null;
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];
  let cumulativeAngle = 0;

  const slices = shareholders.map((sh, i) => {
    const ratio = sh.shares / totalShares;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + ratio * 360;
    cumulativeAngle = endAngle;

    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    const x1 = 100 + 80 * Math.cos(startRad);
    const y1 = 100 + 80 * Math.sin(startRad);
    const x2 = 100 + 80 * Math.cos(endRad);
    const y2 = 100 + 80 * Math.sin(endRad);

    const d = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { d, color: colors[i % colors.length], name: sh.name, ratio, shares: sh.shares };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width="200" height="200" viewBox="0 0 200 200" className="shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="#0a0a0f" strokeWidth="2" opacity="0.85"
            className="transition-opacity hover:opacity-100 cursor-default" />
        ))}
        <circle cx="100" cy="100" r="40" fill="#0a0a0f" />
        <text x="100" y="95" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">発行済</text>
        <text x="100" y="112" textAnchor="middle" fill="#f97316" fontSize="12" fontWeight="bold" fontFamily="monospace">
          {totalShares.toLocaleString()}株
        </text>
      </svg>
      <div className="space-y-2 flex-1 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-white truncate flex-1">{s.name}</span>
            <span className="text-white/80 font-mono shrink-0">{s.shares.toLocaleString()}株</span>
            <span className="text-orange-400 font-mono font-bold shrink-0">{(s.ratio * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// GMV Monthly Bar Chart (SVG)
// ============================================================
function GmvBarChart({ data }: { data: any[] }) {
  if (!data?.length) return null;
  const reversed = [...data].reverse();
  const maxGmv = Math.max(...reversed.map(d => d.affiliateGmv));
  const barWidth = Math.max(30, Math.min(70, 800 / reversed.length - 10));
  const chartWidth = Math.max(reversed.length * (barWidth + 10) + 80, 500);
  const chartHeight = 280;
  const padL = 70;
  const padB = 50;
  const plotH = chartHeight - padB;
  // Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = (maxGmv * (i + 1)) / 5;
    const y = plotH - (plotH * (i + 1)) / 5;
    return { val, y };
  });
  return (
    <div className="overflow-x-auto">
      <svg width={chartWidth} height={chartHeight + 20} className="overflow-visible">
        {/* Y-axis grid + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={chartWidth} y2={t.y} stroke="rgba(255,255,255,0.06)" />
            <text x={padL - 8} y={t.y + 4} textAnchor="end" fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="monospace">
              {t.val >= 100000000 ? `${(t.val / 100000000).toFixed(1)}億` : t.val >= 10000 ? `${(t.val / 10000).toFixed(0)}万` : `${t.val.toFixed(0)}`}
            </text>
          </g>
        ))}
        <line x1={padL} y1={plotH} x2={chartWidth} y2={plotH} stroke="rgba(255,255,255,0.1)" />
        {reversed.map((d, i) => {
          const barH = maxGmv > 0 ? (d.affiliateGmv / maxGmv) * plotH : 0;
          const commH = maxGmv > 0 ? (d.lcjCommission / maxGmv) * plotH : 0;
          const x = padL + i * (barWidth + 10) + 5;
          const fmtVal = (v: number) => v >= 100000000 ? `${(v / 100000000).toFixed(1)}億` : v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`;
          return (
            <g key={i}>
              <rect x={x} y={plotH - barH} width={barWidth} height={barH}
                fill="#3b82f6" opacity="0.35" rx="4" />
              <rect x={x} y={plotH - commH} width={barWidth} height={commH}
                fill="#f97316" opacity="0.85" rx="4" />
              {/* Value label on top */}
              {barH > 20 && (
                <text x={x + barWidth / 2} y={plotH - barH - 6} textAnchor="middle"
                  fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="monospace">
                  {fmtVal(d.affiliateGmv)}
                </text>
              )}
              <text x={x + barWidth / 2} y={plotH + 16} textAnchor="middle"
                fill="rgba(255,255,255,0.8)" fontSize="10" fontFamily="monospace">
                {d.month?.slice(5)}
              </text>
            </g>
          );
        })}
        {/* Legend */}
        <rect x={padL} y={plotH + 32} width="12" height="12" fill="#3b82f6" opacity="0.35" rx="2" />
        <text x={padL + 16} y={plotH + 42} fill="rgba(255,255,255,0.8)" fontSize="11">流通GMV</text>
        <rect x={padL + 90} y={plotH + 32} width="12" height="12" fill="#f97316" opacity="0.85" rx="2" />
        <text x={padL + 106} y={plotH + 42} fill="rgba(255,255,255,0.8)" fontSize="11">LCJ手数料</text>
      </svg>
    </div>
  );
}

// ============================================================
// Main Dashboard Component
// ============================================================
export default function LcjCoinDashboard() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialTab = urlParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab state with URL parameter
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    const newUrl = tabId === "overview" ? "/master/lcj-coin" : `/master/lcj-coin?tab=${tabId}`;
    window.history.replaceState(null, "", newUrl);
  }, []);

  // Sync from URL on popstate (browser back/forward)
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveTab(params.get("tab") || "overview");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    documentType: "financial_statement" as "financial_statement" | "shareholder_registry" | "other",
    title: "",
    periodStart: "",
    periodEnd: "",
    extractedRevenue: 0,
    extractedNetIncome: 0,
    extractedTotalAssets: 0,
    extractedNetAssets: 0,
    notes: "",
    // Shareholder fields
    shareholders: [] as { name: string; shares: number; ratio: string; shareType: string; acquisitionDate: string; address: string }[],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [holdersSearch, setHoldersSearch] = useState("");
  const [holdersFilter, setHoldersFilter] = useState<"all" | "staff" | "liver">("all");
  const [holdersSearchDebounced, setHoldersSearchDebounced] = useState("");

  // Debounce holders search
  useEffect(() => {
    const timer = setTimeout(() => setHoldersSearchDebounced(holdersSearch), 300);
    return () => clearTimeout(timer);
  }, [holdersSearch]);

  // Data queries
  const dashboardQuery = trpc.lcjCoin.getDashboard.useQuery();
  const leaderboardQuery = trpc.lcjCoin.getLeaderboard.useQuery({ limit: 50 });
  const badgesQuery = trpc.lcjCoin.getAllBadges.useQuery();
  const holdersQuery = trpc.lcjCoin.getAllHolders.useQuery({ search: holdersSearchDebounced, filterType: holdersFilter, limit: 200 });
  const settingsQuery = trpc.lcjCoin.getSettings.useQuery();
  const seasonsQuery = trpc.lcjCoin.getSeasons.useQuery();
  const targetsQuery = trpc.lcjCoin.getGrantTargets.useQuery();
  const documentsQuery = trpc.lcjCoin.getDocuments.useQuery();
  const shareholdersQuery = trpc.lcjCoin.getShareholders.useQuery();
  const tierTemplatesQuery = trpc.lcjCoin.getTierTemplates.useQuery();
  // Separate queries for contract details (loaded on GMV tab)
  const brandContractDetailsQuery = trpc.lcjCoin.getBrandContractDetails.useQuery(undefined, { enabled: activeTab === "gmv" });
  const tspContractDetailsQuery = trpc.lcjCoin.getTspContractDetails.useQuery(undefined, { enabled: activeTab === "gmv" });
  const monthlyRevenueQuery = trpc.lcjCoin.getMonthlyRevenueBreakdown.useQuery(undefined, { enabled: activeTab === "gmv" });

  // Mutations
  const grantMutation = trpc.lcjCoin.grantCoins.useMutation({
    onSuccess: () => {
      toast.success("コインを付与しました");
      setGrantDialog(false);
      dashboardQuery.refetch();
      holdersQuery.refetch();
      leaderboardQuery.refetch();
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  const bulkGrantMutation = trpc.lcjCoin.bulkGrantCoins.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.grantedCount}名にコインを付与しました`);
      setSyncAllDialog(false);
      dashboardQuery.refetch();
      holdersQuery.refetch();
      leaderboardQuery.refetch();
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  const recordValuationMutation = trpc.lcjCoin.recordValuation.useMutation({
    onSuccess: () => {
      toast.success("時価総額を記録しました");
      setValuationDialog(false);
      dashboardQuery.refetch();
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  const updateSettingMutation = trpc.lcjCoin.updateSetting.useMutation({
    onSuccess: () => {
      toast.success("設定を更新しました");
      dashboardQuery.refetch();
      settingsQuery.refetch();
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  const uploadDocMutation = trpc.lcjCoin.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success("ドキュメントをアップロードしました");
      setUploadDialog(false);
      setSelectedFile(null);
      documentsQuery.refetch();
      shareholdersQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  const deleteDocMutation = trpc.lcjCoin.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("ドキュメントを削除しました");
      documentsQuery.refetch();
    },
  });

  const updateTierMutation = trpc.lcjCoin.updateHolderTier.useMutation({
    onSuccess: () => {
      toast.success("Tierを更新しました");
      holdersQuery.refetch();
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  // Derived data
  const dashboard = dashboardQuery.data;
  const leaderboard = leaderboardQuery.data;
  const coinPrice = dashboard?.valuation?.coinPrice || 0;
  const totalStaffAndLivers = (targetsQuery.data?.staff?.length || 0) + (targetsQuery.data?.livers?.length || 0);

  const gmvChartData = useMemo(() => {
    return dashboard?.gmv?.monthlyData?.map((m: any) => m.lcjCommission) || [];
  }, [dashboard]);

  const gmvSparklineData = useMemo(() => {
    return [...(dashboard?.gmv?.monthlyData?.map((m: any) => m.affiliateGmv) || [])].reverse();
  }, [dashboard]);

  // Handlers
  const handleSyncAllStaff = useCallback(() => {
    bulkGrantMutation.mutate({
      coinAmountPerPerson: syncCoinAmount,
      reason: "全員一括付与",
      vestingType: "backloaded",
      targetType: "all",
    });
  }, [syncCoinAmount, bulkGrantMutation]);

  const handleFileUpload = useCallback(async () => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDocMutation.mutate({
        documentType: uploadForm.documentType,
        title: uploadForm.title || selectedFile.name,
        fileName: selectedFile.name,
        base64,
        mimeType: selectedFile.type,
        periodStart: uploadForm.periodStart || undefined,
        periodEnd: uploadForm.periodEnd || undefined,
        extractedRevenue: uploadForm.extractedRevenue || undefined,
        extractedNetIncome: uploadForm.extractedNetIncome || undefined,
        extractedTotalAssets: uploadForm.extractedTotalAssets || undefined,
        extractedNetAssets: uploadForm.extractedNetAssets || undefined,
        notes: uploadForm.notes || undefined,
        shareholders: uploadForm.documentType === "shareholder_registry" ? uploadForm.shareholders : undefined,
      });
    };
    reader.readAsDataURL(selectedFile);
  }, [selectedFile, uploadForm, uploadDocMutation]);

  // Tab config
  const tabs = [
    { id: "overview", label: "概要", icon: BarChart3 },
    { id: "gmv", label: "GMV・収益", icon: Activity },
    { id: "leaderboard", label: "ランキング", icon: Trophy },
    { id: "shareholders", label: "株主構成", icon: PieChart },
    { id: "documents", label: "財務資料", icon: FileText },
    { id: "badges", label: "バッジ", icon: Award },
    { id: "holders", label: "保有者", icon: Users },
    { id: "vesting", label: "ベスティング", icon: Lock },
    { id: "peer_bonus", label: "ピアボーナス", icon: Heart },
    { id: "buyback", label: "換金・Exit", icon: RefreshCw },
    { id: "tiers", label: "Tier設定", icon: Star },
    { id: "settings", label: "設定", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#050508] text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-orange-500/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-500/[0.03] rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/[0.02] rounded-full blur-[200px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/master">
              <button className="flex items-center gap-1 text-white/80 hover:text-white transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">LCJコイン</h1>
                <p className="text-xs text-white/80">ファントムストック報酬システム</p>
              </div>
              <LcjCoinHelpDialog />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-white/90 hover:bg-white/5 hover:text-white"
              onClick={() => setUploadDialog(true)}
            >
              <Upload className="w-4 h-4 mr-1" />
              資料アップロード
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              onClick={() => setSyncAllDialog(true)}
            >
              <Users className="w-4 h-4 mr-1" />
              全員にコイン付与
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              onClick={() => setValuationDialog(true)}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              時価総額記録
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20"
              onClick={() => setGrantDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              コイン付与
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1600px] mx-auto px-6 py-8 space-y-8">

        {/* ============================================================ */}
        {/* Hero: Valuation Display */}
        {/* ============================================================ */}
        <NeonCard color="red" className="text-center py-12">
          <div className="text-sm text-white/80 mb-2 flex items-center justify-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            LCJ 擬似時価総額
          </div>
          <div className="text-6xl md:text-8xl font-black font-mono tracking-tight"
            style={{
              background: "linear-gradient(135deg, #ff6b35, #ff4444, #ff6b35)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 40px rgba(255,68,68,0.4))",
            }}>
            <AnimatedCounter value={dashboard?.valuation?.valuationAmount || 0} prefix="¥" />
          </div>
          <div className="mt-4 text-lg text-white/80">
            1コイン = <span className="text-purple-400 font-bold font-mono" style={{ textShadow: "0 0 20px rgba(168,85,247,0.5)" }}>
              <AnimatedCounter value={coinPrice} prefix="¥" decimals={2} />
            </span>
          </div>
          <div className="mt-6 flex items-center justify-center gap-8 text-sm text-white/80">
            <span>計算式: 当期売上実績合計（{dashboard?.valuation?.fiscalYear?.start || '2025-08'}〜{dashboard?.valuation?.fiscalYear?.end || '2026-07'}） × PSR {dashboard?.valuation?.psrMultiplier || 15}倍</span>
          </div>
          {/* Sparkline */}
          {gmvSparklineData.length > 1 && (
            <div className="mt-6 flex justify-center">
              <NeonSparkline data={gmvSparklineData} color="#ff4444" height={100} width={600} />
            </div>
          )}
        </NeonCard>

        {/* ============================================================ */}
        {/* Stats Row */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <NeonCard color="orange" className="!p-4">
            <div className="text-xs text-white/80 mb-1">流通GMV（累計）</div>
            <div className="text-xl font-bold font-mono text-orange-400">
              {formatYen(dashboard?.gmv?.totalAffiliateGmv || 0)}
            </div>
            <div className="text-[10px] text-white/70 mt-1">参考指標</div>
          </NeonCard>
          <NeonCard color="green" className="!p-4">
            <div className="text-xs text-white/80 mb-1">LCJ手数料（累計）</div>
            <div className="text-xl font-bold font-mono text-green-400">
              {formatYen(dashboard?.gmv?.totalLcjCommission || 0)}
            </div>
          </NeonCard>
          <NeonCard color="purple" className="!p-4">
            <div className="text-xs text-white/80 mb-1">当期売上実績</div>
            <div className="text-xl font-bold font-mono text-purple-400">
              {formatYen(dashboard?.valuation?.fiscalYear?.totalRevenue || 0)}
            </div>
            <div className="text-[10px] text-white/70 mt-1">{dashboard?.valuation?.fiscalYear?.monthsWithData || 0}ヶ月分実績</div>
          </NeonCard>
          <NeonCard color="blue" className="!p-4">
            <div className="text-xs text-white/80 mb-1">発行済みコイン</div>
            <div className="text-xl font-bold font-mono text-blue-400">
              {(dashboard?.valuation?.totalIssuedCoins || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-white/70 mt-1">/ {(dashboard?.valuation?.totalCoinsPool || 10000000).toLocaleString()}</div>
          </NeonCard>
          <NeonCard color="cyan" className="!p-4 cursor-pointer hover:scale-[1.02] transition-transform">
            <div onClick={() => handleTabChange("holders")} className="cursor-pointer">
              <div className="text-xs text-white/80 mb-1">コイン保有者</div>
              <div className="text-xl font-bold font-mono text-cyan-400">
                {dashboard?.stats?.totalHolders || 0}人
              </div>
              <div className="text-[10px] text-white/70 mt-1">対象: {totalStaffAndLivers}名</div>
              <div className="text-[10px] text-cyan-400/50 mt-1 flex items-center gap-1">クリックして一覧を見る →</div>
            </div>
          </NeonCard>
          <NeonCard color="pink" className="!p-4">
            <div className="text-xs text-white/80 mb-1">1株あたり価値</div>
            <div className="text-xl font-bold font-mono text-pink-400">
              {formatYenFull(dashboard?.shareholders?.pricePerShare || 0)}
            </div>
            <div className="text-[10px] text-white/70 mt-1">{(dashboard?.shareholders?.totalShares || 0).toLocaleString()}株</div>
          </NeonCard>
        </div>

        {/* ============================================================ */}
        {/* Option Pool Banner */}
        {/* ============================================================ */}
        {(() => {
          const pool = dashboard?.optionPool;
          if (!pool) return null;
          const usedPercent = pool.grantedPercent || 0;
          const barColor = usedPercent >= 100 ? "bg-red-500" : usedPercent >= 80 ? "bg-orange-500" : "bg-emerald-500";
          const glowColor = usedPercent >= 100 ? "shadow-red-500/30" : usedPercent >= 80 ? "shadow-orange-500/30" : "shadow-emerald-500/30";
          const textColor = usedPercent >= 100 ? "text-red-400" : usedPercent >= 80 ? "text-orange-400" : "text-emerald-400";
          const borderColor = usedPercent >= 100 ? "border-red-500/30" : usedPercent >= 80 ? "border-orange-500/30" : "border-emerald-500/30";
          return (
            <div className={`relative rounded-2xl border ${borderColor} bg-[#0a0a0f]/80 backdrop-blur-sm p-5 shadow-lg ${glowColor}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${usedPercent >= 100 ? 'bg-red-500/20' : usedPercent >= 80 ? 'bg-orange-500/20' : 'bg-emerald-500/20'} flex items-center justify-center`}>
                    <Target className={`w-4 h-4 ${textColor}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Option Pool（スタッフ用プール）</div>
                    <div className="text-xs text-white/80">発行総額の{pool.percentOfTotal}%をスタッフ・ライバーに配分</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold font-mono ${textColor}`}>
                    {Number(pool.remaining).toLocaleString()} <span className="text-xs text-white/80">残り</span>
                  </div>
                  <div className="text-xs text-white/80 font-mono">
                    {Number(pool.granted).toLocaleString()} / {Number(pool.size).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all duration-1000`}
                  style={{ width: `${Math.min(100, usedPercent)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-white/80">消費率</span>
                <span className={`font-bold font-mono ${textColor}`}>{usedPercent.toFixed(1)}%</span>
              </div>
              {usedPercent >= 80 && usedPercent < 100 && (
                <div className="mt-3 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  プール残高が残り{(100 - usedPercent).toFixed(1)}%です。プールサイズの拡大を検討してください。
                </div>
              )}
              {usedPercent >= 100 && (
                <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  プールが枯渇しています。新規付与にはプールサイズの拡大が必要です。
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* Creator Pool Banner (ライバー用プール) */}
        {/* ============================================================ */}
        {(() => {
          const pool = (dashboard as any)?.creatorPool;
          if (!pool) return null;
          const usedPercent = pool.grantedPercent || 0;
          const barColor = usedPercent >= 100 ? "bg-red-500" : usedPercent >= 80 ? "bg-amber-500" : "bg-violet-500";
          const glowColor = usedPercent >= 100 ? "shadow-red-500/30" : usedPercent >= 80 ? "shadow-amber-500/30" : "shadow-violet-500/30";
          const textColor = usedPercent >= 100 ? "text-red-400" : usedPercent >= 80 ? "text-amber-400" : "text-violet-400";
          const borderColor = usedPercent >= 100 ? "border-red-500/30" : usedPercent >= 80 ? "border-amber-500/30" : "border-violet-500/30";
          return (
            <div className={`relative rounded-2xl border ${borderColor} bg-[#0a0a0f]/80 backdrop-blur-sm p-5 shadow-lg ${glowColor}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${usedPercent >= 100 ? 'bg-red-500/20' : usedPercent >= 80 ? 'bg-amber-500/20' : 'bg-violet-500/20'} flex items-center justify-center`}>
                    <Sparkles className={`w-4 h-4 ${textColor}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Creator Pool（ライバー用プール）</div>
                    <div className="text-xs text-white/80">発行総額の{pool.percentOfTotal.toFixed(1)}%をライバー・インフルエンサーに配分</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold font-mono ${textColor}`}>
                    {Number(pool.remaining).toLocaleString()} <span className="text-xs text-white/80">残り</span>
                  </div>
                  <div className="text-xs text-white/80 font-mono">
                    {Number(pool.granted).toLocaleString()} / {Number(pool.size).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all duration-1000`}
                  style={{ width: `${Math.min(100, usedPercent)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-white/80">消費率</span>
                <span className={`font-bold font-mono ${textColor}`}>{usedPercent.toFixed(1)}%</span>
              </div>
              {usedPercent >= 80 && usedPercent < 100 && (
                <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  クリエイタープール残高が残り{(100 - usedPercent).toFixed(1)}%です。プールサイズの拡大を検討してください。
                </div>
              )}
              {usedPercent >= 100 && (
                <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  クリエイタープールが枯渇しています。新規付与にはプールサイズの拡大が必要です。
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* Tabs */}
        {/* ============================================================ */}
        <div className="flex gap-1 border-b border-white/5 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? "border-orange-500 text-orange-400"
                  : "border-transparent text-white/80 hover:text-white/90"
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-5 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <div className="text-xs text-white/80 mb-2">当期売上実績合計</div>
                  <div className="text-xl font-bold font-mono text-purple-400">
                    {formatYenFull(dashboard?.valuation?.fiscalYear?.totalRevenue || 0)}
                  </div>
                  <div className="text-[10px] text-white/70 mt-1">{dashboard?.valuation?.fiscalYear?.start}〜{dashboard?.valuation?.fiscalYear?.end}（{dashboard?.valuation?.fiscalYear?.monthsWithData || 0}ヶ月実績）</div>
                </div>
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5 relative">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-white/70 font-bold text-lg">×</div>
                  <div className="text-xs text-white/80 mb-2">PSR倍率</div>
                  <div className="text-xl font-bold font-mono text-blue-400">
                    {dashboard?.valuation?.psrMultiplier || 15}
                  </div>
                </div>
                <div className="p-5 rounded-xl bg-orange-500/5 border border-orange-500/20 relative">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-white/70 font-bold text-lg">=</div>
                  <div className="text-xs text-orange-400/60 mb-2">擬似時価総額</div>
                  <div className="text-xl font-bold font-mono text-orange-400">
                    {formatYen(dashboard?.valuation?.valuationAmount || 0)}
                  </div>
                </div>
              </div>
              {/* Revenue Breakdown */}
              <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-xs text-white/80 mb-3 font-semibold">収益内訳（月間合算の構成）</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                    <div className="text-[10px] text-white/80 mb-1">LCJ手数料（月間平均）</div>
                    <div className="text-sm font-bold font-mono text-green-400">
                      {formatYenFull(dashboard?.referenceSources?.lcjCommission?.monthlyAvg || 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                    <div className="text-[10px] text-white/80 mb-1">ブランド契約（単発除く）<span className="text-purple-400/60 ml-1">{dashboard?.referenceSources?.brandContract?.activeCount || 0}件</span></div>
                    <div className="text-sm font-bold font-mono text-purple-400">
                      {formatYenFull(dashboard?.referenceSources?.brandContract?.monthlyTotal || 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                    <div className="text-[10px] text-white/80 mb-1">TSP契約（月額合計）<span className="text-cyan-400/60 ml-1">{dashboard?.referenceSources?.tsp?.activeCount || 0}件</span></div>
                    <div className="text-sm font-bold font-mono text-cyan-400">
                      {formatYenFull(dashboard?.referenceSources?.tsp?.monthlyTotal || 0)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleTabChange("gmv")}
                  className="mt-3 text-xs text-orange-400/60 hover:text-orange-400 transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  GMV・収益タブで詳細を確認
                </button>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-white/[0.02] text-xs text-white/80 space-y-1">
                <p>計算式: 擬似時価総額 = 当期売上実績合計（{dashboard?.valuation?.fiscalYear?.start}〜{dashboard?.valuation?.fiscalYear?.end}） × PSR倍率({dashboard?.valuation?.psrMultiplier || 15}倍)</p>
                <p>※ 全収益 = LCJ手数料 + ブランド契約（期間考慮） + 単発ライブ + TSP契約（決算期: 7月、会計年度: 8月〜翌7月）</p>
                <p>1コイン価格: 擬似時価総額 ÷ 総発行コイン数 = {formatYenFull(coinPrice)}</p>
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
                    <p className="text-sm text-white/80">{dashboard.activeSeason.description}</p>
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
                      ボーナス倍率: ×{dashboard.activeSeason.bonusMultiplier}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/80">
                    <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>現在アクティブなシーズンはありません</p>
                  </div>
                )}
              </NeonCard>

              <NeonCard color="blue">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  時価総額推移
                </h3>
                {(dashboard?.latestValuationHistory?.length) ? (() => {
                  const histData = [...dashboard.latestValuationHistory].reverse();
                  const maxVal = Math.max(...histData.map((v: any) => Number(v.valuationAmount)));
                  const minVal = Math.min(...histData.map((v: any) => Number(v.valuationAmount)));
                  const range = maxVal - minVal || 1;
                  const chartW = Math.max(histData.length * 80, 400);
                  const chartH = 200;
                  const padL = 80;
                  const padR = 20;
                  const padT = 20;
                  const padB = 40;
                  const plotW = chartW - padL - padR;
                  const plotH = chartH - padT - padB;
                  const points = histData.map((v: any, i: number) => {
                    const x = padL + (i / Math.max(histData.length - 1, 1)) * plotW;
                    const y = padT + plotH - ((Number(v.valuationAmount) - minVal) / range) * plotH;
                    return { x, y, val: Number(v.valuationAmount), month: v.yearMonth };
                  });
                  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
                  const areaPoints = `${padL},${padT + plotH} ${polyline} ${points[points.length - 1].x},${padT + plotH}`;
                  // Y-axis labels (5 ticks)
                  const yTicks = Array.from({ length: 5 }, (_, i) => {
                    const val = minVal + (range * i) / 4;
                    const y = padT + plotH - (plotH * i) / 4;
                    return { val, y };
                  });
                  return (
                    <div>
                      <div className="overflow-x-auto">
                        <svg width={chartW} height={chartH} className="overflow-visible">
                          <defs>
                            <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                            </linearGradient>
                            <filter id="valGlow">
                              <feGaussianBlur stdDeviation="3" result="blur" />
                              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                          </defs>
                          {/* Grid lines */}
                          {yTicks.map((t, i) => (
                            <g key={i}>
                              <line x1={padL} y1={t.y} x2={chartW - padR} y2={t.y} stroke="rgba(255,255,255,0.08)" />
                              <text x={padL - 8} y={t.y + 4} textAnchor="end" fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="monospace">
                                {t.val >= 100000000 ? `${(t.val / 100000000).toFixed(1)}億` : `${(t.val / 10000).toFixed(0)}万`}
                              </text>
                            </g>
                          ))}
                          {/* Area */}
                          <polygon fill="url(#valGrad)" points={areaPoints} />
                          {/* Line */}
                          <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={polyline} filter="url(#valGlow)" />
                          {/* Data points */}
                          {points.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="#1e3a5f" strokeWidth="2" />
                              <text x={p.x} y={padT + plotH + 16} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="9" fontFamily="monospace">
                                {p.month?.slice(5) || p.month}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                      {/* Data table below chart */}
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {histData.map((v: any) => (
                          <div key={v.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                            <span className="text-xs font-mono text-white/90">{v.yearMonth}</span>
                            <span className="text-xs font-bold font-mono text-blue-400">{formatYen(Number(v.valuationAmount))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="text-center py-8 text-white/80">
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>まだ記録がありません</p>
                  </div>
                )}
              </NeonCard>
            </div>

            {/* IPO Roadmap with Phase Progress */}
            {(() => {
              const currentValuation = dashboard?.valuation?.valuationAmount || 0;
              const monthlyRevenue = dashboard?.valuation?.monthlyRevenue || 0;
              const psrMultiplier = dashboard?.valuation?.psrMultiplier || 15;
              const phases = [
                { year: "2025", label: "創業", target: 500000000, displayValue: "5億円", borderColor: "border-green-500/50", textColor: "text-green-400", ringColor: "ring-green-500/40", bgGlow: "shadow-green-500/10", barColor: "bg-green-500" },
                { year: "2026", label: "成長期", target: 3000000000, displayValue: "30億円", borderColor: "border-blue-500/50", textColor: "text-blue-400", ringColor: "ring-blue-500/40", bgGlow: "shadow-blue-500/10", barColor: "bg-blue-500" },
                { year: "2027", label: "拡大期", target: 10000000000, displayValue: "100億円", borderColor: "border-purple-500/50", textColor: "text-purple-400", ringColor: "ring-purple-500/40", bgGlow: "shadow-purple-500/10", barColor: "bg-purple-500" },
                { year: "2028", label: "Pre-IPO", target: 30000000000, displayValue: "300億円", borderColor: "border-orange-500/50", textColor: "text-orange-400", ringColor: "ring-orange-500/40", bgGlow: "shadow-orange-500/10", barColor: "bg-orange-500" },
                { year: "2029", label: "IPO", target: 100000000000, displayValue: "1,000億円", borderColor: "border-red-500/50", textColor: "text-red-400", ringColor: "ring-red-500/40", bgGlow: "shadow-red-500/10", barColor: "bg-red-500" },
              ];
              // Determine current phase
              let currentPhaseIdx = 0;
              for (let i = 0; i < phases.length; i++) {
                if (currentValuation >= phases[i].target && i < phases.length - 1) {
                  currentPhaseIdx = i + 1;
                }
              }
              const currentPhase = phases[currentPhaseIdx];
              const prevTarget = currentPhaseIdx > 0 ? phases[currentPhaseIdx - 1].target : 0;
              const progressInPhase = Math.min(100, Math.max(0, ((currentValuation - prevTarget) / (currentPhase.target - prevTarget)) * 100));
              const remainingToNext = Math.max(0, currentPhase.target - currentValuation);
              // Required monthly revenue to reach next phase target
              // 当期実績ベース: 目標達成に必要な当期売上合計
              const requiredAnnualRevenue = currentPhase.target / psrMultiplier;
              const currentFYRevenue = dashboard?.valuation?.fiscalYear?.totalRevenue || 0;
              const additionalRevenueNeeded = Math.max(0, requiredAnnualRevenue - currentFYRevenue);
              const fyMonthsRemaining = Math.max(1, 12 - (dashboard?.valuation?.fiscalYear?.totalMonths || 0));
              const requiredMonthlyRevenue = additionalRevenueNeeded / fyMonthsRemaining;
              const additionalMonthlyNeeded = requiredMonthlyRevenue;

              return (
                <NeonCard color="purple">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-purple-400" />
                    IPOロードマップ
                  </h3>

                  {/* Phase Cards */}
                  <div className="flex items-center gap-4 overflow-x-auto pb-4">
                    {phases.map((step, i) => {
                      const isActive = i === currentPhaseIdx;
                      const isCompleted = i < currentPhaseIdx;
                      return (
                        <div key={i} className="flex items-center gap-3 shrink-0">
                          <div className={`p-4 rounded-xl border ${step.borderColor} bg-white/[0.02] text-center min-w-[120px] transition-all duration-300 ${
                            isActive ? `ring-2 ${step.ringColor} shadow-lg ${step.bgGlow}` : ""
                          } ${isCompleted ? "opacity-50" : ""}`}>
                            <div className="text-xs text-white/80">{step.year}</div>
                            <div className={`font-bold text-lg font-mono ${step.textColor}`}>{step.displayValue}</div>
                            <div className="text-xs text-white/80 mt-1">{step.label}</div>
                            {isActive && (
                              <div className={`text-[10px] mt-2 px-2 py-0.5 rounded-full ${step.barColor}/20 ${step.textColor} font-bold`}>
                                ◀ 現在地
                              </div>
                            )}
                            {isCompleted && (
                              <div className="text-[10px] mt-2 text-green-400">✓ 達成</div>
                            )}
                          </div>
                          {i < 4 && <ChevronRight className="w-5 h-5 text-white/10 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress Section */}
                  <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-4">
                    {/* Current Status */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-white/80">現在のフェーズ: </span>
                        <span className={`text-sm font-bold ${currentPhase.textColor}`}>
                          {currentPhase.label}（{currentPhase.year}）
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-white/80">目標: </span>
                        <span className={`text-sm font-bold ${currentPhase.textColor}`}>{currentPhase.displayValue}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-xs text-white/80 mb-1">
                        <span>{formatYen(currentValuation)}</span>
                        <span className="font-bold text-white/80">{progressInPhase.toFixed(1)}%</span>
                        <span>{currentPhase.displayValue}</span>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${currentPhase.barColor} rounded-full transition-all duration-1000 relative`}
                          style={{ width: `${progressInPhase}%` }}
                        >
                          <div className={`absolute inset-0 ${currentPhase.barColor}/50 animate-pulse rounded-full`} />
                        </div>
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                        <div className="text-xs text-white/80 mb-1">あと必要な時価総額</div>
                        <div className={`text-lg font-bold font-mono ${currentPhase.textColor}`}>
                          {formatYen(remainingToNext)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                        <div className="text-xs text-white/80 mb-1">残り{fyMonthsRemaining}ヶ月の目標月間売上</div>
                        <div className={`text-lg font-bold font-mono ${currentPhase.textColor}`}>
                          {formatYen(requiredMonthlyRevenue)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                        <div className="text-xs text-white/80 mb-1">当期残り必要額（合計）</div>
                        <div className="text-lg font-bold font-mono text-yellow-400">
                          +{formatYen(additionalRevenueNeeded)}
                        </div>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="text-[11px] text-white/70 text-center">
                      残り{fyMonthsRemaining}ヶ月で必要な月間売上 = (目標時価総額÷PSR{psrMultiplier} − 当期実績) ÷ 残り月数
                    </div>
                  </div>
                </NeonCard>
              );
            })()}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: GMV & Revenue */}
        {/* ============================================================ */}
        {activeTab === "gmv" && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NeonCard color="blue" className="!p-5">
                <div className="text-xs text-white/80 mb-1">流通GMV（累計）</div>
                <div className="text-3xl font-bold font-mono text-blue-400">
                  {formatYen(dashboard?.gmv?.totalAffiliateGmv || 0)}
                </div>
                <div className="text-xs text-white/70 mt-2">直近月: {formatYen(dashboard?.gmv?.latestMonthGmv || 0)}</div>
              </NeonCard>
              <NeonCard color="green" className="!p-5">
                <div className="text-xs text-white/80 mb-1">LCJ手数料（累計）</div>
                <div className="text-3xl font-bold font-mono text-green-400">
                  {formatYen(dashboard?.gmv?.totalLcjCommission || 0)}
                </div>
                <div className="text-xs text-white/70 mt-2">直近月: {formatYen(dashboard?.gmv?.latestMonthLcjCommission || 0)}</div>
              </NeonCard>
              <NeonCard color="orange" className="!p-5">
                <div className="text-xs text-white/80 mb-1">手数料月間平均（直近3ヶ月）</div>
                <div className="text-3xl font-bold font-mono text-orange-400">
                  {formatYen(dashboard?.gmv?.avgMonthlyCommission || 0)}
                </div>
                <div className="text-xs text-white/70 mt-2">LCJ手数料のみ</div>
              </NeonCard>
            </div>

            {/* ---- Revenue Breakdown Summary ---- */}
            <NeonCard color="red" className="!p-5">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-red-400" />
                全収益合算（月間）→ 擬似時価総額の計算ベース
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-xs text-white/80 mb-1">LCJ手数料（月間平均）</div>
                  <div className="text-xl font-bold font-mono text-orange-400">
                    {formatYenFull(dashboard?.referenceSources?.lcjCommission?.monthlyAvg || 0)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-xs text-white/80 mb-1">ブランド契約（月額換算・単発除く）</div>
                  <div className="text-xl font-bold font-mono text-purple-400">
                    {formatYenFull(dashboard?.referenceSources?.brandContract?.monthlyTotal || 0)}
                  </div>
                  <div className="text-[10px] text-white/70 mt-1">{dashboard?.referenceSources?.brandContract?.activeCount || 0}件</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-xs text-white/80 mb-1">TSP契約（月額）</div>
                  <div className="text-xl font-bold font-mono text-cyan-400">
                    {formatYenFull(dashboard?.referenceSources?.tsp?.monthlyTotal || 0)}
                  </div>
                  <div className="text-[10px] text-white/70 mt-1">{dashboard?.referenceSources?.tsp?.activeCount || 0}件</div>
                </div>
                <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl p-4 border border-red-500/30">
                  <div className="text-xs text-white/90 mb-1 font-semibold">当期売上実績合計</div>
                  <div className="text-xl font-bold font-mono text-red-400">
                    {formatYenFull(dashboard?.valuation?.fiscalYear?.totalRevenue || 0)}
                  </div>
                  <div className="text-[10px] text-white/80 mt-1">{dashboard?.valuation?.fiscalYear?.start}〜{dashboard?.valuation?.fiscalYear?.end}（{dashboard?.valuation?.fiscalYear?.monthsWithData || 0}ヶ月実績）</div>
                  <div className="text-[10px] text-white/80 mt-0.5">× PSR {dashboard?.valuation?.psrMultiplier || 15}倍 = {formatYen(dashboard?.valuation?.valuationAmount || 0)}</div>
                </div>
              </div>
            </NeonCard>

            {/* Monthly Revenue Breakdown Table */}
            <NeonCard color="yellow">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-yellow-400" />
                月別収益推移（全収益内訳）
              </h3>
              {monthlyRevenueQuery.isLoading ? (
                <div className="text-center py-8 text-white/80">読み込み中...</div>
              ) : monthlyRevenueQuery.data?.months?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/80">
                        <th className="text-left py-3 px-3">月</th>
                        <th className="text-right py-3 px-3">LCJ手数料</th>
                        <th className="text-right py-3 px-3">ブランド契約</th>
                        <th className="text-right py-3 px-3">単発</th>
                        <th className="text-right py-3 px-3">TSP</th>
                        <th className="text-right py-3 px-3">継続収益合計</th>
                        <th className="text-right py-3 px-3">全収益合計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRevenueQuery.data.months.map((m: any) => (
                        <tr key={m.month} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                          <td className="py-3 px-3 font-mono text-white/90">{m.month}</td>
                          <td className="py-3 px-3 text-right font-mono text-orange-400">{formatYenFull(m.lcjCommission)}</td>
                          <td className="py-3 px-3 text-right font-mono text-purple-400">{formatYenFull(m.brandRecurring)}</td>
                          <td className="py-3 px-3 text-right font-mono text-white/80">{m.brandSingle > 0 ? formatYenFull(m.brandSingle) : "-"}</td>
                          <td className="py-3 px-3 text-right font-mono text-cyan-400">{formatYenFull(m.tsp)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-green-400">{formatYenFull(m.totalRecurring)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-red-400">{formatYenFull(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 text-[10px] text-white/70 px-3">
                    ※ 継続収益合計 = LCJ手数料 + ブランド契約（期間契約のみ） + TSP。単発ライブ契約は擬似時価総額の計算には含まれません。
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/80">データがありません</div>
              )}
            </NeonCard>

            {/* GMV Chart */}
            <NeonCard color="blue">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                月別GMV・LCJ手数料推移
              </h3>
              <GmvBarChart data={dashboard?.gmv?.monthlyData || []} />
            </NeonCard>

            {/* ---- Brand Contract Details ---- */}
            <NeonCard color="purple">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                ブランド契約一覧（契約中 {dashboard?.referenceSources?.brandContract?.activeCount || 0}件）
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/80">
                      <th className="text-left py-3 px-3">ブランド</th>
                      <th className="text-left py-3 px-3">タイプ</th>
                      <th className="text-right py-3 px-3">契約費用</th>
                      <th className="text-left py-3 px-3">契約期間</th>
                      <th className="text-right py-3 px-3">月数</th>
                      <th className="text-right py-3 px-3">月額換算</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandContractDetailsQuery.data?.details?.map((c: any) => (
                      <tr key={c.id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${c.isSingleEvent ? "opacity-50" : ""}`}>
                        <td className="py-3 px-3 font-medium text-white">
                          {c.brandName}
                          {c.isSingleEvent && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/80">単発</span>}
                        </td>
                        <td className="py-3 px-3 text-white/80 text-xs">{c.serviceType || c.contractPeriodLabel || "-"}</td>
                        <td className="py-3 px-3 text-right font-mono text-white/90">
                          {c.currency !== "JPY" ? `${c.currency} ` : "¥"}{c.fixedFee.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-white/80 text-xs">
                          {c.startDate ? new Date(c.startDate).toLocaleDateString("ja-JP") : "-"}
                          {" ~ "}
                          {c.endDate ? new Date(c.endDate).toLocaleDateString("ja-JP") : "-"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-white/80">{c.contractMonths || "-"}ヶ月</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-purple-400">{formatYenFull(c.monthlyAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-purple-500/30">
                      <td colSpan={5} className="py-3 px-3 text-right font-semibold text-white/90">月額換算 合計（単発除く）</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-purple-400 text-lg">
                        {formatYenFull(dashboard?.referenceSources?.brandContract?.monthlyTotal || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </NeonCard>

            {/* ---- TSP Contract Details ---- */}
            <NeonCard color="cyan">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-cyan-400" />
                TSP契約一覧（アクティブ {dashboard?.referenceSources?.tsp?.activeCount || 0}件）
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/80">
                      <th className="text-left py-3 px-3">ショップ名</th>
                      <th className="text-left py-3 px-3">会社名</th>
                      <th className="text-right py-3 px-3">月額（税抜）</th>
                      <th className="text-left py-3 px-3">契約開始</th>
                      <th className="text-left py-3 px-3">契約終了</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tspContractDetailsQuery.data?.details?.map((c: any) => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-3 font-medium text-white">{c.shopName}</td>
                        <td className="py-3 px-3 text-white/80">{c.companyName || "-"}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-cyan-400">{formatYenFull(c.monthlyAmount)}</td>
                        <td className="py-3 px-3 text-white/80 text-xs">
                          {c.contractStartDate ? new Date(c.contractStartDate).toLocaleDateString("ja-JP") : "-"}
                        </td>
                        <td className="py-3 px-3 text-white/80 text-xs">
                          {c.contractEndDate ? new Date(c.contractEndDate).toLocaleDateString("ja-JP") : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-cyan-500/30">
                      <td colSpan={4} className="py-3 px-3 text-right font-semibold text-white/90">月額 合計</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-cyan-400 text-lg">
                        {formatYenFull(dashboard?.referenceSources?.tsp?.monthlyTotal || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </NeonCard>

            {/* Monthly Data Table */}
            <NeonCard color="cyan">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                TAP月別推移（詳細）
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/80">
                      <th className="text-left py-3 px-3">月</th>
                      <th className="text-right py-3 px-3">アフィリGMV</th>
                      <th className="text-right py-3 px-3">LIVE GMV</th>
                      <th className="text-right py-3 px-3">動画GMV</th>
                      <th className="text-right py-3 px-3">LCJ手数料</th>
                      <th className="text-right py-3 px-3">注文数</th>
                      <th className="text-right py-3 px-3">LIVE視聴</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard?.gmv?.monthlyData?.map((m: any) => (
                      <tr key={m.month} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-3 font-mono text-white/90">{m.month}</td>
                        <td className="py-3 px-3 text-right font-mono text-green-400">{formatYenFull(m.affiliateGmv)}</td>
                        <td className="py-3 px-3 text-right font-mono text-white/90">{formatYenFull(m.liveGmv)}</td>
                        <td className="py-3 px-3 text-right font-mono text-white/90">{formatYenFull(m.videoGmv)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-orange-400">{formatYenFull(m.lcjCommission)}</td>
                        <td className="py-3 px-3 text-right font-mono text-white/80">{m.orders.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-mono text-white/80">{m.liveViews.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </NeonCard>
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
              <div className="text-center py-16 text-white/80">
                <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">まだランキングデータがありません</p>
                <p className="text-sm mt-2">「全員にコイン付与」ボタンからスタッフ全員にコインを付与しましょう</p>
              </div>
            )}
          </NeonCard>
        )}

        {/* ============================================================ */}
        {/* TAB: Shareholders */}
        {/* ============================================================ */}
        {activeTab === "shareholders" && (
          <div className="space-y-6">
            <NeonCard color="pink">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-pink-400" />
                株主構成
              </h3>
              {shareholdersQuery.data?.length ? (
                <ShareholderPieChart
                  shareholders={shareholdersQuery.data}
                  totalShares={dashboard?.shareholders?.totalShares || 0}
                />
              ) : shareholdersQuery.data?.length ? (
                <ShareholderPieChart
                  shareholders={shareholdersQuery.data}
                  totalShares={shareholdersQuery.data.reduce((s: number, sh: any) => s + sh.shares, 0)}
                />
              ) : (
                <div className="text-center py-12 text-white/80">
                  <PieChart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>株主名簿がまだアップロードされていません</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-pink-500/30 text-pink-400"
                    onClick={() => {
                      setUploadForm(f => ({ ...f, documentType: "shareholder_registry" }));
                      setUploadDialog(true);
                    }}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    株主名簿をアップロード
                  </Button>
                </div>
              )}
            </NeonCard>

            {/* Per-share value */}
            {dashboard?.shareholders?.totalShares ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NeonCard color="orange" className="!p-5">
                  <div className="text-xs text-white/80 mb-1">1株あたり価値</div>
                  <div className="text-3xl font-bold font-mono text-orange-400">
                    {formatYenFull(dashboard.shareholders.pricePerShare)}
                  </div>
                </NeonCard>
                <NeonCard color="blue" className="!p-5">
                  <div className="text-xs text-white/80 mb-1">発行済株式数</div>
                  <div className="text-3xl font-bold font-mono text-blue-400">
                    {dashboard.shareholders.totalShares.toLocaleString()}株
                  </div>
                </NeonCard>
                <NeonCard color="purple" className="!p-5">
                  <div className="text-xs text-white/80 mb-1">擬似時価総額</div>
                  <div className="text-3xl font-bold font-mono text-purple-400">
                    {formatYen(dashboard.valuation?.valuationAmount || 0)}
                  </div>
                </NeonCard>
              </div>
            ) : null}

            {/* Shareholder Table */}
            {(dashboard?.shareholders?.list?.length || shareholdersQuery.data?.length) ? (
              <NeonCard color="cyan">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  株主一覧
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/80">
                        <th className="text-left py-3 px-3">株主名</th>
                        <th className="text-left py-3 px-3">株式種類</th>
                        <th className="text-right py-3 px-3">株数</th>
                        <th className="text-right py-3 px-3">持株比率</th>
                        <th className="text-right py-3 px-3">評価額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard?.shareholders?.list || shareholdersQuery.data || []).map((sh: any) => (
                        <tr key={sh.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                          <td className="py-3 px-3 font-medium text-white">{sh.name}</td>
                          <td className="py-3 px-3 text-white/80">{sh.shareType || "普通株式"}</td>
                          <td className="py-3 px-3 text-right font-mono text-white">{sh.shares.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right font-mono text-orange-400">{sh.ratio || "-"}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-green-400">
                            {formatYenFull(sh.shares * (dashboard?.shareholders?.pricePerShare || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </NeonCard>
            ) : null}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: Documents */}
        {/* ============================================================ */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                財務資料・アップロード履歴
              </h3>
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
                onClick={() => setUploadDialog(true)}
              >
                <Upload className="w-4 h-4 mr-1" />
                新規アップロード
              </Button>
            </div>

            {documentsQuery.data?.length ? (
              <div className="space-y-3">
                {documentsQuery.data.map((doc: any) => (
                  <NeonCard key={doc.id} color={doc.documentType === "financial_statement" ? "blue" : doc.documentType === "shareholder_registry" ? "pink" : "cyan"} className="!p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        <FileText className={`w-6 h-6 ${doc.documentType === "financial_statement" ? "text-blue-400" : "text-pink-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{doc.title || doc.fileName}</div>
                        <div className="flex items-center gap-3 text-xs text-white/80 mt-1">
                          <Badge variant="outline" className={`text-[10px] ${doc.documentType === "financial_statement" ? "text-blue-400 border-blue-500/30" : "text-pink-400 border-pink-500/30"}`}>
                            {doc.documentType === "financial_statement" ? "財務諸表" : doc.documentType === "shareholder_registry" ? "株主名簿" : "その他"}
                          </Badge>
                          {doc.periodStart && doc.periodEnd && (
                            <span className="font-mono">{doc.periodStart} 〜 {doc.periodEnd}</span>
                          )}
                          <span>{new Date(doc.createdAt).toLocaleDateString("ja-JP")}</span>
                          <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                        </div>
                        {doc.extractedRevenue ? (
                          <div className="text-xs text-green-400 mt-1">
                            売上高: {formatYenFull(Number(doc.extractedRevenue))}
                            {doc.extractedNetIncome ? ` / 純利益: ${formatYenFull(Number(doc.extractedNetIncome))}` : ""}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="border-white/10 text-white/80 hover:text-white">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </a>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => {
                            if (confirm("このドキュメントを削除しますか？")) {
                              deleteDocMutation.mutate({ id: doc.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </NeonCard>
                ))}
              </div>
            ) : (
              <NeonCard color="blue">
                <div className="text-center py-16 text-white/80">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">まだ資料がアップロードされていません</p>
                  <p className="text-sm mt-2">試算表や株主名簿をアップロードして管理しましょう</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-blue-500/30 text-blue-400"
                    onClick={() => setUploadDialog(true)}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    アップロード
                  </Button>
                </div>
              </NeonCard>
            )}
          </div>
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
              <div className="text-center py-16 text-white/80">
                <Award className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">バッジがまだ定義されていません</p>
                <p className="text-sm mt-2">設定タブからバッジを作成できます</p>
              </div>
            )}
          </NeonCard>
        )}

        {/* ============================================================ */}
        {/* TAB: Holders - 全スタッフ・ライバー一覧（コイン未付与も含む） */}
        {/* ============================================================ */}
        {activeTab === "holders" && (
          <NeonCard color="blue">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                コイン保有者一覧
                <span className="text-sm font-normal text-white/80 ml-2">
                  {holdersQuery.data?.total || 0}名
                </span>
              </h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder="名前・部署で検索..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/80 h-9 text-sm w-full sm:w-48"
                  value={holdersSearch}
                  onChange={(e) => setHoldersSearch(e.target.value)}
                />
                <Select value={holdersFilter} onValueChange={(v: any) => setHoldersFilter(v)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-9 text-sm w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/10">
                    <SelectItem value="all" className="text-white">全員</SelectItem>
                    <SelectItem value="staff" className="text-white">スタッフ</SelectItem>
                    <SelectItem value="liver" className="text-white">ライバー</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* スタッフ用Tier説明セクション */}
            {tierTemplatesQuery.data && tierTemplatesQuery.data.filter((t: any) => t.tierType !== 'creator').length > 0 && (
              <div className="mb-4 p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-blue-400" />
                  スタッフ用 Tier
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                  {tierTemplatesQuery.data.filter((t: any) => t.tierType !== 'creator').map((tier: any) => (
                    <div key={tier.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-xs px-2 py-0.5 ${TIER_COLORS[tier.tierCode] || ''}`}>
                          {tier.tierCode}
                        </Badge>
                        <span className="text-sm font-medium text-white">{tier.tierName}</span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed">{tier.description}</p>
                      <p className="text-xs text-white/70 mt-1">対象: {tier.exampleRoles}</p>
                      <div className="text-xs text-white/70 mt-1">
                        ベスティング: {tier.vestingPeriodMonths}ヶ月 / クリフ: {tier.cliffMonths}ヶ月
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ライバー用Tier説明セクション */}
            {tierTemplatesQuery.data && tierTemplatesQuery.data.filter((t: any) => t.tierType === 'creator').length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-white/[0.03] border border-violet-500/20">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-violet-400" />
                  ライバー用 Tier
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {tierTemplatesQuery.data.filter((t: any) => t.tierType === 'creator').map((tier: any) => (
                    <div key={tier.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-xs px-2 py-0.5 ${TIER_COLORS[tier.tierCode] || ''}`}>
                          {TIER_DISPLAY_NAMES[tier.tierCode] || tier.tierCode}
                        </Badge>
                        <span className="text-[10px] text-white/50">({tier.tierCode})</span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed font-medium">{tier.description}</p>
                      <p className="text-xs text-white/70 mt-1">対象: {tier.exampleRoles}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {holdersQuery.isLoading ? (
              <div className="text-center py-16 text-white/80">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
                <p>読み込み中...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white">
                      <th className="text-left py-3 px-3">名前</th>
                      <th className="text-left py-3 px-3">タイプ</th>
                      <th className="text-center py-3 px-3">Tier</th>
                      <th className="text-center py-3 px-3">月間実績</th>
                      <th className="text-left py-3 px-3">部署</th>
                      <th className="text-center py-3 px-3">在籍期間</th>
                      <th className="text-right py-3 px-3">総コイン</th>
                      <th className="text-right py-3 px-3">確定済み</th>
                      <th className="text-right py-3 px-3">資産価値</th>
                      <th className="text-center py-3 px-3">Lv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(holdersQuery.data?.holders || []).map((h: any) => (
                      <tr
                        key={`${h.holderType}-${h.holderId}`}
                        className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {h.avatarUrl ? (
                              <img src={h.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                h.holderType === "liver"
                                  ? "bg-gradient-to-br from-pink-500 to-rose-600 text-white"
                                  : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                              }`}>
                                {h.name?.charAt(0) || "?"}
                              </div>
                            )}
                            <span className="font-medium text-white">{h.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={`text-xs border-white/10 ${h.holderType === "liver" ? "text-pink-400" : "text-blue-400"}`}>
                            {h.holderType === "liver" ? "ライバー" : "スタッフ"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs cursor-pointer hover:border-white/20 focus:outline-none focus:border-orange-500/40 transition-colors"
                            value={h.tierCode || ""}
                            onChange={(e) => {
                              const val = e.target.value || null;
                              updateTierMutation.mutate({ holderType: h.holderType, holderId: h.holderId, tierCode: val });
                            }}
                          >
                            <option value="" className="bg-gray-900 text-white">-</option>
                            {(h.holderType === "liver" ? LIVER_TIER_OPTIONS : STAFF_TIER_OPTIONS).map(t => (
                              <option key={t} value={t} className="bg-gray-900 text-white">{TIER_DISPLAY_NAMES[t] ? `${t} (${TIER_DISPLAY_NAMES[t]})` : t}</option>
                            ))}
                          </select>
                          {h.tierCode && (
                            <Badge className={`ml-1 text-[10px] px-1.5 py-0 ${TIER_COLORS[h.tierCode] || ""}`}>
                              {TIER_DISPLAY_NAMES[h.tierCode] || h.tierCode}
                            </Badge>
                          )}
                          {h.holderType === "liver" && h.recommendedTier && h.recommendedTier !== h.tierCode && (
                            <div className="mt-1">
                              <span className="text-[9px] text-white/40">推奨:</span>
                              <Badge className={`ml-0.5 text-[9px] px-1 py-0 opacity-70 ${TIER_COLORS[h.recommendedTier] || ""}`}>
                                {TIER_DISPLAY_NAMES[h.recommendedTier] || h.recommendedTier}
                              </Badge>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {h.holderType === "liver" ? (
                            <div className="text-xs">
                              {h.monthlyStreamCount != null && h.monthlyStreamCount > 0 ? (
                                <>
                                  <div className="text-white/90">{h.monthlyHours?.toFixed(1)}h / {h.monthlyStreamCount}回</div>
                                  <div className="text-[10px] text-white/50">¥{(h.monthlyGmv || 0).toLocaleString()}</div>
                                </>
                              ) : (
                                <span className="text-white/30">配信なし</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-white/20">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-white">{h.department || "-"}</td>
                        <td className="py-3 px-3 text-center">
                          <div className="text-white text-xs">{formatTenure(h.tenureMonths)}</div>
                          {h.joinDate && <div className="text-[10px] text-white">{h.joinDate}</div>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {h.hasHolding ? (
                            <span className="text-white">{Number(h.totalCoins).toLocaleString()}</span>
                          ) : (
                            <Badge variant="outline" className="text-xs border-white/20 text-white">未付与</Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-white">
                          {h.hasHolding ? Number(h.vestedCoins).toLocaleString() : "-"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {h.hasHolding ? (
                            <span className="text-orange-400">{formatYenFull(Number(h.totalValue))}</span>
                          ) : (
                            <span className="text-white">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {h.hasHolding ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white text-xs font-bold shadow-lg shadow-orange-500/20">
                              {h.level}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white text-xs">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(holdersQuery.data?.holders || []).length === 0 && (
                  <div className="text-center py-12 text-white/80">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>該当するメンバーがいません</p>
                  </div>
                )}
              </div>
            )}
          </NeonCard>
        )}

        {/* ============================================================ */}
        {/* TAB: Settings */}
        {/* ============================================================ */}
        {activeTab === "vesting" && (
          <LcjCoinVestingTab
            staffList={(targetsQuery.data?.staff || []).map((s: any) => ({ id: s.id, name: s.name, department: s.department }))}
            liverList={(targetsQuery.data?.livers || []).map((l: any) => ({ id: l.id, name: l.name }))}
          />
        )}

        {activeTab === "peer_bonus" && (
          <LcjCoinPeerBonusTab
            staffList={(targetsQuery.data?.staff || []).map((s: any) => ({ id: s.id, name: s.name, department: s.department }))}
            liverList={(targetsQuery.data?.livers || []).map((l: any) => ({ id: l.id, name: l.name }))}
          />
        )}

        {activeTab === "buyback" && (
          <LcjCoinBuybackTab />
        )}

        {activeTab === "tiers" && (
          <LcjCoinTierTab />
        )}

        {activeTab === "settings" && (
          <div className="space-y-6">
            <NeonCard color="blue">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-white/90" />
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
                        <h4 className="font-semibold text-sm mb-3 text-white/80 uppercase tracking-wider">{categoryLabels[category] || category}</h4>
                        <div className="space-y-2">
                          {items.map((setting: any) => (
                            <div key={setting.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-white">{setting.settingKey}</div>
                                <div className="text-xs text-white/80">{setting.description}</div>
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
                <div className="text-center py-12 text-white/80">
                  <Settings className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>設定データを読み込み中...</p>
                </div>
              )}
            </NeonCard>

            {/* Option Pool Settings */}
            <NeonCard color="green">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                Option Pool（スタッフ用プール）
              </h3>
              {(() => {
                const pool = dashboard?.optionPool;
                if (!pool) return <div className="text-center py-8 text-white/80"><p>読み込み中...</p></div>;
                const usedPercent = pool.grantedPercent || 0;
                const barColor = usedPercent >= 100 ? "bg-red-500" : usedPercent >= 80 ? "bg-orange-500" : "bg-emerald-500";
                const textColor = usedPercent >= 100 ? "text-red-400" : usedPercent >= 80 ? "text-orange-400" : "text-emerald-400";
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                        <div className="text-xs text-white/80 mb-1">プールサイズ</div>
                        <div className="text-2xl font-bold font-mono text-emerald-400">{Number(pool.size).toLocaleString()}</div>
                        <div className="text-[10px] text-white/70 mt-1">発行総額の{pool.percentOfTotal}%</div>
                      </div>
                      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
                        <div className="text-xs text-white/80 mb-1">付与済み</div>
                        <div className="text-2xl font-bold font-mono text-blue-400">{Number(pool.granted).toLocaleString()}</div>
                        <div className="text-[10px] text-white/70 mt-1">{usedPercent.toFixed(1)}% 消費</div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                        <div className="text-xs text-white/80 mb-1">残り</div>
                        <div className={`text-2xl font-bold font-mono ${textColor}`}>{Number(pool.remaining).toLocaleString()}</div>
                        <div className="text-[10px] text-white/70 mt-1">{(100 - usedPercent).toFixed(1)}% 残</div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="text-white/80">プール消費率</span>
                        <span className={`font-bold font-mono ${textColor}`}>{usedPercent.toFixed(1)}%</span>
                      </div>
                      <div className="relative h-4 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all duration-1000`}
                          style={{ width: `${Math.min(100, usedPercent)}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white/80 space-y-1">
                      <p>• プールサイズは「設定」の <code className="text-emerald-400/60">option_pool_size</code> で変更可能</p>
                      <p>• コイン付与時、プール残高を超える付与はエラーになります</p>
                      <p>• 消費率80%で警告、100%で付与停止</p>
                    </div>
                  </div>
                );
              })()}
            </NeonCard>

            {/* Creator Pool Settings */}
            <NeonCard color="purple">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Creator Pool（ライバー用プール）
              </h3>
              {(() => {
                const pool = (dashboard as any)?.creatorPool;
                if (!pool) return <div className="text-center py-8 text-white/80"><p>読み込み中...</p></div>;
                const usedPercent = pool.grantedPercent || 0;
                const barColor = usedPercent >= 100 ? "bg-red-500" : usedPercent >= 80 ? "bg-amber-500" : "bg-violet-500";
                const textColor = usedPercent >= 100 ? "text-red-400" : usedPercent >= 80 ? "text-amber-400" : "text-violet-400";
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 text-center">
                        <div className="text-xs text-white/80 mb-1">プールサイズ</div>
                        <div className="text-2xl font-bold font-mono text-violet-400">{Number(pool.size).toLocaleString()}</div>
                        <div className="text-[10px] text-white/70 mt-1">発行総額の{pool.percentOfTotal.toFixed(1)}%</div>
                      </div>
                      <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/20 text-center">
                        <div className="text-xs text-white/80 mb-1">付与済み</div>
                        <div className="text-2xl font-bold font-mono text-pink-400">{Number(pool.granted).toLocaleString()}</div>
                        <div className="text-[10px] text-white/70 mt-1">{usedPercent.toFixed(1)}% 消費</div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                        <div className="text-xs text-white/80 mb-1">残り</div>
                        <div className={`text-2xl font-bold font-mono ${textColor}`}>{Number(pool.remaining).toLocaleString()}</div>
                        <div className="text-[10px] text-white/70 mt-1">{(100 - usedPercent).toFixed(1)}% 残</div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="text-white/80">プール消費率</span>
                        <span className={`font-bold font-mono ${textColor}`}>{usedPercent.toFixed(1)}%</span>
                      </div>
                      <div className="relative h-4 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all duration-1000`}
                          style={{ width: `${Math.min(100, usedPercent)}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white/80 space-y-1">
                      <p>• ライバーへのコイン付与はこのプールから差し引かれます（スタッフ用とは完全別枚）</p>
                      <p>• プールサイズは「設定」の <code className="text-violet-400/60">creator_pool_size</code> で変更可能</p>
                      <p>• ライバーには「Tier L-S / L-A」のトリガーベース付与を推奨</p>
                    </div>
                  </div>
                );
              })()}
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
                        <div className="text-sm text-white/80">{season.description}</div>
                        <div className="text-xs text-white/80 mt-1 font-mono">
                          {new Date(season.startDate).toLocaleDateString("ja-JP")} 〜 {new Date(season.endDate).toLocaleDateString("ja-JP")}
                        </div>
                      </div>
                      <Badge className={`${season.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/80 border-white/10"}`}>
                        {season.status === "active" ? "アクティブ" : season.status === "upcoming" ? "予定" : "終了"}
                      </Badge>
                      <div className="text-sm font-bold text-orange-400 font-mono">×{season.bonusMultiplier}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/80">
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
              <Label className="text-white/90">対象タイプ</Label>
              <Select value={grantForm.holderType} onValueChange={(v: any) => setGrantForm(f => ({ ...f, holderType: v, holderId: 0 }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0f] border-white/10 text-white">
                  <SelectItem value="staff" className="text-white hover:text-white focus:text-white">スタッフ</SelectItem>
                  <SelectItem value="liver" className="text-white hover:text-white focus:text-white">ライバー</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/90">対象者</Label>
              <Select value={String(grantForm.holderId)} onValueChange={(v) => setGrantForm(f => ({ ...f, holderId: Number(v) }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0f] border-white/10 text-white max-h-60">
                  {(grantForm.holderType === "staff" ? targetsQuery.data?.staff : targetsQuery.data?.livers)?.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-white hover:text-white focus:text-white">{t.name}{t.department ? ` (${t.department})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/90">コイン数</Label>
              <Input
                type="number"
                className="bg-white/5 border-white/10 text-white"
                value={grantForm.coinAmount}
                onChange={(e) => setGrantForm(f => ({ ...f, coinAmount: Number(e.target.value) }))}
              />
              {/* Option Pool remaining warning */}
              {(() => {
                const isLiver = grantForm.holderType === "liver";
                const pool = isLiver ? (dashboard as any)?.creatorPool : dashboard?.optionPool;
                if (!pool) return null;
                const remaining = Number(pool.remaining);
                const exceeds = grantForm.coinAmount > remaining;
                const poolLabel = isLiver ? "Creator Pool" : "Option Pool";
                const Icon = isLiver ? Sparkles : Target;
                const accentColor = isLiver ? "violet" : "emerald";
                return (
                  <div className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 ${
                    exceeds
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                      : `bg-white/[0.03] border border-white/5 text-white/80`
                  }`}>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{poolLabel}残: <span className="font-mono font-bold">{remaining.toLocaleString()}</span> コイン</span>
                    {exceeds && <span className="ml-auto font-bold text-red-400">✖ 超過</span>}
                  </div>
                );
              })()}
            </div>
            <div>
              <Label className="text-white/90">ベスティングタイプ</Label>
              <Select value={grantForm.vestingType} onValueChange={(v: any) => setGrantForm(f => ({ ...f, vestingType: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0f] border-white/10 text-white">
                  <SelectItem value="backloaded" className="text-white hover:text-white focus:text-white">バックローデッド（Amazon型: 3-4年目80%）</SelectItem>
                  <SelectItem value="frontloaded" className="text-white hover:text-white focus:text-white">フロントローデッド（Google型: 1-2年目66%）</SelectItem>
                  <SelectItem value="flat" className="text-white hover:text-white focus:text-white">フラット（均等配分）</SelectItem>
                  <SelectItem value="custom" className="text-white hover:text-white focus:text-white">カスタム</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/90">理由（任意）</Label>
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
              <Button variant="outline" className="border-white/10 text-white/90 hover:bg-white/5">キャンセル</Button>
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
              <Label className="text-white/90">年月</Label>
              <Input
                type="month"
                className="bg-white/5 border-white/10 text-white"
                value={valuationForm.yearMonth}
                onChange={(e) => setValuationForm(f => ({ ...f, yearMonth: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-white/90">月間売上（円）</Label>
              <Input
                type="number"
                className="bg-white/5 border-white/10 text-white"
                value={valuationForm.monthlyRevenue}
                onChange={(e) => setValuationForm(f => ({ ...f, monthlyRevenue: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="text-white/90">メモ（任意）</Label>
              <Textarea
                className="bg-white/5 border-white/10 text-white"
                value={valuationForm.notes}
                onChange={(e) => setValuationForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white/90 hover:bg-white/5">キャンセル</Button>
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
              <div className="text-sm text-white/80 mb-1">対象人数</div>
              <div className="text-2xl font-bold text-green-400 font-mono">{totalStaffAndLivers}名</div>
              <div className="text-xs text-white/80 mt-1">
                スタッフ {targetsQuery.data?.staff?.length || 0}名 + ライバー {targetsQuery.data?.livers?.length || 0}名
              </div>
            </div>
            <div>
              <Label className="text-white/90">1人あたりのコイン数</Label>
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
            {/* Pool remaining warnings for bulk grant (separate staff/liver) */}
            {(() => {
              const staffPool = dashboard?.optionPool;
              const creatorPool = (dashboard as any)?.creatorPool;
              const staffCount = targetsQuery.data?.staff?.length || 0;
              const liverCount = targetsQuery.data?.livers?.length || 0;
              return (
                <div className="space-y-2">
                  {staffPool && staffCount > 0 && (() => {
                    const remaining = Number(staffPool.remaining);
                    const needed = syncCoinAmount * staffCount;
                    const exceeds = needed > remaining;
                    return (
                      <div className={`p-3 rounded-xl text-sm flex items-center gap-3 ${
                        exceeds ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/5 border border-emerald-500/20 text-white/80'
                      }`}>
                        <Target className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="font-medium">Option Pool残: <span className="font-mono font-bold">{remaining.toLocaleString()}</span> コイン（スタッフ{staffCount}名 × {syncCoinAmount.toLocaleString()} = {needed.toLocaleString()}）</div>
                          {exceeds && <div className="text-xs mt-1 text-red-400">✖ {(needed - remaining).toLocaleString()} コイン超過</div>}
                        </div>
                      </div>
                    );
                  })()}
                  {creatorPool && liverCount > 0 && (() => {
                    const remaining = Number(creatorPool.remaining);
                    const needed = syncCoinAmount * liverCount;
                    const exceeds = needed > remaining;
                    return (
                      <div className={`p-3 rounded-xl text-sm flex items-center gap-3 ${
                        exceeds ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-violet-500/5 border border-violet-500/20 text-white/80'
                      }`}>
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="font-medium">Creator Pool残: <span className="font-mono font-bold">{remaining.toLocaleString()}</span> コイン（ライバー{liverCount}名 × {syncCoinAmount.toLocaleString()} = {needed.toLocaleString()}）</div>
                          {exceeds && <div className="text-xs mt-1 text-red-400">✖ {(needed - remaining).toLocaleString()} コイン超過</div>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white/90 hover:bg-white/5">キャンセル</Button>
            </DialogClose>
            <Button
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
              onClick={handleSyncAllStaff}
              disabled={bulkGrantMutation.isPending}
            >
              {bulkGrantMutation.isPending ? "処理中..." : `${totalStaffAndLivers}名に付与する`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              財務資料アップロード
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/90">資料タイプ</Label>
              <Select value={uploadForm.documentType} onValueChange={(v: any) => setUploadForm(f => ({ ...f, documentType: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0f] border-white/10 text-white">
                  <SelectItem value="financial_statement" className="text-white hover:text-white focus:text-white">財務諸表（試算表・決算書）</SelectItem>
                  <SelectItem value="shareholder_registry" className="text-white hover:text-white focus:text-white">株主名簿</SelectItem>
                  <SelectItem value="other" className="text-white hover:text-white focus:text-white">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white/90">タイトル</Label>
              <Input
                className="bg-white/5 border-white/10 text-white"
                value={uploadForm.title}
                onChange={(e) => setUploadForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例: 試算表 R7.8.14-R8.01.31"
              />
            </div>

            <div>
              <Label className="text-white/90">ファイル</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <div
                className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-white/20 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div>
                    <FileText className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-white/80 mt-1">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-white/70" />
                    <p className="text-white/80">クリックしてファイルを選択</p>
                    <p className="text-xs text-white/70 mt-1">PDF, Excel, CSV, Word対応</p>
                  </div>
                )}
              </div>
            </div>

            {uploadForm.documentType === "financial_statement" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/90">期間開始</Label>
                    <Input
                      type="date"
                      className="bg-white/5 border-white/10 text-white"
                      value={uploadForm.periodStart}
                      onChange={(e) => setUploadForm(f => ({ ...f, periodStart: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-white/90">期間終了</Label>
                    <Input
                      type="date"
                      className="bg-white/5 border-white/10 text-white"
                      value={uploadForm.periodEnd}
                      onChange={(e) => setUploadForm(f => ({ ...f, periodEnd: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/90">売上高（円）</Label>
                    <Input
                      type="number"
                      className="bg-white/5 border-white/10 text-white"
                      value={uploadForm.extractedRevenue || ""}
                      onChange={(e) => setUploadForm(f => ({ ...f, extractedRevenue: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label className="text-white/90">純利益（円）</Label>
                    <Input
                      type="number"
                      className="bg-white/5 border-white/10 text-white"
                      value={uploadForm.extractedNetIncome || ""}
                      onChange={(e) => setUploadForm(f => ({ ...f, extractedNetIncome: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/90">総資産（円）</Label>
                    <Input
                      type="number"
                      className="bg-white/5 border-white/10 text-white"
                      value={uploadForm.extractedTotalAssets || ""}
                      onChange={(e) => setUploadForm(f => ({ ...f, extractedTotalAssets: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label className="text-white/90">純資産（円）</Label>
                    <Input
                      type="number"
                      className="bg-white/5 border-white/10 text-white"
                      value={uploadForm.extractedNetAssets || ""}
                      onChange={(e) => setUploadForm(f => ({ ...f, extractedNetAssets: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label className="text-white/90">メモ（任意）</Label>
              <Textarea
                className="bg-white/5 border-white/10 text-white"
                value={uploadForm.notes}
                onChange={(e) => setUploadForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white/90 hover:bg-white/5">キャンセル</Button>
            </DialogClose>
            <Button
              className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
              onClick={handleFileUpload}
              disabled={!selectedFile || uploadDocMutation.isPending}
            >
              {uploadDocMutation.isPending ? "アップロード中..." : "アップロード"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-16 py-6 text-center text-xs text-white/70">
        <p>LCJ Coin — Phantom Stock Reward System — Live Commerce Japan Inc.</p>
        <p className="mt-1">IR情報: <a href="https://livecommercejapan.jp/ir" target="_blank" rel="noopener" className="text-orange-400/50 hover:text-orange-400 transition-colors">livecommercejapan.jp/ir</a></p>
      </footer>
    </div>
  );
}
