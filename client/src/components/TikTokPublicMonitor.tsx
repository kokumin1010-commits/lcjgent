import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Share2,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";

type MetricKey = "views" | "likes" | "comments" | "shares" | "saves";

const metricConfig: Array<{
  key: MetricKey;
  icon: typeof Eye;
  zh: string;
  ja: string;
}> = [
  { key: "views", icon: Eye, zh: "播放", ja: "再生" },
  { key: "likes", icon: Heart, zh: "点赞", ja: "いいね" },
  { key: "comments", icon: MessageCircle, zh: "评论", ja: "コメント" },
  { key: "shares", icon: Share2, zh: "分享", ja: "シェア" },
  { key: "saves", icon: Bookmark, zh: "收藏", ja: "保存" },
];

function formatNumber(value: unknown): string {
  const parsed = Number(value || 0);
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(
    Number.isFinite(parsed) ? parsed : 0
  );
}

function formatDateTime(value: unknown, language: string): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function statusBadge(status: string, enabled: boolean, language: string) {
  if (!enabled)
    return (
      <Badge variant="secondary">
        {language === "ja" ? "一時停止" : "已暂停"}
      </Badge>
    );
  if (status === "success")
    return (
      <Badge className="bg-emerald-600">
        {language === "ja" ? "正常" : "正常"}
      </Badge>
    );
  if (status === "syncing")
    return (
      <Badge className="bg-blue-600">
        {language === "ja" ? "同期中" : "同步中"}
      </Badge>
    );
  if (status === "error" || status === "failed")
    return (
      <Badge variant="destructive">
        {language === "ja" ? "要確認" : "需检查"}
      </Badge>
    );
  return (
    <Badge variant="outline">{language === "ja" ? "未同期" : "未同步"}</Badge>
  );
}

export default function TikTokPublicMonitor({
  month,
  showRegisterButton = true,
}: {
  month: string;
  showRegisterButton?: boolean;
}) {
  const { language } = useLanguage();
  const ja = language === "ja";
  const utils = trpc.useUtils();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [rawAccounts, setRawAccounts] = useState("");
  const [syncingAccountId, setSyncingAccountId] = useState<number | null>(null);
  const [accountFilter, setAccountFilter] = useState("all");

  const dashboard = trpc.tiktokPublicMonitor.dashboard.useQuery(
    { month },
    { refetchInterval: 60_000, retry: 1 }
  );
  const invalidate = async () =>
    utils.tiktokPublicMonitor.dashboard.invalidate();
  const registerMutation =
    trpc.tiktokPublicMonitor.registerAccounts.useMutation({
      onSuccess: async result => {
        await invalidate();
        setRegisterOpen(false);
        setRawAccounts("");
        if (result.errors.length) {
          toast.warning(
            ja
              ? `${result.created}件追加、${result.duplicates}件既存、${result.errors.length}件失敗`
              : `新增${result.created}个，已有${result.duplicates}个，失败${result.errors.length}个`
          );
        } else {
          toast.success(
            ja
              ? `${result.created}件を監視対象に追加しました`
              : `已新增${result.created}个监控账号`
          );
        }
      },
      onError: error => toast.error(error.message),
    });
  const syncMutation = trpc.tiktokPublicMonitor.syncNow.useMutation({
    onSuccess: async result => {
      await invalidate();
      toast.success(
        ja
          ? `@${result.username}：${result.videoCount}本、${result.snapshotCount}件を取得`
          : `@${result.username}：已获取${result.videoCount}条视频、${result.snapshotCount}条快照`
      );
    },
    onError: error => toast.error(error.message),
    onSettled: () => setSyncingAccountId(null),
  });
  const monitoringMutation = trpc.tiktokPublicMonitor.setMonitoring.useMutation(
    {
      onSuccess: async (_result, variables) => {
        await invalidate();
        toast.success(
          variables.enabled
            ? ja
              ? "自動監視を再開しました"
              : "已恢复自动监控"
            : ja
              ? "自動監視を一時停止しました"
              : "已暂停自动监控"
        );
      },
      onError: error => toast.error(error.message),
    }
  );

  const data = dashboard.data;
  const canEdit = data?.access?.canEdit === true;
  const filteredAccounts = useMemo(
    () =>
      data?.accounts.filter(item =>
        accountFilter === "all" ? true : item.accountId === Number(accountFilter)
      ) || [],
    [accountFilter, data?.accounts]
  );
  const filteredVideos = useMemo(
    () =>
      data?.videos.filter(item =>
        accountFilter === "all" ? true : item.accountId === Number(accountFilter)
      ) || [],
    [accountFilter, data?.videos]
  );
  const totals = useMemo(
    () => ({
      accounts: filteredAccounts.length,
      followers: filteredAccounts.reduce(
        (sum, item) => sum + Number(item.followerCount || 0),
        0
      ),
      videos: filteredVideos.length,
      views: filteredVideos.reduce(
        (sum, item) => sum + Number(item.views || 0),
        0
      ),
      likes: filteredVideos.reduce(
        (sum, item) => sum + Number(item.likes || 0),
        0
      ),
      active: filteredAccounts.filter(item => item.monitorEnabled).length,
    }),
    [filteredAccounts, filteredVideos]
  );
  const dailyPosts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredVideos.forEach(video => {
      const date = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(new Date(video.publishedAt));
      counts.set(date, (counts.get(date) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-14);
  }, [filteredVideos]);
  const maxDailyPosts = Math.max(1, ...dailyPosts.map(item => item.count));
  const recentRuns = useMemo(
    () =>
      (data?.runs || [])
        .filter(run =>
          accountFilter === "all"
            ? true
            : Number(run.accountId) === Number(accountFilter)
        )
        .slice(0, 10),
    [accountFilter, data?.runs]
  );

  return (
    <section className="space-y-4 rounded-2xl border border-cyan-200 bg-gradient-to-b from-cyan-50/60 to-background p-3 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">
              {ja ? "公開TikTokアカウント自動監視" : "公开TikTok账号自动监控"}
            </h2>
            <Badge
              variant="outline"
              className="border-cyan-300 bg-cyan-50 text-cyan-800"
            >
              RapidAPI · TIKWM
            </Badge>
          </div>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {ja
              ? "公開プロフィールと動画エンゲージメントを自動取得します。注文・GMV・商品クリックとは完全に分離されています。"
              : "自动采集公开账号资料、公开视频和互动指标历史；与订单、GMV、商品点击完全分离，不会推导或混算销售数据。"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-full bg-background sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ja ? "全アカウント" : "全部账号"}</SelectItem>
              {data?.accounts.map(account => (
                <SelectItem key={account.accountId} value={String(account.accountId)}>
                  @{account.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && showRegisterButton ? (
            <Button
              onClick={() => setRegisterOpen(true)}
              className="gap-2 bg-cyan-700 hover:bg-cyan-800"
            >
              <Plus className="h-4 w-4" />
              {ja ? "アカウント一括追加" : "批量添加账号"}
            </Button>
          ) : null}
        </div>
      </div>

      {data && !data.providerConfigured ? (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{ja ? "公開データ提供元が未設定です。アカウントは保存できますが、自動取得は開始されません。" : "公开视频数据源尚未配置。账号可以保存，但不会开始自动获取。"}</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MonitorMetric
          icon={Users}
          label={ja ? "監視アカウント" : "监控账号"}
          value={formatNumber(totals.accounts)}
        />
        <MonitorMetric
          icon={Users}
          label={ja ? "フォロワー合計" : "粉丝总数"}
          value={formatNumber(totals.followers)}
        />
        <MonitorMetric
          icon={Video}
          label={ja ? "当月の動画" : "本月视频"}
          value={formatNumber(totals.videos)}
        />
        <MonitorMetric
          icon={Eye}
          label={ja ? "当月動画の現在再生" : "本月视频当前播放"}
          value={formatNumber(totals.views)}
        />
        <MonitorMetric
          icon={Heart}
          label={ja ? "当月動画のいいね" : "本月视频点赞"}
          value={formatNumber(totals.likes)}
        />
        <MonitorMetric
          icon={CheckCircle2}
          label={ja ? "自動取得中" : "自动获取中"}
          value={formatNumber(totals.active)}
        />
      </div>

      {dashboard.isLoading ? (
        <div className="flex min-h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
        </div>
      ) : dashboard.error ? (
        <Card className="border-red-200">
          <CardContent className="flex gap-3 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{dashboard.error.message}</span>
          </CardContent>
        </Card>
      ) : !data?.accounts.length ? (
        <Card className="border-dashed border-cyan-300">
          <CardContent className="flex flex-col items-center gap-3 py-9 text-center">
            <Users className="h-9 w-9 text-cyan-700" />
            <div>
              <p className="font-semibold">
                {ja ? "監視アカウントはまだありません" : "还没有监控账号"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {ja
                  ? "@ユーザー名またはTikTokプロフィールURLをまとめて追加できます。"
                  : "可一次粘贴多个@用户名或TikTok主页链接。"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {ja ? "日別投稿数（直近14日）" : "每日发布数（最近14日）"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyPosts.length ? (
                <div className="flex min-h-36 min-w-0 items-end gap-2 overflow-x-auto pb-1">
                  {dailyPosts.map(item => (
                    <div key={item.date} className="flex min-w-12 flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-bold">{item.count}</span>
                      <div className="flex h-20 w-full items-end rounded-t bg-slate-100">
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-cyan-700 to-cyan-400"
                          style={{ height: `${Math.max(8, Math.round((item.count / maxDailyPosts) * 100))}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {item.date.slice(5).replace("-", "/")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {ja ? "この月に公開された動画はありません" : "本月尚未发现公开视频"}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 xl:grid-cols-2">
            {filteredAccounts.map(account => (
              <Card key={account.accountId} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {account.avatarUrl ? (
                      <img
                        src={account.avatarUrl}
                        alt=""
                        className="h-14 w-14 rounded-full border object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100">
                        <Users className="h-6 w-6 text-cyan-700" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          className="truncate font-bold hover:text-cyan-700 hover:underline"
                          href={`https://www.tiktok.com/@${account.accountName}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          @{account.accountName}
                        </a>
                        {statusBadge(
                          account.syncStatus,
                          account.monitorEnabled,
                          language
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {account.bio || (ja ? "自己紹介なし" : "暂无简介")}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          title={ja ? "今すぐ取得" : "立即获取"}
                          disabled={syncMutation.isPending}
                          onClick={() => {
                            setSyncingAccountId(account.accountId);
                            syncMutation.mutate({
                              accountId: account.accountId,
                            });
                          }}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${syncingAccountId === account.accountId ? "animate-spin" : ""}`}
                          />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          title={
                            account.monitorEnabled
                              ? ja
                                ? "一時停止"
                                : "暂停"
                              : ja
                                ? "再開"
                                : "恢复"
                          }
                          disabled={monitoringMutation.isPending}
                          onClick={() =>
                            monitoringMutation.mutate({
                              accountId: account.accountId,
                              enabled: !account.monitorEnabled,
                            })
                          }
                        >
                          {account.monitorEnabled ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                    <AccountMetric
                      label={ja ? "フォロワー" : "粉丝"}
                      value={account.followerCount}
                    />
                    <AccountMetric
                      label={ja ? "フォロー" : "关注"}
                      value={account.followingCount}
                    />
                    <AccountMetric
                      label={ja ? "総いいね" : "总获赞"}
                      value={account.totalLikes}
                    />
                    <AccountMetric
                      label={ja ? "動画数" : "视频数"}
                      value={account.videoCount}
                    />
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                      {ja ? "最終成功" : "最后成功"}:{" "}
                      {formatDateTime(account.lastSuccessAt, language)}
                    </span>
                    <span>
                      <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                      {ja ? "次回予定" : "下次同步"}:{" "}
                      {account.monitorEnabled
                        ? formatDateTime(account.nextSyncAt, language)
                        : "—"}
                    </span>
                  </div>
                  {account.lastError ? (
                    <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                      {account.lastError}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {ja ? `${month} 公開動画` : `${month} 公开发现视频`}{" "}
                <Badge variant="secondary">{filteredVideos.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredVideos.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredVideos.map(video => (
                    <article
                      key={video.id}
                      className="overflow-hidden rounded-xl border bg-card"
                    >
                      <a
                        href={video.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block aspect-video overflow-hidden bg-slate-100"
                      >
                        {video.coverUrl ? (
                          <img
                            src={video.coverUrl}
                            alt=""
                            className="h-full w-full object-cover transition group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Video className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                          {Math.floor(Number(video.durationSeconds || 0) / 60)}:
                          {String(
                            Number(video.durationSeconds || 0) % 60
                          ).padStart(2, "0")}
                        </span>
                      </a>
                      <div className="space-y-3 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">
                              @{video.accountName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(video.publishedAt, language)}
                            </p>
                          </div>
                          <a
                            href={video.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="TikTok"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {metricConfig.map(metric => {
                            const Icon = metric.icon;
                            const current = Number(video[metric.key] || 0);
                            const growth = Number(
                              video[
                                `growth${metric.key[0].toUpperCase()}${metric.key.slice(1)}` as keyof typeof video
                              ] || 0
                            );
                            return (
                              <div
                                key={metric.key}
                                className="rounded bg-muted/60 px-1 py-2 text-center"
                              >
                                <Icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                                <div className="mt-1 text-xs font-bold">
                                  {formatNumber(current)}
                                </div>
                                <div className="text-[10px] text-emerald-700">
                                  +{formatNumber(growth)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {ja
                            ? "下段は初回取得時からの増加"
                            : "下方绿色数字为相较首次快照增长"}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {ja
                    ? "この月に公開された動画はまだありません"
                    : "本月尚未发现公开视频"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {ja ? "最近の自動取得履歴" : "最近自动获取记录"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentRuns.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3">{ja ? "開始" : "开始"}</th>
                        <th className="py-2 pr-3">{ja ? "アカウント" : "账号"}</th>
                        <th className="py-2 pr-3">{ja ? "契機" : "触发"}</th>
                        <th className="py-2 pr-3">{ja ? "状態" : "状态"}</th>
                        <th className="py-2 pr-3 text-right">{ja ? "新規" : "新视频"}</th>
                        <th className="py-2 pr-3 text-right">{ja ? "更新" : "已更新"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRuns.map(run => (
                        <tr key={run.id} className="border-b last:border-0">
                          <td className="py-2 pr-3">{formatDateTime(run.startedAt, language)}</td>
                          <td className="py-2 pr-3">{run.accountName ? `@${run.accountName}` : "—"}</td>
                          <td className="py-2 pr-3">{run.triggerType}</td>
                          <td className="py-2 pr-3">{statusBadge(String(run.status), true, language)}</td>
                          <td className="py-2 pr-3 text-right">{formatNumber(run.discoveredVideos)}</td>
                          <td className="py-2 pr-3 text-right">{formatNumber(run.updatedVideos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {ja ? "取得履歴はまだありません" : "暂无获取记录"}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {ja
          ? "取得頻度：投稿後72時間は6時間、7日以内は12時間、それ以降は24時間。失敗時は6時間後に再試行します。"
          : "动态频率：发布后72小时每6小时、7天内每12小时、之后每24小时；失败后6小时重试。"}
      </p>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ja ? "TikTokアカウントを一括追加" : "批量添加TikTok账号"}
            </DialogTitle>
            <DialogDescription>
              {ja
                ? "1行ずつ、@ユーザー名またはプロフィールURLを貼り付けてください（最大100件）。"
                : "每行一个，可粘贴@用户名或TikTok主页链接，单次最多100个。"}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rawAccounts}
            onChange={event => setRawAccounts(event.target.value)}
            rows={9}
            placeholder={
              "@account_name\nhttps://www.tiktok.com/@another_account"
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>
              {ja ? "キャンセル" : "取消"}
            </Button>
            <Button
              className="bg-cyan-700 hover:bg-cyan-800"
              disabled={!rawAccounts.trim() || registerMutation.isPending}
              onClick={() => registerMutation.mutate({ accounts: rawAccounts })}
            >
              {registerMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {ja ? "追加して監視開始" : "添加并开始监控"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MonitorMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-cyan-100 p-2 text-cyan-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountMetric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2">
      <div className="font-bold">{formatNumber(value)}</div>
      <div className="mt-0.5 text-muted-foreground">{label}</div>
    </div>
  );
}
