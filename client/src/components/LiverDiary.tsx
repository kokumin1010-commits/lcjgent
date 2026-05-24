/**
 * ライバー日報コンポーネント
 * 
 * - 配信後に「今日の一言」を入力（30秒で完了）
 * - ストリーク（連続記録）表示
 * - 月末まとめ生成
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, BookOpen, Sparkles, Send, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface LiverDiaryProps {
  selectedMonth: string; // "2026-05" format
}

const MOODS = [
  { value: 'great', emoji: '🔥', label: '最高' },
  { value: 'good', emoji: '😊', label: '良い' },
  { value: 'normal', emoji: '😐', label: '普通' },
  { value: 'bad', emoji: '😓', label: 'イマイチ' },
  { value: 'terrible', emoji: '😢', label: '最悪' },
] as const;

export function LiverDiary({ selectedMonth }: LiverDiaryProps) {
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<'great' | 'good' | 'normal' | 'bad' | 'terrible'>('normal');
  const [showHistory, setShowHistory] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Get diary entries for selected month
  const { data: diaries, refetch: refetchDiaries } = trpc.liver.getDiaries.useQuery(
    { yearMonth: selectedMonth },
    { enabled: !!selectedMonth }
  );

  // Get streak data
  const { data: streak } = trpc.liver.getDiaryStreak.useQuery();

  // Save diary mutation
  const saveDiaryMutation = trpc.liver.saveDiary.useMutation({
    onSuccess: () => {
      toast.success('日報を保存しました！');
      setNote('');
      setMood('normal');
      refetchDiaries();
    },
    onError: (err) => {
      toast.error('保存に失敗しました: ' + err.message);
    },
  });

  // Generate monthly summary
  const generateSummaryMutation = trpc.liver.generateMonthlySummary.useMutation({
    onSuccess: (data) => {
      setIsGeneratingSummary(false);
      if (data.summary) {
        toast.success('月間まとめを生成しました！');
      } else {
        toast.error('まとめの生成に失敗しました');
      }
    },
    onError: () => {
      setIsGeneratingSummary(false);
      toast.error('まとめの生成に失敗しました');
    },
  });

  const handleSave = () => {
    if (!note.trim()) {
      toast.error('一言を入力してください');
      return;
    }
    saveDiaryMutation.mutate({ note: note.trim(), mood });
  };

  const handleGenerateSummary = () => {
    setIsGeneratingSummary(true);
    generateSummaryMutation.mutate({ yearMonth: selectedMonth });
  };

  // Check if today already has an entry
  const todayEntry = useMemo(() => {
    if (!diaries) return null;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return diaries.find(d => d.diaryDate === todayStr);
  }, [diaries]);

  return (
    <Card className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-700/40 overflow-hidden">
      <CardContent className="p-4">
        {/* Header with streak */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-400" />
            <h3 className="font-bold text-white text-lg">配信日報</h3>
          </div>
          {streak && streak.currentStreak > 0 && (
            <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-orange-400 text-xs font-bold">
                {streak.currentStreak}日連続
              </span>
            </div>
          )}
        </div>

        {/* Streak stats */}
        {streak && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-gray-800/50 rounded-lg p-2 text-center">
              <div className="text-[10px] text-gray-400">連続記録</div>
              <div className="text-white font-bold text-sm flex items-center justify-center gap-1">
                <Flame className="h-3 w-3 text-orange-400" />
                {streak.currentStreak}日
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2 text-center">
              <div className="text-[10px] text-gray-400">最長記録</div>
              <div className="text-amber-400 font-bold text-sm">{streak.longestStreak}日</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2 text-center">
              <div className="text-[10px] text-gray-400">総記録数</div>
              <div className="text-indigo-400 font-bold text-sm">{streak.totalEntries}件</div>
            </div>
          </div>
        )}

        {/* Today's entry or input */}
        {todayEntry ? (
          <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{MOODS.find(m => m.value === todayEntry.mood)?.emoji || '😐'}</span>
              <span className="text-xs text-gray-400">今日の一言</span>
            </div>
            <p className="text-white text-sm">{todayEntry.note}</p>
          </div>
        ) : (
          <div className="space-y-2 mb-3">
            {/* Mood selector */}
            <div className="flex gap-1 justify-center">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={`text-xl p-1.5 rounded-lg transition-all ${
                    mood === m.value
                      ? 'bg-indigo-600/50 scale-110 ring-1 ring-indigo-400'
                      : 'hover:bg-gray-700/50'
                  }`}
                  title={m.label}
                >
                  {m.emoji}
                </button>
              ))}
            </div>

            {/* Note input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="今日の配信はどうだった？（一言でOK）"
                className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                maxLength={500}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!note.trim() || saveDiaryMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* History toggle */}
        {diaries && diaries.length > 0 && (
          <>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors w-full justify-center py-1"
            >
              <span>今月の日報 ({diaries.length}件)</span>
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showHistory && (
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                {diaries.map((entry) => (
                  <div key={entry.id} className="bg-gray-800/40 rounded-lg px-3 py-2 flex items-start gap-2">
                    <span className="text-sm mt-0.5">{MOODS.find(m => m.value === entry.mood)?.emoji || '😐'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-500">{entry.diaryDate}</div>
                      <p className="text-white text-xs truncate">{entry.note}</p>
                    </div>
                    {entry.salesAmount > 0 && (
                      <span className="text-[10px] text-emerald-400 whitespace-nowrap">
                        ¥{entry.salesAmount.toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}

                {/* Monthly summary button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary || diaries.length < 3}
                  className="w-full mt-2 border-indigo-600/50 text-indigo-400 hover:bg-indigo-600/20"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  {isGeneratingSummary ? 'AI分析中...' : '月間まとめを生成'}
                </Button>

                {/* Show generated summary */}
                {generateSummaryMutation.data?.summary && (
                  <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-600/30 rounded-lg p-3 mt-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      <span className="text-xs text-indigo-300 font-bold">AI月間まとめ</span>
                    </div>
                    <p className="text-white text-xs leading-relaxed whitespace-pre-wrap">
                      {generateSummaryMutation.data.summary}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
