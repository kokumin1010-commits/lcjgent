import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Send,
  Sparkles,
  Loader2,
  Bot,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export default function LiverAiCoach() {
  const [, navigate] = useLocation();
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get liver info
  const { data: liverInfo, isLoading: isLoadingLiver } = trpc.liver.me.useQuery(undefined, {
    retry: false,
  });

  // Get chat messages
  const { data: chatData, isLoading: isLoadingMessages, refetch: refetchMessages } = 
    trpc.liverManagement.aiCoach.getMessages.useQuery(
      { liverId: liverInfo?.id || 0, limit: 50 },
      { enabled: !!liverInfo?.id, refetchInterval: 10000 }
    );

  // Send message mutation
  const sendMessageMutation = trpc.liverManagement.aiCoach.sendMessage.useMutation({
    onSuccess: () => {
      refetchMessages();
      setIsSending(false);
      setMessageInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: (err) => {
      toast.error("メッセージの送信に失敗しました");
      setIsSending(false);
    },
  });

  // Welcome message mutation
  const welcomeMutation = trpc.liverManagement.aiCoach.getOrCreateWelcome.useMutation({
    onSuccess: () => {
      refetchMessages();
    },
  });

  // Create welcome message on first visit
  useEffect(() => {
    if (liverInfo?.id && chatData && chatData.messages.length === 0) {
      welcomeMutation.mutate({ liverId: liverInfo.id });
    }
  }, [liverInfo?.id, chatData?.messages.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData?.messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !liverInfo?.id || isSending) return;
    setIsSending(true);
    sendMessageMutation.mutate({
      liverId: liverInfo.id,
      message: messageInput.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Loading state
  if (isLoadingLiver) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  // Not logged in
  if (!liverInfo) {
    navigate("/liver/login");
    return null;
  }

  const messages = chatData?.messages || [];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/liver/mypage">
            <Button variant="ghost" size="icon" className="text-white hover:text-white h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-1">
                LCJ 神コーチ
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              </h1>
              <p className="text-[10px] text-gray-400">あなた専属のAIコーチ</p>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <p className="text-gray-400 text-sm">LCJ 神コーチと話してみましょう</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              {msg.role === "ai" ? (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
              ) : (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-blue-600 text-white text-xs">
                    {liverInfo.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-gray-800 text-gray-100 rounded-bl-md"
                }`}
              >
                {msg.role === "ai" && msg.messageType === "auto_question" && (
                  <div className="flex items-center gap-1 text-yellow-400 text-[10px] font-medium mb-1">
                    <Sparkles className="h-3 w-3" />
                    配信フィードバック
                  </div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div className={`text-[10px] mt-1 ${msg.role === "user" ? "text-blue-200" : "text-gray-500"}`}>
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleString("ja-JP", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) : ""}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isSending && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              "今月の売上を分析して",
              "時間単価を上げるには？",
              "おすすめのセット構成は？",
              "配信時間帯のアドバイス",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setMessageInput(suggestion);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                className="flex-shrink-0 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full px-3 py-1.5 border border-gray-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Input
            ref={inputRef}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="神コーチに相談する..."
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 rounded-full px-4"
            disabled={isSending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending}
            size="icon"
            className="rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white h-10 w-10 flex-shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
