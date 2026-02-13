import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  X,
} from "lucide-react";
import { Link } from "wouter";

type SortOption = "newest" | "price_asc" | "price_desc" | "popular";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "新着" },
  { value: "popular", label: "人気" },
  { value: "price_asc", label: "安い順" },
  { value: "price_desc", label: "高い順" },
];

export default function MallProducts() {
  const [category, setCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const { data: products, isLoading } = trpc.mall.getProducts.useQuery({ status: "active" });

  // カテゴリ一覧を取得
  const categories = useMemo(
    () =>
      products
        ? Array.from(new Set(products.map((p) => p.category).filter(Boolean)))
        : [],
    [products]
  );

  // フィルタリングとソート
  const filteredProducts = useMemo(
    () =>
      products
        ?.filter((p) => {
          if (category !== "all" && p.category !== category) return false;
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
              return (b.pointPrice ?? 0) - (a.pointPrice ?? 0);
            case "newest":
            default:
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
          }
        }),
    [products, category, searchQuery, sortBy]
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

                    {/* カートボタン - 右下 */}
                    {product.stock > 0 && (
                      <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-pink-500 text-white p-1.5 rounded-full shadow-lg hover:bg-pink-600 transition-colors">
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 商品情報 */}
                  <div className="p-2.5">
                    {/* 商品名 - 2行まで */}
                    <h3 className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight mb-1.5 group-hover:text-pink-600 transition-colors">
                      {product.name}
                    </h3>

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

                      {/* カテゴリ小バッジ */}
                      {product.category && (
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {product.category}
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
