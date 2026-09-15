/**
 * 第2回LCF開催構想ページ。
 * Design: Japanese industrial editorial × live-production floor.
 * Principles: matte black, warm ivory, LCF signal gold, exact planning figures, no invented date/venue.
 */
import { useEffect } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  Handshake,
  LayoutGrid,
  Mail,
  Mic2,
  Radio,
  Ruler,
  ShoppingBag,
  Sparkles,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import { lcf2026Stats, lcfContactEmail } from "@/data/lcfEditions";
import { applyPageSeo } from "@/lib/pageSeo";

const HERO_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/MfIYFaLDAkuwUWQv.webp";
const BOOTH_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/fsPhxYJUIWgseBfW.webp";

const boothTypes = [
  {
    count: 48,
    label: "STANDARD",
    title: "標準ライブブース",
    size: "3m × 2m",
    copy: "商品展示、スマートフォン配信、接客、2名での運営を想定した基本ブース。",
    color: "#f2cb3c",
  },
  {
    count: 14,
    label: "DEMO",
    title: "実演・電源強化ブース",
    size: "3m × 3m",
    copy: "美容実演や複数照明など、商品体験とライブ演出を強化するブース。",
    color: "#e46f3d",
  },
  {
    count: 8,
    label: "CORNER",
    title: "大型・コーナーブース",
    size: "4m × 3m",
    copy: "大型商品、共同配信、複数カメラ、複数ブランドでの展開を想定。",
    color: "#6f9e94",
  },
] as const;

const floorAreas = [
  { label: "70ブース", area: "510㎡", width: "34%", color: "#f2cb3c" },
  { label: "メインライブステージ", area: "140㎡", width: "9.3%", color: "#e46f3d" },
  { label: "商談ラウンジ", area: "120㎡", width: "8%", color: "#6f9e94" },
  { label: "クリエイターピット", area: "80㎡", width: "5.3%", color: "#9274b9" },
  { label: "パートナー展示", area: "60㎡", width: "4%", color: "#c9a3a3" },
  { label: "受付・運営・倉庫", area: "100㎡", width: "6.7%", color: "#8b8b83" },
  { label: "通路・待機・安全動線", area: "490㎡", width: "32.7%", color: "#d8d1c2" },
] as const;

const flow = [
  { icon: ShoppingBag, index: "01", title: "DISCOVER", copy: "企業の商品とライバーが、会場で直接出会う。" },
  { icon: Sparkles, index: "02", title: "EXPERIENCE", copy: "試す、比較する、背景を聞く。配信前の理解を深める。" },
  { icon: Camera, index: "03", title: "GO LIVE", copy: "ブースから配信し、その場で視聴反応と売上を確かめる。" },
  { icon: Handshake, index: "04", title: "CONTINUE", copy: "商談とLCMにつなぎ、イベント後も販売を継続する。" },
] as const;

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1540px] items-center justify-between px-5 md:h-20 md:px-10">
        <a href="/" className="flex items-center gap-3" aria-label="LIVE COMMERCE FESTIVAL TOP">
          <span className="grid h-10 w-10 place-items-center bg-[#f2cb3c] text-sm font-black tracking-[-0.08em] text-black">LCF</span>
          <span className="hidden text-[11px] font-semibold leading-tight tracking-[0.24em] text-white/90 sm:block">LIVE COMMERCE<br />FESTIVAL</span>
        </a>
        <nav className="flex items-center gap-2 text-[10px] font-black tracking-[0.05em] sm:text-xs md:gap-4" aria-label="第2回ページナビゲーション">
          <a href="#plan" className="hidden text-white/60 transition-colors hover:text-white md:block">70 BOOTHS</a>
          <a href="#proof" className="hidden text-white/60 transition-colors hover:text-white md:block">1ST EDITION</a>
          <a href="/2026" className="hidden border border-white/25 px-4 py-2.5 text-white transition-colors hover:border-white lg:inline-flex">第1回実績</a>
          <a href="/lcf/mypage" className="inline-flex bg-white px-3 py-2.5 text-black transition-colors hover:bg-[#f2cb3c] md:px-5">マイページ</a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate min-h-[780px] overflow-hidden bg-black text-white md:min-h-[900px]">
      <img src={HERO_IMAGE} alt="第2回LCFで計画する70のライブコマースブース会場イメージ" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.9)_0%,rgba(0,0,0,.68)_40%,rgba(0,0,0,.08)_76%,rgba(0,0,0,.24)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black to-transparent" />
      <div className="relative mx-auto grid min-h-[780px] max-w-[1540px] content-end gap-12 px-5 pb-16 pt-24 md:min-h-[900px] md:grid-cols-[1fr_320px] md:px-10 md:pb-24">
        <div className="max-w-5xl">
          <p className="mb-7 flex items-center gap-3 text-xs font-black tracking-[0.28em] text-[#f2cb3c] md:text-sm"><span className="h-px w-12 bg-[#f2cb3c]" />NEXT EDITION / 02</p>
          <h1 className="text-[clamp(3.3rem,8.7vw,9.2rem)] font-black uppercase leading-[0.82] tracking-[-0.07em]">
            見る展示会から、<br /><span className="text-[#f2cb3c]">売る展示会へ。</span>
          </h1>
          <p className="mt-8 max-w-2xl text-base font-medium leading-8 text-white/78 md:text-xl md:leading-9">
            約1,500㎡に70のライブコマースブース。商品を試し、その場で配信し、反応と売上を確かめ、次の商談へつなぐ。第2回LCFは、さらに実践的な産業イベントを目指します。
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="#plan" className="inline-flex items-center justify-center gap-3 bg-[#f2cb3c] px-7 py-4 text-sm font-black tracking-[0.04em] text-black transition-transform duration-150 active:scale-[0.97]">70ブース構想を見る <ArrowDownRight size={18} /></a>
            <a href={`mailto:${lcfContactEmail}?subject=${encodeURIComponent("第2回LCF 出展・協業の相談")}`} className="inline-flex items-center justify-center gap-3 border border-white/45 bg-black/35 px-7 py-4 text-sm font-black tracking-[0.04em] text-white backdrop-blur transition-colors hover:border-white">出展・協業を相談する <ArrowUpRight size={18} /></a>
          </div>
          <p className="mt-5 text-xs leading-6 text-white/55">開催日・会場・募集要項は現在調整中です。確定情報は本公式サイトで発表します。</p>
        </div>
        <aside className="border-l border-white/30 pl-6 md:self-end">
          <p className="text-xs font-black tracking-[0.28em] text-white/55">PLANNING SCALE</p>
          <p className="mt-4 text-7xl font-black tracking-[-0.08em] text-[#f2cb3c]">02</p>
          <p className="mt-3 text-2xl font-black">NEXT LCF</p>
          <div className="mt-7 border-t border-white/25 pt-5">
            <p className="text-4xl font-black tracking-[-0.06em]">1,500<span className="ml-1 text-lg">㎡</span></p>
            <p className="mt-1 text-xs tracking-[0.15em] text-white/55">VENUE PLAN</p>
          </div>
          <div className="mt-5 border-t border-white/25 pt-5">
            <p className="text-4xl font-black tracking-[-0.06em]">70<span className="ml-2 text-lg">BOOTHS</span></p>
            <p className="mt-1 text-xs tracking-[0.15em] text-white/55">ALL LIVE-READY</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Scale() {
  const items = [
    { icon: Ruler, value: "1,500", unit: "㎡", label: "会場計画面積", copy: "展示、配信、商談、ステージ、安全動線を一つのフロアへ。" },
    { icon: LayoutGrid, value: "70", unit: "BOOTH", label: "計画ブース数", copy: "標準、実演、大型の3タイプを用途に応じて構成。" },
    { icon: Radio, value: "1", unit: "STUDIO", label: "1ブースの考え方", copy: "すべてのブースを、商品展示と配信ができる小型スタジオに。" },
  ];
  return (
    <section className="bg-[#f1eee7] px-5 py-24 text-[#101010] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-10 border-t border-black/25 pt-6 md:grid-cols-[0.72fr_1.28fr] md:gap-20">
          <div><p className="text-xs font-black tracking-[0.25em] text-black/45">01 / THE NEXT SCALE</p><p className="mt-4 max-w-xs text-sm leading-7 text-black/58">第1回の実績から、より多くの実演と商談が同時に動く会場へ。</p></div>
          <h2 className="max-w-5xl text-4xl font-black leading-[1.02] tracking-[-0.055em] md:text-7xl">70のブースが、<br /><span className="text-[#bd9110]">70のライブスタジオ</span>になる。</h2>
        </div>
        <div className="mt-20 grid border-l border-t border-black/20 md:grid-cols-3">
          {items.map(({ icon: Icon, value, unit, label, copy }) => (
            <article key={label} className="border-b border-r border-black/20 p-7 md:p-9">
              <Icon size={28} strokeWidth={1.5} />
              <p className="mt-12 text-[clamp(3.6rem,7vw,7rem)] font-black leading-none tracking-[-0.075em]">{value}<span className="ml-2 text-base tracking-[0.06em] md:text-xl">{unit}</span></p>
              <h3 className="mt-7 text-lg font-black">{label}</h3>
              <p className="mt-3 text-sm leading-7 text-black/55">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BoothPlan() {
  const booths = Array.from({ length: 70 }, (_, index) => {
    if (index < 48) return { type: "STANDARD", color: boothTypes[0].color };
    if (index < 62) return { type: "DEMO", color: boothTypes[1].color };
    return { type: "CORNER", color: boothTypes[2].color };
  });
  return (
    <section id="plan" className="bg-[#0b0b0b] px-5 py-24 text-white md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-12 border-t border-white/20 pt-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div><p className="text-xs font-black tracking-[0.25em] text-[#f2cb3c]">02 / 70 BOOTH SYSTEM</p><h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-8xl">一つのサイン。<br />三つの機能。</h2></div>
          <p className="max-w-2xl text-base leading-8 text-white/62 md:justify-self-end md:text-lg">全ブースの上部へLCF共通サインを掲出し、会場全体を一つの売場・一つの配信ネットワークとして見せる計画です。ブランド表示は各ブース内で展開し、LCFの統一感と出展社の個性を両立します。</p>
        </div>
        <div className="mt-16 grid gap-4 lg:grid-cols-[0.68fr_1.32fr]">
          <div className="space-y-3">
            {boothTypes.map((type) => (
              <article key={type.label} className="border border-white/18 p-6 md:p-7">
                <div className="flex items-start justify-between gap-5"><div><p className="text-[10px] font-black tracking-[0.22em]" style={{ color: type.color }}>{type.label} / {type.size}</p><h3 className="mt-3 text-2xl font-black">{type.title}</h3></div><p className="text-6xl font-black tracking-[-0.08em]" style={{ color: type.color }}>{type.count}</p></div>
                <p className="mt-5 text-sm leading-7 text-white/55">{type.copy}</p>
              </article>
            ))}
          </div>
          <div className="border border-white/18 bg-[#131313] p-5 md:p-8">
            <div className="flex items-center justify-between border-b border-white/15 pb-5"><div><p className="text-xs font-black tracking-[0.2em] text-white/45">EXACT BOOTH COUNT</p><p className="mt-2 text-lg font-black">計画70ブース内訳</p></div><span className="text-5xl font-black tracking-[-0.07em] text-[#f2cb3c]">70</span></div>
            <div className="mt-8 grid grid-cols-7 gap-2 sm:grid-cols-10" role="img" aria-label="標準48、実演14、大型8、合計70ブースの計画内訳">
              {booths.map((booth, index) => (
                <div key={index} title={`${index + 1}: ${booth.type}`} className="group relative aspect-square border border-white/20 transition-transform duration-150 hover:-translate-y-1" style={{ backgroundColor: booth.color }}>
                  <span className="absolute inset-0 grid place-items-center text-[8px] font-black text-black/65 sm:text-[9px]">{String(index + 1).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-black tracking-[0.12em] text-white/55">{boothTypes.map((type) => <span key={type.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5" style={{ backgroundColor: type.color }} />{type.label} {type.count}</span>)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FloorDraft() {
  return (
    <section className="bg-[#f1eee7] px-5 py-24 text-[#101010] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-10 md:grid-cols-[0.72fr_1.28fr] md:items-end">
          <div><p className="text-xs font-black tracking-[0.25em] text-black/45">03 / 1,500㎡ FLOOR DRAFT</p><h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-7xl">売るための余白も、<br />設計する。</h2></div>
          <p className="max-w-2xl text-base leading-8 text-black/58 md:justify-self-end md:text-lg">ブースを詰め込むだけでは、配信も商談も止まります。通路・待機・安全動線に約490㎡を確保し、人、商品、機材が同時に動ける初期ゾーニングです。</p>
        </div>
        <div className="mt-16 overflow-hidden border border-black/20 bg-white p-5 md:p-9">
          <div className="flex min-h-52 flex-wrap content-stretch gap-1 bg-black/5 p-1 md:min-h-72">
            {floorAreas.map((area) => (
              <div key={area.label} className="flex min-h-24 flex-col justify-between p-4 text-black" style={{ backgroundColor: area.color, flexBasis: `calc(${area.width} - 4px)`, flexGrow: 1 }}>
                <span className="text-[10px] font-black tracking-[0.12em]">{area.label}</span><strong className="text-2xl font-black tracking-[-0.04em] md:text-3xl">{area.area}</strong>
              </div>
            ))}
          </div>
          <div className="mt-7 grid gap-x-8 gap-y-3 border-t border-black/20 pt-6 text-sm md:grid-cols-2 lg:grid-cols-3">
            {floorAreas.map((area) => <div key={area.label} className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-black/58"><span className="h-2.5 w-2.5" style={{ backgroundColor: area.color }} />{area.label}</span><strong>{area.area}</strong></div>)}
          </div>
          <p className="mt-6 text-xs leading-6 text-black/45">※ 会場確定前の初期ゾーニングです。消防・避難・電気容量・搬入条件・施工区画に合わせて最終設計します。</p>
        </div>
      </div>
    </section>
  );
}

function StandardBooth() {
  const equipment = [
    { icon: Wifi, label: "配信回線" }, { icon: Zap, label: "電源" }, { icon: Camera, label: "スマートフォン三脚" }, { icon: Mic2, label: "マイク" }, { icon: Sparkles, label: "2灯照明" }, { icon: Users, label: "商談2席" },
  ];
  return (
    <section className="bg-[#0b0b0b] px-5 py-24 text-white md:px-10 md:py-32">
      <div className="mx-auto grid max-w-[1540px] gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-stretch">
        <figure className="relative min-h-[430px] overflow-hidden border border-white/15 md:min-h-[680px]">
          <img src={BOOTH_IMAGE} alt="LCF共通サイン、商品展示、照明、スマートフォン三脚を備えた標準ライブブースイメージ" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent px-6 pb-6 pt-24"><p className="text-[10px] font-black tracking-[0.22em] text-[#f2cb3c]">STANDARD LIVE BOOTH / CONCEPT IMAGE</p><p className="mt-2 text-sm text-white/65">実際の設備仕様は、会場・施工会社・通信環境の確定後に更新します。</p></div>
        </figure>
        <div className="flex flex-col justify-between border border-white/15 bg-[#141414] p-7 md:p-10">
          <div>
            <p className="text-xs font-black tracking-[0.25em] text-[#f2cb3c]">04 / ONE BOOTH, ONE STUDIO</p>
            <h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-7xl">展示台ではなく、<br />売場を置く。</h2>
            <p className="mt-8 text-base leading-8 text-white/58">各ブースにLCFの共通サインを掲げ、商品を見る場所、配信する場所、商談する場所を一つにします。</p>
            <div className="mt-8 inline-flex items-center gap-4 border border-[#f2cb3c]/50 bg-[#f2cb3c]/5 p-4">
              <img src="/lcf-logo.png" alt="LIVE COMMERCE FESTIVAL" className="h-10 w-auto bg-[#f2cb3c] px-3 py-2" />
              <div><p className="text-[10px] font-black tracking-[0.2em] text-[#f2cb3c]">COMMON FASCIA</p><p className="mt-1 text-xs text-white/55">全70ブース共通の上部サイン</p></div>
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 border-l border-t border-white/15">
            {equipment.map(({ icon: Icon, label }) => <div key={label} className="flex items-center gap-3 border-b border-r border-white/15 p-4 text-xs font-bold text-white/70"><Icon size={18} className="text-[#f2cb3c]" />{label}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function CommerceFlow() {
  return (
    <section className="bg-[#f1eee7] px-5 py-24 text-[#101010] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="flex flex-col gap-8 border-b border-black/25 pb-8 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-black tracking-[0.25em] text-black/45">05 / COMMERCE FLOW</p><h2 className="mt-5 text-5xl font-black tracking-[-0.06em] md:text-7xl">一日で、売れる理由まで。</h2></div><p className="max-w-xl text-base leading-8 text-black/58">イベントで出会い、イベントで終わらない。LCMへ接続し、継続的な商品発見と販売へつなげます。</p></div>
        <div className="grid md:grid-cols-4">
          {flow.map(({ icon: Icon, index, title, copy }) => <article key={title} className="relative border-b border-black/20 py-8 md:border-r md:px-7 md:last:border-r-0"><div className="flex items-center justify-between"><Icon size={28} strokeWidth={1.5} /><span className="text-sm font-black text-black/25">{index}</span></div><h3 className="mt-10 text-2xl font-black">{title}</h3><p className="mt-4 text-sm leading-7 text-black/55">{copy}</p></article>)}
        </div>
        <a href="/lcm" className="mt-10 inline-flex items-center gap-4 border-b-2 border-black pb-2 text-sm font-black">LCM MARKETを見る <ArrowUpRight size={18} /></a>
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section id="proof" className="bg-white px-5 py-24 text-[#101010] md:px-10 md:py-32">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-10 md:grid-cols-[0.68fr_1.32fr]"><div><p className="text-xs font-black tracking-[0.25em] text-black/40">06 / PROOF FROM EDITION 01</p><h2 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-7xl">第1回の結果を、<br />第2回の設計へ。</h2></div><p className="max-w-2xl text-base leading-8 text-black/58 md:justify-self-end">第2回構想は、ゼロからの計画ではありません。第1回で生まれた販売、来場、企業とライバーの接点を、より再現しやすい会場構造へ拡張します。</p></div>
        <div className="mt-16 grid grid-cols-2 border-l border-t border-black/20 md:grid-cols-5">
          {lcf2026Stats.map((stat) => <div key={stat.label} className="border-b border-r border-black/20 p-5 md:p-7"><p className={`${stat.compact ? "text-[clamp(1.35rem,3vw,3rem)]" : "text-[clamp(2.6rem,5vw,4.8rem)]"} whitespace-nowrap font-black leading-none tracking-[-0.07em]`}>{stat.value}</p><p className="mt-5 text-sm font-black">{stat.label}</p><p className="mt-1 text-xs text-black/42">{stat.note}</p></div>)}
        </div>
        <div className="mt-8 flex flex-wrap gap-3"><a href="/livecommercefestival/2026/report" className="inline-flex items-center gap-3 bg-black px-6 py-4 text-sm font-black text-white">第1回開催レポート <ArrowUpRight size={18} /></a><a href="/2026" className="inline-flex items-center gap-3 border border-black/25 px-6 py-4 text-sm font-black">第1回イベントページ <ArrowUpRight size={18} /></a></div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="relative overflow-hidden bg-[#d5aa19] px-5 py-24 text-black md:px-10 md:py-32">
      <div className="absolute -right-16 -top-28 select-none text-[20rem] font-black leading-none tracking-[-0.1em] text-black/[0.06] md:text-[32rem]">02</div>
      <div className="relative mx-auto max-w-[1540px]">
        <p className="text-xs font-black tracking-[0.25em]">07 / JOIN THE NEXT FLOOR</p>
        <div className="mt-8 grid gap-12 md:grid-cols-[1.15fr_0.85fr] md:items-end">
          <h2 className="text-5xl font-black leading-[0.9] tracking-[-0.065em] md:text-8xl">70の売場を、<br />一緒につくる。</h2>
          <div className="max-w-xl md:justify-self-end"><p className="text-base font-medium leading-8 text-black/68">出展、共同企画、スポンサー、配信設備、施工、通信、物流、取材について、目的とご提案内容を添えてご連絡ください。開催日・会場・募集要項は決定次第公開します。</p><a href={`mailto:${lcfContactEmail}?subject=${encodeURIComponent("第2回LCF 出展・協業の相談")}`} className="mt-8 inline-flex items-center gap-4 border-b-2 border-black pb-2 text-base font-black"><Mail size={20} />出展・協業を相談する <ArrowUpRight size={20} /></a><p className="mt-4 text-xs text-black/55">{lcfContactEmail}</p></div>
        </div>
      </div>
    </section>
  );
}

export default function LcfSecondEdition() {
  useEffect(() => {
    applyPageSeo({
      title: "第2回 LIVE COMMERCE FESTIVAL｜1,500㎡・70ブース開催構想",
      description: "第2回LIVE COMMERCE FESTIVAL開催構想。約1,500㎡に70のライブコマースブースを計画し、商品体験、ライブ配信、商談を一つの会場で実践する次回LCFを紹介します。",
      canonicalPath: "/livecommercefestival/2nd",
      image: HERO_IMAGE,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "第2回 LIVE COMMERCE FESTIVAL 開催構想",
        description: "約1,500㎡・70ブースで計画する、実践型ライブコマースイベントの公式構想ページ。",
        url: `${window.location.origin}/livecommercefestival/2nd`,
        isPartOf: { "@type": "WebSite", name: "LIVE COMMERCE FESTIVAL", url: `${window.location.origin}/` },
        inLanguage: "ja",
      },
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#090909] font-sans antialiased">
      <Header />
      <main><Hero /><Scale /><BoothPlan /><FloorDraft /><StandardBooth /><CommerceFlow /><Proof /><Contact /></main>
      <footer className="bg-[#090909] px-5 py-10 text-white md:px-10"><div className="mx-auto flex max-w-[1540px] flex-col gap-6 border-t border-white/15 pt-8 text-xs text-white/45 md:flex-row md:items-end md:justify-between"><div><p className="font-black tracking-[0.18em] text-white">LIVE COMMERCE FESTIVAL</p><p className="mt-2">Commerce moves people.</p></div><div className="flex flex-wrap gap-5"><a href="/" className="hover:text-white">TOP</a><a href="/2026" className="hover:text-white">第1回実績</a><a href="/lcm" className="hover:text-white">LCM MARKET</a><a href="/lcf/mypage" className="hover:text-white">マイページ</a></div><p>© 2026 LCF実行委員会</p></div></footer>
    </div>
  );
}
