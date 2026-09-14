import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, BarChart3, CalendarClock, ClipboardCheck, FileText, Gauge, Link2, Loader2, PencilLine, Plus, Printer, Settings2, Target, Trash2 } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type FinanceCommandCenterData = RouterOutputs["cashflow"]["getFinanceCommandCenter"];
type Operations = FinanceCommandCenterData["ipoOperations"];
type Core = FinanceCommandCenterData["ipoReadiness"];
type Task = Operations["tasks"][number];
type TrendRow = Operations["monthlyTrend"][number];

const WORKSTREAM_LABELS: Record<string, string> = {
  finance_close: "財務・月次決算",
  audit: "監査",
  internal_control: "内部統制",
  governance: "コーポレートガバナンス",
  legal_disclosure: "法務・開示",
  information_systems: "情報システム",
  capital_markets: "資本市場",
};
const STATUS_LABELS: Record<string, string> = { todo: "未着手", in_progress: "進行中", blocked: "保留・阻害あり", done: "完了" };
const PRIORITY_LABELS: Record<string, string> = { low: "低", medium: "中", high: "高", critical: "最重要" };
const PNL_STATUS_LABELS: Record<string, string> = { missing: "未登録", draft: "下書き", closed: "月次決算済み", audited: "監査済み" };

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `¥${Math.round(value).toLocaleString()} JPY`;
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}亿`;
  if (absolute >= 10_000) return `${(value / 10_000).toFixed(0)}万`;
  return Math.round(value).toLocaleString();
}

function percentRatio(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function percentNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function nullableNumber(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusBadge(status: string) {
  if (status === "done" || status === "audited" || status === "closed") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "blocked" || status === "missing") return "border-rose-300 bg-rose-50 text-rose-800";
  if (status === "in_progress" || status === "draft") return "border-blue-300 bg-blue-50 text-blue-800";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function parseEvidence(text: string) {
  const rows = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const evidence: Array<{ label: string; url: string }> = [];
  for (const row of rows) {
    const separator = row.indexOf("|");
    const label = (separator >= 0 ? row.slice(0, separator) : "証拠").trim();
    const url = (separator >= 0 ? row.slice(separator + 1) : row).trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") throw new Error("HTTPS only");
    } catch {
      throw new Error(`証拠リンクの形式が正しくありません：${row}`);
    }
    evidence.push({ label: label || "証拠", url });
  }
  return evidence;
}

export default function IpoReadinessOperationsPanel({ operations, core, onRefresh, onOpenPnl }: {
  operations: Operations;
  core: Core;
  onRefresh: () => Promise<unknown>;
  onOpenPnl: (month?: string) => void;
}) {
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ month: core.asOfMonth, grossProfit: "", operatingProfit: "", note: "" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    downsideFactor: String(operations.settings.downsideFactor),
    baseFactor: String(operations.settings.baseFactor),
    upsideFactor: String(operations.settings.upsideFactor),
    monthlyCloseDueDay: String(operations.settings.monthlyCloseDueDay),
  });
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskForm, setTaskForm] = useState({
    id: undefined as number | undefined,
    workstream: "finance_close",
    title: "",
    description: "",
    ownerName: "",
    priority: "medium",
    status: "todo",
    progress: "0",
    dueDate: "",
    blocker: "",
    evidenceText: "",
  });
  const [reportStatus, setReportStatus] = useState<"draft" | "final">("draft");
  const [selectedReport, setSelectedReport] = useState<Operations["boardReports"][number] | null>(null);

  const refresh = async () => { await onRefresh(); };
  const planMutation = trpc.cashflow.upsertIpoMonthlyPlan.useMutation({
    onSuccess: async () => { toast.success("月次計画を保存しました"); setPlanOpen(false); await refresh(); },
    onError: (error) => toast.error(`月次計画の保存に失敗しました：${error.message}`),
  });
  const settingsMutation = trpc.cashflow.updateIpoReadinessSettings.useMutation({
    onSuccess: async () => { toast.success("予測・月次決算設定を保存しました"); setSettingsOpen(false); await refresh(); },
    onError: (error) => toast.error(`設定の保存に失敗しました：${error.message}`),
  });
  const taskMutation = trpc.cashflow.saveIpoReadinessTask.useMutation({
    onSuccess: async () => { toast.success("上場準備タスクを保存しました"); setTaskOpen(false); await refresh(); },
    onError: (error) => toast.error(`タスクの保存に失敗しました：${error.message}`),
  });
  const archiveMutation = trpc.cashflow.archiveIpoReadinessTask.useMutation({
    onSuccess: async () => { toast.success("タスクをアーカイブしました"); await refresh(); },
    onError: (error) => toast.error(`タスクのアーカイブに失敗しました：${error.message}`),
  });
  const reportMutation = trpc.cashflow.generateIpoBoardReport.useMutation({
    onSuccess: async (report) => { toast.success(`取締役会月報 v${report.versionNumber} を生成しました`); setSelectedReport(report as Operations["boardReports"][number]); await refresh(); },
    onError: (error) => toast.error(`取締役会月報の生成に失敗しました：${error.message}`),
  });

  const visibleTasks = useMemo(() => operations.tasks.filter((task) => taskFilter === "all" || task.workstream === taskFilter), [operations.tasks, taskFilter]);
  const trendChartData = operations.monthlyTrend.map((row) => ({
    ...row,
    label: row.month.slice(2).replace("-", "/"),
    plan: row.planOperatingProfitJpy,
    formal: row.formalOperatingProfitJpy,
    cash: row.cashOperatingNetReferenceJpy,
  }));
  const varianceItems = [
    { key: "revenue", label: "売上高", value: operations.performanceVariance.revenue },
    { key: "grossProfit", label: "売上総利益", value: operations.performanceVariance.grossProfit },
    { key: "operatingExpenses", label: "営業費用管理", value: operations.performanceVariance.operatingExpenses },
    { key: "operatingProfit", label: "営業利益", value: operations.performanceVariance.operatingProfit },
  ];

  const openPlan = (row?: TrendRow) => {
    const existing = row ? operations.monthlyPlans.find((plan) => plan.month === row.month) : undefined;
    setPlanForm({
      month: row?.month || core.asOfMonth,
      grossProfit: existing?.grossProfitTargetJpy == null ? "" : String(existing.grossProfitTargetJpy),
      operatingProfit: existing?.operatingProfitTargetJpy == null ? "" : String(existing.operatingProfitTargetJpy),
      note: existing?.note || "",
    });
    setPlanOpen(true);
  };

  const openTask = (task?: Task) => {
    setTaskForm(task ? {
      id: task.id,
      workstream: task.workstream,
      title: task.title,
      description: task.description || "",
      ownerName: task.ownerName || "",
      priority: task.priority,
      status: task.status,
      progress: String(task.progress),
      dueDate: task.dueDate || "",
      blocker: task.blocker || "",
      evidenceText: task.evidence.map((item) => `${item.label}|${item.url}`).join("\n"),
    } : { id: undefined, workstream: "finance_close", title: "", description: "", ownerName: "", priority: "medium", status: "todo", progress: "0", dueDate: "", blocker: "", evidenceText: "" });
    setTaskOpen(true);
  };

  const saveTask = () => {
    let evidence: Array<{ label: string; url: string }> = [];
    try { evidence = parseEvidence(taskForm.evidenceText); } catch (error) { toast.error(error instanceof Error ? error.message : "証拠リンクの形式が正しくありません"); return; }
    taskMutation.mutate({
      id: taskForm.id,
      workstream: taskForm.workstream as "finance_close" | "audit" | "internal_control" | "governance" | "legal_disclosure" | "information_systems" | "capital_markets",
      title: taskForm.title,
      description: taskForm.description || null,
      ownerName: taskForm.ownerName || null,
      priority: taskForm.priority as "low" | "medium" | "high" | "critical",
      status: taskForm.status as "todo" | "in_progress" | "blocked" | "done",
      progress: taskForm.status === "done" ? 100 : Math.max(0, Math.min(100, Number(taskForm.progress || 0))),
      dueDate: taskForm.dueDate || null,
      blocker: taskForm.blocker || null,
      evidence,
    });
  };

  const reportSummary = selectedReport?.summary as any;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" />月次目標／正式実績／現金参考</CardTitle><p className="mt-1 text-xs text-muted-foreground">正式実績は月次決算済み／監査済みP/Lだけを使用します。現金線は経営参考です。月次上書きがない場合、段階目標を月ごとに正確に配分し、売上目標は営業利益率20%から自動反推します。</p></div>
            <Button variant="outline" size="sm" onClick={() => openPlan()}><PencilLine className="mr-1.5 h-4 w-4" />月次計画を編集</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendChartData} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis tickFormatter={(value) => compactMoney(Number(value))} fontSize={11} width={56} />
                <Tooltip formatter={(value: any, name: any) => [money(Number(value)), name]} />
                <Legend />
                <Bar dataKey="plan" name="月次計画営業利益" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Line dataKey="formal" name="正式営業利益" stroke="#059669" strokeWidth={3} connectNulls={false} />
                <Line dataKey="cash" name="営業キャッシュ参考" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <Table className="min-w-[1380px]">
              <TableHeader><TableRow><TableHead>対象月</TableHead><TableHead className="text-right">売上目標</TableHead><TableHead className="text-right">営業費用上限</TableHead><TableHead className="text-right">営業利益目標</TableHead><TableHead className="text-right">正式売上高</TableHead><TableHead className="text-right">正式営業利益</TableHead><TableHead className="text-right">正式差額</TableHead><TableHead className="text-right">現金参考</TableHead><TableHead>状態</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>{operations.monthlyTrend.map((row) => <TableRow key={row.month}><TableCell className="font-medium">{row.month}</TableCell><TableCell className="text-right">{money(row.revenueTargetJpy)}<span className="block text-[11px] text-muted-foreground">営業利益率20%</span></TableCell><TableCell className="text-right">{money(row.operatingCostTargetJpy)}</TableCell><TableCell className="text-right">{money(row.planOperatingProfitJpy)}</TableCell><TableCell className="text-right">{money(row.formalRevenueJpy)}</TableCell><TableCell className="text-right">{money(row.formalOperatingProfitJpy)}</TableCell><TableCell className={`text-right ${row.formalVarianceJpy != null && row.formalVarianceJpy < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(row.formalVarianceJpy)}</TableCell><TableCell className="text-right">{money(row.cashOperatingNetReferenceJpy)}</TableCell><TableCell><Badge variant="outline" className={statusBadge(row.formalStatus)}>{PNL_STATUS_LABELS[row.formalStatus] || row.formalStatus}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openPlan(row)}>計画</Button><Button variant="ghost" size="sm" onClick={() => onOpenPnl(row.month)}>P/L</Button></TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-rose-600" />目標差額から必要売上高を反推</CardTitle><Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-1.5 h-4 w-4" />予測設定</Button></div></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-muted-foreground">残りの営業利益目標</p><p className="mt-2 text-xl font-semibold">{money(operations.targetReverse.remainingOperatingProfitJpy)}</p></div><div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-muted-foreground">残り期間の月次必要営業利益</p><p className="mt-2 text-xl font-semibold">{money(operations.targetReverse.requiredMonthlyOperatingProfitJpy)}</p></div></div>
            {operations.targetReverse.ready ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-sm font-medium text-blue-950">目標営業利益率 {percentNumber(operations.targetReverse.targetOperatingMarginPct)}</p><p className="mt-2 text-sm text-blue-900">残り期間に必要な売上高は <strong>{money(operations.targetReverse.requiredRemainingRevenueJpy)}</strong>、月次では <strong>{money(operations.targetReverse.requiredMonthlyRevenueJpy)}</strong> です。商品原価・人件費・広告費等を控除後に20%の営業利益を残す計画です。</p></div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">目標営業利益率が未設定のため、必要売上高を反推できません。</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-violet-600" />3シナリオ期末予測</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">{operations.scenarios.scenarios.map((scenario) => <div key={scenario.key} className="rounded-xl border p-4"><p className="text-sm font-medium">{scenario.label} <span className="text-xs text-muted-foreground">×{scenario.factor}</span></p><p className="mt-2 text-lg font-semibold">{scenario.formalProjectedOperatingProfitJpy == null ? "月次決算待ち" : money(scenario.formalProjectedOperatingProfitJpy)}</p><p className="mt-1 text-xs text-muted-foreground">正式P/L予測</p><p className="mt-3 border-t pt-2 text-xs text-blue-800">現金参考 {money(scenario.cashReferenceProjectedJpy)}</p></div>)}</div>
            <p className="text-xs leading-5 text-muted-foreground">{operations.scenarios.disclaimer}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader className="pb-3"><CardTitle>営業利益20%と税金原資</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><p className="text-xs text-muted-foreground">目標営業利益率</p><p className="mt-2 text-xl font-semibold">{percentNumber(operations.taxFunding.targetOperatingMarginPct)}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-muted-foreground">正式営業利益</p><p className="mt-2 text-xl font-semibold">{money(operations.taxFunding.formalOperatingProfitJpy)}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-muted-foreground">正式税引後利益</p><p className="mt-2 text-xl font-semibold">{operations.taxFunding.reconciliationReady ? money(operations.taxFunding.formalNetProfitJpy) : "未登録"}</p></div></div>
          {operations.taxFunding.reconciliationReady && <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm">営業利益から税引後利益までの差額（営業外・特別損益・法人税等を含む）：<strong>{money(operations.taxFunding.operatingProfitToNetProfitDifferenceJpy)}</strong></p>}
          <p className="text-xs leading-5 text-blue-900">{operations.taxFunding.disclaimer}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle>利益差額の要因</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{varianceItems.map((item) => <div key={item.key} className="rounded-xl border p-4"><p className="text-sm font-medium">{item.label}</p>{item.value.ready ? <><p className={`mt-2 text-lg font-semibold ${Number(item.value.varianceJpy) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(item.value.varianceJpy)}</p><p className="mt-1 text-xs text-muted-foreground">目標 {money(item.value.targetJpy)}／正式 {money(item.value.actualJpy)}・{item.value.monthCount}か月</p></> : <><p className="mt-2 text-lg font-semibold text-slate-500">目標未設定</p><p className="mt-1 text-xs text-muted-foreground">正式P/Lまたは対象月の目標が不足しているため推測しません</p></>}</div>)}</div>
          <p className="text-xs leading-5 text-muted-foreground">{operations.performanceVariance.disclaimer}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle>正式P/L利益ブリッジ</CardTitle></CardHeader>
          <CardContent>{operations.profitBridge.ready ? <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3">売上高 <strong className="float-right">{money(operations.profitBridge.revenueJpy)}</strong></div><div className="rounded-lg bg-slate-50 p-3">売上原価 <strong className="float-right">{money(operations.profitBridge.costOfSalesJpy)}</strong></div><div className="rounded-lg bg-emerald-50 p-3">売上総利益 <strong className="float-right">{money(operations.profitBridge.grossProfitJpy)}</strong><p className="mt-1 text-xs text-emerald-800">売上総利益率 {percentNumber(operations.profitBridge.grossMarginPct)}</p></div><div className="rounded-lg bg-amber-50 p-3">営業費用 <strong className="float-right">{money(operations.profitBridge.operatingExpensesJpy)}</strong></div><div className="rounded-lg bg-blue-50 p-3 sm:col-span-2">営業利益 <strong className="float-right">{money(operations.profitBridge.operatingProfitJpy)}</strong><p className="mt-1 text-xs text-blue-800">営業利益率 {percentNumber(operations.profitBridge.operatingMarginPct)}</p></div></div> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">正式P/Lが月次決算済みではないため、売上原価・営業費用・利益率は推測しません。</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle>銀行営業キャッシュ支出・上位分類</CardTitle></CardHeader>
          <CardContent className="space-y-3">{operations.cashExpenseDrivers.rows.length ? operations.cashExpenseDrivers.rows.map((row) => <div key={`${row.category}-${row.currency}`}><div className="flex items-center justify-between gap-3 text-sm"><span>{row.category}（{row.currency}）</span><span className="font-medium">{money(row.referenceJpy)}・{row.recordCount}件</span></div><Progress className="mt-1.5 h-2" value={(row.share || 0) * 100} /></div>) : <p className="text-sm text-muted-foreground">現在の段階には営業キャッシュ支出分類がありません。</p>}<p className="text-xs text-muted-foreground">{operations.cashExpenseDrivers.disclaimer}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-blue-600" />月次決算品質カレンダー</CardTitle><div className="text-xs text-muted-foreground">完了率 {percentRatio(operations.closeQuality.closeCompletionRate)}・期限超過 {operations.closeQuality.overdueMonths.length}か月</div></div></CardHeader>
        <CardContent><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{operations.closeQuality.calendar.map((row) => <button key={row.month} type="button" onClick={() => onOpenPnl(row.month)} className={`rounded-xl border p-3 text-left hover:border-blue-400 ${row.overdue ? "border-rose-300 bg-rose-50" : "bg-white"}`}><p className="text-sm font-semibold">{row.month}</p><Badge variant="outline" className={`mt-2 ${statusBadge(row.status)}`}>{PNL_STATUS_LABELS[row.status] || row.status}</Badge><p className="mt-2 text-xs text-muted-foreground">期限 {row.dueDate}</p></button>)}</div>{operations.closeQuality.nextRequiredAction && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">次の対応：{operations.closeQuality.nextRequiredAction}</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-emerald-600" />上場準備チェックリスト・監査証拠</CardTitle><p className="mt-1 text-xs text-muted-foreground">完了は監査承認を意味しません。完了項目には検証可能な証拠を保存してください。</p></div><div className="flex gap-2"><Select value={taskFilter} onValueChange={setTaskFilter}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全領域</SelectItem>{Object.entries(WORKSTREAM_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select><Button size="sm" onClick={() => openTask()}><Plus className="mr-1.5 h-4 w-4" />タスクを追加</Button></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">タスク完了率</p><p className="mt-1 text-xl font-semibold">{percentRatio(operations.taskReadiness.completionRate)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">証拠カバー率</p><p className="mt-1 text-xl font-semibold">{percentRatio(operations.taskReadiness.evidenceCoverageRate)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">阻害あり</p><p className="mt-1 text-xl font-semibold text-rose-700">{operations.taskReadiness.blockedCount}件</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">期限超過</p><p className="mt-1 text-xl font-semibold text-rose-700">{operations.taskReadiness.overdueCount}件</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">完了・証拠なし</p><p className="mt-1 text-xl font-semibold text-amber-700">{operations.taskReadiness.completedWithoutEvidenceCount}件</p></div></div>
          {operations.risks.length > 0 && <div className="grid gap-2 md:grid-cols-2">{operations.risks.map((risk) => <div key={risk.key} className={`rounded-xl border p-3 ${risk.severity === "critical" ? "border-rose-300 bg-rose-50" : risk.severity === "high" ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50"}`}><p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" />{risk.title}</p><p className="mt-1 text-xs leading-5">{risk.detail}</p><p className="mt-1 text-xs font-medium">対応：{risk.action}</p></div>)}</div>}
          <div className="overflow-x-auto rounded-xl border"><Table className="min-w-[1180px]"><TableHeader><TableRow><TableHead>領域／タスク</TableHead><TableHead>責任者</TableHead><TableHead>期限</TableHead><TableHead>優先度</TableHead><TableHead>状態</TableHead><TableHead>進捗</TableHead><TableHead>証拠</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{visibleTasks.map((task) => <TableRow key={task.id}><TableCell className="max-w-[360px]"><p className="font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{WORKSTREAM_LABELS[task.workstream] || task.workstream}{task.blocker ? `・阻害要因：${task.blocker}` : ""}</p></TableCell><TableCell>{task.ownerName || "未指定"}</TableCell><TableCell className={!task.dueDate ? "text-amber-700" : ""}>{task.dueDate || "未設定"}</TableCell><TableCell>{PRIORITY_LABELS[task.priority] || task.priority}</TableCell><TableCell><Badge variant="outline" className={statusBadge(task.status)}>{STATUS_LABELS[task.status] || task.status}</Badge></TableCell><TableCell className="min-w-[140px]"><Progress value={task.progress} className="h-2" /><span className="mt-1 block text-xs text-muted-foreground">{task.progress}%</span></TableCell><TableCell>{task.evidence.length ? <div className="space-y-1">{task.evidence.slice(0, 3).map((evidence) => <a key={evidence.url} href={evidence.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-700 hover:underline"><Link2 className="h-3 w-3" />{evidence.label}</a>)}</div> : <span className="text-xs text-amber-700">未登録</span>}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openTask(task)}>編集</Button><Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`「${task.title}」をアーカイブしますか？監査履歴は保持されます。`)) archiveMutation.mutate({ id: task.id }); }} disabled={archiveMutation.isPending}><Trash2 className="h-4 w-4 text-slate-500" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-violet-600" />取締役会月報・版管理</CardTitle><p className="mt-1 text-xs text-muted-foreground">生成時にサーバーが正式P/L・銀行キャッシュ・タスク状態を再取得します。過去版は将来のデータ変更で書き換わりません。</p></div><div className="flex gap-2"><Select value={reportStatus} onValueChange={(value: "draft" | "final") => setReportStatus(value)}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">下書き</SelectItem><SelectItem value="final">最終版</SelectItem></SelectContent></Select><Button onClick={() => reportMutation.mutate({ title: `${core.asOfMonth} 取締役会・上場準備月報`, status: reportStatus })} disabled={reportMutation.isPending}>{reportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}新しい版を生成</Button></div></div></CardHeader>
        <CardContent>{operations.boardReports.length ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{operations.boardReports.map((report) => <button key={report.id} type="button" onClick={() => setSelectedReport(report)} className="rounded-xl border p-4 text-left hover:border-violet-300 hover:bg-violet-50/40"><div className="flex items-center justify-between gap-2"><p className="font-medium">{report.title}</p><Badge variant="outline">v{report.versionNumber}・{report.status === "final" ? "最終版" : "下書き"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{report.asOfMonth}・{report.generatedByName || "システムユーザー"}</p></button>)}</div> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">取締役会月報はまだ生成されていません。「新しい版を生成」で現在のデータを固定保存できます。</p>}</CardContent>
      </Card>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>月次計画の上書き</DialogTitle><DialogDescription>営業利益目標が空欄の場合は段階目標を月平均で配分します。売上目標が空欄の場合は営業利益率20%から自動反推し、売上総利益は推測しません。</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label>対象月</Label><Input type="month" value={planForm.month} onChange={(e) => setPlanForm((v) => ({ ...v, month: e.target.value }))} /></div><div className="space-y-2"><Label>売上目標（自動計算）</Label><div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">営業利益目標 ÷ 20%</div></div><div className="space-y-2"><Label>売上総利益目標（JPY・任意）</Label><Input value={planForm.grossProfit} onChange={(e) => setPlanForm((v) => ({ ...v, grossProfit: e.target.value }))} /></div><div className="space-y-2"><Label>営業利益目標（JPY・任意）</Label><Input value={planForm.operatingProfit} onChange={(e) => setPlanForm((v) => ({ ...v, operatingProfit: e.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>備考</Label><Textarea value={planForm.note} onChange={(e) => setPlanForm((v) => ({ ...v, note: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setPlanOpen(false)}>キャンセル</Button><Button onClick={() => planMutation.mutate({ month: planForm.month, revenueTargetJpy: null, grossProfitTargetJpy: nullableNumber(planForm.grossProfit), operatingProfitTargetJpy: nullableNumber(planForm.operatingProfit), note: planForm.note || null })} disabled={planMutation.isPending}>{planMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存する</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>予測・月次決算設定</DialogTitle><DialogDescription>予測係数と月次決算期限は管理上の設定であり、正式P/Lを書き換えません。</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label>会社計画の営業利益率</Label><div className="rounded-md border bg-slate-50 px-3 py-2 font-semibold">20%（固定）</div><p className="text-xs text-muted-foreground">商品原価・人件費・広告費等を控除後に残す営業利益率です。</p></div><div className="space-y-2"><Label>月次決算期限（翌月何日）</Label><Input type="number" min={1} max={31} value={settingsForm.monthlyCloseDueDay} onChange={(e) => setSettingsForm((v) => ({ ...v, monthlyCloseDueDay: e.target.value }))} /></div><div className="space-y-2"><Label>保守係数</Label><Input value={settingsForm.downsideFactor} onChange={(e) => setSettingsForm((v) => ({ ...v, downsideFactor: e.target.value }))} /></div><div className="space-y-2"><Label>基本係数</Label><Input value={settingsForm.baseFactor} onChange={(e) => setSettingsForm((v) => ({ ...v, baseFactor: e.target.value }))} /></div><div className="space-y-2"><Label>強化係数</Label><Input value={settingsForm.upsideFactor} onChange={(e) => setSettingsForm((v) => ({ ...v, upsideFactor: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSettingsOpen(false)}>キャンセル</Button><Button onClick={() => settingsMutation.mutate({ targetOperatingMarginPct: 20, downsideFactor: Number(settingsForm.downsideFactor), baseFactor: Number(settingsForm.baseFactor), upsideFactor: Number(settingsForm.upsideFactor), monthlyCloseDueDay: Number(settingsForm.monthlyCloseDueDay) })} disabled={settingsMutation.isPending}>{settingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存する</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{taskForm.id ? "上場準備タスクを編集" : "上場準備タスクを追加"}</DialogTitle><DialogDescription>完了状態には実際の実行根拠が必要です。証拠リンクは監査承認を自動的に意味しません。</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label>領域</Label><Select value={taskForm.workstream} onValueChange={(value) => setTaskForm((v) => ({ ...v, workstream: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WORKSTREAM_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>タスク名</Label><Input value={taskForm.title} onChange={(e) => setTaskForm((v) => ({ ...v, title: e.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>具体的な要件</Label><Textarea value={taskForm.description} onChange={(e) => setTaskForm((v) => ({ ...v, description: e.target.value }))} /></div><div className="space-y-2"><Label>責任者</Label><Input value={taskForm.ownerName} onChange={(e) => setTaskForm((v) => ({ ...v, ownerName: e.target.value }))} /></div><div className="space-y-2"><Label>期限</Label><Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((v) => ({ ...v, dueDate: e.target.value }))} /></div><div className="space-y-2"><Label>優先度</Label><Select value={taskForm.priority} onValueChange={(value) => setTaskForm((v) => ({ ...v, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="critical">最重要</SelectItem><SelectItem value="high">高</SelectItem><SelectItem value="medium">中</SelectItem><SelectItem value="low">低</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>状態</Label><Select value={taskForm.status} onValueChange={(value) => setTaskForm((v) => ({ ...v, status: value, progress: value === "done" ? "100" : v.progress }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todo">未着手</SelectItem><SelectItem value="in_progress">進行中</SelectItem><SelectItem value="blocked">保留・阻害あり</SelectItem><SelectItem value="done">完了</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>進捗（0〜100）</Label><Input type="number" min={0} max={100} value={taskForm.progress} onChange={(e) => setTaskForm((v) => ({ ...v, progress: e.target.value }))} /></div><div className="space-y-2"><Label>阻害要因</Label><Input value={taskForm.blocker} onChange={(e) => setTaskForm((v) => ({ ...v, blocker: e.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>証拠リンク（1行：名称|https://...）</Label><Textarea className="min-h-[120px]" value={taskForm.evidenceText} onChange={(e) => setTaskForm((v) => ({ ...v, evidenceText: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setTaskOpen(false)}>キャンセル</Button><Button onClick={saveTask} disabled={taskMutation.isPending || !taskForm.title.trim()}>{taskMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存する</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(selectedReport)} onOpenChange={(open) => { if (!open) setSelectedReport(null); }}><DialogContent className="max-h-[94vh] max-w-[96vw] overflow-y-auto print:max-h-none print:max-w-none print:border-0 print:shadow-none"><DialogHeader className="print:hidden"><DialogTitle>{selectedReport?.title}</DialogTitle><DialogDescription>版 {selectedReport?.versionNumber}・{selectedReport?.status === "final" ? "最終版" : "下書き"}</DialogDescription></DialogHeader>{selectedReport && <div className="space-y-5 print:text-black"><div className="hidden print:block"><h1 className="text-2xl font-bold">{selectedReport.title}</h1><p className="mt-1 text-sm">{selectedReport.asOfMonth}・版 {selectedReport.versionNumber}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">正式営業利益</p><p className="mt-2 text-lg font-semibold">{money(reportSummary?.formalPerformance?.operatingProfitJpy)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">目標差額</p><p className="mt-2 text-lg font-semibold">{money(reportSummary?.formalPerformance?.targetGapJpy)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">営業キャッシュ参考</p><p className="mt-2 text-lg font-semibold">{money(reportSummary?.cashReference?.completedOperatingNetReferenceJpy)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">タスク完了率</p><p className="mt-2 text-lg font-semibold">{percentRatio(reportSummary?.readiness?.completionRate)}</p></div></div><div><h2 className="text-lg font-semibold">主要リスク</h2><div className="mt-2 space-y-2">{(reportSummary?.risks || []).map((risk: any) => <div key={risk.key} className="rounded-lg border p-3"><p className="font-medium">{risk.title}</p><p className="mt-1 text-sm">{risk.detail}</p><p className="mt-1 text-sm">対応：{risk.action}</p></div>)}</div></div><div><h2 className="text-lg font-semibold">計算口径</h2><div className="mt-2 space-y-1">{(reportSummary?.disclaimers || []).map((text: string) => <p key={text} className="text-sm">{text}</p>)}</div></div></div>}<DialogFooter className="print:hidden"><Button variant="outline" onClick={() => setSelectedReport(null)}>閉じる</Button><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />印刷／PDF保存</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
