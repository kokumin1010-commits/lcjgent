/**
 * Live Commerce Festival - 開催回別ライブコマーサー申込みフォーム
 * Design: existing warm festival form, with edition-scoped dates, storage and shared-account guidance.
 * Backend API: festival.submitLiver
 */
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Mic2, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, MessageCircle, Send, PartyPopper, Sparkles, Undo2 } from 'lucide-react';
import { Link } from 'wouter';
import { parseLcfApplicationFormError } from '@/lib/lcfApplicationFormErrors';
import { filterLiverApplicationSteps } from '@/lib/festivalLiverApplicationFlow';
import { trpc } from '@/lib/trpc';
import { getLcfEventByEdition, type LcfEventDefinition } from '@shared/lcfEventDefinitions';

type Step = {
  id: string;
  question: string;
  type: 'text' | 'email' | 'password' | 'select' | 'textarea' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
};

type ExistingMemberFlow = 'unknown' | 'new' | 'recognized' | 'verified-reuse' | 'verified-no-profile';

const LIVER_PASSWORD_STEP: Step = {
  id: 'password',
  question: '会員様、ありがとうございます。\n第1回と同じパスワードを入力してください 🔐',
  type: 'password',
  placeholder: '既存のLCFパスワード',
  required: true,
  hint: '本人確認後、前回と同じプロフィール情報の再入力を省略できます',
};

function createSteps(event: LcfEventDefinition, existingMemberFlow: ExistingMemberFlow): Step[] {
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
  { id: 'beginnerSupport', question: 'ライブコマース初心者サポートを希望しますか？ 📚', type: 'select', required: true, options: [
    { value: 'yes', label: '希望する（講習・設定・当日準備を相談したい）' },
    { value: 'no', label: '今回は希望しない' },
  ], hint: '未経験・これから始めたい方も対象です' },
  { id: 'agree', question: '最後に確認です！ ✅', type: 'checkbox', required: true },
  ];
  if (event.edition === 2) {
    const secondEditionDetailSteps = filterLiverApplicationSteps(event.edition, detailSteps);
    if (existingMemberFlow === 'recognized' || existingMemberFlow === 'verified-reuse') {
      return [emailStep, LIVER_PASSWORD_STEP, ...secondEditionDetailSteps.filter(step => step.id === 'agree')];
    }
    if (existingMemberFlow === 'verified-no-profile') {
      return [emailStep, LIVER_PASSWORD_STEP, ...secondEditionDetailSteps];
    }
    return [emailStep, ...secondEditionDetailSteps];
  }
  return [...detailSteps.slice(0, 6), emailStep, ...detailSteps.slice(6)];
}

const MAINTENANCE_MODE = false;
const LCF_OPEN_CHAT_URL = 'https://line.me/ti/g2/KsS3Ma1HW3okfwI2OowM6Ubk0UHKOHmb3nZFhA?utm_source=invitation&utm_medium=link_copy&utm_campaign=default';

export default function FestivalApplyLiver() {
  if (MAINTENANCE_MODE) {
    window.location.href = '/';
    return null;
  }
  const event = getLcfEventByEdition(new URLSearchParams(window.location.search).get('edition'));
  const isSecondEdition = event.edition === 2;
  const [existingMemberFlow, setExistingMemberFlow] = useState<ExistingMemberFlow>('unknown');
  const steps = createSteps(event, existingMemberFlow);
  const storageKey = event.edition === 2
    ? `lcf_liver_form_${event.eventYear}_password_reuse_v4`
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
    if (existingMemberFlow === 'recognized' || existingMemberFlow.startsWith('verified')) {
      localStorage.removeItem(storageKey);
      return;
    }
    const dataToSave = { currentStep, answers, chatHistory };
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
  }, [currentStep, answers, chatHistory, submitted, storageKey, existingMemberFlow]);

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

    if (step.id === 'password') {
      try {
        const result = await loginMutation.mutateAsync({
          email: answers.email,
          password: inputValue,
          applicationType: 'liver',
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
          ? `本人確認ができました。会員様、ありがとうございます。\n第1回のプロフィール情報を引き継ぎましたので、同じ情報の再入力は不要です。\n\n${createSteps(event, 'verified-reuse')[2].question}`
          : `本人確認ができました。会員様、ありがとうございます。\nライブコマーサー申込の共通情報を入力してください。\n\n${createSteps(event, 'verified-no-profile')[2].question}`;
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
          if (result.recognizedMember) {
            setExistingMemberFlow('recognized');
            nextQuestion = LIVER_PASSWORD_STEP.question;
          } else {
            setExistingMemberFlow('new');
            nextQuestion = `メールアドレスありがとうございます。第2回のお申し込みを続けます。\n\n${createSteps(event, 'new')[1].question}`;
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
        applicationType: 'liver',
        email: answers.email,
        fieldId: parsed.fieldId,
        errorCode: parsed.code,
        message: parsed.message,
      });
    }
    let targetSteps = steps;
    let targetIndex = parsed.fieldId ? targetSteps.findIndex(step => step.id === parsed.fieldId) : -1;
    if (targetIndex < 0 && parsed.fieldId && isSecondEdition) {
      targetSteps = createSteps(event, 'verified-no-profile');
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
      matchingPreference: (answers.matchingPreference as 'yes' | 'no') || 'no',
      beginnerSupport: (answers.beginnerSupport as 'yes' | 'no') || 'no',
      portraitRightsConsent: true,
      complianceConsent: true,
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 flex items-start justify-center px-4 py-8 sm:py-12">
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
          <div className="mb-6 rounded-2xl border-2 border-[#06C755]/30 bg-white p-5 text-left shadow-lg">
            <p className="flex items-center gap-2 font-bold text-gray-900">
              <MessageCircle className="h-5 w-5 text-[#06C755]" />
              参加者LINEオープンチャット
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">開催案内や参加者向けのお知らせを確認できます。お申し込み完了後、そのままご参加ください。</p>
            <a
              href={LCF_OPEN_CHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#007A34] px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-[#00652B] hover:shadow-xl active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00652B]"
            >
              <MessageCircle className="h-5 w-5" />
              LINEオープンチャットに参加する
            </a>
          </div>
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
            {!accountInfo && (
              <Link href="/lcf/mypage" className="inline-flex items-center justify-center gap-2 bg-purple-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-400 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]">
                マイページを見る
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
                className="min-w-0 flex-1 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 resize-none text-base"
              />
              <div className="flex self-end gap-2">
                <button onClick={() => void handleNext()} disabled={!inputValue.trim() || memberCheck.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500 px-3 py-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-40">
                  <Send className="h-4 w-4" />送信
                </button>
                {!currentStepData?.required && <button type="button" onClick={handleSkip} className="rounded-xl border border-purple-300 bg-white px-3 py-3 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-50">スキップ</button>}
              </div>
            </div>
          ) : !isTyping ? (
            <div className="flex gap-2">
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={currentStepData?.id === 'email' ? 'email' : currentStepData?.type === 'password' ? (showPassword ? 'text' : 'password') : currentStepData?.id === 'phone' ? 'tel' : 'text'}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentStepData?.placeholder}
                className="min-w-0 flex-1 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 text-base"
              />
              {currentStepData?.type === 'password' && (
                <button type="button" onClick={() => setShowPassword(prev => !prev)} aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                  className="px-3 text-gray-500 hover:text-purple-600">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              )}
              <button onClick={() => void handleNext()} disabled={!inputValue.trim() || memberCheck.isPending || loginMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500 px-3 py-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-40">
                {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : currentStepData?.type === 'password' ? <><KeyRound className="h-4 w-4" />確認</> : <><Send className="h-4 w-4" />送信</>}
              </button>
              {!currentStepData?.required && <button type="button" onClick={handleSkip} className="rounded-xl border border-purple-300 bg-white px-3 py-3 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-50">スキップ</button>}
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
            }} className="mt-3 text-xs font-bold text-purple-700 underline underline-offset-4 disabled:opacity-50">
              {forgotMutation.isPending ? '再設定メールを送信中…' : 'パスワードをお忘れの方'}
            </button>
          )}
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
