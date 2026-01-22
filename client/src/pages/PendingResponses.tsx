import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, Clock, MessageSquare, X } from "lucide-react";
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
} from "@/components/ui/alert-dialog";

export default function PendingResponses() {

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "respond" | "cancel";
    messageId?: string;
    groupId?: string;
    groupName?: string;
  }>({ open: false, type: "respond" });

  const { data: pendingResponses, isLoading, refetch } = trpc.line.getPendingResponses.useQuery();

  const markAsRespondedMutation = trpc.line.markAsResponded.useMutation({
    onSuccess: () => {
      toast.success("対応完了", {
        description: "メッセージを対応済みとしてマークしました。",
      });
      refetch();
    },
    onError: (error) => {
      toast.error("エラー", {
        description: error.message,
      });
    },
  });

  const cancelPendingMutation = trpc.line.cancelPendingResponse.useMutation({
    onSuccess: () => {
      toast.success("キャンセル完了", {
        description: "要対応フラグを解除しました。",
      });
      refetch();
    },
    onError: (error) => {
      toast.error("エラー", {
        description: error.message,
      });
    },
  });

  const handleMarkAsResponded = (groupId: string, groupName: string) => {
    setConfirmDialog({
      open: true,
      type: "respond",
      groupId,
      groupName,
    });
  };

  const handleCancelPending = (messageId: string, groupName: string) => {
    setConfirmDialog({
      open: true,
      type: "cancel",
      messageId,
      groupName,
    });
  };

  const confirmAction = () => {
    if (confirmDialog.type === "respond" && confirmDialog.groupId) {
      markAsRespondedMutation.mutate({ lineGroupId: confirmDialog.groupId });
    } else if (confirmDialog.type === "cancel" && confirmDialog.messageId) {
      cancelPendingMutation.mutate({ messageId: confirmDialog.messageId });
    }
    setConfirmDialog({ open: false, type: "respond" });
  };

  const getElapsedTimeColor = (hours: number) => {
    if (hours >= 24) return "text-red-500";
    if (hours >= 12) return "text-orange-500";
    if (hours >= 6) return "text-yellow-500";
    return "text-green-500";
  };

  const formatElapsedTime = (hours: number) => {
    if (hours < 1) return "1時間未満";
    if (hours < 24) return `${hours}時間`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}日`;
    return `${days}日${remainingHours}時間`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">要対応メッセージ</h1>
          <p className="text-muted-foreground">返事が必要なメッセージの一覧</p>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasPending = pendingResponses && pendingResponses.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">要対応メッセージ</h1>
          <p className="text-muted-foreground">返事が必要なメッセージの一覧</p>
        </div>
        {hasPending && (
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {pendingResponses.length}件
          </Badge>
        )}
      </div>

      {!hasPending ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium">すべて対応済みです</h3>
            <p className="text-muted-foreground">現在、返事が必要なメッセージはありません。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingResponses.map((item) => (
            <Card key={item.messageId} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      {item.groupName}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span>{item.senderName || "不明"}</span>
                      <span>•</span>
                      <span className={`flex items-center gap-1 ${getElapsedTimeColor(item.elapsedHours)}`}>
                        <Clock className="h-3 w-3" />
                        {formatElapsedTime(item.elapsedHours)}経過
                      </span>
                      {item.reminderCount > 0 && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">
                            リマインド{item.reminderCount}回
                          </Badge>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelPending(item.messageId, item.groupName)}
                      disabled={cancelPendingMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      解除
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleMarkAsResponded(item.lineGroupId!, item.groupName)}
                      disabled={markAsRespondedMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      対応済み
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                </div>
                {item.responseSummary && (
                  <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{item.responseSummary}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === "respond" ? "対応済みとしてマーク" : "要対応フラグを解除"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === "respond"
                ? `「${confirmDialog.groupName}」のすべての要対応メッセージを対応済みとしてマークします。リマインドは停止されます。`
                : `このメッセージの要対応フラグを解除します。リマインドは停止されます。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              {confirmDialog.type === "respond" ? "対応済みにする" : "解除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
