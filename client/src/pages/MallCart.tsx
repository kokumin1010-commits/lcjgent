import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
  Minus,
  Plus,
  Trash2,
  X,
  ShoppingBag,
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  Coins,
  Truck,
  Shield,
  ChevronRight,
  MapPin,
  Phone,
  User,
  Home,
  Building2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type PaymentMethod = "points" | "cash";
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

const SHIPPING_FEE = 880;
const FREE_SHIPPING_THRESHOLD = 5000;

export default function MallCart() {
  const [, navigate] = useLocation();
  const { data: cartItems = [], isLoading } = trpc.mall.getCartItems.useQuery();
  const utils = trpc.useUtils();

  // チェックアウトダイアログ
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("payment");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isPurchasing, setIsPurchasing] = useState(false);

  // 配送先
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

  // LINEユーザー情報
  const { data: lineUser } = trpc.lineLogin.me.useQuery();

  // 保存済み住所
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

  // 数量更新ミューテーション（楽観的更新）
  const updateQuantityMutation = trpc.mall.updateCartQuantity.useMutation({
    onMutate: async ({ productId, quantity }) => {
      await utils.mall.getCartItems.cancel();
      const prev = utils.mall.getCartItems.getData() ?? [];
      utils.mall.getCartItems.setData(undefined,
        quantity <= 0
          ? prev.filter((item: any) => item.product.id !== productId)
          : prev.map((item: any) =>
              item.product.id === productId
                ? { ...item, cart: { ...item.cart, quantity } }
                : item
            )
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.mall.getCartItems.setData(undefined, context.prev);
      toast.error("数量の更新に失敗しました");
    },
    onSettled: () => {
      utils.mall.getCartItems.invalidate();
      utils.mall.getCartCount.invalidate();
    },
  });

  // 削除ミューテーション（楽観的更新）
  const removeItemMutation = trpc.mall.removeFromCart.useMutation({
    onMutate: async ({ productId }) => {
      await utils.mall.getCartItems.cancel();
      const prev = utils.mall.getCartItems.getData() ?? [];
      utils.mall.getCartItems.setData(undefined,
        prev.filter((item: any) => item.product.id !== productId)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.mall.getCartItems.setData(undefined, context.prev);
      toast.error("削除に失敗しました");
    },
    onSettled: () => {
      utils.mall.getCartItems.invalidate();
      utils.mall.getCartCount.invalidate();
    },
  });

  // カートクリアミューテーション
  const clearCartMutation = trpc.mall.clearCart.useMutation({
    onMutate: async () => {
      await utils.mall.getCartItems.cancel();
      const prev = utils.mall.getCartItems.getData() ?? [];
      utils.mall.getCartItems.setData(undefined, []);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.mall.getCartItems.setData(undefined, context.prev);
      toast.error("カートのクリアに失敗しました");
    },
    onSettled: () => {
      utils.mall.getCartItems.invalidate();
      utils.mall.getCartCount.invalidate();
    },
  });

  // Stripeチェックアウト
  const cartCheckoutStripe = trpc.mall.cartCheckoutStripe.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("決済ページに移動します...", {
          description: "Stripeの安全な決済ページが開きます",
        });
        setIsCheckoutOpen(false);
        // カートをクリア
        utils.mall.getCartItems.invalidate();
        utils.mall.getCartCount.invalidate();
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error) => {
      toast.error(error.message || "決済セッションの作成に失敗しました");
    },
  });

  // ポイントチェックアウト
  const cartCheckoutPoints = trpc.mall.cartCheckoutPoints.useMutation({
    onSuccess: (data) => {
      toast.success("購入が完了しました！", {
        description: `${data.pointsUsed.toLocaleString()}ptを使用しました`,
      });
      setIsCheckoutOpen(false);
      // カートをクリア
      utils.mall.getCartItems.invalidate();
      utils.mall.getCartCount.invalidate();
      navigate("/mypage");
    },
    onError: (error) => {
      toast.error(error.message || "購入に失敗しました");
    },
  });

  // 合計計算
  const { subtotal, totalItems, hasOutOfStock, totalPoints, allPointEligible, shippingFee, totalWithShipping } = useMemo(() => {
    let subtotal = 0;
    let totalItems = 0;
    let hasOutOfStock = false;
    let totalPoints = 0;
    let allPointEligible = cartItems.length > 0;
    for (const item of cartItems) {
      const qty = item.cart?.quantity ?? 0;
      const price = item.product?.price ?? 0;
      const stock = item.product?.stock ?? 0;
      subtotal += price * qty;
      totalItems += qty;
      if (stock <= 0 || qty > stock) hasOutOfStock = true;
      if (item.product?.pointPrice) {
        totalPoints += item.product.pointPrice * qty;
      } else {
        allPointEligible = false;
      }
    }
    const shippingFee = subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
    return { subtotal, totalItems, hasOutOfStock, totalPoints, allPointEligible, shippingFee, totalWithShipping: subtotal + shippingFee };
  }, [cartItems]);

  const canPurchaseWithPoints = lineUser && allPointEligible && lineUser.points >= totalPoints;
  const selectedAddress = savedAddresses?.find(a => a.id === selectedAddressId);

  const handleQuantityChange = (productId: number, newQty: number, maxStock: number, variantId?: number | null) => {
    if (newQty <= 0) {
      removeItemMutation.mutate({ productId, variantId: variantId || undefined });
      return;
    }
    if (newQty > maxStock) {
      toast.error(`在庫数は${maxStock}個までです`);
      return;
    }
    updateQuantityMutation.mutate({ productId, quantity: newQty, variantId: variantId || undefined });
  };

  const handleRemoveItem = (productId: number, productName: string, variantId?: number | null) => {
    removeItemMutation.mutate({ productId, variantId: variantId || undefined });
    toast.success(`${productName}をカートから削除しました`, { duration: 1500 });
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    clearCartMutation.mutate();
    toast.success("カートをクリアしました", { duration: 1500 });
  };

  const handleOpenCheckout = () => {
    if (hasOutOfStock) {
      toast.error("在庫切れの商品があります。削除してからお進みください。");
      return;
    }
    if (!lineUser) {
      toast.error("購入にはログインが必要です");
      return;
    }
    setPurchaseStep("payment");
    setPaymentMethod(canPurchaseWithPoints ? "points" : "cash");
    setIsCheckoutOpen(true);
  };

  const handlePostalCodeChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "").slice(0, 7);
    setAddressForm(prev => ({ ...prev, postalCode: cleaned }));
    if (cleaned.length === 7) {
      setIsSearchingPostalCode(true);
    }
  };

  const handleNextStep = async () => {
    if (purchaseStep === "payment") {
      if (paymentMethod === "points" && !lineUser) {
        toast.error("ポイント購入にはLINEログインが必要です");
        return;
      }
      setPurchaseStep("address");
    } else if (purchaseStep === "address") {
      if (isNewAddress || !savedAddresses || savedAddresses.length === 0) {
        if (!addressForm.recipientName || !addressForm.phoneNumber || 
            !addressForm.postalCode || !addressForm.prefecture || 
            !addressForm.city || !addressForm.addressLine1) {
          toast.error("必須項目を入力してください");
          return;
        }
        try {
          const savedAddr = await addAddress.mutateAsync({
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
          if (savedAddr && typeof savedAddr === 'object' && 'id' in savedAddr) {
            setSelectedAddressId((savedAddr as any).id);
            setIsNewAddress(false);
          }
        } catch (error) {
          console.error("住所保存エラー:", error);
          toast.error("住所の保存に失敗しました");
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
    // 配送先情報を構築
    let shippingInfo: { name: string; phone: string; postalCode: string; address: string } | undefined;
    if (selectedAddress) {
      shippingInfo = {
        name: selectedAddress.recipientName,
        phone: selectedAddress.phoneNumber,
        postalCode: selectedAddress.postalCode,
        address: `${selectedAddress.prefecture}${selectedAddress.city}${selectedAddress.addressLine1}${selectedAddress.addressLine2 ? " " + selectedAddress.addressLine2 : ""}`,
      };
    } else if (addressForm.recipientName) {
      shippingInfo = {
        name: addressForm.recipientName,
        phone: addressForm.phoneNumber,
        postalCode: addressForm.postalCode,
        address: `${addressForm.prefecture}${addressForm.city}${addressForm.addressLine1}${addressForm.addressLine2 ? " " + addressForm.addressLine2 : ""}`,
      };
    }

    setIsPurchasing(true);
    try {
      if (paymentMethod === "points") {
        await cartCheckoutPoints.mutateAsync({ shippingInfo });
      } else {
        await cartCheckoutStripe.mutateAsync({ shippingInfo });
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/mall/products">
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </Link>
              <h1 className="text-lg font-bold text-gray-900">
                ショッピングカート
                {totalItems > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    ({totalItems}点)
                  </span>
                )}
              </h1>
            </div>
            {cartItems.length > 0 && (
              <button
                onClick={handleClearCart}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                すべて削除
              </button>
            )}
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="pb-40">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-pink-500 animate-spin mb-3" />
            <p className="text-sm text-gray-400">読み込み中...</p>
          </div>
        ) : cartItems.length === 0 ? (
          /* 空のカート */
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="bg-gray-100 rounded-full p-6 mb-4">
              <ShoppingBag className="h-12 w-12 text-gray-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">カートは空です</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              お気に入りの商品を見つけて<br />カートに追加しましょう
            </p>
            <Link href="/mall/products">
              <Button className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 rounded-full px-8 py-5 text-base shadow-lg">
                <ShoppingCart className="h-5 w-5 mr-2" />
                商品を探す
              </Button>
            </Link>
          </div>
        ) : (
          /* カートアイテム一覧 */
          <div className="px-3 pt-3 space-y-2">
            {cartItems.map((item: any) => {
              const product = item.product;
              const cart = item.cart;
              const isOutOfStock = product.stock <= 0;
              const isOverStock = cart.quantity > product.stock;

              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-xl p-3 shadow-sm border transition-all duration-300 ${
                    isOutOfStock
                      ? "border-red-200 bg-red-50/30"
                      : isOverStock
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-gray-100"
                  }`}
                >
                  <div className="flex gap-3">
                    {/* 商品画像 */}
                    <Link href={`/mall/products/${product.id}`}>
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-gray-300" />
                          </div>
                        )}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">SOLD OUT</span>
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* 商品情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link href={`/mall/products/${product.id}`}>
                            <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight hover:text-pink-600 transition-colors">
                              {product.name}
                            </h3>
                          </Link>
                          {item.variant && (
                            <span className="inline-block mt-0.5 text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {item.variant.name}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveItem(product.id, product.name, cart.variantId)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* ポイント交換可能バッジ */}
                      {product.pointPrice && (
                        <div className="flex items-center gap-1 mt-1">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span className="text-[11px] font-semibold text-amber-600">
                            {(product.pointPrice * cart.quantity).toLocaleString()} pt
                          </span>
                        </div>
                      )}

                      {/* 在庫警告 */}
                      {isOverStock && !isOutOfStock && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3 text-amber-500" />
                          <span className="text-[11px] text-amber-600">
                            在庫残り{product.stock}点
                          </span>
                        </div>
                      )}

                      {/* 価格と数量 */}
                      <div className="flex items-end justify-between mt-2">
                        <p className="text-base font-bold text-pink-600">
                          ¥{(product.price * cart.quantity).toLocaleString()}
                          {cart.quantity > 1 && (
                            <span className="text-[11px] font-normal text-gray-400 ml-1">
                              (¥{product.price.toLocaleString()} × {cart.quantity})
                            </span>
                          )}
                        </p>

                        {/* 数量セレクター */}
                        {!isOutOfStock && (
                          <div className="flex items-center gap-0 border border-gray-200 rounded-full overflow-hidden">
                            <button
                              onClick={() => handleQuantityChange(product.id, cart.quantity - 1, product.stock, cart.variantId)}
                              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors active:bg-gray-200"
                            >
                              {cart.quantity <= 1 ? (
                                <Trash2 className="h-3 w-3 text-red-400" />
                              ) : (
                                <Minus className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <span className="w-8 text-center text-sm font-semibold text-gray-800">
                              {cart.quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(product.id, cart.quantity + 1, product.stock, cart.variantId)}
                              disabled={cart.quantity >= product.stock}
                              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors active:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 送料案内 */}
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-gray-400" />
                {shippingFee > 0 ? (
                  <span className="text-gray-600">
                    送料 ¥{SHIPPING_FEE.toLocaleString()} 
                    <span className="text-amber-600 ml-1">
                      （あと¥{(FREE_SHIPPING_THRESHOLD - subtotal).toLocaleString()}で送料無料）
                    </span>
                  </span>
                ) : (
                  <span className="text-green-600 font-medium">送料無料</span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 固定フッター - 合計・購入ボタン */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50">
          <div className="px-4 py-3">
            {/* 合計金額 */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm text-gray-500">合計</span>
                <span className="text-xs text-gray-400 ml-1">({totalItems}点)</span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  ¥{subtotal.toLocaleString()}
                </p>
                <p className="text-[11px] text-gray-400">(税込)</p>
              </div>
            </div>

            {/* 購入ボタン */}
            <Button
              onClick={handleOpenCheckout}
              disabled={hasOutOfStock}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-base py-6 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasOutOfStock ? (
                <>
                  <AlertCircle className="h-5 w-5 mr-2" />
                  在庫切れの商品があります
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5 mr-2" />
                  レジに進む
                </>
              )}
            </Button>
          </div>

          {/* セーフエリア（iPhoneのホームバー対策） */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      )}

      {/* チェックアウトダイアログ */}
      <Dialog open={isCheckoutOpen} onOpenChange={(open) => {
        setIsCheckoutOpen(open);
        if (!open) {
          setPurchaseStep("payment");
          setIsPurchasing(false);
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {purchaseStep === "payment" && "お支払い方法を選択"}
              {purchaseStep === "address" && "配送先を選択"}
              {purchaseStep === "confirm" && "ご注文内容の確認"}
            </DialogTitle>
            <DialogDescription>
              カート内の{cartItems.length}商品をまとめて購入
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
                  {allPointEligible && (
                    <Label
                      htmlFor="cart-points"
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        paymentMethod === "points" 
                          ? "border-pink-500 bg-gradient-to-r from-pink-50 to-rose-50 shadow-md" 
                          : "border-gray-200 hover:border-pink-200 hover:bg-pink-50/50"
                      } ${!lineUser ? "opacity-60" : ""}`}
                    >
                      <RadioGroupItem value="points" id="cart-points" disabled={!lineUser} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Coins className="h-5 w-5 text-yellow-500" />
                          <p className="font-bold">ポイントで購入</p>
                          {canPurchaseWithPoints && (
                            <Badge className="bg-green-500 text-xs">おすすめ</Badge>
                          )}
                        </div>
                        <p className="text-2xl font-bold text-orange-600">
                          {totalPoints.toLocaleString()}pt
                        </p>
                        {lineUser && (
                          <p className="text-sm text-muted-foreground mt-1">
                            残高: {lineUser.points.toLocaleString()}pt
                            {canPurchaseWithPoints ? (
                              <span className="text-green-600 ml-2">→ 購入後: {(lineUser.points - totalPoints).toLocaleString()}pt</span>
                            ) : (
                              <span className="text-red-500 ml-2">（{(totalPoints - lineUser.points).toLocaleString()}pt不足）</span>
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
                    htmlFor="cart-cash"
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      paymentMethod === "cash" 
                        ? "border-pink-500 bg-gradient-to-r from-pink-50 to-rose-50 shadow-md" 
                        : "border-gray-200 hover:border-pink-200 hover:bg-pink-50/50"
                    }`}
                  >
                    <RadioGroupItem value="cash" id="cart-cash" />
                    <div className="flex-1">
                      <p className="font-bold mb-1">現金で購入</p>
                      <p className="text-2xl font-bold text-pink-600">
                        ¥{subtotal.toLocaleString()}
                        {shippingFee > 0 && (
                          <span className="text-sm font-normal text-muted-foreground ml-1">+ 送料¥{shippingFee.toLocaleString()}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        クレジットカード決済（Stripeセキュア決済）
                      </p>
                      {shippingFee > 0 ? (
                        <p className="text-xs text-amber-600 mt-0.5">※ ¥{FREE_SHIPPING_THRESHOLD.toLocaleString()}以上のご購入で送料無料</p>
                      ) : (
                        <p className="text-xs text-green-600 mt-0.5">✓ 送料無料</p>
                      )}
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {/* カート内容サマリー */}
              <div className="mt-4 bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-2">カート内容 ({cartItems.length}商品)</p>
                <div className="space-y-1">
                  {cartItems.map((item: any) => (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className="text-gray-700 truncate mr-2">{item.product.name} ×{item.cart.quantity}</span>
                      <span className="text-gray-500 flex-shrink-0">¥{(item.product.price * item.cart.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
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
                        htmlFor={`cart-address-${address.id}`}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedAddressId === address.id
                            ? "border-pink-500 bg-pink-50"
                            : "border-gray-200 hover:border-pink-200"
                        }`}
                      >
                        <RadioGroupItem value={address.id.toString()} id={`cart-address-${address.id}`} className="mt-1" />
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
                      <Label htmlFor="cart-label">住所ラベル</Label>
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
                      <Label htmlFor="cart-recipientName">
                        <User className="h-4 w-4 inline mr-1" />
                        お名前 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="cart-recipientName"
                        value={addressForm.recipientName}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, recipientName: e.target.value }))}
                        placeholder="山田 太郎"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cart-phoneNumber">
                      <Phone className="h-4 w-4 inline mr-1" />
                      電話番号 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="cart-phoneNumber"
                      value={addressForm.phoneNumber}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, phoneNumber: e.target.value.replace(/[^0-9-]/g, "") }))}
                      placeholder="090-1234-5678"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cart-postalCode">
                        <MapPin className="h-4 w-4 inline mr-1" />
                        郵便番号 <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="cart-postalCode"
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
                      <Label htmlFor="cart-prefecture">
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
                    <Label htmlFor="cart-city">
                      市区町村 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="cart-city"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="渋谷区渋谷"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cart-addressLine1">
                      番地 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="cart-addressLine1"
                      value={addressForm.addressLine1}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, addressLine1: e.target.value }))}
                      placeholder="1-2-3"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cart-addressLine2">
                      建物名・部屋番号（任意）
                    </Label>
                    <Input
                      id="cart-addressLine2"
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
                <h4 className="font-bold mb-3">ご注文商品 ({cartItems.length}点)</h4>
                <div className="space-y-3">
                  {cartItems.map((item: any) => (
                    <div key={item.product.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0">
                        {item.product.imageUrl ? (
                          <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">数量: {item.cart.quantity}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {paymentMethod === "points" ? (
                          <p className="font-bold text-sm text-orange-600">{(item.product.pointPrice * item.cart.quantity).toLocaleString()}pt</p>
                        ) : (
                          <p className="font-bold text-sm text-pink-600">¥{(item.product.price * item.cart.quantity).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
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
                  {paymentMethod === "points" ? "ポイント決済" : "クレジットカード決済（Stripe）"}
                </p>
              </div>

              {/* 送料・合計 */}
              <div className="border-t pt-4 space-y-2">
                {paymentMethod === "points" ? (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">商品小計</span>
                      <span>{totalPoints.toLocaleString()} pt</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">送料</span>
                      {totalPoints < FREE_SHIPPING_THRESHOLD ? (
                        <span>{SHIPPING_FEE.toLocaleString()} pt</span>
                      ) : (
                        <span className="text-green-600 font-medium">無料</span>
                      )}
                    </div>
                    {totalPoints < FREE_SHIPPING_THRESHOLD && (
                      <p className="text-xs text-muted-foreground">※ {FREE_SHIPPING_THRESHOLD.toLocaleString()} pt以上のご購入で送料無料</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">小計</span>
                      <span>¥{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">送料</span>
                      {shippingFee > 0 ? (
                        <span>¥{shippingFee.toLocaleString()}</span>
                      ) : (
                        <span className="text-green-600 font-medium">無料</span>
                      )}
                    </div>
                    {shippingFee > 0 && (
                      <p className="text-xs text-muted-foreground">※ ¥{FREE_SHIPPING_THRESHOLD.toLocaleString()}以上のご購入で送料無料</p>
                    )}
                  </>
                )}
                <div className="flex justify-between items-center text-lg font-bold pt-1">
                  <span>合計</span>
                  {paymentMethod === "points" ? (
                    <span className="text-orange-600">
                      {(totalPoints < FREE_SHIPPING_THRESHOLD ? totalPoints + SHIPPING_FEE : totalPoints).toLocaleString()} pt
                    </span>
                  ) : (
                    <span className="text-pink-600">¥{totalWithShipping.toLocaleString()}</span>
                  )}
                </div>
              </div>

              {/* セキュリティバッジ */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                <Shield className="h-3.5 w-3.5" />
                <span>安全な決済処理</span>
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
              <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
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
    </div>
  );
}
