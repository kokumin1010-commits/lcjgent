import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Search, ShoppingBag, ArrowRight, Star, X, Lock } from "lucide-react";

/**
 * 公開カタログページ - ライブコマーサー勧誘用
 * ログイン不要でLCJの取り扱いブランド・商品一覧を閲覧可能
 * ライバー登録済みの場合は卸値・報酬率も表示
 * URL: /catalog
 */

// ブランド名の頭文字を取得してアバターに使う
function getBrandInitial(name: string): string {
  if (!name) return "?";
  // 日本語・中国語の場合は最初の1文字
  const firstChar = name.charAt(0);
  if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(firstChar)) {
    return firstChar;
  }
  // 英語の場合は最初の2文字（大文字）
  return name.slice(0, 2).toUpperCase();
}

// ブランド名からユニークな色を生成
function getBrandColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-violet-500/30 to-purple-600/30",
    "from-blue-500/30 to-indigo-600/30",
    "from-emerald-500/30 to-teal-600/30",
    "from-rose-500/30 to-pink-600/30",
    "from-amber-500/30 to-orange-600/30",
    "from-cyan-500/30 to-sky-600/30",
    "from-fuchsia-500/30 to-purple-600/30",
    "from-lime-500/30 to-green-600/30",
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function Catalog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"brands" | "products">("brands");

  // 統計情報
  const { data: stats } = trpc.selectionCenter.getCatalogStats.useQuery();

  // ブランド一覧
  const { data: brands = [], isLoading: brandsLoading } = trpc.selectionCenter.getCatalogBrands.useQuery();

  // 商品一覧 - brandIds配列で合併ブランドの全商品を取得
  const { data: productsData, isLoading: productsLoading } = trpc.selectionCenter.getCatalogProducts.useQuery({
    brandIds: selectedBrand?.brandIds || undefined,
    search: searchQuery.trim() || undefined,
    limit: 100,
    offset: 0,
  });

  const products = productsData?.products || [];
  const totalProducts = productsData?.total || 0;
  const isAuthenticated = productsData?.isAuthenticated || false;

  // ブランド検索フィルター
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter((b: any) => b.brandName?.toLowerCase().includes(q));
  }, [brands, searchQuery]);

  // ブランド選択時
  const handleBrandSelect = (brand: any) => {
    setSelectedBrand(brand);
    setViewMode("products");
    setSearchQuery("");
  };

  // 戻る
  const handleBackToBrands = () => {
    setSelectedBrand(null);
    setViewMode("brands");
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/10 to-pink-600/20" />
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-sm text-indigo-300">
              <Star className="h-3.5 w-3.5" />
              <span>日本最大級のライブコマース事務所</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
              LCJ 取り扱い<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">ブランド</span>カタログ
            </h1>
            <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
              多数のブランドパートナーと提携し、幅広いジャンルの商品をライブコマースでお届けしています
            </p>

            {/* Stats */}
            {stats && (
              <div className="flex justify-center gap-6 md:gap-12 pt-4">
                <div className="text-center">
                  <div className="text-2xl md:text-4xl font-bold text-white">{stats.totalBrands}</div>
                  <div className="text-xs md:text-sm text-gray-400">取り扱いブランド</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-4xl font-bold text-white">{stats.totalProducts}</div>
                  <div className="text-xs md:text-sm text-gray-400">登録商品数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-4xl font-bold text-white">{stats.totalCategories}</div>
                  <div className="text-xs md:text-sm text-gray-400">カテゴリ</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {viewMode === "products" && selectedBrand && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToBrands}
                className="text-gray-400 hover:text-white shrink-0"
              >
                <X className="h-4 w-4 mr-1" />
                戻る
              </Button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={viewMode === "brands" ? "ブランド名で検索..." : "商品名で検索..."}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-10 focus:border-indigo-500/50"
              />
            </div>
            {viewMode === "brands" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setViewMode("products"); setSelectedBrand(null); }}
                className="text-gray-300 border-white/10 hover:border-indigo-500/50 hover:text-white shrink-0"
              >
                <ShoppingBag className="h-4 w-4 mr-1" />
                全商品
              </Button>
            )}
            {viewMode === "products" && !selectedBrand && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToBrands}
                className="text-gray-300 border-white/10 hover:border-indigo-500/50 hover:text-white shrink-0"
              >
                ブランド一覧
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-32">
        {viewMode === "brands" ? (
          <>
            {/* Brand Grid */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                取り扱いブランド一覧
                <span className="text-gray-400 text-sm font-normal ml-2">
                  {filteredBrands.length}社
                </span>
              </h2>
            </div>

            {brandsLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
              </div>
            ) : filteredBrands.length === 0 ? (
              <div className="text-center py-20">
                <Package className="h-16 w-16 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">該当するブランドがありません</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredBrands.map((brand: any) => (
                  <button
                    key={brand.brandId}
                    onClick={() => handleBrandSelect(brand)}
                    className="group bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-indigo-500/30 rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.02]"
                  >
                    {/* Brand Logo / Avatar */}
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getBrandColor(brand.brandName)} flex items-center justify-center mb-3 overflow-hidden`}>
                      {brand.logoUrl ? (
                        <img src={brand.logoUrl} alt={brand.brandName} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <span className="text-white font-bold text-sm">
                          {getBrandInitial(brand.brandName)}
                        </span>
                      )}
                    </div>
                    {/* Brand Name */}
                    <h3 className="text-white text-sm font-medium line-clamp-2 group-hover:text-indigo-300 transition-colors">
                      {brand.brandName}
                    </h3>
                    {/* Product Count */}
                    <div className="flex items-center gap-1 mt-1.5">
                      <Package className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-400">{brand.productCount}商品</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Products View */}
            <div className="mb-4">
              {selectedBrand && (
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getBrandColor(selectedBrand.brandName)} flex items-center justify-center overflow-hidden`}>
                    {selectedBrand.logoUrl ? (
                      <img src={selectedBrand.logoUrl} alt={selectedBrand.brandName} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-white font-bold text-xs">
                        {getBrandInitial(selectedBrand.brandName)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedBrand.brandName}</h2>
                    <p className="text-xs text-gray-400">{selectedBrand.productCount}商品</p>
                  </div>
                </div>
              )}
              {!selectedBrand && (
                <h2 className="text-lg font-semibold text-white">
                  全商品一覧
                  <span className="text-gray-400 text-sm font-normal ml-2">
                    {totalProducts}件
                  </span>
                </h2>
              )}
            </div>

            {productsLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20">
                <Package className="h-16 w-16 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">
                  {searchQuery ? "検索結果がありません" : "商品がまだ登録されていません"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map((product: any) => {
                  const images = product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [];
                  const firstImage = images[0] || null;

                  return (
                    <div
                      key={product.id}
                      className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:border-indigo-500/20 transition-all duration-200"
                    >
                      {/* Product Image */}
                      <div className="aspect-square bg-gray-900/50 overflow-hidden">
                        {firstImage ? (
                          <img
                            src={firstImage}
                            alt={product.productName}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-10 w-10 text-gray-700" />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-3 space-y-1.5">
                        <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight">
                          {product.productName}
                        </h3>
                        <div className="flex items-center gap-1">
                          <Badge className="text-[10px] bg-indigo-500/10 text-indigo-300 border-indigo-500/20 px-1.5 py-0">
                            {product.brandName}
                          </Badge>
                        </div>
                        <div className="pt-1 space-y-1">
                          {/* 販売価格 */}
                          <div className="flex items-end justify-between">
                            <span className="text-yellow-400 font-bold text-base">
                              ¥{Number(product.price || 0).toLocaleString()}
                            </span>
                          </div>
                          
                          {/* 卸値・報酬率 - 認証済みなら表示、未認証ならロック表示 */}
                          {isAuthenticated ? (
                            <div className="flex flex-wrap gap-1">
                              {product.purchasePrice && Number(product.purchasePrice) > 0 && (
                                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  卸値 ¥{Number(product.purchasePrice).toLocaleString()}
                                </span>
                              )}
                              {product.commissionValue && Number(product.commissionValue) > 0 && (
                                <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                                  報酬 {product.commissionType === 'percentage' ? `${product.commissionValue}%` : `¥${Number(product.commissionValue).toLocaleString()}`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <a
                              href="/liver/register"
                              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-indigo-400 transition-colors no-underline"
                            >
                              <Lock className="h-2.5 w-2.5" />
                              <span>登録して卸値・報酬を確認</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* CTA Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-8 pb-4 px-4 z-40">
        <div className="max-w-md mx-auto">
          <a
            href="/liver/register"
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.02] no-underline"
          >
            <span>LCJでライブコマースを始める</span>
            <ArrowRight className="h-4 w-4" />
          </a>
          <p className="text-center text-gray-500 text-xs mt-2">
            登録無料・審査あり
          </p>
        </div>
      </div>
    </div>
  );
}
