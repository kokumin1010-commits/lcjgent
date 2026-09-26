import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  MapPinned,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ExhibitionLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const me = trpc.exhibitionAuth.me.useQuery(undefined, { retry: false });
  const login = trpc.exhibitionAuth.login.useMutation({
    onSuccess: data => setLocation(data.redirectPath),
    onError: error => toast.error(error.message),
  });
  const reset = trpc.exhibitionAuth.requestPasswordReset.useMutation({
    onSuccess: data => toast.success(data.message),
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (me.data) setLocation("/booth-portal");
  }, [me.data, setLocation]);

  return (
    <main className="min-h-screen bg-[#f5f0e7] text-[#1f2937]">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden bg-[#102a2d] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, #e5c478 0 1px, transparent 1px), radial-gradient(circle at 80% 70%, #e5c478 0 1px, transparent 1px)",
              backgroundSize: "34px 34px, 48px 48px",
            }}
          />
          <div className="relative">
            <div className="inline-flex items-center gap-3 text-sm font-semibold tracking-[.2em] text-[#e8c875]">
              <Building2 className="h-5 w-5" />
              LIVE COMMERCE JAPAN
            </div>
          </div>
          <div className="relative max-w-xl">
            <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e8c875]/40 bg-white/10">
              <MapPinned className="h-8 w-8 text-[#e8c875]" />
            </div>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight">
              ブランド展位
              <br />
              エントリーポータル
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-white/70">
              専用アカウントで展位を選択し、ブランド情報・Logo・背景板を安全に提出できます。
            </p>
          </div>
          <div className="relative text-xs tracking-widest text-white/45">
            INDEPENDENT BRAND ACCESS · LCJ ADMIN REVIEW
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <div className="text-xs font-bold tracking-[.18em] text-[#9a7429]">
                LIVE COMMERCE JAPAN
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#102a2d]">
                ブランド展位ポータル
              </h1>
            </div>
            <div className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_rgba(33,43,36,.12)] backdrop-blur sm:p-9">
              <div className="mb-8">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8c875]/25 text-[#7b5c1f]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-semibold text-[#102a2d]">
                  {forgotMode ? "パスワード再設定" : "ブランド担当者ログイン"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  LCJ Mall
                  の一般会員・スタッフログインとは別の専用アカウントです。
                </p>
              </div>

              <form
                className="space-y-5"
                onSubmit={event => {
                  event.preventDefault();
                  if (forgotMode) reset.mutate({ email });
                  else login.mutate({ email, password });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="exhibition-email">メールアドレス</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="exhibition-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      required
                      className="h-12 pl-10"
                      placeholder="brand@example.com"
                    />
                  </div>
                </div>
                {!forgotMode && (
                  <div className="space-y-2">
                    <Label htmlFor="exhibition-password">パスワード</Label>
                    <div className="relative">
                      <Input
                        id="exhibition-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        required
                        className="h-12 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(value => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
                        aria-label="パスワード表示切替"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={login.isPending || reset.isPending}
                  className="h-12 w-full bg-[#102a2d] text-white hover:bg-[#173b3f]"
                >
                  {forgotMode
                    ? reset.isPending
                      ? "送信中…"
                      : "再設定メールを送信"
                    : login.isPending
                      ? "ログイン中…"
                      : "ログイン"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setForgotMode(value => !value)}
                className="mt-6 w-full text-center text-sm font-medium text-[#8b6827] hover:underline"
              >
                {forgotMode ? "ログイン画面へ戻る" : "パスワードを忘れた方"}
              </button>
            </div>
            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              アカウントは LCJ
              管理者から招待されたブランド担当者のみ利用できます。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
