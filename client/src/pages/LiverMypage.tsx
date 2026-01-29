import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { clearLiverToken } from "@/lib/liverAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Plus, 
  LogOut, 
  ChevronRight,
  Video,
  Eye,
  ShoppingCart,
  Settings,
  Link2,
  Users,
  Sparkles
} from "lucide-react";
import { SiTiktok, SiInstagram, SiYoutube } from "react-icons/si";

export default function LiverMypage() {
  const [, navigate] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showAllLivestreams, setShowAllLivestreams] = useState(false);

  // Get current liver info
  const { data: liverInfo, isLoading: isLoadingLiver } = trpc.liver.me.useQuery();
  
  // Get liver's livestream history (全期間取得)
  const { data: livestreams, isLoading: isLoadingLivestreams } = trpc.liverManagement.getLivestreams.useQuery(
    { liverId: liverInfo?.id || 0 },
    { enabled: !!liverInfo?.id }
  );

  const logoutMutation = trpc.liver.logout.useMutation({
    onSuccess: () => {
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
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    
    const monthsWithData = new Set<string>();
    if (livestreams) {
      livestreams.forEach((ls: { livestreamDate: string | Date }) => {
        const date = new Date(ls.livestreamDate);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        monthsWithData.add(value);
      });
    }
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    
    monthsWithData.forEach(monthValue => {
      if (!options.find(o => o.value === monthValue)) {
        const [year, month] = monthValue.split("-").map(Number);
        options.push({ value: monthValue, label: `${year}年${month}月` });
      }
    });
    
    options.sort((a, b) => b.value.localeCompare(a.value));
    return options;
  }, [livestreams]);

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

  const displayedLivestreams = showAllLivestreams 
    ? filteredLivestreams 
    : filteredLivestreams.slice(0, 10);

  if (isLoadingLiver) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!liverInfo) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-white text-center">ログインが必要です</p>
        <Button onClick={() => navigate("/liver/login")} className="bg-red-600 hover:bg-red-700">
          ログインページへ
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-white">マイページ</h1>
          <div className="flex items-center gap-1">
            <Link href="/livers">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white text-xs px-2">
                <Users className="h-4 w-4 mr-1" />
                一覧
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="text-gray-400 hover:text-red-400 h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Profile Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-red-500/50">
                <AvatarImage src={liverInfo.avatarUrl || undefined} />
                <AvatarFallback 
                  className="text-xl font-bold text-white"
                  style={{ backgroundColor: liverInfo.color || "#EF4444" }}
                >
                  {liverInfo.name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{liverInfo.name}</h2>
                {/* SNS Links */}
                <div className="flex items-center gap-3 mt-2">
                  {liverInfo.tiktokAccount && (
                    <a 
                      href={liverInfo.tiktokAccount.startsWith('http') ? liverInfo.tiktokAccount : `https://www.tiktok.com/${liverInfo.tiktokAccount.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <SiTiktok className="w-4 h-4" />
                    </a>
                  )}
                  {liverInfo.instagramAccount && (
                    <a 
                      href={liverInfo.instagramAccount.startsWith('http') ? liverInfo.instagramAccount : `https://www.instagram.com/${liverInfo.instagramAccount.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-pink-400 transition-colors"
                    >
                      <SiInstagram className="w-4 h-4" />
                    </a>
                  )}
                  {liverInfo.youtubeAccount && (
                    <a 
                      href={liverInfo.youtubeAccount.startsWith('http') ? liverInfo.youtubeAccount : `https://www.youtube.com/${liverInfo.youtubeAccount}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <SiYoutube className="w-4 h-4" />
                    </a>
                  )}
                  {liverInfo.otherAccount && (
                    <a 
                      href={liverInfo.otherAccount.startsWith('http') ? liverInfo.otherAccount : `https://${liverInfo.otherAccount}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-400 transition-colors"
                    >
                      <Link2 className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
              <Link href="/liver/profile">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Month Selector & Action Buttons */}
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="flex-1 bg-gray-800 border-gray-700 text-white h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="hover:bg-gray-700">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => navigate(`/s`)}
            size="sm"
            className="bg-gray-700 hover:bg-gray-600 text-white h-10 px-3"
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => navigate(`/liver/record`)}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white h-10 px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Monthly Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-red-600/20 to-red-800/20 border-red-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">月間売上</span>
              </div>
              <p className="text-2xl font-bold text-white">¥{monthlyStats.sales.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">配信時間</span>
              </div>
              <p className="text-2xl font-bold text-white">{monthlyStats.hours}h</p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-2 text-center">
              <Video className="h-3 w-3 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold text-white">{monthlyStats.count}</p>
              <p className="text-[10px] text-gray-500">配信数</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-2 text-center">
              <DollarSign className="h-3 w-3 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold text-white">¥{Math.round(monthlyStats.avgSales / 1000)}k</p>
              <p className="text-[10px] text-gray-500">平均</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-2 text-center">
              <Eye className="h-3 w-3 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold text-white">{monthlyStats.viewerCount.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">視聴者</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-2 text-center">
              <ShoppingCart className="h-3 w-3 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold text-white">{monthlyStats.orderCount.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">注文</p>
            </CardContent>
          </Card>
        </div>

        {/* All-time Stats */}
        <Card className="bg-gray-800/30 border-gray-700">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500 mb-2">累計実績</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-bold text-red-400">¥{allTimeStats.totalSales.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">総売上</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-400">{allTimeStats.totalHours}h</p>
                <p className="text-[10px] text-gray-500">総時間</p>
              </div>
              <div>
                <p className="text-sm font-bold text-green-400">{allTimeStats.totalCount}</p>
                <p className="text-[10px] text-gray-500">総配信</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Livestream History */}
        <div>
          <h3 className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
            <Video className="h-4 w-4" />
            配信履歴
          </h3>

          {isLoadingLivestreams ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredLivestreams.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6 text-center text-gray-400">
                <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">配信履歴がありません</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {displayedLivestreams.map((ls: { 
                id: number; 
                livestreamDate: string | Date; 
                livestreamEndTime?: string | Date | null; 
                salesAmount?: number | null;
                gmv?: number | null;
                duration?: number | null;
                aiStructuredAdvice?: {
                  summary?: string;
                  goodPoints?: string[];
                  improvements?: string[];
                  actionPlans?: { action: string; reason: string; timing: string }[];
                  nextGoal?: string;
                  calculatedMetrics?: Record<string, string | number>;
                } | null;
                aiAdvice?: string | null;
              }) => {
                const startDate = new Date(ls.livestreamDate);
                const endDate = ls.livestreamEndTime ? new Date(ls.livestreamEndTime) : null;
                const duration = ls.duration 
                  ? Math.round(ls.duration / 60 * 10) / 10
                  : endDate
                    ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) * 10) / 10
                    : 0;
                const hasAiAdvice = ls.aiStructuredAdvice || ls.aiAdvice;

                return (
                  <Card 
                    key={ls.id} 
                    className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 transition-colors cursor-pointer active:scale-[0.99]"
                    onClick={() => navigate(`/livestreams/${ls.id}`)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-center bg-gray-700/50 rounded px-2 py-1">
                          <p className="text-xs font-bold text-white">
                            {startDate.getMonth() + 1}/{startDate.getDate()}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {startDate.toLocaleDateString("ja-JP", { weekday: "short" })}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-gray-400">
                              {startDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                              {endDate && ` - ${endDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`}
                            </p>
                            {hasAiAdvice && (
                              <Sparkles className="h-3 w-3 text-yellow-500" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {duration > 0 ? `${duration}h` : "-"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-red-400">
                          ¥{(ls.salesAmount || ls.gmv || 0).toLocaleString()}
                        </p>
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {filteredLivestreams.length > 10 && !showAllLivestreams && (
            <Button 
              variant="ghost"
              onClick={() => setShowAllLivestreams(true)}
              className="w-full mt-2 text-gray-400 hover:text-white text-xs"
            >
              もっと見る ({filteredLivestreams.length - 10}件)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
