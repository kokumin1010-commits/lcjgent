import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, ShoppingBag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import liff from "@line/liff";

// LIFF ID for LCJ MALL LINE Login
const LIFF_ID = "2009018493-9HZXJj8d";

export default function LineLogin() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"initializing" | "ready" | "logging_in" | "error">("initializing");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const hasProcessedLogin = useRef(false);

  const addDebug = (msg: string) => {
    console.log("[LIFF]", msg);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // LIFF callback mutation
  const liffCallbackMutation = trpc.lineLogin.liffCallback.useMutation({
    onSuccess: (data) => {
      addDebug(`Login successful: ${JSON.stringify(data)}`);
      // Wait a bit for cookie to be set, then redirect
      setTimeout(() => {
        window.location.href = "/mypage";
      }, 500);
    },
    onError: (err) => {
      addDebug(`Login error: ${err.message}`);
      setError(err.message || "ログインに失敗しました");
      setStatus("error");
      hasProcessedLogin.current = false;
    },
  });

  useEffect(() => {
    const initLiff = async () => {
      try {
        addDebug(`Starting LIFF initialization with ID: ${LIFF_ID}`);
        
        await liff.init({ liffId: LIFF_ID });
        
        const isLoggedIn = liff.isLoggedIn();
        const isInClient = liff.isInClient();
        
        addDebug(`LIFF initialized. isLoggedIn: ${isLoggedIn}, isInClient: ${isInClient}`);

        // If user is logged in via LIFF and we haven't processed yet
        if (isLoggedIn && !hasProcessedLogin.current) {
          hasProcessedLogin.current = true;
          setStatus("logging_in");
          
          try {
            const accessToken = liff.getAccessToken();
            addDebug(`Access token: ${accessToken ? accessToken.substring(0, 20) + '...' : 'null'}`);
            
            if (accessToken) {
              addDebug("Calling liffCallback mutation...");
              liffCallbackMutation.mutate({ accessToken });
            } else {
              // Access token is null, need to re-login
              addDebug("No access token, logging out and re-login");
              liff.logout();
              setStatus("ready");
              hasProcessedLogin.current = false;
            }
          } catch (tokenError: any) {
            addDebug(`Token error: ${tokenError.message}`);
            // Token might be expired, logout and let user re-login
            liff.logout();
            setStatus("ready");
            hasProcessedLogin.current = false;
          }
        } else {
          setStatus("ready");
        }
      } catch (err: any) {
        addDebug(`LIFF init error: ${err.message || JSON.stringify(err)}`);
        setError(`LIFFの初期化に失敗しました: ${err.message || 'Unknown error'}`);
        setStatus("error");
      }
    };

    initLiff();
  }, []);

  const handleLogin = async () => {
    if (status !== "ready") return;
    
    addDebug("handleLogin called");
    setStatus("logging_in");
    setError(null);
    
    try {
      // Check if already logged in
      if (liff.isLoggedIn()) {
        addDebug("Already logged in, getting access token");
        const accessToken = liff.getAccessToken();
        
        if (accessToken) {
          addDebug(`Got access token: ${accessToken.substring(0, 20)}...`);
          hasProcessedLogin.current = true;
          liffCallbackMutation.mutate({ accessToken });
        } else {
          addDebug("No access token despite being logged in, re-login");
          liff.logout();
          // Start fresh login
          const redirectUri = window.location.origin + "/line-login";
          addDebug(`Starting login with redirectUri: ${redirectUri}`);
          liff.login({ redirectUri });
        }
      } else {
        // Start LIFF login
        addDebug("Not logged in, starting login flow");
        const redirectUri = window.location.origin + "/line-login";
        addDebug(`Login redirectUri: ${redirectUri}`);
        liff.login({ redirectUri });
      }
    } catch (err: any) {
      addDebug(`Login error: ${err.message}`);
      setError(err.message || "ログインに失敗しました");
      setStatus("error");
    }
  };

  const handleRetry = () => {
    // Logout from LIFF and reset state
    try {
      if (liff.isLoggedIn()) {
        liff.logout();
      }
    } catch (e) {
      // Ignore logout errors
    }
    hasProcessedLogin.current = false;
    setError(null);
    setDebugInfo([]);
    setStatus("ready");
  };

  if (status === "initializing") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-rose-500 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (status === "logging_in") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-rose-500 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">ログイン処理中...</p>
          {debugInfo.length > 0 && (
            <details className="mt-4 text-left max-w-md mx-auto">
              <summary className="cursor-pointer text-xs text-muted-foreground">デバッグ情報</summary>
              <pre className="mt-1 text-xs whitespace-pre-wrap break-all bg-gray-100 p-2 rounded max-h-40 overflow-auto">
                {debugInfo.join('\n')}
              </pre>
            </details>
          )}
        </div>
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
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">エラー</span>
            </div>
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              リセットして再試行
            </Button>
            {debugInfo.length > 0 && (
              <details className="mt-3 text-left">
                <summary className="cursor-pointer text-xs text-red-500">デバッグ情報</summary>
                <pre className="mt-1 text-xs whitespace-pre-wrap break-all bg-red-100 p-2 rounded max-h-40 overflow-auto">
                  {debugInfo.join('\n')}
                </pre>
              </details>
            )}
          </div>
        )}

        <Button
          size="lg"
          className="w-full bg-[#06C755] hover:bg-[#05b04c] text-white gap-2"
          onClick={handleLogin}
          disabled={status !== "ready"}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          LINEでログイン
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
