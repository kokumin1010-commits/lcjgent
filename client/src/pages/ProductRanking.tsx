import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useLocation, Link } from "wouter";
import {
  ShoppingBag,
  TrendingUp,
  Heart,
  HeartOff,
  Crown,
  Medal,
  Award,
  Search,
  ArrowLeft,
  Package,
  Store,
  UserPlus,
  ChevronRight,
  Flame,
  Star,
  BarChart3,
  Receipt,
  Users,
  ShoppingCart,
} from "lucide-react";

function formatCurrency(amount: number): string {
  return `¥${Math.round(amount).toLocaleString()}`;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-bold text-gray-400 w-5 text-center">{rank}</span>;
}

function getRankBg(rank: number) {
  if (rank === 1) return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200";
  if (rank === 2) return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
  if (rank === 3) return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
  return "bg-white border-gray-100";
}

function getReceiptRankBg(rank: number) {
  if (rank === 1) return "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200";
  if (rank === 2) return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
  if (rank === 3) return "bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200";
  return "bg-white border-gray-100";
}

export default function ProductRanking() {
  const [, setLocation] = useLocation();

  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("livecommerce");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedReceiptShop, setSelectedReceiptShop] = useState<string | null>(null);

  // ライブコマース売れ筋データ
  const { data: products, isLoading: productsLoading } = trpc.productRanking.topProducts.useQuery({ limit: 50 });
  const { data: brands, isLoading: brandsLoading } = trpc.productRanking.topBrands.useQuery({ limit: 30 });
  const { data: requestCounts } = trpc.productRanking.requestCounts.useQuery({ limit: 100 });
  const { data: myRequests, refetch: refetchMyRequests } = trpc.productRanking.myRequests.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: brandProducts, isLoading: brandProductsLoading } = trpc.productRanking.brandProducts.useQuery(
    { shopName: selectedBrand || "" },
    { enabled: !!selectedBrand }
  );

  // みんなの購入ランキングデータ
  const { data: receiptProducts, isLoading: receiptProductsLoading } = trpc.productRanking.receiptProductRanking.useQuery({ limit: 50 });
  const { data: receiptShops, isLoading: receiptShopsLoading } = trpc.productRanking.receiptShopRanking.useQuery({ limit: 30 });
  const { data: receiptShopProducts, isLoading: receiptShopProductsLoading } = trpc.productRanking.receiptProductsByShop.useQuery(
    { shopName: selectedReceiptShop || "" },
    { enabled: !!selectedReceiptShop }
  );

  // Mutations
  const requestMutation = trpc.productRanking.requestRestock.useMutation({
    onSuccess: (data) => {
      if (data.alreadyRequested) {
        toast.error("すでにリクエスト済みです");
      } else {
        toast.success("入荷リクエストを送信しました！", { description: "ご要望ありがとうございます。" });
      }
      refetchMyRequests();
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const cancelMutation = trpc.productRanking.cancelRequest.useMutation({
    onSuccess: () => {
      toast.success("リクエストを取り消しました");
      refetchMyRequests();
    },
  });

  // Request count map
  const requestCountMap = useMemo(() => {
    const map = new Map<string, number>();
    requestCounts?.forEach((r) => map.set(r.productName, r.requestCount));
    return map;
  }, [requestCounts]);

  // My requests set
  const myRequestsSet = useMemo(() => new Set(myRequests || []), [myRequests]);

  // Filtered products (ライブコマース)
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        (p.shopName && p.shopName.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  // Filtered brands (ライブコマース)
  const filteredBrands = useMemo(() => {
    if (!brands) return [];
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter((b) => b.shopName && b.shopName.toLowerCase().includes(q));
  }, [brands, searchQuery]);

  // Filtered receipt products
  const filteredReceiptProducts = useMemo(() => {
    if (!receiptProducts) return [];
    if (!searchQuery.trim()) return receiptProducts;
    const q = searchQuery.toLowerCase();
    return receiptProducts.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        (p.shopName && p.shopName.toLowerCase().includes(q))
    );
  }, [receiptProducts, searchQuery]);

  // Filtered receipt shops
  const filteredReceiptShops = useMemo(() => {
    if (!receiptShops) return [];
    if (!searchQuery.trim()) return receiptShops;
    const q = searchQuery.toLowerCase();
    return receiptShops.filter((s) => s.shopName && s.shopName.toLowerCase().includes(q));
  }, [receiptShops, searchQuery]);

  const handleRequest = (productName: string, shopName?: string | null) => {
    if (!isAuthenticated) {
      toast.error("ログインが必要です", { description: "入荷リクエストにはログインが必要です。" });
      setLocation("/line-login");
      return;
    }
    requestMutation.mutate({ productName, shopName: shopName || undefined });
  };

  const handleCancel = (productName: string) => {
    cancelMutation.mutate({ productName });
  };

  // Determine if we're in a brand detail view
  const inBrandDetail = activeTab === "livecommerce" && selectedBrand;
  const inReceiptShopDetail = activeTab === "purchases" && selectedReceiptShop;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => setLocation("/")} style={{ cursor: "pointer" }}>
            <ShoppingBag className="h-6 w-6 md:h-7 md:w-7 text-rose-500" />
            <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              LCJ MALL
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button size="sm" variant="outline" onClick={() => setLocation("/mypage")} className="text-xs md:text-sm">
                マイページ
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-rose-500 hover:bg-rose-600 text-white gap-1 text-xs md:text-sm px-3 md:px-4"
                onClick={() => setLocation("/line-login")}
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">無料ではじめる</span>
                <span className="sm:hidden">登録</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-8 md:py-12 px-4 bg-gradient-to-b from-rose-50/60 to-white">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Flame className="h-6 w-6 text-rose-500" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">商品ランキング</h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base mb-6">
            TikTok Shopで人気の商品をチェック。<br className="sm:hidden" />
            気になる商品には「入荷してほしい」ボタンでリクエストできます。
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="商品名・ブランド名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-gray-200"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-6 px-4">
        <div className="container mx-auto max-w-4xl">
          {inBrandDetail ? (
            /* ライブコマース Brand Detail View */
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBrand(null)}
                className="mb-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                ランキングに戻る
              </Button>

              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center">
                  <Store className="h-6 w-6 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedBrand}</h2>
                  <p className="text-sm text-gray-500">ブランド商品ランキング（ライブコマース）</p>
                </div>
              </div>

              {brandProductsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {brandProducts?.map((product, index) => (
                    <LiveCommerceProductCard
                      key={product.productName}
                      rank={index + 1}
                      productName={product.productName}
                      shopName={selectedBrand}
                      totalSales={product.totalSales}
                      totalQuantity={product.totalQuantity}
                      orderCount={product.orderCount}
                      requestCount={requestCountMap.get(product.productName) || 0}
                      isRequested={myRequestsSet.has(product.productName)}
                      isAuthenticated={isAuthenticated}
                      onRequest={() => handleRequest(product.productName, selectedBrand)}
                      onCancel={() => handleCancel(product.productName)}
                      isLoading={requestMutation.isPending || cancelMutation.isPending}
                    />
                  ))}
                  {brandProducts?.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>商品データがありません</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : inReceiptShopDetail ? (
            /* みんなの購入 Shop Detail View */
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedReceiptShop(null)}
                className="mb-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                ランキングに戻る
              </Button>

              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                  <Store className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedReceiptShop}</h2>
                  <p className="text-sm text-gray-500">ショップ内商品ランキング（実購入データ）</p>
                </div>
              </div>

              {receiptShopProductsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {receiptShopProducts?.map((product, index) => (
                    <ReceiptProductCard
                      key={product.productName}
                      rank={index + 1}
                      productName={product.productName}
                      shopName={selectedReceiptShop}
                      purchaseCount={product.purchaseCount}
                      totalAmount={product.totalAmount}
                      uniqueBuyers={product.uniqueBuyers}
                    />
                  ))}
                  {receiptShopProducts?.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>商品データがありません</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Main Tabs View */
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="livecommerce" className="gap-1 text-xs sm:text-sm">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">ライブコマース売れ筋</span>
                  <span className="sm:hidden">売れ筋</span>
                </TabsTrigger>
                <TabsTrigger value="purchases" className="gap-1 text-xs sm:text-sm">
                  <Receipt className="h-4 w-4" />
                  <span className="hidden sm:inline">みんなの購入</span>
                  <span className="sm:hidden">購入</span>
                </TabsTrigger>
              </TabsList>

              {/* ============================================================ */}
              {/* ライブコマース売れ筋ランキング Tab */}
              {/* ============================================================ */}
              <TabsContent value="livecommerce">
                <div className="mb-4 p-3 bg-rose-50 rounded-lg border border-rose-100">
                  <p className="text-xs text-rose-700 flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    TikTok Shopのライブコマース配信売上データに基づくランキングです
                  </p>
                </div>

                {/* Sub-tabs for products vs brands */}
                <Tabs defaultValue="lc-products">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="lc-products" className="gap-1 text-xs">
                      <TrendingUp className="h-3.5 w-3.5" />
                      商品別
                    </TabsTrigger>
                    <TabsTrigger value="lc-brands" className="gap-1 text-xs">
                      <Store className="h-3.5 w-3.5" />
                      ブランド別
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="lc-products">
                    {productsLoading ? (
                      <div className="space-y-3">
                        {[...Array(10)].map((_, i) => (
                          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredProducts.map((product, index) => (
                          <LiveCommerceProductCard
                            key={`${product.productName}-${product.shopName}`}
                            rank={index + 1}
                            productName={product.productName}
                            shopName={product.shopName}
                            totalSales={Number(product.totalAmount || 0)}
                            totalQuantity={Number(product.totalQuantity || 0)}
                            orderCount={Number(product.orderCount || 0)}
                            requestCount={requestCountMap.get(product.productName) || 0}
                            isRequested={myRequestsSet.has(product.productName)}
                            isAuthenticated={isAuthenticated}
                            onRequest={() => handleRequest(product.productName, product.shopName)}
                            onCancel={() => handleCancel(product.productName)}
                            isLoading={requestMutation.isPending || cancelMutation.isPending}
                            onBrandClick={() => product.shopName && setSelectedBrand(product.shopName)}
                          />
                        ))}
                        {filteredProducts.length === 0 && (
                          <div className="text-center py-12 text-gray-400">
                            <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>該当する商品が見つかりません</p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="lc-brands">
                    {brandsLoading ? (
                      <div className="space-y-3">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredBrands.map((brand, index) => (
                          <div
                            key={brand.shopName}
                            className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${getRankBg(index + 1)}`}
                            onClick={() => brand.shopName && setSelectedBrand(brand.shopName)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">{getRankIcon(index + 1)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-gray-900 truncate">{brand.shopName}</h3>
                                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                  <span>売上: {formatCurrency(brand.totalSales)}</span>
                                  <span>注文: {brand.orderCount.toLocaleString()}件</span>
                                  <span>商品数: {brand.productCount}</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg font-bold text-rose-600">{formatCurrency(brand.totalSales)}</div>
                                <div className="text-xs text-gray-400">{brand.totalQuantity.toLocaleString()}個販売</div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {filteredBrands.length === 0 && (
                          <div className="text-center py-12 text-gray-400">
                            <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>該当するブランドが見つかりません</p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* ============================================================ */}
              {/* みんなの購入ランキング Tab */}
              {/* ============================================================ */}
              <TabsContent value="purchases">
                <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5" />
                    ユーザーが投稿したレシートデータから集計した実際の購入ランキングです
                  </p>
                </div>

                {/* Sub-tabs for products vs shops */}
                <Tabs defaultValue="rc-products">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="rc-products" className="gap-1 text-xs">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      商品別
                    </TabsTrigger>
                    <TabsTrigger value="rc-shops" className="gap-1 text-xs">
                      <Store className="h-3.5 w-3.5" />
                      ショップ別
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="rc-products">
                    {receiptProductsLoading ? (
                      <div className="space-y-3">
                        {[...Array(10)].map((_, i) => (
                          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredReceiptProducts.map((product, index) => (
                          <ReceiptProductCard
                            key={`${product.productName}-${product.shopName}`}
                            rank={index + 1}
                            productName={product.productName}
                            shopName={product.shopName}
                            purchaseCount={product.purchaseCount}
                            totalAmount={product.totalAmount}
                            uniqueBuyers={product.uniqueBuyers}
                            onShopClick={() => product.shopName && setSelectedReceiptShop(product.shopName)}
                            requestCount={requestCountMap.get(product.productName) || 0}
                            isRequested={myRequestsSet.has(product.productName)}
                            isAuthenticated={isAuthenticated}
                            onRequest={() => handleRequest(product.productName, product.shopName)}
                            onCancel={() => handleCancel(product.productName)}
                            isLoading={requestMutation.isPending || cancelMutation.isPending}
                          />
                        ))}
                        {filteredReceiptProducts.length === 0 && (
                          <div className="text-center py-12 text-gray-400">
                            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>購入データがまだありません</p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="rc-shops">
                    {receiptShopsLoading ? (
                      <div className="space-y-3">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredReceiptShops.map((shop, index) => (
                          <div
                            key={shop.shopName}
                            className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${getReceiptRankBg(index + 1)}`}
                            onClick={() => shop.shopName && setSelectedReceiptShop(shop.shopName)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">{getRankIcon(index + 1)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-gray-900 truncate">{shop.shopName}</h3>
                                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                  <span>購入: {shop.purchaseCount}件</span>
                                  <span>商品数: {shop.productCount}</span>
                                  <span>購入者: {shop.uniqueBuyers}人</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg font-bold text-emerald-600">{formatCurrency(shop.totalAmount)}</div>
                                <div className="text-xs text-gray-400">累計購入額</div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {filteredReceiptShops.length === 0 && (
                          <div className="text-center py-12 text-gray-400">
                            <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>ショップデータがまだありません</p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-100 bg-gray-50">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="text-xs text-gray-400">
            ※ ランキングはTikTok Shop注文データおよびレシート投稿データに基づいています。
          </p>
          <div className="mt-4 flex justify-center gap-4 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-600">トップ</Link>
            <Link href="/mall/products" className="hover:text-gray-600">商品一覧</Link>
            <Link href="/legal/tokushoho" className="hover:text-gray-600">特商法</Link>
            <Link href="/legal/privacy" className="hover:text-gray-600">プライバシー</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// ライブコマース Product Card Component
// ============================================================
function LiveCommerceProductCard({
  rank,
  productName,
  shopName,
  totalSales,
  totalQuantity,
  orderCount,
  requestCount,
  isRequested,
  isAuthenticated,
  onRequest,
  onCancel,
  isLoading,
  onBrandClick,
}: {
  rank: number;
  productName: string;
  shopName?: string | null;
  totalSales: number;
  totalQuantity: number;
  orderCount: number;
  requestCount: number;
  isRequested: boolean;
  isAuthenticated: boolean;
  onRequest: () => void;
  onCancel: () => void;
  isLoading: boolean;
  onBrandClick?: () => void;
}) {
  return (
    <div className={`rounded-xl border p-4 transition-all ${getRankBg(rank)}`}>
      <div className="flex items-start gap-3">
        {/* Rank */}
        <div className="flex-shrink-0 pt-0.5">{getRankIcon(rank)}</div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2">
            {productName}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {shopName && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBrandClick?.();
                }}
                className="text-xs text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-0.5"
              >
                <Store className="h-3 w-3" />
                {shopName}
              </button>
            )}
            <span className="text-xs text-gray-400">
              {orderCount.toLocaleString()}件 / {totalQuantity.toLocaleString()}個
            </span>
          </div>
          <div className="mt-1.5 text-base font-bold text-gray-800">
            {formatCurrency(totalSales)}
            <span className="text-xs font-normal text-gray-400 ml-1">累計売上</span>
          </div>
        </div>

        {/* Request Button */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          {isRequested ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 gap-1"
              onClick={onCancel}
              disabled={isLoading}
            >
              <HeartOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">取消</span>
            </Button>
          ) : (
            <Button
              size="sm"
              className="text-xs bg-rose-500 hover:bg-rose-600 text-white gap-1"
              onClick={onRequest}
              disabled={isLoading}
            >
              <Heart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">入荷希望</span>
            </Button>
          )}
          {requestCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              <Star className="h-2.5 w-2.5 mr-0.5 text-amber-500" />
              {requestCount}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// みんなの購入 Product Card Component
// ============================================================
function ReceiptProductCard({
  rank,
  productName,
  shopName,
  purchaseCount,
  totalAmount,
  uniqueBuyers,
  onShopClick,
  requestCount,
  isRequested,
  isAuthenticated,
  onRequest,
  onCancel,
  isLoading,
}: {
  rank: number;
  productName: string;
  shopName?: string | null;
  purchaseCount: number;
  totalAmount: number;
  uniqueBuyers: number;
  onShopClick?: () => void;
  requestCount?: number;
  isRequested?: boolean;
  isAuthenticated?: boolean;
  onRequest?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 transition-all ${getReceiptRankBg(rank)}`}>
      <div className="flex items-start gap-3">
        {/* Rank */}
        <div className="flex-shrink-0 pt-0.5">{getRankIcon(rank)}</div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2">
            {productName}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {shopName && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShopClick?.();
                }}
                className="text-xs text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-0.5"
              >
                <Store className="h-3 w-3" />
                {shopName}
              </button>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" />
              {purchaseCount}件購入
            </span>
            {uniqueBuyers > 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {uniqueBuyers}人
              </span>
            )}
          </div>
          <div className="mt-1.5 text-base font-bold text-gray-800">
            {formatCurrency(totalAmount)}
            <span className="text-xs font-normal text-gray-400 ml-1">累計購入額</span>
          </div>
        </div>

        {/* Request Button (optional for receipt products too) */}
        {onRequest && onCancel && (
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            {isRequested ? (
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 gap-1"
                onClick={onCancel}
                disabled={isLoading}
              >
                <HeartOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">取消</span>
              </Button>
            ) : (
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                onClick={onRequest}
                disabled={isLoading}
              >
                <Heart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">入荷希望</span>
              </Button>
            )}
            {(requestCount ?? 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <Star className="h-2.5 w-2.5 mr-0.5 text-amber-500" />
                {requestCount}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
