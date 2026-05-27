import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Clock, CheckCircle2, Plus, AlertTriangle, FileText, ShoppingBag, Store, MessageCircle, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.statistics.useQuery(undefined, {
    staleTime: 2 * 60 * 1000, // 2分間キャッシュ
  });

  const { t } = useLanguage();

  // isLoadingでブロックせず、データがない場合はスケルトンを表示
  const taskStats = stats?.stats || { total: 0, pending: 0, inProgress: 0, completed: 0 };

  return (
    <div className="space-y-6 relative">
      {/* Floating Action Button for Mobile */}
      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden z-50"
        onClick={() => setLocation("/master/tasks/create")}
      >
        <Plus className="h-6 w-6" />
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("dashboard.title")}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid gap-3 grid-cols-3">
        <Button
          size="lg"
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md"
          onClick={() => setLocation("/master/reports/chat")}
        >
          <FileText className="h-5 w-5 mr-2" />
          {t("dashboard.dailyReport")}
        </Button>
        <Button
          size="lg"
          className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-md"
          onClick={() => setLocation("/master/mall?tab=products")}
        >
          <ShoppingBag className="h-5 w-5 mr-2" />
          {t("nav.products")}
        </Button>
        <Button
          size="lg"
          className="w-full bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 text-white shadow-md"
          onClick={() => setLocation("/master/mall")}
        >
          <Store className="h-5 w-5 mr-2" />
          LCJ MALL
        </Button>
      </div>

      {/* LCJ Brain ショートカット */}
      <Card 
        className="cursor-pointer group hover:shadow-lg transition-all duration-200 border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30"
        onClick={() => setLocation("/master/lcj-brain")}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md group-hover:scale-105 transition-transform">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-purple-900 dark:text-purple-100">LCJ Brain</span>
              <Sparkles className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-sm text-muted-foreground">AIアシスタントに質問・相談する</p>
          </div>
          <div className="text-purple-400 group-hover:translate-x-1 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </CardContent>
      </Card>

      {/* Chat Section */}
      <ChatSection />

      <div className="grid gap-4 md:grid-cols-1">
        {stats?.overdueTasks && stats.overdueTasks.length > 0 && (
          <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-red-700 dark:text-red-400">{t("dashboard.overdue")}</CardTitle>
              </div>
              <CardDescription className="text-red-600 dark:text-red-300">
                {stats.overdueTasks.length} {t("tasks.results")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.overdueTasks.slice(0, 5).map((item) => {
                  const deadline = typeof item.task.deadline === 'string' ? new Date(item.task.deadline).getTime() : Number(item.task.deadline || 0);
                  const daysOverdue = Math.floor(
                    (Date.now() - deadline) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={item.task.id}
                      className="flex items-start justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      onClick={() => setLocation(`/tasks/${item.task.id}`)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-2">{item.task.taskDetail}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{t("tasks.staff")}: {item.staff?.name || "-"}</span>
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {daysOverdue} days
                          </span>
                        </div>
                      </div>
                      <AlertTriangle className="h-4 w-4 text-red-500 ml-2 flex-shrink-0" />
                    </div>
                  );
                })}
                {stats.overdueTasks.length > 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => setLocation("/master/tasks")}
                  >
                    {t("dashboard.viewAll")} ({stats.overdueTasks.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentTasks")}</CardTitle>
            <CardDescription>{t("dashboard.completed")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentCompleted && stats.recentCompleted.length > 0 ? (
              <div className="space-y-3">
                {stats.recentCompleted.map((item) => (
                  <div
                    key={item.task.id}
                    className="flex items-start justify-between border-b pb-2 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-1">{item.task.taskDetail}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("tasks.staff")}: {item.staff?.name || "-"}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-2 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("dashboard.noTasks")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChatSection() {
  const [, setLocation] = useLocation();
  const { data: unreadData } = trpc.chat.getUnreadCount.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const { data: rooms, isLoading } = trpc.chat.getRooms.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const unreadCount = unreadData?.unreadCount ?? 0;
  const recentRooms = (rooms as any[])?.slice(0, 5) || [];

  return (
    <Card className={unreadCount > 0 ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/10" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <CardTitle className="text-base">チャット</CardTitle>
            {unreadCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-green-500 px-2 text-xs font-bold text-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/master/chat")}
          >
            開く
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : recentRooms.length > 0 ? (
          <div className="space-y-2">
            {recentRooms.map((room: any) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => setLocation("/master/chat")}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {room.type === 'group' ? 'G' : (room.name || '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{room.name || 'チャット'}</div>
                    {room.lastMessage && (
                      <div className="text-xs text-muted-foreground truncate">
                        {room.lastSenderName ? `${room.lastSenderName}: ` : ''}{room.lastMessage}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {room.lastMessageAt && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatChatTime(room.lastMessageAt)}
                    </span>
                  )}
                  {Number(room.unreadCount) > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">
                      {room.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            チャットルームがありません
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function formatChatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}日前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
