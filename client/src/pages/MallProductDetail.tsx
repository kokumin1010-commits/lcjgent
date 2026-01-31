import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  ShoppingCart, 
  ArrowLeft, 
  Package, 
  Star, 
  Check, 
  Coins, 
  Truck, 
  Shield, 
  Gift, 
  ChevronRight,
  Heart,
  Share2,
  Minus,
  Plus,
  Sparkles,
  Clock,
  CheckCircle2
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";

type PaymentMethod = "cash" | "points";

export default function MallProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("points");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);

  const { data: product, isLoading } = trpc.mall.getProductById.useQuery(
    { id: Number(id) },
    { enabled: !!id }
  );

  // 関連商品を取得
  const { data: relatedProducts } = trpc.mall.getProducts.useQuery(
    { status: "active", limit: 4 },
    { enabled: !!product }
  );

  // LINEユーザー情報を取得（ポイント残高確認用）
  const { data: lineUser } = trpc.lineLogin.me.useQuery();

  const purchaseWithPoints = trpc.mall.purchaseWithPoints.useMutation({
    onSuccess: () => {
      toast.success("購入が完了しました！", {
        description: "マイページで購入履歴を確認できます",
      });
      setIsPurchaseDialogOpen(false);
      setLocation("/mypage");
    },
    onError: (error) => {
      toast.error(error.message || "購入に失敗しました");
    },
  });

  const handlePurchase = async () => {
    if (!product) return;

    if (paymentMethod === "points") {
      if (!lineUser) {
        toast.error("ポイント購入にはLINEログインが必要です");
        setLocation("/line-login");
        return;
      }

      if (!product.pointPrice) {
        toast.error("この商品はポイント購入に対応していません");
        return;
      }

      setIsPurchasing(true);
      try {
        await purchaseWithPoints.mutateAsync({
          productId: product.id,
          quantity: quantity,
        });
      } finally {
        setIsPurchasing(false);
      }
    } else {
      toast.info("現金決済は準備中です。ポイント購入をご利用ください。");
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: product?.name || '',
        text: product?.description || '',
        url: window.location.href,
      });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success("リンクをコピーしました");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">商品を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Package className="h-20 w-20 text-gray-300 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">商品が見つかりません</h3>
          <p className="text-muted-foreground mb-6">お探しの商品は存在しないか、削除された可能性があります</p>
          <Link href="/mall/products">
            <Button className="bg-gradient-to-r from-pink-500 to-rose-500">
              <ArrowLeft className="h-4 w-4 mr-2" />
              商品一覧に戻る
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const canPurchaseWithPoints = lineUser && product.pointPrice && lineUser.points >= (product.pointPrice * quantity);
  const totalPointPrice = product.pointPrice ? product.pointPrice * quantity : 0;
  const totalCashPrice = product.price * quantity;

  // 関連商品（現在の商品を除く）
  const filteredRelatedProducts = relatedProducts?.filter(p => p.id !== product.id).slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-pink-50/30">
      {/* ヘッダー */}
      <header className="bg-white/90 backdrop-blur-md border-b border-pink-100 sticky top-0 z-50 shadow-sm">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/mall/products" className="flex items-center gap-2 text-gray-600 hover:text-pink-500 transition-colors">
                <ArrowLeft className="h-5 w-5" />
                <span className="hidden sm:inline">戻る</span>
              </Link>
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                  LCJ MALL
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {lineUser && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-50 to-orange-50 px-3 py-1.5 rounded-full border border-yellow-200">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="font-bold text-yellow-700">{lineUser.points.toLocaleString()}</span>
                  <span className="text-xs text-yellow-600">pt</span>
                </div>
              )}
              <Link href="/mypage">
                <Button variant="outline" size="sm" className="border-pink-200 hover:bg-pink-50">
                  マイページ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 md:py-10">
        {/* パンくずリスト */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-pink-500">ホーム</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/mall/products" className="hover:text-pink-500">商品一覧</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* 商品画像セクション */}
          <div className="space-y-4">
            <div className="aspect-square relative overflow-hidden bg-white rounded-3xl shadow-xl border border-pink-100 group">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                  <Package className="h-32 w-32 text-gray-300 mb-4" />
                  <p className="text-gray-400">画像準備中</p>
                </div>
              )}
              
              {/* 売り切れオーバーレイ */}
              {product.stock === 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <Badge variant="destructive" className="text-2xl py-3 px-8 mb-2">
                      SOLD OUT
                    </Badge>
                    <p className="text-white/80">売り切れ</p>
                  </div>
                </div>
              )}

              {/* お気に入り・シェアボタン */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className={`rounded-full shadow-lg ${isFavorite ? 'bg-pink-500 text-white hover:bg-pink-600' : 'bg-white/90 hover:bg-white'}`}
                  onClick={() => setIsFavorite(!isFavorite)}
                >
                  <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full bg-white/90 hover:bg-white shadow-lg"
                  onClick={handleShare}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>

              {/* ポイント対応バッジ */}
              {product.pointPrice && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-lg py-1.5 px-3">
                    <Sparkles className="h-4 w-4 mr-1" />
                    ポイント交換OK
                  </Badge>
                </div>
              )}
            </div>

            {/* 特典バナー */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
                <Truck className="h-6 w-6 text-pink-500 mx-auto mb-1" />
                <p className="text-xs font-medium">送料無料</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
                <Shield className="h-6 w-6 text-green-500 mx-auto mb-1" />
                <p className="text-xs font-medium">品質保証</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
                <Gift className="h-6 w-6 text-purple-500 mx-auto mb-1" />
                <p className="text-xs font-medium">ギフト対応</p>
              </div>
            </div>
          </div>

          {/* 商品情報セクション */}
          <div className="space-y-6">
            {/* カテゴリ */}
            {product.category && (
              <Badge variant="outline" className="text-sm border-pink-200 text-pink-600">
                {product.category}
              </Badge>
            )}

            {/* 商品名 */}
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{product.name}</h1>

            {/* 商品説明 */}
            {product.description && (
              <p className="text-muted-foreground leading-relaxed text-lg">
                {product.description}
              </p>
            )}

            {/* 価格カード */}
            <Card className="border-2 border-pink-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3">
                <p className="text-white/90 text-sm font-medium">お買い得価格</p>
              </div>
              <CardContent className="p-6 space-y-5">
                {/* 価格表示 */}
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">販売価格</p>
                    <p className="text-4xl md:text-5xl font-bold text-pink-600">
                      ¥{product.price.toLocaleString()}
                    </p>
                  </div>
                  {product.pointPrice && (
                    <div className="flex items-center gap-2 pb-2">
                      <span className="text-muted-foreground">または</span>
                      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-full px-4 py-2 flex items-center gap-1 shadow-md">
                        <Coins className="h-5 w-5" />
                        <span className="text-xl font-bold">{product.pointPrice.toLocaleString()}</span>
                        <span className="text-sm">pt</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 在庫状況 */}
                <div className="flex items-center gap-3">
                  {product.stock > 0 ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-green-600 font-semibold">在庫あり</span>
                      <span className="text-muted-foreground">（残り{product.stock}点）</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 text-red-500" />
                      <span className="text-red-600 font-semibold">在庫切れ</span>
                    </>
                  )}
                </div>

                {/* 数量選択 */}
                {product.stock > 0 && (
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">数量:</span>
                    <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-bold">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                        disabled={quantity >= product.stock}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* 購入ボタン */}
                {product.stock > 0 && (
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-lg py-7 rounded-xl shadow-lg hover:shadow-xl transition-all"
                    onClick={() => setIsPurchaseDialogOpen(true)}
                  >
                    <ShoppingCart className="h-6 w-6 mr-2" />
                    今すぐ購入する
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* ポイント購入の案内 */}
            {product.pointPrice && (
              <Card className="bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 border-yellow-200 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-400 p-3 rounded-xl shadow-md">
                      <Coins className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg mb-1">ポイントでお得に購入！</p>
                      <p className="text-muted-foreground text-sm mb-3">
                        この商品は<span className="font-bold text-orange-600">{product.pointPrice.toLocaleString()}ポイント</span>で購入できます。
                        レシートを送るだけでポイントが貯まります！
                      </p>
                      {!lineUser ? (
                        <Link href="/line-login">
                          <Button className="bg-[#06C755] hover:bg-[#05b34c] text-white">
                            LINEでログインしてポイントを使う
                          </Button>
                        </Link>
                      ) : lineUser.points >= product.pointPrice ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-semibold">ポイントで購入可能です！</span>
                        </div>
                      ) : (
                        <p className="text-sm text-orange-600">
                          あと<span className="font-bold">{(product.pointPrice - lineUser.points).toLocaleString()}</span>ポイントで購入できます
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 関連商品 */}
        {filteredRelatedProducts && filteredRelatedProducts.length > 0 && (
          <section className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">その他のおすすめ商品</h2>
              <Link href="/mall/products">
                <Button variant="ghost" className="text-pink-500 hover:text-pink-600">
                  すべて見る
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRelatedProducts.map((relatedProduct) => (
                <Link key={relatedProduct.id} href={`/mall/products/${relatedProduct.id}`}>
                  <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border-pink-100">
                    <div className="aspect-square relative overflow-hidden bg-gray-50">
                      {relatedProduct.imageUrl ? (
                        <img
                          src={relatedProduct.imageUrl}
                          alt={relatedProduct.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-16 w-16 text-gray-300" />
                        </div>
                      )}
                      {relatedProduct.pointPrice && (
                        <Badge className="absolute top-3 left-3 bg-gradient-to-r from-yellow-400 to-orange-400">
                          <Coins className="h-3 w-3 mr-1" />
                          {relatedProduct.pointPrice}pt
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2 line-clamp-1 group-hover:text-pink-500 transition-colors">
                        {relatedProduct.name}
                      </h3>
                      <p className="text-xl font-bold text-pink-600">
                        ¥{relatedProduct.price.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 購入ダイアログ */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">購入方法を選択</DialogTitle>
            <DialogDescription>
              {product.name} × {quantity}点
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <div className="space-y-3">
                {/* ポイント購入を先に表示 */}
                {product.pointPrice && (
                  <Label
                    htmlFor="points"
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      paymentMethod === "points" 
                        ? "border-pink-500 bg-gradient-to-r from-pink-50 to-rose-50 shadow-md" 
                        : "border-gray-200 hover:border-pink-200 hover:bg-pink-50/50"
                    } ${!lineUser ? "opacity-60" : ""}`}
                  >
                    <RadioGroupItem value="points" id="points" disabled={!lineUser} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Coins className="h-5 w-5 text-yellow-500" />
                        <p className="font-bold">ポイントで購入</p>
                        {canPurchaseWithPoints && (
                          <Badge className="bg-green-500 text-xs">おすすめ</Badge>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-orange-600">
                        {totalPointPrice.toLocaleString()}pt
                      </p>
                      {lineUser && (
                        <p className="text-sm text-muted-foreground mt-1">
                          残高: {lineUser.points.toLocaleString()}pt
                          {canPurchaseWithPoints ? (
                            <span className="text-green-600 ml-2">→ 購入後: {(lineUser.points - totalPointPrice).toLocaleString()}pt</span>
                          ) : (
                            <span className="text-red-500 ml-2">（{(totalPointPrice - lineUser.points).toLocaleString()}pt不足）</span>
                          )}
                        </p>
                      )}
                      {!lineUser && (
                        <p className="text-xs text-pink-600 mt-1">
                          LINEログインが必要です
                        </p>
                      )}
                    </div>
                  </Label>
                )}

                <Label
                  htmlFor="cash"
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === "cash" 
                      ? "border-pink-500 bg-gradient-to-r from-pink-50 to-rose-50 shadow-md" 
                      : "border-gray-200 hover:border-pink-200 hover:bg-pink-50/50"
                  }`}
                >
                  <RadioGroupItem value="cash" id="cash" />
                  <div className="flex-1">
                    <p className="font-bold mb-1">現金で購入</p>
                    <p className="text-2xl font-bold text-pink-600">
                      ¥{totalCashPrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      クレジットカード・銀行振込
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={isPurchasing || (paymentMethod === "points" && !canPurchaseWithPoints)}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
            >
              {isPurchasing ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  処理中...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  購入を確定
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* フッター */}
      <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-10 mt-16">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-pink-400" />
              <span className="text-xl font-bold">LCJ MALL</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/mall/products" className="hover:text-white transition-colors">商品一覧</Link>
              <Link href="/mypage" className="hover:text-white transition-colors">マイページ</Link>
              <Link href="/" className="hover:text-white transition-colors">トップ</Link>
            </div>
            <p className="text-gray-500 text-sm">© 2024 LCJ MALL. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
