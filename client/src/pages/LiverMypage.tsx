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
  Flame,
  Settings,
  Link2,
  Edit
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

  // Generate month options based on livestream data
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    
    // 配信履歴から月を取得
    const monthsWithData = new Set<string>();
    if (livestreams) {
      livestreams.forEach((ls: { livestreamDate: string | Date }) => {
        const date = new Date(ls.livestreamDate);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        monthsWithData.add(value);
      });
    }
    
    // 過去12ヶ月を生成
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    
    // 配信履歴にある月も追加（過去12ヶ月にない場合）
    monthsWithData.forEach(monthValue => {
      if (!options.find(o => o.value === monthValue)) {
        const [year, month] = monthValue.split("-").map(Number);
        options.push({ 
          value: monthValue, 
          label: `${year}年${month}月` 
        });
      }
    });
    
    // 日付順にソート（新しい順）
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

  // 表示する配信履歴（最初は10件まで）
  const displayedLivestreams = showAllLivestreams 
    ? filteredLivestreams 
    : filteredLivestreams.slice(0, 10);

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
              <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white">
                ライバーリスト
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="text-gray-300 hover:text-white"
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
          
          {/* SNS Links */}
          {(liverInfo.tiktokAccount || liverInfo.instagramAccount || liverInfo.youtubeAccount || liverInfo.otherAccount) && (
            <div className="flex items-center gap-4 mt-3">
              {liverInfo.tiktokAccount && (
                <a 
                  href={liverInfo.tiktokAccount.startsWith('http') ? liverInfo.tiktokAccount : `https://www.tiktok.com/${liverInfo.tiktokAccount.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors"
                  title="TikTok"
                >
                  <SiTiktok className="w-5 h-5" />
                </a>
              )}
              {liverInfo.instagramAccount && (
                <a 
                  href={liverInfo.instagramAccount.startsWith('http') ? liverInfo.instagramAccount : `https://www.instagram.com/${liverInfo.instagramAccount.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-300 hover:text-pink-400 transition-colors"
                  title="Instagram"
                >
                  <SiInstagram className="w-5 h-5" />
                </a>
              )}
              {liverInfo.youtubeAccount && (
                <a 
                  href={liverInfo.youtubeAccount.startsWith('http') ? liverInfo.youtubeAccount : `https://www.youtube.com/${liverInfo.youtubeAccount}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-300 hover:text-red-500 transition-colors"
                  title="YouTube"
                >
                  <SiYoutube className="w-5 h-5" />
                </a>
              )}
              {liverInfo.otherAccount && (
                <a 
                  href={liverInfo.otherAccount.startsWith('http') ? liverInfo.otherAccount : `https://${liverInfo.otherAccount}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-300 hover:text-blue-400 transition-colors"
                  title="その他"
                >
                  <Link2 className="w-5 h-5" />
                </a>
              )}
            </div>
          )}

          <Link href="/liver/profile">
            <Button variant="ghost" size="sm" className="mt-2 text-gray-300 hover:text-white">
              <Settings className="h-4 w-4 mr-1" />
              プロフィール編集
            </Button>
          </Link>
        </div>

        {/* Month Selector */}
        <div className="flex justify-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40 bg-yellow-500 border-yellow-600 text-black font-bold">
              <SelectValue />
              <span className="ml-1">実績</span>
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300 text-black">
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Monthly Stats - タイトなデザイン */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-3 text-center">
              <DollarSign className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
              <p className="text-xl font-bold text-white">¥{monthlyStats.sales.toLocaleString()}</p>
              <div className="h-0.5 bg-yellow-500 mt-1.5 rounded" />
              <p className="text-xs text-gray-400 mt-1">月間売上</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
              <p className="text-xl font-bold text-white">{monthlyStats.hours}h</p>
              <div className="h-0.5 bg-yellow-500 mt-1.5 rounded" />
              <p className="text-xs text-gray-400 mt-1">配信時間</p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats - タイトなデザイン */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-2 text-center">
              <Video className="h-3 w-3 mx-auto text-red-500 mb-0.5" />
              <p className="text-lg font-bold text-white">{monthlyStats.count}</p>
              <p className="text-[10px] text-gray-400">配信回数</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-2 text-center">
              <Target className="h-3 w-3 mx-auto text-green-500 mb-0.5" />
              <p className="text-lg font-bold text-white">¥{monthlyStats.avgSales.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">平均売上</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-2 text-center">
              <Eye className="h-3 w-3 mx-auto text-blue-500 mb-0.5" />
              <p className="text-lg font-bold text-white">{monthlyStats.viewerCount.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">視聴者数</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-2 text-center">
              <ShoppingCart className="h-3 w-3 mx-auto text-purple-500 mb-0.5" />
              <p className="text-lg font-bold text-white">{monthlyStats.orderCount.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">注文数</p>
            </CardContent>
          </Card>
        </div>

        {/* All-time Stats - タイトなデザイン */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-yellow-500" />
              <span className="font-bold text-white text-sm">累計実績</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-yellow-500">¥{allTimeStats.totalSales.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">総売上</p>
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-500">{allTimeStats.totalHours}h</p>
                <p className="text-[10px] text-gray-400">総配信時間</p>
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-500">{allTimeStats.totalCount}</p>
                <p className="text-[10px] text-gray-400">総配信回数</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons - タイトなデザイン */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => navigate(`/s`)}
            className="bg-yellow-500 hover:bg-yellow-600 text-black py-3 text-sm font-bold"
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            スケジュール
          </Button>
          <Button
            onClick={() => navigate(`/liver/record`)}
            className="bg-red-600 hover:bg-red-700 text-white py-3 text-sm font-bold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            配信記録
          </Button>
        </div>

        {/* Livestream History - Table Format */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Video className="h-5 w-5 text-red-500" />
              配信履歴
            </h3>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32 bg-slate-700 border-slate-600 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300 text-black">
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
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center text-gray-300">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>配信履歴がありません。</p>
                <p className="text-sm mt-2">「配信記録」から配信を記録しましょう！</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800 border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 text-gray-400 text-[10px]">
                      <th className="text-left py-2 px-3">開始</th>
                      <th className="text-left py-2 px-3">終了</th>
                      <th className="text-center py-2 px-3">時間</th>
                      <th className="text-right py-2 px-3">売上</th>
                      <th className="text-center py-2 px-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLivestreams.map((ls: { 
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
                        <tr 
                          key={ls.id} 
                          className="border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors cursor-pointer active:bg-slate-600/50"
                          onClick={() => navigate(`/livestreams/${ls.id}`)}
                        >
                          <td className="py-2 px-3">
                            <div className="text-white text-xs">
                              {startDate.toLocaleDateString("ja-JP", { 
                                month: "2-digit", 
                                day: "2-digit",
                                weekday: "short" 
                              })}
                            </div>
                            <div className="text-gray-400 text-[10px]">
                              {startDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            {endDate ? (
                              <>
                                <div className="text-white text-xs">
                                  {endDate.toLocaleDateString("ja-JP", { 
                                    month: "2-digit", 
                                    day: "2-digit",
                                    weekday: "short" 
                                  })}
                                </div>
                                <div className="text-gray-400 text-[10px]">
                                  {endDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-500 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-yellow-500 font-bold text-xs">
                              {duration > 0 ? `${duration}h` : "-"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="text-yellow-500 font-bold text-xs">
                              ¥{(ls.salesAmount || ls.gmv || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {filteredLivestreams.length > 10 && !showAllLivestreams && (
            <div className="mt-4 text-center">
              <Button 
                variant="outline" 
                onClick={() => setShowAllLivestreams(true)}
                className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black"
              >
                VIEW MORE
              </Button>
            </div>
          )}
        </div>

        {/* Bottom Navigation - タイトなデザイン */}
        <div className="mt-6">
          <Button
            onClick={() => navigate("/livers")}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 text-sm"
          >
            ライバーリスト
          </Button>
        </div>
      </div>
    </div>
  );
}
