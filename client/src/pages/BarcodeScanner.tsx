import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Camera, Search, X, Package, ArrowLeft } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Link } from "wouter";

export default function BarcodeScanner() {
  const [barcode, setBarcode] = useState("");
  const [searchBarcode, setSearchBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "barcode-scanner-container";

  const productQuery = trpc.selectionCenter.getProductByBarcode.useQuery(
    { barcode: searchBarcode },
    { enabled: !!searchBarcode }
  );

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      setScanning(true);

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // Barcode detected
          setBarcode(decodedText);
          setSearchBarcode(decodedText);
          stopScanner();
        },
        () => {
          // Scan error (ignore - just means no barcode found in this frame)
        }
      );
    } catch (err) {
      console.error("Failed to start scanner:", err);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleManualSearch = () => {
    if (barcode.trim()) {
      setSearchBarcode(barcode.trim());
    }
  };

  const handleReset = () => {
    setBarcode("");
    setSearchBarcode("");
  };

  const product = productQuery.data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/master/selection-center">
            <Button variant="ghost" size="sm" className="p-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">商品バーコード検索</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Scanner area */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Camera scanner */}
            <div
              id={scannerContainerId}
              className={`w-full rounded-lg overflow-hidden bg-black ${scanning ? "min-h-[250px]" : "hidden"}`}
            />

            {!scanning && (
              <Button onClick={startScanner} className="w-full" size="lg">
                <Camera className="h-5 w-5 mr-2" />
                カメラでスキャン
              </Button>
            )}

            {scanning && (
              <Button onClick={stopScanner} variant="destructive" className="w-full" size="lg">
                <X className="h-5 w-5 mr-2" />
                スキャン停止
              </Button>
            )}

            {/* Manual input */}
            <div className="flex gap-2">
              <Input
                placeholder="バーコード番号を入力..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualSearch(); }}
                className="flex-1"
              />
              <Button onClick={handleManualSearch} disabled={!barcode.trim()}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {searchBarcode && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                検索: <span className="font-mono font-medium text-foreground">{searchBarcode}</span>
              </p>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <X className="h-4 w-4 mr-1" />クリア
              </Button>
            </div>

            {productQuery.isLoading && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  検索中...
                </CardContent>
              </Card>
            )}

            {productQuery.isSuccess && !product && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">該当する商品が見つかりませんでした</p>
                  <p className="text-xs text-muted-foreground mt-1">バーコード: {searchBarcode}</p>
                </CardContent>
              </Card>
            )}

            {product && (
              <Card className="overflow-hidden">
                {/* Product Images */}
                {Array.isArray(product.images) && product.images.length > 0 && (
                  <div className="w-full aspect-video overflow-hidden bg-muted">
                    <img
                      src={product.images[0]}
                      alt={product.productName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <CardContent className="p-4 space-y-4">
                  {/* Product Name & Brand */}
                  <div>
                    <h2 className="text-xl font-bold">{product.productName}</h2>
                    <p className="text-sm text-muted-foreground">{product.brandName || "-"}</p>
                  </div>

                  {/* Price Info */}
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-2xl font-bold text-orange-600">
                        ¥{Number(product.price || 0).toLocaleString()}
                      </span>
                      {product.marketPrice && Number(product.marketPrice) > 0 && Number(product.marketPrice) !== Number(product.price || 0) && (
                        <span className="text-muted-foreground line-through">
                          ¥{Number(product.marketPrice).toLocaleString()}
                        </span>
                      )}
                      {product.marketPrice && Number(product.marketPrice) > Number(product.price || 0) && (
                        <Badge variant="destructive">
                          {Math.round((1 - Number(product.price || 0) / Number(product.marketPrice)) * 100)}%OFF
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">バーコード</Label>
                      <p className="font-mono text-sm font-medium">{product.barcode}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">在庫</Label>
                      <p className="text-sm font-medium">{product.stock || 0}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">佣金</Label>
                      <p className="text-sm font-medium">
                        {product.commissionType === "percentage"
                          ? `${product.commissionValue}%`
                          : `¥${product.commissionValue}`}
                        {product.commissionType === "percentage" && product.price && product.commissionValue && (
                          <span className="text-orange-600 ml-1">
                            (¥{Math.round(Number(product.price) * Number(product.commissionValue) / 100).toLocaleString()})
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ステータス</Label>
                      <Badge variant={product.status === "published" ? "default" : "secondary"} className="mt-0.5">
                        {product.status === "published" ? "公開中" : product.status === "draft" ? "下書き" : product.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Selling Points */}
                  {product.sellingPoints && (
                    <div>
                      <Label className="text-xs text-muted-foreground">セールスポイント</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{product.sellingPoints}</p>
                    </div>
                  )}

                  {/* Description */}
                  {product.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground">商品説明</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{product.description}</p>
                    </div>
                  )}

                  {/* Product Link */}
                  {product.productLink && (
                    <div>
                      <Label className="text-xs text-muted-foreground">商品リンク</Label>
                      <a
                        href={product.productLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all block mt-1"
                      >
                        {product.productLink}
                      </a>
                    </div>
                  )}

                  {/* All images */}
                  {Array.isArray(product.images) && product.images.length > 1 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">商品画像</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {product.images.map((img: string, idx: number) => (
                          <div key={idx} className="aspect-square overflow-hidden rounded-lg bg-muted">
                            <img src={img} alt={`${product.productName} ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
