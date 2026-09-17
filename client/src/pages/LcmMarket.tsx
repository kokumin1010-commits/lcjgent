/**
 * LCM marketplace style: image-led Japanese commerce catalogue with dense,
 * trustworthy product discovery. Role-first onboarding makes brand self-registration
 * explicit while public prices stay visible and private B2B terms stay protected.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeJapaneseYen,
  CheckCircle2,
  Clock3,
  Heart,
  LockKeyhole,
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
import { LcmArchiveBadge, LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { LcmProductImage } from "@/components/lcm/LcmProductImage";
import { lcf2026ExhibitorCatalogPages } from "@/data/lcf2026ExhibitorCatalog";
import { buildFestivalLoginUrl } from "@/lib/festivalPortal";
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
  const liveStats = trpc.lcm.publicStats.useQuery(undefined, { retry: false });
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
      image: lcf2026ExhibitorCatalogPages.find((item) => item.page === 29)?.imageUrl || "https://www.livecommercefestival.com/favicon.ico",
      jsonLd: [
        { "@context": "https://schema.org", "@type": "WebSite", name: "LCM｜ライブコマースマーケット", url: "https://www.livecommercefestival.com/lcm" },
        { "@context": "https://schema.org", "@type": "CollectionPage", name: "LCM 商品・ブランドディレクトリ", description: "商品を探し、ブランドと商品を当面無料でセルフ登録・公開できるB2Bマーケット", url: "https://www.livecommercefestival.com/lcm" },
      ],
    });
  }, []);

  const archiveItems = useMemo(
    () => lcf2026ExhibitorCatalogPages.filter((item) => item.pageType === "出展企業紹介" && item.productTitle),
    [],
  );
  const archivePreviewItems = useMemo(() => archiveItems.slice(0, 4), [archiveItems]);
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
                <div className="bg-[#171714] p-3"><p className="text-xl font-black">{archiveItems.length}</p><p className="mt-1 text-[10px] font-bold text-white/50">第1回特集</p></div>
                <div className="bg-[#171714] p-3"><p className="text-xl font-black">{liveStats.data?.brandCount || 0}</p><p className="mt-1 text-[10px] font-bold text-white/50">公開ブランド</p></div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="lcm-entry-heading" className="border-b border-black/15 bg-[#f4f1e9] px-5 py-8 md:px-8 md:py-10">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-black tracking-[0.2em] text-[#9b6200]">START WITH YOUR ROLE</p><h2 id="lcm-entry-heading" className="mt-2 text-3xl font-black tracking-tight md:text-5xl">LCMで何をしますか？</h2></div>
              <p className="max-w-xl text-sm font-semibold leading-7 text-black/55">ブランド登録、公式プロフィール作成、商品閲覧を入口から分けました。LCF登録済みの方は同じ共通アカウントを使えます。</p>
            </div>
            <div className="mt-6 grid gap-px bg-black/20 lg:grid-cols-[1.2fr_.9fr_.9fr]">
              <Link href="/lcm/manage?workspace=brand" className="group bg-[#f7cc35] p-6 transition-colors hover:bg-[#ffd84d] md:p-8"><div className="flex items-start justify-between gap-4"><span className="text-xs font-black tracking-[0.16em]">01 / BRAND</span><ShoppingBag className="h-7 w-7" /></div><h3 className="mt-8 text-3xl font-black tracking-tight">ブランドと商品を<br />自分で登録する。</h3><p className="mt-4 text-sm font-semibold leading-7 text-black/65">当面は登録無料。ブランドページを公開したら、続けて商品写真、定価、魅力、サンプル、配信向き情報を自分で登録できます。</p><span className="mt-7 inline-flex items-center border-b-2 border-black pb-1 text-sm font-black">無料でブランド登録を始める<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></span></Link>
              <Link href="/lcm/manage?workspace=creator" className="group bg-[#171714] p-6 text-white transition-colors hover:bg-black md:p-8"><div className="flex items-start justify-between gap-4"><span className="text-xs font-black tracking-[0.16em] text-[#f7cc35]">02 / CREATOR</span><Users className="h-7 w-7 text-[#f7cc35]" /></div><h3 className="mt-8 text-2xl font-black tracking-tight">公式プロフィールを<br />自分で作る。</h3><p className="mt-4 text-sm font-semibold leading-7 text-white/60">得意カテゴリ、配信形式、公開実績を登録。本人提出と運営確認後にディレクトリへ掲載します。</p><span className="mt-7 inline-flex items-center border-b border-white/70 pb-1 text-sm font-black">ライブコマーサーとして参加<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></span></Link>
              <button type="button" onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="group bg-white p-6 text-left transition-colors hover:bg-[#fffdf8] md:p-8"><div className="flex items-start justify-between gap-4"><span className="text-xs font-black tracking-[0.16em] text-[#9b6200]">03 / BROWSE</span><Search className="h-7 w-7 text-[#d45b16]" /></div><h3 className="mt-8 text-2xl font-black tracking-tight">登録前に、<br />公開商品を見る。</h3><p className="mt-4 text-sm font-semibold leading-7 text-black/55">写真、ブランド、定価、商品の特徴は登録なしで検索・比較できます。</p><span className="mt-7 inline-flex items-center border-b border-black pb-1 text-sm font-black">商品一覧へ移動<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></span></button>
            </div>
          </div>
        </section>

        <section id="products" className="mx-auto max-w-[1440px] px-3 py-8 sm:px-5 md:px-8 md:py-12">
          <div className="sticky top-[62px] z-20 -mx-3 border-y border-black/10 bg-[#f4f1e9]/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 md:-mx-8 md:px-8">
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

          {!hasFilters && (
            <section className="mt-12 overflow-hidden border border-black/15 bg-[#171714] text-white" aria-labelledby="archive-feature-heading">
              <div className="grid lg:grid-cols-[.9fr_1.1fr]">
                <div className="flex flex-col justify-between p-6 md:p-9">
                  <div><div className="flex flex-wrap items-center gap-2"><LcmArchiveBadge /><span className="text-xs font-bold text-white/45">第1回LCF 出展実績・開催時の掲載情報</span></div><h3 id="archive-feature-heading" className="mt-5 text-3xl font-black tracking-tight md:text-5xl">第1回LCF<br />出展商品特集</h3><p className="mt-5 max-w-xl text-sm font-medium leading-7 text-white/60">2026年9月開催時に紹介された全{archiveItems.length}商品を、開催記録として保存しています。通常マーケットの商品とは分けて閲覧できます。</p></div>
                  <Link href="/livecommercefestival/2026/exhibitors" className="mt-7 inline-flex w-fit items-center bg-[#f7cc35] px-5 py-3 text-sm font-black text-black">特集ページを見る<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </div>
                <div className="grid grid-cols-2 gap-px bg-white/15 p-px">
                  {archivePreviewItems.map((item) => <Link key={item.page} href={`/lcm/brands/catalog-${item.page}`} className="group relative aspect-square overflow-hidden bg-[#eeeae0]"><LcmProductImage src={item.thumbnailUrl} alt={item.alt} className="h-full w-full object-cover object-top transition duration-200 group-hover:scale-[1.02]" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-10 text-[10px] font-black text-white">{item.productTitle}</span></Link>)}
                </div>
              </div>
            </section>
          )}
        </section>

        <section id="brand-registration" className="border-y border-black/15 bg-[#f7cc35] px-5 py-14 md:px-8 md:py-16">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div><p className="text-xs font-black tracking-[0.2em]">FOR BRANDS / FREE SELF REGISTRATION</p><h2 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">ブランドさんが、<br />無料で登録できます。</h2><p className="mt-5 max-w-3xl text-sm font-semibold leading-7 md:text-base">会社・ブランド担当者が、ブランドページと商品を非公開の下書きから作成します。必須項目が揃えば事前審査を待たずに自分で公開でき、公開後に問題がある場合だけ運営が非公開・利用停止を行います。</p></div>
              <Link href="/lcm/manage?workspace=brand" className="inline-flex items-center justify-center bg-[#171714] px-7 py-4 text-sm font-black text-white">無料でブランドを登録する<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </div>
            <div className="mt-10 grid gap-px bg-black/25 sm:grid-cols-2 xl:grid-cols-5">{[
              { number: "01", title: "共通アカウント", text: "LCF登録済みの場合は、同じメールアドレスとパスワードでログインします。" },
              { number: "02", title: "ブランド下書き", text: "会社名、ブランド名、ロゴ、説明、公式URLなどを保存します。" },
              { number: "03", title: "商品を登録", text: "写真、定価、魅力、サンプル、配信向き情報、会員限定条件を整理します。" },
              { number: "04", title: "ブランドを公開", text: "必須項目が揃ったら、自分でブランドページを公開します。" },
              { number: "05", title: "商品を公開", text: "続けて商品ページを公開し、サンプル・商談の受付を始めます。" },
            ].map((step) => <article key={step.number} className="bg-[#fff7d8] p-5 md:p-6"><p className="text-sm font-black tracking-[0.18em] text-[#9b6200]">STEP {step.number}</p><h3 className="mt-5 text-xl font-black">{step.title}</h3><p className="mt-3 text-sm font-semibold leading-7 text-black/60">{step.text}</p></article>)}</div>
            <div className="mt-6 grid gap-px bg-black/20 md:grid-cols-2"><div className="flex items-start gap-3 bg-[#171714] p-5 text-white"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#f7cc35]" /><p className="text-sm font-semibold leading-7"><strong className="block text-white">LCF企業アカウント連携済みの方</strong><span className="text-white/60">会社名や氏名を再入力せず、利用条件への同意後すぐにブランド管理を始められます。</span></p></div><div className="flex items-start gap-3 bg-white p-5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#16805b]" /><p className="text-sm font-semibold leading-7"><strong className="block">初めて登録する方</strong><span className="text-black/55">共通アカウントを作成し、利用条件へ同意するとすぐにブランド下書きと商品登録へ進めます。</span></p></div></div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-14 md:px-8 md:py-16">
          <div className="grid gap-px bg-black/15 md:grid-cols-3">
            <article className="bg-white p-7"><ShoppingBag className="h-7 w-7 text-[#d45b16]" /><h3 className="mt-5 text-xl font-black">登録なしで商品を見る</h3><p className="mt-3 text-sm font-medium leading-7 text-black/60">写真、ブランド、定価、商品の特徴は一般公開。検索や比較の入口を狭くしません。</p><button type="button" onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-5 inline-flex items-center border-b border-black pb-1 text-xs font-black">商品一覧へ<ArrowRight className="ml-1 h-4 w-4" /></button></article>
            <article className="bg-white p-7"><Users className="h-7 w-7 text-[#d45b16]" /><h3 className="mt-5 text-xl font-black">ライブコマーサーをポップアップで見る</h3><p className="mt-3 text-sm font-medium leading-7 text-black/60">得意カテゴリや配信形式から候補を比較。今のページを離れず、公開プロフィールを確認できます。</p><button type="button" onClick={() => setCreatorQuickViewOpen(true)} className="mt-5 inline-flex items-center border-b border-black pb-1 text-xs font-black">ライブコマーサーを見る<ArrowRight className="ml-1 h-4 w-4" /></button></article>
            <article className="bg-white p-7"><LockKeyhole className="h-7 w-7 text-[#d45b16]" /><h3 className="mt-5 text-xl font-black">重要な条件は会員限定</h3><p className="mt-3 text-sm font-medium leading-7 text-black/60">卸価格、最小発注数、送料、支払条件、報酬率は共通アカウントで保護します。</p></article>
          </div>
        </section>
        <LcmCreatorQuickViewDialog open={creatorQuickViewOpen} onOpenChange={setCreatorQuickViewOpen} />
      </main>
    </LcmPublicLayout>
  );
}
