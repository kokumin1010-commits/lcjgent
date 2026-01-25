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
import { Crown, Clock, TrendingUp, ChevronDown, ChevronUp, Users } from "lucide-react";
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
  
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [showAllSales, setShowAllSales] = useState(false);
  const [showAllDuration, setShowAllDuration] = useState(false);
  
  const { data: rankings, isLoading } = trpc.liverManagement.rankings.useQuery({
    month: selectedMonth,
  });
  
  const { data: livers } = trpc.liverManagement.listWithStats.useQuery({
    month: selectedMonth,
  });
  
  const translations = {
    ja: {
      title: "ライバーリスト",
      monthLabel: "月選択",
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
  
  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };
  
  const formatDuration = (minutes: number) => {
    const hours = (minutes / 60).toFixed(1);
    return `${hours}`;
  };
  
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Crown className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Crown className="w-5 h-5 text-amber-700" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">{rank}</span>;
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
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{monthOptions.find(m => m.value === selectedMonth)?.label}</span>
          <span>{selectedMonth.replace("-", "年")}月▼</span>
        </div>
        
        {/* Sales Ranking */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-500" />
              {tr.salesRanking}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
            </h2>
            
            {salesRankingToShow && salesRankingToShow.length > 0 ? (
              <div className="space-y-3">
                {salesRankingToShow.map((item, index) => (
                  <Link 
                    key={item.liverId || index} 
                    href={item.liverId ? `/livers/${item.liverId}` : "#"}
                  >
                    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer">
                      {getRankIcon(index + 1)}
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={livers?.find(l => l.id === item.liverId)?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-gray-700 text-white">
                          {item.streamerName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{item.streamerName || "不明"}</p>
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
                            <span className="text-xs text-gray-500">{tr.sales}</span>
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
                            <span className="text-xs text-gray-500">{tr.duration}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">{tr.noData}</p>
            )}
            
            {rankings?.salesRanking && rankings.salesRanking.length > 5 && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllSales(!showAllSales)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
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
        
        {/* Duration Ranking */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              {tr.durationRanking}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
            </h2>
            
            {durationRankingToShow && durationRankingToShow.length > 0 ? (
              <div className="space-y-3">
                {durationRankingToShow.map((item, index) => (
                  <Link 
                    key={item.liverId || index} 
                    href={item.liverId ? `/livers/${item.liverId}` : "#"}
                  >
                    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer">
                      {getRankIcon(index + 1)}
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={livers?.find(l => l.id === item.liverId)?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-gray-700 text-white">
                          {item.streamerName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{item.streamerName || "不明"}</p>
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
                            <span className="text-xs text-gray-500">{tr.sales}</span>
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
                            <span className="text-xs text-gray-500">{tr.duration}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">{tr.noData}</p>
            )}
            
            {rankings?.durationRanking && rankings.durationRanking.length > 5 && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllDuration(!showAllDuration)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
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
