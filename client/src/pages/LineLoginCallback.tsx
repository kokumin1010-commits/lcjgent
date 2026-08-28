import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

function classifyLoginError(message: string): string {
  if (message.includes("有効期限") || message.includes("認証情報が不足")) return "LINE-STATE-EXPIRED";
  if (message.includes("プロフィール")) return "LINE-PROFILE-FAILED";
  if (message.includes("キャンセル")) return "LINE-CANCELLED";
  return "LINE-AUTH-FAILED";
}

export default function LineLoginCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const callbackMutation = trpc.lineLogin.callback.useMutation({
    onSuccess: (data) => {
      if (data.sessionToken) {
        localStorage.setItem("lcj_session_token", data.sessionToken);
      }
      setStatus("success");
      window.setTimeout(() => {
        window.location.replace("/mypage");
      }, 800);
    },
    onError: (error) => {
      const message = error.message || "ログインに失敗しました";
      localStorage.removeItem("lcj_session_token");
      setStatus("error");
      setErrorMessage(message);
      setErrorCode(classifyLoginError(message));
    },
  });

  useEffect(() => {
    const urlObj = new URL(window.location.href);
    const hashParams = new URLSearchParams(urlObj.hash.startsWith("#") ? urlObj.hash.slice(1) : "");
    const code = urlObj.searchParams.get("code") || hashParams.get("code");
    const state = urlObj.searchParams.get("state") || hashParams.get("state");
    const oauthError = urlObj.searchParams.get("error") || hashParams.get("error");

    // A new OAuth callback must never inherit a stale fallback session.
    localStorage.removeItem("lcj_session_token");

    if (oauthError) {
      setStatus("error");
      setErrorMessage("LINEログインがキャンセルされました");
      setErrorCode("LINE-CANCELLED");
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("認証情報が不足しています。もう一度ログインしてください");
      setErrorCode("LINE-STATE-EXPIRED");
      return;
    }

    callbackMutation.mutate({ code, state });
  }, []);

  const retryLogin = () => {
    localStorage.removeItem("lcj_session_token");
    window.location.replace("/line-login?retry=1");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-16 w-16 text-rose-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">ログイン中...</h1>
            <p className="text-muted-foreground">LINEアカウントとポイント情報を確認しています</p>
            <p className="text-xs text-muted-foreground mt-3">この画面を閉じずにお待ちください</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">ログイン成功</h1>
            <p className="text-muted-foreground mb-4">ポイント情報を引き継いでマイページに移動します</p>
            <Button onClick={() => window.location.replace("/mypage")} className="bg-rose-500 hover:bg-rose-600">
              今すぐマイページへ
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">ログインを完了できませんでした</h1>
            <p className="text-muted-foreground mb-2">{errorMessage}</p>
            <p className="text-xs text-muted-foreground mb-5">エラー番号: {errorCode}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => setLocation("/")}>
                トップページへ
              </Button>
              <Button onClick={retryLogin} className="bg-[#06C755] hover:bg-[#05b04c]">
                <RotateCcw className="h-4 w-4 mr-2" />
                LINEログインをやり直す
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              同じ画面が続く場合は、上のエラー番号と発生時刻をスタッフへお知らせください。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
