/**
 * ============================================================
 * LIVE COMMERCE FESTIVAL 2026 LP
 * ============================================================
 * Design: Premium dark with gold/amber accents + rich imagery
 * Tone: 共同主催（LCF実行委員会 / MOB × LCJ）
 * URL: /livecommercefestival/2026
 * ============================================================
 */
import { useEffect, useRef, useState } from 'react';
import { 
  Calendar, MapPin, Users, TrendingUp, Mic2, 
  Trophy, Building2, Sparkles, ArrowRight, 
  Clock, Star, Monitor, Music, Wine, 
  CheckCircle2, ChevronDown, Play
} from 'lucide-react';

// ============================================================
// Image Constants
// ============================================================
const IMAGES = {
  heroBg: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/dtNjcDataeRrGGsg.jpg",
  liveStreaming1: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/UZmkVlBOQoJOYEUu.jpg",
  liveStreaming2: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/BCKHeXwJpBkvpABz.jpg",
  audience: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/oaOEjrRDSwDoEpTH.jpg",
  networking: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ztsHPdpkFIfuGFHe.jpg",
  happoVenue: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/DwVkbpUhTwHmEAWU.jpeg",
  happoBanquet: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/KzjrGXFLoNuYbLAY.jpg",
  happoGarden: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/yWeAfLGtjSSQDDwS.jpg",
};

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
// Main Component
// ============================================================
export default function LiveCommerceFestival() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      <HeroSection />
      <StatsSection />
      <LiveHighlightSection />
      <ConceptSection />
      <ProgramSection />
      <SpeakersSection />
      <VenueSection />
      <SponsorSection />
      <EventScheduleSection />
      <MatchingSection />
      <ScheduleSection />
      <CTASection />
      <FooterSection />
    </div>
  );
}

// ============================================================
// Hero Section — Full-bleed image background
// ============================================================
function HeroSection() {
  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img 
          src={IMAGES.heroBg} 
          alt="Live Commerce Festival" 
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#0a0a0f]" />
      </div>
      
      {/* Animated accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-amber-400/40 bg-black/40 backdrop-blur-sm mb-8">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-300 tracking-wide font-medium">第1回 コマースライバーと企業のマッチング・セミナー型祭典</span>
        </div>
        
        {/* Title */}
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight mb-4">
          <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent drop-shadow-lg">
            LIVE COMMERCE
          </span>
          <br />
          <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
            FESTIVAL 2026
          </span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-gray-200 mt-6 max-w-2xl mx-auto leading-relaxed font-light">
          オンライン × オフラインの融合。<br className="sm:hidden" />
          日本最大級のライブコマース祭典が誕生。
        </p>
        
        {/* Date & Venue */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-10">
          <div className="flex items-center gap-2 text-white/90 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
            <Calendar className="w-5 h-5 text-amber-400" />
            <span className="text-lg font-semibold">2026.9.8 - 9.9</span>
          </div>
          <div className="flex items-center gap-2 text-white/90 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
            <MapPin className="w-5 h-5 text-amber-400" />
            <span className="text-lg font-semibold">八芳園（東京・白金台）</span>
          </div>
        </div>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <a
            href="#sponsor"
            className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/30 flex items-center gap-2 text-lg"
          >
            出展・協賛のお問い合わせ
            <ArrowRight className="w-5 h-5" />
          </a>
          <a
            href="#program"
            className="px-8 py-4 border border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all flex items-center gap-2"
          >
            プログラム詳細
            <ChevronDown className="w-4 h-4" />
          </a>
        </div>
        
        {/* Organizer */}
        <p className="text-sm text-gray-400 mt-12">
          主催: LCF実行委員会　｜　共同企画: MOB Inc. × Live Commerce Japan
        </p>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="w-6 h-6 text-amber-400/60" />
      </div>
    </section>
  );
}

// ============================================================
// Stats Section
// ============================================================
function StatsSection() {
  const stat1 = useCountUp(80);
  const stat2 = useCountUp(300);
  const stat3 = useCountUp(22000);
  const stat4 = useCountUp(1600);
  
  return (
    <section className="py-16 border-y border-amber-500/10 bg-gradient-to-r from-amber-950/10 via-transparent to-amber-950/10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div ref={stat1.ref} className="text-center">
            <div className="text-3xl sm:text-4xl font-black text-amber-400">{stat1.count}<span className="text-xl">社+</span></div>
            <div className="text-sm text-gray-400 mt-2">出展企業数</div>
          </div>
          <div ref={stat2.ref} className="text-center">
            <div className="text-3xl sm:text-4xl font-black text-amber-400">{stat2.count}<span className="text-xl">名</span></div>
            <div className="text-sm text-gray-400 mt-2">来場ライバー</div>
          </div>
          <div ref={stat3.ref} className="text-center">
            <div className="text-3xl sm:text-4xl font-black text-amber-400">{(stat3.count / 10000).toFixed(1)}<span className="text-xl">億円</span></div>
            <div className="text-sm text-gray-400 mt-2">GMV創出想定</div>
          </div>
          <div ref={stat4.ref} className="text-center">
            <div className="text-3xl sm:text-4xl font-black text-amber-400">{stat4.count}<span className="text-xl">万回</span></div>
            <div className="text-sm text-gray-400 mt-2">PV想定</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Live Highlight Section — Photo gallery of live commerce
// ============================================================
function LiveHighlightSection() {
  const reveal = useScrollReveal();
  
  return (
    <section className="py-20 px-4">
      <div ref={reveal.ref} className={`max-w-6xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Live Commerce</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">ライブコマースの熱狂を、会場で。</h2>
          <p className="text-gray-400 mt-3 max-w-2xl mx-auto">
            トップライバーたちが会場から直接配信。リアルタイムで商品を紹介し、視聴者と繋がる新しいショッピング体験。
          </p>
        </div>
        
        {/* Photo Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {/* Large featured image */}
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
          
          {/* Audience */}
          <div className="relative rounded-2xl overflow-hidden group">
            <img 
              src={IMAGES.audience} 
              alt="イベント会場の観客" 
              className="w-full h-full object-cover aspect-square group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <p className="absolute bottom-3 left-3 text-white text-sm font-semibold">会場の熱気</p>
          </div>
          
          {/* Stage */}
          <div className="relative rounded-2xl overflow-hidden group">
            <img 
              src={IMAGES.liveStreaming2} 
              alt="メインステージでのライブ配信" 
              className="w-full h-full object-cover aspect-square group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <p className="absolute bottom-3 left-3 text-white text-sm font-semibold">メインステージ</p>
          </div>
          
          {/* Networking - full width */}
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
// Concept Section
// ============================================================
function ConceptSection() {
  const reveal = useScrollReveal();
  
  return (
    <section className="py-20 px-4">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Concept</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">開催趣旨</h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              icon: <TrendingUp className="w-6 h-6" />,
              title: "TikTok Shopの認知拡大",
              desc: "業界を牽引し、TikTok上でのライブコマースイベントといえば「LCF」というポジションを確立する",
              img: IMAGES.liveStreaming1,
            },
            {
              icon: <Monitor className="w-6 h-6" />,
              title: "オンライン × オフライン融合",
              desc: "出展企業がライブコマースを実施しながら、会場およびオンラインでの販売を同時に行う新しい形",
              img: IMAGES.liveStreaming2,
            },
            {
              icon: <Building2 className="w-6 h-6" />,
              title: "出展費用の回収モデル",
              desc: "会場でのマッチングとライブ販売を通じて、その場で出展費用を回収できる日本初のエコシステム",
              img: IMAGES.audience,
            },
            {
              icon: <Sparkles className="w-6 h-6" />,
              title: "エンターテインメント × UGC",
              desc: "芸能人やインフルエンサー起用により外部メディアを誘致し、SNSでのUGCを爆発的に創出",
              img: IMAGES.networking,
            },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all overflow-hidden group">
              {/* Mini image header */}
              <div className="h-32 overflow-hidden">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="p-6">
                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Program Section
// ============================================================
function ProgramSection() {
  const reveal = useScrollReveal();
  
  return (
    <section id="program" className="py-20 px-4 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/5 to-transparent" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/3 rounded-full blur-[150px]" />
      
      <div ref={reveal.ref} className={`relative max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Program</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">プログラム</h2>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: <Mic2 />, title: "現場ライブコマース", desc: "事前マッチングしたライバーと組み、会場から直接TikTok LIVE配信を実施", img: IMAGES.liveStreaming1 },
            { icon: <Users />, title: "公開セミナー", desc: "トップライバー × トップマーケターによる講演。TikTok公式担当者トークショーも", img: IMAGES.happoVenue },
            { icon: <Trophy />, title: "表彰パーティー", desc: "Day1夜に開催。優秀ライバー・ブランドの表彰式とネットワーキング", img: IMAGES.networking },
            { icon: <Monitor />, title: "配信スペース", desc: "会場内3〜5箇所に設置。プロ照明・音響完備の本格配信環境", img: IMAGES.liveStreaming2 },
            { icon: <Music />, title: "DJブース & パーティー", desc: "アフターパーティーでライバーとブランド担当者の交流を促進", img: IMAGES.happoBanquet },
            { icon: <Wine />, title: "軽食 & ドリンク", desc: "VIPラウンジ・バーエリア完備。ビジネスミーティングにも最適", img: IMAGES.happoGarden },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] hover:border-amber-500/30 transition-all group overflow-hidden">
              {/* Program image */}
              <div className="h-36 overflow-hidden">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="p-5">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-3 group-hover:bg-amber-500/20 transition-colors">
                  {item.icon}
                </div>
                <h3 className="font-bold mb-1.5">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Speakers Section
// ============================================================
function SpeakersSection() {
  const reveal = useScrollReveal();
  
  const speakers = [
    { name: "プリンスこうや", title: "株式会社MOB 取締役", role: "トップライバー / MC" },
    { name: "京極 琉", title: "株式会社Live Commerce Japan 代表取締役CEO", role: "トップライバー / 主催" },
  ];
  
  const livers = [
    "YAE", "Nana", "SHIHO", "ナオ＆マイキー", "KOSEI", 
    "Tommy", "々みなみ々", "七瀬みほ", "jurinet", "ひな"
  ];
  
  return (
    <section className="py-20 px-4">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Speakers & Livers</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">出演者</h2>
        </div>
        
        {/* Main Speakers */}
        <div className="grid sm:grid-cols-2 gap-6 mb-10">
          {speakers.map((s, i) => (
            <div key={i} className="p-6 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold text-xl mb-4">
                {s.name[0]}
              </div>
              <h3 className="text-xl font-bold">{s.name}</h3>
              <p className="text-sm text-amber-400 mt-1">{s.title}</p>
              <p className="text-xs text-gray-500 mt-1">{s.role}</p>
            </div>
          ))}
        </div>
        
        {/* Guest */}
        <div className="mb-10 p-5 rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-400" />
            <span className="font-bold">ゲスト出演</span>
          </div>
          <p className="text-gray-400 mt-2 text-sm">JOY（タレント）ほか、著名ゲスト多数出演予定</p>
        </div>
        
        {/* Livers Grid */}
        <div>
          <h3 className="text-lg font-bold mb-4 text-center">参加コマースライバー（一部）</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {livers.map((name, i) => (
              <span key={i} className="px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-sm text-gray-300 hover:border-amber-500/30 hover:text-amber-300 transition-colors">
                {name}
              </span>
            ))}
            <span className="px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/5 text-sm text-amber-400">
              + 300名以上
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Venue Section — With Happo-en photos
// ============================================================
function VenueSection() {
  const reveal = useScrollReveal();
  
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/5 to-transparent" />
      
      <div ref={reveal.ref} className={`relative max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Venue</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">会場</h2>
        </div>
        
        {/* Venue Photo Gallery */}
        <div className="grid md:grid-cols-3 gap-3 mb-8">
          <div className="md:col-span-2 rounded-2xl overflow-hidden">
            <img 
              src={IMAGES.happoVenue} 
              alt="八芳園 セミナー会場" 
              className="w-full h-64 md:h-80 object-cover hover:scale-105 transition-transform duration-700"
            />
          </div>
          <div className="grid grid-rows-2 gap-3">
            <div className="rounded-2xl overflow-hidden">
              <img 
                src={IMAGES.happoBanquet} 
                alt="八芳園 宴会場" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
            <div className="rounded-2xl overflow-hidden">
              <img 
                src={IMAGES.happoGarden} 
                alt="八芳園 庭園ライトアップ" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
          </div>
        </div>
        
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="p-8">
            <h3 className="text-2xl font-bold mb-2">八芳園</h3>
            <p className="text-gray-400 mb-6">HAPPO-EN TOKYO — Unique Event Venue in Tokyo, Japan</p>
            
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">住所</p>
                  <p className="text-sm text-gray-400">東京都港区白金台1丁目1-1</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">使用フロア</p>
                  <p className="text-sm text-gray-400">5F STUDIO KOKU / 6F HALL HAKU</p>
                </div>
              </div>
            </div>
            
            {/* Floor Layout */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-white/10 bg-white/[0.02]">
                <h4 className="font-bold text-sm text-amber-400 mb-2">5F — STUDIO KOKU</h4>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• 出展ブースエリア（約27社）</li>
                  <li>• メインステージ（大型LED背景）</li>
                  <li>• タイトルスポンサー大型区画</li>
                  <li>• プレミアムスポンサー区画</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg border border-white/10 bg-white/[0.02]">
                <h4 className="font-bold text-sm text-amber-400 mb-2">6F — HALL HAKU</h4>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• 出展ブースエリア（約39社）</li>
                  <li>• セミナー・パネルディスカッション</li>
                  <li>• 現場配信スペース</li>
                  <li>• VIP/BAR・アフターパーティー会場</li>
                </ul>
              </div>
            </div>
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
    <section id="sponsor" className="py-20 px-4">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Sponsorship</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">出展・協賛プラン</h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {/* Title Sponsor */}
          <div className="p-6 rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded-bl-lg">1社限定</div>
            <h3 className="text-lg font-bold text-amber-400 mb-1">タイトルスポンサー</h3>
            <p className="text-3xl font-black mb-4">1,500<span className="text-lg">万円</span></p>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> 「○○ presents」表記</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> メインステージ最大露出</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> WEB・公式ポスター大型掲載</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> 大型ブース（3m×9m）</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> 全参加ライバーへの事前告知</li>
            </ul>
          </div>
          
          {/* Premium Sponsor */}
          <div className="p-6 rounded-xl border border-white/20 bg-white/[0.02]">
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
        
        {/* Additional Services */}
        <div className="mt-8 p-5 rounded-xl border border-white/10 bg-white/[0.02]">
          <h4 className="font-bold mb-3">追加オプション</h4>
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-400">
            <div>• LEDバックパネル（2m×2.25m）— 30万円〜</div>
            <div>• LEDスクリーン動画露出 — 要相談</div>
            <div>• トップライバー実演販売マッチング — 要相談</div>
            <div>• 商品説明会枠（事前予約制）— 要相談</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Schedule Section
// ============================================================
function ScheduleSection() {
  const reveal = useScrollReveal();
  
  const scheduleItems = [
    { date: "〜6月30日", label: "出展企業 締め切り", done: false },
    { date: "7/1 〜 7/15", label: "配信商品エントリー", done: false },
    { date: "7/15 〜 7/31", label: "実行委員会による商品審査 & リリース", done: false },
    { date: "8/1 〜 8/31", label: "ライバーによる選品", done: false },
    { date: "9/1〜", label: "事前配信開始", done: false },
    { date: "9/8", label: "Day 1: 13:00〜18:00 / 表彰パーティー 18:30〜20:30", done: false },
    { date: "9/9", label: "Day 2: 10:00〜18:00", done: false },
  ];
  
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-transparent via-amber-950/5 to-transparent">
      <div ref={reveal.ref} className={`max-w-3xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Schedule</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">スケジュール</h2>
        </div>
        
        <div className="space-y-0">
          {scheduleItems.map((item, i) => (
            <div key={i} className="flex gap-4 items-start">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${item.done ? 'bg-amber-400' : 'bg-white/20 border border-white/30'}`} />
                {i < scheduleItems.length - 1 && <div className="w-px h-12 bg-white/10" />}
              </div>
              {/* Content */}
              <div className="pb-6">
                <div className="text-xs text-amber-400 font-semibold">{item.date}</div>
                <div className="text-sm text-gray-300 mt-0.5">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Event Schedule Section (DAY 1 & DAY 2 Timetable)
// ============================================================
function EventScheduleSection() {
  const reveal = useScrollReveal();

  const day1Program = [
    { time: '13:00 - 13:30', title: '【オープニングキーノート】', subtitle: '日本のライブコマース市場の未来と本イベントの意義', speaker: 'LCF実行委員会\nゲスト：京極 琉氏、プリンスこうや氏など', purpose: '開会宣言とイベント趣旨の説明。' },
    { time: '13:45 - 14:30', title: '【TikTok公式セミナー】', subtitle: 'TikTok Shopの最新トレンドと今後の展望', speaker: 'TikTokショップ担当者', purpose: 'ライバー向け・ショップ向けノウハウ提供。プラットフォームの最新アルゴリズムや新機能のアップデート共有。' },
    { time: '14:45 - 15:30', title: '【トップライブコマーサー対談】', subtitle: '億を売る「勝者のメンタリティ」と配信の裏側', speaker: '京極氏、プリンス氏、カンナ氏', purpose: 'どのようにして視聴者を熱狂させ、コンバージョン（売上）に繋げているか、感情を動かす配信設計について。' },
    { time: '15:45 - 16:30', title: '【ライバー向け講演】', subtitle: '「ライバー」から「ライブコマーサー」への進化', speaker: '荒谷氏、ムゲン氏、ムカキン氏', purpose: 'ライブコマーサーとライバーの違いを解説。販売スキルの基礎と必要なマインドセットの共有。' },
    { time: '16:45 - 17:30', title: '【出展企業・TSP向け講演】', subtitle: 'ジャンル別成功事例と売れる座組の作り方', speaker: 'ビューティー系、食品系などのトップクリエイター・代理店', purpose: '商材別の成功事例を展示・解説。企業・TSP・ライバーの最適な協業モデルについて。' },
    { time: '18:30 - 20:30', title: 'アフターパーティー＆受賞式', subtitle: '', speaker: '-', purpose: 'VIP/BARエリア及びDJブースでのネットワーキング。' },
  ];

  const day2Program = [
    { time: '10:00 - 10:45', title: '【ライバー・出展企業向け】', subtitle: '新機能活用事例：抽選機能などで熱狂を生む方法', speaker: 'LCF実行委員会・実践ライバー', purpose: 'プリンスコヤトレカ販売事例などを題材に、新機能（オークション等）を活用した単価アップとエンタメ化の手法を紹介。' },
    { time: '11:00 - 11:45', title: '【TikTok公式セミナー・応用編】', subtitle: 'ポリシー遵守とアカウントBANを防ぐ安全な運用体制', speaker: 'TikTokショップ担当者', purpose: 'コンプライアンス講習。NGワード、薬機法、安全なTikTok Shop運営のルールについて。' },
    { time: '12:00 - 12:45', title: '【出展企業向け講演】', subtitle: 'ライバーとのマッチングを成功させる「自社ブランドの伝え方」', speaker: '専門家・トップライバー', purpose: '「ライバー向け商品説明会」のキックオフ。企業が提供すべき情報（成分、ベネフィット、フックとなるワードなど）を解説。' },
    { time: '13:00 - 14:00', title: 'お昼休憩＆ブース回遊・現場ライブ配信タイム', subtitle: '', speaker: '-', purpose: '企業ブースでの交流、ライバーによるゲリラ配信タイム。' },
    { time: '14:00 - 16:30', title: '【スポンサー出展企業によるPRセミナー枠】', subtitle: '（1枠20〜30分 × 数社）', speaker: 'ブース出店企業（申込制）', purpose: '各社が自社の主力商品やアフィリエイト条件などをステージ上で直接プレゼンし、ライバーをスカウト。' },
    { time: '16:45 - 17:30', title: '【クロージングパネル】', subtitle: '著名タレント出演連動番組企画', speaker: 'ゲストタレント、特別審査員、実行委員会', purpose: '著名タレント出演連動番組企画として商品の露出も交えつつ、2日間の総括を行う。' },
    { time: '17:30 - 18:00', title: 'グランドフィナーレ', subtitle: '', speaker: '全体', purpose: 'イベントの締めくくり、記念撮影など。' },
  ];

  return (
    <section className="py-20 px-4">
      <div ref={reveal.ref} className={`max-w-6xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Event Schedule</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">イベントスケジュール</h2>
          <p className="text-xs text-gray-500 mt-2">※イベント内容及び時間は変更する場合がございます。</p>
        </div>

        {/* DAY 1 */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded bg-amber-500/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold">
              <span className="text-amber-400">【DAY 1】</span> 9月8日（火）
            </h3>
          </div>
          <p className="text-sm text-gray-400 mb-4 ml-11">テーマ：プラットフォームの未来とトップランナーの思考</p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-amber-500/30">
                  <th className="text-left py-3 px-3 text-amber-400 font-semibold w-[120px]">時間</th>
                  <th className="text-left py-3 px-3 text-amber-400 font-semibold">コンテンツ名</th>
                  <th className="text-left py-3 px-3 text-amber-400 font-semibold w-[200px] hidden md:table-cell">登壇者（予定）</th>
                  <th className="text-left py-3 px-3 text-amber-400 font-semibold hidden lg:table-cell">内容・目的</th>
                </tr>
              </thead>
              <tbody>
                {day1Program.map((item, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 text-gray-400 whitespace-nowrap align-top">{item.time}</td>
                    <td className="py-3 px-3 align-top">
                      <span className="font-semibold text-white">{item.title}</span>
                      {item.subtitle && <><br /><span className="text-gray-400">{item.subtitle}</span></>}
                    </td>
                    <td className="py-3 px-3 text-gray-400 align-top hidden md:table-cell whitespace-pre-line">{item.speaker}</td>
                    <td className="py-3 px-3 text-gray-500 align-top hidden lg:table-cell text-xs">{item.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DAY 2 */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded bg-amber-500/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold">
              <span className="text-amber-400">【DAY 2】</span> 9月9日（水）
            </h3>
          </div>
          <p className="text-sm text-gray-400 mb-4 ml-11">テーマ：実践とマッチング</p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-amber-500/30">
                  <th className="text-left py-3 px-3 text-amber-400 font-semibold w-[120px]">時間</th>
                  <th className="text-left py-3 px-3 text-amber-400 font-semibold">コンテンツ名（対象）</th>
                  <th className="text-left py-3 px-3 text-amber-400 font-semibold w-[200px] hidden md:table-cell">登壇者（予定）</th>
                  <th className="text-left py-3 px-3 text-amber-400 font-semibold hidden lg:table-cell">内容・目的</th>
                </tr>
              </thead>
              <tbody>
                {day2Program.map((item, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 text-gray-400 whitespace-nowrap align-top">{item.time}</td>
                    <td className="py-3 px-3 align-top">
                      <span className="font-semibold text-white">{item.title}</span>
                      {item.subtitle && <><br /><span className="text-gray-400">{item.subtitle}</span></>}
                    </td>
                    <td className="py-3 px-3 text-gray-400 align-top hidden md:table-cell whitespace-pre-line">{item.speaker}</td>
                    <td className="py-3 px-3 text-gray-500 align-top hidden lg:table-cell text-xs">{item.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Matching Section (ライバー事前マッチングサービス)
// ============================================================
function MatchingSection() {
  const reveal = useScrollReveal();

  const steps = [
    { step: 'STEP1', title: '商材登録', timing: '（出展申込時）', desc: '最大3SKUの商材情報を委員会へ申請します。ライバーが選定しやすくなるよう、特別報酬率（コミッション）やサンプル提供条件も併せて提示します。' },
    { step: 'STEP2', title: 'カタログ公開', timing: '（開催1ヶ月前）', desc: '申請された商材のガイドライン審査を実施します。通過した商材を「事前マッチング専用WEBカタログ」にまとめ、来場予定のライバーへ一斉告知します。' },
    { step: 'STEP3', title: 'エントリー', timing: '（開催3週間前）', desc: 'カタログを閲覧し、販売したい希望商材を選択してエントリーします。同時に、当日の希望配信日時・場所（各ブースまたは特設エリア）を申請します。' },
    { step: 'STEP4', title: 'マッチング確定', timing: '（開催2週間前）', desc: '応募状況に基づき、出展企業による指名や委員会によるスケジュール調整を実施。全体の配信タイムテーブルを確定させ、双方に通知します。' },
    { step: 'STEP5', title: '事前準備と連携', timing: '（開催1〜2週間前）', desc: '当日のカート落ちを防ぐため、TikTok Shop上で「TAP」のシステム連携を済ませます。一部ライバーへサンプル品を事前発送し、配信の準備（構成案作成など）を促します。' },
    { step: 'STEP6', title: '当日配信', timing: '（イベント当日）', desc: 'ライバーは予約した時間に合わせて該当ブース（または特設エリア）へ向かいます。出展者と商品の最終確認や挨拶を行った上で、ライブ配信・販売をスタートします。' },
  ];

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-transparent via-amber-950/5 to-transparent">
      <div ref={reveal.ref} className={`max-w-6xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="mb-10">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">TOP LIVER SALES</span>
          <h2 className="text-2xl sm:text-3xl font-bold mt-2">ライバー事前マッチングサービス</h2>
          <p className="text-xs text-gray-500 mt-2">※一部の仕様変更する場合がございます。</p>
        </div>

        {/* Live streaming image banner */}
        <div className="rounded-2xl overflow-hidden mb-8">
          <img 
            src={IMAGES.liveStreaming1} 
            alt="ライバーによるライブ配信" 
            className="w-full h-48 md:h-56 object-cover"
          />
        </div>

        <p className="text-gray-300 text-sm mb-8">
          すべての出店者が、事前ご来場するライバーさんとのマッチングを行う事が可能です。
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {steps.map((s, i) => (
            <div key={i} className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-4">
              <div className="text-amber-400 font-bold text-sm mb-1">{s.step}</div>
              <div className="font-bold text-white text-sm mb-0.5">{s.title}</div>
              <div className="text-[10px] text-amber-400/70 mb-2">{s.timing}</div>
              <p className="text-[11px] text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-6">※マッチングは確定ではありません</p>
      </div>
    </section>
  );
}

// ============================================================
// CTA Section
// ============================================================
function CTASection() {
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img src={IMAGES.audience} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0a0a0f]/80 to-[#0a0a0f]" />
      </div>
      
      <div className="relative max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          ここからうまれるのは、<br />
          新しいスターと、次の「当たり前」です。
        </h2>
        <p className="text-gray-400 mb-10 text-sm">
          出展・協賛・来場に関するお申し込みはこちらから
        </p>
        
        <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {/* 企業申込み */}
          <a
            href="/livecommercefestival/2026/apply/company"
            className="p-5 rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent hover:border-amber-500/70 transition-all group backdrop-blur-sm"
          >
            <Building2 className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">企業様</h3>
            <p className="text-xs text-gray-400 mb-3">出展・協賛のお申し込み</p>
            <span className="inline-flex items-center gap-1 text-sm text-amber-400 font-semibold group-hover:gap-2 transition-all">
              申し込む <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </a>
          
          {/* ライバー申込み */}
          <a
            href="/livecommercefestival/2026/apply/liver"
            className="p-5 rounded-xl border border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent hover:border-purple-500/60 transition-all group backdrop-blur-sm"
          >
            <Mic2 className="w-8 h-8 text-purple-400 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">ライバー</h3>
            <p className="text-xs text-gray-400 mb-3">ライバー＆インフルエンサー</p>
            <span className="inline-flex items-center gap-1 text-sm text-purple-400 font-semibold group-hover:gap-2 transition-all">
              申し込む <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </a>
          
          {/* 一般参加者 */}
          <a
            href="/livecommercefestival/2026/apply/general"
            className="p-5 rounded-xl border border-white/20 bg-white/[0.02] hover:border-white/40 transition-all group backdrop-blur-sm"
          >
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">一般参加</h3>
            <p className="text-xs text-gray-400 mb-3">来場・見学のお申し込み</p>
            <span className="inline-flex items-center gap-1 text-sm text-gray-300 font-semibold group-hover:gap-2 transition-all">
              申し込む <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </a>
        </div>
        
        <p className="text-xs text-gray-500 mt-8">
          お問い合わせ先: info@livecommercejapan.jp
        </p>
      </div>
    </section>
  );
}

// ============================================================
// Footer Section
// ============================================================
function FooterSection() {
  return (
    <footer className="py-10 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-sm text-gray-500">
          主催: LCF実行委員会　｜　共同企画: MOB Inc. × Live Commerce Japan
        </p>
        <p className="text-xs text-gray-600 mt-2">
          &copy; 2026 Live Commerce Festival. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
