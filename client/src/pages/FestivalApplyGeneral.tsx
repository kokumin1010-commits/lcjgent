/**
 * Live Commerce Festival 2026 - 一般参加者申込みフォーム
 * Backend API: festival.submitGeneral
 */
import { useState } from 'react';
import { ArrowLeft, Users, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';

const VISIT_PURPOSES = [
  'ライブコマースの最新トレンドを知りたい',
  'ライバーとの交流・スカウト',
  '出展企業との商談',
  'セミナー・講演の聴講',
  'ネットワーキング',
  'その他',
];

export default function FestivalApplyGeneral() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    participationType: '' as '' | 'corporate' | 'individual',
    companyName: '',
    department: '',
    name: '',
    nameKana: '',
    email: '',
    phone: '',
    attendanceSchedule: '' as '' | 'day1_only' | 'day2_only' | 'both_days',
    visitPurposes: [] as string[],
  });
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [accountInfo, setAccountInfo] = useState<{email: string; password: string} | null>(null);
  const mutation = trpc.festival.submitGeneral.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.account) setAccountInfo(data.account);
    },
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const togglePurpose = (purpose: string) => {
    setFormData(prev => ({
      ...prev,
      visitPurposes: prev.visitPurposes.includes(purpose)
        ? prev.visitPurposes.filter(p => p !== purpose)
        : [...prev.visitPurposes, purpose],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.participationType || !formData.attendanceSchedule) return;
    mutation.mutate({
      participationType: formData.participationType,
      companyName: formData.companyName,
      department: formData.department || undefined,
      name: formData.name,
      nameKana: formData.nameKana,
      email: formData.email,
      phone: formData.phone,
      attendanceSchedule: formData.attendanceSchedule,
      visitPurposes: formData.visitPurposes,
    });
  };

  const canSubmit = formData.participationType && formData.companyName && formData.name &&
    formData.nameKana && formData.email && formData.phone &&
    formData.attendanceSchedule && formData.visitPurposes.length > 0 && agreeTerms;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-4">お申し込みありがとうございます</h1>
          <p className="text-gray-400 mb-4">
            一般参加のお申し込みを受け付けました。<br />
            当日のご来場をお待ちしております。
          </p>
          {accountInfo && (
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 mb-6 text-left">
              <p className="text-green-400 font-bold mb-2">アカウントが作成されました</p>
              <p className="text-sm text-gray-300 mb-2">以下の情報でマイページにログインできます。</p>
              <div className="bg-black/40 rounded p-3 space-y-1">
                <p className="text-sm"><span className="text-gray-400">メール:</span> <span className="text-white font-mono">{accountInfo.email}</span></p>
                <p className="text-sm"><span className="text-gray-400">パスワード:</span> <span className="text-white font-mono">{accountInfo.password}</span></p>
              </div>
              <p className="text-xs text-gray-400 mt-2">※このパスワードは再表示できません。必ずメモしてください。</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {accountInfo && (
              <Link href="/lcf/login" className="inline-flex items-center justify-center gap-2 bg-green-500 text-white font-bold px-6 py-3 rounded-lg hover:bg-green-400 transition-colors">
                マイページにログイン
              </Link>
            )}
            <Link href="/livecommercefestival/2026" className="inline-flex items-center justify-center gap-2 text-amber-400 hover:text-amber-300">
              <ArrowLeft className="w-4 h-4" /> フェスティバルページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 py-4 px-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/livecommercefestival/2026" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-300" />
              一般参加 お申し込み
            </h1>
            <p className="text-xs text-gray-500">Live Commerce Festival 2026</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="block text-sm font-medium mb-1.5">参加区分 <span className="text-red-400">*</span></label>
            <select value={formData.participationType} onChange={e => updateField('participationType', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-white/30 focus:outline-none transition-colors"
              required>
              <option value="" className="bg-gray-900">選択してください</option>
              <option value="corporate" className="bg-gray-900">法人（企業関係者）</option>
              <option value="individual" className="bg-gray-900">個人</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">会社名・所属 <span className="text-red-400">*</span></label>
            <input type="text" value={formData.companyName} onChange={e => updateField('companyName', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition-colors"
              placeholder="株式会社○○ / フリーランス" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">部署 <span className="text-gray-500 text-xs">（任意）</span></label>
            <input type="text" value={formData.department} onChange={e => updateField('department', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition-colors"
              placeholder="マーケティング部" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">お名前 <span className="text-red-400">*</span></label>
              <input type="text" value={formData.name} onChange={e => updateField('name', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition-colors"
                placeholder="山田 太郎" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">フリガナ <span className="text-red-400">*</span></label>
              <input type="text" value={formData.nameKana} onChange={e => updateField('nameKana', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition-colors"
                placeholder="ヤマダ タロウ" required />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">メールアドレス <span className="text-red-400">*</span></label>
              <input type="email" value={formData.email} onChange={e => updateField('email', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition-colors"
                required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">電話番号 <span className="text-red-400">*</span></label>
              <input type="tel" value={formData.phone} onChange={e => updateField('phone', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition-colors"
                required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">来場希望日 <span className="text-red-400">*</span></label>
            <select value={formData.attendanceSchedule} onChange={e => updateField('attendanceSchedule', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-white/30 focus:outline-none transition-colors"
              required>
              <option value="" className="bg-gray-900">選択してください</option>
              <option value="day1_only" className="bg-gray-900">DAY 1（9/8）のみ</option>
              <option value="day2_only" className="bg-gray-900">DAY 2（9/9）のみ</option>
              <option value="both_days" className="bg-gray-900">両日参加</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">来場目的 <span className="text-red-400">*</span>（複数選択可）</label>
            <div className="space-y-2 mt-2">
              {VISIT_PURPOSES.map(purpose => (
                <label key={purpose} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={formData.visitPurposes.includes(purpose)}
                    onChange={() => togglePurpose(purpose)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-gray-300">{purpose}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <input type="checkbox" id="agree" checked={agreeTerms}
              onChange={e => setAgreeTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500" />
            <label htmlFor="agree" className="text-sm text-gray-400">
              イベント当日の撮影・配信に同意します。また、主催者からの連絡を受け取ることに同意します。 <span className="text-red-400">*</span>
            </label>
          </div>

          <div className="pt-4">
            <button type="submit" disabled={!canSubmit || mutation.isPending}
              className="w-full sm:w-auto px-8 py-3 bg-white hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
              {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> 送信中...</> : '申し込む'}
            </button>
          </div>

          {mutation.error && (
            <p className="text-red-400 text-sm mt-2">{mutation.error.message}</p>
          )}
        </form>
      </div>
    </div>
  );
}
