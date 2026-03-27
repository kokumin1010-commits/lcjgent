import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Search, ChevronLeft, ChevronRight, Mail, MailOpen, MousePointerClick, AlertCircle, CheckCircle2, XCircle, SkipForward } from "lucide-react";

export default function StepEmailLogs() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = trpc.stepEmail.getLogs.useQuery({
    page,
    limit: 30,
    status: status || undefined,
    search: search || undefined,
  });

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.limit));
  }, [data]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "sent":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />送信済</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />失敗</Badge>;
      case "skipped":
        return <Badge variant="secondary"><SkipForward className="h-3 w-3 mr-1" />スキップ</Badge>;
      default:
        return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            送信履歴
          </h1>
          <p className="text-muted-foreground mt-1">
            ステップメールの送信ログを確認できます
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="メールアドレスで検索..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button variant="outline" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="ステータス" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="sent">送信済</SelectItem>
                  <SelectItem value="failed">失敗</SelectItem>
                  <SelectItem value="skipped">スキップ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <Mail className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <p className="text-2xl font-bold">{data.total}</p>
                <p className="text-xs text-muted-foreground">総送信数</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                <p className="text-2xl font-bold text-green-600">
                  {data.logs.filter((l) => l.log.status === "sent").length}
                </p>
                <p className="text-xs text-muted-foreground">このページの送信済</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <MailOpen className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                <p className="text-2xl font-bold text-purple-600">
                  {data.logs.filter((l) => l.log.openedAt).length}
                </p>
                <p className="text-xs text-muted-foreground">開封済</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <MousePointerClick className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <p className="text-2xl font-bold text-orange-600">
                  {data.logs.filter((l) => l.log.clickedAt).length}
                </p>
                <p className="text-xs text-muted-foreground">クリック済</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">送信ログ一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : !data || data.logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>送信ログがありません</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>送信日時</TableHead>
                        <TableHead>テンプレート</TableHead>
                        <TableHead>宛先</TableHead>
                        <TableHead>ステータス</TableHead>
                        <TableHead className="text-center">開封</TableHead>
                        <TableHead className="text-center">クリック</TableHead>
                        <TableHead>エラー</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.logs.map((row) => (
                        <TableRow key={row.log.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {row.log.sentAt ? new Date(row.log.sentAt).toLocaleString("ja-JP") : "-"}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{row.templateName || `ID:${row.log.templateId}`}</span>
                          </TableCell>
                          <TableCell className="text-sm">{row.log.email}</TableCell>
                          <TableCell>{statusBadge(row.log.status)}</TableCell>
                          <TableCell className="text-center">
                            {row.log.openedAt ? (
                              <div className="flex flex-col items-center">
                                <MailOpen className="h-4 w-4 text-purple-500" />
                                <span className="text-xs text-muted-foreground">{row.log.openCount}回</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.log.clickedAt ? (
                              <div className="flex flex-col items-center">
                                <MousePointerClick className="h-4 w-4 text-orange-500" />
                                <span className="text-xs text-muted-foreground">{row.log.clickCount}回</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.log.errorMessage ? (
                              <span className="text-xs text-destructive truncate max-w-[200px] block" title={row.log.errorMessage}>
                                {row.log.errorMessage.substring(0, 50)}...
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    全{data.total}件中 {(page - 1) * data.limit + 1}-{Math.min(page * data.limit, data.total)}件
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center text-sm px-2">
                      {page} / {totalPages}
                    </span>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
