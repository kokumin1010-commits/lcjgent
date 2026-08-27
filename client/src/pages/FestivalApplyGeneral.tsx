import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Loader2,
  Save,
  ShieldCheck,
  TicketCheck,
  Trash2,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_GENERAL_APPLICATION_FORM as DEFAULT_FORM,
  GENERAL_APPLICATION_DRAFT_KEY as SESSION_DRAFT_KEY,
  countGeneralApplicationRequired,
  validateGeneralApplicationStep,
  type GeneralApplicationFormErrors as FormErrors,
  type GeneralApplicationFormState as FormState,
} from "@/lib/festivalGeneralApplicationForm";

const INDUSTRY_OPTIONS = [
  "ブランド",
  "メーカー",
  "EC事業者",
  "MCN",
  "広告代理店",
  "サービス企業",
  "物流企業",
  "メディア",
  "投資機関",
  "その他",
];

const VISIT_PURPOSES = [
  "ライブコマース・TikTok Shopの最新トレンドやノウハウの情報収集",
  "出展企業（メーカーやブランド）との商談・ネットワーキング",
  "クリエイター・ライバー・MCNとのネットワーキング",
  "自社の次回以降の出展に向けた視察",
  "セミナー・講演の聴講",
  "商品仕入れ、ネットワーキング",
  "その他",
];

const ATTENDANCE_OPTIONS = [
  { value: "day1_only", label: "9月8日（火）DAY1 のみ参加" },
  { value: "day2_only", label: "9月9日（水）DAY2 のみ参加" },
  { value: "both_days", label: "両日参加" },
] as const;

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100";

function restoreSessionDraft(): FormState {
  if (typeof window === "undefined") return DEFAULT_FORM;
  try {
    const saved = window.sessionStorage.getItem(SESSION_DRAFT_KEY);
    if (!saved) return DEFAULT_FORM;
    const parsed = JSON.parse(saved) as Partial<FormState>;
    return {
      ...DEFAULT_FORM,
      ...parsed,
      industryTypes: Array.isArray(parsed.industryTypes) ? parsed.industryTypes : [],
      visitPurposes: Array.isArray(parsed.visitPurposes) ? parsed.visitPurposes : [],
      portraitConsent: Boolean(parsed.portraitConsent),
      complianceConsent: Boolean(parsed.complianceConsent),
    };
  } catch {
    return DEFAULT_FORM;
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-sm font-medium text-red-600">{message}</p>;
}

function SelectionCard({
  checked,
  children,
  onChange,
  type = "checkbox",
  name,
}: {
  checked: boolean;
  children: React.ReactNode;
  onChange: () => void;
  type?: "checkbox" | "radio";
  name?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition active:scale-[0.99] ${
        checked ? "border-amber-500 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-amber-300"
      }`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-5 w-5 shrink-0 accent-amber-600"
      />
      <span className="text-sm leading-6 text-slate-700">{children}</span>
    </label>
  );
}

export default function FestivalApplyGeneral() {
  const [form, setForm] = useState<FormState>(restoreSessionDraft);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("一般来場のお申し込みを受け付けました");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketEmailSent, setTicketEmailSent] = useState<boolean | null>(null);
  const [accountInfo, setAccountInfo] = useState<{ email: string; password: string } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const normalizedEmail = form.email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const phoneValid = /^[0-9+()\-\s]{7,30}$/.test(form.phone.trim());

  useEffect(() => {
    if (submitted) return;
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_DRAFT_KEY, JSON.stringify(form));
        setDraftSavedAt(new Date());
      } catch {
        setDraftSavedAt(null);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form, submitted]);

  const completedRequired = useMemo(() => countGeneralApplicationRequired(form), [form]);

  const mutation = trpc.festival.submitGeneral.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setSubmissionMessage(data.message || "一般来場のお申し込みを受け付けました");
      setTicketId(data.ticketId || null);
      setTicketEmailSent(data.ticketEmailSent ?? false);
      if (data.account) setAccountInfo({ email: form.email, password: data.account.password });
      try {
        window.sessionStorage.removeItem(SESSION_DRAFT_KEY);
      } catch {
        // The application remains complete even when storage is unavailable.
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const setValue = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const validateStep = (targetStep: number): FormErrors => validateGeneralApplicationStep(form, targetStep);

  const focusFirstError = (nextErrors: FormErrors) => {
    const first = Object.keys(nextErrors)[0];
    if (!first) return;
    window.setTimeout(() => document.getElementById(`field-${first}`)?.focus(), 0);
  };

  const goNext = () => {
    const nextErrors = validateStep(step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitApplication = () => {
    const stepOneErrors = validateStep(1);
    const stepTwoErrors = validateStep(2);
    const stepThreeErrors = validateStep(3);
    const allErrors = { ...stepOneErrors, ...stepTwoErrors, ...stepThreeErrors };
    if (Object.keys(allErrors).length > 0) {
      const invalidStep = Object.keys(stepOneErrors).length > 0 ? 1 : Object.keys(stepTwoErrors).length > 0 ? 2 : 3;
      setStep(invalidStep);
      setErrors(allErrors);
      focusFirstError(allErrors);
      return;
    }

    mutation.mutate({
      participationType: form.participationType as "corporate" | "individual",
      companyName: form.participationType === "corporate" ? form.brandName.trim() : "",
      department: form.industryTypes.join(", "),
      name: form.name.trim(),
      nameKana: form.nameKana.trim(),
      email: normalizedEmail,
      phone: form.phone.trim(),
      attendanceSchedule: form.attendanceSchedule as "day1_only" | "day2_only" | "both_days",
      visitPurposes: form.visitPurposes,
      lineOrLark: form.lineOrLark.trim() || undefined,
      brandName: form.brandName.trim() || undefined,
      industryTypes: form.industryTypes,
      portraitRightsConsent: true,
      complianceConsent: true,
    });
  };

  const toggleArrayValue = (key: "industryTypes" | "visitPurposes", value: string) => {
    const current = form[key];
    setValue(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const clearDraft = () => {
    try {
      window.sessionStorage.removeItem(SESSION_DRAFT_KEY);
    } catch {
      // Storage may be disabled; the in-memory form can still be cleared.
    }
    setForm(DEFAULT_FORM);
    setErrors({});
    setStep(1);
    setDraftSavedAt(null);
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50 px-4 py-10">
        <div className="mx-auto w-full max-w-lg rounded-3xl border border-amber-100 bg-white p-6 text-center shadow-xl sm:p-9">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
          <p className="text-sm font-bold tracking-[0.18em] text-amber-700">LIVE COMMERCE FESTIVAL 2026</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">お申し込み完了</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">{submissionMessage}</p>
          <div className={`mt-5 rounded-2xl p-4 text-left text-sm ${ticketEmailSent ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
            {ticketEmailSent
              ? "ご登録のメールアドレスにチケットメールを送信しました。"
              : "メール送信を確認できませんでした。下のQRコードを保存し、マイページでもご確認ください。"}
          </div>
          {ticketId && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold text-slate-500">チケットID</p>
              <p className="mt-1 break-all font-mono text-lg font-black text-slate-900">{ticketId}</p>
              <div className="mt-4 flex justify-center"><QRCodeSVG value={ticketId} size={132} /></div>
              <p className="mt-3 text-xs text-slate-500">当日受付でこのQRコードをご提示ください</p>
            </div>
          )}
          {accountInfo && (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-left">
              <p className="font-bold text-blue-950">マイページアカウント</p>
              <p className="mt-2 break-all text-sm text-blue-900">メール：{accountInfo.email}</p>
              <div className="mt-1 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                <span className="break-all font-mono text-sm text-blue-900">{accountInfo.password}</span>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-blue-700"
                  onClick={async () => {
                    await navigator.clipboard.writeText(accountInfo.password);
                    setPasswordCopied(true);
                    window.setTimeout(() => setPasswordCopied(false), 2000);
                  }}
                >
                  {passwordCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {passwordCopied ? "コピー済み" : "コピー"}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-blue-700">このパスワードは安全な場所に保存してください。</p>
            </div>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/lcf/login" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">マイページへ</Link>
            <Link href="/" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">トップへ戻る</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50 pb-28 text-slate-900 sm:pb-12">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-amber-700">
          <ArrowLeft className="h-4 w-4" /> トップに戻る
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,.45),transparent_45%)] p-6 sm:p-8">
            <p className="text-xs font-black tracking-[0.22em] text-amber-300">LIVE COMMERCE FESTIVAL 2026</p>
            <h1 className="mt-3 text-2xl font-black sm:text-3xl">一般参加 お申し込み</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">初めての方も、下の3ステップに沿って入力するだけでお申し込みいただけます。入力時間の目安は約3分です。</p>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-3"><CalendarDays className="h-4 w-4 text-amber-300" /> 2026年9月8日・9日</div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-3"><Clock3 className="h-4 w-4 text-amber-300" /> 約3分で入力</div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-3"><TicketCheck className="h-4 w-4 text-amber-300" /> 申込後にチケット発行</div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><Save className="h-4 w-4 text-amber-600" /> 入力内容はこのタブ内に自動保存されます</div>
            <button type="button" onClick={clearDraft} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600"><Trash2 className="h-4 w-4" /> 草稿をクリア</button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">ページを更新しても復元できます。タブを閉じると保存内容は残りません。{draftSavedAt ? ` 最終保存 ${draftSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
        </section>

        <nav className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="申込手順">
          <div className="grid grid-cols-3 gap-2">
            {["基本情報", "来場計画", "確認・送信"].map((label, index) => {
              const number = index + 1;
              const active = number === step;
              const complete = number < step;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => number < step && setStep(number)}
                  className={`rounded-xl px-2 py-3 text-center transition ${active ? "bg-amber-500 text-white shadow" : complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"}`}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-black">{complete ? <Check className="h-4 w-4" /> : number}</span>
                  <span className="mt-1 block text-[11px] font-bold sm:text-sm">{label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>ステップ {step} / 3</span>
            <span>必須項目 {completedRequired.completed} / {completedRequired.total}</span>
          </div>
        </nav>

        <form onSubmit={(event) => { event.preventDefault(); submitApplication(); }} className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg sm:p-8">
          {step === 1 && (
            <section className="space-y-6" aria-labelledby="step-one-title">
              <div><p className="text-xs font-black tracking-[0.18em] text-amber-600">STEP 1</p><h2 id="step-one-title" className="mt-1 text-xl font-black">基本情報</h2><p className="mt-2 text-sm text-slate-500">参加者ご本人の情報をご入力ください。</p></div>

              <div id="field-participationType" tabIndex={-1}>
                <label className="mb-2 block text-sm font-bold">参加区分 <span className="text-red-500">必須</span></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectionCard type="radio" name="participationType" checked={form.participationType === "corporate"} onChange={() => setValue("participationType", "corporate")}>法人・企業として参加</SelectionCard>
                  <SelectionCard type="radio" name="participationType" checked={form.participationType === "individual"} onChange={() => setValue("participationType", "individual")}>個人として参加</SelectionCard>
                </div>
                <FieldError message={errors.participationType} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div><label htmlFor="field-name" className="mb-2 block text-sm font-bold">お名前 <span className="text-red-500">必須</span></label><input id="field-name" className={fieldClass} value={form.name} onChange={(e) => setValue("name", e.target.value)} autoComplete="name" placeholder="例：山田 太郎" /><FieldError message={errors.name} /></div>
                <div><label htmlFor="field-nameKana" className="mb-2 block text-sm font-bold">フリガナ <span className="text-red-500">必須</span></label><input id="field-nameKana" className={fieldClass} value={form.nameKana} onChange={(e) => setValue("nameKana", e.target.value)} placeholder="例：ヤマダ タロウ" /><FieldError message={errors.nameKana} /></div>
              </div>

              <div><label htmlFor="field-brandName" className="mb-2 block text-sm font-bold">会社名・ブランド名 {form.participationType === "corporate" && <span className="text-red-500">必須</span>}</label><input id="field-brandName" className={fieldClass} value={form.brandName} onChange={(e) => setValue("brandName", e.target.value)} autoComplete="organization" placeholder="法人・企業の方は入力してください" /><FieldError message={errors.brandName} /></div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div><label htmlFor="field-email" className="mb-2 block text-sm font-bold">メールアドレス <span className="text-red-500">必須</span></label><input id="field-email" type="email" className={fieldClass} value={form.email} onChange={(e) => setValue("email", e.target.value)} autoComplete="email" inputMode="email" placeholder="name@example.com" /><FieldError message={errors.email} /></div>
                <div><label htmlFor="field-phone" className="mb-2 block text-sm font-bold">電話番号 <span className="text-red-500">必須</span></label><input id="field-phone" type="tel" className={fieldClass} value={form.phone} onChange={(e) => setValue("phone", e.target.value)} autoComplete="tel" inputMode="tel" placeholder="090-1234-5678" /><FieldError message={errors.phone} /></div>
              </div>

              <div><label htmlFor="field-lineOrLark" className="mb-2 block text-sm font-bold">LINE・Lark・WeChat <span className="font-normal text-slate-400">任意</span></label><input id="field-lineOrLark" className={fieldClass} value={form.lineOrLark} onChange={(e) => setValue("lineOrLark", e.target.value)} placeholder="連絡可能なID" /></div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-7" aria-labelledby="step-two-title">
              <div><p className="text-xs font-black tracking-[0.18em] text-amber-600">STEP 2</p><h2 id="step-two-title" className="mt-1 text-xl font-black">来場計画</h2><p className="mt-2 text-sm text-slate-500">ご所属と、当日の参加目的を選択してください。</p></div>

              <div id="field-industryTypes" tabIndex={-1}><label className="mb-2 block text-sm font-bold">業種・所属 <span className="text-red-500">必須・複数選択可</span></label><div className="grid gap-2 sm:grid-cols-2">{INDUSTRY_OPTIONS.map((item) => <SelectionCard key={item} checked={form.industryTypes.includes(item)} onChange={() => toggleArrayValue("industryTypes", item)}>{item}</SelectionCard>)}</div><FieldError message={errors.industryTypes} /></div>

              <div id="field-visitPurposes" tabIndex={-1}><label className="mb-2 block text-sm font-bold">ご来場目的 <span className="text-red-500">必須・複数選択可</span></label><div className="space-y-2">{VISIT_PURPOSES.map((item) => <SelectionCard key={item} checked={form.visitPurposes.includes(item)} onChange={() => toggleArrayValue("visitPurposes", item)}>{item}</SelectionCard>)}</div><FieldError message={errors.visitPurposes} /></div>

              <div id="field-attendanceSchedule" tabIndex={-1}><label className="mb-2 block text-sm font-bold">ご来場スケジュール <span className="text-red-500">必須</span></label><p className="mb-3 text-xs leading-5 text-slate-500">ご来場日程に応じて、ブランド紹介やイベント調整をご案内する場合があります。</p><div className="space-y-2">{ATTENDANCE_OPTIONS.map((item) => <SelectionCard key={item.value} type="radio" name="attendanceSchedule" checked={form.attendanceSchedule === item.value} onChange={() => setValue("attendanceSchedule", item.value)}>{item.label}</SelectionCard>)}</div><FieldError message={errors.attendanceSchedule} /></div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6" aria-labelledby="step-three-title">
              <div><p className="text-xs font-black tracking-[0.18em] text-amber-600">STEP 3</p><h2 id="step-three-title" className="mt-1 text-xl font-black">内容確認・送信</h2><p className="mt-2 text-sm text-slate-500">内容を確認し、2つの同意事項にチェックして送信してください。</p></div>

              <div className="rounded-2xl bg-slate-50 p-4 sm:p-5">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs font-bold text-slate-400">参加区分</dt><dd className="mt-1 font-bold">{form.participationType === "corporate" ? "法人・企業" : "個人"}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-400">お名前</dt><dd className="mt-1 font-bold">{form.name}（{form.nameKana}）</dd></div>
                  <div><dt className="text-xs font-bold text-slate-400">会社・ブランド</dt><dd className="mt-1 font-bold">{form.brandName || "—"}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-400">メール</dt><dd className="mt-1 break-all font-bold">{normalizedEmail}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-400">電話番号</dt><dd className="mt-1 font-bold">{form.phone}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-400">来場日程</dt><dd className="mt-1 font-bold">{ATTENDANCE_OPTIONS.find((item) => item.value === form.attendanceSchedule)?.label}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-bold text-slate-400">業種・所属</dt><dd className="mt-1 font-bold">{form.industryTypes.join("、")}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-bold text-slate-400">来場目的</dt><dd className="mt-1 leading-6">{form.visitPurposes.join("、")}</dd></div>
                </dl>
                <button type="button" onClick={() => setStep(1)} className="mt-4 text-xs font-bold text-amber-700 underline">基本情報を修正する</button>
              </div>

              <div id="field-portraitConsent" tabIndex={-1}><SelectionCard checked={form.portraitConsent} onChange={() => setValue("portraitConsent", !form.portraitConsent)}><span className="font-bold">肖像権に関する同意</span><span className="mt-1 block text-xs text-slate-500">本イベントでは公式の映像収録・写真撮影を行い、PR資料や配信媒体に映り込む可能性があります。</span></SelectionCard><FieldError message={errors.portraitConsent} /></div>
              <div id="field-complianceConsent" tabIndex={-1}><SelectionCard checked={form.complianceConsent} onChange={() => setValue("complianceConsent", !form.complianceConsent)}><span className="font-bold">コンプライアンスに関する同意</span><span className="mt-1 block text-xs text-slate-500">会場内のライブ配信では、プラットフォームのコミュニティガイドラインと販売ポリシーを遵守します。</span></SelectionCard><FieldError message={errors.complianceConsent} /></div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><ShieldCheck className="mb-2 h-5 w-5" />送信は1回だけで大丈夫です。同じメールアドレスで既にお申し込み済みの場合、重複登録せず既存のチケットをご案内します。</div>
              {mutation.error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">送信できませんでした：{mutation.error.message || "通信状態をご確認のうえ、もう一度お試しください。"}</div>}
            </section>
          )}

          <div className="mt-8 hidden items-center justify-between gap-3 border-t border-slate-100 pt-6 sm:flex">
            <button type="button" disabled={step === 1 || mutation.isPending} onClick={() => setStep((current) => Math.max(1, current - 1))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 disabled:invisible"><ChevronLeft className="h-4 w-4" /> 前へ</button>
            {step < 3 ? <button type="button" onClick={goNext} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-amber-200 transition active:scale-[0.98]">次へ進む <ChevronRight className="h-4 w-4" /></button> : <button type="submit" disabled={mutation.isPending} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition active:scale-[0.98] disabled:opacity-60">{mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> 送信中...</> : <><TicketCheck className="h-4 w-4" /> この内容で申し込む</>}</button>}
          </div>
        </form>

        <footer className="mt-6 text-center text-xs leading-6 text-slate-500">お問い合わせ：info@livecommercejapan.jp<br />© 2026 Live Commerce Festival 実行委員会</footer>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {step > 1 && <button type="button" disabled={mutation.isPending} onClick={() => setStep((current) => Math.max(1, current - 1))} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-700"><ChevronLeft className="h-5 w-5" /></button>}
          {step < 3 ? <button type="button" onClick={goNext} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-black text-white shadow-lg">次へ進む <ChevronRight className="h-4 w-4" /></button> : <button type="button" disabled={mutation.isPending} onClick={submitApplication} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white shadow-lg disabled:opacity-60">{mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />送信中...</> : <><TicketCheck className="h-4 w-4" />この内容で申し込む</>}</button>}
        </div>
      </div>
    </main>
  );
}
