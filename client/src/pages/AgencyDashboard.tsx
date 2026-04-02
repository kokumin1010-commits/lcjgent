import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, Users, Video, TrendingUp, Calendar, LogOut,
  ChevronRight, Clock, BarChart3, History, Settings
} from "lucide-react";
import { getAgencyToken, clearAgencyToken } from "@/lib/agencyAuth";

export default function AgencyDashboard() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"dashboard" | "livers" | "history" | "schedules" | "settings">("dashboard");

  const hasToken = !!getAgencyToken();
  const meQuery = trpc.agency.me.useQuery(undefined, {
    enabled: hasToken,
    retry: false,
  });
  const dashboardQuery = trpc.agency.dashboard.useQuery(undefined, {
    enabled: hasToken && activeTab === "dashboard",
    retry: false,
  });
  const liversQuery = trpc.agency.getMyLivers.useQuery(undefined, {
    enabled: hasToken && (activeTab === "livers" || activeTab === "dashboard"),
    retry: false,
  });
  const historyQuery = trpc.agency.getLivestreamHistory.useQuery(
    { limit: 50, offset: 0 },
    { enabled: hasToken && activeTab === "history", retry: false }
  );
  const schedulesQuery = trpc.agency.getSchedules.useQuery(undefined, {
    enabled: hasToken && activeTab === "schedules",
    retry: false,
  });

  useEffect(() => {
    if (!hasToken) {
      navigate("/agency/login");
      return;
    }
    if (meQuery.isError || meQuery.data === null) {
      clearAgencyToken();
      navigate("/agency/login");
    }
  }, [hasToken, meQuery.data, meQuery.isError, navigate]);

  const handleLogout = () => {
    clearAgencyToken();
    navigate("/agency/login");
  };

  if (!meQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const agency = meQuery.data;
  const dashboard = dashboardQuery.data;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/80 border-b border-slate-700 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{agency.name}</h1>
              <p className="text-xs text-slate-400">LCJ ライブコマース管理</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-white">
            <LogOut className="w-4 h-4 mr-2" />
            ログアウト
          </Button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-800/50 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { key: "dashboard" as const, label: "ダッシュボード", icon: BarChart3 },
            { key: "livers" as const, label: "所属ライバー", icon: Users },
            { key: "history" as const, label: "配信履歴", icon: History },
            { key: "schedules" as const, label: "スケジュール", icon: Calendar },
            { key: "settings" as const, label: "設定", icon: Settings },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "dashboard" && (
          <DashboardTab dashboard={dashboard} livers={liversQuery.data} />
        )}
        {activeTab === "livers" && (
          <LiversTab livers={liversQuery.data} />
        )}
        {activeTab === "history" && (
          <HistoryTab history={historyQuery.data} />
        )}
        {activeTab === "schedules" && (
          <SchedulesTab schedules={schedulesQuery.data} />
        )}
        {activeTab === "settings" && (
          <SettingsTab agency={agency} />
        )}
      </main>
    </div>
  );
}

// ===== Dashboard Tab =====
function DashboardTab({ dashboard, livers }: { dashboard: any; livers: any }) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/80 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">所属ライバー</p>
                <p className="text-3xl font-bold text-white mt-1">{dashboard?.liverCount ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/80 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">今月の配信数</p>
                <p className="text-3xl font-bold text-white mt-1">{dashboard?.monthlyLivestreamCount ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <Video className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/80 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">今月の売上</p>
                <p className="text-3xl font-bold text-white mt-1">
                  ¥{(dashboard?.monthlyTotalSales ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedules */}
      <Card className="bg-slate-800/80 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            今日のスケジュール
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard?.todaySchedules?.length > 0 ? (
            <div className="space-y-3">
              {dashboard.todaySchedules.map((s: any) => (
                <div key={s.id} className="flex items-center gap-4 p-3 bg-slate-700/50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{s.title}</p>
                    <p className="text-sm text-slate-400">
                      {s.startTime ? new Date(s.startTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : ""} - 
                      {s.liverName || "未定"}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded-full">
                    {s.category || "配信"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">今日のスケジュールはありません</p>
          )}
        </CardContent>
      </Card>

      {/* Livers Overview */}
      <Card className="bg-slate-800/80 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            所属ライバー
          </CardTitle>
        </CardHeader>
        <CardContent>
          {livers && livers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {livers.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700/80 transition-colors">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: l.color || "#3b82f6" }}
                  >
                    {l.avatarUrl ? (
                      <img src={l.avatarUrl} alt={l.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      l.name?.charAt(0) || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{l.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {l.tiktokAccount ? `@${l.tiktokAccount}` : l.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">所属ライバーがいません</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Livers Tab =====
function LiversTab({ livers }: { livers: any }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">所属ライバー一覧</h2>
      {livers && livers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {livers.map((l: any) => (
            <Card key={l.id} className="bg-slate-800/80 border-slate-700 hover:border-slate-600 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: l.color || "#3b82f6" }}
                  >
                    {l.avatarUrl ? (
                      <img src={l.avatarUrl} alt={l.name} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      l.name?.charAt(0) || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-lg">{l.name}</p>
                    <p className="text-sm text-slate-400">{l.email}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {l.tiktokAccount && (
                        <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded-full">
                          TikTok: @{l.tiktokAccount}
                        </span>
                      )}
                      {l.instagramAccount && (
                        <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded-full">
                          IG: @{l.instagramAccount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full shrink-0 ${l.isActive ? "bg-green-400" : "bg-slate-500"}`} />
                </div>
                {l.lastLoginAt && (
                  <p className="text-xs text-slate-500 mt-3">
                    最終ログイン: {new Date(l.lastLoginAt).toLocaleDateString("ja-JP")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-800/80 border-slate-700">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">所属ライバーがいません</p>
            <p className="text-sm text-slate-500 mt-2">管理者がライバーを割り当てると表示されます</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== History Tab =====
function HistoryTab({ history }: { history: any }) {
  const items = history?.items ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">配信履歴</h2>
        <span className="text-sm text-slate-400">全{history?.total ?? 0}件</span>
      </div>
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">日付</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">配信者</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">プラットフォーム</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">売上</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">視聴者</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">注文数</th>
                <th className="text-center py-3 px-4 text-slate-400 font-medium">結果</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ls: any) => (
                <tr key={ls.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                  <td className="py-3 px-4 text-white">
                    {ls.livestreamDate ? new Date(ls.livestreamDate).toLocaleDateString("ja-JP") : "-"}
                  </td>
                  <td className="py-3 px-4 text-white">{ls.streamerName}</td>
                  <td className="py-3 px-4 text-slate-300">{ls.platform || "-"}</td>
                  <td className="py-3 px-4 text-right text-white font-medium">
                    {ls.salesAmount ? `¥${Number(ls.salesAmount).toLocaleString()}` : "-"}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300">
                    {ls.viewerCount?.toLocaleString() || "-"}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300">
                    {ls.orderCount?.toLocaleString() || "-"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {ls.result === "成功" ? (
                      <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-full">成功</span>
                    ) : ls.result === "失敗" ? (
                      <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-full">失敗</span>
                    ) : (
                      <span className="text-xs text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card className="bg-slate-800/80 border-slate-700">
          <CardContent className="p-12 text-center">
            <History className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">配信履歴がありません</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== Schedules Tab =====
function SchedulesTab({ schedules }: { schedules: any }) {
  const items = schedules ?? [];
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">スケジュール</h2>
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((s: any) => (
            <Card key={s.id} className="bg-slate-800/80 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{s.title}</p>
                    <p className="text-sm text-slate-400">
                      {s.startTime ? new Date(s.startTime).toLocaleString("ja-JP", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      }) : ""}
                      {s.endTime ? ` - ${new Date(s.endTime).toLocaleTimeString("ja-JP", {
                        hour: "2-digit", minute: "2-digit"
                      })}` : ""}
                    </p>
                    {s.description && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{s.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-slate-300">{s.liverName || "未定"}</p>
                    <span className="text-xs px-2 py-1 bg-slate-700 text-slate-400 rounded-full">
                      {s.category || "配信"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-800/80 border-slate-700">
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">スケジュールがありません</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== Settings Tab =====
function SettingsTab({ agency }: { agency: any }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">事務所設定</h2>
      <Card className="bg-slate-800/80 border-slate-700">
        <CardContent className="p-6 space-y-4">
          <div>
            <p className="text-sm text-slate-400">事務所名</p>
            <p className="text-lg font-medium text-white">{agency.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">ログインID</p>
            <p className="text-white">{agency.loginId}</p>
          </div>
          {agency.contactEmail && (
            <div>
              <p className="text-sm text-slate-400">連絡先メール</p>
              <p className="text-white">{agency.contactEmail}</p>
            </div>
          )}
          {agency.contactPhone && (
            <div>
              <p className="text-sm text-slate-400">電話番号</p>
              <p className="text-white">{agency.contactPhone}</p>
            </div>
          )}
          {agency.description && (
            <div>
              <p className="text-sm text-slate-400">説明</p>
              <p className="text-white">{agency.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
