/**
 * 第2回LCF公式特別ページ。
 * Design: Japanese industrial editorial × signal-yellow venue fascia.
 * Principles: confirmed venue facts, generated imagery labelled as concept, no fixed booth count, direct application paths.
 */
import { useEffect } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Camera,
  Handshake,
  MapPin,
  Mic2,
  Radio,
  Ruler,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { LcfFascia } from "@/components/lcf/LcfFascia";
import { lcf2026Stats } from "@/data/lcfEditions";
import { applyPageSeo } from "@/lib/pageSeo";
import { LCF_EVENT_DEFINITIONS } from "@shared/lcfEventDefinitions";

const event = LCF_EVENT_DEFINITIONS[2];
const HERO_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ObKwxbjDEhLNvGry.jpg";
const LIVE_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/nKtCVJQpUiElkcWi.jpg";
const MATCHING_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ffORXTavLEVGMmDT.jpg";
const YEARLESS_LOGO_SVG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/eOoAsIvNqBsDDHvx.svg";
const YEARLESS_FASCIA_SVG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/cuWeHdktzAPFuNCV.svg";

const experiences = [
  { icon: Handshake, index: "01", title: "直接マッチング", copy: "企業・ブランドとコマースライバーが、商品を前に条件や企画を直接話せる出会いの場をつくります。" },
  { icon: ShoppingBag, index: "02", title: "商品体験", copy: "触れる、試す、背景を聞く。配信前の商品理解を深め、伝える言葉をその場で見つけます。" },
  { icon: Mic2, index: "03", title: "実践セミナー", copy: "現場で再現できる販売設計、表現、運用の知見を学び、次の配信へ持ち帰ります。" },
  { icon: Radio, index: "04", title: "会場からライブ販売", copy: "会場で出会った商品を、その場から視聴者へ届ける。展示で終わらない実践につなげます。" },
  { icon: Users, index: "05", title: "LCMで継続商談", copy: "イベント後もLCMで商品発見と商談を継続し、次の販売と次回LCFへ循環させます。" },
] as const;

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1540px] items-center justify-between px-4 md:h-20 md:px-10">
        <a href="/" aria-label="LIVE COMMERCE FESTIVAL TOP"><LcfFascia compact className="w-[150px] border-2" /></a>
        <nav className="flex items-center gap-2 text-[10px] font-black tracking-[0.04em] sm:text-xs md:gap-4" aria-label="第2回ページナビゲーション">
          <a href="#experience" className="hidden text-white/60 transition-colors hover:text-white md:block">EXPERIENCE</a>
          <a href="#venue" className="hidden text-white/60 transition-colors hover:text-white md:block">VENUE</a>
          <a href="/2026" className="hidden border border-white/25 px-4 py-2.5 text-white transition-colors hover:border-white lg:inline-flex">第1回実績</a>
          <a href="/lcf/mypage" className="inline-flex bg-white px-3 py-2.5 text-black transition-colors hover:bg-[#f5cf31] md:px-5">マイページ</a>
        </nav>
      </div>
    </header>
  );
}

function ApplicationButtons({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a href={event.applicationCompanyPath} className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#f5cf31] px-6 py-4 text-sm font-black text-black transition-transform duration-150 active:scale-[0.97]">
        <Building2 size={19} />企業・ブランドとして申し込む<ArrowUpRight size={17} />
      </a>
      <a href={event.applicationLiverPath} className={`inline-flex min-h-14 items-center justify-center gap-3 border px-6 py-4 text-sm font-black transition-colors ${dark ? "border-white/45 bg-black/30 text-white hover:border-white" : "border-black/35 text-black hover:bg-black hover:text-white"}`}>
        <Camera size={19} />ライブコマーサーとして申し込む<ArrowUpRight size={17} />
      </a>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate min-h-[720px] overflow-hidden bg-black text-white md:min-h-[760px]">
      <img src={HERO_IMAGE} alt="浜松町館2階展示室の特徴をもとに描いた第2回LCF会場完成予想イメージ" className="absolute inset-0 h-full w-full object-cover object-[center_68%] md:object-[center_72%]" fetchPriority="high" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.94)_0%,rgba(0,0,0,.76)_42%,rgba(0,0,0,.16)_78%,rgba(0,0,0,.38)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black to-transparent" />
      <div className="relative mx-auto grid min-h-[720px] max-w-[1540px] content-end gap-10 px-5 pb-12 pt-20 md:min-h-[760px] md:grid-cols-[1fr_360px] md:px-10 md:pb-14">
        <div className="max-w-5xl">
          <p className="mb-6 flex items-center gap-3 text-xs font-black tracking-[0.26em] text-[#f5cf31] md:text-sm"><span className="h-px w-12 bg-[#f5cf31]" />2ND EDITION / TOKYO</p>
          <h1 className="text-[clamp(3.1rem,8.4vw,8.7rem)] font-black leading-[0.84] tracking-[-0.07em]">見る展示会から、<br /><span className="text-[#f5cf31]">売る展示会へ。</span></h1>
          <p className="mt-7 max-w-3xl text-base font-medium leading-8 text-white/80 md:text-xl md:leading-9">商品と出会い、試し、学び、会場から届ける。第2回LCFは、企業とコマースライバーの商談を実際の販売へ動かす2日間です。</p>
          <div className="mt-8"><ApplicationButtons dark /></div>
          <a href="#concept" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-white/65 hover:text-white">第2回の体験を見る<ArrowDownRight size={16} /></a>
        </div>
        <aside className="border-l border-white/30 pl-6 md:self-end">
          <p className="text-xs font-black tracking-[0.26em] text-white/55">EVENT INFORMATION</p>
          <p className="mt-4 text-6xl font-black tracking-[-0.08em] text-[#f5cf31]">02</p>
          <div className="mt-5 space-y-5 border-t border-white/25 pt-5">
            <div className="flex gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#f5cf31]" /><p className="text-sm font-bold leading-6">2026年12月8日（火）<br />12月9日（水）</p></div>
            <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#f5cf31]" /><p className="text-sm font-bold leading-6">東京都立産業貿易センター<br />浜松町館 2階展示室</p></div>
          </div>
          <span className="mt-6 inline-flex border border-[#f5cf31]/70 px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-[#f5cf31]">申込受付中</span>
        </aside>
      </div>
      <p className="absolute bottom-3 right-4 bg-black/75 px-3 py-2 text-[10px] font-bold text-white/80">会場完成予想イメージ（実際の施工・出展内容とは異なる場合があります）</p>
    </section>
  );
}

function Concept() {
  return (
    <section id="concept" className="bg-[#f2efe6] px-5 py-24 text-[#111] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-10 border-t border-black/25 pt-6 lg:grid-cols-[0.68fr_1.32fr] lg:gap-20">
          <div><p className="text-xs font-black tracking-[0.24em] text-black/45">01 / THE NEXT LCF</p><p className="mt-5 max-w-sm text-sm leading-7 text-black/58">第1回の成果を、偶然の成功で終わらせない。出会いから販売までの動線を、さらに実践的に組み直します。</p></div>
          <div>
            <p className="text-sm font-black tracking-[0.08em] text-[#b78100]">日本初※</p>
            <h2 className="mt-3 max-w-5xl text-4xl font-black leading-[1.04] tracking-[-0.055em] md:text-7xl">コマースライバーと企業を直接つなぐ、<span className="text-[#b78100]">マッチング×セミナー型</span>ライブコマースイベント。</h2>
            <p className="mt-7 max-w-3xl text-[11px] leading-6 text-black/45">※2026年8月の第1回開催発表時点における自社調べ。コマースライバーと企業の直接マッチング、実践セミナー、商品体験および会場からのライブ販売を一体で提供するイベントとして。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Experience() {
  return (
    <section id="experience" className="bg-[#0b0b0b] px-5 py-24 text-white md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-10 border-t border-white/20 pt-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div><p className="text-xs font-black tracking-[0.24em] text-[#f5cf31]">02 / SELLING EXPERIENCE</p><h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-8xl">出会いを、<br />売上へ動かす。</h2></div>
          <p className="max-w-2xl text-base leading-8 text-white/62 lg:justify-self-end md:text-lg">展示、学び、配信、商談を別々にしない。一つの会場で連続して体験できるから、商品理解と販売のスピードが変わります。</p>
        </div>
        <div className="mt-16 grid border-l border-t border-white/15 sm:grid-cols-2 lg:grid-cols-5">
          {experiences.map(({ icon: Icon, index, title, copy }) => (
            <article key={title} className="border-b border-r border-white/15 p-6 md:p-7"><div className="flex items-center justify-between"><Icon size={25} className="text-[#f5cf31]" /><span className="text-xs font-black text-white/25">{index}</span></div><h3 className="mt-10 text-xl font-black">{title}</h3><p className="mt-4 text-sm leading-7 text-white/55">{copy}</p></article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Venue() {
  const facts = [
    { icon: Ruler, value: "約1,530㎡", label: "2階展示室・全室" },
    { icon: Sparkles, value: "5m", label: "天井高" },
    { icon: Radio, value: "無柱空間", label: "配信と商談を見通せる会場" },
    { icon: ShoppingBag, value: "フローリング", label: "商品展示に馴染む床仕上げ" },
  ] as const;
  return (
    <section id="venue" className="bg-[#f2efe6] px-5 py-24 text-[#111] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div><p className="text-xs font-black tracking-[0.24em] text-black/45">03 / HAMAMATSUCHO</p><h2 className="mt-5 text-5xl font-black leading-[0.94] tracking-[-0.06em] md:text-7xl">東京の中心で、<br />配信と商談が動く。</h2></div>
          <div className="max-w-2xl lg:justify-self-end"><p className="text-lg font-black">東京都立産業貿易センター浜松町館 2階展示室</p><p className="mt-4 text-base leading-8 text-black/58">高い天井と柱のない大空間、木質フローリングを活かし、ライブ販売、商品体験、セミナー、商談が互いに見える会場を目指します。</p><a href="https://www.sanbo.metro.tokyo.lg.jp/hamamatsucho/facilities/floor/02-05/" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-black">会場公式情報を見る<ArrowUpRight size={16} /></a></div>
        </div>
        <div className="mt-16 grid border-l border-t border-black/20 sm:grid-cols-2 lg:grid-cols-4">{facts.map(({ icon: Icon, value, label }) => <div key={label} className="border-b border-r border-black/20 p-6 md:p-8"><Icon size={24} strokeWidth={1.5} /><p className="mt-10 text-3xl font-black tracking-[-0.05em] md:text-4xl">{value}</p><p className="mt-3 text-sm text-black/50">{label}</p></div>)}</div>
        <p className="mt-5 text-xs leading-6 text-black/45">最終の出展区画数・配置・設備は、申込状況、会場、施工、消防、避難・搬入条件の調整後に決定します。固定のブース数を前提とした確定図ではありません。</p>
      </div>
    </section>
  );
}

function VisualStories() {
  return (
    <section className="bg-[#0b0b0b] px-5 py-24 text-white md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-5 lg:grid-cols-2">
          <figure className="group overflow-hidden border border-white/15"><img src={LIVE_IMAGE} alt="第2回LCFで商品を紹介し会場からライブ販売する完成予想イメージ" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" /><figcaption className="border-t border-white/15 p-5"><p className="text-[10px] font-black tracking-[0.2em] text-[#f5cf31]">LIVE SELLING / CONCEPT IMAGE</p><p className="mt-2 text-sm leading-6 text-white/60">商品を理解し、会場から届ける。会場完成予想イメージであり、実際の施工・出展内容とは異なる場合があります。</p></figcaption></figure>
          <figure className="group overflow-hidden border border-white/15 lg:translate-y-12"><img src={MATCHING_IMAGE} alt="第2回LCFで企業とライブコマーサーが商品を囲んで商談する完成予想イメージ" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" /><figcaption className="border-t border-white/15 p-5"><p className="text-[10px] font-black tracking-[0.2em] text-[#f5cf31]">BUSINESS MATCHING / CONCEPT IMAGE</p><p className="mt-2 text-sm leading-6 text-white/60">商品を囲み、販売条件と企画を直接話す。会場完成予想イメージであり、実際の施工・出展内容とは異なる場合があります。</p></figcaption></figure>
        </div>
      </div>
    </section>
  );
}

function Signage() {
  return (
    <section className="bg-[#f2efe6] px-5 py-24 text-[#111] md:px-10 md:py-32">
      <div className="mx-auto grid max-w-[1540px] gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <div><p className="text-xs font-black tracking-[0.24em] text-black/45">04 / COMMON SIGN</p><h2 className="mt-5 text-5xl font-black leading-[0.94] tracking-[-0.06em] md:text-7xl">この黄色が、<br />売れる現場の目印。</h2><p className="mt-7 max-w-xl text-base leading-8 text-black/58">LCFの黄色い上部看板を会場の共通サインへ。年号を入れず、開催回を重ねても育つLCFの景色をつくります。</p><div className="mt-6 flex flex-wrap gap-3"><a href={YEARLESS_LOGO_SVG} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-black/30 px-4 py-2 text-xs font-black">年号なしロゴ素材<ArrowUpRight size={14} /></a><a href={YEARLESS_FASCIA_SVG} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-black/30 px-4 py-2 text-xs font-black">黄色看板素材<ArrowUpRight size={14} /></a></div></div>
        <div className="bg-[#d8d5cc] p-5 shadow-[18px_18px_0_0_#111] md:p-10"><p className="mb-4 text-xs font-black tracking-[0.16em] text-black/45">BOOTH FASCIA / YEARLESS BRAND SIGN</p><LcfFascia /><div className="mt-8 border-t border-black/20 pt-5"><p className="text-lg font-black">東京都立産業貿易センター浜松町館</p><p className="mt-1 text-sm text-black/50">TOKYO METROPOLITAN INDUSTRIAL TRADE CENTER HAMAMATSUCHO-KAN</p></div></div>
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="bg-white px-5 py-24 text-[#111] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-10 md:grid-cols-[0.68fr_1.32fr]"><div><p className="text-xs font-black tracking-[0.24em] text-black/40">05 / PROOF FROM EDITION 01</p><h2 className="mt-5 text-5xl font-black leading-[0.94] tracking-[-0.06em] md:text-7xl">第1回の結果を、<br />第2回の実践へ。</h2></div><p className="max-w-2xl text-base leading-8 text-black/58 md:justify-self-end">第1回で生まれた来場、販売、企業とライバーの接点を、継続して成果へつなげる会場と申込体験へ更新します。第1回ページ、記録、写真、参加履歴はそのまま保持します。</p></div>
        <div className="mt-16 grid grid-cols-2 border-l border-t border-black/20 md:grid-cols-5">{lcf2026Stats.map((stat) => <div key={stat.label} className="border-b border-r border-black/20 p-5 md:p-7"><p className={`${stat.compact ? "text-[clamp(1.35rem,3vw,3rem)]" : "text-[clamp(2.6rem,5vw,4.8rem)]"} whitespace-nowrap font-black leading-none tracking-[-0.07em]`}>{stat.value}</p><p className="mt-5 text-sm font-black">{stat.label}</p><p className="mt-1 text-xs text-black/42">{stat.note}</p></div>)}</div>
        <div className="mt-8 flex flex-wrap gap-3"><a href="/livecommercefestival/2026/report" className="inline-flex items-center gap-3 bg-black px-6 py-4 text-sm font-black text-white">第1回開催レポート<ArrowUpRight size={18} /></a><a href="/2026" className="inline-flex items-center gap-3 border border-black/25 px-6 py-4 text-sm font-black">第1回イベントページ<ArrowUpRight size={18} /></a></div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#d5aa19] px-5 py-24 text-black md:px-10 md:py-32">
      <div className="absolute -right-16 -top-28 select-none text-[20rem] font-black leading-none tracking-[-0.1em] text-black/[0.06] md:text-[32rem]">02</div>
      <div className="relative mx-auto max-w-[1540px]"><p className="text-xs font-black tracking-[0.24em]">06 / JOIN THE FLOOR</p><div className="mt-8 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-end"><h2 className="text-5xl font-black leading-[0.9] tracking-[-0.065em] md:text-8xl">見る側から、<br />売る側へ。</h2><div className="max-w-2xl lg:justify-self-end"><p className="mb-7 text-base font-medium leading-8 text-black/68">{event.dateText}<br />{event.venueName}<br />同じLCFアカウントで、第1回の履歴を保持したまま第2回へ申し込めます。</p><ApplicationButtons /></div></div></div>
    </section>
  );
}

export default function LcfSecondEdition() {
  useEffect(() => {
    applyPageSeo({
      title: "第2回 LIVE COMMERCE FESTIVAL｜2026年12月8日・9日 浜松町館",
      description: "第2回LIVE COMMERCE FESTIVALは2026年12月8日・9日、東京都立産業貿易センター浜松町館2階展示室で開催。企業とコマースライバーの直接マッチング、商品体験、実践セミナー、会場からのライブ販売をつなぎます。",
      canonicalPath: "/2nd",
      image: HERO_IMAGE,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.name,
        description: "見る展示会から、売る展示会へ。企業とコマースライバーの直接マッチング、商品体験、実践セミナー、会場からのライブ販売をつなぐ2日間。",
        startDate: "2026-12-08",
        endDate: "2026-12-09",
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        image: [HERO_IMAGE],
        location: { "@type": "Place", name: event.venueName, address: { "@type": "PostalAddress", streetAddress: "海岸1-7-1", addressLocality: "港区", addressRegion: "東京都", postalCode: "105-7501", addressCountry: "JP" } },
        url: `${window.location.origin}/2nd`,
        organizer: { "@type": "Organization", name: "LCF実行委員会", url: `${window.location.origin}/` },
      },
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#090909] font-sans antialiased">
      <Header />
      <main><Hero /><Concept /><Experience /><Venue /><VisualStories /><Signage /><Proof /><FinalCta /></main>
      <footer className="bg-[#090909] px-5 py-10 text-white md:px-10"><div className="mx-auto flex max-w-[1540px] flex-col gap-6 border-t border-white/15 pt-8 text-xs text-white/45 md:flex-row md:items-end md:justify-between"><div><p className="font-black tracking-[0.18em] text-white">LIVE COMMERCE FESTIVAL</p><p className="mt-2">Commerce moves people.</p></div><div className="flex flex-wrap gap-5"><a href="/" className="hover:text-white">TOP</a><a href="/2026" className="hover:text-white">第1回実績</a><a href="/lcm" className="hover:text-white">LCM MARKET</a><a href="/lcf/mypage" className="hover:text-white">マイページ</a></div><p>© 2026 LCF実行委員会</p></div></footer>
    </div>
  );
}
