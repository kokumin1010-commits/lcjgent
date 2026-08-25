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
  const { data: rankings, isLoading, isError, error, refetch } = trpc.ranking.getRanking.useQuery({ limit: 50 });
  let previousGmv: number | null = null;
  let previousRank = 0;
  const rankedEntries = (rankings || []).map((entry: any, index: number) => {
    const gmv = Number(entry.gmv);
    const rank = index > 0 && previousGmv === gmv ? previousRank : index + 1;
    previousGmv = gmv;
    previousRank = rank;
    return { ...entry, rank };
  });

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
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-red-300 font-bold">ランキングの読み込みに失敗しました</p>
            <p className="text-gray-500 text-sm mt-2">{error?.message || '時間をおいて再度お試しください'}</p>
            <button onClick={() => refetch()} className="mt-5 px-5 py-2 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400">再読み込み</button>
          </div>
        ) : rankedEntries.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-yellow-500/30 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">まだデータがありません</p>
            <p className="text-gray-500 text-sm mt-2">9/1からの集計開始をお待ちください</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top ranks. Equal GMV values share the same competition rank. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {rankedEntries.filter((entry: any) => entry.rank <= 3).map((entry: any) => (
                <div key={entry.id} className={`rounded-2xl p-6 text-center border ${entry.rank === 1 ? 'bg-gradient-to-b from-yellow-600/30 to-amber-900/20 border-yellow-500/50' : entry.rank === 2 ? 'bg-gradient-to-b from-gray-700/30 to-gray-800/20 border-gray-500/30' : 'bg-gradient-to-b from-amber-800/20 to-orange-900/10 border-amber-600/30'}`}>
                  <div className="text-4xl mb-2">{entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : '🥉'}</div>
                  <p className="text-xs text-gray-400 mb-1">{entry.rank}位</p>
                  <p className="text-lg font-bold text-gray-100 truncate" title={entry.liverName}>{entry.liverName}</p>
                  {entry.tiktokUsername && <p className="text-xs text-gray-400 truncate" title={`@${entry.tiktokUsername}`}>@{entry.tiktokUsername}</p>}
                  <p className="text-2xl font-black text-yellow-300 mt-2">¥{Number(entry.gmv).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">GMV</p>
                  {entry.duration && <p className="text-xs text-gray-400 mt-2">配信時間: {entry.duration}</p>}
                </div>
              ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-bold text-sm text-gray-300">全ランキング</h3>
              </div>
              <div className="divide-y divide-white/5">
                {rankedEntries.map((entry: any) => (
                  <div key={entry.id} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
                    <span className="text-lg font-bold text-gray-500 w-8 text-center">{entry.rank}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-200 truncate" title={entry.liverName}>{entry.liverName}</p>
                      {entry.tiktokUsername && <p className="text-xs text-gray-500 truncate" title={`@${entry.tiktokUsername}`}>@{entry.tiktokUsername}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-yellow-400">¥{Number(entry.gmv).toLocaleString()}</p>
                      {entry.duration && <p className="text-xs text-gray-500">{entry.duration}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
