import { trpc } from '@/lib/trpc';
import { AlertTriangle, Ban, Clock3, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type MemberRiskSummary = {
  memberId: number;
  riskLevel: 'normal' | 'review' | 'high';
  hasAdverseHistory: boolean;
  totalOrders: number;
  cancelledCount: number;
  refundedCount: number;
  lifetimeAdverseCount: number;
  adverseAmount: number;
  adversePoints: number;
  orders90: number;
  adverse90: number;
  adverseRate90: number;
  orders180: number;
  adverse180: number;
  adverseRate180: number;
  latestAdverseAt: string | Date | null;
};

export function MemberRiskBadge({ risk, compact = false }: { risk?: MemberRiskSummary | null; compact?: boolean }) {
  if (!risk?.hasAdverseHistory) {
    if (compact) return null;
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><ShieldCheck className="mr-1 h-3 w-3" />通常</Badge>;
  }
  if (risk.riskLevel === 'high') {
    return <Badge className="border-red-300 bg-red-100 text-red-800 hover:bg-red-100"><Ban className="mr-1 h-3 w-3" />高リスク：取消/返金 {risk.lifetimeAdverseCount}件</Badge>;
  }
  if (risk.riskLevel === 'review') {
    return <Badge className="border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-100"><AlertTriangle className="mr-1 h-3 w-3" />要確認：取消/返金 {risk.lifetimeAdverseCount}件</Badge>;
  }
  return <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700"><Clock3 className="mr-1 h-3 w-3" />履歴あり：取消/返金 {risk.lifetimeAdverseCount}件</Badge>;
}

export function MemberRiskPanel({ memberId }: { memberId: number }) {
  const query = trpc.memberRisk.getMember.useQuery({ memberId }, { enabled: memberId > 0 });
  const risk = query.data;
  if (query.isLoading) return <div className="rounded-lg border p-4 text-sm text-muted-foreground">キャンセル・返金履歴を確認中…</div>;
  if (query.error || !risk) return null;

  const tone = risk.riskLevel === 'high' ? 'border-red-300 bg-red-50' : risk.riskLevel === 'review' ? 'border-amber-300 bg-amber-50' : risk.hasAdverseHistory ? 'border-orange-200 bg-orange-50' : 'border-emerald-200 bg-emerald-50';
  return (
    <Card className={tone}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />キャンセル・返金注意</span>
          <MemberRiskBadge risk={risk} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">全注文</p><p className="font-semibold">{risk.totalOrders}件</p></div>
          <div><p className="text-xs text-muted-foreground">キャンセル</p><p className="font-semibold text-red-700">{risk.cancelledCount}件</p></div>
          <div><p className="text-xs text-muted-foreground">返金済み</p><p className="font-semibold text-orange-700">{risk.refundedCount}件</p></div>
          <div><p className="text-xs text-muted-foreground">不利金額</p><p className="font-semibold">¥{risk.adverseAmount.toLocaleString()}</p></div>
        </div>
        <div className="rounded-md border bg-white/70 p-2 text-xs text-muted-foreground">
          90日: {risk.adverse90}/{risk.orders90}件（{risk.adverseRate90}%）・180日: {risk.adverse180}/{risk.orders180}件（{risk.adverseRate180}%）
          {risk.latestAdverseAt && <span className="ml-2">直近: {new Date(risk.latestAdverseAt).toLocaleDateString('ja-JP')}</span>}
        </div>
        {risk.relatedOrders.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold">関連注文</p>
            <div className="divide-y rounded-md border bg-white/80">
              {risk.relatedOrders.map((order: any) => (
                <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs">
                  <span className="font-mono font-semibold">{order.orderNumber}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">{order.status === 'refunded' ? <RefreshCw className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{order.status === 'refunded' ? '返金済み' : 'キャンセル'}</span>
                  <span>¥{Number(order.totalAmount || 0).toLocaleString()}</span>
                  <span>{new Date(order.cancelledAt || order.updatedAt || order.createdAt).toLocaleDateString('ja-JP')}</span>
                  {order.cancelReason && <span className="basis-full text-muted-foreground">理由: {order.cancelReason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">外部TikTok店舗の月次・日次返金は会員へ紐付かないため、この判定には使用していません。金額だけでは自動制限しません。</p>
      </CardContent>
    </Card>
  );
}
