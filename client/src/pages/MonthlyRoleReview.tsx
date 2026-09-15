import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CalendarCheck2, CheckCircle2, Download, FileText, Loader2, Save, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const FIELD_CONFIG = [
  ["focusGoals", "本月重点目标", "本月最重要的目标、负责品牌或重点项目"],
  ["achievements", "本月完成事项", "完成了什么，产生了哪些结果"],
  ["metricsResult", "结果・数据", "GMV、回复率、寄样、排期、完成率等可量化数据；没有时填写“无”"],
  ["incompleteItems", "未完成事项及原因", "未完成内容、原因和后续处理；没有时填写“无”"],
  ["problemsAndRisks", "问题・风险", "当前风险、跨部门阻塞或需要提前处理的问题；没有时填写“无”"],
  ["supportNeeded", "所需支持", "需要主管或其他部门提供的资源与决策；没有时填写“无”"],
  ["nextMonthPlan", "下月计划", "下月重点、目标数字和计划动作"],
] as const;

type FieldKey = (typeof FIELD_CONFIG)[number][0];
type Draft = Record<FieldKey, string>;
const emptyDraft: Draft = { focusGoals: "", achievements: "", metricsResult: "", incompleteItems: "", problemsAndRisks: "", supportNeeded: "", nextMonthPlan: "" };

function tokyoMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function statusBadge(status?: string | null) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "草稿", className: "bg-slate-100 text-slate-700" },
    submitted: { label: "主管确认待ち", className: "bg-amber-100 text-amber-800" },
    approved: { label: "確認済み", className: "bg-emerald-100 text-emerald-800" },
    revision_requested: { label: "修正依頼", className: "bg-rose-100 text-rose-800" },
  };
  const value = map[String(status || "")] || { label: "未填写", className: "bg-blue-100 text-blue-800" };
  return <Badge className={value.className}>{value.label}</Badge>;
}

export default function MonthlyRoleReview() {
  const [reviewMonth, setReviewMonth] = useState(tokyoMonth);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const utils = trpc.useUtils();
  const overview = trpc.hrRoleReview.myOverview.useQuery({ reviewMonth });
  const saveDraft = trpc.hrRoleReview.saveDraft.useMutation({
    onSuccess: () => { toast.success("月度推进草稿已保存"); utils.hrRoleReview.myOverview.invalidate(); },
    onError: error => toast.error("保存失败", { description: error.message }),
  });
  const submit = trpc.hrRoleReview.submit.useMutation({
    onSuccess: () => { toast.success("已提交主管确认"); utils.hrRoleReview.myOverview.invalidate(); },
    onError: error => toast.error("提交失败", { description: error.message }),
  });
  const download = trpc.hrRoleReview.documentDownload.useMutation({
    onSuccess: data => window.open(data.url, "_blank", "noopener,noreferrer"),
    onError: error => toast.error("下载失败", { description: error.message }),
  });

  const currentReview = overview.data?.currentReview as any;
  useEffect(() => {
    const next = { ...emptyDraft };
    if (currentReview) for (const [key] of FIELD_CONFIG) next[key] = String(currentReview[key] || "");
    setDraft(next);
  }, [currentReview?.id, currentReview?.updatedAt, reviewMonth]);

  const editable = !currentReview || currentReview.status === "draft" || currentReview.status === "revision_requested";
  const payload = useMemo(() => ({ reviewMonth, ...draft }), [reviewMonth, draft]);
  const complete = FIELD_CONFIG.every(([key]) => draft[key].trim().length > 0);
  const busy = saveDraft.isPending || submit.isPending;

  if (overview.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (overview.error) return <Card className="border-rose-200"><CardContent className="p-6"><p className="font-medium text-rose-700">月度推进を開けません</p><p className="mt-2 text-sm text-muted-foreground">{overview.error.message}</p></CardContent></Card>;

  const role = overview.data?.currentRoleDocument as any;
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700"><CalendarCheck2 className="h-4 w-4" /> MONTHLY ROLE REVIEW</div>
          <h1 className="mt-1 text-2xl font-bold">月度岗位目标・推进复盘</h1>
          <p className="mt-1 text-sm text-muted-foreground">每月填写一次，主管确认后作为岗位推进历史保存。不会自动变成绩效扣分。</p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="review-month" className="whitespace-nowrap">対象月</Label>
          <Input id="review-month" type="month" value={reviewMonth} onChange={event => setReviewMonth(event.target.value)} className="w-44" disabled={busy} />
          {statusBadge(currentReview?.status)}
        </div>
      </div>

      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/80 to-white">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-blue-600" /> 当前岗位档案</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {role ? <>
            <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{role.title}</span><Badge variant="outline">v{role.version}</Badge><Badge variant="outline">{role.effectiveMonth}</Badge></div>
            {role.responsibilities && <div><p className="text-xs font-semibold text-muted-foreground">岗位职责</p><p className="mt-1 whitespace-pre-wrap text-sm">{role.responsibilities}</p></div>}
            {role.goalsAndMetrics && <div><p className="text-xs font-semibold text-muted-foreground">目标・KPI</p><p className="mt-1 whitespace-pre-wrap text-sm">{role.goalsAndMetrics}</p></div>}
            <Button variant="outline" size="sm" onClick={() => download.mutate({ id: role.id })} disabled={download.isPending}><Download className="mr-2 h-4 w-4" />原始资料</Button>
          </> : <div className="flex items-center gap-3 text-sm text-muted-foreground"><FileText className="h-8 w-8 opacity-40" /><span>主管尚未启用岗位资料。你仍可以填写本月推进，启用后会自动关联新版本。</span></div>}
        </CardContent>
      </Card>

      {currentReview?.status === "revision_requested" && currentReview.reviewComment && (
        <Card className="border-rose-200 bg-rose-50"><CardContent className="p-4"><p className="font-semibold text-rose-800">主管修改意见</p><p className="mt-1 whitespace-pre-wrap text-sm text-rose-700">{currentReview.reviewComment}</p></CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">{reviewMonth} 月度推进模板</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {FIELD_CONFIG.map(([key, label, placeholder]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}<span className="ml-1 text-rose-500">*</span></Label>
              <Textarea id={key} value={draft[key]} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.value }))} placeholder={placeholder} disabled={!editable || busy} className="min-h-24 resize-y" maxLength={20000} />
            </div>
          ))}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => saveDraft.mutate(payload)} disabled={!editable || busy}><Save className="mr-2 h-4 w-4" />草稿保存</Button>
            <Button onClick={() => submit.mutate(payload)} disabled={!editable || !complete || busy}>{submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}主管へ提出</Button>
          </div>
          {!editable && <p className="text-center text-sm text-muted-foreground">提交后内容已锁定。需要修改时，请由主管退回。</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">提交历史</CardTitle></CardHeader>
        <CardContent>
          {(overview.data?.reviews || []).length === 0 ? <p className="text-sm text-muted-foreground">尚无月度推进记录</p> : <div className="space-y-2">{(overview.data?.reviews || []).map((review: any) => <div key={review.id} className="flex items-center justify-between rounded-lg border px-3 py-2"><div><p className="font-medium">{review.reviewMonth}</p><p className="text-xs text-muted-foreground">更新：{new Date(review.updatedAt).toLocaleString()}</p></div><div className="flex items-center gap-2">{review.status === "approved" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{statusBadge(review.status)}</div></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
