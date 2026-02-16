import { useEffect } from "react";

const REFERRAL_STORAGE_KEY = "lcj_referral_code";

/**
 * 全ページで ?ref=XXXX パラメータを検出し、localStorage に保存するフック。
 * App レベルで一度呼び出すだけで、どのページからアクセスしても紹介コードを保持できる。
 */
export function useReferralCapture() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref") || urlParams.get("code");
    if (refCode && /^[A-Za-z0-9]{4,8}$/.test(refCode)) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, refCode);
    }
  }, []);
}

/**
 * localStorage から保存済みの紹介コードを取得する。
 */
export function getSavedReferralCode(): string | null {
  return localStorage.getItem(REFERRAL_STORAGE_KEY);
}

/**
 * 紹介コードが使用された後に localStorage から削除する。
 */
export function clearSavedReferralCode() {
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
}
