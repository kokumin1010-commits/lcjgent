/**
 * LCM brand page: editorial brand storytelling plus commerce-ready product cards.
 * Archive profiles remain clearly labelled and never imply current wholesale availability.
 */
import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, BadgeJapaneseYen, BadgePercent, Building2, CalendarDays, ExternalLink, PackageSearch, ShieldCheck, ShoppingBag } from "lucide-react";
import { LcmArchiveBadge, LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { LcmProductImage } from "@/components/lcm/LcmProductImage";
import { lcf2026ExhibitorCatalogPages } from "@/data/lcf2026ExhibitorCatalog";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";
import { LCM_CAMPAIGNS_ENABLED } from "@shared/lcmFeatureFlags";

function safeLines(value?: string) {
  return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function formatListPrice(value: string | number | null | undefined, taxMode?: string | null) {
  if (value == null || value === "") return "価格はブランドへ確認";
  const amount = Number(value);
  const formatted = Number.isFinite(amount) ? `¥${amount.toLocaleString("ja-JP")}` : String(value);
  if (taxMode === "included") return `${formatted}（税込）`;
  if (taxMode === "excluded") return `${formatted}（税別）`;
  return formatted;
}

export default function LcmBrand() {
  const [, params] = useRoute<{ slug: string }>("/lcm/brands/:slug");
  const slug = params?.slug || "";
  const catalogPage = slug.startsWith("catalog-") ? Number(slug.replace("catalog-", "")) : null;
  const archive = catalogPage ? lcf2026ExhibitorCatalogPages.find((item) => item.page === catalogPage && item.pageType === "出展企業紹介") : undefined;
  const dynamicBrand = trpc.lcm.getPublicBrand.useQuery({ slug }, { enabled: !archive && Boolean(slug), retry: false });
  const brand = dynamicBrand.data;

  useEffect(() => {
    const title = archive?.name || brand?.displayName || "ブランド";
    const description = archive ? `${archive.name}のLCF 2026出展アーカイブ。${archive.productTitle || "掲載商品"}の紙面情報を確認できます。` : `${brand?.displayName || "ブランド"}の商品、販売先、ライブコマース向け情報を掲載しています。`;
    return applyPageSeo({ title: `${title}｜LCM ライブコマースマーケット`, description, canonicalPath: `/lcm/brands/${slug}`, image: archive?.imageUrl || brand?.coverUrl || brand?.logoUrl || "https://www.livecommercefestival.com/favicon.ico", jsonLd: [{ "@context": "https://schema.org", "@type": "Organization", name: title, url: `https://www.livecommercefestival.com/lcm/brands/${slug}`, description }] });
  }, [archive, brand, slug]);

  if (archive) {
    return <LcmPublicLayout><main>
      <section className="border-b border-black/15 bg-[#fffdf8] px-5 py-12 md:px-8 md:py-20"><div className="mx-auto max-w-[1320px]"><Link href="/lcm" className="inline-flex items-center text-sm font-black"><ArrowLeft className="mr-2 h-4 w-4" />商品一覧へ</Link><div className="mt-8 grid gap-10 lg:grid-cols-[.82fr_1.18fr]">
        <div className="min-h-[320px] border border-black/15 bg-white p-3"><LcmProductImage src={archive.imageUrl} alt={archive.alt} className="h-auto w-full" /></div>
        <div className="self-center"><LcmArchiveBadge /><p className="mt-5 text-xs font-black tracking-[0.18em] text-[#9b6200]">{archive.category}</p><h1 className="mt-2 text-4xl font-black tracking-tight md:text-7xl">{archive.name}</h1><p className="mt-6 text-2xl font-black leading-tight">{archive.productTitle}</p>{archive.price && <p className="mt-4 inline-flex bg-[#f7cc35] px-4 py-2 text-lg font-black">参考価格 {archive.price}</p>}
          <div className="mt-8 grid gap-2">{safeLines(archive.highlights).slice(0, 8).map((line) => <div key={line} className="flex gap-3 border-t border-black/10 py-3 text-sm font-bold"><span className="text-[#d45b16]">●</span><span>{line}</span></div>)}</div>
          <div className="mt-8 border border-black/15 bg-[#f6f4ee] p-5 text-sm leading-7 text-black/65"><ShieldCheck className="mb-2 h-5 w-5" />このページは第1回LCF出展カタログの記録です。現在のサンプル提供・卸条件を保証するものではありません。</div>
          <div className="mt-5 flex flex-wrap gap-3"><Link href={`/lcm/manage?claim=${archive.page}`} className="inline-flex items-center bg-[#171714] px-5 py-3 text-sm font-black text-white"><Building2 className="mr-2 h-4 w-4" />このブランドページを管理</Link><Link href="/livecommercefestival/2026/exhibitors" className="inline-flex items-center border border-black px-5 py-3 text-sm font-black">全カタログを見る</Link></div>
        </div>
      </div></div></section>
      {(archive.otherProducts || archive.message) && <section className="mx-auto grid max-w-[1320px] gap-px bg-black/15 px-5 py-14 md:grid-cols-2 md:px-8 md:py-20"><article className="bg-white p-7"><p className="text-xs font-black tracking-[0.16em] text-black/45">OTHER PRODUCTS</p><h2 className="mt-2 text-2xl font-black">その他の取扱商材</h2><p className="mt-5 whitespace-pre-line text-sm leading-8 text-black/65">{archive.otherProducts || "紙面をご確認ください。"}</p></article><article className="bg-[#171714] p-7 text-white"><p className="text-xs font-black tracking-[0.16em] text-white/45">MESSAGE</p><blockquote className="mt-5 text-2xl font-black leading-relaxed">{archive.message || "ブランドからの情報は紙面をご確認ください。"}</blockquote></article></section>}
    </main></LcmPublicLayout>;
  }

  if (dynamicBrand.isLoading) return <LcmPublicLayout><main className="grid min-h-[60vh] place-items-center"><p className="font-bold">ブランド情報を読み込んでいます…</p></main></LcmPublicLayout>;
  if (!brand) return <LcmPublicLayout><main className="grid min-h-[60vh] place-items-center px-5 text-center"><div><PackageSearch className="mx-auto h-12 w-12 text-black/25" /><h1 className="mt-5 text-3xl font-black">ブランドが見つかりません</h1><Link href="/lcm" className="mt-5 inline-flex font-bold underline">LCMへ戻る</Link></div></main></LcmPublicLayout>;

  return <LcmPublicLayout><main>
    <section className="relative min-h-[430px] overflow-hidden bg-[#171714] text-white">{brand.coverUrl && <img src={brand.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />}<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10" /><div className="relative mx-auto max-w-[1320px] px-5 py-16 md:px-8 md:py-24"><Link href="/lcm" className="inline-flex items-center text-sm font-black text-white/80"><ArrowLeft className="mr-2 h-4 w-4" />商品一覧へ</Link><div className="mt-16 max-w-3xl"><p className="text-xs font-black tracking-[0.2em] text-[#f7cc35]">{brand.category || "LCM BRAND"}</p><h1 className="mt-3 text-5xl font-black tracking-tight md:text-8xl">{brand.displayName}</h1>{brand.tagline && <p className="mt-6 text-xl font-bold leading-relaxed md:text-3xl">{brand.tagline}</p>}</div></div></section>
    <section className="mx-auto max-w-[1320px] px-5 py-14 md:px-8 md:py-20"><div className="grid gap-10 md:grid-cols-[1fr_320px]"><article><h2 className="text-3xl font-black">ブランドについて</h2><p className="mt-5 whitespace-pre-line text-base leading-8 text-black/65">{brand.description || "ブランド情報を準備中です。"}</p>{brand.story && <><h2 className="mt-12 text-3xl font-black">ブランドストーリー</h2><p className="mt-5 whitespace-pre-line text-base leading-8 text-black/65">{brand.story}</p></>}</article><aside className="border border-black/15 bg-white p-5"><p className="text-xs font-black tracking-[0.16em] text-black/45">OFFICIAL LINKS</p><div className="mt-4 grid gap-2">{[["公式サイト", brand.officialWebsiteUrl], ["TikTok Shop", brand.tiktokShopUrl], ["Amazon", brand.amazonUrl], ["楽天", brand.rakutenUrl], ["その他の販売先", brand.otherSalesUrl]].filter(([, url]) => url).map(([label, url]) => <a key={label} href={url!} target="_blank" rel="noreferrer" className="flex items-center justify-between border border-black/15 px-4 py-3 text-sm font-black hover:border-black">{label}<ExternalLink className="h-4 w-4" /></a>)}</div></aside></div>
      {LCM_CAMPAIGNS_ENABLED && (brand.campaigns || []).length > 0 && <section className="mt-16"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5"><div><p className="flex items-center gap-2 text-xs font-black tracking-[0.18em] text-[#9b6200]"><BadgePercent className="h-4 w-4" />CAMPAIGNS</p><h2 className="mt-2 text-3xl font-black md:text-5xl">公式キャンペーン</h2></div><p className="text-xs font-bold text-black/45">報酬・割引の正確な条件はLCM会員限定</p></div><div className="mt-7 grid gap-3 md:grid-cols-2">{brand.campaigns.map((campaign) => <Link key={campaign.id} href={`/lcm/campaigns/${campaign.slug}`} className="group grid overflow-hidden border border-black/15 bg-white sm:grid-cols-[180px_1fr]"><div className="aspect-[16/9] bg-[#eeeae0] sm:aspect-auto"><LcmProductImage src={campaign.heroImageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" /></div><div className="p-5"><div className="flex flex-wrap items-center gap-2"><span className={`px-2 py-1 text-[9px] font-black ${campaign.periodState === "active" ? "bg-[#16805b] text-white" : campaign.periodState === "upcoming" ? "bg-[#f7cc35]" : "bg-black/10"}`}>{campaign.periodState === "active" ? "実施中" : campaign.periodState === "upcoming" ? "開始前" : "終了"}</span></div><h3 className="mt-3 text-xl font-black">{campaign.title}</h3><p className="mt-2 line-clamp-2 text-xs leading-6 text-black/55">{campaign.summary || campaign.description}</p><span className="mt-4 inline-flex items-center text-xs font-black"><CalendarDays className="mr-1.5 h-4 w-4 text-[#d45b16]" />期間・対象商品を見る<ArrowRight className="ml-1 h-4 w-4" /></span></div></Link>)}</div></section>}
      <div className="mt-16 flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5"><div><p className="flex items-center gap-2 text-xs font-black tracking-[0.18em] text-[#9b6200]"><ShoppingBag className="h-4 w-4" />PRODUCTS</p><h2 className="mt-2 text-3xl font-black md:text-5xl">取扱商品</h2></div><p className="inline-flex items-center text-xs font-bold text-black/45"><BadgeJapaneseYen className="mr-1 h-4 w-4" />定価は公開、取引条件は会員限定</p></div><div className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">{brand.products.map((item) => <Link key={item.id} href={`/lcm/products/${item.slug}`} className="group flex min-w-0 flex-col border border-black/10 bg-white p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-black hover:shadow-[5px_5px_0_rgba(0,0,0,.12)] sm:p-3"><div className="relative aspect-square overflow-hidden bg-[#eeeae0]"><LcmProductImage src={item.primaryImageUrl} alt={`${item.name}の商品写真`} className="h-full w-full object-contain p-2 transition duration-200 group-hover:scale-[1.025]" />{item.sampleAvailable && <span className="absolute bottom-2 left-2 bg-[#dff5ea] px-2 py-1 text-[9px] font-black text-[#126445]">サンプル対応</span>}</div><p className="mt-3 truncate text-[10px] font-bold text-black/45 sm:text-xs">{item.category || brand.displayName}</p><h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-black leading-5 sm:text-base">{item.name}</h3><p className="mt-3 text-sm font-black sm:text-base">{formatListPrice(item.listPrice, item.taxMode)}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-black/55">{item.summary || "商品情報を見る"}</p><span className="mt-auto flex items-center justify-between border-t border-black/10 pt-3 text-xs font-black">商品詳細<ArrowRight className="h-4 w-4" /></span></Link>)}{brand.products.length === 0 && <div className="col-span-full border border-dashed border-black/25 bg-white p-10 text-center"><PackageSearch className="mx-auto h-9 w-9 text-black/20" /><p className="mt-3 font-black">公開商品を準備中です</p></div>}</div>
    </section>
  </main></LcmPublicLayout>;
}
