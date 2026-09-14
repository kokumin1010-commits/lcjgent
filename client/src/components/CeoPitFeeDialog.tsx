import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, BarChart3, ExternalLink, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type PitFeeDetails = RouterOutputs["ceoCommandCenter"]["pitFeeDetails"];
type PitFeeRecord = PitFeeDetails["records"][number];

function formatJpy(value: number | null | undefined) {
  if (value == null) return "—";
  return `¥${Math.round(value).toLocaleString()} JPY`;
}

function formatOriginal(value: number | null | undefined, currency: "JPY" | "CNY") {
  if (value == null) return currency === "CNY" ? "¥0.00 CNY" : "¥0 JPY";
  return currency === "CNY"
    ? `¥${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CNY`
    : `¥${Math.round(value).toLocaleString()} JPY`;
}

function monthLabel(month: string, zh: boolean) {
  const [year, monthNumber] = month.split("-");
  return zh ? `${year}年${Number(monthNumber)}月` : `${year}年${Number(monthNumber)}月`;
}

function shortMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year.slice(2)}/${Number(monthNumber)}`;
}

function parseReceiptUrls(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url))
      : /^https?:\/\//i.test(value) ? [value] : [];
  } catch {
    return /^https?:\/\//i.test(value) ? [value] : [];
  }
}

function recordTitle(record: PitFeeRecord) {
  return [record.counterparty, record.description]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" · ") || "—";
}

export default function CeoPitFeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { language } = useLanguage();
  const zh = language.startsWith("zh");
  const [selectedMonth, setSelectedMonth] = useState("");
  const detailsQuery = trpc.ceoCommandCenter.pitFeeDetails.useQuery(
    { months: 12 },
    { enabled: open, staleTime: 60_000, refetchOnWindowFocus: false },
  );

  useEffect(() => {
    if (!open || !detailsQuery.data) return;
    const latestRegistered = [...detailsQuery.data.monthly].reverse().find((item) => item.registered);
    setSelectedMonth((current) => detailsQuery.data.monthly.some((item) => item.month === current)
      ? current
      : latestRegistered?.month || detailsQuery.data.monthly.at(-1)?.month || "");
  }, [open, detailsQuery.data]);

  const selectedSummary = detailsQuery.data?.monthly.find((item) => item.month === selectedMonth);
  const selectedRecords = useMemo(
    () => (detailsQuery.data?.records || []).filter((record) => record.transactionDate.startsWith(selectedMonth)),
    [detailsQuery.data?.records, selectedMonth],
  );
  const chartData = (detailsQuery.data?.monthly || []).map((item) => ({
    ...item,
    label: shortMonthLabel(item.month),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-amber-50 via-white to-orange-50 px-5 pt-5 pb-4 sm:px-7">
          <div className="flex flex-col justify-between gap-3 pr-8 sm:flex-row sm:items-start">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl"><Banknote className="h-5 w-5 text-amber-600" />{zh ? "坑位费收入・月度推移与逐笔明细" : "坑位费収入・月次推移と明細"}</DialogTitle>
              <DialogDescription className="mt-2 max-w-4xl leading-6">
                {zh ? "CEO本人专用只读数据。无需财务密码；只显示“売上高-ライブ枠料収入”，不包含工资或其他财务明细。" : "CEO本人専用の読み取り専用データです。財務パスワード不要で「売上高-ライブ枠料収入」だけを表示し、給与や他の財務明細は含みません。"}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><ShieldCheck className="mr-1 h-3.5 w-3.5" />CEO {zh ? "只读" : "読み取り専用"}</Badge>
              <Button type="button" size="sm" variant="outline" onClick={() => detailsQuery.refetch()} disabled={detailsQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${detailsQuery.isFetching ? "animate-spin" : ""}`} />{zh ? "更新" : "更新"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
          {detailsQuery.isLoading ? (
            <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-80 w-full" /><Skeleton className="h-72 w-full" /></div>
          ) : detailsQuery.isError || !detailsQuery.data ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-center">
              <p className="font-semibold text-rose-800">{zh ? "坑位费明细读取失败" : "坑位费明細を読み込めませんでした"}</p>
              <p className="mt-2 text-sm text-rose-700">{zh ? "没有写入任何数据。请重试。" : "データへの書き込みは行っていません。再試行してください。"}</p>
              <Button className="mt-4" variant="outline" onClick={() => detailsQuery.refetch()}>{zh ? "重试" : "再試行"}</Button>
            </div>
          ) : (
            <div className="space-y-5">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-medium text-amber-800">{zh ? "12个月累计・JPY参考" : "12か月累計・JPY参考"}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{detailsQuery.data.total.registered ? formatJpy(detailsQuery.data.total.referenceJpy) : (zh ? "未登记" : "未登録")}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs text-slate-500">{zh ? "原币累计" : "原通貨累計"}</p>
                  <p className="mt-2 font-semibold text-slate-950">{formatOriginal(detailsQuery.data.total.jpy, "JPY")}</p>
                  <p className="mt-1 font-semibold text-slate-950">{formatOriginal(detailsQuery.data.total.cny, "CNY")}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs text-slate-500">{zh ? "登记件数" : "登録件数"}</p>
                  <p className="mt-2 text-2xl font-semibold">{detailsQuery.data.total.recordCount}{zh ? "笔" : "件"}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs text-slate-500">{zh ? "管理参考汇率" : "管理参考レート"}</p>
                  <p className="mt-2 text-xl font-semibold">1 CNY = {detailsQuery.data.referenceRateCnyToJpy} JPY</p>
                  <p className="mt-1 text-xs text-slate-500">{zh ? "仅用于管理参考，不改写原币" : "管理参考のみ・原通貨は変更しません"}</p>
                </div>
              </section>

              <section className="rounded-xl border bg-white p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-amber-600" />{zh ? "坑位费月度推移" : "坑位费月次推移"}</h3>
                    <p className="mt-1 text-xs text-slate-500">{detailsQuery.data.period.start} ～ {detailsQuery.data.period.end} · {zh ? "未登记月份不会显示为实际收入0" : "未登録月は実績0として扱いません"}</p>
                  </div>
                  <Badge variant="outline">{zh ? "柱：JPY参考／线：件数" : "棒：JPY参考／線：件数"}</Badge>
                </div>
                <div className="mt-4 h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="amount" tick={{ fontSize: 11 }} width={68} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                      <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                      <Tooltip formatter={(value: number, name: string) => [name.includes("件") ? `${value}${zh ? "笔" : "件"}` : formatJpy(value), name]} labelFormatter={(label) => `${zh ? "月份" : "月"} ${label}`} />
                      <Bar yAxisId="amount" dataKey="referenceJpy" name={zh ? "坑位费JPY参考" : "坑位费JPY参考"} fill="#d97706" radius={[5, 5, 0, 0]} />
                      <Line yAxisId="count" type="monotone" dataKey="recordCount" name={zh ? "件数" : "件数"} stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-xl border bg-white">
                <div className="border-b p-4 sm:p-5">
                  <h3 className="font-semibold">{zh ? "选择月份查看逐笔明细" : "月を選んで明細を確認"}</h3>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {detailsQuery.data.monthly.map((item) => (
                      <button key={item.month} type="button" onClick={() => setSelectedMonth(item.month)} className={`min-w-[112px] rounded-lg border px-3 py-2 text-left transition ${selectedMonth === item.month ? "border-amber-500 bg-amber-50 text-amber-900" : "bg-white hover:border-amber-300"}`}>
                        <p className="text-xs font-medium">{shortMonthLabel(item.month)}</p>
                        <p className="mt-1 text-sm font-semibold">{item.registered ? formatJpy(item.referenceJpy) : (zh ? "未登记" : "未登録")}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{item.recordCount}{zh ? "笔" : "件"}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-3 border-b bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                  <div>
                    <p className="font-semibold">{selectedMonth ? monthLabel(selectedMonth, zh) : "—"}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedSummary?.registered ? `${selectedSummary.recordCount}${zh ? "笔" : "件"} · ${formatOriginal(selectedSummary.jpy, "JPY")} · ${formatOriginal(selectedSummary.cny, "CNY")}` : (zh ? "该月没有登记记录" : "この月の登録記録はありません")}</p>
                  </div>
                  <p className="text-lg font-semibold text-amber-700">{selectedSummary?.registered ? formatJpy(selectedSummary.referenceJpy) : "—"}</p>
                </div>

                {selectedRecords.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">{zh ? "该月没有登记坑位费收入。未登记不代表实际收入为0。" : "この月の坑位费収入は未登録です。実際の収入が0とは限りません。"}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1120px] w-full text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr><th className="p-3 text-left">{zh ? "日期" : "日付"}</th><th className="p-3 text-left">{zh ? "法人" : "法人"}</th><th className="p-3 text-left">{zh ? "内容" : "内容"}</th><th className="p-3 text-left">{zh ? "我方账户" : "自社口座"}</th><th className="p-3 text-right">{zh ? "原币金额" : "原通貨金額"}</th><th className="p-3 text-right">JPY{zh ? "参考" : "参考"}</th><th className="p-3 text-center">PDF／{zh ? "证凭" : "証憑"}</th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedRecords.map((record) => {
                          const receipts = parseReceiptUrls(record.receiptUrl);
                          return (
                            <tr key={record.id} className="align-top hover:bg-amber-50/40">
                              <td className="whitespace-nowrap p-3">{record.transactionDate}</td>
                              <td className="whitespace-nowrap p-3">{record.entity === "china" ? (zh ? "中国法人" : "中国法人") : (zh ? "日本法人" : "日本法人")}</td>
                              <td className="max-w-[440px] whitespace-normal p-3"><p className="font-medium text-slate-900">{recordTitle(record)}</p></td>
                              <td className="whitespace-nowrap p-3">{record.sourceAccount || (zh ? "未指定" : "未指定")}</td>
                              <td className="whitespace-nowrap p-3 text-right font-medium">{formatOriginal(record.amount, record.currency)}</td>
                              <td className="whitespace-nowrap p-3 text-right font-medium text-amber-700">{formatJpy(record.referenceJpy)}</td>
                              <td className="p-3 text-center">
                                {receipts.length > 0 ? (
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {receipts.map((url, index) => <Button key={`${record.id}-${index}`} type="button" size="sm" variant="outline" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}><FileText className="mr-1 h-3.5 w-3.5" />{index + 1}<ExternalLink className="ml-1 h-3 w-3" /></Button>)}
                                  </div>
                                ) : <span className="text-xs text-slate-400">{zh ? "未登记" : "未登録"}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
                {zh ? "口径：仅统计未删除、收入类型且分类为“売上高-ライブ枠料収入”的银行流水。JPY保持原额；CNY按共同管理参考汇率换算。这里是现金收入，不等于会计营业利润。" : "口径：未削除・入金・カテゴリ「売上高-ライブ枠料収入」の銀行流水だけを集計します。JPYは原額、CNYは共通管理参考レートで換算します。これは現金収入であり、会計上の営業利益ではありません。"}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
