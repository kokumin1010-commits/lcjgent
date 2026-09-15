import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeJapaneseYen,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Megaphone,
  Pencil,
  Store,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function money(value: number | null | undefined) {
  return value === null || value === undefined
    ? "未上传"
    : `¥${Math.round(value).toLocaleString()}`;
}

function count(value: number | null | undefined) {
  return value === null || value === undefined
    ? "未接入"
    : Math.round(value).toLocaleString();
}

function reportStatus(status: string) {
  if (status === "confirmed")
    return { label: "已确认", className: "bg-emerald-100 text-emerald-700" };
  if (status === "submitted")
    return { label: "已提交", className: "bg-blue-100 text-blue-700" };
  if (status === "draft" || status === "reopened")
    return { label: "待补充", className: "bg-amber-100 text-amber-700" };
  return { label: "今日未提交", className: "bg-red-100 text-red-700" };
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "slate",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "orange" | "blue" | "violet" | "emerald" | "rose" | "slate";
}) {
  const tones = {
    orange: "border-orange-100 bg-orange-50 text-orange-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    violet: "border-violet-100 bg-violet-50 text-violet-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold opacity-80">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] opacity-70">{detail}</p>
    </div>
  );
}

export function StoreBusinessOverview({
  data,
  isLoading,
  errorMessage,
  year,
  month,
  onYearChange,
  onMonthChange,
  onOpenStore,
  onEditStore,
}: {
  data: any;
  isLoading: boolean;
  errorMessage?: string;
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onOpenStore: (storeId: number) => void;
  onEditStore: (storeId: number) => void;
}) {
  if (isLoading)
    return (
      <div className="rounded-2xl border border-orange-100 bg-white p-12 text-center text-sm text-slate-500">
        正在汇总服务品牌经营数据...
      </div>
    );
  if (errorMessage)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-bold">经营数据读取失败</p>
        <p className="mt-1">{errorMessage}</p>
      </div>
    );
  const totals = data?.totals || {};
  const brands = data?.brands || [];
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#7c2d12_0%,#ea580c_55%,#f59e0b_100%)] p-6 text-white shadow-xl shadow-orange-200/50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-100">
              Service Brand Command Center
            </p>
            <h2 className="mt-2 text-2xl font-black">服务品牌经营总览</h2>
            <p className="mt-1 text-sm text-orange-100">
              结果数据与店长日报执行数据统一呈现；缺失数据不会伪装成0。
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-2 backdrop-blur-sm">
            <select
              value={year}
              onChange={event => onYearChange(Number(event.target.value))}
              className="rounded-lg border border-white/20 bg-white/15 px-3 py-2 text-sm text-white outline-none"
            >
              {[2024, 2025, 2026, 2027].map(value => (
                <option key={value} value={value} className="text-slate-900">
                  {value}年
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={event => onMonthChange(Number(event.target.value))}
              className="rounded-lg border border-white/20 bg-white/15 px-3 py-2 text-sm text-white outline-none"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                value => (
                  <option key={value} value={value} className="text-slate-900">
                    {value}月
                  </option>
                )
              )}
            </select>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div className="rounded-2xl bg-white/12 p-4">
            <p className="text-xs text-orange-100">总GMV</p>
            <p className="mt-1 text-xl font-black">{money(totals.storeGmv)}</p>
          </div>
          <div className="rounded-2xl bg-white/12 p-4">
            <p className="text-xs text-orange-100">实际销售额</p>
            <p className="mt-1 text-xl font-black">
              {money(totals.actualSales)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/12 p-4">
            <p className="text-xs text-orange-100">广告消费</p>
            <p className="mt-1 text-xl font-black">{money(totals.adSpend)}</p>
          </div>
          <div className="rounded-2xl bg-white/12 p-4">
            <p className="text-xs text-orange-100">广告ROAS</p>
            <p className="mt-1 text-xl font-black">
              {totals.adRoas === null || totals.adRoas === undefined
                ? "未接入"
                : `${Number(totals.adRoas).toFixed(2)}x`}
            </p>
          </div>
          <div className="rounded-2xl bg-white/12 p-4">
            <p className="text-xs text-orange-100">达人建联</p>
            <p className="mt-1 text-xl font-black">
              {count(totals.creatorOutreach)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/12 p-4">
            <p className="text-xs text-orange-100">经营风险</p>
            <p className="mt-1 text-xl font-black">
              {Number(totals.blockedCount || 0) +
                Number(totals.overdueCount || 0)}
            </p>
          </div>
        </div>
      </section>

      {brands.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-slate-500">
          暂无活动店铺，请先添加店铺并关联服务品牌。
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {brands.map((brand: any) => {
            const status = reportStatus(brand.todayReportStatus);
            return (
              <section
                key={brand.key}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-orange-600" />
                      <h3 className="text-lg font-black text-slate-900">
                        {brand.name}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {brand.stores.length} 个店铺 ·{" "}
                      {brand.isLinkedBrand ? "已关联服务品牌" : "尚未绑定品牌"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4">
                  <MetricCard
                    icon={<BadgeJapaneseYen className="h-3.5 w-3.5" />}
                    label="总GMV"
                    value={money(brand.metrics.storeGmv)}
                    detail={`实际销售 ${money(brand.metrics.actualSales)}`}
                    tone="orange"
                  />
                  <MetricCard
                    icon={<Megaphone className="h-3.5 w-3.5" />}
                    label="广告消费"
                    value={money(brand.metrics.adSpend)}
                    detail={`ROAS ${brand.metrics.adRoas === null ? "未接入" : `${Number(brand.metrics.adRoas).toFixed(2)}x`}`}
                    tone="violet"
                  />
                  <MetricCard
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="达人建联"
                    value={count(brand.metrics.creatorOutreach)}
                    detail={`回复 ${count(brand.metrics.creatorReplies)} · 合作 ${count(brand.metrics.creatorCollaborations)}`}
                    tone="blue"
                  />
                  <MetricCard
                    icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                    label="今日执行"
                    value={`${brand.reportSummary.submittedStores}/${brand.stores.length}`}
                    detail={`风险 ${brand.reportSummary.riskCount} · 支持 ${brand.reportSummary.supportCount}`}
                    tone={
                      brand.reportSummary.missingStores ? "rose" : "emerald"
                    }
                  />
                </div>
                <div className="mx-4 mb-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    今日完成 {brand.reportSummary.completedCount}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                    明日重点 {brand.reportSummary.tomorrowCount}
                  </span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                    风险店铺 {brand.reportSummary.riskCount}
                  </span>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">
                    待支持 {brand.reportSummary.supportCount}
                  </span>
                </div>
                {(brand.execution.blockedCount > 0 ||
                  brand.execution.overdueCount > 0 ||
                  !brand.isLinkedBrand) && (
                  <div className="mx-4 mb-3 flex flex-wrap gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    {!brand.isLinkedBrand && (
                      <span>需绑定服务品牌后才能汇总广告与达人数据。</span>
                    )}
                    {brand.execution.blockedCount > 0 && (
                      <span>阻塞任务 {brand.execution.blockedCount}</span>
                    )}
                    {brand.execution.overdueCount > 0 && (
                      <span>逾期任务 {brand.execution.overdueCount}</span>
                    )}
                  </div>
                )}
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {brand.stores.map((store: any) => {
                    const storeStatus = reportStatus(store.todayReport.status);
                    return (
                      <div
                        key={store.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-orange-50/50"
                      >
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-orange-100 text-orange-700">
                          {store.avatarUrl ? (
                            <img
                              src={store.avatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Store className="h-4 w-4" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenStore(store.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-bold text-slate-800">
                            {store.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {store.platform} · {store.country} ·{" "}
                            {store.operatorName || "负责人未指定"}
                          </p>
                        </button>
                        <div className="hidden text-right md:block">
                          <p className="text-xs font-bold text-slate-800">
                            {money(store.metrics.storeGmv.value)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {store.metrics.storeGmv.sourceLabel}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${storeStatus.className}`}
                        >
                          {storeStatus.label}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditStore(store.id)}
                          aria-label={`编辑${store.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onOpenStore(store.id)}
                          aria-label={`打开${store.name}`}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-black text-slate-900">
              <BarChart3 className="h-5 w-5 text-orange-600" />
              数据口径
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              店铺GMV与广告归因GMV分开；达人建联按去重达人计算，联系次数单独统计。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            当前期间 {data?.period?.month || ""}
          </div>
        </div>
      </section>
    </div>
  );
}
