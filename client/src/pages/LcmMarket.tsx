/**
 * LCM market design: bright commerce catalogue inspired by Japanese department-store
 * flyers and B2B exhibitions. Search-first, image-led, with no consumer checkout fiction.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Building2, CheckCircle2, PackageCheck, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { LcmArchiveBadge, LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { lcf2026ExhibitorCatalogPages } from "@/data/lcf2026ExhibitorCatalog";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

const categories = ["すべて", "美容・コスメ", "食品・飲料", "健康・ウェルネス", "ファッション", "ライフスタイル"];

function normalize(value: string | null | undefined) {
  return String(value || "").normalize("NFKC").toLowerCase();
}

export default function LcmMarket() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const liveProducts = trpc.lcm.listPublicProducts.useQuery({ limit: 60 }, { retry: false });
  const liveStats = trpc.lcm.publicStats.useQuery(undefined, { retry: false });

  useEffect(() => {
    return applyPageSeo({
      title: "LCM｜ライブコマースマーケット｜ブランド・商品・サンプル・卸商談",
      description: "LCF出展ブランドとライブコマース向け商品を検索。商品情報、販売先、サンプル、会員限定卸条件を確認し、ブランドとの商談へ進めるB2Bマーケットです。",
      canonicalPath: "/lcm",
      image: lcf2026ExhibitorCatalogPages.find((item) => item.page === 29)?.imageUrl || "https://www.livecommercefestival.com/favicon.ico",
      jsonLd: [
        { "@context": "https://schema.org", "@type": "WebSite", name: "LCM｜ライブコマースマーケット", url: "https://www.livecommercefestival.com/lcm" },
        { "@context": "https://schema.org", "@type": "CollectionPage", name: "LCM 商品・ブランドディレクトリ", description: "ライブコマース向けブランドと商品を探せるB2Bマーケット", url: "https://www.livecommercefestival.com/lcm" },
      ],
    });
  }, []);

  const archiveItems = useMemo(() => lcf2026ExhibitorCatalogPages.filter((item) => item.pageType === "出展企業紹介" && item.productTitle), []);
  const filteredArchive = useMemo(() => {
    const q = normalize(query);
    return archiveItems.filter((item) => {
      const categoryMatches = category === "すべて" || normalize(item.category).includes(normalize(category).split("・")[0]);
      const queryMatches = !q || normalize([item.name, item.category, item.productTitle, item.highlights, item.otherProducts].join(" ")).includes(q);
      return categoryMatches && queryMatches;
    });
  }, [archiveItems, category, query]);
  const filteredLiveProducts = (liveProducts.data || []).filter((item) => {
    const q = normalize(query);
    const categoryMatches = category === "すべて" || normalize(item.category).includes(normalize(category).split("・")[0]);
    const queryMatches = !q || normalize([item.name, item.brandName, item.category, item.summary].join(" ")).includes(q);
    return categoryMatches && queryMatches;
  });

  return (
    <LcmPublicLayout>
      <main>
        <section className="border-b border-black/15 bg-[#fffdf8]">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 md:grid-cols-[1.05fr_.95fr] md:px-8 md:py-24">
            <div className="self-center">
              <p className="text-xs font-black tracking-[0.22em] text-[#9b6200]">LIVE COMMERCE MARKET</p>
              <h1 className="mt-5 max-w-4xl text-[clamp(2.7rem,7vw,7.2rem)] font-black leading-[.86] tracking-[-0.07em]">
                売りたい商品と、<br /><span className="text-[#d45b16]">売れる人</span>が出会う。
              </h1>
              <p className="mt-7 max-w-2xl text-base font-medium leading-8 text-black/65 md:text-lg">LCF出展企業の商品を起点に、ブランド情報、販売先、サンプル、卸商談を一つの場所へ。購入サイトではなく、ライブコマースの取引を始めるB2B市場です。</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#products" className="inline-flex items-center bg-[#f7cc35] px-5 py-3 text-sm font-black text-black">商品を探す<ArrowRight className="ml-2 h-4 w-4" /></a>
                <Link href="/lcm/creators" className="inline-flex items-center border border-black bg-white px-5 py-3 text-sm font-black"><Users className="mr-2 h-4 w-4" />ライバーを探す</Link>
                <Link href="/lcm/manage" className="inline-flex items-center border border-black bg-white px-5 py-3 text-sm font-black">ブランドを登録する</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 self-end border-t border-black/20 pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <div className="border border-black/15 bg-[#f7cc35] p-5 md:p-7"><p className="text-4xl font-black md:text-6xl">50</p><p className="mt-2 text-xs font-bold">第1回参加企業</p></div>
              <div className="border border-black/15 bg-white p-5 md:p-7"><p className="text-4xl font-black md:text-6xl">32</p><p className="mt-2 text-xs font-bold">公開カタログページ</p></div>
              <div className="col-span-2 border border-black/15 bg-[#171714] p-5 text-white md:p-7"><p className="text-4xl font-black md:text-6xl">8,000万円</p><p className="mt-2 text-xs font-bold text-white/65">第1回開催実績 GMV</p></div>
              {(liveStats.data?.brandCount || liveStats.data?.productCount) ? <div className="col-span-2 flex gap-6 border border-black/15 bg-white p-5 text-sm font-bold"><span>公開ブランド {liveStats.data.brandCount}</span><span>公開商品 {liveStats.data.productCount}</span></div> : null}
            </div>
          </div>
        </section>

        <section id="products" className="mx-auto max-w-[1440px] px-5 py-14 md:px-8 md:py-20">
          <div className="grid gap-7 lg:grid-cols-[280px_1fr]">
            <aside className="self-start border border-black/15 bg-white p-5 lg:sticky lg:top-24">
              <p className="text-xs font-black tracking-[0.18em] text-black/45">FILTER</p>
              <label className="mt-4 block text-sm font-black" htmlFor="lcm-search">商品・ブランド検索</label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                <input id="lcm-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="商品名、企業名、特徴" className="h-12 w-full border border-black/20 bg-[#faf9f5] pl-10 pr-3 text-sm outline-none focus:border-black" />
              </div>
              <p className="mt-6 text-sm font-black">カテゴリ</p>
              <div className="mt-2 grid gap-1.5">
                {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`px-3 py-2 text-left text-sm font-bold ${category === item ? "bg-[#171714] text-white" : "bg-[#f6f4ee] hover:bg-[#eee9dc]"}`}>{item}</button>)}
              </div>
              <div className="mt-6 border-t border-black/10 pt-5 text-xs leading-6 text-black/55">
                <ShieldCheck className="mb-2 h-5 w-5 text-[#16805b]" />卸条件と申請情報は、LCM承認会員だけに表示します。
              </div>
            </aside>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5">
                <div><p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">PRODUCT DIRECTORY</p><h2 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">商品から、商談を始める。</h2></div>
                <p className="text-sm font-bold text-black/50">{filteredLiveProducts.length + filteredArchive.length}件を表示</p>
              </div>

              {filteredLiveProducts.length > 0 && <div className="mt-8">
                <p className="mb-4 flex items-center gap-2 text-xs font-black tracking-[0.16em]"><CheckCircle2 className="h-4 w-4 text-[#16805b]" />ブランド確認済み商品</p>
                <div className="grid gap-px bg-black/15 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredLiveProducts.map((item) => <Link key={item.id} href={`/lcm/products/${item.slug}`} className="group bg-white p-4 transition hover:bg-[#fff8dc]">
                    <div className="aspect-square overflow-hidden bg-[#eeeae0]">{item.primaryImageUrl ? <img src={item.primaryImageUrl} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" /> : <div className="grid h-full place-items-center"><PackageCheck className="h-12 w-12 text-black/20" /></div>}</div>
                    <p className="mt-4 text-xs font-bold text-black/50">{item.brandName}</p><h3 className="mt-1 text-lg font-black leading-snug">{item.name}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">{item.sampleAvailable && <span className="bg-[#dff5ea] px-2 py-1 text-[11px] font-black text-[#126445]">サンプル申請可</span>}<span className="border border-black/15 px-2 py-1 text-[11px] font-bold">詳細を見る</span></div>
                  </Link>)}
                </div>
              </div>}

              <div className="mt-10">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><LcmArchiveBadge /><span className="text-xs text-black/50">紙面の掲載内容をそのまま確認できます</span></div></div>
                {filteredArchive.length ? <div className="grid gap-px bg-black/15 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredArchive.map((item) => <Link key={item.page} href={`/lcm/brands/catalog-${item.page}`} className="group bg-white p-4 transition hover:bg-[#fff8dc]">
                    <div className="aspect-[4/5] overflow-hidden bg-[#eeeae0]"><img src={item.thumbnailUrl} alt={item.alt} className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.025]" loading="lazy" /></div>
                    <p className="mt-4 text-[11px] font-black tracking-[0.12em] text-[#9b6200]">{item.category || "LCF EXHIBITOR"}</p>
                    <h3 className="mt-1 text-xl font-black leading-tight">{item.name}</h3><p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-black/65">{item.productTitle}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-3"><span className="text-sm font-black">{item.price || "価格は紙面で確認"}</span><ArrowRight className="h-4 w-4" /></div>
                  </Link>)}
                </div> : <div className="border border-black/15 bg-white p-10 text-center"><Search className="mx-auto h-8 w-8 text-black/25" /><p className="mt-3 font-black">該当する商品がありません</p><button type="button" onClick={() => { setQuery(""); setCategory("すべて"); }} className="mt-4 text-sm font-bold underline">条件をリセット</button></div>}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/15 bg-[#f7cc35] px-5 py-16 md:px-8 md:py-20">
          <div className="mx-auto grid max-w-[1440px] gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div><p className="text-xs font-black tracking-[0.2em]">FOR BRANDS</p><h2 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">カタログを、育つブランドページへ。</h2><p className="mt-5 max-w-3xl text-base font-semibold leading-8">商品、画像、販売先、サンプル、会員限定卸条件を自社で更新。初回公開と重要な変更はLCF運営が確認します。</p></div>
            <Link href="/lcm/manage" className="inline-flex items-center justify-center bg-[#171714] px-7 py-4 text-sm font-black text-white">ブランド管理を始める<ArrowRight className="ml-2 h-4 w-4" /></Link>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-16 md:px-8 md:py-20">
          <div className="grid gap-px bg-black/15 md:grid-cols-3">
            {[{ icon: Building2, title: "ブランドが自分で更新", text: "商品追加や情報更新を積み重ね、検索される公式ページへ。" }, { icon: Users, title: "ライバーを公式ページから探す", text: "本人同意・運営確認済みの得意分野と配信形式から候補を検索。", href: "/lcm/creators" }, { icon: ShieldCheck, title: "卸条件は会員限定", text: "価格、最小発注数、送料、支払条件を承認会員だけに公開。" }].map(({ icon: Icon, title, text, href }) => <article key={title} className="bg-white p-7"><Icon className="h-7 w-7 text-[#d45b16]" /><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 text-sm font-medium leading-7 text-black/60">{text}</p>{href && <Link href={href} className="mt-5 inline-flex items-center border-b border-black pb-1 text-xs font-black">一覧を見る<ArrowRight className="ml-1 h-4 w-4" /></Link>}</article>)}
          </div>
        </section>
      </main>
    </LcmPublicLayout>
  );
}
