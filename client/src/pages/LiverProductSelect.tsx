import React, { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ShoppingBag, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

/**
 * ライバー向け商品選択ページ
 * /liver/products/:brandId
 * 公開ページ（ログイン不要）
 * ライバーがこのリンクを受け取り、配信で紹介する商品を選択できる
 */
export default function LiverProductSelect() {
  const { brandId } = useParams<{ brandId: string }>();
  const numBrandId = parseInt(brandId || "0");
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  // ブランド情報取得
  const { data: brand } = trpc.brand.getById.useQuery(
    { id: numBrandId },
    { enabled: numBrandId > 0 }
  );

  // MALL商品一覧取得（activeのみ表示）
  const { data: allProducts = [], isLoading } = trpc.mall.getProductsByBrandId.useQuery(
    { brandId: numBrandId },
    { enabled: numBrandId > 0 }
  );

  const products = allProducts.filter((p: any) => p.status === "active");

  const toggleProduct = (productId: number) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="bg-black/60 backdrop-blur-xl border-b border-emerald-900/30 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {brand?.logoUrl ? (
                <img src={brand.logoUrl} alt={brand.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 bg-emerald-900/30 rounded-full flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-emerald-400" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-white">{brand?.name || "ブランド"}</h1>
                <p className="text-xs text-gray-400">商品を選択してください</p>
              </div>
            </div>
            {selectedProducts.length > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm px-3 py-1">
                {selectedProducts.length}件選択中
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">商品がまだ登録されていません</p>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-6">
              配信で紹介したい商品を選択してください（{products.length}件）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((product: any) => {
                const isSelected = selectedProducts.includes(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className={`relative bg-black/60 backdrop-blur-xl rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "border-emerald-500/60 shadow-[0_0_20px_rgba(0,255,128,0.15)] scale-[1.02]"
                        : "border-gray-800 hover:border-gray-600"
                    }`}
                  >
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}

                    <div className="flex gap-4">
                      {/* Product Image */}
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="h-8 w-8 text-gray-600" />
                        </div>
                      )}

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium text-sm leading-tight mb-2 line-clamp-2">
                          {product.name}
                        </h3>
                        {product.categoryName && (
                          <span className="inline-block text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded mb-2">
                            {product.categoryName}
                          </span>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-emerald-400 font-mono text-sm font-bold">
                            ¥{product.price?.toLocaleString()}
                          </span>
                          {product.commissionRate && (
                            <span className="text-orange-400 text-xs bg-orange-500/10 px-2 py-0.5 rounded">
                              成果報酬 {product.commissionRate}%
                            </span>
                          )}
                        </div>
                        {product.pointPrice && (
                          <span className="text-yellow-400 text-xs mt-1 block">
                            ポイント価格: {product.pointPrice?.toLocaleString()}pt
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs ${product.stock > 0 ? "text-gray-400" : "text-red-400"}`}>
                            在庫: {product.stock}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Selected Products Summary (sticky bottom) */}
        {selectedProducts.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-emerald-900/30 p-4 z-50">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{selectedProducts.length}件の商品を選択中</p>
                <p className="text-gray-400 text-xs">
                  {products
                    .filter((p: any) => selectedProducts.includes(p.id))
                    .map((p: any) => p.name)
                    .join("、")}
                </p>
              </div>
              <Button
                onClick={() => {
                  // 将来的にはここで選択した商品をAPIに送信する
                  toast.success(`${selectedProducts.length}件の商品を選択しました（この機能は準備中です）`);
                }}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white"
              >
                選択を確定
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-gray-600 text-xs">
        <p>Powered by LCJ MALL</p>
      </div>
    </div>
  );
}
