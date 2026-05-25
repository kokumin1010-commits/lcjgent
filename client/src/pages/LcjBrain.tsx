import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { 
  Brain, Send, Sparkles, MessageCircle, Target, BookOpen, 
  Zap, Users, TrendingUp, FileText, Mic, StopCircle,
  ChevronRight, BarChart3, Lightbulb, Shield, GraduationCap,
  ClipboardList, Star, AlertTriangle, CheckCircle2, ArrowRight
} from "lucide-react";

// ============================================================
// タブ定義
// ============================================================
type TabType = "chat" | "diagnosis" | "training" | "scripts" | "product_score";

// ============================================================
// メインコンポーネント
// ============================================================
export default function LcjBrain() {
  const [activeTab, setActiveTab] = useState<TabType>("chat");

  const tabs = [
    { id: "chat" as TabType, label: "AI对话", icon: MessageCircle, desc: "问任何关于LCJ的问题" },
    { id: "diagnosis" as TabType, label: "品牌问诊", icon: ClipboardList, desc: "10问诊断品牌" },
    { id: "training" as TabType, label: "BD训练", icon: GraduationCap, desc: "AI模拟客户练习" },
    { id: "scripts" as TabType, label: "话术生成", icon: BookOpen, desc: "场景化话术建议" },
    { id: "product_score" as TabType, label: "产品评分", icon: Star, desc: "6维度适配度评分" },
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
              <h1 className="text-xl font-bold text-white tracking-tight">LCJ Brain</h1>
              <p className="text-xs text-white/50">全自动BD引擎 · 连接LCJ所有数据</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-white/5 bg-black/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
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
      </div>
    </div>
  );
}

// ============================================================
// AI対話パネル
// ============================================================
function ChatPanel() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMutation = trpc.lcjBrain.chat.useMutation();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const result = await chatMutation.mutateAsync({
        message: userMsg,
        history: messages.slice(-10),
        context: "general",
      });
      setMessages(prev => [...prev, { role: "assistant", content: result.response }]);
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
                  onClick={() => { setInput(q); }}
                  className="text-left px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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

      {/* Input Area */}
      <div className="border-t border-white/10 pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="问任何关于LCJ的问题..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 rounded-xl text-white transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
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
        brandName,
        answers,
      });
      setDiagnosis(result.diagnosis);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setBrandName("");
    setAnswers({});
    setDiagnosis(null);
  };

  // 診断結果表示
  if (diagnosis) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">品牌诊断报告：{brandName}</h2>
          <button onClick={reset} className="text-sm text-violet-400 hover:text-violet-300">重新诊断</button>
        </div>

        {/* 概要 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xs text-white/50 mb-1">品牌阶段</p>
            <p className="text-lg font-bold text-violet-300">{diagnosis.stage}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xs text-white/50 mb-1">风险等级</p>
            <p className={`text-lg font-bold ${diagnosis.riskLevel === "高" ? "text-red-400" : diagnosis.riskLevel === "中" ? "text-yellow-400" : "text-green-400"}`}>
              {diagnosis.riskLevel}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xs text-white/50 mb-1">推荐模式</p>
            <p className="text-sm font-bold text-indigo-300">{diagnosis.recommendedModel}</p>
          </div>
        </div>

        {/* 总结 */}
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
          <p className="text-sm text-white/90">{diagnosis.summary}</p>
        </div>

        {/* 优势 & 风险 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> 优势
            </h3>
            <ul className="space-y-2">
              {diagnosis.strengths?.map((s: string, i: number) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> 风险
            </h3>
            <ul className="space-y-2">
              {diagnosis.risks?.map((r: string, i: number) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-orange-400 mt-0.5">•</span> {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 建议 */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-violet-300 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> 建议
          </h3>
          <ul className="space-y-2">
            {diagnosis.recommendations?.map((r: string, i: number) => (
              <li key={i} className="text-sm text-white/70">{i + 1}. {r}</li>
            ))}
          </ul>
        </div>

        {/* 下一步 */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-indigo-300 mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" /> 下一步行动
          </h3>
          <div className="space-y-3">
            {diagnosis.nextSteps?.map((s: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-indigo-300">{i + 1}</span>
                </div>
                <p className="text-sm text-white/80">{s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 预估周期 */}
        {diagnosis.estimatedTimeline && (
          <div className="text-center text-sm text-white/40">
            预估合作周期：{diagnosis.estimatedTimeline}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 品牌名入力 */}
      {step === 0 && !brandName && (
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mx-auto border border-emerald-500/20">
            <ClipboardList className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-2">品牌问诊系统</h2>
            <p className="text-sm text-white/50">基于《LCJ成交宝典》的10问诊断，自动生成品牌诊断报告</p>
          </div>
          <div className="max-w-sm mx-auto">
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && brandName.trim()) setStep(0); }}
              placeholder="输入品牌名称..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 text-center"
            />
            <button
              onClick={() => { if (brandName.trim()) setStep(0); }}
              disabled={!brandName.trim()}
              className="mt-3 w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 rounded-xl text-white font-medium transition-all"
            >
              开始问诊
            </button>
          </div>
        </div>
      )}

      {/* 問診質問 */}
      {brandName && step < questions.length && (
        <div className="space-y-6">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${((step + 1) / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-white/50">{step + 1}/{questions.length}</span>
          </div>

          {/* Question */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <p className="text-xs text-emerald-400 mb-2">问题 {step + 1}</p>
            <h3 className="text-lg font-semibold text-white mb-4">{questions[step].question}</h3>
            <div className="grid gap-2">
              {questions[step].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(questions[step].key, opt)}
                  className="text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-white transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
            {questions[step].freeText && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="或者自由输入..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      handleAnswer(questions[step].key, (e.target as HTMLInputElement).value.trim());
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Skip / Back */}
          <div className="flex justify-between">
            <button
              onClick={() => step > 0 && setStep(step - 1)}
              disabled={step === 0}
              className="text-sm text-white/40 hover:text-white/70 disabled:invisible"
            >
              ← 上一题
            </button>
            <button
              onClick={() => handleAnswer(questions[step].key, "未回答")}
              className="text-sm text-white/40 hover:text-white/70"
            >
              跳过 →
            </button>
          </div>
        </div>
      )}

      {/* 提出ボタン */}
      {brandName && step >= questions.length - 1 && Object.keys(answers).length > 0 && !diagnosis && (
        <div className="text-center mt-8">
          <button
            onClick={submitDiagnosis}
            disabled={isLoading}
            className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-white font-medium shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {isLoading ? "AI正在诊断..." : "生成诊断报告"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// BD訓練パネル
// ============================================================
function TrainingPanel() {
  const [isStarted, setIsStarted] = useState(false);
  const [scenario, setScenario] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; score?: string | null }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const trainingMutation = trpc.lcjBrain.training.useMutation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const scenarios = [
    "一个中国美妆品牌想进入日本TikTok市场，月预算50万日元，但对价格很敏感",
    "一个3C品牌已经在Amazon日本卖得不错，想试试TikTok直播，但要求纯佣",
    "一个健康食品品牌，产品客单价很高（2万日元），不确定TikTok能不能卖",
    "一个服装品牌，之前和其他MCN合作过但效果不好，对MCN有不信任感",
    "一个新品牌，什么都没有（没店铺、没库存、没经验），但很想做日本市场",
  ];

  const startTraining = async (selectedScenario: string) => {
    setScenario(selectedScenario);
    setIsStarted(true);
    setIsLoading(true);
    try {
      const result = await trainingMutation.mutateAsync({
        mode: "start",
        scenario: selectedScenario,
        conversationHistory: [],
      });
      setMessages([{ role: "assistant", content: result.clientResponse, score: null }]);
    } catch (error: any) {
      setMessages([{ role: "assistant", content: `错误: ${error.message}`, score: null }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendReply = async () => {
    if (!input.trim() || isLoading) return;
    const userReply = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userReply }]);
    setIsLoading(true);

    try {
      const result = await trainingMutation.mutateAsync({
        mode: "reply",
        userReply,
        conversationHistory: messages,
      });
      setMessages(prev => [...prev, { role: "assistant", content: result.clientResponse, score: result.score }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `错误: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setIsStarted(false);
    setScenario("");
    setMessages([]);
    setInput("");
  };

  if (!isStarted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <GraduationCap className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">BD训练模式</h2>
          <p className="text-sm text-white/50">AI扮演品牌客户，模拟真实BD谈判场景。<br/>练习医生式BD、气场管理、拉扯技巧。</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-white/60 font-medium">选择训练场景：</p>
          {scenarios.map((s, i) => (
            <button
              key={i}
              onClick={() => startTraining(s)}
              className="w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all"
            >
              <span className="text-amber-400 mr-2">场景{i + 1}:</span> {s}
            </button>
          ))}
        </div>

        {/* 自定义场景 */}
        <div className="border-t border-white/10 pt-4">
          <input
            type="text"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="或者输入自定义场景..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            onKeyDown={(e) => { if (e.key === "Enter" && scenario.trim()) startTraining(scenario); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
        <div>
          <p className="text-xs text-amber-400">训练模式 · AI扮演品牌方</p>
          <p className="text-sm text-white/60 mt-1">{scenario}</p>
        </div>
        <button onClick={reset} className="text-xs text-white/40 hover:text-white/70 px-3 py-1 rounded-lg border border-white/10">
          结束训练
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%]">
              <div className={`rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-amber-600 text-white"
                  : "bg-white/5 border border-white/10 text-white/90"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.score && (
                <div className="mt-1 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-lg inline-block">
                  <p className="text-xs text-violet-300">📊 {msg.score}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-white/50">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs">品牌方正在思考...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
            placeholder="你作为BD回复..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
          />
          <button
            onClick={sendReply}
            disabled={!input.trim() || isLoading}
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
  const [scenario, setScenario] = useState("");
  const [objection, setObjection] = useState("");
  const [brandInfo, setBrandInfo] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scriptMutation = trpc.lcjBrain.generateScript.useMutation();

  const presetScenarios = [
    { label: "客户说太贵了", scenario: "客户在第一次报价后说'你们太贵了'", objection: "你们太贵了，别人都便宜很多" },
    { label: "客户要纯佣", scenario: "客户坚持要纯佣合作", objection: "我们只接受纯佣，不想出固定费用" },
    { label: "客户质疑效果", scenario: "客户质疑直播效果", objection: "你们数据也一般啊，怎么保证效果？" },
    { label: "客户犹豫不决", scenario: "客户说'我再考虑考虑'", objection: "让我再想想，下次再聊" },
    { label: "第一次接触", scenario: "第一次和品牌方接触，对方还不了解LCJ", objection: "" },
    { label: "竞品对比", scenario: "客户拿竞品来比较", objection: "XX公司也能做，而且更便宜" },
  ];

  const generate = async (s?: string, o?: string) => {
    const useScenario = s || scenario;
    if (!useScenario.trim()) return;
    setIsLoading(true);
    try {
      const res = await scriptMutation.mutateAsync({
        scenario: useScenario,
        clientObjection: o || objection || undefined,
        brandInfo: brandInfo || undefined,
      });
      setResult(res.script);
    } catch (error: any) {
      setResult(`错误: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
          <BookOpen className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">智能话术生成</h2>
        <p className="text-sm text-white/50">基于《LCJ成交宝典》，为不同场景生成专业话术</p>
      </div>

      {/* 快速场景 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {presetScenarios.map((p, i) => (
          <button
            key={i}
            onClick={() => { setScenario(p.scenario); setObjection(p.objection); generate(p.scenario, p.objection); }}
            className="text-left px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 自定义输入 */}
      <div className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
        <input
          type="text"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="描述场景（如：客户第一次见面，对TikTok直播有兴趣）"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
        />
        <input
          type="text"
          value={objection}
          onChange={(e) => setObjection(e.target.value)}
          placeholder="客户的反对意见（可选，如：'你们太贵了'）"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
        />
        <input
          type="text"
          value={brandInfo}
          onChange={(e) => setBrandInfo(e.target.value)}
          placeholder="品牌背景（可选，如：美妆品牌，月销500万）"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
        />
        <button
          onClick={() => generate()}
          disabled={!scenario.trim() || isLoading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 rounded-lg text-white text-sm font-medium transition-all"
        >
          {isLoading ? "生成中..." : "生成话术"}
        </button>
      </div>

      {/* 结果 */}
      {result && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-white/85">
            {result}
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
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scoreMutation = trpc.lcjBrain.scoreProduct.useMutation();

  const submit = async () => {
    if (!productName.trim()) return;
    setIsLoading(true);
    try {
      const res = await scoreMutation.mutateAsync({
        productName,
        category: category || undefined,
        price: price || undefined,
        description: description || undefined,
      });
      setResult(res.result);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const dimensionLabels: Record<string, { label: string; color: string }> = {
    retention: { label: "停留率", color: "from-pink-500 to-rose-500" },
    expression: { label: "表达力", color: "from-violet-500 to-purple-500" },
    pricefit: { label: "客单价", color: "from-blue-500 to-indigo-500" },
    margin: { label: "毛利", color: "from-emerald-500 to-green-500" },
    logistics: { label: "物流", color: "from-amber-500 to-yellow-500" },
    repurchase: { label: "复购", color: "from-cyan-500 to-teal-500" },
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center mx-auto mb-4 border border-pink-500/20">
          <Star className="w-8 h-8 text-pink-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">产品TikTok适配度评分</h2>
        <p className="text-sm text-white/50">基于6个维度评估产品是否适合TikTok直播</p>
      </div>

      {/* 入力フォーム */}
      <div className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="产品名称 *"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="产品类别（如：美妆）"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50"
          />
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="价格（如：3980円）"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="产品描述（可选）"
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50 resize-none"
        />
        <button
          onClick={submit}
          disabled={!productName.trim() || isLoading}
          className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 disabled:bg-white/10 rounded-lg text-white text-sm font-medium transition-all"
        >
          {isLoading ? "AI评分中..." : "开始评分"}
        </button>
      </div>

      {/* 結果表示 */}
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
