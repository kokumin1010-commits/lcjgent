import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Receipt, CheckCircle, Clock, XCircle, AlertTriangle, ArrowLeft, Camera, X, Image as ImageIcon, Loader2, ShieldCheck, Gift } from "lucide-react";
import { Link } from "wouter";

type UploadedImage = {
  file: File;
  base64: string;
  mimeType: string;
  preview: string;
};

type AnalysisResult = {
  receiptId: number | null;
  status: "success" | "on_hold" | "analysis_failed" | "not_tiktok" | "not_delivered" | "incomplete" | "duplicate";
  message: string;
  ocrData?: {
    orderNumber?: string;
    shopName?: string;
    productName?: string;
    totalAmount?: number;
    orderDate?: string;
    items?: Array<{
      productName?: string;
      unitPrice?: number;
      quantity?: number;
      variant?: string;
    }>;
    deliveryInfo?: {
      recipientName?: string;
      phoneNumber?: string;
      postalCode?: string;
      address?: string;
      deliveryStatus?: string;
      deliveryDate?: string;
      returnDeadline?: string;
    };
    paymentInfo?: {
      subtotal?: number;
      shippingFee?: number;
      discount?: number;
      totalAmount?: number;
      paymentMethod?: string;
    };
  };
  pointsCalculated?: number;
  imageUrls?: string[];
  fraudFlags?: string[];
};

export default function ReceiptUpload() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tokenRestored, setTokenRestored] = useState(false);

  // URLパラメータからセッショントークンを復元（LINEアプリ→外部ブラウザ遷移対応）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      // トークンをlocalStorageに保存して認証を復元
      localStorage.setItem('lcj_session_token', token);
      // URLからtokenパラメータを削除（セキュリティ対策）
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.pathname + url.search);
      setTokenRestored(true);
    } else {
      setTokenRestored(true);
    }
  }, []);

  const { data: user, isLoading: userLoading } = trpc.lineLogin.me.useQuery(
    undefined,
    { enabled: tokenRestored }
  );

  // セッショントークンをlocalStorageに自動保存（永久ログイン対応）
  useEffect(() => {
    if (user?.sessionToken) {
      localStorage.setItem('lcj_session_token', user.sessionToken);
    }
  }, [user?.sessionToken]);

  const submitMutation = trpc.lineLogin.submitWebReceipt.useMutation({
    onSuccess: (data) => {
      setAnalysisResult(data as AnalysisResult);
      if (data.status === "success") {
        toast.success("レシートの解析が完了しました！");
      } else if (data.status === "on_hold") {
        toast.info("確認中です。スタッフが確認後、結果をお知らせします。");
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ファイルサイズは10MB以下にしてください");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setImages(prev => {
        if (prev.length >= 5) {
          toast.error("最大5枚まで追加できます");
          return prev;
        }
        const newImages = [...prev, {
          file,
          base64,
          mimeType: file.type,
          preview: result,
        }];
        if (newImages.length >= 2) {
          toast.info("1注文につき1回の申請です。同じ注文の画像のみ追加してください。", { duration: 4000 });
        }
        return newImages;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(processFile);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(processFile);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [processFile]);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    if (images.length === 0) {
      toast.error("画像を追加してください");
      return;
    }
    setAnalysisResult(null);
    submitMutation.mutate({
      images: images.map(img => ({
        base64: img.base64,
        mimeType: img.mimeType,
        fileName: img.file.name,
      })),
    });
  }, [images, submitMutation]);

  const resetForm = useCallback(() => {
    setImages([]);
    setAnalysisResult(null);
  }, []);

  // Loading
  if (!tokenRestored || userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Receipt className="h-12 w-12 mx-auto mb-2 text-rose-500" />
            <CardTitle>ログインが必要です</CardTitle>
            <CardDescription>レシートをアップロードするにはログインしてください</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/line-login">
              <Button className="w-full bg-[#06C755] hover:bg-[#05b04c] text-white">
                LINEでログイン
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                トップに戻る
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/mypage">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              マイページ
            </Button>
          </Link>
          <h1 className="font-bold text-lg">レシート申請</h1>
          <div className="w-20" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Instructions */}
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Gift className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-rose-700 mb-1">購入金額の1%をポイント還元</h3>
                <p className="text-sm text-rose-600/80">
                  TikTok Shopの注文詳細画面のスクリーンショットをアップロードしてください。
                  AIが自動で解析し、ポイントを計算します。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Result */}
        {analysisResult && (
          <Card className={`border-2 ${
            analysisResult.status === "success" ? "border-green-300 bg-green-50" :
            analysisResult.status === "on_hold" ? "border-amber-300 bg-amber-50" :
            "border-red-300 bg-red-50"
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {analysisResult.status === "success" ? (
                  <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                ) : analysisResult.status === "on_hold" ? (
                  <Clock className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-bold mb-1 ${
                    analysisResult.status === "success" ? "text-green-700" :
                    analysisResult.status === "on_hold" ? "text-amber-700" :
                    "text-red-700"
                  }`}>
                    {analysisResult.status === "success" ? "解析成功" :
                     analysisResult.status === "on_hold" ? "確認中" :
                     "エラー"}
                  </h3>
                  <p className={`text-sm ${
                    analysisResult.status === "success" ? "text-green-600" :
                    analysisResult.status === "on_hold" ? "text-amber-600" :
                    "text-red-600"
                  }`}>
                    {analysisResult.message}
                  </p>

                  {/* OCR Data */}
                  {analysisResult.ocrData && (
                    <div className="mt-4 bg-white/60 rounded-lg p-3 space-y-3">
                      <h4 className="font-medium text-sm text-gray-700">解析結果</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {analysisResult.ocrData.shopName && (
                          <div>
                            <span className="text-muted-foreground">店舗: </span>
                            <span className="font-medium">{analysisResult.ocrData.shopName}</span>
                          </div>
                        )}
                        {analysisResult.ocrData.orderNumber && (
                          <div>
                            <span className="text-muted-foreground">注文番号: </span>
                            <span className="font-medium text-xs">{analysisResult.ocrData.orderNumber}</span>
                          </div>
                        )}
                        {analysisResult.ocrData.productName && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">商品: </span>
                            <span className="font-medium">{analysisResult.ocrData.productName}</span>
                          </div>
                        )}
                        {analysisResult.ocrData.totalAmount != null && (
                          <div>
                            <span className="text-muted-foreground">金額: </span>
                            <span className="font-bold">¥{analysisResult.ocrData.totalAmount.toLocaleString()}</span>
                          </div>
                        )}
                        {analysisResult.ocrData.orderDate && (
                          <div>
                            <span className="text-muted-foreground">注文日: </span>
                            <span className="font-medium">{analysisResult.ocrData.orderDate}</span>
                          </div>
                        )}
                      </div>

                      {/* 商品詳細 */}
                      {analysisResult.ocrData.items && analysisResult.ocrData.items.length > 0 && (
                        <div className="border-t pt-2">
                          <h5 className="text-xs font-medium text-gray-500 mb-1">商品詳細</h5>
                          {analysisResult.ocrData.items.map((item, i) => (
                            <div key={i} className="text-sm flex justify-between items-center py-1">
                              <div>
                                <span className="font-medium">{item.productName}</span>
                                {item.variant && <span className="text-xs text-muted-foreground ml-1">({item.variant})</span>}
                              </div>
                              <div className="text-right">
                                {item.unitPrice != null && <span>¥{item.unitPrice.toLocaleString()}</span>}
                                {item.quantity != null && <span className="text-muted-foreground ml-1">x{item.quantity}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 配送先情報 */}
                      {analysisResult.ocrData.deliveryInfo && (
                        <div className="border-t pt-2">
                          <h5 className="text-xs font-medium text-gray-500 mb-1">配送先情報</h5>
                          <div className="grid grid-cols-1 gap-1 text-sm">
                            {analysisResult.ocrData.deliveryInfo.recipientName && (
                              <div>
                                <span className="text-muted-foreground">氏名: </span>
                                <span className="font-medium">{analysisResult.ocrData.deliveryInfo.recipientName}</span>
                              </div>
                            )}
                            {analysisResult.ocrData.deliveryInfo.phoneNumber && (
                              <div>
                                <span className="text-muted-foreground">電話: </span>
                                <span className="font-medium">{analysisResult.ocrData.deliveryInfo.phoneNumber}</span>
                              </div>
                            )}
                            {analysisResult.ocrData.deliveryInfo.address && (
                              <div>
                                <span className="text-muted-foreground">住所: </span>
                                <span className="font-medium">{analysisResult.ocrData.deliveryInfo.postalCode ? `〒${analysisResult.ocrData.deliveryInfo.postalCode} ` : ""}{analysisResult.ocrData.deliveryInfo.address}</span>
                              </div>
                            )}
                            {analysisResult.ocrData.deliveryInfo.deliveryStatus && (
                              <div>
                                <span className="text-muted-foreground">配送状況: </span>
                                <span className="font-medium">{analysisResult.ocrData.deliveryInfo.deliveryStatus}</span>
                              </div>
                            )}
                            {analysisResult.ocrData.deliveryInfo.deliveryDate && (
                              <div>
                                <span className="text-muted-foreground">配達日: </span>
                                <span className="font-medium">{analysisResult.ocrData.deliveryInfo.deliveryDate}</span>
                              </div>
                            )}
                            {analysisResult.ocrData.deliveryInfo.returnDeadline && (
                              <div>
                                <span className="text-muted-foreground">返品期限: </span>
                                <span className="font-medium">{analysisResult.ocrData.deliveryInfo.returnDeadline}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Points */}
                  {analysisResult.pointsCalculated != null && analysisResult.pointsCalculated > 0 && (
                    <div className="mt-3 flex items-center gap-2 bg-gradient-to-r from-rose-100 to-pink-100 rounded-lg p-3">
                      <Gift className="h-5 w-5 text-rose-500" />
                      <span className="text-sm text-rose-700">獲得予定ポイント: </span>
                      <span className="font-bold text-lg text-rose-600">{analysisResult.pointsCalculated} pt</span>
                    </div>
                  )}

                  {/* Fraud flags */}
                  {analysisResult.fraudFlags && analysisResult.fraudFlags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {analysisResult.fraudFlags.map((flag, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-amber-300 text-amber-700">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {flag === "expired_order" ? "注文日が30日以上前" :
                           flag === "high_amount" ? "高額注文" :
                           flag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Reset button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={resetForm}
                  >
                    別のレシートを申請する
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Area */}
        {!analysisResult && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5 text-rose-500" />
                  スクリーンショットをアップロード
                </CardTitle>
                <CardDescription>
                  TikTok Shopの注文詳細画面のスクリーンショットを追加してください（最大5枚）
                </CardDescription>
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-700 font-medium">
                    1注文につき1回ずつ申請してください。複数の注文がある場合は、1つ申請が完了してから次の注文を申請してください。
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop Zone */}
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                    isDragging
                      ? "border-rose-400 bg-rose-50 scale-[1.02]"
                      : "border-gray-300 hover:border-rose-300 hover:bg-rose-50/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? "text-rose-500" : "text-gray-400"}`} />
                  <p className="font-medium text-gray-700">
                    {isDragging ? "ここにドロップ" : "タップして画像を選択"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    またはドラッグ＆ドロップ（最大10MB/枚）
                  </p>
                </div>

                {/* Image Previews */}
                {images.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        アップロード画像 ({images.length}/5)
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setImages([])}
                      >
                        すべて削除
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {images.map((img, index) => (
                        <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border">
                          <img
                            src={img.preview}
                            alt={`レシート ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-2 py-1 truncate">
                            {img.file.name}
                          </div>
                        </div>
                      ))}
                      {images.length < 5 && (
                        <div
                          className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-rose-300 hover:bg-rose-50/50 transition-all"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                          <span className="text-xs text-gray-500 mt-1">追加</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white h-12 text-base"
                  disabled={images.length === 0 || submitMutation.isPending}
                  onClick={handleSubmit}
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      AI解析中...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-5 w-5 mr-2" />
                      レシートを解析して申請
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-6">
                <h3 className="font-bold text-blue-700 mb-3 text-sm">申請のポイント</h3>
                <ul className="space-y-2 text-sm text-blue-600/80">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>注文詳細画面全体が映るようにスクリーンショットを撮ってください</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>配達済みの注文のみ申請できます</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>注文番号・金額・配達ステータスが見える画像をアップロードしてください</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>注文日から30日以内の注文が対象です</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
