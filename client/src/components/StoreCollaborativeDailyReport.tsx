import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  History,
  Loader2,
  RefreshCw,
  Save,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createEmptyStoreDailyReportPayload,
  normalizeStoreDailyReportPayload,
  type StoreDailyCoreData,
  type StoreDailyReportPayload,
} from "@shared/storeBusiness";

const CORE_FIELDS: Array<{
  key: keyof StoreDailyCoreData;
  label: string;
  unit: string;
}> = [
  { key: "totalGmv", label: "总GMV", unit: "¥" },
  { key: "actualSales", label: "实际销售额", unit: "¥" },
  { key: "refundAmount", label: "退款金额", unit: "¥" },
  { key: "adSpend", label: "广告消费", unit: "¥" },
  { key: "creatorOutreach", label: "达人建联人数", unit: "人" },
  { key: "creatorContactCount", label: "达人联系次数", unit: "次" },
  { key: "creatorReplies", label: "达人回复人数", unit: "人" },
  { key: "creatorCollaborations", label: "达人合作确认", unit: "人" },
];

function japanToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
    new Date()
  );
}

function reportDateKey(value: unknown) {
  if (typeof value === "string") {
    const direct = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (direct) return direct;
  }
  const parsed = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(parsed);
}

function textLines(value: string) {
  return value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
}

function listText(items: Array<Record<string, unknown>>, fields: string[]) {
  return items
    .map(item => fields.map(field => String(item[field] ?? "")).join("|"))
    .join("\n");
}

function parseOwnerItems(value: string) {
  return textLines(value).map(line => {
    const [title = "", ownerName = "", dueDate = "", priority = "medium"] = line
      .split("|")
      .map(item => item.trim());
    return {
      title,
      ownerStaffId: null,
      ownerName,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
      priority: ["low", "medium", "high", "critical"].includes(priority)
        ? (priority as "low" | "medium" | "high" | "critical")
        : ("medium" as const),
    };
  });
}

function FieldLabel({
  label,
  source,
  required = false,
}: {
  label: string;
  source?: any;
  required?: boolean;
}) {
  const status = source?.status;
  const classes =
    status === "actual"
      ? "bg-emerald-100 text-emerald-700"
      : status === "adjusted"
        ? "bg-amber-100 text-amber-700"
        : status === "manual"
          ? "bg-blue-100 text-blue-700"
          : "bg-slate-100 text-slate-500";
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {source && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${classes}`}>
          {source.sourceLabel || "未上传"}
        </span>
      )}
    </div>
  );
}

function AutomaticMetricCard({
  label,
  value,
  source,
  unit,
}: {
  label: string;
  value: number | null;
  source?: any;
  unit: string;
}) {
  const available = value !== null && Number.isFinite(Number(value));
  const display = available
    ? `${unit === "¥" ? "¥" : ""}${Number(value).toLocaleString()}${unit === "¥" ? "" : unit}`
    : "—";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <FieldLabel label={label} source={source} />
      <p className={`text-xl font-black ${available ? "text-slate-900" : "text-slate-400"}`}>
        {display}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">
        {available ? "由系统数据自动更新" : "该日期暂无导入数据"}
      </p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  source,
  required = false,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  source?: any;
  required?: boolean;
  suffix?: string;
}) {
  return (
    <label className="block">
      <FieldLabel label={label} source={source} required={required} />
      <div className="relative">
        <Input
          type="number"
          min={0}
          step="any"
          value={value ?? ""}
          onChange={event =>
            onChange(
              event.target.value === ""
                ? null
                : Math.max(0, Number(event.target.value))
            )
          }
          className="pr-12"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StoreCollaborativeDailyReport({
  storeId,
  onSaved,
}: {
  storeId: number;
  onSaved?: () => void;
}) {
  const [reportDate, setReportDate] = useState(japanToday());
  const [payload, setPayload] = useState<StoreDailyReportPayload>(
    createEmptyStoreDailyReportPayload()
  );
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [historyMonth, setHistoryMonth] = useState(japanToday().slice(0, 7));
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const utils = trpc.useUtils();
  const reportQuery = trpc.storeDailyReport.get.useQuery({
    storeId,
    reportDate,
  });
  const queryReport = reportQuery.data?.report as any | null | undefined;
  const historyQuery = trpc.storeDailyReport.history.useQuery(
    { storeId, reportDate },
    { enabled: Boolean(queryReport?.id) }
  );
  const [historyYear, historyMonthNumber] = historyMonth.split("-").map(Number);
  const monthHistoryQuery = trpc.storeDailyReport.listMonth.useQuery({
    storeId,
    year: historyYear,
    month: historyMonthNumber,
  });
  const saveMutation = trpc.storeDailyReport.save.useMutation();

  useEffect(() => {
    if (!reportQuery.data || dirty) return;
    setPayload(
      normalizeStoreDailyReportPayload(reportQuery.data.initialPayload)
    );
    setExpectedVersion(Number((reportQuery.data.report as any)?.versionNumber || 0));
  }, [reportQuery.data, dirty]);

  const report = queryReport;
  const canEdit = Boolean(reportQuery.data?.canEdit);
  const saving = saveMutation.isPending;
  const monthReports = useMemo(() => {
    const master = (monthHistoryQuery.data?.masterReports || []).map((item: any) => ({
      key: `master-${item.id}`,
      date: reportDateKey(item.reportDate),
      kind: "协作日报",
      detail: `v${Number(item.versionNumber || 0)} · ${item.updatedByName || item.submittedByName || "已保存"}`,
      updatedAt: item.updatedAt || item.submittedAt || null,
    }));
    const legacy = (monthHistoryQuery.data?.legacyReports || []).map((item: any) => ({
      key: `legacy-${item.id}`,
      date: reportDateKey(item.periodStart),
      kind: "历史个人日报",
      detail: item.submitterName || item.createdByName || "历史记录",
      updatedAt: item.createdAt || null,
    }));
    return [...master, ...legacy].sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
    );
  }, [monthHistoryQuery.data]);

  const change = (
    updater: (current: StoreDailyReportPayload) => StoreDailyReportPayload
  ) => {
    setPayload(current => updater(current));
    setDirty(true);
    setNotice("");
  };

  const save = async () => {
    setNotice("");
    try {
      const result = await saveMutation.mutateAsync({
        storeId,
        reportDate,
        expectedVersion,
        payload,
      });
      setExpectedVersion(result.versionNumber);
      setDirty(false);
      setNotice("已保存并直接生效，不需要确认。");
      await Promise.all([
        utils.storeDailyReport.get.invalidate({ storeId, reportDate }),
        utils.storeDailyReport.history.invalidate({ storeId, reportDate }),
        utils.storeDailyReport.listMonth.invalidate(),
        utils.storeExecution.dailyCompliance.invalidate(),
        utils.storeExecution.managementOverview.invalidate(),
        utils.storeManagement.businessOverview.invalidate(),
      ]);
      onSaved?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      setNotice(
        message.includes("CONFLICT") || message.includes("更新")
          ? `${message} 当前内容未覆盖服务器版本。`
          : message
      );
    }
  };

  const sectionSave = canEdit ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={saving || !dirty}
      onClick={save}
    >
      {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
      保存本区
    </Button>
  ) : null;

  if (reportQuery.isLoading)
    return (
      <div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        正在读取协作日报...
      </div>
    );
  if (reportQuery.error)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {reportQuery.error.message}
      </div>
    );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[linear-gradient(135deg,#0f172a,#334155)] p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Collaborative Daily Report
            </p>
            <h2 className="mt-1 text-xl font-black">
              每店每日一份协作式店长日报
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              多人共用同一主日报；版本号和字段修改人自动留痕。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={reportDate}
              onChange={event => {
                setDirty(false);
                setReportDate(event.target.value);
                setNotice("");
              }}
              className="w-40 border-white/20 bg-white/10 text-white"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDirty(false);
                reportQuery.refetch();
              }}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              刷新
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-3 py-1">
            版本 v{expectedVersion || 0}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1">
            状态：{report ? "已保存并生效" : "尚未填写"}
          </span>
          {report?.updatedByName && (
            <span className="rounded-full bg-white/10 px-3 py-1">
              最后编辑：{report.updatedByName}
            </span>
          )}
          <span className="rounded-full bg-white/10 px-3 py-1">
            数据截止 {payload.cutoffTime}
          </span>
        </div>
      </section>

      <Section
        title="自动经营数据"
        description="由每天导入的店铺、商品、广告数据及系统记录自动更新；这里无需填写，也不会因缺少某项而阻止日报保存。"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CORE_FIELDS.map(field => (
            <AutomaticMetricCard
              key={field.key}
              label={field.label}
              value={payload.core[field.key]}
              source={payload.metricMeta[field.key]}
              unit={field.unit}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          <span>自动数据只读；如当日尚未导入，对应项目显示“—”，仍可填写并保存其他日报内容。</span>
          <span className="font-semibold">数据截止 {payload.cutoffTime}</span>
        </div>
      </Section>

      <Section
        title="内容与直播"
        description="任意填写一项即可保存；未填写项目保留现状，不需要等待其他人确认。"
        action={sectionSave}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["liveSessions", "直播场次", "场"],
            ["liveMinutes", "直播时长", "分钟"],
            ["liveGmv", "直播GMV", "¥"],
            ["shortVideos", "短视频数量", "条"],
            ["shortVideoGmv", "短视频GMV", "¥"],
          ].map(([key, label, suffix]) => (
            <NumberField
              key={key}
              label={label}
              value={(payload.content as any)[key]}
              onChange={value =>
                change(current => ({
                  ...current,
                  content: { ...current.content, [key]: value || 0 },
                }))
              }
              suffix={suffix}
            />
          ))}
        </div>
      </Section>

      <Section
        title="商品、链接与客户反馈"
        description="链接和调价每行一条，使用竖线分隔字段；任意项目可独立填写并保存。"
        action={sectionSave}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField
            label="链接优化"
            value={payload.products.linkOptimizations}
            onChange={value =>
              change(current => ({
                ...current,
                products: {
                  ...current.products,
                  linkOptimizations: value || 0,
                },
              }))
            }
            suffix="条"
          />
          <NumberField
            label="新增链接"
            value={payload.products.newLinks}
            onChange={value =>
              change(current => ({
                ...current,
                products: { ...current.products, newLinks: value || 0 },
              }))
            }
            suffix="条"
          />
          <NumberField
            label="库存修改"
            value={payload.products.inventoryChanges}
            onChange={value =>
              change(current => ({
                ...current,
                products: { ...current.products, inventoryChanges: value || 0 },
              }))
            }
            suffix="次"
          />
          <NumberField
            label="差评数量"
            value={payload.products.negativeReviews}
            onChange={value =>
              change(current => ({
                ...current,
                products: { ...current.products, negativeReviews: value || 0 },
              }))
            }
            suffix="条"
          />
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={payload.products.negativeReviewHandled}
              onChange={event =>
                change(current => ({
                  ...current,
                  products: {
                    ...current.products,
                    negativeReviewHandled: event.target.checked,
                  },
                }))
              }
            />
            差评已处理
          </label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label>
            <FieldLabel label="商品链接（名称|URL|可售/不可售）" />
            <textarea
              rows={4}
              value={listText(payload.products.links as any, [
                "name",
                "url",
                "readyToSell",
              ])}
              onChange={event =>
                change(current => ({
                  ...current,
                  products: {
                    ...current.products,
                    links: textLines(event.target.value).map(line => {
                      const [name = "", url = "", state = "可售"] = line
                        .split("|")
                        .map(item => item.trim());
                      return {
                        name,
                        url,
                        readyToSell: state !== "不可售" && state !== "false",
                      };
                    }),
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <label>
            <FieldLabel label="调价记录（SKU|原因）" />
            <textarea
              rows={4}
              value={listText(payload.products.priceChanges as any, [
                "sku",
                "reason",
              ])}
              onChange={event =>
                change(current => ({
                  ...current,
                  products: {
                    ...current.products,
                    priceChanges: textLines(event.target.value).map(line => {
                      const [sku = "", reason = ""] = line
                        .split("|")
                        .map(item => item.trim());
                      return { sku, reason };
                    }),
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <label className="md:col-span-2">
            <FieldLabel label="客户咨询热点" />
            <textarea
              rows={3}
              value={payload.products.customerQuestions}
              onChange={event =>
                change(current => ({
                  ...current,
                  products: {
                    ...current.products,
                    customerQuestions: event.target.value,
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
            />
          </label>
        </div>
      </Section>

      <Section
        title="供应链与库存"
        description="补货：SKU|数量|负责人；风险：SKU|原因|负责人。任意项目可独立填写并保存。"
        action={sectionSave}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <FieldLabel label="补货SKU" />
            <textarea
              rows={4}
              value={listText(payload.supply.replenishments as any, [
                "sku",
                "quantity",
                "ownerName",
              ])}
              onChange={event =>
                change(current => ({
                  ...current,
                  supply: {
                    ...current.supply,
                    replenishments: textLines(event.target.value).map(line => {
                      const [sku = "", quantity = "0", ownerName = ""] = line
                        .split("|")
                        .map(item => item.trim());
                      return {
                        sku,
                        quantity: Math.max(0, Number(quantity) || 0),
                        ownerStaffId: null,
                        ownerName,
                      };
                    }),
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <label>
            <FieldLabel label="风险SKU" />
            <textarea
              rows={4}
              value={listText(payload.supply.riskSkus as any, [
                "sku",
                "reason",
                "ownerName",
              ])}
              onChange={event =>
                change(current => ({
                  ...current,
                  supply: {
                    ...current.supply,
                    riskSkus: textLines(event.target.value).map(line => {
                      const [sku = "", reason = "", ownerName = ""] = line
                        .split("|")
                        .map(item => item.trim());
                      return { sku, reason, ownerStaffId: null, ownerName };
                    }),
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <NumberField
            label="收样数量"
            value={payload.supply.samplesReceived}
            onChange={value =>
              change(current => ({
                ...current,
                supply: { ...current.supply, samplesReceived: value || 0 },
              }))
            }
            suffix="件"
          />
          <NumberField
            label="寄样数量"
            value={payload.supply.samplesSent}
            onChange={value =>
              change(current => ({
                ...current,
                supply: { ...current.supply, samplesSent: value || 0 },
              }))
            }
            suffix="件"
          />
        </div>
      </Section>

      <Section
        title="今日执行与明日闭环"
        description="保存后，明日重点和支持事项会直接同步进入店铺Todo；不需要审批。格式：事项|负责人|YYYY-MM-DD|优先级。"
        action={sectionSave}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <FieldLabel label="今日已完成（一行一项）" />
            <textarea
              rows={5}
              value={payload.execution.completedItems.join("\n")}
              onChange={event =>
                change(current => ({
                  ...current,
                  execution: {
                    ...current.execution,
                    completedItems: textLines(event.target.value),
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <label>
            <FieldLabel label="问题与风险" />
            <textarea
              rows={5}
              value={payload.execution.issuesRisks}
              onChange={event =>
                change(current => ({
                  ...current,
                  execution: {
                    ...current.execution,
                    issuesRisks: event.target.value,
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <label>
            <FieldLabel label="已采取措施" />
            <textarea
              rows={5}
              value={payload.execution.actionsTaken}
              onChange={event =>
                change(current => ({
                  ...current,
                  execution: {
                    ...current.execution,
                    actionsTaken: event.target.value,
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
            />
          </label>
          <label>
            <FieldLabel label="明日重点" />
            <textarea
              rows={5}
              value={listText(payload.execution.tomorrowItems as any, [
                "title",
                "ownerName",
                "dueDate",
                "priority",
              ])}
              onChange={event =>
                change(current => ({
                  ...current,
                  execution: {
                    ...current.execution,
                    tomorrowItems: parseOwnerItems(event.target.value),
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
              placeholder="跟进达人回复|张三|2026-09-16|high"
            />
          </label>
          <label className="md:col-span-2">
            <FieldLabel label="需要公司／老板支持" />
            <textarea
              rows={4}
              value={listText(payload.execution.supportItems as any, [
                "title",
                "ownerName",
                "dueDate",
                "priority",
              ])}
              onChange={event =>
                change(current => ({
                  ...current,
                  execution: {
                    ...current.execution,
                    supportItems: parseOwnerItems(event.target.value),
                  },
                }))
              }
              className="w-full rounded-lg border p-3 text-sm"
              placeholder="审批补货预算|负责人|2026-09-16|critical"
            />
          </label>
        </div>
      </Section>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${notice.includes("失败") || notice.includes("更新") || notice.includes("必须") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {notice}
        </div>
      )}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Users className="h-4 w-4" />
          {canEdit ? "任意填写一项即可保存，保存后立即生效" : "当前为只读模式"}
          {dirty && (
            <span className="font-bold text-amber-600">· 有未保存修改</span>
          )}
        </div>
        {canEdit && (
          <Button
            type="button"
            disabled={saving || !dirty}
            onClick={save}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            保存日报
          </Button>
        )}
      </div>

      <Section
        title="历史日报"
        description="按月份查看协作主日报和旧版个人日报；点击日期即可回看当天全部内容。"
        action={
          <Input
            type="month"
            value={historyMonth}
            onChange={event => {
              if (/^\d{4}-\d{2}$/.test(event.target.value)) {
                setHistoryMonth(event.target.value);
              }
            }}
            className="w-40"
          />
        }
      >
        {monthHistoryQuery.isLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
            正在读取历史日报...
          </div>
        ) : monthReports.length ? (
          <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
            {monthReports.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (dirty) {
                    setNotice("请先保存当前修改，再切换历史日期。");
                    return;
                  }
                  setReportDate(item.date);
                  setNotice("");
                }}
                className={`rounded-xl border p-3 text-left transition hover:border-orange-300 hover:bg-orange-50 ${item.date === reportDate ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-sm font-black text-slate-800">
                    <CalendarDays className="h-4 w-4 text-orange-500" />
                    {item.date}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {item.kind}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{item.detail}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
            该月暂无日报记录。
          </p>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="版本与字段留痕"
          description="每次保存产生不可变版本，显示字段最后由谁修改。"
        >
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {(historyQuery.data?.versions || []).map((version: any) => (
              <div
                key={version.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
              >
                <span>v{version.versionNumber} · 已保存</span>
                <span className="text-slate-500">
                  {version.actorName || "-"} ·{" "}
                  {version.createdAt
                    ? new Date(version.createdAt).toLocaleString()
                    : ""}
                </span>
              </div>
            ))}
            {(historyQuery.data?.versions || []).length === 0 && (
              <p className="text-xs text-slate-400">该日期尚无协作日报版本。</p>
            )}
          </div>
          {(historyQuery.data?.audits || []).length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="mb-2 flex items-center gap-1 text-xs font-bold text-slate-600">
                <History className="h-4 w-4" />
                最近字段修改
              </p>
              {historyQuery.data!.audits.slice(0, 12).map((audit: any) => (
                <p key={audit.id} className="mb-1 text-[11px] text-slate-500">
                  {audit.fieldPath} · {audit.actorName || "-"} · v
                  {audit.versionNumber}
                </p>
              ))}
            </div>
          )}
        </Section>
        <Section
          title="当天历史个人日报"
          description="旧系统中每人独立提交的日报永久保留，不会被协作主日报覆盖。"
        >
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {(reportQuery.data?.legacyReports || []).map((item: any) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-700">
                    {item.submitterName || item.createdByName || "历史提交人"}
                  </span>
                  <span className="text-slate-400">已保存</span>
                </div>
                <p className="mt-1 line-clamp-2 text-slate-500">
                  {item.workSummary || item.highlights || "无文字摘要"}
                </p>
              </div>
            ))}
            {(reportQuery.data?.legacyReports || []).length === 0 && (
              <p className="text-xs text-slate-400">该日期没有旧版个人日报。</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
