import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Edit, Home, ChevronDown, ChevronUp, ExternalLink, AlertTriangle, TrendingUp, Clock, DollarSign, Activity, Calendar, ArrowUpRight, ArrowDownRight, Sparkles, BarChart3, Package, ShoppingBag, Tag, Crown, Medal, Award, MoveRight, Plus, Check, X, Loader2, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SiTiktok, SiInstagram, SiYoutube } from "react-icons/si";
import { Link2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// Matrix rain effect component
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops: number[] = [];
    
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }
    
    function draw() {
      if (!ctx || !canvas) return;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#0ff';
      ctx.font = `${fontSize}px monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        
        const alpha = Math.min(1, drops[i] / 30);
        ctx.fillStyle = `rgba(0, 255, 255, ${0.1 + alpha * 0.4})`;
        ctx.fillText(text, x, y);
        
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }
    
    const interval = setInterval(draw, 50);
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none opacity-30"
      style={{ zIndex: 0 }}
    />
  );
}

export default function LiverDetailNew() {
  const params = useParams<{ id: string }>();
  const liverId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  
  // Generate month options (last 24 months + all-time)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: "all", label: language === 'zh' ? '全部期间' : '全期間' },
    ];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    return options;
  }, [language]);
  
  // Previous month for comparison
  const previousMonth = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[1].value); // default to current month
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryMoveTarget, setCategoryMoveTarget] = useState<{ productName: string; currentCategory: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkNewCategoryName, setBulkNewCategoryName] = useState("");
  const [showBulkNewCategoryInput, setShowBulkNewCategoryInput] = useState(false);
  
  // For getById/getLivestreams, use current month when "all" is selected
  const statsMonth = selectedMonth === 'all' ? monthOptions[1].value : selectedMonth;
  const prevStatsMonth = useMemo(() => {
    if (selectedMonth === 'all') return previousMonth;
    const [y, m] = selectedMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth, previousMonth]);
  
  const { data: liver, isLoading: liverLoading } = trpc.liverManagement.getById.useQuery({
    id: liverId,
    month: statsMonth,
  });
  
  const { data: previousStats } = trpc.liverManagement.getById.useQuery({
    id: liverId,
    month: prevStatsMonth,
  });
  
  const { data: livestreams, isLoading: livestreamsLoading } = trpc.liverManagement.getLivestreams.useQuery({
    liverId,
    month: statsMonth,
  });

  // New: Top products, brand performance, category analysis (with month filter)
  const apiMonth = selectedMonth === 'all' ? undefined : selectedMonth;
  const { data: topProducts, isLoading: topProductsLoading } = trpc.liverManagement.getTopProducts.useQuery({
    liverId,
    month: apiMonth,
  });

  const { data: brandPerformance, isLoading: brandLoading } = trpc.liverManagement.getLiverBrandPerformance.useQuery({
    liverId,
    month: apiMonth,
  });

  const { data: categoryAnalysis, isLoading: categoryLoading } = trpc.liverManagement.getCategoryAnalysis.useQuery({
    liverId,
    month: apiMonth,
  });

  // Set Analysis (セット戦略分析)
  const { data: setAnalysis, isLoading: setAnalysisLoading } = trpc.livestreamSets.liverSetAnalysis.useQuery({
    liverId,
  });

  // クレジット履歴・サンプル請求履歴
  const { data: creditHistory } = trpc.sampleRequest.getLiverCreditHistory.useQuery({ liverId });
  const { data: sampleRequests } = trpc.sampleRequest.getLiverRequests.useQuery({ liverId });
  const [expandedSetId, setExpandedSetId] = useState<number | null>(null);
  const [setsSortOrder, setSetsSortOrder] = useState<'date' | 'revenue'>('date');
  const aiSetSuggestionMutation = trpc.livestreamSets.aiSetSuggestion.useMutation();

  // Category mapping queries and mutations
  const utils = trpc.useUtils();
  const { data: distinctCategories } = trpc.liverManagement.getDistinctCategories.useQuery();
  
  const upsertMappingMutation = trpc.liverManagement.upsertProductCategoryMapping.useMutation({
    onSuccess: () => {
      utils.liverManagement.getCategoryAnalysis.invalidate({ liverId });
      utils.liverManagement.getDistinctCategories.invalidate();
      setCategoryMoveTarget(null);
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      toast.success(language === 'zh' ? '分类已更新' : 'カテゴリを更新しました');
    },
    onError: (error) => {
      toast.error(language === 'zh' ? '分类更新失败' : `カテゴリ更新に失敗: ${error.message}`);
    },
  });

  const bulkUpsertMutation = trpc.liverManagement.bulkUpsertProductCategoryMappings.useMutation({
    onSuccess: (data) => {
      utils.liverManagement.getCategoryAnalysis.invalidate({ liverId });
      utils.liverManagement.getDistinctCategories.invalidate();
      const count = selectedProducts.size;
      setSelectedProducts(new Set());
      setBulkNewCategoryName("");
      setShowBulkNewCategoryInput(false);
      toast.success(language === 'zh' ? `${count}个商品已移动` : `${count}件の商品を移動しました`);
    },
    onError: (error) => {
      toast.error(language === 'zh' ? '一括移动失败' : `一括移動に失敗: ${error.message}`);
    },
  });

  // Build available categories list (built-in + user-created)
  const builtInCategories = useMemo(() => [
    "美容液・セラム", "ヘアケア", "スキンケア", "UV・日焼け止め",
    "美顔器・デバイス", "メイクアップ", "ボディケア", "サプリメント",
    "健康食品・ドリンク", "フレグランス",
  ], []);

  const allAvailableCategories = useMemo(() => {
    const set = new Set([...builtInCategories]);
    if (distinctCategories) {
      for (const c of distinctCategories) set.add(c);
    }
    // Also add categories from current analysis (excluding "その他")
    if (categoryAnalysis) {
      for (const c of categoryAnalysis) {
        if (c.category !== 'その他') set.add(c.category);
      }
    }
    return Array.from(set).sort();
  }, [builtInCategories, distinctCategories, categoryAnalysis]);

  const handleMoveToCategory = (productName: string, targetCategory: string) => {
    upsertMappingMutation.mutate({ productName, category: targetCategory });
  };

  const handleCreateAndMove = (productName: string) => {
    if (!newCategoryName.trim()) return;
    upsertMappingMutation.mutate({ productName, category: newCategoryName.trim() });
  };

  // Bulk move handlers
  const toggleProductSelection = (productName: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productName)) {
        next.delete(productName);
      } else {
        next.add(productName);
      }
      return next;
    });
  };

  const toggleSelectAllInCategory = (products: { name: string; gmv: number }[]) => {
    const productNames = products.map(p => p.name);
    const allSelected = productNames.every(n => selectedProducts.has(n));
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (allSelected) {
        productNames.forEach(n => next.delete(n));
      } else {
        productNames.forEach(n => next.add(n));
      }
      return next;
    });
  };

  const handleBulkMoveToCategory = (targetCategory: string) => {
    if (selectedProducts.size === 0) return;
    const mappings = Array.from(selectedProducts).map(productName => ({
      productName,
      category: targetCategory,
    }));
    bulkUpsertMutation.mutate({ mappings });
  };

  const handleBulkCreateAndMove = () => {
    if (!bulkNewCategoryName.trim() || selectedProducts.size === 0) return;
    const mappings = Array.from(selectedProducts).map(productName => ({
      productName,
      category: bulkNewCategoryName.trim(),
    }));
    bulkUpsertMutation.mutate({ mappings });
  };
  
  const translations = {
    ja: {
      title: "ライバー詳細",
      subtitle: "LIVER PROFILE",
      liverList: "司令塔へ戻る",
      edit: "編集",
      monthlyPerformance: "月実績",
      selectedMonthPerformance: "選択月実績",
      sales: "売上",
      totalDuration: "累計配信時間",
      deliveryHistory: "配信履歴",
      start: "開始",
      end: "終了",
      duration: "配信時間",
      salesTotal: "売上合計",
      detail: "詳細",
      noHistory: "配信履歴がありません。",
      backToList: "司令塔へ戻る",
      viewMore: "VIEW MORE",
      viewLess: "閉じる",
      hours: "時間",
      prevMonth: "前月実績",
      currentMonth: "今月実績",
      growth: "成長率",
      totalStreams: "配信数",
      recordStream: "配信内容の記録",
      setStrategy: "セット戦略分析",
      setStrategyDesc: "このライバーのセット作成実績と売れ筋セットを分析",
      totalSets: "セット数",
      totalSetRevenue: "セット売上合計",
      avgDiscount: "平均割引率",
      avgQuantity: "平均販売数",
      setName: "セット名",
      setPrice: "売値",
      quantitySold: "販売数",
      setRevenue: "セット売上",
      discountRate: "割引率",
      streamDate: "配信日",
      setContents: "セット内容",
      originalTotal: "元値合計",
      bestSet: "ベスト",
      popular: "人気",
      noSetData: "セットデータがありません",
    },
    zh: {
      title: "主播详情",
      subtitle: "LIVER PROFILE",
      liverList: "返回指挥中心",
      edit: "编辑",
      monthlyPerformance: "月业绩",
      selectedMonthPerformance: "选择月业绩",
      sales: "销售额",
      totalDuration: "累计直播时长",
      deliveryHistory: "直播记录",
      start: "开始",
      end: "结束",
      duration: "直播时长",
      salesTotal: "销售总额",
      detail: "详情",
      noHistory: "暂无直播记录。",
      backToList: "返回指挥中心",
      viewMore: "查看更多",
      viewLess: "收起",
      hours: "小时",
      prevMonth: "上月业绩",
      currentMonth: "本月业绩",
      growth: "增长率",
      totalStreams: "直播数",
      recordStream: "记录直播内容",
      setStrategy: "套装战略分析",
      setStrategyDesc: "分析该主播的套装创建实绩和热销套装",
      totalSets: "套装数",
      totalSetRevenue: "套装销售总额",
      avgDiscount: "平均折扣率",
      avgQuantity: "平均销量",
      setName: "套装名",
      setPrice: "售价",
      quantitySold: "销量",
      setRevenue: "套装销售额",
      discountRate: "折扣率",
      streamDate: "直播日",
      setContents: "套装内容",
      originalTotal: "原价合计",
      bestSet: "最佳",
      popular: "热门",
      noSetData: "暂无套装数据",
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    return `¥${Math.round(num).toLocaleString('ja-JP')}`;
  };
  
  const formatDuration = (minutes: number) => {
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
  };
  
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Tokyo' };
    const year = parseInt(d.toLocaleDateString('ja-JP', { ...options, year: 'numeric' }));
    const month = String(parseInt(d.toLocaleDateString('ja-JP', { ...options, month: 'numeric' }))).padStart(2, '0');
    const day = String(parseInt(d.toLocaleDateString('ja-JP', { ...options, day: 'numeric' }))).padStart(2, '0');
    const weekdayStr = d.toLocaleDateString('ja-JP', { ...options, weekday: 'short' });
    const time = d.toLocaleTimeString('ja-JP', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
    return `${year}/${month}/${day}(${weekdayStr})\n${time}`;
  };
  
  const calculateDurationFromDates = (start: Date | string, end: Date | string | null) => {
    if (!end) return "-";
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diffMinutes = Math.round((endTime - startTime) / (1000 * 60));
    const hours = (diffMinutes / 60).toFixed(1);
    return `${hours}${tr.hours}`;
  };
  
  // Calculate growth rates
  const salesGrowth = useMemo(() => {
    const prev = previousStats?.stats?.totalSales || 0;
    const current = liver?.stats?.totalSales || 0;
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  }, [previousStats, liver]);
  
  const durationGrowth = useMemo(() => {
    const prev = previousStats?.stats?.totalDuration || 0;
    const current = liver?.stats?.totalDuration || 0;
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  }, [previousStats, liver]);
  
  const livestreamsToShow = showAllHistory 
    ? livestreams 
    : livestreams?.slice(0, 10);

  if (liverLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white p-6 relative overflow-hidden">
        <MatrixRain />
        <div className="max-w-5xl mx-auto space-y-6 relative z-10">
          <Skeleton className="h-10 w-48 bg-cyan-900/30" />
          <Skeleton className="h-32 w-32 rounded-full bg-cyan-900/30 mx-auto" />
          <Skeleton className="h-64 w-full bg-cyan-900/30" />
        </div>
      </div>
    );
  }

  if (!liver) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white p-6 relative overflow-hidden">
        <MatrixRain />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <p className="text-cyan-500/50">ライバーが見つかりません</p>
          <Link href="/master/livers-dashboard">
            <Button className="mt-4 bg-cyan-600 hover:bg-cyan-700">
              {tr.backToList}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white relative overflow-hidden">
      {/* Matrix Rain Background */}
      <MatrixRain />
      
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-cyan-900/10 via-transparent to-blue-900/20 pointer-events-none" style={{ zIndex: 1 }} />
      
      {/* Cyan top border with glow */}
      <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.5)]" style={{ zIndex: 10 }} />
      
      <div className="max-w-5xl mx-auto p-6 space-y-8 relative" style={{ zIndex: 10 }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-cyan-400" />
              {tr.title}
            </h1>
            <p className="text-cyan-500/60 text-sm tracking-[0.2em] mt-1">{tr.subtitle}</p>
          </div>
          <Link href="/master/livers-dashboard">
            <Button variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/30 hover:border-cyan-400/50">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {tr.liverList}
            </Button>
          </Link>
        </div>
        
        {/* Profile Card */}
        <Card className="bg-gradient-to-br from-[#0a1a2a]/90 to-[#0a2a3a]/90 border-cyan-500/30 backdrop-blur-sm shadow-[0_0_30px_rgba(0,255,255,0.1)]">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Avatar */}
              <div className="relative">
                <Avatar className="w-36 h-36 ring-4 ring-cyan-500/40 shadow-[0_0_30px_rgba(0,255,255,0.3)]">
                  <AvatarImage src={liver.avatarUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-900 to-blue-900 text-cyan-100 text-5xl">
                    {liver.name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-2 right-2 bg-cyan-500 rounded-full p-2 shadow-[0_0_15px_rgba(0,255,255,0.5)]">
                  <Home className="w-4 h-4 text-black" />
                </div>
              </div>
              
              {/* Name and SNS */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <h2 className="text-3xl font-bold text-cyan-100">{liver.name}</h2>
                  <Link href={`/livers/${liverId}/edit`}>
                    <Edit className="w-5 h-5 text-cyan-500/50 hover:text-cyan-400 cursor-pointer transition-colors" />
                  </Link>
                </div>
                
                {/* SNS Links */}
                {(liver.tiktokAccount || liver.instagramAccount || liver.youtubeAccount || liver.otherAccount) && (
                  <div className="flex items-center justify-center md:justify-start gap-4">
                    {liver.tiktokAccount && (
                      <a 
                        href={liver.tiktokAccount.startsWith('http') ? liver.tiktokAccount : `https://www.tiktok.com/${liver.tiktokAccount.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                        title="TikTok"
                      >
                        <SiTiktok className="w-5 h-5" />
                      </a>
                    )}
                    {liver.instagramAccount && (
                      <a 
                        href={liver.instagramAccount.startsWith('http') ? liver.instagramAccount : `https://www.instagram.com/${liver.instagramAccount.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-cyan-500/50 hover:text-pink-400 transition-colors"
                        title="Instagram"
                      >
                        <SiInstagram className="w-5 h-5" />
                      </a>
                    )}
                    {liver.youtubeAccount && (
                      <a 
                        href={liver.youtubeAccount.startsWith('http') ? liver.youtubeAccount : `https://www.youtube.com/${liver.youtubeAccount}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-cyan-500/50 hover:text-red-400 transition-colors"
                        title="YouTube"
                      >
                        <SiYoutube className="w-5 h-5" />
                      </a>
                    )}
                    {liver.otherAccount && (
                      <a 
                        href={liver.otherAccount.startsWith('http') ? liver.otherAccount : `https://${liver.otherAccount}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-cyan-500/50 hover:text-blue-400 transition-colors"
                        title="Other"
                      >
                        <Link2 className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Month Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-medium">{language === 'zh' ? '期间选择' : '期間選択'}</span>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px] bg-[#0a1a2a]/80 border-cyan-500/30 text-cyan-100 hover:border-cyan-400/50 focus:ring-cyan-500/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a1a2a] border-cyan-500/30">
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-cyan-100 hover:bg-cyan-900/30 focus:bg-cyan-900/30">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Previous Month */}
          <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <h3 className="text-sm text-cyan-500/60 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {tr.prevMonth}（{prevStatsMonth.replace("-", "年")}月）
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a1520]/60 rounded-xl p-4 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    <span className="text-cyan-300/70 text-xs">{tr.sales}</span>
                  </div>
                  <p className="text-xl font-bold text-yellow-400">
                    {formatCurrency(previousStats?.stats?.totalSales || 0)}
                  </p>
                </div>
                <div className="bg-[#0a1520]/60 rounded-xl p-4 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-300/70 text-xs">{tr.totalDuration}</span>
                  </div>
                  <p className="text-xl font-bold text-cyan-400">
                    {formatDuration(previousStats?.stats?.totalDuration || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Current Month */}
          <Card className="bg-gradient-to-br from-[#0a1a2a]/90 to-[#0a2a3a]/90 border-cyan-500/30 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,255,0.1)]">
            <CardContent className="p-6">
              <h3 className="text-sm text-cyan-400 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {tr.currentMonth}（{monthOptions.find(m => m.value === statsMonth)?.label}）
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a1520]/60 rounded-xl p-4 border border-yellow-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    <span className="text-cyan-300/70 text-xs">{tr.sales}</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                    {formatCurrency(liver.stats?.totalSales || 0)}
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${salesGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {salesGrowth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span className="font-mono">{salesGrowth >= 0 ? '+' : ''}{salesGrowth}%</span>
                  </div>
                </div>
                <div className="bg-[#0a1520]/60 rounded-xl p-4 border border-cyan-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-300/70 text-xs">{tr.totalDuration}</span>
                  </div>
                  <p className="text-2xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                    {formatDuration(liver.stats?.totalDuration || 0)}
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${durationGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {durationGrowth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span className="font-mono">{durationGrowth >= 0 ? '+' : ''}{durationGrowth}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== NEW SECTION: Top Selling Products ===== */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-cyan-100 flex items-center gap-2 mb-6">
              <Crown className="w-5 h-5 text-yellow-400" />
              {language === 'zh' ? '畅销商品排行' : '売れ筋商品ランキング'}
            </h3>
            {topProductsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-cyan-900/30" />)}
              </div>
            ) : topProducts && topProducts.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-cyan-500/30">
                        <th className="text-left py-3 px-2 text-cyan-400 w-10">#</th>
                        <th className="text-left py-3 px-2 text-cyan-400">{language === 'zh' ? '商品名' : '商品名'}</th>
                        <th className="text-right py-3 px-2 text-cyan-400">GMV</th>
                        <th className="text-right py-3 px-2 text-cyan-400">{language === 'zh' ? '销量' : '販売数'}</th>
                        <th className="text-right py-3 px-2 text-cyan-400">{language === 'zh' ? '直播次数' : '配信回数'}</th>
                        <th className="text-right py-3 px-2 text-cyan-400">{language === 'zh' ? '平均GMV/场' : '平均GMV/配信'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllProducts ? topProducts : topProducts.slice(0, 10)).map((product) => (
                        <tr key={product.productName} className="border-b border-cyan-500/10 hover:bg-cyan-900/20 transition-colors">
                          <td className="py-3 px-2">
                            {product.rank <= 3 ? (
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                product.rank === 1 ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40' :
                                product.rank === 2 ? 'bg-gray-400/20 text-white ring-1 ring-gray-400/40' :
                                'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40'
                              }`}>
                                {product.rank}
                              </span>
                            ) : (
                              <span className="text-cyan-500/50 text-xs pl-2">{product.rank}</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-cyan-100 max-w-[200px] truncate" title={product.productName}>
                            {product.productName}
                          </td>
                          <td className="text-right py-3 px-2 text-yellow-400 font-bold font-mono">
                            {formatCurrency(product.totalGmv)}
                          </td>
                          <td className="text-right py-3 px-2 text-cyan-300 font-mono">
                            {product.totalItemsSold.toLocaleString('ja-JP')}
                          </td>
                          <td className="text-right py-3 px-2 text-cyan-300 font-mono">
                            {product.livestreamCount}
                          </td>
                          <td className="text-right py-3 px-2 text-cyan-300 font-mono">
                            {formatCurrency(product.avgGmvPerStream)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {topProducts.length > 10 && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllProducts(!showAllProducts)}
                      className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/30 hover:border-cyan-400/50"
                    >
                      {showAllProducts ? (
                        <>{language === 'zh' ? '收起' : '閉じる'} <ChevronUp className="w-4 h-4 ml-1" /></>
                      ) : (
                        <>VIEW MORE <ChevronDown className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-cyan-500/50 text-center py-6">{language === 'zh' ? '暂无商品数据' : '商品データがありません'}</p>
            )}
          </CardContent>
        </Card>

        {/* ===== NEW SECTION: Brand Performance ===== */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-cyan-100 flex items-center gap-2 mb-6">
              <ShoppingBag className="w-5 h-5 text-purple-400" />
              {language === 'zh' ? '合作品牌' : '取り扱いブランド'}
            </h3>
            {brandLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full bg-cyan-900/30 rounded-xl" />)}
              </div>
            ) : brandPerformance && brandPerformance.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {brandPerformance.map((brand, index) => (
                  <Link key={brand.brandId} href={`/master/brands/${brand.brandId}`}>
                    <div className={`bg-[#0a1520]/60 rounded-xl p-4 border transition-all hover:shadow-[0_0_15px_rgba(0,255,255,0.15)] cursor-pointer ${
                      index === 0 ? 'border-yellow-500/30 hover:border-yellow-400/50' : 'border-cyan-500/20 hover:border-cyan-400/40'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Crown className="w-4 h-4 text-yellow-400" />}
                          <span className="text-cyan-100 font-semibold text-sm">{brand.brandName || `Brand ${brand.brandId}`}</span>
                        </div>
                        <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
                          {brand.totalLivestreams}{language === 'zh' ? '场' : '回'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-cyan-500/60 text-xs mb-1">{language === 'zh' ? '总销售额' : '累計売上'}</p>
                          <p className="text-yellow-400 font-bold font-mono">{formatCurrency(brand.totalSales)}</p>
                        </div>
                        <div>
                          <p className="text-cyan-500/60 text-xs mb-1">{language === 'zh' ? '平均/场' : '平均/配信'}</p>
                          <p className="text-cyan-300 font-mono">{formatCurrency(brand.avgSalesPerStream)}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-cyan-500/50 text-center py-6">{language === 'zh' ? '暂无品牌数据' : 'ブランドデータがありません'}</p>
            )}
          </CardContent>
        </Card>

        {/* ===== NEW SECTION: Category Analysis ===== */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-cyan-100 flex items-center gap-2 mb-6">
              <Tag className="w-5 h-5 text-emerald-400" />
              {language === 'zh' ? '擅长品类分析' : '得意カテゴリ分析'}
            </h3>
            {categoryLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full bg-cyan-900/30 rounded-xl" />)}
              </div>
            ) : categoryAnalysis && categoryAnalysis.length > 0 ? (
              <div className="space-y-3">
                {categoryAnalysis.map((category, index) => {
                  const isOthers = category.category === 'その他';
                  const colors = [
                    'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
                    'from-purple-500/20 to-purple-600/10 border-purple-500/30',
                    'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
                    'from-blue-500/20 to-blue-600/10 border-blue-500/30',
                    'from-pink-500/20 to-pink-600/10 border-pink-500/30',
                    'from-orange-500/20 to-orange-600/10 border-orange-500/30',
                    'from-red-500/20 to-red-600/10 border-red-500/30',
                    'from-teal-500/20 to-teal-600/10 border-teal-500/30',
                  ];
                  const textColors = [
                    'text-yellow-400', 'text-purple-400', 'text-emerald-400', 'text-blue-400',
                    'text-pink-400', 'text-orange-400', 'text-red-400', 'text-teal-400',
                  ];
                  const colorClass = isOthers ? 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/10' : colors[index % colors.length];
                  const textColor = isOthers ? 'text-cyan-500/60' : textColors[index % textColors.length];
                  const isExpanded = expandedCategories[category.category] || false;
                  const displayProducts = isExpanded ? category.products : category.products.slice(0, 3);
                  
                  return (
                    <div key={category.category} className={`bg-gradient-to-r ${colorClass} rounded-xl p-4 border`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {index === 0 && !isOthers && <Medal className="w-4 h-4 text-yellow-400" />}
                          <span className={`font-semibold ${textColor}`}>{category.category}</span>
                          <Badge variant="outline" className={`text-xs ${textColor} border-current/30`}>
                            {category.percentage}%
                          </Badge>
                        </div>
                        <span className={`${isOthers ? 'text-cyan-500/60' : 'text-yellow-400'} font-bold font-mono text-sm`}>
                          {formatCurrency(category.gmv)}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full bg-[#0a0a1a]/60 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${isOthers ? 'bg-cyan-500/40' : index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-purple-400' : index === 2 ? 'bg-emerald-400' : 'bg-blue-400'}`}
                          style={{ width: `${Math.min(category.percentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-cyan-500/60">
                        <span>{category.productCount}{language === 'zh' ? '个商品' : '商品'}</span>
                        <span>{category.itemsSold.toLocaleString('ja-JP')}{language === 'zh' ? '件卖出' : '個販売'}</span>
                      </div>
                      {/* Product list with full names and GMV + category move */}
                      {category.products.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {/* Select all in this category */}
                          {category.products.length > 1 && (
                            <div className="flex items-center gap-2 text-xs px-2 py-1 text-cyan-500/60">
                              <Checkbox
                                id={`select-all-${category.category}`}
                                checked={category.products.every((p: { name: string }) => selectedProducts.has(p.name))}
                                onCheckedChange={() => toggleSelectAllInCategory(category.products)}
                                className="h-3.5 w-3.5 border-cyan-500/40 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                              />
                              <label htmlFor={`select-all-${category.category}`} className="cursor-pointer select-none">
                                {language === 'zh' ? '全选' : '全選択'}
                              </label>
                            </div>
                          )}
                          {displayProducts.map((product: { name: string; gmv: number }, i: number) => (
                            <div key={i} className={`flex items-center gap-1 text-xs py-1 px-2 rounded transition-colors group ${selectedProducts.has(product.name) ? 'bg-cyan-500/15 ring-1 ring-cyan-500/30' : 'bg-[#0a0a1a]/30 hover:bg-[#0a0a1a]/50'}`}>
                              <Checkbox
                                checked={selectedProducts.has(product.name)}
                                onCheckedChange={() => toggleProductSelection(product.name)}
                                className="h-3.5 w-3.5 shrink-0 border-cyan-500/40 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                              />
                              <span className="text-cyan-200/80 break-all flex-1">{product.name}</span>
                              <span className="text-cyan-400/60 font-mono whitespace-nowrap">{formatCurrency(product.gmv)}</span>
                              {/* Category move button */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-1 rounded hover:bg-cyan-500/20 text-cyan-400/60 hover:text-cyan-300 shrink-0"
                                    title={language === 'zh' ? '移动到其他分类' : 'カテゴリを変更'}
                                  >
                                    <MoveRight className="w-3.5 h-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-2 bg-[#0a1a2a] border-cyan-500/30" align="end">
                                  <div className="text-xs text-cyan-300 font-semibold mb-2 px-1">
                                    {language === 'zh' ? '移动到分类:' : 'カテゴリに移動:'}
                                  </div>
                                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                                    {allAvailableCategories
                                      .filter(c => c !== category.category)
                                      .map((cat) => (
                                        <button
                                          key={cat}
                                          onClick={() => handleMoveToCategory(product.name, cat)}
                                          disabled={upsertMappingMutation.isPending}
                                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-cyan-500/20 text-cyan-200/80 hover:text-cyan-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                          <Tag className="w-3 h-3 text-cyan-400/60" />
                                          {cat}
                                        </button>
                                      ))}
                                  </div>
                                  {/* New category creation */}
                                  <div className="border-t border-cyan-500/20 mt-2 pt-2">
                                    {showNewCategoryInput && categoryMoveTarget?.productName === product.name ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          value={newCategoryName}
                                          onChange={(e) => setNewCategoryName(e.target.value)}
                                          placeholder={language === 'zh' ? '新分类名' : '新カテゴリ名'}
                                          className="h-7 text-xs bg-[#0a0a1a]/60 border-cyan-500/30 text-cyan-200 placeholder:text-cyan-500/40"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateAndMove(product.name);
                                            if (e.key === 'Escape') { setShowNewCategoryInput(false); setCategoryMoveTarget(null); }
                                          }}
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleCreateAndMove(product.name)}
                                          disabled={!newCategoryName.trim() || upsertMappingMutation.isPending}
                                          className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-50"
                                        >
                                          {upsertMappingMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        <button
                                          onClick={() => { setShowNewCategoryInput(false); setCategoryMoveTarget(null); setNewCategoryName(""); }}
                                          className="p-1 rounded hover:bg-red-500/20 text-red-400"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setShowNewCategoryInput(true); setCategoryMoveTarget({ productName: product.name, currentCategory: category.category }); setNewCategoryName(""); }}
                                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-emerald-500/20 text-emerald-400/80 hover:text-emerald-300 transition-colors flex items-center gap-2"
                                      >
                                        <Plus className="w-3 h-3" />
                                        {language === 'zh' ? '新建分类' : '新規カテゴリ作成'}
                                      </button>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          ))}
                          {category.products.length > 3 && (
                            <button
                              onClick={() => setExpandedCategories(prev => ({ ...prev, [category.category]: !isExpanded }))}
                              className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 flex items-center gap-1 transition-colors"
                            >
                              {isExpanded ? (
                                <>{language === 'zh' ? '收起' : '閉じる'} <ChevronUp className="w-3 h-3" /></>
                              ) : (
                                <>{language === 'zh' ? `查看全部 (${category.products.length}个)` : `全て見る (${category.products.length}件)`} <ChevronDown className="w-3 h-3" /></>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-cyan-500/50 text-center py-6">{language === 'zh' ? '暂无分类数据' : 'カテゴリデータがありません'}</p>
            )}

          </CardContent>
        </Card>

        {/* Fixed bottom bulk move bar - always visible when products selected */}
        {selectedProducts.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-[#0a1a2a]/95 border-t border-cyan-500/30 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,200,255,0.15)]">
            <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-cyan-200 font-medium">
                  {selectedProducts.size}{language === 'zh' ? '个商品已选择' : '件選択中'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      disabled={bulkUpsertMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {bulkUpsertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoveRight className="w-4 h-4" />}
                      {language === 'zh' ? '一括移动到...' : '一括移動...'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 bg-[#0a1a2a] border-cyan-500/30" align="end" side="top">
                    <div className="text-xs text-cyan-300 font-semibold mb-2 px-1">
                      {language === 'zh'
                        ? `${selectedProducts.size}个商品を移动到:`
                        : `${selectedProducts.size}件の商品を移動先:`}
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {allAvailableCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleBulkMoveToCategory(cat)}
                          disabled={bulkUpsertMutation.isPending}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-cyan-500/20 text-cyan-200/80 hover:text-cyan-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <Tag className="w-3 h-3 text-cyan-400/60" />
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-cyan-500/20 mt-2 pt-2">
                      {showBulkNewCategoryInput ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={bulkNewCategoryName}
                            onChange={(e) => setBulkNewCategoryName(e.target.value)}
                            placeholder={language === 'zh' ? '新分类名' : '新カテゴリ名'}
                            className="h-7 text-xs bg-[#0a0a1a]/60 border-cyan-500/30 text-cyan-200 placeholder:text-cyan-500/40"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleBulkCreateAndMove();
                              if (e.key === 'Escape') { setShowBulkNewCategoryInput(false); setBulkNewCategoryName(""); }
                            }}
                            autoFocus
                          />
                          <button
                            onClick={handleBulkCreateAndMove}
                            disabled={!bulkNewCategoryName.trim() || bulkUpsertMutation.isPending}
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-50"
                          >
                            {bulkUpsertMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => { setShowBulkNewCategoryInput(false); setBulkNewCategoryName(""); }}
                            className="p-1 rounded hover:bg-red-500/20 text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setShowBulkNewCategoryInput(true); setBulkNewCategoryName(""); }}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-emerald-500/20 text-emerald-400/80 hover:text-emerald-300 transition-colors flex items-center gap-2"
                        >
                          <Plus className="w-3 h-3" />
                          {language === 'zh' ? '新建分类' : '新規カテゴリ作成'}
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <button
                  onClick={() => setSelectedProducts(new Set())}
                  className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/80 text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  {language === 'zh' ? '取消选择' : '選択解除'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* セット戦略分析 */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-cyan-100 flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-pink-400" />
              {tr.setStrategy}
            </h3>
            <p className="text-sm text-cyan-300/70 mb-6">{tr.setStrategyDesc}</p>

            {setAnalysisLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full bg-cyan-900/20" />
                <Skeleton className="h-20 w-full bg-cyan-900/20" />
              </div>
            ) : setAnalysis && setAnalysis.summary && setAnalysis.summary.totalSets > 0 ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[#0a1520]/60 border border-pink-500/20 text-center">
                    <div className="text-xs text-cyan-300/70 mb-1">{tr.totalSets}</div>
                    <div className="text-xl font-bold text-pink-400">{setAnalysis.summary.totalSets}<span className="text-sm font-normal">個</span></div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0a1520]/60 border border-emerald-500/20 text-center">
                    <div className="text-xs text-cyan-300/70 mb-1">{tr.totalSetRevenue}</div>
                    <div className="text-xl font-bold text-emerald-400">{formatCurrency(setAnalysis.summary.totalSetRevenue)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0a1520]/60 border border-orange-500/20 text-center">
                    <div className="text-xs text-cyan-300/70 mb-1">{tr.avgDiscount}</div>
                    <div className="text-xl font-bold text-orange-400">{Math.round(setAnalysis.summary.avgDiscountRate)}%<span className="text-sm font-normal">OFF</span></div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0a1520]/60 border border-cyan-500/20 text-center">
                    <div className="text-xs text-cyan-300/70 mb-1">{tr.avgQuantity}</div>
                    <div className="text-xl font-bold text-cyan-300">{setAnalysis.summary.avgQuantityPerSet.toFixed(1)}<span className="text-sm font-normal">個</span></div>
                  </div>
                </div>

                {/* Set List */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-cyan-300/60 text-xs">並び替え:</span>
                  <button
                    onClick={() => setSetsSortOrder('date')}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      setsSortOrder === 'date'
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                        : 'bg-cyan-500/10 text-cyan-300/60 border border-cyan-500/20 hover:text-cyan-200'
                    }`}
                  >
                    新着順
                  </button>
                  <button
                    onClick={() => setSetsSortOrder('revenue')}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      setsSortOrder === 'revenue'
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                        : 'bg-cyan-500/10 text-cyan-300/60 border border-cyan-500/20 hover:text-cyan-200'
                    }`}
                  >
                    売上順
                  </button>
                </div>
                <div className="space-y-3">
                  {[...setAnalysis.sets]
                    .sort((a: any, b: any) => {
                      if (setsSortOrder === 'date') {
                        const dateA = a.livestreamDate ? new Date(a.livestreamDate).getTime() : 0;
                        const dateB = b.livestreamDate ? new Date(b.livestreamDate).getTime() : 0;
                        return dateB - dateA;
                      }
                      return (b.totalRevenue || 0) - (a.totalRevenue || 0);
                    })
                    .map((set, index) => {
                    const isBest = index === 0 && setAnalysis.sets.length > 1;
                    const isPopular = setAnalysis.sets.length > 1 && 
                      set.quantitySold === Math.max(...setAnalysis.sets.map(s => s.quantitySold)) && 
                      index !== 0;
                    return (
                      <div
                        key={set.id}
                        className="rounded-xl bg-[#0a1520]/40 border border-cyan-500/10 hover:border-pink-400/20 transition-all overflow-hidden"
                      >
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedSetId(expandedSetId === set.id ? null : set.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-lg">📦</span>
                              <span className="text-cyan-100 font-semibold truncate">{set.setName}</span>
                              {set.discountRate != null && (
                                <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-xs shrink-0">
                                  {Math.round(Number(set.discountRate))}%OFF
                                </Badge>
                              )}
                              {isBest && (
                                <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs shrink-0">
                                  🏆 {tr.bestSet}
                                </Badge>
                              )}
                              {isPopular && (
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs shrink-0">
                                  🔥 {tr.popular}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm shrink-0">
                              <div className="text-center">
                                <div className="text-cyan-300/70 text-xs">{tr.setPrice}</div>
                                <div className="text-cyan-200 font-mono">{formatCurrency(set.setPrice)}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-cyan-300/70 text-xs">{tr.quantitySold}</div>
                                <div className="text-cyan-300 font-bold">{set.quantitySold}個</div>
                              </div>
                              <div className="text-center">
                                <div className="text-cyan-300/70 text-xs">{tr.setRevenue}</div>
                                <div className="text-emerald-400 font-mono font-bold">{formatCurrency(set.totalRevenue ?? 0)}</div>
                              </div>
                              {expandedSetId === set.id ? (
                                <ChevronUp className="w-4 h-4 text-cyan-300/60" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-cyan-300/60" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded: Set Contents */}
                        {expandedSetId === set.id && (
                          <div className="px-4 pb-4 border-t border-cyan-500/10">
                            <div className="pt-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Tag className="w-4 h-4 text-cyan-300/60" />
                                <span className="text-xs text-cyan-300/70">{tr.setContents}（{tr.originalTotal}: {formatCurrency(set.items.reduce((sum: number, item: any) => sum + item.originalPrice * (item.quantity || 1), 0))}）</span>
                              </div>
                              <div className="space-y-1">
                                {set.items.map((item: any, i: number) => (
                                  <div key={i} className="flex justify-between text-sm px-2 py-1 rounded bg-[#0a1520]/40">
                                    <span className="text-cyan-200">{item.productName}{(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ''}</span>
                                    <span className="text-cyan-500/70 font-mono">{formatCurrency(item.originalPrice)}{(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ''}</span>
                                  </div>
                                ))}
                              </div>
                              {set.livestreamDate && (
                                <div className="mt-2 text-xs text-cyan-300/60 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {tr.streamDate}: {new Date(set.livestreamDate).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* AIセット提案ボタン */}
                <div className="mt-4 pt-4 border-t border-cyan-500/10">
                  <button
                    onClick={() => aiSetSuggestionMutation.mutate({ liverId, liverName: liver?.name || '' })}
                    disabled={aiSetSuggestionMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium hover:from-purple-500/30 hover:to-pink-500/30 transition-all disabled:opacity-50"
                  >
                    {aiSetSuggestionMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> AI分析中...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> AIセット提案を取得</>
                    )}
                  </button>
                  {aiSetSuggestionMutation.data && (
                    <div className="mt-3 p-4 rounded-lg bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-300 font-medium text-sm">AIセット提案</span>
                        <span className="text-purple-300/50 text-xs">(分析セット数: {aiSetSuggestionMutation.data.analyzedSets})</span>
                      </div>
                      <div className="text-cyan-200/80 text-sm whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                        {aiSetSuggestionMutation.data.suggestion}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-cyan-300/60 text-center py-8">{tr.noSetData}</p>
            )}
          </CardContent>
        </Card>

        {/* ===== Credit & Sample Request Section ===== */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-cyan-100 flex items-center gap-2 mb-6">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              クレジット残高・サンプル請求履歴
            </h3>

            {/* Current Credit Summary */}
            {creditHistory && creditHistory.length > 0 ? (
              <div className="space-y-4">
                {/* Latest month credit card */}
                {(() => {
                  const latest = creditHistory[0];
                  const rankColors: Record<string, string> = {
                    none: 'border-gray-500/30',
                    silver: 'border-gray-300/50',
                    gold: 'border-yellow-500/50',
                    black: 'border-purple-500/50',
                  };
                  const rankLabels: Record<string, string> = {
                    none: 'ランクなし',
                    silver: 'SILVER',
                    gold: 'GOLD',
                    black: 'BLACK',
                  };
                  return (
                    <div className={`rounded-lg border ${rankColors[latest.rank] || 'border-cyan-500/30'} bg-cyan-900/20 p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-cyan-300 text-sm font-bold">{latest.month}</span>
                        <Badge className={`text-xs ${
                          latest.rank === 'black' ? 'bg-purple-600' :
                          latest.rank === 'gold' ? 'bg-yellow-600' :
                          latest.rank === 'silver' ? 'bg-gray-400 text-gray-900' :
                          'bg-gray-600'
                        }`}>
                          {rankLabels[latest.rank] || latest.rank}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-xs text-cyan-400">合計クレジット</div>
                          <div className="text-lg font-bold text-white">¥{Number(latest.totalCredit).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-cyan-400">使用済み</div>
                          <div className="text-lg font-bold text-orange-400">¥{Number(latest.usedCredit).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-cyan-400">残高</div>
                          <div className="text-lg font-bold text-green-400">¥{Number(latest.remainingCredit).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-3 text-xs text-cyan-300/70">
                        <div>配信: {latest.streamingHours}h → ¥{Number(latest.streamingCredit).toLocaleString()}</div>
                        <div>売上: ¥{Number(latest.monthlySales).toLocaleString()} → ¥{Number(latest.salesCredit).toLocaleString()}</div>
                        <div>ボーナス: ¥{Number(latest.rankBonus).toLocaleString()}</div>
                        <div>繰越: ¥{Number(latest.carryoverCredit).toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Credit History Table */}
                {creditHistory.length > 1 && (
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-cyan-500/30">
                          <th className="text-left py-2 px-2 text-cyan-400">月</th>
                          <th className="text-center py-2 px-2 text-cyan-400">ランク</th>
                          <th className="text-right py-2 px-2 text-cyan-400">合計</th>
                          <th className="text-right py-2 px-2 text-cyan-400">使用</th>
                          <th className="text-right py-2 px-2 text-cyan-400">残高</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creditHistory.slice(0, 6).map((c: any) => (
                          <tr key={c.month} className="border-b border-cyan-500/10">
                            <td className="py-2 px-2 text-cyan-100">{c.month}</td>
                            <td className="text-center py-2 px-2">
                              <Badge className={`text-[10px] ${
                                c.rank === 'black' ? 'bg-purple-600' :
                                c.rank === 'gold' ? 'bg-yellow-600' :
                                c.rank === 'silver' ? 'bg-gray-400 text-gray-900' :
                                'bg-gray-600'
                              }`}>{c.rank?.toUpperCase()}</Badge>
                            </td>
                            <td className="text-right py-2 px-2 text-white">¥{Number(c.totalCredit).toLocaleString()}</td>
                            <td className="text-right py-2 px-2 text-orange-400">¥{Number(c.usedCredit).toLocaleString()}</td>
                            <td className="text-right py-2 px-2 text-green-400">¥{Number(c.remainingCredit).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-cyan-300/60 text-center py-4">クレジットデータなし</p>
            )}

            {/* Sample Requests */}
            <div className="mt-6">
              <h4 className="text-sm font-bold text-cyan-200 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                サンプル請求履歴
              </h4>
              {sampleRequests && sampleRequests.length > 0 ? (
                <div className="space-y-2">
                  {sampleRequests.slice(0, 10).map((req: any) => {
                    const statusConfig: Record<string, { label: string; color: string }> = {
                      pending: { label: '審査待ち', color: 'bg-yellow-600' },
                      approved: { label: '承認済み', color: 'bg-green-600' },
                      rejected: { label: '却下', color: 'bg-red-600' },
                      shipped: { label: '発送済み', color: 'bg-blue-600' },
                      cancelled: { label: 'キャンセル', color: 'bg-gray-600' },
                    };
                    const sc = statusConfig[req.status] || { label: req.status, color: 'bg-gray-600' };
                    return (
                      <div key={req.id} className="flex items-center justify-between bg-cyan-900/20 rounded-lg p-3 border border-cyan-500/10">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-100 text-sm font-medium">#{req.id}</span>
                            <Badge className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                            <span className="text-cyan-400 text-xs">{req.month}</span>
                          </div>
                          <div className="text-xs text-cyan-300/60 mt-1">
                            {req.items?.map((i: any) => `${i.productName} x${i.quantity}`).join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-white">¥{Number(req.totalAmount).toLocaleString()}</div>
                          {Number(req.creditUsed) > 0 && (
                            <div className="text-[10px] text-cyan-400">クレジット: ¥{Number(req.creditUsed).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-cyan-300/60 text-center py-4">サンプル請求なし</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery History */}
        <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-cyan-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                {tr.deliveryHistory}
              </h3>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36 bg-cyan-900/20 border-cyan-500/30 text-cyan-100 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a1a2a] border-cyan-500/30">
                  {monthOptions.map((option) => (
                    <SelectItem 
                      key={option.value} 
                      value={option.value}
                      className="text-cyan-100 hover:bg-cyan-900/30 focus:bg-cyan-900/30"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyan-500/30">
                    <th className="text-left py-3 px-3 text-cyan-400">{tr.start}</th>
                    <th className="text-center py-3 px-3 text-cyan-500/50">-</th>
                    <th className="text-left py-3 px-3 text-cyan-400">{tr.end}</th>
                    <th className="text-center py-3 px-3 text-cyan-400">{tr.duration}</th>
                    <th className="text-right py-3 px-3 text-cyan-400">{tr.salesTotal}</th>
                    <th className="text-center py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {livestreamsLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8">
                        <Skeleton className="h-8 w-full bg-cyan-900/30" />
                      </td>
                    </tr>
                  ) : livestreamsToShow && livestreamsToShow.length > 0 ? (
                    livestreamsToShow.map((stream) => (
                      <tr key={stream.id} className="border-b border-cyan-500/10 hover:bg-cyan-900/20 transition-colors">
                        <td className="py-4 px-3 whitespace-pre-line text-xs text-cyan-100">
                          <div className="flex items-center gap-1">
                            {formatDate(stream.livestreamDate)}
                            {stream.productCsvImported !== 'yes' && (
                              <span title="商品別CSV未インポート">
                                <AlertTriangle className="w-3 h-3 text-orange-400" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-center py-4 px-3 text-cyan-500/50">-</td>
                        <td className="py-4 px-3 whitespace-pre-line text-xs text-cyan-100">
                          {stream.livestreamEndTime 
                            ? formatDate(stream.livestreamEndTime)
                            : "-"
                          }
                        </td>
                        <td className="text-center py-4 px-3 text-cyan-300 font-mono">
                          {stream.duration 
                            ? `${(stream.duration / 60).toFixed(1)}${tr.hours}`
                            : calculateDurationFromDates(stream.livestreamDate, stream.livestreamEndTime)
                          }
                        </td>
                        <td className="text-right py-4 px-3 text-yellow-400 font-bold">
                          {formatCurrency(stream.gmv || stream.salesAmount || 0)}
                        </td>
                        <td className="text-center py-4 px-3">
                          <Link href={`/livestreams/${stream.id}`}>
                            <Button 
                              size="sm" 
                              className="bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs px-4"
                            >
                              {tr.detail}
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-cyan-500/50">
                        {tr.noHistory}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {livestreams && livestreams.length > 10 && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/30 hover:border-cyan-400/50"
                >
                  {showAllHistory ? (
                    <>
                      {tr.viewLess} <ChevronUp className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      {tr.viewMore} <ChevronDown className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Back to List Button */}
        <div className="flex justify-center pt-4">
          <Link href="/master/livers-dashboard">
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-10 py-4 rounded-full shadow-[0_0_15px_rgba(0,255,255,0.3)]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {tr.backToList}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
