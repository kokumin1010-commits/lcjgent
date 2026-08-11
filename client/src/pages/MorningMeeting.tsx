import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Loader2, Calendar, Clock, Search, ChevronLeft, ChevronRight, Users, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';

// Web Speech API型定義
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type MeetingSummary = {
  overview: string;
  participants: Array<{
    name: string;
    todayTask: string;
    supportNeeded?: string;
  }>;
  actionItems: Array<{
    person: string;
    task: string;
    deadline?: string;
  }>;
  cultureRuleRead?: boolean;
};

export default function MorningMeeting() {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [speechLang, setSpeechLang] = useState<"ja-JP" | "zh-CN">("ja-JP");
  const [recordingTime, setRecordingTime] = useState(0);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [currentMeetingId, setCurrentMeetingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);

  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimText, setInterimText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  const startRecordingMutation = trpc.morningMeeting.startRecording.useMutation();
  const saveTranscriptMutation = trpc.morningMeeting.saveTranscriptAndSummarize.useMutation();
  const deleteMutation = trpc.morningMeeting.delete.useMutation();

  const { data: historyData, refetch: refetchHistory } = trpc.morningMeeting.getHistory.useQuery({
    limit: 10,
    offset: page * 10,
    search: searchQuery || undefined,
  });

  const { data: todayMeeting, refetch: refetchToday } = trpc.morningMeeting.getTodayMeeting.useQuery();
  const { data: stats } = trpc.morningMeeting.getStats.useQuery({ period: 'month' });

  // Timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      streamRef.current = stream;

      // Create DB record
      const result = await startRecordingMutation.mutateAsync({});
      setCurrentMeetingId(result.id);

      // Start MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      setLiveTranscript('');
      setInterimText('');
      transcriptRef.current = '';

      // Web Speech API でリアルタイム転写開始
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = speechLang;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              final += result[0].transcript;
            } else {
              interim += result[0].transcript;
            }
          }
          if (final) {
            transcriptRef.current += final + '\n';
            setLiveTranscript(transcriptRef.current);
          }
          setInterimText(interim);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          // network errorの場合は再起動を試みる
          if (event.error === 'network' || event.error === 'no-speech') {
            setTimeout(() => {
              if (recognitionRef.current && isRecording) {
                try { recognitionRef.current.start(); } catch(e) {}
              }
            }, 1000);
          }
        };

        recognition.onend = () => {
          // 録音中なら自動再開（ブラウザが自動停止することがあるため）
          if (recognitionRef.current) {
            try { recognition.start(); } catch(e) {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '録音の開始に失敗しました';
      setError(errorMsg);
      console.error('Recording start error:', err);
    }
  }, [startRecordingMutation, speechLang]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !currentMeetingId) return;

    setIsRecording(false);
    setProcessingStep('AI要約を生成中...');

    // Web Speech API停止
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // 自動再開を防止
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    
    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        try {
          const finalTranscript = transcriptRef.current.trim();

          if (!finalTranscript) {
            setError('音声が認識できませんでした。マイクの設定を確認してください。');
            setProcessingStep(null);
            resolve();
            return;
          }

          setProcessingStep('AI要約を生成中...');

          try {
            const result = await saveTranscriptMutation.mutateAsync({
              meetingId: currentMeetingId,
              transcript: finalTranscript,
              durationSeconds: recordingTime,
            });

            if (result.success) {
              setProcessingStep(null);
              setCurrentMeetingId(null);
              setLiveTranscript('');
              setInterimText('');
              refetchHistory();
              refetchToday();
            } else {
              setError(result.error || '処理に失敗しました');
              setProcessingStep(null);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : '処理に失敗しました');
            setProcessingStep(null);
          }
          resolve();
        } catch (err) {
          setError(err instanceof Error ? err.message : '処理に失敗しました');
          setProcessingStep(null);
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  }, [currentMeetingId, recordingTime, saveTranscriptMutation, refetchHistory, refetchToday]);

  const handleDelete = async (id: number) => {
    if (!confirm('この記録を削除しますか？')) return;
    await deleteMutation.mutateAsync({ id });
    refetchHistory();
    if (selectedMeeting?.id === id) setSelectedMeeting(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">朝会録音</h1>
            <p className="text-sm text-gray-500 mt-1">録音 → 文字起こし → AI要約</p>
          </div>
          {stats && (
            <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
              <span>今月: {stats.totalMeetings}回</span>
              <span>平均: {Math.floor((stats.avgDuration || 0) / 60)}分{(stats.avgDuration || 0) % 60}秒</span>
            </div>
          )}
        </div>

        {/* Recording Section */}
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-6">
              {/* Recording Button */}
              {!isRecording && !processingStep && (
                <>
                  <button
                    onClick={startRecording}
                    className="w-32 h-32 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
                  >
                    <Mic className="w-12 h-12" />
                  </button>
                  <p className="text-gray-600 font-medium">タップして録音開始</p>
                  {/* 言語切替 */}
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setSpeechLang("ja-JP")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${speechLang === "ja-JP" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>🇯🇵 日本語</button>
                    <button onClick={() => setSpeechLang("zh-CN")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${speechLang === "zh-CN" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>🇨🇳 中文</button>
                  </div>
                  {todayMeeting && todayMeeting.status === 'completed' && (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      今日の朝会は記録済み
                    </Badge>
                  )}
                </>
              )}

              {/* Recording in progress */}
              {isRecording && (
                <>
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                      <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center">
                        <Mic className="w-10 h-10 text-white" />
                      </div>
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-mono font-bold text-red-600">{formatTime(recordingTime)}</p>
                    <p className="text-sm text-gray-500 mt-1">録音中...</p>
                  </div>
                  {/* 録音中の言語切替 */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setSpeechLang("ja-JP"); if (recognitionRef.current) { recognitionRef.current.lang = "ja-JP"; recognitionRef.current.stop(); } }} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${speechLang === "ja-JP" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}`}>🇯🇵 日本語</button>
                    <button onClick={() => { setSpeechLang("zh-CN"); if (recognitionRef.current) { recognitionRef.current.lang = "zh-CN"; recognitionRef.current.stop(); } }} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${speechLang === "zh-CN" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}>🇨🇳 中文</button>
                  </div>
                  <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <p className="text-xs text-gray-400 mb-2 font-medium">📝 リアルタイム文字起こし</p>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {liveTranscript}
                      {interimText && <span className="text-gray-400 italic">{interimText}</span>}
                      {!liveTranscript && !interimText && (
                        <span className="text-gray-400">話し始めると文字が表示されます...</span>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="lg"
                    className="px-8"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    録音停止 & 処理開始
                  </Button>
                </>
              )}

              {/* Processing */}
              {processingStep && (
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  <p className="text-blue-600 font-medium">{processingStep}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>録音時間: {formatTime(recordingTime)}</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                  <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">×</button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Meeting Result */}
        {todayMeeting && todayMeeting.status === 'completed' && todayMeeting.summary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                今日の朝会サマリー
                <Badge variant="secondary" className="ml-auto">
                  {todayMeeting.durationSeconds ? `${Math.floor(todayMeeting.durationSeconds / 60)}分${todayMeeting.durationSeconds % 60}秒` : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingSummaryView summary={todayMeeting.summary as MeetingSummary} />
            </CardContent>
          </Card>
        )}

        {/* History Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">過去の記録</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="検索..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                    className="pl-9 w-48"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {historyData?.meetings && historyData.meetings.length > 0 ? (
              <div className="space-y-3">
                {historyData.meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedMeeting?.id === meeting.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedMeeting(selectedMeeting?.id === meeting.id ? null : meeting)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{meeting.date}</span>
                          <span className="text-xs text-gray-500">
                            {meeting.createdByName || '不明'}
                          </span>
                        </div>
                        <Badge variant={meeting.status === 'completed' ? 'default' : meeting.status === 'failed' ? 'destructive' : 'secondary'}>
                          {meeting.status === 'completed' ? '完了' : meeting.status === 'failed' ? 'エラー' : '処理中'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {meeting.durationSeconds && (
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.floor(meeting.durationSeconds / 60)}分{meeting.durationSeconds % 60}秒
                          </span>
                        )}
                        {meeting.summary && (meeting.summary as MeetingSummary).participants && (
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {(meeting.summary as MeetingSummary).participants.length}名
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(meeting.id); }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded view */}
                    {selectedMeeting?.id === meeting.id && meeting.summary && (
                      <div className="mt-4 pt-4 border-t">
                        <MeetingSummaryView summary={meeting.summary as MeetingSummary} />
                        {meeting.transcript && (
                          <details className="mt-4">
                            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                              文字起こし全文を表示
                            </summary>
                            <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                              {meeting.transcript}
                            </p>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Pagination */}
                {historyData.total > 10 && (
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-gray-500">
                      全{historyData.total}件中 {page * 10 + 1}-{Math.min((page + 1) * 10, historyData.total)}件
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={(page + 1) * 10 >= historyData.total}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Mic className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>まだ記録がありません</p>
                <p className="text-sm mt-1">上のボタンから録音を開始してください</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Summary display component
function MeetingSummaryView({ summary }: { summary: MeetingSummary }) {
  if (!summary) return null;

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="bg-blue-50 p-3 rounded-lg">
        <p className="text-sm font-medium text-blue-800">{summary.overview}</p>
      </div>

      {/* Culture Rule Badge */}
      {summary.cultureRuleRead && (
        <Badge variant="outline" className="text-green-600 border-green-300">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          企業文化朗読あり
        </Badge>
      )}

      {/* Participants */}
      {summary.participants && summary.participants.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <Users className="w-4 h-4" />
            参加者の報告
          </h4>
          <div className="grid gap-2">
            {summary.participants.map((p, i) => (
              <div key={i} className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-start justify-between">
                  <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">📋 {p.todayTask}</p>
                {p.supportNeeded && (
                  <p className="text-sm text-orange-600 mt-1">🆘 {p.supportNeeded}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {summary.actionItems && summary.actionItems.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">アクションアイテム</h4>
          <div className="space-y-1">
            {summary.actionItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                <span className="text-gray-700">
                  <strong>{item.person}</strong>: {item.task}
                  {item.deadline && <span className="text-gray-400 ml-1">({item.deadline})</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
