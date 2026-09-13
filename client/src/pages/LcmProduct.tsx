/**
 * LCM product page: public product truth first; sensitive wholesale terms are
 * fetched only after approved LCM membership. No checkout or false live inventory.
 */
import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ExternalLink, LockKeyhole, PackageCheck, Send, ShieldCheck, Truck } from "lucide-react";
import { LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

function price(value: string | number | null | undefined) {
  if (value == null || value === "") return "価格はブランドへ確認";
  return `¥${Number(value).toLocaleString("ja-JP")}`;
}

export default function LcmProduct() {
  const [, params] = useRoute<{ slug: string }>("/lcm/products/:slug");
  const slug = params?.slug || "";
  const productQuery = trpc.lcm.getPublicProduct.useQuery({ slug }, { enabled: Boolean(slug), retry: false });
  const accessQuery = trpc.lcm.getMyAccess.useQuery(undefined, { retry: false });
  const product = productQuery.data;
  const approved = accessQuery.data?.membership?.status === "approved";
  const wholesaleQuery = trpc.lcm.getWholesaleTerms.useQuery({ productId: product?.id || 0 }, { enabled: Boolean(product?.id && approved), retry: false });

  useEffect(() => {
    return applyPageSeo({ title: `${product?.name || "商品"}｜LCM ライブコマースマーケット`, description: product?.summary || "LCM掲載商品の詳細、販売先、サンプル、卸商談情報を確認できます。", canonicalPath: `/lcm/products/${slug}`, image: product?.primaryImageUrl || "https://www.livecommercefestival.com/favicon.ico", jsonLd: product ? [{ "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.summary || product.description || undefined, image: product.primaryImageUrl || undefined, brand: { "@type": "Brand", name: product.brandName }, offers: product.listPrice ? { "@type": "Offer", priceCurrency: product.currency, price: product.listPrice, availability: "https://schema.org/InStock" } : undefined }] : undefined });
  }, [product, slug]);

  if (productQuery.isLoading) return <LcmPublicLayout><main className="grid min-h-[60vh] place-items-center"><p className="font-bold">商品情報を読み込んでいます…</p></main></LcmPublicLayout>;
  if (!product) return <LcmPublicLayout><main className="grid min-h-[60vh] place-items-center px-5 text-center"><div><PackageCheck className="mx-auto h-12 w-12 text-black/25" /><h1 className="mt-5 text-3xl font-black">商品が見つかりません</h1><Link href="/lcm" className="mt-5 inline-flex font-bold underline">LCMへ戻る</Link></div></main></LcmPublicLayout>;

  const links = [["公式商品ページ", product.officialProductUrl], ["TikTok Shop", product.tiktokShopUrl], ["Amazon", product.amazonUrl], ["楽天", product.rakutenUrl]].filter(([, url]) => url);
  return <LcmPublicLayout><main className="mx-auto max-w-[1320px] px-5 py-10 md:px-8 md:py-16">
    <Link href={`/lcm/brands/${product.brandSlug}`} className="inline-flex items-center text-sm font-black"><ArrowLeft className="mr-2 h-4 w-4" />{product.brandName}へ</Link>
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1fr]">
      <div><div className="aspect-square overflow-hidden border border-black/15 bg-white">{product.primaryImageUrl ? <img src={product.primaryImageUrl} alt={product.name} className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center"><PackageCheck className="h-16 w-16 text-black/20" /></div>}</div>{(product.imageUrls || []).length > 1 && <div className="mt-3 grid grid-cols-4 gap-2">{(product.imageUrls || []).slice(0, 8).map((url) => <div key={url} className="aspect-square border border-black/15 bg-white"><img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /></div>)}</div>}</div>
      <div className="self-start"><p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">{product.category || "LCM PRODUCT"}</p><Link href={`/lcm/brands/${product.brandSlug}`} className="mt-2 inline-flex text-sm font-bold text-black/55 hover:text-black">{product.brandName}</Link><h1 className="mt-3 text-4xl font-black leading-tight tracking-tight md:text-6xl">{product.name}</h1><p className="mt-6 text-lg font-black">参考小売価格 <span className="text-3xl">{price(product.listPrice)}</span>{product.taxMode === "included" ? "（税込）" : product.taxMode === "excluded" ? "（税別）" : ""}</p><p className="mt-6 whitespace-pre-line text-base leading-8 text-black/65">{product.summary || product.description}</p>
        {(product.highlights || []).length > 0 && <div className="mt-7 grid gap-2">{(product.highlights || []).map((item) => <div key={item} className="flex gap-3 border-t border-black/10 py-3 text-sm font-bold"><span className="text-[#d45b16]">●</span><span>{item}</span></div>)}</div>}
        <div className="mt-8 flex flex-wrap gap-3">{links.map(([label, url]) => <a key={label} href={url!} target="_blank" rel="noreferrer" className="inline-flex items-center border border-black bg-white px-4 py-3 text-sm font-black">{label}<ExternalLink className="ml-2 h-4 w-4" /></a>)}</div>
      </div>
    </div>

    <div className="mt-16 grid gap-px bg-black/15 lg:grid-cols-2">
      <section className="bg-white p-6 md:p-8"><div className="flex items-center justify-between"><div><p className="text-xs font-black tracking-[0.16em] text-[#16805b]">SAMPLE</p><h2 className="mt-2 text-2xl font-black">サンプル申請</h2></div><PackageCheck className="h-8 w-8 text-[#16805b]" /></div>{product.sampleAvailable ? <><p className="mt-5 text-sm leading-7 text-black/60">{product.sampleInstructions || "商品を紹介する目的と配信予定を入力して、ブランドの確認を受けます。"}</p><Link href={`/lcm/manage?sample=${product.id}`} className="mt-6 inline-flex items-center bg-[#16805b] px-5 py-3 text-sm font-black text-white">サンプルを申請する<Send className="ml-2 h-4 w-4" /></Link></> : <p className="mt-5 text-sm font-bold text-black/45">現在、この商品のサンプル申請は受け付けていません。</p>}</section>
      <section className="bg-[#171714] p-6 text-white md:p-8"><div className="flex items-center justify-between"><div><p className="text-xs font-black tracking-[0.16em] text-[#f7cc35]">WHOLESALE</p><h2 className="mt-2 text-2xl font-black">会員限定の卸条件</h2></div><LockKeyhole className="h-8 w-8 text-[#f7cc35]" /></div>{approved && wholesaleQuery.data?.wholesalePrice != null ? <div className="mt-5"><p className="text-sm text-white/55">卸価格</p><p className="mt-1 text-4xl font-black">{price(wholesaleQuery.data.wholesalePrice)}</p><dl className="mt-5 grid gap-3 text-sm"><div className="flex justify-between border-t border-white/15 pt-3"><dt>最小発注数</dt><dd className="font-black">{wholesaleQuery.data.wholesaleMinQuantity}点</dd></div><div className="border-t border-white/15 pt-3"><dt className="text-white/55">送料条件</dt><dd className="mt-1 font-bold">{wholesaleQuery.data.wholesaleShippingTerms}</dd></div><div className="border-t border-white/15 pt-3"><dt className="text-white/55">支払条件</dt><dd className="mt-1 font-bold">{wholesaleQuery.data.wholesalePaymentTerms}</dd></div></dl><Link href={`/lcm/manage?wholesale=${product.id}`} className="mt-6 inline-flex items-center bg-[#f7cc35] px-5 py-3 text-sm font-black text-black">卸商談を申し込む<Truck className="ml-2 h-4 w-4" /></Link></div> : <div className="mt-5"><p className="text-sm leading-7 text-white/60">卸価格、最小発注数、送料、支払条件はLCM承認会員だけが確認できます。</p><Link href="/lcm/manage" className="mt-6 inline-flex items-center border border-white/30 px-5 py-3 text-sm font-black">ログイン・会員申請</Link></div>}</section>
    </div>
    {product.description && product.description !== product.summary && <section className="mt-16 max-w-4xl"><p className="text-xs font-black tracking-[0.16em] text-black/45">PRODUCT STORY</p><h2 className="mt-2 text-3xl font-black">商品について</h2><p className="mt-5 whitespace-pre-line text-base leading-8 text-black/65">{product.description}</p></section>}
    <div className="mt-16 border border-black/15 bg-[#fff8dc] p-6 text-sm leading-7 text-black/65"><ShieldCheck className="mb-2 h-5 w-5 text-[#16805b]" />LCMは商品情報と商談機会を提供するB2B市場です。注文・決済はLCM内では確定せず、取引条件はブランドとの合意をもって成立します。</div>
  </main></LcmPublicLayout>;
}
