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
  ExternalLink,
  Eye,
  Layers3,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function TikTokAdsIntegration() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [search, setSearch] = useState("");
  const permissionsQuery = trpc.rbac.myPermissions.useQuery(undefined, {
    enabled: Boolean(user) && user?.role !== "admin",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const canViewPage = canViewDepartmentMenuItem({
    path: "/master/tiktok-ads",
    userRole: user?.role,
    permissionsData: user?.role === "admin"
      ? { isAdmin: true, permissions: null }
      : permissionsQuery.data,
    permissionsLoading: permissionsQuery.isLoading,
  });
  const dashboard = trpc.tiktokAds.dashboard.useQuery(undefined, {
    enabled: canViewPage,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const data = dashboard.data;

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

  if (authLoading || (user?.role !== "admin" && permissionsQuery.isLoading) || (canViewPage && dashboard.isLoading)) {
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
          <h1 className="mt-3 text-xl font-bold text-slate-950">TikTok广告连携の閲覧権限がありません</h1>
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
                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">TikTok广告连携</h1>
                    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">只读安全模式</span>
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
            {TABS.map(tab => {
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
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">当前权限</dt><dd className="text-right font-semibold text-emerald-700">读取专用</dd></div>
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
                    <table className="min-w-[980px] w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                        <tr><th className="px-4 py-3">Campaign</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">目标</th><th className="px-4 py-3 text-right">花费</th><th className="px-4 py-3 text-right">曝光</th><th className="px-4 py-3 text-right">点击 / CTR</th><th className="px-4 py-3 text-right">转化 / CPA</th><th className="px-4 py-3">结构</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCampaigns.map(item => (
                          <tr key={item.campaignId} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3"><p className="max-w-[260px] truncate font-bold">{item.campaignName}</p><p className="font-mono text-[11px] text-slate-400">{item.campaignId}</p></td>
                            <td className="px-4 py-3"><DeliveryBadge state={campaignDeliveryStates.get(item.campaignId) ?? "paused"} /></td>
                            <td className="px-4 py-3"><p className="font-semibold text-slate-700">{item.objectiveType}</p><p className="text-xs text-slate-400">{item.budgetMode.replace("BUDGET_MODE_", "")}</p></td>
                            <td className="px-4 py-3 text-right font-bold">{formatYen(item.metrics.spend)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(item.metrics.impressions)}</td>
                            <td className="px-4 py-3 text-right"><p className="font-semibold">{formatNumber(item.metrics.clicks)}</p><p className="text-xs text-slate-400">{formatPercent(item.metrics.ctr)}</p></td>
                            <td className="px-4 py-3 text-right"><p className="font-semibold">{formatNumber(item.metrics.conversion)}</p><p className="text-xs text-slate-400">{formatYenRate(item.metrics.costPerConversion)}</p></td>
                            <td className="px-4 py-3"><p className="font-semibold">{item.adgroupCount}组 / {item.adCount}广告</p><p className="text-xs text-slate-400">更新 {item.modifyTime.slice(0, 10)}</p></td>
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
                      </article>
                    ))}
                  </div>
                )
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
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" /><h2 className="font-black">API还可以扩展</h2></div>
                <ul className="mt-4 space-y-3">
                  {data.capabilities.availableWithWriteApproval.map(item => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-violet-500" />{item}</li>)}
                </ul>
                <p className="mt-5 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-500">写入会直接影响预算和广告投放，因此当前页面保持只读；以后启用时应加入角色权限、差分确认、审计记录与失败回滚。</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5 lg:col-span-2">
                <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-slate-600" /><h2 className="font-black">数据注意事项</h2></div>
                <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                  <p className="rounded-xl bg-slate-50 p-3">TikTok基础报表通常存在约30分钟延迟，部分素材或搜索维度可能更晚。</p>
                  <p className="rounded-xl bg-slate-50 p-3">本账户当前{data.ads.length}个广告；实时接口分页元数据缺失或不完整时自动回退到已验证快照。</p>
                  <p className="rounded-xl bg-slate-50 p-3">预算、启停、删除等操作不会由本页自动执行，避免误投放和不可逆操作。</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
