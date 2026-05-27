import { useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import RandomSpinPopup, { useRandomSpinPopup } from "./RandomSpinPopup";

/**
 * RandomSpinProvider
 * 
 * Wraps the app and monitors page navigation to trigger the random spin popup
 * at strategic timings. Must be placed inside the Router context.
 * 
 * Frequency limits:
 * - 1 per session
 * - Max 2 per day
 * 
 * Strategic triggers:
 * - After viewing 3+ product pages (60% chance)
 * - Mypage visit (20% chance)
 * - Returning user after 2+ days (70% chance)
 * - After 60s on site with 2+ page views (30% chance)
 * 
 * Display restriction:
 * - Only shown on customer-facing pages
 * - NEVER shown on internal pages (/master/*, /liver/*, /login, /register, etc.)
 */

/** Check if the current path is an internal (staff/admin) page */
function isInternalPage(path: string): boolean {
  return (
    path.startsWith("/master") ||
    path.startsWith("/login") ||
    path.startsWith("/liver") ||
    path === "/liver" ||
    path.startsWith("/livers") ||
    path === "/friend-challenge" ||
    path === "/spin-demo" ||
    path.startsWith("/register") ||
    path.startsWith("/chat-register") ||
    path.startsWith("/registration-bonus") ||
    path.startsWith("/mobmart")
  );
}

/** Check if user is a liver (staff) based on localStorage */
function isLiverUser(): boolean {
  try {
    const liverToken = localStorage.getItem("liver_token") || localStorage.getItem("liverToken");
    const liverData = localStorage.getItem("liver_data") || localStorage.getItem("liverData");
    return !!(liverToken || liverData);
  } catch {
    return false;
  }
}

export default function RandomSpinProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { showPopup, jackpotConfig, closePopup, recordPageView, recordWin } = useRandomSpinPopup();
  const prevLocationRef = useRef(location);

  // Determine if current page is internal (admin/staff) OR user is a liver
  const isInternal = useMemo(() => isInternalPage(location) || isLiverUser(), [location]);

  // Track page navigation and trigger strategic timing checks
  useEffect(() => {
    if (location === prevLocationRef.current) return;
    prevLocationRef.current = location;

    // Map routes to page names for strategic timing
    let pageName = "other";
    if (location.startsWith("/mall/products/")) {
      pageName = "product_detail";
    } else if (location === "/mall/products") {
      pageName = "product_list";
    } else if (location === "/mypage") {
      pageName = "mypage";
    } else if (location === "/") {
      pageName = "home";
    } else if (location === "/ranking") {
      pageName = "ranking";
    } else if (location === "/mall/cart") {
      pageName = "cart";
    }

    // Don't trigger on internal pages
    if (isInternal) {
      return;
    }

    recordPageView(pageName);
  }, [location, recordPageView, isInternal]);

  const handleClose = useCallback((pointsWon: number) => {
    recordWin(pointsWon);
    closePopup();
  }, [recordWin, closePopup]);

  return (
    <>
      {children}
      {/* Only render the popup on customer-facing pages, never on internal pages */}
      {showPopup && !isInternal && (
        <RandomSpinPopup
          jackpotConfig={jackpotConfig}
          onClose={handleClose}
        />
      )}
    </>
  );
}
