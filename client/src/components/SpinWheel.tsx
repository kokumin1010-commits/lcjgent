import { useState, useRef, useCallback, useEffect, useMemo } from "react";

/* ──── Haptic feedback utility ──── */
const canVibrate = () => typeof navigator !== "undefined" && "vibrate" in navigator;

const haptic = {
  /** Short tap – button press confirmation */
  tap: () => canVibrate() && navigator.vibrate(15),
  /** Medium pulse – spin start */
  spinStart: () => canVibrate() && navigator.vibrate([30, 20, 50, 20, 80]),
  /** Rhythmic ticking during spin (call repeatedly) */
  tick: () => canVibrate() && navigator.vibrate(8),
  /** Strong burst – result reveal */
  result: () => canVibrate() && navigator.vibrate([60, 40, 80, 40, 120, 50, 200]),
  /** Celebration – big win */
  celebration: () => canVibrate() && navigator.vibrate([50, 30, 50, 30, 80, 40, 80, 40, 120, 50, 200, 60, 300]),
  /** Stop any ongoing vibration */
  stop: () => canVibrate() && navigator.vibrate(0),
};

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
  const resultItemRef = useRef<SpinItem | null>(null);
  const wheelSize = 300;
  const center = wheelSize / 2;
  const outerR = center - 14;
  const n = items.length || 8;
  const sliceAngle = 360 / n;

  const ledCount = 28;
  const [ledPhase, setLedPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLedPhase((p) => (p + 1) % ledCount), 180);
    return () => clearInterval(id);
  }, []);

  // Tick vibration interval during spin
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup tick interval on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      haptic.stop();
    };
  }, []);

  const spin = useCallback(() => {
    if (isSpinning || disabled || items.length === 0) return;
    setIsSpinning(true);

    // ── Haptic: spin start burst ──
    haptic.spinStart();

    const randomIndex = Math.floor(Math.random() * items.length);
    resultItemRef.current = items[randomIndex];
    const targetSlice = 360 - (randomIndex * sliceAngle + sliceAngle / 2);
    const extraSpins = 6 + Math.floor(Math.random() * 3);
    const newRotation = rotation + extraSpins * 360 + targetSlice;
    setRotation(newRotation);

    // ── Haptic: rhythmic ticking that slows down ──
    // Fast ticks (100ms) for first 2s, medium (200ms) for next 1.5s, slow (400ms) for final 1.5s
    let tickSpeed = 100;
    tickIntervalRef.current = setInterval(() => haptic.tick(), tickSpeed);

    // Slow down ticking at 2s
    setTimeout(() => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      tickSpeed = 200;
      tickIntervalRef.current = setInterval(() => haptic.tick(), tickSpeed);
    }, 2000);

    // Slow down more at 3.5s
    setTimeout(() => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      tickSpeed = 400;
      tickIntervalRef.current = setInterval(() => haptic.tick(), tickSpeed);
    }, 3500);

    // Stop ticking and fire result haptic at 4.8s (just before result)
    setTimeout(() => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      // ── Haptic: result reveal burst ──
      const won = resultItemRef.current;
      if (won && won.points >= 100) {
        haptic.celebration();
      } else {
        haptic.result();
      }
    }, 4800);

    setTimeout(() => {
      setIsSpinning(false);
      if (resultItemRef.current) onSpinComplete(resultItemRef.current);
    }, 5000);
  }, [isSpinning, disabled, items, rotation, sliceAngle, onSpinComplete, setIsSpinning]);

  const segmentColors = useMemo(() => [
    "#FF4444", "#FFB800", "#FF6B35", "#FF1493",
    "#FF4444", "#FFB800", "#FF6B35", "#FF1493",
  ], []);

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative" style={{ width: wheelSize + 28, height: wheelSize + 28 }}>
        {Array.from({ length: ledCount }, (_, i) => {
          const angle = (i / ledCount) * 2 * Math.PI - Math.PI / 2;
          const r = (wheelSize + 28) / 2;
          const x = r + r * Math.cos(angle) * 0.94;
          const y = r + r * Math.sin(angle) * 0.94;
          const isLit = (i + ledPhase) % 3 === 0;
          return (
            <div key={i} className="absolute rounded-full" style={{
              left: x - 4, top: y - 4, width: 8, height: 8,
              backgroundColor: isLit ? (isSpecial ? "#c084fc" : "#fbbf24") : "rgba(255,255,255,0.15)",
              boxShadow: isLit ? `0 0 6px ${isSpecial ? "#c084fc" : "#fbbf24"}` : "none",
              transition: "all 0.15s",
            }} />
          );
        })}

        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20" style={{ top: 2 }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: "14px solid transparent", borderRight: "14px solid transparent",
            borderTop: `26px solid ${isSpecial ? "#a855f7" : "#ef4444"}`,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
          }} />
        </div>

        <div className="absolute" style={{ left: 14, top: 14, width: wheelSize, height: wheelSize }}>
          <div className="absolute inset-0 rounded-full" style={{
            background: isSpecial
              ? "linear-gradient(135deg, #a855f7, #ec4899, #a855f7)"
              : "linear-gradient(135deg, #fbbf24, #f59e0b, #d97706, #fbbf24)",
            padding: 5,
          }}>
            <div className="w-full h-full rounded-full overflow-hidden">
              <div style={{
                width: "100%", height: "100%",
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? "transform 5s cubic-bezier(0.15, 0.6, 0.08, 1)" : "none",
              }}>
                <svg viewBox={`0 0 ${wheelSize} ${wheelSize}`} width="100%" height="100%">
                  {items.map((item, i) => {
                    const startAngle = (i * sliceAngle - 90) * (Math.PI / 180);
                    const endAngle = ((i + 1) * sliceAngle - 90) * (Math.PI / 180);
                    const x1 = center + outerR * Math.cos(startAngle);
                    const y1 = center + outerR * Math.sin(startAngle);
                    const x2 = center + outerR * Math.cos(endAngle);
                    const y2 = center + outerR * Math.sin(endAngle);
                    const largeArc = sliceAngle > 180 ? 1 : 0;
                    const midAngle = ((i + 0.5) * sliceAngle - 90) * (Math.PI / 180);
                    const textR = outerR * 0.65;
                    const tx = center + textR * Math.cos(midAngle);
                    const ty = center + textR * Math.sin(midAngle);
                    const textRotation = (i + 0.5) * sliceAngle;
                    const bgColor = item.color || segmentColors[i % segmentColors.length];
                    return (
                      <g key={item.id}>
                        <path d={`M ${center} ${center} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                          fill={bgColor} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                        <g transform={`translate(${tx}, ${ty}) rotate(${textRotation})`}>
                          <text textAnchor="middle" dy="-6" fill="white" fontSize="20" fontWeight="bold"
                            style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" } as React.CSSProperties}>{item.emoji}</text>
                          <text textAnchor="middle" dy="12" fill="white" fontSize="10" fontWeight="bold"
                            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" } as React.CSSProperties}>{item.points}pt</text>
                        </g>
                      </g>
                    );
                  })}
                  <circle cx={center} cy={center} r={32} fill="white" stroke={isSpecial ? "#a855f7" : "#d97706"} strokeWidth="3" />
                  <text x={center} y={center + 4} textAnchor="middle" fill={isSpecial ? "#7c3aed" : "#b45309"} fontSize="9" fontWeight="bold">SPIN</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => { haptic.tap(); spin(); }} disabled={isSpinning || disabled}
        className={`mt-4 px-10 py-3.5 rounded-full font-black text-lg text-white shadow-2xl transition-all transform
          ${isSpinning || disabled ? "opacity-50 cursor-not-allowed bg-gray-400" :
            isSpecial
              ? "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 hover:scale-110 active:scale-95"
              : "hover:scale-110 active:scale-95"
          }`}
        style={!isSpinning && !disabled && !isSpecial ? { background: "linear-gradient(135deg, #ef4444, #f97316)" } : undefined}>
        {isSpinning ? (
          <span className="flex items-center gap-2"><span className="animate-spin text-xl">🌟</span>回転中...</span>
        ) : (
          <span className="flex items-center gap-2">🎰 タップして回す！</span>
        )}
      </button>
    </div>
  );
}
