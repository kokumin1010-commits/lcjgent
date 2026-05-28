import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TokenManager from "../../base/utils/tokenManager";

/**
 * AutoLogin page — handles token-based auto-login from LiveBoost app.
 * 
 * The backend redirects here with tokens in the URL fragment:
 * /auto-login#access_token=xxx&refresh_token=yyy&user_id=zzz&email=aaa
 * 
 * This page extracts the tokens, stores them in localStorage, and
 * redirects to the dashboard.
 */
export default function AutoLogin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("ログイン中...");

  useEffect(() => {
    try {
      // Parse tokens from URL fragment (hash)
      const hash = window.location.hash.substring(1); // Remove leading #
      if (!hash) {
        setStatus("認証情報が見つかりません。ログインページに移動します...");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const userId = params.get("user_id");
      const email = params.get("email");

      if (!accessToken) {
        setStatus("トークンが無効です。ログインページに移動します...");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      // Clear any existing auth state first
      TokenManager.clearTokens();

      // Store the new tokens
      TokenManager.setToken(accessToken);
      if (refreshToken) {
        TokenManager.setRefreshToken(refreshToken);
      }

      // Store user data in localStorage (same format as Login.jsx)
      const userData = {
        isLoggedIn: true,
        id: userId,
        email: email || "",
        role: "user",
      };
      localStorage.setItem("user", JSON.stringify(userData));

      setStatus("ログイン成功！ダッシュボードに移動します...");

      // Clear the hash from URL for security, then redirect
      window.history.replaceState(null, "", "/auto-login");
      setTimeout(() => {
        navigate("/");
      }, 500);
    } catch (error) {
      console.error("Auto-login failed:", error);
      setStatus("ログインに失敗しました。ログインページに移動します...");
      setTimeout(() => navigate("/login"), 2000);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4500FF] mx-auto mb-4"></div>
        <p className="text-lg text-gray-700">{status}</p>
        <p className="text-sm text-gray-400 mt-2">LiveBoost → AitherHub</p>
      </div>
    </div>
  );
}
