import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, LogIn } from "lucide-react";
import { getAgencyToken, setAgencyToken, clearAgencyToken } from "@/lib/agencyAuth";

export default function AgencyLogin() {
  const [, navigate] = useLocation();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const hasToken = !!getAgencyToken();
  const meQuery = trpc.agency.me.useQuery(undefined, {
    enabled: hasToken && !isLoggingIn,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (isLoggingIn) return;
    const token = getAgencyToken();
    if (!token) {
      setIsCheckingAuth(false);
      return;
    }
    if (meQuery.isLoading) return;
    if (meQuery.data) {
      navigate("/agency/dashboard");
      return;
    }
    if (meQuery.isError || meQuery.data === null) {
      clearAgencyToken();
    }
    setIsCheckingAuth(false);
  }, [meQuery.data, meQuery.isLoading, meQuery.isError, isLoggingIn, navigate]);

  const loginMutation = trpc.agency.login.useMutation({
    onSuccess: (data) => {
      setAgencyToken(data.token);
      setIsLoggingIn(false);
      navigate("/agency/dashboard");
    },
    onError: (err) => {
      setError(err.message || "ログインに失敗しました");
      setIsLoggingIn(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoggingIn(true);
    loginMutation.mutate({ loginId, password });
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800/80 border-slate-700 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">事務所ログイン</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              LCJ ライブコマース管理システム
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="loginId" className="text-slate-300">ログインID</Label>
              <Input
                id="loginId"
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="ログインIDを入力"
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-3"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ログイン中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  ログイン
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
