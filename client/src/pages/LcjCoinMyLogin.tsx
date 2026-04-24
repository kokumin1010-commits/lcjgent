import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, User, Video, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { setLiverToken, getLiverToken } from "@/lib/liverAuth";
import { toast } from "sonner";

type AuthMode = "select" | "staff" | "liver";

export default function LcjCoinMyLogin() {
  const [, navigate] = useLocation();
  const [authMode, setAuthMode] = useState<AuthMode>("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if already logged in as staff
  const staffMeQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    enabled: isCheckingAuth,
  });

  // Check if already logged in as liver
  const hasLiverToken = !!getLiverToken();
  const liverMeQuery = trpc.liver.me.useQuery(undefined, {
    retry: false,
    enabled: hasLiverToken && isCheckingAuth,
  });

  useEffect(() => {
    if (staffMeQuery.isLoading || (hasLiverToken && liverMeQuery.isLoading)) return;
    
    if (staffMeQuery.data) {
      // Already logged in as staff
      navigate("/my/lcj-coin");
      return;
    }
    if (liverMeQuery.data) {
      // Already logged in as liver
      navigate("/my/lcj-coin");
      return;
    }
    setIsCheckingAuth(false);
  }, [staffMeQuery.isLoading, staffMeQuery.data, liverMeQuery.isLoading, liverMeQuery.data, hasLiverToken]);

  const staffLoginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("ログインしました");
      window.location.href = "/my/lcj-coin";
    },
    onError: (error) => {
      toast.error(error.message || "ログインに失敗しました");
      setIsLoading(false);
    },
  });

  const liverLoginMutation = trpc.liver.login.useMutation();

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    staffLoginMutation.mutate({ email, password });
  };

  const handleLiverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await liverLoginMutation.mutateAsync({ email, password });
      if (data.token) {
        setLiverToken(data.token);
        if (data.liver) {
          localStorage.setItem("liver_info", JSON.stringify(data.liver));
        }
        toast.success("ログインしました");
        // Use window.location for full reload to pick up new token
        window.location.href = "/my/lcj-coin";
      }
    } catch (error: any) {
      toast.error(error.message || "ログインに失敗しました");
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Coins className="w-10 h-10 text-amber-400" />
          <p className="text-slate-400 text-sm">認証確認中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20 mb-4">
            <Coins className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">LCJ Coin</h1>
          <p className="text-slate-400 text-sm mt-1">マイページにログイン</p>
        </div>

        {/* Auth Mode Selection */}
        {authMode === "select" && (
          <div className="space-y-3">
            <button
              onClick={() => setAuthMode("staff")}
              className="w-full group"
            >
              <Card className="bg-slate-800/50 border-slate-700/50 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <User className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold">スタッフとしてログイン</p>
                    <p className="text-slate-400 text-sm">管理画面のアカウントでログイン</p>
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setAuthMode("liver")}
              className="w-full group"
            >
              <Card className="bg-slate-800/50 border-slate-700/50 hover:border-pink-500/50 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center group-hover:bg-pink-500/20 transition-colors">
                    <Video className="w-6 h-6 text-pink-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold">ライバーとしてログイン</p>
                    <p className="text-slate-400 text-sm">ライバーアカウントでログイン</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          </div>
        )}

        {/* Staff Login Form */}
        {authMode === "staff" && (
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <button
                onClick={() => { setAuthMode("select"); setEmail(""); setPassword(""); }}
                className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="w-5 h-5 text-blue-400" />
                スタッフログイン
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-email" className="text-slate-300">メールアドレス</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    required
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-password" className="text-slate-300">パスワード</Label>
                  <div className="relative">
                    <Input
                      id="staff-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? "ログイン中..." : "ログイン"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Liver Login Form */}
        {authMode === "liver" && (
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <button
                onClick={() => { setAuthMode("select"); setEmail(""); setPassword(""); }}
                className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
              <CardTitle className="flex items-center gap-2 text-white">
                <Video className="w-5 h-5 text-pink-400" />
                ライバーログイン
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLiverLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="liver-email" className="text-slate-300">メールアドレス</Label>
                  <Input
                    id="liver-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    required
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="liver-password" className="text-slate-300">パスワード</Label>
                  <div className="relative">
                    <Input
                      id="liver-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-pink-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white"
                >
                  {isLoading ? "ログイン中..." : "ログイン"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          &copy; {new Date().getFullYear()} Live Commerce Japan
        </p>
      </div>
    </div>
  );
}
