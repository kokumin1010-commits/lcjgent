import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Gift, Video, Star, ArrowRight, Coins, Receipt, Users, Sparkles, Tag, ShoppingCart } from "lucide-react";
import { useLocation } from "wouter";

export default function MallHome() {
  const [, setLocation] = useLocation();
  
  // 商品一覧を取得（販売中のもののみ）
  const { data: products, isLoading: productsLoading } = trpc.mall.getProducts.useQuery({ status: "active" });

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-8 w-8 text-rose-500" />
            <span className="text-xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              LCJ MALL
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              特徴
            </a>
            <a href="#products" className="text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors">
              商品一覧
            </a>
            <a href="#points" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ポイント
            </a>
            <a href="#livestream" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ライブコマース
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-[#06C755] hover:bg-[#05b04c] text-white gap-1" onClick={() => setLocation("/line-login")}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              LINEでログイン
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Gift className="h-4 w-4" />
            ライブコマースでお得にショッピング
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              LCJ MALL
            </span>
            <br />
            <span className="text-foreground">ライブコマースの新しい形</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            ライブ配信で商品を見て、購入して、レシートを送るだけでポイントが貯まる。
            貯まったポイントはLCJ MALLでのお買い物に使えます。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-rose-500 hover:bg-rose-600 gap-2">
              <Video className="h-5 w-5" />
              ライブ配信を見る
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={() => setLocation("/livers")}>
              <Users className="h-5 w-5" />
              ライバー一覧
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">LCJ MALLの特徴</h2>
            <p className="text-muted-foreground">ライブコマースとポイントシステムで、お得にショッピング</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-rose-100 hover:border-rose-200 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 bg-rose-100 rounded-lg flex items-center justify-center mb-4">
                  <Video className="h-6 w-6 text-rose-500" />
                </div>
                <CardTitle>ライブコマース</CardTitle>
                <CardDescription>
                  人気ライバーによるライブ配信で、商品の魅力をリアルタイムでお届け
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-pink-100 hover:border-pink-200 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
                  <Receipt className="h-6 w-6 text-pink-500" />
                </div>
                <CardTitle>レシートでポイント</CardTitle>
                <CardDescription>
                  購入後のレシートをLINEで送信するだけで、購入金額の1%がポイントに
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-purple-100 hover:border-purple-200 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Coins className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>ポイントでお買い物</CardTitle>
                <CardDescription>
                  貯まったポイントはLCJ MALLでのお買い物に1ポイント=1円として利用可能
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Points Section */}
      <section id="points" className="py-20 px-4 bg-gradient-to-b from-rose-50 to-white">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                レシートを送るだけで
                <br />
                <span className="text-rose-500">ポイントが貯まる</span>
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-rose-500 font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">ライブコマースで商品を購入</h3>
                    <p className="text-sm text-muted-foreground">お気に入りのライバーの配信から商品を購入</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 bg-pink-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-pink-500 font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">レシートをLINEで送信</h3>
                    <p className="text-sm text-muted-foreground">購入後7日以内にレシート画像をLINEで送信</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-purple-500 font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">ポイントを獲得</h3>
                    <p className="text-sm text-muted-foreground">承認後、購入金額の1%がポイントとして付与</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8 border">
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-20 w-20 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full mb-4">
                  <Star className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2">1%還元</h3>
                <p className="text-muted-foreground mb-6">購入金額の1%がポイントに</p>
                <div className="bg-rose-50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">例：10,000円の購入で</p>
                  <p className="text-3xl font-bold text-rose-500">100ポイント</p>
                  <p className="text-sm text-muted-foreground">獲得！</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 商品一覧セクション - ワクワク感のあるデザイン */}
      <section id="products" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              今すぐ購入可能
            </div>
            <h2 className="text-3xl font-bold mb-4">人気商品ラインナップ</h2>
            <p className="text-muted-foreground">ポイントでも購入できるお得な商品</p>
          </div>
          
          {productsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-rose-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">商品を読み込み中...</p>
            </div>
          ) : products && products.length > 0 ? (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.slice(0, 8).map((product) => (
                  <Card 
                    key={product.id} 
                    className="group cursor-pointer overflow-hidden border-2 hover:border-rose-300 hover:shadow-xl transition-all duration-300"
                    onClick={() => setLocation(`/mall/products/${product.id}`)}
                  >
                    <div className="relative aspect-square bg-gradient-to-br from-rose-50 to-pink-50 overflow-hidden">
                      {product.imageUrl ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-16 w-16 text-rose-200" />
                        </div>
                      )}
                      {product.pointPrice && (
                        <Badge className="absolute top-3 left-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                          <Coins className="h-3 w-3 mr-1" />
                          ポイント対応
                        </Badge>
                      )}
                      {product.stock <= 5 && product.stock > 0 && (
                        <Badge variant="destructive" className="absolute top-3 right-3">
                          残り{product.stock}点
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">{product.category || "カテゴリなし"}</p>
                      <h3 className="font-semibold text-lg mb-3 line-clamp-2 group-hover:text-rose-500 transition-colors">
                        {product.name}
                      </h3>
                      <div className="space-y-2">
                        {/* 販売価格 */}
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-gray-400" />
                          <span className="text-xl font-bold text-gray-900">¥{product.price.toLocaleString()}</span>
                        </div>
                        {/* ポイント交換価格 */}
                        {product.pointPrice && (
                          <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-pink-50 px-3 py-2 rounded-lg">
                            <Coins className="h-4 w-4 text-purple-500" />
                            <span className="text-lg font-bold text-purple-600">{product.pointPrice.toLocaleString()}</span>
                            <span className="text-sm text-purple-500">ポイントで交換</span>
                          </div>
                        )}
                      </div>
                      <Button 
                        className="w-full mt-4 bg-rose-500 hover:bg-rose-600 gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/mall/products/${product.id}`);
                        }}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        詳細を見る
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {products.length > 8 && (
                <div className="text-center mt-10">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="gap-2 border-rose-300 text-rose-600 hover:bg-rose-50"
                    onClick={() => setLocation("/mall/products")}
                  >
                    すべての商品を見る
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-gray-200 mx-auto mb-4" />
              <p className="text-muted-foreground">現在販売中の商品はありません</p>
            </div>
          )}
        </div>
      </section>

      {/* Livestream Section */}
      <section id="livestream" className="py-20 px-4 bg-gradient-to-b from-rose-50 to-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">人気ライバーの配信をチェック</h2>
          <p className="text-muted-foreground mb-8">毎日様々なライバーが商品を紹介しています</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="outline" className="gap-2" onClick={() => setLocation("/livers")}>
              <Users className="h-5 w-5" />
              ライバー一覧を見る
            </Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={() => setLocation("/s")}>
              <Video className="h-5 w-5" />
              配信スケジュール
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-rose-500 to-pink-500">
        <div className="container mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">今すぐ始めよう</h2>
          <p className="text-rose-100 mb-8 max-w-xl mx-auto">
            LINEでLCJ公式アカウントを友だち追加して、レシートを送るだけ。
            簡単にポイントが貯まります。
          </p>
          <a href="https://lin.ee/hpVjAiOe" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="secondary" className="gap-2">
              <Gift className="h-5 w-5" />
              LINE友だち追加
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-rose-400" />
              <span className="text-lg font-bold text-white">LCJ MALL</span>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">利用規約</a>
              <a href="#" className="hover:text-white transition-colors">プライバシーポリシー</a>
              <a href="#" className="hover:text-white transition-colors">特定商取引法に基づく表記</a>
            </div>
            <p className="text-sm">© 2025 LCJ MALL. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
