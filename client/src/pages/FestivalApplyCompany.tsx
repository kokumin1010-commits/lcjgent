/**
 * Live Commerce Festival 2026 - 企業申込みフォーム
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';

export default function FestivalApplyCompany() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    contactDepartment: '',
    contactNameKana: '',
    postalCode: '',
    address: '',
    phone: '',
    email: '',
    websiteUrl: '',
    lineOrLark: '',
    tiktokShopSellerName: '',
    brandIntro: '',
    tiktokShopUrl: '',
    matchingProducts: '',
    targetAudience: '',
    salesLicense: '',
  });

  const [accountInfo, setAccountInfo] = useState<{email: string; password: string} | null>(null);
  const mutation = trpc.festival.submitCompany.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.account) setAccountInfo(data.account);
    },
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const canProceedStep1 = formData.companyName && formData.contactName && formData.contactDepartment &&
    formData.contactNameKana && formData.postalCode && formData.address &&
    formData.phone && formData.email && formData.websiteUrl;

  const canSubmit = formData.tiktokShopSellerName && formData.brandIntro &&
    formData.targetAudience && formData.salesLicense;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-amber-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-4">お申し込みありがとうございます</h1>
          <p className="text-gray-400 mb-4">
            企業出展のお申し込みを受け付けました。<br />
            担当者より3営業日以内にご連絡いたします。
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
              <Link href="/lcf/login" className="inline-flex items-center justify-center gap-2 bg-amber-500 text-black font-bold px-6 py-3 rounded-lg hover:bg-amber-400 transition-colors">
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
              <Building2 className="w-5 h-5 text-amber-400" />
              企業出展・協賛 お申し込み
            </h1>
            <p className="text-xs text-gray-500">Live Commerce Festival 2026</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-8">
          <div className={`flex-1 h-1 rounded ${step >= 1 ? 'bg-amber-500' : 'bg-white/10'}`} />
          <div className={`flex-1 h-1 rounded ${step >= 2 ? 'bg-amber-500' : 'bg-white/10'}`} />
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold mb-6">基本情報</h2>
              
              <div>
                <label className="block text-sm font-medium mb-1.5">貴社名 <span className="text-red-400">*</span></label>
                <input type="text" value={formData.companyName} onChange={e => updateField('companyName', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  placeholder="株式会社○○" required />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">ご担当者様名 <span className="text-red-400">*</span></label>
                  <input type="text" value={formData.contactName} onChange={e => updateField('contactName', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                    placeholder="山田 太郎" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">担当者部署 <span className="text-red-400">*</span></label>
                  <input type="text" value={formData.contactDepartment} onChange={e => updateField('contactDepartment', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                    placeholder="マーケティング部" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">ご担当者様名（フリガナ） <span className="text-red-400">*</span></label>
                <input type="text" value={formData.contactNameKana} onChange={e => updateField('contactNameKana', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  placeholder="ヤマダ タロウ" required />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">郵便番号 <span className="text-red-400">*</span></label>
                  <input type="text" value={formData.postalCode} onChange={e => updateField('postalCode', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                    placeholder="100-0001" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">電話番号 <span className="text-red-400">*</span></label>
                  <input type="tel" value={formData.phone} onChange={e => updateField('phone', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                    placeholder="03-1234-5678" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">所在地 <span className="text-red-400">*</span></label>
                <textarea value={formData.address} onChange={e => updateField('address', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  placeholder="東京都千代田区..." rows={2} required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">メールアドレス <span className="text-red-400">*</span></label>
                <input type="email" value={formData.email} onChange={e => updateField('email', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  placeholder="info@example.com" required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">ホームページURL <span className="text-red-400">*</span></label>
                <input type="url" value={formData.websiteUrl} onChange={e => updateField('websiteUrl', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  placeholder="https://example.com" required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">連絡用LINE or Lark <span className="text-gray-500 text-xs">（任意）</span></label>
                <input type="text" value={formData.lineOrLark} onChange={e => updateField('lineOrLark', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  placeholder="LINE ID or Lark" />
              </div>

              <div className="pt-4">
                <button type="button" onClick={() => setStep(2)} disabled={!canProceedStep1}
                  className="w-full sm:w-auto px-8 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                  次へ <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold mb-2">TikTok Shop 運用状況＆事前マッチングサービス商材登録</h2>
              <p className="text-sm text-gray-400 mb-6">
                ライバーが「売りたい！」と思えるよう、魅力的な特別条件やアピールポイントをご記載ください。
              </p>

              <div>
                <label className="block text-sm font-medium mb-1.5">TikTok Shop セラーアカウント名 <span className="text-red-400">*</span></label>
                <input type="text" value={formData.tiktokShopSellerName} onChange={e => updateField('tiktokShopSellerName', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">ブランド紹介文 <span className="text-red-400">*</span></label>
                <p className="text-xs text-gray-500 mb-1.5">※100文字程度。後日プレスリリース宣伝などに活用させていただきます。</p>
                <textarea value={formData.brandIntro} onChange={e => updateField('brandIntro', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  rows={3} required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">TikTok Shop URL <span className="text-gray-500 text-xs">（任意）</span></label>
                <input type="url" value={formData.tiktokShopUrl} onChange={e => updateField('tiktokShopUrl', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">ライバー事前マッチングサービス 商材登録 <span className="text-gray-500 text-xs">（任意）</span></label>
                <p className="text-xs text-gray-500 mb-1.5">※マッチング希望者のみ。3SKUまで。後日スタッフと相談も可能です。</p>
                <textarea value={formData.matchingProducts} onChange={e => updateField('matchingProducts', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  rows={4} placeholder="商品名、特別報酬率、サンプル提供条件など" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">商品対象ターゲット <span className="text-red-400">*</span></label>
                <p className="text-xs text-gray-500 mb-1.5">※性別、年代、ライフスタイル、収入状況等</p>
                <input type="text" value={formData.targetAudience} onChange={e => updateField('targetAudience', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  placeholder="20〜30代女性、美容に関心が高い層" required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">販売資格 <span className="text-red-400">*</span></label>
                <p className="text-xs text-gray-500 mb-1.5">※酒販免許、古物商等あればご記入ください</p>
                <input type="text" value={formData.salesLicense} onChange={e => updateField('salesLicense', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  placeholder="特になし / 化粧品製造販売業許可 等" required />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors">
                  戻る
                </button>
                <button type="submit" disabled={!canSubmit || mutation.isPending}
                  className="flex-1 sm:flex-none px-8 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                  {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> 送信中...</> : '申し込む'}
                </button>
              </div>

              {mutation.error && (
                <p className="text-red-400 text-sm mt-2">{mutation.error.message}</p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
