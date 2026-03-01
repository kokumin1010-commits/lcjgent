import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  ArrowRightLeft,
  Wallet,
  Coins,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function BWExchangeAdmin() {
  // 月選択
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
      });
    }
    return options;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);

  // 月次集計
  const { data: summary, isLoading: summaryLoading } = trpc.beautyWallet.adminGetMonthlySummary.useQuery(
    { month: selectedMonth },
  );

  // 全交換履歴（管理者用）
  const { data: allExchanges, isLoading: exchangesLoading } = trpc.beautyWallet.adminGetAllExchanges.useQuery(
    { month: selectedMonth },
  );

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-violet-500" />
            Beauty Wallet 交換管理
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            LCJポイント → Beauty Token 交換の集計・管理
          </p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* サマリーカード */}
      {summaryLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-violet-100 rounded-full flex items-center justify-center">
                  <ArrowRightLeft className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">交換件数</p>
                  <p className="text-2xl font-bold text-violet-700">
                    {(summary?.totalExchanges ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-rose-100 rounded-full flex items-center justify-center">
                  <Coins className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">消費LCJポイント</p>
                  <p className="text-2xl font-bold text-rose-700">
                    {(summary?.totalLcjPoints ?? 0).toLocaleString()} pt
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">発行BT</p>
                  <p className="text-2xl font-bold text-amber-700">
                    {(summary?.totalBwTokens ?? 0).toLocaleString()} BT
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">交換ユーザー数</p>
                  <p className="text-2xl font-bold text-green-700">
                    {(summary?.uniqueUsers ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 補填額（LCJ → BW社への支払い） */}
      {summary && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <BarChart3 className="h-5 w-5" />
              月次補填額（広告費）
            </CardTitle>
            <CardDescription>
              LCJ → BW社への月次支払い額（1BT = 1円換算）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-blue-700">
                ¥{(summary.totalBwTokens ?? 0).toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">（{selectedMonth}分）</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ※ 100 LCJポイント → 40 BT（= ¥40）の交換レートで計算
            </p>
          </CardContent>
        </Card>
      )}

      {/* 交換履歴一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-gray-600" />
            交換履歴一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          {exchangesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : allExchanges && allExchanges.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">日時</th>
                    <th className="pb-2 font-medium text-muted-foreground">ユーザー</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">LCJポイント</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">BT</th>
                    <th className="pb-2 font-medium text-muted-foreground text-center">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {allExchanges.map((ex: any) => (
                    <tr key={ex.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 text-xs">
                        {format(new Date(ex.createdAt), "M/d HH:mm", { locale: ja })}
                      </td>
                      <td className="py-3">
                        <span className="font-medium">{ex.userName || "不明"}</span>
                      </td>
                      <td className="py-3 text-right font-mono text-rose-600">
                        -{Number(ex.lcjPointsUsed).toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-mono text-violet-600">
                        +{Number(ex.bwTokensReceived).toLocaleString()}
                      </td>
                      <td className="py-3 text-center">
                        {ex.bwTransferStatus === "completed" ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            完了
                          </Badge>
                        ) : ex.bwTransferStatus === "pending" ? (
                          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            処理中
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            失敗
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>この月の交換履歴はありません</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
