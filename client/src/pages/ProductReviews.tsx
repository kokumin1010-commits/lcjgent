import { useState, useMemo } from "react";
import { useLocation, useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  ShoppingBag,
  MessageSquare,
  Shield,
  ChevronLeft,
  ThumbsUp,
  User,
  UserPlus,
  Receipt,
  Sparkles,
  BarChart3,
  Filter,
  ArrowUpDown,
} from "lucide-react";


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
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review, onHelpful }: { review: any; onHelpful: (id: number) => void }) {
  const tags = Array.isArray(review.tags) ? review.tags : [];
  const dateStr = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })
    : "";

  return (
    <Card className="border border-gray-100 hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StarRating rating={review.rating} />
            <span className="text-xs text-gray-400">{dateStr}</span>
          </div>
          <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50">
            <Receipt className="h-3 w-3 mr-0.5" />
            購入証明済
          </Badge>
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
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProductReviews() {
  const [, setLocation] = useLocation();
  const params = useParams<{ name: string }>();
  const productName = decodeURIComponent(params.name || "");
  const { data: lineUser } = trpc.lineLogin.me.useQuery();
  const isLoggedIn = !!lineUser;

  const [sortBy, setSortBy] = useState<"newest" | "highest" | "lowest">("newest");

  const { data: reviews, isLoading } = trpc.receiptReview.search.useQuery(
    { query: productName, limit: 50 },
    { enabled: productName.length > 0 }
  );

  const helpfulMutation = trpc.receiptReview.helpful.useMutation();

  const handleHelpful = (reviewId: number) => {
    helpfulMutation.mutate({ reviewId });
  };

  // 統計を計算
  const stats = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    const total = reviews.length;
    const avgRating = (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / total).toFixed(1);
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r: any) => r.rating === star).length,
    }));
    return { total, avgRating, distribution };
  }, [reviews]);

  // ソート
  const sortedReviews = useMemo(() => {
    if (!reviews) return [];
    const sorted = [...reviews];
    switch (sortBy) {
      case "highest":
        return sorted.sort((a: any, b: any) => b.rating - a.rating);
      case "lowest":
        return sorted.sort((a: any, b: any) => a.rating - b.rating);
      default:
        return sorted;
    }
  }, [reviews, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <ShoppingBag className="h-6 w-6 text-rose-500" />
            <span className="text-lg font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              LCJ MALL
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Button
                size="sm"
                className="bg-rose-500 hover:bg-rose-600 text-white gap-1 text-xs"
                onClick={() => setLocation("/mypage")}
              >
                <User className="h-4 w-4" />
                マイページ
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-rose-500 hover:bg-rose-600 text-white gap-1 text-xs"
                onClick={() => setLocation("/line-login")}
              >
                <UserPlus className="h-4 w-4" />
                無料ではじめる
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* パンくず */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <button onClick={() => setLocation("/reviews")} className="hover:text-rose-500 transition-colors flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            口コミDB
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium line-clamp-1">{productName}</span>
        </div>

        {/* 商品ヘッダー */}
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-gray-900 mb-1">{productName}</h1>
              {reviews && reviews[0]?.brandName && (
                <p className="text-sm text-gray-500">{reviews[0].brandName}</p>
              )}
            </div>
            <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-600 bg-emerald-50 shrink-0">
              <Shield className="h-3.5 w-3.5 mr-1" />
              全件購入証明済
            </Badge>
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-4xl font-black text-gray-900">{stats.avgRating}</div>
                  <StarRating rating={Number(stats.avgRating)} size="md" />
                  <div className="text-xs text-gray-400 mt-1">{stats.total}件の評価</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {stats.distribution.map((d) => (
                  <div key={d.star} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-gray-500 font-medium">{d.star}</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${(d.count / stats.total) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-gray-400 text-xs">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ソート */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">
            レビュー一覧
            {stats && <span className="font-normal text-gray-500 ml-1">({stats.total}件)</span>}
          </h2>
          <div className="flex items-center gap-1">
            {(["newest", "highest", "lowest"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  sortBy === s
                    ? "bg-rose-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {s === "newest" ? "新着順" : s === "highest" ? "高評価順" : "低評価順"}
              </button>
            ))}
          </div>
        </div>

        {/* レビュー一覧 */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : sortedReviews.length > 0 ? (
          <div className="space-y-3">
            {sortedReviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">この商品のレビューはまだありません</p>
            <p className="text-sm text-gray-400 mt-1">最初のレビュアーになりませんか？</p>
            <Button
              className="mt-4 bg-rose-500 hover:bg-rose-600"
              onClick={() => setLocation("/receipt-upload")}
            >
              レシートを送ってレビューする
            </Button>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-center text-white">
          <h3 className="font-bold mb-2">この商品を使ったことがありますか？</h3>
          <p className="text-sm text-gray-300 mb-4">
            レシートを送るだけでポイント還元＋あなたのリアルな口コミを共有できます
          </p>
          <Button
            className="bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => setLocation("/receipt-upload")}
          >
            <Receipt className="h-4 w-4 mr-1.5" />
            レシートを送ってレビューする
          </Button>
        </div>
      </div>
    </div>
  );
}
