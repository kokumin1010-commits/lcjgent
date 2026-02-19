import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, Send, Eye, EyeOff, CheckCircle2, ShoppingBag, Gift } from "lucide-react";
import sfx from "@/lib/soundEffects";
import haptic from "@/lib/haptic";

/* ═══════════════════════════════════════════════════════════════
   CHAT REGISTER - チャット形式の新規会員登録
   ルーレット当選後にのみアクセス可能
   ステップ: フルネーム → 電話番号 → メールアドレス → パスワード
   ═══════════════════════════════════════════════════════════════ */

type ChatStep = "welcome" | "name" | "phone" | "email" | "password" | "registering" | "complete";

interface ChatMessage {
  id: string;
  type: "bot" | "user";
  text: string;
  delay?: number;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

function ChatBubble({ message, isNew }: { message: ChatMessage; isNew: boolean }) {
  const isBot = message.type === "bot";
  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"} ${isNew ? "animate-slideUp" : ""}`}>
      {isBot && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-2 mt-1"
          style={{ background: "linear-gradient(135deg, #ec4899, #f43f5e)" }}>
          <ShoppingBag className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isBot
          ? "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-md"
          : "bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-tr-md"
      }`}>
        <span dangerouslySetInnerHTML={{ __html: message.text }} />
      </div>
    </div>
  );
}

export default function ChatRegister() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<ChatStep>("welcome");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputDisabled, setInputDisabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });

  // Get referral code from localStorage (set by roulette flow)
  const referralCode = useRef(localStorage.getItem("lcj_spin_referral_code") || undefined);
  // Get won points from localStorage
  const wonPoints = useRef(localStorage.getItem("lcj_spin_won_points") || "5,000");

  // Check if user came from roulette
  useEffect(() => {
    const fromRoulette = sessionStorage.getItem("lcj_from_roulette");
    if (!fromRoulette) {
      // Not from roulette, redirect to top
      setLocation("/");
      return;
    }
  }, [setLocation]);

  // Register mutation
  const registerMutation = trpc.lineLogin.emailRegister.useMutation({
    onSuccess: (data) => {
      if (data.sessionToken) {
        localStorage.setItem("lcj_session_token", data.sessionToken);
      }
      localStorage.removeItem("lcj_referral_code");
      localStorage.removeItem("lcj_spin_referral_code");
      sessionStorage.removeItem("lcj_from_roulette");

      if (data.friendChallengeCode) {
        localStorage.setItem("lcj_friend_referral_code", data.friendChallengeCode);
      }

      setStep("complete");
      addBotMessages([
        "🎉 <b>登録完了！</b>",
        `おめでとうございます！<br/>あなたのアカウントが作成されました。`,
        `🎁 <b>${wonPoints.current}pt</b>の受け取り準備ができました！<br/><br/>マイページに移動して、ポイントを確認しましょう！`,
      ]);

      sfx.playCelebration();
      haptic.celebration();
    },
    onError: (err) => {
      setStep("email");
      addBotMessages([
        `⚠️ ${err.message || "登録に失敗しました"}`,
        "もう一度メールアドレスを入力してください 📧",
      ]);
      setInputDisabled(false);
    },
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const addBotMessages = useCallback((texts: string[]) => {
    setIsTyping(true);
    setInputDisabled(true);
    let delay = 0;
    texts.forEach((text, i) => {
      const msgDelay = Math.min(text.length * 15, 1200) + 400;
      delay += i === 0 ? 600 : msgDelay;
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `bot-${Date.now()}-${i}`,
          type: "bot",
          text,
        }]);
        scrollToBottom();
        if (i === texts.length - 1) {
          setTimeout(() => {
            setIsTyping(false);
            setInputDisabled(false);
            inputRef.current?.focus();
          }, 300);
        }
      }, delay);
    });
  }, [scrollToBottom]);

  const addUserMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      type: "user",
      text,
    }]);
    scrollToBottom();
    haptic.tap();
  }, [scrollToBottom]);

  // Welcome messages
  useEffect(() => {
    const timer = setTimeout(() => {
      addBotMessages([
        `🎊 <b>おめでとうございます！</b>`,
        `ルーレットで <b style="color:#ef4444">${wonPoints.current}pt</b> が当選しました！🎰`,
        `ポイントを受け取るために、<b>かんたん会員登録</b>をしましょう！<br/><br/>まずは <b>お名前</b> を教えてください 😊`,
      ]);
      setStep("name");
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(() => {
    const value = inputValue.trim();
    if (!value || inputDisabled) return;

    switch (step) {
      case "name": {
        if (value.length < 1) {
          toast.error("お名前を入力してください");
          return;
        }
        addUserMessage(value);
        setFormData(prev => ({ ...prev, name: value }));
        setInputValue("");
        setStep("phone");
        setTimeout(() => {
          addBotMessages([
            `<b>${value}</b>さん、よろしくお願いします！ 👋`,
            `次に <b>電話番号</b> を教えてください 📱<br/><small style="color:#9ca3af">（ハイフンなしで入力してください）</small>`,
          ]);
        }, 300);
        break;
      }
      case "phone": {
        const phoneClean = value.replace(/[-\s]/g, "");
        if (!/^0\d{9,10}$/.test(phoneClean)) {
          toast.error("正しい電話番号を入力してください（例: 09012345678）");
          return;
        }
        addUserMessage(value);
        setFormData(prev => ({ ...prev, phone: phoneClean }));
        setInputValue("");
        setStep("email");
        setTimeout(() => {
          addBotMessages([
            `📱 電話番号を確認しました！`,
            `次に <b>メールアドレス</b> を入力してください 📧`,
          ]);
        }, 300);
        break;
      }
      case "email": {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          toast.error("正しいメールアドレスを入力してください");
          return;
        }
        addUserMessage(value);
        setFormData(prev => ({ ...prev, email: value }));
        setInputValue("");
        setStep("password");
        setTimeout(() => {
          addBotMessages([
            `✉️ メールアドレスを確認しました！`,
            `最後に <b>パスワード</b> を設定してください 🔒<br/><small style="color:#9ca3af">（6文字以上）</small>`,
          ]);
        }, 300);
        break;
      }
      case "password": {
        if (value.length < 6) {
          toast.error("パスワードは6文字以上で入力してください");
          return;
        }
        addUserMessage("●".repeat(value.length));
        setFormData(prev => ({ ...prev, password: value }));
        setInputValue("");
        setStep("registering");
        setInputDisabled(true);
        setTimeout(() => {
          addBotMessages([
            `🔒 パスワードを設定しました！`,
            `📝 <b>登録情報を確認中...</b><br/>少々お待ちください ⏳`,
          ]);
          // Trigger registration
          setTimeout(() => {
            registerMutation.mutate({
              email: formData.email || value, // fallback
              password: value,
              name: formData.name,
              phone: formData.phone,
              referralCode: referralCode.current,
            });
          }, 1500);
        }, 300);
        break;
      }
    }
  }, [inputValue, step, inputDisabled, formData, addUserMessage, addBotMessages, registerMutation]);

  const getPlaceholder = () => {
    switch (step) {
      case "name": return "お名前を入力...";
      case "phone": return "09012345678";
      case "email": return "example@email.com";
      case "password": return "6文字以上のパスワード";
      default: return "";
    }
  };

  const getInputType = () => {
    switch (step) {
      case "email": return "email";
      case "phone": return "tel";
      case "password": return showPassword ? "text" : "password";
      default: return "text";
    }
  };

  const handleGoToMypage = () => {
    window.location.href = "/mypage";
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #1a0a00 0%, #0a0500 40%, #000 100%)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #ec4899, #f43f5e)" }}>
            <ShoppingBag className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">LCJ MALL</span>
            <p className="text-[10px] text-gray-500">新規会員登録</p>
          </div>
        </div>
        {/* Progress indicator */}
        <div className="flex items-center gap-1">
          {["name", "phone", "email", "password"].map((s, i) => {
            const stepOrder = ["name", "phone", "email", "password"];
            const currentIdx = stepOrder.indexOf(step);
            const isComplete = i < currentIdx || step === "registering" || step === "complete";
            const isCurrent = s === step;
            return (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${
                isComplete ? "bg-green-500 w-6" : isCurrent ? "bg-yellow-400 w-8" : "bg-gray-700 w-4"
              }`} />
            );
          })}
        </div>
      </div>

      {/* Prize banner */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-3 py-2">
          <Gift className="h-4 w-4 text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-400">
            🎰 ルーレット当選: <b>{wonPoints.current}pt</b> — 登録完了で受け取れます！
          </p>
        </div>
      </div>

      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <ChatBubble key={msg.id} message={msg} isNew={i >= messages.length - 1} />
        ))}
        {isTyping && <TypingIndicator />}

        {/* Complete state - CTA button */}
        {step === "complete" && !isTyping && (
          <div className="flex justify-center pt-4 animate-slideUp">
            <button
              onClick={handleGoToMypage}
              className="w-full max-w-sm py-4 rounded-2xl text-lg font-black text-white active:scale-95 transition-transform relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
                animation: "btnBounce 2s ease-in-out infinite",
              }}
            >
              <div className="absolute inset-0" style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                animation: "shimmerBtn 2.5s ease-in-out infinite",
              }} />
              <span className="relative z-10">🎁 マイページでポイントを確認する</span>
              <style>{`
                @keyframes btnBounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
                @keyframes shimmerBtn { 0% { transform: translateX(-100%); } 50%, 100% { transform: translateX(100%); } }
              `}</style>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {step !== "complete" && step !== "registering" && (
        <div className="border-t border-gray-800/50 px-4 py-3 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 max-w-lg mx-auto">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type={getInputType()}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                placeholder={getPlaceholder()}
                disabled={inputDisabled}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all disabled:opacity-50"
                autoComplete={step === "email" ? "email" : step === "password" ? "new-password" : step === "phone" ? "tel" : "name"}
              />
              {step === "password" && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={inputDisabled || !inputValue.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
              style={{
                background: inputDisabled || !inputValue.trim()
                  ? "#374151"
                  : "linear-gradient(135deg, #ec4899, #f43f5e)",
              }}
            >
              {registerMutation.isPending ? (
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Slide up animation */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}
