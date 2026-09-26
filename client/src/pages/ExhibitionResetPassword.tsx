import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ExhibitionResetPassword() {
  const [, params] = useRoute("/booth-portal/reset-password/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const validation = trpc.exhibitionAuth.validateResetToken.useQuery(
    { token },
    { retry: false, enabled: Boolean(token) }
  );
  const reset = trpc.exhibitionAuth.resetPassword.useMutation({
    onSuccess: data => {
      setDone(true);
      toast.success(data.message);
    },
    onError: error => toast.error(error.message),
  });

  if (validation.isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f0e7] text-sm text-slate-500">
        確認中…
      </div>
    );
  if (validation.isError || !validation.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f0e7] p-5">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <KeyRound className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-4 text-xl font-semibold">リンクを確認できません</h1>
          <p className="mt-2 text-sm text-slate-500">
            リンクが無効または期限切れです。ログイン画面から再設定メールを送信してください。
          </p>
          <Link
            href="/booth-portal/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#102a2d] px-5 text-sm font-semibold text-white"
          >
            ログイン画面へ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f0e7] p-5">
      <div className="w-full max-w-md rounded-[28px] border border-white bg-white/95 p-7 shadow-[0_24px_70px_rgba(33,43,36,.14)] sm:p-9">
        {done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-5 text-2xl font-semibold text-[#102a2d]">
              設定が完了しました
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              新しいパスワードでログインしてください。
            </p>
            <Button
              onClick={() => setLocation("/booth-portal/login")}
              className="mt-7 h-11 w-full bg-[#102a2d]"
            >
              ログイン画面へ
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8c875]/25 text-[#7b5c1f]">
                <KeyRound className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-semibold text-[#102a2d]">
                {validation.data.purpose === "set_password"
                  ? "初回パスワード設定"
                  : "パスワード再設定"}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {validation.data.companyName} · {validation.data.displayName} 様
              </p>
            </div>
            <form
              className="space-y-5"
              onSubmit={event => {
                event.preventDefault();
                if (password !== confirm)
                  return toast.error("確認用パスワードが一致しません");
                reset.mutate({ token, password });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="new-password">新しいパスワード</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    minLength={12}
                    required
                    className="h-12 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(value => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400"
                  >
                    {show ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  12文字以上・英字と数字を含めてください。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">パスワード確認</Label>
                <Input
                  id="confirm-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={event => setConfirm(event.target.value)}
                  minLength={12}
                  required
                  className="h-12"
                />
              </div>
              <Button
                type="submit"
                disabled={reset.isPending}
                className="h-12 w-full bg-[#102a2d] hover:bg-[#173b3f]"
              >
                {reset.isPending ? "設定中…" : "パスワードを設定"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
