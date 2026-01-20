import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ArrowLeft, Send, Bot, User, CheckCircle, Loader2, MessageSquare } from "lucide-react";

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
  },
};

interface Message {
  id: number;
  role: "ai" | "user";
  content: string;
  messageType?: string | null;
  createdAt?: Date;
}

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get report staff list
  const { data: staffList } = trpc.reportStaff.list.useQuery();
  
  // Mutations
  const startSessionMutation = trpc.chatReport.startSession.useMutation();
  const sendMessageMutation = trpc.chatReport.sendMessage.useMutation();
  const convertToReportMutation = trpc.chatReport.convertToReport.useMutation();
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Focus input after AI response
  useEffect(() => {
    if (!isLoading && !isSending && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isSending]);
  
  const handleStartSession = async () => {
    if (!selectedStaffId) return;
    
    setIsLoading(true);
    try {
      const result = await startSessionMutation.mutateAsync({ staffId: selectedStaffId });
      setSessionId(result.session.id);
      setMessages(result.messages.map((m: any) => ({
        id: m.id,
        role: m.role as "ai" | "user",
        content: m.content,
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
      
      // Update with actual messages
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
            content: result.aiMessage.content,
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
              
              {/* Message Input */}
              {!isConverted && (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t.placeholder}
                    disabled={isSending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSending}
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
