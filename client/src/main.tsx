import { trpc } from "@/lib/trpc";
import { getLiverToken } from "@/lib/liverAuth";
import { getAgencyToken } from "@/lib/agencyAuth";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { LanguageProvider } from "./contexts/LanguageContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent automatic refetching on window focus
      refetchOnWindowFocus: false,
      // Retry up to 3 times on failure (handles ERR_HTTP2_PROTOCOL_ERROR on Railway cold starts)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Keep data fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Check if we're on a liver page - if so, redirect to liver login instead of Manus OAuth
  const currentPath = window.location.pathname;
  if (currentPath.startsWith("/liver/") || currentPath.startsWith("/livers") || currentPath.startsWith("/livestreams")) {
    // Don't redirect if already on login or register page
    if (currentPath === "/liver/login" || currentPath === "/liver/register") {
      return;
    }
    window.location.href = "/liver/login";
    return;
  }

  // セキュリティ: LINEユーザー向けページからは管理者ログインページにリダイレクトしない
  // 確変チャンス、レシートアップロード、マイページ等の一般ユーザー向けページ
  const lineUserPages = [
    '/receipt-upload', '/line-login', '/line-callback', '/mypage',
    '/products', '/mall', '/point-request', '/friend-challenge',
    '/beauty-wallet', '/reviews', '/my/', '/chat/invite'
  ];
  if (lineUserPages.some(p => currentPath.startsWith(p) || currentPath === p)) {
    // LINEユーザー向けページではリダイレクトしない（コンポーネント内でエラーハンドリング）
    return;
  }

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Shared fetch function for tRPC links
const customFetch: typeof globalThis.fetch = (input, init) => {
  // Get liver token from all available storages (localStorage/sessionStorage/cookie/memory)
  const liverToken = getLiverToken();
  
  // Get agency token from localStorage
  const agencyToken = getAgencyToken();
  
  // Get LCJ MALL session token from localStorage (fallback for cookie issues)
  const lcjSessionToken = localStorage.getItem('lcj_session_token');
  
  // Get admin token from localStorage (fallback for browsers with cookie issues)
  const adminToken = localStorage.getItem('lcj_admin_token');
  
  // Add Authorization header based on current page context
  const headers = new Headers(init?.headers);
  const currentPath = window.location.pathname;
  
  // Agency pages should use agencyToken
  const isAgencyPage = currentPath.startsWith('/agency/');
  
  // Admin/master pages should use adminToken as fallback
  const isAdminPage = currentPath.startsWith('/master');
  
  // Determine which token to use based on the page context
  const isLcjMallPage = currentPath === '/mypage' || 
                        currentPath.startsWith('/line-') || 
                        currentPath === '/' ||
                        currentPath.startsWith('/products') ||
                        currentPath.startsWith('/mall') ||
                        currentPath === '/receipt-upload' ||
                        currentPath === '/point-request' ||
                        currentPath === '/friend-challenge' ||
                        currentPath === '/beauty-wallet' ||
                        currentPath.startsWith('/beauty-wallet');
  const isLiverPage = currentPath.startsWith('/liver/') || 
                     currentPath.startsWith('/livers') || 
                     currentPath.startsWith('/livestreams') || 
                     currentPath === '/s';
  const isMyLcjCoinPage = currentPath.startsWith('/my/lcj-coin');
  
  if (agencyToken && isAgencyPage) {
    headers.set("Authorization", `Bearer ${agencyToken}`);
  } else if (adminToken && isAdminPage) {
    // Admin pages: use admin token as fallback for cookie issues
    headers.set("Authorization", `Bearer ${adminToken}`);
  } else if (isMyLcjCoinPage && liverToken) {
    // My LCJ Coin page: use liver token if available (liver login)
    headers.set("Authorization", `Bearer ${liverToken}`);
  } else if (liverToken && (isLiverPage || !isLcjMallPage)) {
    headers.set("Authorization", `Bearer ${liverToken}`);
  } else if (lcjSessionToken && isLcjMallPage) {
    headers.set("Authorization", `Bearer ${lcjSessionToken}`);
  } else if (liverToken) {
    headers.set("Authorization", `Bearer ${liverToken}`);
  } else if (adminToken) {
    // Fallback: use admin token for any page if no other token is available
    headers.set("Authorization", `Bearer ${adminToken}`);
  } else if (lcjSessionToken) {
    headers.set("Authorization", `Bearer ${lcjSessionToken}`);
  }
  
  return globalThis.fetch(input, {
    ...(init ?? {}),
    headers,
    credentials: "include",
  });
};

// Use splitLink to avoid batching too many requests together
// This prevents ERR_HTTP2_PROTOCOL_ERROR caused by oversized batch responses
const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition(op) {
        // Don't batch - send each request individually to avoid HTTP/2 frame size issues
        return false;
      },
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: customFetch,
      }),
      false: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: customFetch,
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
