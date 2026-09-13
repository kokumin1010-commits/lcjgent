/**
 * LCM brand page: editorial brand storytelling plus commerce-ready product cards.
 * Archive profiles remain clearly labelled and never imply current wholesale availability.
 */
import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, Building2, ExternalLink, PackageSearch, ShieldCheck } from "lucide-react";
import { LcmArchiveBadge, LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { lcf2026ExhibitorCatalogPages } from "@/data/lcf2026ExhibitorCatalog";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

function safeLines(value?: string) {
  return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
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
        <div className="border border-black/15 bg-white p-3"><img src={archive.imageUrl} alt={archive.alt} className="h-auto w-full" /></div>
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
      <div className="mt-16 border-b border-black/20 pb-5"><p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">PRODUCTS</p><h2 className="mt-2 text-3xl font-black md:text-5xl">取扱商品</h2></div><div className="mt-8 grid gap-px bg-black/15 sm:grid-cols-2 lg:grid-cols-3">{brand.products.map((item) => <Link key={item.id} href={`/lcm/products/${item.slug}`} className="group bg-white p-4 hover:bg-[#fff8dc]"><div className="aspect-square overflow-hidden bg-[#eeeae0]">{item.primaryImageUrl ? <img src={item.primaryImageUrl} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : null}</div><p className="mt-4 text-xs font-bold text-black/45">{item.category}</p><h3 className="mt-1 text-xl font-black">{item.name}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-black/60">{item.summary}</p><span className="mt-4 inline-flex items-center text-sm font-black">商品詳細<ArrowRight className="ml-2 h-4 w-4" /></span></Link>)}</div>
    </section>
  </main></LcmPublicLayout>;
}
