import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import haptic from "@/lib/haptic";
import sfx from "@/lib/soundEffects";
import { trpc } from "@/lib/trpc";
import LuxurySpinWheel, {
  Confetti, Fireworks, ScreenFlash, FallingCoins,
  FloatingParticles, GodRays, SparkleRing,
  StaggerReveal, GlowCard, useCountUp,
} from "@/components/LuxurySpinWheel";

/* ═══════════════════════════════════════════════════════════════
   JACKPOT CONFIG - Random big-win amounts
   ═══════════════════════════════════════════════════════════════ */
const JACKPOT_POOLS = [
  { jackpot: 5000, tier: "SUPER JACKPOT", tierEmoji: "💎", tierColor: "#fbbf24", tierGlow: "rgba(251,191,36,0.5)" },
  { jackpot: 3000, tier: "GOLD JACKPOT", tierEmoji: "🏆", tierColor: "#f59e0b", tierGlow: "rgba(245,158,11,0.5)" },
  { jackpot: 6000, tier: "DIAMOND JACKPOT", tierEmoji: "💠", tierColor: "#22d3ee", tierGlow: "rgba(34,211,238,0.5)" },
  { jackpot: 8000, tier: "PLATINUM JACKPOT", tierEmoji: "👑", tierColor: "#a78bfa", tierGlow: "rgba(167,139,250,0.5)" },
  { jackpot: 10000, tier: "ROYAL JACKPOT", tierEmoji: "🌟", tierColor: "#f472b6", tierGlow: "rgba(244,114,182,0.5)" },
];

function getRandomJackpot() {
  return JACKPOT_POOLS[Math.floor(Math.random() * JACKPOT_POOLS.length)];
}

function getSpinItems(jackpot: number) {
  return [
    { label: `${(jackpot * 0.02).toLocaleString()}pt`, emoji: "🌙" },
    { label: `${(jackpot * 0.1).toLocaleString()}pt`, emoji: "⭐" },
    { label: `${(jackpot * 0.04).toLocaleString()}pt`, emoji: "🎀" },
    { label: `${(jackpot * 0.2).toLocaleString()}pt`, emoji: "💫" },
    { label: `${jackpot.toLocaleString()}pt`, emoji: "💎" }, // target index 4 = always jackpot
    { label: `${(jackpot * 0.06).toLocaleString()}pt`, emoji: "🌸" },
    { label: `${(jackpot * 0.4).toLocaleString()}pt`, emoji: "🏅" },
    { label: `${(jackpot * 0.08).toLocaleString()}pt`, emoji: "✨" },
  ];
}

/* ═══════════════════════════════════════════════════════════════
   FREQUENCY CONTROL - localStorage-based tracking
   ═══════════════════════════════════════════════════════════════ */
const STORAGE_KEY = "lcj_spin_popup";

interface PopupTracker {
  sessionShown: boolean;       // shown in current session
  dailyCount: number;          // times shown today
  lastShownDate: string;       // YYYY-MM-DD
  cumulativeWins: number;      // accumulated "winnings" for display
  pageViews: number;           // page views in current session
  lastVisitDate: string;       // last visit date for "returning user" detection
}

function getTracker(): PopupTracker {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    sessionShown: false,
    dailyCount: 0,
    lastShownDate: "",
    cumulativeWins: 0,
    pageViews: 0,
    lastVisitDate: "",
  };
}

function saveTracker(tracker: PopupTracker) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker));
  } catch {}
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* ═══════════════════════════════════════════════════════════════
   STRATEGIC TIMING HOOK
   ═══════════════════════════════════════════════════════════════ */
export function useRandomSpinPopup() {
  const [showPopup, setShowPopup] = useState(false);
  const [jackpotConfig, setJackpotConfig] = useState(getRandomJackpot);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTriggeredRef = useRef(false);

  // Reset session flag on mount (new page load = new session)
  useEffect(() => {
    const tracker = getTracker();
    const today = getTodayStr();

    // Reset daily count if new day
    if (tracker.lastShownDate !== today) {
      tracker.dailyCount = 0;
      tracker.lastShownDate = today;
    }

    // Reset session flag (sessionStorage tracks actual browser session)
    const sessionActive = sessionStorage.getItem("lcj_spin_session");
    if (!sessionActive) {
      tracker.sessionShown = false;
      tracker.pageViews = 0;
      sessionStorage.setItem("lcj_spin_session", "1");
    }

    saveTracker(tracker);
  }, []);

  // Check if popup can be shown
  const canShow = useCallback(() => {
    const tracker = getTracker();
    const today = getTodayStr();

    // Already shown in this session
    if (tracker.sessionShown) return false;

    // Daily limit reached (max 2/day)
    if (tracker.lastShownDate === today && tracker.dailyCount >= 2) return false;

    return true;
  }, []);

  // Trigger popup
  const triggerPopup = useCallback(() => {
    if (hasTriggeredRef.current) return;
    if (!canShow()) return;

    hasTriggeredRef.current = true;
    setJackpotConfig(getRandomJackpot());
    setShowPopup(true);

    // Update tracker
    const tracker = getTracker();
    const today = getTodayStr();
    tracker.sessionShown = true;
    if (tracker.lastShownDate !== today) {
      tracker.dailyCount = 1;
      tracker.lastShownDate = today;
    } else {
      tracker.dailyCount += 1;
    }
    saveTracker(tracker);
  }, [canShow]);

  // Record page view and check strategic timing
  const recordPageView = useCallback((pageName: string) => {
    if (hasTriggeredRef.current || !canShow()) return;

    const tracker = getTracker();
    tracker.pageViews = (tracker.pageViews || 0) + 1;
    saveTracker(tracker);

    // Strategy 1: After viewing 3+ product pages
    if (pageName.startsWith("product") && tracker.pageViews >= 3) {
      // 60% chance to trigger
      if (Math.random() < 0.6) {
        timerRef.current = setTimeout(() => triggerPopup(), 1500);
        return;
      }
    }

    // Strategy 2: Mypage visit (low probability - 20%)
    if (pageName === "mypage" && Math.random() < 0.2) {
      timerRef.current = setTimeout(() => triggerPopup(), 2000);
      return;
    }

    // Strategy 3: Returning user after days away
    const today = getTodayStr();
    if (tracker.lastVisitDate && tracker.lastVisitDate !== today) {
      const lastDate = new Date(tracker.lastVisitDate);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
      if (daysSince >= 2 && Math.random() < 0.7) {
        timerRef.current = setTimeout(() => triggerPopup(), 3000);
        tracker.lastVisitDate = today;
        saveTracker(tracker);
        return;
      }
    }
    tracker.lastVisitDate = today;
    saveTracker(tracker);

    // Strategy 4: Time-based (after 60 seconds on site, 30% chance)
    if (tracker.pageViews >= 2 && Math.random() < 0.3) {
      timerRef.current = setTimeout(() => triggerPopup(), 60000);
    }
  }, [canShow, triggerPopup]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const closePopup = useCallback(() => {
    setShowPopup(false);
  }, []);

  // Record cumulative win
  const recordWin = useCallback((points: number) => {
    const tracker = getTracker();
    tracker.cumulativeWins = (tracker.cumulativeWins || 0) + points;
    saveTracker(tracker);
  }, []);

  const getCumulativeWins = useCallback(() => {
    return getTracker().cumulativeWins || 0;
  }, []);

  return {
    showPopup,
    jackpotConfig,
    triggerPopup,
    closePopup,
    recordPageView,
    recordWin,
    getCumulativeWins,
  };
}

/* ═══════════════════════════════════════════════════════════════
   NEXT STAGE PROGRESS - Shows "あと○人で達成" bar
   ═══════════════════════════════════════════════════════════════ */
function NextStageProgress() {
  const { data: campaignData } = trpc.friendReferral.getCampaign.useQuery();
  const { data: myProgress } = trpc.friendReferral.getMyProgress.useQuery(undefined, { retry: 1 });

  const stages = campaignData?.stages || [];
  const progress = myProgress?.progress;
  const totalReferrals = progress?.totalReferrals || 0;
  const currentStageIndex = stages.findIndex(s => s.stageNumber === (progress?.currentStage || 0));
  const nextStage = stages[currentStageIndex + 1] || stages[0];

  if (!nextStage) return null;

  const remaining = Math.max(0, nextStage.requiredReferrals - totalReferrals);
  const pct = Math.min(100, (totalReferrals / nextStage.requiredReferrals) * 100);

  return (
    <div className="w-full bg-white/5 border border-yellow-400/20 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-yellow-400 text-sm font-bold">
          🎯 あと{remaining}人招待で次のステージ達成！
        </p>
        <span className="text-yellow-400 text-xs font-bold">{Math.round(pct)}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #ef4444, #f97316, #fbbf24)" }}
        />
      </div>
      <p className="text-gray-500 text-xs mt-1.5">次のステージ: {nextStage.stageEmoji} {nextStage.stageName}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RANDOM SPIN POPUP COMPONENT - Full-screen immersive roulette
   ═══════════════════════════════════════════════════════════════ */
export default function RandomSpinPopup({
  jackpotConfig,
  onClose,
}: {
  jackpotConfig: { jackpot: number; tier: string; tierEmoji: string; tierColor: string; tierGlow: string };
  onClose: (pointsWon: number) => void;
}) {
  const [phase, setPhase] = useState<"spinning" | "result">("spinning");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
  const [audioInit, setAudioInit] = useState(false);

  const items = useMemo(() => getSpinItems(jackpotConfig.jackpot), [jackpotConfig.jackpot]);
  const targetIndex = 4; // Always jackpot

  const countUpValue = useCountUp(phase === "result" ? jackpotConfig.jackpot : 0, 2000, 800);

  // Cumulative display
  const [cumulativeTotal, setCumulativeTotal] = useState(0);
  useEffect(() => {
    try {
      const tracker = getTracker();
      setCumulativeTotal(tracker.cumulativeWins || 0);
    } catch {}
  }, []);

  const initAudioOnce = useCallback(() => {
    if (!audioInit) { sfx.initAudio(); setAudioInit(true); }
  }, [audioInit]);

  const handleSpinComplete = useCallback(() => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 600);
    setShowConfetti(true);
    setShowFireworks(true);
    setShowCoins(true);
    setTimeout(() => { setShowConfetti(false); setShowFireworks(false); }, 4000);
    setTimeout(() => setShowCoins(false), 5000);
    sfx.playSuperJackpot();
    haptic.grandCelebration();
    setPhase("result");
  }, []);

  const [, setLocation] = useLocation();

  const handleClaim = useCallback(() => {
    onClose(jackpotConfig.jackpot);
    setLocation("/friend-challenge");
  }, [onClose, jackpotConfig.jackpot, setLocation]);

  const handleDismiss = useCallback(() => {
    onClose(jackpotConfig.jackpot);
  }, [onClose, jackpotConfig.jackpot]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(180deg, #0a0500 0%, #1a0f00 30%, #0d0800 60%, #050300 100%)" }}
      onClick={initAudioOnce}
    >
      <FloatingParticles tier="normal" />
      <GodRays color={`${jackpotConfig.tierColor}25`} />
      {showFlash && <ScreenFlash color={`${jackpotConfig.tierColor}66`} />}
      {showConfetti && <Confetti count={100} />}
      {showFireworks && <Fireworks count={10} />}
      {showCoins && <FallingCoins />}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-40">
        {phase === "result" ? (
          <button onClick={handleDismiss} className="text-yellow-400/60 text-sm hover:text-yellow-400 transition">
            ✕ 閉じる
          </button>
        ) : (
          <div />
        )}
        <div className="text-center">
          <StaggerReveal delay={200} duration={500}>
            <h2
              className="text-lg font-black"
              style={{
                background: `linear-gradient(135deg, ${jackpotConfig.tierColor}, #ef4444)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {jackpotConfig.tierEmoji} {jackpotConfig.tier}
            </h2>
          </StaggerReveal>
        </div>
        <div />
      </div>

      {/* Cumulative wins banner */}
      {cumulativeTotal > 0 && phase === "spinning" && (
        <div className="absolute top-14 left-0 right-0 flex justify-center z-30">
          <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-4 py-1.5">
            <span className="text-yellow-400 text-xs">🏆 累計当選:</span>
            <span className="text-yellow-400 font-bold text-sm">{cumulativeTotal.toLocaleString()}pt</span>
          </div>
        </div>
      )}

      {/* Wheel area */}
      {phase === "spinning" && (
        <div className="relative flex-1 flex flex-col items-center justify-center w-full max-w-md px-4">
          <StaggerReveal delay={100} duration={500}>
            <div className="text-center mb-2">
              <div className="text-xs text-yellow-400/60 font-bold tracking-widest mb-1">✨ スペシャルチャンス ✨</div>
              <h1 className="text-2xl font-black text-white mb-1">
                スピンして<span style={{ color: jackpotConfig.tierColor }}>ポイントGET</span>
              </h1>
              <p className="text-gray-400 text-sm">
                最大 <span className="text-yellow-400 font-bold">{jackpotConfig.jackpot.toLocaleString()}pt</span> が当たる！
              </p>
            </div>
          </StaggerReveal>
          <SparkleRing />
          <LuxurySpinWheel
            items={items}
            targetIndex={targetIndex}
            tierColor={jackpotConfig.tierColor}
            onComplete={handleSpinComplete}
            onCountdownStart={initAudioOnce}
            autoStart={true}
          />
        </div>
      )}

      {/* Result display */}
      {phase === "result" && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-6 relative z-20">
          <StaggerReveal delay={300} duration={800}>
            <GlowCard glowColor={`${jackpotConfig.tierColor}, transparent, ${jackpotConfig.tierColor}, transparent`}>
              <div className="p-8 text-center space-y-5">
                <div className="text-6xl" style={{ animation: "resultEmojiBounce 1s ease-out" }}>
                  {jackpotConfig.tierEmoji}
                </div>
                <div>
                  <p className="text-yellow-400/80 text-sm font-bold mb-1">
                    {jackpotConfig.tierEmoji} 超大当たり！
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-yellow-400 text-lg">+</span>
                    <span
                      className="text-6xl font-black"
                      style={{
                        background: "linear-gradient(180deg, #ffd700 0%, #ffaa00 50%, #ff8c00 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))",
                      }}
                    >
                      {countUpValue.toLocaleString()}
                    </span>
                    <span className="text-yellow-400 text-2xl font-bold ml-1">pt</span>
                  </div>
                </div>

                {/* Cumulative total */}
                <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm font-bold">
                    🏆 累計当選: {(cumulativeTotal + jackpotConfig.jackpot).toLocaleString()}pt
                  </p>
                  <p className="text-gray-400 text-xs mt-1">どんどん積み上がっています！</p>
                </div>

                <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />

                {/* Next stage progress bar */}
                <NextStageProgress />

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm font-bold">💡 このポイントを受け取るには</p>
                  <p className="text-gray-300 text-xs mt-1">友達を招待してチャレンジをクリアしよう！</p>
                </div>
              </div>
            </GlowCard>
          </StaggerReveal>

          <StaggerReveal delay={1500} duration={600}>
            <button
              onClick={handleClaim}
              className="mt-6 w-full max-w-xs py-4 rounded-full text-lg font-black text-white active:scale-95 transition-transform relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                boxShadow: "0 4px 20px rgba(34,197,94,0.5)",
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                  animation: "shimmerBtn 2.5s ease-in-out infinite",
                }}
              />
              <span className="relative z-10">🎁 友達招待チャレンジへ！</span>
            </button>
          </StaggerReveal>

          <StaggerReveal delay={2000} duration={500}>
            <button
              onClick={handleDismiss}
              className="mt-3 text-gray-500 text-xs hover:text-gray-400 transition"
            >
              あとで確認する
            </button>
          </StaggerReveal>

          <style>{`
            @keyframes resultEmojiBounce { 0% { transform: scale(0) rotate(-20deg); } 50% { transform: scale(1.3) rotate(10deg); } 100% { transform: scale(1) rotate(0deg); } }
            @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
          `}</style>
        </div>
      )}
    </div>
  );
}
