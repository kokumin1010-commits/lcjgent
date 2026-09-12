/**
 * LCF Guidance archive index.
 * Design: evidence-led black/ivory/gold editorial archive; each edition remains permanently addressable.
 */
import { useEffect } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Clock3, MapPin } from "lucide-react";
import { lcf2026PhotoById, lcfEditions } from "@/data/lcfEditions";

export default function LcfGuidanceIndex() {
  const edition = lcfEditions[0];
  const hero = lcf2026PhotoById[edition.heroPhotoId];

  useEffect(() => {
    document.title = "LCF Guidance｜歴代ガイダンス";
  }, []);

  return (
    <div className="min-h-screen bg-[#090909] text-white [font-family:'Noto_Sans_JP','Hiragino_Sans','Yu_Gothic',sans-serif]">
      <header className="border-b border-white/10 bg-black/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
          <a href="/" className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-white/75 hover:text-white"><ArrowLeft size={16} /> LCF HOME</a>
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#D9B447]">GUIDANCE ARCHIVE</span>
          <a href="/lcf/mypage" className="bg-[#7c3aed] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#8b5cf6]">マイページ</a>
        </div>
      </header>

      <main>
        <section className="border-b border-white/10 px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-bold tracking-[0.28em] text-[#D9B447]">LCF / EVENT GUIDANCE</p>
              <h1 className="mt-6 text-5xl font-light leading-[0.92] tracking-[-0.05em] md:text-8xl">Guidance,<br /><span className="text-[#E7C766]">edition by edition.</span></h1>
            </div>
            <p className="max-w-2xl border-l border-[#D9B447] pl-6 text-sm leading-8 text-white/60 md:text-base">会場MAP、当日の進行、配信ルール、持ち物を開催回ごとに保存しています。新しい開催の案内を追加しても、過去のガイダンスは上書きしません。</p>
          </div>
        </section>

        <section className="px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <article className="grid overflow-hidden border border-white/15 bg-[#111] lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative min-h-[330px] overflow-hidden lg:min-h-[520px]">
                <img src={hero.src} alt={hero.alt} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                  <span className="text-7xl font-black tracking-[-0.08em] text-white/90 md:text-9xl">01</span>
                  <span className="border border-white/35 bg-black/55 px-3 py-2 text-xs font-bold text-white backdrop-blur">開催終了</span>
                </div>
              </div>
              <div className="flex flex-col justify-between p-7 md:p-10 lg:p-12">
                <div>
                  <p className="text-xs font-bold tracking-[0.22em] text-[#D9B447]">{edition.label} / {edition.year}</p>
                  <h2 className="mt-5 text-4xl font-light tracking-[-0.04em] md:text-6xl">LIVE COMMERCE<br />FESTIVAL 2026</h2>
                  <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 text-sm text-white/65 sm:grid-cols-2">
                    <p className="flex items-center gap-2"><CalendarDays size={17} className="text-[#D9B447]" />{edition.dates}</p>
                    <p className="flex items-center gap-2"><MapPin size={17} className="text-[#D9B447]" />{edition.venue}</p>
                  </div>
                  <p className="mt-7 text-sm leading-7 text-white/55">第1回で実際に使用した会場MAP、スケジュール、GMV AWARD、配信ルールと注意事項を永久保存しています。</p>
                </div>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <a href={edition.guidancePath} className="inline-flex items-center justify-between gap-5 bg-[#D9B447] px-5 py-4 text-sm font-black text-black hover:bg-[#F1D77D]">第1回ガイダンスを見る <ArrowUpRight size={18} /></a>
                  <a href={edition.eventPath} className="inline-flex items-center justify-between gap-5 border border-white/20 px-5 py-4 text-sm font-bold text-white hover:border-[#D9B447]">第1回イベントページを見る <ArrowUpRight size={18} /></a>
                </div>
              </div>
            </article>

            <div className="mt-8 border border-dashed border-white/20 bg-white/[0.025] p-7 md:p-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4"><Clock3 className="mt-1 shrink-0 text-[#D9B447]" /><div><p className="text-xs font-bold tracking-[0.2em] text-[#D9B447]">NEXT EDITION</p><h2 className="mt-2 text-2xl font-light">第2回ガイダンスは公開準備中です</h2><p className="mt-2 text-sm leading-7 text-white/50">開催概要が正式決定した後、この一覧に新しいガイダンスを追加します。</p></div></div>
                <span className="inline-flex items-center gap-2 text-xs font-bold text-white/40"><BookOpen size={16} />過去の記録はそのまま残ります</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
