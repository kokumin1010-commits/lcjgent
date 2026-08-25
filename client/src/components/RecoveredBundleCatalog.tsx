import { Layers, Package, ShieldCheck } from "lucide-react";

interface RecoveredBundleCatalogProps {
  bundles: any[];
  variant?: "neon" | "liver";
}

function formatPrice(value: unknown): string | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `¥${amount.toLocaleString()}` : null;
}

export function RecoveredBundleCatalog({ bundles, variant = "liver" }: RecoveredBundleCatalogProps) {
  const isNeon = variant === "neon";
  const panelClass = isNeon
    ? "rounded-xl border border-amber-400/25 bg-amber-500/5 p-4"
    : "rounded-xl border border-amber-500/30 bg-amber-500/10 p-3";
  const cardClass = isNeon
    ? "rounded-lg border border-cyan-500/15 bg-[#0a1520]/60 p-3"
    : "rounded-lg border border-gray-700 bg-gray-800/70 p-3";
  const titleClass = isNeon ? "text-cyan-100" : "text-white";
  const mutedClass = isNeon ? "text-cyan-300/60" : "text-white/60";

  return (
    <div className={panelClass}>
      <div className="mb-3 flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <div className={`flex flex-wrap items-center gap-2 text-sm font-bold ${titleClass}`}>
            <span>復元済みセットカタログ</span>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">{bundles.length}件</span>
          </div>
          <p className={`mt-1 text-xs leading-relaxed ${mutedClass}`}>
            保存済み商品・セット証拠から復元しました。元の配信日、販売数、売上、作成ライバーとの紐付けは完全な証拠がないため、ランキング実績とは分離して表示しています。
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {bundles.map((bundle: any) => {
          const price = formatPrice(bundle.price);
          const marketPrice = formatPrice(bundle.marketPrice);
          const firstItem = Array.isArray(bundle.items) ? bundle.items[0] : null;
          const historicalLowest = formatPrice(firstItem?.historicalLowestPrice || bundle.price);
          return (
            <div key={bundle.id} className={cardClass}>
              <div className="flex items-start gap-2">
                <Package className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-snug ${titleClass}`}>{bundle.bundleName}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className={price ? "font-bold text-yellow-400" : mutedClass}>
                      セット価格: {price || "証拠なし"}
                    </span>
                    {marketPrice && <span className={mutedClass}>定価: {marketPrice}</span>}
                    <span className={historicalLowest ? "font-bold text-red-400" : mutedClass}>
                      歴史最低: {historicalLowest || "証拠なし"}
                    </span>
                  </div>
                  {Array.isArray(bundle.items) && bundle.items.length > 0 && (
                    <div className={`mt-2 flex items-center gap-1 text-[11px] ${mutedClass}`}>
                      <Layers className="h-3 w-3" />
                      <span>{bundle.items.map((item: any) => `${item.productName}${Number(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ""}`).join(" / ")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
