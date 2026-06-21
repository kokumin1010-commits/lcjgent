import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Flame,
  Clock,
  Trophy,
  Zap,
  Calendar,
  Star,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Check,
  X,
  Activity,
  BarChart3,
  Waves,
  Eye,
  Package,
  Timer,
} from "lucide-react";
import MegaChannelBanner from "@/components/MegaChannelBanner";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function getYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatYearMonthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  return `${year}年${parseInt(month)}月`;
}

function prevYearMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  const d = new Date(year, month - 2, 1);
  return getYearMonth(d);
}

function nextYearMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  const d = new Date(year, month, 1);
  return getYearMonth(d);
}

export default function LiverDashboard() {
  const [, navigate] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [liverId, setLiverId] = useState<number | null>(null);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [streamCountGoalInput, setStreamCountGoalInput] = useState("");
  
  // Month selection state
  const now = useMemo(() => new Date(), []);
  const currentYearMonthStr = useMemo(() => getYearMonth(now), [now]);
  const [selectedYearMonth, setSelectedYearMonth] = useState(currentYearMonthStr);
  
  const isCurrentMonth = selectedYearMonth === currentYearMonthStr;
  const isFutureMonth = selectedYearMonth > currentYearMonthStr;
  
  // Check authentication and get liverId
  useEffect(() => {
    const token = localStorage.getItem("liver_session_token");
    if (!token) {
      navigate("/liver/login");
      return;
    }
    setIsAuthenticated(true);
    // Decode liverId from token (JWT payload)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setLiverId(payload.liverId || payload.id || null);
    } catch {
      // fallback
    }
  }, [navigate]);
  
  // Fetch existing dashboard stats
  const { data: stats, isLoading, refetch } = trpc.liver.getDashboardStats.useQuery(
    { yearMonth: selectedYearMonth },
    { enabled: isAuthenticated }
  );

  // Fetch strategy data (GPM, rolling 7-day, etc.)
  const { data: strategy } = trpc.kgStrategy.getStrategyData.useQuery(
    { liverId: liverId || 0, yearMonth: selectedYearMonth },
    { enabled: isAuthenticated && !!liverId }
  );

  // Fetch big goal
  const { data: bigGoal } = trpc.kgStrategy.getBigGoal.useQuery(
    { liverId: liverId || 0 },
    { enabled: isAuthenticated && !!liverId }
  );

  // Fetch big goal progress
  const { data: bigGoalProgress } = trpc.kgStrategy.getBigGoalProgress.useQuery(
    { liverId: liverId || 0, targetMonth: bigGoal?.targetMonth || "2026-09" },
    { enabled: isAuthenticated && !!liverId && !!bigGoal }
  );

  // Fetch weekly top products (直近7日間売れ筋TOP10)
  const { data: weeklyTopProducts } = trpc.kgStrategy.getWeeklyTopProducts.useQuery(
    { liverId: liverId || 0 },
    { enabled: isAuthenticated && !!liverId }
  );
  
  // Set goal mutation
  const setGoalMutation = trpc.liver.setGoal.useMutation({
    onSuccess: () => {
      setIsEditingGoal(false);
      refetch();
    },
  });
  
  const handleSaveGoal = () => {
    const salesGoal = parseInt(goalInput.replace(/,/g, "")) || 0;
    const streamCountGoal = parseInt(streamCountGoalInput) || 0;
    
    setGoalMutation.mutate({
      yearMonth: selectedYearMonth,
      salesGoal,
      streamCountGoal,
    });
  };
  
  const handlePrevMonth = () => {
    setSelectedYearMonth(prevYearMonth(selectedYearMonth));
  };
  
  const handleNextMonth = () => {
    const next = nextYearMonth(selectedYearMonth);
    if (next <= currentYearMonthStr) {
      setSelectedYearMonth(next);
    }
  };
  
  const handleGoToCurrentMonth = () => {
    setSelectedYearMonth(currentYearMonthStr);
  };
  
  const formatCurrency = (amount: number) => {
    if (amount >= 100000000) return `¥${(amount / 100000000).toFixed(2)}億`;
    if (amount >= 10000000) return `¥${(amount / 10000).toFixed(0)}万`;
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyFull = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("ja-JP").format(num);
  };
  
  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }
  
  const salesProgress = stats?.progress?.salesProgress || 0;
  const salesGoal = stats?.goal?.salesGoal || 0;
  const currentSales = stats?.currentMonth?.sales || 0;
  const remainingSales = stats?.progress?.remainingSales || 0;
  const remainingDays = stats?.progress?.remainingDays || 0;
  const dailyPaceNeeded = stats?.progress?.dailyPaceNeeded || 0;
  
  // GPM trend chart data
  const gpmChartData = {
    labels: strategy?.gpmTrend?.map(d => {
      const parts = d.date.split("-");
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    }) || [],
    datasets: [
      {
        label: "GPM (¥/千曝光)",
        data: strategy?.gpmTrend?.map(d => d.gpm) || [],
        borderColor: "rgb(168, 85, 247)",
        backgroundColor: "rgba(168, 85, 247, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "rgb(168, 85, 247)",
      },
    ],
  };

  const gpmChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number } }) => `GPM: ¥${formatNumber(context.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: "#9ca3af" },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
      },
      x: {
        ticks: { color: "#9ca3af" },
        grid: { display: false },
      },
    },
  };

  // Chart data for past 6 months
  const chartData = {
    labels: stats?.past6Months?.map(m => {
      const [, month] = m.yearMonth.split("-");
      return `${parseInt(month)}月`;
    }) || [],
    datasets: [
      {
        label: "売上",
        data: stats?.past6Months?.map(m => m.sales) || [],
        backgroundColor: stats?.past6Months?.map(m => 
          m.yearMonth === selectedYearMonth 
            ? "rgba(239, 68, 68, 0.8)" 
            : "rgba(239, 68, 68, 0.4)"
        ) || [],
        borderColor: stats?.past6Months?.map(m => 
          m.yearMonth === selectedYearMonth 
            ? "rgb(239, 68, 68)" 
            : "rgba(239, 68, 68, 0.6)"
        ) || [],
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number } }) => formatCurrencyFull(context.parsed.y),
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => {
            const num = typeof value === 'string' ? parseFloat(value) : value;
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
            if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
            return num;
          },
          color: "#9ca3af",
        },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
      x: {
        ticks: { color: "#9ca3af" },
        grid: { display: false },
      },
    },
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/liver/mypage")}
            className="flex items-center gap-2 text-white hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>マイページ</span>
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            戦略コマンドセンター
          </h1>
          <div className="w-20" />
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 space-y-5">
        {/* Mega Channel Banner - hidden */}
        {/* <MegaChannelBanner /> */}

        {/* ===== BIG GOAL PROGRESS BAR ===== */}
        {bigGoal && (
          <Card className="bg-gradient-to-r from-amber-900/40 via-red-900/40 to-purple-900/40 border-amber-600/50 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
            <CardContent className="pt-4 pb-4 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-bold text-amber-300">{bigGoal.label}</span>
                </div>
                <span className="text-xs text-white/60">
                  {bigGoalProgress ? `${Math.round((bigGoalProgress.totalGmv / bigGoal.salesGoal) * 100)}%` : "---"}
                </span>
              </div>
              <div className="relative h-6 bg-gray-800/80 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 via-red-500 to-purple-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, bigGoalProgress ? (bigGoalProgress.totalGmv / bigGoal.salesGoal) * 100 : 0)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white drop-shadow-md">
                    {bigGoalProgress ? formatCurrency(bigGoalProgress.totalGmv) : "---"} / {formatCurrency(bigGoal.salesGoal)}
                  </span>
                </div>
              </div>
              {bigGoalProgress && bigGoalProgress.totalGmv < bigGoal.salesGoal && (
                <div className="text-xs text-white/50 mt-1 text-right">
                  残り {formatCurrency(bigGoal.salesGoal - bigGoalProgress.totalGmv)}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ===== STRATEGY KPI CARDS ===== */}
        {strategy && (
          <div className="grid grid-cols-3 gap-3">
            {/* GPM */}
            <Card className="bg-gradient-to-br from-purple-900/50 to-gray-800 border-purple-700/50">
              <CardContent className="pt-3 pb-3 px-3">
                <div className="flex items-center gap-1 mb-1">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[10px] text-purple-300">GPM</span>
                </div>
                <div className="text-lg font-bold text-purple-300">
                  ¥{formatNumber(strategy.summary.monthlyAvgGpm)}
                </div>
                <div className="text-[10px] text-white/40">千曝光あたり</div>
              </CardContent>
            </Card>

            {/* 滚動7天GMV */}
            <Card className="bg-gradient-to-br from-blue-900/50 to-gray-800 border-blue-700/50">
              <CardContent className="pt-3 pb-3 px-3">
                <div className="flex items-center gap-1 mb-1">
                  <Waves className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] text-blue-300">7天GMV</span>
                </div>
                <div className="text-lg font-bold text-blue-300">
                  {formatCurrency(strategy.rolling7Day.gmv)}
                </div>
                <div className="text-[10px] text-white/40">{strategy.rolling7Day.streamCount}配信</div>
              </CardContent>
            </Card>

            {/* 流量池 */}
            <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-600/50" style={{ borderColor: `${strategy.rolling7Day.trafficPool.color}50` }}>
              <CardContent className="pt-3 pb-3 px-3">
                <div className="flex items-center gap-1 mb-1">
                  <BarChart3 className="w-3.5 h-3.5" style={{ color: strategy.rolling7Day.trafficPool.color }} />
                  <span className="text-[10px]" style={{ color: strategy.rolling7Day.trafficPool.color }}>流量池</span>
                </div>
                <div className="text-sm font-bold" style={{ color: strategy.rolling7Day.trafficPool.color }}>
                  {strategy.rolling7Day.trafficPool.name}
                </div>
                {strategy.rolling7Day.trafficPool.amountToNext > 0 && (
                  <div className="text-[10px] text-white/40">
                    次まで{formatCurrency(strategy.rolling7Day.trafficPool.amountToNext)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Month Selector */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            className="text-white hover:text-white hover:bg-gray-800 rounded-full"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <button
            onClick={handleGoToCurrentMonth}
            className="min-w-[180px] text-center"
          >
            <div className="text-2xl font-bold text-white">
              {formatYearMonthLabel(selectedYearMonth)}
            </div>
            {!isCurrentMonth && (
              <div className="text-xs text-blue-400 mt-1">
                タップで今月に戻る
              </div>
            )}
            {isCurrentMonth && (
              <div className="text-xs text-green-400 mt-1 flex items-center justify-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                今月
              </div>
            )}
          </button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            disabled={isCurrentMonth || isFutureMonth}
            className="text-white hover:text-white hover:bg-gray-800 rounded-full disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
        
        {/* Goal Progress Card */}
        <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Target className="w-5 h-5 text-red-400" />
                {formatYearMonthLabel(selectedYearMonth)}のゴール進捗
              </CardTitle>
              {!isEditingGoal ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGoalInput(salesGoal.toString());
                    setStreamCountGoalInput((stats?.goal?.streamCountGoal || 0).toString());
                    setIsEditingGoal(true);
                  }}
                  className="text-white hover:text-white"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveGoal}
                    className="text-green-400 hover:text-green-300"
                    disabled={setGoalMutation.isPending}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingGoal(false)}
                    className="text-white hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditingGoal ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white mb-1 block">売上目標（円）</label>
                  <Input
                    type="text"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    placeholder="例: 15000000"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-white mb-1 block">配信回数目標</label>
                  <Input
                    type="number"
                    value={streamCountGoalInput}
                    onChange={(e) => setStreamCountGoalInput(e.target.value)}
                    placeholder="例: 20"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-sm text-white mb-1">目標</div>
                  <div className="text-2xl font-bold text-white">
                    {salesGoal > 0 ? formatCurrencyFull(salesGoal) : "未設定"}
                  </div>
                </div>
                
                {salesGoal > 0 && (
                  <>
                    <div className="relative">
                      <Progress 
                        value={Math.min(salesProgress, 100)} 
                        className="h-4 bg-gray-700"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-white drop-shadow-md">
                          {salesProgress}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm text-white">現在</div>
                      <div className="text-3xl font-bold text-red-400">
                        {formatCurrencyFull(currentSales)}
                      </div>
                    </div>
                    
                    {isCurrentMonth && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-sm text-white flex items-center justify-center gap-1">
                            <Flame className="w-4 h-4 text-orange-400" />
                            あと
                          </div>
                          <div className="text-lg font-bold text-orange-400">
                            {formatCurrencyFull(remainingSales)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-white flex items-center justify-center gap-1">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            残り{remainingDays}日
                          </div>
                          <div className="text-lg font-bold text-blue-400">
                            {formatCurrencyFull(dailyPaceNeeded)}/日
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!isCurrentMonth && salesGoal > 0 && (
                      <div className="text-center">
                        <div className="text-sm text-white">達成率</div>
                        <div className={`text-2xl font-bold ${salesProgress >= 100 ? "text-green-400" : "text-orange-400"}`}>
                          {salesProgress >= 100 ? "🎉 目標達成！" : `${salesProgress}% (残り ${formatCurrencyFull(remainingSales)})`}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ===== GPM TREND CHART ===== */}
        {strategy && strategy.gpmTrend.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Activity className="w-5 h-5 text-purple-400" />
                GPM推移（{formatYearMonthLabel(selectedYearMonth)}）
              </CardTitle>
              <div className="text-xs text-white/50">
                GPM = GMV / 曝光数 × 1000（千次曝光あたりの売上）
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <Line data={gpmChartData} options={gpmChartOptions as any} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== WEEKLY TOP 10 PRODUCTS ===== */}
        {weeklyTopProducts && weeklyTopProducts.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Flame className="w-5 h-5 text-orange-400" />
                直近7日間 売れ筋TOP10
              </CardTitle>
              <div className="text-xs text-white/50">
                配信前に「次何を出すべきか」即判断
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-2 text-[10px] text-white/40 border-b border-gray-700 pb-1 px-1">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5">商品名</div>
                  <div className="col-span-2 text-right">GMV</div>
                  <div className="col-span-2 text-right">販売数</div>
                  <div className="col-span-2 text-right">実売単価</div>
                </div>
                {weeklyTopProducts.map((product, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center py-1.5 px-1 rounded hover:bg-gray-700/30">
                    <div className="col-span-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        index === 0 ? "bg-amber-500 text-black" :
                        index === 1 ? "bg-gray-400 text-black" :
                        index === 2 ? "bg-amber-700 text-white" :
                        "bg-gray-700 text-white"
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="col-span-5 min-w-0">
                      <div className="text-xs font-medium truncate text-white">{product.productName}</div>
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-xs font-bold text-red-400">{formatCurrency(product.totalGmv)}</div>
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-xs text-white/70">{formatNumber(product.totalItemsSold)}個</div>
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-xs text-emerald-400">¥{formatNumber(product.avgUnitPrice)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== STREAM HISTORY WITH GPM ===== */}
        {strategy && strategy.streams.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-green-400" />
                配信履歴（{formatYearMonthLabel(selectedYearMonth)}）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {strategy.streams.map((stream) => {
                const streamDate = new Date(stream.livestreamDate);
                const jstDate = new Date(streamDate.getTime() + 9 * 60 * 60 * 1000);
                const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
                const dayOfWeek = dayNames[jstDate.getUTCDay()];
                const month = jstDate.getUTCMonth() + 1;
                const day = jstDate.getUTCDate();
                
                // Format time
                const startTime = stream.livestreamStartTime 
                  ? new Date(stream.livestreamStartTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })
                  : `${jstDate.getUTCHours()}:${String(jstDate.getUTCMinutes()).padStart(2, "0")}`;
                const endTime = stream.livestreamEndTime
                  ? new Date(stream.livestreamEndTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })
                  : "";
                
                const gmv = Number(stream.gmv || stream.salesAmount || 0);
                const duration = Number(stream.duration || 0);
                const durationHours = duration > 0 ? (duration / 60).toFixed(1) : "---";
                const viewers = Number(stream.viewerCount || 0);
                
                return (
                  <div 
                    key={stream.id}
                    className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      {/* Left: Date + Time */}
                      <div className="flex items-start gap-3">
                        <div className="text-center bg-gray-800 rounded-lg px-2.5 py-1.5 min-w-[50px]">
                          <div className="text-lg font-bold text-white">{month}/{day}</div>
                          <div className="text-xs text-white/60">{dayOfWeek}</div>
                        </div>
                        <div>
                          <div className="text-sm text-white/80">
                            {startTime}{endTime ? ` - ${endTime}` : ""}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                            <span className="flex items-center gap-1">
                              <Timer className="w-3 h-3" />{durationHours}h
                            </span>
                            {viewers > 0 && (
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />{formatNumber(viewers)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Right: GMV + GPM */}
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">
                          {formatCurrencyFull(gmv)}
                        </div>
                        {stream.gpm > 0 && (
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
                              GPM ¥{formatNumber(stream.gpm)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
        
        {/* ===== PRODUCT GPM RANKING ===== */}
        {strategy && strategy.productGpm.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Package className="w-5 h-5 text-amber-400" />
                商品別GPMランキング（{formatYearMonthLabel(selectedYearMonth)}）
              </CardTitle>
              <div className="text-xs text-white/50">
                GPMが高い商品 = 少ない曝光で多く売れる効率的な商品
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {strategy.productGpm.map((product, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? "bg-amber-500 text-black" :
                      index === 1 ? "bg-gray-400 text-black" :
                      index === 2 ? "bg-amber-700 text-white" :
                      "bg-gray-700 text-white"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-white">{product.productName}</div>
                      <div className="text-xs text-white/40">
                        売上: {formatCurrency(product.totalGmv)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-purple-300">
                        GPM ¥{formatNumber(product.gpm)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== HOURLY GPM HEATMAP ===== */}
        {strategy && strategy.hourlyGpm.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-cyan-400" />
                時間帯別GPM（{formatYearMonthLabel(selectedYearMonth)}）
              </CardTitle>
              <div className="text-xs text-white/50">
                GPMが高い時間帯 = 流量池が活発な時間
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {strategy.hourlyGpm
                  .sort((a, b) => b.gpm - a.gpm)
                  .map((h, idx) => {
                    const maxGpm = Math.max(...strategy.hourlyGpm.map(x => x.gpm));
                    const intensity = maxGpm > 0 ? h.gpm / maxGpm : 0;
                    return (
                      <div
                        key={h.hour}
                        className="rounded-lg p-2 text-center border border-gray-700/50"
                        style={{
                          backgroundColor: `rgba(168, 85, 247, ${0.1 + intensity * 0.5})`,
                          borderColor: idx === 0 ? "rgba(168, 85, 247, 0.8)" : undefined,
                        }}
                      >
                        <div className="text-xs text-white/60">{h.hour}時</div>
                        <div className="text-sm font-bold text-white">¥{formatNumber(h.gpm)}</div>
                        <div className="text-[10px] text-white/40">{h.count}回</div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Growth Tracker */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/70">売上</span>
                {(stats?.growth?.salesGrowth || 0) >= 0 ? (
                  <ChevronUp className="w-5 h-5 text-green-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className={`text-2xl font-bold ${(stats?.growth?.salesGrowth || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(stats?.growth?.salesGrowth || 0) >= 0 ? "+" : ""}{stats?.growth?.salesGrowth || 0}%
              </div>
              <div className="text-xs text-white/50">前月比</div>
              <div className="text-xs text-white/40 mt-1">
                {formatYearMonthLabel(selectedYearMonth)}: {formatCurrencyFull(currentSales)}
              </div>
              <div className="text-xs text-white/30">
                {formatYearMonthLabel(prevYearMonth(selectedYearMonth))}: {formatCurrencyFull(stats?.previousMonth?.sales || 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/70">配信数</span>
                {(stats?.growth?.streamCountGrowth || 0) >= 0 ? (
                  <ChevronUp className="w-5 h-5 text-green-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className={`text-2xl font-bold ${(stats?.growth?.streamCountGrowth || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(stats?.growth?.streamCountGrowth || 0) >= 0 ? "+" : ""}{stats?.growth?.streamCountGrowth || 0}%
              </div>
              <div className="text-xs text-white/50">前月比</div>
              <div className="text-xs text-white/40 mt-1">
                {formatYearMonthLabel(selectedYearMonth)}: {stats?.currentMonth?.streamCount || 0}回
              </div>
              <div className="text-xs text-white/30">
                {formatYearMonthLabel(prevYearMonth(selectedYearMonth))}: {stats?.previousMonth?.streamCount || 0}回
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Sales Trend Chart */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-red-400" />
              売上推移（過去6ヶ月）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar data={chartData} options={chartOptions as any} />
            </div>
          </CardContent>
        </Card>
        
        {/* Top Products */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Trophy className="w-5 h-5 text-yellow-400" />
              売れ筋TOP5（{formatYearMonthLabel(selectedYearMonth)}）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topProducts && stats.topProducts.length > 0 ? (
              <div className="space-y-3">
                {stats.topProducts.map((product, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? "bg-yellow-500 text-black" :
                      index === 1 ? "bg-gray-400 text-black" :
                      index === 2 ? "bg-amber-600 text-white" :
                      "bg-gray-700 text-white"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-white">{product.productName}</div>
                    </div>
                    <div className="text-sm font-bold text-red-400">
                      {formatCurrencyFull(product.totalSales || 0)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-white py-4">
                {formatYearMonthLabel(selectedYearMonth)}のデータがありません
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Highlights */}
        <Card className="bg-gradient-to-br from-yellow-900/30 to-gray-800 border-yellow-700/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Star className="w-5 h-5 text-yellow-400" />
              {formatYearMonthLabel(selectedYearMonth)}のハイライト
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.highlights?.bestStream && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <div className="text-sm text-white/70">最高売上配信</div>
                  <div className="font-bold">
                    <span className="text-white">{new Date(stats.highlights.bestStream.date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} - {formatCurrencyFull(stats.highlights.bestStream.sales || 0)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {stats?.highlights?.consecutiveDays && stats.highlights.consecutiveDays > 1 && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <div className="text-sm text-white/70">連続配信記録</div>
                  <div className="font-bold text-white">{stats.highlights.consecutiveDays}日連続！</div>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-sm text-white/70">{formatYearMonthLabel(selectedYearMonth)}の配信回数</div>
                <div className="font-bold text-white">{stats?.currentMonth?.streamCount || 0}回</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-sm text-white/70">{formatYearMonthLabel(selectedYearMonth)}の配信時間</div>
                <div className="font-bold text-white">{((stats?.currentMonth?.duration || 0) / 60).toFixed(1)}時間</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
