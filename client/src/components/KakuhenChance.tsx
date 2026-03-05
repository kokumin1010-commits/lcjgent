import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star, Sparkles, Trophy, ArrowRight, Zap, PartyPopper, ThumbsUp, ExternalLink, ChevronDown, ChevronUp, Search } from "lucide-react";

// ===== Types =====
type KakuhenStep = "intro" | "tiktok_url" | "review" | "meter" | "lottery" | "result";

interface OcrData {
  shopName?: string;
  productName?: string;
  totalAmount?: number;
  orderDate?: string;
  items?: Array<{
    productName?: string;
    unitPrice?: number;
    quantity?: number;
    variant?: string;
  }>;
}

interface KakuhenChanceProps {
  receiptId: number;
  receiptType: "point_request" | "line_receipt";
  orderAmount: number;
  ocrData?: OcrData;
  receiptImageUrl?: string;
  receiptImagePreview?: string;
  onComplete: (result: KakuhenResult) => void;
  onSkip: () => void;
}

interface KakuhenResult {
  resultId: number;
  isKakuhen: boolean;
  isJackpot: boolean;
  baseRate: number;
  boostedRate: number;
  lotteryNumber: string;
  winningNumber: string;
  basePoints: number;
  actualPoints: number;
  bonusPoints: number;
  orderAmount: number;
  reviewId?: number;
  reviewRating?: number;
  reviewText?: string;
  reviewTags?: string[];
}

// ===== Quick Tags =====
const QUICK_TAGS = [
  "コスパ最高", "リピ確定", "TikTokで見て買った", "期待以上",
  "香りが良い", "使いやすい", "肌に合った", "見た目が可愛い",
];

// ===== CSS Keyframes (injected once) =====
const STYLE_ID = "kakuhen-keyframes";
function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes kakuhen-float {
      0%, 100% { transform: translateY(0) rotate(0deg); opacity: 1; }
      50% { transform: translateY(-20px) rotate(180deg); opacity: 0.6; }
    }
    @keyframes kakuhen-sparkle {
      0% { transform: scale(0) rotate(0deg); opacity: 0; }
      50% { transform: scale(1) rotate(180deg); opacity: 1; }
      100% { transform: scale(0) rotate(360deg); opacity: 0; }
    }
    @keyframes kakuhen-slide-up {
      0% { transform: translateY(40px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes kakuhen-glow-pulse {
      0%, 100% { box-shadow: 0 0 20px rgba(251,146,60,0.3), 0 0 40px rgba(251,146,60,0.1); }
      50% { box-shadow: 0 0 30px rgba(251,146,60,0.6), 0 0 60px rgba(251,146,60,0.2); }
    }
    @keyframes kakuhen-shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
      20%, 40%, 60%, 80% { transform: translateX(4px); }
    }
    @keyframes kakuhen-coin-rain {
      0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
      10% { opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
    @keyframes kakuhen-bounce-in {
      0% { transform: scale(0.3); opacity: 0; }
      50% { transform: scale(1.1); }
      70% { transform: scale(0.9); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes kakuhen-number-flip {
      0% { transform: rotateX(0deg); }
      100% { transform: rotateX(360deg); }
    }
    @keyframes kakuhen-gradient-shift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `;
  document.head.appendChild(style);
}

// ===== Intro Animation (Temu-style exciting entrance) =====
function IntroAnimation({ onComplete, orderAmount }: { onComplete: () => void; orderAmount: number }) {
  const [phase, setPhase] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    injectKeyframes();
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3200),
      setTimeout(onComplete, 4500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Particle effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; life: number; maxLife: number;
    }> = [];

    const colors = ["#fb923c", "#fbbf24", "#f97316", "#facc15", "#ef4444", "#ec4899"];

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Spawn particles
      if (phase >= 2 && Math.random() > 0.3) {
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: canvas.offsetHeight + 10,
          vx: (Math.random() - 0.5) * 3,
          vy: -(Math.random() * 4 + 2),
          size: Math.random() * 4 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 0,
          maxLife: 60 + Math.random() * 40,
        });
      }

      // Update & draw
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        p.life++;
        const alpha = 1 - p.life / p.maxLife;
        if (alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      }

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [phase]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-[400px] flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Floating coins background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {phase >= 2 && Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-20px`,
              animation: `kakuhen-coin-rain ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
            }}
          >
            {["💰", "✨", "🪙", "⭐", "💎"][i % 5]}
          </div>
        ))}
      </div>

      <div className="relative z-10 text-center px-6 py-8 space-y-6">
        {/* Phase 1: Slot machine icon appears */}
        {phase >= 1 && (
          <div style={{ animation: "kakuhen-bounce-in 0.6s ease-out" }}>
            <div className="text-7xl mb-2">🎰</div>
          </div>
        )}

        {/* Phase 2: Title with glow */}
        {phase >= 2 && (
          <div style={{ animation: "kakuhen-slide-up 0.5s ease-out" }}>
            <h2
              className="text-3xl font-black text-transparent bg-clip-text"
              style={{
                backgroundImage: "linear-gradient(90deg, #fb923c, #fbbf24, #f97316, #fbbf24, #fb923c)",
                backgroundSize: "200% 100%",
                animation: "kakuhen-gradient-shift 2s ease infinite",
              }}
            >
              確変チャンス！
            </h2>
          </div>
        )}

        {/* Phase 3: Amount display */}
        {phase >= 3 && (
          <div style={{ animation: "kakuhen-bounce-in 0.5s ease-out" }}>
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/40 rounded-full px-6 py-3"
              style={{ animation: "kakuhen-glow-pulse 2s ease-in-out infinite" }}
            >
              <span className="text-orange-300 text-sm font-medium">対象金額</span>
              <span className="text-2xl font-black text-white">¥{orderAmount.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Phase 4: Benefit preview */}
        {phase >= 4 && (
          <div className="space-y-3" style={{ animation: "kakuhen-slide-up 0.5s ease-out" }}>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">通常還元</div>
                <div className="text-lg font-bold text-gray-400">1%</div>
              </div>
              <div className="text-orange-400 text-2xl" style={{ animation: "kakuhen-shake 0.5s ease-in-out" }}>→</div>
              <div className="text-center">
                <div className="text-xs text-orange-300 mb-1">確変モード</div>
                <div className="text-2xl font-black text-orange-400">1.5%</div>
              </div>
            </div>
            <p className="text-sm text-yellow-300/80 font-medium">
              ＋レシート購入金額全額キャッシュバックの抽選も！
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Star Rating Component =====
function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  const labels = ["", "うーん…", "いまいち", "普通", "良い！", "最高！"];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            className="transition-all duration-200 active:scale-125"
          >
            <Star
              className={`w-10 h-10 ${
                star <= rating
                  ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]"
                  : "text-gray-600"
              }`}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <span className="text-sm font-medium text-yellow-400">{labels[rating]}</span>
      )}
    </div>
  );
}

// ===== How-to Guide Component =====
function HowToGuide({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) {
  return (
    <div className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <span className="text-sm font-bold text-gray-200">TikTok URLの見つけ方</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4" style={{ animation: "kakuhen-slide-up 0.3s ease-out" }}>
          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">1</div>
            <div>
              <p className="text-sm font-medium text-gray-200">TikTokアプリを開く</p>
              <p className="text-xs text-gray-400 mt-0.5">購入のきっかけになった動画やライバーを探します</p>
            </div>
          </div>
          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">2</div>
            <div>
              <p className="text-sm font-medium text-gray-200">共有ボタンをタップ</p>
              <p className="text-xs text-gray-400 mt-0.5">動画の右下にある矢印アイコン → 「リンクをコピー」</p>
            </div>
          </div>
          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">3</div>
            <div>
              <p className="text-sm font-medium text-gray-200">ここに貼り付け</p>
              <p className="text-xs text-gray-400 mt-0.5">コピーしたURLを下の入力欄にペーストするだけ！</p>
            </div>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-2">
            <p className="text-xs text-cyan-300">💡 ライバーのプロフィールURLでもOK！動画URLでもプロフィールURLでも確変チャンスに参加できます。</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Meter Animation Component =====
function MeterAnimation({
  baseRate,
  boostedRate,
  isKakuhen,
  onComplete,
}: {
  baseRate: number;
  boostedRate: number;
  isKakuhen: boolean;
  onComplete: () => void;
}) {
  const [currentRate, setCurrentRate] = useState(baseRate);
  const [phase, setPhase] = useState<"filling" | "boosting" | "done">("filling");
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    injectKeyframes();
    const t1 = setTimeout(() => {
      setCurrentRate(baseRate);
      setPhase("boosting");
    }, 500);

    const t2 = setTimeout(() => {
      if (isKakuhen) {
        setGlowing(true);
        setCurrentRate(boostedRate);
      }
      setPhase("done");
    }, 2000);

    const t3 = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const percentage = (currentRate / 2) * 100;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <h3 className="text-lg font-bold text-white">還元率メーター</h3>

      <div className="w-full max-w-xs">
        <div className={`relative h-8 bg-gray-800 rounded-full overflow-hidden border-2 ${
          glowing ? "border-orange-400" : "border-gray-600"
        }`}
          style={glowing ? { animation: "kakuhen-glow-pulse 1.5s ease-in-out infinite" } : {}}
        >
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              isKakuhen && phase !== "filling"
                ? "bg-gradient-to-r from-orange-500 to-yellow-400"
                : "bg-gradient-to-r from-pink-500 to-rose-400"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>0%</span>
          <span>1%</span>
          <span>2%</span>
        </div>
      </div>

      <div className={`text-center transition-all duration-500 ${glowing ? "scale-110" : ""}`}>
        <div className={`text-5xl font-black ${
          isKakuhen && phase !== "filling"
            ? "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300"
            : "text-pink-400"
        }`}>
          {currentRate.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-400 mt-1">還元率</div>
      </div>

      {isKakuhen && phase === "done" && (
        <div className="flex items-center gap-2 text-orange-400 animate-bounce">
          <Zap className="w-5 h-5" />
          <span className="font-bold">確変モード発動！</span>
          <Zap className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

// ===== Lottery Animation Component =====
function LotteryAnimation({
  lotteryNumber,
  winningNumber,
  isJackpot,
  onComplete,
}: {
  lotteryNumber: string;
  winningNumber: string;
  isJackpot: boolean;
  onComplete: () => void;
}) {
  const [displayDigits, setDisplayDigits] = useState<string[]>(["?", "?", "?", "?", "?", "?"]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    injectKeyframes();
    const userDigits = lotteryNumber.padStart(6, "0").split("");
    let revealed = 0;

    intervalRef.current = setInterval(() => {
      setDisplayDigits((prev) => {
        return prev.map((d, i) => {
          if (i < revealed) return userDigits[i];
          return String(Math.floor(Math.random() * 10));
        });
      });
    }, 80);

    const revealNext = () => {
      if (revealed < 6) {
        revealed++;
        setRevealedCount(revealed);
        if (revealed < 6) {
          setTimeout(revealNext, 600);
        } else {
          setTimeout(() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setDisplayDigits(userDigits);
            setShowResult(true);
            setTimeout(onComplete, 2000);
          }, 400);
        }
      }
    };

    setTimeout(revealNext, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <h3 className="text-lg font-bold text-white">全額キャッシュバック抽選中...</h3>

      <div className={`p-6 rounded-2xl border-2 ${
        isJackpot && showResult
          ? "border-yellow-400 bg-gradient-to-b from-yellow-900/30 to-orange-900/30"
          : "border-orange-500/50 bg-gradient-to-b from-gray-900 to-gray-800"
      }`}
        style={isJackpot && showResult ? { animation: "kakuhen-glow-pulse 1s ease-in-out infinite" } : {}}
      >
        <div className="text-sm text-gray-400 text-center mb-3">あなたの抽選番号</div>
        <div className="flex gap-1 justify-center">
          {displayDigits.map((digit, i) => (
            <div key={i} className="flex items-center">
              {i === 3 && <span className="text-gray-500 text-2xl font-bold mx-1">,</span>}
              <div className={`w-12 h-16 flex items-center justify-center rounded-lg text-3xl font-black ${
                i < revealedCount
                  ? "bg-gray-800 text-orange-400 border border-orange-500/30"
                  : "bg-gray-900 text-gray-300 border border-gray-700"
              }`}
                style={i < revealedCount ? { animation: "kakuhen-bounce-in 0.3s ease-out" } : {}}
              >
                {digit}
              </div>
            </div>
          ))}
        </div>
        <div className="text-sm text-gray-500 text-center mt-3">
          当選番号: {winningNumber.slice(0, 3)},{winningNumber.slice(3)}
        </div>
      </div>

      {showResult && (
        <div className={`text-center ${isJackpot ? "animate-bounce" : ""}`}
          style={{ animation: "kakuhen-bounce-in 0.5s ease-out" }}
        >
          {isJackpot ? (
            <div className="space-y-2">
              <div className="text-4xl">🎉🎊🎉</div>
              <div className="text-2xl font-black text-yellow-400">大当たり！！！</div>
              <div className="text-lg text-yellow-300">全額キャッシュバック確定！</div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm">
              惜しくもハズレ...次回もチャレンジ！
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Main Component =====
export default function KakuhenChance({
  receiptId,
  receiptType,
  orderAmount,
  ocrData,
  receiptImageUrl,
  receiptImagePreview,
  onComplete,
  onSkip,
}: KakuhenChanceProps) {
  const [step, setStep] = useState<KakuhenStep>("intro");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [kakuhenData, setKakuhenData] = useState<KakuhenResult | null>(null);
  const [guideExpanded, setGuideExpanded] = useState(false);

  const kakuhenMutation = trpc.kakuhen.play.useMutation();
  const reviewMutation = trpc.receiptReview.submit.useMutation();

  // Check participation count for guide auto-expand (first 3 times)
  useEffect(() => {
    const countStr = localStorage.getItem("kakuhen_play_count") || "0";
    const count = parseInt(countStr, 10);
    if (count < 3) {
      setGuideExpanded(true);
    }
  }, []);

  // Product info from OCR
  const productName = ocrData?.items?.[0]?.productName || ocrData?.productName || "商品";
  const brandName = ocrData?.shopName || "";
  const receiptPreview = receiptImagePreview || receiptImageUrl;

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setReviewText((prev) => {
      const hashTag = `#${tag}`;
      if (prev.includes(hashTag)) {
        return prev.replace(hashTag, "").replace(/\s+/g, " ").trim();
      }
      return prev ? `${prev} ${hashTag}` : hashTag;
    });
  }, []);

  const handleIntroComplete = useCallback(() => {
    setStep("tiktok_url");
  }, []);

  const handleStartKakuhen = useCallback(async () => {
    try {
      const result = await kakuhenMutation.mutateAsync({
        receiptType,
        receiptId,
        orderAmount,
        tiktokUrl: tiktokUrl.trim() || undefined,
      });
      setKakuhenData(result as unknown as KakuhenResult);
      // Increment play count in localStorage
      const countStr = localStorage.getItem("kakuhen_play_count") || "0";
      const count = parseInt(countStr, 10);
      localStorage.setItem("kakuhen_play_count", String(count + 1));
      setStep("meter");
    } catch (err: any) {
      toast.error(err.message || "エラーが発生しました");
    }
  }, [tiktokUrl, receiptType, receiptId, orderAmount]);

  const handleSubmitReview = useCallback(async () => {
    if (rating === 0) {
      toast.error("星評価を選択してください");
      return;
    }
    if (!reviewText.trim()) {
      toast.error("レビューを入力してください");
      return;
    }

    try {
      const reviewResult = await reviewMutation.mutateAsync({
        receiptType,
        receiptId,
        kakuhenResultId: kakuhenData?.resultId,
        productName,
        brandName: brandName || undefined,
        shopName: ocrData?.shopName || undefined,
        purchaseAmount: orderAmount,
        rating,
        reviewText: reviewText.trim(),
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        receiptImageUrl: receiptImageUrl || undefined,
        tiktokUrl: tiktokUrl.trim() || undefined,
      });

      if (kakuhenData) {
        kakuhenData.reviewId = reviewResult.reviewId;
        kakuhenData.reviewRating = rating;
        kakuhenData.reviewText = reviewText;
        kakuhenData.reviewTags = selectedTags;
      }

      handleStartKakuhen();
    } catch (err: any) {
      toast.error(err.message || "レビューの投稿に失敗しました");
    }
  }, [rating, reviewText, selectedTags, kakuhenData, handleStartKakuhen]);

  const handleMeterComplete = useCallback(() => {
    setStep("lottery");
  }, []);

  const handleLotteryComplete = useCallback(() => {
    setStep("result");
  }, []);

  const handleFinish = useCallback(() => {
    if (kakuhenData) {
      onComplete(kakuhenData);
    }
  }, [kakuhenData, onComplete]);

  const handleOpenTikTok = useCallback(() => {
    // Try deep link first (mobile), fallback to web
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      // Try to open TikTok app
      window.location.href = "snssdk1233://";
      setTimeout(() => {
        window.open("https://www.tiktok.com", "_blank");
      }, 1500);
    } else {
      window.open("https://www.tiktok.com", "_blank");
    }
    toast.info("TikTokでURLをコピーして、ここに貼り付けてください！", { duration: 5000 });
  }, []);

  // Step labels for progress (excluding intro)
  const stepLabels = useMemo(() => ["URL", "レビュー", "メーター", "抽選", "結果"], []);
  const stepKeys: KakuhenStep[] = useMemo(() => ["tiktok_url", "review", "meter", "lottery", "result"], []);

  return (
    <div className="space-y-6">
      {/* Intro Animation */}
      {step === "intro" && (
        <IntroAnimation onComplete={handleIntroComplete} orderAmount={orderAmount} />
      )}

      {/* Step Progress (shown after intro) */}
      {step !== "intro" && (
        <div className="flex items-center justify-center gap-2 px-4">
          {stepLabels.map((label, i) => {
            const currentIndex = stepKeys.indexOf(step);
            const isActive = i === currentIndex;
            const isDone = i < currentIndex;
            return (
              <div key={i} className="flex items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-white scale-110 shadow-[0_0_10px_rgba(251,146,60,0.5)]"
                    : isDone
                    ? "bg-green-500 text-white"
                    : "bg-gray-700 text-gray-400"
                }`}>
                  {isDone ? "✓" : i + 1}
                </div>
                <span className={`text-[10px] hidden sm:inline ${isActive ? "text-orange-400 font-bold" : "text-gray-500"}`}>
                  {label}
                </span>
                {i < 4 && <div className={`w-4 h-0.5 ${isDone ? "bg-green-500" : "bg-gray-700"}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 1: TikTok URL */}
      {step === "tiktok_url" && (
        <Card className="bg-gradient-to-b from-gray-900 to-gray-800 border-orange-500/30"
          style={{ animation: "kakuhen-slide-up 0.4s ease-out" }}
        >
          <CardContent className="pt-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="text-4xl">🎰</div>
              <h3 className="text-xl font-black text-white">確変チャンス！</h3>
              <p className="text-sm text-gray-400">
                TikTok URLを入力すると還元率1.5%にUP＋レシート購入金額全額キャッシュバックのチャンスも！
              </p>
            </div>

            {/* How-to Guide */}
            <HowToGuide
              isExpanded={guideExpanded}
              onToggle={() => setGuideExpanded(!guideExpanded)}
            />

            {/* URL Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                購入のきっかけになったTikTok動画 / ライバーのURL（任意）
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="動画またはライバーのURLを貼り付け"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none"
                />
                {tiktokUrl && (
                  <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                )}
              </div>
              <p className="text-xs text-gray-500">
                動画URL・ライバーのプロフィールURLどちらでもOK！還元率が1% → 1.5%にUP！
              </p>
            </div>

            {/* TikTokで探すボタン */}
            <Button
              variant="outline"
              className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 h-11"
              onClick={handleOpenTikTok}
            >
              <Search className="w-4 h-4 mr-2" />
              TikTokで探す
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-600 text-gray-400 hover:text-white"
                onClick={() => setStep("review")}
              >
                スキップ
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold"
                onClick={() => setStep("review")}
              >
                次へ <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review */}
      {step === "review" && (
        <Card className="bg-gradient-to-b from-gray-900 to-gray-800 border-orange-500/30"
          style={{ animation: "kakuhen-slide-up 0.4s ease-out" }}
        >
          <CardContent className="pt-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="text-4xl">📝</div>
              <h3 className="text-xl font-black text-white">商品レビュー</h3>
              <p className="text-sm text-gray-400">
                購入証明付きのリアルな口コミを投稿しよう
              </p>
            </div>

            {/* Receipt Preview + Product Info */}
            <div className="flex gap-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              {receiptPreview && (
                <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden border border-gray-600 relative">
                  <img
                    src={receiptPreview}
                    alt="レシート"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-green-500/80 text-white text-[8px] text-center py-0.5">
                    ✅ AI読取済み
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] mb-2">
                  🤖 AI自動認識
                </Badge>
                <p className="font-bold text-white text-sm truncate">{productName}</p>
                {brandName && (
                  <p className="text-xs text-gray-400 mt-0.5">{brandName}</p>
                )}
                <p className="text-orange-400 font-bold mt-1">¥{orderAmount.toLocaleString()}</p>
                {ocrData?.orderDate && (
                  <p className="text-xs text-gray-500 mt-0.5">{ocrData.orderDate}</p>
                )}
              </div>
            </div>

            {/* Star Rating */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                星評価 <span className="text-red-400 text-xs">必須</span>
              </h4>
              <StarRating rating={rating} onRate={setRating} />
            </div>

            {/* Review Text */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                💬 一言レビュー <span className="text-red-400 text-xs">必須</span>
              </h4>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="使ってみた感想を教えてください..."
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 min-h-[100px] resize-none focus:border-orange-400"
              />
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">{reviewText.length}文字</span>
                <span className="text-gray-500">正直な感想でOK！</span>
              </div>

              {/* Quick Tags */}
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                        : "bg-gray-800 text-gray-400 border border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold h-12"
              disabled={rating === 0 || !reviewText.trim() || reviewMutation.isPending || kakuhenMutation.isPending}
              onClick={handleSubmitReview}
            >
              {reviewMutation.isPending || kakuhenMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  送信中...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  レビューを送信して確変チャンス！
                </div>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Meter Animation */}
      {step === "meter" && kakuhenData && (
        <Card className="bg-gradient-to-b from-gray-900 to-gray-800 border-orange-500/30">
          <CardContent className="pt-6">
            <MeterAnimation
              baseRate={kakuhenData.baseRate}
              boostedRate={kakuhenData.boostedRate}
              isKakuhen={kakuhenData.isKakuhen}
              onComplete={handleMeterComplete}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Lottery Animation */}
      {step === "lottery" && kakuhenData && (
        <Card className="bg-gradient-to-b from-gray-900 to-gray-800 border-orange-500/30">
          <CardContent className="pt-6">
            <LotteryAnimation
              lotteryNumber={kakuhenData.lotteryNumber}
              winningNumber={kakuhenData.winningNumber}
              isJackpot={kakuhenData.isJackpot}
              onComplete={handleLotteryComplete}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 5: Result */}
      {step === "result" && kakuhenData && (
        <div className="space-y-4" style={{ animation: "kakuhen-bounce-in 0.5s ease-out" }}>
          {/* Points Result */}
          <Card className={`border-2 ${
            kakuhenData.isJackpot
              ? "border-yellow-400 bg-gradient-to-b from-yellow-900/30 to-orange-900/20"
              : kakuhenData.isKakuhen
              ? "border-orange-400 bg-gradient-to-b from-orange-900/20 to-gray-900"
              : "border-gray-600 bg-gray-900"
          }`}
            style={kakuhenData.isJackpot ? { animation: "kakuhen-glow-pulse 1.5s ease-in-out infinite" } : {}}
          >
            <CardContent className="pt-6 text-center space-y-3">
              <div className="text-4xl">
                {kakuhenData.isJackpot ? "🎊" : kakuhenData.isKakuhen ? "🎉" : "✨"}
              </div>
              <h3 className="text-xl font-black text-white">
                {kakuhenData.isJackpot
                  ? "全額キャッシュバック！！！"
                  : kakuhenData.isKakuhen
                  ? "確変モード確定！"
                  : "ポイント獲得！"}
              </h3>
              <div className={`text-4xl font-black ${
                kakuhenData.isJackpot
                  ? "text-yellow-400"
                  : kakuhenData.isKakuhen
                  ? "text-orange-400"
                  : "text-pink-400"
              }`}>
                {kakuhenData.boostedRate}%還元
              </div>
              <div className="text-sm text-orange-300 font-bold">
                ¥{kakuhenData.orderAmount.toLocaleString()} × {kakuhenData.boostedRate}% = +{kakuhenData.actualPoints}pt 獲得！
              </div>
              {kakuhenData.bonusPoints > 0 && (
                <div className="text-xs text-gray-400">
                  通常（{kakuhenData.basePoints}pt）より <span className="text-green-400 font-bold">+{kakuhenData.bonusPoints}pt</span> お得！
                </div>
              )}
              {!kakuhenData.isJackpot && (
                <div className="text-xs text-gray-500">
                  全額キャッシュバックは惜しくもハズレ...次回もチャレンジ！
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Summary */}
          {kakuhenData.reviewRating && (
            <Card className="bg-gray-900/50 border-green-500/30">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
                  <ThumbsUp className="w-4 h-4" />
                  あなたのレビュー
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= (kakuhenData.reviewRating || 0)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-600"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-gray-300 text-sm">{kakuhenData.reviewText}</p>
                <p className="text-xs text-green-400/70">
                  ✅ レビューが投稿されました！他のユーザーの参考になります
                </p>
              </CardContent>
            </Card>
          )}

          {/* Complete Button */}
          <Button
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold h-12"
            onClick={handleFinish}
          >
            <PartyPopper className="w-5 h-5 mr-2" />
            完了 ✨
          </Button>
        </div>
      )}
    </div>
  );
}
