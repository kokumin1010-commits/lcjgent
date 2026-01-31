import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, Gift, Video, Star, ArrowRight, Coins, Receipt, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function MallHome() {
  const [, setLocation] = useLocation();

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
            <a href="#points" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ポイント
            </a>
            <a href="#livestream" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ライブコマース
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/login")}>
              ログイン
            </Button>
            <Button size="sm" className="bg-rose-500 hover:bg-rose-600" onClick={() => setLocation("/master")}>
              管理画面
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

      {/* Livestream Section */}
      <section id="livestream" className="py-20 px-4 bg-white">
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
          <Button size="lg" variant="secondary" className="gap-2">
            <Gift className="h-5 w-5" />
            LINE友だち追加
          </Button>
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
