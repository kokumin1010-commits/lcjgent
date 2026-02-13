import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function MallCart() {
  const [, navigate] = useLocation();
  const { data: cartItems = [], isLoading } = trpc.mall.getCartItems.useQuery();
  const utils = trpc.useUtils();

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

  // 合計計算
  const { subtotal, totalItems, hasOutOfStock } = useMemo(() => {
    let subtotal = 0;
    let totalItems = 0;
    let hasOutOfStock = false;
    for (const item of cartItems) {
      const qty = item.cart?.quantity ?? 0;
      const price = item.product?.price ?? 0;
      const stock = item.product?.stock ?? 0;
      subtotal += price * qty;
      totalItems += qty;
      if (stock <= 0 || qty > stock) hasOutOfStock = true;
    }
    return { subtotal, totalItems, hasOutOfStock };
  }, [cartItems]);

  const handleQuantityChange = (productId: number, newQty: number, maxStock: number) => {
    if (newQty <= 0) {
      removeItemMutation.mutate({ productId });
      return;
    }
    if (newQty > maxStock) {
      toast.error(`在庫数は${maxStock}個までです`);
      return;
    }
    updateQuantityMutation.mutate({ productId, quantity: newQty });
  };

  const handleRemoveItem = (productId: number, productName: string) => {
    removeItemMutation.mutate({ productId });
    toast.success(`${productName}をカートから削除しました`, { duration: 1500 });
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    clearCartMutation.mutate();
    toast.success("カートをクリアしました", { duration: 1500 });
  };

  const handleCheckout = () => {
    if (hasOutOfStock) {
      toast.error("在庫切れの商品があります。削除してからお進みください。");
      return;
    }
    // TODO: チェックアウトフローへ遷移
    toast("チェックアウト機能は準備中です", { duration: 2000 });
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
                        <Link href={`/mall/products/${product.id}`}>
                          <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight hover:text-pink-600 transition-colors">
                            {product.name}
                          </h3>
                        </Link>
                        <button
                          onClick={() => handleRemoveItem(product.id, product.name)}
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
                            {product.pointPrice.toLocaleString()} pt
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
                              onClick={() => handleQuantityChange(product.id, cart.quantity - 1, product.stock)}
                              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors active:bg-gray-200"
                            >
                              {cart.quantity <= 1 ? (
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              ) : (
                                <Minus className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <span className="w-8 text-center text-sm font-semibold text-gray-800">
                              {cart.quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(product.id, cart.quantity + 1, product.stock)}
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
              onClick={handleCheckout}
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
    </div>
  );
}
