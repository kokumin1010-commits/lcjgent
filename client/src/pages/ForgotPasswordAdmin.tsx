import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordAdmin() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { language } = useLanguage();

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestReset.mutate({ email });
  };

  const t = {
    title: language === "ja" ? "パスワードリセット" : "重置密码",
    subtitle: language === "ja" 
      ? "登録済みのメールアドレスを入力してください" 
      : "请输入您注册时使用的邮箱地址",
    email: language === "ja" ? "メールアドレス" : "邮箱地址",
    submit: language === "ja" ? "リセットメールを送信" : "发送重置邮件",
    submitting: language === "ja" ? "送信中..." : "发送中...",
    backToLogin: language === "ja" ? "ログインに戻る" : "返回登录",
    successTitle: language === "ja" ? "メールを送信しました" : "邮件已发送",
    successMessage: language === "ja" 
      ? "パスワードリセットのリンクをメールで送信しました。メールをご確認ください。" 
      : "密码重置链接已发送到您的邮箱，请查收。",
    notReceived: language === "ja" 
      ? "メールが届かない場合は、迷惑メールフォルダをご確認ください。" 
      : "如果没有收到邮件，请检查垃圾邮件文件夹。",
  };

  if (isSubmitted) {
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
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">{t.notReceived}</p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
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
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">{t.title}</CardTitle>
          <CardDescription className="text-center">{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={requestReset.isPending}
            >
              {requestReset.isPending ? t.submitting : t.submit}
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
