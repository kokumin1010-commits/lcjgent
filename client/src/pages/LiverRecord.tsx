import { useState, useEffect } from "react";
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
import { ArrowLeft, X, Sparkles, Loader2, Lightbulb, Camera, DollarSign, Users, Clock, ShoppingCart, MousePointer } from "lucide-react";
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
  const [viewerCount, setViewerCount] = useState("");
  const [peakViewerCount, setPeakViewerCount] = useState("");
  const [productClicks, setProductClicks] = useState("");
  const [orderCount, setOrderCount] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
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
  const [structuredAdvice, setStructuredAdvice] = useState<{
    summary?: string;
    goodPoints?: string[];
    improvements?: string[];
    nextActions?: { action: string; reason: string; timing: string }[];
    targetForNextTime?: string;
  } | null>(null);
  const [calculatedMetrics, setCalculatedMetrics] = useState<Record<string, string | number> | null>(null);
  const [analysisConfidence, setAnalysisConfidence] = useState<string | null>(null);
  
  // Fetch liver info
  const { data: liver, isLoading: liverLoading } = trpc.liverManagement.getById.useQuery({
    id: liverId,
    month: new Date().toISOString().slice(0, 7),
  });
  
  // Fetch brands for selection
  const { data: brands } = trpc.brand.list.useQuery();
  
  // Note: Schedule selection feature will be added later
  const schedules: { id: number; startTime: string; brandId?: number; brandName?: string; endTime?: string }[] = [];
  
  const createLivestreamMutation = trpc.liverManagement.createLivestream.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? "配信記録を保存しました" : "直播记录已保存");
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
      subtitle: "TikTokダッシュボードのスクリーンショットをアップロードすると、AIが自動で解析します",
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
      screenshot: "スクリーンショット",
      uploadImage: "画像をアップロード",
      tapToUpload: "タップしてスクリーンショットをアップロード",
      aiAnalysis: "AIが自動でデータを解析します",
      save: "保存",
      saving: "保存中...",
      cancel: "キャンセル",
      required: "必須",
      analyzeScreenshot: "再解析",
      analyzing: "解析中...",
      analysisComplete: "解析完了！データを自動入力しました",
      analysisError: "解析に失敗しました",
      generateAdvice: "アドバイスを再生成",
      generatingAdvice: "生成中...",
      adviceTitle: "ワンポイントアドバイス",
      viewerCount: "視聴者数",
      peakViewerCount: "ピーク視聴者数",
      productClicks: "商品クリック数",
      orderCount: "注文数",
      durationMinutes: "配信時間",
      confidence: "解析信頼度",
      high: "高",
      medium: "中",
      low: "低",
      analysisResult: "AI解析結果",
      detailsForm: "詳細情報",
      minutes: "分",
      editableHint: "解析データは編集可能です",
    },
    zh: {
      title: "记录直播内容",
      subtitle: "上传TikTok仪表板截图，AI将自动分析",
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
      screenshot: "截图",
      uploadImage: "上传图片",
      tapToUpload: "点击上传截图",
      aiAnalysis: "AI将自动分析数据",
      save: "保存",
      saving: "保存中...",
      cancel: "取消",
      required: "必填",
      analyzeScreenshot: "重新分析",
      analyzing: "分析中...",
      analysisComplete: "分析完成！数据已自动填入",
      analysisError: "分析失败",
      generateAdvice: "重新生成建议",
      generatingAdvice: "生成中...",
      adviceTitle: "一点建议",
      viewerCount: "观看人数",
      peakViewerCount: "峰值观看人数",
      productClicks: "商品点击数",
      orderCount: "订单数",
      durationMinutes: "直播时长",
      confidence: "分析可信度",
      high: "高",
      medium: "中",
      low: "低",
      analysisResult: "AI分析结果",
      detailsForm: "详细信息",
      minutes: "分钟",
      editableHint: "分析数据可编辑",
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
      
      // Auto-analyze after upload
      setTimeout(() => {
        handleAnalyzeScreenshot(file);
      }, 500);
    }
  };
  
  const removeScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setScreenshotUrl(null);
    setAdvice(null);
    setAnalysisConfidence(null);
    // Clear analyzed fields
    setSalesAmount("");
    setViewerCount("");
    setPeakViewerCount("");
    setProductClicks("");
    setOrderCount("");
    setDurationMinutes("");
  };
  
  const handleAnalyzeScreenshot = async (file?: File) => {
    const fileToAnalyze = file || screenshotFile;
    if (!fileToAnalyze) return;
    
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
        reader.readAsDataURL(fileToAnalyze);
      });
      const base64 = await base64Promise;
      
      const uploadResult = await uploadScreenshotMutation.mutateAsync({
        base64,
        filename: fileToAnalyze.name,
        liverId,
      });
      setScreenshotUrl(uploadResult.url);
      
      // Determine MIME type from file
      const mimeType = fileToAnalyze.type || "image/png";
      
      // Analyze the screenshot using Base64 data directly (bypasses CloudFront URL access issues)
      const analysisResult = await analyzeScreenshotMutation.mutateAsync({
        imageBase64: base64,
        mimeType: mimeType,
      });
      
      setAnalysisConfidence(analysisResult.confidence || null);
      
      // Auto-fill form with analyzed data
      if (analysisResult.salesAmount !== null && analysisResult.salesAmount !== undefined) {
        setSalesAmount(analysisResult.salesAmount.toString());
      }
      if (analysisResult.viewerCount !== null && analysisResult.viewerCount !== undefined) {
        setViewerCount(analysisResult.viewerCount.toString());
      }
      if (analysisResult.peakViewerCount !== null && analysisResult.peakViewerCount !== undefined) {
        setPeakViewerCount(analysisResult.peakViewerCount.toString());
      }
      if (analysisResult.productClicks !== null && analysisResult.productClicks !== undefined) {
        setProductClicks(analysisResult.productClicks.toString());
      }
      if (analysisResult.orderCount !== null && analysisResult.orderCount !== undefined) {
        setOrderCount(analysisResult.orderCount.toString());
      }
      if (analysisResult.durationMinutes !== null && analysisResult.durationMinutes !== undefined) {
        setDurationMinutes(analysisResult.durationMinutes.toString());
      }
      
      // Extract date/time if available
      if (analysisResult.startDateTime) {
        const [datePart, timePart] = analysisResult.startDateTime.split(' ');
        if (datePart) setStartDate(datePart);
        if (timePart) setStartTime(timePart);
      }
      if (analysisResult.endDateTime) {
        const [datePart, timePart] = analysisResult.endDateTime.split(' ');
        if (datePart) setEndDate(datePart);
        if (timePart) setEndTime(timePart);
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
  
  const handleGenerateAdvice = async (data?: {
    salesAmount?: number | null;
    viewerCount?: number | null;
    peakViewerCount?: number | null;
    productClicks?: number | null;
    orderCount?: number | null;
    durationMinutes?: number | null;
  }) => {
    const dataToUse = data || {
      salesAmount: salesAmount ? parseInt(salesAmount) : undefined,
      viewerCount: viewerCount ? parseInt(viewerCount) : undefined,
      peakViewerCount: peakViewerCount ? parseInt(peakViewerCount) : undefined,
      productClicks: productClicks ? parseInt(productClicks) : undefined,
      orderCount: orderCount ? parseInt(orderCount) : undefined,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
    };
    
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
        liverId: liverId || undefined,
      });
      
      setAdvice(adviceResult.advice);
      if (adviceResult.structured) {
        setStructuredAdvice(adviceResult.structured);
      }
      if (adviceResult.metrics) {
        setCalculatedMetrics(adviceResult.metrics);
      }
    } catch (error) {
      console.error("Failed to generate advice:", error);
    } finally {
      setIsGeneratingAdvice(false);
    }
  };
  
  const handleScheduleSelect = (value: string) => {
    if (value === "none") {
      setScheduleId(null);
      return;
    }
    
    const selectedScheduleId = parseInt(value, 10);
    setScheduleId(selectedScheduleId);
    
    const schedule = schedules.find(s => s.id === selectedScheduleId);
    if (schedule) {
      const startDateTime = new Date(schedule.startTime);
      setStartDate(startDateTime.toISOString().split('T')[0]);
      setStartTime(startDateTime.toTimeString().slice(0, 5));
      
      if (schedule.endTime) {
        const endDateTime = new Date(schedule.endTime);
        setEndDate(endDateTime.toISOString().split('T')[0]);
        setEndTime(endDateTime.toTimeString().slice(0, 5));
      }
      
      if (schedule.brandId) {
        setBrandId(schedule.brandId);
      }
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!brandId) {
      toast.error(language === "ja" ? "ブランドを選択してください" : "请选择品牌");
      return;
    }
    
    if (!startDate || !startTime) {
      toast.error(language === "ja" ? "開始日時を入力してください" : "请输入开始时间");
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
      
      const livestreamDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = endDate && endTime 
        ? new Date(`${endDate}T${endTime}`)
        : undefined;
      
      createLivestreamMutation.mutate({
        brandId,
        liverId,
        livestreamDate: livestreamDateTime.toISOString(),
        livestreamEndTime: endDateTime?.toISOString(),
        salesAmount: salesAmount ? parseInt(salesAmount) : undefined,
        result: result as "成功" | "失敗" | undefined,
        impactFactor: impactFactor as "構成" | "商品" | "ライバー" | "広告" | "その他" | undefined,
        resultReason: resultReason || undefined,
        remarks: remarks || undefined,
        screenshotUrl: finalScreenshotUrl || undefined,
        scheduleId: scheduleId || undefined,
        aiAdvice: advice || undefined,
        // LINE通知用の構造化データ
        structuredAdvice: structuredAdvice || undefined,
        calculatedMetrics: calculatedMetrics || undefined,
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
      
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/livers/${liverId}`}>
            <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{tr.title}</h1>
            <p className="text-sm text-gray-400">{liver?.name || ""}</p>
          </div>
        </div>
        
        {/* Screenshot Upload Section - TOP */}
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
          <CardContent className="p-0">
            {screenshotPreview ? (
              <div className="relative">
                {/* Screenshot Image */}
                <img 
                  src={screenshotPreview} 
                  alt="Screenshot"
                  className="w-full h-auto"
                />
                
                {/* Remove Button */}
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="absolute top-3 right-3 bg-red-600 rounded-full p-2 hover:bg-red-700 shadow-lg"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Analyzing Overlay */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-3" />
                    <p className="text-white font-medium">{tr.analyzing}</p>
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-48 cursor-pointer hover:bg-gray-800/50 transition-colors">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mb-3">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-white font-medium">{tr.tapToUpload}</span>
                  <span className="text-sm text-gray-400 mt-1">{tr.aiAnalysis}</span>
                </div>
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
        
        {/* AI Advice Section */}
        {(advice || structuredAdvice) && (
          <Card className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-600/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-yellow-400 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                {tr.adviceTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 総評 */}
              {structuredAdvice?.summary && (
                <div className="bg-yellow-900/20 rounded-lg p-3">
                  <p className="text-white text-sm font-medium">{structuredAdvice.summary}</p>
                </div>
              )}
              
              {/* 計算指標 */}
              {calculatedMetrics && Object.keys(calculatedMetrics).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(calculatedMetrics).map(([key, value]) => (
                    <div key={key} className="bg-gray-800/50 rounded p-2">
                      <p className="text-gray-400 text-xs">{key}</p>
                      <p className="text-white text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 良かった点 */}
              {structuredAdvice?.goodPoints && structuredAdvice.goodPoints.length > 0 && (
                <div>
                  <p className="text-green-400 text-xs font-medium mb-2">✓ 良かった点</p>
                  <ul className="space-y-1">
                    {structuredAdvice.goodPoints.map((point, i) => (
                      <li key={i} className="text-white text-sm pl-3 border-l-2 border-green-500">{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 改善ポイント */}
              {structuredAdvice?.improvements && structuredAdvice.improvements.length > 0 && (
                <div>
                  <p className="text-orange-400 text-xs font-medium mb-2">▲ 改善ポイント</p>
                  <ul className="space-y-1">
                    {structuredAdvice.improvements.map((point, i) => (
                      <li key={i} className="text-white text-sm pl-3 border-l-2 border-orange-500">{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 次回のアクションプラン */}
              {structuredAdvice?.nextActions && structuredAdvice.nextActions.length > 0 && (
                <div>
                  <p className="text-blue-400 text-xs font-medium mb-2">▶ 次回のアクション</p>
                  <div className="space-y-2">
                    {structuredAdvice.nextActions.map((action, i) => (
                      <div key={i} className="bg-blue-900/20 rounded-lg p-3">
                        <p className="text-white text-sm font-medium">{action.action}</p>
                        <p className="text-gray-400 text-xs mt-1">理由: {action.reason}</p>
                        <p className="text-blue-300 text-xs mt-1">⏰ {action.timing}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 次回の目標 */}
              {structuredAdvice?.targetForNextTime && (
                <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                  <p className="text-purple-300 text-xs font-medium">🎯 次回の目標</p>
                  <p className="text-white text-sm mt-1">{structuredAdvice.targetForNextTime}</p>
                </div>
              )}
              
              {/* フォールバック: 構造化データがない場合は従来のテキスト表示 */}
              {!structuredAdvice && advice && (
                <p className="text-white text-sm whitespace-pre-wrap">{advice}</p>
              )}
              
              {/* Regenerate Advice Button */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleGenerateAdvice()}
                disabled={isGeneratingAdvice}
                className="mt-3 text-yellow-400 hover:bg-yellow-600/20 text-xs"
              >
                {isGeneratingAdvice ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    {tr.generatingAdvice}
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-3 h-3 mr-1" />
                    {tr.generateAdvice}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Details Form Section - Combined with Analysis Results */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* AI Analysis Results Section - Same design as form below */}
          {screenshotPreview && (
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    {tr.analysisResult}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {analysisConfidence && (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        analysisConfidence === 'high' ? 'bg-green-600' :
                        analysisConfidence === 'medium' ? 'bg-yellow-600' :
                        'bg-red-600'
                      }`}>
                        {tr.confidence}: {analysisConfidence === 'high' ? tr.high : 
                          analysisConfidence === 'medium' ? tr.medium : tr.low}
                      </span>
                    )}
                    <Button
                      type="button"
                      onClick={() => handleAnalyzeScreenshot()}
                      disabled={isAnalyzing}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-purple-400 hover:bg-purple-600/20"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 mr-1" />
                          {tr.analyzeScreenshot}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{tr.editableHint}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sales Amount */}
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    {tr.salesAmount}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">¥</span>
                    <Input
                      type="number"
                      value={salesAmount}
                      onChange={(e) => setSalesAmount(e.target.value)}
                      placeholder="0"
                      className="bg-gray-800 border-gray-700 text-white pl-8"
                    />
                  </div>
                </div>

                {/* Viewer Count & Peak Viewer Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      {tr.viewerCount}
                    </Label>
                    <Input
                      type="number"
                      value={viewerCount}
                      onChange={(e) => setViewerCount(e.target.value)}
                      placeholder="0"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-cyan-500" />
                      {tr.peakViewerCount}
                    </Label>
                    <Input
                      type="number"
                      value={peakViewerCount}
                      onChange={(e) => setPeakViewerCount(e.target.value)}
                      placeholder="0"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    {tr.durationMinutes}
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      placeholder="0"
                      className="bg-gray-800 border-gray-700 text-white pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{tr.minutes}</span>
                  </div>
                </div>

                {/* Product Clicks & Order Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-sm flex items-center gap-2">
                      <MousePointer className="h-4 w-4 text-yellow-500" />
                      {tr.productClicks}
                    </Label>
                    <Input
                      type="number"
                      value={productClicks}
                      onChange={(e) => setProductClicks(e.target.value)}
                      placeholder="0"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-sm flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-pink-500" />
                      {tr.orderCount}
                    </Label>
                    <Input
                      type="number"
                      value={orderCount}
                      onChange={(e) => setOrderCount(e.target.value)}
                      placeholder="0"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-300">{tr.detailsForm}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Schedule Selection (if available) */}
              {schedules && schedules.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">{tr.selectSchedule}</Label>
                  <Select 
                    value={scheduleId?.toString() || "none"} 
                    onValueChange={handleScheduleSelect}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600">
                      <SelectValue placeholder={tr.selectSchedule} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300 text-black">
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
                <Label className="text-gray-400 text-sm">
                  {tr.selectBrand} <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={brandId?.toString() || ""} 
                  onValueChange={(v) => setBrandId(parseInt(v, 10))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue placeholder={tr.selectBrand} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300 text-black max-h-60">
                    {brands?.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id.toString()}>
                        {brand.name} {brand.nameJa && `(${brand.nameJa})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Start DateTime */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">
                    {tr.startDateTime} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">&nbsp;</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
              </div>
              
              {/* End DateTime */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">{tr.endDateTime}</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">&nbsp;</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
              </div>
              
              {/* Result */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">{tr.deliveryResult}</Label>
                <Select 
                  value={result || "none"} 
                  onValueChange={(v) => setResult(v === "none" ? "" : v as "成功" | "失敗")}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue placeholder={tr.notSet} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300 text-black">
                    <SelectItem value="none">{tr.notSet}</SelectItem>
                    <SelectItem value="成功">{tr.success}</SelectItem>
                    <SelectItem value="失敗">{tr.failure}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Impact Factor */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">{tr.impactFactor}</Label>
                <Select 
                  value={impactFactor || "none"} 
                  onValueChange={(v) => setImpactFactor(v === "none" ? "" : v as "構成" | "商品" | "ライバー" | "広告" | "その他")}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue placeholder={tr.notSet} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300 text-black">
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
                <Label className="text-gray-400 text-sm">{tr.reason}</Label>
                <Textarea
                  value={resultReason}
                  onChange={(e) => setResultReason(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                  rows={2}
                />
              </div>
              
              {/* Memo */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">{tr.memo}</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Action Buttons */}
          <div className="flex gap-3 pb-6">
            <Link href={`/livers/${liverId}`} className="flex-1">
              <Button
                type="button"
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                {tr.cancel}
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? tr.saving : tr.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
