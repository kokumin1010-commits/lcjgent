import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Archive, ChevronDown, ChevronUp, ImageOff } from "lucide-react";

function money(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? `¥${number.toLocaleString()}` : "-";
}

function sourceLabel(value: unknown): string {
  if (value === "product_master") return "旧商品主档";
  if (value === "livestream_products_aggregate") return "旧直播商品集計";
  if (value === "receipt_reviews_sample") return "收据评价样本";
  return String(value || "保存証拠");
}

export default function HistoricalProductCatalogPanel() {
  const [open, setOpen] = useState(false);
  const { data: overview, isLoading } = trpc.reportsAccountsProductsRecovery.overview.useQuery();
  const rows = overview?.historicalProducts || [];

  return (
    <Card className="border-slate-300 bg-slate-50/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Archive className="h-4 w-4 text-slate-700" />これまでの旧商品証拠目录</h3>
            <p className="text-xs text-muted-foreground mt-1">保存済み旧商品主档・ライブ商品集計・收据评价样本を読み取り専用で表示します。直接証拠が揃った38件は下の主商品一覧に「オフライン」で復元し、この目录は重複IDや一部欠損名も証拠どおり保持します。</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white">{isLoading ? "..." : `${rows.length}件`}</Badge>
            <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
              {open ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {open ? "閉じる" : "表示"}
            </Button>
          </div>
        </div>

        {open && (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="p-3">来源</th><th className="p-3">旧ID</th><th className="p-3">保存名称</th><th className="p-3">価格</th><th className="p-3">名称状態</th><th className="p-3">画像</th><th className="p-3">扱い</th></tr>
              </thead>
              <tbody>
                {rows.map((row: any) => (
                  <tr key={`${row.sourceTable}:${row.sourceId}`} className="border-t">
                    <td className="p-3"><Badge variant="outline" className="whitespace-nowrap">{sourceLabel(row.sourceTable)}</Badge></td>
                    <td className="p-3 font-mono text-xs">{row.sourceId}</td>
                    <td className="p-3 max-w-[360px]">{row.displayName || "名称未復元"}</td>
                    <td className="p-3">{money(row.specialPrice ?? row.regularPrice)}</td>
                    <td className="p-3"><Badge variant="outline" className={row.nameCompleteness === "preserved" ? "text-emerald-700 border-emerald-200" : "text-amber-700 border-amber-200"}>{row.nameCompleteness === "preserved" ? "保存済み" : "一部欠損"}</Badge></td>
                    <td className="p-3"><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ImageOff className="h-3.5 w-3.5" />{row.sourceImageStatus || "未復元"}</span></td>
                    <td className="p-3"><Badge variant="secondary">読み取り専用</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
