import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Target,
  Upload,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const dataTypeLabels: Record<string, string> = {
  sku_performance: "商品/SKU表现",
  orders: "订单明细",
  refunds: "退款/退货",
  live: "直播数据",
  creators: "达人数据",
  videos: "短视频数据",
  legacy_ads: "广告数据",
};
const statusLabels: Record<string, string> = {
  todo: "待执行",
  in_progress: "执行中",
  blocked: "受阻",
  done: "观察中",
  cancelled: "已取消",
  pending: "待执行",
  observing: "观察中",
  effective: "有效",
  ineffective: "无效",
  insufficient: "数据不足",
};
const money = (value: any) =>
  `¥${Math.round(Number(value || 0)).toLocaleString()}`;
const percent = (value: any) =>
  value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`;

async function fileBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + 0x8000, bytes.length))
    );
  return btoa(binary);
}

export function StoreGrowthCommandCenter({
  storeId,
  storeName,
  year,
  month,
}: {
  storeId: number;
  storeName: string;
  year: number;
  month: number;
}) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const initialPeriod = {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
  const [periodStart, setPeriodStart] = useState(initialPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(initialPeriod.end);
  const [appliedPeriod, setAppliedPeriod] = useState(initialPeriod);
  const [dataType, setDataType] = useState("sku_performance");
  const [file, setFile] = useState<File | null>(null);
  const [encoded, setEncoded] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const utils = trpc.useUtils();
  const input = {
    storeId,
    periodStart: appliedPeriod.start,
    periodEnd: appliedPeriod.end,
  };
  const dashboard = trpc.storeCommandCenter.dashboard.useQuery(input, {
    retry: 1,
  });
  const previewImport = trpc.storeCommandCenter.previewImport.useMutation();
  const importData = trpc.storeCommandCenter.importData.useMutation();
  const refresh = trpc.storeCommandCenter.refreshRecommendations.useMutation({
    onSuccess: result => {
      setNotice(
        `已刷新：${result.activeAlerts}个异常，新增${result.createdTasks}项指令，验证${result.verifiedTasks}项`
      );
      utils.storeCommandCenter.dashboard.invalidate(input);
    },
  });
  const taskAction = trpc.storeCommandCenter.taskAction.useMutation({
    onSuccess: () => utils.storeCommandCenter.dashboard.invalidate(input),
  });
  const metrics = dashboard.data?.metrics || [];
  const alerts = dashboard.data?.alerts?.length
    ? dashboard.data.alerts
    : dashboard.data?.candidateAlerts || [];
  const topTasks = (dashboard.data?.tasks || []).filter(
    (task: any) => !["cancelled"].includes(task.status)
  );
  const onFile = async (next: File | null) => {
    setFile(next);
    setPreview(null);
    setNotice("");
    if (!next) {
      setEncoded("");
      return;
    }
    try {
      const base64 = await fileBase64(next);
      setEncoded(base64);
      const result = await previewImport.mutateAsync({
        storeId,
        dataType: dataType as any,
        fileName: next.name,
        fileBase64: base64,
      });
      setPreview(result);
    } catch (error: any) {
      setNotice(error.message || "文件解析失败");
    }
  };
  const confirmImport = async () => {
    if (!file || !encoded || !preview) return;
    if (
      !window.confirm(
        `确认导入 ${file.name}？\n有效 ${preview.acceptedCount} 行，异常 ${preview.rejectedCount} 行。导入后将自动生成增长指令。`
      )
    )
      return;
    try {
      const result = await importData.mutateAsync({
        storeId,
        dataType: dataType as any,
        fileName: file.name,
        fileBase64: encoded,
        expectedSha256: preview.fileSha256,
        periodStart: preview.periodStart || periodStart,
        periodEnd: preview.periodEnd || periodEnd,
        confirmed: true,
      });
      setNotice(
        result.alreadyImported
          ? "该文件已导入，不重复写入。"
          : `导入成功：${result.acceptedCount}行，新增${result.createdTasks}项指令`
      );
      setFile(null);
      setEncoded("");
      setPreview(null);
      utils.storeCommandCenter.dashboard.invalidate(input);
    } catch (error: any) {
      setNotice(error.message || "导入失败");
    }
  };
  const act = async (
    task: any,
    action: "start" | "block" | "resume" | "submit_observation" | "cancel"
  ) => {
    let reason = "";
    let evidence: any[] = [];
    if (action === "block") {
      reason = window.prompt("请输入受阻原因") || "";
      if (!reason) return;
    }
    if (action === "submit_observation") {
      reason = window.prompt("请简要说明完成了什么") || "";
      const value = window.prompt("请输入证据URL或文字说明") || "";
      if (!value) return;
      evidence = [
        {
          type: value.startsWith("http") ? "url" : "text",
          value,
          label: "运营执行证据",
        },
      ];
    }
    if (action === "cancel" && !window.confirm("确认取消这项增长指令？"))
      return;
    await taskAction.mutateAsync({
      storeId,
      workItemId: Number(task.id),
      action,
      reason: reason || undefined,
      evidence,
    });
  };
  const totalOpportunity = useMemo(
    () =>
      alerts.reduce(
        (sum: number, item: any) => sum + Number(item.opportunityValue || 0),
        0
      ),
    [alerts]
  );
  if (dashboard.isLoading)
    return (
      <div className="rounded-2xl border bg-white p-12 text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-orange-500" />
        <p className="mt-3 text-sm text-gray-500">
          正在生成 {storeName} 经营指令...
        </p>
      </div>
    );
  if (dashboard.error)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-bold">司令塔读取失败</p>
        <p className="mt-1 text-sm">{dashboard.error.message}</p>
      </div>
    );
  const totals = dashboard.data?.totals;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-orange-300">
              Store Growth Command Center
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {storeName} 营业额增长司令塔
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              系统把CSV变成异常、机会和可执行指令；完成动作后进入观察期，由下一批数据自动验证是否真正提高净GMV。
            </p>
          </div>
          <Button
            onClick={() => refresh.mutate(input)}
            disabled={refresh.isPending}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`}
            />
            刷新指令
          </Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["GMV", money(totals?.gmv)],
            ["退款损失", money(totals?.refundAmount)],
            ["净GMV", money(totals?.netGmv)],
            ["退货率", percent(totals?.returnRate)],
            ["机会池", money(totalOpportunity)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <p className="text-xs text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </div>
      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      )}
      {dashboard.data?.legacySummary?.sources?.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              key: "shop_stats",
              label: "店铺数据",
              detail: `GMV ${money(dashboard.data.legacySummary.shop?.gmv)} · 退款 ${money(dashboard.data.legacySummary.shop?.refundAmount)}`,
            },
            {
              key: "products",
              label: "商品数据",
              detail: `${metrics.length}个商品/SKU指标已反映`,
            },
            {
              key: "ads",
              label: "广告数据",
              detail: `花费 ${money(dashboard.data.legacySummary.ads?.cost)} · 广告GMV ${money(dashboard.data.legacySummary.ads?.gmv)} · ROI ${dashboard.data.legacySummary.ads?.roi == null ? "—" : Number(dashboard.data.legacySummary.ads.roi).toFixed(2)}`,
            },
          ].map(source => {
            const item = dashboard.data.legacySummary.sources.find(
              (row: any) => row.dataType === source.key
            );
            return (
              <div
                key={source.key}
                className="rounded-xl border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{source.label}</p>
                  {item ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {item ? source.detail : "当前期间未上传"}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {item
                    ? `v${item.versionNumber} · ${item.recordCount}条 · ${item.year}/${String(item.month).padStart(2, "0")}`
                    : "缺失不是0值"}
                </p>
              </div>
            );
          })}
        </section>
      )}
      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.95fr]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              数据健康
            </h3>
            <span className="text-xs text-gray-400">
              {dashboard.data?.sourceMode === "legacy_product_csv"
                ? "兼容旧商品CSV"
                : "司令塔CSV"}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {dashboard.data?.dataHealth.map((item: any) => (
              <div
                key={item.dataType}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {dataTypeLabels[item.dataType]}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {item.lastImport
                      ? `v${item.lastImport.versionNumber} · ${item.lastImport.acceptedCount}行`
                      : item.legacySource
                        ? `${item.detail} · v${item.legacySource.versionNumber} · ${item.legacySource.recordCount}条`
                        : item.required
                          ? "增长闭环必需"
                          : item.detail || "增强归因可选"}
                  </p>
                </div>
                {item.status === "healthy" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : item.status === "warning" || item.status === "partial" ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                ) : (
                  <XCircle
                    className={`h-5 w-5 ${item.required ? "text-red-500" : "text-gray-300"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-bold">
              <Database className="h-5 w-5 text-indigo-600" />
              CSV导入中心 V3
            </h3>
            <div className="flex gap-2">
              <Input
                type="date"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
                className="w-36"
              />
              <Input
                type="date"
                value={periodEnd}
                onChange={e => setPeriodEnd(e.target.value)}
                className="w-36"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) ||
                    periodStart > periodEnd
                  ) {
                    setNotice("请选择正确的开始和结束日期");
                    return;
                  }
                  setNotice("");
                  setAppliedPeriod({ start: periodStart, end: periodEnd });
                }}
              >
                应用期间
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
            <select
              value={dataType}
              onChange={e => {
                setDataType(e.target.value);
                setFile(null);
                setPreview(null);
              }}
              className="rounded-md border px-3 py-2 text-sm"
            >
              {Object.entries(dataTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={e => onFile(e.target.files?.[0] || null)}
            />
            <Button
              onClick={confirmImport}
              disabled={!preview || importData.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              确认导入
            </Button>
          </div>
          {preview && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <span>原始 {preview.rawRowCount}</span>
                <span className="text-emerald-700">
                  有效 {preview.acceptedCount}
                </span>
                <span className={preview.rejectedCount ? "text-red-600" : ""}>
                  拒绝 {preview.rejectedCount}
                </span>
                <span
                  className={preview.missingSkuCount ? "text-amber-600" : ""}
                >
                  缺SKU {preview.missingSkuCount}
                </span>
                <span>
                  期间 {preview.periodStart || "?"}～{preview.periodEnd || "?"}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              SKU退货与增长机会
            </h3>
            <span className="text-xs text-gray-400">按预估净GMV影响排序</span>
          </div>
          <div className="mt-4 space-y-3">
            {alerts.slice(0, 8).map((alert: any) => (
              <div
                key={alert.id || alert.fingerprint}
                className="rounded-xl border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${alert.severity === "critical" ? "bg-red-100 text-red-700" : alert.severity === "high" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {alert.severity}
                      </span>
                      <p className="font-semibold">{alert.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">
                      {alert.explanation}
                    </p>
                  </div>
                  <p className="whitespace-nowrap font-bold text-orange-600">
                    {money(alert.opportunityValue)}
                  </p>
                </div>
              </div>
            ))}
            {!alerts.length && (
              <p className="py-10 text-center text-sm text-gray-400">
                上传商品、订单与退款CSV后，系统会生成SKU级异常和机会。
              </p>
            )}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold">
              <ClipboardCheck className="h-5 w-5 text-indigo-600" />
              我的增长任务
            </h3>
            <span className="text-xs text-gray-400">每天最多自动新增3项</span>
          </div>
          <div className="mt-4 space-y-3">
            {topTasks.slice(0, 10).map((task: any) => (
              <div key={task.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        {statusLabels[task.verificationStatus] ||
                          statusLabels[task.status] ||
                          task.status}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {task.ownerName || "待分配"} ·{" "}
                        {task.dueDate
                          ? String(task.dueDate).slice(0, 10)
                          : "无截止"}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold">{task.title}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      预计净GMV影响 {money(task.expectedImpactGmv)}
                    </p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-gray-600">
                      {(typeof task.stepsJson === "string"
                        ? JSON.parse(task.stepsJson || "[]")
                        : task.stepsJson || []
                      ).map((step: string) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <Target className="h-5 w-5 text-orange-500" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {task.status === "todo" && (
                    <Button size="sm" onClick={() => act(task, "start")}>
                      <Play className="mr-1 h-3.5 w-3.5" />
                      开始
                    </Button>
                  )}
                  {task.status === "in_progress" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => act(task, "submit_observation")}
                      >
                        提交观察
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act(task, "block")}
                      >
                        受阻
                      </Button>
                    </>
                  )}
                  {task.status === "blocked" && (
                    <Button size="sm" onClick={() => act(task, "resume")}>
                      恢复执行
                    </Button>
                  )}
                  {task.verificationStatus === "observing" && (
                    <span className="text-xs text-amber-600">
                      系统将在{" "}
                      {task.observationEndAt
                        ? String(task.observationEndAt).slice(0, 10)
                        : "观察期结束"}{" "}
                      后用新CSV自动验证
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!topTasks.length && (
              <p className="py-10 text-center text-sm text-gray-400">
                没有待执行指令。上传最新CSV或点击“刷新指令”。
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          商品/SKU经营雷达
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="p-2">商品 / SKU</th>
                <th className="p-2 text-right">GMV</th>
                <th className="p-2 text-right">退款损失</th>
                <th className="p-2 text-right">退货率</th>
                <th className="p-2 text-right">曝光</th>
                <th className="p-2 text-right">CTR</th>
                <th className="p-2 text-right">CVR</th>
                <th className="p-2">退款原因</th>
              </tr>
            </thead>
            <tbody>
              {metrics.slice(0, 50).map((item: any) => (
                <tr key={item.entityKey} className="border-b last:border-0">
                  <td className="p-2">
                    <p className="font-medium">
                      {item.productName || item.productId || "未识别商品"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.skuName || item.skuId || "默认SKU"}
                    </p>
                  </td>
                  <td className="p-2 text-right font-medium">
                    {money(item.gmv)}
                  </td>
                  <td className="p-2 text-right text-red-600">
                    {money(item.refundAmount)}
                  </td>
                  <td
                    className={`p-2 text-right ${item.returnRate >= 10 ? "font-bold text-red-600" : ""}`}
                  >
                    {percent(item.returnRate)}
                  </td>
                  <td className="p-2 text-right">
                    {Math.round(item.impressions).toLocaleString()}
                  </td>
                  <td className="p-2 text-right">{percent(item.ctr)}</td>
                  <td className="p-2 text-right">{percent(item.cvr)}</td>
                  <td className="p-2 text-xs text-gray-500">
                    {item.topReasons
                      ?.map((reason: any) => reason.reason)
                      .join("、") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
