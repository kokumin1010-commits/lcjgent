import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Download, FileText, Loader2, RefreshCw, Save, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";

type Props = { staffId: number; staffName?: string };

type DocumentDraft = {
  id: number;
  title: string;
  responsibilities: string;
  goalsAndMetrics: string;
  risks: string;
  supportNeeded: string;
  departmentSopContent: string;
};

function monthNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { pending_review: "待确认", active: "使用中", archived: "历史版本", draft: "草稿", submitted: "待主管确认", approved: "已确认", revision_requested: "需修改" };
  return labels[status] || status;
}

function statusClass(status: string) {
  if (status === "active" || status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "submitted" || status === "pending_review") return "bg-amber-100 text-amber-800";
  if (status === "revision_requested") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export default function HrStaffRoleReviewTab({ staffId, staffName }: Props) {
  const [reviewMonth, setReviewMonth] = useState(monthNow);
  const [uploadTitle, setUploadTitle] = useState("岗位职责・推进计划");
  const [uploading, setUploading] = useState(false);
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft | null>(null);
  const [reviewComment, setReviewComment] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const detail = trpc.hrRoleReview.staffDetail.useQuery({ staffId, reviewMonth });
  const activate = trpc.hrRoleReview.activateDocument.useMutation({
    onSuccess: () => { toast.success("岗位资料已启用"); detail.refetch(); utils.hrRoleReview.adminOverview.invalidate(); },
    onError: error => toast.error("启用失败", { description: error.message }),
  });
  const updateDocument = trpc.hrRoleReview.updateDocument.useMutation({
    onSuccess: () => { toast.success("岗位资料已更新"); setDocumentDraft(null); detail.refetch(); },
    onError: error => toast.error("更新失败", { description: error.message }),
  });
  const review = trpc.hrRoleReview.review.useMutation({
    onSuccess: data => { toast.success(data.status === "approved" ? "月度复盘已确认" : "已退回员工修改"); detail.refetch(); utils.hrRoleReview.adminOverview.invalidate(); },
    onError: error => toast.error("审核失败", { description: error.message }),
  });
  const download = trpc.hrRoleReview.documentDownload.useMutation({
    onSuccess: data => window.open(data.url, "_blank", "noopener,noreferrer"),
    onError: error => toast.error("下载失败", { description: error.message }),
  });

  const pendingReviews = useMemo(() => (detail.data?.reviews || []).filter((item: any) => item.status === "submitted"), [detail.data?.reviews]);

  async function uploadDocument(file: File) {
    setUploading(true);
    try {
      const params = new URLSearchParams({ scope: "employee", staffId: String(staffId), title: uploadTitle.trim() || "岗位职责・推进计划", effectiveMonth: reviewMonth });
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/hr-role/document-upload?${params.toString()}`, { method: "POST", credentials: "include", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || body.errorCode || "岗位资料上传失败");
      toast.success("岗位资料已上传，确认结构内容后再启用");
      await detail.refetch();
      if (body.document) openDocumentEditor(body.document);
    } catch (error) {
      toast.error("上传失败", { description: error instanceof Error ? error.message : "请重试" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function openDocumentEditor(document: any) {
    setDocumentDraft({
      id: Number(document.id),
      title: String(document.title || ""),
      responsibilities: String(document.responsibilities || document.previewText || ""),
      goalsAndMetrics: String(document.goalsAndMetrics || ""),
      risks: String(document.risks || ""),
      supportNeeded: String(document.supportNeeded || ""),
      departmentSopContent: String(document.departmentSopContent || ""),
    });
  }

  if (detail.isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (detail.error) return <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{detail.error.message}</p>;

  return (
    <div className="space-y-5" data-testid="hr-staff-role-review-tab">
      <div className="flex flex-col gap-3 rounded-xl border bg-slate-50 p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2"><Label htmlFor={`hr-role-title-${staffId}`}>资料标题</Label><Input id={`hr-role-title-${staffId}`} value={uploadTitle} onChange={event => setUploadTitle(event.target.value)} disabled={uploading} /></div>
        <div className="space-y-2"><Label htmlFor={`hr-role-month-${staffId}`}>生效月份</Label><Input id={`hr-role-month-${staffId}`} type="month" value={reviewMonth} onChange={event => setReviewMonth(event.target.value)} disabled={uploading} /></div>
        <input ref={fileInputRef} type="file" className="hidden" accept=".doc,.docx,.pdf,.txt,.md,.xlsx" onChange={event => { const file = event.target.files?.[0]; if (file) uploadDocument(file); }} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}岗位资料上传</Button>
      </div>
      <p className="text-xs text-muted-foreground">原文件保存在安全存储中；上传只建立岗位资料，不修改员工部门、职位、薪资、Tier、日报或任务。</p>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />岗位资料版本</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(detail.data?.documents || []).length === 0 ? <p className="text-sm text-muted-foreground">尚未上传岗位资料</p> : (detail.data?.documents || []).map((document: any) => (
            <div key={document.id} className="rounded-lg border p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{document.title}</span><Badge variant="outline">v{document.version}</Badge><Badge className={statusClass(document.status)}>{statusLabel(document.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{document.effectiveMonth} ・ {document.fileName} ・ {(Number(document.fileSize) / 1024).toFixed(1)}KB</p></div>
                <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => download.mutate({ id: document.id })}><Download className="mr-1 h-4 w-4" />原件</Button><Button size="sm" variant="outline" onClick={() => openDocumentEditor(document)}>内容确认</Button>{document.status !== "active" && <Button size="sm" onClick={() => activate.mutate({ id: document.id })} disabled={activate.isPending}><CheckCircle2 className="mr-1 h-4 w-4" />启用</Button>}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {documentDraft && <Card className="border-blue-200"><CardHeader className="pb-3"><CardTitle className="text-base">结构化岗位内容确认</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-2"><Label>标题</Label><Input value={documentDraft.title} onChange={event => setDocumentDraft(previous => previous ? { ...previous, title: event.target.value } : previous)} /></div>
        {([['responsibilities','岗位职责'],['goalsAndMetrics','目标・KPI'],['risks','风险问题'],['supportNeeded','所需支持'],['departmentSopContent','部门SOP候选']] as const).map(([key,label]) => <div key={key} className="space-y-2"><Label>{label}</Label><Textarea value={documentDraft[key]} onChange={event => setDocumentDraft(previous => previous ? { ...previous, [key]: event.target.value } : previous)} className="min-h-28" /></div>)}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDocumentDraft(null)}>取消</Button><Button onClick={() => updateDocument.mutate(documentDraft)} disabled={updateDocument.isPending}>{updateDocument.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}保存结构</Button></div>
      </CardContent></Card>}

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="text-base">月度推进记录</CardTitle><Input type="month" value={reviewMonth} onChange={event => setReviewMonth(event.target.value)} className="w-44" /></div></CardHeader>
        <CardContent className="space-y-4">
          {pendingReviews.map((item: any) => <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><div className="flex items-center justify-between"><p className="font-semibold">{item.reviewMonth} 待确认</p><Badge className={statusClass(item.status)}>{statusLabel(item.status)}</Badge></div><div className="mt-3 grid gap-3 md:grid-cols-2">{[['本月目标',item.focusGoals],['完成事项',item.achievements],['结果数据',item.metricsResult],['未完成事项',item.incompleteItems],['问题风险',item.problemsAndRisks],['所需支持',item.supportNeeded],['下月计划',item.nextMonthPlan]].map(([label,value]) => <div key={label} className="rounded-lg bg-white p-3"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm">{value || '—'}</p></div>)}</div><div className="mt-3 space-y-2"><Label>主管确认备注（退回时必填）</Label><Textarea value={reviewComment[item.id] || ""} onChange={event => setReviewComment(previous => ({ ...previous, [item.id]: event.target.value }))} className="min-h-20" /></div><div className="mt-3 flex justify-end gap-2"><Button variant="outline" className="text-rose-700" onClick={() => review.mutate({ id: item.id, decision: "request_revision", comment: reviewComment[item.id] || "" })}><XCircle className="mr-1 h-4 w-4" />退回修改</Button><Button onClick={() => review.mutate({ id: item.id, decision: "approve", comment: reviewComment[item.id] || "" })}><CheckCircle2 className="mr-1 h-4 w-4" />确认</Button></div></div>)}
          {pendingReviews.length === 0 && <p className="text-sm text-muted-foreground">当前没有待确认记录</p>}
          {(detail.data?.reviews || []).filter((item: any) => item.status !== "submitted").map((item: any) => <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2"><div><p className="font-medium">{item.reviewMonth}</p>{item.reviewComment && <p className="mt-1 text-xs text-muted-foreground">主管备注：{item.reviewComment}</p>}</div><div className="flex items-center gap-2"><Badge className={statusClass(item.status)}>{statusLabel(item.status)}</Badge>{item.status === "revision_requested" && <RefreshCw className="h-4 w-4 text-rose-600" />}</div></div>)}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">员工：{staffName || detail.data?.staff?.name || staffId}</p>
    </div>
  );
}
