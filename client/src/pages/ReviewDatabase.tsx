import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Star,
  ShoppingBag,
  MessageSquare,
  TrendingUp,
  Shield,
  ChevronRight,
  ChevronLeft,
  ThumbsUp,
  User,
  UserPlus,
  Receipt,
  Sparkles,
  Crown,
  BarChart3,
  Clock,
  Heart,
  Play,
  Video,
  ExternalLink,
  HelpCircle,
  Send,
  Eye,
  Flame,
  ShoppingCart,
  Camera,
  X,
  ImageIcon,
} from "lucide-react";

// ===== プラットフォームバッジ設定 =====
const PLATFORM_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  "TikTok Shop": { label: "TikTok Shop", color: "bg-gray-900 text-white", icon: "♪" },
  "Qoo10": { label: "Qoo10", color: "bg-red-500 text-white", icon: "Q" },
  "Amazon": { label: "Amazon", color: "bg-orange-500 text-white", icon: "A" },
  "楽天市場": { label: "楽天市場", color: "bg-red-600 text-white", icon: "R" },
  "SHEIN": { label: "SHEIN", color: "bg-black text-white", icon: "S" },
  "LCJ MALL": { label: "LCJ MALL", color: "bg-rose-500 text-white", icon: "L" },
  "Yahoo!ショッピング": { label: "Yahoo!", color: "bg-red-400 text-white", icon: "Y" },
  "メルカリShops": { label: "メルカリ", color: "bg-red-500 text-white", icon: "M" },
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

// ===== プライバシー保護：名前ぼかし =====
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

// ===== 星評価コンポーネント =====
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

// ===== 評価分布バー =====
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

// ===== 動画フィードカード =====
function VideoFeedCard({ review }: { review: any }) {
  const [, setLocation] = useLocation();
  const isLive = !!review.liveCommerceUrl;
  const videoUrl = review.videoUrl || review.tiktokUrl || review.liveCommerceUrl;

  // TikTok URLからembed URLを生成
  const getTikTokEmbedUrl = (url: string) => {
    const match = url.match(/video\/(\d+)/);
    if (match) return `https://www.tiktok.com/embed/v2/${match[1]}`;
    return null;
  };

  const handleClick = () => {
    if (videoUrl) {
      window.open(videoUrl, "_blank");
    }
  };

  return (
    <div
      className="relative flex-shrink-0 w-[200px] md:w-[240px] h-[320px] md:h-[380px] rounded-2xl overflow-hidden cursor-pointer group shadow-lg"
      onClick={handleClick}
    >
      {/* 背景グラデーション */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-gray-700 to-gray-900" />

      {/* 商品画像（背景として） */}
      {review.productImageUrl && (
        <img
          src={review.productImageUrl}
          alt={review.productName}
          className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
        />
      )}

      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

      {/* プラットフォームバッジ */}
      <div className="absolute top-3 left-3 z-10">
        {isLive ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-600 text-white">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE録画
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-900/80 text-white backdrop-blur-sm">
            ♪ TikTok
          </span>
        )}
      </div>

      {/* 再生ボタン */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-all group-hover:scale-110">
          <Play className="h-7 w-7 text-white fill-white ml-1" />
        </div>
      </div>

      {/* 下部情報 */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <StarRating rating={review.rating} size="sm" />
          <Badge variant="outline" className="text-[9px] border-emerald-400/50 text-emerald-300 bg-emerald-900/30">
            ✅ 購入証明済
          </Badge>
        </div>
        <h4 className="text-white font-bold text-sm line-clamp-2 mb-1.5">{review.productName}</h4>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-500/50 backdrop-blur-sm flex items-center justify-center" style={{ filter: "blur(1px)" }}>
            <User className="h-3 w-3 text-white/70" />
          </div>
          <span className="text-white/60 text-xs" style={{ filter: "blur(1.5px)" }}>
            {review.reviewerName || "匿名"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ===== 動画フィードセクション =====
function VideoFeedSection() {
  const { data: videoReviews } = trpc.receiptReview.videoFeed.useQuery({ limit: 10 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -260, behavior: "smooth" });
  };
  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 260, behavior: "smooth" });
  };

  if (!videoReviews || videoReviews.length === 0) return null;

  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 md:py-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <Video className="h-6 w-6 text-rose-400" />
              動画レビュー
            </h2>
            <p className="text-gray-400 text-sm mt-1">購入者のリアルな動画レビューをチェック</p>
          </div>
          <div className="flex gap-2">
            <button onClick={scrollLeft} className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={scrollRight} className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videoReviews.map((review: any) => (
            <div key={review.id} className="snap-start">
              <VideoFeedCard review={review} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== 改善版レビューカード =====
function EnhancedReviewCard({ review, onHelpful }: { review: any; onHelpful: (id: number) => void }) {
  const [showQA, setShowQA] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const tags = Array.isArray(review.tags) ? review.tags : [];
  const dateStr = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })
    : "";
  const isNew = review.createdAt && (Date.now() - new Date(review.createdAt).getTime()) < 24 * 60 * 60 * 1000;

  // リアクション
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
        utils.receiptReview.reactionCounts.invalidate();
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
    <Card className="border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden">
      <CardContent className="p-0">
        {/* 上部：商品情報 */}
        <div className="p-4 pb-3">
          <div className="flex gap-3">
            {/* 商品画像（クリックでライトボックス） */}
            {review.productImageUrl ? (
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden bg-gray-100 shrink-0 cursor-pointer relative group"
                onClick={() => setLightboxOpen(true)}
              >
                <img
                  src={review.productImageUrl}
                  alt={review.productName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center shrink-0">
                <ShoppingBag className="h-8 w-8 text-gray-300" />
              </div>
            )}

            {/* 商品情報 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-gray-900 text-sm line-clamp-2">{review.productName}</h4>
                <div className="flex gap-1 shrink-0">
                  {isNew && (
                    <Badge className="bg-rose-500 text-white text-[9px] px-1.5">NEW</Badge>
                  )}
                </div>
              </div>

              {review.brandName && (
                <p className="text-xs text-gray-500 mt-0.5">{review.brandName}</p>
              )}

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StarRating rating={review.rating} size="md" />
                <span className="text-sm font-bold text-amber-500">{review.rating}.0</span>
              </div>

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50">
                  ✅ 購入証明済
                </Badge>
                <PlatformBadge platform={review.purchasePlatform} />
                {review.purchaseAmount && (
                  <span className="text-xs text-gray-500 font-medium">
                    ¥{review.purchaseAmount.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 動画・ライブコマースリンク */}
        {(review.videoUrl || review.tiktokUrl || review.liveCommerceUrl) && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {(review.videoUrl || review.tiktokUrl) && (
              <a
                href={review.videoUrl || review.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors"
              >
                <Play className="h-3.5 w-3.5" />
                TikTok動画を見る
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {review.liveCommerceUrl && (
              <a
                href={review.liveCommerceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-red-400 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
              >
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
                <span key={i} className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* レビュアー情報 */}
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-gray-400">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center" style={{ filter: "blur(1.5px)" }}>
            <User className="h-3 w-3 text-gray-500" />
          </div>
          <BlurredName name={review.reviewerName || null} />
          <span>•</span>
          <span>{dateStr}</span>
        </div>

        {/* リアクションバー */}
        <div className="px-4 py-3 border-t border-gray-50 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onHelpful(review.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 hover:text-rose-500 hover:bg-rose-50 transition-all"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            参考になった {review.helpfulCount > 0 && `(${review.helpfulCount})`}
          </button>
          <button
            onClick={() => handleReaction("bought")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-all"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            私も買った！
          </button>
          <button
            onClick={() => handleReaction("want")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 hover:text-pink-500 hover:bg-pink-50 transition-all"
          >
            <Heart className="h-3.5 w-3.5" />
            欲しい！
          </button>
          <button
            onClick={() => setShowQA(!showQA)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 hover:text-purple-500 hover:bg-purple-50 transition-all"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            質問する
          </button>
        </div>

        {/* ライトボックス */}
        {lightboxOpen && review.productImageUrl && (
          <PhotoLightbox
            images={[review.productImageUrl]}
            initialIndex={0}
            onClose={() => setLightboxOpen(false)}
          />
        )}

        {/* Q&Aセクション */}
        {showQA && (
          <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/50">
            <div className="pt-3">
              <h5 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                この商品への質問
              </h5>

              {/* 既存の質問 */}
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

              {/* 質問入力 */}
              <div className="flex gap-2">
                <Input
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="この商品について質問する..."
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  className="h-8 bg-purple-500 hover:bg-purple-600 text-white px-3"
                  onClick={handleAskQuestion}
                  disabled={askQuestion.isPending || !questionText.trim()}
                >
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

// ===== 改善版商品ランキングカード =====
function EnhancedProductRankingCard({ product, rank }: { product: any; rank: number }) {
  const [, setLocation] = useLocation();
  const [showGallery, setShowGallery] = useState(false);
  const rankColors: Record<number, string> = {
    1: "bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-amber-200",
    2: "bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-gray-200",
    3: "bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-amber-300",
  };

  const isHot = product.reviewCount >= 5;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50/50 transition-all duration-200 cursor-pointer group"
      onClick={() => setLocation(`/reviews/product/${encodeURIComponent(product.productName)}`)}
    >
      {/* ランク */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 shadow-sm ${
        rankColors[rank] || "bg-gray-100 text-gray-500"
      }`}>
        {rank <= 3 ? (
          <Crown className="h-4 w-4" />
        ) : (
          rank
        )}
      </div>

      {/* 商品画像（クリックで拡大） */}
      {product.images && product.images.length > 0 ? (
        <div
          className="relative shrink-0 cursor-pointer group"
          onClick={(e) => { e.stopPropagation(); setShowGallery(true); }}
        >
          <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white shadow-md">
            <img src={product.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
          </div>
          {product.images.length > 1 && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
              {product.images.length}
            </div>
          )}
          <div className="absolute inset-0 w-14 h-14 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      ) : (
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <ShoppingBag className="h-6 w-6 text-gray-300" />
        </div>
      )}

      {/* 商品情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 group-hover:text-rose-600 transition-colors">
            {product.productName}
          </h4>
          {isHot && (
            <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {product.brandName && (
            <span className="text-xs text-gray-500">{product.brandName}</span>
          )}
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-gray-700">{product.avgRating}</span>
          </div>
          {product.minPrice && product.maxPrice && (
            <span className="text-xs text-gray-400">
              ¥{Number(product.minPrice).toLocaleString()}
              {product.minPrice !== product.maxPrice && `〜¥${Number(product.maxPrice).toLocaleString()}`}
            </span>
          )}
        </div>
      </div>

      {/* レビュー数・写真数 */}
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-rose-500">{product.reviewCount}件</div>
        <div className="flex items-center gap-1 justify-end">
          {product.imageCount > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <Camera className="h-3 w-3" />
              {product.imageCount}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-rose-400 transition-colors shrink-0" />

      {/* 商品画像ギャラリーライトボックス */}
      {showGallery && product.images && product.images.length > 0 && (
        <PhotoLightbox
          images={product.images}
          initialIndex={0}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );
}

// ===== TikTok Shop 専用プラットフォームカード =====
function PlatformDistributionCard() {
  const { data: statsData } = trpc.receiptReview.stats.useQuery();
  const totalReviews = statsData?.totalReviews || 0;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {/* TikTok Shop ブランドヘッダー */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <span className="text-lg">♪</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">TikTok Shop</h3>
              <p className="text-gray-400 text-[10px]">全レビューのTikTok Shop購入証明済み</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">
                <span className="text-white text-xs font-bold">♪</span>
              </div>
              <div>
                <span className="text-sm font-bold text-gray-900">TikTok Shop</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Shield className="h-2.5 w-2.5 text-emerald-600" />
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">購入証明済</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-gray-900">{totalReviews.toLocaleString()}</div>
              <div className="text-[10px] text-gray-400">口コミ数</div>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gray-800 to-gray-600 rounded-full w-full" />
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">※ 現在TikTok Shopのみ対応。他モールは順次拡大予定。</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== 写真ライトボックス =====
function PhotoLightbox({ images, initialIndex, onClose }: { images: string[]; initialIndex: number; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setCurrentIndex(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setCurrentIndex(i => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white z-10" onClick={onClose}>
        <X className="h-8 w-8" />
      </button>
      <div className="relative max-w-4xl max-h-[90vh] w-full px-4" onClick={(e) => e.stopPropagation()}>
        <img
          src={images[currentIndex]}
          alt=""
          className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
        />
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <span className="text-white/60 text-sm">{currentIndex + 1} / {images.length}</span>
          <button
            onClick={() => setCurrentIndex(i => Math.min(images.length - 1, i + 1))}
            disabled={currentIndex === images.length - 1}
            className="text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 「欲しい！」ランキング =====
function WantRankingCard() {
  const { data: wantRanking } = trpc.receiptReview.wantRanking.useQuery({ limit: 5 });
  if (!wantRanking || wantRanking.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
          <Heart className="h-4 w-4 text-pink-500" />
          みんなが欲しい！
        </h3>
        <div className="space-y-2">
          {wantRanking.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
              <span className="text-xs text-gray-700 flex-1 line-clamp-1">{item.productName}</span>
              <span className="text-xs text-pink-500 font-bold flex items-center gap-0.5">
                <Heart className="h-3 w-3 fill-pink-500" />
                {item.wantCount}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== 最新Q&Aセクション =====
function LatestQuestionsCard() {
  const { data: questions } = trpc.receiptReview.latestQuestions.useQuery({ limit: 5 });
  if (!questions || questions.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4 text-purple-500" />
          最新の質問
        </h3>
        <div className="space-y-2.5">
          {questions.map((q: any) => (
            <div key={q.id} className="text-xs">
              <div className="flex items-start gap-1.5">
                <span className="text-purple-500 font-bold shrink-0">Q:</span>
                <div>
                  <p className="text-gray-700 line-clamp-2">{q.questionText}</p>
                  <p className="text-gray-400 mt-0.5">{q.productName}</p>
                </div>
              </div>
              {q.answerText && (
                <div className="flex items-start gap-1.5 mt-1 pl-3 border-l-2 border-emerald-200">
                  <span className="text-emerald-500 font-bold shrink-0">A:</span>
                  <p className="text-gray-600 line-clamp-2">{q.answerText}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== メインコンポーネント =====
export default function ReviewDatabase() {
  const [, setLocation] = useLocation();
  const { data: lineUser } = trpc.lineLogin.me.useQuery();
  const isLoggedIn = !!lineUser;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ranking" | "latest" | "qa">("ranking");

  // API calls
  const { data: statsData } = trpc.receiptReview.stats.useQuery();
  const { data: rankingData } = trpc.receiptReview.productRankingEnhanced.useQuery({ limit: 20 });
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
      <section className="bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white py-10 md:py-16 px-4 relative overflow-hidden">
        {/* 背景パーティクル */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/5 rounded-full blur-xl animate-pulse" />
          <div className="absolute bottom-10 right-20 w-32 h-32 bg-white/5 rounded-full blur-xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-white/5 rounded-full blur-xl animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <div className="container mx-auto max-w-4xl text-center relative z-10">
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
              <div className="text-xs text-white/70">口コミ数</div>
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

      {/* 動画フィード */}
      <VideoFeedSection />

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map((review: any) => (
                  <EnhancedReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
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

        {/* メインコンテンツ */}
        {searchQuery.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {/* 左カラム */}
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
                <button
                  onClick={() => setActiveTab("qa")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === "qa"
                      ? "bg-white text-rose-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <HelpCircle className="h-4 w-4" />
                  Q&A
                </button>
              </div>

              {/* 商品ランキング */}
              {activeTab === "ranking" && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-2 md:p-4">
                    {rankingData && rankingData.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {rankingData.map((product: any, index: number) => (
                          <EnhancedProductRankingCard
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayReviews.map((review: any) => (
                        <EnhancedReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
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

              {/* Q&Aタブ */}
              {activeTab === "qa" && (
                <LatestQuestionsFullView />
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

              {/* プラットフォーム分布 */}
              <PlatformDistributionCard />

              {/* 欲しい！ランキング */}
              <WantRankingCard />

              {/* 最新の質問 */}
              <LatestQuestionsCard />

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

// ===== Q&Aフルビュー（タブ用） =====
function LatestQuestionsFullView() {
  const { data: questions } = trpc.receiptReview.latestQuestions.useQuery({ limit: 20 });
  const [answerTexts, setAnswerTexts] = useState<Record<number, string>>({});
  const answerMutation = trpc.receiptReview.answerQuestion.useMutation();
  const utils = trpc.useUtils();

  const handleAnswer = (questionId: number) => {
    const text = answerTexts[questionId]?.trim();
    if (!text) return;
    answerMutation.mutate({ questionId, answerText: text }, {
      onSuccess: () => {
        setAnswerTexts(prev => ({ ...prev, [questionId]: "" }));
        utils.receiptReview.latestQuestions.invalidate();
      },
    });
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">まだ質問がありません</p>
        <p className="text-sm text-gray-400 mt-1">レビューから商品について質問してみましょう！</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((q: any) => (
        <Card key={q.id} className="border border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-start gap-2 mb-2">
              <span className="text-purple-500 font-bold text-sm shrink-0">Q:</span>
              <div className="flex-1">
                <p className="text-sm text-gray-800 font-medium">{q.questionText}</p>
                <p className="text-xs text-gray-400 mt-1">{q.productName}</p>
              </div>
            </div>

            {q.answerText ? (
              <div className="flex items-start gap-2 mt-3 pl-4 border-l-2 border-emerald-200">
                <span className="text-emerald-500 font-bold text-sm shrink-0">A:</span>
                <p className="text-sm text-gray-600">{q.answerText}</p>
              </div>
            ) : (
              <div className="mt-3 pl-4 border-l-2 border-gray-200">
                <p className="text-xs text-gray-400 mb-2">まだ回答がありません。購入者の方、回答をお願いします！</p>
                <div className="flex gap-2">
                  <Input
                    value={answerTexts[q.id] || ""}
                    onChange={(e) => setAnswerTexts(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="回答を入力..."
                    className="text-xs h-8"
                  />
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white px-3"
                    onClick={() => handleAnswer(q.id)}
                    disabled={answerMutation.isPending || !(answerTexts[q.id]?.trim())}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
