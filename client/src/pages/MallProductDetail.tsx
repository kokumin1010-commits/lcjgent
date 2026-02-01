import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ShoppingCart, 
  ArrowLeft, 
  Package, 
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
  CheckCircle2,
  MapPin,
  Phone,
  User,
  Home,
  Building2,
  Loader2
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";

type PaymentMethod = "cash" | "points";
type PurchaseStep = "payment" | "address" | "confirm";

interface AddressForm {
  label: string;
  recipientName: string;
  phoneNumber: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
}

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
];

export default function MallProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("points");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("payment");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [isNewAddress, setIsNewAddress] = useState(false);
  const [isSearchingPostalCode, setIsSearchingPostalCode] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm>({
    label: "自宅",
    recipientName: "",
    phoneNumber: "",
    postalCode: "",
    prefecture: "",
    city: "",
    addressLine1: "",
    addressLine2: "",
  });

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

  // 保存済み住所を取得
  const { data: savedAddresses, refetch: refetchAddresses } = trpc.mall.getMyAddresses.useQuery(
    undefined,
    { enabled: !!lineUser }
  );

  // 郵便番号検索
  const searchPostalCode = trpc.mall.searchAddressByPostalCode.useQuery(
    { postalCode: addressForm.postalCode },
    { enabled: addressForm.postalCode.length === 7 && isSearchingPostalCode }
  );

  // 住所追加
  const addAddress = trpc.mall.addAddress.useMutation({
    onSuccess: () => {
      refetchAddresses();
      toast.success("住所を保存しました");
    },
  });

  // 郵便番号検索結果を反映
  useEffect(() => {
    if (searchPostalCode.data?.found && searchPostalCode.data.address) {
      setAddressForm(prev => ({
        ...prev,
        prefecture: searchPostalCode.data.address!.prefecture,
        city: searchPostalCode.data.address!.city + (searchPostalCode.data.address!.town || ""),
      }));
      setIsSearchingPostalCode(false);
    }
  }, [searchPostalCode.data]);

  // デフォルト住所を選択
  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0 && !selectedAddressId) {
      const defaultAddress = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
      setSelectedAddressId(defaultAddress.id);
    }
  }, [savedAddresses, selectedAddressId]);

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

  const handlePostalCodeChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "").slice(0, 7);
    setAddressForm(prev => ({ ...prev, postalCode: cleaned }));
    if (cleaned.length === 7) {
      setIsSearchingPostalCode(true);
    }
  };

  const handleNextStep = () => {
    if (purchaseStep === "payment") {
      if (paymentMethod === "points" && !lineUser) {
        toast.error("ポイント購入にはLINEログインが必要です");
        setLocation("/line-login");
        return;
      }
      setPurchaseStep("address");
    } else if (purchaseStep === "address") {
      // 新しい住所入力の場合または保存済み住所がない場合
      if (isNewAddress || !savedAddresses || savedAddresses.length === 0) {
        // 新しい住所の場合、バリデーション
        if (!addressForm.recipientName || !addressForm.phoneNumber || 
            !addressForm.postalCode || !addressForm.prefecture || 
            !addressForm.city || !addressForm.addressLine1) {
          toast.error("必須項目を入力してください");
          return;
        }
      } else if (!selectedAddressId) {
        toast.error("配送先を選択してください");
        return;
      }
      setPurchaseStep("confirm");
    }
  };

  const handlePrevStep = () => {
    if (purchaseStep === "address") {
      setPurchaseStep("payment");
    } else if (purchaseStep === "confirm") {
      setPurchaseStep("address");
    }
  };

  const handlePurchase = async () => {
    if (!product) return;

    // 新しい住所を保存
    if (isNewAddress && addressForm.recipientName) {
      try {
        await addAddress.mutateAsync({
          label: addressForm.label,
          recipientName: addressForm.recipientName,
          phoneNumber: addressForm.phoneNumber,
          postalCode: addressForm.postalCode,
          prefecture: addressForm.prefecture,
          city: addressForm.city,
          addressLine1: addressForm.addressLine1,
          addressLine2: addressForm.addressLine2 || undefined,
          isDefault: !savedAddresses || savedAddresses.length === 0,
        });
      } catch (error) {
        console.error("住所保存エラー:", error);
      }
    }

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

  const resetDialog = () => {
    setPurchaseStep("payment");
    setIsNewAddress(false);
    setAddressForm({
      label: "自宅",
      recipientName: "",
      phoneNumber: "",
      postalCode: "",
      prefecture: "",
      city: "",
      addressLine1: "",
      addressLine2: "",
    });
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
  const selectedAddress = savedAddresses?.find(a => a.id === selectedAddressId);

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
            <div className="aspect-square relative rounded-2xl overflow-hidden bg-white shadow-lg border border-pink-100">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50">
                  <Package className="h-32 w-32 text-pink-200" />
                </div>
              )}
              {product.pointPrice && (
                <div className="absolute top-4 left-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full blur-sm animate-pulse"></div>
                    <Badge className="relative bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-amber-900 px-4 py-2 text-lg shadow-lg border-2 border-amber-300 font-bold">
                      <Coins className="h-5 w-5 mr-2 text-amber-700" />
                      {product.pointPrice.toLocaleString()}pt
                    </Badge>
                  </div>
                </div>
              )}
              {product.stock <= 5 && product.stock > 0 && (
                <Badge className="absolute top-4 right-4 bg-red-500 text-white">
                  残り{product.stock}点
                </Badge>
              )}
            </div>
            
            {/* アクションボタン */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className={`flex-1 ${isFavorite ? 'bg-pink-50 border-pink-300 text-pink-600' : ''}`}
                onClick={() => setIsFavorite(!isFavorite)}
              >
                <Heart className={`h-5 w-5 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                お気に入り
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleShare}>
                <Share2 className="h-5 w-5 mr-2" />
                シェア
              </Button>
            </div>
          </div>

          {/* 商品情報セクション */}
          <div className="space-y-6">
            <div>
              {product.category && (
                <Badge variant="outline" className="mb-3 border-pink-200 text-pink-600">
                  {product.category}
                </Badge>
              )}
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{product.name}</h1>
              
              {/* 価格表示 */}
              <div className="flex flex-wrap items-end gap-4 mb-4">
                <div>
                  <span className="text-sm text-muted-foreground">販売価格</span>
                  <p className="text-4xl font-bold text-pink-600">
                    ¥{product.price.toLocaleString()}
                  </p>
                </div>
                {product.pointPrice && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-2xl blur-md opacity-50 animate-pulse"></div>
                    <div className="relative bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-5 py-3 rounded-2xl border-2 border-amber-300 shadow-lg shadow-amber-200/50">
                      <span className="text-sm font-semibold text-amber-800">✨ ポイント価格</span>
                      <p className="text-3xl font-black text-amber-900">
                        {product.pointPrice.toLocaleString()}<span className="text-xl">pt</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 在庫状況 */}
              <div className="flex items-center gap-2 mb-4">
                {product.stock > 0 ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">在庫あり</span>
                    {product.stock <= 10 && (
                      <span className="text-orange-500 text-sm">（残り{product.stock}点）</span>
                    )}
                  </>
                ) : (
                  <>
                    <Package className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-500">在庫切れ</span>
                  </>
                )}
              </div>
            </div>

            {/* 商品説明 */}
            {product.description && (
              <div className="prose prose-pink max-w-none">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            {/* 特典バッジ */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm">
                <Truck className="h-4 w-4" />
                送料無料
              </div>
              <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm">
                <Shield className="h-4 w-4" />
                品質保証
              </div>
              <div className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm">
                <Gift className="h-4 w-4" />
                ギフト対応
              </div>
            </div>

            {/* 購入カード */}
            <Card className="border-2 border-pink-200 shadow-xl">
              <CardContent className="p-6 space-y-4">
                {/* 数量選択 */}
                {product.stock > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">数量</span>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
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
                    onClick={() => {
                      resetDialog();
                      setIsPurchaseDialogOpen(true);
                    }}
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
      <Dialog open={isPurchaseDialogOpen} onOpenChange={(open) => {
        setIsPurchaseDialogOpen(open);
        if (!open) resetDialog();
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {purchaseStep === "payment" && "お支払い方法を選択"}
              {purchaseStep === "address" && "配送先を選択"}
              {purchaseStep === "confirm" && "ご注文内容の確認"}
            </DialogTitle>
            <DialogDescription>
              {product.name} × {quantity}点
            </DialogDescription>
          </DialogHeader>

          {/* ステップインジケーター */}
          <div className="flex items-center justify-center gap-2 py-4">
            {["payment", "address", "confirm"].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  purchaseStep === step 
                    ? "bg-pink-500 text-white" 
                    : index < ["payment", "address", "confirm"].indexOf(purchaseStep)
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {index < ["payment", "address", "confirm"].indexOf(purchaseStep) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 2 && (
                  <div className={`w-12 h-1 mx-1 ${
                    index < ["payment", "address", "confirm"].indexOf(purchaseStep)
                      ? "bg-green-500"
                      : "bg-gray-200"
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* ステップ1: 支払い方法選択 */}
          {purchaseStep === "payment" && (
            <div className="py-4">
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <div className="space-y-3">
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
          )}

          {/* ステップ2: 配送先選択 */}
          {purchaseStep === "address" && (
            <div className="py-4 space-y-4">
              {/* 保存済み住所 */}
              {savedAddresses && savedAddresses.length > 0 && !isNewAddress && (
                <div className="space-y-3">
                  <p className="font-medium text-sm text-muted-foreground">保存済みの住所</p>
                  <RadioGroup value={selectedAddressId?.toString()} onValueChange={(v) => setSelectedAddressId(Number(v))}>
                    {savedAddresses.map((address) => (
                      <Label
                        key={address.id}
                        htmlFor={`address-${address.id}`}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedAddressId === address.id
                            ? "border-pink-500 bg-pink-50"
                            : "border-gray-200 hover:border-pink-200"
                        }`}
                      >
                        <RadioGroupItem value={address.id.toString()} id={`address-${address.id}`} className="mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {address.label === "自宅" ? (
                              <Home className="h-4 w-4 text-pink-500" />
                            ) : (
                              <Building2 className="h-4 w-4 text-pink-500" />
                            )}
                            <span className="font-bold">{address.label}</span>
                            {address.isDefault && (
                              <Badge variant="outline" className="text-xs">デフォルト</Badge>
                            )}
                          </div>
                          <p className="text-sm">{address.recipientName}</p>
                          <p className="text-sm text-muted-foreground">
                            〒{address.postalCode.slice(0, 3)}-{address.postalCode.slice(3)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {address.prefecture}{address.city}{address.addressLine1}
                            {address.addressLine2 && ` ${address.addressLine2}`}
                          </p>
                          <p className="text-sm text-muted-foreground">{address.phoneNumber}</p>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsNewAddress(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    新しい住所を追加
                  </Button>
                </div>
              )}

              {/* 新しい住所入力フォーム */}
              {(isNewAddress || !savedAddresses || savedAddresses.length === 0) && (
                <div className="space-y-4">
                  {savedAddresses && savedAddresses.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsNewAddress(false)}
                      className="mb-2"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      保存済み住所に戻る
                    </Button>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="label">住所ラベル</Label>
                      <Select
                        value={addressForm.label}
                        onValueChange={(v) => setAddressForm(prev => ({ ...prev, label: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="自宅">自宅</SelectItem>
                          <SelectItem value="会社">会社</SelectItem>
                          <SelectItem value="その他">その他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipientName">
                        <User className="h-4 w-4 inline mr-1" />
                        お名前 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="recipientName"
                        value={addressForm.recipientName}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, recipientName: e.target.value }))}
                        placeholder="山田 太郎"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">
                      <Phone className="h-4 w-4 inline mr-1" />
                      電話番号 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phoneNumber"
                      value={addressForm.phoneNumber}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, phoneNumber: e.target.value.replace(/[^0-9-]/g, "") }))}
                      placeholder="090-1234-5678"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">
                        <MapPin className="h-4 w-4 inline mr-1" />
                        郵便番号 <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="postalCode"
                          value={addressForm.postalCode}
                          onChange={(e) => handlePostalCodeChange(e.target.value)}
                          placeholder="1234567"
                          maxLength={7}
                        />
                        {isSearchingPostalCode && (
                          <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">ハイフンなしで入力</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prefecture">
                        都道府県 <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={addressForm.prefecture}
                        onValueChange={(v) => setAddressForm(prev => ({ ...prev, prefecture: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {PREFECTURES.map((pref) => (
                            <SelectItem key={pref} value={pref}>{pref}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">
                      市区町村 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="city"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="渋谷区渋谷"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine1">
                      番地 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="addressLine1"
                      value={addressForm.addressLine1}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, addressLine1: e.target.value }))}
                      placeholder="1-2-3"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">
                      建物名・部屋番号（任意）
                    </Label>
                    <Input
                      id="addressLine2"
                      value={addressForm.addressLine2}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, addressLine2: e.target.value }))}
                      placeholder="○○マンション 101号室"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ステップ3: 確認 */}
          {purchaseStep === "confirm" && (
            <div className="py-4 space-y-4">
              {/* 商品情報 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold mb-2">ご注文商品</h4>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-white">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">数量: {quantity}</p>
                  </div>
                  <div className="text-right">
                    {paymentMethod === "points" ? (
                      <p className="font-bold text-orange-600">{totalPointPrice.toLocaleString()}pt</p>
                    ) : (
                      <p className="font-bold text-pink-600">¥{totalCashPrice.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 配送先 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  配送先
                </h4>
                {isNewAddress ? (
                  <div className="text-sm">
                    <p className="font-medium">{addressForm.recipientName}</p>
                    <p className="text-muted-foreground">
                      〒{addressForm.postalCode.slice(0, 3)}-{addressForm.postalCode.slice(3)}
                    </p>
                    <p className="text-muted-foreground">
                      {addressForm.prefecture}{addressForm.city}{addressForm.addressLine1}
                      {addressForm.addressLine2 && ` ${addressForm.addressLine2}`}
                    </p>
                    <p className="text-muted-foreground">{addressForm.phoneNumber}</p>
                  </div>
                ) : selectedAddress && (
                  <div className="text-sm">
                    <p className="font-medium">{selectedAddress.recipientName}</p>
                    <p className="text-muted-foreground">
                      〒{selectedAddress.postalCode.slice(0, 3)}-{selectedAddress.postalCode.slice(3)}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedAddress.prefecture}{selectedAddress.city}{selectedAddress.addressLine1}
                      {selectedAddress.addressLine2 && ` ${selectedAddress.addressLine2}`}
                    </p>
                    <p className="text-muted-foreground">{selectedAddress.phoneNumber}</p>
                  </div>
                )}
              </div>

              {/* 支払い方法 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  {paymentMethod === "points" ? (
                    <Coins className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  お支払い方法
                </h4>
                <p className="text-sm">
                  {paymentMethod === "points" ? "ポイント決済" : "現金決済"}
                </p>
              </div>

              {/* 合計 */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>合計</span>
                  {paymentMethod === "points" ? (
                    <span className="text-orange-600">{totalPointPrice.toLocaleString()}pt</span>
                  ) : (
                    <span className="text-pink-600">¥{totalCashPrice.toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {purchaseStep !== "payment" && (
              <Button variant="outline" onClick={handlePrevStep}>
                戻る
              </Button>
            )}
            {purchaseStep === "payment" && (
              <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>
                キャンセル
              </Button>
            )}
            {purchaseStep !== "confirm" ? (
              <Button
                onClick={handleNextStep}
                disabled={paymentMethod === "points" && !canPurchaseWithPoints}
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
              >
                次へ
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    処理中...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    注文を確定する
                  </>
                )}
              </Button>
            )}
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
