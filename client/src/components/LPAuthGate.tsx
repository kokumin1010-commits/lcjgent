/**
 * LPAuthGate - 未ログインユーザー向け会員登録ポップアップゲート
 * 
 * LPページ（/products/*）で使用。
 * - 未ログイン: LPがうっすら見える背景の上に、閉じられないポップアップを表示
 * - ログイン済み（LINE/email会員）: ポップアップなし、通常表示
 * 
 * 認証はlineLogin.meを使用（LINE/email会員用）
 * ログインボタンは/line-loginに遷移せずリダイレクト
 */
import { trpc } from '@/lib/trpc';
import { Sparkles, UserPlus, ArrowRight } from 'lucide-react';

export function LPAuthGate({ children }: { children: React.ReactNode }) {
  const { data: lineUser, isLoading } = trpc.lineLogin.me.useQuery();

  // ローディング中は何も表示しない（チラつき防止）
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-white/50 text-sm">読み込み中...</div>
      </div>
    );
  }

  // ログイン済み（LINE/email会員）→ 通常表示
  if (lineUser) {
    return <>{children}</>;
  }

  // 現在のパスを取得（ログイン後のリダイレクト先）
  const currentPath = window.location.pathname;
  const registerUrl = `/line-login?redirect=${encodeURIComponent(currentPath)}&mode=register`;
  const loginUrl = `/line-login?redirect=${encodeURIComponent(currentPath)}`;

  // 未ログイン → LP背景ぼかし + ポップアップ
  return (
    <div className="relative min-h-screen">
      {/* LP本体（うっすら見える） */}
      <div className="pointer-events-none select-none filter blur-[3px] opacity-60 overflow-hidden max-h-screen">
        {children}
      </div>

      {/* オーバーレイ */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        {/* ポップアップカード */}
        <div className="relative mx-4 w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-950 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
          {/* 装飾グロー */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-blue-500/20 rounded-full blur-[80px]" />
          
          {/* アイコン */}
          <div className="relative mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          {/* タイトル */}
          <h2 className="relative text-2xl font-bold text-white mb-3">
            美容情報をお届けします
          </h2>

          {/* 説明文 */}
          <p className="relative text-white/70 text-sm leading-relaxed mb-6">
            最新の美容・ボディケア情報や、<br />
            プロが教える使い方をご覧いただくために、<br />
            <span className="text-white font-medium">無料会員登録</span>をお願いいたします。
          </p>

          {/* 特典リスト */}
          <div className="relative space-y-2 mb-8 text-left">
            {[
              '商品の正しい使い方・プロのテクニック',
              'Before/After実例写真',
              '限定キャンペーン情報のお届け',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-white/80 text-sm">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3 h-3 text-blue-400" />
                </div>
                {item}
              </div>
            ))}
          </div>

          {/* 登録ボタン */}
          <a
            href={registerUrl}
            className="relative inline-flex items-center justify-center gap-2 w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-base rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserPlus className="w-5 h-5" />
            無料会員登録して続きを見る
          </a>

          {/* ログインリンク */}
          <p className="relative mt-4 text-white/50 text-xs">
            すでにアカウントをお持ちの方は
            <a href={loginUrl} className="text-blue-400 hover:text-blue-300 underline ml-1">
              ログイン
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
