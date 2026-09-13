import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  CalendarDays,
  ChevronRight,
  Clock3,
  Database,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const statusMeta: Record<string, { label: string; className: string }> = {
  draft: { label: "下書き", className: "bg-slate-100 text-slate-700" },
  registration: { label: "申込受付中", className: "bg-sky-100 text-sky-700" },
  active: { label: "開催中", className: "bg-emerald-100 text-emerald-700" },
  closed: { label: "終了", className: "bg-amber-100 text-amber-700" },
  archived: { label: "アーカイブ", className: "bg-zinc-100 text-zinc-600" },
};

const number = new Intl.NumberFormat("ja-JP");
const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });

function formatDateRange(start: unknown, end: unknown) {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(start as string))} 〜 ${formatter.format(new Date(end as string))}`;
}

function parseJstLocal(value: string) {
  const timestamp = Date.parse(`${value}:00+09:00`);
  if (!Number.isFinite(timestamp)) throw new Error("日時を入力してください");
  return timestamp;
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export default function BrandDayList() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationManifest, setMigrationManifest] = useState<any | null>(null);
  const [migrationSha, setMigrationSha] = useState("");
  const [migrationPreview, setMigrationPreview] = useState<any | null>(null);
  const [form, setForm] = useState({
    brandId: "",
    title: "",
    shortName: "",
    slug: "",
    startAt: "",
    endAt: "",
    status: "draft",
  });

  const listInput = useMemo(() => ({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status as "draft" | "registration" | "active" | "closed" | "archived",
  }), [search, status]);
  const events = trpc.brandDay.listEvents.useQuery(listInput);
  const brands = trpc.brandDay.listBrands.useQuery();
  const createEvent = trpc.brandDay.createEvent.useMutation({
    onSuccess: async result => {
      toast.success("ブランドデーを作成しました");
      setOpen(false);
      await utils.brandDay.listEvents.invalidate();
      navigate(`/master/brand-days/${result.eventId}`);
    },
    onError: error => toast.error(error.message),
  });
  const previewMigration = trpc.brandDay.migration.preview.useMutation({
    onSuccess: result => setMigrationPreview(result),
    onError: error => { setMigrationPreview(null); toast.error(error.message); },
  });
  const runMigration = trpc.brandDay.migration.run.useMutation({
    onSuccess: async result => {
      toast.success(result.idempotent ? "既存の移行結果を確認しました" : "KGDAYの移行が完了しました");
      setMigrationOpen(false);
      await utils.brandDay.listEvents.invalidate();
      navigate(`/master/brand-days/${result.eventId}`);
    },
    onError: error => toast.error(error.message),
  });

  const loadMigrationFile = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("移行ファイルは5MB以下にしてください");
      const raw = await file.text();
      const manifest = JSON.parse(raw);
      const manifestSha256 = await sha256Text(raw);
      setMigrationManifest(manifest);
      setMigrationSha(manifestSha256);
      setMigrationPreview(null);
      previewMigration.mutate({ manifest, manifestSha256 });
    } catch (error) {
      setMigrationManifest(null);
      setMigrationPreview(null);
      toast.error(error instanceof Error ? error.message : "移行ファイルを読み込めませんでした");
    }
  };

  const rows = events.data || [];
  const totals = rows.reduce((acc, event) => ({
    entries: acc.entries + event.entryCount,
    performances: acc.performances + event.performanceCount,
    reviews: acc.reviews + event.pendingReviewCount,
    gmv: acc.gmv + event.reflectedBrandGmv,
  }), { entries: 0, performances: 0, reviews: 0, gmv: 0 });

  const submit = () => {
    if (!form.title || !form.shortName || !form.slug || !form.startAt || !form.endAt) {
      toast.error("必須項目を入力してください");
      return;
    }
    createEvent.mutate({
      brandId: form.brandId ? Number(form.brandId) : null,
      title: form.title,
      shortName: form.shortName,
      slug: form.slug,
      eventStartAt: parseJstLocal(form.startAt),
      eventEndAt: parseJstLocal(form.endAt),
      timezone: "Asia/Tokyo",
      minimumStreamMinutes: 60,
      status: form.status as "draft" | "registration" | "active" | "closed" | "archived",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8" data-testid="brand-day-list-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <Sparkles className="h-4 w-4" /> 店舗管理 / Brand Day
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">ブランドデー一覧</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              各ブランドの申込、出場者、ライブ実績、AI画像解析、管理者確認、ランキングと監査記録を一元管理します。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMigrationOpen(true)} className="gap-2"><Database className="h-4 w-4" /> KGDAYデータ移行</Button>
            <Button onClick={() => setOpen(true)} className="gap-2 bg-slate-950 text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> 新しいブランドデー</Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "申込", value: number.format(totals.entries), icon: Users, tone: "text-sky-700 bg-sky-50" },
            { label: "配信実績", value: number.format(totals.performances), icon: Activity, tone: "text-violet-700 bg-violet-50" },
            { label: "確認待ち", value: number.format(totals.reviews), icon: ShieldCheck, tone: "text-amber-700 bg-amber-50" },
            { label: "ブランドGMV", value: yen.format(totals.gmv), icon: Trophy, tone: "text-emerald-700 bg-emerald-50" },
          ].map(item => (
            <Card key={item.label} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-2xl p-3 ${item.tone}`}><item.icon className="h-5 w-5" /></div>
                <div><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-1 text-xl font-bold text-slate-950">{item.value}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="ブランド名・イベント名・slugで検索" className="pl-9" />
            </div>
            <select value={status} onChange={event => setStatus(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="all">すべての状態</option>
              {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </CardContent>
        </Card>

        {events.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map(key => <div key={key} className="h-64 animate-pulse rounded-2xl bg-white shadow-sm" />)}</div>
        ) : events.error ? (
          <Card className="border-red-200 bg-red-50"><CardContent className="p-6 text-sm text-red-700">{events.error.message}</CardContent></Card>
        ) : rows.length === 0 ? (
          <Card className="border-dashed border-slate-300 bg-white">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <CalendarDays className="h-10 w-10 text-slate-300" />
              <h2 className="mt-4 font-semibold text-slate-900">ブランドデーはまだありません</h2>
              <p className="mt-2 text-sm text-slate-500">KGDAYの移行後、ここからすべての情報を管理できます。</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(event => {
              const meta = statusMeta[event.status] || statusMeta.draft;
              return (
                <button key={event.id} type="button" onClick={() => navigate(`/master/brand-days/${event.id}`)} className="group text-left">
                  <Card className="h-full border-0 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{event.brandName}</p>
                          <CardTitle className="mt-2 truncate text-lg text-slate-950">{event.title}</CardTitle>
                        </div>
                        <Badge className={meta.className}>{meta.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-2 text-xs leading-5 text-slate-500"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />{formatDateRange(event.eventStartAt, event.eventEndAt)} JST</div>
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                        <div><p className="text-lg font-bold text-slate-950">{event.entryCount}</p><p className="text-[11px] text-slate-500">申込</p></div>
                        <div><p className="text-lg font-bold text-slate-950">{event.performanceCount}</p><p className="text-[11px] text-slate-500">配信</p></div>
                        <div><p className={`text-lg font-bold ${event.pendingReviewCount ? "text-amber-600" : "text-slate-950"}`}>{event.pendingReviewCount}</p><p className="text-[11px] text-slate-500">確認待ち</p></div>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-sm font-semibold text-emerald-700">{yen.format(event.reflectedBrandGmv)}</span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 group-hover:text-slate-950">管理画面 <ChevronRight className="h-4 w-4" /></span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>新しいブランドデー</DialogTitle><DialogDescription>ブランドを選び、活動期間を日本時間で設定します。</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>ブランド</Label><select value={form.brandId} onChange={event => setForm(current => ({ ...current, brandId: event.target.value }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">ブランド未選択</option>{(brands.data || []).map(brand => <option key={brand.id} value={brand.id}>{brand.nameJa || brand.name}</option>)}</select></div>
            <div className="space-y-2 sm:col-span-2"><Label>イベント名</Label><Input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="KYOGOKU BRAND DAY 2026" /></div>
            <div className="space-y-2"><Label>略称</Label><Input value={form.shortName} onChange={event => setForm(current => ({ ...current, shortName: event.target.value }))} placeholder="KGDAY" /></div>
            <div className="space-y-2"><Label>slug</Label><Input value={form.slug} onChange={event => setForm(current => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="kgday-2026" /></div>
            <div className="space-y-2"><Label>開始（JST）</Label><Input type="datetime-local" value={form.startAt} onChange={event => setForm(current => ({ ...current, startAt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>終了（JST）</Label><Input type="datetime-local" value={form.endAt} onChange={event => setForm(current => ({ ...current, endAt: event.target.value }))} /></div>
            <div className="space-y-2"><Label>状態</Label><select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">{Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>キャンセル</Button><Button onClick={submit} disabled={createEvent.isPending}>{createEvent.isPending ? "作成中…" : "作成"}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={migrationOpen} onOpenChange={setMigrationOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>KGDAYデータをLCJへ移行</DialogTitle><DialogDescription>管理者専用です。ローカルの移行ファイルを事前検証し、原画像をLCJストレージへコピーしてから全件を取り込みます。ファイル内容は画面に表示しません。</DialogDescription></DialogHeader>
          <div className="space-y-4 py-3">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Database className="h-8 w-8 text-slate-400" /><span className="mt-3 font-semibold text-slate-900">KGDAY移行ファイルを選択</span><span className="mt-1 text-xs text-slate-500">JSON・最大5MB・内容はブラウザ内でのみ処理</span><Input type="file" accept="application/json,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) loadMigrationFile(file); event.target.value = ""; }} /></label>
            {previewMigration.isPending && <p className="rounded-xl bg-sky-50 p-4 text-sm text-sky-700">ハッシュと参照整合性を確認しています…</p>}
            {migrationPreview && <div className={`rounded-2xl border p-4 ${migrationPreview.valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" />{migrationPreview.valid ? "事前検証に合格しました" : "移行できない問題があります"}</div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">{Object.entries(migrationPreview.counts).map(([key, value]) => <div key={key} className="rounded-lg bg-white p-2"><p className="text-lg font-bold text-slate-950">{Number(value)}</p><p className="text-slate-500">{key}</p></div>)}</div>{!migrationPreview.valid && <p className="mt-3 text-xs text-red-700">画像URL不足 {migrationPreview.missingScreenshots.length} / アカウント参照不正 {migrationPreview.brokenAccounts.length} / 商品参照不正 {migrationPreview.brokenProducts.length}</p>}</div>}
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setMigrationOpen(false)}>キャンセル</Button><Button disabled={!migrationManifest || !migrationPreview?.valid || runMigration.isPending} onClick={() => runMigration.mutate({ manifest: migrationManifest, manifestSha256: migrationSha, brandId: null })}>{runMigration.isPending ? "画像コピー・移行中…" : "全件をLCJへ移行"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
