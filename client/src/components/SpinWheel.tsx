import { useState, useRef, useCallback, useEffect } from "react";

interface SpinItem {
  id: number;
  label: string;
  emoji: string;
  points: number;
  color: string;
}

interface SpinWheelProps {
  items: SpinItem[];
  onSpinComplete: (item: SpinItem) => void;
  isSpinning: boolean;
  setIsSpinning: (v: boolean) => void;
  disabled?: boolean;
  isSpecial?: boolean;
}

export default function SpinWheel({ items, onSpinComplete, isSpinning, setIsSpinning, disabled, isSpecial }: SpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultItemRef = useRef<SpinItem | null>(null);

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || items.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const sliceAngle = (2 * Math.PI) / items.length;

    ctx.clearRect(0, 0, size, size);

    // Outer glow
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
    const glowGrad = ctx.createRadialGradient(center, center, radius - 4, center, center, radius + 8);
    glowGrad.addColorStop(0, isSpecial ? "rgba(168,85,247,0.3)" : "rgba(236,72,153,0.3)");
    glowGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glowGrad;
    ctx.fill();
    ctx.restore();

    // Outer ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 3, 0, 2 * Math.PI);
    const ringGrad = ctx.createLinearGradient(0, 0, size, size);
    if (isSpecial) {
      ringGrad.addColorStop(0, "#a855f7");
      ringGrad.addColorStop(0.5, "#ec4899");
      ringGrad.addColorStop(1, "#a855f7");
    } else {
      ringGrad.addColorStop(0, "#ec4899");
      ringGrad.addColorStop(0.5, "#f472b6");
      ringGrad.addColorStop(1, "#ec4899");
    }
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    // Draw slices
    items.forEach((item, i) => {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();

      const grad = ctx.createRadialGradient(center, center, 0, center, center, radius);
      grad.addColorStop(0, "rgba(255,255,255,0.15)");
      grad.addColorStop(0.6, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.1)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Divider lines
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + radius * Math.cos(startAngle), center + radius * Math.sin(startAngle));
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Text
      ctx.save();
      const textAngle = startAngle + sliceAngle / 2;
      const textRadius = radius * 0.62;
      ctx.translate(center + textRadius * Math.cos(textAngle), center + textRadius * Math.sin(textAngle));
      ctx.rotate(textAngle + Math.PI / 2);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(11, Math.floor(radius / 10))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 3;
      ctx.fillText(item.emoji, 0, -6);
      ctx.font = `bold ${Math.max(10, Math.floor(radius / 12))}px sans-serif`;
      ctx.fillText(item.label, 0, 10);
      ctx.restore();
    });

    // Center circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.18, 0, 2 * Math.PI);
    const centerGrad = ctx.createRadialGradient(center, center, 0, center, center, radius * 0.18);
    centerGrad.addColorStop(0, "#fff");
    centerGrad.addColorStop(1, "#fce7f3");
    ctx.fillStyle = centerGrad;
    ctx.fill();
    ctx.strokeStyle = isSpecial ? "#a855f7" : "#ec4899";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Decorative dots
    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI * 2) / 24;
      ctx.save();
      ctx.beginPath();
      ctx.arc(center + (radius + 8) * Math.cos(angle), center + (radius + 8) * Math.sin(angle), 3, 0, 2 * Math.PI);
      ctx.fillStyle = i % 2 === 0 ? (isSpecial ? "#c084fc" : "#f9a8d4") : "#fff";
      ctx.fill();
      ctx.restore();
    }
  }, [items, isSpecial]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  const spin = useCallback(() => {
    if (isSpinning || disabled || items.length === 0) return;
    setIsSpinning(true);
    const randomIndex = Math.floor(Math.random() * items.length);
    resultItemRef.current = items[randomIndex];
    const sliceAngle = 360 / items.length;
    const targetSlice = 360 - (randomIndex * sliceAngle + sliceAngle / 2);
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const newRotation = rotation + extraSpins * 360 + targetSlice;
    setRotation(newRotation);
    setTimeout(() => {
      setIsSpinning(false);
      if (resultItemRef.current) onSpinComplete(resultItemRef.current);
    }, 4500);
  }, [isSpinning, disabled, items, rotation, onSpinComplete, setIsSpinning]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Pointer */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
        <div className="w-0 h-0" style={{
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderTop: isSpecial ? "24px solid #a855f7" : "24px solid #ec4899",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
        }} />
      </div>

      {/* Wheel */}
      <div className="relative" style={{ width: 280, height: 280 }}>
        <div style={{
          transform: `rotate(${rotation}deg)`,
          transition: isSpinning ? "transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
          width: 280, height: 280,
        }}>
          <canvas ref={canvasRef} width={280} height={280} className="w-full h-full" />
        </div>
        {isSpinning && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute animate-ping" style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: "1s",
              }}>
                <span className="text-yellow-300 text-lg">✨</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={spin} disabled={isSpinning || disabled}
        className={`mt-4 px-8 py-3 rounded-full font-bold text-lg text-white shadow-lg transition-all transform
          ${isSpinning || disabled
            ? "opacity-50 cursor-not-allowed bg-gray-400"
            : isSpecial
              ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 hover:scale-105 active:scale-95"
              : "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 hover:scale-105 active:scale-95"
          }`}>
        {isSpinning ? (
          <span className="flex items-center gap-2"><span className="animate-spin">🌟</span>回転中...</span>
        ) : (
          <span className="flex items-center gap-2">🎰 ルーレットを回す！</span>
        )}
      </button>
    </div>
  );
}
