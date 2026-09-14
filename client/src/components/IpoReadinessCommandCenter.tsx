import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Banknote, Flag, Landmark, Loader2, PencilLine, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import IpoReadinessOperationsPanel from "./IpoReadinessOperationsPanel";

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `¥${Math.round(value).toLocaleString()} JPY`;
}

function signedMoney(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}¥${Math.round(value).toLocaleString()} JPY`;
}

function originalCurrencies(jpy: number, cny: number) {
  const parts: string[] = [];
  if (jpy) parts.push(`¥${Math.round(jpy).toLocaleString()} JPY`);
  if (cny) parts.push(`¥${cny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CNY`);
  return parts.length > 0 ? parts.join(" ＋ ") : "—";
}

function percent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "判定不可";
  return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function percentNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function formNumber(value: string) {
  const parsed = Number(String(value || "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pnlStatusLabel(status: string) {
  if (status === "audited") return "監査済み";
  if (status === "closed") return "月次決算済み";
  return "下書き";
}

export default function IpoReadinessCommandCenter({ onNavigateCashflow }: { onNavigateCashflow: () => void }) {
  const query = trpc.cashflow.getFinanceCommandCenter.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    month: "",
    revenueJpy: "0",
    grossProfitJpy: "0",
    operatingProfitJpy: "0",
    netProfitJpy: "",
    status: "draft" as "draft" | "closed" | "audited",
    note: "",
  });
  const mutation = trpc.cashflow.upsertIpoMonthlyPnl.useMutation({
    onSuccess: async () => {
      toast.success("月次損益を更新しました");
      setDialogOpen(false);
      await query.refetch();
    },
    onError: (error) => toast.error(`月次損益の更新に失敗しました：${error.message}`),
  });

  const openEditor = (month?: string) => {
    const ipo = query.data?.ipoReadiness;
    const targetMonth = month || ipo?.actual.missingCloseMonths[0] || ipo?.asOfMonth || "";
    const existing = ipo?.monthlyPnl.find((row) => row.month === targetMonth);
    setForm({
      month: targetMonth,
      revenueJpy: String(existing?.revenueJpy ?? 0),
      grossProfitJpy: String(existing?.grossProfitJpy ?? 0),
      operatingProfitJpy: String(existing?.operatingProfitJpy ?? 0),
      netProfitJpy: existing?.netProfitJpy == null ? "" : String(existing.netProfitJpy),
      status: existing?.status || "draft",
      note: existing?.note || "",
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(form.month)) {
      toast.error("正しい対象月を選択してください");
      return;
    }
    mutation.mutate({
      month: form.month,
      revenueJpy: formNumber(form.revenueJpy),
      grossProfitJpy: formNumber(form.grossProfitJpy),
      operatingProfitJpy: formNumber(form.operatingProfitJpy),
      netProfitJpy: form.netProfitJpy.trim() ? formNumber(form.netProfitJpy) : null,
      status: form.status,
      note: form.note.trim() || null,
    });
  };

  if (query.isLoading) {
    return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  }

  if (query.error || !query.data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader><CardTitle className="text-red-700">上場準備データの読込に失敗しました</CardTitle></CardHeader>
        <CardContent><Button variant="outline" onClick={() => query.refetch()}>再読込</Button></CardContent>
      </Card>
    );
  }

  const ipo = query.data.ipoReadiness;
  const progressWidth = Math.max(0, Math.min(100, Number(ipo.pace.progressRate || 0) * 100));
  const managementFlash = ipo.cashReference.latestCompletedMonth;
  const flashPnl = managementFlash ? ipo.monthlyPnl.find((row) => row.month === managementFlash.month) : null;
  const flashPnlFinalized = flashPnl?.status === "closed" || flashPnl?.status === "audited";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-300 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-400"><Landmark className="mr-1 h-3.5 w-3.5" />上場準備</Badge>
          <Badge variant="outline" className="border-white/30 bg-white/10 text-white">7月決算</Badge>
          <Badge variant="outline" className="border-white/30 bg-white/10 text-white">目標＝会社計画</Badge>
        </div>
        <h1 className="mt-4 text-2xl font-semibold">上場ロードマップ</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">N-2／N-1の営業利益目標、必要売上高、正式な月次決算実績、目標差額を一元管理します。会社計画は営業利益率20%です。最短上場目標は2029年中旬で、業績・監査・内部統制の条件達成が前提です。</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{ipo.currentStage.label}・営業利益目標</p><p className="mt-2 text-xl font-semibold">{ipo.pace.targetOperatingProfitJpy == null ? "上場マイルストーン" : money(ipo.pace.targetOperatingProfitJpy)}</p><p className="mt-1 text-xs text-muted-foreground">必要売上高 {money(ipo.operatingPlan.requiredRevenueJpy)}・営業利益率 {percentNumber(ipo.operatingPlan.targetOperatingMarginPct)}</p><p className="mt-1 text-xs text-muted-foreground">{ipo.currentStage.periodLabel}</p></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50/50"><CardContent className="p-4"><p className="text-xs text-emerald-800">正式累計営業利益</p><p className="mt-2 text-xl font-semibold text-emerald-950">{ipo.actual.finalizedMonthCount ? money(ipo.actual.formalOperatingProfitJpy) : "未登録"}</p><p className="mt-1 text-xs text-emerald-800">{ipo.actual.finalizedMonthCount}か月 月次決算／監査済み・達成率 {percent(ipo.pace.progressRate)}</p>{ipo.cashReference.completedMonthCount > 0 && <p className="mt-2 border-t border-emerald-200 pt-2 text-xs font-medium text-emerald-900">現金口径参考 {signedMoney(ipo.cashReference.completedOperatingNetReferenceJpy)}（{ipo.cashReference.completedMonthCount}か月・参考）</p>}</CardContent></Card>
        <Card className="border-amber-200 bg-amber-50/50"><CardContent className="p-4"><p className="text-xs text-amber-800">目標差額</p><p className="mt-2 text-xl font-semibold text-amber-950">{ipo.pace.targetGapJpy == null || !ipo.actual.finalizedMonthCount ? "月次決算待ち" : money(ipo.pace.targetGapJpy)}</p><p className="mt-1 text-xs text-amber-800">正式口径・残り {ipo.pace.remainingMonths}か月</p>{ipo.cashReference.targetGapReferenceJpy != null && <p className="mt-2 border-t border-amber-200 pt-2 text-xs font-medium text-amber-950">現金参考差額 {money(ipo.cashReference.targetGapReferenceJpy)}</p>}</CardContent></Card>
        <Card className="border-blue-200 bg-blue-50/50"><CardContent className="p-4"><p className="text-xs text-blue-800">残り期間の月次必要営業利益</p><p className="mt-2 text-xl font-semibold text-blue-950">{ipo.pace.requiredMonthlyOperatingProfitJpy == null || !ipo.actual.finalizedMonthCount ? "月次決算待ち" : money(ipo.pace.requiredMonthlyOperatingProfitJpy)}</p><p className="mt-1 text-xs text-blue-800">正式口径の期末予測 {ipo.pace.projectedOperatingProfitJpy == null ? "データ不足" : money(ipo.pace.projectedOperatingProfitJpy)}</p>{ipo.cashReference.requiredMonthlyReferenceJpy != null && <p className="mt-2 border-t border-blue-200 pt-2 text-xs font-medium text-blue-950">現金参考 {money(ipo.cashReference.requiredMonthlyReferenceJpy)}／月（残り{ipo.cashReference.remainingMonths}か月）</p>}</CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5 text-amber-600" />上場ロードマップ</CardTitle><Badge variant="outline">目標営業利益率＝20%</Badge></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${progressWidth}%` }} /></div>
          <div className="grid gap-2 md:grid-cols-5">
            {ipo.roadmap.map((stage) => (
              <div key={stage.key} className={`rounded-xl border p-3 ${stage.status === "current" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-1"><p className="text-sm font-semibold">{stage.label}</p>{stage.status === "current" && <Badge className="bg-amber-500 text-slate-950">現在</Badge>}</div>
                <p className="mt-2 text-xs text-muted-foreground">{stage.periodLabel}</p>
                {stage.targetOperatingProfitJpy == null ? <p className="mt-3 font-semibold">2029年中旬</p> : <>
                  <p className="mt-3 text-xs text-muted-foreground">営業利益目標</p><p className="font-semibold">{money(stage.targetOperatingProfitJpy)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">必要売上高</p><p className="font-semibold text-blue-800">{money(stage.requiredRevenueJpy)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">営業費用上限（売上原価＋人件費・広告費等）{money(stage.operatingCostLimitJpy)}（{stage.targetOperatingCostRatioPct}%）</p>
                </>}
                <p className="mt-2 text-xs text-muted-foreground">{stage.finalizedMonthCount ? `正式実績：売上 ${money(stage.actualRevenueJpy)}／営業利益 ${money(stage.actualOperatingProfitJpy)}／利益率 ${percentNumber(stage.actualOperatingMarginPct)}` : "正式実績 未登録"}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><strong>営業利益率20%の意味：</strong>売上から商品原価、人件費、広告費、物流費、家賃等の営業費用をすべて差し引いた後に20%を残す計画です。営業利益は法人税等と内部留保の原資ですが、正式な税額は営業外損益・税務調整後の税引前利益を基準に確定するため、ここでは自動計上しません。</div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-rose-600" />目標達成に必要なアクション</CardTitle></CardHeader>
          <CardContent>
            {ipo.actions.length === 0 ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">現在、システムが検出した上場業績の未完了項目はありません。</p> : (
              <div className="space-y-2">
                {ipo.actions.map((action) => (
                  <button key={action.key} type="button" onClick={() => action.target === "monthly_pnl" ? openEditor() : onNavigateCashflow()} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:border-amber-300 hover:bg-amber-50/40">
                    <div><p className="text-sm font-medium">{action.title}</p><p className="mt-1 text-xs text-muted-foreground">{action.detail}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-amber-600" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-600" />月次損益</CardTitle><Button size="sm" onClick={() => openEditor()}><PencilLine className="mr-1.5 h-4 w-4" />更新する</Button></div>
          </CardHeader>
          <CardContent>
            {ipo.monthlyPnl.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">正式な月次損益はまだ登録されていません。財務担当者は直近の月次決算完了月から入力してください。銀行キャッシュフローは会計利益へ自動変換しません。</p> : (
              <div className="space-y-2">
                {ipo.monthlyPnl.slice().reverse().slice(0, 8).map((row) => (
                  <button key={row.month} type="button" onClick={() => openEditor(row.month)} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-slate-50">
                    <div><p className="text-sm font-medium">{row.month}</p><p className="mt-1 text-xs text-muted-foreground">売上高 {money(row.revenueJpy)}・売上総利益 {money(row.grossProfitJpy)}</p></div>
                    <div className="text-right"><p className={`text-sm font-semibold ${row.operatingProfitJpy < 0 ? "text-rose-700" : "text-emerald-700"}`}>営業利益 {money(row.operatingProfitJpy)}</p><Badge variant="outline" className="mt-1">{pnlStatusLabel(row.status)}</Badge></div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-blue-950"><Banknote className="h-5 w-5" />{managementFlash ? `${managementFlash.month.replace("-", "年")}月 管理速報` : "銀行営業キャッシュ参考"}</CardTitle>
              <p className="mt-1 text-xs text-blue-800">銀行営業キャッシュ口径・会計利益ではありません・1 CNY = {ipo.cashReference.referenceCnyJpy} JPY 管理参考</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-blue-300 bg-white text-blue-800">内部送金は営業収支に含めません</Badge>
              <Badge variant="outline" className={flashPnlFinalized ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}>
                {flashPnlFinalized ? `正式営業利益 ${money(flashPnl.operatingProfitJpy)}` : flashPnl?.status === "draft" ? "正式営業利益：下書き・未算入" : "正式営業利益：未登録"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {managementFlash ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-emerald-200 bg-white p-4"><p className="text-xs font-medium text-emerald-800">営業入金</p><p className="mt-2 text-sm font-semibold text-slate-950">{originalCurrencies(managementFlash.operatingIncomeJpy, managementFlash.operatingIncomeCny)}</p><p className="mt-1 text-xs text-muted-foreground">JPY参考 {money(managementFlash.operatingIncomeReferenceJpy)}・{managementFlash.operatingIncomeCount}件</p></div>
                <div className="rounded-xl border border-rose-200 bg-white p-4"><p className="text-xs font-medium text-rose-800">営業出金</p><p className="mt-2 text-sm font-semibold text-slate-950">{originalCurrencies(managementFlash.operatingExpenseJpy, managementFlash.operatingExpenseCny)}</p><p className="mt-1 text-xs text-muted-foreground">JPY参考 {money(managementFlash.operatingExpenseReferenceJpy)}・{managementFlash.operatingExpenseCount}件</p></div>
                <div className="rounded-xl border border-blue-300 bg-white p-4"><p className="text-xs font-medium text-blue-800">営業キャッシュ純額</p><p className={`mt-2 text-xl font-semibold ${managementFlash.operatingNetReferenceJpy < 0 ? "text-rose-700" : "text-emerald-700"}`}>{signedMoney(managementFlash.operatingNetReferenceJpy)}</p><p className="mt-1 text-xs text-muted-foreground">銀行入出金による参考値であり、上場利益の達成率には算入しません</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-700">内部送金・口座振替</p><p className="mt-2 text-sm font-semibold text-slate-950">出金 {originalCurrencies(managementFlash.internalTransferExpenseJpy, managementFlash.internalTransferExpenseCny)}</p><p className="mt-1 text-sm font-semibold text-slate-950">入金 {originalCurrencies(managementFlash.internalTransferIncomeJpy, managementFlash.internalTransferIncomeCny)}</p><p className="mt-1 text-xs text-muted-foreground">JPY参考 出金 {money(managementFlash.internalTransferExpenseReferenceJpy)}／入金 {money(managementFlash.internalTransferIncomeReferenceJpy)}・出金{managementFlash.internalTransferExpenseCount}件／入金{managementFlash.internalTransferIncomeCount}件・実流水の関連済み {managementFlash.linkedTransferCount}組</p></div>
              </div>
              {managementFlash.duplicateCandidateGroupCount > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">同日・同額・同一取引属性の重複候補は {managementFlash.duplicateCandidateGroupCount}組／{managementFlash.duplicateCandidateRowCount}行です。確認を促すだけで、原銀行流水を自動削除・統合・書換えしません。</p>
              )}
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-xs leading-5 text-slate-600">銀行全体純額（内部送金を含む）は {signedMoney(managementFlash.bankNetReferenceJpy)} です。内部送金は口座間の資金移動であり費用ではないため、営業キャッシュ純額とは分けて表示します。</p>
                <Button variant="outline" className="shrink-0 bg-white" onClick={onNavigateCashflow}>月別入金・出金を見る<ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-blue-900">現在の段階には、完了月の銀行キャッシュ参考がまだありません。</p>
              <Button variant="outline" className="bg-white" onClick={onNavigateCashflow}>月別入金・出金を見る<ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <IpoReadinessOperationsPanel
        operations={query.data.ipoOperations}
        core={ipo}
        onRefresh={async () => { await query.refetch(); }}
        onOpenPnl={openEditor}
      />

      <p className="rounded-lg border bg-slate-50 p-3 text-xs leading-5 text-slate-700">{ipo.disclaimers.join(" ")} 正式利益に月次決算データがない場合は「未登録」と表示し、GMVや銀行キャッシュ純額で代用しません。</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>月次損益を更新</DialogTitle><DialogDescription>月次決算済みまたは監査済みのデータだけが上場目標の達成率に算入されます。</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="ipo-month">対象月</Label><Input id="ipo-month" type="month" value={form.month} onChange={(event) => { const month = event.target.value; const existing = ipo.monthlyPnl.find((row) => row.month === month); setForm({ month, revenueJpy: String(existing?.revenueJpy ?? 0), grossProfitJpy: String(existing?.grossProfitJpy ?? 0), operatingProfitJpy: String(existing?.operatingProfitJpy ?? 0), netProfitJpy: existing?.netProfitJpy == null ? "" : String(existing.netProfitJpy), status: existing?.status || "draft", note: existing?.note || "" }); }} /></div>
            <div className="space-y-2"><Label>状態</Label><Select value={form.status} onValueChange={(value: "draft" | "closed" | "audited") => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">下書き・達成率に未算入</SelectItem><SelectItem value="closed">月次決算済み・達成率に算入</SelectItem><SelectItem value="audited">監査済み・達成率に算入</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="ipo-revenue">売上高（JPY）</Label><Input id="ipo-revenue" inputMode="decimal" value={form.revenueJpy} onChange={(event) => setForm((current) => ({ ...current, revenueJpy: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="ipo-gross">売上総利益（JPY）</Label><Input id="ipo-gross" inputMode="decimal" value={form.grossProfitJpy} onChange={(event) => setForm((current) => ({ ...current, grossProfitJpy: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="ipo-operating">営業利益（JPY）</Label><Input id="ipo-operating" inputMode="decimal" value={form.operatingProfitJpy} onChange={(event) => setForm((current) => ({ ...current, operatingProfitJpy: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="ipo-net">当期純利益（JPY・任意）</Label><Input id="ipo-net" inputMode="decimal" value={form.netProfitJpy} onChange={(event) => setForm((current) => ({ ...current, netProfitJpy: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="ipo-note">備考</Label><Input id="ipo-note" maxLength={1000} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">正式な月次損益表から入力してください。目標比較指標は営業利益です。現金参考やGMVを利益として代用しないでください。</div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={mutation.isPending}>キャンセル</Button><Button onClick={save} disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存する</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
