import { trpc } from "@/lib/trpc";
import { AlertTriangle, Clock3, Database, FileSpreadsheet, ShieldCheck, WalletCards } from "lucide-react";

interface LiverPayrollBasisPanelProps {
  month: string;
}

function money(value: unknown): string {
  return `¥${Number(value || 0).toLocaleString("ja-JP")}`;
}

export function LiverPayrollBasisPanel({ month }: LiverPayrollBasisPanelProps) {
  const { data, isLoading, isError } = trpc.liver.payrollBasis.useQuery(
    { month },
    { staleTime: 10 * 60 * 1000, refetchOnWindowFocus: false },
  );

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4">
        <div className="h-5 w-44 animate-pulse rounded bg-slate-700" />
        <div className="mt-3 h-20 animate-pulse rounded-xl bg-slate-800" />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          給与反映用データを読み込めませんでした
        </div>
        <p className="mt-1 text-xs text-amber-100/75">配信履歴そのものは削除されていません。ページを再読み込みしてください。</p>
      </section>
    );
  }

  const summary = data.summary as any;
  const individual = summary.individual || {};
  const performance = summary.performance || {};
  const screenshot = summary.screenshot || {};
  const salaryRuleActive = summary.salaryRuleStatus === "active";
  const conflictCount = Number(individual.conflictCount || 0) + Number(performance.conflictCount || 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950/40 shadow-lg shadow-violet-950/20">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-violet-400/30 bg-violet-500/15 p-2 text-violet-200">
            <WalletCards className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">給与反映用データ</h2>
            <p className="mt-0.5 text-xs text-slate-400">{month.replace("-", "年")}月・復旧証拠を種類別に表示</p>
          </div>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${salaryRuleActive ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-amber-400/40 bg-amber-500/15 text-amber-200"}`}>
          {salaryRuleActive ? "給与ルール登録済み" : "給与ルール未登録"}
        </div>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-3">
        <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-sky-200">
            <Database className="h-4 w-4" /> 配信DB候補
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <strong className="text-lg text-white">{Number(individual.count || 0)}件</strong>
            <span className="text-sm font-semibold text-sky-200">{money(individual.effectiveSalesAmount)}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">旧DB履歴。競合・更正前候補を含む</p>
        </div>

        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-200">
            <FileSpreadsheet className="h-4 w-4" /> TikTok実績証拠
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <strong className="text-lg text-white">{Number(performance.count || 0)}件</strong>
            <span className="text-sm font-semibold text-emerald-200">{money(performance.effectiveSalesAmount)}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">保存済みCreator Performance</p>
        </div>

        <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fuchsia-200">
            <ShieldCheck className="h-4 w-4" /> 対照証拠
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <strong className="text-lg text-white">{Number(summary.aggregateCount || 0)}件</strong>
            <span className="text-xs font-semibold text-fuchsia-200">スクショ {Number(screenshot.count || 0)}件</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">月次集計と画面証拠。計算には重ねない</p>
        </div>
      </div>

      {(data.individualRecords.length > 0 || data.screenshotRecords.length > 0) && (
        <details className="border-t border-white/10 bg-slate-950/35 px-4 py-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-violet-200">
            復旧配信明細を確認（DB候補 {data.individualRecords.length}件・画面証拠 {data.screenshotRecords.length}件）
          </summary>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {data.individualRecords.map((row: any) => (
              <div key={row.evidenceKey} className="grid gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div>
                  <div className="font-medium text-white">
                    {row.occurredAt ? new Date(row.occurredAt).toLocaleDateString("ja-JP") : "日付未復元"}
                    {row.startTimeLabel ? ` ${row.startTimeLabel}` : ""}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    旧ID {row.legacyLivestreamId || "-"}・{row.sourceType === "current_saved_backup" ? "保存バックアップ" : "DB操作履歴"}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="font-semibold text-amber-200">{money(row.effectiveSalesAmount)}</div>
                  <div className="text-[10px] text-slate-400">{row.durationMinutes ? `${row.durationMinutes}分` : "時間未復元"}</div>
                </div>
                <div className={`w-fit rounded-full border px-2 py-0.5 text-[10px] ${String(row.reviewStatus).includes("conflict") ? "border-amber-400/30 bg-amber-500/10 text-amber-200" : "border-sky-400/30 bg-sky-500/10 text-sky-200"}`}>
                  {String(row.reviewStatus).includes("conflict") ? "要確認" : "給与ルール待ち"}
                </div>
              </div>
            ))}
            {data.screenshotRecords.map((row: any) => (
              <div key={row.evidenceKey} className="grid gap-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/5 px-3 py-2 text-xs sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div>
                  <div className="font-medium text-white">
                    {row.occurredAt ? new Date(row.occurredAt).toLocaleDateString("ja-JP") : "日付未復元"}
                    {row.startTimeLabel ? ` ${row.startTimeLabel}` : ""}
                  </div>
                  <div className="mt-0.5 text-[10px] text-fuchsia-200/70">ユーザー保存画面・旧ID {row.legacyLivestreamId || "未特定"}</div>
                </div>
                <div className="font-semibold text-fuchsia-200 sm:text-right">{money(row.effectiveSalesAmount)}</div>
                <div className="w-fit rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] text-fuchsia-200">照合用</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">復旧明細は読み取り専用です。承認されるまで配信回数や給与額へ自動加算されません。</p>
        </details>
      )}

      <div className="grid gap-3 border-t border-white/10 bg-black/15 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="space-y-1.5 text-xs text-slate-300">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            配信DB・TikTok実績・月次集計は重複する可能性があるため、自動合算しません。
          </p>
          <p className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
            {conflictCount > 0 ? `${conflictCount}件は時刻・版の競合があり、管理者確認待ちです。` : "競合レコードはありません。"}
          </p>
        </div>
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-amber-200/70">給与額</div>
          <div className="text-base font-bold text-amber-100">未計算</div>
          <div className="text-[10px] text-amber-200/70">契約率・時給・締日未確認</div>
        </div>
      </div>
    </section>
  );
}
