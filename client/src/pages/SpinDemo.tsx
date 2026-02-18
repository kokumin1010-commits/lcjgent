import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import haptic from "@/lib/haptic";
import sfx from "@/lib/soundEffects";

/* ═══════════════════════════════════════════════════════════════
   SpinDemo – Escalating Jackpot (無限ラウンド・ラグジュアリー版)
   
   ラウンド構造:
   R1: 自動ルーレット → 5,000pt → 1人招待(+500pt確定)
   R2: お祝いルーレット → 3,000pt → 3人招待(+500pt確定)
   R3: 豪華ルーレット → 6,000pt → 5人招待(+800pt確定)
   R4: プラチナルーレット → 10,000pt → 7人招待(+800pt確定)
   R5: ロイヤルルーレット → 15,000pt → 12人招待(+1,000pt確定)
   R6: レジェンドルーレット → 20,000pt → 20人招待(+1,500pt確定)
   R7+: ウルトラレジェンド → +8,000ptずつ → +15人ずつ(+2,000pt確定)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Round Config ─── */
interface RoundConfig {
  jackpot: number;
  inviteRequired: number;
  fixedReward: number;
  tier: string;
  tierEmoji: string;
  tierColor: string;
  tierGlow: string;
  wheelColors: string[];
  bgGradient: string;
}

function getRoundConfig(round: number): RoundConfig {
  const presets: Omit<RoundConfig, "jackpot" | "inviteRequired" | "fixedReward">[] = [
    { tier: "SUPER JACKPOT", tierEmoji: "🎰", tierColor: "#ffd700", tierGlow: "rgba(255,215,0,0.4)", wheelColors: ["#c084fc","#a78bfa","#818cf8","#6366f1","#a855f7","#9333ea","#7c3aed","#8b5cf6"], bgGradient: "linear-gradient(180deg, #0d0000 0%, #1a0a2e 50%, #0d0000 100%)" },
    { tier: "GOLD JACKPOT", tierEmoji: "✨", tierColor: "#ffd700", tierGlow: "rgba(255,215,0,0.5)", wheelColors: ["#fbbf24","#f59e0b","#d97706","#b45309","#fbbf24","#f59e0b","#d97706","#b45309"], bgGradient: "linear-gradient(180deg, #1a0a00 0%, #2d1600 50%, #1a0a00 100%)" },
    { tier: "DIAMOND JACKPOT", tierEmoji: "💎", tierColor: "#60a5fa", tierGlow: "rgba(96,165,250,0.5)", wheelColors: ["#60a5fa","#3b82f6","#93c5fd","#2563eb","#60a5fa","#3b82f6","#93c5fd","#2563eb"], bgGradient: "linear-gradient(180deg, #000a1a 0%, #001a3d 50%, #000a1a 100%)" },
    { tier: "PLATINUM JACKPOT", tierEmoji: "🌟", tierColor: "#e2e8f0", tierGlow: "rgba(226,232,240,0.5)", wheelColors: ["#e2e8f0","#cbd5e1","#94a3b8","#64748b","#e2e8f0","#cbd5e1","#94a3b8","#64748b"], bgGradient: "linear-gradient(180deg, #0a0a0a 0%, #1e1e2e 50%, #0a0a0a 100%)" },
    { tier: "ROYAL JACKPOT", tierEmoji: "👑", tierColor: "#f472b6", tierGlow: "rgba(244,114,182,0.5)", wheelColors: ["#f472b6","#ec4899","#db2777","#be185d","#f472b6","#ec4899","#db2777","#be185d"], bgGradient: "linear-gradient(180deg, #1a000a 0%, #2d0020 50%, #1a000a 100%)" },
    { tier: "LEGEND JACKPOT", tierEmoji: "🔥", tierColor: "#ef4444", tierGlow: "rgba(239,68,68,0.5)", wheelColors: ["#ef4444","#dc2626","#f97316","#ea580c","#ef4444","#dc2626","#f97316","#ea580c"], bgGradient: "linear-gradient(180deg, #1a0000 0%, #3d0000 50%, #1a0000 100%)" },
  ];

  const jackpots = [5000, 3000, 6000, 10000, 15000, 20000];
  const invites = [1, 3, 5, 7, 12, 20];
  const rewards = [500, 500, 800, 800, 1000, 1500];

  if (round < 6) {
    return { ...presets[round], jackpot: jackpots[round], inviteRequired: invites[round], fixedReward: rewards[round] };
  }
  // R7+: Ultra Legend - infinite escalation
  const extra = round - 5;
  return {
    ...presets[5],
    tier: `ULTRA LEGEND ${extra > 1 ? `×${extra}` : ""}`,
    tierEmoji: "⚡",
    jackpot: 20000 + extra * 8000,
    inviteRequired: 20 + extra * 15,
    fixedReward: 2000,
  };
}

/* ─── Spin Items per Round ─── */
function getSpinItems(round: number) {
  const config = getRoundConfig(round);
  const jp = config.jackpot;
  const values = [
    Math.floor(jp * 0.02), Math.floor(jp * 0.1), Math.floor(jp * 0.2),
    Math.floor(jp * 0.4), jp, Math.floor(jp * 0.6),
    Math.floor(jp * 0.1), Math.floor(jp * 0.2),
  ];
  const emojis = ["🌙", "🌸", "💖", "🎁", "👑", "💎", "⭐", "🎀"];
  return values.map((pts, i) => ({
    id: i + 1,
    label: `${pts.toLocaleString()}pt`,
    emoji: emojis[i],
    points: pts,
    color: config.wheelColors[i % config.wheelColors.length],
  }));
}

/* ═══════════════════════════════════════════════════════════════
   EFFECT COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/* ─── Confetti (紙吹雪) ─── */
function Confetti({ count = 80 }: { count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const colors = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff6bcb","#ffa94d","#c084fc","#22d3ee","#f472b6","#a78bfa"];
    return {
      id: i, left: Math.random() * 100, delay: Math.random() * 2.5,
      duration: 2 + Math.random() * 2.5, size: 5 + Math.random() * 10,
      color: colors[i % colors.length], rotation: Math.random() * 360,
      shape: Math.random() > 0.5 ? "circle" : "rect",
    };
  }), [count]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div key={p.id} className="absolute" style={{
          left: `${p.left}%`, top: "-5%",
          width: p.size, height: p.shape === "circle" ? p.size : p.size * 0.5,
          backgroundColor: p.color,
          borderRadius: p.shape === "circle" ? "50%" : "2px",
          transform: `rotate(${p.rotation}deg)`,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
          opacity: 0,
        }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg) translateX(0); }
          20% { opacity: 1; transform: translateY(20vh) rotate(180deg) translateX(40px); }
          40% { opacity: 1; transform: translateY(40vh) rotate(360deg) translateX(-30px); }
          60% { opacity: 0.8; transform: translateY(60vh) rotate(540deg) translateX(35px); }
          80% { opacity: 0.5; transform: translateY(80vh) rotate(720deg) translateX(-25px); }
          100% { opacity: 0; transform: translateY(110vh) rotate(900deg) translateX(15px); }
        }
      `}</style>
    </div>
  );
}

/* ─── Fireworks (花火) ─── */
function Fireworks({ count = 8 }: { count?: number }) {
  const bursts = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    y: 5 + Math.random() * 50,
    delay: i * 0.4 + Math.random() * 0.3,
    particleCount: 16 + Math.floor(Math.random() * 8),
    colors: [
      ["#ff6b6b","#ffd93d","#ff6bcb"],
      ["#4d96ff","#22d3ee","#6bcb77"],
      ["#c084fc","#ffa94d","#ff6b6b"],
      ["#ffd93d","#22d3ee","#c084fc"],
      ["#6bcb77","#4d96ff","#ffa94d"],
      ["#f472b6","#a78bfa","#34d399"],
      ["#fbbf24","#ef4444","#8b5cf6"],
      ["#22d3ee","#f472b6","#fbbf24"],
    ][i % 8],
  })), [count]);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {bursts.map(b => (
        <div key={b.id} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          {Array.from({ length: b.particleCount }, (_, j) => {
            const angle = (j / b.particleCount) * 360;
            const dist = 30 + Math.random() * 50;
            return (
              <div key={j} className="absolute rounded-full" style={{
                width: 3 + Math.random() * 3, height: 3 + Math.random() * 3,
                backgroundColor: b.colors[j % b.colors.length],
                animation: `fwBurst 1.4s ease-out ${b.delay}s forwards`,
                opacity: 0,
                ["--fx" as string]: `${Math.cos(angle * Math.PI / 180) * dist}px`,
                ["--fy" as string]: `${Math.sin(angle * Math.PI / 180) * dist}px`,
              }} />
            );
          })}
        </div>
      ))}
      <style>{`
        @keyframes fwBurst {
          0% { opacity: 0; transform: translate(0,0) scale(0); }
          10% { opacity: 1; transform: translate(0,0) scale(2); }
          100% { opacity: 0; transform: translate(var(--fx),var(--fy)) scale(0.2); }
        }
      `}</style>
    </div>
  );
}

/* ─── God Rays (光線) ─── */
function GodRays({ color = "rgba(255,215,0,0.08)" }: { color?: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{
        width: 800, height: 800,
        background: `conic-gradient(from 0deg, transparent 0deg, ${color} 6deg, transparent 12deg, transparent 20deg, ${color} 26deg, transparent 32deg, transparent 40deg, ${color} 46deg, transparent 52deg, transparent 60deg, ${color} 66deg, transparent 72deg)`,
        animation: "spinRays 8s linear infinite",
      }} />
      <style>{`@keyframes spinRays { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Sparkle Ring ─── */
function SparkleRing({ count = 24 }: { count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360;
        const r = 100 + Math.random() * 60;
        const x = 50 + Math.cos(angle * Math.PI / 180) * (r / 3);
        const y = 50 + Math.sin(angle * Math.PI / 180) * (r / 3);
        return (
          <div key={i} className="absolute" style={{
            left: `${x}%`, top: `${y}%`,
            fontSize: 6 + Math.random() * 10,
            animation: `sparkleFlash ${0.8 + Math.random() * 0.8}s ease-in-out ${i * 0.1}s infinite`,
            opacity: 0,
          }}>✨</div>
        );
      })}
      <style>{`
        @keyframes sparkleFlash {
          0%, 100% { opacity: 0; transform: scale(0.3) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.3) rotate(180deg); }
        }
      `}</style>
    </div>
  );
}

/* ─── Floating Particles ─── */
function FloatingParticles({ tier }: { tier?: string }) {
  const particles = tier?.includes("LEGEND") || tier?.includes("ULTRA")
    ? ["💎","🔥","⚡","👑","🌟","💫","✨","🪙","🏆","💰"]
    : tier?.includes("DIAMOND") || tier?.includes("PLATINUM")
    ? ["💎","🌟","✨","⭐","💫","🪙","🔮","💠"]
    : ["✨","🌟","⭐","💫","🪙"];
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.concat(particles, particles).map((p, i) => (
        <div key={i} className="absolute" style={{
          left: `${(i * 11 + 3) % 95}%`,
          top: `${(i * 13 + 5) % 90}%`,
          fontSize: `${10 + (i % 5) * 4}px`,
          animation: `floatP ${5 + (i % 4) * 2}s ease-in-out infinite`,
          animationDelay: `${i * 0.4}s`,
          opacity: 0.15 + (i % 3) * 0.1,
        }}>{p}</div>
      ))}
      <style>{`
        @keyframes floatP {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.15; }
          25% { transform: translateY(-30px) rotate(10deg) scale(1.1); opacity: 0.35; }
          50% { transform: translateY(-15px) rotate(-5deg) scale(0.95); opacity: 0.25; }
          75% { transform: translateY(-40px) rotate(8deg) scale(1.05); opacity: 0.3; }
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
      setTime({ h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
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

/* ─── Count Up Hook ─── */
function useCountUp(target: number, duration = 2200, startDelay = 0) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const lastSoundRef = useRef(0);
  useEffect(() => { const t = setTimeout(() => setStarted(true), startDelay); return () => clearTimeout(t); }, [startDelay]);
  useEffect(() => {
    if (!started) return;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -12 * progress);
      const newVal = Math.floor(eased * target);
      setValue(newVal);
      // Play count-up tick sound every ~5% progress
      const now = Date.now();
      if (now - lastSoundRef.current > 60) {
        sfx.playCountUp();
        lastSoundRef.current = now;
      }
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        sfx.playCountUpComplete();
      }
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);
  return value;
}

/* ─── Staggered Reveal ─── */
function StaggerReveal({ children, delay = 0, duration = 600, className = "" }: {
  children: React.ReactNode; delay?: number; duration?: number; className?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.8)",
      transition: `all ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
    }}>{children}</div>
  );
}

/* ─── Screen Flash ─── */
function ScreenFlash({ color = "rgba(255,215,0,0.4)" }: { color?: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShow(false), 700); return () => clearTimeout(t); }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 pointer-events-none" style={{
      background: color, animation: "flashOut 0.7s ease-out forwards",
    }}>
      <style>{`@keyframes flashOut { 0% { opacity: 1; } 100% { opacity: 0; } }`}</style>
    </div>
  );
}

/* ─── Glow Card ─── */
function GlowCard({ children, glowColor, className = "" }: { children: React.ReactNode; glowColor?: string; className?: string }) {
  const glow = glowColor || "#fbbf24, #ef4444, #c084fc, #22d3ee, #fbbf24";
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-1.5 rounded-2xl opacity-80" style={{
        background: `linear-gradient(45deg, ${glow})`,
        backgroundSize: "300% 300%",
        animation: "glowBorder 3s ease infinite",
        filter: "blur(10px)",
      }} />
      <div className="relative rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(180deg, rgba(30,20,0,0.97), rgba(10,5,0,0.99))",
      }}>{children}</div>
      <style>{`@keyframes glowBorder { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>
    </div>
  );
}

/* ─── Bounce Button ─── */
function BounceButton({ children, onClick, className = "", style = {} }: {
  children: React.ReactNode; onClick: () => void; className?: string; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} className={`relative overflow-hidden active:scale-95 transition-transform ${className}`} style={{
      ...style, animation: "bounceBtn 2s ease-in-out infinite",
    }}>
      <div className="absolute inset-0" style={{
        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
        animation: "shimmerBtn 2.5s ease-in-out infinite",
      }} />
      <span className="relative z-10">{children}</span>
      <style>{`
        @keyframes bounceBtn { 0%, 100% { transform: scale(1); } 12% { transform: scale(1.07); } 24% { transform: scale(0.97); } 36% { transform: scale(1.04); } 48% { transform: scale(1); } }
        @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
      `}</style>
    </button>
  );
}

/* ─── Luxury Spin Wheel ─── */
type SpinItem = { id: number; label: string; emoji: string; points: number; color: string };

function LuxurySpinWheel({ items, onComplete, autoSpin, targetIndex, tierColor = "#a855f7" }: {
  items: SpinItem[]; onComplete: (item: SpinItem) => void; autoSpin?: boolean; targetIndex?: number; tierColor?: string;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const spinningRef = useRef(false);
  const resultRef = useRef<SpinItem | null>(null);
  const hasAutoSpun = useRef(false);
  const wheelSize = 290;
  const center = wheelSize / 2;
  const outerR = center - 16;
  const n = items.length;
  const sliceAngle = 360 / n;

  const ledCount = 28;
  const [ledPhase, setLedPhase] = useState(0);
  useEffect(() => { const id = setInterval(() => setLedPhase(p => (p + 1) % ledCount), 150); return () => clearInterval(id); }, []);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const doSpin = useCallback(() => {
    if (spinningRef.current) return;
    spinningRef.current = true;
    setSpinning(true);
    haptic.spinStart();
    sfx.playSpinStart();

    const idx = targetIndex !== undefined ? targetIndex : Math.floor(Math.random() * items.length);
    resultRef.current = items[idx];
    const targetSlice = 360 - (idx * sliceAngle + sliceAngle / 2);
    const extra = 7 + Math.floor(Math.random() * 3);
    setRotation(prev => prev + extra * 360 + targetSlice);

    tickRef.current = setInterval(() => { haptic.tick(); sfx.playTick(1); }, 80);
    setTimeout(() => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = setInterval(() => { haptic.tick(); sfx.playTick(0.6); }, 160); }, 2000);
    setTimeout(() => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = setInterval(() => { haptic.tick(); sfx.playTick(0.2); }, 350); }, 3800);
    setTimeout(() => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      haptic.grandCelebration();
      sfx.playWinFanfare();
    }, 5200);
    setTimeout(() => {
      spinningRef.current = false;
      setSpinning(false);
      if (resultRef.current) onComplete(resultRef.current);
    }, 5600);
  }, [items, sliceAngle, onComplete, targetIndex]);

  useEffect(() => {
    if (autoSpin && !hasAutoSpun.current) {
      hasAutoSpun.current = true;
      const t = setTimeout(doSpin, 1500);
      return () => clearTimeout(t);
    }
  }, [autoSpin, doSpin]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: wheelSize + 28, height: wheelSize + 28 }}>
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `radial-gradient(circle, transparent 60%, ${tierColor}33 80%, transparent 100%)`,
          animation: spinning ? "pulseGlow 0.5s ease-in-out infinite" : "pulseGlow 2s ease-in-out infinite",
        }} />
        {/* LED lights */}
        {Array.from({ length: ledCount }, (_, i) => {
          const angle = (i / ledCount) * 2 * Math.PI - Math.PI / 2;
          const r = (wheelSize + 28) / 2;
          const x = r + r * Math.cos(angle) * 0.94;
          const y = r + r * Math.sin(angle) * 0.94;
          const isLit = (i + ledPhase) % 3 === 0;
          const colors = ["#ff6b9d","#c084fc","#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee"];
          return (
            <div key={i} className="absolute rounded-full" style={{
              left: x - 5, top: y - 5, width: 10, height: 10,
              backgroundColor: isLit ? colors[i % colors.length] : "rgba(255,255,255,0.08)",
              boxShadow: isLit ? `0 0 14px 4px ${colors[i % colors.length]}` : "none",
              transition: "all 0.12s",
            }} />
          );
        })}
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20" style={{ top: -2 }}>
          <div style={{ width: 0, height: 0, borderLeft: "16px solid transparent", borderRight: "16px solid transparent", borderTop: "30px solid #ef4444", filter: "drop-shadow(0 4px 8px rgba(239,68,68,0.7))" }} />
        </div>
        {/* Wheel */}
        <div className="absolute" style={{ left: 14, top: 14, width: wheelSize, height: wheelSize }}>
          <div className="absolute inset-0 rounded-full" style={{
            background: `linear-gradient(135deg, ${tierColor}, ${tierColor}cc)`,
            padding: 5,
            boxShadow: spinning ? `0 0 50px ${tierColor}88` : `0 0 25px ${tierColor}44`,
            transition: "box-shadow 0.5s",
          }}>
            <div className="w-full h-full rounded-full overflow-hidden">
              <div style={{ width: "100%", height: "100%", transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 5.5s cubic-bezier(0.12, 0.6, 0.06, 1)" : "none" }}>
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
                        <path d={`M ${center} ${center} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} Z`} fill={item.color} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                        <g transform={`translate(${tx}, ${ty}) rotate(${textRot})`}>
                          <text textAnchor="middle" dy="-6" fill="white" fontSize="20" fontWeight="bold" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.6)" } as React.CSSProperties}>{item.emoji}</text>
                          <text textAnchor="middle" dy="13" fill="white" fontSize="10" fontWeight="bold" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" } as React.CSSProperties}>{item.label}</text>
                        </g>
                      </g>
                    );
                  })}
                  <circle cx={center} cy={center} r={32} fill="white" stroke={tierColor} strokeWidth="3" />
                  <text x={center} y={center - 3} textAnchor="middle" fill={tierColor} fontSize="9" fontWeight="900">SPIN</text>
                  <text x={center} y={center + 9} textAnchor="middle" fill={tierColor} fontSize="8" fontWeight="900">& WIN</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-300 mt-4 font-bold" style={{ animation: "pulse 1.5s ease-in-out infinite" }}>
        {spinning ? "🎰 ルーレット回転中..." : "タップしてスピン！"}
      </p>
      <style>{`
        @keyframes pulseGlow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

/* ─── Share Sheet ─── */
function ShareSheet({ onClose, required }: { onClose: () => void; required: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ animation: "fadeIn 0.3s ease" }} />
      <div className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10" style={{
        background: "linear-gradient(180deg, #1e1b4b, #0f172a)",
        animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }} onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <h3 className="text-xl font-black text-white text-center mb-2">友達を招待しよう！</h3>
        <p className="text-center text-sm text-gray-400 mb-5">あと<span className="text-yellow-400 font-bold">{required}人</span>で <span className="text-yellow-400 font-bold">ポイント解放</span>！</p>
        <div className="space-y-3">
          <button className="w-full py-4 rounded-xl font-bold text-white text-base active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #06C755, #05a347)" }} onClick={() => { haptic.doubleTap(); sfx.playButtonClick(); }}>📱 LINEで友達に送る</button>
          <button className="w-full py-4 rounded-xl font-bold text-white text-base active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }} onClick={() => { haptic.doubleTap(); sfx.playButtonClick(); }}>📋 招待リンクをコピー</button>
          <button className="w-full py-4 rounded-xl font-bold text-white text-base active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }} onClick={() => { haptic.doubleTap(); sfx.playButtonClick(); }}>📤 その他の方法で共有</button>
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

/* ─── Celebration Intro ─── */
function CelebrationIntro({ round, onContinue }: { round: number; onContinue: () => void }) {
  const config = getRoundConfig(round);
  useEffect(() => {
    haptic.grandCelebration();
    sfx.playCelebration();
    sfx.playConfetti();
    setTimeout(() => sfx.playFirework(), 500);
    const t = setTimeout(onContinue, 3200);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4" style={{ background: config.bgGradient }}>
      <ScreenFlash color="rgba(34,197,94,0.5)" />
      <Confetti count={60} />
      <Fireworks count={5} />
      <StaggerReveal delay={0} duration={800}>
        <div className="text-8xl mb-4" style={{ animation: "celebBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)", filter: "drop-shadow(0 4px 20px rgba(255,215,0,0.5))" }}>🎉</div>
      </StaggerReveal>
      <StaggerReveal delay={300} duration={600}>
        <h2 className="text-3xl font-black text-white text-center mb-2">招待完了！おめでとう！</h2>
      </StaggerReveal>
      <StaggerReveal delay={600} duration={600}>
        <p className="text-xl font-bold text-center" style={{ background: `linear-gradient(90deg, ${config.tierColor}, #ffd700)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {config.tierEmoji} {config.tier}ルーレット発動！
        </p>
      </StaggerReveal>
      <StaggerReveal delay={1000} duration={600}>
        <div className="mt-6 flex items-center gap-3">
          {[0, 0.2, 0.4].map((d, i) => (
            <div key={i} className="w-4 h-4 rounded-full" style={{ background: config.tierColor, animation: `dotPulse 0.6s ease-in-out ${d}s infinite` }} />
          ))}
        </div>
      </StaggerReveal>
      <style>{`
        @keyframes celebBounce { 0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
        @keyframes dotPulse { 0%, 100% { opacity: 0.3; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.3); } }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WIN SCREEN (shared for all rounds)
   ═══════════════════════════════════════════════════════════════ */
function WinScreen({ points, round, totalPotential, nextInviteRequired, onAccept }: {
  points: number; round: number; totalPotential: number; nextInviteRequired: number; onAccept: () => void;
}) {
  const config = getRoundConfig(round);
  const countUp = useCountUp(points, 2500, 800);
  const totalCountUp = useCountUp(totalPotential, 1500, 2800);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4" style={{ background: config.bgGradient, animation: "winScreenIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
      <GodRays color={config.tierGlow} />
      <SparkleRing count={28} />
      <div className="w-full max-w-sm mx-auto">
        <GlowCard glowColor={`${config.tierColor}, #ef4444, ${config.tierColor}, #22d3ee, ${config.tierColor}`}>
          <div className="relative text-center py-8 px-4 overflow-hidden">
            {/* Trophy with tier badge */}
            <StaggerReveal delay={0} duration={800}>
              <div className="relative inline-block">
                <div className="text-7xl mb-1" style={{ filter: `drop-shadow(0 4px 16px ${config.tierGlow})`, animation: "trophyEntrance 1s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>🏆</div>
                <div className="absolute -top-1 -right-4 text-3xl" style={{ animation: "starSpin 3s linear infinite" }}>{config.tierEmoji}</div>
              </div>
            </StaggerReveal>

            {/* Title */}
            <StaggerReveal delay={300} duration={600}>
              <h2 className="text-2xl font-black mb-1" style={{ background: `linear-gradient(180deg, ${config.tierColor}, #ffaa00)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{config.tier}</h2>
              <p className="text-yellow-200 text-sm mb-4">{round === 0 ? "超大当たり！おめでとう！🎊" : "さらに大当たり！🎊"}</p>
            </StaggerReveal>

            {/* Count-up number */}
            <StaggerReveal delay={600} duration={700}>
              <div className="mx-2 rounded-xl py-5 px-6 mb-4 relative overflow-hidden" style={{
                background: "linear-gradient(135deg, #f59e0b, #ef4444, #ec4899)",
                backgroundSize: "200% 200%",
                animation: "gradientShift 3s ease infinite",
                boxShadow: `0 4px 30px ${config.tierGlow}`,
              }}>
                <div className="absolute inset-0" style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
                  animation: "shimmerBtn 2s ease-in-out infinite",
                }} />
                <div className="relative">
                  <span className="text-lg text-yellow-100 font-bold">+</span>
                  <span className="text-6xl font-black text-white" style={{ textShadow: "0 3px 12px rgba(0,0,0,0.5)", fontVariantNumeric: "tabular-nums" }}>
                    {countUp.toLocaleString()}
                  </span>
                  <span className="text-2xl font-black text-yellow-100 ml-1">pt</span>
                </div>
              </div>
            </StaggerReveal>

            {/* Total potential */}
            {round > 0 && (
              <StaggerReveal delay={1000} duration={500}>
                <div className="mb-3 py-2 px-4 rounded-lg inline-block" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                  <p className="text-sm text-purple-300">🎯 累計獲得可能</p>
                  <p className="text-2xl font-black text-white">{totalCountUp.toLocaleString()}<span className="text-sm text-yellow-400">pt</span></p>
                </div>
              </StaggerReveal>
            )}

            {/* Next requirement */}
            <StaggerReveal delay={1300} duration={500}>
              <div className="mx-2 mb-3 p-3 rounded-lg" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <p className="text-sm text-yellow-300 font-bold">
                  💡 この{points.toLocaleString()}ptを受け取るには
                </p>
                <p className="text-lg font-black text-white mt-1">
                  あと<span className="text-yellow-400 text-2xl">{nextInviteRequired}人</span>の友達を招待！
                </p>
              </div>
            </StaggerReveal>

            {/* Timer */}
            <StaggerReveal delay={1600} duration={500}>
              <CountdownTimer />
            </StaggerReveal>

            {/* CTA */}
            <StaggerReveal delay={2000} duration={600}>
              <BounceButton onClick={onAccept}
                className="mt-5 mx-2 w-[calc(100%-1rem)] py-4 rounded-xl font-black text-lg text-white"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 25px rgba(34,197,94,0.5)" }}>
                🎁 今すぐ受け取る！
              </BounceButton>
            </StaggerReveal>
          </div>
        </GlowCard>
      </div>
      <style>{`
        @keyframes winScreenIn { 0% { opacity: 0; transform: scale(0.6); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
        @keyframes trophyEntrance { 0% { transform: scale(0) rotate(-20deg); } 60% { transform: scale(1.3) rotate(5deg); } 100% { transform: scale(1) rotate(0deg); } }
        @keyframes starSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
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
  const [round, setRound] = useState(0); // 0-indexed
  const [totalPotential, setTotalPotential] = useState(0); // cumulative jackpot
  const [totalEarned, setTotalEarned] = useState(0); // confirmed rewards
  const [lastJackpot, setLastJackpot] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [fakeCount, setFakeCount] = useState(2847);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const ambientStopRef = useRef<(() => void) | null>(null);

  // Initialize audio on first user interaction
  useEffect(() => {
    const initOnTouch = () => {
      sfx.initAudio();
      // Start ambient drone for immersion
      if (!ambientStopRef.current) {
        ambientStopRef.current = sfx.playAmbient();
      }
      document.removeEventListener('touchstart', initOnTouch);
      document.removeEventListener('click', initOnTouch);
    };
    document.addEventListener('touchstart', initOnTouch, { once: true });
    document.addEventListener('click', initOnTouch, { once: true });
    return () => {
      document.removeEventListener('touchstart', initOnTouch);
      document.removeEventListener('click', initOnTouch);
      if (ambientStopRef.current) ambientStopRef.current();
    };
  }, []);

  const config = getRoundConfig(round);
  const spinItems = useMemo(() => getSpinItems(round), [round]);

  useEffect(() => {
    const id = setInterval(() => setFakeCount(p => p + Math.floor(Math.random() * 3)), 4000);
    return () => clearInterval(id);
  }, []);

  const triggerWinEffects = useCallback(() => {
    setShowFlash(true);
    setShowConfetti(true);
    setShowFireworks(true);
    haptic.grandCelebration();
    sfx.playSuperJackpot();
    sfx.playConfetti();
    setTimeout(() => sfx.playFirework(), 600);
    setTimeout(() => sfx.playFirework(), 1200);
    setTimeout(() => sfx.playFirework(), 1800);
    setTimeout(() => setShowFlash(false), 800);
    setTimeout(() => { setShowConfetti(false); setShowFireworks(false); }, 6000);
  }, []);

  const handleSpinComplete = useCallback(() => {
    const jp = config.jackpot;
    setLastJackpot(jp);
    setTotalPotential(prev => prev + jp);
    setTimeout(() => { setPhase("win"); triggerWinEffects(); }, 500);
  }, [config.jackpot, triggerWinEffects]);

  const acceptWin = () => {
    haptic.tap();
    sfx.playButtonClick();
    sfx.playTransition();
    setPhase("invite");
  };

  const simulateInvite = () => {
    haptic.grandCelebration();
    sfx.playCelebration();
    const reward = config.fixedReward;
    setTotalEarned(prev => prev + reward);
    setPhase("celebrate");
  };

  const handleCelebrationDone = useCallback(() => {
    sfx.playRoundUp();
    setRound(prev => prev + 1);
    setPhase("bonus-spin");
  }, []);

  const handleBonusSpinComplete = useCallback(() => {
    const nextConfig = getRoundConfig(round);
    const jp = nextConfig.jackpot;
    setLastJackpot(jp);
    setTotalPotential(prev => prev + jp);
    setTimeout(() => { setPhase("win"); triggerWinEffects(); }, 500);
  }, [round, triggerWinEffects]);

  const nextConfig = getRoundConfig(round + 1);
  // Progress bar: show 70-90% always
  const progressPercent = Math.min(92, 70 + (round * 4));

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: config.bgGradient }}>
      <FloatingParticles tier={config.tier} />
      {showFlash && <ScreenFlash color={config.tierGlow} />}
      {showConfetti && <Confetti count={100} />}
      {showFireworks && <Fireworks count={10} />}

      {/* ═══ PHASE: SPIN (initial & bonus) ═══ */}
      {(phase === "spin" || phase === "bonus-spin") && (
        <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-4" style={{ background: config.bgGradient }}>
          <GodRays color={config.tierGlow} />
          <StaggerReveal delay={0} duration={800}>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3" style={{ animation: "celebBounce 1s cubic-bezier(0.34, 1.56, 0.64, 1)", filter: `drop-shadow(0 4px 16px ${config.tierGlow})` }}>{config.tierEmoji}</div>
              <h2 className="text-2xl font-black text-white mb-1">
                {round === 0 ? "ボーナスチャンス発動！" : `${config.tier}ルーレット！`}
              </h2>
              <p className="text-sm font-bold" style={{ color: config.tierColor }}>
                {round === 0 ? "超レアチャンス！ルーレットが自動で回ります..." : "招待完了のご褒美！さらに大きなポイントGET！"}
              </p>
              {round > 0 && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <span className="text-xs text-gray-400">累計獲得可能:</span>
                  <span className="text-sm font-black text-yellow-400">{totalPotential.toLocaleString()}pt</span>
                </div>
              )}
            </div>
          </StaggerReveal>
          <StaggerReveal delay={500} duration={600}>
            <LuxurySpinWheel
              items={spinItems}
              onComplete={phase === "spin" ? handleSpinComplete : handleBonusSpinComplete}
              autoSpin
              targetIndex={4}
              tierColor={config.tierColor}
            />
          </StaggerReveal>
          <style>{`@keyframes celebBounce { 0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }`}</style>
        </div>
      )}

      {/* ═══ PHASE: WIN ═══ */}
      {phase === "win" && (
        <WinScreen
          points={lastJackpot}
          round={round}
          totalPotential={totalPotential}
          nextInviteRequired={config.inviteRequired}
          onAccept={acceptWin}
        />
      )}

      {/* ═══ PHASE: INVITE ═══ */}
      {phase === "invite" && (
        <div className="min-h-screen relative z-10 px-4 py-6" style={{ background: config.bgGradient, animation: "fadeSlideIn 0.5s ease" }}>
          <FloatingParticles tier={config.tier} />
          <div className="max-w-sm mx-auto space-y-4">
            {/* Round badge */}
            <StaggerReveal delay={0} duration={500}>
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: `${config.tierColor}22`, border: `1px solid ${config.tierColor}44` }}>
                  <span className="text-lg">{config.tierEmoji}</span>
                  <span style={{ color: config.tierColor }} className="font-bold text-sm">
                    {lastJackpot.toLocaleString()}pt 当選済み
                  </span>
                  <span className="text-green-400">✓</span>
                </div>
              </div>
            </StaggerReveal>

            {/* Total earned */}
            {totalEarned > 0 && (
              <StaggerReveal delay={100} duration={500}>
                <div className="text-center">
                  <span className="text-green-400 text-sm font-bold">確定済み: {totalEarned.toLocaleString()}pt</span>
                  <span className="text-gray-500 text-xs ml-2">/ 獲得可能: {totalPotential.toLocaleString()}pt</span>
                </div>
              </StaggerReveal>
            )}

            {/* Current stage */}
            <StaggerReveal delay={200} duration={500}>
              <div className="text-center">
                <h2 className="text-xl font-black" style={{ background: `linear-gradient(180deg, ${config.tierColor}, #ffaa00)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  ポイントを受け取ろう！
                </h2>
                <p className="text-gray-400 text-sm mt-1">友達を招待してポイントを確定させよう</p>
              </div>
            </StaggerReveal>

            {/* Invite card */}
            <StaggerReveal delay={400} duration={600}>
              <div className="rounded-xl p-4" style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${config.tierColor}33`,
                animation: "glowPulse 3s ease-in-out infinite",
              }}>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full flex items-center justify-center text-2xl shrink-0" style={{ background: `linear-gradient(135deg, ${config.tierColor}, #ef4444)` }}>👥</div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-base">友達を{config.inviteRequired}人招待</h3>
                    <p className="text-gray-400 text-xs">+{config.fixedReward.toLocaleString()}pt確定 + 次のルーレット解放！</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black" style={{ color: config.tierColor }}>+{config.fixedReward.toLocaleString()}</span>
                    <span style={{ color: config.tierColor }} className="text-sm">pt</span>
                  </div>
                </div>
                <div className="mt-3 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full" style={{ width: "0%", background: `linear-gradient(90deg, ${config.tierColor}, #ef4444, #fbbf24)`, transition: "width 0.7s" }} />
                </div>
                <p className="text-right text-xs text-gray-500 mt-1">0/{config.inviteRequired}人</p>
              </div>
            </StaggerReveal>

            {/* Next round preview */}
            <StaggerReveal delay={500} duration={500}>
              <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl" style={{ animation: "mysteryWiggle 2s ease-in-out infinite" }}>🎁</span>
                  <span className="text-2xl" style={{ animation: "mysteryWiggle 2s ease-in-out 0.3s infinite" }}>🎰</span>
                  <span className="text-2xl" style={{ animation: "mysteryWiggle 2s ease-in-out 0.6s infinite" }}>🎁</span>
                </div>
                <p className="text-center text-gray-400 text-sm font-bold">招待完了で次の<span style={{ color: nextConfig.tierColor }}>{nextConfig.tier}</span>が解放！</p>
                <p className="text-center text-gray-500 text-xs mt-1">最大 <span className="text-yellow-400 font-bold">{nextConfig.jackpot.toLocaleString()}pt</span> のチャンス！</p>
              </div>
            </StaggerReveal>

            {/* CTA */}
            <StaggerReveal delay={600} duration={600}>
              <BounceButton onClick={() => { haptic.tap(); setShowShare(true); }}
                className="w-full py-4 rounded-xl font-black text-lg text-white"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 25px rgba(34,197,94,0.5)" }}>
                🎉 友達を招待して受け取る！
              </BounceButton>
            </StaggerReveal>

            <StaggerReveal delay={700} duration={500}>
              <div className="flex justify-center"><CountdownTimer /></div>
            </StaggerReveal>

            {/* Fake social proof */}
            <StaggerReveal delay={800} duration={500}>
              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full mx-auto" style={{ background: "rgba(255,255,255,0.04)", width: "fit-content" }}>
                <span className="text-sm">🔥</span>
                <span className="text-sm text-gray-400">{fakeCount.toLocaleString()}人が参加中</span>
              </div>
            </StaggerReveal>

            {/* Progress bar */}
            <StaggerReveal delay={900} duration={500}>
              <div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full relative overflow-hidden" style={{
                    width: `${progressPercent}%`,
                    background: `linear-gradient(90deg, #22c55e, ${config.tierColor})`,
                    transition: "width 1s",
                  }}>
                    <div className="absolute inset-0" style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                      animation: "shimmerBtn 2s ease-in-out infinite",
                    }} />
                  </div>
                </div>
                <p className="text-right text-xs text-gray-500 mt-1">{totalEarned.toLocaleString()}/{totalPotential.toLocaleString()}pt</p>
              </div>
            </StaggerReveal>

            {/* Demo controls */}
            <StaggerReveal delay={1000} duration={500}>
              <div className="pt-4">
                <p className="text-center text-gray-600 text-xs mb-2">🎮 デモ操作</p>
                <button onClick={simulateInvite} className="w-full py-3 rounded-xl font-bold text-sm text-white active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  🎮 友達{config.inviteRequired}人招待完了をシミュレート
                </button>
              </div>
            </StaggerReveal>
          </div>
          <style>{`
            @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 10px ${config.tierColor}22; } 50% { box-shadow: 0 0 30px ${config.tierColor}44; } }
            @keyframes mysteryWiggle { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-10deg) scale(1.1); } 75% { transform: rotate(10deg) scale(1.1); } }
            @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
          `}</style>
        </div>
      )}

      {/* ═══ PHASE: CELEBRATE ═══ */}
      {phase === "celebrate" && (
        <CelebrationIntro round={round + 1} onContinue={handleCelebrationDone} />
      )}

      {showShare && <ShareSheet onClose={() => setShowShare(false)} required={config.inviteRequired} />}
    </div>
  );
}
