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
  Grid3X3,
  Plus,
  DollarSign,
  TrendingUp,
  Target,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  Edit2,
  Save,
  Upload,
  RefreshCw,
  Activity,
  Eye,
  Megaphone,
} from "lucide-react";
import { Link } from "wouter";

// ===== 翻訳 =====
const translations = {
  ja: {
    title: "広告司令塔",
    subtitle: "広告運用の全体最適化",
    tabDashboard: "ダッシュボード",
    tabMatrix: "店舗×ブランド",
    tabCampaign: "キャンペーン管理",
    totalBudget: "総広告予算",
    totalSpend: "実際消費額",
    spendRate: "消費率",
    totalGmv: "広告GMV",
    overallRoi: "全体ROI",
    activeLivers: "アクティブ店舗",
    activeBrands: "アクティブブランド",
    planCount: "計画数",
    month: "月",
    allMonths: "全期間",
    adType: "広告タイプ",
    allTypes: "すべて",
    shortVideo: "短视频",
    live: "直播",
    mixed: "混合",
    liver: "店舗",
    brand: "ブランド",
    budget: "予算",
    actualSpend: "消費",
    targetGmv: "目標GMV",
    targetRoi: "目標ROI",
    actualGmv: "実績GMV",
    actualRoi: "実績ROI",
    total: "合計",
    noData: "データがありません",
    addPlan: "計画を追加",
    editPlan: "計画を編集",
    deletePlan: "削除",
    save: "保存",
    cancel: "キャンセル",
    confirm: "確認",
    deleteConfirm: "この計画を削除しますか？",
    notes: "メモ",
    impressions: "インプレッション",
    clicks: "クリック",
    conversions: "コンバージョン",
    importData: "データインポート",
    alerts: "アラート",
    alertLowSpend: "消費率が低い（予算に余裕あり）",
    alertHighRoi: "ROIが目標を大幅に超過（予算増額の余地あり）",
    alertLowRoi: "ROIが目標未達",
    alertInactive: "未稼働",
    back: "戻る",
    liverName: "店舗名",
    brandName: "ブランド名",
    selectLiver: "店舗を選択",
    selectBrand: "ブランドを選択",
    orInputManually: "または手動入力",
  },
  zh: {
    title: "广告司令塔",
    subtitle: "广告运营全局优化",
    tabDashboard: "仪表盘",
    tabMatrix: "店铺×品牌",
    tabCampaign: "活动管理",
    totalBudget: "总广告预算",
    totalSpend: "实际消耗",
    spendRate: "消耗率",
    totalGmv: "广告GMV",
    overallRoi: "整体ROI",
    activeLivers: "活跃店铺",
    activeBrands: "活跃品牌",
    planCount: "计划数",
    month: "月份",
    allMonths: "全部",
    adType: "广告类型",
    allTypes: "全部",
    shortVideo: "短视频",
    live: "直播",
    mixed: "混合",
    liver: "店铺",
    brand: "品牌",
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
    impressions: "曝光量",
    clicks: "点击量",
    conversions: "转化量",
    importData: "导入数据",
    alerts: "警报",
    alertLowSpend: "消耗率低（预算有余）",
    alertHighRoi: "ROI大幅超过目标（可增加预算）",
    alertLowRoi: "ROI未达标",
    alertInactive: "未启动",
    back: "返回",
    liverName: "店铺名",
    brandName: "品牌名",
    selectLiver: "选择店铺",
    selectBrand: "选择品牌",
    orInputManually: "或手动输入",
  },
};

// ===== ヘルパー =====
function formatCurrency(value: number): string {
  if (value >= 100000000) return `¥${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `¥${(value / 10000).toFixed(0)}万`;
  return `¥${value.toLocaleString()}`;
}

function formatCompact(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}万`;
  return value.toLocaleString();
}

function getRoiColor(actualRoi: number, targetRoi: number): string {
  if (targetRoi <= 0) return "text-gray-400";
  const ratio = actualRoi / targetRoi;
  if (ratio >= 1.5) return "text-emerald-400";
  if (ratio >= 1.0) return "text-green-400";
  if (ratio >= 0.7) return "text-yellow-400";
  return "text-red-400";
}

function getRoiBgColor(actualRoi: number, targetRoi: number): string {
  if (targetRoi <= 0) return "bg-gray-900/50";
  const ratio = actualRoi / targetRoi;
  if (ratio >= 1.5) return "bg-emerald-900/30 border-emerald-700/50";
  if (ratio >= 1.0) return "bg-green-900/30 border-green-700/50";
  if (ratio >= 0.7) return "bg-yellow-900/30 border-yellow-700/50";
  return "bg-red-900/30 border-red-700/50";
}

function getSpendRateColor(rate: number): string {
  if (rate >= 0.8) return "bg-green-500";
  if (rate >= 0.5) return "bg-yellow-500";
  if (rate >= 0.2) return "bg-orange-500";
  return "bg-red-500";
}

// ===== メインコンポーネント =====
export default function AdDashboard() {
  const { language } = useLanguage();
  const lang = language === "zh-TW" || language === "zh" ? "zh" : "ja";
  const t = translations[lang];

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedAdType, setSelectedAdType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  // Data queries
  const { data: availableMonths } = trpc.adDashboard.getAvailableMonths.useQuery();
  const { data: summary, isLoading: summaryLoading } = trpc.adDashboard.getMonthlySummary.useQuery(
    selectedMonth ? { month: selectedMonth } : undefined
  );
  const { data: matrixData, isLoading: matrixLoading } = trpc.adDashboard.getMatrixData.useQuery({
    month: selectedMonth || undefined,
    adType: selectedAdType as any,
  });
  const { data: monthlyPlans, isLoading: plansLoading, refetch: refetchPlans } = trpc.adDashboard.getMonthlyPlans.useQuery(
    selectedMonth ? { month: selectedMonth } : undefined
  );
  const { data: brandsDropdown } = trpc.adDashboard.getBrandsForDropdown.useQuery();
  const { data: liversDropdown } = trpc.adDashboard.getLiversForDropdown.useQuery();

  const createPlan = trpc.adDashboard.createMonthlyPlan.useMutation({
    onSuccess: () => {
      toast.success(lang === "ja" ? "計画を追加しました" : "计划已添加");
      setShowAddDialog(false);
      refetchPlans();
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePlan = trpc.adDashboard.updateMonthlyPlan.useMutation({
    onSuccess: () => {
      toast.success(lang === "ja" ? "更新しました" : "已更新");
      setEditingPlan(null);
      refetchPlans();
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePlan = trpc.adDashboard.deleteMonthlyPlan.useMutation({
    onSuccess: () => {
      toast.success(lang === "ja" ? "削除しました" : "已删除");
      refetchPlans();
    },
    onError: (e) => toast.error(e.message),
  });

  // Generate alerts
  const alerts = useMemo(() => {
    if (!monthlyPlans) return [];
    const result: { type: string; message: string; severity: "warning" | "info" | "danger" }[] = [];
    
    for (const plan of monthlyPlans) {
      const spendRate = parseFloat(plan.spendRate || "0");
      const actualRoi = parseFloat(plan.actualRoi || "0");
      const targetRoi = parseFloat(plan.targetRoi || "0");
      const budget = plan.budget ?? 0;
      const actualSpend = plan.actualSpend ?? 0;

      if (budget > 0 && actualSpend === 0) {
        result.push({
          type: "inactive",
          message: `${plan.liverName} × ${plan.brandName}: ${t.alertInactive}`,
          severity: "warning",
        });
      } else if (spendRate > 0 && spendRate < 0.3 && budget > 0) {
        result.push({
          type: "lowSpend",
          message: `${plan.liverName} × ${plan.brandName}: ${t.alertLowSpend} (${(spendRate * 100).toFixed(0)}%)`,
          severity: "info",
        });
      }

      if (targetRoi > 0 && actualRoi > 0) {
        if (actualRoi >= targetRoi * 2) {
          result.push({
            type: "highRoi",
            message: `${plan.liverName} × ${plan.brandName}: ${t.alertHighRoi} (ROI ${actualRoi.toFixed(1)} vs ${t.targetRoi} ${targetRoi.toFixed(1)})`,
            severity: "info",
          });
        } else if (actualRoi < targetRoi * 0.5) {
          result.push({
            type: "lowRoi",
            message: `${plan.liverName} × ${plan.brandName}: ${t.alertLowRoi} (ROI ${actualRoi.toFixed(1)} vs ${t.targetRoi} ${targetRoi.toFixed(1)})`,
            severity: "danger",
          });
        }
      }
    }
    return result;
  }, [monthlyPlans, t]);

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
                  <SelectItem value="all">{t.allMonths}</SelectItem>
                  {availableMonths?.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedAdType} onValueChange={setSelectedAdType}>
                <SelectTrigger className="w-[120px] bg-gray-800/50 border-gray-700 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allTypes}</SelectItem>
                  <SelectItem value="short_video">{t.shortVideo}</SelectItem>
                  <SelectItem value="live">{t.live}</SelectItem>
                  <SelectItem value="mixed">{t.mixed}</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t.addPlan}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-800/50 border border-gray-700/50">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
              <BarChart3 className="h-4 w-4 mr-1" />
              {t.tabDashboard}
            </TabsTrigger>
            <TabsTrigger value="matrix" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
              <Grid3X3 className="h-4 w-4 mr-1" />
              {t.tabMatrix}
            </TabsTrigger>
            <TabsTrigger value="campaign" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
              <Target className="h-4 w-4 mr-1" />
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
                value={formatCurrency(summary?.totalBudget ?? 0)}
                color="amber"
                loading={summaryLoading}
              />
              <KpiCard
                icon={<Activity className="h-4 w-4" />}
                label={t.totalSpend}
                value={formatCurrency(summary?.totalSpend ?? 0)}
                sub={`${t.spendRate}: ${((summary?.overallSpendRate ?? 0) * 100).toFixed(1)}%`}
                color="orange"
                loading={summaryLoading}
              />
              <KpiCard
                icon={<TrendingUp className="h-4 w-4" />}
                label={t.totalGmv}
                value={formatCurrency(summary?.totalActualGmv ?? 0)}
                color="green"
                loading={summaryLoading}
              />
              <KpiCard
                icon={<Zap className="h-4 w-4" />}
                label={t.overallRoi}
                value={(summary?.overallRoi ?? 0).toFixed(2)}
                color="cyan"
                loading={summaryLoading}
              />
              <KpiCard
                icon={<Users className="h-4 w-4" />}
                label={t.activeLivers}
                value={String(summary?.activeLiverCount ?? 0)}
                color="purple"
                loading={summaryLoading}
              />
              <KpiCard
                icon={<Target className="h-4 w-4" />}
                label={t.activeBrands}
                value={String(summary?.activeBrandCount ?? 0)}
                color="pink"
                loading={summaryLoading}
              />
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

            {/* Plans list (simple table) */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-300">
                  {t.planCount}: {monthlyPlans?.length ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  </div>
                ) : !monthlyPlans?.length ? (
                  <div className="text-center py-8 text-gray-500">{t.noData}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-400">
                          <th className="text-left py-2 px-2">{t.month}</th>
                          <th className="text-left py-2 px-2">{t.liver}</th>
                          <th className="text-left py-2 px-2">{t.brand}</th>
                          <th className="text-left py-2 px-2">{t.adType}</th>
                          <th className="text-right py-2 px-2">{t.budget}</th>
                          <th className="text-right py-2 px-2">{t.actualSpend}</th>
                          <th className="text-right py-2 px-2">{t.spendRate}</th>
                          <th className="text-right py-2 px-2">{t.targetRoi}</th>
                          <th className="text-right py-2 px-2">{t.actualGmv}</th>
                          <th className="text-right py-2 px-2">{t.actualRoi}</th>
                          <th className="text-center py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyPlans.map((plan) => {
                          const roi = parseFloat(plan.actualRoi || "0");
                          const tRoi = parseFloat(plan.targetRoi || "0");
                          const sr = parseFloat(plan.spendRate || "0");
                          return (
                            <tr key={plan.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                              <td className="py-2 px-2 text-gray-300">{plan.month}</td>
                              <td className="py-2 px-2 text-amber-300 font-medium">{plan.liverName}</td>
                              <td className="py-2 px-2 text-gray-200">{plan.brandName}</td>
                              <td className="py-2 px-2">
                                <Badge variant="outline" className="text-[10px] border-gray-600">
                                  {plan.adType === "short_video" ? t.shortVideo : plan.adType === "live" ? t.live : t.mixed}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(plan.budget ?? 0)}</td>
                              <td className="py-2 px-2 text-right text-gray-300">{formatCurrency(plan.actualSpend ?? 0)}</td>
                              <td className="py-2 px-2 text-right">
                                <span className={sr > 0.7 ? "text-green-400" : sr > 0.3 ? "text-yellow-400" : "text-red-400"}>
                                  {(sr * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right text-gray-400">{tRoi.toFixed(1)}</td>
                              <td className="py-2 px-2 text-right text-green-400 font-medium">{formatCurrency(plan.actualGmv ?? 0)}</td>
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
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Tab 2: Matrix ===== */}
          <TabsContent value="matrix" className="mt-4">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  {t.tabMatrix}
                  {selectedMonth && <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-300">{selectedMonth}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {matrixLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  </div>
                ) : !matrixData?.livers.length ? (
                  <div className="text-center py-8 text-gray-500">{t.noData}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-2 px-3 border-b border-gray-700 text-amber-400 font-medium sticky left-0 bg-gray-900 z-10 min-w-[120px]">
                            {t.liver} \ {t.brand}
                          </th>
                          {matrixData.brands.map((brand) => (
                            <th key={brand} className="text-center py-2 px-3 border-b border-gray-700 text-gray-300 font-medium min-w-[140px]">
                              {brand}
                            </th>
                          ))}
                          <th className="text-center py-2 px-3 border-b border-gray-700 text-amber-400 font-bold min-w-[120px]">
                            {t.total}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrixData.livers.map((liver) => {
                          let liverTotalSpend = 0;
                          let liverTotalGmv = 0;
                          return (
                            <tr key={liver} className="hover:bg-gray-800/20">
                              <td className="py-2 px-3 border-b border-gray-800/50 text-amber-300 font-medium sticky left-0 bg-gray-900 z-10">
                                {liver}
                              </td>
                              {matrixData.brands.map((brand) => {
                                const plans = matrixData.matrix[liver]?.[brand] || [];
                                if (plans.length === 0) {
                                  return (
                                    <td key={brand} className="py-2 px-3 border-b border-gray-800/50 text-center text-gray-600">
                                      -
                                    </td>
                                  );
                                }
                                const totalSpend = plans.reduce((s, p) => s + (p.actualSpend ?? 0), 0);
                                const totalGmv = plans.reduce((s, p) => s + (p.actualGmv ?? 0), 0);
                                const roi = totalSpend > 0 ? totalGmv / totalSpend : 0;
                                const targetRoi = plans.length > 0 ? parseFloat(plans[0].targetRoi || "0") : 0;
                                liverTotalSpend += totalSpend;
                                liverTotalGmv += totalGmv;

                                return (
                                  <td
                                    key={brand}
                                    className={`py-2 px-3 border-b border-gray-800/50 text-center cursor-pointer transition-colors ${getRoiBgColor(roi, targetRoi)} border rounded-md`}
                                    onClick={() => {
                                      if (plans.length === 1) setEditingPlan(plans[0]);
                                    }}
                                  >
                                    <div className="text-[10px] text-gray-400">{formatCompact(totalSpend)}</div>
                                    <div className={`text-sm font-bold ${getRoiColor(roi, targetRoi)}`}>
                                      {roi.toFixed(1)}
                                    </div>
                                    <div className="text-[10px] text-green-400">{formatCompact(totalGmv)}</div>
                                  </td>
                                );
                              })}
                              <td className="py-2 px-3 border-b border-gray-800/50 text-center bg-gray-800/30">
                                <div className="text-[10px] text-gray-400">{formatCompact(liverTotalSpend)}</div>
                                <div className="text-sm font-bold text-amber-400">
                                  {liverTotalSpend > 0 ? (liverTotalGmv / liverTotalSpend).toFixed(1) : "-"}
                                </div>
                                <div className="text-[10px] text-green-400">{formatCompact(liverTotalGmv)}</div>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Total row */}
                        <tr className="bg-gray-800/40 font-medium">
                          <td className="py-2 px-3 text-amber-400 font-bold sticky left-0 bg-gray-800/40 z-10">
                            {t.total}
                          </td>
                          {matrixData.brands.map((brand) => {
                            let brandTotalSpend = 0;
                            let brandTotalGmv = 0;
                            for (const liver of matrixData.livers) {
                              const plans = matrixData.matrix[liver]?.[brand] || [];
                              brandTotalSpend += plans.reduce((s, p) => s + (p.actualSpend ?? 0), 0);
                              brandTotalGmv += plans.reduce((s, p) => s + (p.actualGmv ?? 0), 0);
                            }
                            return (
                              <td key={brand} className="py-2 px-3 text-center">
                                <div className="text-[10px] text-gray-400">{formatCompact(brandTotalSpend)}</div>
                                <div className="text-sm font-bold text-amber-400">
                                  {brandTotalSpend > 0 ? (brandTotalGmv / brandTotalSpend).toFixed(1) : "-"}
                                </div>
                                <div className="text-[10px] text-green-400">{formatCompact(brandTotalGmv)}</div>
                              </td>
                            );
                          })}
                          <td className="py-2 px-3 text-center bg-amber-900/20 rounded-br-lg">
                            <div className="text-[10px] text-gray-400">{formatCompact(summary?.totalSpend ?? 0)}</div>
                            <div className="text-sm font-bold text-amber-400">
                              {(summary?.overallRoi ?? 0).toFixed(1)}
                            </div>
                            <div className="text-[10px] text-green-400">{formatCompact(summary?.totalActualGmv ?? 0)}</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Tab 3: Campaign Management ===== */}
          <TabsContent value="campaign" className="mt-4">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {t.tabCampaign}
                  </CardTitle>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-amber-600 to-orange-600"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t.addPlan}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  </div>
                ) : !monthlyPlans?.length ? (
                  <div className="text-center py-12 text-gray-500">
                    <Megaphone className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                    <p>{t.noData}</p>
                    <Button
                      className="mt-4 bg-gradient-to-r from-amber-600 to-orange-600"
                      onClick={() => setShowAddDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t.addPlan}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {monthlyPlans.map((plan) => {
                      const roi = parseFloat(plan.actualRoi || "0");
                      const tRoi = parseFloat(plan.targetRoi || "0");
                      const sr = parseFloat(plan.spendRate || "0");
                      return (
                        <Card
                          key={plan.id}
                          className={`bg-gray-800/50 border ${getRoiBgColor(roi, tRoi)} hover:border-amber-600/50 transition-colors cursor-pointer`}
                          onClick={() => setEditingPlan(plan)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline" className="text-[10px] border-gray-600 text-gray-400">
                                {plan.month}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-300">
                                {plan.adType === "short_video" ? t.shortVideo : plan.adType === "live" ? t.live : t.mixed}
                              </Badge>
                            </div>
                            <h3 className="text-sm font-bold text-amber-300">{plan.liverName}</h3>
                            <p className="text-xs text-gray-400 mb-3">{plan.brandName}</p>
                            
                            {/* Spend rate bar */}
                            <div className="mb-2">
                              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>{t.spendRate}</span>
                                <span>{(sr * 100).toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${getSpendRateColor(sr)}`}
                                  style={{ width: `${Math.min(sr * 100, 100)}%` }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">{t.budget}</span>
                                <p className="text-gray-200 font-medium">{formatCurrency(plan.budget ?? 0)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">{t.actualSpend}</span>
                                <p className="text-gray-200 font-medium">{formatCurrency(plan.actualSpend ?? 0)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">{t.actualGmv}</span>
                                <p className="text-green-400 font-medium">{formatCurrency(plan.actualGmv ?? 0)}</p>
                              </div>
                              <div>
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
                    })}
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
        brands={brandsDropdown || []}
        livers={liversDropdown || []}
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
  };
  const textMap: Record<string, string> = {
    amber: "text-amber-400",
    orange: "text-orange-400",
    green: "text-green-400",
    cyan: "text-cyan-400",
    purple: "text-purple-400",
    pink: "text-pink-400",
  };

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} border`}>
      <CardContent className="p-3">
        <div className={`flex items-center gap-1 mb-1 ${textMap[color]}`}>
          {icon}
          <span className="text-[10px] text-gray-400">{label}</span>
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

// ===== Plan Dialog Component =====
function PlanDialog({ open, onClose, plan, t, lang, brands, livers, onSave, saving }: {
  open: boolean;
  onClose: () => void;
  plan: any;
  t: typeof translations.ja;
  lang: string;
  brands: { id: number; name: string; nameJa: string }[];
  livers: { id: number; name: string }[];
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<any>({});

  // Reset form when plan changes
  const resetForm = useCallback(() => {
    if (plan) {
      setForm({
        month: plan.month || "",
        liverName: plan.liverName || "",
        liverId: plan.liverId || null,
        brandName: plan.brandName || "",
        brandId: plan.brandId || null,
        adType: plan.adType || "mixed",
        budget: plan.budget ?? 0,
        actualSpend: plan.actualSpend ?? 0,
        targetGmv: plan.targetGmv ?? 0,
        targetRoi: parseFloat(plan.targetRoi || "0"),
        actualGmv: plan.actualGmv ?? 0,
        actualRoi: parseFloat(plan.actualRoi || "0"),
        impressions: plan.impressions ?? 0,
        clicks: plan.clicks ?? 0,
        conversions: plan.conversions ?? 0,
        notes: plan.notes || "",
      });
    } else {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      setForm({
        month: currentMonth,
        liverName: "",
        liverId: null,
        brandName: "",
        brandId: null,
        adType: "mixed",
        budget: 0,
        actualSpend: 0,
        targetGmv: 0,
        targetRoi: 0,
        actualGmv: 0,
        actualRoi: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        notes: "",
      });
    }
  }, [plan]);

  // Reset when dialog opens
  useMemo(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  const handleSubmit = () => {
    if (!form.liverName || !form.brandName || !form.month) {
      toast.error(lang === "ja" ? "店舗名、ブランド名、月は必須です" : "店铺名、品牌名、月份为必填项");
      return;
    }
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-amber-400">
            {plan ? t.editPlan : t.addPlan}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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

          {/* Liver */}
          <div>
            <label className="text-xs text-gray-400">{t.liverName}</label>
            <Select
              value={form.liverId ? String(form.liverId) : "manual"}
              onValueChange={(v) => {
                if (v === "manual") {
                  setForm({ ...form, liverId: null });
                } else {
                  const liver = livers.find((l) => l.id === Number(v));
                  if (liver) {
                    setForm({ ...form, liverId: liver.id, liverName: liver.name });
                  }
                }
              }}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue placeholder={t.selectLiver} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t.orInputManually}</SelectItem>
                {livers.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(!form.liverId || form.liverId === null) && (
              <Input
                placeholder={t.liverName}
                value={form.liverName || ""}
                onChange={(e) => setForm({ ...form, liverName: e.target.value })}
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            )}
          </div>

          {/* Brand */}
          <div>
            <label className="text-xs text-gray-400">{t.brandName}</label>
            <Select
              value={form.brandId ? String(form.brandId) : "manual"}
              onValueChange={(v) => {
                if (v === "manual") {
                  setForm({ ...form, brandId: null });
                } else {
                  const brand = brands.find((b) => b.id === Number(v));
                  if (brand) {
                    setForm({ ...form, brandId: brand.id, brandName: brand.name });
                  }
                }
              }}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue placeholder={t.selectBrand} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t.orInputManually}</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name} ({b.nameJa})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(!form.brandId || form.brandId === null) && (
              <Input
                placeholder={t.brandName}
                value={form.brandName || ""}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            )}
          </div>

          {/* Ad Type */}
          <div>
            <label className="text-xs text-gray-400">{t.adType}</label>
            <Select value={form.adType || "mixed"} onValueChange={(v) => setForm({ ...form, adType: v })}>
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short_video">{t.shortVideo}</SelectItem>
                <SelectItem value="live">{t.live}</SelectItem>
                <SelectItem value="mixed">{t.mixed}</SelectItem>
              </SelectContent>
            </Select>
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
                value={form.actualSpend || 0}
                onChange={(e) => setForm({ ...form, actualSpend: Number(e.target.value) })}
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
            className="bg-gradient-to-r from-amber-600 to-orange-600"
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
