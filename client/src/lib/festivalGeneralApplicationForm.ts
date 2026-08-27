export const GENERAL_APPLICATION_DRAFT_KEY = "lcf-2026-general-application-draft-v1";

export const DEFAULT_GENERAL_APPLICATION_FORM = {
  participationType: "" as "" | "corporate" | "individual",
  name: "",
  nameKana: "",
  brandName: "",
  email: "",
  phone: "",
  lineOrLark: "",
  industryTypes: [] as string[],
  visitPurposes: [] as string[],
  attendanceSchedule: "" as "" | "day1_only" | "day2_only" | "both_days",
  portraitConsent: false,
  complianceConsent: false,
};

export type GeneralApplicationFormState = typeof DEFAULT_GENERAL_APPLICATION_FORM;
export type GeneralApplicationFormErrors = Partial<Record<keyof GeneralApplicationFormState, string>>;

export function validateGeneralApplicationStep(
  form: GeneralApplicationFormState,
  targetStep: number,
): GeneralApplicationFormErrors {
  const nextErrors: GeneralApplicationFormErrors = {};
  const normalizedEmail = form.email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const phoneValid = /^[0-9+()\-\s]{7,30}$/.test(form.phone.trim());

  if (targetStep === 1) {
    if (!form.participationType) nextErrors.participationType = "法人または個人を選択してください。";
    if (!form.name.trim()) nextErrors.name = "お名前を入力してください。";
    if (!form.nameKana.trim()) nextErrors.nameKana = "フリガナを入力してください。";
    if (form.participationType === "corporate" && !form.brandName.trim()) {
      nextErrors.brandName = "法人の場合は会社名・ブランド名を入力してください。";
    }
    if (!emailValid) nextErrors.email = "有効なメールアドレスを入力してください。";
    if (!phoneValid) nextErrors.phone = "7〜30文字の電話番号を入力してください。";
  }

  if (targetStep === 2) {
    if (form.industryTypes.length === 0) nextErrors.industryTypes = "業種・所属を1つ以上選択してください。";
    if (form.visitPurposes.length === 0) nextErrors.visitPurposes = "ご来場目的を1つ以上選択してください。";
    if (!form.attendanceSchedule) nextErrors.attendanceSchedule = "ご来場日程を選択してください。";
  }

  if (targetStep === 3) {
    if (!form.portraitConsent) nextErrors.portraitConsent = "肖像権に関する同意が必要です。";
    if (!form.complianceConsent) nextErrors.complianceConsent = "コンプライアンスに関する同意が必要です。";
  }

  return nextErrors;
}

export function countGeneralApplicationRequired(
  form: GeneralApplicationFormState,
): { completed: number; total: number } {
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim().toLowerCase());
  const phoneValid = /^[0-9+()\-\s]{7,30}$/.test(form.phone.trim());
  const checks = [
    Boolean(form.participationType),
    Boolean(form.name.trim()),
    Boolean(form.nameKana.trim()),
    emailValid,
    phoneValid,
    form.participationType !== "corporate" || Boolean(form.brandName.trim()),
    form.industryTypes.length > 0,
    form.visitPurposes.length > 0,
    Boolean(form.attendanceSchedule),
    form.portraitConsent,
    form.complianceConsent,
  ];
  return { completed: checks.filter(Boolean).length, total: checks.length };
}
