export type FestivalAuthOperation = "login" | "register" | "forgotPassword" | "resetPassword";

type UnknownRecord = Record<string, unknown>;

function getTrpcErrorCode(error: unknown): string | null {
  const seen = new Set<object>();
  const inspect = (value: unknown, depth: number): string | null => {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) return null;
    seen.add(value);
    const record = value as UnknownRecord;
    if (typeof record.code === "string") return record.code;
    for (const key of ["data", "shape", "error", "json", "cause", "response"]) {
      const nested = inspect(record[key], depth + 1);
      if (nested) return nested;
    }
    return null;
  };
  return inspect(error, 0);
}

const RATE_LIMIT_MESSAGE = "試行回数が多すぎます。時間をおいて再度お試しください。";

export function getFestivalAuthErrorMessage(operation: FestivalAuthOperation, error: unknown): string {
  const code = getTrpcErrorCode(error);
  if (code === "TOO_MANY_REQUESTS") return RATE_LIMIT_MESSAGE;

  if (operation === "login") {
    if (code === "UNAUTHORIZED") return "メールアドレスまたはパスワードが正しくありません";
    if (code === "FORBIDDEN") return "このアカウントは現在利用できません。運営へお問い合わせください。";
    if (code === "BAD_REQUEST") return "メールアドレスとパスワードを確認してください。";
    return "ログイン処理を完了できませんでした。時間をおいて再度お試しください。";
  }

  if (operation === "register") {
    if (code === "CONFLICT") return "このメールアドレスは登録済みです。ログインしてください。";
    if (code === "BAD_REQUEST") return "入力内容を確認してください。パスワードは6文字以上で英字と数字を含めてください。";
    return "新規登録を完了できませんでした。時間をおいて再度お試しください。";
  }

  if (operation === "forgotPassword") {
    if (code === "BAD_REQUEST") return "有効なメールアドレスを入力してください。";
    return "再設定メールの送信を完了できませんでした。時間をおいて再度お試しください。";
  }

  if (code === "BAD_REQUEST") return "リンクまたは新しいパスワードを確認してください。";
  return "パスワードを再設定できませんでした。新しいリンクを取得して再度お試しください。";
}
