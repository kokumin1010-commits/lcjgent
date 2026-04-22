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
  ImagePlus,
  FileText,
  AlertCircle,
  Send,
  Inbox,
  ChevronLeft,
  ChevronRight,
  MailOpen,
  ExternalLink,
  Globe,
  Phone,
  Tag,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Bell,
  MessageCircle,
  Target,
  Star,
  Zap,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lazy, Suspense } from "react";
const RecruitmentEmail = lazy(() => import("./RecruitmentEmail"));
import { ExtendedFormFields } from "./RecruitmentExtendedFields";
import { FollowRemindersPanel } from "./RecruitmentReminders";
import { PerformanceStatsPanel } from "./RecruitmentStats";

// ===== 新ラベル定義 =====
const BRAND_STAGE_LABELS: Record<string, string> = { startup: "初创期", growth: "成长期", mature: "成熟期", famous: "知名品牌" };
const INTENT_LEVEL_LABELS: Record<string, string> = { high: "高意向", normal: "普通", dormant: "休眠" };
const CLIENT_VALUE_LABELS: Record<string, string> = { high: "高价值", medium: "中价值", low: "低价值" };
const FOLLOW_DIFFICULTY_LABELS: Record<string, string> = { easy: "容易", medium: "普通", hard: "困难" };
const COMM_TYPE_LABELS: Record<string, string> = { email: "邮件", phone: "电话", wechat: "微信", meeting: "会议", other: "其他" };

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

// ===== SearchableStaffSelect コンポーネント =====
function SearchableStaffSelect({ value, onChange, staffList }: { value: number | null; onChange: (v: number | null) => void; staffList: any[] }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = useMemo(() => {
    if (!staffList) return [];
    if (!searchTerm) return staffList;
    return staffList.filter((s: any) => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [staffList, searchTerm]);

  const selectedName = staffList?.find((s: any) => s.id === value)?.name || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
          {value ? selectedName : "未指定"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-gray-800 border-gray-700" align="start">
        <Command className="bg-gray-800">
          <CommandInput placeholder="搜索负责人..." value={searchTerm} onValueChange={setSearchTerm} className="text-white" />
          <CommandList className="max-h-48">
            <CommandEmpty className="text-gray-400 text-sm py-2 text-center">无匹配结果</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => { onChange(null); setOpen(false); setSearchTerm(""); }} className="text-gray-300 hover:bg-gray-700">
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                未指定
              </CommandItem>
              {filtered.map((s: any) => (
                <CommandItem key={s.id} onSelect={() => { onChange(s.id); setOpen(false); setSearchTerm(""); }} className="text-gray-300 hover:bg-gray-700">
                  <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ===== 详情内跟进记录コンポーネント =====
function DetailFollowRecords({ brandId }: { brandId: number }) {
  const { data: records, isLoading } = trpc.recruitment.listFollowRecords.useQuery(
    { recruitmentBrandId: brandId },
    { enabled: !!brandId }
  );
  if (isLoading) return <div className="text-center py-4 text-gray-500"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />加载中...</div>;
  if (!records || records.length === 0) return <div className="text-center py-8 text-gray-500">暂无跟进记录</div>;
  return (
    <div className="space-y-3">
      {records.map((r: any) => (
        <div key={r.id} className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-gray-700 text-gray-300 text-[10px]">{COMM_TYPE_LABELS[r.communicationType] || r.communicationType}</Badge>
              {r.staffName && <span className="text-xs text-gray-400">{r.staffName}</span>}
              {r.durationMinutes && <span className="text-xs text-gray-500">{r.durationMinutes}分钟</span>}
            </div>
            <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          {r.summary && <div className="text-sm text-gray-300 mb-1">{r.summary}</div>}
          {r.keyPoints && (
            <div className="text-xs text-yellow-400/80 bg-yellow-900/10 rounded p-1.5 mb-1">
              <Star className="w-3 h-3 inline mr-1" />要点: {r.keyPoints}
            </div>
          )}
          {r.nextAction && (
            <div className="text-xs text-blue-400/80">
              <CalendarDays className="w-3 h-3 inline mr-1" />下次: {r.nextAction}
              {r.nextFollowDate && <span className="ml-2 text-gray-500">({new Date(r.nextFollowDate).toLocaleDateString("zh-CN")})</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
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
    brandStage: null as string | null,
    annualRevenue: null as string | null,
    cooperationHistory: null as string | null,
    sourceChannel: null as string | null,
    wechat: null as string | null,
    websiteUrl: null as string | null,
    intentLevel: null as string | null,
    clientValue: null as string | null,
    followDifficulty: null as string | null,
    customTags: null as string | null,
    nextFollowDate: null as string | null,
    nextFollowAction: null as string | null,
  });

  // 跟進記録ダイアログ状態
  const [followRecordOpen, setFollowRecordOpen] = useState(false);
  const [followRecordBrand, setFollowRecordBrand] = useState<any>(null);
  const [followForm, setFollowForm] = useState({
    communicationType: "other" as string,
    durationMinutes: null as number | null,
    summary: "",
    keyPoints: "",
    nextAction: "",
    nextFollowDate: null as string | null,
  });

  // AI識別状態
  const [aiText, setAiText] = useState("");
  const [aiImageUrls, setAiImageUrls] = useState<string[]>([]);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [aiUploading, setAiUploading] = useState(false);
  const [aiSelectedResults, setAiSelectedResults] = useState<Set<number>>(new Set());
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [aiDragOver, setAiDragOver] = useState(false);

  // タブ状態
  const [activeView, setActiveView] = useState<"list" | "email" | "reminders" | "stats">("list");

  // ブランドメールダイアログ状態
  const [brandEmailOpen, setBrandEmailOpen] = useState(false);
  const [brandEmailTarget, setBrandEmailTarget] = useState<{brandName: string; emailAddress: string} | null>(null);
  const [brandEmailTab, setBrandEmailTab] = useState<"history" | "compose">("history");
  const [brandEmailPage, setBrandEmailPage] = useState(1);
  const [brandComposeTo, setBrandComposeTo] = useState("");
  const [brandComposeCc, setBrandComposeCc] = useState("");
  const [brandComposeSubject, setBrandComposeSubject] = useState("");
  const [brandComposeBody, setBrandComposeBody] = useState("");
  const [brandViewUid, setBrandViewUid] = useState<{uid: number; folder: string} | null>(null);

  // インポート状態
  const [importData, setImportData] = useState<any[]>([]);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "mapping">("upload");
  const [importFileName, setImportFileName] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDragOver, setImportDragOver] = useState(false);

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

  // ===== ブランドメール用クエリ =====
  const { data: brandEmailData, isLoading: brandEmailLoading } = trpc.email.listByAddress.useQuery(
    { emailAddress: brandEmailTarget?.emailAddress ?? "", page: brandEmailPage, pageSize: 20 },
    { enabled: !!brandEmailTarget?.emailAddress && brandEmailOpen && brandEmailTab === "history", refetchOnWindowFocus: false }
  );

  const { data: brandMessageData, isLoading: brandMessageLoading } = trpc.email.getMessage.useQuery(
    { uid: brandViewUid?.uid ?? 0, folder: brandViewUid?.folder ?? "INBOX" },
    { enabled: !!brandViewUid, refetchOnWindowFocus: false }
  );

  const brandSendMutation = trpc.email.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("メール送信完了");
      setBrandComposeSubject("");
      setBrandComposeBody("");
      setBrandComposeCc("");
      setBrandEmailTab("history");
      utils.email.listByAddress.invalidate();
    },
    onError: (err) => toast.error("送信失敗: " + err.message),
  });

  // Follow Record Mutation
  const createFollowRecordMutation = trpc.recruitment.createFollowRecord.useMutation({
    onSuccess: () => {
      toast.success("跟进记录已保存");
      setFollowRecordOpen(false);
      utils.recruitment.list.invalidate();
      utils.recruitment.listFollowRecords.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

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
    onSuccess: (data: any) => {
      const msgs: string[] = [];
      if (data.created > 0) msgs.push(`新增 ${data.created} 个`);
      if (data.updated > 0) msgs.push(`更新 ${data.updated} 个`);
      toast.success(`导入完成: ${msgs.join(", ")}`);
      setImportOpen(false);
      setImportData([]);
      setImportStep("upload");
      utils.recruitment.list.invalidate();
      utils.recruitment.statusSummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const aiRecognizeMutation = trpc.recruitment.aiRecognize.useMutation({
    onSuccess: (data) => {
      setAiResults(data.brands);
      setAiSelectedResults(new Set(data.brands.map((_: any, i: number) => i)));
      if (data.brands.length === 0) toast.info("未识别到品牌信息");
      else toast.success(`识别到 ${data.brands.length} 个品牌`);
    },
    onError: (err) => toast.error("AI识别失败: " + err.message),
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
    setFormData({
      brandName: "", brandType: "", personInCharge: null, contactInfo: "", memo: "",
      brandStage: null, annualRevenue: null, cooperationHistory: null, sourceChannel: null,
      wechat: null, websiteUrl: null, intentLevel: null, clientValue: null,
      followDifficulty: null, customTags: null, nextFollowDate: null, nextFollowAction: null,
    });
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
      brandStage: brand.brandStage || null,
      annualRevenue: brand.annualRevenue || null,
      cooperationHistory: brand.cooperationHistory || null,
      sourceChannel: brand.sourceChannel || null,
      wechat: brand.wechat || null,
      websiteUrl: brand.websiteUrl || null,
      intentLevel: brand.intentLevel || null,
      clientValue: brand.clientValue || null,
      followDifficulty: brand.followDifficulty || null,
      customTags: brand.customTags || null,
      nextFollowDate: brand.nextFollowDate ? new Date(brand.nextFollowDate).toISOString().split('T')[0] : null,
      nextFollowAction: brand.nextFollowAction || null,
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

  // ===== ブランドメール機能 =====
  const extractEmail = (text: string): string | null => {
    if (!text) return null;
    const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  };

  const openBrandEmail = (brand: any) => {
    const email = extractEmail(brand.contactInfo || "");
    if (!email) {
      toast.error("该品牌的联系方式中未找到邮箱地址");
      return;
    }
    setBrandEmailTarget({ brandName: brand.brandName, emailAddress: email });
    setBrandEmailTab("history");
    setBrandEmailPage(1);
    setBrandComposeTo(email);
    setBrandComposeCc("");
    setBrandComposeSubject("");
    setBrandComposeBody("");
    setBrandViewUid(null);
    setBrandEmailOpen(true);
  };

  const handleBrandSend = () => {
    if (!brandComposeTo.trim()) {
      toast.error("宛先を入力してください");
      return;
    }
    if (!brandComposeSubject.trim()) {
      toast.error("件名を入力してください");
      return;
    }
    const toList = brandComposeTo.split(/[,;，；\s]+/).filter(Boolean).map(s => s.trim());
    const ccList = brandComposeCc ? brandComposeCc.split(/[,;，；\s]+/).filter(Boolean).map(s => s.trim()) : undefined;
    brandSendMutation.mutate({
      to: toList,
      cc: ccList,
      subject: brandComposeSubject,
      text: brandComposeBody,
      html: brandComposeBody.replace(/\n/g, "<br>"),
    });
  };

  const formatBrandEmailDate = (d: string | null) => {
    if (!d) return "-";
    const date = new Date(d);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  };

  // ===== Excel エクスポート =====
  const handleExport = async () => {
    const { data } = await refetchExport();
    if (!data || data.length === 0) {
      toast.info("没有数据可导出");
      return;
    }
    const headers = ["ID", "品牌名称", "品牌类型", "招商负责人", "状态", "联系方式", "备注", "拒绝原因", "添加时间", "最后跟进时间"];
    const rows = data.map((r: any) => [
      r.id, r.brandName, r.brandType, r.personInChargeName, r.statusLabel,
      r.contactInfo, r.memo, r.rejectReason, formatDate(r.createdAt), formatDate(r.lastFollowedAt),
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

  // ===== ファイルインポート（Excel/CSV対応） =====
  const processImportFile = async (file: File) => {
    setImportFileName(file.name);
    setImportErrors([]);
    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      if (ext === "xlsx" || ext === "xls") {
        // Excel: xlsxライブラリで読む
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];

        if (jsonData.length === 0) {
          toast.error("Excel文件无数据");
          return;
        }

        // 自動フィールドマッピング
        const items = jsonData.map((row) => {
          const keys = Object.keys(row);
          return {
            brandName: findFieldValue(row, keys, ["品牌名称", "品牌名", "品牌", "brand", "name", "brandname"]),
            brandType: findFieldValue(row, keys, ["品牌类型", "类型", "分类", "type", "category", "brandtype"]),
            contactInfo: findFieldValue(row, keys, ["联系方式", "联系人", "电话", "邮箱", "contact", "email", "phone"]),
            memo: findFieldValue(row, keys, ["备注", "说明", "描述", "memo", "note", "remark"]),
            status: findFieldValue(row, keys, ["状态", "进度", "status", "state", "品牌状态"]),
          };
        }).filter(i => i.brandName);

        if (items.length === 0) {
          setImportErrors(["未找到品牌名称列。请确保Excel中有\"品牌名称\"或\"品牌\"列。"]);
          toast.error("未找到品牌名称列");
          return;
        }

        setImportData(items);
        setImportStep("preview");
        setImportOpen(true);
      } else if (ext === "csv") {
        // CSV: テキスト読み込み
        const text = await file.text();
        const lines = text.split("\n").filter(l => l.trim());
        if (lines.length < 2) {
          toast.error("CSV文件无数据");
          return;
        }
        const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
        const items = lines.slice(1).map(line => {
          const cols = parseCSVLine(line);
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cols[i] || ""; });
          return {
            brandName: findFieldValue(row, headers, ["品牌名称", "品牌名", "品牌", "brand", "name"]),
            brandType: findFieldValue(row, headers, ["品牌类型", "类型", "分类", "type", "category"]),
            contactInfo: findFieldValue(row, headers, ["联系方式", "联系人", "电话", "邮箱", "contact"]),
            memo: findFieldValue(row, headers, ["备注", "说明", "描述", "memo", "note"]),
            status: findFieldValue(row, headers, ["状态", "进度", "status", "state", "品牌状态"]),
          };
        }).filter(i => i.brandName);

        setImportData(items);
        setImportStep("preview");
        setImportOpen(true);
      } else {
        toast.error("不支持的文件格式。请使用 Excel (.xlsx/.xls) 或 CSV (.csv) 文件");
      }
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error("文件读取失败: " + (err.message || "未知错误"));
    }
  };

  // CSVの行をパース（引用符内のカンマに対応）
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  // フィールド名の自動マッピング
  const findFieldValue = (row: Record<string, any>, keys: string[], candidates: string[]): string => {
    for (const candidate of candidates) {
      for (const key of keys) {
        if (key.toLowerCase().includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(key.toLowerCase())) {
          const val = row[key];
          return val !== undefined && val !== null ? String(val).trim() : "";
        }
      }
    }
    return "";
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImportFile(file);
    e.target.value = "";
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImportFile(file);
  };

  // ===== AI画像アップロード =====
  const handleAiImageUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setAiUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const resp = await fetch("/api/recruitment-image-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "上传失败" }));
        throw new Error(err.error || "上传失败");
      }
      const data = await resp.json();
      const newUrls = data.files.map((f: any) => f.url);
      setAiImageUrls(prev => [...prev, ...newUrls]);
      toast.success(`成功上传 ${newUrls.length} 张图片`);
    } catch (err: any) {
      toast.error("图片上传失败: " + (err.message || "未知错误"));
    } finally {
      setAiUploading(false);
    }
  };

  const handleAiDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAiDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleAiImageUpload(files);
  };

  const removeAiImage = (idx: number) => {
    setAiImageUrls(prev => prev.filter((_, i) => i !== idx));
  };

  // インポートデータの編集
  const updateImportItem = (idx: number, field: string, value: string) => {
    setImportData(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeImportItem = (idx: number) => {
    setImportData(prev => prev.filter((_, i) => i !== idx));
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
            onClick={() => {
              setAiText("");
              setAiImageUrls([]);
              setAiResults([]);
              setAiSelectedResults(new Set());
              setAiOpen(true);
            }}
          >
            <Sparkles className="w-4 h-4 mr-1 text-yellow-400" /> AI识别
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => {
              setImportData([]);
              setImportStep("upload");
              setImportFileName("");
              setImportErrors([]);
              setImportOpen(true);
            }}
          >
            <Upload className="w-4 h-4 mr-1" /> 导入
          </Button>
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

      {/* View Toggle: リスト / メール / 跟進提醒 / 業績統計 */}
      <div className="flex gap-1 mb-4 bg-gray-900/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveView("list")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === "list" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          <Handshake className="w-4 h-4" /> 品牌管理
        </button>
        <button
          onClick={() => setActiveView("email")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === "email" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          <Mail className="w-4 h-4" /> メール
        </button>
        <button
          onClick={() => setActiveView("reminders")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === "reminders" ? "bg-yellow-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          <Bell className="w-4 h-4" /> 跟进提醒
        </button>
        <button
          onClick={() => setActiveView("stats")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === "stats" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> 业绩统计
        </button>
      </div>

      {/* メールビュー */}
      {activeView === "email" ? (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /><span className="ml-2 text-gray-400">読み込み中...</span></div>}>
          <RecruitmentEmail />
        </Suspense>
      ) : activeView === "reminders" ? (
        <FollowRemindersPanel />
      ) : activeView === "stats" ? (
        <PerformanceStatsPanel />
      ) : (
      <>
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
            <div className="text-2xl font-bold text-red-400">{(summary as any)?.[key] ?? 0}</div>
            <div className="text-xs text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-gray-900/50 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="搜索品牌名称、联系方式..."
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          {/* ブランドタイプフィルタ */}
          <div className="w-40">
            <Select
              value={typeFilter.length === 1 ? typeFilter[0] : "_all"}
              onValueChange={(v) => {
                if (v === "_all") {
                  setTypeFilter([]);
                } else {
                  setTypeFilter([v]);
                }
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="品牌类型" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="_all" className="text-gray-300 hover:bg-gray-700">全部类型</SelectItem>
                {(brandTypes || []).map((bt: string) => (
                  <SelectItem key={bt} value={bt} className="text-gray-300 hover:bg-gray-700">{bt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <SearchableStaffSelect
              value={personFilter[0] ?? null}
              onChange={(v) => { setPersonFilter(v ? [v] : []); setPage(1); }}
              staffList={staffList || []}
            />
          </div>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="w-40 bg-gray-800 border-gray-700 text-white" placeholder="开始日期" />
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="w-40 bg-gray-800 border-gray-700 text-white" placeholder="结束日期" />
          {(search || statusFilter.length > 0 || typeFilter.length > 0 || personFilter.length > 0 || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4 mr-1" /> 清除
            </Button>
          )}
        </div>

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
            <span className="text-sm text-gray-300">已选 {selectedIds.size} 项</span>
            <div className="flex gap-1 ml-2">
              {ALL_STATUSES.map(s => (
                <Button key={s} size="sm" variant="outline"
                  className={`text-xs border-gray-600 ${STATUS_CONFIG[s]?.color} text-white`}
                  onClick={() => batchChangeStatusMutation.mutate({ ids: [...selectedIds], newStatus: s as any })}
                >
                  {STATUS_CONFIG[s]?.label}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="text-xs border-red-600 text-red-400 ml-auto"
              onClick={() => { if (confirm("确定删除选中项？")) batchDeleteMutation.mutate({ ids: [...selectedIds] }); }}
            >
              <Trash2 className="w-3 h-3 mr-1" /> 删除
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-900/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-gray-400 text-xs">
              <th className="p-3 w-10">
                <button onClick={toggleSelectAll}>
                  {selectedIds.size === items.length && items.length > 0
                    ? <CheckSquare className="w-4 h-4 text-red-400" />
                    : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="p-3 text-left cursor-pointer hover:text-white" onClick={() => handleSort("brand_name")}>
                品牌名称 <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="p-3 text-left">品牌类型</th>
              <th className="p-3 text-left">招商负责人</th>
              <th className="p-3 text-left cursor-pointer hover:text-white" onClick={() => handleSort("status")}>
                状态 <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="p-3 text-left">联系方式</th>
              <th className="p-3 text-left cursor-pointer hover:text-white" onClick={() => handleSort("created_at")}>
                添加时间 <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="p-3 text-left cursor-pointer hover:text-white" onClick={() => handleSort("last_followed_at")}>
                最后跟进 <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="p-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> 加载中...
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-500">暂无数据</td></tr>
            ) : items.map((item: any) => (
              <tr key={item.id} className="border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="p-3">
                  <button onClick={() => toggleSelect(item.id)}>
                    {selectedIds.has(item.id)
                      ? <CheckSquare className="w-4 h-4 text-red-400" />
                      : <Square className="w-4 h-4 text-gray-600" />}
                  </button>
                </td>
                <td className="p-3">
                  <button className="text-white hover:text-red-400 font-medium text-left" onClick={() => openDetail(item)}>
                    {item.brandName}
                  </button>
                </td>
                <td className="p-3 text-gray-400">{item.brandType || "-"}</td>
                <td className="p-3 text-gray-400">{item.personInChargeName || "-"}</td>
                <td className="p-3">
                  <Badge className={`${STATUS_CONFIG[item.status]?.color || "bg-gray-500"} text-white text-xs`}>
                    {item.statusLabel}
                  </Badge>
                </td>
                <td className="p-3 text-gray-400 text-xs max-w-[150px] truncate">{item.contactInfo || "-"}</td>
                <td className="p-3 text-gray-500 text-xs">{formatDate(item.createdAt)}</td>
                <td className="p-3 text-gray-500 text-xs">{formatDate(item.lastFollowedAt)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    {/* Next status buttons */}
                    {(STATUS_FLOW[item.status] || []).map((ns: string) => (
                      <Button key={ns} size="sm" variant="ghost"
                        className={`text-xs px-2 py-1 h-7 ${STATUS_CONFIG[ns]?.color} text-white`}
                        onClick={() => openStatusChange(item, ns)}
                      >
                        {STATUS_CONFIG[ns]?.label}
                      </Button>
                    ))}
                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-green-400 h-7 w-7 p-0"
                      onClick={() => { setFollowRecordBrand(item); setFollowRecordOpen(true); setFollowForm({ communicationType: "other", durationMinutes: null, summary: "", keyPoints: "", nextAction: "", nextFollowDate: null }); }}
                      title="跟进记录">
                      <MessageCircle className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-blue-400 h-7 w-7 p-0"
                      onClick={() => openBrandEmail(item)}
                      title="邮件">
                      <Mail className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white h-7 w-7 p-0"
                      onClick={() => openEdit(item)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-400 h-7 w-7 p-0"
                      onClick={() => { if (confirm("确定删除？")) deleteMutation.mutate({ id: item.id }); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-800/50">
            <span className="text-sm text-gray-500">共 {listData?.total || 0} 条</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1}
                className="border-gray-700 text-gray-300" onClick={() => setPage(p => p - 1)}>
                上一页
              </Button>
              <span className="text-sm text-gray-400 px-3 py-1">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages}
                className="border-gray-700 text-gray-300" onClick={() => setPage(p => p + 1)}>
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ===== CREATE DIALOG ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-red-400" /> 新增品牌
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">品牌名称 *</label>
              <Input value={formData.brandName} onChange={e => setFormData(p => ({ ...p, brandName: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white" placeholder="输入品牌名称" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">品牌类型</label>
              <Select value={formData.brandType} onValueChange={v => setFormData(p => ({ ...p, brandType: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {(brandTypes || []).map((t: string) => (
                    <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">招商负责人</label>
              <SearchableStaffSelect
                value={formData.personInCharge}
                onChange={(v) => setFormData(p => ({ ...p, personInCharge: v }))}
                staffList={staffList || []}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">联系方式</label>
              <Input value={formData.contactInfo} onChange={e => setFormData(p => ({ ...p, contactInfo: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white" placeholder="联系人/电话/邮箱" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">备注</label>
              <Textarea value={formData.memo} onChange={e => setFormData(p => ({ ...p, memo: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white" rows={3} />
            </div>
            <ExtendedFormFields formData={formData} onChange={(updates) => setFormData(p => ({ ...p, ...updates }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button className="bg-red-600 hover:bg-red-700" disabled={!formData.brandName || createMutation.isPending}
              onClick={() => createMutation.mutate(formData)}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              登记
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== EDIT DIALOG ===== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-400" /> 编辑品牌
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">品牌名称 *</label>
              <Input value={formData.brandName} onChange={e => setFormData(p => ({ ...p, brandName: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">品牌类型</label>
              <Select value={formData.brandType} onValueChange={v => setFormData(p => ({ ...p, brandType: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {(brandTypes || []).map((t: string) => (
                    <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">招商负责人</label>
              <SearchableStaffSelect
                value={formData.personInCharge}
                onChange={(v) => setFormData(p => ({ ...p, personInCharge: v }))}
                staffList={staffList || []}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">联系方式</label>
              <Input value={formData.contactInfo} onChange={e => setFormData(p => ({ ...p, contactInfo: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">备注</label>
              <Textarea value={formData.memo} onChange={e => setFormData(p => ({ ...p, memo: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white" rows={3} />
            </div>
            <ExtendedFormFields formData={formData} onChange={(updates) => setFormData(p => ({ ...p, ...updates }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600" onClick={() => setEditOpen(false)}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!formData.brandName || updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: currentBrand?.id, ...formData })}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
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
              <Badge className={`${STATUS_CONFIG[currentBrand?.status]?.color} text-white`}>
                {STATUS_CONFIG[currentBrand?.status]?.label}
              </Badge>
              <span className="text-gray-500">→</span>
              <Badge className={`${STATUS_CONFIG[newStatus]?.color} text-white`}>
                {STATUS_CONFIG[newStatus]?.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-400">品牌: {currentBrand?.brandName}</p>
            {newStatus === "rejected" && (
              <div>
                <label className="text-sm text-gray-400 mb-1 block">拒绝原因</label>
                <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white" rows={2} />
              </div>
            )}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">备注</label>
              <Input value={statusNote} onChange={e => setStatusNote(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white" placeholder="可选备注" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600" onClick={() => setStatusChangeOpen(false)}>取消</Button>
            <Button
              className={`${STATUS_CONFIG[newStatus]?.color} text-white`}
              disabled={changeStatusMutation.isPending}
              onClick={() => {
                changeStatusMutation.mutate({
                  id: currentBrand?.id,
                  newStatus: newStatus as any,
                  note: statusNote || undefined,
                  rejectReason: rejectReason || undefined,
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
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-400" />
              {detailData?.brandName || "品牌详情"}
              {detailData?.intentLevel && (
                <Badge className={`text-[10px] ml-2 ${detailData.intentLevel === 'high' ? 'bg-green-600' : detailData.intentLevel === 'dormant' ? 'bg-gray-600' : 'bg-blue-600'} text-white`}>
                  {INTENT_LEVEL_LABELS[detailData.intentLevel] || detailData.intentLevel}
                </Badge>
              )}
              {detailData?.clientValue && (
                <Badge className={`text-[10px] ${detailData.clientValue === 'high' ? 'bg-yellow-600' : detailData.clientValue === 'low' ? 'bg-gray-600' : 'bg-orange-600'} text-white`}>
                  {CLIENT_VALUE_LABELS[detailData.clientValue] || detailData.clientValue}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailData && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="bg-gray-800 border-gray-700 mb-4">
                <TabsTrigger value="basic" className="data-[state=active]:bg-gray-700">基本信息</TabsTrigger>
                <TabsTrigger value="extended" className="data-[state=active]:bg-gray-700">扩展信息</TabsTrigger>
                <TabsTrigger value="follow" className="data-[state=active]:bg-gray-700">跟进记录</TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-gray-700">状态历史</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
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
              </TabsContent>

              <TabsContent value="extended" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">品牌阶段</div>
                    <div className="text-white mt-1">{detailData.brandStage ? BRAND_STAGE_LABELS[detailData.brandStage] || detailData.brandStage : "-"}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">年收入规模</div>
                    <div className="text-white mt-1">{detailData.annualRevenue || "-"}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">合作历史</div>
                    <div className="text-white mt-1">{detailData.cooperationHistory || "-"}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">来源渠道</div>
                    <div className="text-white mt-1">{detailData.sourceChannel || "-"}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">微信</div>
                    <div className="text-white mt-1">{detailData.wechat || "-"}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">官网</div>
                    <div className="text-white mt-1">
                      {detailData.websiteUrl ? (
                        <a href={detailData.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                          {detailData.websiteUrl.replace(/^https?:\/\//, '').substring(0, 30)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : "-"}
                    </div>
                  </div>
                </div>
                {/* 智能标签 */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {detailData.intentLevel && (
                    <Badge className={`${detailData.intentLevel === 'high' ? 'bg-green-600' : detailData.intentLevel === 'dormant' ? 'bg-gray-600' : 'bg-blue-600'} text-white`}>
                      意向: {INTENT_LEVEL_LABELS[detailData.intentLevel]}
                    </Badge>
                  )}
                  {detailData.clientValue && (
                    <Badge className={`${detailData.clientValue === 'high' ? 'bg-yellow-600' : detailData.clientValue === 'low' ? 'bg-gray-600' : 'bg-orange-600'} text-white`}>
                      价值: {CLIENT_VALUE_LABELS[detailData.clientValue]}
                    </Badge>
                  )}
                  {detailData.followDifficulty && (
                    <Badge className={`${detailData.followDifficulty === 'easy' ? 'bg-green-600' : detailData.followDifficulty === 'hard' ? 'bg-red-600' : 'bg-yellow-600'} text-white`}>
                      难度: {FOLLOW_DIFFICULTY_LABELS[detailData.followDifficulty]}
                    </Badge>
                  )}
                  {detailData.customTags && detailData.customTags.split(',').map((tag: string, i: number) => (
                    <Badge key={i} className="bg-purple-600/50 text-purple-200 border border-purple-500/30">
                      <Tag className="w-3 h-3 mr-1" />{tag.trim()}
                    </Badge>
                  ))}
                </div>
                {/* 下次跟进予定 */}
                {(detailData.nextFollowDate || detailData.nextFollowAction) && (
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                    <div className="text-xs text-blue-400 mb-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> 下次跟进计划</div>
                    <div className="text-sm text-white">
                      {detailData.nextFollowDate && <span className="mr-3">{formatDate(detailData.nextFollowDate)}</span>}
                      {detailData.nextFollowAction && <span className="text-gray-300">{detailData.nextFollowAction}</span>}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="follow" className="space-y-4">
                <DetailFollowRecords brandId={detailData.id} />
              </TabsContent>

              <TabsContent value="history" className="space-y-2">
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
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== AI RECOGNIZE DIALOG (IMPROVED) ===== */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" /> AI智能识别
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">上传图片或粘贴文本，AI自动提取品牌信息。支持名片、宣传册、表格截图等。</p>

            {/* Image Upload Area */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block flex items-center gap-1">
                <ImagePlus className="w-4 h-4" /> 图片上传（支持拖拽，多张）
              </label>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                  aiDragOver ? "border-yellow-400 bg-yellow-400/10" : "border-gray-700 hover:border-gray-500"
                }`}
                onDragOver={(e) => { e.preventDefault(); setAiDragOver(true); }}
                onDragLeave={() => setAiDragOver(false)}
                onDrop={handleAiDrop}
                onClick={() => aiFileInputRef.current?.click()}
              >
                {aiUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                    <span className="text-sm text-gray-400">上传中...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <ImagePlus className="w-8 h-8 text-gray-500" />
                    <span className="text-sm text-gray-400">点击或拖拽图片到此处</span>
                    <span className="text-xs text-gray-600">支持 JPG、PNG、WebP 格式，最多20张</span>
                  </div>
                )}
              </div>
              <input
                ref={aiFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleAiImageUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Uploaded Images Preview */}
            {aiImageUrls.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">已上传 {aiImageUrls.length} 张图片</label>
                <div className="grid grid-cols-4 gap-2">
                  {aiImageUrls.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt={`img-${idx}`} className="w-full h-24 object-cover rounded-lg border border-gray-700" />
                      <button
                        className="absolute top-1 right-1 bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeAiImage(idx)}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text Input */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                <FileText className="w-4 h-4" /> 或粘贴文本内容
              </label>
              <Textarea
                value={aiText}
                onChange={e => setAiText(e.target.value)}
                placeholder="粘贴品牌信息文本（名片内容、邮件、表格数据等）..."
                className="bg-gray-800 border-gray-700 text-white"
                rows={4}
              />
            </div>

            {/* Recognize Button */}
            <Button
              className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 w-full"
              disabled={(aiImageUrls.length === 0 && !aiText) || aiRecognizeMutation.isPending}
              onClick={() => aiRecognizeMutation.mutate({
                imageUrls: aiImageUrls.length > 0 ? aiImageUrls : undefined,
                text: aiText || undefined,
              })}
            >
              {aiRecognizeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  AI识别中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  开始AI识别
                </>
              )}
            </Button>

            {/* AI Results */}
            {aiResults.length > 0 && (
              <div className="space-y-3 border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-300">识别结果 ({aiResults.length}个品牌)</h4>
                  <Button size="sm" variant="ghost" className="text-xs text-gray-400"
                    onClick={() => {
                      if (aiSelectedResults.size === aiResults.length) setAiSelectedResults(new Set());
                      else setAiSelectedResults(new Set(aiResults.map((_: any, i: number) => i)));
                    }}
                  >
                    {aiSelectedResults.size === aiResults.length ? "取消全选" : "全选"}
                  </Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {aiResults.map((brand: any, idx: number) => (
                    <div key={idx} className={`rounded-lg p-3 flex items-start gap-3 transition-colors ${
                      aiSelectedResults.has(idx) ? "bg-gray-800/80 border border-yellow-500/30" : "bg-gray-800/30 border border-gray-700"
                    }`}>
                      <button onClick={() => {
                        const next = new Set(aiSelectedResults);
                        if (next.has(idx)) next.delete(idx); else next.add(idx);
                        setAiSelectedResults(next);
                      }}>
                        {aiSelectedResults.has(idx)
                          ? <CheckSquare className="w-4 h-4 text-yellow-400 mt-1" />
                          : <Square className="w-4 h-4 text-gray-600 mt-1" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium">{brand.brandName}</div>
                        <div className="text-xs text-gray-400 mt-1 space-x-3">
                          {brand.brandType && <span>类型: {brand.brandType}</span>}
                          {brand.contactInfo && <span>联系: {brand.contactInfo}</span>}
                          {brand.memo && <span>备注: {brand.memo}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  className="bg-red-600 hover:bg-red-700 w-full"
                  disabled={aiSelectedResults.size === 0 || batchCreateMutation.isPending}
                  onClick={() => {
                    const selected = aiResults.filter((_: any, i: number) => aiSelectedResults.has(i));
                    batchCreateMutation.mutate({
                      items: selected.map((b: any) => ({
                        brandName: b.brandName,
                        brandType: b.brandType || "",
                        contactInfo: b.contactInfo || "",
                        memo: b.memo || "",
                      })),
                    });
                    setAiResults([]);
                    setAiSelectedResults(new Set());
                    setAiOpen(false);
                  }}
                >
                  {batchCreateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  登记选中 ({aiSelectedResults.size}个)
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== IMPORT DIALOG (IMPROVED) ===== */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportStep("upload"); setImportData([]); } }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-400" />
              {importStep === "upload" ? "文档导入" : "数据预览与确认"}
            </DialogTitle>
          </DialogHeader>

          {importStep === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">支持 Excel (.xlsx/.xls) 和 CSV (.csv) 格式。系统会自动识别列名并映射字段。</p>

              {/* Drag & Drop Upload Area */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  importDragOver ? "border-green-400 bg-green-400/10" : "border-gray-700 hover:border-gray-500"
                }`}
                onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                onDragLeave={() => setImportDragOver(false)}
                onDrop={handleImportDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-10 h-10 text-gray-500" />
                  <div>
                    <span className="text-sm text-gray-300">点击或拖拽文件到此处</span>
                    <div className="text-xs text-gray-600 mt-1">支持 .xlsx, .xls, .csv 格式</div>
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileImport}
              />

              {/* Format Guide */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-gray-300 mb-2">字段映射说明</h4>
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex gap-2">
                    <span className="text-green-400 w-20 shrink-0">品牌名称*</span>
                    <span>自动匹配: 品牌名称、品牌名、品牌、brand、name</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-400 w-20 shrink-0">品牌类型</span>
                    <span>自动匹配: 品牌类型、类型、分类、type、category</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-yellow-400 w-20 shrink-0">联系方式</span>
                    <span>自动匹配: 联系方式、联系人、电话、邮箱、contact</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-orange-400 w-20 shrink-0">状态</span>
                    <span>自动匹配: 状态、进度、status、state（自动识别并更新）</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-purple-400 w-20 shrink-0">备注</span>
                    <span>自动匹配: 备注、说明、描述、memo、note</span>
                  </div>
                  <div className="mt-2 p-2 bg-gray-700/30 rounded text-gray-300">
                    <strong>重复品牌处理:</strong> 导入时如果品牌名称已存在，将优先覆盖为最新状态。
                  </div>
                </div>
              </div>

              {importErrors.length > 0 && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
                    <AlertCircle className="w-4 h-4" /> 导入错误
                  </div>
                  {importErrors.map((err, i) => (
                    <div key={i} className="text-xs text-red-300">{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {importStep === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="text-gray-400" onClick={() => setImportStep("upload")}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> 返回
                  </Button>
                  <span className="text-sm text-gray-400">文件: {importFileName}</span>
                </div>
                <Badge className="bg-green-600 text-white">共 {importData.length} 条数据</Badge>
              </div>

              {/* Data Preview Table */}
              <div className="rounded-lg border border-gray-700 overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800 sticky top-0">
                      <tr>
                        <th className="p-2 text-left text-gray-400 w-8">#</th>
                        <th className="p-2 text-left text-gray-400">品牌名称</th>
                        <th className="p-2 text-left text-gray-400">品牌类型</th>
                        <th className="p-2 text-left text-gray-400">状态</th>
                        <th className="p-2 text-left text-gray-400">联系方式</th>
                        <th className="p-2 text-left text-gray-400">备注</th>
                        <th className="p-2 text-center text-gray-400 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {importData.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-800 hover:bg-gray-800/30">
                          <td className="p-2 text-gray-500">{idx + 1}</td>
                          <td className="p-2">
                            <Input
                              value={item.brandName}
                              onChange={e => updateImportItem(idx, "brandName", e.target.value)}
                              className="bg-transparent border-gray-700 text-white text-xs h-7 px-1"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={item.brandType}
                              onChange={e => updateImportItem(idx, "brandType", e.target.value)}
                              className="bg-transparent border-gray-700 text-white text-xs h-7 px-1"
                            />
                          </td>
                          <td className="p-2">
                            <Select
                              value={item.status || "_auto"}
                              onValueChange={(v) => updateImportItem(idx, "status", v === "_auto" ? "" : v)}
                            >
                              <SelectTrigger className="bg-transparent border-gray-700 text-white text-xs h-7 px-1">
                                <SelectValue placeholder="自动" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700">
                                <SelectItem value="_auto" className="text-gray-300 text-xs">自动识别</SelectItem>
                                <SelectItem value="registered" className="text-gray-300 text-xs">已登记</SelectItem>
                                <SelectItem value="email_sent" className="text-gray-300 text-xs">已发邮件</SelectItem>
                                <SelectItem value="replied" className="text-gray-300 text-xs">已回复</SelectItem>
                                <SelectItem value="agreed" className="text-gray-300 text-xs">同意</SelectItem>
                                <SelectItem value="cooperating" className="text-gray-300 text-xs">合作</SelectItem>
                                <SelectItem value="rejected" className="text-gray-300 text-xs">拒绝</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Input
                              value={item.contactInfo}
                              onChange={e => updateImportItem(idx, "contactInfo", e.target.value)}
                              className="bg-transparent border-gray-700 text-white text-xs h-7 px-1"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={item.memo}
                              onChange={e => updateImportItem(idx, "memo", e.target.value)}
                              className="bg-transparent border-gray-700 text-white text-xs h-7 px-1"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeImportItem(idx)} className="text-gray-500 hover:text-red-400">
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {importStep === "preview" && (
            <DialogFooter>
              <Button variant="outline" className="border-gray-600" onClick={() => setImportOpen(false)}>取消</Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={importData.length === 0 || batchCreateMutation.isPending}
                onClick={() => batchCreateMutation.mutate({ items: importData })}
              >
                {batchCreateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                确认导入 ({importData.length}条)
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== ブランドメールダイアログ ===== */}
      <Dialog open={brandEmailOpen} onOpenChange={(open) => { setBrandEmailOpen(open); if (!open) { setBrandViewUid(null); } }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              {brandEmailTarget?.brandName || "品牌"} - 邮件
              <span className="text-xs text-gray-400 font-normal ml-2">{brandEmailTarget?.emailAddress}</span>
            </DialogTitle>
          </DialogHeader>

          {/* タブ切り替え */}
          <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 w-fit">
            <button
              onClick={() => { setBrandEmailTab("history"); setBrandViewUid(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                brandEmailTab === "history" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" /> 邮件履歴
            </button>
            <button
              onClick={() => { setBrandEmailTab("compose"); setBrandViewUid(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                brandEmailTab === "compose" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              <Send className="w-3.5 h-3.5" /> 新規送信
            </button>
          </div>

          {/* メール履歴タブ */}
          {brandEmailTab === "history" && (
            <div className="space-y-3">
              {brandViewUid ? (
                /* メール本文表示 */
                <div className="space-y-3">
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => setBrandViewUid(null)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> 一覧に戻る
                  </Button>
                  {brandMessageLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-400 text-sm">読み込み中...</span>
                    </div>
                  ) : brandMessageData ? (
                    <div className="space-y-3">
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <h3 className="text-white font-medium mb-2">{brandMessageData.subject}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                          <span>From: {brandMessageData.from.name ? `${brandMessageData.from.name} <${brandMessageData.from.address}>` : brandMessageData.from.address}</span>
                          <span>To: {brandMessageData.to.map((t: any) => t.address).join(", ")}</span>
                          <span>{brandMessageData.date ? new Date(brandMessageData.date).toLocaleString("ja-JP") : "-"}</span>
                        </div>
                      </div>
                      <div className="bg-gray-800/30 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap max-h-[40vh] overflow-y-auto">
                        {brandMessageData.html ? (
                          <div dangerouslySetInnerHTML={{ __html: brandMessageData.html }} />
                        ) : (
                          brandMessageData.text || "(本文なし)"
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">メールが見つかりません</div>
                  )}
                </div>
              ) : (
                /* メール一覧 */
                <>
                  {brandEmailLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-400 text-sm">メール検索中...</span>
                    </div>
                  ) : !brandEmailData?.emails?.length ? (
                    <div className="text-center py-8 text-gray-500">
                      <MailOpen className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                      <p>このアドレスとのメール履歴はありません</p>
                      <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700" onClick={() => setBrandEmailTab("compose")}>
                        <Send className="w-3.5 h-3.5 mr-1" /> 新規メールを作成
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-gray-500 mb-1">全 {brandEmailData.total} 件</div>
                      <div className="space-y-1">
                        {brandEmailData.emails.map((email: any, idx: number) => (
                          <button
                            key={`${email.folder}-${email.uid}-${idx}`}
                            className="w-full text-left bg-gray-800/40 hover:bg-gray-800/70 rounded-lg p-3 transition-colors"
                            onClick={() => setBrandViewUid({ uid: email.uid, folder: email.folder })}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={`text-[10px] px-1.5 py-0 ${
                                email.direction === "sent" ? "bg-green-600/80 text-white" : "bg-blue-600/80 text-white"
                              }`}>
                                {email.direction === "sent" ? "送信" : "受信"}
                              </Badge>
                              <span className="text-xs text-gray-400 truncate flex-1">
                                {email.direction === "sent"
                                  ? `To: ${email.to?.[0]?.address || "-"}`
                                  : `From: ${email.from?.name || email.from?.address || "-"}`
                                }
                              </span>
                              <span className="text-xs text-gray-500 shrink-0">{formatBrandEmailDate(email.date)}</span>
                            </div>
                            <div className="text-sm text-white truncate">{email.subject}</div>
                          </button>
                        ))}
                      </div>
                      {/* ページネーション */}
                      {brandEmailData.total > 20 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <Button variant="ghost" size="sm" disabled={brandEmailPage <= 1}
                            onClick={() => setBrandEmailPage(p => p - 1)} className="text-gray-400">
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm text-gray-400">{brandEmailPage} / {Math.ceil(brandEmailData.total / 20)}</span>
                          <Button variant="ghost" size="sm" disabled={brandEmailPage >= Math.ceil(brandEmailData.total / 20)}
                            onClick={() => setBrandEmailPage(p => p + 1)} className="text-gray-400">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* 新規送信タブ */}
          {brandEmailTab === "compose" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">宛先 *</label>
                <Input
                  value={brandComposeTo}
                  onChange={e => setBrandComposeTo(e.target.value)}
                  placeholder="example@email.com"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">CC</label>
                <Input
                  value={brandComposeCc}
                  onChange={e => setBrandComposeCc(e.target.value)}
                  placeholder="cc@email.com"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">件名 *</label>
                <Input
                  value={brandComposeSubject}
                  onChange={e => setBrandComposeSubject(e.target.value)}
                  placeholder="件名を入力"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">本文</label>
                <Textarea
                  value={brandComposeBody}
                  onChange={e => setBrandComposeBody(e.target.value)}
                  placeholder="メール本文を入力..."
                  rows={10}
                  className="bg-gray-800 border-gray-700 text-white resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBrandEmailTab("history")} className="border-gray-600 text-gray-300">
                  キャンセル
                </Button>
                <Button
                  onClick={handleBrandSend}
                  disabled={brandSendMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {brandSendMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> 送信中...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-1" /> 送信</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== FOLLOW RECORD DIALOG ===== */}
      <Dialog open={followRecordOpen} onOpenChange={setFollowRecordOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-400" /> 新增跟进记录
              {followRecordBrand && <span className="text-sm text-gray-400 ml-2">- {followRecordBrand.brandName}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">沟通方式</label>
                <Select value={followForm.communicationType} onValueChange={v => setFollowForm(p => ({ ...p, communicationType: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="email" className="text-white text-xs">邮件</SelectItem>
                    <SelectItem value="phone" className="text-white text-xs">电话</SelectItem>
                    <SelectItem value="wechat" className="text-white text-xs">微信</SelectItem>
                    <SelectItem value="meeting" className="text-white text-xs">会议</SelectItem>
                    <SelectItem value="other" className="text-white text-xs">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">时长(分钟)</label>
                <Input type="number" value={followForm.durationMinutes || ""}
                  onChange={e => setFollowForm(p => ({ ...p, durationMinutes: e.target.value ? Number(e.target.value) : null }))}
                  className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="可选" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">沟通摘要</label>
              <Textarea value={followForm.summary} onChange={e => setFollowForm(p => ({ ...p, summary: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white text-xs" rows={3} placeholder="本次沟通的主要内容..." />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" /> 关键要点</label>
              <Input value={followForm.keyPoints} onChange={e => setFollowForm(p => ({ ...p, keyPoints: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="客户关注的重点、关键决策人等" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">下次跟进日期</label>
                <Input type="date" value={followForm.nextFollowDate || ""}
                  onChange={e => setFollowForm(p => ({ ...p, nextFollowDate: e.target.value || null }))}
                  className="bg-gray-800 border-gray-700 text-white h-8 text-xs" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">下次跟进内容</label>
                <Input value={followForm.nextAction} onChange={e => setFollowForm(p => ({ ...p, nextAction: e.target.value }))}
                  className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="如: 发送报价单" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600" onClick={() => setFollowRecordOpen(false)}>取消</Button>
            <Button className="bg-green-600 hover:bg-green-700" disabled={createFollowRecordMutation.isPending}
              onClick={() => {
                if (!followRecordBrand) return;
                createFollowRecordMutation.mutate({
                  recruitmentBrandId: followRecordBrand.id,
                  communicationType: followForm.communicationType as any,
                  durationMinutes: followForm.durationMinutes,
                  summary: followForm.summary,
                  keyPoints: followForm.keyPoints,
                  nextAction: followForm.nextAction,
                  nextFollowDate: followForm.nextFollowDate,
                });
              }}>
              {createFollowRecordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              保存记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for legacy import button */}
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileImport}
      />
      </>
      )}
    </div>
  );
}
