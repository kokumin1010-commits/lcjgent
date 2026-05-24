/**
 * ライバー成長グラフ（ポートフォリオ）コンポーネント
 * 
 * 月別の売上推移・時間単価成長曲線・ブランド別実績を可視化
 * 「LCJに入って3ヶ月で時間単価が2.3倍になった」が一目でわかる
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, BarChart3, Award, Calendar } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";

interface LivestreamRecord {
  livestreamDate: string | Date;
  livestreamEndTime?: string | Date | null;
  salesAmount?: number | null;
  gmv?: number | null;
  duration?: number | null;
  viewerCount?: number | null;
  orderCount?: number | null;
  brandName?: string | null;
}

interface GrowthChartProps {
  livestreams: LivestreamRecord[] | undefined;
  liverName: string;
  joinDate?: string | null; // LCJ参加日
}

interface MonthlyData {
  month: string; // "2026-01" format
  label: string; // "1月" format
  sales: number;
  hourlyRate: number;
  streamCount: number;
  totalHours: number;
  avgViewers: number;
}

interface BrandMonthlyData {
  month: string;
  label: string;
  [brandName: string]: string | number; // dynamic brand columns
}

export function LiverGrowthChart({ livestreams, liverName, joinDate }: GrowthChartProps) {
  const [chartView, setChartView] = useState<'sales' | 'hourlyRate' | 'brand'>('sales');

  // 月別データを集計
  const monthlyData = useMemo(() => {
    if (!livestreams || livestreams.length === 0) return [];

    const monthMap = new Map<string, { sales: number; hours: number; count: number; viewers: number }>();

    livestreams.forEach((ls) => {
      const date = new Date(ls.livestreamDate);
      const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
      const monthKey = `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}`;

      const existing = monthMap.get(monthKey) || { sales: 0, hours: 0, count: 0, viewers: 0 };
      const sales = Number(ls.salesAmount) || Number(ls.gmv) || 0;
      
      let hours = 0;
      if (ls.livestreamDate && ls.livestreamEndTime) {
        const start = new Date(ls.livestreamDate).getTime();
        const end = new Date(ls.livestreamEndTime).getTime();
        let diffMs = end - start;
        if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
        hours = diffMs / (1000 * 60 * 60);
        if (hours > 24) hours = 0;
      } else if (ls.duration && Number(ls.duration) > 0) {
        hours = Number(ls.duration) / 60;
      }

      existing.sales += sales;
      existing.hours += hours;
      existing.count += 1;
      existing.viewers += Number(ls.viewerCount) || 0;
      monthMap.set(monthKey, existing);
    });

    // Sort by month and convert to array
    const sorted = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12); // Last 12 months

    return sorted.map(([month, data]): MonthlyData => {
      const [, m] = month.split('-');
      return {
        month,
        label: `${parseInt(m)}月`,
        sales: Math.round(data.sales),
        hourlyRate: data.hours > 0 ? Math.round(data.sales / data.hours) : 0,
        streamCount: data.count,
        totalHours: Math.round(data.hours * 10) / 10,
        avgViewers: data.count > 0 ? Math.round(data.viewers / data.count) : 0,
      };
    });
  }, [livestreams]);

  // ブランド別月別データ
  const brandMonthlyData = useMemo(() => {
    if (!livestreams || livestreams.length === 0) return { data: [], brands: [] };

    const brandMonthMap = new Map<string, Map<string, number>>();
    const allBrands = new Set<string>();

    livestreams.forEach((ls) => {
      const brand = ls.brandName || '不明';
      allBrands.add(brand);
      const date = new Date(ls.livestreamDate);
      const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
      const monthKey = `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}`;
      const sales = Number(ls.salesAmount) || Number(ls.gmv) || 0;

      if (!brandMonthMap.has(monthKey)) {
        brandMonthMap.set(monthKey, new Map());
      }
      const monthBrands = brandMonthMap.get(monthKey)!;
      monthBrands.set(brand, (monthBrands.get(brand) || 0) + sales);
    });

    const sorted = Array.from(brandMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6); // Last 6 months for brand view

    // Get top 5 brands by total sales
    const brandTotals = new Map<string, number>();
    sorted.forEach(([, brands]) => {
      brands.forEach((sales, brand) => {
        brandTotals.set(brand, (brandTotals.get(brand) || 0) + sales);
      });
    });
    const topBrands = Array.from(brandTotals.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);

    const data = sorted.map(([month, brands]) => {
      const [, m] = month.split('-');
      const row: BrandMonthlyData = { month, label: `${parseInt(m)}月` };
      topBrands.forEach(brand => {
        row[brand] = brands.get(brand) || 0;
      });
      return row;
    });

    return { data, brands: topBrands };
  }, [livestreams]);

  // 成長率計算
  const growthStats = useMemo(() => {
    if (monthlyData.length < 2) return null;

    const first = monthlyData[0];
    const last = monthlyData[monthlyData.length - 1];
    const prev = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : first;

    const salesGrowth = first.sales > 0 ? ((last.sales - first.sales) / first.sales * 100) : 0;
    const hourlyRateGrowth = first.hourlyRate > 0 ? ((last.hourlyRate - first.hourlyRate) / first.hourlyRate * 100) : 0;
    const monthsActive = monthlyData.length;

    // 最高記録
    const bestSalesMonth = monthlyData.reduce((best, m) => m.sales > best.sales ? m : best, monthlyData[0]);
    const bestHourlyMonth = monthlyData.reduce((best, m) => m.hourlyRate > best.hourlyRate ? m : best, monthlyData[0]);

    return {
      salesGrowth: Math.round(salesGrowth),
      hourlyRateGrowth: Math.round(hourlyRateGrowth),
      monthsActive,
      currentHourlyRate: last.hourlyRate,
      firstHourlyRate: first.hourlyRate,
      bestSalesMonth,
      bestHourlyMonth,
      momSalesGrowth: prev.sales > 0 ? Math.round(((last.sales - prev.sales) / prev.sales) * 100) : 0,
    };
  }, [monthlyData]);

  if (!livestreams || livestreams.length === 0 || monthlyData.length === 0) {
    return null;
  }

  const BRAND_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#06b6d4'];

  const formatYen = (value: number) => {
    if (value >= 1000000) return `¥${(value / 1000000).toFixed(1)}M`;
    if (value >= 10000) return `¥${(value / 10000).toFixed(0)}万`;
    return `¥${value.toLocaleString()}`;
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border-gray-700/50 overflow-hidden">
      <CardContent className="p-4">
        {/* Header with growth badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-white text-lg">成長ポートフォリオ</h3>
          </div>
          {growthStats && growthStats.hourlyRateGrowth > 0 && (
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 py-1">
              <span className="text-emerald-400 text-xs font-bold">
                時間単価 +{growthStats.hourlyRateGrowth}% 成長
              </span>
            </div>
          )}
        </div>

        {/* Growth Summary Cards */}
        {growthStats && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">活動期間</div>
              <div className="text-white font-bold text-sm">{growthStats.monthsActive}ヶ月</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">時間単価</div>
              <div className="text-emerald-400 font-bold text-sm">
                ¥{growthStats.currentHourlyRate.toLocaleString()}/h
              </div>
              {growthStats.firstHourlyRate > 0 && (
                <div className="text-[10px] text-gray-500">
                  初月 ¥{growthStats.firstHourlyRate.toLocaleString()}/h
                </div>
              )}
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">最高売上月</div>
              <div className="text-amber-400 font-bold text-sm">
                {formatYen(growthStats.bestSalesMonth.sales)}
              </div>
              <div className="text-[10px] text-gray-500">{growthStats.bestSalesMonth.label}</div>
            </div>
          </div>
        )}

        {/* Chart Toggle */}
        <div className="flex gap-1 mb-3 bg-gray-800/60 rounded-lg p-1">
          <button
            onClick={() => setChartView('sales')}
            className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-all ${
              chartView === 'sales'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            売上推移
          </button>
          <button
            onClick={() => setChartView('hourlyRate')}
            className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-all ${
              chartView === 'hourlyRate'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            時間単価
          </button>
          <button
            onClick={() => setChartView('brand')}
            className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-all ${
              chartView === 'brand'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ブランド別
          </button>
        </div>

        {/* Charts */}
        <div className="h-48">
          {chartView === 'sales' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={formatYen} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '売上']}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {chartView === 'hourlyRate' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={formatYen} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [`¥${value.toLocaleString()}/h`, '時間単価']}
                />
                <Line
                  type="monotone"
                  dataKey="hourlyRate"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {chartView === 'brand' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brandMonthlyData.data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={formatYen} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {brandMonthlyData.brands.map((brand, i) => (
                  <Bar
                    key={brand}
                    dataKey={brand}
                    stackId="a"
                    fill={BRAND_COLORS[i % BRAND_COLORS.length]}
                    radius={i === brandMonthlyData.brands.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Growth milestone message */}
        {growthStats && growthStats.hourlyRateGrowth > 0 && (
          <div className="mt-3 bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border border-emerald-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-gray-300">
                LCJで活動{growthStats.monthsActive}ヶ月で時間単価が
                <span className="text-emerald-400 font-bold">
                  {growthStats.firstHourlyRate > 0 
                    ? `${(growthStats.currentHourlyRate / growthStats.firstHourlyRate).toFixed(1)}倍`
                    : `¥${growthStats.currentHourlyRate.toLocaleString()}/h`
                  }
                </span>
                に成長！
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
