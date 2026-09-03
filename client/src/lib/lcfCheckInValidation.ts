export const LCF_TICKET_ID_PATTERN = /^LCF-[A-Z0-9_-]{6,28}$/;

export function normalizeLcfTicketId(value: string): string {
  return value.trim().toUpperCase();
}

export function getLcfTicketIdValidationMessage(value: string): string | null {
  const normalized = normalizeLcfTicketId(value);
  if (!normalized) {
    return "チケットIDを入力してください。";
  }
  if (!LCF_TICKET_ID_PATTERN.test(normalized)) {
    return "チケットIDの形式が正しくありません。例：LCF-XXXXXXXX";
  }
  return null;
}

type CheckInErrorLike = {
  message?: string;
  data?: { code?: string } | null;
};

export function getLcfCheckInErrorMessage(error: unknown): string {
  const candidate = (error ?? {}) as CheckInErrorLike;
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const code = candidate.data?.code;

  if (
    code === "BAD_REQUEST" &&
    (/invalid_format|must match pattern|regex|チケットIDの形式/.test(message) || message.startsWith("[{") )
  ) {
    return "チケットIDの形式が正しくありません。例：LCF-XXXXXXXX";
  }
  if (code === "NOT_FOUND" || message.includes("チケットが見つかりません")) {
    return "チケットが見つかりません。IDを確認してください。";
  }
  if (message.includes("既に签到済み") || message.includes("既に受付済み")) {
    return message.replace("签到", "受付");
  }
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") {
    return "管理者ログインの有効期限が切れました。再度ログインしてください。";
  }
  return "受付処理に失敗しました。時間をおいてもう一度お試しください。";
}
