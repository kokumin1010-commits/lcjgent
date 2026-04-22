/**
 * 業績統計パネル - 招商担当者別の業績統計を表示
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Trophy,
  ArrowUpDown,
} from "lucide-react";

export function PerformanceStatsPanel() {
  // Period selector: compute dateFrom/dateTo
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "all">("all");

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "all") return { dateFrom: undefined, dateTo: undefined };
    const dateTo = now.toISOString().split("T")[0];
    if (period === "week") {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { dateFrom: d.toISOString().split("T")[0], dateTo };
    }
    if (period === "month") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: d.toISOString().split("T")[0], dateTo };
    }
    // quarter
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    const d = new Date(now.getFullYear(), qMonth, 1);
    return { dateFrom: d.toISOString().split("T")[0], dateTo };
  }, [period]);

  const { data: stats, isLoading } = trpc.recruitment.getPerformanceStats.useQuery(dateRange);
  const [sortField, setSortField] = useState<string>("totalBrands");
  const [sortAsc, setSortAsc] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-400">加载业绩统计...</span>
      </div>
    );
  }

  const staffStats = stats || [];

  // Compute overall
  const overall = staffStats.reduce(
    (acc: any, s: any) => ({
      totalBrands: acc.totalBrands + s.totalBrands,
      cooperating: acc.cooperating + s.cooperating,
      agreed: acc.agreed + s.agreed,
      rejected: acc.rejected + s.rejected,
      followRecords: acc.followRecords + s.followRecords,
    }),
    { totalBrands: 0, cooperating: 0, agreed: 0, rejected: 0, followRecords: 0 }
  );
  const conversionRate = overall.totalBrands > 0 ? Math.round((overall.cooperating / overall.totalBrands) * 100) : 0;

  // Sort
  const sorted = [...staffStats].sort((a: any, b: any) => {
    const av = a[sortField] ?? 0;
    const bv = b[sortField] ?? 0;
    return sortAsc ? av - bv : bv - av;
  });

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">统计周期:</span>
        {[
          { key: "week", label: "本周" },
          { key: "month", label: "本月" },
          { key: "quarter", label: "本季度" },
          { key: "all", label: "全部" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === key ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 border border-purple-500/30 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">总品牌数</div>
          <div className="text-2xl font-bold text-purple-400">{overall.totalBrands}</div>
        </div>
        <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 border border-green-500/30 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">合作中</div>
          <div className="text-2xl font-bold text-green-400">{overall.cooperating}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 border border-blue-500/30 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">已同意</div>
          <div className="text-2xl font-bold text-blue-400">{overall.agreed}</div>
        </div>
        <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border border-yellow-500/30 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">转化率</div>
          <div className="text-2xl font-bold text-yellow-400">{conversionRate}%</div>
        </div>
        <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-700/20 border border-cyan-500/30 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">跟进记录</div>
          <div className="text-2xl font-bold text-cyan-400">{overall.followRecords}</div>
        </div>
      </div>

      {/* Staff Performance Table */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
        <div className="p-4 border-b border-gray-800/50 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-sm font-bold text-white">负责人业绩排行</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/30 text-gray-400 text-xs">
              <th className="p-3 text-left">排名</th>
              <th className="p-3 text-left">负责人</th>
              <th className="p-3 text-center cursor-pointer hover:text-white" onClick={() => handleSort("totalBrands")}>
                <span className="flex items-center justify-center gap-1">总品牌 <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="p-3 text-center cursor-pointer hover:text-white" onClick={() => handleSort("cooperating")}>
                <span className="flex items-center justify-center gap-1">合作 <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="p-3 text-center cursor-pointer hover:text-white" onClick={() => handleSort("agreed")}>
                <span className="flex items-center justify-center gap-1">同意 <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="p-3 text-center cursor-pointer hover:text-white" onClick={() => handleSort("rejected")}>
                <span className="flex items-center justify-center gap-1">拒绝 <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="p-3 text-center cursor-pointer hover:text-white" onClick={() => handleSort("followRecords")}>
                <span className="flex items-center justify-center gap-1">跟进次数 <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="p-3 text-center">转化率</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">暂无数据</td>
              </tr>
            ) : (
              sorted.map((s: any, idx: number) => {
                const rate = s.totalBrands > 0 ? Math.round((s.cooperating / s.totalBrands) * 100) : 0;
                return (
                  <tr key={s.staffId || idx} className="border-t border-gray-800/30 hover:bg-gray-800/20">
                    <td className="p-3">
                      {idx === 0 ? <span className="text-yellow-400 font-bold text-lg">1</span> :
                       idx === 1 ? <span className="text-gray-300 font-bold text-lg">2</span> :
                       idx === 2 ? <span className="text-orange-400 font-bold text-lg">3</span> :
                       <span className="text-gray-500">{idx + 1}</span>}
                    </td>
                    <td className="p-3 text-white font-medium">{s.staffName || "未指定"}</td>
                    <td className="p-3 text-center text-gray-300">{s.totalBrands}</td>
                    <td className="p-3 text-center text-green-400">{s.cooperating}</td>
                    <td className="p-3 text-center text-blue-400">{s.agreed}</td>
                    <td className="p-3 text-center text-red-400">{s.rejected}</td>
                    <td className="p-3 text-center text-cyan-400">{s.followRecords}</td>
                    <td className="p-3 text-center">
                      <Badge className={`${rate >= 30 ? 'bg-green-600' : rate >= 15 ? 'bg-yellow-600' : 'bg-gray-600'} text-white text-xs`}>
                        {rate}%
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
