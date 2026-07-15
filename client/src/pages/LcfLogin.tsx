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

  const loginMutation = trpc.festivalAuth.login.useMutation({
    onSuccess: () => {
      setLocation('/lcf/mypage');
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
