/**
 * LCM marketplace style: image-led Japanese commerce catalogue with dense,
 * trustworthy product discovery. Role-first onboarding makes brand self-registration
 * explicit while public prices stay visible and private B2B terms stay protected.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Heart,
  PackageCheck,
  ShieldCheck,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  RadioTower,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { LcmCreatorQuickViewDialog } from "@/components/lcm/LcmCreatorQuickViewDialog";
import { LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { LcmProductImage } from "@/components/lcm/LcmProductImage";
import { buildFestivalLoginUrl } from "@/lib/festivalPortal";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

const MARKET_ASSETS = {
  brand: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/jCsAaBnvQjRKYwfp.webp",
  creator: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/XMUZPFbqGmXsAoim.webp",
  beauty: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/LfarjFTekKlvElUN.webp",
  food: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/QJyORBXxMAmSIdCH.webp",
  wellness: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/FtyjRmRPYVAQIEji.webp",
  lifestyle: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/fHJriVLkfNrEHYgc.webp",
} as const;

const categories = [
  { label: "すべて", keywords: [] },
  { label: "美容・コスメ", keywords: ["美容", "コスメ", "化粧品", "スキンケア", "ヘアケア", "サロン", "フェムケア"] },
  { label: "食品・飲料", keywords: ["食品", "飲料", "コーヒー", "珈琲"] },
  { label: "健康・ウェルネス", keywords: ["健康", "サプリ", "ウェルネス", "インナーケア"] },
  { label: "ファッション", keywords: ["ファッション", "アパレル", "靴"] },
  { label: "ライフスタイル", keywords: ["ライフスタイル", "日用", "雑貨", "フレグランス", "スクイーズ"] },
] as const;

const NEW_PRODUCT_WINDOW_DAYS = 60;

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

function isNewProduct(publishedAt: Date | string | null | undefined) {
  if (!publishedAt) return false;
  const publishedTime = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedTime)) return false;
  const age = Date.now() - publishedTime;
  return age >= 0 && age <= NEW_PRODUCT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function hasLiveReadyInformation(item: { summary?: string | null; highlights?: string[] | null; thirtySecondPitch?: string | null; demoInstructions?: string | null; targetAudience?: string | null; prohibitedClaims?: string | null }) {
  return Boolean(item.thirtySecondPitch?.trim() || item.demoInstructions?.trim() || item.targetAudience?.trim() || item.prohibitedClaims?.trim() || (item.summary?.trim() && (item.highlights?.length || 0) > 0));
}

export default function LcmMarket() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const [newOnly, setNewOnly] = useState(false);
  const [liveReadyOnly, setLiveReadyOnly] = useState(false);
  const [sampleOnly, setSampleOnly] = useState(false);
  const [creatorQuickViewOpen, setCreatorQuickViewOpen] = useState(false);
  const liveProducts = trpc.lcm.listPublicProducts.useQuery({ limit: 60 }, { retry: false });
  const accessQuery = trpc.lcm.getMyAccess.useQuery(undefined, { retry: false });
  const engagementQuery = trpc.lcm.getMyEngagementSummary.useQuery(undefined, { enabled: Boolean(accessQuery.data), retry: false });
  const interestMutation = trpc.lcm.toggleProductInterest.useMutation({
    onSuccess: async () => { await Promise.all([engagementQuery.refetch(), liveProducts.refetch()]); },
    onError: (error) => toast.error(error.message),
  });
  const sampleCartMutation = trpc.lcm.toggleSampleCart.useMutation({
    onSuccess: async (data) => { toast.success(data.inSampleCart ? "サンプルカートに追加しました" : "サンプルカートから外しました"); await engagementQuery.refetch(); },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    return applyPageSeo({
      title: "LCM｜ライブコマースマーケット｜ブランド・商品・サンプル・卸商談",
      description: "ライブコマース向け商品を検索でき、ブランド・商品を当面無料でセルフ登録・公開できるB2Bマーケット。サンプル、会員限定取引条件、商談を一つの場所で管理できます。",
      canonicalPath: "/lcm",
      image: MARKET_ASSETS.brand,
      jsonLd: [
        { "@context": "https://schema.org", "@type": "WebSite", name: "LCM｜ライブコマースマーケット", url: "https://www.livecommercefestival.com/lcm" },
        { "@context": "https://schema.org", "@type": "CollectionPage", name: "LCM 商品・ブランドディレクトリ", description: "商品を探し、ブランドと商品を当面無料でセルフ登録・公開できるB2Bマーケット", url: "https://www.livecommercefestival.com/lcm" },
      ],
    });
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#product-search") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("product-search")?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const filteredLiveProducts = useMemo(() => {
    const q = normalize(query);
    return (liveProducts.data || []).filter((item) => {
      const categoryMatches = matchesCategory(item.category, category);
      const queryMatches = !q || normalize([item.name, item.brandName, item.category, item.summary, item.thirtySecondPitch, item.demoInstructions, item.targetAudience, ...(item.highlights || [])].join(" ")).includes(q);
      const newMatches = !newOnly || isNewProduct(item.publishedAt);
      const liveReadyMatches = !liveReadyOnly || hasLiveReadyInformation(item);
      const sampleMatches = !sampleOnly || item.sampleAvailable;
      return categoryMatches && queryMatches && newMatches && liveReadyMatches && sampleMatches;
    });
  }, [category, liveProducts.data, liveReadyOnly, newOnly, query, sampleOnly]);
  const totalResults = filteredLiveProducts.length;
  const hasFilters = Boolean(query || category !== "すべて" || newOnly || liveReadyOnly || sampleOnly);
  const interestedProductIds = useMemo(() => new Set(engagementQuery.data?.interestedProductIds || []), [engagementQuery.data?.interestedProductIds]);
  const sampleCartProductIds = useMemo(() => new Set(engagementQuery.data?.sampleCartProductIds || []), [engagementQuery.data?.sampleCartProductIds]);

  const resetFilters = () => {
    setQuery("");
    setCategory("すべて");
    setNewOnly(false);
    setLiveReadyOnly(false);
    setSampleOnly(false);
  };

  return (
    <LcmPublicLayout>
      <main className="bg-[#f7f5ef]">
        <section className="border-b border-black/10 bg-[#fffdf8] px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            <div className="text-center">
              <p className="text-[10px] font-black tracking-[0.34em] text-black/55 md:text-xs">LIVE COMMERCE MARKET</p>
              <h1 className="mx-auto mt-4 max-w-5xl text-[clamp(2.4rem,6.2vw,5.8rem)] font-black leading-[.98] tracking-[-0.065em]">
                届けたい商品と、<br className="sm:hidden" /><span className="underline decoration-[#f7cc35] decoration-[8px] underline-offset-[8px]">伝えるライバーが</span><br className="sm:hidden" />出会う。
              </h1>
              <p className="mt-6 text-sm font-bold tracking-wide text-black/65 md:text-lg">メーカーとライバーをつなぐ、ライブコマースのマッチングサービス。</p>
            </div>

            <div className="mt-9 grid gap-3 lg:grid-cols-2 lg:gap-4">
              <article className="group relative isolate min-h-[520px] overflow-hidden bg-[#f8d950] p-6 sm:p-8 md:min-h-[620px] md:p-10">
                <img src={MARKET_ASSETS.brand} alt="美容・健康・生活商品を並べたブランド向け商品イメージ" width={1400} height={1050} className="absolute inset-0 h-full w-full object-cover object-center" fetchPriority="high" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#fff4b8]/95 via-[#fff4b8]/80 to-[#f7cc35]/20" />
                <div className="relative z-10 flex h-full flex-col">
                  <p className="inline-flex w-fit items-center rounded-full bg-[#f7cc35] px-4 py-2 text-xs font-black"><Building2 className="mr-2 h-4 w-4" />メーカー・ブランドの方</p>
                  <h2 className="mt-7 text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-5xl md:text-6xl">商品の魅力を、<br />届けてくれる<br className="sm:hidden" />ライブコマーサーへ。</h2>
                  <p className="mt-5 max-w-xl text-sm font-bold leading-7 text-black/70 md:text-base">商品を掲載して、新たな販路づくりへ。<br />相性のよいライブコマーサーとの出会いを広げます。</p>
                  <ul className="mt-6 space-y-3 text-sm font-black md:text-base">{["商品・ブランドを掲載", "ライブコマーサーを探す", "販売条件を共有"].map((item) => <li key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 fill-[#f7cc35] text-black" />{item}</li>)}</ul>
                  <div className="mt-auto pt-8">
                    <Link href="/lcm/manage?workspace=brand" className="inline-flex min-h-14 w-full items-center justify-center bg-[#171714] px-6 text-base font-black text-white transition hover:bg-black active:scale-[.99]">商品掲載を申し込む<ArrowRight className="ml-3 h-5 w-5" /></Link>
                    <p className="mt-3 text-center text-xs font-bold text-black/60">ブランド・商品登録は当面無料です</p>
                    <button type="button" onClick={() => setCreatorQuickViewOpen(true)} className="mx-auto mt-4 flex min-h-11 items-center border-b border-black px-2 text-sm font-black">ライブコマーサーを見る<ArrowRight className="ml-2 h-4 w-4" /></button>
                  </div>
                </div>
              </article>

              <article className="group relative isolate min-h-[520px] overflow-hidden bg-[#171714] p-6 text-white sm:p-8 md:min-h-[620px] md:p-10">
                <img src={MARKET_ASSETS.creator} alt="スマートフォンで商品を紹介するライブコマーサー" width={1000} height={1250} className="absolute inset-0 h-full w-full object-cover object-center" fetchPriority="high" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/20" />
                <div className="relative z-10 flex h-full flex-col">
                  <p className="inline-flex w-fit items-center rounded-full border border-white/65 bg-black/25 px-4 py-2 text-xs font-black"><Users className="mr-2 h-4 w-4 text-[#f7cc35]" />ライブコマーサー・クリエイターの方</p>
                  <h2 className="mt-7 max-w-[760px] text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-5xl md:text-6xl">あなたの配信に、<br />紹介したくなる商品を。</h2>
                  <p className="mt-5 max-w-lg text-sm font-bold leading-7 text-white/80 md:text-base">気になる商品やブランドを見つけて、<br />サンプルや販売条件を確認できます。</p>
                  <ul className="mt-6 space-y-3 text-sm font-black md:text-base">{["配信で紹介する商品を探す", "サンプル・販売条件を確認", "プロフィールを掲載"].map((item) => <li key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 fill-[#f7cc35] text-[#f7cc35]" />{item}</li>)}</ul>
                  <div className="mt-auto pt-8">
                    <button type="button" onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="inline-flex min-h-14 w-full items-center justify-center bg-[#f7cc35] px-6 text-base font-black text-black transition hover:bg-[#ffda49] active:scale-[.99]">商品を探す<ArrowRight className="ml-3 h-5 w-5" /></button>
                    <Link href="/lcm/manage?workspace=creator" className="mx-auto mt-4 flex min-h-11 w-fit items-center border-b border-white/75 px-2 text-sm font-black">ライブコマーサー登録はこちら<ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </div>
                </div>
              </article>
            </div>

            <section id="product-search" aria-labelledby="lcm-category-heading" className="mt-10 scroll-mt-[125px] border-t border-black/15 pt-8 sm:scroll-mt-[73px] md:mt-14 md:scroll-mt-[81px] md:pt-10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div><h2 id="lcm-category-heading" className="text-3xl font-black tracking-[-0.04em] md:text-4xl">どんな商品がある？</h2><p className="mt-2 text-sm font-semibold text-black/55">商品は登録なしでご覧いただけます。</p></div>
                <label htmlFor="lcm-search" className="relative block w-full lg:max-w-[430px]"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/40" /><span className="sr-only">商品・ブランドを検索</span><input id="lcm-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="商品名・ブランド名で検索" className="h-13 w-full border border-black/20 bg-white pl-12 pr-4 text-sm font-bold outline-none ring-[#f7cc35] placeholder:text-black/35 focus:ring-4" /></label>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{[
                { label: "美容・コスメ", image: MARKET_ASSETS.beauty },
                { label: "食品・飲料", image: MARKET_ASSETS.food },
                { label: "健康・ウェルネス", image: MARKET_ASSETS.wellness },
                { label: "ライフスタイル", image: MARKET_ASSETS.lifestyle },
              ].map((item) => <button key={item.label} type="button" onClick={() => { setCategory(item.label); document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="group text-left"><span className="block aspect-[4/3] overflow-hidden bg-white"><img src={item.image} alt="" width={720} height={1234} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" /></span><span className="mt-3 flex items-center justify-between border-b border-black/20 pb-2 text-sm font-black md:text-base">{item.label}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></button>)}</div>
              <button type="button" onClick={() => { resetFilters(); document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="mt-6 inline-flex min-h-11 items-center border-b-2 border-black px-1 text-sm font-black">商品をすべて見る<ArrowRight className="ml-2 h-4 w-4" /></button>
            </section>
          </div>
        </section>

        <section id="products" className="mx-auto max-w-[1440px] scroll-mt-[125px] px-3 py-8 sm:scroll-mt-[73px] sm:px-5 md:scroll-mt-[81px] md:px-8 md:py-12">
          <div className="sticky top-[125px] z-20 -mx-3 border-y border-black/10 bg-[#f4f1e9]/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:top-[73px] sm:px-5 md:-mx-8 md:top-[81px] md:px-8">
            <div className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto pb-1" aria-label="商品カテゴリ">
              {categories.map((item) => (
                <button key={item.label} type="button" onClick={() => setCategory(item.label)} aria-pressed={category === item.label} className={`shrink-0 border px-3.5 py-2 text-xs font-black transition active:scale-[.97] ${category === item.label ? "border-black bg-[#171714] text-white" : "border-black/15 bg-white hover:border-black"}`}>{item.label}</button>
              ))}
              <button type="button" onClick={() => setNewOnly((current) => !current)} aria-pressed={newOnly} className={`shrink-0 border px-3.5 py-2 text-xs font-black transition active:scale-[.97] ${newOnly ? "border-[#d45b16] bg-[#d45b16] text-white" : "border-black/15 bg-white hover:border-[#d45b16]"}`}><Clock3 className="mr-1.5 inline h-4 w-4" />新着</button>
              <button type="button" onClick={() => setLiveReadyOnly((current) => !current)} aria-pressed={liveReadyOnly} className={`shrink-0 border px-3.5 py-2 text-xs font-black transition active:scale-[.97] ${liveReadyOnly ? "border-[#9b6200] bg-[#f7cc35] text-black" : "border-black/15 bg-white hover:border-[#9b6200]"}`}><RadioTower className="mr-1.5 inline h-4 w-4" />配信情報あり</button>
              <button type="button" onClick={() => setSampleOnly((current) => !current)} aria-pressed={sampleOnly} className={`shrink-0 border px-3.5 py-2 text-xs font-black transition active:scale-[.97] ${sampleOnly ? "border-[#16805b] bg-[#16805b] text-white" : "border-black/15 bg-white hover:border-[#16805b]"}`}><PackageCheck className="mr-1.5 inline h-4 w-4" />サンプル対応</button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5">
            <div><p className="flex items-center gap-2 text-xs font-black tracking-[0.18em] text-[#9b6200]"><ShoppingBag className="h-4 w-4" />PRODUCTS</p><h2 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">ショッピング感覚で、商談候補を探す。</h2></div>
            <div className="flex items-center gap-3"><span className="text-sm font-black">{totalResults}件</span>{accessQuery.data && <Link href="/lcm/sample-cart" className="inline-flex items-center bg-[#171714] px-3 py-2 text-xs font-black text-white"><ShoppingCart className="mr-1.5 h-4 w-4" />サンプルカート {engagementQuery.data?.sampleCartCount || 0}</Link>}{hasFilters && <button type="button" onClick={resetFilters} className="inline-flex items-center border-b border-black text-xs font-black"><SlidersHorizontal className="mr-1 h-3.5 w-3.5" />条件をリセット</button>}</div>
          </div>

          {filteredLiveProducts.length > 0 && (
            <section className="mt-8" aria-labelledby="official-products-heading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><p className="flex items-center gap-2 text-xs font-black tracking-[0.16em] text-[#16805b]"><CheckCircle2 className="h-4 w-4" />BRAND OFFICIAL</p><h3 id="official-products-heading" className="mt-1 text-xl font-black">ブランド公式商品</h3></div>
                <p className="text-xs font-bold text-black/45">公開中の商品情報</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredLiveProducts.map((item) => (
                  <article key={item.id} className="group flex min-w-0 flex-col border border-black/10 bg-white p-2 transition duration-200 hover:-translate-y-0.5 hover:border-black hover:shadow-[4px_4px_0_rgba(0,0,0,.12)] sm:p-2.5">
                    <Link href={`/lcm/products/${item.slug}`} className="min-w-0">
                      <div className="relative aspect-square overflow-hidden bg-[#f1eee6]">
                        <LcmProductImage src={item.primaryImageUrl} alt={`${item.name}の商品写真`} className="h-full w-full object-contain p-2 transition duration-200 group-hover:scale-[1.025]" />
                        {isNewProduct(item.publishedAt) && <span className="absolute right-1.5 top-1.5 bg-[#d45b16] px-1.5 py-1 text-[8px] font-black text-white">新着</span>}
                        {item.sampleAvailable && <span className="absolute bottom-1.5 left-1.5 bg-[#dff5ea] px-1.5 py-1 text-[8px] font-black text-[#126445]">サンプル対応</span>}
                      </div>
                      <div className="mt-2 flex min-w-0 items-center gap-1"><p className="truncate text-[10px] font-black text-black/50">{item.brandName}</p>{item.brandOfficiallyLinked && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#16805b]" aria-label="ブランド正式連携済み" />}</div>
                      <h4 className="mt-1 line-clamp-2 min-h-9 text-[13px] font-black leading-[1.15rem] sm:text-sm">{item.name}</h4>
                      {item.reviewCount > 0 ? <p className="mt-1.5 flex items-center gap-1 text-[10px] font-black text-[#9b6200]"><Star className="h-3.5 w-3.5 fill-[#f7cc35] text-[#9b6200]" />{item.averageRating?.toFixed(1)} <span className="text-black/40">({item.reviewCount})</span></p> : <p className="mt-1.5 text-[10px] font-bold text-black/35">レビューはまだありません</p>}
                      <p className="mt-2 text-sm font-black sm:text-base">{formatListPrice(item.listPrice, item.taxMode)}</p>
                      {(item.eventBadges || []).slice(0, 1).map((badge) => <span key={badge.eventKey} className="mt-2 inline-flex bg-[#f7cc35] px-1.5 py-1 text-[8px] font-black text-black">{badge.eventLabel}</span>)}
                    </Link>
                    <div className="mt-auto grid grid-cols-2 gap-1 border-t border-black/10 pt-2">
                      {accessQuery.data ? <button type="button" onClick={() => interestMutation.mutate({ productId: item.id })} aria-pressed={interestedProductIds.has(item.id)} className={`inline-flex min-h-9 items-center justify-center px-1 text-[9px] font-black ${interestedProductIds.has(item.id) ? "bg-[#fff0ee] text-[#b42f26]" : "bg-[#f1eee6] text-black"}`}><Heart className={`mr-1 h-3.5 w-3.5 ${interestedProductIds.has(item.id) ? "fill-current" : ""}`} />興味あり</button> : <Link href={buildFestivalLoginUrl(`/lcm/products/${item.slug}`)} className="inline-flex min-h-9 items-center justify-center bg-[#f1eee6] px-1 text-[9px] font-black"><Heart className="mr-1 h-3.5 w-3.5" />興味あり</Link>}
                      {item.sampleAvailable ? accessQuery.data ? <button type="button" onClick={() => sampleCartMutation.mutate({ productId: item.id })} aria-pressed={sampleCartProductIds.has(item.id)} className={`inline-flex min-h-9 items-center justify-center px-1 text-[9px] font-black ${sampleCartProductIds.has(item.id) ? "bg-[#16805b] text-white" : "bg-[#171714] text-white"}`}><ShoppingCart className="mr-1 h-3.5 w-3.5" />{sampleCartProductIds.has(item.id) ? "追加済み" : "サンプル"}</button> : <Link href={buildFestivalLoginUrl(`/lcm/products/${item.slug}`)} className="inline-flex min-h-9 items-center justify-center bg-[#171714] px-1 text-[9px] font-black text-white"><ShoppingCart className="mr-1 h-3.5 w-3.5" />サンプル</Link> : <Link href={`/lcm/products/${item.slug}`} className="inline-flex min-h-9 items-center justify-center bg-[#171714] px-1 text-[9px] font-black text-white">詳細<ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {totalResults === 0 && (
            <div className="mt-8 border border-dashed border-black/25 bg-white p-10 text-center"><Search className="mx-auto h-8 w-8 text-black/25" /><p className="mt-3 font-black">{hasFilters ? "該当する公開商品がありません" : "現在公開中の商品はありません"}</p><p className="mt-2 text-xs leading-6 text-black/45">{hasFilters ? "検索語や条件を変更すると、別の商品を確認できます。" : "ブランドが商品情報を登録して公開すると、ここに通常商品として表示されます。"}</p>{hasFilters && <button type="button" onClick={resetFilters} className="mt-4 bg-[#171714] px-5 py-3 text-sm font-black text-white">すべての公開商品を見る</button>}</div>
          )}

        </section>

        <LcmCreatorQuickViewDialog open={creatorQuickViewOpen} onOpenChange={setCreatorQuickViewOpen} />
      </main>
    </LcmPublicLayout>
  );
}
