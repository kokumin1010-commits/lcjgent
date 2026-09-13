import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  Clock3,
  FileSearch,
  History,
  ImageIcon,
  ShieldCheck,
  Trophy,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ja-JP");
const dateTime = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

function statusBadge(status: string, reviewDecision?: string | null) {
  if (status === "reviewed" && reviewDecision === "pending") return <Badge className="bg-amber-100 text-amber-700">管理者確認待ち</Badge>;
  if (status === "reflected") return <Badge className="bg-emerald-100 text-emerald-700">ランキング反映済み</Badge>;
  if (reviewDecision === "rejected") return <Badge className="bg-rose-100 text-rose-700">差し戻し</Badge>;
  return <Badge className="bg-slate-100 text-slate-600">{status}</Badge>;
}

function safeDetail(value: unknown) {
  if (!value) return "—";
  if (typeof value === "string") {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
  }
  return JSON.stringify(value, null, 2);
}

function toJstInput(value: unknown) {
  if (!value) return "";
  const date = new Date(value as string);
  const jst = new Date(date.getTime() + 9 * 60 * 60_000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

function jstInputToMs(value: string) {
  return value ? Date.parse(`${value}:00+09:00`) : null;
}

export default function BrandDayDetail() {
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId || 0);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [reviewTarget, setReviewTarget] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"approve" | "force_approve" | "reject">("approve");
  const [reviewForm, setReviewForm] = useState({ startedAt: "", endedAt: "", streamMinutes: "", totalGmv: "", reason: "", products: [] as any[] });
  const event = trpc.brandDay.getEvent.useQuery({ eventId }, { enabled: eventId > 0 });
  const entries = trpc.brandDay.listEntries.useQuery({ eventId, search: search || undefined }, { enabled: eventId > 0 });
  const accounts = trpc.brandDay.listAccounts.useQuery({ eventId, search: search || undefined }, { enabled: eventId > 0 });
  const performances = trpc.brandDay.listPerformances.useQuery({ eventId, search: search || undefined, reviewOnly: false }, { enabled: eventId > 0 });
  const reviews = trpc.brandDay.listPerformances.useQuery({ eventId, reviewOnly: true }, { enabled: eventId > 0 });
  const leaderboard = trpc.brandDay.leaderboard.useQuery({ eventId }, { enabled: eventId > 0 });
  const audit = trpc.brandDay.listAudit.useQuery({ eventId, limit: 200 }, { enabled: eventId > 0 });
  const reviewMutation = trpc.brandDay.reviewPerformance.useMutation({
    onSuccess: async result => {
      toast.success(result.outcome === "rejected" ? "差し戻しました" : "成績を承認しました");
      setReviewTarget(null);
      await Promise.all([
        utils.brandDay.getEvent.invalidate({ eventId }),
        utils.brandDay.listPerformances.invalidate(),
        utils.brandDay.leaderboard.invalidate({ eventId }),
        utils.brandDay.listAudit.invalidate({ eventId, limit: 200 }),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const openReview = (row: any, decision: "approve" | "force_approve" | "reject") => {
    setReviewTarget(row);
    setReviewDecision(decision);
    setReviewForm({
      startedAt: toJstInput(row.startedAt),
      endedAt: toJstInput(row.endedAt),
      streamMinutes: String(row.streamMinutes || 0),
      totalGmv: String(row.totalGmv || 0),
      reason: row.reviewReason || "",
      products: (row.products || []).map((product: any) => ({ ...product })),
    });
  };

  const submitReview = () => {
    if (!reviewTarget) return;
    reviewMutation.mutate({
      eventId,
      performanceId: Number(reviewTarget.id),
      decision: reviewDecision,
      reason: reviewForm.reason || undefined,
      startedAt: jstInputToMs(reviewForm.startedAt),
      endedAt: jstInputToMs(reviewForm.endedAt),
      streamMinutes: Math.max(0, Number(reviewForm.streamMinutes || 0)),
      totalGmv: Math.max(0, Number(reviewForm.totalGmv || 0)),
      products: reviewForm.products.map(product => ({
        productName: String(product.productName || ""),
        gmv: Math.max(0, Number(product.gmv || 0)),
        isBrandProduct: Boolean(product.isBrandProduct),
        selected: Boolean(product.selected),
        confidenceBasisPoints: Number(product.confidenceBasisPoints || 0),
      })),
    });
  };

  if (!eventId) return <div className="p-8 text-sm text-rose-700">イベントIDが正しくありません。</div>;
  if (event.isLoading) return <div className="min-h-screen animate-pulse bg-slate-50 p-8"><div className="mx-auto h-60 max-w-7xl rounded-3xl bg-white" /></div>;
  if (event.error || !event.data) return <div className="p-8 text-sm text-rose-700">{event.error?.message || "ブランドデーが見つかりません"}</div>;
  const info = event.data;

  const stats = [
    { label: "申込", value: number.format(info.entryCount), icon: Users, tone: "text-sky-700 bg-sky-50" },
    { label: "出場者", value: number.format(info.accountCount), icon: UserRoundCheck, tone: "text-violet-700 bg-violet-50" },
    { label: "配信実績", value: number.format(info.performanceCount), icon: FileSearch, tone: "text-indigo-700 bg-indigo-50" },
    { label: "確認待ち", value: number.format(info.pendingReviewCount), icon: ShieldCheck, tone: "text-amber-700 bg-amber-50" },
    { label: "ブランドGMV", value: yen.format(info.reflectedBrandGmv), icon: Trophy, tone: "text-emerald-700 bg-emerald-50" },
    { label: "配信時間", value: `${Math.floor(info.reflectedMinutes / 60)}時間${info.reflectedMinutes % 60}分`, icon: Clock3, tone: "text-cyan-700 bg-cyan-50" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8" data-testid="brand-day-detail-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <Button variant="ghost" onClick={() => navigate("/master/brand-days")} className="gap-2 px-0 text-slate-600"><ArrowLeft className="h-4 w-4" /> ブランドデー一覧</Button>
        <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-xl">
          <CardContent className="relative p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.25),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(124,58,237,0.24),transparent_35%)]" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">{info.brandName}</p><h1 className="mt-3 text-2xl font-bold sm:text-4xl">{info.title}</h1><div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{dateTime.format(new Date(info.event_start_at))} 〜 {dateTime.format(new Date(info.event_end_at))} JST</span><Badge className="bg-white/10 text-white">{info.status}</Badge></div></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm"><p className="text-slate-400">slug</p><p className="mt-1 font-mono text-white">{info.slug}</p></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{stats.map(item => <Card key={item.label} className="border-0 shadow-sm"><CardContent className="p-4"><div className={`inline-flex rounded-xl p-2 ${item.tone}`}><item.icon className="h-4 w-4" /></div><p className="mt-3 text-xs text-slate-500">{item.label}</p><p className="mt-1 break-words text-lg font-bold text-slate-950">{item.value}</p></CardContent></Card>)}</div>

        <Card className="border-0 shadow-sm"><CardContent className="p-4"><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="氏名・TikTok IDで全データを検索" /></CardContent></Card>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-auto w-full justify-start overflow-x-auto bg-white p-1 shadow-sm">
            <TabsTrigger value="overview">概要</TabsTrigger><TabsTrigger value="entries">申込 {info.entryCount}</TabsTrigger><TabsTrigger value="accounts">出場者 {info.accountCount}</TabsTrigger><TabsTrigger value="performances">成績 {info.performanceCount}</TabsTrigger><TabsTrigger value="reviews">確認待ち {info.pendingReviewCount}</TabsTrigger><TabsTrigger value="ranking">ランキング</TabsTrigger><TabsTrigger value="audit">操作記録</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><div className="grid gap-4 lg:grid-cols-2"><Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">活動ルール</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-slate-600"><p>タイムゾーン：{info.timezone}</p><p>ランキング最低配信：{info.minimum_stream_minutes}分</p><p>AI画像解析：有効時間は自動反映、時間異常は管理者確認</p><p>旧サイト：{info.legacy_base_url || "—"}</p></CardContent></Card><Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">移行・運用状態</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-slate-600"><p>申込・出場者・成績・商品・画像・監査をeventIdで隔離します。</p><p>確認待ちは承認されるまでランキングに表示されません。</p><p>独立KGDAYサイトは切替完了まで回退用として保持します。</p></CardContent></Card></div></TabsContent>

          <TabsContent value="entries"><DataTable headers={["申込者", "TikTok", "LINE", "連絡先", "状態", "申込日時"]} rows={(entries.data || []).map(row => [row.registrationName, `${row.tiktokName}\n${row.tiktokId}`, row.lineId, `${row.email}\n${row.phone}`, row.status, dateTime.format(new Date(row.createdAt))])} empty="申込データはありません" /></TabsContent>
          <TabsContent value="accounts"><DataTable headers={["出場者", "申込者", "状態", "配信数", "ブランドGMV", "最終ログイン"]} rows={(accounts.data || []).map(row => [`${row.tiktokName}\n${row.tiktokId}`, `${row.registrationName || "—"}\n${row.email || ""}`, row.status, row.performanceCount, yen.format(row.reflectedBrandGmv), row.lastSignedInAt ? dateTime.format(new Date(row.lastSignedInAt)) : "—"])} empty="出場者アカウントはありません" /></TabsContent>
          <TabsContent value="performances"><PerformanceGrid rows={performances.data || []} /></TabsContent>
          <TabsContent value="reviews"><PerformanceGrid rows={reviews.data || []} reviewMode onReview={openReview} /></TabsContent>
          <TabsContent value="ranking"><div className="grid gap-4 lg:grid-cols-2"><Ranking title="ブランド商品売上ランキング" rows={leaderboard.data?.sales || []} value={row => yen.format(row.brandGmv)} /><Ranking title="配信時間ランキング" rows={leaderboard.data?.streaming || []} value={row => `${Math.floor(row.streamMinutes / 60)}時間${row.streamMinutes % 60}分`} /></div></TabsContent>
          <TabsContent value="audit"><div className="space-y-3">{(audit.data || []).map(row => <Card key={row.id} className="border-0 shadow-sm"><CardContent className="flex gap-3 p-4"><div className="rounded-xl bg-slate-100 p-2"><History className="h-4 w-4 text-slate-600" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{row.action}</p><span className="text-xs text-slate-400">{dateTime.format(new Date(row.createdAt))}</span></div><p className="mt-1 text-xs text-slate-500">{row.actorName || row.actorType} · {row.entityType} #{row.entityId || "—"}</p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">{safeDetail(row.detail)}</pre></div></CardContent></Card>)}{!audit.data?.length && <Empty text="操作記録はありません" />}</div></TabsContent>
        </Tabs>
      </div>

      <Dialog open={Boolean(reviewTarget)} onOpenChange={open => !open && setReviewTarget(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配信実績を確認</DialogTitle>
            <DialogDescription>原画像とAI結果を確認し、日時と数値を修正してから承認してください。強制承認と差し戻しには理由が必要です。</DialogDescription>
          </DialogHeader>
          {reviewTarget && <div className="space-y-5">
            {reviewTarget.screenshotUrl && <img src={reviewTarget.screenshotUrl} alt="TikTok LIVE 原画像" className="aspect-video w-full rounded-xl bg-slate-950 object-contain" />}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>開始日時（JST）</Label><Input type="datetime-local" value={reviewForm.startedAt} onChange={event => setReviewForm(current => ({ ...current, startedAt: event.target.value }))} /></div>
              <div className="space-y-2"><Label>終了日時（JST）</Label><Input type="datetime-local" value={reviewForm.endedAt} onChange={event => setReviewForm(current => ({ ...current, endedAt: event.target.value }))} /></div>
              <div className="space-y-2"><Label>配信時間（分）</Label><Input type="number" min="0" value={reviewForm.streamMinutes} onChange={event => setReviewForm(current => ({ ...current, streamMinutes: event.target.value }))} /></div>
              <div className="space-y-2"><Label>総GMV</Label><Input type="number" min="0" value={reviewForm.totalGmv} onChange={event => setReviewForm(current => ({ ...current, totalGmv: event.target.value }))} /></div>
            </div>
            <div className="space-y-3">
              <Label>商品明細</Label>
              {reviewForm.products.map((product, index) => <div key={`${product.id || "new"}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_140px_auto] sm:items-center"><Input value={product.productName} onChange={event => setReviewForm(current => ({ ...current, products: current.products.map((row, rowIndex) => rowIndex === index ? { ...row, productName: event.target.value } : row) }))} /><Input type="number" min="0" value={product.gmv} onChange={event => setReviewForm(current => ({ ...current, products: current.products.map((row, rowIndex) => rowIndex === index ? { ...row, gmv: event.target.value } : row) }))} /><label className="flex items-center gap-2 text-xs font-medium text-slate-600"><Checkbox checked={Boolean(product.isBrandProduct)} onCheckedChange={checked => setReviewForm(current => ({ ...current, products: current.products.map((row, rowIndex) => rowIndex === index ? { ...row, isBrandProduct: checked === true, selected: checked === true } : row) }))} /> ブランド商品</label></div>)}
            </div>
            <div className="space-y-2"><Label>管理者理由</Label><Textarea value={reviewForm.reason} onChange={event => setReviewForm(current => ({ ...current, reason: event.target.value }))} placeholder="強制承認または差し戻しの理由を入力" /></div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant={reviewDecision === "reject" ? "destructive" : "outline"} onClick={() => setReviewDecision("reject")}>差し戻し</Button>
              <Button variant={reviewDecision === "approve" ? "default" : "outline"} onClick={() => setReviewDecision("approve")}>修正して承認</Button>
              <Button variant={reviewDecision === "force_approve" ? "default" : "outline"} className={reviewDecision === "force_approve" ? "bg-amber-600 hover:bg-amber-700" : ""} onClick={() => setReviewDecision("force_approve")}>理由付き強制承認</Button>
            </div>
            <Button onClick={submitReview} disabled={reviewMutation.isPending} className="w-full">{reviewMutation.isPending ? "処理中…" : reviewDecision === "reject" ? "差し戻しを確定" : "承認を確定"}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: Array<Array<React.ReactNode>>; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return <Card className="overflow-hidden border-0 shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{headers.map(header => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index} className="bg-white">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-pre-line px-4 py-4 align-top text-slate-700">{cell}</td>)}</tr>)}</tbody></table></div></Card>;
}

function PerformanceGrid({ rows, reviewMode = false, onReview }: { rows: any[]; reviewMode?: boolean; onReview?: (row: any, decision: "approve" | "force_approve" | "reject") => void }) {
  if (!rows.length) return <Empty text={reviewMode ? "管理者確認待ちの成績はありません" : "成績データはありません"} />;
  return <div className="grid gap-4 xl:grid-cols-2">{rows.map(row => <Card key={row.id} className={`overflow-hidden border-0 shadow-sm ${reviewMode ? "ring-1 ring-amber-200" : ""}`}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">DAY {row.dayNumber} · 配信 #{row.sessionNumber}</p><CardTitle className="mt-1 text-base">{row.tiktokName} <span className="font-normal text-slate-400">{row.tiktokId}</span></CardTitle></div>{statusBadge(row.status, row.reviewDecision)}</div></CardHeader><CardContent className="space-y-4">{row.screenshotUrl ? <img src={row.screenshotUrl} alt={`${row.tiktokName} 配信大画面`} className="aspect-video w-full rounded-xl bg-slate-950 object-contain" /> : <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ImageIcon className="h-8 w-8" /></div>}<div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center"><div><p className="font-bold text-slate-950">{row.streamMinutes}分</p><p className="text-[11px] text-slate-500">有効配信</p></div><div><p className="font-bold text-slate-950">{yen.format(row.totalGmv)}</p><p className="text-[11px] text-slate-500">総GMV</p></div><div><p className="font-bold text-emerald-700">{yen.format(row.brandGmv)}</p><p className="text-[11px] text-slate-500">ブランドGMV</p></div></div><div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><Bot className="h-4 w-4" />{row.aiModel || row.aiStatus} · 商品{row.productCount}件</div>{row.reviewReason && <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">{row.reviewReason}</p>}{reviewMode && onReview && <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3"><Button size="sm" variant="outline" onClick={() => onReview(row, "reject")}>差し戻し</Button><Button size="sm" onClick={() => onReview(row, "approve")}>修正して承認</Button><Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => onReview(row, "force_approve")}>強制承認</Button></div>}</CardContent></Card>)}</div>;
}

function Ranking({ title, rows, value }: { title: string; rows: any[]; value: (row: any) => string }) {
  return <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-2">{rows.map((row, index) => <div key={row.creatorAccountId} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${index < 3 ? "bg-amber-100 text-amber-700" : "bg-white text-slate-500"}`}>{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{row.tiktokName}</p><p className="text-xs text-slate-500">{row.tiktokId} · {row.performanceCount}配信</p></div><p className="font-bold text-slate-950">{value(row)}</p></div>)}{!rows.length && <Empty text="ランキングデータはありません" />}</CardContent></Card>;
}

function Empty({ text }: { text: string }) {
  return <Card className="border-dashed border-slate-300 bg-white"><CardContent className="flex flex-col items-center py-14 text-center"><FileSearch className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">{text}</p></CardContent></Card>;
}
