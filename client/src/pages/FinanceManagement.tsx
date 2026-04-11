import React, { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import TspContractTab from "./TspContractTab";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload, DollarSign, Package, Users, ShoppingCart,
  TrendingUp, TrendingDown, FileText, Trash2, Search,
  ChevronLeft, ChevronRight, ChevronDown, BarChart3, Calendar, Download,
  Loader2, Eye, RefreshCw, Store, Video, ShoppingBag,
  AlertTriangle, CheckCircle, Clock, Wallet, Building2,
  ArrowUpRight, ArrowDownRight, Crown, Medal, Award, CalendarDays,
  Target, Zap, Activity, Percent, GitBranch, Lock, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle
} from "lucide-react";

function formatCurrency(val: number | string | null | undefined): string {
  const num = typeof val === 'string' ? parseFloat(val) : (val || 0);
  return `¥${Math.round(num).toLocaleString()}`;
}
function formatNumber(val: number | string | null | undefined): string {
  const num = typeof val === 'string' ? parseFloat(val) : (val || 0);
  return Math.round(num).toLocaleString();
}
function formatPercent(val: number | string | null | undefined): string {
  const num = typeof val === 'string' ? parseFloat(val) : (val || 0);
  return `${num.toFixed(1)}%`;
}
function getChangePercent(current: number, previous: number): { value: number; isUp: boolean } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, isUp: current > 0 };
  const change = ((current - previous) / previous) * 100;
  return { value: Math.abs(change), isUp: change >= 0 };
}
function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ value, label });
  }
  return options;
}
function getPrevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type TabType = 'dashboard' | 'creators' | 'shops' | 'products' | 'daily' | 'monthly' | 'orders' | 'imports' | 'payments' | 'tap' | 'tap-creators' | 'tap-shops' | 'tap-products' | 'tap-live' | 'tap-videos' | 'tap-profitability' | 'tap-bestmatch' | 'tap-shop-analysis' | 'tap-live-efficiency' | 'tap-growth' | 'tap-creator-profit' | 'tsp';

export default function FinanceManagement() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('tap');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [csvUploading, setCsvUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteImportId, setDeleteImportId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orderPage, setOrderPage] = useState(0);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderCreator, setOrderCreator] = useState("");
  const [orderShop, setOrderShop] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderContentType, setOrderContentType] = useState("");
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [paymentCsvUploading, setPaymentCsvUploading] = useState(false);
  const [paymentUploadDialogOpen, setPaymentUploadDialogOpen] = useState(false);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
  const [deletePaymentDialogOpen, setDeletePaymentDialogOpen] = useState(false);
  const [smartUploadDialogOpen, setSmartUploadDialogOpen] = useState(false);
  const [smartUploading, setSmartUploading] = useState(false);
  const smartFileInputRef = useRef<HTMLInputElement>(null);
  const [tapMonth, setTapMonth] = useState<string>('');
  const tapFileInputRef = useRef<HTMLInputElement>(null);
  const [tapUploading, setTapUploading] = useState(false);
  const [tapUploadDialogOpen, setTapUploadDialogOpen] = useState(false);
  const [tapUploadMonth, setTapUploadMonth] = useState<string>('');
  const [deleteTapMonthDialog, setDeleteTapMonthDialog] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0); // 0=initial, 1=password entered, 2=first confirm clicked
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedMonthTab, setExpandedMonthTab] = useState<'overview' | 'creators' | 'shops' | 'products'>('overview');
  const [expandedCreator, setExpandedCreator] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [drilldownSort, setDrilldownSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'lcjFee', dir: 'desc' });
  const [prodDrilldownSort, setProdDrilldownSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'lcjFee', dir: 'desc' });
  const [capTapHelpOpen, setCapTapHelpOpen] = useState(false);
  const [productTableSort, setProductTableSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'brandFee', dir: 'desc' });
  const [creatorTableSort, setCreatorTableSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'netProfit', dir: 'desc' });
  const pageSize = 50;

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const prevMonth = selectedMonth ? getPrevMonth(selectedMonth) : undefined;

  // Queries - all cross-brand (brandId=0)
  const summaryQuery = trpc.tiktokFinance.getSummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: true }
  );
  const prevSummaryQuery = trpc.tiktokFinance.getSummary.useQuery(
    { brandId: 0, month: prevMonth },
    { enabled: !!prevMonth }
  );
  const monthlyQuery = trpc.tiktokFinance.getMonthlySummary.useQuery(
    { brandId: 0 },
    { enabled: activeTab === 'dashboard' || activeTab === 'monthly' }
  );
  const creatorsQuery = trpc.tiktokFinance.getCreatorSummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: activeTab === 'dashboard' || activeTab === 'creators' }
  );
  const shopsQuery = trpc.tiktokFinance.getShopSummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: activeTab === 'dashboard' || activeTab === 'shops' }
  );
  const productsQuery = trpc.tiktokFinance.getProductSummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: activeTab === 'products' }
  );
  const productBreakdownQuery = trpc.tiktokFinance.getProductCreatorBreakdown.useQuery(
    { productName: selectedProductName || '', brandId: 0, month: selectedMonth || undefined },
    { enabled: !!selectedProductName && activeTab === 'products' }
  );
  const dailyQuery = trpc.tiktokFinance.getDailySummary.useQuery(
    { brandId: 0, month: selectedMonth || undefined },
    { enabled: activeTab === 'daily' }
  );
  const ordersQuery = trpc.tiktokFinance.getOrders.useQuery(
    {
      brandId: 0,
      limit: pageSize,
      offset: orderPage * pageSize,
      search: orderSearch || undefined,
      creatorUsername: orderCreator || undefined,
      shopName: orderShop || undefined,
      orderStatus: orderStatus || undefined,
      contentType: orderContentType || undefined,
    },
    { enabled: activeTab === 'orders' }
  );
  const importsQuery = trpc.tiktokFinance.getImportHistory.useQuery(
    { brandId: 0 },
    { enabled: activeTab === 'imports' }
  );
  const paymentSummaryQuery = trpc.tiktokFinance.getPaymentSummary.useQuery(
    { brandId: 0 },
    { enabled: true }
  );
  const paymentsByMonthQuery = trpc.tiktokFinance.getPaymentsByMonth.useQuery(
    { brandId: 0 },
    { enabled: activeTab === 'monthly' || activeTab === 'dashboard' || activeTab === 'payments' }
  );
  const paymentsListQuery = trpc.tiktokFinance.getPaymentsList.useQuery(
    { brandId: 0 },
    { enabled: activeTab === 'imports' }
  );

  // TAP Queries
  const tapSummaryQuery = trpc.tiktokFinance.getTapSummary.useQuery(
    { brandId: 0, month: tapMonth || undefined },
    { enabled: activeTab === 'tap' || activeTab === 'dashboard' || activeTab.startsWith('tap-') }
  );
  const tapCreatorsQuery = trpc.tiktokFinance.getTapCreatorSummary.useQuery(
    { brandId: 0, month: (activeTab === 'creators' ? selectedMonth : tapMonth) || undefined },
    { enabled: activeTab === 'tap' || activeTab === 'tap-creators' || activeTab === 'dashboard' || activeTab === 'creators' }
  );
  const tapShopsQuery = trpc.tiktokFinance.getTapShopSummary.useQuery(
    { brandId: 0, month: (activeTab === 'shops' ? selectedMonth : tapMonth) || undefined },
    { enabled: activeTab === 'tap' || activeTab === 'tap-shops' || activeTab === 'dashboard' || activeTab === 'shops' || activeTab === 'tap-shop-analysis' }
  );
  const tapProductsQuery = trpc.tiktokFinance.getTapProductSummary.useQuery(
    { brandId: 0, month: (activeTab === 'products' ? selectedMonth : tapMonth) || undefined },
    { enabled: activeTab === 'tap-products' || activeTab === 'products' || activeTab === 'tap-profitability' }
  );
  const tapMonthlyQuery = trpc.tiktokFinance.getTapMonthlySummary.useQuery(
    { brandId: 0 },
    { enabled: activeTab === 'tap' || activeTab === 'dashboard' || activeTab === 'tap-growth' }
  );
  const tapAvailableMonthsQuery = trpc.tiktokFinance.getTapAvailableMonths.useQuery(
    { brandId: 0 },
    { enabled: activeTab.startsWith('tap') || activeTab === 'dashboard' }
  );

  // Live/Video TAP Queries
  const tapLiveSummaryQuery = trpc.tiktokFinance.getTapLiveSummary.useQuery(
    { brandId: 0, month: tapMonth || undefined },
    { enabled: activeTab === 'tap-live' || activeTab === 'tap' }
  );
  const tapLiveCreatorsQuery = trpc.tiktokFinance.getTapLiveCreatorSummary.useQuery(
    { brandId: 0, month: tapMonth || undefined },
    { enabled: activeTab === 'tap-live' }
  );
  const tapLiveMonthlyQuery = trpc.tiktokFinance.getTapLiveMonthlySummary.useQuery(
    { brandId: 0 },
    { enabled: activeTab === 'tap-live' }
  );
  const tapLiveTopSessionsQuery = trpc.tiktokFinance.getTapLiveTopSessions.useQuery(
    { brandId: 0, month: tapMonth || undefined, limit: 50 },
    { enabled: activeTab === 'tap-live' }
  );
  const tapVideoSummaryQuery = trpc.tiktokFinance.getTapVideoSummary.useQuery(
    { brandId: 0, month: tapMonth || undefined },
    { enabled: activeTab === 'tap-videos' || activeTab === 'tap' }
  );
  const tapVideoCreatorsQuery = trpc.tiktokFinance.getTapVideoCreatorSummary.useQuery(
    { brandId: 0, month: tapMonth || undefined },
    { enabled: activeTab === 'tap-videos' }
  );
  const tapVideoMonthlyQuery = trpc.tiktokFinance.getTapVideoMonthlySummary.useQuery(
    { brandId: 0 },
    { enabled: activeTab === 'tap-videos' }
  );
  const tapVideoTopVideosQuery = trpc.tiktokFinance.getTapVideoTopVideos.useQuery(
    { brandId: 0, month: tapMonth || undefined, limit: 50 },
    { enabled: activeTab === 'tap-videos' }
  );

  // 司令塔 Queries
  const tapCreatorProductMatrixQuery = trpc.tiktokFinance.getTapCreatorProductMatrix.useQuery(
    { brandId: 0, month: tapMonth || undefined },
    { enabled: activeTab === 'tap-bestmatch' }
  );
  const tapLiveEfficiencyQuery = trpc.tiktokFinance.getTapLiveEfficiency.useQuery(
    { brandId: 0, month: tapMonth || undefined },
    { enabled: activeTab === 'tap-live-efficiency' }
  );

  // ライバー収益分析 Queries
  const tapCreatorProfitQuery = trpc.tiktokFinance.getTapCreatorProfitability.useQuery(
    { brandId: 0, month: tapMonth || undefined },
    { enabled: activeTab === 'tap-creator-profit' }
  );
  const tapCreatorProductBreakdownQuery = trpc.tiktokFinance.getTapCreatorProductBreakdown.useQuery(
    { creatorUsername: expandedCreator || '', brandId: 0, month: tapMonth || undefined },
    { enabled: !!expandedCreator && activeTab === 'tap-creator-profit' }
  );
  const tapProductCreatorBreakdownQuery = trpc.tiktokFinance.getTapProductCreatorBreakdown.useQuery(
    { productName: expandedProduct || '', brandId: 0, month: tapMonth || undefined },
    { enabled: !!expandedProduct && activeTab === 'tap-profitability' }
  );

  // Month detail inline expansion queries
  const monthDetailSummaryQuery = trpc.tiktokFinance.getTapSummary.useQuery(
    { brandId: 0, month: expandedMonth || undefined },
    { enabled: !!expandedMonth }
  );
  const monthDetailCreatorsQuery = trpc.tiktokFinance.getTapCreatorSummary.useQuery(
    { brandId: 0, month: expandedMonth || undefined },
    { enabled: !!expandedMonth }
  );
  const monthDetailShopsQuery = trpc.tiktokFinance.getTapShopSummary.useQuery(
    { brandId: 0, month: expandedMonth || undefined },
    { enabled: !!expandedMonth }
  );
  const monthDetailProductsQuery = trpc.tiktokFinance.getTapProductSummary.useQuery(
    { brandId: 0, month: expandedMonth || undefined },
    { enabled: !!expandedMonth }
  );
  const monthDetailLiveQuery = trpc.tiktokFinance.getTapLiveSummary.useQuery(
    { brandId: 0, month: expandedMonth || undefined },
    { enabled: !!expandedMonth }
  );
  const monthDetailVideoQuery = trpc.tiktokFinance.getTapVideoSummary.useQuery(
    { brandId: 0, month: expandedMonth || undefined },
    { enabled: !!expandedMonth }
  );

  const deleteMutation = trpc.tiktokFinance.deleteImport.useMutation({
    onSuccess: () => {
      toast.success("インポートデータを削除しました");
      setDeleteDialogOpen(false);
      setDeleteImportId(null);
      summaryQuery.refetch();
      importsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`削除に失敗: ${error.message}`);
    },
  });

  const uploadPaymentCsvMutation = trpc.tiktokFinance.uploadPaymentCsv.useMutation({
    onSuccess: (result) => {
      toast.success(`入金データ${result.importedRows}件インポート（${result.skippedRows}件スキップ）`);
      setPaymentUploadDialogOpen(false);
      setPaymentCsvUploading(false);
      paymentSummaryQuery.refetch();
      paymentsByMonthQuery.refetch();
      paymentsListQuery.refetch();
    },
    onError: (error) => {
      toast.error(`入金CSVアップロード失敗: ${error.message}`);
      setPaymentCsvUploading(false);
    },
  });

  const deletePaymentMutation = trpc.tiktokFinance.deletePayment.useMutation({
    onSuccess: () => {
      toast.success("入金データを削除しました");
      setDeletePaymentDialogOpen(false);
      setDeletePaymentId(null);
      paymentSummaryQuery.refetch();
      paymentsByMonthQuery.refetch();
      paymentsListQuery.refetch();
    },
    onError: (error) => {
      toast.error(`削除に失敗: ${error.message}`);
    },
  });

  // TAP mutations
  const uploadTapMutation = trpc.tiktokFinance.uploadTapXlsx.useMutation({
    onSuccess: (result) => {
      toast.success(`TAPデータ${result.importedRows}件インポート（${result.reportMonth}）`);
      setTapUploadDialogOpen(false);
      setTapUploading(false);
      tapSummaryQuery.refetch();
      tapCreatorsQuery.refetch();
      tapShopsQuery.refetch();
      tapMonthlyQuery.refetch();
      tapAvailableMonthsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`TAPアップロード失敗: ${error.message}`);
      setTapUploading(false);
    },
  });

  const deleteTapMonthMutation = trpc.tiktokFinance.deleteTapMonth.useMutation({
    onSuccess: () => {
      toast.success('TAPデータを削除しました');
      setDeleteTapMonthDialog(null);
      tapSummaryQuery.refetch();
      tapCreatorsQuery.refetch();
      tapShopsQuery.refetch();
      tapMonthlyQuery.refetch();
      tapAvailableMonthsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`削除に失敗: ${error.message}`);
    },
  });

  const handleTapXlsxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!tapUploadMonth) {
      toast.error('レポート月を選択してください');
      return;
    }
    setTapUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      uploadTapMutation.mutate({ brandId: 0, fileContent: base64, reportMonth: tapUploadMonth });
    } catch (err: any) {
      toast.error(`アップロード失敗: ${err.message}`);
      setTapUploading(false);
    } finally {
      if (tapFileInputRef.current) tapFileInputRef.current.value = '';
    }
  };

  const handlePaymentCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPaymentCsvUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      uploadPaymentCsvMutation.mutate({ brandId: 0, csvContent: base64 });
    } catch (err: any) {
      toast.error(`アップロード失敗: ${err.message}`);
      setPaymentCsvUploading(false);
    } finally {
      if (paymentFileInputRef.current) paymentFileInputRef.current.value = "";
    }
  };

  // Smart CSV upload - auto-detect CSV type by headers
  const handleSmartCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSmartUploading(true);
    try {
      const text = await file.text();
      const firstLine = text.split(/\r?\n/)[0] || '';
      
      // Check if it's an XLSX file (TAP data)
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // TAP XLSX detected - need month selection
        setSmartUploadDialogOpen(false);
        setSmartUploading(false);
        setTapUploadDialogOpen(true);
        // Store the file for later upload
        const dt = new DataTransfer();
        dt.items.add(file);
        if (tapFileInputRef.current) tapFileInputRef.current.files = dt.files;
        toast.info('TAPデータを検出しました。レポート月を選択してアップロードしてください。');
        return;
      }

      if (firstLine.includes('Reference ID') && firstLine.includes('Payment')) {
        // Payment CSV detected
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        uploadPaymentCsvMutation.mutate({ brandId: 0, csvContent: base64 });
        setSmartUploadDialogOpen(false);
      } else if (firstLine.includes('\u30b5\u30d6\u6ce8\u6587ID') || firstLine.includes('Sub Order ID')) {
        // CAP/Commission CSV detected
        const formData = new FormData();
        formData.append('file', file);
        formData.append('brandId', '1');
        const res = await fetch('/api/csv-upload', { method: 'POST', body: formData });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Upload failed');
        toast.success(`${result.importedRows}\u4ef6\u30a4\u30f3\u30dd\u30fc\u30c8\uff08${result.skippedRows}\u4ef6\u30b9\u30ad\u30c3\u30d7\uff09`);
        summaryQuery.refetch();
        importsQuery.refetch();
        setSmartUploadDialogOpen(false);
      } else {
        toast.error('CSV\u306e\u5f62\u5f0f\u3092\u5224\u5225\u3067\u304d\u307e\u305b\u3093\u3002TikTok\u30b3\u30df\u30c3\u30b7\u30e7\u30f3CSV\u307e\u305f\u306f\u5165\u91d1CSV\u3092\u30a2\u30c3\u30d7\u30ed\u30fc\u30c9\u3057\u3066\u304f\u3060\u3055\u3044\u3002');
      }
    } catch (err: any) {
      toast.error(`\u30a2\u30c3\u30d7\u30ed\u30fc\u30c9\u5931\u6557: ${err.message}`);
    } finally {
      setSmartUploading(false);
      if (smartFileInputRef.current) smartFileInputRef.current.value = '';
    }
  };

  const summary = summaryQuery.data;
  const prevSummary = prevSummaryQuery.data;
  const creators = creatorsQuery.data || [];
  const shops = shopsQuery.data || [];
  const monthly = monthlyQuery.data || [];

  // TAP-based dashboard data
  const tapSummary = tapSummaryQuery.data;
  const tapCreators = tapCreatorsQuery.data || [];
  const tapShops = tapShopsQuery.data || [];
  const tapMonthly = tapMonthlyQuery.data || [];

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("brandId", "1");
      const res = await fetch("/api/csv-upload", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Upload failed");
      toast.success(`${result.importedRows}件インポート（${result.skippedRows}件スキップ）`);
      summaryQuery.refetch();
      importsQuery.refetch();
      setUploadDialogOpen(false);
    } catch (err: any) {
      toast.error(`アップロード失敗: ${err.message}`);
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Change indicators
  const salesChange = summary && prevSummary
    ? getChangePercent(Number(summary.totalSales), Number(prevSummary.totalSales))
    : null;
  const commissionChange = summary && prevSummary
    ? getChangePercent(
        Number(summary.totalActPartnerCommission) + Number(summary.totalActCreatorCommission),
        Number(prevSummary.totalActPartnerCommission) + Number(prevSummary.totalActCreatorCommission)
      )
    : null;
  const ordersChange = summary && prevSummary
    ? getChangePercent(Number(summary.totalOrders), Number(prevSummary.totalOrders))
    : null;

  const rankIcons = [
    <Crown className="h-4 w-4 text-yellow-500" />,
    <Medal className="h-4 w-4 text-gray-400" />,
    <Award className="h-4 w-4 text-amber-600" />,
  ];

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'tap', label: 'TAP分析', icon: Video },
    { key: 'dashboard', label: 'ダッシュボード', icon: BarChart3 },
    // { key: 'creators', label: 'クリエイター', icon: Users },
    // { key: 'shops', label: 'ショップ', icon: Store },
    // { key: 'products', label: '商品', icon: ShoppingBag },
    { key: 'daily', label: '日別推移', icon: Calendar },
    // { key: 'monthly', label: '月推移', icon: TrendingUp },
    { key: 'orders', label: '注文明細', icon: ShoppingCart },
    { key: 'imports', label: 'インポート', icon: FileText },
    { key: 'payments', label: '入金月別', icon: Wallet },
    { key: 'tsp', label: 'TSP契約', icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            ファイナンス管理
          </h1>
          <p className="text-muted-foreground text-sm mt-1">全ブランド横断 TikTok成果報酬ダッシュボード</p>
          <button onClick={() => setCapTapHelpOpen(true)} className="flex items-center gap-1.5 mt-2 text-xs text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full">
            <HelpCircle className="h-3.5 w-3.5" />
            CAP / TAP 手数料の考え方
          </button>
        </div>
        <div className="flex items-center gap-3">
          {/* Month selector */}
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v === 'all' ? '' : v); setOrderPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="全期間" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全期間</SelectItem>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setSmartUploadDialogOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            データアップロード
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setOrderPage(0); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab - TAPベース */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {tapSummaryQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : tapSummary ? (
            <>
              {/* Main KPI Cards - TAPベース */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-violet-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          アフィリエイトGMV
                        </div>
                        <p className="text-2xl font-bold text-violet-600">{formatCurrency(tapSummary.totalAffiliateGmv)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>LIVE: {formatCurrency(tapSummary.totalLiveGmv)}</span>
                      <span>動画: {formatCurrency(tapSummary.totalVideoGmv)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          LCJ手数料（実績）
                        </div>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(tapSummary.totalActualPartnerCommission)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>見込: {formatCurrency(tapSummary.totalEstimatedPartnerCommission)}</span>
                      <span>C実績: {formatCurrency(tapSummary.totalActualCreatorCommission)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <ShoppingCart className="h-3.5 w-3.5" />
                          注文数 / 販売数
                        </div>
                        <p className="text-2xl font-bold">{formatNumber(tapSummary.totalOrders)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>販売数: {formatNumber(tapSummary.totalSalesCount)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Users className="h-3.5 w-3.5" />
                      アクティブ
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xl font-bold">{formatNumber(tapSummary.creatorCount)}</p>
                        <p className="text-xs text-muted-foreground">クリエイター</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div>
                        <p className="text-xl font-bold">{formatNumber(tapSummary.shopCount)}</p>
                        <p className="text-xs text-muted-foreground">ショップ</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div>
                        <p className="text-xl font-bold">{formatNumber(tapSummary.productCount)}</p>
                        <p className="text-xs text-muted-foreground">商品</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 追加KPI: 返金・決済済み・ショーケース・リンク・LIVE/動画パフォーマンス */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <Card>
                  <CardContent className="pt-3 pb-2">
                    <div className="text-muted-foreground text-xs mb-1">決済済みGMV</div>
                    <p className="text-lg font-semibold text-emerald-600">{formatCurrency(tapSummary.totalSettledGmv)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-2">
                    <div className="text-muted-foreground text-xs mb-1">返金GMV</div>
                    <p className="text-lg font-semibold text-red-500">{formatCurrency(tapSummary.totalGmvRefund)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-2">
                    <div className="text-muted-foreground text-xs mb-1">ショーケース収益</div>
                    <p className="text-lg font-semibold text-purple-600">{formatCurrency(tapSummary.totalShowcaseRevenue)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-2">
                    <div className="text-muted-foreground text-xs mb-1">リンクGMV</div>
                    <p className="text-lg font-semibold text-cyan-600">{formatCurrency(tapSummary.totalLinkGmv)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-2">
                    <div className="text-muted-foreground text-xs mb-1">LIVE視聴</div>
                    <p className="text-lg font-semibold">{formatNumber(tapSummary.totalLiveViews)}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(tapSummary.totalLiveCount)}回</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-2">
                    <div className="text-muted-foreground text-xs mb-1">動画視聴</div>
                    <p className="text-lg font-semibold">{formatNumber(tapSummary.totalVideoViews)}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(tapSummary.totalVideoCount)}本</p>
                  </CardContent>
                </Card>
              </div>

              {/* 入金・手数料率 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-indigo-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('payments')}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <Wallet className="h-3.5 w-3.5" />
                          入金額（実績）
                        </div>
                        <p className="text-xl font-bold text-indigo-600">
                          {paymentSummaryQuery.data ? formatCurrency(paymentSummaryQuery.data.totalPaymentAmount) : '未登録'}
                        </p>
                        {paymentSummaryQuery.data && (
                          <p className="text-xs text-muted-foreground mt-1">{paymentSummaryQuery.data.paymentCount}件の入金</p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-cyan-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Building2 className="h-3.5 w-3.5" />
                      C手数料（見込）
                    </div>
                    <p className="text-xl font-bold text-cyan-600">{formatCurrency(tapSummary.totalEstimatedCreatorCommission)}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-teal-500">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Users className="h-3.5 w-3.5" />
                      C手数料（実績）
                    </div>
                    <p className="text-xl font-bold text-teal-600">{formatCurrency(tapSummary.totalActualCreatorCommission)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Trend - TAPベース */}
              {tapMonthly.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        月別推移（TAP）
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab('tap')}>
                        詳細を見る <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 px-3">月</th>
                            <th className="text-right py-2 px-3">アフィリGMV</th>
                            <th className="text-right py-2 px-3">LIVE GMV</th>
                            <th className="text-right py-2 px-3">動画GMV</th>
                            <th className="text-right py-2 px-3">LCJ手数料</th>
                            <th className="text-right py-2 px-3">注文数</th>
                            <th className="text-right py-2 px-3">クリエイター</th>
                            <th className="text-right py-2 px-3">前月比</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tapMonthly.map((m: any, i: number) => {
                            const prev = i < tapMonthly.length - 1 ? tapMonthly[i + 1] : null;
                            const change = prev ? getChangePercent(Number(m.totalAffiliateGmv), Number(prev.totalAffiliateGmv)) : null;
                            return (
                              <tr key={m.reportMonth} className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${expandedMonth === m.reportMonth ? 'bg-violet-50 dark:bg-violet-950/30' : ''}`} onClick={() => { setExpandedMonth(expandedMonth === m.reportMonth ? null : m.reportMonth); setExpandedMonthTab('overview'); }}>
                                <td className="py-2 px-3 font-medium">{m.reportMonth}</td>
                                <td className="py-2 px-3 text-right font-semibold text-violet-600">{formatCurrency(m.totalAffiliateGmv)}</td>
                                <td className="py-2 px-3 text-right">{formatCurrency(m.totalLiveGmv)}</td>
                                <td className="py-2 px-3 text-right">{formatCurrency(m.totalVideoGmv)}</td>
                                <td className="py-2 px-3 text-right text-green-600">{formatCurrency(m.totalActualPartnerCommission)}</td>
                                <td className="py-2 px-3 text-right">{formatNumber(m.totalOrders)}</td>
                                <td className="py-2 px-3 text-right">{formatNumber(m.creatorCount)}</td>
                                <td className="py-2 px-3 text-right">
                                  {change ? (
                                    <span className={`flex items-center justify-end gap-1 ${change.isUp ? 'text-green-600' : 'text-red-500'}`}>
                                      {change.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                      {change.value.toFixed(1)}%
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rankings - TAPベース */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Creator Ranking */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        クリエイターGMVランキング
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab('tap-creators')}>
                        全て見る <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {tapCreators.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">データなし</p>
                    ) : (
                      <div className="space-y-2">
                        {tapCreators.slice(0, 10).map((c: any, i: number) => (
                          <div key={c.creatorUsername} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/50">
                            <div className="w-6 text-center">
                              {i < 3 ? rankIcons[i] : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{c.creatorUsername || '(不明)'}</p>
                              <p className="text-xs text-muted-foreground">{formatNumber(c.totalOrders)}件 / {formatNumber(c.shopCount)}ショップ</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm text-violet-600">{formatCurrency(c.totalAffiliateGmv)}</p>
                              <div className="flex gap-2 text-xs">
                                <span className="text-green-600">LCJ {formatCurrency(c.totalActualPartnerCommission)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Shop Ranking */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        ショップGMVランキング
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab('tap-shops')}>
                        全て見る <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {tapShops.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">データなし</p>
                    ) : (
                      <div className="space-y-2">
                        {tapShops.slice(0, 10).map((s: any, i: number) => (
                          <div key={s.shopName} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/50">
                            <div className="w-6 text-center">
                              {i < 3 ? rankIcons[i] : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{s.shopName || '(不明)'}</p>
                              <p className="text-xs text-muted-foreground">{formatNumber(s.totalOrders)}件 / {formatNumber(s.productCount)}商品</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm text-violet-600">{formatCurrency(s.totalAffiliateGmv)}</p>
                              <div className="flex gap-2 text-xs">
                                <span className="text-green-600">LCJ {formatCurrency(s.totalActualPartnerCommission)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>データがありません。CSVをアップロードしてください。</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Creators Tab */}
      {activeTab === 'creators' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              クリエイター別実績（TAP）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tapCreatorsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : tapCreators.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">クリエイター</th>
                      <th className="text-right py-2 px-3">アフィリGMV</th>
                      <th className="text-right py-2 px-3">LIVE GMV</th>
                      <th className="text-right py-2 px-3">動画GMV</th>
                      <th className="text-right py-2 px-3">LCJ手数料(見込)</th>
                      <th className="text-right py-2 px-3">LCJ手数料(実績)</th>
                      <th className="text-right py-2 px-3">C手数料(見込)</th>
                      <th className="text-right py-2 px-3">C手数料(実績)</th>
                      <th className="text-right py-2 px-3">返金GMV</th>
                      <th className="text-right py-2 px-3">決済済みGMV</th>
                      <th className="text-right py-2 px-3">ショーケース</th>
                      <th className="text-right py-2 px-3">注文数</th>
                      <th className="text-right py-2 px-3">販売数</th>
                      <th className="text-right py-2 px-3">商品数</th>
                      <th className="text-right py-2 px-3">ショップ数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tapCreators.map((c: any, i: number) => (
                      <tr key={c.creatorUsername} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 w-8">
                          {i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2 px-3 font-medium whitespace-nowrap">{c.creatorUsername || '(不明)'}</td>
                        <td className="py-2 px-3 text-right font-semibold text-red-600">{formatCurrency(c.totalAffiliateGmv)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(c.totalLiveGmv)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(c.totalVideoGmv)}</td>
                        <td className="py-2 px-3 text-right text-purple-600">{formatCurrency(c.totalEstimatedPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(c.totalActualPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(c.totalEstimatedCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(c.totalActualCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right text-rose-500">{formatCurrency(c.totalGmvRefund)}</td>
                        <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(c.totalSettledGmv)}</td>
                        <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(c.totalShowcaseRevenue)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.totalOrders)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.totalSalesCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.productCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.shopCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-2 px-3" colSpan={2}>合計</td>
                      <td className="py-2 px-3 text-right text-red-600">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalAffiliateGmv), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalLiveGmv), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalVideoGmv), 0))}</td>
                      <td className="py-2 px-3 text-right text-purple-600">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalEstimatedPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalActualPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalEstimatedCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalActualCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-rose-500">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalGmvRefund), 0))}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalSettledGmv), 0))}</td>
                      <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(tapCreators.reduce((s: number, c: any) => s + Number(c.totalShowcaseRevenue), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(tapCreators.reduce((s: number, c: any) => s + Number(c.totalOrders), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(tapCreators.reduce((s: number, c: any) => s + Number(c.totalSalesCount), 0))}</td>
                      <td className="py-2 px-3 text-right" colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shops Tab */}
      {activeTab === 'shops' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" />
              ショップ別実績（TAP）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tapShopsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : tapShops.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">ショップ</th>
                      <th className="text-right py-2 px-3">アフィリGMV</th>
                      <th className="text-right py-2 px-3">LIVE GMV</th>
                      <th className="text-right py-2 px-3">動画GMV</th>
                      <th className="text-right py-2 px-3">LCJ手数料(見込)</th>
                      <th className="text-right py-2 px-3">LCJ手数料(実績)</th>
                      <th className="text-right py-2 px-3">C手数料(見込)</th>
                      <th className="text-right py-2 px-3">C手数料(実績)</th>
                      <th className="text-right py-2 px-3">返金GMV</th>
                      <th className="text-right py-2 px-3">決済済みGMV</th>
                      <th className="text-right py-2 px-3">ショーケース</th>
                      <th className="text-right py-2 px-3">注文数</th>
                      <th className="text-right py-2 px-3">販売数</th>
                      <th className="text-right py-2 px-3">クリエイター数</th>
                      <th className="text-right py-2 px-3">商品数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tapShops.map((s: any, i: number) => (
                      <tr key={s.shopName} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 w-8">
                          {i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2 px-3 font-medium whitespace-nowrap">{s.shopName || '(不明)'}</td>
                        <td className="py-2 px-3 text-right font-semibold text-red-600">{formatCurrency(s.totalAffiliateGmv)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(s.totalLiveGmv)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(s.totalVideoGmv)}</td>
                        <td className="py-2 px-3 text-right text-purple-600">{formatCurrency(s.totalEstimatedPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(s.totalActualPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(s.totalEstimatedCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(s.totalActualCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right text-rose-500">{formatCurrency(s.totalGmvRefund)}</td>
                        <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(s.totalSettledGmv)}</td>
                        <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(s.totalShowcaseRevenue)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(s.totalOrders)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(s.totalSalesCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(s.creatorCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(s.productCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-2 px-3" colSpan={2}>合計</td>
                      <td className="py-2 px-3 text-right text-red-600">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalAffiliateGmv), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalLiveGmv), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalVideoGmv), 0))}</td>
                      <td className="py-2 px-3 text-right text-purple-600">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalEstimatedPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalActualPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalEstimatedCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalActualCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-rose-500">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalGmvRefund), 0))}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalSettledGmv), 0))}</td>
                      <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(tapShops.reduce((s: number, c: any) => s + Number(c.totalShowcaseRevenue), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(tapShops.reduce((s: number, c: any) => s + Number(c.totalOrders), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(tapShops.reduce((s: number, c: any) => s + Number(c.totalSalesCount), 0))}</td>
                      <td className="py-2 px-3 text-right" colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              商品別実績（TAP）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tapProductsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (tapProductsQuery.data || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">商品名</th>
                      <th className="text-right py-2 px-3">アフィリGMV</th>
                      <th className="text-right py-2 px-3">LIVE GMV</th>
                      <th className="text-right py-2 px-3">動画GMV</th>
                      <th className="text-right py-2 px-3">LCJ手数料(見込)</th>
                      <th className="text-right py-2 px-3">LCJ手数料(実績)</th>
                      <th className="text-right py-2 px-3">C手数料(見込)</th>
                      <th className="text-right py-2 px-3">C手数料(実績)</th>
                      <th className="text-right py-2 px-3">返金GMV</th>
                      <th className="text-right py-2 px-3">決済済みGMV</th>
                      <th className="text-right py-2 px-3">ショーケース</th>
                      <th className="text-right py-2 px-3">注文数</th>
                      <th className="text-right py-2 px-3">販売数</th>
                      <th className="text-right py-2 px-3">クリエイター数</th>
                      <th className="text-right py-2 px-3">ショップ数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tapProductsQuery.data || []).map((p: any, i: number) => (
                      <tr key={p.productId || i} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 w-8">
                          {i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2 px-3 font-medium max-w-[300px] truncate whitespace-nowrap">{p.productName || '(不明)'}</td>
                        <td className="py-2 px-3 text-right font-semibold text-red-600">{formatCurrency(p.totalAffiliateGmv)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(p.totalLiveGmv)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(p.totalVideoGmv)}</td>
                        <td className="py-2 px-3 text-right text-purple-600">{formatCurrency(p.totalEstimatedPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(p.totalActualPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(p.totalEstimatedCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(p.totalActualCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right text-rose-500">{formatCurrency(p.totalGmvRefund)}</td>
                        <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(p.totalSettledGmv)}</td>
                        <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(p.totalShowcaseRevenue)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(p.totalOrders)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(p.totalSalesCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(p.creatorCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(p.shopCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-2 px-3" colSpan={2}>合計</td>
                      <td className="py-2 px-3 text-right text-red-600">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalAffiliateGmv), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalLiveGmv), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalVideoGmv), 0))}</td>
                      <td className="py-2 px-3 text-right text-purple-600">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalEstimatedPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-blue-600">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalActualPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-orange-600">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalEstimatedCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalActualCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-rose-500">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalGmvRefund), 0))}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalSettledGmv), 0))}</td>
                      <td className="py-2 px-3 text-right text-amber-600">{formatCurrency((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalShowcaseRevenue), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalOrders), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber((tapProductsQuery.data || []).reduce((s: number, c: any) => s + Number(c.totalSalesCount), 0))}</td>
                      <td className="py-2 px-3 text-right" colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Tab */}
      {activeTab === 'daily' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              日別推移
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (dailyQuery.data || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">日付</th>
                      <th className="text-right py-2 px-3">売上</th>
                      <th className="text-right py-2 px-3">LCJ手数料</th>
                      <th className="text-right py-2 px-3">C手数料</th>
                      <th className="text-right py-2 px-3">注文数</th>
                      <th className="text-right py-2 px-3">数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dailyQuery.data || []).map((d: any) => (
                      <tr key={d.date} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium">{d.date}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(d.totalSales)}</td>
                        <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(d.totalActPartnerCommission)}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(d.totalActCreatorCommission)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(d.orderCount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(d.totalQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-2 px-3">合計</td>
                      <td className="py-2 px-3 text-right">{formatCurrency((dailyQuery.data || []).reduce((s: number, d: any) => s + Number(d.totalSales), 0))}</td>
                      <td className="py-2 px-3 text-right text-blue-600">{formatCurrency((dailyQuery.data || []).reduce((s: number, d: any) => s + Number(d.totalActPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency((dailyQuery.data || []).reduce((s: number, d: any) => s + Number(d.totalActCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber((dailyQuery.data || []).reduce((s: number, d: any) => s + Number(d.orderCount), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber((dailyQuery.data || []).reduce((s: number, d: any) => s + Number(d.totalQuantity), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly Tab */}
      {activeTab === 'monthly' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              月別推移
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : monthly.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">月</th>
                      <th className="text-right py-2 px-3">売上</th>
                      <th className="text-right py-2 px-3">LCJ手数料</th>
                      <th className="text-right py-2 px-3">C手数料</th>
                      <th className="text-right py-2 px-3">入金額</th>
                      <th className="text-right py-2 px-3">LCJ率</th>
                      <th className="text-right py-2 px-3">C率</th>
                      <th className="text-right py-2 px-3">注文数</th>
                      <th className="text-right py-2 px-3">数量</th>
                      <th className="text-right py-2 px-3">クリエイター</th>
                      <th className="text-right py-2 px-3">ショップ</th>
                      <th className="text-right py-2 px-3">前月比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m: any, i: number) => {
                      const prev = i > 0 ? monthly[i - 1] : null;
                      const change = prev ? getChangePercent(Number(m.totalSales), Number(prev.totalSales)) : null;
                      return (
                        <tr key={m.month} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedMonth(m.month); setActiveTab('dashboard'); }}>
                          <td className="py-2 px-3 font-medium">{m.month}</td>
                          <td className="py-2 px-3 text-right font-semibold">{formatCurrency(m.totalSales)}</td>
                          <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(m.totalActPartnerCommission)}</td>
                          <td className="py-2 px-3 text-right text-green-600">{formatCurrency(m.totalActCreatorCommission)}</td>
                          <td className="py-2 px-3 text-right text-indigo-600">
                            {(() => {
                              const pmData = (paymentsByMonthQuery.data || []).find((p: any) => p.month === m.month);
                              return pmData ? formatCurrency(pmData.totalPaymentAmount) : '-';
                            })()}
                          </td>
                          <td className="py-2 px-3 text-right text-cyan-600">{formatPercent(m.avgPartnerCommissionRate)}</td>
                          <td className="py-2 px-3 text-right text-teal-600">{formatPercent(m.avgCreatorCommissionRate)}</td>
                          <td className="py-2 px-3 text-right">{formatNumber(m.orderCount)}</td>
                          <td className="py-2 px-3 text-right">{formatNumber(m.totalQuantity)}</td>
                          <td className="py-2 px-3 text-right">{formatNumber(m.uniqueCreators)}</td>
                          <td className="py-2 px-3 text-right">{formatNumber(m.uniqueShops)}</td>
                          <td className="py-2 px-3 text-right">
                            {change ? (
                              <span className={`flex items-center justify-end gap-1 ${change.isUp ? 'text-green-600' : 'text-red-500'}`}>
                                {change.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {change.value.toFixed(1)}%
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-2 px-3">合計</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(monthly.reduce((s: number, m: any) => s + Number(m.totalSales), 0))}</td>
                      <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(monthly.reduce((s: number, m: any) => s + Number(m.totalActPartnerCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency(monthly.reduce((s: number, m: any) => s + Number(m.totalActCreatorCommission), 0))}</td>
                      <td className="py-2 px-3 text-right text-indigo-600">{formatCurrency((paymentsByMonthQuery.data || []).reduce((s: number, p: any) => s + Number(p.totalPaymentAmount), 0))}</td>
                      <td className="py-2 px-3 text-right" colSpan={2}></td>
                      <td className="py-2 px-3 text-right">{formatNumber(monthly.reduce((s: number, m: any) => s + Number(m.orderCount), 0))}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(monthly.reduce((s: number, m: any) => s + Number(m.totalQuantity), 0))}</td>
                      <td className="py-2 px-3 text-right" colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              注文明細
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              <Input
                placeholder="検索（注文ID・商品名）"
                value={orderSearch}
                onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(0); }}
                className="w-[200px]"
              />
              <Input
                placeholder="クリエイター"
                value={orderCreator}
                onChange={(e) => { setOrderCreator(e.target.value); setOrderPage(0); }}
                className="w-[150px]"
              />
              <Input
                placeholder="ショップ"
                value={orderShop}
                onChange={(e) => { setOrderShop(e.target.value); setOrderPage(0); }}
                className="w-[150px]"
              />
            </div>
            {ordersQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-2">注文日</th>
                        <th className="text-left py-2 px-2">商品名</th>
                        <th className="text-left py-2 px-2">クリエイター</th>
                        <th className="text-left py-2 px-2">ショップ</th>
                        <th className="text-right py-2 px-2">金額</th>
                        <th className="text-right py-2 px-2">数量</th>
                        <th className="text-right py-2 px-2">LCJ手数料</th>
                        <th className="text-right py-2 px-2">C手数料</th>
                        <th className="text-right py-2 px-2">LCJ率</th>
                        <th className="text-right py-2 px-2">C率</th>
                        <th className="text-center py-2 px-2">ステータス</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ordersQuery.data?.rows || []).map((o: any) => (
                        <tr key={o.id} className="border-b hover:bg-muted/50">
                          <td className="py-1.5 px-2">{o.orderCreatedAt ? new Date(o.orderCreatedAt).toLocaleDateString('ja-JP') : '-'}</td>
                          <td className="py-1.5 px-2 max-w-[200px] truncate">{o.productName || '-'}</td>
                          <td className="py-1.5 px-2">{o.creatorUsername || '-'}</td>
                          <td className="py-1.5 px-2">{o.shopName || '-'}</td>
                          <td className="py-1.5 px-2 text-right">{formatCurrency(o.price)}</td>
                          <td className="py-1.5 px-2 text-right">{o.quantity}</td>
                          <td className="py-1.5 px-2 text-right text-blue-600">{formatCurrency(o.actualPartnerCommission)}</td>
                          <td className="py-1.5 px-2 text-right text-green-600">{formatCurrency(o.actualCreatorCommission)}</td>
                          <td className="py-1.5 px-2 text-right text-cyan-600">{o.partnerCommissionRate ? formatPercent(o.partnerCommissionRate) : '-'}</td>
                          <td className="py-1.5 px-2 text-right text-teal-600">{o.creatorCommissionRate ? formatPercent(o.creatorCommissionRate) : '-'}</td>
                          <td className="py-1.5 px-2 text-center">
                            <Badge variant={o.orderStatus === '完了' ? 'default' : 'secondary'} className="text-xs">
                              {o.orderStatus || '-'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {ordersQuery.data && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      全{formatNumber(ordersQuery.data.total)}件中 {orderPage * pageSize + 1}-{Math.min((orderPage + 1) * pageSize, ordersQuery.data.total)}件
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={orderPage === 0} onClick={() => setOrderPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={(orderPage + 1) * pageSize >= ordersQuery.data.total} onClick={() => setOrderPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Imports Tab */}
      {activeTab === 'imports' && (
        <div className="space-y-6">
          {/* CAP Data Imports */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CAPデータ（コミッション明細）
                </CardTitle>
                <Button onClick={() => setUploadDialogOpen(true)} size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  CAP CSVアップロード
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {importsQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (importsQuery.data || []).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">インポート履歴なし</p>
              ) : (
                <div className="space-y-3">
                  {(importsQuery.data || []).map((imp: any) => (
                    <div key={imp.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{imp.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {imp.importedRows}件インポート / {imp.skippedRows}件スキップ
                          {imp.dateRangeStart && ` | ${new Date(imp.dateRangeStart).toLocaleDateString('ja-JP')} ~ ${new Date(imp.dateRangeEnd).toLocaleDateString('ja-JP')}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={imp.status === 'completed' ? 'default' : 'destructive'}>
                          {imp.status === 'completed' ? '完了' : imp.status}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => { setDeleteImportId(imp.id); setDeleteDialogOpen(true); }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  入金データ
                </CardTitle>
                <Button onClick={() => setPaymentUploadDialogOpen(true)} size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  入金CSVアップロード
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {paymentsListQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (paymentsListQuery.data || []).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">入金データなし。入金CSVをアップロードしてください。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3">支払日時</th>
                        <th className="text-left py-2 px-3">参照ID</th>
                        <th className="text-right py-2 px-3">決済金額</th>
                        <th className="text-right py-2 px-3">支払金額</th>
                        <th className="text-center py-2 px-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paymentsListQuery.data || []).map((p: any) => (
                        <tr key={p.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3">{p.paymentTime ? new Date(p.paymentTime).toLocaleString('ja-JP') : '-'}</td>
                          <td className="py-2 px-3 text-xs font-mono">{p.referenceId || '-'}</td>
                          <td className="py-2 px-3 text-right font-semibold">{formatCurrency(p.settlementAmount)}</td>
                          <td className="py-2 px-3 text-right text-indigo-600 font-semibold">{formatCurrency(p.paymentAmount)}</td>
                          <td className="py-2 px-3 text-center">
                            <Button variant="ghost" size="sm" onClick={() => { setDeletePaymentId(p.id); setDeletePaymentDialogOpen(true); }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold">
                        <td className="py-2 px-3" colSpan={2}>合計</td>
                        <td className="py-2 px-3 text-right">{formatCurrency((paymentsListQuery.data || []).reduce((s: number, p: any) => s + Number(p.settlementAmount || 0), 0))}</td>
                        <td className="py-2 px-3 text-right text-indigo-600">{formatCurrency((paymentsListQuery.data || []).reduce((s: number, p: any) => s + Number(p.paymentAmount || 0), 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payments Tab - 入金月別 */}
      {activeTab === 'payments' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                入金月別推移
              </CardTitle>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  合計: <span className="font-bold text-indigo-600">{formatCurrency((paymentsByMonthQuery.data || []).reduce((s: number, p: any) => s + Number(p.totalPaymentAmount), 0))}</span>
                  <span className="ml-2">({(paymentsByMonthQuery.data || []).reduce((s: number, p: any) => s + Number(p.paymentCount), 0)}件)</span>
                </p>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('dashboard')}>
                  <ChevronLeft className="h-3 w-3 mr-1" /> ダッシュボードに戻る
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {paymentsByMonthQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !paymentsByMonthQuery.data || paymentsByMonthQuery.data.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">入金データがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium">月</th>
                      <th className="text-right py-3 px-4 font-medium">入金額</th>
                      <th className="text-right py-3 px-4 font-medium">件数</th>
                      <th className="text-right py-3 px-4 font-medium">前月比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(paymentsByMonthQuery.data || [])].reverse().map((pm: any, idx: number, arr: any[]) => {
                      const prevMonth = arr[idx + 1];
                      const change = prevMonth ? getChangePercent(Number(pm.totalPaymentAmount), Number(prevMonth.totalPaymentAmount)) : null;
                      return (
                        <tr key={pm.month} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{pm.month}</td>
                          <td className="py-3 px-4 text-right font-semibold text-indigo-600">{formatCurrency(pm.totalPaymentAmount)}</td>
                          <td className="py-3 px-4 text-right">{formatNumber(pm.paymentCount)}件</td>
                          <td className="py-3 px-4 text-right">
                            {change ? (
                              <span className={`inline-flex items-center gap-1 ${change.isUp ? 'text-green-600' : 'text-red-600'}`}>
                                {change.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {change.value.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold">
                      <td className="py-3 px-4">合計</td>
                      <td className="py-3 px-4 text-right text-indigo-600">{formatCurrency((paymentsByMonthQuery.data || []).reduce((s: number, p: any) => s + Number(p.totalPaymentAmount), 0))}</td>
                      <td className="py-3 px-4 text-right">{formatNumber((paymentsByMonthQuery.data || []).reduce((s: number, p: any) => s + Number(p.paymentCount), 0))}件</td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TSP Contract Tab */}
      {activeTab === 'tsp' && <TspContractTab />}

      {/* TAP Analysis Tab */}
      {activeTab === 'tap' && (
        <div className="space-y-6">
          {/* TAP Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">TAP</Badge>
              <span className="text-sm text-muted-foreground">TikTok Affiliate Program（マーケットプレイス）</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={tapMonth} onValueChange={(v) => setTapMonth(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[160px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="全期間" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全期間</SelectItem>
                  {(tapAvailableMonthsQuery.data || []).map((m: any) => (
                    <SelectItem key={m.reportMonth} value={m.reportMonth}>{m.reportMonth} ({m.recordCount}件)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setTapUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                TAPアップロード
              </Button>
            </div>
          </div>

          {/* TAP KPI Cards */}
          {tapSummaryQuery.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-violet-500">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    アフィリエイトGMV
                  </div>
                  <p className="text-2xl font-bold text-violet-600">{formatCurrency(tapSummaryQuery.data.totalAffiliateGmv)}</p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>LIVE: {formatCurrency(tapSummaryQuery.data.totalLiveGmv)}</span>
                    <span>動画: {formatCurrency(tapSummaryQuery.data.totalVideoGmv)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    コミッション
                  </div>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(tapSummaryQuery.data.totalActualPartnerCommission)}</p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>LCJ: {formatCurrency(tapSummaryQuery.data.totalActualPartnerCommission)}</span>
                    <span>C: {formatCurrency(tapSummaryQuery.data.totalActualCreatorCommission)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    注文数 / 販売数
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(tapSummaryQuery.data.totalOrders)}</p>
                  <p className="text-xs text-muted-foreground mt-1">販売数: {formatNumber(tapSummaryQuery.data.totalSalesCount)}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-orange-500">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Video className="h-3.5 w-3.5" />
                    パフォーマンス
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-lg font-bold">{formatNumber(tapSummaryQuery.data.totalLiveViews)}</p>
                      <p className="text-xs text-muted-foreground">LIVE視聴</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <p className="text-lg font-bold">{formatNumber(tapSummaryQuery.data.totalVideoViews)}</p>
                      <p className="text-xs text-muted-foreground">動画視聴</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAP Sub-tabs */}
          <div className="flex gap-2 border-b pb-2">
            {[
              { key: 'tap' as TabType, label: '概要', icon: BarChart3 },
              { key: 'tap-creators' as TabType, label: 'クリエイター別', icon: Users },
              { key: 'tap-shops' as TabType, label: 'ショップ別', icon: Store },
              { key: 'tap-products' as TabType, label: '商品別', icon: ShoppingBag },
              { key: 'tap-live' as TabType, label: 'LIVE配信', icon: Video },
              { key: 'tap-videos' as TabType, label: '動画', icon: FileText },
            ].map(sub => (
              <button
                key={sub.key}
                onClick={() => setActiveTab(sub.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === sub.key
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <sub.icon className="h-3.5 w-3.5" />
                {sub.label}
              </button>
            ))}
            <div className="border-l mx-1" />
            {[
              { key: 'tap-creator-profit' as TabType, label: 'ライバー収益分析', icon: Crown },
              { key: 'tap-profitability' as TabType, label: '商品利益率', icon: Percent },
              { key: 'tap-bestmatch' as TabType, label: 'ベストマッチ', icon: Target },
              { key: 'tap-shop-analysis' as TabType, label: 'ショップ収益性', icon: Building2 },
              { key: 'tap-live-efficiency' as TabType, label: 'LIVE効率', icon: Zap },
              { key: 'tap-growth' as TabType, label: '成長トレンド', icon: Activity },
            ].map(sub => (
              <button
                key={sub.key}
                onClick={() => setActiveTab(sub.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === sub.key
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <sub.icon className="h-3.5 w-3.5" />
                {sub.label}
              </button>
            ))}
          </div>

          {/* TAP Monthly Trend */}
          {(activeTab === 'tap') && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  TAP月別推移
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tapMonthlyQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : !tapMonthlyQuery.data || tapMonthlyQuery.data.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">TAPデータがありません。XLSXファイルをアップロードしてください。</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left py-2 px-3">月</th>
                          <th className="text-right py-2 px-3">アフィリGMV</th>
                          <th className="text-right py-2 px-3">LIVE GMV</th>
                          <th className="text-right py-2 px-3">動画GMV</th>
                          <th className="text-right py-2 px-3">LCJ手数料</th>
                          <th className="text-right py-2 px-3">注文数</th>
                          <th className="text-right py-2 px-3">LIVE視聴</th>
                          <th className="text-center py-2 px-3">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tapMonthlyQuery.data || []).map((m: any) => (
                          <tr key={m.reportMonth} className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${expandedMonth === m.reportMonth ? 'bg-violet-50 dark:bg-violet-950/30' : ''}`} onClick={() => { setExpandedMonth(expandedMonth === m.reportMonth ? null : m.reportMonth); setExpandedMonthTab('overview'); }}>
                            <td className="py-2 px-3 font-medium">{m.reportMonth}</td>
                            <td className="py-2 px-3 text-right font-semibold text-violet-600">{formatCurrency(m.totalAffiliateGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(m.totalLiveGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(m.totalVideoGmv)}</td>
                            <td className="py-2 px-3 text-right text-green-600">{formatCurrency(m.totalActualPartnerCommission)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(m.totalOrders)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(m.totalLiveViews)}</td>
                            <td className="py-2 px-3 text-center">
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); setDeleteTapMonthDialog(m.reportMonth); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Month Detail Inline Expansion */}
          {expandedMonth && (activeTab === 'tap') && (
            <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-violet-600" />
                    {expandedMonth} 月別詳細
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setExpandedMonth(null)}>
                    <ChevronDown className="h-4 w-4 mr-1" />閉じる
                  </Button>
                </div>
                {/* Sub-tabs */}
                <div className="flex gap-1 mt-2">
                  {[
                    { key: 'overview' as const, label: '概要', icon: BarChart3 },
                    { key: 'creators' as const, label: 'クリエイター', icon: Users },
                    { key: 'shops' as const, label: 'ショップ', icon: Store },
                    { key: 'products' as const, label: '商品', icon: Package },
                  ].map(t => (
                    <button key={t.key} onClick={() => setExpandedMonthTab(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        expandedMonthTab === t.key ? 'bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-200' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}>
                      <t.icon className="h-3.5 w-3.5" />{t.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {/* Overview Tab */}
                {expandedMonthTab === 'overview' && (
                  <div className="space-y-4">
                    {monthDetailSummaryQuery.isLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : monthDetailSummaryQuery.data ? (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'アフィリGMV', value: formatCurrency(monthDetailSummaryQuery.data.totalAffiliateGmv), color: 'text-violet-600' },
                            { label: 'LIVE GMV', value: formatCurrency(monthDetailLiveQuery.data?.totalGmv || 0), color: 'text-blue-600' },
                            { label: '動画GMV', value: formatCurrency(monthDetailVideoQuery.data?.totalGmv || 0), color: 'text-cyan-600' },
                            { label: 'LCJ手数料(見込)', value: formatCurrency(monthDetailSummaryQuery.data.totalEstimatedPartnerCommission), color: 'text-green-600' },
                            { label: 'LCJ手数料(実績)', value: formatCurrency(monthDetailSummaryQuery.data.totalActualPartnerCommission), color: 'text-emerald-600' },
                            { label: '注文数', value: formatNumber(monthDetailSummaryQuery.data.totalOrders), color: '' },
                            { label: '販売数', value: formatNumber(monthDetailSummaryQuery.data.totalUnitsSold), color: '' },
                            { label: '決済済みGMV', value: formatCurrency(monthDetailSummaryQuery.data.totalSettledGmv), color: 'text-amber-600' },
                            { label: '返金GMV', value: formatCurrency(monthDetailSummaryQuery.data.totalGmvRefund), color: 'text-red-500' },
                            { label: 'ショーケース収益', value: formatCurrency(monthDetailSummaryQuery.data.totalShowcaseRevenue), color: 'text-purple-600' },
                            { label: 'C手数料(見込)', value: formatCurrency(monthDetailSummaryQuery.data.totalEstimatedCreatorCommission), color: 'text-orange-600' },
                            { label: 'C手数料(実績)', value: formatCurrency(monthDetailSummaryQuery.data.totalActualCreatorCommission), color: 'text-orange-500' },
                          ].map((item, i) => (
                            <div key={i} className="bg-white dark:bg-background rounded-lg p-3 border">
                              <div className="text-xs text-muted-foreground">{item.label}</div>
                              <div className={`text-sm font-bold mt-1 ${item.color}`}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        {/* LIVE & Video Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                            <div className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">LIVE配信サマリー</div>
                            {monthDetailLiveQuery.data ? (
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-muted-foreground">GMV:</span> <span className="font-medium">{formatCurrency(monthDetailLiveQuery.data.totalGmv)}</span></div>
                                <div><span className="text-muted-foreground">手数料:</span> <span className="font-medium">{formatCurrency(monthDetailLiveQuery.data.totalPartnerCommission)}</span></div>
                                <div><span className="text-muted-foreground">注文数:</span> <span className="font-medium">{formatNumber(monthDetailLiveQuery.data.totalOrders)}</span></div>
                                <div><span className="text-muted-foreground">視聴数:</span> <span className="font-medium">{formatNumber(monthDetailLiveQuery.data.totalViews)}</span></div>
                                <div><span className="text-muted-foreground">配信数:</span> <span className="font-medium">{formatNumber(monthDetailLiveQuery.data.totalSessions)}</span></div>
                                <div><span className="text-muted-foreground">RPM:</span> <span className="font-medium">¥{formatNumber(monthDetailLiveQuery.data.avgRpm)}</span></div>
                              </div>
                            ) : <div className="text-xs text-muted-foreground">データなし</div>}
                          </div>
                          <div className="bg-cyan-50 dark:bg-cyan-950/30 rounded-lg p-3">
                            <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-400 mb-2">動画サマリー</div>
                            {monthDetailVideoQuery.data ? (
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-muted-foreground">GMV:</span> <span className="font-medium">{formatCurrency(monthDetailVideoQuery.data.totalGmv)}</span></div>
                                <div><span className="text-muted-foreground">手数料:</span> <span className="font-medium">{formatCurrency(monthDetailVideoQuery.data.totalPartnerCommission)}</span></div>
                                <div><span className="text-muted-foreground">注文数:</span> <span className="font-medium">{formatNumber(monthDetailVideoQuery.data.totalOrders)}</span></div>
                                <div><span className="text-muted-foreground">視聴数:</span> <span className="font-medium">{formatNumber(monthDetailVideoQuery.data.totalViews)}</span></div>
                                <div><span className="text-muted-foreground">動画数:</span> <span className="font-medium">{formatNumber(monthDetailVideoQuery.data.totalSessions)}</span></div>
                                <div><span className="text-muted-foreground">RPM:</span> <span className="font-medium">¥{formatNumber(monthDetailVideoQuery.data.avgRpm)}</span></div>
                              </div>
                            ) : <div className="text-xs text-muted-foreground">データなし</div>}
                          </div>
                        </div>
                        {/* Active counts */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white dark:bg-background rounded-lg p-3 text-center border">
                            <div className="text-xs text-muted-foreground">クリエイター</div>
                            <div className="text-lg font-bold">{formatNumber(monthDetailSummaryQuery.data.creatorCount)}</div>
                          </div>
                          <div className="bg-white dark:bg-background rounded-lg p-3 text-center border">
                            <div className="text-xs text-muted-foreground">ショップ</div>
                            <div className="text-lg font-bold">{formatNumber(monthDetailSummaryQuery.data.shopCount)}</div>
                          </div>
                          <div className="bg-white dark:bg-background rounded-lg p-3 text-center border">
                            <div className="text-xs text-muted-foreground">商品</div>
                            <div className="text-lg font-bold">{formatNumber(monthDetailSummaryQuery.data.productCount)}</div>
                          </div>
                        </div>
                      </>
                    ) : <p className="text-center text-muted-foreground py-4">データなし</p>}
                  </div>
                )}
                {/* Creators Tab */}
                {expandedMonthTab === 'creators' && (
                  <div>
                    {monthDetailCreatorsQuery.isLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : (monthDetailCreatorsQuery.data || []).length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">データなし</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-2 px-2">#</th>
                              <th className="text-left py-2 px-2">クリエイター</th>
                              <th className="text-right py-2 px-2">アフィリGMV</th>
                              <th className="text-right py-2 px-2">LIVE GMV</th>
                              <th className="text-right py-2 px-2">動画GMV</th>
                              <th className="text-right py-2 px-2">LCJ手数料(見込)</th>
                              <th className="text-right py-2 px-2">LCJ手数料(実績)</th>
                              <th className="text-right py-2 px-2">C手数料(見込)</th>
                              <th className="text-right py-2 px-2">C手数料(実績)</th>
                              <th className="text-right py-2 px-2">注文数</th>
                              <th className="text-right py-2 px-2">販売数</th>
                              <th className="text-right py-2 px-2">返金GMV</th>
                              <th className="text-right py-2 px-2">決済済みGMV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(monthDetailCreatorsQuery.data || []).map((c: any, i: number) => (
                              <tr key={c.creatorUsername} className="border-b hover:bg-muted/50">
                                <td className="py-1.5 px-2">{i + 1}</td>
                                <td className="py-1.5 px-2 font-medium">{c.creatorUsername}</td>
                                <td className="py-1.5 px-2 text-right font-semibold text-violet-600">{formatCurrency(c.totalAffiliateGmv)}</td>
                                <td className="py-1.5 px-2 text-right">{formatCurrency(c.totalLiveGmv)}</td>
                                <td className="py-1.5 px-2 text-right">{formatCurrency(c.totalVideoGmv)}</td>
                                <td className="py-1.5 px-2 text-right text-green-600">{formatCurrency(c.totalEstimatedPartnerCommission)}</td>
                                <td className="py-1.5 px-2 text-right text-emerald-600">{formatCurrency(c.totalActualPartnerCommission)}</td>
                                <td className="py-1.5 px-2 text-right text-orange-600">{formatCurrency(c.totalEstimatedCreatorCommission)}</td>
                                <td className="py-1.5 px-2 text-right text-orange-500">{formatCurrency(c.totalActualCreatorCommission)}</td>
                                <td className="py-1.5 px-2 text-right">{formatNumber(c.totalOrders)}</td>
                                <td className="py-1.5 px-2 text-right">{formatNumber(c.totalUnitsSold)}</td>
                                <td className="py-1.5 px-2 text-right text-red-500">{formatCurrency(c.totalGmvRefund)}</td>
                                <td className="py-1.5 px-2 text-right text-amber-600">{formatCurrency(c.totalSettledGmv)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
                {/* Shops Tab */}
                {expandedMonthTab === 'shops' && (
                  <div>
                    {monthDetailShopsQuery.isLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : (monthDetailShopsQuery.data || []).length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">データなし</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-2 px-2">#</th>
                              <th className="text-left py-2 px-2">ショップ</th>
                              <th className="text-right py-2 px-2">アフィリGMV</th>
                              <th className="text-right py-2 px-2">LIVE GMV</th>
                              <th className="text-right py-2 px-2">動画GMV</th>
                              <th className="text-right py-2 px-2">LCJ手数料(見込)</th>
                              <th className="text-right py-2 px-2">LCJ手数料(実績)</th>
                              <th className="text-right py-2 px-2">注文数</th>
                              <th className="text-right py-2 px-2">販売数</th>
                              <th className="text-right py-2 px-2">返金GMV</th>
                              <th className="text-right py-2 px-2">決済済みGMV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(monthDetailShopsQuery.data || []).map((s: any, i: number) => (
                              <tr key={s.shopName} className="border-b hover:bg-muted/50">
                                <td className="py-1.5 px-2">{i + 1}</td>
                                <td className="py-1.5 px-2 font-medium max-w-[200px] truncate" title={s.shopName}>{s.shopName}</td>
                                <td className="py-1.5 px-2 text-right font-semibold text-violet-600">{formatCurrency(s.totalAffiliateGmv)}</td>
                                <td className="py-1.5 px-2 text-right">{formatCurrency(s.totalLiveGmv)}</td>
                                <td className="py-1.5 px-2 text-right">{formatCurrency(s.totalVideoGmv)}</td>
                                <td className="py-1.5 px-2 text-right text-green-600">{formatCurrency(s.totalEstimatedPartnerCommission)}</td>
                                <td className="py-1.5 px-2 text-right text-emerald-600">{formatCurrency(s.totalActualPartnerCommission)}</td>
                                <td className="py-1.5 px-2 text-right">{formatNumber(s.totalOrders)}</td>
                                <td className="py-1.5 px-2 text-right">{formatNumber(s.totalUnitsSold)}</td>
                                <td className="py-1.5 px-2 text-right text-red-500">{formatCurrency(s.totalGmvRefund)}</td>
                                <td className="py-1.5 px-2 text-right text-amber-600">{formatCurrency(s.totalSettledGmv)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
                {/* Products Tab */}
                {expandedMonthTab === 'products' && (
                  <div>
                    {monthDetailProductsQuery.isLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : (monthDetailProductsQuery.data || []).length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">データなし</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-2 px-2">#</th>
                              <th className="text-left py-2 px-2">商品名</th>
                              <th className="text-right py-2 px-2">アフィリGMV</th>
                              <th className="text-right py-2 px-2">LIVE GMV</th>
                              <th className="text-right py-2 px-2">動画GMV</th>
                              <th className="text-right py-2 px-2">LCJ手数料(見込)</th>
                              <th className="text-right py-2 px-2">LCJ手数料(実績)</th>
                              <th className="text-right py-2 px-2">注文数</th>
                              <th className="text-right py-2 px-2">販売数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(monthDetailProductsQuery.data || []).slice(0, 100).map((p: any, i: number) => (
                              <tr key={`${p.productName}-${i}`} className="border-b hover:bg-muted/50">
                                <td className="py-1.5 px-2">{i + 1}</td>
                                <td className="py-1.5 px-2 font-medium max-w-[250px] truncate" title={p.productName}>{p.productName}</td>
                                <td className="py-1.5 px-2 text-right font-semibold text-violet-600">{formatCurrency(p.totalAffiliateGmv)}</td>
                                <td className="py-1.5 px-2 text-right">{formatCurrency(p.totalLiveGmv)}</td>
                                <td className="py-1.5 px-2 text-right">{formatCurrency(p.totalVideoGmv)}</td>
                                <td className="py-1.5 px-2 text-right text-green-600">{formatCurrency(p.totalEstimatedPartnerCommission)}</td>
                                <td className="py-1.5 px-2 text-right text-emerald-600">{formatCurrency(p.totalActualPartnerCommission)}</td>
                                <td className="py-1.5 px-2 text-right">{formatNumber(p.totalOrders)}</td>
                                <td className="py-1.5 px-2 text-right">{formatNumber(p.totalUnitsSold)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(monthDetailProductsQuery.data || []).length > 100 && (
                          <p className="text-xs text-muted-foreground text-center py-2">上位100件を表示（全{(monthDetailProductsQuery.data || []).length}件）</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAP Creators */}
          {(activeTab === 'tap' || activeTab === 'tap-creators') && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  クリエイター別実績
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tapCreatorsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : !tapCreatorsQuery.data || tapCreatorsQuery.data.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">クリエイター</th>
                          <th className="text-right py-2 px-3">アフィリGMV</th>
                          <th className="text-right py-2 px-3">LIVE GMV</th>
                          <th className="text-right py-2 px-3">動画GMV</th>
                          <th className="text-right py-2 px-3">LCJ手数料</th>
                          <th className="text-right py-2 px-3">注文数</th>
                          <th className="text-right py-2 px-3">LIVE視聴</th>
                          <th className="text-right py-2 px-3">動画視聴</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tapCreatorsQuery.data || []).map((c: any, i: number) => (
                          <tr key={c.creatorUsername} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                            <td className="py-2 px-3 font-medium">{c.creatorUsername}</td>
                            <td className="py-2 px-3 text-right font-semibold text-violet-600">{formatCurrency(c.totalAffiliateGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(c.totalLiveGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(c.totalVideoGmv)}</td>
                            <td className="py-2 px-3 text-right text-green-600">{formatCurrency(c.totalActualPartnerCommission)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(c.totalOrders)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(c.totalLiveViews)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(c.totalVideoViews)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAP Shops */}
          {(activeTab === 'tap' || activeTab === 'tap-shops') && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  ショップ別実績
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tapShopsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : !tapShopsQuery.data || tapShopsQuery.data.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">ショップ名</th>
                          <th className="text-right py-2 px-3">アフィリGMV</th>
                          <th className="text-right py-2 px-3">LIVE GMV</th>
                          <th className="text-right py-2 px-3">動画GMV</th>
                          <th className="text-right py-2 px-3">LCJ手数料</th>
                          <th className="text-right py-2 px-3">注文数</th>
                          <th className="text-right py-2 px-3">商品数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tapShopsQuery.data || []).map((s: any, i: number) => (
                          <tr key={s.shopName} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                            <td className="py-2 px-3 font-medium">{s.shopName}</td>
                            <td className="py-2 px-3 text-right font-semibold text-violet-600">{formatCurrency(s.totalAffiliateGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(s.totalLiveGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(s.totalVideoGmv)}</td>
                            <td className="py-2 px-3 text-right text-green-600">{formatCurrency(s.totalActualPartnerCommission)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(s.totalOrders)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(s.productCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAP Products */}
          {activeTab === 'tap-products' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  商品別実績
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tapProductsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : !tapProductsQuery.data || tapProductsQuery.data.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">商品名</th>
                          <th className="text-left py-2 px-3">ショップ</th>
                          <th className="text-right py-2 px-3">アフィリGMV</th>
                          <th className="text-right py-2 px-3">LIVE GMV</th>
                          <th className="text-right py-2 px-3">動画GMV</th>
                          <th className="text-right py-2 px-3">注文数</th>
                          <th className="text-right py-2 px-3">販売数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tapProductsQuery.data || []).map((p: any, i: number) => (
                          <tr key={`${p.productName}-${p.shopName}`} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                            <td className="py-2 px-3 font-medium max-w-[200px] truncate" title={p.productName}>{p.productName}</td>
                            <td className="py-2 px-3 text-xs text-muted-foreground max-w-[150px] truncate" title={p.shopName}>{p.shopName}</td>
                            <td className="py-2 px-3 text-right font-semibold text-violet-600">{formatCurrency(p.totalAffiliateGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(p.totalLiveGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(p.totalVideoGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(p.totalOrders)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(p.totalSalesCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAP sub-tabs redirect */}
      {(activeTab === 'tap-creators' || activeTab === 'tap-shops' || activeTab === 'tap-products' || activeTab === 'tap-live' || activeTab === 'tap-videos' || activeTab === 'tap-profitability' || activeTab === 'tap-bestmatch' || activeTab === 'tap-shop-analysis' || activeTab === 'tap-live-efficiency' || activeTab === 'tap-growth' || activeTab === 'tap-creator-profit') && (
        <div className="space-y-6">
          {/* TAP Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">TAP</Badge>
              <span className="text-sm text-muted-foreground">TikTok Affiliate Program</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={tapMonth} onValueChange={(v) => setTapMonth(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[160px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="全期間" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全期間</SelectItem>
                  {(tapAvailableMonthsQuery.data || []).map((m: any) => (
                    <SelectItem key={m.reportMonth} value={m.reportMonth}>{m.reportMonth}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('tap')}>
                <ChevronLeft className="h-3 w-3 mr-1" /> TAP概要に戻る
              </Button>
            </div>
          </div>

          {/* TAP Sub-tabs */}
          <div className="flex gap-2 border-b pb-2">
            {[
              { key: 'tap' as TabType, label: '概要', icon: BarChart3 },
              { key: 'tap-creators' as TabType, label: 'クリエイター別', icon: Users },
              { key: 'tap-shops' as TabType, label: 'ショップ別', icon: Store },
              { key: 'tap-products' as TabType, label: '商品別', icon: ShoppingBag },
              { key: 'tap-live' as TabType, label: 'LIVE配信', icon: Video },
              { key: 'tap-videos' as TabType, label: '動画', icon: FileText },
            ].map(sub => (
              <button
                key={sub.key}
                onClick={() => setActiveTab(sub.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === sub.key
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <sub.icon className="h-3.5 w-3.5" />
                {sub.label}
              </button>
            ))}
            <div className="border-l mx-1" />
            {[
              { key: 'tap-creator-profit' as TabType, label: 'ライバー収益分析', icon: Crown },
              { key: 'tap-profitability' as TabType, label: '商品利益率', icon: Percent },
              { key: 'tap-bestmatch' as TabType, label: 'ベストマッチ', icon: Target },
              { key: 'tap-shop-analysis' as TabType, label: 'ショップ収益性', icon: Building2 },
              { key: 'tap-live-efficiency' as TabType, label: 'LIVE効率', icon: Zap },
              { key: 'tap-growth' as TabType, label: '成長トレンド', icon: Activity },
            ].map(sub => (
              <button
                key={sub.key}
                onClick={() => setActiveTab(sub.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === sub.key
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <sub.icon className="h-3.5 w-3.5" />
                {sub.label}
              </button>
            ))}
          </div>

          {/* TAP Creators Detail */}
          {activeTab === 'tap-creators' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  クリエイター別実績
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tapCreatorsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : !tapCreatorsQuery.data || tapCreatorsQuery.data.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">クリエイター</th>
                          <th className="text-right py-2 px-3">アフィリGMV</th>
                          <th className="text-right py-2 px-3">LIVE GMV</th>
                          <th className="text-right py-2 px-3">動画GMV</th>
                          <th className="text-right py-2 px-3">LCJ手数料</th>
                          <th className="text-right py-2 px-3">C手数料</th>
                          <th className="text-right py-2 px-3">注文数</th>
                          <th className="text-right py-2 px-3">LIVE視聴</th>
                          <th className="text-right py-2 px-3">動画視聴</th>
                          <th className="text-right py-2 px-3">LIVE回数</th>
                          <th className="text-right py-2 px-3">動画数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tapCreatorsQuery.data || []).map((c: any, i: number) => (
                          <tr key={c.creatorUsername} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                            <td className="py-2 px-3 font-medium">{c.creatorUsername}</td>
                            <td className="py-2 px-3 text-right font-semibold text-violet-600">{formatCurrency(c.totalAffiliateGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(c.totalLiveGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(c.totalVideoGmv)}</td>
                            <td className="py-2 px-3 text-right text-green-600">{formatCurrency(c.totalActualPartnerCommission)}</td>
                            <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(c.totalActualCreatorCommission)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(c.totalOrders)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(c.totalLiveViews)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(c.totalVideoViews)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(c.totalLiveCount)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(c.totalVideoCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAP Shops Detail */}
          {activeTab === 'tap-shops' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  ショップ別実績
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tapShopsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : !tapShopsQuery.data || tapShopsQuery.data.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">ショップ名</th>
                          <th className="text-right py-2 px-3">アフィリGMV</th>
                          <th className="text-right py-2 px-3">LIVE GMV</th>
                          <th className="text-right py-2 px-3">動画GMV</th>
                          <th className="text-right py-2 px-3">LCJ手数料</th>
                          <th className="text-right py-2 px-3">注文数</th>
                          <th className="text-right py-2 px-3">商品数</th>
                          <th className="text-right py-2 px-3">クリエイター数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tapShopsQuery.data || []).map((s: any, i: number) => (
                          <tr key={s.shopName} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                            <td className="py-2 px-3 font-medium">{s.shopName}</td>
                            <td className="py-2 px-3 text-right font-semibold text-violet-600">{formatCurrency(s.totalAffiliateGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(s.totalLiveGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(s.totalVideoGmv)}</td>
                            <td className="py-2 px-3 text-right text-green-600">{formatCurrency(s.totalActualPartnerCommission)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(s.totalOrders)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(s.productCount)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(s.creatorCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAP Products Detail */}
          {activeTab === 'tap-products' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  商品別実績
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tapProductsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : !tapProductsQuery.data || tapProductsQuery.data.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">商品名</th>
                          <th className="text-left py-2 px-3">ショップ</th>
                          <th className="text-right py-2 px-3">アフィリGMV</th>
                          <th className="text-right py-2 px-3">LIVE GMV</th>
                          <th className="text-right py-2 px-3">動画GMV</th>
                          <th className="text-right py-2 px-3">注文数</th>
                          <th className="text-right py-2 px-3">販売数</th>
                          <th className="text-right py-2 px-3">LIVE視聴</th>
                          <th className="text-right py-2 px-3">動画視聴</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tapProductsQuery.data || []).map((p: any, i: number) => (
                          <tr key={`${p.productName}-${p.shopName}`} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                            <td className="py-2 px-3 font-medium max-w-[200px] truncate" title={p.productName}>{p.productName}</td>
                            <td className="py-2 px-3 text-xs text-muted-foreground max-w-[150px] truncate" title={p.shopName}>{p.shopName}</td>
                            <td className="py-2 px-3 text-right font-semibold text-violet-600">{formatCurrency(p.totalAffiliateGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(p.totalLiveGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(p.totalVideoGmv)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(p.totalOrders)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(p.totalSalesCount)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(p.totalLiveViews)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(p.totalVideoViews)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAP Live Detail */}
          {activeTab === 'tap-live' && (
            <div className="space-y-6">
              {/* Live KPI */}
              {tapLiveSummaryQuery.data && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">LIVE GMV</div>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(tapLiveSummaryQuery.data.totalGmv)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">LCJ手数料</div>
                      <p className="text-lg font-semibold text-green-600">{formatCurrency(tapLiveSummaryQuery.data.totalPartnerCommission)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">注文数</div>
                      <p className="text-lg font-semibold">{formatNumber(tapLiveSummaryQuery.data.totalOrders)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">視聴数</div>
                      <p className="text-lg font-semibold">{formatNumber(tapLiveSummaryQuery.data.totalViews)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">配信数</div>
                      <p className="text-lg font-semibold">{formatNumber(tapLiveSummaryQuery.data.totalSessions)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">RPM</div>
                      <p className="text-lg font-semibold text-amber-600">{formatCurrency(tapLiveSummaryQuery.data.avgRpm)}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Live Monthly */}
              {tapLiveMonthlyQuery.data && tapLiveMonthlyQuery.data.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      LIVE月別推移
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-3">月</th>
                            <th className="text-right py-2 px-3">GMV</th>
                            <th className="text-right py-2 px-3">LCJ手数料</th>
                            <th className="text-right py-2 px-3">注文数</th>
                            <th className="text-right py-2 px-3">視聴数</th>
                            <th className="text-right py-2 px-3">配信数</th>
                            <th className="text-right py-2 px-3">RPM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tapLiveMonthlyQuery.data || []).map((m: any) => (
                            <tr key={m.reportMonth} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-3 font-medium">{m.reportMonth}</td>
                              <td className="py-2 px-3 text-right font-semibold text-red-600">{formatCurrency(m.totalGmv)}</td>
                              <td className="py-2 px-3 text-right text-green-600">{formatCurrency(m.totalPartnerCommission)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(m.totalOrders)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(m.totalViews)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(m.totalSessions)}</td>
                              <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(m.avgRpm)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Live Creator Ranking */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    LIVEクリエイター別実績
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tapLiveCreatorsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : !tapLiveCreatorsQuery.data || tapLiveCreatorsQuery.data.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">データがありません</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-3">#</th>
                            <th className="text-left py-2 px-3">クリエイター</th>
                            <th className="text-right py-2 px-3">GMV</th>
                            <th className="text-right py-2 px-3">LCJ手数料</th>
                            <th className="text-right py-2 px-3">注文数</th>
                            <th className="text-right py-2 px-3">視聴数</th>
                            <th className="text-right py-2 px-3">配信数</th>
                            <th className="text-right py-2 px-3">RPM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tapLiveCreatorsQuery.data || []).map((c: any, i: number) => (
                            <tr key={c.creatorUsername} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                              <td className="py-2 px-3 font-medium">{c.creatorUsername}</td>
                              <td className="py-2 px-3 text-right font-semibold text-red-600">{formatCurrency(c.totalGmv)}</td>
                              <td className="py-2 px-3 text-right text-green-600">{formatCurrency(c.totalPartnerCommission)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(c.totalOrders)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(c.totalViews)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(c.totalSessions)}</td>
                              <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(c.avgRpm)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Live Top Sessions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    LIVE配信ランキング（トップ{tapLiveTopSessionsQuery.data?.length || 0}）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tapLiveTopSessionsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : !tapLiveTopSessionsQuery.data || tapLiveTopSessionsQuery.data.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">データがありません</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-3">#</th>
                            <th className="text-left py-2 px-3">クリエイター</th>
                            <th className="text-left py-2 px-3">配信名</th>
                            <th className="text-right py-2 px-3">GMV</th>
                            <th className="text-right py-2 px-3">LCJ手数料</th>
                            <th className="text-right py-2 px-3">注文数</th>
                            <th className="text-right py-2 px-3">視聴数</th>
                            <th className="text-right py-2 px-3">いいね</th>
                            <th className="text-right py-2 px-3">RPM</th>
                            <th className="text-left py-2 px-3">月</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tapLiveTopSessionsQuery.data || []).map((s: any, i: number) => (
                            <tr key={`${s.liveRoomId}-${i}`} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                              <td className="py-2 px-3 font-medium text-xs">{s.creatorUsername}</td>
                              <td className="py-2 px-3 text-xs max-w-[200px] truncate" title={s.liveName}>{s.liveName || s.liveRoomId}</td>
                              <td className="py-2 px-3 text-right font-semibold text-red-600">{formatCurrency(s.totalGmv)}</td>
                              <td className="py-2 px-3 text-right text-green-600">{formatCurrency(s.totalPartnerCommission)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(s.totalOrders)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(s.totalViews)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(s.totalLikes)}</td>
                              <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(s.avgRpm)}</td>
                              <td className="py-2 px-3 text-xs text-muted-foreground">{s.reportMonth}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== ファイナンス司令塔 分析タブ ===== */}

          {/* 0. ライバー収益分析 */}
          {activeTab === 'tap-creator-profit' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-600" />
                    ライバー収益分析
                    <Badge variant="outline" className="text-xs">司令塔</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">ライバー別のGMV・LCJ手数料・C手数料・純利益・利益率を一覧表示。行クリックで商品別内訳を確認できます。</p>
                </CardHeader>
                <CardContent>
                  {tapCreatorProfitQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : tapCreatorProfitQuery.data && tapCreatorProfitQuery.data.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-2">#</th>
                            <th className="text-left py-2 px-2">ライバー</th>
                            {[
                              { key: 'gmv', label: 'アフィリGMV' },
                              { key: 'brandFee', label: 'ブランド手数料' },
                              { key: 'brandRate', label: 'ブランド手数料率' },
                              { key: 'cFee', label: 'C手数料' },
                              { key: 'cRate', label: 'C手数料率' },
                              { key: 'netProfit', label: 'LCJ手数料(純利益)' },
                              { key: 'netRate', label: 'LCJ手数料率(純利益率)' },
                              { key: 'refundRate', label: '返金率' },
                              { key: 'orders', label: '注文数' },
                              { key: 'productCount', label: '商品数' },
                            ].map(col => (
                              <th key={col.key} className="text-right py-2 px-2 cursor-pointer select-none hover:bg-muted/70 transition-colors" onClick={() => setCreatorTableSort(prev => prev.key === col.key ? { key: col.key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key: col.key, dir: 'desc' })}>
                                <span className="inline-flex items-center gap-0.5">
                                  {col.label}
                                  {creatorTableSort.key === col.key ? (creatorTableSort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                </span>
                              </th>
                            ))}
                            <th className="text-center py-2 px-2">展開</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...(tapCreatorProfitQuery.data as any[])].map((c: any) => {
                            const gmv = Number(c.totalAffiliateGmv) || 0;
                            const lcjFee = Number(c.totalEstimatedPartnerCommission) || 0;
                            const cFee = Number(c.totalEstimatedCreatorCommission) || 0;
                            const brandFee = lcjFee + cFee;
                            const brandRate = gmv > 0 ? (brandFee / gmv * 100) : 0;
                            const cRate = gmv > 0 ? (cFee / gmv * 100) : 0;
                            const netProfit = lcjFee;
                            const netRate = gmv > 0 ? (netProfit / gmv * 100) : 0;
                            const refund = Number(c.totalGmvRefund) || 0;
                            const refundRate = gmv > 0 ? (refund / gmv * 100) : 0;
                            return { ...c, gmv, lcjFee, cFee, brandFee, brandRate, cRate, netProfit, netRate, refundRate };
                          }).sort((a: any, b: any) => {
                            const getVal = (item: any) => {
                              switch (creatorTableSort.key) {
                                case 'gmv': return item.gmv;
                                case 'brandFee': return item.brandFee;
                                case 'brandRate': return item.brandRate;
                                case 'cFee': return item.cFee;
                                case 'cRate': return item.cRate;
                                case 'netProfit': return item.netProfit;
                                case 'netRate': return item.netRate;
                                case 'refundRate': return item.refundRate;
                                case 'orders': return Number(item.totalOrders) || 0;
                                case 'productCount': return Number(item.productCount) || 0;
                                default: return item.netProfit;
                              }
                            };
                            const va = getVal(a), vb = getVal(b);
                            return creatorTableSort.dir === 'desc' ? vb - va : va - vb;
                          }).map((c: any, i: number) => {
                            const { gmv, lcjFee, cFee, brandFee, brandRate, cRate, netProfit, netRate, refundRate } = c;
                            const isExpanded = expandedCreator === c.creatorUsername;
                            return (
                              <React.Fragment key={c.creatorUsername}>
                                <tr
                                  className={`border-b cursor-pointer transition-colors ${isExpanded ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted/30'}`}
                                  onClick={() => setExpandedCreator(isExpanded ? null : c.creatorUsername)}
                                >
                                  <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                                  <td className="py-1.5 px-2 font-medium">
                                    <div className="flex items-center gap-1">
                                      {i < 3 ? [<Crown key="c" className="h-3.5 w-3.5 text-amber-500" />, <Medal key="m" className="h-3.5 w-3.5 text-gray-400" />, <Award key="a" className="h-3.5 w-3.5 text-amber-700" />][i] : null}
                                      {c.creatorUsername}
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-2 text-right">{formatCurrency(gmv)}</td>
                                  <td className="py-1.5 px-2 text-right text-purple-600">{formatCurrency(brandFee)}</td>
                                  <td className="py-1.5 px-2 text-right">{brandRate.toFixed(1)}%</td>
                                  <td className="py-1.5 px-2 text-right text-orange-600">{formatCurrency(cFee)}</td>
                                  <td className="py-1.5 px-2 text-right">{cRate.toFixed(1)}%</td>
                                  <td className="py-1.5 px-2 text-right font-semibold text-blue-600">{formatCurrency(netProfit)}</td>
                                  <td className="py-1.5 px-2 text-right font-semibold" style={{ color: netRate >= 0 ? '#16a34a' : '#dc2626' }}>{netRate.toFixed(1)}%</td>
                                  <td className="py-1.5 px-2 text-right" style={{ color: refundRate > 20 ? '#dc2626' : refundRate > 10 ? '#f59e0b' : 'inherit' }}>{refundRate.toFixed(1)}%</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(c.totalOrders)}</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(c.productCount)}</td>
                                  <td className="py-1.5 px-2 text-center">
                                    <ChevronDown className={`h-3.5 w-3.5 inline transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={13} className="p-0">
                                      <div className="bg-muted/20 border-l-4 border-amber-400 px-4 py-3">
                                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                                          <ShoppingBag className="h-3.5 w-3.5" />
                                          {c.creatorUsername} の商品別内訳
                                        </div>
                                        {tapCreatorProductBreakdownQuery.isLoading ? (
                                          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                        ) : tapCreatorProductBreakdownQuery.data && tapCreatorProductBreakdownQuery.data.length > 0 ? (
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="border-b bg-muted/30">
                                                <th className="text-left py-1.5 px-2">商品名</th>
                                                <th className="text-left py-1.5 px-2">ショップ</th>
                                                {[
                                                  { key: 'gmv', label: 'アフィリGMV' },
                                                  { key: 'brand', label: 'ブランド手数料' },
                                                  { key: 'brandRate', label: 'ブランド手数料率' },
                                                  { key: 'cFee', label: 'C手数料' },
                                                  { key: 'cRate', label: 'C手数料率' },
                                                  { key: 'lcjFee', label: 'LCJ手数料(純利益)' },
                                                  { key: 'lcjRate', label: 'LCJ手数料率(純利益率)' },
                                                  { key: 'orders', label: '注文数' },
                                                ].map(col => (
                                                  <th key={col.key} className="text-right py-1.5 px-2 cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => setDrilldownSort(prev => prev.key === col.key ? { key: col.key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key: col.key, dir: 'desc' })}>
                                                    <span className="inline-flex items-center gap-0.5">
                                                      {col.label}
                                                      {drilldownSort.key === col.key ? (drilldownSort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                                    </span>
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {[...(tapCreatorProductBreakdownQuery.data as any[])].sort((a: any, b: any) => {
                                                const getVal = (item: any) => {
                                                  const g = Number(item.totalAffiliateGmv) || 0;
                                                  const l = Number(item.totalEstimatedPartnerCommission) || 0;
                                                  const c = Number(item.totalEstimatedCreatorCommission) || 0;
                                                  const br = l + c;
                                                  switch (drilldownSort.key) {
                                                    case 'gmv': return g;
                                                    case 'brand': return br;
                                                    case 'brandRate': return g > 0 ? br / g : 0;
                                                    case 'cFee': return c;
                                                    case 'cRate': return g > 0 ? c / g : 0;
                                                    case 'lcjFee': return l;
                                                    case 'lcjRate': return g > 0 ? l / g : 0;
                                                    case 'orders': return Number(item.totalOrders) || 0;
                                                    default: return l;
                                                  }
                                                };
                                                const va = getVal(a), vb = getVal(b);
                                                return drilldownSort.dir === 'desc' ? vb - va : va - vb;
                                              }).map((p: any, j: number) => {
                                                const pGmv = Number(p.totalAffiliateGmv) || 0;
                                                const pLcj = Number(p.totalEstimatedPartnerCommission) || 0;
                                                const pC = Number(p.totalEstimatedCreatorCommission) || 0;
                                                const pBrand = pLcj + pC;
                                                const pBrandRate = pGmv > 0 ? (pBrand / pGmv * 100) : 0;
                                                const pCRate = pGmv > 0 ? (pC / pGmv * 100) : 0;
                                                const pLcjRate = pGmv > 0 ? (pLcj / pGmv * 100) : 0;
                                                return (
                                                  <tr key={j} className="border-b hover:bg-muted/20">
                                                    <td className="py-1 px-2 max-w-[180px] truncate" title={p.productName}>{p.productName}</td>
                                                    <td className="py-1 px-2 text-muted-foreground max-w-[100px] truncate" title={p.shopName}>{p.shopName}</td>
                                                    <td className="py-1 px-2 text-right">{formatCurrency(pGmv)}</td>
                                                    <td className="py-1 px-2 text-right text-purple-600">{formatCurrency(pBrand)}</td>
                                                    <td className="py-1 px-2 text-right">{pBrandRate.toFixed(1)}%</td>
                                                    <td className="py-1 px-2 text-right text-orange-600">{formatCurrency(pC)}</td>
                                                    <td className="py-1 px-2 text-right">{pCRate.toFixed(1)}%</td>
                                                    <td className="py-1 px-2 text-right font-semibold text-blue-600">{formatCurrency(pLcj)}</td>
                                                    <td className="py-1 px-2 text-right font-semibold" style={{ color: pLcjRate >= 0 ? '#16a34a' : '#dc2626' }}>{pLcjRate.toFixed(1)}%</td>
                                                    <td className="py-1 px-2 text-right">{formatNumber(p.totalOrders)}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        ) : (
                                          <p className="text-xs text-muted-foreground py-2">商品データがありません</p>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">データがありません</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 1. 商品利益率ランキング */}
          {activeTab === 'tap-profitability' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Percent className="h-4 w-4 text-amber-600" />
                    商品利益率ランキング
                    <Badge variant="outline" className="text-xs">司令塔</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tapProductsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : tapProductsQuery.data && tapProductsQuery.data.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-2">#</th>
                            <th className="text-left py-2 px-2">商品名</th>
                            <th className="text-left py-2 px-2">ショップ</th>
                            {[
                              { key: 'gmv', label: 'アフィリGMV' },
                              { key: 'brandFee', label: 'ブランド手数料' },
                              { key: 'brandRate', label: 'ブランド手数料率' },
                              { key: 'cFee', label: 'C手数料' },
                              { key: 'cRate', label: 'C手数料率' },
                              { key: 'netProfit', label: 'LCJ手数料(純利益)' },
                              { key: 'netRate', label: 'LCJ手数料率(純利益率)' },
                              { key: 'refundRate', label: '返金率' },
                              { key: 'orders', label: '注文数' },
                            ].map(col => (
                              <th key={col.key} className="text-right py-2 px-2 cursor-pointer select-none hover:bg-muted/70 transition-colors" onClick={() => setProductTableSort(prev => prev.key === col.key ? { key: col.key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key: col.key, dir: 'desc' })}>
                                <span className="inline-flex items-center gap-0.5">
                                  {col.label}
                                  {productTableSort.key === col.key ? (productTableSort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                </span>
                              </th>
                            ))}
                            <th className="text-center py-2 px-2">展開</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...tapProductsQuery.data]
                            .map((p: any) => {
                              const gmv = Number(p.totalAffiliateGmv) || 0;
                              const lcjFee = Number(p.totalEstimatedPartnerCommission) || 0;
                              const cFee = Number(p.totalEstimatedCreatorCommission) || 0;
                              const brandFee = lcjFee + cFee;
                              const brandRate = gmv > 0 ? (brandFee / gmv * 100) : 0;
                              const cRate = gmv > 0 ? (cFee / gmv * 100) : 0;
                              const netProfit = lcjFee;
                              const netRate = gmv > 0 ? (netProfit / gmv * 100) : 0;
                              const refund = Number(p.totalGmvRefund) || 0;
                              const refundRate = gmv > 0 ? (refund / gmv * 100) : 0;
                              return { ...p, gmv, lcjFee, cFee, brandFee, brandRate, cRate, netProfit, netRate, refundRate };
                            })
                            .sort((a: any, b: any) => {
                              const getVal = (item: any) => {
                                switch (productTableSort.key) {
                                  case 'gmv': return item.gmv;
                                  case 'brandFee': return item.brandFee;
                                  case 'brandRate': return item.brandRate;
                                  case 'cFee': return item.cFee;
                                  case 'cRate': return item.cRate;
                                  case 'netProfit': return item.netProfit;
                                  case 'netRate': return item.netRate;
                                  case 'refundRate': return item.refundRate;
                                  case 'orders': return Number(item.totalOrders) || 0;
                                  default: return item.brandFee;
                                }
                              };
                              const va = getVal(a), vb = getVal(b);
                              return productTableSort.dir === 'desc' ? vb - va : va - vb;
                            })
                            .map((p: any, i: number) => {
                              const isProdExpanded = expandedProduct === p.productName;
                              return (
                                <React.Fragment key={i}>
                                  <tr
                                    className={`border-b cursor-pointer transition-colors ${isProdExpanded ? 'bg-violet-50 dark:bg-violet-950/30' : 'hover:bg-muted/30'}`}
                                    onClick={() => setExpandedProduct(isProdExpanded ? null : p.productName)}
                                  >
                                    <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                                    <td className="py-1.5 px-2 font-medium max-w-[200px] truncate" title={p.productName}>{p.productName}</td>
                                    <td className="py-1.5 px-2 text-muted-foreground max-w-[120px] truncate" title={p.shopName}>{p.shopName}</td>
                                    <td className="py-1.5 px-2 text-right">{formatCurrency(p.gmv)}</td>
                                    <td className="py-1.5 px-2 text-right text-purple-600">{formatCurrency(p.brandFee)}</td>
                                    <td className="py-1.5 px-2 text-right">{p.brandRate.toFixed(1)}%</td>
                                    <td className="py-1.5 px-2 text-right text-orange-600">{formatCurrency(p.cFee)}</td>
                                    <td className="py-1.5 px-2 text-right">{p.cRate.toFixed(1)}%</td>
                                    <td className="py-1.5 px-2 text-right font-semibold text-blue-600">{formatCurrency(p.netProfit)}</td>
                                    <td className="py-1.5 px-2 text-right font-semibold" style={{ color: p.netRate >= 0 ? '#16a34a' : '#dc2626' }}>{p.netRate.toFixed(1)}%</td>
                                    <td className="py-1.5 px-2 text-right" style={{ color: p.refundRate > 20 ? '#dc2626' : p.refundRate > 10 ? '#f59e0b' : 'inherit' }}>{p.refundRate.toFixed(1)}%</td>
                                    <td className="py-1.5 px-2 text-right">{formatNumber(p.totalOrders)}</td>
                                    <td className="py-1.5 px-2 text-center">
                                      <ChevronDown className={`h-3.5 w-3.5 inline transition-transform ${isProdExpanded ? 'rotate-180' : ''}`} />
                                    </td>
                                  </tr>
                                  {isProdExpanded && (
                                    <tr>
                                      <td colSpan={13} className="p-0">
                                        <div className="bg-muted/20 border-l-4 border-violet-400 px-4 py-3">
                                          <div className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-2 flex items-center gap-1">
                                            <Users className="h-3.5 w-3.5" />
                                            {p.productName} のライバー別内訳
                                          </div>
                                          {tapProductCreatorBreakdownQuery.isLoading ? (
                                            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                          ) : tapProductCreatorBreakdownQuery.data && tapProductCreatorBreakdownQuery.data.length > 0 ? (
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="border-b bg-muted/30">
                                                  <th className="text-left py-1.5 px-2">ライバー</th>
                                                  {[
                                                    { key: 'gmv', label: 'アフィリGMV' },
                                                    { key: 'brand', label: 'ブランド手数料' },
                                                    { key: 'brandRate', label: 'ブランド手数料率' },
                                                    { key: 'cFee', label: 'C手数料' },
                                                    { key: 'cRate', label: 'C手数料率' },
                                                    { key: 'lcjFee', label: 'LCJ手数料(純利益)' },
                                                    { key: 'lcjRate', label: 'LCJ手数料率(純利益率)' },
                                                    { key: 'orders', label: '注文数' },
                                                  ].map(col => (
                                                    <th key={col.key} className="text-right py-1.5 px-2 cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => setProdDrilldownSort(prev => prev.key === col.key ? { key: col.key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key: col.key, dir: 'desc' })}>
                                                      <span className="inline-flex items-center gap-0.5">
                                                        {col.label}
                                                        {prodDrilldownSort.key === col.key ? (prodDrilldownSort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                                      </span>
                                                    </th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {[...(tapProductCreatorBreakdownQuery.data as any[])].sort((a: any, b: any) => {
                                                  const getVal = (item: any) => {
                                                    const g = Number(item.totalAffiliateGmv) || 0;
                                                    const l = Number(item.totalEstimatedPartnerCommission) || 0;
                                                    const c = Number(item.totalEstimatedCreatorCommission) || 0;
                                                    const br = l + c;
                                                    switch (prodDrilldownSort.key) {
                                                      case 'gmv': return g;
                                                      case 'brand': return br;
                                                      case 'brandRate': return g > 0 ? br / g : 0;
                                                      case 'cFee': return c;
                                                      case 'cRate': return g > 0 ? c / g : 0;
                                                      case 'lcjFee': return l;
                                                      case 'lcjRate': return g > 0 ? l / g : 0;
                                                      case 'orders': return Number(item.totalOrders) || 0;
                                                      default: return l;
                                                    }
                                                  };
                                                  const va = getVal(a), vb = getVal(b);
                                                  return prodDrilldownSort.dir === 'desc' ? vb - va : va - vb;
                                                }).map((cr: any, j: number) => {
                                                  const crGmv = Number(cr.totalAffiliateGmv) || 0;
                                                  const crLcj = Number(cr.totalEstimatedPartnerCommission) || 0;
                                                  const crC = Number(cr.totalEstimatedCreatorCommission) || 0;
                                                  const crBrand = crLcj + crC;
                                                  const crBrandRate = crGmv > 0 ? (crBrand / crGmv * 100) : 0;
                                                  const crCRate = crGmv > 0 ? (crC / crGmv * 100) : 0;
                                                  const crLcjRate = crGmv > 0 ? (crLcj / crGmv * 100) : 0;
                                                  return (
                                                    <tr key={j} className="border-b hover:bg-muted/20">
                                                      <td className="py-1 px-2 font-medium">{cr.creatorUsername}</td>
                                                      <td className="py-1 px-2 text-right">{formatCurrency(crGmv)}</td>
                                                      <td className="py-1 px-2 text-right text-purple-600">{formatCurrency(crBrand)}</td>
                                                      <td className="py-1 px-2 text-right">{crBrandRate.toFixed(1)}%</td>
                                                      <td className="py-1 px-2 text-right text-orange-600">{formatCurrency(crC)}</td>
                                                      <td className="py-1 px-2 text-right">{crCRate.toFixed(1)}%</td>
                                                      <td className="py-1 px-2 text-right font-semibold text-blue-600">{formatCurrency(crLcj)}</td>
                                                      <td className="py-1 px-2 text-right font-semibold" style={{ color: crLcjRate >= 0 ? '#16a34a' : '#dc2626' }}>{crLcjRate.toFixed(1)}%</td>
                                                      <td className="py-1 px-2 text-right">{formatNumber(cr.totalOrders)}</td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          ) : (
                                            <p className="text-xs text-muted-foreground py-2">ライバーデータがありません</p>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">データがありません</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 2. クリエイター×商品ベストマッチ */}
          {activeTab === 'tap-bestmatch' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-amber-600" />
                    クリエイター×商品 ベストマッチ分析
                    <Badge variant="outline" className="text-xs">司令塔</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tapCreatorProductMatrixQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : tapCreatorProductMatrixQuery.data && tapCreatorProductMatrixQuery.data.length > 0 ? (() => {
                    const data = tapCreatorProductMatrixQuery.data as any[];
                    // クリエイターごとにグループ化
                    const creatorMap = new Map<string, any[]>();
                    data.forEach((row: any) => {
                      const key = row.creatorUsername;
                      if (!creatorMap.has(key)) creatorMap.set(key, []);
                      creatorMap.get(key)!.push(row);
                    });
                    // クリエイターを総アフィリGMV順にソート
                    const creators = Array.from(creatorMap.entries())
                      .map(([name, products]) => ({
                        name,
                        products: products.sort((a: any, b: any) => Number(b.totalAffiliateGmv) - Number(a.totalAffiliateGmv)),
                        totalGmv: products.reduce((s: number, p: any) => s + Number(p.totalAffiliateGmv || 0), 0),
                        totalOrders: products.reduce((s: number, p: any) => s + Number(p.totalOrders || 0), 0),
                        totalLcjFee: products.reduce((s: number, p: any) => s + Number(p.totalEstimatedPartnerCommission || 0), 0),
                      }))
                      .sort((a, b) => b.totalGmv - a.totalGmv);
                    return (
                      <div className="space-y-6">
                        {creators.map((creator) => (
                          <div key={creator.name} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Crown className="h-4 w-4 text-amber-500" />
                                <span className="font-semibold text-sm">{creator.name}</span>
                                <Badge variant="secondary" className="text-xs">総GMV: {formatCurrency(creator.totalGmv)}</Badge>
                                <Badge variant="outline" className="text-xs">注文: {formatNumber(creator.totalOrders)}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">TOP商品 {Math.min(creator.products.length, 10)}件</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left py-1.5 px-2">#</th>
                                  <th className="text-left py-1.5 px-2">商品名</th>
                                  <th className="text-left py-1.5 px-2">ショップ</th>
                                  <th className="text-right py-1.5 px-2">アフィリGMV</th>
                                  <th className="text-right py-1.5 px-2">LIVE GMV</th>
                                  <th className="text-right py-1.5 px-2">LCJ手数料</th>
                                  <th className="text-right py-1.5 px-2">注文数</th>
                                  <th className="text-right py-1.5 px-2">CVR</th>
                                  <th className="text-right py-1.5 px-2">RPM</th>
                                </tr>
                              </thead>
                              <tbody>
                                {creator.products.slice(0, 10).map((p: any, i: number) => {
                                  const views = Number(p.totalLiveViews || 0) + Number(p.totalVideoViews || 0);
                                  const orders = Number(p.totalOrders || 0);
                                  const gmv = Number(p.totalAffiliateGmv || 0);
                                  const cvr = views > 0 ? (orders / views * 100) : 0;
                                  const rpm = views > 0 ? (gmv / views * 1000) : 0;
                                  return (
                                    <tr key={i} className="border-b hover:bg-muted/20">
                                      <td className="py-1 px-2 text-muted-foreground">{i + 1}</td>
                                      <td className="py-1 px-2 max-w-[180px] truncate" title={p.productName}>{p.productName}</td>
                                      <td className="py-1 px-2 text-muted-foreground max-w-[100px] truncate" title={p.shopName}>{p.shopName}</td>
                                      <td className="py-1 px-2 text-right font-medium">{formatCurrency(gmv)}</td>
                                      <td className="py-1 px-2 text-right">{formatCurrency(p.totalLiveGmv)}</td>
                                      <td className="py-1 px-2 text-right text-blue-600">{formatCurrency(p.totalEstimatedPartnerCommission)}</td>
                                      <td className="py-1 px-2 text-right">{formatNumber(orders)}</td>
                                      <td className="py-1 px-2 text-right">{cvr.toFixed(2)}%</td>
                                      <td className="py-1 px-2 text-right">{formatCurrency(rpm)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    );
                  })() : (
                    <p className="text-sm text-muted-foreground py-4 text-center">データがありません</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 3. ショップ収益性分析 */}
          {activeTab === 'tap-shop-analysis' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-amber-600" />
                    ショップ収益性分析
                    <Badge variant="outline" className="text-xs">司令塔</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tapShopsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : tapShopsQuery.data && tapShopsQuery.data.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-2">#</th>
                            <th className="text-left py-2 px-2">ショップ名</th>
                            <th className="text-right py-2 px-2">アフィリGMV</th>
                            <th className="text-right py-2 px-2">LCJ手数料(見込)</th>
                            <th className="text-right py-2 px-2">LCJ手数料(実績)</th>
                            <th className="text-right py-2 px-2">返金GMV</th>
                            <th className="text-right py-2 px-2">決済済GMV</th>
                            <th className="text-right py-2 px-2">LCJ手数料率</th>
                            <th className="text-right py-2 px-2">返金率</th>
                            <th className="text-right py-2 px-2">決済率</th>
                            <th className="text-right py-2 px-2">注文数</th>
                            <th className="text-center py-2 px-2">ステータス</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...tapShopsQuery.data]
                            .map((s: any) => {
                              const gmv = Number(s.totalAffiliateGmv) || 0;
                              const lcjFee = Number(s.totalEstimatedPartnerCommission) || 0;
                              const lcjFeeActual = Number(s.totalActualPartnerCommission) || 0;
                              const refund = Number(s.totalGmvRefund) || 0;
                              const settled = Number(s.totalSettledGmv) || 0;
                              const lcjRate = gmv > 0 ? (lcjFee / gmv * 100) : 0;
                              const refundRate = gmv > 0 ? (refund / gmv * 100) : 0;
                              const settledRate = gmv > 0 ? (settled / gmv * 100) : 0;
                              let status: 'good' | 'warning' | 'danger' = 'good';
                              if (refundRate > 20) status = 'danger';
                              else if (refundRate > 10) status = 'warning';
                              return { ...s, gmv, lcjFee, lcjFeeActual, refund, settled, lcjRate, refundRate, settledRate, status };
                            })
                            .sort((a: any, b: any) => b.gmv - a.gmv)
                            .map((s: any, i: number) => (
                              <tr key={i} className={`border-b hover:bg-muted/30 ${s.status === 'danger' ? 'bg-red-50 dark:bg-red-950/20' : s.status === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                                <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                                <td className="py-1.5 px-2 font-medium max-w-[180px] truncate" title={s.shopName}>{s.shopName}</td>
                                <td className="py-1.5 px-2 text-right">{formatCurrency(s.gmv)}</td>
                                <td className="py-1.5 px-2 text-right text-blue-600">{formatCurrency(s.lcjFee)}</td>
                                <td className="py-1.5 px-2 text-right text-green-600">{formatCurrency(s.lcjFeeActual)}</td>
                                <td className="py-1.5 px-2 text-right" style={{ color: s.refundRate > 20 ? '#dc2626' : s.refundRate > 10 ? '#f59e0b' : 'inherit' }}>{formatCurrency(s.refund)}</td>
                                <td className="py-1.5 px-2 text-right">{formatCurrency(s.settled)}</td>
                                <td className="py-1.5 px-2 text-right">{s.lcjRate.toFixed(1)}%</td>
                                <td className="py-1.5 px-2 text-right font-semibold" style={{ color: s.refundRate > 20 ? '#dc2626' : s.refundRate > 10 ? '#f59e0b' : '#16a34a' }}>{s.refundRate.toFixed(1)}%</td>
                                <td className="py-1.5 px-2 text-right">{s.settledRate.toFixed(1)}%</td>
                                <td className="py-1.5 px-2 text-right">{formatNumber(s.totalOrders)}</td>
                                <td className="py-1.5 px-2 text-center">
                                  {s.status === 'danger' ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 mx-auto" /> :
                                   s.status === 'warning' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mx-auto" /> :
                                   <CheckCircle className="h-3.5 w-3.5 text-green-500 mx-auto" />}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">データがありません</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 4. LIVE配信効率分析 */}
          {activeTab === 'tap-live-efficiency' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-600" />
                    LIVE配信効率分析
                    <Badge variant="outline" className="text-xs">司令塔</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tapLiveEfficiencyQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : tapLiveEfficiencyQuery.data && tapLiveEfficiencyQuery.data.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-2">#</th>
                            <th className="text-left py-2 px-2">クリエイター</th>
                            <th className="text-right py-2 px-2">LIVE GMV</th>
                            <th className="text-right py-2 px-2">配信時間</th>
                            <th className="text-right py-2 px-2">GMV/時間</th>
                            <th className="text-right py-2 px-2">注文/時間</th>
                            <th className="text-right py-2 px-2">RPM</th>
                            <th className="text-right py-2 px-2">CVR</th>
                            <th className="text-right py-2 px-2">配信数</th>
                            <th className="text-right py-2 px-2">視聴数</th>
                            <th className="text-right py-2 px-2">注文数</th>
                            <th className="text-right py-2 px-2">商品数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...tapLiveEfficiencyQuery.data]
                            .sort((a: any, b: any) => Number(b.gmvPerHour || 0) - Number(a.gmvPerHour || 0))
                            .map((c: any, i: number) => {
                              const broadcastHours = Number(c.totalBroadcastTime || 0) / 3600;
                              const broadcastDisplay = broadcastHours >= 1 
                                ? `${broadcastHours.toFixed(1)}時間` 
                                : `${Math.round(Number(c.totalBroadcastTime || 0) / 60)}分`;
                              return (
                                <tr key={i} className="border-b hover:bg-muted/30">
                                  <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                                  <td className="py-1.5 px-2 font-medium">{c.creatorUsername}</td>
                                  <td className="py-1.5 px-2 text-right">{formatCurrency(c.totalGmv)}</td>
                                  <td className="py-1.5 px-2 text-right">{broadcastDisplay}</td>
                                  <td className="py-1.5 px-2 text-right font-semibold text-green-600">{formatCurrency(c.gmvPerHour)}</td>
                                  <td className="py-1.5 px-2 text-right">{Number(c.ordersPerHour || 0).toFixed(1)}</td>
                                  <td className="py-1.5 px-2 text-right">{formatCurrency(c.avgRpm)}</td>
                                  <td className="py-1.5 px-2 text-right">{Number(c.cvr || 0).toFixed(2)}%</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(c.totalSessions)}</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(c.totalViews)}</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(c.totalOrders)}</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(c.productCount)}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">データがありません</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 5. 月次成長率トレンド */}
          {activeTab === 'tap-growth' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-amber-600" />
                    月次成長率トレンド
                    <Badge variant="outline" className="text-xs">司令塔</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tapMonthlyQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : tapMonthlyQuery.data && tapMonthlyQuery.data.length > 1 ? (() => {
                    const sorted = [...tapMonthlyQuery.data].sort((a: any, b: any) => a.reportMonth.localeCompare(b.reportMonth));
                    const growthData = sorted.map((m: any, idx: number) => {
                      if (idx === 0) return { ...m, gmvGrowth: null, ordersGrowth: null, creatorsGrowth: null, feeGrowth: null };
                      const prev = sorted[idx - 1];
                      const calcGrowth = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev * 100) : (curr > 0 ? 100 : 0);
                      return {
                        ...m,
                        gmvGrowth: calcGrowth(Number(m.totalAffiliateGmv), Number(prev.totalAffiliateGmv)),
                        ordersGrowth: calcGrowth(Number(m.totalOrders), Number(prev.totalOrders)),
                        creatorsGrowth: calcGrowth(Number(m.creatorCount), Number(prev.creatorCount)),
                        feeGrowth: calcGrowth(Number(m.totalEstimatedPartnerCommission), Number(prev.totalEstimatedPartnerCommission)),
                      };
                    }).reverse();
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-2 px-2">月</th>
                              <th className="text-right py-2 px-2">アフィリGMV</th>
                              <th className="text-right py-2 px-2">GMV成長率</th>
                              <th className="text-right py-2 px-2">LCJ手数料</th>
                              <th className="text-right py-2 px-2">手数料成長率</th>
                              <th className="text-right py-2 px-2">注文数</th>
                              <th className="text-right py-2 px-2">注文成長率</th>
                              <th className="text-right py-2 px-2">クリエイター数</th>
                              <th className="text-right py-2 px-2">C数成長率</th>
                              <th className="text-right py-2 px-2">ショップ数</th>
                              <th className="text-right py-2 px-2">商品数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {growthData.map((m: any, i: number) => {
                              const renderGrowth = (val: number | null) => {
                                if (val === null) return <span className="text-muted-foreground">-</span>;
                                const color = val >= 0 ? '#16a34a' : '#dc2626';
                                const icon = val >= 0 ? '▲' : '▼';
                                return <span style={{ color, fontWeight: 600 }}>{icon} {Math.abs(val).toFixed(1)}%</span>;
                              };
                              return (
                                <tr key={i} className="border-b hover:bg-muted/30">
                                  <td className="py-1.5 px-2 font-medium">{m.reportMonth}</td>
                                  <td className="py-1.5 px-2 text-right">{formatCurrency(m.totalAffiliateGmv)}</td>
                                  <td className="py-1.5 px-2 text-right">{renderGrowth(m.gmvGrowth)}</td>
                                  <td className="py-1.5 px-2 text-right text-blue-600">{formatCurrency(m.totalEstimatedPartnerCommission)}</td>
                                  <td className="py-1.5 px-2 text-right">{renderGrowth(m.feeGrowth)}</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(m.totalOrders)}</td>
                                  <td className="py-1.5 px-2 text-right">{renderGrowth(m.ordersGrowth)}</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(m.creatorCount)}</td>
                                  <td className="py-1.5 px-2 text-right">{renderGrowth(m.creatorsGrowth)}</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(m.shopCount)}</td>
                                  <td className="py-1.5 px-2 text-right">{formatNumber(m.productCount)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })() : (
                    <p className="text-sm text-muted-foreground py-4 text-center">成長率計算には2ヶ月以上のデータが必要です</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAP Video Detail */}
          {activeTab === 'tap-videos' && (
            <div className="space-y-6">
              {/* Video KPI */}
              {tapVideoSummaryQuery.data && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <Card className="border-l-4 border-l-pink-500">
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">動画GMV</div>
                      <p className="text-lg font-bold text-pink-600">{formatCurrency(tapVideoSummaryQuery.data.totalGmv)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">LCJ手数料</div>
                      <p className="text-lg font-semibold text-green-600">{formatCurrency(tapVideoSummaryQuery.data.totalPartnerCommission)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">注文数</div>
                      <p className="text-lg font-semibold">{formatNumber(tapVideoSummaryQuery.data.totalOrders)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">視聴数</div>
                      <p className="text-lg font-semibold">{formatNumber(tapVideoSummaryQuery.data.totalViews)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">動画数</div>
                      <p className="text-lg font-semibold">{formatNumber(tapVideoSummaryQuery.data.totalVideos)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-muted-foreground text-xs mb-1">RPM</div>
                      <p className="text-lg font-semibold text-amber-600">{formatCurrency(tapVideoSummaryQuery.data.avgRpm)}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Video Monthly */}
              {tapVideoMonthlyQuery.data && tapVideoMonthlyQuery.data.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      動画月別推移
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-3">月</th>
                            <th className="text-right py-2 px-3">GMV</th>
                            <th className="text-right py-2 px-3">LCJ手数料</th>
                            <th className="text-right py-2 px-3">注文数</th>
                            <th className="text-right py-2 px-3">視聴数</th>
                            <th className="text-right py-2 px-3">動画数</th>
                            <th className="text-right py-2 px-3">RPM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tapVideoMonthlyQuery.data || []).map((m: any) => (
                            <tr key={m.reportMonth} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-3 font-medium">{m.reportMonth}</td>
                              <td className="py-2 px-3 text-right font-semibold text-pink-600">{formatCurrency(m.totalGmv)}</td>
                              <td className="py-2 px-3 text-right text-green-600">{formatCurrency(m.totalPartnerCommission)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(m.totalOrders)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(m.totalViews)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(m.totalVideos)}</td>
                              <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(m.avgRpm)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Video Creator Ranking */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    動画クリエイター別実績
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tapVideoCreatorsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : !tapVideoCreatorsQuery.data || tapVideoCreatorsQuery.data.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">データがありません</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-3">#</th>
                            <th className="text-left py-2 px-3">クリエイター</th>
                            <th className="text-right py-2 px-3">GMV</th>
                            <th className="text-right py-2 px-3">LCJ手数料</th>
                            <th className="text-right py-2 px-3">注文数</th>
                            <th className="text-right py-2 px-3">視聴数</th>
                            <th className="text-right py-2 px-3">動画数</th>
                            <th className="text-right py-2 px-3">RPM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tapVideoCreatorsQuery.data || []).map((c: any, i: number) => (
                            <tr key={c.creatorUsername} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                              <td className="py-2 px-3 font-medium">{c.creatorUsername}</td>
                              <td className="py-2 px-3 text-right font-semibold text-pink-600">{formatCurrency(c.totalGmv)}</td>
                              <td className="py-2 px-3 text-right text-green-600">{formatCurrency(c.totalPartnerCommission)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(c.totalOrders)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(c.totalViews)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(c.totalVideos)}</td>
                              <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(c.avgRpm)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Video Top Videos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    動画ランキング（トップ{tapVideoTopVideosQuery.data?.length || 0}）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tapVideoTopVideosQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : !tapVideoTopVideosQuery.data || tapVideoTopVideosQuery.data.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">データがありません</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-3">#</th>
                            <th className="text-left py-2 px-3">クリエイター</th>
                            <th className="text-left py-2 px-3">動画名</th>
                            <th className="text-right py-2 px-3">GMV</th>
                            <th className="text-right py-2 px-3">LCJ手数料</th>
                            <th className="text-right py-2 px-3">注文数</th>
                            <th className="text-right py-2 px-3">視聴数</th>
                            <th className="text-right py-2 px-3">いいね</th>
                            <th className="text-right py-2 px-3">RPM</th>
                            <th className="text-left py-2 px-3">月</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tapVideoTopVideosQuery.data || []).map((v: any, i: number) => (
                            <tr key={`${v.videoId}-${i}`} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-3">{i < 3 ? rankIcons[i] : <span className="text-muted-foreground">{i + 1}</span>}</td>
                              <td className="py-2 px-3 font-medium text-xs">{v.creatorUsername}</td>
                              <td className="py-2 px-3 text-xs max-w-[200px] truncate" title={v.videoName}>{v.videoName || v.videoId}</td>
                              <td className="py-2 px-3 text-right font-semibold text-pink-600">{formatCurrency(v.totalGmv)}</td>
                              <td className="py-2 px-3 text-right text-green-600">{formatCurrency(v.totalPartnerCommission)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(v.totalOrders)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(v.totalViews)}</td>
                              <td className="py-2 px-3 text-right">{formatNumber(v.totalLikes)}</td>
                              <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(v.avgRpm)}</td>
                              <td className="py-2 px-3 text-xs text-muted-foreground">{v.reportMonth}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAP Upload Dialog */}
      <Dialog open={tapUploadDialogOpen} onOpenChange={setTapUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="secondary">TAP</Badge>
              TAPデータアップロード
            </DialogTitle>
            <DialogDescription>
              TikTokマーケットプレイスのレポートXLSXファイルをアップロードします。同じ月のデータは上書きされます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">レポート月</label>
              <Select value={tapUploadMonth} onValueChange={setTapUploadMonth}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="月を選択" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">XLSXファイル</label>
              <input
                ref={tapFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleTapXlsxUpload}
                disabled={tapUploading || !tapUploadMonth}
                className="w-full mt-1"
              />
            </div>
            {tapUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                アップロード中...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete TAP Month Confirmation Dialog - Password Protected + Double Confirm */}
      <Dialog open={!!deleteTapMonthDialog} onOpenChange={(open) => { if (!open) { setDeleteTapMonthDialog(null); setDeletePassword(''); setDeleteConfirmStep(0); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              TAPデータの削除
            </DialogTitle>
            <DialogDescription>
              <span className="font-bold text-red-600">{deleteTapMonthDialog}</span>の全TAPデータを削除します。<br />
              この操作は<span className="font-bold text-red-600">元に戻せません</span>。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Step 1: Password Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                パスワードを入力してください
              </label>
              <Input
                type="password"
                placeholder="パスワード"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteConfirmStep(0); }}
                className="max-w-xs"
              />
              {deletePassword.length > 0 && deletePassword !== 'lcj' && (
                <p className="text-xs text-red-500">パスワードが正しくありません</p>
              )}
            </div>

            {/* Step 2: First Confirm */}
            {deletePassword === 'lcj' && deleteConfirmStep === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  本当に削除しますか？（1回目の確認）
                </p>
                <Button variant="destructive" size="sm" className="mt-2" onClick={() => setDeleteConfirmStep(1)}>
                  はい、削除を続行します
                </Button>
              </div>
            )}

            {/* Step 3: Final Confirm */}
            {deletePassword === 'lcj' && deleteConfirmStep === 1 && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200 font-bold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  最終確認：{deleteTapMonthDialog}の全データが完全に削除されます
                </p>
                <Button variant="destructive" size="sm" className="mt-2" onClick={() => { deleteTapMonthDialog && deleteTapMonthMutation.mutate({ brandId: 0, reportMonth: deleteTapMonthDialog }); }} disabled={deleteTapMonthMutation.isPending}>
                  {deleteTapMonthMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  完全に削除する（最終確認）
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTapMonthDialog(null); setDeletePassword(''); setDeleteConfirmStep(0); }}>キャンセル</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSVアップロード</DialogTitle>
            <DialogDescription>TikTokコミッションCSVファイルをアップロードします</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={csvUploading}
              className="w-full"
            />
            {csvUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                アップロード中...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeletePassword(''); setDeleteConfirmStep(0); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              インポートデータの削除
            </DialogTitle>
            <DialogDescription>このインポートに関連する全ての注文データが削除されます。この操作は<span className="font-bold text-red-600">元に戻せません</span>。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                パスワードを入力してください
              </label>
              <Input type="password" placeholder="パスワード" value={deletePassword} onChange={(e) => { setDeletePassword(e.target.value); setDeleteConfirmStep(0); }} className="max-w-xs" />
              {deletePassword.length > 0 && deletePassword !== 'lcj' && <p className="text-xs text-red-500">パスワードが正しくありません</p>}
            </div>
            {deletePassword === 'lcj' && deleteConfirmStep === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />本当に削除しますか？（1回目の確認）</p>
                <Button variant="destructive" size="sm" className="mt-2" onClick={() => setDeleteConfirmStep(1)}>はい、削除を続行します</Button>
              </div>
            )}
            {deletePassword === 'lcj' && deleteConfirmStep === 1 && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200 font-bold flex items-center gap-2"><ShieldAlert className="h-4 w-4" />最終確認：インポートデータが完全に削除されます</p>
                <Button variant="destructive" size="sm" className="mt-2" onClick={() => deleteImportId && deleteMutation.mutate({ importId: deleteImportId })} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}完全に削除する（最終確認）
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeletePassword(''); setDeleteConfirmStep(0); }}>キャンセル</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment CSV Upload Dialog */}
      <Dialog open={paymentUploadDialogOpen} onOpenChange={setPaymentUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>入金CSVアップロード</DialogTitle>
            <DialogDescription>TikTok入金データ（Payment）のCSVファイルをアップロードします</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={paymentFileInputRef}
              type="file"
              accept=".csv"
              onChange={handlePaymentCsvUpload}
              disabled={paymentCsvUploading}
              className="w-full"
            />
            {paymentCsvUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                アップロード中...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart CSV Upload Dialog */}
      <Dialog open={smartUploadDialogOpen} onOpenChange={setSmartUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSVアップロード</DialogTitle>
            <DialogDescription>
              TikTokのCSVファイルをアップロードしてください。コミッションCSVまたは入金CSVを自動判別します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={smartFileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleSmartCsvUpload}
              disabled={smartUploading}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <Badge variant="outline" className="text-xs">CAP</Badge> コミッションCSV: 「サブ注文ID」ヘッダー含む</p>
              <p>• <Badge variant="outline" className="text-xs">入金</Badge> 入金CSV: 「Reference ID」ヘッダー含む</p>
              <p>• <Badge variant="secondary" className="text-xs">TAP</Badge> TAPレポートXLSX: TikTokマーケットプレイスデータ</p>
            </div>
            {smartUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                アップロード中...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* Delete Payment Confirmation Dialog */}
      <Dialog open={deletePaymentDialogOpen} onOpenChange={(open) => { if (!open) { setDeletePaymentDialogOpen(false); setDeletePassword(''); setDeleteConfirmStep(0); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              入金データの削除
            </DialogTitle>
            <DialogDescription>この入金データを削除します。この操作は<span className="font-bold text-red-600">元に戻せません</span>。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                パスワードを入力してください
              </label>
              <Input type="password" placeholder="パスワード" value={deletePassword} onChange={(e) => { setDeletePassword(e.target.value); setDeleteConfirmStep(0); }} className="max-w-xs" />
              {deletePassword.length > 0 && deletePassword !== 'lcj' && <p className="text-xs text-red-500">パスワードが正しくありません</p>}
            </div>
            {deletePassword === 'lcj' && deleteConfirmStep === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />本当に削除しますか？（1回目の確認）</p>
                <Button variant="destructive" size="sm" className="mt-2" onClick={() => setDeleteConfirmStep(1)}>はい、削除を続行します</Button>
              </div>
            )}
            {deletePassword === 'lcj' && deleteConfirmStep === 1 && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200 font-bold flex items-center gap-2"><ShieldAlert className="h-4 w-4" />最終確認：入金データが完全に削除されます</p>
                <Button variant="destructive" size="sm" className="mt-2" onClick={() => deletePaymentId && deletePaymentMutation.mutate({ paymentId: deletePaymentId })} disabled={deletePaymentMutation.isPending}>
                  {deletePaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}完全に削除する（最終確認）
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeletePaymentDialogOpen(false); setDeletePassword(''); setDeleteConfirmStep(0); }}>キャンセル</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CAP/TAP 手数料の考え方 ヘルプダイアログ */}
      <Dialog open={capTapHelpOpen} onOpenChange={setCapTapHelpOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              CAP / TAP 手数料の考え方
            </DialogTitle>
            <DialogDescription>TikTokアフィリエイトの手数料構造を理解するためのガイド</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 text-sm">
            {/* まずCAPとTAPの概念を明確に区別 */}
            <div className="border-2 border-indigo-200 rounded-xl p-5 space-y-4 bg-gradient-to-br from-indigo-50/50 to-white">
              <h3 className="font-bold text-base text-indigo-900 text-center">まず知っておくべき２つの概念</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CAP */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-600 text-white px-2.5 py-1 rounded-md text-xs font-bold">CAP</span>
                    <span className="font-bold text-green-900 text-sm">総契約ルール</span>
                  </div>
                  <p className="text-green-800 text-xs leading-relaxed">LCJ（事務所）とライバー間の<strong>トップレベルの分配契約</strong>です。</p>
                  <div className="bg-green-100/70 rounded p-2 space-y-1">
                    <p className="text-green-900 text-xs font-semibold">CAPが決めること：</p>
                    <ul className="text-green-800 text-xs space-y-0.5 list-disc list-inside">
                      <li>LCJとライバーの<strong>最終的な分配比率</strong></li>
                      <li>どの収益を分配対象にするか</li>
                      <li>最終的に誰がいくら受け取るか</li>
                    </ul>
                  </div>
                  <div className="bg-green-600 text-white rounded-md px-3 py-1.5 text-center text-xs font-bold">→ 「最終的な帰属」を決める総ルール</div>
                </div>
                {/* TAP */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white px-2.5 py-1 rounded-md text-xs font-bold">TAP</span>
                    <span className="font-bold text-blue-900 text-sm">プラットフォーム上の分配設定</span>
                  </div>
                  <p className="text-blue-800 text-xs leading-relaxed">TikTok Affiliate Program。<strong>商品単位・リンク単位</strong>で手数料のPartner/Creator分流を設定する機能です。</p>
                  <div className="bg-blue-100/70 rounded p-2 space-y-1">
                    <p className="text-blue-900 text-xs font-semibold">TAPの特徴：</p>
                    <ul className="text-blue-800 text-xs space-y-0.5 list-disc list-inside">
                      <li><strong>商品単位</strong>・リンク単位の設定</li>
                      <li>TikTokプラットフォーム内の技術的な分配</li>
                      <li>「この手数料をバックエンドでどう振り分けるか」を決定</li>
                    </ul>
                  </div>
                  <div className="bg-blue-600 text-white rounded-md px-3 py-1.5 text-center text-xs font-bold">→ 「プラットフォーム上の経路」を決める実行ツール</div>
                </div>
              </div>
              {/* 二層構造の図解 */}
              <div className="bg-white border border-indigo-200 rounded-lg p-4 space-y-3">
                <h4 className="font-bold text-indigo-900 text-sm text-center">二層構造の関係</h4>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-3 w-full max-w-md">
                    <div className="bg-green-100 border-2 border-green-400 rounded-lg px-4 py-2 flex-1 text-center">
                      <div className="text-xs text-green-600 font-semibold">第1層</div>
                      <div className="font-bold text-green-800">CAP</div>
                      <div className="text-xs text-green-700">最終的な分配を決定</div>
                    </div>
                    <div className="text-indigo-400 font-bold text-lg">≥</div>
                    <div className="bg-blue-100 border-2 border-blue-400 rounded-lg px-4 py-2 flex-1 text-center">
                      <div className="text-xs text-blue-600 font-semibold">第2層</div>
                      <div className="font-bold text-blue-800">TAP</div>
                      <div className="text-xs text-blue-700">プラットフォーム上の経路</div>
                    </div>
                  </div>
                  <p className="text-xs text-indigo-700 text-center bg-indigo-50 rounded-md px-3 py-1.5">つまり、<strong>CAPが「最終的に誰のものか」</strong>を決め、<strong>TAPが「TikTok上でどう流れるか」</strong>を決めます</p>
              </div>
              </div>
            </div>

            {/* 手数料の流れ */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-bold text-base">手数料の流れ（TAPデータの見方）</h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-orange-100 text-orange-800 font-bold px-2 py-1 rounded">ブランド手数料</span>
                  <span className="text-muted-foreground">＝</span>
                  <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded">LCJ手数料</span>
                  <span className="text-muted-foreground">＋</span>
                  <span className="bg-purple-100 text-purple-800 font-bold px-2 py-1 rounded">C手数料</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 mt-2 list-disc list-inside">
                  <li><strong>LCJ手数料</strong> ＝ TikTok上でLCJ（Partner）が受け取る金額</li>
                  <li><strong>C手数料</strong> ＝ TikTok上でライバー（Creator）が受け取る金額</li>
                </ul>
              </div>
            </div>

            {/* 具体例 */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-bold text-base">💡 具体例：1万円の商品を売った場合</h3>
              <p className="text-muted-foreground">ブランドが手数料率 <span className="font-bold text-foreground">40%</span> に設定 → 手数料総額 <span className="font-bold text-foreground">¥4,000</span></p>

              {/* パターン1 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm">パターン①　TAPリンク：LCJ 20% / ライバー 20%</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-orange-100 rounded p-2">
                    <div className="text-xs text-orange-600">ブランド手数料</div>
                    <div className="font-bold text-orange-800">¥4,000</div>
                    <div className="text-xs text-orange-600">（GMVの40%）</div>
                  </div>
                  <div className="bg-blue-100 rounded p-2">
                    <div className="text-xs text-blue-600">LCJ手数料</div>
                    <div className="font-bold text-blue-800">¥2,000</div>
                    <div className="text-xs text-blue-600">（GMVの20%）</div>
                  </div>
                  <div className="bg-purple-100 rounded p-2">
                    <div className="text-xs text-purple-600">C手数料</div>
                    <div className="font-bold text-purple-800">¥2,000</div>
                    <div className="text-xs text-purple-600">（GMVの20%）</div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
                  <span className="bg-orange-200 px-1.5 py-0.5 rounded">ブランド ¥4,000</span>
                  <span>＝</span>
                  <span className="bg-blue-200 px-1.5 py-0.5 rounded">LCJ ¥2,000</span>
                  <span>＋</span>
                  <span className="bg-purple-200 px-1.5 py-0.5 rounded">ライバー ¥2,000</span>
                </div>
              </div>

              {/* パターン2 CAP */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm">パターン②　CAP契約あり（LCJ 30% / ライバー 70%）の場合</h4>
                <p className="text-xs text-muted-foreground">TAPリンク：LCJ 20% / ライバー 20% で発行</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 rounded p-2 flex-1 text-center">
                      <div className="text-xs text-blue-600">TikTokからLCJへ</div>
                      <div className="font-bold text-blue-800">¥2,000</div>
                    </div>
                    <div className="bg-purple-100 rounded p-2 flex-1 text-center">
                      <div className="text-xs text-purple-600">TikTokからライバーへ</div>
                      <div className="font-bold text-purple-800">¥2,000</div>
                    </div>
                  </div>
                  <div className="text-center text-xs text-muted-foreground">↓ CAP契約により C手数料¥2,000 を再分配 ↓</div>
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-100 rounded p-2 flex-1 text-center">
                      <div className="text-xs text-purple-600">ライバー実取り分（70%）</div>
                      <div className="font-bold text-purple-800">¥1,400</div>
                    </div>
                    <div className="bg-blue-100 rounded p-2 flex-1 text-center">
                      <div className="text-xs text-blue-600">LCJ追加取り分（30%）</div>
                      <div className="font-bold text-blue-800">¥600</div>
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-center">
                    <span className="text-xs text-emerald-700">LCJ実際の利益 ＝ LCJ手数料 ¥2,000 ＋ CAP分 ¥600 ＝</span>
                    <span className="font-bold text-emerald-800"> ¥2,600</span>
                  </div>
                </div>
              </div>

              {/* パターン3 CAP 100% */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm">パターン③　CAP契約（LCJ 0% / ライバー 100%）の場合</h4>
                <p className="text-xs text-muted-foreground">TAPリンク：LCJ 0% / ライバー 40% で発行</p>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-blue-100 rounded p-2">
                    <div className="text-xs text-blue-600">LCJ手数料</div>
                    <div className="font-bold text-blue-800">¥0</div>
                    <div className="text-xs text-blue-600">（0%）</div>
                  </div>
                  <div className="bg-purple-100 rounded p-2">
                    <div className="text-xs text-purple-600">C手数料（ライバー全額）</div>
                    <div className="font-bold text-purple-800">¥4,000</div>
                    <div className="text-xs text-purple-600">（40%）</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">※ この場合、TikTok上のLCJ手数料は¥0ですが、CAP契約の内容次第でLCJの取り分が発生する場合があります</p>
              </div>
            </div>

            {/* 本画面の数値について */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <h3 className="font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                本画面の数値について
              </h3>
              <ul className="text-amber-800 space-y-1 list-disc list-inside">
                <li><strong>LCJ手数料</strong> ＝ TikTok上でLCJが受け取る金額（CAP契約による追加収益は含まれません）</li>
                <li><strong>C手数料</strong> ＝ TikTok上でライバーが受け取る金額</li>
                <li><strong>ブランド手数料</strong> ＝ LCJ手数料 ＋ C手数料（ブランドが設定した総手数料）</li>
                <li>返金によりGMVが減少し、手数料率が実際の設定値と異なる場合があります</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
