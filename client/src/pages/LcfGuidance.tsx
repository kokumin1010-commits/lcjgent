/**
 * LCF Guidance — ライバー向け当日ガイド
 * Design reference: the supplied LCF2026 liver guide PDF is the ground truth.
 * Visual system: near-black canvas, restrained champagne-gold rules, editorial typography,
 * asymmetric section headers, sharp information cards, and mobile-first scanability.
 * URL: /lcf/guidance
 */
import { useEffect } from "react";
import {
  ArrowUp,
  BadgeHelp,
  CameraOff,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  QrCode,
  Radio,
  Smartphone,
  TrainFront,
} from "lucide-react";

const GUIDE_ASSETS = {
  floor5: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/TdiRTFkuiHmEAMEO.jpg",
  floor6: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/gaIvmfdbVCEFthKR.jpg",
  venue5: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/CcAzPCUhkDEfoMIn.jpg",
  venue6: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vahzkFEDOXdiBSvN.jpg",
  layout5: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/iPUhmPMPGmAqLZvr.jpg",
  layout6: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/iOMOYGKWbswMeCUs.jpg",
  gmv1: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ONsiSbHsIErUTKPj.jpg",
  gmv2: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/FssZreDNIlfsFInE.jpg",
  gmv3: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/TkFjmOtvOnlTyGod.jpg",
  gmv4: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/RjFQlJLINOgRaKXS.jpg",
  gmv5: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/QPjUOinBwaToEynf.jpg",
  gmv6: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/pfEUwxEZqpkUKunp.jpg",
  access: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vrXJrAwCzlhcpgGq.jpg",
} as const;

const NAV_ITEMS = [
  { id: "overview", label: "開催概要" },
  { id: "schedule", label: "スケジュール" },
  { id: "venue", label: "会場MAP" },
  { id: "guidance", label: "ガイダンス" },
  { id: "gmv", label: "GMV AWARD" },
  { id: "streaming", label: "配信スペース" },
  { id: "notes", label: "持ち物・注意事項" },
  { id: "support", label: "運営本部・アクセス" },
] as const;

const DAY1_PROGRAM = [
  ["14:00〜14:03", "オープニングトーク", "JOY、ゆん、景井ひな、プリンスこうや、京極琉"],
  ["14:03〜14:25", "出演者紹介", ""],
  ["14:25〜14:45", "LCF2026紹介 ＆ ライバー紹介", ""],
  ["14:45〜14:48", "協賛企業の紹介", "冠協賛企業"],
  ["14:48〜15:10", "スペシャルゲストトーク", "後藤真希、kana"],
  ["15:10〜15:30", "トップライバーによるライブコマース実演", ""],
  ["15:30〜15:36", "協賛企業の紹介", "プラチナ協賛企業"],
  ["15:36〜16:00", "話題・有名人紹介", "城咲仁、齋藤鷹一、toki、超無課金"],
  ["16:00〜16:15", "LCF2026 販売実績優秀ライバー紹介", ""],
  ["16:15〜16:21", "協賛企業の紹介", "プラチナ協賛企業"],
  ["16:21〜16:23", "プレゼントのお知らせ", "視聴者参加企画"],
  ["16:23〜16:30", "出演者による感想", ""],
] as const;

const DAY2_PROGRAM = [
  ["11:00〜11:15", "OPENING｜1日目総括 ＆ 2日目見どころ紹介", "プリンスこうや、京極琉"],
  ["11:15〜11:45", "TOPライバー対談①", "TOPライバーが語る、売れる秘訣とライブコマースの可能性｜プリンスこうや、京極琉"],
  ["12:15〜12:45", "メーカー公式講座", "メーカーTTS成功セミナー｜のむシリカ様"],
  ["13:15〜13:45", "プラットフォーム最前線対談", "TSP・メーカー・ライバーから見たライブコマースのリアル｜ULTRA SOCIAL株式会社（TSP）、CARiNOミゲル氏、Jayの視点氏"],
  ["14:15〜14:45", "ライブコマース専門家対談", "日本のライブコマース市場は本当に伸びるのか？｜山下智博氏、王明陽氏"],
  ["15:15〜15:45", "スペシャルゲスト講演", "調整中"],
  ["16:15〜16:45", "TOPコマーサー対談", "トップに立つまでの軌跡｜kana氏、toki氏"],
  ["16:45〜17:00", "ENDING｜2日間総括 ＆ フィナーレ", "プリンスこうや、京極琉、その他出演者"],
] as const;

const IMPORTANT_NOTES = [
  {
    number: "01",
    title: "入場・受付について",
    text: "入場時は必ずQRコードによる受付をお済ませください。受付後は、ライバー用ネックストラップを必ず着用してください。",
  },
  {
    number: "02",
    title: "撮影・SNS投稿について",
    text: "1日目の特別配信番組、2日目のセミナーは撮影・録画・SNS等への投稿を禁止します。他の出演者・ライバーを撮影する場合は必ず本人の許可を得てください。控室・関係者エリアなど、一般公開されていない場所の撮影・投稿は禁止です。",
  },
  {
    number: "03",
    title: "配信スペースについて",
    text: "各スペースに定められた利用ルールに従ってください。他のライバーの配信や利用の妨げにならないよう、周囲に配慮してご利用ください。",
  },
  {
    number: "04",
    title: "GMV AWARDについて",
    text: "集計対象は、当日出店している企業の商品によるGMVのみとなります。GMVの集計・判定は、運営側の集計結果を最終結果とします。",
  },
  {
    number: "05",
    title: "ライバー間のトラブルについて",
    text: "会場内で発生したライバー同士のトラブル・トラブルに起因する損害等について、運営側では一切の責任を負いかねます。運営に支障が生じる場合は、運営スタッフの指示に従ってください。",
  },
  {
    number: "06",
    title: "会場内でのお願い",
    text: "スタッフの案内・指示に従ってください。通路やステージ周辺を塞ぐなど、他の来場者の妨げとなる行為はお控えください。貴重品は各自で管理してください。",
  },
  {
    number: "07",
    title: "会場内での禁止事項・ご注意",
    text: "Uber Eatsなどの配送サービスの利用は禁止です。出展企業以外のメーカー企業との交流は禁止です。当日クロークのご用意はございませんので、お荷物は各自で管理してください。",
  },
] as const;

function SectionHeading({ number, eyebrow, title, description }: { number: string; eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-10 md:mb-14">
      <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-[#D9B447] uppercase">
        <span>{number}</span>
        <span className="h-px w-10 bg-[#D9B447]" aria-hidden="true" />
        <span>{eyebrow}</span>
      </div>
      <h2 className="mt-4 text-3xl font-light tracking-tight text-white md:text-5xl">{title}</h2>
      {description && <p className="mt-4 max-w-3xl text-sm leading-7 text-[#a7a7a3] md:text-base">{description}</p>}
    </div>
  );
}

function ScheduleTable({ rows }: { rows: readonly (readonly [string, string, string])[] }) {
  return (
    <div className="border border-white/10 bg-[#111111]">
      {rows.map(([time, title, detail]) => (
        <div key={`${time}-${title}`} className="grid gap-2 border-b border-white/10 px-5 py-5 last:border-b-0 md:grid-cols-[155px_1fr] md:gap-8 md:px-7">
          <time className="font-mono text-sm font-semibold text-[#E7C766]">{time}</time>
          <div>
            <h4 className="text-base font-semibold leading-6 text-white">{title}</h4>
            {detail && <p className="mt-1 text-sm leading-6 text-[#9d9d98]">{detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageCard({ src, alt, label }: { src: string; alt: string; label: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="group block border border-white/10 bg-[#101010] p-3 transition-colors duration-200 hover:border-[#D9B447]/70">
      <div className="flex min-h-52 items-center justify-center bg-white p-2 md:min-h-64">
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-auto max-h-[540px] w-full object-contain" />
      </div>
      <div className="flex items-center justify-between gap-4 px-1 pb-1 pt-4">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="inline-flex items-center gap-1 text-xs text-[#D9B447]">
          拡大表示 <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}

function ProgramDay({ day, date, title, children }: { day: string; date: string; title: string; children: React.ReactNode }) {
  return (
    <article className="border-t-2 border-[#D9B447] bg-[#0d0d0d] p-5 md:p-8">
      <div className="mb-7 flex flex-col gap-2 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#D9B447]">{day}</p>
          <h3 className="mt-2 text-2xl font-light text-white">{title}</h3>
        </div>
        <p className="text-sm text-[#c7c7c2]">{date}</p>
      </div>
      {children}
    </article>
  );
}

export default function LcfGuidance() {
  useEffect(() => {
    document.title = "LCF Guidance｜Live Commerce Festival 2026 ライバー向け当日ガイド";
    const description = "Live Commerce Festival 2026 ライバー向け当日ガイド。開催概要、スケジュール、会場MAP、配信ルール、持ち物、アクセスをご案内します。";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, []);

  return (
    <div id="top" className="min-h-screen bg-[#080808] text-[#f3f3ef] [font-family:'Noto_Sans_JP','Hiragino_Sans','Yu_Gothic',sans-serif]">
      <style>{`
        html { scroll-behavior: smooth; }
        .lcf-guide-grid {
          background-image:
            linear-gradient(rgba(217, 180, 71, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(217, 180, 71, 0.045) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: linear-gradient(to bottom, black 0%, black 58%, transparent 100%);
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080808]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <a href="/livecommercefestival/2026" className="flex items-center gap-3" aria-label="Live Commerce Festival 2026 トップへ">
            <img src="/lcf-logo.png" alt="Live Commerce Festival" className="h-8 w-auto object-contain" />
            <span className="hidden border-l border-white/20 pl-3 text-[10px] font-semibold tracking-[0.18em] text-[#D9B447] sm:block">GUIDANCE</span>
          </a>
          <div className="flex items-center gap-2">
            <a href="/lcf/mypage" className="border border-white/15 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-[#D9B447] hover:text-[#F1D77D]">マイページ</a>
            <a href="/lcf/booth-reservation" className="bg-[#D9B447] px-3 py-2 text-xs font-bold text-[#090909] transition-colors hover:bg-[#F1D77D]">LIVE配信ブース予約</a>
          </div>
        </div>
        <nav aria-label="ガイド内メニュー" className="border-t border-white/5 bg-[#0d0d0d]">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 md:px-8">
            {NAV_ITEMS.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="shrink-0 px-3 py-2 text-xs text-[#aaa9a3] transition-colors hover:bg-white/5 hover:text-[#F1D77D]">{item.label}</a>
            ))}
          </div>
        </nav>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-white/10">
          <div className="lcf-guide-grid absolute inset-0 -z-20" aria-hidden="true" />
          <div className="absolute -right-36 top-20 -z-10 h-[430px] w-[430px] rounded-full border border-[#D9B447]/15" aria-hidden="true" />
          <div className="absolute -right-20 top-36 -z-10 h-[280px] w-[280px] rounded-full border border-[#D9B447]/25" aria-hidden="true" />
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:py-28 lg:py-36">
            <div>
              <p className="text-xs font-semibold tracking-[0.34em] text-[#D9B447]">LIVER GUIDE / 2026</p>
              <h1 className="mt-7 max-w-3xl text-5xl font-light leading-[0.96] tracking-[-0.04em] text-white sm:text-6xl md:text-7xl lg:text-[92px]">
                LCF<br /><span className="text-[#E5C565]">Guidance</span>
              </h1>
              <p className="mt-7 text-xl font-medium text-white md:text-2xl">ライバーの皆様へ｜当日のご案内</p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#aaa9a3] md:text-base">Live Commerce Festival 2026を最大限楽しんでいただくための、当日ガイドです。</p>
            </div>
            <div className="self-end border-l border-[#D9B447] pl-6 md:pl-9">
              <div className="space-y-7">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-[#8f8e89]">DATE</p>
                  <p className="mt-2 text-xl font-light text-white">2026.09.08 <span className="text-sm text-[#D9B447]">TUE</span> — 09.09 <span className="text-sm text-[#D9B447]">WED</span></p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-[#8f8e89]">VENUE</p>
                  <p className="mt-2 text-xl font-light text-white">八芳園</p>
                  <p className="mt-1 text-sm text-[#999891]">東京都港区白金台1丁目1-1</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-[#8f8e89]">ORGANIZER</p>
                  <p className="mt-2 text-sm text-white">JLCA実行委員会</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="重要なお知らせ" className="border-b border-white/10 bg-[#10100d]">
          <div className="mx-auto grid max-w-7xl gap-px bg-[#D9B447]/20 md:grid-cols-3">
            <div className="bg-[#12120f] px-6 py-7 md:px-8">
              <QrCode className="h-6 w-6 text-[#E7C766]" aria-hidden="true" />
              <h2 className="mt-4 text-base font-bold text-white">入場用QRコードを準備</h2>
              <p className="mt-2 text-sm leading-6 text-[#a9a8a2]">受付に必須です。すぐに提示できる状態でご来場ください。</p>
            </div>
            <div className="bg-[#12120f] px-6 py-7 md:px-8">
              <CameraOff className="h-6 w-6 text-[#E7C766]" aria-hidden="true" />
              <h2 className="mt-4 text-base font-bold text-white">番組・セミナーは撮影禁止</h2>
              <p className="mt-2 text-sm leading-6 text-[#a9a8a2]">撮影・配信・録画・SNS等への投稿はできません。</p>
            </div>
            <div className="bg-[#12120f] px-6 py-7 md:px-8">
              <BadgeHelp className="h-6 w-6 text-[#E7C766]" aria-hidden="true" />
              <h2 className="mt-4 text-base font-bold text-white">困ったら総合運営本部へ</h2>
              <p className="mt-2 text-sm leading-6 text-[#a9a8a2]">配信、会場設備、スケジュールなど当日のご相談を承ります。</p>
            </div>
          </div>
        </section>

        <section id="overview" className="scroll-mt-32 border-b border-white/10 px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading number="01" eyebrow="Event Information" title="開催概要" />
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="border-l-2 border-[#D9B447] bg-[#101010] p-6 md:p-8">
                <dl className="space-y-6">
                  {[
                    ["イベント名", "Live Commerce Festival 2026"],
                    ["開催日", "2026年9月8日（火）〜9月9日（水）"],
                    ["会場", "八芳園"],
                    ["住所", "東京都港区白金台1丁目1-1"],
                    ["主催", "JLCA実行委員会"],
                  ].map(([term, detail]) => (
                    <div key={term}>
                      <dt className="text-[10px] font-semibold tracking-[0.18em] text-[#7f7e79]">{term}</dt>
                      <dd className="mt-2 text-sm leading-6 text-white md:text-base">{detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ProgramDay day="DAY 01" date="9月8日（火）" title="タレントデー">
                  <div className="space-y-5 text-sm">
                    <div><p className="font-mono text-[#E7C766]">13:00〜18:00</p><p className="mt-1 text-[#c1c0ba]">オンライン番組・メーカー交流・配信等</p></div>
                    <div><p className="font-mono text-[#E7C766]">18:30〜21:00</p><p className="mt-1 text-[#c1c0ba]">表彰パーティー</p></div>
                  </div>
                </ProgramDay>
                <ProgramDay day="DAY 02" date="9月9日（水）" title="スペシャルセミナー">
                  <div className="space-y-5 text-sm">
                    <div><p className="font-mono text-[#E7C766]">11:00〜18:00</p><p className="mt-1 text-[#c1c0ba]">セミナー・トークセッション</p></div>
                  </div>
                </ProgramDay>
              </div>
            </div>
            <p className="mt-5 text-xs text-[#77766f]">※イベント内容・時間は変更となる場合がございます。</p>
          </div>
        </section>

        <section id="schedule" className="scroll-mt-32 border-b border-white/10 bg-[#0b0b0b] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading number="02–03" eyebrow="Event & Content Schedule" title="イベントスケジュール" description="当日の全体進行と、番組・セミナーのコンテンツをご確認ください。" />
            <div className="grid gap-5 lg:grid-cols-2">
              <ProgramDay day="DAY 01" date="9月8日（火）" title="タレントデー">
                <div className="space-y-4">
                  {[
                    ["13:00", "イベント開始・ライバー受付"],
                    ["13:00〜14:00", "受付・会場内自由時間"],
                    ["14:00〜16:30", "特別配信番組"],
                    ["16:30〜18:00", "会場内自由時間・メーカー交流・配信等"],
                    ["18:00", "イベント終了"],
                    ["18:30〜21:00", "表彰パーティー"],
                  ].map(([time, label]) => (
                    <div key={time} className="grid grid-cols-[105px_1fr] gap-4 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                      <time className="font-mono text-sm text-[#E7C766]">{time}</time><p className="text-sm leading-6 text-[#c8c7c1]">{label}</p>
                    </div>
                  ))}
                </div>
              </ProgramDay>
              <ProgramDay day="DAY 02" date="9月9日（水）" title="スペシャルセミナー">
                <div className="space-y-4">
                  {[
                    ["11:00", "イベント開始"],
                    ["11:00〜17:00", "セミナー・トークコンテンツ"],
                    ["17:00〜18:00", "会場内自由時間・メーカー交流・配信等"],
                    ["18:00", "イベント終了"],
                  ].map(([time, label]) => (
                    <div key={time} className="grid grid-cols-[105px_1fr] gap-4 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                      <time className="font-mono text-sm text-[#E7C766]">{time}</time><p className="text-sm leading-6 text-[#c8c7c1]">{label}</p>
                    </div>
                  ))}
                </div>
              </ProgramDay>
            </div>

            <div className="mt-16">
              <div className="mb-7 flex items-center gap-4"><span className="h-px w-14 bg-[#D9B447]" /><h3 className="text-2xl font-light text-white">DAY 1｜特別配信番組</h3></div>
              <p className="mb-5 text-sm text-[#aaa9a3]">9月8日（火）14:00〜16:30</p>
              <ScheduleTable rows={DAY1_PROGRAM} />
              <div className="mt-5 border border-[#D9B447]/50 bg-[#221b08] px-5 py-4 text-sm font-semibold leading-6 text-[#F1D77D]">特別配信番組は撮影・配信・録画・SNS等への投稿を禁止します。</div>
            </div>

            <div className="mt-16">
              <div className="mb-7 flex items-center gap-4"><span className="h-px w-14 bg-[#D9B447]" /><h3 className="text-2xl font-light text-white">DAY 2｜スペシャルセミナー</h3></div>
              <p className="mb-5 text-sm text-[#aaa9a3]">9月9日（水）11:00〜17:00</p>
              <ScheduleTable rows={DAY2_PROGRAM} />
            </div>
            <p className="mt-5 text-xs text-[#77766f]">※イベント内容・出演者・時間は変更となる場合がございます。</p>
          </div>
        </section>

        <section id="venue" className="scroll-mt-32 border-b border-white/10 px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading number="04" eyebrow="Venue Area" title="会場MAP・図面・ブース配置" description="入場受付、総合運営本部、メーカー出店ブース、配信ブース、セミナーステージをご利用いただけます。" />
            <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["ライバー受付", "入場時はこちらでQRコードによる受付を行い、ライバー用ネックストラップをお受け取りください。"],
                ["総合運営本部", "イベントに関するご質問・トラブル・お困りごとはこちらへご相談ください。"],
                ["メーカー出店ブース", "商品を実際に見たり、メーカー担当者から商品の説明を受けることができます。"],
                ["配信ブース", "メーカー専用配信ブース、および5F・6Fに設置された配信ブースをご利用いただけます。"],
                ["セミナーステージ", "各種セミナー・トークセッションを実施します。"],
              ].map(([title, text]) => (
                <div key={title} className="bg-[#101010] p-5 md:p-6">
                  <h3 className="text-base font-semibold text-[#E7C766]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#aaa9a3]">{text}</p>
                </div>
              ))}
            </div>

            <div className="mt-14">
              <h3 className="mb-5 text-xl font-light text-white">会場図面</h3>
              <div className="grid gap-5 md:grid-cols-2">
                <ImageCard src={GUIDE_ASSETS.floor5} alt="八芳園5F 会場図面" label="5F 会場図面" />
                <ImageCard src={GUIDE_ASSETS.floor6} alt="八芳園6F 会場図面" label="6F 会場図面" />
              </div>
            </div>

            <div className="mt-14">
              <h3 className="mb-5 text-xl font-light text-white">会場イメージ</h3>
              <div className="grid gap-5 md:grid-cols-2">
                <ImageCard src={GUIDE_ASSETS.venue5} alt="八芳園5F 会場イメージ" label="5F 会場イメージ" />
                <ImageCard src={GUIDE_ASSETS.venue6} alt="八芳園6F 会場イメージ" label="6F 会場イメージ" />
              </div>
            </div>

            <div className="mt-14">
              <h3 className="mb-5 text-xl font-light text-white">ブース配置図</h3>
              <div className="grid gap-5 md:grid-cols-2">
                <ImageCard src={GUIDE_ASSETS.layout5} alt="八芳園5F ブース配置図" label="5F ブース配置図" />
                <ImageCard src={GUIDE_ASSETS.layout6} alt="八芳園6F ブース配置図" label="6F ブース配置図" />
              </div>
              <p className="mt-4 text-xs leading-6 text-[#77766f]">※図面・イメージ・出店企業・ブース配置は現時点の予定です。当日は会場内の掲示・スタッフの案内をご確認ください。</p>
            </div>
          </div>
        </section>

        <section id="guidance" className="scroll-mt-32 border-b border-white/10 bg-[#0b0b0b] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading number="05" eyebrow="Liver Guidance" title="ライバーガイダンス" description="LCFは、メーカーとライバーが直接つながり、新しい商品・新しい販売機会を見つける場です。" />
            <div className="grid gap-5 md:grid-cols-3">
              {[
                ["STEP 01", "まずはメーカーのブースを自由に回ろう！", "気になる商品があれば、メーカー担当者に直接お声がけいただき、商品の特徴や魅力、販売条件などを詳しく聞いてみましょう。"],
                ["STEP 02", "「この商品を販売したい！」と思ったら", "メーカー担当者と販売条件などを相談のうえ、ターゲットコラボ申請を行い、販売をスタート。メーカー専用または5F・6Fの配信ブースをご利用いただけます。"],
                ["STEP 03", "当日販売できなくてもOK！", "当日の配信が難しい場合は、後日販売することも可能です。イベントを通じてメーカーとつながり、今後の販売につながる関係を作ってください。"],
              ].map(([step, title, text], index) => (
                <article key={step} className={`relative border border-white/10 bg-[#101010] p-6 md:p-8 ${index === 1 ? "md:-translate-y-4 md:border-[#D9B447]/60" : ""}`}>
                  <p className="text-xs font-semibold tracking-[0.2em] text-[#D9B447]">{step}</p>
                  <h3 className="mt-5 text-xl font-semibold leading-8 text-white">{title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#aaa9a3]">{text}</p>
                </article>
              ))}
            </div>
            <p className="mt-10 border-l-2 border-[#D9B447] pl-5 text-xl font-light leading-8 text-[#E7C766] md:text-2xl">たくさんのメーカー・商品と出会い、最高の2日間にしましょう。</p>
          </div>
        </section>

        <section id="gmv" className="scroll-mt-32 border-b border-white/10 px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading number="05" eyebrow="GMV Award" title="GMV AWARD 集計方法" />
            <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
              <div className="border border-[#D9B447]/60 bg-[#1c1708] p-6 md:p-8">
                <p className="text-xs font-semibold tracking-[0.2em] text-[#D9B447]">対象期間</p>
                <p className="mt-4 text-2xl font-light leading-9 text-white">2026年9月1日（火）0:00<br /><span className="text-[#D9B447]">〜</span> 9月8日（火）14:30</p>
              </div>
              <div className="border border-white/10 bg-[#101010] p-6 md:p-8">
                <p className="text-base font-semibold text-white">期間中、毎日の売上を集計し、翌日12:00までに集計データを提出してください。</p>
                <div className="mt-5 space-y-3 text-sm leading-6 text-[#aaa9a3]">
                  <p>前日0:00〜23:59の売上を集計し、翌日12:00までに提出</p>
                  <p>提出データを運営側で確認・集計し、当日18:00までに反映</p>
                  <p>最終日の9月8日は、0:00〜14:30までの売上を集計対象とします</p>
                </div>
              </div>
            </div>

            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["STEP 1", "TikTok Shopを開く", "アカウントプロフィールから「TikTok Shop」をタップ。", GUIDE_ASSETS.gmv1],
                ["STEP 2", "「売上額」をタップ", "クリエイターセンターの「売上額」をタップします。", GUIDE_ASSETS.gmv2],
                ["STEP 3", "「LIVE」をタップ", "「主要データ」ページから「LIVE」をタップします。", GUIDE_ASSETS.gmv3],
                ["STEP 4", "対象LIVEを選択", "集計対象となるLIVE配信をタップします。", GUIDE_ASSETS.gmv4],
                ["STEP 5", "詳細を確認", "「LIVEの詳細」ページで商品欄の「詳細を表示」をタップ。", GUIDE_ASSETS.gmv5],
                ["STEP 6", "対象商品の売上を提出", "出店企業の商品に丸印をつけたスクリーンショットを撮影。", GUIDE_ASSETS.gmv6],
              ].map(([step, title, text, image]) => (
                <article key={step} className="border border-white/10 bg-[#101010] p-4">
                  <div className="flex h-64 items-center justify-center bg-white p-2">
                    <img src={image} alt={`${step} ${title} 操作画面`} loading="lazy" decoding="async" className="h-full w-auto object-contain" />
                  </div>
                  <div className="p-3 pb-2 pt-5">
                    <p className="text-xs font-semibold tracking-[0.18em] text-[#D9B447]">{step}</p>
                    <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#989791]">{text}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 border-t-2 border-[#D9B447] bg-[#101010] p-6 md:p-8">
              <h3 className="text-xl font-semibold text-white">提出方法</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="flex gap-3"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#D9B447]" /><p className="text-sm leading-6 text-[#c1c0ba]">出店企業の商品に丸印をつけたスクリーンショットを撮影</p></div>
                <div className="flex gap-3"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#D9B447]" /><p className="text-sm leading-6 text-[#c1c0ba]">対象商品の売上合計額（GMV）を計算し、公式LINEへスクショとテキストを提出</p></div>
              </div>
              <div className="mt-6 bg-[#1c1708] px-5 py-4 font-mono text-sm text-[#F1D77D]">数値提出例：9/1分 GMV：¥150,000（対象商品3商品の売上合計）</div>
              <p className="mt-4 text-xs text-[#77766f]">※画面はイメージです。アプリのバージョンにより表示が異なる場合があります。</p>
            </div>
          </div>
        </section>

        <section id="streaming" className="scroll-mt-32 border-b border-white/10 bg-[#0b0b0b] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading number="06" eyebrow="Live Streaming Space" title="配信スペースについて" description="イベント当日の配信は基本的に自由に行っていただけます。周囲への配慮と禁止エリアのルールを守ってご利用ください。" />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="border-l-2 border-[#D9B447] bg-[#101010] p-6 md:p-8">
                <p className="text-xs text-[#D9B447]">01</p><h3 className="mt-3 text-xl font-semibold text-white">メーカーの配信ブース</h3><p className="mt-3 text-sm leading-7 text-[#aaa9a3]">各メーカーが用意する配信スペースをご利用いただけます。担当者と相談のうえ、ご使用ください。</p>
              </div>
              <div className="border-l-2 border-[#D9B447] bg-[#101010] p-6 md:p-8">
                <p className="text-xs text-[#D9B447]">02</p><h3 className="mt-3 text-xl font-semibold text-white">5F・6F 配信ブース</h3><p className="mt-3 text-sm leading-7 text-[#aaa9a3]">会場内に設置された専用配信ブースをご利用いただけます。位置はブース配置図をご確認ください。</p>
              </div>
            </div>

            <div className="mt-8 grid gap-px bg-white/10 lg:grid-cols-3">
              {[
                ["マイページから事前予約", "希望のブース・日時を選択し、必要事項を入力して予約できます。当日スムーズに利用するため、事前予約をご活用ください。"],
                ["当日会場でも予約OK", "各ブース前に設置されているQRコードを読み取り、空き状況を確認しながらその場で予約できます。"],
                ["ブースが埋まっている場合", "各フロアに設置している丸テーブルをご利用いただけます。"],
              ].map(([title, text]) => (
                <div key={title} className="bg-[#101010] p-6 md:p-8"><h3 className="text-base font-semibold text-[#E7C766]">{title}</h3><p className="mt-3 text-sm leading-7 text-[#aaa9a3]">{text}</p></div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/lcf/mypage" className="inline-flex items-center gap-2 bg-[#D9B447] px-5 py-3 text-sm font-bold text-[#090909] hover:bg-[#F1D77D]">マイページを開く <ExternalLink className="h-4 w-4" /></a>
              <a href="/lcf/booth-reservation" className="inline-flex items-center gap-2 border border-[#D9B447] px-5 py-3 text-sm font-semibold text-[#F1D77D] hover:bg-[#D9B447]/10">LIVE配信ブース予約 <Radio className="h-4 w-4" /></a>
            </div>

            <div className="mt-14 border border-[#D9B447]/60 bg-[#1c1708] p-6 md:p-8">
              <div className="flex items-start gap-4"><CameraOff className="mt-1 h-7 w-7 shrink-0 text-[#E7C766]" /><div><h3 className="text-xl font-semibold leading-8 text-[#F1D77D]">特別配信番組・セミナーは撮影・配信禁止</h3><p className="mt-2 text-sm leading-7 text-[#d3cdbd]">1日目の特別配信番組及び2日目のセミナーは、撮影・配信・録画・SNS等への投稿を禁止します。中継時には配信禁止スペースを設けます。</p></div></div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                ["映り込みへの配慮", "他の来場者・出演者・スタッフ等が映り込まないよう十分ご配慮ください。"],
                ["配信禁止エリア", "関係者楽屋など一般入場が禁止されているエリアでは配信できません。"],
                ["周囲への配慮", "他の来場者やライバーの配信の妨げにならないようご配慮ください。"],
                ["迷ったときは", "総合運営本部または近くの運営スタッフにご確認ください。"],
              ].map(([title, text]) => (
                <div key={title} className="border border-white/10 bg-[#101010] p-5"><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-3 text-xs leading-6 text-[#999891]">{text}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section id="notes" className="scroll-mt-32 border-b border-white/10 px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading number="07" eyebrow="What To Bring" title="持ち物・来場ライバー注意事項" description="ご来場前に必ずご確認ください。" />
            <div className="grid gap-5 md:grid-cols-3">
              <div className="border-l-2 border-[#D9B447] bg-[#101010] p-6"><Smartphone className="h-6 w-6 text-[#D9B447]" /><p className="mt-5 text-xs text-[#D9B447]">ITEM 01</p><h3 className="mt-2 text-xl font-semibold text-white">スマートフォン</h3><p className="mt-3 text-sm leading-6 text-[#aaa9a3]">配信・受付・メーカーとの連絡に使用します。当日は必ずご持参ください。</p></div>
              <div className="border-l-2 border-[#D9B447] bg-[#101010] p-6"><PackageCheck className="h-6 w-6 text-[#D9B447]" /><p className="mt-5 text-xs text-[#D9B447]">ITEM 02</p><h3 className="mt-2 text-xl font-semibold text-white">必要な配信用機材</h3><p className="mt-3 text-sm leading-6 text-[#aaa9a3]">三脚・照明・マイクなど、普段の配信でご使用の機材をご持参ください。</p></div>
              <div className="border border-[#D9B447] bg-[#1c1708] p-6"><QrCode className="h-6 w-6 text-[#F1D77D]" /><p className="mt-5 text-xs font-bold text-[#F1D77D]">ITEM 03 / MUST</p><h3 className="mt-2 text-xl font-semibold text-[#F1D77D]">入場用QRコード</h3><p className="mt-3 text-sm leading-6 text-[#d3cdbd]">受付に必須です。スクリーンショット等で、すぐに提示できる状態にしておくとスムーズです。</p></div>
            </div>
            <div className="mt-5 border border-white/10 bg-[#101010] px-6 py-5 text-sm leading-7 text-[#c9c8c1]">受付後は、<strong className="text-white">ライバー用ネックストラップを必ず着用</strong>してください。会場内では常時ご着用をお願いいたします。</div>

            <div className="mt-14 grid gap-5 md:grid-cols-2">
              {IMPORTANT_NOTES.map((note) => (
                <article key={note.number} className={`${note.number === "07" ? "border-[#D9B447]/70 bg-[#1b1608] md:col-span-2" : "border-white/10 bg-[#101010]"} border`}>
                  <div className={`${note.number === "07" ? "bg-[#E2C04F] text-[#080808]" : "border-b border-white/10 text-[#E7C766]"} px-5 py-3 text-sm font-bold`}>
                    {note.number}｜{note.title}
                  </div>
                  <p className="px-5 py-5 text-sm leading-7 text-[#c1c0ba] md:px-6">{note.text}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-sm text-[#8e8d87]">※ライバーの皆様が安心してイベントを楽しめるよう、ご協力をお願いいたします。</p>
          </div>
        </section>

        <section id="support" className="scroll-mt-32 bg-[#0b0b0b] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading number="08" eyebrow="Support Desk" title="総合運営本部・お問い合わせ" />
            <div className="border border-[#D9B447]/60 bg-[#14120c] p-6 md:p-10">
              <BadgeHelp className="h-8 w-8 text-[#E7C766]" />
              <p className="mt-5 text-2xl font-light leading-10 text-white">当日のご不明点・お困りごとは、<br /><strong className="font-semibold text-[#E7C766]">総合運営本部</strong>までお越しください。</p>
            </div>
            <div className="mt-6 grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {["メーカーとのマッチングについて", "配信スペースについて", "GMV AWARDについて", "会場設備について", "イベントスケジュールについて", "その他、会場内でのお困りごと"].map((text) => (
                <div key={text} className="bg-[#101010] px-5 py-5 text-sm text-[#d1d0ca]">{text}</div>
              ))}
            </div>
            <div className="mt-5 border-t-2 border-[#D9B447] bg-[#101010] p-6 md:p-8">
              <h3 className="text-lg font-semibold text-[#E7C766]">運営スタッフについて</h3>
              <p className="mt-3 text-sm leading-7 text-[#aaa9a3]">会場内で判断が必要な事項については、各担当スタッフが確認のうえ対応いたします。ライバーの皆様が安心してイベントを楽しめるよう、運営スタッフがサポートいたします。</p>
            </div>
            <p className="mt-6 border border-[#D9B447]/60 bg-[#1b1608] px-5 py-5 text-center text-xl font-semibold text-[#F1D77D]">「困ったら、まず総合運営本部へ」</p>

            <div className="mt-20">
              <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-[#D9B447]"><span className="h-px w-10 bg-[#D9B447]" />ACCESS</div>
              <h2 className="mt-4 text-3xl font-light text-white md:text-5xl">アクセス</h2>
              <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <ImageCard src={GUIDE_ASSETS.access} alt="八芳園 周辺交通アクセス地図" label="八芳園 アクセスマップ" />
                <div>
                  <div className="border border-[#D9B447]/60 bg-[#14120c] p-6">
                    <h3 className="text-2xl font-semibold text-[#E7C766]">八芳園（HAPPO-EN）</h3>
                    <p className="mt-3 flex gap-2 text-sm text-[#c1c0ba]"><MapPin className="h-4 w-4 shrink-0 text-[#D9B447]" />東京都港区白金台1-1-1</p>
                    <a href="tel:0570064128" className="mt-3 flex gap-2 text-sm text-[#c1c0ba] hover:text-white"><Phone className="h-4 w-4 shrink-0 text-[#D9B447]" />0570-064-128（代）</a>
                    <a href="https://www.google.com/maps/search/?api=1&query=%E5%85%AB%E8%8A%B3%E5%9C%92" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 border border-[#D9B447] px-4 py-2.5 text-sm font-semibold text-[#F1D77D] hover:bg-[#D9B447]/10">地図アプリで開く <Navigation className="h-4 w-4" /></a>
                  </div>
                  <div className="mt-5 grid gap-px bg-white/10 sm:grid-cols-2">
                    <div className="bg-[#101010] p-5"><TrainFront className="h-5 w-5 text-[#D9B447]" /><h4 className="mt-3 font-semibold text-white">地下鉄</h4><p className="mt-2 text-sm leading-6 text-[#999891]">白金台駅（都営三田線・東京メトロ南北線）2番出口より徒歩1分<br />高輪台駅（都営浅草線）</p></div>
                    <div className="bg-[#101010] p-5"><TrainFront className="h-5 w-5 text-[#D9B447]" /><h4 className="mt-3 font-semibold text-white">電車</h4><p className="mt-2 text-sm leading-6 text-[#999891]">目黒駅（山手線・目黒線）<br />品川駅（山手線・京浜東北線・京浜急行線）</p></div>
                    <div className="bg-[#101010] p-5"><Navigation className="h-5 w-5 text-[#D9B447]" /><h4 className="mt-3 font-semibold text-white">都バス</h4><p className="mt-2 text-sm leading-6 text-[#999891]">目黒駅東口／品川駅高輪口より＜品93＞に乗車、「白金台駅前」下車</p></div>
                    <div className="bg-[#101010] p-5"><Navigation className="h-5 w-5 text-[#D9B447]" /><h4 className="mt-3 font-semibold text-white">タクシー</h4><p className="mt-2 text-sm leading-6 text-[#999891]">目黒・五反田・品川駅より約5分<br />高速道路：目黒出口より約3分</p></div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-[#77766f]">※駐車場および周辺道路の混雑が予想されますので、公共交通機関のご利用をお願いいたします。</p>
            </div>
          </div>
        </section>

        <section className="border-t border-[#D9B447]/40 bg-[#0a0907] px-5 py-20 text-center md:px-8 md:py-28">
          <p className="text-xs font-semibold tracking-[0.3em] text-[#D9B447]">THANK YOU</p>
          <h2 className="mt-6 text-4xl font-light leading-tight text-white md:text-6xl">Live Commerce<br />Festival 2026</h2>
          <p className="mx-auto mt-7 max-w-xl text-base leading-8 text-[#aaa9a3]">メーカーとライバーが出会い、<br />新しい販売機会を生み出す2日間。<br />皆様のご来場を心よりお待ちしております。</p>
          <p className="mt-8 text-sm text-[#E7C766]">2026年9月8日（火）〜9月9日（水）｜八芳園</p>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#060606] px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <img src="/lcf-logo.png" alt="Live Commerce Festival" className="h-9 w-auto" />
            <p className="mt-3 text-xs text-[#73726d]">主催：JLCA実行委員会</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[#8d8c86]">
            <a href="/livecommercefestival/2026" className="hover:text-[#F1D77D]">LCF2026トップ</a>
            <a href="/lcf/mypage" className="hover:text-[#F1D77D]">マイページ</a>
            <a href="/lcf/booth-reservation" className="hover:text-[#F1D77D]">LIVE配信ブース予約</a>
          </div>
        </div>
      </footer>

      <a href="#top" aria-label="ページ上部へ戻る" className="fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center border border-[#D9B447]/70 bg-[#0a0a0a]/95 text-[#F1D77D] shadow-xl transition-transform hover:-translate-y-1">
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}
