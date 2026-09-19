import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Mail, Send, SquareUserRound, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type LcfBulkAudienceType = "company" | "liver" | "general" | "sponsor";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAudience?: LcfBulkAudienceType;
};

const AUDIENCES: Array<{ value: LcfBulkAudienceType; label: string; description: string; icon: typeof Mail }> = [
  { value: "company", label: "企業・ブランド", description: "企業申込の担当者", icon: Building2 },
  { value: "liver", label: "ライブコマーサー", description: "ライブコマーサー申込者", icon: SquareUserRound },
  { value: "general", label: "一般参加", description: "一般来場の申込者", icon: Users },
  { value: "sponsor", label: "スポンサー", description: "確定スポンサー担当者", icon: CheckCircle2 },
];

const DEFAULT_SUBJECT = "【LIVE COMMERCE FESTIVAL】開催に関するご案内";
const DEFAULT_BODY = `{{name}} 様

LIVE COMMERCE FESTIVAL運営事務局です。

LIVE COMMERCE FESTIVALは、企業・ブランドとライブコマーサー、来場者が出会い、商談・配信・販売へつながる公式イベントです。

開催・参加に関する最新情報をご案内いたします。
詳細をご確認いただき、ご不明点がございましたら、このメールへそのままご返信ください。`;

function audienceLabel(value: LcfBulkAudienceType): string {
  return AUDIENCES.find((audience) => audience.value === value)?.label || value;
}

export function LcfBulkEmailDialog({ open, onOpenChange, initialAudience }: Props) {
  const [audienceTypes, setAudienceTypes] = useState<LcfBulkAudienceType[]>(initialAudience ? [initialAudience] : ["company"]);
  const [eventYear, setEventYear] = useState<"all" | "2026" | "2026-02">("all");
  const [applicationStatuses, setApplicationStatuses] = useState<Array<"new" | "confirmed" | "rejected" | "cancelled">>(["confirmed"]);
  const [attendanceSchedule, setAttendanceSchedule] = useState<"all" | "day1_only" | "day2_only" | "both_days">("all");
  const [subjectTemplate, setSubjectTemplate] = useState(DEFAULT_SUBJECT);
  const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_BODY);
  const [preview, setPreview] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [campaignId, setCampaignId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !initialAudience) return;
    setAudienceTypes([initialAudience]);
  }, [open, initialAudience]);

  const selection = useMemo(() => ({ eventYear, audienceTypes, applicationStatuses, attendanceSchedule }), [eventYear, audienceTypes, applicationStatuses, attendanceSchedule]);
  const previewMutation = trpc.festival.previewLcfBulkEmail.useMutation({
    onSuccess: (result) => {
      setPreview(result);
      setConfirmed(false);
    },
    onError: (error) => toast.error(error.message),
  });
  const createMutation = trpc.festival.createLcfBulkEmailCampaign.useMutation({
    onSuccess: (result) => {
      setCampaignId(result.campaignId);
      toast.success(`${result.recipientCount}件の個別配信を開始しました`);
    },
    onError: (error) => toast.error(error.message),
  });
  const campaignQuery = trpc.festival.lcfBulkEmailCampaign.useQuery(
    { campaignId: campaignId || 0 },
    { enabled: Boolean(campaignId), refetchInterval: campaignId ? 3_000 : false },
  );
  const recentQuery = trpc.festival.listLcfBulkEmailCampaigns.useQuery({ limit: 10 }, { enabled: open });
  const cancelMutation = trpc.festival.cancelLcfBulkEmailCampaign.useMutation({
    onSuccess: async () => {
      toast.success("未送信分を停止しました");
      await campaignQuery.refetch();
      await recentQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const campaign = campaignQuery.data;
  const progress = campaign?.recipientCount ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.recipientCount) * 100) : 0;
  const isFinished = campaign?.status === "completed" || campaign?.status === "partial" || campaign?.status === "cancelled";

  const toggleAudience = (value: LcfBulkAudienceType) => {
    setAudienceTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPreview(null);
    setConfirmed(false);
  };

  const toggleStatus = (value: "new" | "confirmed" | "rejected" | "cancelled") => {
    setApplicationStatuses((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPreview(null);
    setConfirmed(false);
  };

  const handlePreview = () => {
    if (audienceTypes.length === 0) return toast.error("送信先の属性を1つ以上選んでください");
    if (applicationStatuses.length === 0 && audienceTypes.some((type) => type !== "sponsor")) return toast.error("申込状態を1つ以上選んでください");
    previewMutation.mutate({ selection, subjectTemplate, bodyTemplate });
  };

  const handleCreate = () => {
    if (!preview || !confirmed) return;
    createMutation.mutate({ selection, subjectTemplate, bodyTemplate, confirmation: "一斉送信を開始" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-24px)] max-w-[1120px] flex-col overflow-hidden border-amber-500/30 bg-[#101014] p-0 text-white">
        <DialogHeader className="border-b border-white/10 px-5 py-4 sm:px-7">
          <DialogTitle className="flex items-center gap-2 text-xl"><Mail className="h-5 w-5 text-amber-400" />属性別 LCF一斉メール</DialogTitle>
          <DialogDescription className="text-gray-400">対象者ごとに宛名を差し込み、1通ずつ安全に配信します。返信はLCF管理画面の同じやり取りへ反映されます。</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {campaignId && campaign ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">Campaign #{campaign.id}</p>
                    <h3 className="mt-1 text-xl font-bold">{campaign.subjectTemplate}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm">{campaign.status === "completed" ? "配信完了" : campaign.status === "partial" ? "一部エラー" : campaign.status === "cancelled" ? "停止" : "配信中"}</span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-400 transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><p className="text-gray-500">対象</p><p className="text-lg font-bold">{campaign.recipientCount}</p></div>
                  <div><p className="text-gray-500">送信済み</p><p className="text-lg font-bold text-emerald-400">{campaign.sentCount}</p></div>
                  <div><p className="text-gray-500">エラー</p><p className="text-lg font-bold text-red-400">{campaign.failedCount}</p></div>
                  <div><p className="text-gray-500">進捗</p><p className="text-lg font-bold text-amber-300">{progress}%</p></div>
                </div>
              </div>
              {campaign.recipients?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <h4 className="mb-3 font-bold">宛先別の配信状態</h4>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {campaign.recipients.map((recipient: any) => (
                      <div key={recipient.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                        <div className="min-w-0"><p className="truncate font-medium">{recipient.name} <span className="text-gray-500">{recipient.email}</span></p><p className="text-xs text-gray-500">{audienceLabel(recipient.applicationType)}</p></div>
                        <span className={recipient.status === "sent" ? "text-emerald-400" : recipient.status === "failed" ? "text-red-400" : "text-amber-300"}>{recipient.status === "sent" ? "送信済み" : recipient.status === "failed" ? `エラー ${recipient.errorCode || ""}` : recipient.status === "cancelled" ? "停止" : "待機中"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                {!isFinished && <Button variant="outline" className="border-red-400/40 text-red-300" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate({ campaignId, confirmation: "未送信分を停止" })}>未送信分を停止</Button>}
                <Button className="bg-amber-400 text-black hover:bg-amber-300" onClick={() => { setCampaignId(null); setPreview(null); setConfirmed(false); recentQuery.refetch(); }}>新しい一斉送信を作る</Button>
              </div>
            </div>
          ) : (
            <div className="grid min-w-0 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="min-w-0 space-y-5">
                <section>
                  <h3 className="mb-3 font-bold">1. 送信する属性</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {AUDIENCES.map((audience) => {
                      const Icon = audience.icon;
                      const checked = audienceTypes.includes(audience.value);
                      return <button key={audience.value} type="button" onClick={() => toggleAudience(audience.value)} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${checked ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                        <Checkbox checked={checked} aria-label={audience.label} /><Icon className="h-5 w-5 shrink-0 text-amber-300" /><span className="min-w-0"><span className="block font-bold">{audience.label}</span><span className="block text-xs text-gray-500">{audience.description}</span></span>
                      </button>;
                    })}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">LINE登録はメールアドレスを保持しないため対象外です。</p>
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm"><span className="mb-1.5 block font-bold">開催回</span><select value={eventYear} onChange={(event) => { setEventYear(event.target.value as any); setPreview(null); }} className="h-10 w-full rounded-md border border-white/10 bg-[#18181d] px-3"><option value="all">すべての開催回</option><option value="2026">第1回｜2026年9月</option><option value="2026-02">第2回｜2026年12月</option></select></label>
                  <label className="text-sm"><span className="mb-1.5 block font-bold">参加日程</span><select value={attendanceSchedule} onChange={(event) => { setAttendanceSchedule(event.target.value as any); setPreview(null); }} className="h-10 w-full rounded-md border border-white/10 bg-[#18181d] px-3"><option value="all">すべての日程</option><option value="day1_only">1日目のみ</option><option value="day2_only">2日目のみ</option><option value="both_days">両日</option></select></label>
                </section>

                <section>
                  <h3 className="mb-2 font-bold">申込状態</h3>
                  <div className="flex flex-wrap gap-2">{([ ["confirmed", "参加確定"], ["new", "新規"], ["rejected", "却下"], ["cancelled", "キャンセル"] ] as const).map(([value, label]) => <button type="button" key={value} onClick={() => toggleStatus(value)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${applicationStatuses.includes(value) ? "border-amber-400 bg-amber-400/10 text-amber-200" : "border-white/10 text-gray-400"}`}>{label}</button>)}</div>
                </section>

                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs leading-6 text-cyan-100"><strong>差し込み項目：</strong> <code>{"{{name}}"}</code> 氏名、<code>{"{{company}}"}</code> 会社名、<code>{"{{event}}"}</code> 開催回、<code>{"{{type}}"}</code> 属性</div>
              </div>

              <div className="min-w-0 space-y-4">
                <div><label className="mb-1.5 block text-sm font-bold">件名</label><Input value={subjectTemplate} onChange={(event) => { setSubjectTemplate(event.target.value); setPreview(null); }} className="border-white/10 bg-white/5" /></div>
                <div><label className="mb-1.5 block text-sm font-bold">本文</label><Textarea value={bodyTemplate} onChange={(event) => { setBodyTemplate(event.target.value); setPreview(null); }} className="min-h-[260px] border-white/10 bg-white/5 leading-7" /></div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-6 text-amber-100">配信メールは <strong>LIVE COMMERCE FESTIVAL</strong> の公式デザインで、送信元 <strong>LCF@livecommercejapan.jp</strong>、返信可能な個別メールとして送られます。</div>
                <Button className="w-full bg-amber-400 text-black hover:bg-amber-300" disabled={previewMutation.isPending} onClick={handlePreview}>{previewMutation.isPending ? "対象を集計中…" : "対象件数と本文を確認"}</Button>

                {preview && (
                  <div className="space-y-4 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-gray-400">重複除外後の送信対象</p><p className="text-3xl font-black text-amber-300">{preview.recipientCount}<span className="ml-1 text-sm">件</span></p></div><div className="text-right text-xs text-gray-400">{Object.entries(preview.counts || {}).filter(([, value]) => Number(value) > 0).map(([type, value]) => <div key={type}>{audienceLabel(type as LcfBulkAudienceType)} {String(value)}件</div>)}</div></div>
                    {preview.validationErrors?.length > 0 ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"><AlertTriangle className="mr-2 inline h-4 w-4" />{preview.validationErrors.join(" / ")}</div> : preview.sample ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"><p className="text-xs text-gray-500">送信サンプル：{preview.sample.name}様（{preview.sample.email}）</p><p className="mt-2 font-bold">{preview.sample.subject}</p><p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-gray-300">{preview.sample.body}</p></div> : <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">条件に一致する送信先がありません。</div>}
                    {preview.recipientCount > 0 && preview.validationErrors?.length === 0 && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-400/30 bg-red-400/[0.06] p-3 text-sm"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} className="mt-0.5" /><span><strong>{preview.recipientCount}件へ実際にメール送信することを確認しました。</strong><br /><span className="text-xs text-gray-400">開始後は1通ずつ個別配信されます。宛先を他の受信者へ公開しません。</span></span></label>}
                    <Button className="w-full bg-red-500 text-white hover:bg-red-400" disabled={!confirmed || createMutation.isPending || preview.recipientCount === 0 || preview.validationErrors?.length > 0} onClick={handleCreate}><Send className="mr-2 h-4 w-4" />{createMutation.isPending ? "キャンペーン作成中…" : `${preview.recipientCount}件の一斉送信を開始`}</Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!campaignId && recentQuery.data && recentQuery.data.length > 0 && (
            <section className="mt-7 border-t border-white/10 pt-5"><h3 className="mb-3 font-bold">最近の一斉送信</h3><div className="grid gap-2 sm:grid-cols-2">{recentQuery.data.map((item: any) => <button type="button" key={item.id} onClick={() => setCampaignId(Number(item.id))} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:border-amber-400/30"><span className="min-w-0"><span className="block truncate text-sm font-bold">{item.subjectTemplate}</span><span className="block text-xs text-gray-500">{new Date(item.createdAt).toLocaleString("ja-JP")}・対象{item.recipientCount}件</span></span><span className={item.failedCount > 0 ? "text-red-400" : "text-emerald-400"}>{item.sentCount}/{item.recipientCount}</span></button>)}</div></section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
