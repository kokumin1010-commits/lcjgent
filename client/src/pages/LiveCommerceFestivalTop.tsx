/**
 * ============================================================
 * LIVE COMMERCE FESTIVAL - Top Page (SNS万博スタイル)
 * ============================================================
 * URL: /livecommercefestival
 * Design: 黄色ベース・盛り上がり感・SNS万博2026参考
 * Target: ライバー（事前登録）+ 企業（問い合わせ）
 * ============================================================
 */
import { useState, useEffect, useRef } from 'react';

// Asset URLs (CDN)
const LOGO_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ZjvFdcWckPHcZxCi.png';
const HERO_BG_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/msZWaikKboqlefJH.png';
const GIFT_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vLYpJIHgEThRqpsE.png';
const VENUE_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/PHeOrSmyNPVfKGRb.png';

const LINE_URL = 'https://lin.ee/Rb1fvvy';
const CONTACT_EMAIL = 'info@livecommercefestival.com';

/* ─── Intersection Observer hook ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── Top Announcement Bar ─── */
function TopBar() {
  return (
    <div className="bg-red-600 text-white py-2.5 px-4 text-center">
      <div className="flex items-center justify-center gap-4 md:gap-8 text-sm md:text-base font-bold flex-wrap">
        <span>2026年9月8日-9日開催！</span>
        <span className="hidden sm:inline">|</span>
        <span>会場: 八芳園</span>
        <span className="hidden sm:inline">|</span>
        <span>参加無料！</span>
        <span className="hidden sm:inline">|</span>
        <span>LINE登録で30秒完了！</span>
      </div>
    </div>
  );
}

/* ─── Hero Section - Yellow background with logo ─── */
function HeroSection() {
  return (
    <section
      className="relative py-16 md:py-28 overflow-hidden"
      style={{
        backgroundImage: `url(${HERO_BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Date badge */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-10">
        <div className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span>2026年9月8日（火）- 9日（水）</span>
          </div>
          <div className="text-xs mt-1 opacity-90">会場: 八芳園（白金台）・参加無料！</div>
        </div>
      </div>

      <div className="container mx-auto px-4 text-center relative z-10">
        {/* Logo */}
        <div className="mb-8 md:mb-10">
          <img
            src={LOGO_URL}
            alt="Live Commerce Festival"
            className="mx-auto w-[280px] md:w-[440px] lg:w-[520px] drop-shadow-2xl"
          />
        </div>

        {/* Subtitle */}
        <p className="text-lg md:text-2xl font-bold text-gray-800 mb-2">
          第1回 コマースライバーと企業のマッチング・セミナー型祭典
        </p>
        <p className="text-base md:text-lg text-gray-700 mb-10">
          Supported by LCF実行委員会
        </p>

        {/* CTA Button */}
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-[#06C755] hover:bg-[#05b04c] text-white text-xl md:text-2xl font-bold px-10 md:px-16 py-5 md:py-6 rounded-xl shadow-[0_8px_30px_rgba(6,199,85,0.4)] transform hover:scale-105 transition-all duration-200 active:scale-95"
        >
          今すぐ無料で事前登録する →
        </a>
        <p className="text-sm text-gray-600 mt-4">
          LINE登録後、30秒で完了します。
        </p>
      </div>
    </section>
  );
}

/* ─── Campaign Banner Section ─── */
function CampaignBanner() {
  return (
    <section className="bg-[#FFD700] py-10 md:py-14">
      <div className="container mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-10 max-w-4xl mx-auto relative overflow-hidden border-4 border-red-500">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Gift box image */}
            <div className="w-28 md:w-36 flex-shrink-0">
              <img src={GIFT_URL} alt="豪華特典" className="w-full" />
            </div>

            {/* Text */}
            <div className="text-center md:text-left">
              <div className="flex items-baseline justify-center md:justify-start gap-1 flex-wrap">
                <span className="text-xl md:text-2xl font-bold text-gray-800">総額</span>
                <span className="text-5xl md:text-7xl font-black text-red-600">1000</span>
                <span className="text-xl md:text-2xl font-bold text-gray-800">万円分</span>
                <span className="text-lg md:text-xl text-gray-700">の豪華特典が当たる</span>
              </div>
              <p className="text-2xl md:text-3xl font-black text-red-600 mt-3">
                事前登録キャンペーン開催中！
              </p>
            </div>
          </div>
        </div>

        {/* CTA below banner */}
        <div className="text-center mt-8">
          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#06C755] hover:bg-[#05b04c] text-white text-lg md:text-xl font-bold px-10 md:px-14 py-4 md:py-5 rounded-xl shadow-[0_8px_30px_rgba(6,199,85,0.4)] transform hover:scale-105 transition-all duration-200 active:scale-95"
          >
            今すぐ無料で事前登録する →
          </a>
          <p className="text-sm text-gray-700 mt-3">
            LINE登録後、予約フォーム入力で30秒で完了します。<br />
            登録完了後、当日詳細をお送りします。
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Message Section ─── */
function MessageSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <section ref={ref} className={`bg-[#0a0a0a] py-16 md:py-24 text-white transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-[2px] bg-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium tracking-wider">About / Concept</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black">
            開催趣旨 <span className="text-2xl md:text-3xl font-normal text-gray-400">/ MESSAGE</span>
          </h2>
        </div>

        <div className="space-y-8 text-base md:text-lg leading-relaxed">
          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-2">TikTok Shopの認知拡大と第一想起の獲得:</h3>
            <p className="text-gray-300">業界を牽引し、TikTok上でのライブコマースイベントといえば我々というポジションを確立する。</p>
          </div>
          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-2">オンライン × オフラインの融合:</h3>
            <p className="text-gray-300">単なるオフラインのマッチングイベントに留まらず、出展企業が全社ライブコマースを実施しながら会場およびオンラインで販売を行う。</p>
          </div>
          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-2">出展費用の回収モデル:</h3>
            <p className="text-gray-300">会場でのマッチングやライブ販売を通じて、出展企業が出展費をその場で回収できる日本で目新しいエコシステムを構築。</p>
          </div>
          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-2">エンターテインメント性とUGCの創出:</h3>
            <p className="text-gray-300">芸能人やインフルエンサーを起用することで外部メディアを誘致し、SNSでのUGC（ユーザー生成コンテンツ）を爆発的に発生させる。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Stats Section ─── */
function StatsSection() {
  const { ref, inView } = useInView(0.1);
  const stats = [
    { label: '出展企業数', value: '60-80', unit: '社' },
    { label: '来場ライバー数', value: '300', unit: '名' },
    { label: 'GMV創出想定', value: '2.2', unit: '億円' },
    { label: 'PV想定', value: '1600', unit: '万回' },
  ];

  return (
    <section ref={ref} className={`bg-[#0a0a0a] pb-16 md:pb-24 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="border-2 border-[#FFD700] rounded-lg p-4 md:p-6 text-center"
            >
              <p className="text-gray-400 text-xs md:text-sm mb-2">{stat.label}</p>
              <p className="text-3xl md:text-4xl font-black text-[#FFD700]">{stat.value}</p>
              <p className="text-gray-300 text-sm">{stat.unit}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Program Section ─── */
function ProgramSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <section ref={ref} className={`bg-[#111] py-16 md:py-24 text-white transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-[2px] bg-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium tracking-wider">About / Content</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black">
            プログラム <span className="text-2xl md:text-3xl font-normal text-gray-400">/ PROGRAM</span>
          </h2>
        </div>

        <div className="space-y-10">
          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-3">現場ライブコマース（ライバーマッチング＆販売）:</h3>
            <p className="text-gray-300 leading-relaxed">
              出展企業が製品を展示するだけではなく、事前ライバーさんと組み、会場から直接配信を実施することが可能。（出店商品事前エントリー、ライバー来場後配信可能）
            </p>
          </div>

          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-3">公開セミナー・トークショー:</h3>
            <div className="text-gray-300 space-y-1">
              <p>トップライブコマーサー・プレヤーによる講演</p>
              <p>TikTok公式担当者によるトークショーや勉強会</p>
              <p>メーカーによる商品説明イベント</p>
            </div>
          </div>

          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-3">興行要素:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: '🎪', text: '展示スペース' },
                { icon: '📡', text: '配信スペース（5-8箇所）※イベント出展企業配信予定' },
                { icon: '🎤', text: 'セミナー（商品説明）スペース' },
                { icon: '🎵', text: 'DJブース' },
                { icon: '🍹', text: 'ドリンクバー' },
                { icon: '🎉', text: 'アフターパーティー ※出展企業＆ライバーマッチングイベント' },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-3 bg-white/5 rounded-lg p-3 border border-white/10">
                  <span className="text-2xl flex-shrink-0">{item.icon}</span>
                  <span className="text-gray-300 text-sm md:text-base">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Venue Section ─── */
function VenueSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <section ref={ref} className={`bg-[#0a0a0a] py-16 md:py-24 text-white transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-[2px] bg-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium tracking-wider">Venue</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black">
            会場 <span className="text-2xl md:text-3xl font-normal text-gray-400">/ VENUE</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="rounded-xl overflow-hidden shadow-2xl">
            <img src={VENUE_URL} alt="八芳園" className="w-full h-64 md:h-80 object-cover" />
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-bold mb-2">八芳園</h3>
            <p className="text-gray-500 text-sm mb-4">Happo-en</p>
            <div className="space-y-3 text-gray-300">
              <p className="flex items-start gap-3">
                <span className="text-[#FFD700] text-lg">📍</span>
                <span>東京都港区白金台1-1-1</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-[#FFD700] text-lg">🚃</span>
                <span>白金台駅 徒歩1分</span>
              </p>
            </div>
            <p className="text-sm text-gray-500 mt-6 leading-relaxed">
              400年以上の歴史を持つ日本庭園を有する、東京屈指のイベント会場。格式高い空間でライブコマースの新時代を切り拓きます。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── LINE CTA Section ─── */
function LineCTASection() {
  return (
    <section className="bg-[#FFD700] py-14 md:py-20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
          ライバーとして参加しませんか？
        </h2>
        <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
          日本最大級のライブコマースイベントで、あなたのスキルを企業にアピール。<br className="hidden md:inline" />
          マッチングからその場で配信・販売まで、新しいビジネスチャンスが待っています。
        </p>

        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-[#06C755] hover:bg-[#05b04c] text-white text-xl md:text-2xl font-bold px-12 md:px-16 py-5 md:py-7 rounded-2xl shadow-[0_8px_30px_rgba(6,199,85,0.4)] transform hover:scale-105 transition-all duration-200 active:scale-95"
        >
          今すぐ無料で事前登録する →
        </a>
        <p className="text-sm text-gray-600 mt-4">
          LINE登録後、予約フォーム入力で30秒で完了します。<br />
          登録完了後、当日詳細をお送りします。
        </p>
      </div>
    </section>
  );
}

/* ─── Corporate Section ─── */
function CorporateSection() {
  const { ref, inView } = useInView(0.1);
  return (
    <section ref={ref} className={`bg-[#1a1a1a] py-16 md:py-24 text-white transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            出展企業様へ
          </h2>
          <p className="text-gray-400 text-lg">
            ライブコマースで売上を最大化する新しいイベント出展モデル
          </p>
        </div>

        {/* Benefits */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: '🎯',
              title: 'ライバーとの即マッチング',
              desc: '300名のコマースライバーと直接出会い、その場で配信パートナーを見つけられます。',
            },
            {
              icon: '💰',
              title: '出展費の即回収',
              desc: '会場からライブ配信で販売。出展費をイベント当日に回収できるモデルです。',
            },
            {
              icon: '📈',
              title: '圧倒的な露出',
              desc: 'PV想定1600万回。SNSでのUGC拡散で、ブランド認知を爆発的に拡大。',
            },
          ].map((benefit) => (
            <div key={benefit.title} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:border-[#FFD700]/30 transition-colors">
              <div className="text-4xl mb-4">{benefit.icon}</div>
              <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
              <p className="text-gray-400 text-sm">{benefit.desc}</p>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="text-center bg-gradient-to-r from-[#FFD700]/10 to-[#FF6B00]/10 border border-[#FFD700]/30 rounded-2xl p-8 md:p-12">
          <h3 className="text-2xl font-bold mb-4">出展・スポンサーのお問い合わせ</h3>
          <p className="text-gray-400 mb-6">
            出展プラン・スポンサー枠の詳細はメールにてお問い合わせください。
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-block bg-white text-gray-900 text-lg font-bold px-10 py-4 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
          >
            企業様お問い合わせはこちら
          </a>
          <p className="text-gray-500 text-sm mt-3">{CONTACT_EMAIL}</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Overview Section ─── */
function OverviewSection() {
  return (
    <section className="bg-[#0a0a0a] py-16 md:py-20 text-white border-t border-white/10">
      <div className="container mx-auto px-4 max-w-3xl text-center">
        <h2 className="text-3xl md:text-4xl font-black mb-10">開催概要</h2>

        <div className="space-y-4 text-base md:text-lg text-left">
          {[
            { label: 'イベント名', value: '第1回 Live Commerce Festival 2026' },
            { label: 'コンセプト', value: 'コマースライバーと企業のマッチング・セミナー型祭典' },
            { label: '開催日', value: '2026年9月8日（火）- 9日（水）' },
            { label: '開催場所', value: '八芳園（東京・白金台）' },
            { label: '企画', value: 'LCF実行委員会' },
            { label: '参加費', value: '無料（事前LINE登録制）' },
          ].map((item) => (
            <div key={item.label} className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-white/10 pb-3 gap-1">
              <span className="text-gray-400 text-sm sm:text-base">{item.label}</span>
              <span className="font-bold text-sm sm:text-base">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function LCFFooter() {
  return (
    <footer className="bg-black py-8 text-center text-gray-500 text-sm">
      <p>&copy; 2026 Live Commerce Festival 実行委員会. All Rights Reserved.</p>
      <p className="mt-2">
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">
          {CONTACT_EMAIL}
        </a>
      </p>
    </footer>
  );
}

/* ─── Main Page Component ─── */
export default function LiveCommerceFestivalTop() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TopBar />
      <HeroSection />
      <CampaignBanner />
      <MessageSection />
      <StatsSection />
      <ProgramSection />
      <VenueSection />
      <LineCTASection />
      <CorporateSection />
      <OverviewSection />
      <LCFFooter />
    </div>
  );
}
