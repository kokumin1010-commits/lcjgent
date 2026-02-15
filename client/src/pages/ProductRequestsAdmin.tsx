import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Package,
  Users,
  TrendingUp,
  ArrowLeft,
  BarChart3,
  FileText,
  ChevronRight,
  Heart,
  Download,
} from "lucide-react";

function formatCurrency(amount: number): string {
  return `¥${Math.round(amount).toLocaleString()}`;
}

export default function ProductRequestsAdmin() {
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  // Data queries
  const { data: brandRequests, isLoading: brandsLoading } = trpc.productRanking.adminBrandRequests.useQuery();
  const { data: brandDetail, isLoading: detailLoading } = trpc.productRanking.adminBrandRequestDetail.useQuery(
    { shopName: selectedBrand || "" },
    { enabled: !!selectedBrand }
  );

  // Summary stats
  const totalRequests = brandRequests?.reduce((sum, b) => sum + b.totalRequests, 0) || 0;
  const totalBrands = brandRequests?.length || 0;
  const totalProducts = brandRequests?.reduce((sum, b) => sum + b.uniqueProducts, 0) || 0;
  const totalUsers = brandRequests?.reduce((sum, b) => sum + b.uniqueUsers, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Heart className="h-6 w-6 text-rose-500" />
          入荷リクエスト管理
        </h1>
        <p className="text-gray-500 mt-1">
          ユーザーからの入荷リクエストをブランド別に集計。ブランド交渉の材料としてご活用ください。
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-rose-100 flex items-center justify-center">
                <Heart className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalRequests}</p>
                <p className="text-xs text-gray-500">総リクエスト数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Store className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalBrands}</p>
                <p className="text-xs text-gray-500">ブランド数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                <p className="text-xs text-gray-500">商品数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                <p className="text-xs text-gray-500">リクエストユーザー数</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedBrand ? (
        /* Brand Detail View */
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedBrand(null)}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            ブランド一覧に戻る
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-rose-500" />
                    {selectedBrand}
                  </CardTitle>
                  <CardDescription>
                    このブランドへの入荷リクエスト詳細
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : brandDetail && brandDetail.length > 0 ? (
                <div className="space-y-2">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-500 border-b">
                    <div className="col-span-1">#</div>
                    <div className="col-span-6">商品名</div>
                    <div className="col-span-2 text-center">リクエスト数</div>
                    <div className="col-span-3 text-right">最終リクエスト</div>
                  </div>
                  {brandDetail.map((item, index) => (
                    <div
                      key={item.productName}
                      className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg hover:bg-gray-50 items-center"
                    >
                      <div className="col-span-1 text-sm font-bold text-gray-400">
                        {index + 1}
                      </div>
                      <div className="col-span-6">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.productName}</p>
                        {item.productId && (
                          <p className="text-[10px] text-gray-400 mt-0.5">ID: {item.productId}</p>
                        )}
                      </div>
                      <div className="col-span-2 text-center">
                        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                          <Heart className="h-3 w-3 mr-1" />
                          {item.requestCount}
                        </Badge>
                      </div>
                      <div className="col-span-3 text-right text-xs text-gray-400">
                        {item.latestRequest ? new Date(item.latestRequest).toLocaleDateString("ja-JP") : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>リクエストデータがありません</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Brand List View */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-rose-500" />
              ブランド別リクエスト集計
            </CardTitle>
            <CardDescription>
              リクエスト数の多い順に表示。クリックで詳細を確認できます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brandsLoading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : brandRequests && brandRequests.length > 0 ? (
              <div className="space-y-2">
                {brandRequests.map((brand, index) => (
                  <div
                    key={brand.shopName}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-rose-200 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => brand.shopName && setSelectedBrand(brand.shopName)}
                  >
                    <div className="flex-shrink-0 text-lg font-bold text-gray-300 w-8 text-center">
                      {index + 1}
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center flex-shrink-0">
                      <Store className="h-5 w-5 text-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{brand.shopName}</h3>
                      <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                        <span>{brand.uniqueProducts}商品</span>
                        <span>{brand.uniqueUsers}ユーザー</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge className="bg-rose-500 text-white hover:bg-rose-500 text-sm px-3">
                        <Heart className="h-3.5 w-3.5 mr-1" />
                        {brand.totalRequests}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Heart className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">まだリクエストがありません</p>
                <p className="text-sm">
                  ユーザーが商品ランキングページから入荷リクエストを送ると、ここに集計されます。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
