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
import { ArrowLeft, Edit, Home, ChevronDown, ChevronUp, ExternalLink, AlertTriangle, TrendingUp, Clock, DollarSign, Activity, Calendar, ArrowUpRight, ArrowDownRight, Sparkles, BarChart3 } from "lucide-react";
import { SiTiktok, SiInstagram, SiYoutube } from "react-icons/si";
import { Link2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  
  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    return options;
  }, []);
  
  // Previous month for comparison
  const previousMonth = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  const { data: liver, isLoading: liverLoading } = trpc.liverManagement.getById.useQuery({
    id: liverId,
    month: selectedMonth,
  });
  
  const { data: previousStats } = trpc.liverManagement.getById.useQuery({
    id: liverId,
    month: previousMonth,
  });
  
  const { data: livestreams, isLoading: livestreamsLoading } = trpc.liverManagement.getLivestreams.useQuery({
    liverId,
    month: selectedMonth,
  });
  
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
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };
  
  const formatDuration = (minutes: number) => {
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
  };
  
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    const year = jstDate.getUTCFullYear();
    const month = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(jstDate.getUTCDate()).padStart(2, "0");
    const weekday = ["日", "月", "火", "水", "木", "金", "土"][jstDate.getUTCDay()];
    const hours = String(jstDate.getUTCHours()).padStart(2, "0");
    const mins = String(jstDate.getUTCMinutes()).padStart(2, "0");
    return `${year}/${month}/${day}(${weekday})\n${hours}:${mins}`;
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
        
        {/* Stats Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Previous Month */}
          <Card className="bg-[#0a1a2a]/80 border-cyan-500/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <h3 className="text-sm text-cyan-500/60 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {tr.prevMonth}（{previousMonth.replace("-", "年")}月）
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
                {tr.currentMonth}（{monthOptions.find(m => m.value === selectedMonth)?.label}）
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
        
        {/* Record Button */}
        <div className="flex justify-center">
          <Link href={`/livers/${liverId}/record`}>
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-10 py-6 text-lg rounded-full shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all hover:shadow-[0_0_30px_rgba(0,255,255,0.5)]">
              <Activity className="w-5 h-5 mr-2" />
              {tr.recordStream}
            </Button>
          </Link>
        </div>
        
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
