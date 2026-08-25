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

export default function HistoricalProductCatalogPanel() {
  const [open, setOpen] = useState(false);
  const { data: overview, isLoading } = trpc.reportsAccountsProductsRecovery.overview.useQuery();
  const rows = overview?.historicalProducts || [];

  return (
    <Card className="border-slate-300 bg-slate-50/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Archive className="h-4 w-4 text-slate-700" />これまでの旧商品目录</h3>
            <p className="text-xs text-muted-foreground mt-1">旧`product_master`に残った10件を読み取り専用で表示します。現在の40件には混入せず、名称が途中で切れた行も証拠どおり保持します。</p>
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
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="p-3">旧ID</th><th className="p-3">保存名称</th><th className="p-3">価格</th><th className="p-3">名称状態</th><th className="p-3">画像</th><th className="p-3">扱い</th></tr>
              </thead>
              <tbody>
                {rows.map((row: any) => (
                  <tr key={`${row.sourceTable}:${row.sourceId}`} className="border-t">
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
