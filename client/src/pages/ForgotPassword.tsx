import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestReset = trpc.lineLogin.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    requestReset.mutate({ email: email.trim() });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">メールを送信しました</CardTitle>
            <CardDescription>
              メールアドレスが登録されている場合、パスワードリセットのリンクを送信しました。
              メールをご確認ください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </p>
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
          <CardTitle className="text-xl">パスワードをお忘れの方</CardTitle>
          <CardDescription>
            登録したメールアドレスを入力してください。
            パスワードリセットのリンクをお送りします。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-rose-500 hover:bg-rose-600"
              disabled={requestReset.isPending || !email.trim()}
            >
              {requestReset.isPending ? "送信中..." : "リセットリンクを送信"}
            </Button>

            {requestReset.error && (
              <p className="text-sm text-red-500 text-center">
                {requestReset.error.message}
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
