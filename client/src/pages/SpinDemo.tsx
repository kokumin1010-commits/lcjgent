import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import haptic from "@/lib/haptic";
import sfx from "@/lib/soundEffects";

/* ═══════════════════════════════════════════════════════════════
   ROUND CONFIG - Escalating Jackpot System
   ═══════════════════════════════════════════════════════════════ */
interface RoundConfig {
  jackpot: number;
  fixedReward: number;
  inviteRequired: number;
  tier: string;
  tierEmoji: string;
  tierColor: string;
  tierGlow: string;
  bgGradient: string;
  wheelColors: [string, string][];
}

const ROUND_CONFIGS: RoundConfig[] = [
  { jackpot: 5000, fixedReward: 500, inviteRequired: 1, tier: "SUPER JACKPOT", tierEmoji: "💎", tierColor: "#fbbf24", tierGlow: "rgba(251,191,36,0.5)", bgGradient: "radial-gradient(ellipse at 50% 30%, #1a0a00 0%, #0a0500 40%, #000 100%)", wheelColors: [["#fbbf24", "#f59e0b"], ["#fef3c7", "#fde68a"], ["#d97706", "#b45309"], ["#fbbf24", "#f59e0b"], ["#fef3c7", "#fde68a"], ["#d97706", "#b45309"], ["#fbbf24", "#f59e0b"], ["#fef3c7", "#fde68a"]] },
  { jackpot: 3000, fixedReward: 500, inviteRequired: 3, tier: "GOLD JACKPOT", tierEmoji: "🏆", tierColor: "#f59e0b", tierGlow: "rgba(245,158,11,0.5)", bgGradient: "radial-gradient(ellipse at 50% 30%, #1a0f00 0%, #0a0700 40%, #000 100%)", wheelColors: [["#f59e0b", "#d97706"], ["#fde68a", "#fcd34d"], ["#b45309", "#92400e"], ["#f59e0b", "#d97706"], ["#fde68a", "#fcd34d"], ["#b45309", "#92400e"], ["#f59e0b", "#d97706"], ["#fde68a", "#fcd34d"]] },
  { jackpot: 6000, fixedReward: 500, inviteRequired: 5, tier: "DIAMOND JACKPOT", tierEmoji: "💠", tierColor: "#22d3ee", tierGlow: "rgba(34,211,238,0.5)", bgGradient: "radial-gradient(ellipse at 50% 30%, #001a1f 0%, #000a0f 40%, #000 100%)", wheelColors: [["#22d3ee", "#06b6d4"], ["#cffafe", "#a5f3fc"], ["#0891b2", "#0e7490"], ["#22d3ee", "#06b6d4"], ["#cffafe", "#a5f3fc"], ["#0891b2", "#0e7490"], ["#22d3ee", "#06b6d4"], ["#cffafe", "#a5f3fc"]] },
  { jackpot: 10000, fixedReward: 800, inviteRequired: 7, tier: "PLATINUM JACKPOT", tierEmoji: "👑", tierColor: "#a78bfa", tierGlow: "rgba(167,139,250,0.5)", bgGradient: "radial-gradient(ellipse at 50% 30%, #0f0020 0%, #050010 40%, #000 100%)", wheelColors: [["#a78bfa", "#8b5cf6"], ["#ede9fe", "#ddd6fe"], ["#7c3aed", "#6d28d9"], ["#a78bfa", "#8b5cf6"], ["#ede9fe", "#ddd6fe"], ["#7c3aed", "#6d28d9"], ["#a78bfa", "#8b5cf6"], ["#ede9fe", "#ddd6fe"]] },
  { jackpot: 15000, fixedReward: 1000, inviteRequired: 12, tier: "ROYAL JACKPOT", tierEmoji: "🌟", tierColor: "#f472b6", tierGlow: "rgba(244,114,182,0.5)", bgGradient: "radial-gradient(ellipse at 50% 30%, #1a0010 0%, #0a0008 40%, #000 100%)", wheelColors: [["#f472b6", "#ec4899"], ["#fce7f3", "#fbcfe8"], ["#db2777", "#be185d"], ["#f472b6", "#ec4899"], ["#fce7f3", "#fbcfe8"], ["#db2777", "#be185d"], ["#f472b6", "#ec4899"], ["#fce7f3", "#fbcfe8"]] },
  { jackpot: 20000, fixedReward: 1500, inviteRequired: 20, tier: "LEGEND JACKPOT", tierEmoji: "🔥", tierColor: "#ef4444", tierGlow: "rgba(239,68,68,0.5)", bgGradient: "radial-gradient(ellipse at 50% 30%, #1a0000 0%, #0a0000 40%, #000 100%)", wheelColors: [["#ef4444", "#dc2626"], ["#fecaca", "#fca5a5"], ["#b91c1c", "#991b1b"], ["#ef4444", "#dc2626"], ["#fecaca", "#fca5a5"], ["#b91c1c", "#991b1b"], ["#ef4444", "#dc2626"], ["#fecaca", "#fca5a5"]] },
];

function getRoundConfig(round: number): RoundConfig {
  if (round < ROUND_CONFIGS.length) return ROUND_CONFIGS[round];
  const base = ROUND_CONFIGS[ROUND_CONFIGS.length - 1];
  const extra = round - ROUND_CONFIGS.length + 1;
  return { ...base, jackpot: base.jackpot + extra * 8000, fixedReward: base.fixedReward + extra * 500, inviteRequired: base.inviteRequired + extra * 15, tier: "ULTRA LEGEND", tierEmoji: "⚡" };
}

function getSpinItems(round: number) {
  const config = getRoundConfig(round);
  const jp = config.jackpot;
  return [
    { label: `${(jp * 0.02).toLocaleString()}pt`, emoji: "🌙" },
    { label: `${(jp * 0.1).toLocaleString()}pt`, emoji: "⭐" },
    { label: `${(jp * 0.04).toLocaleString()}pt`, emoji: "🎀" },
    { label: `${(jp * 0.2).toLocaleString()}pt`, emoji: "💫" },
    { label: `${jp.toLocaleString()}pt`, emoji: "💎" }, // target index 4
    { label: `${(jp * 0.06).toLocaleString()}pt`, emoji: "🌸" },
    { label: `${(jp * 0.4).toLocaleString()}pt`, emoji: "🏅" },
    { label: `${(jp * 0.08).toLocaleString()}pt`, emoji: "✨" },
  ];
}

/* ═══════════════════════════════════════════════════════════════
   VISUAL EFFECTS
   ═══════════════════════════════════════════════════════════════ */

function LCJLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "text-sm", md: "text-lg", lg: "text-2xl" };
  return (
    <div className={`flex items-center gap-1.5 ${sizeMap[size]}`}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg, #ec4899, #f43f5e)", boxShadow: "0 2px 8px rgba(236,72,153,0.4)" }}>
        <span className="text-white text-xs font-black">L</span>
      </div>
      <span className="font-black tracking-tight" style={{ background: "linear-gradient(90deg, #ec4899, #f43f5e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LCJ MALL</span>
    </div>
  );
}

function FloatingParticles({ tier }: { tier: string }) {
  const particles = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 8, duration: 4 + Math.random() * 6, size: 2 + Math.random() * 4,
    emoji: ["✨", "⭐", "💫", "🌟", "✦", "◆"][Math.floor(Math.random() * 6)],
  })), [tier]);
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map(p => (
        <div key={p.id} className="absolute text-yellow-400/30" style={{
          left: `${p.left}%`, bottom: "-10%", fontSize: `${p.size * 3}px`,
          animation: `floatUp ${p.duration}s linear ${p.delay}s infinite`,
        }}>{p.emoji}</div>
      ))}
      <style>{`@keyframes floatUp { 0% { transform: translateY(0) rotate(0deg); opacity: 0; } 10% { opacity: 0.6; } 90% { opacity: 0.3; } 100% { transform: translateY(-110vh) rotate(360deg); opacity: 0; } }`}</style>
    </div>
  );
}

function Confetti({ count = 80 }: { count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 1.5, duration: 2 + Math.random() * 2,
    color: ["#fbbf24", "#ef4444", "#22c55e", "#3b82f6", "#ec4899", "#a855f7", "#f97316", "#14b8a6"][i % 8],
    size: 4 + Math.random() * 6, rotation: Math.random() * 360,
  })), [count]);
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div key={p.id} className="absolute rounded-sm" style={{
          left: `${p.left}%`, top: "-5%", width: `${p.size}px`, height: `${p.size * 1.5}px`,
          background: p.color, transform: `rotate(${p.rotation}deg)`,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
        }} />
      ))}
      <style>{`@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }`}</style>
    </div>
  );
}

function Fireworks({ count = 8 }: { count?: number }) {
  const bursts = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, left: 10 + Math.random() * 80, top: 10 + Math.random() * 50, delay: Math.random() * 2,
    color: ["#fbbf24", "#ef4444", "#22c55e", "#ec4899", "#a855f7", "#22d3ee"][i % 6], size: 80 + Math.random() * 60,
  })), [count]);
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {bursts.map(b => (
        <div key={b.id} className="absolute rounded-full" style={{
          left: `${b.left}%`, top: `${b.top}%`, width: `${b.size}px`, height: `${b.size}px`,
          background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
          animation: `fireworkBurst 1.2s ease-out ${b.delay}s both`,
        }} />
      ))}
      <style>{`@keyframes fireworkBurst { 0% { transform: scale(0); opacity: 1; } 50% { opacity: 0.8; } 100% { transform: scale(2.5); opacity: 0; } }`}</style>
    </div>
  );
}

function ScreenFlash({ color }: { color: string }) {
  return <div className="fixed inset-0 z-50 pointer-events-none" style={{ background: color, animation: "flashOut 0.6s ease-out forwards" }}>
    <style>{`@keyframes flashOut { 0% { opacity: 0.8; } 100% { opacity: 0; } }`}</style>
  </div>;
}

/* ═══════════════════════════════════════════════════════════════
   FALLING COINS - Temu-style gold coin rain animation
   ═══════════════════════════════════════════════════════════════ */
function FallingCoins() {
  const coins = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2.5 + Math.random() * 2,
    size: 28 + Math.random() * 24, // 28-52px coins
    rotation: Math.random() * 360,
    wobble: 10 + Math.random() * 30, // horizontal wobble
    spinSpeed: 1 + Math.random() * 2,
  })), []);

  useEffect(() => {
    sfx.playCoinRain();
    const intervals: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 12; i++) {
      intervals.push(setTimeout(() => sfx.playCoinDrop(), 300 + i * 200 + Math.random() * 300));
    }
    return () => intervals.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {coins.map(c => (
        <div key={c.id} className="absolute" style={{
          left: `${c.left}%`,
          top: '-80px',
          width: `${c.size}px`,
          height: `${c.size}px`,
          animation: `coinFall ${c.duration}s ease-in ${c.delay}s forwards`,
          '--wobble': `${c.wobble}px`,
        } as React.CSSProperties}>
          {/* 3D rotating coin */}
          <div style={{
            width: '100%',
            height: '100%',
            animation: `coinSpin3D ${c.spinSpeed}s linear infinite`,
            transformStyle: 'preserve-3d',
          }}>
            <svg viewBox="0 0 100 100" width={c.size} height={c.size}>
              {/* Coin body */}
              <defs>
                <radialGradient id={`coinGrad${c.id}`} cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#fff7cc" />
                  <stop offset="30%" stopColor="#ffd700" />
                  <stop offset="70%" stopColor="#daa520" />
                  <stop offset="100%" stopColor="#b8860b" />
                </radialGradient>
                <radialGradient id={`coinShine${c.id}`} cx="30%" cy="25%" r="40%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>
              {/* Outer ring */}
              <circle cx="50" cy="50" r="48" fill="#b8860b" />
              <circle cx="50" cy="50" r="45" fill={`url(#coinGrad${c.id})`} />
              {/* Inner ring */}
              <circle cx="50" cy="50" r="38" fill="none" stroke="#daa520" strokeWidth="2" />
              {/* ¥ symbol */}
              <text x="50" y="58" textAnchor="middle" fontSize="36" fontWeight="bold" fill="#8B6914" fontFamily="Arial, sans-serif">¥</text>
              <text x="50" y="58" textAnchor="middle" fontSize="36" fontWeight="bold" fill="#DAA520" fontFamily="Arial, sans-serif" opacity="0.6">¥</text>
              {/* Shine overlay */}
              <circle cx="50" cy="50" r="45" fill={`url(#coinShine${c.id})`} />
            </svg>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes coinFall {
          0% { transform: translateY(0) translateX(0); opacity: 1; }
          20% { opacity: 1; }
          60% { transform: translateY(70vh) translateX(var(--wobble)); opacity: 1; }
          80% { transform: translateY(90vh) translateX(calc(var(--wobble) * -0.5)); opacity: 0.8; }
          100% { transform: translateY(110vh) translateX(var(--wobble)); opacity: 0; }
        }
        @keyframes coinSpin3D {
          0% { transform: rotateY(0deg) rotateX(10deg); }
          25% { transform: rotateY(90deg) rotateX(-5deg); }
          50% { transform: rotateY(180deg) rotateX(10deg); }
          75% { transform: rotateY(270deg) rotateX(-5deg); }
          100% { transform: rotateY(360deg) rotateX(10deg); }
        }
      `}</style>
    </div>
  );
}

function GodRays({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="absolute top-1/2 left-1/2" style={{
          width: "200%", height: "3px", background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          transform: `translate(-50%, -50%) rotate(${i * 30}deg)`, opacity: 0.15,
          animation: `rayPulse 3s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes rayPulse { 0%, 100% { opacity: 0.08; transform: translate(-50%, -50%) rotate(var(--r)) scaleX(0.8); } 50% { opacity: 0.2; transform: translate(-50%, -50%) rotate(var(--r)) scaleX(1.2); } }`}</style>
    </div>
  );
}

function SparkleRing({ count = 24 }: { count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360;
        const radius = 45;
        return <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400" style={{
          left: `${50 + radius * Math.cos(angle * Math.PI / 180)}%`,
          top: `${50 + radius * Math.sin(angle * Math.PI / 180)}%`,
          animation: `sparklePulse 2s ease-in-out ${i * 0.1}s infinite`,
        }} />;
      })}
      <style>{`@keyframes sparklePulse { 0%, 100% { opacity: 0.2; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.5); } }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATION HELPERS
   ═══════════════════════════════════════════════════════════════ */

function StaggerReveal({ children, delay, duration }: { children: React.ReactNode; delay: number; duration: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.9)", transition: `all ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}>{children}</div>;
}

function BounceButton({ children, onClick, className, style }: { children: React.ReactNode; onClick: () => void; className?: string; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} className={`active:scale-95 transition-transform relative overflow-hidden ${className}`} style={{ ...style, animation: "btnBounce 2s ease-in-out infinite" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)", animation: "shimmerBtn 2.5s ease-in-out infinite" }} />
      <span className="relative z-10">{children}</span>
      <style>{`
        @keyframes btnBounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
        @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
      `}</style>
    </button>
  );
}

function GlowCard({ children, glowColor }: { children: React.ReactNode; glowColor: string }) {
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ animation: "cardGlow 4s ease-in-out infinite" }}>
      <div className="absolute -inset-0.5 rounded-2xl" style={{ background: `conic-gradient(from 0deg, ${glowColor})`, animation: "borderSpin 6s linear infinite" }} />
      <div className="relative rounded-2xl" style={{ background: "linear-gradient(180deg, #1a1500 0%, #0d0a00 50%, #050300 100%)" }}>{children}</div>
      <style>{`
        @keyframes cardGlow { 0%, 100% { filter: drop-shadow(0 0 15px rgba(251,191,36,0.2)); } 50% { filter: drop-shadow(0 0 30px rgba(251,191,36,0.4)); } }
        @keyframes borderSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function CountdownTimer() {
  const [time, setTime] = useState({ h: 23, m: 59, s: 59 });
  useEffect(() => { const id = setInterval(() => setTime(t => { let s = t.s - 1, m = t.m, h = t.h; if (s < 0) { s = 59; m--; } if (m < 0) { m = 59; h--; } if (h < 0) h = 23; return { h, m, s }; }), 1000); return () => clearInterval(id); }, []);
  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <span className="text-red-500">🔴</span>
      <span className="text-gray-400 font-bold">受け取り期限</span>
      {[time.h, time.m, time.s].map((v, i) => (
        <span key={i} className="bg-red-600 text-white font-black px-2 py-0.5 rounded text-sm min-w-[28px] text-center">{String(v).padStart(2, "0")}</span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COUNT UP HOOK
   ═══════════════════════════════════════════════════════════════ */
function useCountUp(target: number, duration: number = 2000, startDelay: number = 0) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const from = prevRef.current;
      let soundInterval: any = null;
      soundInterval = setInterval(() => sfx.playCountUp(), 50);
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(from + (target - from) * eased);
        setValue(current);
        if (progress < 1) requestAnimationFrame(animate);
        else { prevRef.current = target; clearInterval(soundInterval); sfx.playCountUpComplete(); }
      };
      requestAnimationFrame(animate);
      return () => clearInterval(soundInterval);
    }, startDelay);
    return () => clearTimeout(timeout);
  }, [target, duration, startDelay]);
  return value;
}

/* ═══════════════════════════════════════════════════════════════
   LUXURY SPIN WHEEL - Premium Casino Style
   ═══════════════════════════════════════════════════════════════ */
function LuxurySpinWheel({ items, onComplete, targetIndex, tierColor, onCountdownStart, autoStart = false }: {
  items: { label: string; emoji: string }[];
  onComplete: () => void;
  targetIndex: number;
  tierColor: string;
  onCountdownStart?: () => void;
  autoStart?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"ready" | "countdown" | "spinning" | "done">("ready");
  const [countdown, setCountdown] = useState(3);
  const angleRef = useRef(0);
  const spinningRef = useRef(false);
  const autoStartedRef = useRef(false);

  // Draw the luxury wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 8;
    const sliceAngle = (2 * Math.PI) / items.length;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Outer gold ring with shadow
      ctx.save();
      ctx.shadowColor = "rgba(251,191,36,0.6)";
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
      const outerGrad = ctx.createLinearGradient(0, 0, size, size);
      outerGrad.addColorStop(0, "#fbbf24");
      outerGrad.addColorStop(0.3, "#fef3c7");
      outerGrad.addColorStop(0.5, "#f59e0b");
      outerGrad.addColorStop(0.7, "#fef3c7");
      outerGrad.addColorStop(1, "#d97706");
      ctx.fillStyle = outerGrad;
      ctx.fill();
      ctx.restore();

      // Inner dark ring
      ctx.beginPath();
      ctx.arc(center, center, radius - 2, 0, 2 * Math.PI);
      ctx.fillStyle = "#1a1000";
      ctx.fill();

      // Wheel slices
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angleRef.current);

      for (let i = 0; i < items.length; i++) {
        const startAngle = i * sliceAngle - Math.PI / 2;
        const endAngle = startAngle + sliceAngle;

        // Slice gradient
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 8, startAngle, endAngle);
        ctx.closePath();

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius - 8);
        const colors = [
          ["#fbbf24", "#f59e0b", "#d97706"],
          ["#fef3c7", "#fde68a", "#fcd34d"],
          ["#92400e", "#78350f", "#451a03"],
          ["#fbbf24", "#f59e0b", "#d97706"],
          ["#fef3c7", "#fde68a", "#fcd34d"],
          ["#92400e", "#78350f", "#451a03"],
          ["#fbbf24", "#f59e0b", "#d97706"],
          ["#fef3c7", "#fde68a", "#fcd34d"],
        ];
        const c = colors[i % colors.length];
        grad.addColorStop(0, c[0]);
        grad.addColorStop(0.5, c[1]);
        grad.addColorStop(1, c[2]);
        ctx.fillStyle = grad;
        ctx.fill();

        // Slice border
        ctx.strokeStyle = "rgba(251,191,36,0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text
        const textAngle = startAngle + sliceAngle / 2;
        const textRadius = radius * 0.58;
        ctx.save();
        ctx.rotate(textAngle);
        ctx.translate(textRadius, 0);
        ctx.rotate(Math.PI / 2);

        // Emoji
        ctx.font = `${Math.round(radius * 0.12)}px serif`;
        ctx.textAlign = "center";
        ctx.fillText(items[i].emoji, 0, -radius * 0.08);

        // Label
        ctx.font = `bold ${Math.round(radius * 0.09)}px 'Arial', sans-serif`;
        ctx.fillStyle = i === targetIndex ? "#fff" : "#1a1000";
        ctx.strokeStyle = i === targetIndex ? "#000" : "transparent";
        ctx.lineWidth = i === targetIndex ? 2 : 0;
        if (i === targetIndex) ctx.strokeText(items[i].label, 0, radius * 0.06);
        ctx.fillText(items[i].label, 0, radius * 0.06);

        // Jackpot label
        if (i === targetIndex) {
          ctx.font = `bold ${Math.round(radius * 0.065)}px 'Arial', sans-serif`;
          ctx.fillStyle = "#fef08a";
          ctx.fillText("大当たり", 0, -radius * 0.18);
        }

        ctx.restore();
      }
      ctx.restore();

      // Gold studs around the rim
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * 2 * Math.PI;
        const x = center + (radius + 1) * Math.cos(angle);
        const y = center + (radius + 1) * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
        const studGrad = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, 3.5);
        studGrad.addColorStop(0, "#fef3c7");
        studGrad.addColorStop(1, "#b45309");
        ctx.fillStyle = studGrad;
        ctx.fill();
      }

      // Center hub - luxury
      const hubRadius = radius * 0.18;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(center, center, hubRadius + 4, 0, 2 * Math.PI);
      const hubBorderGrad = ctx.createLinearGradient(center - hubRadius, center - hubRadius, center + hubRadius, center + hubRadius);
      hubBorderGrad.addColorStop(0, "#fbbf24");
      hubBorderGrad.addColorStop(0.5, "#fef3c7");
      hubBorderGrad.addColorStop(1, "#d97706");
      ctx.fillStyle = hubBorderGrad;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(center, center, hubRadius, 0, 2 * Math.PI);
      const hubGrad = ctx.createRadialGradient(center - 5, center - 5, 0, center, center, hubRadius);
      hubGrad.addColorStop(0, "#1a1000");
      hubGrad.addColorStop(1, "#0a0500");
      ctx.fillStyle = hubGrad;
      ctx.fill();

      // Hub text
      ctx.fillStyle = "#fbbf24";
      ctx.font = `bold ${Math.round(hubRadius * 0.55)}px 'Arial', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SPIN", center, center - 4);
      ctx.font = `bold ${Math.round(hubRadius * 0.35)}px 'Arial', sans-serif`;
      ctx.fillStyle = "#fde68a";
      ctx.fillText("& WIN", center, center + hubRadius * 0.4);
    };

    draw();

    // Animation loop for spinning
    let animId: number;
    const animate = () => {
      draw();
      animId = requestAnimationFrame(animate);
    };
    if (spinningRef.current || phase === "spinning") {
      animate();
    }
    return () => cancelAnimationFrame(animId);
  }, [items, targetIndex, phase]);

  // Spinning logic
  const doSpin = useCallback(() => {
    if (spinningRef.current) return;
    spinningRef.current = true;
    setPhase("spinning");
    sfx.playSpinStart();
    haptic.spinStart();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 8;
    const sliceAngle = (2 * Math.PI) / items.length;

    // Calculate target angle — needle is at 12 o'clock (270° / -PI/2 in canvas)
    // Segment i center in screen coords = R + (i+0.5)*sliceAngle - PI/2
    // For this to equal -PI/2 (needle): R = -(i+0.5)*sliceAngle = 2PI - (i+0.5)*sliceAngle
    const targetAngle = (2 * Math.PI) - (targetIndex + 0.5) * sliceAngle;
    const jitter = (Math.random() - 0.5) * sliceAngle * 0.5; // ±25% within slice (safe margin)
    const fullSpins = Math.PI * 2 * (6 + Math.floor(Math.random() * 3));
    const totalRotation = fullSpins + targetAngle + jitter;
    const duration = 5000 + Math.random() * 1000;
    const start = performance.now();
    let lastTickAngle = 0;

    const animateSpin = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      angleRef.current = eased * totalRotation;

      // Tick sound & haptic at each slice boundary
      const currentSlice = Math.floor((angleRef.current % (Math.PI * 2)) / sliceAngle);
      const lastSlice = Math.floor((lastTickAngle % (Math.PI * 2)) / sliceAngle);
      if (currentSlice !== lastSlice) {
        const speed = 1 - progress;
        sfx.playTick(speed);
        haptic.tick();
        // Enhanced needle bounce - spring physics
        if (needleRef.current) {
          const maxAngle = 18 * speed + 5; // bigger bounce at high speed
          const el = needleRef.current;
          el.style.transition = 'none';
          el.style.transform = `translateX(-50%) rotate(${maxAngle}deg)`;
          // Spring back with overshoot
          requestAnimationFrame(() => {
            el.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
            el.style.transform = 'translateX(-50%) rotate(0deg)';
          });
        }
      }
      lastTickAngle = angleRef.current;

      // Redraw
      ctx.clearRect(0, 0, size, size);

      // Outer gold ring
      ctx.save();
      ctx.shadowColor = "rgba(251,191,36,0.6)";
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
      const outerGrad = ctx.createLinearGradient(0, 0, size, size);
      outerGrad.addColorStop(0, "#fbbf24");
      outerGrad.addColorStop(0.3, "#fef3c7");
      outerGrad.addColorStop(0.5, "#f59e0b");
      outerGrad.addColorStop(0.7, "#fef3c7");
      outerGrad.addColorStop(1, "#d97706");
      ctx.fillStyle = outerGrad;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(center, center, radius - 2, 0, 2 * Math.PI);
      ctx.fillStyle = "#1a1000";
      ctx.fill();

      // Slices
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angleRef.current);
      for (let i = 0; i < items.length; i++) {
        const sa = i * sliceAngle - Math.PI / 2;
        const ea = sa + sliceAngle;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 8, sa, ea);
        ctx.closePath();
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius - 8);
        const colors = [["#fbbf24", "#f59e0b", "#d97706"], ["#fef3c7", "#fde68a", "#fcd34d"], ["#92400e", "#78350f", "#451a03"], ["#fbbf24", "#f59e0b", "#d97706"], ["#fef3c7", "#fde68a", "#fcd34d"], ["#92400e", "#78350f", "#451a03"], ["#fbbf24", "#f59e0b", "#d97706"], ["#fef3c7", "#fde68a", "#fcd34d"]];
        const c = colors[i % colors.length];
        grad.addColorStop(0, c[0]); grad.addColorStop(0.5, c[1]); grad.addColorStop(1, c[2]);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "rgba(251,191,36,0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const ta = sa + sliceAngle / 2;
        const tr = radius * 0.58;
        ctx.save();
        ctx.rotate(ta);
        ctx.translate(tr, 0);
        ctx.rotate(Math.PI / 2);
        ctx.font = `${Math.round(radius * 0.12)}px serif`;
        ctx.textAlign = "center";
        ctx.fillText(items[i].emoji, 0, -radius * 0.08);
        ctx.font = `bold ${Math.round(radius * 0.09)}px 'Arial', sans-serif`;
        ctx.fillStyle = i === targetIndex ? "#fff" : "#1a1000";
        if (i === targetIndex) { ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.strokeText(items[i].label, 0, radius * 0.06); }
        ctx.fillText(items[i].label, 0, radius * 0.06);
        if (i === targetIndex) { ctx.font = `bold ${Math.round(radius * 0.065)}px 'Arial', sans-serif`; ctx.fillStyle = "#fef08a"; ctx.fillText("大当たり", 0, -radius * 0.18); }
        ctx.restore();
      }
      ctx.restore();

      // Studs
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * 2 * Math.PI;
        const x = center + (radius + 1) * Math.cos(angle);
        const y = center + (radius + 1) * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
        const studGrad = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, 3.5);
        studGrad.addColorStop(0, "#fef3c7");
        studGrad.addColorStop(1, "#b45309");
        ctx.fillStyle = studGrad;
        ctx.fill();
        // Blinking lights during spin
        if (progress < 0.9) {
          const blink = Math.sin(elapsed * 0.01 + i) > 0;
          if (blink) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(255,255,200,0.8)";
            ctx.fill();
          }
        }
      }

      // Hub
      const hubRadius = radius * 0.18;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(center, center, hubRadius + 4, 0, 2 * Math.PI);
      const hbg = ctx.createLinearGradient(center - hubRadius, center - hubRadius, center + hubRadius, center + hubRadius);
      hbg.addColorStop(0, "#fbbf24"); hbg.addColorStop(0.5, "#fef3c7"); hbg.addColorStop(1, "#d97706");
      ctx.fillStyle = hbg;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(center, center, hubRadius, 0, 2 * Math.PI);
      const hg = ctx.createRadialGradient(center - 5, center - 5, 0, center, center, hubRadius);
      hg.addColorStop(0, "#1a1000"); hg.addColorStop(1, "#0a0500");
      ctx.fillStyle = hg;
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.font = `bold ${Math.round(hubRadius * 0.55)}px 'Arial', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SPIN", center, center - 4);
      ctx.font = `bold ${Math.round(hubRadius * 0.35)}px 'Arial', sans-serif`;
      ctx.fillStyle = "#fde68a";
      ctx.fillText("& WIN", center, center + hubRadius * 0.4);

      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        spinningRef.current = false;
        
        // Draw highlight on winning segment
        const finalAngleMod = angleRef.current % (2 * Math.PI);
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(finalAngleMod);
        const winStart = targetIndex * sliceAngle - Math.PI / 2;
        const winEnd = winStart + sliceAngle;
        // Glowing highlight overlay
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 8, winStart, winEnd);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fill();
        // Bright border around winning segment
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 8, winStart, winEnd);
        ctx.closePath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 25;
        ctx.stroke();
        ctx.restore();
        
        setPhase("done");
        sfx.playWinFanfare();
        haptic.result();
        // Show the wheel stopped at jackpot for 3 seconds before transitioning
        setTimeout(() => onComplete(), 3000);
      }
    };
    requestAnimationFrame(animateSpin);
  }, [items, targetIndex, onComplete]);

  // Countdown logic
  const startCountdown = useCallback(() => {
    if (phase !== 'ready') return;
    sfx.initAudio();
    onCountdownStart?.();
    setPhase("countdown");
    setCountdown(3);
    sfx.playCountdown(3);
    haptic.tap();

    setTimeout(() => { setCountdown(2); sfx.playCountdown(2); haptic.tap(); }, 1000);
    setTimeout(() => { setCountdown(1); sfx.playCountdown(1); haptic.tap(); }, 2000);
    setTimeout(() => { sfx.playCountdownGo(); haptic.spinStart(); doSpin(); }, 3000);
  }, [doSpin, onCountdownStart, phase]);

  // Auto-start countdown after 2 seconds
  useEffect(() => {
    if (autoStart && !autoStartedRef.current && phase === 'ready') {
      autoStartedRef.current = true;
      const timer = setTimeout(() => {
        startCountdown();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoStart, phase, startCountdown]);

  const wheelSize = Math.min(340, typeof window !== "undefined" ? window.innerWidth - 40 : 300);

  // LED light count
  const ledCount = 32;

  // Gem positions at cardinal points
  const gemPositions = useMemo(() => [
    { angle: 0, color: '#ef4444', highlight: '#fca5a5', name: 'ruby' },     // top
    { angle: 90, color: '#3b82f6', highlight: '#93c5fd', name: 'sapphire' }, // right
    { angle: 180, color: '#22c55e', highlight: '#86efac', name: 'emerald' }, // bottom
    { angle: 270, color: '#a855f7', highlight: '#d8b4fe', name: 'amethyst' },// left
    { angle: 45, color: '#fbbf24', highlight: '#fef3c7', name: 'topaz1' },
    { angle: 135, color: '#ec4899', highlight: '#fbcfe8', name: 'pink1' },
    { angle: 225, color: '#fbbf24', highlight: '#fef3c7', name: 'topaz2' },
    { angle: 315, color: '#ec4899', highlight: '#fbcfe8', name: 'pink2' },
  ], []);

  return (
    <div className="flex flex-col items-center">
      {/* Wheel container with luxury decorations */}
      <div className="relative" style={{ width: wheelSize + 40, height: wheelSize + 60 }}>

        {/* ═══ OUTER LUXURY FRAME ═══ */}
        {/* Double gold frame - outer ring */}
        <div className="absolute" style={{
          top: 30 - 18, left: 20 - 18,
          width: wheelSize + 36, height: wheelSize + 36,
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #fbbf24, #fef3c7, #d97706, #fbbf24, #fef3c7, #b45309, #fbbf24, #fef3c7, #d97706, #fbbf24)',
          boxShadow: '0 0 30px rgba(251,191,36,0.4), 0 0 60px rgba(251,191,36,0.2), inset 0 0 20px rgba(251,191,36,0.3)',
          animation: 'outerFrameGlow 3s ease-in-out infinite',
        }} />
        {/* Double gold frame - inner ring */}
        <div className="absolute" style={{
          top: 30 - 12, left: 20 - 12,
          width: wheelSize + 24, height: wheelSize + 24,
          borderRadius: '50%',
          background: 'conic-gradient(from 180deg, #d97706, #fef3c7, #fbbf24, #d97706, #fef3c7, #b45309, #d97706, #fef3c7, #fbbf24, #d97706)',
          boxShadow: 'inset 0 0 15px rgba(251,191,36,0.4)',
        }} />
        {/* Dark gap between frames */}
        <div className="absolute" style={{
          top: 30 - 9, left: 20 - 9,
          width: wheelSize + 18, height: wheelSize + 18,
          borderRadius: '50%',
          background: '#1a0f00',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
        }} />

        {/* ═══ LED LIGHTS RING ═══ */}
        <div className="absolute pointer-events-none" style={{
          top: 30 - 15, left: 20 - 15,
          width: wheelSize + 30, height: wheelSize + 30,
        }}>
          {Array.from({ length: ledCount }, (_, i) => {
            const angle = (i / ledCount) * 2 * Math.PI - Math.PI / 2;
            const r = (wheelSize + 30) / 2;
            const cx = r + r * Math.cos(angle);
            const cy = r + r * Math.sin(angle);
            const isEven = i % 2 === 0;
            const isThird = i % 3 === 0;
            return (
              <div key={i} className="absolute" style={{
                left: cx - 5, top: cy - 5,
                width: 10, height: 10,
                borderRadius: '50%',
                background: isThird ? 'radial-gradient(circle, #fff, #ef4444)' : isEven ? 'radial-gradient(circle, #fff7cc, #fbbf24)' : 'radial-gradient(circle, #fff, #fbbf24)',
                boxShadow: isThird ? '0 0 8px #ef4444, 0 0 16px rgba(239,68,68,0.5)' : '0 0 8px #fbbf24, 0 0 16px rgba(251,191,36,0.5)',
                animation: `ledBlink${isEven ? 'A' : 'B'} 1.2s ease-in-out ${i * 0.04}s infinite`,
              }} />
            );
          })}
        </div>

        {/* ═══ GEM BEADS ═══ */}
        <div className="absolute pointer-events-none" style={{
          top: 30 - 18, left: 20 - 18,
          width: wheelSize + 36, height: wheelSize + 36,
        }}>
          {gemPositions.map((gem, i) => {
            const angleRad = (gem.angle - 90) * Math.PI / 180;
            const r = (wheelSize + 36) / 2;
            const cx = r + r * Math.cos(angleRad);
            const cy = r + r * Math.sin(angleRad);
            const gemSize = i < 4 ? 14 : 10; // cardinal gems are bigger
            return (
              <div key={gem.name} className="absolute" style={{
                left: cx - gemSize / 2, top: cy - gemSize / 2,
                width: gemSize, height: gemSize,
                borderRadius: i < 4 ? '3px' : '50%',
                transform: i < 4 ? 'rotate(45deg)' : 'none',
                background: `radial-gradient(ellipse at 30% 25%, ${gem.highlight}, ${gem.color})`,
                boxShadow: `0 0 8px ${gem.color}, 0 0 16px ${gem.color}40, inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.4)`,
                animation: `gemSparkle 2.5s ease-in-out ${i * 0.3}s infinite`,
                zIndex: 5,
              }} />
            );
          })}
        </div>

        {/* Needle / Pointer */}
        <div ref={needleRef} className="absolute top-0 left-1/2 z-20" style={{
          transform: 'translateX(-50%) rotate(0deg)',
          transformOrigin: "50% 100%",
        }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: '16px solid transparent',
            borderRight: '16px solid transparent',
            borderTop: '35px solid #ef4444',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
          }} />
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: 'radial-gradient(circle, #fef3c7, #f59e0b)',
            margin: '-8px auto 0',
            boxShadow: '0 0 10px rgba(251,191,36,0.6)',
          }} />
        </div>

        {/* Canvas */}
        <canvas ref={canvasRef} width={wheelSize * 2} height={wheelSize * 2}
          style={{ width: wheelSize, height: wheelSize, position: 'absolute', top: 30, left: 20 }} />

        {/* ═══ DECORATION ANIMATIONS ═══ */}
        <style>{`
          @keyframes outerFrameGlow {
            0%, 100% { box-shadow: 0 0 30px rgba(251,191,36,0.4), 0 0 60px rgba(251,191,36,0.2), inset 0 0 20px rgba(251,191,36,0.3); }
            50% { box-shadow: 0 0 50px rgba(251,191,36,0.6), 0 0 100px rgba(251,191,36,0.3), inset 0 0 30px rgba(251,191,36,0.5); }
          }
          @keyframes ledBlinkA {
            0%, 100% { opacity: 1; transform: scale(1.1); filter: brightness(1.3); }
            50% { opacity: 0.25; transform: scale(0.6); filter: brightness(0.6); }
          }
          @keyframes ledBlinkB {
            0%, 100% { opacity: 0.25; transform: scale(0.6); filter: brightness(0.6); }
            50% { opacity: 1; transform: scale(1.1); filter: brightness(1.3); }
          }
          @keyframes gemSparkle {
            0%, 100% { opacity: 0.8; filter: brightness(1); }
            25% { opacity: 1; filter: brightness(1.5); }
            50% { opacity: 0.9; filter: brightness(1.2); }
            75% { opacity: 1; filter: brightness(1.8); }
          }
        `}</style>
      </div>

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div key={countdown} className="text-8xl font-black text-yellow-400" style={{
            textShadow: '0 0 40px rgba(251,191,36,0.8), 0 0 80px rgba(251,191,36,0.4)',
            animation: 'countdownPop 0.8s ease-out',
          }}>{countdown}</div>
          <style>{`@keyframes countdownPop { 0% { transform: scale(2); opacity: 0; } 30% { transform: scale(0.9); opacity: 1; } 50% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 0.3; } }`}</style>
        </div>
      )}

      {/* Spin button - tap to start immediately, or auto-starts */}
      {phase === 'ready' && (
        <StaggerReveal delay={300} duration={600}>
          <BounceButton onClick={startCountdown}
            className="mt-4 px-10 py-4 rounded-full text-lg font-black text-white"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 4px 20px rgba(245,158,11,0.5)' }}>
            🎰 タップでスピン開始
          </BounceButton>
          {autoStart && (
            <p className="text-center text-yellow-400/60 text-xs mt-2 animate-pulse">まもなく自動スタート...</p>
          )}
        </StaggerReveal>
      )}

      {phase === 'spinning' && (
        <p className="mt-4 text-yellow-400/80 font-bold animate-pulse">ルーレット回転中...</p>
      )}

      {/* Done phase - show "大当たり！" text while wheel is displayed */}
      {phase === 'done' && (
        <div className="mt-4 text-center" style={{ animation: 'jackpotFlash 0.5s ease-out' }}>
          <div className="text-3xl font-black text-yellow-400" style={{
            textShadow: '0 0 20px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.4), 0 2px 4px rgba(0,0,0,0.5)',
          }}>🎯 大当たり！</div>
          <div className="text-xl font-bold text-white mt-1" style={{
            textShadow: '0 0 15px rgba(255,255,255,0.5)',
          }}>{items[targetIndex]?.label} GET!</div>
          <style>{`@keyframes jackpotFlash { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }`}</style>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CELEBRATION INTRO - Between stages
   ═══════════════════════════════════════════════════════════════ */
function CelebrationIntro({ round, onDone }: { round: number; onDone: () => void }) {
  useEffect(() => {
    sfx.playCelebration();
    haptic.celebration();
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  const config = getRoundConfig(round);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Confetti count={60} />
      <div style={{ animation: 'celebIntro 0.6s ease-out' }}>
        <div className="text-6xl mb-4" style={{ animation: 'bounce 1s ease-in-out infinite' }}>🎊</div>
        <h2 className="text-2xl font-black text-yellow-400 mb-2">招待完了おめでとう！</h2>
        <p className="text-gray-300 mb-4">お祝いボーナスルーレット発動！</p>
        <div className="text-5xl font-black" style={{ color: config.tierColor, textShadow: `0 0 30px ${config.tierGlow}` }}>
          {config.tierEmoji} {config.tier}
        </div>
        <p className="text-gray-400 mt-4 animate-pulse">ルーレット準備中...</p>
      </div>
      <style>{`@keyframes celebIntro { 0% { transform: scale(0.5) rotate(-5deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARE SHEET
   ═══════════════════════════════════════════════════════════════ */
function ShareSheet({ onClose }: { onClose: () => void }) {
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + '/invite?ref=demo' : '';
  const shareText = '🎁 LCJ MALLで最大5,000ptもらえるチャンス！今すぐチェック！';
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
  const copy = async () => { await navigator.clipboard.writeText(shareUrl); haptic.success(); sfx.playButtonClick(); };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-gray-900 rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}>
        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white text-center mb-4">友達を招待する</h3>
        <div className="grid grid-cols-3 gap-3">
          <a href={lineUrl} target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#06C755]/10 hover:bg-[#06C755]/20 transition"
            onClick={() => { sfx.playButtonClick(); haptic.tap(); }}>
            <div className="w-12 h-12 rounded-full bg-[#06C755] flex items-center justify-center text-white text-xl font-bold">L</div>
            <span className="text-xs text-gray-300">LINE</span>
          </a>
          <button onClick={copy}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl">📋</div>
            <span className="text-xs text-gray-300">コピー</span>
          </button>
          <button onClick={() => { if (navigator.share) navigator.share({ title: 'LCJ MALL', text: shareText, url: shareUrl }); sfx.playButtonClick(); haptic.tap(); }}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition">
            <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white text-xl">📤</div>
            <span className="text-xs text-gray-300">その他</span>
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
type Phase = 'spin' | 'win' | 'invite' | 'celebIntro' | 'bonusSpin' | 'bonusWin';

export default function SpinDemo() {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('spin');
  const [totalPts, setTotalPts] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [audioInit, setAudioInit] = useState(false);
  const [showCoins, setShowCoins] = useState(false);

  const config = getRoundConfig(round);
  const items = getSpinItems(round);
  const targetIndex = 4;

  // Count up for WIN screens
  const displayPts = useCountUp(
    phase === 'win' ? config.jackpot : phase === 'bonusWin' ? getRoundConfig(round).jackpot : 0,
    2000, 800
  );
  const displayTotal = useCountUp(totalPts, 1500, 1200);

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
    setPhase('win');
  }, []);

  const handleClaimWin = useCallback(() => {
    sfx.playTransition();
    haptic.tap();
    setTotalPts(prev => prev + config.jackpot);
    setPhase('invite');
  }, [config.jackpot]);

  const handleSimulateInvite = useCallback(() => {
    sfx.playCelebration();
    haptic.celebration();
    setTotalPts(prev => prev + config.fixedReward);
    setPhase('celebIntro');
  }, [config.fixedReward]);

  const handleCelebDone = useCallback(() => {
    setRound(prev => prev + 1);
    setPhase('bonusSpin');
  }, []);

  const handleBonusSpinComplete = useCallback(() => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 600);
    setShowConfetti(true);
    setShowFireworks(true);
    setShowCoins(true);
    setTimeout(() => { setShowConfetti(false); setShowFireworks(false); }, 4000);
    setTimeout(() => setShowCoins(false), 5000);
    sfx.playSuperJackpot();
    haptic.grandCelebration();
    setPhase('bonusWin');
  }, []);

  const handleClaimBonus = useCallback(() => {
    sfx.playTransition();
    haptic.tap();
    setTotalPts(prev => prev + getRoundConfig(round).jackpot);
    setPhase('invite');
  }, [round]);

  const initAudioOnce = useCallback(() => {
    if (!audioInit) { sfx.initAudio(); setAudioInit(true); }
  }, [audioInit]);

  const nextConfig = getRoundConfig(round + 1);

  return (
    <div className="min-h-screen text-white overflow-hidden relative" style={{ background: config.bgGradient }} onClick={initAudioOnce}>
      <FloatingParticles tier={config.tier} />
      {showConfetti && <Confetti count={100} />}
      {showFireworks && <Fireworks count={10} />}
      {showFlash && <ScreenFlash color={config.tierColor} />}
      {showCoins && <FallingCoins />}

      {/* Header with LCJ MALL logo */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3">
        <LCJLogo size="md" />
        {totalPts > 0 && (
          <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-3 py-1">
            <span className="text-yellow-400 text-xs">🏆</span>
            <span className="text-yellow-400 font-bold text-sm">{totalPts.toLocaleString()}pt</span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="relative z-10 px-4 pb-8">

        {/* ── PHASE: SPIN ── */}
        {phase === 'spin' && (
          <div className="flex flex-col items-center pt-2">
            <StaggerReveal delay={100} duration={500}>
              <div className="text-center mb-2">
                <div className="text-xs text-yellow-400/60 font-bold tracking-widest mb-1">✨ 新規ユーザー限定オファー ✨</div>
                <h1 className="text-2xl font-black text-white mb-1">スピンして<span style={{ color: config.tierColor }}>ポイントGET</span></h1>
                <p className="text-gray-400 text-sm">最大 <span className="text-yellow-400 font-bold">{config.jackpot.toLocaleString()}pt</span> が当たる！</p>
              </div>
            </StaggerReveal>

            <LuxurySpinWheel items={items} onComplete={handleSpinComplete} targetIndex={targetIndex}
              tierColor={config.tierColor} onCountdownStart={initAudioOnce} autoStart={true} />

            <StaggerReveal delay={600} duration={500}>
              <p className="text-center text-gray-500 text-xs mt-4 max-w-xs">
                この画面は参考用のデモです。すべてのお客様がトップ報酬を獲得できます。
              </p>
            </StaggerReveal>
          </div>
        )}

        {/* ── PHASE: WIN ── */}
        {phase === 'win' && (
          <div className="flex flex-col items-center pt-4">
            <GodRays color={config.tierColor} />
            <SparkleRing />
            <GlowCard glowColor={`${config.tierColor}, transparent, ${config.tierColor}, transparent`}>
              <div className="p-6 text-center">
                <StaggerReveal delay={200} duration={600}>
                  <div className="text-5xl mb-2">🏆</div>
                </StaggerReveal>
                <StaggerReveal delay={500} duration={600}>
                  <h2 className="text-2xl font-black mb-1" style={{ color: config.tierColor, textShadow: `0 0 20px ${config.tierGlow}` }}>
                    {config.tier}
                  </h2>
                  <p className="text-gray-300 text-sm mb-3">超大当たり！おめでとう！</p>
                </StaggerReveal>
                <StaggerReveal delay={800} duration={800}>
                  <div className="rounded-xl py-4 px-6 mb-3" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                    <span className="text-white/80 text-lg">+</span>
                    <span className="text-white text-5xl font-black">{displayPts.toLocaleString()}</span>
                    <span className="text-white/80 text-2xl font-bold ml-1">pt</span>
                  </div>
                </StaggerReveal>
                <StaggerReveal delay={1500} duration={500}>
                  <CountdownTimer />
                </StaggerReveal>
                <StaggerReveal delay={2000} duration={600}>
                  <BounceButton onClick={handleClaimWin}
                    className="w-full mt-4 py-4 rounded-xl text-lg font-black text-white"
                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>
                    🎁 今すぐ受け取る！
                  </BounceButton>
                </StaggerReveal>
              </div>
            </GlowCard>
          </div>
        )}

        {/* ── PHASE: INVITE ── */}
        {phase === 'invite' && (
          <div className="flex flex-col items-center pt-2">
            {/* Current jackpot badge */}
            <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-4 py-2 mb-3">
              <span>🏆</span>
              <span className="text-yellow-400 font-bold">{config.jackpot.toLocaleString()}pt 当選済み ✓</span>
            </div>
            <p className="text-yellow-400 font-bold text-sm mb-4">これまでの獲得: {totalPts.toLocaleString()}pt</p>

            <h2 className="text-xl font-black mb-1" style={{ color: config.tierColor }}>次の特典を受け取ろう！</h2>
            <p className="text-gray-400 text-sm mb-4">友達を招待してポイントを解放しよう</p>

            {/* Current step */}
            <div className="w-full max-w-sm bg-gray-800/50 border border-yellow-400/20 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: `linear-gradient(135deg, ${config.tierColor}, ${config.tierGlow})` }}>👥</div>
                  <div>
                    <p className="font-bold text-white">友達を{config.inviteRequired}人招待</p>
                    <p className="text-xs text-gray-400">さらに+{config.fixedReward}pt解放！</p>
                  </div>
                </div>
                <span className="font-black text-lg" style={{ color: config.tierColor }}>+{config.fixedReward}pt</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: '0%', background: `linear-gradient(90deg, ${config.tierColor}, #fbbf24)` }} />
              </div>
              <p className="text-right text-xs text-gray-500 mt-1">0/{config.inviteRequired}人</p>
            </div>

            {/* Next round preview */}
            <div className="w-full max-w-sm bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 mb-4 opacity-60">
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <span className="text-2xl">🎁🎁🎁</span>
              </div>
              <p className="text-center text-gray-500 text-sm mt-2">この先にもっと大きな特典が...</p>
              <p className="text-center text-gray-600 text-xs">✨ ステップをクリアして解放しよう</p>
            </div>

            {/* Share button */}
            <BounceButton onClick={() => { setShowShare(true); sfx.playButtonClick(); haptic.tap(); }}
              className="w-full max-w-sm py-4 rounded-xl text-lg font-black text-white"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>
              🎉 友達を招待して受け取る！
            </BounceButton>

            <CountdownTimer />

            {/* Social proof */}
            <div className="mt-4 w-full max-w-sm bg-orange-500/10 border border-orange-500/30 rounded-full py-2 px-4 text-center">
              <span className="text-orange-400 text-sm">🔥 {(2800 + Math.floor(Math.random() * 200)).toLocaleString()}人が参加中</span>
            </div>

            {/* Progress bar to max */}
            <div className="w-full max-w-sm mt-2">
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div className="h-3 rounded-full bg-gradient-to-r from-green-500 to-yellow-400 transition-all" style={{ width: `${Math.min((totalPts / (totalPts + config.jackpot)) * 100, 95)}%` }} />
              </div>
              <p className="text-right text-xs text-gray-500 mt-1">{totalPts.toLocaleString()}/{(totalPts + config.jackpot).toLocaleString()}pt</p>
            </div>

            {/* Demo controls */}
            <div className="mt-6 w-full max-w-sm">
              <p className="text-center text-gray-600 text-xs mb-2">🎮 デモ操作</p>
              <button onClick={handleSimulateInvite}
                className="w-full py-3 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 transition">
                🎮 友達{config.inviteRequired}人招待完了をシミュレート
              </button>
            </div>
          </div>
        )}

        {/* ── PHASE: CELEB INTRO ── */}
        {phase === 'celebIntro' && <CelebrationIntro round={round + 1} onDone={handleCelebDone} />}

        {/* ── PHASE: BONUS SPIN ── */}
        {phase === 'bonusSpin' && (
          <div className="flex flex-col items-center pt-2">
            <StaggerReveal delay={100} duration={500}>
              <div className="text-center mb-2">
                <div className="text-xs font-bold tracking-widest mb-1" style={{ color: getRoundConfig(round).tierColor }}>🎰 ボーナスチャンス発動！ 🎰</div>
                <h1 className="text-2xl font-black text-white mb-1">
                  {getRoundConfig(round).tierEmoji} <span style={{ color: getRoundConfig(round).tierColor }}>{getRoundConfig(round).tier}</span>
                </h1>
                <p className="text-gray-400 text-sm">さらに大きな報酬のチャンス！</p>
              </div>
            </StaggerReveal>

            <LuxurySpinWheel items={getSpinItems(round)} onComplete={handleBonusSpinComplete} targetIndex={targetIndex}
              tierColor={getRoundConfig(round).tierColor} onCountdownStart={initAudioOnce} autoStart={true} />
          </div>
        )}

        {/* ── PHASE: BONUS WIN ── */}
        {phase === 'bonusWin' && (
          <div className="flex flex-col items-center pt-4">
            <GodRays color={getRoundConfig(round).tierColor} />
            <SparkleRing />
            <GlowCard glowColor={`${getRoundConfig(round).tierColor}, transparent, ${getRoundConfig(round).tierColor}, transparent`}>
              <div className="p-6 text-center">
                <StaggerReveal delay={200} duration={600}>
                  <div className="text-5xl mb-2">{getRoundConfig(round).tierEmoji}</div>
                </StaggerReveal>
                <StaggerReveal delay={500} duration={600}>
                  <h2 className="text-2xl font-black mb-1" style={{ color: getRoundConfig(round).tierColor, textShadow: `0 0 20px ${getRoundConfig(round).tierGlow}` }}>
                    {getRoundConfig(round).tier}
                  </h2>
                  <p className="text-gray-300 text-sm mb-1">さらに大当たり！</p>
                </StaggerReveal>
                <StaggerReveal delay={800} duration={800}>
                  <div className="rounded-xl py-4 px-6 mb-2" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                    <span className="text-white/80 text-lg">+</span>
                    <span className="text-white text-5xl font-black">{displayPts.toLocaleString()}</span>
                    <span className="text-white/80 text-2xl font-bold ml-1">pt</span>
                  </div>
                </StaggerReveal>
                <StaggerReveal delay={1200} duration={500}>
                  <div className="text-center mb-2">
                    <p className="text-sm"><span className="text-yellow-400">🎯 累計獲得可能:</span> <span className="text-yellow-300 font-black text-lg">{(totalPts + getRoundConfig(round).jackpot).toLocaleString()}pt</span></p>
                    <p className="text-gray-400 text-xs">さらに{getRoundConfig(round).jackpot.toLocaleString()}ポイントが当選！</p>
                  </div>
                </StaggerReveal>
                <StaggerReveal delay={1500} duration={500}>
                  <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 mb-3">
                    <p className="text-yellow-400 text-sm font-bold">💡 この{getRoundConfig(round).jackpot.toLocaleString()}ptを受け取るには</p>
                    <p className="text-gray-300 text-xs">あと{getRoundConfig(round).inviteRequired}人の友達を招待しよう！</p>
                  </div>
                </StaggerReveal>
                <StaggerReveal delay={1800} duration={500}>
                  <CountdownTimer />
                </StaggerReveal>
                <StaggerReveal delay={2200} duration={600}>
                  <BounceButton onClick={handleClaimBonus}
                    className="w-full mt-4 py-4 rounded-xl text-lg font-black text-white"
                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>
                    🎁 今すぐ受け取る！
                  </BounceButton>
                </StaggerReveal>
              </div>
            </GlowCard>
          </div>
        )}
      </div>

      {/* Share sheet */}
      {showShare && <ShareSheet onClose={() => setShowShare(false)} />}

      {/* LCJ MALL footer branding */}
      <div className="fixed bottom-0 left-0 right-0 z-10 flex justify-center py-2 bg-gradient-to-t from-black/80 to-transparent">
        <LCJLogo size="sm" />
      </div>
    </div>
  );
}
