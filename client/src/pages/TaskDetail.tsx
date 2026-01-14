import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Mail, CheckCircle2, Trash2 } from "lucide-react";
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
import { useState } from "react";

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

interface TaskDetailProps {
  taskId: number;
}

export default function TaskDetail({ taskId }: TaskDetailProps) {
  const [, setLocation] = useLocation();
  const [newStatus, setNewStatus] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: taskData, isLoading } = trpc.task.getById.useQuery({ id: taskId });
  const { data: reminders } = trpc.task.getReminders.useQuery({ taskId });
  const { data: assignedStaff } = trpc.task.getStaffByTaskId.useQuery({ taskId });

  const sendReminderMutation = trpc.task.sendReminder.useMutation({
    onSuccess: () => {
      toast.success("リマインドメールを送信しました");
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
      toast.success("タスクを削除しました");
      setLocation("/tasks");
    },
    onError: (error) => {
      toast.error("タスクの削除に失敗しました", {
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
          <Button variant="ghost" size="icon" onClick={() => setLocation("/tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">タスクが見つかりません</h1>
        </div>
      </div>
    );
  }

  const { task, staff } = taskData;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">タスク詳細</h1>
            <p className="text-muted-foreground mt-2">タスクID: {task.taskId}</p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              削除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>タスクを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作は取り消せません。タスクとその関連データが完全に削除されます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTaskMutation.mutate({ id: taskId })}>
                削除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
              {assignedStaff && assignedStaff.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {assignedStaff.map((item, index) => (
                    <div key={index} className="border-l-2 border-primary pl-3">
                      <p className="font-medium">{item.staff?.name || "不明"}</p>
                      {item.staff?.department && (
                        <p className="text-sm text-muted-foreground">{item.staff.department}</p>
                      )}
                      <p className="text-sm text-muted-foreground">{item.staff?.email}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2">
                  <p className="font-medium">{staff?.name || "不明"}</p>
                  {staff?.department && (
                    <p className="text-sm text-muted-foreground">{staff.department}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{staff?.email}</p>
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
                    <SelectItem value="completed">完了</SelectItem>
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
              onClick={() => sendReminderMutation.mutate({ taskId })}
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
          </CardContent>
        </Card>
      </div>

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
