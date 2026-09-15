import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock3, Download, FileClock, Loader2, PencilLine, Upload, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";

function monthNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

const labels: Record<string, string> = { not_started: "未填写", draft: "草稿", submitted: "待确认", approved: "已确认", revision_requested: "需修改" };
const badgeClasses: Record<string, string> = { not_started: "bg-slate-100 text-slate-700", draft: "bg-blue-100 text-blue-800", submitted: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", revision_requested: "bg-rose-100 text-rose-800" };

export default function HrMonthlyReviewOverview({ onOpenStaff }: { onOpenStaff: (staffId: number) => void }) {
  const [reviewMonth, setReviewMonth] = useState(monthNow);
  const [department, setDepartment] = useState("运営部");
  const [departmentTitle, setDepartmentTitle] = useState("部门岗位・SOP资料");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overview = trpc.hrRoleReview.adminOverview.useQuery({ reviewMonth });
  const departmentDocuments = trpc.hrRoleReview.departmentDocuments.useQuery();
  const managementScope = overview.data?.managementScope as { isSuperAdmin?: boolean; department?: string | null } | undefined;
  const departmentLocked = Boolean(managementScope && !managementScope.isSuperAdmin);
  useEffect(() => {
    if (departmentLocked && managementScope?.department) setDepartment(managementScope.department);
  }, [departmentLocked, managementScope?.department]);
  const activate = trpc.hrRoleReview.activateDocument.useMutation({ onSuccess: () => { toast.success("部门资料已启用"); departmentDocuments.refetch(); }, onError: error => toast.error("启用失败", { description: error.message }) });
  const download = trpc.hrRoleReview.documentDownload.useMutation({ onSuccess: data => window.open(data.url, "_blank", "noopener,noreferrer"), onError: error => toast.error("下载失败", { description: error.message }) });
  const counts = overview.data?.counts || {};
  const cards = [
    ["not_started", "未填写", UserRoundSearch],
    ["draft", "草稿", PencilLine],
    ["submitted", "待主管确认", Clock3],
    ["approved", "已确认", CheckCircle2],
    ["revision_requested", "需修改", FileClock],
  ] as const;

  async function uploadDepartmentDocument(file: File) {
    setUploading(true);
    try {
      const params = new URLSearchParams({ scope: "department", department: department.trim(), title: departmentTitle.trim(), effectiveMonth: reviewMonth });
      const form = new FormData();
      form.append("originalFileName", file.name);
      form.append("file", file);
      const response = await fetch(`/api/hr-role/document-upload?${params.toString()}`, { method: "POST", credentials: "include", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || body.errorCode || "部门资料上传失败");
      toast.success("部门资料已上传，确认后可启用");
      await departmentDocuments.refetch();
    } catch (error) {
      toast.error("上传失败", { description: error instanceof Error ? error.message : "请重试" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return <div className="space-y-5" data-testid="hr-monthly-review-overview">
    <div className="flex flex-col gap-3 rounded-xl border bg-gradient-to-r from-amber-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-semibold">月度岗位目标・推进复盘</h2><p className="mt-1 text-sm text-muted-foreground">员工每月填写一次，主管确认后形成不可覆盖的月份历史。</p></div>
      <div className="flex items-center gap-2"><Label htmlFor="hr-month-overview">対象月</Label><Input id="hr-month-overview" type="month" value={reviewMonth} onChange={event => setReviewMonth(event.target.value)} className="w-44" /></div>
    </div>
    {overview.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : overview.error ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{overview.error.message}</p> : <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{cards.map(([key,label,Icon]) => <Card key={key}><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-slate-100 p-2"><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-bold">{Number((counts as any)[key] || 0)}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>)}</div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">员工</th><th className="px-4 py-3 text-left">部门・岗位</th><th className="px-4 py-3 text-left">岗位资料</th><th className="px-4 py-3 text-left">月度状态</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody>{(overview.data?.staff || []).map((member: any) => <tr key={member.id} className="border-t"><td className="px-4 py-3 font-medium">{member.nameEn || member.name}</td><td className="px-4 py-3 text-muted-foreground">{member.department || '未设置'} / {member.position || '未设置'}</td><td className="px-4 py-3">{member.roleDocument ? <Badge variant="outline">v{member.roleDocument.version} {member.roleDocument.status === 'active' ? '使用中' : '待确认'}</Badge> : <span className="text-muted-foreground">未上传</span>}</td><td className="px-4 py-3"><Badge className={badgeClasses[member.reviewStatus] || badgeClasses.not_started}>{labels[member.reviewStatus] || member.reviewStatus}</Badge></td><td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => onOpenStaff(Number(member.id))}>查看・确认</Button></td></tr>)}</tbody></table>
      </div>

      <Card><CardContent className="space-y-4 p-4">
        <div><h3 className="font-semibold">部门岗位・SOP资料库</h3><p className="mt-1 text-sm text-muted-foreground">多人共同文件放在部门资料库，不绑定到单一员工。</p></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><div><Label htmlFor="department-name">部门</Label><Input id="department-name" value={department} onChange={event => setDepartment(event.target.value)} disabled={departmentLocked} />{departmentLocked && <p className="mt-1 text-xs text-muted-foreground">部门负责人只能管理本人负责部门</p>}</div><div><Label htmlFor="department-document-title">资料标题</Label><Input id="department-document-title" value={departmentTitle} onChange={event => setDepartmentTitle(event.target.value)} /></div><div><input ref={fileInputRef} type="file" className="hidden" accept=".doc,.docx,.pdf,.txt,.md,.xlsx" onChange={event => { const file = event.target.files?.[0]; if (file) uploadDepartmentDocument(file); }} /><Button onClick={() => fileInputRef.current?.click()} disabled={uploading || !department.trim() || !departmentTitle.trim()}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}部门资料上传</Button></div></div>
        <div className="space-y-2">{(departmentDocuments.data || []).length === 0 ? <p className="text-sm text-muted-foreground">尚无部门资料</p> : (departmentDocuments.data || []).map((document: any) => <div key={document.id} className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{document.title}</span><Badge variant="outline">{document.department}</Badge><Badge className={document.status === 'active' ? badgeClasses.approved : badgeClasses.submitted}>{document.status === 'active' ? '使用中' : document.status === 'pending_review' ? '待确认' : '历史版本'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{document.effectiveMonth} ・ v{document.version}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => download.mutate({ id: document.id })}><Download className="mr-1 h-4 w-4" />原件</Button>{document.status !== 'active' && <Button size="sm" onClick={() => activate.mutate({ id: document.id })}>启用</Button>}</div></div>)}</div>
      </CardContent></Card>
    </>}
  </div>;
}
