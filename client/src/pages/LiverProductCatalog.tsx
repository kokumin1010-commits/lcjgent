import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Search, ArrowLeft, Tag, Filter } from "lucide-react";

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
        <div className="max-w-5xl mx-auto px-4 py-4">
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
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
        {/* 検索バー */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="商品名・ブランド名で検索"
            className="pl-10 bg-gray-900/80 border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>

        {/* フィルターボタン */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            variant={selectedBrand === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedBrand("all")}
            className="text-xs whitespace-nowrap"
          >
            全ブランド
          </Button>
          {productBrands.map((brand) => (
            <Button
              key={brand.id}
              variant={selectedBrand === String(brand.id) ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedBrand(String(brand.id))}
              className="text-xs whitespace-nowrap"
            >
              {brand.name}
            </Button>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="text-xs whitespace-nowrap"
            >
              <Tag className="h-3 w-3 mr-1" />
              全カテゴリ
            </Button>
            {categories.filter((c: any) => c.isActive === "yes").map((cat: any) => (
              <Button
                key={cat.id}
                variant={selectedCategory === String(cat.id) ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(String(cat.id))}
                className="text-xs whitespace-nowrap"
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
              return (
                <div
                  key={product.id}
                  className="bg-black/60 backdrop-blur-xl rounded-xl border border-gray-800 hover:border-purple-500/40 transition-all duration-200 overflow-hidden"
                >
                  {/* Product Image */}
                  {product.imageUrl ? (
                    <div className="aspect-square bg-gray-900 overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-gray-900 flex items-center justify-center">
                      <Package className="h-16 w-16 text-gray-700" />
                    </div>
                  )}

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="text-white font-medium text-sm leading-tight mb-2 line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {brand && (
                        <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">
                          {brand.name}
                        </Badge>
                      )}
                      {product.categoryName && (
                        <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">
                          {product.categoryName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-purple-400 font-mono text-base font-bold">
                        ¥{product.price?.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {product.commissionRate && (
                          <span className="text-orange-400 text-[10px] bg-orange-500/10 px-1.5 py-0.5 rounded">
                            報酬 {product.commissionRate}%
                          </span>
                        )}
                        <span className={`text-[10px] ${product.stock > 0 ? "text-green-400" : "text-red-400"}`}>
                          {product.stock > 0 ? `在庫${product.stock}` : "在庫切れ"}
                        </span>
                      </div>
                    </div>
                    {product.pointPrice && (
                      <span className="text-yellow-400 text-xs mt-1 block">
                        ポイント: {product.pointPrice?.toLocaleString()}pt
                      </span>
                    )}
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
