import { useState, lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSearch } from "wouter";
import { useLocation } from "wouter";

const LineFollowUpsContent = lazy(() => import("./LineFollowUps"));
const PendingResponsesContent = lazy(() => import("./PendingResponses"));
const LineGroupReplyReviewQueueContent = lazy(() => import("./LineGroupReplyReviewQueue"));
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, MessageSquareOff, Users, Send, History, RefreshCw, Search, User, Building2, Calendar, Clock, Link2, LogOut, AlertTriangle, Settings, Bell, BellOff, Radio, TrendingUp, Sparkles, ChevronRight, ExternalLink, Bot, ShieldCheck, Activity, CheckCircle2, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { sortLineMessagesChronologically } from "@shared/lineMessageHistory";
import { LINE_PUBLIC_CONTACT_NAME } from "@shared/linePublicIdentity";

type LineUser = {
  id: number;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  userType: "customer" | "staff" | "liver" | "unknown";
  isBlocked: boolean;
  brandId: number | null;
  liverId: number | null;
  lastMessageAt: Date | null;
  createdAt: Date;
};

const GROUP_MANUAL_MESSAGE_TEMPLATES = {
  greeting: {
    ja: `皆さま、はじめまして！\nこれからブランド「{{brandName}}」のご案内・サポートを担当するLCJの${LINE_PUBLIC_CONTACT_NAME}です。\n今後の商品案内やご連絡のため、差し支えなければ以下を教えてください。\n・TikTokのアカウント名／ID\n・お呼びする際のお名前（ニックネームでも大丈夫です）\n・主な配信または動画投稿のジャンル\nこちらを教えていただけますでしょうか？\nどうぞよろしくお願いいたします！`,
    zh: `大家好，初次见面！\n我是LCJ的${LINE_PUBLIC_CONTACT_NAME}，今后负责品牌“{{brandName}}”的商品介绍和相关支持。\n为了之后方便联系和为您推荐商品，如果方便的话，请告诉我们以下信息。\n・TikTok账号名／ID\n・希望我们如何称呼您（昵称也可以）\n・主要直播或发布视频的领域\n今后请多关照！`,
  },
  sample: {
    ja: `お世話になっております。\nブランド「{{brandName}}」の商品について、現在お手元にあるサンプルや、特に興味のある商品はございますでしょうか。\nご希望の商品があれば、在庫・提供可否・条件を確認してご案内いたします。`,
    zh: `您好。\n关于品牌“{{brandName}}”的商品，请问您目前手上有哪些样品，或对哪些商品特别感兴趣？\n如有希望了解的商品，我们会先确认库存、提供条件及可否，再为您说明。`,
  },
  livestream: {
    ja: `お世話になっております。\nブランド「{{brandName}}」の商品をご紹介いただける配信や動画投稿のご予定はございますでしょうか。\n配信時期・紹介したい商品・希望条件など、決まっている範囲でお知らせいただければ、こちらで合う商品や進め方を整理いたします。`,
    zh: `您好。\n请问您接下来有介绍品牌“{{brandName}}”商品的直播或视频发布计划吗？\n如果方便，请把大致时间、想介绍的商品和希望条件告诉我们，我们会协助整理适合的商品和推进方式。`,
  },
} as const;

type GroupManualMessageTemplateKey = keyof typeof GROUP_MANUAL_MESSAGE_TEMPLATES;

export default function LineManagement() {
  const { language } = useLanguage();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const groupSyncRequestedRef = useRef(false);
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const tabFromUrl = urlParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "group-reply-review");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkingUser, setLinkingUser] = useState<LineUser | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [selectedUserType, setSelectedUserType] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showLeaveGroupDialog, setShowLeaveGroupDialog] = useState(false);
  const [leavingGroupId, setLeavingGroupId] = useState<string | null>(null);
  const [leavingGroupName, setLeavingGroupName] = useState<string>("");
  const [showAutoFollowUpDialog, setShowAutoFollowUpDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [autoFollowUpEnabled, setAutoFollowUpEnabled] = useState(true);
  const [autoFollowUpDays, setAutoFollowUpDays] = useState("2");
  const [autoFollowUpMessage, setAutoFollowUpMessage] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [analysisEnabled, setAnalysisEnabled] = useState(true);
  const [proactiveAiEnabled, setProactiveAiEnabled] = useState(true);
  const [dailyReportEnabled, setDailyReportEnabled] = useState(false);
  const [relationshipObjective, setRelationshipObjective] = useState("");
  const [showGroupDetailDialog, setShowGroupDetailDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupMessageText, setGroupMessageText] = useState("");
  const [groupAiDraftPendingReview, setGroupAiDraftPendingReview] = useState(false);
  const [groupAiDraftReviewed, setGroupAiDraftReviewed] = useState(false);
  const [groupReplyExpectedRevision, setGroupReplyExpectedRevision] = useState<number | null>(null);
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<string, number | null>>({});
  const [groupMemberCountsLoaded, setGroupMemberCountsLoaded] = useState(false);
  const [showLiverInteractionDialog, setShowLiverInteractionDialog] = useState(false);
  const [selectedLiverId, setSelectedLiverId] = useState<number | null>(null);
  const [showAiManagerHistoryDialog, setShowAiManagerHistoryDialog] = useState(false);
  const [selectedAiManagerHistoryUserId, setSelectedAiManagerHistoryUserId] = useState<string | null>(null);
  const [showPersonTalkHistoryDialog, setShowPersonTalkHistoryDialog] = useState(false);
  const [selectedPersonTalkHistory, setSelectedPersonTalkHistory] = useState<{
    lineUserId: string;
    displayName?: string | null;
    pictureUrl?: string | null;
  } | null>(null);
  const directMessageRequestIdRef = useRef<string | null>(null);
  const groupMessageRequestIdRef = useRef<string | null>(null);
  const groupMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const groupReplyPrefillRef = useRef<{
    lineGroupId: string;
    text: string;
    conversationRevision: number;
  } | null>(null);

  // Fetch LINE users
  const { data: lineUsers, isLoading: loadingUsers, refetch: refetchUsers } = trpc.line.listUsers.useQuery();
  
  // Fetch LINE groups
  const { data: lineGroups, isLoading: loadingGroups, refetch: refetchGroups } = trpc.line.listGroups.useQuery();
  const groupReplyReviewQueue = trpc.line.getGroupReplyReviewQueue.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  
  // Fetch LINE messages
  const { data: lineMessages, isLoading: loadingMessages, refetch: refetchMessages } = trpc.line.listMessages.useQuery({
    lineUserId: selectedUser || undefined,
    sourceType: "user",
    limit: 50,
  });

  // Fetch brands for linking
  const { data: brands } = trpc.brand.list.useQuery();

  // Fetch liver-linked LINE users
  const { data: liverLinkedUsers, isLoading: loadingLiverLinked, refetch: refetchLiverLinked } = trpc.line.listLiverLinkedUsers.useQuery();

  const { data: aiManagerData, isLoading: loadingAiManagers, refetch: refetchAiManagers } = trpc.line.listAiManagers.useQuery(
    undefined,
    { enabled: activeTab === "ai-managers" }
  );

  const {
    data: aiManagerHistory,
    isLoading: loadingAiManagerHistory,
    isError: aiManagerHistoryFailed,
    error: aiManagerHistoryError,
    refetch: refetchAiManagerHistory,
  } = trpc.line.getAiManagerHistory.useQuery(
    { lineUserId: selectedAiManagerHistoryUserId || "", limit: 100 },
    { enabled: showAiManagerHistoryDialog && !!selectedAiManagerHistoryUserId }
  );

  const personTalkHistoryQuery = trpc.line.getPersonTalkHistory.useInfiniteQuery(
    {
      lineUserId: selectedPersonTalkHistory?.lineUserId || "",
      limit: 100,
    },
    {
      enabled: showPersonTalkHistoryDialog && !!selectedPersonTalkHistory?.lineUserId,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  );
  const personTalkHistoryFirstPage = personTalkHistoryQuery.data?.pages[0];
  const personTalkHistoryMessages = useMemo(() => {
    const uniqueMessages = new Map<number, any>();
    for (const page of personTalkHistoryQuery.data?.pages || []) {
      for (const message of page.items) uniqueMessages.set(message.id, message);
    }
    return Array.from(uniqueMessages.values()).sort((left, right) => right.id - left.id);
  }, [personTalkHistoryQuery.data]);
  const personTalkHistoryGroupNames = useMemo<Record<string, string | null>>(
    () => Object.assign({}, ...(personTalkHistoryQuery.data?.pages || []).map((page) => page.groupNames)),
    [personTalkHistoryQuery.data],
  );

  const openPersonTalkHistory = (person: {
    lineUserId?: string | null;
    displayName?: string | null;
    pictureUrl?: string | null;
  }) => {
    if (!person.lineUserId) return;
    setSelectedPersonTalkHistory({
      lineUserId: person.lineUserId,
      displayName: person.displayName,
      pictureUrl: person.pictureUrl,
    });
    setShowPersonTalkHistoryDialog(true);
  };

  const updateAiManagerMutation = trpc.line.updateAiManagerSettings.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? `${LINE_PUBLIC_CONTACT_NAME}の設定を更新しました` : `已更新${LINE_PUBLIC_CONTACT_NAME}的设置`);
      void refetchAiManagers();
    },
    onError: (error) => {
      toast.error(error.message || (language === "ja" ? "設定の更新に失敗しました" : "设置更新失败"));
    },
  });

  const refreshAiManagerTikTokMutation = trpc.line.refreshAiManagerTikTok.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.refreshed
          ? (language === "ja" ? "TikTok公開情報を更新しました" : "TikTok公开信息已更新")
          : (language === "ja" ? "TikTok分析は更新不要、またはアカウント未設定です" : "TikTok分析无需更新或账号未设置")
      );
      void refetchAiManagers();
    },
    onError: (error) => {
      toast.error(error.message || (language === "ja" ? "TikTok分析に失敗しました" : "TikTok分析失败"));
    },
  });

  // Fetch liver interaction summary
  const { data: liverInteraction, isLoading: loadingLiverInteraction } = trpc.line.getLiverInteraction.useQuery(
    { liverId: selectedLiverId! },
    { enabled: !!selectedLiverId }
  );

  // Fetch messages for selected group
  const {
    data: groupMessages,
    isLoading: loadingGroupMessages,
    isError: groupMessagesFailed,
    error: groupMessagesError,
    refetch: refetchGroupMessages,
  } = trpc.line.listMessages.useQuery(
    { lineGroupId: selectedGroup?.lineGroupId, limit: 200 },
    { enabled: !!selectedGroup?.lineGroupId }
  );

  const syncGroupsMutation = trpc.line.syncGroups.useMutation({
    onSuccess: (result) => {
      setGroupMemberCounts(result.memberCounts);
      setGroupMemberCountsLoaded(true);
      void utils.line.listGroups.invalidate();
      if (result.removedCount > 0) {
        toast.info(
          language === "ja"
            ? `退会済みグループ${result.removedCount}件を一覧から除外しました`
            : `已从列表移除${result.removedCount}个已退出群组`
        );
      }
    },
    onError: (error) => {
      groupSyncRequestedRef.current = false;
      setGroupMemberCountsLoaded(true);
      console.error("[LINE Management] Group synchronization failed:", error);
    },
  });

  useEffect(() => {
    if (
      activeTab !== "groups" ||
      loadingGroups ||
      groupSyncRequestedRef.current
    ) {
      return;
    }

    groupSyncRequestedRef.current = true;
    setGroupMemberCountsLoaded(false);
    syncGroupsMutation.mutate();
  }, [activeTab, loadingGroups]);

  useEffect(() => {
    if (!selectedGroup?.lineGroupId || !lineGroups) return;
    const latestGroup = lineGroups.find(group => group.lineGroupId === selectedGroup.lineGroupId);
    if (latestGroup) setSelectedGroup(latestGroup);
  }, [lineGroups, selectedGroup?.lineGroupId]);

  useEffect(() => {
    if (!showGroupDetailDialog || loadingGroupMessages) return;
    groupMessagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [showGroupDetailDialog, loadingGroupMessages, groupMessages?.length]);

  useEffect(() => {
    const pendingPrefill = groupReplyPrefillRef.current;
    const matchedPrefill = pendingPrefill && pendingPrefill.lineGroupId === selectedGroup?.lineGroupId
      ? pendingPrefill
      : null;
    const prefill = matchedPrefill?.text || "";
    groupReplyPrefillRef.current = null;
    setGroupMessageText(prefill);
    setGroupAiDraftPendingReview(Boolean(prefill));
    setGroupAiDraftReviewed(false);
    const currentConversationRevision = Number(selectedGroup?.conversationRevision);
    setGroupReplyExpectedRevision(
      matchedPrefill?.conversationRevision ?? (
        Number.isSafeInteger(currentConversationRevision) && currentConversationRevision >= 0
          ? currentConversationRevision
          : null
      ),
    );
    groupMessageRequestIdRef.current = null;
  }, [selectedGroup?.lineGroupId, selectedGroup?.conversationRevision]);

  useEffect(() => {
    setMessageText("");
    directMessageRequestIdRef.current = null;
  }, [selectedUser]);

  // Send message mutation
  const sendMessageMutation = trpc.line.sendMessage.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(language === "ja" ? "メッセージを送信しました" : "消息已发送");
      if (variables.to.startsWith("C")) {
        groupMessageRequestIdRef.current = null;
        setGroupMessageText("");
        setGroupAiDraftPendingReview(false);
        setGroupAiDraftReviewed(false);
        setGroupReplyExpectedRevision(null);
        void refetchGroupMessages();
        void utils.line.getGroupReplyReviewQueue.invalidate();
      } else {
        directMessageRequestIdRef.current = null;
        setShowMessageDialog(false);
        setMessageText("");
        void refetchMessages();
      }
    },
    onError: (error) => {
      const errorCode = error.data?.code;
      const fallback = language === "ja" ? "送信に失敗しました" : "发送失败";
      toast.error(`${error.message || fallback}${errorCode ? ` (${errorCode})` : ""}`);
      if (
        error.message?.includes("LINE_GROUP_CONVERSATION_CHANGED") ||
        error.message?.includes("LINE_GROUP_CONVERSATION_REVISION_REQUIRED")
      ) {
        setShowGroupDetailDialog(false);
        setSelectedGroup(null);
        setGroupMessageText("");
        setGroupReplyExpectedRevision(null);
        groupMessageRequestIdRef.current = null;
        setGroupAiDraftPendingReview(false);
        setGroupAiDraftReviewed(false);
        void utils.line.getGroupReplyReviewQueue.invalidate();
      }
    },
  });

  // Leave group mutation
  const leaveGroupMutation = trpc.line.leaveGroup.useMutation({
    onMutate: async ({ lineGroupId }) => {
      await utils.line.listGroups.cancel();
      const previousGroups = utils.line.listGroups.getData();
      const previousIndex =
        previousGroups?.findIndex((group) => group.lineGroupId === lineGroupId) ?? -1;
      utils.line.listGroups.setData(
        undefined,
        previousGroups?.filter((group) => group.lineGroupId !== lineGroupId)
      );
      return { previousGroups, previousIndex, lineGroupId };
    },
    onSuccess: (result) => {
      if (result.localSyncPending) {
        toast.warning(
          language === "ja"
            ? "LINE退会は完了しました。管理画面の同期を再試行します"
            : "LINE群组已退出，管理画面将重新同步"
        );
        window.setTimeout(() => syncGroupsMutation.mutate(), 1_500);
      } else {
        toast.success(
          result.alreadyLeft
            ? (language === "ja" ? "退会済みグループを一覧から削除しました" : "已从列表移除已退出的群组")
            : (language === "ja" ? "グループを退会しました" : "已退出群组")
        );
        void utils.line.listGroups.invalidate();
      }
      setShowLeaveGroupDialog(false);
      setLeavingGroupId(null);
    },
    onError: (error, _variables, context) => {
      const failedLineGroupId = context?.lineGroupId;
      const failedGroup = context?.previousGroups?.find(
        (group) => group.lineGroupId === failedLineGroupId
      );
      const currentGroups = utils.line.listGroups.getData();
      if (failedGroup && !currentGroups?.some((group) => group.lineGroupId === failedGroup.lineGroupId)) {
        const restoredGroups = [...(currentGroups || [])];
        restoredGroups.splice(Math.max(0, context?.previousIndex ?? 0), 0, failedGroup);
        utils.line.listGroups.setData(undefined, restoredGroups);
      }
      toast.error(
        language === "ja"
          ? error.message || "退会に失敗しました"
          : "退出失败，请稍后重试"
      );
      void utils.line.listGroups.invalidate();
    },
  });

  // Auto follow-up mutation
  const autoFollowUpMutation = trpc.line.updateGroupAutoFollowUp.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? "自動返信・フォローアップ設定を更新しました" : "自动回复/跟进设置已更新");
      setShowAutoFollowUpDialog(false);
      setEditingGroup(null);
      refetchGroups();
    },
    onError: (error) => {
      const code = error.data?.code;
      const fallback = language === "ja" ? "設定の更新に失敗しました" : "设置更新失败";
      toast.error(`${error.message || fallback}${code ? ` (${code})` : ""}`);
    },
  });

  const analyzeGroupMutation = trpc.line.analyzeGroupConversation.useMutation({
    onSuccess: (result) => {
      toast.success(language === "ja" ? "グループ会話のAI分析を更新しました" : "群聊AI分析已更新");
      setSelectedGroup((current: any) => current ? {
        ...current,
        groupInsight: result.insight,
        groupInsightUpdatedAt: result.insight.analyzedAt,
      } : current);
      void refetchGroups();
    },
    onError: (error) => {
      toast.error(error.message || (language === "ja" ? "グループ分析に失敗しました" : "群聊分析失败"));
    },
  });

  const generateGroupDraftMutation = trpc.line.generateGroupMessageDraft.useMutation({
    onSuccess: (result, variables) => {
      if (!showGroupDetailDialog || selectedGroup?.lineGroupId !== variables.lineGroupId) return;
      setGroupMessageText(result.message);
      setGroupAiDraftPendingReview(true);
      setGroupAiDraftReviewed(false);
      setGroupReplyExpectedRevision(result.conversationRevision);
      groupMessageRequestIdRef.current = null;
      toast.success(
        language === "ja"
          ? "AI文案を入力欄へ作成しました。確認・修正してから送信してください"
          : "AI文案已填入输入框，请确认或修改后再发送"
      );
    },
    onError: (error) => {
      toast.error(error.message || (language === "ja" ? "AI文案の生成に失敗しました" : "AI文案生成失败"));
    },
  });

  // Link user mutation
  const linkUserMutation = trpc.line.linkUser.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? "紐付けを更新しました" : "关联已更新");
      setShowLinkDialog(false);
      setLinkingUser(null);
      setSelectedBrandId("");
      setSelectedUserType("");
      refetchUsers();
    },
    onError: () => {
      toast.error(language === "ja" ? "紐付けに失敗しました" : "关联失败");
    },
  });

  const handleSendMessage = async () => {
    if (!selectedUser || !messageText.trim()) return;

    directMessageRequestIdRef.current ||= crypto.randomUUID();
    setSendingMessage(true);
    try {
      await sendMessageMutation.mutateAsync({
        to: selectedUser,
        message: messageText.trim(),
        requestId: directMessageRequestIdRef.current,
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendGroupMessage = () => {
    if (!selectedGroup?.lineGroupId || !groupMessageText.trim() || sendMessageMutation.isPending) return;
    if (groupAiDraftPendingReview && !groupAiDraftReviewed) {
      toast.error(
        language === "ja"
          ? "AI文案の内容を確認し、「内容を確認しました」を押してから送信してください"
          : "请先确认AI文案内容，并点击“已确认内容”后再发送"
      );
      return;
    }
    groupMessageRequestIdRef.current ||= crypto.randomUUID();
    sendMessageMutation.mutate({
      to: selectedGroup.lineGroupId,
      message: groupMessageText.trim(),
      requestId: groupMessageRequestIdRef.current,
      expectedGroupConversationRevision: groupReplyExpectedRevision ?? undefined,
    });
  };

  const applyGroupManualMessageTemplate = (templateKey: GroupManualMessageTemplateKey) => {
    const brandName = selectedGroup?.groupName?.trim() || (language === "ja" ? "このグループ" : "本群");
    const template = GROUP_MANUAL_MESSAGE_TEMPLATES[templateKey][language === "ja" ? "ja" : "zh"]
      .replaceAll("{{brandName}}", brandName);
    setGroupMessageText(template.slice(0, 5_000));
    setGroupAiDraftPendingReview(false);
    setGroupAiDraftReviewed(false);
    setGroupReplyExpectedRevision(null);
    groupMessageRequestIdRef.current = null;
    toast.info(
      language === "ja"
        ? "定型文を入力欄へ反映しました。内容を確認・修正してから送信してください"
        : "模板已填入输入框，请确认或修改后再发送"
    );
  };

  const handleLinkUser = async () => {
    if (!linkingUser) return;
    
    await linkUserMutation.mutateAsync({
      lineUserId: linkingUser.lineUserId,
      brandId: selectedBrandId ? parseInt(selectedBrandId) : null,
      userType: selectedUserType as "customer" | "staff" | "liver" | "unknown" || undefined,
    });
  };

  const openLinkDialog = (user: LineUser) => {
    setLinkingUser(user);
    setSelectedBrandId(user.brandId?.toString() || "");
    setSelectedUserType(user.userType || "");
    setShowLinkDialog(true);
  };

  // Filter users based on search
  const filteredUsers = lineUsers?.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.displayName?.toLowerCase().includes(query) ||
      (user.lineUserId && user.lineUserId.toLowerCase().includes(query))
    );
  });

  // Filter groups based on search
  const filteredGroups = lineGroups?.filter((group) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      group.groupName?.toLowerCase().includes(query) ||
      group.lineGroupId.toLowerCase().includes(query)
    );
  });

  const openGroupReplyReview = (
    lineGroupId: string,
    suggestedReply: string | null | undefined,
    conversationRevision: number,
  ) => {
    const group = lineGroups?.find(item => item.lineGroupId === lineGroupId);
    if (!group) {
      toast.error(language === "ja" ? "対象グループを読み込めませんでした" : "无法加载目标群组");
      void refetchGroups();
      return;
    }
    const prefill = suggestedReply?.trim() || "";
    groupReplyPrefillRef.current = { lineGroupId, text: prefill, conversationRevision };
    setSelectedGroup(group);
    setGroupMessageText(prefill);
    setGroupAiDraftPendingReview(Boolean(prefill));
    setGroupAiDraftReviewed(false);
    setGroupReplyExpectedRevision(conversationRevision);
    groupMessageRequestIdRef.current = null;
    setShowGroupDetailDialog(true);
  };

  // Get brand name by ID
  const getBrandName = (brandId: number | null) => {
    if (!brandId || !brands) return null;
    const brand = brands.find(b => b.id === brandId);
    return brand?.name || null;
  };

  const getGroupMemberCountLabel = (lineGroupId?: string) => {
    if (!lineGroupId || !groupMemberCountsLoaded) {
      return language === "ja" ? "参加人数を取得中..." : "正在获取成员人数...";
    }
    const count = groupMemberCounts[lineGroupId];
    if (typeof count !== "number") {
      return language === "ja" ? "参加人数を取得できません" : "无法获取成员人数";
    }
    return language === "ja" ? `参加人数: ${count.toLocaleString()}人` : `成员人数: ${count.toLocaleString()}人`;
  };

  const getAiHistoryStatusLabel = (status: string) => ({
    queued: language === "ja" ? "待機中" : "等待中",
    processing: language === "ja" ? "生成中" : "生成中",
    ready: language === "ja" ? "送信待ち" : "等待发送",
    sending: language === "ja" ? "送信中" : "发送中",
    sent: language === "ja" ? "送信済み" : "已发送",
    failed: language === "ja" ? "失敗" : "失败",
    skipped: language === "ja" ? "中止" : "已停止",
    unknown: language === "ja" ? "送信確認不能" : "无法确认发送",
  }[status] || status);

  const getAiHistoryStatusClasses = (status: string) => {
    if (status === "sent") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (["queued", "processing", "ready", "sending"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
    if (status === "unknown") return "border-orange-200 bg-orange-50 text-orange-700";
    if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-slate-200 bg-slate-50 text-slate-600";
  };

  const getAiHistoryTriggerLabel = (triggerType: string) => triggerType === "inactivity_follow_up"
    ? (language === "ja" ? "継続フォロー" : "持续跟进")
    : (language === "ja" ? "受信DMへの返信" : "回复收到的私信");

  const getLineMessageTypeLabel = (messageType: string) => ({
    text: language === "ja" ? "テキスト" : "文本",
    image: language === "ja" ? "画像" : "图片",
    video: language === "ja" ? "動画" : "视频",
    audio: language === "ja" ? "音声" : "语音",
    file: language === "ja" ? "ファイル" : "文件",
    sticker: language === "ja" ? "スタンプ" : "贴图",
  }[messageType] || messageType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === "ja" ? "LINE管理" : "LINE管理"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ja" 
              ? "LINEユーザー・グループの管理とメッセージ履歴" 
              : "LINE用户、群组管理和消息记录"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="default"
            onClick={() => navigate("/master/live-suggestions")}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {language === "ja" ? "AI配信提案" : "AI配信提案"}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              refetchUsers();
              if (activeTab === "groups") {
                groupSyncRequestedRef.current = true;
                setGroupMemberCountsLoaded(false);
                syncGroupsMutation.mutate();
              } else {
                refetchGroups();
              }
              if (activeTab === "ai-managers") void refetchAiManagers();
              if (activeTab === "group-reply-review") void groupReplyReviewQueue.refetch();
              refetchMessages();
            }}
            disabled={activeTab === "groups" && syncGroupsMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${activeTab === "groups" && syncGroupsMutation.isPending ? "animate-spin" : ""}`} />
            {language === "ja" ? "更新" : "刷新"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "連携ユーザー" : "关联用户"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lineUsers?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "グループ" : "群组"}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lineGroups?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "ブランド紐付け済" : "已关联品牌"}
            </CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lineUsers?.filter(u => u.brandId).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "メッセージ数" : "消息数"}
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lineMessages?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === "ja" ? "検索..." : "搜索..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          aria-label={language === "ja" ? "LINE管理メニュー" : "LINE管理菜单"}
          className="grid h-auto w-full grid-cols-1 items-stretch gap-2 rounded-xl bg-slate-100 p-2 2xl:grid-cols-[1.05fr_1.35fr_1.35fr] dark:bg-slate-900"
        >
          <div className="min-w-0 rounded-lg border border-violet-200 bg-violet-50/80 p-2 dark:border-violet-900 dark:bg-violet-950/20">
            <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              {language === "ja" ? "グループ対応" : "群组处理"}
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <TabsTrigger value="group-reply-review" className="h-9 min-w-0 px-2 text-xs sm:text-sm">
                <Sparkles className="h-4 w-4 text-violet-600" />
                {language === "ja" ? "AI返信確認" : "AI回复确认"}
                {(groupReplyReviewQueue.data?.filter(item => item.shouldReply).length || 0) > 0 && (
                  <Badge variant="destructive" className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px]">
                    {groupReplyReviewQueue.data?.filter(item => item.shouldReply).length || 0}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="groups" className="h-9 min-w-0 px-2 text-xs sm:text-sm">
                <Building2 className="h-4 w-4" />
                {language === "ja" ? "グループ一覧" : "群组列表"}
              </TabsTrigger>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-sky-200 bg-sky-50/80 p-2 dark:border-sky-900 dark:bg-sky-950/20">
            <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              {language === "ja" ? "個別LINE" : "个人LINE"}
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
              <TabsTrigger value="messages" className="h-9 min-w-0 px-2 text-xs sm:text-sm">
                <History className="h-4 w-4" />
                {language === "ja" ? "履歴" : "记录"}
              </TabsTrigger>
              <TabsTrigger value="pending" className="h-9 min-w-0 px-2 text-xs sm:text-sm">
                <Clock className="h-4 w-4" />
                {language === "ja" ? "未応答" : "待回复"}
              </TabsTrigger>
              <TabsTrigger value="follow-ups" className="h-9 min-w-0 px-2 text-xs sm:text-sm">
                <Bell className="h-4 w-4" />
                {language === "ja" ? "フォロー" : "跟进"}
              </TabsTrigger>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/40">
            <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {language === "ja" ? "管理・連携" : "管理・关联"}
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
              <TabsTrigger value="users" className="h-9 min-w-0 px-2 text-xs sm:text-sm">
                <User className="h-4 w-4" />
                {language === "ja" ? "ユーザー" : "用户"}
              </TabsTrigger>
              <TabsTrigger value="livers" className="h-9 min-w-0 px-2 text-xs sm:text-sm">
                <Radio className="h-4 w-4" />
                {language === "ja" ? "ライバー" : "主播"}
                {liverLinkedUsers && liverLinkedUsers.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1.5 text-[10px]">
                    {liverLinkedUsers.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ai-managers" className="h-9 min-w-0 px-2 text-xs sm:text-sm">
                <Bot className="h-4 w-4" />
                {LINE_PUBLIC_CONTACT_NAME}
                {(aiManagerData?.stats.total || 0) > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
                    {aiManagerData?.stats.replyEnabled || 0}/{aiManagerData?.stats.total || 0}
                  </Badge>
                )}
              </TabsTrigger>
            </div>
          </div>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          {loadingUsers ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ja" ? "読み込み中..." : "加载中..."}
            </div>
          ) : filteredUsers?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "ja" 
                  ? "LINEユーザーがまだいません。ユーザーがBotを友だち追加すると表示されます。" 
                  : "还没有LINE用户。用户添加Bot为好友后会显示在这里。"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers?.map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {user.pictureUrl ? (
                          <img 
                            src={user.pictureUrl} 
                            alt={user.displayName || "User"} 
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base">
                            {user.displayName || (user.lineUserId ? user.lineUserId.slice(0, 8) + "..." : "ユーザー")}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {user.userType === "liver" 
                              ? (language === "ja" ? "ライバー" : "主播")
                              : user.userType === "customer"
                              ? (language === "ja" ? "顧客" : "客户")
                              : user.userType === "staff"
                              ? (language === "ja" ? "スタッフ" : "员工")
                              : (language === "ja" ? "未設定" : "未设置")}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={user.isBlocked ? "destructive" : "default"}>
                        {user.isBlocked 
                          ? (language === "ja" ? "ブロック" : "已屏蔽")
                          : (language === "ja" ? "アクティブ" : "活跃")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {language === "ja" ? "登録: " : "注册: "}
                        {format(new Date(user.createdAt), "yyyy/MM/dd")}
                      </div>
                      {user.lastMessageAt && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {language === "ja" ? "最終メッセージ: " : "最后消息: "}
                          {format(new Date(user.lastMessageAt), "yyyy/MM/dd HH:mm")}
                        </div>
                      )}
                      {user.brandId && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          {language === "ja" ? "ブランド: " : "品牌: "}
                          <span className="font-medium">{getBrandName(user.brandId)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openLinkDialog(user as LineUser)}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        {language === "ja" ? "紐付け" : "关联"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          openPersonTalkHistory(user);
                        }}
                      >
                        <History className="h-3 w-3 mr-1" />
                        {language === "ja" ? "全トーク履歴" : "全部聊天记录"}
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user.lineUserId);
                          setShowMessageDialog(true);
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {language === "ja" ? "送信" : "发送"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Livers Tab */}
        <TabsContent value="livers" className="space-y-4">
          {loadingLiverLinked ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ja" ? "読み込み中..." : "加载中..."}
            </div>
          ) : liverLinkedUsers?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "ja" 
                  ? "ライバーと連携されたLINEユーザーがいません。ライバーがLINE連携を完了すると表示されます。" 
                  : "还没有与主播关联的LINE用户。主播完成LINE关联后会显示在这里。"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {liverLinkedUsers?.map((user) => (
                <Card 
                  key={user.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
                  onClick={() => {
                    setSelectedLiverId(user.liverId);
                    setShowLiverInteractionDialog(true);
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {user.liverAvatarUrl ? (
                          <img 
                            src={user.liverAvatarUrl} 
                            alt={user.liverName || "Liver"} 
                            className="w-12 h-12 rounded-full ring-2 ring-primary/20"
                          />
                        ) : user.pictureUrl ? (
                          <img 
                            src={user.pictureUrl} 
                            alt={user.liverName || "User"} 
                            className="w-12 h-12 rounded-full ring-2 ring-primary/20"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                            <Radio className="h-6 w-6 text-primary" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {user.liverName}
                            <Badge variant="default" className="text-xs">
                              <Radio className="h-3 w-3 mr-1" />
                              {language === "ja" ? "ライバー" : "主播"}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {user.liverEmail}
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {language === "ja" ? "LINE登録: " : "LINE注册: "}
                        {format(new Date(user.createdAt), "yyyy/MM/dd")}
                      </div>
                      {user.lastMessageAt && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {language === "ja" ? "最終メッセージ: " : "最后消息: "}
                          {format(new Date(user.lastMessageAt), "yyyy/MM/dd HH:mm")}
                        </div>
                      )}
                      {user.liverTiktokAccount && (
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-3 w-3" />
                          TikTok: @{user.liverTiktokAccount}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPersonTalkHistory({
                            lineUserId: user.lineUserId,
                            displayName: user.liverName,
                            pictureUrl: user.liverAvatarUrl || user.pictureUrl,
                          });
                        }}
                      >
                        <History className="h-3 w-3 mr-1" />
                        {language === "ja" ? "全トーク履歴" : "全部聊天记录"}
                      </Button>
                      <Button 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user.lineUserId);
                          setShowMessageDialog(true);
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {language === "ja" ? "送信" : "发送"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LCJ Official AI Manager Tab */}
        <TabsContent value="ai-managers" className="space-y-5">
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <CardContent className="py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-amber-500 p-2.5 text-white">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{LINE_PUBLIC_CONTACT_NAME}</h3>
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">自動返信</Badge>
                      <Badge variant="outline" className="border-slate-300 bg-white">
                        <ShieldCheck className="mr-1 h-3 w-3" />自動サポート
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-3xl text-sm text-slate-600">
                      LINE連携済みライブコマーサー本人のDMへ、{LINE_PUBLIC_CONTACT_NAME}名義で自然な文体の自動返信を行います。公式LINEが参加中のグループでは、通常返信は連携済み本人が毎回明示的に@LCJした時だけ行います。未連携の参加者には、@LCJ付きのサンプル・取引条件・自動応答に関する質問だけ、安全な定型文で回答します。DM・グループ双方の連絡履歴と実行結果を各人ごとに保存します。継続フォローは各ライブコマーサーで有効化後に全自動です。一般顧客への無条件な自動返信は停止したままです。
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      本人はLINEで「自動返信停止／自動返信再開」「フォロー停止／フォロー再開」と送るだけで設定を変更できます。従来の「AI停止／AI再開」も利用できます。
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
                  <div className="rounded-lg bg-white px-4 py-2 shadow-sm">
                    <div className="text-xl font-bold text-slate-900">{aiManagerData?.stats.total || 0}</div>
                    <div className="text-slate-500">対象</div>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-2 shadow-sm">
                    <div className="text-xl font-bold text-amber-600">{aiManagerData?.stats.queued || 0}</div>
                    <div className="text-slate-500">処理中</div>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-2 shadow-sm">
                    <div className="text-xl font-bold text-emerald-600">{aiManagerData?.stats.sent || 0}</div>
                    <div className="text-slate-500">送信済み</div>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-2 shadow-sm">
                    <div className="text-xl font-bold text-orange-600">{aiManagerData?.stats.unknown || 0}</div>
                    <div className="text-slate-500">送信確認不能</div>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-2 shadow-sm">
                    <div className="text-xl font-bold text-rose-600">{aiManagerData?.stats.failed || 0}</div>
                    <div className="text-slate-500">失敗</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadingAiManagers ? (
            <div className="py-10 text-center text-muted-foreground">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />
              {language === "ja" ? `${LINE_PUBLIC_CONTACT_NAME}の設定を読み込み中...` : `正在加载${LINE_PUBLIC_CONTACT_NAME}的设置...`}
            </div>
          ) : !aiManagerData?.managers.length ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                LINE連携済みのライブコマーサーがまだいません。連携完了後、自動的にここへ表示されます。
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {aiManagerData.managers
                .filter((manager) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return manager.liverName.toLowerCase().includes(query)
                    || manager.lineDisplayName?.toLowerCase().includes(query)
                    || manager.tiktokAccount?.toLowerCase().includes(query);
                })
                .map((manager) => {
                  const insight = manager.tiktokInsight as any;
                  const isUpdating = updateAiManagerMutation.isPending
                    && updateAiManagerMutation.variables?.lineUserId === manager.lineUserId;
                  const isRefreshingTikTok = refreshAiManagerTikTokMutation.isPending
                    && refreshAiManagerTikTokMutation.variables?.lineUserId === manager.lineUserId;
                  return (
                    <Card key={manager.lineUserId} className="overflow-hidden border-l-4 border-l-amber-400">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {(manager.liverAvatarUrl || manager.linePictureUrl) ? (
                              <img
                                src={manager.liverAvatarUrl || manager.linePictureUrl || ""}
                                alt={manager.liverName}
                                className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-amber-200"
                              />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
                                <Bot className="h-6 w-6 text-amber-700" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <CardTitle className="truncate text-base">{manager.liverName}</CardTitle>
                              <CardDescription className="truncate">
                                {manager.lineDisplayName || "LINE表示名なし"}
                                {manager.tiktokAccount ? ` · TikTok ${manager.tiktokAccount}` : ""}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant={manager.replyEnabled ? "default" : "secondary"}>
                            {manager.replyEnabled ? "AI稼働中" : "返信停止"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex items-center justify-between rounded-lg border p-3">
                            <span>
                              <span className="block text-sm font-medium">本人DM・グループ@LCJへ返信</span>
                              <span className="block text-xs text-muted-foreground">LINE連携済み本人のみ</span>
                            </span>
                            <Switch
                              checked={manager.replyEnabled}
                              disabled={isUpdating}
                              onCheckedChange={(replyEnabled) => updateAiManagerMutation.mutate({ lineUserId: manager.lineUserId, replyEnabled })}
                            />
                          </label>
                          <label className="flex items-center justify-between rounded-lg border p-3">
                            <span>
                              <span className="block text-sm font-medium">継続フォロー</span>
                              <span className="block text-xs text-muted-foreground">平日10–18時・最大2回</span>
                            </span>
                            <Switch
                              checked={manager.proactiveEnabled}
                              disabled={isUpdating}
                              onCheckedChange={(proactiveEnabled) => updateAiManagerMutation.mutate({ lineUserId: manager.lineUserId, proactiveEnabled })}
                            />
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="mb-1.5 block text-xs">話し方</Label>
                            <Select
                              value={manager.tone}
                              disabled={isUpdating}
                              onValueChange={(tone: "warm" | "professional" | "energetic") => updateAiManagerMutation.mutate({ lineUserId: manager.lineUserId, tone })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="warm">温かく安心感</SelectItem>
                                <SelectItem value="professional">プロフェッショナル</SelectItem>
                                <SelectItem value="energetic">明るく前向き</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="mb-1.5 block text-xs">未返信フォローまで</Label>
                            <Select
                              value={String(manager.inactivityDays)}
                              disabled={isUpdating}
                              onValueChange={(value) => updateAiManagerMutation.mutate({ lineUserId: manager.lineUserId, inactivityDays: Number(value) })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 5, 7, 14].map(day => <SelectItem key={day} value={String(day)}>{day}日</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3 text-sm">
                          <div className="font-medium text-slate-800">次アクション</div>
                          <div className="mt-1 whitespace-pre-wrap text-slate-600">
                            {manager.nextAction || "次回の会話後にAIが自動記録します"}
                          </div>
                          {manager.lastResponsePreview && (
                            <div className="mt-3 border-t pt-2 text-xs text-slate-500">
                              最新返信: {manager.lastResponsePreview}
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-pink-100 bg-pink-50/50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">TikTok公開情報分析</div>
                              <div className="text-xs text-muted-foreground">
                                {insight?.followerCount != null
                                  ? `フォロワー ${Number(insight.followerCount).toLocaleString()} · 上位投稿 ${insight.topPosts?.length || 0}件`
                                  : manager.tiktokAccount ? "未分析" : "TikTok未登録"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={manager.tiktokAnalysisEnabled}
                                disabled={isUpdating}
                                onCheckedChange={(tiktokAnalysisEnabled) => updateAiManagerMutation.mutate({ lineUserId: manager.lineUserId, tiktokAnalysisEnabled })}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!manager.tiktokAccount || !manager.tiktokAnalysisEnabled || isRefreshingTikTok}
                                onClick={() => refreshAiManagerTikTokMutation.mutate({ lineUserId: manager.lineUserId })}
                              >
                                <RefreshCw className={`mr-1 h-3 w-3 ${isRefreshingTikTok ? "animate-spin" : ""}`} />
                                分析更新
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-slate-200 bg-white hover:bg-slate-50"
                            onClick={() => openPersonTalkHistory({
                              lineUserId: manager.lineUserId,
                              displayName: manager.lineDisplayName || manager.liverName,
                            })}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            {language === "ja" ? "全トーク履歴" : "全部聊天记录"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-amber-200 bg-white hover:bg-amber-50"
                            onClick={() => {
                              setSelectedAiManagerHistoryUserId(manager.lineUserId);
                              setShowAiManagerHistoryDialog(true);
                            }}
                          >
                            <History className="mr-2 h-4 w-4" />
                            {language === "ja" ? "連絡・AI実行履歴" : "联系・AI执行记录"}
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>最終受信: {manager.lastInboundAt ? format(new Date(manager.lastInboundAt), "yyyy/MM/dd HH:mm") : "未開始"}</span>
                          <span>最終返信: {manager.lastReplyAt ? format(new Date(manager.lastReplyAt), "yyyy/MM/dd HH:mm") : "未送信"}</span>
                          <span>最終フォロー: {manager.lastProactiveAt ? format(new Date(manager.lastProactiveAt), "yyyy/MM/dd HH:mm") : "未送信"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
            <div className="flex items-start gap-3">
              <History className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold">
                  {language === "ja" ? "履歴保存・@LCJ返信・会話分析・AI自動追いは既定でONです" : "聊天记录、@LCJ回复、群聊分析和AI自动跟进默认开启"}
                </p>
                <p className="mt-1 text-xs leading-relaxed opacity-85">
                  {language === "ja"
                    ? "公式LINEをグループへ招待した後の新着メッセージを自動保存します。LINE APIの仕様上、招待前の過去メッセージは取得できません。自動返信は連携済みライブコマーサーが明示的に@LCJした時だけです。"
                    : "官方LINE加入群聊后会自动保存新消息。受LINE API限制，加入前的历史消息无法取得。自动回复仅在已关联主播明确@LCJ时触发。"}
                </p>
              </div>
            </div>
          </div>
          {loadingGroups ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ja" ? "読み込み中..." : "加载中..."}
            </div>
          ) : filteredGroups?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "ja" 
                  ? "グループがまだありません。BotをLINEグループに招待すると表示されます。" 
                  : "还没有群组。将Bot邀请到LINE群组后会显示在这里。"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredGroups?.map((group) => (
                <Card 
                  key={group.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedGroup(group);
                    setShowGroupDetailDialog(true);
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {group.pictureUrl ? (
                          <img 
                            src={group.pictureUrl} 
                            alt={group.groupName || "Group"} 
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base">
                            {group.groupName || group.lineGroupId.slice(0, 8) + "..."}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {language === "ja" ? "グループ" : "群组"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={group.isActive ? "default" : "secondary"}>
                        {group.isActive 
                          ? (language === "ja" ? "アクティブ" : "活跃")
                          : (language === "ja" ? "非アクティブ" : "不活跃")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <Users className="h-3 w-3 text-blue-500" />
                        {getGroupMemberCountLabel(group.lineGroupId)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {language === "ja" ? "登録: " : "注册: "}
                        {format(new Date(group.createdAt), "yyyy/MM/dd")}
                      </div>
                      <div className="flex items-center gap-2 text-emerald-600">
                        <History className="h-3 w-3" />
                        <span>{language === "ja" ? "履歴保存: 有効" : "聊天记录: 开启"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bot className={`h-3 w-3 ${group.dailyReportEnabled ? "text-fuchsia-500" : "text-muted-foreground"}`} />
                        <span className={group.dailyReportEnabled ? "text-fuchsia-600" : ""}>
                          {group.dailyReportEnabled
                            ? (language === "ja" ? "SalesDash日報: 受信中" : "SalesDash日报: 接收中")
                            : (language === "ja" ? "SalesDash日報: 停止" : "SalesDash日报: 关闭")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.autoFollowUpEnabled ? (
                          <>
                            <Bell className="h-3 w-3 text-green-500" />
                            <span className="text-green-600">
                              {language === "ja" 
                                ? `自動追いメッセージ: ${group.autoFollowUpDays || 2}日後` 
                                : `自动跟进: ${group.autoFollowUpDays || 2}天后`}
                            </span>
                          </>
                        ) : (
                          <>
                            <BellOff className="h-3 w-3" />
                            <span>{language === "ja" ? "自動追いメッセージ: 無効" : "自动跟进: 关闭"}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {group.autoReplyEnabled !== false ? (
                          <>
                            <MessageSquare className="h-3 w-3 text-blue-500" />
                            <span className="text-blue-600">
                              {language === "ja" ? "@LCJ返信: 有効" : "@LCJ回复: 开启"}
                            </span>
                          </>
                        ) : (
                          <>
                            <MessageSquareOff className="h-3 w-3 text-muted-foreground" />
                            <span>{language === "ja" ? "@LCJ返信: 無効" : "@LCJ回复: 关闭"}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className={`h-3 w-3 ${group.analysisEnabled === true ? "text-violet-500" : "text-muted-foreground"}`} />
                        <span className={group.analysisEnabled === true ? "text-violet-600" : ""}>
                          {group.analysisEnabled === true
                            ? (language === "ja" ? "会話分析: 有効" : "群聊分析: 开启")
                            : (language === "ja" ? "会話分析: 停止" : "群聊分析: 关闭")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bot className={`h-3 w-3 ${group.proactiveAiEnabled ? "text-amber-500" : "text-muted-foreground"}`} />
                        <span className={group.proactiveAiEnabled ? "text-amber-600" : ""}>
                          {group.proactiveAiEnabled
                            ? (language === "ja" ? "AI提案送信: 有効" : "AI提案发送: 开启")
                            : (language === "ja" ? "AI提案送信: 無効" : "AI提案发送: 关闭")}
                        </span>
                      </div>
                      {group.groupInsight?.summary && (
                        <p className="pt-2 line-clamp-2 text-xs text-foreground/80">
                          {group.groupInsight.summary}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroup(group);
                          setGroupMessageText("");
                          groupMessageRequestIdRef.current = null;
                          setShowGroupDetailDialog(true);
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {language === "ja" ? "会話・送信" : "对话・发送"}
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroup(group);
                          setAutoFollowUpEnabled(group.autoFollowUpEnabled !== false);
                          setAutoFollowUpDays(String(group.autoFollowUpDays || 2));
                          setAutoReplyEnabled(group.autoReplyEnabled !== false);
                          setAutoFollowUpMessage(group.autoFollowUpMessage || "");
                          setAnalysisEnabled(group.analysisEnabled !== false);
                          setProactiveAiEnabled(group.proactiveAiEnabled !== false);
                          setDailyReportEnabled(group.dailyReportEnabled === true);
                          setRelationshipObjective(group.relationshipObjective || "");
                          setShowAutoFollowUpDialog(true);
                        }}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        {language === "ja" ? "自動追い" : "自动跟进"}
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLeavingGroupId(group.lineGroupId);
                          setLeavingGroupName(group.groupName || group.lineGroupId.slice(0, 8) + "...");
                          setShowLeaveGroupDialog(true);
                        }}
                      >
                        <LogOut className="h-3 w-3 mr-1" />
                        {language === "ja" ? "退会" : "退出"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Invited-group-only AI reply review queue */}
        <TabsContent value="group-reply-review" className="space-y-4">
          <Suspense fallback={<div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>}>
            <LineGroupReplyReviewQueueContent
              language={language}
              onOpenGroup={openGroupReplyReview}
            />
          </Suspense>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200">
            {language === "ja"
              ? "ここは公式LINEとの1対1トーク履歴です。招待済みグループの返信確認は「グループAI返信確認」で行います。"
              : "这里仅显示与官方LINE的一对一聊天记录。已邀请群组的回复请在“群组AI回复确认”中处理。"}
          </div>
          <div className="flex items-center gap-4 mb-4">
            <Select 
              value={selectedUser || "all"} 
              onValueChange={(v) => setSelectedUser(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={language === "ja" ? "ユーザーを選択" : "选择用户"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "ja" ? "すべてのメッセージ" : "所有消息"}
                </SelectItem>
                {lineUsers?.filter((user) => user.lineUserId).map((user) => (
                  <SelectItem key={user.lineUserId!} value={user.lineUserId!}>
                    {user.displayName || user.lineUserId!.slice(0, 12) + "..."}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingMessages ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ja" ? "読み込み中..." : "加载中..."}
            </div>
          ) : lineMessages?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "ja" 
                  ? "メッセージ履歴がありません" 
                  : "没有消息记录"}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {lineMessages?.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}
                    >
                      <div 
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.direction === "outgoing" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.direction === "outgoing" 
                            ? "text-primary-foreground/70" 
                            : "text-muted-foreground"
                        }`}>
                          {format(new Date(msg.createdAt), "yyyy/MM/dd HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        {/* Follow-ups Tab */}
        <TabsContent value="follow-ups">
          <Suspense fallback={<div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>}>
            <LineFollowUpsContent />
          </Suspense>
        </TabsContent>

        {/* Pending Responses Tab */}
        <TabsContent value="pending">
          <Suspense fallback={<div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>}>
            <PendingResponsesContent />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Per-liver LINE communication and AI execution history */}
      <Dialog open={showAiManagerHistoryDialog} onOpenChange={(open) => {
        setShowAiManagerHistoryDialog(open);
        if (!open) setSelectedAiManagerHistoryUserId(null);
      }}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-amber-600" />
              {aiManagerHistory?.manager.liverName || (language === "ja" ? "連絡・AI実行履歴" : "联系・AI执行记录")}
            </DialogTitle>
            <DialogDescription>
              {aiManagerHistory?.manager.lineDisplayName
                ? `LINE: ${aiManagerHistory.manager.lineDisplayName}`
                : (language === "ja" ? "本人とのLINE連絡とAIの処理結果を確認します" : "查看与本人的LINE联系和AI处理结果")}
            </DialogDescription>
          </DialogHeader>

          {loadingAiManagerHistory ? (
            <div className="flex min-h-[360px] items-center justify-center text-muted-foreground">
              <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
              {language === "ja" ? "履歴を読み込み中..." : "正在加载记录..."}
            </div>
          ) : aiManagerHistoryFailed ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
              <AlertTriangle className="mb-2 h-7 w-7" />
              <div className="font-medium">{language === "ja" ? "履歴を取得できませんでした" : "无法获取记录"}</div>
              <div className="mt-1 text-sm">{aiManagerHistoryError?.message}</div>
              <Button className="mt-4" variant="outline" onClick={() => void refetchAiManagerHistory()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {language === "ja" ? "再読み込み" : "重新加载"}
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="communications" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="communications">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {language === "ja" ? "連絡履歴" : "联系记录"}
                  <Badge variant="secondary" className="ml-2">{aiManagerHistory?.messages.length || 0}</Badge>
                </TabsTrigger>
                <TabsTrigger value="ai-executions">
                  <Activity className="mr-2 h-4 w-4" />
                  {language === "ja" ? "AI実行履歴" : "AI执行记录"}
                  <Badge variant="secondary" className="ml-2">{aiManagerHistory?.aiEvents.length || 0}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="communications" className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-lg border bg-slate-50/60 p-4">
                {aiManagerHistory?.messages.length ? (
                  <div className="space-y-3">
                    {[...aiManagerHistory.messages].reverse().map((message) => (
                      <div key={message.id} className={`flex ${message.direction === "outgoing" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[82%] rounded-xl px-4 py-3 shadow-sm ${
                          message.direction === "outgoing"
                            ? "bg-blue-600 text-white"
                            : "border bg-white text-slate-900"
                        }`}>
                          <div className={`mb-1 flex flex-wrap items-center gap-2 text-xs ${
                            message.direction === "outgoing" ? "text-blue-100" : "text-slate-500"
                          }`}>
                            <span className="font-medium">
                              {message.direction === "outgoing"
                                ? (language === "ja" ? "LCJ公式LINE" : "LCJ官方LINE")
                                : (aiManagerHistory.manager.lineDisplayName || aiManagerHistory.manager.liverName)}
                            </span>
                            <span>·</span>
                            <span>{getLineMessageTypeLabel(message.messageType)}</span>
                            {message.direction === "outgoing" && (
                              <span className={`rounded-full px-2 py-0.5 ${
                                message.responseStatus === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : message.responseStatus === "cancelled"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {message.responseStatus === "pending"
                                  ? (language === "ja" ? "送信処理中" : "发送处理中")
                                  : message.responseStatus === "cancelled"
                                    ? (language === "ja" ? "送信確認不能" : "发送状态不明")
                                    : (language === "ja" ? "送信済み" : "已发送")}
                              </span>
                            )}
                            {message.lineGroupId && (
                              <span className={`rounded-full px-2 py-0.5 ${
                                message.direction === "outgoing" ? "bg-blue-500 text-white" : "bg-amber-100 text-amber-800"
                              }`}>
                                {language === "ja" ? "グループ" : "群组"}: {aiManagerHistory.groupNames[message.lineGroupId] || message.lineGroupId.slice(0, 10)}
                              </span>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap break-words text-sm">
                            {message.content || (language === "ja" ? "（本文なし）" : "（无正文）")}
                          </div>
                          <div className={`mt-1 text-xs ${message.direction === "outgoing" ? "text-blue-100" : "text-slate-400"}`}>
                            {format(new Date(message.createdAt), "yyyy/MM/dd HH:mm")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center text-muted-foreground">
                    <MessageSquare className="mb-2 h-8 w-8" />
                    {language === "ja" ? "この方との連絡履歴はまだありません" : "尚无与此人的联系记录"}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ai-executions" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                {aiManagerHistory?.aiEvents.length ? (
                  <div className="space-y-3">
                    {aiManagerHistory.aiEvents.map((event) => (
                      <div key={event.id} className="rounded-xl border bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 rounded-full p-2 ${getAiHistoryStatusClasses(event.status)}`}>
                              {event.status === "sent" ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : event.status === "failed" ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <Activity className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                                <span>{getAiHistoryTriggerLabel(event.triggerType)}</span>
                                {event.lineGroupId && (
                                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                    {language === "ja" ? "グループ" : "群组"}: {aiManagerHistory.groupNames[event.lineGroupId] || event.lineGroupId.slice(0, 10)}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                開始 {format(new Date(event.createdAt), "yyyy/MM/dd HH:mm")}
                                {event.completedAt ? ` · 完了 ${format(new Date(event.completedAt), "yyyy/MM/dd HH:mm")}` : ""}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className={getAiHistoryStatusClasses(event.status)}>
                            {getAiHistoryStatusLabel(event.status)}
                          </Badge>
                        </div>

                        {event.responseText ? (
                          <div className="mt-3 rounded-lg bg-amber-50 p-3">
                            <div className="mb-1 text-xs font-semibold text-amber-800">
                              {language === "ja" ? "AIが作成した送信内容" : "AI生成的发送内容"}
                            </div>
                            <div className="whitespace-pre-wrap break-words text-sm text-slate-700">{event.responseText}</div>
                          </div>
                        ) : event.status === "sent" ? (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
                            {language === "ja" ? "送信本文は保持期間経過後に削除されています" : "发送正文已在保存期满后删除"}
                          </div>
                        ) : null}

                        {(event.intent || event.nextAction) && (
                          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            {event.intent && (
                              <div className="rounded-lg border p-3">
                                <div className="text-xs font-medium text-muted-foreground">{language === "ja" ? "判断した意図" : "判断意图"}</div>
                                <div className="mt-1 break-words">{event.intent}</div>
                              </div>
                            )}
                            {event.nextAction && (
                              <div className="rounded-lg border p-3">
                                <div className="text-xs font-medium text-muted-foreground">{language === "ja" ? "次アクション" : "下一步行动"}</div>
                                <div className="mt-1 whitespace-pre-wrap break-words">{event.nextAction}</div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
                          {event.model && <span>モデル: {event.model}</span>}
                          <span>試行: {event.attemptCount}回</span>
                          {(event.promptTokens != null || event.completionTokens != null) && (
                            <span>トークン: {Number(event.promptTokens || 0) + Number(event.completionTokens || 0)}</span>
                          )}
                          {event.errorCode && <span className="text-rose-600">コード: {event.errorCode}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border bg-slate-50 text-muted-foreground">
                    <Bot className="mb-2 h-8 w-8" />
                    {language === "ja" ? "AIの実行履歴はまだありません" : "尚无AI执行记录"}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => void refetchAiManagerHistory()} disabled={!selectedAiManagerHistoryUserId || loadingAiManagerHistory}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loadingAiManagerHistory ? "animate-spin" : ""}`} />
              {language === "ja" ? "履歴更新" : "更新记录"}
            </Button>
            <Button onClick={() => setShowAiManagerHistoryDialog(false)}>
              {language === "ja" ? "閉じる" : "关闭"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={(open) => {
        setShowMessageDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ja" ? "メッセージを送信" : "发送消息"}
            </DialogTitle>
            <DialogDescription>
              {language === "ja" 
                ? "LINEでメッセージを送信します" 
                : "通过LINE发送消息"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              className="w-full min-h-[120px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={language === "ja" ? "メッセージを入力..." : "输入消息..."}
              value={messageText}
              disabled={sendingMessage}
              onChange={(e) => {
                setMessageText(e.target.value.slice(0, 5_000));
                directMessageRequestIdRef.current = null;
              }}
            />
            <div className="text-right text-xs text-muted-foreground">{messageText.length.toLocaleString()}/5,000</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>
              {language === "ja" ? "キャンセル" : "取消"}
            </Button>
            <Button 
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendingMessage}
            >
              {sendingMessage ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {language === "ja" ? "送信中..." : "发送中..."}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {language === "ja" ? "送信" : "发送"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link User Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ja" ? "ユーザー紐付け" : "用户关联"}
            </DialogTitle>
            <DialogDescription>
              {language === "ja" 
                ? "LINEユーザーをブランドやユーザータイプに紐付けます" 
                : "将LINE用户关联到品牌或用户类型"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {linkingUser?.pictureUrl ? (
                <img 
                  src={linkingUser.pictureUrl} 
                  alt={linkingUser.displayName || "User"} 
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">{linkingUser?.displayName || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{linkingUser?.lineUserId}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === "ja" ? "ユーザータイプ" : "用户类型"}</Label>
              <Select value={selectedUserType} onValueChange={setSelectedUserType}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ja" ? "タイプを選択" : "选择类型"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">{language === "ja" ? "未設定" : "未设置"}</SelectItem>
                  <SelectItem value="customer">{language === "ja" ? "顧客" : "客户"}</SelectItem>
                  <SelectItem value="liver">{language === "ja" ? "ライバー" : "主播"}</SelectItem>
                  <SelectItem value="staff">{language === "ja" ? "スタッフ" : "员工"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "ja" ? "ブランド" : "品牌"}</Label>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ja" ? "ブランドを選択" : "选择品牌"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{language === "ja" ? "なし" : "无"}</SelectItem>
                  {brands?.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id.toString()}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              {language === "ja" ? "キャンセル" : "取消"}
            </Button>
            <Button 
              onClick={handleLinkUser}
              disabled={linkUserMutation.isPending}
            >
              {linkUserMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {language === "ja" ? "保存中..." : "保存中..."}
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  {language === "ja" ? "保存" : "保存"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto Follow-Up Settings Dialog */}
      <Dialog open={showAutoFollowUpDialog} onOpenChange={setShowAutoFollowUpDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-amber-600" />
              {language === "ja" ? "LCJ公式AIフォロー設定" : "LCJ官方AI跟进设置"}
            </DialogTitle>
            <DialogDescription>
              {language === "ja" 
                ? `「${editingGroup?.groupName || editingGroup?.lineGroupId?.slice(0, 8) + "..."}」で返信・会話分析・自動フォローを管理します`
                : `管理「${editingGroup?.groupName || editingGroup?.lineGroupId?.slice(0, 8) + "..."}」的回复、群聊分析和自动跟进`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {language === "ja" ? "公式LINEをグループへ招待すれば利用できます" : "把官方LINE拉入群后即可使用"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed opacity-80">
                    {language === "ja"
                      ? "会話分析は連携不要で、保存3件目から新着ごとに更新します。実際の自動返信は、連携済みライブコマーサーが明示的に@LCJした場合など既存の安全条件を満たす時だけ送信します。"
                      : "群聊分析无需关联，从保存第3条起会随新消息持续更新；实际AI回复仅在已关联主播明确@LCJ等既有安全条件满足时发送。"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setAutoReplyEnabled(true);
                    setAnalysisEnabled(true);
                    setProactiveAiEnabled(true);
                    setAutoFollowUpEnabled(true);
                  }}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  {language === "ja" ? "まとめてON" : "全部开启"}
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4 dark:border-fuchsia-900 dark:bg-fuchsia-950/20">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="daily-report-enabled" className="flex flex-col gap-1 pr-4">
                  <span>{language === "ja" ? "SalesDashの社員日報をこのグループへ送る" : "把SalesDash员工日报发到这个群"}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {language === "ja"
                      ? "毎朝9:07に、前日分のAI要約と全員の最新日報を1回の配信にまとめます。元の日報は変更しません。"
                      : "每天上午9:07，把前一天的AI总结和大家最新日报合并为一次发送，不修改原日报。"}
                  </span>
                </Label>
                <Switch
                  id="daily-report-enabled"
                  checked={dailyReportEnabled}
                  onCheckedChange={setDailyReportEnabled}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-reply-enabled" className="flex flex-col gap-1">
                <span>{language === "ja" ? "@LCJ返信を有効にする" : "启用@LCJ回复"}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {language === "ja" ? "連携済みライブコマーサーが明示的に@LCJした時だけ返信" : "仅在已关联主播明确@LCJ时回复"}
                </span>
              </Label>
              <Switch id="auto-reply-enabled" checked={autoReplyEnabled} onCheckedChange={setAutoReplyEnabled} />
            </div>
            {autoReplyEnabled && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                {language === "ja"
                  ? `返信文は${LINE_PUBLIC_CONTACT_NAME}名義の自動サポートが、公開LCM商品と保存済みの匿名化インサイトを基に生成します。`
                  : "回复由LCJ官方专属AI经理根据公开LCM商品和已保存的匿名化洞察生成。"}
              </div>
            )}
            <div className="border-t" />
            <div className="flex items-center justify-between">
              <Label htmlFor="group-analysis-enabled" className="flex flex-col gap-1 pr-4">
                <span>{language === "ja" ? "グループ会話を分析" : "分析群聊"}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {language === "ja"
                      ? "既定ON。参加者へ利用目的を案内し、保存会話をサーバー内で有限シグナルへ縮約して分析。不要なグループだけOFFにできます"
                      : "默认开启。请向群成员说明用途；保存的对话仅在服务器内归纳为有限信号。不需要的群可单独关闭"}
                </span>
              </Label>
              <Switch
                id="group-analysis-enabled"
                checked={analysisEnabled}
                onCheckedChange={(checked) => {
                  setAnalysisEnabled(checked);
                  if (!checked) setProactiveAiEnabled(false);
                }}
              />
            </div>
            {analysisEnabled && (
              <div className="space-y-3 rounded-lg bg-violet-50 p-3 dark:bg-violet-950/20">
                <div className="space-y-2">
                  <Label>{language === "ja" ? "関係構築の目標" : "关系建立目标"}</Label>
                  <Textarea
                    value={relationshipObjective}
                    onChange={(event) => setRelationshipObjective(event.target.value)}
                    placeholder={language === "ja"
                      ? "例: 安心して配信相談できる関係をつくり、合うLCM商品を自然に紹介してもらう"
                      : "例：建立安心咨询直播的关系，自然推荐适合的LCM商品"}
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="group-proactive-ai-enabled" className="flex flex-col gap-1">
                    <span>{language === "ja" ? "分析したAI提案を自動追いに使用" : "将AI分析建议用于自动跟进"}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {language === "ja"
                        ? "既定ON。下の自動追いもONで、最新会話から決定済みと判断できた時だけ送信"
                        : "默认开启；仅在下方自动跟进也开启、且最新群聊可判断为已决定时发送"}
                    </span>
                  </Label>
                  <Switch
                    id="group-proactive-ai-enabled"
                    checked={proactiveAiEnabled}
                    onCheckedChange={(checked) => {
                      setProactiveAiEnabled(checked);
                      if (checked) setAutoFollowUpEnabled(true);
                    }}
                  />
                </div>
              </div>
            )}
            <div className="border-t" />
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-followup-enabled" className="flex flex-col gap-1">
                <span>{language === "ja" ? "配信サポートの自動フォローを有効にする" : "启用直播支持自动跟进"}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {language === "ja"
                    ? "AI提案ON時は決定後のみ、OFF時は設定文面を、指定日数新しい会話がなければ1回送信"
                    : "AI建议开启时仅在事项确定后发送；关闭时使用固定文案。指定天数无新对话后只发送一次"}
                </span>
              </Label>
              <Switch
                id="auto-followup-enabled"
                checked={autoFollowUpEnabled}
                onCheckedChange={(checked) => {
                  setAutoFollowUpEnabled(checked);
                  if (!checked) setProactiveAiEnabled(false);
                }}
              />
            </div>

            {autoFollowUpEnabled && (
              <>
                <div className="space-y-2">
                  <Label>{language === "ja" ? "サポート連絡までの日数" : "发送支持消息前等待天数"}</Label>
                  <Select value={autoFollowUpDays} onValueChange={setAutoFollowUpDays}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1{language === "ja" ? "日" : "天"}</SelectItem>
                      <SelectItem value="2">2{language === "ja" ? "日" : "天"}</SelectItem>
                      <SelectItem value="3">3{language === "ja" ? "日" : "天"}</SelectItem>
                      <SelectItem value="5">5{language === "ja" ? "日" : "天"}</SelectItem>
                      <SelectItem value="7">7{language === "ja" ? "日" : "天"}</SelectItem>
                      <SelectItem value="14">14{language === "ja" ? "日" : "天"}</SelectItem>
                      <SelectItem value="30">30{language === "ja" ? "日" : "天"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {language === "ja"
                      ? "グループで新しい会話があれば日数を数え直し、重複送信しません。推奨は1〜2日です。"
                      : "群内出现新对话会重新计时，不会重复发送；建议设为1～2天。"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>
                    {language === "ja" ? "固定メッセージ（AIフォローOFF時のみ）" : "固定消息（仅AI跟进关闭时）"}
                  </Label>
                  <Textarea
                    value={autoFollowUpMessage}
                    onChange={(e) => setAutoFollowUpMessage(e.target.value)}
                    disabled={proactiveAiEnabled}
                    placeholder={language === "ja" 
                      ? "AIフォローON時は、決定事項と最新会話に合わせて配信サポート文案を生成します"
                      : "AI跟进开启时，会根据决定事项和最新群聊生成直播支持文案"}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    {proactiveAiEnabled
                      ? (language === "ja"
                          ? "AI提案を生成できない場合は送信せず、古い提案や定型文へ切り替えません。"
                          : "若无法生成AI建议，则不会发送，也不会改用旧建议或固定文案。")
                      : (language === "ja"
                          ? "空欄の場合のみ、安全な既定文面を送信します。"
                          : "仅在留空时发送安全的默认文案。")}
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoFollowUpDialog(false)}>
              {language === "ja" ? "キャンセル" : "取消"}
            </Button>
            <Button 
              onClick={() => {
                if (editingGroup) {
                  autoFollowUpMutation.mutate({
                    lineGroupId: editingGroup.lineGroupId,
                    autoFollowUpEnabled,
                    autoFollowUpDays: parseInt(autoFollowUpDays),
                    autoFollowUpMessage,
                    autoReplyEnabled,
                    analysisEnabled,
                    proactiveAiEnabled: analysisEnabled && autoFollowUpEnabled && proactiveAiEnabled,
                    dailyReportEnabled,
                    relationshipObjective,
                  });
                }
              }}
              disabled={autoFollowUpMutation.isPending}
            >
              {autoFollowUpMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {language === "ja" ? "保存中..." : "保存中..."}
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  {language === "ja" ? "保存" : "保存"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Detail Dialog */}
      <Dialog open={showGroupDetailDialog} onOpenChange={(open) => {
        setShowGroupDetailDialog(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedGroup?.pictureUrl ? (
                <img 
                  src={selectedGroup.pictureUrl} 
                  alt={selectedGroup.groupName || "Group"} 
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <div>{selectedGroup?.groupName || selectedGroup?.lineGroupId?.slice(0, 8) + "..."}</div>
                <div className="text-sm font-normal text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                    {getGroupMemberCountLabel(selectedGroup?.lineGroupId)}
                  </span>
                  {selectedGroup?.autoFollowUpEnabled ? (
                    <><Bell className="h-3 w-3 text-green-500" />
                    <span className="text-green-600">
                      {language === "ja" ? `自動追い: ${selectedGroup?.autoFollowUpDays || 2}日後` : `自动跟进: ${selectedGroup?.autoFollowUpDays || 2}天后`}
                    </span></>
                  ) : (
                    <><BellOff className="h-3 w-3" />
                    <span>{language === "ja" ? "自動追い: 無効" : "自动跟进: 关闭"}</span></>
                  )}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-background p-4 dark:border-violet-900 dark:from-violet-950/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  {language === "ja" ? "グループAIインサイト" : "群聊AI洞察"}
                  <Badge variant={selectedGroup?.analysisEnabled === true ? "default" : "secondary"}>
                    {selectedGroup?.analysisEnabled === true
                      ? (language === "ja" ? "自動分析ON" : "自动分析ON")
                      : (language === "ja" ? "分析停止" : "分析关闭")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {language === "ja"
                    ? "連携状態に関係なく保存済みグループ会話を分析。DM・売上・内部メモは使用しません。"
                    : "无论是否已关联，均分析已保存群聊；不会使用私聊、销售额或内部备注。"}
                </p>
                <p className="mt-1 text-xs font-medium text-violet-700 dark:text-violet-300">
                  {language === "ja"
                    ? "実際に送った返信と、その後の会話を次回判断の文脈に使うため、グループごとの秘書判断が継続的に具体化します。"
                    : "系统会把实际发送的回复及后续对话用于下一次判断，因此每个群的AI秘书会持续变得更贴合实际。"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedGroup?.lineGroupId || selectedGroup?.analysisEnabled !== true || analyzeGroupMutation.isPending}
                onClick={() => selectedGroup?.lineGroupId && analyzeGroupMutation.mutate({ lineGroupId: selectedGroup.lineGroupId })}
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${analyzeGroupMutation.isPending ? "animate-spin" : ""}`} />
                {language === "ja" ? "分析更新" : "更新分析"}
              </Button>
            </div>

            {selectedGroup?.groupInsight ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{language === "ja" ? "現在の要約" : "当前摘要"}</p>
                    <p className="mt-1 text-sm leading-relaxed">{selectedGroup.groupInsight.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{language === "ja" ? "話題・明示ニーズ" : "话题与明确需求"}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {[...(selectedGroup.groupInsight.topics || []), ...(selectedGroup.groupInsight.explicitNeeds || [])].slice(0, 8).map((item: string, index: number) => (
                        <Badge key={`${item}-${index}`} variant="outline">{item}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{language === "ja" ? "関係づくりの機会" : "关系建立机会"}</p>
                    <p className="mt-1 text-sm">{selectedGroup.groupInsight.relationshipOpportunity}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{language === "ja" ? "公開LCM商品の候補" : "公开LCM商品候选"}</p>
                    {(selectedGroup.groupInsight.productOpportunities || []).length > 0 ? (
                      <div className="mt-1 space-y-2">
                        {selectedGroup.groupInsight.productOpportunities.map((item: any, index: number) => (
                          <div key={`${item.productName}-${index}`} className="rounded-lg border bg-background/80 p-2 text-sm">
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.fitReason}</p>
                            <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">{item.timing}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{language === "ja" ? "今は商品提案より関係づくりを優先" : "当前优先建立关系，不急于推荐商品"}</p>
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">{language === "ja" ? "推奨する次の一歩" : "建议下一步"}</p>
                      {selectedGroup.groupInsight.followUpStage === "post_decision_support" && (
                        <Badge className="bg-sky-600 text-white hover:bg-sky-600">
                          {language === "ja" ? "決定済み → 配信支援" : "已确定 → 直播支持"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm">{selectedGroup.groupInsight.suggestedNextAction}</p>
                  </div>
                </div>
                <div className="md:col-span-2 rounded-lg border bg-background/90 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-muted-foreground">{language === "ja" ? "送信前ドラフト（自動送信OFF時）" : "发送前草稿（自动发送关闭时）"}</p>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setGroupMessageText(selectedGroup.groupInsight.suggestedMessage || "");
                      setGroupAiDraftPendingReview(true);
                      setGroupAiDraftReviewed(false);
                      groupMessageRequestIdRef.current = null;
                    }}>
                      {language === "ja" ? "入力欄へコピー" : "复制到输入框"}
                    </Button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{selectedGroup.groupInsight.suggestedMessage}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {language === "ja"
                      ? `分析: ${selectedGroup.groupInsight.messageCount || 0}件 / 信頼度: ${selectedGroup.groupInsight.confidence || "low"} / ${selectedGroup.groupInsight.analyzedAt ? format(new Date(selectedGroup.groupInsight.analyzedAt), "yyyy/MM/dd HH:mm") : ""}`
                      : `分析: ${selectedGroup.groupInsight.messageCount || 0}条 / 置信度: ${selectedGroup.groupInsight.confidence || "low"}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed bg-background/70 p-4 text-sm text-muted-foreground">
                {selectedGroup?.analysisEnabled === true
                  ? (language === "ja"
                      ? "会話が3件に達すると、連携状況に関係なく自動分析を開始し、その後も新しい会話ごとに更新します。すぐ確認する場合は「分析更新」を押してください。"
                      : "群聊达到3条后，无论是否已关联都会开始自动分析，之后每有新消息都会更新；也可点击“更新分析”立即查看。")
                  : (language === "ja"
                      ? "会話履歴は保存されていますが、自動分析は停止中です。設定から「グループ会話を分析」をONにすると、保存3件目から分析を開始します。"
                      : "群聊记录仍会保存，但自动分析目前已停止；请在设置中开启“分析群聊”，达到3条后开始分析。")}
              </div>
            )}
          </div>
          
          {/* Messages Section */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-600" />
              <span className="font-semibold">{language === "ja" ? "グループ会話履歴" : "群聊历史记录"}</span>
              <Badge variant="secondary">
                {language === "ja"
                  ? `最新${groupMessages?.length || 0}件（最大200件）`
                  : `最近${groupMessages?.length || 0}条（最多200条）`}
              </Badge>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void refetchGroupMessages()} disabled={loadingGroupMessages}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loadingGroupMessages ? "animate-spin" : ""}`} />
              {language === "ja" ? "履歴更新" : "更新记录"}
            </Button>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            {language === "ja"
              ? "公式LINEが参加した後に受信した会話を自動保存します。参加者名を押すと、その人のDM・全グループ横断の全トーク履歴を表示します。参加前の過去メッセージはLINE APIから取得できません。"
              : "自动保存官方LINE加入群聊后收到的消息；点击参与者姓名可查看其私聊及所有群聊的完整记录。官方LINE加入前的历史消息无法通过LINE API取得。"}
          </p>
          <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-muted/30 min-h-[280px] max-h-[420px]">
            {loadingGroupMessages ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : groupMessagesFailed ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-red-700 dark:text-red-300">
                <p>{groupMessagesError?.message || (language === "ja" ? "会話履歴を読み込めませんでした" : "无法加载群聊记录")}</p>
                <Button size="sm" variant="outline" onClick={() => void refetchGroupMessages()}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {language === "ja" ? "再試行" : "重试"}
                </Button>
              </div>
            ) : groupMessages && groupMessages.length > 0 ? (
              <div className="space-y-3">
                {sortLineMessagesChronologically(groupMessages).map((msg) => {
                  const outgoing = msg.direction === "outgoing";
                  const senderName = (msg as any).senderName || "";
                  const isAiMessage = outgoing && senderName.includes("AI");
                  const isAutomaticMessage = outgoing && (
                    isAiMessage ||
                    senderName.includes("自動フォロー") ||
                    String((msg as any).responseSummary || "").includes("自動フォロー")
                  );
                  const isDeliveryPending = outgoing && (msg as any).responseStatus === "pending";
                  const displayedAt = (msg as any).lineTimestamp
                    ? new Date(Number((msg as any).lineTimestamp))
                    : new Date(msg.createdAt);
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${outgoing ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[82%] rounded-xl px-3 py-2 shadow-sm ${
                        outgoing
                          ? isAiMessage ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground"
                          : "bg-background border"
                      }`}>
                        <div className={`mb-1 flex flex-wrap items-center gap-1.5 text-xs font-medium ${
                          outgoing ? "text-white/85" : "text-muted-foreground"
                        }`}>
                          {!outgoing && msg.lineUserId ? (
                            <button
                              type="button"
                              className="rounded-sm text-left font-semibold underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => openPersonTalkHistory({
                                lineUserId: msg.lineUserId,
                                displayName: senderName,
                              })}
                              title={language === "ja" ? "この人の全トーク履歴を表示" : "查看此人的全部聊天记录"}
                            >
                              {senderName || msg.lineUserId.slice(0, 8)}
                            </button>
                          ) : (
                            <span>
                              {outgoing
                                ? (senderName || (language === "ja" ? "LCJ公式LINE" : "LCJ官方LINE"))
                                : (senderName || (language === "ja" ? "参加者" : "群成员"))}
                            </span>
                          )}
                          {isAiMessage && <span className="rounded-full bg-white/20 px-1.5 py-0.5">AI</span>}
                          {outgoing && !isAutomaticMessage && <span className="rounded-full bg-white/20 px-1.5 py-0.5">{language === "ja" ? "手動" : "手动"}</span>}
                          {isAutomaticMessage && <span className="rounded-full bg-white/20 px-1.5 py-0.5">{language === "ja" ? "自動" : "自动"}</span>}
                          {isDeliveryPending && (
                            <span className="rounded-full bg-slate-950/25 px-1.5 py-0.5">
                              {language === "ja" ? "送信未確認" : "发送未确认"}
                            </span>
                          )}
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">{msg.content || (language === "ja" ? "（本文なし）" : "（无正文）")}</div>
                        {(msg as any).responseSummary && outgoing && (
                          <div className="mt-1 text-[11px] text-white/75">{(msg as any).responseSummary}</div>
                        )}
                        <div className={`text-xs mt-1 ${
                          outgoing ? "text-white/70" : "text-muted-foreground"
                        }`}>
                          {format(displayedAt, "yyyy/MM/dd HH:mm")}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={groupMessagesEndRef} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-8 w-8 mr-2" />
                {language === "ja" ? "メッセージがありません" : "暂无消息"}
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                <p>{language === "ja" ? "履歴を確認しながらLCJ公式LINEとして送信" : "查看历史后，以LCJ官方LINE发送"}</p>
                <p className="mt-0.5">
                  {language === "ja"
                    ? "AIは匿名化済みインサイトから文調・次アクション・公開商品IDだけを選び、安全な定型部品で下書きを作成します。自動送信されません。"
                    : "AI仅从匿名化洞察中选择语气、下一步和公开商品ID，再用安全固定文案生成草稿；不会自动发送。"}
                </p>
                <p className="mt-1 font-medium text-amber-700 dark:text-amber-300">
                  {language === "ja"
                    ? "送信前に必ず内容を確認し、必要に応じて修正してから送信してください。"
                    : "发送前请务必检查内容，并在需要时修改后再发送。"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    !selectedGroup?.lineGroupId ||
                    selectedGroup?.analysisEnabled !== true ||
                    loadingGroupMessages ||
                    generateGroupDraftMutation.isPending ||
                    sendMessageMutation.isPending
                  }
                  onClick={() => {
                    if (!selectedGroup?.lineGroupId) return;
                    generateGroupDraftMutation.mutate({
                      lineGroupId: selectedGroup.lineGroupId,
                      currentDraft: groupMessageText.trim() || undefined,
                    });
                  }}
                >
                  {generateGroupDraftMutation.isPending ? (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-violet-600" />
                  )}
                  {language === "ja"
                    ? (groupMessageText.trim() ? "安全なAI文案にする" : "AI文案を作る")
                    : (groupMessageText.trim() ? "转换为安全AI文案" : "AI生成文案")}
                </Button>
                <span className="text-xs text-muted-foreground">{groupMessageText.length.toLocaleString()}/5,000</span>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100">
              <p className="font-semibold">
                {language === "ja" ? "招待時の自動ウェルカム" : "邀请入群时自动欢迎"}
              </p>
              <p className="mt-1 leading-relaxed">
                {language === "ja"
                  ? `LCJ公式アカウントが新規・再参加すると、「${LINE_PUBLIC_CONTACT_NAME}」名義でグループ名「${selectedGroup?.groupName || "未設定"}」をブランド名とした初回案内を送ります。自動サポート利用の注記は初回に1行だけ表示し、@LCJなしの応答は最初の確認2回までです。以後は必ず @LCJ を付けてください。未連携の参加者でも、サンプル・取引条件・自動応答に関する明示質問には安全な定型文で回答します。`
                  : `LCJ官方账号新加入或重新加入时，会以“${LINE_PUBLIC_CONTACT_NAME}”的名义，把群名“${selectedGroup?.groupName || "未设置"}”作为品牌名发送首次问候。自动支持说明只在首次显示一行；无需@LCJ的回复最多限最初2次，之后请务必添加 @LCJ。即使参与者尚未绑定账号，带@LCJ的样品、合作条件或自动回复相关问题也会得到安全的固定答复。`}
              </p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-900 dark:bg-sky-950/20">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
                    {language === "ja" ? "こちらから送る定型文" : "由我们主动发送的模板"}
                  </p>
                  <p className="mt-0.5 text-xs text-sky-800 dark:text-sky-200">
                    {language === "ja"
                      ? `グループ名「${selectedGroup?.groupName || "未設定"}」をブランド名として文面へ入れます。入力欄へ反映するだけで、自動送信されません。`
                      : `将群名“${selectedGroup?.groupName || "未设置"}”作为品牌名写入文案。只会填入输入框，不会自动发送。`}
                  </p>
                </div>
                <Badge variant="outline" className="border-sky-300 bg-white/70 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
                  {language === "ja" ? "送信前に編集できます" : "发送前可编辑"}
                </Badge>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-background"
                  disabled={sendMessageMutation.isPending || generateGroupDraftMutation.isPending}
                  onClick={() => applyGroupManualMessageTemplate("greeting")}
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  {language === "ja" ? "初回あいさつ＋TikTok確認" : "初次问候＋确认TikTok"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-background"
                  disabled={sendMessageMutation.isPending || generateGroupDraftMutation.isPending}
                  onClick={() => applyGroupManualMessageTemplate("sample")}
                >
                  <Building2 className="mr-1.5 h-3.5 w-3.5" />
                  {language === "ja" ? "商品・サンプル確認" : "确认商品和样品"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-background"
                  disabled={sendMessageMutation.isPending || generateGroupDraftMutation.isPending}
                  onClick={() => applyGroupManualMessageTemplate("livestream")}
                >
                  <Radio className="mr-1.5 h-3.5 w-3.5" />
                  {language === "ja" ? "配信・動画予定を確認" : "确认直播或视频计划"}
                </Button>
              </div>
            </div>
            {selectedGroup?.analysisEnabled !== true && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {language === "ja"
                  ? "AI文案を使うには「自動追い設定」で「グループ会話を分析」をONにしてください。"
                  : "使用AI文案前，请在“自动跟进设置”中开启“分析群聊”。"}
              </p>
            )}
            {groupAiDraftPendingReview && (
              <div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${
                groupAiDraftReviewed
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              }`}>
                <span>
                  {groupAiDraftReviewed
                    ? (language === "ja" ? "この内容は確認済みです。編集すると再確認が必要です。" : "当前内容已确认；编辑后需要重新确认。")
                    : (language === "ja" ? "AI文案はまだ送信できません。内容・宛先・商品情報を確認してください。" : "AI文案暂不可发送，请确认内容、对象和商品信息。")}
                </span>
                {!groupAiDraftReviewed && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setGroupAiDraftReviewed(true)}
                  >
                    {language === "ja" ? "内容を確認しました" : "已确认内容"}
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-2">
            <Textarea
              value={groupMessageText}
              disabled={sendMessageMutation.isPending || generateGroupDraftMutation.isPending}
              onChange={(e) => {
                setGroupMessageText(e.target.value.slice(0, 5_000));
                if (groupAiDraftPendingReview) setGroupAiDraftReviewed(false);
                groupMessageRequestIdRef.current = null;
              }}
              placeholder={language === "ja" ? "メッセージを入力..." : "输入消息..."}
              className="flex-1 min-h-[60px] max-h-[100px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSendGroupMessage();
                }
              }}
            />
            <Button
              onClick={handleSendGroupMessage}
              disabled={
                !groupMessageText.trim() ||
                sendMessageMutation.isPending ||
                generateGroupDraftMutation.isPending ||
                (groupAiDraftPendingReview && !groupAiDraftReviewed)
              }
            >
              {sendMessageMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <DialogFooter className="mt-4 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingGroup(selectedGroup);
                setAutoFollowUpEnabled(selectedGroup?.autoFollowUpEnabled !== false);
                setAutoFollowUpDays(String(selectedGroup?.autoFollowUpDays || 2));
                setAutoFollowUpMessage(selectedGroup?.autoFollowUpMessage || "");
                setAutoReplyEnabled(selectedGroup?.autoReplyEnabled !== false);
                setAnalysisEnabled(selectedGroup?.analysisEnabled !== false);
                setProactiveAiEnabled(selectedGroup?.proactiveAiEnabled !== false);
                setDailyReportEnabled(selectedGroup?.dailyReportEnabled === true);
                setRelationshipObjective(selectedGroup?.relationshipObjective || "");
                setShowGroupDetailDialog(false);
                setShowAutoFollowUpDialog(true);
              }}
            >
              <Settings className="h-4 w-4 mr-2" />
              {language === "ja" ? "自動追い設定" : "自动跟进设置"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLeavingGroupId(selectedGroup?.lineGroupId);
                setLeavingGroupName(selectedGroup?.groupName || selectedGroup?.lineGroupId?.slice(0, 8) + "...");
                setShowGroupDetailDialog(false);
                setShowLeaveGroupDialog(true);
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {language === "ja" ? "グループ退会" : "退出群组"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liver Interaction Dialog */}
      <Dialog open={showLiverInteractionDialog} onOpenChange={(open) => {
        setShowLiverInteractionDialog(open);
        if (!open) setSelectedLiverId(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {liverInteraction?.liver?.avatarUrl ? (
                <img 
                  src={liverInteraction.liver.avatarUrl} 
                  alt={liverInteraction.liver.name || "Liver"} 
                  className="w-12 h-12 rounded-full ring-2 ring-primary/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                  <Radio className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  {liverInteraction?.liver?.name || (language === "ja" ? "読み込み中..." : "加载中...")}
                  <Badge variant="default" className="text-xs">
                    <Radio className="h-3 w-3 mr-1" />
                    {language === "ja" ? "ライバー" : "主播"}
                  </Badge>
                </div>
                <div className="text-sm font-normal text-muted-foreground">
                  {liverInteraction?.liver?.email}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loadingLiverInteraction ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : liverInteraction ? (
            <div className="flex-1 overflow-y-auto space-y-6 py-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <MessageSquare className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <div className="text-2xl font-bold">{liverInteraction.messageCount}</div>
                    <div className="text-xs text-muted-foreground">
                      {language === "ja" ? "メッセージ数" : "消息数"}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold">{liverInteraction.livestreamCount}</div>
                    <div className="text-xs text-muted-foreground">
                      {language === "ja" ? "配信回数" : "直播次数"}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <Sparkles className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                    <div className="text-2xl font-bold">
                      {liverInteraction.recentLivestreams?.filter((l: any) => l.aiStructuredAdvice || l.aiAdvice).length || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {language === "ja" ? "AIアドバイス" : "AI建议"}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Messages */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {language === "ja" ? "最近のメッセージ" : "最近消息"}
                </h4>
                {liverInteraction.recentMessages?.length > 0 ? (
                  <div className="border rounded-lg p-4 bg-muted/30 max-h-[200px] overflow-y-auto space-y-2">
                    {liverInteraction.recentMessages.slice(0, 10).map((msg: any) => (
                      <div 
                        key={msg.id} 
                        className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          msg.direction === 'outgoing' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-background border'
                        }`}>
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                          <div className={`text-xs mt-1 ${
                            msg.direction === 'outgoing' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {format(new Date(msg.createdAt), "MM/dd HH:mm")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-4 text-center text-muted-foreground text-sm">
                      {language === "ja" ? "メッセージがありません" : "没有消息"}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Recent Livestreams with AI Advice */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {language === "ja" ? "最近の配信記録" : "最近直播记录"}
                </h4>
                {liverInteraction.recentLivestreams?.length > 0 ? (
                  <div className="space-y-3">
                    {liverInteraction.recentLivestreams.map((livestream: any) => {
                      const advice = livestream.aiStructuredAdvice 
                        ? (typeof livestream.aiStructuredAdvice === 'string' 
                            ? JSON.parse(livestream.aiStructuredAdvice) 
                            : livestream.aiStructuredAdvice)
                        : null;
                      return (
                        <Card key={livestream.id}>
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                   {livestream.livestreamDate 
                                     ? new Date(livestream.livestreamDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' })
                                     : "-"}
                                </span>
                                {(advice || livestream.aiAdvice) && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    AI
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm">
                                {livestream.salesAmount || livestream.gmv ? (
                                  <span className="font-bold text-green-600">
                                    ¥{Number(livestream.salesAmount || livestream.gmv || 0).toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </div>
                            {advice?.summary && (
                              <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2 mt-2">
                                <div className="font-medium text-foreground mb-1">
                                  {language === "ja" ? "AI総評" : "AI总评"}
                                </div>
                                {advice.summary}
                              </div>
                            )}
                            {!advice?.summary && livestream.aiAdvice && (
                              <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2 mt-2 line-clamp-2">
                                {(() => {
                                  try {
                                    let jsonStr = livestream.aiAdvice;
                                    const fb = livestream.aiAdvice.indexOf('{');
                                    const lb = livestream.aiAdvice.lastIndexOf('}');
                                    if (fb !== -1 && lb !== -1 && lb > fb) jsonStr = livestream.aiAdvice.substring(fb, lb + 1);
                                    const p = JSON.parse(jsonStr);
                                    if (p?.summary) return p.summary;
                                  } catch (e) {}
                                  return livestream.aiAdvice;
                                })()}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-4 text-center text-muted-foreground text-sm">
                      {language === "ja" ? "配信記録がありません" : "没有直播记录"}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter className="mt-4">
            {liverInteraction?.lineUser && (
              <Button
                onClick={() => {
                  setSelectedUser(liverInteraction.lineUser.lineUserId);
                  setShowLiverInteractionDialog(false);
                  setShowMessageDialog(true);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                {language === "ja" ? "メッセージを送信" : "发送消息"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Person-wide LINE talk history dialog */}
      <Dialog open={showPersonTalkHistoryDialog} onOpenChange={(open) => {
        setShowPersonTalkHistoryDialog(open);
        if (!open) setSelectedPersonTalkHistory(null);
      }}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <div className="flex min-w-0 items-center gap-3">
                {(personTalkHistoryFirstPage?.person.pictureUrl || selectedPersonTalkHistory?.pictureUrl) ? (
                  <img
                    src={personTalkHistoryFirstPage?.person.pictureUrl || selectedPersonTalkHistory?.pictureUrl || ""}
                    alt={personTalkHistoryFirstPage?.person.displayName || selectedPersonTalkHistory?.displayName || "LINE user"}
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-primary/15"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/15">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <DialogTitle className="truncate text-left">
                    {personTalkHistoryFirstPage?.person.displayName || selectedPersonTalkHistory?.displayName || (language === "ja" ? "LINE参加者" : "LINE参与者")}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-left">
                    {language === "ja" ? "人物別・全トーク履歴" : "按参与者查看全部聊天记录"}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={personTalkHistoryFirstPage?.person.liverId ? "default" : "outline"}>
                  {personTalkHistoryFirstPage?.person.liverId
                    ? (language === "ja" ? "ライブコマーサー連携済み" : "已关联主播")
                    : (language === "ja" ? "未連携参加者" : "未关联参与者")}
                </Badge>
                {personTalkHistoryFirstPage?.person.isBlocked && (
                  <Badge variant="destructive">{language === "ja" ? "ブロック中" : "已屏蔽"}</Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {personTalkHistoryFirstPage && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{language === "ja" ? "全履歴" : "全部记录"}</p>
                <p className="mt-1 text-xl font-semibold">{personTalkHistoryFirstPage.stats.total.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{language === "ja" ? "本人の発言" : "本人消息"}</p>
                <p className="mt-1 text-xl font-semibold">{personTalkHistoryFirstPage.stats.incomingCount.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{language === "ja" ? "LCJからの返信" : "LCJ回复"}</p>
                <p className="mt-1 text-xl font-semibold">{personTalkHistoryFirstPage.stats.outgoingCount.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{language === "ja" ? "参加グループ" : "参与群组"}</p>
                <p className="mt-1 text-xl font-semibold">{personTalkHistoryFirstPage.stats.groupCount.toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              {language === "ja"
                ? "この参加者のDM・全グループでの発言と、本人に紐づくLCJ返信を新しい順に表示します。公式LINE参加前の履歴はLINE APIから取得できません。"
                : "按最新优先显示该参与者在私聊和所有群聊中的发言，以及已关联到本人的LCJ回复；官方LINE加入前的记录无法通过LINE API取得。"}
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={personTalkHistoryQuery.isFetching}
              onClick={() => void personTalkHistoryQuery.refetch()}
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${personTalkHistoryQuery.isFetching && !personTalkHistoryQuery.isFetchingNextPage ? "animate-spin" : ""}`} />
              {language === "ja" ? "更新" : "更新"}
            </Button>
          </div>

          <div className="min-h-[320px] flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-3 sm:p-4">
            {personTalkHistoryQuery.isLoading ? (
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : personTalkHistoryQuery.isError ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-red-700 dark:text-red-300">
                <p>{personTalkHistoryQuery.error?.message || (language === "ja" ? "トーク履歴を読み込めませんでした" : "无法加载聊天记录")}</p>
                <Button size="sm" variant="outline" onClick={() => void personTalkHistoryQuery.refetch()}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {language === "ja" ? "再試行" : "重试"}
                </Button>
              </div>
            ) : personTalkHistoryMessages.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
                <MessageSquare className="mr-2 h-6 w-6" />
                {language === "ja" ? "保存済みトーク履歴がありません" : "暂无已保存的聊天记录"}
              </div>
            ) : (
              <div className="space-y-3">
                {personTalkHistoryMessages.map((message: any) => {
                  const outgoing = message.direction === "outgoing";
                  const displayedAt = message.lineTimestamp
                    ? new Date(Number(message.lineTimestamp))
                    : new Date(message.createdAt);
                  const sourceLabel = message.sourceType === "user"
                    ? "DM"
                    : message.sourceType === "group"
                      ? (personTalkHistoryGroupNames[message.lineGroupId || ""] || (language === "ja" ? "グループ" : "群组"))
                      : (language === "ja" ? "トークルーム" : "聊天室");
                  const messageTypeLabel = message.messageType === "text"
                    ? null
                    : ({ image: language === "ja" ? "画像" : "图片", video: language === "ja" ? "動画" : "视频", audio: language === "ja" ? "音声" : "语音", sticker: language === "ja" ? "スタンプ" : "贴图", file: language === "ja" ? "ファイル" : "文件" } as Record<string, string>)[message.messageType]
                      || message.messageType;
                  return (
                    <div key={message.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] rounded-xl px-3 py-2 shadow-sm ${
                        outgoing ? "bg-primary text-primary-foreground" : "border bg-background"
                      }`}>
                        <div className={`mb-1 flex flex-wrap items-center gap-1.5 text-xs ${
                          outgoing ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}>
                          <Badge variant="outline" className={outgoing ? "border-white/30 bg-white/10 text-white" : "bg-muted/50"}>
                            {sourceLabel}
                          </Badge>
                          <span>{outgoing ? (language === "ja" ? "LCJから返信" : "LCJ回复") : (message.senderName || personTalkHistoryFirstPage?.person.displayName || (language === "ja" ? "本人" : "本人"))}</span>
                          {messageTypeLabel && <span>· {messageTypeLabel}</span>}
                          {outgoing && message.responseStatus === "pending" && (
                            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                              {language === "ja" ? "送信未確認" : "发送未确认"}
                            </Badge>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {message.content || (messageTypeLabel ? `（${messageTypeLabel}）` : (language === "ja" ? "（本文なし）" : "（无正文）"))}
                        </p>
                        <p className={`mt-1 text-xs ${outgoing ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {format(displayedAt, "yyyy/MM/dd HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {personTalkHistoryQuery.hasNextPage && (
                  <div className="flex justify-center pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={personTalkHistoryQuery.isFetchingNextPage}
                      onClick={() => void personTalkHistoryQuery.fetchNextPage()}
                    >
                      {personTalkHistoryQuery.isFetchingNextPage && <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      {language === "ja" ? "さらに古い100件を読み込む" : "加载更早的100条"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {language === "ja"
                ? `${personTalkHistoryMessages.length.toLocaleString()} / ${(personTalkHistoryFirstPage?.stats.total || 0).toLocaleString()}件を表示`
                : `已显示 ${personTalkHistoryMessages.length.toLocaleString()} / ${(personTalkHistoryFirstPage?.stats.total || 0).toLocaleString()} 条`}
            </p>
            <Button type="button" variant="outline" onClick={() => setShowPersonTalkHistoryDialog(false)}>
              {language === "ja" ? "閉じる" : "关闭"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Group Confirmation Dialog */}
      <Dialog open={showLeaveGroupDialog} onOpenChange={setShowLeaveGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {language === "ja" ? "グループ退会の確認" : "确认退出群组"}
            </DialogTitle>
            <DialogDescription>
              {language === "ja" 
                ? `「${leavingGroupName}」から退会しますか？この操作は取り消せません。再度参加するには、グループのメンバーから招待してもらう必要があります。`
                : `确定要退出「${leavingGroupName}」吗？此操作无法撤销。如需重新加入，需要群组成员重新邀请。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveGroupDialog(false)}>
              {language === "ja" ? "キャンセル" : "取消"}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (leavingGroupId) {
                  leaveGroupMutation.mutate({ lineGroupId: leavingGroupId });
                }
              }}
              disabled={leaveGroupMutation.isPending}
            >
              {leaveGroupMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {language === "ja" ? "退会中..." : "退出中..."}
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  {language === "ja" ? "退会する" : "退出"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
