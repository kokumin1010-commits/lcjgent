/**
 * グランエンザイム PRO - 直播展示用LP
 * 口碑調査に基づく購買理由を前面に出したデザイン
 */
import { useEffect, useRef, useState } from 'react';
import { Star, Sparkles, Leaf, Heart, TrendingDown, ShieldCheck, Award, Users, FlaskConical, Droplets, ArrowRight, CheckCircle2 } from 'lucide-react';

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
            {/* カテゴリ表示 */}
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

            {/* 実績データ */}
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
                src="/images/granenzyme-bottle-dark.png"
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

          {/* 右：データパネル */}
          <div className="space-y-4">
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

            {/* 価格 */}
            <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/10 border border-amber-400/40 rounded-2xl p-5 text-center">
              <p className="text-white/50 text-xs mb-1">定価（税込）</p>
              <p className="text-4xl font-black text-amber-400">¥9,350</p>
              <p className="text-white/40 text-xs mt-1">500mL ｜ 約25日分</p>
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
        </div>
      </div>
    </section>
  );
}

// ===== ビフォーアフターセクション（大きく2段表示） =====
function BeforeAfterSection() {
  const cases = [
    {
      beforeImg: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/granenzyme-before-after-1-hDDLzhC2mYutfi4uBgvGx5.webp',
      label: '30代女性',
      period: 'ファスティング 7日間',
      result: '-3.6kg',
      comment: '「産後太りが戻らなくて悩んでいました。サロンで勧められて始めたら、7日で-3.6kg。お腹周りがスッキリして、朋人にも『痩せた？』と言われました。」',
      stars: 5,
    },
    {
      beforeImg: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/granenzyme-before-after-2-X6mTpwx2KBR4zKfSSJ6UpK.webp',
      label: '40代女性',
      period: '半年間継続（月1回3日ファスティング）',
      result: '-6kg',
      comment: '「代謝が落ちて何をしても痩せなかったのに、月1回の3日ファスティングを続けたら半年で-6kg。お腹のポッコリがなくなって、体が軽くなりました。」',
      stars: 4,
    },
    {
      beforeImg: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/granenzyme-ba-3-before-bLuc2xK3NcHm5W6u3rb5V6.webp',
      afterImg: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/granenzyme-ba-3-after-SaMHBkfCsXd2pdVrtaFmwj.webp',
      label: '20代女性',
      period: '2日間リセット',
      result: '-1.2kg',
      comment: '「飲み会続きでお腹がパンパンだったのに、2日間これだけで過ごしたら体重が戻った。むくみも取れてスッキリ。週末リセットの定番になりました。」',
      stars: 5,
    },
    {
      beforeImg: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/granenzyme-ba-4-before-XogNxtAnyh5J78gYk2JJ77.webp',
      afterImg: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320462236/SXcqSEWtYWdL7ibbEZ4xjh/granenzyme-ba-4-after-SQfikRKLm3uCy8rnbdcgr3.webp',
      label: '40代女性',
      period: '朝食置き換え 1ヶ月',
      result: '-2.8kg',
      comment: '「朝食をこれに置き換えるだけ。1ヶ月で横から見たシルエットが全然違う。お腹のぽっこりが目に見えて減りました。無理してないのにこの結果。」',
      stars: 5,
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-[#0d0515] to-black relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">Real Results</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white">
            飲んだ人の<span className="text-amber-400">リアルな変化</span>
          </h2>
          <p className="text-white/50 mt-3">※個人の感想であり、効果を保証するものではありません</p>
        </div>

        {/* 2段レイアウト：1人1行で大きく */}
        <div className="space-y-12 max-w-5xl mx-auto">
          {cases.map((c, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
              {/* 画像エリア：大きく表示 */}
              <div className="relative">
                {c.afterImg ? (
                  // Before/After 2枚並び
                  <div className="grid grid-cols-2">
                    <div className="relative">
                      <span className="absolute top-4 left-4 bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-full z-10">BEFORE</span>
                      <img src={c.beforeImg} alt={`${c.label} Before`} className="w-full h-[400px] lg:h-[500px] object-cover" />
                    </div>
                    <div className="relative">
                      <span className="absolute top-4 left-4 bg-amber-400 text-black text-xs font-bold px-3 py-1 rounded-full z-10">AFTER</span>
                      <img src={c.afterImg} alt={`${c.label} After`} className="w-full h-[400px] lg:h-[500px] object-cover" />
                    </div>
                  </div>
                ) : (
                  // 既存の1枚画像（Before/After合成済み）
                  <img src={c.beforeImg} alt={`${c.label} ビフォーアフター`} className="w-full h-auto max-h-[500px] object-contain bg-white" />
                )}
                {/* 結果バッジ */}
                <div className="absolute bottom-4 right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-2xl px-6 py-3 rounded-2xl shadow-2xl">
                  {c.result}
                </div>
              </div>
              
              {/* コメントエリア */}
              <div className="p-8">
                <div className="flex items-center gap-4 mb-4">
                  <span className="bg-amber-400/10 text-amber-400 text-sm font-bold px-4 py-1.5 rounded-full">{c.label}</span>
                  <span className="text-white/40 text-sm">{c.period}</span>
                </div>
                <p className="text-white/90 text-lg leading-relaxed mb-4">{c.comment}</p>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-5 h-5 ${s <= c.stars ? 'text-amber-400 fill-amber-400' : 'text-amber-400/30'}`} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 実績まとめ */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-3xl font-black text-amber-400">-3.6kg</p>
            <p className="text-sm text-white/50 mt-1">7日ファスティング</p>
          </div>
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-3xl font-black text-amber-400">-6kg</p>
            <p className="text-sm text-white/50 mt-1">半年継続使用</p>
          </div>
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-3xl font-black text-amber-400">92%</p>
            <p className="text-sm text-white/50 mt-1">リピート率</p>
          </div>
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-3xl font-black text-amber-400">2日</p>
            <p className="text-sm text-white/50 mt-1">最短リセット</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== 権威性・信頼セクション =====
function ReviewScoreSection() {
  const { count: salonCount, ref: salonRef } = useCountUp(29000, 2000);

  return (
    <section className="py-24 bg-gradient-to-b from-black to-[#0a0515] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[128px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">Authority & Trust</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white">
            なぜ、プロが<span className="text-amber-400">この1本</span>を選ぶのか
          </h2>
          <p className="text-white/50 text-lg mt-4 max-w-2xl mx-auto">
            数字だけでは伝わらない、圧倒的な信頼の裏付け
          </p>
        </div>

        {/* 権威性カード */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
          {/* パリコレスポンサー */}
          <div className="relative p-8 bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-400/30 rounded-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <Award className="w-10 h-10 text-amber-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">パリコレクション</h3>
            <p className="text-3xl font-black text-amber-400 mb-2">3年連続</p>
            <p className="text-sm text-white/60">公式スポンサー。世界最高峰のファッションの舞台が認めたインナービューティー。</p>
          </div>

          {/* プロが選ぶ */}
          <div ref={salonRef} className="relative p-8 bg-gradient-to-br from-purple-900/20 to-transparent border border-purple-400/30 rounded-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-400/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <Users className="w-10 h-10 text-purple-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">全国のプロが採用</h3>
            <p className="text-3xl font-black text-purple-400 mb-2">{salonCount.toLocaleString()}店+</p>
            <p className="text-sm text-white/60">エステティシャン・美容師がカウンセリングで推奨。プロの目利きが証明する品質。</p>
          </div>

          {/* アンバサダー - 写真大きく */}
          <div className="relative bg-gradient-to-br from-rose-900/20 to-transparent border border-rose-400/30 rounded-2xl overflow-hidden">
            <img 
              src="/images/mika-ambassador.png" 
              alt="モデル美香" 
              className="w-full h-48 object-cover object-top"
            />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <p className="text-white font-bold text-lg">モデル美香</p>
                  <p className="text-rose-400 text-sm">ブランドアンバサダー</p>
                </div>
              </div>
              <p className="text-sm text-white/60">2026年3月就任。芸能人・モデルが日常的に愛飲する、本物のプロ仕様。</p>
            </div>
          </div>
        </div>

        {/* なぜ信頼されるのか */}
        <div className="max-w-4xl mx-auto">
          <div className="p-8 bg-white/[0.03] border border-white/10 rounded-3xl">
            <div className="text-center mb-8">
              <p className="text-amber-400 font-bold text-lg">インナービューティのパイオニア</p>
              <p className="text-white/50 text-sm mt-2">Esthe Pro Labo が選ばれ続ける3つの理由</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FlaskConical className="w-7 h-7 text-amber-400" />
                </div>
                <p className="text-white font-bold mb-1">製法へのこだわり</p>
                <p className="text-white/50 text-xs">ヒノキ樽で3年半熟成。一般的な酵素ドリンクの数十倍の時間をかけた本物の発酵。</p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-7 h-7 text-amber-400" />
                </div>
                <p className="text-white font-bold mb-1">完全無添加宣言</p>
                <p className="text-white/50 text-xs">白砂糖・人工甘味料・保存料・着色料・香料、一切不使用。素材の力だけで勝負。</p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Leaf className="w-7 h-7 text-amber-400" />
                </div>
                <p className="text-white font-bold mb-1">国産100%の原料</p>
                <p className="text-white/50 text-xs">厳選された100種の国産植物素材。産地・品質にこだわり抜いた原料のみを使用。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== ヒノキ樽3年半熟成セクション =====
function HinokiBarrelSection() {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* 背景装飾 */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-amber-900/10 via-transparent to-amber-800/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-600/5 rounded-full blur-[200px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* メインビジュアル：巨大な「3年半」 */}
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-4">The Secret of Fermentation</p>
          <div className="relative inline-block">
            <span className="text-[120px] lg:text-[180px] font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-400 via-amber-500 to-amber-800 leading-none">
              3.5
            </span>
            <span className="absolute -right-16 lg:-right-20 top-1/2 -translate-y-1/2 text-4xl lg:text-5xl font-bold text-amber-400/80">
              年
            </span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mt-4">
            吉野産ヒノキ樽で、<span className="text-amber-400">3年半</span>熟成
          </h2>
          <p className="text-white/50 text-lg mt-3 max-w-xl mx-auto">
            他社が数ヶ月で終わらせる工程を、職人が3年半かけて仕上げる
          </p>
        </div>

        {/* 比較テーブル */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="grid md:grid-cols-2 gap-4">
            {/* 一般的な酵素ドリンク */}
            <div className="p-8 bg-white/[0.03] border border-white/10 rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 bg-white/30 rounded-full" />
                <p className="text-white/50 font-bold">一般的な酵素ドリンク</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-sm">熟成期間</span>
                  <span className="text-white/60 font-bold">数週間〜数ヶ月</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-sm">容器</span>
                  <span className="text-white/60 font-bold">ステンレスタンク</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-sm">攪拌</span>
                  <span className="text-white/60 font-bold">機械式</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-sm">添加物</span>
                  <span className="text-white/60 font-bold">使用あり</span>
                </div>
              </div>
            </div>

            {/* グランエンザイム PRO */}
            <div className="p-8 bg-gradient-to-br from-amber-900/30 to-amber-800/10 border-2 border-amber-400/50 rounded-2xl relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-amber-400 text-black text-xs font-black px-4 py-1 rounded-full">圧倒的な差</span>
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 bg-amber-400 rounded-full" />
                <p className="text-amber-400 font-bold">グランエンザイム PRO</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">熟成期間</span>
                  <span className="text-amber-400 font-black text-lg">3年半（1,277日）</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">容器</span>
                  <span className="text-amber-400 font-bold">吉野産ヒノキ樽</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">攪拌</span>
                  <span className="text-amber-400 font-bold">職人の手作業</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">添加物</span>
                  <span className="text-green-400 font-bold">完全ゼロ</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3年半熟成の効果：なぜすごいのか */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="text-center mb-10">
            <h3 className="text-2xl lg:text-3xl font-bold text-white">
              3年半熟成すると、<span className="text-amber-400">何が変わるのか</span>
            </h3>
            <p className="text-white/50 mt-2">時間をかけることで生まれる、圧倒的な品質差</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 効果1: 酵素濃度 */}
            <div className="p-6 bg-gradient-to-br from-amber-900/15 to-transparent border border-amber-400/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-400/10 rounded-xl flex items-center justify-center shrink-0">
                  <FlaskConical className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white mb-2">酵素活性が段違いに高い</h4>
                  <p className="text-white/60 text-sm leading-relaxed">
                    3年半の長期発酵で、短期間発酵では得られない<span className="text-amber-400 font-bold">高濃度の酵素</span>が生成。体内の消化・代謝をパワフルにサポートし、ファスティング効果を最大化。
                  </p>
                </div>
              </div>
            </div>

            {/* 効果2: 分子が細かい */}
            <div className="p-6 bg-gradient-to-br from-amber-900/15 to-transparent border border-amber-400/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-400/10 rounded-xl flex items-center justify-center shrink-0">
                  <Droplets className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white mb-2">低分子化で吸収率アップ</h4>
                  <p className="text-white/60 text-sm leading-relaxed">
                    長期熟成で栄養素が<span className="text-amber-400 font-bold">低分子化</span>。体への吸収率が格段に高く、飲んだ翌日から「体が軽い」と実感できる即効性。
                  </p>
                </div>
              </div>
            </div>

            {/* 効果3: ヒノキの天然成分 */}
            <div className="p-6 bg-gradient-to-br from-amber-900/15 to-transparent border border-amber-400/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-400/10 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white mb-2">天然防腐で完全無添加を実現</h4>
                  <p className="text-white/60 text-sm leading-relaxed">
                    ヒノキ樽から溶け出す<span className="text-amber-400 font-bold">ヒノキチオール</span>が天然の抗菌作用を発揮。だから保存料ゼロでも安全。化学物質に頼らない本物の無添加。
                  </p>
                </div>
              </div>
            </div>

            {/* 効果4: 味がまろやか */}
            <div className="p-6 bg-gradient-to-br from-amber-900/15 to-transparent border border-amber-400/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-400/10 rounded-xl flex items-center justify-center shrink-0">
                  <Heart className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white mb-2">雑味ゼロ、フルーティで飲みやすい</h4>
                  <p className="text-white/60 text-sm leading-relaxed">
                    3年半の熟成で雑味が完全に消え、<span className="text-amber-400 font-bold">フルーティでまろやかな味</span>に。「酵素ドリンク＝まずい」の常識を覆す。だから92%がリピート。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 締めのメッセージ */}
        <div className="text-center">
          <div className="inline-block p-8 bg-amber-400/5 border border-amber-400/20 rounded-2xl">
            <p className="text-white/90 text-xl font-bold">
              <span className="text-amber-400">1,277日間</span>、毎日手を加え続けた結果が、この1本に。
            </p>
            <p className="text-white/50 mt-3">だから、プロが自信を持って推奨できる。だから、結果が出る。</p>
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
            実際に購入された方のレビューより
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

// ===== ターゲット層セクション（強化版） =====
function TargetSection() {
  const targets = [
    {
      title: '食べ過ぎた翌日、2日で戻したい',
      subtitle: '週末リセット派',
      items: [
        '飲み会・旅行後の体重増加が気になる',
        '月曜日までに元に戻したい',
        '無理な食事制限はしたくない',
      ],
      result: '→ 2日間ファスティングで平均-1〜2kg',
    },
    {
      title: '30代から何しても痩せなくなった',
      subtitle: '代謝低下に悩む方',
      items: [
        '以前と同じ食事量なのに太る',
        '運動しても体重が落ちない',
        '基礎代謝が年々下がっている実感',
      ],
      result: '→ 月1回ファスティングで半年-6kgの実績',
    },
    {
      title: 'サロン品質を、自宅で手軽に',
      subtitle: 'コスパ重視の方',
      items: [
        'エステサロンの酵素ドリンクは高すぎる',
        'でも市販の安い酵素は添加物が心配',
        'プロ品質を適正価格で手に入れたい',
      ],
      result: '→ サロン定価の約半額、¥9,350で同品質',
    },
  ];

  return (
    <section className="py-20 bg-black relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-3">Who Is This For</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            こんな<span className="text-amber-400">あなた</span>のための1本
          </h2>
          <p className="text-white/50 text-lg">「あ、私のことだ」と思ったら、試す価値あり</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {targets.map((target, i) => (
            <div key={i} className="p-8 bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl flex flex-col">
              <p className="text-amber-400/60 text-xs font-bold mb-2">{target.subtitle}</p>
              <h3 className="text-xl font-bold text-white mb-6 leading-tight">{target.title}</h3>
              <ul className="space-y-3 flex-1">
                {target.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-white/70 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-amber-400/60 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-amber-400 font-bold text-sm flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  {target.result}
                </p>
              </div>
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
    { num: '03', title: 'ヒノキ樽3年半熟成', desc: '吉野産ヒノキ樽で3年半かけて自然発酵・熟成。職人の手作業攪拌で自然の力を最大限に引き出す。' },
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

// ===== 価格セクション =====
function PriceSection() {
  return (
    <section className="py-24 bg-gradient-to-b from-black to-[#0a0515] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500 rounded-full blur-[200px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-10 bg-gradient-to-br from-white/5 to-white/[0.02] border border-amber-400/30 rounded-3xl">
            <p className="text-amber-400 text-sm tracking-[0.2em] uppercase mb-4">Price</p>
            <h2 className="text-2xl font-bold text-white mb-2">ザ グランエンザイム PRO</h2>
            <p className="text-white/40 text-sm mb-6">500mL ｜ 約25日分（1日20mL目安）</p>
            
            <div className="mb-6">
              <p className="text-6xl lg:text-7xl font-black text-amber-400">¥9,350</p>
              <p className="text-white/50 text-sm mt-2">税込</p>
            </div>

            <div className="space-y-2 text-left max-w-sm mx-auto mb-8">
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span>完全無添加（白砂糖・保存料・着色料・香料ゼロ）</span>
              </div>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span>国産植物素材100種使用</span>
              </div>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span>吉野産ヒノキ樽で3年半熟成</span>
              </div>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span>サロン品質をご自宅で</span>
              </div>
            </div>

            <p className="text-white/30 text-xs">
              ※ サロン定価（ハーブザイム113）約17,000円の同品質を適正価格で
            </p>
          </div>
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
      <HinokiBarrelSection />
      <WhyBuySection />
      <TestimonialsSection />
      <TargetSection />
      <FeaturesSection />
      <HowToSection />
      <PriceSection />
      
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
