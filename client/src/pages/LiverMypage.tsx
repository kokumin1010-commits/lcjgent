import { useState, useMemo, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { clearLiverToken } from "@/lib/liverAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Plus, 
  LogOut, 
  ChevronRight,
  Video,
  Eye,
  ShoppingCart,
  Settings,
  Link2,
  Users,
  Sparkles,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Trash2,
  History,
  Zap,
  Target,
  Edit,
  ExternalLink,
  HelpCircle,
  ArrowLeft,
  Info,
  Package
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { SiTiktok, SiInstagram, SiYoutube } from "react-icons/si";
import { toast } from "sonner";
import { GoalAchievedConfetti } from "@/components/Confetti";
import LiverReferralCard from "@/components/LiverReferralCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLiverT, type LiverLanguage } from "@/lib/liverI18n";

export default function LiverMypage() {
  const [, navigate] = useLocation();
  const { language, setLanguage } = useLanguage();
  const lt = createLiverT(language as LiverLanguage);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showAllLivestreams, setShowAllLivestreams] = useState(false);
  const [showCsvImportDialog, setShowCsvImportDialog] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showImportHistoryDialog, setShowImportHistoryDialog] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showGoalNudgePopup, setShowGoalNudgePopup] = useState(false);
  const [goalSalesInput, setGoalSalesInput] = useState('');
  const [goalStreamCountInput, setGoalStreamCountInput] = useState('');
  
  // Get current liver info with caching to prevent unnecessary refetches
  const { data: liverInfo, isLoading: isLoadingLiver, isError: isLiverError, isFetching: isLiverFetching } = trpc.liver.me.useQuery(undefined, {
    staleTime: 30 * 60 * 1000, // 30 minutes - longer cache to prevent refetch during operations
    gcTime: 60 * 60 * 1000, // 1 hour - keep in cache longer
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch when component mounts if data exists
    refetchOnReconnect: false, // Don't refetch on reconnect
    retry: 1,
  });

  // 目標未設定時のポップアップ表示（当月の目標が未設定の場合、毎回表示）
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const { data: currentMonthGoal } = trpc.liver.getGoal.useQuery(
    { yearMonth: currentMonth },
    { enabled: !!liverInfo?.id }
  );
  useEffect(() => {
    if (liverInfo && currentMonthGoal !== undefined) {
      const hasGoal = currentMonthGoal && currentMonthGoal.salesGoal && currentMonthGoal.salesGoal > 0;
      if (!hasGoal) {
        // 少し遅延させてから表示（ページ読み込み後0.8秒）
        const timer = setTimeout(() => setShowGoalNudgePopup(true), 800);
        return () => clearTimeout(timer);
      }
    }
  }, [liverInfo, currentMonthGoal]);

  // 目標達成お祝いアニメーション用のstate
  const [showSalesConfetti, setShowSalesConfetti] = useState(false);
  const [showStreamCountConfetti, setShowStreamCountConfetti] = useState(false);
  const [celebratedSalesGoal, setCelebratedSalesGoal] = useState<string | null>(null);
  const [celebratedStreamCountGoal, setCelebratedStreamCountGoal] = useState<string | null>(null);
  
  // Track if we've successfully loaded liver info at least once
  const [hasLoadedLiver, setHasLoadedLiver] = useState(false);

  // Aitherhub未連携バナーの非表示状態
  const [dismissedAitherhubBanner, setDismissedAitherhubBanner] = useState(() => {
    try { return localStorage.getItem('aitherhub_banner_dismissed') === 'true'; } catch { return false; }
  });
  
  useEffect(() => {
    if (liverInfo && !hasLoadedLiver) {
      setHasLoadedLiver(true);
      // DBのlanguage設定を自動適用
      if (liverInfo.language && liverInfo.language !== language) {
        setLanguage(liverInfo.language as LiverLanguage);
      }
    }
  }, [liverInfo, hasLoadedLiver]);
  
  // Get liver's livestream history (全期間取得)
  const { data: livestreams, isLoading: isLoadingLivestreams, refetch: refetchLivestreams } = trpc.liverManagement.getLivestreams.useQuery(
    { liverId: liverInfo?.id || 0 },
    { enabled: !!liverInfo?.id }
  );

  // 配信履歴削除用
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState(false);
  const deleteLivestreamMutation = trpc.liverManagement.deleteLivestream.useMutation({
    onSuccess: () => {
      toast.success(lt('stream.deleted'));
      refetchLivestreams();
      setDeleteTargetId(null);
    },
    onError: (error: any) => {
      toast.error(`${lt('stream.deleteError')}: ${error.message}`);
    },
  });

  const logoutMutation = trpc.liver.logout.useMutation({
    onSuccess: () => {
      clearLiverToken();
      navigate("/liver/login");
    },
  });

  // Get goal for current month
  const { data: currentGoal, refetch: refetchGoal } = trpc.liver.getGoal.useQuery(
    { yearMonth: selectedMonth },
    { enabled: !!liverInfo?.id }
  );

  // Set goal mutation
  const setGoalMutation = trpc.liver.setGoal.useMutation({
    onSuccess: () => {
      refetchGoal();
      setShowGoalDialog(false);
    },
  });

  // Get import history
  const { data: importHistory, refetch: refetchImportHistory } = trpc.csvImport.getImportHistory.useQuery(
    { liverId: liverInfo?.id || 0 },
    { enabled: !!liverInfo?.id }
  );

  // Delete import history mutation
  const deleteImportHistoryMutation = trpc.csvImport.deleteImportHistory.useMutation({
    onSuccess: () => {
      refetchImportHistory();
      window.location.reload();
    },
  });

  const csvImportMutation = trpc.csvImport.importLivestreams.useMutation({
    onSuccess: (result) => {
      setCsvImportResult(result);
      setIsImporting(false);
      // Refresh livestreams data
      window.location.reload();
    },
    onError: (error) => {
      setCsvImportResult({ created: 0, updated: 0, errors: [error.message] });
      setIsImporting(false);
    },
  });

  // Parse Excel/CSV file and convert to data array
  const parseExcelFile = async (file: File): Promise<Array<{
    livestream: string;
    startTime: string;
    duration: number;
    grossRevenue: number;
    directGmv: number;
    itemsSold: number;
    customers: number;
    avgPrice: number;
    ordersPaidFor: number;
    gmvPer1kShows: string;
    gmvPer1kViews: string;
    views: number;
    viewers: number;
    peakViewers: number;
    newFollowers: number;
    avgViewDuration: number;
    likes: number;
    comments: number;
    shares: number;
    productImpressions: number;
    productClicks: number;
    ctr: string;
    ctor: string;
  }>> => {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
    
    // Find the actual header row (contains "Start time")
    let headerRowIndex = -1;
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (Array.isArray(row) && row.some(cell => String(cell).includes('Start time'))) {
        headerRowIndex = i;
        break;
      }
    }
    
    // Skip rows before and including header
    const dataRows = headerRowIndex >= 0 ? jsonData.slice(headerRowIndex + 1) : jsonData.slice(1);
    
    return dataRows.map((row: unknown[]) => {
      // Parse duration string (e.g., "64714" seconds)
      const durationSeconds = Number(row[2]) || 0;
      // Parse avg view duration (e.g., "00:00:35" format or seconds)
      let avgViewDuration = 0;
      const avgViewDurationRaw = row[15];
      if (typeof avgViewDurationRaw === 'string' && avgViewDurationRaw.includes(':')) {
        const parts = avgViewDurationRaw.split(':').map(Number);
        avgViewDuration = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      } else {
        avgViewDuration = Number(avgViewDurationRaw) || 0;
      }
      
      // Helper to parse currency values (e.g., "465,605円" -> 465605)
      const parseCurrency = (value: unknown): number => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          // Remove 円, ￥, $, commas, and whitespace
          const cleaned = value.replace(/[円￥$,\s]/g, '');
          return Number(cleaned) || 0;
        }
        return 0;
      };
      
      return {
        livestream: String(row[0] || ''),
        startTime: String(row[1] || ''),
        duration: durationSeconds,
        grossRevenue: parseCurrency(row[3]),
        directGmv: parseCurrency(row[4]),
        itemsSold: Number(row[5]) || 0,
        customers: Number(row[6]) || 0,
        avgPrice: parseCurrency(row[7]),
        ordersPaidFor: Number(row[8]) || 0,
        gmvPer1kShows: String(row[9] || '0'),
        gmvPer1kViews: String(row[10] || '0'),
        views: Number(row[11]) || 0,
        viewers: Number(row[12]) || 0,
        peakViewers: Number(row[13]) || 0,
        newFollowers: Number(row[14]) || 0,
        avgViewDuration,
        likes: Number(row[16]) || 0,
        comments: Number(row[17]) || 0,
        shares: Number(row[18]) || 0,
        productImpressions: Number(row[19]) || 0,
        productClicks: Number(row[20]) || 0,
        ctr: String(row[21] || '0%'),
        ctor: String(row[22] || '0%'),
      };
    }).filter(row => row.startTime); // Filter out empty rows
  };

  const handleCsvFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !liverInfo) return;
    
    setIsImporting(true);
    setCsvImportResult(null);
    
    try {
      const csvData = await parseExcelFile(file);
      
      if (csvData.length === 0) {
        setCsvImportResult({ created: 0, updated: 0, errors: [lt('csv.noDataFound')] });
        setIsImporting(false);
        return;
      }
      
      // Get brand ID from first livestream or use default
      const brandId = livestreams?.[0]?.brandId || 1;
      
      csvImportMutation.mutate({
        brandId,
        liverId: liverInfo.id,
        csvData,
      });
    } catch (error) {
      setCsvImportResult({ created: 0, updated: 0, errors: [error instanceof Error ? error.message : lt('csv.readFailed')] });
      setIsImporting(false);
    }
  };

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    if (!livestreams) return { sales: 0, gmv: 0, hours: 0, count: 0, avgSales: 0, viewerCount: 0, orderCount: 0 };
    
    const [year, month] = selectedMonth.split("-").map(Number);
    type LivestreamRecord = { 
      livestreamDate: string | Date; 
      livestreamEndTime?: string | Date | null; 
      salesAmount?: number | null;
      gmv?: number | null;
      duration?: number | null;
      viewerCount?: number | null;
      orderCount?: number | null;
    };
    const filtered = livestreams.filter((ls: LivestreamRecord) => {
      const date = new Date(ls.livestreamDate);
      const jstYear = parseInt(date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric' }));
      const jstMonth = parseInt(date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric' }));
      return jstYear === year && jstMonth === month;
    });

    const sales = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.salesAmount || 0), 0);
    const gmv = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.gmv || 0), 0);
    const viewerCount = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.viewerCount || 0), 0);
    const orderCount = filtered.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.orderCount || 0), 0);
    
    const hours = filtered.reduce((sum: number, ls: LivestreamRecord) => {
      // start/endからの計算を優先（各カード表示と一致させる）
      if (ls.livestreamDate && ls.livestreamEndTime) {
        const start = new Date(ls.livestreamDate).getTime();
        const end = new Date(ls.livestreamEndTime).getTime();
        let diffMs = end - start;
        // 終了が開始より前の場合、日付をまたいでいる可能性 → 24時間加算
        if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours > 0 && diffHours < 24) return sum + diffHours;
      }
      // durationはフォールバックとして使用
      if (ls.duration && ls.duration > 0) {
        return sum + (ls.duration / 60);
      }
      return sum;
    }, 0);

    const avgSales = filtered.length > 0 ? Math.round(sales / filtered.length) : 0;

    return { 
      sales, 
      gmv,
      // マイナス値は0として表示
      hours: Math.max(0, Math.round(hours * 10) / 10), 
      count: filtered.length,
      avgSales,
      viewerCount,
      orderCount
    };
  }, [livestreams, selectedMonth]);

  // 目標達成時にお祝いアニメーションをトリガー
  useEffect(() => {
    if (!currentGoal || !monthlyStats) return;
    
    const goalKey = `${selectedMonth}-${currentGoal.salesGoal}-${currentGoal.streamCountGoal}`;
    
    // 売上目標達成チェック
    if (currentGoal.salesGoal && currentGoal.salesGoal > 0) {
      const salesAchieved = monthlyStats.sales >= currentGoal.salesGoal;
      const salesGoalKey = `sales-${selectedMonth}-${currentGoal.salesGoal}`;
      
      if (salesAchieved && celebratedSalesGoal !== salesGoalKey) {
        // ローカルストレージで既にお祝い済みかチェック
        const celebratedKey = `celebrated_${salesGoalKey}`;
        if (!localStorage.getItem(celebratedKey)) {
          setShowSalesConfetti(true);
          setCelebratedSalesGoal(salesGoalKey);
          localStorage.setItem(celebratedKey, 'true');
        } else {
          setCelebratedSalesGoal(salesGoalKey);
        }
      }
    }
    
    // 配信回数目標達成チェック
    if (currentGoal.streamCountGoal && currentGoal.streamCountGoal > 0) {
      const streamCountAchieved = monthlyStats.count >= currentGoal.streamCountGoal;
      const streamCountGoalKey = `stream-${selectedMonth}-${currentGoal.streamCountGoal}`;
      
      if (streamCountAchieved && celebratedStreamCountGoal !== streamCountGoalKey) {
        const celebratedKey = `celebrated_${streamCountGoalKey}`;
        if (!localStorage.getItem(celebratedKey)) {
          // 売上目標と同時に達成した場合は少し遅らせる
          setTimeout(() => {
            setShowStreamCountConfetti(true);
          }, showSalesConfetti ? 2000 : 0);
          setCelebratedStreamCountGoal(streamCountGoalKey);
          localStorage.setItem(celebratedKey, 'true');
        } else {
          setCelebratedStreamCountGoal(streamCountGoalKey);
        }
      }
    }
  }, [currentGoal, monthlyStats, selectedMonth, celebratedSalesGoal, celebratedStreamCountGoal, showSalesConfetti]);

  // Filter livestreams by selected month
  const filteredLivestreams = useMemo(() => {
    if (!livestreams) return [];
    
    const [year, month] = selectedMonth.split("-").map(Number);
    return livestreams
      .filter((ls: { livestreamDate: string | Date }) => {
        const date = new Date(ls.livestreamDate);
        const jstYear = parseInt(date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric' }));
        const jstMonth = parseInt(date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric' }));
        return jstYear === year && jstMonth === month;
      })
      .sort((a: { livestreamDate: string | Date }, b: { livestreamDate: string | Date }) => new Date(b.livestreamDate).getTime() - new Date(a.livestreamDate).getTime());
  }, [livestreams, selectedMonth]);

  // Generate month options
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    
    const monthsWithData = new Set<string>();
    if (livestreams) {
      livestreams.forEach((ls: { livestreamDate: string | Date }) => {
        const date = new Date(ls.livestreamDate);
        const jstYear = parseInt(date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric' }));
        const jstMonth = parseInt(date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric' }));
        const value = `${jstYear}-${String(jstMonth).padStart(2, "0")}`;
        monthsWithData.add(value);
      });
    }
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = language === "en" ? `${date.getFullYear()}/${date.getMonth() + 1}` : `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    
    monthsWithData.forEach(monthValue => {
      if (!options.find(o => o.value === monthValue)) {
        const [year, month] = monthValue.split("-").map(Number);
        options.push({ value: monthValue, label: language === "en" ? `${year}/${month}` : `${year}年${month}月` });
      }
    });
    
    options.sort((a, b) => b.value.localeCompare(a.value));
    return options;
  }, [livestreams]);

  // Calculate all-time stats
  const allTimeStats = useMemo(() => {
    if (!livestreams) return { totalSales: 0, totalHours: 0, totalCount: 0 };
    
    type LivestreamRecord = { 
      livestreamDate: string | Date; 
      livestreamEndTime?: string | Date | null; 
      salesAmount?: number | null;
      duration?: number | null;
    };
    
    const totalSales = livestreams.reduce((sum: number, ls: LivestreamRecord) => sum + (ls.salesAmount || 0), 0);
    const totalHours = livestreams.reduce((sum: number, ls: LivestreamRecord) => {
      // start/endからの計算を優先（日付またぎ対応）
      if (ls.livestreamDate && ls.livestreamEndTime) {
        const start = new Date(ls.livestreamDate).getTime();
        const end = new Date(ls.livestreamEndTime).getTime();
        let diffMs = end - start;
        // 終了が開始より前の場合、日付をまたいでいる可能性 → 24時間加算
        if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours > 0 && diffHours < 24) return sum + diffHours;
      }
      if (ls.duration && ls.duration > 0) {
        return sum + (ls.duration / 60);
      }
      return sum;
    }, 0);

    return { 
      totalSales, 
      // マイナス値は0として表示
      totalHours: Math.max(0, Math.round(totalHours * 10) / 10), 
      totalCount: livestreams.length 
    };
  }, [livestreams]);

  const displayedLivestreams = showAllLivestreams 
    ? filteredLivestreams 
    : filteredLivestreams.slice(0, 10);

  // Only show loading on initial load, not during refetches
  if (isLoadingLiver && !hasLoadedLiver) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only show login prompt if we've never loaded liver info and current data is null
  // This prevents redirecting during background refetches
  if (!liverInfo && !hasLoadedLiver && !isLoadingLiver && !isLiverFetching) {
    // If there was an error OR liverInfo is null (not authenticated), show login prompt
    // Note: liverInfo being null means the server returned null, which indicates no valid session
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-white text-center">{lt("mypage.loginRequired")}</p>
        <Button onClick={() => navigate("/liver/login")} className="bg-red-600 hover:bg-red-700">
          {lt("mypage.goToLogin")}
        </Button>
      </div>
    );
  }

  // If liverInfo is null at this point, show a loading spinner
  // This handles the edge case where hasLoadedLiver is true but liverInfo became null
  if (!liverInfo) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* 目標達成お祝いアニメーション */}
      <GoalAchievedConfetti 
        trigger={showSalesConfetti} 
        onComplete={() => setShowSalesConfetti(false)} 
      />
      <GoalAchievedConfetti 
        trigger={showStreamCountConfetti} 
        onComplete={() => setShowStreamCountConfetti(false)} 
      />
      
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-white">{lt("mypage.title")}</h1>
          <div className="flex items-center gap-1">
            <Link href="/liver/coach">
              <Button variant="ghost" size="sm" className="text-yellow-400 hover:text-yellow-300 text-xs px-2 border border-yellow-500/30 bg-yellow-500/10">
                <Zap className="h-4 w-4 mr-1" />
                神コーチ
              </Button>
            </Link>
            <Link href="/livers">
              <Button variant="ghost" size="sm" className="text-white hover:text-white text-xs px-2">
                <Users className="h-4 w-4 mr-1" />
                {lt("common.list")}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="text-white hover:text-red-400 h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Profile Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-red-500/50">
                <AvatarImage src={liverInfo.avatarUrl || undefined} />
                <AvatarFallback 
                  className="text-xl font-bold text-white"
                  style={{ backgroundColor: liverInfo.color || "#EF4444" }}
                >
                  {liverInfo.name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold truncate text-white">{liverInfo.name}</h2>
                  {/* Aitherhub Badge - 名前の横に目立つ位置 */}
                  {liverInfo.aitherhubLinked && (
                    <a
                      href="https://aitherhub.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/40 border border-violet-400/60 rounded-full text-[10px] font-semibold text-violet-200 hover:bg-violet-500/60 hover:text-white transition-all"
                    >
                      <Sparkles className="w-3 h-3 text-violet-300" />
                      Aitherhub
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-white mt-0.5">ID: {liverInfo.id}</p>
                {/* SNS Links */}
                <div className="flex items-center gap-3 mt-2">
                  {liverInfo.tiktokAccount && (
                    <a 
                      href={liverInfo.tiktokAccount.startsWith('http') ? liverInfo.tiktokAccount : `https://www.tiktok.com/${liverInfo.tiktokAccount.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-white transition-colors"
                    >
                      <SiTiktok className="w-4 h-4" />
                    </a>
                  )}
                  {liverInfo.instagramAccount && (
                    <a 
                      href={liverInfo.instagramAccount.startsWith('http') ? liverInfo.instagramAccount : `https://www.instagram.com/${liverInfo.instagramAccount.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-pink-400 transition-colors"
                    >
                      <SiInstagram className="w-4 h-4" />
                    </a>
                  )}
                  {liverInfo.youtubeAccount && (
                    <a 
                      href={liverInfo.youtubeAccount.startsWith('http') ? liverInfo.youtubeAccount : `https://www.youtube.com/${liverInfo.youtubeAccount}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-red-500 transition-colors"
                    >
                      <SiYoutube className="w-4 h-4" />
                    </a>
                  )}
                  {liverInfo.otherAccount && (
                    <a 
                      href={liverInfo.otherAccount.startsWith('http') ? liverInfo.otherAccount : `https://${liverInfo.otherAccount}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-blue-400 transition-colors"
                    >
                      <Link2 className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
              <Link href="/liver/profile">
                <Button variant="ghost" size="icon" className="text-white hover:text-white h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Aitherhub未連携案内バナー */}
        {!liverInfo.aitherhubLinked && !dismissedAitherhubBanner && (
          <Card className="bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-purple-600/20 border-violet-500/40 relative overflow-hidden">
            <button
              onClick={() => {
                setDismissedAitherhubBanner(true);
                try { localStorage.setItem('aitherhub_banner_dismissed', 'true'); } catch {}
              }}
              className="absolute top-2 right-2 text-white hover:text-white transition-colors z-10"
              aria-label={lt("common.close")}
            >
              <X className="w-4 h-4" />
            </button>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-10 h-10 rounded-full bg-violet-600/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white mb-1">{lt("aitherhub.connectTitle")}</h3>
                  <p className="text-xs text-white leading-relaxed">
                    {lt("aitherhub.connectDescription")}
                  </p>
                  <a
                    href="https://aitherhub.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-full text-xs font-medium text-white transition-colors"
                  >
                    {lt("aitherhub.viewLink")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 紹介コードカード */}
        <LiverReferralCard />

        {/* Goal Progress Card - マイページトップに目標設定 */}
        <Card className="bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-red-600/20 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-400" />
                <span className="text-sm font-bold text-white">{lt("goal.title")}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGoalSalesInput(currentGoal?.salesGoal?.toString() || '');
                  setGoalStreamCountInput(currentGoal?.streamCountGoal?.toString() || '');
                  setShowGoalDialog(true);
                }}
                className="text-purple-400 hover:text-purple-300 h-7 px-2"
              >
                <Edit className="h-3 w-3 mr-1" />
                {currentGoal?.salesGoal ? lt('common.edit') : lt('common.settings')}
              </Button>
            </div>
            
            {currentGoal?.salesGoal ? (
              <>
                {/* 売上目標 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white">{lt("goal.salesGoal")}</span>
                    <span className="text-white">
                      ¥{Number(monthlyStats.sales).toLocaleString()} / ¥{Number(currentGoal.salesGoal).toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, (monthlyStats.sales / currentGoal.salesGoal) * 100)} 
                    className="h-2 bg-gray-700"
                  />
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className={monthlyStats.sales >= currentGoal.salesGoal ? 'text-green-400' : 'text-purple-400'}>
                      {Math.round((monthlyStats.sales / currentGoal.salesGoal) * 100)}% {lt("goal.percentAchieved")}
                    </span>
                    {monthlyStats.sales >= currentGoal.salesGoal ? (
                      <span className="text-green-400">🎉 {lt("goal.achieved")}</span>
                    ) : (
                      <span className="text-white">
                        {lt("goal.remaining")} ¥{Number(currentGoal.salesGoal - monthlyStats.sales).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* 配信回数目標 */}
                {currentGoal.streamCountGoal && currentGoal.streamCountGoal > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white">{lt("goal.streamCountGoal")}</span>
                      <span className="text-white">
                        {monthlyStats.count} / {currentGoal.streamCountGoal}{lt("goal.times")}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (monthlyStats.count / currentGoal.streamCountGoal) * 100)} 
                      className="h-2 bg-gray-700"
                    />
                    <div className="flex justify-between text-[10px] mt-1">
                      <span className={monthlyStats.count >= currentGoal.streamCountGoal ? 'text-green-400' : 'text-blue-400'}>
                        {Math.round((monthlyStats.count / currentGoal.streamCountGoal) * 100)}% {lt("goal.percentAchieved")}
                      </span>
                      {monthlyStats.count >= currentGoal.streamCountGoal ? (
                        <span className="text-green-400">🎉 {lt("goal.achieved")}</span>
                      ) : (
                        <span className="text-white">
                          {lt("goal.remaining")} {currentGoal.streamCountGoal - monthlyStats.count}{lt("goal.times")}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-white text-sm">{lt("goal.setMotivation")}</p>
                <p className="text-white text-xs mt-1">{lt("goal.setHint")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Month Selector & Action Buttons */}
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="flex-1 bg-gray-800 border-gray-700 text-white h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="hover:bg-gray-700">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => navigate(`/s`)}
            size="sm"
            className="bg-gray-700 hover:bg-gray-600 text-white h-10 px-3"
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => navigate(`/liver/record`)}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white h-10 px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Monthly Stats Grid */}
        {monthlyStats.count === 0 ? (
          <Card className="bg-gray-800/30 border-gray-700 border-dashed">
            <CardContent className="p-6 text-center">
              <Video className="h-8 w-8 mx-auto text-white/70 mb-2" />
              <p className="text-white text-sm">{lt("mypage.noStreamRecords")}</p>
              <p className="text-white text-xs mt-1">{lt("mypage.addStreamHint")}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gradient-to-br from-red-600/20 to-red-800/20 border-red-500/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-red-400 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs">{lt("mypage.monthlySales")}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">¥{Number(monthlyStats.sales).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-blue-400 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">{lt("mypage.streamTime")}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{monthlyStats.hours}h</p>
                </CardContent>
              </Card>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-2 text-center">
                  <Video className="h-3 w-3 mx-auto text-white mb-1" />
                  <p className="text-lg font-bold text-white">{monthlyStats.count}</p>
                  <p className="text-[10px] text-white">{lt("mypage.streamCount")}</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-2 text-center">
                  <DollarSign className="h-3 w-3 mx-auto text-white mb-1" />
                  <p className="text-lg font-bold text-white">¥{Math.round(monthlyStats.avgSales / 1000)}k</p>
                  <p className="text-[10px] text-white">{lt("mypage.average")}</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-2 text-center">
                  <Eye className="h-3 w-3 mx-auto text-white mb-1" />
                  <p className="text-lg font-bold text-white">{Number(monthlyStats.viewerCount).toLocaleString()}</p>
                  <p className="text-[10px] text-white">{lt("mypage.viewers")}</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-2 text-center">
                  <ShoppingCart className="h-3 w-3 mx-auto text-white mb-1" />
                  <p className="text-lg font-bold text-white">{Number(monthlyStats.orderCount).toLocaleString()}</p>
                  <p className="text-[10px] text-white">{lt("mypage.orders")}</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Power Dashboard Link */}
        <Link href="/liver/dashboard" className="block">
          <Card className="bg-gradient-to-r from-yellow-600/20 via-orange-600/20 to-red-600/20 border-yellow-500/30 hover:border-yellow-400/50 transition-all cursor-pointer">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{lt("dashboard.powerTitle")}</p>
                  <p className="text-xs text-white">{lt("dashboard.powerDescription")}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white" />
            </CardContent>
          </Card>
        </Link>

        {/* Sample Request Link */}
        <Link href="/liver/sample-request" className="block">
          <Card className="bg-gradient-to-r from-emerald-600/20 via-teal-600/20 to-cyan-600/20 border-emerald-500/30 hover:border-emerald-400/50 transition-all cursor-pointer">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{language === 'en' ? 'Sample Request' : language === 'zh-TW' ? '\u6A23\u54C1\u7533\u8ACB' : '\u30B5\u30F3\u30D7\u30EB\u8ACB\u6C42'}</p>
                  <p className="text-xs text-white">{language === 'en' ? 'Request product samples with your credits' : language === 'zh-TW' ? '\u4F7F\u7528\u4FE1\u7528\u984D\u5EA6\u7533\u8ACB\u7522\u54C1\u6A23\u54C1' : '\u30AF\u30EC\u30B8\u30C3\u30C8\u3092\u4F7F\u3063\u3066\u5546\u54C1\u30B5\u30F3\u30D7\u30EB\u3092\u7533\u8ACB'}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white" />
            </CardContent>
          </Card>
        </Link>

        {/* LCJ Product Catalog Link */}
        <Link href="/liver/products" className="block">
          <Card className="bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-blue-600/20 border-purple-500/30 hover:border-purple-400/50 transition-all cursor-pointer">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{language === 'en' ? 'LCJ Product Catalog' : language === 'zh-TW' ? 'LCJ\u5546\u54c1\u76ee\u9304' : 'LCJ \u5546\u54c1\u30ab\u30bf\u30ed\u30b0'}</p>
                  <p className="text-xs text-white">{language === 'en' ? 'Browse all LCJ products' : language === 'zh-TW' ? '\u700f\u89bd\u6240\u6709LCJ\u5546\u54c1' : 'LCJ\u53d6\u6271\u5546\u54c1\u3092\u4e00\u89a7\u3067\u78ba\u8a8d'}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white" />
            </CardContent>
          </Card>
        </Link>

        {/* All-time Stats */}
        <Card className="bg-gray-800/30 border-gray-700">
          <CardContent className="p-3">
            <p className="text-xs text-white mb-2">{lt("mypage.totalStats")}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-bold text-red-400">¥{Number(allTimeStats.totalSales).toLocaleString()}</p>
                <p className="text-[10px] text-white">{lt("mypage.totalSales")}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-400">{allTimeStats.totalHours}h</p>
                <p className="text-[10px] text-white">{lt("mypage.totalHours")}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-green-400">{allTimeStats.totalCount}</p>
                <p className="text-[10px] text-white">{lt("mypage.totalStreams")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Livestream History */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Video className="h-4 w-4" />
              {lt("mypage.streamHistory")}
            </h3>
            <div className="flex items-center gap-2">
              {importHistory && importHistory.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImportHistoryDialog(true)}
                  className="text-xs border-gray-600 text-white hover:text-white hover:border-gray-500"
                >
                  <History className="h-3 w-3 mr-1" />
                  {lt("csv.history")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCsvImportDialog(true)}
                className="text-xs border-gray-600 text-white hover:text-white hover:border-gray-500"
              >
                <FileSpreadsheet className="h-3 w-3 mr-1" />
              {lt("csv.import")}
              </Button>
            </div>
          </div>

          {isLoadingLivestreams ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredLivestreams.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6 text-center text-white">
                <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{lt("mypage.noStreamHistory")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {displayedLivestreams.map((ls: { 
                id: number; 
                livestreamDate: string | Date; 
                livestreamEndTime?: string | Date | null; 
                salesAmount?: number | null;
                gmv?: number | null;
                duration?: number | null;
                viewerCount?: number | null;
                likes?: number | null;
                comments?: number | null;
                brandName?: string | null;
                productCsvImported?: string | null;
                aiStructuredAdvice?: {
                  summary?: string;
                  goodPoints?: string[];
                  improvements?: string[];
                  actionPlans?: { action: string; reason: string; timing: string }[];
                  nextGoal?: string;
                  calculatedMetrics?: Record<string, string | number>;
                } | null;
                aiAdvice?: string | null;
              }, index: number) => {
                // JST（日本時間）で表示
                // データベースはUTCで保存されているので、そのまま使用
                // toLocaleTimeString("ja-JP")が自動的にJSTに変換する
                // 無効な日時データの場合はエラーを防ぐ
                const parseDate = (dateValue: string | Date | null | undefined): Date | null => {
                  if (!dateValue) return null;
                  try {
                    const date = new Date(dateValue);
                    // Invalid Dateのチェック
                    if (isNaN(date.getTime())) return null;
                    return date;
                  } catch {
                    return null;
                  }
                };
                const startDate = parseDate(ls.livestreamDate);
                const endDate = parseDate(ls.livestreamEndTime);
                const rawStartDate = startDate;
                const rawEndDate = endDate;
                // duration計算: start/endからの計算を優先し、DBのdurationはフォールバックとして使用
                let durationRaw = 0;
                if (rawEndDate && rawStartDate) {
                  let calcMs = rawEndDate.getTime() - rawStartDate.getTime();
                  // 終了が開始より前の場合、日付をまたいでいる可能性 → 24時間加算
                  if (calcMs < 0) calcMs += 24 * 60 * 60 * 1000;
                  durationRaw = Math.round(calcMs / (1000 * 60 * 60) * 10) / 10;
                } else if (ls.duration) {
                  durationRaw = Math.round(ls.duration / 60 * 10) / 10;
                }
                // マイナス値は0として表示（データ入力ミスの可能性）
                const duration = Math.max(0, durationRaw);
                const hasAiAdvice = ls.aiStructuredAdvice || ls.aiAdvice;

                // 前回比較を計算
                const currentSales = ls.salesAmount || ls.gmv || 0;
                const prevLs = displayedLivestreams[index + 1];
                const prevSales = prevLs ? (prevLs.salesAmount || prevLs.gmv || 0) : null;
                const salesDiff = prevSales !== null ? currentSales - prevSales : null;
                const salesDiffPercent = prevSales && prevSales > 0 ? Math.round((salesDiff! / prevSales) * 100) : null;
                
                // 売上金額の色分け（100万以上は緑、50万以上は黄、それ以下は赤）
                const getSalesColor = (sales: number) => {
                  if (sales >= 1000000) return "text-green-400";
                  if (sales >= 500000) return "text-yellow-400";
                  return "text-red-400";
                };

                return (
                  <div key={ls.id} className="relative group">
                    <Link href={`/livestreams/${ls.id}`} className="block">
                    <Card 
                      className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 transition-colors cursor-pointer active:scale-[0.99]"
                    >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center bg-gray-700/50 rounded px-2 py-1">
                            <p className="text-xs font-bold text-white">
                              {startDate ? `${parseInt(startDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric' }))}/${parseInt(startDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', day: 'numeric' }))}` : "-/-"}
                            </p>
                            <p className="text-[10px] text-white">
                              {startDate ? startDate.toLocaleDateString("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }) : "-"}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="text-xs text-white">
                                {startDate ? startDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }) : "--:--"}
                                {endDate && ` - ${endDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })}`}
                              </p>
                              {hasAiAdvice && (
                                <Sparkles className="h-3 w-3 text-yellow-500" />
                              )}
                              {ls.productCsvImported !== 'yes' && (
                                <span 
                                  title={lt("csv.productCsvNotImported")} 
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500/20 border border-orange-500/50 rounded text-[10px] text-orange-400 font-medium"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {lt("csv.productCsvNotImported")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-white">
                                {duration > 0 ? `${duration}h` : "-"}
                              </p>
                              {ls.viewerCount && (
                                <span className="text-xs text-white flex items-center gap-0.5">
                                  <Eye className="h-3 w-3" />
                                  {Number(ls.viewerCount).toLocaleString()}
                                </span>
                              )}
                              {ls.likes && (
                                <span className="text-xs text-pink-400 flex items-center gap-0.5">
                                  ❤ {Number(ls.likes).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold ${getSalesColor(currentSales)}`}>
                              ¥{Number(currentSales).toLocaleString()}
                            </p>
                            <ChevronRight className="h-4 w-4 text-white" />
                          </div>
                          {salesDiffPercent !== null && (
                            <p className={`text-[10px] ${salesDiff! >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {salesDiff! >= 0 ? "▲" : "▼"} {Math.abs(salesDiffPercent)}%
                            </p>
                          )}
                        </div>
                      </div>
                      {ls.brandName && (
                        <p className="text-[10px] text-white mt-1 pl-12">
                          {ls.brandName}
                        </p>
                      )}
                    </CardContent>
                    </Card>
                    </Link>
                    {/* 削除ボタン */}
                    <button
                      className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full bg-gray-700/80 text-white/70 hover:text-red-400 hover:bg-red-900/50 transition-colors z-10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteTargetId(ls.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {filteredLivestreams.length > 10 && !showAllLivestreams && (
            <Button 
              variant="ghost"
              onClick={() => setShowAllLivestreams(true)}
              className="w-full mt-2 text-white hover:text-white text-xs"
            >
              {lt("mypage.showMore")} ({filteredLivestreams.length - 10})
            </Button>
          )}
        </div>
      </div>

      {/* CSV Import Dialog */}
      <Dialog open={showCsvImportDialog} onOpenChange={setShowCsvImportDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-400" />
              {lt("csv.importTitle")}
            </DialogTitle>
            <DialogDescription className="text-white">
              {lt("csv.importDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* File Upload Area */}
            <label className="block">
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
                {isImporting ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-white">{lt("csv.importing")}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-white mb-2" />
                    <p className="text-sm text-white">
                      {lt("csv.dragDrop")}
                    </p>
                    <p className="text-xs text-white mt-1">
                      .xlsx, .csv
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={handleCsvFileUpload}
                className="hidden"
                disabled={isImporting}
              />
            </label>

            {/* Import Result */}
            {csvImportResult && (
              <div className={`p-4 rounded-lg ${
                csvImportResult.errors.length > 0 
                  ? 'bg-red-900/30 border border-red-700' 
                  : 'bg-green-900/30 border border-green-700'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {csvImportResult.errors.length > 0 ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  )}
                  <span className="font-medium">
                    {csvImportResult.errors.length > 0 ? lt('csv.importError') : lt('csv.importComplete')}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p className="text-green-400">{lt("csv.newRecords")}: {csvImportResult.created}</p>
                  <p className="text-blue-400">{lt("csv.updated")}: {csvImportResult.updated}</p>
                  {csvImportResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-red-400 text-xs">{lt("csv.errorLabel")}</p>
                      {csvImportResult.errors.slice(0, 3).map((err, i) => (
                        <p key={i} className="text-xs text-red-300 truncate">{err}</p>
                      ))}
                      {csvImportResult.errors.length > 3 && (
                        <p className="text-xs text-red-400">{lt("csv.moreErrors", { count: String(csvImportResult.errors.length - 3) })}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instructions with How To button */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white">{lt("csv.instructions")}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHowTo(true)}
                  className="text-blue-400 hover:text-blue-300 h-6 px-2 text-xs gap-1"
                >
                  <HelpCircle className="h-3 w-3" />
                  {lt("csv.howTo")}
                </Button>
              </div>
              <ol className="text-xs text-white space-y-1 list-decimal list-inside">
                <li>{lt("csv.step1")}</li>
                <li>{lt("csv.step2")}</li>
                <li>{lt("csv.step3")}</li>
                <li>{lt("csv.step4")}</li>
              </ol>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-yellow-400/80">
                <Info className="h-3 w-3 flex-shrink-0" />
                <span>{lt("csv.howToMonthTip")}</span>
              </div>
            </div>

            {/* Import History */}
            {importHistory && importHistory.length > 0 && (
              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-white" />
                  <p className="text-sm font-medium text-white">{lt("csv.history")}</p>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {importHistory.map((history) => {
                    const startDate = history.dateRangeStart ? new Date(history.dateRangeStart) : null;
                    const endDate = history.dateRangeEnd ? new Date(history.dateRangeEnd) : null;
                    const formatDate = (date: Date | null) => {
                      if (!date) return '';
                      const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Tokyo' };
                      return `${parseInt(date.toLocaleDateString('ja-JP', { ...opts, month: 'numeric' }))}/${parseInt(date.toLocaleDateString('ja-JP', { ...opts, day: 'numeric' }))}`;
                    };
                    
                    return (
                      <div key={history.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-white">
                                {startDate && endDate ? (
                                  `${formatDate(startDate)} 〜 ${formatDate(endDate)}`
                                ) : (
                                  history.fileName
                                )}
                              </span>
                              <span className="text-[10px] text-white">
                                {history.livestreamCount}
                              </span>
                            </div>
                            <div className="text-[10px] text-white">
                              {new Date(history.createdAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                              {history.totalGmv && (
                                <span className="text-yellow-400 ml-2">
                                  ¥{Number(history.totalGmv).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-6 w-6 p-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-gray-900 border-gray-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">{lt("csv.deleteHistory")}</AlertDialogTitle>
                                <AlertDialogDescription className="text-white">
                                  {lt("csv.deleteHistoryConfirm")}
                                  <br />
                                  <span className="text-red-400 font-medium">
                                    {startDate && endDate && `${formatDate(startDate)} 〜 ${formatDate(endDate)} {lt("csv.deleteStreamData")}`}
                                  </span>
                                  <br />
                                  {lt("csv.irreversible")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700">
                                  {lt("common.cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteImportHistoryMutation.mutate({ historyId: history.id })}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  {lt("common.delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCsvImportDialog(false);
                setCsvImportResult(null);
              }}
              className="text-white"
            >
              {lt("common.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* How To Popup */}
      <Dialog open={showHowTo} onOpenChange={setShowHowTo}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-400" />
              {lt("csv.howToTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Step 1 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">1</div>
                <h3 className="text-sm font-medium text-white">{lt("csv.howToStep1Title")}</h3>
              </div>
              <p className="text-xs text-white ml-8">{lt("csv.howToStep1Desc")}</p>
              <a
                href="https://shop.tiktok.com/streamer/compass/livestream-analytics/view"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-8 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                shop.tiktok.com/streamer/compass/livestream-analytics/view
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">2</div>
                <h3 className="text-sm font-medium text-white">{lt("csv.howToStep2Title")}</h3>
              </div>
              <p className="text-xs text-white ml-8 whitespace-pre-line">{lt("csv.howToStep2Desc")}</p>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">3</div>
                <h3 className="text-sm font-medium text-white">{lt("csv.howToStep3Title")}</h3>
              </div>
              <p className="text-xs text-white ml-8">{lt("csv.howToStep3Desc")}</p>
            </div>

            {/* Step 4 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">4</div>
                <h3 className="text-sm font-medium text-white">{lt("csv.howToStep4Title")}</h3>
              </div>
              <p className="text-xs text-white ml-8">{lt("csv.howToStep4Desc")}</p>
            </div>

            {/* TikTok Dashboard Screenshot */}
            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-white/70 mb-2">{lt("csv.howToPreview")}</p>
              <div className="rounded-lg overflow-hidden border border-gray-700">
                <img
                  src="/images/tiktok-howto.png"
                  alt="TikTok Dashboard"
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1 text-xs text-blue-300">
                <Info className="h-3 w-3 flex-shrink-0" />
                <span className="font-medium">Tips</span>
              </div>
              <p className="text-[11px] text-white">{lt("csv.howToMonthTip")}</p>
              <p className="text-[11px] text-white/70">{lt("csv.howToTip")}</p>
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <Button
              variant="ghost"
              onClick={() => setShowHowTo(false)}
              className="text-white"
            >
              {lt("common.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal Setting Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-400" />
              {lt("goal.title")}
            </DialogTitle>
            <DialogDescription className="text-white">
              {lt("goal.dialogTitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="salesGoal" className="text-white">{lt("goal.salesGoalLabel")}</Label>
              <Input
                id="salesGoal"
                type="number"
                placeholder="1000000"
                value={goalSalesInput}
                onChange={(e) => setGoalSalesInput(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white mt-1"
              />
              <p className="text-xs text-white mt-1">
                {lt("goal.currentSales")}: ¥{Number(monthlyStats.sales).toLocaleString()}
              </p>
            </div>

            <div>
              <Label htmlFor="streamCountGoal" className="text-white">{lt("goal.streamCountGoalLabel")}</Label>
              <Input
                id="streamCountGoal"
                type="number"
                placeholder="20"
                value={goalStreamCountInput}
                onChange={(e) => setGoalStreamCountInput(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white mt-1"
              />
              <p className="text-xs text-white mt-1">
                {lt("goal.currentStreamCount")}: {monthlyStats.count}{lt("goal.times")}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="ghost"
              onClick={() => setShowGoalDialog(false)}
              className="text-white"
            >
              {lt("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                const salesGoal = parseInt(goalSalesInput) || 0;
                const streamCountGoal = parseInt(goalStreamCountInput) || 0;
                if (salesGoal > 0) {
                  setGoalMutation.mutate({
                    yearMonth: selectedMonth,
                    salesGoal,
                    streamCountGoal,
                  });
                }
              }}
              disabled={!goalSalesInput || parseInt(goalSalesInput) <= 0 || setGoalMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {setGoalMutation.isPending ? lt('goal.saving') : lt('goal.setGoal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 配信履歴削除確認ダイアログ - 二重確認+パスワード */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) { setDeleteTargetId(null); setDeletePassword(''); setDeletePasswordError(false); } }}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">⚠️ {lt("stream.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              {lt("stream.deleteConfirm")}
            </AlertDialogDescription>
            <div className="mt-3">
              <label className="text-sm text-gray-300 mb-1 block">{language === 'ja' ? '削除パスワードを入力してください' : language === 'zh-TW' ? '請輸入刪除密碼' : language === 'en' ? 'Enter delete password' : '请输入删除密码'}</label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(false); }}
                placeholder={language === 'ja' ? 'パスワード' : language === 'en' ? 'Password' : '密码'}
                className="bg-gray-800 border-gray-600 text-white"
              />
              {deletePasswordError && <p className="text-red-400 text-xs mt-1">{language === 'ja' ? 'パスワードが間違っています' : language === 'en' ? 'Incorrect password' : '密码错误'}</p>}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
              {lt("common.cancel")}
            </AlertDialogCancel>
            <button
              onClick={() => {
                if (deletePassword !== 'lcj') {
                  setDeletePasswordError(true);
                  return;
                }
                if (deleteTargetId) {
                  deleteLivestreamMutation.mutate({ id: deleteTargetId });
                  setDeleteTargetId(null);
                  setDeletePassword('');
                  setDeletePasswordError(false);
                }
              }}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLivestreamMutation.isPending ? lt('common.loading') : lt('common.delete')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 目標未設定時のナッジポップアップ */}
      <Dialog open={showGoalNudgePopup} onOpenChange={setShowGoalNudgePopup}>
        <DialogContent className="bg-gradient-to-br from-purple-900 via-gray-900 to-pink-900 border-purple-500/50 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Target className="h-6 w-6 text-yellow-400 animate-pulse" />
              {language === 'ja' ? '今月の目標を設定しよう！' : language === 'zh-TW' ? '設定本月目標！' : language === 'en' ? 'Set This Month\'s Goal!' : '设定本月目标！'}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-sm leading-relaxed">
              {language === 'ja' ? (
                <>
                  目標を設定すると、進捗が見える化されてモチベーションがアップ！<br />
                  <span className="text-yellow-400 font-bold">目標達成時にはお祝いアニメーションも表示されます🎉</span>
                </>
              ) : language === 'zh-TW' ? (
                <>
                  設定目標後，可以可視化進度，提升動力！<br />
                  <span className="text-yellow-400 font-bold">達成目標時會有慶祝動畫🎉</span>
                </>
              ) : language === 'en' ? (
                <>
                  Setting goals helps you track progress and stay motivated!<br />
                  <span className="text-yellow-400 font-bold">You'll get a celebration animation when you achieve your goal 🎉</span>
                </>
              ) : (
                <>
                  设定目标后，可以可视化进度，提升动力！<br />
                  <span className="text-yellow-400 font-bold">达成目标时会有庆祝动画🎉</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button
              onClick={() => {
                setShowGoalNudgePopup(false);
                setGoalSalesInput('');
                setGoalStreamCountInput('');
                setShowGoalDialog(true);
              }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3"
            >
              <Target className="h-4 w-4 mr-2" />
              {language === 'ja' ? '今すぐ目標を設定する' : language === 'zh-TW' ? '立即設定目標' : language === 'en' ? 'Set Goal Now' : '立即设定目标'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowGoalNudgePopup(false)}
              className="text-white/50 hover:text-white/80 text-xs"
            >
              {language === 'ja' ? 'あとで設定する' : language === 'zh-TW' ? '稍後設定' : language === 'en' ? 'Later' : '稍后设定'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
