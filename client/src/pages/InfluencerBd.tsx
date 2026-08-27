import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileImage,
  Filter,
  Handshake,
  ImagePlus,
  Loader2,
  MessageCircle,
  MessageSquareReply,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";

const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const PLATFORM_LABELS: Record<string, string> = {
  TikTok: "TikTok",
  Instagram: "Instagram",
  YouTube: "YouTube",
  X: "X",
  LINE: "LINE",
  WeChat: "WeChat",
  other: "其他 / その他",
};

const CHANNEL_LABELS: Record<string, string> = {
  tiktok_dm: "TikTok DM",
  instagram_dm: "Instagram DM",
  email: "Email",
  line: "LINE",
  wechat: "WeChat",
  phone: "电话 / 電話",
  other: "其他 / その他",
};

const STAGE_LABELS: Record<string, { zh: string; ja: string }> = {
  initial_contact: { zh: "初次接触", ja: "初回連絡" },
  follow_up: { zh: "二次跟进", ja: "再フォロー" },
  replied: { zh: "已回复", ja: "返信あり" },
  needs_confirmed: { zh: "需求确认", ja: "ニーズ確認" },
  sample_proposed: { zh: "样品提案", ja: "サンプル提案" },
  sample_sent: { zh: "已寄样", ja: "サンプル発送" },
  negotiating: { zh: "商务洽谈", ja: "商談中" },
  cooperation_confirmed: { zh: "合作确定", ja: "提携確定" },
  rejected: { zh: "拒绝", ja: "お断り" },
  paused: { zh: "暂缓", ja: "保留" },
};

const CREATOR_STATUS_LABELS: Record<string, { zh: string; ja: string }> = {
  potential: { zh: "潜在", ja: "候補" },
  contacting: { zh: "联络中", ja: "連絡中" },
  replied: { zh: "已回复", ja: "返信あり" },
  interested: { zh: "感兴趣", ja: "興味あり" },
  sample: { zh: "样品中", ja: "サンプル進行" },
  negotiating: { zh: "商谈中", ja: "商談中" },
  cooperating: { zh: "合作", ja: "提携中" },
  paused: { zh: "暂缓", ja: "保留" },
  rejected: { zh: "拒绝", ja: "お断り" },
  archived: { zh: "归档", ja: "アーカイブ" },
};

const RESPONSE_LABELS: Record<string, { zh: string; ja: string }> = {
  none: { zh: "未回复", ja: "未返信" },
  neutral: { zh: "中性回复", ja: "通常返信" },
  positive: { zh: "积极回复", ja: "前向きな返信" },
  rejected: { zh: "拒绝", ja: "お断り" },
  follow_up_needed: { zh: "需要跟进", ja: "要フォロー" },
};

function displayDate(value: unknown) {
  if (!value) return "—";
  const text = String(value);
  return text.slice(0, 10).replace(/-/g, "/");
}

function pct(value: unknown) {
  return value == null ? "—" : `${Number(value).toFixed(1)}%`;
}

function numberText(value: unknown) {
  return Number(value || 0).toLocaleString();
}

function statusTone(stage: string) {
  if (["cooperation_confirmed", "sample_sent"].includes(stage)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["replied", "needs_confirmed", "sample_proposed", "negotiating"].includes(stage)) return "bg-blue-50 text-blue-700 border-blue-200";
  if (["rejected", "paused"].includes(stage)) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

const emptyCreator = {
  displayName: "",
  platform: "TikTok" as const,
  handle: "",
  profileUrl: "",
  followerCount: "",
  category: "",
  country: "",
  language: "",
  contactInfo: "",
  ownerStaffId: "",
  ownerStaffName: "",
  status: "potential" as const,
  notes: "",
};

const emptyOutreach = {
  creatorId: "",
  campaignId: "",
  staffId: "",
  staffName: "",
  activityDate: today(),
  channel: "tiktok_dm" as const,
  stage: "initial_contact" as const,
  contactCount: "1",
  responseType: "none" as const,
  replyReceived: false,
  positiveReply: false,
  sampleAdvanced: false,
  cooperationConfirmed: false,
  pitchText: "",
  chatText: "",
  issues: "",
  nextAction: "",
  nextFollowUpDate: "",
  outcomeNotes: "",
};

const emptyCampaign = {
  name: "",
  brandId: "",
  productId: "",
  productNameSnapshot: "",
  coreSellingPoints: "",
  creatorBenefits: "",
  commissionPolicy: "",
  samplePolicy: "",
  targetCreatorProfile: "",
  referenceOpeningScript: "",
  referenceFollowUpScript: "",
  objectionHandling: "",
  status: "draft" as const,
};

export default function InfluencerBd() {
  const { language } = useLanguage();
  const isZh = language === "zh";
  const L = (zh: string, ja: string) => isZh ? zh : ja;
  const utils = trpc.useUtils();

  const [periodStart, setPeriodStart] = useState(() => daysAgo(29));
  const [periodEnd, setPeriodEnd] = useState(today);
  const [staffFilter, setStaffFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [creatorDialogOpen, setCreatorDialogOpen] = useState(false);
  const [creatorEditingId, setCreatorEditingId] = useState<number | undefined>();
  const [creatorForm, setCreatorForm] = useState(emptyCreator);
  const [outreachDialogOpen, setOutreachDialogOpen] = useState(false);
  const [outreachEditingId, setOutreachEditingId] = useState<number | undefined>();
  const [outreachForm, setOutreachForm] = useState(emptyOutreach);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignEditingId, setCampaignEditingId] = useState<number | undefined>();
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedOutreachId, setSelectedOutreachId] = useState<number | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(null);
  const [aiScope, setAiScope] = useState<"personal" | "team" | "campaign">("personal");
  const [analysisFeedback, setAnalysisFeedback] = useState({ rating: "good" as "good" | "bad", comment: "", resultNote: "" });
  const [settingsForm, setSettingsForm] = useState({ lowReplyRatePercent: "5", stagnationDays: "3", minimumContactedCreators: "20", autoAnalysisEnabled: false });

  const bootstrap = trpc.influencerBd.bootstrap.useQuery();
  const actor = bootstrap.data?.actor;
  const isAdmin = Boolean(actor?.isAdmin);
  const listInput = useMemo(() => ({
    periodStart,
    periodEnd,
    ...(isAdmin && staffFilter !== "all" ? { staffId: Number(staffFilter) } : {}),
    ...(campaignFilter !== "all" ? { campaignId: Number(campaignFilter) } : {}),
    ...(stageFilter !== "all" ? { stage: stageFilter as any } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    limit: 300,
    offset: 0,
  }), [periodStart, periodEnd, isAdmin, staffFilter, campaignFilter, stageFilter, search]);

  const dashboard = trpc.influencerBd.dashboard.useQuery({
    periodStart,
    periodEnd,
    ...(isAdmin && staffFilter !== "all" ? { staffId: Number(staffFilter) } : {}),
    ...(campaignFilter !== "all" ? { campaignId: Number(campaignFilter) } : {}),
  });
  const outreach = trpc.influencerBd.listOutreach.useQuery(listInput);
  const creators = trpc.influencerBd.listCreators.useQuery({ search: search.trim() || undefined, ownerStaffId: isAdmin && staffFilter !== "all" ? Number(staffFilter) : undefined, limit: 300, offset: 0 });
  const campaigns = trpc.influencerBd.listCampaigns.useQuery({ includeArchived: false });
  const analyses = trpc.influencerBd.listAnalyses.useQuery({ periodStart, periodEnd, campaignId: campaignFilter !== "all" ? Number(campaignFilter) : undefined, limit: 50 });
  const outreachDetail = trpc.influencerBd.getOutreach.useQuery({ id: selectedOutreachId || 0 }, { enabled: Boolean(selectedOutreachId) });
  const analysisDetail = trpc.influencerBd.getAnalysis.useQuery({ id: selectedAnalysisId || 0 }, { enabled: Boolean(selectedAnalysisId) });
  const audit = trpc.influencerBd.audit.useQuery({ limit: 100 }, { enabled: isAdmin });

  useEffect(() => {
    const settings = dashboard.data?.settings;
    if (!settings) return;
    setSettingsForm({
      lowReplyRatePercent: String(settings.lowReplyRatePercent ?? 5),
      stagnationDays: String(settings.stagnationDays ?? 3),
      minimumContactedCreators: String(settings.minimumContactedCreators ?? 20),
      autoAnalysisEnabled: Boolean(settings.autoAnalysisEnabled),
    });
  }, [dashboard.data?.settings]);

  const invalidateAll = async () => {
    await Promise.all([
      utils.influencerBd.bootstrap.invalidate(),
      utils.influencerBd.listCreators.invalidate(),
      utils.influencerBd.listOutreach.invalidate(),
      utils.influencerBd.listCampaigns.invalidate(),
      utils.influencerBd.dashboard.invalidate(),
      utils.influencerBd.listAnalyses.invalidate(),
      utils.influencerBd.audit.invalidate(),
    ]);
  };

  const saveCreator = trpc.influencerBd.saveCreator.useMutation();
  const saveOutreach = trpc.influencerBd.saveOutreach.useMutation();
  const saveCampaign = trpc.influencerBd.saveCampaign.useMutation();
  const archiveAttachment = trpc.influencerBd.archiveAttachment.useMutation();
  const runAnalysis = trpc.influencerBd.runAnalysis.useMutation();
  const createFeedback = trpc.influencerBd.createAnalysisFeedback.useMutation();
  const updateSettings = trpc.influencerBd.updateSettings.useMutation();

  const openCreator = (row?: any) => {
    setCreatorEditingId(row?.id ? Number(row.id) : undefined);
    setCreatorForm(row ? {
      displayName: row.displayName || "",
      platform: row.platform || "TikTok",
      handle: row.handle || "",
      profileUrl: row.profileUrl || "",
      followerCount: row.followerCount == null ? "" : String(row.followerCount),
      category: row.category || "",
      country: row.country || "",
      language: row.language || "",
      contactInfo: row.contactInfo || "",
      ownerStaffId: row.ownerStaffId ? String(row.ownerStaffId) : "",
      ownerStaffName: row.ownerStaffName || "",
      status: row.status || "potential",
      notes: row.notes || "",
    } : emptyCreator);
    setCreatorDialogOpen(true);
  };

  const openOutreach = (row?: any) => {
    setOutreachEditingId(row?.id ? Number(row.id) : undefined);
    setPendingFiles([]);
    setOutreachForm(row ? {
      creatorId: String(row.creatorId || ""),
      campaignId: row.campaignId ? String(row.campaignId) : "",
      staffId: row.staffId ? String(row.staffId) : "",
      staffName: row.staffName || "",
      activityDate: String(row.activityDate || today()).slice(0, 10),
      channel: row.channel || "tiktok_dm",
      stage: row.stage || "initial_contact",
      contactCount: String(row.contactCount || 1),
      responseType: row.responseType || "none",
      replyReceived: Boolean(row.replyReceived),
      positiveReply: Boolean(row.positiveReply),
      sampleAdvanced: Boolean(row.sampleAdvanced),
      cooperationConfirmed: Boolean(row.cooperationConfirmed),
      pitchText: row.pitchText || "",
      chatText: row.chatText || "",
      issues: row.issues || "",
      nextAction: row.nextAction || "",
      nextFollowUpDate: row.nextFollowUpDate ? String(row.nextFollowUpDate).slice(0, 10) : "",
      outcomeNotes: row.outcomeNotes || "",
    } : { ...emptyOutreach, staffId: actor?.staffId ? String(actor.staffId) : "", staffName: actor?.staffName || actor?.name || "" });
    setOutreachDialogOpen(true);
  };

  const openCampaign = (row?: any) => {
    setCampaignEditingId(row?.id ? Number(row.id) : undefined);
    setCampaignForm(row ? {
      name: row.name || "",
      brandId: row.brandId ? String(row.brandId) : "",
      productId: row.productId ? String(row.productId) : "",
      productNameSnapshot: row.productNameSnapshot || "",
      coreSellingPoints: row.coreSellingPoints || "",
      creatorBenefits: row.creatorBenefits || "",
      commissionPolicy: row.commissionPolicy || "",
      samplePolicy: row.samplePolicy || "",
      targetCreatorProfile: row.targetCreatorProfile || "",
      referenceOpeningScript: row.referenceOpeningScript || "",
      referenceFollowUpScript: row.referenceFollowUpScript || "",
      objectionHandling: row.objectionHandling || "",
      status: row.status || "draft",
    } : emptyCampaign);
    setCampaignDialogOpen(true);
  };

  const submitCreator = async () => {
    try {
      const selectedStaff = bootstrap.data?.staff?.find((item: any) => String(item.id) === creatorForm.ownerStaffId);
      await saveCreator.mutateAsync({
        id: creatorEditingId,
        displayName: creatorForm.displayName,
        platform: creatorForm.platform,
        handle: creatorForm.handle || null,
        profileUrl: creatorForm.profileUrl || null,
        followerCount: creatorForm.followerCount ? Number(creatorForm.followerCount) : null,
        category: creatorForm.category || null,
        country: creatorForm.country || null,
        language: creatorForm.language || null,
        contactInfo: creatorForm.contactInfo || null,
        ownerStaffId: creatorForm.ownerStaffId ? Number(creatorForm.ownerStaffId) : null,
        ownerStaffName: selectedStaff?.name || creatorForm.ownerStaffName || null,
        status: creatorForm.status,
        notes: creatorForm.notes || null,
      });
      toast.success(L("达人资料已保存", "クリエイター情報を保存しました"));
      setCreatorDialogOpen(false);
      await invalidateAll();
    } catch (error: any) {
      toast.error(error.message || L("保存失败", "保存に失敗しました"));
    }
  };

  const uploadScreenshots = async (outreachId: number) => {
    for (const file of pendingFiles) {
      const form = new FormData();
      form.append("outreachId", String(outreachId));
      form.append("file", file);
      const response = await fetch("/api/influencer-bd/chat-screenshot", { method: "POST", credentials: "include", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`[${payload.errorCode || "BD-UPLOAD-FAILED"}] ${payload.error || L("截图上传失败", "スクリーンショットのアップロードに失敗しました")}`);
    }
  };

  const submitOutreach = async () => {
    if (!outreachForm.creatorId) {
      toast.error(L("请选择达人", "クリエイターを選択してください"));
      return;
    }
    setUploading(true);
    try {
      const selectedStaff = bootstrap.data?.staff?.find((item: any) => String(item.id) === outreachForm.staffId);
      const saved: any = await saveOutreach.mutateAsync({
        id: outreachEditingId,
        creatorId: Number(outreachForm.creatorId),
        campaignId: outreachForm.campaignId ? Number(outreachForm.campaignId) : null,
        staffId: outreachForm.staffId ? Number(outreachForm.staffId) : null,
        staffName: selectedStaff?.name || outreachForm.staffName || null,
        activityDate: outreachForm.activityDate,
        channel: outreachForm.channel,
        stage: outreachForm.stage,
        contactCount: Number(outreachForm.contactCount || 1),
        responseType: outreachForm.responseType,
        replyReceived: outreachForm.replyReceived || outreachForm.responseType !== "none",
        positiveReply: outreachForm.positiveReply || outreachForm.responseType === "positive",
        sampleAdvanced: outreachForm.sampleAdvanced,
        cooperationConfirmed: outreachForm.cooperationConfirmed,
        pitchText: outreachForm.pitchText || null,
        chatText: outreachForm.chatText || null,
        issues: outreachForm.issues || null,
        nextAction: outreachForm.nextAction || null,
        nextFollowUpDate: outreachForm.nextFollowUpDate || null,
        outcomeNotes: outreachForm.outcomeNotes || null,
      });
      if (pendingFiles.length) await uploadScreenshots(Number(saved.id));
      toast.success(L("BD进度与聊天证据已保存", "BD進捗とチャット証拠を保存しました"));
      setOutreachDialogOpen(false);
      setPendingFiles([]);
      await invalidateAll();
    } catch (error: any) {
      toast.error(error.message || L("保存失败", "保存に失敗しました"));
    } finally {
      setUploading(false);
    }
  };

  const submitCampaign = async () => {
    try {
      await saveCampaign.mutateAsync({
        id: campaignEditingId,
        name: campaignForm.name,
        brandId: campaignForm.brandId ? Number(campaignForm.brandId) : null,
        productId: campaignForm.productId ? Number(campaignForm.productId) : null,
        productNameSnapshot: campaignForm.productNameSnapshot || null,
        coreSellingPoints: campaignForm.coreSellingPoints || null,
        creatorBenefits: campaignForm.creatorBenefits || null,
        commissionPolicy: campaignForm.commissionPolicy || null,
        samplePolicy: campaignForm.samplePolicy || null,
        targetCreatorProfile: campaignForm.targetCreatorProfile || null,
        referenceOpeningScript: campaignForm.referenceOpeningScript || null,
        referenceFollowUpScript: campaignForm.referenceFollowUpScript || null,
        objectionHandling: campaignForm.objectionHandling || null,
        status: campaignForm.status,
      });
      toast.success(L("推广方案已保存", "プロモーション施策を保存しました"));
      setCampaignDialogOpen(false);
      await invalidateAll();
    } catch (error: any) {
      toast.error(error.message || L("保存失败", "保存に失敗しました"));
    }
  };

  const startAnalysis = async () => {
    try {
      const result = await runAnalysis.mutateAsync({
        scopeType: isAdmin ? aiScope : "personal",
        periodStart,
        periodEnd,
        staffId: isAdmin && staffFilter !== "all" ? Number(staffFilter) : undefined,
        campaignId: campaignFilter !== "all" ? Number(campaignFilter) : undefined,
      });
      setSelectedAnalysisId(Number(result.id));
      await utils.influencerBd.listAnalyses.invalidate();
      toast.success(L("AI分析完成，已保存到历史", "AI分析が完了し、履歴に保存されました"));
    } catch (error: any) {
      await utils.influencerBd.listAnalyses.invalidate();
      toast.error(error.message || L("AI分析失败", "AI分析に失敗しました"));
    }
  };

  const submitFeedback = async () => {
    if (!selectedAnalysisId) return;
    try {
      await createFeedback.mutateAsync({
        analysisId: selectedAnalysisId,
        rating: analysisFeedback.rating,
        comment: analysisFeedback.comment || null,
        implementedActions: [],
        resultNote: analysisFeedback.resultNote || null,
      });
      toast.success(L("反馈已记录，会作为下次分析的参考", "フィードバックを記録し、次回分析の参考にします"));
      setAnalysisFeedback({ rating: "good", comment: "", resultNote: "" });
      await utils.influencerBd.getAnalysis.invalidate({ id: selectedAnalysisId });
      await utils.influencerBd.listAnalyses.invalidate();
    } catch (error: any) {
      toast.error(error.message || L("反馈保存失败", "フィードバック保存に失敗しました"));
    }
  };

  const total: any = dashboard.data?.total || {};
  const funnel = [
    { key: "contacted", label: L("已联络达人", "連絡済み"), value: Number(total.contactedCreators || 0), color: "bg-indigo-600" },
    { key: "replied", label: L("有回复", "返信あり"), value: Number(total.repliedCreators || 0), color: "bg-sky-500" },
    { key: "positive", label: L("积极回复", "前向き返信"), value: Number(total.positiveCreators || 0), color: "bg-cyan-500" },
    { key: "sample", label: L("样品推进", "サンプル進行"), value: Number(total.sampleCreators || 0), color: "bg-amber-500" },
    { key: "cooperating", label: L("合作确定", "提携確定"), value: Number(total.cooperatingCreators || 0), color: "bg-emerald-500" },
  ];
  const maxFunnel = Math.max(1, ...funnel.map(item => item.value));
  const currentAnalysis: any = analysisDetail.data;
  const aiResult: any = currentAnalysis?.result;
  const isLoading = bootstrap.isLoading || dashboard.isLoading || outreach.isLoading || creators.isLoading;

  return (
    <div className="min-h-full bg-slate-50/70">
      <div className="mx-auto max-w-[1680px] space-y-6 p-4 md:p-6 lg:p-8">
        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
          <div className="relative grid gap-6 px-6 py-7 lg:grid-cols-[1.4fr_1fr] lg:px-9">
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_10%,#6366f1_0,transparent_28%),radial-gradient(circle_at_90%_0%,#06b6d4_0,transparent_30%)]" />
            <div className="relative space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                <Sparkles className="h-4 w-4" /> Creator Growth Operations
              </div>
              <h1 className="text-2xl font-bold tracking-tight md:text-4xl">{L("达人BD增长工作台", "クリエイターBD成長ワークスペース")}</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                {L("把每天联络、回复、问题、话术和聊天证据放在同一个地方，用真实数据找出低回复率的原因。", "毎日の連絡・返信・課題・トーク・チャット証拠を一か所に集約し、実データから低返信率の原因を特定します。")}
              </p>
            </div>
            <div className="relative grid grid-cols-2 gap-3 self-end">
              <Button onClick={() => openOutreach()} className="h-12 bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                <Plus className="mr-2 h-4 w-4" />{L("登记今日进度", "今日の進捗を登録")}
              </Button>
              <Button onClick={() => openCreator()} variant="outline" className="h-12 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <UserRoundSearch className="mr-2 h-4 w-4" />{L("新增达人", "クリエイター追加")}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto]">
            <div className="space-y-1.5"><Label>{L("开始日期", "開始日")}</Label><Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{L("结束日期", "終了日")}</Label><Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div>
            {isAdmin && <div className="space-y-1.5"><Label>{L("BD员工", "BD担当者")}</Label><Select value={staffFilter} onValueChange={setStaffFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{L("全部员工", "全担当者")}</SelectItem>{bootstrap.data?.staff?.map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>}
            <div className="space-y-1.5"><Label>{L("推广方案", "プロモーション施策")}</Label><Select value={campaignFilter} onValueChange={setCampaignFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{L("全部方案", "全施策")}</SelectItem>{campaigns.data?.map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <Button variant="outline" className="mt-auto" onClick={() => { dashboard.refetch(); outreach.refetch(); creators.refetch(); analyses.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" />{L("刷新", "更新")}</Button>
          </div>
        </section>

        {dashboard.data?.alerts?.lowReplyRate && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{L("回复率低于设定阈值", "返信率が設定基準を下回っています")}</AlertTitle>
            <AlertDescription>{L(`本期已联络${total.contactedCreators}位达人，回复率${pct(total.replyRate)}。建议在“AI改善”中分析方式、话术、卖点与达人匹配。`, `期間中${total.contactedCreators}名に連絡し、返信率は${pct(total.replyRate)}です。「AI改善」でアプローチ、トーク、訴求点、相性を分析してください。`)}</AlertDescription>
          </Alert>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: L("联络达人", "連絡クリエイター"), value: total.contactedCreators, icon: Users, tone: "text-indigo-600 bg-indigo-50" },
            { label: L("联络次数", "連絡回数"), value: total.contactAttempts, icon: Send, tone: "text-slate-700 bg-slate-100" },
            { label: L("回复达人", "返信あり"), value: total.repliedCreators, icon: MessageSquareReply, tone: "text-sky-600 bg-sky-50" },
            { label: L("积极回复", "前向き返信"), value: total.positiveCreators, icon: TrendingUp, tone: "text-cyan-600 bg-cyan-50" },
            { label: L("样品推进", "サンプル進行"), value: total.sampleCreators, icon: PackageCheck, tone: "text-amber-600 bg-amber-50" },
            { label: L("合作确定", "提携確定"), value: total.cooperatingCreators, icon: Handshake, tone: "text-emerald-600 bg-emerald-50" },
          ].map(item => <Card key={item.label} className="border-slate-200 shadow-sm"><CardContent className="p-4"><div className={`mb-3 inline-flex rounded-xl p-2 ${item.tone}`}><item.icon className="h-5 w-5" /></div><div className="text-2xl font-bold text-slate-950">{numberText(item.value)}</div><div className="text-xs font-medium text-slate-500">{item.label}</div></CardContent></Card>)}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-indigo-600" />{L("达人推进漏斗", "クリエイター進捗ファネル")}</CardTitle><CardDescription>{L("同一达人多次联络只计算一次，避免虚高或稀释回复率。", "同一クリエイターへの複数連絡は1名として集計します。")}</CardDescription></CardHeader>
            <CardContent className="space-y-3">{funnel.map((item, index) => <div key={item.key} className="grid grid-cols-[110px_1fr_55px] items-center gap-3"><div className="text-sm text-slate-600">{item.label}</div><div className="h-8 overflow-hidden rounded-lg bg-slate-100">{item.value > 0 && <div className={`flex h-full items-center rounded-lg px-3 text-xs font-semibold text-white transition-all ${item.color}`} style={{ width: `${Math.max(10, (item.value / maxFunnel) * 100)}%` }}>{index > 0 && funnel[index - 1].value > 0 ? `${((item.value / funnel[index - 1].value) * 100).toFixed(1)}%` : ""}</div>}</div><div className="text-right text-lg font-bold">{item.value}</div></div>)}</CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle>{L("回复质量", "返信品質")}</CardTitle><CardDescription>{L("基于去重达人计算", "ユニーククリエイター基準")}</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4"><div className="rounded-2xl bg-indigo-50 p-5"><div className="text-sm text-indigo-700">{L("回复率", "返信率")}</div><div className="mt-2 text-3xl font-bold text-indigo-950">{pct(total.replyRate)}</div></div><div className="rounded-2xl bg-emerald-50 p-5"><div className="text-sm text-emerald-700">{L("积极回复率", "前向き返信率")}</div><div className="mt-2 text-3xl font-bold text-emerald-950">{pct(total.positiveReplyRate)}</div></div><div className="col-span-2 flex items-center justify-between rounded-xl border border-slate-200 p-4"><span className="text-sm text-slate-600">{L("超过设定天数未推进", "設定日数以上進展なし")}</span><Badge variant={Number(dashboard.data?.alerts?.stagnantCreators || 0) > 0 ? "destructive" : "secondary"}>{numberText(dashboard.data?.alerts?.stagnantCreators)}</Badge></div></CardContent>
          </Card>
        </section>

        <Tabs defaultValue="today" className="space-y-5">
          <TabsList className="h-auto flex-wrap justify-start rounded-xl bg-slate-200/70 p-1">
            <TabsTrigger value="today">{L("今日进度", "今日の進捗")}</TabsTrigger>
            <TabsTrigger value="creators">{L("达人库", "クリエイター一覧")}</TabsTrigger>
            <TabsTrigger value="campaigns">{L("推广方案", "プロモーション施策")}</TabsTrigger>
            <TabsTrigger value="ai">{L("AI改善", "AI改善")}</TabsTrigger>
            {isAdmin && <TabsTrigger value="management">{L("管理视图", "管理ビュー")}</TabsTrigger>}
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            <Card className="border-slate-200 shadow-sm"><CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle>{L("BD进度记录", "BD進捗記録")}</CardTitle><CardDescription>{L("每一条记录都保留话术、问题、下一步和聊天证据。", "各記録にトーク、課題、次アクション、チャット証拠を保存します。")}</CardDescription></div><Button onClick={() => openOutreach()}><Plus className="mr-2 h-4 w-4" />{L("新增进度", "進捗を追加")}</Button></CardHeader><CardContent>
              <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder={L("搜索达人、员工、问题或下一步", "クリエイター・担当者・課題・次アクションを検索")} /></div><Select value={stageFilter} onValueChange={setStageFilter}><SelectTrigger><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{L("全部阶段", "全ステージ")}</SelectItem>{Object.entries(STAGE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{isZh ? label.zh : label.ja}</SelectItem>)}</SelectContent></Select></div>
              {isLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div> : !outreach.data?.length ? <EmptyState icon={ClipboardList} title={L("所选期间还没有真实BD进度", "選択期間に実際のBD進捗はありません")} description={L("点击“新增进度”登记，不会自动生成演示数据。", "「進捗を追加」から登録してください。デモデータは自動生成しません。")}/> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">{L("日期", "日付")}</th><th className="px-3 py-3">{L("达人", "クリエイター")}</th><th className="px-3 py-3">{L("BD员工", "担当者")}</th><th className="px-3 py-3">{L("方案", "施策")}</th><th className="px-3 py-3">{L("阶段", "ステージ")}</th><th className="px-3 py-3">{L("回复", "返信")}</th><th className="px-3 py-3">{L("问题与下一步", "課題と次アクション")}</th><th className="px-3 py-3">{L("证据", "証拠")}</th><th className="px-3 py-3"></th></tr></thead><tbody>{outreach.data.map((row: any) => <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50"><td className="px-3 py-4 text-slate-500">{displayDate(row.activityDate)}</td><td className="px-3 py-4"><button className="text-left font-semibold text-slate-950 hover:text-indigo-600" onClick={() => setSelectedOutreachId(Number(row.id))}>{row.creatorName}</button><div className="text-xs text-slate-500">{row.platform}{row.handle ? ` · @${row.handle}` : ""}</div></td><td className="px-3 py-4">{row.staffName || "—"}</td><td className="px-3 py-4 max-w-[180px] truncate">{row.campaignName || L("未指定", "未指定")}</td><td className="px-3 py-4"><Badge variant="outline" className={statusTone(row.stage)}>{isZh ? STAGE_LABELS[row.stage]?.zh : STAGE_LABELS[row.stage]?.ja}</Badge></td><td className="px-3 py-4"><span className={row.positiveReply ? "font-semibold text-emerald-600" : row.replyReceived ? "text-sky-600" : "text-slate-500"}>{isZh ? RESPONSE_LABELS[row.responseType]?.zh : RESPONSE_LABELS[row.responseType]?.ja}</span></td><td className="max-w-[300px] px-3 py-4"><div className="line-clamp-2 text-slate-700">{row.issues || L("未登记问题", "課題未登録")}</div><div className="mt-1 line-clamp-1 text-xs text-indigo-600">{row.nextAction || L("未登记下一步", "次アクション未登録")}</div></td><td className="px-3 py-4"><Badge variant="secondary"><FileImage className="mr-1 h-3 w-3" />{Number(row.attachmentCount || 0)}</Badge></td><td className="px-3 py-4"><Button variant="ghost" size="sm" onClick={() => openOutreach(row)}><Pencil className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="creators" className="space-y-4">
            <Card className="border-slate-200 shadow-sm"><CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle>{L("达人资料库", "クリエイターデータベース")}</CardTitle><CardDescription>{L("负责人、平台、粉丝量、类目和最近联络统一管理。", "担当者、プラットフォーム、フォロワー、カテゴリ、最終連絡を一元管理します。")}</CardDescription></div><Button onClick={() => openCreator()}><Plus className="mr-2 h-4 w-4" />{L("新增达人", "クリエイター追加")}</Button></CardHeader><CardContent>{!creators.data?.length ? <EmptyState icon={UserRoundSearch} title={L("尚未登记达人", "クリエイター未登録")} description={L("请从实际BD名单开始登记，不会填充虚假达人。", "実際のBDリストから登録してください。架空データは追加しません。")}/> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{creators.data.map((creator: any) => <div key={creator.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-slate-950">{creator.displayName}</div><div className="text-xs text-slate-500">{PLATFORM_LABELS[creator.platform]}{creator.handle ? ` · @${creator.handle}` : ""}</div></div><Badge variant="outline">{isZh ? CREATOR_STATUS_LABELS[creator.status]?.zh : CREATOR_STATUS_LABELS[creator.status]?.ja}</Badge></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">{L("粉丝", "フォロワー")}</span><div className="mt-1 font-semibold">{creator.followerCount == null ? "—" : numberText(creator.followerCount)}</div></div><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">{L("进度记录", "進捗記録")}</span><div className="mt-1 font-semibold">{numberText(creator.outreachCount)}</div></div></div><div className="mt-3 text-sm text-slate-600">{creator.category || L("类目未登记", "カテゴリ未登録")}</div><div className="mt-1 text-xs text-slate-500">{L("负责人", "担当")}: {creator.ownerStaffName || "—"} · {L("最近联络", "最終連絡")}: {displayDate(creator.lastContactAt)}</div><div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => openCreator(creator)}><Pencil className="mr-1 h-3.5 w-3.5" />{L("编辑", "編集")}</Button>{creator.profileUrl && <Button size="sm" variant="ghost" asChild><a href={creator.profileUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" />Profile</a></Button>}</div></div>)}</div>}</CardContent></Card>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            <Card className="border-slate-200 shadow-sm"><CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle>{L("推广方案与达人利益点", "プロモーション施策とクリエイターメリット")}</CardTitle><CardDescription>{L("把产品卖点、达人收益、样品条件和标准话术先写清楚，AI才有可靠依据。", "商品訴求、クリエイターメリット、サンプル条件、標準トークを明確にし、AIの根拠にします。")}</CardDescription></div>{isAdmin && <Button onClick={() => openCampaign()}><Plus className="mr-2 h-4 w-4" />{L("新增方案", "施策を追加")}</Button>}</CardHeader><CardContent>{!campaigns.data?.length ? <EmptyState icon={Target} title={L("尚未建立推广方案", "プロモーション施策がありません")} description={L("管理员可从真实品牌商品中选择，并登记实际卖点与政策。", "管理者は実在するブランド商品を選択し、実際の訴求点と条件を登録できます。")}/> : <div className="grid gap-4 lg:grid-cols-2">{campaigns.data.map((campaign: any) => <div key={campaign.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-lg font-bold text-slate-950">{campaign.name}</div><div className="text-sm text-slate-500">{campaign.productNameSnapshot || L("未关联商品", "商品未連携")}</div></div><Badge className={campaign.status === "active" ? "bg-emerald-600" : "bg-slate-500"}>{campaign.status}</Badge></div><div className="mt-4 grid gap-3"><InfoBlock title={L("核心卖点", "主要な訴求点")} text={campaign.coreSellingPoints} /><InfoBlock title={L("达人利益", "クリエイターメリット")} text={campaign.creatorBenefits} /><div className="grid grid-cols-2 gap-3"><InfoBlock title={L("佣金政策", "報酬条件")} text={campaign.commissionPolicy} /><InfoBlock title={L("样品政策", "サンプル条件")} text={campaign.samplePolicy} /></div></div>{isAdmin && <Button className="mt-4" size="sm" variant="outline" onClick={() => openCampaign(campaign)}><Pencil className="mr-1 h-3.5 w-3.5" />{L("编辑方案", "施策を編集")}</Button>}</div>)}</div>}</CardContent></Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-5">
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-950 to-slate-950 text-white shadow-lg"><CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_1fr]"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-400/15 px-3 py-1 text-xs font-semibold text-indigo-200"><Brain className="h-4 w-4" /> Gemini 3 Flash · {L("按需分析", "オンデマンド分析")}</div><h2 className="text-2xl font-bold">{L("让AI找出低回复率的根本原因", "AIで低返信率の根本原因を特定")}</h2><p className="mt-3 text-sm leading-6 text-slate-300">{L("AI会读取所选期间的真实漏斗、卖点、话术、问题、聊天文字与最多8张截图。证据不足时必须明确说明，不会把推测写成事实。", "選択期間の実ファネル、訴求点、トーク、課題、チャット本文、最大8枚の画像を分析します。証拠不足は明記し、推測を事実として扱いません。")}</p></div><div className="space-y-3 rounded-2xl bg-white/10 p-4">{isAdmin && <div><Label className="text-slate-200">{L("分析范围", "分析範囲")}</Label><Select value={aiScope} onValueChange={(value: any) => setAiScope(value)}><SelectTrigger className="mt-1 border-white/20 bg-white text-slate-950"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="personal">{L("所选员工", "選択した担当者")}</SelectItem><SelectItem value="team">{L("团队整体", "チーム全体")}</SelectItem><SelectItem value="campaign">{L("推广方案", "施策別")}</SelectItem></SelectContent></Select></div>}<Button className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={startAnalysis} disabled={runAnalysis.isPending}><Sparkles className="mr-2 h-4 w-4" />{runAnalysis.isPending ? L("正在分析真实数据…", "実データを分析中…") : L("开始AI分析", "AI分析を開始")}</Button><p className="text-xs text-slate-400">{L("每次运行都会保存模型、证据快照、结果或错误记录。", "実行ごとにモデル、証拠スナップショット、結果またはエラーを保存します。")}</p></div></CardContent></Card>

            <div className="grid gap-5 xl:grid-cols-[360px_1fr]"><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base">{L("分析历史", "分析履歴")}</CardTitle></CardHeader><CardContent className="space-y-2">{!analyses.data?.length ? <div className="py-10 text-center text-sm text-slate-500">{L("还没有AI分析记录", "AI分析履歴はありません")}</div> : analyses.data.map((item: any) => <button key={item.id} onClick={() => setSelectedAnalysisId(Number(item.id))} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedAnalysisId === Number(item.id) ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{displayDate(item.periodStart)}–{displayDate(item.periodEnd)}</span><Badge variant={item.status === "success" ? "default" : item.status === "failed" ? "destructive" : "secondary"}>{item.status}</Badge></div><div className="mt-1 line-clamp-2 text-xs text-slate-500">{item.summary || item.errorCode || L("处理中", "処理中")}</div><div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400"><span>{item.model}</span><span>·</span><span>{item.requestedByName}</span></div></button>)}</CardContent></Card>
              <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>{L("AI诊断结果", "AI診断結果")}</CardTitle><CardDescription>{L("建议必须经过团队判断，AI不会自动修改真实BD结果。", "提案はチームで判断し、AIが実績データを自動変更することはありません。")}</CardDescription></CardHeader><CardContent>{!selectedAnalysisId ? <EmptyState icon={Brain} title={L("请选择历史记录或开始新分析", "履歴を選択するか新規分析を実行してください")} description={L("分析结果、话术和行动项会显示在这里。", "分析結果、トーク、アクションがここに表示されます。")}/> : analysisDetail.isLoading ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : !aiResult ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{currentAnalysis?.errorCode || L("分析未完成", "分析未完了")}</AlertTitle><AlertDescription>{currentAnalysis?.errorMessage || L("请查看错误后重试。", "エラーを確認して再実行してください。")}</AlertDescription></Alert> : <div className="space-y-6"><div className="rounded-2xl bg-indigo-50 p-5"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Executive summary</span><Badge variant="outline">{aiResult.confidence}</Badge></div><p className="leading-7 text-indigo-950">{aiResult.executiveSummary}</p></div><section><h3 className="mb-3 font-semibold">{L("根本原因", "根本原因")}</h3><div className="grid gap-3 md:grid-cols-2">{aiResult.rootCauses?.map((cause: any, index: number) => <div key={index} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><Badge variant="secondary">{cause.category}</Badge><span className="text-xs text-slate-500">{cause.confidence}</span></div><div className="mt-3 font-medium">{cause.finding}</div><div className="mt-2 text-sm text-slate-500">{cause.evidence}</div></div>)}</div></section><section><h3 className="mb-3 font-semibold">{L("优先行动", "優先アクション")}</h3><div className="space-y-2">{aiResult.recommendedActions?.map((action: any, index: number) => <div key={index} className="flex gap-3 rounded-xl border border-slate-200 p-4"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">{index + 1}</div><div><div className="font-medium">{action.action}</div><div className="mt-1 text-sm text-slate-500">{action.reason}</div><div className="mt-2 text-xs font-medium text-emerald-700">{L("完成标准", "完了基準")}: {action.completionStandard}</div></div></div>)}</div></section><section className="grid gap-3 lg:grid-cols-3">{[["opening",L("初次联络", "初回連絡")],["followUp",L("二次跟进", "再フォロー")],["objectionResponse",L("异议回应", "反論対応")]].map(([key,title]) => <div key={key} className="rounded-xl border border-slate-200 p-4"><div className="font-semibold">{title}</div><Separator className="my-3" /><div className="text-xs font-semibold text-slate-500">中文</div><p className="mt-1 whitespace-pre-wrap text-sm">{aiResult.messageScripts?.[key]?.zh}</p><div className="mt-4 text-xs font-semibold text-slate-500">日本語</div><p className="mt-1 whitespace-pre-wrap text-sm">{aiResult.messageScripts?.[key]?.ja}</p></div>)}</section><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">{L("这条建议有帮助吗？", "この提案は役立ちましたか？")}</h3><div className="mt-3 flex gap-2"><Button size="sm" variant={analysisFeedback.rating === "good" ? "default" : "outline"} onClick={() => setAnalysisFeedback(value => ({ ...value, rating: "good" }))}><ThumbsUp className="mr-1 h-4 w-4" />{L("有帮助", "役立った")}</Button><Button size="sm" variant={analysisFeedback.rating === "bad" ? "destructive" : "outline"} onClick={() => setAnalysisFeedback(value => ({ ...value, rating: "bad" }))}><ThumbsDown className="mr-1 h-4 w-4" />{L("需改善", "改善が必要")}</Button></div><Textarea className="mt-3" value={analysisFeedback.comment} onChange={e => setAnalysisFeedback(value => ({ ...value, comment: e.target.value }))} placeholder={L("哪里有帮助，哪里不准确？", "役立った点、不正確だった点")}/><Textarea className="mt-3" value={analysisFeedback.resultNote} onChange={e => setAnalysisFeedback(value => ({ ...value, resultNote: e.target.value }))} placeholder={L("实际执行后的结果（可稍后补充）", "実施後の結果（後から追記可）")}/><Button className="mt-3" onClick={submitFeedback} disabled={createFeedback.isPending}>{L("保存反馈", "フィードバックを保存")}</Button></section></div>}</CardContent></Card></div>
          </TabsContent>

          {isAdmin && <TabsContent value="management" className="space-y-5"><div className="grid gap-5 xl:grid-cols-2"><BreakdownCard title={L("员工表现", "担当者別実績")} rows={dashboard.data?.byStaff || []} labelKey="staffName" L={L} /><BreakdownCard title={L("渠道表现", "チャネル別実績")} rows={dashboard.data?.byChannel || []} labelKey="channel" L={L} /></div><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" />{L("分析提醒设置", "分析アラート設定")}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-4"><div><Label>{L("低回复率阈值(%)", "低返信率しきい値(%)")}</Label><Input type="number" value={settingsForm.lowReplyRatePercent} onChange={e => setSettingsForm(value => ({ ...value, lowReplyRatePercent: e.target.value }))}/></div><div><Label>{L("无进展天数", "停滞日数")}</Label><Input type="number" value={settingsForm.stagnationDays} onChange={e => setSettingsForm(value => ({ ...value, stagnationDays: e.target.value }))}/></div><div><Label>{L("最小联络达人数", "最小連絡人数")}</Label><Input type="number" value={settingsForm.minimumContactedCreators} onChange={e => setSettingsForm(value => ({ ...value, minimumContactedCreators: e.target.value }))}/></div><div className="flex items-end"><Button className="w-full" onClick={async () => { try { await updateSettings.mutateAsync({ lowReplyRatePercent: Number(settingsForm.lowReplyRatePercent), stagnationDays: Number(settingsForm.stagnationDays), minimumContactedCreators: Number(settingsForm.minimumContactedCreators), autoAnalysisEnabled: settingsForm.autoAnalysisEnabled }); toast.success(L("设置已保存", "設定を保存しました")); await invalidateAll(); } catch (error: any) { toast.error(error.message); } }}>{L("保存设置", "設定保存")}</Button></div><div className="md:col-span-4 flex items-center gap-3 rounded-xl bg-slate-50 p-4"><Checkbox checked={settingsForm.autoAnalysisEnabled} onCheckedChange={value => setSettingsForm(current => ({ ...current, autoAnalysisEnabled: Boolean(value) }))}/><div><div className="text-sm font-medium">{L("允许自动AI分析", "自動AI分析を許可")}</div><div className="text-xs text-slate-500">{L("首版默认关闭。开启后仍需后台规则触发；当前不会自动消耗积分。", "初期値はOFFです。有効化しても現在は自動実行せず、ルール実装時の許可設定として保存します。")}</div></div></div></CardContent></Card><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>{L("操作审计", "操作監査")}</CardTitle><CardDescription>{L("保存新增、修改、截图、AI分析和设置变更；聊天正文不会在审计列表展开。", "作成・更新・画像・AI分析・設定変更を保存し、チャット本文は監査一覧に展開しません。")}</CardDescription></CardHeader><CardContent><div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500"><th className="p-2">{L("时间", "日時")}</th><th className="p-2">{L("实体", "対象")}</th><th className="p-2">{L("操作", "操作")}</th><th className="p-2">{L("操作者", "実行者")}</th><th className="p-2">{L("原因", "理由")}</th></tr></thead><tbody>{audit.data?.map((row: any) => <tr key={row.id} className="border-b border-slate-100"><td className="p-2 text-slate-500">{new Date(row.createdAt).toLocaleString()}</td><td className="p-2">{row.entityType} #{row.entityId || "—"}</td><td className="p-2 font-medium">{row.action}</td><td className="p-2">{row.actorName}</td><td className="p-2 text-slate-500">{row.reason || "—"}</td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>}
        </Tabs>
      </div>

      <Dialog open={creatorDialogOpen} onOpenChange={setCreatorDialogOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{creatorEditingId ? L("编辑达人", "クリエイター編集") : L("新增达人", "クリエイター追加")}</DialogTitle><DialogDescription>{L("只登记实际名单中可确认的信息，未知字段可留空。", "実際のリストで確認できる情報のみ登録し、不明項目は空欄にしてください。")}</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><Field label={L("达人名称*", "表示名*")}><Input value={creatorForm.displayName} onChange={e => setCreatorForm(v => ({ ...v, displayName: e.target.value }))}/></Field><Field label={L("平台", "プラットフォーム")}><Select value={creatorForm.platform} onValueChange={(value: any) => setCreatorForm(v => ({ ...v, platform: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PLATFORM_LABELS).map(([key,label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></Field><Field label={L("账号ID", "アカウントID")}><Input value={creatorForm.handle} onChange={e => setCreatorForm(v => ({ ...v, handle: e.target.value }))} placeholder="@creator"/></Field><Field label={L("主页URL", "プロフィールURL")}><Input value={creatorForm.profileUrl} onChange={e => setCreatorForm(v => ({ ...v, profileUrl: e.target.value }))}/></Field><Field label={L("粉丝数", "フォロワー数")}><Input type="number" value={creatorForm.followerCount} onChange={e => setCreatorForm(v => ({ ...v, followerCount: e.target.value }))}/></Field><Field label={L("内容类目", "コンテンツカテゴリ")}><Input value={creatorForm.category} onChange={e => setCreatorForm(v => ({ ...v, category: e.target.value }))}/></Field><Field label={L("国家/地区", "国・地域")}><Input value={creatorForm.country} onChange={e => setCreatorForm(v => ({ ...v, country: e.target.value }))}/></Field><Field label={L("语言", "言語")}><Input value={creatorForm.language} onChange={e => setCreatorForm(v => ({ ...v, language: e.target.value }))}/></Field>{isAdmin && <Field label={L("负责人", "担当者")}><Select value={creatorForm.ownerStaffId || "none"} onValueChange={value => setCreatorForm(v => ({ ...v, ownerStaffId: value === "none" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{L("未分配", "未割当")}</SelectItem>{bootstrap.data?.staff?.map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>}<Field label={L("状态", "ステータス")}><Select value={creatorForm.status} onValueChange={(value: any) => setCreatorForm(v => ({ ...v, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CREATOR_STATUS_LABELS).filter(([key]) => key !== "archived").map(([key,label]) => <SelectItem key={key} value={key}>{isZh ? label.zh : label.ja}</SelectItem>)}</SelectContent></Select></Field><div className="md:col-span-2"><Field label={L("联系方式", "連絡先")}><Textarea value={creatorForm.contactInfo} onChange={e => setCreatorForm(v => ({ ...v, contactInfo: e.target.value }))}/></Field></div><div className="md:col-span-2"><Field label={L("备注", "メモ")}><Textarea value={creatorForm.notes} onChange={e => setCreatorForm(v => ({ ...v, notes: e.target.value }))}/></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setCreatorDialogOpen(false)}>{L("取消", "キャンセル")}</Button><Button onClick={submitCreator} disabled={saveCreator.isPending || !creatorForm.displayName.trim()}>{saveCreator.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{L("保存达人", "保存")}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={outreachDialogOpen} onOpenChange={setOutreachDialogOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{outreachEditingId ? L("编辑BD进度", "BD進捗編集") : L("登记BD进度", "BD進捗登録")}</DialogTitle><DialogDescription>{L("联络结果、问题、话术与聊天证据会一起保存，刷新或重启后不会消失。", "連絡結果、課題、トーク、チャット証拠を一緒に保存します。")}</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><Field label={L("达人*", "クリエイター*")}><Select value={outreachForm.creatorId || "none"} onValueChange={value => setOutreachForm(v => ({ ...v, creatorId: value === "none" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{L("请选择", "選択してください")}</SelectItem>{creators.data?.map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.displayName}{item.handle ? ` (@${item.handle})` : ""}</SelectItem>)}</SelectContent></Select></Field><Field label={L("推广方案", "プロモーション施策")}><Select value={outreachForm.campaignId || "none"} onValueChange={value => setOutreachForm(v => ({ ...v, campaignId: value === "none" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{L("未指定", "未指定")}</SelectItem>{campaigns.data?.map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>{isAdmin && <Field label={L("BD员工", "BD担当者")}><Select value={outreachForm.staffId || "none"} onValueChange={value => setOutreachForm(v => ({ ...v, staffId: value === "none" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{L("未分配", "未割当")}</SelectItem>{bootstrap.data?.staff?.map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field>}<Field label={L("日期", "日付")}><Input type="date" value={outreachForm.activityDate} onChange={e => setOutreachForm(v => ({ ...v, activityDate: e.target.value }))}/></Field><Field label={L("联络渠道", "連絡チャネル")}><Select value={outreachForm.channel} onValueChange={(value: any) => setOutreachForm(v => ({ ...v, channel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CHANNEL_LABELS).map(([key,label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></Field><Field label={L("推进阶段", "進捗ステージ")}><Select value={outreachForm.stage} onValueChange={(value: any) => setOutreachForm(v => ({ ...v, stage: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STAGE_LABELS).map(([key,label]) => <SelectItem key={key} value={key}>{isZh ? label.zh : label.ja}</SelectItem>)}</SelectContent></Select></Field><Field label={L("本次联络次数", "今回の連絡回数")}><Input type="number" min={1} value={outreachForm.contactCount} onChange={e => setOutreachForm(v => ({ ...v, contactCount: e.target.value }))}/></Field><Field label={L("回复类型", "返信タイプ")}><Select value={outreachForm.responseType} onValueChange={(value: any) => setOutreachForm(v => ({ ...v, responseType: value, replyReceived: value !== "none", positiveReply: value === "positive" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RESPONSE_LABELS).map(([key,label]) => <SelectItem key={key} value={key}>{isZh ? label.zh : label.ja}</SelectItem>)}</SelectContent></Select></Field><div className="md:col-span-2 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">{[["replyReceived",L("已回复", "返信あり")],["positiveReply",L("积极回复", "前向き返信")],["sampleAdvanced",L("样品推进", "サンプル進行")],["cooperationConfirmed",L("合作确定", "提携確定")]].map(([key,label]) => <label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean((outreachForm as any)[key])} onCheckedChange={value => setOutreachForm(current => ({ ...current, [key]: Boolean(value), ...(key === "positiveReply" && value ? { replyReceived: true, responseType: "positive" } : {}) }))}/>{label}</label>)}</div><div className="md:col-span-2"><Field label={L("实际使用的话术", "実際に使用したトーク")}><Textarea className="min-h-24" value={outreachForm.pitchText} onChange={e => setOutreachForm(v => ({ ...v, pitchText: e.target.value }))} placeholder={L("粘贴实际发送给达人的内容", "実際に送った内容を貼り付け")}/></Field></div><div className="md:col-span-2"><Field label={L("聊天记录文字", "チャット履歴テキスト")}><Textarea className="min-h-32" value={outreachForm.chatText} onChange={e => setOutreachForm(v => ({ ...v, chatText: e.target.value }))} placeholder={L("可粘贴聊天记录，AI会与截图一起分析", "チャット履歴を貼り付けると画像と一緒にAIが分析します")}/></Field></div><Field label={L("遇到的问题", "発生した課題")}><Textarea value={outreachForm.issues} onChange={e => setOutreachForm(v => ({ ...v, issues: e.target.value }))}/></Field><Field label={L("下一步动作", "次アクション")}><Textarea value={outreachForm.nextAction} onChange={e => setOutreachForm(v => ({ ...v, nextAction: e.target.value }))}/></Field><Field label={L("下次跟进日期", "次回フォロー日")}><Input type="date" value={outreachForm.nextFollowUpDate} onChange={e => setOutreachForm(v => ({ ...v, nextFollowUpDate: e.target.value }))}/></Field><Field label={L("结果备注", "結果メモ")}><Input value={outreachForm.outcomeNotes} onChange={e => setOutreachForm(v => ({ ...v, outcomeNotes: e.target.value }))}/></Field><div className="md:col-span-2"><Field label={L("聊天截图（JPEG / PNG / WEBP，单张10MB以内，最多10张）", "チャット画像（JPEG / PNG / WEBP、1枚10MB以内、最大10枚）")}><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 hover:border-indigo-400 hover:bg-indigo-50"><ImagePlus className="h-5 w-5" />{L("选择聊天截图", "チャット画像を選択")}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => setPendingFiles(Array.from(e.target.files || []).slice(0, 10))}/></label>{pendingFiles.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{pendingFiles.map((file,index) => <Badge key={`${file.name}-${index}`} variant="secondary" className="gap-1">{file.name}<button onClick={() => setPendingFiles(files => files.filter((_,i) => i !== index))}><X className="h-3 w-3" /></button></Badge>)}</div>}</Field></div></div><DialogFooter><Button variant="outline" onClick={() => setOutreachDialogOpen(false)}>{L("取消", "キャンセル")}</Button><Button onClick={submitOutreach} disabled={saveOutreach.isPending || uploading}><Send className="mr-2 h-4 w-4" />{uploading ? L("保存并上传中…", "保存・アップロード中…") : L("保存进度", "進捗を保存")}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{campaignEditingId ? L("编辑推广方案", "施策編集") : L("新增推广方案", "施策追加")}</DialogTitle><DialogDescription>{L("从真实商品资料开始，补充达人为什么值得合作的清晰利益点。", "実在する商品情報を起点に、クリエイターが提携するメリットを明確にします。")}</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><Field label={L("方案名称*", "施策名*")}><Input value={campaignForm.name} onChange={e => setCampaignForm(v => ({ ...v, name: e.target.value }))}/></Field><Field label={L("状态", "ステータス")}><Select value={campaignForm.status} onValueChange={(value: any) => setCampaignForm(v => ({ ...v, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem></SelectContent></Select></Field><Field label={L("关联品牌", "関連ブランド")}><Select value={campaignForm.brandId || "none"} onValueChange={value => setCampaignForm(v => ({ ...v, brandId: value === "none" ? "" : value, productId: "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{L("未指定", "未指定")}</SelectItem>{bootstrap.data?.brands?.map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field><Field label={L("关联商品", "関連商品")}><Select value={campaignForm.productId || "none"} onValueChange={value => { const product: any = bootstrap.data?.products?.find((item: any) => String(item.id) === value); setCampaignForm(v => ({ ...v, productId: value === "none" ? "" : value, productNameSnapshot: product?.productName || v.productNameSnapshot, coreSellingPoints: product?.features || product?.catchCopy || v.coreSellingPoints, targetCreatorProfile: product?.targetAudience || v.targetCreatorProfile, commissionPolicy: product?.commissionRate || v.commissionPolicy })); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{L("未指定", "未指定")}</SelectItem>{bootstrap.data?.products?.filter((item: any) => !campaignForm.brandId || String(item.brandId) === campaignForm.brandId).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.brandName ? `${item.brandName} · ` : ""}{item.productName}</SelectItem>)}</SelectContent></Select></Field><div className="md:col-span-2"><Field label={L("产品名称快照", "商品名スナップショット")}><Input value={campaignForm.productNameSnapshot} onChange={e => setCampaignForm(v => ({ ...v, productNameSnapshot: e.target.value }))}/></Field></div><div className="md:col-span-2"><Field label={L("核心卖点", "主要な訴求点")}><Textarea className="min-h-24" value={campaignForm.coreSellingPoints} onChange={e => setCampaignForm(v => ({ ...v, coreSellingPoints: e.target.value }))}/></Field></div><div className="md:col-span-2"><Field label={L("达人利益点", "クリエイターメリット")}><Textarea className="min-h-24" value={campaignForm.creatorBenefits} onChange={e => setCampaignForm(v => ({ ...v, creatorBenefits: e.target.value }))} placeholder={L("例如：收益、内容制作难度、粉丝价值、品牌背书等真实利益", "報酬、制作負荷、フォロワー価値、ブランド実績など実際のメリット")}/></Field></div><Field label={L("佣金政策", "報酬条件")}><Textarea value={campaignForm.commissionPolicy} onChange={e => setCampaignForm(v => ({ ...v, commissionPolicy: e.target.value }))}/></Field><Field label={L("样品政策", "サンプル条件")}><Textarea value={campaignForm.samplePolicy} onChange={e => setCampaignForm(v => ({ ...v, samplePolicy: e.target.value }))}/></Field><div className="md:col-span-2"><Field label={L("目标达人画像", "対象クリエイター像")}><Textarea value={campaignForm.targetCreatorProfile} onChange={e => setCampaignForm(v => ({ ...v, targetCreatorProfile: e.target.value }))}/></Field></div><div className="md:col-span-2"><Field label={L("初次联络标准话术", "初回連絡の標準トーク")}><Textarea className="min-h-28" value={campaignForm.referenceOpeningScript} onChange={e => setCampaignForm(v => ({ ...v, referenceOpeningScript: e.target.value }))}/></Field></div><div className="md:col-span-2"><Field label={L("二次跟进标准话术", "再フォローの標準トーク")}><Textarea className="min-h-28" value={campaignForm.referenceFollowUpScript} onChange={e => setCampaignForm(v => ({ ...v, referenceFollowUpScript: e.target.value }))}/></Field></div><div className="md:col-span-2"><Field label={L("常见异议处理", "よくある反論への対応")}><Textarea className="min-h-28" value={campaignForm.objectionHandling} onChange={e => setCampaignForm(v => ({ ...v, objectionHandling: e.target.value }))}/></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>{L("取消", "キャンセル")}</Button><Button onClick={submitCampaign} disabled={saveCampaign.isPending || !campaignForm.name.trim()}>{L("保存方案", "施策を保存")}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(selectedOutreachId)} onOpenChange={open => !open && setSelectedOutreachId(null)}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{L("BD记录与聊天证据", "BD記録とチャット証拠")}</DialogTitle><DialogDescription>{outreachDetail.data ? `${outreachDetail.data.staffName || "—"} · ${displayDate(outreachDetail.data.activityDate)}` : ""}</DialogDescription></DialogHeader>{outreachDetail.isLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : outreachDetail.data && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><InfoBlock title={L("实际话术", "実際のトーク")} text={outreachDetail.data.pitchText}/><InfoBlock title={L("问题点", "課題")} text={outreachDetail.data.issues}/><InfoBlock title={L("下一步", "次アクション")} text={outreachDetail.data.nextAction}/><InfoBlock title={L("结果备注", "結果メモ")} text={outreachDetail.data.outcomeNotes}/></div><div><h3 className="mb-2 font-semibold">{L("聊天文字", "チャット本文")}</h3><div className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">{outreachDetail.data.chatText || L("未登记聊天文字", "チャット本文未登録")}</div></div><div><h3 className="mb-3 font-semibold">{L("聊天截图", "チャット画像")}</h3>{!outreachDetail.data.attachments?.length ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">{L("没有截图证据", "画像証拠なし")}</div> : <div className="grid gap-3 sm:grid-cols-2">{outreachDetail.data.attachments.map((attachment: any) => <div key={attachment.id} className="overflow-hidden rounded-xl border border-slate-200"><a href={attachment.fileUrl} target="_blank" rel="noreferrer"><img src={attachment.fileUrl} alt={attachment.fileName} className="h-56 w-full bg-slate-100 object-contain" /></a><div className="flex items-center justify-between gap-2 p-3"><div className="min-w-0"><div className="truncate text-xs font-medium">{attachment.fileName}</div><div className="text-[11px] text-slate-400">{(Number(attachment.fileSize) / 1024 / 1024).toFixed(2)} MB</div></div><Button variant="ghost" size="sm" onClick={async () => { try { await archiveAttachment.mutateAsync({ id: Number(attachment.id), reason: L("用户从BD证据中移除", "BD証拠からユーザーが削除") }); toast.success(L("截图已移除", "画像を削除しました")); await outreachDetail.refetch(); await outreach.refetch(); } catch (error: any) { toast.error(error.message); } }}><X className="h-4 w-4" /></Button></div></div>)}</div>}</div></div>}</DialogContent></Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center"><div className="mb-4 rounded-2xl bg-white p-3 shadow-sm"><Icon className="h-7 w-7 text-indigo-600" /></div><div className="font-semibold text-slate-900">{title}</div><div className="mt-1 max-w-md text-sm text-slate-500">{description}</div></div>;
}

function InfoBlock({ title, text }: { title: string; text?: string | null }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div><div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{text || "—"}</div></div>;
}

function BreakdownCard({ title, rows, labelKey, L }: { title: string; rows: any[]; labelKey: string; L: (zh: string, ja: string) => string }) {
  return <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{!rows.length ? <div className="py-10 text-center text-sm text-slate-500">{L("所选期间没有数据", "選択期間にデータがありません")}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500"><th className="p-2">{L("名称", "名称")}</th><th className="p-2">{L("联络达人", "連絡人数")}</th><th className="p-2">{L("回复", "返信")}</th><th className="p-2">{L("回复率", "返信率")}</th><th className="p-2">{L("合作", "提携")}</th></tr></thead><tbody>{rows.map((row,index) => <tr key={`${row[labelKey]}-${index}`} className="border-b border-slate-100"><td className="p-2 font-medium">{labelKey === "channel" ? CHANNEL_LABELS[row[labelKey]] || row[labelKey] : row[labelKey] || L("未分配", "未割当")}</td><td className="p-2">{numberText(row.contactedCreators)}</td><td className="p-2">{numberText(row.repliedCreators)}</td><td className="p-2 font-semibold">{pct(row.replyRate)}</td><td className="p-2">{numberText(row.cooperatingCreators)}</td></tr>)}</tbody></table></div>}</CardContent></Card>;
}
