/*
 * ============================================================
 * LIVE COMMERCE FESTIVAL 2026 LP
 * ============================================================
 * Design: Premium dark with gold/amber accents
 * Tone: 共同主催（LCF実行委員会 / MOB × LCJ）
 * URL: /livecommercefestival/2026
 * ============================================================
 */
import { useEffect, useRef, useState } from 'react';
import { 
  Calendar, MapPin, Users, TrendingUp, Mic2, 
  Trophy, Building2, Sparkles, ArrowRight, 
  Clock, Star, Monitor, Music, Wine, 
  CheckCircle2, ChevronDown
} from 'lucide-react';

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
      <ConceptSection />
      <ProgramSection />
      <SpeakersSection />
      <VenueSection />
      <SponsorSection />
      <ScheduleSection />
      <CTASection />
      <FooterSection />
    </div>
  );
}

// ============================================================
// Hero Section
// ============================================================
function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1020] via-[#0a0a0f] to-[#0a0a0f]" />
      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/5 mb-8">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-300 tracking-wide">第1回 コマースライバーと企業のマッチング・セミナー型祭典</span>
        </div>
        
        {/* Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight mb-4">
          <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
            LIVE COMMERCE
          </span>
          <br />
          <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            FESTIVAL 2026
          </span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-gray-400 mt-6 max-w-2xl mx-auto leading-relaxed">
          オンライン × オフラインの融合。<br className="sm:hidden" />
          日本最大級のライブコマース祭典が誕生。
        </p>
        
        {/* Date & Venue */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-10">
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar className="w-5 h-5 text-amber-400" />
            <span className="text-lg font-semibold">2026.9.8 - 9.9</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <MapPin className="w-5 h-5 text-amber-400" />
            <span className="text-lg font-semibold">八芳園（東京・白金台）</span>
          </div>
        </div>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <a
            href="#sponsor"
            className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
          >
            出展・協賛のお問い合わせ
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#program"
            className="px-8 py-4 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/5 transition-all flex items-center gap-2"
          >
            プログラム詳細
            <ChevronDown className="w-4 h-4" />
          </a>
        </div>
        
        {/* Organizer */}
        <p className="text-sm text-gray-500 mt-10">
          主催: LCF実行委員会　｜　共同企画: MOB Inc. × Live Commerce Japan
        </p>
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
    <section className="py-16 border-y border-white/5">
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
// Concept Section
// ============================================================
function ConceptSection() {
  const reveal = useScrollReveal();
  
  return (
    <section className="py-20 px-4">
      <div ref={reveal.ref} className={`max-w-4xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Concept</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">開催趣旨</h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              icon: <TrendingUp className="w-6 h-6" />,
              title: "TikTok Shopの認知拡大",
              desc: "業界を牽引し、TikTok上でのライブコマースイベントといえば「LCF」というポジションを確立する"
            },
            {
              icon: <Monitor className="w-6 h-6" />,
              title: "オンライン × オフライン融合",
              desc: "出展企業がライブコマースを実施しながら、会場およびオンラインでの販売を同時に行う新しい形"
            },
            {
              icon: <Building2 className="w-6 h-6" />,
              title: "出展費用の回収モデル",
              desc: "会場でのマッチングとライブ販売を通じて、その場で出展費用を回収できる日本初のエコシステム"
            },
            {
              icon: <Sparkles className="w-6 h-6" />,
              title: "エンターテインメント × UGC",
              desc: "芸能人やインフルエンサー起用により外部メディアを誘致し、SNSでのUGCを爆発的に創出"
            },
          ].map((item, i) => (
            <div key={i} className="p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4">
                {item.icon}
              </div>
              <h3 className="text-lg font-bold mb-2">{item.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
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
    <section id="program" className="py-20 px-4 bg-gradient-to-b from-transparent via-amber-950/5 to-transparent">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Program</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">プログラム</h2>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: <Mic2 />, title: "現場ライブコマース", desc: "事前マッチングしたライバーと組み、会場から直接TikTok LIVE配信を実施" },
            { icon: <Users />, title: "公開セミナー", desc: "トップライバー × トップマーケターによる講演。TikTok公式担当者トークショーも" },
            { icon: <Trophy />, title: "表彰パーティー", desc: "Day1夜に開催。優秀ライバー・ブランドの表彰式とネットワーキング" },
            { icon: <Monitor />, title: "配信スペース", desc: "会場内3〜5箇所に設置。プロ照明・音響完備の本格配信環境" },
            { icon: <Music />, title: "DJブース & パーティー", desc: "アフターパーティーでライバーとブランド担当者の交流を促進" },
            { icon: <Wine />, title: "軽食 & ドリンク", desc: "VIPラウンジ・バーエリア完備。ビジネスミーティングにも最適" },
          ].map((item, i) => (
            <div key={i} className="p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-amber-500/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-3 group-hover:bg-amber-500/20 transition-colors">
                {item.icon}
              </div>
              <h3 className="font-bold mb-1.5">{item.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
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
              <span key={i} className="px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-sm text-gray-300">
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
// Venue Section
// ============================================================
function VenueSection() {
  const reveal = useScrollReveal();
  
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-transparent via-purple-950/5 to-transparent">
      <div ref={reveal.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-12">
          <span className="text-amber-400 text-sm tracking-[0.3em] uppercase">Venue</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3">会場</h2>
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
// CTA Section
// ============================================================
function CTASection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          ここからうまれるのは、<br />
          新しいスターと、次の「当たり前」です。
        </h2>
        <p className="text-gray-400 mb-8 text-sm">
          出展・協賛・来場に関するお問い合わせはこちらから
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="mailto:info@livecommercejapan.jp?subject=LIVE COMMERCE FESTIVAL 2026 出展お問い合わせ"
            className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
          >
            出展・協賛のお問い合わせ
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        
        <p className="text-xs text-gray-500 mt-6">
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
