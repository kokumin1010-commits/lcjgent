import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import LuxurySpinWheel, {
  Confetti,
  Fireworks,
  FallingCoins,
  ScreenFlash,
  FloatingParticles,
  GlowCard,
  StaggerReveal,
  useCountUp,
} from "@/components/LuxurySpinWheel";

/* ═══════════════════════════════════════════════════════════════
   REGISTRATION BONUS ROULETTE
   新規会員登録完了後に表示される特典ルーレット
   必ず500ptが大当たりとして当選する
   その後、友達招待チャレンジへ誘導
   ═══════════════════════════════════════════════════════════════ */

const BONUS_ITEMS = [
  { label: "100pt", emoji: "⭐" },
  { label: "200pt", emoji: "💎" },
  { label: "300pt", emoji: "🌟" },
  { label: "350pt", emoji: "🍀" },
  { label: "500pt 大当たり", emoji: "🎁" },
  { label: "400pt", emoji: "🧧" },
  { label: "450pt", emoji: "✨" },
  { label: "50pt", emoji: "🎲" },
];

// 500pt大当たりは index 4
const JACKPOT_INDEX = 4;

type Phase = "spinning" | "result";

export default function RegistrationBonus() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("spinning");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const pointsDisplay = useCountUp(phase === "result" ? 500 : 0, 2000, 500);
  const awardedRef = useRef(false);

  // Award 500pt registration bonus via API
  const awardMutation = trpc.lineLogin.awardRegistrationBonus.useMutation({
    onSuccess: (data: { awarded: boolean; message?: string }) => {
      if (data.awarded) {
        console.log(`[RegistrationBonus] 500pt awarded successfully`);
      } else {
        console.log(`[RegistrationBonus] Already awarded: ${data.message}`);
      }
    },
    onError: (err: { message: string }) => {
      console.error(`[RegistrationBonus] Award error:`, err.message);
    },
  });

  // Check if user came from registration
  useEffect(() => {
    const fromRegistration = sessionStorage.getItem("lcj_from_registration");
    if (!fromRegistration) {
      setLocation("/");
      return;
    }
  }, [setLocation]);

  const handleSpinComplete = () => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 600);
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 3000);
    setShowCoins(true);
    setTimeout(() => setShowCoins(false), 4000);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);

    if (!awardedRef.current) {
      awardedRef.current = true;
      awardMutation.mutate({ points: 500 });
    }

    setTimeout(() => setPhase("result"), 500);
  };

  const handleGoToFriendChallenge = () => {
    sessionStorage.removeItem("lcj_from_registration");
    setLocation("/friend-challenge");
  };

  const handleGoToMypage = () => {
    sessionStorage.removeItem("lcj_from_registration");
    window.location.href = "/mypage";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-auto">
      {showFlash && <ScreenFlash color="rgba(251,191,36,0.6)" />}
      {showFireworks && <Fireworks count={10} />}
      {showCoins && <FallingCoins />}
      {showConfetti && <Confetti count={100} />}
      <FloatingParticles />

      {/* LCJ MALL logo */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
          style={{ background: "linear-gradient(135deg, #ec4899, #f43f5e)" }}>
          🛍
        </div>
        <span className="text-white/80 font-bold text-sm tracking-wider">LCJ MALL</span>
      </div>

      {/* Spinning phase */}
      {phase === "spinning" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
          <div className="text-center mb-6 z-10">
            <div className="text-yellow-400 text-sm font-bold tracking-widest mb-1"
              style={{ textShadow: "0 0 10px rgba(251,191,36,0.5)" }}>
              ✨ REGISTRATION BONUS ✨
            </div>
            <h1 className="text-white text-2xl font-black"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
              🎊 新規登録特典ルーレット！
            </h1>
            <p className="text-white/60 text-sm mt-1">会員登録おめでとうございます！特別なルーレットを回しましょう</p>
          </div>

          <LuxurySpinWheel
            items={BONUS_ITEMS}
            targetIndex={JACKPOT_INDEX}
            onComplete={handleSpinComplete}
            autoStart={true}
            tierColor="#fbbf24"
          />
        </div>
      )}

      {/* Result phase */}
      {phase === "result" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">
            <StaggerReveal delay={0} duration={600}>
              <div className="text-center mb-6">
                <div className="text-6xl mb-2" style={{ animation: "jackpotBounce 1s ease-out" }}>🎉</div>
                <h2 className="text-yellow-400 text-3xl font-black"
                  style={{ textShadow: "0 0 30px rgba(251,191,36,0.8), 0 0 60px rgba(251,191,36,0.4)" }}>
                  大当たり！
                </h2>
                <p className="text-white/60 text-sm mt-1">新規登録特典ルーレット</p>
              </div>
            </StaggerReveal>

            <StaggerReveal delay={400} duration={600}>
              <GlowCard glowColor="#fbbf24, #ef4444, #fbbf24">
                <div className="text-center py-8 px-6">
                  <div className="text-white/60 text-sm mb-2">獲得ポイント</div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-yellow-400 text-xl">+</span>
                    <span className="text-yellow-400 font-black" style={{
                      fontSize: "4rem",
                      lineHeight: 1,
                      textShadow: "0 0 30px rgba(251,191,36,0.6), 0 2px 4px rgba(0,0,0,0.5)",
                    }}>{pointsDisplay}</span>
                    <span className="text-yellow-400/80 text-2xl font-bold ml-1">pt</span>
                  </div>
                  <div className="text-white/40 text-xs mt-2">ポイントはマイページで確認できます</div>
                </div>
              </GlowCard>
            </StaggerReveal>

            <StaggerReveal delay={1200} duration={600}>
              <div className="mt-6 text-center">
                <div className="text-white/80 text-sm mb-3">
                  🎯 友達を招待してさらにポイントGET！
                </div>
                <button
                  onClick={handleGoToFriendChallenge}
                  className="w-full py-4 rounded-2xl text-lg font-black text-white active:scale-95 transition-transform relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                    boxShadow: "0 4px 20px rgba(245,158,11,0.5)",
                    animation: "btnBounce 2s ease-in-out infinite",
                  }}
                >
                  <div className="absolute inset-0" style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                    animation: "shimmerBtn 2.5s ease-in-out infinite",
                  }} />
                  <span className="relative z-10">🎰 友達1人を招待しよう！</span>
                </button>
                <p className="text-yellow-400/60 text-xs mt-2">
                  友達を招待するとルーレットが回せます！最大5,000ptGET
                </p>
              </div>
            </StaggerReveal>

            <StaggerReveal delay={1800} duration={600}>
              <div className="mt-4 text-center">
                <button
                  onClick={handleGoToMypage}
                  className="text-white/50 text-sm underline underline-offset-4 hover:text-white/80 transition-colors"
                >
                  マイページでポイントを確認する →
                </button>
              </div>
            </StaggerReveal>
          </div>

          <style>{`
            @keyframes jackpotBounce {
              0% { transform: scale(0) rotate(-30deg); }
              50% { transform: scale(1.3) rotate(10deg); }
              70% { transform: scale(0.9) rotate(-5deg); }
              100% { transform: scale(1) rotate(0deg); }
            }
            @keyframes btnBounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
            @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
          `}</style>
        </div>
      )}
    </div>
  );
}
