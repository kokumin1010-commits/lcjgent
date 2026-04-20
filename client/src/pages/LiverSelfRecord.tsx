import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Video, Calendar, DollarSign, Clock, X, Link as LinkIcon, Camera, Sparkles, Loader2, Lightbulb, Users, MousePointer, ShoppingCart, CheckCircle, Eye, Package, Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { liverTranslations, type LiverLanguage } from "@/lib/liverI18n";

// 時刻文字列を正規化するヘルパー（"1:22" → "01:22", "21:10" → "21:10"）
const normalizeTime = (time: string): string => {
  if (!time) return time;
  const parts = time.split(':');
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${h}:${m}`;
  }
  return time;
};

// 安全にDateオブジェクトを生成するヘルパー
// 【重要】明示的にJST(+09:00)として解釈する。
// ブラウザのタイムゾーンに依存すると、UTC設定の端末で時間がずれるバグが発生する。
const safeCreateDate = (date: string, time: string): Date | null => {
  if (!date || !time) return null;
  const normalizedTime = normalizeTime(time);
  // +09:00を付けてJSTとして明示的に解釈（ブラウザTZに依存しない）
  const dateStr = `${date}T${normalizedTime}:00+09:00`;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

export default function LiverSelfRecord() {
  const { language } = useLanguage();
  const t = (key: string) => liverTranslations[key]?.[language as LiverLanguage] || liverTranslations[key]?.ja || key;
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const scheduleIdParam = searchParams.get("scheduleId");
  const dateParam = searchParams.get("date");
  
  // Get current liver info with caching to prevent unnecessary refetches
  const { data: liverInfo, isLoading: isLoadingLiver, isError: isLiverError, isFetching: isLiverFetching } = trpc.liver.me.useQuery(undefined, {
    staleTime: 30 * 60 * 1000, // 30 minutes - longer cache to prevent refetch during analysis
    gcTime: 60 * 60 * 1000, // 1 hour - keep in cache longer
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch when component mounts if data exists
    refetchOnReconnect: false, // Don't refetch on reconnect
    retry: 1,
  });
  
  // Track if we've successfully loaded liver info at least once
  const [hasLoadedLiver, setHasLoadedLiver] = useState(false);
  
  useEffect(() => {
    if (liverInfo && !hasLoadedLiver) {
      setHasLoadedLiver(true);
    }
  }, [liverInfo, hasLoadedLiver]);
  
  // Get brands for selection
  const brandsQuery = trpc.brand.list.useQuery();
  const brands = brandsQuery.data;

  // Get schedule info if scheduleId is provided
  const { data: scheduleInfo } = trpc.schedule.getById.useQuery(
    { id: parseInt(scheduleIdParam || "0") },
    { enabled: !!scheduleIdParam }
  );

  const [brandSearchOpen, setBrandSearchOpen] = useState(false);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [brandDurations, setBrandDurations] = useState<Record<string, string>>({});
  const [newBrandName, setNewBrandName] = useState("");
  const [showAddBrand, setShowAddBrand] = useState(false);
  const addBrandMutation = trpc.liverManagement.addBrand.useMutation({
    onSuccess: (data) => {
      toast.success(t("record.addBrandSuccess"));
      setSelectedBrandIds(prev => [...prev, data.id.toString()]);
      setNewBrandName("");
      setShowAddBrand(false);
      // Refetch brands list
      brandsQuery.refetch();
    },
    onError: () => {
      toast.error(t("record.addBrandError"));
    },
  });
  const [formData, setFormData] = useState({
    brandId: "",
    livestreamDate: dateParam || "",
    livestreamStartTime: "",
    livestreamEndTime: "",
    livestreamEndDate: "",
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
  
  // 配信後スクリーンショット（メイン）
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  
  // 配信前スクリーンショット（任意）
  const [beforeScreenshotFile, setBeforeScreenshotFile] = useState<File | null>(null);
  const [beforeScreenshotPreview, setBeforeScreenshotPreview] = useState<string | null>(null);
  const [beforeScreenshotUrl, setBeforeScreenshotUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [analysisConfidence, setAnalysisConfidence] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // セット組みデータ
  type SetItem = { productName: string; originalPrice: string };
  type SetData = { setName: string; setPrice: string; quantitySold: string; items: SetItem[] };
  const [sets, setSets] = useState<SetData[]>([]);
  
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
      if (scheduleInfo.brandId) {
        setSelectedBrandIds(prev => {
          const id = scheduleInfo.brandId!.toString();
          return prev.includes(id) ? prev : [...prev, id];
        });
      }
    }
  }, [scheduleInfo]);

  const createLivestreamMutation = trpc.liverManagement.createLivestream.useMutation({
    onSuccess: () => {
      toast.success(tr.save);
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

  // 多言語対応
  const tr = {
    title: t("record.title"),
    subtitle: t("record.subtitle"),
    tapToUpload: t("record.tapToUpload"),
    aiAnalysis: t("record.aiAnalysis"),
    analyzing: t("record.analyzing"),
    analysisComplete: t("record.analysisComplete"),
    analysisError: t("record.analysisError"),
    analysisResult: t("record.analysisResult"),
    confidence: t("record.confidence"),
    high: t("record.high"),
    medium: t("record.medium"),
    low: t("record.low"),
    salesAmount: t("record.salesAmount"),
    viewerCount: t("record.viewerCount"),
    peakViewerCount: t("record.peakViewerCount"),
    productClicks: t("record.productClicks"),
    orderCount: t("record.orderCount"),
    durationMinutes: t("record.durationMinutes"),
    minutes: t("record.minutes"),
    reanalyze: t("record.reanalyze"),
    adviceTitle: t("record.adviceTitle"),
    regenerateAdvice: t("record.regenerateAdvice"),
    generatingAdvice: t("record.generatingAdvice"),
    detailsForm: t("record.detailsForm"),
    selectBrand: t("record.selectBrand"),
    livestreamDate: t("record.livestreamDate"),
    startTime: t("record.startTime"),
    endTime: t("record.endTime"),
    endDate: t("record.endDate"),
    endDateHint: t("record.endDateHint"),
    endDateWarning: t("record.endDateWarning"),
    result: t("record.result"),
    selectResult: t("record.selectResult"),
    success: t("record.success"),
    failure: t("record.failure"),
    impactFactor: t("record.impactFactor"),
    selectFactor: t("record.selectFactor"),
    composition: t("record.composition"),
    product: t("record.product"),
    liver: t("record.liver"),
    ad: t("record.ad"),
    other: t("record.other"),
    reasonMemo: t("record.reasonMemo"),
    reasonPlaceholder: t("record.reasonPlaceholder"),
    otherMemo: t("record.otherMemo"),
    memoPlaceholder: t("record.memoPlaceholder"),
    save: t("record.save"),
    saving: t("record.saving"),
    loginRequired: t("login.required"),
    goToLogin: t("login.goToLogin"),
    selectBrandError: t("record.selectBrandError"),
    enterDateTimeError: t("record.enterDateTimeError"),
    saveError: t("record.saveError"),
    scheduleLink: t("record.scheduleLink"),
    editableHint: t("record.editableHint"),
    confirmTitle: t("record.confirmTitle"),
    confirmDescription: t("record.confirmDescription"),
    confirmSave: t("record.confirmSave"),
    confirmCancel: t("record.confirmCancel"),
    previewButton: t("record.previewButton"),
    notSet: t("record.notSet"),
    beforeScreenshot: t("record.beforeScreenshot"),
    afterScreenshot: t("record.afterScreenshot"),
    beforeScreenshotHint: t("record.beforeScreenshotHint"),
    afterScreenshotHint: t("record.afterScreenshotHint"),
    tapToUploadBefore: t("record.tapToUploadBefore"),
    optional: t("record.optional"),
    addBrand: t("record.addBrand"),
    addBrandPlaceholder: t("record.addBrandPlaceholder"),
    selectedBrands: t("record.selectedBrands"),
    selectBrandHint: t("record.selectBrandHint"),
    brandDuration: t("record.brandDuration"),
    brandDurationHint: t("record.brandDurationHint"),
    selectBrandFirst: t("record.selectBrandFirst"),
    brandRequired: t("record.brandRequired"),
    minLabel: t("record.minLabel"),
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

  // 配信前スクショのハンドラ
  const handleBeforeScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBeforeScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBeforeScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBeforeScreenshot = () => {
    setBeforeScreenshotFile(null);
    setBeforeScreenshotPreview(null);
    setBeforeScreenshotUrl(null);
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
      
      // Determine MIME type from file
      const mimeType = fileToAnalyze.type || "image/png";
      
      // Analyze the screenshot using Base64 data directly (bypasses CloudFront URL access issues)
      const analysisResult = await analyzeScreenshotMutation.mutateAsync({
        imageBase64: base64,
        mimeType: mimeType,
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
        const [endDatePart, timePart] = analysisResult.endDateTime.split(' ');
        if (timePart) {
          updates.livestreamEndTime = timePart;
        }
        // 終了日が開始日と異なる場合は終了日を設定
        if (endDatePart && analysisResult.startDateTime) {
          const [startDatePart] = analysisResult.startDateTime.split(' ');
          if (endDatePart !== startDatePart) {
            updates.livestreamEndDate = endDatePart;
          }
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

    if (selectedBrandIds.length === 0) {
      toast.error(tr.selectBrandError);
      return;
    }

    // ブランド配信時間のバリデーション
    const missingDurations = selectedBrandIds.filter(id => {
      const dur = brandDurations[id];
      return !dur || parseInt(dur) <= 0;
    });
    if (missingDurations.length > 0) {
      const missingNames = missingDurations.map(id => brands?.find((b: { id: number; name: string }) => b.id.toString() === id)?.name || id).join(', ');
      toast.error(`${missingNames} ${tr.brandDuration}を入力してください`);
      return;
    }

    if (!formData.livestreamDate || !formData.livestreamStartTime) {
      toast.error(tr.enterDateTimeError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload after screenshot if exists and not already uploaded
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

      // Upload before screenshot if exists and not already uploaded
      let finalBeforeScreenshotUrl = beforeScreenshotUrl;
      if (beforeScreenshotFile && !beforeScreenshotUrl) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.readAsDataURL(beforeScreenshotFile);
        });
        const base64 = await base64Promise;

        const uploadResult = await uploadScreenshotMutation.mutateAsync({
          base64,
          filename: `before_${beforeScreenshotFile.name}`,
          liverId: liverInfo.id,
        });
        finalBeforeScreenshotUrl = uploadResult.url;
      }

      const livestreamDateTime = safeCreateDate(formData.livestreamDate, formData.livestreamStartTime);
      if (!livestreamDateTime) {
        toast.error(t("record.invalidDateTime"));
        return;
      }
      // 終了日が設定されている場合はそれを使用、そうでなければ配信日を使用
      const endDateToUse = formData.livestreamEndDate || formData.livestreamDate;
      const endDateTime = formData.livestreamEndTime 
        ? safeCreateDate(endDateToUse, formData.livestreamEndTime)
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

      // brandDurationsを数値に変換
      const brandDurationsNumeric: Record<string, number> = {};
      for (const [bid, dur] of Object.entries(brandDurations)) {
        const val = parseInt(dur);
        if (val > 0) brandDurationsNumeric[bid] = val;
      }

      createLivestreamMutation.mutate({
        brandId: parseInt(selectedBrandIds[0]),
        brandIds: selectedBrandIds.map(id => parseInt(id)),
        brandDurations: Object.keys(brandDurationsNumeric).length > 0 ? brandDurationsNumeric : undefined,
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
        beforeScreenshotUrl: finalBeforeScreenshotUrl || undefined,
        scheduleId: formData.scheduleId ? parseInt(formData.scheduleId) : undefined,
        aiAdvice: advice || undefined,
        // セット組みデータ（空のセット名・商品名をフィルタリング）
        sets: sets.length > 0 ? (() => {
          const validSets = sets
            .filter(s => s.setName.trim().length > 0)
            .map(s => ({
              setName: s.setName.trim(),
              setPrice: parseInt(s.setPrice) || 0,
              quantitySold: parseInt(s.quantitySold) || 1,
              items: s.items
                .filter(item => item.productName.trim().length > 0)
                .map(item => ({
                  productName: item.productName.trim(),
                  originalPrice: parseInt(item.originalPrice) || 0,
                })),
            }))
            .filter(s => s.items.length > 0);
          return validSets.length > 0 ? validSets : undefined;
        })() : undefined,
      });
    } catch (error) {
      console.error("Failed to save livestream:", error);
      toast.error(tr.saveError);
      setIsSubmitting(false);
    }
  };

  // Only show loading on initial load, not during refetches
  if (isLoadingLiver && !hasLoadedLiver) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only show login prompt if we've never loaded liver info and current data is null
  // This prevents redirecting during background refetches
  if (!liverInfo && !hasLoadedLiver && !isLoadingLiver && !isLiverFetching) {
    // If there was an error OR liverInfo is null (not authenticated), show login prompt
    // Note: liverInfo being null means the server returned null, which indicates no valid session
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
            className="text-white hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-yellow-500">{tr.title}</h1>
            <p className="text-xs text-white">{tr.subtitle}</p>
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
                  <p className="text-sm text-white">
                    {new Date(scheduleInfo.startTime).toLocaleString("ja-JP")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Screenshot Upload Section - 2 Column Layout */}
          <div className="grid grid-cols-2 gap-3">
            {/* Before Screenshot (配信前) */}
            <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs text-orange-400 flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  {tr.beforeScreenshot}
                  <span className="text-white text-[10px] ml-1">({tr.optional})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {beforeScreenshotPreview ? (
                  <div className="relative">
                    <img 
                      src={beforeScreenshotPreview} 
                      alt="Before Screenshot"
                      className="w-full h-auto"
                    />
                    <button
                      type="button"
                      onClick={removeBeforeScreenshot}
                      className="absolute top-2 right-2 bg-red-600 rounded-full p-1.5 hover:bg-red-700 shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 cursor-pointer hover:bg-gray-800/50 transition-colors">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-600 to-yellow-600 flex items-center justify-center mb-2">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-xs font-medium text-center px-2">{tr.tapToUploadBefore}</span>
                      <span className="text-[10px] text-white mt-1">{tr.beforeScreenshotHint}</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBeforeScreenshotChange}
                      className="hidden"
                    />
                  </label>
                )}
              </CardContent>
            </Card>

            {/* After Screenshot (配信後) - Main */}
            <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden border-2 border-purple-600/50">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs text-purple-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {tr.afterScreenshot}
                  <span className="text-purple-300 text-[10px] ml-1">(AI)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {screenshotPreview ? (
                  <div className="relative">
                    <img 
                      src={screenshotPreview} 
                      alt="After Screenshot"
                      className="w-full h-auto"
                    />
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      className="absolute top-2 right-2 bg-red-600 rounded-full p-1.5 hover:bg-red-700 shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-2" />
                        <p className="text-white text-xs font-medium">{tr.analyzing}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 cursor-pointer hover:bg-gray-800/50 transition-colors">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mb-2">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-xs font-medium text-center px-2">{tr.tapToUpload}</span>
                      <span className="text-[10px] text-white mt-1">{tr.afterScreenshotHint}</span>
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
          </div>

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
                  <CardTitle className="text-sm text-white flex items-center gap-2">
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
                <p className="text-xs text-white mt-1">{tr.editableHint}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sales Amount */}
                <div className="space-y-2">
                  <Label className="text-white text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    {tr.salesAmount}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">¥</span>
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
                    <Label className="text-white text-sm flex items-center gap-2">
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
                    <Label className="text-white text-sm flex items-center gap-2">
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
                  <Label className="text-white text-sm flex items-center gap-2">
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white">{tr.minutes}</span>
                  </div>
                </div>

                {/* Product Clicks & Order Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white text-sm flex items-center gap-2">
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
                    <Label className="text-white text-sm flex items-center gap-2">
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
              <CardTitle className="text-sm text-white">{tr.detailsForm}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Brand Selection - Multi-select */}
              <div className="space-y-2">
                <Label className="text-white text-sm flex items-center gap-2">
                  <Video className="h-4 w-4 text-red-500" />
                  {tr.selectBrand} <span className="text-red-500">*</span>
                  <span className="text-white/70 text-xs font-normal">({tr.selectBrandHint})</span>
                </Label>
                
                {/* Brand not selected warning */}
                {selectedBrandIds.length === 0 && (
                  <div className="bg-red-600/10 border border-red-500/40 rounded-lg p-3 flex items-center gap-2">
                    <Video className="h-5 w-5 text-red-400 shrink-0" />
                    <p className="text-red-300 text-sm font-medium">{tr.selectBrandFirst}</p>
                  </div>
                )}
                
                <Popover open={brandSearchOpen} onOpenChange={setBrandSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={brandSearchOpen}
                      className="w-full justify-between bg-gray-800 border-gray-700 text-white hover:bg-gray-700 hover:text-white"
                    >
                      {selectedBrandIds.length > 0
                        ? `${selectedBrandIds.length} ${tr.selectedBrands}`
                        : tr.selectBrand}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4 shrink-0 opacity-50"><path d="m6 9 6 6 6-6"/></svg>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-gray-900 border-gray-700" align="start">
                    <Command className="bg-gray-900">
                      <CommandInput placeholder={t("record.searchBrand")} className="text-white" />
                      <CommandList className="max-h-60">
                        <CommandEmpty className="text-white py-4 text-center text-sm">{t("record.brandNotFound")}</CommandEmpty>
                        <CommandGroup>
                          {brands?.map((brand: { id: number; name: string }) => {
                            const isSelected = selectedBrandIds.includes(brand.id.toString());
                            return (
                              <CommandItem
                                key={brand.id}
                                value={brand.name}
                                onSelect={() => {
                                  const brandIdStr = brand.id.toString();
                                  if (isSelected) {
                                    setSelectedBrandIds(prev => prev.filter(id => id !== brandIdStr));
                                  } else {
                                    setSelectedBrandIds(prev => [...prev, brandIdStr]);
                                  }
                                  // Keep popover open for multi-select
                                }}
                                className="text-white hover:bg-gray-700 cursor-pointer aria-selected:bg-gray-700"
                              >
                                <CheckCircle
                                  className={`mr-2 h-4 w-4 ${isSelected ? "text-green-500 opacity-100" : "opacity-0"}`}
                                />
                                {brand.name}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                      {/* Add Brand Button */}
                      <div className="border-t border-gray-700 p-2">
                        {showAddBrand ? (
                          <div className="flex gap-2">
                            <Input
                              value={newBrandName}
                              onChange={(e) => setNewBrandName(e.target.value)}
                              placeholder={tr.addBrandPlaceholder}
                              className="bg-gray-800 border-gray-600 text-white text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newBrandName.trim()) {
                                  e.preventDefault();
                                  addBrandMutation.mutate({
                                    name: newBrandName.trim(),
                                    liverId: liverInfo?.id || 0,
                                    liverName: liverInfo?.name || '',
                                  });
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!newBrandName.trim() || addBrandMutation.isPending}
                              onClick={() => {
                                if (newBrandName.trim()) {
                                  addBrandMutation.mutate({
                                    name: newBrandName.trim(),
                                    liverId: liverInfo?.id || 0,
                                    liverName: liverInfo?.name || '',
                                  });
                                }
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white text-xs px-3"
                            >
                              {addBrandMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => { setShowAddBrand(false); setNewBrandName(""); }}
                              className="text-white/70 hover:text-white text-xs px-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setShowAddBrand(true)}
                            className="w-full justify-start text-yellow-500 hover:text-yellow-400 hover:bg-gray-800 text-sm"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {tr.addBrand}
                          </Button>
                        )}
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Brand Duration Input - 各ブランドの配信時間 */}
              {selectedBrandIds.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-white text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    {tr.brandDuration} <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-white/60">{tr.brandDurationHint}</p>
                  <div className="space-y-2">
                    {selectedBrandIds.map(id => {
                      const brand = brands?.find((b: { id: number; name: string }) => b.id.toString() === id);
                      const duration = brandDurations[id] || "";
                      const hasDuration = duration !== "" && parseInt(duration) > 0;
                      return brand ? (
                        <div key={id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          hasDuration 
                            ? 'bg-green-900/10 border-green-600/30' 
                            : 'bg-red-900/10 border-red-500/40'
                        }`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Tag className={`h-4 w-4 shrink-0 ${hasDuration ? 'text-green-400' : 'text-red-400'}`} />
                            <span className="text-white text-sm font-medium truncate">{brand.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Input
                              type="number"
                              min="1"
                              placeholder="0"
                              value={duration}
                              onChange={(e) => setBrandDurations(prev => ({ ...prev, [id]: e.target.value }))}
                              className={`w-20 h-9 text-center text-white text-sm ${
                                hasDuration 
                                  ? 'bg-gray-800 border-green-600/50' 
                                  : 'bg-gray-800 border-red-500/50'
                              }`}
                            />
                            <span className="text-white/60 text-xs">{tr.minLabel}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBrandIds(prev => prev.filter(bid => bid !== id));
                              setBrandDurations(prev => {
                                const next = { ...prev };
                                delete next[id];
                                return next;
                              });
                            }}
                            className="text-white/40 hover:text-red-400 transition-colors shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Date & Time - ブランド選択後のみ表示 */}
              {selectedBrandIds.length === 0 ? null : (<>
              <div className="space-y-2">
                <Label className="text-white text-sm flex items-center gap-2">
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
                  <Label className="text-white text-sm">{tr.startTime}</Label>
                  <Input
                    type="time"
                    value={formData.livestreamStartTime}
                    onChange={(e) => setFormData({ ...formData, livestreamStartTime: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white text-sm">{tr.endTime}</Label>
                  <Input
                    type="time"
                    value={formData.livestreamEndTime}
                    onChange={(e) => setFormData({ ...formData, livestreamEndTime: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>

              {/* End Date (日付をまたぐ配信用) */}
              <div className="space-y-2">
                <Label className="text-white text-sm flex items-center gap-2">
                  {tr.endDate}
                  <span className="text-xs text-white">{tr.endDateHint}</span>
                </Label>
                <Input
                  type="date"
                  value={formData.livestreamEndDate}
                  onChange={(e) => setFormData({ ...formData, livestreamEndDate: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                  min={formData.livestreamDate}
                />
                {formData.livestreamEndDate && formData.livestreamDate && formData.livestreamEndDate !== formData.livestreamDate && (
                  <p className="text-xs text-yellow-400">
                    {tr.endDateWarning}
                  </p>
                )}
              </div>

              {/* セット組みセクション */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-500" />
                    {t("record.setSection")}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSets([...sets, { setName: '', setPrice: '', quantitySold: '1', items: [{ productName: '', originalPrice: '' }] }])}
                    className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10 text-xs h-7"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t("record.addSet")}
                  </Button>
                </div>

                <p className="text-xs text-white -mt-1">{t("record.setNote")}</p>

                {sets.map((set, setIndex) => {
                  const totalOriginalPrice = set.items.reduce((sum, item) => sum + (parseInt(item.originalPrice) || 0), 0);
                  const setPrice = parseInt(set.setPrice) || 0;
                  const discountRate = totalOriginalPrice > 0 ? Math.round(((totalOriginalPrice - setPrice) / totalOriginalPrice) * 100) : 0;
                  const quantitySold = parseInt(set.quantitySold) || 1;
                  const totalRevenue = setPrice * quantitySold;

                  return (
                    <Card key={setIndex} className="bg-purple-500/5 border-purple-500/20">
                      <CardContent className="p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-purple-400 text-xs font-medium">{t("record.set")} {setIndex + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSets(sets.filter((_, i) => i !== setIndex))}
                            className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* セット名 */}
                        <Input
                          placeholder={t("record.setNamePlaceholder")}
                          value={set.setName}
                          onChange={(e) => {
                            const newSets = [...sets];
                            newSets[setIndex].setName = e.target.value;
                            setSets(newSets);
                          }}
                          className="bg-gray-800 border-gray-700 text-white text-sm"
                        />

                        {/* 売値と販売数量 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-white text-xs">{language === 'ja' ? '売値（円）' : language === 'zh-TW' ? '售價' : language === 'en' ? 'Price' : '售价'}</Label>
                            <Input
                              type="number"
                              placeholder="5000"
                              value={set.setPrice}
                              onChange={(e) => {
                                const newSets = [...sets];
                                newSets[setIndex].setPrice = e.target.value;
                                setSets(newSets);
                              }}
                              className="bg-gray-800 border-gray-700 text-white text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-white text-xs">{language === 'ja' ? '販売数量' : language === 'zh-TW' ? '銷售數量' : language === 'en' ? 'Qty Sold' : '销售数量'}</Label>
                            <Input
                              type="number"
                              placeholder="1"
                              value={set.quantitySold}
                              onChange={(e) => {
                                const newSets = [...sets];
                                newSets[setIndex].quantitySold = e.target.value;
                                setSets(newSets);
                              }}
                              className="bg-gray-800 border-gray-700 text-white text-sm"
                            />
                          </div>
                        </div>

                        {/* セット内商品 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-white text-xs flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {t("record.setProducts")}
                            </Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newSets = [...sets];
                                newSets[setIndex].items.push({ productName: '', originalPrice: '' });
                                setSets(newSets);
                              }}
                              className="text-white hover:text-white text-xs h-6 px-2"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {language === 'ja' ? '商品追加' : language === 'zh-TW' ? '新增商品' : language === 'en' ? 'Add Product' : '新增商品'}
                            </Button>
                          </div>

                          {set.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex gap-2 items-center">
                              <Input
                                placeholder={language === 'ja' ? '商品名' : language === 'zh-TW' ? '商品名稱' : language === 'en' ? 'Product name' : '商品名称'}
                                value={item.productName}
                                onChange={(e) => {
                                  const newSets = [...sets];
                                  newSets[setIndex].items[itemIndex].productName = e.target.value;
                                  setSets(newSets);
                                }}
                                className="bg-gray-800 border-gray-700 text-white text-sm flex-1"
                              />
                              <Input
                                type="number"
                                placeholder={language === 'ja' ? '元値' : language === 'zh-TW' ? '原價' : language === 'en' ? 'Original price' : '原价'}
                                value={item.originalPrice}
                                onChange={(e) => {
                                  const newSets = [...sets];
                                  newSets[setIndex].items[itemIndex].originalPrice = e.target.value;
                                  setSets(newSets);
                                }}
                                className="bg-gray-800 border-gray-700 text-white text-sm w-24"
                              />
                              {set.items.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newSets = [...sets];
                                    newSets[setIndex].items = newSets[setIndex].items.filter((_, i) => i !== itemIndex);
                                    setSets(newSets);
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
                              <span className="text-white">{language === 'ja' ? '元値合計' : language === 'zh-TW' ? '原價合計' : language === 'en' ? 'Original Total' : '原价合计'}</span>
                              <span className="text-white">¥{Number(totalOriginalPrice).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-white">{t("record.discountRate")}</span>
                              <span className={discountRate > 0 ? "text-green-400 font-medium" : "text-white"}>
                                {discountRate > 0 ? `${discountRate}% OFF` : '-'}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-white">{t("record.setTotal")}</span>
                              <span className="text-yellow-400 font-medium">¥{Number(totalRevenue).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Result */}
              <div className="space-y-2">
                <Label className="text-white text-sm flex items-center gap-2">
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
                <Label className="text-white text-sm">{tr.impactFactor}</Label>
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
                <Label className="text-white text-sm">{tr.reasonMemo}</Label>
                <Textarea
                  value={formData.resultReason}
                  onChange={(e) => setFormData({ ...formData, resultReason: e.target.value })}
                  placeholder={tr.reasonPlaceholder}
                  className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
                />
              </div>

              {/* Other Memo */}
              <div className="space-y-2">
                <Label className="text-white text-sm">{tr.otherMemo}</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder={tr.memoPlaceholder}
                  className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
                />
              </div>
              </>)}
            </CardContent>
          </Card>

          {/* Submit Button - Direct save with native confirm */}
          <Button
            type="button"
            onClick={(e) => {
              // Validate before saving
              if (selectedBrandIds.length === 0) {
                toast.error(tr.selectBrandError);
                return;
              }
              // ブランド配信時間のバリデーション
              const missingDurs = selectedBrandIds.filter(id => {
                const dur = brandDurations[id];
                return !dur || parseInt(dur) <= 0;
              });
              if (missingDurs.length > 0) {
                const missingNames = missingDurs.map(id => brands?.find((b: { id: number; name: string }) => b.id.toString() === id)?.name || id).join(', ');
                toast.error(`${missingNames} ${tr.brandDuration}を入力してください`);
                return;
              }
              if (!formData.livestreamDate || !formData.livestreamStartTime) {
                toast.error(tr.enterDateTimeError);
                return;
              }
              // Use native confirm for better LINE browser compatibility
              const brandDetails = selectedBrandIds.map(id => {
                const name = brands?.find((b: { id: number; name: string }) => b.id.toString() === id)?.name || '';
                const dur = brandDurations[id] || '0';
                return `  ${name}: ${dur}${tr.minLabel}`;
              }).filter(Boolean).join('\n');
              const confirmMessage = `${tr.confirmTitle}\n\n${tr.selectBrand}:\n${brandDetails}\n\n${tr.livestreamDate}: ${formData.livestreamDate}\n${tr.startTime}: ${formData.livestreamStartTime}\n${formData.salesAmount ? `${tr.salesAmount}: \u00a5${Number(parseInt(formData.salesAmount)).toLocaleString()}` : ''}\n\n${tr.confirmDescription}`;
              if (window.confirm(confirmMessage)) {
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            disabled={isSubmitting}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-bold touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {tr.saving}
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                {tr.confirmSave}
              </>
            )}
          </Button>
        </form>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md max-h-[90vh] overflow-y-auto touch-manipulation" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <DialogHeader>
              <DialogTitle className="text-yellow-500 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                {tr.confirmTitle}
              </DialogTitle>
              <DialogDescription className="text-white">
                {tr.confirmDescription}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Brand with Duration */}
              <div className="py-2 border-b border-gray-700">
                <span className="text-white block mb-2">{tr.selectBrand}</span>
                {selectedBrandIds.length > 0 ? (
                  <div className="space-y-1">
                    {selectedBrandIds.map(id => {
                      const name = brands?.find((b: { id: number; name: string }) => b.id.toString() === id)?.name || '';
                      const dur = brandDurations[id] || '0';
                      return (
                        <div key={id} className="flex justify-between items-center bg-gray-800 rounded px-3 py-1.5">
                          <span className="text-white font-medium text-sm">{name}</span>
                          <span className="text-yellow-400 font-medium text-sm">{dur}{tr.minLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-white font-medium">{tr.notSet}</span>
                )}
              </div>
              
              {/* Date & Time */}
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-white">{tr.livestreamDate}</span>
                <span className="text-white font-medium">
                  {formData.livestreamDate || tr.notSet}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-white">{tr.startTime}</span>
                <span className="text-white font-medium">
                  {formData.livestreamStartTime || tr.notSet}
                </span>
              </div>
              {formData.livestreamEndTime && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-white">{tr.endTime}</span>
                  <span className="text-white font-medium">
                    {formData.livestreamEndTime}
                  </span>
                </div>
              )}
              
              {/* AI Analysis Data */}
              {formData.salesAmount && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    {tr.salesAmount}
                  </span>
                  <span className="text-green-400 font-bold">
                    ¥{Number(parseInt(formData.salesAmount)).toLocaleString()}
                  </span>
                </div>
              )}
              {formData.viewerCount && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    {tr.viewerCount}
                  </span>
                  <span className="text-white font-medium">
                    {Number(parseInt(formData.viewerCount)).toLocaleString()}
                  </span>
                </div>
              )}
              {formData.peakViewerCount && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-500" />
                    {tr.peakViewerCount}
                  </span>
                  <span className="text-white font-medium">
                    {Number(parseInt(formData.peakViewerCount)).toLocaleString()}
                  </span>
                </div>
              )}
              {formData.durationMinutes && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    {tr.durationMinutes}
                  </span>
                  <span className="text-white font-medium">
                    {formData.durationMinutes} {tr.minutes}
                  </span>
                </div>
              )}
              {formData.productClicks && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-white flex items-center gap-2">
                    <MousePointer className="w-4 h-4 text-yellow-500" />
                    {tr.productClicks}
                  </span>
                  <span className="text-white font-medium">
                    {Number(parseInt(formData.productClicks)).toLocaleString()}
                  </span>
                </div>
              )}
              {formData.orderCount && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-white flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-pink-500" />
                    {tr.orderCount}
                  </span>
                  <span className="text-white font-medium">
                    {Number(parseInt(formData.orderCount)).toLocaleString()}
                  </span>
                </div>
              )}
              
              {/* Result */}
              {formData.result && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-white">{tr.result}</span>
                  <span className={`font-medium ${formData.result === '成功' ? 'text-green-400' : 'text-red-400'}`}>
                    {formData.result}
                  </span>
                </div>
              )}
              
              {/* Impact Factor */}
              {formData.impactFactor && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-white">{tr.impactFactor}</span>
                  <span className="text-white font-medium">
                    {formData.impactFactor}
                  </span>
                </div>
              )}
              
              {/* Reason Memo */}
              {formData.resultReason && (
                <div className="py-2 border-b border-gray-700">
                  <span className="text-white block mb-1">{tr.reasonMemo}</span>
                  <p className="text-white text-sm bg-gray-800 p-2 rounded">
                    {formData.resultReason}
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmDialog(false);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  setShowConfirmDialog(false);
                }}
                className="flex-1 border-gray-600 text-white hover:bg-gray-800 touch-manipulation"
              >
                {tr.confirmCancel}
              </Button>
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmDialog(false);
                  handleSubmit(e as unknown as React.FormEvent);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  setShowConfirmDialog(false);
                  handleSubmit(e as unknown as React.FormEvent);
                }}
                disabled={isSubmitting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white touch-manipulation"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {tr.saving}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {tr.confirmSave}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
