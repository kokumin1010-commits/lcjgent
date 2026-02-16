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
const safeCreateDate = (date: string, time: string): Date | null => {
  if (!date || !time) return null;
  const normalizedTime = normalizeTime(time);
  const dateStr = `${date}T${normalizedTime}:00`;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

// 画像圧縮ユーティリティ関数
const compressImage = async (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      let { width, height } = img;
      
      // アスペクト比を維持してリサイズ
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // JPEGで圧縮（PNGより小さくなる）
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1];
      
      console.log(`[compressImage] Original: ${file.size} bytes, Compressed base64 length: ${base64.length}`);
      
      resolve({
        base64,
        mimeType: 'image/jpeg',
      });
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

// 画像ハッシュを計算（キャッシュ用）
const calculateImageHash = async (base64: string): Promise<string> => {
  // 簡易ハッシュ: base64の最初と1000文字 + 長さ
  const sample = base64.substring(0, 1000);
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${Math.abs(hash)}_${base64.length}`;
};

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
  // Multiple screenshots support (up to 4) - 配信後スクリーンショット（AI分析対象）
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  // Legacy single screenshot state (for backward compatibility)
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  // 配信前スクリーンショット（任意、AI分析なし）
  const [beforeScreenshotFile, setBeforeScreenshotFile] = useState<File | null>(null);
  const [beforeScreenshotPreview, setBeforeScreenshotPreview] = useState<string | null>(null);
  const [beforeScreenshotUrl, setBeforeScreenshotUrl] = useState<string | null>(null);
  // 手入力売上金額（任意）
  const [manualSalesAmount, setManualSalesAmount] = useState("");
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
  const [isAutoCalculatedDuration, setIsAutoCalculatedDuration] = useState(false);
  
  // 配信時間の自動計算
  useEffect(() => {
    // 開始日時と終了日時が両方設定されている場合のみ計算
    if (startDate && startTime && endDate && endTime) {
      try {
        const startDateTime = safeCreateDate(startDate, startTime);
        const endDateTime = safeCreateDate(endDate, endTime);
        
        // 有効な日時かチェック
        if (startDateTime && endDateTime) {
          const diffMs = endDateTime.getTime() - startDateTime.getTime();
          
          // 終了時間が開始時間より後の場合のみ計算
          if (diffMs > 0) {
            const diffMinutes = Math.round(diffMs / (1000 * 60));
            setDurationMinutes(diffMinutes.toString());
            setIsAutoCalculatedDuration(true);
          }
        }
      } catch (e) {
        console.error("Failed to calculate duration:", e);
      }
    }
  }, [startDate, startTime, endDate, endTime]);
  
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
      // 「Invalid time value」エラーを日本語/中国語に翻訳
      let errorMessage = error.message;
      if (error.message.includes("Invalid time value") || error.message.includes("Invalid Date")) {
        errorMessage = language === "ja" 
          ? "時間の形式が正しくありません。開始時刻と終了時刻を確認してください。" 
          : "时间格式不正确。请检查开始和结束时间。";
      }
      toast.error(errorMessage);
      setIsSubmitting(false);
    },
  });
  
  const uploadScreenshotMutation = trpc.liverManagement.uploadScreenshot.useMutation();
  const analyzeScreenshotMutation = trpc.liverManagement.analyzeScreenshot.useMutation();
  const analyzeMultipleScreenshotsMutation = trpc.liverManagement.analyzeMultipleScreenshots.useMutation();
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
      deliveryDate: "配信日",
      startTime: "開始時刻",
      endTime: "終了時刻",
      endDate: "終了日",
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
      autoCalculated: "自動計算",
      manualInput: "手動入力",
      confidence: "解析信頼度",
      high: "高",
      medium: "中",
      low: "低",
      analysisResult: "AI解析結果",
      detailsForm: "詳細情報",
      minutes: "分",
      editableHint: "解析データは編集可能です",
      multipleScreenshots: "複数のスクリーンショットをアップロード（最大4枚）",
      addMore: "追加",
      analyzingMultiple: "複数画像を解析中...",
      mergedResults: "統合結果",
      imageCount: "枚",
      beforeScreenshot: "配信前スクリーンショット",
      beforeScreenshotHint: "任意：配信前のダッシュボードを記録したい場合",
      afterScreenshot: "配信後スクリーンショット",
      afterScreenshotHint: "AIが自動でデータを解析しアドバイスを生成します",
      manualSalesAmount: "手入力売上金額",
      manualSalesAmountHint: "任意：スクショから読み取れない場合に入力",
      noAnalysis: "AI分析なし（記録のみ）",
    },
    zh: {
      title: "记录直播内容",
      subtitle: "上传TikTok仪表板截图，AI将自动分析",
      selectBrand: "选择品牌",
      selectSchedule: "从日程选择（可选）",
      noSchedule: "无日程（手动输入）",
      startDateTime: "开始时间",
      endDateTime: "结束时间",
      deliveryDate: "直播日期",
      startTime: "开始时刻",
      endTime: "结束时刻",
      endDate: "结束日期",
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
      autoCalculated: "自动计算",
      manualInput: "手动输入",
      confidence: "分析可信度",
      high: "高",
      medium: "中",
      low: "低",
      analysisResult: "AI分析结果",
      detailsForm: "详细信息",
      minutes: "分钟",
      editableHint: "分析数据可编辑",
      multipleScreenshots: "上传多张截图（最多4张）",
      beforeScreenshot: "直播前截图",
      beforeScreenshotHint: "可选：记录直播前的仪表盘",
      afterScreenshot: "直播后截图",
      afterScreenshotHint: "AI将自动分析数据并生成建议",
      manualSalesAmount: "手动输入销售额",
      manualSalesAmountHint: "可选：截图无法识别时输入",
      noAnalysis: "无AI分析（仅记录）",
      addMore: "添加",
      analyzingMultiple: "正在分析多张图片...",
      mergedResults: "合并结果",
      imageCount: "张",
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  // Handle multiple screenshot uploads
  const handleMultipleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Limit to 4 images total
    const newFiles = [...screenshotFiles, ...files].slice(0, 4);
    setScreenshotFiles(newFiles);
    
    // Generate previews for new files
    const newPreviews = await Promise.all(
      newFiles.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      })
    );
    setScreenshotPreviews(newPreviews);
    
    // Also set legacy single screenshot state for backward compatibility
    if (newFiles.length > 0) {
      setScreenshotFile(newFiles[0]);
      setScreenshotPreview(newPreviews[0]);
    }
    
    // Auto-analyze after upload
    setTimeout(() => {
      handleAnalyzeMultipleScreenshots(newFiles);
    }, 500);
  };
  
  // Remove a specific screenshot by index
  const removeScreenshotByIndex = (index: number) => {
    const newFiles = screenshotFiles.filter((_, i) => i !== index);
    const newPreviews = screenshotPreviews.filter((_, i) => i !== index);
    const newUrls = screenshotUrls.filter((_, i) => i !== index);
    
    setScreenshotFiles(newFiles);
    setScreenshotPreviews(newPreviews);
    setScreenshotUrls(newUrls);
    
    // Update legacy state
    if (newFiles.length > 0) {
      setScreenshotFile(newFiles[0]);
      setScreenshotPreview(newPreviews[0]);
      setScreenshotUrl(newUrls[0] || null);
    } else {
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setScreenshotUrl(null);
      setAdvice(null);
      setAnalysisConfidence(null);
      setSalesAmount("");
      setViewerCount("");
      setPeakViewerCount("");
      setProductClicks("");
      setOrderCount("");
      setDurationMinutes("");
    }
  };
  
  // 解析結果キャッシュ（セッション内のみ有効）
  const [analysisCache, setAnalysisCache] = useState<Map<string, any>>(new Map());
  
  // Analyze multiple screenshots
  // 解析進捗状態
  const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  
  const handleAnalyzeMultipleScreenshots = async (files?: File[]) => {
    const filesToAnalyze = files || screenshotFiles;
    if (filesToAnalyze.length === 0) return;
    
    setIsAnalyzing(true);
    setAnalysisProgress({ current: 0, total: filesToAnalyze.length, status: '準備中...' });
    
    try {
      // Convert all files to base64 with compression (with progress)
      const imagesData: Array<{
        imageBase64: string;
        mimeType: string;
        url: string;
        cacheKey: string;
      }> = [];
      
      for (let i = 0; i < filesToAnalyze.length; i++) {
        const file = filesToAnalyze[i];
        setAnalysisProgress({ 
          current: i + 1, 
          total: filesToAnalyze.length, 
          status: `画像 ${i + 1}/${filesToAnalyze.length} を処理中...` 
        });
        
        // 画像を圧縮（最大幅1920px、品質80%）
        const compressed = await compressImage(file, 1920, 1080, 0.8);
        
        // キャッシュキーを計算
        const cacheKey = await calculateImageHash(compressed.base64);
        
        // Upload each screenshot
        const uploadResult = await uploadScreenshotMutation.mutateAsync({
          base64: compressed.base64,
          filename: file.name,
          liverId,
        });
        
        imagesData.push({
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
          url: uploadResult.url,
          cacheKey,
        });
      }
      
      // Store uploaded URLs
      setScreenshotUrls(imagesData.map(d => d.url));
      setScreenshotUrl(imagesData[0]?.url || null);
      
      // キャッシュキーを結合（全画像のハッシュを結合）
      const combinedCacheKey = imagesData.map(d => d.cacheKey).join('_');
      
      // キャッシュをチェック
      const cachedResult = analysisCache.get(combinedCacheKey);
      let analysisResult: {
        salesAmount?: number | null;
        viewerCount?: number | null;
        peakViewerCount?: number | null;
        productClicks?: number | null;
        orderCount?: number | null;
        durationMinutes?: number | null;
        startDateTime?: string | null;
        endDateTime?: string | null;
        confidence?: string | null;
      };
      
      if (cachedResult) {
        console.log('[handleAnalyzeMultipleScreenshots] Using cached result');
        analysisResult = cachedResult;
        toast.success('キャッシュから結果を取得しました');
      } else {
        setAnalysisProgress({ 
          current: filesToAnalyze.length, 
          total: filesToAnalyze.length, 
          status: 'AI解析中...' 
        });
        
        // Analyze all screenshots together
        analysisResult = await analyzeMultipleScreenshotsMutation.mutateAsync({
          images: imagesData.map(d => ({
            imageBase64: d.imageBase64,
            mimeType: d.mimeType,
            imageHash: d.cacheKey, // 履歴保存用
          })),
          liverId, // 履歴追跡用
          saveToHistory: true, // 履歴に保存
        });
        
        // 結果をキャッシュに保存
        setAnalysisCache(prev => {
          const newCache = new Map(prev);
          newCache.set(combinedCacheKey, analysisResult);
          return newCache;
        });
      }
      
      setAnalysisConfidence(analysisResult.confidence || null);
      
      // Auto-fill form with merged data
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
      console.error("Multiple screenshot analysis failed:", error);
      toast.error(tr.analysisError);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  };
  
  // Legacy single screenshot handler (for backward compatibility)
  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Use the new multiple screenshot handler
      const newFiles = [file];
      setScreenshotFiles(newFiles);
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        setScreenshotPreview(preview);
        setScreenshotPreviews([preview]);
      };
      reader.readAsDataURL(file);
      
      // Auto-analyze after upload
      setTimeout(() => {
        handleAnalyzeMultipleScreenshots([file]);
      }, 500);
    }
  };
  
  const removeScreenshot = () => {
    setScreenshotFiles([]);
    setScreenshotPreviews([]);
    setScreenshotUrls([]);
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
    startDateTime?: string | null;
    endDateTime?: string | null;
    confidence?: string | null;
    rawData?: Record<string, number>;
    individualResults?: unknown[];
    mergeStrategy?: string;
  } | null) => {
    // Skip if no data provided
    if (!data) {
      console.log("[handleGenerateAdvice] No data provided, skipping");
      return;
    }
    
    // 開始時刻・終了時刻から配信時間を計算（AI解析結果より優先）
    let calculatedDuration = data.durationMinutes;
    
    // まずフォームの開始時刻・終了時刻から計算を試みる
    if (startDate && startTime && endDate && endTime) {
      try {
        const startDt = safeCreateDate(startDate, startTime);
        const endDt = safeCreateDate(endDate, endTime);
        if (startDt && endDt) {
          const diffMs = endDt.getTime() - startDt.getTime();
          if (diffMs > 0) {
            calculatedDuration = Math.round(diffMs / (1000 * 60));
            console.log(`[handleGenerateAdvice] Calculated duration from form times: ${calculatedDuration} minutes (AI said: ${data.durationMinutes})`);
          }
        }
      } catch (e) {
        console.error("Failed to calculate duration from form times:", e);
      }
    }
    // フォームに時刻がない場合、AI解析結果の時刻から計算
    else if (data.startDateTime && data.endDateTime && !calculatedDuration) {
      try {
        const startDt = new Date(data.startDateTime.replace(' ', 'T') + ':00');
        const endDt = new Date(data.endDateTime.replace(' ', 'T') + ':00');
        if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
          const diffMs = endDt.getTime() - startDt.getTime();
          if (diffMs > 0) {
            calculatedDuration = Math.round(diffMs / (1000 * 60));
            console.log(`[handleGenerateAdvice] Calculated duration from AI times: ${calculatedDuration} minutes (AI said: ${data.durationMinutes})`);
          }
        }
      } catch (e) {
        console.error("Failed to calculate duration from AI times:", e);
      }
    }
    
    const dataToUse = {
      salesAmount: data.salesAmount ?? (salesAmount ? parseInt(salesAmount) : undefined),
      viewerCount: data.viewerCount ?? (viewerCount ? parseInt(viewerCount) : undefined),
      peakViewerCount: data.peakViewerCount ?? (peakViewerCount ? parseInt(peakViewerCount) : undefined),
      productClicks: data.productClicks ?? (productClicks ? parseInt(productClicks) : undefined),
      orderCount: data.orderCount ?? (orderCount ? parseInt(orderCount) : undefined),
      durationMinutes: calculatedDuration ?? (durationMinutes ? parseInt(durationMinutes) : undefined),
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
      // Use the first uploaded screenshot URL (already uploaded during analysis)
      const finalScreenshotUrl = screenshotUrls.length > 0 
        ? screenshotUrls[0] 
        : screenshotUrl;
      
      const livestreamDateTime = safeCreateDate(startDate, startTime);
      if (!livestreamDateTime) {
        toast.error(language === "ja" ? "開始日時の形式が正しくありません" : "开始时间格式不正确");
        setIsSubmitting(false);
        return;
      }
      const endDateTime = endDate && endTime 
        ? safeCreateDate(endDate, endTime)
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
        beforeScreenshotUrl: beforeScreenshotUrl || undefined,
        manualSalesAmount: manualSalesAmount ? parseInt(manualSalesAmount) : undefined,
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
            <p className="text-sm text-gray-200">{liver?.name || ""}</p>
          </div>
        </div>
        
        {/* 配信前スクリーンショット（任意、AI分析なし） */}
        <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
              <Camera className="w-4 h-4 text-gray-200" />
              {tr.beforeScreenshot}
              <span className="text-xs text-gray-300 bg-gray-700 px-2 py-0.5 rounded">{tr.noAnalysis}</span>
            </CardTitle>
            <p className="text-xs text-gray-300">{tr.beforeScreenshotHint}</p>
          </CardHeader>
          <CardContent className="p-3">
            {beforeScreenshotPreview ? (
              <div className="space-y-3">
                <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                  <img 
                    src={beforeScreenshotPreview} 
                    alt="配信前スクリーンショット"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBeforeScreenshotFile(null);
                      setBeforeScreenshotPreview(null);
                      setBeforeScreenshotUrl(null);
                    }}
                    className="absolute top-2 right-2 bg-red-600 rounded-full p-1.5 hover:bg-red-700 shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 cursor-pointer hover:bg-gray-800/50 transition-colors rounded-lg border-2 border-dashed border-gray-600">
                <div className="flex flex-col items-center">
                  <Camera className="w-8 h-8 text-gray-300 mb-1" />
                  <span className="text-gray-200 text-sm">タップして配信前のスクショをアップロード</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBeforeScreenshotFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => setBeforeScreenshotPreview(reader.result as string);
                    reader.readAsDataURL(file);
                    // アップロード（AI分析なし）
                    try {
                      const compressed = await compressImage(file, 1920, 1080, 0.8);
                      const uploadResult = await uploadScreenshotMutation.mutateAsync({
                        base64: compressed.base64,
                        filename: `before_${file.name}`,
                        liverId,
                      });
                      setBeforeScreenshotUrl(uploadResult.url);
                    } catch (error) {
                      console.error('Failed to upload before screenshot:', error);
                    }
                  }}
                  className="hidden"
                />
              </label>
            )}
          </CardContent>
        </Card>

        {/* 配信後スクリーンショット（AI分析対象） */}
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
              <Camera className="w-4 h-4 text-purple-400" />
              {tr.afterScreenshot}
              {screenshotPreviews.length > 0 && (
                <span className="text-xs text-gray-300">({screenshotPreviews.length}/4{tr.imageCount})</span>
              )}
              <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded">AI分析</span>
            </CardTitle>
            <p className="text-xs text-gray-300">{tr.afterScreenshotHint}</p>
          </CardHeader>
          <CardContent className="p-3">
            {screenshotPreviews.length > 0 ? (
              <div className="space-y-3">
                {/* Screenshot Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {screenshotPreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                      <img 
                        src={preview} 
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeScreenshotByIndex(index)}
                        className="absolute top-1 right-1 bg-red-600 rounded-full p-1 hover:bg-red-700 shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {/* Image Number Badge */}
                      <div className="absolute bottom-1 left-1 bg-black/70 rounded px-1.5 py-0.5">
                        <span className="text-xs text-white">{index + 1}</span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add More Button (if less than 4 images) */}
                  {screenshotPreviews.length < 4 && (
                    <label className="aspect-video bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800 hover:border-gray-500 transition-colors">
                      <Camera className="w-6 h-6 text-gray-200 mb-1" />
                      <span className="text-xs text-gray-200">{tr.addMore}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleMultipleScreenshotChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                
                {/* Analyzing Overlay */}
                {isAnalyzing && (
                  <div className="bg-purple-900/30 rounded-lg p-4 flex items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                    <p className="text-white text-sm">
                      {screenshotPreviews.length > 1 ? tr.analyzingMultiple : tr.analyzing}
                    </p>
                  </div>
                )}
                
                {/* Re-analyze Button */}
                {!isAnalyzing && (
                  <div className="flex justify-between items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeScreenshot}
                      className="text-red-400 hover:bg-red-600/20 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      すべて削除
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAnalyzeMultipleScreenshots()}
                      className="text-purple-400 hover:bg-purple-600/20 text-xs"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {tr.analyzeScreenshot}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-40 cursor-pointer hover:bg-gray-800/50 transition-colors rounded-lg border-2 border-dashed border-gray-600">
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mb-2">
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-white font-medium text-sm">{tr.tapToUpload}</span>
                  <span className="text-xs text-gray-200 mt-1">{tr.aiAnalysis}</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultipleScreenshotChange}
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
                      <p className="text-gray-200 text-xs">{key}</p>
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
                        <p className="text-gray-200 text-xs mt-1">理由: {action.reason}</p>
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
          {screenshotPreviews.length > 0 && (
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
                      onClick={() => handleAnalyzeMultipleScreenshots()}
                      disabled={isAnalyzing}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-purple-400 hover:bg-purple-600/20"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          {analysisProgress ? analysisProgress.status : '解析中...'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 mr-1" />
                          {tr.analyzeScreenshot}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-300 mt-1">{tr.editableHint}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sales Amount */}
                <div className="space-y-2">
                  <Label className="text-gray-200 text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    {tr.salesAmount}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-200">¥</span>
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
                    <Label className="text-gray-200 text-sm flex items-center gap-2">
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
                    <Label className="text-gray-200 text-sm flex items-center gap-2">
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
                  <Label className="text-gray-200 text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    {tr.durationMinutes}
                    {isAutoCalculatedDuration && (
                      <span className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded">
                        {tr.autoCalculated}
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => {
                        setDurationMinutes(e.target.value);
                        setIsAutoCalculatedDuration(false); // 手動入力時は自動計算フラグをオフ
                      }}
                      placeholder="0"
                      className={`bg-gray-800 border-gray-700 text-white pr-12 ${isAutoCalculatedDuration ? 'border-green-600/50' : ''}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-200">{tr.minutes}</span>
                  </div>
                  {isAutoCalculatedDuration && startDate && startTime && endDate && endTime && (
                    <p className="text-xs text-green-400">
                      {startDate} {startTime} 〜 {endDate !== startDate ? `${endDate} ` : ''}{endTime} から自動計算
                    </p>
                  )}
                </div>

                {/* Product Clicks & Order Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-200 text-sm flex items-center gap-2">
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
                    <Label className="text-gray-200 text-sm flex items-center gap-2">
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
                  <Label className="text-gray-200 text-sm">{tr.selectSchedule}</Label>
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
                <Label className="text-gray-200 text-sm">
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
              
              {/* Delivery Date */}
              <div className="space-y-2">
                <Label className="text-gray-200 text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-500" />
                  {tr.deliveryDate} <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    // 終了日が未設定なら同じ日付をデフォルト設定
                    if (!endDate) {
                      setEndDate(e.target.value);
                    }
                  }}
                  className="bg-gray-800 border-gray-600"
                />
              </div>
              
              {/* Start/End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-gray-200 text-sm">{tr.startTime}</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-200 text-sm">{tr.endTime}</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
              </div>
              
              {/* End Date (日付をまたぐ配信用) */}
              <div className="space-y-2">
                <Label className="text-gray-200 text-sm flex items-center gap-2">
                  {tr.endDate}
                  <span className="text-xs text-gray-300">(日付をまたぐ場合のみ)</span>
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                  min={startDate}
                />
                {endDate && startDate && endDate !== startDate && (
                  <p className="text-xs text-yellow-400">
                    ※ 終了日が配信日と異なります（日付をまたぐ配信）
                  </p>
                )}
              </div>
              
              {/* Result */}
              <div className="space-y-2">
                <Label className="text-gray-200 text-sm">{tr.deliveryResult}</Label>
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
                <Label className="text-gray-200 text-sm">{tr.impactFactor}</Label>
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
                <Label className="text-gray-200 text-sm">{tr.reason}</Label>
                <Textarea
                  value={resultReason}
                  onChange={(e) => setResultReason(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                  rows={2}
                />
              </div>
              
              {/* Memo */}
              <div className="space-y-2">
                <Label className="text-gray-200 text-sm">{tr.memo}</Label>
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
