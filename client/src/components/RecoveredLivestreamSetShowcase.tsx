import { trpc } from "@/lib/trpc";
import { AlertCircle, Gift, Layers3, PackageOpen, Percent, Tag } from "lucide-react";

const yen = (value: unknown) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;

export function RecoveredLivestreamSetShowcase() {
  const { data, isLoading, isError } = trpc.livestreamSets.recoveredHomepageSets.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <section className="rounded-xl border border-violet-500/25 bg-[#100b25] p-3 text-white">
        <div className="h-5 w-28 animate-pulse rounded bg-violet-400/15" />
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-white/5" />
      </section>
    );
  }

  if (isError || !data?.sets?.length) {
    return (
      <section className="rounded-xl border border-violet-500/25 bg-[#100b25] p-3 text-white">
        <div className="flex items-center gap-2 text-violet-100">
          <PackageOpen className="h-4 w-4" />
          <h2 className="text-sm font-bold">セット組み</h2>
        </div>
        <p className="mt-3 text-[11px] text-violet-200/70">セットデータを読み込めませんでした。ページを再読み込みしてください。</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-violet-500/35 bg-[linear-gradient(145deg,#180d36_0%,#0d1932_100%)] p-3 text-white shadow-[0_12px_36px_rgba(37,13,84,0.28)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-violet-500/15 p-1.5 ring-1 ring-violet-300/25">
            <Gift className="h-[18px] w-[18px] text-violet-300" />
          </div>
          <h2 className="text-base font-bold tracking-wide">セット組み</h2>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-violet-100">
          <span>{data.summary.setCount}セット</span>
          <span>合計 <strong className="text-sm text-white">{yen(data.summary.totalRevenue)}</strong></span>
        </div>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-violet-200/65">
        <AlertCircle className="mt-px h-3 w-3 shrink-0" />
        セット売上は配信全体の売上の内訳参考です。売上金額には加算されません。
      </p>

      <div className="mt-3 space-y-3">
        {data.sets.map((set: any) => (
          <article key={set.evidenceKey} className="rounded-lg border border-violet-300/20 bg-[#11182f]/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <Layers3 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-violet-300" />
                <h3 className="break-words text-sm font-bold leading-5 text-white">{set.setName}</h3>
              </div>
              <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 px-2.5 py-1 text-[10px] font-bold shadow shadow-fuchsia-900/30">
                <Percent className="h-3 w-3" />
                {Number(set.discountRate || 0)}%OFF
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-b border-violet-200/10 pb-3 text-center">
              <div className="min-w-0">
                <p className="text-[10px] text-violet-200/60">売値</p>
                <p className="mt-0.5 whitespace-nowrap text-base font-extrabold tabular-nums text-yellow-300">{yen(set.setPrice)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-violet-200/60">販売数</p>
                <p className="mt-0.5 whitespace-nowrap text-base font-extrabold tabular-nums text-white">{Number(set.quantitySold || 0).toLocaleString()}<span className="ml-1 text-[10px] font-medium text-violet-200/70">セット</span></p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-violet-200/60">セット売上</p>
                <p className="mt-0.5 whitespace-nowrap text-base font-extrabold tabular-nums text-emerald-300">{yen(set.totalRevenue)}</p>
              </div>
            </div>

            <div className="mt-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-violet-200/60">
                <Tag className="h-3 w-3" />
                セット内容（元値合計: {yen(set.totalOriginalPrice)}）
              </div>
              <div className="space-y-0.5">
                {set.items.map((item: any) => (
                  <div key={`${set.evidenceKey}-${item.sortOrder}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[11px] leading-[18px]">
                    <span className="break-words font-medium text-violet-50">{item.productName} ×{Number(item.quantity || 1)}</span>
                    <span className="whitespace-nowrap tabular-nums text-violet-200/75">{yen(item.originalPrice)} ×{Number(item.quantity || 1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
