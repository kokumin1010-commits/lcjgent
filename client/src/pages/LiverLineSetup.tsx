import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Smartphone, Send, CheckCircle2, ArrowRight, ChevronDown, ExternalLink, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const LINE_ADD_FRIEND_URL = "https://lin.ee/VunOOhW";

// 多言語テキスト
const texts = {
  ja: {
    heroTitle: "LCJ公式LINEと連携しよう",
    heroSubtitle: "AIコーチングや配信提案をLINEで受け取れます",
    benefit1Title: "AIコーチング",
    benefit1Desc: "配信後にAIがあなたの配信を分析し、改善ポイントをLINEでお届けします",
    benefit2Title: "毎朝の配信提案",
    benefit2Desc: "あなたに最適な配信時間や商品をAIが毎朝提案します",
    benefit3Title: "リアルタイム通知",
    benefit3Desc: "売上速報やランキング変動をリアルタイムでお知らせします",
    howToTitle: "連携方法",
    step1Title: "友だち追加",
    step1Desc: "下のボタンからLCJ公式LINEを友だち追加してください",
    step1Button: "LCJ公式LINEを友だち追加",
    step2Title: "連携コードを発行",
    step2Desc: "マイページの「プロフィール」から連携コードを発行してください",
    step2Button: "連携コードを発行",
    step2Alt: "またはここで発行：",
    step3Title: "コードをLINEに送信",
    step3Desc: "発行されたコード（例: L-123456）をLCJ公式LINEのトーク画面に送信してください",
    completeTitle: "連携完了！",
    completeDesc: "「LINE連携が完了しました！」というメッセージが届いたら設定完了です",
    faqTitle: "よくある質問",
    faq1Q: "連携コードの有効期限は？",
    faq1A: "連携コードは発行から10分間有効です。期限が切れた場合は再発行してください。",
    faq2Q: "連携を解除したい場合は？",
    faq2A: "マイページの「プロフィール」→「LINE通知」セクションから解除できます。",
    faq3Q: "コードを送信しても反応がない場合は？",
    faq3A: "コードの有効期限が切れている可能性があります。新しいコードを発行して再度お試しください。",
    faq4Q: "複数のLINEアカウントで連携できますか？",
    faq4A: "1つのライバーアカウントにつき、1つのLINEアカウントのみ連携可能です。",
    loginRequired: "連携コードの発行にはログインが必要です",
    loginButton: "ログインする",
    goToMypage: "マイページで発行する",
    codeExpires: "有効期限",
    copyCode: "コピー",
    copied: "コピーしました！",
    generating: "発行中...",
    generateCode: "連携コードを発行",
    refreshCode: "再発行",
  },
  "zh-TW": {
    heroTitle: "與LCJ官方LINE連動吧",
    heroSubtitle: "透過LINE接收AI教練指導和直播建議",
    benefit1Title: "AI教練",
    benefit1Desc: "直播結束後，AI會分析您的直播並透過LINE發送改善建議",
    benefit2Title: "每日直播建議",
    benefit2Desc: "AI每天早上為您推薦最佳直播時間和商品",
    benefit3Title: "即時通知",
    benefit3Desc: "即時接收銷售快報和排名變動通知",
    howToTitle: "連動方法",
    step1Title: "加好友",
    step1Desc: "點擊下方按鈕加入LCJ官方LINE好友",
    step1Button: "加入LCJ官方LINE好友",
    step2Title: "發行連動碼",
    step2Desc: "從我的頁面的「個人資料」發行連動碼",
    step2Button: "發行連動碼",
    step2Alt: "或在此發行：",
    step3Title: "將代碼發送到LINE",
    step3Desc: "將發行的代碼（例：L-123456）發送到LCJ官方LINE的聊天畫面",
    completeTitle: "連動完成！",
    completeDesc: "收到「LINE連動已完成！」的訊息即表示設定完成",
    faqTitle: "常見問題",
    faq1Q: "連動碼的有效期限？",
    faq1A: "連動碼自發行起10分鐘內有效。過期請重新發行。",
    faq2Q: "想解除連動時？",
    faq2A: "可從我的頁面「個人資料」→「LINE通知」區段解除。",
    faq3Q: "發送代碼後沒有反應？",
    faq3A: "代碼可能已過期。請發行新代碼後再試。",
    faq4Q: "可以用多個LINE帳號連動嗎？",
    faq4A: "一個主播帳號只能連動一個LINE帳號。",
    loginRequired: "發行連動碼需要登入",
    loginButton: "前往登入",
    goToMypage: "在我的頁面發行",
    codeExpires: "有效期限",
    copyCode: "複製",
    copied: "已複製！",
    generating: "發行中...",
    generateCode: "發行連動碼",
    refreshCode: "重新發行",
  },
  en: {
    heroTitle: "Connect with LCJ Official LINE",
    heroSubtitle: "Receive AI coaching and streaming tips via LINE",
    benefit1Title: "AI Coaching",
    benefit1Desc: "After each stream, AI analyzes your performance and sends improvement tips via LINE",
    benefit2Title: "Daily Stream Suggestions",
    benefit2Desc: "AI recommends optimal streaming times and products every morning",
    benefit3Title: "Real-time Notifications",
    benefit3Desc: "Get instant sales updates and ranking changes",
    howToTitle: "How to Connect",
    step1Title: "Add Friend",
    step1Desc: "Tap the button below to add LCJ Official LINE as a friend",
    step1Button: "Add LCJ Official LINE",
    step2Title: "Generate Link Code",
    step2Desc: "Generate a link code from your Profile page",
    step2Button: "Generate Link Code",
    step2Alt: "Or generate here:",
    step3Title: "Send Code via LINE",
    step3Desc: "Send the generated code (e.g. L-123456) in the LCJ Official LINE chat",
    completeTitle: "Connection Complete!",
    completeDesc: "You'll receive a confirmation message when the setup is done",
    faqTitle: "FAQ",
    faq1Q: "How long is the link code valid?",
    faq1A: "The link code is valid for 10 minutes. Please regenerate if expired.",
    faq2Q: "How to disconnect?",
    faq2A: "Go to Profile → LINE Notifications section to disconnect.",
    faq3Q: "No response after sending the code?",
    faq3A: "The code may have expired. Please generate a new one and try again.",
    faq4Q: "Can I connect multiple LINE accounts?",
    faq4A: "Only one LINE account can be linked per liver account.",
    loginRequired: "Login required to generate link code",
    loginButton: "Login",
    goToMypage: "Generate on My Page",
    codeExpires: "Expires in",
    copyCode: "Copy",
    copied: "Copied!",
    generating: "Generating...",
    generateCode: "Generate Link Code",
    refreshCode: "Regenerate",
  },
  zh: {
    heroTitle: "与LCJ官方LINE连动吧",
    heroSubtitle: "通过LINE接收AI教练指导和直播建议",
    benefit1Title: "AI教练",
    benefit1Desc: "直播结束后，AI会分析您的直播并通过LINE发送改善建议",
    benefit2Title: "每日直播建议",
    benefit2Desc: "AI每天早上为您推荐最佳直播时间和商品",
    benefit3Title: "实时通知",
    benefit3Desc: "实时接收销售快报和排名变动通知",
    howToTitle: "连动方法",
    step1Title: "加好友",
    step1Desc: "点击下方按钮加入LCJ官方LINE好友",
    step1Button: "加入LCJ官方LINE好友",
    step2Title: "发行连动码",
    step2Desc: "从我的页面的「个人资料」发行连动码",
    step2Button: "发行连动码",
    step2Alt: "或在此发行：",
    step3Title: "将代码发送到LINE",
    step3Desc: "将发行的代码（例：L-123456）发送到LCJ官方LINE的聊天画面",
    completeTitle: "连动完成！",
    completeDesc: "收到「LINE连动已完成！」的消息即表示设定完成",
    faqTitle: "常见问题",
    faq1Q: "连动码的有效期限？",
    faq1A: "连动码自发行起10分钟内有效。过期请重新发行。",
    faq2Q: "想解除连动时？",
    faq2A: "可从我的页面「个人资料」→「LINE通知」区段解除。",
    faq3Q: "发送代码后没有反应？",
    faq3A: "代码可能已过期。请发行新代码后再试。",
    faq4Q: "可以用多个LINE账号连动吗？",
    faq4A: "一个主播账号只能连动一个LINE账号。",
    loginRequired: "发行连动码需要登录",
    loginButton: "前往登录",
    goToMypage: "在我的页面发行",
    codeExpires: "有效期限",
    copyCode: "复制",
    copied: "已复制！",
    generating: "发行中...",
    generateCode: "发行连动码",
    refreshCode: "重新发行",
  },
};

type Lang = keyof typeof texts;

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-medium text-white text-sm">{question}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4"
        >
          <p className="text-sm text-gray-400">{answer}</p>
        </motion.div>
      )}
    </div>
  );
}

function LinkCodeGenerator({ t }: { t: Record<string, string> }) {
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check if liver is logged in
  useEffect(() => {
    const token = localStorage.getItem("liverToken");
    setIsLoggedIn(!!token);
  }, []);

  const generateCodeMutation = trpc.liver.generateLineLinkCode.useMutation({
    onSuccess: (data) => {
      setLinkCode(data.linkCode);
      setExpiresAt(new Date(Date.now() + data.expiresIn * 1000));
      setTimeLeft(data.expiresIn);
    },
    onError: (error) => {
      if (error.message?.includes("UNAUTHORIZED") || error.data?.code === "UNAUTHORIZED") {
        setIsLoggedIn(false);
        toast.error(t.loginRequired);
      } else {
        toast.error(error.message || "Error");
      }
    },
  });

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setLinkCode(null);
        setExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const copyCode = () => {
    if (linkCode) {
      navigator.clipboard.writeText(linkCode);
      toast.success(t.copied);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="mt-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
        <p className="text-sm text-gray-400 mb-2">{t.loginRequired}</p>
        <div className="flex gap-2 justify-center">
          <a
            href="/liver/login"
            className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {t.loginButton}
          </a>
          <a
            href="/liver/profile"
            className="inline-flex items-center gap-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {t.goToMypage}
          </a>
        </div>
      </div>
    );
  }

  if (linkCode) {
    return (
      <div className="mt-3 p-4 bg-yellow-900/20 border border-yellow-600/50 rounded-lg text-center">
        <p className="text-xs text-yellow-400 mb-1">
          {t.codeExpires}: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
        </p>
        <p className="text-3xl font-bold text-white tracking-widest my-2">{linkCode}</p>
        <div className="flex gap-2 justify-center">
          <Button size="sm" variant="outline" onClick={copyCode} className="text-yellow-400 border-yellow-600">
            <Copy className="h-3 w-3 mr-1" /> {t.copyCode}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateCodeMutation.mutate()}
            disabled={generateCodeMutation.isPending}
            className="text-gray-400 border-gray-600"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> {t.refreshCode}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 mb-2">{t.step2Alt}</p>
      <Button
        onClick={() => generateCodeMutation.mutate()}
        disabled={generateCodeMutation.isPending}
        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
      >
        {generateCodeMutation.isPending ? t.generating : t.generateCode}
      </Button>
    </div>
  );
}

export default function LiverLineSetup() {
  const { language } = useLanguage();
  const lang = (["ja", "zh-TW", "en", "zh"].includes(language) ? language : "ja") as Lang;
  const t = texts[lang];

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-[120px]" />
        
        <div className="relative max-w-lg mx-auto px-4 pt-16 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-900/40 border border-green-700/50 rounded-full mb-6">
              <MessageCircle className="h-4 w-4 text-green-400" />
              <span className="text-sm text-green-300">LINE</span>
            </div>
            
            <h1 className="text-3xl font-bold mb-4 leading-tight">
              {t.heroTitle}
            </h1>
            <p className="text-gray-400 text-base">
              {t.heroSubtitle}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-lg mx-auto px-4 pb-10">
        <div className="grid gap-3">
          {[
            { icon: "🤖", title: t.benefit1Title, desc: t.benefit1Desc },
            { icon: "🌅", title: t.benefit2Title, desc: t.benefit2Desc },
            { icon: "⚡", title: t.benefit3Title, desc: t.benefit3Desc },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="flex items-start gap-3 p-4 bg-gray-900/60 border border-gray-800 rounded-xl"
            >
              <span className="text-2xl mt-0.5">{item.icon}</span>
              <div>
                <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How To Section */}
      <section className="max-w-lg mx-auto px-4 pb-10">
        <h2 className="text-xl font-bold text-center mb-8">{t.howToTitle}</h2>
        
        <div className="space-y-6">
          {/* Step 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="relative"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                1
              </div>
              <div className="flex-1 pb-6">
                <h3 className="font-semibold text-white mb-1">{t.step1Title}</h3>
                <p className="text-sm text-gray-400 mb-3">{t.step1Desc}</p>
                <a
                  href={LINE_ADD_FRIEND_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#06C755] hover:bg-[#05b04c] text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-green-900/30"
                >
                  <MessageCircle className="h-5 w-5" />
                  {t.step1Button}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </div>
            </div>
            {/* Connector line */}
            <div className="absolute left-5 top-10 w-px h-[calc(100%-2.5rem)] bg-gray-700" />
          </motion.div>

          {/* Step 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="relative"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                2
              </div>
              <div className="flex-1 pb-6">
                <h3 className="font-semibold text-white mb-1">{t.step2Title}</h3>
                <p className="text-sm text-gray-400 mb-1">{t.step2Desc}</p>
                <LinkCodeGenerator t={t} />
              </div>
            </div>
            <div className="absolute left-5 top-10 w-px h-[calc(100%-2.5rem)] bg-gray-700" />
          </motion.div>

          {/* Step 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className="relative"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                3
              </div>
              <div className="flex-1 pb-6">
                <h3 className="font-semibold text-white mb-1">{t.step3Title}</h3>
                <p className="text-sm text-gray-400">{t.step3Desc}</p>
                
                {/* Visual example */}
                <div className="mt-3 p-3 bg-gray-800/80 border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Send className="h-3 w-3 text-green-400" />
                    <span className="text-xs text-gray-500">LINE</span>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-[#06C755] text-white px-3 py-1.5 rounded-2xl rounded-br-sm text-sm font-medium">
                      L-123456
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute left-5 top-10 w-px h-[calc(100%-2.5rem)] bg-gray-700" />
          </motion.div>

          {/* Complete */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-400 mb-1">{t.completeTitle}</h3>
                <p className="text-sm text-gray-400">{t.completeDesc}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-lg mx-auto px-4 pb-16">
        <h2 className="text-xl font-bold text-center mb-6">{t.faqTitle}</h2>
        <div className="space-y-2">
          <FAQItem question={t.faq1Q} answer={t.faq1A} />
          <FAQItem question={t.faq2Q} answer={t.faq2A} />
          <FAQItem question={t.faq3Q} answer={t.faq3A} />
          <FAQItem question={t.faq4Q} answer={t.faq4A} />
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="sticky bottom-0 bg-gradient-to-t from-[#0a0a14] via-[#0a0a14] to-transparent pt-8 pb-6">
        <div className="max-w-lg mx-auto px-4">
          <a
            href={LINE_ADD_FRIEND_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 bg-[#06C755] hover:bg-[#05b04c] text-white rounded-xl text-base font-bold transition-colors shadow-lg shadow-green-900/40"
          >
            <MessageCircle className="h-5 w-5" />
            {t.step1Button}
          </a>
        </div>
      </section>
    </div>
  );
}
