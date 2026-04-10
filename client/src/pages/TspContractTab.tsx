/**
 * TSP (TikTok Shop Partner) 月額契約管理タブ
 * 
 * FinanceManagement.tsx から呼び出される。
 * 契約一覧・登録・請求書管理・ダッシュボードを提供。
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import {
  Building2, Plus, Send, FileText, DollarSign, Users,
  Loader2, Eye, ExternalLink, CheckCircle, Clock, AlertTriangle,
  XCircle, CreditCard, Landmark, Calendar, ChevronDown, ChevronUp,
  ReceiptText, Trash2, Pencil, RefreshCw, ChevronsUpDown, Check, Search
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(val: number | null | undefined): string {
  return `¥${(val || 0).toLocaleString()}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">契約中</Badge>;
    case "paused": return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">一時停止</Badge>;
    case "cancelled": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">解約</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

function getInvoiceStatusBadge(status: string) {
  switch (status) {
    case "draft": return <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />下書き</Badge>;
    case "sent": return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 gap-1"><Send className="h-3 w-3" />送信済</Badge>;
    case "paid": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 gap-1"><CheckCircle className="h-3 w-3" />支払済</Badge>;
    case "overdue": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 gap-1"><AlertTriangle className="h-3 w-3" />未払い</Badge>;
    case "void": return <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 gap-1"><XCircle className="h-3 w-3" />無効</Badge>;
    case "cancelled": return <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 gap-1"><XCircle className="h-3 w-3" />キャンセル</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

type SubTab = "dashboard" | "contracts" | "invoices";

export default function TspContractTab() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateInvoiceDialog, setShowCreateInvoiceDialog] = useState(false);
  const [showBulkCreateDialog, setShowBulkCreateDialog] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [editingContract, setEditingContract] = useState<any | null>(null);
  const [brandPopoverOpen, setBrandPopoverOpen] = useState(false);
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const [editBrandPopoverOpen, setEditBrandPopoverOpen] = useState(false);
  const [editStaffPopoverOpen, setEditStaffPopoverOpen] = useState(false);
  const [expandedInvoiceContract, setExpandedInvoiceContract] = useState<number | null>(null);
  const [bulkMonth, setBulkMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Form state for new contract
  const [form, setForm] = useState({
    brandId: "" as string, // brand.id as string for Select
    lcjStaffId: "" as string, // staff.id as string for Select
    shopName: "",
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    postalCode: "",
    address: "",
    monthlyAmount: "",
    taxRate: "10",
    contractStartDate: new Date().toISOString().split("T")[0],
    contractEndDate: "",
    billingDay: "1",
    paymentDueDays: "30",
    paymentMethod: "bank_transfer" as "bank_transfer" | "auto_charge",
    description: "",
    tapShopName: "",
    notes: "",
  });

  // Invoice form state
  const [invoiceForm, setInvoiceForm] = useState({
    contractId: 0,
    billingMonth: "",
    description: "",
    notes: "",
  });

  // Queries
  const dashboardQuery = trpc.tsp.getDashboard.useQuery();
  const contractsQuery = trpc.tsp.listContracts.useQuery();
  const invoicesQuery = trpc.tsp.listInvoices.useQuery();
  const brandsQuery = trpc.brand.list.useQuery();
  const staffQuery = trpc.staff.list.useQuery();

  // Brand/Staff lookup maps
  const brandsMap = new Map((brandsQuery.data || []).map((b: any) => [b.id, b]));
  const staffMap = new Map((staffQuery.data || []).map((s: any) => [s.id, s]));

  // Mutations
  const createContractMutation = trpc.tsp.createContract.useMutation({
    onSuccess: (data) => {
      toast.success(`契約を作成しました（ID: ${data.id}）`);
      setShowCreateDialog(false);
      resetForm();
      contractsQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error(`契約作成エラー: ${err.message}`),
  });

  const updateContractMutation = trpc.tsp.updateContract.useMutation({
    onSuccess: () => {
      toast.success("契約を更新しました");
      setEditingContract(null);
      contractsQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error(`更新エラー: ${err.message}`),
  });

  const createInvoiceMutation = trpc.tsp.createInvoice.useMutation({
    onSuccess: (data) => {
      toast.success(`請求書を作成しました（${data.invoiceNumber}）`);
      setShowCreateInvoiceDialog(false);
      invoicesQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error(`請求書作成エラー: ${err.message}`),
  });

  const sendInvoiceMutation = trpc.tsp.sendInvoice.useMutation({
    onSuccess: (data) => {
      toast.success("請求書を送信しました");
      if (data.invoiceUrl) {
        window.open(data.invoiceUrl, "_blank");
      }
      invoicesQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error(`送信エラー: ${err.message}`),
  });

  const voidInvoiceMutation = trpc.tsp.voidInvoice.useMutation({
    onSuccess: () => {
      toast.success("請求書を無効化しました");
      invoicesQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error(`無効化エラー: ${err.message}`),
  });

  const bulkCreateMutation = trpc.tsp.createBulkInvoices.useMutation({
    onSuccess: (data) => {
      toast.success(`一括作成完了: ${data.successCount}件成功 / ${data.failCount}件失敗`);
      setShowBulkCreateDialog(false);
      invoicesQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error(`一括作成エラー: ${err.message}`),
  });

  const bulkSendMutation = trpc.tsp.sendBulkInvoices.useMutation({
    onSuccess: (data) => {
      toast.success(`一括送信完了: ${data.successCount}件成功 / ${data.failCount}件失敗`);
      invoicesQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error(`一括送信エラー: ${err.message}`),
  });

  const linkStripeMutation = trpc.tsp.linkStripe.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || `Stripe連携完了（Customer: ${data.stripeCustomerId}）`);
      contractsQuery.refetch();
      dashboardQuery.refetch();
    },
    onError: (err) => toast.error(`Stripe連携エラー: ${err.message}`),
  });

  function resetForm() {
    setForm({
      brandId: "", lcjStaffId: "",
      shopName: "", companyName: "", contactName: "", contactEmail: "",
      contactPhone: "", postalCode: "", address: "", monthlyAmount: "",
      taxRate: "10", contractStartDate: new Date().toISOString().split("T")[0],
      contractEndDate: "", billingDay: "1", paymentDueDays: "30",
      paymentMethod: "bank_transfer", description: "", tapShopName: "", notes: "",
    });
  }

  function handleCreateContract() {
    if (!form.shopName || !form.contactEmail || !form.monthlyAmount) {
      toast.error("ショップ名、メールアドレス、月額料金は必須です");
      return;
    }
    createContractMutation.mutate({
      brandId: form.brandId ? parseInt(form.brandId) : undefined,
      lcjStaffId: form.lcjStaffId ? parseInt(form.lcjStaffId) : undefined,
      shopName: form.shopName,
      companyName: form.companyName || undefined,
      contactName: form.contactName || undefined,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone || undefined,
      postalCode: form.postalCode || undefined,
      address: form.address || undefined,
      monthlyAmount: parseInt(form.monthlyAmount),
      taxRate: parseInt(form.taxRate),
      contractStartDate: form.contractStartDate,
      contractEndDate: form.contractEndDate || undefined,
      billingDay: parseInt(form.billingDay),
      paymentDueDays: parseInt(form.paymentDueDays),
      paymentMethod: form.paymentMethod,
      description: form.description || undefined,
      tapShopName: form.tapShopName || undefined,
      notes: form.notes || undefined,
    });
  }

  function handleCreateInvoice() {
    if (!invoiceForm.contractId || !invoiceForm.billingMonth) {
      toast.error("契約と請求月は必須です");
      return;
    }
    createInvoiceMutation.mutate({
      contractId: invoiceForm.contractId,
      billingMonth: invoiceForm.billingMonth,
      description: invoiceForm.description || undefined,
      notes: invoiceForm.notes || undefined,
    });
  }

  function getMonthOptions() {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = -1; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
      options.push({ value, label });
    }
    return options;
  }

  const contracts = contractsQuery.data || [];
  const invoices = invoicesQuery.data || [];
  const dashboard = dashboardQuery.data;

  return (
    <div className="space-y-4">
      {/* TSP Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 text-sm px-3 py-1">TSP</Badge>
          <span className="text-sm text-muted-foreground">TikTok Shop Partner 月額契約管理</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { key: "dashboard" as SubTab, label: "概要", icon: DollarSign },
          { key: "contracts" as SubTab, label: "契約一覧", icon: Building2 },
          { key: "invoices" as SubTab, label: "請求書", icon: ReceiptText },
        ].map(sub => (
          <button
            key={sub.key}
            onClick={() => setSubTab(sub.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              subTab === sub.key
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <sub.icon className="h-3.5 w-3.5" />
            {sub.label}
          </button>
        ))}
      </div>

      {/* ========== Dashboard Sub-tab ========== */}
      {subTab === "dashboard" && (
        <div className="space-y-4">
          {dashboardQuery.isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : dashboard ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">アクティブ契約</p>
                        <p className="text-2xl font-bold">{dashboard.activeContractCount}<span className="text-sm font-normal text-muted-foreground ml-1">件</span></p>
                      </div>
                      <Building2 className="h-8 w-8 text-indigo-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">月額合計（税抜）</p>
                        <p className="text-2xl font-bold">{formatCurrency(dashboard.monthlyTotalAmount)}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">今月の請求書</p>
                        <p className="text-2xl font-bold">
                          {dashboard.invoiceStats.reduce((s, i) => s + i.count, 0)}
                          <span className="text-sm font-normal text-muted-foreground ml-1">件</span>
                        </p>
                      </div>
                      <ReceiptText className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">今月入金済</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(dashboard.invoiceStats.find(s => s.status === "paid")?.total || 0)}
                        </p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Invoice Status Breakdown */}
              {dashboard.invoiceStats.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">今月（{dashboard.currentMonth}）請求書ステータス</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {dashboard.invoiceStats.map(s => (
                        <div key={s.status} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                          {getInvoiceStatusBadge(s.status)}
                          <span className="text-sm font-medium">{s.count}件</span>
                          <span className="text-xs text-muted-foreground">({formatCurrency(s.total)})</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">クイックアクション</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => { setSubTab("contracts"); setShowCreateDialog(true); }}>
                      <Plus className="h-4 w-4 mr-1" />新規契約
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowBulkCreateDialog(true)}>
                      <ReceiptText className="h-4 w-4 mr-1" />一括請求書作成
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => bulkSendMutation.mutate({ billingMonth: bulkMonth })} disabled={bulkSendMutation.isPending}>
                      {bulkSendMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                      今月の請求書一括送信
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">データの読み込みに失敗しました</p>
          )}
        </div>
      )}

      {/* ========== Contracts Sub-tab ========== */}
      {subTab === "contracts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{contracts.length}件の契約</p>
            <Button size="sm" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" />新規契約
            </Button>
          </div>

          {contractsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : contracts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>契約がありません</p>
                <Button size="sm" className="mt-3" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                  <Plus className="h-4 w-4 mr-1" />最初の契約を作成
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {contracts.map((c: any) => (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{c.shopName}</h3>
                          {getStatusBadge(c.status)}
                          {c.paymentMethod === "auto_charge" ? (
                            <Badge variant="outline" className="gap-1 text-xs"><CreditCard className="h-3 w-3" />自動引落</Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-xs"><Landmark className="h-3 w-3" />銀行振込</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {c.companyName && <span>{c.companyName}</span>}
                          <span>{c.contactEmail}</span>
                          {c.contactPhone && <span>{c.contactPhone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-bold text-indigo-600">{formatCurrency(c.monthlyAmount)}</p>
                          <p className="text-xs text-muted-foreground">月額（税抜）</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => {
                            setInvoiceForm({
                              contractId: c.id,
                              billingMonth: bulkMonth,
                              description: "",
                              notes: "",
                            });
                            setShowCreateInvoiceDialog(true);
                          }}>
                            <ReceiptText className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingContract(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {/* Contract details row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground border-t pt-2">
                      <span>契約開始: {new Date(c.contractStartDate).toLocaleDateString("ja-JP")}</span>
                      {c.contractEndDate && <span>契約終了: {new Date(c.contractEndDate).toLocaleDateString("ja-JP")}</span>}
                      <span>請求日: 毎月{c.billingDay}日</span>
                      <span>支払期限: {c.paymentDueDays}日後</span>
                      <span>消費税: {c.taxRate}%</span>
                      {c.tapShopName && <span>TAPショップ: {c.tapShopName}</span>}
                      {c.brandId && brandsMap.get(c.brandId) && <span className="text-indigo-600">ブランド: {(brandsMap.get(c.brandId) as any)?.name}</span>}
                      {c.lcjStaffId && staffMap.get(c.lcjStaffId) && <span className="text-blue-600">LCJ担当: {(staffMap.get(c.lcjStaffId) as any)?.name}</span>}
                      {c.stripeCustomerId ? (
                        <span className="text-green-600">Stripe連携済</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 text-xs px-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            linkStripeMutation.mutate({ contractId: c.id });
                          }}
                          disabled={linkStripeMutation.isPending}
                        >
                          {linkStripeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CreditCard className="h-3 w-3 mr-1" />}
                          Stripe連携
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== Invoices Sub-tab ========== */}
      {subTab === "invoices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{invoices.length}件の請求書</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowBulkCreateDialog(true)}>
                <ReceiptText className="h-4 w-4 mr-1" />一括作成
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSendMutation.mutate({ billingMonth: bulkMonth })} disabled={bulkSendMutation.isPending}>
                {bulkSendMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                一括送信
              </Button>
            </div>
          </div>

          {invoicesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : invoices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ReceiptText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>請求書がありません</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-3 font-medium">請求書番号</th>
                    <th className="text-left py-3 px-3 font-medium">ショップ</th>
                    <th className="text-left py-3 px-3 font-medium">請求月</th>
                    <th className="text-right py-3 px-3 font-medium">税抜</th>
                    <th className="text-right py-3 px-3 font-medium">税込</th>
                    <th className="text-center py-3 px-3 font-medium">ステータス</th>
                    <th className="text-center py-3 px-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((row: any) => {
                    const inv = row.invoice;
                    const contract = row.contract;
                    return (
                      <tr key={inv.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-3 font-mono text-xs">{inv.invoiceNumber || "-"}</td>
                        <td className="py-3 px-3">{contract?.shopName || "-"}</td>
                        <td className="py-3 px-3">{inv.billingMonth}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(inv.amount)}</td>
                        <td className="py-3 px-3 text-right font-semibold">{formatCurrency(inv.totalAmount)}</td>
                        <td className="py-3 px-3 text-center">{getInvoiceStatusBadge(inv.status)}</td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {inv.status === "draft" && (
                              <Button size="sm" variant="ghost" onClick={() => sendInvoiceMutation.mutate({ invoiceId: inv.id })} disabled={sendInvoiceMutation.isPending}>
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {inv.stripeInvoiceUrl && (
                              <Button size="sm" variant="ghost" onClick={() => window.open(inv.stripeInvoiceUrl, "_blank")}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(inv.status === "draft" || inv.status === "sent") && (
                              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => {
                                if (confirm("この請求書を無効化しますか？")) {
                                  voidInvoiceMutation.mutate({ invoiceId: inv.id });
                                }
                              }}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========== Create Contract Dialog ========== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />新規TSP契約</DialogTitle>
            <DialogDescription>TikTok Shop Partner の月額契約を作成します。Stripe Customer/Product が自動作成されます。</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ブランド選択（検索付き） */}
            <div>
              <Label>ブランド（紐付け）</Label>
              <Popover open={brandPopoverOpen} onOpenChange={setBrandPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={brandPopoverOpen} className="w-full justify-between font-normal">
                    {form.brandId
                      ? (brandsMap.get(parseInt(form.brandId)) as any)?.name || "選択済み"
                      : "ブランドを検索・選択（任意）"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="ブランド名で検索..." />
                    <CommandList>
                      <CommandEmpty>見つかりません</CommandEmpty>
                      <CommandGroup>
                        {form.brandId && (
                          <CommandItem
                            value="__clear__"
                            onSelect={() => {
                              setForm(f => ({ ...f, brandId: "" }));
                              setBrandPopoverOpen(false);
                            }}
                          >
                            <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                            選択解除
                          </CommandItem>
                        )}
                        {(brandsQuery.data || []).filter((b: any) => !b.deletedAt).map((b: any) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.name} ${b.companyName || ""}`}
                            onSelect={() => {
                              const v = String(b.id);
                              setForm(f => ({
                                ...f,
                                brandId: v,
                                shopName: f.shopName || b.name || "",
                                companyName: f.companyName || b.companyName || "",
                                contactEmail: f.contactEmail || b.email || "",
                                contactPhone: f.contactPhone || b.phoneNumber || "",
                                contactName: f.contactName || b.contactPerson || "",
                              }));
                              setBrandPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", form.brandId === String(b.id) ? "opacity-100" : "opacity-0")} />
                            {b.name}{b.companyName ? ` (${b.companyName})` : ""}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {/* LCJ担当者選択（検索付き） */}
            <div>
              <Label>LCJ担当者</Label>
              <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={staffPopoverOpen} className="w-full justify-between font-normal">
                    {form.lcjStaffId
                      ? (staffMap.get(parseInt(form.lcjStaffId)) as any)?.name || "選択済み"
                      : "担当者を検索・選択（任意）"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="担当者名で検索..." />
                    <CommandList>
                      <CommandEmpty>見つかりません</CommandEmpty>
                      <CommandGroup>
                        {form.lcjStaffId && (
                          <CommandItem
                            value="__clear_staff__"
                            onSelect={() => {
                              setForm(f => ({ ...f, lcjStaffId: "" }));
                              setStaffPopoverOpen(false);
                            }}
                          >
                            <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                            選択解除
                          </CommandItem>
                        )}
                        {(staffQuery.data || []).filter((s: any) => s.isActive === "active").map((s: any) => (
                          <CommandItem
                            key={s.id}
                            value={`${s.name} ${s.department || ""}`}
                            onSelect={() => {
                              setForm(f => ({ ...f, lcjStaffId: String(s.id) }));
                              setStaffPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", form.lcjStaffId === String(s.id) ? "opacity-100" : "opacity-0")} />
                            {s.name}{s.department ? ` (${s.department})` : ""}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>ショップ名 <span className="text-red-500">*</span></Label>
              <Input value={form.shopName} onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))} placeholder="例: ABC Beauty Shop" />
            </div>
            <div>
              <Label>会社名</Label>
              <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="例: 株式会社ABC" />
            </div>
            <div>
              <Label>担当者名</Label>
              <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="例: 山田太郎" />
            </div>
            <div>
              <Label>メールアドレス <span className="text-red-500">*</span></Label>
              <Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="例: info@abc.co.jp" />
            </div>
            <div>
              <Label>電話番号</Label>
              <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="例: 03-1234-5678" />
            </div>
            <div>
              <Label>郵便番号</Label>
              <Input value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="例: 150-0001" />
            </div>
            <div className="sm:col-span-2">
              <Label>住所</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="例: 東京都渋谷区..." />
            </div>
            <div>
              <Label>月額料金（税抜・円） <span className="text-red-500">*</span></Label>
              <Input type="number" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} placeholder="例: 50000" />
            </div>
            <div>
              <Label>消費税率（%）</Label>
              <Input type="number" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} />
            </div>
            <div>
              <Label>契約開始日</Label>
              <Input type="date" value={form.contractStartDate} onChange={e => setForm(f => ({ ...f, contractStartDate: e.target.value }))} />
            </div>
            <div>
              <Label>契約終了日（任意）</Label>
              <Input type="date" value={form.contractEndDate} onChange={e => setForm(f => ({ ...f, contractEndDate: e.target.value }))} />
            </div>
            <div>
              <Label>毎月の請求日</Label>
              <Select value={form.billingDay} onValueChange={v => setForm(f => ({ ...f, billingDay: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}日</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>支払期限（日数）</Label>
              <Select value={form.paymentDueDays} onValueChange={v => setForm(f => ({ ...f, paymentDueDays: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15日後</SelectItem>
                  <SelectItem value="30">30日後（月末）</SelectItem>
                  <SelectItem value="45">45日後</SelectItem>
                  <SelectItem value="60">60日後</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>支払方法</Label>
              <Select value={form.paymentMethod} onValueChange={(v: "bank_transfer" | "auto_charge") => setForm(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">銀行振込</SelectItem>
                  <SelectItem value="auto_charge">クレジットカード自動引落</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>TAPショップ名（紐付け）</Label>
              <Input value={form.tapShopName} onChange={e => setForm(f => ({ ...f, tapShopName: e.target.value }))} placeholder="TAP上のショップ名" />
            </div>
            <div className="sm:col-span-2">
              <Label>契約内容（請求書明細に使用）</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="例: TikTok Shop Partner 月額運用代行" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Label>メモ（内部用）</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="内部メモ" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>キャンセル</Button>
            <Button onClick={handleCreateContract} disabled={createContractMutation.isPending}>
              {createContractMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              契約作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Edit Contract Dialog ========== */}
      <Dialog open={!!editingContract} onOpenChange={(open) => !open && setEditingContract(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" />契約編集</DialogTitle>
          </DialogHeader>
          {editingContract && (
            <div className="space-y-4">
              <div>
                <Label>ブランド（紐付け）</Label>
                <Popover open={editBrandPopoverOpen} onOpenChange={setEditBrandPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={editBrandPopoverOpen} className="w-full justify-between font-normal">
                      {editingContract.brandId
                        ? (brandsMap.get(editingContract.brandId) as any)?.name || "選択済み"
                        : "ブランドを検索・選択"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ブランド名で検索..." />
                      <CommandList>
                        <CommandEmpty>見つかりません</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__clear_edit_brand__"
                            onSelect={() => {
                              setEditingContract((c: any) => ({ ...c, brandId: null }));
                              setEditBrandPopoverOpen(false);
                            }}
                          >
                            <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                            なし（解除）
                          </CommandItem>
                          {(brandsQuery.data || []).filter((b: any) => !b.deletedAt).map((b: any) => (
                            <CommandItem
                              key={b.id}
                              value={`${b.name} ${b.companyName || ""}`}
                              onSelect={() => {
                                setEditingContract((c: any) => ({ ...c, brandId: b.id }));
                                setEditBrandPopoverOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editingContract.brandId === b.id ? "opacity-100" : "opacity-0")} />
                              {b.name}{b.companyName ? ` (${b.companyName})` : ""}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>LCJ担当者</Label>
                <Popover open={editStaffPopoverOpen} onOpenChange={setEditStaffPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={editStaffPopoverOpen} className="w-full justify-between font-normal">
                      {editingContract.lcjStaffId
                        ? (staffMap.get(editingContract.lcjStaffId) as any)?.name || "選択済み"
                        : "担当者を検索・選択"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="担当者名で検索..." />
                      <CommandList>
                        <CommandEmpty>見つかりません</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__clear_edit_staff__"
                            onSelect={() => {
                              setEditingContract((c: any) => ({ ...c, lcjStaffId: null }));
                              setEditStaffPopoverOpen(false);
                            }}
                          >
                            <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                            なし（解除）
                          </CommandItem>
                          {(staffQuery.data || []).filter((s: any) => s.isActive === "active").map((s: any) => (
                            <CommandItem
                              key={s.id}
                              value={`${s.name} ${s.department || ""}`}
                              onSelect={() => {
                                setEditingContract((c: any) => ({ ...c, lcjStaffId: s.id }));
                                setEditStaffPopoverOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editingContract.lcjStaffId === s.id ? "opacity-100" : "opacity-0")} />
                              {s.name}{s.department ? ` (${s.department})` : ""}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>ショップ名</Label>
                <Input value={editingContract.shopName} onChange={e => setEditingContract((c: any) => ({ ...c, shopName: e.target.value }))} />
              </div>
              <div>
                <Label>月額料金（税抜・円）</Label>
                <Input type="number" value={editingContract.monthlyAmount} onChange={e => setEditingContract((c: any) => ({ ...c, monthlyAmount: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>ステータス</Label>
                <Select value={editingContract.status} onValueChange={v => setEditingContract((c: any) => ({ ...c, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">契約中</SelectItem>
                    <SelectItem value="paused">一時停止</SelectItem>
                    <SelectItem value="cancelled">解約</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>メモ</Label>
                <Textarea value={editingContract.notes || ""} onChange={e => setEditingContract((c: any) => ({ ...c, notes: e.target.value }))} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContract(null)}>キャンセル</Button>
            <Button onClick={() => {
              if (editingContract) {
                updateContractMutation.mutate({
                  id: editingContract.id,
                  brandId: editingContract.brandId,
                  lcjStaffId: editingContract.lcjStaffId,
                  shopName: editingContract.shopName,
                  monthlyAmount: editingContract.monthlyAmount,
                  status: editingContract.status,
                  notes: editingContract.notes,
                });
              }
            }} disabled={updateContractMutation.isPending}>
              {updateContractMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Create Invoice Dialog ========== */}
      <Dialog open={showCreateInvoiceDialog} onOpenChange={setShowCreateInvoiceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" />請求書作成</DialogTitle>
            <DialogDescription>Stripe Invoice が自動作成されます。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>契約</Label>
              <Select value={String(invoiceForm.contractId)} onValueChange={v => setInvoiceForm(f => ({ ...f, contractId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="契約を選択" /></SelectTrigger>
                <SelectContent>
                  {contracts.filter((c: any) => c.status === "active").map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.shopName} ({formatCurrency(c.monthlyAmount)}/月)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>請求月</Label>
              <Select value={invoiceForm.billingMonth} onValueChange={v => setInvoiceForm(f => ({ ...f, billingMonth: v }))}>
                <SelectTrigger><SelectValue placeholder="月を選択" /></SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>明細（任意）</Label>
              <Textarea value={invoiceForm.description} onChange={e => setInvoiceForm(f => ({ ...f, description: e.target.value }))} placeholder="請求書に記載する明細内容" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInvoiceDialog(false)}>キャンセル</Button>
            <Button onClick={handleCreateInvoice} disabled={createInvoiceMutation.isPending}>
              {createInvoiceMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ReceiptText className="h-4 w-4 mr-2" />}
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Bulk Create Dialog ========== */}
      <Dialog open={showBulkCreateDialog} onOpenChange={setShowBulkCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" />一括請求書作成</DialogTitle>
            <DialogDescription>全アクティブ契約に対して指定月の請求書を一括作成します。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>請求月</Label>
              <Select value={bulkMonth} onValueChange={setBulkMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              アクティブ契約: <span className="font-bold">{contracts.filter((c: any) => c.status === "active").length}件</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkCreateDialog(false)}>キャンセル</Button>
            <Button onClick={() => bulkCreateMutation.mutate({ billingMonth: bulkMonth })} disabled={bulkCreateMutation.isPending}>
              {bulkCreateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ReceiptText className="h-4 w-4 mr-2" />}
              一括作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
