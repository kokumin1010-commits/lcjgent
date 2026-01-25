import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Heart, ArrowLeft } from "lucide-react";

type Step = "welcome" | "name" | "email" | "password" | "color" | "complete";

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  isInput?: boolean;
  inputType?: "text" | "email" | "password" | "color";
}

const COLORS = [
  { name: "ピンク", value: "#FF69B4" },
  { name: "パープル", value: "#9B59B6" },
  { name: "ブルー", value: "#3498DB" },
  { name: "グリーン", value: "#2ECC71" },
  { name: "オレンジ", value: "#E67E22" },
  { name: "レッド", value: "#E74C3C" },
  { name: "イエロー", value: "#F1C40F" },
  { name: "ティール", value: "#1ABC9C" },
];

export default function LiverRegister() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("welcome");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedColor, setSelectedColor] = useState("#FF69B4");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const registerMutation = trpc.liver.register.useMutation({
    onSuccess: () => {
      addBotMessage("登録完了！🎉");
      setTimeout(() => {
        addBotMessage(`${name}さん、これからよろしくね！✨`);
        setTimeout(() => {
          addBotMessage("マイページに移動するね！");
          setTimeout(() => {
            navigate("/liver/mypage");
          }, 1500);
        }, 1500);
      }, 1000);
    },
    onError: (err) => {
      setError(err.message);
      addBotMessage(`あれ、エラーが出ちゃった...😢 ${err.message}`);
      addBotMessage("もう一度試してみてね！");
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
        addBotMessage("LCJスケジュールへようこそ！💖");
        setTimeout(() => {
          addBotMessage("一緒にアカウントを作ろう！");
          setTimeout(() => {
            setStep("name");
            addBotMessage("まずは、あなたのお名前を教えてね！🎤", true, "text");
          }, 800);
        }, 800);
      }, 800);
    }, 500);
  }, []);

  const addBotMessage = (content: string, isInput = false, inputType?: "text" | "email" | "password" | "color") => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          type: "bot",
          content,
          isInput,
          inputType,
        },
      ]);
      setIsTyping(false);
      if (isInput) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
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
            addBotMessage("次は、メールアドレスを教えてね！📧", true, "email");
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
            addBotMessage("パスワードを設定しよう！🔐（6文字以上）", true, "password");
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
            setStep("color");
            addBotMessage("最後に、あなたのテーマカラーを選んでね！🎨");
          }, 800);
        }, 300);
        break;
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    const colorName = COLORS.find((c) => c.value === color)?.name || "素敵な色";
    addUserMessage(`${colorName}を選んだよ！`);
    setTimeout(() => {
      addBotMessage(`${colorName}、いいね！✨`);
      setTimeout(() => {
        addBotMessage("これで準備完了！登録するね...🚀");
        setStep("complete");
        registerMutation.mutate({
          name,
          email,
          password,
          color,
        });
      }, 800);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-pink-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/s")}
            className="text-gray-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">LCJスケジュール</h1>
              <p className="text-xs text-gray-500">新規登録</p>
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
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center mr-2 flex-shrink-0">
                  <Heart className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  message.type === "user"
                    ? "bg-gradient-to-br from-pink-500 to-purple-500 text-white rounded-br-md"
                    : "bg-white shadow-sm border border-pink-100 text-gray-800 rounded-bl-md"
                }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center mr-2">
              <Heart className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white shadow-sm border border-pink-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
            {COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleColorSelect(color.value)}
                className={`w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-110 ${
                  selectedColor === color.value ? "ring-4 ring-offset-2 ring-pink-300" : ""
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {(step === "name" || step === "email" || step === "password") && !isTyping && (
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-pink-100 px-4 py-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              type={step === "password" ? "password" : step === "email" ? "email" : "text"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                step === "name"
                  ? "お名前を入力..."
                  : step === "email"
                  ? "メールアドレスを入力..."
                  : "パスワードを入力..."
              }
              className="flex-1 rounded-full border-pink-200 focus:border-pink-400 focus:ring-pink-400"
              autoComplete={step === "password" ? "new-password" : step === "email" ? "email" : "name"}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full bg-gradient-to-br from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
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
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-pink-100 px-4 py-4">
          <div className="flex items-center justify-center gap-2 text-pink-500">
            <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">登録中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
