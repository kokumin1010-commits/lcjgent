import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, Activity, Clock, ChevronRight, X } from "lucide-react";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusColors = {
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  cancelled: "bg-gray-500",
};

const statusLabels = {
  pending: "保留中",
  in_progress: "進行中",
  completed: "完了",
  cancelled: "キャンセル",
};

export default function MasterControl() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showUserActivityDialog, setShowUserActivityDialog] = useState(false);

  const { data: allTasksData, isLoading } = trpc.task.listAllWithUsers.useQuery();
  const { data: allUsers, isLoading: usersLoading } = trpc.users.getAll.useQuery();
  const { data: activityLogs, isLoading: logsLoading } = trpc.activityLog.getRecent.useQuery({ limit: 30 });
  const { data: userActivityLogs, isLoading: userLogsLoading } = trpc.activityLog.getByUser.useQuery(
    { userId: selectedUserId!, limit: 50 },
    { enabled: selectedUserId !== null }
  );

  // Translations
  const t = {
    title: language === "zh" ? "主控制台" : "マスターコントロール",
    subtitle: language === "zh" ? "全用户任务一元管理" : "全ユーザーのタスクを一元管理",
    totalTasks: language === "zh" ? "总任务数" : "総タスク数",
    inProgress: language === "zh" ? "进行中" : "進行中",
    pending: language === "zh" ? "保留中" : "保留中",
    completed: language === "zh" ? "完了" : "完了",
    registeredUsers: language === "zh" ? "注册用户" : "登録ユーザー",
    userStats: language === "zh" ? "用户别统计" : "ユーザー別統計",
    staffStats: language === "zh" ? "员工别统计" : "スタッフ別統計",
    activityLog: language === "zh" ? "行动日志" : "行動ログ",
    recentActivity: language === "zh" ? "最近的活动" : "最近のアクティビティ",
    filters: language === "zh" ? "筛选" : "フィルター",
    search: language === "zh" ? "搜索" : "検索",
    searchPlaceholder: language === "zh" ? "按任务内容搜索..." : "タスク内容で検索...",
    user: language === "zh" ? "用户" : "ユーザー",
    allUsers: language === "zh" ? "全部用户" : "全ユーザー",
    staff: language === "zh" ? "员工" : "スタッフ",
    allStaff: language === "zh" ? "全部员工" : "全スタッフ",
    status: language === "zh" ? "状态" : "ステータス",
    allStatus: language === "zh" ? "全部状态" : "全ステータス",
    clearFilters: language === "zh" ? "清除筛选" : "フィルターをクリア",
    taskList: language === "zh" ? "任务列表" : "タスク一覧",
    items: language === "zh" ? "件" : "件",
    total: language === "zh" ? "总数" : "総数",
    completionRate: language === "zh" ? "完成率" : "完了率",
    noTasks: language === "zh" ? "没有找到任务" : "タスクが見つかりません",
    noActivity: language === "zh" ? "没有活动记录" : "アクティビティがありません",
    instructor: language === "zh" ? "指示者" : "指示者",
    assignee: language === "zh" ? "负责人" : "担当",
    registered: language === "zh" ? "注册" : "登録",
    deadline: language === "zh" ? "期限" : "期限",
    unknown: language === "zh" ? "不明" : "不明",
    taskCount: language === "zh" ? "任务数" : "タスク数",
    activityCount: language === "zh" ? "活动数" : "アクティビティ数",
    noTasksYet: language === "zh" ? "暂无任务" : "タスクなし",
    businessCardCreate: language === "zh" ? "注册了名片" : "名刺を登録",
    brandCreate: language === "zh" ? "创建了品牌" : "ブランドを作成",
    taskCreate: language === "zh" ? "创建了任务" : "タスクを作成",
    reportCreate: language === "zh" ? "提交了报告" : "レポートを提出",
    followupComplete: language === "zh" ? "完成了跟进" : "フォローアップを完了",
    brandActivityCreate: language === "zh" ? "添加了应对履历" : "対応履歴を追加",
    activityHistory: language === "zh" ? "活动历史" : "行動履歴",
    viewActivity: language === "zh" ? "查看活动" : "行動を見る",
    close: language === "zh" ? "关闭" : "閉じる",
  };

  if (isLoading || usersLoading || logsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Extract unique users and staff from tasks
  const uniqueUsersFromTasks = Array.from(
    new Set(allTasksData?.map((item) => item.user?.email).filter(Boolean))
  );
  const uniqueStaff = Array.from(
    new Set(allTasksData?.map((item) => item.staff?.name).filter(Boolean))
  );

  // Filter tasks
  const filteredTasks = allTasksData?.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.task.taskDetail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.staff?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user?.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUser =
      selectedUser === "all" || item.user?.email === selectedUser;

    const matchesStaff =
      selectedStaff === "all" || item.staff?.name === selectedStaff;

    const matchesStatus =
      selectedStatus === "all" || item.task.status === selectedStatus;

    return matchesSearch && matchesUser && matchesStaff && matchesStatus;
  });

  // Calculate statistics
  const totalTasks = allTasksData?.length || 0;
  const completedTasks =
    allTasksData?.filter((item) => item.task.status === "completed").length || 0;
  const inProgressTasks =
    allTasksData?.filter((item) => item.task.status === "in_progress").length || 0;
  const pendingTasks =
    allTasksData?.filter((item) => item.task.status === "pending").length || 0;

  // Filter out test users (@example.com domain)
  const filteredUsers = (allUsers || []).filter(
    (user) => !user.email.endsWith("@example.com")
  );

  // User statistics - now using all registered users (excluding test users)
  const userStats = filteredUsers.map((user) => {
    const userTasks = allTasksData?.filter(
      (item) => item.user?.id === user.id
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      total: userTasks?.length || 0,
      completed:
        userTasks?.filter((item) => item.task.status === "completed").length || 0,
      createdAt: user.createdAt,
    };
  });

  // Staff statistics
  const staffStats = uniqueStaff.map((staffName) => {
    const staffTasks = allTasksData?.filter(
      (item) => item.staff?.name === staffName
    );
    return {
      name: staffName,
      total: staffTasks?.length || 0,
      completed:
        staffTasks?.filter((item) => item.task.status === "completed").length || 0,
    };
  });

  // Format activity action label
  const formatActionLabel = (actionType: string, actionLabel: string) => {
    switch (actionType) {
      case "business_card_create":
        return t.businessCardCreate;
      case "brand_create":
        return t.brandCreate;
      case "task_create":
        return t.taskCreate;
      case "report_create":
        return t.reportCreate;
      case "followup_complete":
        return t.followupComplete;
      case "brand_activity_create":
        return t.brandActivityCreate;
      default:
        return actionLabel;
    }
  };

  // Handle user click to show activity history
  const handleUserClick = (userId: number) => {
    setSelectedUserId(userId);
    setShowUserActivityDialog(true);
  };

  // Get selected user info
  const selectedUserInfo = allUsers?.find((u) => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground mt-2">
          {t.subtitle}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.totalTasks}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.inProgress}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.pending}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.completed}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t.registeredUsers}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{filteredUsers?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* User Statistics - All Registered Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t.userStats}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {userStats.map((stat) => (
              <div
                key={stat.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => handleUserClick(stat.id)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{stat.name || stat.email}</span>
                  <span className="text-xs text-muted-foreground">{stat.email}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{t.total}: {stat.total}</span>
                  <span className="text-green-600">{t.completed}: {stat.completed}</span>
                  <span className="text-muted-foreground">
                    {t.completionRate}: {stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0}%
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
            {userStats.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                {t.noTasksYet}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Activity Dialog */}
      <Dialog open={showUserActivityDialog} onOpenChange={setShowUserActivityDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {selectedUserInfo?.name || selectedUserInfo?.email} - {t.activityHistory}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {userLogsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : userActivityLogs && userActivityLogs.length > 0 ? (
              userActivityLogs.map((item) => (
                <div
                  key={item.log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {formatActionLabel(item.log.actionType, item.log.actionLabel)}
                      </div>
                      {item.log.targetName && (
                        <span className="text-sm text-muted-foreground">
                          → {item.log.targetName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {new Date(item.log.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t.noActivity}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t.activityLog}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {activityLogs && activityLogs.length > 0 ? (
              activityLogs.map((item) => (
                <div
                  key={item.log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.user?.name || item.user?.email || t.unknown}</span>
                        <span className="text-muted-foreground">
                          {formatActionLabel(item.log.actionType, item.log.actionLabel)}
                        </span>
                      </div>
                      {item.log.targetName && (
                        <span className="text-sm text-muted-foreground">
                          → {item.log.targetName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {new Date(item.log.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "ja-JP", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                {t.noActivity}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Staff Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>{t.staffStats}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {staffStats.map((stat) => (
              <div
                key={stat.name}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <span className="font-medium">{stat.name}</span>
                <div className="flex gap-4 text-sm">
                  <span>{t.total}: {stat.total}</span>
                  <span className="text-green-600">{t.completed}: {stat.completed}</span>
                  <span className="text-muted-foreground">
                    {t.completionRate}: {stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t.filters}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>{t.search}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.user}</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder={t.allUsers} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allUsers}</SelectItem>
                  {uniqueUsersFromTasks.map((email) => (
                    <SelectItem key={email} value={email!}>
                      {email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.staff}</Label>
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger>
                  <SelectValue placeholder={t.allStaff} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allStaff}</SelectItem>
                  {uniqueStaff.map((name) => (
                    <SelectItem key={name} value={name!}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.status}</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder={t.allStatus} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allStatus}</SelectItem>
                  <SelectItem value="pending">{t.pending}</SelectItem>
                  <SelectItem value="in_progress">{t.inProgress}</SelectItem>
                  <SelectItem value="completed">{t.completed}</SelectItem>
                  <SelectItem value="cancelled">{language === "zh" ? "已取消" : "キャンセル"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(selectedUser !== "all" ||
            selectedStaff !== "all" ||
            selectedStatus !== "all" ||
            searchTerm !== "") && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedUser("all");
                  setSelectedStaff("all");
                  setSelectedStatus("all");
                  setSearchTerm("");
                }}
              >
                {t.clearFilters}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t.taskList} ({filteredTasks?.length || 0}{t.items})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks && filteredTasks.length > 0 ? (
            <div className="space-y-3">
              {filteredTasks.map((item) => (
                <div
                  key={item.task.id}
                  className="p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/tasks/${item.task.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`${statusColors[item.task.status]} text-white`}
                        >
                          {statusLabels[item.task.status]}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {item.task.taskId}
                        </span>
                      </div>
                      <p className="font-medium">{item.task.taskDetail}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{t.instructor}: {item.user?.email || t.unknown}</span>
                        <span>{t.assignee}: {item.staff?.name || t.unknown}{item.staff?.department && ` - ${item.staff.department}`}</span>
                        <span>
                          {t.registered}:{" "}
                          {item.task.startDate
                            ? new Date(item.task.startDate).toLocaleString(language === "zh" ? "zh-CN" : "ja-JP", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : t.unknown}
                        </span>
                        {item.task.deadline && (
                          <span>
                            {t.deadline}:{" "}
                            {new Date(item.task.deadline).toLocaleString(language === "zh" ? "zh-CN" : "ja-JP", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t.noTasks}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
