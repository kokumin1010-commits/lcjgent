import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, CircleDollarSign, Clock3, Gauge, Settings2, ShieldAlert, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

const money = (value: number | null | undefined, currency: "JPY" | "CNY") => {
  if (value == null) return "未设定";
  return new Intl.NumberFormat(currency === "JPY" ? "ja-JP" : "zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "JPY" ? 0 : 2,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(value).replace("CN¥", "¥");
};

const jpyReference = (value: number | null | undefined) => value == null ? "—" : `≈ ${money(value, "JPY")}`;
const entityLabel = (entity: string) => entity === "japan" ? "日本" : "中国";

const changeLabels: Record<string, string> = {
  new: "新发生工资",
  missing: "本月未出现",
  increased: "增加",
  decreased: "减少",
  unchanged: "不变",
};

const severityStyles: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function PayrollCommandCenter() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const query = trpc.cashflow.getPayrollCommandCenter.useQuery();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [anomaliesOpen, setAnomaliesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [budgetEntity, setBudgetEntity] = useState<"japan" | "china">("japan");
  const [budgetMonth, setBudgetMonth] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [fxMonth, setFxMonth] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [fxSource, setFxSource] = useState("");
  const [departmentEmployee, setDepartmentEmployee] = useState("");
  const [departmentDraft, setDepartmentDraft] = useState("");
  const [anomalyStatus, setAnomalyStatus] = useState<"open" | "in_progress" | "resolved">("open");
  const [anomalyOwner, setAnomalyOwner] = useState("");
  const [anomalyNote, setAnomalyNote] = useState("");

  const invalidate = async () => {
    await utils.cashflow.getPayrollCommandCenter.invalidate();
  };

  const budgetMutation = trpc.cashflow.upsertPayrollBudget.useMutation({
    onSuccess: async () => { toast.success("工资预算已保存"); await invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const fxMutation = trpc.cashflow.upsertPayrollFxRate.useMutation({
    onSuccess: async () => { toast.success("实际汇率已保存"); await invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const departmentMutation = trpc.cashflow.updatePayrollEmployeeDepartment.useMutation({
    onSuccess: async () => { toast.success("员工部门已保存"); await invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const anomalyMutation = trpc.cashflow.updatePayrollAnomalyStatus.useMutation({
    onSuccess: async () => { toast.success("异常处理状态已更新"); setSelectedAnomaly(null); await invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!query.data?.currentMonth) return;
    setBudgetMonth((value) => value || query.data.currentMonth);
    setFxMonth((value) => value || query.data.currentMonth);
  }, [query.data?.currentMonth]);

  const data = query.data;
  const employeeOptions = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    return data.employeeChanges.filter((item: any) => {
      const key = `${item.entity}|${item.employeeName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data]);

  if (query.isLoading) {
    return <div className="mb-4 h-44 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />;
  }
  if (query.isError) {
    return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><div><div className="font-semibold">工资指挥台加载失败</div><div className="mt-1 text-xs">{query.error.message}</div></div><Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>重新加载</Button></div>;
  }
  if (!data) return null;

  const summary = data.summary;
  const activeAnomalies = data.anomalies.filter((item: any) => item.status !== "resolved");
  const topChanges = data.employeeChanges.filter((item: any) => item.status !== "unchanged").slice(0, 8);
  const isAdmin = user?.role === "admin";

  const openAnomalyEditor = (item: any) => {
    setSelectedAnomaly(item);
    setAnomalyStatus(item.status);
    setAnomalyOwner(item.ownerName || "");
    setAnomalyNote(item.note || "");
  };

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-4 py-4 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-semibold">本月工资指挥台</h3>
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">{data.currentMonth}</Badge>
              {data.currentMonthIncomplete && <Badge className="border-amber-300/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/15">可能尚未完整导入</Badge>}
            </div>
            <p className="mt-1 text-[11px] text-slate-300">先看结论与风险，再进入趋势、人员和银行证据</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <Button type="button" size="sm" variant="outline" className="h-8 border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-1.5 h-3.5 w-3.5" />设置</Button>}
            <Button type="button" size="sm" variant="outline" className="h-8 border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white" onClick={() => setDetailsOpen((value) => !value)}>
              {detailsOpen ? <ChevronUp className="mr-1.5 h-3.5 w-3.5" /> : <ChevronDown className="mr-1.5 h-3.5 w-3.5" />}{detailsOpen ? "收起分析" : "展开分析"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/8 p-3">
            <div className="flex items-center justify-between text-[10px] text-slate-300"><span>本月工资总额・JPY参考</span><CircleDollarSign className="h-3.5 w-3.5" /></div>
            <div className="mt-1 text-xl font-bold tabular-nums">{jpyReference(summary.currentTotalJpy)}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-slate-300"><span>日本 {money(summary.currentJpy, "JPY")}</span><span>中国 {money(summary.currentCny, "CNY")}</span></div>
            <div className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${summary.changeJpy >= 0 ? "text-rose-300" : "text-emerald-300"}`}>
              {summary.changeJpy >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              较{data.previousMonth || "上月"} {summary.changeJpy >= 0 ? "+" : ""}{money(summary.changeJpy, "JPY")} {summary.changePercent == null ? "" : `(${summary.changePercent}%)`}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/8 p-3">
            <div className="flex items-center justify-between text-[10px] text-slate-300"><span>付款进度</span><Banknote className="h-3.5 w-3.5" /></div>
            <div className="mt-1 flex items-end justify-between"><span className="text-xl font-bold">{summary.paymentProgress}%</span><span className="text-[10px] text-slate-300">{summary.paidCount}/{summary.employeeCount}人已付</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, summary.paymentProgress)}%` }} /></div>
            <div className="mt-2 text-[10px] text-slate-300">待付 {summary.unpaidCount}人・银行未匹配 {summary.bankUnmatchedCount}件</div>
            <div className="mt-0.5 text-[10px] text-slate-400">日本 {money(summary.unpaidJpy, "JPY")}・中国 {money(summary.unpaidCny, "CNY")}</div>
          </div>

          <button type="button" onClick={() => { setDetailsOpen(true); setAnomaliesOpen(true); }} className="rounded-lg border border-white/10 bg-white/8 p-3 text-left transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            <div className="flex items-center justify-between text-[10px] text-slate-300"><span>风险与待处理</span><ShieldAlert className="h-3.5 w-3.5" /></div>
            <div className="mt-1 text-xl font-bold">{data.anomalyCounts.open + data.anomalyCounts.inProgress}件</div>
            <div className="mt-1 text-[10px] text-slate-300">高优先级 {data.anomalyCounts.high}件・处理中 {data.anomalyCounts.inProgress}件</div>
            <div className="mt-2 text-[10px] font-semibold text-amber-200">点击查看处理队列</div>
          </button>

          <div className="rounded-lg border border-white/10 bg-white/8 p-3">
            <div className="flex items-center justify-between text-[10px] text-slate-300"><span>现金可支撑月数</span><CalendarClock className="h-3.5 w-3.5" /></div>
            <div className="mt-1 text-xl font-bold">{data.runway.combinedReferenceMonths == null ? "—" : `${data.runway.combinedReferenceMonths}个月`}</div>
            <div className="mt-1 text-[10px] text-slate-300">日本 {data.runway.japanMonths ?? "—"}个月・中国 {data.runway.chinaMonths ?? "—"}个月</div>
            <div className="mt-2 text-[10px] text-slate-400">余额基准 {data.runway.balanceAsOf || "最新记录"}・{data.runway.rateType === "actual" ? "实际汇率" : "参考汇率"}</div>
          </div>
        </div>
      </div>

      {detailsOpen && (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between"><h4 className="text-xs font-semibold text-slate-800">预算与实际</h4><Badge variant="outline">{data.currentMonth}</Badge></div>
              <div className="mt-2 space-y-2">
                {data.budgets.map((item: any) => (
                  <div key={item.entity} className="rounded-md bg-slate-50 p-2 text-[11px]">
                    <div className="flex items-center justify-between"><span className="font-semibold">{entityLabel(item.entity)}</span><span className="font-semibold tabular-nums">实际 {money(item.actual, item.currency)}</span></div>
                    <div className="mt-1 flex items-center justify-between text-slate-500"><span>预算 {money(item.budget, item.currency)}</span><span className={item.difference == null ? "" : item.difference > 0 ? "text-rose-600" : "text-emerald-600"}>{item.difference == null ? "尚未设定" : `差额 ${money(item.difference, item.currency)}${item.overrunPercent == null ? "" : `（${item.overrunPercent}%）`}`}</span></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between"><h4 className="text-xs font-semibold text-slate-800">未来工资预测</h4><Badge variant="outline" className={data.forecast.confidence === "low" ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}>{data.forecast.confidence === "low" ? "低置信度" : "中置信度"}</Badge></div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-blue-50 p-2"><div className="text-[10px] text-blue-700">未来3个月・JPY参考</div><div className="mt-1 text-sm font-bold text-blue-900">{jpyReference(data.forecast.threeMonthReferenceJpy)}</div></div>
                <div className="rounded-md bg-indigo-50 p-2"><div className="text-[10px] text-indigo-700">未来6个月・JPY参考</div><div className="mt-1 text-sm font-bold text-indigo-900">{jpyReference(data.forecast.sixMonthReferenceJpy)}</div></div>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">{data.forecast.method}。当前仅有少量历史月份，预测不包含尚未登记的新员工和奖金。</p>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {data.forecast.months.map((item: any) => <div key={item.month} className="rounded bg-slate-50 px-1.5 py-1 text-center"><div className="text-[9px] text-slate-500">{item.month}</div><div className="text-[10px] font-semibold text-slate-700">{jpyReference(item.referenceJpy)}</div></div>)}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between"><h4 className="text-xs font-semibold text-slate-800">汇率口径</h4><Badge variant="outline">{data.exchangeRate.rateType === "actual" ? "实际" : "参考"}</Badge></div>
              <div className="mt-2 text-lg font-bold text-slate-800">1 CNY = {data.exchangeRate.rate} JPY</div>
              <p className="mt-1 text-[10px] text-slate-500">{data.exchangeRate.rateType === "actual" ? data.exchangeRate.sourceNote || "已登记实际汇率" : "本月尚未登记实际汇率，当前所有JPY换算均为参考值"}</p>
              <div className="mt-2 rounded-md bg-slate-50 p-2 text-[10px] text-slate-600">
                <div className="flex justify-between gap-2"><span>参考汇率 {data.exchangeRate.referenceRate}</span><span>{jpyReference(data.exchangeRate.currentCnyReferenceJpy)}</span></div>
                {data.exchangeRate.actualRate && <><div className="mt-1 flex justify-between gap-2"><span>实际汇率 {data.exchangeRate.actualRate}</span><span>{jpyReference(data.exchangeRate.currentCnyActualJpy)}</span></div><div className="mt-1 flex justify-between gap-2 font-semibold"><span>实际－参考</span><span>{money(data.exchangeRate.actualVsReferenceDifferenceJpy, "JPY")}</span></div></>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-600" /><h4 className="text-xs font-semibold text-slate-800">本月较上月变化原因</h4></div>
              {data.currentMonthIncomplete && <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">最新月份可能尚未完整导入，“本月未出现”不等于离职。</div>}
              <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
                {topChanges.length ? topChanges.map((item: any) => (
                  <div key={item.key} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-2 text-[11px]">
                    <div className="min-w-0"><div className="truncate font-semibold text-slate-700">{item.entity === "japan" ? "🇯🇵" : "🇨🇳"} {item.employeeName}{item.wechatName ? `（${item.wechatName}）` : ""}</div><div className="text-[9px] text-slate-500">{item.department || "部门未设定"}・{changeLabels[item.status]}</div></div>
                    <div className={`whitespace-nowrap text-right font-semibold ${item.difference > 0 ? "text-rose-600" : item.difference < 0 ? "text-emerald-600" : "text-slate-500"}`}>{item.difference > 0 ? "+" : ""}{money(item.difference, item.currency)}{item.percent == null ? "" : <div className="text-[9px] font-normal">{item.percent}%</div>}</div>
                  </div>
                )) : <div className="rounded-md bg-slate-50 p-4 text-center text-[11px] text-slate-500">没有工资变化</div>}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-violet-600" /><h4 className="text-xs font-semibold text-slate-800">部门成本</h4></div>
              <div className="space-y-2">
                {data.departmentCosts.map((item: any) => (
                  <div key={item.department} className="rounded-md bg-slate-50 p-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-700">{item.department}</span><span className="text-slate-500">{item.employeeCount}人・{item.sharePercent}%</span></div>
                    <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[10px]"><span>日本 {money(item.jpy, "JPY")}</span><span>中国 {money(item.cny, "CNY")}</span><span className="font-semibold">参考 {jpyReference(item.referenceJpy)}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <button type="button" onClick={() => setAnomaliesOpen((value) => !value)} className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><div><h4 className="text-xs font-semibold text-slate-800">异常处理队列</h4><p className="text-[10px] text-slate-500">高风险优先；低风险资料缺失不会自动修改工资</p></div></div>
              <div className="flex items-center gap-2"><Badge variant="outline" className="border-amber-300 text-amber-700">待处理 {activeAnomalies.length}件</Badge>{anomaliesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
            </button>
            {anomaliesOpen && <div className="mt-3 max-h-96 space-y-2 overflow-auto pr-1">
              {data.anomalies.slice(0, 30).map((item: any) => (
                <div key={item.key} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 ${severityStyles[item.severity]}`}>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-semibold">{item.title}</span><Badge variant="outline" className="h-5 text-[9px]">{item.status === "open" ? "待处理" : item.status === "in_progress" ? "处理中" : "已解决"}</Badge></div><p className="mt-0.5 text-[10px] opacity-80">{item.detail}</p>{item.ownerName && <p className="mt-1 text-[9px] opacity-70">负责人：{item.ownerName}{item.note ? `・${item.note}` : ""}</p>}</div>
                  {isAdmin && <Button type="button" size="sm" variant="outline" className="h-7 bg-white/70 text-[10px]" onClick={() => openAnomalyEditor(item)}>处理</Button>}
                </div>
              ))}
            </div>}
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-500" /><h4 className="text-xs font-semibold text-slate-800">最近工资审计</h4></div>
            {data.auditLogs.length ? <div className="grid gap-1.5 md:grid-cols-2">{data.auditLogs.slice(0, 8).map((item: any) => <div key={item.id} className="rounded-md bg-slate-50 px-2 py-1.5 text-[10px]"><div className="font-semibold text-slate-700">{item.actionLabel}</div><div className="mt-0.5 text-slate-500">{new Date(item.createdAt).toLocaleString()}・{item.userName || `用户ID ${item.userId}`}</div></div>)}</div> : <div className="rounded-md bg-slate-50 p-4 text-center text-[11px] text-slate-500">尚无工资设置审计记录</div>}
          </div>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>工资控制台设置</DialogTitle><DialogDescription>预算、实际汇率和部门必须使用真实资料；未填写时控制台显示“未设定”。</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3"><div className="mb-2 text-sm font-semibold">月度工资预算</div><div className="grid gap-2 sm:grid-cols-3"><Select value={budgetEntity} onValueChange={(value: "japan" | "china") => setBudgetEntity(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="japan">日本 JPY</SelectItem><SelectItem value="china">中国 CNY</SelectItem></SelectContent></Select><Input type="month" value={budgetMonth} onChange={(event) => setBudgetMonth(event.target.value)} /><Input type="number" min="0" step="0.01" placeholder="预算金额" value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} /></div><Button className="mt-2" size="sm" disabled={!budgetMonth || !budgetAmount || budgetMutation.isPending} onClick={() => budgetMutation.mutate({ entity: budgetEntity, payrollMonth: budgetMonth, budgetAmount: Number(budgetAmount) })}>保存预算</Button></div>
            <div className="rounded-lg border p-3"><div className="mb-2 text-sm font-semibold">月度实际汇率（CNY→JPY）</div><div className="grid gap-2 sm:grid-cols-3"><Input type="month" value={fxMonth} onChange={(event) => setFxMonth(event.target.value)} /><Input type="number" min="0.000001" step="0.000001" placeholder="例如 20.5" value={fxRate} onChange={(event) => setFxRate(event.target.value)} /><Input placeholder="汇率来源/备注" value={fxSource} onChange={(event) => setFxSource(event.target.value)} /></div><Button className="mt-2" size="sm" disabled={!fxMonth || !fxRate || fxMutation.isPending} onClick={() => fxMutation.mutate({ payrollMonth: fxMonth, cnyToJpyRate: Number(fxRate), sourceNote: fxSource || undefined })}>保存实际汇率</Button></div>
            <div className="rounded-lg border p-3"><div className="mb-2 text-sm font-semibold">员工部门</div><div className="grid gap-2 sm:grid-cols-2"><Select value={departmentEmployee} onValueChange={setDepartmentEmployee}><SelectTrigger><SelectValue placeholder="选择员工" /></SelectTrigger><SelectContent>{employeeOptions.map((item: any) => <SelectItem key={`${item.entity}|${item.employeeName}`} value={`${item.entity}|${item.employeeName}`}>{entityLabel(item.entity)}・{item.employeeName}</SelectItem>)}</SelectContent></Select><Input placeholder="部门名称；清空表示未设定" value={departmentDraft} onChange={(event) => setDepartmentDraft(event.target.value)} /></div><Button className="mt-2" size="sm" disabled={!departmentEmployee || departmentMutation.isPending} onClick={() => { const [entity, employeeName] = departmentEmployee.split("|"); departmentMutation.mutate({ entity: entity as "japan" | "china", employeeName, department: departmentDraft || undefined }); }}>保存部门</Button></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSettingsOpen(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedAnomaly)} onOpenChange={(open) => !open && setSelectedAnomaly(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>处理工资异常</DialogTitle><DialogDescription>{selectedAnomaly?.title}・{selectedAnomaly?.detail}</DialogDescription></DialogHeader>
          <div className="space-y-3"><Select value={anomalyStatus} onValueChange={(value: "open" | "in_progress" | "resolved") => setAnomalyStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">待处理</SelectItem><SelectItem value="in_progress">处理中</SelectItem><SelectItem value="resolved">已解决</SelectItem></SelectContent></Select><Input placeholder="负责人" value={anomalyOwner} onChange={(event) => setAnomalyOwner(event.target.value)} /><Textarea placeholder="处理备注" value={anomalyNote} onChange={(event) => setAnomalyNote(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setSelectedAnomaly(null)}>取消</Button><Button disabled={anomalyMutation.isPending} onClick={() => selectedAnomaly && anomalyMutation.mutate({ anomalyKey: selectedAnomaly.key, status: anomalyStatus, ownerName: anomalyOwner || undefined, note: anomalyNote || undefined })}>{anomalyStatus === "resolved" ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : null}保存处理状态</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
