/**
 * 第2回LCFの事前マッチングと自己申告GMV。
 * Design: operational black/gold, clear status provenance, no invented sales or automatic TikTok claims.
 */
import { useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Clock3, FileImage, Handshake, Loader2, MessageSquareText, PackageSearch, RotateCcw, Send, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { LcmProductImage } from '@/components/lcm/LcmProductImage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MATCH_STATUS: Record<string, { label: string; className: string }> = {
  requested: { label: 'ブランド確認中', className: 'border-amber-400/35 bg-amber-400/10 text-amber-200' },
  needs_info: { label: '追加確認', className: 'border-sky-400/35 bg-sky-400/10 text-sky-200' },
  approved: { label: 'マッチング承認済み', className: 'border-green-400/35 bg-green-400/10 text-green-200' },
  declined: { label: '見送り', className: 'border-red-400/35 bg-red-400/10 text-red-200' },
  cancelled: { label: '取消済み', className: 'border-white/15 bg-white/5 text-gray-400' },
  completed: { label: '完了', className: 'border-green-400/35 bg-green-400/10 text-green-200' },
};

const GMV_STATUS: Record<string, { label: string; className: string }> = {
  submitted: { label: '運営確認中', className: 'border-amber-400/35 bg-amber-400/10 text-amber-200' },
  needs_revision: { label: '差戻し・再提出待ち', className: 'border-red-400/35 bg-red-400/10 text-red-200' },
  verified: { label: '運営確認済み', className: 'border-green-400/35 bg-green-400/10 text-green-200' },
  voided: { label: '無効', className: 'border-white/15 bg-white/5 text-gray-400' },
};

function StatusPill({ status, type }: { status: string; type: 'match' | 'gmv' }) {
  const config = (type === 'match' ? MATCH_STATUS : GMV_STATUS)[status] || { label: status, className: 'border-white/15 bg-white/5 text-gray-300' };
  return <span className={`inline-flex w-fit border px-2.5 py-1 text-[11px] font-black ${config.className}`}>{config.label}</span>;
}

function formatMoney(value: unknown) {
  return `¥${Math.round(Number(value || 0)).toLocaleString('ja-JP')}`;
}

function readEvidence(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const encoded = result.includes(',') ? result.slice(result.indexOf(',') + 1) : '';
      if (!encoded) reject(new Error('画像を読み込めませんでした'));
      else resolve(encoded);
    };
    reader.onerror = () => reject(new Error('画像を読み込めませんでした'));
    reader.readAsDataURL(file);
  });
}

export function LcfEngagementCenter() {
  const utils = trpc.useUtils();
  const eligibility = trpc.festivalEngagement.getEligibility.useQuery(undefined, { retry: false });
  const canRequest = Boolean(eligibility.data?.canRequestMatching);
  const canReview = Boolean(eligibility.data?.canReviewMatching);
  const products = trpc.festivalEngagement.listEligibleProducts.useQuery(undefined, { enabled: canRequest, retry: false });
  const myMatches = trpc.festivalEngagement.listMyMatches.useQuery(undefined, { enabled: canRequest, retry: false });
  const myReports = trpc.festivalEngagement.listMyGmvReports.useQuery(undefined, { enabled: canRequest, retry: false });
  const brandMatches = trpc.festivalEngagement.listBrandMatches.useQuery(undefined, { enabled: canReview, retry: false });
  const [activeView, setActiveView] = useState<'matching' | 'gmv'>('matching');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [matchMessage, setMatchMessage] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const [gmvOpen, setGmvOpen] = useState(false);
  const [replacementReport, setReplacementReport] = useState<any | null>(null);
  const [gmvMatchId, setGmvMatchId] = useState('');
  const [gmvDate, setGmvDate] = useState<'2026-12-08' | '2026-12-09'>('2026-12-08');
  const [gmvAmount, setGmvAmount] = useState('');
  const [orderCount, setOrderCount] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [gmvNote, setGmvNote] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [brandReplies, setBrandReplies] = useState<Record<number, string>>({});

  const refreshCreator = async () => {
    await Promise.all([
      utils.festivalEngagement.listMyMatches.invalidate(),
      utils.festivalEngagement.listMyGmvReports.invalidate(),
      utils.festivalEngagement.getEligibility.invalidate(),
    ]);
  };

  const createMatch = trpc.festivalEngagement.createMatchRequest.useMutation({
    onSuccess: async () => {
      toast.success('事前マッチング依頼を送信しました');
      setSelectedProduct(null);
      setMatchMessage('');
      setPlannedDate('');
      setContactConsent(false);
      await refreshCreator();
    },
    onError: (error) => toast.error(error.message),
  });
  const cancelMatch = trpc.festivalEngagement.cancelMatch.useMutation({
    onSuccess: async () => { toast.success('マッチング依頼を取り消しました'); await refreshCreator(); },
    onError: (error) => toast.error(error.message),
  });
  const respondMatch = trpc.festivalEngagement.respondToMatch.useMutation({
    onSuccess: async () => {
      toast.success('マッチング依頼を更新しました');
      await Promise.all([brandMatches.refetch(), utils.festivalEngagement.listMyMatches.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const submitGmv = trpc.festivalEngagement.submitGmvReport.useMutation({
    onSuccess: async () => { toast.success('GMV報告を送信しました'); closeGmv(); await refreshCreator(); },
    onError: (error) => toast.error(error.message),
  });
  const resubmitGmv = trpc.festivalEngagement.resubmitGmvReport.useMutation({
    onSuccess: async () => { toast.success('修正したGMV報告を再提出しました'); closeGmv(); await refreshCreator(); },
    onError: (error) => toast.error(error.message),
  });

  const approvedMatches = useMemo(() => (myMatches.data || []).filter((item: any) => item.match.status === 'approved'), [myMatches.data]);
  const pendingGmv = (myReports.data || []).filter((item: any) => item.report.status === 'submitted').reduce((sum: number, item: any) => sum + Number(item.report.submittedAmount || 0), 0);
  const verifiedGmv = (myReports.data || []).filter((item: any) => item.report.status === 'verified').reduce((sum: number, item: any) => sum + Number(item.report.verifiedAmount || 0), 0);

  function openGmv(report?: any) {
    setReplacementReport(report || null);
    setGmvMatchId(String(report?.report?.matchRequestId || approvedMatches[0]?.match?.id || ''));
    setGmvDate((report?.report?.reportDate || '2026-12-08') as '2026-12-08' | '2026-12-09');
    setGmvAmount(report ? String(report.report.submittedAmount) : '');
    setOrderCount(report?.report?.orderCount == null ? '' : String(report.report.orderCount));
    setLiveUrl(report?.report?.liveUrl || '');
    setGmvNote(report?.report?.note || '');
    setEvidenceFile(null);
    setGmvOpen(true);
  }

  function closeGmv() {
    setGmvOpen(false);
    setReplacementReport(null);
    setEvidenceFile(null);
  }

  async function handleGmvSubmit() {
    if (!evidenceFile) return toast.error('証拠スクリーンショットを選択してください');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(evidenceFile.type)) return toast.error('JPEG・PNG・WebP画像を選択してください');
    if (evidenceFile.size > 8 * 1024 * 1024) return toast.error('証拠画像は8MB以下にしてください');
    if (!gmvMatchId || !gmvAmount) return toast.error('マッチングとGMVを入力してください');
    try {
      const base64Data = await readEvidence(evidenceFile);
      const payload = {
        reportDate: gmvDate,
        submittedAmount: Number(gmvAmount),
        orderCount: orderCount ? Number(orderCount) : null,
        liveUrl: liveUrl || null,
        note: gmvNote || null,
        fileName: evidenceFile.name,
        mimeType: evidenceFile.type as 'image/jpeg' | 'image/png' | 'image/webp',
        base64Data,
      };
      if (replacementReport) resubmitGmv.mutate({ reportId: replacementReport.report.id, ...payload });
      else submitGmv.mutate({ matchRequestId: Number(gmvMatchId), ...payload });
    } catch (error: any) {
      toast.error(error?.message || '画像を読み込めませんでした');
    }
  }

  if (eligibility.isLoading) return <div className="border border-white/10 bg-white/5 p-6 text-sm text-gray-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />第2回LCF運用機能を確認中...</div>;
  if (!canRequest && !canReview) return null;

  return (
    <section className="overflow-hidden border border-amber-400/25 bg-[#111116]">
      <div className="border-b border-white/10 bg-gradient-to-r from-amber-500/10 to-transparent p-5 sm:p-6">
        <p className="text-[10px] font-black tracking-[0.2em] text-amber-400">LCF 02 / LIVE COMMERCE OPERATIONS</p>
        <h2 className="mt-2 text-xl font-black sm:text-2xl">出展商品マッチング・GMV報告</h2>
        <p className="mt-2 text-xs leading-6 text-gray-400">公式LINEへの転送ではなく、依頼・証拠画像・確認状態をこのマイページへ保存します。</p>
      </div>

      {canRequest && (
        <>
          <div className="grid grid-cols-2 border-b border-white/10">
            <button type="button" onClick={() => setActiveView('matching')} className={`min-h-12 border-r border-white/10 px-3 text-sm font-black ${activeView === 'matching' ? 'bg-amber-400 text-black' : 'text-gray-300 hover:bg-white/5'}`}><Handshake className="mr-2 inline h-4 w-4" />事前マッチング</button>
            <button type="button" onClick={() => setActiveView('gmv')} className={`min-h-12 px-3 text-sm font-black ${activeView === 'gmv' ? 'bg-amber-400 text-black' : 'text-gray-300 hover:bg-white/5'}`}><BarChart3 className="mr-2 inline h-4 w-4" />GMV報告</button>
          </div>

          {activeView === 'matching' ? (
            <div className="space-y-6 p-4 sm:p-6">
              <div>
                <h3 className="flex items-center gap-2 text-base font-black"><PackageSearch className="h-4 w-4 text-amber-400" />第2回LCFの出展商品から選ぶ</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">承認済み出展企業がLCMで正式公開した商品だけを表示します。</p>
              </div>
              {products.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-amber-400" /> : (products.data || []).length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(products.data || []).map((product: any) => (
                    <article key={product.id} className="border border-white/10 bg-black/30 p-2.5">
                      <LcmProductImage src={product.imageUrl} alt={`${product.brandName} ${product.name}`} className="aspect-square w-full object-cover" fallbackClassName="aspect-square" />
                      <p className="mt-2 truncate text-[10px] font-bold text-amber-300">{product.brandName}</p>
                      <h4 className="mt-1 line-clamp-2 min-h-10 text-sm font-black leading-5">{product.name}</h4>
                      {product.listPrice != null && <p className="mt-1 text-sm font-black">{formatMoney(product.listPrice)}<span className="ml-1 text-[9px] text-gray-500">定価</span></p>}
                      <button type="button" onClick={() => setSelectedProduct(product)} className="mt-3 min-h-10 w-full bg-amber-400 px-2 text-xs font-black text-black hover:bg-amber-300">マッチングを依頼</button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-white/15 bg-black/20 p-5 text-sm text-gray-400">第2回LCFの承認済み出展商品が公開されると、ここに表示されます。</div>
              )}

              <div>
                <h3 className="text-base font-black">依頼履歴</h3>
                <div className="mt-3 space-y-3">
                  {(myMatches.data || []).length ? (myMatches.data || []).map((item: any) => (
                    <article key={item.match.id} className="border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div><p className="text-xs font-bold text-amber-300">{item.brandName}</p><h4 className="mt-1 font-black">{item.productName}</h4><p className="mt-2 text-xs leading-5 text-gray-400">{item.match.message}</p></div>
                        <StatusPill status={item.match.status} type="match" />
                      </div>
                      {item.match.brandReply && <div className="mt-3 border-l-2 border-amber-400 bg-amber-400/5 p-3 text-xs leading-5 text-gray-300"><MessageSquareText className="mr-1 inline h-3.5 w-3.5 text-amber-400" />{item.match.brandReply}</div>}
                      {item.counterpartContact && <p className="mt-3 text-xs text-green-300">承認後のブランド連絡先：{item.counterpartContact}</p>}
                      {['requested', 'needs_info'].includes(item.match.status) && <button type="button" onClick={() => cancelMatch.mutate({ id: item.match.id })} className="mt-3 text-xs font-bold text-red-300 hover:text-red-200">依頼を取り消す</button>}
                    </article>
                  )) : <p className="text-sm text-gray-500">事前マッチング依頼はまだありません。</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-amber-400/20 bg-amber-400/5 p-4"><p className="text-[10px] text-gray-500">運営確認中</p><p className="mt-1 text-xl font-black text-amber-300">{formatMoney(pendingGmv)}</p></div>
                <div className="border border-green-400/20 bg-green-400/5 p-4"><p className="text-[10px] text-gray-500">運営確認済み</p><p className="mt-1 text-xl font-black text-green-300">{formatMoney(verifiedGmv)}</p></div>
              </div>
              <button type="button" onClick={() => openGmv()} disabled={!approvedMatches.length} className="min-h-12 w-full bg-amber-400 px-4 text-sm font-black text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"><Send className="mr-2 inline h-4 w-4" />本日のGMVを報告</button>
              {!approvedMatches.length && <p className="text-xs leading-5 text-gray-500">GMV報告には承認済みの事前マッチングが必要です。</p>}
              <div className="space-y-3">
                {(myReports.data || []).length ? (myReports.data || []).map((item: any) => (
                  <article key={item.report.id} className="border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-amber-300">{item.report.reportDate}｜{item.brandName}</p><h4 className="mt-1 font-black">{item.productName}</h4></div><StatusPill status={item.report.status} type="gmv" /></div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-[10px] text-gray-500">自己申告GMV</p><p className="font-black">{formatMoney(item.report.submittedAmount)}</p></div><div><p className="text-[10px] text-gray-500">運営確認額</p><p className="font-black text-green-300">{item.report.verifiedAmount == null ? '確認中' : formatMoney(item.report.verifiedAmount)}</p></div></div>
                    {item.report.reviewNote && <p className="mt-3 border-l-2 border-red-400 bg-red-400/5 p-3 text-xs leading-5 text-red-100">{item.report.reviewNote}</p>}
                    {item.report.status === 'needs_revision' && <button type="button" onClick={() => openGmv(item)} className="mt-3 min-h-10 border border-amber-400/40 px-4 text-xs font-black text-amber-200 hover:bg-amber-400/10"><RotateCcw className="mr-2 inline h-3.5 w-3.5" />修正して再提出</button>}
                  </article>
                )) : <p className="text-sm text-gray-500">GMV報告はまだありません。</p>}
              </div>
            </div>
          )}
        </>
      )}

      {canReview && (
        <div className="border-t border-white/10 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-base font-black"><ShieldCheck className="h-4 w-4 text-amber-400" />出展ブランドへのマッチング依頼</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">承認後だけ双方の連絡先を共有します。公式LINEへの転送は不要です。</p>
          <div className="mt-4 space-y-3">
            {(brandMatches.data || []).length ? (brandMatches.data || []).map((item: any) => (
              <article key={item.match.id} className="border border-white/10 bg-black/25 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold text-amber-300">{item.creatorName}</p><h4 className="mt-1 font-black">{item.productName}</h4><p className="mt-2 text-xs leading-5 text-gray-400">{item.match.message}</p></div><StatusPill status={item.match.status} type="match" /></div>
                {item.creatorContact && <p className="mt-3 text-xs text-green-300">承認後の連絡先：{item.creatorContact}</p>}
                {['requested', 'needs_info'].includes(item.match.status) && (
                  <div className="mt-4 space-y-3">
                    <textarea value={brandReplies[item.match.id] || ''} onChange={(event) => setBrandReplies((current) => ({ ...current, [item.match.id]: event.target.value }))} placeholder="追加確認・見送り時の連絡（承認時は任意）" className="min-h-20 w-full border border-white/15 bg-black/30 p-3 text-sm text-white outline-none focus:border-amber-400" />
                    <div className="grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => respondMatch.mutate({ id: item.match.id, action: 'approve', message: brandReplies[item.match.id] || null })} className="min-h-10 bg-green-500 px-2 text-xs font-black text-black hover:bg-green-400"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />承認</button>
                      <button type="button" onClick={() => respondMatch.mutate({ id: item.match.id, action: 'needs_info', message: brandReplies[item.match.id] || null })} className="min-h-10 border border-sky-400/40 px-2 text-xs font-black text-sky-200 hover:bg-sky-400/10"><Clock3 className="mr-1 inline h-3.5 w-3.5" />追加確認</button>
                      <button type="button" onClick={() => respondMatch.mutate({ id: item.match.id, action: 'decline', message: brandReplies[item.match.id] || null })} className="min-h-10 border border-red-400/40 px-2 text-xs font-black text-red-200 hover:bg-red-400/10"><XCircle className="mr-1 inline h-3.5 w-3.5" />見送り</button>
                    </div>
                  </div>
                )}
              </article>
            )) : <p className="mt-4 text-sm text-gray-500">ブランドへの事前マッチング依頼はまだありません。</p>}
          </div>
        </div>
      )}

      <Dialog open={Boolean(selectedProduct)} onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}>
        <DialogContent className="max-w-lg border-amber-400/25 bg-[#111116] text-white">
          <DialogHeader><DialogTitle>事前マッチングを依頼</DialogTitle><DialogDescription className="text-gray-400">{selectedProduct?.brandName}「{selectedProduct?.name}」への依頼内容を入力します。</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <label className="block text-xs font-bold text-gray-300">希望日時（任意）<input type="datetime-local" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white" /></label>
            <label className="block text-xs font-bold text-gray-300">依頼内容<textarea value={matchMessage} onChange={(event) => setMatchMessage(event.target.value)} placeholder="配信予定、希望サンプル、確認したい条件など" className="mt-2 min-h-28 w-full border border-white/15 bg-black/30 p-3 text-sm text-white outline-none focus:border-amber-400" /></label>
            <label className="flex items-start gap-3 border border-white/10 bg-white/5 p-3 text-xs leading-5 text-gray-300"><input type="checkbox" checked={contactConsent} onChange={(event) => setContactConsent(event.target.checked)} className="mt-1" />ブランドが承認した場合、登録済みの連絡先を相互共有することに同意します。</label>
            <button type="button" onClick={() => selectedProduct && createMatch.mutate({ productId: selectedProduct.id, message: matchMessage, plannedDate: plannedDate ? new Date(plannedDate) : null, contactShareConsent: true })} disabled={!matchMessage.trim() || !contactConsent || createMatch.isPending} className="min-h-12 w-full bg-amber-400 px-4 text-sm font-black text-black hover:bg-amber-300 disabled:opacity-40">{createMatch.isPending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Send className="mr-2 inline h-4 w-4" />}依頼を送信</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gmvOpen} onOpenChange={(open) => { if (!open) closeGmv(); }}>
        <DialogContent className="max-w-lg border-amber-400/25 bg-[#111116] text-white">
          <DialogHeader><DialogTitle>{replacementReport ? 'GMV報告を修正して再提出' : '本日のGMVを報告'}</DialogTitle><DialogDescription className="text-gray-400">本人の自己申告額です。証拠画像を運営が確認した後に集計へ反映されます。</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {!replacementReport && <label className="block text-xs font-bold text-gray-300">承認済みマッチング<select value={gmvMatchId} onChange={(event) => setGmvMatchId(event.target.value)} className="mt-2 min-h-11 w-full border border-white/15 bg-[#111116] px-3 text-sm text-white"><option value="">選択してください</option>{approvedMatches.map((item: any) => <option key={item.match.id} value={item.match.id}>{item.brandName}｜{item.productName}</option>)}</select></label>}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-gray-300">報告対象日<select value={gmvDate} onChange={(event) => setGmvDate(event.target.value as any)} className="mt-2 min-h-11 w-full border border-white/15 bg-[#111116] px-3 text-sm text-white"><option value="2026-12-08">12月8日</option><option value="2026-12-09">12月9日</option></select></label>
              <label className="block text-xs font-bold text-gray-300">自己申告GMV（円）<input inputMode="numeric" type="number" min="0" step="1" value={gmvAmount} onChange={(event) => setGmvAmount(event.target.value)} className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-bold text-gray-300">注文数（任意）<input inputMode="numeric" type="number" min="0" step="1" value={orderCount} onChange={(event) => setOrderCount(event.target.value)} className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white" /></label><label className="block text-xs font-bold text-gray-300">配信URL（任意）<input type="url" value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://..." className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white" /></label></div>
            <label className="block text-xs font-bold text-gray-300">証拠スクリーンショット（8MB以下）<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} className="mt-2 block w-full border border-dashed border-amber-400/30 bg-amber-400/5 p-4 text-xs text-gray-300 file:mr-3 file:border-0 file:bg-amber-400 file:px-3 file:py-2 file:font-black file:text-black" /></label>
            <label className="block text-xs font-bold text-gray-300">備考（任意）<textarea value={gmvNote} onChange={(event) => setGmvNote(event.target.value)} className="mt-2 min-h-20 w-full border border-white/15 bg-black/30 p-3 text-sm text-white" /></label>
            <div className="border border-amber-400/25 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100"><FileImage className="mr-1 inline h-3.5 w-3.5" />この数字は「自己申告GMV」として送信され、運営確認済みになった後だけアワード集計へ反映されます。</div>
            <button type="button" onClick={handleGmvSubmit} disabled={submitGmv.isPending || resubmitGmv.isPending} className="min-h-12 w-full bg-amber-400 px-4 text-sm font-black text-black hover:bg-amber-300 disabled:opacity-40">{(submitGmv.isPending || resubmitGmv.isPending) ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Send className="mr-2 inline h-4 w-4" />}{replacementReport ? '修正して再提出' : '自己申告GMVを送信'}</button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
