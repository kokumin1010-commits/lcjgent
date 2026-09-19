import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, X, ArrowLeft, DollarSign, TrendingUp, Gem, Calendar, ChevronDown, Handshake, Trash2, Target, AlertTriangle, Flame, RefreshCw, Users, Tag, Crown, History, Clock, CheckCircle, XCircle, Merge, Loader2, Pencil, Flag, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BRAND_BD_STAGE_LABELS,
  BRAND_BD_STAGE_VALUES,
  BRAND_DEAL_MODEL_LABELS,
  BRAND_DEAL_MODEL_VALUES,
  businessMonthKey,
  canTransitionBrandBdStage,
  progressPercent,
  type BrandBdStage,
  type BrandDealModel,
} from "@shared/brandBusiness";

/**
 * 设计哲学：把桌面端高密度司令塔重排为手机端纵向操作流。
 * 保留现有深色指挥台与功能色语义，同时确保所有容器受视口约束、核心操作无需横向滑动。
 */

const translations = {
  ja: {
    title: "ブランド司令塔",
    subtitle: "全ブランド一覧",
    newBrand: "ブランド登録",
    filter: "絞り込み",
    status: "ステータス",
    allStatus: "すべて",
    search: "ブランド名検索",
    searchBtn: "検索",
    clearFilter: "フィルターをクリア",
    brandName: "ブランド名",
    statusCol: "ステータス",
    commissionRate: "成果報酬",
    noData: "ブランドがありません",
    inProgress: "進行中",
    meeting: "打ち合わせ中",
    contracted: "契約済み",
    onHold: "保留",
    ended: "終了",
    totalBrands: "総ブランド数",
    contractedBrands: "契約中",
    back: "戻る",
    sortBy: "並び替え",
    sortByName: "名前順",
    sortByGmv: "売上順",
    sortByAdBudget: "広告費順",
    sortByCreatedAt: "登録順",
    sortByTier: "Tier順",
    // 期間フィルター
    period: "期間",
    allTime: "全期間",
    thisMonth: "今月",
    lastMonth: "先月",
    custom: "カスタム",
    // 統計カード
    totalAdBudget: "広告費合計",
    totalGmv: "GMV合計",
    lcjReward: "LCJ報酬合計",
    selectedPeriod: "選択期間",
  },
  zh: {
    title: "品牌司令塔",
    subtitle: "全品牌一览",
    newBrand: "品牌注册",
    filter: "筛选",
    status: "状态",
    allStatus: "全部",
    search: "品牌名搜索",
    searchBtn: "搜索",
    clearFilter: "清除筛选",
    brandName: "品牌名",
    statusCol: "状态",
    commissionRate: "成果报酬",
    noData: "没有品牌",
    inProgress: "进行中",
    meeting: "洽谈中",
    contracted: "已签约",
    onHold: "保留",
    ended: "结束",
    totalBrands: "总品牌数",
    contractedBrands: "签约中",
    back: "返回",
    sortBy: "排序",
    sortByName: "名称排序",
    sortByGmv: "销售额排序",
    sortByAdBudget: "广告费排序",
    sortByCreatedAt: "注册顺序",
    sortByTier: "Tier排序",
    // 期間フィルター
    period: "期间",
    allTime: "全期间",
    thisMonth: "本月",
    lastMonth: "上月",
    custom: "自定义",
    // 統計カード
    totalAdBudget: "广告费合计",
    totalGmv: "GMV合计",
    lcjReward: "LCJ报酬合计",
    selectedPeriod: "选择期间",
  },
};

const statusColors: Record<string, string> = {
  "進行中": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "打ち合わせ中": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "契約済み": "bg-green-500/20 text-green-400 border-green-500/30",
  "保留": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "終了": "bg-red-500/20 text-red-400 border-red-500/30",
};

const bdStageColors: Record<BrandBdStage, string> = {
  new_lead: "border-slate-500/50 bg-slate-500/15 text-slate-300",
  slot_fee: "border-orange-500/50 bg-orange-500/15 text-orange-300",
  guaranteed_roi: "border-cyan-500/50 bg-cyan-500/15 text-cyan-300",
  pure_commission: "border-violet-500/50 bg-violet-500/15 text-violet-300",
  contracted: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  on_hold: "border-yellow-500/50 bg-yellow-500/15 text-yellow-300",
  lost: "border-red-500/50 bg-red-500/15 text-red-300",
};

type MonthlyTargetDraft = {
  newBrandTarget: string;
  contactTarget: string;
  negotiationTarget: string;
  contractTarget: string;
  slotFeeContractTarget: string;
  slotFeeRevenueTarget: string;
  goalNote: string;
};

type DealDraft = {
  stage: BrandBdStage;
  dealModel: BrandDealModel | "";
  slotFeeAmount: string;
  guaranteedRoi: string;
  pureCommissionRate: string;
  lastContactAt: string;
  nextFollowUpAt: string;
  nextAction: string;
  negotiationNotes: string;
};

const emptyMonthlyTarget: MonthlyTargetDraft = {
  newBrandTarget: "",
  contactTarget: "",
  negotiationTarget: "",
  contractTarget: "",
  slotFeeContractTarget: "",
  slotFeeRevenueTarget: "",
  goalNote: "",
};

function numberValue(value: string): number {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function toJstDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function fromJstDateTimeLocal(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}:00+09:00`).toISOString();
}

function compactDateTime(value?: string | null): string {
  if (!value) return "未設定";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 期間の選択肢を生成
function generatePeriodOptions() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const options: { value: string; label: string; year: number; month: number }[] = [];
  
  // 過去24ヶ月分を生成
  for (let i = 0; i < 24; i++) {
    let year = currentYear;
    let month = currentMonth - i;
    
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    
    options.push({
      value: `${year}-${month.toString().padStart(2, '0')}`,
      label: `${year}年${month}月`,
      year,
      month,
    });
  }
  
  return options;
}

export default function BrandList() {
  const { language } = useLanguage();
  // BrandListは管理画面なので日本語固定（zh-TW, enの翻訳がないためエラー防止）
  const t = translations['ja'];
  const [, setLocation] = useLocation();
  
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("gmv");
  const [periodFilter, setPeriodFilter] = useState<string>("all"); // "all", "thisMonth", "lastMonth", "YYYY-MM"
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);

  const periodOptions = useMemo(() => generatePeriodOptions(), []);

  // 削除関連の状態
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  // ブランド合併関連の状態
  const [mergeSource, setMergeSource] = useState<{ id: number; name: string } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);

  // 商務BD関連の状態
  const businessMonth = useMemo(() => businessMonthKey(), []);
  const [showMonthlyTarget, setShowMonthlyTarget] = useState(false);
  const [monthlyTargetDraft, setMonthlyTargetDraft] = useState<MonthlyTargetDraft>(emptyMonthlyTarget);
  const [editingDealBrand, setEditingDealBrand] = useState<{ id: number; name: string } | null>(null);
  const [dealDraft, setDealDraft] = useState<DealDraft>({
    stage: "new_lead",
    dealModel: "",
    slotFeeAmount: "",
    guaranteedRoi: "2",
    pureCommissionRate: "",
    lastContactAt: "",
    nextFollowUpAt: "",
    nextAction: "",
    negotiationNotes: "",
  });

  const utils = trpc.useUtils();

  const { data: brandsData, isLoading } = trpc.brand.list.useQuery({
    status: statusFilter || undefined,
    search: appliedSearch || undefined,
  });

  const businessAccessQuery = trpc.brandBusiness.access.useQuery();
  const canAccessBrandBusiness = businessAccessQuery.data?.canAccess === true;
  const businessOverviewQuery = trpc.brandBusiness.overview.useQuery(businessMonth, {
    enabled: canAccessBrandBusiness,
  });
  const businessOverview = businessOverviewQuery.data;
  const dealByBrandId = useMemo(() => new Map(
    (businessOverview?.deals || []).map((deal: any) => [Number(deal.brandId), deal]),
  ), [businessOverview?.deals]);
  const editingExistingDeal: any = editingDealBrand ? dealByBrandId.get(editingDealBrand.id) : null;
  const editingFromStage = (editingExistingDeal?.stage || "new_lead") as BrandBdStage;

  const saveMonthlyTargetMutation = trpc.brandBusiness.saveMonthlyTarget.useMutation({
    onSuccess: async () => {
      await businessOverviewQuery.refetch();
      setShowMonthlyTarget(false);
      toast.success("ブランド商務の月間目標を保存しました");
    },
    onError: error => toast.error(`月間目標の保存に失敗しました: ${error.message}`),
  });

  const saveDealMutation = trpc.brandBusiness.saveDeal.useMutation({
    onSuccess: async () => {
      await Promise.all([businessOverviewQuery.refetch(), utils.brand.list.invalidate()]);
      setEditingDealBrand(null);
      toast.success("ブランドのBD進捗を保存しました");
    },
    onError: error => toast.error(`BD進捗の保存に失敗しました: ${error.message}`),
  });

  const openMonthlyTarget = () => {
    const target = businessOverview?.target;
    setMonthlyTargetDraft(target ? {
      newBrandTarget: String(target.newBrandTarget || ""),
      contactTarget: String(target.contactTarget || ""),
      negotiationTarget: String(target.negotiationTarget || ""),
      contractTarget: String(target.contractTarget || ""),
      slotFeeContractTarget: String(target.slotFeeContractTarget || ""),
      slotFeeRevenueTarget: String(target.slotFeeRevenueTarget || ""),
      goalNote: target.goalNote || "",
    } : emptyMonthlyTarget);
    setShowMonthlyTarget(true);
  };

  const openDealEditor = (event: React.MouseEvent, brand: { id: number; name: string }) => {
    event.preventDefault();
    event.stopPropagation();
    const existing: any = dealByBrandId.get(brand.id);
    setEditingDealBrand(brand);
    setDealDraft({
      stage: existing?.stage || "new_lead",
      dealModel: existing?.dealModel || "",
      slotFeeAmount: existing?.slotFeeAmount == null ? "" : String(existing.slotFeeAmount),
      guaranteedRoi: existing?.guaranteedRoi == null ? "2" : String(existing.guaranteedRoi),
      pureCommissionRate: existing?.pureCommissionRate == null ? "" : String(existing.pureCommissionRate),
      lastContactAt: toJstDateTimeLocal(existing?.lastContactAt),
      nextFollowUpAt: toJstDateTimeLocal(existing?.nextFollowUpAt),
      nextAction: existing?.nextAction || "",
      negotiationNotes: existing?.negotiationNotes || "",
    });
  };

  const saveMonthlyTarget = () => {
    saveMonthlyTargetMutation.mutate({
      year: businessMonth.year,
      month: businessMonth.month,
      newBrandTarget: Math.round(numberValue(monthlyTargetDraft.newBrandTarget)),
      contactTarget: Math.round(numberValue(monthlyTargetDraft.contactTarget)),
      negotiationTarget: Math.round(numberValue(monthlyTargetDraft.negotiationTarget)),
      contractTarget: Math.round(numberValue(monthlyTargetDraft.contractTarget)),
      slotFeeContractTarget: Math.round(numberValue(monthlyTargetDraft.slotFeeContractTarget)),
      slotFeeRevenueTarget: Math.round(numberValue(monthlyTargetDraft.slotFeeRevenueTarget)),
      goalNote: monthlyTargetDraft.goalNote || null,
    });
  };

  const saveDeal = () => {
    if (!editingDealBrand) return;
    if (!canTransitionBrandBdStage(editingFromStage, dealDraft.stage)) {
      toast.error("規定の順序に従ってBD段階を更新してください");
      return;
    }
    if (!["contracted", "lost"].includes(dealDraft.stage) && (!dealDraft.nextAction.trim() || !dealDraft.nextFollowUpAt)) {
      toast.error("進行中の案件は次の具体的アクションとフォロー日時が必須です");
      return;
    }
    if (["slot_fee", "guaranteed_roi", "pure_commission"].includes(dealDraft.stage) && !dealDraft.lastContactAt) {
      toast.error("商談段階では最終接触日時が必須です");
      return;
    }
    if (dealDraft.stage === "slot_fee" && numberValue(dealDraft.slotFeeAmount) <= 0) {
      toast.error("坑位費の提示額を入力してください");
      return;
    }
    if (dealDraft.stage === "pure_commission" && numberValue(dealDraft.pureCommissionRate) <= 0) {
      toast.error("完全成果報酬率を入力してください");
      return;
    }
    if (dealDraft.stage === "contracted" && !dealDraft.dealModel) {
      toast.error("契約成立時は確定した契約方式を選択してください");
      return;
    }
    if (dealDraft.stage === "contracted") {
      const expectedModel = editingFromStage === "slot_fee" ? "slot_fee" : editingFromStage === "guaranteed_roi" ? "guaranteed_roi" : editingFromStage === "pure_commission" ? "pure_commission" : null;
      if (!expectedModel || dealDraft.dealModel !== expectedModel) {
        toast.error("契約方式は直前の商談段階と一致させてください");
        return;
      }
    }
    saveDealMutation.mutate({
      brandId: editingDealBrand.id,
      stage: dealDraft.stage,
      dealModel: dealDraft.dealModel || null,
      slotFeeAmount: dealDraft.slotFeeAmount ? numberValue(dealDraft.slotFeeAmount) : null,
      guaranteedRoi: dealDraft.guaranteedRoi ? numberValue(dealDraft.guaranteedRoi) : 2,
      pureCommissionRate: dealDraft.pureCommissionRate ? numberValue(dealDraft.pureCommissionRate) : null,
      lastContactAt: fromJstDateTimeLocal(dealDraft.lastContactAt),
      nextFollowUpAt: fromJstDateTimeLocal(dealDraft.nextFollowUpAt),
      nextAction: dealDraft.nextAction || null,
      negotiationNotes: dealDraft.negotiationNotes || null,
    });
  };

  const deleteMutation = trpc.brand.delete.useMutation({
    onSuccess: () => {
      toast.success("ブランドを削除しました");
      setDeleteTarget(null);
      utils.brand.list.invalidate();
    },
    onError: (err) => {
      toast.error("削除に失敗しました: " + err.message);
    },
  });

  const mergeMutation = trpc.brand.merge.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message || "ブランドを合併しました");
      setMergeSource(null);
      setMergeTargetId(null);
      utils.brand.list.invalidate();
    },
    onError: (err: any) => {
      toast.error("合併に失敗しました: " + err.message);
    },
  });

  const handleMerge = (e: React.MouseEvent, brand: { id: number; name: string }) => {
    e.preventDefault();
    e.stopPropagation();
    setMergeSource(brand);
    setMergeTargetId(null);
  };

  const confirmMerge = () => {
    if (mergeSource && mergeTargetId) {
      mergeMutation.mutate({ targetBrandId: mergeTargetId, sourceBrandId: mergeSource.id });
    }
  };

  const syncLarkMutation = trpc.brand.syncLark.useMutation({
    onSuccess: (data: any) => {
      toast.success(`飞書同期完了: ${data.synced}件同期 (${data.created}件新規, ${data.updated}件更新)`);
      utils.brand.list.invalidate();
      syncHistoryQuery.refetch();
    },
    onError: (err: any) => {
      toast.error(`飞書同期エラー: ${err.message}`);
    },
  });

  // 同期履歴を取得
  const syncHistoryQuery = trpc.brand.getSyncHistory.useQuery({ limit: 10 });
  const [showSyncHistory, setShowSyncHistory] = useState(false);

  const handleDelete = (e: React.MouseEvent, brand: { id: number; name: string }) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(brand);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate({ id: deleteTarget.id });
    }
  };

  // 全ライブストリームデータを取得（期間フィルター用）
  const { data: allLivestreamsData } = trpc.brandLivestream.listAll.useQuery();

  // 全商品データを取得（LCJ報酬計算用）
  const { data: allProductsData } = trpc.brandProduct.listAll.useQuery();

  // 全契約データを取得（広告費計算用）
  const { data: allContractsData } = trpc.brandContract.listAll.useQuery();

  // 期間に基づいてフィルタリングされたデータを計算
  const filteredStats = useMemo(() => {
    if (!brandsData || !allLivestreamsData) {
      return { totalAdBudget: 0, totalGmv: 0, lcjReward: 0 };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (periodFilter === "thisMonth") {
      startDate = new Date(currentYear, currentMonth - 1, 1);
      endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    } else if (periodFilter === "lastMonth") {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      startDate = new Date(lastMonthYear, lastMonth - 1, 1);
      endDate = new Date(lastMonthYear, lastMonth, 0, 23, 59, 59);
    } else if (periodFilter !== "all" && periodFilter.includes("-")) {
      const [year, month] = periodFilter.split("-").map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    }

    // フィルタリングされたライブストリーム（livestreamDateを使用）
    const filteredLivestreams = allLivestreamsData.filter((ls: any) => {
      if (!startDate || !endDate) return true;
      // livestreamDateフィールドを使用
      const lsDate = ls.livestreamDate ? new Date(ls.livestreamDate) : null;
      if (!lsDate) return false;
      return lsDate >= startDate && lsDate <= endDate;
    });

    // GMV合計
    const totalGmv = filteredLivestreams.reduce((sum: number, ls: any) => sum + (ls.gmv || 0), 0);

    // 広告費合計（契約のfixedFeeから取得 - ブランドカードと同じロジック）
    // 期間フィルターがある場合は、その期間内の契約のみを集計
    let totalAdBudget = 0;
    if (allContractsData) {
      const filteredContracts = allContractsData.filter((contract: any) => {
        if (!startDate || !endDate) return true;
        // 契約の開始日が期間内にあるか、または期間内に有効な契約
        const contractStart = contract.startDate ? new Date(contract.startDate) : null;
        const contractEnd = contract.endDate ? new Date(contract.endDate) : null;
        
        // 契約期間が選択期間と重なっているかチェック
        if (contractStart && contractEnd) {
          return contractStart <= endDate && contractEnd >= startDate;
        } else if (contractStart) {
          return contractStart <= endDate;
        }
        // 日付がない場合は全期間に含める
        return true;
      });
      totalAdBudget = filteredContracts.reduce((sum: number, c: any) => sum + (c.fixedFee || 0), 0);
    }

    // LCJ報酬計算（商品ごとのGMV × 成果報酬率）
    let lcjReward = 0;
    if (allProductsData) {
      // 各ライブストリームの商品ごとのGMVを計算
      filteredLivestreams.forEach((ls: any) => {
        const product = allProductsData.find((p: any) => p.id === ls.productId);
        if (product && product.commissionRate) {
          // commissionRateが文字列の場合の処理（例: "20%" → 0.2）
          const rateStr = String(product.commissionRate).replace('%', '').trim();
          const rate = parseFloat(rateStr);
          if (!isNaN(rate)) {
            lcjReward += (ls.gmv || 0) * (rate / 100);
          }
        }
      });
    }

    return { totalAdBudget, totalGmv, lcjReward };
  }, [brandsData, allLivestreamsData, allProductsData, allContractsData, periodFilter]);

  // ソートされたブランドリスト（タスクレコードをフィルター）
  const brands = brandsData ? [...brandsData]
    .filter(b => !b.name.includes('<') && !b.name.includes('＜'))
    .sort((a, b) => {
    // ノルマありブランドを常に最上部に優先表示
    const hasQuotaA = (a as any).hasQuota ? 1 : 0;
    const hasQuotaB = (b as any).hasQuota ? 1 : 0;
    if (hasQuotaB !== hasQuotaA) return hasQuotaB - hasQuotaA;
    
    if (sortBy === "gmv") {
      const gmvA = (a as any).totalGmv || 0;
      const gmvB = (b as any).totalGmv || 0;
      return gmvB - gmvA;
    } else if (sortBy === "adBudget") {
      const adA = (a as any).totalAdBudget || 0;
      const adB = (b as any).totalAdBudget || 0;
      return adB - adA;
    } else if (sortBy === "createdAt") {
      const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      return dateB - dateA; // 新しい順
    } else if (sortBy === "tier") {
      const tierOrder: Record<string, number> = { 'Tier1': 1, 'Tier2': 2 };
      const tierA = tierOrder[(a as any).larkTier] || 99;
      const tierB = tierOrder[(b as any).larkTier] || 99;
      return tierA - tierB;
    } else {
      return (a.name || "").localeCompare(b.name || "", "ja");
    }
  }) : [];

  const handleSearch = () => {
    setAppliedSearch(searchTerm);
  };

  const handleClearFilter = () => {
    setStatusFilter("");
    setSearchTerm("");
    setAppliedSearch("");
    setPeriodFilter("all");
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, { ja: string; zh: string }> = {
      "進行中": { ja: "進行中", zh: "进行中" },
      "打ち合わせ中": { ja: "打ち合わせ中", zh: "洽谈中" },
      "契約済み": { ja: "契約済み", zh: "已签约" },
      "保留": { ja: "保留", zh: "保留" },
      "終了": { ja: "終了", zh: "结束" },
    };
    return statusMap[status]?.['ja'] || status;
  };

  const getPeriodLabel = () => {
    if (periodFilter === "all") return t.allTime;
    if (periodFilter === "thisMonth") return t.thisMonth;
    if (periodFilter === "lastMonth") return t.lastMonth;
    const option = periodOptions.find(o => o.value === periodFilter);
    return option?.label || periodFilter;
  };

  // 統計情報を計算
  const totalBrands = brands?.length || 0;
  const contractedBrands = brands?.filter(b => b.status === "契約済み").length || 0;
  const larkSyncedBrands = brands?.filter(b => (b as any).larkRecordId).length || 0;
  const tier1Brands = brands?.filter(b => (b as any).larkTier === 'Tier1').length || 0;
  const tier2Brands = brands?.filter(b => (b as any).larkTier === 'Tier2').length || 0;

  const monthlyBusinessKpis = businessOverview ? [
    { label: "新規ブランド", actual: businessOverview.actual.newBrands, target: businessOverview.target.newBrandTarget, money: false },
    { label: "BD接触", actual: businessOverview.actual.contactedBrands, target: businessOverview.target.contactTarget, money: false },
    { label: "商談化", actual: businessOverview.actual.negotiations, target: businessOverview.target.negotiationTarget, money: false },
    { label: "契約成立", actual: businessOverview.actual.contracts, target: businessOverview.target.contractTarget, money: false },
    { label: "坑位費契約", actual: businessOverview.actual.slotFeeContracts, target: businessOverview.target.slotFeeContractTarget, money: false },
    { label: "坑位費売上", actual: businessOverview.actual.slotFeeRevenue, target: businessOverview.target.slotFeeRevenueTarget, money: true },
  ] : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="mx-auto w-full max-w-[1760px] px-3 py-4 sm:px-6 sm:py-8 lg:px-8 2xl:px-10">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-4">
            <button
              onClick={() => setLocation("/")}
              className="-ml-2 flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-sm text-gray-400 transition-colors hover:text-white sm:ml-0 sm:gap-2 sm:px-0"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>{t.back}</span>
            </button>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 sm:h-12 sm:w-12">
                <Building2 className="h-5 w-5 text-white sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="break-keep text-xl font-bold leading-tight text-white sm:text-2xl">{t.title}</h1>
                <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">{t.subtitle}</p>
              </div>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 xl:w-[760px] xl:grid-cols-4 xl:items-center xl:gap-3">
            <Button
              onClick={() => setShowSyncHistory(!showSyncHistory)}
              variant="outline"
              className="min-h-11 w-full whitespace-nowrap border-gray-600 px-3 text-gray-300 hover:bg-gray-700 sm:px-4"
            >
              <History className="h-4 w-4 mr-2" />
              同期履歴
            </Button>
            <Button
              onClick={() => syncLarkMutation.mutate()}
              disabled={syncLarkMutation.isPending}
              className="min-h-11 w-full whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-white hover:from-blue-700 hover:to-indigo-700 sm:px-4"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncLarkMutation.isPending ? 'animate-spin' : ''}`} />
              {syncLarkMutation.isPending ? '同期中...' : '飞書同期'}
            </Button>
            <Link href="/master/recruitment" className="block min-w-0">
              <Button className="min-h-11 w-full whitespace-nowrap bg-gradient-to-r from-amber-600 to-orange-600 px-3 text-white hover:from-amber-700 hover:to-orange-700 sm:px-4">
                <Handshake className="h-4 w-4 mr-2" />
                招商管理
              </Button>
            </Link>
            <Link href="/master/brands/new" className="block min-w-0">
              <Button className="min-h-11 w-full whitespace-nowrap bg-red-600 px-3 text-white hover:bg-red-700 sm:px-4">
                <Plus className="h-4 w-4 mr-2" />
                {t.newBrand}
              </Button>
            </Link>
          </div>
        </div>

        {/* Brand business monthly target command center */}
        {canAccessBrandBusiness && (
        <section className="mb-6 overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-br from-gray-900 via-orange-950/20 to-gray-900 shadow-[0_0_35px_rgba(249,115,22,0.08)] sm:mb-8">
          <div className="flex flex-col gap-4 border-b border-gray-700/70 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Flag className="h-5 w-5 text-orange-400" />
                <h2 className="text-lg font-bold text-white">ブランド商務・{businessMonth.year}年{businessMonth.month}月目標</h2>
                <Badge className="border border-orange-500/40 bg-orange-500/15 text-orange-300">1か月目標</Badge>
              </div>
              <p className="mt-1 text-sm text-gray-400">新規ブランドは、坑位費 → ROI保証 1:2 → 完全成果報酬の順で提案します。</p>
            </div>
            <Button
              onClick={openMonthlyTarget}
              disabled={businessOverviewQuery.isLoading}
              className="min-h-11 shrink-0 bg-orange-600 text-white hover:bg-orange-700"
            >
              <Target className="mr-2 h-4 w-4" />
              今月の目標を設定
            </Button>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5 xl:grid-cols-6">
            {monthlyBusinessKpis.map(metric => {
              const percentage = progressPercent(metric.actual, metric.target);
              return (
                <div key={metric.label} className="rounded-xl border border-gray-700/60 bg-gray-800/60 p-3">
                  <div className="text-xs text-gray-400">{metric.label}</div>
                  <div className="mt-2 flex items-baseline gap-1 text-white">
                    <span className="text-xl font-bold">{metric.money ? `¥${Math.round(metric.actual).toLocaleString()}` : metric.actual.toLocaleString()}</span>
                    <span className="text-xs text-gray-500">/ {metric.target > 0 ? (metric.money ? `¥${Math.round(metric.target).toLocaleString()}` : metric.target.toLocaleString()) : "未設定"}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-700">
                    <div
                      className={`h-full rounded-full ${percentage != null && percentage >= 100 ? "bg-emerald-400" : "bg-orange-400"}`}
                      style={{ width: `${Math.min(100, percentage || 0)}%` }}
                    />
                  </div>
                  <div className={`mt-1 text-xs ${percentage == null ? "text-gray-500" : percentage >= 100 ? "text-emerald-400" : "text-orange-300"}`}>
                    {percentage == null ? "目標を入力してください" : `達成率 ${percentage}%`}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 border-t border-gray-700/70 p-4 sm:p-5 xl:grid-cols-[1.35fr_1fr]">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-200">
                <Handshake className="h-4 w-4 text-orange-400" />
                新規ブランドの交渉順序
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["①", "坑位費", "最初に固定費を提案。枠・制作・運営価値を明示"],
                  ["②", "ROI保証 1:2", "難しい場合は、売上2に対して投資1の条件で提案"],
                  ["③", "完全成果報酬", "最後の選択肢。先に純佣を提示しない"],
                ].map(([order, title, description], index) => (
                  <div key={title} className={`rounded-xl border p-3 ${index === 0 ? "border-orange-500/40 bg-orange-500/10" : index === 1 ? "border-cyan-500/40 bg-cyan-500/10" : "border-violet-500/40 bg-violet-500/10"}`}>
                    <div className="flex items-center gap-2 font-semibold text-white"><span className="text-lg">{order}</span>{title}</div>
                    <p className="mt-1 text-xs leading-5 text-gray-400">{description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-semibold text-gray-200">今月のBDパイプライン</div>
              <div className="flex flex-wrap gap-2">
                {(businessOverview?.pipeline || []).map(item => (
                  <Badge key={item.stage} className={`${bdStageColors[item.stage as BrandBdStage]} border px-2.5 py-1`}>
                    {BRAND_BD_STAGE_LABELS[item.stage as BrandBdStage]} {item.count}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className={`rounded-lg border p-2 ${businessOverview?.risks.overdueFollowUps ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-gray-700 text-gray-400"}`}>
                  期限超過フォロー {businessOverview?.risks.overdueFollowUps || 0}
                </div>
                <div className={`rounded-lg border p-2 ${businessOverview?.risks.missingNextActions ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" : "border-gray-700 text-gray-400"}`}>
                  次アクション未設定 {businessOverview?.risks.missingNextActions || 0}
                </div>
              </div>
              {businessOverview?.target.goalNote && (
                <p className="mt-3 rounded-lg bg-gray-800/70 p-2 text-xs leading-5 text-gray-300">今月の方針：{businessOverview.target.goalNote}</p>
              )}
            </div>
          </div>
        </section>
        )}

        {/* Sync History Panel */}
        {showSyncHistory && (
          <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/50 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <History className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-gray-200">飛書同期履歴</span>
                <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-300">自動: 6時間ごと</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowSyncHistory(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {syncHistoryQuery.isLoading ? (
              <p className="text-sm text-gray-400">読み込み中...</p>
            ) : syncHistoryQuery.data && syncHistoryQuery.data.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {syncHistoryQuery.data.map((h: any) => (
                  <div key={h.id} className="flex flex-col gap-2 rounded-lg bg-gray-900/50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {h.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className="text-gray-300">
                        {h.totalRecords}件取得 / {h.newRecords}件新規 / {h.updatedRecords}件更新
                      </span>
                      <Badge variant="outline" className={`text-xs ${h.triggeredBy === 'auto' ? 'border-cyan-500/50 text-cyan-300' : 'border-amber-500/50 text-amber-300'}`}>
                        {h.triggeredBy === 'auto' ? '自動' : '手動'}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">
                        {new Date(h.syncedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs text-gray-600">({Math.round((h.durationMs || 0) / 1000)}s)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">同期履歴がありません。「飛書同期」ボタンを押して初回同期を実行してください。</p>
            )}
          </div>
        )}

        {/* Period Filter */}
        <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/50 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">{t.period}</span>
            <span className="text-sm text-red-400 sm:ml-2">{t.selectedPeriod}: {getPeriodLabel()}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button
              variant={periodFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("all")}
              className={`min-h-10 w-full sm:w-auto ${periodFilter === "all" ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300 hover:bg-gray-700"}`}
            >
              {t.allTime}
            </Button>
            <Button
              variant={periodFilter === "thisMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("thisMonth")}
              className={`min-h-10 w-full sm:w-auto ${periodFilter === "thisMonth" ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300 hover:bg-gray-700"}`}
            >
              {t.thisMonth}
            </Button>
            <Button
              variant={periodFilter === "lastMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("lastMonth")}
              className={`min-h-10 w-full sm:w-auto ${periodFilter === "lastMonth" ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300 hover:bg-gray-700"}`}
            >
              {t.lastMonth}
            </Button>
            <div className="relative w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomPeriod(!showCustomPeriod)}
                className="min-h-10 w-full border-gray-600 text-gray-300 hover:bg-gray-700 sm:w-auto"
              >
                {t.custom}
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
              {showCustomPeriod && (
                <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-44 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
                  {periodOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setPeriodFilter(option.value);
                        setShowCustomPeriod(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-700 ${
                        periodFilter === option.value ? "bg-red-600/20 text-red-400" : "text-gray-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7">
          <div className="min-w-0 rounded-xl border border-red-500/30 bg-gradient-to-br from-red-600/20 to-orange-600/20 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-1.5 text-red-400 sm:gap-2">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="text-xs leading-tight">{t.totalBrands}</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalBrands}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-green-500/30 bg-gradient-to-br from-green-600/20 to-emerald-600/20 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-1.5 text-green-400 sm:gap-2">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="text-xs leading-tight">{t.contractedBrands}</span>
            </div>
            <div className="text-2xl font-bold text-white">{contractedBrands}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-1.5 text-blue-400 sm:gap-2">
              <RefreshCw className="h-4 w-4 shrink-0" />
              <span className="text-xs leading-tight">飛書同期</span>
            </div>
            <div className="text-2xl font-bold text-white">{larkSyncedBrands}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-600/20 to-yellow-600/20 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-1.5 text-amber-400 sm:gap-2">
              <Crown className="h-4 w-4 shrink-0" />
              <span className="text-xs leading-tight">Tier1/Tier2</span>
            </div>
            <div className="text-2xl font-bold text-white">{tier1Brands}/{tier2Brands}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-600/20 to-amber-600/20 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-1.5 text-yellow-400 sm:gap-2">
              <DollarSign className="h-4 w-4 shrink-0" />
              <span className="text-xs leading-tight">{t.totalAdBudget}</span>
            </div>
            <div className="whitespace-nowrap text-lg font-bold tracking-tight text-white sm:text-xl">
              ¥{Math.round(filteredStats.totalAdBudget).toLocaleString()}
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-1.5 text-cyan-400 sm:gap-2">
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span className="text-xs leading-tight">{t.totalGmv}</span>
            </div>
            <div className="whitespace-nowrap text-lg font-bold tracking-tight text-white sm:text-xl">
              ¥{Math.round(filteredStats.totalGmv).toLocaleString()}
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-600/20 to-violet-600/20 p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-1.5 text-purple-400 sm:gap-2">
              <Gem className="h-4 w-4 shrink-0" />
              <span className="text-xs leading-tight">{t.lcjReward}</span>
            </div>
            <div className="whitespace-nowrap text-lg font-bold tracking-tight text-white sm:text-xl">
              ¥{Math.round(filteredStats.lcjReward).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/50 p-3 sm:mb-8 sm:p-6">
          <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap sm:gap-4 xl:grid xl:grid-cols-[200px_200px_minmax(360px,1fr)_auto] xl:items-end">
            <div className="min-w-0 space-y-2">
              <label className="text-sm font-medium text-gray-300">{t.sortBy}</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full border-gray-600 bg-gray-700/50 text-white sm:w-[180px] xl:w-full">
                  <SelectValue placeholder={t.sortByGmv} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="gmv">{t.sortByGmv}</SelectItem>
                  <SelectItem value="adBudget">{t.sortByAdBudget}</SelectItem>
                  <SelectItem value="name">{t.sortByName}</SelectItem>
                  <SelectItem value="createdAt">{t.sortByCreatedAt}</SelectItem>
                  <SelectItem value="tier">{t.sortByTier}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-2">
              <label className="text-sm font-medium text-gray-300">{t.status}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full border-gray-600 bg-gray-700/50 text-white sm:w-[180px] xl:w-full">
                  <SelectValue placeholder={t.allStatus} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">{t.allStatus}</SelectItem>
                  <SelectItem value="進行中">{t.inProgress}</SelectItem>
                  <SelectItem value="打ち合わせ中">{t.meeting}</SelectItem>
                  <SelectItem value="契約済み">{t.contracted}</SelectItem>
                  <SelectItem value="保留">{t.onHold}</SelectItem>
                  <SelectItem value="終了">{t.ended}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 min-w-0 space-y-2 sm:min-w-[200px] sm:flex-1 xl:min-w-0">
              <label className="text-sm font-medium text-gray-300">{t.search}</label>
              <div className="flex min-w-0 gap-2">
                <Input
                  placeholder={t.search}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="min-w-0 bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button onClick={handleSearch} className="min-h-10 shrink-0 bg-red-600 px-3 hover:bg-red-700 sm:px-4">
                  <Search className="h-4 w-4 mr-2" />
                  {t.searchBtn}
                </Button>
              </div>
            </div>

            {(statusFilter || appliedSearch || periodFilter !== "all") && (
              <Button variant="outline" onClick={handleClearFilter} className="col-span-2 min-h-10 w-full border-gray-600 text-gray-300 hover:bg-gray-700 sm:w-auto">
                <X className="h-4 w-4 mr-2" />
                {t.clearFilter}
              </Button>
            )}
          </div>
        </div>

        {/* Brand Cards Grid */}
        {brands && brands.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {brands.map((brand) => {
              const deal: any = dealByBrandId.get(brand.id);
              const stage = (deal?.stage || "new_lead") as BrandBdStage;
              return (
                <div key={brand.id} className={`group relative h-full min-w-0 overflow-hidden rounded-xl p-4 transition-all sm:p-6 ${
                  (brand as any).hasQuota 
                    ? 'bg-gradient-to-br from-orange-950/60 via-red-950/40 to-amber-950/50 border-2 border-orange-500/70 hover:border-orange-400 hover:shadow-[0_0_40px_rgba(255,140,0,0.4)] shadow-[0_0_25px_rgba(255,100,0,0.25)]' 
                    : 'bg-gray-800/50 border border-gray-700/50 hover:border-red-500/50 hover:bg-gray-800/70'
                }`}>
                  {/* ノルマありブランドの光彩エフェクト */}
                  {(brand as any).hasQuota && (
                    <>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-500/15 rounded-full blur-2xl" />
                    </>
                  )}
                  <div className="mb-3 flex items-start gap-3 sm:mb-4 sm:gap-4">
                    {brand.logoUrl ? (
                      <img
                        src={brand.logoUrl}
                        alt={brand.name}
                        className="h-12 w-12 shrink-0 rounded-xl bg-gray-700/50 object-contain sm:h-16 sm:w-16"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-700 to-gray-600 sm:h-16 sm:w-16">
                        <Building2 className="h-6 w-6 text-gray-400 sm:h-8 sm:w-8" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="break-words text-base font-bold leading-snug text-white transition-colors group-hover:text-red-400 sm:text-lg" title={brand.name}>
                        {brand.name.length > 20 ? brand.name.slice(0, 20) + '...' : brand.name}
                        {brand.nameJa && brand.nameJa !== brand.name && (
                          <span className="ml-1 text-sm font-normal text-red-400 sm:ml-2">({brand.nameJa.length > 15 ? brand.nameJa.slice(0, 15) + '...' : brand.nameJa})</span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-400 truncate">{brand.companyName || "-"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge className={`${statusColors[brand.status] || "bg-gray-500/20 text-gray-400"} border`}>
                          {getStatusLabel(brand.status)}
                        </Badge>
                        {(brand as any).larkRecordId && (
                          <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs">
                            Lark
                          </Badge>
                        )}
                        {(brand as any).hasTikTokBackend && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs">
                            TikTok後台
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* 飛書データ: Tier + カテゴリ + 担当者 */}
                  {(brand as any).larkRecordId && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(brand as any).larkTier && (
                        <Badge className={`text-xs px-2 py-0.5 ${
                          (brand as any).larkTier === 'Tier1' 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        }`}>
                          <Crown className="h-3 w-3 mr-1" />
                          {(brand as any).larkTier}
                        </Badge>
                      )}
                      {(brand as any).larkCategory && (
                        <Badge className="bg-violet-500/20 text-violet-300 border border-violet-500/40 text-xs px-2 py-0.5">
                          <Tag className="h-3 w-3 mr-1" />
                          {(brand as any).larkCategory}
                        </Badge>
                      )}
                      {(brand as any).larkStage && (
                        <Badge className="bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs px-2 py-0.5">
                          {(brand as any).larkStage}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* 担当者情報 - コンパクト表示 */}
                  {(brand as any).larkRecordId && ((brand as any).larkBusinessContact || (brand as any).larkBusinessLead || (brand as any).larkOperationsContact) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs bg-gray-900/30 rounded-lg px-2.5 py-1.5">
                      {(brand as any).larkBusinessContact && (
                        <span className="text-gray-400">
                          <span className="text-gray-500">商務:</span> <span className="text-sky-300">{(brand as any).larkBusinessContact}</span>
                        </span>
                      )}
                      {(brand as any).larkBusinessLead && (
                        <span className="text-gray-400">
                          <span className="text-gray-500">負責:</span> <span className="text-orange-300">{(brand as any).larkBusinessLead}</span>
                        </span>
                      )}
                      {(brand as any).larkOperationsContact && (
                        <span className="text-gray-400">
                          <span className="text-gray-500">運営:</span> <span className="text-emerald-300">{(brand as any).larkOperationsContact}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* ブランド商務BD */}
                  {canAccessBrandBusiness && (
                  <div className="mb-3 rounded-xl border border-gray-700/70 bg-gray-900/55 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">ブランド商務BD</div>
                        <Badge className={`${bdStageColors[stage]} border text-xs`}>
                          {BRAND_BD_STAGE_LABELS[stage]}
                        </Badge>
                      </div>
                      <button
                        onClick={event => openDealEditor(event, { id: brand.id, name: brand.name })}
                        className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-orange-500/30 px-2.5 text-xs text-orange-300 transition-colors hover:bg-orange-500/10"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        商務更新
                      </button>
                    </div>
                    {deal ? (
                      <div className="mt-3 space-y-1.5 text-xs">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-400">
                          <span>契約方式: <strong className="text-gray-200">{deal.dealModel ? BRAND_DEAL_MODEL_LABELS[deal.dealModel as BrandDealModel] : "未確定"}</strong></span>
                          {deal.dealModel === "slot_fee" && deal.slotFeeAmount != null && <span className="text-orange-300">¥{Number(deal.slotFeeAmount).toLocaleString()}</span>}
                          {deal.dealModel === "guaranteed_roi" && <span className="text-cyan-300">ROI 1:{Number(deal.guaranteedRoi || 2).toLocaleString()}</span>}
                          {deal.dealModel === "pure_commission" && deal.pureCommissionRate != null && <span className="text-violet-300">{Number(deal.pureCommissionRate)}%</span>}
                        </div>
                        <div className="flex items-start gap-1.5 text-gray-300">
                          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <span>次回 {compactDateTime(deal.nextFollowUpAt)} · {deal.nextAction || "次アクション未設定"}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-yellow-300">未設定：まず坑位費の提案内容と次回アクションを登録してください。</p>
                    )}
                  </div>
                  )}

                  <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="min-w-0 rounded-lg bg-gray-700/30 p-2.5 sm:p-3">
                      <div className="text-xs text-gray-400 mb-1">{'広告費'}</div>
                      <div className="truncate text-base font-semibold text-yellow-400 sm:text-lg">
                        {(brand as any).totalAdBudget ? `¥${((brand as any).totalAdBudget).toLocaleString()}` : "-"}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-lg bg-gray-700/30 p-2.5 sm:p-3">
                      <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        GMV
                      </div>
                      <div className="truncate text-base font-semibold text-green-400 sm:text-lg">
                        {(brand as any).totalGmv ? `¥${((brand as any).totalGmv).toLocaleString()}` : "-"}
                      </div>
                    </div>
                  </div>

                  {/* ノルマバッジ + KOL別進捗 - 派手な強調デザイン */}
                  {(brand as any).hasQuota && (
                    <div className="relative mb-3 bg-gradient-to-r from-orange-900/40 via-red-900/30 to-amber-900/40 rounded-xl p-3 border border-orange-500/40">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-orange-500/90 text-white px-3 py-1 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(255,140,0,0.5)] animate-pulse">
                          <Flame className="h-4 w-4" />
                          ノルマあり
                        </div>
                        {(brand as any).quotaSummary?.kgLiveHours > 0 && (
                          <Badge className="bg-red-500/20 text-red-300 border border-red-500/50 text-xs px-2 py-0.5 font-bold">
                            KG {(brand as any).quotaSummary.kgLiveHours}h
                          </Badge>
                        )}
                        {(brand as any).quotaSummary?.liverLiveHours > 0 && (
                          <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/50 text-xs px-2 py-0.5 font-bold">
                            達人 {(brand as any).quotaSummary.liverLiveHours}h
                          </Badge>
                        )}
                        {(brand as any).quotaSummary?.shortVideoCount > 0 && (
                          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/50 text-xs px-2 py-0.5 font-bold">
                            動画 {(brand as any).quotaSummary.shortVideoCount}本
                          </Badge>
                        )}
                      </div>
                      {/* KOL別ノルマ進捗ミニバー */}
                      {(brand as any).kolProgress && (brand as any).kolProgress.length > 0 && (
                        <div className="space-y-1.5">
                          {(brand as any).kolProgress.map((kol: any, idx: number) => {
                            const pct = kol.progressPercent || 0;
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs text-gray-300 w-20 truncate font-medium">{kol.liverName}</span>
                                <div className="flex-1 bg-gray-800/80 rounded-full h-2.5">
                                  <div
                                    className={`h-2.5 rounded-full transition-all ${pct >= 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : pct >= 70 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-blue-400 to-cyan-500'}`}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold min-w-[32px] text-right ${pct >= 100 ? 'text-green-400' : pct >= 70 ? 'text-yellow-400' : 'text-blue-400'}`}>{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 操作ボタン */}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setLocation(`/master/brands/${brand.id}`)}
                      className="flex min-h-10 items-center gap-1 rounded px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                    >
                      詳細
                      <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                    </button>
                    <button
                      onClick={(e) => handleMerge(e, { id: brand.id, name: brand.name })}
                      className="flex min-h-10 items-center gap-1 rounded px-3 py-2 text-xs text-gray-500 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
                    >
                      <Merge className="h-3.5 w-3.5" />
                      合併
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, { id: brand.id, name: brand.name })}
                      className="flex min-h-10 items-center gap-1 rounded px-3 py-2 text-xs text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      削除
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">{t.noData}</p>
          </div>
        )}
      </div>

      {/* ブランド商務月間目標 */}
      <Dialog open={showMonthlyTarget} onOpenChange={setShowMonthlyTarget}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto border-gray-700 bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle>{businessMonth.year}年{businessMonth.month}月 ブランド商務目標</DialogTitle>
            <DialogDescription className="text-gray-400">
              これはブランド商務チーム全体の1か月目標です。各ブランドのGMV目標とは別に管理します。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["newBrandTarget", "新規ブランド登録目標", "件"],
              ["contactTarget", "BD接触目標", "社"],
              ["negotiationTarget", "商談化目標", "社"],
              ["contractTarget", "契約成立目標", "社"],
              ["slotFeeContractTarget", "坑位費契約目標", "社"],
              ["slotFeeRevenueTarget", "坑位費売上目標", "円"],
            ].map(([key, label, unit]) => (
              <div key={key} className="space-y-2">
                <Label className="text-gray-300">{label}</Label>
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    min={0}
                    type="number"
                    value={monthlyTargetDraft[key as keyof MonthlyTargetDraft]}
                    onChange={event => setMonthlyTargetDraft(current => ({ ...current, [key]: event.target.value }))}
                    className="border-gray-600 bg-gray-800 pr-10 text-white"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">今月の方針・重点</Label>
            <Textarea
              value={monthlyTargetDraft.goalNote}
              onChange={event => setMonthlyTargetDraft(current => ({ ...current, goalNote: event.target.value }))}
              placeholder="例：新規20社へBD。まず坑位費を提案し、難しい場合のみROI 1:2、最後に完全成果報酬へ切り替える。"
              rows={4}
              className="border-gray-600 bg-gray-800 text-white placeholder:text-gray-600"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMonthlyTarget(false)} className="border-gray-600 text-gray-300">キャンセル</Button>
            <Button onClick={saveMonthlyTarget} disabled={saveMonthlyTargetMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {saveMonthlyTargetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
              月間目標を保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ブランド別BD進捗 */}
      <Dialog open={!!editingDealBrand} onOpenChange={open => !open && setEditingDealBrand(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto border-gray-700 bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle>{editingDealBrand?.name} · ブランド商務BD</DialogTitle>
            <DialogDescription className="text-gray-400">
              商談の段階、提示条件、次回フォローを更新します。変更は履歴として保存されます。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 sm:grid-cols-3">
            <div><div className="font-semibold text-orange-300">① 坑位費</div><p className="mt-1 text-xs text-gray-400">最初に固定費を提案</p></div>
            <div><div className="font-semibold text-cyan-300">② ROI保証 1:2</div><p className="mt-1 text-xs text-gray-400">次に投資1：売上2を提案</p></div>
            <div><div className="font-semibold text-violet-300">③ 完全成果報酬</div><p className="mt-1 text-xs text-gray-400">最後の選択肢として提示</p></div>
          </div>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-gray-300">現在のBD段階</Label>
              <Select value={dealDraft.stage} onValueChange={value => setDealDraft(current => {
                const nextStage = value as BrandBdStage;
                const contractModel = nextStage === "contracted"
                  ? editingFromStage === "slot_fee" ? "slot_fee" : editingFromStage === "guaranteed_roi" ? "guaranteed_roi" : editingFromStage === "pure_commission" ? "pure_commission" : current.dealModel
                  : current.dealModel;
                return { ...current, stage: nextStage, dealModel: contractModel };
              })}>
                <SelectTrigger className="border-gray-600 bg-gray-800 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="border-gray-700 bg-gray-800">
                  {BRAND_BD_STAGE_VALUES.filter(stage => canTransitionBrandBdStage(editingFromStage, stage)).map(stage => <SelectItem key={stage} value={stage}>{BRAND_BD_STAGE_LABELS[stage]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">確定した契約方式</Label>
              <Select value={dealDraft.dealModel || "undecided"} onValueChange={value => setDealDraft(current => ({ ...current, dealModel: value === "undecided" ? "" : value as BrandDealModel }))}>
                <SelectTrigger className="border-gray-600 bg-gray-800 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="border-gray-700 bg-gray-800">
                  <SelectItem value="undecided">未確定</SelectItem>
                  {BRAND_DEAL_MODEL_VALUES.map(model => <SelectItem key={model} value={model}>{BRAND_DEAL_MODEL_LABELS[model]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">坑位費の提示額（円）</Label>
              <Input type="number" min={0} inputMode="numeric" value={dealDraft.slotFeeAmount} onChange={event => setDealDraft(current => ({ ...current, slotFeeAmount: event.target.value }))} className="border-gray-600 bg-gray-800 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">保証ROI（売上側）</Label>
              <div className="flex items-center gap-2"><span className="text-gray-400">1 :</span><Input type="number" value="2" disabled className="border-gray-600 bg-gray-800 text-white disabled:opacity-100" /></div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">完全成果報酬率（%）</Label>
              <Input type="number" min={0} max={100} step="0.1" value={dealDraft.pureCommissionRate} onChange={event => setDealDraft(current => ({ ...current, pureCommissionRate: event.target.value }))} className="border-gray-600 bg-gray-800 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">最終接触日時</Label>
              <Input type="datetime-local" value={dealDraft.lastContactAt} onChange={event => setDealDraft(current => ({ ...current, lastContactAt: event.target.value }))} className="border-gray-600 bg-gray-800 text-white" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-gray-300">次回フォロー日時</Label>
              <Input type="datetime-local" value={dealDraft.nextFollowUpAt} onChange={event => setDealDraft(current => ({ ...current, nextFollowUpAt: event.target.value }))} className="border-gray-600 bg-gray-800 text-white" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-gray-300">次の具体的アクション</Label>
              <Input value={dealDraft.nextAction} onChange={event => setDealDraft(current => ({ ...current, nextAction: event.target.value }))} placeholder="例：坑位費50万円の提案書を9/22までに送付" className="border-gray-600 bg-gray-800 text-white placeholder:text-gray-600" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-gray-300">商談メモ</Label>
              <Textarea value={dealDraft.negotiationNotes} onChange={event => setDealDraft(current => ({ ...current, negotiationNotes: event.target.value }))} rows={4} placeholder="相手の反応、意思決定者、懸念、提示済み条件を記録" className="border-gray-600 bg-gray-800 text-white placeholder:text-gray-600" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDealBrand(null)} className="border-gray-600 text-gray-300">キャンセル</Button>
            <Button onClick={saveDeal} disabled={saveDealMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {saveDealMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              BD進捗を保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg border-gray-700 bg-gray-900 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">ブランドを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              <strong className="text-red-400">{deleteTarget?.name}</strong> を削除します。この操作により、関連する商品、ライブ配信、契約、メモなどのデータもすべて削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ブランド合併ダイアログ */}
      <AlertDialog open={!!mergeSource} onOpenChange={(open) => { if (!open) { setMergeSource(null); setMergeTargetId(null); } }}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg border-gray-700 bg-gray-900 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">ブランドを合併</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              <strong className="text-blue-400">{mergeSource?.name}</strong> を他のブランドに合併します。商品・配信・契約等の全データが統合先に移行され、このブランドは削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <label className="text-sm text-gray-300 mb-2 block">統合先ブランドを選択:</label>
            <select
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
              value={mergeTargetId || ''}
              onChange={(e) => setMergeTargetId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">選択してください...</option>
              {(brandsData || []).filter((b: any) => b.id !== mergeSource?.id).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name} (ID: {b.id})</option>
              ))}
            </select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmMerge}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!mergeTargetId || mergeMutation.isPending}
            >
              {mergeMutation.isPending ? "合併中..." : "合併する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
