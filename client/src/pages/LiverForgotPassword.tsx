import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowLeft, Mail, CheckCircle, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLiverT, LiverLanguage } from "@/lib/liverI18n";

export default function LiverForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { language } = useLanguage();
  const lt = createLiverT(language as LiverLanguage);

  const requestReset = trpc.liver.requestPasswordReset.useMutation({
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
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-pink-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/liver/login")}
              className="text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-800">{lt("login.title")}</h1>
                <p className="text-xs text-white">{lt("forgot.title")}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-pink-100 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">{lt("forgot.emailSent")}</CardTitle>
              <CardDescription>
                {lt("forgot.emailSentDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {lt("forgot.checkSpam")}
              </p>
              <Link href="/liver/login">
                <Button variant="outline" className="w-full border-pink-200">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {lt("forgot.backToLogin")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-pink-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/liver/login")}
            className="text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">{lt("login.title")}</h1>
              <p className="text-xs text-white">{lt("forgot.title")}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-pink-100 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl">{lt("forgot.title")}</CardTitle>
            <CardDescription>
              {lt("forgot.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{lt("login.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                disabled={requestReset.isPending || !email.trim()}
              >
                {requestReset.isPending ? lt("forgot.submitting") : lt("forgot.submit")}
              </Button>

              {requestReset.error && (
                <p className="text-sm text-red-500 text-center">
                  {requestReset.error.message}
                </p>
              )}
            </form>

            <div className="mt-6 text-center">
              <Link href="/liver/login">
                <Button variant="link" className="text-pink-500">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {lt("forgot.backToLogin")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
