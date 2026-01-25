import { useState, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, X, Calendar, Clock, Sparkles, Loader2, Lightbulb } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function LiverRecord() {
  const params = useParams<{ id: string }>();
  const liverId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  
  // Form state
  const [brandId, setBrandId] = useState<number | null>(null);
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [salesAmount, setSalesAmount] = useState("");
  const [result, setResult] = useState<"成功" | "失敗" | "">("");
  const [impactFactor, setImpactFactor] = useState<"構成" | "商品" | "ライバー" | "広告" | "その他" | "">("");
  const [resultReason, setResultReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [analyzedData, setAnalyzedData] = useState<{
    salesAmount?: number | null;
    viewerCount?: number | null;
    peakViewerCount?: number | null;
    productClicks?: number | null;
    orderCount?: number | null;
    durationMinutes?: number | null;
    confidence?: string;
  } | null>(null);
  
  // Fetch liver info
  const { data: liver, isLoading: liverLoading } = trpc.liverManagement.getById.useQuery({
    id: liverId,
    month: new Date().toISOString().slice(0, 7),
  });
  
  // Fetch brands for selection
  const { data: brands } = trpc.brand.list.useQuery();
  
  // Note: Schedule selection feature will be added later
  // For now, users can manually input the livestream details
  const schedules: { id: number; startTime: string; brandId?: number; brandName?: string; endTime?: string }[] = [];
  
  const createLivestreamMutation = trpc.liverManagement.createLivestream.useMutation({
    onSuccess: () => {
      toast.success("配信記録を保存しました");
      setLocation(`/livers/${liverId}`);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsSubmitting(false);
    },
  });
  
  const uploadScreenshotMutation = trpc.liverManagement.uploadScreenshot.useMutation();
  const analyzeScreenshotMutation = trpc.liverManagement.analyzeScreenshot.useMutation();
  const generateAdviceMutation = trpc.liverManagement.generateAdvice.useMutation();
  
  const translations = {
    ja: {
      title: "配信内容の記録",
      selectBrand: "ブランドを選択",
      selectSchedule: "スケジュールから選択（任意）",
      noSchedule: "スケジュールなし（手動入力）",
      startDateTime: "開始日時",
      endDateTime: "終了日時",
      salesAmount: "売上金額",
      deliveryResult: "配信結果",
      success: "成功",
      failure: "失敗",
      notSet: "未設定",
      impactFactor: "影響した要因",
      composition: "構成",
      product: "商品",
      liver: "ライバー",
      ad: "広告",
      other: "その他",
      reason: "理由",
      memo: "メモ",
      screenshot: "配信後スクリーンショット",
      uploadImage: "画像をアップロード",
      save: "保存",
      saving: "保存中...",
      cancel: "キャンセル",
      required: "必須",
      analyzeScreenshot: "AI解析",
      analyzing: "解析中...",
      analysisComplete: "解析完了！データを自動入力しました",
      analysisError: "解析に失敗しました",
      generateAdvice: "アドバイスを生成",
      generatingAdvice: "生成中...",
      adviceTitle: "ワンポイントアドバイス",
      viewerCount: "視聴者数",
      peakViewerCount: "ピーク視聴者数",
      productClicks: "商品クリック数",
      orderCount: "注文数",
      durationMinutes: "配信時間（分）",
      confidence: "解析信頼度",
      high: "高",
      medium: "中",
      low: "低",
    },
    zh: {
      title: "记录直播内容",
      selectBrand: "选择品牌",
      selectSchedule: "从日程选择（可选）",
      noSchedule: "无日程（手动输入）",
      startDateTime: "开始时间",
      endDateTime: "结束时间",
      salesAmount: "销售金额",
      deliveryResult: "直播结果",
      success: "成功",
      failure: "失败",
      notSet: "未设置",
      impactFactor: "影响因素",
      composition: "构成",
      product: "商品",
      liver: "主播",
      ad: "广告",
      other: "其他",
      reason: "原因",
      memo: "备注",
      screenshot: "直播后截图",
      uploadImage: "上传图片",
      save: "保存",
      saving: "保存中...",
      cancel: "取消",
      required: "必填",
      analyzeScreenshot: "AI分析",
      analyzing: "分析中...",
      analysisComplete: "分析完成！数据已自动填入",
      analysisError: "分析失败",
      generateAdvice: "生成建议",
      generatingAdvice: "生成中...",
      adviceTitle: "一点建议",
      viewerCount: "观看人数",
      peakViewerCount: "峰值观看人数",
      productClicks: "商品点击数",
      orderCount: "订单数",
      durationMinutes: "直播时长（分钟）",
      confidence: "分析可信度",
      high: "高",
      medium: "中",
      low: "低",
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setScreenshotUrl(null);
    setAnalyzedData(null);
    setAdvice(null);
  };
  
  const handleAnalyzeScreenshot = async () => {
    if (!screenshotFile) return;
    
    setIsAnalyzing(true);
    try {
      // First upload the screenshot
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
        liverId,
      });
      setScreenshotUrl(uploadResult.url);
      
      // Then analyze the screenshot
      const analysisResult = await analyzeScreenshotMutation.mutateAsync({
        imageUrl: uploadResult.url,
      });
      
      setAnalyzedData(analysisResult);
      
      // Auto-fill form with analyzed data
      if (analysisResult.salesAmount !== null && analysisResult.salesAmount !== undefined) {
        setSalesAmount(analysisResult.salesAmount.toString());
      }
      
      // Set duration if available
      if (analysisResult.durationMinutes !== null && analysisResult.durationMinutes !== undefined) {
        // If we have start date/time, calculate end time
        if (startDate && startTime) {
          const start = new Date(`${startDate}T${startTime}`);
          const end = new Date(start.getTime() + analysisResult.durationMinutes * 60 * 1000);
          setEndDate(end.toISOString().slice(0, 10));
          setEndTime(end.toTimeString().slice(0, 5));
        }
      }
      
      toast.success(tr.analysisComplete);
      
      // Auto-generate advice
      handleGenerateAdvice(analysisResult);
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error(tr.analysisError);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleGenerateAdvice = async (data?: typeof analyzedData) => {
    const dataToUse = data || analyzedData;
    if (!dataToUse) return;
    
    setIsGeneratingAdvice(true);
    try {
      const adviceResult = await generateAdviceMutation.mutateAsync({
        salesAmount: dataToUse.salesAmount ?? undefined,
        viewerCount: dataToUse.viewerCount ?? undefined,
        peakViewerCount: dataToUse.peakViewerCount ?? undefined,
        productClicks: dataToUse.productClicks ?? undefined,
        orderCount: dataToUse.orderCount ?? undefined,
        durationMinutes: dataToUse.durationMinutes ?? undefined,
        result: result || undefined,
        impactFactor: impactFactor || undefined,
      });
      
      setAdvice(adviceResult.advice);
    } catch (error) {
      console.error("Failed to generate advice:", error);
    } finally {
      setIsGeneratingAdvice(false);
    }
  };
  
  const handleScheduleSelect = (scheduleIdStr: string) => {
    if (scheduleIdStr === "none") {
      setScheduleId(null);
      return;
    }
    
    const id = parseInt(scheduleIdStr, 10);
    setScheduleId(id);
    
    // Auto-fill from schedule
    const schedule = schedules?.find((s: { id: number; brandId?: number; startTime?: string; endTime?: string }) => s.id === id);
    if (schedule) {
      if (schedule.brandId) {
        setBrandId(schedule.brandId);
      }
      if (schedule.startTime) {
        const start = new Date(schedule.startTime);
        setStartDate(start.toISOString().slice(0, 10));
        setStartTime(start.toTimeString().slice(0, 5));
      }
      if (schedule.endTime) {
        const end = new Date(schedule.endTime);
        setEndDate(end.toISOString().slice(0, 10));
        setEndTime(end.toTimeString().slice(0, 5));
      }
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!brandId) {
      toast.error("ブランドを選択してください");
      return;
    }
    
    if (!startDate || !startTime) {
      toast.error("開始日時を入力してください");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Upload screenshot if exists and not already uploaded
      let finalScreenshotUrl = screenshotUrl;
      if (screenshotFile && !screenshotUrl) {
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
          liverId,
        });
        finalScreenshotUrl = uploadResult.url;
      }
      
      // Create livestream record
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = endDate && endTime ? new Date(`${endDate}T${endTime}`) : undefined;
      
      await createLivestreamMutation.mutateAsync({
        brandId,
        liverId,
        scheduleId: scheduleId || undefined,
        livestreamDate: startDateTime.toISOString(),
        livestreamEndTime: endDateTime?.toISOString(),
        salesAmount: salesAmount ? parseInt(salesAmount, 10) : undefined,
        result: result || undefined,
        impactFactor: impactFactor || undefined,
        resultReason: resultReason || undefined,
        remarks: remarks || undefined,
        screenshotUrl: finalScreenshotUrl || undefined,
      });
    } catch (error) {
      console.error("Failed to save livestream record:", error);
      setIsSubmitting(false);
    }
  };

  if (liverLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-gray-800" />
          <Skeleton className="h-64 w-full bg-gray-800" />
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
        <Link href={`/livers/${liverId}`}>
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            戻る
          </button>
        </Link>
        
        {/* Title */}
        <h1 className="text-2xl font-bold">{tr.title}</h1>
        <p className="text-gray-400">ライバー: {liver?.name || "不明"}</p>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Screenshot Upload with AI Analysis */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {tr.screenshot}
              <Sparkles className="w-4 h-4 text-yellow-500" />
            </Label>
            {screenshotPreview ? (
              <div className="space-y-4">
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
                
                {/* AI Analysis Button */}
                <Button
                  type="button"
                  onClick={handleAnalyzeScreenshot}
                  disabled={isAnalyzing}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {tr.analyzing}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {tr.analyzeScreenshot}
                    </>
                  )}
                </Button>
                
                {/* Analyzed Data Display */}
                {analyzedData && (
                  <Card className="bg-gray-900 border-gray-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                        解析結果
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          analyzedData.confidence === 'high' ? 'bg-green-600' :
                          analyzedData.confidence === 'medium' ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}>
                          {tr.confidence}: {analyzedData.confidence === 'high' ? tr.high : 
                            analyzedData.confidence === 'medium' ? tr.medium : tr.low}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm">
                      {analyzedData.viewerCount !== null && analyzedData.viewerCount !== undefined && (
                        <div>
                          <span className="text-gray-400">{tr.viewerCount}:</span>
                          <span className="ml-2 text-white">{analyzedData.viewerCount.toLocaleString()}</span>
                        </div>
                      )}
                      {analyzedData.peakViewerCount !== null && analyzedData.peakViewerCount !== undefined && (
                        <div>
                          <span className="text-gray-400">{tr.peakViewerCount}:</span>
                          <span className="ml-2 text-white">{analyzedData.peakViewerCount.toLocaleString()}</span>
                        </div>
                      )}
                      {analyzedData.productClicks !== null && analyzedData.productClicks !== undefined && (
                        <div>
                          <span className="text-gray-400">{tr.productClicks}:</span>
                          <span className="ml-2 text-white">{analyzedData.productClicks.toLocaleString()}</span>
                        </div>
                      )}
                      {analyzedData.orderCount !== null && analyzedData.orderCount !== undefined && (
                        <div>
                          <span className="text-gray-400">{tr.orderCount}:</span>
                          <span className="ml-2 text-white">{analyzedData.orderCount.toLocaleString()}</span>
                        </div>
                      )}
                      {analyzedData.durationMinutes !== null && analyzedData.durationMinutes !== undefined && (
                        <div>
                          <span className="text-gray-400">{tr.durationMinutes}:</span>
                          <span className="ml-2 text-white">{analyzedData.durationMinutes}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* AI Advice Display */}
                {advice && (
                  <Card className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-600/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-yellow-400 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        {tr.adviceTitle}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-white text-sm whitespace-pre-wrap">{advice}</p>
                    </CardContent>
                  </Card>
                )}
                
                {/* Regenerate Advice Button */}
                {analyzedData && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleGenerateAdvice()}
                    disabled={isGeneratingAdvice}
                    className="w-full border-yellow-600 text-yellow-400 hover:bg-yellow-600/20"
                  >
                    {isGeneratingAdvice ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {tr.generatingAdvice}
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4 mr-2" />
                        {tr.generateAdvice}
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                <Upload className="w-8 h-8 text-gray-500 mb-2" />
                <span className="text-gray-500">{tr.uploadImage}</span>
                <span className="text-xs text-gray-600 mt-1">AIが自動でデータを解析します</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
          
          {/* Schedule Selection (if available) */}
          {schedules && schedules.length > 0 && (
            <div className="space-y-2">
              <Label>{tr.selectSchedule}</Label>
              <Select 
                value={scheduleId?.toString() || "none"} 
                onValueChange={handleScheduleSelect}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700">
                  <SelectValue placeholder={tr.selectSchedule} />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="none">{tr.noSchedule}</SelectItem>
                  {schedules.map((schedule: { id: number; startTime: string; brandName?: string }) => (
                    <SelectItem key={schedule.id} value={schedule.id.toString()}>
                      {new Date(schedule.startTime).toLocaleDateString()} - {schedule.brandName || "ブランド未設定"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Brand Selection */}
          <div className="space-y-2">
            <Label>
              {tr.selectBrand} <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={brandId?.toString() || ""} 
              onValueChange={(v) => setBrandId(parseInt(v, 10))}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700">
                <SelectValue placeholder={tr.selectBrand} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 max-h-60">
                {brands?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id.toString()}>
                    {brand.name} {brand.nameJa && `(${brand.nameJa})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Start DateTime */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                {tr.startDateTime} <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-gray-900 border-gray-700 w-32"
                />
              </div>
            </div>
            
            {/* End DateTime */}
            <div className="space-y-2">
              <Label>{tr.endDateTime}</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-gray-900 border-gray-700 w-32"
                />
              </div>
            </div>
          </div>
          
          {/* Sales Amount */}
          <div className="space-y-2">
            <Label>{tr.salesAmount}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">¥</span>
              <Input
                type="number"
                value={salesAmount}
                onChange={(e) => setSalesAmount(e.target.value)}
                className="bg-gray-900 border-gray-700 pl-8"
                placeholder="0"
              />
            </div>
          </div>
          
          {/* Result */}
          <div className="space-y-2">
            <Label>{tr.deliveryResult}</Label>
            <Select 
              value={result || "none"} 
              onValueChange={(v) => setResult(v === "none" ? "" : v as "成功" | "失敗")}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700">
                <SelectValue placeholder={tr.notSet} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="none">{tr.notSet}</SelectItem>
                <SelectItem value="成功">{tr.success}</SelectItem>
                <SelectItem value="失敗">{tr.failure}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Impact Factor */}
          <div className="space-y-2">
            <Label>{tr.impactFactor}</Label>
            <Select 
              value={impactFactor || "none"} 
              onValueChange={(v) => setImpactFactor(v === "none" ? "" : v as "構成" | "商品" | "ライバー" | "広告" | "その他")}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700">
                <SelectValue placeholder={tr.notSet} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="none">{tr.notSet}</SelectItem>
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
            <Label>{tr.reason}</Label>
            <Textarea
              value={resultReason}
              onChange={(e) => setResultReason(e.target.value)}
              className="bg-gray-900 border-gray-700"
              rows={3}
              placeholder="配信結果の理由を入力..."
            />
          </div>
          
          {/* Memo */}
          <div className="space-y-2">
            <Label>{tr.memo}</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="bg-gray-900 border-gray-700"
              rows={3}
              placeholder="メモを入力..."
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-center gap-4 pt-4">
            <Link href={`/livers/${liverId}`}>
              <Button
                type="button"
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8"
              >
                {tr.cancel}
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 px-8"
            >
              {isSubmitting ? tr.saving : tr.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
