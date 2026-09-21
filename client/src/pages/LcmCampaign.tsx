import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { AlertTriangle, ArrowLeft, ArrowRight, BadgePercent, CalendarDays, CheckCircle2, Clock3, ExternalLink, Gift, LockKeyhole, PackageCheck, RadioTower, ShieldCheck, Target } from "lucide-react";
import { LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { LcmProductImage } from "@/components/lcm/LcmProductImage";
import { buildFestivalLoginUrl } from "@/lib/festivalPortal";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

const periodLabels: Record<string, string> = { active: "実施中", upcoming: "開始前", ended: "終了", undated: "期間確認中" };
const trackingLabels: Record<string, string> = { platform: "販売プラットフォーム実績", coupon: "専用クーポン", affiliate_link: "専用リンク", manual_report: "ブランド確認・手動集計", other: "個別条件" };

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "未設定";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("ja-JP", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "未設定";
}

function formatPercentRange(min: string | number | null | undefined, max: string | number | null | undefined) {
  if (min == null || max == null) return "ブランドへ確認";
  const left = Number(min);
  const right = Number(max);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return "ブランドへ確認";
  return left === right ? `${left}%` : `${left}%〜${right}%`;
}

function formatPrice(value: string | number | null | undefined) {
  if (value == null || value === "") return "価格はブランドへ確認";
  const amount = Number(value);
  return Number.isFinite(amount) ? `¥${amount.toLocaleString("ja-JP")}` : String(value);
}

export default function LcmCampaign() {
  const [, params] = useRoute<{ slug: string }>("/lcm/campaigns/:slug");
  const slug = params?.slug || "";
  const campaignQuery = trpc.lcm.getPublicCampaign.useQuery({ slug }, { enabled: Boolean(slug), retry: false });
  const meQuery = trpc.festivalAuth.me.useQuery(undefined, { retry: false });
  const accessQuery = trpc.lcm.getMyAccess.useQuery(undefined, { enabled: Boolean(meQuery.data), retry: false });
  const campaign = campaignQuery.data;
  const approved = accessQuery.data?.membership?.status === "approved";
  const memberQuery = trpc.lcm.getMemberCampaign.useQuery({ campaignId: campaign?.id || 0 }, { enabled: Boolean(campaign?.id && approved), retry: false });
  const member = memberQuery.data;
  const loginHref = buildFestivalLoginUrl(`/lcm/campaigns/${slug}`);
  const termsHref = meQuery.data ? "/lcm/manage?workspace=creator" : loginHref;

  useEffect(() => applyPageSeo({
    title: `${campaign?.title || "キャンペーン"}｜LCM`,
    description: campaign?.summary || "ブランド公式ライブコマースキャンペーンの期間と対象商品を確認できます。正確な募集条件はLCM会員限定です。",
    canonicalPath: `/lcm/campaigns/${slug}`,
    image: campaign?.heroImageUrl || "https://www.livecommercefestival.com/favicon.ico",
    jsonLd: campaign ? { "@context": "https://schema.org", "@type": "Event", name: campaign.title, description: campaign.summary || campaign.description, startDate: campaign.startsAt || undefined, endDate: campaign.endsAt || undefined, organizer: { "@type": "Brand", name: campaign.brandName }, url: `https://www.livecommercefestival.com/lcm/campaigns/${campaign.slug}` } : undefined,
  }), [campaign, slug]);

  if (campaignQuery.isLoading) return <LcmPublicLayout><main className="grid min-h-[65vh] place-items-center"><p className="font-bold">キャンペーンを読み込んでいます…</p></main></LcmPublicLayout>;
  if (!campaign) return <LcmPublicLayout><main className="grid min-h-[65vh] place-items-center px-5 text-center"><div><BadgePercent className="mx-auto h-12 w-12 text-black/20" /><h1 className="mt-4 text-3xl font-black">キャンペーンが見つかりません</h1><Link href="/lcm/campaigns" className="mt-5 inline-flex font-black underline">キャンペーン一覧へ</Link></div></main></LcmPublicLayout>;

  return <LcmPublicLayout><main className="bg-[#f4f1e9]">
    <section className="relative overflow-hidden bg-[#171714] text-white"><div className="absolute inset-0"><LcmProductImage src={campaign.heroImageUrl} alt="" loading="eager" className="h-full w-full object-cover opacity-45" /><div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20" /></div><div className="relative mx-auto max-w-[1400px] px-5 py-12 md:px-8 md:py-20"><Link href="/lcm/campaigns" className="inline-flex items-center text-sm font-black text-white/75"><ArrowLeft className="mr-2 h-4 w-4" />キャンペーン一覧</Link><div className="mt-12 max-w-4xl"><div className="flex flex-wrap items-center gap-2"><span className={`px-3 py-1.5 text-xs font-black ${campaign.periodState === "active" ? "bg-[#16805b] text-white" : campaign.periodState === "upcoming" ? "bg-[#f7cc35] text-black" : "bg-white/15"}`}>{periodLabels[campaign.periodState] || campaign.periodState}</span></div><Link href={`/lcm/brands/${campaign.brandSlug}`} className="mt-6 inline-flex items-center text-sm font-black text-[#f7cc35]">{campaign.brandName}<ArrowRight className="ml-1 h-4 w-4" /></Link><h1 className="mt-3 text-[clamp(2.8rem,7vw,6.8rem)] font-black leading-[.9] tracking-[-.055em]">{campaign.title}</h1><p className="mt-7 max-w-3xl whitespace-pre-line text-base font-semibold leading-8 text-white/70">{campaign.summary || campaign.description}</p></div></div></section>

    <section className="mx-auto max-w-[1400px] px-5 py-10 md:px-8 md:py-14">
      <div className="grid gap-px bg-black/15 md:grid-cols-3"><article className="bg-white p-5 md:p-6"><CalendarDays className="h-6 w-6 text-[#d45b16]" /><p className="mt-4 text-xs font-black text-black/45">開始</p><p className="mt-1 font-black">{formatDateTime(campaign.startsAt)}</p></article><article className="bg-white p-5 md:p-6"><Clock3 className="h-6 w-6 text-[#d45b16]" /><p className="mt-4 text-xs font-black text-black/45">終了</p><p className="mt-1 font-black">{formatDateTime(campaign.endsAt)}</p></article><article className="bg-white p-5 md:p-6"><PackageCheck className="h-6 w-6 text-[#16805b]" /><p className="mt-4 text-xs font-black text-black/45">対象商品</p><p className="mt-1 font-black">{campaign.products.length}商品から選品</p></article></div>
      {campaign.description && campaign.description !== campaign.summary && <section className="mt-10 grid gap-5 border-y border-black/15 py-9 md:grid-cols-[260px_1fr]"><div><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">CAMPAIGN STORY</p><h2 className="mt-2 text-3xl font-black">募集概要</h2></div><p className="whitespace-pre-line text-base leading-8 text-black/65">{campaign.description}</p></section>}

      <section className="mt-12 overflow-hidden border border-black/15" aria-labelledby="campaign-terms-heading"><div className="bg-[#171714] p-6 text-white md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[0.18em] text-[#f7cc35]">MEMBER ONLY TERMS</p><h2 id="campaign-terms-heading" className="mt-2 text-3xl font-black md:text-5xl">報酬・割引・配信条件</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">数値だけで判断せず、成果対象、返品・取消、計測方法、支払時期、表現ルールをまとめて確認してください。</p></div><LockKeyhole className="h-8 w-8 shrink-0 text-[#f7cc35]" /></div></div>
        {approved && member ? <div className="bg-white p-5 md:p-8"><div className="grid gap-px bg-black/15 md:grid-cols-2"><article className="bg-[#fff7d8] p-6"><BadgePercent className="h-6 w-6 text-[#9b6200]" /><p className="mt-4 text-xs font-black text-black/45">成果報酬率</p><p className="mt-1 text-4xl font-black">{formatPercentRange(member.commissionRateMin, member.commissionRateMax)}</p><p className="mt-3 whitespace-pre-line text-xs leading-6 text-black/55">{member.rewardNotes}</p></article><article className="bg-[#eff8f3] p-6"><BadgePercent className="h-6 w-6 text-[#16805b]" /><p className="mt-4 text-xs font-black text-black/45">購入者向け割引率</p><p className="mt-1 text-4xl font-black">{formatPercentRange(member.discountRateMin, member.discountRateMax)}</p><p className="mt-3 text-xs leading-6 text-black/55">商品・販売チャネル・配信者ごとの適用条件は下記を確認してください。</p></article></div><div className="mt-6 grid gap-4 md:grid-cols-2"><Term icon={<Target />} title="対象クリエイター・参加条件" value={member.eligibility} /><Term icon={<RadioTower />} title="計測方法" value={trackingLabels[member.trackingMethod] || member.trackingMethod} /><Term icon={<CheckCircle2 />} title="成果確定・支払条件" value={member.settlementTerms} /><Term icon={<Gift />} title="サンプル条件" value={member.sampleAvailable ? member.samplePolicy || "ブランドへ確認" : "キャンペーンとしてのサンプル提供なし"} /><Term icon={<RadioTower />} title="制作・配信ガイド" value={member.creativeGuidance} /><Term icon={<AlertTriangle />} title="NG表現・注意事項" value={member.prohibitedClaims} /></div>{member.applicationNotes && <div className="mt-5 border-l-4 border-[#f7cc35] bg-[#fffaf0] p-5"><p className="text-xs font-black tracking-[0.12em]">応募・連絡時の注意</p><p className="mt-2 whitespace-pre-line text-sm leading-7 text-black/65">{member.applicationNotes}</p></div>}</div> : <div className="bg-white p-7 text-center md:p-12"><LockKeyhole className="mx-auto h-10 w-10 text-black/20" /><h3 className="mt-4 text-2xl font-black">正確な率と取引条件はLCM会員限定です</h3><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-black/55">公開画面では募集の有無と対象商品だけを確認できます。ログイン後に、成果報酬率、割引率、計測・支払条件、サンプル条件、配信ガイドを一つの画面で確認できます。</p><Link href={termsHref} className="mt-6 inline-flex items-center bg-[#171714] px-6 py-3 text-sm font-black text-white">{meQuery.data ? "LCM利用登録へ" : "ログインして条件を見る"}<ArrowRight className="ml-2 h-4 w-4" /></Link></div>}
      </section>

      <section className="mt-12" aria-labelledby="campaign-products-heading"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5"><div><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">ELIGIBLE PRODUCTS</p><h2 id="campaign-products-heading" className="mt-2 text-3xl font-black md:text-5xl">対象商品から選ぶ</h2></div><p className="text-xs font-bold text-black/45">商品詳細で配信ポイント・サンプルを確認</p></div><div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{campaign.products.map((product) => <Link key={product.id} href={`/lcm/products/${product.slug}`} className="group flex min-w-0 flex-col border border-black/10 bg-white p-2.5 transition hover:-translate-y-0.5 hover:border-black"><div className="relative aspect-square overflow-hidden bg-[#eeeae0]"><LcmProductImage src={product.primaryImageUrl} alt={`${product.name}の商品写真`} className="h-full w-full object-contain p-2 transition group-hover:scale-[1.025]" />{product.sampleAvailable && <span className="absolute bottom-2 left-2 bg-[#dff5ea] px-2 py-1 text-[9px] font-black text-[#126445]">サンプル</span>}</div><p className="mt-3 truncate text-[10px] font-bold text-black/45">{product.brandName}</p><h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-black leading-5">{product.name}</h3><p className="mt-3 text-sm font-black">{formatPrice(product.listPrice)}</p><span className="mt-auto flex items-center justify-between border-t border-black/10 pt-3 text-xs font-black">商品詳細<ArrowRight className="h-4 w-4" /></span></Link>)}</div></section>

      <section className="mt-12 grid gap-px bg-black/15 md:grid-cols-3"><article className="bg-white p-6"><ShieldCheck className="h-6 w-6 text-[#16805b]" /><h3 className="mt-4 font-black">ブランド登録情報</h3><p className="mt-2 text-sm leading-7 text-black/55">このページの募集条件はブランド管理者が登録しています。</p></article><article className="bg-white p-6"><LockKeyhole className="h-6 w-6 text-[#d45b16]" /><h3 className="mt-4 font-black">条件は自動契約ではありません</h3><p className="mt-2 text-sm leading-7 text-black/55">閲覧や商品選択だけで成果報酬・割引・サンプル提供が確定することはありません。</p></article><article className="bg-white p-6"><ExternalLink className="h-6 w-6 text-[#d45b16]" /><h3 className="mt-4 font-black">最終条件を確認</h3><p className="mt-2 text-sm leading-7 text-black/55">配信前に対象売上、取消・返品、計測期間、支払日をブランドと合意してください。</p></article></section>
    </section>
  </main></LcmPublicLayout>;
}

function Term({ icon, title, value }: { icon: React.ReactNode; title: string; value: string | null | undefined }) {
  return <article className="border border-black/10 bg-[#faf9f5] p-5"><div className="flex items-center gap-2 text-[#d45b16] [&>svg]:h-5 [&>svg]:w-5">{icon}<h3 className="text-sm font-black text-black">{title}</h3></div><p className="mt-3 whitespace-pre-line text-sm leading-7 text-black/60">{value || "ブランドへ確認"}</p></article>;
}
