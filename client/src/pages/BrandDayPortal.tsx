import { Link, useParams } from "wouter";
import {
  Award,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  Crown,
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

const DRKOZU_ASSETS = {
  logo: "/brand-day/drkozu/drkozu-logo.webp",
  hero: "/brand-day/drkozu/drkozu-hero.webp",
  founder: "/brand-day/drkozu/drkozu-founder.webp",
  products: [
    { image: "/brand-day/drkozu/vampire-mask.webp", name: "ヴァンパイアマスク", meta: "6回分 · ¥15,950", copy: "パウダーとセラムを混ぜ、20分。自宅で楽しむサロン発想の集中ケア。" },
    { image: "/brand-day/drkozu/cell-peel-crystal.webp", name: "セルピール #クリスタル", meta: "4回分 · ¥13,200", copy: "角質をやさしく整え、なめらかな触り心地と透明感のある印象へ。" },
    { image: "/brand-day/drkozu/repair-clear-wash.webp", name: "リペアクリアウォッシュ", meta: "洗浄ケア", copy: "濃密な泡で摩擦を抑えながら、毎日の洗浄を心地よい美容習慣へ。" },
    { image: "/brand-day/drkozu/beauty-soy-protein.webp", name: "ビューティソイプロテイン", meta: "500g · ¥8,856", copy: "美容と健康を支えるたんぱく質を、おいしく続けやすい一杯に。" },
  ],
} as const;

function DrKozuPortal({ info }: { info: EventInfo }) {
  const [remaining, setRemaining] = useState(() => getCountdown(info.eventStartAt));
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getCountdown(info.eventStartAt)), 1_000);
    return () => window.clearInterval(timer);
  }, [info.eventStartAt]);

  const displayDays = info.days.filter(day => new Date(day.startAt).getTime() < new Date(info.eventEndAt).getTime());
  const firstDay = formatDay(displayDays[0]?.startAt ?? info.eventStartAt, info.timezone);
  const lastDay = formatDay(displayDays.at(-1)?.startAt ?? new Date(new Date(info.eventEndAt).getTime() - 1), info.timezone);
  const base = `/brand-day/${info.slug}`;
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="drkozu-page">
      <header className="drkozu-nav">
        <a href="#top" className="drkozu-nav-logo"><img src={DRKOZU_ASSETS.logo} alt="Dr.Kozu The Quintessence of Beauty" /></a>
        <nav aria-label="Dr.Kozu Brand Day">
          <button type="button" onClick={() => go("brand")}>ブランド</button>
          <button type="button" onClick={() => go("products")}>対象商品</button>
          <button type="button" onClick={() => go("prize")}>賞金</button>
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
            <p className="drkozu-tagline">プロのサロンケアを、<br />毎日のホームケアへ。</p>
            <div className="drkozu-offer"><span>BRAND DAY 限定</span><strong>50<em>% OFF</em></strong></div>
            <p className="drkozu-date">{firstDay.date} <span>{firstDay.weekday}</span><b>—</b>{lastDay.date} <span>{lastDay.weekday}</span></p>
            <p className="drkozu-lead">洗浄・角質ケア・補修・集中ケア・インナービューティー。Dr.Kozuのトータルケアを、ライブでわかりやすく届ける8日間。</p>
            <div className="drkozu-actions"><Link href={`${base}/entry`} className="drkozu-button drkozu-button-primary"><Sparkles />ライブ配信に参加する</Link><Link href={`${base}/ranking`} className="drkozu-button drkozu-button-secondary"><Trophy />ランキングを見る</Link></div>
            <div className="drkozu-countdown" aria-label="イベント開始までのカウントダウン">
              <DrKozuCountdown value={remaining.days} label="DAYS" /><DrKozuCountdown value={remaining.hours} label="HOURS" /><DrKozuCountdown value={remaining.minutes} label="MIN" /><DrKozuCountdown value={remaining.seconds} label="SEC" />
            </div>
          </div>
          <div className="drkozu-hero-visual"><div className="drkozu-pearl" aria-hidden="true" /><img src={DRKOZU_ASSETS.hero} alt="Dr.Kozuのスキンケア・集中ケア製品" /><p><span>LIMITED</span> 2026.10.05 — 10.12</p></div>
        </section>

        <section className="drkozu-strip" aria-label="キャンペーン概要"><p>8 DAYS</p><i /><p>50% OFF</p><i /><p>LIVE COMMERCE</p><i /><p>PROFESSIONAL CARE</p></section>

        <DrKozuSection id="prize" eyebrow="PRIZE" title="GMV達成者に、最大10万円。" intro="GMV順位を優先し、上位者から実際に達成した最高の空き賞金枠を判定します。各賞金枠は1名限定、賞金総額は最大18万円です。">
          <div className="drkozu-prizes">
            {DRKOZU_BRAND_DAY_PROFILE.prizeTiers.map((tier, index) => <div className={`drkozu-prize drkozu-prize-${index + 1}`} key={tier.prize}><span>GMV<small>達成条件</small></span><p>¥{tier.minimumGmv.toLocaleString("ja-JP")}+</p><strong>賞金 ¥{tier.prize.toLocaleString("ja-JP")}</strong><em>1 WINNER PER PRIZE TIER</em></div>)}
          </div>
        </DrKozuSection>

        <DrKozuSection id="rules" eyebrow="OFFICIAL RULES" title="GMVランキングチャレンジ 公式ルール" intro="参加前に必ずご確認ください。ランキングと賞金は、TikTok Shopで最終確定した有効なDr.KozuブランドGMVを基準に判定します。">
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
                <p>04</p><h3>賞金設定</h3>
                <div className="drkozu-rule-tiers">
                  {DRKOZU_BRAND_DAY_PROFILE.prizeTiers.map(tier => <div key={tier.prize}><span>GMV ¥{tier.minimumGmv.toLocaleString("ja-JP")}以上</span><strong>賞金 ¥{tier.prize.toLocaleString("ja-JP")}</strong></div>)}
                </div>
                <small>賞金総額は最大18万円です。</small>
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
        </DrKozuSection>

        <DrKozuSection id="brand" eyebrow="ABOUT DR.KOZU" title="隠すのではなく、肌と向き合う。" intro="18年間のサロン現場で積み重ねた肌観察を、毎日続けられる製品へ。Dr.Kozuは、プロのケアをわかりやすく再構築します。">
          <div className="drkozu-story">
            <div className="drkozu-story-image"><img src={DRKOZU_ASSETS.founder} alt="Dr.Kozu 創業者 里見こず絵" /></div>
            <div className="drkozu-story-copy"><p className="drkozu-quote">“未来のあなたを想像する。”</p><div className="drkozu-proof"><article><strong>18年</strong><span>美容業界の現場経験</span></article><article><strong>月平均240名</strong><span>サロン施術人数</span></article><article><strong>4店舗</strong><span>滋賀・京都の直営サロン</span></article><article><strong>2024.07</strong><span>Dr.Kozuブランド設立</span></article></div></div>
          </div>
        </DrKozuSection>

        <DrKozuSection id="products" eyebrow="PRODUCT SELECTION" title="プロ発想のケアを、Brand Dayで。" intro="主力製品を入口に、落とす・整える・育てる・内側から支えるケアを紹介します。">
          <div className="drkozu-products">{DRKOZU_ASSETS.products.map((product, index) => <article className="drkozu-product" key={product.name}><div className="drkozu-product-image"><img src={product.image} alt={product.name} /></div><p>0{index + 1} · FEATURED</p><h3>{product.name}</h3><span>{product.meta}</span><div>{product.copy}</div></article>)}</div>
        </DrKozuSection>

        <DrKozuSection id="method" eyebrow="TOTAL CARE METHOD" title="一つひとつに、意味のあるケアを。">
          <div className="drkozu-method">{[["01","落とす","メイク・皮脂・日常の汚れをやさしくオフ。"],["02","整肌","保湿とバリアケアで、健やかな状態へ。"],["03","育てる","その日の肌に合わせた集中ケアを。"],["04","インナーケア","美容栄養を毎日の習慣にプラス。"]].map(([n,title,text])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </DrKozuSection>

        <DrKozuSection id="flow" eyebrow="HOW TO JOIN" title="エントリーからランキング反映まで。" intro="Dr.Kozu BRAND DAY専用の独立した出場者フロー。一般の管理者アカウントは不要です。">
          <div className="drkozu-flow"><DrKozuStep n="01" icon={Users} title="エントリー" text="TikTok IDと専用パスワードを登録" /><DrKozuStep n="02" icon={Radio} title="ライブ配信" text="対象のDr.Kozu商品をライブで紹介" /><DrKozuStep n="03" icon={Sparkles} title="データ提出" text="TikTok Shopのライブ大画面をアップロード" /><DrKozuStep n="04" icon={Award} title="確認・反映" text="AI読取後に本人確認し、ランキングへ反映" /></div>
          <div className="drkozu-safety"><ShieldCheck /><div><strong>確認できるデータだけを反映</strong><p>日時不明・対象期間外・読み取り異常は削除せず管理者確認へ。原画像、修正、承認履歴を保持します。</p></div></div>
        </DrKozuSection>

        <section className="drkozu-final"><div><p>2026.10.05 — 10.12</p><h2>美しさの本質を、<br />ライブで届けよう。</h2><span>DR.KOZU BRAND DAY · 50% OFF</span><Link href={`${base}/entry`} className="drkozu-button drkozu-button-primary"><Sparkles />エントリーする</Link></div></section>
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
