import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  MessageSquareReply,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type QueueItem = RouterOutputs["line"]["getGroupReplyReviewQueue"][number];

type Props = {
  language: string;
  onOpenGroup: (
    lineGroupId: string,
    suggestedReply: string | null | undefined,
    conversationRevision: number,
  ) => void;
};

function elapsedLabel(minutes: number, language: string): string {
  if (minutes < 60) return language === "ja" ? `${Math.max(1, minutes)}分前` : `${Math.max(1, minutes)}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return language === "ja" ? `${hours}時間前` : `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return language === "ja" ? `${days}日前` : `${days}天前`;
}

function contextTimeLabel(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(language === "ja" ? "ja-JP" : "zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function recommendationLabel(item: QueueItem, language: string): string {
  const labels: Record<QueueItem["recommendation"], [string, string]> = {
    sample_request: ["サンプル質問", "样品问题"],
    commercial_terms: ["取引条件", "合作条件"],
    schedule: ["配信日程", "直播日程"],
    question: ["明示質問", "明确提问"],
    request: ["依頼・確認", "请求・确认"],
    no_reply: ["返信不要候補", "可能无需回复"],
  };
  return labels[item.recommendation]?.[language === "ja" ? 0 : 1] || item.reason;
}

function ReviewCard({
  item,
  language,
  onOpenGroup,
  onDismiss,
  dismissing,
}: {
  item: QueueItem;
  language: string;
  onOpenGroup: Props["onOpenGroup"];
  onDismiss: (item: QueueItem) => void;
  dismissing: boolean;
}) {
  return (
    <Card className={item.shouldReply ? "border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/10" : "border-slate-200"}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {item.pictureUrl ? (
              <img src={item.pictureUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <MessageSquareReply className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{item.groupName}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{item.senderName}</span>
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {elapsedLabel(item.elapsedMinutes, language)}
                </span>
                {item.unansweredMessageCount > 1 && (
                  <span>
                    {language === "ja"
                      ? `未返信区間 ${item.unansweredMessageCount}件`
                      : `待回复区间 ${item.unansweredMessageCount}条`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {item.deliveryPending && (
              <Badge variant="outline">
                {language === "ja" ? "送信処理中" : "发送处理中"}
              </Badge>
            )}
            <Badge variant={item.shouldReply ? "destructive" : "secondary"}>
              {recommendationLabel(item, language)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 rounded-xl border bg-background/80 p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {language === "ja" ? "STEP 1・今確認" : "第1步・现在确认"}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {item.shouldReply
                ? (language === "ja" ? "質問・決定事項へ返信" : "回复问题・确认决定事项")
                : (language === "ja" ? "返信不要かを確認" : "确认是否无需回复")}
            </p>
          </div>
          <ArrowRight className="mx-auto hidden h-4 w-4 text-muted-foreground sm:block" />
          <div className={`rounded-lg border p-3 ${
            item.autoFollowUpEnabled
              ? "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/20"
              : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/20"
          }`}>
            <p className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide ${
              item.autoFollowUpEnabled ? "text-sky-700 dark:text-sky-300" : "text-muted-foreground"
            }`}>
              <CalendarClock className="h-3.5 w-3.5" />
              {language === "ja" ? `STEP 2・${item.autoFollowUpDays}日後` : `第2步・${item.autoFollowUpDays}天后`}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {item.autoFollowUpEnabled
                ? (language === "ja" ? "配信準備を1回だけ自動フォロー" : "自动跟进一次直播准备")
                : (language === "ja" ? "自動フォローはOFF" : "自动跟进已关闭")}
            </p>
            {item.autoFollowUpEnabled && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {language === "ja"
                  ? item.proactiveAiEnabled
                    ? "最新会話から決定済みと判断できた場合のみ、営業時間内にAI文案を送信。途中で会話があれば延期・中止します。"
                    : "設定済み文案を営業時間内に送信。途中で会話があれば延期・中止します。"
                  : item.proactiveAiEnabled
                    ? "仅在最新群聊可明确判断为已决定时，于工作时间发送AI文案；期间有新对话会延期或取消。"
                    : "在工作时间发送已设置文案；期间有新对话会延期或取消。"}
              </p>
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border bg-slate-50/80 dark:bg-slate-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background/80 px-3 py-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {language === "ja" ? "判断に使うグループ会話" : "用于判断的群聊上下文"}
            </p>
            <span className="text-[11px] text-muted-foreground">
              {language === "ja"
                ? `${item.contextMessageCount || item.contextMessages.length}件・時系列`
                : `${item.contextMessageCount || item.contextMessages.length}条・按时间顺序`}
            </span>
          </div>
          {item.contextMessages.length > 0 ? (
            <div className="max-h-96 space-y-2 overflow-y-auto p-3">
              {item.contextMessages.map(message => {
                const isOfficial = message.direction === "outgoing";
                const isStaff = message.direction === "incoming" && message.senderType === "staff";
                const participantTypeLabel = message.senderType === "liver"
                  ? (language === "ja" ? "ライバー" : "主播")
                  : message.senderType === "customer"
                    ? (language === "ja" ? "顧客" : "客户")
                    : (language === "ja" ? "未設定" : "未设置");
                return (
                  <div
                    key={`${message.id}:${message.messageId}`}
                    className={`flex ${isOfficial ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[92%] rounded-lg border px-3 py-2 text-sm shadow-sm ${
                      isOfficial
                        ? "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100"
                        : isStaff
                          ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"
                          : "border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                    }`}>
                      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <span>{message.senderName}</span>
                        {isOfficial && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            {language === "ja" ? "LCJ公式送信" : "LCJ官方发送"}
                          </Badge>
                        )}
                        {isStaff && (
                          <Badge className="h-5 bg-amber-500 px-1.5 text-[10px] text-white hover:bg-amber-500">
                            {language === "ja" ? "LCJスタッフ" : "LCJ员工"}
                          </Badge>
                        )}
                        {!isOfficial && !isStaff && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            {participantTypeLabel}
                          </Badge>
                        )}
                        {message.isBlocked && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                            {language === "ja" ? "ブロック" : "已屏蔽"}
                          </Badge>
                        )}
                        <span>{contextTimeLabel(message.sentAt, language)}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {language === "ja" ? "最新の参加者メッセージ" : "群成员最新消息"}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{item.contentPreview}</p>
            </div>
          )}
          {item.contextTruncated && (
            <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
              {language === "ja"
                ? `最新${item.contextMessages.length}件を表示しています。全履歴は「会話を確認」で確認できます。`
                : `当前显示最近${item.contextMessages.length}条。全部记录可在“查看对话”中确认。`}
            </p>
          )}
        </div>
        {item.suggestedReply && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/20">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-violet-800 dark:text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              {language === "ja" ? "AIおすすめ返信（未送信）" : "AI推荐回复（尚未发送）"}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm text-violet-950 dark:text-violet-100">
              {item.suggestedReply}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {language === "ja" ? `判定理由: ${item.reason}` : `判断理由：${item.reason}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={item.deliveryPending}
            onClick={() => onOpenGroup(
              item.lineGroupId,
              item.suggestedReply,
              item.conversationRevision,
            )}
          >
            {item.suggestedReply ? <Sparkles className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
            {item.suggestedReply
              ? (language === "ja" ? "文案を確認して返信" : "确认文案后回复")
              : (language === "ja" ? "会話を確認" : "查看对话")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={dismissing || item.deliveryPending}
            onClick={() => onDismiss(item)}
          >
            {dismissing ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
            {language === "ja" ? "返信不要" : "无需回复"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LineGroupReplyReviewQueue({ language, onOpenGroup }: Props) {
  const [filter, setFilter] = useState("");
  const utils = trpc.useUtils();
  const queue = trpc.line.getGroupReplyReviewQueue.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const dismissMutation = trpc.line.dismissGroupReplyReviewItem.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? "返信不要として整理しました" : "已标记为无需回复");
      void utils.line.getGroupReplyReviewQueue.invalidate();
    },
    onError: (error) => toast.error(error.message || (language === "ja" ? "更新に失敗しました" : "更新失败")),
  });

  const filtered = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return queue.data || [];
    return (queue.data || []).filter(item => [
      item.groupName,
      item.senderName,
      item.contentPreview,
      item.reason,
      ...item.contextMessages.flatMap(message => [message.senderName, message.content]),
    ].some(value => value.toLowerCase().includes(normalized)));
  }, [filter, queue.data]);
  const recommended = filtered.filter(item => item.shouldReply);
  const noReply = filtered.filter(item => !item.shouldReply);
  const scheduledSupport = filtered.filter(item => item.autoFollowUpEnabled);

  const dismiss = (item: QueueItem) => dismissMutation.mutate({
    lineGroupId: item.lineGroupId,
    incomingMessageId: item.incomingMessageId,
  });

  if (queue.isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(item => <Skeleton key={item} className="h-44 w-full" />)}</div>;
  }

  if (queue.isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-medium text-destructive">
            {language === "ja" ? "グループ返信確認を読み込めませんでした" : "无法加载群组回复确认"}
          </p>
          <Button variant="outline" onClick={() => queue.refetch()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {language === "ja" ? "再読み込み" : "重新加载"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-violet-950 dark:text-violet-100">
              <MessageSquareReply className="h-5 w-5" />
              {language === "ja" ? "招待済みグループ専用・AI返信確認" : "已邀请群组专用・AI回复确认"}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-violet-800 dark:text-violet-200">
              {language === "ja"
                ? "各グループの最新参加者メッセージ後にLCJ返信がないものだけを表示します。AI返信推奨を優先し、文案は必ず人が確認してから送信します。個別LINEの履歴・未応答はここには入りません。"
                : "这里只显示各群组最新成员消息之后尚无LCJ回复的项目，并优先显示AI建议回复。文案必须由人工确认后才能发送；个人LINE消息不会混入这里。"}
            </p>
            <p className="mt-2 text-xs font-medium text-violet-700 dark:text-violet-300">
              {language === "ja"
                ? "会話欄ではスタッフ発言を黄色で表示します。LINEユーザーの「ユーザータイプ＝スタッフ」に設定された人の発言後は、AI返信候補から自動で外れます。"
                : "对话栏会用黄色显示员工发言。在线用户中被明确设为“用户类型＝员工”的人员发言后，该项目会自动从AI回复候选中移除。"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-sm">
              {language === "ja" ? `AI返信推奨 ${recommended.length}件` : `AI建议回复 ${recommended.length}条`}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => queue.refetch()} disabled={queue.isFetching}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${queue.isFetching ? "animate-spin" : ""}`} />
              {language === "ja" ? "更新" : "刷新"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{language === "ja" ? "今すぐ確認" : "现在确认"}</p>
          <p className="mt-1 text-2xl font-bold">{recommended.length}</p>
          <p className="text-xs text-muted-foreground">{language === "ja" ? "質問・依頼・決定事項" : "问题・请求・决定事项"}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/20">
          <p className="text-xs font-medium text-sky-700 dark:text-sky-300">{language === "ja" ? "自動フォロー設定ON" : "自动跟进设置ON"}</p>
          <p className="mt-1 text-2xl font-bold">{scheduledSupport.length}</p>
          <p className="text-xs text-muted-foreground">{language === "ja" ? "表示中の返信確認グループでON（全予約数ではありません）" : "当前回复确认列表中已开启，并非全部未来任务"}</p>
        </div>
        <div className="rounded-xl border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">{language === "ja" ? "返信不要候補" : "可能无需回复"}</p>
          <p className="mt-1 text-2xl font-bold">{noReply.length}</p>
          <p className="text-xs text-muted-foreground">{language === "ja" ? "確認・お礼のみ" : "仅确认・致谢"}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={event => setFilter(event.target.value)}
          placeholder={language === "ja" ? "グループ名・参加者・本文で検索" : "按群名、成员或内容搜索"}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="recommended" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommended">
            {language === "ja" ? `AI返信推奨 ${recommended.length}` : `AI建议回复 ${recommended.length}`}
          </TabsTrigger>
          <TabsTrigger value="no-reply">
            {language === "ja" ? `返信不要候補 ${noReply.length}` : `可能无需回复 ${noReply.length}`}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="recommended" className="space-y-4">
          {recommended.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
              <p className="font-medium">{language === "ja" ? "AI返信推奨はありません" : "暂无AI建议回复"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{language === "ja" ? "現在、優先して確認するグループ質問はありません。" : "目前没有需要优先确认的群组问题。"}</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {recommended.map(item => <ReviewCard key={item.incomingMessageId} item={item} language={language} onOpenGroup={onOpenGroup} onDismiss={dismiss} dismissing={dismissMutation.isPending && dismissMutation.variables?.incomingMessageId === item.incomingMessageId} />)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="no-reply" className="space-y-4">
          {noReply.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              {language === "ja" ? "返信不要候補はありません。" : "暂无可能无需回复的项目。"}
            </CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {noReply.map(item => <ReviewCard key={item.incomingMessageId} item={item} language={language} onOpenGroup={onOpenGroup} onDismiss={dismiss} dismissing={dismissMutation.isPending && dismissMutation.variables?.incomingMessageId === item.incomingMessageId} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
