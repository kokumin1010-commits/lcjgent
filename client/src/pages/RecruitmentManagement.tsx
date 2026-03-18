import { useState, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  ArrowUpDown,
  Building2,
  Mail,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Handshake,
  Clock,
  Sparkles,
  FileSpreadsheet,
  Image,
  Loader2,
  CheckSquare,
  Square,
  MoreHorizontal,
  History,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ===== ステータス定義 =====
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  registered: { label: "已登记", color: "bg-gray-500", icon: Building2 },
  email_sent: { label: "已发送邮件", color: "bg-blue-500", icon: Mail },
  replied: { label: "已收到回复", color: "bg-yellow-500", icon: MessageSquare },
  agreed: { label: "同意", color: "bg-green-500", icon: ThumbsUp },
  cooperating: { label: "合作", color: "bg-emerald-600", icon: Handshake },
  rejected: { label: "拒绝", color: "bg-red-500", icon: ThumbsDown },
};

const STATUS_FLOW: Record<string, string[]> = {
  registered: ["email_sent"],
  email_sent: ["replied"],
  replied: ["agreed", "rejected"],
  agreed: ["cooperating"],
  cooperating: [],
  rejected: [],
};

const ALL_STATUSES = ["registered", "email_sent", "replied", "agreed", "cooperating", "rejected"];

// ===== 日付ヘルパー =====
function formatDate(d: any) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(d: any) {
  if (!d) return "-";
  return new Date(d).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ===== メインコンポーネント =====
export default function RecruitmentManagement() {
  // フィルタ状態
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);

  // ダイアログ状態
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // 選択状態
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [currentBrand, setCurrentBrand] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // フォーム状態
  const [formData, setFormData] = useState({
    brandName: "",
    brandType: "",
    personInCharge: null as number | null,
    contactInfo: "",
    memo: "",
  });

  // AI識別状態
  const [aiText, setAiText] = useState("");
  const [aiImageUrl, setAiImageUrl] = useState("");
  const [aiResults, setAiResults] = useState<any[]>([]);

  // インポート状態
  const [importData, setImportData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tRPCクエリ
  const utils = trpc.useUtils();
  const { data: listData, isLoading } = trpc.recruitment.list.useQuery({
    page,
    pageSize,
    sortBy,
    sortOrder,
    search: search || undefined,
    statuses: statusFilter.length > 0 ? statusFilter : undefined,
    brandTypes: typeFilter.length > 0 ? typeFilter : undefined,
    personInChargeIds: personFilter.length > 0 ? personFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const { data: summary } = trpc.recruitment.statusSummary.useQuery();
  const { data: staffList } = trpc.recruitment.getStaffList.useQuery();
  const { data: brandTypes } = trpc.recruitment.getBrandTypes.useQuery();
  const { data: detailData } = trpc.recruitment.getById.useQuery(
    { id: currentBrand?.id ?? 0 },
    { enabled: !!currentBrand?.id && detailOpen }
  );

  // Mutations
  const createMutation = trpc.recruitment.create.useMutation({
    onSuccess: () => {
      toast.success("品牌登记成功");
      setCreateOpen(false);
      resetForm();
      utils.recruitment.list.invalidate();
      utils.recruitment.statusSummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.recruitment.update.useMutation({
    onSuccess: () => {
      toast.success("更新成功");
      setEditOpen(false);
      utils.recruitment.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const changeStatusMutation = trpc.recruitment.changeStatus.useMutation({
    onSuccess: () => {
      toast.success("状态变更成功");
      setStatusChangeOpen(false);
      setStatusNote("");
      setRejectReason("");
      utils.recruitment.list.invalidate();
      utils.recruitment.statusSummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const batchChangeStatusMutation = trpc.recruitment.batchChangeStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.changed}个品牌状态已变更`);
      setSelectedIds(new Set());
      utils.recruitment.list.invalidate();
      utils.recruitment.statusSummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.recruitment.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.recruitment.list.invalidate();
      utils.recruitment.statusSummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const batchDeleteMutation = trpc.recruitment.batchDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deleted}个品牌已删除`);
      setSelectedIds(new Set());
      utils.recruitment.list.invalidate();
      utils.recruitment.statusSummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const batchCreateMutation = trpc.recruitment.batchCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`成功导入${data.created}个品牌`);
      setImportOpen(false);
      setImportData([]);
      utils.recruitment.list.invalidate();
      utils.recruitment.statusSummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const aiRecognizeMutation = trpc.recruitment.aiRecognize.useMutation({
    onSuccess: (data) => {
      setAiResults(data.brands);
      if (data.brands.length === 0) toast.info("未识别到品牌信息");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: exportData, refetch: refetchExport } = trpc.recruitment.exportData.useQuery(
    {
      search: search || undefined,
      statuses: statusFilter.length > 0 ? statusFilter : undefined,
      brandTypes: typeFilter.length > 0 ? typeFilter : undefined,
      personInChargeIds: personFilter.length > 0 ? personFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    { enabled: false }
  );

  // ===== ヘルパー関数 =====
  const resetForm = () => {
    setFormData({ brandName: "", brandType: "", personInCharge: null, contactInfo: "", memo: "" });
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (!listData?.items) return;
    if (selectedIds.size === listData.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listData.items.map((i: any) => i.id)));
    }
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter([]);
    setTypeFilter([]);
    setPersonFilter([]);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (brand: any) => {
    setFormData({
      brandName: brand.brandName,
      brandType: brand.brandType,
      personInCharge: brand.personInCharge,
      contactInfo: brand.contactInfo || "",
      memo: brand.memo || "",
    });
    setCurrentBrand(brand);
    setEditOpen(true);
  };

  const openStatusChange = (brand: any, status: string) => {
    setCurrentBrand(brand);
    setNewStatus(status);
    setStatusNote("");
    setRejectReason("");
    setStatusChangeOpen(true);
  };

  const openDetail = (brand: any) => {
    setCurrentBrand(brand);
    setDetailOpen(true);
  };

  // Excel エクスポート
  const handleExport = async () => {
    const { data } = await refetchExport();
    if (!data || data.length === 0) {
      toast.info("没有数据可导出");
      return;
    }
    // CSV生成
    const headers = ["ID", "品牌名称", "品牌类型", "招商负责人", "状态", "联系方式", "备注", "拒绝原因", "添加时间", "最后跟进时间"];
    const rows = data.map((r: any) => [
      r.id,
      r.brandName,
      r.brandType,
      r.personInChargeName,
      r.statusLabel,
      r.contactInfo,
      r.memo,
      r.rejectReason,
      formatDate(r.createdAt),
      formatDate(r.lastFollowedAt),
    ]);
    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows.map((r: any) => r.map((c: any) => `"${String(c || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `招商品牌_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("导出成功");
  };

  // Excel/CSV インポート
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        toast.error("文件格式错误或无数据");
        return;
      }
      // ヘッダーをスキップ
      const items = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
        return {
          brandName: cols[0] || "",
          brandType: cols[1] || "",
          contactInfo: cols[2] || "",
          memo: cols[3] || "",
        };
      }).filter(i => i.brandName);

      setImportData(items);
      setImportOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ステータスフィルタトグル
  const toggleStatusFilter = (s: string) => {
    setStatusFilter(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
    setPage(1);
  };

  const totalPages = Math.ceil((listData?.total || 0) / pageSize);
  const items = listData?.items || [];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Handshake className="w-7 h-7 text-red-400" />
            招商管理
          </h1>
          <p className="text-gray-400 text-sm mt-1">品牌招商全流程管理 · 从登记到合作</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles className="w-4 h-4 mr-1 text-yellow-400" /> AI识别
          </Button>
          <label>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-1" /> 导入
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileImport}
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-1" /> 导出
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4 mr-1" /> 新增品牌
          </Button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-7 gap-3 mb-6">
        {[
          { key: "total", label: "全部", color: "from-gray-600/20 to-gray-700/20", border: "border-gray-500/30" },
          { key: "registered", label: "已登记", color: "from-gray-500/20 to-gray-600/20", border: "border-gray-400/30" },
          { key: "email_sent", label: "已发邮件", color: "from-blue-600/20 to-blue-700/20", border: "border-blue-500/30" },
          { key: "replied", label: "已回复", color: "from-yellow-600/20 to-yellow-700/20", border: "border-yellow-500/30" },
          { key: "agreed", label: "同意", color: "from-green-600/20 to-green-700/20", border: "border-green-500/30" },
          { key: "cooperating", label: "合作", color: "from-emerald-600/20 to-emerald-700/20", border: "border-emerald-500/30" },
          { key: "rejected", label: "拒绝", color: "from-red-600/20 to-red-700/20", border: "border-red-500/30" },
        ].map(({ key, label, color, border }) => (
          <div
            key={key}
            className={`bg-gradient-to-br ${color} border ${border} rounded-xl p-3 cursor-pointer hover:opacity-80 transition-opacity ${
              key !== "total" && statusFilter.includes(key) ? "ring-2 ring-white/50" : ""
            }`}
            onClick={() => {
              if (key === "total") clearFilters();
              else toggleStatusFilter(key);
            }}
          >
            <div className="text-2xl font-bold text-white">{(summary as any)?.[key] ?? 0}</div>
            <div className="text-xs text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="搜索品牌名称..."
              className="pl-10 bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            筛选
            {(statusFilter.length + typeFilter.length + personFilter.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)) > 0 && (
              <Badge className="ml-1 bg-red-500 text-white text-xs px-1">
                {statusFilter.length + typeFilter.length + personFilter.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
              </Badge>
            )}
          </Button>
          {(search || statusFilter.length > 0 || typeFilter.length > 0 || personFilter.length > 0 || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="text-gray-400" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" /> 清除
            </Button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-4 gap-3 border-t border-gray-700/50 pt-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">品牌类型</label>
              <Select
                value={typeFilter[0] || "all"}
                onValueChange={v => { setTypeFilter(v === "all" ? [] : [v]); setPage(1); }}
              >
                <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white text-sm">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all" className="text-gray-300">全部类型</SelectItem>
                  {(brandTypes || []).map((t: string) => (
                    <SelectItem key={t} value={t} className="text-gray-300">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">招商负责人</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between bg-gray-700/50 border-gray-600 text-white text-sm hover:bg-gray-700 hover:text-white">
                    {personFilter.length > 0 ? (staffList || []).find((s: any) => s.id === personFilter[0])?.name || "全部负责人" : "全部负责人"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0 bg-gray-800 border-gray-700" align="start">
                  <Command className="bg-gray-800">
                    <CommandInput placeholder="搜索负责人..." className="text-white" />
                    <CommandList>
                      <CommandEmpty className="text-gray-500 text-sm py-3 text-center">未找到</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => { setPersonFilter([]); setPage(1); }}
                          className="text-gray-300 cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", personFilter.length === 0 ? "opacity-100" : "opacity-0")} />
                          全部负责人
                        </CommandItem>
                        {(staffList || []).map((s: any) => (
                          <CommandItem
                            key={s.id}
                            onSelect={() => { setPersonFilter([s.id]); setPage(1); }}
                            className="text-gray-300 cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", personFilter[0] === s.id ? "opacity-100" : "opacity-0")} />
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">开始日期</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="bg-gray-700/50 border-gray-600 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">结束日期</label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="bg-gray-700/50 border-gray-600 text-white text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-300">已选择 <strong className="text-white">{selectedIds.size}</strong> 个品牌</span>
          <div className="flex gap-2">
            {ALL_STATUSES.map(s => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                className="border-gray-600 text-xs"
                onClick={() => {
                  batchChangeStatusMutation.mutate({ ids: Array.from(selectedIds), newStatus: s as any });
                }}
              >
                <Badge className={`${STATUS_CONFIG[s].color} text-white text-[10px] mr-1`}>
                  {STATUS_CONFIG[s].label}
                </Badge>
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-900/30"
              onClick={() => {
                if (confirm(`确定要删除${selectedIds.size}个品牌吗？`)) {
                  batchDeleteMutation.mutate({ ids: Array.from(selectedIds) });
                }
              }}
            >
              <Trash2 className="w-3 h-3 mr-1" /> 批量删除
            </Button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50 bg-gray-900/50">
                <th className="py-3 px-3 text-left w-10">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white">
                    {items.length > 0 && selectedIds.size === items.length
                      ? <CheckSquare className="w-4 h-4" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="py-3 px-3 text-left cursor-pointer hover:text-red-400" onClick={() => handleSort("brand_name")}>
                  <span className="flex items-center gap-1">品牌名称 <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-3 px-3 text-left cursor-pointer hover:text-red-400" onClick={() => handleSort("brand_type")}>
                  <span className="flex items-center gap-1">品牌类型 <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-3 px-3 text-left">招商负责人</th>
                <th className="py-3 px-3 text-center cursor-pointer hover:text-red-400" onClick={() => handleSort("status")}>
                  <span className="flex items-center justify-center gap-1">状态 <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-3 px-3 text-left cursor-pointer hover:text-red-400" onClick={() => handleSort("created_at")}>
                  <span className="flex items-center gap-1">添加时间 <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-3 px-3 text-left cursor-pointer hover:text-red-400" onClick={() => handleSort("last_followed_at")}>
                  <span className="flex items-center gap-1">最后跟进 <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="py-3 px-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-500" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    暂无招商品牌数据
                  </td>
                </tr>
              ) : (
                items.map((brand: any) => {
                  const sc = STATUS_CONFIG[brand.status] || STATUS_CONFIG.registered;
                  const nextStatuses = STATUS_FLOW[brand.status] || [];
                  return (
                    <tr
                      key={brand.id}
                      className="border-b border-gray-700/30 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <button onClick={() => toggleSelect(brand.id)} className="text-gray-400 hover:text-white">
                          {selectedIds.has(brand.id)
                            ? <CheckSquare className="w-4 h-4 text-red-400" />
                            : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          className="text-white font-medium hover:text-red-400 transition-colors text-left"
                          onClick={() => openDetail(brand)}
                        >
                          {brand.brandName}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-gray-400">{brand.brandType || "-"}</td>
                      <td className="py-3 px-3 text-gray-300">{brand.personInChargeName || "-"}</td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={`${sc.color} text-white text-xs`}>
                          {sc.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-gray-400 text-xs">{formatDate(brand.createdAt)}</td>
                      <td className="py-3 px-3 text-gray-400 text-xs">{formatDate(brand.lastFollowedAt)}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {nextStatuses.map((ns: string) => {
                            const nsc = STATUS_CONFIG[ns];
                            return (
                              <Button
                                key={ns}
                                size="sm"
                                className={`${nsc.color} hover:opacity-80 text-white text-xs px-2 py-1 h-7`}
                                onClick={() => openStatusChange(brand, ns)}
                              >
                                {nsc.label}
                              </Button>
                            );
                          })}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-white h-7 w-7 p-0"
                            onClick={() => openEdit(brand)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-400 hover:text-red-400 h-7 w-7 p-0"
                            onClick={() => {
                              if (confirm("确定要删除吗？")) deleteMutation.mutate({ id: brand.id });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700/50">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            共 {listData?.total || 0} 条
            <Select value={pageSize.toString()} onValueChange={v => { setPageSize(parseInt(v)); setPage(1); }}>
              <SelectTrigger className="w-20 bg-gray-700/50 border-gray-600 text-white text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="20" className="text-gray-300">20条</SelectItem>
                <SelectItem value="50" className="text-gray-300">50条</SelectItem>
                <SelectItem value="100" className="text-gray-300">100条</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 h-8"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              上一页
            </Button>
            <span className="text-sm text-gray-400">{page} / {totalPages || 1}</span>
            <Button
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 h-8"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      </div>

      {/* ===== CREATE DIALOG ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-red-400" /> 新增招商品牌
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">品牌名称 *</label>
              <Input
                value={formData.brandName}
                onChange={e => setFormData(p => ({ ...p, brandName: e.target.value }))}
                placeholder="请输入品牌名称"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">品牌类型 *</label>
              <Select
                value={formData.brandType || "none"}
                onValueChange={v => setFormData(p => ({ ...p, brandType: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none" className="text-gray-400">请选择</SelectItem>
                  {(brandTypes || []).map((t: string) => (
                    <SelectItem key={t} value={t} className="text-gray-300">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">招商负责人</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between bg-gray-800 border-gray-700 text-white hover:bg-gray-700 hover:text-white">
                    {formData.personInCharge ? (staffList || []).find((s: any) => s.id === formData.personInCharge)?.name || "选择负责人" : "未指定"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0 bg-gray-800 border-gray-700" align="start">
                  <Command className="bg-gray-800">
                    <CommandInput placeholder="搜索负责人..." className="text-white" />
                    <CommandList>
                      <CommandEmpty className="text-gray-500 text-sm py-3 text-center">未找到</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => setFormData(p => ({ ...p, personInCharge: null }))}
                          className="text-gray-400 cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", !formData.personInCharge ? "opacity-100" : "opacity-0")} />
                          未指定
                        </CommandItem>
                        {(staffList || []).map((s: any) => (
                          <CommandItem
                            key={s.id}
                            onSelect={() => setFormData(p => ({ ...p, personInCharge: s.id }))}
                            className="text-gray-300 cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.personInCharge === s.id ? "opacity-100" : "opacity-0")} />
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">联系方式</label>
              <Input
                value={formData.contactInfo}
                onChange={e => setFormData(p => ({ ...p, contactInfo: e.target.value }))}
                placeholder="联系人 / 电话 / 邮箱"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">备注</label>
              <Textarea
                value={formData.memo}
                onChange={e => setFormData(p => ({ ...p, memo: e.target.value }))}
                placeholder="其他补充信息"
                className="bg-gray-800 border-gray-700 text-white"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={!formData.brandName || createMutation.isPending}
              onClick={() => createMutation.mutate(formData)}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              登记
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== EDIT DIALOG ===== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-400" /> 编辑品牌信息
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">品牌名称 *</label>
              <Input
                value={formData.brandName}
                onChange={e => setFormData(p => ({ ...p, brandName: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">品牌类型</label>
              <Select
                value={formData.brandType || "none"}
                onValueChange={v => setFormData(p => ({ ...p, brandType: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none" className="text-gray-400">请选择</SelectItem>
                  {(brandTypes || []).map((t: string) => (
                    <SelectItem key={t} value={t} className="text-gray-300">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">招商负责人</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between bg-gray-800 border-gray-700 text-white hover:bg-gray-700 hover:text-white">
                    {formData.personInCharge ? (staffList || []).find((s: any) => s.id === formData.personInCharge)?.name || "选择负责人" : "未指定"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0 bg-gray-800 border-gray-700" align="start">
                  <Command className="bg-gray-800">
                    <CommandInput placeholder="搜索负责人..." className="text-white" />
                    <CommandList>
                      <CommandEmpty className="text-gray-500 text-sm py-3 text-center">未找到</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => setFormData(p => ({ ...p, personInCharge: null }))}
                          className="text-gray-400 cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", !formData.personInCharge ? "opacity-100" : "opacity-0")} />
                          未指定
                        </CommandItem>
                        {(staffList || []).map((s: any) => (
                          <CommandItem
                            key={s.id}
                            onSelect={() => setFormData(p => ({ ...p, personInCharge: s.id }))}
                            className="text-gray-300 cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.personInCharge === s.id ? "opacity-100" : "opacity-0")} />
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">联系方式</label>
              <Input
                value={formData.contactInfo}
                onChange={e => setFormData(p => ({ ...p, contactInfo: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">备注</label>
              <Textarea
                value={formData.memo}
                onChange={e => setFormData(p => ({ ...p, memo: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600" onClick={() => setEditOpen(false)}>取消</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!formData.brandName || updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: currentBrand?.id, ...formData })}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== STATUS CHANGE DIALOG ===== */}
      <Dialog open={statusChangeOpen} onOpenChange={setStatusChangeOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>状态变更确认</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className={`${STATUS_CONFIG[currentBrand?.status]?.color || "bg-gray-500"} text-white`}>
                {STATUS_CONFIG[currentBrand?.status]?.label || ""}
              </Badge>
              <span className="text-gray-400">→</span>
              <Badge className={`${STATUS_CONFIG[newStatus]?.color || "bg-gray-500"} text-white`}>
                {STATUS_CONFIG[newStatus]?.label || ""}
              </Badge>
            </div>
            <p className="text-sm text-gray-400">品牌: <strong className="text-white">{currentBrand?.brandName}</strong></p>
            {newStatus === "rejected" && (
              <div>
                <label className="text-sm text-gray-400 mb-1 block">拒绝原因</label>
                <Textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="请输入拒绝原因..."
                  className="bg-gray-800 border-gray-700 text-white"
                  rows={2}
                />
              </div>
            )}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">备注（可选）</label>
              <Textarea
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                placeholder="变更备注..."
                className="bg-gray-800 border-gray-700 text-white"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600" onClick={() => setStatusChangeOpen(false)}>取消</Button>
            <Button
              className={`${STATUS_CONFIG[newStatus]?.color || "bg-gray-500"} hover:opacity-80`}
              disabled={changeStatusMutation.isPending}
              onClick={() => {
                changeStatusMutation.mutate({
                  id: currentBrand?.id,
                  newStatus: newStatus as any,
                  note: statusNote || undefined,
                  rejectReason: newStatus === "rejected" ? rejectReason : undefined,
                });
              }}
            >
              {changeStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              确认变更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-400" />
              {detailData?.brandName || "品牌详情"}
            </DialogTitle>
          </DialogHeader>
          {detailData && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">品牌类型</div>
                  <div className="text-white mt-1">{detailData.brandType || "-"}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">当前状态</div>
                  <Badge className={`${STATUS_CONFIG[detailData.status]?.color || "bg-gray-500"} text-white mt-1`}>
                    {detailData.statusLabel}
                  </Badge>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">招商负责人</div>
                  <div className="text-white mt-1">{detailData.personInChargeName || "-"}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">联系方式</div>
                  <div className="text-white mt-1">{detailData.contactInfo || "-"}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">添加时间</div>
                  <div className="text-white mt-1">{formatDateTime(detailData.createdAt)}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">最后跟进</div>
                  <div className="text-white mt-1">{formatDateTime(detailData.lastFollowedAt)}</div>
                </div>
              </div>
              {detailData.memo && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">备注</div>
                  <div className="text-gray-300 text-sm whitespace-pre-wrap">{detailData.memo}</div>
                </div>
              )}
              {detailData.rejectReason && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                  <div className="text-xs text-red-400 mb-1">拒绝原因</div>
                  <div className="text-red-300 text-sm">{detailData.rejectReason}</div>
                </div>
              )}

              {/* Status History */}
              <div>
                <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2 mb-3">
                  <History className="w-4 h-4" /> 状态变更历史
                </h4>
                <div className="space-y-2">
                  {(detailData.history || []).map((h: any) => (
                    <div key={h.id} className="flex items-center gap-3 bg-gray-800/30 rounded-lg p-2 text-xs">
                      <span className="text-gray-500 w-32 shrink-0">{formatDateTime(h.createdAt)}</span>
                      {h.oldStatusLabel && (
                        <>
                          <Badge className="bg-gray-600 text-white text-[10px]">{h.oldStatusLabel}</Badge>
                          <span className="text-gray-500">→</span>
                        </>
                      )}
                      <Badge className={`${STATUS_CONFIG[h.newStatus]?.color || "bg-gray-500"} text-white text-[10px]`}>
                        {h.newStatusLabel}
                      </Badge>
                      {h.changedByName && <span className="text-gray-500">by {h.changedByName}</span>}
                      {h.note && <span className="text-gray-400 truncate">{h.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== AI RECOGNIZE DIALOG ===== */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" /> AI智能识别
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">上传图片URL或粘贴文本，AI自动提取品牌信息</p>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">图片URL（名片/宣传册/表格截图）</label>
              <Input
                value={aiImageUrl}
                onChange={e => setAiImageUrl(e.target.value)}
                placeholder="https://..."
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">或粘贴文本内容</label>
              <Textarea
                value={aiText}
                onChange={e => setAiText(e.target.value)}
                placeholder="粘贴品牌信息文本..."
                className="bg-gray-800 border-gray-700 text-white"
                rows={4}
              />
            </div>
            <Button
              className="bg-yellow-600 hover:bg-yellow-700 w-full"
              disabled={(!aiImageUrl && !aiText) || aiRecognizeMutation.isPending}
              onClick={() => aiRecognizeMutation.mutate({
                imageUrl: aiImageUrl || undefined,
                text: aiText || undefined,
              })}
            >
              {aiRecognizeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
              开始识别
            </Button>

            {/* AI Results */}
            {aiResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-300">识别结果 ({aiResults.length}个品牌)</h4>
                {aiResults.map((brand: any, idx: number) => (
                  <div key={idx} className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{brand.brandName}</div>
                      <div className="text-xs text-gray-400">
                        {brand.brandType && <span className="mr-2">类型: {brand.brandType}</span>}
                        {brand.contactInfo && <span>联系: {brand.contactInfo}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => {
                        createMutation.mutate({
                          brandName: brand.brandName,
                          brandType: brand.brandType || "",
                          contactInfo: brand.contactInfo || "",
                          memo: brand.memo || "",
                        });
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> 登记
                    </Button>
                  </div>
                ))}
                <Button
                  className="bg-red-600 hover:bg-red-700 w-full"
                  onClick={() => {
                    batchCreateMutation.mutate({
                      items: aiResults.map((b: any) => ({
                        brandName: b.brandName,
                        brandType: b.brandType || "",
                        contactInfo: b.contactInfo || "",
                        memo: b.memo || "",
                      })),
                    });
                    setAiResults([]);
                    setAiOpen(false);
                  }}
                >
                  全部登记 ({aiResults.length}个)
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== IMPORT DIALOG ===== */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-400" /> 批量导入确认
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              CSV格式: 品牌名称,品牌类型,联系方式,备注（第一行为表头）
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {importData.map((item, idx) => (
                <div key={idx} className="bg-gray-800/50 rounded p-2 text-sm flex justify-between">
                  <span className="text-white">{item.brandName}</span>
                  <span className="text-gray-400">{item.brandType}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-300">共 {importData.length} 条数据</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600" onClick={() => setImportOpen(false)}>取消</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={batchCreateMutation.isPending}
              onClick={() => batchCreateMutation.mutate({ items: importData })}
            >
              {batchCreateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              确认导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
