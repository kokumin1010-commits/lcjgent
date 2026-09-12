import { trpc } from "@/lib/trpc";
import type { CashflowDrilldown } from "@/lib/cashflowDrilldown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  FileCheck2,
  Gauge,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";

function money(value: number | null | undefined, currency: "JPY" | "CNY" = "JPY") {
  const amount = Number(value || 0);
  if (currency === "CNY") return `¥${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} RMB`;
  return `¥${Math.round(amount).toLocaleString()} JPY`;
}

function signedMoney(value: number, currency: "JPY" | "CNY") {
  const sign = value > 0 ? "+" : "";
  return `${sign}${money(value, currency)}`;
}

function runwayLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "暂不可计算";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}个月`;
}

function confidenceLabel(value: string) {
  if (value === "high") return "高可信";
  if (value === "medium") return "中可信";
  if (value === "low") return "低可信";
  return "数据不足";
}

const scenarioTone: Record<string, string> = {
  conservative: "border-amber-300 bg-amber-50/70",
  base: "border-blue-300 bg-blue-50/70",
  lean: "border-emerald-300 bg-emerald-50/70",
};

function statusLabel(status: string) {
  if (status === "completed") return "完了";
  if (status === "failed") return "失败";
  return "处理中";
}

const moduleLabels: Record<string, string> = {
  bank_statement: "银行流水",
  payroll: "工资表",
  tiktok_orders: "TikTok订单",
  tiktok_payment: "TikTok入金",
  tap: "TAP",
  cap_creator: "CAP Creator",
  cap_product: "CAP Product",
};

export default function FinanceCommandCenter({ onNavigate }: { onNavigate: (tab: "cashflow" | "imports" | "invoices", drilldown?: CashflowDrilldown) => void }) {
  const query = trpc.cashflow.getFinanceCommandCenter.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  }

  if (query.isError || !query.data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">财务司令塔读取失败</p>
            <p className="mt-1 text-sm text-red-700">不会自动写入任何财务数据。请重试或返回入出金明细核对。</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />重试</Button>
            <Button onClick={() => onNavigate("cashflow")}>打开入出金明细</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = query.data;
  const forecast = data.forecast;
  const baseline30 = forecast.baseline30;
  const freshAccounts = data.balances.accounts.filter((item) => item.freshness === "fresh").length;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">CEO / 財務司令塔</Badge>
              <Badge className="border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/10">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />只读汇总
              </Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">现金还能撑多久，未来90天会不会缺钱</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              同时查看可动用现金、预计人工费、已登记应收应付和30／60／90天余额。只使用系统现有证据，不虚构销售增长，也不会自动写账。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onNavigate("cashflow")}>核对入出金<ArrowRight className="ml-2 h-4 w-4" /></Button>
            <Button className="border border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => onNavigate("imports")}>查看导入文件</Button>
            <Button aria-label="刷新司令塔" className="border border-white/20 bg-transparent text-white hover:bg-white/10" size="icon" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">可动用现金（JPY参考）</p>
            <p className="mt-2 text-2xl font-semibold">{money(forecast.availableCash.referenceJpy)}</p>
            <p className={`mt-2 text-xs ${forecast.availableCash.isBankVerified ? "text-emerald-300" : "text-amber-200"}`}>
              {forecast.availableCash.isBankVerified ? "银行余额基准日已核实" : "流水推算值・待补银行余额基准日"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">未来30天预计人工费</p>
            <p className="mt-2 text-2xl font-semibold text-amber-200">{money(forecast.payroll.next30ReferenceJpy)}</p>
            <p className="mt-2 text-xs text-slate-400">{confidenceLabel(forecast.payroll.confidence)}・预算覆盖 {forecast.payroll.budgetCoverageCount}/2</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">未来30天预计净变化</p>
            <p className={`mt-2 text-2xl font-semibold ${baseline30.netChangeReferenceJpy < 0 ? "text-rose-300" : "text-emerald-300"}`}>
              {signedMoney(baseline30.netChangeReferenceJpy, "JPY")}
            </p>
            <p className="mt-2 text-xs text-slate-400">基准情景・只使用已登记应收应付</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">30天后预计余额</p>
            <p className={`mt-2 text-2xl font-semibold ${baseline30.endingBalanceReferenceJpy < 0 ? "text-rose-300" : "text-blue-200"}`}>
              {money(baseline30.endingBalanceReferenceJpy)}
            </p>
            <p className="mt-2 text-xs text-slate-400">预计入金 {money(baseline30.expectedReceiptsReferenceJpy)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">无新增收入压力跑道</p>
            <p className="mt-2 text-2xl font-semibold text-violet-200">{runwayLabel(forecast.runway.zeroRevenueMonths)}</p>
            <p className="mt-2 text-xs text-slate-400">
              {forecast.runway.zeroRevenueEndDate ? `约至 ${forecast.runway.zeroRevenueEndDate}` : "缺少可用支出基线"}{forecast.runway.isEstimate ? "・估算" : ""}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>基准日 {data.asOf}</span>
          <span>1 CNY = {data.referenceRate.cnyToJpy} JPY（参考换算）</span>
          <span>账户更新正常 {freshAccounts}/{data.balances.accounts.length}</span>
          <span>未来预测仅使用已登记应收应付，不外推新销售</span>
        </div>
      </section>

      <Card className="border-blue-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="h-4 w-4 text-blue-600" />未来30／60／90天资金预测
            </CardTitle>
            <Badge variant="outline" className={forecast.dataQuality.warningCount ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-700"}>
              {forecast.dataQuality.warningCount ? `${forecast.dataQuality.warningCount}项数据提示` : "数据条件正常"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">基准情景</p>
              <p className="text-xs text-muted-foreground">全部已登记应收回款・人工费不打折・历史非人工支出100%</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {forecast.scenarios.find((scenario) => scenario.key === "base")?.horizons.map((row) => (
                <div key={row.days} className={`rounded-xl border p-4 ${row.fundingGapReferenceJpy > 0 ? "border-red-300 bg-red-50" : "border-blue-200 bg-blue-50/40"}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">未来{row.days}天</p>
                    <Badge variant="outline">至 {row.endDate}</Badge>
                  </div>
                  <p className={`mt-3 text-2xl font-semibold ${row.endingBalanceReferenceJpy < 0 ? "text-red-700" : "text-slate-950"}`}>
                    {money(row.endingBalanceReferenceJpy)}
                  </p>
                  <p className={`mt-1 text-sm font-medium ${row.netChangeReferenceJpy < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    净变化 {signedMoney(row.netChangeReferenceJpy, "JPY")}
                  </p>
                  <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
                    <p>应收回款 {money(row.expectedReceiptsReferenceJpy)}・{row.receivableCount}件</p>
                    <p>预计人工费 {money(row.payrollOutflowReferenceJpy)}</p>
                    <p>非人工经营支出 {money(row.nonPayrollOutflowReferenceJpy)}</p>
                    <p>已确认应付 {money(row.expectedPaymentsReferenceJpy)}・{row.payableCount}件</p>
                  </div>
                  {row.fundingGapReferenceJpy > 0 && <p className="mt-2 text-sm font-semibold text-red-700">预计缺口 {money(row.fundingGapReferenceJpy)}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">情景比较</p>
            <div className="grid gap-3 lg:grid-cols-3">
              {forecast.scenarios.map((scenario) => (
                <div key={scenario.key} className={`rounded-xl border p-4 ${scenarioTone[scenario.key] || "bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{scenario.label}情景</p>
                    <Badge variant="outline">应收回款 {Math.round(scenario.collectionRate * 100)}%</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{scenario.description}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {scenario.horizons.map((row) => (
                      <div key={row.days} className="rounded-lg bg-white/80 p-2 text-center">
                        <p className="text-[11px] text-muted-foreground">{row.days}天后</p>
                        <p className={`mt-1 text-xs font-semibold ${row.endingBalanceReferenceJpy < 0 ? "text-red-700" : "text-slate-900"}`}>
                          {money(row.endingBalanceReferenceJpy)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="h-4 w-4 text-amber-600" />预计人工费</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs text-amber-800">未来30天（JPY参考）</p>
              <p className="mt-1 text-2xl font-semibold text-amber-950">{money(forecast.payroll.next30ReferenceJpy)}</p>
              <p className="mt-1 text-xs text-amber-800">{confidenceLabel(forecast.payroll.confidence)}・{forecast.payroll.method}</p>
            </div>
            {forecast.payroll.entities.map((entity) => (
              <div key={entity.entity} className="rounded-xl border p-3">
                <div className="flex items-center justify-between"><p className="text-sm font-medium">{entity.entity === "japan" ? "日本法人" : "中国法人"}</p><Badge variant="outline">{entity.budgetConfigured ? "使用预算" : "历史平均"}</Badge></div>
                <p className="mt-2 font-semibold">{money(entity.monthlyBase, entity.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">样本月 {entity.sampleMonths.join("、") || "不足"}{entity.latestDataMonthIncomplete ? `・${entity.latestDataMonth}未完整` : ""}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-blue-600" />确定应收应付</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">未结清应收</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">{money(forecast.commitments.receivable.referenceJpy)}</p>
              <p className="mt-1 text-xs text-emerald-700">{forecast.commitments.receivable.count}件・只按请求书预计日期纳入</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs text-rose-700">未结清应付</p>
              <p className="mt-1 text-2xl font-semibold text-rose-900">{money(forecast.commitments.payable.referenceJpy)}</p>
              <p className="mt-1 text-xs text-rose-700">{forecast.commitments.payable.count}件</p>
            </div>
            {forecast.commitments.overdueReceivable.count > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">逾期应收 {forecast.commitments.overdueReceivable.count}件</p>
                <p className="mt-1">{money(forecast.commitments.overdueReceivable.referenceJpy)}・预测按当前起算日纳入</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={forecast.runway.isEstimate ? "border-amber-300 bg-amber-50/30" : "border-emerald-200"}>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-violet-600" />公司现金跑道</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-muted-foreground">没有任何新增收入时</p>
              <p className="mt-1 text-2xl font-semibold">{runwayLabel(forecast.runway.zeroRevenueMonths)}</p>
              <p className="mt-1 text-xs text-muted-foreground">预计维持至 {forecast.runway.zeroRevenueEndDate || "暂不可计算"}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-muted-foreground">已登记应收全部回款时</p>
              <p className="mt-1 text-xl font-semibold text-emerald-700">{runwayLabel(forecast.runway.registeredReceiptsRunwayMonths)}</p>
              <p className="mt-1 text-xs text-muted-foreground">预计维持至 {forecast.runway.registeredReceiptsRunwayEndDate || "暂不可计算"}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
              每月固定消耗参考：预计人工费 {money(forecast.payroll.monthlyReferenceJpy)} ＋ 非人工经营支出 {money(forecast.operatingCosts.monthlyNonPayrollExpenseReferenceJpy)}。
            </div>
            {forecast.runway.isEstimate && <p className="text-xs font-medium text-amber-800">当前余额没有有效银行基准日，因此跑道标记为估算，不代表银行已核实现金。</p>}
          </CardContent>
        </Card>
      </div>

      {forecast.dataQuality.warnings.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-700" />预测数据质量</CardTitle></CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {forecast.dataQuality.warnings.map((warning) => <div key={warning} className="rounded-lg border border-amber-200 bg-white p-3 text-sm text-amber-900">{warning}</div>)}
          </CardContent>
        </Card>
      )}

      {forecast.actions.length > 0 && (
        <Card className="border-violet-200">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-violet-600" />未来资金行动</CardTitle></CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {forecast.actions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => onNavigate(action.target === "invoices" ? "invoices" : "cashflow")}
                className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/40"
              >
                <div>
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{action.detail}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-violet-500" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Banknote className="h-4 w-4 text-blue-600" />账户余额与数据新鲜度</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.balances.accounts.map((account) => (
              <div key={account.accountName} className="flex flex-col justify-between gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium">{account.accountName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">最后余额日 {account.asOf || "未登记"}{account.staleDays != null ? ` · ${account.staleDays}日前` : ""}</p>
                </div>
                <div className="flex items-center gap-3 sm:text-right">
                  <p className={`font-semibold ${account.amount < 0 ? "text-red-600" : "text-slate-900"}`}>{money(account.amount, account.currency)}</p>
                  <Badge variant="outline" className={account.freshness === "fresh" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-800"}>
                    {account.freshness === "fresh" ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                    {account.freshness === "fresh" ? "最新" : account.freshness === "missing" ? "基准日缺失" : "要更新"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-emerald-600" />7天／30天银行余额变化</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {([7, 30] as const).map((days) => {
              const period = days === 7 ? data.flows.last7 : data.flows.last30;
              return (
                <div key={days} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between"><p className="font-medium">最近{days}天</p><Badge variant="outline">{period.transactionCount}件</Badge></div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-700">入金</p><p className="mt-1 font-semibold text-emerald-800">{money(period.jpy.income)}</p><p className="text-xs text-emerald-700">{money(period.cny.income, "CNY")}</p></div>
                    <div className="rounded-lg bg-rose-50 p-3"><p className="text-xs text-rose-700">出金</p><p className="mt-1 font-semibold text-rose-800">{money(period.jpy.expense)}</p><p className="text-xs text-rose-700">{money(period.cny.expense, "CNY")}</p></div>
                  </div>
                  <p className={`mt-3 text-sm font-semibold ${period.referenceJpy.net < 0 ? "text-rose-700" : "text-emerald-700"}`}>银行净变化（JPY参考） {signedMoney(period.referenceJpy.net, "JPY")}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-600" />今日行动队列</CardTitle><Badge variant={data.actionCounts.high ? "destructive" : "outline"}>高优先级 {data.actionCounts.high}</Badge></div>
          </CardHeader>
          <CardContent>
            {data.actions.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-800"><CheckCircle2 className="mx-auto mb-2 h-7 w-7" />当前没有系统检测到的待处理异常</div>
            ) : (
              <div className="space-y-2">
                {data.actions.map((action) => (
                  <button key={action.key} type="button" onClick={() => onNavigate(action.targetTab)} className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-slate-50">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`mt-0.5 rounded-full p-1.5 ${action.severity === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}><AlertTriangle className="h-4 w-4" /></div>
                      <div><p className="text-sm font-medium">{action.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{action.detail}</p></div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="h-4 w-4 text-rose-600" />最近30天主要支出</CardTitle></CardHeader>
          <CardContent>
            {data.topExpenseCategories.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无支出数据</p> : (
              <div className="space-y-2">
                {data.topExpenseCategories.map((item) => (
                  <button
                    key={`${item.entity}-${item.currency}-${item.category}`}
                    type="button"
                    onClick={() => onNavigate("cashflow", {
                      entity: item.entity,
                      flowType: "expense",
                      category: item.category,
                      currency: item.currency,
                      startDate: item.startDate,
                      endDate: item.endDate,
                      openReconciliation: true,
                    })}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={`${item.category}の逐笔详情を開く`}
                  >
                    <div>
                      <p className="text-sm font-medium">{item.category}</p>
                      <p className="text-xs text-muted-foreground">{item.count}件・点击看逐笔详情</p>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <p className="text-sm font-semibold">{money(item.amount, item.currency)}</p>
                        <p className="mt-0.5 text-xs font-medium text-blue-700">JPY参考 {money(item.referenceAmountJpy, "JPY")}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-violet-600" />最新导入文件</CardTitle><Button size="sm" variant="outline" onClick={() => onNavigate("imports")}>全部历史<ArrowRight className="ml-1.5 h-4 w-4" /></Button></div>
        </CardHeader>
        <CardContent>
          {data.latestImports.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">新证据链启用后上传的文件会显示在这里</p> : (
            <div className="grid gap-2 md:grid-cols-2">
              {data.latestImports.map((item) => (
                <button key={item.id} type="button" onClick={() => onNavigate("imports")} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileCheck2 className={`h-5 w-5 shrink-0 ${item.status === "failed" ? "text-red-600" : "text-emerald-600"}`} />
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{item.sourceFileName}</p><p className="text-xs text-muted-foreground">{moduleLabels[item.module] || item.module} · 导入{item.importedCount} / 跳过{item.skippedCount}</p></div>
                  </div>
                  <Badge variant={item.status === "failed" ? "destructive" : "outline"}>{statusLabel(item.status)}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">口径说明</p>
        <p className="mt-1 leading-6">JPY与CNY原币始终分开保存，“JPY参考”仅按1 CNY = {data.referenceRate.cnyToJpy} JPY换算。预计人工费优先使用本月预算，未设置时使用最近最多3个完整工资月平均；只返回法人月度合计，不返回员工姓名或个人工资。未来回款和付款只使用未结清请求书及其预计日期，不外推新销售。非人工经营支出使用最近90天月均值，并排除工资和集团内部往来。无新增收入压力跑道 =（当前流水推算余额 − 未付应付）÷（预计月人工费 + 月均非人工经营支出）。余额基准日缺失时结果明确标记为估算。司令塔只读，不修改任何账目。</p>
      </div>
    </div>
  );
}
