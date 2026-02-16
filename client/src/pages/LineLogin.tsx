import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, ShoppingBag, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";

export default function LineLogin() {
  const [, setLocation] = useLocation();
  
  // Email/Password login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Check URL params for initial state
  const urlParamsInit = new URLSearchParams(window.location.search);
  const modeInit = urlParamsInit.get('mode');
  const [isRegistering, setIsRegistering] = useState(modeInit === 'register');
  
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

  // Email login mutation
  // Check for redirect parameter
  const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/mypage';

  const emailLoginMutation = trpc.lineLogin.emailLogin.useMutation({
    onSuccess: (data) => {
      // Save session token to localStorage for fallback authentication
      if (data.sessionToken) {
        localStorage.setItem('lcj_session_token', data.sessionToken);
      }
      toast.success("ログインしました");
      // Wait for cookie to be set, then redirect
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 500);
    },
    onError: (err) => {
      toast.error(err.message || "ログインに失敗しました");
    },
  });

  // Email register mutation
  const emailRegisterMutation = trpc.lineLogin.emailRegister.useMutation({
    onSuccess: (data) => {
      // Save session token to localStorage for fallback authentication
      if (data.sessionToken) {
        localStorage.setItem('lcj_session_token', data.sessionToken);
      }
      // Clear saved referral code after successful registration
      localStorage.removeItem('lcj_referral_code');
      if (data.referralApplied && data.referralPoints) {
        toast.success(`アカウントを作成しました！紹介コード特典で${data.referralPoints}ptを獲得しました🎉`);
        // Save flag for welcome banner on mypage
        localStorage.setItem('lcj_referral_bonus', String(data.referralPoints));
      } else {
        toast.success("アカウントを作成しました");
      }
      // Auto-login: redirect
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 500);
    },
    onError: (err) => {
      toast.error(err.message || "登録に失敗しました");
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("メールアドレスを入力してください");
      return;
    }
    if (!password) {
      toast.error("パスワードを入力してください");
      return;
    }
    
    if (isRegistering) {
      if (!name.trim()) {
        toast.error("名前を入力してください");
        return;
      }
      if (password.length < 6) {
        toast.error("パスワードは6文字以上で入力してください");
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center justify-center gap-2 mb-6">
          <ShoppingBag className="h-10 w-10 text-rose-500" />
          <span className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
            LCJ MALL
          </span>
        </div>

        <h1 className="text-xl font-bold mb-2 text-center">
          {isRegistering ? "新規登録" : "ログイン"}
        </h1>
        <p className="text-muted-foreground mb-6 text-center text-sm">
          ポイント残高の確認やレシート申請履歴を確認できます。
        </p>

        <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
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
                <p className="text-xs text-green-600">✅ {referralLiverName} さんからの紹介（登録で500pt付与）</p>
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

        {/* LINE連携の案内 */}
        <div className="mt-6 pt-6 border-t">
          <p className="text-xs text-muted-foreground text-center">
            LINEでレシートを送信したい方は、ログイン後にマイページからLINE連携ができます。
          </p>
        </div>

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
