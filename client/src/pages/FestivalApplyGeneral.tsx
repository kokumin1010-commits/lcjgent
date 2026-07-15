/**
 * Live Commerce Festival 2026 - 一般参加者申込みフォーム
 * チャット形式（ステップバイステップ）+ 明るいフェスティバルデザイン
 * Backend API: festival.submitGeneral
 */
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Users, CheckCircle2, Loader2, Send, PartyPopper, Sparkles } from 'lucide-react';
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

type Step = {
  id: string;
  question: string;
  type: 'text' | 'select' | 'email' | 'tel' | 'multi-select' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
};

const STEPS: Step[] = [
  { id: 'participationType', question: '参加区分を選んでください！ 🎫', type: 'select', required: true, options: [
    { value: 'corporate', label: '法人（企業関係者）' },
    { value: 'individual', label: '個人' },
  ]},
  { id: 'companyName', question: '会社名・所属を教えてください 🏢', type: 'text', placeholder: '株式会社○○ / フリーランス', required: true },
  { id: 'department', question: '部署はありますか？', type: 'text', placeholder: 'マーケティング部', hint: '任意' },
  { id: 'name', question: 'お名前を教えてください！ 😊', type: 'text', placeholder: '山田 太郎', required: true },
  { id: 'nameKana', question: 'フリガナもお願いします', type: 'text', placeholder: 'ヤマダ タロウ', required: true },
  { id: 'email', question: 'メールアドレスを教えてください 📧', type: 'email', placeholder: 'taro@example.com', required: true },
  { id: 'phone', question: '電話番号もお願いします 📞', type: 'tel', placeholder: '090-1234-5678', required: true },
  { id: 'attendanceSchedule', question: '来場希望日を選んでください！ 📅', type: 'select', required: true, options: [
    { value: 'day1_only', label: 'DAY 1（9/8）のみ' },
    { value: 'day2_only', label: 'DAY 2（9/9）のみ' },
    { value: 'both_days', label: '両日参加 🎉' },
  ]},
  { id: 'visitPurposes', question: '来場目的を教えてください！（複数選択OK）🎯', type: 'multi-select', required: true },
  { id: 'agree', question: '最後に確認です！ ✅', type: 'checkbox', required: true },
];

export default function FestivalApplyGeneral() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ type: 'bot' | 'user'; text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [accountInfo, setAccountInfo] = useState<{email: string; password: string} | null>(null);
  const mutation = trpc.festival.submitGeneral.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
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

  const advanceToNext = () => {
    if (currentStep < STEPS.length - 1) {
      setIsTyping(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTyping(false);
        setChatHistory(prev => [...prev, { type: 'bot', text: STEPS[currentStep + 1].question }]);
      }, 600);
    }
  };

  const handleNext = () => {
    const step = STEPS[currentStep];
    
    if (step.type === 'checkbox') {
      if (!agreeTerms) return;
      setChatHistory(prev => [...prev, { type: 'user', text: '同意します ✓' }]);
      handleSubmit();
      return;
    }

    if (step.type === 'multi-select') {
      if (selectedPurposes.length === 0) return;
      setChatHistory(prev => [...prev, { type: 'user', text: selectedPurposes.join('、') }]);
      advanceToNext();
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
    advanceToNext();
  };

  const handleSelectOption = (value: string, label: string) => {
    setChatHistory(prev => [...prev, { type: 'user', text: label }]);
    setAnswers(prev => ({ ...prev, [STEPS[currentStep].id]: value }));
    setInputValue('');
    advanceToNext();
  };

  const handleSubmit = () => {
    mutation.mutate({
      participationType: (answers.participationType as 'corporate' | 'individual') || 'individual',
      companyName: answers.companyName || '',
      department: answers.department || undefined,
      name: answers.name || '',
      nameKana: answers.nameKana || '',
      email: answers.email || '',
      phone: answers.phone || '',
      attendanceSchedule: (answers.attendanceSchedule as 'day1_only' | 'day2_only' | 'both_days') || 'both_days',
      visitPurposes: selectedPurposes,
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-6">
            <PartyPopper className="w-16 h-16 text-green-500 mx-auto" />
            <Sparkles className="w-6 h-6 text-teal-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">お申し込み完了！ 🎉</h1>
          <p className="text-gray-600 mb-4">
            一般参加のお申し込みを受け付けました。<br />
            当日のご来場をお待ちしております！
          </p>
          {accountInfo && (
            <div className="bg-white border-2 border-green-200 rounded-2xl p-5 mb-6 text-left shadow-lg">
              <p className="text-green-600 font-bold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> アカウントが作成されました
              </p>
              <p className="text-sm text-gray-600 mb-3">以下の情報でマイページにログインできます。</p>
              <div className="bg-green-50 rounded-xl p-4 space-y-2">
                <p className="text-sm"><span className="text-gray-500">メール:</span> <span className="font-mono font-bold text-gray-900">{accountInfo.email}</span></p>
                <p className="text-sm"><span className="text-gray-500">パスワード:</span> <span className="font-mono font-bold text-gray-900">{accountInfo.password}</span></p>
              </div>
              <p className="text-xs text-gray-400 mt-2">※このパスワードは再表示できません。必ずメモしてください。</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {accountInfo && (
              <Link href="/lcf/login" className="inline-flex items-center justify-center gap-2 bg-green-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-400 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">
                マイページにログイン
              </Link>
            )}
            <Link href="/livecommercefestival/2026" className="inline-flex items-center justify-center gap-2 text-green-600 hover:text-green-700 font-medium">
              <ArrowLeft className="w-4 h-4" /> フェスティバルページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-green-100 py-3 px-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/livecommercefestival/2026" className="text-gray-400 hover:text-green-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-sm flex items-center gap-2 text-gray-900">
              <Users className="w-4 h-4 text-green-500" />
              一般参加 お申し込み
            </h1>
            <div className="mt-1.5 h-1.5 bg-green-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-teal-400 rounded-full transition-all duration-500 ease-out"
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
                  ? 'bg-green-500 text-white rounded-br-md shadow-md' 
                  : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-green-100'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-green-100">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-green-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-green-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-green-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white/90 backdrop-blur-md border-t border-green-100 px-4 py-4 sticky bottom-0">
        <div className="max-w-2xl mx-auto">
          {currentStepData?.hint && !isTyping && (
            <p className="text-xs text-gray-400 mb-2 ml-1">{currentStepData.hint}</p>
          )}

          {currentStepData?.type === 'select' && !isTyping ? (
            <div className="flex flex-wrap gap-2">
              {currentStepData.options?.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSelectOption(opt.value, opt.label)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 hover:scale-[1.02] active:scale-95"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : currentStepData?.type === 'multi-select' && !isTyping ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {VISIT_PURPOSES.map(purpose => (
                  <button
                    key={purpose}
                    onClick={() => setSelectedPurposes(prev => 
                      prev.includes(purpose) ? prev.filter(p => p !== purpose) : [...prev, purpose]
                    )}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      selectedPurposes.includes(purpose)
                        ? 'bg-green-500 text-white shadow-md scale-[1.02]'
                        : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                    }`}
                  >
                    {purpose}
                  </button>
                ))}
              </div>
              {selectedPurposes.length > 0 && (
                <button onClick={handleNext}
                  className="w-full px-4 py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-400 transition-colors shadow-md text-sm">
                  決定（{selectedPurposes.length}件選択）
                </button>
              )}
            </div>
          ) : currentStepData?.type === 'checkbox' && !isTyping ? (
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer bg-green-50 p-4 rounded-xl border border-green-200">
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-green-300 text-green-500 focus:ring-green-500" />
                <span className="text-sm text-gray-700 leading-relaxed">
                  イベント当日の撮影・配信に同意します。また、主催者からの連絡を受け取ることに同意します。
                </span>
              </label>
              <button onClick={handleNext} disabled={!agreeTerms || mutation.isPending}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2">
                {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> 送信中...</> : <><PartyPopper className="w-4 h-4" /> 申し込みを完了する</>}
              </button>
              {mutation.error && <p className="text-red-500 text-sm text-center">{mutation.error.message}</p>}
            </div>
          ) : !isTyping ? (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type={currentStepData?.type === 'email' ? 'email' : currentStepData?.type === 'tel' ? 'tel' : 'text'}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentStepData?.placeholder}
                className="flex-1 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-200 text-sm"
              />
              <button onClick={handleNext}
                className="px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-400 transition-colors shadow-md">
                {currentStepData?.required ? <Send className="w-4 h-4" /> : <span className="text-xs font-medium">スキップ</span>}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
