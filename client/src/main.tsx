import { trpc } from "@/lib/trpc";
import { getLiverToken } from "@/lib/liverAuth";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
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
      // Retry only once on failure
      retry: 1,
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

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // Get liver token from localStorage
        const liverToken = getLiverToken();
        
        // Get LCJ MALL session token from localStorage (fallback for cookie issues)
        const lcjSessionToken = localStorage.getItem('lcj_session_token');
        
        // Add Authorization header based on current page context
        const headers = new Headers(init?.headers);
        const currentPath = window.location.pathname;
        
        // Determine which token to use based on the page context
        // LCJ MALL pages (mypage, line-login, etc.) should use lcjSessionToken
        // Liver pages should use liverToken
        const isLcjMallPage = currentPath === '/mypage' || 
                              currentPath.startsWith('/line-') || 
                              currentPath === '/' ||
                              currentPath.startsWith('/products') ||
                              currentPath.startsWith('/mall') ||
                              currentPath === '/receipt-upload' ||
                              currentPath === '/point-request' ||
                              currentPath === '/friend-challenge';
        // Include /livers and /livestreams (without trailing slash) in liver pages
        const isLiverPage = currentPath.startsWith('/liver/') || 
                           currentPath.startsWith('/livers') || 
                           currentPath.startsWith('/livestreams') || 
                           currentPath === '/s';
        
        // IMPORTANT: Always send liver token if it exists and we're on a liver page
        // This ensures the token is sent even during page transitions
        if (liverToken && (isLiverPage || !isLcjMallPage)) {
          // Prioritize liver token for liver pages and non-LCJ pages
          headers.set("Authorization", `Bearer ${liverToken}`);
        } else if (lcjSessionToken && isLcjMallPage) {
          // Use LCJ session token for LCJ MALL pages
          headers.set("Authorization", `Bearer ${lcjSessionToken}`);
        } else if (liverToken) {
          // Fallback to liver token
          headers.set("Authorization", `Bearer ${liverToken}`);
        } else if (lcjSessionToken) {
          // Fallback to LCJ session token
          headers.set("Authorization", `Bearer ${lcjSessionToken}`);
        }
        
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
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
