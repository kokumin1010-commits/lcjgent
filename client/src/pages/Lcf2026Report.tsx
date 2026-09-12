/**
 * LCF 2026 permanent report archive.
 * Design: documentary editorial layout with original event photography and verifiable public outcomes.
 * No operational /lcf route or historical event data is mutated by this page.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Camera, ChevronRight, Download, X } from "lucide-react";
import { lcf2026Coverage, lcf2026PhotoById, lcf2026Photos, lcf2026Stats, lcfContactEmail, type LcfPhoto } from "@/data/lcfEditions";
import { formatArchiveSize, lcf2026PhotoArchive, lcf2026PhotoDownloadChunks } from "@/data/lcf2026PhotoDownloads";

const hero = lcf2026PhotoById["D2-035"];
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
        <a href="/" className="flex items-center gap-3 text-xs font-black tracking-[0.16em]"><ArrowLeft size={18} /> LCF HOME</a>
        <p className="text-[10px] font-bold tracking-[0.22em] text-white/50 md:text-xs">EDITION 01 / OFFICIAL REPORT</p>
        <a href="/livecommercefestival/2026" className="hidden text-xs font-bold text-[#f2cb3c] sm:flex sm:items-center sm:gap-2">2026 EVENT <ArrowUpRight size={15} /></a>
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
  const gallery = useMemo(() => lcf2026Photos, []);

  useEffect(() => {
    document.title = "第1回開催レポート｜LIVE COMMERCE FESTIVAL 2026";
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

        <section className="bg-white px-5 py-24 md:px-10 md:py-32">
          <div className="mx-auto max-w-[1500px]">
            <div className="flex flex-col gap-6 border-t border-black/25 pt-6 md:flex-row md:items-end md:justify-between">
              <div><p className="text-xs font-black tracking-[0.22em] text-black/40">PHOTO ARCHIVE / 48 SELECTED</p><h2 className="mt-4 text-5xl font-black tracking-[-0.06em] md:text-7xl">会場をつくった、<br />48の瞬間。</h2></div>
              <a href="https://alltuu.cc/album/e977fc4e6ef93a44477c4294546fadb8/?from=qrCode&menu=live" target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 border-b-2 border-black pb-2 text-sm font-black">公式フォトアルバムを見る <ArrowUpRight size={18} /></a>
            </div>
            <div className="mt-14 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {gallery.map((photo, index) => (
                <button key={photo.id} type="button" onClick={() => setActivePhoto(photo)} className={`group relative overflow-hidden bg-black/5 ${index % 9 === 0 ? "col-span-2 row-span-2" : ""}`} aria-label={`${photo.alt}を拡大表示`}>
                  <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" className="aspect-[3/2] h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10 text-left text-[10px] font-bold tracking-[0.12em] text-white opacity-0 transition-opacity group-hover:opacity-100">{photo.group.toUpperCase()} / {photo.id}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="official-downloads" className="border-t border-black/15 bg-[#e5dfd3] px-5 py-24 md:px-10 md:py-32">
          <div className="mx-auto max-w-[1500px]">
            <div className="grid gap-8 border-t border-black/30 pt-6 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="text-xs font-black tracking-[0.22em] text-black/45">OFFICIAL PHOTO DOWNLOAD / 798 ORIGINALS</p>
                <h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-7xl">第1回の記録を、<br />自分たちの手元へ。</h2>
              </div>
              <div className="lg:pt-2">
                <p className="max-w-3xl text-base leading-8 text-black/62">公開公式アルバムの高解像度写真798枚を、DAY1、表彰式・アフターパーティー、DAY2の9分割で保存しました。第三者サービスの公開状態に依存せず、必要な分だけダウンロードできます。</p>
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-black/55"><span>全798枚</span><span>9分割</span><span>合計4.19 GB</span><span>SHA-256検証済み</span></div>
              </div>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {lcf2026PhotoDownloadChunks.map((chunk) => (
                <a key={chunk.chunk} href={chunk.downloadUrl} download className="group flex min-h-40 flex-col justify-between border border-black/20 bg-[#f5f1e9] p-6 transition-colors hover:border-black hover:bg-white">
                  <div className="flex items-start justify-between gap-5"><span className="text-[10px] font-black tracking-[0.18em] text-black/40">ORIGINAL ZIP / {chunk.chunk.toUpperCase()}</span><Download size={19} className="shrink-0 transition-transform group-hover:translate-y-1" /></div>
                  <div className="mt-8"><h3 className="text-lg font-black leading-6">{chunk.label}</h3><p className="mt-2 text-xs font-bold text-black/45">{chunk.photoCount}枚 · {formatArchiveSize(chunk.zipBytes)}</p></div>
                </a>
              ))}
            </div>

            <div className="mt-8 grid gap-5 border border-black/20 bg-[#f5f1e9] p-6 md:grid-cols-[1.15fr_0.85fr] md:p-8">
              <div><h3 className="text-lg font-black">ダウンロード前にご確認ください</h3><p className="mt-3 text-sm leading-7 text-black/58">イベントの振り返り、関係者共有、LCFの紹介にご利用いただけます。人物写真を再掲載する際は肖像権・プライバシーに配慮し、誹謗中傷、虚偽表示、第三者への素材販売には使用しないでください。</p></div>
              <div className="flex flex-col gap-3 md:items-end md:justify-center">
                <a href={lcf2026PhotoArchive.checksumUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-black">SHA256SUMS <ArrowUpRight size={15} /></a>
                <a href={lcf2026PhotoArchive.manifestUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-black">全分卷リスト <ArrowUpRight size={15} /></a>
                <a href={lcf2026PhotoArchive.readmeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-black">利用案内 <ArrowUpRight size={15} /></a>
                <a href={lcf2026PhotoArchive.sourceAlbumUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-black/45">公式アルバムで閲覧 <ArrowUpRight size={14} /></a>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#111] px-5 py-24 text-white md:px-10 md:py-32">
          <div className="mx-auto max-w-[1500px]">
            <p className="text-xs font-black tracking-[0.22em] text-[#f2cb3c]">MEDIA COVERAGE</p>
            <h2 className="mt-5 text-5xl font-black tracking-[-0.06em] md:text-7xl">メディアが捉えたLCF。</h2>
            <div className="mt-14 grid border-t border-white/20 md:grid-cols-2">
              {lcf2026Coverage.map((item) => (
                <a key={`${item.outlet}-${item.href}`} href={item.href} target="_blank" rel="noreferrer" className="group flex min-h-40 flex-col justify-between border-b border-white/20 p-6 md:border-r md:p-8">
                  <span className="text-xs font-black tracking-[0.16em] text-[#f2cb3c]">{item.outlet}</span>
                  <span className="mt-7 flex items-end justify-between gap-5 text-lg font-bold leading-7 text-white/75 transition-colors group-hover:text-white">{item.title}<ArrowUpRight className="shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" size={19} /></span>
                </a>
              ))}
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
