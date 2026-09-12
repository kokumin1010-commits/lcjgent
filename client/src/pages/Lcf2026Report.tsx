/**
 * LCF 2026 permanent report archive.
 * Design: documentary editorial layout with original event photography and verifiable public outcomes.
 * No operational /lcf route or historical event data is mutated by this page.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Camera, ChevronRight, Download, X } from "lucide-react";
import { lcf2026Coverage, lcf2026PhotoById, lcf2026Photos, lcf2026Stats, lcf2026SyndicatedOutlets, lcfContactEmail, type LcfPhoto } from "@/data/lcfEditions";
import { formatArchiveSize, lcf2026PhotoDownloadChunks } from "@/data/lcf2026PhotoDownloads";
import { applyPageSeo } from "@/lib/pageSeo";

const hero = lcf2026PhotoById["D2-035"];
const galleryFilters = [
  { id: "all", label: "すべて" },
  { id: "day1", label: "DAY1" },
  { id: "awards", label: "表彰式・アフターパーティー" },
  { id: "day2", label: "DAY2" },
] as const;

const galleryGroupLabels = {
  day1: "DAY1",
  awards: "表彰式・アフターパーティー",
  day2: "DAY2",
} as const;
const story = [
  {
    eyebrow: "DAY 01 / THE ENCOUNTER",
    title: "企業とライバーが、同じ熱量で向き合った日。",
    body: "商品を実際に手に取り、つくり手の言葉を聞き、その場でライブ配信へ。DAY1には約500名のライブコマーサーが集まり、会場のあちこちで新しい販売と協業のきっかけが生まれました。",
    ids: ["D1-094", "D1-030", "D1-053", "D1-056", "D1-137", "D1-234"],
  },
  {
    eyebrow: "LIVE COMMERCE AWARD / COMMUNITY",
    title: "成果を称え、次の挑戦を語り合う。",
    body: "DAY1終了後は約200名がアフターパーティーに参加。LIVE COMMERCE AWARDの表彰と交流を通じて、ライバー、企業、業界関係者のつながりが次のプロジェクトへ広がりました。",
    ids: ["AW-085", "AW-031", "AW-040", "AW-001", "AW-094", "AW-024"],
  },
  {
    eyebrow: "DAY 02 / LEARNING & ACTION",
    title: "知識が共有され、会場全体が実践の場になった。",
    body: "DAY2は全セミナープログラムが満席。トッププレイヤーの知見、商品体験、観客との対話が連続し、ライブコマースを学ぶだけでなく、その場で試す2日目となりました。",
    ids: ["D2-187", "D2-200", "D2-144", "D2-170", "D2-064", "D2-114"],
  },
];

function ReportHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/88 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 md:h-20 md:px-10">
        <a href="/" className="flex items-center gap-2 text-[10px] font-black tracking-[0.1em] sm:text-xs sm:tracking-[0.16em]"><ArrowLeft size={16} /> <span className="hidden sm:inline">LCF HOME</span><span className="sm:hidden">LCF</span></a>
        <p className="hidden text-[10px] font-bold tracking-[0.22em] text-white/50 lg:block">EDITION 01 / OFFICIAL REPORT</p>
        <div className="flex items-center gap-2">
          <a href="/2026" className="hidden items-center gap-1.5 border border-[#f2cb3c]/70 px-3 py-2 text-[10px] font-bold text-[#f2cb3c] transition-colors hover:bg-[#f2cb3c] hover:text-black sm:flex md:text-xs">第1回イベントページを見る <ArrowUpRight size={14} /></a>
          <a href="/lcf/mypage" className="bg-[#7c3aed] px-3 py-2 text-[10px] font-bold text-white transition-colors hover:bg-[#8b5cf6] md:px-4 md:text-xs">マイページ</a>
        </div>
      </div>
    </header>
  );
}

function StoryGallery({ photos, onOpen }: { photos: LcfPhoto[]; onOpen: (photo: LcfPhoto) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-12 md:grid-rows-[320px_240px] md:gap-5">
      {photos.map((photo, index) => {
        const positions = ["col-span-2 md:col-span-7", "md:col-span-5", "md:col-span-4", "md:col-span-4", "md:col-span-4", "col-span-2 md:hidden"];
        return (
          <button key={photo.id} type="button" onClick={() => onOpen(photo)} className={`group relative min-h-48 overflow-hidden bg-black/5 text-left ${positions[index]}`} aria-label={`${photo.alt}を拡大表示`}>
            <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
            <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center bg-black/70 text-white backdrop-blur"><Camera size={16} /></span>
          </button>
        );
      })}
    </div>
  );
}

export default function Lcf2026Report() {
  const [activePhoto, setActivePhoto] = useState<LcfPhoto | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<(typeof galleryFilters)[number]["id"]>("all");
  const gallery = useMemo(() => lcf2026Photos, []);
  const visibleGallery = useMemo(
    () => galleryFilter === "all" ? gallery : gallery.filter((photo) => photo.group === galleryFilter),
    [gallery, galleryFilter],
  );

  useEffect(() => {
    applyPageSeo({
      title: "第1回LCF 2026開催レポート｜写真・メディア掲載・公式アーカイブ",
      description: "第1回LIVE COMMERCE FESTIVAL 2026の公式開催レポート。企業50社、750名以上のライバーが集結した2日間を、48枚の写真、代表メディア9記事、公式写真798枚のダウンロードで振り返ります。",
      canonicalPath: "/livecommercefestival/2026/report",
      image: hero.src,
      type: "article",
      jsonLd: [
        { "@context": "https://schema.org", "@type": "Article", headline: "第1回LIVE COMMERCE FESTIVAL 2026開催レポート", description: "企業50社と750名以上のライバーが集結した2日間の公式記録。", image: [hero.src], datePublished: "2026-09-10", dateModified: "2026-09-13", mainEntityOfPage: `${window.location.origin}/livecommercefestival/2026/report`, author: { "@type": "Organization", name: "LIVE COMMERCE FESTIVAL" }, publisher: { "@type": "Organization", name: "LIVE COMMERCE FESTIVAL" } },
        { "@context": "https://schema.org", "@type": "ImageGallery", name: "LIVE COMMERCE FESTIVAL 2026 公式写真ギャラリー", description: "DAY1、表彰式・アフターパーティー、DAY2から選んだ48枚の公式写真。", numberOfItems: 48, url: `${window.location.origin}/livecommercefestival/2026/report#gallery` },
      ],
    });
  }, []);

  useEffect(() => {
    if (!activePhoto) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setActivePhoto(null); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [activePhoto]);

  return (
    <div className="min-h-screen bg-[#eeeae2] text-[#0c0c0c] antialiased">
      <ReportHeader />
      <main>
        <section className="relative min-h-[780px] overflow-hidden bg-black text-white md:min-h-[900px]">
          <img src={hero.src} alt={hero.alt} width={hero.width} height={hero.height} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.2)_0%,rgba(0,0,0,.2)_38%,rgba(0,0,0,.92)_100%)]" />
          <div className="relative mx-auto flex min-h-[780px] max-w-[1500px] flex-col justify-end px-5 pb-16 pt-28 md:min-h-[900px] md:px-10 md:pb-24">
            <p className="text-xs font-bold tracking-[0.28em] text-[#f2cb3c]">OFFICIAL REPORT / 2026.09.08—09.09</p>
            <h1 className="mt-6 max-w-6xl text-[clamp(3.3rem,9vw,9rem)] font-black uppercase leading-[0.82] tracking-[-0.07em]">The First<br />Spark.</h1>
            <div className="mt-9 grid gap-6 border-t border-white/30 pt-6 md:grid-cols-[1.2fr_0.8fr]">
              <p className="max-w-3xl text-lg font-bold leading-8 md:text-2xl md:leading-10">第1回 LIVE COMMERCE FESTIVAL 2026。<br />二日間に生まれた、出会い・販売・学び・熱狂の記録。</p>
              <p className="max-w-xl text-sm leading-7 text-white/65 md:justify-self-end">2026年9月8日・9日、東京・八芳園。企業50社と750名以上のライバーが集い、ライブコマースの現在地と次の可能性を共有しました。</p>
            </div>
          </div>
        </section>

        <section className="border-b border-black/20 bg-[#f2cb3c] px-5 py-6 md:px-10">
          <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-y-7 md:grid-cols-4">
            {lcf2026Stats.map((stat) => <div key={stat.label} className="border-l border-black/30 pl-4 md:pl-6"><p className="text-4xl font-black tracking-[-0.05em] md:text-6xl">{stat.value}</p><p className="mt-2 text-xs font-black tracking-[0.08em]">{stat.label}</p></div>)}
          </div>
        </section>

        {story.map((section, sectionIndex) => {
          const photos = section.ids.map((id) => lcf2026PhotoById[id]);
          return (
            <section key={section.eyebrow} className={`px-5 py-24 md:px-10 md:py-32 ${sectionIndex % 2 === 1 ? "bg-[#0e0e0e] text-white" : "bg-[#eeeae2]"}`}>
              <div className="mx-auto max-w-[1500px]">
                <div className="mb-14 grid gap-8 border-t border-current/25 pt-6 md:grid-cols-[0.7fr_1.3fr]">
                  <p className={`text-xs font-black tracking-[0.22em] ${sectionIndex % 2 === 1 ? "text-[#f2cb3c]" : "text-black/45"}`}>{section.eyebrow}</p>
                  <div><h2 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.055em] md:text-7xl">{section.title}</h2><p className={`mt-7 max-w-3xl text-base leading-8 ${sectionIndex % 2 === 1 ? "text-white/60" : "text-black/58"}`}>{section.body}</p></div>
                </div>
                <StoryGallery photos={photos} onOpen={setActivePhoto} />
              </div>
            </section>
          );
        })}

        <section id="gallery" className="bg-white px-5 py-24 md:px-10 md:py-32">
          <div className="mx-auto max-w-[1500px]">
            <div className="flex flex-col gap-6 border-t border-black/25 pt-6 md:flex-row md:items-end md:justify-between">
              <div><p className="text-xs font-black tracking-[0.22em] text-black/40">PHOTO ARCHIVE / 48 SELECTED</p><h2 className="mt-4 text-5xl font-black tracking-[-0.06em] md:text-7xl">会場をつくった、<br />48の瞬間。</h2></div>
              <a href="#official-downloads" className="inline-flex items-center gap-3 border-b-2 border-black pb-2 text-sm font-black">公式写真798枚をダウンロード <Download size={18} /></a>
            </div>
            <div className="mt-10 flex flex-wrap gap-2" aria-label="写真カテゴリー">
              {galleryFilters.map((filter) => {
                const count = filter.id === "all" ? gallery.length : gallery.filter((photo) => photo.group === filter.id).length;
                const selected = galleryFilter === filter.id;
                return (
                  <button key={filter.id} type="button" onClick={() => setGalleryFilter(filter.id)} aria-pressed={selected} className={`border px-4 py-3 text-xs font-black transition-colors ${selected ? "border-black bg-black text-white" : "border-black/20 bg-transparent text-black hover:border-black"}`}>
                    {filter.label} <span className={selected ? "text-white/55" : "text-black/40"}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-14 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {visibleGallery.map((photo, index) => (
                <button key={photo.id} type="button" onClick={() => setActivePhoto(photo)} className={`group relative overflow-hidden bg-black/5 ${index % 9 === 0 ? "col-span-2 row-span-2" : ""}`} aria-label={`${photo.alt}を拡大表示`}>
                  <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" className="aspect-[3/2] h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10 text-left text-[10px] font-bold tracking-[0.08em] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{galleryGroupLabels[photo.group]} / {photo.id}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="official-downloads" className="border-t border-black/15 bg-[#e5dfd3] px-5 py-24 md:px-10 md:py-32">
          <div className="mx-auto max-w-[1500px]">
            <div className="grid gap-8 border-t border-black/30 pt-6 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="text-xs font-black tracking-[0.22em] text-black/45">公式写真 / 全798枚</p>
                <h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-7xl">公式写真を、<br />まとめてダウンロード。</h2>
              </div>
              <div className="lg:pt-2">
                <p className="max-w-3xl text-base leading-8 text-black/62">第1回LCFで公式撮影した写真798枚を、DAY1、表彰式・アフターパーティー、DAY2に分けて用意しました。見たい場面の写真パックだけを選んでダウンロードできます。</p>
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-black/55"><span>全798枚</span><span>9つの写真パック</span><span>合計約4.2 GB</span><span>LCF自社保存</span></div>
              </div>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {lcf2026PhotoDownloadChunks.map((chunk) => (
                <a key={chunk.chunk} href={chunk.downloadUrl} download className="group flex min-h-40 flex-col justify-between border border-black/20 bg-[#f5f1e9] p-6 transition-colors hover:border-black hover:bg-white">
                  <div className="flex items-start justify-between gap-5"><span className="text-[10px] font-black tracking-[0.12em] text-black/40">{chunk.eyebrow}</span><Download size={19} className="shrink-0 transition-transform group-hover:translate-y-1" /></div>
                  <div className="mt-8"><h3 className="text-lg font-black leading-6">{chunk.label}</h3><p className="mt-2 text-xs font-bold text-black/45">写真{chunk.photoCount}枚 · {formatArchiveSize(chunk.zipBytes)}</p><p className="mt-4 text-xs font-black">この写真パックをダウンロード</p></div>
                </a>
              ))}
            </div>
            <p className="mt-7 max-w-4xl text-xs leading-6 text-black/48">人物が写っている写真を公開・再掲載する場合は、プライバシーと肖像への配慮をお願いします。写真の販売、誹謗中傷、事実と異なる内容での利用はご遠慮ください。</p>
          </div>
        </section>

        <section className="bg-[#111] px-5 py-24 text-white md:px-10 md:py-32">
          <div className="mx-auto max-w-[1500px]">
            <p className="text-xs font-black tracking-[0.22em] text-[#f2cb3c]">MEDIA COVERAGE</p>
            <h2 className="mt-5 max-w-5xl text-5xl font-black tracking-[-0.06em] md:text-7xl">メディアが捉えた、<br />第1回LCF。</h2>
            <div className="mt-8 grid gap-8 border-t border-white/20 pt-7 lg:grid-cols-[0.8fr_1.2fr]">
              <p className="text-xs font-black tracking-[0.18em] text-white/40">18媒体・掲載ページを確認</p>
              <p className="max-w-4xl text-base leading-8 text-white/62">会場の熱気は、イベントの中だけに留まりませんでした。豪華出演者との特別番組、15分間で193箱を届けたライブ販売、企業とライバーが直接出会う新しい市場。その異なる側面を、各メディアがそれぞれの視点で伝えています。</p>
            </div>
            <div className="mt-14 grid border-t border-white/20 lg:grid-cols-2">
              {lcf2026Coverage.map((item) => (
                <a key={`${item.outlet}-${item.href}`} href={item.href} target="_blank" rel="noreferrer" className="group flex min-h-72 flex-col border-b border-white/20 p-6 transition-colors hover:bg-white/[0.035] lg:border-r lg:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-black tracking-[0.14em]"><span className="text-[#f2cb3c]">{item.outlet}</span><span className="text-white/35">{item.category} / {item.date}</span></div>
                  <h3 className="mt-9 max-w-xl text-xl font-black leading-8 text-white/88 transition-colors group-hover:text-white md:text-2xl">{item.title}</h3>
                  <p className="mt-5 max-w-xl text-sm leading-7 text-white/48">{item.summary}</p>
                  <span className="mt-auto flex items-center justify-between gap-5 border-t border-white/10 pt-6 text-xs font-black text-white/60 transition-colors group-hover:text-white">記事を読む<ArrowUpRight className="shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" size={18} /></span>
                </a>
              ))}
            </div>
            <div className="mt-10 border border-white/15 p-6 md:p-8">
              <p className="text-xs font-black tracking-[0.18em] text-[#f2cb3c]">このほかの掲載・配信媒体</p>
              <p className="mt-5 text-sm leading-8 text-white/55">{lcf2026SyndicatedOutlets.join("　／　")}</p>
              <p className="mt-4 max-w-4xl text-xs leading-6 text-white/35">同一配信元の記事を転載した媒体を含みます。内容の重複を避けるため、上の一覧では独自取材または代表となる記事を中心に紹介しています。</p>
            </div>
          </div>
        </section>

        <section className="bg-[#f2cb3c] px-5 py-24 md:px-10 md:py-28">
          <div className="mx-auto grid max-w-[1500px] gap-10 md:grid-cols-[1.3fr_0.7fr] md:items-end">
            <div><p className="text-xs font-black tracking-[0.22em]">THE STORY CONTINUES</p><h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.065em] md:text-8xl">第2回へ。<br />そして、その先へ。</h2></div>
            <div><p className="text-sm font-medium leading-7 text-black/65">次回の開催情報は決定次第、公式サイトで発表します。出展、出演、取材、協業のご相談を受け付けています。</p><a href={`mailto:${lcfContactEmail}?subject=LCF%E6%AC%A1%E5%9B%9E%E9%96%8B%E5%82%AC%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87`} className="mt-7 flex items-center justify-between border-b-2 border-black pb-3 text-sm font-black">お問い合わせ <ChevronRight size={18} /></a></div>
          </div>
        </section>
      </main>

      {activePhoto && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/95 p-3 md:p-8" role="dialog" aria-modal="true" aria-label="写真拡大表示" onClick={() => setActivePhoto(null)}>
          <button type="button" onClick={() => setActivePhoto(null)} className="absolute right-4 top-4 grid h-12 w-12 place-items-center border border-white/30 bg-black/50 text-white" aria-label="閉じる"><X size={22} /></button>
          <div className="max-h-[92vh] max-w-[94vw]" onClick={(event) => event.stopPropagation()}>
            <img src={activePhoto.src} alt={activePhoto.alt} width={activePhoto.width} height={activePhoto.height} className="max-h-[82vh] max-w-full object-contain" />
            <div className="mt-3 flex items-center justify-between text-xs text-white/60"><span>{activePhoto.alt}</span><a href={activePhoto.originalSrc} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#f2cb3c]">高解像度で開く <Download size={14} /></a></div>
          </div>
        </div>
      )}
    </div>
  );
}
