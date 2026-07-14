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
const LINE_URL = 'https://lin.ee/Rb1fvvy';

const IMAGES = {
  heroBg: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/msZWaikKboqlefJH.png",
  logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ZjvFdcWckPHcZxCi.png",
  gift: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vLYpJIHgEThRqpsE.png",
  liveStreaming1: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/UZmkVlBOQoJOYEUu.jpg",
  liveStreaming2: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/BCKHeXwJpBkvpABz.jpg",
  audience: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/oaOEjrRDSwDoEpTH.jpg",
  networking: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ztsHPdpkFIfuGFHe.jpg",
  happoVenue: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/DwVkbpUhTwHmEAWU.jpeg",
  happoBanquet: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/KzjrGXFLoNuYbLAY.jpg",
  happoGarden: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/yWeAfLGtjSSQDDwS.jpg",
  // 出演者写真
  tsubame: "/speakers/tsubame.webp",
  kyogokuRyu: "/speakers/kyogoku-ryu.webp",
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
        <TopAnnouncementBar />
        <HeroSection />
        <SpeakersSection />
        <CampaignBanner />
        <StatsSection />
        <LiveHighlightSection />
        <ProgramSection />
        <VenueSection />
        <SponsorSection />
        <EventScheduleSection />
        <MatchingSection />
        <LineCTASection />
        <OverviewSection />
        <FooterSection />
      </div>
    </>
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
      className="relative py-16 md:py-24 overflow-hidden"
      style={{
        backgroundImage: `url(${IMAGES.heroBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Date badge - top left */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-10">
        <div className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>2026年9月8日（火）- 9日（水）</span>
          </div>
          <div className="text-xs mt-1 opacity-90">会場: 八芳園（白金台）・参加無料！</div>
        </div>
      </div>

      <div className="container mx-auto px-4 text-center relative z-10">
        {/* Logo - large and impactful */}
        <div className="mb-8 md:mb-10">
          <img
            src={IMAGES.logo}
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

        {/* LINE CTA Button - Primary */}
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 bg-[#06C755] hover:bg-[#05b04c] text-white text-xl md:text-2xl font-bold px-10 md:px-16 py-5 md:py-6 rounded-xl shadow-[0_8px_30px_rgba(6,199,85,0.4)] transform hover:scale-105 transition-all duration-200 active:scale-95"
        >
          <LineIcon className="w-8 h-8" />
          今すぐ無料で事前登録する →
        </a>
        <p className="text-sm text-gray-600 mt-4">
          LINE登録後、30秒で完了します。
        </p>
      </div>
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
      stat: "TikTok売上", 
      statValue: "1.2", 
      statUnit: "億円",
      image: IMAGES.kyogokuRyu,
      hasPhoto: true,
    },
    { 
      name: "燕", 
      title: "トップコマースライバー", 
      stat: "TikTokフォロワー", 
      statValue: "50", 
      statUnit: "万人",
      image: IMAGES.tsubame,
      hasPhoto: true,
    },
    { 
      name: "プリンスこうや", 
      title: "株式会社MOB 取締役", 
      stat: "TikTok売上", 
      statValue: "8000", 
      statUnit: "万円",
      image: null,
      hasPhoto: false,
    },
    { 
      name: "JOY", 
      title: "タレント / ゲスト出演", 
      stat: "SNS総フォロワー", 
      statValue: "100", 
      statUnit: "万人超",
      image: null,
      hasPhoto: false,
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
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
                <div>
                  <p className="text-[10px] text-gray-500">{s.stat}</p>
                  <p className="text-xl md:text-2xl font-black text-red-500">
                    {s.statValue}<span className="text-sm font-normal text-gray-400">{s.statUnit}</span>
                  </p>
                </div>
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
// Campaign Banner — 事前登録キャンペーン（白カード on 黄色背景）
// ============================================================
function CampaignBanner() {
  return (
    <section className="bg-[#FFD700] py-10 md:py-14 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-10 relative overflow-hidden border-4 border-red-500">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Gift box image */}
            <div className="w-28 md:w-36 flex-shrink-0">
              <img src={IMAGES.gift} alt="豪華特典" className="w-full" />
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
  const stat1 = useCountUp(80);
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
            <p className="absolute bottom-3 left-3 text-white text-sm font-semibold">会場の熱気</p>
          </div>
          
          <div className="relative rounded-2xl overflow-hidden group">
            <img 
              src={IMAGES.liveStreaming2} 
              alt="メインステージでのライブ配信" 
              className="w-full h-full object-cover aspect-square group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <p className="absolute bottom-3 left-3 text-white text-sm font-semibold">メインステージ</p>
          </div>
          
          <div className="col-span-2 md:col-span-3 relative rounded-2xl overflow-hidden group">
            <img 
              src={IMAGES.networking} 
              alt="ネットワーキングパーティー" 
              className="w-full h-48 md:h-64 object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <p className="text-white font-bold text-lg">ネットワーキング & アフターパーティー</p>
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
            <span className="text-[#FFD700] text-sm font-medium tracking-wider">About / Content</span>
            <div className="w-6 h-[2px] bg-[#FFD700]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white">プログラム</h2>
        </div>
        
        <div className="space-y-10 text-white">
          <div>
            <h3 className="text-[#FFD700] font-bold text-lg md:text-xl mb-3">現場ライブコマース（ライバーマッチング＆販売）:</h3>
            <p className="text-gray-300 leading-relaxed">
              出展企業が製品を展示するだけではなく、事前ライバーさんと組み、会場から直接配信を実施することが可能。
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
        
        {/* LINE Registration CTA */}
        <div className="mt-12 text-center">
          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#06C755] hover:bg-[#05b04c] text-white text-lg md:text-xl font-bold px-10 md:px-14 py-4 md:py-5 rounded-xl shadow-[0_8px_30px_rgba(6,199,85,0.4)] transform hover:scale-105 transition-all duration-200 active:scale-95"
          >
            <LineIcon className="w-6 h-6" />
            LINE登録して参加する
          </a>
          <p className="text-xs text-gray-500 mt-3">
            参加費無料（事前LINE登録制）
          </p>
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
              <li>• 出展ブースエリア（約27社）</li>
              <li>• メインステージ（大型LED背景）</li>
              <li>• タイトルスポンサー大型区画</li>
              <li>• プレミアムスポンサー区画</li>
            </ul>
          </div>
          <div className="p-5 rounded-xl border border-red-500/30 bg-red-500/5">
            <h4 className="font-bold text-red-400 mb-2">6F — HALL HAKU</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• 出展ブースエリア（約39社）</li>
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
        <div className="grid md:grid-cols-3 gap-6 mb-10">
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
            <p className="text-3xl font-black mb-4">300<span className="text-lg">万円</span></p>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> ローテーション露出</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> ブース区画（3m×3.6m）</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> 参加ライバーへの事前告知</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> セミナー登壇枠</li>
            </ul>
          </div>
          
          {/* Booth */}
          <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="text-xs text-gray-500 mb-1">66社（先着審査制）</div>
            <h3 className="text-lg font-bold mb-1">会場ブース出展</h3>
            <p className="text-3xl font-black mb-4">60<span className="text-lg">万円</span></p>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> 標準ブース（2m×2m）</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> 企業名一覧掲出</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> ライバーマッチング</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" /> 現場ライブ配信可能</li>
            </ul>
          </div>
        </div>
        
        {/* Contact CTA */}
        <div className="text-center bg-gradient-to-r from-[#FFD700]/10 to-red-500/10 border border-[#FFD700]/30 rounded-2xl p-8 md:p-12">
          <h3 className="text-2xl font-bold mb-4">出展・スポンサーのお問い合わせ</h3>
          <p className="text-gray-400 mb-6">出展プラン・スポンサー枠の詳細はメールにてお問い合わせください。</p>
          <a
            href="mailto:info@livecommercejapan.jp"
            className="inline-block bg-white text-gray-900 text-lg font-bold px-10 py-4 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
          >
            企業様お問い合わせはこちら
          </a>
          <p className="text-gray-500 text-sm mt-3">info@livecommercejapan.jp</p>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Event Schedule Section (DAY 1 & DAY 2)
// ============================================================
function EventScheduleSection() {
  const reveal = useScrollReveal();

  const day1Program = [
    { time: '13:00 - 13:30', title: '【オープニングキーノート】', subtitle: '日本のライブコマース市場の未来と本イベントの意義' },
    { time: '13:45 - 14:30', title: '【TikTok公式セミナー】', subtitle: 'TikTok Shopの最新トレンドと今後の展望' },
    { time: '14:45 - 15:30', title: '【トップライブコマーサー対談】', subtitle: '億を売る「勝者のメンタリティ」と配信の裏側' },
    { time: '15:45 - 16:30', title: '【ライバー向け講演】', subtitle: '「ライバー」から「ライブコマーサー」への進化' },
    { time: '16:45 - 17:30', title: '【出展企業・TSP向け講演】', subtitle: 'ジャンル別成功事例と売れる座組の作り方' },
    { time: '18:30 - 20:30', title: 'アフターパーティー＆受賞式', subtitle: 'VIP/BARエリア及びDJブースでのネットワーキング' },
  ];

  const day2Program = [
    { time: '10:00 - 10:45', title: '【新機能活用事例】', subtitle: '抽選機能などで熱狂を生む方法' },
    { time: '11:00 - 11:45', title: '【TikTok公式セミナー・応用編】', subtitle: 'ポリシー遵守とアカウントBAN防止' },
    { time: '12:00 - 12:45', title: '【出展企業向け講演】', subtitle: 'ライバーとのマッチングを成功させる方法' },
    { time: '13:00 - 14:00', title: 'お昼休憩＆ブース回遊', subtitle: 'ライバーによるゲリラ配信タイム' },
    { time: '14:00 - 16:30', title: '【スポンサーPRセミナー枠】', subtitle: '各社主力商品プレゼン（1枠20〜30分）' },
    { time: '16:45 - 17:30', title: '【クロージングパネル】', subtitle: '著名タレント出演連動番組企画' },
    { time: '17:30 - 18:00', title: 'グランドフィナーレ', subtitle: 'イベントの締めくくり、記念撮影' },
  ];

  return (
    <section className="bg-[#111] py-16 md:py-24 px-4 text-white">
      <div ref={reveal.ref} className={`max-w-6xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-6 h-[2px] bg-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium tracking-wider">Event Schedule</span>
            <div className="w-6 h-[2px] bg-[#FFD700]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black">イベントスケジュール</h2>
          <p className="text-xs text-gray-500 mt-2">※イベント内容は変更になる場合がございます。</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* DAY 1 */}
          <div>
            <div className="bg-red-600 text-white text-center py-3 rounded-t-xl font-bold text-lg">
              DAY 1 — 9月8日（火）
            </div>
            <div className="border border-white/10 border-t-0 rounded-b-xl overflow-hidden">
              {day1Program.map((item, i) => (
                <div key={i} className={`p-4 ${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'} border-b border-white/5 last:border-b-0`}>
                  <div className="text-xs text-[#FFD700] font-semibold mb-1">{item.time}</div>
                  <div className="font-bold text-sm">{item.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.subtitle}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DAY 2 */}
          <div>
            <div className="bg-[#FFD700] text-black text-center py-3 rounded-t-xl font-bold text-lg">
              DAY 2 — 9月9日（水）
            </div>
            <div className="border border-white/10 border-t-0 rounded-b-xl overflow-hidden">
              {day2Program.map((item, i) => (
                <div key={i} className={`p-4 ${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'} border-b border-white/5 last:border-b-0`}>
                  <div className="text-xs text-[#FFD700] font-semibold mb-1">{item.time}</div>
                  <div className="font-bold text-sm">{item.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.subtitle}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Matching Section
// ============================================================
function MatchingSection() {
  const reveal = useScrollReveal();

  const steps = [
    { step: 'STEP1', title: '商材登録', timing: '出展申込時', desc: '最大3SKUの商材情報を委員会へ申請。' },
    { step: 'STEP2', title: 'カタログ公開', timing: '開催1ヶ月前', desc: '審査通過商材をWEBカタログに掲載。' },
    { step: 'STEP3', title: 'エントリー', timing: '開催3週間前', desc: 'ライバーが希望商材を選択しエントリー。' },
    { step: 'STEP4', title: 'マッチング確定', timing: '開催2週間前', desc: '配信タイムテーブルを確定し双方に通知。' },
    { step: 'STEP5', title: '事前準備', timing: '開催1〜2週間前', desc: 'TikTok Shop上でTAP連携・サンプル発送。' },
    { step: 'STEP6', title: '当日配信', timing: 'イベント当日', desc: 'ブースでライブ配信・販売をスタート。' },
  ];

  return (
    <section className="bg-[#FFD700] py-16 md:py-20 px-4">
      <div ref={reveal.ref} className={`max-w-6xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900">ライバー事前マッチング</h2>
          <p className="text-gray-700 mt-2">すべての出店者が、事前にご来場ライバーとのマッチングが可能です</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {steps.map((s, i) => (
            <div key={i} className="rounded-xl bg-white shadow-lg p-4 text-center hover:scale-[1.03] transition-transform">
              <div className="text-red-600 font-black text-sm mb-1">{s.step}</div>
              <div className="font-bold text-gray-900 text-sm mb-0.5">{s.title}</div>
              <div className="text-[10px] text-gray-500 mb-2">{s.timing}</div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
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
            企業様お問い合わせ
          </a>
          <a
            href="/livecommercefestival/2026/apply/liver"
            className="px-8 py-3 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-100 transition-all shadow-lg flex items-center gap-2"
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

// ============================================================
// Footer Section
// ============================================================
function FooterSection() {
  return (
    <footer className="bg-black py-8 text-center text-gray-500 text-sm">
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
