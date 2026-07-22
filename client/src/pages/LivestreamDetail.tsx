import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, XCircle, Sparkles, Package, User, Megaphone, HelpCircle, Pencil, Trash2, Save, Upload, X, Calendar, Clock, DollarSign, Eye, ShoppingCart, MousePointer, Heart, MessageCircle, Share2, UserPlus, Timer, Users, TrendingUp, FileSpreadsheet, AlertTriangle, Gift, Tag, Percent, Layers, Plus, Check, ChevronsUpDown } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export default function LivestreamDetail() {
  const params = useParams<{ id: string }>();
  const livestreamId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  // ライバー認証も確認（ライバーは独自認証のため useAuth では取得できない）
  const { data: liverInfo } = trpc.liver.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 商品名表示ヘルパー（数字IDの場合は短縮表示）
  const formatProductName = (name: string) => {
    if (/^\d{10,}$/.test(name)) {
      return `商品ID: ${name.slice(0, 6)}...${name.slice(-4)}`;
    }
    return name;
  };
  
  // Edit form state
  const [formData, setFormData] = useState({
    livestreamDate: "",
    livestreamEndTime: "",
    streamerName: "",
    salesAmount: "",
    viewerCount: "",
    duration: "",
    productClicks: "",
    orderCount: "",
    result: "" as "" | "成功" | "失敗",
    impactFactor: "" as "" | "構成" | "商品" | "ライバー" | "広告" | "その他",
    resultReason: "",
    remarks: "",
    screenshotUrl: "",
  });
  
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // 商品CSVインポート用state
  const [showProductCsvImport, setShowProductCsvImport] = useState(false);
  const [isImportingProductCsv, setIsImportingProductCsv] = useState(false);

  // セット組みデータ取得
  const { data: livestreamSets, refetch: refetchSets } = trpc.livestreamSets.listByLivestream.useQuery(
    { livestreamId },
    { enabled: !!livestreamId }
  );

  // セット組み編集用state
  type SetItem = { productName: string; originalPrice: string; quantity: string };
  type SetData = { setName: string; setPrice: string; quantitySold: string; items: SetItem[] };
  const [editSets, setEditSets] = useState<SetData[]>([]);

  // セット組み保存mutation
  const bulkCreateSetsMutation = trpc.livestreamSets.bulkCreate.useMutation({
    onSuccess: () => {
      refetchSets();
    },
    onError: (error) => {
      toast.error(`セット組み保存エラー: ${error.message}`);
    },
  });

  const { data: livestream, isLoading, refetch } = trpc.liverManagement.getLivestreamDetail.useQuery({
    id: livestreamId,
  });

    // ライバーが自分の配信を編集できるかどうか判定
  const isOwnerLiver = !!(liverInfo && livestream && livestream.liverId === liverInfo.id);
  const canEdit = isAdmin || isOwnerLiver;
  
  // 配信アカウント一覧を取得（同じライバーの過去の配信アカウント）
  const { data: streamerAccounts } = trpc.liverManagement.getStreamerAccounts.useQuery(
    { liverId: livestream?.liverId! },
    { enabled: !!livestream?.liverId }
  );

    const { data: brands } = trpc.brand.list.useQuery();

  // Brand editing state
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [editBrands, setEditBrands] = useState<{ brandId: number; brandName: string; durationMinutes: number | null }[]>([]);
  const [brandSearchOpen, setBrandSearchOpen] = useState(false);
  const [brandSearchValue, setBrandSearchValue] = useState("");
  const saveBrandsMutation = trpc.liverManagement.saveLivestreamBrands.useMutation({
    onSuccess: () => {
      toast.success("ブランドを保存しました");
      setShowBrandDialog(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`ブランド保存エラー: ${error.message}`);
    },
  });

  const openBrandDialog = () => {
    // Initialize with current brands
    if (livestream?.livestreamBrands && livestream.livestreamBrands.length > 0) {
      setEditBrands(livestream.livestreamBrands.map((lb: any) => ({
        brandId: lb.brandId,
        brandName: lb.brandName,
        durationMinutes: lb.durationMinutes,
      })));
    } else if (livestream?.brand) {
      setEditBrands([{
        brandId: livestream.brand.id,
        brandName: livestream.brand.name,
        durationMinutes: livestream.duration || null,
      }]);
    } else {
      setEditBrands([]);
    }
    setShowBrandDialog(true);
  };

  const addBrandToList = (brand: { id: number; name: string }) => {
    if (editBrands.some(b => b.brandId === brand.id)) return;
    setEditBrands([...editBrands, { brandId: brand.id, brandName: brand.name, durationMinutes: null }]);
    setBrandSearchOpen(false);
    setBrandSearchValue("");
  };

  const removeBrandFromList = (brandId: number) => {
    setEditBrands(editBrands.filter(b => b.brandId !== brandId));
  };

  const updateBrandDuration = (brandId: number, minutes: number | null) => {
    setEditBrands(editBrands.map(b => b.brandId === brandId ? { ...b, durationMinutes: minutes } : b));
  };

  const handleSaveBrands = () => {
    saveBrandsMutation.mutate({
      livestreamId,
      brands: editBrands.map(b => ({
        brandId: b.brandId,
        durationMinutes: b.durationMinutes,
      })),
    });
  };

  // Initialize form data when livestream is loaded
  // 編集モードに入った時にセット組みデータを読み込む
  useEffect(() => {
    if (isEditing && livestreamSets) {
      setEditSets(livestreamSets.map((set: any) => ({
        setName: set.setName || '',
        setPrice: (set.setPrice || 0).toString(),
        quantitySold: (set.quantitySold ?? 0).toString(),
        items: set.items && set.items.length > 0
          ? set.items.map((item: any) => ({
              productName: item.productName || '',
              originalPrice: (item.originalPrice || 0).toString(),
              quantity: (item.quantity || 1).toString(),
            }))
          : [{ productName: '', originalPrice: '', quantity: '1' }],
      })));
    } else if (!isEditing) {
      setEditSets([]);
    }
  }, [isEditing, livestreamSets]);

  useEffect(() => {
    if (livestream) {
      const formatDateTimeLocal = (date: Date | string | null) => {
        if (!date) return "";
        const d = new Date(date);
        // Always use Asia/Tokyo timezone for consistent JST display
        const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Tokyo' };
        const year = parseInt(d.toLocaleDateString('ja-JP', { ...options, year: 'numeric' }));
        const month = String(parseInt(d.toLocaleDateString('ja-JP', { ...options, month: 'numeric' }))).padStart(2, '0');
        const day = String(parseInt(d.toLocaleDateString('ja-JP', { ...options, day: 'numeric' }))).padStart(2, '0');
        const time = d.toLocaleTimeString('ja-JP', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
        return `${year}-${month}-${day}T${time}`;
      };

      setFormData({
        livestreamDate: formatDateTimeLocal(livestream.livestreamDate),
        livestreamEndTime: formatDateTimeLocal(livestream.livestreamEndTime),
        streamerName: livestream.streamerName || "",
        salesAmount: livestream.salesAmount?.toString() || livestream.gmv?.toString() || "",
        viewerCount: livestream.viewerCount?.toString() || "",
        duration: livestream.duration?.toString() || "",
        productClicks: livestream.productClicks?.toString() || "",
        orderCount: livestream.orderCount?.toString() || "",
        result: (livestream.result as "" | "成功" | "失敗") || "",
        impactFactor: (livestream.impactFactor as "" | "構成" | "商品" | "ライバー" | "広告" | "その他") || "",
        resultReason: livestream.resultReason || "",
        remarks: livestream.remarks || "",
        screenshotUrl: livestream.screenshotUrl || "",
      });
      
      if (livestream.screenshotUrl) {
        setScreenshotPreview(livestream.screenshotUrl);
      }
    }
  }, [livestream]);

  const updateMutation = trpc.liverManagement.updateLivestream.useMutation({
    onSuccess: () => {
      toast.success("配信履歴を更新しました");
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const uploadScreenshotMutation = trpc.liverManagement.uploadScreenshot.useMutation();
  
  // 商品一覧取得
  const { data: products, refetch: refetchProducts } = trpc.brandLivestream.listProducts.useQuery(
    { livestreamId },
    { enabled: !!livestreamId }
  );
  
  // 商品CSVインポートmutation
  const importProductCsvMutation = trpc.brandLivestream.importProductCsv.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.importedCount}件の商品をインポートしました`);
      setShowProductCsvImport(false);
      refetch();
      refetchProducts();
      refetchImportHistory();
    },
    onError: (error) => {
      toast.error(`インポートエラー: ${error.message}`);
    },
  });
  
  // CSVインポート履歴取得
  const { data: importHistory, refetch: refetchImportHistory } = trpc.brandLivestream.getImportHistory.useQuery(
    { livestreamId },
    { enabled: !!livestreamId }
  );
  
  // CSVインポート履歴削除mutation
  const deleteImportHistoryMutation = trpc.brandLivestream.deleteImportHistory.useMutation({
    onSuccess: () => {
      toast.success('CSVインポート履歴と商品データを削除しました');
      refetch();
      refetchProducts();
      refetchImportHistory();
    },
    onError: (error) => {
      toast.error(`削除エラー: ${error.message}`);
    },
  });

  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState(false);
  const deleteMutation = trpc.liverManagement.deleteLivestream.useMutation({
    onSuccess: () => {
      toast.success("配信履歴を削除しました");
      window.history.back();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    // JST（日本時間）で表示 - toLocaleStringでタイムゾーンを指定
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Tokyo' };
    const year = parseInt(d.toLocaleDateString('ja-JP', { ...options, year: 'numeric' }));
    const month = String(parseInt(d.toLocaleDateString('ja-JP', { ...options, month: 'numeric' }))).padStart(2, '0');
    const day = String(parseInt(d.toLocaleDateString('ja-JP', { ...options, day: 'numeric' }))).padStart(2, '0');
    const weekdayStr = d.toLocaleDateString('ja-JP', { ...options, weekday: 'short' });
    const time = d.toLocaleTimeString('ja-JP', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
    return `${year}/${month}/${day}(${weekdayStr}) ${time}`;
  };

  const formatCurrency = (amount: number | string) => {
    return Number(amount).toLocaleString();
  };

  const getImpactFactorIcon = (factor: string | null) => {
    switch (factor) {
      case "構成": return <Sparkles className="w-4 h-4" />;
      case "商品": return <Package className="w-4 h-4" />;
      case "ライバー": return <User className="w-4 h-4" />;
      case "広告": return <Megaphone className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

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
    
    // CSVパースユーティリティ
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
      // 英語ヘッダー
      if (joined.includes('Product') && (joined.includes('Gross revenue') || joined.includes('GMV'))) {
        headerLineIdx = i;
        headerValues = vals;
        break;
      }
      // 中国語ヘッダー
      if (joined.includes('商品') && (joined.includes('GMV') || joined.includes('归因'))) {
        headerLineIdx = i;
        headerValues = vals;
        break;
      }
      // 日本語ヘッダー
      if (joined.includes('商品') && (joined.includes('GMV') || joined.includes('販売数') || joined.includes('インプレッション'))) {
        headerLineIdx = i;
        headerValues = vals;
        break;
      }
    }
    
    if (headerLineIdx < 0) {
      // ヘッダーが見つからない場合、最初の行をヘッダーとみなす
      headerLineIdx = 0;
      headerValues = parseCsvLine(lines[0]);
    }
    
    // カラムインデックスをヘッダー名から検出
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
    
    // 英語固定位置フォールバック（従来のフォーマット）
    if (nameIdx < 0 && headerValues[0]?.includes('Product')) {
      nameIdx = 0; gmvIdx = 2; salesIdx = 3; custIdx = 4; ordIdx = 5;
      ctrIdx = 6; ctorIdx = 7; impIdx = 8; clickIdx = 9;
    }
    
    console.log('[parseProductCsv] Header detected at line:', headerLineIdx, 'nameIdx:', nameIdx, 'idIdx:', idIdx, 'gmvIdx:', gmvIdx);
    
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
  
  const handleProductCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImportingProductCsv(true);
    
    try {
      // Excelファイルの場合はSheetJSを使用
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Excelの行データを直接読み取り（ヘッダー行で日本語カラム名を検出）
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log('[ProductCSV] XLSX parsed, rows:', rows.length, 'headers:', rows[0]);
        if (rows.length < 2) {
          toast.error('商品データが見つかりませんでした（行数不足）');
          return;
        }
        
        const headerRow = rows[0] as string[];
        // ヘッダー検出: 日本語、中国語、英語に対応
        const hasJapaneseHeaders = headerRow.some(h => typeof h === 'string' && (
          h === '商品ID' || h === '商品名' || h.includes('商品ID') || h.includes('商品名')
        ));
        const hasChineseHeaders = headerRow.some(h => typeof h === 'string' && (
          h.includes('商品 ID') || h.includes('商品名称') || h.includes('归因') || h.includes('GMV')
        ));
        
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
          cartAddCount: number | null;
        }> = [];
        
        console.log('[ProductCSV] hasJapaneseHeaders:', hasJapaneseHeaders, 'hasChineseHeaders:', hasChineseHeaders);
        if (hasJapaneseHeaders || hasChineseHeaders) {
          const colIndex: Record<string, number> = {};
          headerRow.forEach((h, i) => { if (typeof h === 'string') colIndex[h.trim()] = i; });
          
          // ヘッダー名の正規化マッピング（スペースあり/なし両対応）
          const findCol = (keys: string[]): number | undefined => {
            for (const key of keys) {
              if (colIndex[key] !== undefined) return colIndex[key];
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
          const salesCountCol = findCol(['商品の販売数', '归因成交件数', '販売数', 'LIVEに起因する商品販売数']);
          const customerCountCol = findCol(['カスタマー数', '客户数', '顧客数']);
          const skuOrdersCol = findCol(['SKU注文数', '归因 SKU 订单数', '归因SKU订单数', 'SKU 注文数']);
          const ordersCol = findCol(['注文', '归因订单数', '归因訂単数', '注文数']);
          const ctrCol = findCol(['CTR', '点击率']);
          const ctorCol = findCol(['CTOR', '点击成交转化率']);
          const impressionsCol = findCol(['商品インプレッション数', '商品曝光次数', 'インプレッション数']);
          const clicksCol = findCol(['商品クリック数', '商品点击次数', 'クリック数']);
          const derivedGmvCol = findCol(['派生GMV']);
          const cartAddCol = findCol(['カート追加', 'カート追加数', '加购数', '加购人数', 'Units added to cart', 'Cart additions']);
          
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
            
            const cartAdds = cartAddCol !== undefined ? parseExcelNum(row[cartAddCol]) : null;
            
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
              cartAddCount: cartAdds,
            });
          }
                } else {
          // 英語ヘッダーの場合は従来のCSVパースにフォールバック
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          products = parseProductCsv(csvText);
        }
        
        // フォールバック: ヘッダー検出が失敗した場合、全カラムをスキャンして再試行
        if (products.length === 0 && rows.length >= 2) {
          console.log('[ProductCSV] Fallback: trying universal column scan');
          const hdr = (rows[0] as string[]).map(h => typeof h === 'string' ? h.replace(/\s/g, '') : '');
          // 商品名カラムを探す
          let nameIdx = hdr.findIndex(h => h === '商品名称' || h === '商品名');
          let idIdx = hdr.findIndex(h => h === '商品ID' || h === 'ProductID');
          let gmvIdx = hdr.findIndex(h => h.includes('GMV') || h.includes('归因GMV'));
          let salesIdx = hdr.findIndex(h => h.includes('归因成交件数') || h.includes('販売数'));
          let custIdx = hdr.findIndex(h => h.includes('客户数') || h.includes('カスタマー'));
          let ordIdx = hdr.findIndex(h => h.includes('归因订单数') || h.includes('注文'));
          let impIdx = hdr.findIndex(h => h.includes('商品曝光次数') || h.includes('インプレッション'));
          let clickIdx = hdr.findIndex(h => h.includes('商品点击次数') || h.includes('クリック数'));
          let ctrIdx = hdr.findIndex(h => h === 'CTR' || h === '点击率');
          let ctorIdx = hdr.findIndex(h => h === 'CTOR' || h === '点击成交转化率');
          let cartAddIdx = hdr.findIndex(h => h.includes('カート追加') || h.includes('加购') || h.includes('Addtocart') || h.includes('Cartadditions'));
          
          const pn = (val: any): number | null => {
            if (val === null || val === undefined || val === '' || val === '-') return null;
            const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[,円\s]/g, ''));
            return isNaN(num) ? null : num;
          };
          
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r] as any[];
            if (!row || row.length < 2) continue;
            let productName = '';
            if (nameIdx >= 0) productName = String(row[nameIdx] || '').trim();
            if (!productName && idIdx >= 0) productName = String(row[idIdx] || '').trim();
            if (!productName) continue;
            if (productName.length > 490) productName = productName.substring(0, 490) + '...';
            products.push({
              productName,
              grossRevenue: gmvIdx >= 0 ? pn(row[gmvIdx]) : null,
              directGmv: gmvIdx >= 0 ? pn(row[gmvIdx]) : null,
              itemsSold: salesIdx >= 0 ? pn(row[salesIdx]) : null,
              customers: custIdx >= 0 ? pn(row[custIdx]) : null,
              orders: ordIdx >= 0 ? pn(row[ordIdx]) : null,
              ctr: ctrIdx >= 0 ? String(row[ctrIdx] || '') : null,
              ctor: ctorIdx >= 0 ? String(row[ctorIdx] || '') : null,
              productImpressions: impIdx >= 0 ? pn(row[impIdx]) : null,
              productClicks: clickIdx >= 0 ? pn(row[clickIdx]) : null,
              cartAddCount: cartAddIdx >= 0 ? pn(row[cartAddIdx]) : null,
            });
          }
          console.log('[ProductCSV] Fallback parsed:', products.length, 'products');
        }
        
        console.log('[ProductCSV] Final products count:', products.length);
        if (products.length === 0) {
          toast.error('商品データが見つかりませんでした');
          return;
        }
        // Convert file to base64 for S3 storage
        const fileBase64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        await importProductCsvMutation.mutateAsync({
          livestreamId,
          fileName: file.name,
          fileBase64,
          products,
        });
      } else {
        // CSVファイルの場合
        const text = await file.text();
        const products = parseProductCsv(text);
        
        if (products.length === 0) {
          toast.error('商品データが見つかりませんでした');
          return;
        }
        
        // Convert CSV text to base64 for S3 storage
        const csvBase64 = btoa(unescape(encodeURIComponent(text)));
        await importProductCsvMutation.mutateAsync({
          livestreamId,
          fileName: file.name,
          fileBase64: csvBase64,
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

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setFormData({ ...formData, screenshotUrl: "" });
  };

  const handleSave = async () => {
    setIsUploading(true);
    
    try {
      let screenshotUrl = formData.screenshotUrl;

      // Upload new screenshot if selected
      if (screenshotFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.readAsDataURL(screenshotFile);
        });
        const base64 = await base64Promise;

        const uploadResult = await uploadScreenshotMutation.mutateAsync({
          base64,
          filename: screenshotFile.name,
          liverId: livestream?.liverId ?? undefined,
        });
        screenshotUrl = uploadResult.url;
      }

        // セット組みデータを保存
        const validSets = editSets
          .filter(s => s.setName.trim().length > 0)
          .map(s => ({
            setName: s.setName.trim(),
            setPrice: parseInt(s.setPrice) || 0,
            quantitySold: parseInt(s.quantitySold) || 0,
            items: s.items
              .filter(item => item.productName.trim().length > 0)
              .map(item => ({
                productName: item.productName.trim(),
                originalPrice: parseInt(item.originalPrice) || 0,
                quantity: parseInt(item.quantity) || 1,
              })),
          }))
          .filter(s => s.items.length > 0);

        // セット組みを保存（空の場合もbulkCreateで削除される）
        await bulkCreateSetsMutation.mutateAsync({
          livestreamId,
          sets: validSets,
        });

        updateMutation.mutate({
        id: livestreamId,
        livestreamDate: formData.livestreamDate,
        livestreamEndTime: formData.livestreamEndTime || null,
        streamerName: formData.streamerName || null,
        salesAmount: formData.salesAmount ? parseInt(formData.salesAmount, 10) : null,
        viewerCount: formData.viewerCount ? parseInt(formData.viewerCount, 10) : null,
        duration: formData.duration ? parseFloat(formData.duration) : null,
        productClicks: formData.productClicks ? parseInt(formData.productClicks, 10) : null,
        orderCount: formData.orderCount ? parseInt(formData.orderCount, 10) : null,
        result: formData.result || null,
        impactFactor: formData.impactFactor || null,
        resultReason: formData.resultReason || null,
        remarks: formData.remarks || null,
        screenshotUrl: screenshotUrl || null,
      });
    } catch (error) {
      console.error("Failed to update livestream:", error);
      toast.error("更新に失敗しました");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: livestreamId });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-gray-800" />
          <Skeleton className="h-64 w-full bg-gray-800" />
        </div>
      </div>
    );
  }

  if (!livestream) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gray-500">配信履歴が見つかりません</p>
          <Button 
            onClick={() => window.history.back()} 
            className="mt-4 bg-red-600 hover:bg-red-700"
          >
            戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Red top border */}
      <div className="h-1 bg-red-600" />
      
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Back Button */}
        <button 
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          戻る
        </button>
        
        {/* Content Card */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6 space-y-6">
            {/* Header with Edit Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">配信履歴詳細</h2>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <Link href={`/master/livestreams/${livestreamId}/realtime`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-500 text-green-500 hover:bg-green-500 hover:text-black"
                    >
                      🔴 リアルタイム記録
                    </Button>
                  </Link>
                )}
                {!isEditing && canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    編集
                  </Button>
                )}
              </div>
              {!canEdit && (
                <span className="text-xs text-gray-500 italic">閲覧専用モード</span>
              )}
            </div>

            {isEditing ? (
              // Edit Mode
              <div className="space-y-6">
                {/* 配信アカウント */}
                <div className="space-y-2">
                  <Label className="text-red-500 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    配信アカウント
                  </Label>
                  <Select
                    value={formData.streamerName}
                    onValueChange={(value) => setFormData({ ...formData, streamerName: value === "__custom__" ? "" : value })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="アカウントを選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {streamerAccounts?.map((account) => (
                        <SelectItem key={account} value={account}>
                          @{account}
                        </SelectItem>
                      ))}
                      {livestream?.liver?.tiktokAccount && !streamerAccounts?.includes(livestream.liver.tiktokAccount) && (
                        <SelectItem value={livestream.liver.tiktokAccount}>
                          @{livestream.liver.tiktokAccount}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {/* 自由入力フォールバック */}
                  <Input
                    type="text"
                    placeholder="または直接入力: @username"
                    value={formData.streamerName}
                    onChange={(e) => setFormData({ ...formData, streamerName: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white text-sm"
                  />
                </div>

                {/* Delivery Period */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-red-500 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      開始日時
                    </Label>
                    <Input
                      type="datetime-local"
                      value={formData.livestreamDate}
                      onChange={(e) => setFormData({ ...formData, livestreamDate: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-red-500 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      終了日時
                    </Label>
                    <Input
                      type="datetime-local"
                      value={formData.livestreamEndTime}
                      onChange={(e) => setFormData({ ...formData, livestreamEndTime: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                {/* Sales & Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-red-500 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      売上金額
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">¥</span>
                      <Input
                        type="number"
                        value={formData.salesAmount}
                        onChange={(e) => setFormData({ ...formData, salesAmount: e.target.value })}
                        placeholder="0"
                        className="bg-gray-800 border-gray-700 text-white pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-red-500 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      配信時間（分）
                    </Label>
                    <Input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="0"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                {/* Viewer Count */}
                <div className="space-y-2">
                  <Label className="text-red-500 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    視聴者数
                  </Label>
                  <Input
                    type="number"
                    value={formData.viewerCount}
                    onChange={(e) => setFormData({ ...formData, viewerCount: e.target.value })}
                    placeholder="0"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                {/* Clicks & Orders */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-red-500 flex items-center gap-2">
                      <MousePointer className="w-4 h-4" />
                      商品クリック数
                    </Label>
                    <Input
                      type="number"
                      value={formData.productClicks}
                      onChange={(e) => setFormData({ ...formData, productClicks: e.target.value })}
                      placeholder="0"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-red-500 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      注文数
                    </Label>
                    <Input
                      type="number"
                      value={formData.orderCount}
                      onChange={(e) => setFormData({ ...formData, orderCount: e.target.value })}
                      placeholder="0"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                {/* Result */}
                <div className="space-y-2">
                  <Label className="text-red-500">配信結果</Label>
                  <Select
                    value={formData.result || "none"}
                    onValueChange={(v) => setFormData({ ...formData, result: v === "none" ? "" : v as "成功" | "失敗" })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="none" className="text-gray-400">未設定</SelectItem>
                      <SelectItem value="成功" className="text-green-500">成功</SelectItem>
                      <SelectItem value="失敗" className="text-red-500">失敗</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Impact Factor */}
                <div className="space-y-2">
                  <Label className="text-red-500">影響した要因</Label>
                  <Select
                    value={formData.impactFactor || "none"}
                    onValueChange={(v) => setFormData({ ...formData, impactFactor: v === "none" ? "" : v as "構成" | "商品" | "ライバー" | "広告" | "その他" })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="none" className="text-gray-400">未設定</SelectItem>
                      <SelectItem value="構成">構成</SelectItem>
                      <SelectItem value="商品">商品</SelectItem>
                      <SelectItem value="ライバー">ライバー</SelectItem>
                      <SelectItem value="広告">広告</SelectItem>
                      <SelectItem value="その他">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label className="text-red-500">原因・備注</Label>
                  <Textarea
                    value={formData.resultReason}
                    onChange={(e) => setFormData({ ...formData, resultReason: e.target.value })}
                    placeholder="理由を入力..."
                    className="bg-gray-800 border-gray-700 text-white"
                    rows={3}
                  />
                </div>

                {/* Memo */}
                <div className="space-y-2">
                  <Label className="text-red-500">その他備注</Label>
                  <Textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="メモを入力..."
                    className="bg-gray-800 border-gray-700 text-white"
                    rows={3}
                  />
                </div>

                {/* Screenshot Upload */}
                <div className="space-y-2">
                  <Label className="text-red-500">スクリーンショット</Label>
                  {screenshotPreview ? (
                    <div className="relative border border-gray-700 rounded-lg overflow-hidden">
                      <img 
                        src={screenshotPreview} 
                        alt="Screenshot preview"
                        className="w-full h-auto max-h-64 object-contain"
                      />
                      <button
                        type="button"
                        onClick={removeScreenshot}
                        className="absolute top-2 right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                      <Upload className="w-8 h-8 text-gray-500 mb-2" />
                      <span className="text-gray-500">画像をアップロード</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* セット組み編集セクション */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-purple-400 text-sm flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      セット組み（任意）
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditSets([...editSets, { setName: '', setPrice: '', quantitySold: '1', items: [{ productName: '', originalPrice: '', quantity: '1' }] }])}
                      className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10 text-xs h-7"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      セット追加
                    </Button>
                  </div>
                  <p className="text-xs text-gray-300 -mt-1">※ セット売上は配信全体の売上の内訳参考です。売上金額には加算されません。</p>

                  {editSets.map((set, setIndex) => {
                    const totalOriginalPrice = set.items.reduce((sum, item) => sum + (parseInt(item.originalPrice) || 0) * (parseInt(item.quantity) || 1), 0);
                    const setPrice = parseInt(set.setPrice) || 0;
                    const discountRate = totalOriginalPrice > 0 ? Math.round(((totalOriginalPrice - setPrice) / totalOriginalPrice) * 100) : 0;
                    const quantitySold = parseInt(set.quantitySold) || 0;
                    const totalRevenue = setPrice * quantitySold;

                    return (
                      <Card key={setIndex} className="bg-purple-500/5 border-purple-500/20">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-purple-400 text-xs font-medium">セット {setIndex + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditSets(editSets.filter((_, i) => i !== setIndex))}
                              className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* セット名 */}
                          <Input
                            placeholder="セット名（例：美容3点セット）"
                            value={set.setName}
                            onChange={(e) => {
                              const newSets = [...editSets];
                              newSets[setIndex].setName = e.target.value;
                              setEditSets(newSets);
                            }}
                            className="bg-gray-800 border-gray-700 text-white text-sm"
                          />

                          {/* 売値と販売数量 */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-gray-300 text-xs">売値（円）</Label>
                              <Input
                                type="number"
                                placeholder="5000"
                                value={set.setPrice}
                                onChange={(e) => {
                                  const newSets = [...editSets];
                                  newSets[setIndex].setPrice = e.target.value;
                                  setEditSets(newSets);
                                }}
                                className="bg-gray-800 border-gray-700 text-white text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-gray-300 text-xs">販売数量</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                value={set.quantitySold}
                                onChange={(e) => {
                                  const newSets = [...editSets];
                                  newSets[setIndex].quantitySold = e.target.value;
                                  setEditSets(newSets);
                                }}
                                className="bg-gray-800 border-gray-700 text-white text-sm"
                              />
                            </div>
                          </div>

                          {/* セット内商品 */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-gray-300 text-xs flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                セット内商品
                              </Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newSets = [...editSets];
                                  newSets[setIndex].items.push({ productName: '', originalPrice: '', quantity: '1' });
                                  setEditSets(newSets);
                                }}
                                className="text-gray-200 hover:text-white text-xs h-6 px-2"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                商品追加
                              </Button>
                            </div>

                            {set.items.map((item, itemIndex) => (
                              <div key={itemIndex} className="flex gap-2 items-center">
                                <Input
                                  placeholder="商品名"
                                  value={item.productName}
                                  onChange={(e) => {
                                    const newSets = [...editSets];
                                    newSets[setIndex].items[itemIndex].productName = e.target.value;
                                    setEditSets(newSets);
                                  }}
                                  className="bg-gray-800 border-gray-700 text-white text-sm flex-1"
                                />
                                <Input
                                  type="number"
                                  placeholder="元値（円）"
                                  value={item.originalPrice}
                                  onChange={(e) => {
                                    const newSets = [...editSets];
                                    newSets[setIndex].items[itemIndex].originalPrice = e.target.value;
                                    setEditSets(newSets);
                                  }}
                                  className="bg-gray-800 border-gray-700 text-white text-sm w-24"
                                />
                                <Input
                                  type="number"
                                  placeholder="数量"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const newSets = [...editSets];
                                    newSets[setIndex].items[itemIndex].quantity = e.target.value;
                                    setEditSets(newSets);
                                  }}
                                  className="bg-gray-800 border-gray-700 text-white text-sm w-16"
                                  min="1"
                                />
                                {set.items.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newSets = [...editSets];
                                      newSets[setIndex].items = newSets[setIndex].items.filter((_, i) => i !== itemIndex);
                                      setEditSets(newSets);
                                    }}
                                    className="text-red-400 hover:text-red-300 h-8 w-8 p-0 shrink-0"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* 自動計算表示 */}
                          {setPrice > 0 && totalOriginalPrice > 0 && (
                            <div className="bg-gray-800/50 rounded-lg p-2 space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-200">元値合計</span>
                                <span className="text-white">¥{Number(totalOriginalPrice).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-200">お得率</span>
                                <span className={discountRate > 0 ? "text-green-400 font-medium" : "text-white"}>
                                  {discountRate > 0 ? `${discountRate}% OFF` : '-'}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-200">セット売上合計</span>
                                <span className="text-yellow-400 font-medium">¥{Number(totalRevenue).toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Save/Cancel Buttons */}
                <div className="flex justify-center gap-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8"
                  >
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending || isUploading}
                    className="bg-red-600 hover:bg-red-700 px-8"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateMutation.isPending || isUploading ? "保存中..." : "保存"}
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="space-y-6">
                {/* 配信アカウント */}
                {livestream.streamerName && (
                  <div className="flex justify-between items-center">
                    <span className="text-red-500 font-medium">配信アカウント</span>
                    <span className="text-white font-medium">@{livestream.streamerName}</span>
                  </div>
                )}

                {/* Delivery Period */}
                <div className="flex justify-between items-start">
                  <span className="text-red-500 font-medium">配信期間</span>
                  <div className="text-right space-y-1">
                    <p className="text-white">
                      <span className="text-gray-200 mr-2">開始</span>
                      <span className="font-medium text-white">{formatDateTime(livestream.livestreamDate)}</span>
                    </p>
                    <p className="text-white">
                      <span className="text-gray-200 mr-2">終了</span>
                      <span className="font-medium text-white">{formatDateTime(livestream.livestreamEndTime)}</span>
                    </p>
                  </div>
                </div>
                
                {/* Sales Total */}
                <div className="flex justify-between items-center">
                  <span className="text-red-500 font-medium">売上合計</span>
                  <span className="text-xl font-bold text-yellow-500">
                    ¥{formatCurrency(livestream.salesAmount || livestream.gmv || 0)}
                  </span>
                </div>

                {/* 商品別売上セクション（カード形式+プログレスバー+ランキング） */}
                <div className="bg-gradient-to-r from-orange-900/20 to-amber-900/20 border border-orange-600/30 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      商品別売上
                    </h3>
                    {/* CSVアップロードはHRメンバー全員に許可 */}
                    {true && (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleProductCsvUpload}
                          className="hidden"
                          disabled={isImportingProductCsv}
                        />
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                          isImportingProductCsv 
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer'
                        }`}>
                          <Upload className="w-3 h-3" />
                          {isImportingProductCsv ? 'インポート中...' : 'CSVインポート'}
                        </span>
                      </label>
                    )}
                  </div>
                  
                  {products && products.length > 0 ? (() => {
                    const totalSales = products.reduce((sum, p) => sum + (p.directGmv || p.gmv || 0), 0);
                    const sortedProducts = [...products].sort((a, b) => (b.directGmv || b.gmv || 0) - (a.directGmv || a.gmv || 0));
                    const getRankBadge = (rank: number) => {
                      if (rank === 1) return <span className="text-lg">🥇</span>;
                      if (rank === 2) return <span className="text-lg">🥈</span>;
                      if (rank === 3) return <span className="text-lg">🥉</span>;
                      return <span className="w-6 h-6 flex items-center justify-center bg-gray-700 rounded-full text-xs text-gray-300">{rank}</span>;
                    };
                    
                    // 円グラフ用のデータと色
                    const CHART_COLORS = [
                      '#f97316', // orange-500
                      '#eab308', // yellow-500
                      '#22c55e', // green-500
                      '#3b82f6', // blue-500
                      '#a855f7', // purple-500
                      '#ec4899', // pink-500
                      '#14b8a6', // teal-500
                      '#f43f5e', // rose-500
                      '#6366f1', // indigo-500
                      '#84cc16', // lime-500
                    ];
                    
                    const pieChartData = sortedProducts.slice(0, 10).map((product, index) => ({
                      name: formatProductName(product.productName).length > 15 
                        ? formatProductName(product.productName).substring(0, 15) + '...' 
                        : formatProductName(product.productName),
                      fullName: formatProductName(product.productName),
                      value: product.directGmv || product.gmv || 0,
                      percentage: totalSales > 0 ? ((product.directGmv || product.gmv || 0) / totalSales * 100).toFixed(1) : '0',
                      color: CHART_COLORS[index % CHART_COLORS.length],
                    }));
                    
                    // その他（Top10以外）
                    if (sortedProducts.length > 10) {
                      const othersTotal = sortedProducts.slice(10).reduce((sum, p) => sum + (p.directGmv || p.gmv || 0), 0);
                      pieChartData.push({
                        name: 'その他',
                        fullName: `その他 (${sortedProducts.length - 10}商品)`,
                        value: othersTotal,
                        percentage: totalSales > 0 ? (othersTotal / totalSales * 100).toFixed(1) : '0',
                        color: '#6b7280', // gray-500
                      });
                    }
                    
                    return (
                      <div className="space-y-4">
                        {/* 円グラフ */}
                        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/30">
                          <h4 className="text-xs text-gray-400 mb-3 text-center">売上構成比 Sales Composition</h4>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={80}
                                  paddingAngle={2}
                                  dataKey="value"
                                  label={({ name, percentage }) => `${percentage}%`}
                                  labelLine={false}
                                >
                                  {pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#1f2937" strokeWidth={2} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
                                          <p className="text-white text-sm font-medium mb-1">{data.fullName}</p>
                                          <p className="text-yellow-400 font-bold">¥{Number(data.value).toLocaleString()}</p>
                                          <p className="text-gray-400 text-xs">構成比: {data.percentage}%</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          {/* 凡例 */}
                          <div className="flex flex-wrap justify-center gap-2 mt-3">
                            {pieChartData.slice(0, 5).map((item, index) => (
                              <div key={index} className="flex items-center gap-1.5 text-xs">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-gray-300 max-w-[80px] truncate">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* 商品リスト */}
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                        {sortedProducts.map((product, index) => {
                          const sales = product.directGmv || product.gmv || 0;
                          const percentage = totalSales > 0 ? (sales / totalSales) * 100 : 0;
                          const rank = index + 1;
                          
                          return (
                            <div key={product.id || index} className="bg-gray-900/70 rounded-lg p-4 border border-gray-700/50">
                              {/* ランキングと商品名 */}
                              <div className="flex items-start gap-3 mb-3">
                                <div className="flex-shrink-0 mt-0.5">
                                  {getRankBadge(rank)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium text-sm leading-tight line-clamp-2">
                                    {formatProductName(product.productName)}
                                  </p>
                                </div>
                              </div>
                              
                              {/* 売上金額と構成比 */}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xl font-bold text-yellow-400">
                                  ¥{Number(sales).toLocaleString()}
                                </span>
                                <span className="text-sm text-gray-400">
                                  売上構成比 {percentage.toFixed(1)}%
                                </span>
                              </div>
                              {/* 単価 */}
                              {product.itemsSold > 0 && (
                                <p className="text-xs text-cyan-400 mb-2">
                                  単価: ¥{Math.round(Number(sales) / product.itemsSold).toLocaleString()}/個
                                </p>
                              )}
                              
                              {/* プログレスバー */}
                              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                                    rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                                    rank === 3 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                                    'bg-gradient-to-r from-blue-400 to-blue-500'
                                  }`}
                                  style={{ width: `${Math.max(percentage, 2)}%` }}
                                />
                              </div>
                              
                              {/* 詳細指標 */}
                              <div className="flex flex-wrap gap-3 text-xs">
                                {product.itemsSold !== null && product.itemsSold !== undefined && (
                                  <span className="flex items-center gap-1 text-gray-300">
                                    <ShoppingCart className="w-3 h-3 text-gray-500" />
                                    販売 Sales: {product.itemsSold}個
                                  </span>
                                )}
                                {product.customers !== null && product.customers !== undefined && (
                                  <span className="flex items-center gap-1 text-gray-300">
                                    <Users className="w-3 h-3 text-gray-500" />
                                    購入者 Buyers: {product.customers}人
                                  </span>
                                )}
                                {product.productClicks !== null && product.productClicks !== undefined && (
                                  <span className="flex items-center gap-1 text-gray-300">
                                    <MousePointer className="w-3 h-3 text-gray-500" />
                                    クリック Clicks: {Number(product.productClicks).toLocaleString()}回
                                  </span>
                                )}
                                {product.cartAddCount !== null && product.cartAddCount !== undefined && product.cartAddCount > 0 && (
                                  <span className="flex items-center gap-1 text-amber-300">
                                    <ShoppingCart className="w-3 h-3 text-amber-500" />
                                    カート追加: {Number(product.cartAddCount).toLocaleString()}件
                                  </span>
                                )}
                                {product.productImpressions !== null && product.productImpressions !== undefined && (
                                  <span className="flex items-center gap-1 text-gray-300">
                                    <Eye className="w-3 h-3 text-gray-500" />
                                    インプ Impressions: {Number(product.productImpressions).toLocaleString()}回
                                  </span>
                                )}
                              </div>
                              {/* CTR・CTOR */}
                              <div className="flex flex-wrap gap-3 text-xs mt-1">
                                {product.ctr && (
                                  <span className="flex items-center gap-1 text-gray-400">
                                    クリック率 CTR: {(parseFloat(product.ctr) * 100).toFixed(2)}%
                                  </span>
                                )}
                                {product.ctor && (
                                  <span className="flex items-center gap-1 text-gray-400">
                                    購入率 CTOR: {(parseFloat(product.ctor) * 100).toFixed(2)}%
                                  </span>
                                )}
                                {product.cartAddCount > 0 && product.productClicks > 0 && (
                                  <span className="flex items-center gap-1 text-amber-400">
                                    カート率: {((product.cartAddCount / product.productClicks) * 100).toFixed(2)}%
                                  </span>
                                )}
                                {product.cartAddCount > 0 && product.itemsSold > 0 && (
                                  <span className="flex items-center gap-1 text-green-400">
                                    カート→購入: {((product.itemsSold / product.cartAddCount) * 100).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                      <p className="text-gray-300 text-sm font-medium">商品別データが未登録です</p>
                      <p className="text-gray-500 text-xs mt-1">TikTokの商品別CSVをインポートしてください</p>
                    </div>
                  )}
                  
                  {/* インポート履歴 */}
                  {importHistory && importHistory.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-orange-600/30">
                      <h4 className="text-xs font-medium text-gray-400 mb-2">インポート履歴</h4>
                      <div className="space-y-2">
                        {importHistory.map((history) => (
                          <div key={history.id} className="flex items-center justify-between bg-gray-900/50 rounded p-2 text-xs">
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-300 truncate">{history.fileName}</p>
                              <p className="text-gray-500">
                                {new Date(history.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ・ {history.productCount}商品 ・ ¥{(history.totalGmv || 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                            {(history as any).fileUrl && (
                              <a href={(history as any).fileUrl} download className="inline-flex items-center justify-center h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              </a>
                            )}
                            {canEdit && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-7 px-2">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>インポート履歴を削除</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      このインポート履歴と関連する商品データをすべて削除します。この操作は取り消せません。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteImportHistoryMutation.mutate({ historyId: history.id })}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      削除する
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* セット組み情報 */}
                {livestreamSets && livestreamSets.length > 0 && (() => {
                  const totalSetRevenue = livestreamSets.reduce((sum: number, s: any) => sum + (s.totalRevenue || 0), 0);
                  const totalSetsSold = livestreamSets.reduce((sum: number, s: any) => sum + (s.quantitySold || 0), 0);
                  return (
                    <div className="bg-gradient-to-r from-violet-900/20 to-fuchsia-900/20 border border-violet-600/30 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-medium text-violet-400 flex items-center gap-2">
                          <Gift className="w-4 h-4" />
                          セット組み
                        </h3>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-400">{livestreamSets.length}セット</span>
                          <span className="text-violet-300 font-medium">合計 ¥{Number(totalSetRevenue).toLocaleString()}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-3">※ セット売上は配信全体の売上の内訳参考です。売上金額には加算されません。</p>
                      <div className="space-y-3">
                        {livestreamSets.map((set: any, idx: number) => (
                          <div key={set.id || idx} className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-violet-400" />
                                <span className="text-white font-medium text-sm">{set.setName}</span>
                              </div>
                              {set.discountRate > 0 && (
                                <Badge className="bg-fuchsia-600/80 text-white text-[10px] px-1.5 py-0.5">
                                  <Percent className="w-3 h-3 mr-0.5" />
                                  {set.discountRate}%OFF
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400">売値</p>
                                <p className="text-yellow-400 font-bold text-sm">¥{Number(set.setPrice || 0).toLocaleString()}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400">販売数</p>
                                <p className="text-white font-bold text-sm">{set.quantitySold || 0}<span className="text-[10px] text-gray-400">セット</span></p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400">セット売上</p>
                                <p className="text-emerald-400 font-bold text-sm">¥{Number(set.totalRevenue || 0).toLocaleString()}</p>
                              </div>
                            </div>
                            {/* セット内商品 */}
                            {set.items && set.items.length > 0 && (
                              <div className="border-t border-gray-700/50 pt-2 mt-2">
                                <p className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                                  <Tag className="w-3 h-3" />
                                  セット内容（元値合計: ¥{Number(set.totalOriginalPrice || 0).toLocaleString()}）
                                </p>
                                <div className="space-y-1">
                                  {set.items.map((item: any, iIdx: number) => {
                                    const qty = item.quantity || 1;
                                    return (
                                      <div key={item.id || iIdx} className="flex justify-between items-center text-xs">
                                        <span className="text-gray-300">{item.productName} ×{qty}</span>
                                        <span className="text-gray-400">¥{Number(item.originalPrice || 0).toLocaleString()} ×{qty}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Performance Metrics Grid */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    配信パフォーマンス
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Duration */}
                    <div className="bg-gray-900/50 rounded p-3">
                      <p className="text-gray-300 text-xs">配信時間</p>
                      <p className="text-white font-bold text-lg">
                        {livestream.duration 
                          ? `${Math.floor(livestream.duration / 60)}時間${livestream.duration % 60}分`
                          : "-"}
                      </p>
                    </div>
                    
                    {/* Viewer Count */}
                    <div className="bg-gray-900/50 rounded p-3">
                      <p className="text-gray-300 text-xs">視聴者数</p>
                      <p className="text-white font-bold text-lg">
                        {Number(livestream.viewerCount || 0).toLocaleString() || "-"}
                      </p>
                    </div>
                    
                    {/* Product Clicks */}
                    <div className="bg-gray-900/50 rounded p-3">
                      <p className="text-gray-300 text-xs flex items-center gap-1">
                        <MousePointer className="w-3 h-3" />
                        商品クリック数
                      </p>
                      <p className="text-white font-bold text-lg">
                        {Number(livestream.productClicks || 0).toLocaleString() || "-"}
                      </p>
                    </div>
                    
                    {/* Order Count */}
                    <div className="bg-gray-900/50 rounded p-3">
                      <p className="text-gray-300 text-xs flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        注文数
                      </p>
                      <p className="text-white font-bold text-lg">
                        {Number(livestream.orderCount || 0).toLocaleString() || "-"}
                      </p>
                    </div>
                    
                    {/* Impressions */}
                    {livestream.impressions && (
                      <div className="bg-gray-900/50 rounded p-3">
                        <p className="text-gray-300 text-xs">インプレッション</p>
                        <p className="text-white font-bold text-lg">
                          {Number(livestream.impressions || 0).toLocaleString()}
                        </p>
                      </div>
                    )}
                    
                    {/* CVR */}
                    {livestream.cvr && (
                      <div className="bg-gray-900/50 rounded p-3">
                        <p className="text-gray-300 text-xs">CVR（コンバージョン率）</p>
                        <p className="text-white font-bold text-lg">
                          {livestream.cvr}
                        </p>
                      </div>
                    )}
                    
                    {/* CTR */}
                    {livestream.ctr && (
                      <div className="bg-gray-900/50 rounded p-3">
                        <p className="text-gray-300 text-xs">CTR（クリック率）</p>
                        <p className="text-white font-bold text-lg">
                          {livestream.ctr}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Engagement Metrics - CSVインポートデータ */}
                {(livestream.likes || livestream.comments || livestream.shares || livestream.newFollowers || livestream.avgViewDuration) && (
                  <div className="bg-gradient-to-r from-pink-900/20 to-purple-900/20 border border-pink-600/30 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-pink-400 mb-3 flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      エンゲージメント
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Likes */}
                      {livestream.likes !== null && livestream.likes !== undefined && (
                        <div className="bg-gray-900/50 rounded p-3">
                          <p className="text-gray-300 text-xs flex items-center gap-1">
                            <Heart className="w-3 h-3 text-pink-400" />
                            いいね
                          </p>
                          <p className="text-white font-bold text-lg">
                            {Number(livestream.likes).toLocaleString()}
                          </p>
                        </div>
                      )}
                      
                      {/* Comments */}
                      {livestream.comments !== null && livestream.comments !== undefined && (
                        <div className="bg-gray-900/50 rounded p-3">
                          <p className="text-gray-300 text-xs flex items-center gap-1">
                            <MessageCircle className="w-3 h-3 text-blue-400" />
                            コメント
                          </p>
                          <p className="text-white font-bold text-lg">
                            {Number(livestream.comments).toLocaleString()}
                          </p>
                        </div>
                      )}
                      
                      {/* Shares */}
                      {livestream.shares !== null && livestream.shares !== undefined && (
                        <div className="bg-gray-900/50 rounded p-3">
                          <p className="text-gray-300 text-xs flex items-center gap-1">
                            <Share2 className="w-3 h-3 text-green-400" />
                            シェア
                          </p>
                          <p className="text-white font-bold text-lg">
                            {Number(livestream.shares).toLocaleString()}
                          </p>
                        </div>
                      )}
                      
                      {/* New Followers */}
                      {livestream.newFollowers !== null && livestream.newFollowers !== undefined && (
                        <div className="bg-gray-900/50 rounded p-3">
                          <p className="text-gray-300 text-xs flex items-center gap-1">
                            <UserPlus className="w-3 h-3 text-yellow-400" />
                            新規フォロワー
                          </p>
                          <p className="text-white font-bold text-lg">
                            {Number(livestream.newFollowers).toLocaleString()}
                          </p>
                        </div>
                      )}
                      
                      {/* Average View Duration */}
                      {livestream.avgViewDuration !== null && livestream.avgViewDuration !== undefined && (
                        <div className="bg-gray-900/50 rounded p-3">
                          <p className="text-gray-300 text-xs flex items-center gap-1">
                            <Timer className="w-3 h-3 text-cyan-400" />
                            平均視聴時間
                          </p>
                          <p className="text-white font-bold text-lg">
                            {Math.floor(livestream.avgViewDuration / 60)}分{livestream.avgViewDuration % 60}秒
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sales Details - CSVインポートデータ */}
                {(livestream.itemsSold || livestream.customerCount || livestream.avgPrice) && (
                  <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-600/30 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      販売詳細
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Items Sold */}
                      {livestream.itemsSold !== null && livestream.itemsSold !== undefined && (
                        <div className="bg-gray-900/50 rounded p-3">
                          <p className="text-gray-300 text-xs flex items-center gap-1">
                            <Package className="w-3 h-3 text-orange-400" />
                            販売数
                          </p>
                          <p className="text-white font-bold text-lg">
                            {Number(livestream.itemsSold).toLocaleString()}個
                          </p>
                        </div>
                      )}
                      
                      {/* Customers */}
                      {livestream.customerCount !== null && livestream.customerCount !== undefined && (
                        <div className="bg-gray-900/50 rounded p-3">
                          <p className="text-gray-300 text-xs flex items-center gap-1">
                            <Users className="w-3 h-3 text-blue-400" />
                            購入者数
                          </p>
                          <p className="text-white font-bold text-lg">
                            {Number(livestream.customerCount).toLocaleString()}人
                          </p>
                        </div>
                      )}
                      
                      {/* Average Price */}
                      {livestream.avgPrice !== null && livestream.avgPrice !== undefined && (
                        <div className="bg-gray-900/50 rounded p-3 col-span-2">
                          <p className="text-gray-300 text-xs flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-yellow-400" />
                            平均単価
                          </p>
                          <p className="text-white font-bold text-lg">
                            ¥{Number(livestream.avgPrice).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Delivered Brand with Duration */}
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-red-500 font-medium">配信したブランド</span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={openBrandDialog}
                        className="text-yellow-500 hover:text-yellow-400 hover:bg-gray-800 h-7 px-2"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        修正
                      </Button>
                    )}
                  </div>
                  {livestream.livestreamBrands && livestream.livestreamBrands.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {livestream.livestreamBrands.map((lb: any) => (
                        <div key={lb.id} className="flex justify-between items-center bg-gray-800/50 rounded-lg px-3 py-2">
                          <span className="text-white font-medium">{lb.brandName}</span>
                          <span className="text-gray-300">
                            {lb.durationMinutes != null ? (
                              <>
                                {Math.floor(lb.durationMinutes / 60) > 0 && `${Math.floor(lb.durationMinutes / 60)}時間`}
                                {lb.durationMinutes % 60 > 0 && `${lb.durationMinutes % 60}分`}
                                {lb.durationMinutes === 0 && '0分'}
                              </>
                            ) : (
                              '時間未設定'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-right">
                      <span className="text-white">{livestream.brand?.name || "-"}</span>
                    </div>
                  )}
                </div>

                
                {/* Delivery Result */}
                <div className="flex justify-between items-center">
                  <span className="text-red-500 font-medium">配信結果</span>
                  {livestream.result ? (
                    <Badge 
                      variant={livestream.result === "成功" ? "default" : "destructive"}
                      className={livestream.result === "成功" 
                        ? "bg-green-600 hover:bg-green-700" 
                        : "bg-red-600 hover:bg-red-700"
                      }
                    >
                      {livestream.result === "成功" ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> 成功</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> 失敗</>
                      )}
                    </Badge>
                  ) : (
                    <span className="text-gray-500">未設定</span>
                  )}
                </div>
                
                {/* Impact Factor */}
                <div className="flex justify-between items-center">
                  <span className="text-red-500 font-medium">影響した要因</span>
                  {livestream.impactFactor ? (
                    <Badge variant="outline" className="border-gray-600">
                      {getImpactFactorIcon(livestream.impactFactor)}
                      <span className="ml-1">{livestream.impactFactor}</span>
                    </Badge>
                  ) : (
                    <span className="text-gray-500">未設定</span>
                  )}
                </div>
                
                {/* Reason */}
                <div className="space-y-2">
                  <span className="text-red-500 font-medium">原因・備注</span>
                  <p className="text-gray-300">
                    {livestream.resultReason || "-"}
                  </p>
                </div>
                
                {/* Memo */}
                <div className="space-y-2">
                  <span className="text-red-500 font-medium">その他備注</span>
                  <p className="text-gray-300">{livestream.remarks || "-"}</p>
                </div>
                
                {/* 配信前スクリーンショット */}
                {(livestream as any).beforeScreenshotUrl && (
                  <div className="space-y-2">
                    <span className="text-gray-400 font-medium">配信前スクリーンショット</span>
                    <div className="border border-gray-700 rounded-lg overflow-hidden">
                      <img 
                        src={(livestream as any).beforeScreenshotUrl} 
                        alt="配信前スクリーンショット"
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                )}

                {/* 配信後スクリーンショット */}
                <div className="space-y-2">
                  <span className="text-red-500 font-medium">配信後スクリーンショット</span>
                  {livestream.screenshotUrl ? (
                    <div className="border border-gray-700 rounded-lg overflow-hidden">
                      <img 
                        src={livestream.screenshotUrl} 
                        alt="配信後スクリーンショット"
                        className="w-full h-auto"
                      />
                    </div>
                  ) : (
                    <p className="text-gray-500">-</p>
                  )}
                </div>
                
                {/* AI Structured Advice */}
                {livestream.aiStructuredAdvice && (
                  <div className="space-y-4">
                    <span className="text-red-500 font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      AIコーチング
                    </span>
                    <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-600/30 rounded-lg p-4 space-y-4">
                      {/* Summary */}
                      {livestream.aiStructuredAdvice.summary && (
                        <div>
                          <h4 className="text-yellow-500 font-medium mb-2">総評</h4>
                          <p className="text-gray-200">{livestream.aiStructuredAdvice.summary}</p>
                        </div>
                      )}
                      
                      {/* Good Points */}
                      {livestream.aiStructuredAdvice.goodPoints && livestream.aiStructuredAdvice.goodPoints.length > 0 && (
                        <div>
                          <h4 className="text-green-400 font-medium mb-2">良かった点</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {livestream.aiStructuredAdvice.goodPoints.map((point: string, i: number) => (
                              <li key={i} className="text-gray-300">{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Improvements */}
                      {livestream.aiStructuredAdvice.improvements && livestream.aiStructuredAdvice.improvements.length > 0 && (
                        <div>
                          <h4 className="text-orange-400 font-medium mb-2">改善ポイント</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {livestream.aiStructuredAdvice.improvements.map((point: string, i: number) => (
                              <li key={i} className="text-gray-300">{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Action Plans */}
                      {livestream.aiStructuredAdvice.actionPlans && livestream.aiStructuredAdvice.actionPlans.length > 0 && (
                        <div>
                          <h4 className="text-blue-400 font-medium mb-2">次回アクションプラン</h4>
                          <div className="space-y-2">
                            {livestream.aiStructuredAdvice.actionPlans.map((plan: { action: string; reason: string; timing: string }, i: number) => (
                              <div key={i} className="bg-gray-800/50 rounded p-3">
                                <p className="text-white font-medium">{plan.action}</p>
                                <p className="text-gray-300 text-sm mt-1">理由: {plan.reason}</p>
                                <p className="text-gray-400 text-xs mt-1">タイミング: {plan.timing}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Next Goal */}
                      {livestream.aiStructuredAdvice.nextGoal && (
                        <div>
                          <h4 className="text-purple-400 font-medium mb-2">次回の目標</h4>
                          <p className="text-gray-200 bg-purple-900/20 rounded p-2">{livestream.aiStructuredAdvice.nextGoal}</p>
                        </div>
                      )}
                      
                      {/* Calculated Metrics */}
                      {livestream.aiStructuredAdvice.calculatedMetrics && Object.keys(livestream.aiStructuredAdvice.calculatedMetrics).length > 0 && (
                        <div>
                          <h4 className="text-cyan-400 font-medium mb-2">分析指標</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(livestream.aiStructuredAdvice.calculatedMetrics).map(([key, value]) => (
                              <div key={key} className="bg-gray-800/50 rounded p-2">
                                <p className="text-gray-300 text-xs">{key}</p>
                                <p className="text-white font-medium">{String(value)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Legacy AI Advice (for old records) */}
                {!livestream.aiStructuredAdvice && livestream.aiAdvice && (
                  <div className="space-y-2">
                    <span className="text-red-500 font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      AIアドバイス
                    </span>
                    <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-600/30 rounded-lg p-4">
                      {(() => {
                        try {
                          let jsonStr = livestream.aiAdvice;
                          const firstBrace = livestream.aiAdvice.indexOf('{');
                          const lastBrace = livestream.aiAdvice.lastIndexOf('}');
                          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                            jsonStr = livestream.aiAdvice.substring(firstBrace, lastBrace + 1);
                          }
                          const parsed = JSON.parse(jsonStr);
                          if (parsed && (parsed.summary || parsed.goodPoints || parsed.improvements)) {
                            return (
                              <div className="space-y-3">
                                {parsed.summary && (
                                  <p className="text-gray-200 font-medium">{parsed.summary}</p>
                                )}
                                {parsed.goodPoints && parsed.goodPoints.length > 0 && (
                                  <div>
                                    <p className="text-green-400 text-xs font-medium mb-2">✓ 良かった点</p>
                                    <ul className="space-y-1">
                                      {parsed.goodPoints.map((point: string, i: number) => (
                                        <li key={i} className="text-gray-200 text-sm pl-3 border-l-2 border-green-500">{point}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {parsed.improvements && parsed.improvements.length > 0 && (
                                  <div>
                                    <p className="text-orange-400 text-xs font-medium mb-2">▲ 改善ポイント</p>
                                    <ul className="space-y-1">
                                      {parsed.improvements.map((point: string, i: number) => (
                                        <li key={i} className="text-gray-200 text-sm pl-3 border-l-2 border-orange-500">{point}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {parsed.nextActions && parsed.nextActions.length > 0 && (
                                  <div>
                                    <p className="text-blue-400 text-xs font-medium mb-2">▶ 次回のアクション</p>
                                    <div className="space-y-2">
                                      {parsed.nextActions.map((action: any, i: number) => (
                                        <div key={i} className="bg-blue-900/20 rounded-lg p-3">
                                          <p className="text-gray-200 text-sm font-medium">{action.action}</p>
                                          <p className="text-gray-300 text-xs mt-1">理由: {action.reason}</p>
                                          <p className="text-blue-300 text-xs mt-1">⏰ {action.timing}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {parsed.targetForNextTime && (
                                  <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                                    <p className="text-purple-300 text-xs font-medium">🎯 次回の目標</p>
                                    <p className="text-gray-200 text-sm mt-1">{parsed.targetForNextTime}</p>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        } catch (e) {}
                        return <p className="text-gray-200 whitespace-pre-wrap">{livestream.aiAdvice}</p>;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Action Buttons (View Mode Only) */}
        {!isEditing && canEdit && (
          <div className="flex justify-center gap-4">
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-900/30 px-6"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">⚠️ 配信履歴を削除</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    この配信履歴を削除してもよろしいですか？この操作は取り消せません。
                  </AlertDialogDescription>
                  <div className="mt-3">
                    <label className="text-sm text-gray-300 mb-1 block">削除パスワードを入力してください</label>
                    <Input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(false); }}
                      placeholder="パスワード"
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                    {deletePasswordError && <p className="text-red-400 text-xs mt-1">パスワードが間違っています</p>}
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700" onClick={() => { setDeletePassword(''); setDeletePasswordError(false); }}>
                    キャンセル
                  </AlertDialogCancel>
                  <button
                    onClick={() => {
                      if (deletePassword !== 'lcj') {
                        setDeletePasswordError(true);
                        return;
                      }
                      handleDelete();
                      setDeletePassword('');
                      setDeletePasswordError(false);
                    }}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    削除
                  </button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        
        {/* Back Button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => window.history.back()}
            className="bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-800 px-8 rounded-full"
          >
            戻る
          </Button>
        </div>
      </div>
      {/* Brand Editing Dialog */}
      <Dialog open={showBrandDialog} onOpenChange={setShowBrandDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">配信ブランドの編集</DialogTitle>
            <DialogDescription className="text-gray-400">
              ブランドを追加・削除し、配信時間を設定してください
            </DialogDescription>
          </DialogHeader>

          {/* Brand list */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {editBrands.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">ブランドが未設定です</p>
            )}
            {editBrands.map((b) => (
              <div key={b.brandId} className="flex items-center gap-3 bg-gray-800/70 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm font-medium truncate block">{b.brandName}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={b.durationMinutes ?? ""}
                    onChange={(e) => updateBrandDuration(b.brandId, e.target.value ? parseInt(e.target.value) : null)}
                    className="w-16 h-8 text-center text-white text-sm bg-gray-700 border-gray-600"
                  />
                  <span className="text-gray-400 text-xs">分</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeBrandFromList(b.brandId)}
                  className="text-gray-400 hover:text-red-400 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add brand */}
          <div className="pt-2">
            <Popover open={brandSearchOpen} onOpenChange={setBrandSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    ブランドを追加
                  </span>
                  <ChevronsUpDown className="w-4 h-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 bg-gray-900 border-gray-700" align="start">
                <Command className="bg-gray-900">
                  <CommandInput
                    placeholder="ブランド名で検索..."
                    value={brandSearchValue}
                    onValueChange={setBrandSearchValue}
                    className="text-white"
                  />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty className="text-gray-400 text-sm py-3 text-center">見つかりません</CommandEmpty>
                    <CommandGroup>
                      {brands?.filter((brand: any) =>
                        !editBrands.some(b => b.brandId === brand.id) &&
                        (brand.name?.toLowerCase().includes(brandSearchValue.toLowerCase()) ||
                         brand.nameJa?.toLowerCase().includes(brandSearchValue.toLowerCase()))
                      ).slice(0, 20).map((brand: any) => (
                        <CommandItem
                          key={brand.id}
                          value={brand.name}
                          onSelect={() => addBrandToList(brand)}
                          className="text-white hover:bg-gray-800 cursor-pointer"
                        >
                          <Check className={`w-4 h-4 mr-2 ${editBrands.some(b => b.brandId === brand.id) ? 'opacity-100' : 'opacity-0'}`} />
                          <span className="flex-1 truncate">{brand.name}</span>
                          {brand.nameJa && brand.nameJa !== brand.name && (
                            <span className="text-gray-400 ml-1 text-xs shrink-0">({brand.nameJa})</span>
                          )}
                          {brand.hasTikTokBackend && <span className="ml-1 shrink-0 text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">TikTok後台</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setShowBrandDialog(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-800"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSaveBrands}
              disabled={saveBrandsMutation.isPending}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {saveBrandsMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
