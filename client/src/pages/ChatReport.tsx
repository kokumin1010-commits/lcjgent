import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DAILY_REPORT_REQUIRED_ANSWER_COUNT } from "../../../shared/dailyReportConversation";


import { ArrowLeft, Send, Bot, User, CheckCircle, Loader2, MessageSquare, Mic, Square, History, Plus, Calendar, ChevronRight } from "lucide-react";

const translations = {
  ja: {
    title: "チャットで日報を作成",
    selectStaff: "スタッフを選択",
    startChat: "チャットを開始",
    placeholder: "メッセージを入力...",
    send: "送信",
    convertToReport: "日報として保存",
    converting: "変換中...",
    converted: "日報を作成しました",
    back: "戻る",
    noStaff: "スタッフが登録されていません",
    sessionInProgress: "本日のチャットを継続中",
    newSession: "新しいチャットを開始",
    aiThinking: "AIが考え中...",
    todayDate: "今日の日報",
    recording: "録音中...",
    transcribing: "音声を変換中...",
    voiceInputError: "音声入力に失敗しました",
    micPermissionDenied: "マイクの使用が許可されていません",
    startRecording: "音声入力を開始",
    stopRecording: "録音を停止",
    chatHistory: "チャット履歴",
    newChat: "新規チャット",
    viewHistory: "履歴を見る",
    noHistory: "チャット履歴がありません",
    status: {
      in_progress: "進行中",
      completed: "完了",
      converted: "日報作成済み",
    },
    messages: "件のメッセージ",
  },
  zh: {
    title: "通过聊天创建日报",
    selectStaff: "选择员工",
    startChat: "开始聊天",
    placeholder: "输入消息...",
    send: "发送",
    convertToReport: "保存为日报",
    converting: "转换中...",
    converted: "已创建日报",
    back: "返回",
    noStaff: "没有注册的员工",
    sessionInProgress: "继续今天的聊天",
    newSession: "开始新聊天",
    aiThinking: "AI正在思考...",
    todayDate: "今天的日报",
    recording: "录音中...",
    transcribing: "正在转换语音...",
    voiceInputError: "语音输入失败",
    micPermissionDenied: "未授权使用麦克风",
    startRecording: "开始语音输入",
    stopRecording: "停止录音",
    chatHistory: "聊天历史",
    newChat: "新建聊天",
    viewHistory: "查看历史",
    noHistory: "没有聊天历史",
    status: {
      in_progress: "进行中",
      completed: "已完成",
      converted: "已创建日报",
    },
    messages: "条消息",
  },
};

interface Message {
  id: number;
  role: "ai" | "user";
  content: string;
  messageType?: string | null;
  createdAt?: Date;
}

interface ChatSession {
  id: number;
  staffId: number;
  reportDate: Date;
  status: "in_progress" | "completed" | "converted";
  convertedReportId?: number | null;
  createdAt: Date;
}

interface SavedReport {
  id: number;
  reportDate: Date | string;
  workContent: string;
  issues?: string | null;
  remarks?: string | null;
}

// Helper function to clean AI response from thinking process (client-side)
const cleanAiResponse = (text: string): string => {
  let cleaned = text;
  
  // Remove character count patterns
  cleaned = cleaned.replace(/\s*\(\d+\s*characters?\)/gi, "");
  
  // Remove numbered thinking steps with headers
  cleaned = cleaned.replace(/\d+\.\s*\*\*[^*]+\*\*:?[^\n]*\n?/g, "");
  
  // Remove markdown headers like **Review and Finalize:** or **Final Output Generation:**
  cleaned = cleaned.replace(/\*\*[^*]+\*\*:?\s*/g, "");
  
  // Remove lines starting with thinking process indicators
  cleaned = cleaned.replace(/^(Review|Finalize|Output|Generation|Self-correction|Meets|criteria)[^\n]*\n?/gim, "");
  
  // Remove parenthetical notes like (Self-correction: ...)
  cleaned = cleaned.replace(/\([^)]*Self-correction[^)]*\)/gi, "");
  cleaned = cleaned.replace(/\([^)]*criteria[^)]*\)/gi, "");
  
  // Clean up multiple newlines and trim
  cleaned = cleaned.replace(/\n{2,}/g, "\n").trim();
  
  // If the cleaned result is too short, try to extract just the question
  if (cleaned.length < 5) {
    const questionMatch = text.match(/[^\.!\?\n]+[\?？]/g);
    if (questionMatch && questionMatch.length > 0) {
      cleaned = questionMatch[questionMatch.length - 1].trim();
    }
  }
  
  return cleaned;
};

export default function ChatReport({ embedded = false }: { embedded?: boolean } = {}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const reportLanguage = language === "zh" ? "zh" : "ja";
  const t = translations[reportLanguage];
  
  
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isConverted, setIsConverted] = useState(false);
  const [savedReport, setSavedReport] = useState<SavedReport | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingHistorySession, setViewingHistorySession] = useState<number | null>(null);
  
  // Voice input states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoStartedStaffRef = useRef<number | null>(null);
  
  const { data: reportVisibility } = trpc.report.visibility.useQuery();
  const { data: staffList } = trpc.reportStaff.listActive.useQuery();
  const writableStaffList = useMemo(
    () =>
      reportVisibility?.canViewAllReports
        ? (staffList || [])
        : (staffList || []).filter(staff =>
            (reportVisibility?.ownReportStaffIds || []).includes(staff.id)
          ),
    [reportVisibility, staffList]
  );

  useEffect(() => {
    if (!selectedStaffId && writableStaffList.length === 1) {
      setSelectedStaffId(writableStaffList[0].id);
    }
  }, [selectedStaffId, writableStaffList]);
  
  // Get chat history for selected staff
  const { data: chatHistory, refetch: refetchHistory } = trpc.chatReport.getSessionsByStaff.useQuery(
    { staffId: selectedStaffId!, limit: 30 },
    { enabled: !!selectedStaffId && showHistory }
  );
  
  // Mutations
  const startSessionMutation = trpc.chatReport.startSession.useMutation();
  const sendMessageMutation = trpc.chatReport.sendMessage.useMutation();
  const convertToReportMutation = trpc.chatReport.convertToReport.useMutation();
  const transcribeVoiceMutation = trpc.chatReport.transcribeVoice.useMutation();
  
  // Get messages for a specific session (for viewing history)
  const { data: historyMessages, isLoading: isLoadingHistory } = trpc.chatReport.getMessages.useQuery(
    { sessionId: viewingHistorySession! },
    { enabled: !!viewingHistorySession }
  );
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Focus input after AI response
  useEffect(() => {
    if (!isLoading && !isSending && !isRecording && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isSending, isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);
  
  const handleStartSession = async () => {
    if (!selectedStaffId) return;
    
    setIsLoading(true);
    setShowHistory(false);
    setViewingHistorySession(null);
    try {
      const result = await startSessionMutation.mutateAsync({ staffId: selectedStaffId });
      setSessionId(result.session.id);
      setIsConverted(result.session.status === "converted");
      setSavedReport(((result as any).report as SavedReport | null) || null);
      // Clean AI responses when loading messages
      setMessages(result.messages.map((m: any) => ({
        id: m.id,
        role: m.role as "ai" | "user",
        content: m.role === "ai" ? cleanAiResponse(m.content) : m.content,
        messageType: m.messageType,
        createdAt: m.createdAt,
      })));
      
      if (!result.isNew) {
        // Session in progress notification
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      toast.error(error instanceof Error ? error.message : "无法开始日报对话");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (
      embedded &&
      selectedStaffId &&
      writableStaffList.length === 1 &&
      !sessionId &&
      !isLoading &&
      autoStartedStaffRef.current !== selectedStaffId
    ) {
      autoStartedStaffRef.current = selectedStaffId;
      void handleStartSession();
    }
  }, [embedded, selectedStaffId, writableStaffList.length, sessionId, isLoading]);
  
  const handleViewHistory = () => {
    setShowHistory(true);
    refetchHistory();
  };
  
  const handleSelectHistorySession = (session: ChatSession) => {
    setViewingHistorySession(session.id);
  };
  
  const handleBackFromHistory = () => {
    setViewingHistorySession(null);
  };
  
  const handleBackToStaffSelection = () => {
    setShowHistory(false);
    setViewingHistorySession(null);
    setSessionId(null);
    setMessages([]);
    setIsConverted(false);
    setSavedReport(null);
  };
  
  const handleSendMessage = async () => {
    if (!sessionId || !inputValue.trim() || isSending) return;
    
    const userMessage = inputValue.trim();
    setInputValue("");
    setIsSending(true);
    
    // Optimistically add user message
    const tempUserMessage: Message = {
      id: Date.now(),
      role: "user",
      content: userMessage,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, tempUserMessage]);
    
    try {
      const result = await sendMessageMutation.mutateAsync({
        sessionId,
        content: userMessage,
      });
      
      // Update with actual messages (clean AI response)
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMessage.id);
        return [
          ...filtered,
          {
            id: result.userMessage.id,
            role: "user" as const,
            content: result.userMessage.content,
            messageType: result.userMessage.messageType,
            createdAt: result.userMessage.createdAt,
          },
          {
            id: result.aiMessage.id,
            role: "ai" as const,
            content: cleanAiResponse(result.aiMessage.content),
            messageType: result.aiMessage.messageType,
            createdAt: result.aiMessage.createdAt,
          },
        ];
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      toast.error(error instanceof Error ? error.message : "发送失败");
    } finally {
      setIsSending(false);
    }
  };
  
  const handleConvertToReport = async () => {
    if (!sessionId || isConverting) return;
    
    setIsConverting(true);
    try {
      const result = await convertToReportMutation.mutateAsync({ sessionId });
      if (result.success) {
        setIsConverted(true);
        setSavedReport((result.report as SavedReport | null) || null);
        toast.success(t.converted);
      }
    } catch (error) {
      console.error("Failed to convert to report:", error);
      toast.error(error instanceof Error ? error.message : "日报保存失败");
    } finally {
      setIsConverting(false);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Voice input functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        // Process audio
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType 
        });
        
        if (audioBlob.size > 0) {
          await processAudio(audioBlob);
        }
        
        setRecordingTime(0);
      };
      
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert(t.micPermissionDenied);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    
    try {
      // Upload audio to S3
      const fileName = `voice-${Date.now()}.webm`;
      
      // Use fetch to upload directly
      const formData = new FormData();
      formData.append('file', audioBlob, fileName);
      
      // Upload to storage using the API
      const uploadResponse = await fetch('/api/upload-voice', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload audio');
      }
      
      const { url: audioUrl } = await uploadResponse.json();
      
      // Get staff's country to determine language
      const selectedStaff = staffList?.find(s => s.id === selectedStaffId);
      const lang = selectedStaff?.country === "中国" ? "zh" : "ja";
      
      // Transcribe the audio
      const result = await transcribeVoiceMutation.mutateAsync({
        audioUrl,
        language: lang,
      });
      
      if (result.text) {
        setInputValue(prev => prev + (prev ? " " : "") + result.text);
      }
    } catch (error) {
      console.error("Failed to transcribe audio:", error);
      alert(t.voiceInputError);
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatDate = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    };
    return now.toLocaleDateString(language === "ja" ? "ja-JP" : "zh-CN", options);
  };
  
  const formatSessionDate = (date: Date) => {
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    };
    return d.toLocaleDateString(language === "ja" ? "ja-JP" : "zh-CN", options);
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "converted":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  if (!user) {
    return null;
  }
  
  // Viewing history session detail
  if (viewingHistorySession && historyMessages) {
    const currentSession = chatHistory?.find(s => s.id === viewingHistorySession);
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="container py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackFromHistory}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {t.chatHistory}
              </h1>
              {currentSession && (
                <p className="text-sm text-muted-foreground">
                  {formatSessionDate(currentSession.reportDate)}
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="container py-6 max-w-2xl mx-auto">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {historyMessages.map((message: any) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === "ai"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "ai" ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "ai"
                        ? "bg-muted text-foreground rounded-tl-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">
                      {message.role === "ai" ? cleanAiResponse(message.content) : message.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Show history list
  if (showHistory && selectedStaffId) {
    const selectedStaff = staffList?.find(s => s.id === selectedStaffId);
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="container py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToStaffSelection}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {t.chatHistory}
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedStaff?.name}
              </p>
            </div>
            <Button onClick={handleStartSession} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {t.newChat}
            </Button>
          </div>
        </div>
        
        <div className="container py-6 max-w-2xl mx-auto">
          {!chatHistory || chatHistory.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t.noHistory}</p>
                <Button className="mt-4" onClick={handleStartSession} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {t.newChat}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {chatHistory.map((session: ChatSession) => (
                <Card 
                  key={session.id} 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleSelectHistorySession(session)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{formatSessionDate(session.reportDate)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(session.status)}`}>
                              {t.status[session.status as keyof typeof t.status]}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className={embedded ? "h-full overflow-y-auto rounded-2xl border border-violet-400/20 bg-white/[0.04] text-foreground" : "min-h-screen bg-background"}>
      {/* Header */}
      {!embedded && <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/master/reports")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                {t.title}
              </h1>
              <p className="text-sm text-muted-foreground">{formatDate()}</p>
            </div>
          </div>
        </div>
      </div>}

      {embedded && (
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <MessageSquare className="h-5 w-5 text-violet-300" />
            {reportLanguage === "zh" ? "和LCJ Brain对话写日报" : "LCJ Brainと会話して日報を書く"}
          </h2>
          <p className="mt-1 text-xs text-white/55">
            {reportLanguage === "zh"
              ? "Brain会依次询问今日工作、问题与明日优先事项，确认后写入正式日报。"
              : "本日の業務・課題・明日の優先事項を順番に確認し、確認後に正式な日報へ保存します。"}
          </p>
        </div>
      )}
      
      <div className={embedded ? "mx-auto max-w-2xl p-4" : "container py-6 max-w-2xl mx-auto"}>
        {!sessionId ? (
          /* Staff Selection */
          <Card>
            <CardHeader>
              <CardTitle>{t.selectStaff}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {writableStaffList.length > 0 ? (
                <>
                  <Select
                    value={selectedStaffId?.toString() || ""}
                    onValueChange={(value) => setSelectedStaffId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectStaff} />
                    </SelectTrigger>
                    <SelectContent>
                      {writableStaffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id.toString()}>
                          {staff.name} {staff.country && `(${staff.country})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={handleStartSession}
                      disabled={!selectedStaffId || isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <MessageSquare className="h-4 w-4 mr-2" />
                      )}
                      {t.startChat}
                    </Button>
                    
                    {!embedded && <Button
                      variant="outline"
                      onClick={handleViewHistory}
                      disabled={!selectedStaffId}
                    >
                      <History className="h-4 w-4 mr-2" />
                      {t.viewHistory}
                    </Button>}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">{t.noStaff}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Chat Interface */
          <div className={`flex flex-col ${embedded ? "h-[calc(100dvh-330px)] min-h-[520px]" : "h-[calc(100vh-200px)]"}`}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === "ai"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "ai" ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "ai"
                        ? "bg-muted text-foreground rounded-tl-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              
              {/* AI Thinking Indicator */}
              {isSending && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.aiThinking}
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <div className="border-t pt-4 space-y-3">
              {isConverted && savedReport && (
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="h-4 w-4" />
                        {reportLanguage === "zh" ? "已保存到正式日报" : "正式な日報に保存しました"}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/master/reports/edit/${savedReport.id}`)}>
                        {reportLanguage === "zh" ? "查看/编辑日报" : "日報を確認・編集"}
                      </Button>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{reportLanguage === "zh" ? "今日已完成工作" : "本日完了した業務"}</p>
                        <p className="mt-1 whitespace-pre-wrap">{savedReport.workContent}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{reportLanguage === "zh" ? "问题 / 待跟进" : "課題・フォローアップ"}</p>
                        <p className="mt-1 whitespace-pre-wrap">{savedReport.issues || (reportLanguage === "zh" ? "无" : "なし")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{reportLanguage === "zh" ? "明日优先工作" : "明日の優先業務"}</p>
                        <p className="mt-1 whitespace-pre-wrap">{savedReport.remarks || (reportLanguage === "zh" ? "无" : "なし")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Convert Button */}
              {messages.filter(m => m.role === "user").length >= DAILY_REPORT_REQUIRED_ANSWER_COUNT && !isConverted && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleConvertToReport}
                  disabled={isConverting || isSending}
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t.converting}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t.convertToReport}
                    </>
                  )}
                </Button>
              )}

              {/* Recording Status */}
              {isRecording && (
                <div className="flex items-center justify-center gap-2 py-2 text-red-500">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">{t.recording} {formatRecordingTime(recordingTime)}</span>
                </div>
              )}

              {/* Transcribing Status */}
              {isTranscribing && (
                <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t.transcribing}</span>
                </div>
              )}
              
              {/* Message Input */}
              {!isConverted && (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t.placeholder}
                    disabled={isSending || isRecording || isTranscribing}
                    className="flex-1"
                  />
                  
                  {/* Voice Input Button */}
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="icon"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isSending || isTranscribing}
                    title={isRecording ? t.stopRecording : t.startRecording}
                  >
                    {isRecording ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {/* Send Button */}
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSending || isRecording || isTranscribing}
                    size="icon"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
