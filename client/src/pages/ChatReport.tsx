import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { ArrowLeft, Send, Bot, User, CheckCircle, Loader2, MessageSquare, Mic, MicOff, Square } from "lucide-react";

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
  },
};

interface Message {
  id: number;
  role: "ai" | "user";
  content: string;
  messageType?: string | null;
  createdAt?: Date;
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

export default function ChatReport() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  
  
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isConverted, setIsConverted] = useState(false);
  
  // Voice input states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get report staff list
  const { data: staffList } = trpc.reportStaff.list.useQuery();
  
  // Mutations
  const startSessionMutation = trpc.chatReport.startSession.useMutation();
  const sendMessageMutation = trpc.chatReport.sendMessage.useMutation();
  const convertToReportMutation = trpc.chatReport.convertToReport.useMutation();
  const transcribeVoiceMutation = trpc.chatReport.transcribeVoice.useMutation();
  
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
    try {
      const result = await startSessionMutation.mutateAsync({ staffId: selectedStaffId });
      setSessionId(result.session.id);
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
      console.error("Failed to start chat session");
    } finally {
      setIsLoading(false);
    }
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
      console.error("Failed to send message");
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
        // Report converted notification
        // Navigate to reports page after a short delay
        setTimeout(() => {
          navigate("/reports");
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to convert to report:", error);
      console.error("Failed to convert to report");
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
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
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
      
      // Transcribe the audio
      const result = await transcribeVoiceMutation.mutateAsync({
        audioUrl,
        language: language === "zh" ? "zh" : "ja",
      });
      
      if (result.text) {
        // Set the transcribed text to input
        setInputValue(prev => prev + (prev ? " " : "") + result.text);
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Failed to process audio:", error);
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
  
  // Format date
  const formatDate = () => {
    const today = new Date();
    return today.toLocaleDateString(language === "ja" ? "ja-JP" : "zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
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
      </div>
      
      <div className="container py-6 max-w-2xl mx-auto">
        {!sessionId ? (
          /* Staff Selection */
          <Card>
            <CardHeader>
              <CardTitle>{t.selectStaff}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {staffList && staffList.length > 0 ? (
                <>
                  <Select
                    value={selectedStaffId?.toString() || ""}
                    onValueChange={(value) => setSelectedStaffId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectStaff} />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id.toString()}>
                          {staff.name} {staff.country && `(${staff.country})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
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
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">{t.noStaff}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Chat Interface */
          <div className="flex flex-col h-[calc(100vh-200px)]">
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
              {/* Convert Button */}
              {messages.filter(m => m.role === "user").length >= 2 && !isConverted && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleConvertToReport}
                  disabled={isConverting}
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t.converting}
                    </>
                  ) : isConverted ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      {t.converted}
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
