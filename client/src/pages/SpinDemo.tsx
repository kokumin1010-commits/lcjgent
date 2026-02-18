import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import haptic from "@/lib/haptic";

/* ═══════════════════════════════════════════════════════════════
   SpinDemo – Temu-style "5,000pt jackpot → step-by-step unlock"
   Pure frontend demo (no backend calls).
   Flow: auto-spin → 5,000pt WIN → invite steps → bonus roulette loop
   ═══════════════════════════════════════════════════════════════ */

const STAGES = [
  { id: 1, required: 1, reward: 500, label: "友達を1人招待", desc: "たった1人で+500pt！", emoji: "👤" },
  { id: 2, required: 3, reward: 500, label: "友達を3人招待", desc: "さらに+500pt解放！", emoji: "👥" },
  { id: 3, required: 7, reward: 1000, label: "友達を7人招待", desc: "+1,000ptの大チャンス！", emoji: "🎯" },
  { id: 4, required: 12, reward: 1000, label: "友達を12人招待", desc: "さらに+1,000pt！", emoji: "🔥" },
  { id: 5, required: 20, reward: 2000, label: "友達を20人招待", desc: "最大+2,000pt達成！", emoji: "👑" },
];

const SPIN_ITEMS = [
  { id: 1, label: "100pt", emoji: "🌙", points: 100, color: "#e8b4f8" },
  { id: 2, label: "500pt", emoji: "🌸", points: 500, color: "#f4a0c0" },
  { id: 3, label: "1,000pt", emoji: "💖", points: 1000, color: "#d8a0e8" },
  { id: 4, label: "2,000pt", emoji: "🎁", points: 2000, color: "#c8b0f0" },
  { id: 5, label: "5,000pt", emoji: "👑", points: 5000, color: "#b8c0f8" },
  { id: 6, label: "3,000pt", emoji: "💎", points: 3000, color: "#a8d0f0" },
  { id: 7, label: "500pt", emoji: "⭐", points: 500, color: "#c0b8e8" },
  { id: 8, label: "1,000pt", emoji: "🎀", points: 1000, color: "#d0a8e0" },
];

const BONUS_SPIN_ITEMS = [
  { id: 1, label: "100pt", emoji: "🌙", points: 100, color: "#e8b4f8" },
  { id: 2, label: "500pt", emoji: "🌸", points: 500, color: "#f4a0c0" },
  { id: 3, label: "1,000pt", emoji: "💖", points: 1000, color: "#d8a0e8" },
  { id: 4, label: "2,000pt", emoji: "🎁", points: 2000, color: "#c8b0f0" },
  { id: 5, label: "5,000pt", emoji: "👑", points: 5000, color: "#b8c0f8" },
  { id: 6, label: "3,000pt", emoji: "💎", points: 3000, color: "#a8d0f0" },
  { id: 7, label: "500pt", emoji: "⭐", points: 500, color: "#c0b8e8" },
  { id: 8, label: "1,000pt", emoji: "🎀", points: 1000, color: "#d0a8e0" },
];

const PARTICLES = ["✨", "🌟", "⭐", "💫", "🪙"];
function FloatingParticles() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {PARTICLES.concat(PARTICLES, PARTICLES).map((p, i) => (
        <div key={i} className="absolute" style={{
          left: `${(i * 11 + 3) % 95}%`,
          top: `${(i * 13 + 5) % 90}%`,
          fontSize: `${10 + (i % 5) * 4}px`,
          animation: `floatP ${6 + (i % 4) * 2}s ease-in-out infinite`,
          animationDelay: `${i * 0.5}s`,
          opacity: 0.2 + (i % 3) * 0.08,
        }}>{p}</div>
      ))}
      <style>{`
        @keyframes floatP {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.15; }
          25% { transform: translateY(-25px) rotate(8deg); opacity: 0.3; }
          50% { transform: translateY(-10px) rotate(-4deg); opacity: 0.2; }
          75% { transform: translateY(-35px) rotate(6deg); opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}

function CountdownTimer() {
  const [time, setTime] = useState({ h: 23, m: 59, s: 59 });
  useEffect(() => {
    const end = Date.now() + 24 * 60 * 60 * 1000;
    const tick = () => {
      const diff = Math.max(0, end - Date.now());
      setTime({
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center gap-1.5 justify-center">
      <span className="text-red-400 text-xs font-bold">🔴 受け取り期限</span>
      {[pad(time.h), pad(time.m), pad(time.s)].map((v, i) => (
        <span key={i} className="font-black text-sm text-white rounded px-1.5 py-0.5" style={{ background: "rgba(220,38,38,0.85)" }}>{v}</span>
      ))}
    </div>
  );
}

type SpinItem = typeof SPIN_ITEMS[0];

function DemoSpinWheel({ items, onComplete, autoSpin, targetIndex }: {
  items: SpinItem[];
  onComplete: (item: SpinItem) => void;
  autoSpin?: boolean;
  targetIndex?: number;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const spinningRef = useRef(false);
  const resultRef = useRef<SpinItem | null>(null);
  const hasAutoSpun = useRef(false);
  const wheelSize = 280;
  const center = wheelSize / 2;
  const outerR = center - 14;
  const n = items.length;
  const sliceAngle = 360 / n;

  const ledCount = 24;
  const [ledPhase, setLedPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLedPhase(p => (p + 1) % ledCount), 180);
    return () => clearInterval(id);
  }, []);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const doSpin = useCallback(() => {
    if (spinningRef.current) return;
    spinningRef.current = true;
    setSpinning(true);
    haptic.spinStart();

    const idx = targetIndex !== undefined ? targetIndex : Math.floor(Math.random() * items.length);
    resultRef.current = items[idx];
    const targetSlice = 360 - (idx * sliceAngle + sliceAngle / 2);
    const extra = 6 + Math.floor(Math.random() * 3);
    setRotation(prev => prev + extra * 360 + targetSlice);

    tickRef.current = setInterval(() => haptic.tick(), 100);
    setTimeout(() => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = setInterval(() => haptic.tick(), 200); }, 2000);
    setTimeout(() => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = setInterval(() => haptic.tick(), 400); }, 3500);
    setTimeout(() => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      const won = resultRef.current;
      if (won && won.points >= 1000) haptic.grandCelebration(); else haptic.result();
    }, 4800);
    setTimeout(() => {
      spinningRef.current = false;
      setSpinning(false);
      if (resultRef.current) onComplete(resultRef.current);
    }, 5200);
  }, [items, sliceAngle, onComplete, targetIndex]);

  useEffect(() => {
    if (autoSpin && !hasAutoSpun.current) {
      hasAutoSpun.current = true;
      const t = setTimeout(doSpin, 1200);
      return () => clearTimeout(t);
    }
  }, [autoSpin, doSpin]);

  const segmentColors = useMemo(() => ["#e8b4f8", "#f4a0c0", "#d8a0e8", "#c8b0f0", "#b8c0f8", "#a8d0f0", "#c0b8e8", "#d0a8e0"], []);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: wheelSize + 24, height: wheelSize + 24 }}>
        {Array.from({ length: ledCount }, (_, i) => {
          const angle = (i / ledCount) * 2 * Math.PI - Math.PI / 2;
          const r = (wheelSize + 24) / 2;
          const x = r + r * Math.cos(angle) * 0.94;
          const y = r + r * Math.sin(angle) * 0.94;
          const isLit = (i + ledPhase) % 3 === 0;
          const colors = ["#ff6b9d", "#c084fc", "#60a5fa", "#34d399", "#fbbf24", "#f87171"];
          return (
            <div key={i} className="absolute rounded-full" style={{
              left: x - 4, top: y - 4, width: 8, height: 8,
              backgroundColor: isLit ? colors[i % colors.length] : "rgba(255,255,255,0.12)",
              boxShadow: isLit ? `0 0 8px ${colors[i % colors.length]}` : "none",
              transition: "all 0.15s",
            }} />
          );
        })}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20" style={{ top: 1 }}>
          <div style={{ width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: "22px solid #ef4444", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }} />
        </div>
        <div className="absolute" style={{ left: 12, top: 12, width: wheelSize, height: wheelSize }}>
          <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(135deg, #c084fc, #a855f7, #7c3aed, #c084fc)", padding: 4 }}>
            <div className="w-full h-full rounded-full overflow-hidden">
              <div style={{ width: "100%", height: "100%", transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 5s cubic-bezier(0.15, 0.6, 0.08, 1)" : "none" }}>
                <svg viewBox={`0 0 ${wheelSize} ${wheelSize}`} width="100%" height="100%">
                  {items.map((item, i) => {
                    const sa = (i * sliceAngle - 90) * (Math.PI / 180);
                    const ea = ((i + 1) * sliceAngle - 90) * (Math.PI / 180);
                    const x1 = center + outerR * Math.cos(sa);
                    const y1 = center + outerR * Math.sin(sa);
                    const x2 = center + outerR * Math.cos(ea);
                    const y2 = center + outerR * Math.sin(ea);
                    const ma = ((i + 0.5) * sliceAngle - 90) * (Math.PI / 180);
                    const tr = outerR * 0.65;
                    const tx = center + tr * Math.cos(ma);
                    const ty = center + tr * Math.sin(ma);
                    const textRot = (i + 0.5) * sliceAngle;
                    const bgColor = item.color || segmentColors[i % segmentColors.length];
                    return (
                      <g key={item.id}>
                        <path d={`M ${center} ${center} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} Z`} fill={bgColor} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                        <g transform={`translate(${tx}, ${ty}) rotate(${textRot})`}>
                          <text textAnchor="middle" dy="-6" fill="white" fontSize="18" fontWeight="bold" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" } as React.CSSProperties}>{item.emoji}</text>
                          <text textAnchor="middle" dy="12" fill="white" fontSize="9" fontWeight="bold" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" } as React.CSSProperties}>{item.label}</text>
                        </g>
                      </g>
                    );
                  })}
                  <circle cx={center} cy={center} r={30} fill="white" stroke="#7c3aed" strokeWidth="3" />
                  <text x={center} y={center - 2} textAnchor="middle" fill="#7c3aed" fontSize="8" fontWeight="bold">SPIN</text>
                  <text x={center} y={center + 8} textAnchor="middle" fill="#7c3aed" fontSize="7" fontWeight="bold">& WIN</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-400 mt-3">{spinning ? "ボーナスルーレット 回転中..." : "タップしてスピン！"}</p>
    </div>
  );
}

function ShareSheet({ onClose, required }: { onClose: () => void; required: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10" style={{ background: "linear-gradient(180deg, #1e1b4b, #0f172a)" }} onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <h3 className="text-xl font-black text-white text-center mb-2">友達を招待しよう！</h3>
        <p className="text-center text-sm text-gray-400 mb-5">あと{required}人で <span className="text-yellow-400 font-bold">+500pt</span> 解放！</p>
        <div className="space-y-3">
          <button className="w-full py-4 rounded-xl font-bold text-white text-base" style={{ background: "linear-gradient(135deg, #06C755, #05a347)" }} onClick={() => haptic.doubleTap()}>📱 LINEで友達に送る</button>
          <button className="w-full py-4 rounded-xl font-bold text-white text-base" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }} onClick={() => haptic.doubleTap()}>📋 招待リンクをコピー</button>
          <button className="w-full py-4 rounded-xl font-bold text-white text-base" style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }} onClick={() => haptic.doubleTap()}>📤 その他の方法で共有</button>
        </div>
        <button onClick={onClose} className="w-full text-center text-gray-500 text-sm mt-4">閉じる</button>
      </div>
    </div>
  );
}

type Phase = "spin" | "win" | "invite" | "bonus-spin" | "bonus-win";

export default function SpinDemo() {
  const [phase, setPhase] = useState<Phase>("spin");
  const [currentStage, setCurrentStage] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [bonusWin, setBonusWin] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [fakeCount, setFakeCount] = useState(2847);

  useEffect(() => {
    const id = setInterval(() => setFakeCount(p => p + Math.floor(Math.random() * 3)), 5000);
    return () => clearInterval(id);
  }, []);

  const handleInitialSpinComplete = useCallback(() => {
    setTimeout(() => { setPhase("win"); haptic.grandCelebration(); }, 400);
  }, []);

  const handleBonusSpinComplete = useCallback((item: SpinItem) => {
    setBonusWin(item.points);
    setTotalEarned(prev => prev + item.points);
    setTimeout(() => { setPhase("bonus-win"); haptic.grandCelebration(); }, 400);
  }, []);

  const acceptWin = () => { haptic.tap(); setPhase("invite"); };

  const simulateInvite = () => {
    haptic.celebration();
    const stage = STAGES[currentStage];
    if (stage) {
      setTotalEarned(prev => prev + stage.reward);
      setCurrentStage(prev => prev + 1);
      setTimeout(() => setPhase("bonus-spin"), 800);
    }
  };

  const acceptBonusWin = () => { haptic.tap(); setPhase("invite"); };

  const stage = STAGES[currentStage];

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: "linear-gradient(180deg, #0d0000 0%, #1a0000 30%, #0d0000 100%)" }}>
      <FloatingParticles />

      {/* PHASE: SPIN */}
      {phase === "spin" && (
        <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-white mb-1">🎰 ボーナスチャンス発動！</h2>
            <p className="text-sm text-gray-400">超レアチャンス！ルーレットが自動で回ります...</p>
          </div>
          <DemoSpinWheel items={SPIN_ITEMS} onComplete={handleInitialSpinComplete} autoSpin targetIndex={4} />
        </div>
      )}

      {/* PHASE: WIN */}
      {phase === "win" && (
        <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4">
          <div className="w-full max-w-sm mx-auto">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{
                width: 600, height: 600,
                background: "conic-gradient(from 0deg, transparent 0deg, rgba(255,215,0,0.06) 10deg, transparent 20deg, transparent 30deg, rgba(255,215,0,0.04) 40deg, transparent 50deg)",
                animation: "spinRays 12s linear infinite",
              }} />
              <style>{`@keyframes spinRays { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }`}</style>
            </div>
            <div className="relative text-center py-8 rounded-2xl" style={{
              background: "linear-gradient(180deg, rgba(30,20,0,0.95), rgba(15,10,0,0.98))",
              border: "3px solid #fbbf24",
              boxShadow: "0 0 60px rgba(255,180,0,0.2), inset 0 0 30px rgba(255,180,0,0.05)",
            }}>
              <div className="text-6xl mb-3">🏆</div>
              <h2 className="text-xl font-black mb-1" style={{ background: "linear-gradient(180deg, #ffd700, #ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SUPER JACKPOT</h2>
              <p className="text-yellow-200 text-sm mb-4">超大当たり！おめでとう！🎊</p>
              <div className="mx-6 rounded-xl py-4 px-6 mb-4" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", boxShadow: "0 4px 30px rgba(245,158,11,0.5)" }}>
                <span className="text-lg text-yellow-100">+</span>
                <span className="text-5xl font-black text-white" style={{ textShadow: "0 3px 10px rgba(0,0,0,0.4)" }}>5,000</span>
                <span className="text-2xl font-black text-yellow-100 ml-1">pt</span>
              </div>
              <CountdownTimer />
              <button onClick={acceptWin} className="mt-5 mx-6 w-[calc(100%-3rem)] py-4 rounded-xl font-black text-lg text-white"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.4)", animation: "pulse 2s ease-in-out infinite" }}>
                🎁 今すぐ受け取る！
              </button>
              <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }`}</style>
            </div>
          </div>
        </div>
      )}

      {/* PHASE: INVITE */}
      {phase === "invite" && (
        <div className="min-h-screen relative z-10 px-4 py-6">
          <div className="max-w-sm mx-auto space-y-4">
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)" }}>
                <span className="text-lg">🏆</span>
                <span className="text-yellow-400 font-bold text-sm">{currentStage === 0 ? "5,000" : bonusWin.toLocaleString()}pt 当選済み</span>
                <span className="text-green-400">✓</span>
              </div>
            </div>
            {totalEarned > 0 && (
              <div className="text-center">
                <span className="text-green-400 text-sm font-bold">これまでの獲得: {totalEarned.toLocaleString()}pt</span>
              </div>
            )}
            <div className="text-center">
              <h2 className="text-xl font-black" style={{ background: "linear-gradient(180deg, #ffd700, #ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {currentStage === 0 ? "まずは最初の特典を受け取ろう！" : "次の特典を受け取ろう！"}
              </h2>
              <p className="text-gray-400 text-sm mt-1">友達を招待してポイントを解放しよう</p>
            </div>
            {stage && (
              <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,200,0,0.2)" }}>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center text-2xl shrink-0" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>{stage.emoji}</div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-base">{stage.label}</h3>
                    <p className="text-gray-400 text-xs">{stage.desc}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-yellow-400">+{stage.reward.toLocaleString()}</span>
                    <span className="text-yellow-400 text-sm">pt</span>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full" style={{ width: "0%", background: "linear-gradient(90deg, #ef4444, #f97316, #fbbf24)" }} />
                </div>
                <p className="text-right text-xs text-gray-500 mt-1">0/{stage.required}人</p>
              </div>
            )}
            {currentStage > 0 && (
              <div className="space-y-2">
                {STAGES.slice(0, currentStage).map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl opacity-60" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <span className="text-lg">✅</span>
                    <span className="text-sm text-gray-300 flex-1">{s.label}</span>
                    <span className="text-green-400 text-sm font-bold">+{s.reward.toLocaleString()}pt</span>
                  </div>
                ))}
              </div>
            )}
            {currentStage < STAGES.length - 1 && (
              <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center justify-center gap-3 opacity-50">
                  <span className="text-2xl">🎁</span><span className="text-2xl">🎁</span><span className="text-2xl">🎁</span>
                </div>
                <p className="text-center text-gray-500 text-sm mt-2">この先にもっと大きな特典が...</p>
                <p className="text-center text-gray-600 text-xs">ステップをクリアして解放しよう</p>
              </div>
            )}
            {!stage && (
              <div className="rounded-xl p-6 text-center" style={{ background: "rgba(251,191,36,0.1)", border: "2px solid rgba(251,191,36,0.3)" }}>
                <span className="text-5xl">🎉</span>
                <h3 className="text-xl font-black text-yellow-400 mt-3">全ステージ達成！</h3>
                <p className="text-gray-400 text-sm mt-2">合計 {totalEarned.toLocaleString()}pt 獲得！</p>
              </div>
            )}
            {stage && (
              <button onClick={() => { haptic.tap(); setShowShare(true); }} className="w-full py-4 rounded-xl font-black text-lg text-white"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.4)" }}>
                🎉 友達を招待して受け取る！
              </button>
            )}
            <div className="flex justify-center"><CountdownTimer /></div>
            <div className="text-center"><span className="text-xs text-gray-500">🔥 {fakeCount.toLocaleString()}人が参加中</span></div>
            <div className="mt-2">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700" style={{
                  width: `${Math.min(100, (totalEarned / 5000) * 100)}%`,
                  background: "linear-gradient(90deg, #22c55e, #16a34a)",
                }} />
              </div>
              <p className="text-right text-xs text-gray-500 mt-1">{totalEarned.toLocaleString()}/5,000pt</p>
            </div>
            {stage && (
              <div className="pt-4">
                <p className="text-center text-gray-600 text-xs mb-2">🎮 デモ操作</p>
                <button onClick={simulateInvite} className="w-full py-3 rounded-xl font-bold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  🎮 友達{stage.required}人招待完了をシミュレート
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHASE: BONUS SPIN */}
      {phase === "bonus-spin" && (
        <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-white mb-1">🎰 ボーナスチャンス発動！</h2>
            <p className="text-sm text-gray-400">さらに大きな報酬のチャンス！</p>
          </div>
          <DemoSpinWheel items={BONUS_SPIN_ITEMS} onComplete={handleBonusSpinComplete} autoSpin targetIndex={5} />
        </div>
      )}

      {/* PHASE: BONUS WIN */}
      {phase === "bonus-win" && (
        <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4">
          <div className="w-full max-w-sm mx-auto">
            <div className="relative text-center py-8 rounded-2xl" style={{
              background: "linear-gradient(180deg, rgba(30,20,0,0.95), rgba(15,10,0,0.98))",
              border: "3px solid #fbbf24",
              boxShadow: "0 0 60px rgba(255,180,0,0.2), inset 0 0 30px rgba(255,180,0,0.05)",
            }}>
              <div className="text-6xl mb-3">🏆</div>
              <h2 className="text-xl font-black mb-1" style={{ background: "linear-gradient(180deg, #ffd700, #ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>BONUS JACKPOT</h2>
              <p className="text-yellow-200 text-sm mb-4">さらに大当たり！🎊</p>
              <div className="mx-6 rounded-xl py-4 px-6 mb-3" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", boxShadow: "0 4px 30px rgba(245,158,11,0.5)" }}>
                <span className="text-lg text-yellow-100">+</span>
                <span className="text-5xl font-black text-white" style={{ textShadow: "0 3px 10px rgba(0,0,0,0.4)" }}>{bonusWin.toLocaleString()}</span>
                <span className="text-2xl font-black text-yellow-100 ml-1">pt</span>
              </div>
              <p className="text-sm text-gray-400 mb-1"><span className="text-red-400">🎯</span> 累計獲得可能: <span className="text-yellow-400 font-bold">{totalEarned.toLocaleString()}pt</span></p>
              <p className="text-xs text-gray-500 mb-4">さらに{bonusWin.toLocaleString()}ポイントが当選！</p>
              <CountdownTimer />
              <button onClick={acceptBonusWin} className="mt-5 mx-6 w-[calc(100%-3rem)] py-4 rounded-xl font-black text-lg text-white"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.4)", animation: "pulse 2s ease-in-out infinite" }}>
                🎁 今すぐ受け取る！
              </button>
            </div>
          </div>
        </div>
      )}

      {showShare && <ShareSheet onClose={() => setShowShare(false)} required={stage?.required || 1} />}
    </div>
  );
}
