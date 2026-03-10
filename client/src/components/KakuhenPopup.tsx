import { useState, useEffect, useRef, useCallback } from "react";
import haptic from "@/lib/haptic";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, X } from "lucide-react";

interface KakuhenPopupProps {
  isOpen: boolean;
  orderAmount: number;
  pointsCalculated: number;
  onStart: () => void;
  onSkip: () => void;
}

// Particle type for the animation
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  type: "star" | "coin" | "sparkle" | "circle";
}

// Generate random particles
function generateParticles(count: number): Particle[] {
  const colors = [
    "#FFD700", "#FF6B6B", "#FF69B4", "#00CED1",
    "#FFE66D", "#FF8C00", "#FF1493", "#7B68EE",
    "#FFA500", "#FF4500", "#FFFF00", "#00FF7F",
  ];
  const types: Particle["type"][] = ["star", "coin", "sparkle", "circle"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 12 + 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 2,
    duration: Math.random() * 2 + 1.5,
    type: types[Math.floor(Math.random() * types.length)],
  }));
}

export default function KakuhenPopup({
  isOpen,
  orderAmount,
  pointsCalculated,
  onStart,
  onSkip,
}: KakuhenPopupProps) {
  const [particles] = useState(() => generateParticles(30));
  const [showContent, setShowContent] = useState(false);
  const [showBoostedPoints, setShowBoostedPoints] = useState(false);
  const [animPhase, setAnimPhase] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const boostedPoints = Math.floor(orderAmount * 0.015);

  useEffect(() => {
    if (!isOpen) {
      setShowContent(false);
      setShowBoostedPoints(false);
      setAnimPhase(0);
      return;
    }

    // Phase 1: Show overlay + particles (0ms)
    setAnimPhase(1);
    haptic.celebration();

    // Phase 2: Show main content (400ms)
    const t1 = setTimeout(() => {
      setShowContent(true);
      setAnimPhase(2);
      haptic.spinStart();
    }, 400);

    // Phase 3: Show boosted points comparison (1200ms)
    const t2 = setTimeout(() => {
      setShowBoostedPoints(true);
      setAnimPhase(3);
      haptic.success();
    }, 1200);

    // Phase 4: Show skip button after 5 seconds
    setShowSkipButton(false);
    const t3 = setTimeout(() => {
      setShowSkipButton(true);
    }, 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen]);

  const handleStart = useCallback(() => {
    haptic.grandCelebration();
    onStart();
  }, [onStart]);

  const handleSkip = useCallback(() => {
    haptic.dismiss();
    onSkip();
  }, [onSkip]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ perspective: "1000px" }}
    >
      {/* Backdrop with animated gradient */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: "radial-gradient(ellipse at center, rgba(255,100,0,0.3) 0%, rgba(0,0,0,0.85) 100%)",
          opacity: animPhase >= 1 ? 1 : 0,
        }}
      />

      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: animPhase >= 1 ? 1 : 0,
              animation: `kakuhenFloat ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            }}
          >
            {p.type === "star" && (
              <svg viewBox="0 0 24 24" fill={p.color} className="w-full h-full drop-shadow-lg">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {p.type === "coin" && (
              <div
                className="w-full h-full rounded-full shadow-lg"
                style={{
                  background: `radial-gradient(circle at 35% 35%, #FFE66D, ${p.color}, #B8860B)`,
                  animation: `kakuhenSpin ${p.duration * 0.8}s linear ${p.delay}s infinite`,
                }}
              />
            )}
            {p.type === "sparkle" && (
              <Sparkles
                className="w-full h-full drop-shadow-lg"
                style={{ color: p.color }}
              />
            )}
            {p.type === "circle" && (
              <div
                className="w-full h-full rounded-full shadow-lg"
                style={{
                  background: p.color,
                  animation: `kakuhenPulse ${p.duration}s ease-in-out ${p.delay}s infinite`,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Main Content Card */}
      <div
        className="relative z-10 w-[90vw] max-w-sm mx-auto transition-all duration-700"
        style={{
          transform: showContent
            ? "scale(1) translateY(0) rotateX(0deg)"
            : "scale(0.3) translateY(60px) rotateX(15deg)",
          opacity: showContent ? 1 : 0,
        }}
      >
        {/* Close button - only show after delay */}
        {showSkipButton && (
          <button
            onClick={handleSkip}
            className="absolute -top-2 -right-2 z-20 bg-white/20 backdrop-blur-sm rounded-full p-1.5 text-white/70 hover:text-white hover:bg-white/30 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Glowing border effect */}
        <div
          className="absolute -inset-1 rounded-3xl opacity-75"
          style={{
            background: "linear-gradient(135deg, #FF6B00, #FF1493, #FFD700, #FF6B00)",
            backgroundSize: "300% 300%",
            animation: "kakuhenGlow 3s ease-in-out infinite",
            filter: "blur(8px)",
          }}
        />

        {/* Card body */}
        <div className="relative bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 rounded-3xl overflow-hidden border border-orange-500/30">
          {/* Top decorative bar */}
          <div
            className="h-1.5"
            style={{
              background: "linear-gradient(90deg, #FF6B00, #FFD700, #FF1493, #FFD700, #FF6B00)",
              backgroundSize: "200% 100%",
              animation: "kakuhenShimmer 2s linear infinite",
            }}
          />

          <div className="px-6 pt-6 pb-5 text-center">
            {/* Icon with glow */}
            <div className="relative inline-block mb-3">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(255,107,0,0.4) 0%, transparent 70%)",
                  animation: "kakuhenPulse 2s ease-in-out infinite",
                  transform: "scale(2.5)",
                }}
              />
              <div
                className="relative text-5xl"
                style={{
                  animation: "kakuhenBounce 1s ease-in-out infinite",
                  filter: "drop-shadow(0 0 20px rgba(255,165,0,0.6))",
                }}
              >
                🎰
              </div>
            </div>

            {/* Title */}
            <h2
              className="text-2xl font-black mb-1"
              style={{
                background: "linear-gradient(135deg, #FFD700, #FF6B00, #FF1493)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 10px rgba(255,165,0,0.3))",
              }}
            >
              確変チャンス到来！
            </h2>

            <p className="text-orange-300/80 text-sm font-medium mb-4">
              レシート申請ありがとうございます！
            </p>

            {/* Points comparison */}
            <div
              className="transition-all duration-700"
              style={{
                transform: showBoostedPoints ? "scale(1)" : "scale(0.8)",
                opacity: showBoostedPoints ? 1 : 0,
              }}
            >
              <div className="bg-gradient-to-r from-orange-950/60 to-yellow-950/60 rounded-2xl p-4 mb-4 border border-orange-500/20">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">通常ポイント</p>
                    <p className="text-xl font-bold text-gray-300">{pointsCalculated}<span className="text-sm">pt</span></p>
                    <p className="text-[10px] text-gray-500">還元率 1%</p>
                  </div>

                  <div className="flex flex-col items-center">
                    <Zap className="h-5 w-5 text-yellow-400" style={{ animation: "kakuhenPulse 1s ease-in-out infinite" }} />
                    <span className="text-yellow-400 text-xs font-bold">UP!</span>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-orange-400 mb-0.5 font-bold">確変ポイント</p>
                    <p
                      className="text-2xl font-black"
                      style={{
                        background: "linear-gradient(135deg, #FFD700, #FF6B00)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        filter: "drop-shadow(0 0 8px rgba(255,165,0,0.4))",
                      }}
                    >
                      {boostedPoints}<span className="text-sm">pt</span>
                    </p>
                    <p className="text-[10px] text-orange-400 font-bold">還元率 1.5%</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                  <p className="text-xs text-yellow-300/80">
                    さらに<span className="font-bold text-yellow-300">全額キャッシュバック</span>の抽選チャンスも！
                  </p>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="text-left bg-white/5 rounded-xl p-3 mb-4 border border-white/10">
              <p className="text-xs text-gray-400 mb-2 font-medium text-center">参加はかんたん3ステップ</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center">1</span>
                  <span className="text-xs text-gray-300">TikTok動画やライバーのURLを入力</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center">2</span>
                  <span className="text-xs text-gray-300">商品レビューを投稿</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center">3</span>
                  <span className="text-xs text-gray-300">確変抽選でポイントUP＋全額キャッシュバック！</span>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-2.5">
              <Button
                onClick={handleStart}
                className="w-full h-13 text-base font-black rounded-xl relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, #FF6B00, #FF1493)",
                  boxShadow: "0 0 30px rgba(255,107,0,0.4), 0 0 60px rgba(255,20,147,0.2)",
                }}
              >
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: "linear-gradient(135deg, #FF8C00, #FF69B4)",
                  }}
                />
                <span className="relative flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5" style={{ animation: "kakuhenSpin 2s linear infinite" }} />
                  チャレンジする！
                  <Sparkles className="h-5 w-5" style={{ animation: "kakuhenSpin 2s linear infinite reverse" }} />
                </span>
              </Button>

              {showSkipButton && (
                <button
                  onClick={handleSkip}
                  className="w-full text-xs text-gray-500 hover:text-gray-400 transition-colors py-1"
                >
                  あとでやる（マイページからいつでも参加できます）
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes kakuhenFloat {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.7; }
          50% { opacity: 1; }
          100% { transform: translateY(-30px) rotate(180deg) scale(1.2); opacity: 0.5; }
        }
        @keyframes kakuhenSpin {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        @keyframes kakuhenPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.3); opacity: 1; }
        }
        @keyframes kakuhenGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes kakuhenShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes kakuhenBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
