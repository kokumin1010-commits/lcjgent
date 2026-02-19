import { useEffect, useCallback, useRef } from "react";
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
 */
export default function RandomSpinProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { showPopup, jackpotConfig, closePopup, recordPageView, recordWin } = useRandomSpinPopup();
  const prevLocationRef = useRef(location);

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

    // Don't trigger on admin/master pages, login pages, or the friend challenge page itself
    if (
      location.startsWith("/master") ||
      location.startsWith("/login") ||
      location.startsWith("/liver/") ||
      location === "/friend-challenge" ||
      location === "/spin-demo" ||
      location.startsWith("/register") ||
      location.startsWith("/chat-register") ||
      location.startsWith("/registration-bonus")
    ) {
      return;
    }

    recordPageView(pageName);
  }, [location, recordPageView]);

  const handleClose = useCallback((pointsWon: number) => {
    recordWin(pointsWon);
    closePopup();
  }, [recordWin, closePopup]);

  return (
    <>
      {children}
      {showPopup && (
        <RandomSpinPopup
          jackpotConfig={jackpotConfig}
          onClose={handleClose}
        />
      )}
    </>
  );
}
