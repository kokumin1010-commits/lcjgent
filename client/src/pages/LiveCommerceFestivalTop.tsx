/**
 * LCF multi-edition brand home.
 * Design: Japanese editorial event archive — matte black, warm ivory, signal gold, real documentary photography.
 * Purpose: lead with proven impact, preserve every edition, and create a stable doorway for future LCF events.
 */
import { useEffect } from "react";
import { ArrowDownRight, ArrowUpRight, Building2, Radio, UserRound, Users } from "lucide-react";
import {
  lcf2026Coverage,
  lcf2026HomepagePhotoIds,
  lcf2026PhotoById,
  lcf2026Stats,
  lcfContactEmail,
  lcfEditions,
} from "@/data/lcfEditions";
import { applyPageSeo } from "@/lib/pageSeo";

const hero = lcf2026PhotoById["D1-104"];
const mosaicPhotos = lcf2026HomepagePhotoIds.slice(1, 7).map((id) => lcf2026PhotoById[id]);

function BrandHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 md:h-20 md:px-10">
        <a href="/" className="group flex items-center gap-3" aria-label="LIVE COMMERCE FESTIVAL ホーム">
          <span className="grid h-10 w-10 place-items-center bg-[#f2cb3c] text-sm font-black tracking-[-0.08em] text-black transition-transform duration-200 group-hover:-rotate-3">LCF</span>
          <span className="hidden text-[11px] font-semibold leading-tight tracking-[0.24em] text-white/90 sm:block">
            LIVE COMMERCE<br />FESTIVAL
          </span>
        </a>
        <nav className="flex items-center gap-2 text-xs font-bold tracking-[0.04em] md:gap-4" aria-label="メインナビゲーション">
          <a href="#about" className="hidden text-white/65 transition-colors hover:text-white md:block">ABOUT</a>
          <a href="#archive" className="hidden text-white/65 transition-colors hover:text-white md:block">ARCHIVE</a>
          <a href="#media" className="hidden text-white/65 transition-colors hover:text-white md:block">MEDIA</a>
          <a href="/2026" className="inline-flex items-center gap-1.5 border border-[#f2cb3c] px-3 py-2.5 text-[10px] text-[#f2cb3c] transition-colors hover:bg-[#f2cb3c] hover:text-black sm:text-xs md:px-5">
            第1回イベントページを見る <ArrowUpRight size={14} />
          </a>
          <a href="/lcf/mypage" className="inline-flex items-center gap-1.5 bg-[#7c3aed] px-3 py-2.5 text-[10px] text-white transition-colors hover:bg-[#8b5cf6] sm:text-xs md:px-5">
            <UserRound size={14} /> マイページ
          </a>
        </nav>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate min-h-[760px] overflow-hidden bg-black text-white md:min-h-[850px]">
      <img
        src={hero.src}
        alt={hero.alt}
        width={hero.width}
        height={hero.height}
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.94)_0%,rgba(0,0,0,.72)_43%,rgba(0,0,0,.18)_78%,rgba(0,0,0,.55)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black to-transparent" />

      <div className="relative mx-auto grid min-h-[760px] max-w-[1500px] content-end gap-12 px-5 pb-16 pt-28 md:min-h-[850px] md:grid-cols-[1fr_280px] md:px-10 md:pb-24">
        <div className="max-w-5xl">
          <p className="mb-7 flex items-center gap-3 text-xs font-bold tracking-[0.3em] text-[#f2cb3c] md:text-sm">
            <span className="h-px w-12 bg-[#f2cb3c]" />
            JAPAN / LIVE COMMERCE / COMMUNITY
          </p>
          <h1 className="max-w-5xl text-[clamp(3.4rem,9vw,9.6rem)] font-black uppercase leading-[0.79] tracking-[-0.07em]">
            Commerce<br />Moves<br /><span className="text-[#f2cb3c]">People.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-base font-medium leading-8 text-white/78 md:text-xl md:leading-9">
            企業とライバーが出会い、商品が語られ、熱量が売上へ変わる。<br className="hidden md:block" />
            LIVE COMMERCE FESTIVALは、ライブコマースの未来を現場からつくる祭典です。
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="/2026" className="inline-flex items-center justify-center gap-3 bg-[#f2cb3c] px-7 py-4 text-sm font-black tracking-[0.04em] text-black transition-transform duration-150 active:scale-[0.97]">
              第1回イベントページを見る <ArrowUpRight size={18} />
            </a>
            <a href="/livecommercefestival/2026/report" className="inline-flex items-center justify-center gap-3 border border-white/45 bg-black/35 px-7 py-4 text-sm font-bold tracking-[0.04em] text-white backdrop-blur transition-colors hover:border-white">
              第1回開催レポート <ArrowUpRight size={18} />
            </a>
          </div>
          <a href="#next" className="mt-5 inline-flex items-center gap-2 text-xs font-bold tracking-[0.08em] text-white/65 transition-colors hover:text-white">
            次回開催について <ArrowDownRight size={16} />
          </a>
        </div>

        <aside className="border-l border-white/30 pl-6 md:self-end">
          <p className="text-xs font-bold tracking-[0.28em] text-white/55">LATEST EDITION</p>
          <p className="mt-4 text-6xl font-black tracking-[-0.08em]">01</p>
          <p className="mt-2 text-xl font-bold">LCF 2026</p>
          <p className="mt-2 text-sm leading-6 text-white/65">2026.09.08 — 09.09<br />八芳園｜東京・白金台</p>
          <span className="mt-5 inline-flex border border-[#f2cb3c]/70 px-3 py-1.5 text-[11px] font-bold tracking-[0.16em] text-[#f2cb3c]">大盛況のうちに閉幕</span>
        </aside>
      </div>
    </section>
  );
}

function ImpactSection() {
  return (
    <section id="about" className="bg-[#f1eee7] px-5 py-24 text-[#101010] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-10 border-t border-black/25 pt-6 md:grid-cols-[0.8fr_1.7fr] md:gap-20">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-black/45">01 / PROVEN IMPACT</p>
            <p className="mt-4 text-sm leading-7 text-black/60">約束ではなく、現場で生まれた事実を次の開催へ。</p>
          </div>
          <h2 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.055em] md:text-7xl">
            第1回から、<br />ライブコマースの<br /><span className="text-[#c99d11]">新しい基準</span>が生まれた。
          </h2>
        </div>

        <div className="mt-20 grid grid-cols-2 border-l border-t border-black/20 lg:grid-cols-4">
          {lcf2026Stats.map((stat) => (
            <div key={stat.label} className="border-b border-r border-black/20 p-5 md:p-8">
              <p className="text-[clamp(2.8rem,6vw,5.5rem)] font-black leading-none tracking-[-0.07em]">{stat.value}</p>
              <p className="mt-5 text-sm font-black tracking-[0.08em]">{stat.label}</p>
              <p className="mt-1 text-xs text-black/45">{stat.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-right text-[11px] leading-5 text-black/45">公式開催速報・PR TIMES掲載値に基づく</p>
      </div>
    </section>
  );
}

function PhotoMosaic() {
  return (
    <section className="bg-[#090909] px-3 py-3 md:px-5 md:py-5" aria-label="LCF 2026 ハイライト">
      <div className="mx-auto grid max-w-[1700px] grid-cols-2 gap-3 md:grid-cols-12 md:grid-rows-[340px_280px] md:gap-5">
        {mosaicPhotos.map((item, index) => {
          const positions = [
            "col-span-2 md:col-span-7 md:row-span-1",
            "col-span-1 md:col-span-5",
            "col-span-1 md:col-span-4",
            "col-span-1 md:col-span-4",
            "col-span-1 md:col-span-4",
            "col-span-2 md:hidden",
          ];
          return (
            <figure key={item.id} className={`group relative min-h-52 overflow-hidden bg-white/5 ${positions[index]}`}>
              <img src={item.src} alt={item.alt} width={item.width} height={item.height} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/20 to-transparent px-4 pb-4 pt-16 text-white">
                <span className="text-[10px] font-bold tracking-[0.2em]">LCF 2026 / {item.group.toUpperCase()}</span>
                <span className="text-[10px] text-white/60">{String(index + 1).padStart(2, "0")}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

function PlatformSection() {
  const pillars = [
    { icon: Building2, index: "A", title: "BRAND", copy: "商品を、売り場ではなく“物語”として届ける。企業と発信者がその場で出会い、次の販売機会へつながります。" },
    { icon: Radio, index: "B", title: "COMMERCE LIVE", copy: "実際の商品を手に取り、会場から配信する。反応と販売結果が同時に生まれる、実践型ライブコマースです。" },
    { icon: Users, index: "C", title: "COMMUNITY", copy: "学び、相談し、称え合う。セミナーからアワードまで、業界を前へ進める関係性をつくります。" },
  ];
  return (
    <section className="bg-[#f1eee7] px-5 py-24 text-[#101010] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-10 md:grid-cols-[1fr_1.35fr] md:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-black/45">02 / WHAT LCF CREATES</p>
            <h2 className="mt-5 text-4xl font-black leading-none tracking-[-0.05em] md:text-6xl">出会う。<br />試す。<br />売れる。</h2>
          </div>
          <p className="max-w-2xl text-lg leading-9 text-black/62 md:justify-self-end md:text-xl">
            展示会でも、セミナーでも、配信イベントだけでもない。LCFは、ブランド・ライバー・プラットフォームが一つの現場で動く、ライブコマースの実践拠点です。
          </p>
        </div>
        <div className="mt-20 grid border-t border-black/25 md:grid-cols-3">
          {pillars.map(({ icon: Icon, index, title, copy }) => (
            <article key={title} className="border-b border-black/25 py-9 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
              <div className="flex items-center justify-between">
                <Icon size={26} strokeWidth={1.5} />
                <span className="text-xs font-bold tracking-[0.2em] text-black/35">{index}</span>
              </div>
              <h3 className="mt-10 text-2xl font-black tracking-[-0.03em]">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-black/58">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchiveSection() {
  const edition = lcfEditions[0];
  const archivePhoto = lcf2026PhotoById[edition.heroPhotoId];
  return (
    <section id="archive" className="bg-[#101010] px-5 py-24 text-white md:px-10 md:py-32">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex items-end justify-between border-b border-white/20 pb-6">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-[#f2cb3c]">03 / EDITIONS ARCHIVE</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] md:text-7xl">積み重なる、LCF。</h2>
          </div>
          <p className="hidden text-right text-xs leading-6 text-white/45 md:block">一回ごとの熱狂を、<br />次の産業資産へ。</p>
        </div>

        <article className="group mt-10 grid overflow-hidden border border-white/20 md:grid-cols-[1.35fr_0.65fr]">
          <div className="relative min-h-[360px] overflow-hidden md:min-h-[620px]">
            <img src={archivePhoto.src} alt={archivePhoto.alt} width={archivePhoto.width} height={archivePhoto.height} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <p className="absolute bottom-5 left-5 text-[10px] font-bold tracking-[0.2em] text-white/75">TOKYO / HAPPO-EN / 2026</p>
          </div>
          <div className="flex flex-col justify-between bg-[#191919] p-7 md:p-10">
            <div>
              <div className="flex items-center justify-between">
                <span className="border border-[#f2cb3c] px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-[#f2cb3c]">{edition.status}</span>
                <span className="text-7xl font-black tracking-[-0.08em] text-white/10">01</span>
              </div>
              <p className="mt-10 text-xs font-bold tracking-[0.2em] text-white/45">{edition.label}</p>
              <h3 className="mt-3 text-4xl font-black tracking-[-0.05em] md:text-5xl">LIVE COMMERCE<br />FESTIVAL 2026</h3>
              <p className="mt-7 text-sm leading-7 text-white/58">{edition.dates}<br />{edition.venue}</p>
            </div>
            <div className="mt-12 space-y-3">
              <a href={edition.reportPath} className="flex items-center justify-between bg-[#f2cb3c] px-5 py-4 text-sm font-black text-black transition-transform active:scale-[0.98]">
                開催レポートを見る <ArrowUpRight size={18} />
              </a>
              <a href={edition.eventPath} className="flex items-center justify-between border border-white/25 px-5 py-4 text-sm font-bold text-white transition-colors hover:border-white">
                第1回イベントページを見る <ArrowUpRight size={18} />
              </a>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function MediaSection() {
  return (
    <section id="media" className="bg-white px-5 py-24 text-[#101010] md:px-10 md:py-32">
      <div className="mx-auto grid max-w-[1500px] gap-14 md:grid-cols-[0.7fr_1.3fr]">
        <div className="md:sticky md:top-28 md:self-start">
          <p className="text-xs font-bold tracking-[0.25em] text-black/40">04 / MEDIA COVERAGE</p>
          <h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-7xl">伝えられた、<br />現場の熱。</h2>
          <p className="mt-7 max-w-sm text-sm leading-7 text-black/55">公式開催レポートと各メディア掲載を一か所に。記事は各媒体のサイトでご覧いただけます。</p>
        </div>
        <div className="border-t border-black/25">
          {lcf2026Coverage.map((item, index) => (
            <a key={`${item.outlet}-${item.href}`} href={item.href} target="_blank" rel="noreferrer" className="group grid gap-3 border-b border-black/20 py-6 md:grid-cols-[48px_150px_1fr_28px] md:items-center">
              <span className="text-xs tabular-nums text-black/35">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-xs font-black tracking-[0.06em]">{item.outlet}</span>
              <span className="text-sm font-medium leading-6 text-black/65 transition-colors group-hover:text-black">{item.title}</span>
              <ArrowUpRight size={18} className="hidden transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 md:block" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function NextChapterSection() {
  return (
    <section id="next" className="relative overflow-hidden bg-[#d5aa19] px-5 py-24 text-black md:px-10 md:py-32">
      <div className="absolute -right-20 -top-24 select-none text-[18rem] font-black leading-none tracking-[-0.1em] text-black/[0.06] md:text-[28rem]">02</div>
      <div className="relative mx-auto max-w-[1500px]">
        <p className="text-xs font-black tracking-[0.25em]">05 / NEXT CHAPTER</p>
        <div className="mt-8 grid gap-12 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <p className="text-lg font-bold">次回開催に向けて準備中</p>
            <h2 className="mt-4 text-5xl font-black leading-[0.9] tracking-[-0.065em] md:text-8xl">次は、もっと<br />大きな熱狂へ。</h2>
          </div>
          <div className="max-w-xl md:justify-self-end">
            <p className="text-base font-medium leading-8 text-black/68">開催日・会場・募集開始日は、決定次第この公式サイトで発表します。出展、出演、取材、協業については、目的を添えてお問い合わせください。</p>
            <a href={`mailto:${lcfContactEmail}?subject=LCF%E6%AC%A1%E5%9B%9E%E9%96%8B%E5%82%AC%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87`} className="mt-8 inline-flex items-center gap-4 border-b-2 border-black pb-2 text-base font-black">
              NEXT LCFについて問い合わせる <ArrowUpRight size={20} />
            </a>
            <p className="mt-4 text-xs text-black/55">{lcfContactEmail}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LiveCommerceFestivalTop() {
  useEffect(() => {
    applyPageSeo({
      title: "LIVE COMMERCE FESTIVAL｜ライブコマースの祭典・公式サイト",
      description: "企業、ライバー、クリエイターが出会うLIVE COMMERCE FESTIVAL公式サイト。第1回LCF 2026の開催レポート、48枚の写真ギャラリー、メディア掲載、公式写真798枚を公開しています。",
      canonicalPath: "/",
      image: hero.src,
      jsonLd: [
        { "@context": "https://schema.org", "@type": "WebSite", name: "LIVE COMMERCE FESTIVAL", alternateName: "LCF", url: `${window.location.origin}/`, inLanguage: "ja" },
        { "@context": "https://schema.org", "@type": "Organization", name: "LIVE COMMERCE FESTIVAL", alternateName: "LCF", url: `${window.location.origin}/`, email: lcfContactEmail },
      ],
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#090909] font-sans antialiased">
      <BrandHeader />
      <main>
        <HeroSection />
        <ImpactSection />
        <PhotoMosaic />
        <PlatformSection />
        <ArchiveSection />
        <MediaSection />
        <NextChapterSection />
      </main>
      <footer className="bg-[#090909] px-5 py-10 text-white md:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 border-t border-white/15 pt-8 text-xs text-white/45 md:flex-row md:items-end md:justify-between">
          <div><p className="font-black tracking-[0.18em] text-white">LIVE COMMERCE FESTIVAL</p><p className="mt-2">Commerce moves people.</p></div>
          <div className="flex flex-wrap gap-5"><a href="/2026" className="hover:text-white">第1回イベントページ</a><a href="/livecommercefestival/2026/report" className="hover:text-white">開催レポート</a><a href="/lcf/mypage" className="hover:text-white">マイページ</a><a href={`mailto:${lcfContactEmail}`} className="hover:text-white">CONTACT</a></div>
          <p>© 2026 LCF実行委員会</p>
        </div>
      </footer>
    </div>
  );
}
