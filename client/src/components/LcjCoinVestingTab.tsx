/**
 * LCJ Coin Vesting Tab - ベスティング管理 + 心理トリガーUI
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Lock, Unlock, Clock, TrendingUp, AlertTriangle, Rocket,
  ChevronRight, Zap, ArrowUpRight
} from "lucide-react";

function NeonCard({ children, color = "orange", className = "" }: { children: React.ReactNode; color?: string; className?: string }) {
  const glowColors: Record<string, string> = {
    orange: "shadow-orange-500/5 border-orange-500/10 hover:border-orange-500/20",
    blue: "shadow-blue-500/5 border-blue-500/10 hover:border-blue-500/20",
    green: "shadow-green-500/5 border-green-500/10 hover:border-green-500/20",
    red: "shadow-red-500/5 border-red-500/10 hover:border-red-500/20",
    purple: "shadow-purple-500/5 border-purple-500/10 hover:border-purple-500/20",
  };
  return (
    <div className={`rounded-2xl bg-white/[0.02] border p-6 shadow-lg transition-all ${glowColors[color] || glowColors.orange} ${className}`}>
      {children}
    </div>
  );
}

function ProgressBar({ percent, color = "orange" }: { percent: number; color?: string }) {
  const colors: Record<string, string> = {
    orange: "from-orange-500 to-red-500",
    green: "from-green-500 to-emerald-500",
    blue: "from-blue-500 to-cyan-500",
    red: "from-red-500 to-pink-500",
  };
  return (
    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${colors[color] || colors.orange} rounded-full transition-all duration-1000`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export default function LcjCoinVestingTab({ staffList, liverList }: {
  staffList: { id: number; name: string; department?: string }[];
  liverList: { id: number; name: string }[];
}) {
  const [selectedType, setSelectedType] = useState<"staff" | "liver">("staff");
  const [selectedId, setSelectedId] = useState<number>(0);

  const vestingQuery = trpc.lcjCoin.getVestingDetails.useQuery(
    { holderType: selectedType, holderId: selectedId },
    { enabled: selectedId > 0 }
  );

  const processVestingMutation = trpc.lcjCoin.processMonthlyVesting.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.processedCount}件のベスティングを処理しました（${data.vestedTotal.toLocaleString()}コイン確定）`);
      if (selectedId > 0) vestingQuery.refetch();
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  const data = vestingQuery.data;
  const summary = data?.summary;
  const schedules = data?.schedules || [];

  const formatYen = (v: number) => `¥${Math.round(v).toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Person Selector + Process Button */}
      <NeonCard color="blue">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-400" />
            ベスティング管理
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
            onClick={() => processVestingMutation.mutate()}
            disabled={processVestingMutation.isPending}
          >
            <Zap className="w-4 h-4 mr-1" />
            {processVestingMutation.isPending ? "処理中..." : "月次ベスティング実行"}
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <Select value={selectedType} onValueChange={(v: any) => { setSelectedType(v); setSelectedId(0); }}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0f] border-white/10 text-white">
              <SelectItem value="staff" className="text-white hover:text-white focus:text-white">スタッフ</SelectItem>
              <SelectItem value="liver" className="text-white hover:text-white focus:text-white">ライバー</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(selectedId)} onValueChange={(v) => setSelectedId(Number(v))}>
            <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="対象者を選択..." />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0f] border-white/10 text-white max-h-60">
              {(selectedType === "staff" ? staffList : liverList).map((t) => (
                <SelectItem key={t.id} value={String(t.id)} className="text-white hover:text-white focus:text-white">
                  {t.name}{"department" in t && t.department ? ` (${t.department})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedId === 0 && (
          <div className="text-center py-12 text-white/80">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>対象者を選択すると、ベスティング詳細が表示されます</p>
          </div>
        )}
      </NeonCard>

      {/* ============================================================ */}
      {/* Summary Cards - 心理トリガーUI */}
      {/* ============================================================ */}
      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <NeonCard color="green" className="!p-4">
              <div className="text-xs text-white/80 mb-1">確定済みコイン</div>
              <div className="text-xl font-bold font-mono text-green-400">
                {summary.vestedCoins.toLocaleString()}
              </div>
              <div className="text-sm text-green-400/60 font-mono mt-1">
                {formatYen(summary.vestedValueJpy)}
              </div>
            </NeonCard>
            <NeonCard color="orange" className="!p-4">
              <div className="text-xs text-white/80 mb-1">未確定コイン</div>
              <div className="text-xl font-bold font-mono text-orange-400">
                {summary.unvestedCoins.toLocaleString()}
              </div>
              <div className="text-sm text-orange-400/60 font-mono mt-1">
                {formatYen(summary.unvestedValueJpy)}
              </div>
            </NeonCard>
            <NeonCard color="blue" className="!p-4">
              <div className="text-xs text-white/80 mb-1">合計保有</div>
              <div className="text-xl font-bold font-mono text-blue-400">
                {summary.totalCoins.toLocaleString()}
              </div>
              <div className="text-sm text-blue-400/60 font-mono mt-1">
                {formatYen(summary.totalValueJpy)}
              </div>
            </NeonCard>
            <NeonCard color="purple" className="!p-4">
              <div className="text-xs text-white/80 mb-1">1コイン価格</div>
              <div className="text-xl font-bold font-mono text-purple-400">
                {formatYen(summary.coinPrice)}
              </div>
              <div className="text-xs text-white/70 mt-1">現在の評価額</div>
            </NeonCard>
          </div>

          {/* ============================================================ */}
          {/* 心理トリガー: 辞めたら失う金額 */}
          {/* ============================================================ */}
          {summary.loseByQuitting > 0 && (
            <NeonCard color="red" className="!p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-white/80 mb-1">今退職すると失う金額</div>
                  <div className="text-2xl font-bold font-mono text-red-400">
                    {formatYen(summary.loseByQuitting)}
                  </div>
                  <div className="text-xs text-red-400/60 mt-1">
                    未確定コイン {summary.unvestedCoins.toLocaleString()}枚分が没収されます
                  </div>
                </div>
              </div>
            </NeonCard>
          )}

          {/* ============================================================ */}
          {/* 心理トリガー: IPO時の予測金額 */}
          {/* ============================================================ */}
          <NeonCard color="orange">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-orange-400" />
              IPO時の予測金額
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-xs text-white/80 mb-2">時価総額 100億円</div>
                <div className="text-xl font-bold font-mono text-yellow-400">
                  {formatYen(summary.ipoProjection100)}
                </div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-orange-500/20">
                <div className="text-xs text-white/80 mb-2">時価総額 300億円</div>
                <div className="text-2xl font-bold font-mono text-orange-400">
                  {formatYen(summary.ipoProjection300)}
                </div>
              </div>
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30">
                <div className="text-xs text-white/80 mb-2">時価総額 1,000億円</div>
                <div className="text-2xl font-bold font-mono text-red-400">
                  {formatYen(summary.ipoProjection1000)}
                </div>
                <div className="text-xs text-orange-400/60 mt-1 flex items-center justify-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  目標
                </div>
              </div>
            </div>
          </NeonCard>
        </>
      )}

      {/* ============================================================ */}
      {/* Vesting Schedules */}
      {/* ============================================================ */}
      {schedules.length > 0 && (
        <NeonCard color="blue">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            ベスティングスケジュール一覧
          </h3>
          <div className="space-y-4">
            {schedules.map((s: any) => (
              <div key={s.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={
                      s.status === "completed" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                      s.cliffPassed ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                      "bg-red-500/20 text-red-400 border-red-500/30"
                    }>
                      {s.status === "completed" ? "完了" : s.cliffPassed ? "確定中" : "クリフ期間"}
                    </Badge>
                    <span className="text-sm text-white/90">
                      {new Date(s.grantDate).toLocaleDateString("ja-JP")} 付与
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-white">
                      {s.totalGrantCoins.toLocaleString()} <span className="text-xs text-white/80">コイン</span>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs text-white/80 mb-1">
                    <span>確定: {s.calculatedVestedCoins.toLocaleString()} / {s.totalGrantCoins.toLocaleString()}</span>
                    <span>{s.vestedPercent}%</span>
                  </div>
                  <ProgressBar
                    percent={s.vestedPercent}
                    color={s.status === "completed" ? "green" : s.cliffPassed ? "blue" : "red"}
                  />
                </div>

                {/* Details */}
                <div className="flex gap-4 text-xs text-white/80">
                  <span>経過: {s.monthsElapsed}ヶ月</span>
                  <span>クリフ: {s.cliffMonths}ヶ月</span>
                  <span>期間: {s.vestingPeriodMonths}ヶ月</span>
                  {s.unvestedCoins > 0 && (
                    <span className="text-orange-400">
                      未確定: {formatYen(s.unvestedValueJpy)}
                    </span>
                  )}
                </div>

                {s.reason && (
                  <div className="text-xs text-white/80 italic">理由: {s.reason}</div>
                )}
              </div>
            ))}
          </div>
        </NeonCard>
      )}
    </div>
  );
}
