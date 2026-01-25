import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Video, Calendar, DollarSign, Clock, X, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

export default function LiverSelfRecord() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const scheduleIdParam = searchParams.get("scheduleId");
  const dateParam = searchParams.get("date");
  
  // Get current liver info
  const { data: liverInfo, isLoading: isLoadingLiver } = trpc.liver.me.useQuery();
  
  // Get brands for selection
  const { data: brands } = trpc.brand.list.useQuery();

  // Get schedule info if scheduleId is provided
  const { data: scheduleInfo } = trpc.schedule.getById.useQuery(
    { id: parseInt(scheduleIdParam || "0") },
    { enabled: !!scheduleIdParam }
  );

  const [formData, setFormData] = useState({
    brandId: "",
    livestreamDate: dateParam || "",
    livestreamStartTime: "",
    livestreamEndTime: "",
    salesAmount: "",
    result: "",
    impactFactor: "",
    resultReason: "",
    remarks: "",
    scheduleId: scheduleIdParam || "",
  });
  
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill form data from schedule
  useEffect(() => {
    if (scheduleInfo) {
      const startTime = new Date(scheduleInfo.startTime);
      const endTime = scheduleInfo.endTime ? new Date(scheduleInfo.endTime) : null;
      
      setFormData(prev => ({
        ...prev,
        livestreamDate: startTime.toISOString().split('T')[0],
        livestreamStartTime: startTime.toTimeString().slice(0, 5),
        livestreamEndTime: endTime ? endTime.toTimeString().slice(0, 5) : "",
        brandId: scheduleInfo.brandId?.toString() || prev.brandId,
        scheduleId: scheduleInfo.id.toString(),
      }));
    }
  }, [scheduleInfo]);

  const createLivestreamMutation = trpc.liverManagement.createLivestream.useMutation({
    onSuccess: () => {
      toast.success("配信記録を保存しました");
      navigate("/liver/mypage");
    },
    onError: (error) => {
      toast.error(error.message);
      setIsSubmitting(false);
    },
  });

  const uploadScreenshotMutation = trpc.liverManagement.uploadScreenshot.useMutation();

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!liverInfo?.id) {
      toast.error("ログインが必要です");
      return;
    }

    if (!formData.brandId) {
      toast.error("ブランドを選択してください");
      return;
    }

    if (!formData.livestreamDate || !formData.livestreamStartTime) {
      toast.error("配信日時を入力してください");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload screenshot if exists
      let screenshotUrl: string | undefined;
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
          liverId: liverInfo.id,
        });
        screenshotUrl = uploadResult.url;
      }

      const livestreamDateTime = new Date(`${formData.livestreamDate}T${formData.livestreamStartTime}`);
      const endDateTime = formData.livestreamEndTime 
        ? new Date(`${formData.livestreamDate}T${formData.livestreamEndTime}`)
        : undefined;

      createLivestreamMutation.mutate({
        brandId: parseInt(formData.brandId),
        liverId: liverInfo.id,
        livestreamDate: livestreamDateTime.toISOString(),
        livestreamEndTime: endDateTime?.toISOString(),
        salesAmount: formData.salesAmount ? parseInt(formData.salesAmount) : undefined,
        result: formData.result as "成功" | "失敗" | undefined,
        impactFactor: formData.impactFactor as "構成" | "商品" | "ライバー" | "広告" | "その他" | undefined,
        resultReason: formData.resultReason || undefined,
        remarks: formData.remarks || undefined,
        screenshotUrl,
        scheduleId: formData.scheduleId ? parseInt(formData.scheduleId) : undefined,
      });
    } catch (error) {
      console.error("Failed to save livestream:", error);
      toast.error("保存に失敗しました");
      setIsSubmitting(false);
    }
  };

  if (isLoadingLiver) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!liverInfo) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-white text-center">ログインが必要です</p>
        <Button
          onClick={() => navigate("/liver/login")}
          className="bg-red-600 hover:bg-red-700"
        >
          ログインページへ
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black border-b-2 border-red-600 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/liver/mypage")}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-yellow-500">配信内容の記録</h1>
        </div>
      </header>

      {/* Red line separator */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

      <div className="container max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Schedule Link Info */}
          {scheduleInfo && (
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <LinkIcon className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm text-yellow-500 font-medium">スケジュールから記録</p>
                    <p className="text-white">{scheduleInfo.title}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(scheduleInfo.startTime).toLocaleDateString("ja-JP", {
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Brand Selection */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Video className="h-5 w-5 text-red-500" />
                配信ブランド
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={formData.brandId}
                onValueChange={(value) => setFormData({ ...formData, brandId: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="ブランドを選択" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {brands?.map((brand: { id: number; name: string }) => (
                    <SelectItem key={brand.id} value={brand.id.toString()}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Date & Time */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Calendar className="h-5 w-5 text-red-500" />
                配信日時
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-400">配信日</Label>
                <Input
                  type="date"
                  value={formData.livestreamDate}
                  onChange={(e) => setFormData({ ...formData, livestreamDate: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">開始時刻</Label>
                  <Input
                    type="time"
                    value={formData.livestreamStartTime}
                    onChange={(e) => setFormData({ ...formData, livestreamStartTime: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">終了時刻</Label>
                  <Input
                    type="time"
                    value={formData.livestreamEndTime}
                    onChange={(e) => setFormData({ ...formData, livestreamEndTime: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Amount */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <DollarSign className="h-5 w-5 text-yellow-500" />
                売上金額
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Result */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Clock className="h-5 w-5 text-red-500" />
                配信結果
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-400">結果</Label>
                <Select
                  value={formData.result}
                  onValueChange={(value) => setFormData({ ...formData, result: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="結果を選択" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="成功">成功</SelectItem>
                    <SelectItem value="失敗">失敗</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">影響要因</Label>
                <Select
                  value={formData.impactFactor}
                  onValueChange={(value) => setFormData({ ...formData, impactFactor: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="影響要因を選択" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="構成">構成</SelectItem>
                    <SelectItem value="商品">商品</SelectItem>
                    <SelectItem value="ライバー">ライバー</SelectItem>
                    <SelectItem value="広告">広告</SelectItem>
                    <SelectItem value="その他">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">理由・メモ</Label>
                <Textarea
                  value={formData.resultReason}
                  onChange={(e) => setFormData({ ...formData, resultReason: e.target.value })}
                  placeholder="結果の理由や気づきを記入..."
                  className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Screenshot */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Upload className="h-5 w-5 text-red-500" />
                スクリーンショット
              </CardTitle>
            </CardHeader>
            <CardContent>
              {screenshotPreview ? (
                <div className="relative">
                  <img 
                    src={screenshotPreview} 
                    alt="Screenshot preview" 
                    className="w-full rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={removeScreenshot}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
                  <Upload className="h-8 w-8 text-gray-500 mb-2" />
                  <span className="text-sm text-gray-400">クリックして画像をアップロード</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="hidden"
                  />
                </label>
              )}
            </CardContent>
          </Card>

          {/* Remarks */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white">備考</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="その他のメモ..."
                className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-bold"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                保存中...
              </div>
            ) : (
              "配信記録を保存"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
