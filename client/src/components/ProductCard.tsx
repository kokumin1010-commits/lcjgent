/**
 * ProductCard - 商品紹介カード（手卡）HTMLテンプレート
 *
 * PPTXの手卡デザインをHTMLで忠実に再現。
 * html-to-imageで画像化してダウンロード可能。
 *
 * 2つのデータソースに対応:
 * 1. brand_portal_products (ポータル経由)
 * 2. brand_products (商品パフォーマンス / 既存データ)
 *
 * レイアウト:
 * - ヘッダー: 製品名・ライセンス料配分率・仕様・通常価格・ライブ配信価格・割引率・販売メカニズム
 * - 左カラム(60%): ターゲット層・コアセールスポイント①〜⑥・使用方法
 * - 右カラム(40%): 商品画像・ブランドバナー・発送情報
 */
import { useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Download, Image as ImageIcon } from "lucide-react";

// ============================================================
// Universal product data interface
// Accepts both brand_portal_products and brand_products fields
// ============================================================
interface ProductData {
  productName: string;
  productCode?: string | null;
  // brand_portal_products fields
  specifications?: string | null;
  livePrice?: number | null;
  adjustedLivePrice?: number | null;
  costPrice?: number | null;
  adjustedDiscountRate?: string | null;
  sellingPoint1?: string | null;
  sellingPoint2?: string | null;
  sellingPoint3?: string | null;
  sellingPoint4?: string | null;
  sellingPoint5?: string | null;
  sellingPoint6?: string | null;
  salesMechanism?: string | null;
  giftItems?: string | null;
  adjustedGiftItems?: string | null;
  productDescription?: string | null;
  category?: string | null;
  ingredients?: string | null;
  // brand_products fields
  specialPrice?: number | null;
  discountRate?: string | null;
  sampleProduct?: string | null;
  purchasePrice?: number | null;
  remarks?: string | null;
  releaseDate?: string | null;
  catchCopy?: string | null;
  features?: string | null;
  productDetails?: string | null;
  accessories?: string | null;
  // Shared fields
  listPrice?: number | null;
  commissionRate?: string | null;
  targetAudience?: string | null;
  usageMethod?: string | null;
  shippingInfo?: string | null;
  imageUrls?: string[] | null;
}

interface ProductCardProps {
  product: ProductData;
  brand?: {
    name?: string | null;
    nameJa?: string | null;
    logoUrl?: string | null;
  } | null;
  showDownload?: boolean;
}

/**
 * Normalize product data from either source into unified display fields
 */
function normalizeProduct(product: ProductData) {
  // Live price: portal's adjustedLivePrice > portal's livePrice > brand_products' specialPrice
  const finalLivePrice = product.adjustedLivePrice || product.livePrice || product.specialPrice;
  const listPrice = product.listPrice || 0;

  // Discount rate: portal's adjustedDiscountRate > brand_products' discountRate > auto-calc
  const discountRate = product.adjustedDiscountRate
    || product.discountRate
    || (finalLivePrice && listPrice ? `${Math.round((1 - Number(finalLivePrice) / Number(listPrice)) * 100)}%` : "");

  // Mechanism: portal's salesMechanism > portal's adjustedGiftItems > portal's giftItems > brand_products' sampleProduct + accessories
  const mechanism = product.salesMechanism
    || product.adjustedGiftItems
    || product.giftItems
    || [product.sampleProduct, product.accessories].filter(Boolean).join(" / ")
    || "";

  // Specifications: portal's specifications > brand_products' productDetails
  const specifications = product.specifications || product.productDetails || "";

  // Selling points: portal's sellingPoint1-6 > brand_products' features (split by newlines)
  let sellingPoints: string[] = [];
  const portalPoints = [
    product.sellingPoint1,
    product.sellingPoint2,
    product.sellingPoint3,
    product.sellingPoint4,
    product.sellingPoint5,
    product.sellingPoint6,
  ].filter(Boolean) as string[];

  if (portalPoints.length > 0) {
    sellingPoints = portalPoints;
  } else if (product.features) {
    // Split features text into individual points
    sellingPoints = product.features
      .split(/[\n\r]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  // Image
  const imageUrl = product.imageUrls?.[0] || null;

  return {
    finalLivePrice,
    listPrice,
    discountRate,
    mechanism,
    specifications,
    sellingPoints,
    imageUrl,
  };
}

export default function ProductCard({ product, brand, showDownload = true }: ProductCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `手卡_${product.productName}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("手卡画像の生成に失敗しました:", err);
    }
  }, [product.productName]);

  const { finalLivePrice, listPrice, discountRate, mechanism, specifications, sellingPoints, imageUrl } = normalizeProduct(product);

  return (
    <div>
      {showDownload && (
        <div className="flex gap-2 mb-3">
          <Button onClick={handleDownload} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-4 h-4 mr-1.5" />
            画像ダウンロード
          </Button>
        </div>
      )}

      {/* Card template */}
      <div
        ref={cardRef}
        style={{
          width: "1200px",
          fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif",
          backgroundColor: "#ffffff",
          border: "2px solid #000000",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Header Row 1 */}
        <div style={{ display: "flex", borderBottom: "2px solid #000" }}>
          {/* 製品名 */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{ backgroundColor: "#000", color: "#fff", padding: "8px 12px", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              製品名
            </div>
            <div style={{ padding: "8px 16px", fontWeight: 700, fontSize: "18px", display: "flex", alignItems: "center", borderRight: "1px solid #000", minWidth: "180px" }}>
              {product.productName}
            </div>
          </div>
          {/* ライセンス料配分率 */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{ backgroundColor: "#000", color: "#fff", padding: "8px 10px", fontWeight: 700, fontSize: "12px", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              ライセンス<br />料配分率
            </div>
            <div style={{ padding: "8px 16px", fontWeight: 700, fontSize: "18px", display: "flex", alignItems: "center", borderRight: "1px solid #000", minWidth: "60px" }}>
              {product.commissionRate || "-"}
            </div>
          </div>
          {/* 仕様 */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{ backgroundColor: "#000", color: "#fff", padding: "8px 12px", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              仕様
            </div>
            <div style={{ padding: "8px 16px", fontWeight: 700, fontSize: "18px", display: "flex", alignItems: "center", borderRight: "1px solid #000", minWidth: "80px" }}>
              {specifications || "-"}
            </div>
          </div>
          {/* 通常価格 */}
          <div style={{ display: "flex", alignItems: "stretch", marginLeft: "auto" }}>
            <div style={{ backgroundColor: "#cc0000", color: "#fff", padding: "8px 12px", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              通常価格
            </div>
            <div style={{ padding: "8px 16px", fontWeight: 700, fontSize: "18px", display: "flex", alignItems: "center" }}>
              {listPrice ? `${Number(listPrice).toLocaleString()}円（税込）` : "-"}
            </div>
          </div>
        </div>

        {/* Header Row 2 */}
        <div style={{ display: "flex", borderBottom: "2px solid #000" }}>
          {/* ライブ配信価格 */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{ backgroundColor: "#cc0000", color: "#ffdd00", padding: "8px 10px", fontWeight: 700, fontSize: "12px", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              ライブ配<br />信価格:
            </div>
            <div style={{ padding: "8px 16px", fontWeight: 700, fontSize: "18px", display: "flex", alignItems: "center", borderRight: "1px solid #000", minWidth: "160px" }}>
              {finalLivePrice ? `${Number(finalLivePrice).toLocaleString()}円（税込）` : "-"}
            </div>
          </div>
          {/* 割引率 */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{ backgroundColor: "#000", color: "#fff", padding: "8px 12px", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              割引率
            </div>
            <div style={{ padding: "8px 16px", fontWeight: 700, fontSize: "22px", display: "flex", alignItems: "center", borderRight: "1px solid #000", minWidth: "80px" }}>
              {discountRate || "-"}
            </div>
          </div>
          {/* ライブ配信販売メカニズム */}
          <div style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
            <div style={{ backgroundColor: "#000", color: "#fff", padding: "8px 10px", fontWeight: 700, fontSize: "11px", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              ライブ配信販売メ<br />カニズム
            </div>
            <div style={{ padding: "8px 16px", fontWeight: 500, fontSize: "14px", display: "flex", alignItems: "center", flex: 1 }}>
              {mechanism || "-"}
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div style={{ display: "flex", minHeight: "500px" }}>
          {/* Left column (60%) */}
          <div style={{ width: "60%", padding: "16px 20px", borderRight: "1px solid #ccc" }}>
            {/* ターゲット層 */}
            {product.targetAudience && (
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ fontWeight: 900, fontSize: "18px", marginBottom: "8px", borderBottom: "2px solid #000", paddingBottom: "4px", display: "inline-block" }}>
                  ターゲット層：
                </h3>
                <div style={{ fontSize: "14px", lineHeight: "1.8" }}>
                  {product.targetAudience.split(/[、,\n]/).map((item, i) => (
                    <div key={i}>・{item.trim()}</div>
                  ))}
                </div>
              </div>
            )}

            {/* コアセールスポイント */}
            {sellingPoints.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ fontWeight: 900, fontSize: "18px", marginBottom: "8px", borderBottom: "2px solid #000", paddingBottom: "4px", display: "inline-block" }}>
                  コアセールスポイント：
                </h3>
                <div style={{ fontSize: "13px", lineHeight: "1.8" }}>
                  {sellingPoints.map((sp, i) => (
                    <div key={i} style={{ marginBottom: "4px" }}>
                      {(() => {
                        const circledNum = "①②③④⑤⑥"[i] || `${i + 1}.`;
                        const match = sp.match(/^(.+?)[：:]\s*(.+)$/);
                        if (match) {
                          return (
                            <>
                              {circledNum} <span style={{ fontWeight: 700 }}>{match[1]}：</span>{match[2]}
                            </>
                          );
                        }
                        return <>{circledNum} {sp}</>;
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* キャッチコピー (brand_products only) */}
            {product.catchCopy && (
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ fontWeight: 900, fontSize: "18px", marginBottom: "8px", borderBottom: "2px solid #cc0000", paddingBottom: "4px", display: "inline-block", color: "#cc0000" }}>
                  キャッチコピー：
                </h3>
                <div style={{ fontSize: "14px", lineHeight: "1.8", fontWeight: 600 }}>
                  {product.catchCopy}
                </div>
              </div>
            )}

            {/* 使用方法 */}
            {product.usageMethod && (
              <div style={{ marginBottom: "12px" }}>
                <h3 style={{ fontWeight: 900, fontSize: "18px", marginBottom: "8px", color: "#cc0000", borderBottom: "2px solid #cc0000", paddingBottom: "4px", display: "inline-block" }}>
                  使用方法：
                </h3>
                <div style={{ fontSize: "13px", lineHeight: "1.8" }}>
                  {product.usageMethod}
                </div>
              </div>
            )}

            {/* 備考 (brand_products only) */}
            {product.remarks && (
              <div style={{ marginBottom: "12px" }}>
                <h3 style={{ fontWeight: 900, fontSize: "16px", marginBottom: "8px", borderBottom: "1px solid #999", paddingBottom: "4px", display: "inline-block", color: "#666" }}>
                  備考：
                </h3>
                <div style={{ fontSize: "12px", lineHeight: "1.6", color: "#666" }}>
                  {product.remarks}
                </div>
              </div>
            )}
          </div>

          {/* Right column (40%) */}
          <div style={{ width: "40%", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Product image */}
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.productName}
                style={{ maxWidth: "100%", maxHeight: "250px", objectFit: "contain", marginBottom: "16px" }}
                crossOrigin="anonymous"
              />
            ) : (
              <div style={{
                width: "200px", height: "200px", backgroundColor: "#f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "8px", marginBottom: "16px", color: "#9ca3af", fontSize: "14px"
              }}>
                商品画像
              </div>
            )}

            {/* Brand banner area */}
            {brand && (
              <div style={{
                width: "100%", backgroundColor: "#8b1a2b",
                borderRadius: "4px", padding: "12px", marginBottom: "16px",
                textAlign: "center", color: "#fff"
              }}>
                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
                  {brand.nameJa || brand.name || ""}
                </div>
                {brand.logoUrl && (
                  <img src={brand.logoUrl} alt="" style={{ maxHeight: "40px", margin: "0 auto" }} crossOrigin="anonymous" />
                )}
              </div>
            )}

            {/* Shipping info */}
            <div style={{
              width: "100%", border: "2px dashed #666",
              borderRadius: "4px", padding: "10px", fontSize: "11px",
              lineHeight: "1.6", color: "#333", marginTop: "auto"
            }}>
              {product.shippingInfo ? (
                <div>{product.shippingInfo}</div>
              ) : (
                <>
                  <div>発送元住所：</div>
                  <div>製造年月日：　使用期限：</div>
                  <div>物流に関する説明：</div>
                  <div>ライブ配信後のアフターサービス保証：</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ProductCardMini - 手卡のサムネイル表示用コンポーネント
 * brand_portal_products と brand_products の両方に対応
 */
export function ProductCardMini({ product, onClick }: {
  product: {
    id: number;
    productName: string;
    listPrice?: number | null;
    livePrice?: number | null;
    adjustedLivePrice?: number | null;
    specialPrice?: number | null;
    imageUrls?: string[] | null;
    status?: string;
    commissionRate?: string | null;
  };
  onClick?: () => void;
}) {
  const imageUrl = product.imageUrls?.[0];
  const finalPrice = product.adjustedLivePrice || product.livePrice || product.specialPrice;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-16 h-16 object-contain rounded bg-gray-50" />
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{product.productName}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
            {product.listPrice && <span>¥{Number(product.listPrice).toLocaleString()}</span>}
            {finalPrice && <span className="text-blue-600 font-medium">→ ¥{Number(finalPrice).toLocaleString()}</span>}
            {product.commissionRate && <span className="text-green-600">報酬 {product.commissionRate}</span>}
          </div>
        </div>
        <div className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
          手卡を見る →
        </div>
      </div>
    </div>
  );
}
