import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Coins, 
  Upload, 
  Receipt, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Camera,
  Image as ImageIcon
} from "lucide-react";

type ReceiptStatus = "pending" | "approved" | "rejected" | "on_hold";
type TransactionType = "earn" | "use" | "expire" | "refund" | "adjustment";

export default function MyPoints() {
  const { t } = useLanguage();
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Queries
  const { data: balance, isLoading: balanceLoading } = trpc.point.getBalance.useQuery();
  const { data: transactions, isLoading: transactionsLoading } = trpc.point.getTransactions.useQuery();
  const { data: receipts, isLoading: receiptsLoading } = trpc.point.getMyReceipts.useQuery();

  // Mutations
  const submitReceiptMutation = trpc.point.submitReceipt.useMutation({
    onSuccess: () => {
      toast.success(t("receipts.submitSuccess"));
      utils.point.getMyReceipts.invalidate();
      setPreviewImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error) => {
      toast.error(error.message || t("receipts.submitError"));
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ファイルサイズは10MB以下にしてください");
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPreviewImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!previewImage) return;

    setIsUploading(true);

    // Extract base64 data and mime type
    const match = previewImage.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      toast.error("画像の読み込みに失敗しました");
      setIsUploading(false);
      return;
    }

    const mimeType = match[1];
    const imageBase64 = match[2];

    submitReceiptMutation.mutate({
      imageBase64,
      mimeType,
    });
  };

  const getStatusBadge = (status: ReceiptStatus) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />{t("receipts.pending")}</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />{t("receipts.approved")}</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />{t("receipts.rejected")}</Badge>;
      case "on_hold":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><AlertTriangle className="w-3 h-3 mr-1" />{t("receipts.onHold")}</Badge>;
    }
  };

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case "earn":
      case "refund":
        return <ArrowUpCircle className="w-5 h-5 text-green-500" />;
      case "use":
      case "expire":
        return <ArrowDownCircle className="w-5 h-5 text-red-500" />;
      case "adjustment":
        return <Coins className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTransactionLabel = (type: TransactionType) => {
    switch (type) {
      case "earn": return t("points.earn");
      case "use": return t("points.use");
      case "expire": return t("points.expire");
      case "refund": return t("points.refund");
      case "adjustment": return t("points.adjustment");
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return "-";
    const currencyCode = currency || "JPY";
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  };

  return (
    <div className="container py-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="w-6 h-6 text-yellow-500" />
          {t("points.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          ポイント残高の確認とレシート申請ができます
        </p>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-lg text-yellow-800">{t("points.balance")}</CardTitle>
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <div className="space-y-4">
              <div className="text-5xl font-bold text-yellow-700">
                {balance?.balance?.toLocaleString() ?? 0}
                <span className="text-2xl ml-2">pt</span>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("points.totalEarned")}:</span>
                  <span className="ml-2 font-medium text-green-600">
                    +{balance?.totalEarned?.toLocaleString() ?? 0}pt
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("points.totalUsed")}:</span>
                  <span className="ml-2 font-medium text-red-600">
                    -{balance?.totalUsed?.toLocaleString() ?? 0}pt
                  </span>
                </div>
              </div>
              {/* Expiring Points Warning */}
              {balance?.expiring && (balance.expiring.in7Days > 0 || balance.expiring.in30Days > 0) && (
                <div className="mt-4 space-y-2">
                  {balance.expiring.in7Days > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-sm text-red-700">
                        <strong>{balance.expiring.in7Days.toLocaleString()}pt</strong> が7日以内に失効します
                      </span>
                    </div>
                  )}
                  {balance.expiring.in30Days > 0 && balance.expiring.in7Days !== balance.expiring.in30Days && (
                    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      <span className="text-sm text-yellow-700">
                        <strong>{balance.expiring.in30Days.toLocaleString()}pt</strong> が30日以内に失効予定です
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    ※ ポイントは付与日から3ヶ月で失効します
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Receipt Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {t("receipts.submit")}
          </CardTitle>
          <CardDescription>
            ライブコマースで購入したレシートを撮影してアップロードしてください。
            購入金額の2%がポイントとして還元されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                previewImage ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              {previewImage ? (
                <div className="space-y-4">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg shadow-md"
                  />
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPreviewImage(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      キャンセル
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          {t("receipts.submitting")}
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {t("receipts.submit")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="space-y-2">
                    <div className="flex justify-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      {t("receipts.uploadImage")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      タップして撮影またはギャラリーから選択
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* Notes */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• 購入日から7日以内のレシートが対象です</p>
              <p>• 1日最大10件まで申請できます</p>
              <p>• 同じレシートの重複申請はできません</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for History */}
      <Tabs defaultValue="receipts">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="receipts">
            <Receipt className="w-4 h-4 mr-2" />
            {t("receipts.myReceipts")}
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <Coins className="w-4 h-4 mr-2" />
            {t("points.history")}
          </TabsTrigger>
        </TabsList>

        {/* Receipts Tab */}
        <TabsContent value="receipts">
          <Card>
            <CardContent className="pt-6">
              {receiptsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : receipts && receipts.length > 0 ? (
                <div className="space-y-4">
                  {receipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={receipt.imageUrl}
                          alt="Receipt"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {receipt.storeName || "店舗名不明"}
                          </span>
                          {getStatusBadge(receipt.status as ReceiptStatus)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {receipt.purchaseDate
                            ? formatDate(new Date(receipt.purchaseDate))
                            : formatDate(new Date(receipt.submittedAt))}
                        </div>
                      </div>

                      {/* Amount & Points */}
                      <div className="text-right flex-shrink-0">
                        <div className="font-medium">
                          {formatCurrency(receipt.totalAmount, receipt.currency)}
                        </div>
                        {receipt.status === "approved" && receipt.pointsAwarded ? (
                          <div className="text-sm text-green-600">
                            +{receipt.pointsAwarded}pt
                          </div>
                        ) : receipt.pointsCalculated ? (
                          <div className="text-sm text-muted-foreground">
                            予定: {receipt.pointsCalculated}pt
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t("receipts.noReceipts")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardContent className="pt-6">
              {transactionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-4">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        {getTransactionIcon(tx.type as TransactionType)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {getTransactionLabel(tx.type as TransactionType)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 truncate">
                          {tx.description || "-"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(new Date(tx.createdAt))}
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <div className={`font-bold ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}pt
                        </div>
                        <div className="text-xs text-muted-foreground">
                          残高: {tx.balanceAfter.toLocaleString()}pt
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t("points.noTransactions")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
