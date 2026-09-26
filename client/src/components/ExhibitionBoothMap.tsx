import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type BoothMapItem = {
  id: number;
  boothCode: string;
  boothType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  userSelectable: boolean | number;
  status: string;
  label?: string | null;
  occupancy?: "available" | "mine" | "occupied";
  assignmentStatus?: string | null;
  brandName?: string | null;
  companyName?: string | null;
  occupant?: {
    brandName?: string | null;
    category?: string | null;
    brandIntro?: string | null;
    logoUrl?: string | null;
  } | null;
};

type Props = {
  imageUrl: string;
  mapWidth: number;
  mapHeight: number;
  booths: BoothMapItem[];
  activeBoothId?: number | null;
  onBoothClick?: (booth: BoothMapItem) => void;
  adminMode?: boolean;
  className?: string;
};

function stateFor(booth: BoothMapItem) {
  if (booth.status === "disabled" || !Boolean(booth.userSelectable))
    return "disabled";
  if (booth.occupancy === "mine") return "mine";
  if (booth.occupancy === "occupied" || booth.brandName) return "occupied";
  return "available";
}

export function ExhibitionBoothMap({
  imageUrl,
  mapWidth,
  mapHeight,
  booths,
  activeBoothId,
  onBoothClick,
  adminMode = false,
  className,
}: Props) {
  const sorted = useMemo(
    () =>
      [...booths].sort((a, b) =>
        a.boothCode.localeCompare(b.boothCode, undefined, { numeric: true })
      ),
    [booths]
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-3 w-3 rounded-sm border-2 border-emerald-500 bg-emerald-100" />
          空き
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-3 w-3 rounded-sm border-2 border-amber-500 bg-amber-100" />
          選択中
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-3 w-3 rounded-sm border-2 border-rose-500 bg-rose-100" />
          選択済み
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-3 w-3 rounded-sm border-2 border-slate-400 bg-slate-200" />
          選択不可
        </span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="relative min-w-[860px]"
          style={{ aspectRatio: `${mapWidth}/${mapHeight}` }}
        >
          <img
            src={imageUrl}
            alt="ブランド展位マップ"
            className="absolute inset-0 h-full w-full select-none object-contain"
            draggable={false}
          />
          {sorted.map(booth => {
            const state = stateFor(booth);
            const clickable =
              Boolean(onBoothClick) &&
              (adminMode ||
                state === "available" ||
                state === "mine" ||
                state === "occupied");
            const occupantName =
              booth.occupant?.brandName || booth.brandName || "";
            return (
              <button
                key={booth.id}
                type="button"
                aria-label={`${booth.boothCode}${occupantName ? ` ${occupantName}` : ""}`}
                title={`${booth.boothCode}${occupantName ? ` · ${occupantName}` : ""}`}
                disabled={!clickable}
                onClick={() => onBoothClick?.(booth)}
                className={cn(
                  "absolute flex items-center justify-center overflow-hidden rounded-sm border-2 text-[8px] font-black leading-none transition-[transform,box-shadow,background-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1",
                  state === "available" &&
                    "border-emerald-500 bg-emerald-300/35 hover:z-20 hover:scale-[1.08] hover:bg-emerald-300/65 hover:shadow-lg",
                  state === "mine" &&
                    "z-10 border-amber-500 bg-amber-300/55 hover:scale-[1.08] hover:shadow-lg",
                  state === "occupied" &&
                    "border-rose-500 bg-rose-300/45 hover:z-20 hover:scale-[1.06] hover:shadow-lg",
                  state === "disabled" &&
                    "cursor-not-allowed border-slate-400 bg-slate-300/35 opacity-60",
                  activeBoothId === booth.id &&
                    "z-30 ring-4 ring-sky-500 ring-offset-2"
                )}
                style={{
                  left: `${(booth.x / mapWidth) * 100}%`,
                  top: `${(booth.y / mapHeight) * 100}%`,
                  width: `${(booth.width / mapWidth) * 100}%`,
                  height: `${(booth.height / mapHeight) * 100}%`,
                }}
              >
                <span className="sr-only">{booth.boothCode}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-500">
        スマートフォンでは左右にスクロールして全体をご確認ください。展位を押すと詳細が表示されます。
      </p>
    </div>
  );
}
