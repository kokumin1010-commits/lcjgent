import { useState, useMemo } from "react";
import { useLocation as useWouterLocation, useSearch } from "wouter";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, TrendingUp, Clock, Calendar, DollarSign, Users, Eye, ShoppingCart, MousePointer, ChevronRight, ChevronDown, ChevronUp, ImageOff, BarChart3, Search, X, AlertTriangle, CheckCircle2, Edit3, Undo2, UserCheck, Upload, Package, FileSpreadsheet, Trophy, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Area,
} from "recharts";

export default function LiverByName() {
  const { name } = useParams<{ name: string }>();
  const decodedName = decodeURIComponent(name || "");
  const { language } = useLanguage();
  const [, navigate] = useWouterLocation();
  
  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    return options;
  }, []);
  
  // URLクエリパラメータからmonthを読み取り、なければ最新月
  const searchString = useSearch();
  const initialMonth = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const monthParam = params.get('month');
    if (monthParam && monthOptions.some(o => o.value === monthParam)) {
      return monthParam;
    }
    return monthOptions[0].value;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const { user } = useAuth();
  
  // CSVアップロード用state
  const [isImportingProductCsv, setIsImportingProductCsv] = useState(false);
  const [uploadingLivestreamId, setUploadingLivestreamId] = useState<number | null>(null);
  
  // ライバーのroleを取得（localStorageから）
  const liverInfo = useMemo(() => {
    try {
      const info = localStorage.getItem('liver_info');
      return info ? JSON.parse(info) : null;
    } catch { return null; }
  }, []);
  const isLiverAdmin = liverInfo?.role === 'admin';
  
  // ライバーのme APIからもroleを取得（フォールバック）
  const { data: liverMe } = trpc.liver.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = isLiverAdmin || liverMe?.role === 'admin' || !!user;
  
  // CSVインポートmutation
  const importProductCsvMutation = trpc.brandLivestream.importProductCsv.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.importedCount}件の商品をインポートしました`);
      setUploadingLivestreamId(null);
      // データを再取得
      utils.liverManagement.getLivestreamsByStreamerName.invalidate();
    },
    onError: (error) => {
      toast.error(`インポートエラー: ${error.message}`);
    },
  });
  
  // CSVパース関数（TikTok Creator-Live-Recap-Product-List形式）
  const parseProductCsv = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const products: Array<{
      productName: string;
      grossRevenue: number | null;
      directGmv: number | null;
      itemsSold: number | null;
      customers: number | null;
      orders: number | null;
      ctr: string | null;
      ctor: string | null;
      productImpressions: number | null;
      productClicks: number | null;
    }> = [];
    
    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Product') && lines[i].includes('Gross revenue')) {
        dataStartIndex = i + 1;
        break;
      }
    }
    
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      if (values.length < 10) continue;
      
      const parseYen = (val: string): number | null => {
        if (!val || val === '0円' || val === '-') return null;
        const num = parseInt(val.replace(/[,円\s]/g, ''), 10);
        return isNaN(num) ? null : num;
      };
      
      const parseNum = (val: string): number | null => {
        if (!val || val === '-') return null;
        const num = parseFloat(val.replace(/,/g, ''));
        return isNaN(num) ? null : num;
      };
      
      const productName = values[0];
      if (!productName || productName === 'Product') continue;
      
      products.push({
        productName,
        grossRevenue: parseYen(values[1]),
        directGmv: parseYen(values[2]),
        itemsSold: parseNum(values[3]) as number | null,
        customers: parseNum(values[4]) as number | null,
        orders: parseNum(values[5]) as number | null,
        ctr: values[6] || null,
        ctor: values[7] || null,
        productImpressions: parseNum(values[8]) as number | null,
        productClicks: parseNum(values[9]) as number | null,
      });
    }
    
    return products;
  };
  
  const handleProductCsvUpload = async (livestreamId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImportingProductCsv(true);
    setUploadingLivestreamId(livestreamId);
    
    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        const products = parseProductCsv(csvText);
        
        if (products.length === 0) {
          toast.error('商品データが見つかりませんでした');
          return;
        }
        
        await importProductCsvMutation.mutateAsync({
          livestreamId,
          fileName: file.name,
          products,
        });
      } else {
        const text = await file.text();
        const products = parseProductCsv(text);
        
        if (products.length === 0) {
          toast.error('商品データが見つかりませんでした');
          return;
        }
        
        await importProductCsvMutation.mutateAsync({
          livestreamId,
          fileName: file.name,
          products,
        });
      }
    } catch (error) {
      console.error('CSV import error:', error);
      toast.error('CSVのインポートに失敗しました');
    } finally {
      setIsImportingProductCsv(false);
      e.target.value = '';
    }
  };
  const utils = trpc.useUtils();

  // スタッフ選択関連のstate（localStorageから前回の選択を復元）
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('lcj_verifier_staff_id');
      return saved ? Number(saved) : null;
    } catch { return null; }
  });
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(() => {
    try {
      return localStorage.getItem('lcj_verifier_staff_name');
    } catch { return null; }
  });
  const [staffSelectDialogOpen, setStaffSelectDialogOpen] = useState(false);
  const [staffSelectAction, setStaffSelectAction] = useState<{ type: 'single' | 'bulk'; id?: number; ids?: number[] } | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // HRスタッフ一覧取得
  const { data: staffList } = trpc.staff.listActive.useQuery(undefined, {
    enabled: !!user,
  });

  // 訂正ダイアログのstate
  const [correctDialogOpen, setCorrectDialogOpen] = useState(false);
  const [correctTarget, setCorrectTarget] = useState<any>(null);
  const [correctForm, setCorrectForm] = useState({
    salesAmount: "",
    duration: "",
    viewerCount: "",
    orderCount: "",
  });

  // スタッフ選択ダイアログを開く
  const openStaffSelectDialog = (action: { type: 'single' | 'bulk'; id?: number; ids?: number[] }) => {
    setStaffSelectAction(action);
    setStaffSearchQuery('');
    setStaffSelectDialogOpen(true);
  };

  // スタッフ選択後の確認実行
  const executeVerifyWithStaff = (staffId: number, staffName: string) => {
    if (!staffSelectAction) return;
    // localStorageに保存して次回から自動選択
    try {
      localStorage.setItem('lcj_verifier_staff_id', String(staffId));
      localStorage.setItem('lcj_verifier_staff_name', staffName);
    } catch {}
    setSelectedStaffId(staffId);
    setSelectedStaffName(staffName);
    if (staffSelectAction.type === 'single' && staffSelectAction.id) {
      verifyMutation.mutate({ id: staffSelectAction.id, staffId, staffName });
    } else if (staffSelectAction.type === 'bulk' && staffSelectAction.ids) {
      verifyBulkMutation.mutate({ ids: staffSelectAction.ids, staffId, staffName });
    }
    setStaffSelectDialogOpen(false);
    setStaffSelectAction(null);
  };

  // Mutations
  const verifyMutation = trpc.salesCheck.verify.useMutation({
    onSuccess: () => {
      toast.success("配信記録を確認しました");
      utils.liverManagement.getLivestreamsByStreamerName.invalidate();
    },
    onError: () => toast.error("確認に失敗しました"),
  });

  const unverifyMutation = trpc.salesCheck.unverify.useMutation({
    onSuccess: () => {
      toast.success("確認を取り消しました");
      utils.liverManagement.getLivestreamsByStreamerName.invalidate();
    },
    onError: () => toast.error("取消に失敗しました"),
  });

  const verifyBulkMutation = trpc.salesCheck.verifyBulk.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count}件の配信記録を確認しました`);
      utils.liverManagement.getLivestreamsByStreamerName.invalidate();
    },
    onError: () => toast.error("一括確認に失敗しました"),
  });

  const correctMutation = trpc.salesCheck.correct.useMutation({
    onSuccess: () => {
      toast.success("配信記録を訂正しました");
      setCorrectDialogOpen(false);
      utils.liverManagement.getLivestreamsByStreamerName.invalidate();
    },
    onError: () => toast.error("訂正に失敗しました"),
  });

  const openCorrectDialog = (livestream: any) => {
    setCorrectTarget(livestream);
    setCorrectForm({
      salesAmount: String(livestream.salesAmount || ""),
      duration: String(livestream.duration || ""),
      viewerCount: String(livestream.viewerCount || ""),
      orderCount: String(livestream.orderCount || ""),
    });
    setCorrectDialogOpen(true);
  };

  const handleCorrectSubmit = () => {
    if (!correctTarget) return;
    correctMutation.mutate({
      id: correctTarget.id,
      salesAmount: correctForm.salesAmount ? Number(correctForm.salesAmount) : null,
      duration: correctForm.duration ? Number(correctForm.duration) : null,
      viewerCount: correctForm.viewerCount ? Number(correctForm.viewerCount) : null,
      orderCount: correctForm.orderCount ? Number(correctForm.orderCount) : null,
    });
  };

  const { data, isLoading } = trpc.liverManagement.getLivestreamsByStreamerName.useQuery({
    streamerName: decodedName,
    month: selectedMonth,
  });

  // Growth data (past 6 months)
  const { data: growthData, isLoading: isGrowthLoading } = trpc.liverManagement.getLiverMonthlyGrowth.useQuery({
    streamerName: decodedName,
  });

  // ライバー一覧からliverIdを取得
  const { data: allLivers } = trpc.liverManagement.listAll.useQuery();
  const liverId = useMemo(() => {
    if (!allLivers) return null;
    const liver = allLivers.find((l: any) => l.name === decodedName);
    return liver?.id || null;
  }, [allLivers, decodedName]);

  // 商品ランキング（ライバー別）
  const { data: topProducts } = trpc.liverManagement.getTopProducts.useQuery(
    { liverId: liverId!, limit: 20, month: selectedMonth },
    { enabled: !!liverId }
  );

  // セット活用分析（ライバー別）
  const { data: setAnalysis } = trpc.livestreamSets.liverSetAnalysis.useQuery(
    { liverId: liverId! },
    { enabled: !!liverId }
  );

  // 商品ランキングの表示切り替え
  const [showAllProducts, setShowAllProducts] = useState(false);
  // セット詳細の展開
  const [expandedSetId, setExpandedSetId] = useState<number | null>(null);

  const unverifiedIds = useMemo(() => {
    if (!data?.livestreams) return [];
    return data.livestreams.filter((l: any) => !l.verifiedAt).map((l: any) => l.id);
  }, [data?.livestreams]);
  
  const translations = {
    ja: {
      back: "戻る",
      livestreamHistory: "配信履歴",
      totalSales: "月間売上合計",
      totalDuration: "月間配信時間",
      noData: "この月のデータはありません",
      date: "日付",
      brand: "ブランド",
      sales: "売上",
      duration: "配信時間",
      viewers: "視聴者数",
      orders: "注文数",
      clicks: "クリック数",
      hours: "時間",
      minutes: "分",
      livestreams: "配信",
      growthChart: "成長推移",
      monthlySales: "月間売上",
      monthlyDuration: "配信時間（時間）",
      monthlyViewers: "視聴者数",
      monthlyStreams: "配信回数",
      vsLastMonth: "前月比",
    },
    zh: {
      back: "返回",
      livestreamHistory: "直播历史",
      totalSales: "月销售总额",
      totalDuration: "月直播时长",
      noData: "该月无数据",
      date: "日期",
      brand: "品牌",
      sales: "销售额",
      duration: "直播时长",
      viewers: "观众数",
      orders: "订单数",
      clicks: "点击数",
      hours: "小时",
      minutes: "分钟",
      livestreams: "直播",
      growthChart: "成长趋势",
      monthlySales: "月销售额",
      monthlyDuration: "直播时长（小时）",
      monthlyViewers: "观众数",
      monthlyStreams: "直播次数",
      vsLastMonth: "环比",
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "¥0";
    return `¥${Number(amount).toLocaleString()}`;
  };
  
  const formatDuration = (minutes: number | null | undefined) => {
    if (minutes == null) return "0分";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}${tr.hours}${mins}${tr.minutes}`;
    }
    return `${mins}${tr.minutes}`;
  };
  
  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Tokyo' };
    const month = parseInt(date.toLocaleDateString('ja-JP', { ...options, month: 'numeric' }));
    const day = parseInt(date.toLocaleDateString('ja-JP', { ...options, day: 'numeric' }));
    return `${month}/${day}`;
  };

  // 整合性チェック: 開始〜終了時刻から計算した配信時間とCSVのdurationを比較
  const checkDataIntegrity = (livestream: any) => {
    if (!livestream.livestreamDate || !livestream.livestreamEndTime || !livestream.duration) return null;
    const start = new Date(livestream.livestreamDate);
    const end = new Date(livestream.livestreamEndTime);
    const calcMins = Math.round((end.getTime() - start.getTime()) / 60000);
    const diff = Math.abs(calcMins - livestream.duration);
    if (diff > 30) {
      return {
        csvDuration: livestream.duration,
        calcDuration: calcMins,
        diff,
        message: `開始〜終了: ${Math.floor(calcMins/60)}h${calcMins%60}m / CSV: ${Math.floor(livestream.duration/60)}h${livestream.duration%60}m（差${diff}分）`
      };
    }
    return null;
  };

  const formatTimeRange = (livestream: any) => {
    const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false };
    
    // 開始時間を取得
    let startTime: string | null = null;
    if (livestream.livestreamStartTime) {
      startTime = livestream.livestreamStartTime;
    } else if (livestream.livestreamDate) {
      const date = new Date(livestream.livestreamDate);
      const time = date.toLocaleTimeString('ja-JP', options);
      if (time !== '00:00') startTime = time;
    }
    
    // 終了時間を取得
    let endTime: string | null = null;
    if (livestream.livestreamEndTime) {
      const endDate = new Date(livestream.livestreamEndTime);
      endTime = endDate.toLocaleTimeString('ja-JP', options);
    }
    
    if (!startTime && !endTime) return null;
    if (startTime && endTime) return `${startTime} - ${endTime}`;
    if (startTime) return startTime;
    return null;
  };

  // Calculate growth percentages
  const getGrowthInfo = (data: any[], index: number) => {
    if (!data || index <= 0) return null;
    const current = data[index];
    const prev = data[index - 1];
    if (!current || !prev || prev.sales === 0) return null;
    const pct = ((current.sales - prev.sales) / prev.sales) * 100;
    return pct;
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const salesData = payload.find((p: any) => p.dataKey === "sales");
      const durationData = payload.find((p: any) => p.dataKey === "durationHours");
      const viewersData = payload.find((p: any) => p.dataKey === "viewers");
      const streamsData = payload.find((p: any) => p.dataKey === "streamCount");
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">{label}</p>
          {salesData && (
            <p className="text-yellow-400 text-sm">
              {tr.monthlySales}: ¥{Number(salesData.value * 10000).toLocaleString()}
            </p>
          )}
          {durationData && (
            <p className="text-blue-400 text-sm">
              {tr.monthlyDuration}: {Number(durationData.value).toFixed(1)}h
            </p>
          )}
          {viewersData && (
            <p className="text-purple-400 text-sm">
              {tr.monthlyViewers}: {Number(viewersData.value).toLocaleString()}
            </p>
          )}
          {streamsData && (
            <p className="text-green-400 text-sm">
              {tr.monthlyStreams}: {streamsData.value}回
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-gray-800" />
          <Skeleton className="h-32 w-full bg-gray-800" />
          <Skeleton className="h-64 w-full bg-gray-800" />
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = growthData?.map((m: any) => ({
    ...m,
    sales: m.sales / 10000, // 万円単位
    durationHours: +(m.duration / 60).toFixed(1), // 時間単位
  })) || [];

  // Current month vs last month comparison
  const currentMonthData = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const lastMonthData = chartData.length > 1 ? chartData[chartData.length - 2] : null;

  const calcGrowth = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return ((current - prev) / prev) * 100;
  };

  const salesGrowth = currentMonthData && lastMonthData 
    ? calcGrowth(currentMonthData.sales, lastMonthData.sales) : null;
  const durationGrowth = currentMonthData && lastMonthData 
    ? calcGrowth(currentMonthData.durationHours, lastMonthData.durationHours) : null;
  const viewersGrowth = currentMonthData && lastMonthData 
    ? calcGrowth(currentMonthData.viewers, lastMonthData.viewers) : null;

  const GrowthBadge = ({ value }: { value: number | null }) => {
    if (value === null) return null;
    const isPositive = value >= 0;
    return (
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
        isPositive ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
      }`}>
        {isPositive ? "+" : ""}{value.toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Red top border */}
      <div className="h-1 bg-red-600" />
      
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/livers">
            <Button variant="ghost" size="icon" className="text-white hover:bg-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-gray-700 text-white text-lg">
                {decodedName?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{decodedName}</h1>
              <p className="text-sm text-white">{tr.livestreamHistory}</p>
            </div>
          </div>
          <Select value={selectedMonth} onValueChange={(value) => {
            setSelectedMonth(value);
            // URLクエリパラメータを更新（ブラウザ履歴に残す）
            const url = new URL(window.location.href);
            url.searchParams.set('month', value);
            window.history.replaceState({}, '', url.toString());
          }}>
            <SelectTrigger className="w-40 bg-transparent border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {monthOptions.map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  className="text-white hover:bg-gray-800"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-700/10 border-yellow-700/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-yellow-500 mb-2">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm">{tr.totalSales}</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-yellow-400">
                  {formatCurrency(data?.totalSales)}
                </p>
                <GrowthBadge value={salesGrowth} />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-900/30 to-blue-700/10 border-blue-700/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-500 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm">{tr.totalDuration}</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-blue-400">
                  {formatDuration(data?.totalDuration)}
                </p>
                <GrowthBadge value={durationGrowth} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Growth Chart */}
        {!isGrowthLoading && chartData.length > 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                {tr.growthChart}
                <span className="text-xs text-white/60 ml-2">（過去6ヶ月）</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Sales Bar Chart */}
              <div className="mb-6">
                <p className="text-sm text-yellow-400 mb-3 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {tr.monthlySales}（万円）
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fill: '#fff', fontSize: 12 }} 
                      axisLine={{ stroke: '#374151' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#9CA3AF', fontSize: 11 }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry: any, index: number) => {
                        const isLatest = index === chartData.length - 1;
                        const prevSales = index > 0 ? chartData[index - 1].sales : 0;
                        const isGrowth = entry.sales >= prevSales;
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={isLatest ? "#EAB308" : isGrowth ? "#4ADE80" : "#F87171"}
                            fillOpacity={isLatest ? 1 : 0.6}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Duration & Viewers Line Chart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-blue-400 mb-3 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {tr.monthlyDuration}
                  </p>
                  <ResponsiveContainer width="100%" height={140}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fill: '#fff', fontSize: 10 }} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#9CA3AF', fontSize: 10 }} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="durationHours" 
                        fill="#3B82F6" 
                        fillOpacity={0.15} 
                        stroke="none"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="durationHours" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <p className="text-sm text-purple-400 mb-3 flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {tr.monthlyViewers}
                  </p>
                  <ResponsiveContainer width="100%" height={140}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fill: '#fff', fontSize: 10 }} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#9CA3AF', fontSize: 10 }} 
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="viewers" 
                        fill="#A855F7" 
                        fillOpacity={0.15} 
                        stroke="none"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="viewers" 
                        stroke="#A855F7" 
                        strokeWidth={2}
                        dot={{ fill: '#A855F7', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Stream Count Mini Bar */}
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-sm text-green-400 mb-3 flex items-center gap-1">
                  <BarChart3 className="w-4 h-4" />
                  {tr.monthlyStreams}
                </p>
                <div className="flex items-end gap-2 h-16">
                  {chartData.map((entry: any, index: number) => {
                    const maxCount = Math.max(...chartData.map((d: any) => d.streamCount), 1);
                    const height = (entry.streamCount / maxCount) * 100;
                    const isLatest = index === chartData.length - 1;
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-white font-medium">{entry.streamCount}</span>
                        <div 
                          className={`w-full rounded-t-md transition-all ${isLatest ? "bg-green-500" : "bg-green-500/40"}`}
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                        <span className="text-[10px] text-white/60">{entry.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Livestream History */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg flex-wrap">
              <Calendar className="w-5 h-5 text-green-500" />
              {tr.livestreamHistory}
              <span className="text-sm text-white ml-2">
                ({data?.livestreams?.length || 0} {tr.livestreams})
              </span>
              {data?.livestreams && data.livestreams.filter(l => checkDataIntegrity(l)).length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-400 text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  {data.livestreams.filter(l => checkDataIntegrity(l)).length}件 要確認
                </span>
              )}
              {unverifiedIds.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400 text-xs">
                  未確認: {unverifiedIds.length}件
                </span>
              )}
            </CardTitle>
            {user && unverifiedIds.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-green-600 text-green-400 hover:bg-green-900/30"
                onClick={() => openStaffSelectDialog({ type: 'bulk', ids: unverifiedIds })}
                disabled={verifyBulkMutation.isPending}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                全て確認済みにする
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {data?.livestreams && data.livestreams.length > 0 ? (
              <div className="space-y-3">
                {data.livestreams.map((livestream) => (
                  <div 
                    key={livestream.id} 
                    className={`rounded-lg bg-gray-800/50 border transition-colors cursor-pointer overflow-hidden ${checkDataIntegrity(livestream) ? 'border-orange-500/60 hover:border-orange-400/80' : 'border-gray-700/50 hover:border-gray-600/50'}`}
                    onClick={() => navigate(`/livestreams/${livestream.id}`)}
                  >
                    <div className="flex">
                      {/* Left: Screenshot Thumbnail */}
                      <div className="flex-shrink-0 w-28 sm:w-36 md:w-44 relative max-h-[160px] overflow-hidden group">
                        {(livestream as any).screenshotUrl ? (
                          <>
                            <img 
                              src={(livestream as any).screenshotUrl} 
                              alt="配信スクリーンショット"
                              className="w-full h-full object-cover object-top min-h-[120px] max-h-[160px]"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const nextSib = parent.nextElementSibling;
                                  if (nextSib) nextSib.remove();
                                }
                              }}
                            />
                            <div 
                              className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-zoom-in"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage((livestream as any).screenshotUrl);
                              }}
                            >
                              <Search className="w-6 h-6 text-white drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full min-h-[120px] max-h-[160px] bg-gray-700/50 flex items-center justify-center">
                            <div className="text-center p-2">
                              <ImageOff className="w-6 h-6 mx-auto mb-1 text-white/50" />
                              <span className="text-xs text-white/50 block">No Image</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Right: Data */}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-white" />
                            <span className="font-medium text-white">{formatDate(livestream.livestreamDate)}</span>
                            {formatTimeRange(livestream) && (
                              <span className="text-xs text-white/60">{formatTimeRange(livestream)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* CSVアップロードステータス */}
                            {(livestream as any).productCount > 0 ? (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-900/50 text-emerald-400">
                                <FileSpreadsheet className="w-3 h-3" />
                                CSV済 ({(livestream as any).productCount}品)
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-700/50 text-gray-500">
                                <FileSpreadsheet className="w-3 h-3" />
                                CSV未
                              </span>
                            )}
                            {livestream.result && (
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                livestream.result === "成功" 
                                  ? "bg-green-900/50 text-green-400" 
                                  : "bg-red-900/50 text-red-400"
                              }`}>
                                {livestream.result}
                              </span>
                            )}
                            {(livestream as any).verifiedAt ? (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-400" title={`${(livestream as any).verifiedByStaffName || ''} ${(livestream as any).verifiedAt ? new Date((livestream as any).verifiedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}`}>
                                <CheckCircle2 className="w-3 h-3" />
                                {(livestream as any).verifiedByStaffName ? (
                                  <>{(livestream as any).verifiedByStaffName}が確認</>
                                ) : (
                                  <>確認済</>
                                )}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs bg-gray-700/50 text-gray-400">
                                未確認
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-yellow-500" />
                            <div>
                              <p className="text-xs text-white">{tr.sales}</p>
                              <p className="font-medium text-yellow-400">{formatCurrency(livestream.salesAmount)}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${checkDataIntegrity(livestream) ? 'text-orange-500' : 'text-blue-500'}`} />
                            <div>
                              <p className="text-xs text-white flex items-center gap-1">
                                {tr.duration}
                                {checkDataIntegrity(livestream) && (
                                  <span className="relative group">
                                    <AlertTriangle className="w-3 h-3 text-orange-400 animate-pulse cursor-help" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-orange-900/95 text-orange-200 text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                      {checkDataIntegrity(livestream)?.message}
                                    </span>
                                  </span>
                                )}
                              </p>
                              <p className={`font-medium ${checkDataIntegrity(livestream) ? 'text-orange-400' : 'text-blue-400'}`}>{formatDuration(livestream.duration)}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-purple-500" />
                            <div>
                              <p className="text-xs text-white">{tr.viewers}</p>
                              <p className="font-medium text-purple-400">
                                {livestream.viewerCount?.toLocaleString() || "-"}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-green-500" />
                            <div>
                              <p className="text-xs text-white">{tr.orders}</p>
                              <p className="font-medium text-green-400">
                                {livestream.orderCount?.toLocaleString() || "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {livestream.remarks && (
                          <p className="mt-3 text-sm text-white border-t border-gray-700 pt-3 line-clamp-2">
                            {livestream.remarks}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
                          <div className="flex items-center gap-2">
                          {/* CSVアップロードボタン（管理者のみ） */}
                          {isAdmin && (
                            <label
                              className={`inline-flex items-center gap-1 h-7 px-2 text-xs rounded cursor-pointer transition-colors ${
                                (livestream as any).productCount > 0
                                  ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30'
                                  : 'text-orange-400 hover:text-orange-300 hover:bg-orange-900/30'
                              } ${uploadingLivestreamId === livestream.id ? 'opacity-50 pointer-events-none' : ''}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {uploadingLivestreamId === livestream.id ? (
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3" />
                              )}
                              {(livestream as any).productCount > 0 ? 'CSV再アップ' : 'CSVアップ'}
                              <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                onChange={(e) => handleProductCsvUpload(livestream.id, e)}
                                disabled={isImportingProductCsv}
                              />
                            </label>
                          )}
                          {user && (
                            <>
                              {(livestream as any).verifiedAt ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-gray-400 hover:text-orange-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    unverifyMutation.mutate({ id: livestream.id });
                                  }}
                                  disabled={unverifyMutation.isPending}
                                >
                                  <Undo2 className="w-3 h-3 mr-1" /> 確認取消
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-green-400 hover:text-green-300 hover:bg-green-900/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStaffSelectDialog({ type: 'single', id: livestream.id });
                                  }}
                                  disabled={verifyMutation.isPending}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> 確認済み
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCorrectDialog(livestream);
                                }}
                              >
                                <Edit3 className="w-3 h-3 mr-1" /> 訂正
                              </Button>
                            </>
                          )}
                          </div>
                          <span className="text-xs text-white flex items-center gap-1 hover:text-white transition-colors">
                            詳細を見る <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-white">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tr.noData}</p>
              </div>
            )}
          </CardContent>
        </Card>
        {/* 売れ筋商品ランキング */}
        {topProducts && topProducts.length > 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
                <Crown className="w-6 h-6 text-yellow-400" />
                <span className="text-white">売れ筋商品ランキング</span>
                <span className="text-gray-400 text-sm">
                  {showAllProducts ? `全${topProducts.length}件` : `TOP10`}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
                </span>
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-2 text-cyan-400 text-sm font-medium">#</th>
                      <th className="text-left py-3 px-2 text-cyan-400 text-sm font-medium">商品名</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">GMV</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">販売数</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">配信回数</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">平均GMV/配信</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllProducts ? topProducts : topProducts.slice(0, 10)).map((product: any, index: number) => (
                      <tr 
                        key={product.productName} 
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="py-3 px-2">
                          {index < 3 ? (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${
                              index === 0 ? 'bg-yellow-500 text-black' : 
                              index === 1 ? 'bg-gray-400 text-black' : 
                              'bg-amber-600 text-white'
                            }`}>
                              {index + 1}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-medium pl-2">{index + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-white font-medium max-w-[250px] truncate">
                          {product.productName}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-yellow-400 font-mono font-bold">
                            ¥{Number(product.totalGmv).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-cyan-300">
                          {Number(product.totalItemsSold).toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-300">
                          {product.livestreamCount}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-emerald-400 font-mono">
                            ¥{Number(product.avgGmvPerStream).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {topProducts.length > 10 && (
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllProducts(!showAllProducts)}
                    className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-400/50"
                  >
                    {showAllProducts ? (
                      <>閉じる <ChevronUp className="w-4 h-4 ml-1" /></>
                    ) : (
                      <>さらに見る（+{topProducts.length - 10}件） <ChevronDown className="w-4 h-4 ml-1" /></>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* セット活用情報 */}
        {setAnalysis && setAnalysis.sets && setAnalysis.sets.length > 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-3">
                <Package className="w-6 h-6 text-pink-400" />
                <span className="text-white">セット活用情報</span>
              </h2>
              
              {/* サマリー */}
              {setAnalysis.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 text-center">
                    <div className="text-gray-400 text-xs mb-1">セット数</div>
                    <div className="text-pink-400 font-bold text-lg">{setAnalysis.summary.totalSets}個</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 text-center">
                    <div className="text-gray-400 text-xs mb-1">セット売上</div>
                    <div className="text-emerald-400 font-mono font-bold text-lg">¥{Number(setAnalysis.summary.totalSetRevenue).toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 text-center">
                    <div className="text-gray-400 text-xs mb-1">販売数</div>
                    <div className="text-cyan-300 font-bold text-lg">{setAnalysis.summary.totalQuantitySold}個</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 text-center">
                    <div className="text-gray-400 text-xs mb-1">平均割引率</div>
                    <div className="text-orange-400 font-bold text-lg">{setAnalysis.summary.avgDiscountRate}%OFF</div>
                  </div>
                </div>
              )}

              {/* セット一覧 */}
              <div className="space-y-2">
                {setAnalysis.sets.map((set: any) => {
                  const isBest = setAnalysis.summary?.bestSetId === set.id;
                  const isMostPopular = setAnalysis.summary?.mostPopularSetId === set.id && !isBest;
                  const isExpanded = expandedSetId === set.id;
                  return (
                    <div key={set.id}>
                      <div
                        onClick={() => setExpandedSetId(isExpanded ? null : set.id)}
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          isExpanded
                            ? 'bg-gray-800/80 border-pink-400/40'
                            : 'bg-gray-800/40 border-gray-700/50 hover:border-pink-400/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Package className="w-4 h-4 text-pink-400 shrink-0" />
                            <span className="text-white font-semibold text-sm">{set.setName}</span>
                            {set.discountRate != null && Number(set.discountRate) > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-xs font-bold">
                                {Math.round(Number(set.discountRate))}%OFF
                              </span>
                            )}
                            {isBest && (
                              <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-bold">
                                ⭐ 最高売上
                              </span>
                            )}
                            {isMostPopular && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                                🔥 人気
                              </span>
                            )}
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-pink-400" />
                              : <ChevronDown className="w-4 h-4 text-gray-500" />
                            }
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            {set.livestreamDate && (
                              <span className="text-gray-400">
                                {new Date(set.livestreamDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <div>
                            <span className="text-gray-400">売値: </span>
                            <span className="text-yellow-400 font-bold">¥{Number(set.setPrice || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">販売数: </span>
                            <span className="text-cyan-300 font-bold">{set.quantitySold || 0}セット</span>
                          </div>
                          <div>
                            <span className="text-gray-400">売上: </span>
                            <span className="text-emerald-400 font-mono font-bold">¥{Number(set.totalRevenue || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* セット内容（展開時） */}
                      {isExpanded && set.items && set.items.length > 0 && (
                        <div className="ml-4 mr-2 mt-1 p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 animate-in slide-in-from-top-2 duration-200">
                          <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                            <span>セット内容</span>
                            {set.totalOriginalPrice != null && Number(set.totalOriginalPrice) > 0 && (
                              <span className="text-gray-500">(定価合計: ¥{Number(set.totalOriginalPrice).toLocaleString()})</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {set.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="text-gray-300">{item.productName}{(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ''}</span>
                                <span className="text-gray-500 font-mono">¥{Number(item.originalPrice || 0).toLocaleString()}{(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* よく使われる商品 */}
              {setAnalysis.topProducts && setAnalysis.topProducts.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    セットでよく使われる商品
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {setAnalysis.topProducts.map((product: any, idx: number) => (
                      <div key={idx} className="px-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-xs">
                        <span className="text-white font-medium">{product.productName}</span>
                        <span className="text-pink-400 ml-2">{product.count}回使用</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white z-50 bg-black/50 rounded-full p-2"
            onClick={() => setZoomedImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={zoomedImage} 
            alt="拡大表示"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 訂正ダイアログ */}
      <Dialog open={correctDialogOpen} onOpenChange={setCorrectDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">配信記録の訂正</DialogTitle>
          </DialogHeader>
          {correctTarget && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                {formatDate(correctTarget.livestreamDate)} の配信記録を訂正します
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">売上 (円)</Label>
                  <Input
                    type="number"
                    value={correctForm.salesAmount}
                    onChange={(e) => setCorrectForm(prev => ({ ...prev, salesAmount: e.target.value }))}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="例: 1000000"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">配信時間 (分)</Label>
                  <Input
                    type="number"
                    value={correctForm.duration}
                    onChange={(e) => setCorrectForm(prev => ({ ...prev, duration: e.target.value }))}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="例: 120"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">視聴者数</Label>
                  <Input
                    type="number"
                    value={correctForm.viewerCount}
                    onChange={(e) => setCorrectForm(prev => ({ ...prev, viewerCount: e.target.value }))}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="例: 5000"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">注文数</Label>
                  <Input
                    type="number"
                    value={correctForm.orderCount}
                    onChange={(e) => setCorrectForm(prev => ({ ...prev, orderCount: e.target.value }))}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="例: 100"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCorrectDialogOpen(false)}
              className="border-gray-600 text-gray-300"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCorrectSubmit}
              disabled={correctMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {correctMutation.isPending ? "訂正中..." : "訂正する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* スタッフ選択ダイアログ */}
      <Dialog open={staffSelectDialogOpen} onOpenChange={setStaffSelectDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-400" />
              確認者を選択してください
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="名前で検索..."
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
          </div>
          {/* 前回の担当者があればクイックボタンを表示 */}
          {selectedStaffId && selectedStaffName && (
            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-green-500 bg-green-900/30 hover:bg-green-900/50 transition-all text-left mb-2"
              onClick={() => executeVerifyWithStaff(selectedStaffId, selectedStaffName)}
            >
              <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-sm font-medium text-white">
                {selectedStaffName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-400 mb-0.5">前回と同じ担当者で確認</p>
                <p className="text-sm font-medium text-white truncate">{selectedStaffName}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </button>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {staffList && staffList.filter((s: any) => !staffSearchQuery || s.name?.toLowerCase().includes(staffSearchQuery.toLowerCase()) || s.department?.toLowerCase().includes(staffSearchQuery.toLowerCase())).length > 0 ? (
              staffList.filter((s: any) => !staffSearchQuery || s.name?.toLowerCase().includes(staffSearchQuery.toLowerCase()) || s.department?.toLowerCase().includes(staffSearchQuery.toLowerCase())).map((s: any) => (
                <button
                  key={s.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${s.id === selectedStaffId ? 'border-green-500/50 bg-green-900/10' : 'border-gray-700 hover:border-green-500 hover:bg-green-900/20'}`}
                  onClick={() => executeVerifyWithStaff(s.id, s.name)}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-white">
                    {s.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.name}</p>
                    {s.department && (
                      <p className="text-xs text-gray-400 truncate">{s.department}{s.position ? ` / ${s.position}` : ''}</p>
                    )}
                  </div>
                  <CheckCircle2 className={`w-4 h-4 ${s.id === selectedStaffId ? 'text-green-400' : 'text-gray-600'}`} />
                </button>
              ))
            ) : (
              <p className="text-center text-gray-400 py-4">スタッフが見つかりません</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStaffSelectDialogOpen(false)}
              className="border-gray-600 text-gray-300"
            >
              キャンセル
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
