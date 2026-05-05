import { useState, useMemo } from "react";
import { useLocation, useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Star,
  ShoppingBag,
  MessageSquare,
  Shield,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  User,
  UserPlus,
  Receipt,
  Sparkles,
  BarChart3,
  Play,
  ExternalLink,
  HelpCircle,
  Send,
  Heart,
  ShoppingCart,
  Camera,
  X,
  CheckCircle2,
  Flame,
  Clock,
  Video,
} from "lucide-react";

// ===== 星評価 =====
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

// ===== 購入確認済みバッジ =====
function VerifiedPurchaseBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'} rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold`}>
      <CheckCircle2 className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      購入確認済み
    </span>
  );
}

// ===== プラットフォームバッジ =====
const PLATFORM_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  "TikTok Shop": { label: "TikTok Shop", color: "bg-gray-900 text-white", icon: "♪" },
  "Qoo10": { label: "Qoo10", color: "bg-red-500 text-white", icon: "Q" },
  "Amazon": { label: "Amazon", color: "bg-orange-500 text-white", icon: "A" },
  "楽天市場": { label: "楽天市場", color: "bg-red-600 text-white", icon: "R" },
  other: { label: "その他", color: "bg-gray-400 text-white", icon: "?" },
};

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.other;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.color}`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

// ===== 名前ぼかし =====
function BlurredName({ name }: { name: string | null }) {
  if (!name) return <span className="text-gray-400">匿名</span>;
  const first = name.charAt(0);
  const rest = name.length > 2 ? "●".repeat(name.length - 2) + name.charAt(name.length - 1) : "●";
  return (
    <span className="select-none" style={{ filter: "blur(1.5px)" }}>
      {first}{rest}
    </span>
  );
}

// ===== ライトボックス =====
function PhotoLightbox({ images, initialIndex, onClose }: { images: string[]; initialIndex: number; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white z-10" onClick={onClose}>
        <X className="h-8 w-8" />
      </button>
      <div className="relative max-w-4xl max-h-[90vh] w-full px-4" onClick={(e) => e.stopPropagation()}>
        <img src={images[currentIndex]} alt="" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0} className="text-white/60 hover:text-white disabled:opacity-30">
              <ChevronLeft className="h-8 w-8" />
            </button>
            <span className="text-white/60 text-sm">{currentIndex + 1} / {images.length}</span>
            <button onClick={() => setCurrentIndex(i => Math.min(images.length - 1, i + 1))} disabled={currentIndex === images.length - 1} className="text-white/60 hover:text-white disabled:opacity-30">
              <ChevronRight className="h-8 w-8" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== レビューカード =====
function ReviewCard({ review, onHelpful }: { review: any; onHelpful: (id: number) => void }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const tags = Array.isArray(review.tags) ? review.tags : [];
  const dateStr = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })
    : "";
  const isNew = review.createdAt && (Date.now() - new Date(review.createdAt).getTime()) < 24 * 60 * 60 * 1000;

  const addReaction = trpc.receiptReview.addReaction.useMutation();
  const { data: questions } = trpc.receiptReview.questions.useQuery(
    { reviewId: review.id },
    { enabled: showQA }
  );
  const askQuestion = trpc.receiptReview.askQuestion.useMutation();
  const utils = trpc.useUtils();

  const handleReaction = (type: "bought" | "want") => {
    addReaction.mutate({ reviewId: review.id, reactionType: type }, {
      onSuccess: () => {
        utils.receiptReview.latest.invalidate();
        utils.receiptReview.search.invalidate();
      },
    });
  };

  const handleAskQuestion = () => {
    if (!questionText.trim()) return;
    askQuestion.mutate({
      reviewId: review.id,
      productName: review.productName,
      questionText: questionText.trim(),
    }, {
      onSuccess: () => {
        setQuestionText("");
        utils.receiptReview.questions.invalidate({ reviewId: review.id });
      },
    });
  };

  return (
    <Card className="border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden hover:border-rose-100">
      <CardContent className="p-0">
        {/* ヘッダー */}
        <div className="p-4 pb-3">
          <div className="flex items-start gap-3">
            {/* 商品画像 - セキュリティ: レシート画像には個人情報が含まれるため非表示 */}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StarRating rating={review.rating} size="md" />
                <span className="text-sm font-bold text-amber-500">{review.rating}.0</span>
                {isNew && (
                  <Badge className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[9px] px-1.5 shadow-sm">NEW</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <VerifiedPurchaseBadge compact />
                <PlatformBadge platform={review.purchasePlatform} />
                <span className="text-xs text-gray-400">{dateStr}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 動画リンク */}
        {(review.videoUrl || review.tiktokUrl || review.liveCommerceUrl) && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {(review.videoUrl || review.tiktokUrl) && (
              <a href={review.videoUrl || review.tiktokUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors shadow-sm">
                <Play className="h-3.5 w-3.5" />
                TikTok動画を見る
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {review.liveCommerceUrl && (
              <a href={review.liveCommerceUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-red-400 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                ライブコマース録画
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* レビュー本文 */}
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-700 leading-relaxed">{review.reviewText}</p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag: string, i: number) => (
                <span key={i} className="text-xs bg-gradient-to-r from-rose-50 to-pink-50 text-rose-600 px-2.5 py-0.5 rounded-full border border-rose-100">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* レビュアー情報 */}
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-gray-400">
          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center" style={{ filter: "blur(1.5px)" }}>
            <User className="h-2.5 w-2.5 text-gray-500" />
          </div>
          <BlurredName name={review.reviewerName || null} />
        </div>

        {/* リアクションバー */}
        <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30 flex items-center gap-2 flex-wrap">
          <button onClick={() => onHelpful(review.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 hover:text-rose-500 hover:bg-rose-50 transition-all">
            <ThumbsUp className="h-3.5 w-3.5" />
            参考になった {review.helpfulCount > 0 && `(${review.helpfulCount})`}
          </button>
          <button onClick={() => handleReaction("bought")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-all">
            <ShoppingCart className="h-3.5 w-3.5" />
            私も買った！
          </button>
          <button onClick={() => handleReaction("want")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 hover:text-pink-500 hover:bg-pink-50 transition-all">
            <Heart className="h-3.5 w-3.5" />
            欲しい！
          </button>
          <button onClick={() => setShowQA(!showQA)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 hover:text-purple-500 hover:bg-purple-50 transition-all">
            <HelpCircle className="h-3.5 w-3.5" />
            質問する
          </button>
        </div>

        {/* ライトボックス - セキュリティ: レシート画像非表示のため無効化 */}

        {/* Q&A */}
        {showQA && (
          <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/50">
            <div className="pt-3">
              <h5 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                この商品への質問
              </h5>
              {questions && questions.length > 0 && (
                <div className="space-y-2 mb-3">
                  {questions.map((q: any) => (
                    <div key={q.id} className="bg-white rounded-lg p-2.5 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">Q:</span>
                        <p className="text-gray-700 flex-1">{q.questionText}</p>
                      </div>
                      {q.answerText && (
                        <div className="flex items-start gap-2 mt-1.5 pl-4 border-l-2 border-emerald-200">
                          <span className="text-emerald-500 font-bold">A:</span>
                          <p className="text-gray-600 flex-1">{q.answerText}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="この商品について質問する..." className="text-xs h-8" />
                <Button size="sm" className="h-8 bg-purple-500 hover:bg-purple-600 text-white px-3" onClick={handleAskQuestion} disabled={askQuestion.isPending || !questionText.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== メインコンポーネント =====
export default function ProductReviews() {
  const [, setLocation] = useLocation();
  const params = useParams<{ name: string }>();
  const productName = decodeURIComponent(params.name || "");
  const { data: lineUser } = trpc.lineLogin.me.useQuery();
  const isLoggedIn = !!lineUser;

  const [sortBy, setSortBy] = useState<"newest" | "highest" | "lowest">("newest");

  const { data: searchResult, isLoading } = trpc.receiptReview.search.useQuery(
    { query: productName, limit: 50 },
    { enabled: productName.length > 0 }
  );
  const reviews = searchResult?.reviews;
  const masterImage = searchResult?.masterImage;

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

  // 動画付きレビューを抽出
  const videoReviews = useMemo(() => {
    if (!reviews) return [];
    return reviews.filter((r: any) => r.videoUrl || r.tiktokUrl || r.liveCommerceUrl);
  }, [reviews]);

  // 商品画像（product_masterの画像を優先、なければレビューの画像をフォールバック）
  // セキュリティ: レシート画像には個人情報が含まれるため、product_masterの画像のみ使用
  const productImage = masterImage?.imageUrl || null;
  const brandName = reviews?.[0]?.brandName;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <ShoppingBag className="h-6 w-6 text-rose-500" />
            <span className="text-lg font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              LCJ MALL
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Button size="sm" className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white gap-1 text-xs shadow-md shadow-rose-200/50"
                onClick={() => setLocation("/mypage")}>
                <User className="h-4 w-4" />
                マイページ
              </Button>
            ) : (
              <Button size="sm" className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white gap-1 text-xs shadow-md shadow-rose-200/50"
                onClick={() => setLocation("/line-login")}>
                <UserPlus className="h-4 w-4" />
                無料ではじめる
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 商品ヒーローセクション */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-600 via-pink-500 to-fuchsia-600" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-300/15 via-transparent to-transparent" />

        <div className="relative z-10 py-8 md:py-12 px-4">
          <div className="container mx-auto max-w-4xl">
            {/* パンくず */}
            <div className="flex items-center gap-2 text-sm text-white/70 mb-6">
              <button onClick={() => setLocation("/reviews")} className="hover:text-white transition-colors flex items-center gap-1">
                <ChevronLeft className="h-4 w-4" />
                口コミDB
              </button>
              <span>/</span>
              <span className="text-white font-medium line-clamp-1">{productName}</span>
            </div>

            <div className="flex gap-6 items-start">
              {/* 商品画像 */}
              {productImage && (
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden bg-white shadow-2xl shadow-black/20 shrink-0">
                  <img src={productImage} alt={productName} className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-black text-white mb-1 leading-tight">{productName}</h1>
                {brandName && <p className="text-white/70 text-sm mb-3">{brandName}</p>}

                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  {stats && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <StarRating rating={Number(stats.avgRating)} size="md" />
                        <span className="text-xl font-black text-white">{stats.avgRating}</span>
                      </div>
                      <span className="text-white/40">|</span>
                      <span className="text-white/80 text-sm font-medium">{stats.total}件の口コミ</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs text-white font-medium">
                    <Shield className="h-3.5 w-3.5" />
                    全件購入証明済み
                  </span>
                  {videoReviews.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs text-white font-medium">
                      <Video className="h-3.5 w-3.5" />
                      動画レビュー {videoReviews.length}件
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
        {/* 評価分布 */}
        {stats && (
          <Card className="border-0 shadow-sm mb-6 overflow-hidden">
            <CardContent className="p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-amber-500" />
                評価分布
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-5xl font-black text-gray-900">{stats.avgRating}</div>
                    <StarRating rating={Number(stats.avgRating)} size="md" />
                    <div className="text-xs text-gray-400 mt-1">{stats.total}件の評価</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {stats.distribution.map((d) => {
                    const colors = ["from-amber-400 to-yellow-300", "from-amber-300 to-yellow-200", "from-yellow-300 to-yellow-200", "from-orange-300 to-orange-200", "from-red-300 to-red-200"];
                    return (
                      <div key={d.star} className="flex items-center gap-2 text-sm">
                        <span className="w-4 text-gray-500 font-bold">{d.star}</span>
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${colors[5 - d.star]} rounded-full transition-all duration-700 ease-out`}
                            style={{ width: `${(d.count / stats.total) * 100}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-gray-500 text-xs font-medium">{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ソート */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-rose-500" />
            レビュー一覧
            {stats && <span className="font-normal text-gray-500 ml-1">({stats.total}件)</span>}
          </h2>
          <div className="flex items-center gap-1">
            {(["newest", "highest", "lowest"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                  sortBy === s
                    ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-200/50"
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
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" />
              読み込み中...
            </div>
          </div>
        ) : sortedReviews.length > 0 ? (
          <div className="space-y-4">
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
              className="mt-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-md"
              onClick={() => setLocation("/receipt-upload")}
            >
              レシートを送ってレビューする
            </Button>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-800" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-500/20 via-transparent to-transparent" />
          <div className="relative z-10 p-6 md:p-8 text-center text-white">
            <h3 className="font-bold text-lg mb-2">この商品を使ったことがありますか？</h3>
            <p className="text-sm text-gray-300 mb-5 leading-relaxed">
              レシートを送るだけでポイント還元＋あなたのリアルな口コミを共有できます
            </p>
            <Button
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-500/30"
              onClick={() => setLocation("/receipt-upload")}
            >
              <Receipt className="h-4 w-4 mr-1.5" />
              レシートを送ってレビューする
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-10">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <ShoppingBag className="h-5 w-5 text-rose-400" />
            <span className="text-white font-bold text-lg">LCJ MALL</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">リアル口コミDB — 購入証明付き口コミだけの信頼できるレビューメディア</p>
          <div className="flex items-center justify-center gap-6 text-xs">
            <Link href="/" className="hover:text-white transition-colors">トップ</Link>
            <Link href="/reviews" className="hover:text-white transition-colors">口コミDB</Link>
            <Link href="/mall/products" className="hover:text-white transition-colors">商品一覧</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
