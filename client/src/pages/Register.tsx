import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * /register?code=XXXX → 招待コードをlocalStorageに保存し、LINEログインページにリダイレクト
 */
export default function Register() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    // Save referral code to localStorage if present
    if (code) {
      localStorage.setItem("lcj_referral_code", code);
    }

    // Redirect to LINE login with referral code as ref param
    const loginUrl = code
      ? `/line-login?ref=${encodeURIComponent(code)}&redirect=/mypage`
      : `/line-login?redirect=/mypage`;

    setLocation(loginUrl, { replace: true });
  }, [setLocation]);

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
