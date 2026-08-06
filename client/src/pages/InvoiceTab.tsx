import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, Upload, Download, Search, Trash2, Edit2, ExternalLink,
  Loader2, AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight,
  Plus, Building2, DollarSign
} from "lucide-react";

function formatCurrency(val: number | string | null | undefined, currency: string = "JPY"): string {
  const num = typeof val === "string" ? parseFloat(val) : (val || 0);
  const symbol = currency === "CNY" ? "¥" : "¥";
  return `${symbol}${Math.round(num).toLocaleString()}`;
}

export default function InvoiceTab() {
  const [entity, setEntity] = useState<"all" | "japan" | "china">("all");
  const [invoiceType, setInvoiceType] = useState<"receivable" | "payable">("receivable");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const limit = 20;

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    entity: "japan" as "japan" | "china",
    name: "",
    counterparty: "",
    amount: "",
    currency: "JPY" as "JPY" | "CNY",
    startDate: "",
    endDate: "",
    managerName: "",
    memo: "",
  });

  // Queries
  const summaryQuery = trpc.invoice.summary.useQuery({ entity, invoiceType });
  const monthlyQuery = trpc.invoice.monthlyStats.useQuery({ year, entity, invoiceType });
  const managersQuery = trpc.invoice.managers.useQuery();
  const listQuery = trpc.invoice.list.useQuery({
    entity,
    invoiceType,
    status: statusFilter === "all" ? undefined : statusFilter === "overdue" ? 0 : Number(statusFilter),
    overdue: statusFilter === "overdue" ? true : undefined,
    search: search || undefined,
    managerId: managerFilter !== "all" ? Number(managerFilter) : undefined,
    limit,
    offset: page * limit,
  });

  // Mutations
  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: () => {
      toast.success("請求書を作成しました");
      setCreateOpen(false);
      resetForm();
      listQuery.refetch();
      summaryQuery.refetch();
      monthlyQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.invoice.update.useMutation({
    onSuccess: () => {
      toast.success("更新しました");
      setEditId(null);
      resetForm();
      listQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.invoice.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      listQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateAccountingMutation = trpc.invoice.updateAccountingStatus.useMutation({
    onSuccess: () => {
      toast.success("計上ステータスを更新しました");
      listQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.invoice.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      listQuery.refetch();
      summaryQuery.refetch();
      monthlyQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadFileMutation = trpc.invoice.uploadFile.useMutation();
  const parseAiMutation = trpc.invoice.parseWithAi.useMutation();

  function resetForm() {
    setFormData({
      entity: "japan",
      name: "",
      counterparty: "",
      amount: "",
      currency: "JPY",
      startDate: "",
      endDate: "",
      managerName: "",
      memo: "",
    });
  }

  function handleCreate() {
    createMutation.mutate({
      entity: formData.entity,
      invoiceType,
      name: formData.name,
      counterparty: formData.counterparty || undefined,
      amount: Number(formData.amount) || 0,
      currency: formData.currency,
      startDate: formData.startDate,
      endDate: formData.endDate,
      managerName: formData.managerName || undefined,
      memo: formData.memo || undefined,
    });
  }

  function handleEdit(invoice: any) {
    setEditId(invoice.id);
    setFormData({
      entity: invoice.entity || "japan",
      name: invoice.name || "",
      counterparty: invoice.counterparty || "",
      amount: String(invoice.amount || ""),
      currency: invoice.currency || "JPY",
      startDate: invoice.startDate || "",
      endDate: invoice.endDate || "",
      managerName: invoice.managerName || "",
      memo: invoice.memo || "",
    });
  }

  function handleUpdate() {
    if (!editId) return;
    updateMutation.mutate({
      id: editId,
      entity: formData.entity,
      name: formData.name,
      counterparty: formData.counterparty || undefined,
      amount: Number(formData.amount) || 0,
      currency: formData.currency as "JPY" | "CNY",
      startDate: formData.startDate,
      endDate: formData.endDate,
      managerName: formData.managerName || undefined,
      memo: formData.memo || undefined,
    });
  }

  // File upload & AI parse
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      // Convert to base64 in chunks to avoid Maximum call stack size exceeded
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const uploadResult = await uploadFileMutation.mutateAsync({
        fileName: file.name,
        fileData: base64,
        contentType: file.type,
      });
      toast.success("ファイルをアップロードしました");

      // AI parse
      toast.info("AIで請求書を解析中...");
      const parsed = await parseAiMutation.mutateAsync({
        fileUrl: uploadResult.url,
        contentType: file.type,
      });

      setFormData((prev) => ({
        ...prev,
        name: (parsed as any).name || prev.name,
        counterparty: (parsed as any).counterparty || prev.counterparty,
        amount: String((parsed as any).amount || prev.amount),
        startDate: (parsed as any).startDate || prev.startDate,
        endDate: (parsed as any).endDate || prev.endDate,
        currency: ((parsed as any).currency as "JPY" | "CNY") || prev.currency,
        memo: (parsed as any).memo || prev.memo,
      }));
      toast.success("AI解析完了！内容を確認してください");
      setUploadOpen(false);
      setCreateOpen(true);
    } catch (err: any) {
      toast.error("アップロードエラー: " + (err.message || "不明なエラー"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // CSV Export
  function exportCsv() {
    const invoices = listQuery.data?.invoices || [];
    const headers = ["ID", "法人", "請求書名", "取引先", "金額", "通貨", "期間", "支払期日", "ステータス", "計上", "担当者", "メモ"];
    const rows = invoices.map((inv: any) => [
      inv.id,
      inv.entity === "japan" ? "日本" : "中国",
      inv.name,
      inv.counterparty || "",
      inv.amount,
      inv.currency,
      inv.startDate || "",
      inv.endDate || "",
      inv.status === 1 ? "支払済" : "支払待ち",
      inv.accountingStatus === 1 ? "計上済" : "未計上",
      inv.managerName || "",
      inv.memo || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_${entity}_${invoiceType}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = summaryQuery.data;
  const monthly = monthlyQuery.data || [];
  const invoices = listQuery.data?.invoices || [];
  const total = listQuery.data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const managers = managersQuery.data || [];

  // Monthly chart max
  const maxMonthly = Math.max(...monthly.map((m) => m.total), 1);

  return (
    <div className="space-y-6">
      {/* Type Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setInvoiceType("receivable")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${invoiceType === "receivable" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FileText className="h-4 w-4 inline mr-1.5" />
            売上請求書
          </button>
          <button
            onClick={() => setInvoiceType("payable")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${invoiceType === "payable" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <DollarSign className="h-4 w-4 inline mr-1.5" />
            支払請求書
          </button>
        </div>

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

        <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="ml-auto">
          <Plus className="h-4 w-4 mr-1.5" />
          請求書追加
        </Button>
        <Button variant="outline" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          請求書アップロード
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 text-white">
          <CardContent className="p-4">
            <div className="text-xs text-slate-300 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              総件数
            </div>
            <div className="text-2xl font-bold mt-1">{summary?.totalCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="text-xs text-amber-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              支払待ち
            </div>
            <div className="text-lg font-bold text-amber-800 mt-1">{summary?.pendingCount || 0}</div>
            <div className="text-xs text-amber-600">{formatCurrency(summary?.pendingAmount)}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="text-xs text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              期日超過
            </div>
            <div className="text-lg font-bold text-red-800 mt-1">{summary?.overdueCount || 0}</div>
            <div className="text-xs text-red-600">{formatCurrency(summary?.overdueAmount)}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="text-xs text-green-700 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              支払済
            </div>
            <div className="text-lg font-bold text-green-800 mt-1">{summary?.paidCount || 0}</div>
            <div className="text-xs text-green-600">{formatCurrency(summary?.paidAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Chart */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">📈 月別推移</h3>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-1 h-24">
            {Array.from({ length: 12 }, (_, i) => {
              const m = monthly.find((x) => x.month === i + 1);
              const val = m?.total || 0;
              const height = val > 0 ? Math.max((val / maxMonthly) * 100, 4) : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  {val > 0 && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatCurrency(val)}
                    </span>
                  )}
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-purple-500 to-purple-300 transition-all"
                    style={{ height: `${height}%`, minHeight: val > 0 ? "4px" : "0" }}
                  />
                  <span className="text-[10px] text-muted-foreground">{i + 1}月</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters & Table */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="請求書名・メモ・担当者で検索..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="すべて" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="0">支払待ち</SelectItem>
            <SelectItem value="1">支払済</SelectItem>
            <SelectItem value="overdue">期日超過</SelectItem>
          </SelectContent>
        </Select>
        <Select value={managerFilter} onValueChange={(v) => { setManagerFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="全担当者" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全担当者</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1.5" />
          CSV
        </Button>
        <span className="text-sm text-muted-foreground">{total}件</span>
      </div>

      {/* Invoice Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">ID</th>
              <th className="text-left p-3 font-medium">担当者</th>
              <th className="text-left p-3 font-medium">請求書名</th>
              <th className="text-right p-3 font-medium">金額</th>
              <th className="text-center p-3 font-medium">期間</th>
              <th className="text-center p-3 font-medium">支払期日</th>
              <th className="text-center p-3 font-medium">ステータス</th>
              <th className="text-center p-3 font-medium">計上</th>
              <th className="text-left p-3 font-medium">メモ</th>
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
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-muted-foreground">
                  請求書がありません
                </td>
              </tr>
            ) : (
              invoices.map((inv: any) => {
                const isOverdue = inv.status === 0 && inv.endDate && new Date(inv.endDate) < new Date();
                return (
                  <tr key={inv.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-muted-foreground">#{inv.id}</td>
                    <td className="p-3">{inv.managerName || "-"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate max-w-[250px]">{inv.name}</span>
                        {inv.pdfUrl && (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
                          </a>
                        )}
                      </div>
                      {inv.counterparty && (
                        <div className="text-xs text-muted-foreground">{inv.counterparty}</div>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(inv.amount, inv.currency)}
                    </td>
                    <td className="p-3 text-center text-xs text-muted-foreground">
                      {inv.startDate || "-"}
                    </td>
                    <td className="p-3 text-center text-xs">
                      {inv.endDate || "-"}
                    </td>
                    <td className="p-3 text-center">
                      {inv.status === 1 ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer" onClick={() => updateStatusMutation.mutate({ id: inv.id, status: 0 })}>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          支払済
                        </Badge>
                      ) : isOverdue ? (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer" onClick={() => updateStatusMutation.mutate({ id: inv.id, status: 1, depositDate: new Date().toISOString().slice(0, 10) })}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          期日超過
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 cursor-pointer" onClick={() => updateStatusMutation.mutate({ id: inv.id, status: 1, depositDate: new Date().toISOString().slice(0, 10) })}>
                          <Clock className="h-3 w-3 mr-1" />
                          支払待ち
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant="outline"
                        className={`cursor-pointer ${inv.accountingStatus === 1 ? "border-green-500 text-green-700" : "text-muted-foreground"}`}
                        onClick={() => updateAccountingMutation.mutate({ id: inv.id, accountingStatus: inv.accountingStatus === 1 ? 0 : 1 })}
                      >
                        {inv.accountingStatus === 1 ? "計上済" : "未計上"}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[150px] truncate">
                      {inv.memo || ""}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => handleEdit(inv)} className="p-1.5 hover:bg-muted rounded">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {inv.pdfUrl && (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => { if (confirm("削除しますか？")) deleteMutation.mutate({ id: inv.id }); }}
                          className="p-1.5 hover:bg-red-50 rounded text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
            <DialogTitle>{editId ? "請求書を編集" : "請求書を追加"}</DialogTitle>
            <DialogDescription>
              {invoiceType === "receivable" ? "売上請求書" : "支払請求書"}の情報を入力してください
            </DialogDescription>
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
                <label className="text-xs font-medium">通貨</label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                    <SelectItem value="CNY">CNY (¥)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">請求書名 *</label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="例: ヤマト請求書8-1" />
            </div>
            <div>
              <label className="text-xs font-medium">取引先</label>
              <Input value={formData.counterparty} onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })} placeholder="例: 株式会社ABC" />
            </div>
            <div>
              <label className="text-xs font-medium">金額 *</label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">期間（開始）</label>
                <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">支払期日 *</label>
                <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">担当者</label>
              <Input value={formData.managerName} onChange={(e) => setFormData({ ...formData, managerName: e.target.value })} placeholder="例: 山本" />
            </div>
            <div>
              <label className="text-xs font-medium">メモ</label>
              <Input value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} placeholder="手数料660など" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditId(null); resetForm(); }}>
              キャンセル
            </Button>
            <Button
              onClick={editId ? handleUpdate : handleCreate}
              disabled={!formData.name || !formData.endDate || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editId ? "更新" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>請求書アップロード</DialogTitle>
            <DialogDescription>
              PDF・画像ファイルをアップロードすると、AIが自動で請求書情報を抽出します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">PDF・JPG・PNGファイルをアップロード</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                {uploading ? "処理中..." : "ファイルを選択"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
