import { useEffect } from "react";

/**
 * /register?code=XXXX → 招待コードをlocalStorageに保存し、LINEログインページにリダイレクト
 * 
 * window.location.href を使用してフルページリダイレクトを行う。
 * wouter の setLocation だと window.location.search が更新されず、
 * リダイレクト先でURLパラメータを読み取れない問題があるため。
 */
export default function Register() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    // Save referral code to localStorage if present
    if (code) {
      localStorage.setItem("lcj_referral_code", code);
    }

    // Full page redirect to LINE login with referral code as ref param and register mode
    // Using window.location.href instead of wouter's setLocation to ensure
    // URL params are properly available via window.location.search on the target page
    const loginUrl = code
      ? `/line-login?mode=register&ref=${encodeURIComponent(code)}&redirect=/mypage`
      : `/line-login?mode=register&redirect=/mypage`;

    window.location.href = loginUrl;
  }, []);

  // Brief loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white">
      <div className="text-center space-y-4">
        <div className="animate-spin text-4xl">🎁</div>
        <p className="text-lg font-bold text-gray-700">LCJ MALLへようこそ！</p>
        <p className="text-sm text-gray-500">ログインページに移動しています...</p>
      </div>
    </div>
  );
}
