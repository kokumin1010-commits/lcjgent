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
import { ShoppingCart, ArrowLeft, Package, Star, Check, Coins } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";

type PaymentMethod = "cash" | "points";

export default function MallProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isPurchasing, setIsPurchasing] = useState(false);

  const { data: product, isLoading } = trpc.mall.getProductById.useQuery(
    { id: Number(id) },
    { enabled: !!id }
  );

  // LINEユーザー情報を取得（ポイント残高確認用）
  const { data: lineUser } = trpc.lineLogin.me.useQuery();

  const purchaseWithPoints = trpc.mall.purchaseWithPoints.useMutation({
    onSuccess: () => {
      toast.success("購入が完了しました！");
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
          quantity: 1,
        });
      } finally {
        setIsPurchasing(false);
      }
    } else {
      // 現金購入の場合は別の決済フローへ（今回は未実装）
      toast.info("現金決済は準備中です。ポイント購入をご利用ください。");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">商品が見つかりません</h3>
          <Link href="/products">
            <Button variant="outline">商品一覧に戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  const canPurchaseWithPoints = lineUser && product.pointPrice && lineUser.points >= product.pointPrice;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-pink-100 sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <Link href="/products" className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5 text-pink-500" />
              <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                LCJ MALL
              </span>
            </Link>
            <div className="flex items-center gap-4">
              {lineUser && (
                <div className="flex items-center gap-2 text-sm">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="font-semibold">{lineUser.points.toLocaleString()}pt</span>
                </div>
              )}
              <Link href="/mypage">
                <Button variant="outline" size="sm">
                  マイページ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* 商品画像 */}
          <div className="aspect-square relative overflow-hidden bg-white rounded-2xl shadow-lg border border-pink-100">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-32 w-32 text-gray-300" />
              </div>
            )}
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge variant="destructive" className="text-2xl py-2 px-6">
                  売り切れ
                </Badge>
              </div>
            )}
          </div>

          {/* 商品情報 */}
          <div className="space-y-6">
            {product.category && (
              <Badge variant="outline" className="text-sm">
                {product.category}
              </Badge>
            )}

            <h1 className="text-3xl font-bold">{product.name}</h1>

            {product.description && (
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            )}

            <Card className="border-pink-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">販売価格</p>
                    <p className="text-4xl font-bold text-pink-600">
                      ¥{product.price.toLocaleString()}
                    </p>
                  </div>
                  {product.pointPrice && (
                    <div className="pb-1">
                      <Badge className="bg-gradient-to-r from-pink-500 to-rose-500 text-lg py-1 px-3">
                        <Star className="h-4 w-4 mr-1" />
                        {product.pointPrice.toLocaleString()}pt
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">在庫:</span>
                  <span className={product.stock > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                    {product.stock > 0 ? `${product.stock}点` : "在庫切れ"}
                  </span>
                </div>

                {product.stock > 0 && (
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-lg py-6"
                    onClick={() => setIsPurchaseDialogOpen(true)}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    購入する
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* ポイント購入の案内 */}
            {product.pointPrice && (
              <Card className="bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Coins className="h-6 w-6 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">ポイントでお得に購入</p>
                      <p className="text-sm text-muted-foreground">
                        この商品は{product.pointPrice.toLocaleString()}ポイントで購入できます。
                        {!lineUser && (
                          <Link href="/line-login" className="text-pink-600 hover:underline ml-1">
                            LINEでログインしてポイントを使う
                          </Link>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* 購入ダイアログ */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>購入方法を選択</DialogTitle>
            <DialogDescription>
              {product.name}を購入します
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <div className="space-y-3">
                <Label
                  htmlFor="cash"
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                    paymentMethod === "cash" ? "border-pink-500 bg-pink-50" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <RadioGroupItem value="cash" id="cash" />
                  <div className="flex-1">
                    <p className="font-semibold">現金で購入</p>
                    <p className="text-sm text-muted-foreground">
                      ¥{product.price.toLocaleString()}
                    </p>
                  </div>
                </Label>

                {product.pointPrice && (
                  <Label
                    htmlFor="points"
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      paymentMethod === "points" ? "border-pink-500 bg-pink-50" : "border-gray-200 hover:bg-gray-50"
                    } ${!lineUser ? "opacity-50" : ""}`}
                  >
                    <RadioGroupItem value="points" id="points" disabled={!lineUser} />
                    <div className="flex-1">
                      <p className="font-semibold flex items-center gap-2">
                        ポイントで購入
                        {canPurchaseWithPoints && <Check className="h-4 w-4 text-green-500" />}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {product.pointPrice.toLocaleString()}pt
                        {lineUser && (
                          <span className="ml-2">
                            (残高: {lineUser.points.toLocaleString()}pt)
                          </span>
                        )}
                      </p>
                      {!lineUser && (
                        <p className="text-xs text-pink-600 mt-1">
                          LINEログインが必要です
                        </p>
                      )}
                      {lineUser && !canPurchaseWithPoints && (
                        <p className="text-xs text-red-600 mt-1">
                          ポイントが不足しています
                        </p>
                      )}
                    </div>
                  </Label>
                )}
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={isPurchasing || (paymentMethod === "points" && !canPurchaseWithPoints)}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
            >
              {isPurchasing ? "処理中..." : "購入を確定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* フッター */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container text-center">
          <p className="text-gray-400">© 2024 LCJ MALL. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
