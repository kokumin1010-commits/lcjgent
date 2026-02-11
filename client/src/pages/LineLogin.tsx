import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, ShoppingBag, AlertCircle, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import liff from "@line/liff";

// LIFF ID for LCJ MALL LINE Login
const LIFF_ID = "2009018493-9HZXJj8d";

export default function LineLogin() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"initializing" | "ready" | "logging_in" | "error">("initializing");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const hasProcessedLogin = useRef(false);
  
  // Email/Password login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"line" | "email">("line");
  
  // Referral code state
  const [referralCode, setReferralCode] = useState("");
  const [referralLiverName, setReferralLiverName] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  
  // Read referral code from URL params or localStorage on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode && /^\d{4}$/.test(refCode)) {
      setReferralCode(refCode);
      return;
    }
    // Fallback: read from localStorage (captured by useReferralCapture on any page)
    const saved = localStorage.getItem('lcj_referral_code');
    if (saved && /^\d{4}$/.test(saved)) {
      setReferralCode(saved);
    }
  }, []);
  
  // Validate referral code API
  const validateReferralMutation = trpc.lineLogin.validateReferralCode.useMutation({
    onSuccess: (data) => {
      setReferralLiverName(data.liverName);
      setReferralError(null);
      setIsValidatingReferral(false);
    },
    onError: (err) => {
      setReferralLiverName(null);
      setReferralError(err.message || "無効なコードです");
      setIsValidatingReferral(false);
    },
  });
  
  // Validate referral code when it changes
  useEffect(() => {
    if (referralCode.length === 4 && /^\d{4}$/.test(referralCode)) {
      setIsValidatingReferral(true);
      validateReferralMutation.mutate({ code: referralCode });
    } else {
      setReferralLiverName(null);
      setReferralError(null);
    }
  }, [referralCode]);

  const addDebug = (msg: string) => {
    console.log("[LIFF]", msg);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // LIFF callback mutation
  const liffCallbackMutation = trpc.lineLogin.liffCallback.useMutation({
    onSuccess: async (data) => {
      addDebug(`Login successful: ${JSON.stringify(data)}`);
      // Clear saved referral code after successful LINE login/registration
      localStorage.removeItem('lcj_referral_code');
      // Save session token to localStorage for fallback authentication
      if (data.sessionToken) {
        localStorage.setItem('lcj_session_token', data.sessionToken);
      }
      
      // Check if coming from add_friend flow
      const urlParams = new URLSearchParams(window.location.search);
      const isAddFriendFlow = urlParams.get('add_friend') === '1';
      
      if (isAddFriendFlow && liff.isInClient()) {
        // 友だち追加フローの場合、友だち状態を確認
        try {
          const friendshipStatus = await liff.getFriendship();
          addDebug(`Friendship status after login: ${JSON.stringify(friendshipStatus)}`);
          
          if (!friendshipStatus.friendFlag) {
            // まだ友だちでない場合、友だち追加を促す
            toast.success("ログインしました。LINE友だち追加もお願いします！");
            setTimeout(() => {
              window.location.href = `https://line.me/R/ti/p/@lcjmall?oat_content=url&openExternalBrowser=0`;
            }, 1500);
            return;
          }
        } catch (err) {
          addDebug(`getFriendship error: ${err}`);
        }
      }
      
      toast.success("ログインしました");
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

  // Email login mutation
  const emailLoginMutation = trpc.lineLogin.emailLogin.useMutation({
    onSuccess: (data) => {
      // Save session token to localStorage for fallback authentication
      if (data.sessionToken) {
        localStorage.setItem('lcj_session_token', data.sessionToken);
      }
      toast.success("ログインしました");
      // Wait for cookie to be set, then redirect
      setTimeout(() => {
        window.location.href = "/mypage";
      }, 500);
    },
    onError: (err) => {
      toast.error(err.message || "ログインに失敗しました");
    },
  });

  // Email register mutation
  const emailRegisterMutation = trpc.lineLogin.emailRegister.useMutation({
    onSuccess: () => {
      toast.success("アカウントを作成しました。ログインしてください。");
      // Clear saved referral code after successful registration
      localStorage.removeItem('lcj_referral_code');
      setIsRegistering(false);
      setPassword("");
    },
    onError: (err) => {
      toast.error(err.message || "登録に失敗しました");
    },
  });

  useEffect(() => {
    const initLiff = async () => {
      try {
        addDebug(`Starting LIFF initialization with ID: ${LIFF_ID}`);
        addDebug(`Current URL: ${window.location.href}`);
        
        // Check if coming from add_friend flow
        const urlParams = new URLSearchParams(window.location.search);
        const isAddFriendFlow = urlParams.get('add_friend') === '1';
        if (isAddFriendFlow) {
          addDebug("Add friend flow detected");
        }
        
        await liff.init({ liffId: LIFF_ID });
        
        const isLoggedIn = liff.isLoggedIn();
        const isInClient = liff.isInClient();
        
        addDebug(`LIFF initialized. isLoggedIn: ${isLoggedIn}, isInClient: ${isInClient}`);

        // If user is logged in via LIFF and we haven't processed yet
        if (isLoggedIn && !hasProcessedLogin.current) {
          hasProcessedLogin.current = true;
          setStatus("logging_in");
          
          try {
            // For LINE browser (isInClient), use getIDToken instead of getAccessToken
            let accessToken = liff.getAccessToken();
            addDebug(`Access token: ${accessToken ? accessToken.substring(0, 20) + '...' : 'null'}`);
            
            // If in LINE client and no access token, try to get ID token
            if (!accessToken && isInClient) {
              addDebug("In LINE client, trying getIDToken...");
              const idToken = liff.getIDToken();
              addDebug(`ID token: ${idToken ? idToken.substring(0, 20) + '...' : 'null'}`);
              // Use ID token as fallback (server needs to handle this)
              if (idToken) {
                accessToken = idToken;
              }
            }
            
            if (accessToken) {
              addDebug("Calling liffCallback mutation...");
              liffCallbackMutation.mutate({ accessToken, referralCode: referralCode.length === 4 ? referralCode : undefined });
            } else {
              // Access token is null, need to re-login
              addDebug("No access token, logging out and re-login");
              try {
                liff.logout();
              } catch (logoutErr) {
                addDebug(`Logout error (ignored): ${logoutErr}`);
              }
              setStatus("ready");
              hasProcessedLogin.current = false;
            }
          } catch (tokenError: any) {
            addDebug(`Token error: ${tokenError.message}`);
            // Token might be expired, logout and let user re-login
            try {
              liff.logout();
            } catch (logoutErr) {
              addDebug(`Logout error (ignored): ${logoutErr}`);
            }
            setStatus("ready");
            hasProcessedLogin.current = false;
          }
        } else {
          setStatus("ready");
        }
      } catch (err: any) {
        addDebug(`LIFF init error: ${err.message || JSON.stringify(err)}`);
        // Don't show error, just set ready and let user choose login method
        setStatus("ready");
      }
    };

    initLiff();
  }, []);

  const handleLineLogin = async () => {
    if (status !== "ready") return;
    
    addDebug("handleLogin called");
    setStatus("logging_in");
    setError(null);
    
    try {
      const isInClient = liff.isInClient();
      addDebug(`isInClient: ${isInClient}`);
      
      // Check if already logged in
      if (liff.isLoggedIn()) {
        addDebug("Already logged in, getting access token");
        let accessToken = liff.getAccessToken();
        
        // Try ID token if access token is null (common in LINE browser)
        if (!accessToken && isInClient) {
          addDebug("Trying getIDToken...");
          const idToken = liff.getIDToken();
          if (idToken) {
            accessToken = idToken;
          }
        }
        
        if (accessToken) {
          addDebug(`Got token: ${accessToken.substring(0, 20)}...`);
              hasProcessedLogin.current = true;
              liffCallbackMutation.mutate({ accessToken, referralCode: referralCode.length === 4 ? referralCode : undefined });
        } else {
          addDebug("No token despite being logged in, re-login");
          try {
            liff.logout();
          } catch (e) {
            addDebug(`Logout error (ignored): ${e}`);
          }
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

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRegistering) {
      if (!name.trim()) {
        toast.error("名前を入力してください");
        return;
      }
      emailRegisterMutation.mutate({ 
        email, 
        password, 
        name,
        referralCode: referralCode.length === 4 ? referralCode : undefined,
      });
    } else {
      emailLoginMutation.mutate({ email, password });
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

  // LINE友だち追加 + 自動ログイン
  const handleAddFriendAndLogin = async () => {
    addDebug("handleAddFriendAndLogin called");
    
    // LINE公式アカウントID (@lcjmall)
    const LINE_OA_ID = "@lcjmall";
    
    // Check if in LINE client
    const isInClient = liff.isInClient();
    addDebug(`isInClient: ${isInClient}`);
    
    if (isInClient) {
      // LINEブラウザ内の場合、友だち追加後にログインを実行
      try {
        // 友だち追加ページを開く
        const friendshipStatus = await liff.getFriendship();
        addDebug(`Friendship status: ${JSON.stringify(friendshipStatus)}`);
        
        if (friendshipStatus.friendFlag) {
          // すでに友だちの場合、そのままログイン
          addDebug("Already friends, proceeding to login");
          toast.success("すでにLINE友だちです。ログインします...");
          handleLineLogin();
        } else {
          // 友だちでない場合、友だち追加ページへ
          addDebug("Not friends yet, opening add friend page");
          // LINEアプリ内で友だち追加ページを開く
          window.location.href = `https://line.me/R/ti/p/${LINE_OA_ID}?oat_content=url&openExternalBrowser=0`;
        }
      } catch (err: any) {
        addDebug(`getFriendship error: ${err.message}`);
        // エラーの場合は直接友だち追加ページへ
        window.location.href = `https://line.me/R/ti/p/${LINE_OA_ID}?oat_content=url&openExternalBrowser=0`;
      }
    } else {
      // LINEブラウザ外の場合
      // LIFFアプリを開きつつ友だち追加を促す
      // liff.openWindowを使用してLINEアプリ内で開く
      try {
        // まずログインを実行し、ログイン後に友だち追加を確認
        addDebug("External browser, starting login with friend add prompt");
        setStatus("logging_in");
        
        // LIFFログインを開始（LINEアプリが開く）
        const redirectUri = window.location.origin + "/line-login?add_friend=1";
        addDebug(`Login redirectUri: ${redirectUri}`);
        liff.login({ redirectUri });
      } catch (err: any) {
        addDebug(`Login error: ${err.message}`);
        // フォールバック: 直接友だち追加URLへ
        window.open(`https://lin.ee/hpVjAiOe`, "_blank");
      }
    }
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
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center justify-center gap-2 mb-6">
          <ShoppingBag className="h-10 w-10 text-rose-500" />
          <span className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
            LCJ MALL
          </span>
        </div>

        <h1 className="text-xl font-bold mb-2 text-center">ログイン / 新規登録</h1>
        <p className="text-muted-foreground mb-6 text-center text-sm">
          ポイント残高の確認やレシート申請履歴を確認できます。
        </p>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "line" | "email")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="line" className="gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              LINE
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              メール
            </TabsTrigger>
          </TabsList>

          <TabsContent value="line" className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
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

            {/* Referral code input for LINE login */}
            <div className="space-y-2">
              <Label htmlFor="referral-line">紹介コード（任意）</Label>
              <Input
                id="referral-line"
                type="text"
                inputMode="numeric"
                pattern="\\d{4}"
                maxLength={4}
                placeholder="4桁の数字"
                value={referralCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setReferralCode(val);
                }}
                className={referralLiverName ? "border-green-500" : referralError ? "border-red-500" : ""}
              />
              {isValidatingReferral && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />確認中...
                </p>
              )}
              {referralLiverName && (
                <p className="text-xs text-green-600">✅ {referralLiverName} さんからの紹介（初回購入時に500pt付与）</p>
              )}
              {referralError && (
                <p className="text-xs text-red-500">{referralError}</p>
              )}
            </div>

            <Button
              size="lg"
              className="w-full bg-[#06C755] hover:bg-[#05b04c] text-white gap-2"
              onClick={handleLineLogin}
              disabled={status !== "ready"}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              LINEでログイン
            </Button>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-4 text-center">
                まだLINE友だち追加していない方は
              </p>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={handleAddFriendAndLogin}
              >
                <svg className="h-4 w-4 text-[#06C755]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                LINE友だち追加
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {isRegistering && (
                <div className="space-y-2">
                  <Label htmlFor="name">お名前</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="山田 太郎"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isRegistering}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {isRegistering && (
                  <p className="text-xs text-muted-foreground">
                    6文字以上のパスワードを入力してください
                  </p>
                )}
              </div>

              {isRegistering && (
                <div className="space-y-2">
                  <Label htmlFor="referral-email">紹介コード（任意）</Label>
                  <Input
                    id="referral-email"
                    type="text"
                    inputMode="numeric"
                    pattern="\\d{4}"
                    maxLength={4}
                    placeholder="4桁の数字"
                    value={referralCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setReferralCode(val);
                    }}
                    className={referralLiverName ? "border-green-500" : referralError ? "border-red-500" : ""}
                  />
                  {isValidatingReferral && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />確認中...
                    </p>
                  )}
                  {referralLiverName && (
                    <p className="text-xs text-green-600">✅ {referralLiverName} さんからの紹介（初回購入時に500pt付与）</p>
                  )}
                  {referralError && (
                    <p className="text-xs text-red-500">{referralError}</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-rose-500 hover:bg-rose-600"
                disabled={emailLoginMutation.isPending || emailRegisterMutation.isPending}
              >
                {emailLoginMutation.isPending || emailRegisterMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    処理中...
                  </>
                ) : isRegistering ? (
                  "新規登録"
                ) : (
                  "ログイン"
                )}
              </Button>

              <div className="text-center space-y-2">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setName("");
                    setPassword("");
                  }}
                  className="text-sm text-rose-500"
                >
                  {isRegistering
                    ? "すでにアカウントをお持ちの方はこちら"
                    : "新規登録はこちら"}
                </Button>
                {!isRegistering && (
                  <div>
                    <Link href="/forgot-password">
                      <Button variant="link" className="text-sm text-muted-foreground">
                        パスワードを忘れた方はこちら
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </form>
          </TabsContent>
        </Tabs>

        <Button
          variant="ghost"
          className="w-full mt-4 text-muted-foreground"
          onClick={() => setLocation("/")}
        >
          トップページに戻る
        </Button>
      </div>
    </div>
  );
}
