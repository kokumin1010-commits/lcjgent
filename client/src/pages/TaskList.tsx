import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CircleAlert, FileText, Loader2, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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

type TaskStatus = keyof typeof statusLabels;
type TaskTab = "all" | TaskStatus;

const formatDateTime = (value: Date | string | number | null) => {
  if (!value) return "不明";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "不明";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value: Date | string | number | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default function TaskList() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const urlParams = new URLSearchParams(window.location.search);
  const requestedStatus = urlParams.get("status");
  const initialTab: TaskTab = requestedStatus && ["pending", "in_progress", "completed", "cancelled"].includes(requestedStatus)
    ? requestedStatus as TaskStatus
    : "all";
  const [activeTab, setActiveTab] = useState<TaskTab>(initialTab);
  const utils = trpc.useUtils();

  const { data: feed, isLoading, isFetching } = trpc.task.feed.useQuery({
    searchTerm,
    status: activeTab,
  });

  const syncReports = trpc.report.batchExtractFollowups.useMutation({
    onSuccess: result => {
      toast.success(`日報から${result.totalCreated}件のタスクを追加しました`);
      utils.task.feed.invalidate();
    },
    onError: error => {
      toast.error("日報タスクの同期に失敗しました", {
        description: error.message,
      });
    },
  });

  const counts = feed?.counts || {
    all: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };
  const items = feed?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">タスク一覧</h1>
          <p className="mt-2 text-muted-foreground">
            手動登録タスクと日報分析から抽出されたタスクをまとめて管理します
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => syncReports.mutate({ days: 30, language: "ja" })}
            disabled={syncReports.isPending}
          >
            {syncReports.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            過去30日の日報を同期
          </Button>
          <Button onClick={() => setLocation("/master/tasks/create")}>
            <Plus className="mr-2 h-4 w-4" />
            新規タスク登録
          </Button>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="flex gap-3 p-4 text-sm text-blue-900">
          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            今後保存・更新される日報はAIが自動分析し、未完了の具体的な行動だけを「日報分析」タスクとして追加します。
            既存の日報は「過去30日の日報を同期」で補完できます。
          </p>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="flex gap-3 p-4 text-sm text-emerald-950">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            负责人或同事指派后，执行人会收到邮件并在此看到任务。执行人需提交“进行中／受阻／完成”反馈；
            每人的完成率与按期完成率会作为绩效积分事实（当前为影子评分，不自动影响奖金或LCJ Coin）。
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="タスク内容や担当者名で検索..."
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="pl-9"
          />
        </div>
        {isFetching && !isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="更新中" />
        )}
      </div>

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as TaskTab)}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="all">すべて ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending">保留中 ({counts.pending})</TabsTrigger>
          <TabsTrigger value="in_progress">進行中 ({counts.in_progress})</TabsTrigger>
          <TabsTrigger value="completed">完了 ({counts.completed})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : items.length > 0 ? (
            <div className="grid gap-4">
              {items.map(item => (
                <Card
                  key={item.key}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setLocation(item.href)}
                >
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant={item.source === "daily_report" ? "default" : "outline"}>
                            {item.source === "daily_report" ? "日報分析" : "手動登録"}
                          </Badge>
                          {item.category && <Badge variant="secondary">{item.category}</Badge>}
                        </div>
                        <CardTitle className="break-words text-lg">{item.title}</CardTitle>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`${statusColors[item.status]} text-white`}
                          >
                            {statusLabels[item.status]}
                          </Badge>
                          {item.staff ? (
                            <span className="text-sm text-muted-foreground">
                              担当: {item.staff.name}
                              {item.staff.department && ` - ${item.staff.department}`}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">担当: 不明</span>
                          )}
                        </div>
                        {item.executionSummary && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                              执行反馈 {item.executionSummary.completedCount}/{item.executionSummary.assignedCount} 完成
                            </Badge>
                            {item.executionSummary.blockedCount > 0 && (
                              <Badge variant="outline" className="border-red-300 text-red-700">
                                <CircleAlert className="mr-1 h-3 w-3" />
                                {item.executionSummary.blockedCount}人受阻
                              </Badge>
                            )}
                            {item.canSubmitFeedback && item.executionSummary.ownStatus && (
                              <span className="text-muted-foreground">
                                我的反馈: {item.executionSummary.ownStatus === "completed"
                                  ? "已完成"
                                  : item.executionSummary.ownStatus === "blocked"
                                    ? "受阻"
                                    : item.executionSummary.ownStatus === "in_progress"
                                      ? "进行中"
                                      : "待反馈"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {item.source === "daily_report" ? "日報日" : "登録日時"}: {item.source === "daily_report"
                          ? formatDate(item.reportDate)
                          : formatDateTime(item.startDate)}
                      </span>
                      {item.deadline && <span>期限: {formatDate(item.deadline)}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex min-h-[400px] items-center justify-center">
                <p className="text-muted-foreground">タスクが見つかりません</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
