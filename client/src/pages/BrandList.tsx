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
import { Plus, Search, Building2, X, ArrowLeft, DollarSign, TrendingUp, Gem, Calendar, ChevronDown } from "lucide-react";

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
  const t = translations[language];
  const [, setLocation] = useLocation();
  
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("gmv");
  const [periodFilter, setPeriodFilter] = useState<string>("all"); // "all", "thisMonth", "lastMonth", "YYYY-MM"
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);

  const periodOptions = useMemo(() => generatePeriodOptions(), []);

  const { data: brandsData, isLoading } = trpc.brand.list.useQuery({
    status: statusFilter || undefined,
    search: appliedSearch || undefined,
  });

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
    if (sortBy === "gmv") {
      const gmvA = (a as any).totalGmv || 0;
      const gmvB = (b as any).totalGmv || 0;
      return gmvB - gmvA;
    } else if (sortBy === "adBudget") {
      const adA = (a as any).totalAdBudget || 0;
      const adB = (b as any).totalAdBudget || 0;
      return adB - adA;
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
    return statusMap[status]?.[language] || status;
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
          <Link href="/brands/new">
            <Button className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              {t.newBrand}
            </Button>
          </Link>
        </div>

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

        {/* KPI Cards - 6 cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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
              <Link key={brand.id} href={`/brands/${brand.id}`}>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 hover:border-red-500/50 hover:bg-gray-800/70 transition-all cursor-pointer group">
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
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">{language === 'ja' ? '広告費' : '广告费'}</div>
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
    </div>
  );
}
