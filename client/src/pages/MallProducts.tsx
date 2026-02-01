import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Package, Star, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function MallProducts() {
  const [category, setCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "newest">("newest");

  const { data: products, isLoading } = trpc.mall.getPublicProducts.useQuery();

  // カテゴリ一覧を取得
  const categories = products
    ? Array.from(new Set(products.map((p) => p.category).filter(Boolean)))
    : [];

  // フィルタリングとソート
  const filteredProducts = products
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
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-pink-100 sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5 text-pink-500" />
              <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                LCJ MALL
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/mypage">
                <Button variant="outline" size="sm">
                  マイページ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* ページタイトル */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">商品一覧</h1>
          <p className="text-muted-foreground">
            ポイントでお得にお買い物
          </p>
        </div>

        {/* フィルター・検索 */}
        <div className="bg-white rounded-xl shadow-sm border border-pink-100 p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="商品名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="カテゴリ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのカテゴリ</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat!}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="並び替え" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">新着順</SelectItem>
                <SelectItem value="price_asc">価格が安い順</SelectItem>
                <SelectItem value="price_desc">価格が高い順</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 商品一覧 */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">読み込み中...</p>
          </div>
        ) : !filteredProducts || filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">商品がありません</h3>
            <p className="text-muted-foreground">
              {searchQuery || category !== "all"
                ? "検索条件を変更してお試しください"
                : "商品が登録されていません"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Link key={product.id} href={`/mall/products/${product.id}`}>
                <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 border-pink-100 hover:border-pink-300">
                  <div className="aspect-square relative overflow-hidden bg-gray-100">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-gray-300" />
                      </div>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="destructive" className="text-lg py-1 px-4">
                          売り切れ
                        </Badge>
                      </div>
                    )}
                    {product.pointPrice && product.stock > 0 && (
                      <div className="absolute top-2 right-2">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full blur-sm animate-pulse"></div>
                          <Badge className="relative bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-amber-900 font-bold border-2 border-amber-300 shadow-lg px-3 py-1">
                            <Star className="h-3 w-3 mr-1 fill-amber-700" />
                            ポイント交換可
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    {product.category && (
                      <Badge variant="outline" className="mb-2 text-xs">
                        {product.category}
                      </Badge>
                    )}
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-pink-600 transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-end justify-between">
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-pink-600">
                          ¥{product.price.toLocaleString()}
                        </p>
                        {product.pointPrice && (
                          <div className="mt-2 relative">
                            <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 shadow-lg shadow-amber-200/50 animate-pulse">
                              <Star className="h-4 w-4 text-amber-700 fill-amber-700" />
                              <span className="text-lg font-black text-amber-800">
                                {product.pointPrice.toLocaleString()}
                              </span>
                              <span className="text-sm font-bold text-amber-700">pt</span>
                            </div>
                            <span className="block text-xs text-amber-600 font-medium mt-1">
                              ✨ ポイントで交換可能！
                            </span>
                          </div>
                        )}
                      </div>
                      {product.stock > 0 && (
                        <Button size="sm" className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container text-center">
          <p className="text-gray-400">© 2024 LCJ MALL. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
