/**
 * グランエンザイム PRO - 直播展示用LP
 * 口碑調査に基づく購買理由を前面に出したデザイン
 */
import { useEffect, useRef, useState } from 'react';
import { Star, Sparkles, Leaf, Heart, TrendingDown, ShieldCheck, Award, Users, FlaskConical, Droplets } from 'lucide-react';

// ===== カウントアップフック =====
function useCountUp(target: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!startOnView || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, startOnView]);

  return { count, ref };
}

// ===== ヒーローセクション =====
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-black">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-[#1a0a0a] to-[#0d0515]" />
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-amber-500 rounded-full blur-[200px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-red-600 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* メインコンテンツ：3カラム */}
        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-8 items-center">
          
          {/* 左：問題提起 + 解決 */}
          <div className="space-y-6">
            {/* カテゴリ表示 - 一瞬で何かわかる */}
            <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-5 py-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-bold text-lg">ファスティング酵素ドリンク</span>
            </div>

            {/* 問題解決メッセージ */}
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight">
                食べ過ぎた翌日、
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  たった2日でリセット。
                </span>
              </h1>
              <p className="text-xl text-white/70">
                飲むだけで始められる、プロ仕様の酵素ファスティング
              </p>
            </div>

            {/* 実績データ - 大きく */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-amber-400">-3.6kg</p>
                <p className="text-xs text-white/50 mt-1">7日間の実績</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-amber-400">-6kg</p>
                <p className="text-xs text-white/50 mt-1">半年継続</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-amber-400">2日</p>
                <p className="text-xs text-white/50 mt-1">体重リセット</p>
              </div>
            </div>
          </div>

          {/* 中央：製品画像 */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute -inset-16 bg-gradient-to-t from-amber-600/15 via-amber-500/5 to-transparent rounded-full blur-3xl" />
              <img
                src="/images/granenzyme-bottle.jpg"
                alt="ザ グランエンザイム PRO"
                className="relative w-56 lg:w-72 h-auto object-contain drop-shadow-[0_0_40px_rgba(245,158,11,0.2)]"
              />
              {/* 商品名オーバーレイ */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <p className="text-xs text-white/40 tracking-widest">ESTHE PRO LABO</p>
                <p className="text-lg font-bold text-white text-center">グランエンザイム PRO</p>
              </div>
            </div>
          </div>

          {/* 右：データパネル - 主播が指しながら話せる */}
          <div className="space-y-4">
            {/* 評価 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className={`w-5 h-5 ${i <= 4 ? 'text-amber-400 fill-amber-400' : 'text-amber-400/40'}`} />
                  ))}
                </div>
                <span className="text-2xl font-black text-white">4.25</span>
              </div>
              <p className="text-white/50 text-sm">Yahoo!ショッピング 370件+のレビュー</p>
            </div>

            {/* 信頼データ */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">取扱サロン数</span>
                <span className="text-xl font-black text-amber-400">29,000店+</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">植物素材</span>
                <span className="text-xl font-black text-amber-400">100種類</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">果実エキス</span>
                <span className="text-xl font-black text-amber-400">9種類</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">添加物</span>
                <span className="text-xl font-black text-green-400">完全ゼロ</span>
              </div>
            </div>

            {/* こんな方に */}
            <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-400/20 rounded-2xl p-5">
              <p className="text-amber-400 font-bold text-sm mb-3">こんなお悩みに</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-white/80 text-sm">
                  <span className="text-amber-400">✓</span> 食べ過ぎた翌日のリセットに
                </li>
                <li className="flex items-center gap-2 text-white/80 text-sm">
                  <span className="text-amber-400">✓</span> 代謝が落ちてきた30〜40代
                </li>
                <li className="flex items-center gap-2 text-white/80 text-sm">
                  <span className="text-amber-400">✓</span> 短期間で結果を出したい方
                </li>
                <li className="flex items-center gap-2 text-white/80 text-sm">
                  <span className="text-amber-400">✓</span> 無添加にこだわりたい方
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 下部：信頼バッジ横並び */}
        <div className="flex flex-wrap justify-center gap-4 mt-12 pt-8 border-t border-white/5">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-sm text-white/80">白砂糖・保存料・着色料・香料 不使用</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-white/80">パリコレ3年連続スポンサー</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
            <Leaf className="w-4 h-4 text-green-400" />
            <span className="text-sm text-white/80">国産植物素材100%使用</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-white/80">モデル美香 アンバサダー</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== ビフォーアフターセクション =====
function BeforeAfterSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-[#0d0515] to-black relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">実感の声</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white">
            飲んだ人の<span className="text-amber-400">リアルな変化</span>
          </h2>
          <p className="text-white/50 mt-3">※個人の感想であり、効果を保証するものではありません</p>
        </div>

        {/* ビフォーアフターカード */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* ケース1: 30代女性 */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/granenzyme-before-after-1-hDDLzhC2mYutfi4uBgvGx5.webp"
              alt="30代女性 ビフォーアフター"
              className="w-full h-auto"
            />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full">30代女性</span>
                <span className="text-white/40 text-xs">ファスティング 7日間</span>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                「産後太りが戻らなくて悩んでいました。サロンで勧められて始めたら、<span className="text-amber-400 font-bold">7日で-3.6kg</span>。お腹周りがスッキリして、朋人にも『痩せた？』と言われました。」
              </p>
              <div className="flex items-center gap-1 mt-3">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
            </div>
          </div>

          {/* ケース2: 40代女性 */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/granenzyme-before-after-2-X6mTpwx2KBR4zKfSSJ6UpK.webp"
              alt="40代女性 ビフォーアフター"
              className="w-full h-auto"
            />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full">40代女性</span>
                <span className="text-white/40 text-xs">半年間継続</span>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                「代謝が落ちて何をしても痩せなかったのに、月1回の3日ファスティングを続けたら<span className="text-amber-400 font-bold">半年で-6kg</span>。お腹のポッコリがなくなって、体が軽くなりました。」
              </p>
              <div className="flex items-center gap-1 mt-3">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`w-4 h-4 ${i <= 4 ? 'text-amber-400 fill-amber-400' : 'text-amber-400/40'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 実績まとめ */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-2xl font-black text-amber-400">-3.6kg</p>
            <p className="text-xs text-white/50 mt-1">7日ファスティング</p>
          </div>
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-2xl font-black text-amber-400">-6kg</p>
            <p className="text-xs text-white/50 mt-1">半年継続使用</p>
          </div>
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-2xl font-black text-amber-400">92%</p>
            <p className="text-xs text-white/50 mt-1">リピート率</p>
          </div>
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-2xl font-black text-amber-400">2日</p>
            <p className="text-xs text-white/50 mt-1">最短リセット</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== 口コミ評価セクション =====
function ReviewScoreSection() {
  const { count: reviewCount, ref: reviewRef } = useCountUp(370, 1500);
  const { count: salonCount, ref: salonRef } = useCountUp(29000, 2000);

  return (
    <section className="py-20 bg-gradient-to-b from-black to-[#0a0515] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[128px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">Real Reviews</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white">
            選ばれる理由がある
          </h2>
        </div>

        {/* 大きな評価スコア */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-16">
          <div className="text-center p-8 bg-white/5 backdrop-blur border border-white/10 rounded-2xl">
            <div className="flex justify-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`w-6 h-6 ${i <= 4 ? 'text-amber-400 fill-amber-400' : 'text-amber-400/40'}`} />
              ))}
            </div>
            <p className="text-5xl font-bold text-white mb-2">4.25</p>
            <p className="text-white/50 text-sm">平均評価</p>
          </div>

          <div ref={reviewRef} className="text-center p-8 bg-white/5 backdrop-blur border border-white/10 rounded-2xl">
            <Users className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-5xl font-bold text-white mb-2">{reviewCount}<span className="text-2xl">件+</span></p>
            <p className="text-white/50 text-sm">レビュー数</p>
          </div>

          <div ref={salonRef} className="text-center p-8 bg-white/5 backdrop-blur border border-white/10 rounded-2xl">
            <Award className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-5xl font-bold text-white mb-2">{salonCount.toLocaleString()}<span className="text-2xl">+</span></p>
            <p className="text-white/50 text-sm">取扱サロン</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== 購買理由セクション =====
function WhyBuySection() {
  const reasons = [
    {
      icon: <TrendingDown className="w-8 h-8" />,
      title: 'ファスティングの必需品',
      desc: '月1回のプチ断食で-2〜3.6kgの実績多数。酵素ドリンクで栄養を補いながら無理なく。',
      highlight: '最も多い購買理由',
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: '毎朝の酵素習慣に',
      desc: '朝食代わりに20mLを炭酸水割り。「太りにくくなった」「体が軽い」の声多数。',
      highlight: '続けやすい',
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: '飲みやすいフルーティな味',
      desc: 'ハーブザイム「オラックス」に近い味わい。炭酸割り・豆乳割りで美味しく続けられる。',
      highlight: '味の満足度◎',
    },
    {
      icon: <FlaskConical className="w-8 h-8" />,
      title: 'ハーブザイムと同品質でコスパ◎',
      desc: '同ブランドの最上位ラインと同等の品質。サロン定価の約半額でネット購入可能。',
      highlight: '賢い選択',
    },
    {
      icon: <Leaf className="w-8 h-8" />,
      title: '完全無添加・国産100%',
      desc: '白砂糖・保存料・着色料・香料すべて不使用。100種の国産植物素材のみ。',
      highlight: '安心品質',
    },
    {
      icon: <ShieldCheck className="w-8 h-8" />,
      title: '29,000店舗のプロが認めた品質',
      desc: 'エステティシャン・美容師がカウンセリングで推奨。パリコレ3年連続スポンサー。',
      highlight: 'プロの信頼',
    },
  ];

  return (
    <section className="py-20 bg-[#0a0515] relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">Why Choose This</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            購入する6つの理由
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            370件以上のレビューから見えた、選ばれる理由
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {reasons.map((reason, i) => (
            <div
              key={i}
              className="group relative p-6 bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl hover:border-amber-400/30 transition-all duration-300"
            >
              <div className="absolute top-4 right-4">
                <span className="text-[10px] bg-amber-400/10 text-amber-400 px-2 py-1 rounded-full">
                  {reason.highlight}
                </span>
              </div>
              <div className="text-amber-400 mb-4">{reason.icon}</div>
              <h3 className="text-xl font-bold text-white mb-3">{reason.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{reason.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== 実感の声セクション =====
function TestimonialsSection() {
  const testimonials = [
    {
      text: '7日目の朝時点で、-3.6キロ。最近代謝が落ちてて全然体重が減らなかったので、短期間でこの結果は大大大満足。',
      label: '初ファスティング',
      result: '-3.6kg / 7日',
    },
    {
      text: '毎月続けており、ファスティング期間以外は全く食事制限せず、運動もしていなかったのですが、半年くらい続けて6kgほど痩せました。',
      label: '定期利用者',
      result: '-6kg / 半年',
    },
    {
      text: '朝、昼をしっかり食べて、間食にこれにするだけで１ヶ月目あたりから明らかに体が軽くなり始めました。',
      label: '置き換え利用',
      result: '体が軽く',
    },
    {
      text: 'いつもお世話になっているエステサロンでは高くて購入出来ません。お昼の代わりに炭酸水で割って飲むのが1番好きです。お腹周り緩くなりました！',
      label: 'サロン経由',
      result: 'お腹周り↓',
    },
    {
      text: '40代後半の年代でも２日ほどで体重が戻りました。食べ過ぎた翌日のリセットに最適です。',
      label: '40代後半',
      result: '2日でリセット',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-[#0a0515] to-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-amber-400 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">Real Voices</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            実感の声
          </h2>
          <p className="text-white/50 text-lg">
            Yahoo!ショッピング 370件のレビューより
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="relative p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col"
            >
              {/* 結果バッジ */}
              <div className="absolute -top-3 right-4">
                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                  {t.result}
                </span>
              </div>
              
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-white/80 text-sm leading-relaxed flex-1 mb-4">「{t.text}」</p>
              <p className="text-amber-400/60 text-xs">{t.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== ターゲット層セクション =====
function TargetSection() {
  const targets = [
    {
      title: 'ファスティングを始めたい方',
      items: ['月1回のプチ断食で体をリセットしたい', '酵素ドリンクで栄養を補いながら断食したい', '短期間で結果を出したい'],
    },
    {
      title: '美しいボディを目指す方',
      items: ['健康的にボディメイクしたい', '朝食置き換えで無理なく続けたい', '代謝が落ちてきたと感じる30-40代'],
    },
    {
      title: '食生活が乱れがちな方',
      items: ['外食・コンビニ弁当が多い', '食べ過ぎた翌日のリセットに', '植物性発酵食品が不足しがち'],
    },
  ];

  return (
    <section className="py-20 bg-black relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">Recommended For</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            こんな方におすすめ
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {targets.map((target, i) => (
            <div key={i} className="p-8 bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl">
              <h3 className="text-xl font-bold text-amber-400 mb-6">{target.title}</h3>
              <ul className="space-y-3">
                {target.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-white/70 text-sm">
                    <Droplets className="w-4 h-4 text-amber-400/60 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== 製品特徴セクション =====
function FeaturesSection() {
  const features = [
    { num: '01', title: '100種の植物素材', desc: '厳選された国産植物原料を贅沢に使用。野菜・果物・海藻・キノコ類・穀物の力を凝縮。' },
    { num: '02', title: '9種の果実エキス', desc: '厳選9種の果実エキスで爽やかに飲みやすく。毎日続けられる、こだわりの味わい。' },
    { num: '03', title: 'ヒノキ樽発酵', desc: '伝統製法「ヒノキ樽」で約2ヶ月間自然発酵・熟成。自然の力を最大限に引き出す。' },
    { num: '04', title: '完全無添加', desc: '白砂糖・保存料・着色料・香料、すべて不使用。素材本来の力だけをお届け。' },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-black to-[#0a0515] relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">Four Attractions</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            4つの魅力
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {features.map((f) => (
            <div key={f.num} className="flex gap-6 p-6 bg-white/[0.03] border border-white/5 rounded-xl">
              <span className="text-4xl font-bold text-amber-400/20">{f.num}</span>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== ブランド信頼セクション =====
function BrandTrustSection() {
  return (
    <section className="py-20 bg-[#0a0515] relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">Brand Trust</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            Esthe Pro Labo
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            インナービューティのパイオニアとして、全国のプロフェッショナルに支持されています。
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-12">
          <div className="text-center p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-3xl font-bold text-amber-400">29,000+</p>
            <p className="text-white/50 text-sm mt-2">取扱サロン</p>
          </div>
          <div className="text-center p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-3xl font-bold text-amber-400">3年</p>
            <p className="text-white/50 text-sm mt-2">パリコレスポンサー</p>
          </div>
          <div className="text-center p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-3xl font-bold text-amber-400">100%</p>
            <p className="text-white/50 text-sm mt-2">国産植物素材</p>
          </div>
          <div className="text-center p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-3xl font-bold text-amber-400">0</p>
            <p className="text-white/50 text-sm mt-2">添加物</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto text-center">
          <div className="p-8 bg-gradient-to-r from-amber-900/10 via-amber-800/5 to-amber-900/10 border border-amber-400/20 rounded-2xl">
            <p className="text-white/80 text-lg leading-relaxed">
              モデル<span className="text-amber-400 font-semibold">美香</span>氏がブランドアンバサダーに就任。
              <br />
              芸能人・モデルが愛用する、プロフェッショナル品質の酵素ドリンク。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== 飲み方セクション =====
function HowToSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-[#0a0515] to-black relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">How To Enjoy</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            おすすめの飲み方
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl">
            <div className="w-16 h-16 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🥤</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">炭酸水割り</h3>
            <p className="text-white/50 text-sm">一番人気の飲み方。爽やかで飲みやすい。</p>
          </div>
          <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl">
            <div className="w-16 h-16 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🥛</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">豆乳割り</h3>
            <p className="text-white/50 text-sm">まろやかな味わい。腹持ちも良い。</p>
          </div>
          <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl">
            <div className="w-16 h-16 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💧</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">お水割り</h3>
            <p className="text-white/50 text-sm">シンプルに。20mLを目安に1日1〜2杯。</p>
          </div>
        </div>

        <div className="text-center mt-12">
          <p className="text-white/40 text-sm">※ 1回20mLが目安 ｜ 1日1〜2杯 ｜ 熱い飲み物とは混ぜないでください</p>
        </div>
      </div>
    </section>
  );
}

// ===== メインページ =====
export default function ProductGranenzyme() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <HeroSection />
      <BeforeAfterSection />
      <ReviewScoreSection />
      <WhyBuySection />
      <TestimonialsSection />
      <TargetSection />
      <FeaturesSection />
      <BrandTrustSection />
      <HowToSection />
      
      {/* フッター */}
      <footer className="py-12 bg-black border-t border-white/5">
        <div className="container mx-auto px-6 text-center">
          <p className="text-white/30 text-sm">
            ※ 本品は、特定保健用食品とは異なり、消費者庁長官による個別審査を受けたものではありません。
          </p>
          <p className="text-white/20 text-xs mt-4">
            © Esthe Pro Labo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
