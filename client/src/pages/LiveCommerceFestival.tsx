/**
 * Live Commerce Festival 2026
 * SNS万博スタイルの盛り上がり感あるイベントLP
 * メインターゲット: ライバー（コマースライバー）
 * サブターゲット: 出展企業
 */

import { useState, useEffect, useRef } from 'react';

// Asset URLs
const LOGO_URL = '/lcf-logo.png';
const HERO_BG_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/lcf-hero-bg-4cGehVexgpBpiTXzUfbWn6.webp';
const GIFT_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/lcf-campaign-banner-UTYkEpXQhwghYVzdRTxpfd.webp';
const VENUE_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/lcf-venue-happo-GVY9qH72XkhYao7NtXbs8m.webp';

const LINE_URL = 'https://line.me/ti/g2/KsS3Ma1HW3okfwI2OowM6Ubk0UHKOHmb3nZFhA?utm_source=invitation&utm_medium=link_copy&utm_campaign=default';
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

/* ─── Special Guest Section ─── */
function SpecialGuestSection() {
  const guests = [
    {
      name: '後藤真希',
      photo: '/goto-maki_71a97b7d.webp',
      title: 'アーティスト・モデル',
      schedule: '9/8 生配信のみ出演',
      bio: '1999年より「モーニング娘。」3期メンバーとして活躍し、卒業後はソロアーティストとして本格的に活動を開始。2024年にデビュー25周年を迎え、2025年10月15日に記念アルバム『COLLECTION』をリリース。また、2021年に発売し大ヒットを記録した写真集『ramus』に続き、2024年に発売した『flos』はSNSを中心に大きな話題を呼びロングヒットを記録中。美容誌『美ST』のモデルとしても活躍し、豊富な美容知識がたびたび話題に。',
      sns: [],
    },
    {
      name: 'JOY',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vjAqkYolejYZqfed.jpg',
      title: 'タレント・モデル',
      schedule: '9/8 生配信のみ出演',
      bio: '2003年、雑誌「men\'s egg」でモデルデビュー。タレントとしてバラエティ番組を中心に幅広く活躍。群馬県高崎市の観光特使、「イクメン オブ ザ イヤー（芸能部門）」受賞。妻・maiとともに個人事務所「JAM\'s flower」にて活動中。',
      sns: [{ label: 'X', url: 'https://x.com/JOY19850415' }, { label: 'Instagram', url: 'https://www.instagram.com/joy_19850415/' }],
    },
    {
      name: 'ゆん',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/JrdLtSWrsMiHmheu.webp',
      title: 'YouTuber・タレント',
      schedule: '9/8 生配信のみ出演',
      bio: '愛知県出身。SNS総フォロワー数290万人超。美容・コスメ・ファッション・育児ライフスタイルを発信。2024年「第17回ペアレンティングアワード」インフルエンサー部門受賞。2023年Fischer\'sリーダー・シルクロードと結婚。現在、タレントとしても幅広く活動中。',
      sns: [{ label: 'Instagram', url: 'https://www.instagram.com/yuntaaam_s2/' }, { label: 'YouTube', url: 'https://www.youtube.com/@yunnn.s2' }],
    },
    {
      name: '景井ひな',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/rJqNwvfTVHQAdICo.webp',
      title: 'TikTokクリエイター・タレント',
      schedule: '9/8 生配信のみ出演',
      bio: '熊本県出身。TikTokフォロワー数国内女性No.1の1,000万人超。カンヌ国際映画祭2023で世界のクリエイター7人に選出。NHK大河ドラマ「べらぼう」、Netflix「ダウンタイム」などに出演。雑誌「JELLY」レギュラーモデル。',
      sns: [{ label: 'Instagram', url: 'https://www.instagram.com/kagei_hina/' }, { label: 'TikTok', url: 'https://www.tiktok.com/@kageihina' }, { label: 'X', url: 'https://x.com/hinatter0219' }],
    },
    {
      name: '城崎仁',
      photo: '/kinosaki_jin_d35efb08.png',
      title: '元カリスマホスト・カリスマ通販王',
      schedule: '特別招待ゲスト',
      bio: 'QVCなどのテレビ通販やライブコマース番組「城崎商店」で驚異的な売上を誇る「カリスマ通販王」。薬膳やダイエット、コスメ関連の専門資格も多数保持し、商品開発も手がける。',
      sns: [],
    },
    {
      name: '超無課金',
      photo: '/chomukakin_e44bb572.png',
      title: 'トップインフルエンサー・is N\'eat代表',
      schedule: '特別招待ゲスト',
      bio: 'SNS総フォロワー数1,000万人超のインフルエンサー。is N\'eat（イズニート）の代表であり、多くのトップライバーを抱える。自身もTikTokのトップライバーとして活動する傍ら、TikTok Shopなどのライブコマースを活用し、多方面で活躍。',
      sns: [],
    },
  ];
  return (
    <section className="bg-[#0a0a0a] py-14 md:py-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-10">
          <p className="text-sm tracking-[0.3em] text-gray-400 mb-2">SPECIAL GUEST</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">ゲスト出演者</h2>
          <p className="text-gray-400">各界で活躍するスペシャルゲストが登場</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {guests.map((g) => (
            <div key={g.name} className="bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-xl border border-white/5">
              <div className="aspect-[3/4] overflow-hidden">
                <img src={g.photo} alt={g.name} className="w-full h-full object-cover object-top" />
              </div>
              <div className="p-5">
                <h3 className="text-xl font-bold text-white mb-1">{g.name}</h3>
                <p className="text-sm text-amber-400 font-medium">{g.title}</p>
                <p className="text-xs text-gray-500 mt-1">{g.schedule}</p>
                <p className="text-sm text-gray-300 mt-3 leading-relaxed">{g.bio}</p>
              </div>
            </div>
          ))}
        </div>
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

/* ─── Top Live Commercer Section ─── */
function TopLiveCommercerSection() {
  const topCommercers = [
    {
      name: '京極 琉',
      nameEn: 'Ryu Kyogoku',
      title: '株式会社Live Commerce Japan 取締役',
      sales: '1.2',
      salesUnit: '億円',
      image: '/kyogoku_ryu_new_7a5fdab2.jpg',
    },
    {
      name: 'プリンスこうや',
      nameEn: 'Prince Koya',
      title: '株式会社MOB 取締役',
      sales: '1000',
      salesUnit: '万円',
      image: '/prince_kouya_new_d7a675d1.jpg',
    },
    {
      name: '熊田 佳奈',
      nameEn: 'Kana Kumada',
      title: 'ぞうねこちゃんねる創始者 KANA',
      sales: '5000',
      salesUnit: '万円',
      image: '/kana_d9cba9d3.jpg',
    },
    {
      name: 'かける',
      nameEn: 'Kakeru',
      title: 'ライブコマースチーム「115SHOP」創設者',
      sales: '1000',
      salesUnit: '万円',
      image: '/kakeru_d35782c2.jpg',
    },
    {
      name: 'しんたろー',
      nameEn: 'Shintaro',
      title: 'TikTok・YouTube人気マルチインフルエンサー',
      sales: '1000',
      salesUnit: '万円',
      image: '/shintaro_32e33ed9.jpg',
    },
    {
      name: '破天荒夫婦',
      nameEn: 'Hatenkou Fufu',
      title: '人気夫婦クリエイター',
      sales: '1000',
      salesUnit: '万円',
      image: '/hatenkou_fufu_93bf35ba.jpg',
    },
    {
      name: '百獣のいちか',
      nameEn: 'Ichika',
      title: '株式会社スマートスタジオ 代表',
      sales: '1000',
      salesUnit: '万円',
      image: '/ichika_e25a2c9f.jpg',
    },
  ];

  return (
    <section className="bg-[#FFD700] py-14 md:py-20">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
            日本のライブコマースのトッププレイヤーが集結
          </h2>
          <p className="text-gray-700 text-base md:text-lg">
            トップライブコマーサー
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {topCommercers.map((person) => (
            <div key={person.name} className="bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-xl hover:scale-[1.02] transition-transform duration-200">
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={person.image}
                  alt={person.name}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-5">
                <h3 className="text-white text-xl font-bold mb-1">{person.name}</h3>
                <p className="text-gray-400 text-sm mb-3">{person.title}</p>
                <p className="text-gray-500 text-xs">TikTok売上:</p>
                <p className="text-[#06C755] text-2xl font-black">
                  {person.sales}<span className="text-base">{person.salesUnit}</span>
                </p>
              </div>
            </div>
          ))}
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
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-2">TikTok Shopの認知拡大と第一想起の獲得</h3>
            <p className="text-gray-300">「TikTokでライブコマースといえばこのイベント」というポジションを確立し、業界の第一想起を取りにいく。</p>
          </div>
          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-2">オンライン × オフラインの融合</h3>
            <p className="text-gray-300">ただのマッチングイベントではなく、出展企業がその場でライブ配信しながら販売する。会場とオンラインの両方で売上が立つ新しい形。</p>
          </div>
          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-2">出展費用の回収モデル</h3>
            <p className="text-gray-300">ライブ配信でその場で売上が立つから、出展費をイベント当日に回収できる。展示会の常識を変える新しいモデル。</p>
          </div>
          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-2">エンターテインメント性とUGCの創出</h3>
            <p className="text-gray-300">タレントやインフルエンサーの出演で話題性を作り、来場者が自然とSNSに投稿したくなる空間を演出。UGCが勝手に広がる仕掛け。</p>
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
    { label: '出展企業数', value: '30', unit: '社+' },
    { label: '来場ライバー', value: '300', unit: '名' },
    { label: 'GMV創出想定', value: '5000', unit: '万円' },
    { label: 'PV想定', value: '1000', unit: '万回' },
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
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-3">現場ライブコマース（ライバーマッチング＆販売）</h3>
            <p className="text-gray-300 leading-relaxed">
              出展企業が事前にライバーと組み、会場から直接ライブ配信で販売。商品の事前エントリー制で、当日はブースからそのまま配信スタートできます。
            </p>
          </div>

          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-3">公開セミナー・トークショー</h3>
            <div className="text-gray-300 space-y-1">
              <p>トップライブコマーサー・プレヤーによる講演</p>
              <p>TikTok公式担当者によるトークショーや勉強会</p>
              <p>メーカーによる商品説明イベント</p>
            </div>
          </div>

          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-3">会場構成</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: '🎪', text: '展示スペース' },
                { icon: '📡', text: '配信スペース（5-8箇所）※イベント出展企業配信予定' },
                { icon: '🎙️', text: 'セミナー（商品説明）スペース' },
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

/* ─── Event Schedule Section ─── */
function EventScheduleSection() {
  const { ref, inView } = useInView(0.1);
  const day1 = [
    { time: '13:00 - 13:30', title: '【オープニングキーノート】', desc: '日本のライブコマース市場の未来と本イベントの意義' },
    { time: '13:45 - 14:30', title: '【TikTok公式セミナー】', desc: 'TikTok Shopの最新トレンドと今後の展望' },
    { time: '14:45 - 15:30', title: '【トップライブコマーサー対談】', desc: '億を売る「勝者のメンタリティ」と配信の裏側' },
    { time: '15:45 - 16:30', title: '【ライバー向け講演】', desc: '「ライバー」から「ライブコマーサー」への進化' },
    { time: '16:45 - 17:30', title: '【出展企業・TSP向け講演】', desc: 'ジャンル別成功事例と売れる座組の作り方' },
    { time: '18:30 - 20:30', title: 'アフターパーティー＆受賞式', desc: '出展企業＆ライバーネットワーキング' },
  ];
  const day2 = [
    { time: '10:00 - 10:45', title: '【新機能活用事例】', desc: '抽選機能などで熱狂を生む方法' },
    { time: '11:00 - 11:45', title: '【TikTok公式セミナー・応用編】', desc: 'ポリシー遵守とアカウントBAN防止' },
    { time: '12:00 - 12:45', title: '【出展企業向け講演】', desc: 'ライバーとのマッチングを成功させる方法' },
    { time: '13:00 - 14:00', title: 'お昼休憩＆ブース回遊', desc: 'ライバーによるゲリラ配信タイム' },
    { time: '14:00 - 16:30', title: '【スポンサーPRセミナー枠】', desc: '各社主力商品プレゼン（1枠20～30分）' },
    { time: '16:45 - 17:30', title: '【クロージングパネル】', desc: '著名タレント出演連動番組企画' },
    { time: '17:30 - 18:00', title: 'グランドフィナーレ', desc: 'イベントの締めくくり、記念撮影' },
  ];

  return (
    <section ref={ref} className={`bg-[#111] py-16 md:py-24 text-white transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-12 text-center">
          <span className="text-gray-500 text-sm tracking-wider">Event Schedule</span>
          <h2 className="text-3xl md:text-4xl font-black mt-2">イベントスケジュール</h2>
          <p className="text-gray-500 text-sm mt-3">※イベント内容は変更になる場合がございます。</p>
        </div>

        {/* DAY 1 */}
        <div className="mb-12">
          <div className="bg-[#dc2626] text-white text-center py-3 rounded-t-xl font-bold text-xl">
            DAY 1 — 9月8日（火）
          </div>
          <div className="bg-[#1a1a1a] rounded-b-xl divide-y divide-white/10">
            {day1.map((item) => (
              <div key={item.time} className="px-6 py-5">
                <p className="text-[#dc2626] font-bold text-sm mb-1">{item.time}</p>
                <p className="font-bold text-base">{item.title}</p>
                <p className="text-gray-400 text-sm mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* DAY 2 */}
        <div>
          <div className="bg-[#eab308] text-black text-center py-3 rounded-t-xl font-bold text-xl">
            DAY 2 — 9月9日（水）
          </div>
          <div className="bg-[#1a1a1a] rounded-b-xl divide-y divide-white/10">
            {day2.map((item) => (
              <div key={item.time} className="px-6 py-5">
                <p className="text-[#eab308] font-bold text-sm mb-1">{item.time}</p>
                <p className="font-bold text-base">{item.title}</p>
                <p className="text-gray-400 text-sm mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
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
              desc: 'PV想定1000万回。SNSでのUGC拡散で、ブランド認知を一気に拡大。',
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
      <p className="mt-1 text-gray-400">主催: LCF実行委員会 ｜ 共同企画: MOB Inc. × Live Commerce Japan</p>
      <p className="mt-2">
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">
          {CONTACT_EMAIL}
        </a>
      </p>
    </footer>
  );
}

/* ─── Main Page Component ─── */
export default function LiveCommerceFestival() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TopBar />
      <HeroSection />
      <SpecialGuestSection />
      <CampaignBanner />
      <TopLiveCommercerSection />
      <MessageSection />
      <StatsSection />
      <ProgramSection />
      <VenueSection />
      <EventScheduleSection />
      <LineCTASection />
      <CorporateSection />
      <OverviewSection />
      <LCFFooter />
    </div>
  );
}
