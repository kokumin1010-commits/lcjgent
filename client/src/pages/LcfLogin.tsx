/**
 * Live Commerce Festival - ログインページ
 */
import { useState } from 'react';
import { LogIn, Loader2, ArrowLeft, Eye, EyeOff, Building2, Mic2, CalendarDays, UserPlus, Check } from 'lucide-react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { getSafeFestivalReturn } from '@/lib/festivalPortal';

export default function LcfLogin() {
  const searchParams = new URLSearchParams(window.location.search);
  const requestedReturn = searchParams.get('return');
  const safeReturn = getSafeFestivalReturn(requestedReturn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>(() => searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [registerPurpose, setRegisterPurpose] = useState<'company' | 'creator' | 'event'>('company');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [registerTermsAccepted, setRegisterTermsAccepted] = useState(false);
  const [registerError, setRegisterError] = useState('');
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
      } else {
        window.location.replace(data.portal?.defaultPath || '/lcf/mypage');
      }
    },
    onError: (err) => {
      setError(err.message || 'ログインに失敗しました');
    },
  });

  const registerMutation = trpc.festivalAuth.register.useMutation({
    onSuccess: (data) => {
      localStorage.removeItem('lcf_token');
      window.location.replace(safeReturn || data.portal.defaultPath);
    },
    onError: (err) => {
      setRegisterError(err.message || '新規登録に失敗しました');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    if (registerPassword !== registerPasswordConfirm) {
      setRegisterError('確認用パスワードが一致しません');
      return;
    }
    if (!registerTermsAccepted) {
      setRegisterError('登録条件への同意が必要です');
      return;
    }
    registerMutation.mutate({
      email: registerEmail,
      password: registerPassword,
      displayName: registerDisplayName,
      purpose: registerPurpose,
      termsAccepted: true,
    });
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
          <p className="text-gray-400 mt-2 text-sm leading-6">1つのアカウントで、イベント・ブランド・ライブコマーサーのマイページを利用できます。</p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden border border-white/10 bg-white/10 text-center text-[10px] font-bold text-gray-300">
          <div className="bg-[#111116] px-2 py-3"><CalendarDays className="mx-auto mb-1.5 h-4 w-4 text-amber-400" />イベント</div>
          <div className="bg-[#111116] px-2 py-3"><Building2 className="mx-auto mb-1.5 h-4 w-4 text-amber-400" />ブランド</div>
          <div className="bg-[#111116] px-2 py-3"><Mic2 className="mx-auto mb-1.5 h-4 w-4 text-amber-400" />ライブコマーサー</div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-px border border-white/10 bg-white/10 p-px text-sm font-bold">
          <button type="button" onClick={() => { setMode('login'); setRegisterError(''); }} className={`min-h-12 ${mode === 'login' ? 'bg-amber-400 text-black' : 'bg-[#111116] text-gray-300 hover:text-white'}`}><LogIn className="mr-2 inline h-4 w-4" />ログイン</button>
          <button type="button" onClick={() => { setMode('register'); setError(''); setShowForgot(false); }} className={`min-h-12 ${mode === 'register' ? 'bg-amber-400 text-black' : 'bg-[#111116] text-gray-300 hover:text-white'}`}><UserPlus className="mr-2 inline h-4 w-4" />新規登録</button>
        </div>

        {mode === 'login' ? <>
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
        </> : <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <p className="mb-3 text-sm font-bold text-white">利用目的を選択してください</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                { key: 'company' as const, label: '企業・ブランド', icon: Building2 },
                { key: 'creator' as const, label: 'ライブコマーサー', icon: Mic2 },
                { key: 'event' as const, label: 'イベント参加・情報閲覧', icon: CalendarDays },
              ]).map((item) => {
                const Icon = item.icon;
                const selected = registerPurpose === item.key;
                return <button key={item.key} type="button" onClick={() => setRegisterPurpose(item.key)} aria-pressed={selected} className={`relative min-h-24 border p-3 text-center text-xs font-bold transition-colors ${selected ? 'border-amber-400 bg-amber-400/10 text-amber-300' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/30'}`}><Icon className="mx-auto mb-2 h-5 w-5" />{item.label}{selected && <Check className="absolute right-2 top-2 h-4 w-4 text-amber-400" />}</button>;
              })}
            </div>
          </div>

          {registerError && <div className="rounded-lg border border-red-500/50 bg-red-900/30 p-3 text-sm text-red-300">{registerError}</div>}

          <div><label className="mb-1 block text-sm text-gray-400">表示名</label><input type="text" value={registerDisplayName} onChange={(e) => setRegisterDisplayName(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors focus:border-amber-500/50" placeholder={registerPurpose === 'company' ? '担当者名' : registerPurpose === 'creator' ? '活動名・お名前' : 'お名前'} maxLength={255} required /></div>
          <div><label className="mb-1 block text-sm text-gray-400">メールアドレス</label><input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors focus:border-amber-500/50" placeholder="example@company.com" required /></div>
          <div><label className="mb-1 block text-sm text-gray-400">パスワード</label><input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors focus:border-amber-500/50" placeholder="英字と数字を含む6文字以上" minLength={6} maxLength={128} required /><p className="mt-1.5 text-[11px] leading-5 text-gray-500">6文字以上で、英字と数字をそれぞれ1文字以上含めてください。</p></div>
          <div><label className="mb-1 block text-sm text-gray-400">パスワード（確認）</label><input type="password" value={registerPasswordConfirm} onChange={(e) => setRegisterPasswordConfirm(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors focus:border-amber-500/50" placeholder="もう一度入力" minLength={6} maxLength={128} required /></div>
          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-gray-300"><input type="checkbox" checked={registerTermsAccepted} onChange={(e) => setRegisterTermsAccepted(e.target.checked)} className="mt-1" required /><span>共通アカウントの作成と、登録情報を選択したマイページの初期設定に利用することへ同意します。企業・ブランドまたはライブコマーサーを選んだ場合は、登録後すぐにLCMの該当マイページを利用できます。イベント申込・QRは自動作成されません。<Link href="/legal/privacy" className="ml-1 text-amber-400 hover:underline">プライバシーポリシー</Link></span></label>
          <button type="submit" disabled={registerMutation.isPending || !registerDisplayName || !registerEmail || !registerPassword || !registerPasswordConfirm || !registerTermsAccepted} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{registerMutation.isPending ? <><Loader2 className="h-5 w-5 animate-spin" />登録中...</> : <><UserPlus className="h-5 w-5" />共通アカウントを作成</>}</button>
          <p className="text-center text-xs leading-6 text-gray-500">登録後は選択したマイページへ進みます。第2回LCFへの参加は、必要な時に同じアカウントで別途申し込めます。</p>
        </form>}
        {/* Footer links */}
        <div className="mt-8 text-center space-y-3">
          <p className="text-sm text-gray-500">{mode === 'login' ? '初めての方は「新規登録」から共通アカウントを作成できます。' : 'すでにアカウントをお持ちの方は「ログイン」へお戻りください。'}</p>
          <Link href="/" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm">
            <ArrowLeft className="w-4 h-4" /> LCF公式TOPに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
