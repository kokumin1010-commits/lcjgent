import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Loader2,
  PackageSearch,
  TrendingUp,
  Upload,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const money = (value: unknown) => value === null || value === undefined ? "—" : `¥${Math.round(Number(value || 0)).toLocaleString()}`;
const integer = (value: unknown) => value === null || value === undefined ? "—" : Math.round(Number(value || 0)).toLocaleString();
const percent = (value: unknown) => value === null || value === undefined ? "—" : `${(Number(value) * 100).toFixed(1)}%`;
const ratio = (value: unknown) => value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}x`;

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function sumNullable(values: unknown[]): number | null {
  const observed = values.filter(value => value !== null && value !== undefined);
  return observed.length ? observed.reduce<number>((sum, value) => sum + Number(value || 0), 0) : null;
}

function changeText(value: unknown) {
  if (value === null || value === undefined) return "前期数据なし";
  const number = Number(value) * 100;
  return `${number > 0 ? "+" : ""}${number.toFixed(1)}%`;
}

function coverageText(source: any, unit: string) {
  if (!source?.count) return "当前期间未上传";
  return `${source.count}${unit} · ${source.firstDate}${source.firstDate === source.lastDate ? "" : `～${source.lastDate}`}`;
}

async function encodeAdReportPdf(file: File) {
  if (file.type && file.type !== "application/pdf") throw new Error("只能上传PDF广告报告");
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("请选择PDF文件");
  if (file.size <= 0 || file.size > 20 * 1024 * 1024) throw new Error("广告报告PDF请控制在20MB以内");
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const fileSha256 = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return {
    fileBase64: btoa(binary),
    fileSha256,
    fileSize: file.size,
    mimeType: file.type || "application/pdf",
  };
}

function nullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[,¥￥\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function StoreDailyShopPanel({ storeId, initialStart, initialEnd }: { storeId: number; initialStart: string; initialEnd: string }) {
  const [trendStart, setTrendStart] = useState(initialStart);
  const [trendEnd, setTrendEnd] = useState(initialEnd);
  const [appliedTrend, setAppliedTrend] = useState({ start: initialStart, end: initialEnd });
  const [notice, setNotice] = useState("");
  const [showAdDetail, setShowAdDetail] = useState(false);
  const [showAdReportForm, setShowAdReportForm] = useState(false);
  const [adReportFile, setAdReportFile] = useState<File | null>(null);
  const [adReportMessage, setAdReportMessage] = useState("");
  const [adReportForm, setAdReportForm] = useState({
    brandName: "",
    title: "",
    periodStart: initialStart,
    periodEnd: initialEnd,
    totalGmv: "",
    adSpend: "",
    orderCount: "",
    reportedRoas: "",
  });
  const utils = trpc.useUtils();
  const trend = trpc.storeManagement.getDailyShopTrend.useQuery({
    storeId,
    periodStart: appliedTrend.start,
    periodEnd: appliedTrend.end,
  });
  const adReports = trpc.storeManagement.listAdReports.useQuery(
    { storeId },
    { enabled: showAdDetail }
  );
  const adReportFileMutation = trpc.storeManagement.getAdReportFile.useMutation({
    onSuccess: result => window.open(result.url, "_blank", "noopener,noreferrer"),
  });
  const uploadAdReportMutation = trpc.storeManagement.uploadAdReport.useMutation();

  const submitAdReport = async () => {
    if (!adReportFile) {
      setAdReportMessage("请选择PDF广告报告");
      return;
    }
    if (!adReportForm.brandName.trim() || !adReportForm.title.trim()) {
      setAdReportMessage("请填写品牌名和报告名称");
      return;
    }
    if (adReportForm.periodStart > adReportForm.periodEnd) {
      setAdReportMessage("报告开始日期不能晚于结束日期");
      return;
    }
    setAdReportMessage("");
    try {
      const encoded = await encodeAdReportPdf(adReportFile);
      const result = await uploadAdReportMutation.mutateAsync({
        storeId,
        brandName: adReportForm.brandName.trim(),
        title: adReportForm.title.trim(),
        reportType: "product_gmv_max",
        periodStart: adReportForm.periodStart,
        periodEnd: adReportForm.periodEnd,
        totalGmv: nullableNumber(adReportForm.totalGmv),
        adSpend: nullableNumber(adReportForm.adSpend),
        orderCount: nullableNumber(adReportForm.orderCount),
        reportedRoas: nullableNumber(adReportForm.reportedRoas),
        fileName: adReportFile.name,
        ...encoded,
      });
      setAdReportMessage(result.duplicate ? "这份报告已经保存，无需重复上传" : "广告报告已保存");
      setAdReportFile(null);
      setShowAdReportForm(false);
      await utils.storeManagement.listAdReports.invalidate({ storeId });
    } catch (error) {
      setAdReportMessage(error instanceof Error ? error.message : "广告报告上传失败");
    }
  };

  const applyQuickRange = (days: number) => {
    const end = initialEnd;
    const start = addDays(end, -(days - 1));
    setTrendStart(start);
    setTrendEnd(end);
    setAppliedTrend({ start, end });
    setNotice("");
  };

  const chartRows = useMemo(() => (trend.data?.rows || []).map((row: any) => {
    const liveGmv = sumNullable([
      row.creatorLiveAttributedGmv,
      row.merchantLiveGmv,
    ]);
    const videoGmv = sumNullable([
      row.affiliateVideoAttributedGmv,
      row.creatorVideoDirectGmv,
      row.merchantVideoGmv,
    ]);
    return {
      ...row,
      date: String(row.businessDate).slice(5),
      refundRate: Number(row.gmv || 0) > 0 && row.refundAmount !== null ? Number(row.refundAmount) / Number(row.gmv) : null,
      conversionRatePct: row.conversionRate === null || row.conversionRate === undefined ? null : Number(row.conversionRate) * 100,
      liveGmv,
      videoGmv,
    };
  }), [trend.data?.rows]);
  const adRows = useMemo(
    () => chartRows.filter((row: any) => row.sourceTypes?.includes("ads")),
    [chartRows]
  );

  const coverage = trend.data?.sourceCoverage;
  const summary = trend.data?.summary;
  const missingDates = trend.data?.missingDates || [];
  const hasStoreRows = Boolean(coverage?.shopStats?.count);
  const hasAdsRows = Boolean(coverage?.ads?.count);
  const hasProductRows = Boolean(coverage?.products?.count);

  return (
    <section className="space-y-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-orange-50/60 p-4 shadow-sm sm:p-5" data-testid="store-daily-trend-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Daily Trend</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-slate-900"><CalendarDays className="h-5 w-5" />每日趋势</h3>
          <p className="mt-1 max-w-4xl text-sm text-slate-600">
            自动读取上方导入的店铺数据、商品数据和广告数据；无需重复上传每日文件。当前有效版本覆盖同月旧版本，缺失字段不会按0计算。
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">来源：三类主上传</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" data-testid="daily-trend-source-coverage">
        {[
          { key: "shop", label: "店铺数据", detail: coverageText(coverage?.shopStats, "个有数据日"), icon: Database, available: hasStoreRows },
          { key: "products", label: "商品数据", detail: coverageText(coverage?.products, "个上传快照"), icon: PackageSearch, available: hasProductRows },
          { key: "ads", label: "广告数据", detail: coverageText(coverage?.ads, "个有数据日"), icon: BarChart3, available: hasAdsRows },
        ].map(source => (
          <div
            key={source.key}
            className={`rounded-xl border bg-white p-3 shadow-sm ${source.key === "ads" ? "cursor-pointer transition hover:border-indigo-300 hover:shadow-md" : ""}`}
            role={source.key === "ads" ? "button" : undefined}
            tabIndex={source.key === "ads" ? 0 : undefined}
            onClick={() => source.key === "ads" && setShowAdDetail(true)}
            onKeyDown={event => {
              if (source.key === "ads" && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                setShowAdDetail(true);
              }
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-800"><source.icon className="h-4 w-4 text-indigo-600" />{source.label}</div>
              {source.available ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            </div>
            <p className="mt-1 text-xs text-slate-500">{source.detail}</p>
            {source.key === "ads" && <p className="mt-2 text-[11px] font-bold text-indigo-600">点击查看广告明细与报告 →</p>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 font-bold text-slate-800"><TrendingUp className="h-4 w-4 text-indigo-600" />按日期分析</h4>
            <p className="text-xs text-slate-500">店铺与广告按文件内业务日期；无日期的商品文件按实际上传日显示为快照，不重复计入店铺GMV。</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button size="sm" variant="outline" onClick={() => applyQuickRange(7)}>最近7天</Button>
            <Button size="sm" variant="outline" onClick={() => applyQuickRange(30)}>最近30天</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const start = `${initialEnd.slice(0,7)}-01`;
              const end = new Date(Date.UTC(Number(initialEnd.slice(0,4)), Number(initialEnd.slice(5,7)), 0)).toISOString().slice(0,10);
              setTrendStart(start);
              setTrendEnd(end);
              setAppliedTrend({ start, end });
              setNotice("");
            }}>本月</Button>
            <Input type="date" value={trendStart} onChange={event => setTrendStart(event.target.value)} className="min-w-0 flex-1 sm:w-36 sm:flex-none" />
            <span className="text-slate-400">〜</span>
            <Input type="date" value={trendEnd} onChange={event => setTrendEnd(event.target.value)} className="min-w-0 flex-1 sm:w-36 sm:flex-none" />
            <Button size="sm" onClick={() => {
              if (trendStart > trendEnd) {
                setNotice("趋势开始日期不能晚于结束日期");
                return;
              }
              setNotice("");
              setAppliedTrend({ start: trendStart, end: trendEnd });
            }}>应用期间</Button>
          </div>
        </div>

        {notice && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{notice}</p>}
        {trend.error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{trend.error.message}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {[
            ["区间GMV", money(summary?.gmv), changeText(trend.data?.changes?.gmv)],
            ["订单", integer(summary?.orderCount), changeText(trend.data?.changes?.orderCount)],
            ["客户", integer(summary?.customerCount), changeText(trend.data?.changes?.customerCount)],
            ["退款金额", money(summary?.refundAmount), changeText(trend.data?.changes?.refundAmount)],
            ["区间广告消费合计", money(summary?.adCost), changeText(trend.data?.changes?.adCost)],
            ["广告GMV", money(summary?.adGmv), changeText(trend.data?.changes?.adGmv)],
            ["广告ROAS", ratio(summary?.adRoi), "区间重算"],
            ["最新商品/SKU", integer(summary?.latestProductSnapshot?.skuCount), summary?.latestProductSnapshot?.businessDate || "暂无快照"],
          ].map(([label,value,caption]) => {
            const adMetric = label === "区间广告消费合计" || label === "广告GMV" || label === "广告ROAS";
            return (
            <div
              key={label}
              className={`rounded-lg border bg-slate-50 p-3 ${adMetric ? "cursor-pointer transition hover:border-indigo-300 hover:bg-indigo-50" : ""}`}
              role={adMetric ? "button" : undefined}
              tabIndex={adMetric ? 0 : undefined}
              onClick={() => adMetric && setShowAdDetail(true)}
              onKeyDown={event => {
                if (adMetric && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setShowAdDetail(true);
                }
              }}
            >
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
              <p className={`mt-1 text-[10px] ${adMetric ? "font-bold text-indigo-500" : "text-slate-400"}`}>{adMetric ? `${caption} · 查看明细` : caption}</p>
            </div>
          )})}
        </div>

        {trend.isLoading ? (
          <div className="flex h-72 items-center justify-center text-sm text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />趋势读取中…</div>
        ) : chartRows.length ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {hasStoreRows && <>
              <div className="h-80 min-w-0 rounded-xl border p-3"><p className="mb-2 text-sm font-bold text-slate-700">GMV / 退款金额</p><ResponsiveContainer width="100%" height="90%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis tick={{fontSize:10}} tickFormatter={(value) => Number(value) >= 10000 ? `${Math.round(Number(value)/10000)}万` : String(value)} /><Tooltip formatter={(value:any) => money(value)} /><Legend /><Line type="monotone" dataKey="gmv" name="GMV" stroke="#4f46e5" strokeWidth={3} connectNulls={false} /><Line type="monotone" dataKey="refundAmount" name="退款金额" stroke="#ef4444" strokeWidth={2} connectNulls={false} /></LineChart></ResponsiveContainer></div>
              <div className="h-80 min-w-0 rounded-xl border p-3"><p className="mb-2 text-sm font-bold text-slate-700">订单 / 客户 / 成交件数</p><ResponsiveContainer width="100%" height="90%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Legend /><Line type="monotone" dataKey="orderCount" name="订单" stroke="#f97316" strokeWidth={2} connectNulls={false} /><Line type="monotone" dataKey="customerCount" name="客户" stroke="#16a34a" strokeWidth={2} connectNulls={false} /><Line type="monotone" dataKey="soldQuantity" name="成交件数" stroke="#0ea5e9" strokeWidth={2} connectNulls={false} /></LineChart></ResponsiveContainer></div>
              <div className="h-80 min-w-0 rounded-xl border p-3"><p className="mb-2 text-sm font-bold text-slate-700">访客 / 浏览 / 转化率</p><ResponsiveContainer width="100%" height="90%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis yAxisId="count" tick={{fontSize:10}} /><YAxis yAxisId="rate" orientation="right" tick={{fontSize:10}} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} /><Tooltip /><Legend /><Line yAxisId="count" type="monotone" dataKey="pageViews" name="页面浏览" stroke="#6366f1" connectNulls={false} /><Line yAxisId="count" type="monotone" dataKey="productVisitors" name="商品访客" stroke="#14b8a6" connectNulls={false} /><Line yAxisId="rate" type="monotone" dataKey="conversionRatePct" name="转化率(%)" stroke="#a855f7" connectNulls={false} /></LineChart></ResponsiveContainer></div>
              <div className="h-80 min-w-0 rounded-xl border p-3"><p className="mb-2 text-sm font-bold text-slate-700">销售渠道GMV</p><ResponsiveContainer width="100%" height="90%"><BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis tick={{fontSize:10}} tickFormatter={(value) => Number(value) >= 10000 ? `${Math.round(Number(value)/10000)}万` : String(value)} /><Tooltip formatter={(value:any) => money(value)} /><Legend /><Bar dataKey="liveGmv" name="直播GMV" stackId="channels" fill="#f97316" /><Bar dataKey="videoGmv" name="视频GMV" stackId="channels" fill="#8b5cf6" /></BarChart></ResponsiveContainer></div>
            </>}
            {hasAdsRows && <div className="h-80 min-w-0 rounded-xl border p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-bold text-slate-700">每日广告消费 / 广告GMV</p><Button size="sm" variant="outline" onClick={() => setShowAdDetail(true)}>查看广告明细</Button></div><ResponsiveContainer width="100%" height="86%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis tick={{fontSize:10}} tickFormatter={(value) => Number(value) >= 10000 ? `${Math.round(Number(value)/10000)}万` : String(value)} /><Tooltip formatter={(value:any) => money(value)} /><Legend /><Line type="monotone" dataKey="adCost" name="广告消费" stroke="#dc2626" strokeWidth={2} connectNulls={false} /><Line type="monotone" dataKey="adGmv" name="广告GMV" stroke="#059669" strokeWidth={3} connectNulls={false} /></LineChart></ResponsiveContainer></div>}
            {hasProductRows && <div className="h-80 min-w-0 rounded-xl border p-3"><p className="mb-2 text-sm font-bold text-slate-700">商品上传快照</p><ResponsiveContainer width="100%" height="90%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis tick={{fontSize:10}} tickFormatter={(value) => Number(value) >= 10000 ? `${Math.round(Number(value)/10000)}万` : String(value)} /><Tooltip /><Legend /><Line type="monotone" dataKey="productGmv" name="商品快照GMV" stroke="#2563eb" strokeWidth={2} connectNulls={false} /><Line type="monotone" dataKey="productSkuCount" name="商品/SKU数" stroke="#7c3aed" strokeWidth={2} connectNulls={false} /></LineChart></ResponsiveContainer></div>}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed p-10 text-center text-sm text-slate-400">所选期间没有三类主上传数据。请使用页面上方“上传数据”导入店铺、商品或广告文件。</div>
        )}

        {Boolean(missingDates.length) && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">店铺数据缺失日期：{missingDates.join("、")}（缺失日不会按0绘图）</p>
        )}
      </div>

      <Dialog open={showAdDetail} onOpenChange={setShowAdDetail}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto" data-testid="store-ad-detail-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-600" />广告明细与报告</DialogTitle>
            <DialogDescription>
              逐日明细使用当前选择期间；PDF报告独立保存原始期间和汇总，不会重复计入趋势或GMV。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["广告消费合计", money(summary?.adCost)],
              ["广告GMV合计", money(summary?.adGmv)],
              ["广告订单合计", integer(summary?.adOrders)],
              ["期间ROAS", ratio(summary?.adRoi)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h4 className="font-bold text-slate-900">逐日广告明细</h4>
                <p className="text-xs text-slate-500">{appliedTrend.start} ～ {appliedTrend.end} · {adRows.length}个有数据日</p>
              </div>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                  <tr><th className="px-4 py-2">日期</th><th className="px-4 py-2 text-right">广告消费</th><th className="px-4 py-2 text-right">广告GMV</th><th className="px-4 py-2 text-right">广告订单</th><th className="px-4 py-2 text-right">ROAS</th></tr>
                </thead>
                <tbody>
                  {adRows.map((row: any) => (
                    <tr key={row.businessDate} className="border-t">
                      <td className="px-4 py-2 font-medium text-slate-800">{row.businessDate}</td>
                      <td className="px-4 py-2 text-right text-red-600">{money(row.adCost)}</td>
                      <td className="px-4 py-2 text-right text-emerald-700">{money(row.adGmv)}</td>
                      <td className="px-4 py-2 text-right">{integer(row.adOrders)}</td>
                      <td className="px-4 py-2 text-right font-bold">{ratio(row.adRoi)}</td>
                    </tr>
                  ))}
                  {!adRows.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">当前期间没有广告明细</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h4 className="flex items-center gap-2 font-bold text-slate-900"><FileText className="h-4 w-4 text-indigo-600" />广告报告PDF</h4>
                <p className="text-xs text-slate-500">按品牌和报告期间保存，可随时预览原始报告。</p>
              </div>
              <Button size="sm" onClick={() => setShowAdReportForm(value => !value)}><Upload className="mr-1 h-4 w-4" />添加广告报告</Button>
            </div>

            {showAdReportForm && (
              <div className="grid gap-3 border-b bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><Label>品牌名 *</Label><Input value={adReportForm.brandName} onChange={event => setAdReportForm(value => ({ ...value, brandName: event.target.value }))} placeholder="例如 MIAVIE" /></div>
                <div className="sm:col-span-2"><Label>报告名称 *</Label><Input value={adReportForm.title} onChange={event => setAdReportForm(value => ({ ...value, title: event.target.value }))} placeholder="例如 商品GMV MAX广告运用报告" /></div>
                <div><Label>PDF文件 *</Label><Input type="file" accept="application/pdf,.pdf" onChange={event => setAdReportFile(event.target.files?.[0] || null)} /></div>
                <div><Label>开始日期 *</Label><Input type="date" value={adReportForm.periodStart} onChange={event => setAdReportForm(value => ({ ...value, periodStart: event.target.value }))} /></div>
                <div><Label>结束日期 *</Label><Input type="date" value={adReportForm.periodEnd} onChange={event => setAdReportForm(value => ({ ...value, periodEnd: event.target.value }))} /></div>
                <div><Label>总GMV</Label><Input inputMode="decimal" value={adReportForm.totalGmv} onChange={event => setAdReportForm(value => ({ ...value, totalGmv: event.target.value }))} placeholder="1888693" /></div>
                <div><Label>广告消费</Label><Input inputMode="decimal" value={adReportForm.adSpend} onChange={event => setAdReportForm(value => ({ ...value, adSpend: event.target.value }))} placeholder="432384" /></div>
                <div><Label>订单数</Label><Input inputMode="numeric" value={adReportForm.orderCount} onChange={event => setAdReportForm(value => ({ ...value, orderCount: event.target.value }))} placeholder="498" /></div>
                <div><Label>报告ROAS</Label><Input inputMode="decimal" value={adReportForm.reportedRoas} onChange={event => setAdReportForm(value => ({ ...value, reportedRoas: event.target.value }))} placeholder="4.37" /></div>
                <div className="flex items-end gap-2 lg:col-span-2"><Button onClick={submitAdReport} disabled={uploadAdReportMutation.isPending}>{uploadAdReportMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}保存报告</Button><Button variant="outline" onClick={() => setShowAdReportForm(false)}>取消</Button></div>
              </div>
            )}

            {adReportMessage && <p className="mx-4 mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">{adReportMessage}</p>}
            <div className="space-y-2 p-4">
              {adReports.isLoading && <p className="py-4 text-center text-sm text-slate-400"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" />报告读取中…</p>}
              {(adReports.data || []).map((report: any) => (
                <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{report.brandName}</span><p className="font-bold text-slate-900">{report.title}</p></div>
                    <p className="mt-1 text-xs text-slate-500">{report.periodStart} ～ {report.periodEnd} · {report.pageCount}页 · {report.fileName}</p>
                    <p className="mt-1 text-xs text-slate-600">GMV {money(report.totalGmv)} · 广告消费 {money(report.adSpend)} · 订单 {integer(report.orderCount)} · ROAS {ratio(report.roas)}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={adReportFileMutation.isPending} onClick={() => adReportFileMutation.mutate({ id: report.id })}><ExternalLink className="mr-1 h-4 w-4" />查看PDF</Button>
                </div>
              ))}
              {!adReports.isLoading && !(adReports.data || []).length && <p className="py-6 text-center text-sm text-slate-400">尚未保存广告报告PDF</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
