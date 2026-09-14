import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  RotateCcw,
  Trash2,
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

const jstToday = () => new Date(Date.now() + 9 * 60 * 60_000).toISOString().slice(0, 10);
const money = (value: unknown) => `¥${Math.round(Number(value || 0)).toLocaleString()}`;
const integer = (value: unknown) => Math.round(Number(value || 0)).toLocaleString();
const percent = (value: unknown) => value === null || value === undefined ? "—" : `${(Number(value) * 100).toFixed(1)}%`;

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function encodeFile(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function changeText(value: unknown) {
  if (value === null || value === undefined) return "前期数据なし";
  const number = Number(value) * 100;
  return `${number > 0 ? "+" : ""}${number.toFixed(1)}%`;
}

export function StoreDailyShopPanel({ storeId, initialStart, initialEnd }: { storeId: number; initialStart: string; initialEnd: string }) {
  const [businessDate, setBusinessDate] = useState(initialEnd || jstToday());
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [trendStart, setTrendStart] = useState(initialStart);
  const [trendEnd, setTrendEnd] = useState(initialEnd);
  const [appliedTrend, setAppliedTrend] = useState({ start: initialStart, end: initialEnd });
  const utils = trpc.useUtils();
  const year = Number(businessDate.slice(0, 4));
  const month = Number(businessDate.slice(5, 7));
  const calendar = trpc.storeManagement.getDailyShopCalendar.useQuery({ storeId, year, month });
  const detail = trpc.storeManagement.getDailyShopDetail.useQuery({ storeId, businessDate });
  const trend = trpc.storeManagement.getDailyShopTrend.useQuery({ storeId, periodStart: appliedTrend.start, periodEnd: appliedTrend.end });
  const previewMutation = trpc.storeManagement.previewDailyShopFile.useMutation();
  const importMutation = trpc.storeManagement.importDailyShopFile.useMutation();
  const downloadMutation = trpc.storeManagement.getDailyShopOriginalFile.useMutation({
    onSuccess: result => window.open(result.url, "_blank", "noopener,noreferrer"),
  });
  const deleteMutation = trpc.storeManagement.deleteDailyShopImport.useMutation();
  const restoreMutation = trpc.storeManagement.restoreDailyShopImport.useMutation();

  const invalidate = async () => {
    await Promise.all([
      utils.storeManagement.getDailyShopCalendar.invalidate(),
      utils.storeManagement.getDailyShopDetail.invalidate(),
      utils.storeManagement.getDailyShopTrend.invalidate(),
    ]);
  };

  const chooseFile = async (next: File | null) => {
    setFile(next);
    setPreview(null);
    setFileBase64("");
    setNotice("");
    if (!next) return;
    try {
      const encoded = await encodeFile(next);
      const result = await previewMutation.mutateAsync({ storeId, fileName: next.name, fileBase64: encoded });
      setFileBase64(encoded);
      setPreview(result);
      if (result.detectedBusinessDate) setBusinessDate(result.detectedBusinessDate);
    } catch (error: any) {
      setNotice(error.message || "文件解析失败");
    }
  };

  const confirmImport = async () => {
    if (!file || !fileBase64 || !preview) return;
    if (preview.detectedBusinessDate && preview.detectedBusinessDate !== businessDate) {
      setNotice(`所选日期 ${businessDate} 与文件日期 ${preview.detectedBusinessDate} 不一致`);
      return;
    }
    if (!window.confirm(`确认把 ${file.name} 导入为 ${businessDate} 的店铺每日数据？\n该操作不会影响任何月度数据。`)) return;
    try {
      const result = await importMutation.mutateAsync({
        storeId,
        businessDate,
        fileName: file.name,
        fileBase64,
        expectedSha256: preview.fileSha256,
        confirmed: true,
      });
      setNotice(result.alreadyImported ? "该文件已经导入，不会重复写入。" : `导入成功：${businessDate} · v${result.versionNumber}`);
      setFile(null);
      setFileBase64("");
      setPreview(null);
      await invalidate();
    } catch (error: any) {
      setNotice(error.message || "每日店铺数据导入失败");
    }
  };

  const applyQuickRange = (days: number) => {
    const end = businessDate;
    const start = addDays(end, -(days - 1));
    setTrendStart(start);
    setTrendEnd(end);
    setAppliedTrend({ start, end });
  };

  const rows = trend.data?.rows || [];
  const chartRows = useMemo(() => rows.map((row: any) => ({
    ...row,
    date: String(row.businessDate).slice(5),
    refundRate: Number(row.gmv || 0) > 0 ? Number(row.refundAmount || 0) / Number(row.gmv || 0) : null,
    conversionRatePct: row.conversionRate === null || row.conversionRate === undefined ? null : Number(row.conversionRate) * 100,
    liveGmv: Number(row.creatorLiveAttributedGmv || 0) + Number(row.merchantLiveGmv || 0),
    videoGmv: Number(row.affiliateVideoAttributedGmv || 0) + Number(row.creatorVideoDirectGmv || 0) + Number(row.merchantVideoGmv || 0),
  })), [rows]);
  const current = detail.data?.current;
  const metrics = current?.metrics;
  const missingDates = trend.data?.missingDates || [];
  const history = detail.data?.history || [];
  const hasDateMismatch = Boolean(preview?.detectedBusinessDate && preview.detectedBusinessDate !== businessDate);

  return (
    <section className="space-y-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-orange-50/60 p-5 shadow-sm" data-testid="store-daily-shop-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Daily Store Data</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-slate-900"><CalendarDays className="h-5 w-5" />店铺每日数据</h3>
          <p className="mt-1 text-sm text-slate-600">每天上传一份店铺 CSV/Excel；与现有每月数据完全独立，不覆盖月度版本。</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">月度上传不受影响</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.95fr]">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-bold text-slate-800">每日文件上传</h4>
            <span className="text-xs text-slate-400">CSV / XLSX / XLS · 30MB</span>
          </div>
          <label className="mt-4 block text-xs font-semibold text-slate-600">业务日期</label>
          <Input type="date" value={businessDate} onChange={event => setBusinessDate(event.target.value)} className="mt-1" />
          <label className="mt-3 block text-xs font-semibold text-slate-600">店铺每日文件</label>
          <Input type="file" accept=".csv,.xlsx,.xls" className="mt-1" onChange={event => void chooseFile(event.target.files?.[0] || null)} />
          {(previewMutation.isPending || importMutation.isPending) && <p className="mt-3 flex items-center gap-2 text-sm text-indigo-600"><Loader2 className="h-4 w-4 animate-spin" />{previewMutation.isPending ? "正在安全解析…" : "正在保存每日版本…"}</p>}
          {notice && <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${notice.includes("失败") || notice.includes("不一致") ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{notice}</p>}
          {preview && (
            <div className={`mt-4 rounded-xl border p-3 ${hasDateMismatch ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50/60"}`}>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                {hasDateMismatch ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                解析预览 · {preview.detectedBusinessDate || "日期未识别"}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <span>GMV <b>{money(preview.metrics.gmv)}</b></span>
                <span>订单 <b>{integer(preview.metrics.orderCount)}</b></span>
                <span>客户 <b>{integer(preview.metrics.customerCount)}</b></span>
                <span>退款 <b>{money(preview.metrics.refundAmount)}</b></span>
                <span>总成交额 <b>{money(preview.metrics.grossRevenue)}</b></span>
                <span>直播GMV <b>{money(preview.metrics.creatorLiveAttributedGmv)}</b></span>
              </div>
              {preview.quality.warnings?.length > 0 && <p className="mt-2 text-xs text-amber-700">{preview.quality.warnings.join("；")}</p>}
              <Button className="mt-4 w-full" onClick={() => void confirmImport()} disabled={hasDateMismatch || importMutation.isPending}>
                <Upload className="mr-2 h-4 w-4" />确认导入每日数据
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-800">按日期查看</h4>
              <p className="text-xs text-slate-500">有数据日期会显示 GMV；未上传不显示为 0。</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={() => setBusinessDate(addDays(businessDate, -1))} aria-label="前一天"><ChevronLeft className="h-4 w-4" /></Button>
              <Input type="date" value={businessDate} onChange={event => setBusinessDate(event.target.value)} className="w-40" />
              <Button size="icon" variant="outline" onClick={() => setBusinessDate(addDays(businessDate, 1))} aria-label="后一天"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
            {(calendar.data || []).map((day: any) => (
              <button key={day.businessDate} onClick={() => setBusinessDate(day.businessDate)} className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${businessDate === day.businessDate ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300"}`}>
                {day.businessDate.slice(5)} · {money(day.gmv)}
              </button>
            ))}
            {!calendar.isLoading && !(calendar.data || []).length && <p className="py-4 text-sm text-slate-400">该月尚无每日店铺数据。</p>}
          </div>
          {detail.isLoading ? <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />正在读取每日数据…</p> : current && metrics ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["GMV", money(metrics.gmv)],
                  ["订单", integer(metrics.orderCount)],
                  ["客户", integer(metrics.customerCount)],
                  ["退款", money(metrics.refundAmount)],
                  ["转化率", percent(metrics.conversionRate)],
                  ["直播GMV", money(metrics.creatorLiveAttributedGmv)],
                ].map(([label,value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>)}
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 rounded-lg border px-3 py-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
                {[
                  ["成交件数", integer(metrics.soldQuantity)],
                  ["SKU订单数", integer(metrics.skuOrderCount)],
                  ["总成交额", money(metrics.grossRevenue)],
                  ["平均订单金额", money(metrics.averageOrderValue)],
                  ["页面浏览", integer(metrics.pageViews)],
                  ["商品访客", integer(metrics.productVisitors)],
                  ["商品曝光", integer(metrics.productImpressions)],
                  ["去重曝光", integer(metrics.uniqueProductImpressions)],
                  ["商品点击", integer(metrics.productClicks)],
                  ["去重点击", integer(metrics.uniqueClicks)],
                  ["达人直播GMV", money(metrics.creatorLiveDirectGmv)],
                  ["商家直播GMV", money(metrics.merchantLiveGmv)],
                ].map(([label,value]) => <div key={label} className="flex items-center justify-between gap-2 border-b border-dashed py-1"><span className="text-slate-500">{label}</span><b className="text-slate-800">{value}</b></div>)}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span>{current.fileName} · v{current.versionNumber} · {current.uploadedByName || "authenticated-user"}</span>
                <Button size="sm" variant="outline" onClick={() => downloadMutation.mutate({ importId:Number(current.importId) })}><Download className="mr-1 h-3.5 w-3.5" />原文件</Button>
              </div>
            </div>
          ) : <div className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-slate-400"><FileSpreadsheet className="mx-auto mb-2 h-7 w-7" />{businessDate} 尚未上传每日店铺文件</div>}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h4 className="flex items-center gap-2 font-bold text-slate-800"><TrendingUp className="h-4 w-4 text-indigo-600" />每日趋势</h4><p className="text-xs text-slate-500">趋势只读取独立每日数据，不改变月度上传。</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => applyQuickRange(7)}>最近7天</Button>
            <Button size="sm" variant="outline" onClick={() => applyQuickRange(30)}>最近30天</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const start = `${businessDate.slice(0,7)}-01`;
              const end = new Date(Date.UTC(Number(businessDate.slice(0,4)), Number(businessDate.slice(5,7)), 0)).toISOString().slice(0,10);
              setTrendStart(start); setTrendEnd(end); setAppliedTrend({ start, end });
            }}>本月</Button>
            <Input type="date" value={trendStart} onChange={event => setTrendStart(event.target.value)} className="w-36" />
            <span className="text-slate-400">〜</span>
            <Input type="date" value={trendEnd} onChange={event => setTrendEnd(event.target.value)} className="w-36" />
            <Button size="sm" onClick={() => trendStart <= trendEnd ? setAppliedTrend({ start:trendStart,end:trendEnd }) : setNotice("趋势开始日期不能晚于结束日期")}>应用期间</Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["区间GMV", money(trend.data?.summary?.gmv), changeText(trend.data?.changes?.gmv)],
            ["订单", integer(trend.data?.summary?.orderCount), changeText(trend.data?.changes?.orderCount)],
            ["客户", integer(trend.data?.summary?.customerCount), changeText(trend.data?.changes?.customerCount)],
            ["退款金额", money(trend.data?.summary?.refundAmount), changeText(trend.data?.changes?.refundAmount)],
            ["退款金额率", percent(trend.data?.summary?.refundRate), "区间重算"],
            ["日均GMV", money(trend.data?.summary?.averageDailyGmv), `${trend.data?.summary?.dayCount || 0}个有数据日`],
          ].map(([label,value,caption]) => <div key={label} className="rounded-lg border bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{value}</p><p className="mt-1 text-[10px] text-slate-400">{caption}</p></div>)}
        </div>
        {trend.isLoading ? <div className="flex h-72 items-center justify-center text-sm text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />趋势读取中…</div> : chartRows.length ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="h-80 rounded-xl border p-3"><p className="mb-2 text-sm font-bold text-slate-700">GMV / 退款金额</p><ResponsiveContainer width="100%" height="90%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis tick={{fontSize:10}} tickFormatter={(value) => Number(value) >= 10000 ? `${Math.round(Number(value)/10000)}万` : String(value)} /><Tooltip formatter={(value:any) => money(value)} /><Legend /><Line type="monotone" dataKey="gmv" name="GMV" stroke="#4f46e5" strokeWidth={3} connectNulls={false} /><Line type="monotone" dataKey="refundAmount" name="退款金额" stroke="#ef4444" strokeWidth={2} connectNulls={false} /></LineChart></ResponsiveContainer></div>
            <div className="h-80 rounded-xl border p-3"><p className="mb-2 text-sm font-bold text-slate-700">订单 / 客户 / 成交件数</p><ResponsiveContainer width="100%" height="90%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Legend /><Line type="monotone" dataKey="orderCount" name="订单" stroke="#f97316" strokeWidth={2} /><Line type="monotone" dataKey="customerCount" name="客户" stroke="#16a34a" strokeWidth={2} /><Line type="monotone" dataKey="soldQuantity" name="成交件数" stroke="#0ea5e9" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
            <div className="h-80 rounded-xl border p-3"><p className="mb-2 text-sm font-bold text-slate-700">访客 / 浏览 / 转化率</p><ResponsiveContainer width="100%" height="90%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis yAxisId="count" tick={{fontSize:10}} /><YAxis yAxisId="rate" orientation="right" tick={{fontSize:10}} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} /><Tooltip /><Legend /><Line yAxisId="count" type="monotone" dataKey="pageViews" name="页面浏览" stroke="#6366f1" /><Line yAxisId="count" type="monotone" dataKey="productVisitors" name="商品访客" stroke="#14b8a6" /><Line yAxisId="rate" type="monotone" dataKey="conversionRatePct" name="转化率(%)" stroke="#a855f7" /></LineChart></ResponsiveContainer></div>
            <div className="h-80 rounded-xl border p-3"><p className="mb-2 text-sm font-bold text-slate-700">渠道 GMV</p><ResponsiveContainer width="100%" height="90%"><BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis tick={{fontSize:10}} tickFormatter={(value) => Number(value) >= 10000 ? `${Math.round(Number(value)/10000)}万` : String(value)} /><Tooltip formatter={(value:any) => money(value)} /><Legend /><Bar dataKey="liveGmv" name="直播GMV" stackId="channels" fill="#f97316" /><Bar dataKey="videoGmv" name="视频GMV" stackId="channels" fill="#8b5cf6" /></BarChart></ResponsiveContainer></div>
          </div>
        ) : <div className="mt-5 rounded-xl border border-dashed p-10 text-center text-sm text-slate-400">所选期间没有每日店铺数据。上传后会自动生成趋势。</div>}
        {Boolean(missingDates.length) && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">未上传日期：{missingDates.join("、")}（缺失日不会按 0 绘图）</p>}
      </div>

      {Boolean(history.length) && (
        <div className="rounded-xl border bg-white p-4">
          <h4 className="flex items-center gap-2 font-bold text-slate-800"><History className="h-4 w-4 text-orange-500" />{businessDate} 版本历史</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs"><thead><tr className="border-b bg-slate-50 text-left text-slate-500"><th className="p-2">版本</th><th className="p-2">状态</th><th className="p-2">文件</th><th className="p-2">SHA-256</th><th className="p-2">上传人</th><th className="p-2">时间</th><th className="p-2">操作</th></tr></thead><tbody>
              {history.map((entry:any) => <tr key={entry.importId} className={`border-b ${entry.deletedAt ? "bg-red-50/50 text-slate-400" : ""}`}><td className="p-2 font-bold">v{entry.versionNumber}</td><td className="p-2">{entry.deletedAt ? "已删除" : entry.isCurrent ? "当前" : "历史"}</td><td className="max-w-[220px] truncate p-2">{entry.fileName}</td><td className="p-2 font-mono">{String(entry.fileSha256).slice(0,12)}…</td><td className="p-2">{entry.uploadedByName || "—"}</td><td className="p-2">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}</td><td className="p-2"><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => downloadMutation.mutate({importId:Number(entry.importId)})} aria-label="下载原文件"><Download className="h-4 w-4" /></Button>{!entry.isCurrent && <Button size="icon" variant="ghost" onClick={async () => { const reason=window.prompt("恢复理由", "恢复每日历史版本"); if(reason && window.confirm(`恢复 v${entry.versionNumber}？`)){ await restoreMutation.mutateAsync({importId:Number(entry.importId),reason}); await invalidate(); } }} aria-label="恢复版本"><RotateCcw className="h-4 w-4 text-orange-500" /></Button>}{!entry.deletedAt && <Button size="icon" variant="ghost" onClick={async () => { const reason=window.prompt("删除理由", "错误上传"); if(reason && window.confirm(`逻辑删除 v${entry.versionNumber}？`)){ await deleteMutation.mutateAsync({importId:Number(entry.importId),reason}); await invalidate(); } }} aria-label="删除版本"><Trash2 className="h-4 w-4 text-red-500" /></Button>}</div></td></tr>)}
            </tbody></table>
          </div>
        </div>
      )}
    </section>
  );
}
