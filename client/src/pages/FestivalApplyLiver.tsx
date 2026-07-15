/**
 * Live Commerce Festival 2026 - ライバー＆インフルエンサー申込みフォーム
 * チャット形式（ステップバイステップ）+ 明るいフェスティバルデザイン
 * Backend API: festival.submitLiver
 */
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Mic2, CheckCircle2, Loader2, Send, PartyPopper, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';

type Step = {
  id: string;
  question: string;
  type: 'text' | 'select' | 'textarea' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
};

const STEPS: Step[] = [
  { id: 'name', question: 'まずはお名前を教えてください！ 🎤', type: 'text', placeholder: '山田 花子', required: true },
  { id: 'nameKana', question: 'フリガナもお願いします！', type: 'text', placeholder: 'ヤマダ ハナコ', required: true },
  { id: 'liverName', question: '活動名（ライバー名）は何ですか？ ✨', type: 'text', placeholder: '@hanako_live', required: true },
  { id: 'agency', question: '所属事務所はありますか？', type: 'text', placeholder: 'フリーの場合はスキップOK！', hint: '任意' },
  { id: 'accountInfo', question: 'SNSアカウント情報を教えてください！ 📱', type: 'textarea', placeholder: 'TikTok: @xxx (5万フォロワー)\nInstagram: @xxx (2万フォロワー)', hint: '任意・フォロワー数も書いてもらえると嬉しいです' },
  { id: 'genre', question: '活動ジャンルは？ 🎨', type: 'text', placeholder: '美容、ファッション、食品 等', hint: '任意' },
  { id: 'email', question: 'メールアドレスを教えてください 📧', type: 'text', placeholder: 'hanako@example.com', required: true },
  { id: 'phone', question: '電話番号もお願いします 📞', type: 'text', placeholder: '090-1234-5678', required: true },
  { id: 'lineOrLark', question: '連絡用のLINE IDまたはLarkはありますか？', type: 'text', placeholder: 'LINE ID or Lark', hint: '任意' },
  { id: 'attendanceSchedule', question: '来場希望日を選んでください！ 📅', type: 'select', required: true, options: [
    { value: 'day1_only', label: 'DAY 1（9/8）のみ' },
    { value: 'day2_only', label: 'DAY 2（9/9）のみ' },
    { value: 'both_days', label: '両日参加 🎉' },
  ]},
  { id: 'matchingPreference', question: '企業との事前マッチングを希望しますか？ 🤝', type: 'select', required: true, options: [
    { value: 'yes', label: '希望する！マッチングしたい' },
    { value: 'no', label: '今回は希望しない' },
  ]},
  { id: 'agree', question: '最後に確認です！ ✅', type: 'checkbox', required: true },
];

export default function FestivalApplyLiver() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ type: 'bot' | 'user'; text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const [accountInfo, setAccountInfo] = useState<{email: string; password: string} | null>(null);
  const mutation = trpc.festival.submitLiver.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.account) setAccountInfo(data.account);
    },
  });

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  // Show first question with typing animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(false);
      setChatHistory([{ type: 'bot', text: STEPS[0].question }]);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Focus input when step changes
  useEffect(() => {
    if (!isTyping) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentStep, isTyping]);

  const handleNext = () => {
    const step = STEPS[currentStep];
    
    // Validate
    if (step.type === 'checkbox') {
      if (!agreeTerms) return;
      setChatHistory(prev => [...prev, { type: 'user', text: '同意します ✓' }]);
      handleSubmit();
      return;
    }

    if (step.required && !inputValue.trim()) return;
    
    // Skip optional fields
    if (!step.required && !inputValue.trim()) {
      setChatHistory(prev => [...prev, { type: 'user', text: 'スキップ →' }]);
    } else {
      const displayValue = step.type === 'select' 
        ? step.options?.find(o => o.value === inputValue)?.label || inputValue
        : inputValue;
      setChatHistory(prev => [...prev, { type: 'user', text: displayValue }]);
      setAnswers(prev => ({ ...prev, [step.id]: inputValue }));
    }

    setInputValue('');
    
    // Move to next step
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
      name: answers.name || '',
      nameKana: answers.nameKana || '',
      liverName: answers.liverName || '',
      agency: answers.agency || undefined,
      accountInfo: answers.accountInfo || undefined,
      genre: answers.genre || undefined,
      email: answers.email || '',
      phone: answers.phone || '',
      lineOrLark: answers.lineOrLark || undefined,
      attendanceSchedule: (answers.attendanceSchedule as 'day1_only' | 'day2_only' | 'both_days') || 'both_days',
      matchingPreference: (answers.matchingPreference as 'yes' | 'no') || 'yes',
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-6">
            <PartyPopper className="w-16 h-16 text-purple-500 mx-auto" />
            <Sparkles className="w-6 h-6 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">お申し込み完了！ 🎉</h1>
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
          <div className="flex flex-col gap-3">
            {accountInfo && (
              <Link href="/lcf/login" className="inline-flex items-center justify-center gap-2 bg-purple-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-400 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">
                マイページにログイン
              </Link>
            )}
            <Link href="/livecommercefestival/2026" className="inline-flex items-center justify-center gap-2 text-purple-500 hover:text-purple-600 font-medium">
              <ArrowLeft className="w-4 h-4" /> フェスティバルページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-purple-100 py-3 px-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/livecommercefestival/2026" className="text-gray-400 hover:text-purple-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-sm flex items-center gap-2 text-gray-900">
              <Mic2 className="w-4 h-4 text-purple-500" />
              ライバー＆インフルエンサー お申し込み
            </h1>
            <div className="mt-1.5 h-1.5 bg-purple-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-500 ease-out"
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

          {currentStepData?.type === 'select' && !isTyping ? (
            <div className="flex flex-wrap gap-2">
              {currentStepData.options?.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setInputValue(opt.value); setTimeout(() => { setInputValue(opt.value); handleNextWithValue(opt.value); }, 0); }}
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
              <button onClick={handleNext} disabled={!agreeTerms || mutation.isPending}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2">
                {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> 送信中...</> : <><PartyPopper className="w-4 h-4" /> 申し込みを完了する</>}
              </button>
              {mutation.error && <p className="text-red-500 text-sm text-center">{mutation.error.message}</p>}
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
                className="flex-1 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 resize-none text-sm"
              />
              <button onClick={handleNext}
                className="self-end px-4 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-400 transition-colors shadow-md">
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
                className="flex-1 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 text-sm"
              />
              <button onClick={handleNext}
                className="px-4 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-400 transition-colors shadow-md">
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
    const step = STEPS[currentStep];
    const displayValue = step.options?.find(o => o.value === value)?.label || value;
    setChatHistory(prev => [...prev, { type: 'user', text: displayValue }]);
    setAnswers(prev => ({ ...prev, [step.id]: value }));
    setInputValue('');
    
    if (currentStep < STEPS.length - 1) {
      setIsTyping(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTyping(false);
        setChatHistory(prev => [...prev, { type: 'bot', text: STEPS[currentStep + 1].question }]);
      }, 600);
    }
  }
}
