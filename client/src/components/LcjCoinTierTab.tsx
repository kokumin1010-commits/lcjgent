/**
 * LCJ Coin Tier Tab - Tier別付与テンプレート管理
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Star, Calculator, Edit, Coins } from "lucide-react";

function NeonCard({ children, color = "orange", className = "" }: { children: React.ReactNode; color?: string; className?: string }) {
  const glowColors: Record<string, string> = {
    orange: "shadow-orange-500/5 border-orange-500/10 hover:border-orange-500/20",
    blue: "shadow-blue-500/5 border-blue-500/10 hover:border-blue-500/20",
    green: "shadow-green-500/5 border-green-500/10 hover:border-green-500/20",
  };
  return (
    <div className={`rounded-2xl bg-white/[0.02] border p-6 shadow-lg transition-all ${glowColors[color] || glowColors.orange} ${className}`}>
      {children}
    </div>
  );
}

const tierColors: Record<string, string> = {
  S: "bg-red-500/20 text-red-400 border-red-500/30",
  A: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  B: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  C: "bg-green-500/20 text-green-400 border-green-500/30",
  D: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function LcjCoinTierTab() {
  const [calcDialog, setCalcDialog] = useState(false);
  const [calcForm, setCalcForm] = useState({ annualSalary: 5000000, tierCode: "B" });
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    tierCode: string; tierName: string; description: string;
    exampleRoles: string; salaryCoefficient: number;
    vestingPeriodMonths: number; cliffMonths: number;
    coefficientMin: number; coefficientMax: number;
  } | null>(null);

  const tiersQuery = trpc.lcjCoin.getTierTemplates.useQuery();
  const calcQuery = trpc.lcjCoin.calculateAutoGrant.useQuery(
    { annualSalary: calcForm.annualSalary, tierCode: calcForm.tierCode },
    { enabled: calcDialog && calcForm.annualSalary > 0 }
  );

  const upsertMutation = trpc.lcjCoin.upsertTierTemplate.useMutation({
    onSuccess: () => {
      toast.success("Tierテンプレートを更新しました");
      tiersQuery.refetch();
      setEditingTier(null);
      setEditForm(null);
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  const tiers = tiersQuery.data || [];
  const calcResult = calcQuery.data;

  const formatYen = (v: number) => `¥${Math.round(v).toLocaleString()}`;

  const startEdit = (tier: any) => {
    setEditingTier(tier.tierCode);
    setEditForm({
      tierCode: tier.tierCode,
      tierName: tier.tierName || "",
      description: tier.description || "",
      exampleRoles: tier.exampleRoles || "",
      salaryCoefficient: Number(tier.salaryCoefficient) || 0,
      vestingPeriodMonths: tier.vestingPeriodMonths || 48,
      cliffMonths: tier.cliffMonths || 12,
      coefficientMin: Number(tier.coefficientMin) || 0,
      coefficientMax: Number(tier.coefficientMax) || 0,
    });
  };

  const saveEdit = () => {
    if (!editForm) return;
    // Find existing tier to get its ID for update
    const existingTier = tiers.find((t: any) => t.tierCode === editForm.tierCode);
    upsertMutation.mutate({
      id: existingTier?.id,
      tierCode: editForm.tierCode,
      tierName: editForm.tierName,
      description: editForm.description,
      exampleRoles: editForm.exampleRoles,
      salaryCoefficient: editForm.salaryCoefficient,
      vestingPeriodMonths: editForm.vestingPeriodMonths,
      cliffMonths: editForm.cliffMonths,
    });
  };

  return (
    <div className="space-y-6">
      {/* Tier Templates */}
      <NeonCard color="orange">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Star className="w-5 h-5 text-orange-400" />
            Tier別付与テンプレート
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            onClick={() => setCalcDialog(true)}
          >
            <Calculator className="w-4 h-4 mr-1" />
            シミュレーション
          </Button>
        </div>

        {tiers.length > 0 ? (
          <div className="space-y-3">
            {tiers.map((tier: any) => (
              <div key={tier.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                {editingTier === tier.tierCode && editForm ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className={`text-lg px-3 py-1 ${tierColors[tier.tierCode] || tierColors.D}`}>
                        {tier.tierCode}
                      </Badge>
                      <Input
                        className="bg-white/5 border-white/10 text-white h-8 text-sm flex-1"
                        value={editForm.tierName}
                        onChange={(e) => setEditForm(f => f ? { ...f, tierName: e.target.value } : f)}
                        placeholder="Tier名"
                      />
                    </div>
                    <Input
                      className="bg-white/5 border-white/10 text-white h-8 text-sm"
                      value={editForm.description}
                      onChange={(e) => setEditForm(f => f ? { ...f, description: e.target.value } : f)}
                      placeholder="説明"
                    />
                    <Input
                      className="bg-white/5 border-white/10 text-white h-8 text-sm"
                      value={editForm.exampleRoles}
                      onChange={(e) => setEditForm(f => f ? { ...f, exampleRoles: e.target.value } : f)}
                      placeholder="対象例"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-[10px] text-white/40">係数(%)</Label>
                        <Input
                          type="number"
                          className="bg-white/5 border-white/10 text-white h-8 text-sm"
                          value={editForm.salaryCoefficient}
                          onChange={(e) => setEditForm(f => f ? { ...f, salaryCoefficient: Number(e.target.value) } : f)}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-white/40">ベスティング(月)</Label>
                        <Input
                          type="number"
                          className="bg-white/5 border-white/10 text-white h-8 text-sm"
                          value={editForm.vestingPeriodMonths}
                          onChange={(e) => setEditForm(f => f ? { ...f, vestingPeriodMonths: Number(e.target.value) } : f)}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-white/40">クリフ(月)</Label>
                        <Input
                          type="number"
                          className="bg-white/5 border-white/10 text-white h-8 text-sm"
                          value={editForm.cliffMonths}
                          onChange={(e) => setEditForm(f => f ? { ...f, cliffMonths: Number(e.target.value) } : f)}
                        />
                      </div>
                      <div className="flex items-end gap-1">
                        <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 text-white" onClick={saveEdit} disabled={upsertMutation.isPending}>
                          {upsertMutation.isPending ? "保存中..." : "保存"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 border-white/10 text-white/60" onClick={() => { setEditingTier(null); setEditForm(null); }}>
                          取消
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <Badge className={`text-lg px-3 py-1 ${tierColors[tier.tierCode] || tierColors.D}`}>
                      {tier.tierCode}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-medium text-white">{tier.tierName}</div>
                      <div className="text-xs text-white/40 mt-0.5">{tier.description}</div>
                      <div className="text-xs text-white/30 mt-1">
                        対象例: {tier.exampleRoles}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold font-mono text-orange-400">
                        {Number(tier.salaryCoefficient)}%
                      </div>
                      <div className="text-xs text-white/30">年収に対する係数</div>
                    </div>
                    <div className="text-right text-xs text-white/40">
                      <div>ベスティング: {tier.vestingPeriodMonths}ヶ月</div>
                      <div>クリフ: {tier.cliffMonths}ヶ月</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/30 hover:text-white hover:bg-white/5"
                      onClick={() => startEdit(tier)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-white/30">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Tierテンプレートを読み込み中...</p>
          </div>
        )}
      </NeonCard>

      {/* Calculation Formula */}
      <NeonCard color="blue">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-400" />
          付与コイン数の計算式
        </h3>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="font-mono text-sm text-center space-y-2">
            <div className="text-orange-400">
              付与コイン数 = (年収 × Tier係数) ÷ 現在の1コイン価格
            </div>
            <div className="text-white/30 text-xs">
              例: 年収500万 × Tier B(12%) ÷ ¥46.86 = 12,804コイン
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xs text-white/40 mb-1">年収</div>
            <div className="text-sm font-mono text-white">スタッフの年収</div>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xs text-white/40 mb-1">× Tier係数</div>
            <div className="text-sm font-mono text-orange-400">S:80% A:30% B:12% C:5% D:2%</div>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xs text-white/40 mb-1">÷ コイン価格</div>
            <div className="text-sm font-mono text-blue-400">リアルタイム算出</div>
          </div>
        </div>
      </NeonCard>

      {/* Simulation Dialog */}
      <Dialog open={calcDialog} onOpenChange={setCalcDialog}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-orange-400" />
              付与シミュレーション
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60">年収（円）</Label>
              <Input
                type="number"
                className="bg-white/5 border-white/10 text-white"
                value={calcForm.annualSalary}
                onChange={(e) => setCalcForm(f => ({ ...f, annualSalary: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="text-white/60">Tier</Label>
              <Select value={calcForm.tierCode} onValueChange={(v) => setCalcForm(f => ({ ...f, tierCode: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0f] border-white/10 text-white">
                  {tiers.map((t: any) => (
                    <SelectItem key={t.tierCode} value={t.tierCode} className="text-white hover:text-white focus:text-white">
                      Tier {t.tierCode} — {t.tierName} ({Number(t.salaryCoefficient)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {calcResult && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 space-y-3">
                <div className="text-center">
                  <div className="text-xs text-white/40 mb-1">付与コイン数</div>
                  <div className="text-3xl font-bold font-mono text-orange-400">
                    {calcResult.coinAmount.toLocaleString()}
                  </div>
                  <div className="text-sm text-white/40 mt-1">
                    = {formatYen(calcResult.grantValueJpy)} 相当
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-white/[0.03]">
                    <span className="text-white/40">年収:</span>
                    <span className="text-white ml-1">{formatYen(calcResult.annualSalary)}</span>
                  </div>
                  <div className="p-2 rounded bg-white/[0.03]">
                    <span className="text-white/40">係数:</span>
                    <span className="text-orange-400 ml-1">{(calcResult.coefficient * 100).toFixed(0)}%</span>
                  </div>
                  <div className="p-2 rounded bg-white/[0.03]">
                    <span className="text-white/40">1コイン:</span>
                    <span className="text-blue-400 ml-1">{formatYen(calcResult.coinPrice)}</span>
                  </div>
                  <div className="p-2 rounded bg-white/[0.03]">
                    <span className="text-white/40">ベスティング:</span>
                    <span className="text-white ml-1">{calcResult.vestingPeriodMonths}ヶ月</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5">閉じる</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
