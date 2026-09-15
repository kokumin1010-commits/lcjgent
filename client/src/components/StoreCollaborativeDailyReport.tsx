import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileClock,
  History,
  Loader2,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
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
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="font-black text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
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
  const [adjustmentReason, setAdjustmentReason] = useState("");
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
  const saveMutation = trpc.storeDailyReport.save.useMutation();
  const confirmMutation = trpc.storeDailyReport.confirm.useMutation();
  const reopenMutation = trpc.storeDailyReport.reopen.useMutation();

  useEffect(() => {
    if (!reportQuery.data || dirty) return;
    setPayload(
      normalizeStoreDailyReportPayload(reportQuery.data.initialPayload)
    );
    setExpectedVersion(Number((reportQuery.data.report as any)?.versionNumber || 0));
  }, [reportQuery.data, dirty]);

  const report = queryReport;
  const canEdit =
    Boolean(reportQuery.data?.canEdit) && report?.status !== "confirmed";
  const canConfirm = Boolean(reportQuery.data?.canConfirm);
  const saving =
    saveMutation.isPending ||
    confirmMutation.isPending ||
    reopenMutation.isPending;
  const missingCore = useMemo(
    () =>
      CORE_FIELDS.filter(field => payload.core[field.key] === null).map(
        field => field.label
      ),
    [payload.core]
  );

  const change = (
    updater: (current: StoreDailyReportPayload) => StoreDailyReportPayload
  ) => {
    setPayload(current => updater(current));
    setDirty(true);
    setNotice("");
  };

  const updateCore = (key: keyof StoreDailyCoreData, value: number | null) =>
    change(current => {
      const next = { ...current, core: { ...current.core, [key]: value } };
      if (
        (key === "totalGmv" || key === "refundAmount") &&
        next.core.totalGmv !== null &&
        next.core.refundAmount !== null
      ) {
        next.core.actualSales = Math.max(
          0,
          next.core.totalGmv - next.core.refundAmount
        );
      }
      return next;
    });

  const save = async (submit: boolean) => {
    setNotice("");
    try {
      const result = await saveMutation.mutateAsync({
        storeId,
        reportDate,
        expectedVersion,
        submit,
        adjustmentReason,
        payload,
      });
      setExpectedVersion(result.versionNumber);
      setDirty(false);
      setAdjustmentReason("");
      setNotice(submit ? "日报已提交，等待超级管理员确认。" : "草稿已保存。");
      await Promise.all([
        utils.storeDailyReport.get.invalidate({ storeId, reportDate }),
        utils.storeDailyReport.history.invalidate({ storeId, reportDate }),
        utils.storeDailyReport.listMonth.invalidate(),
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

  const confirm = async () => {
    if (!report?.id) return;
    await confirmMutation.mutateAsync({ id: Number(report.id) });
    setDirty(false);
    setNotice("日报已确认并锁定。");
    await Promise.all([
      reportQuery.refetch(),
      historyQuery.refetch(),
      utils.storeManagement.businessOverview.invalidate(),
    ]);
  };

  const reopen = async () => {
    if (!report?.id) return;
    const reason = window.prompt("请输入重开原因（至少3个字符）");
    if (!reason) return;
    await reopenMutation.mutateAsync({ id: Number(report.id), reason });
    setDirty(false);
    setNotice("日报已重开，可以继续修改。");
    await Promise.all([
      reportQuery.refetch(),
      historyQuery.refetch(),
      utils.storeManagement.businessOverview.invalidate(),
    ]);
  };

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
            状态：{report?.status || "尚未创建"}
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
        title="核心经营数据"
        description="提交前必须完整。自动数据可以修正，但需要填写原因；实际销售额固定为总GMV－退款金额。"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CORE_FIELDS.map(field => (
            <NumberField
              key={field.key}
              label={field.label}
              value={payload.core[field.key]}
              onChange={value => updateCore(field.key, value)}
              source={payload.metricMeta[field.key]}
              required
              suffix={field.unit}
            />
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
          <label>
            <FieldLabel label="数据截止时间" required />
            <Input
              type="time"
              value={payload.cutoffTime}
              onChange={event =>
                change(current => ({
                  ...current,
                  cutoffTime: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <FieldLabel label="自动数据调整原因" />
            <Input
              value={adjustmentReason}
              onChange={event => setAdjustmentReason(event.target.value)}
              placeholder="修改自动带入的GMV、退款、广告或达人数据时必填"
            />
          </label>
        </div>
        {missingCore.length > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            尚未完整：{missingCore.join("、")}。草稿可保存，提交前必须补齐。
          </p>
        )}
      </Section>

      <Section
        title="内容与直播"
        description="没有执行时填写0；自动数据未接入时不会自行伪造为0。"
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
        description="链接和调价每行一条，使用竖线分隔字段。"
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
        description="补货：SKU|数量|负责人；风险：SKU|原因|负责人。"
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
        description="明日重点和需要公司支持的事项提交后会同步进入店铺Todo。格式：事项|负责人|YYYY-MM-DD|优先级。"
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
          {canEdit ? "你可以编辑本店主日报" : "当前为只读模式"}
          {dirty && (
            <span className="font-bold text-amber-600">· 有未保存修改</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canConfirm && report?.status === "confirmed" && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={reopen}
            >
              <FileClock className="mr-1 h-4 w-4" />
              重开
            </Button>
          )}
          {canConfirm && report?.status === "submitted" && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={confirm}
            >
              <ShieldCheck className="mr-1 h-4 w-4" />
              确认并锁定
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => save(false)}
            >
              <Save className="mr-1 h-4 w-4" />
              保存草稿
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              disabled={saving || missingCore.length > 0}
              onClick={() => save(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Send className="mr-1 h-4 w-4" />
              提交日报
            </Button>
          )}
        </div>
      </div>

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
                <span>
                  v{version.versionNumber} · {version.status}
                </span>
                <span className="text-slate-500">
                  {version.actorName || "-"} ·{" "}
                  {version.createdAt
                    ? new Date(version.createdAt).toLocaleString()
                    : ""}
                </span>
              </div>
            ))}
            {(historyQuery.data?.versions || []).length === 0 && (
              <p className="text-xs text-slate-400">保存后开始记录版本。</p>
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
          title="历史个人日报"
          description="旧系统中每人独立提交的日报永久保留为贡献记录，不会被主日报覆盖。"
        >
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {(reportQuery.data?.legacyReports || []).map((item: any) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
              >
                <div className="flex justify-between">
                  <span className="font-bold text-slate-700">
                    {item.submitterName || item.createdByName || "历史提交人"}
                  </span>
                  <span className="text-slate-400">{item.status}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-slate-500">
                  {item.workSummary || item.highlights || "无文字摘要"}
                </p>
              </div>
            ))}
            {(reportQuery.data?.legacyReports || []).length === 0 && (
              <p className="text-xs text-slate-400">当日没有旧版个人日报。</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
