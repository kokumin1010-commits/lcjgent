import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LineLoginCallback() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const callbackMutation = trpc.lineLogin.callback.useMutation({
    onSuccess: () => {
      setStatus("success");
      // Redirect to mypage after 2 seconds
      setTimeout(() => {
        setLocation("/mypage");
      }, 2000);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message || "ログインに失敗しました");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setErrorMessage("LINEログインがキャンセルされました");
      return;
    }

    if (code && state) {
      callbackMutation.mutate({ code, state });
    } else {
      setStatus("error");
      setErrorMessage("認証情報が不足しています");
    }
  }, [search]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-16 w-16 text-rose-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">ログイン中...</h1>
            <p className="text-muted-foreground">LINEアカウントを確認しています</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">ログイン成功！</h1>
            <p className="text-muted-foreground mb-4">マイページに移動します...</p>
            <Button onClick={() => setLocation("/mypage")} className="bg-rose-500 hover:bg-rose-600">
              今すぐマイページへ
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">ログイン失敗</h1>
            <p className="text-muted-foreground mb-4">{errorMessage}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setLocation("/")}>
                トップページへ
              </Button>
              <Button onClick={() => setLocation("/line-login")} className="bg-[#06C755] hover:bg-[#05b04c]">
                再度ログイン
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
