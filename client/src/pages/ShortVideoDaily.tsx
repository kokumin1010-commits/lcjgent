import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Heart,
  Link2,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Pencil,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import ShortVideoAccountDailySales from "./ShortVideoAccountDailySales";
import TikTokPublicMonitor from "@/components/TikTokPublicMonitor";
import {
  calculateShortVideoEngagementMetrics,
  getDefaultShortVideoReportDate,
  getTokyoToday,
} from "../../../shared/shortVideoDaily";

type Entry = {
  id: number;
  reportDate: string;
  accountId: number | null;
  accountName: string | null;
  videoUrl: string;
  producerStaffId: number;
  producerName: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  productClicks: number;
  notes: string | null;
  updatedAt: string | null;
};

type VideoDraft = {
  videoUrl: string;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  saves: string;
  productClicks: string;
  notes: string;
};

const emptyVideoDraft = (): VideoDraft => ({
  videoUrl: "",
  views: "0",
  likes: "0",
  comments: "0",
  shares: "0",
  saves: "0",
  productClicks: "0",
  notes: "",
});

const copy = {
  zh: {
    title: "短视频日报",
    subtitle: "视频互动次日快照与账号每日销售分区记录，避免订单和GMV重复归因",
    add: "填写视频快照",
    month: "月份",
    allProducer: "全部制作人",
    allAccount: "全部账号",
    allCurrency: "全部币种",
    search: "搜索链接、制作人、账号或备注",
    posts: "发布条数",
    activeDays: "填报天数",
    views: "播放量",
    likes: "点赞",
    comments: "评论",
    shares: "分享",
    saves: "收藏",
    clicks: "商品点击",
    orders: "成交订单",
    gmv: "月度GMV",
    engagementRate: "互动率",
    conversionRate: "点击率",
    videoSection: "视频互动次日快照",
    videoSectionNote: "这里只记录次日采集到的播放和互动；订单与GMV请填写上方账号每日销售。",
    daily: "视频每日汇总",
    producers: "视频制作人汇总",
    records: "视频互动明细",
    empty: "这个月还没有视频互动次日快照",
    dataDate: "数据日期",
    producer: "制作人",
    account: "发布账号",
    optionalAccount: "未指定账号",
    currency: "币种",
    videoLinks: "视频链接与次日互动快照",
    addVideo: "增加视频",
    save: "保存视频快照",
    cancel: "取消",
    edit: "编辑视频快照",
    delete: "删除",
    deleteConfirm: "确定删除这条视频快照吗？删除后仍保留审计记录。",
    url: "视频链接",
    notes: "备注",
    yesterdayHint:
      "默认选择东京时间的昨天；允许补录今天和过去日期，不能填写未来日期。",
    snapshotHint:
      "播放、点赞、评论等是第二天采集时的快照，会随时间变化；订单和GMV只在上方账号每日销售区填写。",
    noEdit: "当前账号只有查看权限",
    saved: "视频快照已保存",
    updated: "视频快照已更新",
    deleted: "视频快照已删除",
    day: "日期",
    actions: "操作",
    previous: "上一页",
    next: "下一页",
    count: "条",
  },
  ja: {
    title: "短動画日報",
    subtitle: "動画の翌日スナップショットとアカウント日次売上を分離し、注文・GMVの重複帰属を防ぎます",
    add: "動画スナップショットを入力",
    month: "月",
    allProducer: "全制作者",
    allAccount: "全アカウント",
    allCurrency: "全通貨",
    search: "URL・制作者・アカウント・メモを検索",
    posts: "投稿本数",
    activeDays: "入力日数",
    views: "再生数",
    likes: "いいね",
    comments: "コメント",
    shares: "シェア",
    saves: "保存",
    clicks: "商品クリック",
    orders: "注文件数",
    gmv: "月間GMV",
    engagementRate: "エンゲージ率",
    conversionRate: "クリック率",
    videoSection: "動画エンゲージ翌日スナップショット",
    videoSectionNote: "ここでは翌日に取得した再生・反応だけを記録します。注文とGMVは上のアカウント日次売上に入力してください。",
    daily: "動画日別集計",
    producers: "動画制作者別集計",
    records: "動画エンゲージ明細",
    empty: "この月の動画翌日スナップショットはまだありません",
    dataDate: "データ日",
    producer: "制作者",
    account: "投稿アカウント",
    optionalAccount: "アカウント未指定",
    currency: "通貨",
    videoLinks: "動画リンクと翌日エンゲージスナップショット",
    addVideo: "動画を追加",
    save: "動画スナップショットを保存",
    cancel: "キャンセル",
    edit: "動画スナップショットを編集",
    delete: "削除",
    deleteConfirm: "この動画スナップショットを削除しますか？監査履歴は保持されます。",
    url: "動画URL",
    notes: "メモ",
    yesterdayHint:
      "東京時間の昨日が初期値です。今日以前は補完できますが未来日は登録できません。",
    snapshotHint:
      "再生・いいね・コメント等は翌日に取得したスナップショットで、その後も変動します。注文とGMVは上のアカウント日次売上だけに入力します。",
    noEdit: "現在のアカウントは閲覧権限のみです",
    saved: "動画スナップショットを保存しました",
    updated: "動画スナップショットを更新しました",
    deleted: "動画スナップショットを削除しました",
    day: "日付",
    actions: "操作",
    previous: "前へ",
    next: "次へ",
    count: "件",
  },
};

function numberInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(
    value || 0
  );
}

function formatRate(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(2)}%`;
}

function monthNow(): string {
  return getTokyoToday().slice(0, 7);
}

export default function ShortVideoDaily() {
  const { language } = useLanguage();
  const t = language === "ja" ? copy.ja : copy.zh;
  const utils = trpc.useUtils();
  const [month, setMonth] = useState(monthNow);
  const [producerFilter, setProducerFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [reportDate, setReportDate] = useState(() =>
    getDefaultShortVideoReportDate()
  );
  const [producerStaffId, setProducerStaffId] = useState("");
  const [accountId, setAccountId] = useState("none");
  const [drafts, setDrafts] = useState<VideoDraft[]>([emptyVideoDraft()]);
  const pageSize = 50;

  const listInput = useMemo(
    () => ({
      month,
      producerStaffId:
        producerFilter === "all" ? undefined : Number(producerFilter),
      accountId: accountFilter === "all" ? undefined : Number(accountFilter),
      search: search.trim() || undefined,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [month, producerFilter, accountFilter, search, page]
  );

  const accessQuery = trpc.shortVideoDaily.access.useQuery();
  const producersQuery = trpc.shortVideoDaily.listProducers.useQuery();
  const accountsQuery = trpc.shortVideoDaily.listAccounts.useQuery();
  const listQuery = trpc.shortVideoDaily.list.useQuery(listInput);
  const summaryQuery = trpc.shortVideoDaily.monthlySummary.useQuery({ month });

  const invalidate = async () => {
    await Promise.all([
      utils.shortVideoDaily.list.invalidate(),
      utils.shortVideoDaily.monthlySummary.invalidate(),
    ]);
  };

  const createMutation = trpc.shortVideoDaily.createBatch.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDialogOpen(false);
      toast.success(t.saved);
    },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.shortVideoDaily.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDialogOpen(false);
      toast.success(t.updated);
    },
    onError: error => toast.error(error.message),
  });
  const deleteMutation = trpc.shortVideoDaily.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success(t.deleted);
    },
    onError: error => toast.error(error.message),
  });

  const canEdit = accessQuery.data?.canEdit === true;
  const entries = (listQuery.data?.items || []) as Entry[];
  const totalPages = Math.max(
    1,
    Math.ceil((listQuery.data?.total || 0) / pageSize)
  );
  const draftPreview = calculateShortVideoEngagementMetrics(
    drafts.map(draft => ({
      views: numberInput(draft.views),
      likes: numberInput(draft.likes),
      comments: numberInput(draft.comments),
      shares: numberInput(draft.shares),
      saves: numberInput(draft.saves),
      productClicks: numberInput(draft.productClicks),
    }))
  );

  const openCreate = () => {
    setEditing(null);
    setReportDate(getDefaultShortVideoReportDate());
    setProducerStaffId(
      producersQuery.data?.[0]?.id ? String(producersQuery.data[0].id) : ""
    );
    setAccountId("none");
    setDrafts([emptyVideoDraft()]);
    setDialogOpen(true);
  };

  const openEdit = (entry: Entry) => {
    setEditing(entry);
    setReportDate(entry.reportDate);
    setProducerStaffId(String(entry.producerStaffId));
    setAccountId(entry.accountId ? String(entry.accountId) : "none");
    setDrafts([
      {
        videoUrl: entry.videoUrl,
        views: String(entry.views),
        likes: String(entry.likes),
        comments: String(entry.comments),
        shares: String(entry.shares),
        saves: String(entry.saves),
        productClicks: String(entry.productClicks),
        notes: entry.notes || "",
      },
    ]);
    setDialogOpen(true);
  };

  const updateDraft = (
    index: number,
    field: keyof VideoDraft,
    value: string
  ) => {
    setDrafts(current =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [field]: value } : draft
      )
    );
  };

  const buildEntry = (draft: VideoDraft) => ({
    reportDate,
    producerStaffId: Number(producerStaffId),
    accountId: accountId === "none" ? null : Number(accountId),
    videoUrl: draft.videoUrl.trim(),
    views: numberInput(draft.views),
    likes: numberInput(draft.likes),
    comments: numberInput(draft.comments),
    shares: numberInput(draft.shares),
    saves: numberInput(draft.saves),
    productClicks: numberInput(draft.productClicks),
    notes: draft.notes.trim() || null,
  });

  const handleSave = () => {
    if (!producerStaffId) return toast.error(`${t.producer} *`);
    if (drafts.some(draft => !draft.videoUrl.trim()))
      return toast.error(`${t.url} *`);
    if (editing)
      updateMutation.mutate({ id: editing.id, entry: buildEntry(drafts[0]) });
    else createMutation.mutate({ entries: drafts.map(buildEntry) });
  };

  const engagementSummary = summaryQuery.data?.summary;
  const combinedPostCount = engagementSummary?.postCount || 0;
  const combinedViews = engagementSummary?.views || 0;
  const combinedLikes = engagementSummary?.likes || 0;
  const combinedClicks = engagementSummary?.productClicks || 0;
  const combinedEngagementRate = engagementSummary?.engagementRate ?? null;
  const combinedClickRate = engagementSummary?.clickRate ?? null;
  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-rose-100 p-2 text-rose-700">
              <Video className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <label className="block max-w-xs space-y-1 text-xs font-medium">
            <span>{t.month}</span>
            <Input
              type="month"
              value={month}
              onChange={event => {
                setMonth(event.target.value);
                setPage(0);
              }}
            />
          </label>
        </CardContent>
      </Card>

      <TikTokPublicMonitor month={month} />

      <ShortVideoAccountDailySales month={month} />

      <section className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50/30 p-3 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold">{t.videoSection}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.videoSectionNote}</p>
          </div>
          {canEdit ? (
            <Button
              onClick={openCreate}
              className="gap-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              {t.add}
            </Button>
          ) : (
            <Badge variant="outline">{t.noEdit}</Badge>
          )}
        </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Video}
          label={t.posts}
          value={formatNumber(combinedPostCount)}
          note={`${summaryQuery.data?.daily.length || 0} ${t.activeDays}`}
          tone="rose"
        />
        <MetricCard
          icon={Eye}
          label={t.views}
          value={formatNumber(combinedViews)}
          note={`${t.engagementRate} ${formatRate(combinedEngagementRate)}`}
          tone="blue"
        />
        <MetricCard
          icon={Heart}
          label={t.likes}
          value={formatNumber(combinedLikes)}
          note={`${t.engagementRate} ${formatRate(combinedEngagementRate)}`}
          tone="amber"
        />
        <MetricCard
          icon={MousePointerClick}
          label={t.clicks}
          value={formatNumber(combinedClicks)}
          note={`${t.conversionRate} ${formatRate(combinedClickRate)}`}
          tone="emerald"
        />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <label className="space-y-1 text-xs font-medium">
            <span>{t.producer}</span>
            <Select
              value={producerFilter}
              onValueChange={value => {
                setProducerFilter(value);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allProducer}</SelectItem>
                {producersQuery.data?.map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t.account}</span>
            <Select
              value={accountFilter}
              onValueChange={value => {
                setAccountFilter(value);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allAccount}</SelectItem>
                {accountsQuery.data?.map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.displayName || `@${item.accountName}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t.search}</span>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                className="pl-9"
                placeholder={t.search}
              />
            </div>
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-rose-600" />
              {t.daily}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summaryQuery.data?.daily.length ? (
              summaryQuery.data.daily.map(day => (
                <div
                  key={day.reportDate}
                  className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="font-semibold">{day.reportDate}</div>
                  <div className="grid gap-1 sm:grid-cols-3">
                    <span>{t.posts}: {day.summary.postCount}</span>
                    <span>{t.views}: {formatNumber(day.summary.views)}</span>
                    <span>{t.engagementRate}: {formatRate(day.summary.engagementRate)}</span>
                  </div>
                </div>
              ))
            ) : (
              <Empty text={t.empty} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-violet-600" />
              {t.producers}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summaryQuery.data?.producers.length ? (
              summaryQuery.data.producers.map(producer => (
                <div
                  key={producer.producerStaffId}
                  className="rounded-lg border p-3"
                >
                  <div className="font-semibold">{producer.producerName}</div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>{t.posts}: {producer.summary.postCount}</span>
                    <span>{t.views}: {formatNumber(producer.summary.views)}</span>
                    <span>{t.likes}: {formatNumber(producer.summary.likes)}</span>
                    <span>{t.clicks}: {formatNumber(producer.summary.productClicks)}</span>
                  </div>
                </div>
              ))
            ) : (
              <Empty text={t.empty} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            {t.records}{" "}
            <Badge variant="secondary">
              {listQuery.data?.total || 0}
              {t.count}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="py-12">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <Empty text={t.empty} />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs">
                    <tr>
                      <th className="p-3">{t.day}</th>
                      <th className="p-3">{t.producer}</th>
                      <th className="p-3">{t.url}</th>
                      <th className="p-3 text-right">{t.views}</th>
                      <th className="p-3 text-right">{t.likes}</th>
                      <th className="p-3 text-right">{t.clicks}</th>
                      <th className="p-3">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => (
                      <tr key={entry.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-medium">{entry.reportDate}</td>
                        <td className="p-3">
                          <div>{entry.producerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.accountName || "—"}
                          </div>
                        </td>
                        <td className="max-w-[260px] p-3">
                          <a
                            href={entry.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 truncate text-blue-600 hover:underline"
                          >
                            <Link2 className="h-3.5 w-3.5 shrink-0" />
                            {entry.videoUrl}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(entry.views)}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(entry.likes)}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(entry.productClicks)}
                        </td>
                        <td className="p-3">
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t.edit}
                                onClick={() => openEdit(entry)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t.delete}
                                onClick={() => {
                                  if (confirm(t.deleteConfirm))
                                    deleteMutation.mutate({ id: entry.id });
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-3 md:hidden">
                {entries.map(entry => (
                  <div key={entry.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">
                          {entry.reportDate} · {entry.producerName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.accountName || "—"}
                        </div>
                      </div>
                    </div>
                    <a
                      href={entry.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex items-center gap-1 truncate text-sm text-blue-600"
                    >
                      <Link2 className="h-4 w-4 shrink-0" />
                      {entry.videoUrl}
                    </a>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <span>
                        <Eye className="inline h-3 w-3" />{" "}
                        {formatNumber(entry.views)}
                      </span>
                      <span>
                        <Heart className="inline h-3 w-3" />{" "}
                        {formatNumber(entry.likes)}
                      </span>
                      <span>
                        <MousePointerClick className="inline h-3 w-3" />{" "}
                        {formatNumber(entry.productClicks)}
                      </span>
                    </div>
                    {canEdit && (
                      <div className="mt-2 flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={t.edit}
                          onClick={() => openEdit(entry)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          {t.edit}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={t.delete}
                          onClick={() => {
                            if (confirm(t.deleteConfirm))
                              deleteMutation.mutate({ id: entry.id });
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t p-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(current => current - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                {t.previous}
              </Button>
              <span className="text-sm">
                {page + 1}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(current => current + 1)}
              >
                {t.next}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto sm:!max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? t.edit : t.add}</DialogTitle>
            <DialogDescription>{t.yesterdayHint}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm font-medium">
              <span>{t.dataDate} *</span>
              <Input
                type="date"
                max={getTokyoToday()}
                value={reportDate}
                onChange={event => setReportDate(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>{t.producer} *</span>
              <Select
                value={producerStaffId}
                onValueChange={setProducerStaffId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.producer} />
                </SelectTrigger>
                <SelectContent>
                  {producersQuery.data?.map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>{t.account}</span>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.optionalAccount}</SelectItem>
                  {accountsQuery.data?.map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.displayName || `@${item.accountName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <span>{t.posts}: <b>{draftPreview.postCount}</b></span>
              <span>{t.views}: <b>{formatNumber(draftPreview.views)}</b></span>
              <span>{t.likes}: <b>{formatNumber(draftPreview.likes)}</b></span>
              <span>{t.clicks}: <b>{formatNumber(draftPreview.productClicks)}</b></span>
            </div>
            <p className="mt-2">{t.snapshotHint}</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{t.videoLinks}</h3>
              {!editing && drafts.length < 50 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDrafts(current => [...current, emptyVideoDraft()])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t.addVideo}
                </Button>
              )}
            </div>
            {drafts.map((draft, index) => (
              <div
                key={index}
                className="relative rounded-xl border p-3 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="secondary">#{index + 1}</Badge>
                  <Input
                    value={draft.videoUrl}
                    onChange={event =>
                      updateDraft(index, "videoUrl", event.target.value)
                    }
                    placeholder="https://www.tiktok.com/..."
                    className="flex-1"
                  />
                  {!editing && drafts.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDrafts(current =>
                          current.filter(
                            (_, draftIndex) => draftIndex !== index
                          )
                        )
                      }
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {(
                    [
                      ["views", t.views, Eye],
                      ["likes", t.likes, Heart],
                      ["comments", t.comments, MessageCircle],
                      ["shares", t.shares, Share2],
                      ["saves", t.saves, Save],
                      ["productClicks", t.clicks, MousePointerClick],
                    ] as const
                  ).map(([field, label, Icon]) => (
                    <label
                      key={field}
                      className="space-y-1 text-xs font-medium"
                    >
                      <span className="flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {label}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={draft[field]}
                        onChange={event =>
                          updateDraft(index, field, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-3 block space-y-1 text-xs font-medium">
                  <span>{t.notes}</span>
                  <Textarea
                    rows={2}
                    value={draft.notes}
                    onChange={event =>
                      updateDraft(index, "notes", event.target.value)
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleSave} disabled={isBusy}>
              {isBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Video;
  label: string;
  value: string;
  note: string;
  tone: "rose" | "blue" | "amber" | "emerald";
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={`rounded-lg p-1.5 ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      <Video className="mx-auto mb-2 h-8 w-8 opacity-30" />
      {text}
    </div>
  );
}
