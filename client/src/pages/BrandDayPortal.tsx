import { Link, useParams } from "wouter";
import {
  Award,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  Crown,
  ExternalLink,
  Gift,
  LogIn,
  Radio,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useDrKozuBrandDaySeo } from "@/lib/drKozuBrandDaySeo";
import { DRKOZU_BRAND_DAY_PROFILE, DRKOZU_BRAND_DAY_SLUG } from "@shared/brandDayCampaign";
import "./brand-day-portal.css";

const KGDAY_SLUG = "kgday-2026";
const KG_LOGO_URL = "https://kgdayreco-2kqllucq.manus.space/manus-storage/pasted_file_p9UdsL_1_65ad3cc9.png";

type DrKozuProduct = {
  image: string;
  name: string;
  meta: string;
  copy: string;
  badge?: string;
  href?: string;
};

type EventInfo = {
  slug: string;
  title: string;
  shortName: string;
  subtitle: string;
  challenge: string;
  timezone: string;
  eventStartAt: Date | string | number;
  eventEndAt: Date | string | number;
  registrationCloseAt: Date | string | number;
  days: Array<{ dayNumber: number; label: string; startAt: Date | string | number; endAt: Date | string | number }>;
};

type CountdownValue = { days: number; hours: number; minutes: number; seconds: number };

function getCountdown(target: Date | string | number): CountdownValue {
  const distance = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor((distance / 3_600_000) % 24),
    minutes: Math.floor((distance / 60_000) % 60),
    seconds: Math.floor((distance / 1_000) % 60),
  };
}

function formatDay(value: Date | string | number, timezone: string) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return { date: `${part("year")}.${part("month")}.${part("day")}`, weekday: part("weekday") };
}

function formatClose(value: Date | string | number, timezone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value)).replaceAll("/", ".");
}

export default function BrandDayPortal() {
  const { slug = "" } = useParams<{ slug: string }>();
  useDrKozuBrandDaySeo(slug === DRKOZU_BRAND_DAY_SLUG);
  const event = trpc.brandDay.publicPortal.event.useQuery({ slug }, { enabled: Boolean(slug) });
  if (event.isLoading) return <PortalLoading />;
  if (!event.data) return <PortalError message={event.error?.message || "ブランドデーが見つかりません"} />;

  const info = event.data as EventInfo;
  if (slug === KGDAY_SLUG) return <KgdayPortal info={info} />;
  if (slug === DRKOZU_BRAND_DAY_SLUG) return <DrKozuPortal info={info} />;
  return <GenericBrandDayPortal info={info} />;
}

const DRKOZU_ASSETS: {
  logo: string;
  hero: string;
  founder: string;
  products: readonly DrKozuProduct[];
} = {
  logo: "/brand-day/drkozu/drkozu-logo.webp",
  hero: "/brand-day/drkozu/drkozu-hero.webp",
  founder: "/brand-day/drkozu/drkozu-founder.webp",
  products: [
    { image: "/brand-day/drkozu/vampire-mask.webp", name: "ヴァンパイアマスク", meta: "6回分 · ¥15,950", copy: "パウダーとセラムを混ぜ、20分。自宅で楽しむサロン発想の集中ケア。" },
    { image: "/brand-day/drkozu/cell-peel-crystal-v2.webp", name: "セルピール #クリスタル", meta: "4回分 · ¥13,200", copy: "角質をやさしく整え、なめらかな触り心地と透明感のある印象へ。" },
    { image: "/brand-day/drkozu/repair-clear-wash.webp", name: "リペアクリアウォッシュ", meta: "洗浄ケア", copy: "濃密な泡で摩擦を抑えながら、毎日の洗浄を心地よい美容習慣へ。" },
    { image: "/brand-day/drkozu/beauty-soy-protein.webp", name: "ビューティソイプロテイン", meta: "500g · ¥8,856", copy: "美容と健康を支えるたんぱく質を、おいしく続けやすい一杯に。" },
    {
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/utynVskylwoRpqzb.webp",
      name: "リペアクレンジング",
      meta: "ジェルクレンジング · 肌環境ケア",
      copy: "メイクや皮脂を落とすところから、毎日のスキンケアを心地よく整える洗浄アイテム。",
      badge: "TIKTOK SHOP",
      href: "https://vt.tiktok.com/ZS9AMLM6LaX6j-oHoqn/",
    },
    {
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/sUHnEWIRkWMdcdrK.webp",
      name: "リペアリップセラム",
      meta: "保湿リッププランパー · 全5色",
      copy: "うるおいとツヤのある口元を演出する、選べる5色のリップセラム。",
      badge: "TIKTOK SHOP",
      href: "https://vt.tiktok.com/ZS9AMLkb7LBng-Ti5bv/",
    },
    {
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/KFUMrwftZKCtYEhw.webp",
      name: "シンデレラマスク",
      meta: "集中フェイスケア",
      copy: "うるおい、ツヤ、引き締まった印象を目指す、パウダータイプの集中マスク。",
      badge: "TIKTOK SHOP",
      href: "https://vt.tiktok.com/ZS9AMLAuWeow3-oTDqC/",
    },
    {
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ODXaOknYhRUCdhEB.webp",
      name: "リジュショット",
      meta: "週1〜2回の集中ケア",
      copy: "いつものホームケアに取り入れやすい、ワンランク上の集中ケアアイテム。",
      badge: "TIKTOK SHOP",
      href: "https://vt.tiktok.com/ZS9AMLUCmAUcY-tfWfa/",
    },
    {
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ojoXvjjJSIiUfgtL.webp",
      name: "リペアセラム",
      meta: "美容液 · 40ml",
      copy: "毎日の保湿ケアに取り入れやすい、スポイトタイプの美容液。",
      badge: "TIKTOK SHOP",
      href: "https://vt.tiktok.com/ZS9AMLjNWmap7-oP3fd/",
    },
    {
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/MmzGjxCHQigUjoOc.webp",
      name: "バランスジェル",
      meta: "ピーリング後の整肌ケア",
      copy: "ピーリング後のデリケートな肌を、うるおいで整えるジェルタイプのケア。",
      badge: "TIKTOK SHOP",
      href: "https://vt.tiktok.com/ZS9AMLHdJsLop-0JiYy/",
    },
    {
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/lAcZrJNcvLegjNYC.webp",
      name: "リペアフェイシャルマスク",
      meta: "フェイスマスク · 1箱5枚入り",
      copy: "美容液をたっぷり含んだシートで、週1〜2回のうるおいスペシャルケア。",
      badge: "TIKTOK SHOP",
      href: "https://vt.tiktok.com/ZS9AMLbALsjMQ-SJR7D/",
    },
    {
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/qGwYHqckZshhETkF.webp",
      name: "フェイシャルネット",
      meta: "濃密泡の洗顔サポート",
      copy: "きめ細かな泡立てをサポートし、毎日の洗顔を心地よくするフェイシャルネット。",
      badge: "TIKTOK SHOP",
      href: "https://vt.tiktok.com/ZS9AMLT3FMwjL-s46ye/",
    },
  ],
};

function DrKozuPortal({ info }: { info: EventInfo }) {
  const [remaining, setRemaining] = useState(() => getCountdown(info.eventStartAt));
  const [showAllProducts, setShowAllProducts] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getCountdown(info.eventStartAt)), 1_000);
    return () => window.clearInterval(timer);
  }, [info.eventStartAt]);

  const displayDays = info.days.filter(day => new Date(day.startAt).getTime() < new Date(info.eventEndAt).getTime());
  const firstDay = formatDay(displayDays[0]?.startAt ?? info.eventStartAt, info.timezone);
  const lastDay = formatDay(displayDays.at(-1)?.startAt ?? new Date(new Date(info.eventEndAt).getTime() - 1), info.timezone);
  const base = `/brand-day/${info.slug}`;
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const pickUpNames = ["ヴァンパイアマスク", "セルピール #クリスタル", "リペアセラム", "リペアフェイシャルマスク"];
  const pickUpProducts = pickUpNames.flatMap(name => {
    const product = DRKOZU_ASSETS.products.find(item => item.name === name);
    return product ? [product] : [];
  });
  const otherProducts = DRKOZU_ASSETS.products.filter(product => !pickUpNames.includes(product.name));

  return (
    <div className="drkozu-page">
      <header className="drkozu-nav">
        <a href="#top" className="drkozu-nav-logo"><img src={DRKOZU_ASSETS.logo} alt="Dr.Kozu The Quintessence of Beauty" /></a>
        <nav aria-label="Dr.Kozu Brand Day">
          <button type="button" onClick={() => go("challenge")}>PKチャレンジ</button>
          <button type="button" onClick={() => go("benefits")}>参加メリット</button>
          <button type="button" onClick={() => go("products")}>対象商品</button>
          <button type="button" onClick={() => go("rules")}>公式ルール</button>
          <Link href={`${base}/ranking`}>ランキング</Link>
          <Link href={`${base}/creator/login`} className="drkozu-nav-login"><LogIn />出場者ログイン</Link>
        </nav>
      </header>

      <main>
        <section className="drkozu-hero" id="top">
          <div className="drkozu-hero-copy">
            <p className="drkozu-kicker">Dr.Kozu · BRAND DAY 2026</p>
            <img src={DRKOZU_ASSETS.logo} alt="Dr.Kozu" className="drkozu-hero-logo" />
            <p className="drkozu-hero-campaign"><span>8日間限定</span> Dr.Kozu 全商品対象</p>
            <div className="drkozu-offer"><small>最大</small><strong>50</strong><em>% OFF</em></div>
            <h1 className="drkozu-hero-headline">売れるチャンスを、<br />もっと大きく。</h1>
            <p className="drkozu-date">{firstDay.date} <span>{firstDay.weekday}</span><b>—</b>{lastDay.date} <span>{lastDay.weekday}</span></p>
            <div className="drkozu-hero-challenge">
              <span>LIVE SALES PK CHALLENGE 同時開催</span>
              <strong>賞金総額 <em>最大18万円</em></strong>
              <div>{DRKOZU_BRAND_DAY_PROFILE.prizes.map((prize, index) => <p key={prize}>第{index + 1}位 <b>{prize.toLocaleString("ja-JP")}円</b></p>)}</div>
            </div>
            <div className="drkozu-actions"><Link href={`${base}/entry`} className="drkozu-button drkozu-button-primary"><Sparkles />BRAND DAYに参加する</Link><Link href={`${base}/ranking`} className="drkozu-button drkozu-button-secondary"><Trophy />ランキングを見る</Link></div>
            <div className="drkozu-countdown" aria-label="イベント開始までのカウントダウン">
              <DrKozuCountdown value={remaining.days} label="DAYS" /><DrKozuCountdown value={remaining.hours} label="HOURS" /><DrKozuCountdown value={remaining.minutes} label="MIN" /><DrKozuCountdown value={remaining.seconds} label="SEC" />
            </div>
          </div>
          <div className="drkozu-hero-visual"><div className="drkozu-pearl" aria-hidden="true" /><img src={DRKOZU_ASSETS.hero} alt="Dr.Kozuのスキンケア・集中ケア製品" /><p><span>8 DAYS ONLY</span> 2026.10.05 — 10.12</p></div>
        </section>

        <section className="drkozu-strip" aria-label="キャンペーン概要"><p>MAX 50% OFF</p><i /><p>ALL DR.KOZU ITEMS</p><i /><p>LIVE SALES PK</p><i /><p>TOTAL PRIZE ¥180,000</p></section>

        <DrKozuSection id="challenge" eyebrow="LIVE SALES PK CHALLENGE" title="GMVランキング TOP3に賞金！" intro="BRAND DAY期間中のDr.Kozu商品GMVを集計。売上上位を目指して、賞金をつかもう。">
          <div className="drkozu-challenge-total"><span>賞金総額</span><strong>最大 <em>180,000</em>円</strong></div>
          <div className="drkozu-prizes" data-testid="drkozu-rank-prizes">
            {DRKOZU_BRAND_DAY_PROFILE.prizes.map((prize, index) => <article className={`drkozu-prize drkozu-prize-${index + 1}`} key={prize}><span>第{index + 1}位</span><strong>{prize.toLocaleString("ja-JP")}<small>円</small></strong><em>GMV RANKING</em></article>)}
          </div>
          <div className="drkozu-challenge-note"><ShieldCheck /><p>期間中のDr.Kozu商品GMVでランキングを決定します。<strong>賞金の受取には所定のGMV条件があります。</strong>条件未達の場合、下位賞金区分が適用される場合があります。詳細は公式ルールをご確認ください。</p></div>
        </DrKozuSection>

        <DrKozuSection id="benefits" eyebrow="BRAND DAY BENEFITS" title="BRAND DAYだけの特別なチャンス">
          <div className="drkozu-benefits">
            <article><div><span>01</span><Zap /></div><strong>最大50%OFF</strong><h3>売りやすい限定価格</h3><p>BRAND DAY期間限定の特別価格で、ライブ・動画での販売を後押し。</p></article>
            <article><div><span>02</span><Sparkles /></div><strong>Dr.Kozu 全商品対象</strong><h3>自分に合った商品を選べる</h3><p>人気商品から定番アイテムまで、幅広いラインナップから提案可能。</p></article>
            <article><div><span>03</span><Users /></div><strong>CREATOR SUPPORT</strong><h3>配信をしっかりサポート</h3><p>商品サンプル・販売素材・商品情報など、配信に必要なサポートをご用意。</p></article>
          </div>
        </DrKozuSection>

        <DrKozuSection id="products" eyebrow="BRAND DAY PICK UP ITEMS" title="ライブで紹介しやすい、注目アイテム。" intro="まずは4つのピックアップから。自分の配信スタイルや視聴者に合う商品を見つけてください。">
          <div className="drkozu-products drkozu-products-pickup" data-testid="drkozu-pick-up-products">{pickUpProducts.map((product, index) => <DrKozuProductCard key={product.name} product={product} index={index} featured />)}</div>
          <button type="button" className="drkozu-products-toggle" aria-expanded={showAllProducts} aria-controls="drkozu-all-products" onClick={() => setShowAllProducts(value => !value)}>
            <span>{showAllProducts ? "閉じる" : "すべての商品を見る"}</span><ChevronDown aria-hidden="true" />
          </button>
          {showAllProducts && <div className="drkozu-products-all" id="drkozu-all-products"><p>ALL BRAND DAY ITEMS · 残り8商品</p><div className="drkozu-products" data-testid="drkozu-all-products-grid">{otherProducts.map((product, index) => <DrKozuProductCard key={product.name} product={product} index={index + pickUpProducts.length} />)}</div></div>}
        </DrKozuSection>

        <DrKozuSection id="brand" eyebrow="WHY DR.KOZU" title="プロのサロンケアを、毎日のホームケアへ。" intro="Dr.Kozuは、美容サロンで培われた知見をもとに、肌悩みに寄り添うスキンケアを提案するブランドです。">
          <div className="drkozu-story">
            <div className="drkozu-story-image"><img src={DRKOZU_ASSETS.founder} alt="Dr.Kozu 創業者 里見こず絵" loading="lazy" /></div>
            <div className="drkozu-story-copy"><p className="drkozu-quote">“未来のあなたを想像する。”</p><p className="drkozu-story-lead">現場の経験から生まれた、<br />伝えやすく、魅力を届けやすいスキンケア。</p><div className="drkozu-proof"><article><strong>18年</strong><span>美容業界の現場経験</span></article><article><strong>月平均240名</strong><span>サロン施術人数</span></article><article><strong>4店舗</strong><span>滋賀・京都の直営サロン</span></article><article><strong>2024.07</strong><span>Dr.Kozuブランド設立</span></article></div></div>
          </div>
        </DrKozuSection>

        <DrKozuSection id="flow" eyebrow="HOW TO JOIN" title="参加方法は簡単" intro="商品を選び、ライブや動画で魅力を届け、BRAND DAYのGMVランキングに参加してください。">
          <div className="drkozu-flow"><DrKozuStep n="01" icon={Sparkles} title="商品を選ぶ" text="Dr.Kozuの商品から配信・投稿商品を選択。" /><DrKozuStep n="02" icon={Radio} title="ライブ・動画で紹介" text="BRAND DAY期間中にDr.Kozu商品を紹介・販売。" /><DrKozuStep n="03" icon={BarChart3} title="GMVランキングに参加" text="期間中の有効GMVを集計し、ランキングを決定。" /><DrKozuStep n="04" icon={Award} title="上位入賞で賞金GET" text="ランキングと所定のGMV条件に応じて賞金を進呈。" /></div>
          <div className="drkozu-safety"><ShieldCheck /><div><strong>売上データ提出について</strong><p>配信・投稿後は、指定画面からTikTok Shopの売上データをご提出ください。AI読取後に本人確認し、確認済みデータだけをランキングへ反映します。</p></div></div>
        </DrKozuSection>

        <DrKozuSection id="rules" eyebrow="OFFICIAL RULES" title="GMVランキング 公式ルール" intro="参加条件、賞金のGMV条件、順位決定方法はこちらからご確認いただけます。">
          <details className="drkozu-rules-disclosure" data-testid="drkozu-rules-disclosure">
            <summary><span>ルール詳細を見る</span><b aria-hidden="true">＋</b></summary>
            <div className="drkozu-rules" data-testid="drkozu-gmv-challenge-rules">
              <div className="drkozu-rule-summary">
                <article><CalendarDays /><span>開催期間</span><strong>2026.10.05 00:00<br />— 10.12 23:59</strong><small>日本時間（JST）</small></article>
                <article><BarChart3 /><span>ランキング基準</span><strong>Dr.Kozu<br />累計有効GMV</strong><small>高い順に順位を決定</small></article>
                <article><Gift /><span>賞金総額</span><strong>最大<br />¥180,000</strong><small>各賞金枠1名限定</small></article>
              </div>

              <div className="drkozu-rule-grid">
                <article className="drkozu-rule-card">
                  <p>01</p><h3>開催期間</h3>
                  <div>2026年10月5日 00:00から10月12日 23:59まで（日本時間）を集計対象期間とします。</div>
                </article>

                <article className="drkozu-rule-card">
                  <p>02</p><h3>GMVの集計範囲</h3>
                  <div>期間中に参加クリエイターが販売した、Dr.Kozu公式ショップの全商品にかかる累計有効GMVを集計します。</div>
                  <ul><li>返品・キャンセル等の無効取引は対象外です。</li><li>最終数値はTikTok Shop管理画面の確定データを使用します。</li></ul>
                </article>

                <article className="drkozu-rule-card">
                  <p>03</p><h3>ランキングの決定方法</h3>
                  <div>累計有効GMVの高い順に順位を決定します。同額の場合は、次の順で上位を決定します。</div>
                  <ol><li>期間中の累計有効ライブ時間が長い方</li><li>それも同じ場合、同額GMVへより早く到達した方</li></ol>
                </article>

                <article className="drkozu-rule-card">
                  <p>04</p><h3>賞金枠とGMV条件</h3>
                  <div className="drkozu-rule-tiers">
                    {DRKOZU_BRAND_DAY_PROFILE.prizeTiers.map(tier => <div key={tier.prize}><span>GMV ¥{tier.minimumGmv.toLocaleString("ja-JP")}以上</span><strong>賞金 ¥{tier.prize.toLocaleString("ja-JP")}</strong></div>)}
                  </div>
                  <small>賞金総額は最大18万円です。ランキング順位だけで賞金が確定するものではありません。</small>
                </article>

                <article className="drkozu-rule-card drkozu-rule-card-wide">
                  <p>05</p><h3>賞金判定と繰り下げルール</h3>
                  <div>GMV順位の上位者から順に、その方が達成した最高の空き賞金枠を割り当てます。同一人物の受賞は1枠のみ、各賞金枠の受賞者も1名のみです。上位者が優先対象のGMVに届かない場合は、達成済みの次の賞金枠へ自動的に繰り下げて判定します。</div>
                  <div className="drkozu-rule-example">
                    <strong>判定例</strong>
                    <div><span>GMV 1位 · 55万円</span><b>5万円賞金</b></div>
                    <div><span>GMV 2位 · 45万円</span><b>3万円賞金</b></div>
                    <div><span>GMV 3位 · 35万円</span><b>受賞なし</b></div>
                    <small>3万円枠は、より上位の2位が先に獲得するため、3位には重複して付与されません。</small>
                  </div>
                </article>

                <article className="drkozu-rule-card">
                  <p>06</p><h3>有効ライブ時間</h3>
                  <div>次の2条件を同時に満たす配信を有効ライブとして扱います。</div>
                  <ul><li>1回のライブ配信が60分以上</li><li>配信中にDr.Kozu商品の販売実績がある</li></ul>
                  <small>ライブ時間は主順位には使わず、GMV同額時の判定にのみ使用します。</small>
                </article>

                <article className="drkozu-rule-card">
                  <p>07</p><h3>データ確定と結果発表</h3>
                  <ul><li>GMV・配信データはTikTok Shopの最終確定値を使用します。</li><li>返品、キャンセル、異常注文、虚偽取引等のGMVは除外します。</li><li>イベント終了後、データ確認を完了してから最終順位と賞金結果を発表します。</li></ul>
                </article>

                <article className="drkozu-rule-card drkozu-rule-card-wide drkozu-rule-card-summary">
                  <p>08</p><h3>賞金ルールまとめ</h3>
                  <div className="drkozu-rule-thresholds"><span>GMV 100万円以上<strong>最高10万円</strong></span><span>GMV 50万円以上<strong>最高5万円</strong></span><span>GMV 30万円以上<strong>最高3万円</strong></span><span>GMV 30万円未満<strong>賞金対象外</strong></span></div>
                  <div>最終順位はGMVが第一優先です。GMV順位順に賞金枠を判定し、各枠は1名のみ受賞できます。</div>
                </article>
              </div>
            </div>
          </details>
        </DrKozuSection>

        <section className="drkozu-final"><div><p>2026.10.05 — 10.12 · 8 DAYS ONLY</p><span className="drkozu-final-label">Dr.Kozu BRAND DAY</span><h2>美しさの本質を、<br />ライブで届けよう。</h2><div className="drkozu-final-offer"><strong>最大50%OFF</strong><i>＋</i><span>LIVE SALES<br />PK CHALLENGE</span></div><div className="drkozu-final-total">賞金総額 <strong>最大18万円</strong></div><div className="drkozu-final-prizes">{DRKOZU_BRAND_DAY_PROFILE.prizes.map((prize, index) => <span key={prize}>第{index + 1}位 <strong>{prize.toLocaleString("ja-JP")}円</strong></span>)}</div><Link href={`${base}/entry`} className="drkozu-button drkozu-button-primary"><Sparkles />BRAND DAYに参加する</Link><small>※賞金の受取には所定のGMV条件があります。</small></div></section>
      </main>
      <footer className="drkozu-footer"><img src={DRKOZU_ASSETS.logo} alt="Dr.Kozu" /><p>© 2026 Dr.Kozu · BRAND DAY</p><div><Link href={`${base}/ranking`}>ランキング</Link><Link href={`${base}/creator/login`}>出場者ログイン</Link></div></footer>
    </div>
  );
}

function DrKozuSection({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return <section id={id} className="drkozu-section"><div className="drkozu-section-heading"><p>{eyebrow}</p><h2>{title}</h2>{intro && <span>{intro}</span>}</div>{children}</section>;
}

function DrKozuCountdown({ value, label }: { value: number; label: string }) {
  return <div><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>;
}

function DrKozuProductCard({ product, index, featured = false }: { product: DrKozuProduct; index: number; featured?: boolean }) {
  const content = <>
    <div className="drkozu-product-image"><img src={product.image} alt={product.name} loading="lazy" /></div>
    <p>{String(index + 1).padStart(2, "0")} · {featured ? "PICK UP" : (product.badge ?? "BRAND DAY")}</p>
    <h3>{product.name}</h3>
    <span>{product.meta}</span>
    <div className="drkozu-product-copy">{product.copy}</div>
    {product.href && <span className="drkozu-product-link">TikTok Shopで見る <ExternalLink aria-hidden="true" /></span>}
  </>;

  if (product.href) {
    return <a className={`drkozu-product drkozu-product-clickable${featured ? " drkozu-product-featured" : ""}`} href={product.href} target="_blank" rel="noopener noreferrer" aria-label={`${product.name}をTikTok Shopで見る`}>{content}</a>;
  }
  return <article className={`drkozu-product${featured ? " drkozu-product-featured" : ""}`}>{content}</article>;
}

function DrKozuStep({ n, icon: IconComponent, title, text }: { n: string; icon: Icon; title: string; text: string }) {
  return <article><div><span>STEP {n}</span><IconComponent /></div><h3>{title}</h3><p>{text}</p></article>;
}

function KgdayPortal({ info }: { info: EventInfo }) {
  const [remaining, setRemaining] = useState(() => getCountdown(info.eventStartAt));
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getCountdown(info.eventStartAt)), 1_000);
    return () => window.clearInterval(timer);
  }, [info.eventStartAt]);
  useEffect(() => {
    const previousTitle = document.title;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = themeMeta?.content;
    document.title = "KYOGOKU クリエイター頂上決戦 | LCJ BRAND DAY";
    if (themeMeta) themeMeta.content = "#07000f";
    return () => {
      document.title = previousTitle;
      if (themeMeta && previousTheme) themeMeta.content = previousTheme;
    };
  }, []);

  const displayDays = info.days.filter(day => new Date(day.startAt).getTime() < new Date(info.eventEndAt).getTime());
  const firstDay = formatDay(displayDays[0]?.startAt ?? info.eventStartAt, info.timezone);
  const lastDay = formatDay(displayDays.at(-1)?.startAt ?? new Date(new Date(info.eventEndAt).getTime() - 1), info.timezone);
  const base = `/brand-day/${info.slug}`;

  return (
    <div className="kgday-public-page">
      <div className="kgday-public-backdrop" aria-hidden="true" />
      <div className="kgday-public-vignette" aria-hidden="true" />
      <div className="kgday-public-stars kgday-public-stars-a" aria-hidden="true" />
      <div className="kgday-public-stars kgday-public-stars-b" aria-hidden="true" />
      <div className="kgday-public-content">
        <KgdayNav base={base} />
        <main>
          <section className="kgday-public-hero" id="top">
            <div className="kgday-public-hero-logo"><KgLogo /></div>
            <div className="kgday-public-hero-inner">
              <p className="kgday-public-tech kgday-public-eyebrow">CREATOR CLASH</p>
              <h1 className="kgday-public-hero-title">
                <span>KYOGOKUクリエイター</span>
                <span className="kgday-public-gold-text kgday-public-hero-gold">頂上決戦</span>
                <span className="kgday-public-pink-text kgday-public-hero-pink">ランキングバトル</span>
              </h1>
              <p className="kgday-public-hero-copy">3日間で、100万円を売り上げて、<br className="kgday-public-mobile-break" />配信を、そのまま賞金に変えよう。</p>
              <Panel gold className="kgday-public-challenge-panel">
                <p className="kgday-public-tech kgday-public-challenge-title"><Zap />3 DAYS CHALLENGE<Zap /></p>
                <p className="kgday-public-challenge-date">
                  {firstDay.date} <span>[{firstDay.weekday}]</span><b>→</b>{lastDay.date} <span>[{lastDay.weekday}]</span><em>【{displayDays.length}日間】</em>
                </p>
              </Panel>
              <div className="kgday-public-countdown" aria-label="イベント開始までのカウントダウン">
                <CountdownBox value={remaining.days} label="DAYS" />
                <CountdownBox value={remaining.hours} label="HOURS" />
                <CountdownBox value={remaining.minutes} label="MIN" />
                <CountdownBox value={remaining.seconds} label="SEC" />
              </div>
              <Link href={`${base}/entry`} className="kgday-public-pink-button kgday-public-hero-cta"><Zap />今すぐエントリー</Link>
            </div>
          </section>

          <PageSection id="overview" eyebrow="ABOUT THE CLASH" title="3日間だけ開く、賞金アリーナ">
            <p className="kgday-public-section-copy">KYOGOKU BRAND DAY 2026 は、TikTok LIVE で KYOGOKU 商品を紹介するクリエイターが、売上と配信時間の2軸で競う短期集中ランキングバトル。配信実績を毎日提出し、本人確認後に確定した数字がリアルタイム順位へ反映されます。</p>
            <div className="kgday-public-metrics">
              <Metric value="3" unit="日間" label="集中チャレンジ" />
              <Metric value="2" unit="部門" label="ランキング" pink />
              <Metric value="100" unit="万円" label="売上チャレンジ" />
              <Metric value="205" unit="万円" label="最大賞金総額" pink />
            </div>
          </PageSection>

          <PageSection id="prize" eyebrow="PRIZE" title="配信実績が、そのまま賞金になる">
            <div className="kgday-public-prizes">
              <PrizeCard icon={Crown} title="KG 商品売上ランキング" amount="1位 ¥1,000,000" text="2位 ¥500,000 ／ 3位 ¥100,000" />
              <PrizeCard icon={Clock3} title="配信時間ランキング" amount="1位 ¥200,000" text="2位 ¥150,000 ／ 3位 ¥100,000" />
            </div>
          </PageSection>

          <PageSection id="benefits" eyebrow="MERIT" title="挑戦するほど、次の機会につながる">
            <div className="kgday-public-features">
              <Feature icon={Trophy} title="賞金獲得" text="売上と配信時間、2つのランキングから受賞チャンス。" />
              <Feature icon={BarChart3} title="リアルタイム順位" text="本人確認後に確定した順位を公開ページで随時確認できます。" />
              <Feature icon={Rocket} title="継続コラボ" text="配信実績は今後の KYOGOKU 企画選考にも活用されます。" />
            </div>
          </PageSection>

          <PageSection id="conditions" eyebrow="ENTRY CONDITIONS" title="参加条件">
            <div className="kgday-public-conditions">
              <Condition n="01" text="大会期間中の確定 KG 商品 GMV が合計 50万円以上" />
              <Condition n="02" text="DAY 1–3 の毎日、有効配信時間が4時間以上" />
              <Condition n="03" text="3日間の有効配信時間が合計12時間以上" />
              <Condition n="04" text="1回60分以上のTikTok LIVEでKYOGOKU商品を紹介" />
            </div>
          </PageSection>

          <PageSection id="criteria" eyebrow="JUDGING" title="審査基準">
            <div className="kgday-public-criteria">
              <Panel className="kgday-public-criteria-main">
                <h3>AI読み取り後に本人が内容を確認</h3>
                <p>TikTok LIVE の分析画面から商品別 GMV、配信時間、合計 GMV を読み取り、本人が KYOGOKU 商品と配信日時を確認。対象時間内の記録は確定後すぐにランキングへ反映され、日時不明・対象期間外・異常データは管理者確認へ進みます。</p>
                <div className="kgday-public-scores">
                  <ScoreBar label="KYOGOKU 商品 GMV" value={65} />
                  <ScoreBar label="配信時間" value={25} />
                  <ScoreBar label="提出の正確性" value={10} />
                </div>
              </Panel>
              <Panel gold className="kgday-public-criteria-side">
                <ShieldCheck />
                <p className="kgday-public-tech">VALID DATA AUTO REFLECTED</p>
                <h3>確認後すぐに自動確定</h3>
                <p>正常な配信は即時反映。時間外・日時不明・異常データだけを運営が原画像とともに確認します。</p>
              </Panel>
            </div>
          </PageSection>

          <PageSection id="streaming" eyebrow="HOW TO STREAM" title="参加からランキング反映まで">
            <div className="kgday-public-flow">
              <Flow n="01" icon={Users} title="エントリー" text="基本情報とDashboard用パスワードを登録" />
              <Flow n="02" icon={Radio} title="TikTok LIVE" text="対象商品を紹介して配信" />
              <Flow n="03" icon={Sparkles} title="AI読み取り" text="分析画面のスクリーンショットを提出" />
              <Flow n="04" icon={Award} title="確定・反映" text="有効データは即時反映、異常時は運営確認" />
            </div>
          </PageSection>

          <PageSection id="faq" eyebrow="FAQ" title="よくある質問">
            <div className="kgday-public-faqs">
              <Faq q="エントリー後、すぐにDashboardを使えますか？" a="登録した TikTok ID とパスワードでログインできます。運営から連絡がある場合は登録メールまたはLINE IDへご案内します。" />
              <Faq q="売上はどの数字がランキング対象ですか？" a="TikTok LIVE分析画面から読み取り、本人が確認したKYOGOKU商品のGMVが対象です。対象時間内の正常な記録は確認後すぐに反映されます。" />
              <Faq q="時間が対象外、またはAIで読み取れない場合は？" a="記録は削除されず管理者確認待ちになります。運営が原画像・日時・GMV・商品を確認し、承認後にランキングへ反映します。" />
              <Faq q="提出後に修正できますか？" a="出場者Dashboardの提出履歴から修正できます。管理者確認中または確定後の例外修正は、運営が根拠画像と監査記録を確認して対応します。" />
            </div>
          </PageSection>

          <section className="kgday-public-final-cta">
            <Panel gold className="kgday-public-final-panel">
              <Gift />
              <p className="kgday-public-tech">ENTRY CLOSES {formatClose(info.registrationCloseAt, info.timezone)} JST</p>
              <h2 className="kgday-public-gold-text">挑戦の準備はできましたか？</h2>
              <p>基本情報とDashboard用パスワードを登録すると、すぐに出場者Dashboardを利用できます。</p>
              <Link href={`${base}/entry`} className="kgday-public-pink-button"><Zap />エントリーフォームへ</Link>
            </Panel>
          </section>

          <footer className="kgday-public-footer">
            <p>© 2026 KYOGOKU PROFESSIONAL · CREATOR CLASH</p>
            <div>
              <Link href={`${base}/ranking`}>リアルタイム順位</Link>
              <Link href={`${base}/creator/login`}>出場者ログイン</Link>
              <Link href="/master/brand-days">運営管理</Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function KgdayNav({ base }: { base: string }) {
  const anchors = [["大会概要", "overview"], ["賞金", "prize"], ["メリット", "benefits"], ["参加条件", "conditions"], ["審査基準", "criteria"], ["配信方法", "streaming"], ["FAQ", "faq"]] as const;
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <header className="kgday-public-nav-shell">
      <div className="kgday-public-promo-bar">
        <span className="kgday-public-promo-side">KYOGOKU BRAND DAY 2026</span>
        <Link href={`${base}/entry`} className="kgday-public-neon-button"><Zap />今すぐエントリー<Zap /></Link>
        <span className="kgday-public-promo-side kgday-public-promo-right">2026.09.08–09.10</span>
      </div>
      <nav className="kgday-public-main-nav">
        <a href="#top" aria-label="KGDAY トップ"><KgLogo compact /></a>
        <div className="kgday-public-nav-links">
          {anchors.map(([label, id]) => <button type="button" key={id} onClick={() => go(id)}>{label}</button>)}
          <Link href={`${base}/ranking`} className="kgday-public-ranking-link">リアルタイム順位</Link>
          <Link href={`${base}/creator/login`} className="kgday-public-login-link"><LogIn />出場者ログイン</Link>
        </div>
      </nav>
    </header>
  );
}

function KgLogo({ compact = false }: { compact?: boolean }) {
  return <span className={`kgday-public-logo ${compact ? "kgday-public-logo-compact" : ""}`}><img src={KG_LOGO_URL} alt="KG KYOGOKU PROFESSIONAL" /></span>;
}

function Panel({ children, className = "", gold = false }: { children: ReactNode; className?: string; gold?: boolean }) {
  return <div className={`kgday-public-panel ${gold ? "kgday-public-panel-gold" : ""} ${className}`}>{children}</div>;
}

function PageSection({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return <section id={id} className="kgday-public-section"><div className="kgday-public-section-inner"><div className="kgday-public-section-heading"><p className="kgday-public-tech">{eyebrow}</p><h2 className="kgday-public-gold-text">{title}</h2></div><div className="kgday-public-section-body">{children}</div></div></section>;
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return <Panel className="kgday-public-count-box"><p className="kgday-public-tech">{String(value).padStart(2, "0")}</p><span>{label}</span></Panel>;
}

function Metric({ value, unit, label, pink = false }: { value: string; unit: string; label: string; pink?: boolean }) {
  return <Panel className="kgday-public-metric"><p className={`kgday-public-tech ${pink ? "kgday-public-pink-text" : "kgday-public-gold-text"}`}>{value}<span>{unit}</span></p><small>{label}</small></Panel>;
}

type Icon = ComponentType<{ className?: string }>;
function PrizeCard({ icon: IconComponent, title, amount, text }: { icon: Icon; title: string; amount: string; text: string }) {
  return <Panel gold className="kgday-public-prize-card"><IconComponent /><h3>{title}</h3><p className="kgday-public-gold-text kgday-public-tech">{amount}</p><small>{text}</small></Panel>;
}

function Feature({ icon: IconComponent, title, text }: { icon: Icon; title: string; text: string }) {
  return <Panel className="kgday-public-feature"><span><IconComponent /></span><h3>{title}</h3><p>{text}</p></Panel>;
}

function Condition({ n, text }: { n: string; text: string }) {
  return <Panel className="kgday-public-condition"><span className="kgday-public-tech">{n}</span><p>{text}</p></Panel>;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return <div className="kgday-public-score"><div><span>{label}</span><b className="kgday-public-tech">{value}%</b></div><p><i style={{ width: `${value}%` }} /></p></div>;
}

function Flow({ n, icon: IconComponent, title, text }: { n: string; icon: Icon; title: string; text: string }) {
  return <Panel className="kgday-public-flow-card"><div><span className="kgday-public-tech">STEP {n}</span><IconComponent /></div><h3>{title}</h3><p>{text}</p></Panel>;
}

function Faq({ q, a }: { q: string; a: string }) {
  return <details className="kgday-public-panel kgday-public-faq"><summary><span>{q}</span><ChevronDown /></summary><p>{a}</p></details>;
}

function GenericBrandDayPortal({ info }: { info: EventInfo }) {
  const base = `/brand-day/${info.slug}`;
  return (
    <main className="brand-day-generic-page">
      <div className="brand-day-generic-inner">
        <nav><p>LCJ BRAND DAY</p><div><Link href={`${base}/ranking`}>ランキング</Link><Link href={`${base}/creator/login`}>出場者ログイン</Link></div></nav>
        <section>
          <div><p>{info.challenge}</p><h1>{info.title}</h1><h2>{info.subtitle}</h2><aside className="mt-6 max-w-xl rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50"><strong className="text-emerald-200">外部参加者専用 / 外部报名者专用</strong><br />LCJ MALLの管理者・スタッフアカウントは不要です。公開エントリー後、登録したTikTok IDとパスワードで独立した出場者ページへログインできます。</aside><div><Link href={`${base}/entry`}>公開エントリー</Link><Link href={`${base}/creator/login`}>出場者専用ログイン</Link></div></div>
          <Panel><CalendarDays /><p>{new Date(info.eventStartAt).toLocaleString("ja-JP", { timeZone: info.timezone })} 〜<br />{new Date(info.eventEndAt).toLocaleString("ja-JP", { timeZone: info.timezone })}</p></Panel>
        </section>
      </div>
    </main>
  );
}

export function PortalLoading() { return <div className="brand-day-portal-state">読み込み中…</div>; }
export function PortalError({ message }: { message: string }) { return <div className="brand-day-portal-state brand-day-portal-error">{message}</div>; }
