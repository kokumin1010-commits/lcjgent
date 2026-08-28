/**
 * Live Commerce Festival - ログインページ
 */
import { useState } from 'react';
import { LogIn, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';

export default function LcfLogin() {
  const [, setLocation] = useLocation();
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
      if (data.account?.accountType === 'admin') {
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
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl font-bold">Live Commerce Festival</h1>
          <p className="text-gray-400 mt-2">マイページにログイン</p>
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
          <Link href="/livecommercefestival/2026" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm">
            <ArrowLeft className="w-4 h-4" /> フェスティバルページに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
