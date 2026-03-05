import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Receipt, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  Edit,
  Loader2,
  Hash,
  Gift,
  ExternalLink,
  Link2,
  Zap
} from "lucide-react";

const REJECTION_CATEGORIES = [
  { value: "blurry_image", label: "画像が不鮮明" },
  { value: "missing_order_number", label: "注文番号がない" },
  { value: "missing_amount", label: "金額が不明" },
  { value: "not_delivered", label: "配達未完了" },
  { value: "duplicate", label: "重複申請" },
  { value: "wrong_store", label: "対象外の店舗" },
  { value: "suspicious", label: "不正の疑い" },
  { value: "incomplete_info", label: "情報不足" },
  { value: "other", label: "その他" },
] as const;

type ReceiptStatus = "pending" | "approved" | "rejected" | "on_hold";

interface ReceiptData {
  receipt: {
    id: number;
    userId: number;
    imageUrl: string;
    storeName: string | null;
    purchaseDate: Date | null;
    totalAmount: number | null;
    currency: string | null;
    pointsCalculated: number | null;
    pointsAwarded: number | null;
    status: ReceiptStatus;
    fraudFlags: string[] | null;
    fraudScore: string | null;
    reviewNote: string | null;
    ocrRawText: string | null;
    submittedAt: Date;
    reviewedAt: Date | null;
  };
  userName: string | null;
  userEmail: string | null;
}

export default function ReceiptManagement({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useLanguage();
  const [selectedTab, setSelectedTab] = useState<ReceiptStatus | "all">("pending");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | "hold">("approve");
  const [reviewNote, setReviewNote] = useState("");
  const [rejectionCategory, setRejectionCategory] = useState<string>("other");
  const [pointsOverride, setPointsOverride] = useState<number | undefined>();
  const [editData, setEditData] = useState({
    storeName: "",
    purchaseDate: "",
    totalAmount: "",
    currency: "JPY",
  });

  const utils = trpc.useUtils();

  // Queries
  const { data: receipts, isLoading } = trpc.point.adminGetReceipts.useQuery({
    status: selectedTab === "all" ? undefined : selectedTab,
  });

  const { data: pendingCount } = trpc.point.adminGetPendingCount.useQuery();
  const { data: statistics } = trpc.point.adminGetStatistics.useQuery();
  
  // Fetch duplicate receipts detection (cross-source: LINE receipts + point requests)
  const { data: duplicateData } = trpc.point.adminDetectDuplicateReceipts.useQuery();
  
  type DupReceiptDetail = { id: number; source: "line_receipt" | "point_request"; status: string; totalAmount: number | null; userName: string; imageUrl: string | null; submittedAt: string | null };
  const duplicateInfo = useMemo(() => {
    // Map: orderNumber -> duplicate details for point_request receipts
    const orderMap = new Map<string, DupReceiptDetail[]>();
    if (duplicateData) {
      for (const dup of duplicateData) {
        const receipts = (dup as any).receipts as DupReceiptDetail[] | undefined;
        if (receipts) {
          orderMap.set(dup.orderNumber, receipts);
        }
      }
    }
    return { orderMap };
  }, [duplicateData]);

  // Mutations
  const updateOcrMutation = trpc.point.adminUpdateReceiptOcr.useMutation({
    onSuccess: () => {
      toast.success("OCRデータを更新しました");
      utils.point.adminGetReceipts.invalidate();
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const approveMutation = trpc.point.adminApproveReceipt.useMutation({
    onSuccess: (data) => {
      toast.success(`承認しました（${data.pointsAwarded}ポイント付与）`);
      utils.point.adminGetReceipts.invalidate();
      utils.point.adminGetPendingCount.invalidate();
      utils.point.adminGetStatistics.invalidate();
      setActionDialogOpen(false);
      setSelectedReceipt(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = trpc.point.adminRejectReceipt.useMutation({
    onSuccess: () => {
      toast.success("却下しました");
      utils.point.adminGetReceipts.invalidate();
      utils.point.adminGetPendingCount.invalidate();
      utils.point.adminGetStatistics.invalidate();
      setActionDialogOpen(false);
      setSelectedReceipt(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const holdMutation = trpc.point.adminHoldReceipt.useMutation({
    onSuccess: () => {
      toast.success("保留にしました");
      utils.point.adminGetReceipts.invalidate();
      utils.point.adminGetPendingCount.invalidate();
      setActionDialogOpen(false);
      setSelectedReceipt(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

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

  const openDetailDialog = (receipt: ReceiptData) => {
    setSelectedReceipt(receipt);
    setDetailDialogOpen(true);
  };

  const openEditDialog = (receipt: ReceiptData) => {
    setSelectedReceipt(receipt);
    setEditData({
      storeName: receipt.receipt.storeName || "",
      purchaseDate: receipt.receipt.purchaseDate 
        ? new Date(receipt.receipt.purchaseDate).toISOString().slice(0, 16) 
        : "",
      totalAmount: receipt.receipt.totalAmount?.toString() || "",
      currency: receipt.receipt.currency || "JPY",
    });
    setEditDialogOpen(true);
  };

  const openActionDialog = (receipt: ReceiptData, action: "approve" | "reject" | "hold") => {
    setSelectedReceipt(receipt);
    setActionType(action);
    setReviewNote("");
    setRejectionCategory("other");
    setPointsOverride(receipt.receipt.pointsCalculated || undefined);
    setActionDialogOpen(true);
  };

  const handleAction = () => {
    if (!selectedReceipt) return;

    switch (actionType) {
      case "approve":
        approveMutation.mutate({
          id: selectedReceipt.receipt.id,
          pointsOverride,
          note: reviewNote || undefined,
        });
        break;
      case "reject":
        if (!reviewNote) {
          toast.error("却下理由を入力してください");
          return;
        }
        rejectMutation.mutate({
          id: selectedReceipt.receipt.id,
          note: reviewNote,
          rejectionCategory: rejectionCategory as any,
        });
        break;
      case "hold":
        if (!reviewNote) {
          toast.error("保留理由を入力してください");
          return;
        }
        holdMutation.mutate({
          id: selectedReceipt.receipt.id,
          note: reviewNote,
        });
        break;
    }
  };

  const handleEditSubmit = () => {
    if (!selectedReceipt) return;

    updateOcrMutation.mutate({
      id: selectedReceipt.receipt.id,
      storeName: editData.storeName || undefined,
      purchaseDate: editData.purchaseDate || undefined,
      totalAmount: editData.totalAmount ? parseFloat(editData.totalAmount) : undefined,
      currency: editData.currency || undefined,
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("ja-JP");
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return "-";
    const currencyCode = currency || "JPY";
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  };

  const extractOrderNumber = (ocrRawText: string | null): string | null => {
    if (!ocrRawText) return null;
    try {
      const parsed = JSON.parse(ocrRawText);
      if (parsed.orderNumber) return parsed.orderNumber;
    } catch {
      // not JSON, try regex
    }
    // Try to find 16-19 digit number in text
    const match = ocrRawText.match(/\b(\d{16,19})\b/);
    return match ? match[1] : null;
  };

  return (
    <div className="container py-6 space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="w-6 h-6" />
              {t("receipts.title")}
            </h1>
            <p className="text-muted-foreground mt-1">
              レシート申請の審査・承認を行います
            </p>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("receipts.pendingCount")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {pendingCount ?? 0}
            </div>
          </CardContent>
        </Card>
        
        {statistics?.map((stat) => (
          <Card key={stat.status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.status === "approved" && t("receipts.approvedCount")}
                {stat.status === "rejected" && t("receipts.rejectedCount")}
                {stat.status === "on_hold" && t("receipts.onHold")}
                {stat.status === "pending" && t("receipts.pending")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.count}</div>
              {stat.status === "approved" && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(stat.totalAmount, "JPY")} / {stat.totalPoints}pt
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Receipt List */}
      <Card>
        <CardHeader>
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as ReceiptStatus | "all")}>
            <TabsList>
              <TabsTrigger value="all">すべて</TabsTrigger>
              <TabsTrigger value="pending" className="relative">
                {t("receipts.pending")}
                {pendingCount && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="on_hold">{t("receipts.onHold")}</TabsTrigger>
              <TabsTrigger value="approved">{t("receipts.approved")}</TabsTrigger>
              <TabsTrigger value="rejected">{t("receipts.rejected")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : receipts && receipts.length > 0 ? (
            <div className="space-y-4">
              {receipts.map((item) => (
                <div
                  key={item.receipt.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={item.receipt.imageUrl}
                      alt="Receipt"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => openDetailDialog(item)}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {item.receipt.storeName || "店舗名不明"}
                      </span>
                      {getStatusBadge(item.receipt.status)}
                      {item.receipt.fraudFlags && item.receipt.fraudFlags.length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {t("receipts.fraudWarning")}
                        </Badge>
                      )}
                      {(item as any).kakuhen && (item as any).kakuhen.isKakuhen && (
                        <Badge variant="outline" className="text-xs border-pink-400 text-pink-700 bg-pink-50">
                          <Zap className="w-3 h-3 mr-1" />
                          確変 {(item as any).kakuhen.boostedRate}%
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span>{item.userName || item.userEmail || `User #${item.receipt.userId}`}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(item.receipt.purchaseDate)}</span>
                    </div>
                    {/* 注文番号 + 重複検出 */}
                    {(() => {
                      const orderNum = extractOrderNumber(item.receipt.ocrRawText);
                      const dupReceipts = orderNum ? duplicateInfo.orderMap.get(orderNum) : undefined;
                      const hasDuplicate = dupReceipts && dupReceipts.length >= 2;
                      const otherDups = hasDuplicate ? dupReceipts.filter(d => !(d.source === "point_request" && d.id === item.receipt.id)) : [];
                      return (
                        <>
                          {orderNum ? (
                            <div className="mt-1.5 flex items-center gap-1.5 text-sm bg-blue-50 border border-blue-200 rounded px-2 py-1 w-fit">
                              <Hash className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span className="text-blue-600 font-medium">注文番号:</span>
                              <span className="font-mono text-sm font-bold text-blue-800">{orderNum}</span>
                              {hasDuplicate && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 ml-1">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                  重複({otherDups.length})
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1.5 flex items-center gap-1.5 text-sm bg-red-50 border border-red-200 rounded px-2 py-1 w-fit">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                              <span className="text-red-600 font-medium">注文番号なし</span>
                            </div>
                          )}
                          {hasDuplicate && otherDups.length > 0 && (
                            <div className="mt-1 bg-orange-50 border border-orange-200 rounded p-2 space-y-1">
                              <div className="flex items-center gap-1 text-xs text-orange-700 font-medium">
                                <Link2 className="w-3 h-3" />
                                重複レシート:
                              </div>
                              {otherDups.map((dup, idx) => (
                                <div key={`${dup.source}-${dup.id}-${idx}`} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1 border border-orange-100">
                                  {dup.imageUrl && (
                                    <img src={dup.imageUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border" />
                                  )}
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                                    {dup.source === "line_receipt" ? "LINE" : "Web"}
                                  </Badge>
                                  <Badge variant={dup.status === "approved" ? "default" : dup.status === "rejected" ? "destructive" : "secondary"} className="text-[9px] px-1 py-0">
                                    {dup.status === "approved" ? "承認済" : dup.status === "rejected" ? "却下" : dup.status === "on_hold" ? "保留" : "待機"}
                                  </Badge>
                                  <span className="text-muted-foreground truncate">{dup.userName}</span>
                                  {dup.totalAmount != null && (
                                    <span className="font-semibold">{formatCurrency(dup.totalAmount, "JPY")}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {/* ポイント表示 */}
                    <div className="text-sm mt-1 flex items-center gap-2">
                      <span className="font-medium">
                        {formatCurrency(item.receipt.totalAmount, item.receipt.currency)}
                      </span>
                      <span>→</span>
                      {item.receipt.status === "approved" && item.receipt.pointsAwarded !== null ? (
                        <span className="text-green-600 font-bold flex items-center gap-1">
                          <Gift className="w-3.5 h-3.5" />
                          {item.receipt.pointsAwarded}pt 付与済
                        </span>
                      ) : (
                        <span className="text-blue-600 font-medium">
                          {item.receipt.pointsCalculated ?? 0}pt（計算値）
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDetailDialog(item)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {item.receipt.status !== "approved" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => openActionDialog(item, "approve")}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {t("receipts.approve")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => openActionDialog(item, "reject")}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          {t("receipts.reject")}
                        </Button>
                      </>
                    )}
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

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>レシート詳細</DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={selectedReceipt.receipt.imageUrl}
                  alt="Receipt"
                  className="w-full h-full object-contain"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t("receipts.storeName")}</Label>
                  <p className="font-medium">{selectedReceipt.receipt.storeName || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t("receipts.purchaseDate")}</Label>
                  <p className="font-medium">{formatDate(selectedReceipt.receipt.purchaseDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t("receipts.amount")}</Label>
                  <p className="font-medium">
                    {formatCurrency(selectedReceipt.receipt.totalAmount, selectedReceipt.receipt.currency)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">注文番号</Label>
                  <p className="font-mono font-medium">
                    {extractOrderNumber(selectedReceipt.receipt.ocrRawText) || <span className="text-red-500">未検出</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t("receipts.calculatedPoints")}</Label>
                  <p className="font-medium">{selectedReceipt.receipt.pointsCalculated ?? 0}pt</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">付与済みポイント</Label>
                  <p className="font-medium">
                    {selectedReceipt.receipt.pointsAwarded !== null ? (
                      <span className="text-green-600 font-bold">{selectedReceipt.receipt.pointsAwarded}pt</span>
                    ) : (
                      <span className="text-muted-foreground">未付与</span>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t("receipts.status")}</Label>
                  <div className="mt-1">{getStatusBadge(selectedReceipt.receipt.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t("receipts.submittedAt")}</Label>
                  <p className="font-medium">{formatDate(selectedReceipt.receipt.submittedAt)}</p>
                </div>
              </div>

              {selectedReceipt.receipt.fraudFlags && selectedReceipt.receipt.fraudFlags.length > 0 && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t("receipts.fraudWarning")}
                  </div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {selectedReceipt.receipt.fraudFlags.map((flag, i) => (
                      <li key={i}>• {flag}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-500 mt-2">
                    スコア: {selectedReceipt.receipt.fraudScore}
                  </p>
                </div>
              )}

              {selectedReceipt.receipt.reviewNote && (
                <div>
                  <Label className="text-muted-foreground">{t("receipts.reviewNote")}</Label>
                  <p className="mt-1 p-2 bg-muted rounded">{selectedReceipt.receipt.reviewNote}</p>
                </div>
              )}

              {/* OCR詳細情報 */}
              {(() => {
                try {
                  const raw = selectedReceipt.receipt.ocrRawText;
                  if (!raw) return null;
                  const ocr = typeof raw === "string" ? JSON.parse(raw) : raw;
                  const hasItems = ocr.items && Array.isArray(ocr.items) && ocr.items.length > 0;
                  const hasDelivery = ocr.deliveryInfo && (ocr.deliveryInfo.recipientName || ocr.deliveryInfo.address || ocr.deliveryInfo.phoneNumber);
                  const hasPayment = ocr.paymentInfo && (ocr.paymentInfo.subtotal != null || ocr.paymentInfo.paymentMethod);
                  if (!hasItems && !hasDelivery && !hasPayment && !ocr.productName) return null;
                  return (
                    <div className="space-y-3 border-t pt-3">
                      <p className="text-sm font-medium text-muted-foreground">OCR詳細情報</p>
                      {/* 商品情報 */}
                      {hasItems ? (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                          <p className="text-xs font-medium text-blue-600 mb-2">商品詳細（{ocr.items.length}件）</p>
                          <div className="space-y-1">
                            {ocr.items.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="truncate flex-1 mr-2">{item.productName || "不明"}{item.variant ? ` (${item.variant})` : ""}</span>
                                <span className="text-muted-foreground whitespace-nowrap">
                                  {item.unitPrice != null ? `¥${item.unitPrice.toLocaleString()}` : ""}
                                  {item.quantity != null ? ` x${item.quantity}` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : ocr.productName ? (
                        <div className="text-sm">
                          <span className="text-muted-foreground">商品: </span>
                          <span className="font-medium">{ocr.productName}</span>
                        </div>
                      ) : null}
                      {/* 配送先情報 */}
                      {hasDelivery && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                          <p className="text-xs font-medium text-amber-600 mb-2">配送先情報</p>
                          <div className="space-y-1 text-sm">
                            {ocr.deliveryInfo.recipientName && (
                              <div><span className="text-muted-foreground">氏名: </span><span className="font-medium">{ocr.deliveryInfo.recipientName}</span></div>
                            )}
                            {ocr.deliveryInfo.phoneNumber && (
                              <div><span className="text-muted-foreground">電話: </span><span>{ocr.deliveryInfo.phoneNumber}</span></div>
                            )}
                            {ocr.deliveryInfo.address && (
                              <div><span className="text-muted-foreground">住所: </span><span>{ocr.deliveryInfo.postalCode ? `〒${ocr.deliveryInfo.postalCode} ` : ""}{ocr.deliveryInfo.address}</span></div>
                            )}
                            {ocr.deliveryInfo.deliveryStatus && (
                              <div><span className="text-muted-foreground">状況: </span><span className="font-medium">{ocr.deliveryInfo.deliveryStatus}</span></div>
                            )}
                            {ocr.deliveryInfo.deliveryDate && (
                              <div><span className="text-muted-foreground">配達日: </span><span>{ocr.deliveryInfo.deliveryDate}</span></div>
                            )}
                            {ocr.deliveryInfo.returnDeadline && (
                              <div><span className="text-muted-foreground">返品期限: </span><span>{ocr.deliveryInfo.returnDeadline}</span></div>
                            )}
                          </div>
                        </div>
                      )}
                      {/* 支払い情報 */}
                      {hasPayment && (
                        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                          <p className="text-xs font-medium text-green-600 mb-2">支払い情報</p>
                          <div className="space-y-1 text-sm">
                            {ocr.paymentInfo.subtotal != null && (
                              <div><span className="text-muted-foreground">小計: </span><span>¥{ocr.paymentInfo.subtotal.toLocaleString()}</span></div>
                            )}
                            {ocr.paymentInfo.shippingFee != null && (
                              <div><span className="text-muted-foreground">送料: </span><span>¥{ocr.paymentInfo.shippingFee.toLocaleString()}</span></div>
                            )}
                            {ocr.paymentInfo.discount != null && ocr.paymentInfo.discount > 0 && (
                              <div><span className="text-muted-foreground">割引: </span><span className="text-red-600">-¥{ocr.paymentInfo.discount.toLocaleString()}</span></div>
                            )}
                            {ocr.paymentInfo.tax != null && (
                              <div><span className="text-muted-foreground">税: </span><span>¥{ocr.paymentInfo.tax.toLocaleString()}</span></div>
                            )}
                            {ocr.paymentInfo.paymentMethod && (
                              <div><span className="text-muted-foreground">支払方法: </span><span className="font-medium">{ocr.paymentInfo.paymentMethod}</span></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>OCRデータ編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("receipts.storeName")}</Label>
              <Input
                value={editData.storeName}
                onChange={(e) => setEditData({ ...editData, storeName: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("receipts.purchaseDate")}</Label>
              <Input
                type="datetime-local"
                value={editData.purchaseDate}
                onChange={(e) => setEditData({ ...editData, purchaseDate: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("receipts.amount")}</Label>
              <Input
                type="number"
                value={editData.totalAmount}
                onChange={(e) => setEditData({ ...editData, totalAmount: e.target.value })}
              />
            </div>
            <div>
              <Label>通貨</Label>
              <Input
                value={editData.currency}
                onChange={(e) => setEditData({ ...editData, currency: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateOcrMutation.isPending}>
              {updateOcrMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "レシートを承認"}
              {actionType === "reject" && "レシートを却下"}
              {actionType === "hold" && "レシートを保留"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {actionType === "approve" && (
              <div>
                <Label>{t("receipts.awardedPoints")}</Label>
                <Input
                  type="number"
                  value={pointsOverride ?? ""}
                  onChange={(e) => setPointsOverride(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder={selectedReceipt?.receipt.pointsCalculated?.toString()}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  空欄の場合、算出ポイント（{selectedReceipt?.receipt.pointsCalculated ?? 0}pt）が付与されます
                </p>
              </div>
            )}
            {actionType === "reject" && (
              <div>
                <Label>却下理由カテゴリ</Label>
                <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {REJECTION_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t("receipts.reviewNote")}</Label>
              <Textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={actionType === "approve" ? "任意" : "必須"}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAction}
              disabled={approveMutation.isPending || rejectMutation.isPending || holdMutation.isPending}
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {(approveMutation.isPending || rejectMutation.isPending || holdMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {actionType === "approve" && t("receipts.approve")}
              {actionType === "reject" && t("receipts.reject")}
              {actionType === "hold" && t("receipts.hold")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
