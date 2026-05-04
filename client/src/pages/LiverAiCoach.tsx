import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Send,
  Sparkles,
  Loader2,
  Zap,
  Menu,
  Plus,
  MessageSquare,
  Trash2,
  X,
  Pencil,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export default function LiverAiCoach() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const isAutoMode = urlParams.get('auto') === '1';
  const contextType = urlParams.get('context') || null; // 'suggestion', 'post_stream', 'weekly', 'monthly'
  const contextFrom = urlParams.get('from') || null;
  const contextTo = urlParams.get('to') || null;
  const contextLivestreamId = urlParams.get('livestreamId') ? Number(urlParams.get('livestreamId')) : null;
  const contextMonth = urlParams.get('month') || null;
  const [contextInitialized, setContextInitialized] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [autoModeWaiting, setAutoModeWaiting] = useState(isAutoMode);
  const autoModePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get liver info
  const { data: liverInfo, isLoading: isLoadingLiver } = trpc.liver.me.useQuery(undefined, {
    retry: false,
  });

  // Get rooms
  const { data: rooms, refetch: refetchRooms } = trpc.liverManagement.aiCoach.getRooms.useQuery(
    { liverId: liverInfo?.id || 0 },
    { enabled: !!liverInfo?.id }
  );

  // Auto-select first room or create default
  useEffect(() => {
    if (rooms && rooms.length > 0 && activeRoomId === null) {
      setActiveRoomId(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  // Get chat messages for active room
  const { data: chatData, isLoading: isLoadingMessages, refetch: refetchMessages } =
    trpc.liverManagement.aiCoach.getMessages.useQuery(
      { liverId: liverInfo?.id || 0, roomId: activeRoomId || undefined, limit: 50 },
      { enabled: !!liverInfo?.id && !!activeRoomId, refetchInterval: 10000 }
    );

  // Mutations
  const sendMessageMutation = trpc.liverManagement.aiCoach.sendMessage.useMutation({
    onSuccess: () => {
      refetchMessages();
      refetchRooms();
      setIsSending(false);
      setMessageInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: () => {
      toast.error("メッセージの送信に失敗しました");
      setIsSending(false);
    },
  });

  const createRoomMutation = trpc.liverManagement.aiCoach.createRoom.useMutation({
    onSuccess: (room) => {
      refetchRooms();
      setActiveRoomId(room.id);
      setSidebarOpen(false);
      // Create welcome message for new room
      if (liverInfo?.id) {
        welcomeMutation.mutate({ liverId: liverInfo.id, roomId: room.id });
      }
    },
  });

  const updateRoomTitleMutation = trpc.liverManagement.aiCoach.updateRoomTitle.useMutation({
    onSuccess: () => {
      refetchRooms();
      setEditingRoomId(null);
    },
  });

  const deleteRoomMutation = trpc.liverManagement.aiCoach.deleteRoom.useMutation({
    onSuccess: () => {
      refetchRooms();
      if (rooms && rooms.length > 1) {
        const remaining = rooms.filter(r => r.id !== activeRoomId);
        if (remaining.length > 0) setActiveRoomId(remaining[0].id);
      } else {
        setActiveRoomId(null);
      }
    },
  });

  const welcomeMutation = trpc.liverManagement.aiCoach.getOrCreateWelcome.useMutation({
    onSuccess: () => {
      refetchMessages();
    },
  });

  // Create welcome message on first visit (for rooms with no messages) - skip in auto mode
  useEffect(() => {
    if (liverInfo?.id && activeRoomId && chatData && chatData.messages.length === 0 && !isAutoMode) {
      welcomeMutation.mutate({ liverId: liverInfo.id, roomId: activeRoomId });
    }
  }, [liverInfo?.id, activeRoomId, chatData?.messages.length, isAutoMode]);

  // Auto mode: poll for AI-generated message after livestream save
  useEffect(() => {
    if (!autoModeWaiting || !activeRoomId || !liverInfo?.id) return;
    
    // Start polling every 2 seconds to check for new AI message
    const pollInterval = setInterval(() => {
      refetchMessages();
    }, 2000);
    autoModePollingRef.current = pollInterval;
    
    // Stop polling after 15 seconds max
    const timeout = setTimeout(() => {
      setAutoModeWaiting(false);
      if (autoModePollingRef.current) {
        clearInterval(autoModePollingRef.current);
        autoModePollingRef.current = null;
      }
    }, 15000);
    
    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [autoModeWaiting, activeRoomId, liverInfo?.id]);

  // Auto mode: stop waiting once we detect an AI message (auto_question type)
  useEffect(() => {
    if (autoModeWaiting && chatData && chatData.messages.length > 0) {
      const lastMsg = chatData.messages[chatData.messages.length - 1];
      if (lastMsg.role === 'ai') {
        setAutoModeWaiting(false);
        if (autoModePollingRef.current) {
          clearInterval(autoModePollingRef.current);
          autoModePollingRef.current = null;
        }
      }
    }
  }, [autoModeWaiting, chatData?.messages]);

  // Context-aware initialization from URL parameters (e.g., from LINE report links)
  useEffect(() => {
    if (!contextType || !liverInfo?.id || !activeRoomId || contextInitialized || isSending) return;
    
    // Only trigger once when room is ready and has no messages yet (or for new context)
    let contextMessage = '';
    switch (contextType) {
      case 'suggestion':
        contextMessage = '今日の配信提案について相談したいです。具体的にどう進めればいいですか？';
        break;
      case 'post_stream':
        contextMessage = contextLivestreamId 
          ? `さっきの配信（ID:${contextLivestreamId}）の結果について詳しく分析してほしいです。改善点を教えてください。`
          : 'さっきの配信結果について詳しく分析してほしいです。改善点を教えてください。';
        break;
      case 'weekly':
        contextMessage = contextFrom && contextTo
          ? `${contextFrom}〜${contextTo}の週間レポートについて相談したいです。来週どうすればもっと売上を伸ばせますか？`
          : '今週の配信レポートについて相談したいです。来週どうすればもっと売上を伸ばせますか？';
        break;
      case 'monthly':
        contextMessage = contextMonth
          ? `${contextMonth}の月間レポートについて相談したいです。来月の目標と戦略を一緒に考えてほしいです。`
          : '先月の月間レポートについて相談したいです。来月の目標と戦略を一緒に考えてほしいです。';
        break;
      default:
        return;
    }
    
    if (contextMessage) {
      setContextInitialized(true);
      setIsSending(true);
      sendMessageMutation.mutate({
        liverId: liverInfo.id,
        roomId: activeRoomId,
        message: contextMessage,
        contextType: contextType,
        contextId: contextLivestreamId || undefined,
      });
    }
  }, [contextType, liverInfo?.id, activeRoomId, contextInitialized, isSending]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData?.messages]);

  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim() || !liverInfo?.id || isSending || !activeRoomId) return;
    setIsSending(true);
    sendMessageMutation.mutate({
      liverId: liverInfo.id,
      roomId: activeRoomId,
      message: messageInput.trim(),
      contextType: contextType || undefined,
      contextId: contextLivestreamId || undefined,
    });
  }, [messageInput, liverInfo?.id, isSending, activeRoomId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateRoom = () => {
    if (!liverInfo?.id) return;
    createRoomMutation.mutate({ liverId: liverInfo.id });
  };

  const handleDeleteRoom = (roomId: number) => {
    if (rooms && rooms.length <= 1) {
      toast.error("最後のルームは削除できません");
      return;
    }
    deleteRoomMutation.mutate({ roomId });
  };

  const handleSaveTitle = (roomId: number) => {
    if (!editingTitle.trim()) return;
    updateRoomTitleMutation.mutate({ roomId, title: editingTitle.trim() });
  };

  // Loading state
  if (isLoadingLiver) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!liverInfo) {
    navigate("/liver/login");
    return null;
  }

  const messages = chatData?.messages || [];
  const activeRoom = rooms?.find(r => r.id === activeRoomId);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-lg mx-auto relative">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-gray-900 z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col border-r border-gray-800`}
        style={{ maxWidth: "calc(100vw - 60px)" }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">トークルーム</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-white"
              onClick={handleCreateRoom}
              disabled={createRoomMutation.isPending}
            >
              {createRoomMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto py-2">
          {rooms && rooms.length > 0 ? (
            rooms.map((room) => (
              <div
                key={room.id}
                className={`group flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors ${
                  room.id === activeRoomId
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                }`}
                onClick={() => {
                  if (editingRoomId !== room.id) {
                    setActiveRoomId(room.id);
                    setSidebarOpen(false);
                  }
                }}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                {editingRoomId === room.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTitle(room.id);
                        if (e.key === "Escape") setEditingRoomId(null);
                      }}
                      className="flex-1 bg-gray-700 text-white text-xs rounded px-2 py-1 outline-none border border-gray-600 focus:border-yellow-500"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveTitle(room.id);
                      }}
                      className="text-green-400 hover:text-green-300"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-xs truncate">{room.title}</span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRoomId(room.id);
                          setEditingTitle(room.title);
                        }}
                        className="p-1 text-gray-500 hover:text-gray-300 rounded"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoom(room.id);
                        }}
                        className="p-1 text-gray-500 hover:text-red-400 rounded"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500 text-xs">
              ルームがありません
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-3 border-t border-gray-800">
          <Button
            onClick={handleCreateRoom}
            disabled={createRoomMutation.isPending}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-xs h-9"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            新しい会話を始める
          </Button>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:text-white h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white flex items-center gap-1">
                {activeRoom?.title || "LCJ 神コーチ"}
                <Sparkles className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
              </h1>
              <p className="text-[10px] text-gray-400">あなた専属のAIコーチ</p>
            </div>
          </div>

          <Link href="/liver/mypage">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoadingMessages || autoModeWaiting ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Zap className="h-8 w-8 text-white" />
              </div>
              {autoModeWaiting ? (
                <>
                  <p className="text-yellow-400 text-sm font-bold mb-1">配信お疲れさまでした！</p>
                  <p className="text-gray-400 text-xs">神コーチがあなたの配信データを分析中...</p>
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-400 mx-auto mt-3" />
                </>
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-gray-500 mx-auto" />
              )}
            </div>
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
            disabled={isSending || !activeRoomId}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending || !activeRoomId}
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
