import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import haptic from "@/lib/haptic";

/* ═══════════════════════════════════════════════════════════════
   SpinDemo – Temu-style "5,000pt jackpot → step-by-step unlock"
   ワクワク演出MAX版
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

/* ─── Confetti (紙吹雪) ─── */
function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6bcb", "#ffa94d", "#c084fc", "#22d3ee"];
    return {
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2.5 + Math.random() * 2,
      size: 6 + Math.random() * 8,
      color: colors[i % colors.length],
      rotation: Math.random() * 360,
      swayAmp: 30 + Math.random() * 60,
    };
  }), [count]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div key={p.id} className="absolute" style={{
          left: `${p.left}%`, top: "-5%",
          width: p.size, height: p.size * 0.6,
          backgroundColor: p.color,
          borderRadius: "2px",
          transform: `rotate(${p.rotation}deg)`,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
          opacity: 0,
        }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg) translateX(0); }
          25% { opacity: 1; transform: translateY(25vh) rotate(180deg) translateX(30px); }
          50% { opacity: 0.9; transform: translateY(50vh) rotate(360deg) translateX(-20px); }
          75% { opacity: 0.7; transform: translateY(75vh) rotate(540deg) translateX(25px); }
          100% { opacity: 0; transform: translateY(105vh) rotate(720deg) translateX(-15px); }
        }
      `}</style>
    </div>
  );
}

/* ─── Fireworks (花火) ─── */
function Fireworks() {
  const bursts = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    id: i,
    x: 15 + Math.random() * 70,
    y: 10 + Math.random() * 40,
    delay: i * 0.6 + Math.random() * 0.3,
    colors: [
      ["#ff6b6b", "#ffd93d", "#ff6bcb"],
      ["#4d96ff", "#22d3ee", "#6bcb77"],
      ["#c084fc", "#ffa94d", "#ff6b6b"],
      ["#ffd93d", "#22d3ee", "#c084fc"],
      ["#6bcb77", "#4d96ff", "#ffa94d"],
    ][i],
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {bursts.map(b => (
        <div key={b.id} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          {Array.from({ length: 12 }, (_, j) => {
            const angle = (j / 12) * 360;
            const dist = 40 + Math.random() * 30;
            return (
              <div key={j} className="absolute rounded-full" style={{
                width: 4, height: 4,
                backgroundColor: b.colors[j % b.colors.length],
                animation: `fireworkBurst 1.2s ease-out ${b.delay}s forwards`,
                opacity: 0,
                ["--fw-x" as string]: `${Math.cos(angle * Math.PI / 180) * dist}px`,
                ["--fw-y" as string]: `${Math.sin(angle * Math.PI / 180) * dist}px`,
              }} />
            );
          })}
        </div>
      ))}
      <style>{`
        @keyframes fireworkBurst {
          0% { opacity: 0; transform: translate(0, 0) scale(0); }
          15% { opacity: 1; transform: translate(0, 0) scale(1.5); }
          100% { opacity: 0; transform: translate(var(--fw-x), var(--fw-y)) scale(0.3); }
        }
      `}</style>
    </div>
  );
}

/* ─── God Rays (光線) ─── */
function GodRays() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{
        width: 700, height: 700,
        background: "conic-gradient(from 0deg, transparent 0deg, rgba(255,215,0,0.08) 8deg, transparent 16deg, transparent 24deg, rgba(255,215,0,0.06) 32deg, transparent 40deg, transparent 48deg, rgba(255,180,0,0.05) 56deg, transparent 64deg)",
        animation: "spinRays 10s linear infinite",
      }} />
      <style>{`@keyframes spinRays { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Sparkle Ring (キラキラリング) ─── */
function SparkleRing() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * 360;
        const r = 120 + Math.random() * 40;
        const x = 50 + Math.cos(angle * Math.PI / 180) * (r / 3);
        const y = 50 + Math.sin(angle * Math.PI / 180) * (r / 3);
        return (
          <div key={i} className="absolute" style={{
            left: `${x}%`, top: `${y}%`,
            fontSize: 8 + Math.random() * 8,
            animation: `sparkleFlash ${1 + Math.random()}s ease-in-out ${i * 0.15}s infinite`,
            opacity: 0,
          }}>✨</div>
        );
      })}
      <style>{`
        @keyframes sparkleFlash {
          0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
        }
      `}</style>
    </div>
  );
}

/* ─── Floating Particles (背景パーティクル) ─── */
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

/* ─── Countdown Timer ─── */
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
      <span className="text-red-400 text-xs font-bold animate-pulse">🔴 受け取り期限</span>
      {[pad(time.h), pad(time.m), pad(time.s)].map((v, i) => (
        <span key={i} className="font-black text-sm text-white rounded px-1.5 py-0.5" style={{ background: "rgba(220,38,38,0.85)" }}>{v}</span>
      ))}
    </div>
  );
}

/* ─── Count Up Animation Hook ─── */
function useCountUp(target: number, duration = 2000, startDelay = 0) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(delayTimer);
  }, [startDelay]);
  useEffect(() => {
    if (!started) return;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo for dramatic effect
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);
  return value;
}

/* ─── Staggered Reveal Component ─── */
function StaggerReveal({ children, delay = 0, duration = 600, className = "" }: {
  children: React.ReactNode; delay?: number; duration?: number; className?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.8)",
      transition: `all ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
    }}>{children}</div>
  );
}

/* ─── Screen Flash ─── */
function ScreenFlash({ color = "rgba(255,215,0,0.3)" }: { color?: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShow(false), 600); return () => clearTimeout(t); }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 pointer-events-none" style={{
      background: color,
      animation: "flashOut 0.6s ease-out forwards",
    }}>
      <style>{`@keyframes flashOut { 0% { opacity: 1; } 100% { opacity: 0; } }`}</style>
    </div>
  );
}

/* ─── Pulsing Glow Border ─── */
function GlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-1 rounded-2xl opacity-75" style={{
        background: "linear-gradient(45deg, #fbbf24, #ef4444, #c084fc, #22d3ee, #fbbf24)",
        backgroundSize: "300% 300%",
        animation: "glowBorder 3s ease infinite",
        filter: "blur(8px)",
      }} />
      <div className="relative rounded-2xl" style={{
        background: "linear-gradient(180deg, rgba(30,20,0,0.97), rgba(15,10,0,0.99))",
      }}>{children}</div>
      <style>{`
        @keyframes glowBorder {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}

/* ─── Bounce Button ─── */
function BounceButton({ children, onClick, className = "", style = {} }: {
  children: React.ReactNode; onClick: () => void; className?: string; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} className={`relative overflow-hidden ${className}`} style={{
      ...style,
      animation: "bounceBtn 2s ease-in-out infinite",
    }}>
      <div className="absolute inset-0" style={{
        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
        animation: "shimmerBtn 2.5s ease-in-out infinite",
      }} />
      <span className="relative z-10">{children}</span>
      <style>{`
        @keyframes bounceBtn {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.06); }
          30% { transform: scale(0.98); }
          45% { transform: scale(1.03); }
          60% { transform: scale(1); }
        }
        @keyframes shimmerBtn {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(100%); }
        }
      `}</style>
    </button>
  );
}

/* ─── Spin Wheel ─── */
type SpinItem = typeof SPIN_ITEMS[0];

function DemoSpinWheel({ items, onComplete, autoSpin, targetIndex }: {
  items: SpinItem[]; onComplete: (item: SpinItem) => void; autoSpin?: boolean; targetIndex?: number;
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

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: wheelSize + 24, height: wheelSize + 24 }}>
        {/* LED lights */}
        {Array.from({ length: ledCount }, (_, i) => {
          const angle = (i / ledCount) * 2 * Math.PI - Math.PI / 2;
          const r = (wheelSize + 24) / 2;
          const x = r + r * Math.cos(angle) * 0.94;
          const y = r + r * Math.sin(angle) * 0.94;
          const isLit = (i + ledPhase) % 3 === 0;
          const colors = ["#ff6b9d", "#c084fc", "#60a5fa", "#34d399", "#fbbf24", "#f87171"];
          return (
            <div key={i} className="absolute rounded-full" style={{
              left: x - 5, top: y - 5, width: 10, height: 10,
              backgroundColor: isLit ? colors[i % colors.length] : "rgba(255,255,255,0.12)",
              boxShadow: isLit ? `0 0 12px 3px ${colors[i % colors.length]}` : "none",
              transition: "all 0.15s",
            }} />
          );
        })}
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20" style={{ top: 1 }}>
          <div style={{ width: 0, height: 0, borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderTop: "26px solid #ef4444", filter: "drop-shadow(0 3px 6px rgba(239,68,68,0.6))" }} />
        </div>
        {/* Wheel */}
        <div className="absolute" style={{ left: 12, top: 12, width: wheelSize, height: wheelSize }}>
          <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(135deg, #c084fc, #a855f7, #7c3aed, #c084fc)", padding: 4, boxShadow: spinning ? "0 0 40px rgba(168,85,247,0.5)" : "0 0 20px rgba(168,85,247,0.3)", transition: "box-shadow 0.5s" }}>
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
                    return (
                      <g key={item.id}>
                        <path d={`M ${center} ${center} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} Z`} fill={item.color} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
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
      <p className="text-sm text-gray-400 mt-3 animate-pulse">{spinning ? "🎰 ルーレット回転中..." : "タップしてスピン！"}</p>
    </div>
  );
}

/* ─── Share Sheet ─── */
function ShareSheet({ onClose, required }: { onClose: () => void; required: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" style={{ animation: "fadeIn 0.3s ease" }} />
      <div className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10" style={{
        background: "linear-gradient(180deg, #1e1b4b, #0f172a)",
        animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }} onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <h3 className="text-xl font-black text-white text-center mb-2">友達を招待しよう！</h3>
        <p className="text-center text-sm text-gray-400 mb-5">あと{required}人で <span className="text-yellow-400 font-bold">ポイント解放</span>！</p>
        <div className="space-y-3">
          <button className="w-full py-4 rounded-xl font-bold text-white text-base active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #06C755, #05a347)" }} onClick={() => haptic.doubleTap()}>📱 LINEで友達に送る</button>
          <button className="w-full py-4 rounded-xl font-bold text-white text-base active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }} onClick={() => haptic.doubleTap()}>📋 招待リンクをコピー</button>
          <button className="w-full py-4 rounded-xl font-bold text-white text-base active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }} onClick={() => haptic.doubleTap()}>📤 その他の方法で共有</button>
        </div>
        <button onClick={onClose} className="w-full text-center text-gray-500 text-sm mt-4">閉じる</button>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

/* ─── Celebration Intro (招待完了おめでとう画面) ─── */
function CelebrationIntro({ stageLabel, onContinue }: { stageLabel: string; onContinue: () => void }) {
  useEffect(() => {
    haptic.celebration();
    const t = setTimeout(onContinue, 2800);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4">
      <ScreenFlash color="rgba(34,197,94,0.4)" />
      <Confetti count={40} />
      <StaggerReveal delay={0} duration={800}>
        <div className="text-7xl mb-4" style={{ animation: "celebBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🎉</div>
      </StaggerReveal>
      <StaggerReveal delay={300} duration={600}>
        <h2 className="text-2xl font-black text-white text-center mb-2">{stageLabel}完了！</h2>
      </StaggerReveal>
      <StaggerReveal delay={600} duration={600}>
        <p className="text-lg font-bold text-center" style={{ background: "linear-gradient(90deg, #fbbf24, #f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          おめでとう！🎊 お祝いルーレット発動！
        </p>
      </StaggerReveal>
      <StaggerReveal delay={1000} duration={600}>
        <div className="mt-4 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400" style={{ animation: "dotPulse 0.6s ease-in-out infinite" }} />
          <div className="w-3 h-3 rounded-full bg-yellow-400" style={{ animation: "dotPulse 0.6s ease-in-out 0.2s infinite" }} />
          <div className="w-3 h-3 rounded-full bg-yellow-400" style={{ animation: "dotPulse 0.6s ease-in-out 0.4s infinite" }} />
        </div>
      </StaggerReveal>
      <style>{`
        @keyframes celebBounce { 0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
        @keyframes dotPulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

type Phase = "spin" | "win" | "invite" | "celebrate" | "bonus-spin" | "bonus-win";

export default function SpinDemo() {
  const [phase, setPhase] = useState<Phase>("spin");
  const [currentStage, setCurrentStage] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [bonusWin, setBonusWin] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [fakeCount, setFakeCount] = useState(2847);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setFakeCount(p => p + Math.floor(Math.random() * 3)), 5000);
    return () => clearInterval(id);
  }, []);

  const triggerWinEffects = useCallback(() => {
    setShowFlash(true);
    setShowConfetti(true);
    setShowFireworks(true);
    haptic.grandCelebration();
    setTimeout(() => setShowFlash(false), 700);
    setTimeout(() => { setShowConfetti(false); setShowFireworks(false); }, 5000);
  }, []);

  const handleInitialSpinComplete = useCallback(() => {
    setTimeout(() => { setPhase("win"); triggerWinEffects(); }, 400);
  }, [triggerWinEffects]);

  const handleBonusSpinComplete = useCallback((item: SpinItem) => {
    setBonusWin(item.points);
    setTotalEarned(prev => prev + item.points);
    setTimeout(() => { setPhase("bonus-win"); triggerWinEffects(); }, 400);
  }, [triggerWinEffects]);

  const acceptWin = () => { haptic.tap(); setPhase("invite"); };

  const simulateInvite = () => {
    haptic.celebration();
    const stage = STAGES[currentStage];
    if (stage) {
      setTotalEarned(prev => prev + stage.reward);
      setCurrentStage(prev => prev + 1);
      // Show celebration intro before bonus spin
      setPhase("celebrate");
    }
  };

  const handleCelebrationDone = useCallback(() => {
    setPhase("bonus-spin");
  }, []);

  const acceptBonusWin = () => { haptic.tap(); setPhase("invite"); };

  const stage = STAGES[currentStage];
  const nextStage = STAGES[currentStage]; // for bonus-win display

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: "linear-gradient(180deg, #0d0000 0%, #1a0000 30%, #0d0000 100%)" }}>
      <FloatingParticles />
      {showFlash && <ScreenFlash />}
      {showConfetti && <Confetti />}
      {showFireworks && <Fireworks />}

      {/* ═══ PHASE: SPIN ═══ */}
      {phase === "spin" && (
        <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4">
          <StaggerReveal delay={0} duration={800}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2" style={{ animation: "celebBounce 1s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🎰</div>
              <h2 className="text-2xl font-black text-white mb-1">ボーナスチャンス発動！</h2>
              <p className="text-sm text-gray-400">超レアチャンス！ルーレットが自動で回ります...</p>
            </div>
          </StaggerReveal>
          <StaggerReveal delay={400} duration={600}>
            <DemoSpinWheel items={SPIN_ITEMS} onComplete={handleInitialSpinComplete} autoSpin targetIndex={4} />
          </StaggerReveal>
          <style>{`@keyframes celebBounce { 0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }`}</style>
        </div>
      )}

      {/* ═══ PHASE: WIN (5,000pt) ═══ */}
      {phase === "win" && <WinScreen points={5000} title="SUPER JACKPOT" subtitle="超大当たり！おめでとう！🎊" onAccept={acceptWin} />}

      {/* ═══ PHASE: INVITE ═══ */}
      {phase === "invite" && (
        <div className="min-h-screen relative z-10 px-4 py-6" style={{ animation: "fadeSlideIn 0.5s ease" }}>
          <div className="max-w-sm mx-auto space-y-4">
            {/* Won badge */}
            <StaggerReveal delay={0} duration={500}>
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)" }}>
                  <span className="text-lg">🏆</span>
                  <span className="text-yellow-400 font-bold text-sm">{currentStage === 0 ? "5,000" : bonusWin.toLocaleString()}pt 当選済み</span>
                  <span className="text-green-400">✓</span>
                </div>
              </div>
            </StaggerReveal>

            {totalEarned > 0 && (
              <StaggerReveal delay={100} duration={500}>
                <div className="text-center">
                  <span className="text-green-400 text-sm font-bold">これまでの獲得: {totalEarned.toLocaleString()}pt</span>
                </div>
              </StaggerReveal>
            )}

            <StaggerReveal delay={200} duration={500}>
              <div className="text-center">
                <h2 className="text-xl font-black" style={{ background: "linear-gradient(180deg, #ffd700, #ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {currentStage === 0 ? "まずは最初の特典を受け取ろう！" : "次の特典を受け取ろう！"}
                </h2>
                <p className="text-gray-400 text-sm mt-1">友達を招待してポイントを解放しよう</p>
              </div>
            </StaggerReveal>

            {/* Current stage card */}
            {stage && (
              <StaggerReveal delay={400} duration={600}>
                <div className="rounded-xl p-4" style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,200,0,0.2)",
                  animation: "glowPulse 3s ease-in-out infinite",
                }}>
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
              </StaggerReveal>
            )}

            {/* Completed stages */}
            {currentStage > 0 && (
              <StaggerReveal delay={500} duration={500}>
                <div className="space-y-2">
                  {STAGES.slice(0, currentStage).map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl opacity-60" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                      <span className="text-lg">✅</span>
                      <span className="text-sm text-gray-300 flex-1">{s.label}</span>
                      <span className="text-green-400 text-sm font-bold">+{s.reward.toLocaleString()}pt</span>
                    </div>
                  ))}
                </div>
              </StaggerReveal>
            )}

            {/* Mystery box */}
            {currentStage < STAGES.length - 1 && (
              <StaggerReveal delay={600} duration={500}>
                <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-center gap-3 opacity-50">
                    <span className="text-2xl" style={{ animation: "mysteryWiggle 2s ease-in-out infinite" }}>🎁</span>
                    <span className="text-2xl" style={{ animation: "mysteryWiggle 2s ease-in-out 0.3s infinite" }}>🎁</span>
                    <span className="text-2xl" style={{ animation: "mysteryWiggle 2s ease-in-out 0.6s infinite" }}>🎁</span>
                  </div>
                  <p className="text-center text-gray-500 text-sm mt-2">この先にもっと大きな特典が...</p>
                  <p className="text-center text-gray-600 text-xs">ステップをクリアして解放しよう</p>
                </div>
              </StaggerReveal>
            )}

            {/* All complete */}
            {!stage && (
              <StaggerReveal delay={400} duration={600}>
                <div className="rounded-xl p-6 text-center" style={{ background: "rgba(251,191,36,0.1)", border: "2px solid rgba(251,191,36,0.3)" }}>
                  <span className="text-5xl">🎉</span>
                  <h3 className="text-xl font-black text-yellow-400 mt-3">全ステージ達成！</h3>
                  <p className="text-gray-400 text-sm mt-2">合計 {totalEarned.toLocaleString()}pt 獲得！</p>
                </div>
              </StaggerReveal>
            )}

            {/* CTA button */}
            {stage && (
              <StaggerReveal delay={700} duration={600}>
                <BounceButton onClick={() => { haptic.tap(); setShowShare(true); }}
                  className="w-full py-4 rounded-xl font-black text-lg text-white"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.4)" }}>
                  🎉 友達を招待して受け取る！
                </BounceButton>
              </StaggerReveal>
            )}

            <StaggerReveal delay={800} duration={500}>
              <div className="flex justify-center"><CountdownTimer /></div>
            </StaggerReveal>

            <StaggerReveal delay={900} duration={500}>
              <div className="text-center"><span className="text-xs text-gray-500">🔥 {fakeCount.toLocaleString()}人が参加中</span></div>
            </StaggerReveal>

            {/* Progress bar */}
            <StaggerReveal delay={1000} duration={500}>
              <div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{
                    width: `${Math.min(100, (totalEarned / 5000) * 100)}%`,
                    background: "linear-gradient(90deg, #22c55e, #16a34a)",
                  }} />
                </div>
                <p className="text-right text-xs text-gray-500 mt-1">{totalEarned.toLocaleString()}/5,000pt</p>
              </div>
            </StaggerReveal>

            {/* Demo controls */}
            {stage && (
              <StaggerReveal delay={1100} duration={500}>
                <div className="pt-4">
                  <p className="text-center text-gray-600 text-xs mb-2">🎮 デモ操作</p>
                  <button onClick={simulateInvite} className="w-full py-3 rounded-xl font-bold text-sm text-white active:scale-95 transition-transform"
                    style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                    🎮 友達{stage.required}人招待完了をシミュレート
                  </button>
                </div>
              </StaggerReveal>
            )}
          </div>
          <style>{`
            @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 10px rgba(251,191,36,0.1); } 50% { box-shadow: 0 0 25px rgba(251,191,36,0.2); } }
            @keyframes mysteryWiggle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-8deg); } 75% { transform: rotate(8deg); } }
          `}</style>
        </div>
      )}

      {/* ═══ PHASE: CELEBRATE (招待完了おめでとう) ═══ */}
      {phase === "celebrate" && (
        <CelebrationIntro
          stageLabel={STAGES[currentStage - 1]?.label || "招待"}
          onContinue={handleCelebrationDone}
        />
      )}

      {/* ═══ PHASE: BONUS SPIN ═══ */}
      {phase === "bonus-spin" && (
        <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4">
          <StaggerReveal delay={0} duration={800}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2" style={{ animation: "celebBounce 1s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🎊</div>
              <h2 className="text-2xl font-black text-white mb-1">お祝いルーレット！</h2>
              <p className="text-sm text-yellow-400 font-bold">招待完了のご褒美！さらにポイントGETのチャンス！</p>
            </div>
          </StaggerReveal>
          <StaggerReveal delay={400} duration={600}>
            <DemoSpinWheel items={SPIN_ITEMS} onComplete={handleBonusSpinComplete} autoSpin targetIndex={5} />
          </StaggerReveal>
          <style>{`@keyframes celebBounce { 0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }`}</style>
        </div>
      )}

      {/* ═══ PHASE: BONUS WIN ═══ */}
      {phase === "bonus-win" && (
        <BonusWinScreen
          points={bonusWin}
          totalEarned={totalEarned}
          nextStage={nextStage}
          onAccept={acceptBonusWin}
        />
      )}

      {showShare && <ShareSheet onClose={() => setShowShare(false)} required={stage?.required || 1} />}
    </div>
  );
}

/* ═══ WIN Screen Component (shared between initial & bonus) ═══ */
function WinScreen({ points, title, subtitle, onAccept }: {
  points: number; title: string; subtitle: string; onAccept: () => void;
}) {
  const countUp = useCountUp(points, 2200, 800);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4" style={{ animation: "winScreenIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
      <GodRays />
      <SparkleRing />
      <div className="w-full max-w-sm mx-auto">
        <GlowCard>
          <div className="relative text-center py-8 px-4 overflow-hidden">
            {/* Trophy */}
            <StaggerReveal delay={0} duration={800}>
              <div className="text-7xl mb-3" style={{ filter: "drop-shadow(0 4px 12px rgba(255,215,0,0.4))" }}>🏆</div>
            </StaggerReveal>

            {/* Title */}
            <StaggerReveal delay={300} duration={600}>
              <h2 className="text-2xl font-black mb-1" style={{ background: "linear-gradient(180deg, #ffd700, #ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "none" }}>{title}</h2>
              <p className="text-yellow-200 text-sm mb-4">{subtitle}</p>
            </StaggerReveal>

            {/* Count-up number */}
            <StaggerReveal delay={600} duration={700}>
              <div className="mx-2 rounded-xl py-5 px-6 mb-4 relative overflow-hidden" style={{
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                boxShadow: "0 4px 30px rgba(245,158,11,0.5)",
              }}>
                <div className="absolute inset-0" style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                  animation: "shimmerBtn 3s ease-in-out infinite",
                }} />
                <div className="relative">
                  <span className="text-lg text-yellow-100">+</span>
                  <span className="text-6xl font-black text-white" style={{ textShadow: "0 3px 10px rgba(0,0,0,0.4)", fontVariantNumeric: "tabular-nums" }}>
                    {countUp.toLocaleString()}
                  </span>
                  <span className="text-2xl font-black text-yellow-100 ml-1">pt</span>
                </div>
              </div>
            </StaggerReveal>

            {/* Timer */}
            <StaggerReveal delay={1200} duration={500}>
              <CountdownTimer />
            </StaggerReveal>

            {/* CTA */}
            <StaggerReveal delay={1600} duration={600}>
              <BounceButton onClick={onAccept}
                className="mt-5 mx-2 w-[calc(100%-1rem)] py-4 rounded-xl font-black text-lg text-white"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.4)" }}>
                🎁 今すぐ受け取る！
              </BounceButton>
            </StaggerReveal>
          </div>
        </GlowCard>
      </div>
      <style>{`
        @keyframes winScreenIn { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}

/* ═══ BONUS WIN Screen ═══ */
function BonusWinScreen({ points, totalEarned, nextStage, onAccept }: {
  points: number; totalEarned: number; nextStage: typeof STAGES[0] | undefined; onAccept: () => void;
}) {
  const countUp = useCountUp(points, 2000, 800);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4" style={{ animation: "winScreenIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
      <GodRays />
      <SparkleRing />
      <div className="w-full max-w-sm mx-auto">
        <GlowCard>
          <div className="relative text-center py-8 px-4 overflow-hidden">
            {/* Trophy */}
            <StaggerReveal delay={0} duration={800}>
              <div className="text-7xl mb-3" style={{ filter: "drop-shadow(0 4px 12px rgba(255,215,0,0.4))" }}>🏆</div>
            </StaggerReveal>

            {/* Title */}
            <StaggerReveal delay={300} duration={600}>
              <h2 className="text-2xl font-black mb-1" style={{ background: "linear-gradient(180deg, #ffd700, #ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>BONUS JACKPOT</h2>
              <p className="text-yellow-200 text-sm mb-4">さらに大当たり！🎊</p>
            </StaggerReveal>

            {/* Count-up number */}
            <StaggerReveal delay={600} duration={700}>
              <div className="mx-2 rounded-xl py-5 px-6 mb-3 relative overflow-hidden" style={{
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                boxShadow: "0 4px 30px rgba(245,158,11,0.5)",
              }}>
                <div className="absolute inset-0" style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                  animation: "shimmerBtn 3s ease-in-out infinite",
                }} />
                <div className="relative">
                  <span className="text-lg text-yellow-100">+</span>
                  <span className="text-6xl font-black text-white" style={{ textShadow: "0 3px 10px rgba(0,0,0,0.4)", fontVariantNumeric: "tabular-nums" }}>
                    {countUp.toLocaleString()}
                  </span>
                  <span className="text-2xl font-black text-yellow-100 ml-1">pt</span>
                </div>
              </div>
            </StaggerReveal>

            {/* Total earned */}
            <StaggerReveal delay={1000} duration={500}>
              <p className="text-sm text-gray-400 mb-1"><span className="text-red-400">🎯</span> 累計獲得可能: <span className="text-yellow-400 font-bold">{totalEarned.toLocaleString()}pt</span></p>
            </StaggerReveal>

            {/* Next stage requirement */}
            {nextStage && (
              <StaggerReveal delay={1200} duration={500}>
                <div className="mx-2 mt-3 mb-3 p-3 rounded-lg" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                  <p className="text-sm text-purple-300 font-bold">
                    💡 この{points.toLocaleString()}ptを受け取るには
                  </p>
                  <p className="text-lg font-black text-white mt-1">
                    あと<span className="text-yellow-400">{nextStage.required}人</span>の友達を招待！
                  </p>
                </div>
              </StaggerReveal>
            )}

            {/* Timer */}
            <StaggerReveal delay={1400} duration={500}>
              <CountdownTimer />
            </StaggerReveal>

            {/* CTA */}
            <StaggerReveal delay={1800} duration={600}>
              <BounceButton onClick={onAccept}
                className="mt-5 mx-2 w-[calc(100%-1rem)] py-4 rounded-xl font-black text-lg text-white"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.4)" }}>
                🎁 今すぐ受け取る！
              </BounceButton>
            </StaggerReveal>
          </div>
        </GlowCard>
      </div>
      <style>{`
        @keyframes winScreenIn { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}
