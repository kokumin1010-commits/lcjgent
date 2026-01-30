import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
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
import { ArrowLeft, CheckCircle, XCircle, Sparkles, Package, User, Megaphone, HelpCircle, Pencil, Trash2, Save, Upload, X, Calendar, Clock, DollarSign, Eye, ShoppingCart, MousePointer, Heart, MessageCircle, Share2, UserPlus, Timer, Users, TrendingUp, FileSpreadsheet, AlertTriangle } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export default function LivestreamDetail() {
  const params = useParams<{ id: string }>();
  const livestreamId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Edit form state
  const [formData, setFormData] = useState({
    livestreamDate: "",
    livestreamEndTime: "",
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

  const { data: livestream, isLoading, refetch } = trpc.liverManagement.getLivestreamDetail.useQuery({
    id: livestreamId,
  });
  
  const { data: brands } = trpc.brand.list.useQuery();

  // Initialize form data when livestream is loaded
  useEffect(() => {
    if (livestream) {
      const formatDateTimeLocal = (date: Date | string | null) => {
        if (!date) return "";
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const mins = String(d.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${mins}`;
      };

      setFormData({
        livestreamDate: formatDateTimeLocal(livestream.livestreamDate),
        livestreamEndTime: formatDateTimeLocal(livestream.livestreamEndTime),
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
    // JST（日本時間）で表示
    const d = new Date(date);
    const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    const year = jstDate.getUTCFullYear();
    const month = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(jstDate.getUTCDate()).padStart(2, "0");
    const weekday = ["日", "月", "火", "水", "木", "金", "土"][jstDate.getUTCDay()];
    const hours = String(jstDate.getUTCHours()).padStart(2, "0");
    const mins = String(jstDate.getUTCMinutes()).padStart(2, "0");
    return `${year}/${month}/${day}(${weekday}) ${hours}:${mins}`;
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString();
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
    }> = [];
    
    // ヘッダー行をスキップ（最初の3行はヘッダー）
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
      
      // CSVパース（カンマ区切り、引用符対応）
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
        // CSVファイルの場合
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

        updateMutation.mutate({
        id: livestreamId,
        livestreamDate: formData.livestreamDate,
        livestreamEndTime: formData.livestreamEndTime || null,
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
              {!isEditing && (
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

            {isEditing ? (
              // Edit Mode
              <div className="space-y-6">
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
                    ¥{formatCurrency(livestream.gmv || livestream.salesAmount || 0)}
                  </span>
                </div>

                {/* 商品別売上セクション（カード形式+プログレスバー+ランキング） */}
                <div className="bg-gradient-to-r from-orange-900/20 to-amber-900/20 border border-orange-600/30 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      商品別売上
                    </h3>
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
                      name: product.productName.length > 15 
                        ? product.productName.substring(0, 15) + '...' 
                        : product.productName,
                      fullName: product.productName,
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
                                          <p className="text-yellow-400 font-bold">¥{data.value.toLocaleString()}</p>
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
                                    {product.productName}
                                  </p>
                                </div>
                              </div>
                              
                              {/* 売上金額と構成比 */}
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xl font-bold text-yellow-400">
                                  ¥{sales.toLocaleString()}
                                </span>
                                <span className="text-sm text-gray-400">
                                  売上構成比 {percentage.toFixed(1)}%
                                </span>
                              </div>
                              
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
                                    クリック Clicks: {product.productClicks.toLocaleString()}回
                                  </span>
                                )}
                                {product.productImpressions !== null && product.productImpressions !== undefined && (
                                  <span className="flex items-center gap-1 text-gray-300">
                                    <Eye className="w-3 h-3 text-gray-500" />
                                    インプ Impressions: {product.productImpressions.toLocaleString()}回
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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
                        {livestream.viewerCount?.toLocaleString() || "-"}
                      </p>
                    </div>
                    
                    {/* Product Clicks */}
                    <div className="bg-gray-900/50 rounded p-3">
                      <p className="text-gray-300 text-xs flex items-center gap-1">
                        <MousePointer className="w-3 h-3" />
                        商品クリック数
                      </p>
                      <p className="text-white font-bold text-lg">
                        {livestream.productClicks?.toLocaleString() || "-"}
                      </p>
                    </div>
                    
                    {/* Order Count */}
                    <div className="bg-gray-900/50 rounded p-3">
                      <p className="text-gray-300 text-xs flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        注文数
                      </p>
                      <p className="text-white font-bold text-lg">
                        {livestream.orderCount?.toLocaleString() || "-"}
                      </p>
                    </div>
                    
                    {/* Impressions */}
                    {livestream.impressions && (
                      <div className="bg-gray-900/50 rounded p-3">
                        <p className="text-gray-300 text-xs">インプレッション</p>
                        <p className="text-white font-bold text-lg">
                          {livestream.impressions?.toLocaleString()}
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
                            {livestream.likes.toLocaleString()}
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
                            {livestream.comments.toLocaleString()}
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
                            {livestream.shares.toLocaleString()}
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
                            {livestream.newFollowers.toLocaleString()}
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
                            {livestream.itemsSold.toLocaleString()}個
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
                            {livestream.customerCount.toLocaleString()}人
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
                            ¥{livestream.avgPrice.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Delivered Brand */}
                <div className="flex justify-between items-center">
                  <span className="text-red-500 font-medium">配信したブランド</span>
                  <span>{livestream.brand?.name || "-"}</span>
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
                
                {/* Screenshot */}
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
                      <p className="text-gray-200 whitespace-pre-wrap">{livestream.aiAdvice}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Action Buttons (View Mode Only) */}
        {!isEditing && (
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
                  <AlertDialogTitle className="text-white">配信履歴を削除</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    この配信履歴を削除してもよろしいですか？この操作は取り消せません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
                    キャンセル
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    削除
                  </AlertDialogAction>
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
    </div>
  );
}
