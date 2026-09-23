import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  groupTasksByPerson,
  isTaskUnfinishedForPerson,
} from "@shared/taskPersonGrouping";
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
  const initialTab: TaskTab =
    requestedStatus &&
    ["pending", "in_progress", "completed", "cancelled"].includes(
      requestedStatus
    )
      ? (requestedStatus as TaskStatus)
      : "all";
  const [activeTab, setActiveTab] = useState<TaskTab>(initialTab);
  const [selectedPersonKey, setSelectedPersonKey] = useState("all");
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [completingTaskKey, setCompletingTaskKey] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const {
    data: feed,
    isLoading,
    isFetching,
  } = trpc.task.feed.useQuery({
    searchTerm,
    status: activeTab,
  });

  const syncReports = trpc.report.batchExtractFollowups.useMutation({
    onSuccess: result => {
      toast.success(
        `日報から${result.totalCreated}件を追加し、旧タスク${result.totalAutoCompleted}件を完了にしました`
      );
      utils.task.feed.invalidate();
    },
    onError: error => {
      toast.error("日報タスクの同期に失敗しました", {
        description: error.message,
      });
    },
  });

  const completeManualTask = trpc.task.submitExecutionFeedback.useMutation();
  const completeReportTask = trpc.task.completeOwnReportFollowup.useMutation();

  const counts = feed?.counts || {
    all: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };
  const items = feed?.items || [];

  const markItemCompleted = async (item: (typeof items)[number]) => {
    if (
      !item.canSubmitFeedback ||
      item.status === "completed" ||
      item.status === "cancelled" ||
      item.executionSummary?.ownStatus === "completed"
    ) return;
    setCompletingTaskKey(item.key);
    try {
      if (item.source === "manual") {
        await completeManualTask.mutateAsync({
          requestId: crypto.randomUUID(),
          taskId: item.id,
          status: "completed",
          feedbackNote: "员工在任务列表中勾选已完成",
        });
      } else {
        await completeReportTask.mutateAsync({
          id: item.id,
          resultNote: "员工在任务列表中勾选已完成",
        });
      }
      toast.success("任务已完成，已移入完成记录");
      await utils.task.feed.invalidate();
    } catch (error) {
      toast.error("任务完成操作失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setCompletingTaskKey(null);
    }
  };

  const personGroups = useMemo(() => groupTasksByPerson(items), [items]);

  const effectivePersonKey =
    selectedPersonKey === "all" ||
    personGroups.some(group => group.key === selectedPersonKey)
      ? selectedPersonKey
      : "all";
  const visibleGroups =
    effectivePersonKey === "all"
      ? personGroups
      : personGroups.filter(group => group.key === effectivePersonKey);
  const allVisibleExpanded =
    visibleGroups.length > 0 &&
    visibleGroups.every(group => expandedGroupKeys.has(group.key));

  const toggleGroup = (key: string) => {
    setExpandedGroupKeys(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllVisibleGroups = () => {
    setExpandedGroupKeys(current => {
      const next = new Set(current);
      if (allVisibleExpanded) {
        for (const group of visibleGroups) next.delete(group.key);
      } else {
        for (const group of visibleGroups) next.add(group.key);
      }
      return next;
    });
  };

  const selectPerson = (value: string) => {
    setSelectedPersonKey(value);
    if (value !== "all") {
      setExpandedGroupKeys(current => new Set(current).add(value));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">タスク一覧</h1>
          <p className="mt-2 text-muted-foreground">
            担当者ごとに進行状況をまとめ、必要な人だけ展開して確認できます
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
            日報を保存・更新すると、AIは前回までの未完了タスクを先に照合し、今回の日報に明確な完了事実があるものを完了へ移します。
            その後、新しい未完了行動だけを「日報分析」タスクとして追加します。既存の日報は「過去30日の日報を同期」で日付順に補完できます。
          </p>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="flex gap-3 p-4 text-sm text-emerald-950">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            负责人或同事指派后，执行人会收到邮件并在此看到任务。执行人需提交“进行中／受阻／完成”反馈；
            每人的完成率与按期完成率会作为绩效积分事实（当前为影子评分，不自动影响奖金或LCJ
            Coin）。
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="タスク内容や担当者名で検索..."
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={effectivePersonKey} onValueChange={selectPerson}>
            <SelectTrigger className="w-[220px] bg-background">
              <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="负责人筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                全部负责人（{personGroups.length}人）
              </SelectItem>
              {personGroups.map(group => (
                <SelectItem key={group.key} value={group.key}>
                  {group.name}（{group.items.length}项）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleAllVisibleGroups}
            disabled={visibleGroups.length === 0}
          >
            {allVisibleExpanded ? "全部收起" : "全部展开"}
          </Button>
          {isFetching && !isLoading && (
            <Loader2
              className="h-4 w-4 animate-spin text-muted-foreground"
              aria-label="更新中"
            />
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as TaskTab)}
      >
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="all">すべて ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending">保留中 ({counts.pending})</TabsTrigger>
          <TabsTrigger value="in_progress">
            進行中 ({counts.in_progress})
          </TabsTrigger>
          <TabsTrigger value="completed">完了 ({counts.completed})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : visibleGroups.length > 0 ? (
            <div className="space-y-3" data-testid="task-person-groups">
              <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
                <span>按负责人分组 · {visibleGroups.length}人</span>
                <span>多人任务会分别显示在每位执行人名下</span>
              </div>
              {visibleGroups.map(group => {
                const expanded = expandedGroupKeys.has(group.key);
                return (
                  <Card key={group.key} className="overflow-hidden">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={expanded}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {group.staffId == null ? (
                          <Users className="h-5 w-5" />
                        ) : (
                          <UserRound className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{group.name}</span>
                          {group.department && (
                            <span className="text-sm text-muted-foreground">
                              {group.department}
                            </span>
                          )}
                          <Badge variant="secondary">
                            {group.items.length}项
                          </Badge>
                          {group.unfinishedCount > 0 && (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600"
                              data-testid="task-person-unfinished-marker"
                            >
                              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                              未完成 {group.unfinishedCount}项
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>保留 {group.counts.pending}</span>
                          <span className="text-blue-600">
                            进行中 {group.counts.in_progress}
                          </span>
                          <span className="text-green-600">
                            完成 {group.counts.completed}
                          </span>
                          {group.counts.blocked > 0 && (
                            <span className="font-medium text-red-600">
                              受阻 {group.counts.blocked}
                            </span>
                          )}
                        </div>
                      </div>
                      {expanded ? (
                        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                    </button>

                    {expanded && (
                      <CardContent className="border-t bg-muted/20 p-3 sm:p-4">
                        <div className="grid gap-3">
                          {group.items.map(item => (
                            <Card
                              key={`${group.key}:${item.key}`}
                              className="cursor-pointer border bg-background transition-shadow hover:shadow-sm"
                              onClick={() => setLocation(item.href)}
                            >
                              <CardHeader className="p-4 pb-2">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                      <Badge
                                        variant={
                                          item.source === "daily_report"
                                            ? "default"
                                            : "outline"
                                        }
                                      >
                                        {item.source === "daily_report"
                                          ? "日報分析"
                                          : "手動登録"}
                                      </Badge>
                                      {item.category && (
                                        <Badge variant="secondary">
                                          {item.category}
                                        </Badge>
                                      )}
                                      <Badge
                                        variant="secondary"
                                        className={`${statusColors[item.status]} text-white`}
                                      >
                                        {statusLabels[item.status]}
                                      </Badge>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      {isTaskUnfinishedForPerson(item, group.key) && (
                                          <span
                                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                                            data-testid="task-unfinished-dot"
                                            aria-label="未完成任务"
                                          />
                                        )}
                                      <CardTitle className="break-words text-base">
                                        {item.title}
                                      </CardTitle>
                                    </div>
                                    {item.assignees.length > 1 && (
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        共同执行：
                                        {item.assignees
                                          .map(person => person.name)
                                          .join("、")}
                                      </p>
                                    )}
                                    {item.executionSummary && (
                                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                                        <Badge
                                          variant="outline"
                                          className="border-emerald-300 text-emerald-700"
                                        >
                                          执行反馈{" "}
                                          {item.executionSummary.completedCount}
                                          /{item.executionSummary.assignedCount}{" "}
                                          完成
                                        </Badge>
                                        {item.executionSummary.blockedCount >
                                          0 && (
                                          <Badge
                                            variant="outline"
                                            className="border-red-300 text-red-700"
                                          >
                                            <CircleAlert className="mr-1 h-3 w-3" />
                                            {item.executionSummary.blockedCount}
                                            人受阻
                                          </Badge>
                                        )}
                                        {item.canSubmitFeedback &&
                                          item.executionSummary.ownStatus && (
                                            <span className="text-muted-foreground">
                                              我的反馈:{" "}
                                              {item.executionSummary
                                                .ownStatus === "completed"
                                                ? "已完成"
                                                : item.executionSummary
                                                      .ownStatus === "blocked"
                                                  ? "受阻"
                                                  : item.executionSummary
                                                        .ownStatus ===
                                                      "in_progress"
                                                    ? "进行中"
                                                    : "待反馈"}
                                            </span>
                                          )}
                                      </div>
                                    )}
                                  </div>
                                  {item.canSubmitFeedback &&
                                    item.status !== "completed" &&
                                    item.status !== "cancelled" &&
                                    item.executionSummary?.ownStatus !== "completed" && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                        data-testid="task-self-complete"
                                        disabled={completingTaskKey === item.key}
                                        onClick={event => {
                                          event.stopPropagation();
                                          void markItemCompleted(item);
                                        }}
                                      >
                                        {completingTaskKey === item.key ? (
                                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                        )}
                                        完成にする
                                      </Button>
                                    )}
                                </div>
                              </CardHeader>
                              <CardContent className="p-4 pt-1">
                                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                  <span>
                                    {item.source === "daily_report"
                                      ? "日報日"
                                      : "登録日時"}
                                    :{" "}
                                    {item.source === "daily_report"
                                      ? formatDate(item.reportDate)
                                      : formatDateTime(item.startDate)}
                                  </span>
                                  {item.deadline && (
                                    <span>
                                      期限: {formatDate(item.deadline)}
                                    </span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
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
