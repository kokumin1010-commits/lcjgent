/**
 * 第2回LCFの申込・QR・同行者を開催回単位で管理する操作パネル。
 * Design: black/gold operational dashboard; destructive actions are explicit and audited.
 */
import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Loader2, MapPin, Pencil, Plus, QrCode, Trash2, UserRoundPlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LCF_EVENT_DEFINITIONS } from "@shared/lcfEventDefinitions";

type ApplicantType = "company" | "liver" | "general";
type Schedule = "day1_only" | "day2_only" | "both_days";

const applicantLabels: Record<ApplicantType, string> = {
  company: "企業・ブランド",
  liver: "ライブコマーサー",
  general: "一般参加",
};

const scheduleLabels: Record<Schedule, string> = {
  day1_only: "12月8日のみ",
  day2_only: "12月9日のみ",
  both_days: "12月8日・9日の両日",
};

const emptyCompanion = { fullName: "", fullNameKana: "", email: "" };

export function LcfEditionApplicationCenter() {
  const event = LCF_EVENT_DEFINITIONS[2];
  const applicationsQuery = trpc.festival.getMyApplications.useQuery();
  const ticketsQuery = trpc.festival.getMyTickets.useQuery();
  const companionsQuery = trpc.festival.getMyCompanions.useQuery({ eventYear: "2026-02" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scheduleTarget, setScheduleTarget] = useState<any | null>(null);
  const [schedule, setSchedule] = useState<Schedule>("both_days");
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [companionTarget, setCompanionTarget] = useState<any | null>(null);
  const [editingCompanion, setEditingCompanion] = useState<any | null>(null);
  const [companionForm, setCompanionForm] = useState(emptyCompanion);
  const [companionCancelTarget, setCompanionCancelTarget] = useState<any | null>(null);
  const [companionCancelReason, setCompanionCancelReason] = useState("");

  const refresh = async () => {
    await Promise.all([applicationsQuery.refetch(), ticketsQuery.refetch(), companionsQuery.refetch()]);
  };

  const updateSchedule = trpc.festival.updateMyEditionAttendance.useMutation({
    onSuccess: async () => {
      setMessage("参加日程を変更しました。");
      setError("");
      setScheduleTarget(null);
      await refresh();
    },
    onError: (err) => setError(err.message),
  });
  const cancelApplication = trpc.festival.cancelMyEditionApplication.useMutation({
    onSuccess: async () => {
      setMessage("第2回の申込みをキャンセルしました。申込履歴はマイページに残ります。");
      setError("");
      setCancelTarget(null);
      setCancelReason("");
      await refresh();
    },
    onError: (err) => setError(err.message),
  });
  const addCompanion = trpc.festival.addMyCompanion.useMutation({
    onSuccess: async () => {
      setMessage("同行者を登録し、専用QRを発行しました。");
      setError("");
      setCompanionTarget(null);
      setCompanionForm(emptyCompanion);
      await refresh();
    },
    onError: (err) => setError(err.message),
  });
  const updateCompanion = trpc.festival.updateMyCompanion.useMutation({
    onSuccess: async () => {
      setMessage("同行者情報を更新しました。");
      setError("");
      setEditingCompanion(null);
      setCompanionForm(emptyCompanion);
      await refresh();
    },
    onError: (err) => setError(err.message),
  });
  const cancelCompanion = trpc.festival.cancelMyCompanion.useMutation({
    onSuccess: async () => {
      setMessage("同行者をキャンセルしました。QRは無効化され、履歴は保持されます。");
      setError("");
      setCompanionCancelTarget(null);
      setCompanionCancelReason("");
      await refresh();
    },
    onError: (err) => setError(err.message),
  });

  const applications = useMemo(
    () => (applicationsQuery.data || []).filter((item: any) => item.eventYear === "2026-02"),
    [applicationsQuery.data],
  );
  const tickets = ticketsQuery.data || [];
  const companions = companionsQuery.data || [];

  if (applicationsQuery.isLoading) {
    return <div className="flex items-center gap-2 border border-white/10 bg-white/[0.035] p-5 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />第2回の申込情報を読み込み中...</div>;
  }
  if (!applications.length) return null;

  const openCompanionForm = (application: any, companion?: any) => {
    setError("");
    setCompanionTarget(application);
    setEditingCompanion(companion || null);
    setCompanionForm(companion ? {
      fullName: companion.fullName || "",
      fullNameKana: companion.fullNameKana || "",
      email: companion.email || "",
    } : emptyCompanion);
  };

  return (
    <section className="overflow-hidden border border-amber-400/30 bg-[#111116]" aria-labelledby="second-edition-application-heading">
      <div className="border-b border-white/10 bg-gradient-to-r from-amber-500/10 to-transparent p-5 sm:p-6">
        <p className="text-[10px] font-black tracking-[0.2em] text-amber-400">MY APPLICATION / EDITION 02</p>
        <h2 id="second-edition-application-heading" className="mt-2 text-xl font-black sm:text-2xl">第2回の参加内容・QR</h2>
        <div className="mt-4 grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
          <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />{event.dateText}</p>
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />{event.venueName}</p>
        </div>
      </div>

      {(message || error) && (
        <div className={`mx-4 mt-4 border p-3 text-sm sm:mx-6 ${error ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-green-500/30 bg-green-500/10 text-green-200"}`} role="status">
          {error || message}
        </div>
      )}

      <div className="space-y-5 p-4 sm:p-6">
        {applications.map((application: any) => {
          const applicantType = application.applicantType as ApplicantType;
          const isActive = application.status === "new" || application.status === "confirmed";
          const applicationTickets = tickets.filter((ticket: any) =>
            ticket.eventYear === "2026-02"
            && ticket.applicantType === applicantType
            && Number(ticket.applicationId) === Number(application.applicationId)
            && ticket.holderType !== "companion",
          );
          const applicationCompanions = companions.filter((companion: any) =>
            Number(companion.applicationId) === Number(application.applicationId)
            && companion.applicantType === applicantType,
          );
          return (
            <article key={`${applicantType}-${application.applicationId}`} className="border border-white/10 bg-black/25 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black text-amber-300">{applicantLabels[applicantType]}申込み</p>
                  <h3 className="mt-1 text-lg font-black">{application.displayName}</h3>
                  {application.organization && <p className="mt-1 text-xs text-gray-400">{application.organization}</p>}
                </div>
                <span className={`w-fit border px-3 py-1 text-xs font-black ${isActive ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-gray-500/30 bg-gray-500/10 text-gray-300"}`}>
                  {application.status === "cancelled" ? "キャンセル済み" : application.status === "rejected" ? "無効" : "参加確定"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-[10px] font-bold text-gray-500">参加日程</p>
                  <p className="mt-1 text-sm font-bold">{scheduleLabels[(application.attendanceSchedule || "both_days") as Schedule]}</p>
                </div>
                <div className="border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-[10px] font-bold text-gray-500">申込番号</p>
                  <p className="mt-1 text-sm font-mono">{applicantType.toUpperCase()}-{application.applicationId}</p>
                </div>
              </div>

              {isActive && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {applicantType !== "company" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-amber-400/40 bg-transparent text-amber-200 hover:bg-amber-400/10 hover:text-amber-100"
                      onClick={() => {
                        setError("");
                        setScheduleTarget(application);
                        setSchedule((application.attendanceSchedule || "both_days") as Schedule);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />日程を変更
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-500/35 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    onClick={() => { setError(""); setCancelTarget(application); setCancelReason(""); }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />申込みをキャンセル
                  </Button>
                </div>
              )}

              {applicationTickets.length > 0 && (
                <div className="mt-5 border-t border-white/10 pt-5">
                  <h4 className="flex items-center gap-2 text-sm font-black"><QrCode className="h-4 w-4 text-amber-400" />本人用入場QR</h4>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="w-fit bg-white p-3"><QRCodeSVG value={applicationTickets[0].ticketId} size={132} level="H" /></div>
                    <div>
                      <p className="font-mono text-xs text-amber-300">{applicationTickets[0].ticketId}</p>
                      <p className="mt-2 text-xs leading-5 text-gray-400">このQRは申込者本人専用です。同行者には下記から別のQRを発行してください。</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-black"><UserRoundPlus className="h-4 w-4 text-amber-400" />同行者</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-400">同行者は1名ずつ登録し、本人とは別の入場QRをご提示ください。</p>
                  </div>
                  {isActive && (
                    <Button type="button" className="bg-amber-400 font-black text-black hover:bg-amber-300" onClick={() => openCompanionForm(application)}>
                      <Plus className="mr-2 h-4 w-4" />同行者を登録
                    </Button>
                  )}
                </div>

                {applicationCompanions.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {applicationCompanions.map((companion: any) => (
                      <div key={companion.id} className={`border p-3 ${companion.status === "active" ? "border-white/10 bg-white/[0.035]" : "border-gray-700 bg-black/20 opacity-60"}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-black">{companion.fullName}</p>
                            <p className="text-xs text-gray-400">{companion.fullNameKana}｜{companion.email}</p>
                          </div>
                          <span className="text-xs font-bold text-gray-400">{companion.status === "active" ? "登録済み" : "キャンセル済み"}</span>
                        </div>
                        {companion.status === "active" && companion.ticketId && (
                          <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center">
                            <div className="w-fit bg-white p-2"><QRCodeSVG value={companion.ticketId} size={104} level="H" /></div>
                            <div className="min-w-0 flex-1">
                              <p className="break-all font-mono text-[11px] text-amber-300">{companion.ticketId}</p>
                              <p className="mt-1 text-xs text-gray-400">{Number(companion.admissionCount || 0) > 0 ? `受付済み ${companion.admissionCount}名` : "同行者本人が受付で提示"}</p>
                            </div>
                            {Number(companion.admissionCount || 0) === 0 && (
                              <div className="flex gap-2">
                                <Button type="button" size="sm" variant="outline" onClick={() => openCompanionForm(application, companion)}>編集</Button>
                                <Button type="button" size="sm" variant="outline" className="border-red-500/35 text-red-300" onClick={() => { setError(""); setCompanionCancelTarget(companion); setCompanionCancelReason(""); }}>取消</Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 border border-dashed border-white/15 p-4 text-xs text-gray-500">同行者はまだ登録されていません。</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={Boolean(scheduleTarget)} onOpenChange={(open) => !open && setScheduleTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>第2回の参加日程を変更</DialogTitle><DialogDescription>12月8日・9日の参加予定を選択してください。受付後はマイページから変更できません。</DialogDescription></DialogHeader>
          <Select value={schedule} onValueChange={(value) => setSchedule(value as Schedule)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day1_only">12月8日のみ</SelectItem>
              <SelectItem value="day2_only">12月9日のみ</SelectItem>
              <SelectItem value="both_days">12月8日・9日の両日</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleTarget(null)}>閉じる</Button>
            <Button disabled={updateSchedule.isPending} onClick={() => scheduleTarget && updateSchedule.mutate({ eventYear: "2026-02", applicantType: scheduleTarget.applicantType, applicationId: Number(scheduleTarget.applicationId), attendanceSchedule: schedule })}>{updateSchedule.isPending ? "変更中..." : "日程を変更する"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>第2回の申込みをキャンセル</DialogTitle><DialogDescription>申込情報と監査履歴は削除せず、本人・同行者のQRを無効化します。受付後はマイページから取消できません。</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="application-cancel-reason">取消理由</Label><Textarea id="application-cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="例：参加予定が変更になったため" maxLength={500} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>戻る</Button>
            <Button variant="destructive" disabled={cancelReason.trim().length < 5 || cancelApplication.isPending} onClick={() => cancelTarget && cancelApplication.mutate({ eventYear: "2026-02", applicantType: cancelTarget.applicantType, applicationId: Number(cancelTarget.applicationId), reason: cancelReason.trim(), confirmation: "第2回申込みをキャンセルする" })}>{cancelApplication.isPending ? "処理中..." : "申込みをキャンセルする"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(companionTarget)} onOpenChange={(open) => { if (!open) { setCompanionTarget(null); setEditingCompanion(null); setCompanionForm(emptyCompanion); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCompanion ? "同行者情報を編集" : "同行者を登録"}</DialogTitle><DialogDescription>同行者ごとに専用QRを発行します。受付で本人用QRを共用する必要はありません。</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label htmlFor="companion-name">氏名</Label><Input id="companion-name" value={companionForm.fullName} onChange={(event) => setCompanionForm((current) => ({ ...current, fullName: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="companion-kana">フリガナ</Label><Input id="companion-kana" value={companionForm.fullNameKana} onChange={(event) => setCompanionForm((current) => ({ ...current, fullNameKana: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="companion-email">メールアドレス</Label><Input id="companion-email" type="email" value={companionForm.email} onChange={(event) => setCompanionForm((current) => ({ ...current, email: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCompanionTarget(null); setEditingCompanion(null); }}>閉じる</Button>
            <Button disabled={!companionForm.fullName.trim() || !companionForm.fullNameKana.trim() || !companionForm.email.includes("@") || addCompanion.isPending || updateCompanion.isPending} onClick={() => {
              if (editingCompanion) {
                updateCompanion.mutate({ companionId: Number(editingCompanion.id), ...companionForm });
              } else if (companionTarget) {
                addCompanion.mutate({ eventYear: "2026-02", applicantType: companionTarget.applicantType, applicationId: Number(companionTarget.applicationId), ...companionForm });
              }
            }}>{addCompanion.isPending || updateCompanion.isPending ? "保存中..." : editingCompanion ? "変更を保存" : "同行者QRを発行"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(companionCancelTarget)} onOpenChange={(open) => !open && setCompanionCancelTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>同行者をキャンセル</DialogTitle><DialogDescription>{companionCancelTarget?.fullName}さんのQRを無効化します。履歴は削除されません。</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="companion-cancel-reason">取消理由</Label><Textarea id="companion-cancel-reason" value={companionCancelReason} onChange={(event) => setCompanionCancelReason(event.target.value)} maxLength={500} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanionCancelTarget(null)}>戻る</Button>
            <Button variant="destructive" disabled={companionCancelReason.trim().length < 5 || cancelCompanion.isPending} onClick={() => companionCancelTarget && cancelCompanion.mutate({ companionId: Number(companionCancelTarget.id), reason: companionCancelReason.trim() })}>{cancelCompanion.isPending ? "処理中..." : "同行者をキャンセル"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
