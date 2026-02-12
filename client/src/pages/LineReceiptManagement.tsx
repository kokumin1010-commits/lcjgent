import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Receipt, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  Edit,
  MessageCircle,
  User,
  Calendar,
  DollarSign,
  Store,
  Image as ImageIcon,
  Images,
  Brain,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ThumbsUp,
  ThumbsDown,
  Bot,
  Hash,
  Gift,
} from "lucide-react";

type ReceiptStatus = "pending" | "approved" | "rejected" | "on_hold";

// AI rejection reason categories for learning
const REJECTION_CATEGORIES = [
  { value: "blurry_image", label: "画像が不鮮明" },
  { value: "not_receipt", label: "レシートではない" },
  { value: "duplicate", label: "重複申請" },
  { value: "expired", label: "期限切れ" },
  { value: "wrong_store", label: "対象外店舗" },
  { value: "amount_mismatch", label: "金額不一致" },
  { value: "tampered", label: "改ざんの疑い" },
  { value: "other", label: "その他" },
];

// AI approval confidence labels
const getConfidenceLabel = (score: number) => {
  if (score >= 90) return { label: "高信頼", color: "text-green-600 bg-green-50 border-green-200" };
  if (score >= 70) return { label: "中信頼", color: "text-yellow-600 bg-yellow-50 border-yellow-200" };
  return { label: "低信頼", color: "text-red-600 bg-red-50 border-red-200" };
};

export default function LineReceiptManagement() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ReceiptStatus>("pending");
  const [selectedReceipt, setSelectedReceipt] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject" | "hold"; id: number; receipt?: any } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [pointsOverride, setPointsOverride] = useState<number | undefined>();
  const [rejectionCategory, setRejectionCategory] = useState<string>("");
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [aiAutoMode, setAiAutoMode] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    storeName: "",
    purchaseDate: "",
    totalAmount: 0,
    currency: "JPY",
  });
  
  const utils = trpc.useUtils();
  
  // Fetch receipts
  const { data: receipts, isLoading } = trpc.point.adminGetLineReceipts.useQuery({
    status: activeTab,
    limit: 100,
  });
  
  // Fetch statistics
  const { data: stats } = trpc.point.adminGetLineStatistics.useQuery();
  
  // Fetch receipt details
  const { data: receiptDetails } = trpc.point.adminGetLineReceipt.useQuery(
    { id: selectedReceipt! },
    { enabled: !!selectedReceipt }
  );
  
  // Mutations
  const updateOcrMutation = trpc.point.adminUpdateLineReceiptOcr.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineReceipt.invalidate();
      setEditMode(false);
    },
  });
  
  const approveMutation = trpc.point.adminApproveLineReceipt.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
      setActionDialog(null);
      setActionNote("");
      setPointsOverride(undefined);
    },
  });
  
  const rejectMutation = trpc.point.adminRejectLineReceipt.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
      setActionDialog(null);
      setActionNote("");
      setRejectionCategory("");
    },
  });
  
  const holdMutation = trpc.point.adminHoldLineReceipt.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
      setActionDialog(null);
      setActionNote("");
    },
  });
  
  const handleAction = () => {
    if (!actionDialog) return;
    
    const noteWithCategory = actionDialog.type === "reject" && rejectionCategory
      ? `[${REJECTION_CATEGORIES.find(c => c.value === rejectionCategory)?.label || rejectionCategory}] ${actionNote}`
      : actionNote;
    
    switch (actionDialog.type) {
      case "approve":
        approveMutation.mutate({
          id: actionDialog.id,
          pointsOverride,
          note: noteWithCategory || undefined,
        });
        break;
      case "reject":
        rejectMutation.mutate({
          id: actionDialog.id,
          note: noteWithCategory,
        });
        break;
      case "hold":
        holdMutation.mutate({
          id: actionDialog.id,
          note: noteWithCategory,
        });
        break;
    }
  };
  
  const handleEditSave = () => {
    if (!selectedReceipt) return;
    updateOcrMutation.mutate({
      id: selectedReceipt,
      ...editForm,
    });
  };
  
  const openReceiptDetails = (id: number) => {
    setSelectedReceipt(id);
    setEditMode(false);
  };
  
  const startEdit = () => {
    if (receiptDetails?.receipt) {
      const r = receiptDetails.receipt;
      setEditForm({
        storeName: r.storeName || "",
        purchaseDate: r.purchaseDate ? new Date(r.purchaseDate).toISOString().split("T")[0] : "",
        totalAmount: r.totalAmount || 0,
        currency: r.currency || "JPY",
      });
      setEditMode(true);
    }
  };
  
  // Extract order number from ocrRawText JSON
  const getOrderNumber = (receipt: any): string | null => {
    try {
      if (receipt.ocrRawText) {
        const data = typeof receipt.ocrRawText === "string" ? JSON.parse(receipt.ocrRawText) : receipt.ocrRawText;
        return data.orderNumber || null;
      }
    } catch {
      // ignore parse errors
    }
    return null;
  };

  // Get all images for a receipt
  const getReceiptImages = (receipt: any): string[] => {
    const images: string[] = [];
    if (receipt.imageUrls && Array.isArray(receipt.imageUrls) && receipt.imageUrls.length > 0) {
      images.push(...receipt.imageUrls);
    } else if (receipt.imageUrl) {
      images.push(receipt.imageUrl);
    }
    return images;
  };
  
  // Open image viewer
  const openImageViewer = (images: string[], startIndex: number = 0) => {
    setViewerImages(images);
    setCurrentImageIndex(startIndex);
    setImageViewerOpen(true);
  };
  
  // Calculate AI confidence score based on OCR data
  const getAiConfidence = (receipt: any): number => {
    let score = 50; // base
    if (receipt.storeName) score += 15;
    if (receipt.totalAmount && receipt.totalAmount > 0) score += 15;
    if (receipt.purchaseDate) score += 10;
    if (receipt.ocrConfidence && Number(receipt.ocrConfidence) > 80) score += 10;
    if (receipt.fraudFlags && receipt.fraudFlags.length > 0) score -= 30;
    if (receipt.ocrRawText && receipt.ocrRawText.length > 50) score += 5;
    return Math.max(0, Math.min(100, score));
  };
  
  const getStatusBadge = (status: ReceiptStatus) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />{t("receiptStatusPending")}</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />{t("receiptStatusApproved")}</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />{t("receiptStatusRejected")}</Badge>;
      case "on_hold":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300"><AlertTriangle className="w-3 h-3 mr-1" />{t("receiptStatusOnHold")}</Badge>;
    }
  };
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  
  const formatCurrency = (amount: number | null, currency: string = "JPY") => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-500" />
            {t("lineReceiptManagement")}
          </h1>
          <p className="text-muted-foreground mt-1">
            LINEから送信されたレシートの審査・ポイント付与管理
          </p>
        </div>
        
        {/* AI Auto Mode Toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-sm font-medium">AI自動承認モード</p>
              <p className="text-xs text-muted-foreground">高信頼度のレシートを自動承認</p>
            </div>
          </div>
          <Switch 
            checked={aiAutoMode} 
            onCheckedChange={setAiAutoMode}
          />
        </div>
      </div>
      
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">{t("receiptStatusPending")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.pending || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">{t("receiptStatusApproved")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.approved || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-muted-foreground">{t("receiptStatusRejected")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.rejected || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">{t("receiptStatusOnHold")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.onHold || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">{t("totalPointsAwarded")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{(stats?.totalPointsAwarded || 0).toLocaleString()} pt</p>
          </CardContent>
        </Card>
      </div>
      
      {/* AI Auto Mode Banner */}
      {aiAutoMode && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-purple-800">AI自動承認モード有効</p>
                <p className="text-sm text-purple-600">
                  信頼度90%以上のレシートは自動承認されます。人間の判断データを蓄積中（将来的に精度向上）
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReceiptStatus)}>
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {t("receiptStatusPending")}
            {stats?.pending ? <Badge variant="secondary" className="ml-1">{stats.pending}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="on_hold" className="flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            {t("receiptStatusOnHold")}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            {t("receiptStatusApproved")}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-1">
            <XCircle className="w-4 h-4" />
            {t("receiptStatusRejected")}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : receipts?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>該当するレシートはありません</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {receipts?.map(({ receipt, lineUser }) => {
                const images = getReceiptImages(receipt);
                const aiScore = getAiConfidence(receipt);
                const confidence = getConfidenceLabel(aiScore);
                
                return (
                  <Card key={receipt.id} className="hover:shadow-md transition-shadow overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex">
                        {/* Image Gallery - Left Side */}
                        <div className="flex-shrink-0 bg-muted/30 p-3 border-r">
                          <div className="flex gap-2">
                            {images.length > 0 ? (
                              images.map((url, idx) => (
                                <div 
                                  key={idx}
                                  className="relative w-24 h-24 rounded-lg overflow-hidden cursor-pointer group border-2 border-transparent hover:border-primary transition-colors"
                                  onClick={() => openImageViewer(images, idx)}
                                >
                                  <img 
                                    src={url} 
                                    alt={`レシート ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                  {images.length > 1 && (
                                    <div className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                                      {idx + 1}/{images.length}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          {images.length > 1 && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <Images className="w-3 h-3" />
                              <span>{images.length}枚の画像</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Info - Center */}
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              {/* User & Status Row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-semibold">{lineUser?.displayName || "不明"}</span>
                                </div>
                                {getStatusBadge(receipt.status as ReceiptStatus)}
                                
                                {/* AI Confidence Badge */}
                                <Badge variant="outline" className={`${confidence.color} text-xs`}>
                                  <Bot className="w-3 h-3 mr-1" />
                                  AI {confidence.label} ({aiScore}%)
                                </Badge>
                                
                                {receipt.fraudFlags && (receipt.fraudFlags as string[]).length > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    不正フラグ
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Order Number */}
                              {(() => {
                                const orderNum = getOrderNumber(receipt);
                                return orderNum ? (
                                  <div className="flex items-center gap-1.5 text-sm bg-blue-50 border border-blue-200 rounded px-2 py-1 w-fit">
                                    <Hash className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                    <span className="text-blue-600 font-medium">注文番号:</span>
                                    <span className="font-mono text-sm font-bold text-blue-800">{orderNum}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-sm bg-red-50 border border-red-200 rounded px-2 py-1 w-fit">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                    <span className="text-red-600 font-medium">注文番号なし</span>
                                  </div>
                                );
                              })()}

                              {/* Receipt Details Grid */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Store className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate font-medium text-foreground">{receipt.storeName || "店舗不明"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="font-medium text-foreground">{receipt.purchaseDate ? new Date(receipt.purchaseDate).toLocaleDateString("ja-JP") : "-"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="font-medium text-foreground">{formatCurrency(receipt.totalAmount, receipt.currency || "JPY")}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {receipt.status === "approved" && receipt.pointsAwarded != null ? (
                                    <>
                                      <Gift className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                      <span className="text-muted-foreground">付与済:</span>
                                      <span className="font-bold text-green-600">{receipt.pointsAwarded} pt</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-muted-foreground">計算ポイント:</span>
                                      <span className="font-bold text-blue-600">{receipt.pointsCalculated || 0} pt</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {/* Submission Time */}
                              <div className="text-xs text-muted-foreground">
                                申請: {formatDate(receipt.submittedAt)}
                              </div>
                            </div>
                            
                            {/* Action Buttons - Right Side */}
                            <div className="flex flex-col gap-2 ml-4">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openReceiptDetails(receipt.id)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                詳細
                              </Button>
                              {(receipt.status === "pending" || receipt.status === "on_hold") && (
                                <>
                                  <Button 
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => setActionDialog({ type: "approve", id: receipt.id, receipt })}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    承認
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => setActionDialog({ type: "reject", id: receipt.id, receipt })}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    却下
                                  </Button>
                                  {receipt.status === "pending" && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="border-orange-300 text-orange-600 hover:bg-orange-50"
                                      onClick={() => setActionDialog({ type: "hold", id: receipt.id, receipt })}
                                    >
                                      <AlertTriangle className="w-4 h-4 mr-1" />
                                      保留
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Image Viewer Dialog */}
      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95">
          <div className="relative">
            {/* Close button handled by Dialog */}
            <div className="flex items-center justify-center min-h-[60vh] p-4">
              {viewerImages[currentImageIndex] && (
                <img 
                  src={viewerImages[currentImageIndex]} 
                  alt={`レシート画像 ${currentImageIndex + 1}`}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              )}
            </div>
            
            {/* Navigation */}
            {viewerImages.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                  onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : viewerImages.length - 1)}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                  onClick={() => setCurrentImageIndex(prev => prev < viewerImages.length - 1 ? prev + 1 : 0)}
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                
                {/* Image counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                  {currentImageIndex + 1} / {viewerImages.length}
                </div>
                
                {/* Thumbnails */}
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
                  {viewerImages.map((url, idx) => (
                    <button
                      key={idx}
                      className={`w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                        idx === currentImageIndex ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                      onClick={() => setCurrentImageIndex(idx)}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Receipt Detail Dialog */}
      <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              レシート詳細 #{selectedReceipt}
            </DialogTitle>
          </DialogHeader>
          
          {receiptDetails && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Images */}
              <div className="space-y-3">
                {(() => {
                  const images = getReceiptImages(receiptDetails.receipt);
                  return (
                    <>
                      {/* Main Image */}
                      <div className="bg-muted rounded-lg overflow-hidden cursor-pointer" onClick={() => openImageViewer(images, 0)}>
                        {images[0] ? (
                          <img 
                            src={images[0]} 
                            alt="レシート" 
                            className="w-full object-contain max-h-[500px]"
                          />
                        ) : (
                          <div className="h-64 flex items-center justify-center">
                            <ImageIcon className="w-16 h-16 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {/* Additional Images Thumbnails */}
                      {images.length > 1 && (
                        <div className="flex gap-2">
                          {images.map((url, idx) => (
                            <div 
                              key={idx}
                              className="w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-primary transition-colors"
                              onClick={() => openImageViewer(images, idx)}
                            >
                              <img src={url} alt={`画像 ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {images.length > 1 && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Images className="w-4 h-4" />
                          この申請には{images.length}枚の画像が含まれています（同一申請としてカウント）
                        </p>
                      )}
                    </>
                  );
                })()}
                
                {/* AI Analysis Card */}
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                      <Brain className="w-4 h-4" />
                      AI分析結果
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">信頼度スコア</span>
                      <Badge variant="outline" className={getConfidenceLabel(getAiConfidence(receiptDetails.receipt)).color}>
                        {getAiConfidence(receiptDetails.receipt)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OCR信頼度</span>
                      <span className="font-medium">{receiptDetails.receipt.ocrConfidence || "-"}%</span>
                    </div>
                    {receiptDetails.receipt.ocrRawText && (
                      <div>
                        <span className="text-muted-foreground block mb-1">OCRテキスト</span>
                        <div className="bg-white rounded p-2 text-xs max-h-32 overflow-y-auto border">
                          {receiptDetails.receipt.ocrRawText}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {getStatusBadge(receiptDetails.receipt.status as ReceiptStatus)}
                  {!editMode && (receiptDetails.receipt.status === "pending" || receiptDetails.receipt.status === "on_hold") && (
                    <Button variant="outline" size="sm" onClick={startEdit}>
                      <Edit className="w-4 h-4 mr-1" />
                      編集
                    </Button>
                  )}
                </div>
                
                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label>店舗名</Label>
                      <Input 
                        value={editForm.storeName}
                        onChange={(e) => setEditForm({ ...editForm, storeName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>購入日</Label>
                      <Input 
                        type="date"
                        value={editForm.purchaseDate}
                        onChange={(e) => setEditForm({ ...editForm, purchaseDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>金額</Label>
                      <Input 
                        type="number"
                        value={editForm.totalAmount}
                        onChange={(e) => setEditForm({ ...editForm, totalAmount: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>通貨</Label>
                      <Input 
                        value={editForm.currency}
                        onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleEditSave} disabled={updateOcrMutation.isPending}>
                        保存
                      </Button>
                      <Button variant="outline" onClick={() => setEditMode(false)}>
                        キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      {/* Order Number */}
                      {(() => {
                        const orderNum = getOrderNumber(receiptDetails.receipt);
                        return orderNum ? (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">注文番号</span>
                            <span className="font-mono text-sm font-medium">{orderNum}</span>
                          </div>
                        ) : null;
                      })()}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">店舗名</span>
                        <span className="font-medium">{receiptDetails.receipt.storeName || "-"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">購入日時</span>
                        <span className="font-medium">{formatDate(receiptDetails.receipt.purchaseDate)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">金額</span>
                        <span className="font-medium">{formatCurrency(receiptDetails.receipt.totalAmount, receiptDetails.receipt.currency || "JPY")}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">計算ポイント</span>
                        <span className="font-medium text-blue-600">{receiptDetails.receipt.pointsCalculated || 0} pt</span>
                      </div>
                      {receiptDetails.receipt.pointsAwarded !== null && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">付与ポイント</span>
                          <span className="font-medium text-green-600">{receiptDetails.receipt.pointsAwarded} pt</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">申請日時</span>
                        <span className="font-medium">{formatDate(receiptDetails.receipt.submittedAt)}</span>
                      </div>
                      {receiptDetails.receipt.reviewedAt && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">審査日時</span>
                          <span className="font-medium">{formatDate(receiptDetails.receipt.reviewedAt)}</span>
                        </div>
                      )}
                      {receiptDetails.receipt.reviewNote && (
                        <div className="py-2 border-b">
                          <span className="text-muted-foreground block mb-1">審査メモ</span>
                          <span className="font-medium">{receiptDetails.receipt.reviewNote}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* Fraud Detection */}
                {receiptDetails.fraudLogs && receiptDetails.fraudLogs.length > 0 && (
                  <Card className="border-orange-200 bg-orange-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                        <AlertTriangle className="w-4 h-4" />
                        不正検知ログ
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {receiptDetails.fraudLogs.map((log: any, i: number) => (
                        <div key={i} className="text-sm">
                          <Badge variant="outline" className="mr-2">
                            {log.checkType}
                          </Badge>
                          <span className="text-muted-foreground">{log.details}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                
                {/* Quick Actions in Detail View */}
                {(receiptDetails.receipt.status === "pending" || receiptDetails.receipt.status === "on_hold") && (
                  <div className="flex gap-2 pt-2">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        setSelectedReceipt(null);
                        setActionDialog({ type: "approve", id: receiptDetails.receipt.id, receipt: receiptDetails.receipt });
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      承認
                    </Button>
                    <Button 
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        setSelectedReceipt(null);
                        setActionDialog({ type: "reject", id: receiptDetails.receipt.id, receipt: receiptDetails.receipt });
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      却下
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog?.type === "approve" && <><CheckCircle className="w-5 h-5 text-green-600" /> レシートを承認</>}
              {actionDialog?.type === "reject" && <><XCircle className="w-5 h-5 text-red-600" /> レシートを却下</>}
              {actionDialog?.type === "hold" && <><AlertTriangle className="w-5 h-5 text-orange-600" /> レシートを保留</>}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.type === "approve" && "このレシートを承認してポイントを付与しますか？"}
              {actionDialog?.type === "reject" && "このレシートを却下しますか？理由を選択・入力してください。"}
              {actionDialog?.type === "hold" && "このレシートを保留にしますか？理由を入力してください。"}
            </DialogDescription>
          </DialogHeader>
          
          {/* AI Suggestion */}
          {actionDialog?.receipt && (
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">AI提案</span>
                </div>
                <div className="text-sm text-purple-600">
                  {(() => {
                    const score = getAiConfidence(actionDialog.receipt);
                    if (score >= 90) return "高信頼度のレシートです。承認を推奨します。";
                    if (score >= 70) return "中程度の信頼度です。内容を確認の上、判断してください。";
                    return "低信頼度のレシートです。慎重に確認してください。";
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="space-y-4">
            {actionDialog?.type === "approve" && (
              <div>
                <Label>ポイント数（オーバーライド）</Label>
                <Input 
                  type="number"
                  placeholder="空欄の場合は計算値を使用"
                  value={pointsOverride || ""}
                  onChange={(e) => setPointsOverride(e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            )}
            
            {/* Rejection Category (for AI learning) */}
            {actionDialog?.type === "reject" && (
              <div>
                <Label className="flex items-center gap-2">
                  却下理由カテゴリ
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                    <Brain className="w-3 h-3 mr-1" />
                    AI学習用
                  </Badge>
                </Label>
                <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="カテゴリを選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REJECTION_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  カテゴリを選択すると、AIが将来的に同様のパターンを自動判定できるようになります
                </p>
              </div>
            )}
            
            <div>
              <Label>{actionDialog?.type === "approve" ? "メモ（任意）" : "詳細理由"}</Label>
              <Textarea 
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={actionDialog?.type === "approve" ? "任意でメモを入力" : "詳細な理由を入力してください"}
                required={actionDialog?.type !== "approve"}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleAction}
              disabled={
                (actionDialog?.type === "reject" && (!actionNote || !rejectionCategory)) ||
                (actionDialog?.type === "hold" && !actionNote) ||
                approveMutation.isPending ||
                rejectMutation.isPending ||
                holdMutation.isPending
              }
              variant={actionDialog?.type === "reject" ? "destructive" : "default"}
              className={actionDialog?.type === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {approveMutation.isPending || rejectMutation.isPending || holdMutation.isPending ? (
                "処理中..."
              ) : (
                <>
                  {actionDialog?.type === "approve" && "承認する"}
                  {actionDialog?.type === "reject" && "却下する"}
                  {actionDialog?.type === "hold" && "保留にする"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
