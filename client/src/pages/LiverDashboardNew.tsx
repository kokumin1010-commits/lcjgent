import { useState, useMemo, useEffect, useRef } from "react";
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
import { Crown, Clock, TrendingUp, ChevronDown, ChevronUp, Users, DollarSign, Activity, Zap, ArrowUpRight, ArrowDownRight, Sparkles, Radio, BarChart3, Package, Grid3X3, Brain, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Matrix rain effect component
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops: number[] = [];
    
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }
    
    function draw() {
      if (!ctx || !canvas) return;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#0ff';
      ctx.font = `${fontSize}px monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        
        // Gradient effect - brighter at the bottom
        const alpha = Math.min(1, drops[i] / 30);
        ctx.fillStyle = `rgba(0, 255, 255, ${0.1 + alpha * 0.4})`;
        ctx.fillText(text, x, y);
        
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }
    
    const interval = setInterval(draw, 50);
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none opacity-30"
      style={{ zIndex: 0 }}
    />
  );
}

export default function LiverDashboardNew() {
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
  
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [showAllSales, setShowAllSales] = useState(false);
  const [showAllDuration, setShowAllDuration] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  
  const { data: rankings, isLoading } = trpc.liverManagement.rankings.useQuery({
    month: selectedMonth,
  });
  
  const { data: livers } = trpc.liverManagement.listWithStats.useQuery({
    month: selectedMonth,
  });
  
  // Total LCJ Liver Sales Summary
  const { data: totalSummary } = trpc.liverManagement.totalSalesSummary.useQuery({
    month: selectedMonth,
  });
  
  // Monthly Sales Trend
  const { data: salesTrend } = trpc.liverManagement.monthlySalesTrend.useQuery();
  
  // Product Ranking
  const { data: productRanking } = trpc.liverManagement.getProductRanking.useQuery({
    month: selectedMonth,
    limit: 10,
  });
  
  // Liver x Product Matrix
  const { data: liverProductMatrix } = trpc.liverManagement.getLiverProductMatrix.useQuery({
    month: selectedMonth,
    limit: 10,
  });
  
  // AI Matching Suggestions
  const aiMatchingMutation = trpc.liverManagement.getAiMatchingSuggestions.useMutation({
    onSuccess: (data) => {
      const suggestion = typeof data.suggestion === 'string' ? data.suggestion : '';
      setAiSuggestion(suggestion);
      setShowAiSuggestion(true);
    },
  });
  
  const translations = {
    ja: {
      title: "ライバー司令塔",
      subtitle: "LIVER COMMAND CENTER",
      monthLabel: "月選択",
      totalSales: "トータル売上",
      totalDuration: "総配信時間",
      totalLivestreams: "総配信数",
      activeLivers: "アクティブライバー",
      vsLastMonth: "前月比",
      lcjLiverSummary: "LCJライバー全体実績",
      salesRanking: "月間売上ランキング",
      durationRanking: "累計配信時間ランキング",
      sales: "売上",
      duration: "配信時間",
      viewMore: "VIEW MORE",
      viewLess: "閉じる",
      noData: "データがありません",
      hours: "時間",
      liverList: "ライバー一覧",
      streams: "配信",
      noStreams: "配信なし",
      productRanking: "売れ筋商品ランキング",
      liverProductMatrix: "ライバー×商品マトリックス",
      productName: "商品名",
      totalGmv: "総売上",
      soldCount: "販売数",
      avgPrice: "平均単価",
      liverName: "ライバー名",
      topProduct: "得意商品",
      productGmv: "商品売上",
      aiMatching: "AIマッチング提案",
      aiMatchingDesc: "過去の実績から最適なライバー×商品の組み合わせをAIが提案",
      generateSuggestion: "AI提案を生成",
      generating: "生成中...",
      suggestionResult: "AI提案結果",
    },
    zh: {
      title: "主播指挥中心",
      subtitle: "LIVER COMMAND CENTER",
      monthLabel: "选择月份",
      totalSales: "总销售额",
      totalDuration: "总直播时长",
      totalLivestreams: "总直播数",
      activeLivers: "活跃主播",
      vsLastMonth: "环比",
      lcjLiverSummary: "LCJ主播整体业绩",
      salesRanking: "月间销售排行榜",
      durationRanking: "累计直播时长排行榜",
      sales: "销售额",
      duration: "直播时长",
      viewMore: "查看更多",
      viewLess: "收起",
      noData: "暂无数据",
      hours: "小时",
      liverList: "主播一览",
      streams: "直播",
      noStreams: "无直播",
      productRanking: "热销商品排行榜",
      liverProductMatrix: "主播×商品矩阵",
      productName: "商品名",
      totalGmv: "总销售额",
      soldCount: "销量",
      avgPrice: "平均单价",
      liverName: "主播名",
      topProduct: "擅长商品",
      productGmv: "商品销售额",
      aiMatching: "AI匹配提案",
      aiMatchingDesc: "根据过往业绩，AI推荐最佳主播×商品组合",
      generateSuggestion: "生成AI提案",
      generating: "生成中...",
      suggestionResult: "AI提案结果",
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };
  
  const formatDuration = (minutes: number) => {
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
  };
  
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />;
    if (rank === 2) return <Crown className="w-6 h-6 text-gray-300 drop-shadow-[0_0_6px_rgba(209,213,219,0.6)]" />;
    if (rank === 3) return <Crown className="w-6 h-6 text-amber-600 drop-shadow-[0_0_6px_rgba(217,119,6,0.6)]" />;
    return <span className="w-6 h-6 flex items-center justify-center text-lg font-bold text-cyan-400">{rank}</span>;
  };
  
  const salesRankingToShow = showAllSales 
    ? rankings?.salesRanking 
    : rankings?.salesRanking?.slice(0, 5);
    
  const durationRankingToShow = showAllDuration 
    ? rankings?.durationRanking 
    : rankings?.durationRanking?.slice(0, 5);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white p-6 relative overflow-hidden">
        <MatrixRain />
        <div className="max-w-6xl mx-auto space-y-6 relative z-10">
          <Skeleton className="h-10 w-48 bg-cyan-900/30" />
          <Skeleton className="h-64 w-full bg-cyan-900/30" />
          <Skeleton className="h-64 w-full bg-cyan-900/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white relative overflow-hidden">
      {/* Matrix Rain Background */}
      <MatrixRain />
      
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-cyan-900/10 via-transparent to-blue-900/20 pointer-events-none" style={{ zIndex: 1 }} />
      
      {/* Cyan top border with glow */}
      <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.5)]" style={{ zIndex: 10 }} />
      
      <div className="max-w-6xl mx-auto p-6 space-y-8 relative" style={{ zIndex: 10 }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
              <Radio className="w-8 h-8 text-cyan-400 animate-pulse" />
              {tr.title}
            </h1>
            <p className="text-cyan-500/60 text-sm tracking-[0.3em] mt-1">{tr.subtitle}</p>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44 bg-cyan-900/20 border-cyan-500/30 text-cyan-100 hover:border-cyan-400/50 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a1a2a] border-cyan-500/30">
              {monthOptions.map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  className="text-cyan-100 hover:bg-cyan-900/30 focus:bg-cyan-900/30"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* LCJ Liver Total Summary - Cyberpunk Style */}
        {totalSummary && (
          <Card className="bg-gradient-to-br from-[#0a1a2a]/90 to-[#0a2a3a]/90 border-cyan-500/30 backdrop-blur-sm shadow-[0_0_30px_rgba(0,255,255,0.1)]">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-cyan-100">
                <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {tr.lcjLiverSummary}
                </span>
                <span className="text-cyan-500/60 text-sm">（{monthOptions.find(m => m.value === selectedMonth)?.label}）</span>
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Sales */}
                <div className="bg-[#0a1520]/60 rounded-xl p-4 border border-yellow-500/20 hover:border-yellow-400/40 transition-all hover:shadow-[0_0_20px_rgba(250,204,21,0.15)]">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-yellow-400" />
                    <span className="text-cyan-300/70 text-sm">{tr.totalSales}</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                    ¥{totalSummary.totalSales.toLocaleString()}
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${totalSummary.salesGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalSummary.salesGrowth >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span className="font-mono">{totalSummary.salesGrowth >= 0 ? '+' : ''}{totalSummary.salesGrowth}%</span>
                    <span className="text-cyan-500/50">{tr.vsLastMonth}</span>
                  </div>
                </div>
                
                {/* Total Duration */}
                <div className="bg-[#0a1520]/60 rounded-xl p-4 border border-cyan-500/20 hover:border-cyan-400/40 transition-all hover:shadow-[0_0_20px_rgba(0,255,255,0.15)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    <span className="text-cyan-300/70 text-sm">{tr.totalDuration}</span>
                  </div>
                  <p className="text-2xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                    {(totalSummary.totalDuration / 60).toFixed(1)}h
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${totalSummary.durationGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalSummary.durationGrowth >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span className="font-mono">{totalSummary.durationGrowth >= 0 ? '+' : ''}{totalSummary.durationGrowth}%</span>
                    <span className="text-cyan-500/50">{tr.vsLastMonth}</span>
                  </div>
                </div>
                
                {/* Total Livestreams */}
                <div className="bg-[#0a1520]/60 rounded-xl p-4 border border-emerald-500/20 hover:border-emerald-400/40 transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <span className="text-cyan-300/70 text-sm">{tr.totalLivestreams}</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                    {totalSummary.totalLivestreams}回
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${totalSummary.livestreamGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalSummary.livestreamGrowth >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span className="font-mono">{totalSummary.livestreamGrowth >= 0 ? '+' : ''}{totalSummary.livestreamGrowth}%</span>
                    <span className="text-cyan-500/50">{tr.vsLastMonth}</span>
                  </div>
                </div>
                
                {/* Active Livers */}
                <div className="bg-[#0a1520]/60 rounded-xl p-4 border border-purple-500/20 hover:border-purple-400/40 transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    <span className="text-cyan-300/70 text-sm">{tr.activeLivers}</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                    {totalSummary.activeLivers}人
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-sm text-cyan-500/50">
                    <span>前月: {totalSummary.prevActiveLivers}人</span>
                  </div>
                </div>
              </div>
              
              {/* Monthly Trend Chart */}
              {salesTrend && salesTrend.length > 0 && (
                <div className="mt-6 pt-4 border-t border-cyan-500/20">
                  <h3 className="text-sm text-cyan-400/70 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    売上推移（過去6ヶ月）
                  </h3>
                  <div className="flex items-end gap-3 h-40">
                    {salesTrend.map((month, index) => {
                      const maxSales = Math.max(...salesTrend.map(m => m.totalSales));
                      const heightPercent = maxSales > 0 ? (month.totalSales / maxSales) * 100 : 0;
                      const displayHeight = Math.max(heightPercent, 5);
                      return (
                        <div key={month.month} className="flex-1 flex flex-col items-center gap-2 group">
                          <div className="relative w-full flex flex-col items-center" style={{ height: '120px' }}>
                            {/* Sales value tooltip */}
                            <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-yellow-400 font-mono whitespace-nowrap">
                              ¥{(month.totalSales / 1000000).toFixed(1)}M
                            </div>
                            {/* Bar */}
                            <div className="w-full flex-1 flex items-end">
                              <div 
                                className="w-full bg-gradient-to-t from-cyan-600 via-cyan-400 to-cyan-300 rounded-t shadow-[0_0_15px_rgba(0,255,255,0.4)] transition-all duration-300 group-hover:shadow-[0_0_25px_rgba(0,255,255,0.6)] group-hover:from-cyan-500 group-hover:to-cyan-200"
                                style={{ height: `${displayHeight}%`, minHeight: '8px' }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-cyan-500/70 font-mono">{month.label}</span>
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
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-yellow-400" />
              <span className="text-cyan-100">{tr.salesRanking}</span>
              <span className="text-cyan-500/50 text-sm">（{monthOptions.find(m => m.value === selectedMonth)?.label}）</span>
            </h2>
            
            {salesRankingToShow && salesRankingToShow.length > 0 ? (
              <div className="space-y-3">
                {salesRankingToShow.map((item, index) => (
                  <Link 
                    key={item.liverId || item.streamerName || index} 
                    href={`/master/livers-dashboard/${item.liverId || 0}`}
                  >
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0a1520]/40 border border-cyan-500/10 hover:border-cyan-400/30 hover:bg-[#0a1520]/60 transition-all cursor-pointer group">
                      <div className="w-10 flex justify-center">
                        {getRankIcon(index + 1)}
                      </div>
                      <Avatar className="w-14 h-14 ring-2 ring-cyan-500/30 group-hover:ring-cyan-400/50 transition-all">
                        <AvatarImage src={livers?.find(l => l.id === item.liverId)?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-cyan-900 to-blue-900 text-cyan-100 text-lg">
                          {(livers?.find(l => l.id === item.liverId)?.name || item.streamerName)?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-cyan-100 group-hover:text-cyan-50 transition-colors">{livers?.find(l => l.id === item.liverId)?.name || item.streamerName || "不明"}</p>
                        <div className="flex items-center gap-6 mt-2">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-yellow-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">
                                {formatCurrency(item.totalSales)}
                              </span>
                              <span className="text-xs text-cyan-500/50">{tr.sales}</span>
                            </div>
                            <div className="h-1.5 bg-yellow-500/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)]" 
                                style={{ 
                                  width: `${Math.min(100, (item.totalSales / (rankings?.salesRanking?.[0]?.totalSales || 1)) * 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                          <div className="w-24 text-right">
                            <span className="text-cyan-400 font-mono">
                              {formatDuration(item.totalDuration)}
                            </span>
                            <p className="text-xs text-cyan-500/50">{tr.duration}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-cyan-500/50 text-center py-8">{tr.noData}</p>
            )}
            
            {rankings?.salesRanking && rankings.salesRanking.length > 5 && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllSales(!showAllSales)}
                  className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/30 hover:border-cyan-400/50"
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

        {/* Product Ranking */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
              <Package className="w-6 h-6 text-emerald-400" />
              <span className="text-cyan-100">{tr.productRanking}</span>
              <span className="text-cyan-500/50 text-sm">TOP10（{monthOptions.find(m => m.value === selectedMonth)?.label}）</span>
            </h2>
            
            {productRanking && productRanking.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-cyan-500/20">
                      <th className="text-left py-3 px-2 text-cyan-400 text-sm font-medium">#</th>
                      <th className="text-left py-3 px-2 text-cyan-400 text-sm font-medium">{tr.productName}</th>
                      <th className="text-left py-3 px-2 text-cyan-400 text-sm font-medium">販売ライバー</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">{tr.totalGmv}</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">{tr.soldCount}</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">{tr.avgPrice}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRanking.map((product, index) => (
                      <tr 
                        key={product.productName} 
                        className="border-b border-cyan-500/10 hover:bg-cyan-900/20 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <span className={`font-bold ${
                            index === 0 ? 'text-yellow-400' : 
                            index === 1 ? 'text-gray-300' : 
                            index === 2 ? 'text-amber-600' : 'text-cyan-400'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-cyan-100 font-medium max-w-[200px] truncate">
                          {product.productName}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(product as any).sellingLivers?.slice(0, 3).map((liver: { liverId: number; liverName: string; sales: number }, idx: number) => (
                              <span 
                                key={liver.liverId}
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  idx === 0 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                    : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                                }`}
                                title={`¥${liver.sales.toLocaleString()}`}
                              >
                                {liver.liverName}
                              </span>
                            ))}
                            {(product as any).sellingLivers?.length > 3 && (
                              <span className="text-xs text-cyan-500/50">+{(product as any).sellingLivers.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-emerald-400 font-mono font-bold">
                            {formatCurrency(product.totalGmv)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-cyan-300">
                          {product.soldCount.toLocaleString()}個
                        </td>
                        <td className="py-3 px-2 text-right text-cyan-400">
                          {formatCurrency(Math.round(product.avgPrice))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-cyan-500/50 text-center py-8">{tr.noData}</p>
            )}
          </CardContent>
        </Card>

        {/* Liver x Product Matrix */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
              <Grid3X3 className="w-6 h-6 text-purple-400" />
              <span className="text-cyan-100">{tr.liverProductMatrix}</span>
              <span className="text-cyan-500/50 text-sm">（{monthOptions.find(m => m.value === selectedMonth)?.label}）</span>
            </h2>
            
            {liverProductMatrix && liverProductMatrix.matrix && liverProductMatrix.matrix.length > 0 ? (
              <div className="space-y-4">
                {liverProductMatrix.matrix.map((liver, index) => (
                  <div 
                    key={liver.liverName}
                    className="p-4 rounded-xl bg-[#0a1520]/40 border border-cyan-500/10 hover:border-cyan-400/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-lg ${
                          index === 0 ? 'text-yellow-400' : 
                          index === 1 ? 'text-gray-300' : 
                          index === 2 ? 'text-amber-600' : 'text-cyan-400'
                        }`}>
                          #{index + 1}
                        </span>
                        <span className="text-cyan-100 font-semibold">{liver.liverName}</span>
                      </div>
                      <span className="text-emerald-400 font-mono font-bold">
                        {formatCurrency(liver.totalGmv)}
                      </span>
                    </div>
                    
                    {/* Top Products for this Liver */}
                    <div className="flex flex-wrap gap-2">
                      {liver.products
                        .filter((p) => p.gmv > 0)
                        .slice(0, 5)
                        .map((product, pIndex) => (
                          <div 
                            key={product.productName}
                            className={`px-3 py-1.5 rounded-lg text-sm ${
                              pIndex === 0 
                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' 
                                : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300'
                            }`}
                          >
                            <span className="font-medium">{product.productName}</span>
                            <span className="ml-2 text-xs opacity-70">
                              {formatCurrency(product.gmv)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-cyan-500/50 text-center py-8">{tr.noData}</p>
            )}
          </CardContent>
        </Card>
        
        {/* AI Matching Suggestions */}
        <Card className="bg-[#0a1a2a]/80 border-purple-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-purple-400" />
                <div>
                  <h2 className="text-lg font-bold text-cyan-100">{tr.aiMatching}</h2>
                  <p className="text-sm text-cyan-500/50">{tr.aiMatchingDesc}</p>
                </div>
              </div>
              <Button
                onClick={() => aiMatchingMutation.mutate({ month: selectedMonth, language: language as "ja" | "zh" })}
                disabled={aiMatchingMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
              >
                {aiMatchingMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {tr.generating}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {tr.generateSuggestion}
                  </>
                )}
              </Button>
            </div>
            
            {showAiSuggestion && aiSuggestion && (
              <div className="mt-4 p-4 rounded-xl bg-[#0a1520]/60 border border-purple-500/20">
                <h3 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {tr.suggestionResult}
                </h3>
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-cyan-100/90 whitespace-pre-wrap text-sm leading-relaxed">
                    {aiSuggestion}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* All Livers Grid */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
              <Users className="w-6 h-6 text-purple-400" />
              <span className="text-cyan-100">{tr.liverList}</span>
            </h2>
            
            {livers && livers.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {livers.map((liver) => (
                  <Link key={liver.id} href={`/master/livers-dashboard/${liver.id}`}>
                    <div className="flex flex-col items-center p-4 rounded-xl bg-[#0a1520]/40 border border-cyan-500/10 hover:border-cyan-400/30 hover:bg-[#0a1520]/60 transition-all cursor-pointer group">
                      <Avatar className="w-16 h-16 ring-2 ring-cyan-500/20 group-hover:ring-cyan-400/40 transition-all mb-3">
                        <AvatarImage src={liver.avatarUrl || undefined} />
                        <AvatarFallback 
                          className="bg-gradient-to-br from-cyan-900 to-blue-900 text-cyan-100 text-xl"
                          style={{ backgroundColor: liver.color || undefined }}
                        >
                          {liver.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-medium text-cyan-100 text-center truncate w-full group-hover:text-cyan-50 transition-colors">
                        {liver.name}
                      </p>
                      <p className="text-xs text-cyan-500/50 mt-1">
                        {liver.livestreamCount > 0 ? `${liver.livestreamCount}回${tr.streams}` : tr.noStreams}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-cyan-500/50 text-center py-8">{tr.noData}</p>
            )}
          </CardContent>
        </Card>
        
        {/* Duration Ranking */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
              <Clock className="w-6 h-6 text-cyan-400" />
              <span className="text-cyan-100">{tr.durationRanking}</span>
              <span className="text-cyan-500/50 text-sm">（{monthOptions.find(m => m.value === selectedMonth)?.label}）</span>
            </h2>
            
            {durationRankingToShow && durationRankingToShow.length > 0 ? (
              <div className="space-y-3">
                {durationRankingToShow.map((item, index) => (
                  <Link 
                    key={item.liverId || item.streamerName || index} 
                    href={`/master/livers-dashboard/${item.liverId || 0}`}
                  >
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0a1520]/40 border border-cyan-500/10 hover:border-cyan-400/30 hover:bg-[#0a1520]/60 transition-all cursor-pointer group">
                      <div className="w-10 flex justify-center">
                        {getRankIcon(index + 1)}
                      </div>
                      <Avatar className="w-14 h-14 ring-2 ring-cyan-500/30 group-hover:ring-cyan-400/50 transition-all">
                        <AvatarImage src={livers?.find(l => l.id === item.liverId)?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-cyan-900 to-blue-900 text-cyan-100 text-lg">
                          {(livers?.find(l => l.id === item.liverId)?.name || item.streamerName)?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-cyan-100 group-hover:text-cyan-50 transition-colors">{livers?.find(l => l.id === item.liverId)?.name || item.streamerName || "不明"}</p>
                        <div className="flex items-center gap-6 mt-2">
                          <div className="w-28">
                            <span className="text-yellow-400 font-mono">
                              {formatCurrency(item.totalSales)}
                            </span>
                            <p className="text-xs text-cyan-500/50">{tr.sales}</p>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-cyan-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]">
                                {formatDuration(item.totalDuration)}
                              </span>
                              <span className="text-xs text-cyan-500/50">{tr.duration}</span>
                            </div>
                            <div className="h-1.5 bg-cyan-500/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.5)]" 
                                style={{ 
                                  width: `${Math.min(100, (item.totalDuration / (rankings?.durationRanking?.[0]?.totalDuration || 1)) * 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-cyan-500/50 text-center py-8">{tr.noData}</p>
            )}
            
            {rankings?.durationRanking && rankings.durationRanking.length > 5 && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllDuration(!showAllDuration)}
                  className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/30 hover:border-cyan-400/50"
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
      </div>
    </div>
  );
}
