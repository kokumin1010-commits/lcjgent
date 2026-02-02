import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Lock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function ResetPasswordAdmin() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isReset, setIsReset] = useState(false);
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  
  // Get token from URL
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token") || "";

  // Verify token
  const { data: tokenStatus, isLoading: isVerifying } = trpc.auth.verifyPasswordResetToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setIsReset(true);
      toast.success(language === "ja" ? "パスワードをリセットしました" : "密码已重置");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error(language === "ja" ? "パスワードが一致しません" : "密码不匹配");
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error(language === "ja" ? "パスワードは6文字以上必要です" : "密码至少需要6个字符");
      return;
    }
    
    resetPassword.mutate({ token, newPassword });
  };

  const t = {
    title: language === "ja" ? "新しいパスワードを設定" : "设置新密码",
    subtitle: language === "ja" 
      ? "新しいパスワードを入力してください" 
      : "请输入新密码",
    newPassword: language === "ja" ? "新しいパスワード" : "新密码",
    confirmPassword: language === "ja" ? "パスワード確認" : "确认密码",
    submit: language === "ja" ? "パスワードを変更" : "更改密码",
    submitting: language === "ja" ? "変更中..." : "更改中...",
    backToLogin: language === "ja" ? "ログインに戻る" : "返回登录",
    successTitle: language === "ja" ? "パスワードを変更しました" : "密码已更改",
    successMessage: language === "ja" 
      ? "新しいパスワードでログインできます。" 
      : "您现在可以使用新密码登录。",
    invalidToken: language === "ja" ? "無効なリンクです" : "链接无效",
    expiredToken: language === "ja" ? "このリンクは有効期限が切れています" : "链接已过期",
    usedToken: language === "ja" ? "このリンクは既に使用されています" : "链接已被使用",
    verifying: language === "ja" ? "確認中..." : "验证中...",
    passwordHint: language === "ja" ? "6文字以上のパスワードを入力してください" : "请输入6位以上的密码",
  };

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
            <p className="text-muted-foreground">{t.verifying}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired token
  if (!tokenStatus?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold">{t.invalidToken}</CardTitle>
            <CardDescription>{tokenStatus?.message || t.expiredToken}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password-admin">
              <Button variant="outline" className="w-full mb-2">
                {language === "ja" ? "パスワードリセットを再度リクエスト" : "重新请求密码重置"}
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.backToLogin}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (isReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">{t.successTitle}</CardTitle>
            <CardDescription>{t.successMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">
                {t.backToLogin}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">{t.title}</CardTitle>
          <CardDescription className="text-center">{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t.newPassword}</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending ? t.submitting : t.submit}
            </Button>

            <Link href="/login">
              <Button type="button" variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.backToLogin}
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
