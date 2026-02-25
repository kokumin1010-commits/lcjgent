import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Star,
  Image as ImageIcon,
  Globe,
  Upload,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

function ImageStatusBadge({ status, hasReviewImage }: { status: string | null; hasReviewImage: boolean }) {
  if (status === "confirmed") {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">確認済み</Badge>;
  }
  if (status === "auto_fetched") {
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">OGP取得済み</Badge>;
  }
  if (status === "rejected") {
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">却下</Badge>;
  }
  if (hasReviewImage) {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">レビュー画像あり</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground text-[10px]">画像なし</Badge>;
}

export default function ReviewProductList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"reviewCount" | "avgRating" | "productName">("reviewCount");
  const [imageFilter, setImageFilter] = useState<"all" | "with_image" | "without_image">("all");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showImageDialog, setShowImageDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageSize = 30;

  const utils = trpc.useUtils();

  // Fetch review product list
  const { data, isLoading, error } = trpc.productMaster.reviewProductList.useQuery({
    query: searchQuery || undefined,
    page,
    limit: pageSize,
    sortBy,
    imageFilter,
  });

  // Mutations
  const fetchOgpMutation = trpc.productMaster.fetchOgpImage.useMutation({
    onSuccess: () => {
      toast.success("OGP画像を取得しました");
      utils.productMaster.reviewProductList.invalidate();
    },
    onError: (err) => {
      toast.error("OGP画像の取得に失敗: " + err.message);
    },
  });

  const uploadImageMutation = trpc.productMaster.uploadImage.useMutation({
    onSuccess: () => {
      toast.success("画像をアップロードしました");
      utils.productMaster.reviewProductList.invalidate();
      setShowImageDialog(false);
    },
    onError: (err) => {
      toast.error("画像のアップロードに失敗: " + err.message);
    },
  });

  const updateStatusMutation = trpc.productMaster.updateImageStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      utils.productMaster.reviewProductList.invalidate();
    },
  });

  const updateSourceUrlMutation = trpc.productMaster.updateSourceUrl.useMutation({
    onSuccess: () => {
      toast.success("URLを保存しました");
      utils.productMaster.reviewProductList.invalidate();
    },
    onError: (err) => {
      toast.error("URLの保存に失敗: " + err.message);
    },
  });

  const createMasterMutation = trpc.productMaster.create.useMutation({
    onSuccess: () => {
      utils.productMaster.reviewProductList.invalidate();
    },
  });

  const bulkUpdateMutation = trpc.productMaster.bulkUpdateUrls.useMutation({
    onSuccess: (result) => {
      const successCount = result.filter((r: any) => r.success).length;
      const failCount = result.filter((r: any) => !r.success).length;
      toast.success(`一括URL登録完了: 成功 ${successCount}件${failCount > 0 ? `, 失敗 ${failCount}件` : ""}`);
      utils.productMaster.reviewProductList.invalidate();
      setShowBulkDialog(false);
      setBulkText("");
    },
    onError: (err) => {
      toast.error("一括登録に失敗: " + err.message);
    },
  });

  // Handlers
  const handleFetchOgp = useCallback(async (product: any) => {
    if (!product.productMasterId) {
      // Create master first
      const url = product.masterSourceUrl || urlInput;
      if (!url) {
        toast.error("URLを入力してください");
        return;
      }
      try {
        const result = await createMasterMutation.mutateAsync({
          canonicalName: product.productName,
        });
        const newId = (result as any)[0]?.insertId;
        if (newId) {
          await updateSourceUrlMutation.mutateAsync({ productMasterId: newId, sourceUrl: url });
          await fetchOgpMutation.mutateAsync({ productMasterId: newId, sourceUrl: url });
        }
      } catch (e) {
        toast.error("商品マスター作成に失敗しました");
      }
      return;
    }
    const url = product.masterSourceUrl || urlInput;
    if (!url) {
      toast.error("URLを入力してください");
      return;
    }
    fetchOgpMutation.mutate({ productMasterId: product.productMasterId, sourceUrl: url });
  }, [urlInput, fetchOgpMutation, createMasterMutation, updateSourceUrlMutation]);

  const handleSaveUrl = useCallback(async (product: any) => {
    if (!urlInput.trim()) {
      toast.error("URLを入力してください");
      return;
    }
    if (!product.productMasterId) {
      // Create master first, then save URL
      try {
        const result = await createMasterMutation.mutateAsync({
          canonicalName: product.productName,
        });
        const newId = (result as any)[0]?.insertId;
        if (newId) {
          await updateSourceUrlMutation.mutateAsync({ productMasterId: newId, sourceUrl: urlInput });
        }
      } catch {
        toast.error("保存に失敗しました");
      }
      return;
    }
    updateSourceUrlMutation.mutate({ productMasterId: product.productMasterId, sourceUrl: urlInput });
  }, [urlInput, updateSourceUrlMutation, createMasterMutation]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct?.productMasterId) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadImageMutation.mutate({
        productMasterId: selectedProduct.productMasterId,
        imageBase64: base64,
        contentType: file.type || "image/jpeg",
      });
    };
    reader.readAsDataURL(file);
  }, [selectedProduct, uploadImageMutation]);

  const handleBulkSubmit = useCallback(() => {
    const lines = bulkText.trim().split("\n").filter(Boolean);
    const pairs: Array<{ productName: string; sourceUrl: string }> = [];

    for (const line of lines) {
      // Support formats: "商品名\tURL", "商品名,URL", "商品名 URL"
      const parts = line.split(/[\t,]/).map(s => s.trim());
      if (parts.length >= 2) {
        const url = parts[parts.length - 1];
        const name = parts.slice(0, -1).join(",").trim();
        if (name && url.startsWith("http")) {
          pairs.push({ productName: name, sourceUrl: url });
        }
      }
    }

    if (pairs.length === 0) {
      toast.error("有効なデータがありません。「商品名,URL」の形式で入力してください");
      return;
    }

    bulkUpdateMutation.mutate({ pairs });
  }, [bulkText, bulkUpdateMutation]);

  const products = data?.products || [];
  const totalPages = data?.totalPages || 1;
  const totalCount = data?.totalCount || 0;

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">ユニーク商品数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {products.filter(p => p.masterImageStatus === "confirmed").length}
            </div>
            <div className="text-xs text-muted-foreground">画像確認済み</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {products.filter(p => p.masterImageStatus === "auto_fetched").length}
            </div>
            <div className="text-xs text-muted-foreground">OGP取得済み</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {products.filter(p => !p.masterImageUrl && !p.latestImageUrl).length}
            </div>
            <div className="text-xs text-muted-foreground">画像なし</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="商品名で検索..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as any); setPage(1); }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="reviewCount">レビュー数順</option>
            <option value="avgRating">評価順</option>
            <option value="productName">商品名順</option>
          </select>
          <select
            value={imageFilter}
            onChange={(e) => { setImageFilter(e.target.value as any); setPage(1); }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">すべて</option>
            <option value="with_image">画像あり</option>
            <option value="without_image">画像なし</option>
          </select>
          <Button variant="outline" onClick={() => setShowBulkDialog(true)}>
            <FileText className="h-4 w-4 mr-1" />
            一括URL登録
          </Button>
        </div>
      </div>

      {/* Product List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-red-500 font-medium mb-2">データの取得に失敗しました</div>
            <div className="text-sm text-muted-foreground mb-4">{error.message}</div>
            <Button variant="outline" size="sm" onClick={() => utils.productMaster.reviewProductList.invalidate()}>
              再読み込み
            </Button>
          </CardContent>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            該当する商品が見つかりません
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {products.map((product, idx) => {
            const displayImage = product.masterImageUrl || product.latestImageUrl;
            return (
              <Card key={`${product.productName}-${idx}`} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Image Thumbnail */}
                    <div
                      className="w-16 h-16 rounded-lg border bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                      onClick={() => {
                        setSelectedProduct(product);
                        setUrlInput(product.masterSourceUrl || "");
                        setShowImageDialog(true);
                      }}
                    >
                      {displayImage ? (
                        <img src={displayImage} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate">{product.productName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <StarDisplay rating={Math.round(product.avgRating || 0)} />
                            <span className="text-xs text-muted-foreground">{product.avgRating}</span>
                            <span className="text-xs text-muted-foreground">({product.reviewCount}件)</span>
                          </div>
                        </div>
                        <ImageStatusBadge
                          status={product.masterImageStatus}
                          hasReviewImage={!!product.latestImageUrl}
                        />
                      </div>

                      {/* Quick URL input row */}
                      <div className="flex items-center gap-2 mt-2">
                        {product.masterSourceUrl ? (
                          <div className="flex items-center gap-1 text-xs text-blue-600 truncate flex-1">
                            <Globe className="h-3 w-3 shrink-0" />
                            <a href={product.masterSourceUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                              {product.masterSourceUrl}
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground flex-1">URL未登録</span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setSelectedProduct(product);
                            setUrlInput(product.masterSourceUrl || "");
                            setShowImageDialog(true);
                          }}
                        >
                          <ImageIcon className="h-3 w-3 mr-1" />
                          画像管理
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            {totalCount.toLocaleString()}件中 {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)}件
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center px-3 text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Image Management Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base truncate">
              {selectedProduct?.productName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              商品画像の管理（OGP取得・手動アップロード・確認/差し替え）
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Image Preview */}
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                {(selectedProduct?.masterImageUrl || selectedProduct?.latestImageUrl) ? (
                  <img
                    src={selectedProduct.masterImageUrl || selectedProduct.latestImageUrl}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <span className="text-xs">画像なし</span>
                  </div>
                )}
              </div>
            </div>

            {selectedProduct?.masterImageStatus && selectedProduct.masterImageStatus !== "none" && (
              <div className="flex justify-center gap-2">
                <ImageStatusBadge status={selectedProduct.masterImageStatus} hasReviewImage={!!selectedProduct.latestImageUrl} />
              </div>
            )}

            {/* URL Input + OGP Fetch */}
            <div className="space-y-2">
              <label className="text-sm font-medium">公式サイトURL</label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/product"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedProduct && handleSaveUrl(selectedProduct)}
                  disabled={!urlInput.trim() || updateSourceUrlMutation.isPending}
                >
                  保存
                </Button>
              </div>
              <Button
                className="w-full"
                variant="default"
                size="sm"
                onClick={() => selectedProduct && handleFetchOgp(selectedProduct)}
                disabled={!urlInput.trim() || fetchOgpMutation.isPending}
              >
                {fetchOgpMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-1" />
                )}
                OGP画像を取得
              </Button>
            </div>

            {/* Manual Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">手動アップロード</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={async () => {
                  if (!selectedProduct?.productMasterId) {
                    // Create master first
                    try {
                      const result = await createMasterMutation.mutateAsync({
                        canonicalName: selectedProduct.productName,
                      });
                      const newId = (result as any)[0]?.insertId;
                      if (newId) {
                        setSelectedProduct({ ...selectedProduct, productMasterId: newId });
                      }
                    } catch {
                      toast.error("商品マスター作成に失敗しました");
                      return;
                    }
                  }
                  fileInputRef.current?.click();
                }}
                disabled={uploadImageMutation.isPending}
              >
                {uploadImageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                画像ファイルを選択
              </Button>
            </div>

            {/* Image Status Actions */}
            {selectedProduct?.productMasterId && selectedProduct?.masterImageUrl && (
              <div className="flex gap-2">
                {selectedProduct.masterImageStatus !== "confirmed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => {
                      updateStatusMutation.mutate({
                        productMasterId: selectedProduct.productMasterId,
                        status: "confirmed",
                      });
                      setSelectedProduct({ ...selectedProduct, masterImageStatus: "confirmed" });
                    }}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    画像を確認
                  </Button>
                )}
                {selectedProduct.masterImageStatus !== "rejected" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-red-500 border-red-200 hover:bg-red-50"
                    onClick={() => {
                      updateStatusMutation.mutate({
                        productMasterId: selectedProduct.productMasterId,
                        status: "rejected",
                      });
                      setSelectedProduct({ ...selectedProduct, masterImageStatus: "rejected" });
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    却下
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk URL Registration Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>一括URL登録</DialogTitle>
            <DialogDescription>
              商品名とURLのペアを1行ずつ入力してください。カンマまたはタブ区切りに対応しています。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              placeholder={`商品名,URL\nKYOGOKU MEGAガチャ袋,https://example.com/mega\nKYOGOKU ステムセル,https://example.com/stemcell`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
            <div className="text-xs text-muted-foreground">
              対応形式: 「商品名,URL」「商品名{"\t"}URL」（1行1商品）
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={!bulkText.trim() || bulkUpdateMutation.isPending}
            >
              {bulkUpdateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              登録
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
