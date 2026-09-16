/**
 * 第2回LCF GMV運営確認。
 * Design: audit-first operations dashboard; evidence is private and fetched only after an explicit click.
 */
import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, CheckCircle2, Clock3, ExternalLink, FileImage, Handshake, ImageOff, Loader2, RefreshCw, RotateCcw, ShieldAlert, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  submitted: { label: '確認待ち', className: 'bg-amber-100 text-amber-800' },
  needs_revision: { label: '差戻し', className: 'bg-red-100 text-red-800' },
  verified: { label: '確認済み', className: 'bg-emerald-100 text-emerald-800' },
  voided: { label: '無効', className: 'bg-gray-200 text-gray-700' },
};

function money(value: unknown) {
  return `¥${Math.round(Number(value || 0)).toLocaleString('ja-JP')}`;
}

function dateTime(value: unknown) {
  if (!value) return '—';
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('ja-JP');
}

export function LcfGmvAdminPanel() {
  const utils = trpc.useUtils();
  const overview = trpc.festivalEngagement.adminOverview.useQuery(undefined, { retry: false });
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [reviewTarget, setReviewTarget] = useState<any | null>(null);
  const [verifiedAmount, setVerifiedAmount] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<any | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [evidenceTarget, setEvidenceTarget] = useState<any | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const invalidate = async () => {
    await utils.festivalEngagement.adminOverview.invalidate();
  };
  const review = trpc.festivalEngagement.reviewGmvReport.useMutation({
    onSuccess: async (data) => {
      toast.success(data.status === 'verified' ? 'GMV報告を確認済みにしました' : data.status === 'needs_revision' ? 'GMV報告を差し戻しました' : 'GMV報告を無効化しました');
      setReviewTarget(null);
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const adjust = trpc.festivalEngagement.addGmvAdjustment.useMutation({
    onSuccess: async () => {
      toast.success('返金・取消等の調整を履歴へ追加しました');
      setAdjustTarget(null);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const reports = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (overview.data?.reports || []).filter((row: any) => {
      if (statusFilter !== 'all' && row.report.status !== statusFilter) return false;
      if (!keyword) return true;
      return [row.report.reportCode, row.creatorName, row.creatorEmail, row.brandName, row.productName]
        .some((value) => String(value || '').toLowerCase().includes(keyword));
    });
  }, [overview.data?.reports, search, statusFilter]);

  const adjustmentsByReport = useMemo(() => {
    const result = new Map<number, any[]>();
    for (const item of overview.data?.adjustments || []) {
      result.set(item.reportId, [...(result.get(item.reportId) || []), item]);
    }
    return result;
  }, [overview.data?.adjustments]);

  async function openEvidence(row: any) {
    setEvidenceTarget(row);
    setEvidenceUrl('');
    setEvidenceLoading(true);
    try {
      const result = await utils.festivalEngagement.getEvidenceUrl.fetch({ reportId: row.report.id });
      setEvidenceUrl(result.url);
    } catch (error: any) {
      toast.error(error?.message || '証拠画像を取得できませんでした');
    } finally {
      setEvidenceLoading(false);
    }
  }

  function openReview(row: any) {
    setReviewTarget(row);
    setVerifiedAmount(String(row.report.verifiedAmount ?? row.report.submittedAmount ?? ''));
    setReviewReason(row.report.reviewNote || '');
  }

  if (overview.isLoading) return <div className="flex min-h-64 items-center justify-center text-gray-400"><Loader2 className="mr-2 h-5 w-5 animate-spin text-amber-400" />第2回GMV運営データを読み込み中...</div>;
  if (overview.error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-200"><ShieldAlert className="mr-2 inline h-5 w-5" />{overview.error.message}</div>;

  const summary = overview.data?.summary;
  const matches = overview.data?.matches || [];
  const matchPending = matches.filter((row: any) => ['requested', 'needs_info'].includes(row.match.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-amber-400">LCF 02 / VERIFIED SELF-REPORTED GMV</p>
          <h2 className="mt-2 text-2xl font-black text-white">マッチング・GMV運営確認</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">TikTok API自動取得ではありません。証拠画像と申告内容を運営が確認し、確認済みの自己申告GMVだけを集計します。</p>
        </div>
        <Button variant="outline" onClick={() => overview.refetch()} disabled={overview.isFetching} className="border-white/15 text-gray-200 hover:bg-white/5"><RefreshCw className={`mr-2 h-4 w-4 ${overview.isFetching ? 'animate-spin' : ''}`} />更新</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <SummaryCard label="確認待ち" value={String(summary?.pendingCount || 0)} icon={Clock3} tone="amber" />
        <SummaryCard label="差戻し" value={String(summary?.needsRevisionCount || 0)} icon={RotateCcw} tone="red" />
        <SummaryCard label="確認済み" value={String(summary?.verifiedCount || 0)} icon={CheckCircle2} tone="green" />
        <SummaryCard label="12月8日" value={money(summary?.byDate?.['2026-12-08'])} icon={CalendarDays} tone="blue" />
        <SummaryCard label="12月9日" value={money(summary?.byDate?.['2026-12-09'])} icon={CalendarDays} tone="blue" />
        <SummaryCard label="2日間累計" value={money(summary?.verifiedTotal)} icon={BarChart3} tone="purple" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="font-black text-white">GMV報告一覧</h3><p className="mt-1 text-xs text-gray-500">証拠画像は「証憑を見る」を押した時だけ期限付きURLを取得します。</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="配信者・ブランド・商品・報告ID" className="w-full border-white/15 bg-black/20 text-white sm:w-64" />
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full border-white/15 bg-black/20 text-white sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全状態</SelectItem><SelectItem value="submitted">確認待ち</SelectItem><SelectItem value="needs_revision">差戻し</SelectItem><SelectItem value="verified">確認済み</SelectItem><SelectItem value="voided">無効</SelectItem></SelectContent></Select>
            </div>
          </div>
          {reports.length ? <div className="divide-y divide-white/10">{reports.map((row: any) => {
            const history = adjustmentsByReport.get(row.report.id) || [];
            return (
              <article key={row.report.id} className="p-4 transition-colors hover:bg-white/[0.03]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${STATUS_CONFIG[row.report.status]?.className || 'bg-gray-200 text-gray-700'}`}>{STATUS_CONFIG[row.report.status]?.label || row.report.status}</span><span className="font-mono text-[11px] text-gray-500">{row.report.reportCode}</span><span className="text-xs font-bold text-amber-300">{row.report.reportDate}</span></div>
                    <h4 className="mt-3 text-base font-black text-white">{row.creatorName} <span className="text-xs font-normal text-gray-500">{row.creatorEmail}</span></h4>
                    <p className="mt-1 text-sm text-gray-300">{row.brandName}｜{row.productName}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="自己申告" value={money(row.report.submittedAmount)} /><Metric label="運営確認" value={row.report.verifiedAmount == null ? '—' : money(row.report.verifiedAmount)} /><Metric label="調整合計" value={money(row.adjustmentTotal)} /><Metric label="最終集計" value={row.report.finalAmount == null ? '集計対象外' : money(row.report.finalAmount)} /></div>
                    <div className="mt-3 grid gap-1 text-xs text-gray-500 sm:grid-cols-2"><p>注文数：{row.report.orderCount ?? '未入力'}</p><p>提出：{dateTime(row.report.submittedAt)}</p>{row.report.liveUrl && <a href={row.report.liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200">配信URLを開く<ExternalLink className="h-3 w-3" /></a>}<p>証憑：{row.report.evidenceFileName}（{Math.ceil(Number(row.report.evidenceByteSize || 0) / 1024)}KB）</p></div>
                    {row.report.note && <p className="mt-3 border-l-2 border-white/15 pl-3 text-xs leading-5 text-gray-400">申告者備考：{row.report.note}</p>}
                    {row.report.reviewNote && <p className="mt-3 border-l-2 border-amber-400 pl-3 text-xs leading-5 text-amber-100">運営メモ：{row.report.reviewNote}</p>}
                    {history.length > 0 && <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-[11px] font-black text-gray-300">返金・取消等の調整履歴</p>{history.map((item: any) => <div key={item.id} className="mt-2 flex flex-col gap-1 border-t border-white/5 pt-2 text-xs sm:flex-row sm:justify-between"><span className={Number(item.amount) < 0 ? 'font-black text-red-300' : 'font-black text-green-300'}>{Number(item.amount) > 0 ? '+' : ''}{money(item.amount)}</span><span className="text-gray-400">{item.reason}</span><span className="text-gray-600">{dateTime(item.createdAt)}</span></div>)}</div>}
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2 xl:w-56">
                    <Button variant="outline" onClick={() => openEvidence(row)} className="border-cyan-400/35 text-cyan-200 hover:bg-cyan-400/10"><FileImage className="mr-1 h-4 w-4" />証憑を見る</Button>
                    {row.report.status !== 'voided' && <Button onClick={() => openReview(row)} className="bg-amber-400 text-black hover:bg-amber-300"><CheckCircle2 className="mr-1 h-4 w-4" />審査</Button>}
                    {row.report.status === 'verified' && <Button variant="outline" onClick={() => { setAdjustTarget(row); setAdjustmentAmount(''); setAdjustmentReason(''); }} className="col-span-2 border-red-400/35 text-red-200 hover:bg-red-400/10"><RotateCcw className="mr-1 h-4 w-4" />返金・取消等を調整</Button>}
                  </div>
                </div>
              </article>
            );
          })}</div> : <div className="p-10 text-center text-sm text-gray-500">条件に該当するGMV報告はありません。</div>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-black text-white"><Handshake className="h-4 w-4 text-amber-400" />事前マッチング</h3><span className="rounded-full bg-amber-400/15 px-2 py-1 text-xs font-black text-amber-300">要対応 {matchPending}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center"><div className="bg-black/20 p-3"><p className="text-2xl font-black text-white">{matches.length}</p><p className="text-[10px] text-gray-500">全依頼</p></div><div className="bg-black/20 p-3"><p className="text-2xl font-black text-green-300">{matches.filter((row: any) => row.match.status === 'approved').length}</p><p className="text-[10px] text-gray-500">承認済み</p></div></div>
            <p className="mt-3 text-xs leading-5 text-gray-500">ブランド承認は各ブランドのLCFマイページで行います。運営は履歴を監査します。</p>
          </section>
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="flex items-center gap-2 font-black text-white"><Users className="h-4 w-4 text-amber-400" />配信者別累計（運営内）</h3>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">公開ランキングではありません。確認済み自己申告GMVと調整後金額です。</p>
            <div className="mt-4 space-y-2">{(summary?.creatorRanking || []).length ? summary?.creatorRanking.map((item: any, index: number) => <div key={item.creatorAccountId} className="flex items-center justify-between border-b border-white/5 py-2"><span className="truncate pr-2 text-sm text-gray-300">{index + 1}. {item.creatorName}</span><span className="shrink-0 font-black text-amber-300">{money(item.amount)}</span></div>) : <p className="text-sm text-gray-500">確認済みGMVはまだありません。</p>}</div>
          </section>
        </aside>
      </div>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 p-4"><h3 className="flex items-center gap-2 font-black text-white"><Handshake className="h-4 w-4 text-amber-400" />事前マッチング監査一覧</h3><p className="mt-1 text-xs text-gray-500">通常の承認はブランドがマイページで行い、運営は依頼状態・対象商品・ブランド回答・滞留を監査します。</p></div>
        {matches.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-black/20 text-gray-500"><tr><th className="px-4 py-3">状態</th><th className="px-4 py-3">ライブコマーサー</th><th className="px-4 py-3">ブランド・商品</th><th className="px-4 py-3">依頼内容・回答</th><th className="px-4 py-3">受付／最終更新</th></tr></thead><tbody className="divide-y divide-white/10">{matches.map((row: any) => <tr key={row.match.id} className="align-top"><td className="whitespace-nowrap px-4 py-3 font-black text-amber-300">{row.match.status}</td><td className="px-4 py-3"><p className="font-bold text-white">{row.creatorName}</p><p className="mt-1 text-gray-500">{row.creatorEmail}</p></td><td className="px-4 py-3"><p className="font-bold text-white">{row.brandName}</p><p className="mt-1 text-gray-400">{row.productName}</p></td><td className="min-w-72 px-4 py-3 text-gray-400"><p>{row.match.message}</p>{row.match.brandReply && <p className="mt-2 border-l-2 border-amber-400 pl-2 text-amber-100">回答：{row.match.brandReply}</p>}</td><td className="whitespace-nowrap px-4 py-3 text-gray-500"><p>{dateTime(row.match.createdAt)}</p><p className="mt-1">更新 {dateTime(row.match.updatedAt)}</p></td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-gray-500">事前マッチング依頼はまだありません。</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <InternalTotals title="ブランド別確認済みGMV" rows={(summary?.brandTotals || []).map((item: any) => ({ id: item.brandProfileId, label: item.brandName, amount: item.amount }))} />
        <InternalTotals title="商品別確認済みGMV" rows={(summary?.productTotals || []).map((item: any) => ({ id: item.productId, label: `${item.brandName}｜${item.productName}`, amount: item.amount }))} />
      </div>

      <Dialog open={Boolean(evidenceTarget)} onOpenChange={(open) => { if (!open) { setEvidenceTarget(null); setEvidenceUrl(''); } }}>
        <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>非公開GMV証憑</DialogTitle><DialogDescription>{evidenceTarget?.report?.reportCode}｜{evidenceTarget?.creatorName}｜期限付きURLは1時間で失効します。</DialogDescription></DialogHeader><div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-gray-950">{evidenceLoading ? <Loader2 className="h-8 w-8 animate-spin text-amber-400" /> : evidenceUrl ? <img src={evidenceUrl} alt={`${evidenceTarget?.report?.reportCode}の非公開GMV証拠画像`} referrerPolicy="no-referrer" className="max-h-[70vh] w-auto max-w-full object-contain" /> : <div className="text-center text-gray-400"><ImageOff className="mx-auto mb-2 h-8 w-8" />画像を取得できませんでした</div>}</div><p className="text-xs text-gray-500">この画像・URLを外部へ共有しないでください。閲覧操作は監査ログへ記録されます。</p></DialogContent>
      </Dialog>

      <Dialog open={Boolean(reviewTarget)} onOpenChange={(open) => { if (!open && !review.isPending) setReviewTarget(null); }}>
        <DialogContent><DialogHeader><DialogTitle>GMV報告を審査</DialogTitle><DialogDescription>{reviewTarget?.report?.reportCode}｜自己申告 {money(reviewTarget?.report?.submittedAmount)}</DialogDescription></DialogHeader><div className="space-y-4"><label className="block text-sm font-bold text-gray-700">確認済みGMV（円）<Input type="number" inputMode="numeric" min="0" step="1" value={verifiedAmount} onChange={(event) => setVerifiedAmount(event.target.value)} className="mt-2" /></label><label className="block text-sm font-bold text-gray-700">運営メモ・理由<Textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} placeholder="金額修正の根拠、差戻し・無効化理由" className="mt-2 min-h-24" /></label><p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">「確認済み」にした報告だけが日別・累計へ入ります。差戻し・無効化には理由が必須です。</p></div><DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Button variant="outline" onClick={() => reviewTarget && review.mutate({ reportId: reviewTarget.report.id, action: 'needs_revision', verifiedAmount: null, reason: reviewReason || null })} disabled={review.isPending} className="border-red-300 text-red-700"><RotateCcw className="mr-1 h-4 w-4" />差戻し</Button><Button variant="outline" onClick={() => reviewTarget && review.mutate({ reportId: reviewTarget.report.id, action: 'void', verifiedAmount: null, reason: reviewReason || null })} disabled={review.isPending} className="border-gray-300 text-gray-700"><XCircle className="mr-1 h-4 w-4" />無効化</Button><Button onClick={() => reviewTarget && review.mutate({ reportId: reviewTarget.report.id, action: 'verify', verifiedAmount: Number(verifiedAmount), reason: reviewReason || null })} disabled={review.isPending || verifiedAmount === ''} className="bg-emerald-600 text-white hover:bg-emerald-700">{review.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}確認済みにする</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={Boolean(adjustTarget)} onOpenChange={(open) => { if (!open && !adjust.isPending) setAdjustTarget(null); }}>
        <DialogContent><DialogHeader><DialogTitle>返金・取消等の調整を追加</DialogTitle><DialogDescription>{adjustTarget?.report?.reportCode}｜現在の最終集計 {money(adjustTarget?.report?.finalAmount)}</DialogDescription></DialogHeader><div className="space-y-4"><label className="block text-sm font-bold text-gray-700">調整額（円）<Input type="number" inputMode="numeric" step="1" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} placeholder="返金は -5000、追加計上は 5000" className="mt-2" /></label><label className="block text-sm font-bold text-gray-700">理由（必須）<Textarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="返金・取消・追加確認の根拠" className="mt-2 min-h-24" /></label><p className="rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-900">元報告は削除せず、符号付き調整として履歴へ追加します。返金・取消はマイナスで入力してください。</p></div><DialogFooter><Button variant="outline" onClick={() => setAdjustTarget(null)} disabled={adjust.isPending}>戻る</Button><Button onClick={() => adjustTarget && adjust.mutate({ reportId: adjustTarget.report.id, amount: Number(adjustmentAmount), reason: adjustmentReason })} disabled={adjust.isPending || !adjustmentAmount || Number(adjustmentAmount) === 0 || !adjustmentReason.trim()} className="bg-red-600 text-white hover:bg-red-700">{adjust.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />}調整を記録</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: 'amber' | 'red' | 'green' | 'blue' | 'purple' }) {
  const tones = { amber: 'text-amber-300 bg-amber-400/10', red: 'text-red-300 bg-red-400/10', green: 'text-green-300 bg-green-400/10', blue: 'text-cyan-300 bg-cyan-400/10', purple: 'text-fuchsia-300 bg-fuchsia-400/10' };
  return <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></div><p className="mt-3 text-[10px] text-gray-500">{label}</p><p className="mt-1 truncate text-lg font-black text-white" title={value}>{value}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border-l border-white/10 pl-3"><p className="text-[10px] text-gray-500">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>;
}

function InternalTotals({ title, rows }: { title: string; rows: Array<{ id: number; label: string; amount: number }> }) {
  return <section className="rounded-xl border border-white/10 bg-white/5 p-4"><h3 className="font-black text-white">{title}</h3><p className="mt-1 text-[11px] text-gray-500">運営確認済み・返金等の調整後。外部公開はしません。</p><div className="mt-4 space-y-2">{rows.length ? rows.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-white/5 py-2"><span className="min-w-0 truncate pr-3 text-sm text-gray-300">{item.label}</span><span className="shrink-0 font-black text-amber-300">{money(item.amount)}</span></div>) : <p className="text-sm text-gray-500">確認済みGMVはまだありません。</p>}</div></section>;
}
