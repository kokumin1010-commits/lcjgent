/**
 * Live Commerce Festival - ログインページ
 */
import { useState } from 'react';
import { LogIn, Loader2, ArrowLeft, Eye, EyeOff, Building2, Mic2, CalendarDays } from 'lucide-react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { getSafeFestivalReturn } from '@/lib/festivalPortal';

export default function LcfLogin() {
  const requestedReturn = new URLSearchParams(window.location.search).get('return');
  const safeReturn = getSafeFestivalReturn(requestedReturn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');
  const forgotMutation = trpc.festivalAuth.forgotPassword.useMutation({
    onSuccess: (data) => { setForgotError(''); setForgotSuccess(data.message); },
    onError: (err) => { setForgotError(err.message || 'エラーが発生しました'); },
  });

  const loginMutation = trpc.festivalAuth.login.useMutation({
    onSuccess: (data) => {
      // The server sets an HttpOnly Secure cookie. Remove any legacy browser token.
      localStorage.removeItem('lcf_token');
      if (safeReturn) {
        window.location.replace(safeReturn);
      } else if (data.account?.accountType === 'admin') {
        window.location.replace('/lcf/admin');
      } else {
        window.location.replace('/lcf/mypage');
      }
    },
    onError: (err) => {
      setError(err.message || 'ログインに失敗しました');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-10 text-white flex items-center justify-center">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex w-fit items-center gap-1.5">
            <span className="grid h-14 w-14 place-items-center bg-amber-400 text-sm font-black text-black">LCF</span>
            <span className="grid h-14 w-14 place-items-center border border-amber-400 text-sm font-black text-amber-300">LCM</span>
          </div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-amber-400">ONE ACCOUNT / THREE WORKSPACES</p>
          <h1 className="mt-3 text-2xl font-bold">LCF・LCM 共通ログイン</h1>
          <p className="text-gray-400 mt-2 text-sm leading-6">LCFで登録した同じメールアドレスとパスワードで、イベント・ブランド・ライバーのマイページを利用できます。</p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden border border-white/10 bg-white/10 text-center text-[10px] font-bold text-gray-300">
          <div className="bg-[#111116] px-2 py-3"><CalendarDays className="mx-auto mb-1.5 h-4 w-4 text-amber-400" />イベント</div>
          <div className="bg-[#111116] px-2 py-3"><Building2 className="mx-auto mb-1.5 h-4 w-4 text-amber-400" />ブランド</div>
          <div className="bg-[#111116] px-2 py-3"><Mic2 className="mx-auto mb-1.5 h-4 w-4 text-amber-400" />ライバー</div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
              placeholder="example@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">パスワード</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors pr-12"
                placeholder="パスワード"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); setError(''); setForgotError(''); setForgotSuccess(''); }} className="text-xs text-amber-400 hover:text-amber-300 hover:underline">
              パスワードをお忘れの方
            </button>
          </div>
          <button
            type="submit"
            disabled={loginMutation.isPending || !email || !password}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold py-3 rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loginMutation.isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> ログイン中...</>
            ) : (
              <><LogIn className="w-5 h-5" /> ログイン</>
            )}
          </button>
        </form>

        {/* Forgot Password Modal */}
        {showForgot && (
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-lg font-bold text-amber-400">パスワードリセット</h3>
            {forgotSuccess ? (
              <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3 text-green-300 text-sm">
                {forgotSuccess}
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setForgotError(''); forgotMutation.mutate({ email: forgotEmail }); }} className="space-y-4">
                <p className="text-sm text-gray-400">登録済みのメールアドレスを入力してください。1時間有効・1回のみ使用できるパスワード再設定リンクをお送りします。</p>
                {forgotError && <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">{forgotError}</div>}
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                  placeholder="メールアドレス"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={forgotMutation.isPending || !forgotEmail}
                    className="flex-1 bg-amber-500 text-black font-bold py-2.5 rounded-lg hover:brightness-110 disabled:opacity-50"
                  >
                    {forgotMutation.isPending ? '送信中...' : '再設定リンクを送信'}
                  </button>
                  <button type="button" onClick={() => { setShowForgot(false); setForgotSuccess(''); setForgotError(''); }} className="px-4 py-2.5 text-gray-400 hover:text-white rounded-lg border border-white/10">
                    キャンセル
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
        {/* Footer links */}
        <div className="mt-8 text-center space-y-3">
          <p className="text-sm text-gray-500">
            アカウントをお持ちでない方は、各申込みフォームから登録できます。
          </p>
          <Link href="/" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm">
            <ArrowLeft className="w-4 h-4" /> LCF公式TOPに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
