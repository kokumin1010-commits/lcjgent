/**
 * ブランド契約管理タブ
 * 
 * FinanceManagement.tsx から呼び出される。
 * ブランドとの契約一覧（費用・佣金率・契約期間・KG直播条件・达人直播条件・短视频条件）を管理。
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Building2, Plus, Pencil, Trash2, FileText, DollarSign,
  Loader2, CheckCircle, Clock, AlertTriangle, ChevronsUpDown, Check, Search,
  Video, Users, Clapperboard, Calendar, Filter, Target
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(val: number | null | undefined, currency?: string | null): string {
  if (!val) return "未設定";
  if (currency === "CNY") return `¥${val.toLocaleString()}元`;
  return `¥${val.toLocaleString()}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "契約中": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">契約中</Badge>;
    case "完了": return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">完了</Badge>;
    case "保留": return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">保留</Badge>;
    case "終了": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">終了</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

function getServiceTypeBadge(type: string) {
  switch (type) {
    case "期間契約": return <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300">期間契約</Badge>;
    case "単発ライブ契約": return <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-600 dark:text-purple-300">単発ライブ</Badge>;
    case "パッケージ／複合契約": return <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-600 dark:text-orange-300">パッケージ</Badge>;
    case "ライブコマース": return <Badge variant="outline" className="border-pink-300 text-pink-700 dark:border-pink-600 dark:text-pink-300">ライブコマース</Badge>;
    case "広告運用代行": return <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-600 dark:text-green-300">広告運用代行</Badge>;
    default: return <Badge variant="outline">{type}</Badge>;
  }
}

interface ContractFormData {
  brandId: string;
  serviceType: string;
  fixedFee: string;
  commissionRate: string;
  currency: string;
  startDate: string;
  endDate: string;
  contractPeriodLabel: string;
  kgLiveCondition: string;
  liverLiveCondition: string;
  shortVideoCondition: string;
  kgLiveHoursQuota: string;
  liverLiveHoursQuota: string;
  shortVideoCountQuota: string;
  status: string;
  memo: string;
}

const emptyForm: ContractFormData = {
  brandId: "",
  serviceType: "期間契約",
  fixedFee: "",
  commissionRate: "",
  currency: "JPY",
  startDate: "",
  endDate: "",
  contractPeriodLabel: "",
  kgLiveCondition: "",
  liverLiveCondition: "",
  shortVideoCondition: "",
  kgLiveHoursQuota: "",
  liverLiveHoursQuota: "",
  shortVideoCountQuota: "",
  status: "契約中",
  memo: "",
};

export default function BrandContractTab() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ContractFormData>(emptyForm);
  const [brandPopoverOpen, setBrandPopoverOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Queries
  const contractsQuery = trpc.brandContract.listAll.useQuery();
  const brandsQuery = trpc.brand.list.useQuery();

  // Mutations
  const createMutation = trpc.brandContract.create.useMutation({
    onSuccess: () => {
      toast.success("契約を作成しました");
      contractsQuery.refetch();
      setShowDialog(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(`作成失敗: ${err.message}`),
  });

  const updateMutation = trpc.brandContract.update.useMutation({
    onSuccess: () => {
      toast.success("契約を更新しました");
      contractsQuery.refetch();
      setShowDialog(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(`更新失敗: ${err.message}`),
  });

  const deleteMutation = trpc.brandContract.delete.useMutation({
    onSuccess: () => {
      toast.success("契約を削除しました");
      contractsQuery.refetch();
    },
    onError: (err) => toast.error(`削除失敗: ${err.message}`),
  });

  const contracts = contractsQuery.data || [];
  const brands = brandsQuery.data || [];

  // Brand name lookup
  const brandMap = useMemo(() => {
    const map: Record<number, string> = {};
    brands.forEach((b: any) => { map[b.id] = b.name; });
    return map;
  }, [brands]);

  // Filter contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter((c: any) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (searchQuery) {
        const brandName = brandMap[c.brandId] || "";
        const q = searchQuery.toLowerCase();
        if (!brandName.toLowerCase().includes(q) && !c.memo?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [contracts, statusFilter, searchQuery, brandMap]);

  // Summary stats
  const stats = useMemo(() => {
    const active = contracts.filter((c: any) => c.status === "契約中");
    const totalFee = active.reduce((sum: number, c: any) => sum + (c.fixedFee || 0), 0);
    return {
      total: contracts.length,
      active: active.length,
      totalFee,
    };
  }, [contracts]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(contract: any) {
    setEditingId(contract.id);
    setForm({
      brandId: String(contract.brandId),
      serviceType: contract.serviceType || "期間契約",
      fixedFee: contract.fixedFee ? String(contract.fixedFee) : "",
      commissionRate: contract.commissionRate || "",
      currency: contract.currency || "JPY",
      startDate: contract.startDate ? new Date(contract.startDate).toISOString().split("T")[0] : "",
      endDate: contract.endDate ? new Date(contract.endDate).toISOString().split("T")[0] : "",
      contractPeriodLabel: contract.contractPeriodLabel || "",
      kgLiveCondition: contract.kgLiveCondition || "",
      liverLiveCondition: contract.liverLiveCondition || "",
      shortVideoCondition: contract.shortVideoCondition || "",
      kgLiveHoursQuota: contract.kgLiveHoursQuota ? String(contract.kgLiveHoursQuota) : "",
      liverLiveHoursQuota: contract.liverLiveHoursQuota ? String(contract.liverLiveHoursQuota) : "",
      shortVideoCountQuota: contract.shortVideoCountQuota ? String(contract.shortVideoCountQuota) : "",
      status: contract.status || "契約中",
      memo: contract.memo || "",
    });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.brandId) {
      toast.error("ブランドを選択してください");
      return;
    }
    const payload: any = {
      brandId: Number(form.brandId),
      serviceType: form.serviceType as any,
      fixedFee: form.fixedFee ? Number(form.fixedFee) : undefined,
      commissionRate: form.commissionRate || undefined,
      currency: form.currency || undefined,
      startDate: form.startDate ? new Date(form.startDate) : undefined,
      endDate: form.endDate ? new Date(form.endDate) : undefined,
      contractPeriodLabel: form.contractPeriodLabel || undefined,
      kgLiveCondition: form.kgLiveCondition || undefined,
      liverLiveCondition: form.liverLiveCondition || undefined,
      shortVideoCondition: form.shortVideoCondition || undefined,
      kgLiveHoursQuota: form.kgLiveHoursQuota ? Number(form.kgLiveHoursQuota) : undefined,
      liverLiveHoursQuota: form.liverLiveHoursQuota ? Number(form.liverLiveHoursQuota) : undefined,
      shortVideoCountQuota: form.shortVideoCountQuota ? Number(form.shortVideoCountQuota) : undefined,
      status: form.status as any,
      memo: form.memo || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isLoading = contractsQuery.isLoading || brandsQuery.isLoading;
  const isMutating = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            ブランド契約一覧
          </h2>
          <p className="text-sm text-muted-foreground mt-1">ブランドとの契約条件（費用・佣金・直播条件・短视频条件）を管理</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          新規契約
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">総契約数</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">契約中</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
              <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">契約中 総費用</p>
              <p className="text-2xl font-bold">¥{stats.totalFee.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ブランド名で検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="契約中">契約中</SelectItem>
            <SelectItem value="完了">完了</SelectItem>
            <SelectItem value="保留">保留</SelectItem>
            <SelectItem value="終了">終了</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contract Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">ブランド</th>
              <th className="text-left p-3 font-medium">費用</th>
              <th className="text-left p-3 font-medium">佣金</th>
              <th className="text-left p-3 font-medium">契約期間</th>
              <th className="text-left p-3 font-medium">KG老师直播条件</th>
              <th className="text-left p-3 font-medium">达人直播条件</th>
              <th className="text-left p-3 font-medium">短视频条件</th>
              <th className="text-left p-3 font-medium">ステータス</th>
              <th className="text-right p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredContracts.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-muted-foreground">
                  契約データがありません
                </td>
              </tr>
            ) : (
              filteredContracts.map((c: any) => {
                const brandName = brandMap[c.brandId] || `Brand #${c.brandId}`;
                const periodStr = c.contractPeriodLabel
                  ? `${c.contractPeriodLabel}\n${c.startDate ? new Date(c.startDate).toLocaleDateString("ja-JP") : ""} - ${c.endDate ? new Date(c.endDate).toLocaleDateString("ja-JP") : ""}`
                  : `${c.startDate ? new Date(c.startDate).toLocaleDateString("ja-JP") : "未設定"} - ${c.endDate ? new Date(c.endDate).toLocaleDateString("ja-JP") : "未設定"}`;
                return (
                  <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <Link href={`/brands/${c.brandId}`} className="font-medium text-blue-500 hover:text-blue-400 hover:underline cursor-pointer">{brandName}</Link>
                      <div className="text-xs text-muted-foreground mt-0.5">{getServiceTypeBadge(c.serviceType)}</div>
                    </td>
                    <td className="p-3 font-medium">{formatCurrency(c.fixedFee, c.currency)}</td>
                    <td className="p-3">{c.commissionRate || "—"}</td>
                    <td className="p-3 whitespace-pre-line text-xs">
                      {c.contractPeriodLabel && <div className="font-medium">{c.contractPeriodLabel}</div>}
                      <div className="text-muted-foreground">
                        {c.startDate ? new Date(c.startDate).toLocaleDateString("ja-JP") : ""}
                        {c.startDate && c.endDate ? " ~ " : ""}
                        {c.endDate ? new Date(c.endDate).toLocaleDateString("ja-JP") : ""}
                      </div>
                    </td>
                    <td className="p-3 text-xs max-w-[180px]">
                      <div className="whitespace-pre-line">{c.kgLiveCondition || "/"}</div>
                      {c.kgLiveHoursQuota && <Badge variant="outline" className="mt-1 text-red-500 border-red-500/30">{c.kgLiveHoursQuota}h/月</Badge>}
                    </td>
                    <td className="p-3 text-xs max-w-[200px]">
                      <div className="whitespace-pre-line">{c.liverLiveCondition || "/"}</div>
                      {c.liverLiveHoursQuota && <Badge variant="outline" className="mt-1 text-blue-500 border-blue-500/30">{c.liverLiveHoursQuota}h/月</Badge>}
                    </td>
                    <td className="p-3 text-xs max-w-[200px]">
                      <div className="whitespace-pre-line">{c.shortVideoCondition || "/"}</div>
                      {c.shortVideoCountQuota && <Badge variant="outline" className="mt-1 text-orange-500 border-orange-500/30">{c.shortVideoCountQuota}本/月</Badge>}
                    </td>
                    <td className="p-3">{getStatusBadge(c.status)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("この契約を削除しますか？")) {
                              deleteMutation.mutate({ id: c.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "契約を編集" : "新規ブランド契約"}</DialogTitle>
            <DialogDescription>ブランドとの契約条件を入力してください</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Brand Selection */}
            <div className="space-y-2">
              <Label>ブランド *</Label>
              <Popover open={brandPopoverOpen} onOpenChange={setBrandPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {form.brandId ? brandMap[Number(form.brandId)] || `Brand #${form.brandId}` : "ブランドを選択..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="ブランド名で検索..." />
                    <CommandList>
                      <CommandEmpty>見つかりません</CommandEmpty>
                      <CommandGroup>
                        {brands.map((b: any) => (
                          <CommandItem
                            key={b.id}
                            value={b.name}
                            onSelect={() => {
                              setForm(prev => ({ ...prev, brandId: String(b.id) }));
                              setBrandPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", form.brandId === String(b.id) ? "opacity-100" : "opacity-0")} />
                            {b.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Fee & Commission */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>費用</Label>
                <Input
                  type="number"
                  placeholder="1650000"
                  value={form.fixedFee}
                  onChange={e => setForm(prev => ({ ...prev, fixedFee: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>佣金率</Label>
                <Input
                  placeholder="25%"
                  value={form.commissionRate}
                  onChange={e => setForm(prev => ({ ...prev, commissionRate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>通貨</Label>
                <Select value={form.currency} onValueChange={v => setForm(prev => ({ ...prev, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JPY">JPY (円)</SelectItem>
                    <SelectItem value="CNY">CNY (元)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contract Period */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>契約期間ラベル</Label>
                <Input
                  placeholder="半年矩阵、3个月"
                  value={form.contractPeriodLabel}
                  onChange={e => setForm(prev => ({ ...prev, contractPeriodLabel: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>開始日</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>終了日</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Contract Type & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>契約タイプ</Label>
                <Select value={form.serviceType} onValueChange={v => setForm(prev => ({ ...prev, serviceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="期間契約">期間契約</SelectItem>
                    <SelectItem value="単発ライブ契約">単発ライブ契約</SelectItem>
                    <SelectItem value="パッケージ／複合契約">パッケージ／複合契約</SelectItem>
                    <SelectItem value="ライブコマース">ライブコマース</SelectItem>
                    <SelectItem value="広告運用代行">広告運用代行</SelectItem>
                    <SelectItem value="SNS運用代行">SNS運用代行</SelectItem>
                    <SelectItem value="運用代行型（TSP）">運用代行型（TSP）</SelectItem>
                    <SelectItem value="その他">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ステータス</Label>
                <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="契約中">契約中</SelectItem>
                    <SelectItem value="完了">完了</SelectItem>
                    <SelectItem value="保留">保留</SelectItem>
                    <SelectItem value="終了">終了</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conditions with Quota */}
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold text-sm flex items-center gap-2"><Target className="h-4 w-4 text-green-500" />ノルマ設定（月間）</h4>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-red-500" />
                  KG老师直播条件
                </Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Textarea
                      placeholder="例：每月1小时専場直播"
                      value={form.kgLiveCondition}
                      onChange={e => setForm(prev => ({ ...prev, kgLiveCondition: e.target.value }))}
                      rows={1}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      placeholder="時間(h)"
                      value={form.kgLiveHoursQuota}
                      onChange={e => setForm(prev => ({ ...prev, kgLiveHoursQuota: e.target.value }))}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">h/月</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  达人直播条件
                </Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Textarea
                      placeholder="例：旗下KOL：每月合計20時間"
                      value={form.liverLiveCondition}
                      onChange={e => setForm(prev => ({ ...prev, liverLiveCondition: e.target.value }))}
                      rows={1}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      placeholder="時間(h)"
                      value={form.liverLiveHoursQuota}
                      onChange={e => setForm(prev => ({ ...prev, liverLiveHoursQuota: e.target.value }))}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">h/月</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clapperboard className="h-4 w-4 text-orange-500" />
                  短视频条件
                </Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Textarea
                      placeholder="例：30本/月（切り抜き可、アカウント指定）"
                      value={form.shortVideoCondition}
                      onChange={e => setForm(prev => ({ ...prev, shortVideoCondition: e.target.value }))}
                      rows={1}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      placeholder="本数"
                      value={form.shortVideoCountQuota}
                      onChange={e => setForm(prev => ({ ...prev, shortVideoCountQuota: e.target.value }))}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">本/月</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>メモ</Label>
              <Textarea
                placeholder="備考・注意事項"
                value={form.memo}
                onChange={e => setForm(prev => ({ ...prev, memo: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditingId(null); setForm(emptyForm); }}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={isMutating}>
              {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "更新" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
