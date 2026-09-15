/**
 * LCF yearless fascia.
 * Design: bright signal-yellow venue sign, compact black wordmark, restrained geometric accents.
 */

type LcfFasciaProps = {
  className?: string;
  compact?: boolean;
};

export function LcfFascia({ className = "", compact = false }: LcfFasciaProps) {
  return (
    <div className={`flex items-center justify-between border-[3px] border-black bg-[#f5cf31] text-black ${compact ? "gap-3 px-3 py-2" : "gap-8 px-5 py-4 md:px-8 md:py-5"} ${className}`}>
      <div className={`relative font-black leading-[0.82] tracking-[-0.055em] ${compact ? "text-[13px]" : "text-[clamp(1.05rem,2.2vw,2.25rem)]"}`} aria-label="Live Commerce Festival">
        <span className="absolute -left-2 top-0 h-1.5 w-1.5 rounded-full bg-[#ef476f]" />
        <span className="block">Live</span>
        <span className="block">Commerce</span>
        <span className="block tracking-[0.18em]">Festival</span>
        <span className="absolute -right-3 top-1 h-2 w-2 rotate-45 bg-[#1677c8]" />
      </div>
      <span className={`grid shrink-0 place-items-center rounded-[18%] bg-[#171717] font-black tracking-[-0.06em] text-[#f5cf31] ${compact ? "h-9 w-9 text-xs" : "h-14 w-14 text-lg md:h-20 md:w-20 md:text-2xl"}`}>LCF</span>
    </div>
  );
}

