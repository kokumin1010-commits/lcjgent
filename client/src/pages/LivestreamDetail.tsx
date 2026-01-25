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
import { ArrowLeft, CheckCircle, XCircle, Sparkles, Package, User, Megaphone, HelpCircle, Pencil, Trash2, Save, Upload, X, Calendar, Clock, DollarSign, Eye, ShoppingCart, MousePointer } from "lucide-react";
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
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
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
                  <div className="text-right">
                    <p>開始　{formatDateTime(livestream.livestreamDate)}</p>
                    <p>終了　{formatDateTime(livestream.livestreamEndTime)}</p>
                  </div>
                </div>
                
                {/* Sales Total */}
                <div className="flex justify-between items-center">
                  <span className="text-red-500 font-medium">売上合計</span>
                  <span className="text-xl font-bold text-yellow-500">
                    ¥{formatCurrency(livestream.gmv || livestream.salesAmount || 0)}
                  </span>
                </div>

                {/* Duration */}
                {livestream.duration && (
                  <div className="flex justify-between items-center">
                    <span className="text-red-500 font-medium">配信時間</span>
                    <span>{Math.round(livestream.duration / 60 * 10) / 10}時間</span>
                  </div>
                )}

                {/* Viewer Count */}
                {livestream.viewerCount && (
                  <div className="flex justify-between items-center">
                    <span className="text-red-500 font-medium">視聴者数</span>
                    <span>{livestream.viewerCount?.toLocaleString() || "-"}</span>
                  </div>
                )}

                {/* Product Clicks & Orders */}
                {(livestream.productClicks || livestream.orderCount) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between items-center">
                      <span className="text-red-500 font-medium">商品クリック数</span>
                      <span>{livestream.productClicks?.toLocaleString() || "-"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-red-500 font-medium">注文数</span>
                      <span>{livestream.orderCount?.toLocaleString() || "-"}</span>
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
                
                {/* AI Advice */}
                {livestream.aiAdvice && (
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
