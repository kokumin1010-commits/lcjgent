import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, ArrowLeft, Lock, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Get token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, []);

  // Verify token
  const { data: tokenStatus, isLoading: isVerifying } = trpc.lineLogin.verifyResetToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const resetPassword = trpc.lineLogin.resetPassword.useMutation({
    onSuccess: () => {
      setResetSuccess(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return;
    }
    if (password.length < 6) {
      return;
    }
    resetPassword.mutate({ token, newPassword: password });
  };

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mx-auto mb-4"></div>
              <p className="text-muted-foreground">リンクを確認中...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired token
  if (!token || (tokenStatus && !tokenStatus.valid)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-xl">リンクが無効です</CardTitle>
            <CardDescription>
              {tokenStatus?.message || "このパスワードリセットリンクは無効または期限切れです。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/forgot-password">
              <Button className="w-full bg-rose-500 hover:bg-rose-600">
                新しいリセットリンクを取得
              </Button>
            </Link>
            <Link href="/line-login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                ログインページに戻る
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">パスワードを変更しました</CardTitle>
            <CardDescription>
              新しいパスワードでログインできます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/line-login">
              <Button className="w-full bg-rose-500 hover:bg-rose-600">
                ログインページへ
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/mall">
            <div className="flex items-center justify-center gap-2 mb-4 cursor-pointer">
              <ShoppingBag className="w-8 h-8 text-rose-500" />
              <span className="text-2xl font-bold text-rose-500">LCJ MALL</span>
            </div>
          </Link>
          <CardTitle className="text-xl">新しいパスワードを設定</CardTitle>
          <CardDescription>
            {tokenStatus?.email && (
              <span className="block mt-1">{tokenStatus.email}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">新しいパスワード</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="6文字以上"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && password.length < 6 && (
                <p className="text-xs text-red-500">パスワードは6文字以上で入力してください</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">パスワード確認</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="パスワードを再入力"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500">パスワードが一致しません</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-rose-500 hover:bg-rose-600"
              disabled={
                resetPassword.isPending ||
                password.length < 6 ||
                password !== confirmPassword
              }
            >
              {resetPassword.isPending ? "変更中..." : "パスワードを変更"}
            </Button>

            {resetPassword.error && (
              <p className="text-sm text-red-500 text-center">
                {resetPassword.error.message}
              </p>
            )}
          </form>

          <div className="mt-6 text-center">
            <Link href="/line-login">
              <Button variant="link" className="text-rose-500">
                <ArrowLeft className="w-4 h-4 mr-1" />
                ログインページに戻る
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
