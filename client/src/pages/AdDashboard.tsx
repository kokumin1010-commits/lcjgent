import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  Plus,
  DollarSign,
  TrendingUp,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  Edit2,
  Save,
  Activity,
  Megaphone,
  Store,
  UserCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Link } from "wouter";

// ===== 翻訳 =====
const translations = {
  ja: {
    title: "広告司令塔",
    subtitle: "広告運用の全体最適化",
    tabDashboard: "ダッシュボード",
    tabCampaign: "キャンペーン管理",
    totalBudget: "総広告予算",
    totalSpend: "実際消耗",
    spendRate: "消耗率",
    totalGmv: "広告GMV",
    totalTargetGmv: "目標GMV合計",
    overallRoi: "全体ROI",
    planCount: "計画数",
    month: "月",
    allMonths: "全部",
    adType: "広告タイプ",
    allTypes: "全部",
    shortVideo: "短视频",
    live: "直播",
    shop: "店舗",
    talent: "达人",
    budget: "予算",
    actualSpend: "消耗",
    targetGmv: "目標GMV",
    targetRoi: "目標ROI",
    actualGmv: "実績GMV",
    actualRoi: "実績ROI",
    total: "合計",
    noData: "データなし",
    addPlan: "計画追加",
    editPlan: "計画編集",
    deletePlan: "削除",
    save: "保存",
    cancel: "キャンセル",
    confirm: "確認",
    deleteConfirm: "この計画を削除しますか？",
    notes: "備考",
    alerts: "アラート",
    alertLowSpend: "消耗率低（予算余り）",
    alertHighRoi: "ROI大幅超過（予算増加可能）",
    alertLowRoi: "ROIが目標未達",
    alertInactive: "未稼働",
    back: "戻る",
    shopName: "店舗名",
    planName: "計画名",
    shopDimension: "店舗維度（品牌方予算）",
    talentDimension: "达人維度（LCJ自社予算）",
    planType: "計画タイプ",
    gmvAchievement: "GMV達成率",
    talentName: "达人名",
    streamerName: "主播名",
    shopPlans: "店舗計画",
    talentPlans: "达人計画",
    totalTalentBudget: "达人総予算",
    totalShopBudget: "店舗総予算",
    expandAll: "すべて展開",
    collapseAll: "すべて折りたたむ",
    shopSummary: "店舗サマリー",
    talentSummary: "达人サマリー",
    avgRoi: "平均ROI",
    liveOnly: "直播のみ",
    status: "ステータス",
    active: "稼働中",
    paused: "一時停止",
    ended: "終了",
    productName: "商品名",
  },
  zh: {
    title: "广告司令塔",
    subtitle: "广告运营全局优化",
    tabDashboard: "仪表盘",
    tabCampaign: "活动管理",
    totalBudget: "总广告预算",
    totalSpend: "实际消耗",
    spendRate: "消耗率",
    totalGmv: "广告GMV",
    totalTargetGmv: "目标GMV合计",
    overallRoi: "整体ROI",
    planCount: "计划数",
    month: "月份",
    allMonths: "全部",
    adType: "广告类型",
    allTypes: "全部",
    shortVideo: "短视频",
    live: "直播",
    shop: "店铺",
    talent: "达人",
    budget: "预算",
    actualSpend: "消耗",
    targetGmv: "目标GMV",
    targetRoi: "目标ROI",
    actualGmv: "实际GMV",
    actualRoi: "实际ROI",
    total: "合计",
    noData: "暂无数据",
    addPlan: "添加计划",
    editPlan: "编辑计划",
    deletePlan: "删除",
    save: "保存",
    cancel: "取消",
    confirm: "确认",
    deleteConfirm: "确定要删除这个计划吗？",
    notes: "备注",
    alerts: "警报",
    alertLowSpend: "消耗率低（预算有余）",
    alertHighRoi: "ROI大幅超过目标（可增加预算）",
    alertLowRoi: "ROI未达标",
    alertInactive: "未启动",
    back: "返回",
    shopName: "店铺名",
    planName: "计划名",
    shopDimension: "店铺维度（品牌方预算）",
    talentDimension: "达人维度（LCJ自有预算）",
    planType: "计划类型",
    gmvAchievement: "GMV达成率",
    talentName: "达人名",
    streamerName: "主播名",
    shopPlans: "店铺计划",
    talentPlans: "达人计划",
    totalTalentBudget: "达人总预算",
    totalShopBudget: "店铺总预算",
    expandAll: "全部展开",
    collapseAll: "全部收起",
    shopSummary: "店铺汇总",
    talentSummary: "达人汇总",
    avgRoi: "平均ROI",
    liveOnly: "仅直播",
    status: "状态",
    active: "生效中",
    paused: "已暂停",
    ended: "已结束",
    productName: "商品名",
  },
};

// ===== ヘルパー =====
function formatCurrency(value: number): string {
  if (value >= 100000000) return `¥${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `¥${(value / 10000).toFixed(0)}万`;
  return `¥${value.toLocaleString()}`;
}

function getRoiColor(actualRoi: number, targetRoi: number): string {
  if (targetRoi <= 0) return "text-gray-400";
  const ratio = actualRoi / targetRoi;
  if (ratio >= 1.5) return "text-emerald-400";
  if (ratio >= 1.0) return "text-green-400";
  if (ratio >= 0.7) return "text-yellow-400";
  return "text-red-400";
}

function getSpendRateColor(rate: number): string {
  if (rate >= 80) return "bg-green-500";
  if (rate >= 50) return "bg-yellow-500";
  if (rate >= 20) return "bg-orange-500";
  return "bg-red-500";
}

function getGmvAchievementColor(rate: number): string {
  if (rate >= 1.0) return "text-emerald-400";
  if (rate >= 0.7) return "text-green-400";
  if (rate >= 0.4) return "text-yellow-400";
  return "text-red-400";
}

function getGmvAchievementBgColor(rate: number): string {
  if (rate >= 1.0) return "bg-emerald-500";
  if (rate >= 0.7) return "bg-green-500";
  if (rate >= 0.4) return "bg-yellow-500";
  return "bg-red-500";
}

// ===== メインコンポーネント =====
export default function AdDashboard() {
  const { language } = useLanguage();
  const lang = language === "zh" ? "zh" : "ja";
  const t = translations[lang];

  // Generate month options (current month + past 5 months)
  const monthOptions = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0] || "");
  const [selectedAdType, setSelectedAdType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [defaultPlanType, setDefaultPlanType] = useState<"shop" | "talent">("shop");
  const [expandedTalents, setExpandedTalents] = useState<Set<string>>(new Set());

  // Data queries - using tiktokAdPlanner router
  const { data: shopPlansRaw, isLoading: shopLoading, refetch: refetchShop } = trpc.tiktokAdPlanner.getPlans.useQuery({
    planType: "shop",
    month: selectedMonth || undefined,
    adType: selectedAdType !== "all" ? (selectedAdType as "video" | "live") : undefined,
  });

  const { data: talentPlansRaw, isLoading: talentLoading, refetch: refetchTalent } = trpc.tiktokAdPlanner.getPlans.useQuery({
    planType: "talent",
    month: selectedMonth || undefined,
  });

  const { data: monthlySummary, isLoading: summaryLoading } = trpc.tiktokAdPlanner.getMonthlySummary.useQuery(
    { month: selectedMonth },
    { enabled: !!selectedMonth }
  );

  const shopPlans = shopPlansRaw || [];
  const talentPlans = talentPlansRaw || [];

  const refetchAll = () => { refetchShop(); refetchTalent(); };

  const createPlan = trpc.tiktokAdPlanner.createPlan.useMutation({
    onSuccess: () => {
      toast.success(lang === "ja" ? "計画を追加しました" : "计划已添加");
      setShowAddDialog(false);
      refetchAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePlan = trpc.tiktokAdPlanner.updatePlan.useMutation({
    onSuccess: () => {
      toast.success(lang === "ja" ? "更新しました" : "已更新");
      setEditingPlan(null);
      refetchAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePlan = trpc.tiktokAdPlanner.deletePlan.useMutation({
    onSuccess: () => {
      toast.success(lang === "ja" ? "削除しました" : "已删除");
      refetchAll();
    },
    onError: (e) => toast.error(e.message),
  });

  // Compute summaries from plan data
  const { shopSummary, talentSummary, talentGrouped } = useMemo(() => {
    // Shop summary
    const sBudget = shopPlans.reduce((s: number, p: any) => s + (p.budget ?? 0), 0);
    const sSpent = shopPlans.reduce((s: number, p: any) => s + (p.spent ?? 0), 0);
    const sTargetGmv = shopPlans.reduce((s: number, p: any) => s + (p.targetGmv ?? 0), 0);
    const sActualGmv = shopPlans.reduce((s: number, p: any) => s + (p.actualGmv ?? 0), 0);
    const sRoi = sSpent > 0 ? sActualGmv / sSpent : 0;

    // Talent summary
    const tBudget = talentPlans.reduce((s: number, p: any) => s + (p.budget ?? 0), 0);
    const tSpent = talentPlans.reduce((s: number, p: any) => s + (p.spent ?? 0), 0);
    const tTargetGmv = talentPlans.reduce((s: number, p: any) => s + (p.targetGmv ?? 0), 0);
    const tActualGmv = talentPlans.reduce((s: number, p: any) => s + (p.actualGmv ?? 0), 0);
    const tRoi = tSpent > 0 ? tActualGmv / tSpent : 0;

    // Group talent plans by talentName
    const grouped: Record<string, any[]> = {};
    for (const p of talentPlans) {
      const key = p.talentName || p.streamerName || "Unknown";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    }

    return {
      shopSummary: { budget: sBudget, spent: sSpent, targetGmv: sTargetGmv, actualGmv: sActualGmv, roi: sRoi, count: shopPlans.length },
      talentSummary: { budget: tBudget, spent: tSpent, targetGmv: tTargetGmv, actualGmv: tActualGmv, roi: tRoi, count: talentPlans.length },
      talentGrouped: grouped,
    };
  }, [shopPlans, talentPlans]);

  // Generate alerts
  const alerts = useMemo(() => {
    const allPlans = [...shopPlans, ...talentPlans];
    const result: { type: string; message: string; severity: "warning" | "info" | "danger" }[] = [];

    for (const plan of allPlans) {
      const spentRate = Number(plan.spentRate) || 0;
      const actualRoi = Number(plan.actualRoi) || 0;
      const targetRoi = Number(plan.targetRoi) || 0;
      const budget = plan.budget ?? 0;
      const spent = plan.spent ?? 0;
      const targetGmv = plan.targetGmv ?? 0;
      const actualGmv = plan.actualGmv ?? 0;
      const isTalent = plan.planType === "talent";
      const planLabel = isTalent ? (plan.talentName || plan.streamerName) : plan.shopName;

      if (budget > 0 && spent === 0) {
        result.push({ type: "inactive", message: `${planLabel}: ${t.alertInactive}`, severity: "warning" });
      } else if (spentRate > 0 && spentRate < 30 && budget > 0) {
        result.push({ type: "lowSpend", message: `${planLabel}: ${t.alertLowSpend} (${spentRate.toFixed(0)}%)`, severity: "info" });
      }

      if (targetRoi > 0 && actualRoi > 0) {
        if (actualRoi >= targetRoi * 2) {
          result.push({ type: "highRoi", message: `${planLabel}: ${t.alertHighRoi} (ROI ${actualRoi.toFixed(1)} vs ${t.targetRoi} ${targetRoi.toFixed(1)})`, severity: "info" });
        } else if (actualRoi < targetRoi * 0.5) {
          result.push({ type: "lowRoi", message: `${planLabel}: ${t.alertLowRoi} (ROI ${actualRoi.toFixed(1)} vs ${t.targetRoi} ${targetRoi.toFixed(1)})`, severity: "danger" });
        }
      }

      if (targetGmv > 0 && actualGmv > 0 && actualGmv < targetGmv * 0.3) {
        result.push({ type: "lowGmv", message: `${planLabel}: GMV${lang === "ja" ? "達成率が低い" : "达成率低"} (${((actualGmv / targetGmv) * 100).toFixed(0)}%)`, severity: "danger" });
      }
    }
    return result;
  }, [shopPlans, talentPlans, t, lang]);

  const toggleTalent = (name: string) => {
    setExpandedTalents((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAllTalents = () => {
    const allNames = Object.keys(talentGrouped);
    if (expandedTalents.size === allNames.length) {
      setExpandedTalents(new Set());
    } else {
      setExpandedTalents(new Set(allNames));
    }
  };

  const totalBudget = (shopSummary?.budget ?? 0) + (talentSummary?.budget ?? 0);
  const totalSpent = (shopSummary?.spent ?? 0) + (talentSummary?.spent ?? 0);
  const totalTargetGmv = (shopSummary?.targetGmv ?? 0) + (talentSummary?.targetGmv ?? 0);
  const totalActualGmv = (shopSummary?.actualGmv ?? 0) + (talentSummary?.actualGmv ?? 0);
  const overallRoi = totalSpent > 0 ? totalActualGmv / totalSpent : 0;
  const overallSpendRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const overallGmvRate = totalTargetGmv > 0 ? totalActualGmv / totalTargetGmv : 0;
  const isLoading = shopLoading || talentLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-amber-900/30 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/master">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {t.back}
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Megaphone className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                    {t.title}
                  </h1>
                  <p className="text-xs text-gray-500">{t.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px] bg-gray-800/50 border-gray-700 text-sm">
                  <SelectValue placeholder={t.allMonths} />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Ad type filter - NO "mixed" option, only 全部/短视频/直播 */}
              <Select value={selectedAdType} onValueChange={setSelectedAdType}>
                <SelectTrigger className="w-[120px] bg-gray-800/50 border-gray-700 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allTypes}</SelectItem>
                  <SelectItem value="video">{t.shortVideo}</SelectItem>
                  <SelectItem value="live">{t.live}</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                onClick={() => { setDefaultPlanType("shop"); setShowAddDialog(true); }}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t.addPlan}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - IMPROVED: brighter inactive text, icons, badges */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-800/50 border border-gray-700/50 p-1">
            <TabsTrigger
              value="dashboard"
              className="text-gray-200 data-[state=inactive]:text-gray-300 data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400 data-[state=active]:shadow-sm transition-all"
            >
              <BarChart3 className="h-4 w-4 mr-1.5" />
              {t.tabDashboard}
              <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-current opacity-70">
                {shopPlans.length + talentPlans.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="campaign"
              className="text-gray-200 data-[state=inactive]:text-gray-300 data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400 data-[state=active]:shadow-sm transition-all"
            >
              <Target className="h-4 w-4 mr-1.5" />
              {t.tabCampaign}
            </TabsTrigger>
          </TabsList>

          {/* ===== Tab 1: Dashboard ===== */}
          <TabsContent value="dashboard" className="mt-4 space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <KpiCard
                icon={<DollarSign className="h-4 w-4" />}
                label={t.totalBudget}
                value={formatCurrency(totalBudget)}
                color="amber"
                loading={isLoading}
              />
              <KpiCard
                icon={<Activity className="h-4 w-4" />}
                label={t.totalSpend}
                value={formatCurrency(totalSpent)}
                sub={`${t.spendRate}: ${overallSpendRate.toFixed(1)}%`}
                color="orange"
                loading={isLoading}
              />
              <KpiCard
                icon={<Target className="h-4 w-4" />}
                label={t.totalTargetGmv}
                value={formatCurrency(totalTargetGmv)}
                color="blue"
                loading={isLoading}
              />
              <KpiCard
                icon={<TrendingUp className="h-4 w-4" />}
                label={t.totalGmv}
                value={formatCurrency(totalActualGmv)}
                sub={`${t.gmvAchievement}: ${(overallGmvRate * 100).toFixed(0)}%`}
                color="green"
                loading={isLoading}
              />
              <KpiCard
                icon={<Zap className="h-4 w-4" />}
                label={t.overallRoi}
                value={overallRoi.toFixed(2)}
                color="cyan"
                loading={isLoading}
              />
              <KpiCard
                icon={<Store className="h-4 w-4" />}
                label={t.planCount}
                value={String(shopPlans.length + talentPlans.length)}
                color="purple"
                loading={isLoading}
              />
            </div>

            {/* Shop/Talent Mini Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Shop Summary */}
              <Card className="bg-gradient-to-br from-amber-900/20 to-amber-950/10 border-amber-800/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Store className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-400">{t.shopSummary}</span>
                    <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-300">{shopSummary.count}</Badge>
                  </div>
                  <div className="grid grid-cols-5 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">{t.budget}</span>
                      <p className="text-gray-200 font-bold">{formatCurrency(shopSummary.budget)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t.actualSpend}</span>
                      <p className="text-gray-200 font-bold">{formatCurrency(shopSummary.spent)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t.targetGmv}</span>
                      <p className="text-amber-300 font-bold">{formatCurrency(shopSummary.targetGmv)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t.actualGmv}</span>
                      <p className="text-green-400 font-bold">{formatCurrency(shopSummary.actualGmv)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">ROI</span>
                      <p className="text-amber-400 font-bold">{shopSummary.roi.toFixed(1)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Talent Summary */}
              <Card className="bg-gradient-to-br from-cyan-900/20 to-cyan-950/10 border-cyan-800/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserCircle className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-bold text-cyan-400">{t.talentSummary}</span>
                    <Badge variant="outline" className="text-[10px] border-cyan-700 text-cyan-300">{talentSummary.count}</Badge>
                    <Badge variant="outline" className="text-[9px] border-cyan-800 text-cyan-400/70">{t.liveOnly}</Badge>
                  </div>
                  <div className="grid grid-cols-5 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">{t.budget}</span>
                      <p className="text-gray-200 font-bold">{formatCurrency(talentSummary.budget)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t.actualSpend}</span>
                      <p className="text-gray-200 font-bold">{formatCurrency(talentSummary.spent)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t.targetGmv}</span>
                      <p className="text-cyan-300 font-bold">{formatCurrency(talentSummary.targetGmv)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{t.actualGmv}</span>
                      <p className="text-green-400 font-bold">{formatCurrency(talentSummary.actualGmv)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">ROI</span>
                      <p className="text-cyan-400 font-bold">{talentSummary.roi.toFixed(1)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {t.alerts} ({alerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {alerts.slice(0, 10).map((alert, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                        alert.severity === "danger"
                          ? "bg-red-900/20 text-red-300 border border-red-800/30"
                          : alert.severity === "warning"
                          ? "bg-yellow-900/20 text-yellow-300 border border-yellow-800/30"
                          : "bg-blue-900/20 text-blue-300 border border-blue-800/30"
                      }`}
                    >
                      {alert.severity === "danger" ? (
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      ) : alert.severity === "warning" ? (
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                      )}
                      {alert.message}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ===== 店舗維度 (Shop Plans) - NO brand column, has adType ===== */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    {t.shopDimension}
                    <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-300 ml-1">
                      {shopPlans.length}
                    </Badge>
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-amber-700/50 text-amber-300 hover:bg-amber-900/30"
                    onClick={() => { setDefaultPlanType("shop"); setShowAddDialog(true); }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t.shop}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {shopLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  </div>
                ) : !shopPlans.length ? (
                  <div className="text-center py-8 text-gray-500">{t.noData}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-400">
                          <th className="text-left py-2 px-2">{t.month}</th>
                          <th className="text-left py-2 px-2">{t.shopName}</th>
                          <th className="text-left py-2 px-2">{t.adType}</th>
                          <th className="text-right py-2 px-2">{t.budget}</th>
                          <th className="text-right py-2 px-2">{t.actualSpend}</th>
                          <th className="text-right py-2 px-2">{t.spendRate}</th>
                          <th className="text-right py-2 px-2">{t.targetGmv}</th>
                          <th className="text-right py-2 px-2">{t.actualGmv}</th>
                          <th className="text-right py-2 px-2">{t.gmvAchievement}</th>
                          <th className="text-right py-2 px-2">{t.targetRoi}</th>
                          <th className="text-right py-2 px-2">{t.actualRoi}</th>
                          <th className="text-center py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {shopPlans.map((plan: any) => {
                          const roi = Number(plan.actualRoi) || 0;
                          const tRoi = Number(plan.targetRoi) || 0;
                          const sr = Number(plan.spentRate) || 0;
                          const tGmv = plan.targetGmv ?? 0;
                          const aGmv = plan.actualGmv ?? 0;
                          const gmvRate = tGmv > 0 ? aGmv / tGmv : 0;
                          return (
                            <tr key={plan.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                              <td className="py-2 px-2 text-gray-300">{plan.month}</td>
                              <td className="py-2 px-2 text-amber-300 font-medium">{plan.shopName || plan.planName}</td>
                              <td className="py-2 px-2">
                                <Badge variant="outline" className="text-[10px] border-gray-600">
                                  {plan.adType === "video" ? t.shortVideo : t.live}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(plan.budget ?? 0)}</td>
                              <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(plan.spent ?? 0)}</td>
                              <td className="py-2 px-2 text-right">
                                <span className={sr > 70 ? "text-green-400" : sr > 30 ? "text-yellow-400" : "text-red-400"}>
                                  {sr.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right text-amber-300/80">{formatCurrency(tGmv)}</td>
                              <td className="py-2 px-2 text-right text-green-400 font-medium">{formatCurrency(aGmv)}</td>
                              <td className="py-2 px-2 text-right">
                                {tGmv > 0 ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${getGmvAchievementBgColor(gmvRate)}`}
                                        style={{ width: `${Math.min(gmvRate * 100, 100)}%` }}
                                      />
                                    </div>
                                    <span className={`${getGmvAchievementColor(gmvRate)} font-medium`}>
                                      {(gmvRate * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right text-gray-400">{tRoi.toFixed(1)}</td>
                              <td className={`py-2 px-2 text-right font-bold ${getRoiColor(roi, tRoi)}`}>
                                {roi.toFixed(1)}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-gray-400 hover:text-amber-400"
                                    onClick={() => setEditingPlan(plan)}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
                                    onClick={() => {
                                      if (confirm(t.deleteConfirm)) {
                                        deletePlan.mutate({ id: plan.id });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Shop Total Row */}
                        {shopPlans.length > 1 && (
                          <tr className="border-t-2 border-amber-800/50 bg-amber-900/10 font-medium">
                            <td className="py-2 px-2 text-amber-400 font-bold" colSpan={3}>{t.total}</td>
                            <td className="py-2 px-2 text-right text-amber-300">{formatCurrency(shopSummary.budget)}</td>
                            <td className="py-2 px-2 text-right text-amber-300">{formatCurrency(shopSummary.spent)}</td>
                            <td className="py-2 px-2 text-right text-amber-300">
                              {shopSummary.budget > 0 ? ((shopSummary.spent / shopSummary.budget) * 100).toFixed(1) : "0"}%
                            </td>
                            <td className="py-2 px-2 text-right text-amber-300">{formatCurrency(shopSummary.targetGmv)}</td>
                            <td className="py-2 px-2 text-right text-green-400 font-bold">{formatCurrency(shopSummary.actualGmv)}</td>
                            <td className="py-2 px-2 text-right">
                              {shopSummary.targetGmv > 0 ? (
                                <span className={getGmvAchievementColor(shopSummary.actualGmv / shopSummary.targetGmv)}>
                                  {((shopSummary.actualGmv / shopSummary.targetGmv) * 100).toFixed(0)}%
                                </span>
                              ) : "-"}
                            </td>
                            <td className="py-2 px-2 text-right text-gray-400">-</td>
                            <td className="py-2 px-2 text-right text-amber-400 font-bold">{shopSummary.roi.toFixed(1)}</td>
                            <td className="py-2 px-2"></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ===== 达人維度 (Talent Plans) - NO brand, NO adType column, live only ===== */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-cyan-400 flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    {t.talentDimension}
                    <Badge variant="outline" className="text-[10px] border-cyan-700 text-cyan-300 ml-1">
                      {talentPlans.length}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] border-cyan-800/50 text-cyan-400/60 ml-0.5">
                      {t.liveOnly}
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {Object.keys(talentGrouped).length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-gray-400 hover:text-white"
                        onClick={toggleAllTalents}
                      >
                        {expandedTalents.size === Object.keys(talentGrouped).length ? t.collapseAll : t.expandAll}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/30"
                      onClick={() => { setDefaultPlanType("talent"); setShowAddDialog(true); }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t.talent}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {talentLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                  </div>
                ) : !talentPlans.length ? (
                  <div className="text-center py-8 text-gray-500">{t.noData}</div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(talentGrouped).map(([talentName, plans]) => {
                      const isExpanded = expandedTalents.has(talentName);
                      const grpBudget = plans.reduce((s: number, p: any) => s + (p.budget ?? 0), 0);
                      const grpSpent = plans.reduce((s: number, p: any) => s + (p.spent ?? 0), 0);
                      const grpActualGmv = plans.reduce((s: number, p: any) => s + (p.actualGmv ?? 0), 0);
                      const grpTargetGmv = plans.reduce((s: number, p: any) => s + (p.targetGmv ?? 0), 0);
                      const grpRoi = grpSpent > 0 ? grpActualGmv / grpSpent : 0;
                      const gmvRate = grpTargetGmv > 0 ? grpActualGmv / grpTargetGmv : 0;

                      return (
                        <div key={talentName} className="border border-gray-800 rounded-lg overflow-hidden">
                          {/* Talent Header (collapsible) */}
                          <div
                            className="flex items-center justify-between px-4 py-3 bg-gray-800/40 cursor-pointer hover:bg-gray-800/60 transition-colors"
                            onClick={() => toggleTalent(talentName)}
                          >
                            <div className="flex items-center gap-3">
                              <UserCircle className="h-5 w-5 text-cyan-400" />
                              <div>
                                <span className="text-sm font-bold text-cyan-300">{talentName}</span>
                                <span className="text-[10px] text-gray-500 ml-2">{plans.length} {lang === "ja" ? "件" : "条"}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <div className="text-right">
                                <span className="text-gray-500">{t.budget}</span>
                                <p className="text-gray-200 font-medium">{formatCurrency(grpBudget)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-500">{t.actualSpend}</span>
                                <p className="text-gray-200 font-medium">{formatCurrency(grpSpent)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-500">{t.targetGmv}</span>
                                <p className="text-cyan-300 font-medium">{formatCurrency(grpTargetGmv)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-500">{t.actualGmv}</span>
                                <p className="text-green-400 font-medium">{formatCurrency(grpActualGmv)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-500">ROI</span>
                                <p className={`font-bold ${getRoiColor(grpRoi, 3)}`}>{grpRoi.toFixed(1)}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-500">{t.gmvAchievement}</span>
                                <p className={`font-medium ${getGmvAchievementColor(gmvRate)}`}>
                                  {grpTargetGmv > 0 ? `${(gmvRate * 100).toFixed(0)}%` : "-"}
                                </p>
                              </div>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                            </div>
                          </div>

                          {/* Expanded detail - simplified for talent (no brand, no adType) */}
                          {isExpanded && (
                            <div className="px-4 py-2 bg-gray-900/30">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-800 text-gray-400">
                                    <th className="text-left py-2 px-2">{t.month}</th>
                                    <th className="text-left py-2 px-2">{t.planName}</th>
                                    <th className="text-right py-2 px-2">{t.budget}</th>
                                    <th className="text-right py-2 px-2">{t.actualSpend}</th>
                                    <th className="text-right py-2 px-2">{t.spendRate}</th>
                                    <th className="text-right py-2 px-2">{t.targetGmv}</th>
                                    <th className="text-right py-2 px-2">{t.actualGmv}</th>
                                    <th className="text-right py-2 px-2">{t.gmvAchievement}</th>
                                    <th className="text-right py-2 px-2">ROI</th>
                                    <th className="text-center py-2 px-2"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {plans.map((plan: any) => {
                                    const roi = Number(plan.actualRoi) || 0;
                                    const tRoi = Number(plan.targetRoi) || 0;
                                    const sr = Number(plan.spentRate) || 0;
                                    const tGmv = plan.targetGmv ?? 0;
                                    const aGmv = plan.actualGmv ?? 0;
                                    const gr = tGmv > 0 ? aGmv / tGmv : 0;
                                    return (
                                      <tr key={plan.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                        <td className="py-2 px-2 text-gray-300">{plan.month}</td>
                                        <td className="py-2 px-2 text-cyan-300 font-medium">{plan.planName}</td>
                                        <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(plan.budget ?? 0)}</td>
                                        <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(plan.spent ?? 0)}</td>
                                        <td className="py-2 px-2 text-right">
                                          <span className={sr > 70 ? "text-green-400" : sr > 30 ? "text-yellow-400" : "text-red-400"}>
                                            {sr.toFixed(1)}%
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-right text-cyan-300/80">{formatCurrency(tGmv)}</td>
                                        <td className="py-2 px-2 text-right text-green-400 font-medium">{formatCurrency(aGmv)}</td>
                                        <td className="py-2 px-2 text-right">
                                          {tGmv > 0 ? (
                                            <div className="flex items-center justify-end gap-1">
                                              <div className="w-10 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full ${getGmvAchievementBgColor(gr)}`}
                                                  style={{ width: `${Math.min(gr * 100, 100)}%` }}
                                                />
                                              </div>
                                              <span className={`${getGmvAchievementColor(gr)} font-medium`}>
                                                {(gr * 100).toFixed(0)}%
                                              </span>
                                            </div>
                                          ) : (
                                            <span className="text-gray-600">-</span>
                                          )}
                                        </td>
                                        <td className={`py-2 px-2 text-right font-bold ${getRoiColor(roi, tRoi)}`}>
                                          {roi.toFixed(1)}
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                          <div className="flex items-center gap-1 justify-center">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 text-gray-400 hover:text-cyan-400"
                                              onClick={(e) => { e.stopPropagation(); setEditingPlan(plan); }}
                                            >
                                              <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(t.deleteConfirm)) {
                                                  deletePlan.mutate({ id: plan.id });
                                                }
                                              }}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Tab 2: Campaign Management ===== */}
          <TabsContent value="campaign" className="mt-4 space-y-4">
            {/* Shop Campaigns */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    {t.shopPlans}
                    <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-300">{shopPlans.length}</Badge>
                  </CardTitle>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-amber-600 to-orange-600"
                    onClick={() => { setDefaultPlanType("shop"); setShowAddDialog(true); }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t.shop}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {shopLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  </div>
                ) : !shopPlans.length ? (
                  <div className="text-center py-8 text-gray-500">
                    <Store className="h-10 w-10 mx-auto mb-2 text-gray-600" />
                    <p>{t.noData}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {shopPlans.map((plan: any) => (
                      <CampaignCard key={plan.id} plan={plan} t={t} onEdit={setEditingPlan} onDelete={(id) => {
                        if (confirm(t.deleteConfirm)) deletePlan.mutate({ id });
                      }} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Talent Campaigns */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-cyan-400 flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    {t.talentPlans}
                    <Badge variant="outline" className="text-[10px] border-cyan-700 text-cyan-300">{talentPlans.length}</Badge>
                    <Badge variant="outline" className="text-[9px] border-cyan-800/50 text-cyan-400/60">{t.liveOnly}</Badge>
                  </CardTitle>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-cyan-600 to-blue-600"
                    onClick={() => { setDefaultPlanType("talent"); setShowAddDialog(true); }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t.talent}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {talentLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                  </div>
                ) : !talentPlans.length ? (
                  <div className="text-center py-8 text-gray-500">
                    <UserCircle className="h-10 w-10 mx-auto mb-2 text-gray-600" />
                    <p>{t.noData}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {talentPlans.map((plan: any) => (
                      <CampaignCard key={plan.id} plan={plan} t={t} isTalent onEdit={setEditingPlan} onDelete={(id) => {
                        if (confirm(t.deleteConfirm)) deletePlan.mutate({ id });
                      }} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Dialog */}
      <PlanDialog
        open={showAddDialog || !!editingPlan}
        onClose={() => { setShowAddDialog(false); setEditingPlan(null); }}
        plan={editingPlan}
        t={t}
        lang={lang}
        defaultPlanType={editingPlan?.planType || defaultPlanType}
        onSave={(data) => {
          if (editingPlan) {
            updatePlan.mutate({ id: editingPlan.id, ...data });
          } else {
            createPlan.mutate(data);
          }
        }}
        saving={createPlan.isPending || updatePlan.isPending}
      />
    </div>
  );
}

// ===== KPI Card Component =====
function KpiCard({ icon, label, value, sub, color, loading }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  loading?: boolean;
}) {
  const colorMap: Record<string, string> = {
    amber: "from-amber-600/20 to-amber-800/10 border-amber-700/30",
    orange: "from-orange-600/20 to-orange-800/10 border-orange-700/30",
    green: "from-green-600/20 to-green-800/10 border-green-700/30",
    cyan: "from-cyan-600/20 to-cyan-800/10 border-cyan-700/30",
    purple: "from-purple-600/20 to-purple-800/10 border-purple-700/30",
    pink: "from-pink-600/20 to-pink-800/10 border-pink-700/30",
    blue: "from-blue-600/20 to-blue-800/10 border-blue-700/30",
  };
  const textMap: Record<string, string> = {
    amber: "text-amber-400",
    orange: "text-orange-400",
    green: "text-green-400",
    cyan: "text-cyan-400",
    purple: "text-purple-400",
    pink: "text-pink-400",
    blue: "text-blue-400",
  };

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} border`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={textMap[color]}>{icon}</span>
          <span className="text-[10px] text-gray-400 truncate">{label}</span>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        ) : (
          <>
            <p className={`text-lg font-bold ${textMap[color]}`}>{value}</p>
            {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Campaign Card Component =====
function CampaignCard({ plan, t, isTalent, onEdit, onDelete }: {
  plan: any;
  t: typeof translations.ja;
  isTalent?: boolean;
  onEdit: (plan: any) => void;
  onDelete: (id: number) => void;
}) {
  const roi = Number(plan.actualRoi) || 0;
  const tRoi = Number(plan.targetRoi) || 0;
  const sr = Number(plan.spentRate) || 0;
  const tGmv = plan.targetGmv ?? 0;
  const aGmv = plan.actualGmv ?? 0;
  const gmvRate = tGmv > 0 ? aGmv / tGmv : 0;
  const displayName = isTalent ? (plan.talentName || plan.streamerName || plan.planName) : (plan.shopName || plan.planName);

  return (
    <Card
      className={`bg-gray-800/50 border border-gray-700/50 hover:border-${isTalent ? "cyan" : "amber"}-600/50 transition-colors cursor-pointer`}
      onClick={() => onEdit(plan)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-[10px] border-gray-600 text-gray-400">
            {plan.month}
          </Badge>
          <div className="flex items-center gap-1">
            {!isTalent && (
              <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-300">
                {plan.adType === "video" ? t.shortVideo : t.live}
              </Badge>
            )}
            {isTalent && (
              <Badge variant="outline" className="text-[10px] border-cyan-700 text-cyan-300">
                {t.live}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-gray-500 hover:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(plan.id); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <h3 className={`text-sm font-bold ${isTalent ? "text-cyan-300" : "text-amber-300"}`}>{displayName}</h3>
        {plan.planName && plan.planName !== displayName && (
          <p className="text-[10px] text-gray-500 mt-0.5">{plan.planName}</p>
        )}

        {/* Spend rate bar */}
        <div className="mb-2 mt-2">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>{t.spendRate}</span>
            <span>{sr.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getSpendRateColor(sr)}`}
              style={{ width: `${Math.min(sr, 100)}%` }}
            />
          </div>
        </div>

        {/* GMV Achievement bar */}
        {tGmv > 0 && (
          <div className="mb-2">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>{t.gmvAchievement}</span>
              <span className={getGmvAchievementColor(gmvRate)}>{(gmvRate * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getGmvAchievementBgColor(gmvRate)}`}
                style={{ width: `${Math.min(gmvRate * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">{t.budget}</span>
            <p className="text-gray-200 font-medium">{formatCurrency(plan.budget ?? 0)}</p>
          </div>
          <div>
            <span className="text-gray-500">{t.actualSpend}</span>
            <p className="text-gray-200 font-medium">{formatCurrency(plan.spent ?? 0)}</p>
          </div>
          <div>
            <span className="text-gray-500">{t.targetGmv}</span>
            <p className="text-gray-300 font-medium">{formatCurrency(tGmv)}</p>
          </div>
          <div>
            <span className="text-gray-500">{t.actualGmv}</span>
            <p className="text-green-400 font-medium">{formatCurrency(aGmv)}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">ROI</span>
            <p className={`font-bold ${getRoiColor(roi, tRoi)}`}>
              {roi.toFixed(1)}
              {tRoi > 0 && (
                <span className="text-gray-500 font-normal"> / {tRoi.toFixed(1)}</span>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Plan Dialog Component - IMPROVED =====
function PlanDialog({ open, onClose, plan, t, lang, defaultPlanType, onSave, saving }: {
  open: boolean;
  onClose: () => void;
  plan: any;
  t: typeof translations.ja;
  lang: string;
  defaultPlanType: "shop" | "talent";
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<any>({});

  // Reset form when plan changes
  const resetForm = useCallback(() => {
    if (plan) {
      setForm({
        planType: plan.planType || "shop",
        month: plan.month || "",
        shopName: plan.shopName || "",
        adType: plan.adType || "live",
        planName: plan.planName || "",
        status: plan.status || "active",
        budget: plan.budget ?? 0,
        spent: plan.spent ?? 0,
        targetGmv: plan.targetGmv ?? 0,
        targetRoi: Number(plan.targetRoi) || 0,
        actualGmv: plan.actualGmv ?? 0,
        actualRoi: Number(plan.actualRoi) || 0,
        talentName: plan.talentName || "",
        streamerName: plan.streamerName || "",
        productName: plan.productName || "",
        notes: plan.notes || "",
      });
    } else {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      setForm({
        planType: defaultPlanType,
        month: currentMonth,
        shopName: "",
        adType: defaultPlanType === "talent" ? "live" : "live",
        planName: "",
        status: "active",
        budget: 0,
        spent: 0,
        targetGmv: 0,
        targetRoi: 0,
        actualGmv: 0,
        actualRoi: 0,
        talentName: "",
        streamerName: "",
        productName: "",
        notes: "",
      });
    }
  }, [plan, defaultPlanType]);

  // Reset when dialog opens
  useMemo(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  const isTalent = form.planType === "talent";

  const handleSubmit = () => {
    if (!form.planName || !form.month) {
      toast.error(lang === "ja" ? "計画名と月は必須です" : "计划名和月份为必填项");
      return;
    }
    const submitData = { ...form };
    if (isTalent) {
      submitData.adType = "live"; // Force live for talent
    }
    onSave(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={isTalent ? "text-cyan-400" : "text-amber-400"}>
            {plan ? t.editPlan : t.addPlan}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Plan Type */}
          <div>
            <label className="text-xs text-gray-400">{t.planType}</label>
            <div className="flex gap-2 mt-1">
              <Button
                size="sm"
                variant={form.planType !== "talent" ? "default" : "outline"}
                className={form.planType !== "talent"
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "border-gray-600 text-gray-400 hover:text-white"
                }
                onClick={() => setForm({ ...form, planType: "shop" })}
                disabled={!!plan}
              >
                <Store className="h-3 w-3 mr-1" />
                {t.shop}
              </Button>
              <Button
                size="sm"
                variant={form.planType === "talent" ? "default" : "outline"}
                className={form.planType === "talent"
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                  : "border-gray-600 text-gray-400 hover:text-white"
                }
                onClick={() => setForm({ ...form, planType: "talent", adType: "live" })}
                disabled={!!plan}
              >
                <UserCircle className="h-3 w-3 mr-1" />
                {t.talent}
              </Button>
            </div>
          </div>

          {/* Month */}
          <div>
            <label className="text-xs text-gray-400">{t.month}</label>
            <Input
              type="month"
              value={form.month || ""}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
              disabled={!!plan}
            />
          </div>

          {/* Plan Name */}
          <div>
            <label className="text-xs text-gray-400">{t.planName}</label>
            <Input
              placeholder={t.planName}
              value={form.planName || ""}
              onChange={(e) => setForm({ ...form, planName: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Shop Name (shop only) */}
          {!isTalent && (
            <div>
              <label className="text-xs text-gray-400">{t.shopName}</label>
              <Input
                placeholder={t.shopName}
                value={form.shopName || ""}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          )}

          {/* Talent Name + Streamer Name (talent only) */}
          {isTalent && (
            <>
              <div>
                <label className="text-xs text-gray-400">{t.talentName}</label>
                <Input
                  placeholder={t.talentName}
                  value={form.talentName || ""}
                  onChange={(e) => setForm({ ...form, talentName: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">{t.streamerName}</label>
                <Input
                  placeholder={t.streamerName}
                  value={form.streamerName || ""}
                  onChange={(e) => setForm({ ...form, streamerName: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </>
          )}

          {/* Ad Type - shop: video/live selector, talent: fixed "live" display */}
          {!isTalent ? (
            <div>
              <label className="text-xs text-gray-400">{t.adType}</label>
              <Select value={form.adType || "live"} onValueChange={(v) => setForm({ ...form, adType: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">{t.shortVideo}</SelectItem>
                  <SelectItem value="live">{t.live}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-400">{t.adType}</label>
              <div className="mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-cyan-300">
                {t.live} ({lang === "ja" ? "达人は直播のみ" : "达人仅直播"})
              </div>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="text-xs text-gray-400">{t.productName}</label>
            <Input
              placeholder={t.productName}
              value={form.productName || ""}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Budget & Spend */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">{t.budget} (JPY)</label>
              <Input
                type="number"
                value={form.budget || 0}
                onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">{t.actualSpend} (JPY)</label>
              <Input
                type="number"
                value={form.spent || 0}
                onChange={(e) => setForm({ ...form, spent: Number(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          {/* Target GMV & ROI */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">{t.targetGmv} (JPY)</label>
              <Input
                type="number"
                value={form.targetGmv || 0}
                onChange={(e) => setForm({ ...form, targetGmv: Number(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">{t.targetRoi}</label>
              <Input
                type="number"
                step="0.1"
                value={form.targetRoi || 0}
                onChange={(e) => setForm({ ...form, targetRoi: Number(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          {/* Actual GMV & ROI */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">{t.actualGmv} (JPY)</label>
              <Input
                type="number"
                value={form.actualGmv || 0}
                onChange={(e) => setForm({ ...form, actualGmv: Number(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">{t.actualRoi}</label>
              <Input
                type="number"
                step="0.1"
                value={form.actualRoi || 0}
                onChange={(e) => setForm({ ...form, actualRoi: Number(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400">{t.notes}</label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose} className="text-gray-400">
            {t.cancel}
          </Button>
          <Button
            className={isTalent
              ? "bg-gradient-to-r from-cyan-600 to-blue-600"
              : "bg-gradient-to-r from-amber-600 to-orange-600"
            }
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
