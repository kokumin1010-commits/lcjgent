import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarDays, Check, ClipboardCopy, Clock3, FileCheck2, Loader2, Search, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import {
  GOOD_POINT_SUGGESTIONS,
  PROBLEM_SUGGESTIONS,
  type LivestreamDebriefContent,
} from "../../../shared/livestreamDebrief";

function tokyoDate(offsetDays = 0) {
  const value = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find(item => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDateTime(value: string | null | undefined, includeDate = true) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Tokyo",
    ...(includeDate ? { month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function emptyContent(brands: any[]): LivestreamDebriefContent {
  return {
    version: 1,
    brands: brands.map(brand => ({
      brandId: brand.brandId ?? null,
      brandName: brand.brandName || "",
      salesAmount: brand.salesAmount ?? null,
      orderCount: brand.orderCount ?? null,
      mainProducts: brand.mainProducts || "",
      performance: brand.performance || "",
    })),
    goodPoints: ["", "", ""],
    problems: ["", "", ""],
    salesDrivers: ["", "", ""],
    salesBarriers: ["", "", ""],
    reusableLessons: ["", "", ""],
    nextActions: ["", "", ""],
    assistance: { issue: "", owner: "", dueDate: "" },
  };
}

function withSlots(content: LivestreamDebriefContent): LivestreamDebriefContent {
  const slots = (values: string[]) => [...values, "", ""].slice(0, 3);
  return {
    ...content,
    brands: content.brands.map(brand => ({ ...brand })),
    goodPoints: slots(content.goodPoints),
    problems: slots(content.problems),
    salesDrivers: slots(content.salesDrivers),
    salesBarriers: slots(content.salesBarriers),
    reusableLessons: slots(content.reusableLessons),
    nextActions: slots(content.nextActions),
    assistance: { ...content.assistance },
  };
}

type ListKey = "goodPoints" | "problems" | "salesDrivers" | "salesBarriers" | "reusableLessons" | "nextActions";

function ShortListEditor({
  title,
  values,
  placeholder,
  suggestions,
  onChange,
}: {
  title: string;
  values: string[];
  placeholder: string;
  suggestions?: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const setValue = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };
  const applySuggestion = (suggestion: string) => {
    const existing = values.findIndex(value => value === suggestion);
    if (existing >= 0) return setValue(existing, "");
    const empty = values.findIndex(value => !value.trim());
    if (empty < 0) return toast.info("最多填写3项");
    setValue(empty, suggestion);
  };
  return (
    <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {suggestions?.length ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(suggestion => {
            const selected = values.includes(suggestion);
            return (
              <button
                key={suggestion}
                type="button"
                onClick={() => applySuggestion(suggestion)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${selected ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300"}`}
              >
                {selected ? <Check className="mr-1 inline h-3 w-3" /> : null}{suggestion}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="grid gap-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-400">{index + 1}</span>
            <Input value={value} maxLength={300} onChange={event => setValue(index, event.target.value)} placeholder={placeholder} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LivestreamDebriefConsole() {
  const { language } = useLanguage();
  const isZh = language === "zh";
  const [from, setFrom] = useState(() => tokyoDate(-13));
  const [to, setTo] = useState(() => tokyoDate());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "completed">("pending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<LivestreamDebriefContent | null>(null);
  const [initializedKey, setInitializedKey] = useState("");
  const utils = trpc.useUtils();
  const query = trpc.livestreamDebrief.list.useQuery({ from, to, search: search.trim() || undefined, status, limit: 100 });
  const summaryQuery = trpc.livestreamDebrief.summary.useQuery({ from, to });
  const detail = trpc.livestreamDebrief.get.useQuery(
    { livestreamId: selectedId || 1 },
    { enabled: selectedId != null },
  );
  const save = trpc.livestreamDebrief.save.useMutation({
    onSuccess: async data => {
      toast.success(isZh ? "复盘已保存，录入人已记录" : "振り返りを保存し、入力者を記録しました");
      setDraft(data.debrief?.content ? withSlots(data.debrief.content as LivestreamDebriefContent) : draft);
      setInitializedKey(`${data.id}:${data.debrief?.revision || 0}`);
      await Promise.all([query.refetch(), summaryQuery.refetch(), detail.refetch(), utils.livestreamDebrief.list.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  const row = detail.data?.row as any;
  const canEdit = Boolean(detail.data?.access.canEdit);
  useEffect(() => {
    if (!row || selectedId == null) return;
    const key = `${selectedId}:${row.debrief?.revision || 0}`;
    if (initializedKey === key) return;
    const next = row.debrief?.content
      ? withSlots(row.debrief.content as LivestreamDebriefContent)
      : emptyContent(row.brands || []);
    setDraft(next);
    setInitializedKey(key);
  }, [row, selectedId, initializedKey]);

  const rows = (query.data?.rows || []) as any[];
  const counts = summaryQuery.data || { pending: 0, completed: 0, total: 0 };

  const close = () => {
    if (save.isPending) return;
    setSelectedId(null);
    setDraft(null);
    setInitializedKey("");
  };

  const updateList = (key: ListKey, values: string[]) => setDraft(current => current ? { ...current, [key]: values } : current);
  const readyToSave = Boolean(canEdit && !row?.salesMetricConflict && draft?.nextActions.some(value => value.trim()) && (draft.goodPoints.some(value => value.trim()) || draft.problems.some(value => value.trim())));
  const saveDraft = () => {
    if (!selectedId || !draft || !readyToSave) return;
    save.mutate({ livestreamId: selectedId, expectedRevision: row?.debrief?.revision ?? null, content: draft });
  };
  const copyReview = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(isZh ? "已复制群发内容" : "グループ共有文をコピーしました");
    } catch {
      toast.error(isZh ? "复制失败，请在详情中手动选择文字" : "コピーできませんでした");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              <UserRoundCheck className="h-3.5 w-3.5" />{isZh ? "使用现有员工账号" : "既存スタッフアカウントで利用"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{isZh ? "中控达播复盘台" : "中控ライブ振り返り"}</h1>
            <p className="mt-2 text-sm text-slate-600">{isZh ? "选择直播场次，数据自动带入；每项只写一句，系统会生成群发格式并记录录入人。" : "配信を選ぶと数値を自動入力。短い項目だけで共有文を生成し、入力者も記録します。"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-auto">
            <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><div className="text-xs text-amber-700">{isZh ? "待复盘" : "未入力"}</div><div className="mt-1 text-2xl font-bold text-amber-900">{counts.pending}</div></CardContent></Card>
            <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-4"><div className="text-xs text-emerald-700">{isZh ? "已完成" : "入力済み"}</div><div className="mt-1 text-2xl font-bold text-emerald-900">{counts.completed}</div></CardContent></Card>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[160px_160px_minmax(220px,1fr)_180px]">
            <label className="space-y-1 text-sm"><span className="text-xs font-medium text-slate-600">{isZh ? "开始日期" : "開始日"}</span><Input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
            <label className="space-y-1 text-sm"><span className="text-xs font-medium text-slate-600">{isZh ? "结束日期" : "終了日"}</span><Input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
            <label className="space-y-1 text-sm"><span className="text-xs font-medium text-slate-600">{isZh ? "主播或场次编号" : "ライバー名・配信ID"}</span><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder={isZh ? "模糊搜索主播" : "ライバーを検索"} /></div></label>
            <label className="space-y-1 text-sm"><span className="text-xs font-medium text-slate-600">{isZh ? "状态" : "状態"}</span><Select value={status} onValueChange={value => setStatus(value as typeof status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">{isZh ? "待复盘" : "未入力"}</SelectItem><SelectItem value="completed">{isZh ? "已完成" : "入力済み"}</SelectItem><SelectItem value="all">{isZh ? "全部" : "すべて"}</SelectItem></SelectContent></Select></label>
          </CardContent>
        </Card>

        {query.isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{isZh ? "正在读取直播场次" : "配信を読み込み中"}</div>
        ) : query.error ? (
          <Alert variant="destructive"><AlertDescription>{query.error.message}</AlertDescription></Alert>
        ) : rows.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-16 text-center text-sm text-slate-500">{isZh ? "该条件下没有直播场次" : "該当する配信がありません"}</CardContent></Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {rows.map(item => (
              <Card key={item.id} className={`overflow-hidden border-l-4 shadow-sm ${item.debrief ? "border-l-emerald-500" : "border-l-amber-500"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><CardTitle className="truncate text-lg">{item.streamerName}</CardTitle><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDateTime(item.livestreamDate)}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDuration(item.durationMinutes)}</span></div></div>
                    <div className="flex flex-col items-end gap-2"><Badge className={item.debrief ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>{item.debrief ? (isZh ? "已复盘" : "入力済み") : (isZh ? "待复盘" : "未入力")}</Badge>{item.salesMetricConflict ? <Badge variant="destructive">{isZh ? "销售数据待确认" : "売上要確認"}</Badge> : null}</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center"><div><div className="text-[11px] text-slate-500">GMV</div><div className="mt-1 font-bold text-emerald-700">¥{Number(item.salesAmount || 0).toLocaleString()}</div></div><div><div className="text-[11px] text-slate-500">{isZh ? "订单" : "注文"}</div><div className="mt-1 font-bold">{item.orderCount ?? "—"}</div></div><div><div className="text-[11px] text-slate-500">{isZh ? "品牌" : "ブランド"}</div><div className="mt-1 font-bold">{item.brands.length}</div></div></div>
                  <div className="space-y-1 text-xs text-slate-600"><p><span className="font-medium text-slate-800">{isZh ? "直播记录：" : "配信記録："}</span>{item.sourceRecorder.name}</p>{item.debrief ? <><p><span className="font-medium text-slate-800">{isZh ? "复盘录入：" : "振り返り入力："}</span>{item.debrief.createdByName} · {formatDateTime(item.debrief.createdAt)}</p>{item.debrief.revision > 1 ? <p><span className="font-medium text-slate-800">{isZh ? "最后更新：" : "最終更新："}</span>{item.debrief.updatedByName} · {formatDateTime(item.debrief.updatedAt)}</p> : null}</> : null}</div>
                  <div className="flex flex-wrap gap-2">{item.brands.slice(0, 4).map((brand: any) => <Badge key={`${item.id}-${brand.brandId}`} variant="outline">{brand.brandName}</Badge>)}</div>
                  <div className="flex justify-end gap-2">{item.debrief?.reviewText ? <Button variant="outline" size="sm" onClick={() => copyReview(item.debrief.reviewText)}><ClipboardCopy className="mr-1.5 h-4 w-4" />{isZh ? "复制群发内容" : "共有文をコピー"}</Button> : null}<Button size="sm" onClick={() => { setSelectedId(item.id); setInitializedKey(""); }}><FileCheck2 className="mr-1.5 h-4 w-4" />{item.debrief ? (isZh ? "查看/修改" : "確認・修正") : (isZh ? "填写复盘" : "振り返り入力")}</Button></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={selectedId != null} onOpenChange={open => !open && close()}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 border-b bg-white px-5 py-4 sm:px-6">
            <DialogTitle>{isZh ? "今日达播复盘" : "本日のライブ振り返り"}</DialogTitle>
            <DialogDescription>{isZh ? "数字已从直播记录自动带入；主观内容每项只写一句。" : "数値は配信記録から自動反映。各項目は一文だけでOKです。"}</DialogDescription>
          </DialogHeader>
          {detail.isLoading || !row || !draft ? (
            <div className="flex items-center justify-center py-24 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{isZh ? "正在准备复盘" : "準備中"}</div>
          ) : (
            <div className="space-y-5 bg-slate-50/70 p-4 sm:p-6">
              <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs text-slate-400">#{row.id} · {formatDateTime(row.livestreamDate)}</div><h2 className="mt-1 text-xl font-bold">{row.streamerName}</h2><p className="mt-2 text-xs text-slate-300">{isZh ? "直播记录：" : "配信記録："}{row.sourceRecorder.name}</p></div><div className="grid grid-cols-3 gap-4 text-center"><div><div className="text-[11px] text-slate-400">GMV</div><div className="font-bold text-emerald-400">¥{Number(row.salesAmount || 0).toLocaleString()}</div></div><div><div className="text-[11px] text-slate-400">{isZh ? "订单" : "注文"}</div><div className="font-bold">{row.orderCount ?? "—"}</div></div><div><div className="text-[11px] text-slate-400">{isZh ? "时长" : "時間"}</div><div className="font-bold">{formatDuration(row.durationMinutes)}</div></div></div></div></section>

              {!canEdit ? <Alert><AlertDescription>{isZh ? "当前账号为只读权限，可以查看复盘和录入人，但不能修改。" : "現在のアカウントは閲覧専用です。入力者は確認できますが編集できません。"}</AlertDescription></Alert> : null}
              {row.salesMetricConflict ? <Alert variant="destructive"><AlertDescription>{isZh ? "该场直播存在多个不一致的GMV来源。请先在直播记录中确认销售数据，再保存复盘。" : "この配信には一致しないGMV情報があります。配信記録で売上を確認してから保存してください。"}</AlertDescription></Alert> : null}
              <fieldset disabled={!canEdit} className="space-y-5 disabled:cursor-not-allowed">
              <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm"><div><h3 className="font-semibold text-slate-900">1. {isZh ? "各品牌销售情况" : "ブランド別実績"}</h3><p className="mt-1 text-xs text-slate-500">{isZh ? "品牌和已有数字自动带入，只补充主推产品与表现。" : "ブランドと数値は自動入力。主力商品と所感だけ追記します。"}</p></div>{draft.brands.map((brand, index) => <div key={`${brand.brandId}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2"><div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2"><div className="font-medium">{brand.brandName}</div><div className="text-xs text-slate-500">{brand.salesAmount == null ? (isZh ? "销售额待分配" : "売上配分待ち") : `¥${Number(brand.salesAmount).toLocaleString()}`} · {brand.orderCount ?? "—"}{isZh ? "单" : "件"}</div></div><label className="space-y-1"><Label>{isZh ? "主推产品" : "主力商品"}</Label><Input value={brand.mainProducts} maxLength={500} onChange={event => setDraft(current => current ? { ...current, brands: current.brands.map((item, itemIndex) => itemIndex === index ? { ...item, mainProducts: event.target.value } : item) } : current)} placeholder={isZh ? "例如：卸妆套组" : "例：クレンジングセット"} /></label><label className="space-y-1"><Label>{isZh ? "表现情况" : "結果メモ"}</Label><Input value={brand.performance} maxLength={500} onChange={event => setDraft(current => current ? { ...current, brands: current.brands.map((item, itemIndex) => itemIndex === index ? { ...item, performance: event.target.value } : item) } : current)} placeholder={isZh ? "一句话说明为什么卖得好/不好" : "売れた・売れなかった理由を一文で"} /></label></div>)}</section>

              <div className="grid gap-4 lg:grid-cols-2">
                <ShortListEditor title={`2. ${isZh ? "做得好的地方" : "良かった点"}`} values={draft.goodPoints} suggestions={GOOD_POINT_SUGGESTIONS} onChange={values => updateList("goodPoints", values)} placeholder={isZh ? "一个动作或话术" : "具体的な行動・トーク"} />
                <ShortListEditor title={`3. ${isZh ? "现场问题" : "現場の課題"}`} values={draft.problems} suggestions={PROBLEM_SUGGESTIONS} onChange={values => updateList("problems", values)} placeholder={isZh ? "一个具体问题" : "具体的な課題"} />
                <ShortListEditor title={`4. ${isZh ? "促进销售额的因素" : "売上を伸ばした要因"}`} values={draft.salesDrivers} onChange={values => updateList("salesDrivers", values)} placeholder={isZh ? "产品、时段、优惠或话术" : "商品・時間帯・施策・トーク"} />
                <ShortListEditor title={`5. ${isZh ? "影响销售额的因素" : "売上を妨げた要因"}`} values={draft.salesBarriers} onChange={values => updateList("salesBarriers", values)} placeholder={isZh ? "价格、流量、库存或配合" : "価格・流入・在庫・連携"} />
                <ShortListEditor title={`6. ${isZh ? "值得复制的方法" : "次回も再現すること"}`} values={draft.reusableLessons} onChange={values => updateList("reusableLessons", values)} placeholder={isZh ? "下次可以直接复用的方法" : "そのまま再利用できる方法"} />
                <ShortListEditor title={`7. ${isZh ? "下一场具体改善" : "次回の具体的改善"}`} values={draft.nextActions} onChange={values => updateList("nextActions", values)} placeholder={isZh ? "写清楚怎么改（至少1项）" : "何をどう変えるか（1項目以上）"} />
              </div>

              <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm"><h3 className="font-semibold text-slate-900">8. {isZh ? "需要其他部门协助" : "他部署への依頼"}</h3><Input value={draft.assistance.issue} maxLength={500} onChange={event => setDraft(current => current ? { ...current, assistance: { ...current.assistance, issue: event.target.value } } : current)} placeholder={isZh ? "没有则留空；有问题只写一句" : "なければ空欄。ある場合は一文で"} />{draft.assistance.issue.trim() ? <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><Label>{isZh ? "负责人" : "担当者"}</Label><Input value={draft.assistance.owner} maxLength={120} onChange={event => setDraft(current => current ? { ...current, assistance: { ...current.assistance, owner: event.target.value } } : current)} /></label><label className="space-y-1"><Label>{isZh ? "完成时间" : "完了期限"}</Label><Input type="date" value={draft.assistance.dueDate} onChange={event => setDraft(current => current ? { ...current, assistance: { ...current.assistance, dueDate: event.target.value } } : current)} /></label></div> : null}</section>
              </fieldset>

              {row.debrief ? <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800"><div className="font-semibold">{isZh ? "复盘录入记录" : "振り返り入力履歴"}</div><div className="mt-2 space-y-1">{row.events.map((event: any) => <p key={event.revision}>v{event.revision} · {event.recordedByName} · {formatDateTime(event.recordedAt)}</p>)}</div></section> : null}
            </div>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-white px-5 py-4 sm:px-6"><div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">{isZh ? "必填：做得好或问题至少1项；下一场改善至少1项。" : "必須：良かった点/課題を1件以上、次回改善を1件以上。"}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={close} disabled={save.isPending}>{isZh ? "关闭" : "閉じる"}</Button>{row?.debrief?.reviewText ? <Button variant="outline" onClick={() => copyReview(row.debrief.reviewText)}><ClipboardCopy className="mr-1.5 h-4 w-4" />{isZh ? "复制" : "コピー"}</Button> : null}<Button onClick={saveDraft} disabled={!readyToSave || save.isPending}>{save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-1.5 h-4 w-4" />}{isZh ? "保存复盘" : "保存"}</Button></div></div></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
