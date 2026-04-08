import { useState, useMemo } from "react";
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
import { Crown, Clock, TrendingUp, ChevronDown, ChevronUp, Users, DollarSign, Activity, Zap, ArrowUpRight, ArrowDownRight, Megaphone, Gift, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function LiverList() {
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
  
  // Default to previous month since current month often has no data yet
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[1]?.value || monthOptions[0].value);
  const [showAllSales, setShowAllSales] = useState(false);
  const [showAllDuration, setShowAllDuration] = useState(false);
  const [showAllReferral, setShowAllReferral] = useState(false);
  
  const { data: rankings, isLoading } = trpc.liverManagement.rankings.useQuery({
    month: selectedMonth,
  });
  
  const { data: livers } = trpc.liverManagement.listWithStats.useQuery({
    month: selectedMonth,
  });
  
  // Referral Ranking
  const { data: referralRanking } = trpc.referral.ranking.useQuery({ limit: 20 });
  
  const referralRankingToShow = showAllReferral
    ? referralRanking
    : referralRanking?.slice(0, 5);

  // Total LCJ Liver Sales Summary
  const { data: totalSummary } = trpc.liverManagement.totalSalesSummary.useQuery({
    month: selectedMonth,
  });
  
  // Monthly Sales Trend
  const { data: salesTrend } = trpc.liverManagement.monthlySalesTrend.useQuery();
  
  const translations = {
    ja: {
      title: "ライバーリスト",
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
      duration: "累計配信時間",
      viewMore: "VIEW MORE",
      viewLess: "閉じる",
      noData: "データがありません",
      hours: "時間",
      liverList: "ライバー一覧",
    },
    zh: {
      title: "主播列表",
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
      duration: "累计直播时长",
      viewMore: "查看更多",
      viewLess: "收起",
      noData: "暂无数据",
      hours: "小时",
      liverList: "主播一览",
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  const formatCurrency = (amount: number | string) => {
    return `¥${Number(amount).toLocaleString()}`;
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
        
        {/* LCJ Liver Total Summary */}
        {totalSummary && (
          <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500/30">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                <Zap className="w-6 h-6 text-yellow-400" />
                {tr.lcjLiverSummary}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              
              {/* Monthly Trend Mini Chart */}
              {salesTrend && salesTrend.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <h3 className="text-sm text-white/90 mb-3">売上推移（過去6ヶ月）</h3>
                  <div className="flex items-end gap-2 h-16">
                    {salesTrend.map((month, index) => {
                      const maxSales = Math.max(...salesTrend.map(m => m.totalSales));
                      const height = maxSales > 0 ? (month.totalSales / maxSales) * 100 : 0;
                      return (
                        <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className="w-full bg-gradient-to-t from-yellow-500 to-yellow-300 rounded-t"
                            style={{ height: `${Math.max(height, 4)}%` }}
                          />
                          <span className="text-xs text-white/80">{month.label}</span>
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
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
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
                        <div className="flex items-center gap-4 text-sm">
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
                            <span className="text-xs text-white">{tr.sales}</span>
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
                            <span className="text-xs text-white">{tr.duration}</span>
                          </div>
                        </div>
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
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
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
                        <div className="flex items-center gap-4 text-sm">
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
                            <span className="text-xs text-white">{tr.sales}</span>
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
                            <span className="text-xs text-white">{tr.duration}</span>
                          </div>
                        </div>
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
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
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
                      <div className="h-1 bg-purple-500/20 rounded mt-2">
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
        
        {/* All Livers List */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
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
