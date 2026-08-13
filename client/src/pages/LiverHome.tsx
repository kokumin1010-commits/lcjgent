import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ShoppingBag, Package, Calendar, BarChart3, Bot, FileText,
  User, Bell, ChevronRight, Target, TrendingUp, Clock
} from "lucide-react";

export default function LiverHome() {
  const { data: liverInfo, isLoading } = trpc.liver.me.useQuery(undefined, {
    retry: false,
  });

  const now = new Date();
  const [selectedMonth] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const { data: livestreams } = trpc.liverManagement.getLivestreams.useQuery(
    { month: selectedMonth },
    { enabled: !!liverInfo }
  );

  const { data: currentGoal } = trpc.liver.getGoal.useQuery(
    { month: selectedMonth },
    { enabled: !!liverInfo }
  );

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    if (!livestreams) return { totalSales: 0, totalHours: 0, streamCount: 0 };
    const totalSales = livestreams.reduce((sum: number, ls: any) => sum + (ls.totalSales || 0), 0);
    const totalMinutes = livestreams.reduce((sum: number, ls: any) => sum + (ls.durationMinutes || 0), 0);
    return {
      totalSales,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      streamCount: livestreams.length,
    };
  }, [livestreams]);

  const goalAmount = currentGoal?.targetAmount || 0;
  const goalProgress = goalAmount > 0 ? Math.min(100, Math.round((monthlyStats.totalSales / goalAmount) * 100)) : 0;

  // Greeting based on time
  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return "おはようございます";
    if (hour < 18) return "こんにちは";
    return "お疲れさまです";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const quickActions = [
    { icon: ShoppingBag, label: "商品選品", path: "/liver/products", color: "from-pink-400 to-rose-500" },
    { icon: Package, label: "セット管理", path: "/liver/set-application", color: "from-purple-400 to-indigo-500" },
    { icon: Calendar, label: "スケジュール", path: "/liver/schedule", color: "from-blue-400 to-cyan-500" },
    { icon: BarChart3, label: "配信実績", path: "/liver/dashboard", color: "from-emerald-400 to-teal-500" },
    { icon: Bot, label: "神コーチ AI", path: "/liver/coach", color: "from-amber-400 to-orange-500" },
    { icon: FileText, label: "配信記録", path: "/liver/record", color: "from-violet-400 to-purple-500" },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 px-4 sm:px-6 py-6 sm:py-8 rounded-b-3xl shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              {liverInfo?.avatarUrl ? (
                <img src={liverInfo.avatarUrl} alt="" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/50 shadow-md" />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold">
                  {liverInfo?.name?.charAt(0) || "L"}
                </div>
              )}
              <div>
                <p className="text-white/80 text-xs sm:text-sm">{getGreeting()}</p>
                <h1 className="text-white text-lg sm:text-xl font-bold">{liverInfo?.name || "ライバー"}さん</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/liver/profile">
                <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  <User className="w-5 h-5 text-white" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-4 pb-8 space-y-5">
        {/* Monthly Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-pink-500" />
              <span className="text-[10px] sm:text-xs text-gray-500">月間売上</span>
            </div>
            <p className="text-sm sm:text-lg font-bold text-gray-800">
              ¥{monthlyStats.totalSales.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] sm:text-xs text-gray-500">配信時間</span>
            </div>
            <p className="text-sm sm:text-lg font-bold text-gray-800">
              {monthlyStats.totalHours}h
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-[10px] sm:text-xs text-gray-500">配信回数</span>
            </div>
            <p className="text-sm sm:text-lg font-bold text-gray-800">
              {monthlyStats.streamCount}回
            </p>
          </div>
        </div>

        {/* Goal Progress */}
        {goalAmount > 0 && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-semibold text-gray-700">今月の目標</span>
              </div>
              <span className="text-xs text-gray-500">
                ¥{monthlyStats.totalSales.toLocaleString()} / ¥{goalAmount.toLocaleString()}
              </span>
            </div>
            <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-medium text-purple-600">{goalProgress}% 達成</span>
              <span className="text-xs text-gray-400">
                残り ¥{Math.max(0, goalAmount - monthlyStats.totalSales).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-3 px-1">クイックアクション</h2>
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Link key={action.path} href={action.path}>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform`}>
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Streams */}
        {livestreams && livestreams.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-semibold text-gray-600">最近の配信</h2>
              <Link href="/liver/record">
                <span className="text-xs text-purple-500 flex items-center gap-0.5 cursor-pointer hover:text-purple-700">
                  すべて見る <ChevronRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="space-y-2.5">
              {livestreams.slice(0, 3).map((ls: any) => (
                <Link key={ls.id} href={`/livestreams/${ls.id}`}>
                  <div className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {ls.date ? new Date(ls.date).toLocaleDateString("ja-JP", { month: "short", day: "numeric" }) : "日付なし"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {ls.durationMinutes ? `${Math.floor(ls.durationMinutes / 60)}h${ls.durationMinutes % 60}m` : "未記録"}
                          {ls.brandName ? ` · ${ls.brandName}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">
                        ¥{(ls.totalSales || 0).toLocaleString()}
                      </p>
                      <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tips Card */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">神コーチからのアドバイス</p>
              <p className="text-xs text-amber-600 mt-1">
                配信データを分析して、売上アップのヒントをお届けします。神コーチに相談してみましょう！
              </p>
              <Link href="/liver/coach">
                <button className="mt-2 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-full transition-colors">
                  相談する →
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
