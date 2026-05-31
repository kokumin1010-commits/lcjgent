import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Clock, TrendingUp, ChevronDown, ChevronUp, Users, DollarSign, Activity, Zap, ArrowUpRight, ArrowDownRight, Megaphone, Gift, Package, Gauge, Target, CheckCircle, AlertCircle, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LiverListProps {
  agencyId?: number | null; // null = LCJ only, number = specific agency, undefined = all
  agencyName?: string; // Display name for the agency (e.g., "Mobmart", "LCJ")
}

export default function LiverList({ agencyId, agencyName }: LiverListProps = {}) {
  const { t, language } = useLanguage();
  
  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    return options;
  }, []);
  
  // Default to current month (latest)
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [showAllSales, setShowAllSales] = useState(false);
  const [showAllDuration, setShowAllDuration] = useState(false);
  const [showAllReferral, setShowAllReferral] = useState(false);
  const [showAllSets, setShowAllSets] = useState(false);
  const [setSortOrder, setSetSortOrder] = useState<'date' | 'revenue'>('date');
  const [selectedTrendMonth, setSelectedTrendMonth] = useState<string | null>(monthOptions[0].value);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [brandSectionOpen, setBrandSectionOpen] = useState(true);
  
  const { data: rankings, isLoading } = trpc.liverManagement.rankings.useQuery({
    month: selectedMonth,
    agencyId: agencyId,
  });
  
  const { data: livers } = trpc.liverManagement.listWithStats.useQuery({
    month: selectedMonth,
    agencyId: agencyId,
  });
  
  // Referral Ranking
  const { data: referralRanking } = trpc.referral.ranking.useQuery({ limit: 20, agencyId: agencyId });
  
  const referralRankingToShow = showAllReferral
    ? referralRanking
    : referralRanking?.slice(0, 5);

  // Total Liver Sales Summary
  const { data: totalSummary } = trpc.liverManagement.totalSalesSummary.useQuery({
    month: selectedMonth,
    agencyId: agencyId,
  });
  
  // Monthly Sales Trend
  const { data: salesTrend } = trpc.liverManagement.monthlySalesTrend.useQuery({ agencyId: agencyId });
  
  // Daily Sales Trend (when a month bar is tapped)
  const { data: dailySalesTrend } = trpc.liverManagement.dailySalesTrend.useQuery(
    { month: selectedTrendMonth || '', agencyId: agencyId },
    { enabled: !!selectedTrendMonth }
  );
  
  // Daily Liver Breakdown (when a day row is tapped)
  const { data: dailyLiverBreakdown } = trpc.liverManagement.dailyLiverBreakdown.useQuery(
    { date: selectedDay || '', agencyId: agencyId },
    { enabled: !!selectedDay }
  );

  // All livers' daily sales for sparkline charts
  const { data: allLiverDailySales } = trpc.liverManagement.allLiverDailySales.useQuery({
    month: selectedMonth,
    agencyId: agencyId,
  });

  // All livers' brand durations for the month
  const { data: allLiverBrandDurations } = trpc.liverManagement.allLiverBrandDurations.useQuery({
    month: selectedMonth,
    agencyId: agencyId,
  });

  // All sets for the month (全ライバーのセット一覧)
  const { data: allSetsData } = trpc.liverManagement.allSetsForMonth.useQuery({
    month: selectedMonth,
    agencyId: agencyId,
  });

  // All livers' brand efficiency (全ライバーのブランド別時間単価)
  const { data: allLiverBrandEfficiency } = trpc.liverManagement.allLiverBrandEfficiency.useQuery({
    month: selectedMonth,
    agencyId: agencyId,
  });
  
  // Determine display name
  const displayName = agencyName || "LCJ";
  
  const translations = {
    ja: {
      title: agencyName ? `${agencyName} ライバーリスト` : "ライバーリスト",
      monthLabel: "月選択",
      totalSales: "トータル売上",
      totalDuration: "総配信時間",
      totalLivestreams: "総配信数",
      activeLivers: "アクティブライバー",
      hourlyRate: "時間単価",
      vsLastMonth: "前月比",
      prevMonth: "前月",
      cumulative: "累計",
      lcjLiverSummary: `${displayName}ライバー全体実績`,
      salesRanking: "月間売上ランキング",
      durationRanking: "累計配信時間ランキング",
      sales: "売上",
      duration: "累計配信時間",
      viewMore: "VIEW MORE",
      viewLess: "閉じる",
      noData: "データがありません",
      hours: "時間",
      liverList: "ライバー一覧",
      forecast: "📈 月末予測",
      forecastOptimistic: "🔥 配信頑張れば",
      monthProgress: "月進捗",
      remainingTarget: "前月超えまであと",
      dailyGuide: "残り{days}日 × 毎日{hours}h配信でOK",
      perSession: "1配信の売上目標",
      alreadyExceeded: "🎉 前月超え達成済み！自己ベスト更新を目指そう！",
      perSessionBest: "1配信の売上目標（自己ベスト更新ペース）",
    },
    zh: {
      title: agencyName ? `${agencyName} 主播列表` : "主播列表",
      monthLabel: "选择月份",
      totalSales: "总销售额",
      totalDuration: "总直播时长",
      totalLivestreams: "总直播数",
      activeLivers: "活跃主播",
      hourlyRate: "时均销售额",
      vsLastMonth: "环比",
      prevMonth: "前月",
      cumulative: "累计",
      lcjLiverSummary: `${displayName}主播整体业绩`,
      salesRanking: "月间销售排行榜",
      durationRanking: "累计直播时长排行榜",
      sales: "销售额",
      duration: "累计直播时长",
      viewMore: "查看更多",
      viewLess: "收起",
      noData: "暂无数据",
      hours: "小时",
      liverList: "主播一览",
      forecast: "📈 月末预测",
      forecastOptimistic: "🔥 加油版",
      monthProgress: "月进度",
      remainingTarget: "超越上月还差",
      dailyGuide: "剩余{days}天 × 每天直播{hours}h就OK",
      perSession: "每次直播销售目标",
      alreadyExceeded: "🎉 已超越上月！继续加油创新纪录！",
      perSessionBest: "每次直播销售目标（创新纪录节奏）",
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  const formatCurrency = (amount: number | string) => {
    return `¥${Number(amount).toLocaleString()}`;
  };

  // 当月かどうかの判定
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return selectedMonth === currentYM;
  }, [selectedMonth]);

  // 月末予測売上計算（当月のみ）
  const calcForecast = (currentSales: number, prevSales: number, currentDurationMin: number) => {
    if (!isCurrentMonth || currentSales <= 0) return null;
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (dayOfMonth < 2) return null; // 初日は予測不可
    const remainingDays = daysInMonth - dayOfMonth;
    const dailyAvg = currentSales / dayOfMonth;
    const baseForecast = dailyAvg * daysInMonth;
    const optimisticForecast = baseForecast * 1.2;
    const progress = Math.round((dayOfMonth / daysInMonth) * 100);
    
    // 前月超え目標の配信ガイド
    const target = prevSales > 0 ? prevSales : baseForecast;
    const remainingSales = Math.max(0, target - currentSales);
    const hourlyRate = currentDurationMin > 0 ? currentSales / (currentDurationMin / 60) : 0;
    const remainingHours = hourlyRate > 0 ? remainingSales / hourlyRate : 0;
    const dailyHours = remainingDays > 0 ? remainingHours / remainingDays : 0;
    const perSessionTarget = remainingDays > 0 ? Math.round(remainingSales / remainingDays) : 0;
    const alreadyExceeded = prevSales > 0 && currentSales >= prevSales;
    
    return {
      base: Math.round(baseForecast),
      optimistic: Math.round(optimisticForecast),
      progress,
      remainingDays,
      remainingSales: Math.round(remainingSales),
      dailyHours: Math.round(dailyHours * 10) / 10,
      perSessionTarget,
      alreadyExceeded,
      target: Math.round(target),
    };
  };
  
  const formatHourlyRate = (sales: number, durationMinutes: number) => {
    if (!durationMinutes || durationMinutes === 0) return "--";
    const hours = durationMinutes / 60;
    const rate = Math.round(sales / hours);
    return `¥${rate.toLocaleString()}`;
  };
  
  const formatDuration = (minutes: number) => {
    const hours = (minutes / 60).toFixed(1);
    return `${hours}`;
  };
  
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Crown className="w-5 h-5 text-white" />;
    if (rank === 3) return <Crown className="w-5 h-5 text-amber-700" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-white">{rank}</span>;
  };
  
  const salesRankingToShow = showAllSales 
    ? rankings?.salesRanking 
    : rankings?.salesRanking?.slice(0, 5);
    
  const durationRankingToShow = showAllDuration 
    ? rankings?.durationRanking 
    : rankings?.durationRanking?.slice(0, 5);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-gray-800" />
          <Skeleton className="h-64 w-full bg-gray-800" />
          <Skeleton className="h-64 w-full bg-gray-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Red top border */}
      <div className="h-1 bg-red-600" />
      
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{tr.title}</h1>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40 bg-transparent border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {monthOptions.map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  className="text-white hover:bg-gray-800"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Month display */}
        <div className="flex items-center justify-between text-sm text-white">
          <span>{monthOptions.find(m => m.value === selectedMonth)?.label}</span>
          <span>{selectedMonth.replace("-", "年")}月▼</span>
        </div>
        
        {/* Liver Total Summary */}
        {totalSummary && (
          <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500/30">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                <Zap className="w-6 h-6 text-yellow-400" />
                {tr.lcjLiverSummary}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Total Sales */}
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-yellow-400" />
                    <span className="text-white/90 text-sm">{tr.totalSales}</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">
                    ¥{Number(totalSummary.totalSales).toLocaleString()}
                  </p>
                  <div className={`flex items-center gap-1 mt-1 text-sm ${totalSummary.salesGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalSummary.salesGrowth >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span>{totalSummary.salesGrowth >= 0 ? '+' : ''}{totalSummary.salesGrowth}%</span>
                    <span className="text-white/80">{tr.vsLastMonth}</span>
                  </div>
                </div>
                
                {/* Total Duration */}
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <span className="text-white/90 text-sm">{tr.totalDuration}</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-400">
                    {(totalSummary.totalDuration / 60).toFixed(1)}h
                  </p>
                  <div className={`flex items-center gap-1 mt-1 text-sm ${totalSummary.durationGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalSummary.durationGrowth >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span>{totalSummary.durationGrowth >= 0 ? '+' : ''}{totalSummary.durationGrowth}%</span>
                    <span className="text-white/80">{tr.vsLastMonth}</span>
                  </div>
                </div>
                
                {/* Total Livestreams */}
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-green-400" />
                    <span className="text-white/90 text-sm">{tr.totalLivestreams}</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400">
                    {totalSummary.totalLivestreams}回
                  </p>
                  <div className={`flex items-center gap-1 mt-1 text-sm ${totalSummary.livestreamGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalSummary.livestreamGrowth >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span>{totalSummary.livestreamGrowth >= 0 ? '+' : ''}{totalSummary.livestreamGrowth}%</span>
                    <span className="text-white/80">{tr.vsLastMonth}</span>
                  </div>
                </div>
                
                {/* Hourly Rate */}
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge className="w-5 h-5 text-orange-400" />
                    <span className="text-white/90 text-sm">{tr.hourlyRate}</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-400">
                    {totalSummary.totalDuration > 0 
                      ? `¥${Math.round(Number(totalSummary.totalSales) / (totalSummary.totalDuration / 60)).toLocaleString()}`
                      : '--'}
                  </p>
                  {(() => {
                    const currentRate = totalSummary.totalDuration > 0 ? Number(totalSummary.totalSales) / (totalSummary.totalDuration / 60) : 0;
                    const prevRate = totalSummary.prevTotalDuration > 0 ? Number(totalSummary.prevTotalSales) / (totalSummary.prevTotalDuration / 60) : 0;
                    const growth = prevRate > 0 ? Math.round(((currentRate - prevRate) / prevRate) * 100) : (currentRate > 0 ? 100 : 0);
                    return (
                      <div className={`flex items-center gap-1 mt-1 text-sm ${growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {growth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        <span>{growth >= 0 ? '+' : ''}{growth}%</span>
                        <span className="text-white/60 text-xs ml-1">(前月 ¥{Math.round(prevRate).toLocaleString()})</span>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Active Livers */}
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-pink-400" />
                    <span className="text-white/90 text-sm">{tr.activeLivers}</span>
                  </div>
                  <p className="text-2xl font-bold text-pink-400">
                    {totalSummary.activeLivers}人
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-sm text-white/80">
                    <span>前月: {totalSummary.prevActiveLivers}人</span>
                  </div>
                </div>
              </div>

              {/* Brand Total Duration (全ブランド合計配信時間) */}
              {allLiverBrandDurations && (() => {
                // Aggregate all brands across all livers (with nameJa merging)
                const brandTotals: Record<string, { brandName: string; brandNameJa: string; totalMinutes: number }> = {};
                const nameJaToKey: Record<string, string> = {}; // nameJa -> key in brandTotals
                const normKey = (s: string) => s.toLowerCase().replace(/[\s.\-\u3000]/g, '');
                Object.values(allLiverBrandDurations as Record<string, { brandId: number; brandName: string; brandNameJa?: string; durationMinutes: number }[]>).forEach((brands) => {
                  brands.forEach((b) => {
                    const nk = normKey(b.brandName);
                    const nkJa = b.brandNameJa ? normKey(b.brandNameJa) : '';
                    // Find existing key by name, nameJa, or cross-match
                    let key = brandTotals[nk] ? nk : (nkJa && brandTotals[nkJa]) ? nkJa : nameJaToKey[nk] || (nkJa ? nameJaToKey[nkJa] : '') || '';
                    if (!key) key = nk;
                    if (!brandTotals[key]) {
                      brandTotals[key] = { brandName: b.brandName, brandNameJa: b.brandNameJa || '', totalMinutes: 0 };
                    }
                    brandTotals[key].totalMinutes += b.durationMinutes;
                    if (b.brandNameJa && (!brandTotals[key].brandNameJa || b.brandNameJa.length > brandTotals[key].brandNameJa.length)) {
                      brandTotals[key].brandNameJa = b.brandNameJa;
                    }
                    // Register mappings
                    if (nkJa) nameJaToKey[nkJa] = key;
                    nameJaToKey[nk] = key;
                  });
                });
                const sortedBrands = Object.values(brandTotals).sort((a, b) => b.totalMinutes - a.totalMinutes);
                if (sortedBrands.length === 0) return null;
                const totalAllMinutes = sortedBrands.reduce((sum, b) => sum + b.totalMinutes, 0);
                return (
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <h3 
                      className="text-sm text-white/90 flex items-center gap-1.5 mb-3 cursor-pointer select-none hover:text-white transition-colors"
                      onClick={() => setBrandSectionOpen(!brandSectionOpen)}
                    >
                      <span className={`transition-transform duration-200 ${brandSectionOpen ? 'rotate-90' : ''}`}>▶</span>
                      🏷️ 今月のブランド別配信時間
                      <span className="text-[10px] text-white/40 ml-1">合計: {Math.floor(totalAllMinutes / 60)}h{totalAllMinutes % 60 > 0 ? `${totalAllMinutes % 60}m` : ''}</span>
                      <span className="text-[10px] text-white/30 ml-auto">{brandSectionOpen ? 'タップで閉じる' : 'タップで開く'}</span>
                    </h3>
                    {brandSectionOpen && <div className="space-y-1.5">
                      {sortedBrands.map((brand) => {
                        const maxMinutes = sortedBrands[0].totalMinutes;
                        const barWidth = maxMinutes > 0 ? (brand.totalMinutes / maxMinutes) * 100 : 0;
                        const hours = Math.floor(brand.totalMinutes / 60);
                        const mins = brand.totalMinutes % 60;
                        const isExpanded = expandedBrand === brand.brandName;
                        // Get per-liver breakdown for this brand
                        const liverBreakdown: { liverId: string; liverName: string; minutes: number }[] = [];
                        if (isExpanded) {
                          Object.entries(allLiverBrandDurations as Record<string, { brandId: number; brandName: string; durationMinutes: number }[]>).forEach(([lid, brands]) => {
                            const match = brands.find(b => b.brandName === brand.brandName);
                            if (match && match.durationMinutes > 0) {
                              const liver = livers?.find(l => l.id === Number(lid));
                              liverBreakdown.push({
                                liverId: lid,
                                liverName: liver?.name || `Liver#${lid}`,
                                minutes: match.durationMinutes,
                              });
                            }
                          });
                          liverBreakdown.sort((a, b) => b.minutes - a.minutes);
                        }
                        return (
                          <div key={brand.brandName}>
                            <div 
                              className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5 transition-colors"
                              onClick={() => setExpandedBrand(isExpanded ? null : brand.brandName)}
                            >
                              <span className="text-[10px] text-white/40 w-[12px] shrink-0">{isExpanded ? '▼' : '▶'}</span>
                              <span className="text-[11px] text-white/70 w-[88px] shrink-0 truncate" title={brand.brandNameJa && brand.brandNameJa !== brand.brandName ? `${brand.brandNameJa} (${brand.brandName})` : brand.brandName}>{brand.brandNameJa || brand.brandName}</span>
                              <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 rounded transition-all"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-emerald-300 w-[60px] text-right shrink-0">
                                {hours}h{mins > 0 ? `${mins}m` : ''}
                              </span>
                            </div>
                            {isExpanded && liverBreakdown.length > 0 && (
                              <div className="ml-6 mt-1 mb-2 pl-3 border-l-2 border-emerald-500/30 space-y-1">
                                {liverBreakdown.map((liver) => {
                                  const lHours = Math.floor(liver.minutes / 60);
                                  const lMins = liver.minutes % 60;
                                  const lBarWidth = brand.totalMinutes > 0 ? (liver.minutes / brand.totalMinutes) * 100 : 0;
                                  return (
                                    <div key={liver.liverId} className="flex items-center gap-2">
                                      <span className="text-[10px] text-white/50 w-[70px] shrink-0 truncate">{liver.liverName}</span>
                                      <div className="flex-1 h-2.5 bg-white/5 rounded overflow-hidden">
                                        <div 
                                          className="h-full bg-gradient-to-r from-teal-400/60 to-cyan-300/60 rounded transition-all"
                                          style={{ width: `${lBarWidth}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-mono text-teal-300/80 w-[50px] text-right shrink-0">
                                        {lHours}h{lMins > 0 ? `${lMins}m` : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                                <p className="text-[9px] text-white/30 mt-1">{liverBreakdown.length}名のライバーが配信</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                );
              })()}
              
              {/* Daily Sales Bar Chart (Amazon Seller style) - Default visible */}
              {dailySalesTrend && dailySalesTrend.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm text-white/90 flex items-center gap-1.5">
                      📊 {monthOptions.find(m => m.value === selectedTrendMonth)?.label || selectedMonth} の日別売上
                    </h3>
                    <span className="text-[10px] text-white/40">
                      合計: ¥{(dailySalesTrend.reduce((sum: number, d: any) => sum + d.totalSales, 0)).toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Vertical Bar Chart (Amazon-style) */}
                  <div className="relative">
                    {/* Y-axis labels */}
                    {(() => {
                      const maxSales = Math.max(...dailySalesTrend.map((d: any) => d.totalSales));
                      const yLabels = maxSales > 0 ? [
                        { value: maxSales, label: `${(maxSales / 10000).toFixed(0)}万` },
                        { value: maxSales * 0.5, label: `${(maxSales * 0.5 / 10000).toFixed(0)}万` },
                        { value: 0, label: '0' },
                      ] : [];
                      return (
                        <div className="flex">
                          <div className="flex flex-col justify-between h-[140px] pr-1 text-[9px] text-white/30 w-[32px] shrink-0">
                            {yLabels.map((yl, i) => <span key={i}>{yl.label}</span>)}
                          </div>
                          <div className="flex-1 flex items-end gap-[2px] h-[140px] border-b border-l border-white/10 pb-0 pl-0 relative">
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                              <div className="border-b border-white/5 w-full" />
                              <div className="border-b border-white/5 w-full" />
                              <div />
                            </div>
                            {dailySalesTrend.map((day: any) => {
                              const heightPct = maxSales > 0 ? Math.max((day.totalSales / maxSales) * 100, 0) : 0;
                              const dayNum = new Date(day.date + 'T00:00:00').getDate();
                              const isSelected = selectedDay === day.date;
                              const isZero = day.totalSales === 0;
                              return (
                                <div 
                                  key={day.date} 
                                  className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer group relative"
                                  onClick={() => !isZero && setSelectedDay(isSelected ? null : day.date)}
                                >
                                  {/* Tooltip on hover */}
                                  {!isZero && (
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-yellow-300 font-bold whitespace-nowrap pointer-events-none z-10">
                                      ¥{day.totalSales >= 1000000 ? (day.totalSales / 10000).toFixed(1) + '万' : day.totalSales.toLocaleString()}
                                    </div>
                                  )}
                                  <div 
                                    className={`w-full rounded-t-sm transition-all duration-150 ${
                                      isSelected 
                                        ? 'bg-gradient-to-t from-orange-400 to-orange-200 ring-1 ring-orange-400/50' 
                                        : isZero 
                                          ? 'bg-white/5'
                                          : 'bg-gradient-to-t from-orange-500 to-orange-300 group-hover:from-orange-400 group-hover:to-orange-200'
                                    }`}
                                    style={{ height: `${Math.max(heightPct, isZero ? 1 : 2)}%`, minHeight: '1px' }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    {/* X-axis labels (show every 5th day) */}
                    <div className="flex ml-[32px]">
                      <div className="flex-1 flex gap-[2px]">
                        {dailySalesTrend.map((day: any, i: number) => {
                          const dayNum = new Date(day.date + 'T00:00:00').getDate();
                          const showLabel = dayNum === 1 || dayNum % 5 === 0 || i === dailySalesTrend.length - 1;
                          return (
                            <div key={day.date} className="flex-1 text-center">
                              {showLabel && <span className="text-[8px] text-white/40">{new Date(day.date + 'T00:00:00').getMonth() + 1}/{dayNum}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Day detail list (tap to expand) */}
                  <div className="mt-3 space-y-0.5 max-h-[350px] overflow-y-auto pr-1">
                    <p className="text-[10px] text-white/40 mb-1">タップで詳細 ↓</p>
                    {dailySalesTrend.map((day: any) => {
                      const dayNum = new Date(day.date + 'T00:00:00').getDate();
                      const monthNum = new Date(day.date + 'T00:00:00').getMonth() + 1;
                      const maxDailySales = Math.max(...dailySalesTrend.map((d: any) => d.totalSales));
                      const barWidth = maxDailySales > 0 ? Math.max((day.totalSales / maxDailySales) * 100, 0) : 0;
                      const isZero = day.totalSales === 0;
                      const isDaySelected = selectedDay === day.date;
                      return (
                        <div key={day.date}>
                          <div 
                            className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-all ${isZero ? 'opacity-40' : isDaySelected ? 'bg-cyan-500/15 ring-1 ring-cyan-500/30' : 'hover:bg-white/5'}`}
                            onClick={() => !isZero && setSelectedDay(isDaySelected ? null : day.date)}
                          >
                            <span className="text-[11px] text-white/60 w-[36px] shrink-0 font-mono">{monthNum}/{dayNum}</span>
                            <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                              <div 
                                className={`h-full rounded transition-all ${isDaySelected ? 'bg-gradient-to-r from-cyan-400 to-cyan-200' : 'bg-gradient-to-r from-cyan-500 to-cyan-300'}`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-mono w-[80px] text-right shrink-0 ${isZero ? 'text-white/30' : isDaySelected ? 'text-cyan-200 font-semibold' : 'text-cyan-300'}`}>
                              {isZero ? '-' : `¥${day.totalSales >= 10000000 ? (day.totalSales / 10000).toFixed(0) + '万' : day.totalSales >= 1000000 ? (day.totalSales / 10000).toFixed(1) + '万' : day.totalSales.toLocaleString()}`}
                            </span>
                            {day.totalLivestreams > 0 && (
                              <span className="text-[9px] text-white/30 w-[28px] shrink-0 text-right">{day.totalLivestreams}配信</span>
                            )}
                          </div>
                          {/* Liver breakdown for selected day */}
                          {isDaySelected && dailyLiverBreakdown && dailyLiverBreakdown.length > 0 && (
                            <div className="ml-10 mr-2 mt-1 mb-2 p-2 bg-white/5 rounded-lg border border-white/10">
                              <div className="text-[10px] text-white/40 mb-1.5">👥 ライバー別内訳</div>
                              <div className="space-y-1">
                                {dailyLiverBreakdown.map((liver: any, idx: number) => {
                                  const maxLiverSales = dailyLiverBreakdown[0]?.totalSales || 1;
                                  const liverBarWidth = (liver.totalSales / maxLiverSales) * 100;
                                  return (
                                    <div key={liver.liverId || idx} className="flex items-center gap-1.5">
                                      {liver.avatarUrl ? (
                                        <img src={liver.avatarUrl} className="w-4 h-4 rounded-full shrink-0" alt="" />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0 flex items-center justify-center text-[7px] text-white font-bold">
                                          {liver.liverName.charAt(0)}
                                        </div>
                                      )}
                                      <span className="text-[10px] text-white/70 w-[60px] shrink-0 truncate">{liver.liverName}</span>
                                      <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden">
                                        <div 
                                          className="h-full bg-gradient-to-r from-purple-500 to-pink-400 rounded transition-all"
                                          style={{ width: `${liverBarWidth}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-mono text-purple-300 w-[70px] text-right shrink-0">
                                        ¥{liver.totalSales >= 1000000 ? (liver.totalSales / 10000).toFixed(1) + '万' : liver.totalSales.toLocaleString()}
                                      </span>
                                      <span className="text-[8px] text-white/30 w-[20px] shrink-0 text-right">{liver.livestreamCount}回</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {isDaySelected && !dailyLiverBreakdown && (
                            <div className="ml-10 mr-2 mt-1 mb-2 p-2 bg-white/5 rounded-lg">
                              <div className="flex items-center gap-2 text-[10px] text-white/40">
                                <div className="animate-spin w-3 h-3 border border-white/30 border-t-white/80 rounded-full" />
                                読み込み中...
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Top 3 days */}
                  <div className="mt-3 pt-2 border-t border-white/5 space-y-0.5">
                    {[...dailySalesTrend].sort((a: any, b: any) => b.totalSales - a.totalSales).slice(0, 3).map((day: any, i: number) => (
                      <div key={day.date} className="flex items-center justify-between text-[10px]">
                        <span className="text-white/50">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {new Date(day.date + 'T00:00:00').getMonth() + 1}/{new Date(day.date + 'T00:00:00').getDate()}</span>
                        <span className="text-cyan-300 font-medium">¥{day.totalSales.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state for daily trend */}
              {selectedTrendMonth && !dailySalesTrend && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <div className="animate-spin w-3 h-3 border border-white/30 border-t-white/80 rounded-full" />
                    日別売上を読み込み中...
                  </div>
                </div>
              )}

              {/* Monthly Trend (collapsible, moved to bottom) */}
              {salesTrend && salesTrend.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <h3 className="text-[11px] text-white/50 mb-2">月別推移（過去6ヶ月）</h3>
                  <div className="flex items-end gap-2" style={{ height: '50px' }}>
                    {salesTrend.map((month: any) => {
                      const maxSales = Math.max(...salesTrend.map((m: any) => m.totalSales));
                      const heightPx = maxSales > 0 ? Math.max(Math.round((month.totalSales / maxSales) * 35), 3) : 3;
                      const isCurrentMonth = month.month === selectedTrendMonth;
                      return (
                        <div 
                          key={month.month} 
                          className="flex-1 flex flex-col items-center justify-end cursor-pointer group" 
                          style={{ height: '100%' }}
                          onClick={() => { setSelectedDay(null); setSelectedTrendMonth(month.month); }}
                        >
                          <div 
                            className={`w-full rounded-t transition-all duration-200 ${
                              isCurrentMonth 
                                ? 'bg-gradient-to-t from-yellow-400 to-yellow-200' 
                                : 'bg-gradient-to-t from-yellow-500/50 to-yellow-300/50 group-hover:from-yellow-400 group-hover:to-yellow-200'
                            }`}
                            style={{ height: `${heightPx}px`, minHeight: '3px' }}
                          />
                          <span className={`text-[9px] mt-0.5 ${isCurrentMonth ? 'text-yellow-300 font-bold' : 'text-white/50'}`}>{month.label.replace(/\d+年/, '')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Sales Ranking */}
        <Card className="bg-gray-900/80 border-gray-700">
          <CardContent className="p-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-yellow-500" />
              {tr.salesRanking}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
            </h2>
            
            {salesRankingToShow && salesRankingToShow.length > 0 ? (
              <div className="space-y-3">
                {salesRankingToShow.map((item, index) => (
                  <Link 
                    key={item.liverId || item.streamerName || index} 
                    href={`/livers/by-name/${encodeURIComponent(item.streamerName || '')}`}
                  >
                    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer">
                      {getRankIcon(index + 1)}
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={(item as any).avatarUrl || livers?.find(l => l.id === item.liverId)?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-gray-700 text-white">
                          {((item as any).liverName || item.streamerName)?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-white">{(item as any).liverName || item.streamerName || "不明"}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                          <div>
                            <span className="text-yellow-500 font-bold">
                              {formatCurrency(item.totalSales)}
                            </span>
                            <div className="h-1 bg-yellow-500/30 rounded mt-1">
                              <div 
                                className="h-full bg-yellow-500 rounded" 
                                style={{ 
                                  width: `${Math.min(100, (item.totalSales / (rankings?.salesRanking?.[0]?.totalSales || 1)) * 100)}%` 
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-white">{tr.sales}</span>
                              <span className={`text-xs ${(item as any).salesGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(item as any).salesGrowth >= 0 ? '+' : ''}{(item as any).salesGrowth}%
                              </span>
                            </div>
                            <span className="text-xs text-white/40">{tr.prevMonth}: {formatCurrency((item as any).prevSales || 0)}</span>
                          </div>
                          <div>
                            <span className="text-blue-400">
                              {formatDuration(item.totalDuration)}
                            </span>
                            <div className="h-1 bg-blue-500/30 rounded mt-1">
                              <div 
                                className="h-full bg-blue-500 rounded" 
                                style={{ 
                                  width: `${Math.min(100, (item.totalDuration / (rankings?.durationRanking?.[0]?.totalDuration || 1)) * 100)}%` 
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-white">{tr.duration}</span>
                              <span className={`text-xs ${(item as any).durationGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(item as any).durationGrowth >= 0 ? '+' : ''}{(item as any).durationGrowth}%
                              </span>
                            </div>
                            <span className="text-xs text-white/40">{tr.prevMonth}: {formatDuration((item as any).prevDuration || 0)}</span>
                          </div>
                          <div>
                            <span className="text-orange-400 font-bold">
                              {formatHourlyRate(item.totalSales, item.totalDuration)}
                            </span>
                            <div className="h-1 bg-orange-500/30 rounded mt-1">
                              <div 
                                className="h-full bg-orange-500 rounded" 
                                style={{ 
                                  width: `${(() => {
                                    const maxRate = rankings?.salesRanking?.reduce((max, r) => {
                                      const rate = r.totalDuration > 0 ? r.totalSales / r.totalDuration : 0;
                                      return Math.max(max, rate);
                                    }, 0) || 1;
                                    const currentRate = item.totalDuration > 0 ? item.totalSales / item.totalDuration : 0;
                                    return Math.min(100, (currentRate / maxRate) * 100);
                                  })()}%` 
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-white">{tr.hourlyRate}</span>
                              {(() => {
                                const prevRate = (item as any).prevDuration > 0 ? (item as any).prevSales / ((item as any).prevDuration / 60) : 0;
                                const curRate = item.totalDuration > 0 ? item.totalSales / (item.totalDuration / 60) : 0;
                                const growth = prevRate > 0 ? Math.round(((curRate - prevRate) / prevRate) * 100) : (curRate > 0 ? 100 : 0);
                                return (
                                  <span className={`text-xs ${growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {growth >= 0 ? '+' : ''}{growth}%
                                  </span>
                                );
                              })()}
                            </div>
                            <span className="text-xs text-white/40">{tr.prevMonth}: {formatHourlyRate((item as any).prevSales || 0, (item as any).prevDuration || 0)}</span>
                          </div>
                        </div>
                        {/* 月末予測売上（当月のみ表示） */}
                        {(() => {
                          const forecast = calcForecast(item.totalSales, (item as any).prevSales || 0, (item as any).totalDuration || 0);
                          if (!forecast) return null;
                          return (
                            <div className="mt-2 p-2 rounded-lg bg-gradient-to-r from-emerald-900/30 to-cyan-900/20 border border-emerald-500/20">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-emerald-300/80">{tr.forecast}</span>
                                <span className="text-[10px] text-white/40">{tr.monthProgress}: {forecast.progress}%</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-emerald-400">{formatCurrency(forecast.base)}</span>
                                <span className="text-[10px] text-white/30">→</span>
                                <span className="text-sm font-bold text-amber-400">{tr.forecastOptimistic} {formatCurrency(forecast.optimistic)}</span>
                              </div>
                              {forecast.alreadyExceeded ? (
                                <div className="mt-1.5 pt-1.5 border-t border-emerald-500/10">
                                  <div className="text-[10px] text-emerald-300/90 font-medium">{(tr as any).alreadyExceeded}</div>
                                  {forecast.perSessionTarget > 0 && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <span className="text-[10px] text-amber-300/70">💰 {(tr as any).perSessionBest}:</span>
                                      <span className="text-xs font-bold text-amber-400">{formatCurrency(forecast.perSessionTarget)}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1.5 pt-1.5 border-t border-emerald-500/10">
                                  {forecast.remainingSales > 0 && (
                                    <div className="text-[10px] text-cyan-300/80">
                                      ⏰ {(tr as any).remainingTarget} <span className="font-bold text-cyan-300">{formatCurrency(forecast.remainingSales)}</span>
                                    </div>
                                  )}
                                  {forecast.dailyHours > 0 && forecast.remainingDays > 0 && (
                                    <div className="mt-0.5 text-[10px] text-blue-300/70">
                                      📅 {((tr as any).dailyGuide as string).replace('{days}', String(forecast.remainingDays)).replace('{hours}', String(forecast.dailyHours))}
                                    </div>
                                  )}
                                  {forecast.perSessionTarget > 0 && (
                                    <div className="mt-0.5 flex items-center gap-1">
                                      <span className="text-[10px] text-amber-300/70">💰 {(tr as any).perSession}:</span>
                                      <span className="text-xs font-bold text-amber-400">{formatCurrency(forecast.perSessionTarget)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* Cumulative Sales */}
                        {(item as any).cumulativeSales > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-white/5">
                            <span className="text-xs text-white/50">{tr.cumulative}: </span>
                            <span className="text-xs text-yellow-300/70 font-medium">{formatCurrency((item as any).cumulativeSales)}</span>
                            <span className="text-xs text-white/30 ml-2">{formatDuration((item as any).cumulativeDuration || 0)}h</span>
                          </div>
                        )}
                        {/* Daily Sales Mini Chart */}
                        {item.liverId && allLiverDailySales && (allLiverDailySales as any)[item.liverId] && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-[10px] text-white/40 mb-1">📊 今月の日別売上</p>
                            <div className="flex items-end gap-[2px] h-8">
                              {(() => {
                                const dailyData = (allLiverDailySales as any)[item.liverId!] as { date: string; sales: number }[];
                                const maxSales = Math.max(...dailyData.map(d => d.sales), 1);
                                const [year, mon] = selectedMonth.split('-').map(Number);
                                const daysInMonth = new Date(year, mon, 0).getDate();
                                const salesByDay: Record<string, number> = {};
                                dailyData.forEach(d => { salesByDay[d.date] = d.sales; });
                                return Array.from({ length: daysInMonth }, (_, i) => {
                                  const day = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
                                  const sales = salesByDay[day] || 0;
                                  const height = sales > 0 ? Math.max(2, (sales / maxSales) * 28) : 0;
                                  return (
                                    <div
                                      key={day}
                                      className={`flex-1 rounded-sm ${sales > 0 ? 'bg-yellow-400/80' : 'bg-gray-700/30'}`}
                                      style={{ height: `${height}px`, minWidth: '2px' }}
                                      title={`${i + 1}日: \u00a5${sales.toLocaleString()}`}
                                    />
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                        {/* Brand Duration Breakdown */}
                        {item.liverId && allLiverBrandDurations && (allLiverBrandDurations as any)[item.liverId] && (allLiverBrandDurations as any)[item.liverId].length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-[10px] text-white/40 mb-1">🏷️ 今月のブランド別配信時間</p>
                            <div className="flex flex-wrap gap-1">
                              {((allLiverBrandDurations as any)[item.liverId!] as { brandId: number; brandName: string; durationMinutes: number }[]).map(brand => (
                                <span
                                  key={brand.brandId}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-900/40 border border-indigo-500/20 text-[10px]"
                                >
                                  <span className="text-indigo-300">{brand.brandNameJa || brand.brandName}{brand.brandNameJa && brand.brandNameJa !== brand.brandName && <span className="text-indigo-300/50 ml-0.5">({brand.brandName})</span>}</span>
                                  <span className="text-white/60 font-medium">{brand.durationMinutes >= 60 ? `${Math.floor(brand.durationMinutes / 60)}h${brand.durationMinutes % 60 > 0 ? `${brand.durationMinutes % 60}m` : ''}` : `${brand.durationMinutes}m`}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Brand Efficiency Badges (ブランド別時間単価バッジ) */}
                        {item.liverId && allLiverBrandEfficiency && (allLiverBrandEfficiency as any)[item.liverId] && (allLiverBrandEfficiency as any)[item.liverId].length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-[10px] text-white/40 mb-1">💰 ブランド別時間単価</p>
                            <div className="flex flex-wrap gap-1">
                              {((allLiverBrandEfficiency as any)[item.liverId!] as { brandId: number; brandName: string; totalHours: number; csvGmv: number; hourlyRate: number }[])
                                .filter((b: any) => b.totalHours > 0 && b.csvGmv > 0)
                                .slice(0, 5)
                                .map((brand: any) => {
                                  const isHigh = brand.hourlyRate >= 50000;
                                  const isLow = brand.hourlyRate > 0 && brand.hourlyRate < 15000;
                                  const icon = isHigh ? '🔥' : isLow ? '⚠️' : '';
                                  const bgClass = isHigh 
                                    ? 'bg-orange-900/40 border-orange-500/30' 
                                    : isLow 
                                      ? 'bg-red-900/30 border-red-500/20' 
                                      : 'bg-emerald-900/30 border-emerald-500/20';
                                  const textClass = isHigh 
                                    ? 'text-orange-300' 
                                    : isLow 
                                      ? 'text-red-300' 
                                      : 'text-emerald-300';
                                  return (
                                    <span
                                      key={brand.brandId}
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${bgClass}`}
                                      title={`${brand.brandNameJa || brand.brandName}${brand.brandNameJa && brand.brandNameJa !== brand.brandName ? ` (${brand.brandName})` : ''}: ¥${brand.hourlyRate.toLocaleString()}/h (売上¥${brand.csvGmv.toLocaleString()} / ${brand.totalHours}h)`}
                                    >
                                      {icon && <span>{icon}</span>}
                                      <span className={textClass}>{brand.brandNameJa || brand.brandName}</span>
                                      <span className="text-white/70 font-bold">¥{brand.hourlyRate >= 10000 ? `${Math.round(brand.hourlyRate / 10000)}万` : brand.hourlyRate.toLocaleString()}/h</span>
                                    </span>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
             <p className="text-white text-center py-4">{tr.noData}</p>           )}
            
            {rankings?.salesRanking && rankings.salesRanking.length > 5 && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllSales(!showAllSales)}
                  className="border-gray-700 text-white hover:bg-gray-800"
                >
                  {showAllSales ? (
                    <>
                      {tr.viewLess} <ChevronUp className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      {tr.viewMore} <ChevronDown className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Duration Ranking - moved here after Sales Ranking */}
        <Card className="bg-gray-900/80 border-gray-700">
          <CardContent className="p-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-blue-500" />
              {tr.durationRanking}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
            </h2>
            
            {durationRankingToShow && durationRankingToShow.length > 0 ? (
              <div className="space-y-3">
                {durationRankingToShow.map((item, index) => (
                  <Link 
                    key={item.liverId || item.streamerName || index} 
                    href={`/livers/by-name/${encodeURIComponent(item.streamerName || '')}`}
                  >
                    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer">
                      {getRankIcon(index + 1)}
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={(item as any).avatarUrl || livers?.find(l => l.id === item.liverId)?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-gray-700 text-white">
                          {((item as any).liverName || item.streamerName)?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-white">{(item as any).liverName || item.streamerName || "不明"}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                          <div>
                            <span className="text-yellow-500">
                              {formatCurrency(item.totalSales)}
                            </span>
                            <div className="h-1 bg-yellow-500/30 rounded mt-1">
                              <div 
                                className="h-full bg-yellow-500 rounded" 
                                style={{ 
                                  width: `${Math.min(100, (item.totalSales / (rankings?.salesRanking?.[0]?.totalSales || 1)) * 100)}%` 
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-white">{tr.sales}</span>
                              <span className={`text-xs ${(item as any).salesGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(item as any).salesGrowth >= 0 ? '+' : ''}{(item as any).salesGrowth}%
                              </span>
                            </div>
                            <span className="text-xs text-white/40">{tr.prevMonth}: {formatCurrency((item as any).prevSales || 0)}</span>
                          </div>
                          <div>
                            <span className="text-blue-400 font-bold">
                              {formatDuration(item.totalDuration)}
                            </span>
                            <div className="h-1 bg-blue-500/30 rounded mt-1">
                              <div 
                                className="h-full bg-blue-500 rounded" 
                                style={{ 
                                  width: `${Math.min(100, (item.totalDuration / (rankings?.durationRanking?.[0]?.totalDuration || 1)) * 100)}%` 
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-white">{tr.duration}</span>
                              <span className={`text-xs ${(item as any).durationGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(item as any).durationGrowth >= 0 ? '+' : ''}{(item as any).durationGrowth}%
                              </span>
                            </div>
                            <span className="text-xs text-white/40">{tr.prevMonth}: {formatDuration((item as any).prevDuration || 0)}</span>
                          </div>
                          <div>
                            <span className="text-orange-400 font-bold">
                              {formatHourlyRate(item.totalSales, item.totalDuration)}
                            </span>
                            <div className="h-1 bg-orange-500/30 rounded mt-1">
                              <div 
                                className="h-full bg-orange-500 rounded" 
                                style={{ 
                                  width: `${(() => {
                                    const maxRate = rankings?.durationRanking?.reduce((max, r) => {
                                      const rate = r.totalDuration > 0 ? r.totalSales / r.totalDuration : 0;
                                      return Math.max(max, rate);
                                    }, 0) || 1;
                                    const currentRate = item.totalDuration > 0 ? item.totalSales / item.totalDuration : 0;
                                    return Math.min(100, (currentRate / maxRate) * 100);
                                  })()}%` 
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-white">{tr.hourlyRate}</span>
                              {(() => {
                                const prevRate = (item as any).prevDuration > 0 ? (item as any).prevSales / ((item as any).prevDuration / 60) : 0;
                                const curRate = item.totalDuration > 0 ? item.totalSales / (item.totalDuration / 60) : 0;
                                const growth = prevRate > 0 ? Math.round(((curRate - prevRate) / prevRate) * 100) : (curRate > 0 ? 100 : 0);
                                return (
                                  <span className={`text-xs ${growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {growth >= 0 ? '+' : ''}{growth}%
                                  </span>
                                );
                              })()}
                            </div>
                            <span className="text-xs text-white/40">{tr.prevMonth}: {formatHourlyRate((item as any).prevSales || 0, (item as any).prevDuration || 0)}</span>
                          </div>
                        </div>
                        {/* 月末予測売上（当月のみ表示） */}
                        {(() => {
                          const forecast = calcForecast(item.totalSales, (item as any).prevSales || 0, (item as any).totalDuration || 0);
                          if (!forecast) return null;
                          return (
                            <div className="mt-2 p-2 rounded-lg bg-gradient-to-r from-emerald-900/30 to-cyan-900/20 border border-emerald-500/20">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-emerald-300/80">{tr.forecast}</span>
                                <span className="text-[10px] text-white/40">{tr.monthProgress}: {forecast.progress}%</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-emerald-400">{formatCurrency(forecast.base)}</span>
                                <span className="text-[10px] text-white/30">→</span>
                                <span className="text-sm font-bold text-amber-400">{tr.forecastOptimistic} {formatCurrency(forecast.optimistic)}</span>
                              </div>
                              {forecast.alreadyExceeded ? (
                                <div className="mt-1.5 pt-1.5 border-t border-emerald-500/10">
                                  <div className="text-[10px] text-emerald-300/90 font-medium">{(tr as any).alreadyExceeded}</div>
                                  {forecast.perSessionTarget > 0 && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <span className="text-[10px] text-amber-300/70">💰 {(tr as any).perSessionBest}:</span>
                                      <span className="text-xs font-bold text-amber-400">{formatCurrency(forecast.perSessionTarget)}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1.5 pt-1.5 border-t border-emerald-500/10">
                                  {forecast.remainingSales > 0 && (
                                    <div className="text-[10px] text-cyan-300/80">
                                      ⏰ {(tr as any).remainingTarget} <span className="font-bold text-cyan-300">{formatCurrency(forecast.remainingSales)}</span>
                                    </div>
                                  )}
                                  {forecast.dailyHours > 0 && forecast.remainingDays > 0 && (
                                    <div className="mt-0.5 text-[10px] text-blue-300/70">
                                      📅 {((tr as any).dailyGuide as string).replace('{days}', String(forecast.remainingDays)).replace('{hours}', String(forecast.dailyHours))}
                                    </div>
                                  )}
                                  {forecast.perSessionTarget > 0 && (
                                    <div className="mt-0.5 flex items-center gap-1">
                                      <span className="text-[10px] text-amber-300/70">💰 {(tr as any).perSession}:</span>
                                      <span className="text-xs font-bold text-amber-400">{formatCurrency(forecast.perSessionTarget)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* Cumulative Sales */}
                        {(item as any).cumulativeSales > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-white/5">
                            <span className="text-xs text-white/50">{tr.cumulative}: </span>
                            <span className="text-xs text-yellow-300/70 font-medium">{formatCurrency((item as any).cumulativeSales)}</span>
                            <span className="text-xs text-white/30 ml-2">{formatDuration((item as any).cumulativeDuration || 0)}h</span>
                          </div>
                        )}
                        {/* Daily Sales Mini Chart */}
                        {item.liverId && allLiverDailySales && (allLiverDailySales as any)[item.liverId] && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-[10px] text-white/40 mb-1">📊 今月の日別売上</p>
                            <div className="flex items-end gap-[2px] h-8">
                              {(() => {
                                const dailyData = (allLiverDailySales as any)[item.liverId!] as { date: string; sales: number }[];
                                const maxSales = Math.max(...dailyData.map(d => d.sales), 1);
                                const [year, mon] = selectedMonth.split('-').map(Number);
                                const daysInMonth = new Date(year, mon, 0).getDate();
                                const salesByDay: Record<string, number> = {};
                                dailyData.forEach(d => { salesByDay[d.date] = d.sales; });
                                return Array.from({ length: daysInMonth }, (_, i) => {
                                  const day = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
                                  const sales = salesByDay[day] || 0;
                                  const height = sales > 0 ? Math.max(2, (sales / maxSales) * 28) : 0;
                                  return (
                                    <div
                                      key={day}
                                      className={`flex-1 rounded-sm ${sales > 0 ? 'bg-yellow-400/80' : 'bg-gray-700/30'}`}
                                      style={{ height: `${height}px`, minWidth: '2px' }}
                                      title={`${i + 1}日: \u00a5${sales.toLocaleString()}`}
                                    />
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                        {/* Brand Duration Breakdown */}
                        {item.liverId && allLiverBrandDurations && (allLiverBrandDurations as any)[item.liverId] && (allLiverBrandDurations as any)[item.liverId].length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-[10px] text-white/40 mb-1">🏷️ 今月のブランド別配信時間</p>
                            <div className="flex flex-wrap gap-1">
                              {((allLiverBrandDurations as any)[item.liverId!] as { brandId: number; brandName: string; durationMinutes: number }[]).map(brand => (
                                <span
                                  key={brand.brandId}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-900/40 border border-indigo-500/20 text-[10px]"
                                >
                                  <span className="text-indigo-300">{brand.brandNameJa || brand.brandName}{brand.brandNameJa && brand.brandNameJa !== brand.brandName && <span className="text-indigo-300/50 ml-0.5">({brand.brandName})</span>}</span>
                                  <span className="text-white/60 font-medium">{brand.durationMinutes >= 60 ? `${Math.floor(brand.durationMinutes / 60)}h${brand.durationMinutes % 60 > 0 ? `${brand.durationMinutes % 60}m` : ''}` : `${brand.durationMinutes}m`}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Brand Efficiency Badges (ブランド別時間単価バッジ) */}
                        {item.liverId && allLiverBrandEfficiency && (allLiverBrandEfficiency as any)[item.liverId] && (allLiverBrandEfficiency as any)[item.liverId].length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-[10px] text-white/40 mb-1">💰 ブランド別時間単価</p>
                            <div className="flex flex-wrap gap-1">
                              {((allLiverBrandEfficiency as any)[item.liverId!] as { brandId: number; brandName: string; totalHours: number; csvGmv: number; hourlyRate: number }[])
                                .filter((b: any) => b.totalHours > 0 && b.csvGmv > 0)
                                .slice(0, 5)
                                .map((brand: any) => {
                                  const isHigh = brand.hourlyRate >= 50000;
                                  const isLow = brand.hourlyRate > 0 && brand.hourlyRate < 15000;
                                  const icon = isHigh ? '🔥' : isLow ? '⚠️' : '';
                                  const bgClass = isHigh 
                                    ? 'bg-orange-900/40 border-orange-500/30' 
                                    : isLow 
                                      ? 'bg-red-900/30 border-red-500/20' 
                                      : 'bg-emerald-900/30 border-emerald-500/20';
                                  const textClass = isHigh 
                                    ? 'text-orange-300' 
                                    : isLow 
                                      ? 'text-red-300' 
                                      : 'text-emerald-300';
                                  return (
                                    <span
                                      key={brand.brandId}
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${bgClass}`}
                                      title={`${brand.brandNameJa || brand.brandName}${brand.brandNameJa && brand.brandNameJa !== brand.brandName ? ` (${brand.brandName})` : ''}: ¥${brand.hourlyRate.toLocaleString()}/h (売上¥${brand.csvGmv.toLocaleString()} / ${brand.totalHours}h)`}
                                    >
                                      {icon && <span>{icon}</span>}
                                      <span className={textClass}>{brand.brandNameJa || brand.brandName}</span>
                                      <span className="text-white/70 font-bold">¥{brand.hourlyRate >= 10000 ? `${Math.round(brand.hourlyRate / 10000)}万` : brand.hourlyRate.toLocaleString()}/h</span>
                                    </span>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-white text-center py-4">{tr.noData}</p>
            )}
            
            {rankings?.durationRanking && rankings.durationRanking.length > 5 && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllDuration(!showAllDuration)}
                  className="border-gray-700 text-white hover:bg-gray-800"
                >
                  {showAllDuration ? (
                    <>
                      {tr.viewLess} <ChevronUp className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      {tr.viewMore} <ChevronDown className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Referral Ranking */}
        {referralRanking && referralRanking.length > 0 && (
          <Card className="bg-gray-900/80 border-gray-700">
            <CardContent className="p-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                <Megaphone className="w-5 h-5 text-purple-500" />
                紹介ランキング
              </h2>
              
              <div className="space-y-3">
                {referralRankingToShow?.map((item, index) => (
                  <div
                    key={item.liverName || index}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    {getRankIcon(index + 1)}
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={item.liverAvatarUrl || undefined} />
                      <AvatarFallback className="bg-purple-900 text-white">
                        {item.liverName?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-white">{item.liverName || "不明"}</p>
                      <div className="flex items-center gap-4 text-sm mt-1">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-purple-400 font-bold">{item.totalReferrals}人</span>
                          <span className="text-xs text-white">紹介</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Gift className="w-3.5 h-3.5 text-pink-400" />
                          <span className="text-pink-400">{item.totalPointsEarned.toLocaleString()}pt</span>
                          <span className="text-xs text-white">獲得</span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 bg-purple-500/20 rounded mt-2">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded"
                          style={{
                            width: `${Math.min(100, (item.totalReferrals / (referralRanking?.[0]?.totalReferrals || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {referralRanking.length > 5 && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllReferral(!showAllReferral)}
                    className="border-gray-700 text-white hover:bg-gray-800"
                  >
                    {showAllReferral ? (
                      <>閉じる <ChevronUp className="w-4 h-4 ml-1" /></>
                    ) : (
                      <>VIEW MORE <ChevronDown className="w-4 h-4 ml-1" /></>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 重点商品ノルマ達成率ランキング */}
        <FeaturedProductRankingSection />
        
        {/* 目標設定状況一覧 */}
        <GoalStatusSection selectedMonth={selectedMonth} agencyId={agencyId} />


        {/* ブランド効率アラート・レコメンデーション */}
        {allLiverBrandEfficiency && Object.keys(allLiverBrandEfficiency).length > 0 && (
          <Card className="bg-gray-900/80 border-gray-700">
            <CardContent className="p-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                <Target className="w-5 h-5 text-cyan-500" />
                ブランド配信効率アラート（{monthOptions.find(m => m.value === selectedMonth)?.label}）
              </h2>
              <p className="text-xs text-white/50 mb-4">ライバーごとのブランド別時間単価を分析し、最適な配信ブランド配分を提案します。🔥=高効率（¥5万+/h） ⚠️=低効率（¥1.5万未満/h）</p>
              
              {(() => {
                // Collect all brand-liver efficiency data
                type EffEntry = { liverId: number; liverName: string; brandName: string; hourlyRate: number; totalHours: number; csvGmv: number };
                const allEntries: EffEntry[] = [];
                const effData = allLiverBrandEfficiency as Record<number, { brandId: number; brandName: string; totalHours: number; csvGmv: number; hourlyRate: number }[]>;
                
                for (const [liverIdStr, brands] of Object.entries(effData)) {
                  const liverId = Number(liverIdStr);
                  const liverInfo = rankings?.salesRanking?.find(r => r.liverId === liverId) || rankings?.durationRanking?.find(r => r.liverId === liverId);
                  const liverName = (liverInfo as any)?.liverName || (liverInfo as any)?.streamerName || `Liver ${liverId}`;
                  for (const brand of brands) {
                    if (brand.totalHours > 0 && brand.csvGmv > 0) {
                      allEntries.push({ liverId, liverName, brandName: brand.brandName, hourlyRate: brand.hourlyRate, totalHours: brand.totalHours, csvGmv: brand.csvGmv });
                    }
                  }
                }

                // Sort by hourly rate descending
                allEntries.sort((a, b) => b.hourlyRate - a.hourlyRate);
                
                // Top performers (high efficiency)
                const topPerformers = allEntries.filter(e => e.hourlyRate >= 50000).slice(0, 8);
                // Low performers (low efficiency with significant hours)
                const lowPerformers = allEntries.filter(e => e.hourlyRate < 15000 && e.totalHours >= 2).slice(-8).reverse();
                
                // Brand-level aggregation: which brands are most efficient overall
                const brandAgg = new Map<string, { totalGmv: number; totalHours: number; liverCount: number }>();
                for (const entry of allEntries) {
                  const existing = brandAgg.get(entry.brandName);
                  if (existing) {
                    existing.totalGmv += entry.csvGmv;
                    existing.totalHours += entry.totalHours;
                    existing.liverCount += 1;
                  } else {
                    brandAgg.set(entry.brandName, { totalGmv: entry.csvGmv, totalHours: entry.totalHours, liverCount: 1 });
                  }
                }
                const brandRanking = Array.from(brandAgg.entries())
                  .map(([name, data]) => ({ name, avgRate: Math.round(data.totalGmv / data.totalHours), ...data }))
                  .sort((a, b) => b.avgRate - a.avgRate);

                // Recommendations: who should do more of which brand
                const recommendations: { liverName: string; currentBrand: string; currentRate: number; suggestedBrand: string; suggestedRate: number }[] = [];
                for (const entry of lowPerformers) {
                  // Find a brand that this liver is good at (or that is generally high-efficiency)
                  const liverBrands = allEntries.filter(e => e.liverId === entry.liverId && e.hourlyRate > entry.hourlyRate);
                  const bestBrand = liverBrands[0] || (brandRanking.length > 0 ? { brandName: brandRanking[0].name, hourlyRate: brandRanking[0].avgRate } : null);
                  if (bestBrand && (bestBrand as any).hourlyRate > entry.hourlyRate * 1.5) {
                    recommendations.push({
                      liverName: entry.liverName,
                      currentBrand: entry.brandName,
                      currentRate: entry.hourlyRate,
                      suggestedBrand: (bestBrand as any).brandName,
                      suggestedRate: (bestBrand as any).hourlyRate,
                    });
                  }
                }

                return (
                  <div className="space-y-4">
                    {/* Brand Overall Ranking */}
                    {brandRanking.length > 0 && (
                      <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/20">
                        <p className="text-xs font-bold text-cyan-300 mb-2">📊 ブランド別平均時間単価ランキング</p>
                        <div className="flex flex-wrap gap-2">
                          {brandRanking.slice(0, 8).map((brand, idx) => (
                            <div key={brand.name} className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/60 border border-gray-600/30">
                              <span className="text-xs font-bold text-yellow-400">#{idx + 1}</span>
                              <span className="text-xs text-white">{brand.name}</span>
                              <span className="text-xs font-bold text-cyan-300">¥{brand.avgRate >= 10000 ? `${Math.round(brand.avgRate / 10000)}万` : brand.avgRate.toLocaleString()}/h</span>
                              <span className="text-[10px] text-white/40">({brand.liverCount}名)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Performers */}
                    {topPerformers.length > 0 && (
                      <div className="p-3 rounded-lg bg-gradient-to-r from-orange-900/20 to-amber-900/20 border border-orange-500/20">
                        <p className="text-xs font-bold text-orange-300 mb-2">🔥 高効率配信（¥5万+/h）— このブランドをもっと振るべき</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {topPerformers.map((entry, idx) => (
                            <div key={`${entry.liverId}-${entry.brandName}-${idx}`} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800/40">
                              <span className="text-xs text-white font-medium truncate max-w-[80px]">{entry.liverName}</span>
                              <span className="text-[10px] text-orange-300">×</span>
                              <span className="text-xs text-orange-200 font-medium">{entry.brandName}</span>
                              <span className="text-xs font-bold text-orange-400 ml-auto">¥{Math.round(entry.hourlyRate / 10000)}万/h</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Low Performers */}
                    {lowPerformers.length > 0 && (
                      <div className="p-3 rounded-lg bg-gradient-to-r from-red-900/20 to-pink-900/20 border border-red-500/20">
                        <p className="text-xs font-bold text-red-300 mb-2">⚠️ 低効率配信（¥1.5万未満/h）— 配信ブランド見直し推奨</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {lowPerformers.map((entry, idx) => (
                            <div key={`${entry.liverId}-${entry.brandName}-${idx}`} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800/40">
                              <span className="text-xs text-white font-medium truncate max-w-[80px]">{entry.liverName}</span>
                              <span className="text-[10px] text-red-300">×</span>
                              <span className="text-xs text-red-200 font-medium">{entry.brandName}</span>
                              <span className="text-xs font-bold text-red-400 ml-auto">¥{entry.hourlyRate.toLocaleString()}/h</span>
                              <span className="text-[10px] text-white/30">({entry.totalHours}h)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {recommendations.length > 0 && (
                      <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-900/20 to-teal-900/20 border border-emerald-500/20">
                        <p className="text-xs font-bold text-emerald-300 mb-2">💡 レコメンデーション — 配信ブランド変更提案</p>
                        <div className="space-y-2">
                          {recommendations.slice(0, 5).map((rec, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800/40 text-xs">
                              <span className="text-white font-medium truncate max-w-[80px]">{rec.liverName}</span>
                              <span className="text-red-300 line-through">{rec.currentBrand}</span>
                              <span className="text-red-400 text-[10px]">¥{rec.currentRate.toLocaleString()}/h</span>
                              <span className="text-white/50">→</span>
                              <span className="text-emerald-300 font-bold">{rec.suggestedBrand}</span>
                              <span className="text-emerald-400 text-[10px]">¥{rec.suggestedRate >= 10000 ? `${Math.round(rec.suggestedRate / 10000)}万` : rec.suggestedRate.toLocaleString()}/h</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
        {/* セット一覧（全ライバー） */}
        {allSetsData && allSetsData.sets.length > 0 && (
          <Card className="bg-gray-900/80 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                  <Package className="w-5 h-5 text-pink-400" />
                  セット活用情報
                  <span className="text-sm font-normal text-pink-300 ml-2">{allSetsData.summary.totalSets}セット</span>
                </h2>
              </div>
              
              {/* ライバー別セット件数 */}
              {(() => {
                const liverCounts: Record<string, { count: number; revenue: number }> = {};
                allSetsData.sets.forEach((s: any) => {
                  const name = s.streamerName || '不明';
                  if (!liverCounts[name]) liverCounts[name] = { count: 0, revenue: 0 };
                  liverCounts[name].count += 1;
                  liverCounts[name].revenue += (s.totalRevenue || 0);
                });
                const sorted = Object.entries(liverCounts).sort((a, b) => b[1].count - a[1].count);
                return sorted.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {sorted.map(([name, data]) => (
                      <span key={name} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-xs">
                        <span className="text-purple-200 font-medium">{name}</span>
                        <span className="text-purple-400 font-bold">{data.count}件</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-yellow-400">{formatCurrency(data.revenue)}</span>
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* サマリーカード */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg border border-gray-700 text-center">
                  <p className="text-xs text-gray-400">セット数</p>
                  <p className="text-lg font-bold text-cyan-400">{allSetsData.summary.totalSets}個</p>
                </div>
                <div className="p-3 rounded-lg border border-gray-700 text-center">
                  <p className="text-xs text-gray-400">セット売上</p>
                  <p className="text-lg font-bold text-yellow-400">{formatCurrency(allSetsData.summary.totalRevenue)}</p>
                </div>
                <div className="p-3 rounded-lg border border-gray-700 text-center">
                  <p className="text-xs text-gray-400">販売数</p>
                  <p className="text-lg font-bold text-green-400">{allSetsData.summary.totalQuantitySold}個</p>
                </div>
                <div className="p-3 rounded-lg border border-gray-700 text-center">
                  <p className="text-xs text-gray-400">平均割引率</p>
                  <p className="text-lg font-bold text-pink-400">{allSetsData.summary.avgDiscountRate}%OFF</p>
                </div>
              </div>

              {/* 並び替え */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400">並び替え:</span>
                <button
                  onClick={() => setSetSortOrder('date')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    setSortOrder === 'date' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  新着順
                </button>
                <button
                  onClick={() => setSetSortOrder('revenue')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    setSortOrder === 'revenue' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  売上順
                </button>
              </div>

              {/* セットリスト */}
              <div className="space-y-2">
                {(() => {
                  const sortedSets = [...allSetsData.sets].sort((a, b) => {
                    if (setSortOrder === 'revenue') return (b.totalRevenue || 0) - (a.totalRevenue || 0);
                    // date sort: newest first
                    const dateA = a.livestreamDate ? new Date(a.livestreamDate).getTime() : 0;
                    const dateB = b.livestreamDate ? new Date(b.livestreamDate).getTime() : 0;
                    return dateB - dateA;
                  });
                  const setsToShow = showAllSets ? sortedSets : sortedSets.slice(0, 10);
                  const bestSetId = allSetsData.summary.bestSetId;
                  return setsToShow.map((set, idx) => (
                    <div key={set.id} className="p-3 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <Package className="w-4 h-4 text-pink-400 shrink-0" />
                          <span className="text-white font-semibold text-sm truncate">{set.setName}</span>
                          {set.discountRate != null && set.discountRate > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 text-[10px] font-bold whitespace-nowrap">
                              {set.discountRate}%OFF
                            </span>
                          )}
                          {set.id === bestSetId && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 text-[10px] font-bold whitespace-nowrap">
                              <Star className="w-3 h-3" />最高売上
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 whitespace-nowrap">
                          {set.livestreamDate ? new Date(set.livestreamDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }) : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs flex-wrap">
                        <span className="text-gray-400">{set.streamerName}</span>
                        <span>
                          <span className="text-gray-500">売値: </span>
                          <span className="text-yellow-400 font-medium">{formatCurrency(set.setPrice)}</span>
                        </span>
                        <span>
                          <span className="text-gray-500">販売数: </span>
                          <span className="text-green-400 font-medium">{set.quantitySold}セット</span>
                        </span>
                        <span>
                          <span className="text-gray-500">売上: </span>
                          <span className="text-cyan-400 font-medium">{formatCurrency(set.totalRevenue)}</span>
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* VIEW MORE */}
              {allSetsData.sets.length > 10 && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllSets(!showAllSets)}
                    className="border-gray-700 text-white hover:bg-gray-800"
                  >
                    {showAllSets ? (
                      <>閉じる <ChevronUp className="w-4 h-4 ml-1" /></>
                    ) : (
                      <>VIEW MORE ({allSetsData.sets.length}件) <ChevronDown className="w-4 h-4 ml-1" /></>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* All Livers List */}
        <Card className="bg-gray-900/80 border-gray-700">
          <CardContent className="p-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-green-500" />
              {tr.liverList}
            </h2>
            
            {livers && livers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {livers.map((liver) => (
                  <Link key={liver.id} href={`/livers/${liver.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer border border-gray-800">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={liver.avatarUrl || undefined} />
                        <AvatarFallback className="bg-gray-700 text-white" style={{ backgroundColor: liver.color || undefined }}>
                          {liver.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate text-white">{liver.name}</p>
                          {(liver as any).totalSets > 0 && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/40 rounded text-[10px] text-purple-300 whitespace-nowrap">
                              <Package className="w-3 h-3" />
                              {(liver as any).totalSets}セット
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white">
                          {liver.livestreamCount > 0 ? `${liver.livestreamCount}回配信` : "配信なし"}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-white text-center py-4">{tr.noData}</p>
            )}
          </CardContent>
        </Card>
        
        {/* Duration Ranking removed from here - moved above after Sales Ranking */}
      </div>
    </div>
  );
}

// 目標設定状況一覧コンポーネント
function GoalStatusSection({ selectedMonth, agencyId }: { selectedMonth: string; agencyId?: number | null }) {
  const { data: goalStatus, isLoading } = trpc.liverManagement.goalStatus.useQuery({
    month: selectedMonth,
  });

  if (isLoading) return null;
  if (!goalStatus || goalStatus.length === 0) return null;

  // Filter by agencyId if needed (goalStatus returns all livers, filter client-side if agency filtering is needed)
  const setCount = goalStatus.filter(l => l.hasGoal).length;
  const notSetCount = goalStatus.filter(l => !l.hasGoal).length;
  const achievedCount = goalStatus.filter(l => l.salesGoalAchieved).length;

  return (
    <Card className="bg-gray-900/80 border-gray-700">
      <CardContent className="p-4">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-white">
          <Target className="w-5 h-5 text-purple-400" />
          目標設定状況（{selectedMonth.replace('-', '年')}月）
        </h2>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{setCount}</div>
            <div className="text-xs text-green-400/70">設定済み</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{notSetCount}</div>
            <div className="text-xs text-red-400/70">未設定</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{achievedCount}</div>
            <div className="text-xs text-yellow-400/70">目標達成</div>
          </div>
        </div>

        {/* Liver list */}
        <div className="space-y-2">
          {/* Not set first, then set */}
          {[...goalStatus]
            .sort((a, b) => {
              // 未設定を先に表示
              if (a.hasGoal !== b.hasGoal) return a.hasGoal ? 1 : -1;
              // 同じステータス内では売上目標の降順
              return (b.salesGoal || 0) - (a.salesGoal || 0);
            })
            .map((liver) => (
              <div
                key={liver.liverId}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  !liver.hasGoal
                    ? 'border-red-500/40 bg-red-500/5'
                    : liver.salesGoalAchieved
                    ? 'border-green-500/40 bg-green-500/5'
                    : 'border-gray-700 bg-gray-800/30'
                }`}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={liver.avatarUrl || undefined} />
                  <AvatarFallback className="bg-gray-700 text-white text-xs">
                    {liver.liverName?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-white truncate">{liver.liverName}</p>
                </div>
                {liver.hasGoal ? (
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p className="text-xs text-white/60">売上目標</p>
                      <p className="text-sm font-bold text-white">¥{Number(liver.salesGoal).toLocaleString()}</p>
                    </div>
                    {liver.salesGoalAchieved ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <Target className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400 font-medium">未設定</span>
                  </div>
                )}
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FeaturedProductRankingSection() {
  const rankingsQuery = trpc.featuredProduct.getRankings.useQuery();
  const [showAll, setShowAll] = useState(false);
  
  if (!rankingsQuery.data || rankingsQuery.data.length === 0) return null;
  
  const dataToShow = showAll ? rankingsQuery.data : rankingsQuery.data.slice(0, 5);
  
  return (
    <Card className="bg-gray-900/80 border-gray-800">
      <CardContent className="p-4">
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-yellow-400" />
          重点商品ノルマ達成率ランキング
        </h3>
        <div className="space-y-2">
          {dataToShow.map((item: any, idx: number) => (
            <div key={item.liverId} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/60">
              <span className={`text-lg font-bold w-8 text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-gray-500'}`}>
                {idx + 1}
              </span>
              {item.avatarUrl ? (
                <img src={item.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-white">
                  {item.liverName?.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white truncate block">{item.liverName}</span>
              </div>
              <div className="text-right flex items-center gap-2">
                <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.achievementRate >= 100 ? 'bg-green-500' : item.achievementRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, item.achievementRate)}%` }}
                  />
                </div>
                <span className={`text-sm font-bold w-12 text-right ${item.achievementRate >= 100 ? 'text-green-400' : item.achievementRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {item.achievementRate}%
                </span>
              </div>
            </div>
          ))}
        </div>
        {rankingsQuery.data.length > 5 && (
          <div className="mt-3 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="border-gray-700 text-white hover:bg-gray-800"
            >
              {showAll ? (
                <>閉じる <ChevronUp className="w-4 h-4 ml-1" /></>
              ) : (
                <>VIEW MORE <ChevronDown className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

