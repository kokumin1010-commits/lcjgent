/**
 * LCM product detail: public product story and list price first, followed by
 * role-gated sample and B2B terms. This is a marketplace inquiry flow, never a
 * fictional consumer checkout.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  LockKeyhole,
  PackageCheck,
  Send,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";
import { LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { buildFestivalLoginUrl } from "@/lib/festivalPortal";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

function formatPrice(value: string | number | null | undefined) {
  if (value == null || value === "") return "価格はブランドへ確認";
  const amount = Number(value);
  return Number.isFinite(amount) ? `¥${amount.toLocaleString("ja-JP")}` : String(value);
}

function taxLabel(mode: string | null | undefined) {
  if (mode === "included") return "税込";
  if (mode === "excluded") return "税別";
  return "税区分はブランドへ確認";
}

export default function LcmProduct() {
  const [, params] = useRoute<{ slug: string }>("/lcm/products/:slug");
  const slug = params?.slug || "";
  const productQuery = trpc.lcm.getPublicProduct.useQuery({ slug }, { enabled: Boolean(slug), retry: false });
  const accessQuery = trpc.lcm.getMyAccess.useQuery(undefined, { retry: false });
  const product = productQuery.data;
  const approved = accessQuery.data?.membership?.status === "approved";
  const memberProductQuery = trpc.lcm.getMemberProduct.useQuery(
    { productId: product?.id || 0 },
    { enabled: Boolean(product?.id && approved), retry: false },
  );
  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    setActiveImage(product?.primaryImageUrl || product?.imageUrls?.[0] || null);
  }, [product?.id, product?.primaryImageUrl]);

  useEffect(() => {
    return applyPageSeo({
      title: `${product?.name || "商品"}｜LCM ライブコマースマーケット`,
      description: product?.summary || "LCM掲載商品の写真、定価、特徴、販売先、サンプル、会員限定取引条件を確認できます。",
      canonicalPath: `/lcm/products/${slug}`,
      image: product?.primaryImageUrl || "https://www.livecommercefestival.com/favicon.ico",
      jsonLd: product ? [{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.summary || product.description || undefined,
        image: product.primaryImageUrl || undefined,
        brand: { "@type": "Brand", name: product.brandName },
        offers: product.listPrice ? { "@type": "Offer", priceCurrency: product.currency, price: product.listPrice } : undefined,
      }] : undefined,
    });
  }, [product, slug]);

  const galleryImages = useMemo(
    () => [...new Set([product?.primaryImageUrl, ...(product?.imageUrls || [])].filter((value): value is string => Boolean(value)))],
    [product?.imageUrls, product?.primaryImageUrl],
  );

  if (productQuery.isLoading) return <LcmPublicLayout><main className="grid min-h-[60vh] place-items-center"><p className="font-bold">商品情報を読み込んでいます…</p></main></LcmPublicLayout>;
  if (!product) return <LcmPublicLayout><main className="grid min-h-[60vh] place-items-center px-5 text-center"><div><PackageCheck className="mx-auto h-12 w-12 text-black/25" /><h1 className="mt-5 text-3xl font-black">商品が見つかりません</h1><Link href="/lcm" className="mt-5 inline-flex font-bold underline">LCMへ戻る</Link></div></main></LcmPublicLayout>;

  const links = [
    ["公式商品ページ", product.officialProductUrl],
    ["TikTok Shop", product.tiktokShopUrl],
    ["Amazon", product.amazonUrl],
    ["楽天", product.rakutenUrl],
  ].filter(([, url]) => url);
  const samplePath = `/lcm/manage?sample=${product.id}`;
  const wholesalePath = `/lcm/manage?wholesale=${product.id}`;
  const sampleHref = accessQuery.data ? samplePath : buildFestivalLoginUrl(samplePath);
  const wholesaleHref = accessQuery.data ? wholesalePath : buildFestivalLoginUrl(wholesalePath);
  const memberProduct = memberProductQuery.data;
  const hasWholesaleTerms = memberProduct?.wholesalePrice != null;

  return (
    <LcmPublicLayout>
      <main className="bg-[#f4f1e9]">
        <section className="border-b border-black/15 bg-[#fffdf8]">
          <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-8 md:py-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/lcm" className="inline-flex items-center text-sm font-black"><ArrowLeft className="mr-2 h-4 w-4" />商品一覧へ</Link>
              <Link href={`/lcm/brands/${product.brandSlug}`} className="inline-flex items-center text-xs font-black text-black/55 hover:text-black">{product.brandName}の商品を見る<ArrowRight className="ml-1 h-4 w-4" /></Link>
            </div>

            <div className="mt-7 grid gap-8 lg:grid-cols-[1.04fr_.96fr] lg:gap-12">
              <div>
                <div className="relative aspect-square overflow-hidden border border-black/10 bg-white">
                  {activeImage ? <img src={activeImage} alt={`${product.name}の商品写真`} className="h-full w-full object-contain p-3 md:p-6" /> : <div className="grid h-full place-items-center"><PackageCheck className="h-16 w-16 text-black/20" /></div>}
                  {product.sampleAvailable && <span className="absolute left-3 top-3 bg-[#dff5ea] px-3 py-2 text-xs font-black text-[#126445]">サンプル対応</span>}
                </div>
                {galleryImages.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">{galleryImages.slice(0, 10).map((url, index) => <button key={url} type="button" onClick={() => setActiveImage(url)} aria-label={`${product.name}の商品写真${index + 1}を表示`} aria-pressed={activeImage === url} className={`aspect-square overflow-hidden border bg-white p-1 transition ${activeImage === url ? "border-black ring-2 ring-[#f7cc35]" : "border-black/15 hover:border-black"}`}><img src={url} alt="" className="h-full w-full object-contain" loading="lazy" /></button>)}</div>}
              </div>

              <div className="self-start">
                <p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">{product.category || "LCM PRODUCT"}</p>
                <Link href={`/lcm/brands/${product.brandSlug}`} className="mt-3 inline-flex items-center text-sm font-black text-black/55 hover:text-black"><Users className="mr-1.5 h-4 w-4" />{product.brandName}</Link>
                <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">{product.name}</h1>

                <div className="mt-7 border-y border-black/15 py-5">
                  <p className="text-xs font-black tracking-[0.12em] text-black/45">定価・参考小売価格</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-2"><span className="text-3xl font-black md:text-4xl">{formatPrice(product.listPrice)}</span>{product.listPrice != null && <span className="text-xs font-bold text-black/50">（{taxLabel(product.taxMode)}）</span>}</div>
                </div>

                <p className="mt-6 whitespace-pre-line text-base font-medium leading-8 text-black/65">{product.summary || product.description || "商品の詳しい情報はブランドが準備中です。"}</p>

                {(product.highlights || []).length > 0 && <div className="mt-7 grid gap-2"><p className="mb-1 text-xs font-black tracking-[0.14em] text-[#d45b16]">LIVE POINTS</p>{(product.highlights || []).slice(0, 4).map((item) => <div key={item} className="flex gap-3 border-t border-black/10 py-3 text-sm font-bold"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#16805b]" /><span>{item}</span></div>)}</div>}

                <div className="mt-7 flex flex-wrap gap-2">{links.map(([label, url]) => <a key={label} href={url!} target="_blank" rel="noreferrer" className="inline-flex items-center border border-black bg-white px-4 py-3 text-xs font-black transition hover:bg-black hover:text-white">{label}<ExternalLink className="ml-2 h-4 w-4" /></a>)}</div>

                <div className="mt-8 grid gap-2 sm:grid-cols-2">
                  {product.sampleAvailable ? <Link href={sampleHref} className="inline-flex items-center justify-center bg-[#16805b] px-5 py-4 text-sm font-black text-white">サンプルを申請する<Send className="ml-2 h-4 w-4" /></Link> : <div className="flex items-center justify-center border border-black/15 bg-white px-5 py-4 text-sm font-bold text-black/45">サンプル受付なし</div>}
                  <Link href={wholesaleHref} className="inline-flex items-center justify-center bg-[#171714] px-5 py-4 text-sm font-black text-white">取引条件を確認する<LockKeyhole className="ml-2 h-4 w-4" /></Link>
                </div>
                {!accessQuery.data && <p className="mt-3 text-center text-[11px] font-bold text-black/45">申請・取引条件の確認にはLCF・LCM共通ログインが必要です。</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-5 py-10 md:px-8 md:py-14">
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="border border-black/10 bg-white p-6 md:p-8">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[0.16em] text-[#16805b]">SAMPLE</p><h2 className="mt-2 text-2xl font-black">試してから、配信を考える。</h2></div><PackageCheck className="h-8 w-8 shrink-0 text-[#16805b]" /></div>
              {product.sampleAvailable ? <><p className="mt-5 text-sm leading-7 text-black/60">この商品はサンプル相談に対応しています。具体的な提供条件と月間受付状況は会員画面で確認できます。</p>{approved && memberProduct?.sampleInstructions && <div className="mt-4 border-l-4 border-[#16805b] bg-[#eff8f3] p-4 text-sm font-bold leading-7">{memberProduct.sampleInstructions}</div>}<Link href={sampleHref} className="mt-6 inline-flex items-center bg-[#16805b] px-5 py-3 text-sm font-black text-white">{approved ? "サンプル申請へ" : "ログインして申請条件を見る"}<Send className="ml-2 h-4 w-4" /></Link></> : <p className="mt-5 text-sm font-bold text-black/45">現在、この商品のサンプル申請は受け付けていません。</p>}
            </article>

            <article className="border border-black/10 bg-[#171714] p-6 text-white md:p-8">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[0.16em] text-[#f7cc35]">B2B TERMS</p><h2 className="mt-2 text-2xl font-black">会員限定の取引条件</h2></div><LockKeyhole className="h-8 w-8 shrink-0 text-[#f7cc35]" /></div>
              {approved && hasWholesaleTerms ? <div className="mt-5"><p className="text-xs font-bold text-white/50">卸価格</p><p className="mt-1 text-4xl font-black">{formatPrice(memberProduct?.wholesalePrice)}</p><dl className="mt-5 grid gap-3 text-sm"><div className="flex justify-between gap-4 border-t border-white/15 pt-3"><dt className="text-white/55">最小発注数</dt><dd className="text-right font-black">{memberProduct?.wholesaleMinQuantity}点</dd></div><div className="border-t border-white/15 pt-3"><dt className="text-white/55">送料条件</dt><dd className="mt-1 font-bold">{memberProduct?.wholesaleShippingTerms}</dd></div><div className="border-t border-white/15 pt-3"><dt className="text-white/55">支払条件</dt><dd className="mt-1 font-bold">{memberProduct?.wholesalePaymentTerms}</dd></div>{memberProduct?.commissionRate && <div className="flex justify-between gap-4 border-t border-white/15 pt-3"><dt className="text-white/55">参考コミッション</dt><dd className="text-right font-black text-[#f7cc35]">{memberProduct.commissionRate}</dd></div>}</dl><Link href={wholesalePath} className="mt-6 inline-flex items-center bg-[#f7cc35] px-5 py-3 text-sm font-black text-black">卸商談を申し込む<Truck className="ml-2 h-4 w-4" /></Link></div> : approved ? <div className="mt-5"><p className="text-sm leading-7 text-white/60">この商品は公開中ですが、定型の卸条件はまだ登録されていません。ブランドへ個別相談できます。</p><Link href={wholesalePath} className="mt-6 inline-flex items-center border border-white/30 px-5 py-3 text-sm font-black">ブランドへ相談する<ArrowRight className="ml-2 h-4 w-4" /></Link></div> : <div className="mt-5"><p className="text-sm leading-7 text-white/60">卸価格、最小発注数、送料、支払条件、コミッションは、承認済みLCM会員だけが確認できます。</p><div className="mt-5 grid grid-cols-2 gap-px bg-white/15 text-center text-[11px] font-bold text-white/55"><span className="bg-[#171714] p-3">卸価格</span><span className="bg-[#171714] p-3">最低発注数</span><span className="bg-[#171714] p-3">送料・支払</span><span className="bg-[#171714] p-3">報酬条件</span></div><Link href={wholesaleHref} className="mt-6 inline-flex items-center bg-[#f7cc35] px-5 py-3 text-sm font-black text-black">ログインして取引条件を見る<ArrowRight className="ml-2 h-4 w-4" /></Link></div>}
            </article>
          </div>

          {product.description && product.description !== product.summary && <section className="mt-12 grid gap-6 border-y border-black/15 py-10 lg:grid-cols-[260px_1fr]"><div><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">PRODUCT STORY</p><h2 className="mt-2 text-3xl font-black">商品について</h2></div><p className="whitespace-pre-line text-base leading-8 text-black/65">{product.description}</p></section>}

          <section className="mt-12 grid gap-px bg-black/15 md:grid-cols-3">
            {[{ icon: ShoppingBag, title: "商品情報は公開", text: "写真、商品名、ブランド、定価、特徴を登録なしで確認できます。" }, { icon: LockKeyhole, title: "取引条件は保護", text: "卸価格や報酬率は承認済み会員だけに表示します。" }, { icon: ShieldCheck, title: "商談で最終合意", text: "LCM内で注文・決済は確定せず、ブランドとの合意で取引が成立します。" }].map(({ icon: Icon, title, text }) => <article key={title} className="bg-white p-6"><Icon className="h-6 w-6 text-[#d45b16]" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-7 text-black/55">{text}</p></article>)}
          </section>
        </section>
      </main>
    </LcmPublicLayout>
  );
}
