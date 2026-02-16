import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Gift, ArrowRight, Coins, Receipt, Check, ChevronDown, ChevronUp, ShieldCheck, HelpCircle, Sparkles, MessageCircle, UserPlus, TrendingUp, Crown, Medal, Award, Flame, Heart, Star } from "lucide-react";
import { useLocation, Link } from "wouter";

function formatCurrencyShort(amount: number): string {
  return `¥${Math.round(amount).toLocaleString()}`;
}

const rankIcons = [
  <Crown className="h-5 w-5 text-yellow-500" />,
  <Medal className="h-5 w-5 text-gray-400" />,
  <Award className="h-5 w-5 text-amber-600" />,
];

const rankBgs = [
  "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 shadow-sm",
  "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200",
  "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200",
  "bg-white border-gray-100",
  "bg-white border-gray-100",
];

function RankingItemList({ items, type }: { items: { productName: string; shopName?: string | null; totalAmount: number; totalQuantity?: number; purchaseCount?: number }[]; type: "live" | "receipt" }) {
  return (
    <div className="grid gap-3">
      {items.map((product, index) => (
        <div
          key={`${product.productName}-${index}`}
          className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border transition-all hover:shadow-md ${rankBgs[index] || "bg-white border-gray-100"}`}
        >
          <div className="flex items-center justify-center w-8 h-8 shrink-0">
            {index < 3 ? rankIcons[index] : (
              <span className="text-sm font-bold text-gray-400">{index + 1}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm md:text-base truncate">
              {product.productName}
            </p>
            {product.shopName && (
              <p className="text-xs text-gray-500 truncate">{product.shopName}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-rose-500 text-sm md:text-base">
              {formatCurrencyShort(Number(product.totalAmount))}
            </p>
            <p className="text-xs text-gray-400">
              {type === "live" ? `${product.totalQuantity ?? 0}個販売` : `${product.purchaseCount ?? 0}件購入`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RankingPreviewTabs() {
  const [activeTab, setActiveTab] = useState<"live" | "receipt">("live");
  const { data: liveProducts, isLoading: liveLoading } = trpc.productRanking.topProducts.useQuery({ limit: 5 });
  const { data: receiptProducts, isLoading: receiptLoading } = trpc.productRanking.receiptProductRanking.useQuery({ limit: 5 });

  const isLoading = activeTab === "live" ? liveLoading : receiptLoading;

  return (
    <div>
      {/* タブ切り替え */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setActiveTab("live")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeTab === "live"
              ? "bg-rose-500 text-white shadow-md"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Flame className="h-4 w-4" />
            ライブコマース売れ筋
          </span>
        </button>
        <button
          onClick={() => setActiveTab("receipt")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeTab === "receipt"
              ? "bg-purple-500 text-white shadow-md"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Receipt className="h-4 w-4" />
            みんなの購入
          </span>
        </button>
      </div>

      {/* コンテンツ */}
      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : activeTab === "live" ? (
        liveProducts && liveProducts.length > 0 ? (
          <RankingItemList items={liveProducts} type="live" />
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Flame className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>ランキングデータを準備中です</p>
          </div>
        )
      ) : (
        receiptProducts && receiptProducts.length > 0 ? (
          <RankingItemList
            items={receiptProducts.map((p: any) => ({
              productName: p.productName,
              shopName: p.shopName,
              totalAmount: Number(p.totalAmount),
              purchaseCount: Number(p.purchaseCount),
            }))}
            type="receipt"
          />
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>購入データを準備中です</p>
          </div>
        )
      )}
    </div>
  );
}

function RecommendedSection() {
  const { data: recommended, isLoading } = trpc.mall.getRecommendedProducts.useQuery({ limit: 8 });
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <section className="py-12 md:py-20 px-4 bg-gradient-to-b from-purple-50/30 to-white">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Star className="h-5 w-5 text-purple-500" />
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">あなたへのおすすめ</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="aspect-square bg-gray-100 animate-pulse" />
                <div className="p-3">
                  <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!recommended || recommended.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 bg-gradient-to-b from-purple-50/30 to-white">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <Star className="h-5 w-5 md:h-6 md:w-6 text-purple-500" />
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">あなたへのおすすめ</h2>
          </div>
          <p className="text-gray-500 text-sm md:text-base">閲覧履歴やお気に入りから、あなたにぴったりの商品をお届け</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {recommended.map((product: any) => (
            <div
              key={product.id}
              className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-purple-200 transition-all duration-300 cursor-pointer"
              onClick={() => setLocation(`/mall/products/${product.id}`)}
            >
              <div className="aspect-square bg-gray-50 relative overflow-hidden">
                {product.imageUrl || (product.imageUrls && product.imageUrls[0]) ? (
                  <img
                    src={product.imageUrl || product.imageUrls[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="h-10 w-10 text-gray-300" />
                  </div>
                )}
                {product.brandName && (
                  <Badge className="absolute top-2 left-2 bg-purple-500/90 text-white text-[10px] px-1.5 py-0.5 border-0">
                    {product.brandName}
                  </Badge>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1.5 group-hover:text-purple-600 transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-bold text-rose-500">
                    ¥{product.price?.toLocaleString()}
                  </span>
                  {product.pointPrice && (
                    <span className="text-xs text-purple-500 font-medium">
                      {product.pointPrice.toLocaleString()}pt
                    </span>
                  )}
                </div>
                {product.categoryName && (
                  <p className="text-[11px] text-gray-400 mt-1">{product.categoryName}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button
            variant="outline"
            size="lg"
            className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300 text-base md:text-lg py-5 md:py-6 px-6 md:px-8"
            onClick={() => setLocation("/mall/products")}
          >
            <ShoppingBag className="h-5 w-5" />
            すべての商品を見る
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function MallHome() {
  const [, setLocation] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showReferralPopup, setShowReferralPopup] = useState(false);

  // Show popup once per session on page load
  useEffect(() => {
    const hasSeenPopup = sessionStorage.getItem('lcj_referral_popup_seen');
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setShowReferralPopup(true);
        sessionStorage.setItem('lcj_referral_popup_seen', '1');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // 商品一覧を取得（販売中のもののみ）
  const { data: products, isLoading: productsLoading } = trpc.mall.getProducts.useQuery({ status: "active" });

  const faqs = [
    {
      q: "本当にすべての商品が対象ですか？",
      a: "はい。TikTok Shopで購入した商品であれば、原則すべてがLCJ Mallポイントの対象となります。\n※一部条件・確認事項があります。"
    },
    {
      q: "ポイントはどこで使えますか？",
      a: "LCJモール内の対象店舗・サービスで、1pt＝1円として利用できます。"
    },
    {
      q: "上限はありますか？",
      a: "一部上限があります（詳細は案内をご確認ください）。"
    }
  ];

  const handlePopupAction = () => {
    const hasSession = !!localStorage.getItem('lcj_session_token');
    setShowReferralPopup(false);
    if (hasSession) {
      setLocation('/friend-challenge');
    } else {
      setLocation('/line-login?redirect=/friend-challenge');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 友達招待チャレンジ ポップアップ */}
      <Dialog open={showReferralPopup} onOpenChange={setShowReferralPopup}>
        <DialogContent className="sm:max-w-md p-0 border-0 rounded-3xl overflow-hidden bg-transparent shadow-2xl [&>button]:hidden">
          <div className="relative">
            {/* 背景グラデーション */}
            <div className="bg-gradient-to-br from-pink-400 via-rose-400 to-purple-500 p-6 pb-8 text-center relative overflow-hidden">
              {/* キラキラエフェクト */}
              <div className="absolute top-3 left-6 text-2xl animate-bounce" style={{ animationDelay: '0s' }}>✨</div>
              <div className="absolute top-8 right-8 text-xl animate-bounce" style={{ animationDelay: '0.3s' }}>🌟</div>
              <div className="absolute bottom-4 left-10 text-lg animate-bounce" style={{ animationDelay: '0.6s' }}>🎀</div>
              <div className="absolute bottom-6 right-12 text-2xl animate-bounce" style={{ animationDelay: '0.9s' }}>🌸</div>
              <div className="absolute top-12 left-1/2 text-sm animate-ping opacity-60">⭐</div>
              
              {/* メインアイコン */}
              <div className="relative z-10">
                <div className="h-20 w-20 mx-auto mb-3 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border-2 border-white/30">
                  <span className="text-5xl">🎰</span>
                </div>
                <h2 className="text-2xl font-extrabold text-white mb-1 drop-shadow-md">
                  友達招待チャレンジ
                </h2>
                <p className="text-pink-100 text-sm font-medium">期間限定キャンペーン実施中！</p>
              </div>
            </div>
            
            {/* コンテンツ */}
            <div className="bg-white px-6 py-5 text-center">
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-3">
                  <div className="h-10 w-10 bg-pink-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-lg">🎁</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">友達を招待するたびに</p>
                    <p className="text-xs text-pink-600 font-medium">確定ポイント + ルーレットボーナス！</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-3">
                  <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-lg">🏆</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">ステージが上がるほど</p>
                    <p className="text-xs text-purple-600 font-medium">報酬がどんどんアップ！最大1,000pt✨</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-3">
                  <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-lg">💖</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">招待された友達にも</p>
                    <p className="text-xs text-amber-600 font-medium">50ptプレゼント！みんなハッピー🌸</p>
                  </div>
                </div>
              </div>
              
              {/* CTAボタン */}
              <Button
                onClick={handlePopupAction}
                className="w-full bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 hover:from-pink-600 hover:via-rose-600 hover:to-purple-600 text-white font-bold text-base py-6 rounded-2xl shadow-lg shadow-pink-200/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="mr-2">🎉</span> チャレンジに参加する！
              </Button>
              
              <button
                onClick={() => setShowReferralPopup(false)}
                className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                あとで見る
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header - シンプルで洗練されたデザイン */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => setLocation("/")} style={{ cursor: "pointer" }}>
            <ShoppingBag className="h-6 w-6 md:h-7 md:w-7 text-rose-500" />
            <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              LCJ MALL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              className="bg-rose-500 hover:bg-rose-600 text-white gap-1 text-xs md:text-sm px-3 md:px-4" 
              onClick={() => setLocation("/line-login")}
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">無料ではじめる</span>
              <span className="sm:hidden">登録</span>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO Section - ファーストビュー */}
      <section className="py-12 md:py-20 px-4 bg-gradient-to-b from-rose-50/50 to-white">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 leading-tight">
            <span className="text-gray-900">TikTok Shopで買う。</span>
            <br />
            <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              そのすべてが、価値になる。
            </span>
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-6 md:mb-8 leading-relaxed px-2">
            LCJ Mallは、
            <br className="sm:hidden" />
            TikTok Shopで購入したすべての商品を対象に、
            <br />
            ポイントが貯まり、LCJモールで使える
            <br className="sm:hidden" />
            <span className="font-semibold text-gray-800">LCJ公式ショッピングサービス</span>です。
          </p>
          
          {/* 還元率バッジ */}
          <div className="flex justify-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-5 py-2.5 md:px-6 md:py-3 rounded-full shadow-lg">
              <Coins className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-lg md:text-xl font-bold">購入金額の1%還元</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center px-4">
            <Button 
              size="lg" 
              className="bg-rose-500 hover:bg-rose-600 text-white gap-2 text-base md:text-lg py-6 md:py-7 px-6 md:px-8 shadow-lg hover:shadow-xl transition-all"
              onClick={() => setLocation("/line-login")}
            >
              <UserPlus className="h-5 w-5 md:h-6 md:w-6" />
              無料ではじめる
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2 text-base md:text-lg py-6 md:py-7 px-6 md:px-8 border-2 hover:bg-gray-50"
              onClick={() => setLocation("/mall/products")}
            >
              <ShoppingBag className="h-5 w-5" />
              使える商品を見る
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2 text-base md:text-lg py-6 md:py-7 px-6 md:px-8 border-2 border-rose-200 text-rose-600 hover:bg-rose-50"
              onClick={() => setLocation("/ranking")}
            >
              <TrendingUp className="h-5 w-5" />
              売れ筋ランキング
            </Button>
          </div>
        </div>
      </section>

      {/* 共感ブロック - ワクワクの火種 */}
      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-900">
            "買って終わり"にしない。
          </h2>
          <p className="text-base md:text-lg text-gray-600 leading-relaxed">
            TikTok LIVEで見つけた「欲しい」。
            <br />
            その買い物が、<span className="font-semibold text-rose-500">次に使える価値</span>に変わります。
          </p>
        </div>
      </section>

      {/* How it works - 3ステップ */}
      <section className="py-12 md:py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">使い方は、たった3ステップ</h2>
            <p className="text-gray-500 text-sm md:text-base">How it works</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 md:h-16 md:w-16 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full mb-4 md:mb-6 text-white text-xl md:text-2xl font-bold">
                1
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3">TikTok Shopで購入</h3>
              <p className="text-gray-600 text-sm md:text-base">
                いつも通り、TikTok Shopで商品を購入。
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 md:h-16 md:w-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full mb-4 md:mb-6 text-white text-xl md:text-2xl font-bold">
                2
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3">レシートを送信</h3>
              <p className="text-gray-600 text-sm md:text-base">
                購入後、購入証明（レシート）を
                <br />
                マイページまたはLINEから送信。
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 md:h-16 md:w-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full mb-4 md:mb-6 text-white text-xl md:text-2xl font-bold">
                3
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3">ポイントが貯まる・使える</h3>
              <p className="text-gray-600 text-sm md:text-base">
                内容確認後、<span className="font-semibold text-rose-500">購入金額の1%</span>をポイント付与。
                <br />
                貯まったポイントは、
                <br />
                LCJモール内で<span className="font-semibold text-rose-500">1pt＝1円</span>として使えます。
              </p>
              <div className="mt-4 bg-rose-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">例：10,000円の購入で</p>
                <p className="text-xl font-bold text-rose-500">100pt 獲得！</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ベネフィットブロック */}
      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 md:mb-10 text-center">
            LCJ Mallがうれしい理由
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
            <div className="flex items-start gap-3 md:gap-4 p-4 md:p-5 bg-rose-50 rounded-xl">
              <div className="h-8 w-8 md:h-10 md:w-10 bg-rose-500 rounded-full flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm md:text-base">買い方はいつも通り</h3>
                <p className="text-gray-600 text-xs md:text-sm">TikTok Shopで購入</p>
              </div>
            </div>
            <div className="flex items-start gap-3 md:gap-4 p-4 md:p-5 bg-pink-50 rounded-xl">
              <div className="h-8 w-8 md:h-10 md:w-10 bg-pink-500 rounded-full flex items-center justify-center shrink-0">
                <Receipt className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm md:text-base">レシートを送るだけ</h3>
                <p className="text-gray-600 text-xs md:text-sm">購入金額の<span className="font-semibold text-rose-500">1%</span>がポイントに</p>
              </div>
            </div>
            <div className="flex items-start gap-3 md:gap-4 p-4 md:p-5 bg-purple-50 rounded-xl">
              <div className="h-8 w-8 md:h-10 md:w-10 bg-purple-500 rounded-full flex items-center justify-center shrink-0">
                <Coins className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm md:text-base">1pt＝1円</h3>
                <p className="text-gray-600 text-xs md:text-sm">計算いらずで使える</p>
              </div>
            </div>
            <div className="flex items-start gap-3 md:gap-4 p-4 md:p-5 bg-indigo-50 rounded-xl">
              <div className="h-8 w-8 md:h-10 md:w-10 bg-indigo-500 rounded-full flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm md:text-base">LCJ公式サービス</h3>
                <p className="text-gray-600 text-xs md:text-sm">だから安心</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 売れ筋ランキング プレビュー */}
      <section className="py-12 md:py-20 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-rose-500" />
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">売れ筋ランキング</h2>
            </div>
            <p className="text-gray-500 text-sm md:text-base">TikTok Shopで今売れている商品をチェック</p>
          </div>

          <RankingPreviewTabs />

          <div className="text-center mt-8">
            <Button
              size="lg"
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white gap-2 text-base md:text-lg py-5 md:py-6 px-6 md:px-8 shadow-lg hover:shadow-xl transition-all"
              onClick={() => setLocation("/ranking")}
            >
              <TrendingUp className="h-5 w-5" />
              ランキングをもっと見る
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* 友達招待チャレンジバナー */}
      <section className="py-8 md:py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div
            onClick={() => setLocation("/friend-challenge")}
            className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-2xl p-5 md:p-8 text-white cursor-pointer hover:shadow-xl transition-all relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-12 translate-x-12 group-hover:scale-110 transition-transform" />
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/10 rounded-full translate-y-8 -translate-x-8 group-hover:scale-110 transition-transform" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="h-14 w-14 md:h-16 md:w-16 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <span className="text-3xl md:text-4xl">🎰</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl md:text-2xl font-bold mb-1">友達招待チャレンジ 🎉</h3>
                <p className="text-pink-100 text-sm md:text-base">友達を招待してルーレットを回そう！ポイントがどんどん貯まる✨</p>
              </div>
              <ArrowRight className="h-6 w-6 text-white/80 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        </div>
      </section>

      {/* おすすめ商品セクション */}
      <RecommendedSection />

      {/* すべて対象ブロック */}
      <section className="py-12 md:py-16 px-4 bg-gradient-to-b from-rose-50 to-white">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="bg-white rounded-2xl p-6 md:p-10 shadow-lg border border-rose-100">
            <div className="inline-flex items-center justify-center h-14 w-14 md:h-16 md:w-16 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full mb-4 md:mb-6">
              <Sparkles className="h-7 w-7 md:h-8 md:w-8 text-white" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-gray-900">
              TikTok Shopで買ったなら、OK。
            </h2>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              原則として、TikTok Shopで購入したすべての商品が
              <br />
              LCJ Mallポイントの対象です。
            </p>
            <p className="text-xs md:text-sm text-gray-400 mt-3 md:mt-4">
              ※一部条件・確認事項があります。
            </p>
          </div>
        </div>
      </section>

      {/* 商品導線ブロック */}
      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">
            ポイントが使える商品を見てみる
          </h2>
          <Button 
            size="lg" 
            className="bg-rose-500 hover:bg-rose-600 text-white gap-2 text-base md:text-lg py-5 md:py-6 px-6 md:px-8"
            onClick={() => setLocation("/mall/products")}
          >
            <ShoppingBag className="h-5 w-5" />
            使える商品を見る
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* 信頼ブロック */}
      <section className="py-10 md:py-12 px-4 bg-gray-50">
        <div className="container mx-auto max-w-3xl">
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 text-xs md:text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gray-400" />
              <span>LCJ公式ショッピングサービス</span>
            </div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-gray-400" />
              <span>購入証明に基づくポイント付与</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-gray-400" />
              <span>不正防止・確認体制あり</span>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4 md:mt-6">
            ※本サービスはLCJが独自に運営しています。
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-center justify-center gap-2 mb-8 md:mb-10">
            <HelpCircle className="h-5 w-5 md:h-6 md:w-6 text-gray-400" />
            <h2 className="text-xl md:text-2xl font-bold">よくある質問</h2>
          </div>
          <div className="space-y-3 md:space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  className="w-full px-4 md:px-6 py-4 md:py-5 flex items-center justify-between text-left bg-white hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span className="font-medium text-gray-900 text-sm md:text-base pr-4">Q. {faq.q}</span>
                  {openFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-4 md:px-6 py-4 md:py-5 bg-gray-50 border-t border-gray-200">
                    <p className="text-gray-600 text-sm md:text-base whitespace-pre-line">
                      A. {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 最終CTA */}
      <section className="py-12 md:py-16 px-4 bg-gradient-to-b from-white to-rose-50">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900">
            今すぐ始めよう
          </h2>
          <p className="text-gray-600 mb-6 md:mb-8 text-sm md:text-base">
            TikTok Shopでのお買い物を、もっとお得に。
          </p>
          <Button 
            size="lg" 
            className="bg-rose-500 hover:bg-rose-600 text-white gap-2 text-base md:text-lg py-6 md:py-7 px-8 md:px-10 shadow-lg hover:shadow-xl transition-all"
            onClick={() => setLocation("/line-login")}
          >
            <UserPlus className="h-5 w-5 md:h-6 md:w-6" />
            無料ではじめる
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 md:py-8 px-4 bg-gray-900 text-white">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3 md:mb-4">
            <ShoppingBag className="h-5 w-5 md:h-6 md:w-6 text-rose-400" />
            <span className="text-base md:text-lg font-bold">LCJ MALL</span>
          </div>
          <div className="flex items-center justify-center gap-4 mb-3 text-xs md:text-sm text-gray-400">
            <Link href="/mall/products" className="hover:text-white transition-colors">商品一覧</Link>
            <Link href="/ranking" className="hover:text-white transition-colors">売れ筋ランキング</Link>
            <Link href="/legal/tokushoho" className="hover:text-white transition-colors">特定商取引法</Link>
            <Link href="/legal/privacy" className="hover:text-white transition-colors">プライバシーポリシー</Link>
          </div>
          <p className="text-xs md:text-sm text-gray-400">
            © 2024 LCJ MALL. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
