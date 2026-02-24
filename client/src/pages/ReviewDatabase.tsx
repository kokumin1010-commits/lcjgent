import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Star,
  ShoppingBag,
  MessageSquare,
  TrendingUp,
  Shield,
  ChevronRight,
  ThumbsUp,
  User,
  UserPlus,
  ArrowLeft,
  Receipt,
  Sparkles,
  Crown,
  BarChart3,
  Clock,
  Filter,
} from "lucide-react";


// 星評価の表示コンポーネント
function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${sizeClass} ${
            i <= rating
              ? "fill-amber-400 text-amber-400"
              : i <= rating + 0.5
              ? "fill-amber-400/50 text-amber-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

// 評価分布バー
function RatingDistribution({ stats }: { stats: any }) {
  if (!stats) return null;
  const total = stats.totalReviews || 1;
  const bars = [
    { label: "5", count: stats.fiveStarCount || 0, color: "bg-amber-400" },
    { label: "4", count: stats.fourStarCount || 0, color: "bg-amber-300" },
    { label: "3", count: stats.threeStarCount || 0, color: "bg-yellow-300" },
    { label: "2", count: stats.twoStarCount || 0, color: "bg-orange-300" },
    { label: "1", count: stats.oneStarCount || 0, color: "bg-red-300" },
  ];

  return (
    <div className="space-y-1.5">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-2 text-sm">
          <span className="w-4 text-gray-500 font-medium">{bar.label}</span>
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${bar.color} rounded-full transition-all duration-500`}
              style={{ width: `${(bar.count / total) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-gray-400 text-xs">{bar.count}</span>
        </div>
      ))}
    </div>
  );
}

// レビューカード
function ReviewCard({ review, onHelpful }: { review: any; onHelpful: (id: number) => void }) {
  const tags = Array.isArray(review.tags) ? review.tags : [];
  const dateStr = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })
    : "";

  return (
    <Card className="border border-gray-100 hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{review.productName}</h4>
            {review.brandName && (
              <p className="text-xs text-gray-500 mt-0.5">{review.brandName}</p>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50 shrink-0 ml-2">
            <Receipt className="h-3 w-3 mr-0.5" />
            購入証明済
          </Badge>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <StarRating rating={review.rating} />
          <span className="text-xs text-gray-400">{dateStr}</span>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-3">{review.reviewText}</p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((tag: string, i: number) => (
              <span key={i} className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {review.purchaseAmount && (
          <p className="text-xs text-gray-400 mb-2">
            購入金額: ¥{review.purchaseAmount.toLocaleString()}
          </p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <button
            onClick={() => onHelpful(review.id)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            参考になった {review.helpfulCount > 0 && `(${review.helpfulCount})`}
          </button>
          {review.category && (
            <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
              {review.category}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// 商品ランキングカード
function ProductRankingCard({ product, rank }: { product: any; rank: number }) {
  const [, setLocation] = useLocation();
  const rankColors: Record<number, string> = {
    1: "bg-amber-400 text-white",
    2: "bg-gray-300 text-white",
    3: "bg-amber-600 text-white",
  };

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50/50 transition-colors cursor-pointer group"
      onClick={() => setLocation(`/reviews/product/${encodeURIComponent(product.productName)}`)}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
        rankColors[rank] || "bg-gray-100 text-gray-500"
      }`}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 group-hover:text-rose-600 transition-colors">
          {product.productName}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          {product.brandName && (
            <span className="text-xs text-gray-500">{product.brandName}</span>
          )}
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-gray-700">{product.avgRating}</span>
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-rose-500">{product.reviewCount}件</div>
        <div className="text-[10px] text-gray-400">レビュー</div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-rose-400 transition-colors shrink-0" />
    </div>
  );
}

export default function ReviewDatabase() {
  const [, setLocation] = useLocation();
  const { data: lineUser } = trpc.lineLogin.me.useQuery();
  const isLoggedIn = !!lineUser;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ranking" | "latest">("ranking");

  // API calls
  const { data: statsData } = trpc.receiptReview.stats.useQuery();
  const { data: rankingData } = trpc.receiptReview.productRanking.useQuery({ limit: 20 });
  const { data: latestData } = trpc.receiptReview.latest.useQuery({ limit: 20 });
  const { data: searchResults, isLoading: isSearching } = trpc.receiptReview.search.useQuery(
    { query: searchQuery, limit: 20 },
    { enabled: searchQuery.length > 0 }
  );

  const helpfulMutation = trpc.receiptReview.helpful.useMutation();

  const handleHelpful = (reviewId: number) => {
    helpfulMutation.mutate({ reviewId });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // searchQuery is already reactive
  };

  const displayReviews = searchQuery.length > 0 ? searchResults : latestData?.reviews;
  const totalCount = latestData?.totalCount || 0;
  const avgRating = statsData?.avgRating ? Number(statsData.avgRating).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <ShoppingBag className="h-6 w-6 md:h-7 md:w-7 text-rose-500" />
            <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              LCJ MALL
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Button
                size="sm"
                className="bg-rose-500 hover:bg-rose-600 text-white gap-1 text-xs md:text-sm"
                onClick={() => setLocation("/mypage")}
              >
                <User className="h-4 w-4" />
                マイページ
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-rose-500 hover:bg-rose-600 text-white gap-1 text-xs md:text-sm"
                onClick={() => setLocation("/line-login")}
              >
                <UserPlus className="h-4 w-4" />
                無料ではじめる
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white py-10 md:py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="h-6 w-6 text-white/90" />
            <span className="text-sm font-medium text-white/90 tracking-wide">購入証明付き口コミ</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black mb-3 leading-tight">
            リアル口コミDB
          </h1>
          <p className="text-white/80 text-sm md:text-base max-w-xl mx-auto mb-6">
            レシート（購入証明）がある人だけが書ける、100%リアルな口コミデータベース。
            <br className="hidden md:block" />
            ステマゼロ。TikTokでバズってるアレ、本当に良いのか？ここでわかる。
          </p>

          {/* 統計 */}
          <div className="flex items-center justify-center gap-6 md:gap-10 mb-8">
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-black">{totalCount.toLocaleString()}</div>
              <div className="text-xs text-white/70">口コミ総数</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="h-5 w-5 md:h-7 md:w-7 fill-amber-300 text-amber-300" />
                <span className="text-2xl md:text-4xl font-black">{avgRating}</span>
              </div>
              <div className="text-xs text-white/70">平均評価</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-black">100%</div>
              <div className="text-xs text-white/70">購入証明済</div>
            </div>
          </div>

          {/* 検索バー */}
          <form onSubmit={handleSearch} className="max-w-lg mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="商品名で検索（例：TIRTIR、rom&nd...）"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 h-12 rounded-full bg-white text-gray-900 border-0 shadow-lg text-sm md:text-base placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-white border-b border-gray-100 py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 md:gap-8 text-xs md:text-sm text-gray-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-emerald-500" />
              <span>レシート認証済みのみ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-blue-500" />
              <span>ステマ・やらせゼロ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>AI不正検知搭載</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        {/* 検索結果 */}
        {searchQuery.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              「{searchQuery}」の検索結果
              {searchResults && <span className="text-sm font-normal text-gray-500 ml-2">({searchResults.length}件)</span>}
            </h2>
            {isSearching ? (
              <div className="text-center py-8 text-gray-400">検索中...</div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((review: any) => (
                  <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">「{searchQuery}」に一致するレビューはまだありません</p>
                <p className="text-sm text-gray-400 mt-1">最初のレビュアーになりませんか？</p>
              </div>
            )}
          </div>
        )}

        {/* メインコンテンツ（検索していない時） */}
        {searchQuery.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {/* 左カラム: ランキング or 最新レビュー */}
            <div className="lg:col-span-2">
              {/* タブ切り替え */}
              <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("ranking")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === "ranking"
                      ? "bg-white text-rose-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Crown className="h-4 w-4" />
                  商品ランキング
                </button>
                <button
                  onClick={() => setActiveTab("latest")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === "latest"
                      ? "bg-white text-rose-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  最新レビュー
                </button>
              </div>

              {/* 商品ランキング */}
              {activeTab === "ranking" && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-2 md:p-4">
                    {rankingData && rankingData.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {rankingData.map((product: any, index: number) => (
                          <ProductRankingCard
                            key={product.productName}
                            product={product}
                            rank={index + 1}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">まだランキングデータがありません</p>
                        <p className="text-sm text-gray-400 mt-1">レシートを送ってレビューを書こう！</p>
                        <Button
                          className="mt-4 bg-rose-500 hover:bg-rose-600"
                          onClick={() => setLocation("/receipt-upload")}
                        >
                          レシートを送る
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 最新レビュー */}
              {activeTab === "latest" && (
                <div>
                  {displayReviews && displayReviews.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {displayReviews.map((review: any) => (
                        <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">まだレビューがありません</p>
                      <p className="text-sm text-gray-400 mt-1">最初のレビュアーになりませんか？</p>
                      <Button
                        className="mt-4 bg-rose-500 hover:bg-rose-600"
                        onClick={() => setLocation("/receipt-upload")}
                      >
                        レシートを送ってレビューする
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 右カラム: サイドバー */}
            <div className="space-y-6">
              {/* 評価分布 */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-rose-500" />
                    評価分布
                  </h3>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-3xl font-black text-gray-900">{avgRating}</div>
                      <StarRating rating={Number(avgRating)} size="sm" />
                      <div className="text-xs text-gray-400 mt-1">{totalCount}件の評価</div>
                    </div>
                    <div className="flex-1">
                      <RatingDistribution stats={statsData} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* LCJの特徴 */}
              <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-pink-50">
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-900 text-sm mb-3">
                    なぜLCJの口コミは信頼できるのか？
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">購入証明必須</p>
                        <p className="text-xs text-gray-500">レシートがないと書けません</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Shield className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">ステマ完全排除</p>
                        <p className="text-xs text-gray-500">企業からの依頼レビューゼロ</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">AI不正検知</p>
                        <p className="text-xs text-gray-500">不自然なレビューを自動検出</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CTA */}
              <Card className="border-0 shadow-sm bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                <CardContent className="p-4 text-center">
                  <h3 className="font-bold text-sm mb-2">あなたもレビュアーに</h3>
                  <p className="text-xs text-gray-300 mb-4">
                    レシートを送るだけでポイント還元＋口コミ投稿。
                    TikTokで買ったアレの感想を共有しよう！
                  </p>
                  <Button
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                    onClick={() => setLocation("/receipt-upload")}
                  >
                    <Receipt className="h-4 w-4 mr-1.5" />
                    レシートを送ってレビューする
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <ShoppingBag className="h-5 w-5 text-rose-400" />
            <span className="text-white font-bold">LCJ MALL</span>
          </div>
          <p className="text-xs text-gray-500">リアル口コミDB — 購入証明付き口コミだけの信頼できるレビューメディア</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <Link href="/" className="hover:text-white transition-colors">トップ</Link>
            <Link href="/mall/products" className="hover:text-white transition-colors">商品一覧</Link>
            <Link href="/ranking" className="hover:text-white transition-colors">売れ筋ランキング</Link>
            <Link href="/legal/privacy" className="hover:text-white transition-colors">プライバシーポリシー</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
