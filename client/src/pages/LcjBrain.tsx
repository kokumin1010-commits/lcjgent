import { useState, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";
import { useAuth } from "../_core/hooks/useAuth";
import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";
import { 
  Brain, Send, Sparkles, MessageCircle, Target, BookOpen, 
  Zap, Users, TrendingUp, FileText, Mic, StopCircle,
  ChevronRight, BarChart3, Lightbulb, Shield, GraduationCap,
  ClipboardList, Star, AlertTriangle, CheckCircle2, ArrowRight,
  History, Search, MicOff, Volume2, Plus, Trash2, MessageSquare, PanelLeftClose, PanelLeft,
  Upload, FolderOpen, Calendar, Tag, Eye, X, Loader2, Database, ExternalLink, CheckCircle, XCircle, Copy, Check
} from "lucide-react";

// ============================================================
// タブ定義
// ============================================================
type TabType = "chat" | "diagnosis" | "training" | "scripts" | "product_score" | "logs" | "knowledge" | "data_sources";

// ============================================================
// 音声入力フック（共通化）
// ============================================================
function useVoiceInput(onTranscript: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("您的浏览器不支持语音输入，请使用Chrome或Safari");
      return;
    }

    try {
      // 获取麦克风权限并设置音量分析
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 开始音量监测动画
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(1, avg / 128));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      // 如果获取麦克风失败，继续使用Speech API（不显示波形）
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP"; // 日本語優先（中国語ユーザーはブラウザ設定で変更可能）
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      onTranscript(finalTranscript + interim);
    };

    recognition.onend = () => {
      // 如果还在录音状态，自动重启（防止超时断开）
      if (recognitionRef.current && isRecording) {
        try { recognition.start(); } catch (e) { /* ignore */ }
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.error("Speech recognition error:", e.error);
      }
    };

    recognitionRef.current = recognition;
    setIsRecording(true);
    setRecordingTime(0);
    recognition.start();

    // 计时器
    timerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // 防止自动重启
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
    setAudioLevel(0);
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) { recognitionRef.current.stop(); }
      if (timerRef.current) { clearInterval(timerRef.current); }
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
      if (audioContextRef.current) { audioContextRef.current.close(); }
    };
  }, []);

  return { isRecording, recordingTime, audioLevel, startRecording, stopRecording };
}

// 格式化录音时间
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function LcjBrain() {
  // URLパラメータからタブを取得
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const tabFromUrl = params.get("tab") as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl || "chat");

  // タブ変更時にURLパラメータを更新
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  const tabs = [
    { id: "chat" as TabType, label: "AI对话", icon: MessageCircle },
    { id: "knowledge" as TabType, label: "知识库", icon: FileText },
    { id: "diagnosis" as TabType, label: "品牌问诊", icon: ClipboardList },
    { id: "training" as TabType, label: "BD训练", icon: GraduationCap },
    { id: "scripts" as TabType, label: "话术生成", icon: BookOpen },
    { id: "product_score" as TabType, label: "产品评分", icon: Star },
    { id: "logs" as TabType, label: "聊天记录", icon: History },
    { id: "data_sources" as TabType, label: "参考LCJページ", icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">LCJ Brain</h1>
              <p className="text-xs text-white/40">全自动BD引擎 · 连接LCJ所有数据</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - モバイル対応: コンパクト + 横スクロール */}
      <div className="border-b border-white/10 bg-black/10 overflow-x-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-2 md:px-4">
          <div className="flex gap-0.5 md:gap-1 py-1.5 md:py-2 min-w-max">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "chat" && <ChatPanel />}
        {activeTab === "knowledge" && <KnowledgePanel />}
        {activeTab === "diagnosis" && <DiagnosisPanel />}
        {activeTab === "training" && <TrainingPanel />}
        {activeTab === "scripts" && <ScriptsPanel />}
        {activeTab === "product_score" && <ProductScorePanel />}
        {activeTab === "logs" && <ChatLogsPanel />}
        {activeTab === "data_sources" && <DataSourcesPanel />}
      </div>
    </div>
  );
}

// ============================================================
// AI対話パネル（升級版：後続質問ボタン + 語音入力強化）
// ============================================================
function ChatPanel() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; fileUrl?: string; fileName?: string; suggestedQuestions?: string[]; knowledgeSources?: Array<{id: number; title: string; meetingDate: string | null}> }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{ type: 'image' | 'document' | 'file'; url?: string; textContent?: string; fileName: string; mimeType: string; previewUrl?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const chatMutation = trpc.lcjBrain.chat.useMutation();
  const deleteConversation = trpc.lcjBrain.deleteConversation.useMutation();
  
  // 会話一覧を取得
  const { data: conversations, refetch: refetchConversations } = trpc.lcjBrain.getMyConversations.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  // 選択中の会話のメッセージを取得
  const { data: conversationMessages } = trpc.lcjBrain.getConversationMessages.useQuery(
    { conversationId: activeConversationId! },
    { enabled: !!activeConversationId }
  );
  
  // 会話メッセージが読み込まれたらmessagesに反映
  useEffect(() => {
    if (conversationMessages && activeConversationId) {
      const msgs = conversationMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content || "",
        suggestedQuestions: m.suggestedQuestions ? JSON.parse(m.suggestedQuestions) : undefined,
      }));
      setMessages(msgs);
    }
  }, [conversationMessages, activeConversationId]);

  const voice = useVoiceInput((text) => setInput(text));

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  
  // 新しい会話を開始
  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
  };
  
  // 会話を選択
  const selectConversation = (id: number) => {
    setActiveConversationId(id);
  };
  
  // 会話を削除
  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("この会話を削除しますか？")) return;
    await deleteConversation.mutateAsync({ conversationId: id });
    if (activeConversationId === id) {
      startNewConversation();
    }
    refetchConversations();
  };

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      alert("ファイルサイズは100MB以下にしてください");
      return;
    }
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/chat-file-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'アップロード失敗');
      }
      
      const data = await response.json();
      
      // Create preview for images
      let previewUrl: string | undefined;
      if (data.type === 'image') {
        previewUrl = URL.createObjectURL(file);
      }
      
      setAttachedFile({
        type: data.type,
        url: data.url,
        textContent: data.textContent,
        fileName: data.fileName,
        mimeType: data.mimeType,
        previewUrl,
      });
    } catch (error: any) {
      alert(error.message || 'ファイルアップロードに失敗しました');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if ((!msg && !attachedFile) || isLoading) return;
    
    // 如果正在录音，先停止
    if (voice.isRecording) voice.stopRecording();
    
    const currentFile = attachedFile;
    setInput("");
    setAttachedFile(null);
    
    // Display message with file indicator
    const displayContent = currentFile 
      ? `${msg || '请分析这个文件'}`
      : msg;
    setMessages(prev => [...prev, { 
      role: "user", 
      content: displayContent,
      ...(currentFile ? { fileUrl: currentFile.url, fileName: currentFile.fileName } : {}),
    }]);
    setIsLoading(true);

    try {
      const mutationParams: any = { 
        message: msg || `请分析这个文件: ${currentFile?.fileName}`,
        conversationId: activeConversationId || undefined,
      };
      
      // Attach file data
      if (currentFile?.type === 'image' && currentFile.url) {
        mutationParams.imageUrl = currentFile.url;
      } else if (currentFile?.type === 'document' && currentFile.textContent) {
        mutationParams.fileContent = currentFile.textContent;
        mutationParams.fileName = currentFile.fileName;
      }
      
      const result = await chatMutation.mutateAsync(mutationParams);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: result.response,
        suggestedQuestions: result.suggestedQuestions || [],
        knowledgeSources: result.knowledgeSources || [],
      }]);
      // 新しい会話が作成された場合、IDを保存
      if (result.conversationId && !activeConversationId) {
        setActiveConversationId(result.conversationId);
      }
      refetchConversations();
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `错误: ${error.message}` }]);
    } finally {
      setIsLoading(false);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const quickQuestions = [
    "现在有哪些品牌在合作？",
    "本月直播GMV是多少？",
    "哪个主播业绩最好？",
    "MYTREX项目进度怎么样？",
    "客户说太贵了怎么回？",
    "新品牌第一次接触应该怎么做？",
  ];

  return (
    <div className="flex h-[calc(100dvh-180px)] md:h-[calc(100vh-200px)] relative">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar - 会話履歴 */}
      <div className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-200 overflow-hidden border-r border-white/10 flex-shrink-0 md:relative fixed md:static top-0 left-0 md:z-0 z-30 h-full bg-[#1a1a2e]`}>
        <div className="w-64 h-full flex flex-col">
          {/* モバイル: サイドバー閉じるボタン + 新しい会話 */}
          <div className="flex items-center gap-2 m-2">
            <button
              onClick={startNewConversation}
              className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 hover:text-white transition-all text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              新しい会話
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
              title="サイドバーを閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* 会話リスト */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                  activeConversationId === conv.id
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
            {(!conversations || conversations.length === 0) && (
              <p className="text-xs text-white/30 text-center py-4">まだ会話がありません</p>
            )}
          </div>
          
          {/* ユーザー情報 */}
          {user && (
            <div className="p-3 border-t border-white/10">
              <p className="text-xs text-white/40 truncate">👤 {user.name || user.email}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* サイドバートグル */}
        <div className="flex items-center gap-2 px-2 py-1 border-b border-white/5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-all"
            title={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
          {activeConversationId && (
            <span className="text-xs text-white/30">
              {conversations?.find(c => c.id === activeConversationId)?.title}
            </span>
          )}
        </div>
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 px-4 md:px-4 px-2">
          {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mb-4 border border-violet-500/20">
              <Brain className="w-8 h-8 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">LCJ Brain 已就绪</h2>
            <p className="text-sm text-white/50 mb-6 max-w-md">
              我连接了LCJ的所有数据：品牌、主播、直播实绩、合同、短视频等。<br/>
              基于实际数据回答，不会编造信息。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-2xl">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-left px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`relative group max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-white/5 border border-white/10 text-white/90"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_pre]:bg-white/5 [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-xs">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.fileUrl && msg.fileName && (
                      <a 
                        href={msg.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        download={msg.fileName}
                        className="mt-2 flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors cursor-pointer no-underline"
                      >
                        <svg className="w-4 h-4 text-emerald-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span className="text-xs text-emerald-200 truncate">{msg.fileName}</span>
                      </a>
                    )}
                  </div>
                )}
                {msg.role === "assistant" && msg.content && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex justify-end">
                    <button
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        try {
                          await navigator.clipboard.writeText(msg.content);
                        } catch {
                          const ta = document.createElement('textarea'); ta.value = msg.content; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                        }
                        btn.classList.add('!text-emerald-400');
                        const span = btn.querySelector('span');
                        if (span) span.textContent = 'コピーしました';
                        setTimeout(() => { btn.classList.remove('!text-emerald-400'); if (span) span.textContent = '一键复制'; }, 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/60 hover:text-white/90 text-xs transition-all active:scale-95"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>一键复制</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* 後続質問ボタン */}
            {msg.role === "assistant" && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 ml-2">
                {msg.suggestedQuestions.map((q, qi) => (
                  <button
                    key={qi}
                    onClick={() => sendMessage(q)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 transition-all disabled:opacity-50"
                  >
                    <ChevronRight className="w-3 h-3" />
                    {q}
                  </button>
                ))}
              </div>
            )}
            {/* 知識庫参照リンク */}
            {msg.role === "assistant" && msg.knowledgeSources && msg.knowledgeSources.length > 0 && (
              <div className="mt-2 ml-2 pt-2 border-t border-white/10">
                <p className="text-xs text-white/50 mb-1">📚 参照元知識庫:</p>
                {msg.knowledgeSources.map((src) => (
                  <a
                    key={src.id}
                    href={`/master/lcj-brain?tab=knowledge&id=${src.id}`}
                    className="text-xs text-emerald-400 hover:underline block mb-0.5"
                  >
                    📄 {src.title} {src.meetingDate && `(${src.meetingDate})`}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-white/50">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs">正在分析数据...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - 升級版 */}
      <div className="border-t border-white/10 pt-4">
        {/* 录音状态面板 */}
        {voice.isRecording && (
          <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  {/* 波形环 */}
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping"
                    style={{ opacity: voice.audioLevel * 0.6 }}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-300">正在录音</p>
                  <p className="text-xs text-red-400/60">{formatTime(voice.recordingTime)}</p>
                </div>
              </div>
              {/* 音量指示器 */}
              <div className="flex items-end gap-0.5 h-6">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-400 rounded-full transition-all duration-75"
                    style={{ 
                      height: `${Math.max(4, voice.audioLevel * 24 * (0.5 + Math.random() * 0.5))}px`,
                      opacity: voice.audioLevel > 0.1 ? 0.8 : 0.3,
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => { voice.stopRecording(); }}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-400 rounded-lg text-xs text-white font-medium transition-all"
              >
                停止
              </button>
            </div>
            {input && (
              <div className="mt-2 pt-2 border-t border-red-500/20">
                <p className="text-xs text-white/60">识别中：</p>
                <p className="text-sm text-white/90 mt-0.5">{input}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {/* 語音入力ボタン - 大きく目立つ */}
          <button
            onClick={voice.isRecording ? voice.stopRecording : voice.startRecording}
            className={`relative px-4 py-3 rounded-xl transition-all ${
              voice.isRecording
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : "bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 text-violet-300 hover:from-violet-600/30 hover:to-indigo-600/30 hover:text-violet-200 hover:shadow-lg hover:shadow-violet-500/10"
            }`}
            title={voice.isRecording ? "停止录音" : "语音输入（点击开始说话）"}
          >
            {voice.isRecording ? (
              <StopCircle className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
            {/* 录音中的脉冲环 */}
            {voice.isRecording && (
              <span className="absolute inset-0 rounded-xl border-2 border-red-400 animate-ping opacity-30" />
            )}
          </button>

          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3 py-3 rounded-xl transition-all bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 text-emerald-300 hover:from-emerald-600/30 hover:to-teal-600/30 hover:text-emerald-200 disabled:opacity-50"
            title="上传文件（图片/Excel/PDF/CSV/文本）"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.md,.json,.csv,.xlsx,.xls,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Textarea (auto-resize, multiline) */}
          <div className="flex-1 relative">
            {/* Attached file preview */}
            {attachedFile && (
              <div className="mb-2 p-2 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
                {attachedFile.type === 'image' && attachedFile.previewUrl && (
                  <img src={attachedFile.previewUrl} alt="preview" className="w-10 h-10 rounded object-cover" />
                )}
                {attachedFile.type === 'document' && (
                  <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                )}
                <span className="text-xs text-white/70 truncate flex-1">{attachedFile.fileName}</span>
                <button
                  onClick={() => {
                    if (attachedFile.previewUrl) URL.revokeObjectURL(attachedFile.previewUrl);
                    setAttachedFile(null);
                  }}
                  className="text-white/40 hover:text-white/80 p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.startsWith('image/')) {
                    e.preventDefault();
                    const file = items[i].getAsFile();
                    if (!file) return;
                    // Validate file size (10MB max)
                    if (file.size > 10 * 1024 * 1024) {
                      alert('画像サイズは10MB以下にしてください');
                      return;
                    }
                    setIsUploading(true);
                    const formData = new FormData();
                    formData.append('file', file);
                    fetch('/api/chat-file-upload', {
                      method: 'POST',
                      body: formData,
                      credentials: 'include',
                    })
                      .then(res => res.json())
                      .then(data => {
                        if (data.error) throw new Error(data.error);
                        const previewUrl = URL.createObjectURL(file);
                        setAttachedFile({
                          type: 'image',
                          url: data.url,
                          fileName: data.fileName || 'pasted-image.png',
                          mimeType: file.type,
                          previewUrl,
                        });
                      })
                      .catch(err => alert(err.message || '画像アップロードに失敗しました'))
                      .finally(() => setIsUploading(false));
                    break;
                  }
                }
              }}
              placeholder={voice.isRecording ? "正在听你说话..." : "问任何关于LCJ的问题...（Shift+Enter换行）"}
              rows={1}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 resize-none overflow-hidden min-h-[40px] md:min-h-[48px] max-h-[200px]"
              style={{ height: 'auto' }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !attachedFile) || isLoading}
            className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 rounded-xl text-white transition-all self-end"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* 提示文字 */}
        {!voice.isRecording && (
          <p className="text-xs text-white/20 mt-2 text-center">
            🎤 语音输入 · 📎 图片/文件分析 · Shift+Enter 换行
          </p>
        )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 聊天記録管理パネル（管理者用）
// ============================================================
function ChatLogsPanel() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [page, setPage] = useState(1);
  const [submittedPassword, setSubmittedPassword] = useState("");

  const logsQuery = trpc.lcjBrain.getChatLogs.useQuery({ 
    page, 
    limit: 50,
    search: searchQuery || undefined,
    password: submittedPassword || undefined,
    filterUser: filterUser || undefined,
  }, {
    enabled: !!submittedPassword,
  });

  // 認証状態を確認
  useEffect(() => {
    if (logsQuery.data?.authenticated) {
      setIsAuthenticated(true);
    }
  }, [logsQuery.data?.authenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedPassword(password);
  };

  // パスワード入力画面
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-6 border border-amber-500/20">
          <Shield className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">聊天记录管理</h2>
        <p className="text-sm text-white/50 mb-6">管理者密码を入力してください</p>
        <form onSubmit={handleLogin} className="flex gap-2 w-full max-w-xs">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
          >
            确认
          </button>
        </form>
        {submittedPassword && !logsQuery.data?.authenticated && !logsQuery.isLoading && (
          <p className="text-xs text-red-400 mt-3">密码错误，请重试</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-violet-400" />
          聊天记录管理
        </h2>
        <p className="text-xs text-white/40">
          总计 {logsQuery.data?.total || 0} 条记录
        </p>
      </div>

      {/* フィルタ + 検索 */}
      <div className="flex gap-2 flex-wrap">
        {/* ユーザーフィルタ */}
        <select
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 min-w-[140px]"
        >
          <option value="" className="bg-slate-900">全员表示</option>
          {logsQuery.data?.users?.map((user: string) => (
            <option key={user} value={user} className="bg-slate-900">{user}</option>
          ))}
        </select>
        {/* 検索 */}
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="搜索聊天内容..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      {/* ログ一覧 */}
      <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
        {logsQuery.data?.logs?.map((log: any, i: number) => (
          <div
            key={log.id || i}
            className={`p-3 rounded-xl border ${
              log.role === "user"
                ? "bg-violet-500/5 border-violet-500/20"
                : "bg-white/5 border-white/10"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${
                log.role === "user" ? "text-violet-300" : "text-emerald-300"
              }`}>
                {log.role === "user" ? "👤" : "🤖"}
                <span className="ml-1 font-bold">{log.userName || (log.role === "user" ? "未知用户" : "AI")}</span>
              </span>
              <span className="text-xs text-white/30">
                {log.createdAt ? new Date(log.createdAt).toLocaleString("zh-CN") : ""}
              </span>
            </div>
            <p className="text-sm text-white/80 line-clamp-3">{log.content}</p>
            {log.context && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-white/5 text-xs text-white/40">
                {log.context}
              </span>
            )}
          </div>
        ))}

        {(!logsQuery.data?.logs || logsQuery.data.logs.length === 0) && (
          <div className="text-center py-12 text-white/30">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无聊天记录</p>
          </div>
        )}
      </div>

      {/* ページネーション */}
      {(logsQuery.data?.total || 0) > 50 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            上一页
          </button>
          <span className="text-xs text-white/40">第 {page} 页</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(logsQuery.data?.total || 0) <= page * 50}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 品牌問診パネル
// ============================================================
function DiagnosisPanel() {
  const [step, setStep] = useState(0);
  const [brandName, setBrandName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const diagnoseMutation = trpc.lcjBrain.diagnose.useMutation();

  const questions = [
    { key: "hasTikTokShop", question: "有没有TikTok日区店铺？", options: ["有", "没有", "正在申请中"] },
    { key: "entityType", question: "是日本主体还是中国主体？", options: ["日本主体", "中国主体", "两者都有"] },
    { key: "hasJapanStock", question: "有没有日本库存？", options: ["有（日本仓）", "没有（需从中国发）", "少量测试库存"] },
    { key: "currentMarkets", question: "产品目前在哪些市场销售？", options: ["仅中国", "中国+东南亚", "已有日本渠道", "全球多市场"], freeText: true },
    { key: "chinaSales", question: "中国市场月销量大概多少？", options: ["月销100万以下", "月销100-500万", "月销500万-2000万", "月销2000万以上"], freeText: true },
    { key: "marginSpace", question: "毛利空间大概多少？", options: ["30%以下", "30-50%", "50-70%", "70%以上"] },
    { key: "canSupportCommission", question: "能不能支持达人佣金（15-30%）？", options: ["可以", "需要商量", "目前不行"] },
    { key: "acceptTest", question: "是否接受先小规模测试再放大？", options: ["接受", "希望直接大规模", "看测试方案"] },
    { key: "mainGoal", question: "目前最想解决的是什么？", options: ["品牌曝光", "直接销售", "渠道进入", "全部都要"], freeText: true },
    { key: "hasLiveExperience", question: "有没有直播/达人合作经验？", options: ["有丰富经验", "有一些经验", "完全没有"] },
    { key: "productCategory", question: "产品类别是什么？", options: ["美妆护肤", "健康保健", "3C数码", "食品饮料", "家居日用", "服饰配件"], freeText: true },
    { key: "priceRange", question: "产品价格区间（日元）？", options: ["1000円以下", "1000-3000円", "3000-10000円", "10000円以上"], freeText: true },
  ];

  const handleAnswer = (key: string, value: string) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const submitDiagnosis = async () => {
    if (!brandName.trim()) return;
    setIsLoading(true);
    try {
      const result = await diagnoseMutation.mutateAsync({
        brandName: brandName.trim(),
        answers,
      });
      setDiagnosis(result);
    } catch (error: any) {
      alert(`诊断失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (diagnosis) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">📋 {brandName} 诊断报告</h2>
          <button onClick={() => { setDiagnosis(null); setStep(0); setAnswers({}); setBrandName(""); }} className="text-xs text-violet-400 hover:text-violet-300">重新诊断</button>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          {diagnosis.diagnosis ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-xs text-white/50">阶段</p>
                  <p className="text-sm font-medium text-emerald-400">{diagnosis.diagnosis.stage}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-xs text-white/50">风险</p>
                  <p className="text-sm font-medium text-orange-400">{diagnosis.diagnosis.riskLevel}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-xs text-white/50">推荐模式</p>
                  <p className="text-sm font-medium text-violet-400">{diagnosis.diagnosis.recommendedModel}</p>
                </div>
              </div>
              {diagnosis.diagnosis.summary && (
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-xs text-white/50 mb-1">总结</p>
                  <p className="text-sm text-white/80">{diagnosis.diagnosis.summary}</p>
                </div>
              )}
              {diagnosis.diagnosis.strengths?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 mb-2">✅ 优势</p>
                  <ul className="space-y-1">{diagnosis.diagnosis.strengths.map((s: string, i: number) => <li key={i} className="text-sm text-white/70">• {s}</li>)}</ul>
                </div>
              )}
              {diagnosis.diagnosis.risks?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 mb-2">⚠️ 风险</p>
                  <ul className="space-y-1">{diagnosis.diagnosis.risks.map((r: string, i: number) => <li key={i} className="text-sm text-white/70">• {r}</li>)}</ul>
                </div>
              )}
              {diagnosis.diagnosis.recommendations?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 mb-2">💡 建议</p>
                  <ul className="space-y-1">{diagnosis.diagnosis.recommendations.map((r: string, i: number) => <li key={i} className="text-sm text-white/70">{i+1}. {r}</li>)}</ul>
                </div>
              )}
              {diagnosis.diagnosis.nextSteps?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 mb-2">🚀 下一步</p>
                  <ul className="space-y-1">{diagnosis.diagnosis.nextSteps.map((s: string, i: number) => <li key={i} className="text-sm text-white/70">{i+1}. {s}</li>)}</ul>
                </div>
              )}
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
              {diagnosis.raw || JSON.stringify(diagnosis)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
          <ClipboardList className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">品牌问诊系统</h2>
        <p className="text-sm text-white/50">回答12个问题，AI自动生成品牌诊断报告</p>
      </div>

      {/* 品牌名入力 */}
      {step === 0 && !answers.hasTikTokShop && (
        <div className="space-y-3">
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="请输入品牌名称..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
          />
          {brandName.trim() && (
            <button
              onClick={() => handleAnswer("_start", "ok")}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-medium transition-all"
            >
              开始问诊 →
            </button>
          )}
        </div>
      )}

      {/* 問診質問 */}
      {(step > 0 || answers.hasTikTokShop || answers._start) && !diagnosis && (
        <div className="space-y-4">
          {/* 進捗バー */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                style={{ width: `${(Object.keys(answers).filter(k => k !== "_start").length / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-white/40">{Object.keys(answers).filter(k => k !== "_start").length}/{questions.length}</span>
          </div>

          {/* 現在の質問 */}
          {step < questions.length ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-white/40">问题 {step + 1}/{questions.length}</p>
                {step > 0 && (
                  <button
                    onClick={handleBack}
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    ← 上一题
                  </button>
                )}
              </div>
              <p className="text-white font-medium mb-4">{questions[step].question}</p>
              <div className="grid grid-cols-1 gap-2">
                {questions[step].options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => handleAnswer(questions[step].key, opt)}
                    className={`text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      answers[questions[step].key] === opt
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-white/80 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="text-white font-medium">问诊完成！</p>
              <button
                onClick={submitDiagnosis}
                disabled={isLoading}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 rounded-xl text-white font-medium transition-all"
              >
                {isLoading ? "AI正在诊断..." : "生成诊断报告"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// BD訓練パネル（語音入力強化版）
// ============================================================
function TrainingPanel() {
  const [scenario, setScenario] = useState("");
  const [conversation, setConversation] = useState<Array<{ role: "client" | "bd"; content: string; score?: string | null }>>([]);
  const [bdInput, setBdInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const trainingMutation = trpc.lcjBrain.training.useMutation();

  const voice = useVoiceInput((text) => setBdInput(text));

  const scenarios = [
    { id: "price_objection", label: "客户说太贵了", desc: "客户对报价有异议" },
    { id: "pure_commission", label: "客户要纯佣", desc: "客户只想纯佣金模式" },
    { id: "doubt_effect", label: "客户质疑效果", desc: "客户对直播效果有疑虑" },
    { id: "first_contact", label: "第一次接触", desc: "冷启动开场" },
    { id: "competitor", label: "竞品对比", desc: "客户拿竞品来比较" },
    { id: "hesitant", label: "客户犹豫不决", desc: "客户一直拖延不签约" },
  ];

  const startTraining = async (scenarioId: string) => {
    setScenario(scenarioId);
    setConversation([]);
    setIsLoading(true);
    try {
      const result = await trainingMutation.mutateAsync({
        mode: "start",
        scenario: scenarioId,
        userReply: "",
        conversationHistory: [],
      });
      setConversation([{ role: "client", content: result.clientResponse }]);
    } catch (error: any) {
      alert(`训练启动失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendBdResponse = async () => {
    if (!bdInput.trim() || isLoading) return;
    if (voice.isRecording) voice.stopRecording();
    const response = bdInput.trim();
    setBdInput("");
    setConversation(prev => [...prev, { role: "bd", content: response }]);
    setIsLoading(true);
    try {
      const result = await trainingMutation.mutateAsync({
        mode: "reply",
        scenario,
        userReply: response,
        conversationHistory: [...conversation, { role: "bd", content: response }].map(c => ({
          role: c.role === "client" ? "user" : "assistant",
          content: c.content,
        })),
      });
      setConversation(prev => [...prev, { role: "client", content: result.clientResponse, score: result.score }]);
    } catch (error: any) {
      alert(`训练错误: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!scenario) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
            <GraduationCap className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">BD训练模式</h2>
          <p className="text-sm text-white/50">AI扮演品牌方客户，练习你的BD话术</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scenarios.map(s => (
            <button
              key={s.id}
              onClick={() => startTraining(s.id)}
              className="text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all"
            >
              <p className="text-sm font-medium text-white">{s.label}</p>
              <p className="text-xs text-white/40 mt-1">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-250px)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-amber-300">
          训练场景：{scenarios.find(s => s.id === scenario)?.label}
        </h3>
        <button onClick={() => setScenario("")} className="text-xs text-white/40 hover:text-white">
          结束训练
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {conversation.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "bd" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === "bd"
                ? "bg-amber-600 text-white"
                : "bg-white/5 border border-white/10 text-white/90"
            }`}>
              <p className="text-xs text-white/50 mb-1">{msg.role === "bd" ? "你（BD）" : "客户"}</p>
              <p className="text-sm">{msg.content}</p>
              {msg.score !== null && msg.score !== undefined && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-xs text-amber-300">评分: {msg.score}/10</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <span className="text-xs text-white/50">客户正在思考...</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 pt-3">
        {/* 录音状态 */}
        {voice.isRecording && (
          <div className="mb-2 flex items-center gap-2 px-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-300">录音中 {formatTime(voice.recordingTime)}</span>
            <div className="flex items-end gap-0.5 h-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-red-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, voice.audioLevel * 16 * (0.5 + Math.random() * 0.5))}px` }}
                />
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={voice.isRecording ? voice.stopRecording : voice.startRecording}
            className={`px-4 py-3 rounded-xl transition-all ${
              voice.isRecording 
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30" 
                : "bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 text-amber-300 hover:from-amber-600/30 hover:to-orange-600/30"
            }`}
          >
            {voice.isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input
            type="text"
            value={bdInput}
            onChange={(e) => setBdInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendBdResponse()}
            placeholder={voice.isRecording ? "正在听你说话..." : "你作为BD回复..."}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
          />
          <button
            onClick={sendBdResponse}
            disabled={!bdInput.trim() || isLoading}
            className="px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-white/10 rounded-xl text-white transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 話術生成パネル
// ============================================================
function ScriptsPanel() {
  const [selectedScene, setSelectedScene] = useState("");
  const [clientWords, setClientWords] = useState("");
  const [brandContext, setBrandContext] = useState("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scriptMutation = trpc.lcjBrain.generateScript.useMutation();

  const scenes = [
    { id: "price_high", label: "客户说太贵了", prefill: "你们太贵了，别人都便宜很多" },
    { id: "pure_commission", label: "客户要纯佣", prefill: "我们只接受纯佣金合作" },
    { id: "doubt_effect", label: "客户质疑效果", prefill: "你们能保证效果吗？" },
    { id: "hesitant", label: "客户犹豫不决", prefill: "我再考虑考虑" },
    { id: "first_contact", label: "第一次接触", prefill: "" },
    { id: "competitor", label: "竞品对比", prefill: "XX公司比你们便宜" },
  ];

  const generateScript = async () => {
    if (!selectedScene) return;
    setIsLoading(true);
    try {
      const result = await scriptMutation.mutateAsync({
        scenario: selectedScene,
        clientObjection: clientWords || scenes.find(s => s.id === selectedScene)?.prefill || undefined,
        brandInfo: brandContext || undefined,
      });
      setGeneratedScript(result.script || "");
    } catch (error: any) {
      alert(`生成失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
          <BookOpen className="w-7 h-7 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">智能话术生成</h2>
        <p className="text-sm text-white/50">基于《LCJ成交宝典》，为不同场景生成专业话术</p>
      </div>

      {/* 場景選択 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {scenes.map(s => (
          <button
            key={s.id}
            onClick={() => { setSelectedScene(s.id); setClientWords(s.prefill); setGeneratedScript(""); }}
            className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
              selectedScene === s.id
                ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 入力フォーム */}
      {selectedScene && (
        <div className="space-y-3">
          <input
            type="text"
            value={clientWords}
            onChange={(e) => setClientWords(e.target.value)}
            placeholder={`客户在第一次报价后说'${scenes.find(s => s.id === selectedScene)?.prefill || "..."}'`}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
          />
          <input
            type="text"
            value={brandContext}
            onChange={(e) => setBrandContext(e.target.value)}
            placeholder="品牌背景（可选，如：美妆品牌，月销500万）"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={generateScript}
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 rounded-xl text-white font-medium transition-all"
          >
            {isLoading ? "生成中..." : "生成话术"}
          </button>
        </div>
      )}

      {/* 生成結果 */}
      {generatedScript && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/60">生成結果</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedScript);
                const btn = document.getElementById('copy-script-btn');
                if (btn) { btn.textContent = '✓ 已复制'; setTimeout(() => { btn.textContent = '复制文字'; }, 2000); }
              }}
              id="copy-script-btn"
              className="px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-300 transition-all"
            >
              复制文字
            </button>
          </div>
          <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
            {generatedScript}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 産品評分パネル
// ============================================================
function ProductScorePanel() {
  const [productName, setProductName] = useState("");
  const [productInfo, setProductInfo] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scoreMutation = trpc.lcjBrain.scoreProduct.useMutation();

  const [showHelp, setShowHelp] = useState(false);

  const dimensionLabels: Record<string, { label: string; description: string; color: string }> = {
    retention: { label: "停留率", description: "视觉吸引力、能否在3秒内抓住观众注意力", color: "from-violet-500 to-purple-400" },
    expression: { label: "表达力", description: "达人是否容易讲解、演示，产品卖点是否清晰", color: "from-blue-500 to-cyan-400" },
    unitPrice: { label: "客单价", description: "是否在TikTok冲动消费区间（¥1,000-¥10,000）", color: "from-emerald-500 to-green-400" },
    pricefit: { label: "客单价", description: "是否在TikTok冲动消费区间（¥1,000-¥10,000）", color: "from-emerald-500 to-green-400" },
    margin: { label: "毛利率", description: "能否cover佣金+广告+物流成本，利润空间是否充足", color: "from-amber-500 to-yellow-400" },
    logistics: { label: "物流", description: "重量、易碎、时效等物流友好度评估", color: "from-pink-500 to-rose-400" },
    repurchase: { label: "复购率", description: "用户是否会重复购买，复购周期是否合理", color: "from-indigo-500 to-violet-400" },
  };

  const scoreProduct = async () => {
    if (!productName.trim() || !productInfo.trim()) return;
    setIsLoading(true);
    try {
      const res = await scoreMutation.mutateAsync({
        productName: productName.trim(),
        productInfo: productInfo.trim(),
      });
      setResult(res);
    } catch (error: any) {
      alert(`评分失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center mx-auto mb-3 border border-pink-500/20">
          <Star className="w-7 h-7 text-pink-400" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-lg font-semibold text-white">产品TikTok适配度评分</h2>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all text-xs"
            title="评分维度说明"
          >
            ?
          </button>
        </div>
        <p className="text-sm text-white/50">6维度评估产品是否适合TikTok直播带货</p>
      </div>

      {/* ヘルプパネル - 6次元の説明 */}
      {showHelp && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-white mb-3">📊 评分维度说明（每项满分10分，总分满分60分）</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(dimensionLabels).filter(([key]) => key !== 'pricefit').map(([key, dim]) => (
              <div key={key} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
                <div className={`w-2 h-2 rounded-full mt-1.5 bg-gradient-to-r ${dim.color} shrink-0`} />
                <div>
                  <span className="text-xs font-medium text-white">{dim.label}</span>
                  <p className="text-xs text-white/50">{dim.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-xs text-white/40">评分参考：50-60分=非常适合 | 40-49分=适合 | 30-39分=一般 | 30分以下=不太适合</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="产品名称（如：MYTREX筋膜枪）"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50"
        />
        <textarea
          value={productInfo}
          onChange={(e) => setProductInfo(e.target.value)}
          placeholder="产品信息（价格、卖点、目标人群、竞品等）"
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50 resize-none"
        />
        <button
          onClick={scoreProduct}
          disabled={isLoading || !productName.trim() || !productInfo.trim()}
          className="w-full py-3 bg-pink-600 hover:bg-pink-500 disabled:bg-white/10 rounded-xl text-white font-medium transition-all"
        >
          {isLoading ? "评分中..." : "开始评分"}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          {/* 总分 */}
          <div className="text-center bg-white/5 border border-white/10 rounded-xl p-6">
            <p className="text-4xl font-bold text-white mb-1">{result.totalScore}<span className="text-lg text-white/40">/60</span></p>
            <p className={`text-lg font-semibold ${
              result.verdict?.includes("非常") ? "text-green-400" :
              result.verdict?.includes("适合") ? "text-emerald-400" :
              result.verdict?.includes("一般") ? "text-yellow-400" : "text-red-400"
            }`}>{result.verdict}</p>
          </div>

          {/* 6维度 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {result.scores && Object.entries(result.scores).map(([key, val]: [string, any]) => (
              <div key={key} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60">{dimensionLabels[key]?.label || key}</span>
                  <span className="text-sm font-bold text-white">{val.score}/10</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${dimensionLabels[key]?.color || "from-gray-500 to-gray-400"} rounded-full`}
                    style={{ width: `${val.score * 10}%` }}
                  />
                </div>
                <p className="text-xs text-white/40 mt-1.5 line-clamp-2">{val.reason}</p>
              </div>
            ))}
          </div>

          {/* 建议 */}
          {result.recommendation && (
            <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-4">
              <p className="text-sm text-white/85">{result.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================
// 知識庫パネル
// ============================================================
function KnowledgePanel() {
  const [mode, setMode] = useState<"list" | "add" | "detail">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [uploadMode, setUploadMode] = useState<"text" | "pdf">("text");
  
  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"meeting" | "daily_report" | "sop" | "brand" | "other">("meeting");
  const [meetingDate, setMeetingDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: knowledgeList, refetch } = trpc.lcjBrain.getKnowledgeList.useQuery({
    category: categoryFilter || undefined,
    search: searchQuery || undefined,
    limit: 50,
  });

  const { data: knowledgeDetail } = trpc.lcjBrain.getKnowledgeDetail.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId && mode === "detail" }
  );

  const addKnowledgeMutation = trpc.lcjBrain.addKnowledge.useMutation();
  const deleteKnowledgeMutation = trpc.lcjBrain.deleteKnowledge.useMutation();

  const categories = [
    { value: "meeting", label: "会议纪要", icon: "📋" },
    { value: "daily_report", label: "日报", icon: "📝" },
    { value: "sop", label: "SOP文档", icon: "📖" },
    { value: "brand", label: "品牌资料", icon: "🏷️" },
    { value: "other", label: "其他", icon: "📄" },
  ];

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadStatus("正在解析PDF...");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/knowledge-upload", {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("lcj_admin_token") || ""}`,
        },
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "上传失败");
      }
      
      const data = await response.json();
      setContent(data.textContent);
      setTitle(file.name.replace(/\.pdf$/i, ""));
      setUploadStatus(`✅ PDF解析成功（${Math.round(data.textContent.length / 1000)}K字符）`);
    } catch (err: any) {
      setUploadStatus(`❌ ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setUploadStatus("❌ 标题和内容不能为空");
      return;
    }
    
    setIsUploading(true);
    setUploadStatus("正在录入知识库（AI分析中）...");
    
    try {
      const result = await addKnowledgeMutation.mutateAsync({
        title: title.trim(),
        category,
        content: content.trim(),
        meetingDate: meetingDate || undefined,
      });
      
      if (result.success) {
        setUploadStatus(`✅ 录入成功！AI已自动生成摘要和标签。`);
        setTitle("");
        setContent("");
        setMeetingDate("");
        refetch();
        setTimeout(() => {
          setMode("list");
          setUploadStatus("");
        }, 2000);
      } else {
        setUploadStatus(`❌ 录入失败: ${result.error}`);
      }
    } catch (err: any) {
      setUploadStatus(`❌ ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这条知识吗？")) return;
    await deleteKnowledgeMutation.mutateAsync({ id });
    refetch();
    if (mode === "detail") {
      setMode("list");
      setSelectedId(null);
    }
  };

  // List View
  if (mode === "list") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-emerald-400" />
              知识库
            </h2>
            <p className="text-sm text-white/50 mt-1">会议纪要、日报、SOP等公司知识的AI记忆库</p>
          </div>
          <button
            onClick={() => setMode("add")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            录入知识
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="搜索知识库..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
          >
            <option value="" className="bg-slate-800 text-white">全部分类</option>
            {categories.map(c => (
              <option key={c.value} value={c.value} className="bg-slate-800 text-white">{c.icon} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Knowledge List */}
        <div className="space-y-2">
          {(!knowledgeList || knowledgeList.length === 0) ? (
            <div className="text-center py-16 text-white/40">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">知识库为空</p>
              <p className="text-sm mt-1">点击「录入知识」开始添加会议纪要、日报等内容</p>
            </div>
          ) : (
            knowledgeList.map((item: any) => (
              <div
                key={item.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 hover:border-emerald-500/30 transition-all cursor-pointer group"
                onClick={() => { setSelectedId(item.id); setMode("detail"); }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {categories.find(c => c.value === item.category)?.label || item.category}
                      </span>
                      {item.meetingDate && (
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.meetingDate).toLocaleDateString("zh-CN")}
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-medium truncate">{item.title}</h3>
                    {item.summary && (
                      <p className="text-sm text-white/50 mt-1 line-clamp-2">{item.summary}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {item.tags && (item.tags as string[]).slice(0, 4).map((tag: string, i: number) => (
                        <span key={i} className="text-xs text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                      <span className="text-xs text-white/30 ml-auto">
                        {item.uploadedByName} · {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Detail View
  if (mode === "detail" && knowledgeDetail) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setMode("list"); setSelectedId(null); }}
          className="flex items-center gap-1 text-white/60 hover:text-white text-sm"
        >
          ← 返回列表
        </button>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {categories.find(c => c.value === knowledgeDetail.category)?.label || knowledgeDetail.category}
            </span>
            {knowledgeDetail.meetingDate && (
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(knowledgeDetail.meetingDate).toLocaleDateString("zh-CN")}
              </span>
            )}
          </div>
          
          <h2 className="text-xl font-bold text-white mb-3">{knowledgeDetail.title}</h2>
          
          {knowledgeDetail.summary && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-emerald-300 font-medium mb-1">AI摘要</p>
              <p className="text-sm text-white/80 whitespace-pre-line">{knowledgeDetail.summary}</p>
            </div>
          )}

          {knowledgeDetail.participants && (knowledgeDetail.participants as string[]).length > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Users className="w-4 h-4 text-white/40" />
              {(knowledgeDetail.participants as string[]).map((p: string, i: number) => (
                <span key={i} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">{p}</span>
              ))}
            </div>
          )}

          {knowledgeDetail.tags && (knowledgeDetail.tags as string[]).length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Tag className="w-4 h-4 text-white/40" />
              {(knowledgeDetail.tags as string[]).map((tag: string, i: number) => (
                <span key={i} className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded">#{tag}</span>
              ))}
            </div>
          )}

          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-white/40 mb-2">完整内容</p>
            <div className="text-sm text-white/70 whitespace-pre-wrap max-h-[60vh] overflow-y-auto leading-relaxed">
              {knowledgeDetail.content}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 mt-4 flex items-center justify-between text-xs text-white/30">
            <span>上传者: {knowledgeDetail.uploadedByName}</span>
            <span>来源: {knowledgeDetail.sourceFileName || "手动录入"}</span>
          </div>
        </div>
      </div>
    );
  }

  // Add View
  return (
    <div className="space-y-4">
      <button
        onClick={() => { setMode("list"); setUploadStatus(""); }}
        className="flex items-center gap-1 text-white/60 hover:text-white text-sm"
      >
        ← 返回列表
      </button>

      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-400" />
          录入知识
        </h2>

        {/* Upload mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setUploadMode("pdf")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              uploadMode === "pdf"
                ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-white/10"
            }`}
          >
            <FileText className="w-4 h-4" />
            上传PDF
          </button>
          <button
            onClick={() => setUploadMode("text")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              uploadMode === "text"
                ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-white/10"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            粘贴文字
          </button>
        </div>

        {/* PDF Upload */}
        {uploadMode === "pdf" && (
          <div className="mb-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
            >
              <Upload className="w-8 h-8 text-white/40 mx-auto mb-2" />
              <p className="text-white/60">点击上传PDF文件</p>
              <p className="text-xs text-white/30 mt-1">支持飞书/钉钉导出的智能纪要PDF</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handlePdfUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Title */}
        <div className="mb-3">
          <label className="text-sm text-white/60 mb-1 block">标题 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：运营&商务内部会议 2026年5月21日"
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Category & Date */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-sm text-white/60 mb-1 block">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white/80 focus:outline-none focus:border-emerald-500/50"
            >
              {categories.map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">日期</label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white/80 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Content */}
        <div className="mb-4">
          <label className="text-sm text-white/60 mb-1 block">
            内容 * {content && <span className="text-emerald-400">({Math.round(content.length / 1000)}K字符)</span>}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="粘贴会议纪要内容、日报内容、或SOP文档..."
            rows={12}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white/80 placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 resize-y font-mono text-sm leading-relaxed"
          />
        </div>

        {/* Status */}
        {uploadStatus && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${
            uploadStatus.startsWith("✅") ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" :
            uploadStatus.startsWith("❌") ? "bg-red-500/10 text-red-300 border border-red-500/20" :
            "bg-blue-500/10 text-blue-300 border border-blue-500/20"
          }`}>
            {isUploading && <Loader2 className="w-4 h-4 inline-block animate-spin mr-2" />}
            {uploadStatus}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isUploading || !title.trim() || !content.trim()}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              AI分析中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              录入知识库（AI自动分析）
            </>
          )}
        </button>

        <p className="text-xs text-white/30 mt-2 text-center">
          录入后，AI将自动生成摘要、提取标签和参会人。之后在AI对话中提问时，AI会自动引用相关知识。
        </p>
      </div>
    </div>
  );
}


// ============================================================
// 参考LCJページパネル（AIが接続しているデータソース一覧）
// ============================================================
function DataSourcesPanel() {
  const dataSources = [
    {
      category: "ブランド・契約",
      items: [
        { name: "ブランド管理", path: "/master/brands", connected: true, description: "全ブランド一覧・詳細・ステータス" },
        { name: "契約管理", path: "/master/brands", connected: true, description: "ブランド契約情報・ノルマ・進捗" },
        { name: "商品マスター", path: "/master/mall?tab=products", connected: true, description: "ブランド商品一覧" },
      ]
    },
    {
      category: "ライバー・配信",
      items: [
        { name: "ライバー管理", path: "/master/livers-dashboard", connected: true, description: "全ライバー一覧・プロフィール・SNS" },
        { name: "配信実績", path: "/master/sales-check", connected: true, description: "GMV・売上・時間・視聴者数" },
        { name: "ライバー月別実績", path: "/master/livers-dashboard", connected: true, description: "ライバー別の月次パフォーマンス" },
        { name: "業績ランキング", path: "/master/livers-dashboard", connected: true, description: "近3ヶ月のライバー業績比較" },
      ]
    },
    {
      category: "スケジュール・計画",
      items: [
        { name: "配信スケジュール", path: "/s", connected: true, description: "今後2週間の配信予定" },
        { name: "配信シミュレーター", path: "/master/simulator", connected: false, description: "配信予測・GMVシミュレーション" },
      ]
    },
    {
      category: "BD・営業",
      items: [
        { name: "BD知識ベース", path: "/master/lcj-brain", connected: true, description: "話術・交渉テクニック・FAQ" },
        { name: "知識庫（会議纪要）", path: "/master/lcj-brain?tab=knowledge", connected: true, description: "会議記録・RAG検索" },
        { name: "ブランド応募", path: "/master/brand-applications", connected: false, description: "ブランド応募フォーム提出データ" },
      ]
    },
    {
      category: "タスク・日報",
      items: [
        { name: "タスク管理", path: "/master/tasks", connected: false, description: "スタッフタスク・進捗管理" },
        { name: "日報", path: "/master/reports", connected: false, description: "日報データ・活動記録" },
        { name: "スタッフ管理", path: "/master/staff", connected: false, description: "スタッフ情報・出勤" },
      ]
    },
    {
      category: "EC・MALL",
      items: [
        { name: "MALL管理", path: "/master/mall", connected: false, description: "注文・会員・売上データ" },
        { name: "ポイント申請", path: "/master/point-requests", connected: false, description: "ポイント申請・承認" },
        { name: "レシート管理", path: "/master/receipts", connected: false, description: "レシート審査データ" },
        { name: "紹介コード", path: "/master/referral", connected: false, description: "紹介コード実績" },
        { name: "LCJコイン", path: "/master/lcj-coin", connected: false, description: "コイン残高・取引" },
      ]
    },
    {
      category: "マーケティング",
      items: [
        { name: "短動画管理", path: "/master/short-video", connected: false, description: "短動画投稿・パフォーマンス" },
        { name: "ブログ管理", path: "/master/blog", connected: false, description: "ブログ記事データ" },
        { name: "広告ダッシュボード", path: "/master/ad-dashboard", connected: false, description: "広告パフォーマンス" },
        { name: "ABテスト", path: "/master/ab-test", connected: false, description: "テスト結果・分析" },
        { name: "ステップメール", path: "/master/step-email", connected: false, description: "メール配信状況" },
      ]
    },
    {
      category: "その他",
      items: [
        { name: "財務", path: "/master/finance", connected: false, description: "財務データ" },
        { name: "人事", path: "/master/hr", connected: false, description: "人事データ" },
        { name: "LINE管理", path: "/master/line", connected: false, description: "LINE連携状況" },
        { name: "エージェンシー", path: "/master/agencies", connected: false, description: "事務所データ" },
        { name: "名刺管理", path: "/master/business-cards", connected: false, description: "名刺スキャンデータ" },
      ]
    },
  ];

  const connectedCount = dataSources.reduce((acc, cat) => acc + cat.items.filter(i => i.connected).length, 0);
  const totalCount = dataSources.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-violet-400" />
              LCJ Brain データ接続状況
            </h2>
            <p className="text-sm text-white/50 mt-1">AIが参照できるマスター管理画面のデータソース一覧</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-violet-300">{connectedCount}/{totalCount}</div>
            <div className="text-xs text-white/40">接続済み</div>
          </div>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-violet-500 to-indigo-500 h-2 rounded-full transition-all"
            style={{ width: `${(connectedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dataSources.map(category => (
          <div key={category.category} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400"></span>
              {category.category}
            </h3>
            <div className="space-y-2">
              {category.items.map(item => (
                <div key={item.path + item.name} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.connected ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-white/20 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className={`text-sm font-medium truncate ${item.connected ? 'text-white' : 'text-white/40'}`}>
                        {item.name}
                      </div>
                      <div className="text-xs text-white/30 truncate">{item.description}</div>
                    </div>
                  </div>
                  <a 
                    href={item.path} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white/30 hover:text-violet-400 transition-colors shrink-0 ml-2"
                    title={`${item.name}を開く`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
        <p className="text-sm text-violet-200/80">
          💡 <strong>接続済み</strong>のデータは、AI対話で質問するとリアルタイムに参照されます。
          未接続のデータは今後順次追加予定です。
        </p>
      </div>
    </div>
  );
}
