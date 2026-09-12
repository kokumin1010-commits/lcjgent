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
  finance_close: "财务月结",
  audit: "审计",
  internal_control: "内部控制",
  governance: "公司治理",
  legal_disclosure: "法务・披露",
  information_systems: "信息系统",
  capital_markets: "资本市场",
};
const STATUS_LABELS: Record<string, string> = { todo: "未开始", in_progress: "进行中", blocked: "受阻", done: "完成" };
const PRIORITY_LABELS: Record<string, string> = { low: "低", medium: "中", high: "高", critical: "最重要" };
const PNL_STATUS_LABELS: Record<string, string> = { missing: "未登记", draft: "草稿", closed: "月结", audited: "审计" };

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
    const label = (separator >= 0 ? row.slice(0, separator) : "证据").trim();
    const url = (separator >= 0 ? row.slice(separator + 1) : row).trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") throw new Error("HTTPS only");
    } catch {
      throw new Error(`证据链接格式不正确：${row}`);
    }
    evidence.push({ label: label || "证据", url });
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
  const [planForm, setPlanForm] = useState({ month: core.asOfMonth, revenue: "", grossProfit: "", operatingProfit: "", note: "" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    targetOperatingMarginPct: operations.settings.targetOperatingMarginPct == null ? "" : String(operations.settings.targetOperatingMarginPct),
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
    onSuccess: async () => { toast.success("月度计划已保存"); setPlanOpen(false); await refresh(); },
    onError: (error) => toast.error(`月度计划保存失败：${error.message}`),
  });
  const settingsMutation = trpc.cashflow.updateIpoReadinessSettings.useMutation({
    onSuccess: async () => { toast.success("预测与月结设置已保存"); setSettingsOpen(false); await refresh(); },
    onError: (error) => toast.error(`设置保存失败：${error.message}`),
  });
  const taskMutation = trpc.cashflow.saveIpoReadinessTask.useMutation({
    onSuccess: async () => { toast.success("上场准备任务已保存"); setTaskOpen(false); await refresh(); },
    onError: (error) => toast.error(`任务保存失败：${error.message}`),
  });
  const archiveMutation = trpc.cashflow.archiveIpoReadinessTask.useMutation({
    onSuccess: async () => { toast.success("任务已归档"); await refresh(); },
    onError: (error) => toast.error(`任务归档失败：${error.message}`),
  });
  const reportMutation = trpc.cashflow.generateIpoBoardReport.useMutation({
    onSuccess: async (report) => { toast.success(`董事会月报 v${report.versionNumber} 已生成`); setSelectedReport(report as Operations["boardReports"][number]); await refresh(); },
    onError: (error) => toast.error(`董事会月报生成失败：${error.message}`),
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
    { key: "revenue", label: "销售额", value: operations.performanceVariance.revenue },
    { key: "grossProfit", label: "毛利", value: operations.performanceVariance.grossProfit },
    { key: "operatingExpenses", label: "营业费用控制", value: operations.performanceVariance.operatingExpenses },
    { key: "operatingProfit", label: "营业利润", value: operations.performanceVariance.operatingProfit },
  ];

  const openPlan = (row?: TrendRow) => {
    const existing = row ? operations.monthlyPlans.find((plan) => plan.month === row.month) : undefined;
    setPlanForm({
      month: row?.month || core.asOfMonth,
      revenue: existing?.revenueTargetJpy == null ? "" : String(existing.revenueTargetJpy),
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
    try { evidence = parseEvidence(taskForm.evidenceText); } catch (error) { toast.error(error instanceof Error ? error.message : "证据链接格式错误"); return; }
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
            <div><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" />月度目标／正式实绩／现金参考</CardTitle><p className="mt-1 text-xs text-muted-foreground">正式实绩只取月结／审计P/L；现金线只作经营参考。未设置月度覆盖时，阶段目标按月精确均分。</p></div>
            <Button variant="outline" size="sm" onClick={() => openPlan()}><PencilLine className="mr-1.5 h-4 w-4" />编辑月度计划</Button>
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
                <Bar dataKey="plan" name="月度计划营业利润" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Line dataKey="formal" name="正式营业利润" stroke="#059669" strokeWidth={3} connectNulls={false} />
                <Line dataKey="cash" name="经营现金参考" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <Table className="min-w-[1080px]">
              <TableHeader><TableRow><TableHead>月份</TableHead><TableHead className="text-right">月度计划</TableHead><TableHead className="text-right">正式营业利润</TableHead><TableHead className="text-right">正式差额</TableHead><TableHead className="text-right">现金参考</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>{operations.monthlyTrend.map((row) => <TableRow key={row.month}><TableCell className="font-medium">{row.month}</TableCell><TableCell className="text-right">{money(row.planOperatingProfitJpy)}</TableCell><TableCell className="text-right">{money(row.formalOperatingProfitJpy)}</TableCell><TableCell className={`text-right ${row.formalVarianceJpy != null && row.formalVarianceJpy < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(row.formalVarianceJpy)}</TableCell><TableCell className="text-right">{money(row.cashOperatingNetReferenceJpy)}</TableCell><TableCell><Badge variant="outline" className={statusBadge(row.formalStatus)}>{PNL_STATUS_LABELS[row.formalStatus] || row.formalStatus}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openPlan(row)}>计划</Button><Button variant="ghost" size="sm" onClick={() => onOpenPnl(row.month)}>P/L</Button></TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-rose-600" />目标差额反推</CardTitle><Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-1.5 h-4 w-4" />设置假设</Button></div></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-muted-foreground">剩余营业利润目标</p><p className="mt-2 text-xl font-semibold">{money(operations.targetReverse.remainingOperatingProfitJpy)}</p></div><div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-muted-foreground">剩余每月必要营业利润</p><p className="mt-2 text-xl font-semibold">{money(operations.targetReverse.requiredMonthlyOperatingProfitJpy)}</p></div></div>
            {operations.targetReverse.ready ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-sm font-medium text-blue-950">按目标营业利润率 {percentNumber(operations.targetReverse.targetOperatingMarginPct)}</p><p className="mt-2 text-sm text-blue-900">剩余所需销售额 <strong>{money(operations.targetReverse.requiredRemainingRevenueJpy)}</strong>，即每月 <strong>{money(operations.targetReverse.requiredMonthlyRevenueJpy)}</strong>。</p></div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">尚未设置目标营业利润率，因此系统不会推测所需销售额。点击“设置假设”后自动反推。</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-violet-600" />三情景期末预测</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">{operations.scenarios.scenarios.map((scenario) => <div key={scenario.key} className="rounded-xl border p-4"><p className="text-sm font-medium">{scenario.label} <span className="text-xs text-muted-foreground">×{scenario.factor}</span></p><p className="mt-2 text-lg font-semibold">{scenario.formalProjectedOperatingProfitJpy == null ? "待月结" : money(scenario.formalProjectedOperatingProfitJpy)}</p><p className="mt-1 text-xs text-muted-foreground">正式P/L预测</p><p className="mt-3 border-t pt-2 text-xs text-blue-800">现金参考 {money(scenario.cashReferenceProjectedJpy)}</p></div>)}</div>
            <p className="text-xs leading-5 text-muted-foreground">{operations.scenarios.disclaimer}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle>利润差额原因</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{varianceItems.map((item) => <div key={item.key} className="rounded-xl border p-4"><p className="text-sm font-medium">{item.label}</p>{item.value.ready ? <><p className={`mt-2 text-lg font-semibold ${Number(item.value.varianceJpy) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(item.value.varianceJpy)}</p><p className="mt-1 text-xs text-muted-foreground">目标 {money(item.value.targetJpy)}／正式 {money(item.value.actualJpy)}・{item.value.monthCount}个月</p></> : <><p className="mt-2 text-lg font-semibold text-slate-500">待设置目标</p><p className="mt-1 text-xs text-muted-foreground">正式P/L或对应月度目标不足，不进行推测</p></>}</div>)}</div>
          <p className="text-xs leading-5 text-muted-foreground">{operations.performanceVariance.disclaimer}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle>正式P/L利润桥</CardTitle></CardHeader>
          <CardContent>{operations.profitBridge.ready ? <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3">销售额 <strong className="float-right">{money(operations.profitBridge.revenueJpy)}</strong></div><div className="rounded-lg bg-slate-50 p-3">销售原价 <strong className="float-right">{money(operations.profitBridge.costOfSalesJpy)}</strong></div><div className="rounded-lg bg-emerald-50 p-3">毛利 <strong className="float-right">{money(operations.profitBridge.grossProfitJpy)}</strong><p className="mt-1 text-xs text-emerald-800">毛利率 {percentNumber(operations.profitBridge.grossMarginPct)}</p></div><div className="rounded-lg bg-amber-50 p-3">营业费用 <strong className="float-right">{money(operations.profitBridge.operatingExpensesJpy)}</strong></div><div className="rounded-lg bg-blue-50 p-3 sm:col-span-2">营业利润 <strong className="float-right">{money(operations.profitBridge.operatingProfitJpy)}</strong><p className="mt-1 text-xs text-blue-800">营业利润率 {percentNumber(operations.profitBridge.operatingMarginPct)}</p></div></div> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">正式P/L尚未月结，因此销售原价、营业费用和利润率不进行推测。</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle>银行经营现金支出 Top分类</CardTitle></CardHeader>
          <CardContent className="space-y-3">{operations.cashExpenseDrivers.rows.length ? operations.cashExpenseDrivers.rows.map((row) => <div key={`${row.category}-${row.currency}`}><div className="flex items-center justify-between gap-3 text-sm"><span>{row.category}（{row.currency}）</span><span className="font-medium">{money(row.referenceJpy)}・{row.recordCount}件</span></div><Progress className="mt-1.5 h-2" value={(row.share || 0) * 100} /></div>) : <p className="text-sm text-muted-foreground">当前阶段没有经营现金支出分类。</p>}<p className="text-xs text-muted-foreground">{operations.cashExpenseDrivers.disclaimer}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-blue-600" />月结质量日历</CardTitle><div className="text-xs text-muted-foreground">完成率 {percentRatio(operations.closeQuality.closeCompletionRate)}・逾期 {operations.closeQuality.overdueMonths.length}个月</div></div></CardHeader>
        <CardContent><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{operations.closeQuality.calendar.map((row) => <button key={row.month} type="button" onClick={() => onOpenPnl(row.month)} className={`rounded-xl border p-3 text-left hover:border-blue-400 ${row.overdue ? "border-rose-300 bg-rose-50" : "bg-white"}`}><p className="text-sm font-semibold">{row.month}</p><Badge variant="outline" className={`mt-2 ${statusBadge(row.status)}`}>{PNL_STATUS_LABELS[row.status] || row.status}</Badge><p className="mt-2 text-xs text-muted-foreground">期限 {row.dueDate}</p></button>)}</div>{operations.closeQuality.nextRequiredAction && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">下一步：{operations.closeQuality.nextRequiredAction}</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-emerald-600" />上场准备清单・审计证据</CardTitle><p className="mt-1 text-xs text-muted-foreground">完成不等于审计认可；请为完成项保留可验证证据。</p></div><div className="flex gap-2"><Select value={taskFilter} onValueChange={setTaskFilter}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部领域</SelectItem>{Object.entries(WORKSTREAM_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select><Button size="sm" onClick={() => openTask()}><Plus className="mr-1.5 h-4 w-4" />新增任务</Button></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">任务完成率</p><p className="mt-1 text-xl font-semibold">{percentRatio(operations.taskReadiness.completionRate)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">证据覆盖率</p><p className="mt-1 text-xl font-semibold">{percentRatio(operations.taskReadiness.evidenceCoverageRate)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">受阻</p><p className="mt-1 text-xl font-semibold text-rose-700">{operations.taskReadiness.blockedCount}项</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">逾期</p><p className="mt-1 text-xl font-semibold text-rose-700">{operations.taskReadiness.overdueCount}项</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">完成但无证据</p><p className="mt-1 text-xl font-semibold text-amber-700">{operations.taskReadiness.completedWithoutEvidenceCount}项</p></div></div>
          {operations.risks.length > 0 && <div className="grid gap-2 md:grid-cols-2">{operations.risks.map((risk) => <div key={risk.key} className={`rounded-xl border p-3 ${risk.severity === "critical" ? "border-rose-300 bg-rose-50" : risk.severity === "high" ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50"}`}><p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" />{risk.title}</p><p className="mt-1 text-xs leading-5">{risk.detail}</p><p className="mt-1 text-xs font-medium">行动：{risk.action}</p></div>)}</div>}
          <div className="overflow-x-auto rounded-xl border"><Table className="min-w-[1180px]"><TableHeader><TableRow><TableHead>领域／任务</TableHead><TableHead>负责人</TableHead><TableHead>期限</TableHead><TableHead>优先级</TableHead><TableHead>状态</TableHead><TableHead>进度</TableHead><TableHead>证据</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{visibleTasks.map((task) => <TableRow key={task.id}><TableCell className="max-w-[360px]"><p className="font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{WORKSTREAM_LABELS[task.workstream] || task.workstream}{task.blocker ? `・阻塞：${task.blocker}` : ""}</p></TableCell><TableCell>{task.ownerName || "待指定"}</TableCell><TableCell className={!task.dueDate ? "text-amber-700" : ""}>{task.dueDate || "待设置"}</TableCell><TableCell>{PRIORITY_LABELS[task.priority] || task.priority}</TableCell><TableCell><Badge variant="outline" className={statusBadge(task.status)}>{STATUS_LABELS[task.status] || task.status}</Badge></TableCell><TableCell className="min-w-[140px]"><Progress value={task.progress} className="h-2" /><span className="mt-1 block text-xs text-muted-foreground">{task.progress}%</span></TableCell><TableCell>{task.evidence.length ? <div className="space-y-1">{task.evidence.slice(0, 3).map((evidence) => <a key={evidence.url} href={evidence.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-700 hover:underline"><Link2 className="h-3 w-3" />{evidence.label}</a>)}</div> : <span className="text-xs text-amber-700">未登记</span>}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openTask(task)}>编辑</Button><Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`归档“${task.title}”？历史审计记录会保留。`)) archiveMutation.mutate({ id: task.id }); }} disabled={archiveMutation.isPending}><Trash2 className="h-4 w-4 text-slate-500" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-violet-600" />董事会月报・版本保存</CardTitle><p className="mt-1 text-xs text-muted-foreground">生成时由服务器重新读取正式P/L、银行现金和任务状态，历史版本不会随未来数据变化。</p></div><div className="flex gap-2"><Select value={reportStatus} onValueChange={(value: "draft" | "final") => setReportStatus(value)}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">草稿</SelectItem><SelectItem value="final">最终版</SelectItem></SelectContent></Select><Button onClick={() => reportMutation.mutate({ title: `${core.asOfMonth} 董事会・上场准备月报`, status: reportStatus })} disabled={reportMutation.isPending}>{reportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}生成新版本</Button></div></div></CardHeader>
        <CardContent>{operations.boardReports.length ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{operations.boardReports.map((report) => <button key={report.id} type="button" onClick={() => setSelectedReport(report)} className="rounded-xl border p-4 text-left hover:border-violet-300 hover:bg-violet-50/40"><div className="flex items-center justify-between gap-2"><p className="font-medium">{report.title}</p><Badge variant="outline">v{report.versionNumber}・{report.status === "final" ? "最终版" : "草稿"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{report.asOfMonth}・{report.generatedByName || "系统用户"}</p></button>)}</div> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">尚未生成董事会月报。点击“生成新版本”即可冻结当前数据。</p>}</CardContent>
      </Card>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>月度计划覆盖</DialogTitle><DialogDescription>空白营业利润会继续使用阶段目标的月均分配；销售额和毛利不会自动推测。</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label>月份</Label><Input type="month" value={planForm.month} onChange={(e) => setPlanForm((v) => ({ ...v, month: e.target.value }))} /></div><div className="space-y-2"><Label>销售目标（JPY・可选）</Label><Input value={planForm.revenue} onChange={(e) => setPlanForm((v) => ({ ...v, revenue: e.target.value }))} /></div><div className="space-y-2"><Label>毛利目标（JPY・可选）</Label><Input value={planForm.grossProfit} onChange={(e) => setPlanForm((v) => ({ ...v, grossProfit: e.target.value }))} /></div><div className="space-y-2"><Label>营业利润目标（JPY・可选）</Label><Input value={planForm.operatingProfit} onChange={(e) => setPlanForm((v) => ({ ...v, operatingProfit: e.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>备注</Label><Textarea value={planForm.note} onChange={(e) => setPlanForm((v) => ({ ...v, note: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setPlanOpen(false)}>取消</Button><Button onClick={() => planMutation.mutate({ month: planForm.month, revenueTargetJpy: nullableNumber(planForm.revenue), grossProfitTargetJpy: nullableNumber(planForm.grossProfit), operatingProfitTargetJpy: nullableNumber(planForm.operatingProfit), note: planForm.note || null })} disabled={planMutation.isPending}>{planMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>预测与月结设置</DialogTitle><DialogDescription>这些是可编辑的管理假设，不会改写正式P/L。</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label>目标营业利润率（%・可选）</Label><Input value={settingsForm.targetOperatingMarginPct} onChange={(e) => setSettingsForm((v) => ({ ...v, targetOperatingMarginPct: e.target.value }))} /></div><div className="space-y-2"><Label>月结期限（次月第几日）</Label><Input type="number" min={1} max={31} value={settingsForm.monthlyCloseDueDay} onChange={(e) => setSettingsForm((v) => ({ ...v, monthlyCloseDueDay: e.target.value }))} /></div><div className="space-y-2"><Label>保守系数</Label><Input value={settingsForm.downsideFactor} onChange={(e) => setSettingsForm((v) => ({ ...v, downsideFactor: e.target.value }))} /></div><div className="space-y-2"><Label>当前系数</Label><Input value={settingsForm.baseFactor} onChange={(e) => setSettingsForm((v) => ({ ...v, baseFactor: e.target.value }))} /></div><div className="space-y-2"><Label>冲刺系数</Label><Input value={settingsForm.upsideFactor} onChange={(e) => setSettingsForm((v) => ({ ...v, upsideFactor: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSettingsOpen(false)}>取消</Button><Button onClick={() => settingsMutation.mutate({ targetOperatingMarginPct: nullableNumber(settingsForm.targetOperatingMarginPct), downsideFactor: Number(settingsForm.downsideFactor), baseFactor: Number(settingsForm.baseFactor), upsideFactor: Number(settingsForm.upsideFactor), monthlyCloseDueDay: Number(settingsForm.monthlyCloseDueDay) })} disabled={settingsMutation.isPending}>{settingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{taskForm.id ? "编辑上场准备任务" : "新增上场准备任务"}</DialogTitle><DialogDescription>任务完成状态必须有实际执行依据；证据链接不会自动代表审计认可。</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label>领域</Label><Select value={taskForm.workstream} onValueChange={(value) => setTaskForm((v) => ({ ...v, workstream: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WORKSTREAM_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>任务名称</Label><Input value={taskForm.title} onChange={(e) => setTaskForm((v) => ({ ...v, title: e.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>具体要求</Label><Textarea value={taskForm.description} onChange={(e) => setTaskForm((v) => ({ ...v, description: e.target.value }))} /></div><div className="space-y-2"><Label>负责人</Label><Input value={taskForm.ownerName} onChange={(e) => setTaskForm((v) => ({ ...v, ownerName: e.target.value }))} /></div><div className="space-y-2"><Label>期限</Label><Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((v) => ({ ...v, dueDate: e.target.value }))} /></div><div className="space-y-2"><Label>优先级</Label><Select value={taskForm.priority} onValueChange={(value) => setTaskForm((v) => ({ ...v, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="critical">最重要</SelectItem><SelectItem value="high">高</SelectItem><SelectItem value="medium">中</SelectItem><SelectItem value="low">低</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>状态</Label><Select value={taskForm.status} onValueChange={(value) => setTaskForm((v) => ({ ...v, status: value, progress: value === "done" ? "100" : v.progress }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todo">未开始</SelectItem><SelectItem value="in_progress">进行中</SelectItem><SelectItem value="blocked">受阻</SelectItem><SelectItem value="done">完成</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>进度（0〜100）</Label><Input type="number" min={0} max={100} value={taskForm.progress} onChange={(e) => setTaskForm((v) => ({ ...v, progress: e.target.value }))} /></div><div className="space-y-2"><Label>阻塞原因</Label><Input value={taskForm.blocker} onChange={(e) => setTaskForm((v) => ({ ...v, blocker: e.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>证据链接（每行：名称|https://...）</Label><Textarea className="min-h-[120px]" value={taskForm.evidenceText} onChange={(e) => setTaskForm((v) => ({ ...v, evidenceText: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setTaskOpen(false)}>取消</Button><Button onClick={saveTask} disabled={taskMutation.isPending || !taskForm.title.trim()}>{taskMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(selectedReport)} onOpenChange={(open) => { if (!open) setSelectedReport(null); }}><DialogContent className="max-h-[94vh] max-w-[96vw] overflow-y-auto print:max-h-none print:max-w-none print:border-0 print:shadow-none"><DialogHeader className="print:hidden"><DialogTitle>{selectedReport?.title}</DialogTitle><DialogDescription>版本 {selectedReport?.versionNumber}・{selectedReport?.status === "final" ? "最终版" : "草稿"}</DialogDescription></DialogHeader>{selectedReport && <div className="space-y-5 print:text-black"><div className="hidden print:block"><h1 className="text-2xl font-bold">{selectedReport.title}</h1><p className="mt-1 text-sm">{selectedReport.asOfMonth}・版本 {selectedReport.versionNumber}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">正式营业利润</p><p className="mt-2 text-lg font-semibold">{money(reportSummary?.formalPerformance?.operatingProfitJpy)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">目标差额</p><p className="mt-2 text-lg font-semibold">{money(reportSummary?.formalPerformance?.targetGapJpy)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">现金经营参考</p><p className="mt-2 text-lg font-semibold">{money(reportSummary?.cashReference?.completedOperatingNetReferenceJpy)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">任务完成率</p><p className="mt-2 text-lg font-semibold">{percentRatio(reportSummary?.readiness?.completionRate)}</p></div></div><div><h2 className="text-lg font-semibold">关键风险</h2><div className="mt-2 space-y-2">{(reportSummary?.risks || []).map((risk: any) => <div key={risk.key} className="rounded-lg border p-3"><p className="font-medium">{risk.title}</p><p className="mt-1 text-sm">{risk.detail}</p><p className="mt-1 text-sm">行动：{risk.action}</p></div>)}</div></div><div><h2 className="text-lg font-semibold">口径说明</h2><div className="mt-2 space-y-1">{(reportSummary?.disclaimers || []).map((text: string) => <p key={text} className="text-sm">{text}</p>)}</div></div></div>}<DialogFooter className="print:hidden"><Button variant="outline" onClick={() => setSelectedReport(null)}>关闭</Button><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />打印／另存PDF</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
