import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, CircleDollarSign, ClipboardCheck, Package, Plus, Send, ShieldCheck, Trash2, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import {
  ASSISTANT_ONSITE_LABELS,
  BRAND_LIVE_APPROVAL_STATUS_LABELS,
  GUARANTEE_TYPE_LABELS,
  type AssistantOnsiteValue,
  type BrandLiveApprovalStatus,
  type GuaranteeType,
} from "@shared/brandLiveApproval";

type ProductRow = {
  productId: number | null;
  productName: string;
  specification: string;
  originalPrice: string;
  discountedPrice: string;
  offerMechanism: string;
  commissionRate: string;
  inventory: string;
  notes: string;
};

type FormState = {
  targetLiverId: string;
  targetLiverName: string;
  liveAccount: string;
  assistantOnsite: AssistantOnsiteValue;
  assistantDetails: string;
  mechanismSummary: string;
  commissionRate: string;
  slotFeeAmount: string;
  guaranteeType: GuaranteeType;
  guaranteeValue: string;
  guaranteeTerms: string;
  scheduledStart: string;
  scheduledEnd: string;
  businessNotes: string;
  products: ProductRow[];
};

function localDateTimeInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function emptyProduct(): ProductRow {
  return { productId: null, productName: "", specification: "", originalPrice: "", discountedPrice: "", offerMechanism: "", commissionRate: "", inventory: "", notes: "" };
}

function emptyForm(): FormState {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(19, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 60 * 60_000);
  return {
    targetLiverId: "",
    targetLiverName: "",
    liveAccount: "",
    assistantOnsite: "tbd",
    assistantDetails: "",
    mechanismSummary: "",
    commissionRate: "",
    slotFeeAmount: "",
    guaranteeType: "none",
    guaranteeValue: "",
    guaranteeTerms: "",
    scheduledStart: localDateTimeInput(start),
    scheduledEnd: localDateTimeInput(end),
    businessNotes: "",
    products: [emptyProduct()],
  };
}

function formFromApproval(approval: any): FormState {
  return {
    targetLiverId: approval.targetLiverId ? String(approval.targetLiverId) : "",
    targetLiverName: approval.targetLiverName || "",
    liveAccount: approval.liveAccount || "",
    assistantOnsite: approval.assistantOnsite || "tbd",
    assistantDetails: approval.assistantDetails || "",
    mechanismSummary: approval.mechanismSummary || "",
    commissionRate: String(approval.commissionRate ?? ""),
    slotFeeAmount: String(approval.slotFeeAmount ?? ""),
    guaranteeType: approval.guaranteeType || "none",
    guaranteeValue: approval.guaranteeValue == null ? "" : String(approval.guaranteeValue),
    guaranteeTerms: approval.guaranteeTerms || "",
    scheduledStart: localDateTimeInput(new Date(approval.scheduledStart)),
    scheduledEnd: localDateTimeInput(new Date(approval.scheduledEnd)),
    businessNotes: approval.businessNotes || "",
    products: (approval.products || []).map((product: any) => ({
      productId: product.productId || null,
      productName: product.productName || "",
      specification: product.specification || "",
      originalPrice: String(product.originalPrice ?? ""),
      discountedPrice: String(product.discountedPrice ?? ""),
      offerMechanism: product.offerMechanism || "",
      commissionRate: product.commissionRate == null ? "" : String(product.commissionRate),
      inventory: product.inventory == null ? "" : String(product.inventory),
      notes: product.notes || "",
    })),
  };
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function yen(value: unknown): string {
  return value == null ? "-" : `¥${Number(value).toLocaleString("ja-JP")}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
}

const statusClass: Record<BrandLiveApprovalStatus, string> = {
  draft: "bg-slate-500/20 text-slate-200 border-slate-500/40",
  pending_approval: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  changes_requested: "bg-red-500/20 text-red-200 border-red-500/40",
  approved: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  scheduled: "bg-blue-500/20 text-blue-200 border-blue-500/40",
  cancelled: "bg-gray-500/20 text-gray-300 border-gray-500/40",
};

export default function BrandLiveApprovalPanel({
  brandId,
  brandName,
  livers,
  products,
  language,
}: {
  brandId: number;
  brandName: string;
  livers: any[];
  products: any[];
  language: string;
}) {
  const displayLanguage: "ja" | "zh" = language === "ja" ? "ja" : "zh";
  const isZh = displayLanguage === "zh";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [reviewComments, setReviewComments] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();
  const contextQuery = trpc.brandLiveApproval.context.useQuery(undefined, { retry: false });
  const listQuery = trpc.brandLiveApproval.listByBrand.useQuery({ brandId }, { enabled: brandId > 0, retry: false });
  const approvals = listQuery.data || [];
  const context = contextQuery.data;

  const refresh = async () => {
    await Promise.all([
      utils.brandLiveApproval.context.invalidate(),
      utils.brandLiveApproval.listByBrand.invalidate({ brandId }),
      utils.brand.getSchedules.invalidate(),
    ]);
  };
  const createMutation = trpc.brandLiveApproval.create.useMutation({ onSuccess: async () => { await refresh(); setDialogOpen(false); toast.success(isZh ? "条件草稿已保存" : "条件の下書きを保存しました"); }, onError: error => toast.error(error.message) });
  const updateMutation = trpc.brandLiveApproval.update.useMutation({ onSuccess: async () => { await refresh(); setDialogOpen(false); toast.success(isZh ? "条件已更新" : "条件を更新しました"); }, onError: error => toast.error(error.message) });
  const submitMutation = trpc.brandLiveApproval.submit.useMutation({ onSuccess: async () => { await refresh(); toast.success(isZh ? "已提交KG确认" : "KG確認へ提出しました"); }, onError: error => toast.error(error.message) });
  const reviewMutation = trpc.brandLiveApproval.review.useMutation({ onSuccess: async (_data, variables) => { await refresh(); toast.success(variables.decision === "approve" ? (isZh ? "已确认，可进入排班" : "承認しました。配信予定へ登録できます") : (isZh ? "已退回商务重新洽谈" : "再交渉として差し戻しました")); }, onError: error => toast.error(error.message) });
  const setApproverMutation = trpc.brandLiveApproval.setCurrentUserAsApprover.useMutation({ onSuccess: async data => { await refresh(); toast.success(isZh ? `${data.approverName} 已设为KG确认人` : `${data.approverName}さんをKG承認者に設定しました`); }, onError: error => toast.error(error.message) });

  const pendingCount = useMemo(() => approvals.filter((approval: any) => approval.status === "pending_approval").length, [approvals]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (approval: any) => {
    setEditing(approval);
    setForm(formFromApproval(approval));
    setDialogOpen(true);
  };

  const updateProduct = (index: number, patch: Partial<ProductRow>) => {
    setForm(current => ({ ...current, products: current.products.map((product, productIndex) => productIndex === index ? { ...product, ...patch } : product) }));
  };

  const selectProduct = (index: number, productId: string) => {
    if (productId === "manual") return updateProduct(index, { productId: null });
    const product = products.find(item => Number(item.id) === Number(productId));
    if (!product) return;
    updateProduct(index, {
      productId: Number(product.id),
      productName: product.productName || "",
      specification: product.productDetails || product.accessories || "",
      originalPrice: product.listPrice == null ? "" : String(product.listPrice),
      discountedPrice: product.specialPrice == null && product.listPrice == null ? "" : String(product.specialPrice ?? product.listPrice),
      commissionRate: String(product.commissionRate || "").replace("%", ""),
    });
  };

  const payload = () => {
    if (!form.targetLiverId) throw new Error("target liver is required");
    return ({
    brandId,
    targetLiverId: Number(form.targetLiverId),
    targetLiverName: form.targetLiverName,
    liveAccount: form.liveAccount,
    assistantOnsite: form.assistantOnsite,
    assistantDetails: form.assistantDetails || null,
    mechanismSummary: form.mechanismSummary,
    commissionRate: optionalNumber(form.commissionRate),
    slotFeeAmount: optionalInteger(form.slotFeeAmount),
    guaranteeType: form.guaranteeType,
    guaranteeValue: form.guaranteeType === "none" ? null : optionalNumber(form.guaranteeValue),
    guaranteeTerms: form.guaranteeType === "none" ? null : form.guaranteeTerms,
    scheduledStart: new Date(form.scheduledStart).toISOString(),
    scheduledEnd: new Date(form.scheduledEnd).toISOString(),
    businessNotes: form.businessNotes || null,
    products: form.products.map(product => ({
      productId: product.productId,
      productName: product.productName,
      specification: product.specification || null,
      originalPrice: optionalInteger(product.originalPrice),
      discountedPrice: optionalInteger(product.discountedPrice),
      offerMechanism: product.offerMechanism,
      commissionRate: optionalNumber(product.commissionRate),
      inventory: optionalInteger(product.inventory),
      notes: product.notes || null,
    })),
    });
  };

  const save = () => {
    try {
      const document = payload();
      if (editing) updateMutation.mutate({ id: editing.id, expectedRevision: editing.revision, document });
      else createMutation.mutate(document);
    } catch {
      toast.error(isZh ? "请检查日期和数字" : "日時と数値を確認してください");
    }
  };

  return (
    <>
      <section className="rounded-2xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-black/60 to-fuchsia-950/30 p-4 md:p-5 shadow-[0_0_45px_rgba(245,158,11,0.12)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-amber-300" />
              <h2 className="text-lg font-bold text-white">{isZh ? "KG 头部达人直播条件确认" : "KGトップライバー 配信条件承認"}</h2>
              {pendingCount > 0 && <Badge className="border-amber-400/50 bg-amber-500/20 text-amber-200">{isZh ? `待确认 ${pendingCount}` : `確認待ち ${pendingCount}`}</Badge>}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
              {isZh ? "商务填写助播、机制、佣金、坑位费、直播时间及商品价格/保ROI条件。KG确认前，系统禁止该品牌进入直播排班。" : "商務が助播・メカニズム・コミッション・坑位費・配信時間・商品価格・保証条件を提出。KG承認前はブランド配信を予定登録できません。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {context?.isSuperAdmin && !context?.isApprover && (
              <Button variant="outline" className="border-fuchsia-400/50 text-fuchsia-200" onClick={() => setApproverMutation.mutate()} disabled={setApproverMutation.isPending}>
                <UserCheck className="mr-2 h-4 w-4" />{isZh ? "将当前账号设为KG确认人" : "現在のアカウントをKG承認者に設定"}
              </Button>
            )}
            {context?.canContribute && (
              <Button className="bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />{isZh ? "新增直播条件" : "配信条件を追加"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-400">{isZh ? "KG确认人" : "KG承認者"}:</span>
          {context?.setting ? <Badge className="border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-100">{context.setting.approverName}</Badge> : <Badge className="border-red-400/40 bg-red-500/20 text-red-100">{isZh ? "尚未设置" : "未設定"}</Badge>}
          {context?.isApprover && <span className="text-emerald-300">{isZh ? "当前登录账号可确认" : "現在のログインで承認できます"}</span>}
        </div>

        {listQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">{isZh ? "加载中..." : "読み込み中..."}</div>
        ) : approvals.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-amber-400/30 bg-black/20 px-4 py-8 text-center text-sm text-gray-400">
            {isZh ? "还没有直播条件单。商务录入后提交给KG确认。" : "配信条件はまだありません。商務が入力してKGへ提出してください。"}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {approvals.map((approval: any) => {
              const status = approval.status as BrandLiveApprovalStatus;
              const isOpen = expanded.has(approval.id);
              return (
                <article key={approval.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/35">
                  <button className="flex w-full flex-col gap-3 p-4 text-left md:flex-row md:items-center md:justify-between" onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(approval.id)) next.delete(approval.id); else next.add(approval.id); return next; })}>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-fuchsia-500/15 p-2"><ClipboardCheck className="h-5 w-5 text-fuchsia-300" /></div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{approval.targetLiverName}</span>
                          <Badge className={statusClass[status]}>{BRAND_LIVE_APPROVAL_STATUS_LABELS[status][displayLanguage]}</Badge>
                          <span className="text-xs text-gray-500">#{approval.id}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300">
                          <span><CalendarClock className="mr-1 inline h-3.5 w-3.5" />{formatDateTime(approval.scheduledStart)} - {formatDateTime(approval.scheduledEnd)}</span>
                          <span><CircleDollarSign className="mr-1 inline h-3.5 w-3.5" />{approval.commissionRate == null ? "-" : `${approval.commissionRate}%`} / {isZh ? "坑位" : "坑位費"} {yen(approval.slotFeeAmount)}</span>
                          <span><Package className="mr-1 inline h-3.5 w-3.5" />{approval.products.length}{isZh ? "个商品" : "商品"}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          {isZh ? "录入" : "入力"}: {approval.createdByName} · {isZh ? "最后更新" : "最終更新"}: {approval.updatedByName}
                          {approval.submittedByName && <> · {isZh ? "提交" : "提出"}: {approval.submittedByName}</>}
                          {approval.reviewedByName && <> · {isZh ? "确认" : "承認"}: {approval.reviewedByName}</>}
                        </div>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/10 p-4">
                      <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-5">
                        <div className="rounded-lg bg-white/5 p-3"><div className="text-[11px] text-gray-500">1. {isZh ? "助播到场" : "助播の現場参加"}</div><div className="mt-1 text-white">{ASSISTANT_ONSITE_LABELS[approval.assistantOnsite as AssistantOnsiteValue][displayLanguage]}</div><div className="text-xs text-gray-400">{approval.assistantDetails || "-"}</div></div>
                        <div className="rounded-lg bg-white/5 p-3"><div className="text-[11px] text-gray-500">2. {isZh ? "机制" : "メカニズム"}</div><div className="mt-1 whitespace-pre-wrap text-white">{approval.mechanismSummary}</div></div>
                        <div className="rounded-lg bg-white/5 p-3"><div className="text-[11px] text-gray-500">3. {isZh ? "佣金" : "コミッション"}</div><div className="mt-1 text-xl font-bold text-emerald-300">{approval.commissionRate == null ? "-" : `${approval.commissionRate}%`}</div></div>
                        <div className="rounded-lg bg-white/5 p-3"><div className="text-[11px] text-gray-500">4. {isZh ? "坑位费" : "坑位費"}</div><div className="mt-1 text-xl font-bold text-amber-300">{yen(approval.slotFeeAmount)}</div></div>
                        <div className="rounded-lg bg-white/5 p-3"><div className="text-[11px] text-gray-500">5. {isZh ? "直播时间" : "配信時間"}</div><div className="mt-1 text-white">{formatDateTime(approval.scheduledStart)}<br />{formatDateTime(approval.scheduledEnd)}</div></div>
                      </div>

                      <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200"><ShieldCheck className="h-4 w-4" />{GUARANTEE_TYPE_LABELS[approval.guaranteeType as GuaranteeType][displayLanguage]}{approval.guaranteeValue != null ? `: ${approval.guaranteeValue}${approval.guaranteeType === "roi" ? "x" : ""}` : ""}</div>
                        <div className="mt-1 whitespace-pre-wrap text-xs text-gray-300">{approval.guaranteeTerms || (isZh ? "无保证条件" : "保証条件なし")}</div>
                      </div>

                      <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
                        <table className="min-w-[760px] w-full text-xs">
                          <thead className="bg-white/5 text-gray-400"><tr><th className="p-2 text-left">{isZh ? "商品/规格" : "商品・仕様"}</th><th className="p-2 text-right">{isZh ? "原价" : "通常価格"}</th><th className="p-2 text-right">{isZh ? "优惠价" : "割引価格"}</th><th className="p-2 text-right">{isZh ? "佣金" : "コミッション"}</th><th className="p-2 text-right">{isZh ? "库存" : "在庫"}</th><th className="p-2 text-left">{isZh ? "单品机制" : "商品メカニズム"}</th></tr></thead>
                          <tbody>{approval.products.map((product: any) => <tr key={product.id} className="border-t border-white/5"><td className="p-2 text-white">{product.productName}<div className="text-gray-500">{product.specification || "-"}</div></td><td className="p-2 text-right text-gray-300">{yen(product.originalPrice)}</td><td className="p-2 text-right font-semibold text-pink-300">{yen(product.discountedPrice)}</td><td className="p-2 text-right text-emerald-300">{product.commissionRate == null ? "-" : `${product.commissionRate}%`}</td><td className="p-2 text-right text-gray-300">{product.inventory == null ? "-" : product.inventory}</td><td className="p-2 whitespace-pre-wrap text-gray-300">{product.offerMechanism}</td></tr>)}</tbody>
                        </table>
                      </div>

                      {approval.reviewComment && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100"><AlertTriangle className="mr-2 inline h-4 w-4" />{approval.reviewComment}</div>}

                      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {context?.canContribute && ["draft", "changes_requested"].includes(status) && <Button variant="outline" size="sm" onClick={() => openEdit(approval)}>{isZh ? "编辑条件" : "条件を編集"}</Button>}
                          {context?.canContribute && ["draft", "changes_requested"].includes(status) && <Button size="sm" className="bg-fuchsia-600 hover:bg-fuchsia-500" onClick={() => submitMutation.mutate({ id: approval.id, expectedRevision: approval.revision })} disabled={submitMutation.isPending}><Send className="mr-1 h-4 w-4" />{isZh ? "提交KG确认" : "KG確認へ提出"}</Button>}
                          {status === "approved" && <Badge className="border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-emerald-200"><CheckCircle2 className="mr-1 h-4 w-4" />{isZh ? "条件已锁定，可按相同主播/账号/时间排班" : "条件ロック済み。同じライバー・アカウント・日時で予定登録可能"}</Badge>}
                          {status === "scheduled" && approval.scheduleLink && <Badge className="border-blue-400/40 bg-blue-500/15 px-3 py-2 text-blue-200">{isZh ? `已绑定排班 #${approval.scheduleLink.scheduleId}` : `予定 #${approval.scheduleLink.scheduleId} に連携済み`}</Badge>}
                        </div>
                        {status === "pending_approval" && context?.isApprover && (
                          <div className="w-full space-y-2 rounded-lg border border-amber-400/30 bg-amber-500/5 p-3 md:max-w-xl">
                            <Label className="text-xs text-amber-100">{isZh ? "确认意见（退回时必填）" : "確認コメント（差し戻し時は必須）"}</Label>
                            <Textarea value={reviewComments[approval.id] || ""} onChange={event => setReviewComments(current => ({ ...current, [approval.id]: event.target.value }))} className="min-h-20 bg-black/40" />
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={() => reviewMutation.mutate({ id: approval.id, expectedRevision: approval.revision, decision: "approve", comment: reviewComments[approval.id] })}><CheckCircle2 className="mr-1 h-4 w-4" />OK</Button>
                              <Button size="sm" variant="destructive" className="flex-1" onClick={() => reviewMutation.mutate({ id: approval.id, expectedRevision: approval.revision, decision: "request_changes", comment: reviewComments[approval.id] })}>{isZh ? "退回再谈" : "再交渉へ戻す"}</Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 border-t border-white/10 pt-3">
                        <div className="mb-2 text-xs font-semibold text-gray-400">{isZh ? "操作时间线" : "操作履歴"}</div>
                        <div className="space-y-1">{approval.events.slice(0, 12).map((event: any) => <div key={event.id} className="flex flex-wrap gap-x-2 text-[11px] text-gray-500"><span>{event.createdAt ? formatDateTime(event.createdAt) : "-"}</span><span className="text-gray-300">{event.actorName}</span><span>{event.eventType}</span>{event.comment && <span className="text-amber-200/80">{event.comment}</span>}</div>)}</div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto bg-slate-950 text-white">
          <DialogHeader><DialogTitle>{editing ? (isZh ? "编辑直播条件" : "配信条件を編集") : (isZh ? "新增直播条件" : "配信条件を追加")}</DialogTitle><DialogDescription>{brandName} · {isZh ? "所有字段确认后才可进入排班" : "全条件をKGが承認した後にのみ配信予定へ登録できます"}</DialogDescription></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2"><Label>{isZh ? "头部达人/主播" : "トップライバー"} *</Label><Select value={form.targetLiverId || undefined} onValueChange={value => { const liver = livers.find(item => Number(item.id) === Number(value)); setForm(current => ({ ...current, targetLiverId: value, targetLiverName: liver?.name || "", liveAccount: liver?.tiktokAccount || "" })); }}><SelectTrigger><SelectValue placeholder={isZh ? "请选择主播" : "ライバーを選択"} /></SelectTrigger><SelectContent>{livers.map(liver => <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>)}</SelectContent></Select><Input value={form.targetLiverName} readOnly className="bg-white/5" placeholder="KG" /></div>
            <div className="space-y-2"><Label>{isZh ? "直播账号" : "配信アカウント"} *</Label><Input value={form.liveAccount} onChange={event => setForm(current => ({ ...current, liveAccount: event.target.value }))} placeholder="TikTok account" /></div>
            <div className="space-y-2"><Label>1. {isZh ? "是否有助播到场" : "助播の現場参加"} *</Label><Select value={form.assistantOnsite} onValueChange={(value: AssistantOnsiteValue) => setForm(current => ({ ...current, assistantOnsite: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ASSISTANT_ONSITE_LABELS).map(([value, labels]) => <SelectItem key={value} value={value}>{labels[displayLanguage]}</SelectItem>)}</SelectContent></Select><Input value={form.assistantDetails} onChange={event => setForm(current => ({ ...current, assistantDetails: event.target.value }))} placeholder={isZh ? "到场人员、职责" : "担当者・役割"} /></div>
            <div className="space-y-2 md:col-span-2 lg:col-span-3"><Label>2. {isZh ? "整体机制" : "全体メカニズム"} *</Label><Textarea className="min-h-24" value={form.mechanismSummary} onChange={event => setForm(current => ({ ...current, mechanismSummary: event.target.value }))} placeholder={isZh ? "优惠、赠品、套装、时间限定、主播话术等" : "割引・特典・セット・時間限定・トーク条件など"} /></div>
            <div className="space-y-2"><Label>3. {isZh ? "佣金率 (%)" : "コミッション率 (%)"} *</Label><Input type="number" min="0" max="100" step="0.01" value={form.commissionRate} onChange={event => setForm(current => ({ ...current, commissionRate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>4. {isZh ? "坑位费 (JPY)" : "坑位費 (JPY)"} *</Label><Input type="number" min="0" step="1" value={form.slotFeeAmount} onChange={event => setForm(current => ({ ...current, slotFeeAmount: event.target.value }))} /></div>
            <div className="space-y-2"><Label>{isZh ? "保证类型" : "保証タイプ"}</Label><Select value={form.guaranteeType} onValueChange={(value: GuaranteeType) => setForm(current => ({ ...current, guaranteeType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(GUARANTEE_TYPE_LABELS).map(([value, labels]) => <SelectItem key={value} value={value}>{labels[displayLanguage]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>5. {isZh ? "直播开始" : "配信開始"} *</Label><Input type="datetime-local" value={form.scheduledStart} onChange={event => setForm(current => ({ ...current, scheduledStart: event.target.value }))} /></div>
            <div className="space-y-2"><Label>{isZh ? "直播结束" : "配信終了"} *</Label><Input type="datetime-local" value={form.scheduledEnd} onChange={event => setForm(current => ({ ...current, scheduledEnd: event.target.value }))} /></div>
            {form.guaranteeType !== "none" && <><div className="space-y-2"><Label>{form.guaranteeType === "roi" ? (isZh ? "保证ROI倍数" : "保証ROI倍率") : (isZh ? "保证值" : "保証値")} *</Label><Input type="number" min="0" step="0.01" value={form.guaranteeValue} onChange={event => setForm(current => ({ ...current, guaranteeValue: event.target.value }))} /></div><div className="space-y-2 md:col-span-2 lg:col-span-3"><Label>{isZh ? "怎么保、计算口径、未达成处理" : "保証方法・算定基準・未達時の対応"} *</Label><Textarea value={form.guaranteeTerms} onChange={event => setForm(current => ({ ...current, guaranteeTerms: event.target.value }))} /></div></>}
          </div>

          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-semibold"><Package className="h-4 w-4 text-pink-300" />{isZh ? "商品价格与单品机制" : "商品価格・商品別メカニズム"}</div><Button size="sm" variant="outline" onClick={() => setForm(current => ({ ...current, products: [...current.products, emptyProduct()] }))}><Plus className="mr-1 h-4 w-4" />{isZh ? "添加商品" : "商品追加"}</Button></div>
            <div className="space-y-4">{form.products.map((product, index) => <div key={index} className="rounded-lg border border-white/10 bg-black/30 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">#{index + 1}</span>{form.products.length > 1 && <Button size="icon" variant="ghost" onClick={() => setForm(current => ({ ...current, products: current.products.filter((_, productIndex) => productIndex !== index) }))}><Trash2 className="h-4 w-4 text-red-300" /></Button>}</div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1"><Label className="text-xs">{isZh ? "从品牌商品选择" : "ブランド商品から選択"}</Label><Select value={product.productId ? String(product.productId) : "manual"} onValueChange={value => selectProduct(index, value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">{isZh ? "手动输入" : "手入力"}</SelectItem>{products.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.productName}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">{isZh ? "商品名" : "商品名"} *</Label><Input value={product.productName} onChange={event => updateProduct(index, { productName: event.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{isZh ? "规格/套装" : "仕様・セット"} *</Label><Input value={product.specification} onChange={event => updateProduct(index, { specification: event.target.value })} placeholder={isZh ? "如：1袋56粒/6袋套装" : "例: 1袋56粒・6袋セット"} /></div>
              <div className="space-y-1"><Label className="text-xs">{isZh ? "库存" : "在庫"} *</Label><Input type="number" min="0" value={product.inventory} onChange={event => updateProduct(index, { inventory: event.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{isZh ? "原价 (JPY)" : "通常価格 (JPY)"} *</Label><Input type="number" min="0" value={product.originalPrice} onChange={event => updateProduct(index, { originalPrice: event.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{isZh ? "折扣后 (JPY)" : "割引後 (JPY)"} *</Label><Input type="number" min="0" value={product.discountedPrice} onChange={event => updateProduct(index, { discountedPrice: event.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">{isZh ? "单品佣金 (%)" : "商品コミッション (%)"}</Label><Input type="number" min="0" max="100" step="0.01" value={product.commissionRate} onChange={event => updateProduct(index, { commissionRate: event.target.value })} /></div>
              <div className="space-y-1 md:col-span-2 lg:col-span-1"><Label className="text-xs">{isZh ? "单品机制" : "商品別メカニズム"} *</Label><Textarea value={product.offerMechanism} onChange={event => updateProduct(index, { offerMechanism: event.target.value })} placeholder={isZh ? "优惠、赠品、组合" : "割引・特典・セット"} /></div>
            </div></div>)}</div>
          </div>
          <div className="space-y-2"><Label>{isZh ? "商务备注" : "商務メモ"}</Label><Textarea value={form.businessNotes} onChange={event => setForm(current => ({ ...current, businessNotes: event.target.value }))} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{isZh ? "取消" : "キャンセル"}</Button><Button className="bg-amber-400 text-black hover:bg-amber-300" onClick={save} disabled={createMutation.isPending || updateMutation.isPending}>{isZh ? "保存草稿" : "下書き保存"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
