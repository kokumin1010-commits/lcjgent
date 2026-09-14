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
  const event = trpc.brandDay.publicPortal.event.useQuery({ slug }, { enabled: Boolean(slug) });
  if (event.isLoading) return <PortalLoading />;
  if (!event.data) return <PortalError message={event.error?.message || "ブランドデーが見つかりません"} />;

  const info = event.data as EventInfo;
  return slug === KGDAY_SLUG ? <KgdayPortal info={info} /> : <GenericBrandDayPortal info={info} />;
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
          <div><p>{info.challenge}</p><h1>{info.title}</h1><h2>{info.subtitle}</h2><div><Link href={`${base}/entry`}>エントリーする</Link><Link href={`${base}/creator/login`}>大画面を提出</Link></div></div>
          <Panel><CalendarDays /><p>{new Date(info.eventStartAt).toLocaleString("ja-JP", { timeZone: info.timezone })} 〜<br />{new Date(info.eventEndAt).toLocaleString("ja-JP", { timeZone: info.timezone })}</p></Panel>
        </section>
      </div>
    </main>
  );
}

export function PortalLoading() { return <div className="brand-day-portal-state">読み込み中…</div>; }
export function PortalError({ message }: { message: string }) { return <div className="brand-day-portal-state brand-day-portal-error">{message}</div>; }
