import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import haptic from "@/lib/haptic";
import sfx from "@/lib/soundEffects";

/* ═══════════════════════════════════════════════════════════════
   VISUAL EFFECTS - Shared across SpinDemo and FriendReferralChallenge
   ═══════════════════════════════════════════════════════════════ */

export function Confetti({ count = 80 }: { count?: number }) {
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

export function Fireworks({ count = 8 }: { count?: number }) {
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

export function ScreenFlash({ color }: { color: string }) {
  return <div className="fixed inset-0 z-50 pointer-events-none" style={{ background: color, animation: "flashOut 0.6s ease-out forwards" }}>
    <style>{`@keyframes flashOut { 0% { opacity: 0.8; } 100% { opacity: 0; } }`}</style>
  </div>;
}

export function FallingCoins() {
  const coins = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 2,
    duration: 2.5 + Math.random() * 2, size: 28 + Math.random() * 24,
    rotation: Math.random() * 360, wobble: 10 + Math.random() * 30,
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
          left: `${c.left}%`, top: '-80px', width: `${c.size}px`, height: `${c.size}px`,
          animation: `coinFall ${c.duration}s ease-in ${c.delay}s forwards`,
          '--wobble': `${c.wobble}px`,
        } as React.CSSProperties}>
          <div style={{ width: '100%', height: '100%', animation: `coinSpin3D ${c.spinSpeed}s linear infinite`, transformStyle: 'preserve-3d' }}>
            <svg viewBox="0 0 100 100" width={c.size} height={c.size}>
              <defs>
                <radialGradient id={`coinGrad${c.id}`} cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#fff7cc" /><stop offset="30%" stopColor="#ffd700" />
                  <stop offset="70%" stopColor="#daa520" /><stop offset="100%" stopColor="#b8860b" />
                </radialGradient>
                <radialGradient id={`coinShine${c.id}`} cx="30%" cy="25%" r="40%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.8)" /><stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="48" fill="#b8860b" />
              <circle cx="50" cy="50" r="45" fill={`url(#coinGrad${c.id})`} />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#daa520" strokeWidth="2" />
              <text x="50" y="58" textAnchor="middle" fontSize="36" fontWeight="bold" fill="#8B6914" fontFamily="Arial, sans-serif">¥</text>
              <text x="50" y="58" textAnchor="middle" fontSize="36" fontWeight="bold" fill="#DAA520" fontFamily="Arial, sans-serif" opacity="0.6">¥</text>
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

export function FloatingParticles({ tier }: { tier?: string }) {
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

export function GodRays({ color }: { color: string }) {
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

export function SparkleRing({ count = 24 }: { count?: number }) {
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

export function StaggerReveal({ children, delay, duration }: { children: React.ReactNode; delay: number; duration: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.9)", transition: `all ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}>{children}</div>;
}

export function GlowCard({ children, glowColor }: { children: React.ReactNode; glowColor: string }) {
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

export function useCountUp(target: number, duration: number = 2000, startDelay: number = 0) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const timeout = setTimeout(() => {
      const start = performance.now();
      const from = prevRef.current;
      let soundInterval: ReturnType<typeof setInterval> | null = null;
      soundInterval = setInterval(() => sfx.playCountUp(), 50);
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(from + (target - from) * eased);
        setValue(current);
        if (progress < 1) requestAnimationFrame(animate);
        else { prevRef.current = target; if (soundInterval) clearInterval(soundInterval); sfx.playCountUpComplete(); }
      };
      requestAnimationFrame(animate);
    }, startDelay);
    return () => clearTimeout(timeout);
  }, [target, duration, startDelay]);
  return value;
}

/* ═══════════════════════════════════════════════════════════════
   LUXURY SPIN WHEEL - Premium Casino Style
   ═══════════════════════════════════════════════════════════════ */
export default function LuxurySpinWheel({ items, onComplete, targetIndex, tierColor, onCountdownStart, autoStart = false }: {
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
  const drawWheel = useCallback((ctx: CanvasRenderingContext2D, size: number, currentAngle: number, highlightWin: boolean = false) => {
    const center = size / 2;
    const radius = size / 2 - 8;
    const sliceAngle = (2 * Math.PI) / items.length;

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
    ctx.rotate(currentAngle);

    const colors = [
      ["#fbbf24", "#f59e0b", "#d97706"], ["#fef3c7", "#fde68a", "#fcd34d"],
      ["#92400e", "#78350f", "#451a03"], ["#fbbf24", "#f59e0b", "#d97706"],
      ["#fef3c7", "#fde68a", "#fcd34d"], ["#92400e", "#78350f", "#451a03"],
      ["#fbbf24", "#f59e0b", "#d97706"], ["#fef3c7", "#fde68a", "#fcd34d"],
    ];

    for (let i = 0; i < items.length; i++) {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 8, startAngle, endAngle);
      ctx.closePath();

      const c = colors[i % colors.length];
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius - 8);
      grad.addColorStop(0, c[0]); grad.addColorStop(0.5, c[1]); grad.addColorStop(1, c[2]);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(251,191,36,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text - radial layout along slice center line
      const midAngle = startAngle + sliceAngle / 2;

      // Determine text color based on background
      const isDark = i % 3 === 2; // dark brown slices
      const textColor = isDark ? "#fef3c7" : "#1a1000";

      // Clip to this slice so text never bleeds into neighbors
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 8, startAngle, endAngle);
      ctx.closePath();
      ctx.clip();

      // Rotate to slice center line, then draw text along the radius
      ctx.save();
      ctx.rotate(midAngle);

      // Check if this slice is in the left half of the wheel (text would be upside down)
      // midAngle includes -PI/2 offset, so normalize to 0..2PI
      let normAngle = midAngle % (2 * Math.PI);
      if (normAngle < 0) normAngle += 2 * Math.PI;
      // Left half: angles between PI/2 and 3*PI/2 (pointing left)
      const isLeftHalf = normAngle > Math.PI / 2 && normAngle < Math.PI * 3 / 2;

      // Font sizes relative to radius
      const emojiSize = Math.round(radius * 0.08);
      const labelSize = Math.round(radius * 0.055);
      const jackpotLabelSize = Math.round(radius * 0.05);
      const jackpotValueSize = Math.round(radius * 0.06);

      if (isLeftHalf) {
        // For left-half slices: flip 180° and reverse text positions
        // so text reads from outer edge toward center
        if (i === targetIndex) {
          // Emoji at outer (but flipped, so negative x = outer)
          ctx.font = `${emojiSize}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#000";
          ctx.save(); ctx.translate(radius * 0.78, 0); ctx.rotate(Math.PI); ctx.fillText(items[i].emoji, 0, 0); ctx.restore();
          // "大当たり"
          ctx.font = `bold ${jackpotLabelSize}px 'Arial', sans-serif`;
          ctx.fillStyle = "#ef4444";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1.5;
          ctx.save(); ctx.translate(radius * 0.6, 0); ctx.rotate(Math.PI); ctx.strokeText("大当たり", 0, 0); ctx.fillText("大当たり", 0, 0); ctx.restore();
          // Value
          const jackpotLabel = items[i].label.length > 8 ? items[i].label.slice(0, 8) : items[i].label;
          ctx.font = `bold ${jackpotValueSize}px 'Arial', sans-serif`;
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;
          ctx.save(); ctx.translate(radius * 0.4, 0); ctx.rotate(Math.PI); ctx.strokeText(jackpotLabel, 0, 0); ctx.fillText(jackpotLabel, 0, 0); ctx.restore();
        } else {
          // Emoji
          ctx.font = `${emojiSize}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#000";
          ctx.save(); ctx.translate(radius * 0.75, 0); ctx.rotate(Math.PI); ctx.fillText(items[i].emoji, 0, 0); ctx.restore();
          // Label
          const displayLabel = items[i].label.length > 8 ? items[i].label.slice(0, 8) : items[i].label;
          ctx.font = `bold ${labelSize}px 'Arial', sans-serif`;
          ctx.fillStyle = textColor;
          ctx.save(); ctx.translate(radius * 0.5, 0); ctx.rotate(Math.PI); ctx.fillText(displayLabel, 0, 0); ctx.restore();
        }
      } else {
        // Right-half slices: text reads naturally from outer to inner
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (i === targetIndex) {
          ctx.font = `${emojiSize}px serif`;
          ctx.fillStyle = "#000";
          ctx.fillText(items[i].emoji, radius * 0.78, 0);
          ctx.font = `bold ${jackpotLabelSize}px 'Arial', sans-serif`;
          ctx.fillStyle = "#ef4444";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1.5;
          ctx.strokeText("大当たり", radius * 0.6, 0);
          ctx.fillText("大当たり", radius * 0.6, 0);
          const jackpotLabel = items[i].label.length > 8 ? items[i].label.slice(0, 8) : items[i].label;
          ctx.font = `bold ${jackpotValueSize}px 'Arial', sans-serif`;
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;
          ctx.strokeText(jackpotLabel, radius * 0.4, 0);
          ctx.fillText(jackpotLabel, radius * 0.4, 0);
        } else {
          ctx.font = `${emojiSize}px serif`;
          ctx.fillStyle = "#000";
          ctx.fillText(items[i].emoji, radius * 0.75, 0);
          const displayLabel = items[i].label.length > 8 ? items[i].label.slice(0, 8) : items[i].label;
          ctx.font = `bold ${labelSize}px 'Arial', sans-serif`;
          ctx.fillStyle = textColor;
          ctx.fillText(displayLabel, radius * 0.5, 0);
        }
      }

      ctx.restore(); // undo rotate(midAngle)
      ctx.restore(); // undo clip
    }

    // Highlight winning segment
    if (highlightWin) {
      const winStart = targetIndex * sliceAngle - Math.PI / 2;
      const winEnd = winStart + sliceAngle;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 8, winStart, winEnd);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 8, winStart, winEnd);
      ctx.closePath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 25;
      ctx.stroke();
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

    // Center hub
    const hubRadius = radius * 0.18;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(center, center, hubRadius + 4, 0, 2 * Math.PI);
    const hubBorderGrad = ctx.createLinearGradient(center - hubRadius, center - hubRadius, center + hubRadius, center + hubRadius);
    hubBorderGrad.addColorStop(0, "#fbbf24"); hubBorderGrad.addColorStop(0.5, "#fef3c7"); hubBorderGrad.addColorStop(1, "#d97706");
    ctx.fillStyle = hubBorderGrad;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(center, center, hubRadius, 0, 2 * Math.PI);
    const hubGrad = ctx.createRadialGradient(center - 5, center - 5, 0, center, center, hubRadius);
    hubGrad.addColorStop(0, "#1a1000"); hubGrad.addColorStop(1, "#0a0500");
    ctx.fillStyle = hubGrad;
    ctx.fill();

    ctx.fillStyle = "#fbbf24";
    ctx.font = `bold ${Math.round(hubRadius * 0.55)}px 'Arial', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", center, center - 4);
    ctx.font = `bold ${Math.round(hubRadius * 0.35)}px 'Arial', sans-serif`;
    ctx.fillStyle = "#fde68a";
    ctx.fillText("& WIN", center, center + hubRadius * 0.4);
  }, [items, targetIndex]);

  // Initial draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawWheel(ctx, canvas.width, angleRef.current);
  }, [drawWheel]);

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
    const sliceAngle = (2 * Math.PI) / items.length;

    const targetAngle = (2 * Math.PI) - (targetIndex + 0.5) * sliceAngle;
    const jitter = (Math.random() - 0.5) * sliceAngle * 0.5;
    const fullSpins = Math.PI * 2 * (6 + Math.floor(Math.random() * 3));
    const totalRotation = fullSpins + targetAngle + jitter;
    const duration = 5000 + Math.random() * 1000;
    const start = performance.now();
    let lastTickAngle = 0;

    const animateSpin = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      angleRef.current = eased * totalRotation;

      const currentSlice = Math.floor((angleRef.current % (Math.PI * 2)) / sliceAngle);
      const lastSlice = Math.floor((lastTickAngle % (Math.PI * 2)) / sliceAngle);
      if (currentSlice !== lastSlice) {
        const speed = 1 - progress;
        sfx.playTick(speed);
        haptic.tick();
        if (needleRef.current) {
          const maxAngle = 18 * speed + 5;
          const el = needleRef.current;
          el.style.transition = 'none';
          el.style.transform = `translateX(-50%) rotate(${maxAngle}deg)`;
          requestAnimationFrame(() => {
            el.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
            el.style.transform = 'translateX(-50%) rotate(0deg)';
          });
        }
      }
      lastTickAngle = angleRef.current;

      // Redraw with blinking studs during spin
      const center = size / 2;
      const radius = size / 2 - 8;
      drawWheel(ctx, size, angleRef.current);

      // Blinking studs overlay during spin
      if (progress < 0.9) {
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * 2 * Math.PI;
          const x = center + (radius + 1) * Math.cos(angle);
          const y = center + (radius + 1) * Math.sin(angle);
          const blink = Math.sin(elapsed * 0.01 + i) > 0;
          if (blink) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(255,255,200,0.8)";
            ctx.fill();
          }
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        spinningRef.current = false;
        // Redraw with highlight
        drawWheel(ctx, size, angleRef.current, true);
        setPhase("done");
        sfx.playWinFanfare();
        haptic.result();
        setTimeout(() => onComplete(), 3000);
      }
    };
    requestAnimationFrame(animateSpin);
  }, [items, targetIndex, onComplete, drawWheel]);

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

  // Eagerly init audio on any touch/click
  useEffect(() => {
    const initOnTouch = () => { sfx.initAudio(); };
    document.addEventListener('touchstart', initOnTouch, { once: true, passive: true });
    document.addEventListener('click', initOnTouch, { once: true });
    return () => {
      document.removeEventListener('touchstart', initOnTouch);
      document.removeEventListener('click', initOnTouch);
    };
  }, []);

  // Auto-start countdown
  useEffect(() => {
    if (autoStart && !autoStartedRef.current && phase === 'ready') {
      autoStartedRef.current = true;
      const timer = setTimeout(() => { startCountdown(); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoStart, phase, startCountdown]);

  const wheelSize = Math.min(340, typeof window !== "undefined" ? window.innerWidth - 40 : 300);
  const ledCount = 32;

  const gemPositions = useMemo(() => [
    { angle: 0, color: '#ef4444', highlight: '#fca5a5', name: 'ruby' },
    { angle: 90, color: '#3b82f6', highlight: '#93c5fd', name: 'sapphire' },
    { angle: 180, color: '#22c55e', highlight: '#86efac', name: 'emerald' },
    { angle: 270, color: '#a855f7', highlight: '#d8b4fe', name: 'amethyst' },
    { angle: 45, color: '#fbbf24', highlight: '#fef3c7', name: 'topaz1' },
    { angle: 135, color: '#ec4899', highlight: '#fbcfe8', name: 'pink1' },
    { angle: 225, color: '#fbbf24', highlight: '#fef3c7', name: 'topaz2' },
    { angle: 315, color: '#ec4899', highlight: '#fbcfe8', name: 'pink2' },
  ], []);

  return (
    <div className="flex flex-col items-center">
      {/* Wheel container with luxury decorations */}
      <div className="relative" style={{ width: wheelSize + 40, height: wheelSize + 60 }}>

        {/* Outer luxury frame */}
        <div className="absolute" style={{
          top: 30 - 18, left: 20 - 18, width: wheelSize + 36, height: wheelSize + 36, borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #fbbf24, #fef3c7, #d97706, #fbbf24, #fef3c7, #b45309, #fbbf24, #fef3c7, #d97706, #fbbf24)',
          boxShadow: '0 0 30px rgba(251,191,36,0.4), 0 0 60px rgba(251,191,36,0.2), inset 0 0 20px rgba(251,191,36,0.3)',
          animation: 'outerFrameGlow 3s ease-in-out infinite',
        }} />
        <div className="absolute" style={{
          top: 30 - 12, left: 20 - 12, width: wheelSize + 24, height: wheelSize + 24, borderRadius: '50%',
          background: 'conic-gradient(from 180deg, #d97706, #fef3c7, #fbbf24, #d97706, #fef3c7, #b45309, #d97706, #fef3c7, #fbbf24, #d97706)',
          boxShadow: 'inset 0 0 15px rgba(251,191,36,0.4)',
        }} />
        <div className="absolute" style={{
          top: 30 - 9, left: 20 - 9, width: wheelSize + 18, height: wheelSize + 18, borderRadius: '50%',
          background: '#1a0f00', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
        }} />

        {/* LED lights ring */}
        <div className="absolute pointer-events-none" style={{ top: 30 - 15, left: 20 - 15, width: wheelSize + 30, height: wheelSize + 30 }}>
          {Array.from({ length: ledCount }, (_, i) => {
            const angle = (i / ledCount) * 2 * Math.PI - Math.PI / 2;
            const r = (wheelSize + 30) / 2;
            const cx = r + r * Math.cos(angle);
            const cy = r + r * Math.sin(angle);
            const isEven = i % 2 === 0;
            const isThird = i % 3 === 0;
            return (
              <div key={i} className="absolute" style={{
                left: cx - 5, top: cy - 5, width: 10, height: 10, borderRadius: '50%',
                background: isThird ? 'radial-gradient(circle, #fff, #ef4444)' : isEven ? 'radial-gradient(circle, #fff7cc, #fbbf24)' : 'radial-gradient(circle, #fff, #fbbf24)',
                boxShadow: isThird ? '0 0 8px #ef4444, 0 0 16px rgba(239,68,68,0.5)' : '0 0 8px #fbbf24, 0 0 16px rgba(251,191,36,0.5)',
                animation: `ledBlink${isEven ? 'A' : 'B'} 1.2s ease-in-out ${i * 0.04}s infinite`,
              }} />
            );
          })}
        </div>

        {/* Gem beads */}
        <div className="absolute pointer-events-none" style={{ top: 30 - 18, left: 20 - 18, width: wheelSize + 36, height: wheelSize + 36 }}>
          {gemPositions.map((gem, i) => {
            const angleRad = (gem.angle - 90) * Math.PI / 180;
            const r = (wheelSize + 36) / 2;
            const cx = r + r * Math.cos(angleRad);
            const cy = r + r * Math.sin(angleRad);
            const gemSize = i < 4 ? 14 : 10;
            return (
              <div key={gem.name} className="absolute" style={{
                left: cx - gemSize / 2, top: cy - gemSize / 2, width: gemSize, height: gemSize,
                borderRadius: i < 4 ? '3px' : '50%', transform: i < 4 ? 'rotate(45deg)' : 'none',
                background: `radial-gradient(ellipse at 30% 25%, ${gem.highlight}, ${gem.color})`,
                boxShadow: `0 0 8px ${gem.color}, 0 0 16px ${gem.color}40, inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.4)`,
                animation: `gemSparkle 2.5s ease-in-out ${i * 0.3}s infinite`, zIndex: 5,
              }} />
            );
          })}
        </div>

        {/* Needle / Pointer */}
        <div ref={needleRef} className="absolute top-0 left-1/2 z-20" style={{ transform: 'translateX(-50%) rotate(0deg)', transformOrigin: "50% 100%" }}>
          <div style={{
            width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent',
            borderTop: '35px solid #ef4444', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
          }} />
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: 'radial-gradient(circle, #fef3c7, #f59e0b)', margin: '-8px auto 0',
            boxShadow: '0 0 10px rgba(251,191,36,0.6)',
          }} />
        </div>

        {/* Canvas */}
        <canvas ref={canvasRef} width={wheelSize * 2} height={wheelSize * 2}
          style={{ width: wheelSize, height: wheelSize, position: 'absolute', top: 30, left: 20 }} />

        {/* Decoration animations */}
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

      {/* Spin button */}
      {phase === 'ready' && (
        <StaggerReveal delay={300} duration={600}>
          <button onClick={startCountdown}
            className="mt-4 w-full max-w-xs py-4 rounded-full text-lg font-black text-white active:scale-95 transition-transform relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 4px 20px rgba(245,158,11,0.5)', animation: "btnBounce 2s ease-in-out infinite" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)", animation: "shimmerBtn 2.5s ease-in-out infinite" }} />
            <span className="relative z-10">🎰 無料でスピン</span>
            <style>{`
              @keyframes btnBounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
              @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
            `}</style>
          </button>
          {autoStart && (
            <p className="text-center text-yellow-400/60 text-xs mt-2 animate-pulse">まもなく自動スタート...</p>
          )}
        </StaggerReveal>
      )}

      {/* Countdown banner */}
      {phase === 'countdown' && (
        <div className="mt-4 w-full max-w-xs">
          <div className="relative py-4 rounded-full text-center font-black text-white text-lg"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 4px 20px rgba(245,158,11,0.5)' }}>
            <span>無料でスピン（</span>
            <span key={countdown} className="inline-block text-2xl" style={{
              animation: 'countdownBounce 0.5s ease-out', textShadow: '0 0 15px rgba(255,255,255,0.8)',
            }}>{countdown}</span>
            <span>秒）</span>
          </div>
          <style>{`@keyframes countdownBounce { 0% { transform: scale(2); opacity: 0.3; } 40% { transform: scale(0.8); } 100% { transform: scale(1); opacity: 1; } }`}</style>
        </div>
      )}

      {phase === 'spinning' && (
        <div className="mt-4 w-full max-w-xs py-3 rounded-full text-center font-bold text-white animate-pulse"
          style={{ background: 'linear-gradient(135deg, #f59e0b88, #ef444488)', border: '1px solid rgba(251,191,36,0.3)' }}>
          ルーレット回転中...
        </div>
      )}

      {/* Done phase */}
      {phase === 'done' && (
        <div className="mt-4 w-full max-w-sm text-center" style={{ animation: 'jackpotFlash 0.5s ease-out' }}>
          <div className="text-2xl font-black text-yellow-400 mb-1" style={{
            textShadow: '0 0 20px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.4), 0 2px 4px rgba(0,0,0,0.5)',
          }}>🎯 大当たり！</div>
          <div className="rounded-xl py-3 px-4" style={{
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            boxShadow: '0 0 30px rgba(245,158,11,0.5), 0 0 60px rgba(239,68,68,0.3)',
          }}>
            <span className="text-white/80 text-xl">+</span>
            <span className="text-white text-5xl font-black" style={{
              textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.3)',
            }}>{items[targetIndex]?.label.replace('pt', '')}</span>
            <span className="text-white/80 text-2xl font-bold ml-1">pt GET!</span>
          </div>
          <style>{`@keyframes jackpotFlash { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }`}</style>
        </div>
      )}
    </div>
  );
}
