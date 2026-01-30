import { useState, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
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
import { ArrowLeft, Edit, Home, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from "lucide-react";
import { SiTiktok, SiInstagram, SiYoutube } from "react-icons/si";
import { Link2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function LiverDetail() {
  const params = useParams<{ id: string }>();
  const liverId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  
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
  
  // Previous month for comparison
  const previousMonth = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  const { data: liver, isLoading: liverLoading } = trpc.liverManagement.getById.useQuery({
    id: liverId,
    month: selectedMonth,
  });
  
  const { data: previousStats } = trpc.liverManagement.getById.useQuery({
    id: liverId,
    month: previousMonth,
  });
  
  const { data: livestreams, isLoading: livestreamsLoading } = trpc.liverManagement.getLivestreams.useQuery({
    liverId,
    month: selectedMonth,
  });
  
  const translations = {
    ja: {
      myPage: "マイページ",
      liverList: "ライバーリスト",
      edit: "編集",
      monthlyPerformance: "月実績",
      selectedMonthPerformance: "選択月実績",
      sales: "売上",
      totalDuration: "累計配信時間",
      deliveryHistory: "配信履歴",
      start: "開始",
      end: "終了",
      duration: "配信時間",
      salesTotal: "売上合計",
      detail: "詳細",
      noHistory: "配信履歴がありません。",
      backToList: "ライバーリストへ戻る",
      viewMore: "VIEW MORE",
      viewLess: "閉じる",
      hours: "時間",
    },
    zh: {
      myPage: "我的主页",
      liverList: "主播列表",
      edit: "编辑",
      monthlyPerformance: "月业绩",
      selectedMonthPerformance: "选择月业绩",
      sales: "销售额",
      totalDuration: "累计直播时长",
      deliveryHistory: "直播记录",
      start: "开始",
      end: "结束",
      duration: "直播时长",
      salesTotal: "销售总额",
      detail: "详情",
      noHistory: "暂无直播记录。",
      backToList: "返回主播列表",
      viewMore: "查看更多",
      viewLess: "收起",
      hours: "小时",
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
  
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day}(${weekday})\n${hours}:${mins}`;
  };
  
  const calculateDurationFromDates = (start: Date | string, end: Date | string | null) => {
    if (!end) return "-";
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diffMinutes = Math.round((endTime - startTime) / (1000 * 60));
    const hours = (diffMinutes / 60).toFixed(1);
    return `${hours}${tr.hours}`;
  };
  
  const livestreamsToShow = showAllHistory 
    ? livestreams 
    : livestreams?.slice(0, 10);

  if (liverLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-gray-800" />
          <Skeleton className="h-32 w-32 rounded-full bg-gray-800 mx-auto" />
          <Skeleton className="h-64 w-full bg-gray-800" />
        </div>
      </div>
    );
  }

  if (!liver) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-500">ライバーが見つかりません</p>
          <Link href="/livers">
            <Button className="mt-4 bg-red-600 hover:bg-red-700">
              {tr.backToList}
            </Button>
          </Link>
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
          <h1 className="text-2xl font-bold">{tr.myPage}</h1>
          <Link href="/livers">
            <Button variant="outline" className="border-red-600 text-red-500 hover:bg-red-600/10">
              {tr.liverList}
            </Button>
          </Link>
        </div>
        
        {/* Red divider */}
        <div className="h-0.5 bg-red-600" />
        
        {/* Profile Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Avatar className="w-32 h-32 border-4 border-gray-700">
              <AvatarImage src={liver.avatarUrl || undefined} />
              <AvatarFallback className="bg-gray-700 text-white text-4xl">
                {liver.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 bg-red-600 rounded-full p-2">
              <Home className="w-4 h-4" />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{liver.name}</h2>
            <Link href={`/livers/${liverId}/edit`}>
              <Edit className="w-4 h-4 text-gray-400 hover:text-white cursor-pointer" />
            </Link>
          </div>
          
          {/* SNS Links */}
          {(liver.tiktokAccount || liver.instagramAccount || liver.youtubeAccount || liver.otherAccount) && (
            <div className="flex items-center gap-4 mt-2">
              {liver.tiktokAccount && (
                <a 
                  href={liver.tiktokAccount.startsWith('http') ? liver.tiktokAccount : `https://www.tiktok.com/${liver.tiktokAccount.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                  title="TikTok"
                >
                  <SiTiktok className="w-5 h-5" />
                </a>
              )}
              {liver.instagramAccount && (
                <a 
                  href={liver.instagramAccount.startsWith('http') ? liver.instagramAccount : `https://www.instagram.com/${liver.instagramAccount.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-400 hover:text-pink-400 transition-colors"
                  title="Instagram"
                >
                  <SiInstagram className="w-5 h-5" />
                </a>
              )}
              {liver.youtubeAccount && (
                <a 
                  href={liver.youtubeAccount.startsWith('http') ? liver.youtubeAccount : `https://www.youtube.com/${liver.youtubeAccount}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="YouTube"
                >
                  <SiYoutube className="w-5 h-5" />
                </a>
              )}
              {liver.otherAccount && (
                <a 
                  href={liver.otherAccount.startsWith('http') ? liver.otherAccount : `https://${liver.otherAccount}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-400 hover:text-blue-400 transition-colors"
                  title="Other"
                >
                  <Link2 className="w-5 h-5" />
                </a>
              )}
            </div>
          )}
          
          {/* Previous Month Stats */}
          <div className="bg-yellow-500/20 text-yellow-500 px-4 py-2 rounded-full text-sm">
            {previousMonth.replace("-", "年")}月 実績 ▼
          </div>
          
          <div className="grid grid-cols-2 gap-8 w-full max-w-md">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formatCurrency(previousStats?.stats?.totalSales || 0)}
              </p>
              <div className="h-1 bg-yellow-500 rounded mt-1" />
              <p className="text-xs text-gray-400 mt-1">{tr.sales}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formatDuration(previousStats?.stats?.totalDuration || 0)}
              </p>
              <div className="h-1 bg-yellow-500 rounded mt-1" />
              <p className="text-xs text-gray-400 mt-1">{tr.totalDuration}</p>
            </div>
          </div>
          
          {/* Current Month Stats */}
          <p className="text-sm text-gray-400">
            {tr.selectedMonthPerformance}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
          </p>
          
          <div className="grid grid-cols-2 gap-8 w-full max-w-md">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formatCurrency(liver.stats?.totalSales || 0)}
              </p>
              <div className="h-1 bg-yellow-500 rounded mt-1" />
              <p className="text-xs text-gray-400 mt-1">{tr.sales}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formatDuration(liver.stats?.totalDuration || 0)}
              </p>
              <div className="h-1 bg-yellow-500 rounded mt-1" />
              <p className="text-xs text-gray-400 mt-1">{tr.totalDuration}</p>
            </div>
          </div>
        </div>
        
        {/* Record Button */}
        <div className="flex justify-center">
          <Link href={`/livers/${liverId}/record`}>
            <Button className="bg-red-600 hover:bg-red-700 px-8 py-6 text-lg rounded-full">
              配信内容の記録
            </Button>
          </Link>
        </div>
        
        {/* Delivery History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold border-b-2 border-red-600 pb-1">
              {tr.deliveryHistory}
            </h3>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32 bg-transparent border-gray-700 text-white text-sm">
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
          
          {/* History Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-600">
                  <th className="text-left py-2 px-2">{tr.start}</th>
                  <th className="text-center py-2 px-2">-</th>
                  <th className="text-left py-2 px-2">{tr.end}</th>
                  <th className="text-center py-2 px-2">{tr.duration}</th>
                  <th className="text-right py-2 px-2">{tr.salesTotal}</th>
                  <th className="text-center py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {livestreamsLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <Skeleton className="h-8 w-full bg-gray-800" />
                    </td>
                  </tr>
                ) : livestreamsToShow && livestreamsToShow.length > 0 ? (
                  livestreamsToShow.map((stream) => (
                    <tr key={stream.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                      <td className="py-3 px-2 whitespace-pre-line text-xs">
                        <div className="flex items-center gap-1">
                          {formatDate(stream.livestreamDate)}
                          {stream.productCsvImported !== 'yes' && (
                            <span title="商品別CSV未インポート">
                              <AlertTriangle className="w-3 h-3 text-orange-400" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">-</td>
                      <td className="py-3 px-2 whitespace-pre-line text-xs">
                        {stream.livestreamEndTime 
                          ? formatDate(stream.livestreamEndTime)
                          : "-"
                        }
                      </td>
                      <td className="text-center py-3 px-2">
                        {stream.duration 
                          ? `${(stream.duration / 60).toFixed(1)}${tr.hours}`
                          : calculateDurationFromDates(stream.livestreamDate, stream.livestreamEndTime)
                        }
                      </td>
                      <td className="text-right py-3 px-2 text-yellow-500">
                        {formatCurrency(stream.gmv || stream.salesAmount || 0)}
                      </td>
                      <td className="text-center py-3 px-2">
                        <Link href={`/livestreams/${stream.id}`}>
                          <Button 
                            size="sm" 
                            className="bg-yellow-500 hover:bg-yellow-600 text-black text-xs px-3"
                          >
                            {tr.detail}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      {tr.noHistory}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {livestreams && livestreams.length > 10 && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                {showAllHistory ? (
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
        </div>
        
        {/* Back to List Button */}
        <div className="flex justify-center pt-4">
          <Link href="/livers">
            <Button className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-full">
              {tr.backToList}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
