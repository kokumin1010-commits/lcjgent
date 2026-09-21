import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Handshake,
  Loader2,
  MessageSquareText,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  BRAND_BD_AI_ANALYSIS_LABELS_JA,
  BRAND_BD_AI_ANALYSIS_LABELS_ZH,
  BRAND_BD_AI_ANALYSIS_TYPES,
  type BrandBdAiAnalysisType,
} from "@shared/brandBdCommand";
import {
  BRAND_BD_STAGE_LABELS,
  BRAND_BD_STAGE_LABELS_ZH,
  BRAND_BD_STAGE_VALUES,
  type BrandBdStage,
} from "@shared/brandBusiness";

const stageClasses: Record<string, string> = {
  new_lead: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  slot_fee: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  guaranteed_roi: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  pure_commission: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  contracted: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  on_hold: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
  lost: "border-red-400/30 bg-red-400/10 text-red-200",
};

const interactionLabels: Record<string, string> = {
  call: "电话 / 電話",
  meeting: "会议 / 商談",
  email: "邮件 / メール",
  message: "消息 / メッセージ",
  proposal: "提案 / 提案",
  other: "其他 / その他",
};

function localDateTimeInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function displayDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CardShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#12141a] shadow-[0_16px_44px_rgba(0,0,0,0.24)] ${className}`}
    >
      {children}
    </div>
  );
}

export default function BrandBdCommandCenter() {
  const { language } = useLanguage();
  const zh = language !== "ja";
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const queryBrandId = Number(
    new URLSearchParams(window.location.search).get("brandId") || 0
  );
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(
    Number.isInteger(queryBrandId) && queryBrandId > 0 ? queryBrandId : null
  );
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"pipeline" | "calendar" | "executive">(
    "pipeline"
  );
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingRequestId, setMeetingRequestId] = useState(() =>
    crypto.randomUUID()
  );
  const [dealOpen, setDealOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);

  const overview = trpc.brandBdCommand.overview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const detail = trpc.brandBdCommand.brand.useQuery(
    { brandId: selectedBrandId || 0 },
    { enabled: Boolean(selectedBrandId), refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (!selectedBrandId && overview.data?.brands?.length) {
      setSelectedBrandId(Number(overview.data.brands[0].id));
    }
  }, [overview.data?.brands, selectedBrandId]);

  const brands = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (overview.data?.brands || []).filter((brand: any) => {
      if (!needle) return true;
      return [brand.name, brand.nameJa, brand.companyName, brand.managerName]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(needle));
    });
  }, [overview.data?.brands, search]);

  const [interaction, setInteraction] = useState({
    interactionType: "meeting",
    occurredAt: localDateTimeInput(),
    summary: "",
    details: "",
    outcome: "",
    nextAction: "",
    nextFollowUpAt: "",
    contactPerson: "",
    ownerStaffId: "",
  });
  const [meeting, setMeeting] = useState({
    title: "",
    startsAt: localDateTimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    endsAt: "",
    location: "",
    agenda: "",
    ownerStaffId: "",
    attendeeStaffIds: [] as number[],
    notifyBosses: true,
    reminderMinutesBefore: "60",
  });
  const [deal, setDeal] = useState({
    stage: "new_lead" as BrandBdStage,
    slotFeeAmount: "",
    guaranteedRoi: "2",
    pureCommissionRate: "",
    nextFollowUpAt: "",
    nextAction: "",
    negotiationNotes: "",
  });

  useEffect(() => {
    const selected = overview.data?.brands?.find(
      (brand: any) => Number(brand.id) === selectedBrandId
    );
    const fallbackOwner =
      selected?.businessManagerId ||
      overview.data?.access?.staffId ||
      overview.data?.staff?.[0]?.id;
    if (fallbackOwner) {
      setInteraction(current => ({
        ...current,
        ownerStaffId: current.ownerStaffId || String(fallbackOwner),
      }));
      setMeeting(current => ({
        ...current,
        ownerStaffId: current.ownerStaffId || String(fallbackOwner),
      }));
    }
  }, [selectedBrandId, overview.data]);

  useEffect(() => {
    const current = detail.data?.deal;
    setDeal({
      stage: (current?.stage || "new_lead") as BrandBdStage,
      slotFeeAmount:
        current?.slotFeeAmount == null ? "" : String(current.slotFeeAmount),
      guaranteedRoi:
        current?.guaranteedRoi == null ? "2" : String(current.guaranteedRoi),
      pureCommissionRate:
        current?.pureCommissionRate == null
          ? ""
          : String(current.pureCommissionRate),
      nextFollowUpAt: current?.nextFollowUpAt
        ? localDateTimeInput(new Date(current.nextFollowUpAt))
        : "",
      nextAction: current?.nextAction || "",
      negotiationNotes: current?.negotiationNotes || "",
    });
  }, [detail.data?.deal, selectedBrandId]);

  const refreshAll = async () => {
    await Promise.all([
      utils.brandBdCommand.overview.invalidate(),
      utils.brandBdCommand.brand.invalidate(),
      utils.task.invalidate(),
    ]);
  };

  const interactionMutation =
    trpc.brandBdCommand.createInteraction.useMutation();
  const meetingMutation = trpc.brandBdCommand.createMeeting.useMutation();
  const statusMutation = trpc.brandBdCommand.updateMeetingStatus.useMutation();
  const dealMutation = trpc.brandBdCommand.saveDeal.useMutation();
  const aiMutation = trpc.brandBdCommand.generateAi.useMutation();

  const selectBrand = (brandId: number) => {
    setSelectedBrandId(brandId);
    const params = new URLSearchParams(window.location.search);
    params.set("brandId", String(brandId));
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params}`
    );
  };

  const openMeetingDialog = () => {
    setMeetingRequestId(crypto.randomUUID());
    setMeetingOpen(true);
  };

  const closeMeetingDialog = () => {
    setMeetingOpen(false);
    setMeetingRequestId(crypto.randomUUID());
  };

  const saveInteraction = async () => {
    if (!selectedBrandId) return;
    try {
      const created = await interactionMutation.mutateAsync({
        brandId: selectedBrandId,
        interactionType: interaction.interactionType as any,
        occurredAt: new Date(interaction.occurredAt).toISOString(),
        summary: interaction.summary,
        details: interaction.details || null,
        outcome: interaction.outcome || null,
        nextAction: interaction.nextAction || null,
        nextFollowUpAt: interaction.nextFollowUpAt
          ? new Date(interaction.nextFollowUpAt).toISOString()
          : null,
        contactPerson: interaction.contactPerson || null,
        ownerStaffId: interaction.ownerStaffId
          ? Number(interaction.ownerStaffId)
          : null,
      });
      let uploadFailures = 0;
      for (const file of files.slice(0, 10)) {
        const body = new FormData();
        body.append("file", file);
        const uploadUrl = new URL(
          "/api/brand-bd-interaction-file-upload",
          window.location.origin
        );
        uploadUrl.searchParams.set("brandId", String(selectedBrandId));
        uploadUrl.searchParams.set(
          "interactionId",
          String(created.interactionId)
        );
        const response = await fetch(uploadUrl.toString(), {
          method: "POST",
          body,
          credentials: "include",
        });
        if (!response.ok) uploadFailures += 1;
      }
      toast.success(
        uploadFailures
          ? `洽谈记录已保存，${uploadFailures}个附件上传失败`
          : "洽谈记录和附件已保存"
      );
      setInteractionOpen(false);
      setFiles([]);
      setInteraction(current => ({
        ...current,
        occurredAt: localDateTimeInput(),
        summary: "",
        details: "",
        outcome: "",
        nextAction: "",
        nextFollowUpAt: "",
        contactPerson: "",
      }));
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message || "保存洽谈记录失败");
    }
  };

  const saveMeeting = async () => {
    if (!selectedBrandId || !meeting.ownerStaffId) return;
    try {
      const result = await meetingMutation.mutateAsync({
        brandId: selectedBrandId,
        requestId: meetingRequestId,
        title: meeting.title,
        startsAt: new Date(meeting.startsAt).toISOString(),
        endsAt: meeting.endsAt ? new Date(meeting.endsAt).toISOString() : null,
        location: meeting.location || null,
        agenda: meeting.agenda || null,
        ownerStaffId: Number(meeting.ownerStaffId),
        attendeeStaffIds: meeting.attendeeStaffIds,
        notifyBosses: meeting.notifyBosses,
        reminderMinutesBefore: Number(meeting.reminderMinutesBefore),
      });
      toast.success(`会议已创建，并生成今日事项任务 ${result.taskId}`);
      closeMeetingDialog();
      setMeeting(current => ({
        ...current,
        title: "",
        startsAt: localDateTimeInput(
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        ),
        endsAt: "",
        location: "",
        agenda: "",
        attendeeStaffIds: [],
      }));
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message || "创建会议失败");
    }
  };

  const saveDeal = async () => {
    if (!selectedBrandId) return;
    try {
      await dealMutation.mutateAsync({
        brandId: selectedBrandId,
        stage: deal.stage,
        dealModel:
          deal.stage === "slot_fee" ||
          deal.stage === "guaranteed_roi" ||
          deal.stage === "pure_commission"
            ? deal.stage
            : (detail.data?.deal?.dealModel as any),
        slotFeeAmount: deal.slotFeeAmount ? Number(deal.slotFeeAmount) : null,
        guaranteedRoi:
          deal.stage === "guaranteed_roi"
            ? 2
            : deal.guaranteedRoi
              ? Number(deal.guaranteedRoi)
              : null,
        pureCommissionRate: deal.pureCommissionRate
          ? Number(deal.pureCommissionRate)
          : null,
        nextFollowUpAt: deal.nextFollowUpAt
          ? new Date(deal.nextFollowUpAt).toISOString()
          : null,
        nextAction: deal.nextAction || null,
        negotiationNotes: deal.negotiationNotes || null,
      });
      toast.success("BD阶段和下一步已更新");
      setDealOpen(false);
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message || "更新BD阶段失败");
    }
  };

  const runAi = async (analysisType: BrandBdAiAnalysisType, global = false) => {
    try {
      const result = await aiMutation.mutateAsync({
        brandId: global ? null : selectedBrandId,
        analysisType,
      });
      setAiResult(result);
      setAiOpen(true);
      await utils.brandBdCommand.brand.invalidate();
    } catch (error: any) {
      toast.error(error?.message || "AI分析失败");
    }
  };

  const selectedBrand = overview.data?.brands?.find(
    (brand: any) => Number(brand.id) === selectedBrandId
  );
  const stats = overview.data?.stats;

  if (overview.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a0f] text-white">
        <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100">
      <div className="border-b border-white/10 bg-[#0c0e13]/95 px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1760px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={() => navigate("/master/brands")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-2.5 shadow-lg shadow-violet-950/40">
              <Handshake className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
                品牌 BD 指挥塔
              </h1>
              <p className="text-xs text-slate-400 lg:text-sm">
                ブランドBD司令塔 · 进度、洽谈、会议、任务与AI建议
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
              onClick={() => void overview.refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
            <Button
              variant="outline"
              className="border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
              onClick={() => navigate("/master/lcj-brain?tab=chat")}
            >
              <Brain className="mr-2 h-4 w-4" />
              LCJ Brain
            </Button>
            <Button
              className="bg-violet-500 text-white hover:bg-violet-400"
              onClick={() => setInteractionOpen(true)}
              disabled={!selectedBrandId}
            >
              <Plus className="mr-2 h-4 w-4" />
              记录洽谈
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1760px] space-y-5 p-4 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["管理品牌", stats?.totalBrands || 0, Building2, "text-sky-300"],
            ["进行中BD", stats?.activeDeals || 0, Handshake, "text-violet-300"],
            [
              "逾期跟进",
              stats?.overdueFollowUps || 0,
              AlertTriangle,
              "text-red-300",
            ],
            [
              "7日内会议",
              stats?.meetingsNext7Days || 0,
              CalendarClock,
              "text-amber-300",
            ],
            [
              "缺少下一步",
              stats?.missingNextAction || 0,
              Target,
              "text-emerald-300",
            ],
          ].map(([label, value, Icon, color]: any[]) => (
            <CardShell key={String(label)} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{String(label)}</p>
                  <p className="mt-1 text-2xl font-bold">{String(value)}</p>
                </div>
                <Icon className={`h-6 w-6 ${String(color)}`} />
              </div>
            </CardShell>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-xl border border-white/10 bg-[#101217] p-1">
          {[
            ["pipeline", "BD进度与记录"],
            ["calendar", "全部日程"],
            ["executive", "老板视角 / AI"],
          ].map(([key, label]) => (
            <Button
              key={key}
              variant="ghost"
              className={
                view === key
                  ? "bg-violet-500 text-white hover:bg-violet-500"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }
              onClick={() => setView(key as typeof view)}
            >
              {label}
            </Button>
          ))}
        </div>

        {view === "pipeline" && (
          <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
            <CardShell className="overflow-hidden">
              <div className="border-b border-white/10 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="搜索品牌、公司或负责人"
                    className="border-white/10 bg-black/20 pl-9 text-white"
                  />
                </div>
              </div>
              <div className="max-h-[calc(100vh-300px)] space-y-1 overflow-y-auto p-2">
                {brands.map((brand: any) => {
                  const stage = brand.deal?.stage || "new_lead";
                  const overdue =
                    brand.deal?.nextFollowUpAt &&
                    new Date(brand.deal.nextFollowUpAt).getTime() < Date.now();
                  return (
                    <button
                      key={brand.id}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedBrandId === Number(brand.id)
                          ? "border-violet-400/40 bg-violet-500/15"
                          : "border-transparent hover:border-white/10 hover:bg-white/5"
                      }`}
                      onClick={() => selectBrand(Number(brand.id))}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{brand.name}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {brand.companyName ||
                              brand.managerName ||
                              "负责人未设置"}
                          </p>
                        </div>
                        {overdue && (
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                      <Badge
                        className={`mt-2 border ${stageClasses[stage] || stageClasses.new_lead}`}
                      >
                        {zh
                          ? BRAND_BD_STAGE_LABELS_ZH[stage as BrandBdStage]
                          : BRAND_BD_STAGE_LABELS[stage as BrandBdStage]}
                      </Badge>
                    </button>
                  );
                })}
                {brands.length === 0 && (
                  <p className="p-6 text-center text-sm text-slate-500">
                    当前权限范围内没有品牌
                  </p>
                )}
              </div>
            </CardShell>

            <div className="min-w-0 space-y-5">
              {selectedBrand ? (
                <>
                  <CardShell className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl font-bold">
                            {selectedBrand.name}
                          </h2>
                          <Badge
                            className={`border ${stageClasses[selectedBrand.deal?.stage || "new_lead"]}`}
                          >
                            {zh
                              ? BRAND_BD_STAGE_LABELS_ZH[
                                  (selectedBrand.deal?.stage ||
                                    "new_lead") as BrandBdStage
                                ]
                              : BRAND_BD_STAGE_LABELS[
                                  (selectedBrand.deal?.stage ||
                                    "new_lead") as BrandBdStage
                                ]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          {selectedBrand.companyName || "公司未填写"} · 负责人：
                          {selectedBrand.managerName || "未设置"}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-xl bg-black/20 p-3">
                            <p className="text-xs text-slate-500">下一步</p>
                            <p className="mt-1 text-sm">
                              {selectedBrand.deal?.nextAction || "尚未设置"}
                            </p>
                          </div>
                          <div className="rounded-xl bg-black/20 p-3">
                            <p className="text-xs text-slate-500">下次跟进</p>
                            <p className="mt-1 text-sm">
                              {displayDate(selectedBrand.deal?.nextFollowUpAt)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-black/20 p-3">
                            <p className="text-xs text-slate-500">最近联系</p>
                            <p className="mt-1 text-sm">
                              {displayDate(selectedBrand.deal?.lastContactAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="border-white/15 bg-white/5 text-white"
                          onClick={() => setDealOpen(true)}
                        >
                          <Target className="mr-2 h-4 w-4" />
                          更新阶段
                        </Button>
                        <Button
                          variant="outline"
                          className="border-white/15 bg-white/5 text-white"
                          onClick={openMeetingDialog}
                        >
                          <CalendarClock className="mr-2 h-4 w-4" />
                          安排会议
                        </Button>
                        <Link href={`/master/brands/${selectedBrand.id}`}>
                          <Button className="bg-white text-black hover:bg-slate-200">
                            品牌详情
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardShell>

                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_410px]">
                    <CardShell className="overflow-hidden">
                      <div className="flex items-center justify-between border-b border-white/10 p-4">
                        <div>
                          <h3 className="font-semibold">洽谈时间线</h3>
                          <p className="text-xs text-slate-500">
                            记录事实、附件、结果和下一步
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-violet-500 hover:bg-violet-400"
                          onClick={() => setInteractionOpen(true)}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          新增
                        </Button>
                      </div>
                      <div className="max-h-[720px] space-y-3 overflow-y-auto p-4">
                        {(detail.data?.interactions || []).map((item: any) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="border-white/15 text-slate-300"
                                >
                                  {interactionLabels[item.interactionType] ||
                                    item.interactionType}
                                </Badge>
                                <span className="text-xs text-slate-500">
                                  {displayDate(item.occurredAt)}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500">
                                {item.ownerName || "负责人未设置"}
                              </span>
                            </div>
                            <h4 className="mt-3 font-semibold">
                              {item.summary}
                            </h4>
                            {item.details && (
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                                {item.details}
                              </p>
                            )}
                            {(item.outcome || item.nextAction) && (
                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                <div className="rounded-lg bg-emerald-500/8 p-3 text-sm">
                                  <span className="text-xs text-emerald-300">
                                    结果
                                  </span>
                                  <p className="mt-1">
                                    {item.outcome || "未填写"}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-violet-500/8 p-3 text-sm">
                                  <span className="text-xs text-violet-300">
                                    下一步
                                  </span>
                                  <p className="mt-1">
                                    {item.nextAction || "未填写"}
                                  </p>
                                </div>
                              </div>
                            )}
                            {item.files?.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.files.map((file: any) => (
                                  <a
                                    key={file.id}
                                    href={file.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:border-violet-400/40"
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    {file.fileName}
                                    {file.extractionStatus === "extracted" && (
                                      <Sparkles className="h-3 w-3 text-violet-300" />
                                    )}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {!detail.data?.interactions?.length && (
                          <div className="py-14 text-center text-sm text-slate-500">
                            还没有洽谈记录，请从第一次联系开始登记
                          </div>
                        )}
                      </div>
                    </CardShell>

                    <div className="space-y-5">
                      <CardShell className="p-4">
                        <div className="mb-4 flex items-center gap-2">
                          <Bot className="h-5 w-5 text-violet-300" />
                          <div>
                            <h3 className="font-semibold">AI 商务副驾</h3>
                            <p className="text-xs text-slate-500">
                              只读分析，所有对外文案必须人工确认
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          {BRAND_BD_AI_ANALYSIS_TYPES.filter(
                            type => type !== "executive_summary"
                          ).map(type => (
                            <Button
                              key={type}
                              variant="outline"
                              className="justify-between border-white/10 bg-white/5 text-slate-200 hover:bg-violet-500/15"
                              disabled={aiMutation.isPending}
                              onClick={() => void runAi(type)}
                            >
                              <span>
                                {zh
                                  ? BRAND_BD_AI_ANALYSIS_LABELS_ZH[type]
                                  : BRAND_BD_AI_ANALYSIS_LABELS_JA[type]}
                              </span>
                              {aiMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 text-violet-300" />
                              )}
                            </Button>
                          ))}
                        </div>
                      </CardShell>

                      <CardShell className="overflow-hidden">
                        <div className="border-b border-white/10 p-4">
                          <h3 className="font-semibold">会议与任务</h3>
                          <p className="text-xs text-slate-500">
                            创建后自动进入任务/积分执行今日事项
                          </p>
                        </div>
                        <div className="max-h-[430px] space-y-3 overflow-y-auto p-4">
                          {(detail.data?.meetings || []).map((item: any) => (
                            <div
                              key={item.id}
                              className="rounded-xl border border-white/10 bg-black/20 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{item.title}</p>
                                  <p className="mt-1 text-xs text-amber-200">
                                    {displayDate(item.startsAt)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {item.location || "地点未填写"} ·{" "}
                                    {item.ownerName}
                                  </p>
                                </div>
                                <Badge
                                  className={
                                    item.status === "scheduled"
                                      ? "bg-sky-500/15 text-sky-200"
                                      : item.status === "completed"
                                        ? "bg-emerald-500/15 text-emerald-200"
                                        : "bg-slate-500/15 text-slate-300"
                                  }
                                >
                                  {item.status}
                                </Badge>
                              </div>
                              {item.taskPublicId && (
                                <p className="mt-2 text-xs text-violet-300">
                                  任务：{item.taskPublicId} · {item.taskStatus}
                                </p>
                              )}
                              {item.status === "scheduled" && (
                                <div className="mt-3 flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-emerald-400/20 text-emerald-200"
                                    disabled={statusMutation.isPending}
                                    onClick={async () => {
                                      await statusMutation.mutateAsync({
                                        brandId: selectedBrandId!,
                                        meetingId: item.id,
                                        status: "completed",
                                      });
                                      await refreshAll();
                                    }}
                                  >
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    完成
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-red-400/20 text-red-200"
                                    disabled={statusMutation.isPending}
                                    onClick={async () => {
                                      if (
                                        !window.confirm(
                                          "确认取消该会议和对应任务？"
                                        )
                                      )
                                        return;
                                      await statusMutation.mutateAsync({
                                        brandId: selectedBrandId!,
                                        meetingId: item.id,
                                        status: "cancelled",
                                      });
                                      await refreshAll();
                                    }}
                                  >
                                    <XCircle className="mr-1 h-3 w-3" />
                                    取消
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                          {!detail.data?.meetings?.length && (
                            <p className="py-8 text-center text-sm text-slate-500">
                              暂无会议
                            </p>
                          )}
                        </div>
                      </CardShell>
                    </div>
                  </div>
                </>
              ) : (
                <CardShell className="flex min-h-[500px] items-center justify-center p-8 text-slate-500">
                  请选择一个品牌
                </CardShell>
              )}
            </div>
          </div>
        )}

        {view === "calendar" && (
          <CardShell className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-semibold">全部BD日程</h2>
                <p className="text-sm text-slate-500">
                  当前权限范围内未来90天的品牌会议
                </p>
              </div>
              <Button
                className="bg-violet-500 hover:bg-violet-400"
                onClick={openMeetingDialog}
                disabled={!selectedBrandId}
              >
                <Plus className="mr-2 h-4 w-4" />
                安排会议
              </Button>
            </div>
            <div className="grid gap-3 p-5 lg:grid-cols-2 2xl:grid-cols-3">
              {(overview.data?.meetings || []).map((item: any) => (
                <button
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-4 text-left hover:border-violet-400/40"
                  onClick={() => {
                    selectBrand(Number(item.brandId));
                    setView("pipeline");
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge className="bg-violet-500/15 text-violet-200">
                      {item.brandName}
                    </Badge>
                    <span className="text-xs text-amber-200">
                      {displayDate(item.startsAt)}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {item.location || "地点未填写"} · {item.ownerName}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <Clock3 className="h-3 w-3" />
                    提醒：提前
                    {item.reminderMinutesBefore}分钟
                    {item.notifyBosses && (
                      <Badge
                        variant="outline"
                        className="border-amber-400/20 text-amber-200"
                      >
                        老板同步
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
              {!overview.data?.meetings?.length && (
                <p className="col-span-full py-16 text-center text-slate-500">
                  未来90天暂无会议
                </p>
              )}
            </div>
          </CardShell>
        )}

        {view === "executive" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <CardShell className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge className="mb-3 bg-amber-400/15 text-amber-200">
                    老板视角
                  </Badge>
                  <h2 className="text-2xl font-bold">全品牌BD执行概览</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    看进度、逾期、会议和缺少下一步的品牌。AI只做内部分析，不会自动联系品牌。
                  </p>
                </div>
                <ShieldCheck className="h-9 w-9 text-emerald-300" />
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {(overview.data?.brands || []).map((brand: any) => (
                  <button
                    key={brand.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4 text-left hover:border-violet-400/40"
                    onClick={() => {
                      selectBrand(Number(brand.id));
                      setView("pipeline");
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{brand.name}</span>
                      <Badge
                        className={`border ${stageClasses[brand.deal?.stage || "new_lead"]}`}
                      >
                        {
                          BRAND_BD_STAGE_LABELS_ZH[
                            (brand.deal?.stage || "new_lead") as BrandBdStage
                          ]
                        }
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">
                      {brand.deal?.nextAction || "未设置下一步"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      跟进：{displayDate(brand.deal?.nextFollowUpAt)}
                    </p>
                  </button>
                ))}
              </div>
            </CardShell>
            <CardShell className="p-5">
              <Bot className="h-8 w-8 text-violet-300" />
              <h3 className="mt-4 text-xl font-semibold">AI 老板摘要</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                汇总全部有权限的品牌，指出逾期、阻塞、风险和老板需要介入的事项。
              </p>
              <Button
                className="mt-6 w-full bg-violet-500 hover:bg-violet-400"
                disabled={
                  !overview.data?.access?.isSuperAdmin || aiMutation.isPending
                }
                onClick={() => void runAi("executive_summary", true)}
              >
                {aiMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                生成全局老板摘要
              </Button>
              {!overview.data?.access?.isSuperAdmin && (
                <p className="mt-3 text-xs text-amber-300">
                  仅超级管理员可生成跨品牌老板摘要
                </p>
              )}
            </CardShell>
          </div>
        )}
      </main>

      <Dialog open={interactionOpen} onOpenChange={setInteractionOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-white/10 bg-[#111319] text-white">
          <DialogHeader>
            <DialogTitle>记录品牌洽谈</DialogTitle>
            <DialogDescription className="text-slate-400">
              保存事实、结果、附件和下一步；附件中的PDF/文本会提取为AI证据。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>沟通方式</Label>
              <Select
                value={interaction.interactionType}
                onValueChange={value =>
                  setInteraction(current => ({
                    ...current,
                    interactionType: value,
                  }))
                }
              >
                <SelectTrigger className="border-white/10 bg-black/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(interactionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>洽谈时间</Label>
              <Input
                type="datetime-local"
                value={interaction.occurredAt}
                onChange={event =>
                  setInteraction(current => ({
                    ...current,
                    occurredAt: event.target.value,
                  }))
                }
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>一句话摘要 *</Label>
              <Input
                value={interaction.summary}
                onChange={event =>
                  setInteraction(current => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
                placeholder="例：已向品牌提出50万日元坑位费方案"
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>详细记录</Label>
              <Textarea
                value={interaction.details}
                onChange={event =>
                  setInteraction(current => ({
                    ...current,
                    details: event.target.value,
                  }))
                }
                placeholder="对方的诉求、反应、决策条件、报价和未决问题"
                className="min-h-28 border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2">
              <Label>结果</Label>
              <Textarea
                value={interaction.outcome}
                onChange={event =>
                  setInteraction(current => ({
                    ...current,
                    outcome: event.target.value,
                  }))
                }
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2">
              <Label>下一步</Label>
              <Textarea
                value={interaction.nextAction}
                onChange={event =>
                  setInteraction(current => ({
                    ...current,
                    nextAction: event.target.value,
                  }))
                }
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2">
              <Label>下次跟进时间</Label>
              <Input
                type="datetime-local"
                value={interaction.nextFollowUpAt}
                onChange={event =>
                  setInteraction(current => ({
                    ...current,
                    nextFollowUpAt: event.target.value,
                  }))
                }
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2">
              <Label>负责人</Label>
              <Select
                value={interaction.ownerStaffId}
                onValueChange={value =>
                  setInteraction(current => ({
                    ...current,
                    ownerStaffId: value,
                  }))
                }
              >
                <SelectTrigger className="border-white/10 bg-black/20">
                  <SelectValue placeholder="选择负责人" />
                </SelectTrigger>
                <SelectContent>
                  {(overview.data?.staff || []).map((staff: any) => (
                    <SelectItem key={staff.id} value={String(staff.id)}>
                      {staff.name} · {staff.department || "未分配部门"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>洽谈资料（最多10个，每个15MB）</Label>
              <Input
                type="file"
                multiple
                accept=".pdf,.txt,.csv,.md,.json,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                onChange={event =>
                  setFiles(Array.from(event.target.files || []).slice(0, 10))
                }
                className="border-white/10 bg-black/20"
              />
              {files.length > 0 && (
                <p className="text-xs text-slate-500">
                  已选择 {files.length} 个文件
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInteractionOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-violet-500 hover:bg-violet-400"
              disabled={
                !interaction.summary.trim() || interactionMutation.isPending
              }
              onClick={() => void saveInteraction()}
            >
              {interactionMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              保存洽谈记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={meetingOpen}
        onOpenChange={open =>
          open ? openMeetingDialog() : closeMeetingDialog()
        }
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-white/10 bg-[#111319] text-white">
          <DialogHeader>
            <DialogTitle>安排品牌会议</DialogTitle>
            <DialogDescription className="text-slate-400">
              会议会同步生成任务和执行事项，并按设置发送提醒。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>会议标题 *</Label>
              <Input
                value={meeting.title}
                onChange={event =>
                  setMeeting(current => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="例：第二轮合作条件确认"
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2">
              <Label>开始时间 *</Label>
              <Input
                type="datetime-local"
                value={meeting.startsAt}
                onChange={event =>
                  setMeeting(current => ({
                    ...current,
                    startsAt: event.target.value,
                  }))
                }
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2">
              <Label>结束时间</Label>
              <Input
                type="datetime-local"
                value={meeting.endsAt}
                onChange={event =>
                  setMeeting(current => ({
                    ...current,
                    endsAt: event.target.value,
                  }))
                }
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2">
              <Label>负责人 *</Label>
              <Select
                value={meeting.ownerStaffId}
                onValueChange={value =>
                  setMeeting(current => ({ ...current, ownerStaffId: value }))
                }
              >
                <SelectTrigger className="border-white/10 bg-black/20">
                  <SelectValue placeholder="选择负责人" />
                </SelectTrigger>
                <SelectContent>
                  {(overview.data?.staff || []).map((staff: any) => (
                    <SelectItem key={staff.id} value={String(staff.id)}>
                      {staff.name} · {staff.department || "未分配部门"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>地点 / 会议链接</Label>
              <Input
                value={meeting.location}
                onChange={event =>
                  setMeeting(current => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>议程</Label>
              <Textarea
                value={meeting.agenda}
                onChange={event =>
                  setMeeting(current => ({
                    ...current,
                    agenda: event.target.value,
                  }))
                }
                placeholder="要确认的条件、问题和预期结果"
                className="min-h-24 border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>参会员工</Label>
              <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-2">
                {(overview.data?.staff || []).map((staff: any) => {
                  const checked = meeting.attendeeStaffIds.includes(
                    Number(staff.id)
                  );
                  return (
                    <label
                      key={staff.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={value =>
                          setMeeting(current => ({
                            ...current,
                            attendeeStaffIds: value
                              ? [
                                  ...new Set([
                                    ...current.attendeeStaffIds,
                                    Number(staff.id),
                                  ]),
                                ]
                              : current.attendeeStaffIds.filter(
                                  id => id !== Number(staff.id)
                                ),
                          }))
                        }
                      />
                      <span>{staff.name}</span>
                      <span className="text-xs text-slate-500">
                        {staff.department || ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>提前提醒</Label>
              <Select
                value={meeting.reminderMinutesBefore}
                onValueChange={value =>
                  setMeeting(current => ({
                    ...current,
                    reminderMinutesBefore: value,
                  }))
                }
              >
                <SelectTrigger className="border-white/10 bg-black/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30分钟</SelectItem>
                  <SelectItem value="60">1小时</SelectItem>
                  <SelectItem value="180">3小时</SelectItem>
                  <SelectItem value="1440">1天</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-sm">
              <Checkbox
                checked={meeting.notifyBosses}
                onCheckedChange={value =>
                  setMeeting(current => ({
                    ...current,
                    notifyBosses: Boolean(value),
                  }))
                }
              />
              同时提醒系统核心管理者
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeMeetingDialog}>
              取消
            </Button>
            <Button
              className="bg-violet-500 hover:bg-violet-400"
              disabled={
                !meeting.title.trim() ||
                !meeting.ownerStaffId ||
                meetingMutation.isPending
              }
              onClick={() => void saveMeeting()}
            >
              {meetingMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              创建会议和任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dealOpen} onOpenChange={setDealOpen}>
        <DialogContent className="border-white/10 bg-[#111319] text-white">
          <DialogHeader>
            <DialogTitle>更新BD阶段和下一步</DialogTitle>
            <DialogDescription className="text-slate-400">
              阶段变更受现有BD状态机保护，并写入审计记录。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>BD阶段</Label>
              <Select
                value={deal.stage}
                onValueChange={value =>
                  setDeal(current => ({
                    ...current,
                    stage: value as BrandBdStage,
                  }))
                }
              >
                <SelectTrigger className="border-white/10 bg-black/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_BD_STAGE_VALUES.map(stage => (
                    <SelectItem key={stage} value={stage}>
                      {zh
                        ? BRAND_BD_STAGE_LABELS_ZH[stage]
                        : BRAND_BD_STAGE_LABELS[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {deal.stage === "slot_fee" && (
              <div className="space-y-2">
                <Label>坑位费报价（日元）*</Label>
                <Input
                  type="number"
                  min="1"
                  value={deal.slotFeeAmount}
                  onChange={event =>
                    setDeal(current => ({
                      ...current,
                      slotFeeAmount: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-black/20"
                />
              </div>
            )}
            {deal.stage === "guaranteed_roi" && (
              <div className="space-y-2">
                <Label>保证ROI</Label>
                <Input
                  value="投入1 : 销售额2（固定）"
                  disabled
                  className="border-white/10 bg-black/20"
                />
              </div>
            )}
            {deal.stage === "pure_commission" && (
              <div className="space-y-2">
                <Label>纯佣比例（%）*</Label>
                <Input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={deal.pureCommissionRate}
                  onChange={event =>
                    setDeal(current => ({
                      ...current,
                      pureCommissionRate: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-black/20"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>下次跟进时间</Label>
              <Input
                type="datetime-local"
                value={deal.nextFollowUpAt}
                onChange={event =>
                  setDeal(current => ({
                    ...current,
                    nextFollowUpAt: event.target.value,
                  }))
                }
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2">
              <Label>下一步具体行动</Label>
              <Textarea
                value={deal.nextAction}
                onChange={event =>
                  setDeal(current => ({
                    ...current,
                    nextAction: event.target.value,
                  }))
                }
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-2">
              <Label>谈判备注</Label>
              <Textarea
                value={deal.negotiationNotes}
                onChange={event =>
                  setDeal(current => ({
                    ...current,
                    negotiationNotes: event.target.value,
                  }))
                }
                className="min-h-24 border-white/10 bg-black/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDealOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-violet-500 hover:bg-violet-400"
              disabled={dealMutation.isPending}
              onClick={() => void saveDeal()}
            >
              保存更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-white/10 bg-[#111319] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-300" />
              {aiResult?.output?.title || "AI 商务建议"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              模型：{aiResult?.model || "—"} · 只读草稿，不会自动发送
            </DialogDescription>
          </DialogHeader>
          {aiResult?.output && (
            <div className="space-y-5 py-2">
              <div className="rounded-xl border border-violet-400/20 bg-violet-500/8 p-4 leading-7">
                {aiResult.output.summary}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["已确认事实", aiResult.output.facts, FileText],
                  ["建议动作", aiResult.output.recommendations, Target],
                  ["风险", aiResult.output.risks, AlertTriangle],
                  ["缺失信息", aiResult.output.missingInformation, Search],
                  [
                    "下次要问的问题",
                    aiResult.output.questions,
                    MessageSquareText,
                  ],
                  ["会议议程", aiResult.output.meetingAgenda, CalendarClock],
                ].map(([title, items, Icon]) => (
                  <div
                    key={String(title)}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <h4 className="flex items-center gap-2 font-semibold">
                      <Icon className="h-4 w-4 text-violet-300" />
                      {String(title)}
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                      {(items as string[]).map((item, index) => (
                        <li key={index} className="flex gap-2">
                          <span className="text-violet-300">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {aiResult.output.draftMessage && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                  <h4 className="flex items-center gap-2 font-semibold text-amber-200">
                    <Send className="h-4 w-4" />
                    对外跟进草稿（必须人工确认）
                  </h4>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                    {aiResult.output.draftMessage}
                  </p>
                </div>
              )}
              <p className="rounded-lg bg-red-500/8 p-3 text-xs text-red-200">
                {aiResult.output.disclaimer}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
