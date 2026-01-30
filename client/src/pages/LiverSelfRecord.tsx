import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Video, Calendar, DollarSign, Clock, X, Link as LinkIcon, Camera, Sparkles, Loader2, Lightbulb, Users, MousePointer, ShoppingCart } from "lucide-react";
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
    viewerCount: "",
    peakViewerCount: "",
    productClicks: "",
    orderCount: "",
    durationMinutes: "",
    result: "",
    impactFactor: "",
    resultReason: "",
    remarks: "",
    scheduleId: scheduleIdParam || "",
  });
  
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [analysisConfidence, setAnalysisConfidence] = useState<string | null>(null);
  
  const [analyzedData, setAnalyzedData] = useState<{
    salesAmount?: number | null;
    viewerCount?: number | null;
    peakViewerCount?: number | null;
    productClicks?: number | null;
    orderCount?: number | null;
    durationMinutes?: number | null;
    startDateTime?: string | null;
    endDateTime?: string | null;
    confidence?: string;
    rawData?: {
      impressions?: number | null;
      productImpressions?: number | null;
      liveCtr?: number | null;
      orderRate?: number | null;
      gmvPerHour?: number | null;
      avgViewDuration?: number | null;
      commentRate?: number | null;
      adCost?: number | null;
      roi?: number | null;
      productSales?: number | null;
    };
  } | null>(null);

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
  const analyzeScreenshotMutation = trpc.liverManagement.analyzeScreenshot.useMutation();
  const generateAdviceMutation = trpc.liverManagement.generateAdvice.useMutation();

  // 日本語固定
  const tr = {
    title: "配信内容の記録",
    subtitle: "TikTokダッシュボードのスクリーンショットをアップロードすると、AIが自動で解析します",
    tapToUpload: "タップしてスクリーンショットをアップロード",
    aiAnalysis: "AIが自動でデータを解析します",
    analyzing: "解析中...",
    analysisComplete: "解析完了！データを自動入力しました",
    analysisError: "解析に失敗しました",
    analysisResult: "AI解析結果",
    confidence: "解析信頼度",
    high: "高",
    medium: "中",
    low: "低",
    salesAmount: "売上金額",
    viewerCount: "視聴者数",
    peakViewerCount: "ピーク視聴者数",
    productClicks: "商品クリック数",
    orderCount: "注文数",
    durationMinutes: "配信時間",
    minutes: "分",
    reanalyze: "再解析",
    adviceTitle: "ワンポイントアドバイス",
    regenerateAdvice: "アドバイスを再生成",
    generatingAdvice: "生成中...",
    detailsForm: "詳細情報",
    selectBrand: "ブランドを選択",
    livestreamDate: "配信日",
    startTime: "開始時刻",
    endTime: "終了時刻",
    result: "結果",
    selectResult: "結果を選択",
    success: "成功",
    failure: "失敗",
    impactFactor: "影響要因",
    selectFactor: "影響要因を選択",
    composition: "構成",
    product: "商品",
    liver: "ライバー",
    ad: "広告",
    other: "その他",
    reasonMemo: "理由・メモ",
    reasonPlaceholder: "結果の理由や気づきを記入...",
    otherMemo: "その他のメモ",
    memoPlaceholder: "その他のメモ...",
    save: "配信記録を保存",
    saving: "保存中...",
    loginRequired: "ログインが必要です",
    goToLogin: "ログインページへ",
    selectBrandError: "ブランドを選択してください",
    enterDateTimeError: "配信日時を入力してください",
    saveError: "保存に失敗しました",
    scheduleLink: "スケジュールから記録",
    editableHint: "解析データは編集可能です",
  };

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
    setAdvice(null);
    setAnalysisConfidence(null);
    // Clear analyzed fields
    setFormData(prev => ({
      ...prev,
      salesAmount: "",
      viewerCount: "",
      peakViewerCount: "",
      productClicks: "",
      orderCount: "",
      durationMinutes: "",
    }));
  };

  const handleAnalyzeScreenshot = async (file?: File) => {
    const fileToAnalyze = file || screenshotFile;
    if (!fileToAnalyze || !liverInfo?.id) return;
    
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
        liverId: liverInfo.id,
      });
      setScreenshotUrl(uploadResult.url);
      
      // Then analyze the screenshot
      const analysisResult = await analyzeScreenshotMutation.mutateAsync({
        imageUrl: uploadResult.url,
      });
      
      setAnalyzedData(analysisResult);
      setAnalysisConfidence(analysisResult.confidence || null);
      
      // Debug: Log the analysis result
      console.log("AI Analysis Result:", JSON.stringify(analysisResult, null, 2));
      console.log("startDateTime:", analysisResult.startDateTime);
      console.log("endDateTime:", analysisResult.endDateTime);
      
      // Auto-fill form with analyzed data
      const updates: Partial<typeof formData> = {};
      
      // 売上金額
      if (analysisResult.salesAmount !== null && analysisResult.salesAmount !== undefined) {
        updates.salesAmount = analysisResult.salesAmount.toString();
      }
      
      // 視聴者数
      if (analysisResult.viewerCount !== null && analysisResult.viewerCount !== undefined) {
        updates.viewerCount = analysisResult.viewerCount.toString();
      }
      
      // ピーク視聴者数
      if (analysisResult.peakViewerCount !== null && analysisResult.peakViewerCount !== undefined) {
        updates.peakViewerCount = analysisResult.peakViewerCount.toString();
      }
      
      // 商品クリック数
      if (analysisResult.productClicks !== null && analysisResult.productClicks !== undefined) {
        updates.productClicks = analysisResult.productClicks.toString();
      }
      
      // 注文数
      if (analysisResult.orderCount !== null && analysisResult.orderCount !== undefined) {
        updates.orderCount = analysisResult.orderCount.toString();
      }
      
      // 配信時間
      if (analysisResult.durationMinutes !== null && analysisResult.durationMinutes !== undefined) {
        updates.durationMinutes = analysisResult.durationMinutes.toString();
      }
      
      // 配信日時（startDateTime: "YYYY-MM-DD HH:mm"形式）
      if (analysisResult.startDateTime) {
        const [datePart, timePart] = analysisResult.startDateTime.split(' ');
        if (datePart) {
          updates.livestreamDate = datePart;
        }
        if (timePart) {
          updates.livestreamStartTime = timePart;
        }
      }
      
      // 終了時刻（endDateTime: "YYYY-MM-DD HH:mm"形式）
      if (analysisResult.endDateTime) {
        const [, timePart] = analysisResult.endDateTime.split(' ');
        if (timePart) {
          updates.livestreamEndTime = timePart;
        }
      }
      
      // フォームを更新
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({
          ...prev,
          ...updates,
        }));
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
        result: formData.result || undefined,
        impactFactor: formData.impactFactor || undefined,
      });
      
      setAdvice(adviceResult.advice);
    } catch (error) {
      console.error("Failed to generate advice:", error);
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!liverInfo?.id) {
      toast.error(tr.loginRequired);
      return;
    }

    if (!formData.brandId) {
      toast.error(tr.selectBrandError);
      return;
    }

    if (!formData.livestreamDate || !formData.livestreamStartTime) {
      toast.error(tr.enterDateTimeError);
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
          liverId: liverInfo.id,
        });
        finalScreenshotUrl = uploadResult.url;
      }

      const livestreamDateTime = new Date(`${formData.livestreamDate}T${formData.livestreamStartTime}`);
      const endDateTime = formData.livestreamEndTime 
        ? new Date(`${formData.livestreamDate}T${formData.livestreamEndTime}`)
        : undefined;

      // impactFactorが空の場合はundefinedを送信
      const impactFactorValue = formData.impactFactor && 
        ["構成", "商品", "ライバー", "広告", "その他"].includes(formData.impactFactor)
        ? formData.impactFactor as "構成" | "商品" | "ライバー" | "広告" | "その他"
        : undefined;

      // resultが空の場合はundefinedを送信
      const resultValue = formData.result && ["成功", "失敗"].includes(formData.result)
        ? formData.result as "成功" | "失敗"
        : undefined;

      // AI解析データを取得（フォーム入力またはanalyzedDataから）
      const viewerCount = formData.viewerCount 
        ? parseInt(formData.viewerCount) 
        : (analyzedData?.viewerCount ?? undefined);
      const duration = formData.durationMinutes 
        ? parseInt(formData.durationMinutes) 
        : (analyzedData?.durationMinutes ?? undefined);
      const productClicks = formData.productClicks 
        ? parseInt(formData.productClicks) 
        : (analyzedData?.productClicks ?? undefined);
      const orderCount = formData.orderCount 
        ? parseInt(formData.orderCount) 
        : (analyzedData?.orderCount ?? undefined);
      
      // CVRを計算（注文数 / クリック数 * 100）
      let cvr: string | undefined;
      if (productClicks && orderCount && productClicks > 0) {
        cvr = ((orderCount / productClicks) * 100).toFixed(2) + '%';
      }

      createLivestreamMutation.mutate({
        brandId: parseInt(formData.brandId),
        liverId: liverInfo.id,
        livestreamDate: livestreamDateTime.toISOString(),
        livestreamEndTime: endDateTime?.toISOString(),
        salesAmount: formData.salesAmount ? parseInt(formData.salesAmount) : undefined,
        // AI解析データを送信
        viewerCount,
        duration,
        productClicks,
        orderCount,
        impressions: analyzedData?.rawData?.impressions ?? undefined,
        gmv: formData.salesAmount ? parseInt(formData.salesAmount) : undefined,
        cvr,
        // 配信結果フィールド
        result: resultValue,
        impactFactor: impactFactorValue,
        resultReason: formData.resultReason || undefined,
        remarks: formData.remarks || undefined,
        screenshotUrl: finalScreenshotUrl || undefined,
        scheduleId: formData.scheduleId ? parseInt(formData.scheduleId) : undefined,
        aiAdvice: advice || undefined,
      });
    } catch (error) {
      console.error("Failed to save livestream:", error);
      toast.error(tr.saveError);
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
        <p className="text-white text-center">{tr.loginRequired}</p>
        <Button
          onClick={() => navigate("/liver/login")}
          className="bg-red-600 hover:bg-red-700"
        >
          {tr.goToLogin}
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
          <div>
            <h1 className="text-xl font-bold text-yellow-500">{tr.title}</h1>
            <p className="text-xs text-gray-400">{tr.subtitle}</p>
          </div>
        </div>
      </header>

      {/* Red line separator */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

      <div className="container max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Schedule Link Info */}
        {scheduleInfo && (
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <LinkIcon className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-yellow-500 font-medium">{tr.scheduleLink}</p>
                  <p className="text-white">{scheduleInfo.title}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(scheduleInfo.startTime).toLocaleString("ja-JP")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Screenshot Upload Section */}
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
            <CardContent className="p-0">
              {screenshotPreview ? (
                <div className="relative">
                  <img 
                    src={screenshotPreview} 
                    alt="Screenshot"
                    className="w-full h-auto"
                  />
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    className="absolute top-3 right-3 bg-red-600 rounded-full p-2 hover:bg-red-700 shadow-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
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
                      {tr.regenerateAdvice}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Results Section */}
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
                          {tr.reanalyze}
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
                      value={formData.salesAmount}
                      onChange={(e) => setFormData({ ...formData, salesAmount: e.target.value })}
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
                      value={formData.viewerCount}
                      onChange={(e) => setFormData({ ...formData, viewerCount: e.target.value })}
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
                      value={formData.peakViewerCount}
                      onChange={(e) => setFormData({ ...formData, peakViewerCount: e.target.value })}
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
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
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
                      value={formData.productClicks}
                      onChange={(e) => setFormData({ ...formData, productClicks: e.target.value })}
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
                      value={formData.orderCount}
                      onChange={(e) => setFormData({ ...formData, orderCount: e.target.value })}
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
              {/* Brand Selection */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm flex items-center gap-2">
                  <Video className="h-4 w-4 text-red-500" />
                  {tr.selectBrand} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.brandId}
                  onValueChange={(value) => setFormData({ ...formData, brandId: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder={tr.selectBrand} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300 text-black max-h-60">
                    {brands?.map((brand: { id: number; name: string }) => (
                      <SelectItem key={brand.id} value={brand.id.toString()}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date & Time */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-red-500" />
                  {tr.livestreamDate} <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.livestreamDate}
                  onChange={(e) => setFormData({ ...formData, livestreamDate: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">{tr.startTime}</Label>
                  <Input
                    type="time"
                    value={formData.livestreamStartTime}
                    onChange={(e) => setFormData({ ...formData, livestreamStartTime: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">{tr.endTime}</Label>
                  <Input
                    type="time"
                    value={formData.livestreamEndTime}
                    onChange={(e) => setFormData({ ...formData, livestreamEndTime: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>

              {/* Result */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-500" />
                  {tr.result}
                </Label>
                <Select
                  value={formData.result || "none"}
                  onValueChange={(value) => setFormData({ ...formData, result: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder={tr.selectResult} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300 text-black">
                    <SelectItem value="none">{tr.selectResult}</SelectItem>
                    <SelectItem value="成功">{tr.success}</SelectItem>
                    <SelectItem value="失敗">{tr.failure}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Impact Factor */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">{tr.impactFactor}</Label>
                <Select
                  value={formData.impactFactor || "none"}
                  onValueChange={(value) => setFormData({ ...formData, impactFactor: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder={tr.selectFactor} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300 text-black">
                    <SelectItem value="none">{tr.selectFactor}</SelectItem>
                    <SelectItem value="構成">{tr.composition}</SelectItem>
                    <SelectItem value="商品">{tr.product}</SelectItem>
                    <SelectItem value="ライバー">{tr.liver}</SelectItem>
                    <SelectItem value="広告">{tr.ad}</SelectItem>
                    <SelectItem value="その他">{tr.other}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason Memo */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">{tr.reasonMemo}</Label>
                <Textarea
                  value={formData.resultReason}
                  onChange={(e) => setFormData({ ...formData, resultReason: e.target.value })}
                  placeholder={tr.reasonPlaceholder}
                  className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
                />
              </div>

              {/* Other Memo */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">{tr.otherMemo}</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder={tr.memoPlaceholder}
                  className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-bold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {tr.saving}
              </>
            ) : (
              tr.save
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
