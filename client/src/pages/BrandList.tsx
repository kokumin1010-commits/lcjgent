import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const translations = {
  ja: {
    title: "ブランド管理・登録",
    newBrand: "ブランド登録",
    filter: "絞り込み",
    status: "ステータス",
    allStatus: "すべて",
    search: "ブランド名検索",
    searchBtn: "検索",
    clearFilter: "フィルターをクリア",
    brandName: "ブランド名",
    statusCol: "ステータス",
    adBudget: "広告費",
    salesTarget: "売上目標",
    commissionRate: "成果報酬",
    noData: "ブランドがありません",
    inProgress: "進行中",
    meeting: "打ち合わせ中",
    contracted: "契約済み",
    onHold: "保留",
    ended: "終了",
  },
  zh: {
    title: "品牌管理・注册",
    newBrand: "品牌注册",
    filter: "筛选",
    status: "状态",
    allStatus: "全部",
    search: "品牌名搜索",
    searchBtn: "搜索",
    clearFilter: "清除筛选",
    brandName: "品牌名",
    statusCol: "状态",
    adBudget: "广告费",
    salesTarget: "销售目标",
    commissionRate: "成果报酬",
    noData: "没有品牌",
    inProgress: "进行中",
    meeting: "洽谈中",
    contracted: "已签约",
    onHold: "保留",
    ended: "结束",
  },
};

const statusColors: Record<string, string> = {
  "進行中": "bg-blue-100 text-blue-800",
  "打ち合わせ中": "bg-yellow-100 text-yellow-800",
  "契約済み": "bg-green-100 text-green-800",
  "保留": "bg-gray-100 text-gray-800",
  "終了": "bg-red-100 text-red-800",
};

export default function BrandList() {
  const { language } = useLanguage();
  const t = translations[language];
  
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

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "-";
    return `¥${value.toLocaleString()}`;
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {t.title}
          </h1>
          <Link href="/brands/new">
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              {t.newBrand}
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.status}</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t.allStatus} />
                  </SelectTrigger>
                  <SelectContent>
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
                <label className="text-sm font-medium">{t.search}</label>
                <div className="flex gap-2">
                  <Input
                    placeholder={t.search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} className="bg-red-600 hover:bg-red-700">
                    <Search className="h-4 w-4 mr-2" />
                    {t.searchBtn}
                  </Button>
                </div>
              </div>

              {(statusFilter || appliedSearch) && (
                <Button variant="outline" onClick={handleClearFilter}>
                  <X className="h-4 w-4 mr-2" />
                  {t.clearFilter}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Brand List Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : brands && brands.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>{t.brandName}</TableHead>
                    <TableHead>{t.statusCol}</TableHead>
                    <TableHead className="text-right">{t.adBudget}</TableHead>
                    <TableHead className="text-right">{t.salesTarget}</TableHead>
                    <TableHead className="text-right">{t.commissionRate}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((brand) => (
                    <TableRow key={brand.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        {brand.logoUrl ? (
                          <img
                            src={brand.logoUrl}
                            alt={brand.name}
                            className="w-10 h-10 object-contain rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                            LOGO
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/brands/${brand.id}`}>
                          <span className="font-medium text-blue-600 hover:underline">
                            {brand.name}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[brand.status] || "bg-gray-100"}>
                          {getStatusLabel(brand.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(brand.adBudget)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(brand.salesTarget)}
                      </TableCell>
                      <TableCell className="text-right">
                        {brand.commissionRate || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">{t.noData}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
