import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Gauge,
  History,
  ListChecks,
  Loader2,
  RefreshCw,
  Scale,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export type PerformanceView = "self" | "team" | "settings" | "reviews";

const VIEW_LINKS: Array<{ view: PerformanceView; label: string; path: string; icon: typeof Gauge }> = [
  { view: "self", label: "我的执行积分", path: "/my/performance", icon: Gauge },
  { view: "team", label: "团队看板", path: "/master/performance/team", icon: Users },
  { view: "reviews", label: "审核与申诉", path: "/master/performance/reviews", icon: UserCheck },
  { view: "settings", label: "规则与岗位", path: "/master/performance/settings", icon: Settings2 },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "待完成",
  completed: "已完成",
  first_reminder: "首次提醒",
  yellow: "黄色提醒",
  orange_review: "橙色复核",
  red_review: "红色复核",
  exception: "已排除",
  cancelled: "已取消",
  source_error: "数据源异常",
  pending_review: "待审核",
  second_review: "等待第二审核人",
  approved: "已批准",
  rejected: "已拒绝",
  submitted: "已申诉",
};

const STATUS_CLASS: Record<string, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  first_reminder: "border-amber-200 bg-amber-50 text-amber-700",
  yellow: "border-yellow-300 bg-yellow-50 text-yellow-800",
  orange_review: "border-orange-300 bg-orange-50 text-orange-800",
  red_review: "border-red-300 bg-red-50 text-red-700",
  exception: "border-blue-200 bg-blue-50 text-blue-700",
  source_error: "border-purple-200 bg-purple-50 text-purple-700",
  pending_review: "border-amber-200 bg-amber-50 text-amber-700",
  second_review: "border-orange-200 bg-orange-50 text-orange-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

function currentMonth(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function displayDate(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status] || "border-slate-200 bg-slate-50 text-slate-700"}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

function LoadingPanel() {
  return (
    <div className="flex min-h-[280px] items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> 正在读取执行积分数据
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>无法读取执行积分</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export default function PerformanceCenter({ view = "self" }: { view?: PerformanceView }) {
  const [, setLocation] = useLocation();
  const [yearMonth, setYearMonth] = useState(currentMonth());
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [candidateStaffId, setCandidateStaffId] = useState<number | null>(null);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const utils = trpc.useUtils();

  const ownQuery = trpc.performance.dashboard.useQuery(
    { yearMonth },
    { enabled: view === "self" || view === "settings" || view === "reviews" },
  );
  const selectedQuery = trpc.performance.dashboard.useQuery(
    { staffId: selectedStaffId || undefined, yearMonth },
    { enabled: view === "team" && Boolean(selectedStaffId) },
  );
  const teamQuery = trpc.performance.team.useQuery({ yearMonth }, { enabled: view === "team" || view === "reviews" });
  const configurationQuery = trpc.performance.configuration.useQuery(undefined, { enabled: view === "settings" });
  const auditQuery = trpc.performance.audit.useQuery({ limit: 50 }, { enabled: view === "settings" });
  const reviewQueueQuery = trpc.performance.reviewQueue.useQuery(undefined, { enabled: view === "reviews" });
  const canConfigure = Boolean((ownQuery.data as any)?.access?.canConfigure);
  const canViewTeam = Boolean((ownQuery.data as any)?.access?.canViewTeam);

  const invalidateAll = async () => {
    await Promise.all([
      utils.performance.dashboard.invalidate(),
      utils.performance.team.invalidate(),
      utils.performance.configuration.invalidate(),
      utils.performance.reviewQueue.invalidate(),
    ]);
  };

  const visibleLinks = VIEW_LINKS.filter(link => {
    if (link.view === "settings") return canConfigure || view === "settings";
    if (link.view === "team" || link.view === "reviews") return canViewTeam || view === link.view;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm">
          <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-indigo-500 text-white hover:bg-indigo-500">影子模式</Badge>
                <Badge variant="outline" className="border-slate-600 text-slate-200">V2 · 组织责任驱动</Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">组织执行积分中心</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300">
                系统事实 → 事项状态 → 审核候选 → 影子积分 → 申诉复核。首期只做治理验证，不影响奖金、工资或LCJ Coin。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="text-xs text-slate-300">
                统计月份
                <Input
                  type="month"
                  value={yearMonth}
                  onChange={event => setYearMonth(event.target.value || currentMonth())}
                  className="mt-1 w-full border-slate-700 bg-slate-900 text-white sm:w-44"
                />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-slate-800 sm:grid-cols-4">
            {visibleLinks.map(link => {
              const Icon = link.icon;
              return (
                <button
                  key={link.view}
                  type="button"
                  onClick={() => setLocation(link.path)}
                  className={`flex items-center justify-center gap-2 border-r border-slate-800 px-3 py-3 text-sm transition-colors ${view === link.view ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-900"}`}
                >
                  <Icon className="h-4 w-4" /> {link.label}
                </button>
              );
            })}
          </div>
        </div>

        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <AlertTitle>安全边界已锁定</AlertTitle>
          <AlertDescription className="leading-6">
            不补扣上线前历史、不自动产生负分、AI不直接写账、超过5分必须双人复核、员工可以查看证据并申诉；外部短信/飞书/邮件提醒暂不启用。
          </AlertDescription>
        </Alert>

        {view === "self" ? (
          <DashboardView query={ownQuery} onInvalidate={invalidateAll} />
        ) : null}
        {view === "team" ? (
          <TeamView
            teamQuery={teamQuery}
            selectedQuery={selectedQuery}
            selectedStaffId={selectedStaffId}
            onSelectStaff={setSelectedStaffId}
            onCreateCandidate={setCandidateStaffId}
            onInvalidate={invalidateAll}
          />
        ) : null}
        {view === "settings" ? (
          <SettingsView
            query={configurationQuery}
            auditQuery={auditQuery}
            assignmentOpen={assignmentOpen}
            setAssignmentOpen={setAssignmentOpen}
            onInvalidate={invalidateAll}
          />
        ) : null}
        {view === "reviews" ? (
          <ReviewsView
            query={reviewQueueQuery}
            teamQuery={teamQuery}
            onCreateCandidate={setCandidateStaffId}
            onInvalidate={invalidateAll}
          />
        ) : null}

        <ManualCandidateDialog
          open={candidateStaffId != null}
          staffId={candidateStaffId}
          staffName={(teamQuery.data as any)?.members?.find((member: any) => member.staffId === candidateStaffId)?.name || "员工"}
          onOpenChange={(open: boolean) => !open && setCandidateStaffId(null)}
          onSaved={invalidateAll}
        />
      </div>
    </div>
  );
}

function DashboardView({ query, onInvalidate }: { query: any; onInvalidate: () => Promise<void> }) {
  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <ErrorPanel message={query.error.message} />;
  const data = query.data as any;
  if (!data) return null;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_2fr]">
        <Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50">
          <CardHeader>
            <CardDescription>{data.staff.department || "未设置部门"} · {data.staff.position || "未设置岗位"}</CardDescription>
            <CardTitle className="flex items-end justify-between gap-3">
              <span>{data.staff.name}</span>
              <span className="text-4xl text-indigo-700">{data.score.normalizedScore == null ? "N/A" : `${data.score.normalizedScore}`}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={data.score.normalizedScore || 0} className="h-3" />
            <p className="text-sm text-muted-foreground">
              影子得分 {data.score.shadowScore}/{data.score.applicableMaximum || "N/A"}；没有适用事项的维度显示N/A，不按0分处理。
            </p>
            <div className="grid grid-cols-2 gap-3 text-center">
              <SummaryTile label="事项" value={data.summary.itemCount} />
              <SummaryTile label="已完成" value={data.summary.completedCount} tone="emerald" />
              <SummaryTile label="提醒中" value={data.summary.overdueCount} tone="amber" />
              <SummaryTile label="已排除" value={data.summary.exceptionCount} tone="blue" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.score.dimensions.map((dimension: any) => (
            <Card key={dimension.dimension} className={dimension.applicable ? "" : "border-dashed bg-slate-50/70"}>
              <CardHeader className="pb-3">
                <CardDescription>{dimension.label}</CardDescription>
                <CardTitle className="flex items-baseline justify-between">
                  <span>{dimension.score == null ? "N/A" : dimension.score}</span>
                  <span className="text-sm font-normal text-muted-foreground">/ {dimension.cap}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <Progress value={dimension.score == null ? 0 : (dimension.score / dimension.cap) * 100} />
                <div className="flex justify-between">
                  <span>事实 {dimension.achievedCount}/{dimension.applicableCount}</span>
                  <span>审核调整 {dimension.adjustment > 0 ? "+" : ""}{dimension.adjustment}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="items">事项与证据</TabsTrigger>
          <TabsTrigger value="reminders">提醒</TabsTrigger>
          <TabsTrigger value="ledger">积分流水</TabsTrigger>
          <TabsTrigger value="appeals">申诉</TabsTrigger>
          <TabsTrigger value="roles">岗位责任</TabsTrigger>
        </TabsList>
        <TabsContent value="items"><ItemsPanel items={data.items} /></TabsContent>
        <TabsContent value="reminders"><RemindersPanel reminders={data.reminders} /></TabsContent>
        <TabsContent value="ledger"><LedgerPanel data={data} onInvalidate={onInvalidate} /></TabsContent>
        <TabsContent value="appeals"><AppealsPanel appeals={data.appeals} /></TabsContent>
        <TabsContent value="roles"><AssignmentsPanel assignments={data.assignments} /></TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryTile({ label, value, tone = "slate" }: { label: string; value: number; tone?: string }) {
  const toneClass: Record<string, string> = {
    slate: "bg-slate-100 text-slate-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <div className={`rounded-xl p-3 ${toneClass[tone] || toneClass.slate}`}><div className="text-xl font-bold">{value}</div><div className="text-xs">{label}</div></div>;
}

function ItemsPanel({ items }: { items: any[] }) {
  if (!items?.length) return <EmptyState icon={ListChecks} title="本月暂无适用事项" description="未适用不会记0分；等待岗位责任和事实源生成事项。" />;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map(item => (
        <Card key={item.id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.businessDate} · {item.sourceType}</CardDescription>
              </div>
              <StatusBadge status={item.status} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <InfoLine label="截止" value={displayDate(item.dueAt)} />
            <InfoLine label="完成" value={displayDate(item.completedAt)} />
            <InfoLine label="数据质量" value={item.dataQuality} />
            <InfoLine label="证据键" value={item.evidenceKey} mono />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RemindersPanel({ reminders }: { reminders: any[] }) {
  if (!reminders?.length) return <EmptyState icon={BellRing} title="没有待处理提醒" description="事项完成、例外或数据源异常处理后，系统会自动关闭提醒。" />;
  return (
    <div className="space-y-3">
      {reminders.map(reminder => (
        <Card key={reminder.id} className="border-amber-200">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="font-medium">{reminder.title}</div><div className="text-sm text-muted-foreground">{reminder.businessDate} · 补救期限 {displayDate(reminder.remediateBy)}</div></div>
            <StatusBadge status={reminder.level} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LedgerPanel({ data, onInvalidate }: { data: any; onInvalidate: () => Promise<void> }) {
  const [appealTarget, setAppealTarget] = useState<{ ledgerId?: number; candidateId?: number } | null>(null);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        {data.ledger?.length ? data.ledger.map((entry: any) => (
          <Card key={`ledger-${entry.id}`}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div><div className="font-medium">{entry.dimension} · {entry.points > 0 ? "+" : ""}{entry.points}分</div><div className="mt-1 text-sm text-muted-foreground">{entry.reason}</div><div className="mt-2 text-xs text-muted-foreground">{displayDate(entry.createdAt)} · {entry.mode}</div></div>
              <Button variant="outline" size="sm" onClick={() => setAppealTarget({ ledgerId: entry.id })}>申诉</Button>
            </CardContent>
          </Card>
        )) : <EmptyState icon={Scale} title="暂无影子积分流水" description="自动事实不直接产生负分；审核通过后才会写入影子流水。" />}
      </div>
      {data.candidates?.length ? (
        <div className="space-y-2">
          <h3 className="font-semibold">审核候选</h3>
          {data.candidates.map((candidate: any) => (
            <div key={candidate.id} className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="font-medium">{candidate.dimension} · 建议 {candidate.recommendedPoints > 0 ? "+" : ""}{candidate.recommendedPoints}分</div><div className="text-sm text-muted-foreground">{candidate.reason}</div></div>
              <div className="flex items-center gap-2"><StatusBadge status={candidate.status} /><Button variant="ghost" size="sm" onClick={() => setAppealTarget({ candidateId: candidate.id })}>申诉</Button></div>
            </div>
          ))}
        </div>
      ) : null}
      <AppealDialog open={appealTarget != null} target={appealTarget} onOpenChange={(open: boolean) => !open && setAppealTarget(null)} onSaved={onInvalidate} />
    </div>
  );
}

function AppealsPanel({ appeals }: { appeals: any[] }) {
  if (!appeals?.length) return <EmptyState icon={FileWarning} title="暂无申诉" description="员工可以对候选或影子积分提交理由，管理员和审核人按责任范围处理。" />;
  return <div className="space-y-3">{appeals.map(appeal => <Card key={appeal.id}><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><div className="font-medium">{appeal.statement}</div><StatusBadge status={appeal.status} /></div><div className="mt-2 text-xs text-muted-foreground">{displayDate(appeal.createdAt)}</div></CardContent></Card>)}</div>;
}

function AssignmentsPanel({ assignments }: { assignments: any[] }) {
  if (!assignments?.length) return <EmptyState icon={ClipboardCheck} title="尚未配置岗位责任" description="管理员配置主岗位、责任线或项目责任后，系统才生成对应事项。" />;
  return <div className="grid gap-3 md:grid-cols-2">{assignments.map(assignment => <Card key={assignment.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><div><div className="font-medium">{assignment.roleName}</div><div className="text-sm text-muted-foreground">{assignment.assignmentType} · {assignment.scopeLabel || assignment.scopeType}</div></div><Badge variant="outline">{assignment.source}</Badge></div><div className="mt-3 text-xs text-muted-foreground">生效：{String(assignment.effectiveFrom).slice(0, 10)}{assignment.effectiveTo ? ` ～ ${String(assignment.effectiveTo).slice(0, 10)}` : " ～ 现在"}</div></CardContent></Card>)}</div>;
}

function TeamView({ teamQuery, selectedQuery, selectedStaffId, onSelectStaff, onCreateCandidate, onInvalidate }: any) {
  if (teamQuery.isLoading) return <LoadingPanel />;
  if (teamQuery.error) return <ErrorPanel message={teamQuery.error.message} />;
  const team = teamQuery.data as any;
  if (selectedStaffId) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => onSelectStaff(null)}><ArrowLeft className="mr-2 h-4 w-4" />返回团队</Button>
        <DashboardView query={selectedQuery} onInvalidate={onInvalidate} />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Users} label="可见员工" value={team.summary.memberCount} />
        <SummaryCard icon={CheckCircle2} label="完成事项" value={team.summary.completed} tone="emerald" />
        <SummaryCard icon={AlertTriangle} label="提醒事项" value={team.summary.overdue} tone="amber" />
        <SummaryCard icon={BellRing} label="开放提醒" value={team.summary.openReminders} tone="orange" />
      </div>
      {!team.members?.length ? <EmptyState icon={Users} title="暂无可见团队成员" description="普通员工只能查看本人；部门负责人需先完成HR部门与责任范围配置。" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {team.members.map((member: any) => (
            <Card key={member.staffId} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle className="text-lg">{member.name}</CardTitle><CardDescription>{member.department || "未设置部门"} · {member.position || "未设置岗位"}</CardDescription></div>
                  <div className="text-right"><div className="text-2xl font-bold text-indigo-700">{member.score.normalizedScore == null ? "N/A" : member.score.normalizedScore}</div><div className="text-xs text-muted-foreground">归一化影子分</div></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={member.score.normalizedScore || 0} />
                <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-emerald-50 p-2"><b>{member.completedCount}</b><br />已完成</div><div className="rounded-lg bg-amber-50 p-2"><b>{member.overdueCount}</b><br />提醒</div><div className="rounded-lg bg-slate-50 p-2"><b>{member.itemCount}</b><br />总事项</div></div>
                <div className="flex gap-2"><Button className="flex-1" variant="outline" onClick={() => onSelectStaff(member.staffId)}>查看证据</Button>{member.canReview ? <Button className="flex-1" onClick={() => onCreateCandidate(member.staffId)}>提出候选</Button> : null}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone = "indigo" }: { icon: typeof Users; label: string; value: number; tone?: string }) {
  const tones: Record<string, string> = { indigo: "bg-indigo-50 text-indigo-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", orange: "bg-orange-50 text-orange-700" };
  return <Card><CardContent className="flex items-center gap-4 p-4"><div className={`rounded-xl p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></div><div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div></CardContent></Card>;
}

function SettingsView({ query, auditQuery, assignmentOpen, setAssignmentOpen, onInvalidate }: any) {
  const [confirmTemplate, setConfirmTemplate] = useState<any>(null);
  const updateTemplate = trpc.performance.updateTemplateStatus.useMutation({
    onSuccess: async () => { toast.success("模板状态已更新并写入审计"); setConfirmTemplate(null); await onInvalidate(); },
    onError: error => toast.error(error.message),
  });
  const reconcile = trpc.performance.reconcileNow.useMutation({
    onSuccess: async result => { toast.success(result.skipped ? "当前时段已对账" : "影子对账完成"); await onInvalidate(); },
    onError: error => toast.error(error.message),
  });
  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <ErrorPanel message={query.error.message} />;
  const data = query.data as any;
  return (
    <div className="space-y-5">
      <Card className="border-emerald-200 bg-emerald-50/70">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" />上线安全开关</CardTitle><CardDescription>这些开关由系统锁定，首期不能在页面改为正式结算。</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["影子模式", data.safety.modeLockedToShadow],
            ["不影响奖金", data.safety.bonusImpactDisabled],
            ["不影响LCJ Coin", data.safety.lcjCoinImpactDisabled],
            ["外部通知关闭", data.safety.externalNotificationsDisabled],
            ["不追溯历史", data.safety.retrospectiveScoringDisabled],
          ].map(([label, safe]) => <div key={String(label)} className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm"><BadgeCheck className={`h-4 w-4 ${safe ? "text-emerald-600" : "text-red-600"}`} />{label}</div>)}
        </CardContent>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">岗位事项模板</h2><p className="text-sm text-muted-foreground">已从用户提供的CSV导入 {data.templateCount} 条；已接通系统证据的公共事项为影子启用，其余岗位事项保持草稿。</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => reconcile.mutate()} disabled={reconcile.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${reconcile.isPending ? "animate-spin" : ""}`} />立即影子对账</Button><Button onClick={() => setAssignmentOpen(true)}><UserCheck className="mr-2 h-4 w-4" />配置岗位责任</Button></div></div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.templates.map((template: any) => (
          <Card key={template.id} className={template.status === "shadow" ? "border-indigo-200" : ""}>
            <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{template.title}</CardTitle><CardDescription>{template.templateCode} · {template.responsibilityLine} · {template.roleName}</CardDescription></div><Badge variant={template.status === "shadow" ? "default" : "outline"}>{template.status === "shadow" ? "影子启用" : "草稿"}</Badge></div></CardHeader>
            <CardContent className="space-y-3 text-sm"><div className="grid gap-2 sm:grid-cols-2"><InfoLine label="周期" value={template.triggerCycle} /><InfoLine label="截止" value={template.defaultDeadline || "未设"} /><InfoLine label="证据" value={template.evidenceSource} /><InfoLine label="审核" value={template.reviewerRole} /></div><p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">{template.completionCondition}</p><Button size="sm" variant="outline" onClick={() => setConfirmTemplate(template)}>{template.status === "shadow" ? "暂停为草稿" : "启用影子监控"}</Button></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>当前岗位责任</CardTitle><CardDescription>主岗位变更会结束原主岗位，不删除历史。</CardDescription></CardHeader><CardContent><div className="space-y-3">{data.assignments.map((assignment: any) => <div key={assignment.id} className="rounded-xl border p-3"><div className="font-medium">{assignment.staffName} · {assignment.roleName}</div><div className="mt-1 text-sm text-muted-foreground">{assignment.department || "未设置部门"} · {assignment.assignmentType} · 审核人：{assignment.reviewerName || "待配置"}</div></div>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>最近对账</CardTitle><CardDescription>每个15分钟时段最多执行一次，多实例不会重复。</CardDescription></CardHeader><CardContent><div className="space-y-3">{data.recentRuns.map((run: any) => <div key={run.runKey} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs">{run.runKey}</span><StatusBadge status={run.status} /></div><div className="mt-2 text-xs text-muted-foreground">事项 {run.counters?.itemsUpserted || 0} · 完成 {run.counters?.itemsCompleted || 0} · 提醒 {run.counters?.remindersOpened || 0}</div></div>)}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />最近不可变审计</CardTitle><CardDescription>所有规则、岗位、审核和申诉写入都保留操作者、请求ID及前后状态。</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {auditQuery.isLoading ? <div className="text-sm text-muted-foreground">正在读取审计记录</div> : (auditQuery.data as any)?.length ? (auditQuery.data as any[]).map(entry => <div key={entry.id} className="flex flex-col gap-1 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><b>{entry.action}</b> · {entry.entityType} #{entry.entityId}<div className="text-xs text-muted-foreground">操作者：{entry.actorName || `user:${entry.actorUserId}`} · requestId {entry.requestId}</div></div><span className="text-xs text-muted-foreground">{displayDate(entry.createdAt)}</span></div>) : <div className="text-sm text-muted-foreground">尚无变更记录</div>}
        </CardContent>
      </Card>
      <Dialog open={Boolean(confirmTemplate)} onOpenChange={(open: boolean) => !open && setConfirmTemplate(null)}><DialogContent><DialogHeader><DialogTitle>确认模板状态差异</DialogTitle><DialogDescription>保存后立即写入不可变审计；只改变影子事项监控，不影响奖金或LCJ Coin。</DialogDescription></DialogHeader>{confirmTemplate ? <div className="rounded-xl border p-4 text-sm"><div>模板：<b>{confirmTemplate.title}</b></div><div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><div className="rounded-lg bg-slate-100 p-3">{confirmTemplate.status}</div><span>→</span><div className="rounded-lg bg-indigo-50 p-3">{confirmTemplate.status === "shadow" ? "draft" : "shadow"}</div></div></div> : null}<DialogFooter><Button variant="outline" onClick={() => setConfirmTemplate(null)}>取消</Button><Button disabled={updateTemplate.isPending} onClick={() => confirmTemplate && updateTemplate.mutate({ templateId: confirmTemplate.id, status: confirmTemplate.status === "shadow" ? "draft" : "shadow", requestId: crypto.randomUUID() })}>确认并记录审计</Button></DialogFooter></DialogContent></Dialog>
      <AssignmentDialog open={assignmentOpen} onOpenChange={setAssignmentOpen} data={data} onSaved={onInvalidate} />
    </div>
  );
}

function ReviewsView({ query, teamQuery, onCreateCandidate, onInvalidate }: any) {
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [appealReviewTarget, setAppealReviewTarget] = useState<any>(null);
  if (query.isLoading || teamQuery.isLoading) return <LoadingPanel />;
  if (query.error) return <ErrorPanel message={query.error.message} />;
  const data = query.data as any;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">审核与申诉队列</h2><p className="text-sm text-muted-foreground">普通员工不能自评；超过5分需要第二位不同审核人。</p></div><Select onValueChange={value => onCreateCandidate(Number(value))}><SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="为团队成员提出候选" /></SelectTrigger><SelectContent>{(teamQuery.data as any)?.members?.filter((member: any) => member.canReview).map((member: any) => <SelectItem key={member.staffId} value={String(member.staffId)}>{member.name} · {member.department || "未设置部门"}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>积分候选</CardTitle><CardDescription>AI候选首期关闭；这里只有人工提出且尚未完成复核的记录。</CardDescription></CardHeader><CardContent className="space-y-3">{data.candidates?.length ? data.candidates.map((candidate: any) => <div key={candidate.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{candidate.staffName} · {candidate.dimension}</div><div className="text-sm text-muted-foreground">建议 {candidate.recommendedPoints > 0 ? "+" : ""}{candidate.recommendedPoints}分 · {candidate.reason}</div><div className="mt-1 text-xs text-muted-foreground">{candidate.itemTitle || "未关联事项"}</div></div><StatusBadge status={candidate.status} /></div><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => setReviewTarget({ ...candidate, decision: "approve" })}>审核通过</Button><Button size="sm" variant="outline" onClick={() => setReviewTarget({ ...candidate, decision: "reject" })}>拒绝</Button></div></div>) : <EmptyState icon={BadgeCheck} title="没有待审核候选" description="系统事实不会直接产生负分。" />}</CardContent></Card>
        <Card><CardHeader><CardTitle>员工申诉</CardTitle><CardDescription>申诉与原候选/流水关联，不覆盖原始证据。</CardDescription></CardHeader><CardContent className="space-y-3">{data.appeals?.length ? data.appeals.map((appeal: any) => <div key={appeal.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{appeal.staffName}</div><div className="mt-1 text-sm text-muted-foreground">{appeal.statement}</div></div><StatusBadge status={appeal.status} /></div><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => setAppealReviewTarget({ ...appeal, decision: "accept" })}>接受申诉</Button><Button size="sm" variant="outline" onClick={() => setAppealReviewTarget({ ...appeal, decision: "reject" })}>驳回</Button></div></div>) : <EmptyState icon={Scale} title="没有待处理申诉" description="员工可从自己的积分流水或候选提交申诉。" />}</CardContent></Card>
      </div>
      <ReviewDialog open={Boolean(reviewTarget)} target={reviewTarget} onOpenChange={(open: boolean) => !open && setReviewTarget(null)} onSaved={async () => { setReviewTarget(null); await onInvalidate(); }} />
      <ResolveAppealDialog open={Boolean(appealReviewTarget)} target={appealReviewTarget} onOpenChange={(open: boolean) => !open && setAppealReviewTarget(null)} onSaved={async () => { setAppealReviewTarget(null); await onInvalidate(); }} />
    </div>
  );
}

function ResolveAppealDialog({ open, target, onOpenChange, onSaved }: any) {
  const [resolution, setResolution] = useState("");
  const mutation = trpc.performance.resolveAppeal.useMutation({
    onSuccess: async () => {
      toast.success(target?.decision === "accept" ? "申诉已接受；如有关联流水已追加冲销记录" : "申诉已驳回");
      setResolution("");
      await onSaved();
    },
    onError: error => toast.error(error.message),
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{target?.decision === "accept" ? "确认接受申诉" : "确认驳回申诉"}</DialogTitle><DialogDescription>不会覆盖原始候选、证据或积分流水；接受后使用追加冲销记录，完整保留审计链。</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-xl border p-4 text-sm">{target?.staffName}<div className="mt-1 text-muted-foreground">{target?.statement}</div></div><label className="space-y-1 text-sm">处理结论<Textarea value={resolution} onChange={event => setResolution(event.target.value)} rows={5} placeholder="写明核对证据与处理理由" /></label></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button variant={target?.decision === "reject" ? "destructive" : "default"} disabled={resolution.trim().length < 3 || mutation.isPending} onClick={() => target && mutation.mutate({ appealId: target.id, decision: target.decision, resolution, requestId: crypto.randomUUID() })}>确认并记录审计</Button></DialogFooter></DialogContent></Dialog>;
}

function ManualCandidateDialog({ open, staffId, staffName, onOpenChange, onSaved }: any) {
  const [dimension, setDimension] = useState("initiative");
  const [points, setPoints] = useState("1");
  const [reason, setReason] = useState("");
  const mutation = trpc.performance.createManualCandidate.useMutation({
    onSuccess: async () => { toast.success("已创建审核候选，不会直接写入积分"); setReason(""); onOpenChange(false); await onSaved(); },
    onError: error => toast.error(error.message),
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>提出人工积分候选</DialogTitle><DialogDescription>目标：{staffName}。这里只创建待审核候选；员工本人不能自评，负分也不会自动写入。</DialogDescription></DialogHeader><div className="space-y-4"><label className="space-y-1 text-sm">维度<Select value={dimension} onValueChange={setDimension}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[["completion","完成度"],["timeliness","及时性"],["quality","质量"],["accuracy_closure","准确性/闭环"],["initiative","积极度"],["manager_evaluation","管理评价"]].map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm">建议分值（-20～20）<Input type="number" min={-20} max={20} step="0.5" value={points} onChange={event => setPoints(event.target.value)} /></label><label className="space-y-1 text-sm">事实理由<Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="写明事项、时间和可核对证据" rows={5} /></label>{Math.abs(Number(points || 0)) > 5 ? <Alert className="border-orange-200 bg-orange-50"><AlertTriangle className="h-4 w-4" /><AlertDescription>超过5分必须由第二位不同审核人再次确认。</AlertDescription></Alert> : null}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={!staffId || reason.trim().length < 5 || mutation.isPending} onClick={() => staffId && mutation.mutate({ staffId, dimension: dimension as any, recommendedPoints: Number(points), reason, requestId: crypto.randomUUID() })}>创建候选</Button></DialogFooter></DialogContent></Dialog>;
}

function ReviewDialog({ open, target, onOpenChange, onSaved }: any) {
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState("");
  const mutation = trpc.performance.reviewCandidate.useMutation({
    onSuccess: async result => { toast.success(result.status === "second_review" ? "第一审核已记录，等待第二位审核人" : "审核结果已记录"); setReason(""); setPoints(""); await onSaved(); },
    onError: error => toast.error(error.message),
  });
  const decision = target?.decision || "approve";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{decision === "approve" ? "确认批准候选" : "确认拒绝候选"}</DialogTitle><DialogDescription>审核结果会写入不可变审计。超过5分只完成第一审核，不会立即入账。</DialogDescription></DialogHeader>{target ? <div className="space-y-4"><div className="rounded-xl border p-4 text-sm"><div>{target.staffName} · {target.dimension}</div><div className="mt-1 text-muted-foreground">建议 {target.recommendedPoints > 0 ? "+" : ""}{target.recommendedPoints}分</div></div>{decision === "approve" ? <label className="space-y-1 text-sm">最终分值（留空沿用建议）<Input type="number" min={-20} max={20} step="0.5" value={points} onChange={event => setPoints(event.target.value)} /></label> : null}<label className="space-y-1 text-sm">审核理由<Textarea value={reason} onChange={event => setReason(event.target.value)} rows={4} /></label></div> : null}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button variant={decision === "reject" ? "destructive" : "default"} disabled={reason.trim().length < 3 || mutation.isPending} onClick={() => target && mutation.mutate({ candidateId: target.id, decision, finalPoints: points ? Number(points) : undefined, reason, requestId: crypto.randomUUID() })}>确认并记录审计</Button></DialogFooter></DialogContent></Dialog>;
}

function AppealDialog({ open, target, onOpenChange, onSaved }: any) {
  const [statement, setStatement] = useState("");
  const mutation = trpc.performance.submitAppeal.useMutation({ onSuccess: async () => { toast.success("申诉已提交"); setStatement(""); onOpenChange(false); await onSaved(); }, onError: error => toast.error(error.message) });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>提交积分申诉</DialogTitle><DialogDescription>请说明事实、日期和希望复核的原因；原记录不会被覆盖。</DialogDescription></DialogHeader><Textarea rows={7} value={statement} onChange={event => setStatement(event.target.value)} placeholder="至少5个字" /><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={statement.trim().length < 5 || mutation.isPending} onClick={() => target && mutation.mutate({ ...target, statement, requestId: crypto.randomUUID() })}>提交申诉</Button></DialogFooter></DialogContent></Dialog>;
}

function AssignmentDialog({ open, onOpenChange, data, onSaved }: any) {
  const [staffId, setStaffId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [assignmentType, setAssignmentType] = useState("primary");
  const [roleName, setRoleName] = useState("");
  const [scopeType, setScopeType] = useState("department");
  const [scopeLabel, setScopeLabel] = useState("");
  const mutation = trpc.performance.createAssignment.useMutation({ onSuccess: async () => { toast.success("岗位责任已生效并记录审计"); onOpenChange(false); await onSaved(); }, onError: error => toast.error(error.message) });
  const selectedStaff = data?.staffDirectory?.find((staff: any) => String(staff.id) === staffId);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>配置岗位与审核责任</DialogTitle><DialogDescription>主岗位变更只结束旧分配，不删除历史；审核人不能是员工本人。</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm">员工<Select value={staffId} onValueChange={setStaffId}><SelectTrigger><SelectValue placeholder="选择员工" /></SelectTrigger><SelectContent>{data?.staffDirectory?.map((staff: any) => <SelectItem key={staff.id} value={String(staff.id)}>{staff.name} · {staff.department || "未设置部门"}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm">审核人<Select value={reviewerId} onValueChange={setReviewerId}><SelectTrigger><SelectValue placeholder="选择审核人" /></SelectTrigger><SelectContent>{data?.staffDirectory?.filter((staff: any) => String(staff.id) !== staffId).map((staff: any) => <SelectItem key={staff.id} value={String(staff.id)}>{staff.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm">责任类型<Select value={assignmentType} onValueChange={setAssignmentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary">主岗位</SelectItem><SelectItem value="responsibility">兼任责任</SelectItem><SelectItem value="project">项目责任</SelectItem></SelectContent></Select></label><label className="space-y-1 text-sm">岗位名称<Input value={roleName} onChange={event => setRoleName(event.target.value)} placeholder={selectedStaff?.position || "例如：达人建联负责人"} /></label><label className="space-y-1 text-sm">责任范围<Select value={scopeType} onValueChange={setScopeType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company">全公司</SelectItem><SelectItem value="department">部门</SelectItem><SelectItem value="project">项目</SelectItem><SelectItem value="brand">品牌</SelectItem><SelectItem value="store">店铺</SelectItem></SelectContent></Select></label><label className="space-y-1 text-sm">范围名称<Input value={scopeLabel} onChange={event => setScopeLabel(event.target.value)} placeholder={selectedStaff?.department || "填写部门/项目/品牌/店铺"} /></label></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={!staffId || !reviewerId || !roleName.trim() || mutation.isPending} onClick={() => mutation.mutate({ staffId: Number(staffId), assignmentType: assignmentType as any, roleCode: roleName.trim().toLowerCase().replace(/\s+/g, "_"), roleName: roleName.trim(), scopeType: scopeType as any, scopeLabel: scopeLabel || null, reviewerStaffId: Number(reviewerId), effectiveFrom: todayJst(), requestId: crypto.randomUUID() })}>确认差异并保存</Button></DialogFooter></DialogContent></Dialog>;
}

function InfoLine({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return <div className="min-w-0"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-0.5 truncate ${mono ? "font-mono text-xs" : ""}`} title={String(value ?? "—")}>{String(value ?? "—")}</div></div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Sparkles; title: string; description: string }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50 p-6 text-center"><Icon className="mb-3 h-8 w-8 text-slate-400" /><div className="font-medium">{title}</div><div className="mt-1 max-w-md text-sm text-muted-foreground">{description}</div></div>;
}
