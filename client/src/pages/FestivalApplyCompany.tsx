/**
 * Live Commerce Festival 2026 - 企業申込みフォーム
 * チャット形式（ステップバイステップ）+ 明るいフェスティバルデザイン
 * Backend API: festival.submitCompany
 */
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Building2, CheckCircle2, Loader2, Send, PartyPopper, Sparkles, Undo2 } from 'lucide-react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';

type Step = {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'url' | 'email' | 'tel' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  hint?: string;
};

const STEPS: Step[] = [
  { id: 'companyName', question: '貴社名を教えてください！ 🏢', type: 'text', placeholder: '株式会社○○', required: true },
  { id: 'contactName', question: 'ご担当者様のお名前は？', type: 'text', placeholder: '山田 太郎', required: true },
  { id: 'contactDepartment', question: '担当者の部署をお願いします', type: 'text', placeholder: 'マーケティング部', required: true },
  { id: 'contactNameKana', question: 'ご担当者様のフリガナもお願いします', type: 'text', placeholder: 'ヤマダ タロウ', required: true },
  { id: 'postalCode', question: '郵便番号を教えてください 📮', type: 'text', placeholder: '100-0001', required: true },
  { id: 'address', question: '所在地をお願いします', type: 'textarea', placeholder: '東京都千代田区...', required: true },
  { id: 'phone', question: '電話番号は？ 📞', type: 'tel', placeholder: '03-1234-5678', required: true },
  { id: 'email', question: 'メールアドレスを教えてください 📧', type: 'email', placeholder: 'info@example.com', required: true },
  { id: 'websiteUrl', question: '貴社のホームページURLは？ 🌐', type: 'url', placeholder: 'https://example.com', required: true },
  { id: 'lineOrLark', question: '連絡用のLINE IDまたはLarkはありますか？', type: 'text', placeholder: 'LINE ID or Lark', hint: '任意' },
  { id: 'tiktokShopSellerName', question: 'TikTok Shopのセラーアカウント名を教えてください 🛍️', type: 'text', placeholder: 'セラーアカウント名', required: true },
  { id: 'brandIntro', question: 'ブランド紹介文をお願いします ✨', type: 'textarea', placeholder: '100文字程度。プレスリリース等に活用させていただきます', required: true, hint: '※100文字程度' },
  { id: 'tiktokShopUrl', question: 'TikTok ShopのURLはありますか？', type: 'url', placeholder: 'https://www.tiktok.com/...', hint: '任意' },
  { id: 'matchingProducts', question: 'ライバー事前マッチング用の商材を登録しますか？ 🤝', type: 'textarea', placeholder: '商品名、特別報酬率、サンプル提供条件など（3SKUまで）', hint: '任意・後日スタッフと相談も可能です' },
  { id: 'targetAudience', question: '商品の対象ターゲットは？ 🎯', type: 'text', placeholder: '20〜30代女性、美容に関心が高い層', required: true, hint: '性別、年代、ライフスタイル等' },
  { id: 'salesLicense', question: '販売資格はありますか？ 📋', type: 'text', placeholder: '特になし / 化粧品製造販売業許可 等', required: true, hint: '酒販免許、古物商等あればご記入ください' },
  { id: 'agree', question: '最後に確認です！ ✅', type: 'checkbox', required: true },
];

const MAINTENANCE_MODE = false;

export default function FestivalApplyCompany() {
  if (MAINTENANCE_MODE) {
    window.location.href = '/';
    return null;
  }
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [applicationEmailStatus, setApplicationEmailStatus] = useState<'accepted' | 'failed' | null>(null);
  const [chatHistory, setChatHistory] = useState<{ type: 'bot' | 'user'; text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const [accountInfo, setAccountInfo] = useState<{email: string; password: string} | null>(null);
  const mutation = trpc.festival.submitCompany.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.ticketId) setTicketId(data.ticketId);
      setApplicationEmailStatus(data.applicationEmail?.status === 'accepted' ? 'accepted' : 'failed');
      if (data.account) setAccountInfo(data.account);
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(false);
      setChatHistory([{ type: 'bot', text: STEPS[0].question }]);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isTyping) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentStep, isTyping]);

  const handleBack = () => {
    if (currentStep <= 0) return;
    const prevStep = currentStep - 1;
    // Remove last bot message and last user message from chat
    setChatHistory(prev => {
      const newHistory = [...prev];
      // Remove last 2 entries (user answer + bot question)
      if (newHistory.length >= 2) {
        newHistory.pop(); // bot question for current step
        newHistory.pop(); // user answer for previous step
      }
      return newHistory;
    });
    // Restore previous answer to input
    const prevStepData = STEPS[prevStep];
    setInputValue(answers[prevStepData.id] || '');
    setCurrentStep(prevStep);
  };

  const handleNext = () => {
    const step = STEPS[currentStep];
    
    if (step.type === 'checkbox') {
      if (!agreeTerms) return;
      setChatHistory(prev => [...prev, { type: 'user', text: '同意します ✓' }]);
      handleSubmit();
      return;
    }

    if (step.required && !inputValue.trim()) return;
    
    if (!step.required && !inputValue.trim()) {
      setChatHistory(prev => [...prev, { type: 'user', text: 'スキップ →' }]);
    } else {
      setChatHistory(prev => [...prev, { type: 'user', text: inputValue }]);
      setAnswers(prev => ({ ...prev, [step.id]: inputValue }));
    }

    setInputValue('');
    
    if (currentStep < STEPS.length - 1) {
      setIsTyping(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTyping(false);
        setChatHistory(prev => [...prev, { type: 'bot', text: STEPS[currentStep + 1].question }]);
      }, 600);
    }
  };

  const handleSubmit = () => {
    mutation.mutate({
      companyName: answers.companyName || '',
      contactName: answers.contactName || '',
      contactDepartment: answers.contactDepartment || '',
      contactNameKana: answers.contactNameKana || '',
      postalCode: answers.postalCode || '',
      address: answers.address || '',
      phone: answers.phone || '',
      email: answers.email || '',
      websiteUrl: answers.websiteUrl || '',
      lineOrLark: answers.lineOrLark || undefined,
      tiktokShopSellerName: answers.tiktokShopSellerName || '',
      brandIntro: answers.brandIntro || '',
      tiktokShopUrl: answers.tiktokShopUrl || undefined,
      matchingProducts: answers.matchingProducts || undefined,
      targetAudience: answers.targetAudience || '',
      salesLicense: answers.salesLicense || '',
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-6">
            <PartyPopper className="w-16 h-16 text-amber-500 mx-auto" />
            <Sparkles className="w-6 h-6 text-orange-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">お申し込み完了！ 🎉</h1>
          {ticketId && (
            <div className="bg-white border-2 border-green-200 rounded-2xl p-5 mb-6 shadow-lg">
              <p className="text-green-600 font-bold mb-3 text-center">🎫 入場QRコード</p>
              <div className="flex justify-center mb-3">
                <QRCodeSVG value={ticketId} size={200} level="H" />
              </div>
              <p className="text-center text-sm font-mono text-gray-700 mb-2">チケットID: <strong>{ticketId}</strong></p>
              <div className="bg-yellow-50 rounded-lg p-3 mt-3">
                <p className="text-xs text-yellow-800">⚠️ このQRコードを必ずスクリーンショットで保存してください。</p>
                <p className="text-xs text-yellow-800">当日会場にてご提示いただきます。</p>
                <p className={`text-xs ${applicationEmailStatus === 'accepted' ? 'text-green-700' : 'text-yellow-800'}`}>
                  {applicationEmailStatus === 'accepted'
                    ? '申込受付完了メール（QRコード・今後の流れ）を送信しました。'
                    : 'メールサーバーの受付を確認できませんでした。上のQRコードを保存し、info@livecommercejapan.jp までお問い合わせください。'}
                </p>
              </div>
            </div>
          )}
          <p className="text-gray-600 mb-4">
            企業出展のお申し込みを受け付けました。<br />
            申込直後のメールには受付番号・QRコード・今後の流れが記載されています。<br />
            担当者より受付後3営業日以内に、次の手順または確認事項をご連絡いたします。
          </p>
          {accountInfo && (
            <div className="bg-white border-2 border-amber-200 rounded-2xl p-5 mb-6 text-left shadow-lg">
              <p className="text-amber-600 font-bold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> アカウントが作成されました
              </p>
              <p className="text-sm text-gray-600 mb-3">以下の情報でマイページにログインできます。</p>
              <div className="bg-amber-50 rounded-xl p-4 space-y-2">
                <p className="text-sm"><span className="text-gray-500">メール:</span> <span className="font-mono font-bold text-gray-900">{accountInfo.email}</span></p>
                <p className="text-sm"><span className="text-gray-500">パスワード:</span> <span className="font-mono font-bold text-gray-900">{accountInfo.password}</span></p>
              </div>
              <p className="text-xs text-gray-400 mt-2">※このパスワードは再表示できません。必ずメモしてください。</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {accountInfo && (
              <Link href="/lcf/login" className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-amber-400 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">
                マイページにログイン
              </Link>
            )}
            <Link href="/" className="inline-flex items-center justify-center gap-2 text-amber-600 hover:text-amber-700 font-medium">
              <ArrowLeft className="w-4 h-4" /> フェスティバルページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-amber-100 py-3 px-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-amber-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-sm flex items-center gap-2 text-gray-900">
              <Building2 className="w-4 h-4 text-amber-500" />
              企業出展・協賛 お申し込み
            </h1>
            <div className="mt-1.5 h-1.5 bg-amber-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-gray-400 font-medium">{currentStep + 1}/{STEPS.length}</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.type === 'user' 
                  ? 'bg-amber-500 text-white rounded-br-md shadow-md' 
                  : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-amber-100'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-amber-100">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white/90 backdrop-blur-md border-t border-amber-100 px-4 py-4 sticky bottom-0">
        <div className="max-w-2xl mx-auto">
          {currentStepData?.hint && !isTyping && (
            <p className="text-xs text-gray-400 mb-2 ml-1">{currentStepData.hint}</p>
          )}

          {/* 戻るボタン */}
          {currentStep > 0 && !isTyping && !submitted && (
            <button onClick={handleBack}
              className="mb-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-500 transition-colors">
              <Undo2 className="w-3.5 h-3.5" /> 前のステップに戻る
            </button>
          )}

          {currentStepData?.type === 'checkbox' && !isTyping ? (
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer bg-amber-50 p-4 rounded-xl border border-amber-200">
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-amber-300 text-amber-500 focus:ring-amber-500" />
                <span className="text-sm text-gray-700 leading-relaxed">
                  イベント当日の撮影・配信に同意します。また、主催者からの連絡を受け取ることに同意します。
                </span>
              </label>
              <button onClick={handleNext} disabled={!agreeTerms || mutation.isPending}
                className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2">
                {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> 送信中...</> : <><PartyPopper className="w-4 h-4" /> 申し込みを完了する</>}
              </button>
              {mutation.error && <p className="text-red-500 text-sm text-center">{(() => {
                const msg = mutation.error.message;
                try {
                  const parsed = JSON.parse(msg);
                  if (Array.isArray(parsed)) {
                    return parsed.map((e: any) => e.message || '').filter(Boolean).join('、') || '入力内容にエラーがあります。確認してください。';
                  }
                } catch {}
                return msg || '送信に失敗しました。もう一度お試しください。';
              })()}</p>}
            </div>
          ) : (currentStepData?.type === 'textarea') && !isTyping ? (
            <div className="flex gap-2">
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentStepData.placeholder}
                rows={2}
                className="flex-1 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 resize-none text-base"
              />
              <button onClick={handleNext} disabled={!!currentStepData?.required && !inputValue.trim()}
                className="self-end px-4 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md">
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : !isTyping ? (
            <div className="flex gap-2">
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={currentStepData?.type === 'email' ? 'email' : currentStepData?.type === 'tel' ? 'tel' : currentStepData?.type === 'url' ? 'url' : 'text'}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentStepData?.placeholder}
                className="flex-1 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 text-base"
              />
              <button onClick={handleNext} disabled={!!currentStepData?.required && !inputValue.trim()}
                className="px-4 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md">
                {currentStepData?.required ? <Send className="w-4 h-4" /> : <span className="text-xs font-medium">スキップ</span>}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
