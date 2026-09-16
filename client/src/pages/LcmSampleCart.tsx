/**
 * LCM sample cart: compact comparison and request preparation, never a purchase
 * checkout. Warm editorial surfaces, explicit eligibility, and product-by-product results.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Heart, PackageCheck, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { LcmProductImage } from "@/components/lcm/LcmProductImage";
import { buildFestivalLoginUrl } from "@/lib/festivalPortal";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

function formatPrice(value: string | number | null | undefined, taxMode?: string | null) {
  if (value == null || value === "") return "価格はブランドへ確認";
  const amount = Number(value);
  const formatted = Number.isFinite(amount) ? `¥${amount.toLocaleString("ja-JP")}` : String(value);
  return taxMode === "included" ? `${formatted}（税込）` : taxMode === "excluded" ? `${formatted}（税別）` : formatted;
}

export default function LcmSampleCart() {
  const me = trpc.festivalAuth.me.useQuery(undefined, { retry: false });
  const access = trpc.lcm.getMyAccess.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const cart = trpc.lcm.listMySampleCart.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const interests = trpc.lcm.listMyInterests.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const engagement = trpc.lcm.getMyEngagementSummary.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [purpose, setPurpose] = useState("");
  const [plannedContentType, setPlannedContentType] = useState<"live" | "short_video" | "both" | "other">("live");
  const [plannedDate, setPlannedDate] = useState("");
  const [message, setMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => applyPageSeo({ title: "サンプルカート｜LCM", description: "LCMでサンプル候補商品を比較し、商品ごとに安全に申請できます。", canonicalPath: "/lcm/sample-cart", image: "https://www.livecommercefestival.com/favicon.ico", robots: "noindex, nofollow, noarchive" }), []);

  const availableIds = useMemo(() => (cart.data || []).filter((item) => item.sampleAvailable && item.productStatus === "published" && item.brandStatus === "published").map((item) => item.productId), [cart.data]);
  useEffect(() => { setSelectedIds((current) => current.length ? current.filter((id) => availableIds.includes(id)) : availableIds); }, [availableIds.join(",")]);
  useEffect(() => { if (access.data?.account?.displayName && !recipientName) setRecipientName(access.data.account.displayName); }, [access.data?.account?.displayName, recipientName]);

  const toggleCart = trpc.lcm.toggleSampleCart.useMutation({
    onSuccess: async () => { await Promise.all([cart.refetch(), engagement.refetch()]); },
    onError: (error) => toast.error(error.message),
  });
  const submitCart = trpc.lcm.submitSampleCart.useMutation({
    onSuccess: async (data) => {
      if (data.created.length) toast.success(`${data.created.length}商品のサンプル申請を受け付けました`);
      if (data.skipped.length) toast.warning(`${data.skipped.length}商品は申請できませんでした。商品別理由をご確認ください`);
      setSelectedIds(data.skipped.map((item) => item.productId));
      await Promise.all([cart.refetch(), engagement.refetch()]);
    },
    onError: (error) => toast.error(error.message),
  });

  if (me.isLoading) return <LcmPublicLayout><main className="grid min-h-[55vh] place-items-center"><p className="font-black">サンプルカートを読み込んでいます…</p></main></LcmPublicLayout>;
  if (!me.data) return <LcmPublicLayout><main className="mx-auto grid min-h-[55vh] max-w-2xl place-items-center px-5 text-center"><div><ShoppingCart className="mx-auto h-12 w-12 text-black/25" /><h1 className="mt-5 text-3xl font-black">ログインしてサンプル候補を管理</h1><p className="mt-3 text-sm leading-7 text-black/55">LCF・LCM共通アカウントで、興味商品とサンプルカートを端末をまたいで確認できます。</p><Link href={buildFestivalLoginUrl("/lcm/sample-cart")} className="mt-6 inline-flex bg-[#171714] px-6 py-3 text-sm font-black text-white">共通ログインへ</Link></div></main></LcmPublicLayout>;

  const approved = access.data?.membership?.status === "approved";
  const selectedSet = new Set(selectedIds);
  return <LcmPublicLayout><main className="min-h-[70vh] bg-[#f4f1e9] px-4 py-8 md:px-8 md:py-12"><div className="mx-auto max-w-[1200px]">
    <Link href="/lcm" className="inline-flex items-center text-sm font-black"><ArrowLeft className="mr-2 h-4 w-4" />商品一覧へ</Link>
    <div className="mt-6 grid gap-4 border-b border-black/15 pb-6 md:grid-cols-[1fr_auto] md:items-end"><div><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">SAMPLE CART</p><h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">サンプル候補を、まとめて確認。</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-black/55">これは購入カートではありません。商品を比較し、正式申請時に商品ごとの受付状態・重複・月間上限を再確認します。</p></div><span className="inline-flex items-center bg-[#171714] px-4 py-3 text-sm font-black text-white"><ShoppingCart className="mr-2 h-5 w-5" />{cart.data?.length || 0}商品</span></div>

    <section className="mt-8 grid gap-3">
      {(cart.data || []).map((item) => {
        const available = item.sampleAvailable && item.productStatus === "published" && item.brandStatus === "published";
        return <article key={item.cartItemId} className="grid gap-4 border border-black/10 bg-white p-3 sm:grid-cols-[120px_1fr_auto] sm:items-center"><Link href={`/lcm/products/${item.productSlug}`} className="aspect-square overflow-hidden bg-[#f1eee6]"><LcmProductImage src={item.primaryImageUrl} alt={`${item.productName}の商品写真`} className="h-full w-full object-contain p-2" /></Link><div className="min-w-0"><p className="truncate text-xs font-black text-black/45">{item.brandName}</p><Link href={`/lcm/products/${item.productSlug}`} className="mt-1 block font-black hover:underline">{item.productName}</Link><p className="mt-2 text-sm font-black">{formatPrice(item.listPrice, item.taxMode)}</p><p className={`mt-2 text-[11px] font-bold ${available ? "text-[#16805b]" : "text-[#b42f26]"}`}>{available ? "サンプル申請可能" : "現在申請できません"}</p></div><div className="flex items-center gap-2 sm:flex-col"><button type="button" disabled={!available} onClick={() => setSelectedIds((current) => current.includes(item.productId) ? current.filter((id) => id !== item.productId) : [...current, item.productId])} className={`inline-flex min-h-10 flex-1 items-center justify-center px-3 text-xs font-black sm:w-28 ${selectedSet.has(item.productId) ? "bg-[#16805b] text-white" : "border border-black/15 bg-white"}`}>{selectedSet.has(item.productId) && <Check className="mr-1 h-4 w-4" />}{selectedSet.has(item.productId) ? "申請対象" : "選択"}</button><button type="button" onClick={() => toggleCart.mutate({ productId: item.productId })} aria-label={`${item.productName}をサンプルカートから削除`} className="inline-flex min-h-10 items-center justify-center border border-black/15 px-3 text-xs font-black text-black/55"><Trash2 className="mr-1 h-4 w-4" />削除</button></div></article>;
      })}
      {!cart.isLoading && (cart.data?.length || 0) === 0 && <div className="border border-dashed border-black/20 bg-white p-10 text-center"><ShoppingCart className="mx-auto h-9 w-9 text-black/20" /><h2 className="mt-4 text-xl font-black">サンプルカートは空です</h2><p className="mt-2 text-sm text-black/45">サンプル対応商品から候補を追加してください。</p><Link href="/lcm" className="mt-5 inline-flex bg-[#171714] px-5 py-3 text-sm font-black text-white">商品を探す</Link></div>}
    </section>

    {(cart.data?.length || 0) > 0 && <section className="mt-8 border border-black/15 bg-white p-5 md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[0.16em] text-[#16805b]">REQUEST</p><h2 className="mt-2 text-2xl font-black">選択した商品を正式申請</h2></div><PackageCheck className="h-8 w-8 text-[#16805b]" /></div>{approved ? <form onSubmit={(event) => { event.preventDefault(); submitCart.mutate({ productIds: selectedIds, purpose, plannedContentType, plannedDate: plannedDate ? new Date(`${plannedDate}T12:00:00`) : null, message: message || null, recipientName, postalCode, address, phone }); }} className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-xs font-black md:col-span-2">利用目的<textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} minLength={10} maxLength={5000} required rows={4} className="mt-2 w-full border border-black/20 p-3 text-sm leading-6 outline-none focus:border-black" placeholder="予定している配信内容、紹介したい理由など" /></label><label className="text-xs font-black">予定コンテンツ<select value={plannedContentType} onChange={(event) => setPlannedContentType(event.target.value as typeof plannedContentType)} className="mt-2 h-12 w-full border border-black/20 bg-white px-3 text-sm"><option value="live">ライブ配信</option><option value="short_video">ショート動画</option><option value="both">ライブ配信＋ショート動画</option><option value="other">その他</option></select></label><label className="text-xs font-black">予定日<input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} className="mt-2 h-12 w-full border border-black/20 px-3 text-sm" /></label><label className="text-xs font-black">受取人名<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} required maxLength={255} className="mt-2 h-12 w-full border border-black/20 px-3 text-sm" /></label><label className="text-xs font-black">郵便番号<input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} required minLength={3} maxLength={20} className="mt-2 h-12 w-full border border-black/20 px-3 text-sm" /></label><label className="text-xs font-black md:col-span-2">住所<textarea value={address} onChange={(event) => setAddress(event.target.value)} required minLength={5} maxLength={2000} rows={3} className="mt-2 w-full border border-black/20 p-3 text-sm" /></label><label className="text-xs font-black">電話番号<input value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={7} maxLength={50} className="mt-2 h-12 w-full border border-black/20 px-3 text-sm" /></label><label className="text-xs font-black">ブランドへの連絡<input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} className="mt-2 h-12 w-full border border-black/20 px-3 text-sm" /></label><div className="md:col-span-2"><button type="submit" disabled={!selectedIds.length || submitCart.isPending} className="inline-flex min-h-12 items-center bg-[#16805b] px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{submitCart.isPending ? "申請中…" : `${selectedIds.length}商品を申請する`}</button><p className="mt-3 text-[11px] font-bold text-black/40">各商品は独立した申請として作成され、ブランドごとに審査・発送されます。</p></div></form> : <div className="mt-6 border-l-4 border-[#f7cc35] bg-[#fff8dd] p-5"><p className="text-sm font-bold leading-7">正式なサンプル申請にはLCM会員承認が必要です。カートの商品はそのまま保持されます。</p><Link href="/lcm/manage" className="mt-4 inline-flex bg-[#171714] px-5 py-3 text-sm font-black text-white">会員登録・確認へ</Link></div>}</section>}

    <section className="mt-12 border-t border-black/15 pt-8"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black tracking-[0.16em] text-[#b42f26]">INTERESTS</p><h2 className="mt-1 text-2xl font-black">興味あり商品</h2></div><Heart className="h-7 w-7 text-[#b42f26]" /></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{(interests.data || []).map((item) => <Link key={item.id} href={`/lcm/products/${item.slug}`} className="border border-black/10 bg-white p-2"><div className="aspect-square overflow-hidden bg-[#f1eee6]"><LcmProductImage src={item.primaryImageUrl} alt={`${item.name}の商品写真`} className="h-full w-full object-contain p-2" /></div><p className="mt-2 truncate text-[10px] font-black text-black/45">{item.brandName}</p><p className="mt-1 line-clamp-2 min-h-9 text-xs font-black leading-[1.1rem]">{item.name}</p></Link>)}{!interests.isLoading && (interests.data?.length || 0) === 0 && <p className="col-span-full py-6 text-sm font-bold text-black/40">興味あり商品はまだありません。</p>}</div></section>
  </div></main></LcmPublicLayout>;
}
