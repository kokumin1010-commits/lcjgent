/**
 * 第2回LCF公式特別ページ。
 * Design: Japanese industrial editorial × signal-yellow venue fascia.
 * Principles: confirmed venue facts, generated imagery labelled as concept, no fixed booth count, direct application paths, and an always-on LCF-to-LCM commerce loop.
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
  ShoppingBag,
  Users,
} from "lucide-react";
import { lcf2026PhotoById, lcf2026Stats } from "@/data/lcfEditions";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";
import { LCF_EVENT_DEFINITIONS } from "@shared/lcfEventDefinitions";

const event = LCF_EVENT_DEFINITIONS[2];
const HERO_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/MMteMRKpTWljOHRT.webp";
const OFFICIAL_MOVIE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/QHYaTbQAzawNOpYI.mp4";
const LCF_COLOR_LOGO = {
  src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/NqiAbWVvlJsEtygb.png",
  width: 1200,
  height: 739,
  alt: "LCF LIVE COMMERCE FESTIVAL",
} as const;
const SELLING_EXPERIENCE_PHOTO = {
  src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/moLmsSukFIiBkAmV.jpg",
  width: 1920,
  height: 1280,
  alt: "第1回LIVE COMMERCE FESTIVALで3名のライブコマーサーが商品を紹介している実景",
} as const;
const LCM_PUBLIC_MARKET_SCREEN = {
  src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/sivJnwYjdZtRGkJL.webp",
  width: 1440,
  height: 1050,
  alt: "LCMで公開商品やブランドを探せる実際の商品探索画面",
} as const;
const EDITION_ONE_STREAMING_PHOTOS = [
  {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/OzwIxCrBoqVTRYjO.webp",
    width: 1566,
    height: 1046,
    alt: "第1回LIVE COMMERCE FESTIVALで商品を紹介するライブ配信風景",
    caption: "商品を前に、会場から配信",
  },
  {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/FhjXJvENBliUYoML.webp",
    width: 1566,
    height: 1046,
    alt: "第1回LIVE COMMERCE FESTIVALで化粧品を紹介するライブ配信風景",
    caption: "商品の魅力を、視聴者へ",
  },
  {
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/TRjHSeDffLjxseCh.webp",
    width: 1566,
    height: 1046,
    alt: "第1回LIVE COMMERCE FESTIVALで商品を実演するライブ配信風景",
    caption: "実演しながら、その場で届ける",
  },
] as const;
const EDITION_ONE_GROUP_PHOTO = {
  src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/zWSHOAymGWjysDJu.webp",
  width: 2000,
  height: 1335,
  alt: "第1回LIVE COMMERCE FESTIVALで多数の参加者が集まった集合写真",
} as const;
const EDITION_ONE_STAGE_AUDIENCE = {
  id: "D2-209",
  src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/lSPjZzCAExTglDlY.webp",
  width: 2000,
  height: 1336,
  alt: "第1回LIVE COMMERCE FESTIVALで登壇者と観客が一緒に盛り上がるDAY2ステージトーク",
} as const;
const VENUE_ADDRESS = "〒105-7501 東京都港区海岸1-7-1 東京ポートシティ竹芝";
const VENUE_MAP_EMBED = `https://www.google.com/maps?q=${encodeURIComponent("東京都立産業貿易センター浜松町館")}&output=embed&z=16`;
const editionOnePhotos = {
  venue: lcf2026PhotoById["D1-104"],
  crowd: lcf2026PhotoById["D1-094"],
  booth: lcf2026PhotoById["D1-030"],
  streamingBooth: lcf2026PhotoById["D1-053"],
  matching: lcf2026PhotoById["D1-137"],
  productExchange: lcf2026PhotoById["D2-114"],
  liveProduct: lcf2026PhotoById["D2-064"],
} as const;

const experiences = [
  { icon: Handshake, index: "01", title: "直接マッチング", copy: "企業・ブランドとライブコマーサーが直接出会い、商品の魅力や販売方法について、その場で具体的な商談ができます。" },
  { icon: ShoppingBag, index: "02", title: "商品体験", copy: "商品を実際に手に取り、試し、商品の特徴や開発背景を知ることで、ライブ配信で伝えるための商品理解を深めます。" },
  { icon: Mic2, index: "03", title: "実践セミナー", copy: "ライブコマースの販売ノウハウや成功事例を学び、実際の配信や販売に活かせる知識を身につけます。" },
  { icon: Radio, index: "04", title: "会場からライブ販売", copy: "会場で出会った商品を、その場から実際にライブ配信。展示や商談だけで終わらず、リアルな販売機会につなげます。" },
  { icon: Users, index: "05", title: "LCMで継続商談", copy: "イベント後もLCMを通じて商品発掘や商談を継続。LCFで生まれた出会いを、継続的な販売やビジネスへつなげます。" },
] as const;

function Header() {
  const me = trpc.festivalAuth.me.useQuery(undefined, { retry: false });
  const memberHref = me.data?.portal?.defaultPath || (me.data ? "/lcf/mypage" : "/lcf/login");
  const memberLabel = me.data ? "マイページ" : "ログイン";
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1540px] items-center justify-between px-4 md:h-20 md:px-10">
        <a href="/" aria-label="LIVE COMMERCE FESTIVAL TOP" className="inline-flex shrink-0"><img src={LCF_COLOR_LOGO.src} alt={LCF_COLOR_LOGO.alt} width={LCF_COLOR_LOGO.width} height={LCF_COLOR_LOGO.height} className="h-10 w-auto md:h-12" /></a>
        <nav className="flex items-center gap-2 text-[10px] font-black tracking-[0.04em] sm:text-xs md:gap-4" aria-label="第2回ページナビゲーション">
          <a href="/lcm" className="inline-flex border border-[#f5cf31]/70 px-2.5 py-2.5 text-[#f5cf31] transition-colors hover:bg-[#f5cf31] hover:text-black md:px-4">LCM</a>
          <a href="/2026" className="inline-flex border border-white/25 px-3 py-2.5 text-white transition-colors hover:border-white md:px-4">第1回実績</a>
          <a href={memberHref} className="inline-flex min-w-[86px] justify-center bg-white px-3 py-2.5 text-black transition-colors hover:bg-[#f5cf31] md:px-5">{me.isLoading ? "…" : memberLabel}</a>
        </nav>
      </div>
    </header>
  );
}

function ApplicationButtons({ dark = false, hero = false }: { dark?: boolean; hero?: boolean }) {
  if (hero) {
    return (
      <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2">
        <a
          href={event.applicationCompanyPath}
          aria-label="出展申込・お問い合わせページへ"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#ed2f75] via-[#ff7350] to-[#ffbd18] px-1.5 py-2 text-center text-[10px] font-black leading-4 text-white shadow-[0_10px_30px_rgba(238,48,116,.2)] transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.97] sm:min-h-14 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
        >
          <Building2 size={19} className="hidden shrink-0 sm:block" /><span><span className="sm:hidden">出展申込</span><span className="hidden sm:inline">出展申込<small className="mt-0.5 block text-[10px] font-bold">お問い合わせページへ</small></span></span><ArrowUpRight size={17} className="hidden shrink-0 sm:block" />
        </a>
        <a
          href={event.applicationLiverPath}
          aria-label="ライブコマーサー申込フォームへ"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#ed2f75] via-[#ff7350] to-[#ffbd18] px-1.5 py-2 text-center text-[10px] font-black leading-4 text-white shadow-[0_10px_30px_rgba(238,48,116,.2)] transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.97] sm:min-h-14 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
        >
          <Handshake size={19} className="hidden shrink-0 sm:block" /><span><span className="sm:hidden">ライバー申込</span><span className="hidden sm:inline">ライブコマーサー申込<small className="mt-0.5 block text-[10px] font-bold">申込フォームへ</small></span></span><ArrowUpRight size={17} className="hidden shrink-0 sm:block" />
        </a>
        <a
          href={event.applicationGeneralPath}
          aria-label="一般来場申込フォームへ"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#ed2f75] via-[#ff7350] to-[#ffbd18] px-1.5 py-2 text-center text-[10px] font-black leading-4 text-white shadow-[0_10px_30px_rgba(238,48,116,.2)] transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.97] sm:min-h-14 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
        >
          <Users size={19} className="hidden shrink-0 sm:block" /><span><span className="sm:hidden">一般申込</span><span className="hidden sm:inline">一般来場申込<small className="mt-0.5 block text-[10px] font-bold">申込フォームへ</small></span></span><ArrowUpRight size={17} className="hidden shrink-0 sm:block" />
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a href={event.applicationCompanyPath} className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#f5cf31] px-6 py-4 text-sm font-black text-black transition-transform duration-150 active:scale-[0.97]">
        <Building2 size={19} />出展申込・お問い合わせページへ<ArrowUpRight size={17} />
      </a>
      <a href={event.applicationLiverPath} className={`inline-flex min-h-14 items-center justify-center gap-3 border px-6 py-4 text-sm font-black transition-colors ${dark ? "border-white/45 bg-black/30 text-white hover:border-white" : "border-black/35 text-black hover:bg-black hover:text-white"}`}>
        <Camera size={19} />ライブコマーサー申込フォームへ<ArrowUpRight size={17} />
      </a>
      <a href={event.applicationGeneralPath} className={`inline-flex min-h-14 items-center justify-center gap-3 border px-6 py-4 text-sm font-black transition-colors ${dark ? "border-white/45 bg-black/30 text-white hover:border-white" : "border-black/35 text-black hover:bg-black hover:text-white"}`}>
        <Users size={19} />一般来場申込フォームへ<ArrowUpRight size={17} />
      </a>
    </div>
  );
}

function LcmHeroBanner() {
  return (
    <aside className="relative mt-5 max-w-4xl overflow-hidden border border-[#f5cf31]/55 bg-black" aria-label="LCM ライブコマースマーケットのご案内">
      <img src={LCM_PUBLIC_MARKET_SCREEN.src} alt="" width={LCM_PUBLIC_MARKET_SCREEN.width} height={LCM_PUBLIC_MARKET_SCREEN.height} loading="lazy" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-top opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/82 to-black/58" />
      <span className="sr-only">{LCM_PUBLIC_MARKET_SCREEN.alt}</span>
      <div className="relative grid gap-4 p-4 backdrop-blur-[1px] sm:grid-cols-[1fr_auto] sm:items-center md:p-5">
        <div className="min-w-0 border-l-4 border-[#f5cf31] pl-4">
          <p className="text-[10px] font-black tracking-[0.2em] text-[#f5cf31]">LCM / LIVE COMMERCE MARKET</p>
          <p className="mt-1 text-lg font-black tracking-[-0.02em] text-white md:text-xl">メーカー事前マッチングはこちらから</p>
          <p className="mt-1 text-xs font-medium leading-6 text-white/75 md:text-sm">LCF開催前に、出展メーカーの商品情報を確認し、ライブ配信したい商品を探すことができます。イベント当日までにメーカー担当者と連絡を取り、サンプルや配信条件について相談できます。</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:max-w-64 sm:justify-end">
          <a href="/lcm" className="inline-flex min-h-11 items-center justify-center bg-[#f5cf31] px-4 py-3 text-center text-xs font-black text-black transition-transform duration-150 active:scale-[0.97]">事前マッチングはこちらから<ArrowUpRight className="ml-2 h-4 w-4 shrink-0" /></a>
        </div>
      </div>
    </aside>
  );
}

function VenueMiniMap() {
  return (
    <div className="mt-6 scroll-mt-20 overflow-hidden border border-white/20 bg-[#202020]" aria-label="東京都立産業貿易センター浜松町館のGoogleマップ">
      <iframe src={VENUE_MAP_EMBED} title="東京都立産業貿易センター浜松町館 Googleマップ" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-52 w-full border-0" />
      <div className="border-t border-white/15 bg-black px-3 py-2.5">
        <p className="text-[10px] font-black tracking-[0.15em] text-[#f5cf31]">GOOGLE MAP</p>
        <p className="mt-1 text-[11px] font-bold leading-5 text-white/70">{VENUE_ADDRESS}</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="bg-[#090909] px-0 pb-0 pt-0 text-white md:px-6 md:pt-6">
      <div className="mx-auto max-w-[1540px]">
        <div className="overflow-hidden border-y border-white/10 bg-[#fffefa] text-[#111] md:border">
          <div className="border-b border-black/10 bg-white p-4 md:p-5">
            <ApplicationButtons hero />
          </div>

          <figure className="overflow-hidden bg-white">
            <img
              src={HERO_IMAGE}
              alt="第2回LIVE COMMERCE FESTIVALのコピー、出演者、開催情報、第1回開催風景をまとめた公式キービジュアル"
              width={2048}
              height={1745}
              fetchPriority="high"
              decoding="async"
              className="-mt-[7.1%] block h-auto w-full"
            />
          </figure>

          <div className="grid gap-7 bg-[#111] px-5 py-7 text-white md:grid-cols-[1fr_340px] md:px-8 md:py-9">
            <div>
              <div className="relative isolate min-h-[330px] overflow-hidden border border-white/15 bg-black px-5 py-8 sm:min-h-[380px] md:px-8 md:py-12">
                <img
                  src={SELLING_EXPERIENCE_PHOTO.src}
                  alt=""
                  width={SELLING_EXPERIENCE_PHOTO.width}
                  height={SELLING_EXPERIENCE_PHOTO.height}
                  loading="eager"
                  fetchPriority="high"
                  aria-hidden="true"
                  className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/92 via-black/72 to-black/42" />
                <div className="relative z-10 max-w-3xl">
                  <p className="flex items-center gap-3 text-[10px] font-black tracking-[0.24em] text-[#f5cf31] md:text-xs"><span className="h-px w-10 bg-[#f5cf31]" />2ND EDITION / SELLING EXPERIENCE</p>
                  <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.045em] md:text-5xl">見る展示会から体験する展示会へ。</h2>
                  <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-white/82 md:text-base">商品と出会い、実際に試し、学び、販売につなげる。企業とライブコマーサーの出会いを、商談だけで終わらせず、実際の販売へとつなげる2日間です。</p>
                  <span className="sr-only">{SELLING_EXPERIENCE_PHOTO.alt}</span>
                </div>
              </div>
              <LcmHeroBanner />
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold">
                <a href="#official-movie" className="inline-flex items-center gap-2 text-[#f5cf31] hover:text-white">第1回公式映像を見る<ArrowDownRight size={16} /></a>
                <a href="#experience" className="inline-flex items-center gap-2 text-white/60 hover:text-white">第2回の体験を見る<ArrowDownRight size={16} /></a>
              </div>
            </div>
            <aside className="border-l border-white/20 pl-5 md:pl-7">
              <p className="text-[10px] font-black tracking-[0.24em] text-white/45">EVENT INFORMATION</p>
              <div className="mt-5 space-y-5 border-t border-white/15 pt-5">
                <div className="flex gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#f5cf31]" /><p className="text-sm font-bold leading-6">2026年12月8日（火）<br />12月9日（水）</p></div>
                <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#f5cf31]" /><p className="text-sm font-bold leading-6">東京都立産業貿易センター<br />浜松町館 2階展示室</p></div>
              </div>
              <VenueMiniMap />
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

function OfficialMovie() {
  return (
    <section id="official-movie" className="bg-black px-5 pb-14 pt-0 text-white md:px-10 md:pb-20 md:pt-0">
      <div className="mx-auto max-w-[1540px]">
        <div className="mb-7 border-t border-white/20 pt-6">
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] text-[#f5cf31] md:text-xs">EDITION 01 / OFFICIAL MOVIE</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] md:text-6xl">ライブコマースが、日本のBtoC市場を変える。</h2>
            <div className="mt-4 max-w-3xl space-y-3 text-sm leading-7 text-white/68 md:text-base">
              <p>第1回LCFで生まれた会場の熱気。ブランドとライブコマーサーの出会い。そして、会場から生まれるリアルなライブコマースの瞬間。</p>
              <p>その熱量と、ここでしか生まれない出会いを、映像でご覧ください。</p>
              <p className="text-xs text-white/45">※映像はミュートで再生されます。プレイヤーから音声をオンにしてお楽しみいただけます。</p>
            </div>
          </div>
        </div>
        <div className="relative aspect-video overflow-hidden border border-white/15 bg-[#151515] shadow-[0_30px_90px_rgba(0,0,0,.45)]">
          <video
            className="absolute inset-0 h-full w-full"
            src={OFFICIAL_MOVIE}
            aria-label="LIVE COMMERCE FESTIVAL 2026 公式映像"
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
          >
            お使いのブラウザは動画再生に対応していません。
          </video>
        </div>
        <div id="edition-one-live-streaming" className="mt-8 border-t border-white/20 pt-6 md:mt-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black tracking-[0.24em] text-[#f5cf31] md:text-xs">EDITION 01 / LIVE STREAMING</p>
              <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] md:text-4xl">第1回、会場から生まれたライブ配信。</h3>
            </div>
            <p className="max-w-xl text-sm leading-7 text-white/65">商品を手に取り、その魅力を言葉で伝える。視聴者の反応を感じながら、商品との出会いをその場で販売へとつなげていく。第1回LCFの会場では、ライブコマーサーによるリアルなライブ配信が行われました。会場で生まれた熱量とライブコマースの可能性をご覧ください。</p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {EDITION_ONE_STREAMING_PHOTOS.map((photo, index) => (
              <figure key={photo.src} className="group overflow-hidden border border-white/15 bg-[#111]">
                <div className="aspect-[3/2] overflow-hidden">
                  <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                </div>
                <figcaption className="flex items-center justify-between gap-4 border-t border-white/15 px-4 py-3 text-xs font-black text-white">
                  <span>{photo.caption}</span><span className="shrink-0 text-[#f5cf31]">0{index + 1}</span>
                </figcaption>
              </figure>
            ))}
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
          <div><p className="text-xs font-black tracking-[0.24em] text-[#f5cf31]">01 / SELLING EXPERIENCE</p><h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.06em]"><span className="hidden md:inline">出会うだけじゃない。<br />配信して、売る。</span><span className="md:hidden">出会うだけ<br />じゃない。<br />配信して、売る。</span></h2></div>
          <div className="max-w-2xl space-y-4 text-base leading-8 text-white/68 lg:justify-self-end md:text-lg">
            <p>第2回LCFは、メーカーとライブコマーサーが出会うだけの展示会ではありません。</p>
            <p>商品を知り、実際に手に取り、その場でライブ配信。ライブコマーサーは商品を視聴者へ届け、メーカーは新たな販売機会を生み出します。</p>
            <p className="font-black text-white">「出会う」から、「配信する」、そして「売る」へ。<br />ライブコマースだからこそ生まれる、新しい商談と販売の形。</p>
            <p>第2回LCFは、出会いを売上へとつなげる、実践型ライブコマースイベントです。</p>
          </div>
        </div>
        <div className="mt-16 grid border-l border-t border-white/15 sm:grid-cols-2 lg:grid-cols-5">
          {experiences.map(({ icon: Icon, index, title, copy }) => (
            <article key={title} className="border-b border-r border-white/15 p-6 md:p-7"><div className="flex items-center justify-between"><Icon size={25} className="text-[#f5cf31]" /><span className="text-xs font-black text-white/25">{index}</span></div><h3 className="mt-10 text-xl font-black">{title}</h3><p className="mt-4 text-sm leading-7 text-white/55">{copy}</p></article>
          ))}
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-[1.25fr_0.75fr_1fr]">
          {[editionOnePhotos.booth, editionOnePhotos.streamingBooth, editionOnePhotos.liveProduct].map((photo, index) => (
            <figure key={photo.id} className="group relative min-h-56 overflow-hidden border border-white/15 md:min-h-72">
              <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-5"><p className="text-[10px] font-black tracking-[0.18em] text-[#f5cf31]">EDITION 01 / 0{index + 1}</p><p className="mt-2 text-sm font-black text-white">{photo.alt.replace("LCF 2026 ", "")}</p></figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function LcmBridge() {
  const steps = [
    { index: "01", title: "ブランドが商品を登録", copy: "ブランドページや商品情報を登録し、商品の魅力や特徴を発信。ライブコマーサーに商品を知ってもらうきっかけをつくります。" },
    { index: "02", title: "ライブコマーサーが商品を探す", copy: "気になる商品を見つけたら、参加登録して商品との出会いや次の商談へ進みます。" },
    { index: "03", title: "LCFで出会い、配信へ", copy: "事前に商品を知り、会場で直接商談。その出会いをライブ配信や販売へとつなげます。" },
  ] as const;

  return (
    <section id="lcm" className="bg-[#fffdf8] px-5 py-24 text-[#111] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-10 border-t border-black/25 pt-6 lg:grid-cols-[0.62fr_1.38fr] lg:gap-20">
          <div>
            <p className="text-xs font-black tracking-[0.24em] text-[#b78100]">02 / ALWAYS-ON MARKET</p>
            <p className="mt-7 text-[clamp(5.5rem,14vw,13rem)] font-black leading-[0.7] tracking-[-0.1em] text-[#f5cf31]" aria-hidden="true">LCM</p>
            <p className="mt-7 max-w-sm text-sm leading-7 text-black/55">LIVE COMMERCE MARKET。第2回LCFの開催前・当日・開催後をつなぐ、常設のライブコマースマーケットです。</p>
          </div>
          <div>
            <h2 className="max-w-5xl text-5xl font-black leading-[0.94] tracking-[-0.06em] md:text-8xl">LCFの2日を、<br /><span className="text-[#b78100]">毎日の商談へ。</span></h2>
            <div className="mt-7 max-w-3xl space-y-4 text-base font-medium leading-8 text-black/62 md:text-lg">
              <p>LCFの2日間を、日常の商談へ。</p>
              <p>LCMでは、ブランドが商品情報を掲載し、ライブコマーサーが配信したい商品を探すことができます。</p>
              <p>商品写真や販売価格などの基本情報は公開され、サンプルの提供や具体的な取引条件などは、LCF・LCM共通アカウントを通じて確認できます。</p>
              <p>LCFで生まれた出会いを一度きりで終わらせず、イベントの前後も継続的な商品発掘と商談につなげていきます。</p>
            </div>
          </div>
        </div>

        <div className="mt-14 grid border-l border-t border-black/20 md:grid-cols-3">
          {steps.map((step) => <article key={step.index} className="border-b border-r border-black/20 p-6 md:p-8"><div className="flex items-center justify-between"><span className="text-xs font-black tracking-[0.16em] text-[#b78100]">STEP {step.index}</span><span className="h-2.5 w-2.5 bg-[#f5cf31]" /></div><h3 className="mt-8 text-2xl font-black tracking-[-0.03em]">{step.title}</h3><p className="mt-4 text-sm font-medium leading-7 text-black/55">{step.copy}</p></article>)}
        </div>

        <div className="mt-10 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          {[editionOnePhotos.matching, editionOnePhotos.productExchange].map((photo, index) => (
            <figure key={photo.id} className="group relative min-h-64 overflow-hidden bg-black md:min-h-96">
              <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-transparent to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-6 text-white"><p className="text-[10px] font-black tracking-[0.2em] text-[#f5cf31]">LCF → LCM / REAL SCENE {index + 1}</p><p className="mt-2 text-lg font-black">{index === 0 ? "商品を見つけ、次の配信につなげる。" : "出会いを、継続的な商談と販売へ。"}</p></figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-10 grid gap-px bg-black/20 lg:grid-cols-[1fr_1fr_0.82fr]">
          <article className="bg-[#171714] p-6 text-white md:p-8"><Building2 className="h-7 w-7 text-[#f5cf31]" /><p className="mt-7 text-xs font-black tracking-[0.16em] text-[#f5cf31]">FOR BRANDS</p><h3 className="mt-2 text-2xl font-black">商品を掲載して、販売機会をつくる。</h3><p className="mt-4 text-sm leading-7 text-white/58">商品情報を掲載し、ライブコマーサーに商品を知ってもらう。サンプル提供や商談を通じて、次のライブ配信・販売につなげます。</p><a href="/lcm/manage?workspace=brand" className="mt-7 inline-flex min-h-12 items-center justify-center bg-[#f5cf31] px-5 py-3 text-sm font-black text-black">ブランドとしてLCMに参加<ArrowUpRight className="ml-2 h-4 w-4" /></a></article>
          <article className="bg-[#171714] p-6 text-white md:p-8"><Mic2 className="h-7 w-7 text-[#f5cf31]" /><p className="mt-7 text-xs font-black tracking-[0.16em] text-[#f5cf31]">FOR LIVE COMMERCERS</p><h3 className="mt-2 text-2xl font-black">配信したい商品を見つける。</h3><p className="mt-4 text-sm leading-7 text-white/58">さまざまなブランドの商品を探し、気になる商品をチェック。サンプルや商談を通じて、自分の配信で紹介したい商品と出会えます。</p><a href="/lcm/manage?workspace=creator" className="mt-7 inline-flex min-h-12 items-center justify-center border border-[#f5cf31] px-5 py-3 text-sm font-black text-[#f5cf31]">ライブコマーサーとしてLCMに参加<ArrowUpRight className="ml-2 h-4 w-4" /></a></article>
          <aside className="flex flex-col justify-between bg-[#f5cf31] p-6 md:p-8"><div><ShoppingBag className="h-7 w-7" /><p className="mt-7 text-xs font-black tracking-[0.16em]">PUBLIC MARKET</p><h3 className="mt-2 text-2xl font-black">まずは、どんな商品があるか見てみる。</h3><p className="mt-4 text-sm font-medium leading-7 text-black/62">LCMに掲載されている商品やブランドを、誰でも自由に閲覧できます。気になる商品が見つかったら、参加登録して、商品との出会いや次の商談・配信につなげられます。</p></div><a href="/lcm" className="mt-7 inline-flex min-h-12 items-center justify-center bg-black px-5 py-3 text-sm font-black text-white">掲載商品を見る<ArrowUpRight className="ml-2 h-4 w-4" /></a></aside>
        </div>
        <p className="mt-5 border-l-4 border-[#f5cf31] pl-4 text-xs font-bold leading-6 text-black/52">LCFとLCMは同じ会員アカウントです。既にLCFへ登録済みの方は、同じメールアドレスとパスワードで進めます。ブランドと商品は当面無料で本人が公開でき、問題がある場合は運営が非公開化します。ライブコマーサー公式プロフィールは公開同意と運営確認後に反映されます。</p>
      </div>
    </section>
  );
}

function Venue() {
  return (
    <section id="venue" className="bg-[#f2efe6] px-5 pb-16 pt-24 text-[#111] md:px-10 md:pb-20 md:pt-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div><p className="text-xs font-black tracking-[0.24em] text-black/45">03 / HAMAMATSUCHO</p><h2 className="mt-5 text-4xl font-black leading-[0.94] tracking-[-0.06em] md:text-7xl">東京・浜松町で、<br />配信と商談が動く。</h2></div>
          <div className="max-w-2xl space-y-4 text-base leading-8 text-black/62 lg:justify-self-end"><p className="text-lg font-black text-black">東京都立産業貿易センター浜松町館 2階展示室</p><p>JR浜松町駅から徒歩5分、ゆりかもめ竹芝駅から徒歩2分。大門駅からも徒歩7分と、都内各地からアクセスしやすい会場です。</p><p>広々とした展示スペースを活かし、商品展示・体験、ライブ配信、セミナー、商談までを一つの会場で展開。</p><p>企業とライブコマーサーが出会い、商品を知り、話し、そしてその場で配信・販売できる空間をつくります。</p></div>
        </div>
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="bg-white px-5 py-16 text-[#111] md:px-10 md:py-24">
      <div className="mx-auto max-w-[1540px]">
        <figure id="edition-one-group-photo" className="relative mx-auto max-w-6xl scroll-mt-20 overflow-hidden bg-black shadow-[16px_16px_0_0_#f5cf31]">
          <img src={EDITION_ONE_GROUP_PHOTO.src} alt={EDITION_ONE_GROUP_PHOTO.alt} width={EDITION_ONE_GROUP_PHOTO.width} height={EDITION_ONE_GROUP_PHOTO.height} loading="lazy" className="block h-auto w-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/82 via-black/10 to-black/70" />
          <figcaption className="absolute inset-0 flex flex-col justify-between p-5 text-white md:p-9">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black tracking-[0.24em] text-[#f5cf31] md:text-xs">PROOF FROM EDITION 01</p>
              <h2 className="mt-3 text-4xl font-black leading-[0.94] tracking-[-0.06em] drop-shadow-lg md:mt-5 md:text-7xl">第1回の実績が、<br />第2回をつくる。</h2>
              <p className="mt-4 hidden max-w-3xl text-sm font-medium leading-7 text-white/78 sm:block md:text-base">第1回で生まれた企業とライブコマーサーの出会い、実際の販売、そして会場の熱量。そのすべてを、第2回ではさらに大きな成果へつなげていきます。</p>
            </div>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
              <span className="text-xs font-black drop-shadow md:text-sm">第1回 LIVE COMMERCE FESTIVAL 集合写真</span>
              <span className="text-[9px] font-black tracking-[0.2em] text-[#f5cf31] md:text-[10px]">EDITION 01 / REAL SCENE</span>
            </div>
          </figcaption>
        </figure>
        <p className="mx-auto mt-8 max-w-6xl text-sm leading-7 text-black/58 md:text-base md:leading-8">以下はすべて、第1回公式レポートに保存している実景と実績です。</p>
        <div className="mt-14 grid gap-3 md:grid-cols-12 md:grid-rows-[300px_320px]">
          <figure className="relative overflow-hidden bg-black md:col-span-7 md:row-span-2"><img src={editionOnePhotos.venue.src} alt={editionOnePhotos.venue.alt} width={editionOnePhotos.venue.width} height={editionOnePhotos.venue.height} loading="lazy" className="h-full min-h-72 w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/76 via-transparent to-transparent" /><figcaption className="absolute bottom-0 p-6 text-sm font-black text-white">第1回・ライブコマース会場</figcaption></figure>
          <figure className="relative overflow-hidden bg-black md:col-span-5"><img src={editionOnePhotos.crowd.src} alt={editionOnePhotos.crowd.alt} width={editionOnePhotos.crowd.width} height={editionOnePhotos.crowd.height} loading="lazy" className="h-full min-h-56 w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/72 via-transparent to-transparent" /><figcaption className="absolute bottom-0 p-5 text-sm font-black text-white">来場と出展の熱気</figcaption></figure>
          <figure id="edition-one-stage-audience" className="relative min-h-64 scroll-mt-20 overflow-hidden bg-black md:col-span-5"><img src={EDITION_ONE_STAGE_AUDIENCE.src} alt={EDITION_ONE_STAGE_AUDIENCE.alt} width={EDITION_ONE_STAGE_AUDIENCE.width} height={EDITION_ONE_STAGE_AUDIENCE.height} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/72 via-transparent to-transparent" /><figcaption className="absolute bottom-0 p-4 text-xs font-black text-white">DAY2 ステージトークと観客</figcaption></figure>
        </div>
        <div className="mt-16 grid grid-cols-2 border-l border-t border-black/20 md:grid-cols-5">{lcf2026Stats.map((stat) => <div key={stat.label} className="flex min-h-56 flex-col border-b border-r border-black/20 p-5 md:min-h-64 md:p-7"><div className="flex min-h-20 items-end"><p className={`${stat.compact ? "text-[clamp(1.65rem,2.6vw,2.75rem)]" : "text-[clamp(2.6rem,4.5vw,4.2rem)]"} whitespace-nowrap font-black leading-none tracking-[-0.07em]`}>{stat.value}</p></div><p className="mt-5 flex min-h-10 items-start text-sm font-black leading-5">{stat.label}</p><p className="mt-auto min-h-8 pt-2 text-xs leading-5 text-black/42">{stat.note}</p></div>)}</div>
        <div className="mt-8 flex flex-wrap gap-3"><a href="/livecommercefestival/2026/report" className="inline-flex items-center gap-3 bg-black px-6 py-4 text-sm font-black text-white">第1回開催レポート<ArrowUpRight size={18} /></a><a href="/2026" className="inline-flex items-center gap-3 border border-black/25 px-6 py-4 text-sm font-black">第1回イベントページ<ArrowUpRight size={18} /></a></div>
      </div>
    </section>
  );
}

function StickyApplicationBar() {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/15 bg-[#090909]/95 px-3 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-2.5 text-white shadow-[0_-12px_40px_rgba(0,0,0,.35)] backdrop-blur-xl" aria-label="第2回LCF申込メニュー">
      <div className="mx-auto grid max-w-5xl grid-cols-3 gap-2">
        <a href={event.applicationCompanyPath} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#ed2f75] via-[#ff7350] to-[#ffbd18] px-2 py-2.5 text-center text-[10px] font-black leading-4 text-white transition-transform duration-150 active:scale-[0.97] sm:gap-2 sm:px-3 sm:text-sm"><Building2 className="hidden h-4 w-4 shrink-0 sm:block" /><span><span className="sm:hidden">出展申込</span><span className="hidden sm:inline">出展申込・お問い合わせ</span></span></a>
        <a href={event.applicationLiverPath} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#ed2f75] via-[#ff7350] to-[#ffbd18] px-2 py-2.5 text-center text-[10px] font-black leading-4 text-white transition-transform duration-150 active:scale-[0.97] sm:gap-2 sm:px-3 sm:text-sm"><Handshake className="hidden h-4 w-4 shrink-0 sm:block" /><span><span className="sm:hidden">ライバー申込</span><span className="hidden sm:inline">ライブコマーサー申込</span></span></a>
        <a href={event.applicationGeneralPath} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#ed2f75] via-[#ff7350] to-[#ffbd18] px-2 py-2.5 text-center text-[10px] font-black leading-4 text-white transition-transform duration-150 active:scale-[0.97] sm:gap-2 sm:px-3 sm:text-sm"><Users className="hidden h-4 w-4 shrink-0 sm:block" /><span><span className="sm:hidden">一般申込</span><span className="hidden sm:inline">一般来場申込</span></span></a>
      </div>
    </aside>
  );
}

export default function LcfSecondEdition() {
  const me = trpc.festivalAuth.me.useQuery(undefined, { retry: false });
  useEffect(() => {
    applyPageSeo({
      title: "第2回 LIVE COMMERCE FESTIVAL｜2026年12月8日・9日 浜松町館",
      description: "第2回LIVE COMMERCE FESTIVALは2026年12月8日・9日、東京都立産業貿易センター浜松町館2階展示室で開催。第1回公式映像とライブ配信・集合写真、GMV8,000万円・販売数23,958点を公開し、企業とライブコマーサーの直接マッチング、会場販売、LCMでの継続商談へつなげます。",
      canonicalPath: "/2nd",
      image: HERO_IMAGE,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.name,
        description: "見る展示会から体験する展示会へ。企業とライブコマーサーの直接マッチング、商品体験、会場からのライブ販売と、LCMでの継続的な商品発見・商談をつなぐ2日間。",
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
    <div className="min-h-screen bg-[#090909] pb-16 font-sans antialiased sm:pb-20">
      <Header />
      <main><Hero /><OfficialMovie /><Proof /><Experience /><LcmBridge /><Venue /></main>
      <footer className="bg-[#090909] px-5 py-10 text-white md:px-10"><div className="mx-auto flex max-w-[1540px] flex-col gap-6 border-t border-white/15 pt-8 text-xs text-white/45 md:flex-row md:items-end md:justify-between"><div><p className="font-black tracking-[0.18em] text-white">LIVE COMMERCE FESTIVAL</p><p className="mt-2">Commerce moves people.</p></div><div className="flex flex-wrap gap-5"><a href="/" className="hover:text-white">TOP</a><a href="/2026" className="hover:text-white">第1回実績</a><a href="/lcm" className="hover:text-white">LCM MARKET</a><a href={me.data?.portal?.defaultPath || (me.data ? "/lcf/mypage" : "/lcf/login")} className="hover:text-white">{me.data ? "マイページ" : "ログイン"}</a></div><p>© 2026 LCF実行委員会</p></div></footer>
      <StickyApplicationBar />
    </div>
  );
}
