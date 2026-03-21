import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowLeft, Sparkles } from "lucide-react";
import { setLiverToken, getLiverToken, clearLiverToken } from "@/lib/liverAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLiverT, LiverLanguage } from "@/lib/liverI18n";

export default function LiverLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { language, setLanguage } = useLanguage();
  const lt = createLiverT(language as LiverLanguage);

  // Get redirect URL from query params
  const searchParams = new URLSearchParams(window.location.search);
  const redirectUrl = searchParams.get("redirect") || "/liver/mypage";

  // Check if already logged in
  const hasToken = !!getLiverToken();
  const meQuery = trpc.liver.me.useQuery(undefined, {
    enabled: hasToken && !isLoggingIn,
    retry: false,
    staleTime: 0,
  });

  // Handle auth check completion
  useEffect(() => {
    // Don't process if we're in the middle of logging in
    if (isLoggingIn) return;
    
    const token = getLiverToken();
    
    // No token - stop checking immediately
    if (!token) {
      setIsCheckingAuth(false);
      return;
    }
    
    // Token exists - wait for query to complete
    if (meQuery.isLoading) {
      return; // Still loading, keep checking
    }
    
    // Query completed
    if (meQuery.data) {
      // Valid session - redirect to target page
      navigate(redirectUrl);
    } else {
      // Do NOT clear token here - let the user try to login again
      // The token might still be valid, just a temporary network issue
      // If the token is truly invalid, the server will return 401 on protected routes
      setIsCheckingAuth(false);
    }
  }, [meQuery.isLoading, meQuery.data, meQuery.isError, navigate, isLoggingIn]);

  // Timeout fallback - if checking takes too long, show login form
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isCheckingAuth && !isLoggingIn) {
        console.log('Auth check timeout - showing login form');
        setIsCheckingAuth(false);
      }
    }, 3000); // 3 second timeout
    
    return () => clearTimeout(timeout);
  }, [isCheckingAuth, isLoggingIn]);

  const loginMutation = trpc.liver.login.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoggingIn(true);
    
    try {
      console.log('Attempting login...');
      const data = await loginMutation.mutateAsync({ email, password });
      console.log('Login response received:', data);
      
      if (data.token) {
        console.log('Token received, saving to localStorage...');
        setLiverToken(data.token);
        
        // DBのlanguage設定を自動適用
        if (data.liver?.language) {
          setLanguage(data.liver.language as LiverLanguage);
        }
        
        // Verify token was saved
        const savedToken = getLiverToken();
        console.log('Token saved successfully:', savedToken ? 'Yes' : 'No');
        
        if (savedToken) {
          // Small delay to ensure localStorage is synced
          await new Promise(resolve => setTimeout(resolve, 100));
          console.log('Navigating to:', redirectUrl);
          navigate(redirectUrl);
        } else {
          console.error('Failed to save token to localStorage');
          setError(lt("login.tokenError"));
          setIsLoggingIn(false);
        }
      } else {
        console.error('No token in response');
        setError(lt("login.failed"));
        setIsLoggingIn(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || lt("login.failed"));
      setIsLoggingIn(false);
    }
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white">{lt("common.loading")}</p>
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
            onClick={() => navigate("/s")}
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
              <p className="text-xs text-white">{lt("login.subtitle")}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-pink-100 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">{lt("login.welcome")}</CardTitle>
            <CardDescription>
              {lt("login.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{lt("login.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{lt("login.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                disabled={loginMutation.isPending || isLoggingIn}
              >
                {(loginMutation.isPending || isLoggingIn) ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {lt("login.submitting")}
                  </div>
                ) : (
                  lt("login.submit")
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/liver/forgot-password"
                className="text-sm text-white hover:text-pink-500"
              >
                {lt("login.forgotPassword")}
              </Link>
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm text-white">
                {lt("login.noAccount")}
              </p>
              <Link
                href="/liver/register"
                className="text-pink-500 hover:text-pink-600 font-medium"
              >
                {lt("login.register")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
