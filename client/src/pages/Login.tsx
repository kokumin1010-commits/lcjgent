import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";
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
  const { t, language, setLanguage } = useLanguage();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      toast.success(t("login.title"));
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
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
            {t("login.title")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("login.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
