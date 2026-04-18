/*
 * ============================================================
 * RECRUIT LP: Luxury Night Stage
 * ============================================================
 * Design: Cinematic luxury with gold accents on dark base
 * Goal: Maximize LINE add conversions for liver recruitment
 * Target: Mobile-first (ad traffic)
 * CTA: LINE追加 (https://lin.ee/Xd7XVKw)
 * ============================================================
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const LINE_URL = 'https://lin.ee/Xd7XVKw';

// Asset URLs
const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/hero_bg-MpKKbidYjE966TXLfZBbYD.webp';
const REWARD_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/reward_section_bg-XHAxeLuiqeG8xtc8czL2H4.webp';
const SUPPORT_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/support_section-Dy5ufMqoLCmdbydsqLYSAf.webp';
const COMMUNITY_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/community_section-hYnpmMPFwF3DR9sShyaYZ3.webp';
const BADGE_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/tiktok_partner_badge-NwimgGxQPNPwW2rjupSurL.webp';
const LOGO_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/lcj_logo_f6ebbc32.png';

// ============================================================
// Counter Animation Hook
// ============================================================
function useCountUp(end: number, duration: number = 2000, suffix: string = '') {
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

  return { count, ref, suffix };
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
// LINE CTA Button
// ============================================================
function LineCTA({ size = 'lg', className = '' }: { size?: 'sm' | 'lg'; className?: string }) {
  return (
    <a
      href={LINE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        inline-flex items-center justify-center gap-2 font-bold
        transition-all duration-300 
        ${size === 'lg'
          ? 'px-8 py-4 text-lg rounded-full'
          : 'px-6 py-3 text-base rounded-full'
        }
        bg-[#06C755] text-white hover:bg-[#05b34c] hover:scale-105
        shadow-[0_0_30px_rgba(6,199,85,0.3)] hover:shadow-[0_0_50px_rgba(6,199,85,0.5)]
        ${className}
      `}
    >
      <svg viewBox="0 0 24 24" className={size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} fill="currentColor">
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
      </svg>
      LINEで無料相談する
    </a>
  );
}

// ============================================================
// Floating LINE Button (Fixed)
// ============================================================
function FloatingLineButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
      }`}
    >
      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="
          flex items-center gap-2 px-8 py-4 rounded-full
          bg-[#06C755] text-white font-bold text-base
          shadow-[0_4px_30px_rgba(6,199,85,0.4)]
          hover:shadow-[0_4px_50px_rgba(6,199,85,0.6)]
          hover:scale-105 transition-all duration-300
          animate-pulse-subtle
        "
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
        </svg>
        今すぐLINEで応募
      </a>
    </div>
  );
}

// ============================================================
// Gold Divider
// ============================================================
function GoldDivider() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#c9a96e]/60" />
      <div className="w-2 h-2 rotate-45 bg-[#c9a96e] mx-4" />
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#c9a96e]/60" />
    </div>
  );
}

// ============================================================
// Section: Hero
// ============================================================
function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-lg mx-auto">
        {/* Logo */}
        <img src={LOGO_IMG} alt="Live Commerce Japan" className="h-8 mx-auto mb-8 opacity-80" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#c9a96e]/10 border border-[#c9a96e]/30 mb-6">
          <span className="text-[#f0d78c] text-xs font-medium tracking-wider">TikTok Shop 公式パートナー</span>
        </div>

        {/* Main Copy */}
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
          <span className="text-white">日本最大級の</span>
          <br />
          <span className="bg-gradient-to-r from-[#f0d78c] via-[#c9a96e] to-[#f0d78c] bg-clip-text text-transparent">
            ライブコマース事務所
          </span>
        </h1>

        <p className="text-white/70 text-base mb-6 leading-relaxed" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
          あなたのスマホが、ステージになる。
        </p>

        {/* Celebration Money Banner */}
        <div className="relative mb-8 p-[1px] rounded-2xl bg-gradient-to-r from-[#c9a96e] via-[#f0d78c] to-[#c9a96e]">
          <div className="bg-black/90 rounded-2xl px-6 py-5">
            <p className="text-[#f0d78c] text-xs tracking-widest mb-1">期間限定キャンペーン</p>
            <p className="text-white text-2xl sm:text-3xl font-black" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
              入所お祝い金 <span className="text-[#f0d78c] text-4xl sm:text-5xl">10</span><span className="text-[#f0d78c] text-2xl">万円</span>
            </p>
            <p className="text-white/40 text-[10px] mt-1">※条件あり。詳しくはLINEにてご確認ください</p>
          </div>
        </div>

        {/* CTA */}
        <LineCTA size="lg" />

        <p className="text-white/40 text-xs mt-4">未経験者歓迎 ・ 研修制度完備</p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-white/30 text-[10px] tracking-[0.3em]">SCROLL</span>
        <div className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </section>
  );
}

// ============================================================
// Section: Social Proof (Numbers)
// ============================================================
function SocialProofSection() {
  const reveal = useScrollReveal();
  const sales = useCountUp(10, 2000);
  const livers = useCountUp(294, 2000);
  const brands = useCountUp(71, 2000);
  const ugc = useCountUp(2018, 2000);

  const stats = [
    { ...sales, label: '累計売上', suffix: '億円+', icon: '💰' },
    { ...livers, label: '所属ライバー', suffix: '名+', icon: '🎤' },
    { ...brands, label: '取引企業数', suffix: '社+', icon: '🏢' },
    { ...ugc, label: 'UGC動画数', suffix: '+', icon: '🎬' },
  ];

  return (
    <section className="relative py-24 bg-black">
      <div
        ref={reveal.ref}
        className={`max-w-lg mx-auto px-6 transition-all duration-1000 ${
          reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <p className="text-center text-[#c9a96e] text-xs tracking-[0.3em] mb-3">TRACK RECORD</p>
        <h2 className="text-center text-white text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
          圧倒的な実績が証明する
        </h2>
        <p className="text-center text-white/50 text-sm mb-12">
          数字が語る、日本最大級のTikTokライブコマース事務所
        </p>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, i) => (
            <div
              key={i}
              ref={stat.ref}
              className="relative p-[1px] rounded-xl bg-gradient-to-br from-[#c9a96e]/40 to-transparent"
            >
              <div className="bg-[#0a0a0a] rounded-xl p-5 text-center h-full">
                <span className="text-2xl mb-2 block">{stat.icon}</span>
                <p className="text-[#f0d78c] text-3xl sm:text-4xl font-bold" style={{ fontFamily: "'Montserrat', 'Space Grotesk', sans-serif" }}>
                  {stat.count.toLocaleString()}<span className="text-lg">{stat.suffix}</span>
                </p>
                <p className="text-white/50 text-xs mt-1">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Section: Why LCJ (Benefits)
// ============================================================
function WhyLCJSection() {
  const reveal = useScrollReveal();

  const benefits = [
    {
      title: '高収益の報酬体系',
      desc: '時給制 + 成果報酬のハイブリッド型。配信するだけで安定収入、売れればさらにコミッション。トップライバーは月収100万円以上。',
      icon: '💎',
      highlight: '月収100万円以上も可能',
    },
    {
      title: 'お祝い金10万円',
      desc: '今なら入所お祝い金として10万円をプレゼント。始めるなら今がチャンス。',
      icon: '🎁',
      highlight: '期間限定',
    },
    {
      title: '高単価ブランド商品',
      desc: 'KYOGOKU、CHEYENNEなど71社以上の人気ブランドを取り扱い。最大30商品を無料で体験して配信できます。',
      icon: '👑',
      highlight: '71社以上と提携',
    },
    {
      title: '充実のサポート体制',
      desc: '専任マネージャー、配信スタジオ、撮影機材、配信テクニック研修。未経験からでも安心してスタートできます。',
      icon: '🛡️',
      highlight: '未経験者歓迎',
    },
    {
      title: 'AI分析ツール完備',
      desc: 'AitherHub・LCJ MALLなど独自のAIツールで配信を最適化。データに基づいた売上アップを実現。',
      icon: '🤖',
      highlight: '独自AI技術',
    },
    {
      title: '表参道の拠点',
      desc: '東京・表参道にオフィスを構える信頼の事務所。TikTok Shop公式パートナーとしての権威性。',
      icon: '📍',
      highlight: 'TikTok公式パートナー',
    },
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0808] to-black" />

      <div
        ref={reveal.ref}
        className={`relative z-10 max-w-lg mx-auto px-6 transition-all duration-1000 ${
          reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <p className="text-center text-[#c9a96e] text-xs tracking-[0.3em] mb-3">WHY LCJ</p>
        <h2 className="text-center text-white text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
          選ばれる6つの理由
        </h2>
        <p className="text-center text-white/50 text-sm mb-12">
          あなたの成功を、全力でバックアップ
        </p>

        <div className="space-y-4">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="group relative p-[1px] rounded-xl bg-gradient-to-r from-[#c9a96e]/20 via-transparent to-[#c9a96e]/20 hover:from-[#c9a96e]/50 hover:to-[#c9a96e]/50 transition-all duration-500"
            >
              <div className="bg-[#0a0a0a] rounded-xl p-5 flex gap-4">
                <span className="text-3xl shrink-0">{b.icon}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-white font-bold text-base">{b.title}</h3>
                    <span className="text-[10px] text-[#f0d78c] bg-[#c9a96e]/10 px-2 py-0.5 rounded-full border border-[#c9a96e]/20">
                      {b.highlight}
                    </span>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed">{b.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <LineCTA size="lg" />
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Section: Reward System
// ============================================================
function RewardSection() {
  const reveal = useScrollReveal();

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img src={REWARD_BG} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-black/80" />
      </div>

      <div
        ref={reveal.ref}
        className={`relative z-10 max-w-lg mx-auto px-6 transition-all duration-1000 ${
          reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <p className="text-center text-[#c9a96e] text-xs tracking-[0.3em] mb-3">REWARD SYSTEM</p>
        <h2 className="text-center text-white text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
          業界最高水準の報酬体系
        </h2>
        <p className="text-center text-white/50 text-sm mb-12">
          時給 + 成果報酬で、あなたの頑張りがダイレクトに反映
        </p>

        {/* Reward Cards */}
        <div className="space-y-4 mb-8">
          {/* Base Pay */}
          <div className="relative p-[1px] rounded-2xl bg-gradient-to-r from-[#c9a96e] to-[#f0d78c]">
            <div className="bg-[#0a0a0a] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#f0d78c] text-sm font-bold">時給報酬</span>
                <span className="text-white/30 text-xs">安定収入</span>
              </div>
              <p className="text-white text-sm leading-relaxed">
                配信するだけで時給が発生。未経験でも安心の固定報酬制度。
                経験やスキルに応じて時給がアップします。
              </p>
            </div>
          </div>

          {/* Commission */}
          <div className="relative p-[1px] rounded-2xl bg-gradient-to-r from-[#c9a96e]/60 to-[#f0d78c]/60">
            <div className="bg-[#0a0a0a] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#f0d78c] text-sm font-bold">成果報酬</span>
                <span className="text-white/30 text-xs">売上連動</span>
              </div>
              <p className="text-white text-sm leading-relaxed">
                ライブ配信での売上に応じたコミッション。
                売れば売るほど報酬がアップ。トップライバーは月収100万円以上を達成。
              </p>
            </div>
          </div>

          {/* Bonus */}
          <div className="relative p-[1px] rounded-2xl bg-gradient-to-r from-[#c9a96e]/40 to-[#f0d78c]/40">
            <div className="bg-[#0a0a0a] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#f0d78c] text-sm font-bold">各種ボーナス</span>
                <span className="text-white/30 text-xs">インセンティブ</span>
              </div>
              <p className="text-white text-sm leading-relaxed">
                月間MVPボーナス、新人ボーナス、紹介ボーナスなど、
                多彩なインセンティブ制度で頑張りを評価。
              </p>
            </div>
          </div>
        </div>

        {/* Celebration Money Highlight */}
        <div className="relative p-[2px] rounded-2xl bg-gradient-to-r from-[#c9a96e] via-[#f0d78c] to-[#c9a96e] animate-gradient-x mb-8">
          <div className="bg-black rounded-2xl p-6 text-center">
            <p className="text-[#f0d78c] text-xs tracking-widest mb-2">さらに今なら</p>
            <p className="text-white text-3xl font-black mb-1" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
              お祝い金 <span className="text-[#f0d78c]">10万円</span>
            </p>
            <p className="text-white/40 text-[10px]">※条件あり。詳しくはLINEにて</p>
          </div>
        </div>

        <div className="text-center">
          <LineCTA size="lg" />
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Section: Support & Studio
// ============================================================
function SupportSection() {
  const reveal = useScrollReveal();

  return (
    <section className="relative py-24 bg-black">
      <div
        ref={reveal.ref}
        className={`max-w-lg mx-auto px-6 transition-all duration-1000 ${
          reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <p className="text-center text-[#c9a96e] text-xs tracking-[0.3em] mb-3">FULL SUPPORT</p>
        <h2 className="text-center text-white text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
          万全のサポート体制
        </h2>
        <p className="text-center text-white/50 text-sm mb-10">
          未経験でも安心。プロが全力であなたをサポート
        </p>

        {/* Studio Image */}
        <div className="relative rounded-2xl overflow-hidden mb-10">
          <img src={SUPPORT_IMG} alt="配信スタジオ" className="w-full aspect-[3/2] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white font-bold text-sm">表参道の配信スタジオ</p>
            <p className="text-white/50 text-xs">プロ仕様の機材を無料で利用可能</p>
          </div>
        </div>

        {/* Support Items */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🎓', title: '配信研修', desc: '売れるテクニックを伝授' },
            { icon: '📱', title: '機材提供', desc: 'カメラ・照明・マイク' },
            { icon: '👤', title: '専任マネージャー', desc: '1対1でサポート' },
            { icon: '📦', title: '商品サンプル', desc: '最大30商品無料' },
            { icon: '📊', title: 'AI分析', desc: 'データで配信最適化' },
            { icon: '🏠', title: 'スタジオ', desc: '表参道の配信スタジオ' },
          ].map((item, i) => (
            <div key={i} className="bg-[#111] rounded-xl p-4 border border-white/5">
              <span className="text-xl block mb-2">{item.icon}</span>
              <p className="text-white text-sm font-bold mb-0.5">{item.title}</p>
              <p className="text-white/40 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Section: Community
// ============================================================
function CommunitySection() {
  const reveal = useScrollReveal();

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0808] to-black" />

      <div
        ref={reveal.ref}
        className={`relative z-10 max-w-lg mx-auto px-6 transition-all duration-1000 ${
          reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <p className="text-center text-[#c9a96e] text-xs tracking-[0.3em] mb-3">COMMUNITY</p>
        <h2 className="text-center text-white text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
          294名以上が所属する
          <br />
          日本最大級のコミュニティ
        </h2>
        <p className="text-center text-white/50 text-sm mb-10">
          仲間と共に成長し、共に稼ぐ
        </p>

        {/* Community Image */}
        <div className="relative rounded-2xl overflow-hidden mb-10">
          <img src={COMMUNITY_IMG} alt="LCJコミュニティ" className="w-full aspect-[3/2] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {/* Community Features */}
        <div className="space-y-3">
          {[
            { title: '情報交換コミュニティ', desc: 'ライバー同士のノウハウ共有。売れるコツ、トレンド情報をリアルタイムで交換。' },
            { title: '定期イベント・交流会', desc: '表参道オフィスでの交流会、勉強会、表彰式。モチベーションを高め合う仲間がいる。' },
            { title: 'チーム配信', desc: 'コラボ配信で相互にフォロワーを増やし、売上アップ。一人じゃない安心感。' },
          ].map((item, i) => (
            <div key={i} className="bg-[#111] rounded-xl p-5 border border-white/5">
              <h3 className="text-white font-bold text-sm mb-1">{item.title}</h3>
              <p className="text-white/50 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Section: How to Join (Steps)
// ============================================================
function StepsSection() {
  const reveal = useScrollReveal();

  const steps = [
    { num: '01', title: 'LINEで友だち追加', desc: '下のボタンからLCJ公式LINEを追加', icon: '📱' },
    { num: '02', title: '無料カウンセリング', desc: 'あなたに合った活動プランをご提案', icon: '💬' },
    { num: '03', title: '研修・配信開始', desc: '研修を受けたら、いよいよ配信スタート！', icon: '🎬' },
  ];

  return (
    <section className="relative py-24 bg-black">
      <div
        ref={reveal.ref}
        className={`max-w-lg mx-auto px-6 transition-all duration-1000 ${
          reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <p className="text-center text-[#c9a96e] text-xs tracking-[0.3em] mb-3">HOW TO JOIN</p>
        <h2 className="text-center text-white text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
          応募はたったの3ステップ
        </h2>
        <p className="text-center text-white/50 text-sm mb-12">
          最短即日で配信開始
        </p>

        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute left-[27px] top-8 bottom-8 w-px bg-gradient-to-b from-[#c9a96e] via-[#c9a96e]/30 to-transparent" />

          <div className="space-y-8">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-5 items-start">
                <div className="relative z-10 w-14 h-14 rounded-full bg-gradient-to-br from-[#c9a96e] to-[#f0d78c] flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(201,169,110,0.3)]">
                  <span className="text-black font-bold text-sm">{step.num}</span>
                </div>
                <div className="pt-2">
                  <h3 className="text-white font-bold text-lg mb-1">{step.title}</h3>
                  <p className="text-white/50 text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <LineCTA size="lg" />
          <p className="text-white/30 text-xs mt-3">30秒で完了 ・ 無料</p>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Section: Authority (TikTok Partner Badge)
// ============================================================
function AuthoritySection() {
  const reveal = useScrollReveal();

  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0808] to-black" />

      <div
        ref={reveal.ref}
        className={`relative z-10 max-w-lg mx-auto px-6 text-center transition-all duration-1000 ${
          reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <img src={BADGE_IMG} alt="公式パートナー" className="w-24 h-24 mx-auto mb-6 opacity-80" />

        <h2 className="text-white text-xl sm:text-2xl font-black mb-4" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
          TikTok Shop 公式パートナー
          <br />
          <span className="text-[#c9a96e]">TikTok 公式広告代理店</span>
        </h2>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {['累計売上10億円+', '所属294名+', '取引71社+', '表参道拠点'].map((tag, i) => (
            <span key={i} className="text-xs text-white/60 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              {tag}
            </span>
          ))}
        </div>

        <p className="text-white/40 text-sm leading-relaxed max-w-sm mx-auto">
          株式会社Live Commerce Japan
          <br />
          〒150-0001 東京都渋谷区神宮前 表参道
        </p>
      </div>
    </section>
  );
}

// ============================================================
// Section: Final CTA
// ============================================================
function FinalCTASection() {
  const reveal = useScrollReveal();

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Gold gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#1a1408] to-black" />
      <div className="absolute inset-0 opacity-10">
        <img src={REWARD_BG} alt="" className="w-full h-full object-cover" />
      </div>

      <div
        ref={reveal.ref}
        className={`relative z-10 max-w-lg mx-auto px-6 text-center transition-all duration-1000 ${
          reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="relative p-[2px] rounded-3xl bg-gradient-to-r from-[#c9a96e] via-[#f0d78c] to-[#c9a96e] mb-8">
          <div className="bg-black/95 rounded-3xl px-6 py-10">
            <p className="text-[#f0d78c] text-xs tracking-[0.3em] mb-4">LIMITED OFFER</p>
            <h2 className="text-white text-2xl sm:text-3xl font-black mb-2" style={{ fontFamily: "'Noto Sans JP Variable', sans-serif" }}>
              あなたのステージは
              <br />
              <span className="text-[#f0d78c]">ここにある</span>
            </h2>
            <p className="text-white/50 text-sm mb-6 leading-relaxed">
              日本最大級のライブコマース事務所で、
              <br />
              新しいキャリアを始めませんか？
            </p>

            <div className="bg-[#c9a96e]/10 rounded-xl p-4 mb-6 border border-[#c9a96e]/20">
              <p className="text-[#f0d78c] text-sm font-bold mb-1">
                入所お祝い金 10万円プレゼント中
              </p>
              <p className="text-white/40 text-[10px]">※条件あり。詳しくはLINEにて</p>
            </div>

            <LineCTA size="lg" />

            <div className="flex items-center justify-center gap-4 mt-6 text-white/30 text-xs">
              <span>未経験歓迎</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>副業OK</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>全国対応</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Footer
// ============================================================
function Footer() {
  return (
    <footer className="bg-black border-t border-white/5 py-8 pb-28">
      <div className="max-w-lg mx-auto px-6 text-center">
        <img src={LOGO_IMG} alt="Live Commerce Japan" className="h-6 mx-auto mb-4 opacity-50" />
        <p className="text-white/30 text-xs mb-2">株式会社Live Commerce Japan</p>
        <p className="text-white/20 text-[10px]">
          〒150-0001 東京都渋谷区神宮前五丁目46番20号
        </p>
        <p className="text-white/20 text-[10px] mt-4">
          &copy; {new Date().getFullYear()} Live Commerce Japan Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ============================================================
// Main Page Component
// ============================================================
export default function Recruit() {
  return (
    <div className="bg-black min-h-screen">
      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        @keyframes pulse-subtle {
          0%, 100% { box-shadow: 0 4px 30px rgba(6,199,85,0.4); }
          50% { box-shadow: 0 4px 50px rgba(6,199,85,0.6); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>

      <HeroSection />
      <GoldDivider />
      <SocialProofSection />
      <GoldDivider />
      <WhyLCJSection />
      <GoldDivider />
      <RewardSection />
      <GoldDivider />
      <SupportSection />
      <GoldDivider />
      <CommunitySection />
      <GoldDivider />
      <StepsSection />
      <GoldDivider />
      <AuthoritySection />
      <FinalCTASection />
      <Footer />
      <FloatingLineButton />
    </div>
  );
}
