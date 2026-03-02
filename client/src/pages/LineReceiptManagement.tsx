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
import { toast } from "sonner";
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
  Zap,
  PartyPopper,
  SkipForward,
  RefreshCw,
  Loader2,
  Search,
  Save,
  ExternalLink,
  Copy,
  List,
  FileText,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Gauge,
} from "lucide-react";

type ReceiptStatus = "pending" | "approved" | "rejected" | "on_hold" | "ai_log";

// AI rejection reason categories for learning
const REJECTION_CATEGORIES = [
  { value: "not_order_detail", label: "注文詳細画面ではない", desc: "メール通知・配送通知の画面等" },
  { value: "not_tiktok_shop", label: "TikTok Shop以外", desc: "他のECサイトのレシート" },
  { value: "not_delivered", label: "配達未完了", desc: "配送中・キャンセル等" },
  { value: "blurry_image", label: "画像が不鮮明", desc: "情報が読み取れない" },
  { value: "missing_order_number", label: "注文番号が見えない", desc: "16-19桁の番号が未確認" },
  { value: "missing_amount", label: "金額が見えない", desc: "合計金額が未確認" },
  { value: "partial_screenshot", label: "スクショが不完全", desc: "一部しか写っていない" },
  { value: "duplicate", label: "重複申請", desc: "同じ注文番号で既に申請済" },
  { value: "wrong_store", label: "対象外店舗", desc: "対象外のショップ" },
  { value: "suspicious", label: "不正の疑い", desc: "加工・改ざんの可能性" },
  { value: "incomplete_info", label: "情報不足", desc: "必要な情報が足りない" },
  { value: "other", label: "その他", desc: "上記以外の理由" },
];

// AI approval confidence labels
const getConfidenceLabel = (score: number) => {
  if (score >= 90) return { label: "高信頼", color: "text-green-600 bg-green-50 border-green-200" };
  if (score >= 70) return { label: "中信頼", color: "text-yellow-600 bg-yellow-50 border-yellow-200" };
  return { label: "低信頼", color: "text-red-600 bg-red-50 border-red-200" };
};

export default function LineReceiptManagement({ embedded = false }: { embedded?: boolean } = {}) {
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
  const [calcOrderNumber, setCalcOrderNumber] = useState<string>("");
  const [isOrderNumberEditing, setIsOrderNumberEditing] = useState(false);
  const [isAiRecognizing, setIsAiRecognizing] = useState(false);
  
  // Batch AI re-recognize state
  const [batchAiProgress, setBatchAiProgress] = useState<{ total: number; completed: number; running: boolean }>({ total: 0, completed: 0, running: false });
  const batchAiAbortRef = useRef(false);
  
  // Reject/Hold dialog state (separate from calculator approve flow)
  const [actionDialog, setActionDialog] = useState<{ type: "reject" | "hold"; id: number; receipt?: any } | null>(null);
  
  // Keyboard shortcut help
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  
  // Order number search
  const [orderNumberSearch, setOrderNumberSearch] = useState("");
  
  // AI Auto-Approve state
  const [aiAutoApproveLimit, setAiAutoApproveLimit] = useState(20);
  const [aiAutoApproveResult, setAiAutoApproveResult] = useState<{
    processed: number;
    results: { id: number; action: string; reason: string; confidence?: number; orderNumber?: string; amount?: number }[];
    summary: { approved: number; skipped: number; held: number; rejectedDuplicate: number; rejectedAi: number };
    dryRun: boolean;
  } | null>(null);
  
  // Continuous processing state
  const [sessionProcessedCount, setSessionProcessedCount] = useState(0);
  const [lastProcessedId, setLastProcessedId] = useState<number | null>(null);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [allProcessedMessage, setAllProcessedMessage] = useState(false);
  
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
  // ai_logタブの場合はレシート一覧を取得しない（statusバリデーションエラー回避）
  const receiptStatus = activeTab === "ai_log" ? undefined : activeTab;
  const { data: receipts, isLoading } = trpc.point.adminGetLineReceipts.useQuery({
    status: receiptStatus as "pending" | "approved" | "rejected" | "on_hold" | undefined,
    limit: 100,
  }, {
    enabled: activeTab !== "ai_log",
  });
  
  // Fetch duplicate receipts detection
  const { data: duplicateData } = trpc.point.adminDetectDuplicateReceipts.useQuery();
  
  // Build a Set of receipt IDs that are duplicates and maps for cross-linking
  type DupReceiptDetail = { id: number; source: "line_receipt" | "point_request"; status: string; totalAmount: number | null; userName: string; imageUrl: string | null; submittedAt: string | null };
  const duplicateReceiptIds = useMemo(() => {
    const ids = new Set<number>();
    const orderMap = new Map<string, number[]>();
    // Map: receiptId -> array of OTHER duplicate receipts (for cross-linking)
    const crossLinkMap = new Map<number, { orderNumber: string; others: DupReceiptDetail[] }>();
    if (duplicateData) {
      for (const dup of duplicateData) {
        orderMap.set(dup.orderNumber, dup.receiptIds);
        for (const id of dup.receiptIds) {
          ids.add(id);
        }
        // Build cross-link for each LINE receipt in this duplicate group
        const receipts = (dup as any).receipts as DupReceiptDetail[] | undefined;
        if (receipts) {
          for (const r of receipts) {
            if (r.source === "line_receipt") {
              crossLinkMap.set(r.id, {
                orderNumber: dup.orderNumber,
                others: receipts.filter(o => !(o.source === r.source && o.id === r.id)),
              });
            }
          }
        }
      }
    }
    return { ids, orderMap, crossLinkMap };
  }, [duplicateData]);
  
  // Batch AI re-recognize mutation (one at a time)
  const batchReRecognizeMutation = trpc.point.adminReRecognizeOrderNumber.useMutation();
  
  // Auto batch AI re-recognize when receipts load (for pending tab)
  const batchProcessedIdsRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    if (!receipts || receipts.length === 0 || activeTab !== "pending") return;
    
    // Find receipts that need AI recognition (no totalAmount or no storeName)
    const needsRecognition = receipts.filter(({ receipt }) => {
      // Skip if already processed in this session
      if (batchProcessedIdsRef.current.has(receipt.id)) return false;
      // Need recognition if missing amount or store
      return (!receipt.totalAmount || receipt.totalAmount === 0) && receipt.imageUrl;
    });
    
    if (needsRecognition.length === 0) return;
    
    // Start batch processing
    batchAiAbortRef.current = false;
    setBatchAiProgress({ total: needsRecognition.length, completed: 0, running: true });
    
    const processSequentially = async () => {
      let completed = 0;
      for (const { receipt } of needsRecognition) {
        if (batchAiAbortRef.current) break;
        try {
          const result = await batchReRecognizeMutation.mutateAsync({ id: receipt.id });
          batchProcessedIdsRef.current.add(receipt.id);
          completed++;
          setBatchAiProgress(prev => ({ ...prev, completed }));
          
          // If this receipt is currently selected, update the amount
          if (receipt.id === calcReceiptId && result.totalAmount && result.totalAmount > 0) {
            setCalcAmount(String(result.totalAmount));
          }
        } catch {
          batchProcessedIdsRef.current.add(receipt.id); // Don't retry
          completed++;
          setBatchAiProgress(prev => ({ ...prev, completed }));
        }
      }
      setBatchAiProgress(prev => ({ ...prev, running: false }));
      // Refresh list to show updated data
      utils.point.adminGetLineReceipts.invalidate();
    };
    
    processSequentially();
    
    return () => {
      batchAiAbortRef.current = true;
    };
  }, [receipts?.length, activeTab]); // Only trigger when receipt count changes or tab changes
  
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
  
  // Track processed receipt IDs to skip them in auto-advance
  const processedIdsRef = useRef<Set<number>>(new Set());
  
  // Helper: advance to next available receipt (skipping processed ones)
  const advanceToNext = useCallback((currentReceipts: typeof receipts, processedId?: number) => {
    if (processedId) processedIdsRef.current.add(processedId);
    const available = (currentReceipts || []).filter(
      r => !processedIdsRef.current.has(r.receipt.id) && (r.receipt.status === "pending" || r.receipt.status === "on_hold")
    );
    if (available.length > 0) {
      const nextReceipt = available[0];
      setCalcReceiptId(nextReceipt.receipt.id);
      setActionNote("");
      setAllProcessedMessage(false);
      const nextAmount = nextReceipt.receipt.totalAmount;
      setCalcAmount(nextAmount && nextAmount > 0 ? String(nextAmount) : "");
      const nextOrderNum = (() => {
        try {
          if (nextReceipt.receipt.ocrRawText) {
            const data = typeof nextReceipt.receipt.ocrRawText === "string" ? JSON.parse(nextReceipt.receipt.ocrRawText) : nextReceipt.receipt.ocrRawText;
            return data.orderNumber || "";
          }
        } catch { /* ignore */ }
        return "";
      })();
      setCalcOrderNumber(nextOrderNum);
      setIsOrderNumberEditing(false);
      setTimeout(() => {
        const card = document.querySelector(`[data-receipt-id="${nextReceipt.receipt.id}"]`);
        card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } else {
      setCalcReceiptId(null);
      setCalcAmount("");
      setCalcPoints(0);
      setCalcOrderNumber("");
      setIsOrderNumberEditing(false);
      setAllProcessedMessage(true);
    }
  }, []);
  
  // Auto-advance to next receipt after processing
  useEffect(() => {
    if (!autoAdvanceEnabled || !lastProcessedId || !receipts) return;
    
    // Immediately advance to next, skipping processed IDs
    advanceToNext(receipts, lastProcessedId);
    setLastProcessedId(null);
  }, [receipts, lastProcessedId, autoAdvanceEnabled, advanceToNext]);
  
  // Clean up processedIds when receipts list actually updates (removes stale entries)
  useEffect(() => {
    if (receipts && processedIdsRef.current.size > 0) {
      const currentIds = new Set(receipts.map(r => r.receipt.id));
      const toDelete: number[] = [];
      processedIdsRef.current.forEach(id => {
        if (!currentIds.has(id)) toDelete.push(id);
      });
      toDelete.forEach(id => processedIdsRef.current.delete(id));
    }
  }, [receipts]);
  
  // Fallback: if calcReceiptId is set but selectedCalcReceipt is null (receipt was removed from list),
  // advance to next instead of clearing
  useEffect(() => {
    if (calcReceiptId && receipts && !isLoading) {
      const found = receipts.find(r => r.receipt.id === calcReceiptId);
      if (!found) {
        if (!lastProcessedId) {
          if (autoAdvanceEnabled) {
            advanceToNext(receipts, calcReceiptId);
          } else {
            setCalcReceiptId(null);
            setCalcAmount("");
            setCalcPoints(0);
          }
        }
      }
    }
  }, [calcReceiptId, receipts, isLoading, lastProcessedId, autoAdvanceEnabled, advanceToNext]);
  
  // Reset session counter when tab changes
  useEffect(() => {
    setSessionProcessedCount(0);
    setAllProcessedMessage(false);
    batchProcessedIdsRef.current.clear();
    setBatchAiProgress({ total: 0, completed: 0, running: false });
  }, [activeTab]);
  
  // Auto-select first receipt when receipts load and none is selected
  useEffect(() => {
    if (!calcReceiptId && receipts && receipts.length > 0 && !isLoading && activeTab === "pending") {
      const first = receipts[0];
      setCalcReceiptId(first.receipt.id);
      const amount = first.receipt.totalAmount;
      setCalcAmount(amount ? String(amount) : "");
      setCurrentImageIndex(0);
    }
  }, [receipts, isLoading, activeTab]);
  
  // When a receipt is selected for calculator, pre-fill amount
  const selectedCalcReceipt = useMemo(() => {
    if (!calcReceiptId || !receipts) return null;
    return receipts.find(r => r.receipt.id === calcReceiptId) || null;
  }, [calcReceiptId, receipts]);
  
  useEffect(() => {
    if (selectedCalcReceipt) {
      const amount = selectedCalcReceipt.receipt.totalAmount;
      setCalcAmount(amount ? String(amount) : "");
      // Reset image index when switching receipts
      setCurrentImageIndex(0);
      // Update order number from receipt data
      const orderNum = getOrderNumber(selectedCalcReceipt.receipt);
      setCalcOrderNumber(orderNum || "");
      setIsOrderNumberEditing(false);
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
      // Track processing count
      setSessionProcessedCount(prev => prev + 1);
      toast.success("承認完了", { duration: 2000 });
      // Trigger auto-advance to next receipt
      if (autoAdvanceEnabled) {
        setLastProcessedId(calcReceiptId);
      } else {
        setCalcReceiptId(null);
        setCalcAmount("");
        setCalcPoints(0);
      }
      setActionNote("");
      setCalcOrderNumber("");
      setIsOrderNumberEditing(false);
    },
  });
  
  // Track the last rejected receipt ID for auto-advance
  const lastRejectedIdRef = useRef<number | null>(null);
  
  const rejectMutation = trpc.point.adminRejectLineReceipt.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
      const rejectedId = lastRejectedIdRef.current;
      // Track processing count
      setSessionProcessedCount(prev => prev + 1);
      toast.success(`却下完了（LINE送信済み）理由: ${rejectionCategory || "other"}`, { duration: 2000 });
      // Trigger auto-advance to next receipt
      if (autoAdvanceEnabled && rejectedId) {
        setLastProcessedId(rejectedId);
      } else if (rejectedId === calcReceiptId) {
        setCalcReceiptId(null);
        setCalcAmount("");
        setCalcPoints(0);
      }
      setCalcOrderNumber("");
      setIsOrderNumberEditing(false);
      lastRejectedIdRef.current = null;
    },
  });
  
  // Direct reject handler (no dialog) - rejectionCategory is now REQUIRED
  const handleDirectReject = (receiptId: number) => {
    if (!rejectionCategory) {
      toast.error("却下理由を選択してください（AI学習に必要です）");
      return;
    }
    lastRejectedIdRef.current = receiptId;
    rejectMutation.mutate({ id: receiptId, rejectionCategory: rejectionCategory as any });
  };
  
  const holdMutation = trpc.point.adminHoldLineReceipt.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
      const heldId = actionDialog?.id;
      setActionDialog(null);
      setActionNote("");
      // Track processing count
      setSessionProcessedCount(prev => prev + 1);
      // Trigger auto-advance to next receipt
      if (autoAdvanceEnabled && heldId) {
        setLastProcessedId(heldId);
      } else if (heldId === calcReceiptId) {
        setCalcReceiptId(null);
        setCalcAmount("");
        setCalcPoints(0);
      }
      setCalcOrderNumber("");
      setIsOrderNumberEditing(false);
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
  
  // AI re-recognize order number + amount + shop info
  const reRecognizeMutation = trpc.point.adminReRecognizeOrderNumber.useMutation({
    onSuccess: (data) => {
      const results: string[] = [];
      
      if (data.orderNumber) {
        setCalcOrderNumber(data.orderNumber);
        // Order number is auto-saved to DB by backend now, no need for separate mutation
        results.push(`注文番号: ${data.orderNumber}`);
      }
      
      // Always auto-fill amount if detected (overwrite even if existing)
      if (data.totalAmount && typeof data.totalAmount === "number" && data.totalAmount > 0) {
        setCalcAmount(String(data.totalAmount));
        results.push(`金額: ¥${data.totalAmount.toLocaleString()}`);
      }
      
      if (data.shopName) {
        results.push(`店舗: ${data.shopName}`);
      }
      if (data.orderDate) {
        results.push(`日付: ${data.orderDate}`);
      }
      
      // Refresh receipt list to show updated DB data (amount, store, date)
      utils.point.adminGetLineReceipts.invalidate();
      
      if (results.length > 0) {
        toast.success(`AI認識完了\n${results.join(" / ")}`, { duration: 5000 });
      } else {
        toast.error("情報を抽出できませんでした。手動で入力してください。");
      }
      
      setIsAiRecognizing(false);
    },
    onError: (err) => {
      toast.error(`AI認識失敗: ${err.message}`);
      setIsAiRecognizing(false);
    },
  });
  
  // AI Auto-Approve mutation
  const aiAutoApproveMutation = trpc.point.adminAiAutoApprove.useMutation({
    onSuccess: (data) => {
      setAiAutoApproveResult(data);
      if (data.dryRun) {
        toast.info(`プレビュー完了: ${data.processed}件分析 (承認予定: ${data.summary.approved}, 重複却下: ${data.summary.rejectedDuplicate}, AI却下: ${data.summary.rejectedAi || 0}, 保留: ${data.summary.held})`);
      } else {
        toast.success(`AI自動承認完了: ${data.summary.approved}件承認, ${data.summary.rejectedDuplicate}件重複却下, ${data.summary.rejectedAi || 0}件AI却下, ${data.summary.held}件保留`);
        utils.point.adminGetLineReceipts.invalidate();
        utils.point.adminGetLineStatistics.invalidate();
        utils.point.adminDetectDuplicateReceipts.invalidate();
      }
    },
    onError: (err) => {
      toast.error(`AI自動承認エラー: ${err.message}`);
    },
  });
  
  const handleAiReRecognize = () => {
    if (!calcReceiptId) return;
    setIsAiRecognizing(true);
    reRecognizeMutation.mutate({ id: calcReceiptId });
  };
  
  // Save order number from calculator panel (inline)
  const handleCalcOrderNumberSave = () => {
    if (!calcReceiptId || !calcOrderNumber.trim()) return;
    updateOrderNumberMutation.mutate({
      id: calcReceiptId,
      orderNumber: calcOrderNumber.trim(),
    });
    setIsOrderNumberEditing(false);
  };
  
  // Handle approve from calculator panel
  const handleCalcApprove = () => {
    if (!calcReceiptId) return;
    approveMutation.mutate({
      id: calcReceiptId,
      pointsOverride: calcPoints > 0 ? calcPoints : undefined,
      note: actionNote || undefined,
      orderNumber: calcOrderNumber.trim() || undefined,
    });
  };
  
  // Handle hold from action dialog
  const handleAction = () => {
    if (!actionDialog || actionDialog.type !== "hold") return;
    holdMutation.mutate({
      id: actionDialog.id,
      note: actionNote,
    });
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
        if (selectedCalcReceipt && (selectedCalcReceipt.receipt.status === "pending" || selectedCalcReceipt.receipt.status === "on_hold") && !rejectMutation.isPending) {
          if (!rejectionCategory) {
            toast.error("却下理由を選択してください（AI学習に必要です）");
          } else {
            handleDirectReject(selectedCalcReceipt.receipt.id);
          }
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
    setIsOrderNumberEditing(false);
    // Initialize order number from receipt data
    const receiptData = receipts?.find((r: any) => r.receipt.id === receiptId);
    if (receiptData) {
      const orderNum = getOrderNumber(receiptData.receipt);
      setCalcOrderNumber(orderNum || "");
    } else {
      setCalcOrderNumber("");
    }
  };
  
  // Get user display name with OCR fallback
  const getUserDisplayName = (lineUser: any, receipt: any): string => {
    // 1st priority: LINE display name
    if (lineUser?.displayName) return lineUser.displayName;
    // 2nd priority: OCR delivery recipient name (multiple paths)
    try {
      if (receipt?.ocrRawText) {
        const data = typeof receipt.ocrRawText === "string" ? JSON.parse(receipt.ocrRawText) : receipt.ocrRawText;
        // Try structured deliveryInfo first
        if (data.deliveryInfo?.recipientName) return data.deliveryInfo.recipientName;
        // Try top-level recipientName
        if (data.recipientName) return data.recipientName;
        // Try delivery object
        if (data.delivery?.recipientName) return data.delivery.recipientName;
        // Try customerName
        if (data.customerName) return data.customerName;
        // Try buyerName
        if (data.buyerName) return data.buyerName;
      }
    } catch { /* ignore */ }
    // 3rd priority: ocrData field (older format)
    try {
      if (receipt?.ocrData) {
        const ocrData = typeof receipt.ocrData === "string" ? JSON.parse(receipt.ocrData) : receipt.ocrData;
        if (ocrData.recipientName) return ocrData.recipientName;
        if (ocrData.deliveryInfo?.recipientName) return ocrData.deliveryInfo.recipientName;
        if (ocrData.customerName) return ocrData.customerName;
      }
    } catch { /* ignore */ }
    return "不明";
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
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />{t("receipts.pending")}</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />{t("receipts.approved")}</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />{t("receipts.rejected")}</Badge>;
      case "on_hold":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300"><AlertTriangle className="w-3 h-3 mr-1" />{t("receipts.onHold")}</Badge>;
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
      {!embedded && (
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
        </div>
      )}

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
            onCheckedChange={(checked) => {
              setAiAutoMode(checked);
              if (checked) {
                // トグルON → 自動でバッチ処理を実行
                toast.info("AI自動承認モードON: 自動処理を開始します...");
                aiAutoApproveMutation.mutate({ limit: aiAutoApproveLimit, dryRun: false, confidenceThreshold: 85 });
              }
            }}
          />
        </div>
      
      {/* Batch AI Recognition Progress */}
      {batchAiProgress.running && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600 animate-pulse" />
              <div>
                <p className="text-sm font-medium text-purple-800">AI自動認識中...</p>
                <p className="text-xs text-purple-600">{batchAiProgress.completed} / {batchAiProgress.total} 件処理済み</p>
              </div>
            </div>
            <div className="flex-1 mx-4">
              <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${batchAiProgress.total > 0 ? (batchAiProgress.completed / batchAiProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-purple-600 hover:text-purple-800"
              onClick={() => { batchAiAbortRef.current = true; setBatchAiProgress(prev => ({ ...prev, running: false })); }}
            >
              中止
            </Button>
          </div>
        </div>
      )}
      {!batchAiProgress.running && batchAiProgress.completed > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700">AI自動認識完了: {batchAiProgress.completed}件の画像を解析しました</span>
        </div>
      )}
      
      {/* Order Number Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={orderNumberSearch}
          onChange={(e) => setOrderNumberSearch(e.target.value)}
          placeholder="注文管理番号で検索..."
          className="pl-10 pr-10"
        />
        {orderNumberSearch && (
          <button
            onClick={() => setOrderNumberSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Statistics - Clickable Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeTab === "pending" ? "ring-2 ring-yellow-400 bg-yellow-50" : ""}`}
          onClick={() => { setActiveTab("pending"); setCalcReceiptId(null); setCalcAmount(""); }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">{t("receipts.pendingCount")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.pending || 0}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeTab === "approved" ? "ring-2 ring-green-400 bg-green-50" : ""}`}
          onClick={() => { setActiveTab("approved"); setCalcReceiptId(null); setCalcAmount(""); }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">{t("receipts.approvedCount")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.approved || 0}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeTab === "rejected" ? "ring-2 ring-red-400 bg-red-50" : ""}`}
          onClick={() => { setActiveTab("rejected"); setCalcReceiptId(null); setCalcAmount(""); }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-muted-foreground">{t("receipts.rejectedCount")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.rejected || 0}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeTab === "on_hold" ? "ring-2 ring-orange-400 bg-orange-50" : ""}`}
          onClick={() => { setActiveTab("on_hold"); setCalcReceiptId(null); setCalcAmount(""); }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">{t("receipts.onHold")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.onHold || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">{t("receipts.totalPoints")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{(stats?.totalPointsAwarded || 0).toLocaleString()} pt</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeTab === "ai_log" ? "ring-2 ring-purple-400 bg-purple-50" : ""}`}
          onClick={() => { setActiveTab("ai_log" as ReceiptStatus); setCalcReceiptId(null); setCalcAmount(""); }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">AI審査ログ</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              <FileText className="w-5 h-5 inline text-purple-500" />
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* AI Auto Mode Banner */}
      {aiAutoMode && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-100">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-purple-800">AI自動承認モード有効</p>
                  <p className="text-sm text-purple-600">
                    3段階パイプライン: 重複注文番号チェック → LLM画像判定 → 信頼度閾値判定
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={String(aiAutoApproveLimit)}
                  onValueChange={(v) => setAiAutoApproveLimit(Number(v))}
                >
                  <SelectTrigger className="w-[80px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10件</SelectItem>
                    <SelectItem value="20">20件</SelectItem>
                    <SelectItem value="50">50件</SelectItem>
                    <SelectItem value="100">100件</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-100"
                  onClick={() => aiAutoApproveMutation.mutate({ limit: aiAutoApproveLimit, dryRun: true, confidenceThreshold: 85 })}
                  disabled={aiAutoApproveMutation.isPending}
                >
                  {aiAutoApproveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  プレビュー
                </Button>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => {
                    if (confirm(`AI自動承認を${aiAutoApproveLimit}件に対して実行しますか？\n\n・85%以上: 自動承認\n・50-84%: 保留（人間レビュー待ち）\n・50%未満: 自動却下（LINE通知あり）\n・重複注文番号: 自動却下`)) {
                      aiAutoApproveMutation.mutate({ limit: aiAutoApproveLimit, dryRun: false, confidenceThreshold: 85 });
                    }
                  }}
                  disabled={aiAutoApproveMutation.isPending}
                >
                  {aiAutoApproveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
                  実行
                </Button>
              </div>
            </div>
            
            {/* AI Auto-Approve Results */}
            {aiAutoApproveResult && (
              <div className="mt-3 border-t border-purple-200 pt-3">
                <div className="flex items-center gap-4 mb-2">
                  <Badge variant="outline" className="border-purple-300 text-purple-700">
                    {aiAutoApproveResult.dryRun ? "プレビュー結果" : "実行結果"}
                  </Badge>
                  <span className="text-sm text-purple-700">処理: {aiAutoApproveResult.processed}件</span>
                </div>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <div className="bg-green-100 rounded p-2 text-center">
                    <p className="text-lg font-bold text-green-700">{aiAutoApproveResult.summary.approved}</p>
                    <p className="text-xs text-green-600">承認</p>
                  </div>
                  <div className="bg-red-100 rounded p-2 text-center">
                    <p className="text-lg font-bold text-red-700">{aiAutoApproveResult.summary.rejectedDuplicate}</p>
                    <p className="text-xs text-red-600">重複却下</p>
                  </div>
                  <div className="bg-rose-100 rounded p-2 text-center">
                    <p className="text-lg font-bold text-rose-700">{aiAutoApproveResult.summary.rejectedAi || 0}</p>
                    <p className="text-xs text-rose-600">AI却下</p>
                  </div>
                  <div className="bg-orange-100 rounded p-2 text-center">
                    <p className="text-lg font-bold text-orange-700">{aiAutoApproveResult.summary.held}</p>
                    <p className="text-xs text-orange-600">保留</p>
                  </div>
                  <div className="bg-gray-100 rounded p-2 text-center">
                    <p className="text-lg font-bold text-gray-700">{aiAutoApproveResult.summary.skipped}</p>
                    <p className="text-xs text-gray-600">スキップ</p>
                  </div>
                </div>
                {/* Show details for duplicates and held */}
                {aiAutoApproveResult.results.filter(r => r.action === "rejected_duplicate" || r.action === "rejected_ai" || r.action === "held").length > 0 && (
                  <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                    {aiAutoApproveResult.results.filter(r => r.action === "rejected_duplicate").map(r => (
                      <div key={r.id} className="flex items-center gap-2 bg-red-50 rounded px-2 py-1">
                        <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                        <span className="text-red-700">#{r.id} 重複: {r.reason}</span>
                      </div>
                    ))}
                    {aiAutoApproveResult.results.filter(r => r.action === "rejected_ai").map(r => (
                      <div key={r.id} className="flex items-center gap-2 bg-rose-50 rounded px-2 py-1">
                        <ShieldX className="w-3 h-3 text-rose-500 flex-shrink-0" />
                        <span className="text-rose-700">#{r.id} AI却下: {r.reason} (信頼度: {r.confidence}%)</span>
                      </div>
                    ))}
                    {aiAutoApproveResult.results.filter(r => r.action === "held").map(r => (
                      <div key={r.id} className="flex items-center gap-2 bg-orange-50 rounded px-2 py-1">
                        <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                        <span className="text-orange-700">#{r.id} {r.reason} (信頼度: {r.confidence}%)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Content - Tab switching handled by clickable stat cards above */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ReceiptStatus); setCalcReceiptId(null); setCalcAmount(""); }}>
        
        <TabsContent value={activeTab} className="mt-4">
          {activeTab === "ai_log" ? (
            <AiReviewLogPanel />
          ) : isLoading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : receipts?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>該当するレシートはありません</p>
              </CardContent>
            </Card>
          ) : (
            /* ===== 3-COLUMN LAYOUT ===== */
            <div className="flex gap-4">
              {/* LEFT COLUMN: Calculator + Approve Panel */}
              <div className="w-[300px] flex-shrink-0">
                <div className="sticky top-2 flex flex-col max-h-[calc(100vh-4rem)]">
                  {/* Calculator Card */}
                  <Card className={`border-2 transition-colors flex flex-col min-h-0 ${calcReceiptId ? "border-green-300 shadow-lg" : "border-dashed border-muted-foreground/30"}`}>
                    <CardHeader className="pb-1 pt-2 px-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Calculator className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-semibold">審査パネル</span>
                          {sessionProcessedCount > 0 && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 font-normal">
                              {sessionProcessedCount}件済
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">自動送り</span>
                          <Switch
                            checked={autoAdvanceEnabled}
                            onCheckedChange={setAutoAdvanceEnabled}
                            className="scale-[0.65]"
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-1 flex flex-col min-h-0 overflow-y-auto space-y-2">
                      {!calcReceiptId ? (
                        allProcessedMessage ? (
                        <div className="text-center py-4">
                          <PartyPopper className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <p className="text-sm font-bold text-green-700">全件処理完了！</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {sessionProcessedCount}件のレシートを処理しました
                          </p>
                        </div>
                        ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-xs">右の一覧からレシートを選択</p>
                          <div className="mt-2 flex items-center justify-center gap-1 text-[10px]">
                            <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[9px]">↑↓</kbd>
                            <span>選択</span>
                            <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[9px]">Enter</kbd>
                            <span>承認</span>
                          </div>
                        </div>
                        )
                      ) : selectedCalcReceipt ? (
                        <>
                          {/* Selected Receipt Info - Compact */}
                          <div className="bg-muted/50 rounded p-2 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="font-semibold text-xs truncate">{getUserDisplayName(selectedCalcReceipt.lineUser, selectedCalcReceipt.receipt)}</span>
                              {getStatusBadge(selectedCalcReceipt.receipt.status as ReceiptStatus)}
                            </div>
                            {duplicateReceiptIds.ids.has(selectedCalcReceipt.receipt.id) && (() => {
                              const crossLink = duplicateReceiptIds.crossLinkMap.get(selectedCalcReceipt.receipt.id);
                              const others = crossLink?.others || [];
                              return (
                                <div className="bg-orange-50 border border-orange-300 rounded p-1.5 space-y-1">
                                  <div className="flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-orange-600 flex-shrink-0" />
                                    <span className="font-bold text-orange-700 text-[10px]">重複{others.length}件</span>
                                  </div>
                                  {others.length > 0 && (
                                    <div className="space-y-1">
                                      {others.map((other, idx) => (
                                        <div key={`${other.source}-${other.id}-${idx}`} className="bg-white border border-orange-200 rounded px-1.5 py-1 flex items-center gap-1.5">
                                          {other.imageUrl && (
                                            <img src={other.imageUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0 border" />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 flex-wrap">
                                              <Badge variant="outline" className="text-[8px] px-0.5 py-0">
                                                {other.source === "line_receipt" ? "LINE" : "Web"}
                                              </Badge>
                                              <Badge variant={other.status === "approved" ? "default" : other.status === "rejected" ? "destructive" : "secondary"} className="text-[8px] px-0.5 py-0">
                                                {other.status === "approved" ? "承認" : other.status === "rejected" ? "却下" : other.status === "on_hold" ? "保留" : "待機"}
                                              </Badge>
                                              <span className="text-[9px] text-muted-foreground truncate">{other.userName}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                              {other.totalAmount != null && (
                                                <span className="text-[10px] font-semibold">{formatCurrency(other.totalAmount)}</span>
                                              )}
                                              {other.submittedAt && (
                                                <span className="text-[10px] text-muted-foreground">
                                                  {new Date(other.submittedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          {other.source === "line_receipt" && (
                                            <button
                                              className="text-[9px] text-blue-500 hover:text-blue-700 flex-shrink-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const target = receipts?.find((r: any) => r.id === other.id);
                                                if (target) {
                                                  setCalcReceiptId(other.id);
                                                  toast.info(`#${other.id} に切替`);
                                                } else {
                                                  toast.info(`#${other.id} は別タブ`);
                                                }
                                              }}
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            
                            {/* AI弾き→強制申請 表示 */}
                            {selectedCalcReceipt.receipt.isForceSubmitted && (
                              <div className="bg-amber-50 border border-amber-300 rounded p-1.5 space-y-1">
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                  <span className="font-bold text-amber-700 text-[10px]">AI弾き → 強制申請</span>
                                </div>
                                {selectedCalcReceipt.receipt.aiRejectionReason && (
                                  <div className="text-[9px] text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">
                                    <span className="font-medium">AI判定理由:</span> {selectedCalcReceipt.receipt.aiRejectionReason}
                                  </div>
                                )}
                                {selectedCalcReceipt.receipt.aiRejectionCategory && (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-400 text-amber-700 bg-amber-100">
                                      {selectedCalcReceipt.receipt.aiRejectionCategory === 'not_tiktok' ? 'TikTok以外' :
                                       selectedCalcReceipt.receipt.aiRejectionCategory === 'not_delivered' ? '未配達' :
                                       selectedCalcReceipt.receipt.aiRejectionCategory === 'incomplete' ? '金額不明' : 'その他'}
                                    </Badge>
                                    <span className="text-[8px] text-amber-600">→ お客様が強制申請</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Order Number - Compact */}
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <Hash className="w-3 h-3 text-blue-600" />
                                <span className="text-[10px] text-muted-foreground">注文番号</span>
                                {!isOrderNumberEditing && calcOrderNumber && (
                                  <button
                                    onClick={() => setIsOrderNumberEditing(true)}
                                    className="text-[10px] text-blue-500 hover:text-blue-700 ml-auto"
                                  >
                                    <Edit className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                              {isOrderNumberEditing || !calcOrderNumber ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={calcOrderNumber}
                                    onChange={(e) => setCalcOrderNumber(e.target.value)}
                                    placeholder="注文番号を入力"
                                    className="h-6 text-[10px] font-mono flex-1"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && calcOrderNumber.trim()) {
                                        e.stopPropagation();
                                        handleCalcOrderNumberSave();
                                      }
                                    }}
                                  />
                                  <button
                                    className="h-6 w-6 flex items-center justify-center text-blue-600 hover:text-blue-800"
                                    onClick={handleAiReRecognize}
                                    disabled={isAiRecognizing}
                                    title="AI再認識"
                                  >
                                    {isAiRecognizing ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-3 h-3" />
                                    )}
                                  </button>
                                  {calcOrderNumber.trim() && (
                                    <button
                                      className="h-6 w-6 flex items-center justify-center text-green-600 hover:text-green-800"
                                      onClick={handleCalcOrderNumberSave}
                                      disabled={updateOrderNumberMutation.isPending}
                                      title="保存"
                                    >
                                      <Save className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                                  <span className="font-mono font-bold text-blue-800 truncate">{calcOrderNumber}</span>
                                </div>
                              )}
                              {!calcOrderNumber && !isAiRecognizing && (
                                <button onClick={handleAiReRecognize} className="flex items-center gap-0.5 text-[9px] text-blue-500 hover:text-blue-700">
                                  <Brain className="w-2.5 h-2.5" />AI再認識
                                </button>
                              )}
                              {isAiRecognizing && (
                                <p className="text-[9px] text-blue-500 flex items-center gap-0.5">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />解析中...
                                </p>
                              )}
                            </div>
                            
                            {/* Store & Date & AI - single row */}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-0.5">
                                <Store className="w-2.5 h-2.5" />
                                {selectedCalcReceipt.receipt.storeName || "店舗不明"}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {selectedCalcReceipt.receipt.purchaseDate ? new Date(selectedCalcReceipt.receipt.purchaseDate).toLocaleDateString("ja-JP") : "-"}
                              </span>
                              {(() => {
                                const aiScore = getAiConfidence(selectedCalcReceipt.receipt);
                                const confidence = getConfidenceLabel(aiScore);
                                return (
                                  <Badge variant="outline" className={`${confidence.color} text-[9px] px-1 py-0`}>
                                    <Bot className="w-2.5 h-2.5 mr-0.5" />
                                    {aiScore}%
                                  </Badge>
                                );
                              })()}
                            </div>

                            {/* OCR詳細情報 - Compact */}
                            {(() => {
                              try {
                                const raw = selectedCalcReceipt.receipt.ocrRawText;
                                if (!raw) return null;
                                const ocr = typeof raw === "string" ? JSON.parse(raw) : raw;
                                const hasItems = ocr.items && Array.isArray(ocr.items) && ocr.items.length > 0;
                                const hasDelivery = ocr.deliveryInfo && (ocr.deliveryInfo.recipientName || ocr.deliveryInfo.address || ocr.deliveryInfo.phoneNumber);
                                if (!hasItems && !hasDelivery && !ocr.productName) return null;
                                return (
                                  <div className="space-y-1">
                                    {hasItems ? (
                                      <div className="bg-blue-50/50 border border-blue-100 rounded px-1.5 py-1">
                                        <p className="text-[9px] font-medium text-blue-600 mb-0.5">商品</p>
                                        {ocr.items.slice(0, 3).map((item: any, i: number) => (
                                          <div key={i} className="flex justify-between text-[10px] leading-tight">
                                            <span className="truncate flex-1 mr-1">{item.productName || "不明"}</span>
                                            <span className="text-muted-foreground whitespace-nowrap">
                                              {item.unitPrice != null ? `¥${item.unitPrice.toLocaleString()}` : ""}
                                              {item.quantity != null ? ` x${item.quantity}` : ""}
                                            </span>
                                          </div>
                                        ))}
                                        {ocr.items.length > 3 && <p className="text-[9px] text-muted-foreground">他{ocr.items.length - 3}件</p>}
                                      </div>
                                    ) : ocr.productName ? (
                                      <div className="text-[10px]">
                                        <span className="text-muted-foreground">商品: </span>
                                        <span className="font-medium">{ocr.productName}</span>
                                      </div>
                                    ) : null}
                                    {hasDelivery && (
                                      <div className="bg-amber-50/50 border border-amber-100 rounded px-1.5 py-1">
                                        <p className="text-[9px] font-medium text-amber-600 mb-0.5">配送先</p>
                                        <div className="text-[10px] leading-tight space-y-0">
                                          {ocr.deliveryInfo.recipientName && (
                                            <div>{ocr.deliveryInfo.recipientName}{ocr.deliveryInfo.phoneNumber ? ` / ${ocr.deliveryInfo.phoneNumber}` : ""}</div>
                                          )}
                                          {ocr.deliveryInfo.address && (
                                            <div className="text-muted-foreground truncate">{ocr.deliveryInfo.postalCode ? `〒${ocr.deliveryInfo.postalCode} ` : ""}{ocr.deliveryInfo.address}</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              } catch { return null; }
                            })()}
                          </div>
                          

                          {/* Amount + Points - Compact inline */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-foreground flex items-center gap-0.5 mb-0.5">
                                <DollarSign className="w-2.5 h-2.5" />購入金額
                              </label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                                <Input
                                  type="number"
                                  value={calcAmount}
                                  onChange={(e) => setCalcAmount(e.target.value)}
                                  placeholder="金額"
                                  className="pl-6 text-sm font-bold h-8"
                                />
                              </div>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-center min-w-[80px]">
                              <p className="text-[9px] text-green-600">1%ポイント</p>
                              <p className="text-lg font-bold text-green-700 leading-tight">{calcPoints}<span className="text-[10px] font-normal">pt</span></p>
                            </div>
                          </div>
                          
                          {/* Note - single line */}
                          <Input
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                            placeholder="メモ（任意）"
                            className="h-7 text-[10px]"
                          />
                          
                          {/* Action Buttons - Compact */}
                          {(selectedCalcReceipt.receipt.status === "pending" || selectedCalcReceipt.receipt.status === "on_hold") && (
                            <div className="space-y-1.5">
                              <Button 
                                className="w-full h-10 bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-md"
                                onClick={handleCalcApprove}
                                disabled={approveMutation.isPending}
                              >
                                {approveMutation.isPending ? (
                                  "承認処理中..."
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                    承認（{calcPoints}pt付与）
                                  </>
                                )}
                              </Button>
                              {/* Rejection category selector */}
                              <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                                <SelectTrigger className="h-7 text-[10px]">
                                  <SelectValue placeholder="却下理由を選択（AI学習用）" />
                                </SelectTrigger>
                                <SelectContent>
                                  {REJECTION_CATEGORIES.map(cat => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                      <span className="flex items-center gap-1">
                                        <span>{cat.label}</span>
                                        <span className="text-[9px] text-muted-foreground">({cat.desc})</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-1.5">
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  className="flex-1 h-8 text-xs"
                                  onClick={() => handleDirectReject(selectedCalcReceipt.receipt.id)}
                                  disabled={rejectMutation.isPending || !rejectionCategory}
                                >
                                  {rejectMutation.isPending && lastRejectedIdRef.current === selectedCalcReceipt.receipt.id ? (
                                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />送信中</>
                                  ) : (
                                    <><XCircle className="w-3 h-3 mr-1" />却下（LINE）</>
                                  )}
                                </Button>
                                {selectedCalcReceipt.receipt.status === "pending" && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="flex-1 h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                                    onClick={() => setActionDialog({ type: "hold", id: selectedCalcReceipt.receipt.id, receipt: selectedCalcReceipt.receipt })}
                                  >
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    保留
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Already processed info - Compact */}
                          {selectedCalcReceipt.receipt.status === "approved" && (
                            <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-medium text-green-700">承認済</span>
                                {selectedCalcReceipt.receipt.pointsAwarded != null && (
                                  <span className="text-xs text-green-600">({selectedCalcReceipt.receipt.pointsAwarded}pt)</span>
                                )}
                              </div>
                            </div>
                          )}
                          {selectedCalcReceipt.receipt.status === "rejected" && (
                            <div className="space-y-2">
                              <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <XCircle className="w-4 h-4 text-red-600" />
                                  <span className="text-xs font-medium text-red-700">却下済</span>
                                </div>
                                {selectedCalcReceipt.receipt.reviewNote && (
                                  <p className="text-[10px] text-red-500 mt-1 line-clamp-2">{selectedCalcReceipt.receipt.reviewNote}</p>
                                )}
                              </div>
                              <Button 
                                className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md"
                                onClick={handleCalcApprove}
                                disabled={approveMutation.isPending}
                              >
                                {approveMutation.isPending ? (
                                  "復活処理中..."
                                ) : (
                                  <>
                                    <RotateCcw className="w-4 h-4 mr-1.5" />
                                    復活→承認（{calcPoints}pt付与）
                                  </>
                                )}
                              </Button>
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
              
              {/* CENTER COLUMN: Image Preview */}
              <div className="flex-1 min-w-0">
                <div className="sticky top-4">
                  {selectedCalcReceipt ? (() => {
                    const images = getReceiptImages(selectedCalcReceipt.receipt);
                    return images.length > 0 ? (
                      <Card className="border-2 border-blue-200 shadow-lg">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Images className="w-4 h-4 text-blue-600" />
                              レシート画像
                              <Badge variant="secondary" className="text-xs">{currentImageIndex + 1} / {images.length}</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openImageViewer(images, currentImageIndex)}
                            >
                              <ZoomIn className="w-3.5 h-3.5 mr-1" />
                              拡大
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                          <div className="relative bg-gray-50 rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
                            <img 
                              src={images[currentImageIndex]} 
                              alt={`レシート画像 ${currentImageIndex + 1}`}
                              className="w-full h-auto max-h-[65vh] object-contain mx-auto"
                            />
                            {images.length > 1 && (
                              <>
                                <button
                                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors shadow-lg"
                                  onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors shadow-lg"
                                  onClick={() => setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                              </>
                            )}
                          </div>
                          {images.length > 1 && (
                            <div className="flex gap-2 mt-2 justify-center">
                              {images.map((url, idx) => (
                                <button
                                  key={idx}
                                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                    idx === currentImageIndex ? "border-blue-500 shadow-md scale-105" : "border-transparent opacity-60 hover:opacity-100"
                                  }`}
                                  onClick={() => setCurrentImageIndex(idx)}
                                >
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-2 border-dashed border-muted-foreground/30">
                        <CardContent className="py-20 text-center">
                          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">画像がありません</p>
                        </CardContent>
                      </Card>
                    );
                  })() : (
                    <Card className="border-2 border-dashed border-muted-foreground/30">
                      <CardContent className="py-20 text-center">
                        <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">レシートを選択すると<br />画像がここに表示されます</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
              
              {/* RIGHT COLUMN: Receipt Card List (Compact) */}
              <div className="w-[360px] flex-shrink-0">
                <div className="grid gap-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
                  {receipts?.filter(({ receipt }) => {
                    if (!orderNumberSearch.trim()) return true;
                    const orderNum = getOrderNumber(receipt);
                    return orderNum?.includes(orderNumberSearch.trim()) || false;
                  }).map(({ receipt, lineUser }) => {
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
                        <CardContent className="p-2.5">
                          <div className="space-y-1.5">
                            {/* Row 1: User + Status + AI */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs truncate max-w-[100px]">{getUserDisplayName(lineUser, receipt)}</span>
                              {getStatusBadge(receipt.status as ReceiptStatus)}
                              <Badge variant="outline" className={`${confidence.color} text-[10px] px-1 py-0`}>
                                <Bot className="w-2.5 h-2.5 mr-0.5" />
                                {aiScore}%
                              </Badge>
                              {receipt.fraudFlags && (receipt.fraudFlags as string[]).length > 0 && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                  {(receipt.fraudFlags as string[]).includes("similar_order_number") ? "類似" : (receipt.fraudFlags as string[]).includes("duplicate_order") ? "重複" : "不正"}
                                </Badge>
                              )}
                              {receipt.isForceSubmitted && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-700 bg-amber-50">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                  AI弾き
                                </Badge>
                              )}
                              {duplicateReceiptIds.ids.has(receipt.id) && (() => {
                                const crossLink = duplicateReceiptIds.crossLinkMap.get(receipt.id);
                                const others = crossLink?.others || [];
                                const otherSummary = others.map(o => {
                                  const src = o.source === "line_receipt" ? "LINE" : "Web";
                                  const st = o.status === "approved" ? "承認" : o.status === "rejected" ? "却下" : o.status === "on_hold" ? "保留" : "待機";
                                  return `${src}#${o.id}(${st})`;
                                }).join(", ");
                                return (
                                  <Badge 
                                    variant="destructive" 
                                    className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 cursor-help"
                                    title={otherSummary ? `重複: ${otherSummary}` : "重複注文"}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                    重複{others.length > 0 ? `(${others.length})` : ""}
                                  </Badge>
                                );
                              })()}
                            </div>
                            {/* Row 2: Amount + Points + Images count */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-bold">{formatCurrency(receipt.totalAmount, receipt.currency || "JPY")}</span>
                              <span className="text-muted-foreground">→</span>
                              {receipt.status === "approved" && receipt.pointsAwarded != null ? (
                                <span className="font-bold text-green-600">{receipt.pointsAwarded}pt</span>
                              ) : (
                                <span className="text-blue-600">{receipt.pointsCalculated || 0}pt</span>
                              )}
                              {images.length > 0 && (
                                <span className="text-muted-foreground ml-auto flex items-center gap-0.5">
                                  <ImageIcon className="w-3 h-3" />{images.length}
                                </span>
                              )}
                            </div>
                            {/* Row 2.5: Order Number */}
                            {getOrderNumber(receipt) && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Hash className="w-3 h-3 text-blue-400" />
                                <span className="text-blue-600 font-mono text-[10px] truncate">{getOrderNumber(receipt)}</span>
                              </div>
                            )}
                            {/* Row 3: OCR Summary (product/recipient) */}
                            {(() => {
                              try {
                                const raw = receipt.ocrRawText;
                                if (!raw) return null;
                                const ocr = typeof raw === "string" ? JSON.parse(raw) : raw;
                                const productName = ocr.items?.[0]?.productName || ocr.productName;
                                const recipientName = ocr.deliveryInfo?.recipientName;
                                if (!productName && !recipientName) return null;
                                return (
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    {productName && (
                                      <span className="truncate max-w-[160px]" title={productName}>
                                        📦 {productName}
                                      </span>
                                    )}
                                    {recipientName && (
                                      <span className="truncate max-w-[100px] text-amber-600" title={recipientName}>
                                        👤 {recipientName}
                                      </span>
                                    )}
                                  </div>
                                );
                              } catch { return null; }
                            })()}
                            {/* Row 4: Store + Date */}
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="truncate">{receipt.storeName || "店舗不明"}</span>
                              <span>·</span>
                              <span className="flex-shrink-0">{receipt.purchaseDate ? new Date(receipt.purchaseDate).toLocaleDateString("ja-JP", { month: "short", day: "numeric" }) : "-"}</span>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="ml-auto h-6 px-1.5 text-[10px]"
                                onClick={(e) => { e.stopPropagation(); openReceiptDetails(receipt.id); }}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
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
                
                {/* AI弾き情報 */}
                {receiptDetails.receipt.isForceSubmitted && (
                  <Card className="border-amber-300 bg-amber-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="w-4 h-4" />
                        AI弾き → 強制申請レシート
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">カテゴリ:</span>
                          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-100">
                            {receiptDetails.receipt.aiRejectionCategory === 'not_tiktok' ? 'TikTok以外の画面' :
                             receiptDetails.receipt.aiRejectionCategory === 'not_delivered' ? '未配達' :
                             receiptDetails.receipt.aiRejectionCategory === 'incomplete' ? '金額読み取り不可' : 'その他'}
                          </Badge>
                        </div>
                        {receiptDetails.receipt.aiRejectionReason && (
                          <div className="flex items-start gap-2">
                            <span className="text-muted-foreground flex-shrink-0">理由:</span>
                            <span className="font-medium text-amber-800">{receiptDetails.receipt.aiRejectionReason}</span>
                          </div>
                        )}
                        {receiptDetails.receipt.forceSubmittedAt && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">強制申請日時:</span>
                            <span className="font-medium">{new Date(receiptDetails.receipt.forceSubmittedAt).toLocaleString("ja-JP")}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-amber-600 bg-amber-100 rounded p-1.5">
                        ※ このレシートはAIが一度弾いたものですが、お客様が「それでもアップロード」を選択しました。審査結果はAI学習データとして蓄積されます。
                      </div>
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
                  <div className="space-y-2 pt-2">
                    <div className="flex gap-2">
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
                    </div>
                    <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="却下理由を選択（AI学習用）" />
                      </SelectTrigger>
                      <SelectContent>
                        {REJECTION_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <span className="flex items-center gap-1">
                              <span>{cat.label}</span>
                              <span className="text-[9px] text-muted-foreground">({cat.desc})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setSelectedReceipt(null);
                        handleDirectReject(receiptDetails.receipt.id);
                      }}
                      disabled={rejectMutation.isPending || !rejectionCategory}
                    >
                      {rejectMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />送信中...</>
                      ) : (
                        <><XCircle className="w-4 h-4 mr-2" />却下（LINE送信）</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Hold Action Dialog (reject no longer uses dialog) */}
      <Dialog open={!!actionDialog && actionDialog.type === "hold"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" /> レシートを保留
            </DialogTitle>
            <DialogDescription>
              このレシートを保留にしますか？理由を入力してください。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
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
              disabled={!actionNote || holdMutation.isPending}
            >
              {holdMutation.isPending ? "処理中..." : "保留にする"}
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

// ===== AI審査ログパネル =====
function AiReviewLogPanel() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(undefined);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const utils = trpc.useUtils();
  
  // Fetch batches
  const { data: batches, isLoading: batchesLoading } = trpc.aiReview.getBatches.useQuery({ limit: 20 });
  
  // Fetch logs with filter
  const logsInput = useMemo(() => {
    const params: any = { isDryRun: false, limit: 100 };
    if (selectedBatchId) params.batchId = selectedBatchId;
    if (filter !== "all") params.aiDecision = filter;
    return params;
  }, [filter, selectedBatchId]);
  
  const { data: logs, isLoading: logsLoading } = trpc.aiReview.getLogs.useQuery(logsInput);
  
  // Override mutation
  const overrideMutation = trpc.aiReview.overrideDecision.useMutation({
    onSuccess: (data) => {
      toast.success(`AI判定を修正しました: ${data.humanOverride === "approved" ? "承認" : "却下"}`);
      utils.aiReview.getLogs.invalidate();
      utils.aiReview.getBatches.invalidate();
      utils.aiReview.getStats.invalidate();
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
    },
    onError: (err) => {
      toast.error(`修正エラー: ${err.message}`);
    },
  });
  
  const toggleComment = (id: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  // Decision config for consistent styling
  const decisionConfig: Record<string, { label: string; icon: any; bg: string; text: string; border: string; ringColor: string }> = {
    approved: { label: "AI承認", icon: ShieldCheck, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", ringColor: "ring-emerald-400" },
    rejected_duplicate: { label: "AI却下（重複）", icon: ShieldX, bg: "bg-red-50", text: "text-red-700", border: "border-red-200", ringColor: "ring-red-400" },
    rejected_ai: { label: "AI却下（低信頼度）", icon: ShieldX, bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", ringColor: "ring-rose-400" },
    held: { label: "AI保留", icon: ShieldAlert, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", ringColor: "ring-amber-400" },
    skipped: { label: "スキップ", icon: SkipForward, bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", ringColor: "ring-gray-400" },
  };
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return { bg: "bg-emerald-500", text: "text-emerald-700" };
    if (confidence >= 80) return { bg: "bg-green-500", text: "text-green-700" };
    if (confidence >= 60) return { bg: "bg-amber-500", text: "text-amber-700" };
    return { bg: "bg-red-500", text: "text-red-700" };
  };
  
  // Summary counts
  const summaryCounts = useMemo(() => {
    if (!logs) return { approved: 0, rejected: 0, rejectedAi: 0, held: 0, skipped: 0, total: 0 };
    return {
      approved: logs.filter((l: any) => l.aiDecision === "approved").length,
      rejected: logs.filter((l: any) => l.aiDecision === "rejected_duplicate").length,
      rejectedAi: logs.filter((l: any) => l.aiDecision === "rejected_ai").length,
      held: logs.filter((l: any) => l.aiDecision === "held").length,
      skipped: logs.filter((l: any) => l.aiDecision === "skipped").length,
      total: logs.length,
    };
  }, [logs]);
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-200">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">AI審査ログ</h3>
            <p className="text-xs text-muted-foreground">AIが自動判定した全レシートの履歴・人間による修正</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            utils.aiReview.getLogs.invalidate();
            utils.aiReview.getBatches.invalidate();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          更新
        </Button>
      </div>
      
      {/* Summary Stats */}
      {logs && logs.length > 0 && (
        <div className="grid grid-cols-6 gap-2">
          <div className="rounded-lg border bg-card p-2.5 text-center">
            <p className="text-lg font-bold">{summaryCounts.total}</p>
            <p className="text-[10px] text-muted-foreground">合計</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-emerald-700">{summaryCounts.approved}</p>
            <p className="text-[10px] text-emerald-600">AI承認</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-red-700">{summaryCounts.rejected}</p>
            <p className="text-[10px] text-red-600">重複却下</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-rose-700">{summaryCounts.rejectedAi}</p>
            <p className="text-[10px] text-rose-600">AI却下</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-amber-700">{summaryCounts.held}</p>
            <p className="text-[10px] text-amber-600">AI保留</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-gray-600">{summaryCounts.skipped}</p>
            <p className="text-[10px] text-gray-500">スキップ</p>
          </div>
        </div>
      )}
      
      {/* Batch History */}
      {batches && batches.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">バッチ実行履歴</p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={!selectedBatchId ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 rounded-full"
                onClick={() => setSelectedBatchId(undefined)}
              >
                全て
              </Button>
              {batches.map((batch: any) => (
                <Button
                  key={batch.batchId}
                  variant={selectedBatchId === batch.batchId ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7 rounded-full"
                  onClick={() => setSelectedBatchId(batch.batchId)}
                >
                  {new Date(batch.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  <span className="ml-1 opacity-70">({batch.totalCount}件)</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">フィルター:</span>
        {[
          { value: "all", label: "全て", icon: List, count: summaryCounts.total },
          { value: "approved", label: "AI承認", icon: ShieldCheck, count: summaryCounts.approved },
          { value: "rejected_duplicate", label: "重複却下", icon: ShieldX, count: summaryCounts.rejected },
          { value: "rejected_ai", label: "AI却下", icon: ShieldX, count: summaryCounts.rejectedAi },
          { value: "held", label: "AI保留", icon: ShieldAlert, count: summaryCounts.held },
          { value: "skipped", label: "スキップ", icon: SkipForward, count: summaryCounts.skipped },
        ].map(({ value, label, icon: Icon, count }) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 rounded-full"
            onClick={() => setFilter(value)}
          >
            <Icon className="w-3 h-3 mr-1" />
            {label}
            <span className="ml-1 opacity-60">({count})</span>
          </Button>
        ))}
      </div>
      
      {/* Log List */}
      {logsLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          読み込み中...
        </div>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>AI審査ログはまだありません</p>
            <p className="text-xs mt-1">AI自動承認モードをONにすると、ここに審査結果が記録されます</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const config = decisionConfig[log.aiDecision] || decisionConfig.skipped;
            const DecisionIcon = config.icon;
            const isExpanded = expandedComments.has(log.id);
            const commentTruncated = log.aiComment && log.aiComment.length > 60;
            const confidenceColor = log.aiConfidence ? getConfidenceColor(log.aiConfidence) : null;
            
            return (
              <Card 
                key={log.id} 
                className={`transition-all hover:shadow-md ${
                  log.humanOverride 
                    ? "border-blue-300 bg-blue-50/30 ring-1 ring-blue-200" 
                    : `${config.border} ${config.bg}/30`
                }`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex gap-3">
                    {/* Left: Thumbnail */}
                    <div className="flex-shrink-0">
                      {log.imageUrl ? (
                        <img 
                          src={log.imageUrl} 
                          alt="レシート" 
                          className={`w-14 h-14 object-cover rounded-lg border-2 ${config.border}`}
                        />
                      ) : (
                        <div className={`w-14 h-14 rounded-lg border-2 ${config.border} ${config.bg} flex items-center justify-center`}>
                          <FileText className={`w-6 h-6 ${config.text} opacity-50`} />
                        </div>
                      )}
                    </div>
                    
                    {/* Center: Main info */}
                    <div className="flex-1 min-w-0">
                      {/* Top row: ID + Decision badge + Confidence + Override */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-mono font-bold text-muted-foreground">#{log.receiptId}</span>
                        
                        {/* AI Decision Badge - prominent */}
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.text} ${config.border} border`}>
                          <DecisionIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                        
                        {/* Confidence meter */}
                        {log.aiConfidence != null && confidenceColor && (
                          <span className="inline-flex items-center gap-1">
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${confidenceColor.bg}`}
                                style={{ width: `${log.aiConfidence}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${confidenceColor.text}`}>{log.aiConfidence}%</span>
                          </span>
                        )}
                        
                        {/* Human override badge */}
                        {log.humanOverride && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                            log.humanOverride === "approved" 
                              ? "bg-blue-100 text-blue-700 border-blue-300" 
                              : "bg-pink-100 text-pink-700 border-pink-300"
                          }`}>
                            {log.humanOverride === "approved" ? <ThumbsUp className="w-2.5 h-2.5" /> : <ThumbsDown className="w-2.5 h-2.5" />}
                            {log.humanOverride === "approved" ? "人間承認" : "人間却下"}
                          </span>
                        )}
                      </div>
                      
                      {/* Meta info row */}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5 flex-wrap">
                        {log.orderNumber && (
                          <span className="inline-flex items-center gap-0.5 bg-gray-100 rounded px-1.5 py-0.5">
                            <Hash className="w-2.5 h-2.5" />
                            <span className="font-mono">{log.orderNumber}</span>
                          </span>
                        )}
                        {log.storeName && (
                          <span className="inline-flex items-center gap-0.5">
                            <Store className="w-2.5 h-2.5" />{log.storeName}
                          </span>
                        )}
                        {log.totalAmount != null && (
                          <span className="inline-flex items-center gap-0.5 font-medium">
                            <DollarSign className="w-2.5 h-2.5" />¥{Number(log.totalAmount).toLocaleString()}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {new Date(log.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      
                      {/* AI Comment - collapsible */}
                      {log.aiComment && (
                        <div 
                          className={`text-xs leading-relaxed rounded-md px-2.5 py-1.5 ${config.bg} ${config.border} border cursor-pointer`}
                          onClick={() => commentTruncated && toggleComment(log.id)}
                        >
                          <div className="flex items-start gap-1">
                            <Bot className={`w-3 h-3 mt-0.5 flex-shrink-0 ${config.text}`} />
                            <span className={`${config.text}`}>
                              {commentTruncated && !isExpanded 
                                ? log.aiComment.substring(0, 60) + "..." 
                                : log.aiComment
                              }
                            </span>
                            {commentTruncated && (
                              <button className={`flex-shrink-0 ${config.text} opacity-60`}>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Human comment */}
                      {log.humanComment && (
                        <div className="mt-1.5 text-xs bg-blue-50 rounded-md px-2.5 py-1.5 border border-blue-200">
                          <div className="flex items-start gap-1">
                            <User className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-600" />
                            <span className="text-blue-700">{log.humanComment}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Right: Action buttons */}
                    <div className="flex-shrink-0 flex flex-col gap-1 justify-center">
                      {!log.humanOverride && (
                        <>
                          {log.aiDecision !== "approved" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-sm"
                              onClick={() => {
                                const comment = prompt("承認コメント（任意）:");
                                overrideMutation.mutate({
                                  logId: log.id,
                                  humanOverride: "approved",
                                  humanComment: comment || undefined,
                                });
                              }}
                              disabled={overrideMutation.isPending}
                            >
                              <ThumbsUp className="w-3 h-3 mr-1" />
                              承認
                            </Button>
                          )}
                          {log.aiDecision === "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50 rounded-full"
                              onClick={() => {
                                const comment = prompt("却下理由:");
                                if (comment) {
                                  overrideMutation.mutate({
                                    logId: log.id,
                                    humanOverride: "rejected",
                                    humanComment: comment,
                                  });
                                }
                              }}
                              disabled={overrideMutation.isPending}
                            >
                              <ThumbsDown className="w-3 h-3 mr-1" />
                              却下
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
