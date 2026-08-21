/**
 * ============================================================
 * LIVE COMMERCE FESTIVAL 2026 LP
 * ============================================================
 * Design: 黄色×赤のポップ路線（SNS万博スタイル）
 * Tone: 祭り感・ワクワク・人間味
 * URL: /livecommercefestival/2026
 * ============================================================
 */
import { useEffect, useRef, useState } from 'react';
import { 
  Calendar, MapPin, Users, TrendingUp, Mic2, 
  Trophy, Building2, Sparkles, ArrowRight, 
  Clock, Star, Monitor, Music, Wine, 
  CheckCircle2, ChevronDown, Play, Zap, PartyPopper, Gift
} from 'lucide-react';

// ============================================================
// Constants
// ============================================================
const LINE_URL = 'https://line.me/ti/g2/KsS3Ma1HW3okfwI2OowM6Ubk0UHKOHmb3nZFhA?utm_source=invitation&utm_medium=link_copy&utm_campaign=default';

// ★ メンテナンスモード: trueの場合「準備中」ページを表示
const MAINTENANCE_MODE = false;

const IMAGES = {
  heroBg: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/gRtnkNxJtwxtcJio.webp",
  logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/SvRAQbkcpavmYbaH.png",
  gift: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vLYpJIHgEThRqpsE.png",
  liveStreaming1: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/festival-live1-3GHNETvWsmJQdCMwzbaGq8.webp",
  liveStreaming2: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/festival-award-ceremony-BjfbNbdpD2oapovGcUkdbh.webp",
  audience: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/festival-audience1-jhHAWDCEGuB7yAee8xVygL.webp",
  networking: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/festival-networking1-cNnd5cLwRtHw335G3ZW8DU.webp",
  happoVenue: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/DwVkbpUhTwHmEAWU.jpeg",
  happoBanquet: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/KzjrGXFLoNuYbLAY.jpg",
  happoGarden: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/yWeAfLGtjSSQDDwS.jpg",
  // 出演者写真

  kyogokuRyu: "/speakers/kyogoku-ryu.webp",
  yun: "/manus-storage/yun-guest_35b1a386.webp",
};

// ============================================================
// LINE Icon SVG Component
// ============================================================
function LineIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} xmlns="http://www.w3.org/2000/svg">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

// ============================================================
// Scroll Reveal Hook
// ============================================================
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

// ============================================================
// Counter Animation Hook
// ============================================================
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [started, end, duration]);
  return { count, ref };
}

// ============================================================
// CSS Keyframes
// ============================================================
const festivalStyles = `
@keyframes bounce-in {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes slide-up {
  0% { transform: translateY(30px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes pulse-scale {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
.animate-slide-up { animation: slide-up 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
.animate-pulse-scale { animation: pulse-scale 2s ease-in-out infinite; }
.animate-marquee { animation: marquee 20s linear infinite; }
`;

// ============================================================
// Main Component
// ============================================================
export default function LiveCommerceFestival() {
  // メンテナンスモード: 準備中ページを表示
  if (MAINTENANCE_MODE) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center px-6 max-w-lg">
          <div className="mb-8">
            <img src={IMAGES.logo} alt="Live Commerce Festival" className="w-48 mx-auto opacity-90" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            準備中
          </h1>
          <p className="text-gray-400 text-lg mb-6">
            Live Commerce Festival は現在準備中です。<br />
            まもなく公開予定ですので、しばらくお待ちください。
          </p>
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-5 py-2.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
            <span className="text-yellow-400 text-sm font-medium">Coming Soon</span>
          </div>
          <div className="mt-10 text-gray-600 text-xs">
            &copy; 2026 Live Commerce Festival 実行委員会
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    document.title = 'Live Commerce Festival | \u65e5\u672c\u6700\u5927\u7d1a\u30e9\u30a4\u30d6\u30b3\u30de\u30fc\u30b9\u796d\u5178';
    const existingIcon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (existingIcon) {
      existingIcon.href = '/festival-favicon.svg';
      existingIcon.type = 'image/svg+xml';
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = '/festival-favicon.svg';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: festivalStyles }} />
      <div className="min-h-screen bg-[#FFD700] text-gray-900 overflow-hidden">
        <StickyHeader />
        <div className="pt-14">
          <TopAnnouncementBar />
        </div>
        <HeroSection />
        <GuestIntroSection />
        <TopLiveCommercerSection />
        <SpecialLiversSection />
        <CampaignBanner />
        <StatsSection />
        <LiveHighlightSection />
        <ProgramSection />
        <VenueSection />
        <SponsorSection />

        <LineCTASection />
        <OverviewSection />
        <FooterSection />
        <MobileFloatingCTA />
      </div>
    </>
  );
}

// ============================================================
// Sticky Header Navigation
// ============================================================
function StickyHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <a href="/livecommercefestival/2026" className="flex items-center gap-2">
          <img src={IMAGES.logo} alt="LCF" className="h-8 md:h-10" />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-3">
          <a
            href="/livecommercefestival/2026/apply/company"
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              scrolled ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white/90 text-gray-900 hover:bg-white'
            }`}
          >
            企業様お申し込み
          </a>
          <a
            href="/livecommercefestival/2026/apply/liver"
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              scrolled ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-purple-600 text-white hover:bg-purple-500'
            }`}
          >
            ライバー申し込み
          </a>
          <a
            href="/livecommercefestival/2026/apply/general"
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              scrolled ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-green-600 text-white hover:bg-green-500'
            }`}
          >
            一般参加 申込
          </a>

          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-bold rounded-lg bg-[#06C755] text-white hover:bg-[#05b04c] transition-all flex items-center gap-1.5"
          >
            <LineIcon className="w-4 h-4" />
            今すぐ事前登録
          </a>
          <a
            href="/lcf/booth-reservation"
            className="px-4 py-2 text-sm font-bold rounded-lg text-black hover:brightness-110 transition-all flex items-center gap-1.5"
            style={{ background: "linear-gradient(135deg, #C9A96E, #E8D5A3)" }}
          >
            🎬 LIVE BOOTH
          </a>
          <a
            href="/lcf/ranking"
            className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:brightness-110 transition-all flex items-center gap-1.5"
          >
            🏆 RANKING
          </a>
          <a
            href="/lcf/mypage"
            className="px-4 py-2 text-sm font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            マイページ
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`md:hidden p-2 rounded-lg transition-colors ${
            scrolled ? 'text-gray-900 hover:bg-gray-100' : 'text-gray-800 hover:bg-white/20'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg">
          <div className="px-4 py-4 space-y-3">
            <a href="/livecommercefestival/2026/apply/company" className="block px-4 py-3 bg-gray-900 text-white font-bold rounded-lg text-center">
              企業様お申し込み
            </a>
            <a href="/livecommercefestival/2026/apply/liver" className="block px-4 py-3 bg-purple-600 text-white font-bold rounded-lg text-center">
              ライバー申し込み
            </a>
            <a href="/livecommercefestival/2026/apply/general" className="block px-4 py-3 bg-green-600 text-white font-bold rounded-lg text-center">
              一般参加
            </a>

            <a href={LINE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-3 bg-[#06C755] text-white font-bold rounded-lg">
              <LineIcon className="w-5 h-5" />
              今すぐ事前登録
            </a>
            <a href="/lcf/ranking" className="block w-full px-4 py-3 text-center font-bold rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:brightness-110 transition-colors">
              🏆 RANKING
            </a>
            <a href="/lcf/mypage" className="block w-full px-4 py-3 text-center font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors">
              マイページ / ログイン
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

// ============================================================
// Top Announcement Bar — Red ticker
// ============================================================
function TopAnnouncementBar() {
  return (
    <div className="bg-red-600 text-white py-2.5 px-4 relative overflow-hidden">
      <div className="flex items-center justify-center gap-4 md:gap-8 text-sm md:text-base font-bold flex-wrap">
        <span>2026年9月8日-9日開催！</span>
        <span className="hidden sm:inline text-red-300">|</span>
        <span>会場: 八芳園（白金台）</span>
        <span className="hidden sm:inline text-red-300">|</span>
        <span>参加無料！</span>
        <span className="hidden sm:inline text-red-300">|</span>
        <span>LINE登録で30秒完了！</span>
      </div>
    </div>
  );
}

// ============================================================
// Hero Section — Yellow background with logo + LINE CTA
// ============================================================
function HeroSection() {
  return (
    <section
      className="relative overflow-hidden"
    >
      {/* Background image */}
      <img
        src={IMAGES.heroBg}
        alt="Live Commerce Festival 2026"
        className="w-full h-auto block"
      />
      {/* Clickable areas over the background image buttons */}
      {/* LINE登録ボタン - 中央上部 */}
      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute hover:bg-white/10 transition-colors rounded-xl cursor-pointer"
        style={{ top: '52%', left: '32%', width: '36%', height: '10%' }}
        aria-label="今すぐ無料で事前登録する"
      />
      {/* 企業様お申し込み - 中央左下 */}
      <a
        href="/livecommercefestival/2026/apply/company"
        className="absolute hover:bg-white/10 transition-colors rounded-lg cursor-pointer"
        style={{ top: '64%', left: '32%', width: '17%', height: '8%' }}
        aria-label="企業様お申し込みはこちら"
      />
      {/* ライバー申し込み - 中央右下 */}
      <a
        href="/livecommercefestival/2026/apply/liver"
        className="absolute hover:bg-white/10 transition-colors rounded-lg cursor-pointer"
        style={{ top: '64%', left: '50%', width: '17%', height: '8%' }}
        aria-label="ライバー申し込みはこちら"
      />
    </section>
  );
}

// ============================================================
// Speakers Section — SNS万博スタイルの写真カード（黄色背景）
// ============================================================
function SpeakersSection() {
  const reveal = useScrollReveal();
  
  const mainSpeakers = [
    { 
      name: "京極 琉", 
      title: "Live Commerce Japan CEO", 
      stat: "", 
      statValue: "", 
      statUnit: "",
      image: IMAGES.kyogokuRyu,
      hasPhoto: true,
    },

    { 
      name: "プリンスこうや", 
      title: "株式会社MOB 取締役", 
      stat: "", 
      statValue: "", 
      statUnit: "",
      image: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/iTHXCXcDGnQWMzkr.webp',
      hasPhoto: true,
    },
    { 
      name: "JOY", 
      title: "タレント / ゲスト出演（9/8 生配信のみ出演）", 
      stat: "SNS総フォロワー", 
      statValue: "100", 
      statUnit: "万人超",
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vjAqkYolejYZqfed.jpg",
      hasPhoto: true,
    },
    { 
      name: "ゆん", 
      title: "YouTuber / タレント（9/8 生配信のみ出演）", 
      stat: "SNS総フォロワー", 
      statValue: "290", 
      statUnit: "万人超",
      image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/JrdLtSWrsMiHmheu.webp",
      hasPhoto: true,
    },
  ];
  
  return (
    <section className="bg-[#FFD700] py-16 md:py-20 px-4">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900">出演者</h2>
          <p className="text-gray-700 mt-2">日本のライブコマースを牽引するトッププレイヤーが集結</p>
        </div>
        
        {/* Main Speakers - Photo Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5">
          {mainSpeakers.map((s, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-[#1a1a1a] shadow-xl hover:shadow-2xl transition-all hover:scale-[1.03] group">
              {/* Photo area */}
              <div className="aspect-[3/4] relative overflow-hidden">
                {s.hasPhoto && s.image ? (
                  <img 
                    src={s.image} 
                    alt={s.name} 
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-700 to-gray-900">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400/40 to-yellow-600/40 flex items-center justify-center mx-auto mb-3 border-2 border-yellow-500/50">
                        <span className="text-3xl font-black text-yellow-300">{s.name[0]}</span>
                      </div>
                      <p className="text-xs text-gray-500">写真準備中</p>
                    </div>
                  </div>
                )}
                {/* Yellow accent line at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FFD700]" />
              </div>
              
              {/* Info area */}
              <div className="p-4 text-white">
                <h3 className="font-bold text-lg">{s.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 mb-3">{s.title}</p>
                {s.stat && (
                <div>
                  <p className="text-[10px] text-gray-500">{s.stat}</p>
                  <p className="text-xl md:text-2xl font-black text-red-500">
                    {s.statValue}<span className="text-sm font-normal text-gray-400">{s.statUnit}</span>
                  </p>
                </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* More livers */}
        <div className="mt-10 text-center">
          <p className="text-gray-800 font-bold mb-3">参加コマースライバー（一部）</p>
          <div className="flex flex-wrap justify-center gap-2">
            {["YAE", "Nana", "SHIHO", "ナオ＆マイキー", "KOSEI", "Tommy", "々みなみ々", "七瀬みほ", "jurinet", "ひな"].map((name, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-white/80 text-sm text-gray-800 font-medium shadow-sm">
                {name}
              </span>
            ))}
            <span className="px-3 py-1.5 rounded-full bg-red-600 text-sm text-white font-bold shadow-sm animate-pulse">
              + 300名以上
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Top Live Commercer Section — トップライブコマーサー
// ============================================================
function TopLiveCommercerSection() {
  const reveal = useScrollReveal();
  const topCommercers = [
    {
      name: '京極 琉',
      title: 'Live Commerce Japan CEO',
      stat: '',
      statValue: '',
      statUnit: '',
      image: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ALTJWcRgCsmFBOlK.webp',
      bio: '日本最大級のTikTokライブコマース事務所「Live Commerce Japan」代表。294名以上のライバーを擁し、TikTok公式パートナーとしてライブコマース業界の発展を牽引。',
    },
    {
      name: 'プリンスこうや',
      title: '株式会社MOB 取締役',
      stat: '',
      statValue: '',
      statUnit: '',
      image: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/jjiDqZxFyGExxlBE.webp',
      bio: 'TikTokライブコマースのトッププレイヤー。圧倒的なカリスマ性とトーク力で視聴者を魅了。株式会社MOB取締役として、ライブコマース事業の拡大に貢献。',
    },
    {
      name: '熊田 佳奈',
      title: 'トップライブコマーサー',
      stat: '',
      statValue: '',
      statUnit: '',
      image: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/mQoydCcUKpcfxILK.webp',
      bio: '人気TikTokチャンネル「ぞうねこちゃんねる」の創始者。親しみやすいキャラクターと商品紹介力でファンを獲得。ライブコマース界の注目株。',
    },
    {
      name: '燕 咏靖',
      title: 'S-Holdings代表取締役CEO',
      stat: '',
      statValue: '',
      statUnit: '',
      image: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/sJFtTAlIdyJMQeiv.webp',
      bio: 'S-Holdings代表取締役CEO。独自のファッションセンスとクリエイティブな発信力で、ライブコマース界に新たな風を吹き込む。',
    },
  ];

  return (
    <section className="bg-[#0a0a0a] py-16 md:py-20 px-4">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-10">
          <p className="text-[#FFD700] text-sm font-bold tracking-widest mb-2">TOP LIVE COMMERCER</p>
          <h2 className="text-3xl md:text-4xl font-black text-white">トップライブコマーサー</h2>
          <p className="text-gray-400 mt-2 text-sm">日本のライブコマース界を牽引するトッププレイヤー</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 md:gap-6">
          {topCommercers.map((c, i) => (
            <div
              key={i}
              className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-800 hover:border-[#FFD700]/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,215,0,0.15)] group"
            >
              {/* Photo */}
              <div className="aspect-[3/4] relative overflow-hidden">
                <img
                  src={c.image}
                  alt={c.name}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FFD700]" />
              </div>

              {/* Info */}
              <div className="p-5 text-white">
                <h3 className="font-bold text-xl">{c.name}</h3>
                <p className="text-xs text-gray-400 mt-1 mb-3">{c.title}</p>
                {c.stat && (
                <div>
                  <p className="text-[11px] text-gray-500">{c.stat}</p>
                  <p className="text-2xl md:text-3xl font-black text-[#FFD700]">
                    {c.statValue}<span className="text-sm font-normal text-gray-400">{c.statUnit}</span>
                  </p>
                </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Guest Intro Section — JOY & ゆん 出演者紹介
// ============================================================
function GuestIntroSection() {
  const reveal = useScrollReveal();
  const guests = [
    {
      name: '後藤真希',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/dArufbFqPTTePgKg.webp',
      title: '歌手・タレント',
      bio: '1999年より「モーニング娘。」3期メンバーとして活躍し、卒業後はソロアーティストとして本格的に活動を開始。2024年にデビュー25周年を迎え、2025年10月15日に記念アルバム『COLLECTION』をリリース。また、2021年に発売し大ヒットを記録した写真集『ramus』に続き、2024年に発売した『flos』はSNSを中心に大きな話題を呼びロングヒットを記録中。美容誌『美ST』のモデルとしても活躍し、豊富な美容知識がたびたび話題に。',
      sns: [],
    },
    {
      name: 'JOY',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vjAqkYolejYZqfed.jpg',
      title: 'タレント・モデル',
      bio: '2003年、雑誌「men\'s egg」でモデルデビュー。タレントとしてバラエティ番組を中心に幅広く活躍。群馬県高崎市の観光特使、「イクメン オブ ザ イヤー（芸能部門）」受賞。妻・maiとともに個人事務所「JAM\'s flower」にて活動中。',
      sns: [
        { label: 'X', url: 'https://x.com/JOY19850415' },
        { label: 'Instagram', url: 'https://www.instagram.com/joy_19850415/' },
      ],
    },
    {
      name: 'ゆん',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/JrdLtSWrsMiHmheu.webp',
      title: 'YouTuber・タレント',
      bio: '愛知県出身。SNS総フォロワー数290万人超。美容・コスメ・ファッション・育児ライフスタイルを発信。2024年「第17回ペアレンティングアワード」インフルエンサー部門受賞。2023年Fischer\'sリーダー・シルクロードと結婚。現在、タレントとしても幅広く活動中。',
      sns: [
        { label: 'Instagram', url: 'https://www.instagram.com/yuntaaam_s2/' },
        { label: 'YouTube', url: 'https://www.youtube.com/@yunnn.s2' },
      ],
    },
    {
      name: '景井ひな',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/rJqNwvfTVHQAdICo.webp',
      title: 'TikTokクリエイター・タレント',
      bio: '熊本県出身。TikTokフォロワー数国内女性No.1の1,000万人超。カンヌ国際映画祭2023で世界のクリエイター7人に選出。女優、モデルとしても活動し、NHK大河ドラマ「べらぼう〜蔦重栄華乃夢噺〜」、9月17日配信のNetflixシリーズ「ダウンタイム」などに出演。雑誌「JELLY」レギュラーモデルを務める。',
      sns: [
        { label: 'Instagram', url: 'https://www.instagram.com/kagei_hina/' },
        { label: 'TikTok', url: 'https://www.tiktok.com/@kageihina' },
        { label: 'X', url: 'https://x.com/hinatter0219' },
      ],
    },
  ];

  return (
    <section className="bg-[#0a0a0a] py-16 md:py-20 px-4">
      <div ref={reveal.ref} className={`max-w-7xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-10">
          <p className="text-[#FFD700] text-sm font-bold tracking-widest mb-2">SPECIAL GUEST</p>
          <h2 className="text-3xl md:text-4xl font-black text-white">ゲスト出演者</h2>
          <p className="text-gray-400 mt-2 text-sm">各界で活躍するスペシャルゲストが登場</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {guests.map((g, i) => (
            <div
              key={i}
              className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-800 hover:border-[#FFD700]/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,215,0,0.1)] group"
            >
              {/* Photo */}
              <div className="aspect-[4/5] relative overflow-hidden">
                <img
                  src={g.photo}
                  alt={g.name}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
                {/* Name overlay at bottom */}
                <div className="absolute bottom-4 left-4">
                  <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-lg">{g.name}</h3>
                  <p className="text-[#FFD700] text-sm font-medium">{g.title}</p>
                  <p className="text-gray-300 text-xs mt-1 opacity-80">9/8 生配信のみ出演</p>
                </div>
              </div>

              {/* Bio & SNS */}
              <div className="p-5 md:p-6">
                <p className="text-gray-300 text-sm leading-relaxed mb-4">{g.bio}</p>

              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Special Livers Section — スペシャルライバー紹介
// ============================================================
function SpecialLiversSection() {
  const reveal = useScrollReveal();
  const livers = [
    {
      name: '破天荒夫婦',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/uPeHrmJYvwvMPwUr.jpg',
      title: 'インフルエンサー（総フォロワ数200万人超え）',
      bio: 'りきやとみやびによる、人気の夫婦クリエイター。妻・みやびさんの破天荒で愛らしいキャラクターと、それを見守る夫・りきやさんの掛け合いが特徴で、日常の笑えるエピソードや家族の様子を発信し、多くのファンから支持されている。最近では、ライブコマースを積極的に取り込んでいる。',
    },
    {
      name: 'かける',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/YqiuXtkvoGPgWKcl.jpg',
      title: 'インフルエンサー',
      bio: 'TikTok歴8年の元カップルチャンネル「かけまる」のかける。2025年10月にTikTokショップアカウント「115SHOP」を設立し、自身もライブコマーサーとして現在活動中。月間1000万GMVを達成し、日本を代表するショップアカウントを目指し奮闘中。',
    },
    {
      name: 'しんたろー',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/LMKKcduHnOdERemF.png',
      title: 'インフルエンサー',
      bio: '登録者100万人超えのTikTokやYouTubeで大人気！武道館ライブを目標にアーティストとしても活動し、「シャッフルアイランド」などのリアリティ番組でも話題を集める注目のマルチインフルエンサー。',
    },
    {
      name: '城崎仁',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/QmzspkcPnTeebmQc.jpg',
      title: 'インフルエンサー',
      bio: '元カリスマホストのタレント。QVCなどのテレビ通販やライブコマース番組「城咲商店」で、驚異的な売上を誇る「カリスマ通販王」として活躍中。薬膳やダイエット、コスメ関連の専門資格も多数保持し、商品開発も手がける。',
    },
    {
      name: '百獣のいちか',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/MdeGSjDAchnTFvGx.png',
      title: 'インフルエンサー・ライバー',
      bio: '17LIVEを中心に活躍するトップライバー・インフルエンサー。2024年には同アプリの「超祭2024」でグランプリを獲得、月間獲得コイン数で世界2位を記録するなど日本一のライバーとして知られ、現在はライブコマース特化の配信事務所「株式会社スマートスタジオ」の代表も務めている。',
    },
    {
      name: '超無課金',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/VGjENlPPGvMTMRys.png',
      title: '起業家・インフルエンサー',
      bio: 'TikTok LIVEで活躍するトップライバー・プロデューサー。卓越した配信力と企画力を武器に、多くのファンを獲得。ライバー事務所「is N\'eat」の代表として、次世代クリエイターの育成にも力を注いでいる。',
    },
    {
      name: '齋藤 鷹一',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/MBBGKpmDbgUdRGWL.png',
      title: 'インフルエンサー・一般社団法人 SPCA Tokyo代表',
      bio: '犬猫の保護・譲渡活動を中心に、動物と人が共生できる社会の実現を目指し、保護・医療・リハビリ・譲渡まで一貫した支援活動を展開。TikTok Shopでは犬・猫に関する正しい知識を発信。自身が厳選したフードやおやつ、リードなどのペット用品を紹介し、動物と飼い主のより良い暮らしをサポートしている。',
    },
    {
      name: 'toki',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ROjhMiNJWbYuYxAq.jpg',
      title: 'ライブコマーサー',
      bio: 'TikTok Shopを中心にライブコマース事業に従事し、食品・日用品・美容商材など幅広いカテゴリーで販売を担当。数千万円規模のGMV創出にも携わり、商品の魅力を最大限に引き出すライブ配信を得意とする。企業・ブランド・視聴者をつなぐ新しい購買体験の創出を目指し活動している。',
    },
    {
      name: '王明陽（おうめいよう）',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/TDUfxfvIAeaxYIMe.png',
      title: 'ライブコマーサー',
      bio: 'TikTokを教える人。TikTok Shop・ショート動画の最前線で活躍するクリエイター。商品の魅力を分かりやすく伝える発信力を武器に、多くの視聴者を惹きつけるコンテンツを制作。エンタメ性と販売力を兼ね備え、TikTok時代の新たな購買体験を生み出している。',
    },
    {
      name: 'ライコマチャンネル',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/fSgHoKedlEZNRDgV.png',
      title: 'ライブコマーサー',
      bio: '美容・ライフスタイルを中心に発信するTikTokクリエイター。親しみやすいトークとリアルな使用感レビューを強みに、視聴者目線で商品の魅力を分かりやすく届けている。ライブ配信では視聴者とのコミュニケーションを大切にしながら、楽しく信頼できるショッピング体験を提供している。',
    },
    {
      name: 'きゃべつ',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/DNqbnjRrndaWLHvP.png',
      title: 'ライバー',
      bio: 'News配信や視聴者に寄り添ったコミュニケーションを強みとし、多くのファンから支持を集めるTikTok LIVEクリエイター。親しみやすいトークと丁寧な情報発信で高いエンゲージメントを生み出している。また、自身が運営するTikTok Shopチャンネル「逸心」では、食品を中心としたライブコマースを展開し、商品の魅力だけでなく、生産者やブランドの想いまで届ける配信スタイルを実践。LIVE配信とライブコマースの両分野で活躍するクリエイターとして、新たな購買体験を発信し続けている。',
    },
    {
      name: 'CARiNOミゲル',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/SRYFYIEYIgQWpquR.jpg',
      title: '起業家、ライバー',
      bio: '創業60年以上の靴メーカー代表として全国に靴店「CARiNO」を展開。2023年にTikTokデビューし、日本で2番目にギフターレベル50へ到達。イベント優勝13回、盾イベント2連覇、ライブコマースでは2時間で売上450万円を達成。経営、ライブ、コマースとすべての分野で結果を出し続ける経営者。',
    },
    {
      name: 'あゆ隊長',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/pYaYEFWZZnreUbfU.png',
      title: 'ライブコマーサー',
      bio: '「美味しい！」で人を幸せにする"うまいモンあゆ隊長"。全国に眠るまだ知られていない食の魅力をリアルに発信。うまいモンで人と地域をつなぎ、日本をもっと元気に！TikTok Shop食の先駆者として活動中！',
    },
    {
      name: 'ゆみ隊長',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/dNGPvXAGRgwWETan.png',
      title: 'ライブコマーサー',
      bio: '食欲には、誰も逆らえない！だからこそ「美味しい」は、人を本気で幸せにする力を持っている。全国各地にまだ知られていない食の魅力を発掘し、食でみんなの人生を豊かにする"うまいモンゆみ隊長"。TikTok Shop食の先駆者として活動中！',
    },
    {
      name: 'ナルド一家',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/pVHaAjuEykGxqTtU.png',
      title: 'ライブコマーサー',
      bio: '話し手の妻と、商品をあらゆる角度から深掘りする裏方のナルドパパで挑む「ナルド一家」。他では聞けない切り口まで掘り下げた、奥深い商品説明が特徴です。今は、まだまだやりたい事を封じている段階。今後はナルド一家の感性で、新たなライブコマースの世界観を一つずつ形にしていくタイミングを伺っている準備段階です。今後を楽しみに見守ってて下さい!',
    },
    {
      name: 'HONMAMON',
      photo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/IYidnILlzBxLuzIz.jpg',
      title: 'ライブコマーサー',
      bio: '「美しさに、品を。毎日に、凛とした私を。」『ホ。』が創り出すのは、時代に流されない"和美人"。選び抜いた"ホンマにええモン"をLIVEを通して届け、外見だけではなく、自信まで美しく。日本の女性が持つ美しさを、もっと輝かせる美容体験を創ります。',
    },
  ];

  return (
    <section className="bg-[#0a0a0a] py-16 md:py-20 px-4">
      <div ref={reveal.ref} className={`max-w-6xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-10">
          <p className="text-[#FFD700] text-sm font-bold tracking-widest mb-2">SPECIAL LIVERS</p>
          <h2 className="text-3xl md:text-4xl font-black text-white">スペシャルライバー</h2>

        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
          {livers.map((l, i) => (
            <div
              key={i}
              className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-gray-800 hover:border-[#FFD700]/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,215,0,0.1)] group"
            >
              {/* Photo */}
              <div className="aspect-[3/4] relative overflow-hidden">
                <img
                  src={l.photo}
                  alt={l.name}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <h3 className="text-sm md:text-base font-bold text-white drop-shadow-lg leading-tight">{l.name}</h3>

                </div>
              </div>

              {/* Bio */}
              <div className="p-3">
                <p className="text-gray-400 text-[11px] leading-relaxed">{l.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Campaign Banner — 事前登録キャンペーン（白カード on 黄色背景）
// ============================================================
function CampaignBanner() {
  return (
    <section className="relative py-12 md:py-16 px-4 overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFD700 0%, #FFC107 50%, #FFB300 100%)' }}>
      <div className="max-w-5xl mx-auto relative z-10">
        {/* Banner image */}
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/campaign-banner-full-HqKaP46JLDH2ms6EA6NMSg.png"
          alt="事前申込者限定 来場者限定プレゼント 10万円相当の商品が特典として付いてくる"
          className="w-full rounded-2xl shadow-[0_10px_60px_rgba(0,0,0,0.15)]"
        />

        {/* CTA below banner */}
        <div className="text-center mt-8">
          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#06C755] hover:bg-[#05b04c] text-white text-lg md:text-xl font-bold px-10 md:px-14 py-4 md:py-5 rounded-xl shadow-[0_8px_30px_rgba(6,199,85,0.4)] transform hover:scale-105 transition-all duration-200 active:scale-95"
          >
            <LineIcon className="w-6 h-6" />
            今すぐ無料で事前登録する →
          </a>
          <p className="text-sm text-gray-700 mt-3">
            LINE登録後、予約フォーム入力で30秒で完了します。
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Stats Section — Bold numbers on dark background
// ============================================================
function StatsSection() {
  const stat1 = useCountUp(40);
  const stat2 = useCountUp(300);
  const stat3 = useCountUp(22000);
  const stat4 = useCountUp(1600);
  
  return (
    <section className="bg-[#1a1a1a] py-14 md:py-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div ref={stat1.ref} className="text-center">
            <div className="text-4xl sm:text-5xl font-black text-[#FFD700]">{stat1.count}<span className="text-xl">社+</span></div>
            <div className="text-sm text-gray-400 mt-2">出展企業数</div>
          </div>
          <div ref={stat2.ref} className="text-center">
            <div className="text-4xl sm:text-5xl font-black text-red-500">{stat2.count}<span className="text-xl">名</span></div>
            <div className="text-sm text-gray-400 mt-2">来場ライバー</div>
          </div>
          <div ref={stat3.ref} className="text-center">
            <div className="text-4xl sm:text-5xl font-black text-[#FFD700]">{(stat3.count / 10000).toFixed(1)}<span className="text-xl">億円</span></div>
            <div className="text-sm text-gray-400 mt-2">GMV創出想定</div>
          </div>
          <div ref={stat4.ref} className="text-center">
            <div className="text-4xl sm:text-5xl font-black text-red-500">{stat4.count}<span className="text-xl">万回</span></div>
            <div className="text-sm text-gray-400 mt-2">PV想定</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Live Highlight Section — Photo gallery
// ============================================================
function LiveHighlightSection() {
  const reveal = useScrollReveal();
  
  return (
    <section className="bg-[#111] py-16 md:py-24 px-4">
      <div ref={reveal.ref} className={`max-w-6xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white">
            ライブコマースの<span className="text-[#FFD700]">熱狂</span>を、会場で。
          </h2>
          <p className="text-gray-400 mt-3 max-w-2xl mx-auto">
            トップライバーたちが会場から直接配信。リアルタイムで商品を紹介し、視聴者と繋がる新しいショッピング体験。
          </p>
        </div>
        
        {/* Photo Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden group">
            <img 
              src={IMAGES.liveStreaming1} 
              alt="ライバーがスマホでライブ配信中" 
              className="w-full h-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400 font-semibold uppercase tracking-wide">LIVE</span>
              </div>
              <p className="text-white font-bold text-lg">トップライバーによるリアルタイム配信</p>
            </div>
          </div>
          
          <div className="relative rounded-2xl overflow-hidden group">
            <img 
              src={IMAGES.audience} 
              alt="イベント会場の観客" 
              className="w-full h-full object-cover aspect-square group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <p className="absolute bottom-3 left-3 text-white text-sm font-semibold">講演会イメージ</p>
          </div>
          
          <div className="relative rounded-2xl overflow-hidden group">
            <img 
              src={IMAGES.liveStreaming2} 
              alt="アワードセレモニー" 
              className="w-full h-full object-cover aspect-square group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <p className="absolute bottom-3 left-3 text-white text-sm font-semibold">アフターパーティー & アワード</p>
          </div>
          
          <div className="col-span-2 md:col-span-3 relative rounded-2xl overflow-hidden group">
            <img 
              src={IMAGES.networking} 
              alt="ネットワーキングパーティー" 
              className="w-full h-48 md:h-64 object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <p className="text-white font-bold text-lg">ライバーと企業のマッチング</p>
              <p className="text-gray-300 text-sm mt-1">ライバーと企業の出会いが、新しいビジネスを生む</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Program Section — With LINE CTA
// ============================================================
function ProgramSection() {
  const reveal = useScrollReveal();
  
  return (
    <section id="program" className="bg-[#111] py-16 md:py-24 px-4">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-6 h-[2px] bg-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium tracking-wider">About / Contents</span>
            <div className="w-6 h-[2px] bg-[#FFD700]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white">プログラム</h2>
        </div>
        
        <div className="space-y-8 text-white">
          {/* 1. メーカー × ライバー マッチング */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-[#FFD700] rounded-lg flex items-center justify-center">
              <span className="text-black font-black text-xl">1</span>
            </div>
            <div>
              <h3 className="font-bold text-xl md:text-2xl mb-2">メーカー × ライバー マッチング</h3>
              <p className="text-gray-300 leading-relaxed">
                メーカーが実際に出展し、ライバーと直接商談。商品の魅力や販売方法を学び、理解から当日の販売までサポートするマッチングイベントを開催。
              </p>
            </div>
          </div>

          {/* 2. LIVE COMMERCE AWARD */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-[#E91E63] rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xl">2</span>
            </div>
            <div>
              <h3 className="font-bold text-xl md:text-2xl mb-1">LIVE COMMERCE AWARD <span className="text-[#FF6B35] text-base font-medium">（1日目展示会終了後）</span></h3>
              <p className="text-gray-300 leading-relaxed">
                出展企業・ライバー限定交流会。トップライバー・メーカーと交流しながら、カテゴリー別表彰式を実施。イベント当日は、各出展メーカー・ライブコマーサー・クリエイターがライブコマースで販売を行い、当日のGMV（流通総額）を競うコンテストを開催。TikTok Shopでの活動実績や市場への貢献度、コンテンツ力、販売実績、成長性などを総合的に評価し、優秀な企業・クリエイター・ライブコマーサーを表彰するライブコマース Award（授賞式）も実施。
              </p>
            </div>
          </div>

          {/* 3. DAY1 特別オンライン番組 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-[#4CAF50] rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xl">3</span>
            </div>
            <div>
              <h3 className="font-bold text-xl md:text-2xl mb-2">DAY1 特別オンライン番組</h3>
              <p className="text-gray-300 leading-relaxed">
                会場からTikTok LIVEで全国へ配信。ライブコマースの極意・成功事例・実践販売をリアルタイムでお届け。
              </p>
              <p className="text-[#FF6B35] text-sm mt-2">
                出演予定：後藤真希 / JOY / ゆん / 景井ひな / プリンスこうや / 京極琉 / 超無課金 and more...
              </p>
            </div>
          </div>

          {/* 4. DAY2 スペシャルセミナー */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-[#2196F3] rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xl">4</span>
            </div>
            <div>
              <h3 className="font-bold text-xl md:text-2xl mb-2">DAY2 スペシャルセミナー</h3>
              <p className="text-gray-300 leading-relaxed">
                ・トップライブコマーサー対談 ・TikTok Shop成功企業（TSP）講演会 ・動画コマースセミナー ・メーカーナレッジ共有
              </p>
            </div>
          </div>

          {/* 5. 来場者限定プレゼント */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-[#9C27B0] rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xl">5</span>
            </div>
            <div>
              <h3 className="font-bold text-xl md:text-2xl mb-2">来場者限定プレゼント</h3>
              <p className="text-gray-300 leading-relaxed">
                事前申込者限定。<span className="text-[#FF6B35] font-bold">10万円</span>相当の商品をプレゼント。
              </p>
            </div>
          </div>
        </div>
        
        {/* LINE Registration CTA */}
        <div className="mt-12 text-center">
          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#06C755] hover:bg-[#05b04c] text-white text-lg md:text-xl font-bold px-10 md:px-14 py-4 md:py-5 rounded-xl shadow-[0_8px_30px_rgba(6,199,85,0.4)] transform hover:scale-105 transition-all duration-200 active:scale-95"
          >
            <LineIcon className="w-6 h-6" />
            今すぐ無料で事前登録する →
          </a>
          <p className="text-xs text-gray-500 mt-3">
            参加費無料（事前LINE登録制）
          </p>
          {/* Sub CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <a href="/livecommercefestival/2026/apply/company" className="px-5 py-2 bg-white/10 border border-white/20 text-white text-sm font-bold rounded-lg hover:bg-white/20 transition-all flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              企業様
            </a>
            <a href="/livecommercefestival/2026/apply/liver" className="px-5 py-2 bg-white/10 border border-white/20 text-white text-sm font-bold rounded-lg hover:bg-white/20 transition-all flex items-center gap-2">
              <Mic2 className="w-4 h-4" />
              ライバー
            </a>

          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Venue Section
// ============================================================
function VenueSection() {
  const reveal = useScrollReveal();
  
  return (
    <section className="bg-[#0a0a0a] py-16 md:py-24 px-4 text-white">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-6 h-[2px] bg-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium tracking-wider">Venue</span>
            <div className="w-6 h-[2px] bg-[#FFD700]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black">会場</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="rounded-xl overflow-hidden shadow-2xl">
            <img src={IMAGES.happoVenue} alt="八芳園" className="w-full h-64 md:h-80 object-cover" />
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-bold mb-2">八芳園</h3>
            <p className="text-gray-500 text-sm mb-4">Happo-en</p>
            <div className="space-y-3 text-gray-300">
              <p className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#FFD700] mt-0.5" />
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
        
        {/* Floor Layout */}
        <div className="grid sm:grid-cols-2 gap-4 mt-10">
          <div className="p-5 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5">
            <h4 className="font-bold text-[#FFD700] mb-2">5F — STUDIO KOKU</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• 出展ブースエリア</li>
              <li>• メインステージ</li>
              <li>• タイトルスポンサー大型区画</li>
              <li>• プレミアムスポンサー区画</li>
            </ul>
          </div>
          <div className="p-5 rounded-xl border border-red-500/30 bg-red-500/5">
            <h4 className="font-bold text-red-400 mb-2">6F — HALL HAKU</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• 出展ブースエリア</li>
              <li>• セミナー・パネルディスカッション</li>
              <li>• 現場配信スペース</li>
              <li>• VIP/BAR・アフターパーティー会場</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Sponsor Section
// ============================================================
function SponsorSection() {
  const reveal = useScrollReveal();
  
  return (
    <section id="sponsor" className="bg-[#1a1a1a] py-16 md:py-24 px-4 text-white">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black mb-4">出展・協賛プラン</h2>
          <p className="text-gray-400 text-lg">ライブコマースで売上を最大化する新しいイベント出展モデル</p>
        </div>
        
        {/* Benefits */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: '🎯', title: 'ライバーとの即マッチング', desc: '300名のコマースライバーと直接出会い、その場で配信パートナーを見つけられます。' },
            { icon: '💰', title: '出展費の即回収', desc: '会場からライブ配信で販売。出展費をイベント当日に回収できるモデルです。' },
            { icon: '📈', title: '圧倒的な露出', desc: 'PV想定1600万回。SNSでのUGC拡散で、ブランド認知を爆発的に拡大。' },
          ].map((benefit) => (
            <div key={benefit.title} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:border-[#FFD700]/30 transition-colors">
              <div className="text-4xl mb-4">{benefit.icon}</div>
              <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
              <p className="text-gray-400 text-sm">{benefit.desc}</p>
            </div>
          ))}
        </div>

        {/* Sponsor Plans */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 mb-10">
          {/* Title Sponsor */}
          <div className="p-6 rounded-xl border-2 border-[#FFD700]/50 bg-gradient-to-b from-[#FFD700]/10 to-transparent relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#FFD700] text-black text-xs font-bold rounded-bl-lg">1社限定</div>
            <h3 className="text-lg font-bold text-[#FFD700] mb-1">タイトルスポンサー</h3>
            <p className="text-3xl font-black mb-4">1,500<span className="text-lg">万円</span></p>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#FFD700] mt-0.5 shrink-0" /> 「○○ presents」表記</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#FFD700] mt-0.5 shrink-0" /> メインステージ最大露出</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#FFD700] mt-0.5 shrink-0" /> WEB・公式ポスター大型掲載</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#FFD700] mt-0.5 shrink-0" /> 大型ブース（3m×9m）</li>
            </ul>
          </div>
          
          {/* Premium Sponsor */}
          <div className="p-6 rounded-xl border border-white/20 bg-white/[0.03]">
            <div className="text-xs text-gray-500 mb-1">4社限定</div>
            <h3 className="text-lg font-bold mb-1">プレミアムスポンサー</h3>
            <p className="text-3xl font-black mb-4">500<span className="text-lg">万円</span></p>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> ローテーション露出</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> ブース区画（3m×3.6m）</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> 参加ライバーへの事前告知</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> セミナー登壇枠</li>
            </ul>
          </div>
          
          {/* Booth */}
          <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="text-xs text-gray-500 mb-1">35社（先着審査制）</div>
            <h3 className="text-lg font-bold mb-1">会場ブース出展</h3>
            <p className="text-3xl font-black mb-4">100<span className="text-lg">万円</span></p>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> 標準ブース（2m×2m）</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> 企業名一覧掲出</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> ライバーマッチング</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> 現場ライブ配信可能</li>
            </ul>
          </div>

          {/* Sponsor Spot */}
          <div className="p-6 rounded-xl border border-purple-500/30 bg-purple-500/[0.05]">
            <div className="text-xs text-gray-500 mb-1">10社限定</div>
            <h3 className="text-lg font-bold mb-1">スポンサースポット</h3>
            <p className="text-3xl font-black mb-4">200<span className="text-lg">万円</span></p>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" /> ブース区画（2m×3m）</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" /> 公式サイト・SNS露出</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" /> ライバーマッチング優先</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" /> 配信素材提供</li>
            </ul>
          </div>

          {/* Online Sponsor */}
          <div className="p-6 rounded-xl border border-blue-500/30 bg-blue-500/[0.05]">
            <div className="text-xs text-gray-500 mb-1">制限なし</div>
            <h3 className="text-lg font-bold mb-1">オンライン出展</h3>
            <p className="text-3xl font-black mb-4">50<span className="text-lg">万円</span></p>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" /> オンラインブース掲載</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" /> ライバーマッチング</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" /> 商品サンプル配布枠</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" /> イベントレポート掲載</li>
            </ul>
          </div>

          {/* Media Partner */}
          <div className="p-6 rounded-xl border border-green-500/30 bg-green-500/[0.05]">
            <div className="text-xs text-gray-500 mb-1">5社限定</div>
            <h3 className="text-lg font-bold mb-1">メディアパートナー</h3>
            <p className="text-3xl font-black mb-4">300<span className="text-lg">万円</span></p>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> メディアブース（3m×3m）</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> ステージ登壇・MC枠</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> 公式メディア連携</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> 取材・撮影優先権</li>
            </ul>
          </div>
        </div>
        
        {/* Contact CTA */}
        <div className="text-center bg-gradient-to-r from-[#FFD700]/10 to-red-500/10 border border-[#FFD700]/30 rounded-2xl p-8 md:p-12">
          <h3 className="text-2xl font-bold mb-4">出展・スポンサーのお問い合わせ</h3>
          <p className="text-gray-400 mb-6">出展プラン・スポンサー枠の詳細はメールにてお問い合わせください。</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/livecommercefestival/2026/apply/company"
              className="inline-flex items-center gap-2 bg-[#FFD700] text-gray-900 text-lg font-bold px-10 py-4 rounded-xl hover:bg-[#ffe033] transition-colors shadow-lg"
            >
              <Building2 className="w-5 h-5" />
              出展・協賛申し込み
            </a>
            <a
              href="mailto:info@livecommercejapan.jp"
              className="inline-block bg-white text-gray-900 text-lg font-bold px-10 py-4 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
            >
              メールでお問い合わせ
            </a>
          </div>
          <p className="text-gray-500 text-sm mt-3">info@livecommercejapan.jp</p>
        </div>
      </div>
    </section>
  );
}



// ============================================================
// LINE CTA Section — Yellow background with big CTA
// ============================================================
function LineCTASection() {
  return (
    <section className="bg-[#FFD700] py-14 md:py-20 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
          ライバーとして参加しませんか？
        </h2>
        <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
          日本最大級のライブコマースイベントで、あなたのスキルを企業にアピール。
          マッチングからその場で配信・販売まで、新しいビジネスチャンスが待っています。
        </p>

        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 bg-[#06C755] hover:bg-[#05b04c] text-white text-xl md:text-2xl font-bold px-12 md:px-16 py-5 md:py-7 rounded-2xl shadow-[0_8px_30px_rgba(6,199,85,0.4)] transform hover:scale-105 transition-all duration-200 active:scale-95"
        >
          <LineIcon className="w-8 h-8" />
          今すぐ無料で事前登録する →
        </a>
        <p className="text-sm text-gray-600 mt-4">
          LINE登録後、予約フォーム入力で30秒で完了します。
        </p>
        
        {/* Additional CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <a
            href="/livecommercefestival/2026/apply/company"
            className="px-8 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-all shadow-lg flex items-center gap-2"
          >
            <Building2 className="w-5 h-5" />
            企業様お申し込み
          </a>
          <a
            href="/livecommercefestival/2026/apply/liver"
            className="px-8 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-500 transition-all shadow-lg flex items-center gap-2"
          >
            <Mic2 className="w-5 h-5" />
            ライバー申し込み
          </a>

        </div>
      </div>
    </section>
  );
}

// ============================================================
// Overview Section
// ============================================================
function OverviewSection() {
  return (
    <section className="bg-[#0a0a0a] py-16 md:py-20 px-4 text-white border-t border-white/10">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-black mb-10">開催概要</h2>

        <div className="space-y-4 text-base md:text-lg text-left">
          {[
            { label: 'イベント名', value: '第1回 Live Commerce Festival 2026' },
            { label: 'コンセプト', value: 'コマースライバーと企業のマッチング・セミナー型祭典' },
            { label: '開催日', value: '__CUSTOM_DATE__' },
            { label: '開催場所', value: '八芳園（東京・白金台）' },
            { label: '企画', value: 'LCF実行委員会' },
            { label: '参加費', value: '無料（事前LINE登録制）' },
          ].map((item) => (
            <div key={item.label} className="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b border-white/10 pb-3 gap-1">
              <span className="text-gray-400 text-sm sm:text-base">{item.label}</span>
              {item.value === '__CUSTOM_DATE__' ? (
                <span className="font-bold text-sm sm:text-base text-right">
                  <span>2026年9月8〜9日（2日間開催予定）</span>
                  <span className="block text-left text-xs sm:text-sm font-normal text-gray-300 mt-1">
                    8日：13:00〜18:00 ＆ 表彰パーティー 18:30〜21:00<br />
                    9日：11:00〜19:00
                  </span>
                </span>
              ) : (
                <span className="font-bold text-sm sm:text-base whitespace-pre-line text-right">{item.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Mobile Floating CTA Bar
// ============================================================
function MobileFloatingCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <a
          href="/livecommercefestival/2026/apply/company"
          className="flex-1 px-2 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg text-center"
        >
          企業様
        </a>
        <a
          href="/livecommercefestival/2026/apply/liver"
          className="flex-1 px-2 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg text-center"
        >
          ライバー
        </a>
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 px-2 py-2 bg-[#06C755] text-white text-xs font-bold rounded-lg text-center flex items-center justify-center gap-1"
        >
          <LineIcon className="w-3.5 h-3.5" />
          今すぐ事前登録
        </a>
      </div>
    </div>
  );
}

// ============================================================
// Footer Section
// ============================================================
function FooterSection() {
  return (
    <footer className="bg-black py-8 pb-20 md:pb-8 text-center text-gray-500 text-sm">
      <p>&copy; 2026 Live Commerce Festival 実行委員会. All Rights Reserved.</p>
      <p className="mt-2">
        主催: LCF実行委員会　｜　共同企画: MOB Inc. × Live Commerce Japan
      </p>
      <p className="mt-2">
        <a href="mailto:info@livecommercejapan.jp" className="hover:text-white transition-colors">
          info@livecommercejapan.jp
        </a>
      </p>
    </footer>
  );
}
