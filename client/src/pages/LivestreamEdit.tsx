import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Save, Upload, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function LivestreamEdit() {
  const params = useParams<{ id: string }>();
  const livestreamId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();

  const [formData, setFormData] = useState({
    brandId: 0,
    livestreamDate: "",
    livestreamEndTime: "",
    salesAmount: "",
    result: "" as "" | "成功" | "失敗",
    impactFactor: "" as "" | "構成" | "商品" | "ライバー" | "広告" | "その他",
    resultReason: "",
    remarks: "",
    screenshotUrl: "",
  });

  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: livestream, isLoading } = trpc.liverManagement.getLivestreamDetail.useQuery({
    id: livestreamId,
  });

  const { data: brands } = trpc.brand.list.useQuery();

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
        brandId: livestream.brandId,
        livestreamDate: formatDateTimeLocal(livestream.livestreamDate),
        livestreamEndTime: formatDateTimeLocal(livestream.livestreamEndTime),
        salesAmount: livestream.salesAmount?.toString() || livestream.gmv?.toString() || "",
        result: (livestream.result as "" | "成功" | "失敗") || "",
        impactFactor: (livestream.impactFactor as "" | "構成" | "商品" | "ライバー" | "広告" | "その他") || "",
        resultReason: livestream.resultReason || "",
        remarks: livestream.remarks || "",
        screenshotUrl: livestream.screenshotUrl || "",
      });
      
      // Set existing screenshot as preview
      if (livestream.screenshotUrl) {
        setScreenshotPreview(livestream.screenshotUrl);
      }
    }
  }, [livestream]);

  const updateMutation = trpc.liverManagement.updateLivestream.useMutation({
    onSuccess: () => {
      toast.success("配信履歴を更新しました");
      setLocation(`/livers/livestream/${livestreamId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const uploadScreenshotMutation = trpc.liverManagement.uploadScreenshot.useMutation();

  const translations = {
    ja: {
      editLivestream: "配信履歴を編集",
      brand: "ブランド",
      selectBrand: "ブランドを選択",
      startTime: "開始日時",
      endTime: "終了日時",
      salesAmount: "売上金額",
      deliveryResult: "配信結果",
      success: "成功",
      failure: "失敗",
      impactFactor: "影響した要因",
      composition: "構成",
      product: "商品",
      liver: "ライバー",
      ad: "広告",
      other: "その他",
      reason: "理由",
      memo: "メモ",
      screenshot: "スクリーンショット",
      uploadImage: "画像をアップロード",
      back: "戻る",
      save: "保存",
      saving: "保存中...",
      notSet: "未設定",
    },
    zh: {
      editLivestream: "编辑直播记录",
      brand: "品牌",
      selectBrand: "选择品牌",
      startTime: "开始时间",
      endTime: "结束时间",
      salesAmount: "销售金额",
      deliveryResult: "直播结果",
      success: "成功",
      failure: "失败",
      impactFactor: "影响因素",
      composition: "构成",
      product: "商品",
      liver: "主播",
      ad: "广告",
      other: "其他",
      reason: "原因",
      memo: "备注",
      screenshot: "截图",
      uploadImage: "上传图片",
      back: "返回",
      save: "保存",
      saving: "保存中...",
      notSet: "未设置",
    },
  };

  const tr = translations[language as keyof typeof translations] || translations.ja;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      let screenshotUrl = formData.screenshotUrl;

      // Upload new screenshot if selected
      if (screenshotFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data:image/xxx;base64, prefix
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.readAsDataURL(screenshotFile);
        });
        const base64 = await base64Promise;

        // Upload via tRPC mutation
        const uploadResult = await uploadScreenshotMutation.mutateAsync({
          base64,
          filename: screenshotFile.name,
          liverId: livestream?.liverId ?? undefined,
        });
        screenshotUrl = uploadResult.url;
      }

      updateMutation.mutate({
        id: livestreamId,
        brandId: formData.brandId,
        livestreamDate: formData.livestreamDate,
        livestreamEndTime: formData.livestreamEndTime || null,
        salesAmount: formData.salesAmount ? parseInt(formData.salesAmount, 10) : null,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-gray-800" />
          <Skeleton className="h-96 w-full bg-gray-800" />
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
            {tr.back}
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
          {tr.back}
        </button>
        
        {/* Edit Form */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">{tr.editLivestream}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Brand */}
              <div className="space-y-2">
                <Label className="text-red-500">{tr.brand}</Label>
                <Select
                  value={formData.brandId.toString()}
                  onValueChange={(v) => setFormData({ ...formData, brandId: parseInt(v, 10) })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder={tr.selectBrand} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {brands?.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id.toString()}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <Label className="text-red-500">{tr.startTime}</Label>
                <Input
                  type="datetime-local"
                  value={formData.livestreamDate}
                  onChange={(e) => setFormData({ ...formData, livestreamDate: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <Label className="text-red-500">{tr.endTime}</Label>
                <Input
                  type="datetime-local"
                  value={formData.livestreamEndTime}
                  onChange={(e) => setFormData({ ...formData, livestreamEndTime: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              {/* Sales Amount */}
              <div className="space-y-2">
                <Label className="text-red-500">{tr.salesAmount}</Label>
                <Input
                  type="number"
                  value={formData.salesAmount}
                  onChange={(e) => setFormData({ ...formData, salesAmount: e.target.value })}
                  placeholder="0"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              {/* Result */}
              <div className="space-y-2">
                <Label className="text-red-500">{tr.deliveryResult}</Label>
                <Select
                  value={formData.result || "none"}
                  onValueChange={(v) => setFormData({ ...formData, result: v === "none" ? "" : v as "成功" | "失敗" })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder={tr.notSet} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="none" className="text-gray-400">{tr.notSet}</SelectItem>
                    <SelectItem value="成功" className="text-green-500">{tr.success}</SelectItem>
                    <SelectItem value="失敗" className="text-red-500">{tr.failure}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Impact Factor */}
              <div className="space-y-2">
                <Label className="text-red-500">{tr.impactFactor}</Label>
                <Select
                  value={formData.impactFactor || "none"}
                  onValueChange={(v) => setFormData({ ...formData, impactFactor: v === "none" ? "" : v as "構成" | "商品" | "ライバー" | "広告" | "その他" })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder={tr.notSet} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="none" className="text-gray-400">{tr.notSet}</SelectItem>
                    <SelectItem value="構成">{tr.composition}</SelectItem>
                    <SelectItem value="商品">{tr.product}</SelectItem>
                    <SelectItem value="ライバー">{tr.liver}</SelectItem>
                    <SelectItem value="広告">{tr.ad}</SelectItem>
                    <SelectItem value="その他">{tr.other}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label className="text-red-500">{tr.reason}</Label>
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
                <Label className="text-red-500">{tr.memo}</Label>
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
                <Label className="text-red-500">{tr.screenshot}</Label>
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
                    <span className="text-gray-500">{tr.uploadImage}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-center gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8"
                >
                  {tr.back}
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || isUploading}
                  className="bg-red-600 hover:bg-red-700 px-8"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateMutation.isPending || isUploading ? tr.saving : tr.save}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
