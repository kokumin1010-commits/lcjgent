import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, X, ArrowLeft, DollarSign, TrendingUp, Gem, Calendar, ChevronDown, Handshake, Trash2, Target, AlertTriangle, Flame, RefreshCw, Users, Tag, Crown, History, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
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

  const utils = trpc.useUtils();

  const { data: brandsData, isLoading } = trpc.brand.list.useQuery({
    status: statusFilter || undefined,
    search: appliedSearch || undefined,
  });

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

  // ソートされたブランドリスト
  const brands = brandsData ? [...brandsData].sort((a, b) => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>{t.back}</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{t.title}</h1>
                <p className="text-gray-400 text-sm">{t.subtitle}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowSyncHistory(!showSyncHistory)}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <History className="h-4 w-4 mr-2" />
              同期履歴
            </Button>
            <Button
              onClick={() => syncLarkMutation.mutate()}
              disabled={syncLarkMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncLarkMutation.isPending ? 'animate-spin' : ''}`} />
              {syncLarkMutation.isPending ? '同期中...' : '飞書同期'}
            </Button>
            <Link href="/master/recruitment">
              <Button className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white">
                <Handshake className="h-4 w-4 mr-2" />
                招商管理
              </Button>
            </Link>
            <Link href="/master/brands/new">
              <Button className="bg-red-600 hover:bg-red-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                {t.newBrand}
              </Button>
            </Link>
          </div>
        </div>

        {/* Sync History Panel */}
        {showSyncHistory && (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
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
                  <div key={h.id} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-2 text-gray-500">
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
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">{t.period}</span>
            <span className="text-sm text-red-400 ml-2">{t.selectedPeriod}: {getPeriodLabel()}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={periodFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("all")}
              className={periodFilter === "all" ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300 hover:bg-gray-700"}
            >
              {t.allTime}
            </Button>
            <Button
              variant={periodFilter === "thisMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("thisMonth")}
              className={periodFilter === "thisMonth" ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300 hover:bg-gray-700"}
            >
              {t.thisMonth}
            </Button>
            <Button
              variant={periodFilter === "lastMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("lastMonth")}
              className={periodFilter === "lastMonth" ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-300 hover:bg-gray-700"}
            >
              {t.lastMonth}
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomPeriod(!showCustomPeriod)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                {t.custom}
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
              {showCustomPeriod && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
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

        {/* KPI Cards - 8 cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <div className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <Building2 className="h-4 w-4" />
              <span className="text-xs">{t.totalBrands}</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalBrands}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Building2 className="h-4 w-4" />
              <span className="text-xs">{t.contractedBrands}</span>
            </div>
            <div className="text-2xl font-bold text-white">{contractedBrands}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <RefreshCw className="h-4 w-4" />
              <span className="text-xs">飛書同期</span>
            </div>
            <div className="text-2xl font-bold text-white">{larkSyncedBrands}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/20 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Crown className="h-4 w-4" />
              <span className="text-xs">Tier1/Tier2</span>
            </div>
            <div className="text-2xl font-bold text-white">{tier1Brands}/{tier2Brands}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/20 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">{t.totalAdBudget}</span>
            </div>
            <div className="text-xl font-bold text-white">
              ¥{Math.round(filteredStats.totalAdBudget).toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">{t.totalGmv}</span>
            </div>
            <div className="text-xl font-bold text-white">
              ¥{Math.round(filteredStats.totalGmv).toLocaleString()}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 border border-purple-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Gem className="h-4 w-4" />
              <span className="text-xs">{t.lcjReward}</span>
            </div>
            <div className="text-xl font-bold text-white">
              ¥{Math.round(filteredStats.lcjReward).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">{t.sortBy}</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] bg-gray-700/50 border-gray-600 text-white">
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">{t.status}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-gray-700/50 border-gray-600 text-white">
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

            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-sm font-medium text-gray-300">{t.search}</label>
              <div className="flex gap-2">
                <Input
                  placeholder={t.search}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button onClick={handleSearch} className="bg-red-600 hover:bg-red-700">
                  <Search className="h-4 w-4 mr-2" />
                  {t.searchBtn}
                </Button>
              </div>
            </div>

            {(statusFilter || appliedSearch || periodFilter !== "all") && (
              <Button variant="outline" onClick={handleClearFilter} className="border-gray-600 text-gray-300 hover:bg-gray-700">
                <X className="h-4 w-4 mr-2" />
                {t.clearFilter}
              </Button>
            )}
          </div>
        </div>

        {/* Brand Cards Grid */}
        {brands && brands.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand) => (
              <Link key={brand.id} href={`/master/brands/${brand.id}`}>
                <div className={`rounded-xl p-6 transition-all cursor-pointer group relative overflow-hidden ${
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
                  <div className="flex items-start gap-4 mb-4">
                    {brand.logoUrl ? (
                      <img
                        src={brand.logoUrl}
                        alt={brand.name}
                        className="w-16 h-16 object-contain rounded-xl bg-gray-700/50"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-600 rounded-xl flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                        {brand.name}
                        {brand.nameJa && <span className="text-sm font-normal text-red-400 ml-2">({brand.nameJa})</span>}
                      </h3>
                      <p className="text-sm text-gray-400">{brand.companyName || "-"}</p>
                    </div>
                    <Badge className={`${statusColors[brand.status] || "bg-gray-500/20 text-gray-400"} border`}>
                      {getStatusLabel(brand.status)}
                    </Badge>
                    {(brand as any).larkRecordId && (
                      <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs">
                        Lark
                      </Badge>
                    )}
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

                  {/* 担当者情報 */}
                  {(brand as any).larkRecordId && ((brand as any).larkBusinessContact || (brand as any).larkBusinessLead || (brand as any).larkOperationsContact) && (
                    <div className="flex flex-wrap gap-2 mb-3 text-xs">
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

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">{'広告費'}</div>
                      <div className="text-lg font-semibold text-yellow-400">
                        {(brand as any).totalAdBudget ? `¥${((brand as any).totalAdBudget).toLocaleString()}` : "-"}
                      </div>
                    </div>
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        GMV
                      </div>
                      <div className="text-lg font-semibold text-green-400">
                        {(brand as any).totalGmv ? `¥${((brand as any).totalGmv).toLocaleString()}` : "-"}
                      </div>
                    </div>
                  </div>

                  {/* ノルマバッジ + KOL別進捗 - 派手な強調デザイン */}
                  {(brand as any).hasQuota && (
                    <div className="relative mb-3 bg-gradient-to-r from-orange-900/40 via-red-900/30 to-amber-900/40 rounded-xl p-3 border border-orange-500/40">
                      <div className="flex items-center gap-2 mb-2">
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

                  {/* 削除ボタン */}
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => handleDelete(e, { id: brand.id, name: brand.name })}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      削除
                    </button>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">{t.noData}</p>
          </div>
        )}
      </div>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
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
    </div>
  );
}
