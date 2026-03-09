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
  Globe,
  UserCheck,
  UserX,
  Trophy,
  Flame,
  Target,
  TrendingUp,
} from "lucide-react";

type ReceiptStatus = "pending" | "approved" | "rejected" | "on_hold" | "ai_log";

// AI rejection reason categories for learning (keys for i18n)
const REJECTION_CATEGORY_VALUES = [
  "not_order_detail", "not_tiktok_shop", "not_delivered", "blurry_image",
  "missing_order_number", "missing_amount", "partial_screenshot", "duplicate",
  "wrong_store", "suspicious", "incomplete_info", "other",
] as const;

// AI approval confidence labels
// Confidence labels are now handled inside the component with t()
const getConfidenceLabelStatic = (score: number) => {
  if (score >= 90) return { key: "lr.highConfidence", color: "text-green-600 bg-green-50 border-green-200" };
  if (score >= 70) return { key: "lr.medConfidence", color: "text-yellow-600 bg-yellow-50 border-yellow-200" };
  return { key: "lr.lowConfidence", color: "text-red-600 bg-red-50 border-red-200" };
};

export default function LineReceiptManagement({ embedded = false }: { embedded?: boolean } = {}) {
  const { t, language, setLanguage } = useLanguage();
  
  // Wrap confidence label with translation
  const getConfidenceLabel = (score: number) => {
    const { key, color } = getConfidenceLabelStatic(score);
    return { label: t(key), color };
  };

  // Build rejection categories from i18n
  const REJECTION_CATEGORIES = useMemo(() => 
    REJECTION_CATEGORY_VALUES.map(value => ({
      value,
      label: t(`lr.reject.${value}`),
      desc: t(`lr.reject.${value}.desc`),
    })),
  [language, t]);
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
  
  // AI Pass 2 re-review state
  const [pass2ConfirmOpen, setPass2ConfirmOpen] = useState(false);
  const [pass2Running, setPass2Running] = useState(false);
  const [pass2Result, setPass2Result] = useState<{
    autoApproved: number;
    autoRejected: number;
    keptManual: number;
    skipped: number;
    total: number;
    isComplete: boolean;
  } | null>(null);
  
  // Reject/Hold dialog state (separate from calculator approve flow)
  const [actionDialog, setActionDialog] = useState<{ type: "reject" | "hold"; id: number; receipt?: any } | null>(null);
  
  // Keyboard shortcut help
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  
  // Order number search
  const [orderNumberSearch, setOrderNumberSearch] = useState("");
  
  // AI Auto-Approve state
  const [aiAutoApproveResult, setAiAutoApproveResult] = useState<{
    processed: number;
    results: { id: number; action: string; reason: string; confidence?: number; orderNumber?: string; amount?: number }[];
    summary: { approved: number; skipped: number; held: number; rejectedDuplicate: number; rejectedAi: number };
    dryRun?: boolean;
    batchId?: string;
    hasMore?: boolean;
  } | null>(null);
  
  // Live feed: shows each receipt result one by one with animation
  const [liveFeedItems, setLiveFeedItems] = useState<{
    id: number;
    action: string;
    reason: string;
    confidence?: number;
    orderNumber?: string;
    amount?: number;
    timestamp: number;
  }[]>([]);
  const liveFeedRef = useRef<HTMLDivElement>(null);
  const retryCountRef = useRef(0);
  
  // Cumulative AI auto-approve stats (across all batches in this session)
  const [cumulativeStats, setCumulativeStats] = useState<{
    totalProcessed: number;
    totalApproved: number;
    totalRejectedDuplicate: number;
    totalRejectedAi: number;
    totalHeld: number;
    totalSkipped: number;
    batchCount: number;
  }>({ totalProcessed: 0, totalApproved: 0, totalRejectedDuplicate: 0, totalRejectedAi: 0, totalHeld: 0, totalSkipped: 0, batchCount: 0 });
  
  // Ref to track if auto mode is still on (to avoid stale closure issues)
  const aiAutoModeRef = useRef(false);
  
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
      toast.success(t("lr.toast.approveComplete"), { duration: 2000 });
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
      toast.success(`${t("lr.toast.rejectComplete")} ${rejectionCategory || "other"}`, { duration: 2000 });
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
      toast.error(t("lr.toast.selectRejectionReason"));
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
        results.push(`${t("lr.orderNumber")}: ${data.orderNumber}`);
      }
      
      // Always auto-fill amount if detected (overwrite even if existing)
      if (data.totalAmount && typeof data.totalAmount === "number" && data.totalAmount > 0) {
        setCalcAmount(String(data.totalAmount));
        results.push(`${t("lr.amount")}: ¥${data.totalAmount.toLocaleString()}`);
      }
      
      if (data.shopName) {
        results.push(`${t("lr.storeName")}: ${data.shopName}`);
      }
      if (data.orderDate) {
        results.push(`${t("lr.purchaseDate")}: ${data.orderDate}`);
      }
      
      // Refresh receipt list to show updated DB data (amount, store, date)
      utils.point.adminGetLineReceipts.invalidate();
      
      if (results.length > 0) {
        toast.success(`${t("lr.toast.aiRecognizeComplete")}\n${results.join(" / ")}`, { duration: 5000 });
      } else {
        toast.error(t("lr.toast.aiRecognizeFailed"));
      }
      
      setIsAiRecognizing(false);
    },
    onError: (err) => {
      toast.error(`${t("lr.toast.aiRecognizeError")} ${err.message}`);
      setIsAiRecognizing(false);
    },
  });
  
  // AI Auto-Approve mutation
  const aiAutoApproveMutation = trpc.point.adminAiAutoApprove.useMutation({
    onSuccess: (data) => {
      setAiAutoApproveResult(data);
      retryCountRef.current = 0; // Reset retry count on success
      
      // Update cumulative stats
      setCumulativeStats(prev => ({
        totalProcessed: prev.totalProcessed + data.processed,
        totalApproved: prev.totalApproved + data.summary.approved,
        totalRejectedDuplicate: prev.totalRejectedDuplicate + data.summary.rejectedDuplicate,
        totalRejectedAi: prev.totalRejectedAi + (data.summary.rejectedAi || 0),
        totalHeld: prev.totalHeld + data.summary.held,
        totalSkipped: prev.totalSkipped + data.summary.skipped,
        batchCount: prev.batchCount + 1,
      }));
      
      // Add results to live feed one by one with staggered timestamps
      if (data.results && data.results.length > 0) {
        const now = Date.now();
        const newItems = data.results.map((r, i) => ({
          id: r.id,
          action: r.action,
          reason: r.reason,
          confidence: r.confidence,
          orderNumber: r.orderNumber,
          amount: r.amount,
          timestamp: now + i * 150, // stagger by 150ms for animation effect
        }));
        setLiveFeedItems(prev => [...newItems, ...prev].slice(0, 100)); // Keep last 100 items
        // Auto-scroll live feed to top
        setTimeout(() => {
          liveFeedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
      }
      
      if (data.dryRun) {
        toast.info(`${t("lr.preview")}: ${data.processed}${t("lr.items")} (${t("lr.approve")}: ${data.summary.approved}, ${t("lr.aiLog.duplicateRejected")}: ${data.summary.rejectedDuplicate}, ${t("lr.aiLog.aiRejected")}: ${data.summary.rejectedAi || 0}, ${t("lr.hold")}: ${data.summary.held})`);
      } else {
        utils.point.adminGetLineReceipts.invalidate();
        utils.point.adminGetLineStatistics.invalidate();
        utils.point.adminDetectDuplicateReceipts.invalidate();
        
        // Continuous processing: if auto mode is ON and there are more pending receipts, auto-trigger next batch
        if (aiAutoModeRef.current && data.hasMore && data.processed > 0) {
          // Short delay before next batch to avoid overwhelming the server
          setTimeout(() => {
            if (aiAutoModeRef.current) {
              aiAutoApproveMutation.mutate({ limit: 20, dryRun: false, confidenceThreshold: 70 });
            }
          }, 2000);
        } else if (aiAutoModeRef.current && !data.hasMore) {
          // All done! Turn off auto mode
          setAiAutoMode(false);
          aiAutoModeRef.current = false;
          toast.success("✅ 全ての未処理レシートのAI審査が完了しました！");
        }
      }
    },
    onError: (err) => {
      // Retry up to 3 times on error
      if (aiAutoModeRef.current && retryCountRef.current < 3) {
        retryCountRef.current += 1;
        toast.error(`エラーが発生しました。リトライ中... (${retryCountRef.current}/3)`);
        setTimeout(() => {
          if (aiAutoModeRef.current) {
            aiAutoApproveMutation.mutate({ limit: 20, dryRun: false, confidenceThreshold: 70 });
          }
        }, 5000); // Wait 5 seconds before retry
      } else {
        toast.error(`${t("lr.aiAutoMode")} Error: ${err.message}`);
        // On error after retries, stop auto mode
        setAiAutoMode(false);
        aiAutoModeRef.current = false;
        retryCountRef.current = 0;
      }
    },
  });
  
  // Server-side AI auto-approve mutations
  const startServerAutoApproveMutation = trpc.aiReview.startServerAutoApprove.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (err) => {
      toast.error(`開始エラー: ${err.message}`);
      setAiAutoMode(false);
      aiAutoModeRef.current = false;
    },
  });
  
  const stopServerAutoApproveMutation = trpc.aiReview.stopServerAutoApprove.useMutation({
    onSuccess: (data) => {
      toast.info(data.message);
    },
    onError: (err) => {
      toast.error(`停止エラー: ${err.message}`);
    },
  });
  
  // ===== AI Pass 2: Manual Queue Re-review =====
  const startPass2Mutation = trpc.aiReview.startPass2.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setPass2Running(true);
        setPass2Result(null);
        toast.success(t("lr.pass2.started"));
      } else {
        toast.warning(data.message);
      }
    },
    onError: (err) => {
      toast.error(`${t("lr.pass2.error")}: ${err.message}`);
      setPass2Running(false);
    },
  });
  
  const pass2ProgressQuery = trpc.aiReview.getPass2Progress.useQuery(undefined, {
    enabled: pass2Running,
    refetchInterval: pass2Running ? 3000 : false,
  });
  
  // Sync Pass2 progress
  useEffect(() => {
    if (pass2ProgressQuery.data) {
      const { progress, isRunning } = pass2ProgressQuery.data;
      if (progress) {
        setPass2Result({
          autoApproved: progress.autoApproved,
          autoRejected: progress.autoRejected,
          keptManual: progress.keptManual,
          skipped: progress.skipped,
          total: progress.total,
          isComplete: progress.isComplete,
        });
        
        if (progress.isComplete || !isRunning) {
          setPass2Running(false);
          if (progress.isComplete && progress.total > 0) {
            toast.success(`${t("lr.pass2.complete")}: ${progress.autoApproved}承認 / ${progress.autoRejected}却下 / ${progress.keptManual}手動`);
            // Refresh data
            utils.point.adminGetLineReceipts.invalidate();
            utils.point.adminGetLineStatistics.invalidate();
            utils.point.adminDetectDuplicateReceipts.invalidate();
          }
        }
      }
    }
  }, [pass2ProgressQuery.data]);
  
  // Poll for server-side progress every 5 seconds when auto mode is on
  const serverProgressQuery = trpc.aiReview.getAutoApproveProgress.useQuery(undefined, {
    enabled: aiAutoMode,
    refetchInterval: aiAutoMode ? 5000 : false,
  });
  
  // Sync server state with local state
  useEffect(() => {
    if (serverProgressQuery.data) {
      const progress = serverProgressQuery.data;
      
      // Update cumulative stats from server
      setCumulativeStats({
        totalProcessed: progress.totalProcessed,
        totalApproved: progress.totalApproved,
        totalRejectedDuplicate: 0, // Server tracks totalRejected (combined)
        totalRejectedAi: progress.totalRejected,
        totalHeld: progress.totalHeld,
        totalSkipped: progress.totalSkipped,
        batchCount: progress.currentBatchNumber,
      });
      
      // If server stopped, sync local state
      if (!progress.isRunning && aiAutoModeRef.current) {
        setAiAutoMode(false);
        aiAutoModeRef.current = false;
        if (progress.totalProcessed > 0 && !progress.hasMoreCandidates) {
          toast.success("✅ 全ての未処理レシートのAI審査が完了しました！");
        }
        // Refresh receipt lists
        utils.point.adminGetLineReceipts.invalidate();
        utils.point.adminGetLineStatistics.invalidate();
        utils.point.adminDetectDuplicateReceipts.invalidate();
      }
    }
  }, [serverProgressQuery.data]);
  
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
            toast.error(t("lr.toast.selectRejectionReason"));
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
    return t("lr.unknown");
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
              {t("lr.subtitle")}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setLanguage(language === "ja" ? "zh" : "ja")}
            >
              <Globe className="w-4 h-4" />
              {language === "ja" ? "中文" : "日本語"}
            </Button>
            {/* Keyboard Shortcut Help Button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowShortcutHelp(true)}
            >
              <Keyboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t("lr.shortcuts")}</span>
              <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border">?</kbd>
            </Button>
          </div>
        </div>
      )}

        {/* AI Auto Mode Toggle + Pass2 Button */}
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="flex items-center gap-2 flex-1">
            <Brain className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-sm font-medium">{t("lr.aiAutoMode")}</p>
              <p className="text-xs text-muted-foreground">{t("lr.aiAutoModeDesc")}</p>
            </div>
          </div>
          <Switch 
            checked={aiAutoMode} 
            onCheckedChange={(checked) => {
              if (checked) {
                setAiAutoMode(true);
                aiAutoModeRef.current = true;
                setLiveFeedItems([]);
                startServerAutoApproveMutation.mutate();
              } else {
                setAiAutoMode(false);
                aiAutoModeRef.current = false;
                stopServerAutoApproveMutation.mutate();
              }
            }}
          />
          <div className="border-l pl-3 ml-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700"
              disabled={pass2Running || startPass2Mutation.isPending || (stats?.onHold || 0) === 0}
              onClick={() => {
                if ((stats?.onHold || 0) === 0) {
                  toast.info(t("lr.pass2.noOnHold"));
                  return;
                }
                setPass2ConfirmOpen(true);
              }}
            >
              {pass2Running ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {t("lr.pass2.button")} ({stats?.onHold || 0})
            </Button>
          </div>
        </div>
      
      {/* Batch AI Recognition Progress */}
      {batchAiProgress.running && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600 animate-pulse" />
              <div>
                <p className="text-sm font-medium text-purple-800">{t("lr.aiAutoRecognizing")}</p>
                <p className="text-xs text-purple-600">{batchAiProgress.completed} / {batchAiProgress.total} {t("lr.processed")}</p>
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
              {t("lr.abort")}
            </Button>
          </div>
        </div>
      )}
      {!batchAiProgress.running && batchAiProgress.completed > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700">{t("lr.aiAutoRecognizeComplete")}: {batchAiProgress.completed}{t("lr.imagesAnalyzed")}</span>
        </div>
      )}

      {/* AI Pass 2 Progress */}
      {(pass2Running || (pass2Result && !pass2Result.isComplete)) && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-600 animate-pulse" />
              <div>
                <p className="text-sm font-medium text-orange-800">{t("lr.pass2.running")}</p>
                <p className="text-xs text-orange-600">
                  {pass2Result ? `${pass2Result.autoApproved + pass2Result.autoRejected + pass2Result.keptManual + pass2Result.skipped} / ${pass2Result.total} ${t("lr.processed")}` : t("lr.pass2.processing")}
                </p>
              </div>
            </div>
            <div className="flex-1 mx-4">
              <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${pass2Result && pass2Result.total > 0 ? ((pass2Result.autoApproved + pass2Result.autoRejected + pass2Result.keptManual + pass2Result.skipped) / pass2Result.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            {pass2Result && (
              <div className="flex gap-2 text-xs">
                <span className="text-green-600 font-medium">✓{pass2Result.autoApproved}</span>
                <span className="text-red-600 font-medium">✗{pass2Result.autoRejected}</span>
                <span className="text-orange-600 font-medium">✋{pass2Result.keptManual}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Pass 2 Complete */}
      {pass2Result && pass2Result.isComplete && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">{t("lr.pass2.complete")}</p>
              <p className="text-xs text-green-600">{pass2Result.total}{t("lr.items")}{t("lr.processed")}</p>
            </div>
            <div className="flex gap-3 text-sm">
              <div className="text-center">
                <p className="font-bold text-green-600">{pass2Result.autoApproved}</p>
                <p className="text-xs text-muted-foreground">{t("lr.pass2.autoApproved")}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-red-600">{pass2Result.autoRejected}</p>
                <p className="text-xs text-muted-foreground">{t("lr.pass2.autoRejected")}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-orange-600">{pass2Result.keptManual}</p>
                <p className="text-xs text-muted-foreground">{t("lr.pass2.keptManual")}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setPass2Result(null)}
            >
              <XCircle className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Order Number Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={orderNumberSearch}
          onChange={(e) => setOrderNumberSearch(e.target.value)}
          placeholder={t("lr.searchOrderNumber")}
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
              <span className="text-sm text-muted-foreground">{t("lr.aiReviewLog")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              <FileText className="w-5 h-5 inline text-purple-500" />
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* AI Auto Mode Banner - Server-side processing */}
      {aiAutoMode && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-100">
                  {(serverProgressQuery.data?.isRunning || cumulativeStats.batchCount === 0) ? (
                    <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-purple-800">
                    {serverProgressQuery.data?.isRunning
                      ? `🚀 AI自動審査中... (バッチ ${cumulativeStats.batchCount})`
                      : cumulativeStats.batchCount > 0
                        ? "✅ AI自動審査完了"
                        : "🚀 AI自動審査を開始しています..."}
                  </p>
                  <p className="text-sm text-purple-600">
                    {serverProgressQuery.data?.isRunning
                      ? "サーバー側で自動処理中。ブラウザを閉じても処理は続きます"
                      : cumulativeStats.batchCount > 0
                        ? `${cumulativeStats.totalProcessed}件処理完了`
                        : "サーバーに接続中..."}
                  </p>
                </div>
              </div>
              {/* Stop button */}
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => {
                  setAiAutoMode(false);
                  aiAutoModeRef.current = false;
                  stopServerAutoApproveMutation.mutate();
                }}
              >
                停止
              </Button>
            </div>
            
            {/* Cumulative Stats from server */}
            {cumulativeStats.batchCount > 0 && (
              <div className="mt-3 border-t border-purple-200 pt-3">
                <div className="flex items-center gap-4 mb-2">
                  <Badge variant="outline" className="border-purple-300 text-purple-700">
                    累計 ({cumulativeStats.batchCount}バッチ)
                  </Badge>
                  <span className="text-sm font-bold text-purple-700">{cumulativeStats.totalProcessed}{t("lr.items")}処理済み</span>
                  {serverProgressQuery.data?.isRunning && (
                    <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div className="bg-green-100 rounded p-2 text-center">
                    <p className="text-lg font-bold text-green-700">{cumulativeStats.totalApproved}</p>
                    <p className="text-xs text-green-600">{t("lr.approve")}</p>
                  </div>
                  <div className="bg-red-100 rounded p-2 text-center">
                    <p className="text-lg font-bold text-red-700">{cumulativeStats.totalRejectedAi}</p>
                    <p className="text-xs text-red-600">却下</p>
                  </div>
                  <div className="bg-orange-100 rounded p-2 text-center">
                    <p className="text-lg font-bold text-orange-700">{cumulativeStats.totalHeld}</p>
                    <p className="text-xs text-orange-600">{t("lr.hold")}</p>
                  </div>
                  <div className="bg-gray-100 rounded p-2 text-center">
                    <p className="text-lg font-bold text-gray-700">{cumulativeStats.totalSkipped}</p>
                    <p className="text-xs text-gray-600">{t("lr.aiLog.skipped")}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Processing indicator when starting */}
            {cumulativeStats.batchCount === 0 && (
              <div className="mt-3 border-t border-purple-200 pt-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span className="text-sm text-purple-600">最初のバッチを処理中...</span>
                </div>
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
            <div className="text-center py-8 text-muted-foreground">{t("lr.loading")}</div>
          ) : receipts?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t("receipts.noReceipts")}</p>
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
                          <span className="text-sm font-semibold">{t("lr.reviewPanel")}</span>
                          {sessionProcessedCount > 0 && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 font-normal">
                              {sessionProcessedCount}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">{t("lr.autoSend")}</span>
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
                          <p className="text-sm font-bold text-green-700">{sessionProcessedCount} {t("lr.processed")}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {sessionProcessedCount} {t("lr.items")}
                          </p>
                        </div>
                        ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-xs">{t("lr.selectReceipt")}</p>
                          <div className="mt-2 flex items-center justify-center gap-1 text-[10px]">
                            <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[9px]">↑↓</kbd>
                            <span>{t("lr.selectHint")}</span>
                            <kbd className="px-1 py-0.5 font-mono bg-muted rounded border text-[9px]">Enter</kbd>
                            <span>{t("lr.approveHint")}</span>
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
                                    <span className="font-bold text-orange-700 text-[10px]">{t("lr.duplicate")} {others.length}{t("lr.items")}</span>
                                  </div>
                                  {others.length > 0 && (
                                    <div className="space-y-1">
                                      {others.map((other, idx) => (
                        <div 
                          key={`${other.source}-${other.id}-${idx}`} 
                          className="bg-white border border-orange-200 rounded px-1.5 py-1.5 flex items-center gap-1.5 cursor-pointer hover:bg-orange-50 active:bg-orange-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (other.source === "line_receipt") {
                              const target = receipts?.find((r: any) => r.receipt.id === other.id);
                              if (target) {
                                selectForCalc(other.id);
                                toast.info(`#${other.id} ${t("lr.toast.switchedTo")}`);
                              } else {
                                // Switch to the tab where this receipt exists based on its status
                                const statusTabMap: Record<string, string> = {
                                  approved: "approved",
                                  rejected: "rejected",
                                  on_hold: "on_hold",
                                  pending: "pending",
                                };
                                const targetTab = statusTabMap[other.status] || "pending";
                                setActiveTab(targetTab as ReceiptStatus);
                                // Set the receipt ID after tab switch - it will be selected when data loads
                                setTimeout(() => setCalcReceiptId(other.id), 300);
                                toast.info(`#${other.id} → ${other.status === "approved" ? t("lr.approvedStatus") : other.status === "rejected" ? t("lr.rejectedStatus") : other.status === "on_hold" ? t("lr.holdStatus") : t("lr.waitingStatus")} ${t("lr.toast.switchedTo")}`);
                              }
                            }
                          }}
                        >
                          {other.imageUrl && (
                            <img src={other.imageUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <Badge variant="outline" className="text-[8px] px-0.5 py-0">
                                {other.source === "line_receipt" ? t("lr.LINE") : t("lr.Web")}
                              </Badge>
                              <Badge variant={other.status === "approved" ? "default" : other.status === "rejected" ? "destructive" : "secondary"} className="text-[8px] px-0.5 py-0">
                                {other.status === "approved" ? t("lr.approvedStatus") : other.status === "rejected" ? t("lr.rejectedStatus") : other.status === "on_hold" ? t("lr.holdStatus") : t("lr.waitingStatus")}
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
                            <ExternalLink className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
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
                                  <span className="font-bold text-amber-700 text-[10px]">{t("lr.aiRejectedForceSubmit")}</span>
                                </div>
                                {selectedCalcReceipt.receipt.aiRejectionReason && (
                                  <div className="text-[9px] text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">
                                    <span className="font-medium">{t("lr.aiRejectionReason")}</span> {selectedCalcReceipt.receipt.aiRejectionReason}
                                  </div>
                                )}
                                {selectedCalcReceipt.receipt.aiRejectionCategory && (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-400 text-amber-700 bg-amber-100">
                                      {selectedCalcReceipt.receipt.aiRejectionCategory === 'not_tiktok' ? t("lr.notTiktok") :
                                       selectedCalcReceipt.receipt.aiRejectionCategory === 'not_delivered' ? t("lr.notDelivered") :
                                       selectedCalcReceipt.receipt.aiRejectionCategory === 'incomplete' ? t("lr.incompleteAmount") : t("lr.otherReason")}
                                    </Badge>
                                    <span className="text-[8px] text-amber-600">{t("lr.customerForceSubmit")}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Order Number - Compact */}
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <Hash className="w-3 h-3 text-blue-600" />
                                <span className="text-[10px] text-muted-foreground">{t("lr.orderNumber")}</span>
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
                                    placeholder={t("lr.enterOrderNumber")}
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
                                    title={t("lr.aiReRecognize")}
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
                                      title={t("lr.save")}
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
                                  <Brain className="w-2.5 h-2.5" />{t("lr.aiReRecognize")}
                                </button>
                              )}
                              {isAiRecognizing && (
                                <p className="text-[9px] text-blue-500 flex items-center gap-0.5">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />{t("lr.loading")}
                                </p>
                              )}
                            </div>
                            
                            {/* Store & Date & AI - single row */}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-0.5">
                                <Store className="w-2.5 h-2.5" />
                                {selectedCalcReceipt.receipt.storeName || t("lr.storeUnknown")}
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
                                        <p className="text-[9px] font-medium text-blue-600 mb-0.5">{t("lr.products")}</p>
                                        {ocr.items.slice(0, 3).map((item: any, i: number) => (
                                          <div key={i} className="flex justify-between text-[10px] leading-tight">
                                            <span className="truncate flex-1 mr-1">{item.productName || t("lr.unknown")}</span>
                                            <span className="text-muted-foreground whitespace-nowrap">
                                              {item.unitPrice != null ? `¥${item.unitPrice.toLocaleString()}` : ""}
                                              {item.quantity != null ? ` x${item.quantity}` : ""}
                                            </span>
                                          </div>
                                        ))}
                                        {ocr.items.length > 3 && <p className="text-[9px] text-muted-foreground">{t("lr.moreItems").replace("{count}", String(ocr.items.length - 3))}</p>}
                                      </div>
                                    ) : ocr.productName ? (
                                      <div className="text-[10px]">
                                        <span className="text-muted-foreground">{t("lr.products")}: </span>
                                        <span className="font-medium">{ocr.productName}</span>
                                      </div>
                                    ) : null}
                                    {hasDelivery && (
                                      <div className="bg-amber-50/50 border border-amber-100 rounded px-1.5 py-1">
                                        <p className="text-[9px] font-medium text-amber-600 mb-0.5">{t("lr.deliveryAddress")}</p>
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
                                <DollarSign className="w-2.5 h-2.5" />{t("lr.purchaseAmount")}
                              </label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                                <Input
                                  type="number"
                                  value={calcAmount}
                                  onChange={(e) => setCalcAmount(e.target.value)}
                                  placeholder={t("lr.amount")}
                                  className="pl-6 text-sm font-bold h-8"
                                />
                              </div>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-center min-w-[80px]">
                              <p className="text-[9px] text-green-600">{t("lr.pointPercent")}</p>
                              <p className="text-lg font-bold text-green-700 leading-tight">{calcPoints}<span className="text-[10px] font-normal">pt</span></p>
                            </div>
                          </div>
                          
                          {/* Note - single line */}
                          <Input
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                            placeholder={t("lr.memo")}
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
                                  t("lr.approving")
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                    {t("lr.approveWithPoints").replace("{points}", String(calcPoints))}
                                  </>
                                )}
                              </Button>
                              {/* Rejection category selector */}
                              <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                                <SelectTrigger className="h-7 text-[10px]">
                                  <SelectValue placeholder={t("lr.selectRejectionReason")} />
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
                                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{t("lr.sending")}</>
                                  ) : (
                                    <><XCircle className="w-3 h-3 mr-1" />{t("lr.rejectLine")}</>
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
                                    {t("lr.hold")}
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
                                <span className="text-xs font-medium text-green-700">{t("lr.approved")}</span>
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
                                  <span className="text-xs font-medium text-red-700">{t("lr.rejected")}</span>
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
                                  t("lr.reviving")
                                ) : (
                                  <>
                                    <RotateCcw className="w-4 h-4 mr-1.5" />
                                    {t("lr.reviveApprove").replace("{points}", String(calcPoints))}
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          {t("lr.loading")}
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
                              {t("lr.receiptImages")}
                              <Badge variant="secondary" className="text-xs">{currentImageIndex + 1} / {images.length}</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openImageViewer(images, currentImageIndex)}
                            >
                              <ZoomIn className="w-3.5 h-3.5 mr-1" />
                              {t("lr.enlarge")}
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
                          <p className="text-sm text-muted-foreground">{t("lr.noImage")}</p>
                        </CardContent>
                      </Card>
                    );
                  })() : (
                    <Card className="border-2 border-dashed border-muted-foreground/30">
                      <CardContent className="py-20 text-center">
                        <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">{t("lr.selectToViewImage")}</p>
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
                  }).map(({ receipt, lineUser, kakuhen }) => {
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
                                  {(receipt.fraudFlags as string[]).includes("similar_order_number") ? t("lr.fraud.similar") : (receipt.fraudFlags as string[]).includes("duplicate_order") ? t("lr.fraud.duplicateLabel") : t("lr.fraud.fraudLabel")}
                                </Badge>
                              )}
                              {receipt.isForceSubmitted && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-700 bg-amber-50">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                  {t("lr.aiBounce")}
                                </Badge>
                              )}
                              {kakuhen && kakuhen.isKakuhen && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-pink-400 text-pink-700 bg-pink-50">
                                  <Zap className="w-2.5 h-2.5 mr-0.5" />
                                  確変 {kakuhen.boostedRate}%
                                </Badge>
                              )}
                              {duplicateReceiptIds.ids.has(receipt.id) && (() => {
                                const crossLink = duplicateReceiptIds.crossLinkMap.get(receipt.id);
                                const others = crossLink?.others || [];
                                const otherSummary = others.map(o => {
                                  const src = o.source === "line_receipt" ? "LINE" : "Web";
                                  const st = o.status === "approved" ? t("lr.approvedStatus") : o.status === "rejected" ? t("lr.rejectedStatus") : o.status === "on_hold" ? t("lr.holdStatus") : t("lr.waitingStatus");
                                  return `${src}#${o.id}(${st})`;
                                }).join(", ");
                                return (
                                  <Badge 
                                    variant="destructive" 
                                    className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 cursor-pointer"
                                    title={otherSummary ? `${t("lr.duplicate")}: ${otherSummary}` : t("lr.duplicate")}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                    {t("lr.duplicate")}{others.length > 0 ? `(${others.length})` : ""}
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
                            {/* Row 4: Store + Upload Date + Purchase Date */}
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="truncate">{receipt.storeName || t("lr.storeUnknown")}</span>
                              <span>·</span>
                              <span className="flex-shrink-0" title="アップロード日時">
                                📤 {receipt.submittedAt ? new Date(receipt.submittedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                              </span>
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
              {t("lr.receiptDetail")} #{selectedReceipt}
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
                          {t("lr.imagesCount").replace("{count}", String(images.length))}
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
                      {t("lr.aiAnalysis")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("lr.confidenceScore")}</span>
                      <Badge variant="outline" className={getConfidenceLabel(getAiConfidence(receiptDetails.receipt)).color}>
                        {getAiConfidence(receiptDetails.receipt)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("lr.ocrConfidence")}</span>
                      <span className="font-medium">{receiptDetails.receipt.ocrConfidence || "-"}%</span>
                    </div>
                    {receiptDetails.receipt.ocrRawText && (
                      <div>
                        <span className="text-muted-foreground block mb-1">{t("lr.ocrText")}</span>
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
                      {t("lr.edit")}
                    </Button>
                  )}
                </div>
                
                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label>{t("lr.storeName")}</Label>
                      <Input 
                        value={editForm.storeName}
                        onChange={(e) => setEditForm({ ...editForm, storeName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>{t("lr.purchaseDate")}</Label>
                      <Input 
                        type="date"
                        value={editForm.purchaseDate}
                        onChange={(e) => setEditForm({ ...editForm, purchaseDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>{t("lr.amount")}</Label>
                      <Input 
                        type="number"
                        value={editForm.totalAmount}
                        onChange={(e) => setEditForm({ ...editForm, totalAmount: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>{t("lr.currency")}</Label>
                      <Input 
                        value={editForm.currency}
                        onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleEditSave} disabled={updateOcrMutation.isPending}>
                        {t("lr.save")}
                      </Button>
                      <Button variant="outline" onClick={() => setEditMode(false)}>
                        {t("lr.cancel")}
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
                            <span className="text-muted-foreground">{t("lr.orderNumber")}</span>
                            <span className="font-mono text-sm font-medium">{orderNum}</span>
                          </div>
                        ) : null;
                      })()}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{t("lr.storeName")}</span>
                        <span className="font-medium">{receiptDetails.receipt.storeName || "-"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{t("lr.purchaseDate")}</span>
                        <span className="font-medium">{formatDate(receiptDetails.receipt.purchaseDate)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{t("lr.amount")}</span>
                        <span className="font-medium">{formatCurrency(receiptDetails.receipt.totalAmount, receiptDetails.receipt.currency || "JPY")}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{t("lr.calculatedPoints")}</span>
                        <span className="font-medium text-blue-600">{receiptDetails.receipt.pointsCalculated || 0} pt</span>
                      </div>
                      {receiptDetails.receipt.pointsAwarded !== null && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">{t("lr.awardedPoints")}</span>
                          <span className="font-medium text-green-600">{receiptDetails.receipt.pointsAwarded} pt</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">{t("lr.submittedAt")}</span>
                        <span className="font-medium">{formatDate(receiptDetails.receipt.submittedAt)}</span>
                      </div>
                      {receiptDetails.receipt.reviewedAt && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">{t("lr.reviewedAt")}</span>
                          <span className="font-medium">{formatDate(receiptDetails.receipt.reviewedAt)}</span>
                        </div>
                      )}
                      {receiptDetails.receipt.reviewNote && (
                        <div className="py-2 border-b">
                          <span className="text-muted-foreground block mb-1">{t("lr.reviewNote")}</span>
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
                        {t("lr.aiRejectedForceSubmit")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{t("lr.category")}:</span>
                          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-100">
                            {receiptDetails.receipt.aiRejectionCategory === 'not_tiktok' ? t("lr.notTiktok") :
                             receiptDetails.receipt.aiRejectionCategory === 'not_delivered' ? t("lr.notDelivered") :
                             receiptDetails.receipt.aiRejectionCategory === 'incomplete' ? t("lr.incompleteAmount") : t("lr.otherReason")}
                          </Badge>
                        </div>
                        {receiptDetails.receipt.aiRejectionReason && (
                          <div className="flex items-start gap-2">
                            <span className="text-muted-foreground flex-shrink-0">{t("lr.reason")}:</span>
                            <span className="font-medium text-amber-800">{receiptDetails.receipt.aiRejectionReason}</span>
                          </div>
                        )}
                        {receiptDetails.receipt.forceSubmittedAt && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{t("lr.forceSubmitDate")}:</span>
                            <span className="font-medium">{new Date(receiptDetails.receipt.forceSubmittedAt).toLocaleString("ja-JP")}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-amber-600 bg-amber-100 rounded p-1.5">
                        {t("lr.forceSubmitNote")}
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
                        {t("lr.fraudLog")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {receiptDetails.fraudLogs.map((log: any, i: number) => {
                        const checkTypeLabels: Record<string, string> = {
                          duplicate_image: t("lr.fraud.duplicateImage"),
                          duplicate_receipt: t("lr.fraud.duplicateReceipt"),
                          expired_receipt: t("lr.fraud.expired"),
                          high_frequency: t("lr.fraud.highFrequency"),
                          high_amount: t("lr.fraud.highAmount"),
                          suspicious_pattern: t("lr.fraud.suspicious"),
                          similar_order_number: t("lr.fraud.similar"),
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
                        {t("lr.approveWithCalc")}
                      </Button>
                    </div>
                    <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("lr.selectRejectionReason")} />
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
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("lr.sending")}</>
                      ) : (
                        <><XCircle className="w-4 h-4 mr-2" />{t("lr.rejectLine")}</>
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
              <AlertTriangle className="w-5 h-5 text-orange-600" /> {t("lr.holdReceipt")}
            </DialogTitle>
            <DialogDescription>
              {t("lr.holdDescription")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>{t("lr.detailReason")}</Label>
              <Textarea 
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={t("lr.enterDetailReason")}
                required
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              {t("lr.cancel")}
            </Button>
            <Button 
              onClick={handleAction}
              disabled={!actionNote || holdMutation.isPending}
            >
              {holdMutation.isPending ? t("lr.processing") : t("lr.setHold")}
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
              {t("lr.manualOrderNumber")}
            </DialogTitle>
            <DialogDescription>
              {t("lr.manualOrderNumberDesc")}
            </DialogDescription>
          </DialogHeader>
          
          {orderNumberDialog?.images && orderNumberDialog.images.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("lr.receiptImageClickToEnlarge")}</Label>
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
            <Label htmlFor="orderNumber">{t("lr.orderNumber")}</Label>
            <Input
              id="orderNumber"
              value={orderNumberInput}
              onChange={(e) => setOrderNumberInput(e.target.value)}
              placeholder={t("lr.orderNumberExample")}
              className="font-mono text-lg"
            />
            {orderNumberDialog?.currentOrderNumber && (
              <p className="text-xs text-muted-foreground">{t("lr.currentOrderNumber")}: {orderNumberDialog.currentOrderNumber}</p>
            )}
          </div>
          
          {updateOrderNumberMutation.isError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {updateOrderNumberMutation.error?.message || t("lr.errorOccurred")}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOrderNumberDialog(null); setOrderNumberInput(""); }}>
              {t("lr.cancel")}
            </Button>
            <Button 
              onClick={handleOrderNumberSave}
              disabled={!orderNumberInput.trim() || updateOrderNumberMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateOrderNumberMutation.isPending ? t("lr.saving") : t("lr.saveOrderNumber")}
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
              {t("lr.keyboardShortcuts")}
            </DialogTitle>
            <DialogDescription>
              {t("lr.shortcutDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {/* Navigation */}
            <div className="px-3 py-2 bg-muted/50 rounded-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("lr.navigation")}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("lr.shortcut.nextReceipt")}</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">↓</kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">J</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("lr.shortcut.prevReceipt")}</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">↑</kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">K</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("lr.shortcut.deselect")}</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">Esc</kbd>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="px-3 py-2 bg-muted/50 rounded-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("lr.actions")}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    {t("lr.approve")}
                  </span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">Enter</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    {t("lr.reject")}
                  </span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">R</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    {t("lr.setHold")}
                  </span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">H</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    {t("lr.openDetail")}
                  </span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">D</kbd>
                </div>
              </div>
            </div>
            
            {/* Other */}
            <div className="px-3 py-2 bg-muted/50 rounded-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("lr.other")}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm">{t("lr.showHelp")}</span>
                <kbd className="px-2 py-1 text-xs font-mono bg-background rounded border shadow-sm">?</kbd>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center pt-2">
              {t("lr.shortcutDisabledNote")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
      {/* AI Pass 2 Confirm Dialog */}
      <Dialog open={pass2ConfirmOpen} onOpenChange={setPass2ConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              {t("lr.pass2.confirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("lr.pass2.confirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                {t("lr.pass2.confirm").replace("{count}", String(stats?.onHold || 0))}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-red-50 rounded-lg p-2">
                <ShieldX className="w-4 h-4 text-red-500 mx-auto mb-1" />
                <p className="font-medium text-red-700">{t("lr.pass2.autoRejected")}</p>
                <p className="text-red-500">重複チェック</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <ShieldCheck className="w-4 h-4 text-green-500 mx-auto mb-1" />
                <p className="font-medium text-green-700">{t("lr.pass2.autoApproved")}</p>
                <p className="text-green-500">conf≥95%</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-2">
                <ShieldAlert className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                <p className="font-medium text-orange-700">{t("lr.pass2.keptManual")}</p>
                <p className="text-orange-500">その他</p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPass2ConfirmOpen(false)}>
              {t("lr.abort")}
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
              disabled={startPass2Mutation.isPending}
              onClick={() => {
                setPass2ConfirmOpen(false);
                startPass2Mutation.mutate({});
              }}
            >
              {startPass2Mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {t("lr.pass2.button")}{t("lr.execute")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== AI審査ログパネル =====
function AiReviewLogPanel() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<string>("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(undefined);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [collapsedComments, setCollapsedComments] = useState<Set<number>>(new Set());
  const [expandedImages, setExpandedImages] = useState<Map<number, number>>(new Map());
  const [reRecognizingIds, setReRecognizingIds] = useState<Set<number>>(new Set());
  const utils = trpc.useUtils();
  
  // AI re-recognize mutation
  const reRecognizeMutation = trpc.aiReview.reRecognize.useMutation({
    onSuccess: (data, variables) => {
      const results: string[] = [];
      if (data.orderNumber) results.push(`注文番号: ${data.orderNumber}`);
      if (data.totalAmount) results.push(`金額: ¥${data.totalAmount.toLocaleString()}`);
      if (data.shopName) results.push(`店舗: ${data.shopName}`);
      if (data.productName) results.push(`商品: ${data.productName}`);
      if (results.length > 0) {
        toast.success(`AI再認識完了\n${results.join(" / ")}`, { duration: 5000 });
      } else {
        toast.error("AI再認識: 情報を取得できませんでした");
      }
      setReRecognizingIds(prev => { const next = new Set(prev); next.delete(variables.logId); return next; });
      utils.aiReview.getLogs.invalidate();
    },
    onError: (err, variables) => {
      toast.error(`AI再認識エラー: ${err.message}`);
      setReRecognizingIds(prev => { const next = new Set(prev); next.delete(variables.logId); return next; });
    },
  });
  
  // Fetch batches
  const { data: batches, isLoading: batchesLoading } = trpc.aiReview.getBatches.useQuery({ limit: 20 });
  
  // Fetch learning stats
  const { data: learningStats } = trpc.aiReview.learningStats.useQuery();
  
  // Fetch stats for filter counts
  const { data: statsData } = trpc.aiReview.getStats.useQuery();
  
  // Fetch logs with filter
  const logsInput = useMemo(() => {
    const params: any = { isDryRun: false, limit: 100 };
    if (selectedBatchId) params.batchId = selectedBatchId;
    // 人間オーバーライドフィルター
    if (filter === "human_approved") {
      params.humanOverride = "approved";
    } else if (filter === "human_rejected") {
      params.humanOverride = "rejected";
    } else if (filter === "pending_manual") {
      params.humanOverride = null; // 未処理のみ
      params.excludeAiApproved = true; // AI承認済みを除外
    } else if (filter !== "all") {
      params.aiDecision = filter;
    }
    return params;
  }, [filter, selectedBatchId]);
  
  const { data: logs, isLoading: logsLoading } = trpc.aiReview.getLogs.useQuery(logsInput);
  
  // Override mutation
  const overrideMutation = trpc.aiReview.overrideDecision.useMutation({
    onSuccess: (data) => {
      toast.success(`${t("lr.aiLog.overrideSuccess")}: ${data.humanOverride === "approved" ? t("lr.approve") : t("lr.reject")}`);
      utils.aiReview.getLogs.invalidate().then(() => {
        // 承認/却下後に次の未処理レシートに自動スクロール
        setTimeout(() => {
          const nextPending = document.querySelector('[data-pending-review="true"]');
          if (nextPending) {
            nextPending.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      });
      utils.aiReview.getStats.invalidate();
      utils.aiReview.learningStats.invalidate();
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
    },
    onError: (err) => {
      toast.error(`${t("lr.aiLog.overrideError")}: ${err.message}`);
    },
  });
  
  const toggleComment = (id: number) => {
    setCollapsedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  // Decision config for consistent styling
  const decisionConfig: Record<string, { label: string; icon: any; bg: string; text: string; border: string; ringColor: string }> = {
    approved: { label: t("lr.aiLog.aiApproved"), icon: ShieldCheck, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", ringColor: "ring-emerald-400" },
    rejected_duplicate: { label: t("lr.aiLog.duplicateRejected"), icon: ShieldX, bg: "bg-red-50", text: "text-red-700", border: "border-red-200", ringColor: "ring-red-400" },
    rejected_ai: { label: t("lr.aiLog.aiRejected"), icon: ShieldX, bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", ringColor: "ring-rose-400" },
    held: { label: t("lr.aiLog.aiHeld"), icon: ShieldAlert, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", ringColor: "ring-amber-400" },
    skipped: { label: t("lr.aiLog.skipped"), icon: SkipForward, bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", ringColor: "ring-gray-400" },
  };
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return { bg: "bg-emerald-500", text: "text-emerald-700" };
    if (confidence >= 80) return { bg: "bg-green-500", text: "text-green-700" };
    if (confidence >= 60) return { bg: "bg-amber-500", text: "text-amber-700" };
    return { bg: "bg-red-500", text: "text-red-700" };
  };
  
  // Summary counts from stats API (not filtered by current view)
  const summaryCounts = useMemo(() => {
    if (!statsData) return { approved: 0, rejected: 0, rejectedAi: 0, held: 0, skipped: 0, total: 0, humanApproved: 0, humanRejected: 0, pendingManual: 0 };
    const byAi = statsData.byAiDecision || [];
    const getCount = (decision: string) => (byAi.find((s: any) => s.aiDecision === decision)?.count ?? 0);
    const total = byAi.reduce((sum: number, s: any) => sum + (s.count ?? 0), 0);
    const humanApproved = (statsData.byHumanOverride || []).find((s: any) => s.humanOverride === "approved")?.count ?? 0;
    const humanRejected = (statsData.byHumanOverride || []).find((s: any) => s.humanOverride === "rejected")?.count ?? 0;
    return {
      approved: getCount("approved"),
      rejected: getCount("rejected_duplicate"),
      rejectedAi: getCount("rejected_ai"),
      held: getCount("held"),
      skipped: getCount("skipped"),
      total,
      humanApproved,
      humanRejected,
      pendingManual: statsData.pendingManualReviewCount ?? 0,
    };
  }, [statsData]);
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-200">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{t("lr.aiReviewLog")}</h3>
            <p className="text-xs text-muted-foreground">{t("lr.aiLog.description")}</p>
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
          {t("lr.aiLog.refresh")}
        </Button>
      </div>
      
      {/* Summary Stats */}
      {logs && logs.length > 0 && (
        <div className="grid grid-cols-6 gap-2">
          <div className="rounded-lg border bg-card p-2.5 text-center">
            <p className="text-lg font-bold">{summaryCounts.total}</p>
            <p className="text-[10px] text-muted-foreground">{t("lr.aiLog.total")}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-emerald-700">{summaryCounts.approved}</p>
            <p className="text-[10px] text-emerald-600">{t("lr.aiLog.aiApproved")}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-red-700">{summaryCounts.rejected}</p>
            <p className="text-[10px] text-red-600">{t("lr.aiLog.duplicateRejected")}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-rose-700">{summaryCounts.rejectedAi}</p>
            <p className="text-[10px] text-rose-600">{t("lr.aiLog.aiRejected")}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-amber-700">{summaryCounts.held}</p>
            <p className="text-[10px] text-amber-600">{t("lr.aiLog.aiHeld")}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-center">
            <p className="text-lg font-bold text-gray-600">{summaryCounts.skipped}</p>
            <p className="text-[10px] text-gray-500">{t("lr.aiLog.skipped")}</p>
          </div>
        </div>
      )}
      
      {/* AI Learning Gamification Card */}
      {learningStats && (() => {
        const totalExamples = learningStats.totalExamples as number;
        // Level system: each level requires more examples
        const levels = [
          { level: 1, name: "見習い", minExamples: 0, icon: "🌱", color: "from-gray-400 to-gray-500", bgColor: "bg-gray-50", borderColor: "border-gray-200", textColor: "text-gray-700" },
          { level: 2, name: "初級", minExamples: 10, icon: "🧠", color: "from-blue-400 to-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200", textColor: "text-blue-700" },
          { level: 3, name: "中級", minExamples: 25, icon: "⚡", color: "from-purple-400 to-purple-600", bgColor: "bg-purple-50", borderColor: "border-purple-200", textColor: "text-purple-700" },
          { level: 4, name: "上級", minExamples: 50, icon: "🔥", color: "from-orange-400 to-red-500", bgColor: "bg-orange-50", borderColor: "border-orange-200", textColor: "text-orange-700" },
          { level: 5, name: "エキスパート", minExamples: 100, icon: "👑", color: "from-yellow-400 to-amber-500", bgColor: "bg-amber-50", borderColor: "border-amber-200", textColor: "text-amber-700" },
          { level: 6, name: "マスター", minExamples: 200, icon: "💎", color: "from-cyan-400 to-teal-500", bgColor: "bg-teal-50", borderColor: "border-teal-200", textColor: "text-teal-700" },
        ];
        const currentLevel = [...levels].reverse().find(l => totalExamples >= l.minExamples) || levels[0];
        const nextLevel = levels.find(l => l.minExamples > totalExamples);
        const prevThreshold = currentLevel.minExamples;
        const nextThreshold = nextLevel ? nextLevel.minExamples : currentLevel.minExamples;
        const progressInLevel = nextLevel ? ((totalExamples - prevThreshold) / (nextThreshold - prevThreshold)) * 100 : 100;
        const remaining = nextLevel ? nextThreshold - totalExamples : 0;
        
        // Today's count from byErrorType breakdown
        const todayCount = (learningStats.byErrorType as any[])?.reduce((sum: number, c: any) => sum + (c.count ?? 0), 0) ?? totalExamples;
        
        return (
          <div className={`rounded-xl border-2 ${currentLevel.borderColor} ${currentLevel.bgColor} p-4 transition-all duration-500`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{currentLevel.icon}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-bold ${currentLevel.textColor}`}>AI学習 Lv.{currentLevel.level}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${currentLevel.borderColor} ${currentLevel.textColor}`}>
                      {currentLevel.name}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">学習データ {totalExamples}件 蓄積済み</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-sm font-bold text-emerald-600">{todayCount}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">累計修正</p>
              </div>
            </div>
            
            {/* Progress Bar */}
            {nextLevel ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    次のレベルまで あと <span className="font-bold text-foreground">{remaining}件</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {nextLevel.icon} Lv.{nextLevel.level} {nextLevel.name}
                  </span>
                </div>
                <div className="h-3 bg-white/80 rounded-full overflow-hidden border">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${currentLevel.color} transition-all duration-1000 ease-out relative`}
                    style={{ width: `${Math.max(progressInLevel, 3)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>{prevThreshold}</span>
                  <span>{Math.round(progressInLevel)}%</span>
                  <span>{nextThreshold}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-1">
                <span className="text-xs font-bold text-amber-600">🏆 最高レベル達成！</span>
              </div>
            )}
            
            {/* Milestone badges */}
            <div className="flex gap-1.5 mt-3 justify-center">
              {[10, 25, 50, 100, 200].map((milestone) => (
                <div
                  key={milestone}
                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                    totalExamples >= milestone
                      ? "bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-300 text-amber-700 shadow-sm"
                      : "bg-gray-100/50 border-gray-200 text-gray-400"
                  }`}
                >
                  {totalExamples >= milestone ? (
                    <Trophy className="w-3 h-3" />
                  ) : (
                    <Target className="w-3 h-3" />
                  )}
                  {milestone}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      
      {/* Batch History */}
      {batches && batches.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("lr.aiLog.batchHistory")}</p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={!selectedBatchId ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 rounded-full"
                onClick={() => setSelectedBatchId(undefined)}
              >
                {t("lr.aiLog.all")}
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
        <span className="text-xs font-medium text-muted-foreground mr-1">{t("lr.aiLog.filter")}:</span>
        {[
          { value: "all", label: t("lr.aiLog.all"), icon: List, count: summaryCounts.total },
          { value: "approved", label: t("lr.aiLog.aiApproved"), icon: ShieldCheck, count: summaryCounts.approved },
          { value: "rejected_duplicate", label: t("lr.aiLog.duplicateRejected"), icon: ShieldX, count: summaryCounts.rejected },
          { value: "rejected_ai", label: t("lr.aiLog.aiRejected"), icon: ShieldX, count: summaryCounts.rejectedAi },
          { value: "held", label: t("lr.aiLog.aiHeld"), icon: ShieldAlert, count: summaryCounts.held },
          { value: "skipped", label: t("lr.aiLog.skipped"), icon: SkipForward, count: summaryCounts.skipped },
          { value: "pending_manual", label: "手動審査へ", icon: SkipForward, count: summaryCounts.pendingManual, highlight: true },
          { value: "human_approved", label: "人間承認", icon: UserCheck, count: summaryCounts.humanApproved },
          { value: "human_rejected", label: "人間却下", icon: UserX, count: summaryCounts.humanRejected },
        ].map(({ value, label, icon: Icon, count, highlight }: any) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            size="sm"
            className={`text-xs h-7 rounded-full ${highlight && filter !== value ? 'border-blue-400 text-blue-600 font-semibold' : ''}`}
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
          {t("lr.loading")}
        </div>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t("lr.aiLog.noLogs")}</p>
            <p className="text-xs mt-1">{t("lr.aiLog.noLogsHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {logs.map((log: any) => {
            const config = decisionConfig[log.aiDecision] || decisionConfig.skipped;
            const DecisionIcon = config.icon;
            // AIコメントはデフォルト展開（collapsedCommentsに含まれていなければ展開）
            const isExpanded = !collapsedComments.has(log.id);
            // Image index tracked in expandedImages Map
            const isReRecognizing = reRecognizingIds.has(log.id);
            const confidenceColor = log.aiConfidence ? getConfidenceColor(log.aiConfidence) : null;
            const points = log.receiptPointsAwarded ?? log.receiptPointsCalculated ?? 0;
            let ocrProductName: string | null = null;
            try {
              const raw = log.receiptOcrRawText;
              if (raw) {
                const ocr = typeof raw === "string" ? JSON.parse(raw) : raw;
                ocrProductName = ocr.items?.[0]?.productName || ocr.productName || null;
              }
            } catch {}
            const allImages: string[] = log.receiptImageUrls ? (log.receiptImageUrls as string[]) : (log.imageUrl ? [log.imageUrl] : []);
            const imageCount = allImages.length;
            const cardBorder = log.aiDecision === "approved" 
              ? "border-l-4 border-l-green-500" 
              : log.aiDecision === "rejected_duplicate" || log.aiDecision === "rejected_ai"
                ? "border-l-4 border-l-red-400"
                : log.aiDecision === "held"
                  ? "border-l-4 border-l-amber-400"
                  : "border-l-4 border-l-gray-300";
            const cardBg = log.humanOverride === "approved"
              ? "bg-blue-50/30"
              : log.humanOverride === "rejected"
                ? "bg-red-50/20"
                : "";
            
            return (
              <Card 
                key={log.id}
                data-pending-review={!log.humanOverride ? "true" : "false"}
                className={`hover:shadow-md transition-all overflow-hidden ${cardBorder} ${cardBg}`}
              >
                <CardContent className="p-3">
                  {/* Top section: Info */}
                  <div className="space-y-2">
                    {/* Row 1: User + Decision Badge + Confidence + Human Override */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm truncate max-w-[140px]">{log.userName || t("lr.unknown")}</span>
                      <Badge variant="outline" className={`${config.bg} ${config.text} ${config.border} text-xs px-1.5 py-0 h-5`}>
                        <DecisionIcon className="w-3 h-3 mr-0.5" />
                        {config.label}
                      </Badge>
                      {log.aiConfidence != null && confidenceColor && (
                        <Badge variant="outline" className={`${confidenceColor.text} text-xs px-1.5 py-0 h-5 border-current/30`}>
                          <Bot className="w-3 h-3 mr-0.5" />
                          {log.aiConfidence}%
                        </Badge>
                      )}
                      {log.humanOverride && (
                        <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 ${log.humanOverride === "approved" ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-pink-100 text-pink-700 border-pink-300"}`}>
                          {log.humanOverride === "approved" ? <ThumbsUp className="w-3 h-3 mr-0.5" /> : <ThumbsDown className="w-3 h-3 mr-0.5" />}
                          {log.humanOverride === "approved" ? t("lr.aiLog.humanApproved") : t("lr.aiLog.humanRejected")}
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-xs ml-auto flex-shrink-0">
                        {log.receiptPurchaseDate 
                          ? new Date(log.receiptPurchaseDate).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })
                          : new Date(log.createdAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })
                        }
                      </span>
                    </div>
                    
                    {/* Row 2: Amount + Points (awarded & calculated) */}
                    <div className="flex items-center gap-3 text-sm">
                      {log.totalAmount != null ? (
                        <>
                          <span className="font-bold text-base">{"\u00A5"}{Number(log.totalAmount).toLocaleString()}</span>
                          <span className="text-muted-foreground">→</span>
                          {log.aiDecision === "approved" && log.receiptPointsAwarded != null ? (
                            <span className="font-bold text-green-600 text-base">{log.receiptPointsAwarded}pt</span>
                          ) : log.receiptPointsCalculated != null && log.receiptPointsCalculated > 0 ? (
                            <span className="text-blue-600 font-semibold">
                              <span className="text-xs text-muted-foreground mr-0.5">予定</span>{log.receiptPointsCalculated}pt
                            </span>
                          ) : (
                            <span className="text-blue-600 font-semibold">{points}pt</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">-</span>
                          <span className="text-muted-foreground">→</span>
                          {log.receiptPointsCalculated != null && log.receiptPointsCalculated > 0 ? (
                            <span className="text-blue-600 font-semibold">
                              <span className="text-xs text-muted-foreground mr-0.5">予定</span>{log.receiptPointsCalculated}pt
                            </span>
                          ) : (
                            <span className="text-blue-600 font-semibold">{points}pt</span>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                        {ocrProductName && (
                          <span className="truncate max-w-[150px]" title={ocrProductName}>
                            📦 {ocrProductName}
                          </span>
                        )}
                        <span className="truncate max-w-[120px]">{log.storeName || t("lr.storeUnknown")}</span>
                      </div>
                    </div>
                    
                    {/* Row 2.5: Order Number */}
                    {log.orderNumber && (
                      <div className="flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-blue-600 font-mono text-xs">{log.orderNumber}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Image Gallery - Center panel style with arrows, pagination & thumbnails */}
                  {allImages.length > 0 && (() => {
                    const currentIdx = expandedImages.get(log.id) ?? 0;
                    return (
                      <div className="mt-2">
                        {/* Pagination header */}
                        {allImages.length > 1 && (
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              <Images className="w-3.5 h-3.5 text-blue-600" />
                              <span className="text-xs text-muted-foreground">{t("lr.receiptImages")}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">{currentIdx + 1} / {allImages.length}</Badge>
                          </div>
                        )}
                        {/* Main image */}
                        <div className="relative bg-gray-50 rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
                          <img 
                            src={allImages[currentIdx] || allImages[0]} 
                            alt={`\u30ec\u30b7\u30fc\u30c8\u753b\u50cf ${currentIdx + 1}`}
                            className="w-full h-auto max-h-[50vh] object-contain mx-auto cursor-pointer"
                            loading="lazy"
                            onClick={() => {
                              window.open(allImages[currentIdx] || allImages[0], '_blank');
                            }}
                          />
                          {allImages.length > 1 && (
                            <>
                              <button
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors shadow-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedImages(prev => {
                                    const next = new Map(prev);
                                    const cur = next.get(log.id) || 0;
                                    next.set(log.id, cur > 0 ? cur - 1 : allImages.length - 1);
                                    return next;
                                  });
                                }}
                              >
                                <ChevronLeft className="w-5 h-5" />
                              </button>
                              <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors shadow-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedImages(prev => {
                                    const next = new Map(prev);
                                    const cur = next.get(log.id) || 0;
                                    next.set(log.id, cur < allImages.length - 1 ? cur + 1 : 0);
                                    return next;
                                  });
                                }}
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                        {/* Thumbnail strip */}
                        {allImages.length > 1 && (
                          <div className="flex gap-2 mt-2 justify-center">
                            {allImages.map((url, idx) => (
                              <button
                                key={idx}
                                className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                  idx === currentIdx ? "border-blue-500 shadow-md scale-105" : "border-transparent opacity-60 hover:opacity-100"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedImages(prev => {
                                    const next = new Map(prev);
                                    next.set(log.id, idx);
                                    return next;
                                  });
                                }}
                              >
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Action buttons row */}
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                    {/* AI Re-recognize button */}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                      disabled={isReRecognizing}
                      onClick={() => {
                        setReRecognizingIds(prev => new Set(prev).add(log.id));
                        reRecognizeMutation.mutate({ logId: log.id });
                      }}
                    >
                      {isReRecognizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                      AI再認識
                    </Button>
                    
                    {/* Override buttons - 承認と却下の両方を表示 */}
                    {!log.humanOverride && (
                      <>
                        <Button 
                          size="sm" 
                          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" 
                          onClick={() => { const c = prompt(t("lr.aiLog.approveComment")); overrideMutation.mutate({ logId: log.id, humanOverride: "approved", humanComment: c || undefined }); }} 
                          disabled={overrideMutation.isPending}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {t("lr.approve")}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50" 
                          onClick={() => { const c = prompt(t("lr.aiLog.rejectReason")); if (c) overrideMutation.mutate({ logId: log.id, humanOverride: "rejected", humanComment: c }); }} 
                          disabled={overrideMutation.isPending}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          {t("lr.reject")}
                        </Button>
                      </>
                    )}
                    
                    {/* Comment toggle */}
                    {(log.aiComment || log.humanComment) && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className={`h-7 text-xs gap-1 ml-auto ${isExpanded ? config.text : ''}`}
                        onClick={() => toggleComment(log.id)}
                      >
                        <Bot className="w-3.5 h-3.5" />
                        AIコメント
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                  
                  {/* AI Comment - expandable below card */}
                  {isExpanded && (log.aiComment || log.humanComment) && (
                    <div className={`text-xs leading-relaxed rounded-lg px-3 py-2 mt-2 ${config.bg} ${config.border} border`}>
                      {log.aiComment && <span className={`${config.text} block`}>{log.aiComment}</span>}
                      {log.humanComment && <span className="text-blue-700 block mt-1">💬 {log.humanComment}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
