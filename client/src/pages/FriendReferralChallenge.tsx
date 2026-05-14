import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import haptic from "@/lib/haptic";
import sfx from "@/lib/soundEffects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Copy, Share2, Trophy, Gift, Users, Star, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import LuxurySpinWheel, {
  Confetti, Fireworks, ScreenFlash, FallingCoins,
  FloatingParticles as LuxuryFloatingParticles, GodRays, SparkleRing,
  StaggerReveal, GlowCard, useCountUp,
} from "@/components/LuxurySpinWheel";

/* ──────────── Title config ──────────── */
const TITLE_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  none: { label: "ビギナー", emoji: "🌱", color: "text-gray-400", bg: "bg-gray-800" },
  bronze: { label: "ブロンズ", emoji: "🥉", color: "text-amber-400", bg: "bg-amber-900/40" },
  silver: { label: "シルバー", emoji: "🥈", color: "text-gray-300", bg: "bg-gray-700" },
  gold: { label: "ゴールド", emoji: "⭐", color: "text-yellow-400", bg: "bg-yellow-900/40" },
  platinum: { label: "プラチナ", emoji: "👑", color: "text-purple-400", bg: "bg-purple-900/40" },
  diamond: { label: "ダイヤモンド", emoji: "💎", color: "text-pink-400", bg: "bg-pink-900/40" },
};

/* ──────────── Floating particles (page-level) ──────────── */
const PARTICLES = ["✨", "🌟", "⭐", "💫", "🎀", "🎁", "💖", "🪙"];
function FloatingParticles() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {PARTICLES.concat(PARTICLES).map((p, i) => (
        <div key={i} className="absolute animate-float-particle" style={{
          left: `${(i * 13 + 5) % 95}%`, top: `${(i * 17 + 10) % 90}%`,
          fontSize: `${14 + (i % 5) * 4}px`, animationDelay: `${i * 0.7}s`,
          animationDuration: `${6 + (i % 4) * 2}s`, opacity: 0.25 + (i % 3) * 0.1,
        }}>{p}</div>
      ))}
      <style>{`
        @keyframes float-particle { 0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.15; } 25% { transform: translateY(-30px) rotate(10deg); opacity: 0.35; } 50% { transform: translateY(-15px) rotate(-5deg); opacity: 0.25; } 75% { transform: translateY(-40px) rotate(8deg); opacity: 0.3; } }
        .animate-float-particle { animation: float-particle 8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ──────────── Countdown timer ──────────── */
function CountdownTimer() {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const endDate = new Date(); endDate.setDate(endDate.getDate() + 7); endDate.setHours(23, 59, 59, 999);
    const tick = () => { const diff = Math.max(0, endDate.getTime() - Date.now()); setTime({ d: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) }); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center justify-center gap-1">
      <span className="text-yellow-300 text-xs font-bold">⏰ キャンペーン終了まで</span>
      <div className="flex gap-1 ml-2">
        {[{ v: pad(time.d), l: "日" }, { v: pad(time.h), l: "時" }, { v: pad(time.m), l: "分" }, { v: pad(time.s), l: "秒" }].map((t, i) => (
          <span key={i} className="flex items-center gap-0.5">
            <span className="font-black text-sm text-white rounded px-1.5 py-0.5" style={{ background: "rgba(220,38,38,0.9)" }}>{t.v}</span>
            <span className="text-yellow-200 text-[10px]">{t.l}</span>
            {i < 3 && <span className="text-yellow-300 text-xs font-bold mx-0.5">:</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ──────────── Social proof ticker ──────────── */
/** 名前をマスキング: 最初の1文字 + *** (絵文字対応) */
function maskTickerName(msg: string): string {
  // メッセージ形式: "○○さんが〜" → 「さんが」の前の名前部分をマスキング
  const match = msg.match(/^(.+?)さんが/);
  if (!match) return msg;
  const fullName = match[1];
  const firstChar = Array.from(fullName)[0] || "";
  return msg.replace(fullName + "さんが", firstChar + "***さんが");
}

function SocialProofTicker({ feed }: { feed: Array<{ id: number; message: string; activityType: string }> }) {
  const [idx, setIdx] = useState(0);
  const items = useMemo(() => {
    if (!feed || feed.length === 0) return ["🎉 ○***さんがステージ3を達成！", "🎰 △***さんが500ptを獲得！", "✨ □***さんが友達を5人招待！"];
    return feed.slice(0, 10).map(a => {
      const emoji = a.activityType === "stage_clear" ? "🎉" : a.activityType === "big_win" ? "🎰" : "✨";
      return `${emoji} ${maskTickerName(a.message)}`;
    });
  }, [feed]);
  useEffect(() => { const id = setInterval(() => setIdx(p => (p + 1) % items.length), 3000); return () => clearInterval(id); }, [items.length]);
  return (
    <div className="overflow-hidden h-8 relative" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="absolute inset-0 flex items-center px-4 transition-all duration-500" key={idx}>
        <span className="text-xs text-yellow-300 font-medium truncate">{items[idx]}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LUXURY SPIN OVERLAY - Full-screen immersive roulette experience
   ═══════════════════════════════════════════════════════════════ */
function LuxurySpinOverlay({ isSpecial, spinItems, targetIndex, pointsWon, onClose }: {
  isSpecial: boolean; spinItems: { label: string; emoji: string }[]; targetIndex: number; pointsWon: number; onClose: () => void;
}) {
  const [overlayPhase, setOverlayPhase] = useState<"intro" | "spinning" | "result">("intro");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
  const tierColor = isSpecial ? "#a855f7, #ec4899, #a855f7, #ec4899" : "#fbbf24, #ef4444, #f59e0b, #fbbf24";
  const countUpValue = useCountUp(overlayPhase === "result" ? pointsWon : 0, 2000, 800);

  const handleSpinComplete = () => {
    setShowFlash(true); setTimeout(() => setShowFlash(false), 600);
    setShowConfetti(true); setShowFireworks(true); setShowCoins(true);
    setOverlayPhase("result"); haptic.celebration(); sfx.playWinFanfare();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "linear-gradient(180deg, #0a0500 0%, #1a0f00 30%, #0d0800 60%, #050300 100%)" }}>
      <LuxuryFloatingParticles tier={isSpecial ? "premium" : "normal"} />
      <GodRays color={isSpecial ? "rgba(168,85,247,0.15)" : "rgba(251,191,36,0.15)"} />
      {showFlash && <ScreenFlash color={isSpecial ? "rgba(168,85,247,0.4)" : "rgba(251,191,36,0.4)"} />}
      {showConfetti && <Confetti count={100} />}
      {showFireworks && <Fireworks count={10} />}
      {showCoins && <FallingCoins />}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-40">
        {overlayPhase === "result" ? <button onClick={onClose} className="text-yellow-400/60 text-sm hover:text-yellow-400 transition">← 戻る</button> : <div />}
        <div className="text-center">
          <StaggerReveal delay={200} duration={500}>
            <h2 className="text-lg font-black" style={{ background: isSpecial ? "linear-gradient(135deg, #a855f7, #ec4899)" : "linear-gradient(135deg, #fbbf24, #ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {isSpecial ? "👑 プレミアムルーレット" : "🎰 ルーレット"}
            </h2>
          </StaggerReveal>
        </div>
        <div />
      </div>

      {/* Wheel area */}
      {overlayPhase !== "result" && (
        <div className="relative flex-1 flex items-center justify-center w-full max-w-md px-4">
          <SparkleRing />
          <LuxurySpinWheel items={spinItems} targetIndex={targetIndex} tierColor={tierColor} onComplete={handleSpinComplete} autoStart={true} />
        </div>
      )}

      {/* Result display */}
      {overlayPhase === "result" && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-6 relative z-20">
          <StaggerReveal delay={300} duration={800}>
            <GlowCard glowColor={tierColor}>
              <div className="p-8 text-center space-y-5">
                <div className="text-6xl" style={{ animation: "resultEmojiBounce 1s ease-out" }}>{spinItems[targetIndex]?.emoji || "🎉"}</div>
                <div>
                  <p className="text-yellow-400/80 text-sm font-bold mb-1">{isSpecial ? "👑 プレミアム報酬" : "🎰 ルーレット報酬"}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-yellow-400 text-lg">+</span>
                    <span className="text-6xl font-black" style={{ background: "linear-gradient(180deg, #ffd700 0%, #ffaa00 50%, #ff8c00 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))" }}>{countUpValue.toLocaleString()}</span>
                    <span className="text-yellow-400 text-2xl font-bold ml-1">pt</span>
                  </div>
                </div>
                <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />
                <p className="text-yellow-200/60 text-xs">ポイントが付与されました ✨</p>
              </div>
            </GlowCard>
          </StaggerReveal>
          <StaggerReveal delay={1500} duration={600}>
            <button onClick={onClose} className="mt-8 w-full max-w-xs py-4 rounded-full text-lg font-black text-white active:scale-95 transition-transform relative overflow-hidden"
              style={{ background: isSpecial ? "linear-gradient(135deg, #a855f7, #ec4899)" : "linear-gradient(135deg, #f59e0b, #ef4444)", boxShadow: "0 4px 20px rgba(245,158,11,0.5)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)", animation: "shimmerBtn 2.5s ease-in-out infinite" }} />
              <span className="relative z-10">OK！チャレンジに戻る 🎯</span>
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

/* ──────────── Main component ──────────── */
export default function FriendReferralChallenge() {
  const [, setLocation] = useLocation();
  const [showSpinOverlay, setShowSpinOverlay] = useState(false);
  const [isSpecialSpin, setIsSpecialSpin] = useState(false);
  const [spinApiResult, setSpinApiResult] = useState<{ items: { label: string; emoji: string }[]; targetIndex: number; pointsWon: number } | null>(null);
  const [welcomeStep, setWelcomeStep] = useState<0 | 1 | 2>(0);
  const [welcomePoints, setWelcomePoints] = useState(0);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllSpinHistory, setShowAllSpinHistory] = useState(false);

  useEffect(() => {
    const bonus = localStorage.getItem('lcj_referral_bonus');
    if (bonus) { const pts = parseInt(bonus, 10); if (pts > 0) { setWelcomePoints(pts); setWelcomeStep(1); haptic.celebration(); } localStorage.removeItem('lcj_referral_bonus'); }
  }, []);

  const { data: campaignData } = trpc.friendReferral.getCampaign.useQuery();
  const { data: myProgress, refetch: refetchProgress, isLoading: isProgressLoading } = trpc.friendReferral.getMyProgress.useQuery(undefined, { retry: 1 });
  const { data: leaderboard } = trpc.friendReferral.getLeaderboard.useQuery();
  const { data: activityFeed } = trpc.friendReferral.getActivityFeed.useQuery();

  const spinMutation = trpc.friendReferral.spin.useMutation({
    onSuccess: (data) => {
      const wheelItems = data.items.map(i => ({ label: i.label, emoji: i.emoji }));
      const targetIdx = data.items.findIndex(i => i.id === data.rewardItem.id);
      setSpinApiResult({ items: wheelItems, targetIndex: targetIdx >= 0 ? targetIdx : 0, pointsWon: data.pointsWon });
      setShowSpinOverlay(true);
    },
    onError: (err) => toast.error(err.message),
  });

  const stages = useMemo(() => campaignData?.stages || [], [campaignData]);
  const progress = myProgress?.progress;
  const campaign = myProgress?.campaign || campaignData?.campaign;
  const currentStageIndex = stages.findIndex(s => s.stageNumber === (progress?.currentStage || 0));
  const nextStage = stages[currentStageIndex + 1] || stages[0];
  const progressPercent = nextStage ? Math.min(100, ((progress?.totalReferrals || 0) / nextStage.requiredReferrals) * 100) : 100;
  const titleInfo = TITLE_CONFIG[progress?.titleLevel || "none"] || TITLE_CONFIG.none;

  const handleCopyCode = () => { if (!progress?.referralCode) return; haptic.doubleTap(); navigator.clipboard.writeText(progress.referralCode); toast.success("招待コードをコピーしました！", { icon: "📋" }); };
  const handleShare = () => {
    if (!progress?.referralCode) return;
    const siteUrl = `${window.location.origin}/register/${progress.referralCode}`;
    const shareText = `LCJ MALLで一緒にお買い物しよう！🛍️✨\n私の招待コード: ${progress.referralCode}\n登録するだけで${campaign?.inviteeBonus || 50}ptもらえるよ！\n\n👇 ここから登録 👇\n${siteUrl}`;
    haptic.doubleTap();
    if (navigator.share) { navigator.share({ title: "LCJ MALL 友達招待", text: shareText }).catch(() => {}); }
    else { navigator.clipboard.writeText(shareText); toast.success("共有テキストをコピーしました！", { icon: "📤" }); }
  };
  const handleShareLINE = () => {
    if (!progress?.referralCode) return; haptic.doubleTap();
    const siteUrl = `${window.location.origin}/register/${progress.referralCode}`;
    const text = encodeURIComponent(`🎁 LCJ MALLで一緒にポイントGET！\n招待コード: ${progress.referralCode}\n登録で${campaign?.inviteeBonus || 50}ptプレゼント✨\n\n👇 ここから登録 👇\n${siteUrl}`);
    window.open(`https://line.me/R/share?text=${text}`, "_blank");
  };
  const handleSpinClick = (special: boolean) => {
    if (spinMutation.isPending) return; sfx.initAudio(); haptic.tap(); setIsSpecialSpin(special); spinMutation.mutate({ isSpecial: special });
  };
  const handleSpinOverlayClose = () => { setShowSpinOverlay(false); setSpinApiResult(null); refetchProgress(); };

  const hasSessionToken = !!localStorage.getItem("lcj_session_token");
  const isLoggedIn = !!progress;
  const isCheckingAuth = isProgressLoading && hasSessionToken;

  // Limit displayed items
  const referralHistory = myProgress?.history || [];
  const spinHistory = myProgress?.spinHistory || [];
  const displayedReferrals = showAllHistory ? referralHistory : referralHistory.slice(0, 5);
  const displayedSpins = showAllSpinHistory ? spinHistory : spinHistory.slice(0, 5);

  return (
    <div className="min-h-screen relative" style={{ background: "linear-gradient(180deg, #0d0000 0%, #1a0000 30%, #0d0000 100%)" }}>
      <FloatingParticles />

      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-lg border-b" style={{ background: "rgba(13,0,0,0.85)", borderColor: "rgba(255,200,0,0.15)" }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/mypage")} className="p-2 rounded-full transition" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft className="h-5 w-5 text-yellow-400" />
          </button>
          <div className="flex-1"><h1 className="text-lg font-black text-white">🎰 友達招待チャレンジ</h1></div>
          {isLoggedIn && <Badge className={`${titleInfo.bg} ${titleInfo.color} border-0 font-semibold`}>{titleInfo.emoji} {titleInfo.label}</Badge>}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-24 relative z-10 space-y-4 mt-4">

        {/* Social proof ticker */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,200,0,0.1)" }}>
          <SocialProofTicker feed={activityFeed || []} />
        </div>

        {/* Countdown Timer */}
        <div className="rounded-xl p-3" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <CountdownTimer />
        </div>

        {/* ═══════════ Section 1: Referral Code ═══════════ */}
        {isCheckingAuth ? (
          <Card className="border-0" style={{ background: "rgba(255,255,255,0.04)" }}>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full flex items-center justify-center animate-pulse" style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}><span className="text-3xl">🎰</span></div>
              <h3 className="text-lg font-bold text-yellow-400">読み込み中...</h3>
              <p className="text-sm text-gray-500">あなたのチャレンジ情報を取得しています</p>
            </CardContent>
          </Card>
        ) : !isLoggedIn ? (
          <Card className="border-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", boxShadow: "0 0 20px rgba(255,180,0,0.3)" }}><span className="text-3xl">🎰</span></div>
              <h3 className="text-lg font-bold text-white">ログインして参加しよう！</h3>
              <p className="text-sm text-gray-400">友達招待チャレンジに参加して<br/>ポイントをGETしよう！</p>
              <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
                <Button onClick={() => setLocation("/line-login?redirect=/friend-challenge")} className="w-full font-black text-base py-6 rounded-xl text-white" style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 4px 20px rgba(239,68,68,0.4)" }}>✉️ メールでログイン / 新規登録</Button>
                <Button onClick={() => setLocation("/line-login?redirect=/friend-challenge")} className="w-full border-[#06C755] text-[#06C755] hover:bg-[#06C755]/10 font-bold py-6 rounded-xl" variant="outline">
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.93 2 10.74c0 3.16 2.08 5.93 5.18 7.49l-.85 3.13c-.07.26.2.47.44.34l3.68-2.07c.51.07 1.03.11 1.55.11 5.52 0 10-3.93 10-8.74S17.52 2 12 2z"/></svg>
                  LINEでログイン
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ═══ Referral Code ═══ */}
            <Card className="border-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,200,0,0.15)" }}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-yellow-400"><Gift className="h-5 w-5" /> あなたの招待コード</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 border-2 border-dashed rounded-xl px-4 py-3 text-center" style={{ borderColor: "#fbbf24", background: "rgba(251,191,36,0.05)" }}>
                    <span className="text-2xl font-black tracking-[0.3em] text-yellow-400">{progress?.referralCode || "------"}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopyCode} variant="outline" className="flex-1 border-yellow-700 text-yellow-400 hover:bg-yellow-900/20"><Copy className="h-4 w-4 mr-1" /> コピー</Button>
                  <Button onClick={handleShare} className="flex-1 text-white font-bold" style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}><Share2 className="h-4 w-4 mr-1" /> 共有</Button>
                </div>
                <Button onClick={handleShareLINE} className="w-full mt-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-5 rounded-xl">
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.93 2 10.74c0 3.16 2.08 5.93 5.18 7.49l-.85 3.13c-.07.26.2.47.44.34l3.68-2.07c.51.07 1.03.11 1.55.11 5.52 0 10-3.93 10-8.74S17.52 2 12 2z"/></svg>
                  LINEで友達に送る
                </Button>
              </CardContent>
            </Card>

            {/* ═══ My Stats (自分の実績) ═══ */}
            <Card className="border-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,200,0,0.15)" }}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-yellow-400"><Trophy className="h-5 w-5" /> あなたの実績</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                  <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <p className="text-2xl font-black text-red-400">{progress?.totalReferrals || 0}</p><p className="text-xs text-gray-500 mt-1">招待人数</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
                    <p className="text-2xl font-black text-yellow-400">{progress?.totalPointsEarned || 0}</p><p className="text-xs text-gray-500 mt-1">獲得pt</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
                    <p className="text-2xl font-black text-purple-400">{(progress?.pendingSpins || 0) + (progress?.pendingSpecialSpins || 0)}</p><p className="text-xs text-gray-500 mt-1">スピン残</p>
                  </div>
                </div>
                {/* Current title */}
                <div className="flex items-center justify-center gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="text-sm text-gray-400">現在の称号:</span>
                  <Badge className={`${titleInfo.bg} ${titleInfo.color} border-0 font-bold`}>{titleInfo.emoji} {titleInfo.label}</Badge>
                </div>
              </CardContent>
            </Card>



            {/* ═══ Stage Progress (ステージ進捗) ═══ */}
            <Card className="border-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,200,0,0.15)" }}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-yellow-400"><Star className="h-5 w-5" /> ステージ進捗</CardTitle></CardHeader>
              <CardContent>
                {nextStage && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">次のステージまで: あと{Math.max(0, nextStage.requiredReferrals - (progress?.totalReferrals || 0))}人</span>
                      <span className="text-yellow-400 font-bold">{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg, #ef4444, #f97316, #fbbf24)" }} />
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {stages.map((stage) => {
                    const isCompleted = (progress?.currentStage || 0) >= stage.stageNumber;
                    const isCurrent = nextStage?.stageNumber === stage.stageNumber;
                    return (
                      <div key={stage.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isCurrent ? "ring-1 ring-yellow-500/50" : ""}`}
                        style={{ background: isCompleted ? "rgba(239,68,68,0.1)" : isCurrent ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${isCompleted ? "rgba(239,68,68,0.2)" : isCurrent ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.05)"}`, opacity: !isCompleted && !isCurrent ? 0.5 : 1 }}>
                        <div className="h-10 w-10 rounded-full flex items-center justify-center text-lg shrink-0"
                          style={{ background: isCompleted ? "linear-gradient(135deg, #ef4444, #f97316)" : isCurrent ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)" }}>
                          {isCompleted ? "✅" : stage.stageEmoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{stage.stageName}</span>
                            {isCurrent && <Badge className="bg-yellow-900/40 text-yellow-400 border-0 text-[10px]">NOW</Badge>}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{stage.requiredReferrals}人招待 → 🎁 報酬あり</p>
                        </div>
                        {isCompleted && <Badge className="bg-green-900/40 text-green-400 border-0 text-xs shrink-0">達成！</Badge>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 p-3 rounded-xl" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
                  <p className="text-xs text-purple-400 font-medium">🔄 ステージ5達成後も、招待を続けると報酬がもらえます！</p>
                </div>
              </CardContent>
            </Card>

            {/* ═══ Ranking (ランキング) ═══ */}
            <Card className="border-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,200,0,0.15)" }}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-yellow-400"><Trophy className="h-5 w-5" /> 招待ランキング TOP20</CardTitle></CardHeader>
              <CardContent>
                {!leaderboard || leaderboard.length === 0 ? (
                  <div className="text-center py-8"><span className="text-4xl">🏆</span><p className="text-gray-400 mt-2">まだランキングデータがありません</p><p className="text-sm text-gray-600">最初のランカーになろう！</p></div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => {
                      const entryTitle = TITLE_CONFIG[entry.titleLevel || "none"] || TITLE_CONFIG.none;
                      const maskedName = entry.displayName
                        ? Array.from(entry.displayName)[0] + "***"
                        : "***";
                      return (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-xl transition-all"
                          style={{ background: index === 0 ? "rgba(251,191,36,0.1)" : index === 1 ? "rgba(192,192,192,0.08)" : index === 2 ? "rgba(205,127,50,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${index < 3 ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)"}` }}>
                          <div className="w-8 h-8 flex items-center justify-center shrink-0">
                            {index === 0 ? <span className="text-xl">🥇</span> : index === 1 ? <span className="text-xl">🥈</span> : index === 2 ? <span className="text-xl">🥉</span> : <span className="text-sm font-bold text-gray-500">{index + 1}</span>}
                          </div>
                          {entry.pictureUrl ? (
                            <div className="h-9 w-9 rounded-full overflow-hidden shrink-0">
                              <img src={entry.pictureUrl} alt="" className="h-full w-full object-cover" style={{ filter: "blur(6px)", transform: "scale(1.2)" }} />
                            </div>
                          ) : (
                            <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}><Users className="h-4 w-4 text-gray-500" /></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-white truncate">{maskedName}</p>
                            <Badge className={`${entryTitle.bg} ${entryTitle.color} border-0 text-[10px] px-1.5`}>{entryTitle.emoji} {entryTitle.label}</Badge>
                          </div>
                          <div className="text-right shrink-0"><p className="font-black text-yellow-400 text-sm">{entry.totalReferrals}人</p><p className="text-xs text-gray-500">{entry.totalPointsEarned}pt</p></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══ History (履歴) ═══ */}
            <Card className="border-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,200,0,0.15)" }}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-yellow-400"><Users className="h-5 w-5" /> 招待した友達</CardTitle></CardHeader>
              <CardContent>
                {referralHistory.length === 0 ? (
                  <div className="text-center py-6"><span className="text-3xl">👥</span><p className="text-gray-400 mt-2 text-sm">まだ招待した友達がいません</p><p className="text-xs text-gray-600">招待コードを共有して友達を招待しよう！</p></div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {displayedReferrals.map((ref) => (
                        <div key={ref.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          {ref.inviteePictureUrl ? <img src={ref.inviteePictureUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}><Users className="h-4 w-4 text-gray-500" /></div>}
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{ref.inviteeDisplayName}</p><p className="text-xs text-gray-500">{new Date(ref.createdAt).toLocaleDateString("ja-JP")}</p></div>
                          <Badge className="bg-green-900/40 text-green-400 border-0 text-xs">+{ref.referrerPointsAwarded}pt</Badge>
                        </div>
                      ))}
                    </div>
                    {referralHistory.length > 5 && (
                      <button onClick={() => setShowAllHistory(!showAllHistory)} className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition">
                        {showAllHistory ? <><ChevronUp className="h-3 w-3" /> 閉じる</> : <><ChevronDown className="h-3 w-3" /> すべて表示（{referralHistory.length}件）</>}
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168,85,247,0.15)" }}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-purple-400"><span className="text-lg">🎰</span> ルーレット履歴</CardTitle></CardHeader>
              <CardContent>
                {spinHistory.length === 0 ? (
                  <div className="text-center py-6"><span className="text-3xl">🎰</span><p className="text-gray-400 mt-2 text-sm">まだルーレットを回していません</p></div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {displayedSpins.map((spin) => (
                        <div key={spin.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <span className="text-xl">{spin.isSpecialSpin ? "👑" : "🎰"}</span>
                          <div className="flex-1"><p className="text-sm font-medium text-white">{spin.isSpecialSpin ? "プレミアム" : "通常"}ルーレット</p><p className="text-xs text-gray-500">{new Date(spin.createdAt).toLocaleDateString("ja-JP")}</p></div>
                          <Badge className="bg-purple-900/40 text-purple-400 border-0 text-xs font-bold">+{spin.pointsWon}pt</Badge>
                        </div>
                      ))}
                    </div>
                    {spinHistory.length > 5 && (
                      <button onClick={() => setShowAllSpinHistory(!showAllSpinHistory)} className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition">
                        {showAllSpinHistory ? <><ChevronUp className="h-3 w-3" /> 閉じる</> : <><ChevronDown className="h-3 w-3" /> すべて表示（{spinHistory.length}件）</>}
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ How it works (遊び方) ═══ */}
        <Card className="border-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,200,0,0.1)" }}>
          <CardHeader className="pb-2"><CardTitle className="text-base text-yellow-400">🎰 遊び方</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { step: "1", emoji: "📤", title: "招待コードを共有", desc: "あなたの招待コードを友達にシェアしよう" },
                { step: "2", emoji: "👥", title: "友達が登録", desc: "友達がコードを使って新規登録すると完了" },
                { step: "3", emoji: "🎁", title: "ステージ達成でポイントGET", desc: "招待人数に応じて確定ポイントを獲得" },
                { step: "4", emoji: "🎰", title: "ルーレットでボーナス", desc: "ステージ達成ごとにルーレットが回せる" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}>{item.step}</div>
                  <div><p className="font-bold text-sm text-white">{item.emoji} {item.title}</p><p className="text-xs text-gray-500">{item.desc}</p></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ═══ Rules (注意事項) ═══ */}
        <div className="mb-8 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <h4 className="text-xs font-semibold text-gray-500 mb-2">📋 注意事項</h4>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li>・1日の招待上限: {campaign?.maxDailyReferrals || 5}人</li>
            <li>・月間ポイント上限: {campaign?.monthlyPointCap?.toLocaleString() || "5,000"}pt</li>
            <li>・招待された方にも{campaign?.inviteeBonus || 50}ptプレゼント</li>
            <li>・不正な招待（自作自演・架空アカウント等）はポイント取消の対象となります</li>
            <li>・キャンペーン内容は予告なく変更される場合があります</li>
            <li>・ルーレットで獲得したポイントはお買い物にご利用いただけます</li>
            <li>・ポイントの有効期限は獲得日から6ヶ月間です</li>
            <li>・友達を招待すると、保有中の全ポイントの有効期限が招待日から6ヶ月に延長されます</li>
          </ul>
        </div>
      </div>

      {/* ═══ Luxury Spin Overlay (Full-screen) ═══ */}
      {showSpinOverlay && spinApiResult && (
        <LuxurySpinOverlay isSpecial={isSpecialSpin} spinItems={spinApiResult.items} targetIndex={spinApiResult.targetIndex} pointsWon={spinApiResult.pointsWon} onClose={handleSpinOverlayClose} />
      )}

      {/* Welcome Step 1 */}
      <Dialog open={welcomeStep === 1} onOpenChange={(open) => { if (!open) setWelcomeStep(0); }}>
        <DialogContent className="max-w-sm mx-auto border-0 p-0 overflow-hidden" style={{ background: "transparent", boxShadow: "none" }}>
          <DialogHeader className="sr-only"><DialogTitle>ウェルカムボーナス</DialogTitle><DialogDescription>招待特典ポイントが付与されました</DialogDescription></DialogHeader>
          <div className="relative rounded-2xl overflow-hidden" style={{ border: "3px solid #fbbf24", boxShadow: "0 0 40px rgba(255,180,0,0.3)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #b91c1c 0%, #991b1b 100%)" }} />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {['🎉', '🎊', '✨', '🌟', '🎁', '💫'].map((e, i) => (<div key={i} className="absolute animate-bounce" style={{ left: `${10 + i * 15}%`, top: `${5 + (i % 3) * 20}%`, fontSize: `${16 + (i % 3) * 6}px`, animationDelay: `${i * 0.2}s`, opacity: 0.6 }}>{e}</div>))}
            </div>
            <div className="relative text-center py-8 px-6 space-y-4">
              <div className="text-6xl animate-bounce">🎉</div>
              <h3 className="text-2xl font-black text-white">おめでとうございます！</h3>
              <p className="text-yellow-200 text-sm">招待特典ポイントが付与されました</p>
              <div className="inline-block rounded-xl py-3 px-8" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", boxShadow: "0 4px 20px rgba(245,158,11,0.5)" }}>
                <span className="text-4xl font-black text-white">{welcomePoints}</span><span className="text-xl ml-1 text-yellow-100 font-bold">pt GET！</span>
              </div>
              <p className="text-yellow-300/80 text-xs">ポイントはお買い物にご利用いただけます ✨</p>
              <Button onClick={() => { haptic.tap(); setWelcomeStep(2); }} className="w-full text-white font-black text-base py-6 rounded-xl" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", boxShadow: "0 4px 15px rgba(245,158,11,0.4)" }}>やった！ 🎉</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Welcome Step 2 */}
      <Dialog open={welcomeStep === 2} onOpenChange={(open) => { if (!open) setWelcomeStep(0); }}>
        <DialogContent className="max-w-sm mx-auto border-0 p-0 overflow-hidden" style={{ background: "transparent", boxShadow: "none" }}>
          <DialogHeader className="sr-only"><DialogTitle>友達招待のご案内</DialogTitle><DialogDescription>友達を招待してさらにポイントを獲得しましょう</DialogDescription></DialogHeader>
          <div className="relative rounded-2xl overflow-hidden" style={{ border: "3px solid #fbbf24", boxShadow: "0 0 40px rgba(255,180,0,0.3)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #1a0000 0%, #0d0000 100%)" }} />
            <div className="relative text-center py-8 px-6 space-y-5">
              <div className="text-5xl">🎁</div>
              <h3 className="text-xl font-black text-white">さらにポイントをゲット！</h3>
              <p className="text-gray-300 text-sm leading-relaxed">友達を招待してチャレンジをクリアして<br /><span className="text-yellow-400 font-bold">ポイント</span>を獲得しよう！</p>
              <div className="space-y-2 text-left">
                {[{ icon: "📤", text: "招待コードを友達にシェア" }, { icon: "👥", text: "友達が登録するとポイントGET" }, { icon: "🎰", text: "ルーレットでボーナスポイントも！" }].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}><span className="text-xl">{item.icon}</span><span className="text-sm text-gray-200">{item.text}</span></div>
                ))}
              </div>
              <Button onClick={() => { haptic.doubleTap(); setWelcomeStep(0); }} className="w-full text-white font-black text-base py-6 rounded-xl" style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 4px 15px rgba(239,68,68,0.4)" }}>友達を招待する 🚀</Button>
              <button onClick={() => setWelcomeStep(0)} className="text-gray-500 text-xs hover:text-gray-400 transition">あとで見る</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
