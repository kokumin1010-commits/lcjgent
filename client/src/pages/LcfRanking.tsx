/**
 * GMV AWARD Ranking - Public Page
 * Black/Gold theme matching the GMV AWARD poster
 */
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Trophy, Crown, ArrowLeft, Loader2, Calendar } from 'lucide-react';

const DEADLINE = new Date('2026-09-08T15:00:00+09:00');

function CountdownBanner() {
  const now = new Date();
  const diff = DEADLINE.getTime() - now.getTime();
  if (diff <= 0) return <p className="text-yellow-400 font-bold">集計終了！</p>;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  return (
    <div className="text-center">
      <p className="text-xs text-gray-400 mb-1">集計終了まで</p>
      <p className="text-lg font-bold text-yellow-400 font-mono">{days}日 {hours}時間</p>
    </div>
  );
}

export default function LcfRanking() {
  const { data: rankings, isLoading } = trpc.ranking.getRanking.useQuery({ limit: 50 });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-yellow-900/40 via-amber-900/20 to-transparent border-b border-yellow-500/20 py-6 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Crown className="w-8 h-8 text-yellow-400" />
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
              GMV AWARD
            </h1>
            <Crown className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-gray-300 text-sm">LIVE COMMERCE FESTIVAL 2026 | GMV部門ランキング</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-black/40 border border-yellow-500/30 rounded-full px-4 py-2">
            <Calendar className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-300">集計期間: 9/1 〜 9/8 15:00</span>
          </div>
          <div className="mt-3">
            <CountdownBanner />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : !rankings || rankings.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-yellow-500/30 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">まだデータがありません</p>
            <p className="text-gray-500 text-sm mt-2">9/1からの集計開始をお待ちください</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top 3 Podium */}
            {rankings.length >= 1 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* 2nd Place */}
                {rankings.length >= 2 && (
                  <div className="order-2 md:order-1 bg-gradient-to-b from-gray-700/30 to-gray-800/20 border border-gray-500/30 rounded-2xl p-6 text-center md:mt-8">
                    <div className="text-4xl mb-2">🥈</div>
                    <p className="text-lg font-bold text-gray-200">{rankings[1].liverName}</p>
                    {rankings[1].tiktokUsername && <p className="text-xs text-gray-400">@{rankings[1].tiktokUsername}</p>}
                    <p className="text-2xl font-black text-gray-300 mt-2">¥{Number(rankings[1].gmv).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">GMV</p>
                  </div>
                )}
                {/* 1st Place */}
                <div className="order-1 md:order-2 bg-gradient-to-b from-yellow-600/30 to-amber-900/20 border-2 border-yellow-500/50 rounded-2xl p-8 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400"></div>
                  <div className="text-5xl mb-2">👑</div>
                  <p className="text-xl font-black text-yellow-300">{rankings[0].liverName}</p>
                  {rankings[0].tiktokUsername && <p className="text-xs text-yellow-500/80">@{rankings[0].tiktokUsername}</p>}
                  <p className="text-3xl font-black bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent mt-3">
                    ¥{Number(rankings[0].gmv).toLocaleString()}
                  </p>
                  <p className="text-xs text-yellow-500/60">GMV</p>
                  {rankings[0].duration && (
                    <p className="text-xs text-gray-400 mt-2">配信時間: {rankings[0].duration}</p>
                  )}
                </div>
                {/* 3rd Place */}
                {rankings.length >= 3 && (
                  <div className="order-3 bg-gradient-to-b from-amber-800/20 to-orange-900/10 border border-amber-600/30 rounded-2xl p-6 text-center md:mt-12">
                    <div className="text-4xl mb-2">🥉</div>
                    <p className="text-lg font-bold text-amber-200">{rankings[2].liverName}</p>
                    {rankings[2].tiktokUsername && <p className="text-xs text-gray-400">@{rankings[2].tiktokUsername}</p>}
                    <p className="text-2xl font-black text-amber-300 mt-2">¥{Number(rankings[2].gmv).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">GMV</p>
                  </div>
                )}
              </div>
            )}

            {/* Full Ranking List (4th onwards) */}
            {rankings.length > 3 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <h3 className="font-bold text-sm text-gray-300">全ランキング</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {rankings.slice(3).map((entry: any, idx: number) => (
                    <div key={entry.id} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
                      <span className="text-lg font-bold text-gray-500 w-8 text-center">{idx + 4}</span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-200">{entry.liverName}</p>
                        {entry.tiktokUsername && <p className="text-xs text-gray-500">@{entry.tiktokUsername}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-yellow-400">¥{Number(entry.gmv).toLocaleString()}</p>
                        {entry.duration && <p className="text-xs text-gray-500">{entry.duration}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AWARD Info */}
        <div className="mt-8 bg-gradient-to-r from-yellow-900/20 to-amber-900/10 border border-yellow-500/20 rounded-2xl p-6">
          <h3 className="font-bold text-yellow-400 mb-3">🏆 AWARD特典</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-black/30 rounded-xl p-4 text-center border border-yellow-500/20">
              <p className="text-yellow-400 font-bold text-lg">1位〜3位</p>
              <p className="text-gray-300 mt-1">番組出演 + アフターパーティーで表彰</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 text-center border border-white/10">
              <p className="text-gray-300 font-bold">評価基準</p>
              <p className="text-yellow-400 font-bold text-xl mt-1">GMV</p>
              <p className="text-gray-500 text-xs">（流通総額）</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 text-center border border-white/10">
              <p className="text-gray-300 font-bold">集計期間</p>
              <p className="text-gray-200 mt-1">9/1 〜 9/8 15:00</p>
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm">
            <ArrowLeft className="w-4 h-4" /> フェスティバルページに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
