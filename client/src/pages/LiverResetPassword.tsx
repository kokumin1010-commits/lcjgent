import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowLeft, Lock, CheckCircle, XCircle, Eye, EyeOff, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLiverT, LiverLanguage } from "@/lib/liverI18n";

export default function LiverResetPassword() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const lt = createLiverT(language as LiverLanguage);
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
  const { data: tokenStatus, isLoading: isVerifying } = trpc.liver.verifyResetToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const resetPassword = trpc.liver.resetPassword.useMutation({
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
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-pink-100 shadow-lg">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-4"></div>
              <p className="text-muted-foreground">{lt("reset.verifying")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired token
  if (!token || (tokenStatus && !tokenStatus.valid)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-pink-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/liver/login")}
              className="text-gray-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-800">{lt("login.title")}</h1>
                <p className="text-xs text-gray-300">{lt("reset.title")}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-pink-100 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-xl">{lt("reset.invalidLink")}</CardTitle>
              <CardDescription>
                {tokenStatus?.message || lt("reset.invalidLinkDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/liver/forgot-password">
                <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
                  {lt("reset.getNewLink")}
                </Button>
              </Link>
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

  // Success state
  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-pink-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-800">{lt("login.title")}</h1>
                <p className="text-xs text-gray-300">{lt("reset.title")}</p>
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
              <CardTitle className="text-xl">{lt("reset.success")}</CardTitle>
              <CardDescription>
                {lt("reset.successDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/liver/login">
                <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
                  {lt("reset.goToLogin")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-pink-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/liver/login")}
            className="text-gray-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">{lt("login.title")}</h1>
              <p className="text-xs text-gray-300">{lt("reset.title")}</p>
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
            <CardTitle className="text-xl">{lt("reset.newPassword")}</CardTitle>
            <CardDescription>
              {tokenStatus?.email && (
                <span className="block mt-1">{tokenStatus.email}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{lt("reset.newPasswordLabel")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={lt("reset.minChars")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 border-pink-200 focus:border-pink-400 focus:ring-pink-400"
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
                  <p className="text-xs text-red-500">{lt("reset.minCharsError")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{lt("reset.confirmPassword")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder={lt("reset.reenterPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                    required
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500">{lt("reset.passwordMismatch")}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                disabled={
                  resetPassword.isPending ||
                  password.length < 6 ||
                  password !== confirmPassword
                }
              >
                {resetPassword.isPending ? lt("reset.changing") : lt("reset.changePassword")}
              </Button>

              {resetPassword.error && (
                <p className="text-sm text-red-500 text-center">
                  {resetPassword.error.message}
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
