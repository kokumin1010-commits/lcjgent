import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star, Sparkles, Trophy, ArrowRight, Zap, PartyPopper, ThumbsUp, ExternalLink } from "lucide-react";

// ===== Types =====
type KakuhenStep = "tiktok_url" | "review" | "meter" | "lottery" | "result";

interface OcrData {
  shopName?: string;
  productName?: string;
  totalAmount?: number;
  orderDate?: string;
  items?: Array<{
    productName?: string;
    unitPrice?: number;
    quantity?: number;
    variant?: string;
  }>;
}

interface KakuhenChanceProps {
  receiptId: number;
  receiptType: "point_request" | "line_receipt";
  orderAmount: number;
  ocrData?: OcrData;
  receiptImageUrl?: string;
  receiptImagePreview?: string; // base64 preview for local display
  onComplete: (result: KakuhenResult) => void;
  onSkip: () => void;
}

interface KakuhenResult {
  resultId: number;
  isKakuhen: boolean;
  isJackpot: boolean;
  baseRate: number;
  boostedRate: number;
  lotteryNumber: string;
  winningNumber: string;
  basePoints: number;
  actualPoints: number;
  bonusPoints: number;
  orderAmount: number;
  reviewId?: number;
  reviewRating?: number;
  reviewText?: string;
  reviewTags?: string[];
}

// ===== Quick Tags =====
const QUICK_TAGS = [
  "コスパ最高", "リピ確定", "TikTokで見て買った", "期待以上",
  "香りが良い", "使いやすい", "肌に合った", "見た目が可愛い",
];

// ===== Star Rating Component =====
function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  const labels = ["", "うーん…", "いまいち", "普通", "良い！", "最高！"];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            className="transition-all duration-200 active:scale-125"
          >
            <Star
              className={`w-10 h-10 ${
                star <= rating
                  ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]"
                  : "text-gray-600"
              }`}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <span className="text-sm font-medium text-yellow-400">{labels[rating]}</span>
      )}
    </div>
  );
}

// ===== Meter Animation Component =====
function MeterAnimation({
  baseRate,
  boostedRate,
  isKakuhen,
  onComplete,
}: {
  baseRate: number;
  boostedRate: number;
  isKakuhen: boolean;
  onComplete: () => void;
}) {
  const [currentRate, setCurrentRate] = useState(baseRate);
  const [phase, setPhase] = useState<"filling" | "boosting" | "done">("filling");
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    // Phase 1: Fill to base rate (1s)
    const t1 = setTimeout(() => {
      setCurrentRate(baseRate);
      setPhase("boosting");
    }, 500);

    // Phase 2: Boost animation (if kakuhen)
    const t2 = setTimeout(() => {
      if (isKakuhen) {
        setGlowing(true);
        setCurrentRate(boostedRate);
      }
      setPhase("done");
    }, 2000);

    // Phase 3: Complete
    const t3 = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const percentage = (currentRate / 2) * 100; // 2% = 100%

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <h3 className="text-lg font-bold text-white">還元率メーター</h3>

      {/* Meter */}
      <div className="w-full max-w-xs">
        <div className={`relative h-8 bg-gray-800 rounded-full overflow-hidden border-2 ${
          glowing ? "border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.5)]" : "border-gray-600"
        }`}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              isKakuhen && phase !== "filling"
                ? "bg-gradient-to-r from-orange-500 to-yellow-400"
                : "bg-gradient-to-r from-pink-500 to-rose-400"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>0%</span>
          <span>1%</span>
          <span>2%</span>
        </div>
      </div>

      {/* Rate Display */}
      <div className={`text-center transition-all duration-500 ${glowing ? "scale-110" : ""}`}>
        <div className={`text-5xl font-black ${
          isKakuhen && phase !== "filling"
            ? "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300"
            : "text-pink-400"
        }`}>
          {currentRate.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-400 mt-1">還元率</div>
      </div>

      {isKakuhen && phase === "done" && (
        <div className="flex items-center gap-2 text-orange-400 animate-bounce">
          <Zap className="w-5 h-5" />
          <span className="font-bold">確変モード発動！</span>
          <Zap className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

// ===== Lottery Animation Component =====
function LotteryAnimation({
  lotteryNumber,
  winningNumber,
  isJackpot,
  onComplete,
}: {
  lotteryNumber: string;
  winningNumber: string;
  isJackpot: boolean;
  onComplete: () => void;
}) {
  const [displayDigits, setDisplayDigits] = useState<string[]>(["?", "?", "?", "?", "?", "?"]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    const userDigits = lotteryNumber.padStart(6, "0").split("");
    let revealed = 0;

    // Scramble non-revealed digits
    intervalRef.current = setInterval(() => {
      setDisplayDigits((prev) => {
        return prev.map((d, i) => {
          if (i < revealed) return userDigits[i];
          return String(Math.floor(Math.random() * 10));
        });
      });
    }, 80);

    // Reveal digits one by one
    const revealNext = () => {
      if (revealed < 6) {
        revealed++;
        setRevealedCount(revealed);
        if (revealed < 6) {
          setTimeout(revealNext, 600);
        } else {
          // All revealed
          setTimeout(() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setDisplayDigits(userDigits);
            setShowResult(true);
            setTimeout(onComplete, 2000);
          }, 400);
        }
      }
    };

    setTimeout(revealNext, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <h3 className="text-lg font-bold text-white">全額還元抽選中...</h3>

      {/* Slot Display */}
      <div className={`p-6 rounded-2xl border-2 ${
        isJackpot && showResult
          ? "border-yellow-400 bg-gradient-to-b from-yellow-900/30 to-orange-900/30 shadow-[0_0_30px_rgba(250,204,21,0.4)]"
          : "border-orange-500/50 bg-gradient-to-b from-gray-900 to-gray-800"
      }`}>
        <div className="text-sm text-gray-400 text-center mb-3">あなたの抽選番号</div>
        <div className="flex gap-1 justify-center">
          {displayDigits.map((digit, i) => (
            <div key={i} className="flex items-center">
              {i === 3 && <span className="text-gray-500 text-2xl font-bold mx-1">,</span>}
              <div className={`w-12 h-16 flex items-center justify-center rounded-lg text-3xl font-black ${
                i < revealedCount
                  ? "bg-gray-800 text-orange-400 border border-orange-500/30"
                  : "bg-gray-900 text-gray-300 border border-gray-700"
              }`}>
                {digit}
              </div>
            </div>
          ))}
        </div>
        <div className="text-sm text-gray-500 text-center mt-3">
          当選番号: {winningNumber.slice(0, 3)},{winningNumber.slice(3)}
        </div>
      </div>

      {showResult && (
        <div className={`text-center ${isJackpot ? "animate-bounce" : ""}`}>
          {isJackpot ? (
            <div className="space-y-2">
              <div className="text-4xl">🎉🎊🎉</div>
              <div className="text-2xl font-black text-yellow-400">大当たり！！！</div>
              <div className="text-lg text-yellow-300">全額ポイントバック確定！</div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm">
              惜しくもハズレ...次回もチャレンジ！
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Main Component =====
export default function KakuhenChance({
  receiptId,
  receiptType,
  orderAmount,
  ocrData,
  receiptImageUrl,
  receiptImagePreview,
  onComplete,
  onSkip,
}: KakuhenChanceProps) {
  const [step, setStep] = useState<KakuhenStep>("tiktok_url");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [kakuhenData, setKakuhenData] = useState<KakuhenResult | null>(null);

  const kakuhenMutation = trpc.kakuhen.play.useMutation();
  const reviewMutation = trpc.receiptReview.submit.useMutation();

  // Product info from OCR
  const productName = ocrData?.items?.[0]?.productName || ocrData?.productName || "商品";
  const brandName = ocrData?.shopName || "";
  const receiptPreview = receiptImagePreview || receiptImageUrl;

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    // Also append/remove from review text
    setReviewText((prev) => {
      const hashTag = `#${tag}`;
      if (prev.includes(hashTag)) {
        return prev.replace(hashTag, "").replace(/\s+/g, " ").trim();
      }
      return prev ? `${prev} ${hashTag}` : hashTag;
    });
  }, []);

  const handleStartKakuhen = useCallback(async () => {
    // Play kakuhen chance
    try {
      const result = await kakuhenMutation.mutateAsync({
        receiptType,
        receiptId,
        orderAmount,
        tiktokUrl: tiktokUrl.trim() || undefined,
      });
      setKakuhenData(result as unknown as KakuhenResult);
      setStep("meter");
    } catch (err: any) {
      toast.error(err.message || "エラーが発生しました");
    }
  }, [tiktokUrl, receiptType, receiptId, orderAmount]);

  const handleSubmitReview = useCallback(async () => {
    if (rating === 0) {
      toast.error("星評価を選択してください");
      return;
    }
    if (!reviewText.trim()) {
      toast.error("レビューを入力してください");
      return;
    }

    try {
      const reviewResult = await reviewMutation.mutateAsync({
        receiptType,
        receiptId,
        kakuhenResultId: kakuhenData?.resultId,
        productName,
        brandName: brandName || undefined,
        shopName: ocrData?.shopName || undefined,
        purchaseAmount: orderAmount,
        rating,
        reviewText: reviewText.trim(),
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        receiptImageUrl: receiptImageUrl || undefined,
        tiktokUrl: tiktokUrl.trim() || undefined,
      });

      if (kakuhenData) {
        kakuhenData.reviewId = reviewResult.reviewId;
        kakuhenData.reviewRating = rating;
        kakuhenData.reviewText = reviewText;
        kakuhenData.reviewTags = selectedTags;
      }

      // Move to meter animation
      handleStartKakuhen();
    } catch (err: any) {
      toast.error(err.message || "レビューの投稿に失敗しました");
    }
  }, [rating, reviewText, selectedTags, kakuhenData, handleStartKakuhen]);

  const handleMeterComplete = useCallback(() => {
    setStep("lottery");
  }, []);

  const handleLotteryComplete = useCallback(() => {
    setStep("result");
  }, []);

  const handleFinish = useCallback(() => {
    if (kakuhenData) {
      onComplete(kakuhenData);
    }
  }, [kakuhenData, onComplete]);

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <div className="flex items-center justify-center gap-2 px-4">
        {["URL", "レビュー", "メーター", "抽選", "結果"].map((label, i) => {
          const steps: KakuhenStep[] = ["tiktok_url", "review", "meter", "lottery", "result"];
          const currentIndex = steps.indexOf(step);
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isActive
                  ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-white scale-110 shadow-[0_0_10px_rgba(251,146,60,0.5)]"
                  : isDone
                  ? "bg-green-500 text-white"
                  : "bg-gray-700 text-gray-400"
              }`}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] hidden sm:inline ${isActive ? "text-orange-400 font-bold" : "text-gray-500"}`}>
                {label}
              </span>
              {i < 4 && <div className={`w-4 h-0.5 ${isDone ? "bg-green-500" : "bg-gray-700"}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: TikTok URL */}
      {step === "tiktok_url" && (
        <Card className="bg-gradient-to-b from-gray-900 to-gray-800 border-orange-500/30">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="text-4xl">🎰</div>
              <h3 className="text-xl font-black text-white">確変チャンス！</h3>
              <p className="text-sm text-gray-400">
                TikTok動画URLを入力すると還元率UP＋全額ポイントバックのチャンスも！
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">TikTok動画URL（任意）</label>
              <div className="relative">
                <input
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@user/video/..."
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none"
                />
                {tiktokUrl && (
                  <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                )}
              </div>
              <p className="text-xs text-gray-500">
                購入のきっかけになったTikTok動画のURLを貼ると還元率が1% → 1.5%にUP！
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-600 text-gray-400 hover:text-white"
                onClick={() => setStep("review")}
              >
                スキップ
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold"
                onClick={() => setStep("review")}
              >
                次へ <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review */}
      {step === "review" && (
        <Card className="bg-gradient-to-b from-gray-900 to-gray-800 border-orange-500/30">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="text-4xl">📝</div>
              <h3 className="text-xl font-black text-white">商品レビュー</h3>
              <p className="text-sm text-gray-400">
                購入証明付きのリアルな口コミを投稿しよう
              </p>
            </div>

            {/* Receipt Preview + Product Info */}
            <div className="flex gap-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              {receiptPreview && (
                <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden border border-gray-600">
                  <img
                    src={receiptPreview}
                    alt="レシート"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-green-500/80 text-white text-[8px] text-center py-0.5">
                    ✅ AI読取済み
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] mb-2">
                  🤖 AI自動認識
                </Badge>
                <p className="font-bold text-white text-sm truncate">{productName}</p>
                {brandName && (
                  <p className="text-xs text-gray-400 mt-0.5">{brandName}</p>
                )}
                <p className="text-orange-400 font-bold mt-1">¥{orderAmount.toLocaleString()}</p>
                {ocrData?.orderDate && (
                  <p className="text-xs text-gray-500 mt-0.5">{ocrData.orderDate}</p>
                )}
              </div>
            </div>

            {/* Star Rating */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                星評価 <span className="text-red-400 text-xs">必須</span>
              </h4>
              <StarRating rating={rating} onRate={setRating} />
            </div>

            {/* Review Text */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                💬 一言レビュー <span className="text-red-400 text-xs">必須</span>
              </h4>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="使ってみた感想を教えてください..."
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 min-h-[100px] resize-none focus:border-orange-400"
              />
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">{reviewText.length}文字</span>
                <span className="text-gray-500">正直な感想でOK！</span>
              </div>

              {/* Quick Tags */}
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                        : "bg-gray-800 text-gray-400 border border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold h-12"
              disabled={rating === 0 || !reviewText.trim() || reviewMutation.isPending || kakuhenMutation.isPending}
              onClick={handleSubmitReview}
            >
              {reviewMutation.isPending || kakuhenMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  送信中...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  レビューを送信して確変チャンス！
                </div>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Meter Animation */}
      {step === "meter" && kakuhenData && (
        <Card className="bg-gradient-to-b from-gray-900 to-gray-800 border-orange-500/30">
          <CardContent className="pt-6">
            <MeterAnimation
              baseRate={kakuhenData.baseRate}
              boostedRate={kakuhenData.boostedRate}
              isKakuhen={kakuhenData.isKakuhen}
              onComplete={handleMeterComplete}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Lottery Animation */}
      {step === "lottery" && kakuhenData && (
        <Card className="bg-gradient-to-b from-gray-900 to-gray-800 border-orange-500/30">
          <CardContent className="pt-6">
            <LotteryAnimation
              lotteryNumber={kakuhenData.lotteryNumber}
              winningNumber={kakuhenData.winningNumber}
              isJackpot={kakuhenData.isJackpot}
              onComplete={handleLotteryComplete}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 5: Result */}
      {step === "result" && kakuhenData && (
        <div className="space-y-4">
          {/* Points Result */}
          <Card className={`border-2 ${
            kakuhenData.isJackpot
              ? "border-yellow-400 bg-gradient-to-b from-yellow-900/30 to-orange-900/20"
              : kakuhenData.isKakuhen
              ? "border-orange-400 bg-gradient-to-b from-orange-900/20 to-gray-900"
              : "border-gray-600 bg-gray-900"
          }`}>
            <CardContent className="pt-6 text-center space-y-3">
              <div className="text-4xl">
                {kakuhenData.isJackpot ? "🎊" : kakuhenData.isKakuhen ? "🎉" : "✨"}
              </div>
              <h3 className="text-xl font-black text-white">
                {kakuhenData.isJackpot
                  ? "全額ポイントバック！！！"
                  : kakuhenData.isKakuhen
                  ? "確変モード確定！"
                  : "ポイント獲得！"}
              </h3>
              <div className={`text-4xl font-black ${
                kakuhenData.isJackpot
                  ? "text-yellow-400"
                  : kakuhenData.isKakuhen
                  ? "text-orange-400"
                  : "text-pink-400"
              }`}>
                {kakuhenData.boostedRate}%還元
              </div>
              <div className="text-sm text-orange-300 font-bold">
                ¥{kakuhenData.orderAmount.toLocaleString()} × {kakuhenData.boostedRate}% = +{kakuhenData.actualPoints}pt 獲得！
              </div>
              {kakuhenData.bonusPoints > 0 && (
                <div className="text-xs text-gray-400">
                  通常（{kakuhenData.basePoints}pt）より <span className="text-green-400 font-bold">+{kakuhenData.bonusPoints}pt</span> お得！
                </div>
              )}
              {!kakuhenData.isJackpot && (
                <div className="text-xs text-gray-500">
                  全額還元は惜しくもハズレ...次回もチャレンジ！
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Summary */}
          {kakuhenData.reviewRating && (
            <Card className="bg-gray-900/50 border-green-500/30">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
                  <ThumbsUp className="w-4 h-4" />
                  あなたのレビュー
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= (kakuhenData.reviewRating || 0)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-600"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-gray-300 text-sm">{kakuhenData.reviewText}</p>
                <p className="text-xs text-green-400/70">
                  ✅ レビューが投稿されました！他のユーザーの参考になります
                </p>
              </CardContent>
            </Card>
          )}

          {/* Complete Button */}
          <Button
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold h-12"
            onClick={handleFinish}
          >
            <PartyPopper className="w-5 h-5 mr-2" />
            完了 ✨
          </Button>
        </div>
      )}
    </div>
  );
}
