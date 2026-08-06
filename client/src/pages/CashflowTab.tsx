import { useState, useMemo } from "react";
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
  ChevronLeft, ChevronRight, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Calendar
} from "lucide-react";

function formatCurrency(val: number | string | null | undefined, currency: string = "JPY"): string {
  const num = typeof val === "string" ? parseFloat(val) : (val || 0);
  if (currency === "CNY") {
    return `¥${Math.round(num).toLocaleString()} RMB`;
  }
  return `¥${Math.round(num).toLocaleString()}`;
}

// 为替レート表示用
const EXCHANGE_RATE_CNY_JPY = 20.5;

// カテゴリ名の中国語マッピング
const CATEGORY_CN_MAP: Record<string, string> = {
  "給与・人件費": "工资・人工费",
  "交通費": "交通费",
  "広告・マーケティング": "广告・营销",
  "家賃・オフィス": "租金・办公室",
  "通信・光熱費": "网络・水电",
  "物流・配送": "物流・快递",
  "飲食・接待": "餐饮・招待",
  "ソフトウェア・ツール": "软件・工具",
  "本社送金": "总部汇款",
  "ライブ・配信": "直播・配信",
  "TikTok・越境EC": "TikTok・跨境电商",
  "設備・備品": "设备・物品",
  "手数料": "手续费",
  "商品仕入": "商品采购",
  "モデル・タレント": "模特・艺人",
  "採用費": "招聘费",
  "その他経費": "其他费用",
  "振込": "转账",
  "世曜元宇資金": "世曜元宇资金",
  "花秘代付": "花秘代付",
  "品汇盟代付": "品汇盟代付",
};
const getCategoryLabel = (category: string, isChinaEntity: boolean) => {
  if (!isChinaEntity) return category;
  return CATEGORY_CN_MAP[category] || category;
}; // 1 CNY ≈ 20.5 JPY (参考レート)
function formatWithExchangeRate(val: number | string | null | undefined, currency: string = "JPY"): { main: string; sub: string | null } {
  const num = typeof val === "string" ? parseFloat(val) : (val || 0);
  if (currency === "CNY") {
    const jpyEquiv = Math.round(num * EXCHANGE_RATE_CNY_JPY);
    return {
      main: `¥${Math.round(num).toLocaleString()} RMB`,
      sub: `≈ ¥${jpyEquiv.toLocaleString()} JPY`,
    };
  }
  return { main: `¥${Math.round(num).toLocaleString()}`, sub: null };
}

const CATEGORIES_INCOME = ["売上", "入金", "投資回収", "助成金", "本社送金", "TikTok・越境EC", "ライブ・配信", "その他入金", "世曜元宇資金", "花秘代収代付", "品汇盟代収代付"];
const CATEGORIES_EXPENSE = ["給与・人件費", "交通費", "広告・マーケティング", "家賃・オフィス", "通信・光熱費", "物流・配送", "飲食・接待", "ソフトウェア・ツール", "本社送金", "ライブ・配信", "TikTok・越境EC", "設備・備品", "手数料", "商品仕入", "モデル・タレント", "採用費", "その他経費", "世曜元宇資金", "花秘代付", "品汇盟代付"];

export default function CashflowTab() {
  const [entity, setEntity] = useState<"all" | "japan" | "china">("china");
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const selectedYearMonth = selectedMonth > 0;
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"transactionDate" | "amount" | "category" | "counterparty">("transactionDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const limit = 20;

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

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

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
  });

  // Queries
  const summaryQuery = trpc.cashflow.getTotalSummary.useQuery({
    entity,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
  });

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
  });

  const balanceQuery = trpc.cashflow.getBalanceHistory.useQuery({ entity });

  const categoryBreakdownQuery = trpc.cashflow.getCategoryBreakdown.useQuery({
    entity,
    type: "expense",
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
  });

  const categoryBreakdown = categoryBreakdownQuery.data || [];

  // Mutations
  const autoClassifyMutation = trpc.cashflow.autoClassify.useMutation({
    onSuccess: (data) => {
      toast.success(`AI分類完了: ${data.updated}件更新`);
      listQuery.refetch();
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
    onSuccess: () => {
      toast.success("更新しました");
      setEditId(null);
      resetForm();
      listQuery.refetch();
      summaryQuery.refetch();
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

  const importBankMutation = trpc.cashflow.importBankStatement.useMutation({
    onSuccess: (data) => {
      toast.success(`导入完成: ${data.imported}件新規, ${data.skipped}件スキップ(重複)`);
      listQuery.refetch();
      summaryQuery.refetch();
      balanceQuery.refetch();
      categoryBreakdownQuery.refetch();
      importHistoryQuery.refetch();
    },
    onError: (e) => toast.error(`导入失败: ${e.message}`),
  });

  const importHistoryQuery = trpc.cashflow.getImportHistory.useQuery({ entity: entity === 'all' ? 'all' : entity });

  async function handleBankStatementUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset input

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      // ヘッダー行を見つける
      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const row = rows[i];
        if (row && row.some((c: any) => String(c || '').includes('交易日期'))) {
          headerIdx = i;
          break;
        }
      }
      const headers = (rows[headerIdx] || []).map((h: any) => String(h || '').trim());

      // 列インデックスを特定
      const dateCol = headers.findIndex(h => h.includes('交易日期'));
      const counterpartyCol = headers.findIndex(h => h.includes('对方账户名称'));
      const debitCol = headers.findIndex(h => h.includes('借方发生额'));
      const creditCol = headers.findIndex(h => h.includes('贷方发生额'));
      const descCol = headers.findIndex(h => h.includes('摘要'));
      const balanceCol = headers.findIndex(h => h.includes('账户余额'));

      if (dateCol < 0) {
        toast.error('无法识别文件格式: 找不到"交易日期"列');
        return;
      }

      const records: { transactionDate: string; counterparty: string; debitAmount?: number; creditAmount?: number; description: string; balance?: number }[] = [];

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[dateCol]) continue;

        // 日付解析
        let dateStr = '';
        const rawDate = row[dateCol];
        if (rawDate instanceof Date) {
          dateStr = rawDate.toISOString().slice(0, 10);
        } else if (typeof rawDate === 'number') {
          // Excel serial date
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

        records.push({
          transactionDate: dateStr,
          counterparty,
          debitAmount: debit,
          creditAmount: credit,
          description: desc,
          balance,
        });
      }

      if (records.length === 0) {
        toast.error('有效数据为0条，请检查文件格式');
        return;
      }

      toast.info(`解析完成: ${records.length}条记录，正在导入...`);
      importBankMutation.mutate({ records, entity: entity === 'all' ? 'china' : entity as 'japan' | 'china' });
    } catch (err: any) {
      toast.error(`文件解析失败: ${err.message}`);
    }
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
    });
  }

  // CSV Export
  function exportCsv() {
    const items = listQuery.data?.items || [];
    const headers = ["ID", "法人", "種別", "カテゴリ", "金額", "通貨", "日付", "取引先", "説明"];
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
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow_${entity}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = summaryQuery.data;
  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const balanceHistory = balanceQuery.data || [];
  // 月選択時はその月の累積残高を表示、未選択時は最新月
  const currentBalance = (() => {
    if (balanceHistory.length === 0) return 0;
    if (selectedYearMonth && dateRange.end) {
      // 選択月に対応するbalanceHistoryのエントリを探す
      const targetMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const entry = balanceHistory.find((b: any) => b.month === targetMonth);
      if (entry) return entry.balance;
    }
    return balanceHistory[balanceHistory.length - 1].balance;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={entity} onValueChange={(v) => { setEntity(v as any); setPage(0); }}>
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
                      const start = `${selectedYear}-${String(m).padStart(2, '0')}-01`;
                      const lastDay = new Date(selectedYear, m, 0).getDate();
                      const end = `${selectedYear}-${String(m).padStart(2, '0')}-${lastDay}`;
                      setDateRange({ start, end });
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

        <div className="ml-auto flex gap-2">
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

      {/* Exchange Rate Info - shown when China entity selected */}
      {entity === "china" && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <RefreshCw className="h-4 w-4 text-amber-600" />
          <span className="text-amber-800 font-medium">為替レート参考:</span>
          <span className="text-amber-700">1 CNY ≈ {EXCHANGE_RATE_CNY_JPY} JPY</span>
          <span className="text-amber-500 text-xs ml-2">※金額は全て人民元(RMB)で表示</span>
        </div>
      )}

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
                        <div key={i} className="flex-1 flex flex-col items-center relative" style={{ height: chartHeight }}>
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">📊 カテゴリ別支出分析</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => autoClassifyMutation.mutate({ entity: entity === "all" ? "china" : entity })}
                disabled={autoClassifyMutation.isPending}
              >
                {autoClassifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                AI自動分類
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* バーチャート - タップで明細展開 */}
              <div className="space-y-1">
                {categoryBreakdown.slice(0, 8).map((cat: any, i: number) => {
                  const colors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-lime-500", "bg-green-500", "bg-teal-500", "bg-blue-500"];
                  const maxAmount = categoryBreakdown[0]?.totalAmount || 1;
                  const width = Math.max((Number(cat.totalAmount) / Number(maxAmount)) * 100, 5);
                  const isExpanded = expandedCategory === cat.category;
                  return (
                    <div key={i}>
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded-md p-1 transition-colors"
                        onClick={() => { setExpandedCategory(isExpanded ? null : cat.category); setPage(0); }}
                      >
                        <span className="text-xs w-[140px] truncate font-medium">{getCategoryLabel(cat.category, entity === 'china')}</span>
                        <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[i % colors.length]} transition-all`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-[80px] text-right">
                          {entity === "china" ? formatCurrency(cat.totalAmount, "CNY") : formatCurrency(cat.totalAmount)}
                        </span>
                        <span className="text-xs text-muted-foreground w-[45px] text-right">{cat.percentage}%</span>
                        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                      {/* 展開明細 */}
                      {isExpanded && (
                        <div className="ml-4 mt-1 mb-2 border-l-2 border-gray-200 pl-3 space-y-1 max-h-[300px] overflow-y-auto">
                          {(listQuery.data?.items || []).filter((item: any) => item.category === cat.category).length > 0 ? (
                            (listQuery.data?.items || []).filter((item: any) => item.category === cat.category).map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1 text-xs py-1 border-b border-gray-100 last:border-0">
                                <span className="text-muted-foreground w-[50px] shrink-0">{item.transactionDate?.slice(5)}</span>
                                <select
                                  defaultValue={item.category || ''}
                                  onChange={(e) => {
                                    updateMutation.mutate({ id: item.id, category: e.target.value, entity: item.entity, type: item.type, amount: item.amount, currency: item.currency, transactionDate: item.transactionDate, description: item.description, counterparty: item.counterparty });
                                  }}
                                  className="bg-transparent border border-dashed border-muted-foreground/30 hover:border-primary cursor-pointer text-[10px] p-0.5 rounded focus:ring-0 focus:border-primary w-[80px] shrink-0"
                                >
                                  {entity === 'china' ? (
                                    <>
                                      <option value="給与・人件費">工资</option>
                                      <option value="交通費">交通</option>
                                      <option value="広告・マーケティング">广告</option>
                                      <option value="家賃・オフィス">租金</option>
                                      <option value="通信・光熱費">网络</option>
                                      <option value="物流・配送">物流</option>
                                      <option value="飲食・接待">餐饮</option>
                                      <option value="ソフトウェア・ツール">软件</option>
                                      <option value="本社送金">汇款</option>
                                      <option value="ライブ・配信">直播</option>
                                      <option value="TikTok・越境EC">TikTok</option>
                                      <option value="設備・備品">设备</option>
                                      <option value="手数料">手续费</option>
                                      <option value="商品仕入">采购</option>
                                      <option value="その他経費">其他</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="給与・人件費">給与</option>
                                      <option value="交通費">交通</option>
                                      <option value="家賃・オフィス">家賃</option>
                                      <option value="その他経費">その他</option>
                                    </>
                                  )}
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
                                  {entity === "china" ? formatCurrency(item.amount, "CNY") : formatCurrency(item.amount)}
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
                        key={i}
                        className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => { setExpandedCategory(expandedCategory === cat.category ? null : cat.category); setPage(0); }}
                      >
                        <td className="p-2 font-medium flex items-center gap-1">
                          <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === cat.category ? 'rotate-90' : ''}`} />
                          {getCategoryLabel(cat.category, entity === 'china')}
                        </td>
                        <td className="p-2 text-right">{entity === "china" ? formatCurrency(cat.totalAmount, "CNY") : formatCurrency(cat.totalAmount)}</td>
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
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1.5" />
          CSV
        </Button>
        <span className="text-sm text-muted-foreground">{total}件</span>
      </div>
      {expandedCategory && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md">
          <span className="text-sm font-medium text-purple-800">📊 カテゴリフィルター: {expandedCategory}</span>
          <button onClick={() => setExpandedCategory(null)} className="text-purple-500 hover:text-purple-700 text-xs font-bold ml-2">✕ クリア</button>
        </div>
      )}

      {/* Cashflow Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
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
              <th className="text-left p-3 font-medium">説明</th>
              <th className="text-center p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  入出金データがありません
                </td>
              </tr>
            ) : (
              items.map((item: any) => (
                <tr key={item.id} className="border-t hover:bg-muted/30 transition-colors">
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
                      className="bg-transparent border-0 border-b border-dashed border-muted-foreground/30 hover:border-primary cursor-pointer text-xs p-0 focus:ring-0 focus:border-primary max-w-[120px]"
                    >
                      {entity === 'china' ? (
                        <>
                          <option value="給与・人件費">工资・人工费</option>
                          <option value="交通費">交通费</option>
                          <option value="広告・マーケティング">广告・营销</option>
                          <option value="家賃・オフィス">租金・办公室</option>
                          <option value="通信・光熱費">网络・水电</option>
                          <option value="物流・配送">物流・快递</option>
                          <option value="飲食・接待">餐饮・招待</option>
                          <option value="ソフトウェア・ツール">软件・工具</option>
                          <option value="本社送金">总部汇款</option>
                          <option value="ライブ・配信">直播・配信</option>
                          <option value="TikTok・越境EC">TikTok・跨境电商</option>
                          <option value="設備・備品">设备・物品</option>
                          <option value="手数料">手续费</option>
                          <option value="商品仕入">商品采购</option>
                          <option value="モデル・タレント">模特・艺人</option>
                          <option value="採用費">招聘费</option>
                          <option value="その他経費">其他费用</option>
                          <option value="世曜元宇資金">世曜元宇资金</option>
                          <option value="花秘代付">花秘代付</option>
                          <option value="品汇盟代付">品汇盟代付</option>
                        </>
                      ) : (
                        <>
                          <option value="給与・人件費">給与・人件費</option>
                          <option value="交通費">交通費</option>
                          <option value="広告・マーケティング">広告・マーケティング</option>
                          <option value="家賃・オフィス">家賃・オフィス</option>
                          <option value="通信・光熱費">通信・光熱費</option>
                          <option value="物流・配送">物流・配送</option>
                          <option value="飲食・接待">飲食・接待</option>
                          <option value="ソフトウェア・ツール">ソフトウェア・ツール</option>
                          <option value="本社送金">本社送金</option>
                          <option value="ライブ・配信">ライブ・配信</option>
                          <option value="TikTok・越境EC">TikTok・越境EC</option>
                          <option value="設備・備品">設備・備品</option>
                          <option value="手数料">手数料</option>
                          <option value="商品仕入">商品仕入</option>
                          <option value="モデル・タレント">モデル・タレント</option>
                          <option value="採用費">採用費</option>
                          <option value="その他経費">その他経費</option>
                          <option value="振込">振込</option>
                        </>
                      )}
                    </select>
                  </td>
                  <td className={`p-3 text-right font-medium ${item.type === "income" ? "text-green-700" : "text-red-700"}`}>
                    <div>{item.type === "income" ? "+" : "-"}{formatCurrency(item.amount, item.currency)}</div>
                    {item.currency === "CNY" && (
                      <div className="text-[10px] text-muted-foreground font-normal">≈ ¥{Math.round(item.amount * EXCHANGE_RATE_CNY_JPY).toLocaleString()} JPY</div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    <select
                      value={item.counterparty || ''}
                      onChange={(e) => {
                        updateMutation.mutate({ id: item.id, counterparty: e.target.value, entity: item.entity, type: item.type, amount: item.amount, currency: item.currency, transactionDate: item.transactionDate, description: item.description, category: item.category });
                      }}
                      className="bg-transparent border-0 border-b border-dashed border-muted-foreground/30 hover:border-primary cursor-pointer text-xs p-0 focus:ring-0 focus:border-primary"
                    >
                      <option value="世曜元宇">世曜元宇</option>
                      <option value="花秘">花秘</option>
                      <option value="品汇盟">品汇盟</option>
                      <option value="LCJ">LCJ</option>
                      <option value="日本総部">日本総部</option>
                      <option value="その他">その他</option>
                    </select>
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
                  <td className="p-3 text-center">
                    <div className="flex items-center gap-1 justify-center">
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
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

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

      {/* 银行流水导入履歴 */}
      {importHistoryQuery.data && importHistoryQuery.data.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <h4 className="text-xs font-medium text-blue-800 mb-2">📝 {entity === 'china' ? '导入履历' : 'インポート履歴'}</h4>
            <div className="space-y-1">
              {importHistoryQuery.data.slice(0, 5).map((h: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs text-blue-700">
                  <span>{new Date(h.importedAt).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{h.importType}</span>
                  <span>导入{h.importedCount}件 / 跳过{h.skippedCount}件</span>
                  <Badge variant="outline" className="text-[10px]">{h.entity === 'china' ? '🇨🇳' : '🇯🇵'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
                    {(formData.type === "income" ? CATEGORIES_INCOME : CATEGORIES_EXPENSE).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
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
              <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0" />
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
