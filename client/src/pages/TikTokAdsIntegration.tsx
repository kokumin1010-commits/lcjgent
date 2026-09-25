import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  History,
  ExternalLink,
  Eye,
  Layers3,
  Megaphone,
  MousePointerClick,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Video,
  WalletCards,
  Wifi,
  WifiOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { canViewDepartmentMenuItem } from "@/lib/adminMenuConfig";
import {
  getTikTokDeliveryLabel,
  isTikTokEffectivelyDelivering,
  resolveTikTokDeliveryState,
  type TikTokDeliveryState,
} from "@shared/tiktokAdsDelivery";

const TABS = [
  { id: "overview", label: "总览", icon: BarChart3 },
  { id: "campaigns", label: "Campaign", icon: Megaphone },
  { id: "adgroups", label: "广告组", icon: Layers3 },
  { id: "ads", label: "广告・素材", icon: Video },
  { id: "history", label: "操作记录", icon: History },
  { id: "capabilities", label: "API能力", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

type MetricValues = {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  conversion: string;
  costPerConversion: string;
};

type OperationTarget = {
  entityType: "campaign" | "adgroup" | "ad";
  entityId: string;
  entityName: string;
  operationStatus: string;
  budget?: number;
  budgetMode?: string;
};

type OperationDraft = {
  target: OperationTarget;
  action: "status" | "budget";
  operationStatus?: "ENABLE" | "DISABLE";
  budget?: string;
};

function numberValue(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("ja-JP").format(numberValue(value));
}

function formatCompact(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 }).format(numberValue(value));
}

function formatYen(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(numberValue(value));
}

function formatYenRate(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(numberValue(value));
}

function formatPercent(value: string | number | null | undefined): string {
  return `${numberValue(value).toFixed(2)}%`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}+09:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function DeliveryBadge({ state }: { state: TikTokDeliveryState }) {
  const enabled = state === "delivering";
  const warning = state === "pending" || state === "limited";
  const deleted = state === "deleted";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
      enabled
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
        : warning
          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
          : deleted
            ? "bg-red-50 text-red-700 ring-1 ring-red-200"
            : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", enabled ? "bg-emerald-500" : warning ? "bg-amber-500" : deleted ? "bg-red-500" : "bg-slate-400")} />
      {getTikTokDeliveryLabel(state)}
    </span>
  );
}

function AccountStatusBadge({ status }: { status: string }) {
  const enabled = status === "STATUS_ENABLE";
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{enabled ? "账户有效" : status}</span>;
}

function MetricCard({ icon: Icon, label, value, note, accent }: {
  icon: typeof Eye;
  label: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", accent)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">{text}</div>;
}

function operationStatusLabel(status: string) {
  return ({
    prepared: "等待确认",
    executing: "执行中",
    succeeded: "已验证成功",
    failed: "失败",
    expired: "确认已过期",
    needs_reconciliation: "需要人工核对",
  } as Record<string, string>)[status] ?? status;
}

function operationErrorMessage(code: string | null | undefined) {
  if (!code) return "操作失败，请重新读取后再试";
  const messages: Record<string, string> = {
    TIKTOK_WRITE_NOT_ENABLED: "生产写入尚未启用，请先在Railway配置写入开关与专用令牌",
    TIKTOK_PREFLIGHT_CHANGED: "广告数据已变化，请重新生成确认预览",
    TIKTOK_REVIEW_NOT_APPROVED: "该广告或广告组尚未通过审核，不能启用",
    TIKTOK_ONLY_LIFETIME_BUDGET_SUPPORTED: "首版只支持总预算（Lifetime Budget）调整",
    TIKTOK_BUDGET_BELOW_SPEND_GUARD: "新预算必须不低于当前累计花费的105%",
    TIKTOK_AUTOMATED_CAMPAIGN_UNSUPPORTED: "Smart+等自动化Campaign暂不开放直接操作",
    TIKTOK_DEDICATED_CAMPAIGN_UNSUPPORTED: "iOS Dedicated/SKAN Campaign暂不开放直接操作",
    TIKTOK_CBO_CAMPAIGN_UNSUPPORTED: "CBO Campaign暂不开放任何直接操作",
    TIKTOK_CBO_STATE_UNKNOWN: "无法确认Campaign是否启用CBO，已停止操作",
    TIKTOK_TARGET_OPERATION_IN_PROGRESS: "同一广告对象已有操作正在执行",
    TIKTOK_OPERATION_ALREADY_EXECUTING: "该操作正在执行，请勿重复提交",
    TIKTOK_OPERATION_LEASE_LOST: "操作租约已变化，目标已锁定并需要人工核对",
    TIKTOK_OPERATION_REQUIRES_RECONCILIATION: "该操作结果不确定，请先在TikTok Ads Manager人工核对",
    TIKTOK_POST_WRITE_VERIFICATION_FAILED: "TikTok返回后未能验证最终状态，请人工核对",
  };
  return messages[code] ?? `${code}（请重新读取后核对）`;
}

function OperationBadge({ status }: { status: string }) {
  const tone = status === "succeeded"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "needs_reconciliation" || status === "failed"
      ? "bg-red-50 text-red-700 ring-red-200"
      : status === "executing"
        ? "bg-cyan-50 text-cyan-700 ring-cyan-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", tone)}>{operationStatusLabel(status)}</span>;
}

export default function TikTokAdsIntegration() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [search, setSearch] = useState("");
  const [operationDraft, setOperationDraft] = useState<OperationDraft | null>(null);
  const [operationReason, setOperationReason] = useState("");
  const [confirmationInput, setConfirmationInput] = useState("");
  const [operationPreview, setOperationPreview] = useState<any>(null);
  const permissionsQuery = trpc.rbac.myPermissions.useQuery(undefined, {
    enabled: Boolean(user) && user?.role !== "admin",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const localCanViewPage = canViewDepartmentMenuItem({
    path: "/master/tiktok-ads",
    userRole: user?.role,
    permissionsData: user?.role === "admin"
      ? { isAdmin: true, permissions: null }
      : permissionsQuery.data,
    permissionsLoading: permissionsQuery.isLoading,
  });
  const accessQuery = trpc.tiktokAds.access.useQuery(undefined, {
    enabled: Boolean(user) && localCanViewPage,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const canViewPage = accessQuery.data?.canView ?? localCanViewPage;
  const dashboard = trpc.tiktokAds.dashboard.useQuery(undefined, {
    enabled: accessQuery.data?.canView === true,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const history = trpc.tiktokAds.operationHistory.useQuery({ limit: 50 }, {
    enabled: accessQuery.data?.canOperate === true && activeTab === "history",
    refetchOnWindowFocus: false,
  });
  const previewOperation = trpc.tiktokAds.previewOperation.useMutation({
    onSuccess: preview => {
      setOperationPreview(preview);
      setConfirmationInput("");
    },
    onError: error => toast.error(operationErrorMessage(error.message)),
  });
  const executeOperation = trpc.tiktokAds.executeOperation.useMutation({
    onSuccess: async result => {
      if (result.status !== "succeeded") {
        toast.error(operationErrorMessage(result.errorCode || "TIKTOK_OPERATION_REQUIRES_RECONCILIATION"));
        await history.refetch();
        return;
      }
      toast.success("TikTok操作已提交并完成实时复核");
      setOperationDraft(null);
      setOperationPreview(null);
      setOperationReason("");
      setConfirmationInput("");
      await Promise.all([dashboard.refetch(), history.refetch()]);
    },
    onError: error => toast.error(operationErrorMessage(error.message)),
  });
  const data = dashboard.data;

  const canOperate = accessQuery.data?.canOperate === true;
  const writeEnabled = accessQuery.data?.writeEnabled === true;

  const openStatusOperation = (target: OperationTarget, operationStatus: "ENABLE" | "DISABLE") => {
    setOperationDraft({ target, action: "status", operationStatus });
    setOperationReason("");
    setOperationPreview(null);
    setConfirmationInput("");
  };

  const openBudgetOperation = (target: OperationTarget) => {
    setOperationDraft({ target, action: "budget", budget: target.budget ? String(target.budget) : "" });
    setOperationReason("");
    setOperationPreview(null);
    setConfirmationInput("");
  };

  const closeOperation = () => {
    if (previewOperation.isPending || executeOperation.isPending) return;
    setOperationDraft(null);
    setOperationPreview(null);
    setOperationReason("");
    setConfirmationInput("");
  };

  const submitPreview = () => {
    if (!operationDraft) return;
    const common = {
      entityType: operationDraft.target.entityType,
      entityId: operationDraft.target.entityId,
      reason: operationReason.trim(),
    };
    if (operationDraft.action === "status") {
      previewOperation.mutate({ ...common, action: "status", operationStatus: operationDraft.operationStatus! });
    } else {
      previewOperation.mutate({
        ...common,
        entityType: operationDraft.target.entityType as "campaign" | "adgroup",
        action: "budget",
        budget: Number(operationDraft.budget),
      });
    }
  };

  const submitExecution = () => {
    if (!operationPreview) return;
    executeOperation.mutate({
      operationId: operationPreview.operationId,
      confirmationToken: operationPreview.confirmationToken,
      confirmationText: confirmationInput,
    });
  };

  const filteredCampaigns = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data?.campaigns ?? [];
    return (data?.campaigns ?? []).filter(item =>
      `${item.campaignName} ${item.campaignId} ${item.objectiveType}`.toLowerCase().includes(keyword)
    );
  }, [data?.campaigns, search]);

  const filteredAdgroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data?.adgroups ?? [];
    return (data?.adgroups ?? []).filter(item =>
      `${item.adgroupName} ${item.adgroupId} ${item.campaignName} ${item.optimizationGoal}`.toLowerCase().includes(keyword)
    );
  }, [data?.adgroups, search]);

  const filteredAds = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data?.ads ?? [];
    return (data?.ads ?? []).filter(item =>
      `${item.adName} ${item.adId} ${item.campaignName} ${item.adgroupName} ${item.adText ?? ""}`.toLowerCase().includes(keyword)
    );
  }, [data?.ads, search]);

  const campaignDeliveryStates = useMemo(() => new Map((data?.campaigns ?? []).map(item => [
    item.campaignId,
    resolveTikTokDeliveryState({ operationStatus: item.operationStatus, secondaryStatus: item.secondaryStatus }),
  ])), [data?.campaigns]);
  const adgroupDeliveryStates = useMemo(() => new Map((data?.adgroups ?? []).map(item => [
    item.adgroupId,
    resolveTikTokDeliveryState({
      operationStatus: item.operationStatus,
      secondaryStatus: item.secondaryStatus,
      parentDelivering: isTikTokEffectivelyDelivering(campaignDeliveryStates.get(item.campaignId) ?? "paused"),
    }),
  ])), [campaignDeliveryStates, data?.adgroups]);
  const adDeliveryStates = useMemo(() => new Map((data?.ads ?? []).map(item => [
    item.adId,
    resolveTikTokDeliveryState({
      operationStatus: item.operationStatus,
      secondaryStatus: item.secondaryStatus,
      parentDelivering:
        isTikTokEffectivelyDelivering(campaignDeliveryStates.get(item.campaignId) ?? "paused") &&
        isTikTokEffectivelyDelivering(adgroupDeliveryStates.get(item.adgroupId) ?? "paused"),
    }),
  ])), [adgroupDeliveryStates, campaignDeliveryStates, data?.ads]);
  const activeCampaigns = [...campaignDeliveryStates.values()].filter(isTikTokEffectivelyDelivering).length;
  const activeAdgroups = [...adgroupDeliveryStates.values()].filter(isTikTokEffectivelyDelivering).length;
  const activeAds = [...adDeliveryStates.values()].filter(isTikTokEffectivelyDelivering).length;
  const metrics = data?.lifetimeMetrics as MetricValues | undefined;

  if (
    authLoading ||
    (user?.role !== "admin" && permissionsQuery.isLoading) ||
    (localCanViewPage && accessQuery.isLoading) ||
    (accessQuery.data?.canView === true && dashboard.isLoading)
  ) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-cyan-500" />
          <p className="mt-3 text-sm font-medium text-slate-600">TikTok广告数据读取中…</p>
        </div>
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-3 text-xl font-bold text-slate-950">TikTok广告司令塔の閲覧権限がありません</h1>
          <p className="mt-2 text-sm text-slate-500">管理员或获授予此页面权限的广告负责人才能查看广告账户数据。</p>
          <Button className="mt-5" variant="outline" onClick={() => setLocation("/master/store-management")}>返回店铺管理</Button>
        </div>
      </div>
    );
  }

  if (!data || dashboard.error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-white p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-3 text-xl font-bold text-slate-950">TikTok广告数据を読み込めません</h1>
          <p className="mt-2 text-sm text-slate-500">读取失败，请稍后重试。[TIKTOK_ADS_DASHBOARD_UNAVAILABLE]</p>
          <Button className="mt-5" onClick={() => dashboard.refetch()}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="relative overflow-hidden border-b border-slate-800 bg-[#0b0f19] text-white">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLocation("/master/store-management")}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  aria-label="返回店铺管理"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 via-white to-pink-400 text-slate-950 shadow-lg shadow-cyan-500/10">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">TikTok广告司令塔</h1>
                    <span className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-semibold",
                      canOperate && writeEnabled
                        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                        : "border-white/15 bg-white/10 text-slate-200"
                    )}>
                      {canOperate && writeEnabled ? "受控操作可用" : canOperate ? "操作权限あり・接続待ち" : "查看模式"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">LCJ-01 · Campaign / 广告组 / 广告素材 / 绩效报表</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                data.source === "live"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-amber-300/30 bg-amber-300/10 text-amber-100"
              )}>
                {data.source === "live" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                <span className="font-semibold">{data.sourceLabel}</span>
              </div>
              <Button
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                onClick={() => dashboard.refetch()}
                disabled={dashboard.isFetching}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", dashboard.isFetching && "animate-spin")} />
                再读取
              </Button>
              <a href="https://ads.tiktok.com/i18n/home" target="_blank" rel="noreferrer">
                <Button className="bg-white text-slate-950 hover:bg-slate-100">
                  Ads Manager <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        {canOperate && !writeEnabled && (
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold text-slate-900">操作权限已分配，但生产写入链路尚未启用</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">当前可安全查看全部数据和操作设计。配置服务器专用Marketing API令牌及写入开关后，启停与符合条件的总预算调整按钮会开放；令牌不会进入浏览器。</p>
            </div>
          </div>
        )}
        {data.source === "snapshot" && (
          <div className={cn(
            "flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between",
            data.liveErrorCode ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
          )}>
            <div className="flex gap-3">
              <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", data.liveErrorCode ? "text-red-600" : "text-amber-600")} />
              <div>
                <p className="font-bold text-slate-900">当前显示已验证的真实快照，不是伪造数据</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  采集时间：{formatDateTime(data.snapshotCapturedAt)}。在Railway安全配置专用读取令牌后，本页会自动切换为TikTok Marketing API实时数据。
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">TikTok广告账户层级与Campaign层级的原始报表曝光合计相差1次；页面保留两份官方原始汇总值，不自行篡改。</p>
                {data.liveErrorCode && <p className="mt-1 font-mono text-xs text-red-700">{data.liveErrorCode}</p>}
              </div>
            </div>
            <div className="shrink-0 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
              广告账户：{data.advertiser.advertiserId}
            </div>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={CircleDollarSign} label="总花费" value={formatYen(metrics?.spend)} note="API全期间累计" accent="bg-cyan-50 text-cyan-700" />
          <MetricCard icon={Eye} label="曝光" value={formatCompact(metrics?.impressions)} note={`${formatNumber(metrics?.impressions)} impressions`} accent="bg-violet-50 text-violet-700" />
          <MetricCard icon={MousePointerClick} label="点击" value={formatCompact(metrics?.clicks)} note={`CTR ${formatPercent(metrics?.ctr)}`} accent="bg-blue-50 text-blue-700" />
          <MetricCard icon={Target} label="转化事件" value={formatCompact(metrics?.conversion)} note={`TikTok事件，不等于订单 · CPA ${formatYenRate(metrics?.costPerConversion)}`} accent="bg-emerald-50 text-emerald-700" />
          <MetricCard icon={Activity} label="Campaign" value={`${data.campaigns.length}`} note={`${activeCampaigns} 有效投放 · ${data.adgroups.length} 广告组 · ${data.ads.length} 广告`} accent="bg-pink-50 text-pink-700" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex overflow-x-auto border-b border-slate-200 px-2 pt-2">
            {TABS.filter(tab => tab.id !== "history" || canOperate).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveTab(tab.id); setSearch(""); }}
                  className={cn(
                    "flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition",
                    activeTab === tab.id ? "border-slate-950 text-slate-950" : "border-transparent text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Icon className="h-4 w-4" /> {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "overview" && (
            <div className="space-y-6 p-4 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="rounded-2xl bg-slate-950 p-5 text-white">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Advertiser</p>
                      <h2 className="mt-2 text-2xl font-black">{data.advertiser.name}</h2>
                      <p className="mt-1 font-mono text-xs text-slate-400">{data.advertiser.advertiserId}</p>
                    </div>
                    <AccountStatusBadge status={data.advertiser.status} />
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["国家", data.advertiser.country],
                      ["币种", data.advertiser.currency],
                      ["时区", data.advertiser.timezone],
                      ["账户角色", data.advertiser.role.replace("ROLE_", "")],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-slate-400">{label}</p>
                        <p className="mt-1 break-words text-sm font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <h2 className="font-bold">连接与数据边界</h2>
                  </div>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">当前来源</dt><dd className="text-right font-semibold">{data.source === "live" ? "服务器实时API" : "只读MCP快照"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">最后读取</dt><dd className="text-right font-semibold">{formatDateTime(data.lastSyncedAt)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">生产令牌</dt><dd className="text-right font-semibold">{data.liveConfigured ? "已配置（不显示）" : "未配置"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">当前权限</dt><dd className={cn("text-right font-semibold", canOperate ? "text-emerald-700" : "text-slate-700")}>{canOperate ? "查看＋受控操作" : "查看专用"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">写入链路</dt><dd className={cn("text-right font-semibold", writeEnabled ? "text-emerald-700" : "text-amber-700")}>{writeEnabled ? "已启用" : "未启用"}</dd></div>
                  </dl>
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-black">全期间花费排名</h2>
                    <p className="text-sm text-slate-500">按Campaign累计花费排序，显示Top 8；完整清单请看Campaign标签</p>
                  </div>
                  <p className="text-xs text-slate-500">最近30天当前无有效花费，历史累计仍完整保留</p>
                </div>
                <div className="space-y-3">
                  {data.campaigns.slice(0, 8).map((campaign, index) => {
                    const maxSpend = numberValue(data.campaigns[0]?.metrics.spend) || 1;
                    const percent = Math.max(1, (numberValue(campaign.metrics.spend) / maxSpend) * 100);
                    return (
                      <button key={campaign.campaignId} type="button" onClick={() => { setSearch(campaign.campaignId); setActiveTab("campaigns"); }} className="block w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/30">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{index + 1}</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">{campaign.campaignName}</p>
                              <p className="text-xs text-slate-500">{campaign.objectiveType} · {campaign.adCount}广告</p>
                            </div>
                          </div>
                          <p className="font-black">{formatYen(campaign.metrics.spend)}</p>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-pink-500" style={{ width: `${percent}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {(activeTab === "campaigns" || activeTab === "adgroups" || activeTab === "ads") && (
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black">
                    {activeTab === "campaigns" ? `Campaign ${data.campaigns.length}件` : activeTab === "adgroups" ? `广告组 ${data.adgroups.length}件` : `广告・素材 ${data.ads.length}件`}
                  </h2>
                  <p className="text-sm text-slate-500">
                    有效投放中：{activeTab === "campaigns" ? activeCampaigns : activeTab === "adgroups" ? activeAdgroups : activeAds}件
                  </p>
                </div>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="名称・ID・目标模糊搜索" className="pl-9" />
                </div>
              </div>

              {activeTab === "campaigns" && (
                filteredCampaigns.length === 0 ? <EmptyState text="没有符合条件的Campaign" /> : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-[1180px] w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                        <tr><th className="px-4 py-3">Campaign</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">目标</th><th className="px-4 py-3 text-right">花费</th><th className="px-4 py-3 text-right">曝光</th><th className="px-4 py-3 text-right">点击 / CTR</th><th className="px-4 py-3 text-right">转化 / CPA</th><th className="px-4 py-3">结构</th><th className="sticky right-0 z-10 border-l border-slate-200 bg-slate-50 px-4 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]">操作</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCampaigns.map(item => (
                          <tr key={item.campaignId} className="group hover:bg-slate-50/80">
                            <td className="px-4 py-3"><p className="max-w-[260px] truncate font-bold">{item.campaignName}</p><p className="font-mono text-[11px] text-slate-400">{item.campaignId}</p></td>
                            <td className="px-4 py-3"><DeliveryBadge state={campaignDeliveryStates.get(item.campaignId) ?? "paused"} /></td>
                            <td className="px-4 py-3"><p className="font-semibold text-slate-700">{item.objectiveType}</p><p className="text-xs text-slate-400">{item.budgetMode.replace("BUDGET_MODE_", "")}</p></td>
                            <td className="px-4 py-3 text-right font-bold">{formatYen(item.metrics.spend)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(item.metrics.impressions)}</td>
                            <td className="px-4 py-3 text-right"><p className="font-semibold">{formatNumber(item.metrics.clicks)}</p><p className="text-xs text-slate-400">{formatPercent(item.metrics.ctr)}</p></td>
                            <td className="px-4 py-3 text-right"><p className="font-semibold">{formatNumber(item.metrics.conversion)}</p><p className="text-xs text-slate-400">{formatYenRate(item.metrics.costPerConversion)}</p></td>
                            <td className="px-4 py-3"><p className="font-semibold">{item.adgroupCount}组 / {item.adCount}广告</p><p className="text-xs text-slate-400">更新 {item.modifyTime.slice(0, 10)}</p></td>
                            <td className="sticky right-0 border-l border-slate-100 bg-white px-4 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)] group-hover:bg-slate-50">
                              <div className="flex min-w-[170px] flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant={item.operationStatus === "ENABLE" ? "outline" : "default"}
                                  disabled={!canOperate || !writeEnabled}
                                  onClick={() => openStatusOperation({ entityType: "campaign", entityId: item.campaignId, entityName: item.campaignName, operationStatus: item.operationStatus, budget: item.budget, budgetMode: item.budgetMode }, item.operationStatus === "ENABLE" ? "DISABLE" : "ENABLE")}
                                >
                                  {item.operationStatus === "ENABLE" ? <PauseCircle className="mr-1.5 h-4 w-4" /> : <PlayCircle className="mr-1.5 h-4 w-4" />}
                                  {item.operationStatus === "ENABLE" ? "暂停" : "启用"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!canOperate || !writeEnabled || item.budgetMode !== "BUDGET_MODE_TOTAL"}
                                  onClick={() => openBudgetOperation({ entityType: "campaign", entityId: item.campaignId, entityName: item.campaignName, operationStatus: item.operationStatus, budget: item.budget, budgetMode: item.budgetMode })}
                                >
                                  <WalletCards className="mr-1.5 h-4 w-4" />预算
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {activeTab === "adgroups" && (
                filteredAdgroups.length === 0 ? <EmptyState text="没有符合条件的广告组" /> : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {filteredAdgroups.map(item => (
                      <article key={item.adgroupId} className="rounded-xl border border-slate-200 p-4 transition hover:border-cyan-300 hover:shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><p className="truncate font-bold">{item.adgroupName}</p><p className="mt-1 truncate text-xs text-slate-500">{item.campaignName}</p></div>
                          <DeliveryBadge state={adgroupDeliveryStates.get(item.adgroupId) ?? "paused"} />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-400">预算</p><p className="mt-1 font-bold">{formatYen(item.budget)}</p></div>
                          <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-400">优化</p><p className="mt-1 break-words font-bold">{item.optimizationGoal}</p></div>
                          <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-400">计费</p><p className="mt-1 font-bold">{item.billingEvent}</p></div>
                          <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-400">自动化</p><p className="mt-1 break-words font-bold">{item.campaignAutomationType}</p></div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{item.promotionType}</span><span>{item.placementType}</span><span className="font-mono">{item.adgroupId}</span></div>
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                          <Button
                            size="sm"
                            variant={item.operationStatus === "ENABLE" ? "outline" : "default"}
                            disabled={!canOperate || !writeEnabled}
                            onClick={() => openStatusOperation({ entityType: "adgroup", entityId: item.adgroupId, entityName: item.adgroupName, operationStatus: item.operationStatus, budget: item.budget, budgetMode: item.budgetMode }, item.operationStatus === "ENABLE" ? "DISABLE" : "ENABLE")}
                          >
                            {item.operationStatus === "ENABLE" ? <PauseCircle className="mr-1.5 h-4 w-4" /> : <PlayCircle className="mr-1.5 h-4 w-4" />}
                            {item.operationStatus === "ENABLE" ? "暂停广告组" : "启用广告组"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canOperate || !writeEnabled || item.budgetMode !== "BUDGET_MODE_TOTAL"}
                            onClick={() => openBudgetOperation({ entityType: "adgroup", entityId: item.adgroupId, entityName: item.adgroupName, operationStatus: item.operationStatus, budget: item.budget, budgetMode: item.budgetMode })}
                          >
                            <WalletCards className="mr-1.5 h-4 w-4" />总预算
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              )}

              {activeTab === "ads" && (
                filteredAds.length === 0 ? <EmptyState text="没有符合条件的广告・素材" /> : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {filteredAds.map(item => (
                      <article key={item.adId} className="rounded-xl border border-slate-200 p-4 transition hover:border-pink-300 hover:shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><p className="line-clamp-2 font-bold">{item.adName || "未命名广告"}</p><p className="mt-1 text-xs text-slate-500">{item.campaignName} / {item.adgroupName}</p></div>
                          <DeliveryBadge state={adDeliveryStates.get(item.adId) ?? "paused"} />
                        </div>
                        {item.adText && <p className="mt-3 line-clamp-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{item.adText}</p>}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {[item.adFormat, item.campaignAutomationType, item.displayName].filter(Boolean).map(value => <span key={value} className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{value}</span>)}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-400"><span className="font-mono">{item.adId}</span><span>{item.modifyTime ? `更新 ${item.modifyTime.slice(0, 10)}` : ""}</span></div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                          <p className="text-xs text-slate-400">广告层不设预算；预算在Campaign或广告组调整</p>
                          <Button
                            size="sm"
                            variant={item.operationStatus === "ENABLE" ? "outline" : "default"}
                            disabled={!canOperate || !writeEnabled}
                            onClick={() => openStatusOperation({ entityType: "ad", entityId: item.adId, entityName: item.adName || "未命名广告", operationStatus: item.operationStatus }, item.operationStatus === "ENABLE" ? "DISABLE" : "ENABLE")}
                          >
                            {item.operationStatus === "ENABLE" ? <PauseCircle className="mr-1.5 h-4 w-4" /> : <PlayCircle className="mr-1.5 h-4 w-4" />}
                            {item.operationStatus === "ENABLE" ? "暂停广告" : "启用广告"}
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {activeTab === "history" && canOperate && (
            <div className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">TikTok操作记录</h2>
                  <p className="mt-1 text-sm text-slate-500">预览、确认、TikTok request_id、实时复核结果均由服务器保存；不记录Access Token。</p>
                </div>
                <Button variant="outline" onClick={() => history.refetch()} disabled={history.isFetching}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", history.isFetching && "animate-spin")} />更新记录
                </Button>
              </div>
              {history.isLoading ? (
                <div className="flex justify-center py-16"><RefreshCw className="h-7 w-7 animate-spin text-cyan-600" /></div>
              ) : history.error ? (
                <EmptyState text="操作记录暂时无法读取" />
              ) : !history.data?.length ? (
                <EmptyState text="尚无TikTok广告操作记录" />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-[1050px] w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr><th className="px-4 py-3">时间 / 操作者</th><th className="px-4 py-3">对象</th><th className="px-4 py-3">操作</th><th className="px-4 py-3">理由</th><th className="px-4 py-3">结果</th><th className="px-4 py-3">TikTok request_id</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.data.map(item => (
                        <tr key={String(item.operationId)} className="align-top hover:bg-slate-50/80">
                          <td className="px-4 py-3"><p className="font-semibold">{String(item.actorName || `User #${item.actorUserId}`)}</p><p className="mt-1 text-xs text-slate-400">{formatDateTime(String(item.createdAt))}</p></td>
                          <td className="px-4 py-3"><p className="max-w-[240px] truncate font-bold">{String(item.entityName)}</p><p className="mt-1 font-mono text-[11px] text-slate-400">{String(item.entityType)} · {String(item.entityId)}</p></td>
                          <td className="px-4 py-3"><p className="font-semibold">{item.action === "status" ? `状态 → ${item.requestedStatus}` : `总预算 → ${formatYen(item.requestedBudget)}`}</p></td>
                          <td className="max-w-[300px] px-4 py-3 text-slate-600">{String(item.reason)}</td>
                          <td className="px-4 py-3"><OperationBadge status={String(item.status)} />{item.errorCode && <p className="mt-2 font-mono text-[10px] text-red-600">{String(item.errorCode)}</p>}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{item.tiktokRequestId ? String(item.tiktokRequestId) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "capabilities" && (
            <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h2 className="font-black">现在已实现</h2></div>
                <ul className="mt-4 space-y-3">
                  {data.capabilities.availableNow.map(item => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />{item}</li>)}
                </ul>
                <p className="mt-5 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-500">所有TikTok请求均由服务器执行。Access Token不进入浏览器、页面、日志或导出文件。</p>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" /><h2 className="font-black">受控操作能力</h2></div>
                <ul className="mt-4 space-y-3">
                  {[
                    "Campaign、广告组、广告：单对象启用/暂停",
                    "Campaign、广告组：符合条件的Lifetime Budget绝对值调整",
                    "每次操作均先实时预检、要求输入理由与确认短语，再实时复核结果",
                    "完整保存操作者、前后状态、TikTok request_id和安全错误码",
                  ].map(item => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-violet-500" />{item}</li>)}
                </ul>
                <p className="mt-5 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-500">删除、批量操作、自动优化、创意/定向编辑、Smart+/GMV Max/Dedicated Campaign等高风险操作继续禁用。超时或网络中断不会盲目重试，而是进入人工核对。</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5 lg:col-span-2">
                <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-slate-600" /><h2 className="font-black">数据注意事项</h2></div>
                <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                  <p className="rounded-xl bg-slate-50 p-3">TikTok基础报表通常存在约30分钟延迟，部分素材或搜索维度可能更晚。</p>
                  <p className="rounded-xl bg-slate-50 p-3">本账户当前{data.ads.length}个广告；实时接口分页元数据缺失或不完整时自动回退到已验证快照。</p>
                  <p className="rounded-xl bg-slate-50 p-3">本页不会自动执行任何写入；只有具备编辑权限的员工完成预览与二次确认后才会单次提交。删除永不提供。</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <Dialog open={Boolean(operationDraft)} onOpenChange={open => { if (!open) closeOperation(); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>TikTok广告操作确认</DialogTitle>
          </DialogHeader>
          {operationDraft && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{operationDraft.target.entityType}</p>
                    <p className="mt-1 font-black text-slate-950">{operationDraft.target.entityName}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{operationDraft.target.entityId}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                    {operationDraft.action === "status"
                      ? `${operationDraft.target.operationStatus} → ${operationDraft.operationStatus}`
                      : `总预算 → ${formatYen(Number(operationDraft.budget || 0))}`}
                  </span>
                </div>
              </div>

              {operationDraft.action === "budget" && (
                <div>
                  <label className="text-sm font-bold text-slate-700">新总预算（JPY・绝对值）</label>
                  <Input
                    type="number"
                    min={1000}
                    max={10_000_000}
                    step={1}
                    value={operationDraft.budget ?? ""}
                    disabled={Boolean(operationPreview)}
                    onChange={event => setOperationDraft({ ...operationDraft, budget: event.target.value })}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs leading-5 text-slate-500">不是增减额。执行前会重新读取累计花费；新预算必须不低于累计花费的105%，且首版只支持Lifetime Budget。</p>
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-slate-700">操作理由（必填）</label>
                <Textarea
                  value={operationReason}
                  disabled={Boolean(operationPreview)}
                  onChange={event => setOperationReason(event.target.value)}
                  placeholder="例如：本日直播结束，按运营负责人指示暂停投放"
                  className="mt-2 min-h-24"
                  maxLength={500}
                />
                <p className="mt-1 text-right text-xs text-slate-400">{operationReason.trim().length}/500</p>
              </div>

              {!operationPreview ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  点击“生成确认预览”只会读取TikTok最新状态并保存审计草稿，不会修改广告。预览通过后还需再次输入确认短语。
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                    <div className="flex items-center gap-2 text-cyan-900"><ShieldCheck className="h-5 w-5" /><p className="font-black">实时预检已完成</p></div>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-lg bg-white/70 p-3"><dt className="text-xs text-slate-500">当前状态</dt><dd className="mt-1 font-bold">{String(operationPreview.beforeState.target.operationStatus)}</dd></div>
                      <div className="rounded-lg bg-white/70 p-3"><dt className="text-xs text-slate-500">当前预算</dt><dd className="mt-1 font-bold">{operationPreview.beforeState.target.budget == null ? "—" : formatYen(operationPreview.beforeState.target.budget)}</dd></div>
                      <div className="rounded-lg bg-white/70 p-3"><dt className="text-xs text-slate-500">广告账户</dt><dd className="mt-1 font-bold">{String(operationPreview.beforeState.advertiser.name)}</dd></div>
                      <div className="rounded-lg bg-white/70 p-3"><dt className="text-xs text-slate-500">确认有效期</dt><dd className="mt-1 font-bold">{formatDateTime(operationPreview.expiresAt)}</dd></div>
                    </dl>
                    {operationPreview.beforeState.warnings?.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs text-amber-800">
                        {operationPreview.beforeState.warnings.map((warning: string) => <li key={warning}>・{warning}</li>)}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
                    这会向TikTok Marketing API提交一次真实写入。系统不会自动重试；若结果不明确，会标记为“需要人工核对”。删除、批量、自动投放不在本操作范围内。
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700">请输入「{operationPreview.confirmationText}」</label>
                    <Input value={confirmationInput} onChange={event => setConfirmationInput(event.target.value)} className="mt-2" autoComplete="off" />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeOperation} disabled={previewOperation.isPending || executeOperation.isPending}>取消</Button>
            {!operationPreview ? (
              <Button
                onClick={submitPreview}
                disabled={
                  previewOperation.isPending || operationReason.trim().length < 8 ||
                  (operationDraft?.action === "budget" && (!Number.isFinite(Number(operationDraft.budget)) || Number(operationDraft.budget) < 1000))
                }
              >
                {previewOperation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}生成确认预览
              </Button>
            ) : (
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={submitExecution}
                disabled={executeOperation.isPending || confirmationInput !== operationPreview.confirmationText}
              >
                {executeOperation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}执行并实时复核
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
