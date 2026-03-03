import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import haptic from "@/lib/haptic";
import { X } from "lucide-react";
import { useLocation } from "wouter";

// Generate a session ID for anonymous tracking
function getSessionId(): string {
  let sid = sessionStorage.getItem("bw_popup_sid");
  if (!sid) {
    sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem("bw_popup_sid", sid);
  }
  return sid;
}

interface BeautyWalletPopupProps {
  points: number;
  lineUserId?: number;
  onClose: () => void;
}

export default function BeautyWalletPopup({ points, lineUserId, onClose }: BeautyWalletPopupProps) {
  const [, setLocation] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [countUp, setCountUp] = useState(0);
  const [countDone, setCountDone] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; delay: number; color: string; size: number }>>([]);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);
  const impressionRecorded = useRef(false);
  const sessionId = useRef(getSessionId());

  // Fetch variant from Bandit algorithm
  const { data: variant } = trpc.popup.getVariant.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  const recordImpression = trpc.popup.recordImpression.useMutation();
  const recordClick = trpc.popup.recordClick.useMutation();

  // Record impression when variant is loaded
  useEffect(() => {
    if (variant && !impressionRecorded.current) {
      impressionRecorded.current = true;
      recordImpression.mutate({
        variantId: variant.id,
        lineUserId: lineUserId ?? undefined,
        sessionId: sessionId.current,
      });
    }
  }, [variant]);

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      haptic.celebration();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Count-up animation
  useEffect(() => {
    if (!isVisible || points <= 0) return;
    const duration = 1500;
    const steps = 40;
    const increment = points / steps;
    let current = 0;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), points);
      setCountUp(current);
      if (step % 5 === 0) haptic.tick();

      if (current >= points) {
        clearInterval(interval);
        setCountDone(true);
        haptic.grandCelebration();
        // Trigger confetti
        const newConfetti = Array.from({ length: 40 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 0.8,
          color: ["#FFD700", "#FF69B4", "#FF6B6B", "#7C3AED", "#F472B6", "#FBBF24"][Math.floor(Math.random() * 6)],
          size: 4 + Math.random() * 8,
        }));
        setConfetti(newConfetti);
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [isVisible, points]);

  // Floating particles
  useEffect(() => {
    const newParticles = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 3,
    }));
    setParticles(newParticles);
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    haptic.dismiss();
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleCTA = useCallback(() => {
    if (variant) {
      recordClick.mutate({
        variantId: variant.id,
        lineUserId: lineUserId ?? undefined,
        sessionId: sessionId.current,
      });
    }
    haptic.success();
    handleClose();
    setTimeout(() => setLocation("/beauty-wallet"), 350);
  }, [variant, lineUserId, handleClose, setLocation]);

  if (!variant) return null;

  const isGold = variant.theme === "gold";
  const menuItems = (variant.menuItems as Array<{ name: string; imageUrl: string; ptLabel: string }>) || [];

  // Theme colors
  const themeColors = isGold
    ? {
        bg: "from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e]",
        accent: "#FFD700",
        accentLight: "#FFF8DC",
        ctaBg: "from-yellow-500 via-amber-400 to-yellow-500",
        ctaText: "text-gray-900",
        cardBg: "bg-white/10",
        cardBorder: "border-yellow-500/30",
        shimmer: "from-transparent via-yellow-200/30 to-transparent",
        ptBadge: "bg-yellow-500/20 text-yellow-300",
      }
    : {
        bg: "from-[#1a0a2e] via-[#2d1040] to-[#1a0a2e]",
        accent: "#FF69B4",
        accentLight: "#FFE4F0",
        ctaBg: "from-pink-500 via-rose-400 to-pink-500",
        ctaText: "text-white",
        cardBg: "bg-white/10",
        cardBorder: "border-pink-500/30",
        shimmer: "from-transparent via-pink-200/30 to-transparent",
        ptBadge: "bg-pink-500/20 text-pink-300",
      };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible && !isClosing ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Popup */}
      <div
        className={`relative w-[92%] max-w-[380px] max-h-[85vh] overflow-y-auto rounded-3xl shadow-2xl transition-all duration-500 ${
          isVisible && !isClosing
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-75 opacity-0 translate-y-8"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background gradient */}
        <div className={`bg-gradient-to-b ${themeColors.bg} rounded-3xl p-5 relative overflow-hidden`}>
          {/* Floating particles */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute w-1 h-1 rounded-full opacity-40 animate-pulse"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                backgroundColor: themeColors.accent,
                animationDelay: `${p.delay}s`,
                animationDuration: "2s",
              }}
            />
          ))}

          {/* Confetti */}
          {confetti.map((c) => (
            <div
              key={c.id}
              className="absolute top-0 animate-confetti-fall"
              style={{
                left: `${c.x}%`,
                animationDelay: `${c.delay}s`,
                width: c.size,
                height: c.size,
                backgroundColor: c.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>

          {/* Header */}
          <div className="text-center mb-4 relative z-[1]">
            <p className="text-xs font-medium tracking-wider uppercase mb-2" style={{ color: themeColors.accent }}>
              Beauty Wallet
            </p>

            {/* Points display with count-up */}
            <div className="relative inline-block">
              <span
                className="text-6xl font-black tabular-nums"
                style={{
                  color: themeColors.accent,
                  textShadow: `0 0 30px ${themeColors.accent}40`,
                }}
              >
                {countUp.toLocaleString()}
              </span>
              <span className="text-2xl font-bold text-white/80 ml-1">pt</span>
            </div>

            {/* Subtext */}
            <p className="text-white/70 text-sm mt-2 whitespace-pre-line leading-relaxed">
              {variant.headline}
            </p>
            <p className="text-xs mt-1" style={{ color: `${themeColors.accent}CC` }}>
              {variant.subtext}
            </p>
          </div>

          {/* Menu items grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {menuItems.slice(0, 4).map((item, idx) => (
              <div
                key={idx}
                className={`${themeColors.cardBg} ${themeColors.cardBorder} border rounded-xl overflow-hidden transition-transform hover:scale-[1.02]`}
                style={{
                  animationDelay: `${idx * 0.1}s`,
                }}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <p className="text-white font-bold text-xs drop-shadow-lg">{item.name}</p>
                  </div>
                </div>
                <div className="px-2 py-1.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${themeColors.ptBadge}`}>
                    {item.ptLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <button
            onClick={handleCTA}
            className={`w-full py-3.5 rounded-2xl font-bold text-base ${themeColors.ctaText} bg-gradient-to-r ${themeColors.ctaBg} shadow-lg relative overflow-hidden active:scale-95 transition-transform`}
          >
            {/* Shimmer effect */}
            <div
              className={`absolute inset-0 bg-gradient-to-r ${themeColors.shimmer} animate-shimmer`}
              style={{ backgroundSize: "200% 100%" }}
            />
            <span className="relative z-[1]">{variant.ctaText}</span>
          </button>

          {/* Skip text */}
          <p
            className="text-center text-white/40 text-xs mt-3 cursor-pointer hover:text-white/60 transition-colors"
            onClick={handleClose}
          >
            あとで見る
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(500px) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall 2.5s ease-out forwards;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
