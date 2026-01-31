import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import liff from "@line/liff";

// LIFF ID for LCJ MALL LINE Login
const LIFF_ID = "2009018493-9HZXJj8d";

export default function LineLogin() {
  const [, setLocation] = useLocation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liffReady, setLiffReady] = useState(false);

  // LIFF callback mutation
  const liffCallbackMutation = trpc.lineLogin.liffCallback.useMutation({
    onSuccess: () => {
      setLocation("/mypage");
    },
    onError: (err) => {
      setError(err.message || "ログインに失敗しました");
      setIsLoggingIn(false);
    },
  });

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        setLiffReady(true);

        // Check if user is already logged in via LIFF
        if (liff.isLoggedIn()) {
          setIsLoggingIn(true);
          const accessToken = liff.getAccessToken();
          if (accessToken) {
            liffCallbackMutation.mutate({ accessToken });
          } else {
            setError("アクセストークンを取得できませんでした");
            setIsLoggingIn(false);
          }
        }
      } catch (err) {
        console.error("LIFF initialization failed:", err);
        setError("LIFFの初期化に失敗しました");
      } finally {
        setIsInitializing(false);
      }
    };

    initLiff();
  }, []);

  const handleLogin = () => {
    if (!liffReady) return;
    
    setIsLoggingIn(true);
    
    // Use LIFF login
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
    } else {
      // Already logged in, get access token
      const accessToken = liff.getAccessToken();
      if (accessToken) {
        liffCallbackMutation.mutate({ accessToken });
      } else {
        setError("アクセストークンを取得できませんでした");
        setIsLoggingIn(false);
      }
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <ShoppingBag className="h-10 w-10 text-rose-500" />
          <span className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
            LCJ MALL
          </span>
        </div>

        <h1 className="text-xl font-bold mb-2">LINEでログイン</h1>
        <p className="text-muted-foreground mb-6">
          LINEアカウントでログインして、ポイント残高の確認やレシート申請履歴を確認できます。
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Button
          size="lg"
          className="w-full bg-[#06C755] hover:bg-[#05b04c] text-white gap-2"
          onClick={handleLogin}
          disabled={isLoggingIn || !liffReady}
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              ログイン中...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              LINEでログイン
            </>
          )}
        </Button>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-muted-foreground mb-4">
            まだLINE友だち追加していない方は
          </p>
          <a href="https://lin.ee/hpVjAiOe" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <svg className="h-4 w-4 text-[#06C755]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              LINE友だち追加
            </Button>
          </a>
        </div>

        <Button
          variant="ghost"
          className="mt-4 text-muted-foreground"
          onClick={() => setLocation("/")}
        >
          トップページに戻る
        </Button>
      </div>
    </div>
  );
}
