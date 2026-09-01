import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mic, Volume2, Square, Loader2, Calendar, Clock, Search, ChevronLeft, ChevronRight, Users, CheckCircle2, AlertCircle, Trash2, ChevronDown, ChevronUp, Download, BookOpenCheck, Languages, UserRound, UsersRound } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { MicrophoneRecoveryAlert } from '@/components/morningMeeting/MicrophoneRecoveryAlert';
import {
  classifyMicrophoneIssue,
  getMicrophonePermissionStatus,
  requestMicrophoneStream,
  type MicrophoneIssue,
  type MicrophonePermissionState,
} from '@shared/microphonePermission';

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
type TeamMeetingCode = "china" | "japan";
type RecordingTarget = "personal" | "team";

const TEAM_MEETING_META: Record<TeamMeetingCode, { zh: string; ja: string; flag: string }> = {
  china: { zh: "中国团队", ja: "中国チーム", flag: "🇨🇳" },
  japan: { zh: "日本团队", ja: "日本チーム", flag: "🇯🇵" },
};

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

function friendlyRecordingError(error: unknown, language: SpeechLanguage, fallback: string) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.trim().startsWith("[{") || message.includes('"code":"')) return fallback;
  return message || fallback;
}

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
  currentStaff: string;
  tapNameToSelect: string;
  allRequired: string;
  meetingUploading: string;
  meetingDone: string;
  selectParticipants: string;
  selectAllParticipants: string;
  clearParticipants: string;
  selectedParticipants: string;
  historyPrinciples: string;
  historyTeam: string;
  historyLegacy: string;
}> = {
  "ja-JP": {
    pageTitle: "朝会録音",
    pageSubtitle: "9条朗読は本人別、チーム朝会は参加者を選んで1日1回だけ録音",
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
    personalTitle: "9条朗読録音｜全員必須",
    personalDescription: "自分のアカウントで朗読し、本人別に音声を保存します。",
    personalStart: "個人朗読を録音",
    personalStop: "朗読を終了して登録",
    personalUploading: "個人朗読を登録中...",
    personalDone: "本日の個人朗読は完了しました",
    teamTitle: "チーム朝会｜中国・日本それぞれ1日1回",
    teamDescription: "中国チームと日本チームを分け、開始時刻と実際の録音時間を記録します。",
    completionProgress: "9条完了＋朝会参加",
    pending: "未完了",
    currentStaff: "現在のスタッフ",
    tapNameToSelect: "氏名をタップして対象者を選択",
    allRequired: "本人の9条朗読とチーム朝会への参加で本日完了です",
    meetingUploading: "早会録音を保存・AI処理中...",
    meetingDone: "本日のチーム朝会は完了しました",
    selectParticipants: "朝会参加者を選択",
    selectAllParticipants: "全員を選択",
    clearParticipants: "選択解除",
    selectedParticipants: "参加予定",
    historyPrinciples: "9条朗読記録",
    historyTeam: "チーム朝会記録",
    historyLegacy: "旧朝会記録",
  },
  "zh-CN": {
    pageTitle: "早会录音",
    pageSubtitle: "9条朗读按本人保存，团队早会选择参加者后每天只录一场",
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
    personalTitle: "9条朗读录音｜全员必做",
    personalDescription: "使用自己的账号朗读，录音按本人分别保存。",
    personalStart: "录制个人朗读",
    personalStop: "结束朗读并上传",
    personalUploading: "正在上传个人朗读...",
    personalDone: "今天的个人朗读已完成",
    teamTitle: "团队早会｜中国、日本每天各一次",
    teamDescription: "中国团队与日本团队分别开始，记录开始时间和实际录音时长。",
    completionProgress: "9条完成＋参加早会",
    pending: "未完成",
    currentStaff: "当前员工",
    tapNameToSelect: "点击姓名选择员工",
    allRequired: "完成本人9条朗读并参加团队早会，才算今天完成",
    meetingUploading: "正在保存早会录音并进行AI处理...",
    meetingDone: "今天的团队早会已完成",
    selectParticipants: "选择早会参加者",
    selectAllParticipants: "全选",
    clearParticipants: "取消选择",
    selectedParticipants: "预计参加",
    historyPrinciples: "9条朗读记录",
    historyTeam: "团队早会记录",
    historyLegacy: "旧早会记录",
  },
};

export default function MorningMeeting() {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [speechLang, setSpeechLang] = useState<SpeechLanguage>("ja-JP");
  const [recordingTime, setRecordingTime] = useState(0);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [historyType, setHistoryType] = useState<"principles" | "team" | "legacy">("principles");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
  const [activeTeamCode, setActiveTeamCode] = useState<TeamMeetingCode>("china");
  const [recordingStartedAt, setRecordingStartedAt] = useState<string | null>(null);
  const [isPersonalRecording, setIsPersonalRecording] = useState(false);
  const [personalRecordingTime, setPersonalRecordingTime] = useState(0);
  const [personalRecordingStartedAt, setPersonalRecordingStartedAt] = useState<string | null>(null);
  const [personalProcessing, setPersonalProcessing] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [personalMicrophoneIssue, setPersonalMicrophoneIssue] = useState<MicrophoneIssue | null>(null);
  const [teamMicrophoneIssue, setTeamMicrophoneIssue] = useState<MicrophoneIssue | null>(null);
  const [microphonePermissionState, setMicrophonePermissionState] = useState<MicrophonePermissionState>("unknown");
  const [microphoneRetryTarget, setMicrophoneRetryTarget] = useState<RecordingTarget | null>(null);

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

  const saveDailyTeamMeetingMutation = trpc.morningMeeting.saveDailyTeamMeeting.useMutation();
  const retryDailyTeamMeetingProcessingMutation = trpc.morningMeeting.retryDailyTeamMeetingProcessing.useMutation();
  const savePersonalRecitationMutation = trpc.morningMeeting.savePersonalRecitation.useMutation();
  const deleteRecordingMutation = trpc.morningMeeting.deleteRecording.useMutation();

  const { data: historyData, refetch: refetchHistory } = trpc.morningMeeting.getSeparatedHistory.useQuery({
    type: historyType,
    limit: 10,
    offset: page * 10,
    search: searchQuery || undefined,
  });

  const { data: dailyToday, refetch: refetchDailyToday } = trpc.morningMeeting.getTodayDailyRecordings.useQuery({});
  const copy = MORNING_MEETING_COPY[speechLang];
  const culturePrinciples = LCJ_CULTURE_PRINCIPLES[speechLang];
  const activeTeamMeeting = dailyToday?.teamMeetings?.[activeTeamCode] || null;
  const activeParticipantOptions = dailyToday?.participantOptionsByTeam?.[activeTeamCode] || [];
  const selectedMember = dailyToday?.members.find((member) => member.staffId === selectedStaffId)
    || dailyToday?.currentStaff
    || null;
  const selectedTargetStaffId = dailyToday?.canSelectStaff ? selectedMember?.staffId || undefined : undefined;

  useEffect(() => {
    if (!dailyToday) return;
    const availableTeams = dailyToday.availableTeamCodes as readonly TeamMeetingCode[];
    if (!availableTeams.includes(activeTeamCode) && availableTeams.length > 0) {
      setActiveTeamCode(availableTeams[0]);
      return;
    }
    const savedIds = activeTeamMeeting?.participantSnapshot
      ?.map((participant) => participant.staffId)
      .filter((staffId): staffId is number => typeof staffId === "number") || [];
    setSelectedParticipantIds(savedIds.length > 0
      ? savedIds
      : activeParticipantOptions.map((participant) => participant.staffId));
  }, [dailyToday?.date, activeTeamCode, activeTeamMeeting?.id]);

  const changeSpeechLanguage = useCallback((language: SpeechLanguage) => {
    setSpeechLang(language);
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
      recognitionRef.current.stop();
    }
  }, []);

  const captureMicrophoneIssue = useCallback(async (error: unknown, target: RecordingTarget) => {
    const permissionStatus = await getMicrophonePermissionStatus();
    const permissionState: MicrophonePermissionState = permissionStatus?.state || "unsupported";
    const issue = classifyMicrophoneIssue(error, permissionState);
    setMicrophonePermissionState(permissionState);
    if (target === "personal") {
      setPersonalMicrophoneIssue(issue);
    } else {
      setTeamMicrophoneIssue(issue);
    }
    console.warn("[MorningMeeting][Microphone]", {
      target,
      code: issue.diagnosticCode,
      errorName: issue.errorName,
      permissionState,
    });
  }, []);

  useEffect(() => {
    let active = true;
    let permissionStatus: PermissionStatus | null = null;
    const syncPermission = async () => {
      permissionStatus = await getMicrophonePermissionStatus();
      if (!active) return;
      setMicrophonePermissionState(permissionStatus?.state || "unsupported");
      if (!permissionStatus) return;
      permissionStatus.onchange = () => {
        if (!active) return;
        setMicrophonePermissionState(permissionStatus?.state || "unknown");
        if (permissionStatus?.state === "granted") {
          setPersonalMicrophoneIssue(null);
          setTeamMicrophoneIssue(null);
        }
      };
    };
    void syncPermission();
    return () => {
      active = false;
      if (permissionStatus) permissionStatus.onchange = null;
    };
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

  const formatStartTime = (value: string | Date | null | undefined) => {
    if (!value) return "--:--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const startPersonalRecitation = useCallback(async () => {
    if (!selectedMember || selectedMember.principlesCompleted || isRecording) return;
    let requestedStream: MediaStream | null = null;
    try {
      setPersonalError(null);
      setPersonalMicrophoneIssue(null);
      setMicrophoneRetryTarget("personal");
      const stream = await requestMicrophoneStream();
      requestedStream = stream;
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
      setMicrophonePermissionState("granted");
      setPersonalRecordingStartedAt(new Date().toISOString());
      setPersonalRecordingTime(0);
      setIsPersonalRecording(true);
    } catch (err) {
      requestedStream?.getTracks().forEach((track) => track.stop());
      personalStreamRef.current = null;
      await captureMicrophoneIssue(err, "personal");
    } finally {
      setMicrophoneRetryTarget(null);
    }
  }, [selectedMember, isRecording, captureMicrophoneIssue]);

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
            startedAt: personalRecordingStartedAt || undefined,
            targetStaffId: selectedTargetStaffId,
          });
          personalChunksRef.current = [];
          setPersonalRecordingTime(0);
          setPersonalRecordingStartedAt(null);
          await refetchDailyToday();
        } catch (err) {
          setPersonalError(friendlyRecordingError(
            err,
            speechLang,
            speechLang === "zh-CN" ? "个人朗读上传失败，请重试" : "個人朗読の登録に失敗しました。もう一度お試しください",
          ));
        } finally {
          setPersonalProcessing(false);
          personalMediaRecorderRef.current = null;
          resolve();
        }
      };
      recorder.stop();
    });
  }, [personalRecordingTime, refetchDailyToday, refetchHistory, savePersonalRecitationMutation, selectedTargetStaffId, speechLang, personalRecordingStartedAt]);

  const startRecording = useCallback(async () => {
    if (!dailyToday || activeTeamMeeting?.isValid || selectedParticipantIds.length === 0 || isPersonalRecording) return;
    let requestedStream: MediaStream | null = null;
    try {
      setError(null);
      setTeamMicrophoneIssue(null);
      setMicrophoneRetryTarget("team");

      const stream = await requestMicrophoneStream();
      requestedStream = stream;
      streamRef.current = stream;

      // Start MediaRecorder. 停止時に空でない音声だけをDB/S3へ保存する。
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
      setMicrophonePermissionState("granted");
      setRecordingStartedAt(new Date().toISOString());
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
      requestedStream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      await captureMicrophoneIssue(err, "team");
    } finally {
      setMicrophoneRetryTarget(null);
    }
  }, [dailyToday, activeTeamMeeting?.isValid, selectedParticipantIds.length, isPersonalRecording, captureMicrophoneIssue]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    setIsRecording(false);
    setProcessingStep(copy.meetingUploading);

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
            throw new Error(speechLang === "zh-CN" ? "早会录音为空或超过60MB" : "早会録音が空、または60MBを超えています");
          }
          const audioBase64 = await blobToBase64Payload(audioBlob);
          const language = speechLang === "zh-CN" ? "zh" : "ja";

          setProcessingStep(copy.meetingUploading);

          try {
            const result = await saveDailyTeamMeetingMutation.mutateAsync({
              transcript: finalTranscript || undefined,
              durationSeconds: recordingTime,
              language,
              teamCode: activeTeamCode,
              startedAt: recordingStartedAt || undefined,
              audioBase64,
              mimeType,
              participantStaffIds: selectedParticipantIds,
            });

            if (result.success) {
              setProcessingStep(null);
              setLiveTranscript('');
              setInterimText('');
              chunksRef.current = [];
              setRecordingTime(0);
              setRecordingStartedAt(null);
              await Promise.all([refetchDailyToday(), refetchHistory()]);
            } else {
              setError(result.error || (speechLang === "zh-CN" ? "早会录音处理失败" : "早会録音の処理に失敗しました"));
              setProcessingStep(null);
            }
          } catch (err) {
            setError(friendlyRecordingError(
              err,
              speechLang,
              speechLang === "zh-CN" ? "早会录音上传失败，请重试" : "早会録音の登録に失敗しました。もう一度お試しください",
            ));
            setProcessingStep(null);
          }
          resolve();
        } catch (err) {
          setError(friendlyRecordingError(
            err,
            speechLang,
            speechLang === "zh-CN" ? "早会录音处理失败，请重试" : "早会録音の処理に失敗しました。もう一度お試しください",
          ));
          setProcessingStep(null);
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  }, [recordingTime, saveDailyTeamMeetingMutation, refetchDailyToday, refetchHistory, selectedParticipantIds, copy.meetingUploading, speechLang, activeTeamCode, recordingStartedAt]);

  const handleDelete = async (source: "daily" | "meeting", id: number) => {
    const confirmed = confirm(speechLang === "zh-CN"
      ? "确定删除这条录音吗？删除后可重新录制，操作会写入审计记录。"
      : "この録音を削除しますか？削除後は再録音でき、操作は監査記録に残ります。");
    if (!confirmed) return;
    await deleteRecordingMutation.mutateAsync({ source, id, reason: "user-requested-rerecord" });
    await Promise.all([refetchDailyToday(), refetchHistory()]);
    if (selectedMeeting?.id === id) setSelectedMeeting(null);
  };

  const handleRetryTeamMeetingProcessing = async () => {
    if (!activeTeamMeeting || activeTeamMeeting.status !== "failed") return;
    setError(null);
    setProcessingStep(speechLang === "zh-CN" ? "正在使用已保存的原录音重新转写…" : "保存済みの元音声を再文字起こししています…");
    try {
      const result = await retryDailyTeamMeetingProcessingMutation.mutateAsync({ id: activeTeamMeeting.id });
      if (!result.success) {
        setError(result.error || (speechLang === "zh-CN" ? "原录音重新处理失败" : "元音声の再処理に失敗しました"));
      }
      await Promise.all([refetchDailyToday(), refetchHistory()]);
    } catch (err) {
      setError(friendlyRecordingError(
        err,
        speechLang,
        speechLang === "zh-CN" ? "原录音重新处理失败，请稍后再试" : "元音声の再処理に失敗しました。しばらくしてから再度お試しください",
      ));
    } finally {
      setProcessingStep(null);
    }
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
      <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-2">
        {/* Header */}
        <div className="order-1 flex flex-col gap-3 lg:col-span-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{copy.pageTitle}</h1>
            <p className="mt-1 text-sm text-gray-500">{copy.pageSubtitle}</p>
          </div>
          <div data-testid="current-morning-staff" className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{copy.currentStaff}</p>
              <p className="truncate text-lg font-black text-gray-900">{selectedMember?.name || user?.name || user?.email || "-"}</p>
              {selectedMember?.position && <p className="text-xs text-gray-500">{selectedMember.position}</p>}
            </div>
            {dailyToday && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {copy.completionProgress}: {dailyToday.completedBothCount}/{dailyToday.totalCount}
              </Badge>
            )}
          </div>
          {dailyToday?.canSelectStaff && <p className="text-xs font-medium text-blue-700">{copy.tapNameToSelect}</p>}
        </div>

        {/* 全員必須1: 本人別9条朗読録音 */}
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
              <Badge variant="outline" className="whitespace-nowrap">
                {selectedMember?.principlesCompleted
                  ? (speechLang === "zh-CN" ? "完成" : "完了")
                  : copy.pending}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedMember?.principlesCompleted && selectedMember.principles ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <p className="mt-3 font-bold text-green-800">{copy.personalDone}</p>
                <p className="mt-1 text-sm text-green-700">
                  {selectedMember.name} · {speechLang === "zh-CN" ? "开始" : "開始"} {formatStartTime(selectedMember.principles.startedAt || selectedMember.principles.createdAt)} · {formatTime(selectedMember.principles.durationSeconds)}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <DailyRecordingAudioButton recordingId={selectedMember.principles.id} />
                  {selectedMember.principles.canDelete && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete("daily", selectedMember.principles!.id)}
                      disabled={deleteRecordingMutation.isPending}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {speechLang === "zh-CN" ? "删除并重新录制" : "削除して再録音"}
                    </Button>
                  )}
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
                  data-testid="personal-record-button"
                  onClick={startPersonalRecitation}
                  aria-label={copy.personalStart}
                  disabled={!selectedMember || isRecording || microphoneRetryTarget === "personal"}
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {microphoneRetryTarget === "personal"
                    ? <Loader2 className="h-9 w-9 animate-spin" />
                    : <Mic className="h-9 w-9" />}
                </button>
                <p className="mt-3 font-semibold text-gray-700">{copy.personalStart}</p>
              </div>
            )}

            {personalMicrophoneIssue && (
              <MicrophoneRecoveryAlert
                issue={personalMicrophoneIssue}
                language={speechLang}
                permissionState={microphonePermissionState}
                retrying={microphoneRetryTarget === "personal"}
                onRetry={() => void startPersonalRecitation()}
                onDismiss={() => setPersonalMicrophoneIssue(null)}
              />
            )}

            {personalError && (
              <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-none" />
                <span>{personalError}</span>
                <button type="button" onClick={() => setPersonalError(null)} className="ml-auto">×</button>
              </div>
            )}

            {dailyToday && dailyToday.members.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border bg-white/80 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {dailyToday.members.map((member, index) => {
                    const selected = member.targetKey === selectedMember?.targetKey;
                    return (
                      <button
                        type="button"
                        key={`${member.targetKey}-${index}`}
                        onClick={() => dailyToday.canSelectStaff && !isPersonalRecording && !isRecording && !personalProcessing && !processingStep && setSelectedStaffId(member.staffId || null)}
                        disabled={!dailyToday.canSelectStaff || isPersonalRecording || isRecording || personalProcessing || Boolean(processingStep)}
                        aria-pressed={selected}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${selected ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-transparent bg-gray-50 hover:border-blue-200"} disabled:cursor-default`}
                      >
                        {member.allCompleted ? <CheckCircle2 className="h-4 w-4 flex-none text-green-600" /> : <Clock className="h-4 w-4 flex-none text-gray-400" />}
                        <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{member.name}</span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className={member.principlesCompleted ? "text-green-700" : "text-gray-400"}>9条{member.principlesCompleted ? "✓" : "○"}</span>
                          <span className={member.attendedTeamMeeting ? "text-green-700" : "text-gray-400"}>{speechLang === "zh-CN" ? "早会参加" : "朝会参加"}{member.attendedTeamMeeting ? "✓" : "○"}</span>
                        </span>
                      </button>
                    );
                  })}
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

        {/* 1日1回: 参加者を選んでチーム早会を共同録音 */}
        <Card className="order-2 border-2 border-dashed border-red-100 bg-gradient-to-br from-white to-red-50/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-red-100 p-2.5 text-red-700">
                  <UsersRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{copy.teamTitle}</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">{copy.teamDescription}</p>
                </div>
              </div>
              <Badge variant="outline" className="whitespace-nowrap border-red-200 text-red-700">
                {speechLang === "zh-CN" ? "中国 / 日本分别记录" : "中国 / 日本を別々に記録"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              {(["china", "japan"] as const).map((teamCode) => {
                const meeting = dailyToday?.teamMeetings?.[teamCode] || null;
                const available = Boolean(dailyToday?.availableTeamCodes?.includes(teamCode));
                const valid = Boolean(meeting?.isValid);
                const statusText = valid
                  ? (speechLang === "zh-CN" ? "完成" : "完了")
                  : meeting?.status === "failed"
                    ? (speechLang === "zh-CN" ? "处理失败 / 可重新处理" : "処理失敗 / 再処理可能")
                    : meeting
                      ? (speechLang === "zh-CN" ? "处理中" : "処理中")
                      : copy.pending;
                return (
                  <button
                    key={teamCode}
                    type="button"
                    disabled={!available || isRecording || Boolean(processingStep)}
                    onClick={() => setActiveTeamCode(teamCode)}
                    className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${activeTeamCode === teamCode ? "border-red-400 bg-red-50 shadow-sm" : "border-gray-200 bg-white hover:border-red-200"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-gray-900">{TEAM_MEETING_META[teamCode].flag} {speechLang === "zh-CN" ? TEAM_MEETING_META[teamCode].zh : TEAM_MEETING_META[teamCode].ja}</span>
                      <Badge variant={valid ? "default" : meeting?.status === "failed" ? "destructive" : "secondary"}>{statusText}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                      {meeting
                        ? `${speechLang === "zh-CN" ? "开始" : "開始"} ${formatStartTime(meeting.startedAt || meeting.createdAt)} · ${formatTime(meeting.durationSeconds || 0)} · ${meeting.participantCount}${speechLang === "zh-CN" ? "人" : "名"}`
                        : available
                          ? (speechLang === "zh-CN" ? "点击选择后开始本团队早会" : "選択してチーム朝会を開始")
                          : (speechLang === "zh-CN" ? "仅管理员或本团队员工可开启" : "管理者または所属チームのみ開始可能")}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col items-center space-y-6">
              {activeTeamMeeting?.isValid && !isRecording && !processingStep && (
                <div className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                  <p className="mt-3 font-bold text-green-800">{copy.meetingDone}</p>
                  <p className="mt-1 text-sm text-green-700">
                    {speechLang === "zh-CN" ? TEAM_MEETING_META[activeTeamCode].zh : TEAM_MEETING_META[activeTeamCode].ja} · {speechLang === "zh-CN" ? "开始" : "開始"} {formatStartTime(activeTeamMeeting.startedAt || activeTeamMeeting.createdAt)} · {formatTime(activeTeamMeeting.durationSeconds || 0)} · {activeTeamMeeting.participantCount}{speechLang === "zh-CN" ? "人参加" : "名参加"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <AudioPlayButton meetingId={activeTeamMeeting.id} />
                    {activeTeamMeeting.canDelete && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete("meeting", activeTeamMeeting.id)}
                        disabled={deleteRecordingMutation.isPending}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        {speechLang === "zh-CN" ? "删除并重新录制" : "削除して再録音"}
                      </Button>
                    )}
                  </div>
                  <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
                    {activeTeamMeeting.participantSnapshot?.map((participant) => (
                      <Badge key={participant.targetKey} variant="outline" className="border-green-200 bg-white text-green-800">
                        {participant.name}{participant.position ? ` · ${participant.position}` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {activeTeamMeeting?.status === "failed" && !isRecording && !processingStep && (
                <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-amber-900">
                        {speechLang === "zh-CN" ? "原录音已保存，无需立即重录" : "元音声は保存済みです。すぐに再録音する必要はありません"}
                      </p>
                      <p className="mt-1 break-words text-sm text-amber-800">
                        {activeTeamMeeting.errorMessage || (speechLang === "zh-CN" ? "语音处理失败，可使用原录音重试。" : "音声処理に失敗しました。元音声から再処理できます。")}
                      </p>
                    </div>
                    {activeTeamMeeting.canDelete && (
                      <Button
                        type="button"
                        className="shrink-0 bg-amber-700 text-white hover:bg-amber-800"
                        onClick={handleRetryTeamMeetingProcessing}
                        disabled={retryDailyTeamMeetingProcessingMutation.isPending}
                      >
                        {retryDailyTeamMeetingProcessingMutation.isPending
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <Languages className="mr-2 h-4 w-4" />}
                        {speechLang === "zh-CN" ? "使用原录音重新处理" : "元音声から再処理"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* 参加者選択 + 1日1回のRecording Button */}
              {dailyToday && !activeTeamMeeting?.isValid && !isRecording && !processingStep && (
                <>
                  <div className="w-full rounded-2xl border border-red-100 bg-white/90 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-800">{copy.selectParticipants}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-red-200 text-red-700">
                          {copy.selectedParticipants}: {selectedParticipantIds.length}{speechLang === "zh-CN" ? "人" : "名"}
                        </Badge>
                        <button type="button" onClick={() => setSelectedParticipantIds(activeParticipantOptions.map((participant) => participant.staffId))} className="text-xs font-semibold text-red-600 hover:text-red-800">{copy.selectAllParticipants}</button>
                        <button type="button" onClick={() => setSelectedParticipantIds([])} className="text-xs font-semibold text-gray-500 hover:text-gray-800">{copy.clearParticipants}</button>
                      </div>
                    </div>
                    <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
                      {activeParticipantOptions.map((participant) => {
                        const selected = selectedParticipantIds.includes(participant.staffId);
                        return (
                          <button
                            key={participant.staffId}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setSelectedParticipantIds((current) => selected ? current.filter((id) => id !== participant.staffId) : [...current, participant.staffId])}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${selected ? "border-red-300 bg-red-50 text-red-900" : "border-gray-200 bg-gray-50 text-gray-600"}`}
                          >
                            {selected ? <CheckCircle2 className="h-4 w-4 flex-none text-red-600" /> : <Clock className="h-4 w-4 flex-none text-gray-400" />}
                            <span className="min-w-0 flex-1 truncate font-medium">{participant.name}</span>
                            {participant.position && <span className="text-[10px] text-gray-500">{participant.position}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    data-testid="team-record-button"
                    onClick={startRecording}
                    aria-label={`${TEAM_MEETING_META[activeTeamCode].flag} ${copy.tapToStart}`}
                    disabled={selectedParticipantIds.length === 0 || isPersonalRecording || personalProcessing || microphoneRetryTarget === "team"}
                    className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {microphoneRetryTarget === "team"
                      ? <Loader2 className="h-9 w-9 animate-spin" />
                      : <Mic className="w-9 h-9" />}
                  </button>
                  <p className="text-gray-600 font-medium">{TEAM_MEETING_META[activeTeamCode].flag} {speechLang === "zh-CN" ? TEAM_MEETING_META[activeTeamCode].zh : TEAM_MEETING_META[activeTeamCode].ja} · {copy.tapToStart}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" aria-pressed={speechLang === "ja-JP"} onClick={() => changeSpeechLanguage("ja-JP")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.97] ${speechLang === "ja-JP" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>🇯🇵 日本語</button>
                    <button type="button" aria-pressed={speechLang === "zh-CN"} onClick={() => changeSpeechLanguage("zh-CN")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.97] ${speechLang === "zh-CN" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>🇨🇳 中文</button>
                  </div>
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
                    <p className="text-sm text-gray-500 mt-1">{TEAM_MEETING_META[activeTeamCode].flag} {speechLang === "zh-CN" ? TEAM_MEETING_META[activeTeamCode].zh : TEAM_MEETING_META[activeTeamCode].ja} · {copy.recording}</p>
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

              {teamMicrophoneIssue && (
                <MicrophoneRecoveryAlert
                  issue={teamMicrophoneIssue}
                  language={speechLang}
                  permissionState={microphonePermissionState}
                  retrying={microphoneRetryTarget === "team"}
                  onRetry={() => void startRecording()}
                  onDismiss={() => setTeamMicrophoneIssue(null)}
                />
              )}

              {/* Error */}
              {error && (
                <div role="alert" className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                  <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">×</button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 選択中チームの本日早会結果 */}
        {activeTeamMeeting?.isValid && activeTeamMeeting.summary && (
          <Card className="order-4 lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                {TEAM_MEETING_META[activeTeamCode].flag} {speechLang === "zh-CN" ? `${TEAM_MEETING_META[activeTeamCode].zh}今天的早会总结` : `${TEAM_MEETING_META[activeTeamCode].ja}本日の朝会サマリー`}
                <Badge variant="secondary" className="ml-auto">
                  {speechLang === "zh-CN" ? "开始" : "開始"} {formatStartTime(activeTeamMeeting.startedAt || activeTeamMeeting.createdAt)} · {formatTime(activeTeamMeeting.durationSeconds || 0)} · {activeTeamMeeting.participantCount}{speechLang === "zh-CN" ? "人" : "名"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingSummaryView summary={activeTeamMeeting.summary as MeetingSummary} language={speechLang} />
            </CardContent>
            {activeTeamMeeting.transcript && (
              <CardContent className="pt-0">
                <details className="group">
                  <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800 font-medium flex items-center gap-1">
                    📝 {speechLang === "zh-CN" ? "原始转写内容（点击展开）" : "文字起こし原文（クリックして展開）"}
                  </summary>
                  <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border rounded-lg p-4 max-h-96 overflow-y-auto leading-relaxed">
                    {activeTeamMeeting.transcript}
                  </div>
                </details>
              </CardContent>
            )}
          </Card>
        )}

        {/* History Section */}
        <Card className="order-5 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={speechLang === "zh-CN" ? "历史记录分类" : "履歴種別"}>
                {([
                  ["principles", copy.historyPrinciples],
                  ["team", copy.historyTeam],
                  ["legacy", copy.historyLegacy],
                ] as const).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={historyType === type}
                    onClick={() => { setHistoryType(type); setPage(0); setSelectedMeeting(null); }}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${historyType === type ? "bg-slate-900 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder={speechLang === "zh-CN" ? "按姓名、日期或内容搜索" : "氏名・日付・内容を検索"}
                  value={searchQuery}
                  onChange={(event) => { setSearchQuery(event.target.value); setPage(0); }}
                  className="pl-9 w-full lg:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {historyData?.records && historyData.records.length > 0 ? (
              <div className="space-y-3">
                {historyData.records.map((rawRecord) => {
                  const record = rawRecord as any;
                  const selectedKey = `${historyType}-${record.audioSource}-${record.id}`;
                  const expanded = selectedMeeting?.historyKey === selectedKey;
                  const isMeetingRecord = record.audioSource === "meeting";
                  return (
                    <div key={selectedKey} className={`rounded-xl border p-4 transition-colors ${expanded ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            {historyType === "principles" ? <UserRound className="h-5 w-5" /> : <UsersRound className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900">{record.name || record.createdByName || (speechLang === "zh-CN" ? "未知" : "不明")}</p>
                            <p className="text-xs text-gray-500">{record.date}{record.position ? ` · ${record.position}` : ""}{record.operatorUserName ? ` · ${speechLang === "zh-CN" ? "登记" : "登録"}: ${record.operatorUserName}` : ""}</p>
                          </div>
                          {historyType === "team" && record.teamCode !== "legacy" && <Badge variant="outline">{TEAM_MEETING_META[record.teamCode as TeamMeetingCode]?.flag} {speechLang === "zh-CN" ? TEAM_MEETING_META[record.teamCode as TeamMeetingCode]?.zh : TEAM_MEETING_META[record.teamCode as TeamMeetingCode]?.ja}</Badge>}
                          {historyType === "legacy" && <Badge variant="outline">{record.historyKind === "legacy_personal" ? (speechLang === "zh-CN" ? "旧个人早会" : "旧本人別朝会") : (speechLang === "zh-CN" ? "旧团队早会" : "旧共有朝会")}</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {(record.startedAt || record.createdAt) && <span className="flex items-center gap-1 text-sm text-gray-500"><Calendar className="h-3 w-3" />{formatStartTime(record.startedAt || record.createdAt)}</span>}
                          {record.durationSeconds != null && <span className="flex items-center gap-1 text-sm text-gray-500"><Clock className="h-3 w-3" />{formatTime(record.durationSeconds)}</span>}
                          {record.participantCount > 0 && <span className="flex items-center gap-1 text-sm text-gray-500"><Users className="h-3 w-3" />{record.participantCount}{speechLang === "zh-CN" ? "人" : "名"}</span>}
                          <Badge variant={record.status === "failed" ? "destructive" : record.status === "completed" ? "default" : "secondary"}>{record.status === "completed" ? (speechLang === "zh-CN" ? "完成" : "完了") : record.status === "failed" ? (speechLang === "zh-CN" ? "错误" : "エラー") : (speechLang === "zh-CN" ? "处理中" : "処理中")}</Badge>
                          {record.status === "completed" && (record.audioKey || historyType === "principles" || record.historyKind === "legacy_personal") && (isMeetingRecord ? <AudioPlayButton meetingId={record.id} /> : <DailyRecordingAudioButton recordingId={record.id} compact />)}
                          {isMeetingRecord && record.status === "completed" && <button type="button" onClick={() => exportMeetingMinutes(record)} className="text-gray-400 hover:text-blue-600" title={speechLang === "zh-CN" ? "导出会议纪要" : "議事録を出力"}><Download className="h-4 w-4" /></button>}
                          {(record.summary || record.transcript || record.participantSnapshot) && <button type="button" onClick={() => setSelectedMeeting(expanded ? null : { ...record, historyKey: selectedKey })} className="text-gray-400 hover:text-blue-600">{expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</button>}
                          {record.canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(record.audioSource === "meeting" ? "meeting" : "daily", record.id)}
                              disabled={deleteRecordingMutation.isPending}
                              className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                              title={speechLang === "zh-CN" ? "删除录音并允许重新录制" : "録音を削除して再録音を許可"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {expanded && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          {Array.isArray(record.participantSnapshot) && record.participantSnapshot.length > 0 && (
                            <div className="flex flex-wrap gap-2">{record.participantSnapshot.map((participant: any) => <Badge key={participant.targetKey} variant="outline">{participant.name}{participant.position ? ` · ${participant.position}` : ""}</Badge>)}</div>
                          )}
                          {record.summary && <MeetingSummaryView summary={record.summary as MeetingSummary} language={speechLang} />}
                          {record.transcript && <div><p className="mb-2 text-sm font-bold text-gray-700">📝 {speechLang === "zh-CN" ? "原始转写内容" : "文字起こし原文"}</p><div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-gray-50 p-4 text-sm leading-relaxed text-gray-600">{record.transcript}</div></div>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {historyData.total > 10 && (
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-gray-500">{speechLang === "zh-CN" ? "共" : "全"}{historyData.total}{speechLang === "zh-CN" ? "条" : "件中"} {page * 10 + 1}-{Math.min((page + 1) * 10, historyData.total)}</span>
                    <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => setPage((value) => value + 1)} disabled={(page + 1) * 10 >= historyData.total}><ChevronRight className="h-4 w-4" /></Button></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400"><Mic className="mx-auto mb-3 h-12 w-12 opacity-50" /><p>{speechLang === "zh-CN" ? "暂无记录" : "まだ記録がありません"}</p></div>
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
function DailyRecordingAudioButton({ recordingId, compact = false }: { recordingId: number; compact?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlQuery = trpc.morningMeeting.getDailyRecordingAudioUrl.useQuery(
    { id: recordingId },
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
      title={isPlaying ? "停止" : "本人別録音を再生"}
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
