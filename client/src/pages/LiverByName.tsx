import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, TrendingUp, Clock, Calendar, DollarSign, Users, Eye, ShoppingCart, MousePointer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function LiverByName() {
  const { name } = useParams<{ name: string }>();
  const decodedName = decodeURIComponent(name || "");
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
  
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  
  const { data, isLoading } = trpc.liverManagement.getLivestreamsByStreamerName.useQuery({
    streamerName: decodedName,
    month: selectedMonth,
  });
  
  const translations = {
    ja: {
      back: "戻る",
      livestreamHistory: "配信履歴",
      totalSales: "月間売上合計",
      totalDuration: "月間配信時間",
      noData: "この月のデータはありません",
      date: "日付",
      brand: "ブランド",
      sales: "売上",
      duration: "配信時間",
      viewers: "視聴者数",
      orders: "注文数",
      clicks: "クリック数",
      hours: "時間",
      minutes: "分",
      livestreams: "配信",
    },
    zh: {
      back: "返回",
      livestreamHistory: "直播历史",
      totalSales: "月销售总额",
      totalDuration: "月直播时长",
      noData: "该月无数据",
      date: "日期",
      brand: "品牌",
      sales: "销售额",
      duration: "直播时长",
      viewers: "观众数",
      orders: "订单数",
      clicks: "点击数",
      hours: "小时",
      minutes: "分钟",
      livestreams: "直播",
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "¥0";
    return `¥${amount.toLocaleString()}`;
  };
  
  const formatDuration = (minutes: number | null | undefined) => {
    if (minutes == null) return "0分";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}${tr.hours}${mins}${tr.minutes}`;
    }
    return `${mins}${tr.minutes}`;
  };
  
  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-gray-800" />
          <Skeleton className="h-32 w-full bg-gray-800" />
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
        <div className="flex items-center gap-4">
          <Link href="/livers">
            <Button variant="ghost" size="icon" className="text-white hover:bg-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-gray-700 text-white text-lg">
                {decodedName?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{decodedName}</h1>
              <p className="text-sm text-gray-400">{tr.livestreamHistory}</p>
            </div>
          </div>
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
        
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-700/10 border-yellow-700/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-yellow-500 mb-2">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm">{tr.totalSales}</span>
              </div>
              <p className="text-2xl font-bold text-yellow-400">
                {formatCurrency(data?.totalSales)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-900/30 to-blue-700/10 border-blue-700/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-500 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm">{tr.totalDuration}</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {formatDuration(data?.totalDuration)}
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Livestream History */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-green-500" />
              {tr.livestreamHistory}
              <span className="text-sm text-gray-400 ml-2">
                ({data?.livestreams?.length || 0} {tr.livestreams})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.livestreams && data.livestreams.length > 0 ? (
              <div className="space-y-3">
                {data.livestreams.map((livestream) => (
                  <div 
                    key={livestream.id} 
                    className="p-4 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{formatDate(livestream.livestreamDate)}</span>
                      </div>
                      {livestream.result && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          livestream.result === "成功" 
                            ? "bg-green-900/50 text-green-400" 
                            : "bg-red-900/50 text-red-400"
                        }`}>
                          {livestream.result}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-yellow-500" />
                        <div>
                          <p className="text-xs text-gray-500">{tr.sales}</p>
                          <p className="font-medium text-yellow-400">{formatCurrency(livestream.gmv || livestream.salesAmount)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-gray-500">{tr.duration}</p>
                          <p className="font-medium text-blue-400">{formatDuration(livestream.duration)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-gray-500">{tr.viewers}</p>
                          <p className="font-medium text-purple-400">
                            {livestream.viewerCount?.toLocaleString() || "-"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-xs text-gray-500">{tr.orders}</p>
                          <p className="font-medium text-green-400">
                            {livestream.orderCount?.toLocaleString() || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {livestream.remarks && (
                      <p className="mt-3 text-sm text-gray-400 border-t border-gray-700 pt-3">
                        {livestream.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tr.noData}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
