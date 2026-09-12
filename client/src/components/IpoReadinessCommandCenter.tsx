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
  if (value == null || !Number.isFinite(value)) return "暂不可判断";
  return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function formNumber(value: string) {
  const parsed = Number(String(value || "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pnlStatusLabel(status: string) {
  if (status === "audited") return "审计";
  if (status === "closed") return "月结";
  return "草稿";
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
      toast.success("月次损益已更新");
      setDialogOpen(false);
      await query.refetch();
    },
    onError: (error) => toast.error(`月次损益更新失败：${error.message}`),
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
      toast.error("请选择正确月份");
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
        <CardHeader><CardTitle className="text-red-700">上场准备数据读取失败</CardTitle></CardHeader>
        <CardContent><Button variant="outline" onClick={() => query.refetch()}>重新读取</Button></CardContent>
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
          <Badge variant="outline" className="border-white/30 bg-white/10 text-white">目标＝公司计划</Badge>
        </div>
        <h1 className="mt-4 text-2xl font-semibold">上場ロードマップ</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">N-2／N-1の利益目标、正式月结实绩、目标差额和必要月度利润集中在此页面。最短上场目标为2029年中旬，须以业绩、审计和内部控制条件全部满足为前提。</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{ipo.currentStage.label}目标</p><p className="mt-2 text-xl font-semibold">{ipo.pace.targetOperatingProfitJpy == null ? "里程碑" : money(ipo.pace.targetOperatingProfitJpy)}</p><p className="mt-1 text-xs text-muted-foreground">{ipo.currentStage.periodLabel}</p></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50/50"><CardContent className="p-4"><p className="text-xs text-emerald-800">正式累计营业利润</p><p className="mt-2 text-xl font-semibold text-emerald-950">{ipo.actual.finalizedMonthCount ? money(ipo.actual.formalOperatingProfitJpy) : "未登记"}</p><p className="mt-1 text-xs text-emerald-800">{ipo.actual.finalizedMonthCount}个月月结／审计・完成率 {percent(ipo.pace.progressRate)}</p></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50/50"><CardContent className="p-4"><p className="text-xs text-amber-800">目标差额</p><p className="mt-2 text-xl font-semibold text-amber-950">{ipo.pace.targetGapJpy == null || !ipo.actual.finalizedMonthCount ? "待月结" : money(ipo.pace.targetGapJpy)}</p><p className="mt-1 text-xs text-amber-800">剩余 {ipo.pace.remainingMonths}个月</p></CardContent></Card>
        <Card className="border-blue-200 bg-blue-50/50"><CardContent className="p-4"><p className="text-xs text-blue-800">剩余每月必要营业利润</p><p className="mt-2 text-xl font-semibold text-blue-950">{ipo.pace.requiredMonthlyOperatingProfitJpy == null || !ipo.actual.finalizedMonthCount ? "待月结" : money(ipo.pace.requiredMonthlyOperatingProfitJpy)}</p><p className="mt-1 text-xs text-blue-800">期末预测 {ipo.pace.projectedOperatingProfitJpy == null ? "数据不足" : money(ipo.pace.projectedOperatingProfitJpy)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5 text-amber-600" />上场路线</CardTitle><Badge variant="outline">目标指标＝营业利润</Badge></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${progressWidth}%` }} /></div>
          <div className="grid gap-2 md:grid-cols-5">
            {ipo.roadmap.map((stage) => (
              <div key={stage.key} className={`rounded-xl border p-3 ${stage.status === "current" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-1"><p className="text-sm font-semibold">{stage.label}</p>{stage.status === "current" && <Badge className="bg-amber-500 text-slate-950">现在</Badge>}</div>
                <p className="mt-2 text-xs text-muted-foreground">{stage.periodLabel}</p>
                <p className="mt-3 font-semibold">{stage.targetOperatingProfitJpy == null ? "2029年中旬" : money(stage.targetOperatingProfitJpy)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stage.finalizedMonthCount ? `正式实绩 ${money(stage.actualOperatingProfitJpy)}` : "正式实绩 未登记"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-rose-600" />达到目标需要做什么</CardTitle></CardHeader>
          <CardContent>
            {ipo.actions.length === 0 ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">当前没有系统检测到的上场业绩待办。</p> : (
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
            <div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-600" />月次损益</CardTitle><Button size="sm" onClick={() => openEditor()}><PencilLine className="mr-1.5 h-4 w-4" />更新</Button></div>
          </CardHeader>
          <CardContent>
            {ipo.monthlyPnl.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">尚未登记正式月次损益。请财务从最近完成月结的月份开始录入；银行现金流不会自动转换成会计利润。</p> : (
              <div className="space-y-2">
                {ipo.monthlyPnl.slice().reverse().slice(0, 8).map((row) => (
                  <button key={row.month} type="button" onClick={() => openEditor(row.month)} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-slate-50">
                    <div><p className="text-sm font-medium">{row.month}</p><p className="mt-1 text-xs text-muted-foreground">销售 {money(row.revenueJpy)}・毛利 {money(row.grossProfitJpy)}</p></div>
                    <div className="text-right"><p className={`text-sm font-semibold ${row.operatingProfitJpy < 0 ? "text-rose-700" : "text-emerald-700"}`}>营业利润 {money(row.operatingProfitJpy)}</p><Badge variant="outline" className="mt-1">{pnlStatusLabel(row.status)}</Badge></div>
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
              <CardTitle className="flex items-center gap-2 text-blue-950"><Banknote className="h-5 w-5" />{managementFlash ? `${managementFlash.month.replace("-", "年")}月 管理速報` : "银行经营现金参考"}</CardTitle>
              <p className="mt-1 text-xs text-blue-800">银行经营现金口径・不是会计利润・1 CNY = {ipo.cashReference.referenceCnyJpy} JPY 管理参考</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-blue-300 bg-white text-blue-800">内部送金不计入经营收支</Badge>
              <Badge variant="outline" className={flashPnlFinalized ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}>
                {flashPnlFinalized ? `正式营业利润 ${money(flashPnl.operatingProfitJpy)}` : flashPnl?.status === "draft" ? "正式营业利润：草稿・未计入" : "正式营业利润：未登记"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {managementFlash ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-emerald-200 bg-white p-4"><p className="text-xs font-medium text-emerald-800">经营入金</p><p className="mt-2 text-sm font-semibold text-slate-950">{originalCurrencies(managementFlash.operatingIncomeJpy, managementFlash.operatingIncomeCny)}</p><p className="mt-1 text-xs text-muted-foreground">JPY参考 {money(managementFlash.operatingIncomeReferenceJpy)}・{managementFlash.operatingIncomeCount}件</p></div>
                <div className="rounded-xl border border-rose-200 bg-white p-4"><p className="text-xs font-medium text-rose-800">经营出金</p><p className="mt-2 text-sm font-semibold text-slate-950">{originalCurrencies(managementFlash.operatingExpenseJpy, managementFlash.operatingExpenseCny)}</p><p className="mt-1 text-xs text-muted-foreground">JPY参考 {money(managementFlash.operatingExpenseReferenceJpy)}・{managementFlash.operatingExpenseCount}件</p></div>
                <div className="rounded-xl border border-blue-300 bg-white p-4"><p className="text-xs font-medium text-blue-800">经营现金净额</p><p className={`mt-2 text-xl font-semibold ${managementFlash.operatingNetReferenceJpy < 0 ? "text-rose-700" : "text-emerald-700"}`}>{signedMoney(managementFlash.operatingNetReferenceJpy)}</p><p className="mt-1 text-xs text-muted-foreground">仅银行收付参考，不进入上场利润完成率</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-700">内部送金・口座振替</p><p className="mt-2 text-sm font-semibold text-slate-950">出金 {originalCurrencies(managementFlash.internalTransferExpenseJpy, managementFlash.internalTransferExpenseCny)}</p><p className="mt-1 text-sm font-semibold text-slate-950">入金 {originalCurrencies(managementFlash.internalTransferIncomeJpy, managementFlash.internalTransferIncomeCny)}</p><p className="mt-1 text-xs text-muted-foreground">JPY参考 出金 {money(managementFlash.internalTransferExpenseReferenceJpy)}／入金 {money(managementFlash.internalTransferIncomeReferenceJpy)}・出金{managementFlash.internalTransferExpenseCount}件／入金{managementFlash.internalTransferIncomeCount}件・实流水已关联 {managementFlash.linkedTransferCount}组</p></div>
              </div>
              {managementFlash.duplicateCandidateGroupCount > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">同日・同额・同交易属性的重复候选为 {managementFlash.duplicateCandidateGroupCount}组／{managementFlash.duplicateCandidateRowCount}行。这里只提示核对，不会自动删除、合并或改写原始银行流水。</p>
              )}
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-xs leading-5 text-slate-600">银行全部净额（含内部送金）为 {signedMoney(managementFlash.bankNetReferenceJpy)}。内部送金是账户间资金移动，不是费用，因此与经营现金净额分开显示。</p>
                <Button variant="outline" className="shrink-0 bg-white" onClick={onNavigateCashflow}>查看月别入金・出金<ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-blue-900">当前阶段尚无已完成月份的银行现金参考。</p>
              <Button variant="outline" className="bg-white" onClick={onNavigateCashflow}>查看月别入金・出金<ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="rounded-lg border bg-slate-50 p-3 text-xs leading-5 text-slate-700">{ipo.disclaimers.join(" ")} 正式利润没有月结数据时只显示“未登记”，不会以GMV或银行现金净额代填。</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>月次损益を更新</DialogTitle><DialogDescription>只有月结或审计状态的数据进入上场目标完成率。</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="ipo-month">对象月份</Label><Input id="ipo-month" type="month" value={form.month} onChange={(event) => { const month = event.target.value; const existing = ipo.monthlyPnl.find((row) => row.month === month); setForm({ month, revenueJpy: String(existing?.revenueJpy ?? 0), grossProfitJpy: String(existing?.grossProfitJpy ?? 0), operatingProfitJpy: String(existing?.operatingProfitJpy ?? 0), netProfitJpy: existing?.netProfitJpy == null ? "" : String(existing.netProfitJpy), status: existing?.status || "draft", note: existing?.note || "" }); }} /></div>
            <div className="space-y-2"><Label>状态</Label><Select value={form.status} onValueChange={(value: "draft" | "closed" | "audited") => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">草稿・不计入完成率</SelectItem><SelectItem value="closed">月结・计入完成率</SelectItem><SelectItem value="audited">审计・计入完成率</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="ipo-revenue">销售额（JPY）</Label><Input id="ipo-revenue" inputMode="decimal" value={form.revenueJpy} onChange={(event) => setForm((current) => ({ ...current, revenueJpy: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="ipo-gross">毛利（JPY）</Label><Input id="ipo-gross" inputMode="decimal" value={form.grossProfitJpy} onChange={(event) => setForm((current) => ({ ...current, grossProfitJpy: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="ipo-operating">营业利润（JPY）</Label><Input id="ipo-operating" inputMode="decimal" value={form.operatingProfitJpy} onChange={(event) => setForm((current) => ({ ...current, operatingProfitJpy: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="ipo-net">当期净利润（JPY・可选）</Label><Input id="ipo-net" inputMode="decimal" value={form.netProfitJpy} onChange={(event) => setForm((current) => ({ ...current, netProfitJpy: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="ipo-note">备注</Label><Input id="ipo-note" maxLength={1000} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">请从正式月次损益表录入。目标比较指标为营业利润，现金参考和GMV不得作为利润代填。</div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={mutation.isPending}>取消</Button><Button onClick={save} disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
