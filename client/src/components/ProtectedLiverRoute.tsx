import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLiverToken } from "@/lib/liverAuth";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * ProtectedLiverRoute - ライバーまたは管理者のみアクセス可能なルートガード
 * 
 * 認証チェックの優先順位:
 * 1. 管理者セッション（useAuth）がある → アクセス許可
 * 2. ライバートークン（liver_session_token）がある → サーバーで検証 → 有効ならアクセス許可
 * 3. どちらもない → /liver/login にリダイレクト
 */
export default function ProtectedLiverRoute({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // 管理者認証チェック
  const { user: adminUser, loading: adminLoading } = useAuth();

  // ライバー認証チェック（トークンがある場合のみ実行）
  const liverToken = getLiverToken();
  const { data: liverUser, isLoading: liverLoading, isError: liverError } = trpc.liver.me.useQuery(undefined, {
    enabled: !!liverToken && !adminUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    // まだロード中なら何もしない
    if (adminLoading) return;
    if (liverToken && !adminUser && liverLoading) return;

    // 管理者としてログイン済み
    if (adminUser) {
      setIsAuthorized(true);
      setAuthChecked(true);
      return;
    }

    // ライバーとしてログイン済み
    if (liverToken && liverUser) {
      setIsAuthorized(true);
      setAuthChecked(true);
      return;
    }

    // どちらでもない → リダイレクト（現在のURLをredirectパラメータとして渡す）
    if (!liverToken || liverError || (!liverLoading && !liverUser)) {
      setAuthChecked(true);
      setIsAuthorized(false);
      const currentPath = window.location.pathname + window.location.search;
      navigate(`/liver/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
  }, [adminUser, adminLoading, liverToken, liverUser, liverLoading, liverError, navigate]);

  // ローディング中
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // 認証失敗（リダイレクト中）
  if (!isAuthorized) {
    return null;
  }

  // 認証成功
  return <>{children}</>;
}
