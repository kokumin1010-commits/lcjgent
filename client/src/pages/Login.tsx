import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { Globe, UserPlus, LogIn } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const { t, language, setLanguage } = useLanguage();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      toast.success(t("login.title"));
      
      // Save token to localStorage as fallback for browsers with cookie issues
      if (data.token) {
        localStorage.setItem('lcj_admin_token', data.token);
      }
      
      // セキュリティ: ロールに応じてリダイレクト先を分岐
      if (data.user?.role === 'admin') {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect') || '/master';
        window.location.href = redirect;
      } else {
        // admin以外は管理ダッシュボードにアクセスさせない
        toast.error(language === "ja" ? "管理者権限がありません" : "没有管理员权限");
        window.location.href = "/";
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      toast.success(
        language === "ja"
          ? `スタッフ登録が完了しました！${data.staffName ? `（${data.staffName}）` : ""} ログインしてください。`
          : `员工注册完成！${data.staffName ? `（${data.staffName}）` : ""} 请登录。`
      );
      setMode("login");
      // パスワードとconfirmPasswordをリセット、emailは保持
      setPassword("");
      setConfirmPassword("");
      setName("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(language === "ja" ? "パスワードが一致しません" : "密码不一致");
      return;
    }
    registerMutation.mutate({ email, password, name });
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setPassword("");
    setConfirmPassword("");
    setName("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Globe className="h-4 w-4" />
              {language === "ja" ? "日本語" : "中文"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem
              onClick={() => handleLanguageChange("ja")}
              className={`cursor-pointer ${language === "ja" ? "bg-accent" : ""}`}
            >
              日本語
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleLanguageChange("zh")}
              className={`cursor-pointer ${language === "zh" ? "bg-accent" : ""}`}
            >
              中文
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {mode === "login"
              ? t("login.title")
              : language === "ja" ? "スタッフ登録" : "员工注册"}
          </CardTitle>
          <CardDescription className="text-center">
            {mode === "login"
              ? t("login.subtitle")
              : language === "ja"
                ? "HRに登録済みのメールアドレスで新規アカウントを作成"
                : "使用HR已注册的邮箱创建新账户"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            /* ===== ログインフォーム ===== */
            <>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("login.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("login.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending
                    ? t("login.submitting")
                    : t("login.submit")}
                </Button>

                <div className="text-center">
                  <Link href="/forgot-password-admin">
                    <Button type="button" variant="link" className="text-sm text-muted-foreground">
                      {language === "ja" ? "パスワードを忘れた場合" : "忘记密码"}
                    </Button>
                  </Link>
                </div>
              </form>

              {/* スタッフ登録へ切り替え */}
              <div className="mt-4 pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  {language === "ja" ? "初めてご利用の方はこちら" : "首次使用请点击这里"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:from-green-100 hover:to-emerald-100 text-green-700 gap-2"
                  onClick={() => switchMode("register")}
                >
                  <UserPlus className="h-4 w-4" />
                  {language === "ja" ? "スタッフ登録" : "员工注册"}
                </Button>
              </div>

              {/* Liver login redirect */}
              <div className="mt-3 text-center">
                <Link href={`/liver/login${window.location.search}`}>
                  <Button type="button" variant="outline" className="w-full bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200 hover:from-pink-100 hover:to-rose-100 text-pink-700">
                    🎤 {language === "ja" ? "ライバーログイン" : "主播登录"}
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            /* ===== スタッフ登録フォーム ===== */
            <>
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  {language === "ja"
                    ? "※ 人事管理（HR）に登録済みのメールアドレスのみ登録できます。未登録の場合は管理者にお問い合わせください。"
                    : "※ 仅限HR系统中已注册的邮箱可以注册。如未注册请联系管理员。"}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-name">
                    {language === "ja" ? "名前" : "姓名"}
                  </Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder={language === "ja" ? "山田太郎" : "张三"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-email">{t("login.email")}</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="example@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-password">
                    {language === "ja" ? "パスワード" : "密码"}
                  </Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-confirm-password">
                    {language === "ja" ? "パスワード確認" : "确认密码"}
                  </Label>
                  <Input
                    id="reg-confirm-password"
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
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending
                    ? (language === "ja" ? "登録中..." : "注册中...")
                    : (language === "ja" ? "アカウントを作成" : "创建账户")}
                </Button>
              </form>

              {/* ログインへ戻る */}
              <div className="mt-4 pt-4 border-t text-center">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => switchMode("login")}
                >
                  <LogIn className="h-4 w-4" />
                  {language === "ja" ? "ログインに戻る" : "返回登录"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
