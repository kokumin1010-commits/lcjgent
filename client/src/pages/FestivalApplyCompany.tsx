/**
 * Live Commerce Festival - 開催回別企業申込みフォーム
 * Design: existing warm festival form, with an edition-specific event strip and shared-account guidance.
 * Backend API: festival.submitCompany
 */
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Building2, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Send, PartyPopper, Sparkles, Undo2 } from 'lucide-react';
import { Link } from 'wouter';
import { parseLcfApplicationFormError } from '@/lib/lcfApplicationFormErrors';
import { trpc } from '@/lib/trpc';
import { getLcfEventByEdition } from '@shared/lcfEventDefinitions';

type Step = {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'url' | 'email' | 'password' | 'tel' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  hint?: string;
};

const COMPANY_DETAIL_STEPS: Step[] = [
  { id: 'companyName', question: '貴社名を教えてください！ 🏢', type: 'text', placeholder: '株式会社○○', required: true },
  { id: 'contactName', question: 'ご担当者様のお名前は？', type: 'text', placeholder: '山田 太郎', required: true },
  { id: 'contactDepartment', question: '担当者の部署をお願いします', type: 'text', placeholder: 'マーケティング部', required: true },
  { id: 'contactNameKana', question: 'ご担当者様のフリガナもお願いします', type: 'text', placeholder: 'ヤマダ タロウ', required: true },
  { id: 'postalCode', question: '郵便番号を教えてください 📮', type: 'text', placeholder: '100-0001', required: true },
  { id: 'address', question: '所在地をお願いします', type: 'textarea', placeholder: '東京都千代田区...', required: true },
  { id: 'phone', question: '電話番号は？ 📞', type: 'tel', placeholder: '03-1234-5678', required: true },
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

const COMPANY_EMAIL_STEP: Step = {
  id: 'email',
  question: 'メールアドレスを教えてください 📧',
  type: 'email',
  placeholder: 'info@example.com',
  required: true,
};

const COMPANY_PASSWORD_STEP: Step = {
  id: 'password',
  question: '会員様、ありがとうございます。\n第1回と同じパスワードを入力してください 🔐',
  type: 'password',
  placeholder: '既存のLCFパスワード',
  required: true,
  hint: '本人確認後、前回と同じ会社・担当者情報の再入力を省略できます',
};

type ExistingMemberFlow = 'unknown' | 'new' | 'recognized' | 'verified-reuse' | 'verified-no-profile';

function createCompanySteps(isSecondEdition: boolean, existingMemberFlow: ExistingMemberFlow): Step[] {
  const emailStep = isSecondEdition
    ? {
        ...COMPANY_EMAIL_STEP,
        question: '最初に、ご登録のメールアドレスを教えてください 📧',
        hint: '第1回で登録済みの会員様も、同じメールアドレスをご入力ください',
      }
    : COMPANY_EMAIL_STEP;
  if (isSecondEdition) {
    if (existingMemberFlow === 'recognized' || existingMemberFlow === 'verified-reuse') {
      return [emailStep, COMPANY_PASSWORD_STEP, COMPANY_DETAIL_STEPS[12], COMPANY_DETAIL_STEPS[15]];
    }
    if (existingMemberFlow === 'verified-no-profile') {
      return [emailStep, COMPANY_PASSWORD_STEP, ...COMPANY_DETAIL_STEPS];
    }
    return [emailStep, ...COMPANY_DETAIL_STEPS];
  }
  return [
    ...COMPANY_DETAIL_STEPS.slice(0, 7),
    emailStep,
    ...COMPANY_DETAIL_STEPS.slice(7),
  ];
}

const MAINTENANCE_MODE = false;

export default function FestivalApplyCompany() {
  if (MAINTENANCE_MODE) {
    window.location.href = '/';
    return null;
  }
  const event = getLcfEventByEdition(new URLSearchParams(window.location.search).get('edition'));
  const isSecondEdition = event.edition === 2;
  const [existingMemberFlow, setExistingMemberFlow] = useState<ExistingMemberFlow>('unknown');
  const steps = createCompanySteps(isSecondEdition, existingMemberFlow);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [applicationEmailStatus, setApplicationEmailStatus] = useState<'accepted' | 'failed' | null>(null);
  const [chatHistory, setChatHistory] = useState<{ type: 'bot' | 'user'; text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const [accountInfo, setAccountInfo] = useState<{email: string; password: string} | null>(null);
  const memberCheck = trpc.festival.checkMemberEmail.useMutation();
  const loginMutation = trpc.festivalAuth.login.useMutation();
  const forgotMutation = trpc.festivalAuth.forgotPassword.useMutation();
  const issueLogMutation = trpc.festival.reportApplicationFormIssue.useMutation();
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
      setChatHistory([{ type: 'bot', text: steps[0].question }]);
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
    setFormError('');
    setResetMessage('');
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
    const prevStepData = steps[prevStep];
    setInputValue(answers[prevStepData.id] || '');
    setCurrentStep(prevStep);
  };

  const handleNext = async () => {
    if (memberCheck.isPending || loginMutation.isPending) return;
    const step = steps[currentStep];
    setFormError('');
    setResetMessage('');
    
    if (step.type === 'checkbox') {
      if (!agreeTerms) return;
      setChatHistory(prev => [...prev, { type: 'user', text: '同意します ✓' }]);
      handleSubmit();
      return;
    }

    if (step.required && !inputValue.trim()) return;

    if (step.id === 'password') {
      try {
        const result = await loginMutation.mutateAsync({
          email: answers.email,
          password: inputValue,
          applicationType: 'company',
        });
        localStorage.removeItem('lcf_token');
        const reusable = result.reusableApplication;
        if (reusable) {
          const normalizedReusable = Object.fromEntries(
            Object.entries(reusable).map(([key, value]) => [key, value == null ? '' : String(value)]),
          );
          setAnswers(prev => ({ ...prev, ...normalizedReusable, email: answers.email }));
          setExistingMemberFlow('verified-reuse');
        } else {
          setExistingMemberFlow('verified-no-profile');
        }
        setInputValue('');
        setShowPassword(false);
        setIsTyping(true);
        const nextQuestion = reusable
          ? `本人確認ができました。会員様、ありがとうございます。\n第1回の会社・担当者情報を引き継ぎましたので、同じ情報の再入力は不要です。\n\n${COMPANY_DETAIL_STEPS[12].question}`
          : `本人確認ができました。会員様、ありがとうございます。\n企業・ブランド申込の共通情報を入力してください。\n\n${COMPANY_DETAIL_STEPS[0].question}`;
        setTimeout(() => {
          setCurrentStep(2);
          setIsTyping(false);
          setChatHistory(prev => [...prev, { type: 'user', text: 'パスワードを確認しました ✓' }, { type: 'bot', text: nextQuestion }]);
        }, 450);
      } catch (error: any) {
        setFormError(error?.message || 'メールアドレスまたはパスワードが正しくありません');
      }
      return;
    }

    const normalizedValue = step.id === 'email'
      ? inputValue.trim().replace(/\u3000/g, '').toLowerCase()
      : inputValue;

    if (step.id === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedValue)) {
        alert('有効なメールアドレスを入力してください');
        return;
      }
    }
    
    if (!step.required && !inputValue.trim()) {
      setChatHistory(prev => [...prev, { type: 'user', text: 'スキップ →' }]);
    } else {
      setChatHistory(prev => [...prev, { type: 'user', text: normalizedValue }]);
      setAnswers(prev => ({ ...prev, [step.id]: normalizedValue }));
    }

    setInputValue('');
    
    if (currentStep < steps.length - 1) {
      setIsTyping(true);
      let nextQuestion = steps[currentStep + 1].question;
      if (isSecondEdition && step.id === 'email') {
        try {
          const result = await memberCheck.mutateAsync({ edition: event.edition, email: normalizedValue });
          if (result.recognizedMember) {
            setExistingMemberFlow('recognized');
            nextQuestion = COMPANY_PASSWORD_STEP.question;
          } else {
            setExistingMemberFlow('new');
            nextQuestion = `メールアドレスありがとうございます。第2回のお申し込みを続けます。\n\n${COMPANY_DETAIL_STEPS[0].question}`;
          }
        } catch (error: any) {
          setIsTyping(false);
          setInputValue(normalizedValue);
          setChatHistory(prev => prev.at(-1)?.type === 'user' && prev.at(-1)?.text === normalizedValue ? prev.slice(0, -1) : prev);
          setFormError(error?.message || '会員情報を確認できませんでした。もう一度お試しください');
          return;
        }
      }
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTyping(false);
        setChatHistory(prev => [...prev, { type: 'bot', text: nextQuestion }]);
      }, 600);
    }
  };

  const handleSubmissionError = (error: unknown) => {
    const parsed = parseLcfApplicationFormError(error);
    if (answers.email) {
      issueLogMutation.mutate({
        edition: event.edition,
        applicationType: 'company',
        email: answers.email,
        fieldId: parsed.fieldId,
        errorCode: parsed.code,
        message: parsed.message,
      });
    }
    let targetSteps = steps;
    let targetIndex = parsed.fieldId ? targetSteps.findIndex(step => step.id === parsed.fieldId) : -1;
    if (targetIndex < 0 && parsed.fieldId && isSecondEdition) {
      targetSteps = createCompanySteps(true, 'verified-no-profile');
      targetIndex = targetSteps.findIndex(step => step.id === parsed.fieldId);
      if (targetIndex >= 0) setExistingMemberFlow('verified-no-profile');
    }
    if (targetIndex >= 0 && parsed.fieldId) {
      setCurrentStep(targetIndex);
      setInputValue(answers[parsed.fieldId] || '');
      setAgreeTerms(false);
      setIsTyping(false);
      setChatHistory(prev => [...prev, { type: 'bot', text: `入力内容を確認してください。\n${parsed.message}\nエラーコード: ${parsed.code}` }]);
    }
    setFormError(`${parsed.message}（エラーコード: ${parsed.code}）`);
  };

  const handleSubmit = () => {
    mutation.mutate({
      edition: event.edition,
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
    }, { onError: handleSubmissionError });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleNext();
    }
  };

  const handleSkip = () => {
    const step = steps[currentStep];
    if (!step || step.required || isTyping) return;
    setFormError('');
    setResetMessage('');
    setAnswers(prev => {
      const next = { ...prev };
      delete next[step.id];
      return next;
    });
    setChatHistory(prev => [...prev, { type: 'user', text: 'スキップ →' }]);
    setInputValue('');
    if (currentStep < steps.length - 1) {
      setIsTyping(true);
      const nextQuestion = steps[currentStep + 1].question;
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTyping(false);
        setChatHistory(prev => [...prev, { type: 'bot', text: nextQuestion }]);
      }, 600);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-6">
            <PartyPopper className="w-16 h-16 text-amber-500 mx-auto" />
            <Sparkles className="w-6 h-6 text-orange-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">お申し込み完了！ 🎉</h1>
          <p className="mb-5 text-sm font-bold leading-6 text-amber-700">{event.name}<br />{event.dateText}<br />{event.venueName}</p>
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
          {!accountInfo && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-white p-5 text-left shadow-sm">
              <p className="font-bold text-gray-900">既存のLCFアカウントをそのまま利用できます</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">同じメールアドレスで以前に登録した方は、既存のID・パスワードでマイページへログインしてください。第1回の履歴とQRは変更されません。</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {accountInfo && (
              <Link href="/lcf/login" className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-amber-400 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">
                マイページにログイン
              </Link>
            )}
            {!accountInfo && (
              <Link href="/lcf/mypage" className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-amber-400 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">
                マイページを見る
              </Link>
            )}
            <Link href={event.pagePath} className="inline-flex items-center justify-center gap-2 text-amber-600 hover:text-amber-700 font-medium">
              <ArrowLeft className="w-4 h-4" /> {event.label}開催ページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = steps[currentStep];

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
              {isSecondEdition ? '第2回 企業・ブランド お申し込み' : '企業出展・協賛 お申し込み'}
            </h1>
            <div className="mt-1.5 h-1.5 bg-amber-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-gray-400 font-medium">{currentStep + 1}/{steps.length}</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {isSecondEdition && (
            <div className="border border-amber-300 bg-white p-4 text-sm text-gray-700 shadow-sm">
              <p className="font-bold text-gray-900">{event.dateText}</p>
              <p className="mt-1">{event.venueName}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">第1回で登録済みの方も同じメールアドレスと既存アカウントを利用できます。第2回申込と新しい入場QRだけを別に発行します。</p>
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] whitespace-pre-line px-4 py-3 rounded-2xl text-sm leading-relaxed ${
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
              <button onClick={() => void handleNext()} disabled={!agreeTerms || mutation.isPending}
                className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2">
                {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> 送信中...</> : <><PartyPopper className="w-4 h-4" /> 申し込みを完了する</>}
              </button>
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
                className="min-w-0 flex-1 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 resize-none text-base"
              />
              <div className="flex self-end gap-2">
                <button onClick={() => void handleNext()} disabled={!inputValue.trim() || memberCheck.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
                  <Send className="h-4 w-4" />送信
                </button>
                {!currentStepData?.required && <button type="button" onClick={handleSkip} className="rounded-xl border border-amber-300 bg-white px-3 py-3 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-50">スキップ</button>}
              </div>
            </div>
          ) : !isTyping ? (
            <div className="flex gap-2">
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={currentStepData?.type === 'email' ? 'email' : currentStepData?.type === 'password' ? (showPassword ? 'text' : 'password') : currentStepData?.type === 'tel' ? 'tel' : currentStepData?.type === 'url' ? 'url' : 'text'}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentStepData?.placeholder}
                className="min-w-0 flex-1 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 text-base"
              />
              {currentStepData?.type === 'password' && (
                <button type="button" onClick={() => setShowPassword(prev => !prev)} aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                  className="px-3 text-gray-500 hover:text-amber-600">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              )}
              <button onClick={() => void handleNext()} disabled={!inputValue.trim() || memberCheck.isPending || loginMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
                {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : currentStepData?.type === 'password' ? <><KeyRound className="h-4 w-4" />確認</> : <><Send className="h-4 w-4" />送信</>}
              </button>
              {!currentStepData?.required && <button type="button" onClick={handleSkip} className="rounded-xl border border-amber-300 bg-white px-3 py-3 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-50">スキップ</button>}
            </div>
          ) : null}
          {formError && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{formError}</p>}
          {resetMessage && <p className="mt-2 text-sm font-medium text-green-700">{resetMessage}</p>}
          {currentStepData?.type === 'password' && !isTyping && (
            <button type="button" disabled={forgotMutation.isPending} onClick={async () => {
              try {
                const result = await forgotMutation.mutateAsync({ email: answers.email });
                setResetMessage(result.message);
              } catch (error: any) {
                setFormError(error?.message || '再設定メールを送信できませんでした');
              }
            }} className="mt-3 text-xs font-bold text-amber-700 underline underline-offset-4 disabled:opacity-50">
              {forgotMutation.isPending ? '再設定メールを送信中…' : 'パスワードをお忘れの方'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
