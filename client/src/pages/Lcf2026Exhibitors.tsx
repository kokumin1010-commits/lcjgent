/**
 * LCF 2026 exhibitor catalogue archive.
 * Design: Japanese editorial trade archive — matte black, warm ivory, signal gold, source-first page facsimiles.
 * Purpose: preserve every supplied catalogue page while making exhibitors and products searchable and accessible.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, FileText, Search, X } from "lucide-react";
import { lcf2026ExhibitorCatalogMeta, lcf2026ExhibitorCatalogPages } from "@/data/lcf2026ExhibitorCatalog";
import { lcfContactEmail } from "@/data/lcfEditions";
import { applyPageSeo } from "@/lib/pageSeo";

const catalogPath = "/livecommercefestival/2026/exhibitors";
const ogImage = lcf2026ExhibitorCatalogPages[25].imageUrl;

export default function Lcf2026Exhibitors() {
  const [query, setQuery] = useState("");
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  useEffect(() => {
    applyPageSeo({
      title: "第1回LCF 2026 出展企業実績｜全32ページ企業・商品カタログ",
      description: "第1回LIVE COMMERCE FESTIVAL 2026の出展企業・商品カタログ全32ページを公開。企業名、商品、特徴、価格、メッセージを紙面と全文テキストで確認できます。",
      canonicalPath: catalogPath,
      image: ogImage,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "第1回LCF 2026 出展企業実績",
          description: "第1回LIVE COMMERCE FESTIVAL 2026 出展企業・商品カタログ全32ページ。",
          url: `${window.location.origin}${catalogPath}`,
          numberOfItems: lcf2026ExhibitorCatalogMeta.pageCount,
          primaryImageOfPage: ogImage,
          inLanguage: "ja",
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "LIVE COMMERCE FESTIVAL", item: `${window.location.origin}/` },
            { "@type": "ListItem", position: 2, name: "第1回 LCF 2026", item: `${window.location.origin}/2026` },
            { "@type": "ListItem", position: 3, name: "出展企業実績", item: `${window.location.origin}${catalogPath}` },
          ],
        },
      ],
    });
  }, []);

  useEffect(() => {
    if (selectedPage === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPage(null);
      if (event.key === "ArrowLeft") setSelectedPage((current) => current === null ? null : Math.max(1, current - 1));
      if (event.key === "ArrowRight") setSelectedPage((current) => current === null ? null : Math.min(lcf2026ExhibitorCatalogMeta.pageCount, current + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedPage]);

  const filteredPages = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ja");
    if (!normalized) return lcf2026ExhibitorCatalogPages;
    return lcf2026ExhibitorCatalogPages.filter((page) => [
      page.name,
      page.category,
      page.productTitle,
      page.pickupProduct,
      page.highlights,
      page.otherProducts,
      page.message,
      page.sourceText,
    ].join("\n").toLocaleLowerCase("ja").includes(normalized));
  }, [query]);

  const selected = selectedPage === null ? null : lcf2026ExhibitorCatalogPages[selectedPage - 1];

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans text-white antialiased">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090909]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 md:h-20 md:px-10">
          <a href="/" className="inline-flex items-center gap-3 text-xs font-black tracking-[0.18em] text-white">
            <span className="grid h-10 w-10 place-items-center bg-[#f2cb3c] text-sm tracking-[-0.08em] text-black">LCF</span>
            <span className="hidden sm:inline">EXHIBITOR ARCHIVE</span>
          </a>
          <nav className="flex items-center gap-2 text-[10px] font-bold sm:text-xs" aria-label="出展企業実績ナビゲーション">
            <a href="/" className="inline-flex items-center gap-1.5 border border-white/20 px-3 py-2.5 text-white/75 transition-colors hover:border-white hover:text-white md:px-5">
              <ArrowLeft size={14} /> TOP
            </a>
            <a href="/livecommercefestival/2026/report" className="hidden border border-white/20 px-5 py-2.5 text-white/75 transition-colors hover:border-white hover:text-white sm:inline-flex">開催レポート</a>
            <a href="/lcf/mypage" className="bg-[#7c3aed] px-3 py-2.5 text-white transition-colors hover:bg-[#8b5cf6] md:px-5">マイページ</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-white/10 px-5 py-20 md:px-10 md:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(242,203,60,.18),transparent_35%),linear-gradient(135deg,#090909,#14120b_58%,#090909)]" />
          <div className="relative mx-auto grid max-w-[1500px] gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div>
              <p className="flex items-center gap-3 text-xs font-black tracking-[0.28em] text-[#f2cb3c]">
                <span className="h-px w-10 bg-[#f2cb3c]" /> EXHIBITOR ARCHIVE / 2026
              </p>
              <h1 className="mt-8 max-w-5xl text-[clamp(3.2rem,8vw,8.8rem)] font-black uppercase leading-[0.82] tracking-[-0.075em]">
                Brands<br />Made It<br /><span className="text-[#f2cb3c]">Real.</span>
              </h1>
              <p className="mt-8 max-w-2xl text-xl font-black leading-tight tracking-[-0.04em] md:text-4xl">出展企業と商品が、<br />ライブコマースを現実にした。</p>
              <p className="mt-6 max-w-2xl text-sm leading-8 text-white/62 md:text-base">第1回LCFで紹介された企業、ブランド、商品、特徴、価格、メッセージを、提供されたカタログ全32ページと検索可能な全文で公開します。</p>
            </div>
            <div className="grid grid-cols-2 border-l border-t border-white/20">
              <div className="border-b border-r border-white/20 p-6 md:p-8"><p className="text-5xl font-black tracking-[-0.07em]">32</p><p className="mt-3 text-xs font-bold tracking-[0.12em] text-white/55">ORIGINAL PAGES</p></div>
              <div className="border-b border-r border-white/20 p-6 md:p-8"><p className="text-5xl font-black tracking-[-0.07em]">100<span className="text-2xl">%</span></p><p className="mt-3 text-xs font-bold tracking-[0.12em] text-white/55">CATALOG ARCHIVE</p></div>
              <div className="col-span-2 border-b border-r border-white/20 p-6 md:p-8"><p className="text-sm font-black text-[#f2cb3c]">2026.08.27 SOURCE</p><p className="mt-2 text-xs leading-6 text-white/48">制作時点の企業提供情報を、開催記録としてページ順に掲載。</p></div>
            </div>
          </div>
        </section>

        <section className="bg-[#f1eee7] px-5 py-8 text-[#111] md:px-10">
          <div className="mx-auto flex max-w-[1500px] items-start gap-4 border-l-4 border-[#c99d11] bg-white px-5 py-4">
            <FileText className="mt-0.5 shrink-0 text-[#9a7410]" size={20} />
            <p className="text-xs leading-6 text-black/60 md:text-sm">本ページは、2026年8月27日時点の提供カタログを開催アーカイブとして掲載しています。価格、商品仕様、ランキング、販売実績、ブース表記は制作時点の原稿内容です。最新情報は各社公式サイトでご確認ください。</p>
          </div>
        </section>

        <section id="catalog" className="bg-[#f1eee7] px-5 pb-24 pt-12 text-[#111] md:px-10 md:pb-32">
          <div className="mx-auto max-w-[1500px]">
            <div className="grid gap-8 border-t border-black/25 pt-6 md:grid-cols-[0.7fr_1.3fr] md:items-end">
              <div>
                <p className="text-xs font-black tracking-[0.24em] text-black/42">ALL 32 PAGES</p>
                <h2 className="mt-4 text-4xl font-black tracking-[-0.055em] md:text-7xl">企業・商品を<br />すべて見る。</h2>
              </div>
              <div className="md:justify-self-end md:w-full md:max-w-xl">
                <label htmlFor="catalog-search" className="text-xs font-bold tracking-[0.12em] text-black/45">企業名・商品名・キーワードで検索</label>
                <div className="mt-3 flex items-center gap-3 border-b-2 border-black px-1 pb-3">
                  <Search size={20} />
                  <input id="catalog-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：コスメ、NMN、ヘアケア" className="w-full bg-transparent text-base font-bold outline-none placeholder:text-black/28" />
                  {query && <button type="button" onClick={() => setQuery("")} className="p-1 text-black/45 hover:text-black" aria-label="検索語を消去"><X size={18} /></button>}
                </div>
                <p className="mt-3 text-right text-xs text-black/40">{filteredPages.length} / {lcf2026ExhibitorCatalogMeta.pageCount} ページ</p>
              </div>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPages.map((page) => (
                <button key={page.page} type="button" onClick={() => setSelectedPage(page.page)} className="group text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c99d11]/40" aria-label={`${page.alt}を拡大表示`}>
                  <div className="relative overflow-hidden border border-black/15 bg-[#0b0b0b] shadow-[0_18px_55px_rgba(0,0,0,.12)]">
                    <img src={page.thumbnailUrl} alt={page.alt} width={595} height={841} loading={page.page <= 4 ? "eager" : "lazy"} className="aspect-[595/841] h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.012]" />
                    <span className="absolute right-0 top-0 bg-[#f2cb3c] px-3 py-2 text-[10px] font-black tracking-[0.14em] text-black">PAGE {String(page.page).padStart(2, "0")}</span>
                  </div>
                  <span className="sr-only" aria-hidden="true">{page.sourceText}</span>
                  <div className="border-b border-black/20 pb-5 pt-4">
                    <p className="text-[10px] font-bold tracking-[0.12em] text-[#9a7410]">{page.category}</p>
                    <h3 className="mt-2 text-lg font-black leading-6 tracking-[-0.025em]">{page.name}</h3>
                    {page.productTitle && <p className="mt-2 line-clamp-2 text-xs leading-5 text-black/52">{page.productTitle}</p>}
                  </div>
                </button>
              ))}
            </div>

            {filteredPages.length === 0 && (
              <div className="mt-14 border border-black/15 bg-white px-6 py-16 text-center"><p className="text-xl font-black">一致する掲載ページがありません。</p><button type="button" onClick={() => setQuery("")} className="mt-5 border-b border-black pb-1 text-sm font-bold">全ページへ戻る</button></div>
            )}
          </div>
        </section>

        <section className="bg-[#d5aa19] px-5 py-20 text-black md:px-10 md:py-28">
          <div className="mx-auto grid max-w-[1500px] gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-end">
            <div><p className="text-xs font-black tracking-[0.22em]">FOR THE NEXT EXHIBITORS</p><h2 className="mt-5 text-5xl font-black leading-[0.93] tracking-[-0.06em] md:text-7xl">次は、あなたの商品が<br />動き出す番です。</h2></div>
            <div className="md:justify-self-end"><p className="max-w-xl text-sm font-medium leading-7 text-black/68">出展、商品紹介、ライブコマーサーとの協業については、目的や商品カテゴリを添えて運営事務局へお問い合わせください。</p><a href={`mailto:${lcfContactEmail}?subject=LCF%E5%87%BA%E5%B1%95%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87`} className="mt-7 inline-flex items-center gap-4 border-b-2 border-black pb-2 text-base font-black">出展について相談する <ArrowUpRight size={20} /></a></div>
          </div>
        </section>
      </main>

      <footer className="bg-[#090909] px-5 py-10 md:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 border-t border-white/15 pt-8 text-xs text-white/45 md:flex-row md:items-end md:justify-between">
          <div><p className="font-black tracking-[0.18em] text-white">LIVE COMMERCE FESTIVAL</p><p className="mt-2">Commerce moves people.</p></div>
          <div className="flex flex-wrap gap-5"><a href="/" className="hover:text-white">TOP</a><a href="/2026" className="hover:text-white">第1回イベントページ</a><a href="/livecommercefestival/2026/report" className="hover:text-white">開催レポート</a><a href="/lcf/mypage" className="hover:text-white">マイページ</a></div>
          <p>© 2026 LCF実行委員会</p>
        </div>
      </footer>

      {selected && (
        <div className="fixed inset-0 z-[100] bg-black/95 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label={`${selected.name} カタログ${selected.page}ページ`} onClick={() => setSelectedPage(null)}>
          <div className="mx-auto grid h-full max-w-[1500px] overflow-hidden border border-white/15 bg-[#101010] lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]" onClick={(event) => event.stopPropagation()}>
            <div className="relative flex min-h-0 items-center justify-center overflow-auto bg-black p-3 md:p-7">
              <img src={selected.imageUrl} alt={selected.alt} width={selected.imageWidth} height={selected.imageHeight} className="h-auto max-h-full max-w-full object-contain" />
              <button type="button" onClick={() => setSelectedPage(null)} className="absolute right-4 top-4 grid h-11 w-11 place-items-center border border-white/25 bg-black/75 text-white backdrop-blur hover:border-white" aria-label="閉じる"><X size={22} /></button>
              <button type="button" onClick={() => setSelectedPage(Math.max(1, selected.page - 1))} disabled={selected.page === 1} className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center border border-white/25 bg-black/75 text-white backdrop-blur disabled:opacity-25" aria-label="前のページ"><ChevronLeft size={24} /></button>
              <button type="button" onClick={() => setSelectedPage(Math.min(lcf2026ExhibitorCatalogMeta.pageCount, selected.page + 1))} disabled={selected.page === lcf2026ExhibitorCatalogMeta.pageCount} className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center border border-white/25 bg-black/75 text-white backdrop-blur disabled:opacity-25" aria-label="次のページ"><ChevronRight size={24} /></button>
            </div>
            <aside className="min-h-0 overflow-y-auto border-t border-white/15 p-6 lg:border-l lg:border-t-0 lg:p-8">
              <p className="text-xs font-black tracking-[0.2em] text-[#f2cb3c]">PAGE {String(selected.page).padStart(2, "0")} / {lcf2026ExhibitorCatalogMeta.pageCount}</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.045em]">{selected.name}</h2>
              <p className="mt-2 text-xs font-bold tracking-[0.08em] text-white/42">{selected.category}</p>
              {selected.productTitle && <p className="mt-6 text-base font-bold leading-7 text-white/78">{selected.productTitle}</p>}
              <div className="mt-7 flex flex-wrap gap-3">
                <a href={selected.imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#f2cb3c] px-4 py-3 text-xs font-black text-black">高解像度で開く <ArrowUpRight size={15} /></a>
                {selected.officialUrl && <a href={selected.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-white/25 px-4 py-3 text-xs font-bold text-white">公式サイト <ArrowUpRight size={15} /></a>}
              </div>
              <details className="mt-8 border-t border-white/15 pt-6" open>
                <summary className="cursor-pointer text-xs font-black tracking-[0.16em] text-white/68">紙面テキストを読む</summary>
                <p className="mt-5 whitespace-pre-wrap text-xs leading-7 text-white/56">{selected.sourceText}</p>
              </details>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
