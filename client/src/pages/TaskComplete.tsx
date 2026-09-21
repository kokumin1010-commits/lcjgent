import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRoute } from "wouter";

export default function TaskComplete() {
  const [, params] = useRoute("/complete/:token");
  const token = params?.token || "";
  const [completed, setCompleted] = useState(false);

  const completeMutation = trpc.completion.completeByToken.useMutation({
    onSuccess: (data) => {
      setCompleted(true);
    },
  });

  useEffect(() => {
    if (token && !completed && !completeMutation.isPending) {
      completeMutation.mutate({ token });
    }
  }, [token]);

  if (completeMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <CardTitle>処理中...</CardTitle>
            <CardDescription>タスクを完了しています</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (completeMutation.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>エラーが発生しました</CardTitle>
            <CardDescription>
              {completeMutation.error?.message || "タスクの完了処理に失敗しました"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              リンクが無効か、既に使用されている可能性があります。
            </p>
            <Button variant="outline" onClick={() => window.close()}>
              閉じる
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completeMutation.isSuccess && completeMutation.data) {
    const { alreadyCompleted, task } = completeMutation.data;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>
              {alreadyCompleted ? "既に完了済みです" : "タスクを完了しました"}
            </CardTitle>
            <CardDescription>
              {alreadyCompleted
                ? "このタスクは既に完了報告されています"
                : "完了報告を受け付けました"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {task && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">タスク詳細</p>
                <p className="text-sm text-muted-foreground">{task.taskDetail}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  タスクID: {task.taskId}
                </p>
              </div>
            )}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {alreadyCompleted
                  ? "このウィンドウを閉じてください。"
                  : "管理者に完了通知が送信されました。"}
              </p>
              <Button onClick={() => window.close()}>閉じる</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
