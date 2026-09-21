import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRoute } from "wouter";

export default function TaskComplete() {
  const [, params] = useRoute("/complete/:token");
  const token = params?.token || "";
  const [resolved, setResolved] = useState(false);

  const completeMutation = trpc.completion.completeByToken.useMutation({
    onSuccess: () => setResolved(true),
  });

  useEffect(() => {
    if (token && !resolved && !completeMutation.isPending) {
      completeMutation.mutate({ token });
    }
  }, [token]);

  if (completeMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <CardTitle>確認中...</CardTitle>
            <CardDescription>タスクフィードバック画面を準備しています</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (completeMutation.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>リンクを確認できません</CardTitle>
            <CardDescription>{completeMutation.error?.message || "リンクが無効です"}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => window.close()}>閉じる</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completeMutation.isSuccess && completeMutation.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ClipboardCheck className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <CardTitle>本人の実行フィードバックを提出してください</CardTitle>
            <CardDescription>
              複数担当者の実績と积分を正しく記録するため、ログイン後に進行中・受阻・完了と実行内容を報告します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => window.location.assign(`/master/tasks/${completeMutation.data.taskId}`)}
            >
              ログインしてタスクを開く
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
