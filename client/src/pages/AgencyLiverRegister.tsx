import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { setLiverToken } from "@/lib/liverAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Heart, Building2 } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   AGENCY LIVER REGISTER - 事務所専用ライバー自己登録ページ
   URL: /agency/:agencyCode/liver/register
   チャット形式で登録。agencyCodeで事務所に自動紐付け。
   ═══════════════════════════════════════════════════════════════ */

type Step = "welcome" | "name" | "email" | "password" | "tiktok" | "instagram" | "color" | "complete";

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
}

// 事務所ごとのブランド設定
interface AgencyBrand {
  name: string;
  gradient: string;
  bgGradient: string;
  iconBg: string;
  bubbleBg: string;
  inputBorder: string;
  inputFocus: string;
  headerBg: string;
  headerBorder: string;
  dotColor: string;
}

function getAgencyBrand(code: string): AgencyBrand {
  // 事務所コードに応じたブランド設定
  switch (code.toLowerCase()) {
    case "mobmart":
      return {
        name: "Mobmart",
        gradient: "from-blue-500 to-cyan-500",
        bgGradient: "from-slate-900 via-blue-950 to-slate-900",
        iconBg: "linear-gradient(135deg, #3b82f6, #06b6d4)",
        bubbleBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
        inputBorder: "border-blue-700",
        inputFocus: "focus:border-blue-400 focus:ring-blue-400",
        headerBg: "bg-slate-900/90",
        headerBorder: "border-blue-900/50",
        dotColor: "bg-blue-400",
      };
    default:
      return {
        name: code,
        gradient: "from-pink-400 to-purple-500",
        bgGradient: "from-pink-50 via-white to-purple-50",
        iconBg: "linear-gradient(135deg, #ec4899, #a855f7)",
        bubbleBg: "bg-gradient-to-br from-pink-500 to-purple-500",
        inputBorder: "border-pink-200",
        inputFocus: "focus:border-pink-400 focus:ring-pink-400",
        headerBg: "bg-white/80",
        headerBorder: "border-pink-100",
        dotColor: "bg-pink-300",
      };
  }
}

const COLOR_KEYS = [
  { label: "ピンク", value: "#FF69B4" },
  { label: "パープル", value: "#9B59B6" },
  { label: "ブルー", value: "#3498DB" },
  { label: "グリーン", value: "#2ECC71" },
  { label: "オレンジ", value: "#E67E22" },
  { label: "レッド", value: "#E74C3C" },
  { label: "イエロー", value: "#F1C40F" },
  { label: "ティール", value: "#1ABC9C" },
];

export default function AgencyLiverRegister() {
  const params = useParams<{ agencyCode: string }>();
  const agencyCode = params.agencyCode || "mobmart";
  const brand = getAgencyBrand(agencyCode);
  const isDark = agencyCode.toLowerCase() === "mobmart";

  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("welcome");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [instagram, setInstagram] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3498DB");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const registerMutation = trpc.liver.register.useMutation({
    onSuccess: async (data) => {
      if (data.token) {
        setLiverToken(data.token);
      }
      await utils.liver.me.invalidate();

      addBotMessage("🎉 登録完了！");
      setTimeout(() => {
        addBotMessage(`${name}さん、${brand.name}へようこそ！✨`);
        setTimeout(() => {
          addBotMessage("マイページに移動するね！");
          setTimeout(() => {
            window.location.href = "/liver/mypage";
          }, 1500);
        }, 1500);
      }, 1000);
    },
    onError: (err) => {
      setError(err.message);
      addBotMessage(`あれ、エラーが出ちゃった...😢 ${err.message}`);
      addBotMessage("もう一度メールアドレスから試してみてね！");
      setStep("email");
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Start the conversation
    setTimeout(() => {
      addBotMessage("はじめまして！✨");
      setTimeout(() => {
        addBotMessage(`${brand.name}へようこそ！💖`);
        setTimeout(() => {
          addBotMessage("一緒にアカウントを作ろう！");
          setTimeout(() => {
            setStep("name");
            addBotMessage("まずは、あなたのお名前を教えてね！🎤");
          }, 800);
        }, 800);
      }, 800);
    }, 500);
  }, []);

  const addBotMessage = (content: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}-${Math.random()}`,
          type: "bot",
          content,
        },
      ]);
      setIsTyping(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }, 500);
  };

  const addUserMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        type: "user",
        content,
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const value = input.trim();
    setInput("");
    setError("");

    switch (step) {
      case "name":
        addUserMessage(value);
        setName(value);
        setTimeout(() => {
          addBotMessage(`${value}さん、素敵なお名前だね！💕`);
          setTimeout(() => {
            setStep("email");
            addBotMessage("次は、メールアドレスを教えてね！📧");
          }, 800);
        }, 300);
        break;

      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          setError("正しいメールアドレスを入力してね");
          return;
        }
        addUserMessage(value);
        setEmail(value);
        setTimeout(() => {
          addBotMessage("ありがとう！📬");
          setTimeout(() => {
            setStep("password");
            addBotMessage("パスワードを設定しよう！🔐（6文字以上）");
          }, 800);
        }, 300);
        break;

      case "password":
        if (value.length < 6) {
          setError("パスワードは6文字以上にしてね");
          return;
        }
        addUserMessage("••••••");
        setPassword(value);
        setTimeout(() => {
          addBotMessage("バッチリ！🎯");
          setTimeout(() => {
            setStep("tiktok");
            addBotMessage("TikTokアカウントを教えてね！🎵\n（スキップする場合は「なし」と入力）");
          }, 800);
        }, 300);
        break;

      case "tiktok": {
        const isSkip = value === "なし" || value === "スキップ" || value === "skip" || value === "none";
        addUserMessage(isSkip ? "スキップ" : value);
        if (!isSkip) setTiktok(value.startsWith("@") ? value : `@${value}`);
        setTimeout(() => {
          addBotMessage(isSkip ? "了解！👌" : `${value}だね！🎵`);
          setTimeout(() => {
            setStep("instagram");
            addBotMessage("Instagramアカウントは？📸\n（スキップする場合は「なし」と入力）");
          }, 800);
        }, 300);
        break;
      }

      case "instagram": {
        const isSkip = value === "なし" || value === "スキップ" || value === "skip" || value === "none";
        addUserMessage(isSkip ? "スキップ" : value);
        if (!isSkip) setInstagram(value.startsWith("@") ? value : `@${value}`);
        setTimeout(() => {
          addBotMessage(isSkip ? "了解！👌" : `${value}だね！📸`);
          setTimeout(() => {
            setStep("color");
            addBotMessage("最後に、あなたのテーマカラーを選んでね！🎨");
          }, 800);
        }, 300);
        break;
      }
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    const colorLabel = COLOR_KEYS.find((c) => c.value === color)?.label || color;
    addUserMessage(`${colorLabel}を選んだよ！`);
    setTimeout(() => {
      addBotMessage(`${colorLabel}、いいね！✨`);
      setTimeout(() => {
        addBotMessage("これで準備完了！登録するね...🚀");
        setStep("complete");
        registerMutation.mutate({
          name,
          email,
          password,
          color,
          agencyCode,
          tiktokAccount: tiktok || undefined,
          instagramAccount: instagram || undefined,
        });
      }, 800);
    }, 300);
  };

  const getPlaceholder = () => {
    switch (step) {
      case "name": return "お名前を入力...";
      case "email": return "example@email.com";
      case "password": return "6文字以上のパスワード";
      case "tiktok": return "@tiktok_username";
      case "instagram": return "@instagram_username";
      default: return "";
    }
  };

  const getInputType = () => {
    switch (step) {
      case "email": return "email";
      case "password": return "password";
      default: return "text";
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? `bg-gradient-to-br ${brand.bgGradient}` : `bg-gradient-to-br ${brand.bgGradient}`}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 backdrop-blur-sm px-4 py-3 ${brand.headerBg} border-b ${brand.headerBorder}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: brand.iconBg }}>
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className={`font-bold ${isDark ? "text-white" : "text-gray-800"}`}>{brand.name}</h1>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>ライバー新規登録</p>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.type === "bot" && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0"
                  style={{ background: brand.iconBg }}>
                  <Heart className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  message.type === "user"
                    ? `${brand.bubbleBg} text-white rounded-br-md`
                    : isDark
                      ? "bg-slate-800 shadow-sm border border-slate-700 text-gray-100 rounded-bl-md"
                      : "bg-white shadow-sm border border-pink-100 text-gray-800 rounded-bl-md"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2"
              style={{ background: brand.iconBg }}>
              <Heart className="h-4 w-4 text-white" />
            </div>
            <div className={`px-4 py-3 rounded-2xl rounded-bl-md ${
              isDark
                ? "bg-slate-800 shadow-sm border border-slate-700"
                : "bg-white shadow-sm border border-pink-100"
            }`}>
              <div className="flex gap-1">
                <span className={`w-2 h-2 ${brand.dotColor} rounded-full animate-bounce`} style={{ animationDelay: "0ms" }} />
                <span className={`w-2 h-2 ${brand.dotColor} rounded-full animate-bounce`} style={{ animationDelay: "150ms" }} />
                <span className={`w-2 h-2 ${brand.dotColor} rounded-full animate-bounce`} style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Color selection */}
        {step === "color" && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-3 justify-center py-4"
          >
            {COLOR_KEYS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleColorSelect(color.value)}
                className={`w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-110 ${
                  selectedColor === color.value ? "ring-4 ring-offset-2 ring-blue-300" : ""
                }`}
                style={{ backgroundColor: color.value }}
                title={color.label}
              />
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {(step === "name" || step === "email" || step === "password" || step === "tiktok" || step === "instagram") && !isTyping && (
        <div className={`sticky bottom-0 backdrop-blur-sm px-4 py-4 ${
          isDark
            ? "bg-slate-900/80 border-t border-slate-700/50"
            : "bg-white/80 border-t border-pink-100"
        }`}>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              type={getInputType()}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={getPlaceholder()}
              className={`flex-1 rounded-full ${
                isDark
                  ? "bg-slate-800 border-slate-600 text-white placeholder-gray-400 focus:border-blue-400 focus:ring-blue-400"
                  : `${brand.inputBorder} ${brand.inputFocus}`
              }`}
              autoComplete={step === "password" ? "new-password" : step === "email" ? "email" : "off"}
            />
            <Button
              type="submit"
              size="icon"
              className={`rounded-full bg-gradient-to-br ${brand.gradient} hover:opacity-90`}
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          {error && (
            <p className="text-xs text-red-500 mt-2 text-center">{error}</p>
          )}
        </div>
      )}

      {/* Loading state during registration */}
      {step === "complete" && registerMutation.isPending && (
        <div className={`sticky bottom-0 backdrop-blur-sm px-4 py-4 ${
          isDark
            ? "bg-slate-900/80 border-t border-slate-700/50"
            : "bg-white/80 border-t border-pink-100"
        }`}>
          <div className="flex items-center justify-center gap-2 text-blue-400">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">登録中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
