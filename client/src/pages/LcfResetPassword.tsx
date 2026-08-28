import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function LcfResetPassword() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token")?.trim() || "", []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState({}, document.title, "/lcf/reset-password");
  }, [token]);

  const tokenQuery = trpc.festivalAuth.verifyPasswordResetToken.useQuery(
    { token },
    { enabled: token.length >= 32, retry: false },
  );
  const resetMutation = trpc.festivalAuth.resetPasswordWithToken.useMutation({
    onSuccess: () => {
      setFormError("");
      setCompleted(true);
    },
    onError: (error) => setFormError(error.message || "パスワードを再設定できませんでした。"),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (newPassword !== confirmPassword) {
      setFormError("確認用パスワードが一致しません。");
      return;
    }
    if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setFormError("パスワードは12文字以上で、英字と数字をそれぞれ1文字以上含めてください。");
      return;
    }
    resetMutation.mutate({ token, newPassword });
  };

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">
        {content}
      </div>
    </div>
  );

  if (!token || token.length < 32) {
    return shell(
      <div className="text-center space-y-5">
        <AlertCircle className="mx-auto h-14 w-14 text-red-400" />
        <h1 className="text-xl font-bold">リンクを確認できません</h1>
        <p className="text-sm leading-relaxed text-gray-400">パスワード再設定メールに記載されたリンクを、もう一度開いてください。</p>
        <Link href="/lcf/login" className="inline-flex rounded-lg bg-amber-500 px-5 py-3 font-bold text-black">ログイン画面へ戻る</Link>
      </div>,
    );
  }

  if (tokenQuery.isLoading) {
    return shell(
      <div className="text-center space-y-4">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-400" />
        <p className="text-gray-300">リンクを確認しています...</p>
      </div>,
    );
  }

  if (!tokenQuery.data?.valid && !completed) {
    return shell(
      <div className="text-center space-y-5">
        <AlertCircle className="mx-auto h-14 w-14 text-red-400" />
        <h1 className="text-xl font-bold">このリンクは使用できません</h1>
        <p className="text-sm leading-relaxed text-gray-400">{tokenQuery.data && "message" in tokenQuery.data ? tokenQuery.data.message : "リンクが無効、使用済み、または有効期限切れです。"}</p>
        <Link href="/lcf/login" className="inline-flex rounded-lg bg-amber-500 px-5 py-3 font-bold text-black">新しいリンクをリクエストする</Link>
      </div>,
    );
  }

  if (completed) {
    return shell(
      <div className="text-center space-y-5">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
        <h1 className="text-xl font-bold">パスワードを再設定しました</h1>
        <p className="text-sm leading-relaxed text-gray-400">安全のため、以前ログインしていた端末のセッションは無効になりました。新しいパスワードでログインしてください。</p>
        <Link href="/lcf/login" className="inline-flex rounded-lg bg-amber-500 px-5 py-3 font-bold text-black">ログインする</Link>
      </div>,
    );
  }

  return shell(
    <>
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500">
          <LockKeyhole className="h-8 w-8 text-black" />
        </div>
        <h1 className="text-2xl font-bold">新しいパスワードを設定</h1>
        <p className="mt-2 text-sm text-gray-400">このリンクは1回のみ使用でき、有効期限は発行から1時間です。</p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {formError && <div className="rounded-lg border border-red-500/50 bg-red-900/30 p-3 text-sm text-red-300">{formError}</div>}
        <div>
          <label className="mb-1 block text-sm text-gray-400" htmlFor="lcf-new-password">新しいパスワード</label>
          <div className="relative">
            <input
              id="lcf-new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white outline-none transition-colors focus:border-amber-500/60"
              placeholder="12文字以上"
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white" aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示する"}>
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">12文字以上・英字と数字をそれぞれ1文字以上</p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400" htmlFor="lcf-confirm-password">新しいパスワード（確認）</label>
          <input
            id="lcf-confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={12}
            maxLength={128}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-amber-500/60"
            placeholder="もう一度入力"
          />
        </div>

        <button type="submit" disabled={resetMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
          {resetMutation.isPending ? <><Loader2 className="h-5 w-5 animate-spin" /> 再設定中...</> : "パスワードを再設定"}
        </button>
        <Link href="/lcf/login" className="block text-center text-sm text-amber-400 hover:text-amber-300">ログイン画面へ戻る</Link>
      </form>
    </>,
  );
}
