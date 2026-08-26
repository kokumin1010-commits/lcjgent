import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { AlertTriangle, Ban, Clock3, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  isRestricted?: boolean;
  restrictions?: Array<{ id: number; scope: 'order' | 'receipt' | 'points'; expiresAt: string | Date }>;
};

const scopeLabels = { order: '注文', receipt: 'レシート', points: 'ポイント' } as const;

export function MemberRiskBadge({ risk, compact = false }: { risk?: MemberRiskSummary | null; compact?: boolean }) {
  if (risk?.isRestricted || (risk?.restrictions?.length || 0) > 0) {
    const labels = (risk?.restrictions || []).map(item => scopeLabels[item.scope]).join('・');
    return <Badge className="border-red-400 bg-red-600 text-white hover:bg-red-600"><Ban className="mr-1 h-3 w-3" />制限中{labels ? `：${labels}` : ''}</Badge>;
  }
  if (!risk?.hasAdverseHistory) {
    if (compact) return null;
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><ShieldCheck className="mr-1 h-3 w-3" />通常</Badge>;
  }
  if (risk.riskLevel === 'high') return <Badge className="border-red-300 bg-red-100 text-red-800 hover:bg-red-100"><Ban className="mr-1 h-3 w-3" />高リスク：取消/返金 {risk.lifetimeAdverseCount}件</Badge>;
  if (risk.riskLevel === 'review') return <Badge className="border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-100"><AlertTriangle className="mr-1 h-3 w-3" />要確認：取消/返金 {risk.lifetimeAdverseCount}件</Badge>;
  return <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700"><Clock3 className="mr-1 h-3 w-3" />履歴あり：取消/返金 {risk.lifetimeAdverseCount}件</Badge>;
}

export function MemberRiskPanel({ memberId }: { memberId: number }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const query = trpc.memberRisk.getMember.useQuery({ memberId }, { enabled: memberId > 0 });
  const [scopes, setScopes] = useState<Array<'order' | 'receipt' | 'points'>>([]);
  const [reason, setReason] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => {
    const date = new Date(Date.now() + 30 * 86400000);
    return date.toISOString().slice(0, 10);
  });
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);

  const refresh = async () => {
    await Promise.all([
      query.refetch(),
      utils.memberRisk.list.invalidate(),
      utils.memberRisk.getMember.invalidate({ memberId }),
    ]);
  };
  const restrictMutation = trpc.memberRisk.restrict.useMutation({
    onSuccess: async () => { toast.success('会員制限を開始し、監査ログへ保存しました'); setScopes([]); setReason(''); setEvidenceNote(''); setApprovalConfirmed(false); await refresh(); },
    onError: error => toast.error('制限を開始できません', { description: error.message }),
  });
  const releaseMutation = trpc.memberRisk.release.useMutation({
    onSuccess: async () => { toast.success('制限を解除し、監査ログへ保存しました'); await refresh(); },
    onError: error => toast.error('制限を解除できません', { description: error.message }),
  });
  const extendMutation = trpc.memberRisk.extend.useMutation({
    onSuccess: async () => { toast.success('制限期限を延長し、監査ログへ保存しました'); await refresh(); },
    onError: error => toast.error('期限を延長できません', { description: error.message }),
  });

  const risk = query.data;
  if (query.isLoading) return <div className="rounded-lg border p-4 text-sm text-muted-foreground">キャンセル・返金履歴を確認中…</div>;
  if (query.error || !risk) return null;
  const tone = risk.isRestricted ? 'border-red-400 bg-red-50' : risk.riskLevel === 'high' ? 'border-red-300 bg-red-50' : risk.riskLevel === 'review' ? 'border-amber-300 bg-amber-50' : risk.hasAdverseHistory ? 'border-orange-200 bg-orange-50' : 'border-emerald-200 bg-emerald-50';
  const relatedOrderIds = risk.relatedOrders.map((order: any) => Number(order.id));

  return (
    <Card className={tone}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />キャンセル・返金注意</span>
          <MemberRiskBadge risk={{ ...risk, restrictions: risk.activeRestrictions }} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
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

        {risk.activeRestrictions.length > 0 && (
          <div className="space-y-2 rounded-lg border border-red-300 bg-white p-3">
            <p className="font-semibold text-red-800">現在の管理者制限</p>
            {risk.activeRestrictions.map((restriction: any) => (
              <div key={restriction.id} className="rounded border border-red-100 bg-red-50 p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className="bg-red-600 text-white">{scopeLabels[restriction.scope as keyof typeof scopeLabels]}</Badge>
                  <span>期限: {new Date(restriction.expiresAt).toLocaleString('ja-JP')}</span>
                </div>
                <p className="mt-1">理由: {restriction.reason}</p>
                <p className="text-muted-foreground">承認者: {restriction.approvedByName || `ID ${restriction.approvedBy}`}</p>
                {user?.role === 'admin' && <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const releaseReason = prompt('解除理由を入力してください');
                    if (releaseReason && confirm('この制限を解除しますか？')) releaseMutation.mutate({ restrictionId: Number(restriction.id), reason: releaseReason });
                  }}>解除</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const date = prompt('新しい期限（YYYY-MM-DD）を入力してください');
                    if (!date) return;
                    const extendReason = prompt('延長理由を入力してください');
                    if (extendReason && confirm('この制限期限を延長しますか？')) extendMutation.mutate({ restrictionId: Number(restriction.id), expiresAt: new Date(`${date}T23:59:59`), reason: extendReason });
                  }}>延長</Button>
                </div>}
              </div>
            ))}
          </div>
        )}

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

        {user?.role === 'admin' && (
          <div className="space-y-3 rounded-lg border border-dashed border-red-300 bg-white p-3">
            <div><p className="font-semibold">管理者制限を開始</p><p className="text-xs text-muted-foreground">金額だけでは作成できません。対象scope・理由・証拠・期限・明示承認が必須です。</p></div>
            <div className="flex flex-wrap gap-4">
              {(Object.keys(scopeLabels) as Array<keyof typeof scopeLabels>).map(scope => <label key={scope} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={scopes.includes(scope)} onChange={event => setScopes(current => event.target.checked ? [...current, scope] : current.filter(item => item !== scope))} />{scopeLabels[scope]}</label>)}
            </div>
            <Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="制限理由（10文字以上）" rows={2} />
            <Textarea value={evidenceNote} onChange={event => setEvidenceNote(event.target.value)} placeholder="確認した証拠・判断根拠（3文字以上）" rows={2} />
            <div><label className="mb-1 block text-xs font-medium">期限</label><Input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></div>
            <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={approvalConfirmed} onChange={event => setApprovalConfirmed(event.target.checked)} /><span>私は管理者として、会員本人に紐付く注文履歴と証拠を確認し、この期限付き制限を明示承認します。</span></label>
            <Button variant="destructive" disabled={restrictMutation.isPending || scopes.length === 0 || reason.trim().length < 10 || evidenceNote.trim().length < 3 || !approvalConfirmed} onClick={() => {
              if (!confirm('選択したscopeを期限付きで制限しますか？この操作は監査ログへ保存されます。')) return;
              restrictMutation.mutate({ memberId, scopes, reason: reason.trim(), evidence: { relatedOrderIds, note: evidenceNote.trim() }, expiresAt: new Date(`${expiresAt}T23:59:59`), approvalConfirmed: true });
            }}>管理者承認で制限開始</Button>
          </div>
        )}

        {risk.logs.length > 0 && <details className="rounded-md border bg-white p-2 text-xs"><summary className="cursor-pointer font-semibold">制限監査ログ（{risk.logs.length}件）</summary><div className="mt-2 divide-y">{risk.logs.map((log: any) => <div key={log.id} className="py-2"><p>{log.action} / {scopeLabels[log.scope as keyof typeof scopeLabels]} / {new Date(log.createdAt).toLocaleString('ja-JP')}</p><p>理由: {log.reason}</p><p className="text-muted-foreground">操作者: {log.actorName || `ID ${log.actorId}`}</p></div>)}</div></details>}
        <p className="text-xs text-muted-foreground">外部TikTok店舗の月次・日次返金は会員へ紐付かないため、この判定・制限には使用しません。単発履歴や金額だけで自動制限しません。</p>
      </CardContent>
    </Card>
  );
}
