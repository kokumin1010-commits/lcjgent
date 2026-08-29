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
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  Loader2,
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

export default function FinanceCommandCenter({ onNavigate }: { onNavigate: (tab: "cashflow" | "imports", drilldown?: CashflowDrilldown) => void }) {
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
  const net30 = data.flows.last30.referenceJpy.net;
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
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">现金状态、风险和今天要处理的事情</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              司令塔不代替财务核对，也不会自动写账。所有数字都可回到现有明细、请求书或导入原文件复核。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onNavigate("cashflow")}>核对入出金<ArrowRight className="ml-2 h-4 w-4" /></Button>
            <Button className="border border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => onNavigate("imports")}>查看导入文件</Button>
            <Button aria-label="刷新司令塔" className="border border-white/20 bg-transparent text-white hover:bg-white/10" size="icon" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">现金余额（JPY参考）</p>
            <p className="mt-2 text-2xl font-semibold">{money(data.balances.referenceJpy)}</p>
            <p className="mt-2 text-xs text-slate-400">日本 {money(data.balances.jpy)} / 中国 {money(data.balances.cny, "CNY")}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">最近30天银行余额变化（JPY参考）</p>
            <p className={`mt-2 text-2xl font-semibold ${net30 < 0 ? "text-rose-300" : "text-emerald-300"}`}>{signedMoney(net30, "JPY")}</p>
            <p className="mt-2 text-xs text-slate-400">含工资与集团内部汇款；原币数据分开保存</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">每月平均净现金消耗（JPY参考）</p>
            <p className={`mt-2 text-2xl font-semibold ${data.runway.referenceMonthlyNetCashBurnJpy > 0 ? "text-amber-200" : "text-emerald-300"}`}>
              {data.runway.referenceMonthlyNetCashBurnJpy > 0 ? money(data.runway.referenceMonthlyNetCashBurnJpy) : "净现金流入"}
            </p>
            <p className="mt-2 text-xs text-slate-400">外部出金 {money(data.runway.referenceMonthlyExpenseJpy)} − 外部入金 {money(data.runway.referenceMonthlyExternalIncomeJpy)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">今日待办</p>
            <p className={`mt-2 text-2xl font-semibold ${data.actionCounts.high ? "text-amber-300" : "text-emerald-300"}`}>{data.actionCounts.total}件</p>
            <p className="mt-2 text-xs text-slate-400">高优先级 {data.actionCounts.high} / 中优先级 {data.actionCounts.medium}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>基准日 {data.asOf}</span>
          <span>1 CNY = {data.referenceRate.cnyToJpy} JPY（参考换算）</span>
          <span>账户更新正常 {freshAccounts}/{data.balances.accounts.length}</span>
        </div>
      </section>

      <Card className={data.runway.ready ? "border-emerald-200" : "border-amber-300 bg-amber-50/40"}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-blue-600" />现金跑道计算明细</CardTitle>
            <Badge variant="outline" className={data.runway.ready ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-800"}>
              {data.runway.ready ? "可计算" : "暂不可判断"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-white p-3">
              <p className="text-xs text-muted-foreground">最近90天外部入金</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">{money(data.runway.externalIncome90d.referenceJpy)}</p>
              <p className="mt-1 text-xs text-muted-foreground">已排除集团内部收款</p>
            </div>
            <div className="rounded-xl border bg-white p-3">
              <p className="text-xs text-muted-foreground">最近90天外部出金</p>
              <p className="mt-1 text-lg font-semibold text-rose-700">{money(data.runway.externalExpense90d.referenceJpy)}</p>
              <p className="mt-1 text-xs text-muted-foreground">包含工资与一次性支出</p>
            </div>
            <div className="rounded-xl border bg-white p-3">
              <p className="text-xs text-muted-foreground">90天净现金消耗</p>
              <p className={`mt-1 text-lg font-semibold ${data.runway.netCashBurn90d.referenceJpy > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {data.runway.netCashBurn90d.referenceJpy > 0 ? money(data.runway.netCashBurn90d.referenceJpy) : `净流入 ${money(Math.abs(data.runway.netCashBurn90d.referenceJpy))}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">外部出金 − 外部入金</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-700">÷ 3 = 每月平均净现金消耗</p>
              <p className="mt-1 text-lg font-semibold text-blue-900">
                {data.runway.referenceMonthlyNetCashBurnJpy > 0 ? money(data.runway.referenceMonthlyNetCashBurnJpy) : "净现金流入"}
              </p>
              <p className="mt-1 text-xs text-blue-700">90天滚动平均，覆盖{data.runway.coverageDays}天</p>
            </div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            集团内部往来已从两边同时排除：内部出金 {money(data.runway.internalTransfer90d.expenseReferenceJpy)} / 内部入金 {money(data.runway.internalTransfer90d.incomeReferenceJpy)}。排除类别：{data.runway.internalTransferCategoriesExcluded.join("、") || "无"}。
          </div>
          {data.runway.ready ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="font-semibold">无新增收入可维持：{data.runway.combinedReferenceMonths}个月</p>
              <p className="mt-1 text-sm">{money(data.balances.referenceJpy)} ÷ {money(data.runway.referenceMonthlyNetCashBurnJpy)} = {data.runway.combinedReferenceMonths}个月</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <p className="font-semibold">现金跑道暂不显示</p>
              <p className="mt-1 text-sm">月均净现金消耗已计算，但现金余额或数据条件尚未满足可靠性要求，不能显示看似确定的月份数。</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {data.runway.unavailableReasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

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
        <p className="mt-1 leading-6">JPY与CNY原币数据始终分开；“JPY参考”仅按1 CNY = {data.referenceRate.cnyToJpy} JPY换算展示。月均净现金消耗 =（最近90天外部出金 − 外部入金）÷ 3；集团内部往来从收支两边同时排除。总出金仍单独保留供核对。只有90天数据完整、内部往来分类明确且所有银行余额基准日有效时，才显示现金跑道。司令塔不修改任何账目。</p>
      </div>
    </div>
  );
}
