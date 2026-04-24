/**
 * LCJ Coin Buyback Tab - バイバック（換金）管理
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  RefreshCw, Rocket, LogOut, Shield, Ban, Plus, Check, X,
  Clock, Coins, AlertTriangle, ArrowRight
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

export default function LcjCoinBuybackTab() {
  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    maxPercentage: 20,
    coinPriceAtOpen: 0,
    totalBudget: 0,
    notes: "",
  });

  const periodsQuery = trpc.lcjCoin.getBuybackPeriods.useQuery();
  const exitRulesQuery = trpc.lcjCoin.getExitRules.useQuery();

  const createPeriodMutation = trpc.lcjCoin.createBuybackPeriod.useMutation({
    onSuccess: () => {
      toast.success("バイバック期間を作成しました");
      setCreateDialog(false);
      periodsQuery.refetch();
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  const periods = periodsQuery.data || [];
  const exitRules = exitRulesQuery.data || [];

  const formatYen = (v: number) => `¥${Math.round(v).toLocaleString()}`;

  const statusColors: Record<string, string> = {
    upcoming: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    open: "bg-green-500/20 text-green-400 border-green-500/30",
    closed: "bg-white/5 text-white/40 border-white/10",
    settled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const statusLabels: Record<string, string> = {
    upcoming: "受付前",
    open: "受付中",
    closed: "締切",
    settled: "精算済み",
  };

  const exitIcons: Record<string, any> = {
    rocket: Rocket,
    refresh: RefreshCw,
    logout: LogOut,
    shield: Shield,
    alert: Ban,
  };

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* Exit Rules */}
      {/* ============================================================ */}
      <NeonCard color="orange">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-orange-400" />
          換金（Exit）ルール
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {exitRules.map((rule: any) => {
            const Icon = exitIcons[rule.icon] || Coins;
            const isWarning = rule.id === "fired_disciplinary";
            return (
              <div
                key={rule.id}
                className={`p-4 rounded-xl border ${
                  isWarning
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-white/[0.03] border-white/5"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${isWarning ? "text-red-400" : "text-orange-400"}`} />
                  <span className="font-semibold text-white text-sm">{rule.title}</span>
                </div>
                <p className="text-xs text-white/60">{rule.description}</p>
              </div>
            );
          })}
        </div>
      </NeonCard>

      {/* ============================================================ */}
      {/* Buyback Periods */}
      {/* ============================================================ */}
      <NeonCard color="blue">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-400" />
            バイバック期間
          </h3>
          <Button
            size="sm"
            className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
            onClick={() => setCreateDialog(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            新規作成
          </Button>
        </div>

        {periods.length > 0 ? (
          <div className="space-y-3">
            {periods.map((period: any) => (
              <div key={period.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{period.name}</span>
                    <Badge className={statusColors[period.status] || statusColors.upcoming}>
                      {statusLabels[period.status] || period.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-blue-400">
                      1コイン = {formatYen(Number(period.coinPriceAtOpen))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-6 text-xs text-white/40">
                  <span>期間: {new Date(period.startDate).toLocaleDateString("ja-JP")} 〜 {new Date(period.endDate).toLocaleDateString("ja-JP")}</span>
                  <span>上限: 確定済みの{Number(period.maxPercentage)}%</span>
                  {period.totalBudget && <span>予算: {formatYen(Number(period.totalBudget))}</span>}
                </div>
                <div className="flex gap-6 text-xs text-white/30 mt-1">
                  <span>申請額: {formatYen(Number(period.totalRequested || 0))}</span>
                  <span>承認額: {formatYen(Number(period.totalApproved || 0))}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-white/30">
            <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>バイバック期間がまだ作成されていません</p>
            <p className="text-xs mt-1">「新規作成」から最初のバイバック期間を設定してください</p>
          </div>
        )}
      </NeonCard>

      {/* Create Period Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              バイバック期間を作成
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60">期間名</Label>
              <Input
                className="bg-white/5 border-white/10 text-white"
                value={createForm.name}
                onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例: 2026年12月バイバック"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60">開始日</Label>
                <Input
                  type="date"
                  className="bg-white/5 border-white/10 text-white"
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-white/60">終了日</Label>
                <Input
                  type="date"
                  className="bg-white/5 border-white/10 text-white"
                  value={createForm.endDate}
                  onChange={(e) => setCreateForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60">上限（確定済みの%）</Label>
                <Input
                  type="number"
                  className="bg-white/5 border-white/10 text-white"
                  value={createForm.maxPercentage}
                  onChange={(e) => setCreateForm(f => ({ ...f, maxPercentage: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label className="text-white/60">1コイン価格（円）</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="bg-white/5 border-white/10 text-white"
                  value={createForm.coinPriceAtOpen}
                  onChange={(e) => setCreateForm(f => ({ ...f, coinPriceAtOpen: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-white/60">予算上限（円・任意）</Label>
              <Input
                type="number"
                className="bg-white/5 border-white/10 text-white"
                value={createForm.totalBudget}
                onChange={(e) => setCreateForm(f => ({ ...f, totalBudget: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="text-white/60">備考</Label>
              <Textarea
                className="bg-white/5 border-white/10 text-white"
                value={createForm.notes}
                onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5">キャンセル</Button>
            </DialogClose>
            <Button
              className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
              onClick={() => createPeriodMutation.mutate(createForm)}
              disabled={!createForm.name || !createForm.startDate || !createForm.endDate || createPeriodMutation.isPending}
            >
              {createPeriodMutation.isPending ? "作成中..." : "作成する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
