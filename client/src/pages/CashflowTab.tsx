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
  ChevronLeft, ChevronRight, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";

function formatCurrency(val: number | string | null | undefined, currency: string = "JPY"): string {
  const num = typeof val === "string" ? parseFloat(val) : (val || 0);
  if (currency === "CNY") {
    return `¥${Math.round(num).toLocaleString()} RMB`;
  }
  return `¥${Math.round(num).toLocaleString()}`;
}

// 为替レート表示用
const EXCHANGE_RATE_CNY_JPY = 20.5; // 1 CNY ≈ 20.5 JPY (参考レート)
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

const CATEGORIES_INCOME = ["売上", "入金", "投資回収", "助成金", "その他入金", "世曜元宇資金", "花秘代収代付", "品汇盟代収代付"];
const CATEGORIES_EXPENSE = ["仕入", "人件費", "広告費", "家賃", "通信費", "交通費", "外注費", "消耗品", "税金", "手数料", "その他支出", "世曜元宇資金", "花秘代収代付", "品汇盟代収代付"];

export default function CashflowTab() {
  const [entity, setEntity] = useState<"all" | "japan" | "china">("all");
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
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
    type: type === "all" ? undefined : type,
    category: undefined,
    search: search || undefined,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    page: page + 1,
    pageSize: limit,
    sortBy,
    sortOrder,
  });

  const balanceQuery = trpc.cashflow.getBalanceHistory.useQuery({ entity });

  // Mutations
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
  const currentBalance = balanceHistory.length > 0 ? balanceHistory[balanceHistory.length - 1].balance : 0;

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

        <Input
          type="date"
          value={dateRange.start}
          onChange={(e) => { setDateRange({ ...dateRange, start: e.target.value }); setPage(0); }}
          className="w-[150px]"
        />
        <span className="text-muted-foreground">〜</span>
        <Input
          type="date"
          value={dateRange.end}
          onChange={(e) => { setDateRange({ ...dateRange, end: e.target.value }); setPage(0); }}
          className="w-[150px]"
        />

        <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="ml-auto">
          <Plus className="h-4 w-4 mr-1.5" />
          入出金登録
        </Button>
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
              残高（累計）
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
            <div className="flex items-end gap-1 h-20">
              {balanceHistory.slice(-12).map((item, i) => {
                const maxBal = Math.max(...balanceHistory.slice(-12).map((b) => Math.abs(b.balance)), 1);
                const height = Math.max((Math.abs(item.balance) / maxBal) * 100, 4);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                      {entity === "china" ? formatCurrency(item.balance, "CNY") : formatCurrency(item.balance)}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all ${item.balance >= 0 ? "bg-gradient-to-t from-blue-500 to-blue-300" : "bg-gradient-to-t from-red-500 to-red-300"}`}
                      style={{ height: `${height}%`, minHeight: "4px" }}
                    />
                    <span className="text-[9px] text-muted-foreground">{item.month.slice(5)}</span>
                  </div>
                );
              })}
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
                  <td className="p-3">{item.category}</td>
                  <td className={`p-3 text-right font-medium ${item.type === "income" ? "text-green-700" : "text-red-700"}`}>
                    <div>{item.type === "income" ? "+" : "-"}{formatCurrency(item.amount, item.currency)}</div>
                    {item.currency === "CNY" && (
                      <div className="text-[10px] text-muted-foreground font-normal">≈ ¥{Math.round(item.amount * EXCHANGE_RATE_CNY_JPY).toLocaleString()} JPY</div>
                    )}
                  </td>
                  <td className="p-3 text-xs">{item.counterparty || "-"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{item.description || "-"}</td>
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
