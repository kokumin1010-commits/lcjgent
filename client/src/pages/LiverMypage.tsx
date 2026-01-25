import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { clearLiverToken } from "@/lib/liverAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Plus, 
  LogOut, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Video,
  Home,
  User,
  BarChart3,
  Eye,
  ShoppingCart,
  Target,
  Award,
  Flame
} from "lucide-react";

export default function LiverMypage() {
  const [, navigate] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Get current liver info
  const { data: liverInfo, isLoading: isLoadingLiver } = trpc.liver.me.useQuery();
  
  // Get liver's livestream history
  const { data: livestreams, isLoading: isLoadingLivestreams } = trpc.liverManagement.getLivestreams.useQuery(
    { liverId: liverInfo?.id || 0 },
    { enabled: !!liverInfo?.id }
  );

  const logoutMutation = trpc.liver.logout.useMutation({
    onSuccess: () => {
      // Clear token from localStorage
      clearLiverToken();
      navigate("/liver/login");
    },
  });

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    if (!livestreams) return { sales: 0, gmv: 0, hours: 0, count: 0, avgSales: 0, viewerCount: 0, orderCount: 0 };
    
    const [year, month] = selectedMonth.split("-").map(Number);
    type LivestreamRecord = { 
      livestreamDate: string | Date; 
      livestreamEndTime?: string | Date | null; 
      salesAmount?: number | null;
      gmv?: number | null;
      duration?: number | null;
      viewerCount?: number | null;
      orderCount?: number | null;
    };
    const filtered = livestreams.filter((ls: LivestreamRecord) => {
      const date = new Date(ls.livestreamDate);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    const sales = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.salesAmount || 0), 0);
    const gmv = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.gmv || 0), 0);
    const viewerCount = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.viewerCount || 0), 0);
    const orderCount = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.orderCount || 0), 0);
    
    // Calculate total hours from duration (in minutes) or from start/end times
    const hours = filtered.reduce((sum: number, ls: LivestreamRecord) => {
      if (ls.duration) {
        return sum + (ls.duration / 60);
      }
      if (ls.livestreamDate && ls.livestreamEndTime) {
        const start = new Date(ls.livestreamDate).getTime();
        const end = new Date(ls.livestreamEndTime).getTime();
        return sum + (end - start) / (1000 * 60 * 60);
      }
      return sum;
    }, 0);

    const avgSales = filtered.length > 0 ? Math.round(sales / filtered.length) : 0;

    return { 
      sales, 
      gmv,
      hours: Math.round(hours * 10) / 10, 
      count: filtered.length,
      avgSales,
      viewerCount,
      orderCount
    };
  }, [livestreams, selectedMonth]);

  // Calculate previous month stats for comparison
  const previousMonthStats = useMemo(() => {
    if (!livestreams) return { sales: 0, hours: 0, count: 0 };
    
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    
    type LivestreamRecord = { 
      livestreamDate: string | Date; 
      livestreamEndTime?: string | Date | null; 
      salesAmount?: number | null;
      duration?: number | null;
    };
    const filtered = livestreams.filter((ls: LivestreamRecord) => {
      const date = new Date(ls.livestreamDate);
      return date.getFullYear() === prevYear && date.getMonth() + 1 === prevMonth;
    });

    const sales = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.salesAmount || 0), 0);
    const hours = filtered.reduce((sum: number, ls: LivestreamRecord) => {
      if (ls.duration) {
        return sum + (ls.duration / 60);
      }
      if (ls.livestreamDate && ls.livestreamEndTime) {
        const start = new Date(ls.livestreamDate).getTime();
        const end = new Date(ls.livestreamEndTime).getTime();
        return sum + (end - start) / (1000 * 60 * 60);
      }
      return sum;
    }, 0);

    return { sales, hours: Math.round(hours * 10) / 10, count: filtered.length };
  }, [livestreams, selectedMonth]);

  // Calculate growth percentage
  const salesGrowth = previousMonthStats.sales > 0 
    ? Math.round(((monthlyStats.sales - previousMonthStats.sales) / previousMonthStats.sales) * 100)
    : monthlyStats.sales > 0 ? 100 : 0;

  // Filter livestreams by selected month
  const filteredLivestreams = useMemo(() => {
    if (!livestreams) return [];
    
    const [year, month] = selectedMonth.split("-").map(Number);
    return livestreams
      .filter((ls: { livestreamDate: string | Date }) => {
        const date = new Date(ls.livestreamDate);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
      })
      .sort((a: { livestreamDate: string | Date }, b: { livestreamDate: string | Date }) => new Date(b.livestreamDate).getTime() - new Date(a.livestreamDate).getTime());
  }, [livestreams, selectedMonth]);

  // Generate month options
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

  // Calculate all-time stats
  const allTimeStats = useMemo(() => {
    if (!livestreams) return { totalSales: 0, totalHours: 0, totalCount: 0 };
    
    type LivestreamRecord = { 
      livestreamDate: string | Date; 
      livestreamEndTime?: string | Date | null; 
      salesAmount?: number | null;
      duration?: number | null;
    };
    
    const totalSales = livestreams.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.salesAmount || 0), 0);
    const totalHours = livestreams.reduce((sum: number, ls: LivestreamRecord) => {
      if (ls.duration) {
        return sum + (ls.duration / 60);
      }
      if (ls.livestreamDate && ls.livestreamEndTime) {
        const start = new Date(ls.livestreamDate).getTime();
        const end = new Date(ls.livestreamEndTime).getTime();
        return sum + (end - start) / (1000 * 60 * 60);
      }
      return sum;
    }, 0);

    return { 
      totalSales, 
      totalHours: Math.round(totalHours * 10) / 10, 
      totalCount: livestreams.length 
    };
  }, [livestreams]);

  if (isLoadingLiver) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!liverInfo) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-white text-center">ログインが必要です</p>
        <Button
          onClick={() => navigate("/liver/login")}
          className="bg-red-600 hover:bg-red-700"
        >
          ログインページへ
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black border-b-2 border-red-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-yellow-500">マイページ</h1>
          <div className="flex items-center gap-2">
            <Link href="/livers">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                ライバーリスト
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="text-gray-400 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Red line separator */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Section */}
        <div className="flex flex-col items-center text-center">
          <Avatar className="w-24 h-24 border-4 border-red-600">
            <AvatarImage src={liverInfo.avatarUrl || undefined} />
            <AvatarFallback 
              className="text-2xl font-bold text-white"
              style={{ backgroundColor: liverInfo.color || "#FF69B4" }}
            >
              {liverInfo.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="mt-4 flex items-center gap-2">
            <Home className="h-4 w-4 text-red-500" />
          </div>
          <h2 className="mt-2 text-xl font-bold">{liverInfo.name}</h2>
          
          {/* Month Selector */}
          <div className="mt-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48 bg-yellow-500 text-black border-0 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} 実績
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-yellow-500" />
                {salesGrowth !== 0 && (
                  <Badge className={salesGrowth > 0 ? "bg-green-600" : "bg-red-600"}>
                    {salesGrowth > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {salesGrowth > 0 ? "+" : ""}{salesGrowth}%
                  </Badge>
                )}
              </div>
              <p className="text-3xl font-bold text-white">
                ¥{monthlyStats.sales.toLocaleString()}
              </p>
              <div className="mt-1 h-1 bg-yellow-500 rounded" />
              <p className="mt-1 text-sm text-gray-400">月間売上</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <p className="text-3xl font-bold text-white">
                {monthlyStats.hours}h
              </p>
              <div className="mt-1 h-1 bg-yellow-500 rounded" />
              <p className="mt-1 text-sm text-gray-400">配信時間</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-3 text-center">
              <Video className="h-4 w-4 text-red-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">{monthlyStats.count}</p>
              <p className="text-xs text-gray-400">配信回数</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-3 text-center">
              <Target className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">
                ¥{monthlyStats.avgSales.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">平均売上</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-3 text-center">
              <Eye className="h-4 w-4 text-green-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">
                {monthlyStats.viewerCount.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">視聴者数</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-3 text-center">
              <ShoppingCart className="h-4 w-4 text-purple-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">
                {monthlyStats.orderCount.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">注文数</p>
            </CardContent>
          </Card>
        </div>

        {/* All-time Stats */}
        <Card className="bg-gradient-to-r from-gray-900 to-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-500" />
              累計実績
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 pt-0">
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-500">
                ¥{allTimeStats.totalSales.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">総売上</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-500">
                {allTimeStats.totalHours}h
              </p>
              <p className="text-xs text-gray-400">総配信時間</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-500">
                {allTimeStats.totalCount}
              </p>
              <p className="text-xs text-gray-400">総配信回数</p>
            </div>
          </CardContent>
        </Card>

        {/* Record Button */}
        <Button
          onClick={() => navigate(`/liver/record`)}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-bold"
        >
          <Plus className="h-5 w-5 mr-2" />
          配信内容の記録
        </Button>

        {/* Livestream History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Video className="h-5 w-5 text-red-500" />
              配信履歴
            </h3>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32 bg-transparent border-gray-700 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingLivestreams ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredLivestreams.length === 0 ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-8 text-center text-gray-400">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>配信履歴がありません。</p>
                <p className="text-sm mt-2">「配信内容の記録」から配信を記録しましょう！</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredLivestreams.map((ls: { 
                id: number; 
                livestreamDate: string | Date; 
                livestreamEndTime?: string | Date | null; 
                salesAmount?: number | null;
                gmv?: number | null;
                duration?: number | null;
                viewerCount?: number | null;
                result?: string | null;
                streamerName?: string;
              }) => {
                const startDate = new Date(ls.livestreamDate);
                const endDate = ls.livestreamEndTime ? new Date(ls.livestreamEndTime) : null;
                const duration = ls.duration 
                  ? Math.round(ls.duration / 60 * 10) / 10
                  : endDate
                    ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) * 10) / 10
                    : 0;

                return (
                  <Card 
                    key={ls.id} 
                    className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
                    onClick={() => navigate(`/livestreams/${ls.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-red-600/20 flex items-center justify-center">
                            <Video className="h-6 w-6 text-red-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white">
                                {startDate.toLocaleDateString("ja-JP", { 
                                  month: "numeric", 
                                  day: "numeric", 
                                  weekday: "short" 
                                })}
                              </p>
                              {ls.result && (
                                <Badge className={ls.result === "成功" ? "bg-green-600" : "bg-red-600"}>
                                  {ls.result}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">
                              {startDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                              {endDate && ` - ${endDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`}
                              {duration > 0 && ` (${duration}h)`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-yellow-500">
                            ¥{(ls.salesAmount || ls.gmv || 0).toLocaleString()}
                          </p>
                          {ls.viewerCount && (
                            <p className="text-xs text-gray-400">
                              <Eye className="h-3 w-3 inline mr-1" />
                              {ls.viewerCount.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {filteredLivestreams.length > 10 && (
            <div className="mt-4 text-center">
              <Button variant="outline" className="border-gray-700 text-gray-400">
                VIEW MORE
              </Button>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="mt-8">
          <Button
            onClick={() => navigate("/livers")}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4"
          >
            ライバーリスト
          </Button>
        </div>
      </div>
    </div>
  );
}
