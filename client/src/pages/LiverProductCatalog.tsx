import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Search, ArrowLeft, Tag, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 商品画像スワイプコンポーネント
 * タッチスワイプ＋ドットインジケーター＋矢印ボタン
 */
function ProductImageSwiper({ images, name }: { images: string[]; name: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold && currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (diff < -threshold && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, images.length]);

  const goTo = useCallback((idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(idx, images.length - 1)));
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="aspect-[4/5] bg-gray-900 flex items-center justify-center">
        <Package className="h-16 w-16 text-gray-700" />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="aspect-[4/5] bg-gray-900 overflow-hidden">
        <img
          src={images[0]}
          alt={name}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="aspect-[4/5] bg-gray-900 overflow-hidden relative group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 画像 */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((url, idx) => (
          <div key={idx} className="w-full h-full flex-shrink-0">
            <img
              src={url}
              alt={`${name} - ${idx + 1}`}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {/* 左矢印 */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goTo(currentIndex - 1); }}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* 右矢印 */}
      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goTo(currentIndex + 1); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* ドットインジケーター */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => { e.stopPropagation(); goTo(idx); }}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              idx === currentIndex
                ? "bg-white w-3"
                : "bg-white/40"
            }`}
          />
        ))}
      </div>

      {/* 枚数カウンター */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
        {currentIndex + 1}/{images.length}
      </div>
    </div>
  );
}

/**
 * ライバー向けLCJ全商品カタログページ
 * /liver/products
 * ログイン不要（公開ページ）
 * ライバーがLCJで取り扱っている全商品を閲覧できる
 */
export default function LiverProductCatalog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");

  // 全商品取得（activeのみ）
  const { data: allProducts = [], isLoading } = trpc.mall.getProducts.useQuery(
    { status: "active" }
  );

  // カテゴリ一覧取得
  const { data: categories = [] } = trpc.mall.getCategoryRecords.useQuery();

  // ブランド一覧取得
  const { data: brands = [] } = trpc.brand.list.useQuery();

  // フィルタリング
  const filteredProducts = useMemo(() => {
    let result = allProducts;

    // 検索フィルター
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p: any) =>
        p.name?.toLowerCase().includes(q) ||
        p.brandName?.toLowerCase().includes(q) ||
        p.categoryName?.toLowerCase().includes(q)
      );
    }

    // カテゴリフィルター
    if (selectedCategory !== "all") {
      result = result.filter((p: any) =>
        String(p.categoryId) === selectedCategory || p.category === selectedCategory
      );
    }

    // ブランドフィルター
    if (selectedBrand !== "all") {
      result = result.filter((p: any) => String(p.brandId) === selectedBrand);
    }

    return result;
  }, [allProducts, searchQuery, selectedCategory, selectedBrand]);

  // ユニークなブランド一覧（商品に紐づくもののみ）
  const productBrands = useMemo(() => {
    const brandMap = new Map<number, string>();
    allProducts.forEach((p: any) => {
      if (p.brandId) {
        const brand = brands.find((b: any) => b.id === p.brandId);
        if (brand) brandMap.set(p.brandId, brand.name);
      }
    });
    return Array.from(brandMap.entries()).map(([id, name]) => ({ id, name }));
  }, [allProducts, brands]);

  // アクティブなカテゴリのみ（テストカテゴリ除外済み）
  const activeCategories = useMemo(() => {
    return categories.filter((c: any) => c.isActive === "yes");
  }, [categories]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="bg-black/60 backdrop-blur-xl border-b border-purple-900/30 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/liver/mypage">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="w-10 h-10 bg-purple-900/30 rounded-full flex items-center justify-center">
              <Package className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">LCJ 商品カタログ</h1>
              <p className="text-xs text-gray-400">取扱商品一覧（{allProducts.length}件）</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-5xl mx-auto px-4 py-3 space-y-2.5">
        {/* 検索バー */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="商品名・ブランド名で検索"
            className="pl-10 bg-gray-900/80 border-gray-700 text-white placeholder:text-gray-500 h-10"
          />
        </div>

        {/* ブランドフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            variant={selectedBrand === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedBrand("all")}
            className="text-xs whitespace-nowrap flex-shrink-0"
          >
            全ブランド
          </Button>
          {productBrands.map((brand) => (
            <Button
              key={brand.id}
              variant={selectedBrand === String(brand.id) ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedBrand(String(brand.id))}
              className="text-xs whitespace-nowrap flex-shrink-0"
            >
              {brand.name}
            </Button>
          ))}
        </div>

        {/* カテゴリフィルター */}
        {activeCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="text-xs whitespace-nowrap flex-shrink-0"
            >
              <Tag className="h-3 w-3 mr-1" />
              全カテゴリ
            </Button>
            {activeCategories.map((cat: any) => (
              <Button
                key={cat.id}
                variant={selectedCategory === String(cat.id) ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(String(cat.id))}
                className="text-xs whitespace-nowrap flex-shrink-0"
              >
                {cat.iconEmoji && <span className="mr-1">{cat.iconEmoji}</span>}
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        {/* 件数表示 */}
        <p className="text-gray-400 text-sm">
          {filteredProducts.length === allProducts.length
            ? `${allProducts.length}件の商品`
            : `${filteredProducts.length}件 / ${allProducts.length}件`}
        </p>
      </div>

      {/* Product Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-8">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchQuery ? "検索結果がありません" : "商品がまだ登録されていません"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product: any) => {
              const brand = brands.find((b: any) => b.id === product.brandId);
              // 画像配列を構築（imageUrls > imageUrl > 空配列）
              const allImages: string[] = product.imageUrls?.length
                ? product.imageUrls
                : product.imageUrl
                  ? [product.imageUrl]
                  : [];

              return (
                <div
                  key={product.id}
                  className="bg-gray-900/80 backdrop-blur-xl rounded-xl border border-gray-800 hover:border-purple-500/40 transition-all duration-200 overflow-hidden"
                >
                  {/* Product Image Swiper */}
                  <ProductImageSwiper images={allImages} name={product.name} />

                  {/* Product Info */}
                  <div className="p-4 space-y-2.5">
                    {/* 商品名 - 大きく読みやすく */}
                    <h3 className="text-white font-semibold text-base leading-snug line-clamp-2">
                      {product.name}
                    </h3>

                    {/* ブランド・カテゴリバッジ */}
                    <div className="flex flex-wrap gap-1.5">
                      {brand && (
                        <Badge className="text-[11px] bg-purple-900/40 text-purple-300 border-purple-700/50 hover:bg-purple-900/60">
                          {brand.name}
                        </Badge>
                      )}
                      {product.categoryName && (
                        <Badge variant="outline" className="text-[11px] border-gray-600 text-gray-300">
                          {product.categoryName}
                        </Badge>
                      )}
                    </div>

                    {/* 価格・在庫・報酬 */}
                    <div className="flex items-end justify-between pt-1">
                      <div>
                        <span className="text-yellow-400 font-bold text-xl tracking-tight">
                          ¥{product.price?.toLocaleString()}
                        </span>
                        {product.pointPrice ? (
                          <span className="text-yellow-500/70 text-xs ml-2">
                            {product.pointPrice?.toLocaleString()}pt
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {product.commissionRate && (
                          <span className="text-orange-400 text-[11px] font-medium bg-orange-500/10 px-2 py-0.5 rounded-full">
                            報酬 {product.commissionRate}%
                          </span>
                        )}
                        <span className={`text-[11px] font-medium ${
                          product.stock > 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {product.stock > 0 ? `在庫 ${product.stock.toLocaleString()}` : "在庫切れ"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-gray-600 text-xs">
        <p>Powered by LCJ MALL</p>
      </div>
    </div>
  );
}
