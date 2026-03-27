import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Mail, MailOpen, MousePointerClick, XCircle, BarChart3, Send, Eye, Percent } from "lucide-react";

function KPICard({ icon: Icon, label, value, subValue, color }: { icon: any; label: string; value: string | number; subValue?: string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StepEmailAnalytics() {
  const { data, isLoading } = trpc.stepEmail.getAnalytics.useQuery();

  const overall = data?.overall;
  const openRate = useMemo(() => {
    if (!overall || !overall.totalSent) return 0;
    return Math.round((Number(overall.totalOpened) / Number(overall.totalSent)) * 100);
  }, [overall]);

  const clickRate = useMemo(() => {
    if (!overall || !overall.totalSent) return 0;
    return Math.round((Number(overall.totalClicked) / Number(overall.totalSent)) * 100);
  }, [overall]);

  const ctr = useMemo(() => {
    if (!overall || !overall.totalOpened) return 0;
    return Math.round((Number(overall.totalClicked) / Number(overall.totalOpened)) * 100);
  }, [overall]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            メールアナリティクス
          </h1>
          <p className="text-muted-foreground mt-1">
            ステップメールの開封率・クリック率・送信パフォーマンスを分析
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-5"><div className="h-16 bg-muted rounded" /></CardContent>
              </Card>
            ))}
          </div>
        ) : !overall ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">データがありません</h3>
              <p className="text-muted-foreground">ステップメールが送信されるとアナリティクスが表示されます</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <KPICard icon={Send} label="総送信数" value={Number(overall.totalSent)} color="bg-blue-500" />
              <KPICard icon={MailOpen} label="開封数" value={Number(overall.totalOpened)} subValue={`開封率 ${openRate}%`} color="bg-purple-500" />
              <KPICard icon={MousePointerClick} label="クリック数" value={Number(overall.totalClicked)} subValue={`クリック率 ${clickRate}%`} color="bg-orange-500" />
              <KPICard icon={Eye} label="総開封回数" value={Number(overall.totalOpenCount)} subValue="重複含む" color="bg-indigo-500" />
              <KPICard icon={XCircle} label="失敗数" value={Number(overall.totalFailed)} color="bg-red-500" />
              <KPICard icon={Percent} label="CTR (開封→クリック)" value={`${ctr}%`} color="bg-emerald-500" />
            </div>

            {/* Per-Template Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  テンプレート別パフォーマンス
                </CardTitle>
                <CardDescription>各テンプレートの送信・開封・クリック数</CardDescription>
              </CardHeader>
              <CardContent>
                {data.perTemplate.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">テンプレート別データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>テンプレート</TableHead>
                          <TableHead>遅延</TableHead>
                          <TableHead className="text-right">送信</TableHead>
                          <TableHead className="text-right">開封</TableHead>
                          <TableHead>開封率</TableHead>
                          <TableHead className="text-right">クリック</TableHead>
                          <TableHead>クリック率</TableHead>
                          <TableHead className="text-right">失敗</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.perTemplate.map((row) => {
                          const sent = Number(row.sent);
                          const opened = Number(row.opened);
                          const clicked = Number(row.clicked);
                          const failed = Number(row.failed);
                          const oRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
                          const cRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
                          return (
                            <TableRow key={row.templateId}>
                              <TableCell className="font-medium">{row.templateName || `ID:${row.templateId}`}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {row.delayDays === 0 ? "即日" : `${row.delayDays}日後`}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">{sent}</TableCell>
                              <TableCell className="text-right font-mono">{opened}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MiniBar value={oRate} max={100} color="bg-purple-500" />
                                  <span className="text-xs font-mono w-10 text-right">{oRate}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">{clicked}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MiniBar value={cRate} max={100} color="bg-orange-500" />
                                  <span className="text-xs font-mono w-10 text-right">{cRate}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {failed > 0 ? (
                                  <Badge variant="destructive">{failed}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  日別送信トレンド（過去30日）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.dailyTrend.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">日別データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex gap-1 items-end min-w-[600px] h-40">
                      {data.dailyTrend.map((day) => {
                        const sent = Number(day.sent);
                        const opened = Number(day.opened);
                        const maxVal = Math.max(...data.dailyTrend.map((d) => Number(d.sent)), 1);
                        const height = (sent / maxVal) * 100;
                        const openHeight = (opened / maxVal) * 100;
                        return (
                          <div key={day.date} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: 送信${sent} / 開封${opened}`}>
                            <div className="w-full relative" style={{ height: "120px" }}>
                              <div
                                className="absolute bottom-0 w-full bg-blue-200 dark:bg-blue-900/50 rounded-t"
                                style={{ height: `${height}%` }}
                              />
                              <div
                                className="absolute bottom-0 w-full bg-purple-400 dark:bg-purple-600 rounded-t"
                                style={{ height: `${openHeight}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap">
                              {day.date?.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-4 justify-center">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-900/50" />
                        <span className="text-xs text-muted-foreground">送信</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-purple-400 dark:bg-purple-600" />
                        <span className="text-xs text-muted-foreground">開封</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
