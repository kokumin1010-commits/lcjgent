import { trpc } from "@/lib/trpc";
import { safeHttpUrlOrNull } from "@shared/safeHttpUrl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Mail, CheckCircle2, Trash2, FolderKanban } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRef, useState } from "react";

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

const executionStatusLabels = {
  pending: "待反馈",
  in_progress: "进行中",
  blocked: "受阻",
  completed: "已完成",
  cancelled: "已取消",
};

interface TaskDetailProps {
  taskId: number;
}

export default function TaskDetail({ taskId }: TaskDetailProps) {
  const [, setLocation] = useLocation();
  const [newStatus, setNewStatus] = useState<string>("");
  const [feedbackStatus, setFeedbackStatus] = useState<"in_progress" | "blocked" | "completed">("in_progress");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [feedbackRequestId, setFeedbackRequestId] = useState(() => crypto.randomUUID());
  const reviewAttemptsRef = useRef(new Map<string, { requestId: string; decisionNote: string }>());

  const utils = trpc.useUtils();
  const { data: taskData, isLoading } = trpc.task.getById.useQuery({ id: taskId });
  const canManage = Boolean(taskData?.execution.canManage);
  const { data: reminders } = trpc.task.getReminders.useQuery({ taskId }, { enabled: canManage });
  const { data: emailTracking } = trpc.task.getEmailTracking.useQuery({ taskId }, { enabled: canManage });

  const feedbackMutation = trpc.task.submitExecutionFeedback.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(variables.status === "completed"
        ? "完成申报已提交，等待负责人确认"
        : "执行反馈已提交");
      setFeedbackNote("");
      setEvidenceUrl("");
      setFeedbackRequestId(crypto.randomUUID());
      utils.task.getById.invalidate({ id: taskId });
      utils.task.feed.invalidate();
    },
    onError: error => {
      toast.error("执行反馈提交失败", { description: error.message });
    },
  });

  const reviewCompletionMutation = trpc.task.reviewCompletion.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(variables.decision === "accepted" ? "已确认验收" : "已退回执行人重新处理");
      utils.task.getById.invalidate({ id: taskId });
      utils.task.feed.invalidate();
    },
    onError: error => {
      toast.error("验收操作失败", { description: error.message });
    },
  });

  const sendReminderMutation = trpc.task.sendReminder.useMutation({
    onSuccess: () => {
      toast.success("リマインドを送信キューに登録しました");
      utils.task.getReminders.invalidate({ taskId });
    },
    onError: (error) => {
      toast.error("リマインドメールの送信に失敗しました", {
        description: error.message,
      });
    },
  });

  const updateTaskMutation = trpc.task.update.useMutation({
    onSuccess: () => {
      toast.success("タスクのステータスを更新しました");
      utils.task.getById.invalidate({ id: taskId });
      utils.task.list.invalidate();
    },
    onError: (error) => {
      toast.error("タスクの更新に失敗しました", {
        description: error.message,
      });
    },
  });

  const deleteTaskMutation = trpc.task.delete.useMutation({
    onSuccess: () => {
      toast.success("タスクをアーカイブしました");
      setLocation("/master/tasks");
    },
    onError: (error) => {
      toast.error("タスクのアーカイブに失敗しました", {
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!taskData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/master/tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">タスクが見つかりません</h1>
        </div>
      </div>
    );
  }

  const { task, staff } = taskData;
  const lcjBrainProjectId = /LCJB-(\d+)-/.exec(task.taskId)?.[1] || null;

  const handleStatusUpdate = async () => {
    if (!newStatus) {
      toast.error("ステータスを選択してください");
      return;
    }
    await updateTaskMutation.mutateAsync({
      id: taskId,
      status: newStatus as any,
    });
    setNewStatus("");
  };

  const handleReviewCompletion = async (
    assignment: (typeof taskData.execution.assignments)[number],
    decision: "accepted" | "returned",
  ) => {
    if (!assignment.feedbackId || !assignment.canReviewCompletion) return;
    const operationKey = `${taskId}:${assignment.staffId}:${assignment.feedbackId}:${decision}`;
    let attempt = reviewAttemptsRef.current.get(operationKey);
    if (!attempt) {
      const decisionNote = decision === "returned"
        ? (window.prompt("请输入退回原因，执行人会据此重新处理") || "").trim()
        : "负责人在任务详情确认验收";
      if (decision === "returned" && decisionNote.length < 2) return;
      attempt = { requestId: crypto.randomUUID(), decisionNote };
      reviewAttemptsRef.current.set(operationKey, attempt);
    }
    try {
      await reviewCompletionMutation.mutateAsync({
        source: "manual",
        id: taskId,
        staffId: assignment.staffId,
        completionVersion: assignment.feedbackId,
        decision,
        decisionNote: attempt.decisionNote,
        requestId: attempt.requestId,
      });
      reviewAttemptsRef.current.delete(operationKey);
    } catch {
      // The mutation's onError shows the message; retain the request id for a safe retry.
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/master/tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">タスク詳細</h1>
            <p className="text-muted-foreground mt-2">タスクID: {task.taskId}</p>
          </div>
        </div>
        {!lcjBrainProjectId && taskData.execution.canManage && <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              アーカイブ
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>タスクをアーカイブしますか？</AlertDialogTitle>
              <AlertDialogDescription>
                一覧から非表示にしますが、担当者・実行フィードバック・証拠・积分監査履歴は削除しません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTaskMutation.mutate({ id: taskId })}>
                アーカイブ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">ステータス</Label>
              <div className="mt-1">
                <Badge className={`${statusColors[task.status]} text-white`}>
                  {statusLabels[task.status]}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">担当者</Label>
              {taskData.execution.assignments.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {taskData.execution.assignments.map(item => (
                    <div key={item.staffId} className="border-l-2 border-primary pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.staffName}</p>
                        <Badge variant="outline">
                          {executionStatusLabels[item.status]}
                        </Badge>
                        {item.status === "completed" && item.reviewDecision == null && task.requiresAcceptance && (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">待负责人确认</Badge>
                        )}
                        {item.reviewDecision === "accepted" && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">已确认</Badge>
                        )}
                        {item.reviewDecision === "returned" && (
                          <Badge variant="destructive">已退回</Badge>
                        )}
                      </div>
                      {item.department && (
                        <p className="text-sm text-muted-foreground">{item.department}</p>
                      )}
                      {item.feedbackNote && (
                        <p className="mt-1 whitespace-pre-wrap text-sm">{item.feedbackNote}</p>
                      )}
                      {item.reviewDecision === "returned" && item.reviewNote && (
                        <p className="mt-2 rounded-md bg-red-50 px-2.5 py-2 text-sm text-red-700">
                          退回原因：{item.reviewNote}
                        </p>
                      )}
                      {item.canReviewCompletion && item.feedbackId && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={reviewCompletionMutation.isPending}
                            onClick={() => handleReviewCompletion(item, "accepted")}
                          >
                            {reviewCompletionMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                            确认验收
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50"
                            disabled={reviewCompletionMutation.isPending}
                            onClick={() => handleReviewCompletion(item, "returned")}
                          >
                            退回
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2">
                  <p className="font-medium">{staff?.name || "不明"}</p>
                  {staff?.department && (
                    <p className="text-sm text-muted-foreground">{staff.department}</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">登録日時</Label>
              <p className="mt-1">
                {task.startDate
                  ? new Date(task.startDate).toLocaleString("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "不明"}
              </p>
            </div>
            {task.deadline && (
              <div>
                <Label className="text-muted-foreground">期限</Label>
                <p className="mt-1">
                  {new Date(task.deadline).toLocaleString("ja-JP", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </p>
              </div>
            )}
            {task.notes && (
              <div>
                <Label className="text-muted-foreground">メモ</Label>
                <p className="mt-1 whitespace-pre-wrap">{task.notes}</p>
              </div>
            )}
            {emailTracking && emailTracking.length > 0 && (
              <div>
                <Label className="text-muted-foreground">メール開封状況</Label>
                <div className="mt-2 space-y-2">
                  {emailTracking.map((tracking, index) => (
                    <div key={index} className="border-l-2 border-blue-500 pl-3">
                      {tracking.openedAt ? (
                        <>
                          <p className="text-sm font-medium text-green-600">✅ 開封済み</p>
                          <p className="text-xs text-muted-foreground">
                            開封日時: {new Date(tracking.openedAt).toLocaleString("ja-JP", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            開封回数: {tracking.openCount}回
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">❔ 未開封</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {task.completedAt && (
              <div>
                <Label className="text-muted-foreground">完了日時</Label>
                <p className="mt-1">
                  {task.completedAt
                    ? new Date(task.completedAt).toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "不明"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>アクション</CardTitle>
            <CardDescription>タスクに対する操作を実行できます</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lcjBrainProjectId ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  这是LCJ Brain执行计划任务。请在项目中查看资料准备方法、提交完成证据，并由指定验收人确认；任务列表不能直接完成或删除。
                </p>
                <Button
                  className="w-full"
                  onClick={() =>
                    setLocation(
                      `/master/lcj-brain?tab=projects&projectId=${lcjBrainProjectId}`
                    )
                  }
                >
                  <FolderKanban className="mr-2 h-4 w-4" />
                  进入LCJ Brain执行计划
                </Button>
              </div>
            ) : taskData.execution.canManage ? <>
            <div className="space-y-2">
              <Label>ステータス変更</Label>
              <div className="flex gap-2">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="新しいステータスを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">保留中</SelectItem>
                    <SelectItem value="in_progress">進行中</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleStatusUpdate}
                  disabled={!newStatus || updateTaskMutation.isPending}
                >
                  {updateTaskMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => sendReminderMutation.mutate({ taskId, requestId: crypto.randomUUID() })}
              disabled={sendReminderMutation.isPending || task.status === "completed"}
            >
              {sendReminderMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  リマインドメールを送信
                </>
              )}
            </Button>
            </> : (
              <p className="text-sm text-muted-foreground">
                任务内容与整体状态由布置人或负责人管理；执行人请在下方提交本人反馈。
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {taskData.execution.canSubmitFeedback && !lcjBrainProjectId && (
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle>提交我的执行反馈</CardTitle>
            <CardDescription>
              本人反馈会保留历史，并用于计算每月任务完成率与按期完成率；“已完成”提交后等待负责人确认，确认后才计入完成率。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>执行状态</Label>
              <Select value={feedbackStatus} onValueChange={value => setFeedbackStatus(value as typeof feedbackStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">进行中</SelectItem>
                  <SelectItem value="blocked">受阻（请说明原因）</SelectItem>
                  <SelectItem value="completed">申报完成（待负责人确认）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="execution-feedback-note">执行内容 / 问题点</Label>
              <Textarea
                id="execution-feedback-note"
                value={feedbackNote}
                onChange={event => setFeedbackNote(event.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="说明已完成的内容、当前进度，或受阻原因"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="execution-evidence-url">完成证据URL（可选）</Label>
              <Input
                id="execution-evidence-url"
                type="url"
                value={evidenceUrl}
                onChange={event => setEvidenceUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <Button
              onClick={() => feedbackMutation.mutate({
                requestId: feedbackRequestId,
                taskId,
                status: feedbackStatus,
                feedbackNote,
                evidenceUrl: evidenceUrl || undefined,
              })}
              disabled={feedbackNote.trim().length < 2 || feedbackMutation.isPending}
            >
              {feedbackMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              提交执行反馈
            </Button>
          </CardContent>
        </Card>
      )}

      {taskData.execution.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>执行反馈记录</CardTitle>
            <CardDescription>最新记录优先；历史反馈不会被覆盖。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {taskData.execution.history.map(entry => {
              const safeEvidenceUrl = safeHttpUrlOrNull(entry.evidenceUrl);
              return (
              <div key={entry.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entry.staffName}</span>
                  <Badge variant="outline">{executionStatusLabels[entry.status]}</Badge>
                  {entry.reviewDecision === "accepted" && (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">已确认</Badge>
                  )}
                  {entry.reviewDecision === "returned" && (
                    <Badge variant="destructive">已退回</Badge>
                  )}
                  {entry.status === "completed" && entry.reviewDecision == null && task.requiresAcceptance && (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">待确认</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {entry.submittedAt ? new Date(entry.submittedAt).toLocaleString("ja-JP") : "-"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{entry.feedbackNote}</p>
                {entry.reviewNote && (
                  <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted px-2.5 py-2 text-sm">
                    验收意见：{entry.reviewNote}
                  </p>
                )}
                {safeEvidenceUrl && (
                  <a
                    href={safeEvidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-primary underline"
                  >
                    完成证据を開く
                  </a>
                )}
              </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>指示内容</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium mb-4">{task.taskDetail}</p>
          {task.extractedContext && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <Label className="text-muted-foreground">詳細コンテキスト</Label>
              <p className="mt-2 text-sm whitespace-pre-wrap">{task.extractedContext}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {((task.screenshotUrls && task.screenshotUrls.length > 0) || task.screenshotUrl) && (
        <Card>
          <CardHeader>
            <CardTitle>スクリーンショット</CardTitle>
          </CardHeader>
          <CardContent>
            {task.screenshotUrls && task.screenshotUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {task.screenshotUrls.map((url, index) => (
                  <div key={index} className="border rounded-lg overflow-hidden">
                    <img src={url} alt={`Screenshot ${index + 1}`} className="w-full h-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <img src={task.screenshotUrl!} alt="Task screenshot" className="w-full h-auto" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {reminders && reminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>リマインド履歴</CardTitle>
            <CardDescription>このタスクに送信されたリマインドメールの履歴</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                  <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{reminder.emailSubject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      送信日時:{" "}
                      {new Date(reminder.sentAt).toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge variant={reminder.status === "sent" ? "default" : "destructive"}>
                    {reminder.status === "sent" ? "送信済み" : "失敗"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
