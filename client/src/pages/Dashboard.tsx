import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Clock, CheckCircle2, Plus, AlertTriangle, FileText, ShoppingBag, Store, MessageCircle, Brain, Sparkles, Wallet, Palette, User, Send, Bug, Calendar, Briefcase, MapPin , UserCog, Building2, Mic, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { toast } from "sonner";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: stats, isLoading } = trpc.dashboard.statistics.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });
  const { t } = useLanguage();
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

      {/* Personal Info Card */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-2xl font-bold shadow-lg">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{user?.name || "ユーザー"}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-300">
                <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {user?.role === "admin" ? "管理者" : "スタッフ"}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> LCJ</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-orange-400">{taskStats.pending}</p>
                <p className="text-xs text-gray-400">未完了</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{taskStats.inProgress}</p>
                <p className="text-xs text-gray-400">進行中</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{taskStats.completed}</p>
                <p className="text-xs text-gray-400">完了</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Left (Tasks + Daily Report) | Right (System Issues + Quick Actions) */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="md:col-span-2 space-y-6">
          {/* Overdue Tasks Alert */}
          {stats?.overdueTasks && stats.overdueTasks.length > 0 && (
            <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <CardTitle className="text-red-700 dark:text-red-400">{t("dashboard.overdue")}</CardTitle>
                  <Badge variant="destructive" className="ml-auto">{stats.overdueTasks.length}件</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.overdueTasks.slice(0, 3).map((item) => {
                    const deadline = typeof item.task.deadline === 'string' ? new Date(item.task.deadline).getTime() : Number(item.task.deadline || 0);
                    const daysOverdue = Math.floor((Date.now() - deadline) / (1000 * 60 * 60 * 24));
                    return (
                      <div
                        key={item.task.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-900 border border-red-200 cursor-pointer hover:bg-red-50 transition-colors"
                        onClick={() => setLocation(`/tasks/${item.task.id}`)}
                      >
                        <p className="text-sm font-medium line-clamp-1 flex-1">{item.task.taskDetail}</p>
                        <span className="text-xs text-red-600 font-medium ml-2">{daysOverdue}日超過</span>
                      </div>
                    );
                  })}
                  {stats.overdueTasks.length > 3 && (
                    <Button variant="ghost" size="sm" className="w-full text-red-600" onClick={() => setLocation("/master/tasks")}>
                      全て表示 ({stats.overdueTasks.length}件)
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today's Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-base">今日のタスク</CardTitle>
                </div>
                <Button size="sm" variant="outline" onClick={() => setLocation("/master/tasks/create")}>
                  <Plus className="h-4 w-4 mr-1" /> 追加
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.recentCompleted && stats.recentCompleted.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentCompleted.slice(0, 5).map((item) => (
                    <div key={item.task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-1">{item.task.taskDetail}</p>
                        <p className="text-xs text-muted-foreground">{item.staff?.name || "-"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">タスクがありません</p>
              )}
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setLocation("/master/tasks")}>
                タスク一覧を開く →
              </Button>
            </CardContent>
          </Card>

          {/* Quick Daily Report */}
          <QuickDailyReport />

          {/* Chat Section */}
          <ChatSection />
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          {/* Quick Actions - Editable */}
          <QuickActionsCard setLocation={setLocation} />

          {/* System Issues */}
          <SystemIssuesCard />

          {/* Task Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">タスク統計</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">全タスク</span>
                  <span className="font-bold">{taskStats.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">未着手</span>
                  <span className="font-bold text-orange-500">{taskStats.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">進行中</span>
                  <span className="font-bold text-blue-500">{taskStats.inProgress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">完了</span>
                  <span className="font-bold text-green-500">{taskStats.completed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Quick Daily Report - 日報快速填写
 */
function QuickDailyReport() {
  const [workContent, setWorkContent] = useState("");
  const [issues, setIssues] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = () => {
    if (!workContent.trim()) {
      toast.error("業務内容を入力してください");
      return;
    }
    // Navigate to the full report page with pre-filled content
    setLocation(`/master/reports/chat`);
    toast.success("日報ページに移動します");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">日報クイック入力</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {new Date().toLocaleDateString("ja-JP")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">今日の業務内容</label>
          <Textarea
            placeholder="今日やったことを簡潔に記入..."
            value={workContent}
            onChange={(e) => setWorkContent(e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">課題・問題点（任意）</label>
          <Input
            placeholder="困っていること、相談したいこと..."
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
            <Send className="h-4 w-4 mr-1" /> 日報を提出
          </Button>
          <Button variant="outline" onClick={() => setLocation("/master/reports/chat")}>
            詳細入力 →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * System Issues Card - 系统问题处理
 */
function SystemIssuesCard() {
  const [newIssue, setNewIssue] = useState("");
  const [issues, setIssues] = useState<{ id: number; text: string; status: string; date: string }[]>([
    { id: 1, text: "Rundown画像アップロード不安定", status: "対応中", date: "08/12" },
    { id: 2, text: "LCF Admin重複表示", status: "確認中", date: "08/11" },
  ]);

  const handleAddIssue = () => {
    if (!newIssue.trim()) return;
    setIssues([
      { id: Date.now(), text: newIssue, status: "新規", date: new Date().toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" }) },
      ...issues,
    ]);
    setNewIssue("");
    toast.success("問題を報告しました");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-red-500" />
          <CardTitle className="text-base">システム問題</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="問題を報告..."
            value={newIssue}
            onChange={(e) => setNewIssue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddIssue()}
            className="text-xs h-8"
          />
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleAddIssue}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {issues.map((issue) => (
            <div key={issue.id} className="flex items-start gap-2 p-2 rounded bg-accent/50 text-xs">
              <div className="flex-1">
                <p className="line-clamp-2">{issue.text}</p>
                <span className="text-muted-foreground">{issue.date}</span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 ${
                  issue.status === "新規" ? "border-red-300 text-red-600" :
                  issue.status === "対応中" ? "border-blue-300 text-blue-600" :
                  "border-yellow-300 text-yellow-600"
                }`}
              >
                {issue.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
  const recentRooms = (rooms as any[])?.slice(0, 3) || [];

  return (
    <Card className={unreadCount > 0 ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/10" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <CardTitle className="text-base">チャット</CardTitle>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-xs font-bold text-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/master/chat")}>
            開く
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : recentRooms.length > 0 ? (
          <div className="space-y-2">
            {recentRooms.map((room: any) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => setLocation("/master/chat")}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
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
                {Number(room.unreadCount) > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">
                    {room.unreadCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">チャットルームがありません</p>
        )}
      </CardContent>
    </Card>
  );
}

// Available modules for quick actions
const ALL_QUICK_MODULES = [
  { id: "finance", label: "財務管理", path: "/master/finance?tab=cashflow", icon: "Wallet", color: "text-emerald-500" },
  { id: "report", label: "日報", path: "/master/reports/chat", icon: "FileText", color: "text-blue-500" },
  { id: "selection", label: "選品中心", path: "/master/selection-center", icon: "ShoppingBag", color: "text-pink-500" },
  { id: "product-lab", label: "商品ラボ", path: "/master/product-lab", icon: "Store", color: "text-orange-500" },
  { id: "set-image", label: "セット画像", path: "/master/set-image-generator", icon: "Palette", color: "text-purple-500" },
  { id: "lcj-brain", label: "LCJ Brain", path: "/master/lcj-brain", icon: "Brain", color: "text-indigo-500" },
  { id: "tasks", label: "タスク", path: "/master/tasks", icon: "ClipboardList", color: "text-amber-500" },
  { id: "hr", label: "人事管理", path: "/master/hr", icon: "UserCog", color: "text-teal-500" },
  { id: "brands", label: "ブランド", path: "/master/brands", icon: "Building2", color: "text-cyan-500" },
  { id: "morning", label: "朝会", path: "/master/morning-meeting", icon: "Mic", color: "text-rose-500" },
  { id: "rundown", label: "Rundown", path: "/master/rundown", icon: "FileSpreadsheet", color: "text-lime-600" },
  { id: "chat", label: "チャット", path: "/master/chat", icon: "MessageCircle", color: "text-green-500" },
];

const ICON_MAP: Record<string, any> = { Wallet, FileText, ShoppingBag, Store, Palette, Brain, ClipboardList, UserCog, Building2, Mic, FileSpreadsheet, MessageCircle };

const DEFAULT_QUICK_IDS = ["finance", "report", "selection", "product-lab", "set-image", "lcj-brain"];

function QuickActionsCard({ setLocation }: { setLocation: (path: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("lcj_quick_actions");
      return saved ? JSON.parse(saved) : DEFAULT_QUICK_IDS;
    } catch { return DEFAULT_QUICK_IDS; }
  });

  const saveSelection = (ids: string[]) => {
    setSelectedIds(ids);
    localStorage.setItem("lcj_quick_actions", JSON.stringify(ids));
  };

  const toggleModule = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter(i => i !== id)
      : [...selectedIds, id];
    saveSelection(newIds);
  };

  const activeModules = ALL_QUICK_MODULES.filter(m => selectedIds.includes(m.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">クイックアクション</CardTitle>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(!editing)}>
            {editing ? "完了" : "編集"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="grid grid-cols-3 gap-1.5">
            {ALL_QUICK_MODULES.map(mod => {
              const Icon = ICON_MAP[mod.icon] || Wallet;
              const isSelected = selectedIds.includes(mod.id);
              return (
                <button
                  key={mod.id}
                  onClick={() => toggleModule(mod.id)}
                  className={`p-2 rounded-lg border text-center transition-all ${isSelected ? "border-primary bg-primary/5" : "border-dashed border-muted-foreground/30 opacity-50"}`}
                >
                  <Icon className={`h-3.5 w-3.5 mx-auto ${mod.color}`} />
                  <span className="text-[10px] block mt-0.5">{mod.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {activeModules.map(mod => {
              const Icon = ICON_MAP[mod.icon] || Wallet;
              return (
                <Button key={mod.id} size="sm" variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => setLocation(mod.path)}>
                  <Icon className={`h-4 w-4 ${mod.color}`} />
                  <span className="text-[11px]">{mod.label}</span>
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
