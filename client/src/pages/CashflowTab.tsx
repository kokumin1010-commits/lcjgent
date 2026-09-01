import { useEffect, useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Download, Search, Trash2, Edit2, Loader2,
  TrendingUp, TrendingDown, Wallet, Building2, ArrowUpRight, ArrowDownRight,
  ChevronLeft, ChevronRight, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Calendar, Clock,
  Database, ShieldCheck, AlertTriangle, LockKeyhole, Settings2
} from "lucide-react";
import { ChevronDown, ChevronUp, Save, Check } from "lucide-react";
import { FileSpreadsheet, Scale, Users } from "lucide-react";
import { parsePayrollWorkbook } from "@/lib/payrollImport";
import { buildMonthlyPayrollDrilldown, combinePayrollToJpyReference, convertCnyToJpyReference, CNY_TO_JPY_REFERENCE_RATE, toggleMonthlyPayrollDrilldown, type MonthlyPayrollDrilldownSelection } from "@/lib/payrollMonthlyDrilldown";
import { buildPayrollEmployeeAliasClear, buildPayrollEmployeeAliasMap, buildPayrollEmployeeAliasUpdate, formatPayrollEmployeeDisplayName, formatPayrollEmployeeFilterDisplayName, getPayrollEmployeeAliasKey } from "@/lib/payrollEmployeeAlias";
import PayrollCommandCenter from "@/components/PayrollCommandCenter";
import CashflowCategoryManager from "@/components/CashflowCategoryManager";
import { buildCashflowMonthRange } from "@/lib/cashflowMonthFilter";
import type { CashflowDrilldown } from "@/lib/cashflowDrilldown";

function formatCurrency(val: number | string | null | undefined, currency: string = "JPY"): string {
  const num = typeof val === "string" ? parseFloat(val) : (val || 0);
  if (currency === "CNY") {
    return `¥${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} RMB`;
  }
  return `¥${Math.round(num).toLocaleString()}`;
}

function formatExactPayrollTotal(val: number, currency: "JPY" | "CNY"): string {
  const hasFraction = Math.abs(val - Math.round(val)) > 0.001;
  if (currency === "CNY") return `¥${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RMB`;
  return `¥${val.toLocaleString(undefined, { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })} JPY`;
}

// 为替レート表示用
const EXCHANGE_RATE_CNY_JPY = CNY_TO_JPY_REFERENCE_RATE;

const getCategoryLabel = (category: string) => category;
const getCurrencyCategoryLabel = (category: string, currency: "JPY" | "CNY", _isChinaEntity?: boolean) =>
  `${getCategoryLabel(category)} (${currency})`;

function getCategorySourceLabel(source: string | null | undefined, lockedByUser: unknown) {
  if (lockedByUser && source === "manual") return "人工修正";
  if (source === "payroll") return "給与表";
  if (source === "ai_learned") return "AI・人工学習";
  if (source === "ai_rule") return "AI識別";
  if (source === "migration") return "字段迁移";
  return "历史数据";
}

const ACTIVE_SOURCE_ACCOUNTS = ["世曜元宇(中信銀行)", "LCJ MITSUI", "LCJ RESONA"] as const;
const MAX_RECEIPT_FILES = 9;
const FINANCE_IMPORT_MODULE_LABELS: Record<string, string> = {
  bank_statement: "銀行流水",
  payroll: "給与表",
  tiktok_orders: "TikTok注文",
  tiktok_payment: "TikTok入金",
  tap: "TAP",
  cap_creator: "CAP Creator",
  cap_product: "CAP Product",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function parseReceiptUrls(value: unknown): string[] {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === "string") : [value];
  } catch {
    return [value];
  }
} // 1 CNY ≈ 20.5 JPY (参考レート)
function formatWithExchangeRate(val: number | string | null | undefined, currency: string = "JPY"): { main: string; sub: string | null } {
  const num = typeof val === "string" ? parseFloat(val) : (val || 0);
  if (currency === "CNY") {
    const jpyEquiv = convertCnyToJpyReference(num);
    return {
      main: `¥${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} RMB`,
      sub: `≈ ¥${jpyEquiv.toLocaleString()} JPY`,
    };
  }
  return { main: `¥${Math.round(num).toLocaleString()}`, sub: null };
}

function FinanceRecoveryEvidencePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, isError } = trpc.cashflow.recoverySnapshots.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-2xl border bg-slate-50" />;
  }
  if (isError || !data) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          復元財務証跡を読み込めませんでした。现金流主表不会被推测写入。
        </CardContent>
      </Card>
    );
  }

  const labels: Record<string, string> = {
    gross_sales: "销售额快照",
    total_commission: "佣金合计快照",
    partner_commission: "合作方佣金",
    creator_commission: "主播佣金",
    actual_commission_base: "实际佣金计算基数",
    actual_creator_commission: "实际主播佣金",
    bundle_sales: "直播套餐销售额",
  };
  const allSales = data.snapshots.find((row: any) => row.periodLabel === "all" && row.metric === "gross_sales");
  const allCommission = data.snapshots.find((row: any) => row.periodLabel === "all" && row.metric === "total_commission");
  const bundleSales = data.snapshots.find((row: any) => row.metric === "bundle_sales");

  return (
    <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls="finance-recovery-evidence-details"
          className={`flex w-full flex-col gap-3 p-5 text-left transition-colors hover:bg-violet-50/70 sm:flex-row sm:items-center sm:justify-between ${isOpen ? "border-b border-violet-100" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-100 p-2.5"><Database className="h-5 w-5 text-violet-700" /></div>
            <div>
              <h3 className="font-bold text-slate-900">恢复财务证据 / 財務復旧証跡</h3>
              <p className="mt-1 text-xs text-slate-500">保存的销售与佣金汇总已写入Railway MySQL；不等同于银行现金流水</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="w-fit border-emerald-300 bg-emerald-50 text-emerald-700">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />证据快照 {data.snapshots.length}项
            </Badge>
            {isOpen ? <ChevronUp className="h-4 w-4 text-violet-600" /> : <ChevronDown className="h-4 w-4 text-violet-600" />}
          </div>
        </button>

        {isOpen && <div id="finance-recovery-evidence-details">
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">全期间销售额快照</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(allSales?.value)}</p>
            <p className="mt-1 text-[11px] text-slate-400">{Number(allSales?.recordCount || 0).toLocaleString()}条汇总证据</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">全期间佣金快照</p>
            <p className="mt-1 text-xl font-bold text-violet-700">{formatCurrency(allCommission?.value)}</p>
            <p className="mt-1 text-[11px] text-slate-400">不自动计入现金支出</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">3个直播套餐销售额</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{formatCurrency(bundleSales?.value)}</p>
            <p className="mt-1 text-[11px] text-slate-400">72套・发生日期未确认</p>
          </div>
        </div>

        <div className="border-t border-violet-100 px-5 py-4">
          <div className="max-h-72 overflow-auto rounded-xl border bg-white">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr><th className="px-3 py-2">期间</th><th className="px-3 py-2">指标</th><th className="px-3 py-2 text-right">金额</th><th className="px-3 py-2 text-right">记录数</th><th className="px-3 py-2">分类</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.snapshots.map((row: any) => (
                  <tr key={row.evidenceKey} className="text-slate-700">
                    <td className="px-3 py-2 font-medium">{row.periodLabel}</td>
                    <td className="px-3 py-2">{labels[row.metric] || row.metric}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(row.value, row.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(row.recordCount || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-500">销售/佣金证据・非现金流水</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            可直接恢复的公司现金流水为 {data.cashflowBoundary.actualCashflowRowsEligible} 条。`company_cashflows`与支付结算备份没有明细行；2笔订单合计¥1,463只能证明订单，不能证明银行或平台已经结算，因此没有伪造成现金入账。
          </div>
        </div>
        </div>}
      </CardContent>
    </Card>
  );
}

export default function CashflowTab({
  initialDrilldown,
  onInitialDrilldownConsumed,
}: {
  initialDrilldown?: CashflowDrilldown | null;
  onInitialDrilldownConsumed?: () => void;
} = {}) {
  const [entity, setEntity] = useState<"all" | "japan" | "china">(initialDrilldown?.entity || "china");
  const [type, setType] = useState<"all" | "income" | "expense">(initialDrilldown?.flowType || "all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sourceAccountFilter, setSourceAccountFilter] = useState<string>("");
  const [payrollMonthFilter, setPayrollMonthFilter] = useState<string>("");
  const [payrollEmployeeFilter, setPayrollEmployeeFilter] = useState<string>("");
  const [auditLogId, setAuditLogId] = useState<number | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptPreviewUrls, setReceiptPreviewUrls] = useState<string[]>([]);
  const [receiptPreviewIndex, setReceiptPreviewIndex] = useState(0);
  const [receiptPreviewCashflowId, setReceiptPreviewCashflowId] = useState<number | null>(null);
  const [receiptPreviewRequiresPayroll, setReceiptPreviewRequiresPayroll] = useState(false);
  const [pendingReceiptDelete, setPendingReceiptDelete] = useState<{ id: number; index: number; url: string } | null>(null);
  const [dateRange, setDateRange] = useState({ start: initialDrilldown?.startDate || "", end: initialDrilldown?.endDate || "" });
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => Number(initialDrilldown?.startDate?.slice(0, 4) || 2026));
  const [selectedMonth, setSelectedMonth] = useState(() => Number(initialDrilldown?.startDate?.slice(5, 7) || 0));
  const selectedYearMonth = selectedMonth > 0;
  const [expandedCategory, setExpandedCategory] = useState<string | null>(initialDrilldown?.category || null);
  const [expandedCurrency, setExpandedCurrency] = useState<"JPY" | "CNY" | null>(initialDrilldown?.currency || null);
  const [showPayrollDetailsPanel, setShowPayrollDetailsPanel] = useState(false);
  const [isPayrollReconciliationOpen, setIsPayrollReconciliationOpen] = useState(false);
  const [payrollDetailEntity, setPayrollDetailEntity] = useState<"all" | "japan" | "china">("all");
  const [payrollDetailMonth, setPayrollDetailMonth] = useState("");
  const [payrollDetailEmployee, setPayrollDetailEmployee] = useState("");
  const [paidLaborDrilldown, setPaidLaborDrilldown] = useState<"JPY" | "CNY" | null>(null);
  const [monthlyPayrollDrilldown, setMonthlyPayrollDrilldown] = useState<MonthlyPayrollDrilldownSelection | null>(null);
  const [payrollAliasEditor, setPayrollAliasEditor] = useState<{ entity: "japan" | "china"; employeeName: string } | null>(null);
  const [payrollWechatNameDraft, setPayrollWechatNameDraft] = useState("");
  const [payrollAliasNoteDraft, setPayrollAliasNoteDraft] = useState("");
  const [sortBy, setSortBy] = useState<"transactionDate" | "amount" | "category" | "counterparty">("amount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [reconciliationType, setReconciliationType] = useState<"income" | "expense" | null>(initialDrilldown?.openReconciliation ? initialDrilldown.flowType : null);
  const [limit, setLimit] = useState(50);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvStartDate, setCsvStartDate] = useState("");
  const [csvEndDate, setCsvEndDate] = useState("");
  const [csvCounterparty, setCsvCounterparty] = useState("");
  const [csvSourceAccount, setCsvSourceAccount] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pageInput, setPageInput] = useState("");
  const [editBalanceAccount, setEditBalanceAccount] = useState<string | null>(null);
  const [editBalanceValue, setEditBalanceValue] = useState("");
  const [payrollPasswordDialogOpen, setPayrollPasswordDialogOpen] = useState(false);
  const [payrollPassword, setPayrollPassword] = useState("");
  const [payrollUnlockIntent, setPayrollUnlockIntent] = useState<"details" | "upload" | "receiptDelete" | null>(null);
  const payrollWasUnlocked = useRef(false);

  useEffect(() => {
    if (initialDrilldown) onInitialDrilldownConsumed?.();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [entity, type, search, page, limit, sourceAccountFilter, dateRange.start, dateRange.end, expandedCategory, expandedCurrency, sortBy, sortOrder]);

  function toggleSort(col: "transactionDate" | "amount" | "category" | "counterparty") {
    if (sortBy === col) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortOrder(col === "amount" ? "desc" : "desc");
    }
    setPage(0);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortOrder === "desc" ? <ArrowDown className="h-3 w-3 ml-1 text-blue-600" /> : <ArrowUp className="h-3 w-3 ml-1 text-blue-600" />;
  }

  function applyMonthFilter(value: string) {
    if (value === "all") {
      setSelectedMonth(0);
      setDateRange({ start: "", end: "" });
      setPage(0);
      return;
    }
    if (value === "custom") return;
    const range = buildCashflowMonthRange(value);
    if (!range) return;
    setSelectedYear(range.year);
    setSelectedMonth(range.month);
    setDateRange({ start: range.start, end: range.end });
    setPage(0);
  }

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    entity: "japan" as "japan" | "china",
    type: "income" as "income" | "expense",
    category: "",
    amount: "",
    currency: "JPY" as "JPY" | "CNY",
    transactionDate: new Date().toISOString().slice(0, 10),
    description: "",
    counterparty: "",
    sourceAccount: "",
  });

  // Queries
  const trpcUtils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();
  const categoriesQuery = trpc.cashflow.getCategories.useQuery();
  const categoryOptionsFor = (flowType: "income" | "expense", currentCategory?: string | null) => {
    const options = (categoriesQuery.data || []).filter((item) =>
      item.isActive && (item.flowType === "both" || item.flowType === flowType),
    );
    if (currentCategory && !options.some((item) => item.name === currentCategory)) {
      return [{ id: -999999, name: currentCategory, isLegacy: true }, ...options];
    }
    return options;
  };
  const payrollAccessQuery = trpc.cashflow.getPayrollAccessStatus.useQuery(undefined, {
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  const payrollUnlocked = payrollAccessQuery.data?.unlocked === true;
  const accountBalancesQuery = trpc.cashflow.getAccountBalances.useQuery({ entity });
  const setBalanceMutation = trpc.cashflow.setAccountBalance.useMutation({
    onSuccess: () => {
      accountBalancesQuery.refetch();
      setEditBalanceAccount(null);
      toast.success("初期残高を更新しました");
    },
  });
  const summaryQuery = trpc.cashflow.getTotalSummary.useQuery({
    entity,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    sourceAccount: sourceAccountFilter || undefined,
    payrollMonth: payrollMonthFilter || undefined,
    payrollEmployee: payrollEmployeeFilter || undefined,
    category: expandedCategory || undefined,
    currency: expandedCurrency || undefined,
    search: search || undefined,
  });

  const monthOptionsQuery = trpc.cashflow.getMonthlySummary.useQuery({ entity, months: 36 });
  const availableMonths = useMemo(() => {
    const months = new Set<string>((monthOptionsQuery.data || []).map((row: any) => String(row.month || "")).filter((month: string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(month)));
    if (selectedYearMonth) months.add(`${selectedYear}-${String(selectedMonth).padStart(2, "0")}`);
    return Array.from(months).sort((left, right) => right.localeCompare(left));
  }, [monthOptionsQuery.data, selectedMonth, selectedYear, selectedYearMonth]);

  const reconciliationQuery = trpc.cashflow.getReconciliation.useQuery({
    entity,
    flowType: reconciliationType || "expense",
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    sourceAccount: sourceAccountFilter || undefined,
    payrollMonth: payrollMonthFilter || undefined,
    payrollEmployee: payrollEmployeeFilter || undefined,
    category: expandedCategory || undefined,
    currency: expandedCurrency || undefined,
    search: search || undefined,
  }, { enabled: reconciliationType !== null, retry: false });

  const listQuery = trpc.cashflow.getAll.useQuery({
    entity,
    type,
    category: expandedCategory || undefined,
    search: search || undefined,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    page: page + 1,
    pageSize: limit,
    sortBy,
    sortOrder,
    sourceAccount: sourceAccountFilter || undefined,
    currency: expandedCurrency || undefined,
    payrollMonth: payrollMonthFilter || undefined,
    payrollEmployee: payrollEmployeeFilter || undefined,
  });

  const balanceQuery = trpc.cashflow.getBalanceHistory.useQuery({
    entity,
    sourceAccount: sourceAccountFilter || undefined,
  });

  const categoryBreakdownQuery = trpc.cashflow.getCategoryBreakdown.useQuery({
    entity,
    type: "expense",
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    sourceAccount: sourceAccountFilter || undefined,
    payrollMonth: payrollMonthFilter || undefined,
    payrollEmployee: payrollEmployeeFilter || undefined,
  });

  const payrollReconciliationQuery = trpc.cashflow.getPayrollReconciliation.useQuery({
    entity,
    payrollMonth: payrollMonthFilter || undefined,
    payrollEmployee: payrollEmployeeFilter || undefined,
  }, { enabled: payrollUnlocked, retry: false });

  const payrollDetailsQuery = trpc.cashflow.getPayrollReconciliation.useQuery({
    entity: payrollDetailEntity,
    payrollMonth: payrollDetailMonth || undefined,
    payrollEmployee: payrollDetailEmployee || undefined,
  }, { enabled: payrollUnlocked, retry: false });

  const categoryBreakdown = categoryBreakdownQuery.data || [];

  useEffect(() => {
    if (payrollWasUnlocked.current && !payrollUnlocked && !payrollAccessQuery.isLoading) {
      setShowPayrollDetailsPanel(false);
      setIsPayrollReconciliationOpen(false);
      setPayrollMonthFilter("");
      setPayrollEmployeeFilter("");
      setPayrollAliasEditor(null);
      setMonthlyPayrollDrilldown(null);
      void Promise.all([
        trpcUtils.cashflow.getPayrollReconciliation.reset(),
        trpcUtils.cashflow.getPayrollCommandCenter.reset(),
        trpcUtils.cashflow.getAll.invalidate(),
        trpcUtils.cashflow.getTotalSummary.invalidate(),
        trpcUtils.cashflow.getBalanceHistory.invalidate(),
        trpcUtils.cashflow.getCategoryBreakdown.invalidate(),
        trpcUtils.cashflow.getAccountBalances.invalidate(),
      ]);
    }
    payrollWasUnlocked.current = payrollUnlocked;
  }, [payrollAccessQuery.isLoading, payrollUnlocked, trpcUtils]);

  // Mutations
  const unlockPayrollMutation = trpc.cashflow.unlockPayrollAccess.useMutation({
    onSuccess: async () => {
      const intent = payrollUnlockIntent;
      setPayrollPassword("");
      setPayrollPasswordDialogOpen(false);
      setPayrollUnlockIntent(null);
      await payrollAccessQuery.refetch();
      await Promise.all([listQuery.refetch(), summaryQuery.refetch(), balanceQuery.refetch(), categoryBreakdownQuery.refetch()]);
      if (intent === "details") {
        setShowPayrollDetailsPanel(true);
        setIsPayrollReconciliationOpen(true);
      } else if (intent === "upload") {
        window.setTimeout(() => document.getElementById("payroll-file-input")?.click(), 0);
      } else if (intent === "receiptDelete" && pendingReceiptDelete) {
        const target = pendingReceiptDelete;
        setPendingReceiptDelete(null);
        window.setTimeout(() => { void removeReceiptFromPreview(target); }, 0);
      }
      toast.success(intent === "receiptDelete" ? "验证成功，正在删除请求书" : "工资明细已解锁");
    },
    onError: (error) => toast.error(error.message),
  });

  const lockPayrollMutation = trpc.cashflow.lockPayrollAccess.useMutation({
    onSuccess: async () => {
      setShowPayrollDetailsPanel(false);
      setIsPayrollReconciliationOpen(false);
      setPayrollMonthFilter("");
      setPayrollEmployeeFilter("");
      setPayrollDetailEntity("all");
      setPayrollDetailMonth("");
      setPayrollDetailEmployee("");
      setPayrollAliasEditor(null);
      setMonthlyPayrollDrilldown(null);
      await Promise.all([
        trpcUtils.cashflow.getPayrollReconciliation.reset(),
        trpcUtils.cashflow.getPayrollCommandCenter.reset(),
      ]);
      await payrollAccessQuery.refetch();
      await Promise.all([listQuery.refetch(), summaryQuery.refetch(), balanceQuery.refetch(), categoryBreakdownQuery.refetch()]);
      toast.success("給与明細を重新锁定しました");
    },
    onError: (error) => toast.error(error.message),
  });

  const autoClassifyMutation = trpc.cashflow.autoClassify.useMutation({
    onSuccess: (data) => {
      toast.success(`AI分類完了: ${data.updated}件更新。人工修正済みの流水は保護されています`);
      listQuery.refetch();
      categoriesQuery.refetch();
      categoryBreakdownQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.cashflow.create.useMutation({
    onSuccess: () => {
      toast.success("入出金を登録しました");
      setCreateOpen(false);
      resetForm();
      listQuery.refetch();
      summaryQuery.refetch();
      balanceQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.cashflow.update.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(variables.category ? "分类已人工修正，后续AI不会覆盖" : "更新しました");
      setEditId(null);
      resetForm();
      listQuery.refetch();
      categoriesQuery.refetch();
      summaryQuery.refetch();
      categoryBreakdownQuery.refetch();
      balanceQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.cashflow.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      listQuery.refetch();
      summaryQuery.refetch();
      balanceQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const bulkDeleteByIdsMutation = trpc.cashflow.bulkDeleteByIds.useMutation({
    onSuccess: (data) => {
      toast.success(`選択した${data.deleted}件を削除しました`);
      setSelectedIds([]);
      listQuery.refetch();
      summaryQuery.refetch();
      balanceQuery.refetch();
      categoryBreakdownQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const importBankMutation = trpc.cashflow.importBankStatement.useMutation({
    onSuccess: (data) => {
      const categoryResult = data.providedCategoryRows
        ? `・カテゴリ${data.providedCategoryRows}行（既存${data.matchedCategoryNames.length}種／新規${data.createdCategoryNames.length}種／既存流水${data.categoryUpdated}件更新）`
        : "";
      toast.success(`导入完成: ${data.imported}件新規, ${data.skipped}件スキップ(重複)${categoryResult}・原文件已保存`);
      if (data.createdCategoryNames.length > 0) {
        toast.info(`新しいカテゴリを自動追加: ${data.createdCategoryNames.join("、")}`);
      }
      listQuery.refetch();
      summaryQuery.refetch();
      balanceQuery.refetch();
      categoryBreakdownQuery.refetch();
      categoriesQuery.refetch();
      importHistoryQuery.refetch();
      importDocumentsQuery.refetch();
    },
    onError: (e) => toast.error(`导入失败: ${e.message}`),
  });

  const importHistoryQuery = trpc.cashflow.getImportHistory.useQuery({ entity: entity === 'all' ? 'all' : entity });
  const importDocumentsQuery = trpc.cashflow.getImportDocuments.useQuery({ entity: entity === 'all' ? 'all' : entity, limit: 30 });
  const getImportDocumentFileMutation = trpc.cashflow.getImportDocumentFile.useMutation();

  const importPayrollMutation = trpc.cashflow.importPayroll.useMutation({
    onSuccess: (data) => {
      const changed = data.inserted + data.updated + data.linked;
      toast.success(`給与表取込完了: ${data.importedCount}件確認 / ${changed}件反映 / ${data.skipped}件既存・原文件已保存`);
      if (data.anomalies.length > 0) toast.warning(`要確認項目: ${data.anomalies.length}件`);
      listQuery.refetch();
      summaryQuery.refetch();
      balanceQuery.refetch();
      categoryBreakdownQuery.refetch();
      importHistoryQuery.refetch();
      importDocumentsQuery.refetch();
      payrollReconciliationQuery.refetch();
      payrollDetailsQuery.refetch();
    },
    onError: (e) => toast.error(`給与表取込失敗: ${e.message}`),
  });

  const upsertPayrollEmployeeAliasMutation = trpc.cashflow.upsertPayrollEmployeeAlias.useMutation({
    onSuccess: () => {
      toast.success("微信名を保存しました");
      setPayrollAliasEditor(null);
      payrollDetailsQuery.refetch();
      payrollReconciliationQuery.refetch();
    },
    onError: (e) => toast.error(`微信名の保存に失敗しました: ${e.message}`),
  });

  const uploadReceiptMutation = trpc.cashflow.uploadReceipt.useMutation();

  const deleteReceiptMutation = trpc.cashflow.deleteReceipt.useMutation();

  function closeReceiptPreview() {
    setReceiptPreviewUrls([]);
    setReceiptPreviewUrl(null);
    setReceiptPreviewIndex(0);
    setReceiptPreviewCashflowId(null);
    setReceiptPreviewRequiresPayroll(false);
    setPendingReceiptDelete(null);
  }

  async function removeReceiptFromPreview(target: { id: number; index: number; url: string }) {
    try {
      const data = await deleteReceiptMutation.mutateAsync(target);
      if (data.deleted) {
        setReceiptPreviewUrls((current) => {
          const next = [...current];
          if (next[target.index] === target.url) next.splice(target.index, 1);
          else {
            const fallbackIndex = next.indexOf(target.url);
            if (fallbackIndex >= 0) next.splice(fallbackIndex, 1);
          }
          setReceiptPreviewIndex((currentIndex) => Math.max(0, Math.min(currentIndex, next.length - 1)));
          if (next.length === 0) {
            setReceiptPreviewCashflowId(null);
            setReceiptPreviewRequiresPayroll(false);
          }
          return next;
        });
        toast.success("选择的请求书已从记录中删除");
      } else {
        toast.info("该请求书已被删除，列表已更新");
      }
      await listQuery.refetch();
    } catch (error: any) {
      const message = String(error?.message || "删除失败");
      if (message.includes("工资明细") || message.includes("給与明細")) {
        setPendingReceiptDelete(target);
        setPayrollUnlockIntent("receiptDelete");
        setPayrollPassword("");
        setPayrollPasswordDialogOpen(true);
        toast.info("这是工资相关请求书，请先输入财务密码进行二次确认");
        return;
      }
      toast.error(`删除失败: ${message}`);
    }
  }

  function requestReceiptDelete(index: number) {
    if (!receiptPreviewCashflowId || deleteReceiptMutation.isPending) return;
    const url = receiptPreviewUrls[index];
    if (!url) return;
    if (!confirm(`确定删除第${index + 1}份请求书吗？\n删除后会保留操作记录。`)) return;
    const target = { id: receiptPreviewCashflowId, index, url };
    if (receiptPreviewRequiresPayroll && !payrollUnlocked) {
      setPendingReceiptDelete(target);
      setPayrollUnlockIntent("receiptDelete");
      setPayrollPassword("");
      setPayrollPasswordDialogOpen(true);
      return;
    }
    void removeReceiptFromPreview(target);
  }

  async function handleReceiptUpload(cashflowId: number, e: React.ChangeEvent<HTMLInputElement>, existingCount = 0) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const availableSlots = Math.max(0, MAX_RECEIPT_FILES - existingCount);
    if (availableSlots === 0) {
      toast.error(`添付ファイルは最大${MAX_RECEIPT_FILES}件までです`);
      return;
    }
    if (files.length > availableSlots) {
      toast.error(`あと${availableSlots}件まで追加できます`);
      return;
    }
    const oversized = files.find(file => file.size > 5 * 1024 * 1024);
    if (oversized) {
      toast.error(`${oversized.name}: ファイルサイズは5MB以下にしてください`);
      return;
    }

    const readAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    try {
      for (const file of files) {
        const fileData = await readAsBase64(file);
        await uploadReceiptMutation.mutateAsync({
          id: cashflowId,
          fileData,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
        });
      }
      toast.success(`${files.length}件の請求書をアップロードしました`);
      await listQuery.refetch();
    } catch (error: any) {
      toast.error(`アップロード失敗: ${error?.message || '不明なエラー'}`);
    }
  }

  async function handleImportDocumentDownload(id: number) {
    try {
      const file = await getImportDocumentFileMutation.mutateAsync({ id });
      window.open(file.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error?.message || "元ファイルを取得できませんでした");
    }
  }

  async function handleBankStatementUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset input

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const records: { transactionDate: string; counterparty: string; debitAmount?: number; creditAmount?: number; description: string; balance?: number; sourceAccount?: string; category?: string; currency?: "JPY" | "CNY"; entity?: "japan" | "china" }[] = [];

      // Detect format by sheet names or headers
      const sheetNames = wb.SheetNames;
      const hasResona = sheetNames.some(s => s.includes('理索') || s.includes('リソナ'));
      const hasMitsui = sheetNames.some(s => s.includes('三井') || s.includes('ミツイ'));

      if (hasResona || hasMitsui) {
        // === 日本銀行流水フォーマット ===
        for (const sheetName of sheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          if (!rows || rows.length < 2) continue;

          const isResona = sheetName.includes('理索') || sheetName.includes('リソナ');
          const isMitsui = sheetName.includes('三井') || sheetName.includes('ミツイ');
          if (!isResona && !isMitsui) continue;

          const sourceAccount = isResona ? 'LCJ RESONA' : 'LCJ MITSUI';

          if (isResona) {
            // 理索纳: Col2=勘定日, Col4=出金, Col5=入金, Col7=残高, Col12=摘要
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row || !row[2]) continue;
              let dateStr = '';
              const rawDate = row[2];
              if (rawDate instanceof Date) {
                dateStr = rawDate.toISOString().slice(0, 10);
              } else if (typeof rawDate === 'number') {
                const d = new Date((rawDate - 25569) * 86400 * 1000);
                dateStr = d.toISOString().slice(0, 10);
              } else {
                dateStr = String(rawDate).replace(/\//g, '-').slice(0, 10);
              }
              if (!dateStr || dateStr.length < 8) continue;
              const expense = parseFloat(String(row[4] || '0').replace(/,/g, '')) || undefined;
              const income = parseFloat(String(row[5] || '0').replace(/,/g, '')) || undefined;
              if (!expense && !income) continue;
              const desc = String(row[12] || '').trim();
              const balance = parseFloat(String(row[7] || '0').replace(/,/g, '')) || undefined;
              records.push({ transactionDate: dateStr, counterparty: desc, debitAmount: expense, creditAmount: income, description: desc, balance, sourceAccount, currency: "JPY", entity: "japan" });
            }
          } else if (isMitsui) {
            // 三井: Col7=年, Col13=月, Col14=日, Col15=入金, Col16=出金, Col18=摘要, Col19=残高
            // 摘要行(month=null)是取引先名，需要合并到上一条
            let lastRecord: any = null;
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row) continue;
              const year = row[7];
              const month = row[13];
              const day = row[14];
              const income = parseFloat(String(row[15] || '0').replace(/,/g, '')) || undefined;
              const expense = parseFloat(String(row[16] || '0').replace(/,/g, '')) || undefined;
              const desc = String(row[18] || '').trim();
              const balance = parseFloat(String(row[19] || '0').replace(/,/g, '')) || undefined;

              if (month && day && year) {
                // Main transaction row
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                if (income || expense) {
                  lastRecord = { transactionDate: dateStr, counterparty: '', debitAmount: expense, creditAmount: income, description: desc, balance, sourceAccount, currency: "JPY", entity: "japan" };
                  records.push(lastRecord);
                }
              } else if (!month && !day && desc && lastRecord) {
                // Counterparty detail row - append to last record
                lastRecord.counterparty = desc;
              }
            }
          }
        }
      } else {
        // === 中国銀行流水フォーマット（既存ロジック） ===
        const ws = wb.Sheets[sheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        let headerIdx = 0;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const row = rows[i];
          if (row && row.some((c: any) => {
            const s = String(c || '').trim();
            return s.includes('交易日期') || s === '日付' || s === 'Date' || s === 'transactionDate' || s === 'ID';
          })) {
            headerIdx = i;
            break;
          }
        }
        const headers = (rows[headerIdx] || []).map((h: any) => String(h || '').trim());

        const dateCol = headers.findIndex(h => h.includes('交易日期') || h === '日付' || h === 'Date' || h === 'transactionDate');
        const counterpartyCol = headers.findIndex(h => h.includes('对方账户名称') || h === '取引先' || h === 'counterparty');
        const debitCol = headers.findIndex(h => h.includes('借方发生额'));
        const creditCol = headers.findIndex(h => h.includes('贷方发生额'));
        const descCol = headers.findIndex(h => h.includes('摘要') || h === '説明' || h === 'description');
        const balanceCol = headers.findIndex(h => h.includes('账户余额'));
        // システム導出CSVフォーマット検出（ID, 法人, 種別, カテゴリ, 金額, 通貨, 日付, 取引先, 説明, 我方账户）
        const isSystemExport = headers.includes('ID') && headers.includes('金額') && (headers.includes('日付') || headers.includes('種別'));

        if (isSystemExport) {
          // システム導出CSVの再インポート
          const idxDate = headers.findIndex(h => h === '日付');
          const idxEntity = headers.findIndex(h => h === '法人');
          const idxType = headers.findIndex(h => h === '種別');
          const idxCategory = headers.findIndex(h => h === 'カテゴリ');
          const idxAmount = headers.findIndex(h => h === '金額');
            const idxCurrency = headers.findIndex(h => h === '通貨');
          const idxCounterparty = headers.findIndex(h => h === '取引先');
          const idxDesc = headers.findIndex(h => h === '説明');
            const idxAccount = headers.findIndex(h => h === '我方账户');

          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[idxDate >= 0 ? idxDate : 0]) continue;
            let dateStr = '';
            const rawDate = row[idxDate >= 0 ? idxDate : 0];
            if (rawDate instanceof Date) {
              dateStr = rawDate.toISOString().slice(0, 10);
            } else if (typeof rawDate === 'number') {
              const d = new Date((rawDate - 25569) * 86400 * 1000);
              dateStr = d.toISOString().slice(0, 10);
            } else {
              dateStr = String(rawDate).replace(/\//g, '-').slice(0, 10);
            }
            if (!dateStr || dateStr.length < 8) continue;
            const amount = parseFloat(String(row[idxAmount >= 0 ? idxAmount : 0] || '0').replace(/,/g, '')) || 0;
            if (!amount) continue;
            const type = String(row[idxType >= 0 ? idxType : 0] || '').trim();
            const isExpense = type === '出金' || type === 'expense';
            const exportedCurrency = String(row[idxCurrency >= 0 ? idxCurrency : 0] || '').trim() === 'CNY' ? 'CNY' : 'JPY';
            const exportedEntityText = String(row[idxEntity >= 0 ? idxEntity : 0] || '').trim();
            const exportedEntity = exportedEntityText.includes('中国') || exportedEntityText === 'china' ? 'china' : 'japan';
            records.push({
              transactionDate: dateStr,
              counterparty: String(row[idxCounterparty >= 0 ? idxCounterparty : 0] || '').trim(),
              debitAmount: isExpense ? amount : undefined,
              creditAmount: !isExpense ? amount : undefined,
              description: String(row[idxDesc >= 0 ? idxDesc : 0] || '').trim(),
              sourceAccount: String(row[idxAccount >= 0 ? idxAccount : 0] || '').trim() || undefined,
              category: String(row[idxCategory >= 0 ? idxCategory : 0] || '').trim() || undefined,
              currency: exportedCurrency,
              entity: exportedEntity,
            });
          }
        } else if (dateCol >= 0) {
          // 中国銀行流水フォーマット
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[dateCol]) continue;
            let dateStr = '';
            const rawDate = row[dateCol];
            if (rawDate instanceof Date) {
              dateStr = rawDate.toISOString().slice(0, 10);
            } else if (typeof rawDate === 'number') {
              const d = new Date((rawDate - 25569) * 86400 * 1000);
              dateStr = d.toISOString().slice(0, 10);
            } else {
              dateStr = String(rawDate).replace(/\//g, '-').slice(0, 10);
            }
            if (!dateStr || dateStr.length < 8) continue;
            const counterparty = String(row[counterpartyCol] || '').trim();
            const debit = parseFloat(String(row[debitCol] || '0').replace(/,/g, '')) || undefined;
            const credit = parseFloat(String(row[creditCol] || '0').replace(/,/g, '')) || undefined;
            const desc = String(row[descCol >= 0 ? descCol : 0] || '').trim();
            const balance = balanceCol >= 0 ? (parseFloat(String(row[balanceCol] || '0').replace(/,/g, '')) || undefined) : undefined;
            if (!debit && !credit) continue;
            records.push({ transactionDate: dateStr, counterparty, debitAmount: debit, creditAmount: credit, description: desc, balance, currency: "CNY", entity: "china" });
          }
        } else {
          toast.error('无法识别文件格式: 找不到日期列（支持: 交易日期/日付/Date）');
          return;
        }
      }

      if (records.length === 0) {
        toast.error('有効データが0件です。ファイル形式を確認してください');
        return;
      }

      const detectedEntity = (hasResona || hasMitsui) ? 'japan' : (entity === 'all' ? 'china' : entity as 'japan' | 'china');
      toast.info(`解析完了: ${records.length}件、元ファイルを保存してインポート中...`);
      importBankMutation.mutate({
        records,
        entity: detectedEntity,
        sourceFileName: file.name,
        sourceFileBase64: arrayBufferToBase64(data),
        sourceMimeType: file.type || "application/octet-stream",
      });
    } catch (err: any) {
      toast.error(`ファイル解析エラー: ${err.message}`);
    }
  }

  async function handlePayrollUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    try {
      for (const file of files) {
        const detectedEntity = file.name.includes('中国') || file.name.includes('薪资')
          ? 'china'
          : file.name.includes('日本') || file.name.includes('給与')
            ? 'japan'
            : entity === 'all' ? null : entity;
        if (!detectedEntity) {
          throw new Error(`${file.name}: 法人を判定できません。先に日本または中国を選択してください。`);
        }
        const sourceBuffer = await file.arrayBuffer();
        const result = parsePayrollWorkbook(sourceBuffer, file.name, detectedEntity);
        toast.info(`${file.name}: ${result.sheetName}から${result.records.length}件を解析し、元ファイルを保存します`);
        await importPayrollMutation.mutateAsync({
          entity: result.entity,
          fileName: result.fileName,
          sheetName: result.sheetName,
          sourceTotal: result.sourceTotal,
          sourceFileBase64: arrayBufferToBase64(sourceBuffer),
          sourceMimeType: file.type || "application/octet-stream",
          warnings: result.warnings,
          records: result.records,
        });
      }
    } catch (error: any) {
      toast.error(error?.message || '給与表を解析できませんでした');
    }
  }

  function requestPayrollAccess(intent: "details" | "upload") {
    if (payrollAccessQuery.isLoading) return;
    if (payrollUnlocked) {
      if (intent === "details") {
        const next = !showPayrollDetailsPanel;
        setShowPayrollDetailsPanel(next);
        if (next) setIsPayrollReconciliationOpen(true);
      } else {
        document.getElementById("payroll-file-input")?.click();
      }
      return;
    }
    setPayrollUnlockIntent(intent);
    setPayrollPassword("");
    setPayrollPasswordDialogOpen(true);
  }

  function resetForm() {
    setFormData({
      entity: "japan",
      type: "income",
      category: "",
      amount: "",
      currency: "JPY",
      transactionDate: new Date().toISOString().slice(0, 10),
      description: "",
      counterparty: "",
    sourceAccount: "",
    });
  }

  function handleCreate() {
    createMutation.mutate({
      entity: formData.entity,
      type: formData.type,
      category: formData.category,
      amount: Number(formData.amount) || 0,
      currency: formData.currency,
      transactionDate: formData.transactionDate,
      description: formData.description || undefined,
      counterparty: formData.counterparty || undefined,
      sourceAccount: formData.sourceAccount || undefined,
    });
  }

  function handleEdit(item: any) {
    setEditId(item.id);
    setFormData({
      entity: item.entity || "japan",
      type: item.type || "income",
      category: item.category || "",
      amount: String(item.amount || ""),
      currency: item.currency || "JPY",
      transactionDate: item.transactionDate || "",
      description: item.description || "",
      counterparty: item.counterparty || "",
      sourceAccount: item.sourceAccount || "",
    });
  }

  function handleUpdate() {
    if (!editId) return;
    updateMutation.mutate({
      id: editId,
      entity: formData.entity,
      type: formData.type,
      category: formData.category,
      amount: Number(formData.amount) || 0,
      currency: formData.currency,
      transactionDate: formData.transactionDate,
      description: formData.description || undefined,
      counterparty: formData.counterparty || undefined,
          sourceAccount: formData.sourceAccount || undefined,
    });
  }

  // CSV Export
  function openCsvDialog() {
    setCsvStartDate(dateRange.start || "");
    setCsvEndDate(dateRange.end || "");
    setCsvCounterparty("");
    setCsvDialogOpen(true);
  }

  const exportQuery = trpc.cashflow.exportAll.useQuery(
    { entity, type, startDate: csvStartDate || undefined, endDate: csvEndDate || undefined, counterparty: csvCounterparty || undefined, sourceAccount: csvSourceAccount || undefined, payrollMonth: payrollMonthFilter || undefined, payrollEmployee: payrollEmployeeFilter || undefined },
    { enabled: false }
  );

  async function exportCsvWithFilters() {
    const result = await exportQuery.refetch();
    const items = result.data?.items || [];
    if (items.length === 0) {
      toast.error("条件に一致するデータがありません");
      return;
    }
    const headers = ["ID", "法人", "種別", "カテゴリ", "金額", "通貨", "日付", "取引先", "説明", "我方账户", "給与月", "従業員"];
    const rows = items.map((item: any) => [
      item.id,
      item.entity === "japan" ? "日本" : "中国",
      item.type === "income" ? "入金" : "出金",
      item.category,
      item.amount,
      item.currency,
      item.transactionDate,
      item.counterparty || "",
      item.description || "",
      item.sourceAccount || "",
      item.payrollMonth || "",
      item.payrollEmployee || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow_${entity}_${csvStartDate || "all"}_${csvEndDate || "all"}_${csvCounterparty || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setCsvDialogOpen(false);
    toast.success(`${items.length}件のデータをエクスポートしました`);
  }

  const summary = summaryQuery.data;
  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const authoritativeFilteredCount = type === "income"
    ? Number(summary?.incomeCount || 0)
    : type === "expense"
      ? Number(summary?.expenseCount || 0)
      : Number(summary?.totalCount || 0);
  const protectedHiddenCount = Math.max(0, authoritativeFilteredCount - total);
  const totalPages = Math.ceil(total / limit);
  const balanceHistory = balanceQuery.data || [];
  // 月選択時はその月の累積残高を表示、未選択時は最新月
  const currentBalance = (() => {
    // 全法人時: 銀行口座余額の合計を使用（RMB→JPY換算込み）
    if (sourceAccountFilter && accountBalancesQuery.data) {
      const selectedAccount = accountBalancesQuery.data.find((acc: any) => acc.accountName === sourceAccountFilter);
      if (selectedAccount) return Number(selectedAccount.currentBalance || 0);
    }
    if (entity === "all" && accountBalancesQuery.data) {
      let total = 0;
      for (const acc of accountBalancesQuery.data) {
        const bal = Number(acc.currentBalance || 0);
        if (acc.currency === "CNY") {
          total += Math.round(bal * EXCHANGE_RATE_CNY_JPY);
        } else {
          total += bal;
        }
      }
      return total;
    }
    if (balanceHistory.length === 0) return 0;
    if (selectedYearMonth && dateRange.end) {
      // 選択月に対応するbalanceHistoryのエントリを探す
      const targetMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const entry = balanceHistory.find((b: any) => b.month === targetMonth);
      if (entry) return entry.balance;
    }
    return balanceHistory[balanceHistory.length - 1].balance;
  })();

  // 日本・中国別の残高を計算
  const legacyImportHistory = useMemo(() => {
    const preservedIds = new Set((importDocumentsQuery.data || [])
      .map((item: any) => Number(item.relatedImportId || 0))
      .filter((id: number) => id > 0));
    return (importHistoryQuery.data || []).filter((item: any) => !preservedIds.has(Number(item.id || 0)));
  }, [importDocumentsQuery.data, importHistoryQuery.data]);

  const { japanBalance, chinaBalanceRMB, chinaBalanceJPY } = useMemo(() => {
    if (!accountBalancesQuery.data) return { japanBalance: 0, chinaBalanceRMB: 0, chinaBalanceJPY: 0 };
    let jpTotal = 0;
    let cnTotal = 0;
    for (const acc of accountBalancesQuery.data) {
      const bal = Number(acc.currentBalance || 0);
      if (acc.currency === "CNY") {
        cnTotal += bal;
      } else {
        jpTotal += bal;
      }
    }
    return { japanBalance: jpTotal, chinaBalanceRMB: cnTotal, chinaBalanceJPY: Math.round(cnTotal * EXCHANGE_RATE_CNY_JPY) };
  }, [accountBalancesQuery.data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={entity} onValueChange={(v) => {
          setEntity(v as any);
          setPayrollMonthFilter("");
          setPayrollEmployeeFilter("");
          setExpandedCategory(null);
          setExpandedCurrency(null);
          setPage(0);
        }}>
          <SelectTrigger className="w-[140px]">
            <Building2 className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全法人</SelectItem>
            <SelectItem value="japan">🇯🇵 日本</SelectItem>
            <SelectItem value="china">🇨🇳 中国</SelectItem>
          </SelectContent>
        </Select>

        {/* Year-Month Quick Selector */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowYearMonthPicker(!showYearMonthPicker)}
            className="min-w-[140px] justify-start"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {selectedYearMonth ? `${selectedYear}年${selectedMonth}月` : '全期間'}
          </Button>
          {showYearMonthPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border rounded-lg shadow-lg p-4 w-[380px]">
              {/* Year selector */}
              <div className="flex justify-center gap-2 mb-3">
                {[2026, 2025].map(y => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedYear === y ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {y}年
                  </button>
                ))}
              </div>
              {/* Month grid */}
              <div className="grid grid-cols-6 gap-1.5">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedMonth(m);
                      const range = buildCashflowMonthRange(`${selectedYear}-${String(m).padStart(2, "0")}`);
                      if (!range) return;
                      setDateRange({ start: range.start, end: range.end });
                      setPage(0);
                      setShowYearMonthPicker(false);
                    }}
                    className={`px-2 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedMonth === m && selectedYearMonth
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-gradient-to-b from-gray-50 to-gray-100 hover:from-purple-50 hover:to-purple-100 text-gray-700 border'
                    }`}
                  >
                    {m}月
                  </button>
                ))}
              </div>
              {/* Footer */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  選択中: <strong>{selectedYearMonth ? `${selectedYear}年${selectedMonth}月` : '全期間'}</strong>
                </span>
                <button
                  onClick={() => {
                    setSelectedMonth(0);
                    setDateRange({ start: '', end: '' });
                    setPage(0);
                    setShowYearMonthPicker(false);
                  }}
                  className="text-xs text-purple-600 hover:underline"
                >
                  クリア（全期間）
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          {meQuery.data?.role === "admin" && (
            <Button variant="outline" onClick={() => setCategoryManagerOpen(true)}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              分类管理
            </Button>
          )}
          <Button
            type="button"
            variant={showPayrollDetailsPanel ? "secondary" : "outline"}
            aria-pressed={showPayrollDetailsPanel}
            aria-controls="standalone-payroll-details"
            disabled={payrollAccessQuery.isLoading}
            onClick={() => requestPayrollAccess("details")}
          >
            {payrollUnlocked ? <Users className="h-4 w-4 mr-1.5" /> : <LockKeyhole className="h-4 w-4 mr-1.5" />}
            給与明細
          </Button>
          <input id="payroll-file-input" type="file" multiple accept=".xlsx,.xls" className="hidden" onChange={handlePayrollUpload} disabled={importPayrollMutation.isPending || !payrollUnlocked} />
          <Button variant="outline" disabled={importPayrollMutation.isPending || payrollAccessQuery.isLoading} onClick={() => requestPayrollAccess("upload")}>
            {importPayrollMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : payrollUnlocked ? <FileSpreadsheet className="h-4 w-4 mr-1.5" /> : <LockKeyhole className="h-4 w-4 mr-1.5" />}
            給与表取込
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleBankStatementUpload}
            />
            <Button variant="outline" asChild>
              <span>
                <Download className="h-4 w-4 mr-1.5" />
                {entity === 'china' ? '银行流水导入' : '銀行明細インポート'}
              </span>
            </Button>
          </label>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            入出金登録
          </Button>
        </div>
      </div>

      <Dialog open={payrollPasswordDialogOpen} onOpenChange={(open) => {
        setPayrollPasswordDialogOpen(open);
        if (!open) {
          setPayrollPassword("");
          setPayrollUnlockIntent(null);
          setPendingReceiptDelete(null);
        }
      }}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!payrollPassword || unlockPayrollMutation.isPending) return;
            unlockPayrollMutation.mutate({ password: payrollPassword });
          }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-amber-600" />{payrollUnlockIntent === "receiptDelete" ? "删除工资请求书前的二次确认" : "工资明细二次确认"}</DialogTitle>
              <DialogDescription>{payrollUnlockIntent === "receiptDelete" ? "该请求书关联工资项目。请输入与财务管理相同的密码；验证后只删除当前选择的附件，并保留删除记录。" : "工资总额、逐人工资、分析与工资银行证据仅限授权人员。请输入与财务管理相同的密码后进入。"}</DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={payrollPassword}
                onChange={(event) => setPayrollPassword(event.target.value)}
                placeholder="请输入财务管理密码"
                aria-label="财务管理密码"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayrollPasswordDialogOpen(false)}>取消</Button>
              <Button type="submit" disabled={!payrollPassword || unlockPayrollMutation.isPending}>
                {unlockPayrollMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-1.5 h-4 w-4" />}
                {payrollUnlockIntent === "receiptDelete" ? "验证并删除" : "解锁并进入"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Exchange Rate Info - shown when China entity selected */}
      {entity === "china" && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <RefreshCw className="h-4 w-4 text-amber-600" />
          <span className="text-amber-800 font-medium">為替レート参考:</span>
          <span className="text-amber-700">1 CNY ≈ {EXCHANGE_RATE_CNY_JPY} JPY</span>
          <span className="text-amber-500 text-xs ml-2">※金額は全て人民元(RMB)で表示</span>
        </div>
      )}

      {payrollUnlocked && showPayrollDetailsPanel && payrollDetailsQuery.data && payrollDetailsQuery.data.totals.importedCount > 0 && (() => {
        const payrollData = payrollDetailsQuery.data;
        const totals = payrollData.totals;
        const details = payrollData.details || [];
        const paidLaborDetails = (payrollData.paidLaborDetails || []).filter((item: any) => !paidLaborDrilldown || item.currency === paidLaborDrilldown);
        const analytics = payrollData.analytics || { monthlyTotals: [], salaryRanking: { JPY: [], CNY: [] }, allEmployees: [], newEmployees: [] };
        const employeeAliases = payrollData.employeeAliases || [];
        const employeeAliasMap = buildPayrollEmployeeAliasMap(employeeAliases);
        const getEmployeeAlias = (itemEntity: "japan" | "china", employeeName: string) => employeeAliasMap.get(getPayrollEmployeeAliasKey(itemEntity, employeeName));
        const getEmployeeDisplayName = (itemEntity: "japan" | "china", employeeName: string) => formatPayrollEmployeeDisplayName(employeeName, getEmployeeAlias(itemEntity, employeeName)?.wechatName);
        const getEmployeeFilterDisplayName = (employeeName: string) => formatPayrollEmployeeFilterDisplayName(employeeName, payrollDetailEntity, employeeAliases);
        const openPayrollAliasEditor = (itemEntity: "japan" | "china", employeeName: string) => {
          const alias = getEmployeeAlias(itemEntity, employeeName);
          setPayrollAliasEditor({ entity: itemEntity, employeeName });
          setPayrollWechatNameDraft(alias?.wechatName || "");
          setPayrollAliasNoteDraft(alias?.note || "");
        };
        const maxJpyMonthly = Math.max(1, ...analytics.monthlyTotals.map((item: any) => Number(item.jpyTotal || 0)));
        const maxCnyMonthly = Math.max(1, ...analytics.monthlyTotals.map((item: any) => Number(item.cnyTotal || 0)));
        const monthlyDrilldownData = monthlyPayrollDrilldown ? buildMonthlyPayrollDrilldown(details, monthlyPayrollDrilldown) : null;
        const hasDifference = Math.abs(totals.jpyDifference) > 0.01 || Math.abs(totals.cnyDifference) > 0.01 || totals.anomalyCount > 0;
        return (
          <Card id="standalone-payroll-details" className={`border ${hasDifference ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/30'} shadow-sm`}>
            <CardContent className="p-4">
              <button
                type="button"
                onClick={() => setIsPayrollReconciliationOpen((open) => !open)}
                aria-expanded={isPayrollReconciliationOpen}
                aria-controls="payroll-reconciliation-details"
                className="mb-3 flex w-full flex-wrap items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <div className="flex items-center gap-2">
                  <Scale className={`h-4 w-4 ${hasDifference ? 'text-amber-600' : 'text-emerald-600'}`} />
                  <h3 className="font-semibold text-sm">給与明細</h3>
                  <span className="text-xs text-muted-foreground">日本・中国の給与を個人別に確認</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={hasDifference ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-emerald-300 bg-emerald-100 text-emerald-800'}>
                    {hasDifference ? `要確認 ${totals.anomalyCount}件` : '一致'}
                  </Badge>
                  {isPayrollReconciliationOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                </div>
              </button>

              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[150px_160px_minmax(180px,1fr)_auto_auto]">
                <Select value={payrollDetailEntity} onValueChange={(value: "all" | "japan" | "china") => {
                  setPayrollDetailEntity(value);
                  setPayrollDetailMonth("");
                  setPayrollDetailEmployee("");
                  setMonthlyPayrollDrilldown(null);
                }}>
                  <SelectTrigger aria-label="工资国家">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">日本＋中国</SelectItem>
                    <SelectItem value="japan">🇯🇵 日本</SelectItem>
                    <SelectItem value="china">🇨🇳 中国</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={payrollDetailMonth || "all"} onValueChange={(value) => { setPayrollDetailMonth(value === "all" ? "" : value); setMonthlyPayrollDrilldown(null); }}>
                  <SelectTrigger aria-label="工资月">
                    <SelectValue placeholder="給与月" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">給与月: 全て</SelectItem>
                    {payrollData.months.map((month: string) => <SelectItem key={month} value={month}>{month.replace('-', '年')}月</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={payrollDetailEmployee || "all"} onValueChange={(value) => { setPayrollDetailEmployee(value === "all" ? "" : value); setMonthlyPayrollDrilldown(null); }}>
                  <SelectTrigger aria-label="员工姓名">
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue placeholder="従業員" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">従業員: 全て</SelectItem>
                    {payrollData.employees.map((employee: string) => <SelectItem key={employee} value={employee}>{getEmployeeFilterDisplayName(employee)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={payrollDetailEntity === "all" && !payrollDetailMonth && !payrollDetailEmployee}
                  onClick={() => {
                    setPayrollDetailEntity("all");
                    setPayrollDetailMonth("");
                    setPayrollDetailEmployee("");
                    setMonthlyPayrollDrilldown(null);
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重置筛选
                </Button>
                <Button type="button" variant="outline" onClick={() => lockPayrollMutation.mutate()} disabled={lockPayrollMutation.isPending} className="gap-1.5">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  重新锁定
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] text-muted-foreground">取込件数</div>
                  <div className="mt-1 text-lg font-bold text-slate-800">{totals.importedCount}件</div>
                  <div className="text-[10px] text-slate-500">支出反映 {totals.generatedCount}件</div>
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] text-muted-foreground">給与表合計</div>
                  {payrollDetailEntity === 'all' ? (
                    <div className="mt-1 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="text-slate-500">日本</span><span className="font-bold text-slate-800">{formatCurrency(totals.jpyPayrollTotal, 'JPY')}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-slate-500">中国</span><span className="font-bold text-slate-800">{formatCurrency(totals.cnyPayrollTotal, 'CNY')}</span></div>
                    </div>
                  ) : <div className="mt-1 font-bold text-slate-800">{formatCurrency(payrollDetailEntity === 'japan' ? totals.jpyPayrollTotal : totals.cnyPayrollTotal, payrollDetailEntity === 'japan' ? 'JPY' : 'CNY')}</div>}
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] text-muted-foreground">生成済み支出合計</div>
                  {payrollDetailEntity === 'all' ? (
                    <div className="mt-1 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="text-slate-500">日本</span><span className="font-bold text-slate-800">{formatCurrency(totals.jpyGeneratedTotal, 'JPY')}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-slate-500">中国</span><span className="font-bold text-slate-800">{formatCurrency(totals.cnyGeneratedTotal, 'CNY')}</span></div>
                    </div>
                  ) : <div className="mt-1 font-bold text-slate-800">{formatCurrency(payrollDetailEntity === 'japan' ? totals.jpyGeneratedTotal : totals.cnyGeneratedTotal, payrollDetailEntity === 'japan' ? 'JPY' : 'CNY')}</div>}
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-[11px] text-muted-foreground">差額 / 異常</div>
                  {payrollDetailEntity === 'all' ? (
                    <div className="mt-1 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="text-slate-500">日本</span><span className={`font-bold ${Math.abs(totals.jpyDifference) > 0.01 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatCurrency(totals.jpyDifference, 'JPY')}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-slate-500">中国</span><span className={`font-bold ${Math.abs(totals.cnyDifference) > 0.01 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatCurrency(totals.cnyDifference, 'CNY')}</span></div>
                    </div>
                  ) : <div className={`mt-1 font-bold ${Math.abs(payrollDetailEntity === 'japan' ? totals.jpyDifference : totals.cnyDifference) > 0.01 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatCurrency(payrollDetailEntity === 'japan' ? totals.jpyDifference : totals.cnyDifference, payrollDetailEntity === 'japan' ? 'JPY' : 'CNY')}</div>}
                  <div className="text-[10px] text-slate-500">異常 {totals.anomalyCount}件</div>
                </div>
              </div>

              {isPayrollReconciliationOpen && (
                <div id="payroll-reconciliation-details" className="mt-4 border-t border-emerald-100 pt-4">
                  <PayrollCommandCenter />
                  <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <div className="rounded-lg border bg-white p-3 xl:col-span-2">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-700">每月工资趋势</div>
                          <div className="text-[10px] text-slate-500">点击月份看两国，点击蓝/红棒分别看日本/中国逐人明细</div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />日本</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />中国</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {analytics.monthlyTotals.map((item: any) => (
                          <div key={item.payrollMonth} className="grid grid-cols-[72px_1fr] gap-2">
                            <button
                              type="button"
                              aria-label={`显示${item.payrollMonth}日本和中国工资明细`}
                              aria-pressed={monthlyPayrollDrilldown?.payrollMonth === item.payrollMonth && monthlyPayrollDrilldown?.entity === 'all'}
                              onClick={() => {
                                const next = { payrollMonth: item.payrollMonth, entity: 'all' as const };
                                setMonthlyPayrollDrilldown(current => toggleMonthlyPayrollDrilldown(current, next));
                                setPayrollDetailMonth(item.payrollMonth);
                                setPayrollDetailEmployee('');
                              }}
                              className={`rounded-md px-1.5 py-1 text-left text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${monthlyPayrollDrilldown?.payrollMonth === item.payrollMonth && monthlyPayrollDrilldown?.entity === 'all' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                              {item.payrollMonth}
                            </button>
                            <div className="space-y-1.5">
                              {(payrollDetailEntity === 'all' || payrollDetailEntity === 'japan') && (
                                <button
                                  type="button"
                                  aria-label={`显示${item.payrollMonth}日本工资明细`}
                                  aria-pressed={monthlyPayrollDrilldown?.payrollMonth === item.payrollMonth && monthlyPayrollDrilldown?.entity === 'japan'}
                                  onClick={() => {
                                    const next = { payrollMonth: item.payrollMonth, entity: 'japan' as const };
                                    setMonthlyPayrollDrilldown(current => toggleMonthlyPayrollDrilldown(current, next));
                                    setPayrollDetailMonth(item.payrollMonth);
                                    setPayrollDetailEmployee('');
                                  }}
                                  className={`flex w-full items-center gap-2 rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${monthlyPayrollDrilldown?.payrollMonth === item.payrollMonth && monthlyPayrollDrilldown?.entity === 'japan' ? 'bg-blue-100 ring-1 ring-blue-300' : 'hover:bg-blue-50'}`}
                                >
                                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-blue-50">
                                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(item.jpyTotal > 0 ? 4 : 0, (item.jpyTotal / maxJpyMonthly) * 100)}%` }} />
                                  </div>
                                  <div className="w-28 text-right text-[10px] font-semibold text-blue-700">{formatCurrency(item.jpyTotal, 'JPY')}</div>
                                </button>
                              )}
                              {(payrollDetailEntity === 'all' || payrollDetailEntity === 'china') && (
                                <button
                                  type="button"
                                  aria-label={`显示${item.payrollMonth}中国工资明细`}
                                  aria-pressed={monthlyPayrollDrilldown?.payrollMonth === item.payrollMonth && monthlyPayrollDrilldown?.entity === 'china'}
                                  onClick={() => {
                                    const next = { payrollMonth: item.payrollMonth, entity: 'china' as const };
                                    setMonthlyPayrollDrilldown(current => toggleMonthlyPayrollDrilldown(current, next));
                                    setPayrollDetailMonth(item.payrollMonth);
                                    setPayrollDetailEmployee('');
                                  }}
                                  className={`flex w-full items-center gap-2 rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${monthlyPayrollDrilldown?.payrollMonth === item.payrollMonth && monthlyPayrollDrilldown?.entity === 'china' ? 'bg-rose-100 ring-1 ring-rose-300' : 'hover:bg-rose-50'}`}
                                >
                                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-rose-50">
                                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(item.cnyTotal > 0 ? 4 : 0, (item.cnyTotal / maxCnyMonthly) * 100)}%` }} />
                                  </div>
                                  <div className="w-40 text-right text-[10px] font-semibold text-rose-700">
                                    <div>{formatCurrency(item.cnyTotal, 'CNY')}</div>
                                    <div className="font-normal text-slate-400">≈ ¥{convertCnyToJpyReference(item.cnyTotal).toLocaleString()} JPY</div>
                                  </div>
                                </button>
                              )}
                              <div className="pr-0.5 text-right text-[10px] font-semibold text-slate-600">
                                当月工资总额（JPY参考）≈ ¥{combinePayrollToJpyReference(Number(item.jpyTotal || 0), Number(item.cnyTotal || 0)).toLocaleString()} JPY
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-700">全部员工</div>
                        <Badge variant="outline" className="text-[9px]">{analytics.allEmployees.length}人</Badge>
                      </div>
                      <div className="mb-2 text-[10px] text-slate-500">点击员工可修改微信名，保存后同步到人员筛选</div>
                      <div className="max-h-52 space-y-1.5 overflow-auto pr-1">
                        {analytics.allEmployees.length > 0 ? analytics.allEmployees.map((item: any) => (
                          <button
                            key={`${item.entity}-${item.employeeName}`}
                            type="button"
                            onClick={() => openPayrollAliasEditor(item.entity, item.employeeName)}
                            className="group flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label={`修改${item.employeeName}的微信名`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[11px] font-semibold text-slate-700">{item.entity === 'japan' ? '🇯🇵' : '🇨🇳'} {getEmployeeDisplayName(item.entity, item.employeeName)}</div>
                              <div className="text-[9px] text-slate-500">首次工资月 {item.firstPayrollMonth}</div>
                            </div>
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <div className="text-[10px] font-semibold">{formatCurrency(item.firstPay, item.currency)}</div>
                              <Edit2 className="h-3 w-3 text-slate-300 transition-colors group-hover:text-blue-500" />
                            </div>
                          </button>
                        )) : <div className="rounded-md bg-slate-50 px-2 py-4 text-center text-[10px] text-slate-500">当前条件没有员工记录</div>}
                      </div>
                    </div>
                  </div>

                  {monthlyPayrollDrilldown && monthlyDrilldownData && (
                    <div className="mb-4 overflow-hidden rounded-lg border border-emerald-200 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-emerald-50/70 px-3 py-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-800">
                            {monthlyPayrollDrilldown.payrollMonth} 月度工资明细・{monthlyPayrollDrilldown?.entity === 'all' ? '日本＋中国' : monthlyPayrollDrilldown?.entity === 'japan' ? '日本' : '中国'}
                          </div>
                          <div className="text-[10px] text-slate-500">{monthlyDrilldownData.employeeCount}人・{monthlyDrilldownData.recordCount}件</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                          {monthlyDrilldownData.jpyTotal > 0 && <span className="text-blue-700">日本 {formatCurrency(monthlyDrilldownData.jpyTotal, 'JPY')}</span>}
                          {monthlyDrilldownData.cnyTotal > 0 && (
                            <span className="text-right text-rose-700">
                              <span className="block">中国 {formatCurrency(monthlyDrilldownData.cnyTotal, 'CNY')}</span>
                              <span className="block text-[10px] font-normal text-slate-500">参考换算 ≈ ¥{convertCnyToJpyReference(monthlyDrilldownData.cnyTotal).toLocaleString()} JPY</span>
                            </span>
                          )}
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">当前明细JPY参考合计 ≈ ¥{monthlyDrilldownData.totalJpyReference.toLocaleString()} JPY</span>
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMonthlyPayrollDrilldown(null)}>收起</Button>
                        </div>
                      </div>
                      {monthlyDrilldownData.rows.length > 0 ? (
                        <div className="max-h-72 overflow-auto">
                          <table className="w-full min-w-[720px] text-left text-xs">
                            <thead className="sticky top-0 bg-white text-slate-500 shadow-sm">
                              <tr>
                                <th className="px-3 py-2">国家</th>
                                <th className="px-3 py-2">员工</th>
                                <th className="px-3 py-2 text-right">实发金额</th>
                                <th className="px-3 py-2 text-right">现金流金额</th>
                                <th className="px-3 py-2">付款状态</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {monthlyDrilldownData.rows.map((item: any) => (
                                <tr key={`month-${item.id}`} className="text-slate-700 hover:bg-slate-50/70">
                                  <td className="px-3 py-2">{item.entity === 'japan' ? '日本' : '中国'}</td>
                                  <td className="px-3 py-2 font-semibold">
                                    <button type="button" className="text-left text-blue-700 hover:underline" onClick={() => openPayrollAliasEditor(item.entity, item.employeeName)}>
                                      {getEmployeeDisplayName(item.entity, item.employeeName)}
                                    </button>
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                    <div>{formatCurrency(item.netPay, item.currency)}</div>
                                    {item.currency === 'CNY' && <div className="text-[10px] font-normal text-slate-400">≈ ¥{convertCnyToJpyReference(item.netPay).toLocaleString()} JPY</div>}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    <div>{item.cashflowAmount == null ? '—' : formatCurrency(item.cashflowAmount, item.currency)}</div>
                                    {item.currency === 'CNY' && item.cashflowAmount != null && <div className="text-[10px] text-slate-400">≈ ¥{convertCnyToJpyReference(item.cashflowAmount).toLocaleString()} JPY</div>}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className={item.paid ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : item.cashflowId ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-300 bg-slate-50 text-slate-600'}>
                                      {item.paid ? '已付款' : item.cashflowId ? '支出已生成' : '要确认'}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="sticky bottom-0 border-t-2 border-emerald-200 bg-emerald-50 font-semibold text-slate-800">
                              {monthlyDrilldownData.jpyTotal > 0 && (
                                <tr>
                                  <td className="px-3 py-2" colSpan={2}>日本 {monthlyDrilldownData.rows.filter((item: any) => item.currency === 'JPY').length}笔精确合计</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{formatExactPayrollTotal(monthlyDrilldownData.jpyTotal, 'JPY')}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{formatExactPayrollTotal(monthlyDrilldownData.jpyCashflowTotal, 'JPY')}</td>
                                  <td className="px-3 py-2 text-emerald-700">{Math.abs(monthlyDrilldownData.jpyTotal - monthlyDrilldownData.jpyCashflowTotal) < 0.01 ? '一致' : '要确认'}</td>
                                </tr>
                              )}
                              {monthlyDrilldownData.cnyTotal > 0 && (
                                <tr>
                                  <td className="px-3 py-2" colSpan={2}>
                                    <div>中国 {monthlyDrilldownData.rows.filter((item: any) => item.currency === 'CNY').length}笔精确合计</div>
                                    <div className="text-[10px] font-normal text-slate-500">参考汇率 1 CNY ≈ {EXCHANGE_RATE_CNY_JPY} JPY</div>
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    <div>{formatExactPayrollTotal(monthlyDrilldownData.cnyTotal, 'CNY')}</div>
                                    <div className="text-[10px] font-normal text-slate-500">≈ ¥{convertCnyToJpyReference(monthlyDrilldownData.cnyTotal).toLocaleString()} JPY</div>
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    <div>{formatExactPayrollTotal(monthlyDrilldownData.cnyCashflowTotal, 'CNY')}</div>
                                    <div className="text-[10px] font-normal text-slate-500">≈ ¥{convertCnyToJpyReference(monthlyDrilldownData.cnyCashflowTotal).toLocaleString()} JPY</div>
                                  </td>
                                  <td className="px-3 py-2 text-emerald-700">{Math.abs(monthlyDrilldownData.cnyTotal - monthlyDrilldownData.cnyCashflowTotal) < 0.01 ? '一致' : '要确认'}</td>
                                </tr>
                              )}
                            </tfoot>
                          </table>
                          {Math.abs(monthlyDrilldownData.jpyTotal - Math.round(monthlyDrilldownData.jpyTotal)) > 0.001 && (
                            <div className="border-t bg-blue-50 px-3 py-2 text-[10px] text-blue-800">
                              日元棒状图按1円四舍五入显示 {formatCurrency(monthlyDrilldownData.jpyTotal, 'JPY')}；本表保留原始Excel小数，精确合计为 {formatExactPayrollTotal(monthlyDrilldownData.jpyTotal, 'JPY')}。
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-3 py-8 text-center text-xs text-slate-500">当前月份和国家没有工资记录</div>
                      )}
                    </div>
                  )}

                  <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {(payrollDetailEntity === 'all' || payrollDetailEntity === 'japan') && (
                      <div className="rounded-lg border border-blue-100 bg-white p-3">
                        <div className="mb-2 text-xs font-semibold text-blue-800">日本工资支付排行榜 TOP10</div>
                        <div className="space-y-1.5">
                          {analytics.salaryRanking.JPY.map((item: any, index: number) => (
                            <button key={item.employeeName} type="button" onClick={() => openPayrollAliasEditor(item.entity, item.employeeName)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-blue-50">
                              <span className="w-5 text-center text-[10px] font-bold text-blue-500">{index + 1}</span>
                              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{getEmployeeDisplayName(item.entity, item.employeeName)}</span>
                              <span className="text-[9px] text-slate-400">{item.monthCount}个月</span>
                              <span className="whitespace-nowrap text-[11px] font-semibold text-blue-700">{formatCurrency(item.totalPay, 'JPY')}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {(payrollDetailEntity === 'all' || payrollDetailEntity === 'china') && (
                      <div className="rounded-lg border border-rose-100 bg-white p-3">
                        <div className="mb-2 text-xs font-semibold text-rose-800">中国工资支付排行榜 TOP10</div>
                        <div className="space-y-1.5">
                          {analytics.salaryRanking.CNY.map((item: any, index: number) => (
                            <button key={item.employeeName} type="button" onClick={() => openPayrollAliasEditor(item.entity, item.employeeName)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-rose-50">
                              <span className="w-5 text-center text-[10px] font-bold text-rose-500">{index + 1}</span>
                              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{getEmployeeDisplayName(item.entity, item.employeeName)}</span>
                              <span className="text-[9px] text-slate-400">{item.monthCount}个月</span>
                              <span className="whitespace-nowrap text-[11px] font-semibold text-rose-700">{formatCurrency(item.totalPay, 'CNY')}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={paidLaborDrilldown === "CNY"}
                      onClick={() => setPaidLaborDrilldown((current) => current === "CNY" ? null : "CNY")}
                      className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${paidLaborDrilldown === "CNY" ? 'border-rose-300 bg-rose-50' : 'border-rose-100 bg-white hover:bg-rose-50/60'}`}
                    >
                      <div className="text-[11px] text-slate-500">中国已付人工费（银行实际支出）</div>
                      <div className="mt-1 text-lg font-bold text-rose-700">{formatCurrency(totals.cnyPaidLaborTotal, 'CNY')}</div>
                      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                        <span>{totals.cnyPaidLaborCount}件・世曜元宇(中信銀行)</span>
                        <span>{paidLaborDrilldown === "CNY" ? '收起明细' : '点击查看明细'}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-pressed={paidLaborDrilldown === "JPY"}
                      onClick={() => setPaidLaborDrilldown((current) => current === "JPY" ? null : "JPY")}
                      className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${paidLaborDrilldown === "JPY" ? 'border-blue-300 bg-blue-50' : 'border-blue-100 bg-white hover:bg-blue-50/60'}`}
                    >
                      <div className="text-[11px] text-slate-500">日本已付人工费（银行实际支出）</div>
                      <div className="mt-1 text-lg font-bold text-blue-700">{formatCurrency(totals.jpyPaidLaborTotal, 'JPY')}</div>
                      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                        <span>{totals.jpyPaidLaborCount}件・LCJ MITSUI / RESONA</span>
                        <span>{paidLaborDrilldown === "JPY" ? '收起明细' : '点击查看明细'}</span>
                      </div>
                    </button>
                  </div>

                  {paidLaborDrilldown && (
                    <div className="mt-3 overflow-hidden rounded-lg border bg-white">
                      <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
                        <div className="text-xs font-semibold text-slate-700">
                          {paidLaborDrilldown === 'CNY' ? '中国已付人工费明细' : '日本已付人工费明细'}
                        </div>
                        <div className="text-[10px] text-slate-500">{paidLaborDetails.length}件・银行实际支出</div>
                      </div>
                      <div className="max-h-80 overflow-auto">
                        <table className="w-full min-w-[1050px] text-left text-xs">
                          <thead className="sticky top-0 bg-white text-slate-500 shadow-sm">
                            <tr>
                              <th className="px-3 py-2">日期</th>
                              <th className="px-3 py-2">员工 / 原始摘要</th>
                              <th className="px-3 py-2">费用类型</th>
                              <th className="px-3 py-2">备注</th>
                              <th className="px-3 py-2 text-right">金额</th>
                              <th className="px-3 py-2">银行账户</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {paidLaborDetails.map((item: any) => (
                              <tr key={item.id} className="text-slate-700 hover:bg-slate-50/70">
                                <td className="whitespace-nowrap px-3 py-2 font-medium">{item.transactionDate}</td>
                                <td className="max-w-[360px] px-3 py-2">
                                  <div className="max-w-[300px] truncate font-medium">{item.payrollEmployee || item.counterparty || item.description || '—'}</div>
                                  {item.originalSummary && <div className="max-w-[300px] truncate text-[10px] text-slate-500" title={item.originalSummary}>{item.originalSummary}</div>}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  <Badge variant="outline" className={item.expenseType === 'employee_salary' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : item.expenseType === 'payroll_tax' ? 'border-violet-200 bg-violet-50 text-violet-700' : item.expenseType === 'needs_review' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700'}>
                                    {item.expenseTypeLabel}
                                  </Badge>
                                </td>
                                <td className="max-w-[320px] px-3 py-2 text-[10px] text-slate-600"><span title={item.expenseNote}>{item.expenseNote}</span></td>
                                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(item.amount, item.currency)}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.sourceAccount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 overflow-hidden rounded-lg border bg-white">
                    <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
                      <div className="text-xs font-semibold text-slate-700">逐人工资明细</div>
                      <div className="text-[10px] text-slate-500">{details.length}件・点击员工名可添加微信名</div>
                    </div>
                    <div className="max-h-96 overflow-auto">
                      <table className="w-full min-w-[760px] text-left text-xs">
                        <thead className="sticky top-0 bg-white text-slate-500 shadow-sm">
                          <tr>
                            <th className="px-3 py-2">国家</th>
                            <th className="px-3 py-2">工资月</th>
                            <th className="px-3 py-2">员工</th>
                            <th className="px-3 py-2 text-right">实发金额</th>
                            <th className="px-3 py-2 text-right">现金流金额</th>
                            <th className="px-3 py-2">付款状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {details.map((item: any) => (
                            <tr key={item.id} className="text-slate-700 hover:bg-slate-50/70">
                              <td className="px-3 py-2">{item.entity === 'china' ? '中国' : '日本'}</td>
                              <td className="px-3 py-2 font-medium">{item.payrollMonth}</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="font-semibold text-blue-700 hover:underline"
                                  onClick={() => openPayrollAliasEditor(item.entity, item.employeeName)}
                                >
                                  {getEmployeeDisplayName(item.entity, item.employeeName)}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(item.netPay, item.currency)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{item.cashflowAmount == null ? '—' : formatCurrency(item.cashflowAmount, item.currency)}</td>
                              <td className="px-3 py-2">
                                {item.paid ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已付款</Badge>
                                ) : item.cashflowId ? (
                                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">支出已生成</Badge>
                                ) : (
                                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">未生成</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {isPayrollReconciliationOpen && payrollData.anomalies.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-white divide-y">
                  {payrollData.anomalies.slice(0, 5).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <span className="font-medium text-slate-700">{item.payrollMonth}・{item.employeeName}</span>
                      <span className="text-amber-700">給与表 {formatCurrency(item.netPay, item.currency)} / 支出 {item.cashflowAmount == null ? '未生成' : formatCurrency(item.cashflowAmount, item.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <FinanceRecoveryEvidencePanel />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-xs text-blue-700 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              残高（累計{selectedYearMonth ? ` 〜${selectedMonth}月末` : ''}）
            </div>
            <div className={`text-xl font-bold mt-1 ${currentBalance >= 0 ? "text-blue-800" : "text-red-800"}`}>
              {entity === "china" ? formatCurrency(currentBalance, "CNY") : formatCurrency(currentBalance)}
            </div>
            {entity === "china" && (
              <div className="text-xs text-blue-500 mt-0.5">≈ ¥{Math.round(currentBalance * EXCHANGE_RATE_CNY_JPY).toLocaleString()} JPY</div>
            )}
            {entity === "all" && (
              <div className="mt-2 pt-2 border-t border-blue-200 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-600">🇯🇵 日本</span>
                  <span className="font-semibold text-blue-800">¥{japanBalance.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-600">🇨🇳 中国</span>
                  <span className="font-semibold text-blue-800">¥{chinaBalanceRMB.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} RMB</span>
                </div>
                <div className="text-[10px] text-blue-400 text-right">≈ ¥{chinaBalanceJPY.toLocaleString()} JPY</div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card
          className={`border-green-200 cursor-pointer transition-all ${type === "income" ? "bg-green-100 ring-2 ring-green-400 shadow-md" : "bg-green-50 hover:bg-green-100/70"}`}
          onClick={() => setType(type === "income" ? "all" : "income")}
        >
          <CardContent className="p-4">
            <div className="text-xs text-green-700 flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
              入金合計 {type === "income" && <Badge className="bg-green-500 text-white text-[9px] px-1 py-0">選択中</Badge>}
            </div>
            <div className="text-xl font-bold text-green-800 mt-1">
              {entity === "china" ? formatCurrency(summary?.totalIncome, "CNY") : formatCurrency(summary?.totalIncome)}
            </div>
            <div className="text-xs text-green-600">{Number(summary?.incomeCount || 0)}件</div>
            {entity === "china" && (
              <div className="text-xs text-green-500">≈ ¥{Math.round(Number(summary?.totalIncome || 0) * EXCHANGE_RATE_CNY_JPY).toLocaleString()} JPY</div>
            )}
            {entity === "all" && summary?.jpIncomeCount !== undefined && (
              <div className="text-[10px] text-green-600/70 mt-0.5">
                🇯🇵 {summary.jpIncomeCount}件 / 🇨🇳 {summary.cnIncomeCount}件
              </div>
            )}
          </CardContent>
        </Card>
        <Card
          className={`border-red-200 cursor-pointer transition-all ${type === "expense" ? "bg-red-100 ring-2 ring-red-400 shadow-md" : "bg-red-50 hover:bg-red-100/70"}`}
          onClick={() => setType(type === "expense" ? "all" : "expense")}
        >
          <CardContent className="p-4">
            <div className="text-xs text-red-700 flex items-center gap-1.5">
              <ArrowDownRight className="h-3.5 w-3.5" />
              出金合計 {type === "expense" && <Badge className="bg-red-500 text-white text-[9px] px-1 py-0">選択中</Badge>}
            </div>
            <div className="text-xl font-bold text-red-800 mt-1">
              {entity === "china" ? formatCurrency(summary?.totalExpense, "CNY") : formatCurrency(summary?.totalExpense)}
            </div>
            <div className="text-xs text-red-600">{Number(summary?.expenseCount || 0)}件</div>
            {entity === "china" && (
              <div className="text-xs text-red-500">≈ ¥{Math.round(Number(summary?.totalExpense || 0) * EXCHANGE_RATE_CNY_JPY).toLocaleString()} JPY</div>
            )}
            {entity === "all" && summary?.jpExpenseCount !== undefined && (
              <div className="text-[10px] text-red-600/70 mt-0.5">
                🇯🇵 {summary.jpExpenseCount}件 / 🇨🇳 {summary.cnExpenseCount}件
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="text-xs text-purple-700 flex items-center gap-1.5">
              {Number(summary?.netCashflow || 0) >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              純キャッシュフロー
            </div>
            <div className={`text-xl font-bold mt-1 ${Number(summary?.netCashflow || 0) >= 0 ? "text-purple-800" : "text-red-800"}`}>
              {entity === "china" ? formatCurrency(summary?.netCashflow, "CNY") : formatCurrency(summary?.netCashflow)}
            </div>
            {entity === "china" && (
              <div className="text-xs text-purple-500">≈ ¥{Math.round(Number(summary?.netCashflow || 0) * EXCHANGE_RATE_CNY_JPY).toLocaleString()} JPY</div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Bank Account Balances */}
      {accountBalancesQuery.data && accountBalancesQuery.data.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">🏦 银行账户余额</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accountBalancesQuery.data
                .filter((acc: any) => entity === "all" || acc.entity === entity)
                .map((acc: any) => (
                <div key={acc.accountName} onClick={() => { setSourceAccountFilter(sourceAccountFilter === acc.accountName ? "" : acc.accountName); setPage(0); }} className={`border rounded-lg p-3 transition-colors cursor-pointer ${sourceAccountFilter === acc.accountName ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : "hover:bg-muted/30"}`}>
                  <div className="text-xs text-muted-foreground font-medium mb-1">{acc.accountName}</div>
                  <div className={`text-lg font-bold ${acc.currentBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                    {acc.currency === "CNY" ? `¥${acc.currentBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : `¥${Math.round(acc.currentBalance).toLocaleString()}`}
                  </div>
                  {acc.lastDate && (
                    <div className="text-[10px] text-orange-600 mt-0.5">最終更新: {acc.lastDate}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    <span className="text-green-600">+{acc.currency === "CNY" ? acc.totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : Math.round(acc.totalIncome).toLocaleString()}</span>
                    {" / "}
                    <span className="text-red-500">-{acc.currency === "CNY" ? acc.totalExpense.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : Math.round(acc.totalExpense).toLocaleString()}</span>
                  </div>
                  {!acc.lastDate && <button
                    onClick={() => { setEditBalanceAccount(acc.accountName); setEditBalanceValue(String(acc.initialBalance)); }}
                    className="text-[10px] text-blue-500 hover:underline mt-1"
                  >
                    初期残高設定
                  </button>}
                </div>
              ))}
            </div>
            {/* Edit initial balance dialog */}
            {editBalanceAccount && (
              <div className="mt-3 p-3 border rounded-lg bg-muted/30 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium">{editBalanceAccount} の初期残高:</span>
                <Input
                  type="number"
                  value={editBalanceValue}
                  onChange={(e) => setEditBalanceValue(e.target.value)}
                  className="w-40"
                  placeholder="初期残高を入力"
                />
                <Button size="sm" onClick={() => {
                  const acc = accountBalancesQuery.data?.find((a: any) => a.accountName === editBalanceAccount);
                  setBalanceMutation.mutate({
                    accountName: editBalanceAccount,
                    initialBalance: parseFloat(editBalanceValue) || 0,
                    currency: acc?.currency || "JPY",
                    entity: acc?.entity || "japan",
                  });
                }}>
                  保存
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditBalanceAccount(null)}>
                  取消
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Balance History Chart */}
      {balanceHistory.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">📊 残高推移</h3>
            {(() => {
              const data = balanceHistory.slice(-12);
              const maxBal = Math.max(...data.map((b) => Math.abs(b.balance)), 1);
              const chartHeight = 160;
              return (
                <div className="relative" style={{ height: chartHeight + 60 }}>
                  {/* Y-axis zero line */}
                  <div className="absolute left-0 right-0 border-t border-dashed border-gray-300" style={{ top: chartHeight / 2 }} />
                  {/* Bars */}
                  <div className="flex items-center gap-1 h-full px-2" style={{ height: chartHeight }}>
                    {data.map((item, i) => {
                      const barHeight = Math.max((Math.abs(item.balance) / maxBal) * (chartHeight / 2 - 10), 4);
                      const isPositive = item.balance >= 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center relative cursor-pointer hover:opacity-80" style={{ height: chartHeight }} onClick={() => { const m = item.month; const year = parseInt(m.split("-")[0]); const month = parseInt(m.split("-")[1]); const start = `${year}-${String(month).padStart(2,"0")}-01`; const lastDay = new Date(year, month, 0).getDate(); const end = `${year}-${String(month).padStart(2,"0")}-${lastDay}`; setDateRange({ start, end }); setPage(0); }}>
                          {/* Value label */}
                          <span className="text-[10px] font-medium whitespace-nowrap absolute" style={{ top: isPositive ? (chartHeight / 2 - barHeight - 18) : (chartHeight / 2 + barHeight + 4) }}>
                            {entity === "china" ? formatCurrency(item.balance, "CNY") : formatCurrency(item.balance)}
                          </span>
                          {/* Bar */}
                          {isPositive ? (
                            <div
                              className="w-[70%] rounded-t-md bg-gradient-to-t from-blue-500 to-blue-400 absolute shadow-sm"
                              style={{ height: barHeight, bottom: chartHeight / 2 }}
                            />
                          ) : (
                            <div
                              className="w-[70%] rounded-b-md bg-gradient-to-b from-red-400 to-red-500 absolute shadow-sm"
                              style={{ height: barHeight, top: chartHeight / 2 }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Month labels */}
                  <div className="flex gap-1 px-2 mt-1">
                    {data.map((item, i) => (
                      <div key={i} className="flex-1 text-center">
                        <span className="text-[11px] font-medium text-muted-foreground">{item.month.slice(5).replace(/^0/, '')}月</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown - マスク式ダッシュボード */}
      {categoryBreakdown && categoryBreakdown.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">📊 カテゴリ別支出分析</h3>
                <p className="mt-1 text-xs text-slate-500">AI识别后可在下方每笔流水直接修改；人工修正不会被下一次AI覆盖。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {meQuery.data?.role === "admin" && (
                  <Button variant="outline" size="sm" onClick={() => setCategoryManagerOpen(true)}>
                    <Settings2 className="mr-1 h-3.5 w-3.5" />分类管理
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => autoClassifyMutation.mutate({ entity })}
                  disabled={autoClassifyMutation.isPending}
                >
                  {autoClassifyMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                  AI自動分類
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* バーチャート - タップで明細展開 */}
              <div className="space-y-1">
                {categoryBreakdown.slice(0, 8).map((cat: any, i: number) => {
                  const colors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-lime-500", "bg-green-500", "bg-teal-500", "bg-blue-500"];
                  const maxAmount = Math.max(...categoryBreakdown.map((row: any) => Number(row.normalizedAmountJpy || 0)), 1);
                  const width = Math.max((Number(cat.normalizedAmountJpy || 0) / Number(maxAmount)) * 100, 5);
                  const isExpanded = expandedCategory === cat.category && expandedCurrency === cat.currency;
                  return (
                    <div key={`${cat.category}-${cat.currency}`}>
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded-md p-1 transition-colors"
                        onClick={() => { setExpandedCategory(isExpanded ? null : cat.category); setExpandedCurrency(isExpanded ? null : cat.currency); setPage(0); }}
                      >
                        <span className="text-xs w-[140px] truncate font-medium">{getCurrencyCategoryLabel(cat.category, cat.currency, entity === 'china')}</span>
                        <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[i % colors.length]} transition-all`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-[80px] text-right">
                          {formatCurrency(cat.totalAmount, cat.currency)}
                        </span>
                        <span className="text-xs text-muted-foreground w-[45px] text-right">{cat.percentage}%</span>
                        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                      {/* 展開明細 */}
                      {isExpanded && (
                        <div className="ml-4 mt-1 mb-2 border-l-2 border-gray-200 pl-3 space-y-1 max-h-[300px] overflow-y-auto">
                          {(listQuery.data?.items || []).filter((item: any) => item.category === cat.category && item.currency === cat.currency).length > 0 ? (
                            (listQuery.data?.items || []).filter((item: any) => item.category === cat.category && item.currency === cat.currency).map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1 text-xs py-1 border-b border-gray-100 last:border-0">
                                <span className="text-muted-foreground w-[50px] shrink-0">{item.transactionDate?.slice(5)}</span>
                                <select
                                  defaultValue={item.category || ''}
                                  onChange={(e) => {
                                    updateMutation.mutate({ id: item.id, category: e.target.value, entity: item.entity, type: item.type, amount: item.amount, currency: item.currency, transactionDate: item.transactionDate, description: item.description, counterparty: item.counterparty });
                                  }}
                                  className="w-[150px] shrink-0 cursor-pointer rounded border border-dashed border-muted-foreground/30 bg-transparent p-0.5 text-[10px] hover:border-primary focus:border-primary focus:ring-0"
                                >
                                  {categoryOptionsFor(item.type, item.category).map((category) => (
                                    <option key={`${category.id}-${category.name}`} value={category.name}>{category.name}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  defaultValue={item.description || ''}
                                  placeholder="说明..."
                                  onBlur={(e) => {
                                    if (e.target.value !== (item.description || '')) {
                                      updateMutation.mutate({ id: item.id, description: e.target.value, entity: item.entity, type: item.type, amount: item.amount, currency: item.currency, transactionDate: item.transactionDate, category: item.category, counterparty: item.counterparty });
                                    }
                                  }}
                                  className={`flex-1 bg-transparent border-0 border-b border-dashed hover:border-primary text-[10px] p-0 focus:ring-0 min-w-0 ${(!item.description || item.description === '二代支付') ? 'border-yellow-400 text-yellow-600 placeholder:text-yellow-400' : 'border-muted-foreground/30'}`}
                                />
                                <span className={`font-medium shrink-0 ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(item.amount, item.currency)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">※ 下のテーブルで「{getCategoryLabel(cat.category)}」をクリックしてください</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* サマリーテーブル - タップで明細展開 */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">カテゴリ</th>
                      <th className="text-right p-2 font-medium">金額</th>
                      <th className="text-right p-2 font-medium">件数</th>
                      <th className="text-right p-2 font-medium">占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdown.map((cat: any, i: number) => (
                      <tr
                        key={`${cat.category}-${cat.currency}`}
                        className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => { const isExpanded = expandedCategory === cat.category && expandedCurrency === cat.currency; setExpandedCategory(isExpanded ? null : cat.category); setExpandedCurrency(isExpanded ? null : cat.currency); setPage(0); }}
                      >
                        <td className="p-2 font-medium flex items-center gap-1">
                          <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === cat.category && expandedCurrency === cat.currency ? 'rotate-90' : ''}`} />
                          {getCurrencyCategoryLabel(cat.category, cat.currency, entity === 'china')}
                        </td>
                        <td className="p-2 text-right">{formatCurrency(cat.totalAmount, cat.currency)}</td>
                        <td className="p-2 text-right">{cat.count}件</td>
                        <td className="p-2 text-right font-bold">{cat.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & Table */}
      {/* TODO: 待补充说明提醒 */}
      <Dialog open={payrollAliasEditor !== null} onOpenChange={(open) => { if (!open) setPayrollAliasEditor(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>员工微信名</DialogTitle>
            <DialogDescription>
              工资表正式姓名保持不变；保存后显示为“正式姓名（微信名）”。
            </DialogDescription>
          </DialogHeader>
          {payrollAliasEditor && (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border bg-slate-50 px-3 py-2">
                <div className="text-[11px] text-slate-500">正式姓名</div>
                <div className="mt-0.5 font-semibold text-slate-800">{payrollAliasEditor.employeeName}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">{payrollAliasEditor.entity === "japan" ? "日本" : "中国"}</div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="payroll-wechat-name">微信显示名 / 备注名</label>
                <Input
                  id="payroll-wechat-name"
                  value={payrollWechatNameDraft}
                  onChange={(event) => setPayrollWechatNameDraft(event.target.value)}
                  placeholder="例如：小刘"
                  maxLength={100}
                  autoFocus
                />
                <p className="text-[10px] text-slate-500">留空保存即可清除微信名。</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="payroll-alias-note">简单备注（可选）</label>
                <Input
                  id="payroll-alias-note"
                  value={payrollAliasNoteDraft}
                  onChange={(event) => setPayrollAliasNoteDraft(event.target.value)}
                  placeholder="用于区分同名联系人"
                  maxLength={500}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayrollAliasEditor(null)}>取消</Button>
            {(payrollWechatNameDraft.trim() || payrollAliasNoteDraft.trim()) && (
              <Button
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                disabled={!payrollAliasEditor || upsertPayrollEmployeeAliasMutation.isPending}
                onClick={() => {
                  if (!payrollAliasEditor) return;
                  setPayrollWechatNameDraft("");
                  setPayrollAliasNoteDraft("");
                  upsertPayrollEmployeeAliasMutation.mutate(buildPayrollEmployeeAliasClear(
                    payrollAliasEditor.entity,
                    payrollAliasEditor.employeeName,
                  ));
                }}
              >
                微信名を消去
              </Button>
            )}
            <Button
              disabled={!payrollAliasEditor || upsertPayrollEmployeeAliasMutation.isPending}
              onClick={() => payrollAliasEditor && upsertPayrollEmployeeAliasMutation.mutate(buildPayrollEmployeeAliasUpdate(
                payrollAliasEditor.entity,
                payrollAliasEditor.employeeName,
                payrollWechatNameDraft,
                payrollAliasNoteDraft,
              ))}
            >
              {upsertPayrollEmployeeAliasMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {auditLogId && <AuditLogDialog cashflowId={auditLogId} onClose={() => setAuditLogId(null)} />}
      <PendingDescriptionsPanel entity={entity} />

      {/* 請求書プレビューダイアログ */}
      {receiptPreviewUrls.length > 0 && (
        <Dialog open onOpenChange={(open) => { if (!open) closeReceiptPreview(); }}>
          <DialogContent className="h-[92vh] max-h-[92vh] max-w-5xl grid grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>請求書プレビュー（{receiptPreviewIndex + 1}/{receiptPreviewUrls.length}）</DialogTitle>
              <DialogDescription>
                选择下方文件后可单独删除。{receiptPreviewRequiresPayroll ? "此记录属于工资相关项目，删除时需要财务密码二次确认。" : "删除会保留操作记录。"}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-auto flex items-center justify-center rounded-lg bg-slate-50 p-2 sm:p-3">
              {(receiptPreviewUrls[receiptPreviewIndex] || "").toLowerCase().includes('.pdf') ? (
                <iframe title="請求書PDF" src={receiptPreviewUrls[receiptPreviewIndex]} className="h-full min-h-[320px] w-full rounded border bg-white" />
              ) : (
                <img src={receiptPreviewUrls[receiptPreviewIndex]} alt={`請求書 ${receiptPreviewIndex + 1}`} className="max-h-full max-w-full rounded bg-white object-contain shadow" />
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto py-2">
              {receiptPreviewUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="relative shrink-0">
                  <button type="button" onClick={() => setReceiptPreviewIndex(index)} className={`h-16 w-16 overflow-hidden rounded border-2 text-xs ${receiptPreviewIndex === index ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`} aria-label={`第${index + 1}份请求书`}>
                    {url.toLowerCase().includes('.pdf') ? <span className="flex h-full items-center justify-center font-semibold text-red-600">PDF {index + 1}</span> : <img src={url} alt="" className="h-full w-full object-cover" />}
                  </button>
                  <button type="button" disabled={deleteReceiptMutation.isPending} onClick={() => requestReceiptDelete(index)} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700 disabled:opacity-50" aria-label={`删除第${index + 1}份请求书`} title={`删除第${index + 1}份请求书`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-background pt-3">
              <a href={receiptPreviewUrls[receiptPreviewIndex]} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">在新标签页打开 ↗</a>
              <div className="flex flex-wrap gap-2">
                {receiptPreviewCashflowId && (
                  <Button variant="destructive" size="sm" disabled={deleteReceiptMutation.isPending} onClick={() => requestReceiptDelete(receiptPreviewIndex)}>
                    {deleteReceiptMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                    删除当前请求书
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={closeReceiptPreview}>关闭</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="取引先・説明で検索..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v as any); setPage(0); }}>
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder="全て" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="income">入金</SelectItem>
            <SelectItem value="expense">出金</SelectItem>
          </SelectContent>
        </Select>
        {payrollReconciliationQuery.data && payrollReconciliationQuery.data.months.length > 0 && (
          <Select value={payrollMonthFilter || "all"} onValueChange={(value) => {
            setPayrollMonthFilter(value === "all" ? "" : value);
            if (value !== "all") {
              const range = buildCashflowMonthRange(value);
              if (!range) return;
              setSelectedYear(range.year);
              setSelectedMonth(range.month);
              setDateRange({ start: range.start, end: range.end });
            }
            setPage(0);
          }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="給与月" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">給与月: 全て</SelectItem>
              {payrollReconciliationQuery.data.months.map((month: string) => <SelectItem key={month} value={month}>{month.replace('-', '年')}月</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {payrollReconciliationQuery.data && payrollReconciliationQuery.data.employees.length > 0 && (
          <Select value={payrollEmployeeFilter || "all"} onValueChange={(value) => { setPayrollEmployeeFilter(value === "all" ? "" : value); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="従業員" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">従業員: 全て</SelectItem>
              {payrollReconciliationQuery.data.employees.map((employee: string) => (
                <SelectItem key={employee} value={employee}>
                  {formatPayrollEmployeeFilterDisplayName(employee, entity, payrollReconciliationQuery.data.employeeAliases || [])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sourceAccountFilter || "all"} onValueChange={(value) => { setSourceAccountFilter(value === "all" ? "" : value); setPage(0); }}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="我方账户" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部账户</SelectItem>
            {ACTIVE_SOURCE_ACCOUNTS.map(account => <SelectItem key={account} value={account}>{account}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={selectedYearMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, "0")}` : (dateRange.start || dateRange.end ? "custom" : "all")}
          onValueChange={applyMonthFilter}
        >
          <SelectTrigger className="w-[145px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue placeholder="选择月份" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">月份：全部</SelectItem>
            {(dateRange.start || dateRange.end) && !selectedYearMonth && <SelectItem value="custom">自定义日期</SelectItem>}
            {availableMonths.map(month => <SelectItem key={month} value={month}>{month.replace("-", "年")}月</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 rounded-md border bg-white p-1">
          <Input type="date" value={dateRange.start} onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setSelectedMonth(0); setPage(0); }} className="h-8 w-[145px] border-0" aria-label="开始日期" />
          <span className="text-xs text-muted-foreground">〜</span>
          <Input type="date" value={dateRange.end} onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setSelectedMonth(0); setPage(0); }} className="h-8 w-[145px] border-0" aria-label="结束日期" />
          {(dateRange.start || dateRange.end) && <button onClick={() => { setDateRange({ start: '', end: '' }); setSelectedMonth(0); setPage(0); }} className="px-2 text-xs text-blue-600 hover:underline">清除</button>}
        </div>
        <Button variant="outline" size="sm" onClick={openCsvDialog}>
          <Download className="h-4 w-4 mr-1.5" />
          CSV
        </Button>
        {selectedIds.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            disabled={bulkDeleteByIdsMutation.isPending}
            onClick={() => {
              if (confirm(`勾选的${selectedIds.length}条流水将被删除。金额汇总会同步更新，确定继续吗？`)) {
                bulkDeleteByIdsMutation.mutate({ ids: selectedIds });
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {bulkDeleteByIdsMutation.isPending ? "删除中..." : `删除已选 ${selectedIds.length} 条`}
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {selectedIds.length > 0 ? `已选择${selectedIds.length}条 / ` : ""}{total}件显示{protectedHiddenCount > 0 ? ` / 全量${authoritativeFilteredCount}件（工资个人明细${protectedHiddenCount}件已隐藏，但总额已计入）` : ""}
        </span>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x">
            <button onClick={() => { setType(type === "income" ? "all" : "income"); setSortBy("amount"); setSortOrder("desc"); setPage(0); setReconciliationType("income"); }} className={`p-4 text-left transition-colors ${type === "income" ? "bg-emerald-50" : "hover:bg-emerald-50/60"}`}>
              <div className="text-xs font-medium text-emerald-700">筛选结果・收入金额{entity === "all" ? "（JPY参考）" : ""}</div>
              <div className="mt-1 text-xl font-bold text-emerald-800">{entity === "china" ? formatCurrency(summary?.totalIncome, "CNY") : formatCurrency(summary?.totalIncome)}</div>
              <div className="text-xs text-emerald-600">{Number(summary?.incomeCount || 0)}件{entity === "all" ? `・1 CNY = ${EXCHANGE_RATE_CNY_JPY} JPY` : ""}</div>
              <div className="mt-1 text-[11px] font-medium text-emerald-700">点击查看逐笔相加</div>
            </button>
            <button onClick={() => { setType(type === "expense" ? "all" : "expense"); setSortBy("amount"); setSortOrder("desc"); setPage(0); setReconciliationType("expense"); }} className={`p-4 text-left transition-colors ${type === "expense" ? "bg-rose-50" : "hover:bg-rose-50/60"}`}>
              <div className="text-xs font-medium text-rose-700">筛选结果・支出金额{entity === "all" ? "（JPY参考）" : ""}</div>
              <div className="mt-1 text-xl font-bold text-rose-800">{entity === "china" ? formatCurrency(summary?.totalExpense, "CNY") : formatCurrency(summary?.totalExpense)}</div>
              <div className="text-xs text-rose-600">{Number(summary?.expenseCount || 0)}件{entity === "all" ? "・原币数据分别保存" : ""}</div>
              <div className="mt-1 text-[11px] font-medium text-rose-700">点击查看逐笔相加</div>
            </button>
          </div>
          <div className="border-t bg-slate-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-slate-600">合计（收入 − 支出）{entity === "all" ? "・JPY参考换算" : ""}{sourceAccountFilter ? `・${sourceAccountFilter}` : ''}{dateRange.start || dateRange.end ? `・${dateRange.start || '开始'} 〜 ${dateRange.end || '结束'}` : ''}</div>
            <div className={`text-lg font-bold ${Number(summary?.netCashflow || 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{entity === "china" ? formatCurrency(summary?.netCashflow, "CNY") : formatCurrency(summary?.netCashflow)}</div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reconciliationType !== null} onOpenChange={(open) => { if (!open) setReconciliationType(null); }}>
        <DialogContent className="max-w-6xl max-h-[88vh] overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-blue-600" />
              {reconciliationType === "income" ? "收入" : "支出"}逐笔累计核对
            </DialogTitle>
            <DialogDescription>
              {entity === "all" ? "全法人" : entity === "china" ? "中国法人" : "日本法人"}・{dateRange.start || "最早"} ～ {dateRange.end || "最新"}。按金额从大到小逐笔相加，最终必须与筛选总额一致。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[68vh] overflow-auto px-6 py-4">
            {reconciliationQuery.isLoading ? (
              <div className="flex min-h-[260px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>
            ) : reconciliationQuery.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">{reconciliationQuery.error.message}</div>
            ) : !reconciliationQuery.data ? null : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">原始记录</p><p className="mt-1 text-xl font-bold">{reconciliationQuery.data.sourceRowCount}笔</p></div>
                  <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">逐项显示</p><p className="mt-1 text-xl font-bold">{reconciliationQuery.data.displayRowCount}行</p></div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">原币总额</p>
                    <p className="mt-1 font-bold">{entity === "china" ? formatCurrency(reconciliationQuery.data.totals.cny, "CNY") : entity === "japan" ? formatCurrency(reconciliationQuery.data.totals.jpy, "JPY") : `${formatCurrency(reconciliationQuery.data.totals.jpy, "JPY")} / ${formatCurrency(reconciliationQuery.data.totals.cny, "CNY")}`}</p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-xs text-blue-700">累计结果{entity === "all" ? "（JPY参考）" : ""}</p><p className="mt-1 text-xl font-bold text-blue-900">{entity === "china" ? formatCurrency(reconciliationQuery.data.reconstructed.cny, "CNY") : entity === "japan" ? formatCurrency(reconciliationQuery.data.reconstructed.jpy, "JPY") : formatCurrency(reconciliationQuery.data.reconstructed.referenceJpy, "JPY")}</p></div>
                </div>
                {reconciliationQuery.data.protectedPayrollRowCount > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">工资总额已完整计入；{reconciliationQuery.data.protectedPayrollRowCount}笔个人工资明细因二次权限保护合并显示，不影响累计总额。</div>
                )}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="p-3 text-right">序号</th>
                        <th className="p-3 text-left">日期</th>
                        <th className="p-3 text-left">类别／内容</th>
                        <th className="p-3 text-left">我方账户</th>
                        <th className="p-3 text-right">本笔金额</th>
                        <th className="p-3 text-right">累计金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationQuery.data.items.map((item) => (
                        <tr key={String(item.id)} className="border-t">
                          <td className="p-3 text-right font-mono text-muted-foreground">{item.sequence}</td>
                          <td className="p-3 whitespace-nowrap">{item.transactionDate}{item.dateEnd && item.dateEnd !== item.transactionDate ? ` ～ ${item.dateEnd}` : ""}</td>
                          <td className="p-3">
                            <p className="font-medium">{item.category}</p>
                            <p className="mt-0.5 max-w-[360px] truncate text-xs text-muted-foreground">{item.payrollProtected ? `${item.groupedCount}笔工资个人明细已保护` : [item.counterparty, item.description].filter(Boolean).join("・") || "—"}</p>
                          </td>
                          <td className="p-3">{item.sourceAccount || "未指定"}</td>
                          <td className="p-3 text-right font-semibold">
                            {formatCurrency(item.amount, item.currency)}
                            {entity === "all" && item.currency === "CNY" && <p className="text-[11px] font-normal text-muted-foreground">JPY参考 {formatCurrency(item.referenceAmountJpy, "JPY")}</p>}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-blue-800">{entity === "china" ? formatCurrency(item.runningCny, "CNY") : entity === "japan" ? formatCurrency(item.runningJpy, "JPY") : formatCurrency(item.runningReferenceJpy, "JPY")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={`rounded-lg border p-4 ${Math.abs(entity === "china" ? reconciliationQuery.data.difference.cny : entity === "japan" ? reconciliationQuery.data.difference.jpy : reconciliationQuery.data.difference.referenceJpy) < 0.01 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
                  <p className="font-semibold">权威总额 − 逐笔累计 = {entity === "china" ? formatCurrency(reconciliationQuery.data.difference.cny, "CNY") : entity === "japan" ? formatCurrency(reconciliationQuery.data.difference.jpy, "JPY") : formatCurrency(reconciliationQuery.data.difference.referenceJpy, "JPY")}</p>
                  <p className="mt-1 text-xs">差额为0表示每一笔已经完整相加。跨法人时JPY与CNY原币分开保存，JPY参考按1 CNY = {reconciliationQuery.data.exchangeRate} JPY显示。</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="border-t px-6 py-4"><Button variant="outline" onClick={() => setReconciliationType(null)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {expandedCategory && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md">
          <span className="text-sm font-medium text-purple-800">📊 カテゴリフィルター: {expandedCurrency ? getCurrencyCategoryLabel(expandedCategory, expandedCurrency, entity === 'china') : expandedCategory}</span>
          <button onClick={() => { setExpandedCategory(null); setExpandedCurrency(null); }} className="text-purple-500 hover:text-purple-700 text-xs font-bold ml-2">✕ クリア</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <label htmlFor="cashflow-sort" className="text-xs font-medium text-slate-600">排序 / 並び替え</label>
        <select
          id="cashflow-sort"
          value={`${sortBy}:${sortOrder}`}
          onChange={(event) => {
            const [field, direction] = event.target.value.split(":") as [typeof sortBy, typeof sortOrder];
            setSortBy(field);
            setSortOrder(direction);
            setPage(0);
          }}
          className="rounded-md border bg-white px-3 py-2 text-sm"
        >
          <option value="amount:desc">金额：从大到小</option>
          <option value="amount:asc">金额：从小到大</option>
          <option value="transactionDate:desc">日期：从新到旧</option>
          <option value="transactionDate:asc">日期：从旧到新</option>
        </select>
      </div>

      {/* Cashflow Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-center p-2 w-8"><input type="checkbox" checked={items.length > 0 && items.every((item: any) => selectedIds.includes(item.id))} onChange={(e) => { const pageIds = items.map((item: any) => item.id); setSelectedIds((current) => e.target.checked ? Array.from(new Set([...current, ...pageIds])) : current.filter((id) => !pageIds.includes(id))); }} className="rounded" title="本页全选" /></th>
              <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/80 select-none" onClick={() => toggleSort("transactionDate")}>
                <div className="flex items-center">日付<SortIcon col="transactionDate" /></div>
              </th>
              <th className="text-center p-3 font-medium">法人</th>
              <th className="text-center p-3 font-medium">種別</th>
              <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/80 select-none" onClick={() => toggleSort("category")}>
                <div className="flex items-center">カテゴリ<SortIcon col="category" /></div>
              </th>
              <th className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80 select-none" onClick={() => toggleSort("amount")}>
                <div className="flex items-center justify-end">金額<SortIcon col="amount" /></div>
              </th>
              <th className="text-left p-3 font-medium cursor-pointer hover:bg-muted/80 select-none" onClick={() => toggleSort("counterparty")}>
                <div className="flex items-center">取引先<SortIcon col="counterparty" /></div>
              </th>
              <th className="text-left p-3 font-medium" style={{minWidth: "180px"}}>説明</th>
              <th className="text-left p-3 font-medium">
                <div className="flex items-center gap-1">
                  我方账户
                  {sourceAccountFilter && <button onClick={() => { setSourceAccountFilter(""); setPage(0); }} className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded hover:bg-blue-200" title="筛选清除">{sourceAccountFilter} ×</button>}
                </div>
              </th>
              <th className="text-center p-3 font-medium">請求書</th>
              <th className="text-center p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading ? (
              <tr>
                <td colSpan={10} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-muted-foreground">
                  入出金データがありません
                </td>
              </tr>
            ) : (
              items.map((item: any) => (
                <tr key={item.id} className={`border-t hover:bg-muted/30 transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50' : ''}`}>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => {
                        setSelectedIds((current) => e.target.checked
                          ? Array.from(new Set([...current, item.id]))
                          : current.filter((id) => id !== item.id));
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="p-3 text-xs">{item.transactionDate}</td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className="text-xs">
                      {item.entity === "japan" ? "🇯🇵" : "🇨🇳"}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    {item.type === "income" ? (
                      <Badge className="bg-green-100 text-green-700">入金</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">出金</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <select
                      value={item.category || ''}
                      onChange={(e) => {
                        updateMutation.mutate({ id: item.id, category: e.target.value, entity: item.entity, type: item.type, amount: item.amount, currency: item.currency, transactionDate: item.transactionDate, description: item.description, counterparty: item.counterparty });
                      }}
                      className="max-w-[190px] cursor-pointer border-0 border-b border-dashed border-muted-foreground/30 bg-transparent p-0 text-xs hover:border-primary focus:border-primary focus:ring-0"
                    >
                      {categoryOptionsFor(item.type, item.category).map((category) => (
                        <option key={`${category.id}-${category.name}`} value={category.name}>{category.name}</option>
                      ))}
                    </select>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {getCategorySourceLabel(item.categorySource, item.categoryLockedByUser)}
                    </div>
                  </td>
                  <td className={`p-3 text-right font-medium ${item.type === "income" ? "text-green-700" : "text-red-700"}`}>
                    <div>{item.type === "income" ? "+" : "-"}{formatCurrency(item.amount, item.currency)}</div>
                    {item.currency === "CNY" && (
                      <div className="text-[10px] text-muted-foreground font-normal">≈ ¥{Math.round(item.amount * EXCHANGE_RATE_CNY_JPY).toLocaleString()} JPY</div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {item.payrollMonth && <div className="mb-1 text-[10px] font-medium text-violet-600">{item.payrollMonth.replace('-', '年')}月 給与</div>}
                    <input
                      type="text"
                      defaultValue={item.counterparty || ''}
                      placeholder="取引先名..."
                      onBlur={(e) => {
                        if (e.target.value !== (item.counterparty || '')) {
                          updateMutation.mutate({ id: item.id, counterparty: e.target.value, entity: item.entity, type: item.type, amount: item.amount, currency: item.currency, transactionDate: item.transactionDate, description: item.description, category: item.category, sourceAccount: item.sourceAccount });
                        }
                      }}
                      className="bg-transparent border-0 border-b border-dashed border-muted-foreground/30 hover:border-primary text-xs p-0 focus:ring-0 focus:border-primary w-full"
                    />
                  </td>
                  <td className="p-3 text-xs">
                    <input
                      type="text"
                      defaultValue={item.description || ''}
                      placeholder="説明を入力..."
                      onBlur={(e) => {
                        if (e.target.value !== (item.description || '')) {
                          updateMutation.mutate({ id: item.id, description: e.target.value, entity: item.entity, type: item.type, amount: item.amount, currency: item.currency, transactionDate: item.transactionDate, category: item.category, counterparty: item.counterparty });
                        }
                      }}
                      className={`bg-transparent border-0 border-b border-dashed hover:border-primary cursor-pointer text-xs p-0 focus:ring-0 focus:border-primary w-full ${(!item.description || item.description === '二代支付' || item.description === '银行收费') ? 'border-yellow-400 text-yellow-600 placeholder:text-yellow-400' : 'border-muted-foreground/30 text-muted-foreground'}`}
                    />
                  </td>
                  <td className="p-3 text-xs">
                    <select
                      value={item.sourceAccount || ''}
                      onChange={(e) => {
                        updateMutation.mutate({ id: item.id, sourceAccount: e.target.value, entity: item.entity, type: item.type, amount: item.amount, currency: item.currency, transactionDate: item.transactionDate, description: item.description, category: item.category, counterparty: item.counterparty });
                      }}
                      className="bg-transparent border-0 border-b border-dashed border-muted-foreground/30 hover:border-primary cursor-pointer text-xs p-0 focus:ring-0 focus:border-primary"
                    >
                      <option value="">-</option>
                      <option value="LCJ MITSUI">LCJ MITSUI</option>
                      <option value="LCJ RESONA">LCJ RESONA</option>
                      <option value="世曜元宇(中信銀行)">世曜元宇(中信銀行)</option>
                                                        </select>
                  </td>
                  <td className="p-3 text-center">
                    {(() => {
                      const urls = parseReceiptUrls(item.receiptUrl);
                      return (
                        <div className="flex items-center gap-1 justify-center">
                          {urls.length > 0 && (
                            <button onClick={() => {
                              setReceiptPreviewUrls(urls);
                              setReceiptPreviewUrl(urls[0]);
                              setReceiptPreviewIndex(0);
                              setReceiptPreviewCashflowId(item.id);
                              setReceiptPreviewRequiresPayroll(Boolean(item.payrollRecordKey || item.payrollMonth || item.payrollEmployee || ["給与・人件費", "中国人工費", "日本人工費"].includes(item.category)));
                            }} className="relative p-1.5 hover:bg-blue-50 rounded text-blue-600" title={`${urls.length}件をプレビュー`}>
                              <Eye className="h-3.5 w-3.5" />
                              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] leading-4">{urls.length}</span>
                            </button>
                          )}
                          {urls.length < MAX_RECEIPT_FILES && (
                            <label className="p-1 hover:bg-muted rounded cursor-pointer text-muted-foreground" title={`添付追加（${urls.length}/${MAX_RECEIPT_FILES}）`}>
                              <Paperclip className="h-3.5 w-3.5" />
                              <input type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => handleReceiptUpload(item.id, e, urls.length)} />
                            </label>
                          )}
                          {urls.length > 0 && <span className="text-[10px] text-muted-foreground">{urls.length}/{MAX_RECEIPT_FILES}</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => setAuditLogId(item.id)} className="p-1.5 hover:bg-blue-50 rounded text-blue-500" title="編集履歴">
                        <Clock className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleEdit(item)} className="p-1.5 hover:bg-muted rounded">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm("削除しますか？")) deleteMutation.mutate({ id: item.id }); }}
                        className="p-1.5 hover:bg-red-50 rounded text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>表示:</span>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }} className="border rounded px-2 py-1 text-sm bg-background">
            <option value={20}>20件</option>
            <option value={50}>50件</option>
            <option value={100}>100件</option>
            <option value={200}>200件</option>
            <option value={500}>500件</option>
          </select>
          <span className="text-xs">/ 全{total}件</span>
        </div>
        {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput || (page + 1)}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= totalPages) {
                  setPage(val - 1);
                }
                setPageInput("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = parseInt((e.target as HTMLInputElement).value);
                  if (val >= 1 && val <= totalPages) {
                    setPage(val - 1);
                  }
                  setPageInput("");
                }
              }}
              className="w-12 text-center border rounded px-1 py-0.5 text-sm"
            />
            <span>/ {totalPages}</span>
          </div>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      </div>

      {/* CSV Export Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CSV导出条件</DialogTitle>
            <DialogDescription>选择导出条件，不设置则导出全部数据</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">日期范围</label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="date" value={csvStartDate} onChange={(e) => setCsvStartDate(e.target.value)} placeholder="开始日期" />
                <span className="text-muted-foreground">~</span>
                <Input type="date" value={csvEndDate} onChange={(e) => setCsvEndDate(e.target.value)} placeholder="结束日期" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">我方账户</label>
              <select
                value={csvSourceAccount}
                onChange={(e) => setCsvSourceAccount(e.target.value)}
                className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
              >
                <option value="">全部</option>
                <option value="世曜元宇(中信銀行)">世曜元宇(中信銀行)</option>
                            <option value="LCJ MITSUI">LCJ MITSUI</option>
                <option value="LCJ RESONA">LCJ RESONA</option>
                      <option value="その他">その他</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>取消</Button>
            <Button onClick={exportCsvWithFilters} disabled={exportQuery.isFetching}>
              {exportQuery.isFetching && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              <Download className="h-4 w-4 mr-1.5" />
              导出CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import History */}
      {autoClassifyMutation.data && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-3">
            <div className="text-xs text-slate-600">
              <span className="font-medium">🤖 AI分類履歴:</span> {new Date().toLocaleString("ja-JP")} - 
              全{autoClassifyMutation.data.total}件中 {autoClassifyMutation.data.updated}件のカテゴリを更新しました
            </div>
          </CardContent>
        </Card>
      )}

      {/* 原文件付き財務インポート履歴 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-blue-900">インポート履歴・原始文件</h4>
              <p className="text-xs text-blue-700/80">今后上传的原始文件会永久保留，可从这里查看或下载；数据库只显示短哈希，不暴露存储地址。</p>
            </div>
            <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700" variant="outline">
              原文件保存已启用
            </Badge>
          </div>
          {importDocumentsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-blue-700"><Loader2 className="h-4 w-4 animate-spin" />履歴を読み込み中...</div>
          ) : (importDocumentsQuery.data || []).length > 0 ? (
            <div className="space-y-2">
              {(importDocumentsQuery.data || []).map((item: any) => (
                <div key={item.id} className="rounded-lg border border-blue-200 bg-white p-3">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{FINANCE_IMPORT_MODULE_LABELS[item.module] || item.module}</Badge>
                        <span className="truncate text-sm font-medium text-slate-900">{item.sourceFileName}</span>
                        <Badge variant={item.status === "completed" ? "default" : item.status === "failed" ? "destructive" : "secondary"}>
                          {item.status === "completed" ? "完了" : item.status === "failed" ? "失败" : "处理中"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleString("ja-JP")} · {formatFileSize(item.sourceFileSize)} · SHA {item.sourceFileSha256Short}
                        {item.createdByName ? ` · ${item.createdByName}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        对象{item.recordCount}件 / 导入{item.importedCount}件 / 跳过{item.skippedCount}件 / 错误{item.errorCount}件
                      </p>
                      {item.errorMessage && <p className="mt-1 text-xs text-red-600">{item.errorMessage}</p>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!item.originalFileSaved || getImportDocumentFileMutation.isPending}
                      onClick={() => void handleImportDocumentDownload(item.id)}
                    >
                      {getImportDocumentFileMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                      查看／下载原文件
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-blue-700/70">新保存规则启用后上传的文件会显示在这里。</div>
          )}

          {legacyImportHistory.length > 0 && (
            <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-amber-900">旧インポート履歴（原文件未保存）</summary>
              <div className="mt-2 space-y-1">
                {legacyImportHistory.slice(0, 20).map((history: any, index: number) => (
                  <div key={`${history.id || index}-${history.importedAt}`} className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800">
                    <span>{new Date(history.importedAt).toLocaleString("ja-JP")}</span>
                    <span>{history.importType}</span>
                    <span>导入{history.importedCount}件 / 跳过{history.skippedCount}件</span>
                    <Badge variant="outline" className="border-amber-300 text-[10px]">原文件未保存</Badge>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-amber-700">旧文件只能在找到原始文档后补绑，系统不会伪造恢复。</p>
            </details>
          )}
        </CardContent>
      </Card>

      {meQuery.data?.role === "admin" && (
        <CashflowCategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen || editId !== null} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditId(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "入出金を編集" : "入出金を登録"}</DialogTitle>
            <DialogDescription>入金または出金の情報を入力してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">法人</label>
                <Select value={formData.entity} onValueChange={(v) => setFormData({ ...formData, entity: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="japan">🇯🇵 日本</SelectItem>
                    <SelectItem value="china">🇨🇳 中国</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">種別</label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any, category: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">入金</SelectItem>
                    <SelectItem value="expense">出金</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">カテゴリ *</label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    {categoryOptionsFor(formData.type, formData.category).map((category) => (
                      <SelectItem key={`${category.id}-${category.name}`} value={category.name}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">通貨</label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JPY">JPY (円)</SelectItem>
                    <SelectItem value="CNY">CNY (人民元)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">金額 *</label>
              <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium">取引日 *</label>
              <Input type="date" value={formData.transactionDate} onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">取引先</label>
              <Input value={formData.counterparty} onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })} placeholder="例: 株式会社ABC" />
            </div>
            <div>
              <label className="text-xs font-medium">我方账户</label>
              <select
                value={formData.sourceAccount}
                onChange={(e) => setFormData({ ...formData, sourceAccount: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">未選択</option>
                <option value="LCJ MITSUI">LCJ MITSUI</option>
                <option value="LCJ RESONA">LCJ RESONA</option>
                <option value="世曜元宇(中信銀行)">世曜元宇(中信銀行)</option>
                                </select>
            </div>
            <div>
              <label className="text-xs font-medium">説明</label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="詳細メモ" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditId(null); resetForm(); }}>
              キャンセル
            </Button>
            <Button
              onClick={editId ? handleUpdate : handleCreate}
              disabled={!formData.category || !formData.amount || !formData.transactionDate || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editId ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendingDescriptionsPanel({ entity }: { entity: string }) {
  const [expanded, setExpanded] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const pendingQuery = trpc.cashflow.getPendingDescriptions.useQuery(
    { entity: entity as any, month: filterMonth || undefined },
    { enabled: expanded }
  );

  const bulkUpdateMutation = trpc.cashflow.bulkUpdateDescriptions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated}件の説明を保存しました`);
      const newSaved = new Set(savedIds);
      Object.keys(edits).forEach(id => newSaved.add(Number(id)));
      setSavedIds(newSaved);
      setEdits({});
      pendingQuery.refetch();
    },
    onError: () => toast.error("保存に失敗しました"),
  });

  const pendingData = pendingQuery.data || { items: [], autoFilled: 0, anomalies: [] };
  const pendingItems = pendingData.items || (Array.isArray(pendingQuery.data) ? pendingQuery.data : []);
  const editedCount = Object.keys(edits).filter(id => edits[Number(id)]?.trim()).length;

  // Generate month options from data
  const months = useMemo(() => {
    if (!pendingItems.length) return [];
    const set = new Set<string>();
    pendingItems.forEach((item: any) => {
      if (item.transactionDate) set.add(item.transactionDate.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [pendingItems]);

  const handleSave = () => {
    const updates = Object.entries(edits)
      .filter(([_, desc]) => desc.trim())
      .map(([id, description]) => ({ id: Number(id), description }));
    if (updates.length === 0) {
      toast.error("入力された説明がありません");
      return;
    }
    bulkUpdateMutation.mutate({ updates });
  };

  // Total count (without month filter)
  const totalQuery = trpc.cashflow.getPendingDescriptions.useQuery(
    { entity: entity as any },
    { enabled: true }
  );
  const totalData = totalQuery.data || { items: [], autoFilled: 0, anomalies: [] };
  const totalCount = totalData.items?.length || (Array.isArray(totalQuery.data) ? totalQuery.data.length : 0);
  const totalAutoFilled = totalData.autoFilled || 0;
  const totalAnomalies = totalData.anomalies || [];

  if (totalCount === 0 && !expanded) return null;

  return (
    <div className="border border-yellow-300 bg-yellow-50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-yellow-100 transition-colors"
      >
        <span className="text-sm font-medium text-yellow-800">
          ⚠️ 待补充说明：{totalCount}件（大额）{totalAutoFilled > 0 && ` | ✅ ${totalAutoFilled}件の小額は自動処理済み`}{totalAnomalies.length > 0 && ` | 🔴 異常${totalAnomalies.length}件`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-yellow-600">点击展开，直接输入说明</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-yellow-600" /> : <ChevronDown className="h-4 w-4 text-yellow-600" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-yellow-300 p-4">
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="text-sm border rounded px-3 py-1.5 bg-white"
            >
              <option value="">全部月份</option>
              {months.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-sm text-yellow-700">
              显示: {pendingItems.length}件
              {editedCount > 0 && (
                <span className="ml-2 text-green-700 font-medium">（已输入: {editedCount}件）</span>
              )}
            </span>
            {editedCount > 0 && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={bulkUpdateMutation.isPending}
                className="ml-auto bg-green-600 hover:bg-green-700 text-white"
              >
                {bulkUpdateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                一括保存（{editedCount}件）
              </Button>
            )}
          </div>

          {/* Anomaly warnings */}
          {pendingData.anomalies && pendingData.anomalies.length > 0 && (
            <div className="mb-4 border border-red-300 bg-red-50 rounded-lg p-3">
              <div className="text-sm font-medium text-red-800 mb-2">🔴 小額異常検出（月累計が高い人物）</div>
              {pendingData.anomalies.map((a: any, i: number) => (
                <div key={i} className="text-sm text-red-700 flex items-center gap-2 py-1">
                  <span className="font-medium">{a.counterparty}</span>
                  <span>月累計 ¥{Number(a.totalAmount).toLocaleString()}</span>
                  <span className="text-red-500">({a.txCount}件)</span>
                  <span className="text-red-400 text-xs">← 要確認</span>
                </div>
              ))}
            </div>
          )}
          {pendingData.autoFilled > 0 && (
            <div className="mb-4 border border-green-300 bg-green-50 rounded-lg p-2 text-sm text-green-700">
              ✅ {pendingData.autoFilled}件の小額取引（¥500未満）を「日常零星支出」として自動処理しました
            </div>
          )}
          
      {/* Table */}
          {pendingQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
              <span className="ml-2 text-sm text-yellow-600">読み込み中...</span>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-yellow-100">
                  <tr>
                    <th className="text-left p-2 font-medium text-yellow-800 w-24">日付</th>
                    <th className="text-left p-2 font-medium text-yellow-800 w-20">種別</th>
                    <th className="text-right p-2 font-medium text-yellow-800 w-32">金額</th>
                    <th className="text-left p-2 font-medium text-yellow-800 w-40">取引先</th>
                    <th className="text-left p-2 font-medium text-yellow-800 w-24">現在の説明</th>
                    <th className="text-left p-2 font-medium text-yellow-800">補充説明</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item: any, idx: number) => {
                    const isSaved = savedIds.has(item.id);
                    const hasEdit = edits[item.id]?.trim();
                    return (
                      <tr
                        key={item.id}
                        className={`border-t border-yellow-200 ${isSaved ? 'bg-green-50' : hasEdit ? 'bg-blue-50' : 'bg-white'} hover:bg-yellow-50`}
                      >
                        <td className="p-2 text-gray-600">{item.transactionDate}</td>
                        <td className="p-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${item.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {item.type === 'income' ? '入金' : '出金'}
                          </span>
                        </td>
                        <td className={`p-2 text-right font-mono ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {item.type === 'income' ? '+' : '-'}¥{Math.abs(Number(item.amount)).toLocaleString(undefined, entity === 'china' ? {minimumFractionDigits: 2, maximumFractionDigits: 2} : {})}
                        </td>
                        <td className="p-2 text-gray-700 truncate max-w-[160px]" title={item.counterparty}>{item.counterparty || '-'}</td>
                        <td className="p-2 text-gray-400 text-xs">{item.description || '-'}</td>
                        <td className="p-2">
                          {isSaved ? (
                            <span className="text-green-600 flex items-center gap-1"><Check className="h-4 w-4" /> 保存済み</span>
                          ) : (
                            <input
                              type="text"
                              value={edits[item.id] || ''}
                              onChange={(e) => setEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Tab' || e.key === 'Enter') {
                                  // Focus next input
                                  const inputs = document.querySelectorAll('.pending-desc-input');
                                  const currentIdx = Array.from(inputs).indexOf(e.target as Element);
                                  if (currentIdx < inputs.length - 1) {
                                    e.preventDefault();
                                    (inputs[currentIdx + 1] as HTMLInputElement).focus();
                                  }
                                }
                              }}
                              placeholder="具体用途を入力..."
                              className="pending-desc-input w-full border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom save bar */}
          {editedCount > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-yellow-300 pt-3">
              <span className="text-sm text-yellow-700">
                {editedCount}件の説明を入力済み
              </span>
              <Button
                onClick={handleSave}
                disabled={bulkUpdateMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {bulkUpdateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                確認して一括保存
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuditLogDialog({ cashflowId, onClose }: { cashflowId: number; onClose: () => void }) {
  const auditQuery = trpc.cashflow.getAuditLog.useQuery({ cashflowId });
  const logs = auditQuery.data || [];

  const fieldLabels: Record<string, string> = {
    amount: '金額', category: 'カテゴリ', description: '説明', counterparty: '取引先',
    type: '種別', transactionDate: '日付', entity: '法人', currency: '通貨',
    sourceAccount: '我方账户', receiptUrl: '領収書',
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> 編集履歴 (ID: {cashflowId})
          </DialogTitle>
          <DialogDescription>この取引の変更履歴</DialogDescription>
        </DialogHeader>
        {auditQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            履歴がありません（この機能追加前のデータ）
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log: any) => (
              <div key={log.id} className={`border rounded-lg p-3 ${
                log.action === 'create' ? 'border-green-200 bg-green-50' :
                log.action === 'delete' ? 'border-red-200 bg-red-50' :
                'border-blue-200 bg-blue-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      log.action === 'create' ? 'bg-green-200 text-green-800' :
                      log.action === 'delete' ? 'bg-red-200 text-red-800' :
                      'bg-blue-200 text-blue-800'
                    }`}>
                      {log.action === 'create' ? '作成' : log.action === 'delete' ? '削除' : '編集'}
                    </span>
                    <span className="text-sm font-medium">{log.userName || '不明'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString('ja-JP')}
                  </span>
                </div>
                {log.action === 'update' && log.changes && (() => {
                  try {
                    const changes = typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes;
                    return (
                      <div className="space-y-1 text-sm">
                        {Object.entries(changes).map(([key, val]: [string, any]) => (
                          <div key={key} className="flex items-start gap-1">
                            <span className="text-muted-foreground min-w-[80px]">{fieldLabels[key] || key}:</span>
                            <span className="text-red-500 line-through">{String(val.from || '(空)')}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-green-700 font-medium">{String(val.to || '(空)')}</span>
                          </div>
                        ))}
                      </div>
                    );
                  } catch { return null; }
                })()}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
import { Paperclip, FileText, Eye, X } from "lucide-react";
