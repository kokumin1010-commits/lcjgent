import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";
import { 
  Brain, Send, Sparkles, MessageCircle, Target, BookOpen, 
  Zap, Users, TrendingUp, FileText, Mic, StopCircle,
  ChevronRight, BarChart3, Lightbulb, Shield, GraduationCap,
  ClipboardList, Star, AlertTriangle, CheckCircle2, ArrowRight,
  History, Search, MicOff, Volume2
} from "lucide-react";

// ============================================================
// タブ定義
// ============================================================
type TabType = "chat" | "diagnosis" | "training" | "scripts" | "product_score" | "logs";

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
    recognition.lang = "zh-CN";
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
    { id: "diagnosis" as TabType, label: "品牌问诊", icon: ClipboardList },
    { id: "training" as TabType, label: "BD训练", icon: GraduationCap },
    { id: "scripts" as TabType, label: "话术生成", icon: BookOpen },
    { id: "product_score" as TabType, label: "产品评分", icon: Star },
    { id: "logs" as TabType, label: "聊天记录", icon: History },
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

      {/* Tabs */}
      <div className="border-b border-white/10 bg-black/10 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "chat" && <ChatPanel />}
        {activeTab === "diagnosis" && <DiagnosisPanel />}
        {activeTab === "training" && <TrainingPanel />}
        {activeTab === "scripts" && <ScriptsPanel />}
        {activeTab === "product_score" && <ProductScorePanel />}
        {activeTab === "logs" && <ChatLogsPanel />}
      </div>
    </div>
  );
}

// ============================================================
// AI対話パネル（升級版：後続質問ボタン + 語音入力強化）
// ============================================================
function ChatPanel() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; suggestedQuestions?: string[] }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMutation = trpc.lcjBrain.chat.useMutation();

  const voice = useVoiceInput((text) => setInput(text));

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    
    // 如果正在录音，先停止
    if (voice.isRecording) voice.stopRecording();
    
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setIsLoading(true);

    try {
      const result = await chatMutation.mutateAsync({ message: msg });
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: result.response,
        suggestedQuestions: result.suggestedQuestions || [],
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `错误: ${error.message}` }]);
    } finally {
      setIsLoading(false);
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
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
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
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-white/5 border border-white/10 text-white/90"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
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

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={voice.isRecording ? "正在听你说话..." : "问任何关于LCJ的问题..."}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 rounded-xl text-white transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* 提示文字 */}
        {!voice.isRecording && (
          <p className="text-xs text-white/20 mt-2 text-center">
            点击 🎤 开始语音输入，支持中文、日文
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 聊天記録管理パネル（管理者用）
// ============================================================
function ChatLogsPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const logsQuery = trpc.lcjBrain.getChatLogs.useQuery({ 
    page, 
    limit: 50,
    search: searchQuery || undefined,
  });

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

      {/* 搜索 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
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
      <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
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
                {log.role === "user" ? "👤 用户" : "🤖 AI"}
                {log.userName && <span className="ml-1 text-white/40">({log.userName})</span>}
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
    if (step < questions.length - 1) {
      setStep(step + 1);
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
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
            {diagnosis.report || diagnosis.response || JSON.stringify(diagnosis)}
          </div>
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
              <p className="text-sm text-white/40 mb-1">问题 {step + 1}/{questions.length}</p>
              <p className="text-white font-medium mb-4">{questions[step].question}</p>
              <div className="grid grid-cols-1 gap-2">
                {questions[step].options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => handleAnswer(questions[step].key, opt)}
                    className="text-left px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300 transition-all"
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
  const [conversation, setConversation] = useState<Array<{ role: "client" | "bd"; content: string; score?: number | null }>>([]);
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
        scenario: scenarioId,
        bdResponse: "",
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
        scenario,
        bdResponse: response,
        conversationHistory: [...conversation, { role: "bd", content: response }].map(c => ({
          role: c.role === "client" ? "client" : "bd",
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
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
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
        scene: selectedScene,
        clientWords: clientWords || scenes.find(s => s.id === selectedScene)?.prefill || "",
        brandContext: brandContext || undefined,
      });
      setGeneratedScript(result.script || result.response || "");
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
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
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

  const dimensionLabels: Record<string, { label: string; color: string }> = {
    retention: { label: "停留率", color: "from-violet-500 to-purple-400" },
    expression: { label: "表达力", color: "from-blue-500 to-cyan-400" },
    unitPrice: { label: "客单价", color: "from-emerald-500 to-green-400" },
    margin: { label: "毛利率", color: "from-amber-500 to-yellow-400" },
    logistics: { label: "物流", color: "from-pink-500 to-rose-400" },
    repurchase: { label: "复购率", color: "from-indigo-500 to-violet-400" },
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
        <h2 className="text-lg font-semibold text-white">产品TikTok适配度评分</h2>
        <p className="text-sm text-white/50">6维度评估产品是否适合TikTok直播带货</p>
      </div>

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
