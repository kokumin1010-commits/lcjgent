import { useState } from "react";
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
import { Plus, Search, Building2, X, ArrowLeft, Package, Video, FileText, TrendingUp } from "lucide-react";

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
    totalProducts: "総商品数",
    totalLivestreams: "総直播数",
    back: "戻る",

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
    totalProducts: "总商品数",
    totalLivestreams: "总直播数",
    back: "返回",

  },
};

const statusColors: Record<string, string> = {
  "進行中": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "打ち合わせ中": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "契約済み": "bg-green-500/20 text-green-400 border-green-500/30",
  "保留": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "終了": "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function BrandList() {
  const { language } = useLanguage();
  const t = translations[language];
  const [, setLocation] = useLocation();
  
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const { data: brands, isLoading } = trpc.brand.list.useQuery({
    status: statusFilter || undefined,
    search: appliedSearch || undefined,
  });

  const handleSearch = () => {
    setAppliedSearch(searchTerm);
  };

  const handleClearFilter = () => {
    setStatusFilter("");
    setSearchTerm("");
    setAppliedSearch("");
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">{t.totalBrands}</span>
            </div>
            <div className="text-3xl font-bold text-white">{totalBrands}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm">{t.contractedBrands}</span>
            </div>
            <div className="text-3xl font-bold text-white">{contractedBrands}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Package className="h-4 w-4" />
              <span className="text-sm">{t.totalProducts}</span>
            </div>
            <div className="text-3xl font-bold text-white">-</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Video className="h-4 w-4" />
              <span className="text-sm">{t.totalLivestreams}</span>
            </div>
            <div className="text-3xl font-bold text-white">-</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-end">
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

            {(statusFilter || appliedSearch) && (
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
