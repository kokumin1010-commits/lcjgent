import { useState } from "react";
import { BadgePercent, BarChart3, Loader2, Pencil, WalletCards } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { LiverAdStatus } from "../../../shared/liverAdEffect";

interface LiverAdEffectPanelProps {
  language: string;
}

function currentJstMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()).slice(0, 7);
}

function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `¥${Math.round(value).toLocaleString()}`;
}

function formatNumber(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined ? "—" : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default function LiverAdEffectPanel({ language }: LiverAdEffectPanelProps) {
  const isZh = language.startsWith("zh");
  const [yearMonth, setYearMonth] = useState(currentJstMonth());
  const [editing, setEditing] = useState<{ id: number; status: LiverAdStatus; cost: string } | null>(null);
  const dashboard = trpc.liver.adEffectDashboard.useQuery({ yearMonth }, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const updateAdCost = trpc.liver.updateLivestreamAdCost.useMutation({
    onSuccess: async () => {
      toast.success(isZh ? "广告费已保存" : "広告費を保存しました");
      setEditing(null);
      await dashboard.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const data = dashboard.data;
  const metricRows = data ? [
    { label: isZh ? "平均GMV" : "平均GMV", metric: data.differences.averageGmv, money: true },
    { label: isZh ? "平均订单" : "平均注文数", metric: data.differences.averageOrders },
    { label: isZh ? "平均销量" : "平均販売数", metric: data.differences.averageItemsSold },
    { label: isZh ? "平均观看人数" : "平均視聴者数", metric: data.differences.averageViewers },
    { label: isZh ? "观看转化率" : "視聴者転換率", metric: data.differences.averageViewerConversionRate, percent: true },
    { label: isZh ? "每小时GMV" : "1時間あたりGMV", metric: data.differences.averageGmvPerHour, money: true },
  ] : [];

  const statusLabel = (status: LiverAdStatus) => status === "paid"
    ? (isZh ? "有广告" : "広告あり")
    : status === "none"
      ? (isZh ? "无广告" : "広告なし")
      : (isZh ? "广告费未登记" : "広告費未登録");

  return (
    <Card data-testid="liver-ad-effect-panel" className="bg-gray-900 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-yellow-400" />
            {isZh ? "广告效果对比" : "広告効果比較"}
          </CardTitle>
          <Input
            aria-label={isZh ? "对比月份" : "比較月"}
            type="month"
            value={yearMonth}
            onChange={(event) => setYearMonth(event.target.value)}
            className="w-full sm:w-40 bg-gray-800 border-gray-700 text-white"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {dashboard.isLoading ? (
          <div className="flex items-center justify-center py-8 text-white/70">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {isZh ? "读取中" : "読み込み中"}
          </div>
        ) : dashboard.isError ? (
          <p className="text-sm text-red-300">{dashboard.error.message}</p>
        ) : !data || data.records.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800/70 p-4 text-sm text-white/80">
            {isZh ? "这个月还没有直播记录。保存直播和广告状态后会自动显示比较。" : "この月の配信記録はまだありません。配信と広告状況を保存すると自動で比較されます。"}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-purple-500/40 bg-purple-500/10 p-3">
                <p className="text-xs text-purple-200">{isZh ? "有广告场次" : "広告あり配信"}</p>
                <p className="text-2xl font-bold text-white">{data.paid.streamCount}</p>
                <p className="text-xs text-white/70">{isZh ? "广告费合计" : "広告費合計"} {formatCurrency(data.paid.totalAdCost)}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                <p className="text-xs text-emerald-200">{isZh ? "无广告场次" : "広告なし配信"}</p>
                <p className="text-2xl font-bold text-white">{data.none.streamCount}</p>
                <p className="text-xs text-white/70">{isZh ? "明确登记为0" : "明示的に0円で登録"}</p>
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="text-xs text-amber-200">{isZh ? "未登记" : "未登録"}</p>
                <p className="text-2xl font-bold text-white">{data.unknownCount}</p>
                <p className="text-xs text-white/70">{isZh ? "不纳入比较" : "比較対象外"}</p>
              </div>
            </div>

            {data.comparable ? (
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-gray-800 text-white/80">
                    <tr>
                      <th className="text-left px-3 py-2">{isZh ? "指标" : "指標"}</th>
                      <th className="text-right px-3 py-2">{isZh ? "有广告" : "広告あり"}</th>
                      <th className="text-right px-3 py-2">{isZh ? "无广告" : "広告なし"}</th>
                      <th className="text-right px-3 py-2">{isZh ? "差异" : "差"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricRows.map(({ label, metric, money, percent }) => {
                      const formatter = money ? formatCurrency : (value: number | null) => formatNumber(value, percent ? "%" : "");
                      return (
                        <tr key={label} className="border-t border-gray-700">
                          <td className="px-3 py-2 text-white">{label}</td>
                          <td className="px-3 py-2 text-right text-purple-200">{formatter(metric.paid)}</td>
                          <td className="px-3 py-2 text-right text-emerald-200">{formatter(metric.none)}</td>
                          <td className={`px-3 py-2 text-right ${metric.absolute !== null && metric.absolute > 0 ? "text-green-400" : metric.absolute !== null && metric.absolute < 0 ? "text-red-400" : "text-white/70"}`}>
                            {metric.absolute === null ? "—" : `${metric.absolute > 0 ? "+" : ""}${money ? formatCurrency(metric.absolute).replace("¥-", "-¥") : formatNumber(metric.absolute, percent ? "%" : "")}`}
                            {metric.percent !== null && <span className="ml-1 text-xs">({metric.percent > 0 ? "+" : ""}{metric.percent}%)</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">
                {isZh ? "要比较广告效果，至少需要1场明确有广告和1场明确无广告的直播。" : "広告効果を比較するには、広告あり・広告なしをそれぞれ1件以上登録してください。"}
              </div>
            )}

            {(data.paid.streamCount > 0 || data.none.streamCount > 0) && (!data.paid.sampleSufficient || !data.none.sampleSufficient) && (
              <p className="text-xs text-amber-300">
                {isZh ? "样本不足：任一组少于2场时只能作为参考，不能证明广告造成了差异。" : "サンプル不足：どちらかが2件未満の場合は参考値であり、広告が差を生んだとは断定できません。"}
              </p>
            )}

            {data.paid.streamCount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-800 p-3">
                  <p className="text-xs text-white/60">{isZh ? "平均ROAS" : "平均ROAS"}</p>
                  <p className="text-lg font-semibold text-yellow-400">{formatNumber(data.paid.averageRoas.value, "x")}</p>
                </div>
                <div className="rounded-lg bg-gray-800 p-3">
                  <p className="text-xs text-white/60">{isZh ? "平均每单广告成本" : "平均広告費/注文"}</p>
                  <p className="text-lg font-semibold text-yellow-400">{formatCurrency(data.paid.averageAdCostPerOrder.value)}</p>
                </div>
                <div className="rounded-lg bg-gray-800 p-3">
                  <p className="text-xs text-white/60">{isZh ? "广告后销售贡献" : "広告費控除後売上寄与"}</p>
                  <p className="text-lg font-semibold text-yellow-400">{formatCurrency(data.paid.averageAdAdjustedSalesContribution.value)}</p>
                </div>
              </div>
            )}

            <p className="text-[11px] text-white/50">
              {isZh ? "广告后销售贡献=GMV−广告费，不是净利润；未扣商品成本、佣金、平台费和退货。比较表示相关差异，不代表因果。" : "広告費控除後売上寄与=GMV−広告費であり、純利益ではありません。原価・手数料・返品は未控除です。比較は相関差であり因果を示しません。"}
            </p>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-yellow-400" />
                {isZh ? "每场直播广告费" : "配信ごとの広告費"}
              </h3>
              <div className="space-y-2">
                {data.records.map((record) => (
                  <div key={record.id} data-testid={`liver-ad-record-${record.id}`} className="rounded-lg border border-gray-700 bg-gray-800/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{formatDate(record.livestreamDate)} · {record.brandName || (isZh ? "品牌未设置" : "ブランド未設定")}</p>
                        <p className={`text-xs mt-1 ${record.adStatus === "paid" ? "text-purple-300" : record.adStatus === "none" ? "text-emerald-300" : "text-amber-300"}`}>
                          {statusLabel(record.adStatus)} {record.adCost !== null ? formatCurrency(record.adCost) : ""}
                          {record.adCostSource === "linked" && ` · ${isZh ? "来自关联广告记录" : "広告記録から連携"}`}
                          {record.adCostConflict && ` · ${isZh ? "金额待核对" : "金額要確認"}`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-gray-600 bg-gray-900 text-white hover:bg-gray-700"
                        onClick={() => setEditing({ id: record.id, status: record.adStatus, cost: record.adCost === null ? "" : String(record.adCost) })}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        {isZh ? "登记" : "登録"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                      <div><span className="text-white/50">GMV</span><p className="text-white">{formatCurrency(record.gmv)}</p></div>
                      <div><span className="text-white/50">{isZh ? "订单" : "注文"}</span><p className="text-white">{formatNumber(record.orderCount)}</p></div>
                      <div><span className="text-white/50">{isZh ? "销量" : "販売数"}</span><p className="text-white">{formatNumber(record.itemsSold)}</p></div>
                      <div><span className="text-white/50">ROAS</span><p className="text-white">{formatNumber(record.roas, "x")}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent data-testid="liver-ad-cost-dialog" className="bg-gray-900 border-gray-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5 text-yellow-400" />
              {isZh ? "登记广告费" : "広告費を登録"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{isZh ? "广告状态" : "広告状況"}</Label>
                <Select value={editing.status} onValueChange={(value: LiverAdStatus) => setEditing({ ...editing, status: value, cost: value === "none" ? "0" : value === "unknown" ? "" : editing.cost })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">{isZh ? "未登记" : "未登録"}</SelectItem>
                    <SelectItem value="none">{isZh ? "无广告（0日元）" : "広告なし（0円）"}</SelectItem>
                    <SelectItem value="paid">{isZh ? "有广告" : "広告あり"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.status === "paid" && (
                <div className="space-y-2">
                  <Label>{isZh ? "实际广告费（日元）" : "実広告費（円）"}</Label>
                  <Input
                    aria-label={isZh ? "实际广告费（日元）" : "実広告費（円）"}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={editing.cost}
                    onChange={(event) => setEditing({ ...editing, cost: event.target.value })}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} className="border-gray-600 bg-gray-800 text-white">
              {isZh ? "取消" : "キャンセル"}
            </Button>
            <Button
              type="button"
              disabled={!editing || updateAdCost.isPending || (editing.status === "paid" && (!editing.cost || Number(editing.cost) <= 0))}
              onClick={() => {
                if (!editing) return;
                updateAdCost.mutate({
                  livestreamId: editing.id,
                  adStatus: editing.status,
                  adCost: editing.status === "paid" ? Number(editing.cost) : editing.status === "none" ? 0 : null,
                });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {updateAdCost.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isZh ? "保存" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
