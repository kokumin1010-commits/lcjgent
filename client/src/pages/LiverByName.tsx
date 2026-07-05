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
import { ArrowLeft, TrendingUp, Clock, Calendar, DollarSign, Users, Eye, ShoppingCart, MousePointer, ChevronRight, ChevronDown, ChevronUp, ImageOff, BarChart3, Search, X, AlertTriangle, CheckCircle2, Edit3, Undo2, UserCheck, Upload, Package, FileSpreadsheet, Trophy, Crown, ShoppingBag, Tag, Percent, Sparkles, MessageSquare, ShieldCheck, ShieldAlert, HelpCircle, AlertCircle, Target, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
    // Default to current month (latest)
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
  // CSVアップロードはHRメンバー全員に許可（認証不要）
  const canUploadCsv = true;
  
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
      cartAddCount: number | null;
    }> = [];
    
    if (lines.length < 2) return products;
    
    const parseCsvLine = (line: string): string[] => {
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
      return values;
    };
    
    const parseNum = (val: string): number | null => {
      if (!val || val === '-' || val === '0円') return null;
      const num = parseFloat(val.replace(/[,円\s]/g, ''));
      return isNaN(num) ? null : num;
    };
    
    // ヘッダー行を検出（中国語・日本語・英語対応）
    let headerLineIdx = -1;
    let headerValues: string[] = [];
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const vals = parseCsvLine(lines[i]);
      const joined = vals.join('');
      if (joined.includes('Product') && (joined.includes('Gross revenue') || joined.includes('GMV'))) {
        headerLineIdx = i; headerValues = vals; break;
      }
      if (joined.includes('商品') && (joined.includes('GMV') || joined.includes('归因'))) {
        headerLineIdx = i; headerValues = vals; break;
      }
      if (joined.includes('商品') && (joined.includes('GMV') || joined.includes('販売数') || joined.includes('インプレッション'))) {
        headerLineIdx = i; headerValues = vals; break;
      }
    }
    
    if (headerLineIdx < 0) {
      headerLineIdx = 0;
      headerValues = parseCsvLine(lines[0]);
    }
    
    const hdr = headerValues.map(h => h.replace(/\s/g, ''));
    const findIdx = (keywords: string[]): number => {
      for (const kw of keywords) {
        const idx = hdr.findIndex(h => h === kw || h.includes(kw));
        if (idx >= 0) return idx;
      }
      return -1;
    };
    
    let nameIdx = findIdx(['商品名称', '商品名', 'Product']);
    let idIdx = findIdx(['商品ID', 'ProductID']);
    let gmvIdx = findIdx(['归因GMV', 'GMV', 'Grossrevenue', 'Directrevenue']);
    let salesIdx = findIdx(['归因成交件数', '商品の販売数', '販売数', 'Itemssold']);
    let custIdx = findIdx(['客户数', 'カスタマー数', 'Customers']);
    let ordIdx = findIdx(['归因订单数', '归因訂單数', '注文', 'Orders']);
    let impIdx = findIdx(['商品曝光次数', '商品インプレッション数', 'インプレッション', 'Productimpressions']);
    let clickIdx = findIdx(['商品点击次数', '商品クリック数', 'クリック数', 'Productclicks']);
    let ctrIdx = findIdx(['CTR', '点击率']);
    let ctorIdx = findIdx(['CTOR', '点击成交转化率']);
    let cartAddIdx = findIdx(['カート追加', '加购数', '加购人数', 'Addtocart', 'Cartadditions', 'Unitsaddedtocart']);
    
    if (nameIdx < 0 && headerValues[0]?.includes('Product')) {
      nameIdx = 0; gmvIdx = 2; salesIdx = 3; custIdx = 4; ordIdx = 5;
      ctrIdx = 6; ctorIdx = 7; impIdx = 8; clickIdx = 9;
    }
    
    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length < 3) continue;
      let productName = '';
      if (nameIdx >= 0) productName = (values[nameIdx] || '').trim();
      if (!productName && idIdx >= 0) productName = (values[idIdx] || '').trim();
      if (!productName) productName = values[0]?.trim() || '';
      if (!productName || productName === 'Product' || productName === '商品名称' || productName === '商品名' || productName === '商品ID' || productName === '商品 ID') continue;
      if (productName.length > 490) productName = productName.substring(0, 490) + '...';
      products.push({
        productName,
        grossRevenue: gmvIdx >= 0 ? parseNum(values[gmvIdx]) : parseNum(values[1]),
        directGmv: gmvIdx >= 0 ? parseNum(values[gmvIdx]) : parseNum(values[2]),
        itemsSold: salesIdx >= 0 ? parseNum(values[salesIdx]) : parseNum(values[3]),
        customers: custIdx >= 0 ? parseNum(values[custIdx]) : parseNum(values[4]),
        orders: ordIdx >= 0 ? parseNum(values[ordIdx]) : parseNum(values[5]),
        ctr: ctrIdx >= 0 ? (values[ctrIdx] || null) : (values[6] || null),
        ctor: ctorIdx >= 0 ? (values[ctorIdx] || null) : (values[7] || null),
        productImpressions: impIdx >= 0 ? parseNum(values[impIdx]) : parseNum(values[8]),
        productClicks: clickIdx >= 0 ? parseNum(values[clickIdx]) : parseNum(values[9]),
        cartAddCount: cartAddIdx >= 0 ? parseNum(values[cartAddIdx]) : null,
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
        
        // Excelの行データを直接読み取り（ヘッダー行で日本語カラム名を検出）
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        let products: Array<{
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
        
        if (rows.length >= 2) {
          const headerRow = rows[0] as string[];
          // ヘッダー検出: 日本語、中国語、英語に対応
          const hasJapaneseHeaders = headerRow.some(h => typeof h === 'string' && (
            h === '商品ID' || h === '商品名' || h.includes('商品ID') || h.includes('商品名')
          ));
          const hasChineseHeaders = headerRow.some(h => typeof h === 'string' && (
            h.includes('商品 ID') || h.includes('商品名称') || h.includes('归因') || h.includes('GMV')
          ));
          
          if (hasJapaneseHeaders || hasChineseHeaders) {
            const colIndex: Record<string, number> = {};
            headerRow.forEach((h, i) => { if (typeof h === 'string') colIndex[h.trim()] = i; });
            
            // ヘッダー名の正規化マッピング（スペースあり/なし両対応）
            const findCol = (keys: string[]): number | undefined => {
              for (const key of keys) {
                if (colIndex[key] !== undefined) return colIndex[key];
                // スペースを除去して再検索
                const normalized = Object.keys(colIndex).find(k => k.replace(/\s/g, '') === key.replace(/\s/g, ''));
                if (normalized && colIndex[normalized] !== undefined) return colIndex[normalized];
              }
              return undefined;
            };
            
            const parseExcelNum = (val: any): number | null => {
              if (val === null || val === undefined || val === '' || val === '-') return null;
              const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[,円\s]/g, ''));
              return isNaN(num) ? null : num;
            };
            
            // カラムインデックスを検索（日本語・中国語両対応）
            const productNameCol = findCol(['商品名', '商品名称']);
            const productIdCol = findCol(['商品ID', '商品 ID']);
            const gmvCol = findCol(['GMV', '归因 GMV', '归因GMV', 'GMV（税込）']);
            const salesCountCol = findCol(['商品の販売数', '归因成交件数', '販売数']);
            const customerCountCol = findCol(['カスタマー数', '客户数', '顧客数']);
            const skuOrdersCol = findCol(['SKU注文数', '归因 SKU 订单数', '归因SKU订单数', 'SKU 注文数']);
            const ordersCol = findCol(['注文', '归因订单数', '归因訂単数', '注文数']);
            const ctrCol = findCol(['CTR', '点击率']);
            const ctorCol = findCol(['CTOR', '点击成交转化率']);
            const impressionsCol = findCol(['商品インプレッション数', '商品曝光次数', 'インプレッション数']);
            const clicksCol = findCol(['商品クリック数', '商品点击次数', 'クリック数']);
            const derivedGmvCol = findCol(['派生GMV']);
            
            for (let r = 1; r < rows.length; r++) {
              const row = rows[r] as any[];
              if (!row || row.length < 2) continue;
              
              // 商品名を取得（商品名カラム優先、なければ商品IDカラム）
              let productName = '';
              if (productNameCol !== undefined) {
                productName = String(row[productNameCol] || '').trim();
              }
              if (!productName && productIdCol !== undefined) {
                productName = String(row[productIdCol] || '').trim();
              }
              if (!productName) continue;
              
              // 商品名を500文字に制限（DB varchar(500)対応）
              if (productName.length > 490) {
                productName = productName.substring(0, 490) + '...';
              }
              
              const gmvVal = gmvCol !== undefined ? parseExcelNum(row[gmvCol]) : null;
              const salesCount = salesCountCol !== undefined ? parseExcelNum(row[salesCountCol]) : null;
              const customerCount = customerCountCol !== undefined ? parseExcelNum(row[customerCountCol]) : null;
              const skuOrders = skuOrdersCol !== undefined ? parseExcelNum(row[skuOrdersCol]) : null;
              const orders = ordersCol !== undefined ? parseExcelNum(row[ordersCol]) : null;
              const ctr = ctrCol !== undefined ? String(row[ctrCol] || '') : null;
              const ctor = ctorCol !== undefined ? String(row[ctorCol] || '') : null;
              const impressions = impressionsCol !== undefined ? parseExcelNum(row[impressionsCol]) : null;
              const clicks = clicksCol !== undefined ? parseExcelNum(row[clicksCol]) : null;
              const derivedGmv = derivedGmvCol !== undefined ? parseExcelNum(row[derivedGmvCol]) : null;
              
              products.push({
                productName,
                grossRevenue: derivedGmv || gmvVal,
                directGmv: gmvVal,
                itemsSold: salesCount,
                customers: customerCount,
                orders: orders || skuOrders,
                ctr,
                ctor,
                productImpressions: impressions,
                productClicks: clicks,
              });
            }
          } else {
            // 英語ヘッダーの場合は従来のCSVパースにフォールバック
            const csvText = XLSX.utils.sheet_to_csv(worksheet);
            products = parseProductCsv(csvText);
          }
        }
        
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
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(`CSVインポートエラー: ${errMsg.substring(0, 100)}`);
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

  // liverIdをバックエンドAPI（getLivestreamsByStreamerName）の返り値から取得
  // allLiversの名前完全一致に依存しないため、表記揺れがあっても確実に取得できる
  const liverId = useMemo(() => {
    return data?.liverId || null;
  }, [data]);

  // 商品ランキング（ライバー別）
  const { data: topProducts } = trpc.liverManagement.getTopProducts.useQuery(
    { liverId: liverId!, limit: 50, month: selectedMonth },
    { enabled: !!liverId }
  );

  // セット活用分析（ライバー別）
  const { data: setAnalysis } = trpc.livestreamSets.liverSetAnalysis.useQuery(
    { liverId: liverId! },
    { enabled: !!liverId }
  );

  // プロモーション分析（ライバー別）
  const { data: promoAnalysis } = trpc.livestreamPromotions.liverPromotionAnalysis.useQuery(
    { liverId: liverId! },
    { enabled: !!liverId }
  );

  // 月別売上商品一覧（ライバー別）
  const { data: monthlyProducts } = trpc.liverManagement.getMonthlyProductsByLiverId.useQuery(
    { liverId: liverId!, year: parseInt(selectedMonth.split('-')[0]), month: parseInt(selectedMonth.split('-')[1]) },
    { enabled: !!liverId }
  );

  // ブランド別配信時間集計（管理者向け）
  const { data: brandDurationStats } = trpc.liverManagement.getBrandDurationStats.useQuery(
    { liverId: liverId!, yearMonth: selectedMonth },
    { enabled: !!liverId }
  );

  // 全期間累計ブランド分析（管理者向け）
  const [showAllTimeAnalysis, setShowAllTimeAnalysis] = useState(true);
  const [forceRefreshAllTime, setForceRefreshAllTime] = useState(false);
  const [brandAnalysisMonth, setBrandAnalysisMonth] = useState<string>('all'); // 'all' = 全期間
  const { data: allTimeStats, isLoading: isAllTimeLoading, refetch: refetchAllTime } = trpc.liverManagement.getBrandAllTimeStats.useQuery(
    { liverId: liverId!, forceRefresh: forceRefreshAllTime, yearMonth: brandAnalysisMonth === 'all' ? undefined : brandAnalysisMonth },
    { enabled: !!liverId && showAllTimeAnalysis }
  );

  // スケジュール遵守率・配信ルール遵守状況取得（管理者向け）
  const { data: complianceStats } = trpc.liverManagement.getComplianceStats.useQuery(
    { liverId: liverId!, yearMonth: selectedMonth },
    { enabled: !!liverId }
  );

  // 商品名表示ヘルパー（数字IDの場合は短縮表示）
  const formatProductName = (name: string) => {
    if (/^\d{10,}$/.test(name)) {
      return `商品ID: ${name.slice(0, 6)}...${name.slice(-4)}`;
    }
    return name;
  };

  // ブランドタップで配信一覧展開用state
  const [expandedBrandId, setExpandedBrandId] = useState<number | null>(null);

  // 商品ランキングの表示切り替え
  const [showAllProducts, setShowAllProducts] = useState(false);
  // セット詳細の展開
  const [expandedSetId, setExpandedSetId] = useState<number | null>(null);
  const [expandedPromoId, setExpandedPromoId] = useState<number | null>(null);

  // セクションのアコーディオン用state
  const [showTopProductsSection, setShowTopProductsSection] = useState(false);
  const [showSetsSection, setShowSetsSection] = useState(false);
  const [setsSortOrder, setSetsSortOrder] = useState<'date' | 'revenue'>('date');
  const aiSetSuggestionMutation = trpc.livestreamSets.aiSetSuggestion.useMutation();
  const [showPromoSection, setShowPromoSection] = useState(false);
  const [showMonthlyProductsSection, setShowMonthlyProductsSection] = useState(false);
  const [showAiSuggestionsSection, setShowAiSuggestionsSection] = useState(false);
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<number | null>(null);

  // AI配信提案履歴
  const { data: aiSuggestions } = trpc.liveSuggestion.getHistoryByLiverName.useQuery(
    { liverName: decodedName, limit: 20 },
    { enabled: !!decodedName }
  );

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
  
  // 当月かどうかの判定
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return selectedMonth === currentYM;
  }, [selectedMonth]);

  // 月末予測売上計算（当月のみ）
  const calcForecast = (currentSales: number, prevSales: number, currentDurationMin: number) => {
    if (!isCurrentMonth || currentSales <= 0) return null;
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (dayOfMonth < 2) return null;
    const remainingDays = daysInMonth - dayOfMonth;
    const dailyAvg = currentSales / dayOfMonth;
    const baseForecast = dailyAvg * daysInMonth;
    const optimisticForecast = baseForecast * 1.2;
    const progress = Math.round((dayOfMonth / daysInMonth) * 100);
    
    const target = prevSales > 0 ? prevSales : baseForecast;
    const remainingSales = Math.max(0, target - currentSales);
    const hourlyRate = currentDurationMin > 0 ? currentSales / (currentDurationMin / 60) : 0;
    const remainingHours = hourlyRate > 0 ? remainingSales / hourlyRate : 0;
    const dailyHours = remainingDays > 0 ? remainingHours / remainingDays : 0;
    const perSessionTarget = remainingDays > 0 ? Math.round(remainingSales / remainingDays) : 0;
    const alreadyExceeded = prevSales > 0 && currentSales >= prevSales;
    
    return {
      base: Math.round(baseForecast),
      optimistic: Math.round(optimisticForecast),
      progress,
      remainingDays,
      remainingSales: Math.round(remainingSales),
      dailyHours: Math.round(dailyHours * 10) / 10,
      perSessionTarget,
      alreadyExceeded,
      target: Math.round(target),
    };
  };

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

        {/* 月末予測売上（当月のみ表示） */}
        {(() => {
          const prevMonthData = growthData && growthData.length >= 2 ? growthData[growthData.length - 2] : null;
          const prevSales = prevMonthData ? (prevMonthData as any).sales : 0;
          const forecast = calcForecast(data?.totalSales || 0, prevSales, data?.totalDuration || 0);
          if (!forecast) return null;
          return (
            <Card className="bg-gradient-to-r from-emerald-900/30 to-cyan-900/20 border-emerald-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-sm font-medium">📈 月末予測売上</span>
                  </div>
                  <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">月進捗: {forecast.progress}%</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-emerald-300/70 mb-1">現在ペース予測</p>
                    <p className="text-xl font-bold text-emerald-400">{formatCurrency(forecast.base)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-300/70 mb-1">🔥 配信頑張れば</p>
                    <p className="text-xl font-bold text-amber-400">{formatCurrency(forecast.optimistic)}</p>
                  </div>
                </div>
                {/* 配信目標ガイド */}
                <div className="mt-3 pt-3 border-t border-emerald-500/20">
                  {forecast.alreadyExceeded ? (
                    <>
                      <div className="text-sm text-emerald-300/90 font-medium">🎉 前月超え達成済み！自己ベスト更新を目指そう！</div>
                      {forecast.perSessionTarget > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-amber-300/70">💰 1配信の売上目標（自己ベスト更新ペース）:</span>
                          <span className="text-base font-bold text-amber-400">{formatCurrency(forecast.perSessionTarget)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {forecast.remainingSales > 0 && (
                        <div className="text-sm text-cyan-300/80">
                          ⏰ 前月超えまであと <span className="font-bold text-cyan-300">{formatCurrency(forecast.remainingSales)}</span>
                        </div>
                      )}
                      {forecast.dailyHours > 0 && forecast.remainingDays > 0 && (
                        <div className="mt-1 text-sm text-blue-300/70">
                          📅 残り{forecast.remainingDays}日 × 毎日{forecast.dailyHours}h配信でOK
                        </div>
                      )}
                      {forecast.perSessionTarget > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-amber-300/70">💰 1配信の売上目標:</span>
                          <span className="text-base font-bold text-amber-400">{formatCurrency(forecast.perSessionTarget)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* 配信ルール遵守状況（管理者向け） */}
        {complianceStats && complianceStats.totalStreams > 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">配信ルール遵守状況</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${complianceStats.overallComplianceRate >= 80 ? 'bg-emerald-500/20 text-emerald-400' : complianceStats.overallComplianceRate >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  総合 {complianceStats.overallComplianceRate}%
                </span>
              </div>

              {/* 総合遵守率バー */}
              <div className="mb-3">
                <Progress 
                  value={complianceStats.overallComplianceRate} 
                  className="h-2 bg-gray-700" 
                />
                {complianceStats.overallComplianceRate < 80 && (
                  <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    遵守率が低いため評価に影響あり
                  </p>
                )}
              </div>

              {/* 3つの指標 */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <Calendar className="h-3.5 w-3.5 text-blue-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">スケジュール</p>
                  <p className={`text-sm font-bold ${complianceStats.scheduleComplianceRate >= 80 ? 'text-emerald-400' : complianceStats.scheduleComplianceRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {complianceStats.scheduleComplianceRate}%
                  </p>
                  <p className="text-xs text-gray-500">{complianceStats.scheduledStreams}/{complianceStats.totalStreams}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <Clock className="h-3.5 w-3.5 text-purple-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">48h以内</p>
                  <p className={`text-sm font-bold ${complianceStats.registrationComplianceRate >= 80 ? 'text-emerald-400' : complianceStats.registrationComplianceRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {complianceStats.registrationComplianceRate}%
                  </p>
                  <p className="text-xs text-gray-500">{complianceStats.onTimeRegistrations}/{complianceStats.totalStreams}</p>
                  {complianceStats.consecutiveLate && complianceStats.consecutiveLate >= 2 && (
                    <p className="text-xs text-red-400 font-bold">連続{complianceStats.consecutiveLate}回🔥</p>
                  )}
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <Tag className="h-3.5 w-3.5 text-cyan-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">ブランド入力</p>
                  <p className={`text-sm font-bold ${complianceStats.brandInputRate >= 80 ? 'text-emerald-400' : complianceStats.brandInputRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {complianceStats.brandInputRate}%
                  </p>
                  <p className="text-xs text-gray-500">{complianceStats.brandInputStreams}/{complianceStats.totalStreams}</p>
                </div>
              </div>

              {/* 警告リスト */}
              {(complianceStats.unscheduledStreams > 0 || complianceStats.lateRegistrations > 0 || complianceStats.noBrandInputStreams > 0) && (
                <div className="space-y-1.5">
                  {complianceStats.unscheduledStreams > 0 && (
                    <div className="flex items-center gap-2 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span className="text-red-300">スケジュール未登録配信: {complianceStats.unscheduledStreams}件</span>
                    </div>
                  )}
                  {complianceStats.lateRegistrations > 0 && (
                    <div className="flex items-center gap-2 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2 py-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span className="text-yellow-300">
                        48h超過登録: {complianceStats.lateRegistrations}件
                        {complianceStats.lateRegistrationList && complianceStats.lateRegistrationList.length >= 2 && (
                          <span className="ml-1 text-red-400 font-bold">（連続{complianceStats.lateRegistrationList.length}回 🔥）</span>
                        )}
                        <span className="ml-1">→ 評価に影響します</span>
                      </span>
                    </div>
                  )}
                  {complianceStats.noBrandInputStreams > 0 && (
                    <div className="flex items-center gap-2 text-xs bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                      <span className="text-orange-300">ブランド時間未入力: {complianceStats.noBrandInputStreams}件</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 当月ブランドランキング */}
        {brandDurationStats && brandDurationStats.length > 0 && (() => {
          const rankedBrands = [...brandDurationStats]
            .filter((b: any) => b.csvGmv > 0 || b.totalMinutes > 0)
            .sort((a: any, b: any) => (b.csvGmv || 0) - (a.csvGmv || 0));
          const monthLabel = selectedMonth ? `${parseInt(selectedMonth.split('-')[1])}月` : '当月';
          if (rankedBrands.length === 0) return null;
          return (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="h-5 w-5 text-yellow-400" />
                  <h3 className="text-base font-bold text-white">{monthLabel} ブランドランキング</h3>
                  <span className="text-[10px] text-white/40 ml-1">売上順</span>
                </div>
                <div className="space-y-1.5">
                  {rankedBrands.slice(0, 10).map((brand: any, idx: number) => {
                    const hours = brand.totalHours || Math.round(brand.totalMinutes / 60 * 10) / 10;
                    const hourlyRate = brand.hourlyRate || (hours > 0 ? Math.round(brand.csvGmv / hours) : 0);
                    return (
                      <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        idx === 0 ? 'bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border border-yellow-500/20' :
                        idx <= 2 ? 'bg-gradient-to-r from-gray-800/50 to-gray-700/30 border border-gray-600/20' :
                        'bg-gray-800/30'
                      }`}>
                        <span className={`text-sm font-bold w-6 text-center ${
                          idx === 0 ? 'text-yellow-400' : idx <= 2 ? 'text-gray-300' : 'text-gray-500'
                        }`}>
                          {idx === 0 ? '\u{1F947}' : idx === 1 ? '\u{1F948}' : idx === 2 ? '\u{1F949}' : `${idx + 1}`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-white truncate block">
                            {brand.brandNameJa || brand.brandName}
                          </span>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-white/40">{brand.streamCount}回</span>
                            <span className="text-[10px] text-white/40">{hours}h</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {brand.csvGmv > 0 ? (
                            <div className="text-xs font-bold text-yellow-400">¥{brand.csvGmv >= 10000 ? `${Math.round(brand.csvGmv / 10000)}万` : brand.csvGmv.toLocaleString()}</div>
                          ) : (
                            <div className="text-xs text-white/30">CSV未確認</div>
                          )}
                          {hourlyRate > 0 && (
                            <div className={`text-[10px] font-bold ${
                              hourlyRate >= 50000 ? 'text-orange-400' :
                              hourlyRate >= 15000 ? 'text-cyan-400' :
                              'text-red-400'
                            }`}>¥{hourlyRate >= 10000 ? `${Math.round(hourlyRate / 10000)}万` : hourlyRate.toLocaleString()}/h</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* ブランド別配信時間 */}
        {brandDurationStats && brandDurationStats.length > 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">ブランド別配信時間</h3>
                <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
                  {brandDurationStats.length}ブランド
                </span>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-sm font-bold text-cyan-400">
                    {Math.round(brandDurationStats.reduce((sum: number, b: any) => sum + b.totalMinutes, 0) / 60 * 10) / 10}h
                  </span>
                  {brandDurationStats.reduce((sum: number, b: any) => sum + (b.csvGmv || 0), 0) > 0 && (
                    <span className="text-sm font-bold text-yellow-400">
                      ¥{brandDurationStats.reduce((sum: number, b: any) => sum + (b.csvGmv || 0), 0).toLocaleString()}
                    </span>
                  )}
                  {(() => {
                    const totalGmv = brandDurationStats.reduce((sum: number, b: any) => sum + (b.csvGmv || 0), 0);
                    const totalHours = brandDurationStats.reduce((sum: number, b: any) => sum + b.totalMinutes, 0) / 60;
                    if (totalGmv > 0 && totalHours > 0) {
                      return <span className="text-xs text-emerald-400">¥{Math.round(totalGmv / totalHours).toLocaleString()}/h</span>;
                    }
                    return null;
                  })()}
                </div>
              </div>
              <div className="space-y-2">
                {(() => {
                  const maxMinutes = Math.max(...brandDurationStats.map((b: any) => b.totalMinutes));
                  const colors = [
                    'from-cyan-500 to-blue-500',
                    'from-pink-500 to-rose-500',
                    'from-amber-500 to-orange-500',
                    'from-emerald-500 to-green-500',
                    'from-violet-500 to-purple-500',
                    'from-red-500 to-pink-500',
                    'from-teal-500 to-cyan-500',
                    'from-yellow-500 to-amber-500',
                  ];
                  return brandDurationStats.map((brand: any, idx: number) => {
                    const barWidth = maxMinutes > 0 ? (brand.totalMinutes / maxMinutes) * 100 : 0;
                    const hours = Math.floor(brand.totalMinutes / 60);
                    const mins = brand.totalMinutes % 60;
                    const colorClass = colors[idx % colors.length];
                    const isExpanded = expandedBrandId === brand.brandId;
                    // ブランドに属する配信一覧をフィルタリング
                    const allBrandIds: number[] = brand.brandIds || [brand.brandId];
                    // セクション1: ヘッダーの回数と一致する配信
                    // バックエンドのgetLiverBrandDurationStatsと同じ合算ロジック:
                    // - 新テーブル(livestream_brands)にdurationMinutes > 0のエントリがある配信 → 含める
                    // - 旧テーブル(brand_livestreams.brandId)が一致しduration > 0の配信 → 新テーブルでカバーされていなければ含める
                    // 両方を合算して表示する
                    
                    // 新テーブルでカバーされている配信IDのセットを構築
                    const newTableCoveredIds = new Set<number>();
                    if (data?.livestreams) {
                      for (const l of data.livestreams) {
                        if (l.livestreamBrands && Array.isArray(l.livestreamBrands)) {
                          const hasValidBrandDuration = l.livestreamBrands.some((lb: any) => 
                            allBrandIds.includes(lb.brandId) && lb.durationMinutes && lb.durationMinutes > 0
                          );
                          if (hasValidBrandDuration) newTableCoveredIds.add(l.id);
                        }
                      }
                    }
                    
                    const registeredStreams = isExpanded && data?.livestreams
                      ? data.livestreams.filter((l: any) => {
                          // 新テーブル: livestreamBrandsにdurationMinutes > 0のエントリがある
                          if (newTableCoveredIds.has(l.id)) return true;
                          // 旧テーブル: brandIdが一致しduration > 0、かつ新テーブルでカバーされていない
                          if (!newTableCoveredIds.has(l.id) && allBrandIds.includes(l.brandId) && l.duration && l.duration > 0) {
                            return true;
                          }
                          return false;
                        })
                      : [];
                    // セクション2: CSV売上のみ（ブランド時間未入力だがCSV売上がある配信）
                    // 全ステータスのブランドで表示（ヘッダーの売上合計と展開詳細の合計を一致させるため）
                    const csvOnlyStreams = isExpanded && data?.livestreams
                      ? data.livestreams.filter((l: any) => {
                          // registeredStreamsに含まれている配信は除外
                          // 新テーブルでカバーされている配信を除外
                          if (newTableCoveredIds.has(l.id)) return false;
                          // 旧テーブルでカバーされている配信を除外
                          if (allBrandIds.includes(l.brandId) && l.duration && l.duration > 0) return false;
                          // brandCsvSalesに該当ブランドの売上がある
                          if (l.brandCsvSales && typeof l.brandCsvSales === 'object') {
                            const csvSalesForBrand = allBrandIds.reduce((sum: number, bid: number) => sum + (l.brandCsvSales[bid] || 0), 0);
                            if (csvSalesForBrand > 0) return true;
                          }
                          return false;
                        })
                      : [];
                    const brandLivestreams = registeredStreams;
                    return (
                      <div key={brand.brandId}>
                        <div
                          className={`space-y-1 p-2 rounded-lg cursor-pointer transition-all ${
                            isExpanded ? 'bg-gray-800/60 border border-cyan-500/30' : 'hover:bg-gray-800/30'
                          }`}
                          onClick={() => setExpandedBrandId(isExpanded ? null : brand.brandId)}
                          data-brand-ids={JSON.stringify(allBrandIds)}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 flex-1">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-cyan-400" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                              <span className="text-white font-medium truncate">{brand.brandNameJa || brand.brandName}{brand.brandNameJa && brand.brandNameJa !== brand.brandName && <span className="text-[10px] text-white/40 ml-1">({brand.brandName})</span>}</span>
                              {brand.status === 'unregistered' && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">⚠️ 未入力</span>
                              )}
                              {brand.status === 'no_csv' && brand.totalMinutes > 0 && (
                                <span className="text-[10px] bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded">CSV未確認</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                              {brand.csvGmv > 0 && (
                                <span className="text-yellow-400 font-bold text-xs">
                                  ¥{brand.csvGmv.toLocaleString()}
                                </span>
                              )}
                              {brand.hourlyRate > 0 && (
                                <span className="text-emerald-400 text-[10px]">
                                  ¥{brand.hourlyRate.toLocaleString()}/h
                                </span>
                              )}
                              <span className="text-gray-400 text-xs">
                                {brand.streamCount}回
                              </span>
                              <span className="text-cyan-400 font-bold text-sm">
                                {hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ''}` : brand.totalMinutes > 0 ? `${mins}m` : '-'}
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500`}
                              style={{ width: `${Math.max(barWidth, 3)}%` }}
                            />
                          </div>
                        </div>
                        {/* ブランド配信一覧展開 - セクション1: ブランド時間入力済み */}
                        {isExpanded && brandLivestreams.length > 0 && (
                          <div className="ml-6 mt-2 mb-1 space-y-1">
                            {brandLivestreams.map((ls: any) => {
                              // 該当ブランドの配信時間を取得
                              // 優先1: livestreamBrandsテーブルのdurationMinutes
                              const newTableDuration = ls.livestreamBrands && Array.isArray(ls.livestreamBrands)
                                ? ls.livestreamBrands
                                    .filter((lb: any) => allBrandIds.includes(lb.brandId))
                                    .reduce((sum: number, lb: any) => sum + (lb.durationMinutes || 0), 0)
                                : 0;
                              // 優先2: 旧テーブルのduration（brand_livestreams.duration = 配信全体の時間）
                              const brandDuration = newTableDuration > 0 ? newTableDuration : (allBrandIds.includes(ls.brandId) ? (ls.duration || 0) : 0);
                              // 該当ブランドのCSV売上を取得
                              const brandCsvSales = ls.brandCsvSales && typeof ls.brandCsvSales === 'object'
                                ? allBrandIds.reduce((sum: number, bid: number) => sum + (ls.brandCsvSales[bid] || 0), 0)
                                : 0;
                              return (
                                <div
                                  key={ls.id}
                                  className="flex items-center justify-between text-xs p-2 rounded bg-gray-800/40 border border-gray-700/30 hover:border-cyan-500/30 cursor-pointer transition-all"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/livestreams/${ls.id}`); }}
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-gray-400" />
                                    <span className="text-white">{formatDate(ls.livestreamDate)}</span>
                                    {formatTimeRange(ls) && (
                                      <span className="text-gray-500">{formatTimeRange(ls)}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-yellow-400 font-mono">
                                      {brandCsvSales > 0 ? formatCurrency(brandCsvSales) : <span className="text-gray-500">-</span>}
                                    </span>
                                    <span className="text-blue-400">
                                      {brandDuration > 0 ? formatDuration(brandDuration) : <span className="text-gray-500">-</span>}
                                    </span>
                                    <ChevronRight className="w-3 h-3 text-gray-500" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* セクション2: CSV売上のみ（ブランド時間未入力） */}
                        {isExpanded && csvOnlyStreams.length > 0 && (
                          <div className="ml-6 mt-1 mb-1 space-y-1">
                            <div className="text-[10px] text-gray-500 px-2 pt-1">CSV売上のみ（ブランド時間未入力）</div>
                            {csvOnlyStreams.map((ls: any) => {
                              const brandCsvSales = ls.brandCsvSales && typeof ls.brandCsvSales === 'object'
                                ? allBrandIds.reduce((sum: number, bid: number) => sum + (ls.brandCsvSales[bid] || 0), 0)
                                : 0;
                              return (
                                <div
                                  key={ls.id}
                                  className="flex items-center justify-between text-xs p-2 rounded bg-gray-800/20 border border-gray-700/20 hover:border-amber-500/30 cursor-pointer transition-all opacity-70"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/livestreams/${ls.id}`); }}
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-gray-500" />
                                    <span className="text-gray-300">{formatDate(ls.livestreamDate)}</span>
                                    {formatTimeRange(ls) && (
                                      <span className="text-gray-600">{formatTimeRange(ls)}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-yellow-400/70 font-mono">
                                      {brandCsvSales > 0 ? formatCurrency(brandCsvSales) : <span className="text-gray-500">-</span>}
                                    </span>
                                    <span className="text-gray-500">-</span>
                                    <ChevronRight className="w-3 h-3 text-gray-600" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {isExpanded && brandLivestreams.length === 0 && csvOnlyStreams.length === 0 && (
                          <div className="ml-6 mt-2 mb-1 text-xs text-gray-500 p-2">
                            このブランドの配信データはこの月にはありません
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ブランド分析 */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                {brandAnalysisMonth === 'all' ? '全期間累計' : `${brandAnalysisMonth.replace('-', '年')}月`}ブランド分析
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {/* 月選択セレクター */}
                <Select value={brandAnalysisMonth} onValueChange={(value) => setBrandAnalysisMonth(value)}>
                  <SelectTrigger className="w-32 h-7 bg-transparent border-gray-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="all" className="text-white hover:bg-gray-800 text-xs">全期間</SelectItem>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-800 text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showAllTimeAnalysis && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setForceRefreshAllTime(true);
                      setTimeout(() => {
                        refetchAllTime();
                        setForceRefreshAllTime(false);
                      }, 100);
                    }}
                    className="text-xs h-7 border-cyan-700 text-cyan-400 hover:text-cyan-300 hover:border-cyan-500"
                    disabled={isAllTimeLoading}
                  >
                    {isAllTimeLoading ? '計算中...' : '再計算'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllTimeAnalysis(!showAllTimeAnalysis)}
                  className="text-xs h-7 border-gray-700 text-white/70 hover:text-white"
                >
                  {showAllTimeAnalysis ? '閉じる' : '分析を開く'}
                </Button>
              </div>
            </div>
            {showAllTimeAnalysis && (
              <div className="space-y-4">
                {isAllTimeLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
                    <span className="ml-2 text-sm text-white/60">分析中...（全期間データ取得中）</span>
                  </div>
                )}
                {allTimeStats && !isAllTimeLoading && (
                  <>
                    {/* ブランド相性スコア */}
                    {allTimeStats.compatibilityScores && allTimeStats.compatibilityScores.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          ブランド相性スコア
                          <span className="text-[10px] text-white/40 font-normal ml-1">実績・効率・信頼度・安定性の総合評価</span>
                        </h4>
                        <div className="space-y-1.5">
                          {allTimeStats.compatibilityScores.slice(0, 10).map((brand: any, idx: number) => (
                            <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                              idx === 0 ? 'bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border border-yellow-500/20' :
                              idx <= 2 ? 'bg-gradient-to-r from-gray-800/50 to-gray-700/30 border border-gray-600/20' :
                              'bg-gray-800/30'
                            }`}>
                              <span className={`text-sm font-bold w-6 text-center ${
                                idx === 0 ? 'text-yellow-400' : idx <= 2 ? 'text-gray-300' : 'text-gray-500'
                              }`}>
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-medium text-white truncate">
                                    {brand.brandNameJa || brand.brandName}
                                  </span>
                                  {brand.brandNameJa && brand.brandNameJa !== brand.brandName && (
                                    <span className="text-[10px] text-white/40">({brand.brandName})</span>
                                  )}
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    brand.stability === '安定' ? 'bg-emerald-900/40 text-emerald-400' :
                                    brand.stability === '普通' ? 'bg-yellow-900/40 text-yellow-400' :
                                    brand.stability === 'データ不足' ? 'bg-blue-900/40 text-blue-400' :
                                    'bg-red-900/40 text-red-400'
                                  }`}>{brand.stability}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[10px] text-white/40">{brand.streamCount}回配信</span>
                                  <span className="text-[10px] text-white/40">{brand.totalHours}h</span>
                                  <span className="text-[10px] text-white/40">{brand.monthsActive}ヶ月活動</span>
                                  {brand.reliabilityFactor !== undefined && brand.reliabilityFactor < 1 && (
                                    <span className="text-[10px] text-blue-400">信頼度{Math.round(brand.reliabilityFactor * 100)}%</span>
                                  )}
                                  {brand.cv !== undefined && brand.cv > 0 && brand.streamCount >= 5 && (
                                    <span className="text-[10px] text-white/30">CV:{brand.cv}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-bold text-cyan-400">¥{brand.avgHourlyRate >= 10000 ? `${Math.round(brand.avgHourlyRate / 10000)}万` : brand.avgHourlyRate.toLocaleString()}/h</div>
                                <div className="text-[10px] text-yellow-400">¥{brand.totalGmv >= 10000 ? `${Math.round(brand.totalGmv / 10000)}万` : brand.totalGmv.toLocaleString()}</div>
                              </div>
                              <div className="text-right ml-2">
                                <div className="text-sm font-bold text-orange-400">{brand.score.toLocaleString()}</div>
                                <div className="text-[10px] text-white/30">スコア</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ブランド配信効率アラート（全期間分析内に統合） */}
                    {allTimeStats.compatibilityScores && allTimeStats.compatibilityScores.length > 0 && (() => {
                      const topPerformers = allTimeStats.compatibilityScores.filter((b: any) => b.avgHourlyRate >= 50000);
                      const lowPerformers = allTimeStats.compatibilityScores.filter((b: any) => b.avgHourlyRate < 15000 && b.totalHours >= 1);
                      
                      if (topPerformers.length === 0 && lowPerformers.length === 0) return null;
                      
                      return (
                        <div>
                          <h4 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" />
                            配信効率アラート
                            <span className="text-[10px] text-white/40 font-normal ml-1">🔥=高効率（¥5万+/h） ⚠️=低効率（¥1.5万未満/h・1h以上配信）</span>
                          </h4>
                          <div className="space-y-3">
                            {topPerformers.length > 0 && (
                              <div className="p-3 rounded-lg bg-gradient-to-r from-orange-900/20 to-amber-900/20 border border-orange-500/20">
                                <p className="text-xs font-bold text-orange-300 mb-2">🔥 高効率ブランド — もっと配信時間を増やすべき</p>
                                <div className="space-y-1.5">
                                  {topPerformers.map((brand: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800/40">
                                      <span className="text-xs text-orange-200 font-medium">{brand.brandNameJa || brand.brandName}{brand.brandNameJa && brand.brandNameJa !== brand.brandName && <span className="text-[10px] text-orange-200/60 ml-0.5">({brand.brandName})</span>}</span>
                                      <span className="text-xs font-bold text-orange-400 ml-auto">¥{brand.avgHourlyRate >= 10000 ? `${Math.round(brand.avgHourlyRate / 10000)}万` : brand.avgHourlyRate.toLocaleString()}/h</span>
                                      <span className="text-[10px] text-white/40">{brand.totalHours}h</span>
                                      <span className="text-[10px] text-yellow-400">¥{brand.totalGmv >= 10000 ? `${Math.round(brand.totalGmv / 10000)}万` : brand.totalGmv.toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {lowPerformers.length > 0 && (
                              <div className="p-3 rounded-lg bg-gradient-to-r from-red-900/20 to-pink-900/20 border border-red-500/20">
                                <p className="text-xs font-bold text-red-300 mb-2">⚠️ 低効率ブランド — 配信ブランド見直し推奨</p>
                                <div className="space-y-1.5">
                                  {lowPerformers.map((brand: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800/40">
                                      <span className="text-xs text-red-200 font-medium">{brand.brandNameJa || brand.brandName}{brand.brandNameJa && brand.brandNameJa !== brand.brandName && <span className="text-[10px] text-red-200/60 ml-0.5">({brand.brandName})</span>}</span>
                                      <span className="text-xs font-bold text-red-400 ml-auto">¥{brand.avgHourlyRate.toLocaleString()}/h</span>
                                      <span className="text-[10px] text-white/40">{brand.totalHours}h</span>
                                      <span className="text-[10px] text-red-300">¥{brand.totalGmv >= 10000 ? `${Math.round(brand.totalGmv / 10000)}万` : brand.totalGmv.toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {topPerformers.length > 0 && lowPerformers.length > 0 && (
                              <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-900/20 to-teal-900/20 border border-emerald-500/20">
                                <p className="text-xs font-bold text-emerald-300 mb-2">💡 提案 — 配信ブランド変更で売上アップ</p>
                                <div className="space-y-1.5">
                                  {lowPerformers.slice(0, 3).map((low: any, idx: number) => {
                                    const suggested = topPerformers[0];
                                    const potentialGain = Math.round(low.totalHours * (suggested.avgHourlyRate - low.avgHourlyRate));
                                    return (
                                      <div key={idx} className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-gray-800/40 text-xs flex-wrap">
                                        <span className="text-red-300 line-through">{low.brandNameJa || low.brandName}</span>
                                        <span className="text-red-400 text-[10px]">¥{low.avgHourlyRate.toLocaleString()}/h</span>
                                        <span className="text-white/50">→</span>
                                        <span className="text-emerald-300 font-bold">{suggested.brandNameJa || suggested.brandName}</span>
                                        <span className="text-emerald-400 text-[10px]">¥{suggested.avgHourlyRate >= 10000 ? `${Math.round(suggested.avgHourlyRate / 10000)}万` : suggested.avgHourlyRate.toLocaleString()}/h</span>
                                        {potentialGain > 0 && (
                                          <span className="text-[10px] text-emerald-200 ml-auto">+¥{potentialGain.toLocaleString()}見込</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 全期間累計サマリー */}
                    {allTimeStats.summary && allTimeStats.summary.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-purple-400 mb-2 flex items-center gap-1">
                          <BarChart3 className="w-3.5 h-3.5" />
                          全期間累計実績
                          <span className="text-[10px] text-white/40 font-normal ml-1">総配信時間・総売上・平均時間単価</span>
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-white/50 border-b border-gray-700">
                                <th className="text-left py-1.5 px-2">ブランド</th>
                                <th className="text-right py-1.5 px-2">配信時間</th>
                                <th className="text-right py-1.5 px-2">配信回数</th>
                                <th className="text-right py-1.5 px-2">総売上</th>
                                <th className="text-right py-1.5 px-2">時間単価</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allTimeStats.summary.filter((b: any) => b.totalMinutes > 0 || b.csvGmv > 0).map((brand: any, idx: number) => (
                                <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                  <td className="py-1.5 px-2">
                                    <span className="text-white font-medium">{brand.brandNameJa || brand.brandName}</span>
                                    {brand.brandNameJa && brand.brandNameJa !== brand.brandName && (
                                      <span className="text-[10px] text-white/30 ml-1">({brand.brandName})</span>
                                    )}
                                  </td>
                                  <td className="text-right py-1.5 px-2 text-white/70">{brand.totalHours}h</td>
                                  <td className="text-right py-1.5 px-2 text-white/70">{brand.streamCount}回</td>
                                  <td className="text-right py-1.5 px-2">
                                    {brand.csvGmv > 0 ? (
                                      <span className="text-yellow-400">¥{brand.csvGmv >= 10000 ? `${Math.round(brand.csvGmv / 10000)}万` : brand.csvGmv.toLocaleString()}</span>
                                    ) : (
                                      <span className="text-white/30">-</span>
                                    )}
                                  </td>
                                  <td className="text-right py-1.5 px-2">
                                    {brand.hourlyRate > 0 ? (
                                      <span className={`font-bold ${
                                        brand.hourlyRate >= 50000 ? 'text-orange-400' :
                                        brand.hourlyRate >= 15000 ? 'text-cyan-400' :
                                        'text-red-400'
                                      }`}>¥{brand.hourlyRate >= 10000 ? `${Math.round(brand.hourlyRate / 10000)}万` : brand.hourlyRate.toLocaleString()}/h</span>
                                    ) : (
                                      <span className="text-white/30">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 月別推移 */}
                    {allTimeStats.monthlyTrends && allTimeStats.monthlyTrends.length > 0 && allTimeStats.months && allTimeStats.months.length > 0 && (() => {
                      // 連続月のみ表示（最新から過去6ヶ月の連続範囲）
                      const now = new Date();
                      const continuousMonths: string[] = [];
                      for (let i = 0; i < 6; i++) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        continuousMonths.unshift(ym);
                      }
                      return (
                        <div>
                          <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            ブランド別月別推移
                            <span className="text-[10px] text-white/40 font-normal ml-1">過去6ヶ月の売上・時間単価</span>
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="text-white/50 border-b border-gray-700">
                                  <th className="text-left py-1.5 px-1 sticky left-0 bg-gray-900/90 z-10 min-w-[80px]">ブランド</th>
                                  {continuousMonths.map((m: string) => (
                                    <th key={m} className="text-center py-1.5 px-1 min-w-[70px]">
                                      <div>{parseInt(m.slice(5))}月</div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {allTimeStats.monthlyTrends.slice(0, 10).map((brand: any, idx: number) => (
                                  <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                    <td className="py-2 px-1 sticky left-0 bg-gray-900/90 z-10">
                                      <span className="text-white font-medium truncate block max-w-[80px]" title={brand.brandNameJa || brand.brandName}>
                                        {brand.brandNameJa || brand.brandName}
                                      </span>
                                    </td>
                                    {continuousMonths.map((m: string) => {
                                      const monthData = brand.months.find((md: any) => md.yearMonth === m);
                                      return (
                                        <td key={m} className="text-center py-2 px-1">
                                          {monthData && (monthData.csvGmv > 0 || monthData.totalMinutes > 0) ? (
                                            <div className="space-y-0.5">
                                              <div className={`font-bold ${
                                                monthData.csvGmv > 0 && monthData.hourlyRate >= 50000 ? 'text-orange-400' :
                                                monthData.csvGmv > 0 && monthData.hourlyRate >= 15000 ? 'text-cyan-400' :
                                                monthData.csvGmv > 0 ? 'text-yellow-400' : 'text-white/40'
                                              }`}>
                                                {monthData.csvGmv > 0 ? `¥${monthData.csvGmv >= 10000 ? `${Math.round(monthData.csvGmv / 10000)}万` : monthData.csvGmv.toLocaleString()}` : '-'}
                                              </div>
                                              {monthData.totalHours > 0 && (
                                                <div className="text-white/50 text-[9px]">{monthData.totalHours}h</div>
                                              )}
                                              {monthData.hourlyRate > 0 && (
                                                <div className={`text-[9px] ${
                                                  monthData.hourlyRate >= 50000 ? 'text-orange-300' :
                                                  monthData.hourlyRate >= 15000 ? 'text-cyan-300' :
                                                  'text-red-300'
                                                }`}>¥{monthData.hourlyRate >= 10000 ? `${Math.round(monthData.hourlyRate / 10000)}万` : Math.round(monthData.hourlyRate / 1000) + 'k'}/h</div>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-white/10">—</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
                {allTimeStats && !isAllTimeLoading && allTimeStats.summary?.length === 0 && (
                  <p className="text-sm text-white/40 text-center py-4">ブランド配信データがありません</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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
                        
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
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

                          {/* 時間単価 */}
                          {livestream.duration && livestream.duration > 0 && livestream.salesAmount ? (
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-cyan-500" />
                              <div>
                                <p className="text-xs text-white">時間単価</p>
                                <p className="font-medium text-cyan-400">
                                  ¥{Math.round(livestream.salesAmount / (livestream.duration / 60)).toLocaleString()}/h
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        
                        {/* ブランド別配信時間 */}
                        {(livestream as any).livestreamBrands && (livestream as any).livestreamBrands.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-700/50">
                            <div className="flex flex-wrap gap-1.5">
                              {(livestream as any).livestreamBrands.map((lb: any, idx: number) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-orange-900/30 text-orange-300 border border-orange-700/30">
                                  <Tag className="w-3 h-3" />
                                  {lb.brandName}
                                  {lb.durationMinutes != null && (
                                    <span className="text-orange-400 font-medium ml-0.5">
                                      {lb.durationMinutes >= 60
                                        ? `${Math.floor(lb.durationMinutes / 60)}時間${lb.durationMinutes % 60 > 0 ? `${lb.durationMinutes % 60}分` : ''}`
                                        : `${lb.durationMinutes}分`}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {livestream.remarks && (
                          <p className="mt-2 text-sm text-white border-t border-gray-700 pt-2 line-clamp-2">
                            {livestream.remarks}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
                          <div className="flex items-center gap-2">
                          {/* CSVアップロードボタン（ライバー本人または管理者） */}
                          {canUploadCsv && (
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
              <h2
                className="text-lg font-bold flex items-center gap-3 cursor-pointer select-none"
                onClick={() => setShowTopProductsSection(!showTopProductsSection)}
              >
                <Crown className="w-6 h-6 text-yellow-400" />
                <span className="text-white">売れ筋商品ランキング</span>
                <span className="text-gray-400 text-sm">
                  {showAllProducts ? `全${topProducts.length}件` : `TOP10`}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
                </span>
                <span className="ml-auto">
                  {showTopProductsSection ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </span>
              </h2>
              {showTopProductsSection && <div className="mt-6">
              
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
                        <td className="py-3 px-2 text-white font-medium break-words">
                          {formatProductName(product.productName)}
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
              </div>}
            </CardContent>
          </Card>
        )}

        {/* セット活用情報 */}
        {setAnalysis && setAnalysis.sets && setAnalysis.sets.length > 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6">
              <h2
                className="text-lg font-bold flex items-center gap-3 cursor-pointer select-none"
                onClick={() => setShowSetsSection(!showSetsSection)}
              >
                <Package className="w-6 h-6 text-pink-400" />
                <span className="text-white">セット活用情報</span>
                <span className="text-gray-400 text-sm">{setAnalysis.sets.length}セット</span>
                <span className="ml-auto">
                  {showSetsSection ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </span>
              </h2>
              {showSetsSection && <div className="mt-4">
              
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
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gray-400 text-xs">並び替え:</span>
                <button
                  onClick={() => setSetsSortOrder('date')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    setsSortOrder === 'date'
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:text-gray-200'
                  }`}
                >
                  新着順
                </button>
                <button
                  onClick={() => setSetsSortOrder('revenue')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    setsSortOrder === 'revenue'
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:text-gray-200'
                  }`}
                >
                  売上順
                </button>
              </div>
              <div className="space-y-2">
                {[...setAnalysis.sets]
                  .sort((a: any, b: any) => {
                    if (setsSortOrder === 'date') {
                      const dateA = a.livestreamDate ? new Date(a.livestreamDate).getTime() : 0;
                      const dateB = b.livestreamDate ? new Date(b.livestreamDate).getTime() : 0;
                      return dateB - dateA;
                    }
                    return (b.totalRevenue || 0) - (a.totalRevenue || 0);
                  })
                  .map((set: any) => {
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
                            {set.items.map((item: any, idx: number) => {
                              const qty = item.quantity || 1;
                              return (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-300">{formatProductName(item.productName)} ×{qty}</span>
                                  <span className="text-gray-500 font-mono">¥{Number(item.originalPrice || 0).toLocaleString()} ×{qty}</span>
                                </div>
                              );
                            })}
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
                        <span className="text-white font-medium">{formatProductName(product.productName)}</span>
                        <span className="text-pink-400 ml-2">{product.count}回使用</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* AIセット提案 */}
              {liverId && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => aiSetSuggestionMutation.mutate({ liverId, liverName: decodedName })}
                    disabled={aiSetSuggestionMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium hover:from-purple-500/30 hover:to-pink-500/30 transition-all disabled:opacity-50"
                  >
                    {aiSetSuggestionMutation.isPending ? (
                      <><Sparkles className="w-4 h-4 animate-spin" /> AI分析中...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> AIセット提案を取得</>
                    )}
                  </button>
                  {aiSetSuggestionMutation.data && (
                    <div className="mt-3 p-4 rounded-lg bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-300 font-medium text-sm">AIセット提案</span>
                        <span className="text-purple-300/50 text-xs">(分析セット数: {aiSetSuggestionMutation.data.analyzedSets})</span>
                      </div>
                      <div className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                        {aiSetSuggestionMutation.data.suggestion}
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>}
            </CardContent>
          </Card>
        )}

        {/* プロモーション単品割引一覧 */}
        {promoAnalysis && promoAnalysis.promotions && promoAnalysis.promotions.length > 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6">
              <h2
                className="text-lg font-bold flex items-center gap-3 cursor-pointer select-none"
                onClick={() => setShowPromoSection(!showPromoSection)}
              >
                <Tag className="w-6 h-6 text-violet-400" />
                <span className="text-white">プロモーション単品割引</span>
                <span className="text-gray-400 text-sm">{promoAnalysis.promotions.length}件</span>
                <span className="ml-auto">
                  {showPromoSection ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </span>
              </h2>
              {showPromoSection && <div className="mt-4">
              
              {/* サマリー */}
              {promoAnalysis.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 text-center">
                    <div className="text-gray-400 text-xs mb-1">割引件数</div>
                    <div className="text-violet-400 font-bold text-lg">{promoAnalysis.summary.totalPromos}件</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 text-center">
                    <div className="text-gray-400 text-xs mb-1">割引売上合計</div>
                    <div className="text-emerald-400 font-mono font-bold text-lg">¥{Number(promoAnalysis.summary.totalPromoRevenue).toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 text-center">
                    <div className="text-gray-400 text-xs mb-1">販売数合計</div>
                    <div className="text-cyan-300 font-bold text-lg">{promoAnalysis.summary.totalQuantitySold}個</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 text-center">
                    <div className="text-gray-400 text-xs mb-1">平均割引率</div>
                    <div className="text-orange-400 font-bold text-lg">{promoAnalysis.summary.avgDiscountRate}%OFF</div>
                  </div>
                </div>
              )}

              {/* プロモーション一覧 */}
              <div className="space-y-2">
                {promoAnalysis.promotions.map((promo: any) => {
                  const isExpanded = expandedPromoId === promo.id;
                  return (
                    <div key={promo.id}>
                      <div
                        onClick={() => setExpandedPromoId(isExpanded ? null : promo.id)}
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          isExpanded
                            ? 'bg-gray-800/80 border-violet-400/40'
                            : 'bg-gray-800/40 border-gray-700/50 hover:border-violet-400/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Tag className="w-4 h-4 text-violet-400 shrink-0" />
                            <span className="text-white font-semibold text-sm">{promo.productName}</span>
                            {promo.discountRate != null && Number(promo.discountRate) > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold">
                                {Math.round(Number(promo.discountRate))}%OFF
                              </span>
                            )}
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-violet-400" />
                              : <ChevronDown className="w-4 h-4 text-gray-500" />
                            }
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            {promo.livestreamDate && (
                              <span className="text-gray-400">
                                {new Date(promo.livestreamDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <div>
                            <span className="text-gray-400">元値: </span>
                            <span className="text-gray-300 line-through">¥{Number(promo.originalPrice || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">割引後: </span>
                            <span className="text-yellow-400 font-bold">¥{Number(promo.discountPrice || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">数量: </span>
                            <span className="text-cyan-300 font-bold">{promo.quantity || 1}個</span>
                          </div>
                          <div>
                            <span className="text-gray-400">売上: </span>
                            <span className="text-emerald-400 font-mono font-bold">¥{Number(promo.totalRevenue || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* よく割引される商品 */}
              {promoAnalysis.topProducts && promoAnalysis.topProducts.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    よく割引される商品
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {promoAnalysis.topProducts.map((product: any, idx: number) => (
                      <div key={idx} className="px-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-xs">
                        <span className="text-white font-medium">{formatProductName(product.productName)}</span>
                        <span className="text-violet-400 ml-2">{product.count}回</span>
                        <span className="text-gray-500 ml-1">(平均{product.avgDiscount}%OFF)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>}
            </CardContent>
          </Card>
        )}

        {/* 月別売上商品一覧 */}
        {monthlyProducts && monthlyProducts.length > 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6">
              <h2
                className="text-lg font-bold flex items-center gap-3 cursor-pointer select-none"
                onClick={() => setShowMonthlyProductsSection(!showMonthlyProductsSection)}
              >
                <ShoppingBag className="w-6 h-6 text-orange-400" />
                <span className="text-white">売上商品一覧</span>
                <span className="text-gray-400 text-sm">
                  {monthlyProducts.length}商品（{monthOptions.find(m => m.value === selectedMonth)?.label}）
                </span>
                <span className="ml-auto">
                  {showMonthlyProductsSection ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </span>
              </h2>
              {showMonthlyProductsSection && <div className="mt-6">
              {/* サマリー */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                  <div className="text-orange-400 font-mono font-bold text-lg">
                    ¥{monthlyProducts.reduce((s: number, p: any) => s + p.totalGmv, 0).toLocaleString()}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">GMV合計</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                  <div className="text-blue-400 font-mono font-bold text-lg">
                    {monthlyProducts.reduce((s: number, p: any) => s + p.totalItemsSold, 0).toLocaleString()}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">販売数合計</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                  <div className="text-green-400 font-mono font-bold text-lg">
                    {monthlyProducts.length}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">商品種類</div>
                </div>
              </div>

              {/* 商品テーブル */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-2 text-cyan-400 text-sm font-medium">#</th>
                      <th className="text-left py-3 px-2 text-cyan-400 text-sm font-medium">商品名</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">GMV</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">販売数</th>
                      <th className="text-right py-3 px-2 text-cyan-400 text-sm font-medium">配信回数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyProducts.map((product: any, idx: number) => {
                      const maxGmv = monthlyProducts[0]?.totalGmv || 1;
                      const barWidth = (product.totalGmv / maxGmv) * 100;
                      return (
                        <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 px-2">
                            {idx < 3 ? (
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${
                                idx === 0 ? 'bg-yellow-500 text-black' : 
                                idx === 1 ? 'bg-gray-400 text-black' : 
                                'bg-amber-600 text-white'
                              }`}>
                                {idx + 1}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-medium pl-2">{idx + 1}</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <div className="text-white font-medium break-words">{formatProductName(product.productName)}</div>
                            <div className="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden max-w-[200px]">
                              <div
                                className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-orange-400 font-mono font-bold">¥{product.totalGmv.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-2 text-right text-cyan-300">
                            {product.totalItemsSold.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-right text-gray-300">
                            {product.count}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </div>}
            </CardContent>
          </Card>
        )}

        {/* AI配信提案履歴 */}
        {aiSuggestions && aiSuggestions.length > 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6">
              <h2
                className="text-lg font-bold flex items-center gap-3 cursor-pointer select-none"
                onClick={() => setShowAiSuggestionsSection(!showAiSuggestionsSection)}
              >
                <Sparkles className="w-6 h-6 text-purple-400" />
                <span className="text-white">AI配信提案履歴</span>
                <span className="text-gray-400 text-sm">
                  {aiSuggestions.length}件
                </span>
                <span className="ml-auto">
                  {showAiSuggestionsSection ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </span>
              </h2>
              {showAiSuggestionsSection && (
                <div className="mt-4 space-y-3">
                  {aiSuggestions.map((suggestion: any) => {
                    const targetDate = new Date(suggestion.targetDate);
                    const dateStr = `${targetDate.getFullYear()}/${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
                    const isExpanded = expandedSuggestionId === suggestion.id;
                    return (
                      <div
                        key={suggestion.id}
                        className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden"
                      >
                        <button
                          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-700/30 transition-colors"
                          onClick={() => setExpandedSuggestionId(isExpanded ? null : suggestion.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="text-white font-medium text-sm">{dateStr}</span>
                            {suggestion.scheduledStartTime && (
                              <span className="text-gray-400 text-xs">
                                {new Date(suggestion.scheduledStartTime).getHours()}:{String(new Date(suggestion.scheduledStartTime).getMinutes()).padStart(2, '0')}
                                {suggestion.scheduledEndTime && (
                                  <> - {new Date(suggestion.scheduledEndTime).getHours()}:{String(new Date(suggestion.scheduledEndTime).getMinutes()).padStart(2, '0')}</>
                                )}
                              </span>
                            )}
                            {suggestion.lineSendSuccess && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">LINE送信済</span>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-gray-700/50">
                            <div className="mt-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                              {suggestion.suggestionText}
                            </div>
                            {suggestion.generatedBy && (
                              <div className="mt-2 text-xs text-gray-500">
                                生成: {suggestion.generatedBy}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
