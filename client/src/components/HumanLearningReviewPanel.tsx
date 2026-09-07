import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Brain, CheckCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

type EvidenceKey = "order_number" | "total_amount" | "delivery_status" | "platform" | "duplicate_conflict" | "image_authenticity" | "other";
type RejectionCategory = "blurry_image" | "missing_order_number" | "missing_amount" | "not_delivered" | "duplicate" | "wrong_store" | "suspicious" | "incomplete_info" | "not_order_detail" | "not_tiktok_shop" | "partial_screenshot" | "other";

type ReviewForm = {
  humanReason: string;
  evidenceKeys: EvidenceKey[];
  rejectionCategory: RejectionCategory | "";
  correctedOrderNumber: string;
  correctedAmount: string;
  correctedStoreName: string;
};

const EVIDENCE_OPTIONS: Array<{ value: EvidenceKey; zh: string; ja: string }> = [
  { value: "order_number", zh: "订单号", ja: "注文番号" },
  { value: "total_amount", zh: "金额", ja: "金額" },
  { value: "delivery_status", zh: "配送状态", ja: "配達状態" },
  { value: "platform", zh: "平台", ja: "プラットフォーム" },
  { value: "duplicate_conflict", zh: "重复冲突", ja: "重複競合" },
  { value: "image_authenticity", zh: "图片真实性", ja: "画像の真正性" },
  { value: "other", zh: "其他证据", ja: "その他の証拠" },
];

const REJECTION_OPTIONS: Array<{ value: RejectionCategory; zh: string; ja: string }> = [
  { value: "blurry_image", zh: "图片模糊", ja: "画像が不鮮明" },
  { value: "missing_order_number", zh: "缺少订单号", ja: "注文番号なし" },
  { value: "missing_amount", zh: "缺少金额", ja: "金額なし" },
  { value: "not_delivered", zh: "未确认已送达", ja: "配達済み未確認" },
  { value: "duplicate", zh: "重复订单", ja: "重複注文" },
  { value: "wrong_store", zh: "店铺不符", ja: "対象外店舗" },
  { value: "suspicious", zh: "证据可疑", ja: "証拠に不審点" },
  { value: "incomplete_info", zh: "信息不完整", ja: "情報不足" },
  { value: "not_order_detail", zh: "不是订单详情页", ja: "注文詳細画面ではない" },
  { value: "not_tiktok_shop", zh: "不是TikTok Shop", ja: "TikTok Shopではない" },
  { value: "partial_screenshot", zh: "截图不完整", ja: "スクリーンショット不完全" },
  { value: "other", zh: "其他", ja: "その他" },
];

function asImageUrls(item: any): string[] {
  const urls: unknown[] = Array.isArray(item.receiptImageUrls) ? [...item.receiptImageUrls] : [];
  if (item.receiptImageUrl) urls.unshift(item.receiptImageUrl);
  const normalized: string[] = urls
    .map((value: unknown) => String(value || "").trim())
    .filter((value: string) => Boolean(value));
  return [...new Set<string>(normalized)];
}

function initialForm(item: any): ReviewForm {
  return {
    humanReason: "",
    evidenceKeys: [],
    rejectionCategory: "",
    correctedOrderNumber: String(item.currentOrderNumber || item.aiOrderNumber || ""),
    correctedAmount: item.currentTotalAmount || item.aiTotalAmount ? String(item.currentTotalAmount || item.aiTotalAmount) : "",
    correctedStoreName: String(item.currentStoreName || item.aiStoreName || ""),
  };
}

export function HumanLearningReviewPanel() {
  const { language } = useLanguage();
  const zh = language === "zh";
  const utils = trpc.useUtils();
  const [offset, setOffset] = useState(0);
  const [forms, setForms] = useState<Record<number, ReviewForm>>({});
  const limit = 20;
  const queue = trpc.aiReview.humanLearningReviewQueue.useQuery({ limit, offset });

  useEffect(() => {
    const items = queue.data?.items || [];
    setForms(previous => {
      const next = { ...previous };
      for (const item of items) {
        if (!next[item.logId]) next[item.logId] = initialForm(item);
      }
      return next;
    });
  }, [queue.data?.items]);

  const resolveMutation = trpc.aiReview.resolveHumanLearningReview.useMutation({
    onSuccess: async data => {
      toast.success(data.alreadyProcessed
        ? (zh ? "该订单已由其他管理员处理" : "この注文は既に処理されています")
        : (zh ? "人工审核完成，已从暂挂和学习队列移除" : "人工審査が完了し、保留・学習キューから除外されました"));
      await Promise.all([
        utils.aiReview.humanLearningReviewQueue.invalidate(),
        utils.aiReview.getLogs.invalidate(),
        utils.aiReview.learningStats.invalidate(),
        utils.point.adminGetLineReceipts.invalidate(),
        utils.point.adminGetLineStatistics.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const copy = useMemo(() => zh ? {
    title: "学习审核",
    subtitle: "这里只显示AI无法独立判断的暂挂订单。人工决定后会移出暂挂，并把审核方法保存为疑难学习案例。",
    empty: "目前没有需要人工学习审核的暂挂订单。",
    pending: "待人工学习审核",
    aiProblem: "AI的问题点",
    aiKnown: "AI/当前已知信息",
    evidence: "人工判断依据（至少选择一项）",
    reason: "人工最终理由（必填）",
    reasonPlaceholder: "请写明为什么通过或拒绝，以及你查看了哪些证据。",
    corrections: "人工修正（需要时填写）",
    orderNumber: "订单号",
    amount: "金额（日元）",
    store: "店铺",
    rejectCategory: "拒绝类别（拒绝时必填）",
    choose: "请选择",
    approve: "通过并学习",
    reject: "拒绝并学习",
    confirmApprove: "确认通过该暂挂订单？通过后将发放积分并从暂挂队列移除。",
    confirmReject: "确认拒绝该暂挂订单？拒绝后将从暂挂队列移除。",
    image: "查看原图",
    ruleset: "学习流程版本",
  } : {
    title: "学習審査",
    subtitle: "AIが独立判断できなかった保留注文だけを表示します。人間の決定後は保留から外れ、審査方法が疑難学習例として保存されます。",
    empty: "現在、人工学習審査が必要な保留注文はありません。",
    pending: "人工学習審査待ち",
    aiProblem: "AIの問題点",
    aiKnown: "AI・現在の既知情報",
    evidence: "人間の判断根拠（1つ以上必須）",
    reason: "人間の最終理由（必須）",
    reasonPlaceholder: "承認・却下の理由と、確認した証拠を具体的に記入してください。",
    corrections: "人間による修正（必要な場合）",
    orderNumber: "注文番号",
    amount: "金額（円）",
    store: "店舗",
    rejectCategory: "却下カテゴリ（却下時必須）",
    choose: "選択してください",
    approve: "承認して学習",
    reject: "却下して学習",
    confirmApprove: "この保留注文を承認しますか？ポイント付与後、保留キューから除外されます。",
    confirmReject: "この保留注文を却下しますか？保留キューから除外されます。",
    image: "原画像を表示",
    ruleset: "学習フローバージョン",
  }, [zh]);

  const updateForm = (logId: number, patch: Partial<ReviewForm>) => {
    setForms(previous => ({
      ...previous,
      [logId]: { ...(previous[logId] || { humanReason: "", evidenceKeys: [], rejectionCategory: "", correctedOrderNumber: "", correctedAmount: "", correctedStoreName: "" }), ...patch },
    }));
  };

  const submit = (item: any, decision: "approved" | "rejected") => {
    const form = forms[item.logId] || initialForm(item);
    if (form.humanReason.trim().length < 5) {
      toast.error(zh ? "请填写至少5个字符的人工审核理由" : "人工審査理由を5文字以上入力してください");
      return;
    }
    if (form.evidenceKeys.length < 1) {
      toast.error(zh ? "请至少选择一项判断依据" : "判断根拠を1つ以上選択してください");
      return;
    }
    if (decision === "rejected" && !form.rejectionCategory) {
      toast.error(zh ? "拒绝时必须选择拒绝类别" : "却下時は却下カテゴリを選択してください");
      return;
    }
    if (!window.confirm(decision === "approved" ? copy.confirmApprove : copy.confirmReject)) return;

    const amount = form.correctedAmount.trim() ? Number(form.correctedAmount) : null;
    resolveMutation.mutate({
      logId: item.logId,
      decision,
      humanReason: form.humanReason,
      evidenceKeys: form.evidenceKeys,
      rejectionCategory: decision === "rejected" ? form.rejectionCategory as RejectionCategory : undefined,
      correctedOrderNumber: form.correctedOrderNumber.trim() || null,
      correctedAmount: Number.isFinite(amount) ? amount : null,
      correctedStoreName: form.correctedStoreName.trim() || null,
      sendNotifications: true,
    });
  };

  if (queue.isLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{zh ? "读取学习队列…" : "学習キューを読み込み中…"}</div>;
  }

  if (queue.error) {
    return <Card className="border-red-200"><CardContent className="py-8 text-center"><p className="text-red-700">{queue.error.message}</p><Button variant="outline" className="mt-4" onClick={() => queue.refetch()}><RefreshCw className="mr-2 h-4 w-4" />{zh ? "重新读取" : "再読み込み"}</Button></CardContent></Card>;
  }

  const items = queue.data?.items || [];
  return <div className="space-y-5">
    <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-indigo-900"><Brain className="h-5 w-5" />{copy.title}</CardTitle>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-indigo-800">{copy.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-600">{copy.pending}: {queue.data?.total || 0}</Badge>
            <Button variant="outline" size="sm" onClick={() => queue.refetch()}><RefreshCw className="mr-1 h-4 w-4" />{zh ? "刷新" : "更新"}</Button>
          </div>
        </div>
        <p className="text-xs text-indigo-700">{copy.ruleset}: {queue.data?.rulesetVersion}</p>
      </CardHeader>
    </Card>

    {items.length === 0 ? <Card><CardContent className="py-16 text-center text-muted-foreground"><CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-500" /><p>{copy.empty}</p></CardContent></Card> : items.map(item => {
      const form = forms[item.logId] || initialForm(item);
      const images = asImageUrls(item);
      const isPending = resolveMutation.isPending;
      return <Card key={item.logId} className="overflow-hidden border-amber-200">
        <CardHeader className="border-b bg-amber-50/70 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-amber-600" />#{item.receiptId} · {copy.pending}</CardTitle>
            <div className="flex gap-2"><Badge variant="outline">Pass {item.rulesetPass}</Badge><Badge className="bg-amber-600">{item.reasonCode || "MANUAL_REVIEW"}</Badge></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">{copy.aiProblem}</p>
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                {(item.problemPoints || []).map((point: string, index: number) => <p key={index}>• {point}</p>)}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{copy.orderNumber}</p><p className="break-all font-medium">{item.currentOrderNumber || item.aiOrderNumber || "—"}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{copy.amount}</p><p className="font-medium">{item.currentTotalAmount || item.aiTotalAmount ? `¥${Number(item.currentTotalAmount || item.aiTotalAmount).toLocaleString()}` : "—"}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{copy.store}</p><p className="font-medium">{item.currentStoreName || item.aiStoreName || "—"}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {images.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-lg border bg-slate-100">
                <img src={url} alt={`${copy.image} ${index + 1}`} className="aspect-[3/4] h-full w-full object-contain" loading="lazy" />
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"><ExternalLink className="mr-1 inline h-3 w-3" />{copy.image}</span>
              </a>)}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">{copy.evidence}</p>
            <div className="flex flex-wrap gap-2">
              {EVIDENCE_OPTIONS.map(option => {
                const checked = form.evidenceKeys.includes(option.value);
                return <label key={option.value} className={`cursor-pointer rounded-full border px-3 py-2 text-sm transition ${checked ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "bg-white"}`}>
                  <input type="checkbox" className="mr-2" checked={checked} onChange={() => updateForm(item.logId, { evidenceKeys: checked ? form.evidenceKeys.filter(value => value !== option.value) : [...form.evidenceKeys, option.value] })} />
                  {zh ? option.zh : option.ja}
                </label>;
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div><label className="mb-1 block text-sm font-medium">{copy.orderNumber}</label><Input value={form.correctedOrderNumber} onChange={event => updateForm(item.logId, { correctedOrderNumber: event.target.value })} /></div>
            <div><label className="mb-1 block text-sm font-medium">{copy.amount}</label><Input inputMode="numeric" value={form.correctedAmount} onChange={event => updateForm(item.logId, { correctedAmount: event.target.value.replace(/[^0-9]/g, "") })} /></div>
            <div><label className="mb-1 block text-sm font-medium">{copy.store}</label><Input value={form.correctedStoreName} onChange={event => updateForm(item.logId, { correctedStoreName: event.target.value })} /></div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <div><label className="mb-1 block text-sm font-medium">{copy.reason}</label><Textarea rows={4} placeholder={copy.reasonPlaceholder} value={form.humanReason} onChange={event => updateForm(item.logId, { humanReason: event.target.value })} /></div>
            <div><label className="mb-1 block text-sm font-medium">{copy.rejectCategory}</label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.rejectionCategory} onChange={event => updateForm(item.logId, { rejectionCategory: event.target.value as RejectionCategory | "" })}><option value="">{copy.choose}</option>{REJECTION_OPTIONS.map(option => <option key={option.value} value={option.value}>{zh ? option.zh : option.ja}</option>)}</select></div>
          </div>

          <div className="flex flex-col justify-end gap-3 border-t pt-4 sm:flex-row">
            <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={isPending || form.humanReason.trim().length < 5 || form.evidenceKeys.length < 1 || !form.rejectionCategory} onClick={() => submit(item, "rejected")}><XCircle className="mr-2 h-4 w-4" />{copy.reject}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={isPending || form.humanReason.trim().length < 5 || form.evidenceKeys.length < 1} onClick={() => submit(item, "approved")}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}{copy.approve}</Button>
          </div>
        </CardContent>
      </Card>;
    })}

    {(queue.data?.total || 0) > limit && <div className="flex items-center justify-center gap-3">
      <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}><ChevronLeft className="mr-1 h-4 w-4" />{zh ? "上一页" : "前へ"}</Button>
      <span className="text-sm text-muted-foreground">{Math.floor(offset / limit) + 1} / {Math.max(1, Math.ceil((queue.data?.total || 0) / limit))}</span>
      <Button variant="outline" disabled={offset + limit >= (queue.data?.total || 0)} onClick={() => setOffset(offset + limit)}>{zh ? "下一页" : "次へ"}<ChevronRight className="ml-1 h-4 w-4" /></Button>
    </div>}
  </div>;
}
