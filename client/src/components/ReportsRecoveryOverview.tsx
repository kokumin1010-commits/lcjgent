import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  FileClock,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

function formatDate(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("ja-JP");
}

export default function ReportsRecoveryOverview() {
  const { data: overview, isLoading } = trpc.reportsAccountsProductsRecovery.overview.useQuery();
  const { data: staff = [] } = trpc.reportStaff.list.useQuery();
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayReports = [] } = trpc.report.list.useQuery({
    startDate: `${today}T00:00:00`,
    endDate: `${today}T23:59:59`,
  });

  const submittedIds = useMemo(() => new Set(
    todayReports.map((entry: any) => Number(entry.report?.reportStaffId || entry.staff?.id || 0)).filter(Boolean),
  ), [todayReports]);

  const activeStaff = useMemo(() => staff.filter((entry: any) => entry.isActive === "active"), [staff]);
  const submittedCount = activeStaff.filter((entry: any) => submittedIds.has(Number(entry.id))).length;
  const pendingCount = Math.max(0, activeStaff.length - submittedCount);

  if (isLoading || !overview) {
    return <Card><CardContent className="p-5 text-sm text-muted-foreground">復旧状況を確認中...</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-4 w-4" />日報スタッフ</div><div className="text-2xl font-bold mt-1">{overview.reportSummary.reportStaffCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-emerald-700 text-xs"><CheckCircle2 className="h-4 w-4" />本日提出済み</div><div className="text-2xl font-bold mt-1 text-emerald-700">{submittedCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-amber-700 text-xs"><FileClock className="h-4 w-4" />本日未提出</div><div className="text-2xl font-bold mt-1 text-amber-700">{pendingCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-blue-700 text-xs"><ShieldCheck className="h-4 w-4" />保存フォロー</div><div className="text-2xl font-bold mt-1 text-blue-700">{overview.orphanFollowups.length}</div></CardContent></Card>
      </div>

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold flex items-center gap-2"><UserCheck className="h-5 w-5 text-blue-700" />本日の提出状況</h2>
              <p className="text-xs text-muted-foreground mt-1">36人の保存済み人員目录を基準に、Railway MySQLの本日の日報提出を表示します。</p>
            </div>
            <Badge variant="outline" className="bg-white">{submittedCount}/{activeStaff.length} 提出</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            {activeStaff.map((entry: any) => {
              const submitted = submittedIds.has(Number(entry.id));
              return (
                <div key={entry.id} className={`rounded-lg border px-3 py-2 text-xs ${submitted ? "bg-emerald-50 border-emerald-200" : "bg-white border-amber-200"}`}>
                  <div className="font-medium truncate" title={entry.name}>{entry.name}</div>
                  <div className={submitted ? "text-emerald-700 mt-1" : "text-amber-700 mt-1"}>{submitted ? "提出済み" : "未提出"}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {overview.orphanFollowups.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5" />
              <div>
                <h2 className="font-semibold text-amber-900">保存済みフォローアップ（元日報本文未復元）</h2>
                <p className="text-xs text-amber-800 mt-1">元日報IDへの参照は残っていますが、本文は保存資料にありません。給与・評価・業務実績には自動利用しません。</p>
              </div>
            </div>
            <div className="space-y-2">
              {overview.orphanFollowups.map((item: any) => (
                <div key={item.legacyFollowupId} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
                  <div className="flex flex-wrap gap-2 items-center mb-1">
                    <Badge variant="outline">{item.category || "未分類"}</Badge>
                    <span className="text-xs text-muted-foreground">旧日報ID {item.legacyReportId}</span>
                    <span className="text-xs text-muted-foreground">担当ID {item.legacyReportStaffId || "-"}</span>
                    <span className="text-xs text-muted-foreground">期限 {formatDate(item.dueDate)}</span>
                  </div>
                  <p>{item.extractedItem || "内容未復元"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><KeyRound className="h-5 w-5 text-violet-700" />アカウント復旧状況</h2>
            <p className="text-xs text-muted-foreground mt-1">保存済みハッシュは維持します。明文パスワードの復元や全員共通パスワードは行いません。</p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {overview.currentAccountState.map((item: any) => (
              <div key={item.accountTable} className="rounded-lg border p-3 text-sm">
                <div className="font-semibold font-mono text-xs">{item.accountTable}</div>
                <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                  <div><div className="font-bold">{item.currentRows}</div><div className="text-[10px] text-muted-foreground">Railway账号</div></div>
                  <div><div className="font-bold text-emerald-700">{item.currentHashCount}</div><div className="text-[10px] text-muted-foreground">原哈希可用</div></div>
                  <div><div className="font-bold text-amber-700">{item.resetRequiredCount}</div><div className="text-[10px] text-muted-foreground">需重置</div></div>
                  <div><div className="font-bold text-blue-700">{item.alternateLoginCount}</div><div className="text-[10px] text-muted-foreground">LINE登录</div></div>
                </div>
                {(item.accountTable === "staff" || item.accountTable === "report_staff") && <p className="mt-2 text-[10px] text-muted-foreground">直接密码表ではなく、確認済みメール/LINE账号と紐付けて利用します。</p>}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild><a href={overview.resetLinks.admin}>管理者PWリセット</a></Button>
            <Button size="sm" variant="outline" asChild><a href={overview.resetLinks.liver}>ライバーPWリセット</a></Button>
            <Button size="sm" variant="outline" asChild><a href={overview.resetLinks.line}>メール会員PWリセット</a></Button>
            <Button size="sm" variant="outline" asChild><a href={overview.resetLinks.festival}>LCFアカウント</a></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
