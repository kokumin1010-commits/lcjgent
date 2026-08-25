import { trpc } from "@/lib/trpc";
import { AlertCircle, Gift, Layers3, PackageOpen, Percent } from "lucide-react";

const yen = (value: unknown) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;

export function RecoveredLivestreamSetShowcase() {
  const { data, isLoading, isError } = trpc.livestreamSets.recoveredHomepageSets.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-violet-500/20 bg-[#140d2f] p-6 text-white">
        <div className="h-7 w-40 animate-pulse rounded bg-violet-400/15" />
        <div className="mt-5 h-40 animate-pulse rounded-2xl bg-white/5" />
      </section>
    );
  }

  if (isError || !data?.sets?.length) {
    return (
      <section className="rounded-3xl border border-violet-500/20 bg-[#140d2f] p-6 text-white">
        <div className="flex items-center gap-3 text-violet-100">
          <PackageOpen className="h-6 w-6" />
          <h2 className="text-xl font-bold">セット組み</h2>
        </div>
        <p className="mt-5 text-sm text-violet-200/70">復元セットを読み込めませんでした。ページを再読み込みしてください。</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-violet-500/35 bg-[radial-gradient(circle_at_top_right,rgba(183,33,255,0.16),transparent_35%),linear-gradient(145deg,#180d36_0%,#0d1932_100%)] p-4 text-white shadow-[0_28px_90px_rgba(37,13,84,0.35)] sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/15 p-2.5 ring-1 ring-violet-300/25">
            <Gift className="h-6 w-6 text-violet-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-wide sm:text-2xl">セット組み</h2>
            <p className="mt-1 text-xs text-violet-200/65">保存済み画面証拠から復元した販売実績</p>
          </div>
        </div>
        <div className="flex items-baseline gap-4 rounded-2xl bg-black/15 px-4 py-3 ring-1 ring-white/5">
          <span className="text-base font-semibold text-violet-100">{data.summary.setCount}セット</span>
          <span className="text-base font-semibold text-violet-100">合計 <strong className="text-xl text-white">{yen(data.summary.totalRevenue)}</strong></span>
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-violet-200/70">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        セット売上は配信全体の売上の内訳参考です。売上金額には加算されません。主播归属和发生日期在原截图中未显示，因此不会推测。
      </p>

      <div className="mt-6 space-y-5">
        {data.sets.map((set: any) => (
          <article key={set.evidenceKey} className="rounded-2xl border border-violet-300/20 bg-[#11182f]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Layers3 className="mt-1 h-6 w-6 shrink-0 text-violet-300" />
                <h3 className="break-words text-lg font-bold leading-snug text-white sm:text-2xl">{set.setName}</h3>
              </div>
              <div className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-1.5 text-sm font-bold shadow-lg shadow-fuchsia-900/30">
                <Percent className="h-4 w-4" />
                {Number(set.discountRate || 0)}%OFF
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 border-b border-violet-200/10 pb-5 text-center sm:gap-6">
              <div>
                <p className="text-[11px] text-violet-200/60 sm:text-sm">売値</p>
                <p className="mt-1 text-lg font-extrabold text-yellow-300 sm:text-2xl">{yen(set.setPrice)}</p>
              </div>
              <div>
                <p className="text-[11px] text-violet-200/60 sm:text-sm">販売数</p>
                <p className="mt-1 text-lg font-extrabold text-white sm:text-2xl">{Number(set.quantitySold || 0).toLocaleString()}<span className="ml-1 text-xs font-medium text-violet-200/70 sm:text-sm">セット</span></p>
              </div>
              <div>
                <p className="text-[11px] text-violet-200/60 sm:text-sm">セット売上</p>
                <p className="mt-1 text-lg font-extrabold text-emerald-300 sm:text-2xl">{yen(set.totalRevenue)}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-200/65">
                <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-sm border border-violet-300/50" />
                セット内容（元値合計: {yen(set.totalOriginalPrice)}）
              </div>
              <div className="space-y-1.5">
                {set.items.map((item: any) => (
                  <div key={`${set.evidenceKey}-${item.sortOrder}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm leading-6 sm:text-base">
                    <span className="break-words font-medium text-violet-50">{item.productName} ×{Number(item.quantity || 1)}</span>
                    <span className="whitespace-nowrap tabular-nums text-violet-200/75">{yen(item.originalPrice)} ×{Number(item.quantity || 1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-violet-200/55">
        <span>販売数合計: {Number(data.summary.quantitySold || 0).toLocaleString()}セット</span>
        <span>出典: 2026-08-26ユーザー提供画面</span>
        <span>现金流: 未计入</span>
      </div>
    </section>
  );
}
