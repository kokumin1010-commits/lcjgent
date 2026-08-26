import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mic, Volume2, AlertTriangle, Square, Loader2, Calendar, Clock, Search, ChevronLeft, ChevronRight, Users, CheckCircle2, AlertCircle, Trash2, ChevronDown, ChevronUp, Download, BookOpenCheck, Languages, UserRound, UsersRound } from 'lucide-react';
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

type SpeechLanguage = "ja-JP" | "zh-CN";

type CulturePrinciple = {
  title: string;
  detail: string;
};

const LCJ_CULTURE_PRINCIPLES: Record<SpeechLanguage, CulturePrinciple[]> = {
  "ja-JP": [
    { title: "やると決めたら、100％やり切る。", detail: "昨日の最高記録を、今日からの最低基準にする。" },
    { title: "約束は、必ず守る。", detail: "催促を待たず、期限までに結果を出す。" },
    { title: "「時間がない」と言わない。", detail: "優先順位を決め、今できる一歩を進める。" },
    { title: "言い訳ではなく、解決策を出す。", detail: "必要なものがあれば、すぐに、率直に伝える。" },
    { title: "気づいたことは、その場で伝える。", detail: "遠回しにせず、黙らず、問題を小さいうちに解決する。" },
    { title: "意味のないルールは、なくす。", detail: "形式ではなく、結果につながる方法を選ぶ。" },
    { title: "自分がオーナーだと思って動く。", detail: "自分で考え、自分で決め、最後まで責任を持つ。" },
    { title: "共に進む仲間に、全力を尽くす。", detail: "30人の普通より、3人の覚悟を持った精鋭になる。" },
    { title: "すべては、LCJの成功のために。", detail: "LCJと共に成長し、自分たちの未来を引き上げる。" },
  ],
  "zh-CN": [
    { title: "做就做100%。做到过，就不许退步。", detail: "你的最高纪录，就是你的最低标准。" },
    { title: "说到做到。做不到，信用就没了。", detail: "没人催你，但到期要交。" },
    { title: "不说『没时间』。只说优先级。", detail: "人都有可能性，不要给自己设限。" },
    { title: "不找借口。说你需要什么。", detail: "解决问题的人升职，制造借口的人淘汰。" },
    { title: "有事直接说。不绕弯，不沉默。", detail: "沉默不是谦虚，沉默是让问题变大。" },
    { title: "没用的规则，砍掉。", detail: "我们要结果，不要流程。" },
    { title: "你就是老板。自己决定，自己负责。", detail: "做对了是你的，做错了你扛。" },
    { title: "留下来的人，全力对待。", detail: "3个英雄胜过30个普通人。" },
    { title: "一切为了LCJ成功。", detail: "LCJ成功了，你不可能还在地上。" },
  ],
};

async function blobToBase64Payload(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("音声データの変換に失敗しました"));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(reader.error || new Error("音声データの変換に失敗しました"));
    reader.readAsDataURL(blob);
  });
}

const MORNING_MEETING_COPY: Record<SpeechLanguage, {
  pageTitle: string;
  pageSubtitle: string;
  principlesTitle: string;
  principlesSubtitle: string;
  closing: string;
  tapToStart: string;
  recording: string;
  transcriptTitle: string;
  transcriptHint: string;
  stopAndProcess: string;
  processing: string;
  recordedToday: string;
  personalTitle: string;
  personalDescription: string;
  personalStart: string;
  personalStop: string;
  personalUploading: string;
  personalDone: string;
  teamTitle: string;
  teamDescription: string;
  completionProgress: string;
  pending: string;
}> = {
  "ja-JP": {
    pageTitle: "朝会録音",
    pageSubtitle: "9つの行動原則を朗読 → 朝会録音 → 文字起こし → AI要約",
    principlesTitle: "LCJ 9つの行動原則",
    principlesSubtitle: "毎朝、全員で声に出して確認する。",
    closing: "今日も、昨日の自分を超える。すべては、LCJの成功のために。",
    tapToStart: "タップして録音開始",
    recording: "録音中...",
    transcriptTitle: "リアルタイム文字起こし",
    transcriptHint: "話し始めると文字が表示されます...",
    stopAndProcess: "録音停止・処理開始",
    processing: "AI要約を生成中...",
    recordedToday: "今日の朝会は記録済み",
    personalTitle: "STEP 1｜個人9条朗読",
    personalDescription: "自分のアカウントで朗読し、本人別に音声を保存します。",
    personalStart: "個人朗読を録音",
    personalStop: "朗読を終了して登録",
    personalUploading: "個人朗読を登録中...",
    personalDone: "本日の個人朗読は完了しました",
    teamTitle: "STEP 2｜チーム朝会",
    teamDescription: "個人朗読の後、全員で業務共有・課題確認を行います。",
    completionProgress: "本日の個人朗読",
    pending: "未完了",
  },
  "zh-CN": {
    pageTitle: "早会录音",
    pageSubtitle: "朗读9条铁律 → 早会录音 → 语音转写 → AI总结",
    principlesTitle: "LCJ 9条铁律",
    principlesSubtitle: "每天早会，全员一起朗读。",
    closing: "今天也要超越昨天的自己。一切为了LCJ成功。",
    tapToStart: "点击开始录音",
    recording: "录音中...",
    transcriptTitle: "实时语音转写",
    transcriptHint: "开始讲话后，文字会显示在这里...",
    stopAndProcess: "停止录音并开始处理",
    processing: "正在生成AI总结...",
    recordedToday: "今天的早会已完成记录",
    personalTitle: "第1步｜个人朗读9条铁律",
    personalDescription: "使用自己的账号朗读，录音按本人分别保存。",
    personalStart: "录制个人朗读",
    personalStop: "结束朗读并上传",
    personalUploading: "正在上传个人朗读...",
    personalDone: "今天的个人朗读已完成",
    teamTitle: "第2步｜团队早会",
    teamDescription: "个人朗读后，全员进行工作汇报与问题确认。",
    completionProgress: "今天的个人朗读",
    pending: "未完成",
  },
};

export default function MorningMeeting() {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [speechLang, setSpeechLang] = useState<SpeechLanguage>("ja-JP");
  const [recordingTime, setRecordingTime] = useState(0);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [currentMeetingId, setCurrentMeetingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [isPersonalRecording, setIsPersonalRecording] = useState(false);
  const [personalRecordingTime, setPersonalRecordingTime] = useState(0);
  const [personalProcessing, setPersonalProcessing] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimText, setInterimText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const personalMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const personalChunksRef = useRef<Blob[]>([]);
  const personalStreamRef = useRef<MediaStream | null>(null);
  const personalTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecordingMutation = trpc.morningMeeting.startRecording.useMutation();
  const saveTranscriptMutation = trpc.morningMeeting.saveTranscriptAndSummarize.useMutation();
  const uploadAndProcessMutation = trpc.morningMeeting.uploadAndProcess.useMutation();
  const savePersonalRecitationMutation = trpc.morningMeeting.savePersonalRecitation.useMutation();
  const deleteMutation = trpc.morningMeeting.delete.useMutation();

  const { data: historyData, refetch: refetchHistory } = trpc.morningMeeting.getHistory.useQuery({
    limit: 10,
    offset: page * 10,
    search: searchQuery || undefined,
  });

  const { data: todayMeeting, refetch: refetchToday } = trpc.morningMeeting.getTodayMeeting.useQuery();
  const { data: personalToday, refetch: refetchPersonalToday } = trpc.morningMeeting.getTodayPersonalRecitations.useQuery({});
  const { data: stats } = trpc.morningMeeting.getStats.useQuery({ period: 'month' });
  // 昨日の朝会録音チェック
  const missingCheck = trpc.morningMeeting.checkMissingRecording.useQuery();
  const [showMissingAlert, setShowMissingAlert] = useState(true);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const copy = MORNING_MEETING_COPY[speechLang];
  const culturePrinciples = LCJ_CULTURE_PRINCIPLES[speechLang];

  const changeSpeechLanguage = useCallback((language: SpeechLanguage) => {
    setSpeechLang(language);
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
      recognitionRef.current.stop();
    }
  }, []);

  useEffect(() => {
    if (isPersonalRecording) {
      personalTimerRef.current = setInterval(() => {
        setPersonalRecordingTime((previous) => previous + 1);
      }, 1000);
    } else if (personalTimerRef.current) {
      clearInterval(personalTimerRef.current);
      personalTimerRef.current = null;
    }
    return () => {
      if (personalTimerRef.current) clearInterval(personalTimerRef.current);
    };
  }, [isPersonalRecording]);

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

  const startPersonalRecitation = useCallback(async () => {
    if (personalToday?.ownRecord || isRecording) return;
    try {
      setPersonalError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      personalStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      personalMediaRecorderRef.current = recorder;
      personalChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) personalChunksRef.current.push(event.data);
      };
      recorder.start(1000);
      setPersonalRecordingTime(0);
      setIsPersonalRecording(true);
    } catch (err) {
      setPersonalError(err instanceof Error ? err.message : "個人朗読の録音開始に失敗しました");
    }
  }, [personalToday?.ownRecord, isRecording]);

  const stopPersonalRecitation = useCallback(async () => {
    const recorder = personalMediaRecorderRef.current;
    if (!recorder) return;
    setIsPersonalRecording(false);
    setPersonalProcessing(true);

    await new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        if (personalStreamRef.current) {
          personalStreamRef.current.getTracks().forEach((track) => track.stop());
          personalStreamRef.current = null;
        }
        try {
          const mimeType = recorder.mimeType || "audio/webm";
          const audioBlob = new Blob(personalChunksRef.current, { type: mimeType });
          if (audioBlob.size === 0 || audioBlob.size > 20 * 1024 * 1024) {
            throw new Error(speechLang === "zh-CN" ? "个人朗读录音为空或超过20MB" : "個人朗読の音声が空、または20MBを超えています");
          }
          const audioBase64 = await blobToBase64Payload(audioBlob);
          await savePersonalRecitationMutation.mutateAsync({
            audioBase64,
            mimeType,
            durationSeconds: personalRecordingTime,
            language: speechLang === "zh-CN" ? "zh" : "ja",
          });
          personalChunksRef.current = [];
          setPersonalRecordingTime(0);
          await refetchPersonalToday();
        } catch (err) {
          setPersonalError(err instanceof Error ? err.message : "個人朗読の登録に失敗しました");
        } finally {
          setPersonalProcessing(false);
          personalMediaRecorderRef.current = null;
          resolve();
        }
      };
      recorder.stop();
    });
  }, [personalRecordingTime, refetchPersonalToday, savePersonalRecitationMutation, speechLang]);

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
    setProcessingStep(copy.processing);

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
          const mimeType = mediaRecorder.mimeType || "audio/webm";
          const audioBlob = new Blob(chunksRef.current, { type: mimeType });
          if (audioBlob.size === 0 || audioBlob.size > 60 * 1024 * 1024) {
            throw new Error(speechLang === "zh-CN" ? "团队早会录音为空或超过60MB" : "チーム朝会の音声が空、または60MBを超えています");
          }
          const audioBase64 = await blobToBase64Payload(audioBlob);
          const language = speechLang === "zh-CN" ? "zh" : "ja";

          setProcessingStep(copy.processing);

          try {
            const result = finalTranscript
              ? await saveTranscriptMutation.mutateAsync({
                  meetingId: currentMeetingId,
                  transcript: finalTranscript,
                  durationSeconds: recordingTime,
                  language,
                  audioBase64,
                  mimeType,
                })
              : await uploadAndProcessMutation.mutateAsync({
                  meetingId: currentMeetingId,
                  audioBase64,
                  mimeType,
                  durationSeconds: recordingTime,
                  language,
                });

            if (result.success) {
              setProcessingStep(null);
              setCurrentMeetingId(null);
              setLiveTranscript('');
              setInterimText('');
              chunksRef.current = [];
              await Promise.all([refetchHistory(), refetchToday()]);
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
  }, [currentMeetingId, recordingTime, saveTranscriptMutation, uploadAndProcessMutation, refetchHistory, refetchToday, copy.processing, speechLang]);

  const handleDelete = async (id: number) => {
    if (!confirm(speechLang === "zh-CN" ? "确定要删除这条记录吗？" : "この記録を削除しますか？")) return;
    await deleteMutation.mutateAsync({ id });
    refetchHistory();
    if (selectedMeeting?.id === id) setSelectedMeeting(null);
  };


  const exportMeetingMinutes = (meeting: any) => {
    const summary = meeting.summary as MeetingSummary;
    let text = `会議纪要 - ${meeting.date}\n`;
    text += `=${'='.repeat(40)}\n\n`;
    text += `時間: ${meeting.durationSeconds ? Math.floor(meeting.durationSeconds / 60) + '分' + (meeting.durationSeconds % 60) + '秒' : '不明'}\n`;
    text += `参加者: ${summary?.participants?.length || 0}名\n\n`;
    
    if (summary?.overview) {
      text += `【概要】\n${summary.overview}\n\n`;
    }
    
    if (summary?.participants?.length) {
      text += `【参加者報告】\n`;
      summary.participants.forEach(p => {
        text += `■ ${p.name}\n`;
        text += `  今日のタスク: ${p.todayTask}\n`;
        if (p.supportNeeded) text += `  サポート必要: ${p.supportNeeded}\n`;
        text += `\n`;
      });
    }
    
    if (summary?.actionItems?.length) {
      text += `【アクションアイテム】\n`;
      summary.actionItems.forEach(a => {
        text += `- ${a.person}: ${a.task}${a.deadline ? ` (期限: ${a.deadline})` : ''}\n`;
      });
      text += `\n`;
    }
    
    if (meeting.transcript) {
      text += `【原始转写内容】\n`;
      text += `${meeting.transcript}\n`;
    }
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `会議纪要_${meeting.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* 朝会録音欠失アラート */}
      {missingCheck.data?.missing && showMissingAlert && (
        <div className="w-full max-w-4xl mx-auto mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-red-700">{speechLang === "zh-CN" ? "⚠️ 早会录音尚未登记" : "⚠️ 朝会録音が未登録です"}</p>
            <p className="text-sm text-red-600 mt-1">
              {speechLang === "zh-CN"
                ? `${missingCheck.data.date} 没有早会录音。若忘记录音，请确认原因。`
                : `${missingCheck.data.date} の朝会録音がありません。録音を忘れた場合は理由を確認してください。`}
            </p>
          </div>
          <button onClick={() => setShowMissingAlert(false)} className="text-red-400 hover:text-red-600 text-lg font-bold">×</button>
        </div>
      )}
      <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-2">
        {/* Header */}
        <div className="order-1 flex items-center justify-between gap-4 lg:col-span-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{copy.pageTitle}</h1>
            <p className="text-sm text-gray-500 mt-1">{copy.pageSubtitle}</p>
          </div>
          {stats && (
            <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
              <span>{speechLang === "zh-CN" ? "本月" : "今月"}: {stats.totalMeetings}{speechLang === "zh-CN" ? "次" : "回"}</span>
              <span>{speechLang === "zh-CN" ? "平均" : "平均"}: {Math.floor((stats.avgDuration || 0) / 60)}分{(stats.avgDuration || 0) % 60}秒</span>
            </div>
          )}
        </div>

        {/* STEP 1: Personal recitation recording */}
        <Card className="order-2 border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{copy.personalTitle}</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">{copy.personalDescription}</p>
                </div>
              </div>
              {personalToday && (
                <Badge variant="outline" className="whitespace-nowrap border-blue-200 text-blue-700">
                  {copy.completionProgress}: {personalToday.completedCount}/{personalToday.totalCount}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {personalToday?.ownRecord ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <p className="mt-3 font-bold text-green-800">{copy.personalDone}</p>
                <p className="mt-1 text-sm text-green-700">
                  {personalToday.ownRecord.userName} · {formatTime(personalToday.ownRecord.durationSeconds)}
                </p>
                <div className="mt-3">
                  <PersonalRecitationAudioButton recitationId={personalToday.ownRecord.id} />
                </div>
              </div>
            ) : personalProcessing ? (
              <div className="flex min-h-40 flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-medium text-blue-700">{copy.personalUploading}</p>
              </div>
            ) : isPersonalRecording ? (
              <div className="flex min-h-40 flex-col items-center justify-center">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg">
                  <Mic className="h-8 w-8" />
                  <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-red-400" />
                </div>
                <p className="mt-3 font-mono text-2xl font-bold text-red-600">{formatTime(personalRecordingTime)}</p>
                <Button onClick={stopPersonalRecitation} variant="destructive" className="mt-3">
                  <Square className="mr-2 h-4 w-4" />
                  {copy.personalStop}
                </Button>
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={startPersonalRecitation}
                  aria-label={copy.personalStart}
                  disabled={isRecording}
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Mic className="h-9 w-9" />
                </button>
                <p className="mt-3 font-semibold text-gray-700">{copy.personalStart}</p>
              </div>
            )}

            {personalError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-none" />
                <span>{personalError}</span>
                <button type="button" onClick={() => setPersonalError(null)} className="ml-auto">×</button>
              </div>
            )}

            {personalToday && personalToday.members.length > 1 && (
              <div className="max-h-40 overflow-y-auto rounded-xl border bg-white/80 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {personalToday.members.map((member, index) => (
                    <div key={`${member.staffId || member.userId || "member"}-${index}`} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      {member.completed ? <CheckCircle2 className="h-4 w-4 flex-none text-green-600" /> : <Clock className="h-4 w-4 flex-none text-gray-400" />}
                      <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{member.name}</span>
                      {member.position && <span className="truncate text-xs text-gray-500">{member.position}</span>}
                      {member.recitation?.id && <PersonalRecitationAudioButton recitationId={member.recitation.id} compact />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* LCJ Culture Principles */}
        <Card className="order-3 overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-red-950 to-slate-900 text-white shadow-xl lg:col-span-2">
          <CardHeader className="border-b border-white/10 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-red-500/20 p-3 ring-1 ring-red-300/30">
                  <BookOpenCheck className="h-6 w-6 text-red-200" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white sm:text-2xl">{copy.principlesTitle}</CardTitle>
                  <p className="mt-1 text-sm text-slate-300">{copy.principlesSubtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label="Morning meeting language">
                <Languages className="h-4 w-4 text-slate-300" />
                <button
                  type="button"
                  aria-pressed={speechLang === "ja-JP"}
                  onClick={() => changeSpeechLanguage("ja-JP")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97] ${speechLang === "ja-JP" ? "bg-white text-slate-950 shadow-sm" : "bg-white/10 text-white hover:bg-white/20"}`}
                >
                  🇯🇵 日本語
                </button>
                <button
                  type="button"
                  aria-pressed={speechLang === "zh-CN"}
                  onClick={() => changeSpeechLanguage("zh-CN")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97] ${speechLang === "zh-CN" ? "bg-red-500 text-white shadow-sm" : "bg-white/10 text-white hover:bg-white/20"}`}
                >
                  🇨🇳 中文
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {culturePrinciples.map((principle, index) => (
                <li key={`${speechLang}-${index}`} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-red-500 text-sm font-black text-white shadow-sm">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold leading-relaxed text-white">{principle.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">{principle.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-xl border border-red-300/20 bg-red-500/15 px-4 py-3 text-center">
              <p className="text-base font-black leading-relaxed text-red-100 sm:text-lg">{copy.closing}</p>
            </div>
          </CardContent>
        </Card>

        {/* Recording Section */}
        <Card className="order-2 border-2 border-dashed border-red-100 bg-gradient-to-br from-white to-red-50/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-100 p-2.5 text-red-700">
                <UsersRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{copy.teamTitle}</CardTitle>
                <p className="mt-1 text-sm text-gray-500">{copy.teamDescription}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <div className="flex flex-col items-center space-y-6">
              {/* Recording Button */}
              {!isRecording && !processingStep && (
                <>
                  <button
                    onClick={startRecording}
                    aria-label={copy.tapToStart}
                    disabled={isPersonalRecording || personalProcessing}
                    className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Mic className="w-9 h-9" />
                  </button>
                  <p className="text-gray-600 font-medium">{copy.tapToStart}</p>
                  {/* 言語切替 */}
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" aria-pressed={speechLang === "ja-JP"} onClick={() => changeSpeechLanguage("ja-JP")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.97] ${speechLang === "ja-JP" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>🇯🇵 日本語</button>
                    <button type="button" aria-pressed={speechLang === "zh-CN"} onClick={() => changeSpeechLanguage("zh-CN")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.97] ${speechLang === "zh-CN" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>🇨🇳 中文</button>
                  </div>
                  {todayMeeting && todayMeeting.status === 'completed' && (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {copy.recordedToday}
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
                    <p className="text-sm text-gray-500 mt-1">{copy.recording}</p>
                  </div>
                  {/* 録音中の言語切替 */}
                  <div className="flex items-center gap-2">
                    <button type="button" aria-pressed={speechLang === "ja-JP"} onClick={() => changeSpeechLanguage("ja-JP")} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${speechLang === "ja-JP" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}`}>🇯🇵 日本語</button>
                    <button type="button" aria-pressed={speechLang === "zh-CN"} onClick={() => changeSpeechLanguage("zh-CN")} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${speechLang === "zh-CN" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}>🇨🇳 中文</button>
                  </div>
                  <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <p className="text-xs text-gray-400 mb-2 font-medium">📝 {copy.transcriptTitle}</p>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {liveTranscript}
                      {interimText && <span className="text-gray-400 italic">{interimText}</span>}
                      {!liveTranscript && !interimText && (
                        <span className="text-gray-400">{copy.transcriptHint}</span>
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
                    {copy.stopAndProcess}
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
          <Card className="order-4 lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                {speechLang === "zh-CN" ? "今天的早会总结" : "今日の朝会サマリー"}
                <Badge variant="secondary" className="ml-auto">
                  {todayMeeting.durationSeconds ? `${Math.floor(todayMeeting.durationSeconds / 60)}分${todayMeeting.durationSeconds % 60}秒` : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingSummaryView summary={todayMeeting.summary as MeetingSummary} language={speechLang} />
            </CardContent>
            {todayMeeting.transcript && (
              <CardContent className="pt-0">
                <details className="group">
                  <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800 font-medium flex items-center gap-1">
                    📝 {speechLang === "zh-CN" ? "原始转写内容（点击展开）" : "文字起こし原文（クリックして展開）"}
                  </summary>
                  <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border rounded-lg p-4 max-h-96 overflow-y-auto leading-relaxed">
                    {todayMeeting.transcript}
                  </div>
                </details>
              </CardContent>
            )}
          </Card>
        )}

        {/* History Section */}
        <Card className="order-5 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{speechLang === "zh-CN" ? "历史记录" : "過去の記録"}</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder={speechLang === "zh-CN" ? "搜索..." : "検索..."}
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
                    className={`p-4 rounded-lg border transition-colors ${
                      selectedMeeting?.id === meeting.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    }`}
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
                          {meeting.status === 'completed'
                            ? (speechLang === "zh-CN" ? "完成" : "完了")
                            : meeting.status === 'failed'
                              ? (speechLang === "zh-CN" ? "错误" : "エラー")
                              : (speechLang === "zh-CN" ? "处理中" : "処理中")}
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
                            {(meeting.summary as MeetingSummary).participants.length}{speechLang === "zh-CN" ? "人" : "名"}
                          </span>
                        )}
                        {meeting.status === 'completed' && meeting.audioKey && (
                          <AudioPlayButton meetingId={meeting.id} />
                        )}
                        {meeting.status === 'completed' && (
                          <button
                            onClick={() => exportMeetingMinutes(meeting)}
                            className="text-gray-400 hover:text-blue-500 transition-colors"
                            title={speechLang === "zh-CN" ? "导出会议纪要" : "会議議事録を出力"}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedMeeting(selectedMeeting?.id === meeting.id ? null : meeting)}
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                          title={selectedMeeting?.id === meeting.id
                            ? (speechLang === "zh-CN" ? "收起" : "閉じる")
                            : (speechLang === "zh-CN" ? "展开" : "展開")}
                        >
                          {selectedMeeting?.id === meeting.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
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
                        <MeetingSummaryView summary={meeting.summary as MeetingSummary} language={speechLang} />
                        {meeting.transcript && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-sm font-medium text-gray-700 mb-2">📝 {speechLang === "zh-CN" ? "原始转写内容" : "文字起こし原文"}</p>
                            <div className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto leading-relaxed border">
                              {meeting.transcript}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Pagination */}
                {historyData.total > 10 && (
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-gray-500">
                      {speechLang === "zh-CN" ? "共" : "全"}{historyData.total}{speechLang === "zh-CN" ? "条" : "件中"} {page * 10 + 1}-{Math.min((page + 1) * 10, historyData.total)}{speechLang === "zh-CN" ? "条" : "件"}
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
                <p>{speechLang === "zh-CN" ? "暂无记录" : "まだ記録がありません"}</p>
                <p className="text-sm mt-1">{speechLang === "zh-CN" ? "请点击上方按钮开始录音" : "上のボタンから録音を開始してください"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Summary display component
function MeetingSummaryView({ summary, language }: { summary: MeetingSummary; language: SpeechLanguage }) {
  if (!summary) return null;
  const isChinese = language === "zh-CN";

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
          {isChinese ? "已朗读企业文化" : "企業文化朗読あり"}
        </Badge>
      )}

      {/* Participants */}
      {summary.participants && summary.participants.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <Users className="w-4 h-4" />
            {isChinese ? "参加者汇报" : "参加者の報告"}
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
          <h4 className="text-sm font-medium text-gray-700 mb-2">{isChinese ? "行动事项" : "アクションアイテム"}</h4>
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


// Audio play button component
function PersonalRecitationAudioButton({ recitationId, compact = false }: { recitationId: number; compact?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlQuery = trpc.morningMeeting.getPersonalRecitationAudioUrl.useQuery(
    { id: recitationId },
    { enabled: isPlaying },
  );

  const togglePlay = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
  };

  useEffect(() => {
    if (audioUrlQuery.data?.url && isPlaying) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrlQuery.data.url);
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.onerror = () => setIsPlaying(false);
      }
      audioRef.current.src = audioUrlQuery.data.url;
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [audioUrlQuery.data?.url, isPlaying]);

  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); togglePlay(); }}
      className={`inline-flex items-center gap-1 rounded-full transition-colors ${compact ? "p-1" : "border border-green-200 bg-white px-3 py-1.5 text-sm font-medium"} ${isPlaying ? "text-green-700" : "text-gray-500 hover:text-green-700"}`}
      title={isPlaying ? "停止" : "個人朗読音声を再生"}
    >
      <Volume2 className={`${compact ? "h-4 w-4" : "h-4 w-4"} ${isPlaying ? "animate-pulse" : ""}`} />
      {!compact && (isPlaying ? "停止" : "音声を再生")}
    </button>
  );
}

function AudioPlayButton({ meetingId }: { meetingId: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlQuery = trpc.morningMeeting.getAudioUrl.useQuery(
    { id: meetingId },
    { enabled: isPlaying }
  );

  const togglePlay = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
  };

  useEffect(() => {
    if (audioUrlQuery.data?.url && isPlaying) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrlQuery.data.url);
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.onerror = () => setIsPlaying(false);
      }
      audioRef.current.src = audioUrlQuery.data.url;
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [audioUrlQuery.data?.url, isPlaying]);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); togglePlay(); }}
      className={`transition-colors ${isPlaying ? "text-green-500" : "text-gray-400 hover:text-green-500"}`}
      title={isPlaying ? "停止" : "音声を再生"}
    >
      <Volume2 className={`w-4 h-4 ${isPlaying ? "animate-pulse" : ""}`} />
    </button>
  );
}
