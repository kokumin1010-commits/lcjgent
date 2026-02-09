import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Receipt, CheckCircle, Clock, XCircle, ArrowLeft, Gift, Camera } from "lucide-react";
import { Link } from "wouter";

export default function PointRequest() {
  const { user, loading: authLoading } = useAuth();
  const [tokenRestored, setTokenRestored] = useState(false);

  // URLパラメータからセッショントークンを復元（LINEアプリ→外部ブラウザ遷移対応）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('lcj_session_token', token);
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.pathname + url.search);
      setTokenRestored(true);
    } else {
      setTokenRestored(true);
    }
  }, []);

  // LINEログインのフォールバック認証
  const { data: lineUser, isLoading: lineUserLoading } = trpc.lineLogin.me.useQuery(
    undefined,
    { enabled: tokenRestored && !user && !authLoading }
  );

  // セッショントークンをlocalStorageに自動保存（永久ログイン対応）
  useEffect(() => {
    if (lineUser?.sessionToken) {
      localStorage.setItem('lcj_session_token', lineUser.sessionToken);
    }
  }, [lineUser?.sessionToken]);

  // 有効なユーザー（Manus OAuth または LINEログイン）
  const effectiveUser = user || (lineUser ? { id: lineUser.lineUserId, name: lineUser.displayName } : null);
  const isLoading = authLoading || (!user && lineUserLoading);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [receiptImage, setReceiptImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [deliveryImage, setDeliveryImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const deliveryInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  
  const { data: todayCount } = trpc.pointRequest.todayCount.useQuery(undefined, {
    enabled: !!effectiveUser,
  });
  
  const { data: myRequests, isLoading: requestsLoading } = trpc.pointRequest.myRequests.useQuery(undefined, {
    enabled: !!effectiveUser,
  });
  
  const { data: myBalance } = trpc.pointRequest.myBalance.useQuery(undefined, {
    enabled: !!effectiveUser,
  });

  const submitMutation = trpc.pointRequest.submit.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setOrderNumber("");
      setOrderAmount("");
      setDeliveryDate("");
      setReceiptImage(null);
      setDeliveryImage(null);
      utils.pointRequest.myRequests.invalidate();
      utils.pointRequest.todayCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleImageSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: (img: { base64: string; mimeType: string; preview: string } | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      setImage({
        base64,
        mimeType: file.type,
        preview: result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!receiptImage) {
      toast.error("レシート画像をアップロードしてください");
      return;
    }

    const amount = parseInt(orderAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("有効な注文金額を入力してください");
      return;
    }

    submitMutation.mutate({
      orderNumber,
      orderAmount: amount,
      deliveryDate: deliveryDate || undefined,
      receiptImage: {
        base64: receiptImage.base64,
        mimeType: receiptImage.mimeType,
      },
      deliveryImage: deliveryImage ? {
        base64: deliveryImage.base64,
        mimeType: deliveryImage.mimeType,
      } : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />審査中</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />承認済み</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />却下</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!effectiveUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Gift className="w-12 h-12 mx-auto text-pink-500 mb-2" />
            <CardTitle>ログインが必要です</CardTitle>
            <CardDescription>
              ポイント申請にはログインが必要です
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button className="bg-green-500 hover:bg-green-600">
                LINEでログイン
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const calculatedPoints = orderAmount ? Math.floor(parseInt(orderAmount, 10) * 0.01) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-pink-100">
        <div className="container py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">ポイント申請</h1>
            <p className="text-sm text-gray-500">TikTok Shop配達済みレシートでポイントGET</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">保有ポイント</p>
            <p className="text-xl font-bold text-pink-500">{myBalance?.balance?.toLocaleString() || 0} pt</p>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* 申請上限表示 */}
        <Card className="bg-gradient-to-r from-pink-500 to-purple-500 text-white">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">本日の申請</p>
                <p className="text-2xl font-bold">{todayCount?.count || 0} / 5 件</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">残り申請可能</p>
                <p className="text-2xl font-bold">{todayCount?.remaining || 5} 件</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 申請フォーム */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-pink-500" />
              新規ポイント申請
            </CardTitle>
            <CardDescription>
              TikTok Shopで購入した商品の「配達済み」画面のスクリーンショットをアップロードしてください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 注文番号 */}
              <div className="space-y-2">
                <Label htmlFor="orderNumber">注文番号 *</Label>
                <Input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="例: 58225775813234042"
                  required
                />
                <p className="text-xs text-gray-500">TikTok Shopの注文詳細画面に表示されている注文番号を入力してください</p>
              </div>

              {/* 注文金額 */}
              <div className="space-y-2">
                <Label htmlFor="orderAmount">注文金額（税込） *</Label>
                <div className="relative">
                  <Input
                    id="orderAmount"
                    type="number"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    placeholder="例: 9526"
                    required
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">円</span>
                </div>
                {calculatedPoints > 0 && (
                  <p className="text-sm text-pink-500 font-medium">
                    → 獲得予定ポイント: {calculatedPoints.toLocaleString()} pt（1%還元）
                  </p>
                )}
              </div>

              {/* 配達日 */}
              <div className="space-y-2">
                <Label htmlFor="deliveryDate">配達日</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>

              {/* レシート画像 */}
              <div className="space-y-2">
                <Label>配達済み画面のスクリーンショット *</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    receiptImage ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-pink-300 hover:bg-pink-50"
                  }`}
                  onClick={() => receiptInputRef.current?.click()}
                >
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageSelect(e, setReceiptImage)}
                    className="hidden"
                  />
                  {receiptImage ? (
                    <div className="space-y-2">
                      <img 
                        src={receiptImage.preview} 
                        alt="レシート" 
                        className="max-h-48 mx-auto rounded-lg shadow-md"
                      />
                      <p className="text-sm text-green-600">画像をクリックして変更</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Camera className="w-12 h-12 mx-auto text-gray-400" />
                      <p className="text-gray-500">クリックして画像を選択</p>
                      <p className="text-xs text-gray-400">「配達済み」ステータスが確認できる画面をアップロードしてください</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 注文詳細画像（任意） */}
              <div className="space-y-2">
                <Label>注文詳細画面のスクリーンショット（任意）</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    deliveryImage ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-pink-300 hover:bg-pink-50"
                  }`}
                  onClick={() => deliveryInputRef.current?.click()}
                >
                  <input
                    ref={deliveryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageSelect(e, setDeliveryImage)}
                    className="hidden"
                  />
                  {deliveryImage ? (
                    <div className="space-y-2">
                      <img 
                        src={deliveryImage.preview} 
                        alt="注文詳細" 
                        className="max-h-48 mx-auto rounded-lg shadow-md"
                      />
                      <p className="text-sm text-green-600">画像をクリックして変更</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-12 h-12 mx-auto text-gray-400" />
                      <p className="text-gray-500">クリックして画像を選択（任意）</p>
                      <p className="text-xs text-gray-400">金額や注文番号が確認できる画面があれば追加でアップロード</p>
                    </div>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                disabled={submitMutation.isPending || (todayCount?.remaining || 0) <= 0}
              >
                {submitMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    申請中...
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4 mr-2" />
                    ポイントを申請する
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 申請履歴 */}
        <Card>
          <CardHeader>
            <CardTitle>申請履歴</CardTitle>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
              </div>
            ) : myRequests && myRequests.length > 0 ? (
              <div className="space-y-4">
                {myRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">注文番号: {request.orderNumber}</p>
                      <p className="text-sm text-gray-500">
                        {request.orderAmount.toLocaleString()}円 → {request.pointsRequested}pt
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(request.createdAt).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(request.status)}
                      {request.status === "approved" && request.pointsApproved && (
                        <p className="text-sm text-green-600 mt-1">+{request.pointsApproved}pt</p>
                      )}
                      {request.status === "rejected" && request.rejectionReason && (
                        <p className="text-xs text-red-500 mt-1">{request.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>まだ申請履歴がありません</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
