import LineLogin from "./LineLogin";

/**
 * /register/:code → パスパラメータからコードを取得してLineLoginに渡す
 * /register?code=XXXX → クエリパラメータからコードを取得（後方互換性）
 * 
 * 本番CDN/ホスティングがクエリパラメータを除去する問題を回避するため、
 * パスパラメータ方式（/register/7H6RJF）を優先する。
 */
export default function Register({ params }: { params?: { code?: string } } & Record<string, any>) {
  const pathCode = params?.code;
  const urlParams = new URLSearchParams(window.location.search);
  const queryCode = urlParams.get('code') || urlParams.get('ref');
  const initialCode = pathCode || queryCode || undefined;
  return <LineLogin forceRegisterMode initialReferralCode={initialCode} />;
}
