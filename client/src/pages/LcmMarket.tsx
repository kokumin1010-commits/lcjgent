/**
 * LCM marketplace style: image-led Japanese commerce catalogue with dense,
 * trustworthy product discovery. Public list prices stay visible; private B2B
 * terms remain behind the existing approved-member boundary.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeJapaneseYen,
  CheckCircle2,
  History,
  LockKeyhole,
  PackageCheck,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { LcmArchiveBadge, LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { LcmProductImage } from "@/components/lcm/LcmProductImage";
import { lcf2026ExhibitorCatalogPages } from "@/data/lcf2026ExhibitorCatalog";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

const categories = [
  { label: "すべて", keywords: [] },
  { label: "美容・コスメ", keywords: ["美容", "コスメ", "化粧品", "スキンケア", "ヘアケア", "サロン", "フェムケア"] },
  { label: "食品・飲料", keywords: ["食品", "飲料", "コーヒー", "珈琲"] },
  { label: "健康・ウェルネス", keywords: ["健康", "サプリ", "ウェルネス", "インナーケア"] },
  { label: "ファッション", keywords: ["ファッション", "アパレル", "靴"] },
  { label: "ライフスタイル", keywords: ["ライフスタイル", "日用", "雑貨", "フレグランス", "スクイーズ"] },
] as const;

function normalize(value: string | null | undefined) {
  return String(value || "").normalize("NFKC").toLowerCase();
}

function matchesCategory(value: string | null | undefined, selected: string) {
  if (selected === "すべて") return true;
  const category = categories.find((item) => item.label === selected);
  const normalized = normalize(value);
  return Boolean(category?.keywords.some((keyword) => normalized.includes(normalize(keyword))));
}

function formatListPrice(value: string | number | null | undefined, taxMode?: string | null) {
  if (value == null || value === "") return "価格はブランドへ確認";
  const amount = Number(value);
  const formatted = Number.isFinite(amount) ? `¥${amount.toLocaleString("ja-JP")}` : String(value);
  if (taxMode === "included") return `${formatted}（税込）`;
  if (taxMode === "excluded") return `${formatted}（税別）`;
  return formatted;
}

export default function LcmMarket() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const [sampleOnly, setSampleOnly] = useState(false);
  const liveProducts = trpc.lcm.listPublicProducts.useQuery({ limit: 60 }, { retry: false });
  const liveStats = trpc.lcm.publicStats.useQuery(undefined, { retry: false });

  useEffect(() => {
    return applyPageSeo({
      title: "LCM｜ライブコマースマーケット｜ブランド・商品・サンプル・卸商談",
      description: "LCF出展ブランドとライブコマース向け商品を、写真・定価・特徴から検索。サンプルや会員限定取引条件を確認し、ブランドとの商談へ進めるB2Bマーケットです。",
      canonicalPath: "/lcm",
      image: lcf2026ExhibitorCatalogPages.find((item) => item.page === 29)?.imageUrl || "https://www.livecommercefestival.com/favicon.ico",
      jsonLd: [
        { "@context": "https://schema.org", "@type": "WebSite", name: "LCM｜ライブコマースマーケット", url: "https://www.livecommercefestival.com/lcm" },
        { "@context": "https://schema.org", "@type": "CollectionPage", name: "LCM 商品・ブランドディレクトリ", description: "写真と定価からライブコマース向け商品を探せるB2Bマーケット", url: "https://www.livecommercefestival.com/lcm" },
      ],
    });
  }, []);

  const archiveItems = useMemo(
    () => lcf2026ExhibitorCatalogPages.filter((item) => item.pageType === "出展企業紹介" && item.productTitle),
    [],
  );
  const filteredArchive = useMemo(() => {
    if (sampleOnly) return [];
    const q = normalize(query);
    return archiveItems.filter((item) => {
      const categoryMatches = matchesCategory(item.category, category);
      const queryMatches = !q || normalize([item.name, item.category, item.productTitle, item.highlights, item.otherProducts].join(" ")).includes(q);
      return categoryMatches && queryMatches;
    });
  }, [archiveItems, category, query, sampleOnly]);
  const filteredLiveProducts = useMemo(() => {
    const q = normalize(query);
    return (liveProducts.data || []).filter((item) => {
      const categoryMatches = matchesCategory(item.category, category);
      const queryMatches = !q || normalize([item.name, item.brandName, item.category, item.summary, ...(item.highlights || [])].join(" ")).includes(q);
      const sampleMatches = !sampleOnly || item.sampleAvailable;
      return categoryMatches && queryMatches && sampleMatches;
    });
  }, [category, liveProducts.data, query, sampleOnly]);
  const totalResults = filteredLiveProducts.length + filteredArchive.length;
  const hasFilters = Boolean(query || category !== "すべて" || sampleOnly);

  const resetFilters = () => {
    setQuery("");
    setCategory("すべて");
    setSampleOnly(false);
  };

  return (
    <LcmPublicLayout>
      <main className="bg-[#f4f1e9]">
        <section className="border-b border-black/15 bg-[#fffdf8]">
          <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-10 md:px-8 md:py-14 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.22em] text-[#9b6200]">LIVE COMMERCE MARKET</p>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.8rem,6vw,5.8rem)] font-black leading-[.9] tracking-[-0.065em]">
                商品を見つける。<br /><span className="text-[#d45b16]">売る準備</span>を始める。
              </h1>
              <p className="mt-6 max-w-2xl text-sm font-semibold leading-7 text-black/60 md:text-base">商品写真と定価は誰でも閲覧できます。サンプル、卸価格、ライブ販売条件は、共通アカウントで安全に確認できます。</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex items-center border border-black/15 bg-white px-3 py-2 text-xs font-black"><BadgeJapaneseYen className="mr-1.5 h-4 w-4 text-[#d45b16]" />定価を公開</span>
                <span className="inline-flex items-center border border-black/15 bg-white px-3 py-2 text-xs font-black"><PackageCheck className="mr-1.5 h-4 w-4 text-[#16805b]" />サンプル対応</span>
                <span className="inline-flex items-center border border-black/15 bg-white px-3 py-2 text-xs font-black"><LockKeyhole className="mr-1.5 h-4 w-4" />取引条件は会員限定</span>
              </div>
            </div>

            <div className="border border-black/15 bg-[#171714] p-4 text-white shadow-[10px_10px_0_#f7cc35] md:p-6">
              <label htmlFor="lcm-search" className="text-xs font-black tracking-[0.16em] text-white/55">商品・ブランドを検索</label>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/45" />
                <input
                  id="lcm-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="商品名、ブランド名、特徴から探す"
                  className="h-14 w-full bg-white pl-12 pr-4 text-base font-bold text-black outline-none ring-[#f7cc35] placeholder:text-black/35 focus:ring-4"
                />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-px bg-white/15">
                <div className="bg-[#171714] p-3"><p className="text-xl font-black text-[#f7cc35]">{liveStats.data?.productCount || 0}</p><p className="mt-1 text-[10px] font-bold text-white/50">公開商品</p></div>
                <div className="bg-[#171714] p-3"><p className="text-xl font-black">{archiveItems.length}</p><p className="mt-1 text-[10px] font-bold text-white/50">掲載商品</p></div>
                <div className="bg-[#171714] p-3"><p className="text-xl font-black">{liveStats.data?.brandCount || 0}</p><p className="mt-1 text-[10px] font-bold text-white/50">公開ブランド</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="products" className="mx-auto max-w-[1440px] px-3 py-8 sm:px-5 md:px-8 md:py-12">
          <div className="sticky top-[62px] z-20 -mx-3 border-y border-black/10 bg-[#f4f1e9]/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 md:-mx-8 md:px-8">
            <div className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto pb-1" aria-label="商品カテゴリ">
              {categories.map((item) => (
                <button key={item.label} type="button" onClick={() => setCategory(item.label)} aria-pressed={category === item.label} className={`shrink-0 border px-3.5 py-2 text-xs font-black transition active:scale-[.97] ${category === item.label ? "border-black bg-[#171714] text-white" : "border-black/15 bg-white hover:border-black"}`}>{item.label}</button>
              ))}
              <button type="button" onClick={() => setSampleOnly((current) => !current)} aria-pressed={sampleOnly} className={`shrink-0 border px-3.5 py-2 text-xs font-black transition active:scale-[.97] ${sampleOnly ? "border-[#16805b] bg-[#16805b] text-white" : "border-black/15 bg-white hover:border-[#16805b]"}`}><PackageCheck className="mr-1.5 inline h-4 w-4" />サンプル対応</button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5">
            <div><p className="flex items-center gap-2 text-xs font-black tracking-[0.18em] text-[#9b6200]"><ShoppingBag className="h-4 w-4" />PRODUCTS</p><h2 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">ショッピング感覚で、商談候補を探す。</h2></div>
            <div className="flex items-center gap-3"><span className="text-sm font-black">{totalResults}件</span>{hasFilters && <button type="button" onClick={resetFilters} className="inline-flex items-center border-b border-black text-xs font-black"><SlidersHorizontal className="mr-1 h-3.5 w-3.5" />条件をリセット</button>}</div>
          </div>

          {filteredLiveProducts.length > 0 && (
            <section className="mt-8" aria-labelledby="official-products-heading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><p className="flex items-center gap-2 text-xs font-black tracking-[0.16em] text-[#16805b]"><CheckCircle2 className="h-4 w-4" />BRAND OFFICIAL</p><h3 id="official-products-heading" className="mt-1 text-xl font-black">ブランド公式商品</h3></div>
                <p className="text-xs font-bold text-black/45">公開中の商品情報</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
                {filteredLiveProducts.map((item) => (
                  <Link key={item.id} href={`/lcm/products/${item.slug}`} className="group flex min-w-0 flex-col border border-black/10 bg-white p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-black hover:shadow-[5px_5px_0_rgba(0,0,0,.12)] sm:p-3">
                    <div className="relative aspect-square overflow-hidden bg-[#f1eee6]">
                      <LcmProductImage src={item.primaryImageUrl} alt={`${item.name}の商品写真`} className="h-full w-full object-contain p-2 transition duration-200 group-hover:scale-[1.025]" />
                      <span className="absolute left-2 top-2 bg-[#171714] px-2 py-1 text-[9px] font-black tracking-wide text-white">公式商品</span>
                      {item.sampleAvailable && <span className="absolute bottom-2 left-2 bg-[#dff5ea] px-2 py-1 text-[9px] font-black text-[#126445]">サンプル対応</span>}
                    </div>
                    <p className="mt-3 truncate text-[10px] font-black tracking-[0.08em] text-black/45 sm:text-xs">{item.brandName}</p>
                    <h4 className="mt-1 line-clamp-2 min-h-10 text-sm font-black leading-5 sm:text-base">{item.name}</h4>
                    <p className="mt-3 text-base font-black sm:text-lg">{formatListPrice(item.listPrice, item.taxMode)}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-black/10 pt-3 text-[10px] font-bold text-black/50 sm:text-xs"><span>取引条件は会員限定</span><ArrowRight className="h-4 w-4 text-black" /></div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {filteredArchive.length > 0 && (
            <section className="mt-12" aria-labelledby="archive-products-heading">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div><div className="flex items-center gap-2"><LcmArchiveBadge /><span className="text-xs font-bold text-black/45">当時の掲載価格・商品情報</span></div><h3 id="archive-products-heading" className="mt-2 text-2xl font-black">第1回LCF 出展商品</h3></div>
                <Link href="/livecommercefestival/2026/exhibitors" className="inline-flex items-center text-xs font-black underline">出展アーカイブを見る<ArrowRight className="ml-1 h-4 w-4" /></Link>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
                {filteredArchive.map((item) => (
                  <Link key={item.page} href={`/lcm/brands/catalog-${item.page}`} className="group flex min-w-0 flex-col border border-black/10 bg-white p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-black hover:shadow-[5px_5px_0_rgba(0,0,0,.12)] sm:p-3">
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#eeeae0]"><LcmProductImage src={item.thumbnailUrl} alt={item.alt} className="h-full w-full object-cover object-top transition duration-200 group-hover:scale-[1.015]" /><span className="absolute left-2 top-2 inline-flex items-center bg-[#f7cc35] px-2 py-1 text-[9px] font-black text-black"><History className="mr-1 h-3 w-3" />第1回LCF掲載</span></div>
                    <p className="mt-3 truncate text-[10px] font-black tracking-[0.08em] text-black/45 sm:text-xs">{item.name}</p>
                    <h4 className="mt-1 line-clamp-2 min-h-10 text-sm font-black leading-5 sm:text-base">{item.productTitle}</h4>
                    <p className="mt-3 text-sm font-black sm:text-base">{item.price || "価格は紙面で確認"}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-black/10 pt-3 text-[10px] font-bold text-black/50 sm:text-xs"><span>掲載情報を見る</span><ArrowRight className="h-4 w-4 text-black" /></div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {totalResults === 0 && (
            <div className="mt-8 border border-dashed border-black/25 bg-white p-10 text-center"><Search className="mx-auto h-8 w-8 text-black/25" /><p className="mt-3 font-black">該当する商品がありません</p><p className="mt-2 text-xs leading-6 text-black/45">検索語やカテゴリを変更すると、別の商品を確認できます。</p><button type="button" onClick={resetFilters} className="mt-4 bg-[#171714] px-5 py-3 text-sm font-black text-white">すべての商品を見る</button></div>
          )}
        </section>

        <section className="border-y border-black/15 bg-[#f7cc35] px-5 py-14 md:px-8 md:py-16">
          <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><p className="text-xs font-black tracking-[0.2em]">FOR BRANDS</p><h2 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">商品写真と定価から、ブランドを育てる。</h2><p className="mt-5 max-w-3xl text-sm font-semibold leading-7 md:text-base">商品登録は写真、基本情報、商品の魅力、販売先、サンプル、会員限定取引条件の順に整理。公開情報と商談情報を混ぜずに管理できます。</p></div>
            <Link href="/lcm/manage?workspace=brand" className="inline-flex items-center justify-center bg-[#171714] px-7 py-4 text-sm font-black text-white">ブランド管理を始める<ArrowRight className="ml-2 h-4 w-4" /></Link>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-14 md:px-8 md:py-16">
          <div className="grid gap-px bg-black/15 md:grid-cols-3">
            {[
              { icon: ShoppingBag, title: "登録なしで商品を見る", text: "写真、ブランド、定価、商品の特徴は一般公開。検索や比較の入口を狭くしません。" },
              { icon: Users, title: "ライブコマーサーを公式ページから探す", text: "得意カテゴリや配信形式から候補を探し、商品との相性を確認できます。", href: "/lcm/creators" },
              { icon: LockKeyhole, title: "重要な条件は会員限定", text: "卸価格、最小発注数、送料、支払条件、報酬率は共通アカウントで保護します。" },
            ].map(({ icon: Icon, title, text, href }) => <article key={title} className="bg-white p-7"><Icon className="h-7 w-7 text-[#d45b16]" /><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 text-sm font-medium leading-7 text-black/60">{text}</p>{href && <Link href={href} className="mt-5 inline-flex items-center border-b border-black pb-1 text-xs font-black">一覧を見る<ArrowRight className="ml-1 h-4 w-4" /></Link>}</article>)}
          </div>
        </section>
      </main>
    </LcmPublicLayout>
  );
}
