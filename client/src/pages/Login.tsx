import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
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
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const { t, language, setLanguage } = useLanguage();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success(t("login.title"));
      // Check if there's a redirect URL in the query params
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') || '/master';
      window.location.href = redirect;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success(t("register.title"));
      setIsRegistering(false);
      setName("");
      setPassword("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isRegistering) {
      registerMutation.mutate({ email, password, name });
    } else {
      loginMutation.mutate({ email, password });
    }
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
              🇯🇵 日本語
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleLanguageChange("zh")}
              className={`cursor-pointer ${language === "zh" ? "bg-accent" : ""}`}
            >
              🇨🇳 中文
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isRegistering ? t("register.title") : t("login.title")}
          </CardTitle>
          <CardDescription className="text-center">
            {isRegistering
              ? t("register.subtitle")
              : t("login.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div className="space-y-2">
                <Label htmlFor="name">{t("register.name")}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={language === "ja" ? "山田 太郎" : "张三"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

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
              {isRegistering && (
                <p className="text-xs text-muted-foreground">
                  {language === "ja" ? "6文字以上のパスワードを入力してください" : "请输入6位以上的密码"}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending || registerMutation.isPending}
            >
              {loginMutation.isPending || registerMutation.isPending
                ? (isRegistering ? t("register.submitting") : t("login.submitting"))
                : isRegistering
                  ? t("register.submit")
                  : t("login.submit")}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setName("");
                  setPassword("");
                }}
                className="text-sm"
              >
                {isRegistering
                  ? t("register.login")
                  : t("login.register")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
