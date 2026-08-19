/**
 * Live Commerce Festival 2026 - 一般参加者申込みフォーム
 * Traditional form layout matching the official application form
 * Backend API: festival.submitGeneral
 */
import { useState } from 'react';
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';

const INDUSTRY_OPTIONS = [
  'ブランド', 'メーカー', 'EC事業者', 'MCN', '広告代理店',
  'サービス企業', '物流企業', 'メディア', '投資機関', 'その他',
];

const VISIT_PURPOSES = [
  'ライブコマース・TikTok Shopの最新トレンドやノウハウの情報収集',
  '出展企業（メーカーやブランド）との商談・ネットワーキング',
  'クリエイター・ライバー・MCNとのネットワーキング',
  '自社の次回以降の出展に向けた視察',
  'セミナー・講演の聴講',
  '商品仕入れ、ネットワーキング',
  'その他',
];

export default function FestivalApplyGeneral() {
  const [form, setForm] = useState({
    visitorType: 'general' as 'general' | 'company' | 'liver',
    participationType: '' as '' | 'corporate' | 'individual',
    name: '',
    nameKana: '',
    brandName: '',
    email: '',
    phone: '',
    lineOrLark: '',
    industryTypes: [] as string[],
    visitPurposes: [] as string[],
    attendanceSchedule: '' as '' | 'day1_only' | 'day2_only' | 'both_days',
    portraitConsent: false,
    complianceConsent: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<{ email: string; password: string } | null>(null);

  const mutation = trpc.festival.submitGeneral.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.ticketId) setTicketId(data.ticketId);
      if (data.account) setAccountInfo({ email: form.email, password: data.account.password });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.participationType || !form.name || !form.email || !form.phone || !form.attendanceSchedule) return;
    if (form.visitPurposes.length === 0) return;
    if (!form.portraitConsent || !form.complianceConsent) return;

    mutation.mutate({
      participationType: form.participationType,
      companyName: form.brandName || form.name,
      department: form.industryTypes.join(', '),
      name: form.name,
      nameKana: form.nameKana || form.name,
      email: form.email,
      phone: form.phone,
      attendanceSchedule: form.attendanceSchedule,
      visitPurposes: form.visitPurposes,
      lineOrLark: form.lineOrLark || undefined,
      brandName: form.brandName || undefined,
      industryTypes: form.industryTypes.length > 0 ? form.industryTypes : undefined,
    });
  };

  const toggleIndustry = (item: string) => {
    setForm(prev => ({
      ...prev,
      industryTypes: prev.industryTypes.includes(item)
        ? prev.industryTypes.filter(i => i !== item)
        : [...prev.industryTypes, item],
    }));
  };

  const togglePurpose = (item: string) => {
    setForm(prev => ({
      ...prev,
      visitPurposes: prev.visitPurposes.includes(item)
        ? prev.visitPurposes.filter(i => i !== item)
        : [...prev.visitPurposes, item],
    }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">お申し込み完了</h2>
          <p className="text-gray-600 mb-6">
            一般参加のお申し込みを受け付けました。<br />
            ご登録のメールアドレスに確認メールをお送りします。
          </p>
          {ticketId && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-500 mb-2">チケットID</p>
              <p className="font-mono text-lg font-bold text-gray-900">{ticketId}</p>
              <div className="mt-3 flex justify-center">
                <QRCodeSVG value={ticketId} size={120} />
              </div>
              <p className="text-xs text-gray-400 mt-2">当日受付でこのQRコードをご提示ください</p>
            </div>
          )}
          {accountInfo && (
            <div className="bg-blue-50 rounded-xl p-4 mb-4 text-left">
              <p className="text-sm font-medium text-blue-800 mb-1">マイページアカウント</p>
              <p className="text-xs text-blue-600">メール: {accountInfo.email}</p>
              <p className="text-xs text-blue-600">パスワード: {accountInfo.password}</p>
            </div>
          )}
          <Link href="/" className="inline-block mt-4 text-green-600 hover:text-green-700 font-medium">
            ← トップページに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> トップに戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">一般参加 お申し込み</h1>
          <p className="text-sm text-gray-500 mt-1">Live Commerce Festival 2026</p>
          <p className="text-xs text-gray-400 mt-1">E-mail: info@livecommercejapan.jp</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* 来場区分 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <span className="text-red-500">*</span> 来場区分
            </label>
            <div className="space-y-2">
              {[
                { value: 'general', label: '一般来場者' },
                { value: 'company', label: '出展企業' },
                { value: 'liver', label: 'ライバー・インフルエンサー' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visitorType"
                    value={opt.value}
                    checked={form.visitorType === opt.value}
                    onChange={e => {
                      const val = e.target.value as any;
                      setForm(prev => ({ ...prev, visitorType: val }));
                      if (val === 'company') window.location.href = '/livecommercefestival/2026/apply/company';
                      if (val === 'liver') window.location.href = '/livecommercefestival/2026/apply/liver';
                    }}
                    className="w-4 h-4 text-red-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 参加区分 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <span className="text-red-500">*</span> 参加区分
            </label>
            <div className="space-y-2">
              {[
                { value: 'corporate', label: '法人・企業として参加' },
                { value: 'individual', label: '個人として参加' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="participationType"
                    value={opt.value}
                    checked={form.participationType === opt.value}
                    onChange={e => setForm(prev => ({ ...prev, participationType: e.target.value as any }))}
                    className="w-4 h-4 text-red-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* お名前 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              <span className="text-red-500">*</span> お名前
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
              required
            />
          </div>

          {/* フリガナ */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              お名前（フリガナ）
            </label>
            <input
              type="text"
              value={form.nameKana}
              onChange={e => setForm(prev => ({ ...prev, nameKana: e.target.value }))}
              placeholder="入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
            />
          </div>

          {/* ブランド名 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              ブランド名
            </label>
            <input
              type="text"
              value={form.brandName}
              onChange={e => setForm(prev => ({ ...prev, brandName: e.target.value }))}
              placeholder="入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
            />
          </div>

          {/* メールアドレス */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              <span className="text-red-500">*</span> メールアドレス
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
              required
            />
          </div>

          {/* 電話番号 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              <span className="text-red-500">*</span> 電話番号
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
              required
            />
          </div>

          {/* LINE or Lark or wechat */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              <span className="text-red-500">*</span> LINE or Lark or wechat　※あれば
            </label>
            <input
              type="text"
              value={form.lineOrLark}
              onChange={e => setForm(prev => ({ ...prev, lineOrLark: e.target.value }))}
              placeholder="入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
            />
          </div>

          {/* 業種・所属 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              <span className="text-red-500">*</span> 業種・所属
            </label>
            <p className="text-xs text-gray-500 mb-2">業種・所属を1つ以上選択してください。</p>
            <div className="space-y-2">
              {INDUSTRY_OPTIONS.map(item => (
                <label key={item} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.industryTypes.includes(item)}
                    onChange={() => toggleIndustry(item)}
                    className="w-4 h-4 rounded border-gray-300 text-green-500"
                  />
                  <span className="text-sm text-gray-700">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 本イベントへのご来場目的 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              <span className="text-red-500">*</span> 本イベントへのご来場目的（複数選択可）
            </label>
            <div className="space-y-2">
              {VISIT_PURPOSES.map(item => (
                <label key={item} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.visitPurposes.includes(item)}
                    onChange={() => togglePurpose(item)}
                    className="w-4 h-4 rounded border-gray-300 text-green-500"
                  />
                  <span className="text-sm text-gray-700">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ご来場スケジュール */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              <span className="text-red-500">*</span> ご来場スケジュール
            </label>
            <p className="text-xs text-gray-500 mb-2">※主催側がご来場スケジュールに応じて、ブランド紹介やイベント調整を行う可能性がございます。</p>
            <div className="space-y-2">
              {[
                { value: 'day1_only', label: '9月8日（火）DAY1 のみ参加' },
                { value: 'day2_only', label: '9月9日（水）DAY2 のみ参加' },
                { value: 'both_days', label: '両日参加' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="attendanceSchedule"
                    value={opt.value}
                    checked={form.attendanceSchedule === opt.value}
                    onChange={e => setForm(prev => ({ ...prev, attendanceSchedule: e.target.value as any }))}
                    className="w-4 h-4 text-red-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 肖像権に関する同意 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <span className="text-red-500">*</span> 肖像権に関する同意
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.portraitConsent}
                onChange={e => setForm(prev => ({ ...prev, portraitConsent: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-green-500 mt-0.5"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                本イベントは公式による映像収録・写真撮影が行われ、PR資料や配信媒体に映り込む可能性があることに同意します。
              </span>
            </label>
          </div>

          {/* コンプライアンスに関する同意 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              <span className="text-red-500">*</span> コンプライアンスに関する同意
            </label>
            <p className="text-xs text-gray-500 mb-2">コンプライアンスに関する同意</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.complianceConsent}
                onChange={e => setForm(prev => ({ ...prev, complianceConsent: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-green-500 mt-0.5"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                イベント会場内でのライブ配信において、プラットフォームコミュニティガイドラインおよび販売ポリシーを遵守することに同意します。
              </span>
            </label>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={mutation.isPending || !form.participationType || !form.name || !form.email || !form.phone || !form.attendanceSchedule || form.visitPurposes.length === 0 || !form.portraitConsent || !form.complianceConsent}
              className="w-full sm:w-auto px-8 py-3 bg-red-400 hover:bg-red-500 text-white font-bold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> 送信中...</> : 'お申し込み'}
            </button>
            {mutation.error && (
              <p className="text-red-500 text-sm mt-2">{mutation.error.message || '送信に失敗しました。もう一度お試しください。'}</p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400">
          <p>© 2026 Live Commerce Festival 実行委員会. All Rights Reserved.</p>
        </div>
      </div>
    </div>
  );
}
