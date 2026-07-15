/**
 * Live Commerce Festival - マイページ
 */
import { useState } from 'react';
import { LogOut, User, Building2, Mic2, Users, Key, Loader2, CheckCircle2 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';

export default function LcfMypage() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading } = trpc.festivalAuth.me.useQuery();

  const logoutMutation = trpc.festivalAuth.logout.useMutation({
    onSuccess: () => setLocation('/lcf/login'),
  });

  // Password change
  const [showPwChange, setShowPwChange] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const changePwMutation = trpc.festivalAuth.changePassword.useMutation({
    onSuccess: () => {
      setPwMsg('パスワードを変更しました');
      setCurrentPw('');
      setNewPw('');
      setShowPwChange(false);
    },
    onError: (err) => setPwMsg(err.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400 mb-4">ログインが必要です</p>
          <Link href="/lcf/login" className="text-amber-400 hover:text-amber-300">
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  const typeLabel = me.accountType === 'company' ? '企業' : me.accountType === 'liver' ? 'ライバー' : '一般参加者';
  const TypeIcon = me.accountType === 'company' ? Building2 : me.accountType === 'liver' ? Mic2 : Users;
  const accentColor = me.accountType === 'company' ? 'amber' : me.accountType === 'liver' ? 'purple' : 'green';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 py-4 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 bg-${accentColor}-500/20 rounded-lg flex items-center justify-center`}>
              <TypeIcon className={`w-5 h-5 text-${accentColor}-400`} />
            </div>
            <div>
              <h1 className="font-bold">マイページ</h1>
              <p className="text-xs text-gray-400">{typeLabel}アカウント</p>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm"
          >
            <LogOut className="w-4 h-4" /> ログアウト
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Profile Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-14 h-14 bg-${accentColor}-500/20 rounded-full flex items-center justify-center`}>
              <User className={`w-7 h-7 text-${accentColor}-400`} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{me.displayName}</h2>
              <p className="text-gray-400 text-sm">{me.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-gray-400">アカウントタイプ</p>
              <p className="font-bold">{typeLabel}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-gray-400">ステータス</p>
              <p className="font-bold text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> 有効
              </p>
            </div>
          </div>
        </div>

        {/* Event Info */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="font-bold mb-3">イベント情報</h3>
          <div className="space-y-2 text-sm text-gray-300">
            <p>Live Commerce Festival 2026</p>
            <p>日程: 2026年9月8日（火）- 9月9日（水）</p>
            <p>会場: 八芳園（東京・白金台）</p>
          </div>
        </div>

        {/* Password Change */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <Key className="w-4 h-4" /> パスワード変更
            </h3>
            <button
              onClick={() => setShowPwChange(!showPwChange)}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              {showPwChange ? '閉じる' : '変更する'}
            </button>
          </div>
          {showPwChange && (
            <div className="space-y-3 mt-4">
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="現在のパスワード"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="新しいパスワード（6文字以上）"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
              {pwMsg && <p className="text-sm text-amber-400">{pwMsg}</p>}
              <button
                onClick={() => changePwMutation.mutate({ currentPassword: currentPw, newPassword: newPw })}
                disabled={!currentPw || newPw.length < 6 || changePwMutation.isPending}
                className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg hover:bg-amber-400 disabled:opacity-50 text-sm"
              >
                {changePwMutation.isPending ? '変更中...' : 'パスワードを変更'}
              </button>
            </div>
          )}
        </div>

        {/* Coming Soon */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-gray-400 text-sm">マッチング機能・メッセージ機能は近日公開予定です</p>
        </div>
      </div>
    </div>
  );
}
