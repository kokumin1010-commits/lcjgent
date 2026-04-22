import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePageSEO } from "@/hooks/usePageSEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Search,
  Package,
  Star,
  ArrowLeft,
  Flame,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  X,
  Heart,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type SortOption = "newest" | "price_asc" | "price_desc" | "popular";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "新着" },
  { value: "popular", label: "人気" },
  { value: "price_asc", label: "安い順" },
  { value: "price_desc", label: "高い順" },
];

function RecommendedInline() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: recommended, isLoading } = trpc.mall.getRecommendedProducts.useQuery(
    { limit: 6 },
    { enabled: true }
  );

  if (isLoading) {
    return (
      <div className="px-4 py-4 bg-gradient-to-r from-purple-50/50 to-pink-50/50 border-b border-gray-50">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 bg-purple-200 rounded animate-pulse" />
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-32">
              <div className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
              <div className="mt-1.5 h-3 bg-gray-100 rounded animate-pulse" />
              <div className="mt-1 h-4 bg-gray-100 rounded animate-pulse w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!recommended || recommended.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-purple-50/50 to-pink-50/50 border-b border-gray-50">
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Star className="h-4 w-4 text-purple-500" />
                <h3 className="text-sm font-bold text-gray-800">あなたへのおすすめ</h3>
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 text-pink-500" />
                <h3 className="text-sm font-bold text-gray-800">人気の商品</h3>
              </>
            )}
          </div>
          <button
            onClick={() => setLocation("/ranking")}
            className="flex items-center gap-0.5 text-xs text-purple-500 font-medium hover:text-purple-700 transition-colors"
          >
            もっと見る
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide pb-4">
        <div className="flex gap-3 px-4 min-w-max">
          {recommended.map((product: any) => (
            <div
              key={product.id}
              className="flex-shrink-0 w-32 cursor-pointer group"
              onClick={() => setLocation(`/mall/products/${product.id}`)}
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100 group-hover:border-purple-200 group-hover:shadow-md transition-all duration-300">
                {product.imageUrl || (product.imageUrls && product.imageUrls[0]) ? (
                  <img
                    src={product.imageUrl || product.imageUrls[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="mt-1.5 px-0.5">
                <h4 className="text-[11px] font-medium text-gray-700 line-clamp-2 leading-tight group-hover:text-purple-600 transition-colors">
                  {product.name}
                </h4>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-sm font-bold text-pink-600">
                    ¥{product.price?.toLocaleString()}
                  </span>
                  {product.pointPrice && (
                    <span className="text-[10px] text-amber-500 font-medium">
                      {product.pointPrice.toLocaleString()}pt
                    </span>
                  )}
                </div>
                {product.brandName && (
                  <span className="text-[10px] text-purple-400 mt-0.5 block">{product.brandName}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MallProducts() {
  usePageSEO({
    title: "商品一覧 - LCJ MALL",
    description: "LCJ MALLの商品一覧。美容・ヘアケア・スキンケアなどの商品をお得に購入。",
    canonical: `${window.location.origin}/mall/products`,
    ogType: "website",
    keywords: "LCJ MALL, 商品, 美容, ヘアケア, シャンプー, KYOGOKU",
  });
  const [category, setCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const { data: products, isLoading } = trpc.mall.getProducts.useQuery({ status: "active" });
  const { data: favoriteIds = [] } = trpc.mall.getFavoriteIds.useQuery();
  const { data: favoriteCounts = {} } = trpc.mall.getFavoriteCounts.useQuery();
  const { data: reviewStats = {} } = trpc.mall.getAllReviewStats.useQuery();
  const utils = trpc.useUtils();

  const { data: cartCount } = trpc.mall.getCartCount.useQuery();

  const addToCartMutation = trpc.mall.addToCart.useMutation({
    onSuccess: () => {
      toast.success("カートに追加しました", { duration: 1500 });
      utils.mall.getCartCount.invalidate();
    },
    onError: () => {
      toast.error("ログインが必要です");
    },
  });

  const handleAddToCart = (e: React.MouseEvent, productId: number) => {
    e.preventDefault();
    e.stopPropagation();
    addToCartMutation.mutate({ productId, quantity: 1 });
  };

  const addFavoriteMutation = trpc.mall.addFavorite.useMutation({
    onMutate: async ({ productId }) => {
      await utils.mall.getFavoriteIds.cancel();
      const prev = utils.mall.getFavoriteIds.getData() ?? [];
      utils.mall.getFavoriteIds.setData(undefined, [...prev, productId]);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.mall.getFavoriteIds.setData(undefined, context.prev);
      toast.error("ログインが必要です");
    },
    onSettled: () => {
      utils.mall.getFavoriteIds.invalidate();
      utils.mall.getFavoriteCounts.invalidate();
    },
  });

  const removeFavoriteMutation = trpc.mall.removeFavorite.useMutation({
    onMutate: async ({ productId }) => {
      await utils.mall.getFavoriteIds.cancel();
      const prev = utils.mall.getFavoriteIds.getData() ?? [];
      utils.mall.getFavoriteIds.setData(undefined, prev.filter((id) => id !== productId));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.mall.getFavoriteIds.setData(undefined, context.prev);
      toast.error("エラーが発生しました");
    },
    onSettled: () => {
      utils.mall.getFavoriteIds.invalidate();
      utils.mall.getFavoriteCounts.invalidate();
    },
  });

  const toggleFavorite = (e: React.MouseEvent, productId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (favoriteIds.includes(productId)) {
      removeFavoriteMutation.mutate({ productId });
    } else {
      addFavoriteMutation.mutate({ productId });
      toast.success("お気に入りに追加しました", { duration: 1500 });
    }
  };

  // カテゴリ一覧を取得（categoryNameベース）
  const categories = useMemo(
    () =>
      products
        ? Array.from(new Set(products.map((p) => (p as any).categoryName).filter(Boolean)))
        : [],
    [products]
  );

  // フィルタリングとソート
  const filteredProducts = useMemo(
    () =>
      products
        ?.filter((p) => {
          if (category !== "all" && (p as any).categoryName !== category) return false;
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              p.name.toLowerCase().includes(query) ||
              (p.description?.toLowerCase().includes(query) ?? false)
            );
          }
          return true;
        })
        .sort((a, b) => {
          switch (sortBy) {
            case "price_asc":
              return a.price - b.price;
            case "price_desc":
              return b.price - a.price;
            case "popular":
              return (favoriteCounts[b.id] ?? 0) - (favoriteCounts[a.id] ?? 0);
            case "newest":
            default:
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
          }
        }),
    [products, category, searchQuery, sortBy, favoriteCounts]
  );

  const resultCount = filteredProducts?.length ?? 0;

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー - コンパクト */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </Link>

            {/* 検索バー - SHEIN風 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="商品を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 rounded-full bg-gray-100 border-0 text-sm focus-visible:ring-pink-300"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>

            <Link href="/mall/cart" className="relative">
              <ShoppingCart className="h-5 w-5 text-gray-700" />
              {(cartCount?.count ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-pink-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                  {cartCount!.count > 99 ? "99+" : cartCount!.count}
                </span>
              )}
            </Link>

            <Link href="/mypage" className="text-sm font-medium text-pink-500 whitespace-nowrap">
              マイページ
            </Link>
          </div>
        </div>
      </header>

      {/* カテゴリチップ - 横スクロール */}
      <div className="bg-white border-b border-gray-50 sticky top-[53px] z-40">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 py-2.5 min-w-max">
            <button
              onClick={() => setCategory("all")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                category === "all"
                  ? "bg-black text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" />
                すべて
              </span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat!)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  category === cat
                    ? "bg-black text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ソートバー */}
      <div className="bg-white px-4 py-2 flex items-center justify-between border-b border-gray-50">
        <span className="text-xs text-gray-400">{resultCount}件の商品</span>
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1 text-xs text-gray-600 font-medium"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            <ChevronDown className={`h-3 w-3 transition-transform ${showSortMenu ? "rotate-180" : ""}`} />
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 min-w-[120px]">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSortBy(opt.value);
                      setShowSortMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      sortBy === opt.value
                        ? "text-pink-500 font-semibold bg-pink-50"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* おすすめ商品セクション */}
      <RecommendedInline />

      {/* 商品グリッド */}
      <main className="px-2 pt-2 pb-20">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-100 rounded-lg" />
                <div className="p-2 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !filteredProducts || filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">商品がありません</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery || category !== "all"
                ? "検索条件を変更してお試しください"
                : "商品が登録されていません"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filteredProducts.map((product, index) => (
              <Link key={product.id} href={`/mall/products/${product.id}`}>
                <div
                  className="group cursor-pointer bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-300 active:scale-[0.97]"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animation: "fadeInUp 0.4s ease-out forwards",
                    opacity: 0,
                  }}
                >
                  {/* 商品画像 */}
                  <div className="aspect-square relative overflow-hidden bg-gray-50">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                        <Package className="h-10 w-10 text-gray-300" />
                      </div>
                    )}

                    {/* 売り切れオーバーレイ */}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-white font-bold text-sm bg-black/60 px-3 py-1 rounded-full">
                          SOLD OUT
                        </span>
                      </div>
                    )}

                    {/* ポイント交換可バッジ - 右上 */}
                    {product.pointPrice && product.stock > 0 && (
                      <div className="absolute top-1.5 right-1.5">
                        <div className="bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5 fill-amber-700" />
                          PT交換
                        </div>
                      </div>
                    )}

                    {/* お気に入りハートアイコン - 左上 */}
                    <button
                      onClick={(e) => toggleFavorite(e, product.id)}
                      className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-all duration-200 active:scale-90 z-10"
                    >
                      <Heart
                        className={`h-4 w-4 transition-all duration-300 ${
                          favoriteIds.includes(product.id)
                            ? "fill-pink-500 text-pink-500 scale-110"
                            : "text-gray-400 hover:text-pink-400"
                        }`}
                      />
                      {(favoriteCounts[product.id] ?? 0) > 0 && (
                        <span className="text-[10px] font-semibold text-gray-600 leading-none">
                          {favoriteCounts[product.id]}
                        </span>
                      )}
                    </button>

                    {/* カートボタン - 右下 */}
                    {product.stock > 0 && (
                      <button
                        onClick={(e) => handleAddToCart(e, product.id)}
                        className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-all duration-200 active:scale-90 z-10"
                      >
                        <div className="bg-pink-500 text-white p-1.5 rounded-full shadow-lg hover:bg-pink-600 transition-colors">
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    )}
                  </div>

                  {/* 商品情報 */}
                  <div className="p-2.5">
                    {/* 商品名 - 2行まで */}
                    <h3 className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight mb-1 group-hover:text-pink-600 transition-colors">
                      {product.name}
                    </h3>

                    {/* レビュー評価 */}
                    {reviewStats[product.id] && reviewStats[product.id].totalReviews > 0 && (
                      <div className="flex items-center gap-0.5 mb-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-[11px] font-semibold text-gray-700">
                          {reviewStats[product.id].avgRating.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          ({reviewStats[product.id].totalReviews})
                        </span>
                      </div>
                    )}

                    {/* 価格エリア */}
                    <div className="flex items-end justify-between gap-1">
                      <div>
                        <p className="text-base font-bold text-pink-600 leading-none">
                          ¥{product.price.toLocaleString()}
                        </p>
                        {product.pointPrice && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            <span className="text-xs font-bold text-amber-600">
                              {product.pointPrice.toLocaleString()} pt
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ブランド・カテゴリ */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {(product as any).brandName && (
                        <span className="text-[10px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {(product as any).brandName}
                        </span>
                      )}
                      {(product as any).categoryName && (
                        <span className="text-[10px] text-teal-500 bg-teal-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {(product as any).categoryName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* フェードインアニメーション用CSS */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
