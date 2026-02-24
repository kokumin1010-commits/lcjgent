import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Star,
  Search,
  TrendingUp,
  BarChart3,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
} from "lucide-react";

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${sizeClass} ${i <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

function formatDate(dateStr: string | number | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReviewManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const pageSize = 20;

  // Fetch data
  const { data: stats, isLoading: statsLoading } = trpc.receiptReview.stats.useQuery();
  const { data: ranking, isLoading: rankingLoading } = trpc.receiptReview.productRanking.useQuery({ limit: 10 });
  const { data: reviewsData, isLoading: reviewsLoading } = trpc.receiptReview.adminSearch.useQuery({
    query: searchQuery || undefined,
    page,
    limit: pageSize,
    sortBy,
  });

  const reviews = reviewsData?.reviews || [];
  const totalCount = reviewsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Stats calculations
  const avgRating = stats?.avgRating ? Number(stats.avgRating).toFixed(1) : "0.0";
  const totalReviews = stats?.totalReviews || 0;
  const ratingDist = useMemo(() => {
    if (!stats) return [];
    return [
      { stars: 5, count: Number(stats.fiveStarCount || 0) },
      { stars: 4, count: Number(stats.fourStarCount || 0) },
      { stars: 3, count: Number(stats.threeStarCount || 0) },
      { stars: 2, count: Number(stats.twoStarCount || 0) },
      { stars: 1, count: Number(stats.oneStarCount || 0) },
    ];
  }, [stats]);
  const maxRatingCount = Math.max(...ratingDist.map(r => r.count), 1);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">総レビュー数</span>
              <MessageSquare className="h-4 w-4 text-pink-500" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{Number(totalReviews).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">平均評価</span>
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{avgRating}</span>
                <StarDisplay rating={Math.round(Number(avgRating))} size="sm" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">レビュー商品数</span>
              <Package className="h-4 w-4 text-blue-500" />
            </div>
            {rankingLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{ranking?.length || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">認証済み</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold">100%</div>
            <span className="text-xs text-muted-foreground">レシート認証済みのみ</span>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              評価分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-6" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {ratingDist.map((item) => (
                  <div key={item.stars} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium">{item.stars}</span>
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                        style={{ width: `${(item.count / maxRatingCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{item.count}件</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              レビュー数ランキング TOP10
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : ranking && ranking.length > 0 ? (
              <div className="space-y-2">
                {ranking.map((product: any, index: number) => (
                  <div key={product.productName} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      index === 0 ? "bg-yellow-100 text-yellow-700" :
                      index === 1 ? "bg-gray-100 text-gray-600" :
                      index === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{product.productName}</div>
                      <div className="flex items-center gap-2">
                        <StarDisplay rating={Math.round(Number(product.avgRating || 0))} size="sm" />
                        <span className="text-xs text-muted-foreground">
                          {Number(product.avgRating || 0).toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {product.reviewCount}件
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8 text-sm">
                まだレビューがありません
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              レビュー一覧
              {totalCount > 0 && (
                <Badge variant="secondary" className="ml-1">{totalCount}件</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="商品名で検索..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="pl-9 h-9"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as any); setPage(1); }}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              >
                <option value="newest">新しい順</option>
                <option value="oldest">古い順</option>
                <option value="highest">評価高い順</option>
                <option value="lowest">評価低い順</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reviewsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map((review: any) => (
                <div key={review.id} className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Product Info */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className="text-xs shrink-0">
                          <ShieldCheck className="h-3 w-3 mr-1 text-emerald-500" />
                          レシート認証済
                        </Badge>
                        <span className="text-sm font-medium truncate">{review.productName}</span>
                        {!review.isVisible && (
                          <Badge variant="destructive" className="text-xs">非表示</Badge>
                        )}
                        {review.reportCount > 0 && (
                          <Badge variant="outline" className="text-xs text-red-500 border-red-200">
                            通報 {review.reportCount}件
                          </Badge>
                        )}
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-2 mb-2">
                        <StarDisplay rating={review.rating} size="md" />
                        <span className="text-sm text-muted-foreground">{review.rating}.0</span>
                      </div>

                      {/* Review Text */}
                      <p className="text-sm text-foreground leading-relaxed">{review.reviewText}</p>

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(review.createdAt)}
                        </span>
                        {review.brandName && (
                          <Badge variant="secondary" className="text-xs">
                            {review.brandName}
                          </Badge>
                        )}
                        {review.shopName && (
                          <span className="text-xs">{review.shopName}</span>
                        )}
                        {review.helpfulCount > 0 && (
                          <span className="text-xs text-emerald-600">👍 {review.helpfulCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-muted-foreground">
                    {((page - 1) * pageSize) + 1}〜{Math.min(page * pageSize, totalCount)} / {totalCount}件
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-2">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? `「${searchQuery}」に一致するレビューはありません` : "まだレビューがありません"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                レシート申請時にレビューが投稿されると、ここに表示されます
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
