import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
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
  Video,
  Home,
  User
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
      navigate("/liver/login");
    },
  });

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    if (!livestreams) return { sales: 0, hours: 0, count: 0 };
    
    const [year, month] = selectedMonth.split("-").map(Number);
    type LivestreamRecord = { livestreamDate: string | Date; livestreamEndTime?: string | Date | null; salesAmount?: number | null };
    const filtered = livestreams.filter((ls: LivestreamRecord) => {
      const date = new Date(ls.livestreamDate);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    const sales = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.salesAmount || 0), 0);
    const hours = filtered.reduce((sum: number, ls: LivestreamRecord) => {
      if (ls.livestreamDate && ls.livestreamEndTime) {
        const start = new Date(ls.livestreamDate).getTime();
        const end = new Date(ls.livestreamEndTime).getTime();
        return sum + (end - start) / (1000 * 60 * 60);
      }
      return sum;
    }, 0);

    return { sales, hours: Math.round(hours * 10) / 10, count: filtered.length };
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-white">
                ¥{monthlyStats.sales.toLocaleString()}
              </p>
              <div className="mt-1 h-1 bg-yellow-500 rounded" />
              <p className="mt-1 text-sm text-gray-400">売上</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-white">
                {monthlyStats.hours}
              </p>
              <div className="mt-1 h-1 bg-yellow-500 rounded" />
              <p className="mt-1 text-sm text-gray-400">累計配信時間</p>
            </CardContent>
          </Card>
        </div>

        {/* Selected Month Stats */}
        <div className="text-center text-gray-400 text-sm">
          選択月実績（{monthOptions.find(o => o.value === selectedMonth)?.label}）
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">
                ¥{monthlyStats.sales.toLocaleString()}
              </p>
              <div className="mt-1 h-1 bg-yellow-500 rounded" />
              <p className="mt-1 text-sm text-gray-400">売上</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {monthlyStats.hours}
              </p>
              <div className="mt-1 h-1 bg-yellow-500 rounded" />
              <p className="mt-1 text-sm text-gray-400">累計配信時間</p>
            </CardContent>
          </Card>
        </div>

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
                配信履歴がありません。
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-red-600">
                    <th className="py-2 px-2 text-left text-sm text-gray-400">開始</th>
                    <th className="py-2 px-2 text-left text-sm text-gray-400">終了</th>
                    <th className="py-2 px-2 text-left text-sm text-gray-400">配信時間</th>
                    <th className="py-2 px-2 text-left text-sm text-gray-400">売上合計</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLivestreams.map((ls: { id: number; livestreamDate: string | Date; livestreamEndTime?: string | Date | null; salesAmount?: number | null }) => {
                    const startDate = new Date(ls.livestreamDate);
                    const endDate = ls.livestreamEndTime ? new Date(ls.livestreamEndTime) : null;
                    const duration = endDate
                      ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) * 10) / 10
                      : 0;

                    return (
                      <tr key={ls.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                        <td className="py-3 px-2 text-sm">
                          <div>{startDate.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit", weekday: "short" })}</div>
                          <div className="text-gray-500">{startDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</div>
                        </td>
                        <td className="py-3 px-2 text-sm">
                          {endDate ? (
                            <>
                              <div>{endDate.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit", weekday: "short" })}</div>
                              <div className="text-gray-500">{endDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</div>
                            </>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-sm">
                          {duration > 0 ? `${duration}時間` : "-"}
                        </td>
                        <td className="py-3 px-2 text-sm">
                          ¥{(ls.salesAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/livestreams/${ls.id}`)}
                            className="bg-yellow-500 text-black border-0 hover:bg-yellow-600"
                          >
                            詳細
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
