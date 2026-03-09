import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { setLiverToken } from "@/lib/liverAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Heart, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLiverT, LiverLanguage } from "@/lib/liverI18n";

type Step = "welcome" | "name" | "email" | "password" | "color" | "complete";

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  isInput?: boolean;
  inputType?: "text" | "email" | "password" | "color";
}

const COLOR_KEYS = [
  { key: "color.pink", value: "#FF69B4" },
  { key: "color.purple", value: "#9B59B6" },
  { key: "color.blue", value: "#3498DB" },
  { key: "color.green", value: "#2ECC71" },
  { key: "color.orange", value: "#E67E22" },
  { key: "color.red", value: "#E74C3C" },
  { key: "color.yellow", value: "#F1C40F" },
  { key: "color.teal", value: "#1ABC9C" },
];

export default function LiverRegister() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const lt = createLiverT(language as LiverLanguage);
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

  const utils = trpc.useUtils();
  
  const registerMutation = trpc.liver.register.useMutation({
    onSuccess: async (data) => {
      // Save token to localStorage
      if (data.token) {
        setLiverToken(data.token);
      }
      // キャッシュを無効化して新しいセッションを反映
      await utils.liver.me.invalidate();
      
      addBotMessage(lt("register.complete"));
      setTimeout(() => {
        addBotMessage(lt("register.welcome", { name }));
        setTimeout(() => {
          addBotMessage(lt("register.redirecting"));
          setTimeout(() => {
            // Navigate to mypage
            window.location.href = "/liver/mypage";
          }, 1500);
        }, 1500);
      }, 1000);
    },
    onError: (err) => {
      setError(err.message);
      addBotMessage(`${lt("register.error")} ${err.message}`);
      addBotMessage(lt("register.tryAgain"));
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
      addBotMessage(lt("register.greeting1"));
      setTimeout(() => {
        addBotMessage(lt("register.greeting2"));
        setTimeout(() => {
          addBotMessage(lt("register.greeting3"));
          setTimeout(() => {
            setStep("name");
            addBotMessage(lt("register.askName"), true, "text");
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
          addBotMessage(lt("register.niceName", { name: value }));
          setTimeout(() => {
            setStep("email");
            addBotMessage(lt("register.askEmail"), true, "email");
          }, 800);
        }, 300);
        break;

      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          setError(lt("register.invalidEmail"));
          return;
        }
        addUserMessage(value);
        setEmail(value);
        setTimeout(() => {
          addBotMessage(lt("register.thankYou"));
          setTimeout(() => {
            setStep("password");
            addBotMessage(lt("register.askPassword"), true, "password");
          }, 800);
        }, 300);
        break;

      case "password":
        if (value.length < 6) {
          setError(lt("register.shortPassword"));
          return;
        }
        addUserMessage("••••••");
        setPassword(value);
        setTimeout(() => {
          addBotMessage(lt("register.perfect"));
          setTimeout(() => {
            setStep("color");
            addBotMessage(lt("register.askColor"));
          }, 800);
        }, 300);
        break;
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    const colorName = COLOR_KEYS.find((c) => c.value === color)?.key;
    const colorLabel = colorName ? lt(colorName) : color;
    addUserMessage(lt("register.colorSelected", { color: colorLabel }));
    setTimeout(() => {
      addBotMessage(lt("register.colorNice", { color: colorLabel }));
      setTimeout(() => {
        addBotMessage(lt("register.registering"));
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
            className="text-gray-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">{lt("login.title")}</h1>
              <p className="text-xs text-gray-300">{lt("register.title")}</p>
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
            {COLOR_KEYS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleColorSelect(color.value)}
                className={`w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-110 ${
                  selectedColor === color.value ? "ring-4 ring-offset-2 ring-pink-300" : ""
                }`}
                style={{ backgroundColor: color.value }}
                title={lt(color.key)}
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
                  ? lt("register.namePlaceholder")
                  : step === "email"
                  ? lt("register.emailPlaceholder")
                  : lt("register.passwordPlaceholder")
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
            <span className="text-sm">{lt("register.submitting")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
