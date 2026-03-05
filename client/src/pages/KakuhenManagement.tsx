import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Zap,
  Trophy,
  TrendingUp,
  BarChart3,
  Users,
  Gift,
  Percent,
  Target,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Sparkles,
  Download,
  ExternalLink,
  Search,
  Filter,
} from "lucide-react";

function formatDate(dateStr: string | number | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(amount);
}

function getResultBadge(isKakuhen: boolean, isJackpot: boolean) {
  if (isJackpot) {
    return (
      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 text-xs">
        <Trophy className="w-3 h-3 mr-1" />
        全額還元
      </Badge>
    );
  }
  if (isKakuhen) {
    return (
      <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0 text-xs">
        <Zap className="w-3 h-3 mr-1" />
        1.5% UP
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      通常 1%
    </Badge>
  );
}

export default function KakuhenManagement() {
  const [page, setPage] = useState(0);
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const PAGE_SIZE = 50;

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = trpc.kakuhen.stats.useQuery();
  // Fetch all results with details
  const { data: allResults, isLoading: resultsLoading } = trpc.kakuhen.allResults.useQuery({
    limit: 200,
    offset: 0,
  });
  // Fetch total receipts count for participation rate
  const { data: totalReceiptsData } = trpc.kakuhen.totalReceiptsCount.useQuery();

  const totalPlays = stats?.totalPlays || 0;
  const jackpotCount = stats?.jackpotCount || 0;
  const kakuhenCount = stats?.kakuhenCount || 0;
  const totalBonusPoints = stats?.totalBonusPoints || 0;
  const totalOrderAmount = stats?.totalOrderAmount || 0;
  const kakuhenRate = totalPlays > 0 ? ((Number(kakuhenCount) / Number(totalPlays)) * 100).toFixed(1) : "0.0";
  const totalReceipts = totalReceiptsData?.total || 0;
  const participationRate = totalReceipts > 0 ? ((Number(totalPlays) / totalReceipts) * 100).toFixed(1) : "0.0";

  // Filter and search results
  const filteredResults = useMemo(() => {
    if (!allResults) return [];
    return allResults.filter((r: any) => {
      // Result type filter
      if (resultFilter === "kakuhen" && !r.kakuhen.isKakuhen) return false;
      if (resultFilter === "jackpot" && !r.kakuhen.isJackpot) return false;
      if (resultFilter === "normal" && r.kakuhen.isKakuhen) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const userName = (r.userName || r.lineUserName || "").toLowerCase();
        const tiktokUrl = (r.kakuhen.tiktokUrl || "").toLowerCase();
        return userName.includes(q) || tiktokUrl.includes(q);
      }
      return true;
    });
  }, [allResults, resultFilter, searchQuery]);

  // Paginated results
  const paginatedResults = useMemo(() => {
    return filteredResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filteredResults, page]);

  const totalPages = Math.ceil(filteredResults.length / PAGE_SIZE);

  // CSV Export
  const handleCsvExport = () => {
    if (!allResults || allResults.length === 0) return;
    const headers = ["ID", "ユーザー名", "種別", "参加日時", "注文金額", "基本ポイント", "実際ポイント", "ボーナスポイント", "還元率", "確変", "全額還元", "TikTok URL"];
    const rows = allResults.map((r: any) => [
      r.kakuhen.id,
      r.userName || r.lineUserName || "-",
      r.kakuhen.receiptType === "line_receipt" ? "LINE" : "Web",
      new Date(r.kakuhen.createdAt).toISOString(),
      r.kakuhen.orderAmount,
      r.kakuhen.basePoints,
      r.kakuhen.actualPoints,
      r.kakuhen.bonusPoints,
      `${r.kakuhen.boostedRate}%`,
      r.kakuhen.isKakuhen ? "YES" : "NO",
      r.kakuhen.isJackpot ? "YES" : "NO",
      r.kakuhen.tiktokUrl || "",
    ]);
    const csv = [headers.join(","), ...rows.map((row: any[]) => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kakuhen_results_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">総プレイ回数</span>
              <Zap className="h-4 w-4 text-orange-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{Number(totalPlays).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">全額還元当選</span>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{Number(jackpotCount)}</span>
                <span className="text-xs text-muted-foreground">回</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">確変発動率</span>
              <Percent className="h-4 w-4 text-emerald-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{kakuhenRate}%</span>
                <span className="text-xs text-muted-foreground">({Number(kakuhenCount)}回)</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">参加率</span>
              <BarChart3 className="h-4 w-4 text-blue-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{participationRate}%</span>
                <span className="text-xs text-muted-foreground">({Number(totalPlays)}/{totalReceipts})</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">ブースト付与pt</span>
              <Sparkles className="h-4 w-4 text-pink-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{Number(totalBonusPoints).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kakuhen History Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              確変チャンス履歴
              {filteredResults.length > 0 && (
                <Badge variant="secondary" className="text-xs">{filteredResults.length}件</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="ユーザー名/URL検索..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  className="pl-8 h-8 text-sm w-48"
                />
              </div>
              <Select value={resultFilter} onValueChange={(v) => { setResultFilter(v); setPage(0); }}>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="kakuhen">確変のみ</SelectItem>
                  <SelectItem value="jackpot">全額還元のみ</SelectItem>
                  <SelectItem value="normal">通常のみ</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleCsvExport} disabled={!allResults || allResults.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {resultsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : paginatedResults.length > 0 ? (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-2 font-medium text-muted-foreground text-xs">ユーザー</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground text-xs">種別</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground text-xs">参加日時</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground text-xs text-right">注文金額</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground text-xs text-right">ポイント</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground text-xs">結果</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground text-xs">TikTok URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.map((r: any) => (
                      <tr key={r.kakuhen.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-2">
                          <span className="font-medium text-xs truncate max-w-[120px] block">
                            {r.userName || r.lineUserName || `ID:${r.kakuhen.userId || r.kakuhen.lineUserId || "-"}`}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {r.kakuhen.receiptType === "line_receipt" ? "LINE" : "Web"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(r.kakuhen.createdAt)}
                        </td>
                        <td className="py-2 px-2 text-xs text-right font-medium whitespace-nowrap">
                          {formatCurrency(r.kakuhen.orderAmount)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="text-xs">
                            <span className="text-muted-foreground">{r.kakuhen.basePoints}pt</span>
                            <span className="mx-1">→</span>
                            <span className={`font-bold ${r.kakuhen.isKakuhen ? "text-pink-600" : ""}`}>
                              {r.kakuhen.actualPoints}pt
                            </span>
                            {r.kakuhen.bonusPoints > 0 && (
                              <span className="text-green-600 text-[10px] ml-1">(+{r.kakuhen.bonusPoints})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          {getResultBadge(r.kakuhen.isKakuhen, r.kakuhen.isJackpot)}
                        </td>
                        <td className="py-2 px-2">
                          {r.kakuhen.tiktokUrl ? (
                            <a
                              href={r.kakuhen.tiktokUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline text-xs flex items-center gap-1 max-w-[200px] truncate"
                              title={r.kakuhen.tiktokUrl}
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{r.kakuhen.tiktokUrl.replace(/^https?:\/\/(www\.)?/, "")}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredResults.length)} / {filteredResults.length}件
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{page + 1} / {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {searchQuery || resultFilter !== "all" ? "条件に一致する結果がありません" : "まだ確変チャンスの参加履歴がありません"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ユーザーがレシート申請時にTikTok URLを入力すると、ここに表示されます
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kakuhen Mechanism Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            確変チャンスの仕組み
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">還元率UP</span>
              </div>
              <p className="text-xs text-muted-foreground">
                TikTok URL入力で基本還元率1%が最大1.5%にUP。メーターアニメーションで演出。
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-yellow-500" />
                <span className="font-medium text-sm">全額還元抽選</span>
              </div>
              <p className="text-xs text-muted-foreground">
                スロット演出で全額ポイントバックのチャンス。当選番号がランダム生成される。
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-pink-500" />
                <span className="font-medium text-sm">TikTokマーケティング</span>
              </div>
              <p className="text-xs text-muted-foreground">
                収集したTikTok URLをCSVエクスポートしてマーケティング分析に活用可能。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
