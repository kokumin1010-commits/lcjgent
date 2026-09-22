import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { ArchiveRestore, History, Laptop, Loader2, PackagePlus, Pencil, Plus, Search, Trash2, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AppRouter } from "../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type FixedAsset = RouterOutputs["fixedAsset"]["overview"]["assets"][number];

const CATEGORY_VALUES = ["mobile_phone", "computer", "tablet", "camera", "filming_equipment", "office_equipment", "furniture", "vehicle", "other"] as const;
const STATUS_VALUES = ["available", "in_use", "repair", "lost", "retired", "disposed"] as const;
const CONDITION_VALUES = ["new", "good", "fair", "poor"] as const;

type AssetCategory = (typeof CATEGORY_VALUES)[number];
type AssetStatus = (typeof STATUS_VALUES)[number];
type AssetCondition = (typeof CONDITION_VALUES)[number];

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  mobile_phone: "手机",
  computer: "电脑",
  tablet: "平板",
  camera: "相机",
  filming_equipment: "拍摄设备",
  office_equipment: "办公设备",
  furniture: "家具",
  vehicle: "车辆",
  other: "其他",
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  available: "未领用",
  in_use: "使用中",
  repair: "维修中",
  lost: "遗失",
  retired: "已退役",
  disposed: "已处置",
};

const CONDITION_LABELS: Record<AssetCondition, string> = {
  new: "全新",
  good: "良好",
  fair: "一般",
  poor: "较差",
};

const EVENT_LABELS: Record<string, string> = {
  create: "登记",
  update: "更新资料",
  assign: "领用",
  transfer: "转交",
  unassign: "归还",
  status_change: "状态变更",
  archive: "归档",
  restore: "恢复",
};

const CHANGE_FIELD_LABELS: Record<string, string> = {
  assetCode: "资产编号",
  assetName: "资产名称",
  category: "类别",
  brandModel: "品牌／型号",
  serialNumber: "序列号／IMEI",
  entity: "公司主体",
  acquisitionDate: "购置日期",
  purchasePrice: "购置金额",
  currency: "币种",
  vendor: "供应商",
  invoiceNumber: "发票／凭证编号",
  location: "地点",
  assigneeStaffId: "使用人ID",
  assigneeName: "使用人",
  assigneeDepartment: "使用人部门",
  assigneePosition: "使用人岗位",
  assignedAt: "领用／转交日期",
  status: "状态",
  conditionStatus: "设备成色",
  warrantyEndDate: "保修到期日",
  notes: "备注",
  archivedAt: "归档状态",
};

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type AssetDraft = {
  assetCode: string;
  assetName: string;
  category: AssetCategory;
  brandModel: string;
  serialNumber: string;
  entity: "japan" | "china";
  acquisitionDate: string;
  purchasePrice: string;
  currency: "JPY" | "CNY";
  vendor: string;
  invoiceNumber: string;
  location: string;
  assigneeStaffId: string;
  assignedAt: string;
  status: AssetStatus;
  conditionStatus: AssetCondition;
  warrantyEndDate: string;
  notes: string;
  changeNote: string;
};

const EMPTY_DRAFT: AssetDraft = {
  assetCode: "",
  assetName: "",
  category: "mobile_phone",
  brandModel: "",
  serialNumber: "",
  entity: "japan",
  acquisitionDate: "",
  purchasePrice: "",
  currency: "JPY",
  vendor: "",
  invoiceNumber: "",
  location: "",
  assigneeStaffId: "",
  assignedAt: "",
  status: "available",
  conditionStatus: "good",
  warrantyEndDate: "",
  notes: "",
  changeNote: "",
};

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function formatMoney(value: number | null | undefined, currency: string) {
  if (value == null) return "-";
  return new Intl.NumberFormat(currency === "CNY" ? "zh-CN" : "ja-JP", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function statusClass(status: string) {
  if (status === "in_use") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "available") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "repair") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "lost") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function statusLabel(value: string | null | undefined) {
  return value ? STATUS_LABELS[value as AssetStatus] || value : "-";
}

function changeValue(field: string, value: unknown) {
  if (value == null || value === "") return "-";
  const text = String(value);
  if (field === "category") return CATEGORY_LABELS[text as AssetCategory] || text;
  if (field === "status") return statusLabel(text);
  if (field === "conditionStatus") return CONDITION_LABELS[text as AssetCondition] || text;
  if (field === "entity") return text === "china" ? "中国公司" : "日本公司";
  return text;
}

function toMutationInput(draft: AssetDraft) {
  const price = draft.purchasePrice.trim() === "" ? null : Number(draft.purchasePrice);
  if (price != null && (!Number.isFinite(price) || price < 0)) {
    throw new Error("请输入正确的购置金额");
  }
  return {
    assetCode: nullableText(draft.assetCode),
    assetName: draft.assetName.trim(),
    category: draft.category,
    brandModel: nullableText(draft.brandModel),
    serialNumber: nullableText(draft.serialNumber),
    entity: draft.entity,
    acquisitionDate: draft.acquisitionDate || null,
    purchasePrice: price,
    currency: draft.currency,
    vendor: nullableText(draft.vendor),
    invoiceNumber: nullableText(draft.invoiceNumber),
    location: nullableText(draft.location),
    assigneeStaffId: draft.assigneeStaffId ? Number(draft.assigneeStaffId) : null,
    assignedAt: draft.assigneeStaffId ? draft.assignedAt || todayInTokyo() : null,
    status: draft.status,
    conditionStatus: draft.conditionStatus,
    warrantyEndDate: draft.warrantyEndDate || null,
    notes: nullableText(draft.notes),
  };
}

export default function FixedAssetsTab() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [draft, setDraft] = useState<AssetDraft>(EMPTY_DRAFT);
  const [historyAsset, setHistoryAsset] = useState<FixedAsset | null>(null);

  const queryInput = useMemo(() => ({
    search: search.trim() || undefined,
    category: category === "all" ? undefined : category as AssetCategory,
    status: status === "all" ? undefined : status as AssetStatus,
    assigneeStaffId: assignee !== "all" && assignee !== "unassigned" ? Number(assignee) : undefined,
    unassignedOnly: assignee === "unassigned" || undefined,
    includeArchived,
  }), [assignee, category, includeArchived, search, status]);

  const overviewQuery = trpc.fixedAsset.overview.useQuery(queryInput);
  const staffQuery = trpc.staff.listActive.useQuery();
  const historyQuery = trpc.fixedAsset.history.useQuery(
    { assetId: Number(historyAsset?.id || 0) },
    { enabled: Boolean(historyAsset?.id) },
  );

  const refresh = async () => {
    await utils.fixedAsset.overview.invalidate();
    if (historyAsset?.id) await utils.fixedAsset.history.invalidate({ assetId: historyAsset.id });
  };

  const handleMutationError = async (error: { message: string; data?: { code?: string } | null }, closeEditor = false) => {
    if (error.data?.code === "CONFLICT") {
      await overviewQuery.refetch();
      if (closeEditor) {
        setEditOpen(false);
        setEditingAsset(null);
      }
      toast.error("资料已被其他人更新，已重新载入最新内容，请再确认一次");
      return;
    }
    toast.error(error.message);
  };

  const createMutation = trpc.fixedAsset.create.useMutation({
    onSuccess: async (result) => {
      await refresh();
      setEditOpen(false);
      setEditingAsset(null);
      setDraft(EMPTY_DRAFT);
      toast.success(`固定资产已登记：${result.assetCode}`);
    },
    onError: (error) => void handleMutationError(error),
  });
  const updateMutation = trpc.fixedAsset.update.useMutation({
    onSuccess: async () => {
      await refresh();
      setEditOpen(false);
      setEditingAsset(null);
      setDraft(EMPTY_DRAFT);
      toast.success("固定资产已更新，变更记录已保存");
    },
    onError: (error) => void handleMutationError(error, true),
  });
  const archiveMutation = trpc.fixedAsset.archive.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("固定资产已归档，可随时恢复");
    },
    onError: (error) => void handleMutationError(error),
  });
  const restoreMutation = trpc.fixedAsset.restore.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("固定资产已恢复");
    },
    onError: (error) => void handleMutationError(error),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isMutating = isSaving || archiveMutation.isPending || restoreMutation.isPending;
  const data = overviewQuery.data;
  const assets = data?.assets || [];
  const staff = staffQuery.data || [];

  const openCreate = () => {
    setEditingAsset(null);
    setDraft(EMPTY_DRAFT);
    setEditOpen(true);
  };

  const openEdit = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setDraft({
      assetCode: asset.assetCode || "",
      assetName: asset.assetName || "",
      category: asset.category || "other",
      brandModel: asset.brandModel || "",
      serialNumber: asset.serialNumber || "",
      entity: asset.entity === "china" ? "china" : "japan",
      acquisitionDate: asset.acquisitionDate || "",
      purchasePrice: asset.purchasePrice == null ? "" : String(asset.purchasePrice),
      currency: asset.currency === "CNY" ? "CNY" : "JPY",
      vendor: asset.vendor || "",
      invoiceNumber: asset.invoiceNumber || "",
      location: asset.location || "",
      assigneeStaffId: asset.assigneeStaffId == null ? "" : String(asset.assigneeStaffId),
      assignedAt: asset.assignedAt || "",
      status: asset.status || "available",
      conditionStatus: asset.conditionStatus || "good",
      warrantyEndDate: asset.warrantyEndDate || "",
      notes: asset.notes || "",
      changeNote: "",
    });
    setEditOpen(true);
  };

  const save = () => {
    if (!draft.assetName.trim()) {
      toast.error("请输入资产名称");
      return;
    }
    try {
      const input = toMutationInput(draft);
      if (editingAsset) {
        updateMutation.mutate({
          ...input,
          id: editingAsset.id,
          version: editingAsset.version,
          changeNote: nullableText(draft.changeNote),
        });
      } else {
        createMutation.mutate(input);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "输入内容不正确");
    }
  };

  const archive = (asset: FixedAsset) => {
    const reason = window.prompt(`请输入归档理由：${asset.assetCode} ${asset.assetName}`);
    if (!reason?.trim()) return;
    archiveMutation.mutate({ id: asset.id, version: asset.version, reason: reason.trim() });
  };

  return (
    <div className="space-y-5" data-testid="fixed-assets-tab">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Laptop className="h-5 w-5 text-blue-600" />
            固定资产台账
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            登记公司购买的手机、电脑、相机和办公设备，并持续追踪当前使用人、位置与交接记录。
          </p>
        </div>
        <Button onClick={openCreate} disabled={isMutating}>
          <Plus className="mr-2 h-4 w-4" />登记固定资产
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">资产总数</div><div className="mt-1 text-2xl font-bold">{data?.summary.total || 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">使用中</div><div className="mt-1 text-2xl font-bold text-blue-600">{data?.summary.inUse || 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">未领用</div><div className="mt-1 text-2xl font-bold text-emerald-600">{data?.summary.available || 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">待确认使用人</div><div className="mt-1 text-2xl font-bold text-amber-600">{data?.summary.unassigned || 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">维修／遗失</div><div className="mt-1 text-2xl font-bold text-red-600">{data?.summary.attention || 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">购置金额合计</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {(data?.summary.values || []).length === 0 ? (
            <span className="text-sm text-muted-foreground">尚未登记购置金额</span>
          ) : data?.summary.values.map((item) => (
            <div key={item.currency} className="rounded-lg border bg-slate-50 px-4 py-2">
              <div className="text-xs text-muted-foreground">{item.currency}</div>
              <div className="font-semibold tabular-nums">{formatMoney(item.amount, item.currency)}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">按使用人统计</CardTitle></CardHeader>
          <CardContent>
            {(data?.summary.byAssignee || []).length === 0 ? <p className="text-sm text-muted-foreground">尚未登记资产</p> : <div className="space-y-2">{data?.summary.byAssignee.map((item) => <button key={item.staffId ?? "unassigned"} type="button" onClick={() => setAssignee(item.staffId == null ? "unassigned" : String(item.staffId))} className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:bg-muted/50"><span><span className="font-medium">{item.name}</span>{item.department && <span className="ml-2 text-xs text-muted-foreground">{item.department}</span>}</span><span className="text-sm font-semibold tabular-nums">{item.assetCount}件</span></button>)}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">按资产类别统计</CardTitle></CardHeader>
          <CardContent>
            {(data?.summary.byCategory || []).length === 0 ? <p className="text-sm text-muted-foreground">尚未登记资产</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{data?.summary.byCategory.map((item) => <button key={item.category} type="button" onClick={() => setCategory(item.category)} className="rounded-lg border px-3 py-2 text-left hover:bg-muted/50"><div className="text-xs text-muted-foreground">{CATEGORY_LABELS[item.category as AssetCategory] || item.category}</div><div className="mt-1 font-semibold tabular-nums">{item.assetCount}件</div></button>)}</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_160px_220px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="搜索编号、名称、型号、序列号、地点或使用人" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部类别</SelectItem>{CATEGORY_VALUES.map((value) => <SelectItem key={value} value={value}>{CATEGORY_LABELS[value]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部状态</SelectItem>{STATUS_VALUES.map((value) => <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue placeholder="全部使用人" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部使用人</SelectItem>
                <SelectItem value="unassigned">未登记使用人</SelectItem>
                {staff.map((person) => <SelectItem key={person.id} value={String(person.id)}>{person.name}{person.department ? `｜${person.department}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex h-10 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm">
              <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
              显示已归档
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {overviewQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />正在读取固定资产</div>
          ) : overviewQuery.isError ? (
            <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">读取失败：{overviewQuery.error.message}</div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <PackagePlus className="mb-3 h-10 w-10 text-slate-300" />
              <p className="font-medium">还没有符合条件的固定资产</p>
              <p className="mt-1 text-sm text-muted-foreground">点击“登记固定资产”开始录入手机、电脑等公司资产。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full text-sm">
                <thead><tr className="border-b bg-muted/50 text-left">
                  <th className="px-3 py-3">资产编号／名称</th><th className="px-3 py-3">类别・型号</th><th className="px-3 py-3">购置信息</th><th className="px-3 py-3">当前使用人</th><th className="px-3 py-3">地点</th><th className="px-3 py-3">状态</th><th className="px-3 py-3 text-right">操作</th>
                </tr></thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className={`border-b align-top hover:bg-muted/30 ${asset.deletedAt ? "bg-slate-50 opacity-70" : ""}`}>
                      <td className="px-3 py-3"><div className="font-medium">{asset.assetName}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{asset.assetCode}</div>{asset.serialNumber && <div className="mt-1 text-xs text-muted-foreground">S/N: {asset.serialNumber}</div>}</td>
                      <td className="px-3 py-3"><div>{CATEGORY_LABELS[asset.category] || asset.category}</div><div className="mt-1 text-xs text-muted-foreground">{asset.brandModel || "-"}</div></td>
                      <td className="px-3 py-3"><div>{formatMoney(asset.purchasePrice, asset.currency)}</div><div className="mt-1 text-xs text-muted-foreground">{asset.acquisitionDate || "购置日未登记"}</div><div className="text-xs text-muted-foreground">{asset.entity === "china" ? "中国公司" : "日本公司"}</div></td>
                      <td className="px-3 py-3">{asset.assigneeName ? <><div className="flex items-center gap-1 font-medium"><UserRoundCheck className="h-3.5 w-3.5 text-blue-600" />{asset.assigneeName}</div><div className="mt-1 text-xs text-muted-foreground">{[asset.assigneeDepartment, asset.assigneePosition].filter(Boolean).join("・") || "-"}</div><div className="text-xs text-muted-foreground">{asset.assignedAt ? `领用：${asset.assignedAt}` : ""}</div></> : <span className="text-amber-600">未登记</span>}</td>
                      <td className="px-3 py-3">{asset.location || "-"}</td>
                      <td className="px-3 py-3"><Badge variant="outline" className={statusClass(asset.status)}>{STATUS_LABELS[asset.status] || asset.status}</Badge><div className="mt-1 text-xs text-muted-foreground">成色：{CONDITION_LABELS[asset.conditionStatus] || asset.conditionStatus}</div>{asset.deletedAt && <Badge variant="secondary" className="mt-1">已归档</Badge>}</td>
                      <td className="px-3 py-3"><div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setHistoryAsset(asset)} title="查看履历"><History className="h-4 w-4" /></Button>
                        {!asset.deletedAt ? <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(asset)} disabled={isMutating} title="编辑"><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => archive(asset)} disabled={isMutating} title="归档"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </> : <Button size="sm" variant="outline" onClick={() => restoreMutation.mutate({ id: asset.id, version: asset.version })} disabled={isMutating}><ArchiveRestore className="mr-1 h-4 w-4" />恢复</Button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!isMutating) setEditOpen(open); }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "编辑固定资产" : "登记固定资产"}</DialogTitle>
            <DialogDescription>资产编号可留空自动生成；使用人来自HR在职员工名单，转交和状态变化会自动保留履历。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <label className="space-y-1 text-sm"><span className="font-medium">资产名称 *</span><Input value={draft.assetName} onChange={(e) => setDraft({ ...draft, assetName: e.target.value })} placeholder="例如：iPhone 17 Pro / MacBook Pro" maxLength={255} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">资产编号</span><Input value={draft.assetCode} onChange={(e) => setDraft({ ...draft, assetCode: e.target.value })} placeholder="留空自动生成 FA-年份-编号" maxLength={64} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">类别 *</span><Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value as AssetCategory })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORY_VALUES.map((value) => <SelectItem key={value} value={value}>{CATEGORY_LABELS[value]}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">品牌／型号</span><Input value={draft.brandModel} onChange={(e) => setDraft({ ...draft, brandModel: e.target.value })} placeholder="Apple iPhone / MacBook 型号等" maxLength={255} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">序列号／IMEI</span><Input value={draft.serialNumber} onChange={(e) => setDraft({ ...draft, serialNumber: e.target.value })} maxLength={255} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">公司主体 *</span><Select value={draft.entity} onValueChange={(value) => setDraft({ ...draft, entity: value as "japan" | "china", currency: value === "china" ? "CNY" : "JPY" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="japan">日本公司</SelectItem><SelectItem value="china">中国公司</SelectItem></SelectContent></Select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">购置日期</span><Input type="date" value={draft.acquisitionDate} onChange={(e) => setDraft({ ...draft, acquisitionDate: e.target.value })} /></label>
            <div className="grid grid-cols-[1fr_110px] gap-2"><label className="space-y-1 text-sm"><span className="font-medium">购置金额</span><Input type="number" min="0" step="0.01" value={draft.purchasePrice} onChange={(e) => setDraft({ ...draft, purchasePrice: e.target.value })} /></label><label className="space-y-1 text-sm"><span className="font-medium">币种</span><Select value={draft.currency} onValueChange={(value) => setDraft({ ...draft, currency: value as "JPY" | "CNY" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="JPY">JPY</SelectItem><SelectItem value="CNY">CNY</SelectItem></SelectContent></Select></label></div>
            <label className="space-y-1 text-sm"><span className="font-medium">购买方／供应商</span><Input value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} maxLength={255} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">发票／凭证编号</span><Input value={draft.invoiceNumber} onChange={(e) => setDraft({ ...draft, invoiceNumber: e.target.value })} maxLength={255} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">保管／使用地点</span><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="例如：东京办公室／直播间A" maxLength={255} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">当前使用人</span><Select value={draft.assigneeStaffId || "none"} onValueChange={(value) => { const nextId = value === "none" ? "" : value; setDraft({ ...draft, assigneeStaffId: nextId, assignedAt: !nextId ? "" : nextId !== draft.assigneeStaffId ? todayInTokyo() : draft.assignedAt || todayInTokyo(), status: !nextId && draft.status === "in_use" ? "available" : nextId && draft.status === "available" ? "in_use" : draft.status }); }}><SelectTrigger><SelectValue placeholder="未分配" /></SelectTrigger><SelectContent><SelectItem value="none">未分配</SelectItem>{editingAsset?.assigneeStaffId && !staff.some((person) => person.id === editingAsset.assigneeStaffId) && <SelectItem value={String(editingAsset.assigneeStaffId)}>{editingAsset.assigneeName}（历史使用人）</SelectItem>}{staff.map((person) => <SelectItem key={person.id} value={String(person.id)}>{person.name}{person.department ? `｜${person.department}` : ""}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">领用／转交日期</span><Input type="date" value={draft.assignedAt} onChange={(e) => setDraft({ ...draft, assignedAt: e.target.value })} disabled={!draft.assigneeStaffId} /></label>
            {editingAsset?.assigneeStaffId && !staffQuery.isLoading && !staff.some((person) => person.id === editingAsset.assigneeStaffId) && draft.assigneeStaffId === String(editingAsset.assigneeStaffId) && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 md:col-span-2">当前历史使用人已不在HR在职名单。保存前请重新分配给在职员工，或选择“未分配”。原使用记录仍会保留在资产履历中。</p>}
            <label className="space-y-1 text-sm"><span className="font-medium">资产状态 *</span><Select value={draft.status} onValueChange={(value) => { const nextStatus = value as AssetStatus; const clearsAssignee = ["available", "retired", "disposed"].includes(nextStatus); setDraft({ ...draft, status: nextStatus, assigneeStaffId: clearsAssignee ? "" : draft.assigneeStaffId, assignedAt: clearsAssignee ? "" : draft.assignedAt }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_VALUES.map((value) => <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">设备成色 *</span><Select value={draft.conditionStatus} onValueChange={(value) => setDraft({ ...draft, conditionStatus: value as AssetCondition })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONDITION_VALUES.map((value) => <SelectItem key={value} value={value}>{CONDITION_LABELS[value]}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">保修到期日</span><Input type="date" value={draft.warrantyEndDate} onChange={(e) => setDraft({ ...draft, warrantyEndDate: e.target.value })} /></label>
            <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">备注</span><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="配件、损坏情况、保管要求等" maxLength={5000} /></label>
            {editingAsset && <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">本次变更说明</span><Textarea value={draft.changeNote} onChange={(e) => setDraft({ ...draft, changeNote: e.target.value })} placeholder="例如：由A转交给B，充电器一并交接" maxLength={1000} /></label>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isMutating}>取消</Button>
            <Button onClick={save} disabled={isMutating || !draft.assetName.trim()}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingAsset ? "保存并记录变更" : "登记资产"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyAsset)} onOpenChange={(open) => { if (!open) setHistoryAsset(null); }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" />资产履历</DialogTitle><DialogDescription>{historyAsset ? `${historyAsset.assetCode}｜${historyAsset.assetName}` : ""}</DialogDescription></DialogHeader>
          {historyQuery.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : historyQuery.isError ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">读取失败：{historyQuery.error.message}</div>
          ) : (historyQuery.data || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无履历</p>
          ) : (
            <div className="space-y-3">
              {historyQuery.data?.map((event) => {
                const changes = Object.entries(event.changes || {}) as Array<[string, { before: unknown; after: unknown }]>;
                return (
                  <div key={event.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">{EVENT_LABELS[event.eventType] || event.eventType}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}｜{event.createdByName}</span>
                    </div>
                    {event.previousAssigneeStaffId !== event.assigneeStaffId && (
                      <p className="mt-2 text-sm">使用人：{event.previousAssigneeName || "未分配"} → {event.assigneeName || "未分配"}</p>
                    )}
                    {event.previousStatus !== event.status && (
                      <p className="mt-1 text-sm">状态：{statusLabel(event.previousStatus)} → {statusLabel(event.status)}</p>
                    )}
                    {event.previousLocation !== event.location && (
                      <p className="mt-1 text-sm">地点：{event.previousLocation || "-"} → {event.location || "-"}</p>
                    )}
                    {changes.length > 0 && (
                      <div className="mt-3 space-y-1 rounded bg-slate-50 p-2 text-xs">
                        {changes.map(([field, values]) => (
                          <div key={field} className="grid gap-1 sm:grid-cols-[130px_1fr]">
                            <span className="font-medium text-slate-600">{CHANGE_FIELD_LABELS[field] || field}</span>
                            <span className="break-words text-slate-700">{changeValue(field, values.before)} → {changeValue(field, values.after)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {event.note && <p className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-800">{event.note}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
