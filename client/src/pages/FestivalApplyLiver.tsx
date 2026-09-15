/**
 * Live Commerce Festival - 開催回別ライブコマーサー申込みフォーム
 * Design: existing warm festival form, with edition-scoped dates, storage and shared-account guidance.
 * Backend API: festival.submitLiver
 */
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Mic2, CheckCircle2, Loader2, Send, PartyPopper, Sparkles, Undo2 } from 'lucide-react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { getLcfEventByEdition, type LcfEventDefinition } from '@shared/lcfEventDefinitions';

type Step = {
  id: string;
  question: string;
  type: 'text' | 'email' | 'select' | 'textarea' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
};

function createSteps(event: LcfEventDefinition): Step[] {
  const emailStep: Step = {
    id: 'email',
    question: event.edition === 2
      ? '最初に、ご登録のメールアドレスを教えてください 📧'
      : 'メールアドレスを教えてください 📧',
    type: 'email',
    placeholder: 'hanako@example.com',
    required: true,
    hint: event.edition === 2
      ? '第1回で登録済みの会員様も、同じメールアドレスをご入力ください'
      : undefined,
  };
  const detailSteps: Step[] = [
  { id: 'name', question: 'まずはお名前を教えてください！ 🎤', type: 'text', placeholder: '山田 花子', required: true },
  { id: 'nameKana', question: 'フリガナもお願いします！', type: 'text', placeholder: 'ヤマダ ハナコ', required: true },
  { id: 'liverName', question: '活動名（ライバー名）は何ですか？ ✨', type: 'text', placeholder: '@hanako_live', required: true },
  { id: 'agency', question: '所属事務所はありますか？', type: 'text', placeholder: 'フリーの場合はスキップOK！', hint: '任意' },
  { id: 'accountInfo', question: 'SNSアカウント情報を教えてください！ 📱', type: 'textarea', placeholder: 'TikTok: @xxx (5万フォロワー)\nInstagram: @xxx (2万フォロワー)', hint: '任意・フォロワー数も書いてもらえると嬉しいです' },
  { id: 'genre', question: '活動ジャンルは？ 🎨', type: 'text', placeholder: '美容、ファッション、食品 等', hint: '任意' },
  { id: 'phone', question: '電話番号もお願いします 📞', type: 'text', placeholder: '090-1234-5678', required: true },
  { id: 'lineOrLark', question: '連絡用のLINE IDまたはLarkはありますか？', type: 'text', placeholder: 'LINE ID or Lark', hint: '任意' },
  { id: 'attendanceSchedule', question: '来場希望日を選んでください！ 📅', type: 'select', required: true, options: [
    { value: 'day1_only', label: `DAY 1（${event.day1ShortText}）のみ` },
    { value: 'day2_only', label: `DAY 2（${event.day2ShortText}）のみ` },
    { value: 'both_days', label: '両日参加 🎉' },
  ]},
  { id: 'matchingPreference', question: '企業との事前マッチングを希望しますか？ 🤝', type: 'select', required: true, options: [
    { value: 'yes', label: '希望する！マッチングしたい' },
    { value: 'no', label: '今回は希望しない' },
  ]},
  { id: 'agree', question: '最後に確認です！ ✅', type: 'checkbox', required: true },
  ];
  if (event.edition === 2) return [emailStep, ...detailSteps];
  return [...detailSteps.slice(0, 6), emailStep, ...detailSteps.slice(6)];
}

const MAINTENANCE_MODE = false;

export default function FestivalApplyLiver() {
  if (MAINTENANCE_MODE) {
    window.location.href = '/';
    return null;
  }
  const event = getLcfEventByEdition(new URLSearchParams(window.location.search).get('edition'));
  const isSecondEdition = event.edition === 2;
  const steps = createSteps(event);
  const storageKey = event.edition === 2
    ? `lcf_liver_form_${event.eventYear}_email_first_v2`
    : `lcf_liver_form_${event.eventYear}`;
  // LocalStorageから復元
  const savedData = (() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  })();

  const [currentStep, setCurrentStep] = useState<number>(savedData?.currentStep || 0);
  const [answers, setAnswers] = useState<Record<string, string>>(savedData?.answers || {});
  const [inputValue, setInputValue] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketEmailSent, setTicketEmailSent] = useState<boolean | null>(null);
  const [chatHistory, setChatHistory] = useState<{ type: 'bot' | 'user'; text: string }[]>(savedData?.chatHistory || []);
  const [isTyping, setIsTyping] = useState(!savedData);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const [accountInfo, setAccountInfo] = useState<{email: string; password: string} | null>(null);
  const memberCheck = trpc.festival.checkMemberEmail.useMutation();
  const mutation = trpc.festival.submitLiver.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.ticketId) setTicketId(data.ticketId);
      setTicketEmailSent(data.ticketEmailSent ?? false);
      if (data.account) setAccountInfo(data.account);
      // 送信成功したらLocalStorageをクリア
      localStorage.removeItem(storageKey);
    },
  });

  // 入力内容をLocalStorageに自動保存
  useEffect(() => {
    if (submitted) return;
    const dataToSave = { currentStep, answers, chatHistory };
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
  }, [currentStep, answers, chatHistory, submitted, storageKey]);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  // Show first question with typing animation
  useEffect(() => {
    if (savedData && savedData.chatHistory?.length > 0) return; // 復元データがある場合はスキップ
    const timer = setTimeout(() => {
      setIsTyping(false);
      setChatHistory([{ type: 'bot', text: steps[0].question }]);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Focus input when step changes
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
    const prevStepData = steps[prevStep];
    setInputValue(answers[prevStepData.id] || '');
    setCurrentStep(prevStep);
  };

  const handleNext = async () => {
    if (memberCheck.isPending) return;
    const step = steps[currentStep];
    
    // Validate
    if (step.type === 'checkbox') {
      if (!agreeTerms) return;
      // 送信前にメールアドレスの最終チェック
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!answers.email?.trim() || !emailRegex.test(answers.email.trim())) {
        alert("有効なメールアドレスを入力してください");
        return;
      }
      setChatHistory(prev => [...prev, { type: 'user', text: '同意します ✓' }]);
      handleSubmit();
      return;
    }

    if (step.required && !inputValue.trim()) return;

    const normalizedValue = step.id === 'email'
      ? inputValue.trim().replace(/\u3000/g, '').toLowerCase()
      : inputValue;

    // メールアドレスのフォーマットチェック
    if (step.id === 'email' && normalizedValue) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedValue)) {
        alert("有効なメールアドレスを入力してください");
        return;
      }
    }
    
    // Skip optional fields
    if (!step.required && !inputValue.trim()) {
      setChatHistory(prev => [...prev, { type: 'user', text: 'スキップ →' }]);
    } else {
      const displayValue = step.type === 'select' 
        ? step.options?.find(o => o.value === inputValue)?.label || inputValue
        : normalizedValue;
      setChatHistory(prev => [...prev, { type: 'user', text: displayValue }]);
      setAnswers(prev => ({ ...prev, [step.id]: normalizedValue }));
    }

    setInputValue('');
    
    // Move to next step
    if (currentStep < steps.length - 1) {
      setIsTyping(true);
      let nextQuestion = steps[currentStep + 1].question;
      if (isSecondEdition && step.id === 'email') {
        try {
          const result = await memberCheck.mutateAsync({ edition: event.edition, email: normalizedValue });
          nextQuestion = result.recognizedMember
            ? `会員様、ありがとうございます。第1回と同じアカウントで、第2回のお申し込みを続けられます。\n\n${nextQuestion}`
            : `メールアドレスありがとうございます。第2回のお申し込みを続けます。\n\n${nextQuestion}`;
        } catch {
          nextQuestion = `メールアドレスありがとうございます。第2回のお申し込みを続けます。\n\n${nextQuestion}`;
        }
      }
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTyping(false);
        setChatHistory(prev => [...prev, { type: 'bot', text: nextQuestion }]);
      }, 600);
    }
  };

  const handleSubmit = () => {
    mutation.mutate({
      edition: event.edition,
      name: answers.name || '',
      nameKana: answers.nameKana || '',
      liverName: answers.liverName || '',
      agency: answers.agency || undefined,
      accountInfo: answers.accountInfo || undefined,
      genre: answers.genre || undefined,
      email: (answers.email || '').trim(),
      phone: answers.phone || '',
      lineOrLark: answers.lineOrLark || undefined,
      attendanceSchedule: (answers.attendanceSchedule as 'day1_only' | 'day2_only' | 'both_days') || 'both_days',
      matchingPreference: (answers.matchingPreference as 'yes' | 'no') || 'yes',
      portraitRightsConsent: true,
      complianceConsent: true,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleNext();
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-6">
            <PartyPopper className="w-16 h-16 text-purple-500 mx-auto" />
            <Sparkles className="w-6 h-6 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">お申し込み完了！ 🎉</h1>
          <p className="mb-5 text-sm font-bold leading-6 text-purple-700">{event.name}<br />{event.dateText}<br />{event.venueName}</p>
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
                <p className={`text-xs ${ticketEmailSent ? 'text-green-700' : 'text-yellow-800'}`}>
                  {ticketEmailSent ? 'メールにもQRコードを送信しました。' : 'メール送信を確認できませんでした。上のQRコードを保存し、マイページでもご確認ください。'}
                </p>
              </div>
            </div>
          )}
          <p className="text-gray-600 mb-4">
            ライバー参加のお申し込みを受け付けました。<br />
            事前マッチング等の詳細は後日ご連絡いたします。
          </p>
          {accountInfo && (
            <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 mb-6 text-left shadow-lg">
              <p className="text-purple-600 font-bold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> アカウントが作成されました
              </p>
              <p className="text-sm text-gray-600 mb-3">以下の情報でマイページにログインできます。</p>
              <div className="bg-purple-50 rounded-xl p-4 space-y-2">
                <p className="text-sm"><span className="text-gray-500">メール:</span> <span className="font-mono font-bold text-gray-900">{accountInfo.email}</span></p>
                <p className="text-sm"><span className="text-gray-500">パスワード:</span> <span className="font-mono font-bold text-gray-900">{accountInfo.password}</span></p>
              </div>
              <p className="text-xs text-gray-400 mt-2">※このパスワードは再表示できません。必ずメモしてください。</p>
            </div>
          )}
          {!accountInfo && (
            <div className="mb-6 rounded-2xl border border-purple-200 bg-white p-5 text-left shadow-sm">
              <p className="font-bold text-gray-900">既存のLCFアカウントをそのまま利用できます</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">同じメールアドレスで以前に登録した方は、既存のID・パスワードでマイページへログインしてください。第1回の履歴とQRは変更されません。</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {accountInfo && (
              <Link href="/lcf/login" className="inline-flex items-center justify-center gap-2 bg-purple-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-400 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">
                マイページにログイン
              </Link>
            )}
            <Link href={event.pagePath} className="inline-flex items-center justify-center gap-2 text-purple-500 hover:text-purple-600 font-medium">
              <ArrowLeft className="w-4 h-4" /> {event.label}開催ページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-purple-100 py-3 px-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-purple-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-sm flex items-center gap-2 text-gray-900">
              <Mic2 className="w-4 h-4 text-purple-500" />
              {isSecondEdition ? '第2回 ライブコマーサー お申し込み' : 'ライバー＆インフルエンサー お申し込み'}
            </h1>
            <div className="mt-1.5 h-1.5 bg-purple-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-500 ease-out"
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
            <div className="border border-purple-300 bg-white p-4 text-sm text-gray-700 shadow-sm">
              <p className="font-bold text-gray-900">{event.dateText}</p>
              <p className="mt-1">{event.venueName}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">第1回で登録済みの方も同じメールアドレスと既存アカウントを利用できます。第2回申込と新しい入場QRだけを別に発行します。</p>
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] whitespace-pre-line px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.type === 'user' 
                  ? 'bg-purple-500 text-white rounded-br-md shadow-md' 
                  : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-purple-100'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-purple-100">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white/90 backdrop-blur-md border-t border-purple-100 px-4 py-4 sticky bottom-0">
        <div className="max-w-2xl mx-auto">
          {/* Hint */}
          {currentStepData?.hint && !isTyping && (
            <p className="text-xs text-gray-400 mb-2 ml-1">{currentStepData.hint}</p>
          )}

          {/* 戻るボタン */}
          {currentStep > 0 && !isTyping && !submitted && (
            <button onClick={handleBack}
              className="mb-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-500 transition-colors">
              <Undo2 className="w-3.5 h-3.5" /> 前のステップに戻る
            </button>
          )}

          {currentStepData?.type === 'select' && !isTyping ? (
            <div className="flex flex-wrap gap-2">
              {currentStepData.options?.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleNextWithValue(opt.value)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    inputValue === opt.value
                      ? 'bg-purple-500 text-white shadow-md scale-[1.02]'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : currentStepData?.type === 'checkbox' && !isTyping ? (
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer bg-purple-50 p-4 rounded-xl border border-purple-200">
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-purple-300 text-purple-500 focus:ring-purple-500" />
                <span className="text-sm text-gray-700 leading-relaxed">
                  イベント当日の撮影・配信に同意します。また、主催者からの連絡を受け取ることに同意します。
                </span>
              </label>
              <button onClick={() => void handleNext()} disabled={!agreeTerms || mutation.isPending}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2">
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
          ) : currentStepData?.type === 'textarea' && !isTyping ? (
            <div className="flex gap-2">
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentStepData.placeholder}
                rows={2}
                className="flex-1 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 resize-none text-base"
              />
              <button onClick={() => void handleNext()} disabled={(!!currentStepData?.required && !inputValue.trim()) || memberCheck.isPending}
                className="self-end px-4 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md">
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : !isTyping ? (
            <div className="flex gap-2">
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={currentStepData?.id === 'email' ? 'email' : currentStepData?.id === 'phone' ? 'tel' : 'text'}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentStepData?.placeholder}
                className="flex-1 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 text-base"
              />
              <button onClick={() => void handleNext()} disabled={(!!currentStepData?.required && !inputValue.trim()) || memberCheck.isPending}
                className="px-4 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md">
                {currentStepData?.required ? <Send className="w-4 h-4" /> : <span className="text-xs font-medium">スキップ</span>}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // Helper for select buttons
  function handleNextWithValue(value: string) {
    const step = steps[currentStep];
    const displayValue = step.options?.find(o => o.value === value)?.label || value;
    setChatHistory(prev => [...prev, { type: 'user', text: displayValue }]);
    setAnswers(prev => ({ ...prev, [step.id]: value }));
    setInputValue('');
    
    if (currentStep < steps.length - 1) {
      setIsTyping(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTyping(false);
        setChatHistory(prev => [...prev, { type: 'bot', text: steps[currentStep + 1].question }]);
      }, 600);
    }
  }
}
