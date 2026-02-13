import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Calculator,
  Keyboard,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
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
  const [actionNote, setActionNote] = useState("");
  const [rejectionCategory, setRejectionCategory] = useState<string>("");
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [aiAutoMode, setAiAutoMode] = useState(false);
  const [orderNumberDialog, setOrderNumberDialog] = useState<{ id: number; currentOrderNumber: string | null; images: string[] } | null>(null);
  const [orderNumberInput, setOrderNumberInput] = useState("");
  
  // Calculator state
  const [calcReceiptId, setCalcReceiptId] = useState<number | null>(null);
  const [calcAmount, setCalcAmount] = useState<string>("");
  const [calcPoints, setCalcPoints] = useState<number>(0);
  
  // Reject/Hold dialog state (separate from calculator approve flow)
  const [actionDialog, setActionDialog] = useState<{ type: "reject" | "hold"; id: number; receipt?: any } | null>(null);
  
  // Keyboard shortcut help
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  
  // Ref to track if any dialog/input is active
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  
  // Fetch receipt details (for detail dialog)
  const { data: receiptDetails } = trpc.point.adminGetLineReceipt.useQuery(
    { id: selectedReceipt! },
    { enabled: !!selectedReceipt }
  );
  
  // Auto-calculate 1% points when amount changes
  useEffect(() => {
    const amount = parseFloat(calcAmount);
    if (!isNaN(amount) && amount > 0) {
      setCalcPoints(Math.floor(amount * 0.01));
    } else {
      setCalcPoints(0);
    }
  }, [calcAmount]);
  
  // When a receipt is selected for calculator, pre-fill amount
  const selectedCalcReceipt = useMemo(() => {
    if (!calcReceiptId || !receipts) return null;
    return receipts.find(r => r.receipt.id === calcReceiptId) || null;
  }, [calcReceiptId, receipts]);
  
  useEffect(() => {
    if (selectedCalcReceipt) {
      const amount = selectedCalcReceipt.receipt.totalAmount;
      setCalcAmount(amount ? String(amount) : "");
    }
  }, [selectedCalcReceipt]);
  
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
      // Clear calculator after successful approval
      setCalcReceiptId(null);
      setCalcAmount("");
      setCalcPoints(0);
      setActionNote("");
    },
  });
  
  const rejectMutation = trpc.point.adminRejectLineReceipt.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
      setActionDialog(null);
      setActionNote("");
      setRejectionCategory("");
      // Clear calculator selection if rejected receipt was selected
      if (actionDialog && actionDialog.id === calcReceiptId) {
        setCalcReceiptId(null);
        setCalcAmount("");
        setCalcPoints(0);
      }
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
  
  const updateOrderNumberMutation = trpc.point.adminUpdateLineReceiptOrderNumber.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineReceipt.invalidate();
      setOrderNumberDialog(null);
      setOrderNumberInput("");
    },
  });
  
  const handleOrderNumberSave = () => {
    if (!orderNumberDialog || !orderNumberInput.trim()) return;
    updateOrderNumberMutation.mutate({
      id: orderNumberDialog.id,
      orderNumber: orderNumberInput.trim(),
    });
  };
  
  const openOrderNumberDialog = (receipt: any) => {
    const images = getReceiptImages(receipt);
    const currentOrderNum = getOrderNumber(receipt);
    setOrderNumberDialog({ id: receipt.id, currentOrderNumber: currentOrderNum, images });
    setOrderNumberInput(currentOrderNum || "");
  };
  
  // Handle approve from calculator panel
  const handleCalcApprove = () => {
    if (!calcReceiptId) return;
    approveMutation.mutate({
      id: calcReceiptId,
      pointsOverride: calcPoints > 0 ? calcPoints : undefined,
      note: actionNote || undefined,
    });
  };
  
  // Handle reject/hold from action dialog
  const handleAction = () => {
    if (!actionDialog) return;
    
    const noteWithCategory = actionDialog.type === "reject" && rejectionCategory
      ? `[${REJECTION_CATEGORIES.find(c => c.value === rejectionCategory)?.label || rejectionCategory}] ${actionNote}`
      : actionNote;
    
    switch (actionDialog.type) {
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
  
  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if any dialog is open
    if (selectedReceipt || actionDialog || imageViewerOpen || orderNumberDialog || showShortcutHelp) return;
    
    // Skip if user is typing in an input/textarea/select
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable) return;
    
    const receiptList = receipts || [];
    const currentIndex = receiptList.findIndex(r => r.receipt.id === calcReceiptId);
    
    switch (e.key) {
      case "ArrowDown":
      case "j": {
        e.preventDefault();
        if (receiptList.length === 0) return;
        const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, receiptList.length - 1);
        selectForCalc(receiptList[nextIndex].receipt.id);
        setTimeout(() => {
          const card = document.querySelector(`[data-receipt-id="${receiptList[nextIndex].receipt.id}"]`);
          card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
        break;
      }
      case "ArrowUp":
      case "k": {
        e.preventDefault();
        if (receiptList.length === 0) return;
        const prevIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        selectForCalc(receiptList[prevIndex].receipt.id);
        setTimeout(() => {
          const card = document.querySelector(`[data-receipt-id="${receiptList[prevIndex].receipt.id}"]`);
          card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (calcReceiptId && calcPoints > 0 && selectedCalcReceipt && 
            (selectedCalcReceipt.receipt.status === "pending" || selectedCalcReceipt.receipt.status === "on_hold") &&
            !approveMutation.isPending) {
          handleCalcApprove();
        }
        break;
      }
      case "r":
      case "R": {
        e.preventDefault();
        if (selectedCalcReceipt && (selectedCalcReceipt.receipt.status === "pending" || selectedCalcReceipt.receipt.status === "on_hold")) {
          setActionDialog({ type: "reject", id: selectedCalcReceipt.receipt.id, receipt: selectedCalcReceipt.receipt });
        }
        break;
      }
      case "h":
      case "H": {
        e.preventDefault();
        if (selectedCalcReceipt && selectedCalcReceipt.receipt.status === "pending") {
          setActionDialog({ type: "hold", id: selectedCalcReceipt.receipt.id, receipt: selectedCalcReceipt.receipt });
        }
        break;
      }
      case "d":
      case "D": {
        e.preventDefault();
        if (calcReceiptId) {
          openReceiptDetails(calcReceiptId);
        }
        break;
      }
      case "Escape": {
        e.preventDefault();
        if (calcReceiptId) {
          setCalcReceiptId(null);
          setCalcAmount("");
          setCalcPoints(0);
          setActionNote("");
        }
        break;
      }
      case "?": {
        e.preventDefault();
        setShowShortcutHelp(true);
        break;
      }
    }
  }, [receipts, calcReceiptId, calcPoints, selectedCalcReceipt, approveMutation.isPending, selectedReceipt, actionDialog, imageViewerOpen, orderNumberDialog, showShortcutHelp]);
  
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
  
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
  
  // Select receipt for calculator
  const selectForCalc = (receiptId: number) => {
    setCalcReceiptId(receiptId);
    setActionNote("");
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
        
        {/* Keyboard Shortcut Help Button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setShowShortcutHelp(true)}
        >
          <Keyboard className="w-4 h-4" />
          <span className="hidden sm:inline">ショートカット</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border">?</kbd>
        </Button>
        
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
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ReceiptStatus); setCalcReceiptId(null); setCalcAmount(""); }}>
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
            /* ===== 2-COLUMN LAYOUT ===== */
            <div className="flex gap-6">
              {/* LEFT COLUMN: Calculator + Approve Panel */}
              <div className="w-[380px] flex-shrink-0">
                <div className="sticky top-4 space-y-4">
                  {/* Calculator Card */}
                  <Card className={`border-2 transition-colors ${calcReceiptId ? "border-green-300 shadow-lg" : "border-dashed border-muted-foreground/30"}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-600" />
                        ポイント計算機
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!calcReceiptId ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p className="text-sm">右のレシート一覧から<br />レシートを選択してください</p>
                          <div className="mt-4 flex flex-col items-center gap-1.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              <kbd className="px-1.5 py-0.5 font-mono bg-muted rounded border text-[10px]">↓</kbd>
                              <kbd className="px-1.5 py-0.5 font-mono bg-muted rounded border text-[10px]">↑</kbd>
                              <span>で選択</span>
                              <kbd className="px-1.5 py-0.5 font-mono bg-muted rounded border text-[10px]">Enter</kbd>
                              <span>で承認</span>
                            </div>
                            <button 
                              onClick={() => setShowShortcutHelp(true)}
                              className="text-blue-500 hover:text-blue-700 underline underline-offset-2"
                            >
                              全てのショートカットを見る
                            </button>
                          </div>
                        </div>
                      ) : selectedCalcReceipt ? (
                        <>
                          {/* Selected Receipt Info */}
                          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold text-sm">{selectedCalcReceipt.lineUser?.displayName || "不明"}</span>
                              {getStatusBadge(selectedCalcReceipt.receipt.status as ReceiptStatus)}
                            </div>
                            
                            {/* Order Number */}
                            {(() => {
                              const orderNum = getOrderNumber(selectedCalcReceipt.receipt);
                              return orderNum ? (
                                <div className="flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 w-fit">
                                  <Hash className="w-3 h-3 text-blue-600" />
                                  <span className="font-mono font-bold text-blue-800">{orderNum}</span>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => openOrderNumberDialog(selectedCalcReceipt.receipt)}
                                  className="flex items-center gap-1.5 text-xs bg-red-50 border border-red-200 rounded px-2 py-1 w-fit hover:bg-red-100 transition-colors"
                                >
                                  <AlertTriangle className="w-3 h-3 text-red-500" />
                                  <span className="text-red-600 font-medium">注文番号なし</span>
                                  <Edit className="w-3 h-3 text-red-400" />
                                </button>
                              );
                            })()}
                            
                            {/* Store & Date */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Store className="w-3 h-3" />
                                {selectedCalcReceipt.receipt.storeName || "店舗不明"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {selectedCalcReceipt.receipt.purchaseDate ? new Date(selectedCalcReceipt.receipt.purchaseDate).toLocaleDateString("ja-JP") : "-"}
                              </span>
                            </div>
                            
                            {/* Receipt Images (thumbnails) */}
                            {(() => {
                              const images = getReceiptImages(selectedCalcReceipt.receipt);
                              return images.length > 0 ? (
                                <div className="flex gap-2 mt-2">
                                  {images.map((url, idx) => (
                                    <div 
                                      key={idx}
                                      className="relative w-16 h-16 rounded overflow-hidden cursor-pointer group border hover:border-primary transition-colors"
                                      onClick={() => openImageViewer(images, idx)}
                                    >
                                      <img src={url} alt={`レシート ${idx + 1}`} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                            
                            {/* AI Confidence */}
                            {(() => {
                              const aiScore = getAiConfidence(selectedCalcReceipt.receipt);
                              const confidence = getConfidenceLabel(aiScore);
                              return (
                                <Badge variant="outline" className={`${confidence.color} text-xs mt-1`}>
                                  <Bot className="w-3 h-3 mr-1" />
                                  AI {confidence.label} ({aiScore}%)
                                </Badge>
                              );
                            })()}
                          </div>
                          
                          {/* Amount Input */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                              <DollarSign className="w-4 h-4 text-blue-600" />
                              購入金額
                            </Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                              <Input
                                type="number"
                                value={calcAmount}
                                onChange={(e) => setCalcAmount(e.target.value)}
                                placeholder="金額を入力"
                                className="pl-8 text-lg font-bold h-12"
                              />
                            </div>
                          </div>
                          
                          {/* Auto-calculated Points */}
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-green-600 font-medium">1%ポイント（自動計算）</p>
                                <p className="text-3xl font-bold text-green-700 mt-1">{calcPoints.toLocaleString()} <span className="text-base font-normal">pt</span></p>
                              </div>
                              <div className="p-3 rounded-full bg-green-100">
                                <Gift className="w-6 h-6 text-green-600" />
                              </div>
                            </div>
                            {selectedCalcReceipt.receipt.pointsCalculated != null && selectedCalcReceipt.receipt.pointsCalculated !== calcPoints && (
                              <p className="text-xs text-muted-foreground mt-2">
                                元の計算値: {selectedCalcReceipt.receipt.pointsCalculated} pt
                              </p>
                            )}
                          </div>
                          
                          {/* Note */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">メモ（任意）</Label>
                            <Textarea 
                              value={actionNote}
                              onChange={(e) => setActionNote(e.target.value)}
                              placeholder="任意でメモを入力"
                              className="h-16 text-sm resize-none"
                            />
                          </div>
                          
                          {/* Action Buttons */}
                          {(selectedCalcReceipt.receipt.status === "pending" || selectedCalcReceipt.receipt.status === "on_hold") && (
                            <div className="space-y-2 pt-2">
                              <Button 
                                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-base font-bold shadow-md"
                                onClick={handleCalcApprove}
                                disabled={approveMutation.isPending || calcPoints <= 0}
                              >
                                {approveMutation.isPending ? (
                                  "承認処理中..."
                                ) : (
                                  <>
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                    承認する（{calcPoints} pt 付与）
                                  </>
                                )}
                              </Button>
                              <div className="flex gap-2">
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => setActionDialog({ type: "reject", id: selectedCalcReceipt.receipt.id, receipt: selectedCalcReceipt.receipt })}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  却下
                                </Button>
                                {selectedCalcReceipt.receipt.status === "pending" && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50"
                                    onClick={() => setActionDialog({ type: "hold", id: selectedCalcReceipt.receipt.id, receipt: selectedCalcReceipt.receipt })}
                                  >
                                    <AlertTriangle className="w-4 h-4 mr-1" />
                                    保留
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Already processed info */}
                          {selectedCalcReceipt.receipt.status === "approved" && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                              <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                              <p className="text-sm font-medium text-green-700">承認済み</p>
                              {selectedCalcReceipt.receipt.pointsAwarded != null && (
                                <p className="text-xs text-green-600">付与: {selectedCalcReceipt.receipt.pointsAwarded} pt</p>
                              )}
                            </div>
                          )}
                          {selectedCalcReceipt.receipt.status === "rejected" && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                              <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
                              <p className="text-sm font-medium text-red-700">却下済み</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          読み込み中...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              {/* RIGHT COLUMN: Receipt Card List */}
              <div className="flex-1 min-w-0">
                <div className="grid gap-3">
                  {receipts?.map(({ receipt, lineUser }) => {
                    const images = getReceiptImages(receipt);
                    const aiScore = getAiConfidence(receipt);
                    const confidence = getConfidenceLabel(aiScore);
                    const isSelected = receipt.id === calcReceiptId;
                    
                    return (
                      <Card 
                        key={receipt.id}
                        data-receipt-id={receipt.id}
                        className={`hover:shadow-md transition-all overflow-hidden cursor-pointer ${
                          isSelected ? "ring-2 ring-green-500 shadow-md bg-green-50/30" : ""
                        }`}
                        onClick={() => selectForCalc(receipt.id)}
                      >
                        <CardContent className="p-0">
                          <div className="flex">
                            {/* Image Thumbnail - Left Side */}
                            <div className="flex-shrink-0 bg-muted/30 p-2 border-r">
                              <div className="flex gap-1.5">
                                {images.length > 0 ? (
                                  images.slice(0, 2).map((url, idx) => (
                                    <div 
                                      key={idx}
                                      className="relative w-20 h-20 rounded-lg overflow-hidden group border-2 border-transparent hover:border-primary transition-colors"
                                      onClick={(e) => { e.stopPropagation(); openImageViewer(images, idx); }}
                                    >
                                      <img 
                                        src={url} 
                                        alt={`レシート ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                      {images.length > 1 && idx === 0 && (
                                        <div className="absolute top-0.5 right-0.5 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded">
                                          {images.length}枚
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Info - Center */}
                            <div className="flex-1 p-3 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  {/* User & Status Row */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="font-semibold text-sm">{lineUser?.displayName || "不明"}</span>
                                    </div>
                                    {getStatusBadge(receipt.status as ReceiptStatus)}
                                    
                                    {/* AI Confidence Badge */}
                                    <Badge variant="outline" className={`${confidence.color} text-xs`}>
                                      <Bot className="w-3 h-3 mr-1" />
                                      AI {confidence.label} ({aiScore}%)
                                    </Badge>
                                    
                                    {receipt.fraudFlags && (receipt.fraudFlags as string[]).length > 0 && (
                                      <>
                                        {(receipt.fraudFlags as string[]).includes("similar_order_number") ? (
                                          <Badge variant="destructive" className="text-xs bg-orange-500 hover:bg-orange-600">
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                            類似注文番号
                                          </Badge>
                                        ) : (receipt.fraudFlags as string[]).includes("duplicate_order") ? (
                                          <Badge variant="destructive" className="text-xs">
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                            重複注文
                                          </Badge>
                                        ) : (
                                          <Badge variant="destructive" className="text-xs">
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                            不正フラグ
                                          </Badge>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  
                                  {/* Order Number */}
                                  {(() => {
                                    const orderNum = getOrderNumber(receipt);
                                    return orderNum ? (
                                      <div className="flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-0.5 w-fit">
                                        <Hash className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                        <span className="font-mono text-xs font-bold text-blue-800">{orderNum}</span>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); openOrderNumberDialog(receipt); }}
                                        className="flex items-center gap-1.5 text-xs bg-red-50 border border-red-200 rounded px-2 py-0.5 w-fit hover:bg-red-100 transition-colors"
                                      >
                                        <AlertTriangle className="w-3 h-3 text-red-500" />
                                        <span className="text-red-600 font-medium">注文番号なし</span>
                                        <Edit className="w-3 h-3 text-red-400" />
                                      </button>
                                    );
                                  })()}

                                  {/* Receipt Details Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Store className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate font-medium text-foreground">{receipt.storeName || "店舗不明"}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Calendar className="w-3 h-3 flex-shrink-0" />
                                      <span className="font-medium text-foreground">{receipt.purchaseDate ? new Date(receipt.purchaseDate).toLocaleDateString("ja-JP") : "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <DollarSign className="w-3 h-3 flex-shrink-0" />
                                      <span className="font-medium text-foreground">{formatCurrency(receipt.totalAmount, receipt.currency || "JPY")}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {receipt.status === "approved" && receipt.pointsAwarded != null ? (
                                        <>
                                          <Gift className="w-3 h-3 text-green-600 flex-shrink-0" />
                                          <span className="font-bold text-green-600 text-xs">{receipt.pointsAwarded} pt</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-muted-foreground">計算:</span>
                                          <span className="font-bold text-blue-600 text-xs">{receipt.pointsCalculated || 0} pt</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Submission Time */}
                                  <div className="text-[11px] text-muted-foreground">
                                    申請: {formatDate(receipt.submittedAt)}
                                  </div>
                                </div>
                                
                                {/* Detail Button */}
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="flex-shrink-0"
                                  onClick={(e) => { e.stopPropagation(); openReceiptDetails(receipt.id); }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  詳細
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Image Viewer Dialog */}
      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95">
          <div className="relative">
            <div className="flex items-center justify-center min-h-[60vh] p-4">
              {viewerImages[currentImageIndex] && (
                <img 
                  src={viewerImages[currentImageIndex]} 
                  alt={`レシート画像 ${currentImageIndex + 1}`}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              )}
            </div>
            
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
                
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                  {currentImageIndex + 1} / {viewerImages.length}
                </div>
                
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
                          この申請には{images.length}枚の画像が含まれています
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
                      {receiptDetails.fraudLogs.map((log: any, i: number) => {
                        const checkTypeLabels: Record<string, string> = {
                          duplicate_image: "重複画像",
                          duplicate_receipt: "重複レシート",
                          expired_receipt: "期限切れ",
                          high_frequency: "高頻度申請",
                          high_amount: "高額購入",
                          suspicious_pattern: "不審パターン",
                          similar_order_number: "類似注文番号",
                        };
                        const isSimilar = log.checkType === "similar_order_number";
                        return (
                          <div key={i} className={`text-sm p-2 rounded ${isSimilar ? "bg-orange-100 border border-orange-300" : ""}`}>
                            <Badge variant="outline" className={`mr-2 ${isSimilar ? "border-orange-500 text-orange-700" : ""}`}>
                              {checkTypeLabels[log.checkType] || log.checkType}
                            </Badge>
                            <span className={isSimilar ? "text-orange-800 font-medium" : "text-muted-foreground"}>{log.details}</span>
                          </div>
                        );
                      })}
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
                        selectForCalc(receiptDetails.receipt.id);
                      }}
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      計算機で承認
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
      
      {/* Reject/Hold Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog?.type === "reject" && <><XCircle className="w-5 h-5 text-red-600" /> レシートを却下</>}
              {actionDialog?.type === "hold" && <><AlertTriangle className="w-5 h-5 text-orange-600" /> レシートを保留</>}
            </DialogTitle>
            <DialogDescription>
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
              <Label>詳細理由</Label>
              <Textarea 
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="詳細な理由を入力してください"
                required
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
                rejectMutation.isPending ||
                holdMutation.isPending
              }
              variant={actionDialog?.type === "reject" ? "destructive" : "default"}
            >
              {rejectMutation.isPending || holdMutation.isPending ? (
                "処理中..."
              ) : (
                <>
                  {actionDialog?.type === "reject" && "却下する"}
                  {actionDialog?.type === "hold" && "保留にする"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Order Number Manual Input Dialog */}
      <Dialog open={!!orderNumberDialog} onOpenChange={(open) => { if (!open) { setOrderNumberDialog(null); setOrderNumberInput(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-blue-600" />
              注文番号を手動入力
            </DialogTitle>
            <DialogDescription>
              レシート画像を確認して、注文番号を入力してください。
            </DialogDescription>
          </DialogHeader>
          
          {orderNumberDialog?.images && orderNumberDialog.images.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">レシート画像（クリックで拡大）</Label>
              <div className="grid grid-cols-1 gap-2">
                {orderNumberDialog.images.map((img, idx) => (
                  <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block">
                    <img 
                      src={img} 
                      alt={`レシート画像 ${idx + 1}`}
                      className="w-full max-h-[400px] object-contain rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-zoom-in bg-gray-50"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="orderNumber">注文番号</Label>
            <Input
              id="orderNumber"
              value={orderNumberInput}
              onChange={(e) => setOrderNumberInput(e.target.value)}
              placeholder="例: 581900058582287971"
              className="font-mono text-lg"
            />
            {orderNumberDialog?.currentOrderNumber && (
              <p className="text-xs text-muted-foreground">現在の注文番号: {orderNumberDialog.currentOrderNumber}</p>
            )}
          </div>
          
          {updateOrderNumberMutation.isError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {updateOrderNumberMutation.error?.message || "エラーが発生しました"}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOrderNumberDialog(null); setOrderNumberInput(""); }}>
              キャンセル
            </Button>
            <Button 
              onClick={handleOrderNumberSave}
              disabled={!orderNumberInput.trim() || updateOrderNumberMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateOrderNumberMutation.isPending ? "保存中..." : "注文番号を保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Keyboard Shortcut Help Dialog */}
      <Dialog open={showShortcutHelp} onOpenChange={setShowShortcutHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-blue-600" />
              キーボードショートカット
            </DialogTitle>
            <DialogDescription>
              キーボードだけでレシートを高速処理できます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {/* Navigation */}
            <div className="px-3 py-2 bg-muted/50 rounded-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">ナビゲーション</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">次のレシートを選択</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">↓</kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">J</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">前のレシートを選択</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">↑</kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">K</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">選択解除</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">Esc</kbd>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="px-3 py-2 bg-muted/50 rounded-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">アクション</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    承認する
                  </span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">Enter</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    却下する
                  </span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">R</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    保留にする
                  </span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">H</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    詳細を開く
                  </span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">D</kbd>
                </div>
              </div>
            </div>
            
            {/* Other */}
            <div className="px-3 py-2 bg-muted/50 rounded-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">その他</p>
              <div className="flex items-center justify-between">
                <span className="text-sm">このヘルプを表示</span>
                <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">?</kbd>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center pt-2">
              ※ 入力フィールドやダイアログが開いているときは無効になります
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
