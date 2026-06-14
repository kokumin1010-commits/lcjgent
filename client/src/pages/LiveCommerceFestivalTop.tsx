/*
 * ============================================================
 * LIVE COMMERCE FESTIVAL - Top Page (Index)
 * ============================================================
 * URL: /livecommercefestival
 * Purpose: 総合トップ。各回へのリンクと次回開催情報
 * ============================================================
 */
import { Calendar, MapPin, ArrowRight, Trophy } from 'lucide-react';
import { Link } from 'wouter';

export default function LiveCommerceFestivalTop() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Hero */}
      <section className="relative py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1020] via-[#0a0a0f] to-[#0a0a0f]" />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px]" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/5 mb-8">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-300">コマースライバーと企業のマッチング・セミナー型祭典</span>
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
              LIVE COMMERCE
            </span>
            <br />
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              FESTIVAL
            </span>
          </h1>
          
          <p className="text-lg text-gray-400 mt-6 max-w-xl mx-auto">
            日本最大級のライブコマース祭典。<br />
            オンライン × オフラインの融合で、新しいコマースの形を創る。
          </p>
          
          <p className="text-sm text-gray-500 mt-8">
            主催: LCF実行委員会　｜　共同企画: MOB Inc. × Live Commerce Japan
          </p>
        </div>
      </section>
      
      {/* Events List */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">開催一覧</h2>
          
          {/* 2026 */}
          <Link href="/livecommercefestival/2026">
            <div className="group p-6 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent hover:border-amber-500/40 transition-all cursor-pointer mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold mb-3">
                    <Calendar className="w-3 h-3" /> NEXT
                  </div>
                  <h3 className="text-xl font-bold">LIVE COMMERCE FESTIVAL 2026</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-2 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-400" /> 2026.9.8 - 9.9
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-amber-400" /> 八芳園（東京・白金台）
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </section>
      
      {/* Footer */}
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
    </div>
  );
}
