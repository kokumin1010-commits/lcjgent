import { useState, useMemo, useEffect } from "react";
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
import { ArrowLeft, Upload, X, Sparkles, Loader2, Lightbulb, Camera, DollarSign, Users, Clock, ShoppingCart, MousePointer, Edit2, Check } from "lucide-react";
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
  
  // Editable analyzed data state
  const [isEditingAnalysis, setIsEditingAnalysis] = useState(false);
  const [editedAnalyzedData, setEditedAnalyzedData] = useState<{
    salesAmount: string;
    viewerCount: string;
    peakViewerCount: string;
    productClicks: string;
    orderCount: string;
    durationMinutes: string;
    confidence?: string;
  } | null>(null);
  
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
  
  // Initialize edited data when analyzedData changes
  useEffect(() => {
    if (analyzedData) {
      setEditedAnalyzedData({
        salesAmount: analyzedData.salesAmount?.toString() || "",
        viewerCount: analyzedData.viewerCount?.toString() || "",
        peakViewerCount: analyzedData.peakViewerCount?.toString() || "",
        productClicks: analyzedData.productClicks?.toString() || "",
        orderCount: analyzedData.orderCount?.toString() || "",
        durationMinutes: analyzedData.durationMinutes?.toString() || "",
        confidence: analyzedData.confidence,
      });
    }
  }, [analyzedData]);
  
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
      analyzeScreenshot: "AI解析を実行",
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
      analysisResult: "解析結果",
      detailsForm: "詳細情報",
      minutes: "分",
      editAnalysis: "編集",
      saveEdit: "確定",
      editHint: "解析結果を修正できます",
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
      analyzeScreenshot: "执行AI分析",
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
      analysisResult: "分析结果",
      detailsForm: "详细信息",
      minutes: "分钟",
      editAnalysis: "编辑",
      saveEdit: "确定",
      editHint: "可以修改分析结果",
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
    setAnalyzedData(null);
    setEditedAnalyzedData(null);
    setAdvice(null);
    setIsEditingAnalysis(false);
  };
  
  const handleAnalyzeScreenshot = async (file?: File) => {
    const fileToAnalyze = file || screenshotFile;
    if (!fileToAnalyze) return;
    
    setIsAnalyzing(true);
    setIsEditingAnalysis(false);
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
  
  // Handle saving edited analysis data
  const handleSaveEditedAnalysis = () => {
    if (!editedAnalyzedData) return;
    
    // Update analyzedData with edited values
    const updatedData = {
      salesAmount: editedAnalyzedData.salesAmount ? parseInt(editedAnalyzedData.salesAmount, 10) : null,
      viewerCount: editedAnalyzedData.viewerCount ? parseInt(editedAnalyzedData.viewerCount, 10) : null,
      peakViewerCount: editedAnalyzedData.peakViewerCount ? parseInt(editedAnalyzedData.peakViewerCount, 10) : null,
      productClicks: editedAnalyzedData.productClicks ? parseInt(editedAnalyzedData.productClicks, 10) : null,
      orderCount: editedAnalyzedData.orderCount ? parseInt(editedAnalyzedData.orderCount, 10) : null,
      durationMinutes: editedAnalyzedData.durationMinutes ? parseInt(editedAnalyzedData.durationMinutes, 10) : null,
      confidence: editedAnalyzedData.confidence,
    };
    
    setAnalyzedData(updatedData);
    
    // Update form fields
    if (updatedData.salesAmount !== null) {
      setSalesAmount(updatedData.salesAmount.toString());
    }
    
    // Update end time based on duration if we have start time
    if (updatedData.durationMinutes !== null && startDate && startTime) {
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(start.getTime() + updatedData.durationMinutes * 60 * 1000);
      setEndDate(end.toISOString().slice(0, 10));
      setEndTime(end.toTimeString().slice(0, 5));
    }
    
    setIsEditingAnalysis(false);
    toast.success(language === "ja" ? "解析結果を更新しました" : "分析结果已更新");
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
        
        {/* Analysis Results Section - Below Screenshot */}
        {analyzedData && (
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2 text-purple-400">
                  <Sparkles className="w-4 h-4" />
                  {tr.analysisResult}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    analyzedData.confidence === 'high' ? 'bg-green-600' :
                    analyzedData.confidence === 'medium' ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}>
                    {tr.confidence}: {analyzedData.confidence === 'high' ? tr.high : 
                      analyzedData.confidence === 'medium' ? tr.medium : tr.low}
                  </span>
                  {/* Edit/Save Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (isEditingAnalysis) {
                        handleSaveEditedAnalysis();
                      } else {
                        setIsEditingAnalysis(true);
                      }
                    }}
                    className={`h-7 px-2 ${isEditingAnalysis ? 'text-green-400 hover:bg-green-600/20' : 'text-gray-400 hover:bg-gray-700'}`}
                  >
                    {isEditingAnalysis ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        {tr.saveEdit}
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-3 h-3 mr-1" />
                        {tr.editAnalysis}
                      </>
                    )}
                  </Button>
                </div>
              </CardTitle>
              {isEditingAnalysis && (
                <p className="text-xs text-gray-400 mt-1">{tr.editHint}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Sales Amount */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <DollarSign className="w-3 h-3" />
                    {tr.salesAmount}
                  </div>
                  {isEditingAnalysis ? (
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-400 text-sm">¥</span>
                      <Input
                        type="number"
                        value={editedAnalyzedData?.salesAmount || ""}
                        onChange={(e) => setEditedAnalyzedData(prev => prev ? {...prev, salesAmount: e.target.value} : null)}
                        className="bg-gray-700 border-gray-600 text-green-400 font-bold pl-6 h-8"
                        placeholder="0"
                      />
                    </div>
                  ) : (
                    <div className="text-xl font-bold text-green-400">
                      {analyzedData.salesAmount !== null && analyzedData.salesAmount !== undefined 
                        ? `¥${analyzedData.salesAmount.toLocaleString()}`
                        : "-"}
                    </div>
                  )}
                </div>
                
                {/* Viewer Count */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Users className="w-3 h-3" />
                    {tr.viewerCount}
                  </div>
                  {isEditingAnalysis ? (
                    <Input
                      type="number"
                      value={editedAnalyzedData?.viewerCount || ""}
                      onChange={(e) => setEditedAnalyzedData(prev => prev ? {...prev, viewerCount: e.target.value} : null)}
                      className="bg-gray-700 border-gray-600 text-blue-400 font-bold h-8"
                      placeholder="0"
                    />
                  ) : (
                    <div className="text-xl font-bold text-blue-400">
                      {analyzedData.viewerCount !== null && analyzedData.viewerCount !== undefined 
                        ? analyzedData.viewerCount.toLocaleString()
                        : "-"}
                    </div>
                  )}
                </div>
                
                {/* Peak Viewer Count */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Users className="w-3 h-3" />
                    {tr.peakViewerCount}
                  </div>
                  {isEditingAnalysis ? (
                    <Input
                      type="number"
                      value={editedAnalyzedData?.peakViewerCount || ""}
                      onChange={(e) => setEditedAnalyzedData(prev => prev ? {...prev, peakViewerCount: e.target.value} : null)}
                      className="bg-gray-700 border-gray-600 text-cyan-400 font-bold h-8"
                      placeholder="0"
                    />
                  ) : (
                    <div className="text-xl font-bold text-cyan-400">
                      {analyzedData.peakViewerCount !== null && analyzedData.peakViewerCount !== undefined 
                        ? analyzedData.peakViewerCount.toLocaleString()
                        : "-"}
                    </div>
                  )}
                </div>
                
                {/* Duration */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    {tr.durationMinutes}
                  </div>
                  {isEditingAnalysis ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editedAnalyzedData?.durationMinutes || ""}
                        onChange={(e) => setEditedAnalyzedData(prev => prev ? {...prev, durationMinutes: e.target.value} : null)}
                        className="bg-gray-700 border-gray-600 text-orange-400 font-bold h-8"
                        placeholder="0"
                      />
                      <span className="text-orange-400 text-sm">{tr.minutes}</span>
                    </div>
                  ) : (
                    <div className="text-xl font-bold text-orange-400">
                      {analyzedData.durationMinutes !== null && analyzedData.durationMinutes !== undefined 
                        ? `${analyzedData.durationMinutes}${tr.minutes}`
                        : "-"}
                    </div>
                  )}
                </div>
                
                {/* Product Clicks */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <MousePointer className="w-3 h-3" />
                    {tr.productClicks}
                  </div>
                  {isEditingAnalysis ? (
                    <Input
                      type="number"
                      value={editedAnalyzedData?.productClicks || ""}
                      onChange={(e) => setEditedAnalyzedData(prev => prev ? {...prev, productClicks: e.target.value} : null)}
                      className="bg-gray-700 border-gray-600 text-yellow-400 font-bold h-8"
                      placeholder="0"
                    />
                  ) : (
                    <div className="text-xl font-bold text-yellow-400">
                      {analyzedData.productClicks !== null && analyzedData.productClicks !== undefined 
                        ? analyzedData.productClicks.toLocaleString()
                        : "-"}
                    </div>
                  )}
                </div>
                
                {/* Order Count */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <ShoppingCart className="w-3 h-3" />
                    {tr.orderCount}
                  </div>
                  {isEditingAnalysis ? (
                    <Input
                      type="number"
                      value={editedAnalyzedData?.orderCount || ""}
                      onChange={(e) => setEditedAnalyzedData(prev => prev ? {...prev, orderCount: e.target.value} : null)}
                      className="bg-gray-700 border-gray-600 text-pink-400 font-bold h-8"
                      placeholder="0"
                    />
                  ) : (
                    <div className="text-xl font-bold text-pink-400">
                      {analyzedData.orderCount !== null && analyzedData.orderCount !== undefined 
                        ? analyzedData.orderCount.toLocaleString()
                        : "-"}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Re-analyze Button */}
              {!isEditingAnalysis && (
                <Button
                  type="button"
                  onClick={() => handleAnalyzeScreenshot()}
                  disabled={isAnalyzing}
                  variant="outline"
                  className="w-full border-purple-600 text-purple-400 hover:bg-purple-600/20"
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
              )}
            </CardContent>
          </Card>
        )}
        
        {/* AI Advice Section */}
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
        
        {/* Details Form Section */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              
              {/* Sales Amount */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">{tr.salesAmount}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">¥</span>
                  <Input
                    type="number"
                    value={salesAmount}
                    onChange={(e) => setSalesAmount(e.target.value)}
                    className="bg-gray-800 border-gray-600 pl-8"
                    placeholder="0"
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
