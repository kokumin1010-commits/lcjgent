import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { usePageSEO } from "@/hooks/usePageSEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Gift, ArrowRight, Coins, Receipt, Check, ChevronDown, ChevronUp, ShieldCheck, HelpCircle, Sparkles, MessageCircle, UserPlus, TrendingUp, Crown, Medal, Award, Flame, Heart, Star, X, User, MessageSquare, WalletCards } from "lucide-react";
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

  usePageSEO({
    title: "LCJ MALL - TikTok Shopで買う。そのすべてが、価値になる。",
    description: "LCJ Mallの会員向けショッピングサービスです。公式ポイント残高はBeauty Walletで一元管理し、LCJの旧記録は照合用として表示します。",
    canonical: window.location.origin,
    ogType: "website",
    keywords: "LCJ MALL, lcjモール, TikTok Shop, ライブコマース, Beauty Wallet, 美容, シャンプー, KYOGOKU",
  });

  // ログイン状態を確認
  const { data: lineUser } = trpc.lineLogin.me.useQuery();
  const isLoggedIn = !!lineUser;

  // 商品一覧を取得（販売中のもののみ）
  const { data: products, isLoading: productsLoading } = trpc.mall.getProducts.useQuery({ status: "active" });

  const faqs = [
    {
      q: "本当にすべての商品が対象ですか？",
      a: "購入履歴や旧LCJポイント記録は照合用に保持されます。新たなポイント付与の対象・条件は、Beauty Walletの正式な案内をご確認ください。"
    },
    {
      q: "ポイントはどこで使えますか？",
      a: "公式残高と利用履歴はBeauty Walletで確認できます。LCJ側の旧残高は現在、決済には利用できません。"
    },
    {
      q: "上限はありますか？",
      a: "Beauty Walletの最新の利用条件をご確認ください。"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
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
            {isLoggedIn ? (
              <Button 
                size="sm" 
                className="bg-rose-500 hover:bg-rose-600 text-white gap-1 text-xs md:text-sm px-3 md:px-4" 
                onClick={() => setLocation("/mypage")}
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">マイページ</span>
                <span className="sm:hidden">マイページ</span>
              </Button>
            ) : (
              <Button 
                size="sm" 
                className="bg-rose-500 hover:bg-rose-600 text-white gap-1 text-xs md:text-sm px-3 md:px-4" 
                onClick={() => setLocation("/line-login")}
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">無料ではじめる</span>
                <span className="sm:hidden">登録</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* リクルートバナー */}
      <Link
        href="/recruit"
        className="block w-full bg-gradient-to-r from-amber-900 via-yellow-800 to-amber-900 text-white py-2.5 px-4 text-center hover:brightness-110 transition-all cursor-pointer no-underline"
      >
        <div className="container mx-auto flex items-center justify-center gap-2 text-sm md:text-base">
          <span className="text-amber-300 font-bold">【限定】</span>
          <span>お祝い金</span>
          <span className="text-amber-300 font-extrabold text-base md:text-lg">10万円</span>
          <span className="hidden sm:inline">！日本最大級のライブコマース事務所が仲間を募集中</span>
          <span className="sm:hidden">！ライバー募集中</span>
          <ArrowRight className="h-4 w-4 ml-1 text-amber-300 animate-pulse" />
        </div>
      </Link>

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
            LCJ Mallの公式ポイント残高は
            <span className="font-semibold text-gray-800">Beauty Wallet</span>で一元管理します。
            <br />
            LCJ側の旧ポイント記録は、照合用の履歴として安全に保持されます。
          </p>
          
          <div className="flex justify-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-5 py-2.5 md:px-6 md:py-3 rounded-full shadow-lg">
              <Coins className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-lg md:text-xl font-bold">Beauty Walletが唯一の公式残高</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center px-4">
            {isLoggedIn ? (
              <Button 
                size="lg" 
                className="bg-rose-500 hover:bg-rose-600 text-white gap-2 text-base md:text-lg py-6 md:py-7 px-6 md:px-8 shadow-lg hover:shadow-xl transition-all"
                onClick={() => setLocation("/mypage")}
              >
                <User className="h-5 w-5 md:h-6 md:w-6" />
                マイページへ
              </Button>
            ) : (
              <Button 
                size="lg" 
                className="bg-rose-500 hover:bg-rose-600 text-white gap-2 text-base md:text-lg py-6 md:py-7 px-6 md:px-8 shadow-lg hover:shadow-xl transition-all"
                onClick={() => setLocation("/line-login")}
              >
                <UserPlus className="h-5 w-5 md:h-6 md:w-6" />
                無料ではじめる
              </Button>
            )}
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2 text-base md:text-lg py-6 md:py-7 px-6 md:px-8 border-2 hover:bg-gray-50"
              onClick={() => setLocation("/mall/products")}
            >
              <ShoppingBag className="h-5 w-5" />
              商品を見る
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
              <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3">Beauty Walletを確認</h3>
              <p className="text-gray-600 text-sm md:text-base">
                メール認証でBeauty Walletを安全に連携し、
                <br />
                公式の統合残高と履歴を確認します。
              </p>
              <div className="mt-4 bg-rose-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">旧LCJ記録は自動合算しません</p>
                <p className="text-base font-bold text-rose-500">本人確認後に安全に照合</p>
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
                <p className="text-gray-600 text-xs md:text-sm">購入証明を照合記録として保存</p>
              </div>
            </div>
            <div className="flex items-start gap-3 md:gap-4 p-4 md:p-5 bg-purple-50 rounded-xl">
              <div className="h-8 w-8 md:h-10 md:w-10 bg-purple-500 rounded-full flex items-center justify-center shrink-0">
                <Coins className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm md:text-base">公式残高を一元管理</h3>
                <p className="text-gray-600 text-xs md:text-sm">Beauty Walletで確認</p>
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

      {/* Beauty Wallet self-service link banner */}
      <section className="py-8 md:py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div
            onClick={() => setLocation("/beauty-wallet")}
            className="rounded-2xl p-5 md:p-8 text-white cursor-pointer hover:shadow-xl transition-all relative overflow-hidden group"
            style={{ background: 'linear-gradient(135deg, #b91c1c, #dc2626, #ef4444, #dc2626, #b91c1c)', border: '2px solid #fbbf24', boxShadow: '0 0 30px rgba(255,180,0,0.15)' }}
          >
            <div className="absolute top-2 left-4 text-xl animate-bounce">✨</div>
            <div className="absolute top-3 right-6 text-lg animate-bounce" style={{ animationDelay: '0.3s' }}>⭐</div>
            <div className="absolute bottom-3 left-8 text-sm animate-bounce" style={{ animationDelay: '0.6s' }}>💫</div>
            <div className="absolute bottom-2 right-4 text-xl animate-bounce" style={{ animationDelay: '0.9s' }}>🌟</div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="h-14 w-14 md:h-16 md:w-16 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: '2px solid #fde68a', boxShadow: '0 0 15px rgba(251,191,36,0.3)' }}>
                <WalletCards className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl md:text-2xl font-black mb-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Beauty Walletを連携</h3>
                <p className="text-yellow-200 text-sm md:text-base font-bold">メール認証で公式の統合残高を確認</p>
              </div>
              <ArrowRight className="h-6 w-6 text-yellow-300 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        </div>
      </section>

      {/* リアル口コミDB セクション */}
      <section className="py-10 md:py-14 px-4 bg-gradient-to-b from-pink-50/50 to-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-6 md:mb-8">
            <div className="inline-flex items-center gap-2 bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs font-bold mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              購入証明付き
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">リアル口コミ DB</h2>
            <p className="text-gray-500 text-sm md:text-base mt-2">レシートがある人だけが書ける、100%リアルな口コミ</p>
          </div>
          <div
            onClick={() => setLocation("/reviews")}
            className="bg-white rounded-2xl p-5 md:p-8 shadow-lg border border-pink-100 cursor-pointer hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shrink-0">
                <MessageSquare className="h-6 w-6 md:h-7 md:w-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg md:text-xl font-bold text-gray-900">TikTokでバズってるアレ、本当に良い？</h3>
                <p className="text-gray-500 text-xs md:text-sm">ステマゼロ。実際に買った人のリアルな声だけ</p>
              </div>
              <ArrowRight className="h-5 w-5 text-pink-400 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-pink-50 rounded-xl p-3">
                <div className="text-xs text-gray-500">信頼度</div>
                <div className="text-lg font-bold text-pink-600">100%</div>
                <div className="text-[10px] text-gray-400">購入証明済</div>
              </div>
              <div className="bg-pink-50 rounded-xl p-3">
                <div className="text-xs text-gray-500">ステマ</div>
                <div className="text-lg font-bold text-pink-600">0件</div>
                <div className="text-[10px] text-gray-400">企業案件なし</div>
              </div>
              <div className="bg-pink-50 rounded-xl p-3">
                <div className="text-xs text-gray-500">AI監視</div>
                <div className="text-lg font-bold text-pink-600">24h</div>
                <div className="text-[10px] text-gray-400">不正自動検知</div>
              </div>
            </div>
          </div>
          <div className="text-center mt-6">
            <Button
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white gap-2 text-base md:text-lg py-5 md:py-6 px-6 md:px-8 shadow-lg hover:shadow-xl transition-all"
              onClick={() => setLocation("/reviews")}
            >
              <MessageSquare className="h-5 w-5" />
              口コミを見る
              <ArrowRight className="h-4 w-4" />
            </Button>
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
              購入履歴と旧LCJポイント記録は
              <br />
              照合用の監査記録として保持されます。
            </p>
            <p className="text-xs md:text-sm text-gray-400 mt-3 md:mt-4">
              ※旧残高をBeauty Walletへ自動合算・自動移行することはありません。
            </p>
          </div>
        </div>
      </section>

      {/* 商品導線ブロック */}
      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">
            商品を見てみる
          </h2>
          <Button 
            size="lg" 
            className="bg-rose-500 hover:bg-rose-600 text-white gap-2 text-base md:text-lg py-5 md:py-6 px-6 md:px-8"
            onClick={() => setLocation("/mall/products")}
          >
            <ShoppingBag className="h-5 w-5" />
            商品を見る
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
              <span>購入証明を照合用に記録</span>
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
            {isLoggedIn ? "Beauty Walletを確認しよう" : "今すぐ始めよう"}
          </h2>
          <p className="text-gray-600 mb-6 md:mb-8 text-sm md:text-base">
            TikTok Shopでのお買い物を、もっとお得に。
          </p>
          {isLoggedIn ? (
            <Button 
              size="lg" 
              className="bg-rose-500 hover:bg-rose-600 text-white gap-2 text-base md:text-lg py-6 md:py-7 px-8 md:px-10 shadow-lg hover:shadow-xl transition-all"
              onClick={() => setLocation("/beauty-wallet")}
            >
              <WalletCards className="h-5 w-5 md:h-6 md:w-6" />
              Beauty Walletを開く
            </Button>
          ) : (
            <Button 
              size="lg" 
              className="bg-rose-500 hover:bg-rose-600 text-white gap-2 text-base md:text-lg py-6 md:py-7 px-8 md:px-10 shadow-lg hover:shadow-xl transition-all"
              onClick={() => setLocation("/line-login")}
            >
              <UserPlus className="h-5 w-5 md:h-6 md:w-6" />
              無料ではじめる
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 md:py-8 px-4 bg-gray-900 text-white">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3 md:mb-4">
            <ShoppingBag className="h-5 w-5 md:h-6 md:w-6 text-rose-400" />
            <span className="text-base md:text-lg font-bold">LCJ MALL</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-3 text-xs md:text-sm text-gray-400">
            <Link href="/mall/products" className="hover:text-white transition-colors">商品一覧</Link>
            <Link href="/ranking" className="hover:text-white transition-colors">売れ筋ランキング</Link>
            <Link href="/reviews" className="hover:text-white transition-colors">口コミDB</Link>
            <Link href="/blog" className="hover:text-white transition-colors">ブログ</Link>
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
