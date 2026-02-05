import { useState, useEffect } from "react";
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
  Edit2,
  Check,
  X
} from "lucide-react";
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
  Legend
);

export default function LiverDashboard() {
  const [, navigate] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [streamCountGoalInput, setStreamCountGoalInput] = useState("");
  
  // Get current year-month
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  
  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem("liver_session_token");
    if (!token) {
      navigate("/liver/login");
      return;
    }
    setIsAuthenticated(true);
  }, [navigate]);
  
  // Fetch dashboard stats
  const { data: stats, isLoading, refetch } = trpc.liver.getDashboardStats.useQuery(
    { yearMonth: currentYearMonth },
    { enabled: isAuthenticated }
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
      yearMonth: currentYearMonth,
      salesGoal,
      streamCountGoal,
    });
  };
  
  const formatCurrency = (amount: number) => {
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
  
  // Chart data for past 6 months
  const chartData = {
    labels: stats?.past6Months?.map(m => {
      const [year, month] = m.yearMonth.split("-");
      return `${month}月`;
    }) || [],
    datasets: [
      {
        label: "売上",
        data: stats?.past6Months?.map(m => m.sales) || [],
        backgroundColor: "rgba(239, 68, 68, 0.5)",
        borderColor: "rgb(239, 68, 68)",
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number } }) => formatCurrency(context.parsed.y),
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
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
      },
      x: {
        ticks: {
          color: "#9ca3af",
        },
        grid: {
          display: false,
        },
      },
    },
  };
  
  // Hourly stats chart
  const hourlyChartData = {
    labels: stats?.hourlyStats?.map(h => `${h.hour}時`) || [],
    datasets: [
      {
        label: "売上/分",
        data: stats?.hourlyStats?.map(h => h.count > 0 ? Math.round(h.sales / h.count / 60) : 0) || [],
        backgroundColor: "rgba(34, 197, 94, 0.5)",
        borderColor: "rgb(34, 197, 94)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/liver/mypage")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>マイページ</span>
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            パワーダッシュボード
          </h1>
          <div className="w-20" />
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Goal Progress Card */}
        <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Target className="w-5 h-5 text-red-400" />
                今月のゴール進捗
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
                  className="text-gray-400 hover:text-white"
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
                    className="text-gray-400 hover:text-white"
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
                  <label className="text-sm text-gray-400 mb-1 block">売上目標（円）</label>
                  <Input
                    type="text"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    placeholder="例: 15000000"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">配信回数目標</label>
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
                  <div className="text-sm text-gray-400 mb-1">目標</div>
                  <div className="text-2xl font-bold text-white">
                    {salesGoal > 0 ? formatCurrency(salesGoal) : "未設定"}
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
                      <div className="text-sm text-gray-400">現在</div>
                      <div className="text-3xl font-bold text-red-400">
                        {formatCurrency(currentSales)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                      <div className="text-center">
                        <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
                          <Flame className="w-4 h-4 text-orange-400" />
                          あと
                        </div>
                        <div className="text-lg font-bold text-orange-400">
                          {formatCurrency(remainingSales)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          残り{remainingDays}日
                        </div>
                        <div className="text-lg font-bold text-blue-400">
                          {formatCurrency(dailyPaceNeeded)}/日
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
        
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
              売れ筋TOP5
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
                      "bg-gray-700 text-gray-300"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-white">{product.productName}</div>
                    </div>
                    <div className="text-sm font-bold text-red-400">
                      {formatCurrency(product.totalSales || 0)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                データがありません
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Best Hour */}
        {stats?.bestHour && (
          <Card className="bg-gradient-to-br from-green-900/50 to-gray-800 border-green-700/50">
            <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-green-400" />
              ゴールデンタイム発見！
            </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-400 mb-2">
                  {stats.bestHour.hour}:00 〜 {stats.bestHour.hour + 1}:00
                </div>
                <div className="text-sm text-gray-400">
                  この時間帯の配信が最も売上が高い！
                </div>
                <div className="text-lg font-bold text-white mt-2">
                  平均売上: {formatCurrency(stats.bestHour.count > 0 ? Math.round(stats.bestHour.sales / stats.bestHour.count) : 0)}/配信
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Hourly Stats Chart */}
        {stats?.hourlyStats && stats.hourlyStats.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-green-400" />
              時間帯別売上効率
            </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <Line data={hourlyChartData} options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                      callbacks: {
                        label: (context: { parsed: { y: number } }) => `${formatCurrency(context.parsed.y)}/分`,
                      },
                    },
                  },
                } as any} />
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Highlights */}
        <Card className="bg-gradient-to-br from-yellow-900/30 to-gray-800 border-yellow-700/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Star className="w-5 h-5 text-yellow-400" />
              今月のハイライト
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
                    <span className="text-white">{new Date(stats.highlights.bestStream.date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} - {formatCurrency(stats.highlights.bestStream.sales || 0)}</span>
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
                <div className="text-sm text-white/70">今月の配信回数</div>
                <div className="font-bold text-white">{stats?.currentMonth?.streamCount || 0}回</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-sm text-white/70">今月の配信時間</div>
                <div className="font-bold text-white">{((stats?.currentMonth?.duration || 0) / 60).toFixed(1)}時間</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
